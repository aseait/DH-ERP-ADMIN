import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import AsyncCreatableSelect from 'react-select/async-creatable';
import {
  Container, Card, CardBody, Badge, Button, Input,
  Spinner, Alert, Table, Modal, ModalHeader, ModalBody, ModalFooter,
} from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { CS, CI, FI } from '../CustomerOrder/_ServiceListPage';
import { buildApiUrl } from '../../helpers/apiBase';
import { RETRIEVE_SALES_QUOTE, UPDATE_SALES_QUOTE, GET_CLIENT_USER_LIST } from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { buildPageList } from '../OrderLists/helper';
import {
  ProvinceOption, AreaOption, FsaOption,
  postalCodeOptions, loadProvinceOptions, makeAreaLoader, makeFsaLoader,
} from '../../helpers/postalCode';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCanadianPostcode(v: string): string {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length >= 6) return `${s.slice(0, 3)} ${s.slice(3, 6)}`;
  return s;
}

function isValidCanadianPostcode(v: string): boolean {
  return /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(v.trim().toUpperCase());
}

function formatDeliveryCity(v: string): string {
  return v.trim().replace(/\b\w/g, c => c.toUpperCase());
}

const MAX_FSA_SUGGESTIONS = 8;

function buildAdditionalInformation(unit: string | null, freeAmount: string): string {
  if (!freeAmount) return '';
  if (unit === '/Day') return `${freeAmount} ${Number(freeAmount) === 1 ? 'day' : 'days'} free`;
  if (unit === '/Hour') return `after ${freeAmount} ${Number(freeAmount) === 1 ? 'hour' : 'hours'} free`;
  return '';
}

function getFreeAmountFromAdditionalInfo(info?: string | null): string {
  const m = String(info || '').match(/\d+/);
  return m ? m[0] : '';
}

function formatDateOnly(v: unknown): string {
  if (!v) return '-';
  const s = String(v);
  return s.length >= 10 ? s.substring(0, 10) : s;
}

function escapeHtml(v: any): string {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

// ── Catalogue (same as CreateQuote) ──────────────────────────────────────────

type ServiceItem = {
  code: string; en: string; zh: string; cat: string; unit?: string;
};

const ITEMS: ServiceItem[] = [
  { code: 'BrokerageFee', en: 'Brokerage Fee', zh: '报关费', cat: 'brokerage' },
  { code: 'LineCharge', en: 'Line Charge', zh: '海关条目费（HS CODE超过5条收取）', cat: 'brokerage' },
  { code: 'DutyGSTAdmin', en: 'Duty/GST Admin Fee', zh: '税金代付费', cat: 'brokerage' },
  { code: 'Emanifest', en: 'Emanifest Fee', zh: '电子载货舱单（申报给CBSA）', cat: 'brokerage' },
  { code: 'ISF5_10', en: 'ISF-5 / ISF-10', zh: '美国过境进口申报费', cat: 'brokerage' },
  { code: 'ExamHandle', en: 'Exam Handling Fee', zh: '查验操作费', cat: 'brokerage' },
  { code: 'BondAgent', en: 'Bond Agent Fee', zh: 'Bond代理购买费', cat: 'brokerage' },
  { code: 'BrokerAppFee', en: 'Brokerage Application Fee', zh: '代理申请费（NRI/CFIA）', cat: 'brokerage' },
  { code: 'TitleFee', en: 'Title Fee', zh: '清关主体使用费', cat: 'brokerage' },
  { code: 'HandlingFee', en: 'Handling Fee', zh: '跟货操作费', cat: 'logistics' },
  { code: 'PCAdminFee', en: 'PC Admin Fee', zh: '第三方账单代付费', cat: 'logistics' },
  { code: 'LogisticsApp', en: 'Logistics Application Fee', zh: '物流代理申请费（ERS）', cat: 'logistics' },
  { code: 'OceanFee', en: 'Ocean Fee', zh: '海运费', cat: 'logistics' },
  { code: 'DrayageFee', en: 'Drayage Fee', zh: '提柜费', cat: 'logistics' },
  { code: 'DutyGSTAdvance', en: 'Duty/GST Advance Payment', zh: '关税代缴', cat: 'logistics' },
  { code: 'PrePull', en: 'Pre-pull', zh: '预提/预拉', cat: 'logistics', unit: '/Trip' },
  { code: 'StorageFee', en: 'Yard Storage', zh: '堆场存柜费', cat: 'logistics', unit: '/Day' },
  { code: 'ChassisRental', en: 'Chassis Rental', zh: '车架租赁', cat: 'logistics', unit: '/Day' },
  { code: 'LiveUnloadWaiting', en: 'Live-unload Waiting Time', zh: '现场卸货等时费', cat: 'logistics', unit: '/Hour' },
  { code: 'TerminalWaiting', en: 'Terminal Waiting Time', zh: '码头等时费', cat: 'logistics', unit: '/Hour' },
  { code: 'DGSurcharge', en: 'DG Surcharge', zh: '危险品附加费', cat: 'logistics' },
  { code: 'DGLabelRemove', en: 'DG Label Remove', zh: '危险品标签移除费', cat: 'logistics' },
  { code: 'ExtraStopSOC', en: 'Extra Stop/SOC', zh: '额外停靠/SOC', cat: 'logistics' },
  { code: 'DropOff', en: 'Drop Off', zh: '还柜/Drop off', cat: 'logistics' },
  { code: 'OtherLocalTrucking', en: 'Other Local Trucking', zh: '其他本地拖车费', cat: 'logistics' },
  { code: 'TruckLoading', en: 'Trucking and Loading', zh: '提货/派送费（第三方）', cat: 'logistics' },
  { code: 'ChassisYard', en: 'Chassis Rental/Yard Storage', zh: '卡车公司车架费/存柜费', cat: 'logistics' },
  { code: 'LiftOnOff', en: 'Lift On/Lift Off', zh: '起重机上/下架费', cat: 'logistics' },
  { code: 'DrayDeadRun', en: 'Drayage Dead Run', zh: '提/还柜空跑费', cat: 'logistics' },
  { code: 'DeStuff', en: 'De-stuff Fee', zh: '卸柜费', cat: 'warehouse' },
  { code: 'SortingFee', en: 'Sorting Fee', zh: '理货费', cat: 'warehouse' },
  { code: 'PalletWrap', en: 'Palletize and Wrapping Fee', zh: '打板缠膜费', cat: 'warehouse' },
  { code: 'Labelling', en: 'Labelling Fee', zh: '贴标/换标费', cat: 'warehouse' },
  { code: 'InLoading', en: 'In Loading Fee', zh: '入库费（散货/退货收取）', cat: 'warehouse' },
  { code: 'AMZAppt', en: 'Amazon Appointment Fee', zh: '亚马逊派送预约费', cat: 'warehouse' },
  { code: 'FBAActive', en: 'FBA Active', zh: 'FBA激活费', cat: 'warehouse' },
  { code: 'DeliveryAMZ', en: 'Delivery to Amazon Fee', zh: '亚马逊派送费', cat: 'warehouse' },
  { code: 'DeliveryFee', en: 'Delivery Fee', zh: '私人地址派送费', cat: 'warehouse' },
  { code: 'HandlingOut', en: 'Handling out', zh: '出库费（自提）', cat: 'warehouse' },
  { code: 'DelivWait', en: 'Delivery Waiting Time', zh: '亚马逊送仓等时费', cat: 'warehouse' },
  { code: 'DelivDead', en: 'Delivery Dead Run Fee', zh: '派送空跑费', cat: 'warehouse' },
  { code: 'WHStorage', en: 'Warehouse Storage Fee', zh: '货物仓储费', cat: 'warehouse' },
  { code: 'FCLAllIn', en: 'FCL ALL-IN Service', zh: '整柜一口价服务费', cat: 'warehouse' },
  { code: 'USCAFTLAll', en: 'US to CA FTL ALL-IN', zh: '美转加整柜(车)一口价服务费', cat: 'warehouse' },
  { code: 'WHOther', en: 'Warehouse Other Service', zh: '库内其它服务费', cat: 'warehouse' },
];

const CATEGORIES = [
  { key: 'brokerage', label: '清关服务费 (Brokerage)' },
  { key: 'logistics', label: '物流服务费 (Logistics)' },
  { key: 'warehouse', label: '海外仓服务费 (Warehouse)' },
];

function serviceDisplay(code: string): string {
  const it = ITEMS.find(i => i.code === code);
  if (!it) return code;
  return it.unit ? `${it.en} | ${it.zh} (${it.unit})` : `${it.en} | ${it.zh}`;
}

function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label || key;
}

function formatFee(fee: number, currency: 0 | 1): string {
  const sym = currency === 1 ? 'US$' : 'C$';
  return `${sym} ${(Number(fee) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type QuoteRow = {
  quote_id: number;
  user_id: string;
  user_name: string | null;
  sales_id: number;
  service: string;
  service_details: string;
  note: string | null;
  fee: number;
  currency: 0 | 1;
  address: string | null;
  pod: string | null;
  delivery_city: string | null;
  postcode: string | null;
  effective_date: string | null;
  dock: 0 | 1;
  unit: string | null;
  additional_information: string | null;
};

type EditData = {
  user_id: string;
  user_name: string;
  note: string;
  fee: string;
  currency: 0 | 1;
  address: string;
  pod: string;
  delivery_city: string;
  postcode: string;
  dock: 0 | 1;
  unit: string;
  freeAmount: string;
  additional_information: string;
};

const PAGE_SIZES = [10, 20, 50, 100];

const PENDING_QUOTE_USER_ID = '20260223194133418903';

// ── Component ─────────────────────────────────────────────────────────────────

const QuoteList: React.FC = () => {
  const navigate = useNavigate();
  const { tt } = useTT();

  const authUser: any = (() => {
    try { return JSON.parse(sessionStorage.getItem('authUser') || '{}'); } catch { return {}; }
  })();
  const salesId = Number(authUser?.user_id ?? authUser?.id ?? 0);
  const restriction = Number(authUser?.restriction ?? 0);

  // Customers
  const [customers, setCustomers] = useState<{ user_id: string; user_name: string }[]>([]);

  // Filters
  const [filterUserId, setFilterUserId] = useState('');
  const [filterCurrency, setFilterCurrency] = useState<'' | '0' | '1'>('');
  const [filterCity, setFilterCity] = useState('');
  const [filterPostcode, setFilterPostcode] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Data
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Jump
  const [jumpInput, setJumpInput] = useState('');

  // Template modal
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateText, setTemplateText] = useState('');
  const [templateCopied, setTemplateCopied] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<EditData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  // Province is not persisted on the quote — it only scopes the Delivery
  // City suggestions while editing (same cascade as Create Quote).
  const [editProvince, setEditProvince] = useState<ProvinceOption | null>(null);
  const [editFsaSuggestions, setEditFsaSuggestions] = useState<FsaOption[]>([]);
  const editLastLookupFsaRef = useRef<string>('');

  const loadEditAreaOptions = useMemo(
    () => makeAreaLoader(editProvince?.province_code || ''),
    [editProvince?.province_code]
  );
  const loadEditFsaOptions = useMemo(
    () => makeFsaLoader(editProvince?.province_code || '', (editData?.delivery_city || '').trim()),
    [editProvince?.province_code, editData?.delivery_city]
  );

  const reqSeq = useRef(0);

  // ── Load customers ──

  useEffect(() => {
    fetch(buildApiUrl(GET_CLIENT_USER_LIST), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, pageSize: 999, sortField: 'company_name', sortOrder: 'ASC' }),
    })
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d?.data) ? d.data : [];
        setCustomers(arr.map((x: any) => ({
          user_id: String(x.user_id ?? x.id ?? ''),
          user_name: String(x.company_name || x.user_name || ''),
        })).filter((x: any) => x.user_id));
      })
      .catch(() => {});
  }, []);

  // ── Fetch list ──

  const fetchList = useCallback(async (pg: number, ps: number) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    try {
      const payload: any = {
        sales_id: salesId,
        restriction,
        page: pg,
        pageSize: ps,
        orderBy: 'user_name',
        orderDir: 'ASC',
      };
      if (filterUserId) payload.user_id = filterUserId;
      if (filterCity.trim()) payload.delivery_city = filterCity.trim();
      if (filterPostcode.trim()) payload.postcode = filterPostcode.trim();

      const res = await fetch(buildApiUrl(RETRIEVE_SALES_QUOTE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== reqSeq.current) return;

      const body = data?.data && ('data' in data.data || 'totalRows' in data.data) ? data.data : data;
      let list: QuoteRow[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];

      // Client-side currency filter (matching Vue behaviour)
      if (filterCurrency !== '') {
        list = list.filter(r => Number(r.currency) === Number(filterCurrency));
      }

      setRows(list.map((r: any) => ({
        ...r,
        quote_id: Number(r.quote_id),
        currency: Number(r.currency) === 1 ? 1 : 0,
        dock: Number(r.dock) === 1 ? 1 : 0,
      })));
      setTotal(Number(body?.totalRows ?? list.length));
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setError(e?.message || 'Failed to load quotes');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [salesId, restriction, filterUserId, filterCurrency, filterCity, filterPostcode]);

  useEffect(() => { fetchList(1, pageSize); }, []);

  const handleSearch = () => { setPage(1); fetchList(1, pageSize); };
  const handleReset = () => {
    setFilterUserId(''); setFilterCurrency(''); setFilterCity(''); setFilterPostcode('');
    setPage(1); fetchList(1, pageSize);
  };

  const changePage = (p: number) => { setPage(p); fetchList(p, pageSize); };
  const changePageSize = (ps: number) => { setPageSize(ps); setPage(1); fetchList(1, ps); };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);
  const handleJump = () => {
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) changePage(p);
    setJumpInput('');
  };

  // ── Inline edit ──

  const startEdit = (row: QuoteRow) => {
    setSaveErr('');
    setEditingId(row.quote_id);
    setEditData({
      user_id: row.user_id ?? '',
      user_name: row.user_name ?? '',
      note: row.note ?? '',
      fee: String(row.fee ?? ''),
      currency: row.currency,
      address: row.address ?? '',
      pod: row.pod ?? '',
      delivery_city: row.delivery_city ?? '',
      postcode: row.postcode ?? '',
      dock: row.dock,
      unit: row.unit ?? '',
      freeAmount: getFreeAmountFromAdditionalInfo(row.additional_information),
      additional_information: row.additional_information ?? '',
    });

    setEditProvince(null);
    setEditFsaSuggestions([]);
    editLastLookupFsaRef.current = '';

    // Pre-detect the province from the existing postcode so Delivery City
    // suggestions work immediately without the user re-typing the postcode.
    const fsa = String(row.postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (fsa.length === 3) {
      editLastLookupFsaRef.current = fsa;
      postalCodeOptions({ postal_code: fsa }).then(rows => {
        if (!Array.isArray(rows) || !rows.length) return;
        const best = rows.find((r: any) => Number(r.is_primary) === 1) || rows[0];
        if (best?.province_code) {
          setEditProvince({
            value: best.province_code,
            label: best.province_name,
            province_code: best.province_code,
            province_name: best.province_name,
          });
        }
      });
    }
  };

  const cancelEdit = () => {
    setEditingId(null); setEditData(null); setSaveErr('');
    setEditProvince(null); setEditFsaSuggestions([]); editLastLookupFsaRef.current = '';
  };

  const setField = <K extends keyof EditData>(k: K, v: EditData[K]) => {
    setEditData(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const onEditProvinceChange = (opt: ProvinceOption | null) => {
    setEditProvince(opt);
    setEditFsaSuggestions([]);
  };

  const onEditAreaChange = (opt: AreaOption | null) => {
    const city = opt ? formatDeliveryCity(opt.area_name) : '';
    setField('delivery_city', city);
    setEditFsaSuggestions([]);
    if (!city) return;
    // Use the just-picked city directly instead of the memoized loader,
    // which still reflects the pre-update delivery_city during this event.
    makeFsaLoader(editProvince?.province_code || '', city)('').then(setEditFsaSuggestions);
  };

  const applyEditFsaSuggestion = (fsaOpt: FsaOption) => {
    setEditData(prev => {
      if (!prev) return prev;
      const rest = prev.postcode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(3);
      return { ...prev, postcode: formatCanadianPostcode(`${fsaOpt.fsa}${rest}`) };
    });
  };

  const onEditPostcodeChange = (v: string) => {
    const formatted = formatCanadianPostcode(v);
    setField('postcode', formatted);
    loadEditFsaOptions(v).then(setEditFsaSuggestions);

    const fsa = formatted.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (fsa.length < 3) { editLastLookupFsaRef.current = ''; return; }
    if (fsa === editLastLookupFsaRef.current) return;
    editLastLookupFsaRef.current = fsa;

    postalCodeOptions({ postal_code: fsa }).then(rows => {
      if (!Array.isArray(rows) || !rows.length) return;
      const best = rows.find((r: any) => Number(r.is_primary) === 1) || rows[0];
      const city = best?.city || best?.area_name;
      if (city) setField('delivery_city', formatDeliveryCity(city));
      if (best?.province_code) {
        setEditProvince({
          value: best.province_code,
          label: best.province_name,
          province_code: best.province_code,
          province_name: best.province_name,
        });
      }
    });
  };

  const onEditUnitChange = (unit: string) => {
    setEditData(prev => prev ? { ...prev, unit, freeAmount: '', additional_information: '' } : prev);
  };

  const onEditFreeAmountChange = (fa: string) => {
    setEditData(prev => {
      if (!prev) return prev;
      return { ...prev, freeAmount: fa, additional_information: buildAdditionalInformation(prev.unit, fa) };
    });
  };

  const saveEdit = async () => {
    if (editingId == null || !editData) return;
    setSaveErr('');

    const deliveryCity = formatDeliveryCity(editData.delivery_city);
    const postcode = formatCanadianPostcode(editData.postcode);

    if (postcode && !isValidCanadianPostcode(postcode)) {
      setSaveErr(tt('quote.errInvalidPostcode')); return;
    }
    if (editData.fee === '' || isNaN(Number(editData.fee))) {
      setSaveErr(tt('quote.errFeeRequired')); return;
    }

    setSaving(true);
    try {
      const res = await fetch(buildApiUrl(UPDATE_SALES_QUOTE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_id: editingId,
          user_id: editData.user_id || null,
          user_name: editData.user_name || null,
          sales_id: salesId,
          note: editData.note.trim() || null,
          fee: Number(editData.fee),
          currency: editData.currency,
          address: editData.address.trim() || null,
          pod: editData.pod.trim() || null,
          delivery_city: deliveryCity || null,
          postcode: postcode || null,
          dock: editData.dock,
          unit: editData.unit.trim() || null,
          additional_information: editData.additional_information.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveErr(data?.message || `HTTP ${res.status}`); return; }
      setEditingId(null);
      setEditData(null);
      fetchList(page, pageSize);
    } catch (e: any) {
      setSaveErr(e?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Totals ──

  const totalCAD = rows.filter(r => r.currency === 0).reduce((s, r) => s + (Number(r.fee) || 0), 0);
  const totalUSD = rows.filter(r => r.currency === 1).reduce((s, r) => s + (Number(r.fee) || 0), 0);

  const fmtTotal = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── PDF ──

  const generatePdf = () => {
    if (!rows.length) return;
    const rowsHtml = rows.map((row, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(row.user_name || '-')}</td>
        <td>${escapeHtml(categoryLabel(row.service))}</td>
        <td>${escapeHtml(serviceDisplay(row.service_details))}</td>
        <td>${escapeHtml(row.note || '-')}</td>
        <td class="right"><strong>${row.currency === 1 ? 'US$' : 'C$'} ${Number(row.fee || 0).toFixed(2)}</strong>${row.unit ? `<div class="sub">${row.unit}</div>` : ''}${row.additional_information ? `<div class="sub">${escapeHtml(row.additional_information)}</div>` : ''}</td>
        <td>${escapeHtml(row.address || '-')}</td>
        <td>${escapeHtml(row.pod || '-')}</td>
        <td>${escapeHtml(row.delivery_city || '-')}</td>
        <td>${escapeHtml(row.postcode || '-')}</td>
        <td>${row.dock === 1 ? tt('quote.dockYes') : tt('quote.dockNo')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>${tt('quote.pdfTitle')}</title><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#111}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #111;padding-bottom:12px}
      h1{margin:0;font-size:24px}.meta{font-size:13px;line-height:1.6}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
      th,td{border:1px solid #333;padding:8px;vertical-align:top}
      th{background:#f1f1f1;font-weight:700}.right{text-align:right}
      .sub{margin-top:4px;font-size:11px;font-weight:600;color:#333}
      .footer{margin-top:28px;font-size:12px;color:#555}
      @media print{button{display:none}}
    </style></head><body>
      <div class="header">
        <h1>${tt('quote.pdfTitle')}</h1>
        <div class="meta">${tt('quote.pdfDate')}: ${new Date().toLocaleDateString()}</div>
      </div>
      <table><thead><tr>
        <th>#</th>
        <th>${tt('quote.colCustomer')}</th>
        <th>${tt('quote.pdfColCategory')}</th>
        <th>${tt('quote.pdfColService')}</th>
        <th>${tt('quote.pdfColNote')}</th>
        <th>${tt('quote.pdfColFee')}</th>
        <th>${tt('quote.pdfColAddress')}</th>
        <th>${tt('quote.pdfColPod')}</th>
        <th>${tt('quote.pdfColCity')}</th>
        <th>${tt('quote.pdfColPostcode')}</th>
        <th>${tt('quote.pdfColDock')}</th>
      </tr></thead>
        <tbody>${rowsHtml}</tbody></table>
      <div class="footer">${tt('quote.pdfFooter')}</div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { setError(tt('quote.errNoPdfPopup')); return; }
    win.document.open(); win.document.write(html); win.document.close();
  };

  // ── Email template ──

  const generateEmailTemplate = () => {
    if (!rows.length) return;

    const logisticsRow = rows.find(r => r.service === 'logistics');
    const pod = logisticsRow?.pod?.trim() || '';

    const drayageRow = rows.find(r => r.service_details === 'DrayageFee');
    const headerCur = drayageRow ? (drayageRow.currency === 1 ? 'USD' : 'CAD') : 'CAD';
    const drayageFeeStr = drayageRow && Number(drayageRow.fee)
      ? `${drayageRow.currency === 1 ? 'USD' : 'CAD'}${Number(drayageRow.fee).toFixed(0)}`
      : `${headerCur}--------------------------`;

    const formatRowText = (row: QuoteRow): string | null => {
      const cur = row.currency === 1 ? 'US$' : 'C$';
      const fee = Number(row.fee);
      const fa = getFreeAmountFromAdditionalInfo(row.additional_information);
      switch (row.service_details) {
        case 'DrayageFee': return null;
        case 'BrokerageFee':       return `清关费：${cur}${fee}/票`;
        case 'DutyGSTAdmin':       return `税金代付费：${cur}${fee}/笔`;
        case 'DutyGSTAdvance':     return `关税代缴：${cur}${fee}/笔`;
        case 'PrePull':            return `pre-pul:${cur}${fee}/次`;
        case 'StorageFee':         return `Yard storage:${cur}${fee}/天${fa ? ` ${fa}天免费）` : ''}`;
        case 'ChassisRental':      return `chassis：${cur}${fee}/天${fa ? `（${fa}天免费）` : ''}`;
        case 'LiveUnloadWaiting':  return `Live-unload waiting time：${cur}${fee}/hour${fa ? `（${fa} hours free）` : ''}`;
        case 'TerminalWaiting':    return `Terminal waiting time：${cur}${fee}/hour${fa ? `（${fa} hours free）` : ''}`;
        case 'DGSurcharge':        return `DG surcharge：${cur}${fee}`;
        case 'DGLabelRemove':      return `DG label remove：${cur}${fee}`;
        case 'ExtraStopSOC':       return `Extra Stop/SOC：${row.additional_information || '单独询价'}`;
        case 'DropOff':            return `Drop off：${row.additional_information || '单独询价'}`;
        case 'OtherLocalTrucking': return '需收货地自行卸货';
        default: {
          const item = ITEMS.find(x => x.code === row.service_details);
          const label = item ? item.en : row.service_details;
          const feeStr = fee ? `${cur}${fee}${row.unit ? row.unit : ''}` : (row.additional_information || '');
          return `${label}：${feeStr}`;
        }
      }
    };

    const extraLines = rows
      .filter(r => r.service_details !== 'DrayageFee')
      .map(formatRowText)
      .filter((s): s is string => s !== null);

    const text = [
      `From ${pod}`,
      `To：`,
      `提柜及派送费：${drayageFeeStr}`,
      '-'.repeat(28),
      '下面情况如额外发生的费用：',
      ...extraLines,
    ].join('\n');

    setTemplateText(text);
    setTemplateCopied(false);
    setTemplateOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('quote.listTitle')} pageTitle={tt('quote.pageTitle')} />

        <div className="sl-page-actions mb-3 justify-content-end">
          {rows.length > 0 && (
            <>
              <Button color="secondary" outline onClick={generateEmailTemplate}>
                Copy
              </Button>
              <Button color="secondary" outline onClick={generatePdf}>
                {tt('quote.generatePdf')}
              </Button>
            </>
          )}
          <Button color="primary" onClick={() => navigate('/quote/create')}>
            {tt('quote.newQuote')}
          </Button>
        </div>

        {/* Filters — matches Customer Order pages' sl-filter-bar */}
        <Card className="mb-3 sl-sticky-filter-card">
          <CardBody>
            <div className="sl-filter-bar">
              <FI>
                <CS
                  value={filterUserId}
                  onChange={setFilterUserId}
                  placeholder={tt('quote.allCustomers')}
                  className="sl-w-220"
                >
                  {customers.map(c => <option key={c.user_id} value={c.user_id}>{c.user_name}</option>)}
                </CS>
              </FI>

              <FI>
                <CS
                  value={filterCurrency}
                  onChange={(v) => setFilterCurrency(v as '' | '0' | '1')}
                  placeholder="All"
                  className="sl-w-200"
                >
                  <option value="0">CAD</option>
                  <option value="1">USD</option>
                </CS>
              </FI>

              <FI>
                <CI
                  value={filterCity}
                  onChange={setFilterCity}
                  onBlur={() => setFilterCity(formatDeliveryCity(filterCity))}
                  onEnter={handleSearch}
                  placeholder="Search city"
                  className="sl-w-200"
                />
              </FI>

              <FI>
                <CI
                  value={filterPostcode}
                  onChange={(v) => setFilterPostcode(formatCanadianPostcode(v))}
                  onEnter={handleSearch}
                  placeholder="Search postcode"
                  className="sl-w-200"
                />
              </FI>

              <FI>
                <Button color="primary" onClick={handleSearch} disabled={loading}>
                  {loading ? <Spinner size="sm" className="me-1" /> : null}{tt('quote.search')}
                </Button>
              </FI>

              <FI>
                <Button color="secondary" outline onClick={handleReset} disabled={loading}>
                  {tt('quote.reset')}
                </Button>
              </FI>

              <FI>
                <span className="text-muted small">Total: {total}</span>
              </FI>
            </div>
          </CardBody>
        </Card>

        {error && <Alert color="danger" toggle={() => setError('')}>{error}</Alert>}
        {saveErr && <Alert color="danger" toggle={() => setSaveErr('')}>{saveErr}</Alert>}

        {/* Table */}
        <Card className="sl-table-card">
          <CardBody className="p-0">
            <div className="sl-table-scroll">
              <Table className="mb-0 sl-table">
                <thead>
                  <tr>
                    <th className="sl-w-180">{tt('quote.colCustomer')}</th>
                    <th className="sl-w-220">{tt('quote.colCategory')}</th>
                    <th className="sl-w-320">{tt('quote.colService')}</th>
                    <th className="sl-w-240">{tt('quote.note')}</th>
                    <th className="sl-w-250 text-end">{tt('quote.fee')}</th>
                    <th className="sl-w-90">{tt('quote.currency')}</th>
                    <th className="sl-w-180">{tt('quote.address')}</th>
                    <th className="sl-w-150">{tt('quote.pod')}</th>
                    <th className="sl-w-260">{tt('quote.deliveryCity')}</th>
                    <th className="sl-w-170">{tt('quote.postcode')}</th>
                    <th className="sl-w-120 text-center">{tt('quote.colEffectiveDate')}</th>
                    <th className="sl-w-90 text-center">{tt('quote.dock')}</th>
                    <th className="sl-w-130 text-center sl-col-sticky-right">{tt('quote.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={13} className="text-center py-4"><Spinner color="primary" /></td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={13} className="text-center text-muted py-4">{tt('quote.noQuotes')}</td></tr>
                  )}
                  {!loading && rows.map(row => {
                    const isEditing = editingId === row.quote_id;
                    const ed = isEditing ? editData : null;
                    return (
                      <tr key={row.quote_id} className={isEditing ? 'table-warning sl-row-editing' : ''}>
                        {/* Customer */}
                        <td className="fw-medium">
                          {isEditing && ed && row.user_id === PENDING_QUOTE_USER_ID ? (
                            <Select
                              options={customers.map(c => ({ value: c.user_id, label: c.user_name }))}
                              value={customers.map(c => ({ value: c.user_id, label: c.user_name })).find(o => o.value === ed.user_id) ?? null}
                              onChange={(opt: any) => {
                                setField('user_id', opt ? opt.value : '');
                                setField('user_name', opt ? opt.label : '');
                              }}
                              placeholder={tt('quote.selectCustomer')}
                              isClearable
                              isSearchable
                              classNamePrefix="rs"
                            />
                          ) : (
                            row.user_id === PENDING_QUOTE_USER_ID
                              ? <span className="text-muted fst-italic">Pending</span>
                              : (row.user_name || row.user_id || '-')
                          )}
                        </td>

                        {/* Category */}
                        <td>
                          <Badge color="light" className="text-dark border small fw-normal">
                            {categoryLabel(row.service)}
                          </Badge>
                        </td>

                        {/* Service */}
                        <td>{serviceDisplay(row.service_details)}</td>

                        {/* Note */}
                        <td>
                          {isEditing && ed ? (
                            <Input bsSize="sm" value={ed.note} onChange={e => setField('note', e.target.value)} maxLength={50} />
                          ) : (
                            <span className="text-muted">{row.note || '-'}</span>
                          )}
                        </td>

                        {/* Fee */}
                        <td className="text-end">
                          {isEditing && ed ? (
                            <div className="text-start">
                              <Input bsSize="sm" type="number" value={ed.fee}
                                onChange={e => setField('fee', e.target.value)}
                                className="sl-w-120 mb-1" />
                              <Input type="select" bsSize="sm" value={ed.unit}
                                onChange={e => onEditUnitChange(e.target.value)}
                                className="sl-w-120 mb-1">
                                <option value="">{tt('quote.unit')}</option>
                                <option value="/Trip">/Trip</option>
                                <option value="/Day">/Day</option>
                                <option value="/Hour">/Hour</option>
                              </Input>
                              {(ed.unit === '/Day' || ed.unit === '/Hour') ? (
                                <Input type="select" bsSize="sm" value={ed.freeAmount}
                                  onChange={e => onEditFreeAmountChange(e.target.value)}
                                  className="sl-w-120">
                                  <option value="">{tt('quote.freeAmt')}</option>
                                  {['1', '2', '3', '4', '5'].map(v => <option key={v} value={v}>{v}</option>)}
                                </Input>
                              ) : (
                                <Input bsSize="sm" value={ed.additional_information}
                                  onChange={e => setField('additional_information', e.target.value)}
                                  placeholder={tt('quote.additionalInfo')} maxLength={100}
                                  className="sl-w-120" />
                              )}
                            </div>
                          ) : (
                            <div>
                              <strong>{formatFee(row.fee, row.currency)}</strong>
                              {row.unit && <div className="text-muted sl-text-tag-sm">{row.unit}</div>}
                              {row.additional_information && <div className="text-muted sl-text-tag-sm">{row.additional_information}</div>}
                            </div>
                          )}
                        </td>

                        {/* Currency */}
                        <td>
                          {isEditing && ed ? (
                            <Input type="select" bsSize="sm" value={String(ed.currency)}
                              onChange={e => setField('currency', Number(e.target.value) as 0 | 1)}
                              className="sl-w-80">
                              <option value="0">CAD</option>
                              <option value="1">USD</option>
                            </Input>
                          ) : (
                            <Badge color="light" className="text-dark border small fw-normal">
                              {row.currency === 1 ? 'USD' : 'CAD'}
                            </Badge>
                          )}
                        </td>

                        {/* Address */}
                        <td>
                          {isEditing && ed ? (
                            <Input bsSize="sm" value={ed.address}
                              onChange={e => setField('address', e.target.value)}
                              placeholder={tt('quote.addressOptional')} />
                          ) : (
                            row.address || '-'
                          )}
                        </td>

                        {/* POD */}
                        <td>
                          {isEditing && ed ? (
                            <Input bsSize="sm" value={ed.pod}
                              disabled={row.service !== 'logistics'}
                              onChange={e => setField('pod', e.target.value)}
                              placeholder={tt('quote.pod')} />
                          ) : (
                            row.pod || '-'
                          )}
                        </td>

                        {/* Delivery City */}
                        <td>
                          {isEditing && ed ? (
                            <div className="d-flex flex-column gap-1">
                              <AsyncSelect
                                value={editProvince}
                                onChange={(opt: any) => onEditProvinceChange(opt)}
                                loadOptions={loadProvinceOptions}
                                defaultOptions
                                isClearable isSearchable
                                placeholder={tt('quote.selectProvince')}
                                className="rs-sm"
                                classNamePrefix="rs"
                              />
                              <AsyncCreatableSelect
                                key={editProvince?.province_code || 'no-province'}
                                value={ed.delivery_city ? { value: ed.delivery_city, label: ed.delivery_city, area_name: ed.delivery_city } : null}
                                onChange={(opt: any) => onEditAreaChange(opt)}
                                loadOptions={loadEditAreaOptions}
                                defaultOptions
                                createOptionPosition="first"
                                getNewOptionData={(inputValue: string, optionLabel: any) => ({
                                  value: inputValue, label: optionLabel, area_name: inputValue,
                                })}
                                formatCreateLabel={(v: string) => `${tt('quote.useTyped')} "${v}"`}
                                isClearable isSearchable
                                isDisabled={!editProvince}
                                placeholder={editProvince ? tt('quote.deliveryCityPlaceholder') : tt('quote.selectProvinceFirstHint')}
                                className="rs-sm"
                                classNamePrefix="rs"
                              />
                            </div>
                          ) : (
                            row.delivery_city || '-'
                          )}
                        </td>

                        {/* Postcode */}
                        <td>
                          {isEditing && ed ? (
                            <div>
                              <Input bsSize="sm" value={ed.postcode}
                                onChange={e => onEditPostcodeChange(e.target.value)}
                                placeholder={tt('quote.postcodePlaceholderExample')} />
                              {editFsaSuggestions.length > 0 && (
                                <div className="mt-1">
                                  <div className="text-muted mb-1 sl-text-2xs">
                                    {tt('quote.fsaSuggestionsLabel')}
                                  </div>
                                  <div className="d-flex flex-wrap gap-1">
                                    {editFsaSuggestions.slice(0, MAX_FSA_SUGGESTIONS).map(o => (
                                      <Button
                                        key={o.value}
                                        type="button"
                                        size="sm"
                                        color="light"
                                        className="border py-0 px-1 sl-text-2xs"
                                        onClick={() => applyEditFsaSuggestion(o)}
                                      >
                                        {o.label}
                                      </Button>
                                    ))}
                                  </div>
                                  {editFsaSuggestions.length > MAX_FSA_SUGGESTIONS && (
                                    <div className="text-muted mt-1 sl-text-2xs">
                                      {tt('quote.fsaSuggestionsMore', { count: editFsaSuggestions.length - MAX_FSA_SUGGESTIONS })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            row.postcode || '-'
                          )}
                        </td>

                        {/* Effective Date (read-only) */}
                        <td className="text-center">{formatDateOnly(row.effective_date)}</td>

                        {/* Dock */}
                        <td className="text-center">
                          {isEditing && ed ? (
                            <Input type="select" bsSize="sm" value={String(ed.dock)}
                              onChange={e => setField('dock', Number(e.target.value) as 0 | 1)}
                              className="sl-w-80">
                              <option value="0">{tt('quote.dockNo')}</option>
                              <option value="1">{tt('quote.dockYes')}</option>
                            </Input>
                          ) : (
                            <Badge color={row.dock === 1 ? 'success' : 'secondary'}>
                              {row.dock === 1 ? tt('quote.dockYes') : tt('quote.dockNo')}
                            </Badge>
                          )}
                        </td>

                        {/* Action */}
                        <td className="text-center sl-col-sticky-right">
                          {isEditing ? (
                            <div className="d-flex gap-1 justify-content-center">
                              <Button size="sm" color="success" onClick={saveEdit} disabled={saving}>
                                {saving ? <Spinner size="sm" /> : tt('quote.save')}
                              </Button>
                              <Button size="sm" color="secondary" outline onClick={cancelEdit} disabled={saving}>
                                {tt('quote.cancel')}
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" color="primary" outline onClick={() => startEdit(row)}>
                              {tt('quote.edit')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="table-light fw-bold">
                    <tr>
                      <td colSpan={4} className="text-end">{tt('quote.totalsLabel')}</td>
                      <td className="text-end">
                        <div>C$ {fmtTotal(totalCAD)}</div>
                        <div>US$ {fmtTotal(totalUSD)}</div>
                      </td>
                      <td colSpan={8} />
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </CardBody>
        </Card>

        {/* Pagination */}
        <div className="sl-pagination">
          <span className="sl-pg-total">
            {tt('serviceList.pagination.total')} {total} {tt('serviceList.pagination.items')}
          </span>

          <Input
            type="select"
            bsSize="sm"
            className="sl-page-size-select"
            value={pageSize}
            onChange={e => changePageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map(n => (
              <option key={n} value={n}>{n} {tt('serviceList.pagination.perPage')}</option>
            ))}
          </Input>

          <button className="sl-pg-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} title="Previous">
            ‹
          </button>

          {pageItems.map((p, i) =>
            p === '...'
              ? <span key={`e${i}`} className="sl-pg-ellipsis">…</span>
              : <button key={p} className={`sl-pg-btn${page === p ? ' active' : ''}`} onClick={() => changePage(p as number)}>{p}</button>
          )}

          <button className="sl-pg-btn" disabled={page >= totalPages} onClick={() => changePage(page + 1)} title="Next">
            ›
          </button>

          <span className="sl-pg-jumper">
            {tt('serviceList.pagination.goto')}
            <input
              type="number"
              className="sl-jump-input"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJump()}
            />
          </span>
        </div>
      </Container>
    </div>

    {/* Template Modal */}
    <Modal isOpen={templateOpen} toggle={() => setTemplateOpen(false)} size="lg" centered>
      <ModalHeader toggle={() => setTemplateOpen(false)}>Copy</ModalHeader>
      <ModalBody>
        <Input
          type="textarea"
          rows={14}
          value={templateText}
          onChange={e => setTemplateText(e.target.value)}
          className="sl-template-textarea"
        />
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" outline onClick={() => setTemplateOpen(false)}>
          {tt('changeService.actions.close')}
        </Button>
        <Button
          color={templateCopied ? 'success' : 'primary'}
          onClick={() => {
            navigator.clipboard.writeText(templateText).then(() => {
              setTemplateCopied(true);
              setTimeout(() => setTemplateCopied(false), 2000);
            });
          }}
        >
          {templateCopied ? '✓ Copied!' : 'Copy'}
        </Button>
      </ModalFooter>
    </Modal>
    </>
  );
};

export default QuoteList;
