// src/pages/TaxCalculation/TaxCalculation.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  Button,
  Input,
  Label,
  Table,
  Spinner,
  Alert,
} from 'reactstrap';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import { useTT } from '../../helpers/useTT';
import { buildApiUrl } from '../../helpers/apiBase';
import { CALCULATE_DUTY_TAXES } from '../../helpers/url_helper';

type DutyLine = {
  dutyRegimeCode: string;
  typeCode: 'CUD';
  requestOverrideCode?: 'X' | '';
};

type Totals = {
  duty: number | null;
  gst: number | null;
  dutiesAndTaxes: number | null;
  assessableValue: number | null;
  currency: string;
};

type MsgType = 'success' | 'danger' | 'warning' | 'info';
type UiMsg = { id: string; type: MsgType; text: string };

type FieldErrors = {
  releaseExitDate?: string;
  hsCode?: string;
  quantity?: string;
  adValoremBaseCAD?: string;
  adValoremCurrency?: string;
  exportCountry?: string;
  originCountry?: string;
  cudCode?: string;
};

const FIXED_LANG = 'EN';
const FIXED_BINDING_ID = '10';

const countryOptions = ['US', 'CN', 'JP', 'KR', 'SG', 'HK', 'MY'] as const;

const CUD_MAP: Record<string, string> = {
  CN: '02',
  US: '10',
  JP: '33',
  KR: '30',
  KH: '08',
  MY: '33',
  SG: '33',
};

// ✅ Fix duplicated-key warning (value repeats like 33)
const cudOptions = Object.entries(CUD_MAP).map(([k, v]) => ({
  key: `${k}-${v}`,
  label: `${k}: ${v}`,
  value: v,
}));

function cudByCoo(coo: string): string {
  return CUD_MAP[(coo || '').toUpperCase()] || '10';
}

// ---------- helpers ----------
function cleanHs(hs: string) {
  return String(hs || '').replace(/\D+/g, '');
}
function isValidHs(hs: string) {
  return /^\d{8,10}$/.test(hs);
}
function toNumberLoose(v: any): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const cleaned = s.replace(/[^\d.,\- ]+/g, '').replace(/\s+/g, '');
  if (cleaned.includes(',')) return Number(cleaned.replace(/,/g, ''));
  return Number(cleaned);
}
function round3(v: any) {
  const x = Number(v);
  return isFinite(x) ? (Math.round(x * 1000) / 1000).toString() : String(v ?? '');
}
function fmt(n: number | null) {
  if (n === null) return '-';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------- bulk header detection ----------
function nrm(s: any) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_\-()（）:,，.。/\\|]+/g, '');
}
const HS_ALIASES = [
  'hscode',
  'hsdcode',
  'tariff',
  'hstariff',
  'hscodetariff',
  '海关编码',
  '税则号列',
  '关税编码',
];
const QTY_ALIASES = ['qty', 'quantity', 'qtty', '个数', '数量'];
const VAL_ALIASES = [
  'totalvalue',
  'value',
  'amount',
  'invoicevalue',
  '总货值',
  '货值',
  '申报总值',
  '申报金额',
  '总金额',
];
const COO_ALIASES = [
  'coo',
  'countryoforigin',
  'origin',
  'exportcountry',
  'country',
  '原产国',
  '原产地',
  '产地',
  '国家',
];

function headerScore(row: any[]) {
  const norm = (row || []).map(nrm);
  const has = (als: string[]) => norm.some((c) => als.some((a) => c.includes(nrm(a))));
  let s = 0;
  if (has(HS_ALIASES)) s++;
  if (has(QTY_ALIASES)) s++;
  if (has(VAL_ALIASES)) s++;
  if (has(COO_ALIASES)) s++;
  return s;
}

function buildIndexMap(headerRow: any[]) {
  const norm = (headerRow || []).map(nrm);
  const find = (als: string[]) => {
    for (let i = 0; i < norm.length; i++) if (als.includes(norm[i])) return i;
    for (let i = 0; i < norm.length; i++) if (als.some((a) => norm[i].includes(nrm(a)))) return i;
    return -1;
  };
  return {
    hs: find(HS_ALIASES),
    qty: find(QTY_ALIASES),
    val: find(VAL_ALIASES),
    coo: find(COO_ALIASES),
  };
}

function autoFindHeader(wb: XLSX.WorkBook) {
  let best = { sheet: '', idx: -1, score: -1 };
  for (const sn of wb.SheetNames || []) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    const limit = Math.min(1000, rows.length);
    for (let i = 0; i < limit; i++) {
      const row = rows[i] || [];
      const nonEmpty = row.reduce((a, v) => a + (String(v ?? '').trim() ? 1 : 0), 0);
      if (nonEmpty < 2) continue;
      const sc = headerScore(row);
      if (sc > best.score) best = { sheet: sn, idx: i, score: sc };
      if (best.score === 4) break;
    }
  }
  return best;
}

// ---------- fetch helpers ----------
async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
function extractErrMessage(res: Response, data: any): string {
  return (
    data?.parsed?.Response?.Error?.Description ||
    data?.error ||
    data?.message ||
    `Request failed (${res.status})`
  );
}
function dbg(...args: any[]) {
  console.log('%c[TAX]', 'color:#0ea5e9;font-weight:700', ...args);
}

export default function TaxCalculation() {
  const { tt } = useTT();

  // ✅ Fix: when i18n missing, some libs return the key itself (e.g. "tax.hsCode")
  const tOr = useCallback(
    (k: string, fb: string) => {
      const v = tt(k);
      if (!v || v === k) return fb;
      return v;
    },
    [tt]
  );

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [releaseExitDate, setReleaseExitDate] = useState('');

  // UI messages (like ElMessage)
  const [msgs, setMsgs] = useState<UiMsg[]>([]);
  const pushMsg = useCallback((type: MsgType, text: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setMsgs((p) => [{ id, type, text }, ...p].slice(0, 8));
    window.setTimeout(
      () => setMsgs((p) => p.filter((m) => m.id !== id)),
      type === 'danger' ? 7000 : 3800
    );
  }, []);
  const clearMsgs = useCallback(() => setMsgs([]), []);

  const [errors, setErrors] = useState<FieldErrors>({});

  const [totals, setTotals] = useState<Totals>({
    duty: null,
    gst: null,
    dutiesAndTaxes: null,
    assessableValue: null,
    currency: 'CAD',
  });

  const totalsReady = useMemo(() => {
    return (
      !!totals.currency &&
      (totals.duty !== null ||
        totals.gst !== null ||
        totals.dutiesAndTaxes !== null ||
        totals.assessableValue !== null)
    );
  }, [totals]);

  const [form, setForm] = useState({
    hsCode: '',
    quantity: '',
    quantityUom: 'KGM',
    exportCountry: '',
    originCountry: '',
    adValoremBaseCAD: '',
    adValoremCurrency: 'USD',
    language: FIXED_LANG,
    bindingTariffRefId: FIXED_BINDING_ID,
    dutyRegimes: [
      { dutyRegimeCode: '', typeCode: 'CUD', requestOverrideCode: 'X' as 'X' },
    ] as DutyLine[],
    addlStatements: [
      { code: 'N', type: 'ASJ' },
      { code: 'N', type: 'BSJ' },
      { code: 'N', type: 'CSJ' },
      { code: '013', type: 'VDC' },
    ],
  });

  const [bulkCurrency, setBulkCurrency] = useState('USD');
  const [headerRowOverride, setHeaderRowOverride] = useState<number | ''>('');
  const [lastFileName, setLastFileName] = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);

  // focus refs
  const dateRef = useRef<HTMLInputElement | null>(null);
  const hsRef = useRef<HTMLInputElement | null>(null);
  const qtyRef = useRef<HTMLInputElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const exportRef = useRef<HTMLSelectElement | null>(null);
  const originRef = useRef<HTMLSelectElement | null>(null);
  const cudRef = useRef<HTMLSelectElement | null>(null);

  const focusRef = (r: React.RefObject<any>) => {
    const el = r.current;
    if (!el) return;
    try {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  };

  const sendCalc = useCallback(async (body: any) => {
    const url = buildApiUrl(CALCULATE_DUTY_TAXES);

    const post = async (payload: any) => {
      dbg('API POST =>', url, payload);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res);
      dbg('API status =', res.status, data);
      return { res, data };
    };

    let { res, data } = await post(body);
    if (res.ok) return { res, data };

    const desc = extractErrMessage(res, data);
    const m = desc.match(/\( *([A-Z]{3}) *\)/);

    if (res.status === 400 && /COMMODITY UoM/i.test(desc) && m) {
      const requiredUom = m[1];
      const retryPayload = { ...body, quantityUom: requiredUom, quantity: round3(body.quantity) };
      ({ res, data } = await post(retryPayload));
      if (res.ok) return { res, data };
    }

    if (res.status === 400 && /fraction digits/i.test(desc)) {
      const retryPayload = { ...body, quantity: round3(body.quantity) };
      ({ res, data } = await post(retryPayload));
      if (res.ok) return { res, data };
    }

    throw new Error(desc);
  }, []);

  const validate = useCallback((): boolean => {
    const e: FieldErrors = {};
    const messages: string[] = [];

    if (!releaseExitDate) {
      e.releaseExitDate = tOr('tax.dateRequired', 'Entry/Release Date is required.');
      messages.push(e.releaseExitDate);
    }

    const hs = cleanHs(form.hsCode);
    if (!hs) {
      e.hsCode = tOr('tax.hsRequired', 'HS Code is required.');
      messages.push(e.hsCode);
    } else if (!isValidHs(hs)) {
      e.hsCode = tOr('tax.hsInvalid', 'HS Code must be 8–10 digits.');
      messages.push(e.hsCode);
    }

    if (!String(form.quantity || '').trim()) {
      e.quantity = tOr('tax.qtyRequired', 'Quantity is required.');
      messages.push(e.quantity);
    }

    if (!String(form.adValoremBaseCAD || '').trim()) {
      e.adValoremBaseCAD = tOr('tax.valueRequired', 'Amount is required.');
      messages.push(e.adValoremBaseCAD);
    } else {
      const valNum = toNumberLoose(form.adValoremBaseCAD);
      if (!isFinite(valNum) || valNum <= 0) {
        e.adValoremBaseCAD = tOr('tax.valueInvalid', 'Value for Currency Conversion is invalid.');
        messages.push(e.adValoremBaseCAD);
      }
    }

    if (!form.adValoremCurrency) {
      e.adValoremCurrency = tOr('tax.currencyRequired', 'Currency is required.');
      messages.push(e.adValoremCurrency);
    }

    if (!form.exportCountry) {
      e.exportCountry = tOr('tax.exportRequired', 'Export Country is required.');
      messages.push(e.exportCountry);
    }
    if (!form.originCountry) {
      e.originCountry = tOr('tax.originRequired', 'Origin Country is required.');
      messages.push(e.originCountry);
    }

    const cudCode = String(form.dutyRegimes?.[0]?.dutyRegimeCode || '');
    if (!cudCode) {
      e.cudCode = tOr('tax.cudRequired', 'Please select CUD code.');
      messages.push(e.cudCode);
    }

    setErrors(e);

    if (messages.length) {
      clearMsgs();
      messages.forEach((m) => pushMsg('danger', m));
      dbg('VALIDATION FAIL:', e);

      if (e.releaseExitDate) focusRef(dateRef);
      else if (e.hsCode) focusRef(hsRef);
      else if (e.quantity) focusRef(qtyRef);
      else if (e.adValoremBaseCAD || e.adValoremCurrency) focusRef(amountRef);
      else if (e.exportCountry) focusRef(exportRef as any);
      else if (e.originCountry) focusRef(originRef as any);
      else if (e.cudCode) focusRef(cudRef as any);

      return false;
    }

    return true;
  }, [clearMsgs, form, pushMsg, releaseExitDate, tOr]);

  const submit = useCallback(async () => {
    dbg('submit clicked');
    if (!validate()) return;

    const hs = cleanHs(form.hsCode);
    const valNum = toNumberLoose(form.adValoremBaseCAD);
    const cudCode = String(form.dutyRegimes?.[0]?.dutyRegimeCode || '');

    const body = {
      language: form.language,
      releaseDate: releaseExitDate,
      exitDate: releaseExitDate,
      bindingTariffRefId: form.bindingTariffRefId,
      hsCode: hs,
      quantity: form.quantity,
      quantityUom: form.quantityUom,
      exportCountry: form.exportCountry,
      originCountry: form.originCountry,
      adValoremBaseCAD: Number(valNum),
      AdValoremTaxBaseAmount: [{ currencyID: form.adValoremCurrency }],
      adValoremCurrency: form.adValoremCurrency,
      dutyRegimes: [
        {
          dutyRegimeCode: cudCode,
          typeCode: 'CUD',
          ...(form.dutyRegimes?.[0]?.requestOverrideCode ? { requestOverrideCode: 'X' } : {}),
        },
        { dutyRegimeCode: '01', typeCode: 'GST' },
      ],
      addlStatements: form.addlStatements,
    };

    setLoading(true);
    clearMsgs();
    try {
      const { data } = await sendCalc(body);
      const t = data?.summary?.goodsShipment?.items?.[0]?.commodity?.totals;

      if (!t) {
        pushMsg('danger', tOr('tax.noTotals', 'No totals returned. Check inputs.'));
        return;
      }

      setTotals({
        duty: t.duty ?? null,
        gst: t.gst ?? null,
        dutiesAndTaxes: t.dutiesAndTaxes ?? null,
        assessableValue: t.assessableValue ?? null,
        currency: t.currency || 'CAD',
      });

      pushMsg('success', tOr('tax.success', 'Calculated successfully.'));
    } catch (e: any) {
      pushMsg('danger', e?.message || tOr('tax.failed', 'Request failed.'));
      dbg('API ERROR:', e);
    } finally {
      setLoading(false);
    }
  }, [clearMsgs, form, pushMsg, releaseExitDate, sendCalc, tOr, validate]);

  const onExcelPicked = useCallback(
    async (file: File) => {
      if (!file) return;

      clearMsgs();

      if (!releaseExitDate) {
        const msg = tOr('tax.bulkDateRequired', 'Entry/Release Date is required for bulk upload.');
        setErrors((p) => ({ ...p, releaseExitDate: msg }));
        pushMsg('danger', msg);
        focusRef(dateRef);
        return;
      }

      setBulkLoading(true);
      try {
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });

        let targetSheet = wb.SheetNames[0];
        let headerRowIdx = 0;

        const overrideNum =
          typeof headerRowOverride === 'number' ? headerRowOverride : Number(headerRowOverride);
        if (overrideNum && overrideNum > 0) {
          headerRowIdx = Math.max(0, overrideNum - 1);
        } else {
          const best = autoFindHeader(wb);
          if (best.idx < 0) {
            const firstSheet = wb.SheetNames[0];
            const preview: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], {
              header: 1,
              raw: true,
            });
            const firstRow = preview?.[0] || [];
            throw new Error(
              `Could not detect header row automatically. First row is: [ ${firstRow.join(' , ')} ]. Enter the actual header row # and re-upload.`
            );
          }
          targetSheet = best.sheet;
          headerRowIdx = best.idx;
        }

        const ws = wb.Sheets[targetSheet];
        const rowsAll: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
        if (!rowsAll.length) throw new Error('No rows found in sheet');

        const header = rowsAll[headerRowIdx] || [];
        const idx = buildIndexMap(header);
        if (idx.hs < 0 || idx.qty < 0 || idx.val < 0 || idx.coo < 0) {
          throw new Error(
            `Missing required columns: HS CODE/HSD CODE, QTY, TOTAL VALUE, COO (detected at row ${headerRowIdx + 1}).`
          );
        }

        const matrixFromHeader = rowsAll.slice(headerRowIdx);
        const wsFromHeader = XLSX.utils.aoa_to_sheet(matrixFromHeader);
        const dataRows = XLSX.utils.sheet_to_json<any>(wsFromHeader, { defval: '', raw: true });
        if (!dataRows.length) throw new Error('No data rows found.');

        const outputRows: any[] = [];
        let processed = 0;

        for (const r of dataRows) {
          const arrRow = header.map((h: any) => r[h] ?? '');
          const hs = cleanHs(String(arrRow[idx.hs] ?? ''));
          const qtyStr = String(arrRow[idx.qty] ?? '').trim() || '1.000';
          const qty = round3(qtyStr);
          const valNum = toNumberLoose(arrRow[idx.val]);
          const coo =
            String(arrRow[idx.coo] ?? '')
              .trim()
              .toUpperCase() || 'US';

          if (!isValidHs(hs) || !isFinite(valNum) || valNum <= 0) {
            outputRows.push({
              ...r,
              'Customs Duty': '',
              GST: '',
              'Duties & Taxes (Total)': '',
              'Assessable Value (VFT)': '',
            });
            continue;
          }

          const cudCode = cudByCoo(coo);

          const baseBody = {
            language: FIXED_LANG,
            releaseDate: releaseExitDate,
            exitDate: releaseExitDate,
            bindingTariffRefId: FIXED_BINDING_ID,
            hsCode: hs,
            quantity: qty,
            quantityUom: 'KGM',
            exportCountry: coo,
            originCountry: coo,
            adValoremBaseCAD: Number(valNum),
            AdValoremTaxBaseAmount: [{ currencyID: bulkCurrency || 'USD' }],
            adValoremCurrency: bulkCurrency || 'USD',
            dutyRegimes: [
              { dutyRegimeCode: cudCode, typeCode: 'CUD', requestOverrideCode: 'X' },
              { dutyRegimeCode: '01', typeCode: 'GST' },
            ],
            addlStatements: [
              { code: 'N', type: 'ASJ' },
              { code: 'N', type: 'BSJ' },
              { code: 'N', type: 'CSJ' },
              { code: '013', type: 'VDC' },
            ],
          };

          try {
            const { data } = await sendCalc(baseBody);
            const t = data?.summary?.goodsShipment?.items?.[0]?.commodity?.totals;
            outputRows.push({
              ...r,
              'Customs Duty': t?.duty ?? '',
              GST: t?.gst ?? '',
              'Duties & Taxes (Total)': t?.dutiesAndTaxes ?? '',
              'Assessable Value (VFT)': t?.assessableValue ?? '',
            });
            processed++;
          } catch {
            outputRows.push({
              ...r,
              'Customs Duty': '',
              GST: '',
              'Duties & Taxes (Total)': '',
              'Assessable Value (VFT)': '',
            });
          }
        }

        const outHeaders = [
          ...(rowsAll[headerRowIdx] || []),
          'Customs Duty',
          'GST',
          'Duties & Taxes (Total)',
          'Assessable Value (VFT)',
        ];
        const outSheet = XLSX.utils.json_to_sheet(outputRows, {
          header: outHeaders as any,
          skipHeader: false,
        });
        const outWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(outWb, outSheet, targetSheet || 'Sheet1');

        const outName =
          (file.name || 'upload').replace(/(\.xlsx|\.xls)$/i, '') + '_with_totals.xlsx';
        const wbout = XLSX.write(outWb, { type: 'array', bookType: 'xlsx' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), outName);

        setLastFileName(outName);
        pushMsg('success', tOr('tax.bulkDone', `Processed ${processed} rows. File downloaded.`));
      } catch (err: any) {
        pushMsg('danger', err?.message || tOr('tax.bulkFail', 'Failed to process Excel'));
      } finally {
        setBulkLoading(false);
      }
    },
    [bulkCurrency, clearMsgs, headerRowOverride, pushMsg, releaseExitDate, sendCalc, tOr]
  );

  const overlayVisible = bulkLoading || loading;

  return (
    <div className="tax-page">
      {overlayVisible && (
        <div className="tax-overlay">
          <div className="tax-overlay__box">
            <Spinner />
            <div className="tax-overlay__text">{tOr('tax.processing', 'Processing…')}</div>
          </div>
        </div>
      )}

      <div className="tax-scroll">
        <Container fluid className="tax-container">
          {/* ✅ sticky topbar like your CSS */}
          <div className="tax-topbar">
            <div className="tax-topbar__left">
              <h2 className="tax-title">{tOr('tax.title', 'Tax Calculator')}</h2>
              <div className="tax-subtitle">
                {tOr('tax.subtitle', 'Single calculation + bulk Excel calculation')}
              </div>
            </div>

            <div className="tax-topbar__right">
              <Button color="primary" className="tax-calc-btn" onClick={submit} disabled={loading}>
                {loading ? <Spinner size="sm" className="me-2" /> : null}
                {tOr('tax.calculate', 'Calculate')}
              </Button>
            </div>
          </div>

          {/* ✅ UI messages block (looks good above cards) */}
          {msgs.length > 0 && (
            <div className="mt-3">
              {msgs.map((m) => (
                <Alert key={m.id} color={m.type} className="mb-2 py-2">
                  {m.text}
                </Alert>
              ))}
            </div>
          )}

          {/* ✅ Totals sticky card */}
          {totalsReady && (
            <Card className="tax-totals" body>
              <div className="totals-grid">
                <div className="total-item">
                  <div className="k">{tOr('tax.customsDuty', 'Customs Duty')}</div>
                  <div className="v">{fmt(totals.duty)}</div>
                </div>
                <div className="total-item">
                  <div className="k">GST</div>
                  <div className="v">{fmt(totals.gst)}</div>
                </div>
                <div className="total-item">
                  <div className="k">{tOr('tax.duty', 'Duties & Taxes')}</div>
                  <div className="v">{fmt(totals.dutiesAndTaxes)}</div>
                </div>
                <div className="total-item">
                  <div className="k">{tOr('tax.access', 'Assessable Value')}</div>
                  <div className="v">{fmt(totals.assessableValue)}</div>
                </div>
                <div className="total-item">
                  <div className="k">{tOr('tax.currency2', 'Currency')}</div>
                  <div className="v">{totals.currency}</div>
                </div>
              </div>
            </Card>
          )}

          {/* ✅ Date card */}
          <Card className="tax-card">
            <CardBody>
              <div className="tax-section-title">
                {tOr('tax.enterDate', 'Entry/Release Date')} <span className="req">*</span>
              </div>

              <Row className="g-3">
                <Col lg={4} md={6}>
                  <Label className="form-label mb-1">
                    {tOr('tax.enterDate', 'Entry/Release Date')}
                  </Label>
                  <Input
                    innerRef={dateRef}
                    type="date"
                    value={releaseExitDate}
                    invalid={!!errors.releaseExitDate}
                    onChange={(e) => {
                      setReleaseExitDate(e.target.value);
                      setErrors((p) => ({ ...p, releaseExitDate: '' }));
                    }}
                  />
                  {errors.releaseExitDate ? (
                    <div className="invalid-feedback d-block">{errors.releaseExitDate}</div>
                  ) : null}
                </Col>
              </Row>
            </CardBody>
          </Card>

          {/* ✅ Single form card */}
          <Card className="tax-card">
            <CardBody>
              <div className="tax-section-title">{tOr('tax.single', 'Single Calculation')}</div>

              <div className="tax-grid-2">
                <div>
                  <Label className="form-label">{tOr('tax.hsCode', 'HS Code')}</Label>
                  <Input
                    innerRef={hsRef}
                    value={form.hsCode}
                    placeholder="e.g. 9401311000"
                    invalid={!!errors.hsCode}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, hsCode: e.target.value }));
                      setErrors((p) => ({ ...p, hsCode: '' }));
                    }}
                  />
                  {errors.hsCode ? (
                    <div className="invalid-feedback d-block">{errors.hsCode}</div>
                  ) : null}
                </div>

                <div>
                  <Label className="form-label">{tOr('tax.quantity', 'Quantity')}</Label>
                  <Input
                    innerRef={qtyRef}
                    value={form.quantity}
                    placeholder="1.000"
                    invalid={!!errors.quantity}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, quantity: e.target.value }));
                      setErrors((p) => ({ ...p, quantity: '' }));
                    }}
                  />
                  {errors.quantity ? (
                    <div className="invalid-feedback d-block">{errors.quantity}</div>
                  ) : null}
                </div>

                <div>
                  <Label className="form-label">{tOr('tax.quantityU', 'Quantity UoM')}</Label>
                  <Input
                    type="select"
                    value={form.quantityUom}
                    onChange={(e) => setForm((p) => ({ ...p, quantityUom: e.target.value }))}
                  >
                    <option value="KGM">KGM</option>
                    <option value="NMB">NMB</option>
                  </Input>
                </div>

                <div>
                  <Label className="form-label">{tOr('tax.amount', 'Amount')}</Label>
                  <Input
                    innerRef={amountRef}
                    value={form.adValoremBaseCAD}
                    placeholder="e.g. 10000"
                    invalid={!!errors.adValoremBaseCAD}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, adValoremBaseCAD: e.target.value }));
                      setErrors((p) => ({ ...p, adValoremBaseCAD: '' }));
                    }}
                  />
                  {errors.adValoremBaseCAD ? (
                    <div className="invalid-feedback d-block">{errors.adValoremBaseCAD}</div>
                  ) : null}
                </div>

                <div>
                  <Label className="form-label">{tOr('tax.currency', 'Currency')}</Label>
                  <Input
                    type="select"
                    value={form.adValoremCurrency}
                    invalid={!!errors.adValoremCurrency}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, adValoremCurrency: e.target.value }));
                      setErrors((p) => ({ ...p, adValoremCurrency: '' }));
                    }}
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                    <option value="CNY">CNY</option>
                    <option value="EUR">EUR</option>
                  </Input>
                  {errors.adValoremCurrency ? (
                    <div className="invalid-feedback d-block">{errors.adValoremCurrency}</div>
                  ) : null}
                </div>

                <div>
                  <Label className="form-label">{tOr('tax.exportCountry', 'Export Country')}</Label>
                  <Input
                    innerRef={exportRef as any}
                    type="select"
                    value={form.exportCountry}
                    invalid={!!errors.exportCountry}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, exportCountry: e.target.value }));
                      setErrors((p) => ({ ...p, exportCountry: '' }));
                    }}
                  >
                    <option value="">{tOr('common.select', 'Select')}</option>
                    {countryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Input>
                  {errors.exportCountry ? (
                    <div className="invalid-feedback d-block">{errors.exportCountry}</div>
                  ) : null}
                </div>

                <div>
                  <Label className="form-label">
                    {tOr('tax.originalCountry', 'Origin Country')}
                  </Label>
                  <Input
                    innerRef={originRef as any}
                    type="select"
                    value={form.originCountry}
                    invalid={!!errors.originCountry}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, originCountry: e.target.value }));
                      setErrors((p) => ({ ...p, originCountry: '' }));
                    }}
                  >
                    <option value="">{tOr('common.select', 'Select')}</option>
                    {countryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Input>
                  {errors.originCountry ? (
                    <div className="invalid-feedback d-block">{errors.originCountry}</div>
                  ) : null}
                </div>
              </div>

              <div className="tax-divider">{tOr('tax.dutyLine', 'Duty/Tax Line — CUD only')}</div>

              <div className="tax-table-wrap">
                <Table bordered responsive className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 380 }}>{tOr('tax.regime', 'Regime')}</th>
                      <th style={{ width: 160 }}>Type Code</th>
                      <th style={{ width: 340 }}>Request Override Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <Input
                          innerRef={cudRef as any}
                          type="select"
                          value={form.dutyRegimes[0]?.dutyRegimeCode || ''}
                          invalid={!!errors.cudCode}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((p) => ({
                              ...p,
                              dutyRegimes: [
                                { ...p.dutyRegimes[0], dutyRegimeCode: v, typeCode: 'CUD' },
                              ],
                            }));
                            setErrors((p) => ({ ...p, cudCode: '' }));
                          }}
                        >
                          <option value="">{tOr('common.select', 'Select')} (e.g. CN: 02)</option>
                          {cudOptions.map((opt) => (
                            <option key={opt.key} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Input>
                        {errors.cudCode ? (
                          <div className="invalid-feedback d-block">{errors.cudCode}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className="tax-pill tax-pill--info">CUD</span>
                      </td>
                      <td>
                        <Input
                          type="select"
                          value={form.dutyRegimes[0]?.requestOverrideCode || ''}
                          onChange={(e) => {
                            const v = e.target.value as any;
                            setForm((p) => ({
                              ...p,
                              dutyRegimes: [
                                { ...p.dutyRegimes[0], requestOverrideCode: v, typeCode: 'CUD' },
                              ],
                            }));
                          }}
                        >
                          <option value="">{tOr('common.optional', 'Optional')}</option>
                          <option value="X">X (self-declare SIMA/Surtax/Safeguard)</option>
                        </Input>
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </div>

              <div className="tax-meta">
                <div>
                  Language: <code>{form.language}</code>
                </div>
                <div>
                  Binding Tariff Ref ID: <code>{form.bindingTariffRefId}</code>
                </div>
                <div>
                  Additional Statements: <code>ASJ / BSJ / CSJ / VDC</code>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ✅ Bulk upload card */}
          <Card className="tax-card">
            <CardBody>
              <div className="tax-bulk-header">
                <div className="tax-section-title m-0">{tOr('tax.upload', 'Bulk Upload')}</div>

                <div className="tax-bulk-controls">
                  <div className="tax-field">
                    <Label className="form-label mb-1">{tOr('tax.bulkCurrency', 'Currency')}</Label>
                    <Input
                      type="select"
                      value={bulkCurrency}
                      onChange={(e) => setBulkCurrency(e.target.value)}
                      className="w-180"
                    >
                      <option value="USD">USD</option>
                      <option value="CAD">CAD</option>
                      <option value="CNY">CNY</option>
                      <option value="EUR">EUR</option>
                    </Input>
                  </div>

                  <div className="tax-field">
                    <Label className="form-label mb-1">
                      {tOr('tax.headerRow', 'Header row #')}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder={tOr('tax.headerRowOptional', 'Optional')}
                      value={headerRowOverride}
                      onChange={(e) => {
                        const v = e.target.value;
                        setHeaderRowOverride(v === '' ? '' : Number(v));
                      }}
                      className="w-180"
                    />
                  </div>

                  <Button
                    color="primary"
                    outline
                    className="tax-upload-btn"
                    onClick={() => fileRef.current?.click()}
                  >
                    {tOr('tax.uploadButton', 'Upload Excel')}
                  </Button>

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onExcelPicked(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </div>
              </div>

              <p className="tax-note">
                Expected headers: <code>HS Code</code>, <code>QTY</code>, <code>TOTAL VALUE</code>,{' '}
                <code>COO</code>.
                <br />
                <strong>Note:</strong> Set the Entry/Release Date above — it’s used for both Release
                and Exit dates for all rows.
              </p>

              {lastFileName && (
                <div className="tax-right">
                  <span className="tax-pill tax-pill--success">Processed: {lastFileName}</span>
                </div>
              )}
            </CardBody>
          </Card>

          <div style={{ height: 24 }} />
        </Container>
      </div>
    </div>
  );
}
