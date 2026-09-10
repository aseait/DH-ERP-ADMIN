import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Input,
  Label,
  Progress,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import * as XLSX from 'xlsx';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { buildApiUrl } from '../../helpers/apiBase';
import {
  FETCH_ALL_SALESBOND_CUSTOMERS,
  GET_CLIENT_USER_INFO,
  GET_CLIENT_USER_LIST,
} from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { can, RESTRICT } from '../../helpers/userInformation';
import { buildPageList } from '../OrderLists/helper';

const PAGE_SIZE = 15;

const splitName = (contact: string): { first: string; last: string } => {
  const parts = String(contact || '').trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
};

const toCurrencyLabel = (v: unknown): string => (Number(v) === 1 ? 'USD' : 'CAD');

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const UserList: React.FC = () => {
  const navigate = useNavigate();
  const { tt } = useTT();

  const hasPermission = can(RESTRICT.VIEW_USER_LIST);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [salesMap, setSalesMap] = useState<Record<string, string>>({});

  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);

  const reqSeq = useRef(0);

  const hydrateSalesNames = useCallback(async (userIds: string[]) => {
    if (!userIds.length) return;
    try {
      const res = await fetch(buildApiUrl(FETCH_ALL_SALESBOND_CUSTOMERS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userIds }),
      });
      const data = await res.json();
      const arr: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const tmp: Record<string, Set<string>> = {};
      arr.forEach(r => {
        const uid = String(r?.user_id ?? '');
        const sname = String(r?.sales_name ?? r?.name ?? '').trim();
        if (!uid || !sname) return;
        if (!tmp[uid]) tmp[uid] = new Set();
        tmp[uid].add(sname);
      });
      const map: Record<string, string> = {};
      Object.keys(tmp).forEach(uid => { map[uid] = Array.from(tmp[uid]).join(', '); });
      setSalesMap(prev => ({ ...prev, ...map }));
    } catch {
      // silent
    }
  }, []);

  const fetchList = useCallback(async (pg: number, kw: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildApiUrl(GET_CLIENT_USER_LIST), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: kw.trim() || undefined,
          page: pg,
          pageSize: PAGE_SIZE,
          sortField: 'company_name',
          sortOrder: 'ASC',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== reqSeq.current) return;
      const list: any[] = Array.isArray(data?.data) ? data.data : [];
      setRows(list);
      setTotal(Number(data?.totalRows || 0));
      const ids = list.map(r => String(r?.user_id ?? r?.id ?? '')).filter(Boolean);
      hydrateSalesNames(ids);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setError(e?.message || 'Failed to load user list');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [hydrateSalesNames]);

  useEffect(() => { if (hasPermission) fetchList(1, ''); }, [fetchList, hasPermission]);

  const handleSearch = () => { setPage(1); fetchList(1, keyword); };
  const handleReset = () => { setKeyword(''); setPage(1); fetchList(1, ''); };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const changePage = (p: number) => { setPage(p); fetchList(p, keyword); };
  const pageItems = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  const goInfo = (row: any) => {
    const id = row?.user_id ?? row?.id;
    if (id) navigate(`/user/info?id=${id}`);
  };

  const exportPercent = exportTotal > 0 ? Math.min(100, Math.floor((exportDone / exportTotal) * 100)) : 0;

  const exportExcel = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportDone(0);
    setExportTotal(0);

    try {
      // Fetch all pages
      const perPage = 200;
      let pg = 1;
      const all: any[] = [];
      while (true) {
        const res = await fetch(buildApiUrl(GET_CLIENT_USER_LIST), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: keyword.trim() || undefined,
            page: pg,
            pageSize: perPage,
            sortField: 'company_name',
            sortOrder: 'ASC',
          }),
        });
        const data = await res.json();
        const batch: any[] = Array.isArray(data?.data) ? data.data : [];
        all.push(...batch);
        const totalRows = Number(data?.totalRows || all.length);
        if (all.length >= totalRows || batch.length === 0) break;
        pg++;
        await sleep(20);
      }

      const ids = all.map(u => String(u?.user_id ?? u?.id ?? '').trim()).filter(Boolean);
      if (!ids.length) return;

      setExportTotal(ids.length);

      const exportRows: any[] = [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        let info: any = {};
        let salesNames = '';

        try {
          const r = await fetch(buildApiUrl(GET_CLIENT_USER_INFO), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          const d = await r.json();
          info = Array.isArray(d?.data) ? (d.data[0] ?? {}) : {};
        } catch { /* silent */ }

        try {
          const r = await fetch(buildApiUrl(FETCH_ALL_SALESBOND_CUSTOMERS), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: id }),
          });
          const d = await r.json();
          const arr: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
          const names = new Set<string>();
          arr.forEach(r2 => {
            const n = String(r2?.sales_name ?? r2?.name ?? '').trim();
            if (n) names.add(n);
          });
          salesNames = Array.from(names).join(', ');
        } catch { /* silent */ }

        const contact = String(info?.contact_name ?? info?.Full_Name ?? '').trim();
        const { first, last } = splitName(contact);

        exportRows.push({
          'ID': String(info?.user_id ?? info?.id ?? id),
          'Username': String(info?.user_name ?? info?.User_Name ?? ''),
          'First Name': String(info?.First_Name ?? first),
          'Last Name': String(info?.Last_Name ?? last),
          'Email': String(info?.email ?? info?.Email ?? ''),
          'Phone': String(info?.Phone ?? ''),
          'Company': String(info?.company_name ?? info?.Account_Name?.name ?? ''),
          'Currency': toCurrencyLabel(info?.currency ?? info?.Currency),
          'Bill Term': String(info?.Bill_Term ?? ''),
          'Client Type': info?.User_Type === 0 ? 'Sales Client' : info?.User_Type === 1 ? 'Company Client' : 'NA',
          'Sales Name': salesNames,
        });

        setExportDone(i + 1);
        if ((i + 1) % 10 === 0) await sleep(0);
      }

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Users');
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      XLSX.writeFile(wb, `users_${d.getFullYear()}-${mm}-${dd}.xlsx`);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }, [exporting, keyword]);

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('userList.title')} pageTitle="User Management" />

        {!hasPermission ? (
          <Alert color="warning" className="text-center">{tt('userList.noPermission')}</Alert>
        ) : (
          <Card>
            <CardBody>
              <Row className="g-2 align-items-end mb-3">
                <Col xs={12} sm={8} md={4}>
                  <Label className="mb-1 fw-semibold small">{tt('userList.searchLabel')}</Label>
                  <Input
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder={tt('userList.searchPlaceholder')}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                </Col>
                <Col xs="auto">
                  <Button color="primary" onClick={handleSearch} disabled={loading}>
                    {loading ? <Spinner size="sm" className="me-1" /> : null}
                    {tt('common.search')}
                  </Button>
                </Col>
                <Col xs="auto">
                  <Button color="secondary" outline onClick={handleReset} disabled={loading}>
                    {tt('common.reset')}
                  </Button>
                </Col>
                <Col xs="auto">
                  <Button color="secondary" outline onClick={exportExcel} disabled={exporting || loading}>
                    {exporting ? <Spinner size="sm" className="me-1" /> : null}
                    {exporting ? tt('userList.exporting') : tt('userList.exportExcel')}
                  </Button>
                </Col>
                <Col className="text-end text-muted small">
                  {tt('userList.total')}: {total}
                </Col>
              </Row>

              {exporting && exportTotal > 0 && (
                <div className="mb-3">
                  <div className="d-flex justify-content-between small text-muted mb-1">
                    <span>{tt('userList.exporting')}</span>
                    <span>{exportDone} / {exportTotal} ({exportPercent}%)</span>
                  </div>
                  <Progress value={exportPercent} color={exportPercent >= 100 ? 'success' : 'primary'} />
                </div>
              )}

              {error && <Alert color="danger">{error}</Alert>}

              <Card className="sl-table-card">
                <CardBody className="p-0">
                  <div className="sl-table-scroll">
                    <Table className="mb-0 sl-table">
                      <thead>
                        <tr>
                          <th className="sl-w-140">{tt('userList.columns.id')}</th>
                          <th className="sl-w-160">{tt('userList.columns.firstName')}</th>
                          <th className="sl-w-160">{tt('userList.columns.lastName')}</th>
                          <th className="sl-w-220">{tt('userList.columns.email')}</th>
                          <th className="sl-w-220">{tt('userList.columns.company')}</th>
                          <th className="sl-w-110">{tt('userList.columns.currency')}</th>
                          <th className="sl-w-220">{tt('userList.columns.salesName')}</th>
                          <th className="sl-w-120 sl-col-sticky-right">{tt('userList.columns.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr><td colSpan={8} className="text-center py-5"><Spinner color="primary" /></td></tr>
                        )}
                        {!loading && rows.length === 0 && (
                          <tr><td colSpan={8} className="text-center text-muted py-5">{tt('userList.noData')}</td></tr>
                        )}
                        {!loading && rows.map((r, i) => {
                          const uid = String(r?.user_id ?? r?.id ?? '');
                          const { first, last } = splitName(r?.contact_name ?? '');
                          return (
                            <tr key={uid || i}>
                              <td>{uid || '-'}</td>
                              <td>{first || '-'}</td>
                              <td>{last || '-'}</td>
                              <td>{r.email ?? '-'}</td>
                              <td>{r.company_name ?? '-'}</td>
                              <td>{toCurrencyLabel(r.currency)}</td>
                              <td>{salesMap[uid] || '—'}</td>
                              <td className="sl-col-sticky-right">
                                <Button size="sm" color="primary" outline onClick={() => goInfo(r)}>
                                  {tt('userList.columns.detail')}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                </CardBody>
              </Card>

              {totalPages > 1 && (
                <div className="sl-pagination">
                  <span className="sl-pg-total">
                    {tt('userList.total')} {total}
                  </span>

                  <button className="sl-pg-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} title="Previous">
                    ‹
                  </button>

                  {pageItems.map((p, i) =>
                    p === '...'
                      ? <span key={`e${i}`} className="sl-pg-ellipsis">…</span>
                      : (
                        <button
                          key={p}
                          className={`sl-pg-btn${page === p ? ' active' : ''}`}
                          onClick={() => changePage(p as number)}
                        >
                          {p}
                        </button>
                      )
                  )}

                  <button className="sl-pg-btn" disabled={page >= totalPages} onClick={() => changePage(page + 1)} title="Next">
                    ›
                  </button>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </Container>
    </div>
  );
};

export default UserList;
