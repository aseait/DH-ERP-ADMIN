import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, CardBody, CardHeader, Badge, Button, Spinner, Alert } from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { CS, FI } from '../CustomerOrder/_ServiceListPage';
import { buildApiUrl } from '../../helpers/apiBase';
import { useTT } from '../../helpers/useTT';
import {
  RETRIEVE_CAD_DRAFT_OVERDUE,
  GET_USER_POA_LIST,
  GET_SPECIFIC_USER,
  FETCH_CITIES,
  UPLOAD_POA_FILES,
} from '../../helpers/url_helper';

const fmtDate = (v: unknown) => {
  if (!v) return '-';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-CA', { hour12: false });
};

const getMainId = (row: any) => String(row?.main_id || row?.task_id || '').trim();
const getFirstContainer = (row: any) => {
  const list = Array.isArray(row?.container_numbers) ? row.container_numbers : [];
  return String(list[0] || row?.container_number || '').trim().toUpperCase();
};

type Kind = 'marine' | 'air' | 'truck';

const SectionEmpty = ({ text }: { text: string }) => (
  <div className="text-muted small p-2 border border-dashed rounded">{text}</div>
);

const RowCard = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => (
  <div
    onClick={onClick}
    className={`border rounded p-3 mb-2 bg-white notif-row-card${onClick ? ' notif-row-card--clickable' : ''}`}
  >
    {children}
  </div>
);

const TagList = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="d-flex flex-wrap gap-1 mt-2">
      {items.map((c, i) => (
        <span key={i} className="badge bg-light text-dark border">{c}</span>
      ))}
    </div>
  ) : <span className="text-muted small">-</span>;

const CountBadge = ({ count, danger }: { count: number; danger?: boolean }) =>
  count > 0
    ? <Badge color={danger ? 'danger' : 'success'} className="ms-2">{count}</Badge>
    : <Badge color="success" pill className="ms-2">OK</Badge>;

const Notification = () => {
  const navigate = useNavigate();
  const { tt } = useTT();

  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [assignedName, setAssignedName] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | 'marine' | 'air' | 'truck'>('');

  const [userOptions, setUserOptions] = useState<{ account_name: string }[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  const [cadMarine, setCadMarine] = useState<any[]>([]);
  const [cadAir, setCadAir] = useState<any[]>([]);
  const [cadTruck, setCadTruck] = useState<any[]>([]);

  const [train24, setTrain24] = useState<any[]>([]);
  const [train1m, setTrain1m] = useState<any[]>([]);
  const [vanGroups, setVanGroups] = useState<any[]>([]);
  const [pars, setPars] = useState<any[]>([]);

  const [poaRows, setPoaRows] = useState<any[]>([]);

  const reqSeq = useRef(0);

  const makeFilter = useCallback(
    (kind: Kind) => (x: any) => {
      if (typeFilter && typeFilter !== kind) return false;
      if (assignedName && String(x?.assigned_name || '').trim() !== assignedName) return false;
      if (cityFilter && String(x?.destination || '').trim() !== cityFilter) return false;
      return true;
    },
    [typeFilter, assignedName, cityFilter]
  );

  const sortByAssigneeDest = (a: any, b: any) => {
    const an = String(a?.assigned_name || '').localeCompare(String(b?.assigned_name || ''));
    if (an !== 0) return an;
    const dn = String(a?.destination || '').localeCompare(String(b?.destination || ''));
    if (dn !== 0) return dn;
    return Number(b?.overdue_hours ?? 0) - Number(a?.overdue_hours ?? 0);
  };

  const buildVanGroups = (vanRaw: any[]) => {
    const map = new Map<string, any>();
    for (const r of vanRaw) {
      const container = Array.isArray(r?.container_numbers) && r.container_numbers.length
        ? String(r.container_numbers[0] || '') : '';
      const key = `${container}__${String(r?.portETA || '')}__${String(r?.assigned_name || '')}`;
      const overdue = Number(r?.overdue_hours ?? 0);
      if (!map.has(key)) {
        map.set(key, { ...r, container_number: container, count: 1 });
      } else {
        const g = map.get(key)!;
        g.count += 1;
        g.overdue_hours = Math.max(g.overdue_hours ?? 0, overdue);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.assigned_name || '').localeCompare(String(b.assigned_name || ''))
    );
  };

  const fetchPoaList = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(GET_USER_POA_LIST), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 500 }),
      });
      const d = await res.json();
      setPoaRows(Array.isArray(d?.data) ? d.data : []);
    } catch {
      setPoaRows([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildApiUrl(RETRIEVE_CAD_DRAFT_OVERDUE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: 24, limit: 2000 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== reqSeq.current) return;

      const fM = makeFilter('marine');
      const fA = makeFilter('air');
      const fT = makeFilter('truck');

      setCadMarine((Array.isArray(data?.marine) ? data.marine : []).filter(fM).sort(sortByAssigneeDest));
      setCadAir((Array.isArray(data?.air) ? data.air : []).filter(fA).sort(sortByAssigneeDest));
      setCadTruck((Array.isArray(data?.truck) ? data.truck : []).filter(fT).sort(sortByAssigneeDest));

      const s2 = data?.alerts_status_2 || {};
      const train = s2?.marine_trainETA || {};
      setTrain24((Array.isArray(train?.fcl_overdue_24h) ? train.fcl_overdue_24h : []).filter(fM).sort(sortByAssigneeDest));
      setTrain1m((Array.isArray(train?.lcl_overdue_1m) ? train.lcl_overdue_1m : []).filter(fM).sort(sortByAssigneeDest));
      const vanRaw = Array.isArray(s2?.marine_vancouver_portETA_overdue_2d?.items)
        ? s2.marine_vancouver_portETA_overdue_2d.items : [];
      setVanGroups(buildVanGroups(vanRaw.filter(fM)));
      setPars((Array.isArray(s2?.truck_pars_exists?.items) ? s2.truck_pars_exists.items : []).filter(fT).sort(sortByAssigneeDest));

      await fetchPoaList();
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setError(e?.message || 'Failed to load notifications');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [makeFilter, fetchPoaList]);

  useEffect(() => {
    // load user and city options once on mount
    fetch(buildApiUrl(GET_SPECIFIC_USER), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: 'DH' }),
    })
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
        setUserOptions(arr.map((x: any) => ({ account_name: String(x?.account_name || '').trim() }))
          .filter((x: any) => x.account_name)
          .sort((a: any, b: any) => a.account_name.localeCompare(b.account_name)));
      })
      .catch(() => {});

    fetch(buildApiUrl(FETCH_CITIES))
      .then(r => r.json())
      .then(d => {
        const raw = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        const seen = new Set<string>();
        const out: string[] = [];
        for (const r of raw) {
          const v = typeof r === 'string' ? r : String(r?.name || r?.city || r?.label || r?.value || '').trim();
          if (v && !seen.has(v)) { seen.add(v); out.push(v); }
        }
        setCityOptions(out.sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});

    fetchAll();
  }, []);

  const approvePoa = async (row: any) => {
    const poaId = String(row?.poa_id || '').trim();
    if (!poaId) return;
    setApprovingId(poaId);
    try {
      await fetch(buildApiUrl(UPLOAD_POA_FILES), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ poa_id: poaId, status: 0 }] }),
      });
      await fetchPoaList();
    } catch {
      // silent — approval failures show no toast in this admin view
    } finally {
      setApprovingId(null);
    }
  };

  const jumpToInfo = (kind: Kind, row: any, containerOrAwb?: string) => {
    const id = getMainId(row);
    if (!id) return;
    const viewNo = String(containerOrAwb || getFirstContainer(row) || '').trim();
    if (kind === 'marine') navigate(`/order_run/info/h_info?id=${id}&view_no=${viewNo}`);
    else if (kind === 'air') navigate(`/order_run/info/k_info?id=${id}&view_no=${viewNo}`);
    else navigate(`/order_run/info/t_info?id=${id}&view_no=${viewNo}`);
  };

  const cadTotal = cadMarine.length + cadAir.length + cadTruck.length;
  const alertsTotal = train24.length + train1m.length + vanGroups.length + pars.length;

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('notification.title')} pageTitle="Admin" />

        {/* ─── Filters — matches Customer Order pages' sl-filter-bar ─── */}
        <Card className="mb-3">
          <CardBody>
            <div className="sl-filter-bar">
              <FI>
                <CS
                  value={assignedName}
                  onChange={setAssignedName}
                  placeholder={tt('notification.filters.allAssignees')}
                  className="sl-w-200"
                >
                  {userOptions.map(u => <option key={u.account_name} value={u.account_name}>{u.account_name}</option>)}
                </CS>
              </FI>

              <FI>
                <CS
                  value={cityFilter}
                  onChange={setCityFilter}
                  placeholder={tt('notification.filters.allCities')}
                  className="sl-w-200"
                >
                  {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </CS>
              </FI>

              <FI>
                <CS
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v as '' | 'marine' | 'air' | 'truck')}
                  placeholder={tt('notification.filters.allTypes')}
                  className="sl-w-200"
                >
                  <option value="marine">{tt('notification.filters.marine')}</option>
                  <option value="air">{tt('notification.filters.air')}</option>
                  <option value="truck">{tt('notification.filters.truck')}</option>
                </CS>
              </FI>

              <FI>
                <Button color="primary" onClick={fetchAll} disabled={loading}>
                  {loading ? <Spinner size="sm" className="me-1" /> : null}{tt('notification.filters.refresh')}
                </Button>
              </FI>

              <FI>
                <Button color="secondary" outline disabled={loading}
                  onClick={() => { setAssignedName(''); setCityFilter(''); setTypeFilter(''); fetchAll(); }}>
                  {tt('notification.filters.reset')}
                </Button>
              </FI>
            </div>
          </CardBody>
        </Card>

        {error && <Alert color="danger">{error}</Alert>}

        {/* ─── CAD Draft Overdue ─── */}
        <Card className="mb-3">
          <CardHeader className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">{tt('notification.cad.title')}</span>
            <CountBadge count={cadTotal} danger />
          </CardHeader>
          <CardBody>
            {/* Marine */}
            <div className="d-flex justify-content-between fw-semibold mb-2">
              <span>{tt('notification.filters.marine')}</span>
              <CountBadge count={cadMarine.length} danger={cadMarine.length > 0} />
            </div>
            {cadMarine.length ? cadMarine.map((r, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('marine', r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{r.user_name || '-'}</strong>
                  <span>Assigned: {r.assigned_name || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                  <span>Overdue: {r.overdue_hours ?? '-'}h</span>
                </div>
                <TagList items={Array.isArray(r.container_numbers) ? r.container_numbers : []} />
              </RowCard>
            )) : <SectionEmpty text={tt('notification.cad.noMarine')} />}

            <hr />
            {/* Air */}
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('notification.filters.air')}</span>
              <CountBadge count={cadAir.length} danger={cadAir.length > 0} />
            </div>
            {cadAir.length ? cadAir.map((r, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('air', r, r.awb)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{r.user_name || '-'}</strong>
                  <span>Assigned: {r.assigned_name || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                  <span>AWB: {r.awb || '-'}</span>
                  <span>Overdue: {r.overdue_hours ?? '-'}h</span>
                </div>
              </RowCard>
            )) : <SectionEmpty text={tt('notification.cad.noAir')} />}

            <hr />
            {/* Truck */}
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('notification.filters.truck')}</span>
              <CountBadge count={cadTruck.length} danger={cadTruck.length > 0} />
            </div>
            {cadTruck.length ? cadTruck.map((r, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('truck', r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{r.user_name || '-'}</strong>
                  <span>Assigned: {r.assigned_name || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                  <span>Overdue: {r.overdue_hours ?? '-'}h</span>
                </div>
                <TagList items={Array.isArray(r.container_numbers) ? r.container_numbers : []} />
              </RowCard>
            )) : <SectionEmpty text={tt('notification.cad.noTruck')} />}
          </CardBody>
        </Card>

        {/* ─── Pending Alerts ─── */}
        <Card className="mb-3">
          <CardHeader className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">{tt('notification.alerts.title')}</span>
            <CountBadge count={alertsTotal} danger />
          </CardHeader>
          <CardBody>
            {/* Train FTL 24h */}
            <div className="d-flex justify-content-between fw-semibold mb-2">
              <span>{tt('notification.alerts.ftlTrain')}</span>
              <CountBadge count={train24.length} danger={train24.length > 0} />
            </div>
            {train24.length ? train24.map((r, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('marine', r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{r.user_name || '-'}</strong>
                  <span>Assigned: {r.assigned_name || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                  <span>TrainETA: {fmtDate(r.trainETA)}</span>
                </div>
                <TagList items={Array.isArray(r.container_numbers) ? r.container_numbers : []} />
              </RowCard>
            )) : <SectionEmpty text={tt('notification.alerts.noFtl')} />}

            <hr />
            {/* Train LCL 1m */}
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('notification.alerts.lclTrain')}</span>
              <CountBadge count={train1m.length} danger={false} />
            </div>
            {train1m.length ? train1m.map((r, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('marine', r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{r.user_name || '-'}</strong>
                  <span>Assigned: {r.assigned_name || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                  <span>TrainETA: {fmtDate(r.trainETA)}</span>
                </div>
                <TagList items={Array.isArray(r.container_numbers) ? r.container_numbers : []} />
              </RowCard>
            )) : <SectionEmpty text={tt('notification.alerts.noLcl')} />}

            <hr />
            {/* Vancouver Port ETA */}
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('notification.alerts.vanPort')}</span>
              <CountBadge count={vanGroups.length} danger={vanGroups.length > 0} />
            </div>
            {vanGroups.length ? vanGroups.map((g, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('marine', g, g.container_number)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{g.user_name || '-'}</strong>
                  <span>Assigned: {g.assigned_name || '-'}</span>
                  <span>PortETA: {fmtDate(g.portETA)}</span>
                </div>
                <TagList items={g.container_number ? [g.container_number] : []} />
              </RowCard>
            )) : <SectionEmpty text={tt('notification.alerts.noVan')} />}

            <hr />
            {/* Truck PARS */}
            <div className="d-flex justify-content-between fw-semibold mb-2 mt-2">
              <span>{tt('notification.alerts.truckPars')}</span>
              <CountBadge count={pars.length} danger={false} />
            </div>
            {pars.length ? pars.map((r, i) => (
              <RowCard key={i} onClick={() => jumpToInfo('truck', r)}>
                <div className="d-flex flex-wrap gap-3 small">
                  <strong>{r.user_name || '-'}</strong>
                  <span>Assigned: {r.assigned_name || '-'}</span>
                  <span>Dest: {r.destination || '-'}</span>
                </div>
                <TagList items={Array.isArray(r.container_numbers) ? r.container_numbers : []} />
              </RowCard>
            )) : <SectionEmpty text={tt('notification.alerts.noPars')} />}
          </CardBody>
        </Card>

        {/* ─── POA Pending ─── */}
        <Card className="mb-3">
          <CardHeader className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">{tt('notification.poa.title')}</span>
            <CountBadge count={poaRows.length} danger={false} />
          </CardHeader>
          <CardBody>
            {poaRows.length ? poaRows.map((r) => (
              <RowCard key={r.poa_id}>
                <div className="d-flex flex-wrap gap-3 small align-items-center">
                  <strong>{r.company_name || '-'}</strong>
                  <span>POA: {r.poa_name || '-'}</span>
                  <span>{fmtDate(r.create_time)}</span>
                  <span className="badge bg-light text-dark border">{r.fileName || '-'}</span>
                </div>
                <div className="d-flex gap-2 mt-2">
                  {r.url && (
                    <Button size="sm" color="primary" outline
                      onClick={() => window.open(String(r.url).replace(/^http:/, 'https:'), '_blank', 'noopener,noreferrer')}>
                      {tt('notification.poa.viewFile')}
                    </Button>
                  )}
                  <Button size="sm" color="success" outline
                    disabled={approvingId === String(r.poa_id)}
                    onClick={() => approvePoa(r)}>
                    {approvingId === String(r.poa_id) ? <Spinner size="sm" /> : tt('notification.poa.approve')}
                  </Button>
                </div>
              </RowCard>
            )) : <SectionEmpty text={tt('notification.poa.noPending')} />}
          </CardBody>
        </Card>
      </Container>
    </div>
  );
};

export default Notification;
