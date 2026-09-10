import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, CardBody, CardHeader, Badge, Button, Input, Spinner, Alert } from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { CI, FI } from '../CustomerOrder/_ServiceListPage';
import { buildApiUrl } from '../../helpers/apiBase';
import { useTT } from '../../helpers/useTT';
import { RETRIEVE_FINANCE_FEE_ALERTS } from '../../helpers/url_helper';

const fmtDate = (v: unknown) => {
  if (!v) return '-';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const fmtPercent = (v: unknown) => {
  if (v === undefined || v === null || v === '') return '-';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '-';
};

const splitContainers = (v: unknown) =>
  String(v || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);

const SectionEmpty = ({ text }: { text: string }) => (
  <div className="text-muted small p-2 border border-dashed rounded">{text}</div>
);

const RowCard = ({ onClick, negative, children }: { onClick?: () => void; negative?: boolean; children: React.ReactNode }) => (
  <div
    onClick={onClick}
    className={`border rounded p-3 mb-2 bg-white notif-row-card${onClick ? ' notif-row-card--clickable' : ''}${negative ? ' notif-row-card--negative border-danger' : ''}`}
  >
    {children}
  </div>
);

const TagList = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="d-flex flex-wrap gap-1 mt-2">
      {items.map((c, i) => <span key={i} className="badge bg-light text-dark border">{c}</span>)}
    </div>
  ) : null;

const CountBadge = ({ count }: { count: number }) =>
  count > 0
    ? <Badge color="danger" className="ms-2">{count}</Badge>
    : <Badge color="success" pill className="ms-2">OK</Badge>;

const FinanceNotification = () => {
  const navigate = useNavigate();
  const { tt } = useTT();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [idFilter, setIdFilter] = useState('');
  const [containerFilter, setContainerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [missingFees, setMissingFees] = useState<any[]>([]);
  const [halfFees, setHalfFees] = useState<any[]>([]);
  const [negativeProfits, setNegativeProfits] = useState<any[]>([]);
  const [portNoTrain, setPortNoTrain] = useState<any[]>([]);

  const reqSeq = useRef(0);

  const fetchAll = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    try {
      const body: any = { page: 1, pageSize: 200 };
      if (idFilter.trim()) body.id = idFilter.trim();
      if (containerFilter.trim()) body.container_number = containerFilter.trim().toUpperCase();
      if (dateFilter.trim()) body.create_time = dateFilter.trim();

      const res = await fetch(buildApiUrl(RETRIEVE_FINANCE_FEE_ALERTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== reqSeq.current) return;

      const a = data?.alerts || {};
      setMissingFees(Array.isArray(a.missing_container_fee_after_7_days) ? a.missing_container_fee_after_7_days : []);
      setHalfFees(Array.isArray(a.half_filled_fee_after_14_days) ? a.half_filled_fee_after_14_days : []);
      setNegativeProfits(Array.isArray(a.negative_profit_rate) ? a.negative_profit_rate : []);
      setPortNoTrain(Array.isArray(a.missing_train_eta_after_port_eta_7_days) ? a.missing_train_eta_after_port_eta_7_days : []);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setError(e?.message || 'Failed to load finance alerts');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [idFilter, containerFilter, dateFilter]);

  useEffect(() => { fetchAll(); }, []);

  const gotoInfo = (row: any) => {
    const id = row?.task_id || row?.main_id;
    if (!id) return;
    const viewNo = splitContainers(row?.container_number || row?.fee_containers)[0] || '';
    const type = String(row?.type || '').toLowerCase();
    if (type === 'truck') navigate(`/order_run/info/t_info?id=${id}&view_no=${viewNo}`);
    else navigate(`/order_run/info/h_info?id=${id}&view_no=${viewNo}`);
  };

  const total = missingFees.length + halfFees.length + negativeProfits.length + portNoTrain.length;

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('financeNotification.title')} pageTitle="Admin" />

        <Card className="mb-3">
          <CardBody>
            <div className="sl-filter-bar">
              <FI>
                <CI
                  value={idFilter}
                  onChange={setIdFilter}
                  placeholder={tt('financeNotification.filters.taskId')}
                  onEnter={fetchAll}
                  className="sl-w-200"
                />
              </FI>

              <FI>
                <CI
                  value={containerFilter}
                  onChange={setContainerFilter}
                  placeholder={tt('financeNotification.filters.containerNumber')}
                  onEnter={fetchAll}
                  className="sl-w-200"
                />
              </FI>

              <FI>
                <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
              </FI>

              <FI>
                <Button color="primary" onClick={fetchAll} disabled={loading}>
                  {loading ? <Spinner size="sm" className="me-1" /> : null}{tt('financeNotification.filters.refresh')}
                </Button>
              </FI>

              <FI>
                <Button color="secondary" outline disabled={loading}
                  onClick={() => { setIdFilter(''); setContainerFilter(''); setDateFilter(''); }}>
                  {tt('financeNotification.filters.reset')}
                </Button>
              </FI>
            </div>
          </CardBody>
        </Card>

        {error && <Alert color="danger">{error}</Alert>}

        <Card>
          <CardHeader className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">{tt('financeNotification.alerts.title')}</span>
            <CountBadge count={total} />
          </CardHeader>
          <CardBody>
            <div className="d-flex justify-content-between fw-semibold mb-2">
              <span>{tt('financeNotification.alerts.missingFee')}</span>
              <CountBadge count={missingFees.length} />
            </div>
            {missingFees.length ? missingFees.map((r, i) => (
              <RowCard key={i} onClick={() => gotoInfo(r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>Task ID: {r.task_id || '-'}</strong>
                  <span>Applicant: {r.applicants || '-'}</span>
                  <span>Fee Rows: {r.fee_row_count ?? '-'}</span>
                  <span>Days: {r.days_after_pickup ?? '-'}</span>
                </div>
                <TagList items={splitContainers(r.fee_containers)} />
              </RowCard>
            )) : <SectionEmpty text={tt('financeNotification.alerts.noMissingFee')} />}

            <hr />
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('financeNotification.alerts.halfFee')}</span>
              <CountBadge count={halfFees.length} />
            </div>
            {halfFees.length ? halfFees.map((r, i) => (
              <RowCard key={i} onClick={() => gotoInfo(r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>Task ID: {r.task_id || '-'}</strong>
                  <span>Container: {r.container_number || '-'}</span>
                  <span>Charge: {r.charge_types || '-'}</span>
                  <span>Rate: {r.quantity || 0} × {r.rate || 0}</span>
                  <span>Cost: {r.cost_amount || '-'}</span>
                  <span>Days: {r.days_after_pickup ?? '-'}</span>
                </div>
                <div className="d-flex flex-wrap gap-1 mt-2">
                  <span className="badge bg-light text-dark border">Vendor: {r.vender || '-'}</span>
                  <span className="badge bg-light text-dark border">Invoice: {r.invoice_number || '-'}</span>
                  <span className="badge bg-light text-dark border">Applicant: {r.applicant || '-'}</span>
                </div>
              </RowCard>
            )) : <SectionEmpty text={tt('financeNotification.alerts.noHalfFee')} />}

            <hr />
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('financeNotification.alerts.negativeProfit')}</span>
              <CountBadge count={negativeProfits.length} />
            </div>
            {negativeProfits.length ? negativeProfits.map((r, i) => (
              <RowCard key={i} negative onClick={() => gotoInfo(r)}>
                <div className="d-flex flex-wrap gap-3 small align-items-center">
                  <strong>Task ID: {r.task_id || '-'}</strong>
                  <span>Container: {r.container_number || '-'}</span>
                  <Badge color="danger">Profit: {fmtPercent(r.profit_rate_percent)}</Badge>
                </div>
                <TagList items={splitContainers(r.container_number)} />
              </RowCard>
            )) : <SectionEmpty text={tt('financeNotification.alerts.noNegativeProfit')} />}

            <hr />
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('financeNotification.alerts.portNoTrain')}</span>
              <CountBadge count={portNoTrain.length} />
            </div>
            {portNoTrain.length ? portNoTrain.map((r, i) => (
              <RowCard key={i} onClick={() => gotoInfo(r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>Task ID: {r.task_id || r.main_id || '-'}</strong>
                  <span>Container: {r.container_number || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                  <span>Port ETA: {fmtDate(r.portETA)}</span>
                  <span>Days: {r.days_after_portETA ?? '-'}</span>
                </div>
                <div className="d-flex gap-1 mt-2">
                  <Badge color="danger">{tt('financeNotification.alerts.noTrainEta')}</Badge>
                </div>
              </RowCard>
            )) : <SectionEmpty text={tt('financeNotification.alerts.noPortNoTrain')} />}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
};

export default FinanceNotification;
