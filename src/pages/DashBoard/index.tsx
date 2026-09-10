import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Col, Row, Card, CardBody, Badge, Button, Spinner } from 'reactstrap';
import { buildApiUrl } from '../../helpers/apiBase';
import {
  GET_TICKET_SUMMARY,
  GET_NON_CLOSED_TICKET_SUMMARY,
  GET_CITY_TICKET,
  GET_DAILY_PIN,
  EXPORT_ADDITIONAL_FEE_DATA,
  EXPORT_INVOICE_FEE_DATA,
} from '../../helpers/url_helper';
import { toast } from 'react-toastify';
import { useTT } from '../../helpers/useTT';
import TicketSummaryBarChart from './TicketSummaryCharts';
import CityTicketBarChart from './CityTicketBarChart';

// ─── PIN access list ─────────────────────────────────────────────────────────

const PIN_ALLOWED = new Set([
  'ethan wang', 'ning ma', 'dong liu', 'nana zhang', 'tina yang',
]);

const normName = (s: string) =>
  s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

// ─── Auth helper ──────────────────────────────────────────────────────────────

const getAuthUser = () => {
  try { return JSON.parse(sessionStorage.getItem('authUser') || '{}'); } catch { return {}; }
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { tt } = useTT();
  const authUser = useMemo(getAuthUser, []);
  const isAuthorizedForPin = PIN_ALLOWED.has(normName(String(authUser?.account_name ?? '')));

  // ── Summary chart state
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryX, setSummaryX] = useState<string[]>([]);
  const [summaryY, setSummaryY] = useState<number[]>([]);

  // ── Non-closed chart state
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [pendingX, setPendingX] = useState<string[]>([]);
  const [pendingY, setPendingY] = useState<number[]>([]);

  // ── City chart state
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState('');
  const [cityX, setCityX] = useState<string[]>([]);
  const [cityY, setCityY] = useState<Record<string, number[]>>({});

  // ── Export state
  const [exportAdditionalLoading, setExportAdditionalLoading] = useState(false);
  const [exportInvoiceLoading, setExportInvoiceLoading] = useState(false);

  const currencyLabel = (v: any) => {
    const s = String(v ?? '').trim();
    return s === '1' ? 'USD' : s === '2' ? 'CAD' : s;
  };

  const makeCsvDownload = (rows: any[][], filename: string) => {
    // Find columns with "currency" in the header (row 0) and convert 1→USD, 2→CAD
    const header = rows[0] || [];
    const currencyCols = new Set<number>(
      header.map((h: any, i: number) => String(h).toLowerCase().includes('currency') ? i : -1).filter((i: number) => i >= 0)
    );

    const converted = rows.map((row, rowIdx) =>
      rowIdx === 0 ? row : row.map((cell: any, colIdx: number) => currencyCols.has(colIdx) ? currencyLabel(cell) : cell)
    );

    const csv = converted.map(row =>
      row.map((cell: any) => {
        const v = cell === null || cell === undefined ? '' : String(cell);
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    ).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAdditionalFee = useCallback(async () => {
    setExportAdditionalLoading(true);
    try {
      const res = await fetch(buildApiUrl(EXPORT_ADDITIONAL_FEE_DATA), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      const rows: any[][] = data?.excel_rows;
      if (!Array.isArray(rows) || rows.length === 0) { toast.warning(tt('work.exportNoData')); return; }
      makeCsvDownload(rows, `additional_fee_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(tt('work.exportSuccess').replace('{n}', String(rows.length - 1)));
    } catch {
      toast.error(tt('work.exportFailed'));
    } finally {
      setExportAdditionalLoading(false);
    }
  }, [tt]); // eslint-disable-line

  const handleExportInvoiceFee = useCallback(async () => {
    setExportInvoiceLoading(true);
    try {
      const res = await fetch(buildApiUrl(EXPORT_INVOICE_FEE_DATA), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      const rows: any[][] = data?.excel_rows;
      if (!Array.isArray(rows) || rows.length === 0) { toast.warning(tt('work.exportNoData')); return; }
      makeCsvDownload(rows, `invoice_fee_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(tt('work.exportSuccess').replace('{n}', String(rows.length - 1)));
    } catch {
      toast.error(tt('work.exportFailed'));
    } finally {
      setExportInvoiceLoading(false);
    }
  }, [tt]); // eslint-disable-line

  // ── PIN state
  const [pinLoading, setPinLoading] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await fetch(buildApiUrl(GET_TICKET_SUMMARY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      setSummaryX(Array.isArray(data?.data?.x) ? data.data.x.map(String) : []);
      setSummaryY(Array.isArray(data?.data?.y) ? data.data.y.map(Number) : []);
    } catch (e: any) {
      setSummaryError(e?.message || 'Failed to load');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    setPendingError('');
    try {
      const res = await fetch(buildApiUrl(GET_NON_CLOSED_TICKET_SUMMARY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      setPendingX(Array.isArray(data?.data?.x) ? data.data.x.map(String) : []);
      setPendingY(Array.isArray(data?.data?.y) ? data.data.y.map(Number) : []);
    } catch (e: any) {
      setPendingError(e?.message || 'Failed to load');
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const fetchCity = useCallback(async () => {
    setCityLoading(true);
    setCityError('');
    try {
      const res = await fetch(buildApiUrl(GET_CITY_TICKET), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      setCityX(Array.isArray(data?.data?.x) ? data.data.x.map(String) : []);
      setCityY(data?.data?.y && typeof data.data.y === 'object' ? data.data.y : {});
    } catch (e: any) {
      setCityError(e?.message || 'Failed to load');
    } finally {
      setCityLoading(false);
    }
  }, []);

  const fetchDailyPin = useCallback(async () => {
    if (!isAuthorizedForPin) return;
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch(buildApiUrl(GET_DAILY_PIN), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      if (!data?.ok || !data?.pin) throw new Error(data?.message || 'Failed to get PIN');
      setPin(String(data.pin));
    } catch (e: any) {
      setPinError(e?.message || 'Failed to fetch PIN');
      setPin(null);
    } finally {
      setPinLoading(false);
    }
  }, [isAuthorizedForPin]);

  const copyPin = useCallback(async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      toast.success(tt('work.copied'));
    } catch {
      toast.error(tt('work.copyFailed'));
    }
  }, [pin, tt]);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSummary();
    fetchPending();
    // Defer city chart so the two main charts load first
    const id = window.setTimeout(fetchCity, 800);
    return () => { window.clearTimeout(id); abortRef.current?.abort(); };
  }, [fetchSummary, fetchPending, fetchCity]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* ─── PIN card (sticky, only for authorised users) ─── */}
      {isAuthorizedForPin && (
        <Card className="mb-3 dashboard-pin-card">
          <CardBody className="py-2">
            <div className="dashboard-pin-grid">
              <span className="fw-semibold dashboard-pin-label">{tt('work.pin')}</span>

              <div className="d-flex align-items-center justify-content-center gap-2">
                {!pin ? (
                  <Button color="primary" disabled={pinLoading} onClick={fetchDailyPin}>
                    {pinLoading ? <Spinner size="sm" className="me-1" /> : null}
                    {pinLoading ? tt('work.loading') : tt('work.showPin')}
                  </Button>
                ) : (
                  <>
                    <Badge color="success" className="dashboard-pin-badge">
                      PIN: {pin}
                    </Badge>
                    <Button color="link" size="sm" onClick={copyPin}>{tt('work.copy')}</Button>
                    <Button color="link" size="sm" onClick={() => setPin(null)}>{tt('work.hide')}</Button>
                  </>
                )}
                {pinError && <small className="text-danger ms-2">{pinError}</small>}
              </div>

              <div /> {/* spacer keeps center section centred */}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ─── Export row ─── */}
      <div className="d-flex justify-content-end gap-2 mb-3">
        <Button color="primary" disabled={exportAdditionalLoading} onClick={handleExportAdditionalFee}>
          {exportAdditionalLoading ? <Spinner size="sm" className="me-1" /> : null}
          {exportAdditionalLoading ? tt('work.exporting') : tt('work.exportAdditionalFee')}
        </Button>
        <Button color="primary" disabled={exportInvoiceLoading} onClick={handleExportInvoiceFee}>
          {exportInvoiceLoading ? <Spinner size="sm" className="me-1" /> : null}
          {exportInvoiceLoading ? tt('work.exporting') : tt('work.exportInvoiceFee')}
        </Button>
      </div>

      {/* ─── Charts row ─── */}
      <Row className="g-3">
        <Col xs={12} md={4}>
          <TicketSummaryBarChart
            title={tt('work.totalOrders')}
            loading={summaryLoading}
            error={summaryError}
            x={summaryX}
            y={summaryY}
            onRefresh={fetchSummary}
          />
        </Col>

        <Col xs={12} md={4}>
          <TicketSummaryBarChart
            title={tt('work.pendingOrders')}
            loading={pendingLoading}
            error={pendingError}
            x={pendingX}
            y={pendingY}
            onRefresh={fetchPending}
          />
        </Col>

        <Col xs={12} md={4}>
          <CityTicketBarChart
            loading={cityLoading}
            error={cityError}
            x={cityX}
            y={cityY}
            onRefresh={fetchCity}
          />
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
