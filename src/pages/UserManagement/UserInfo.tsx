import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Input,
  Label,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { toast } from 'react-toastify';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { buildApiUrl } from '../../helpers/apiBase';
import {
  FETCH_ALL_SALESBOND_CUSTOMERS,
  GET_CLIENT_USER_INFO,
  GET_SPECIFIC_USER,
  INSERT_SALES_CUSTOMERS,
  UPDATE_CLIENT_USER_TYPE,
  IMPORTER_LIST_WITH_DOCS,
  CREATE_IMPORTER,
  UPDATE_IMPORTER_GST_DUTY,
  GET_IMPORTER_GST_DUTY,
  UPLOAD_POA_FILES,
  REPLACE_FILE,
} from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { can, RESTRICT } from '../../helpers/userInformation';

// ─── Types ────────────────────────────────────────────────────────────────────

type PermitKey = `Permit_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
type DocKey = 'POA' | 'Bond' | PermitKey;

interface ImporterRow {
  id: number | null;
  Name: string;
  POA: string | null;
  Bond: string | null;
  Permit_1: string | null;
  Permit_2: string | null;
  Permit_3: string | null;
  Permit_4: string | null;
  Permit_5: string | null;
  Permit_6: string | null;
  Permit_7: string | null;
  Permit_8: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (v: unknown) => {
  if (!v) return '-';
  const s = typeof v === 'string' || typeof v === 'number' ? String(v) : '-';
  if (s === '-') return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const DOC_KEYS: DocKey[] = [
  'POA',
  'Bond',
  'Permit_1',
  'Permit_2',
  'Permit_3',
  'Permit_4',
  'Permit_5',
  'Permit_6',
  'Permit_7',
  'Permit_8',
];

function toPreviewUrl(url: string | null | undefined): string {
  if (!url) return '';
  const abs = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const map: Record<string, string> = {
    'https://dh-app-files.oss-cn-beijing.aliyuncs.com': 'https://filepreview.dhsupplychain.cn',
    'https://dh-app-files-live.oss-cn-hongkong.aliyuncs.com':
      'https://file-preview.dhsupplychain.cn',
  };
  for (const origin in map) {
    if (abs.startsWith(origin)) return abs.replace(origin, map[origin]);
  }
  return abs;
}

function coerceImporter(r: any): ImporterRow {
  return {
    id:
      typeof r?.id === 'number' ? r.id : typeof r?.importer_id === 'number' ? r.importer_id : null,
    Name: r?.Name ?? r?.name ?? '',
    POA: r?.POA ?? r?.poa ?? null,
    Bond: r?.Bond ?? r?.bond ?? null,
    Permit_1: r?.Permit_1 ?? r?.permit_1 ?? null,
    Permit_2: r?.Permit_2 ?? r?.permit_2 ?? null,
    Permit_3: r?.Permit_3 ?? r?.permit_3 ?? null,
    Permit_4: r?.Permit_4 ?? r?.permit_4 ?? null,
    Permit_5: r?.Permit_5 ?? r?.permit_5 ?? null,
    Permit_6: r?.Permit_6 ?? r?.permit_6 ?? null,
    Permit_7: r?.Permit_7 ?? r?.permit_7 ?? null,
    Permit_8: r?.Permit_8 ?? r?.permit_8 ?? null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const UserInfo: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { tt } = useTT();

  const userId = params.get('id') || '';
  const canAssignSales = can(RESTRICT.ASSIGN_SALES_TO_CLIENT);

  // ── Client info ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [userType, setUserType] = useState<string>('');
  const [typeUpdating, setTypeUpdating] = useState(false);
  const [typeMsg, setTypeMsg] = useState('');

  // ── Sales assign ──
  const [salesUsers, setSalesUsers] = useState<any[]>([]);
  const [salesUsersLoading, setSalesUsersLoading] = useState(false);
  const [selectedSalesId, setSelectedSalesId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');
  const [assignedList, setAssignedList] = useState<any[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);

  // ── Importers ──
  const [importers, setImporters] = useState<ImporterRow[]>([]);
  const [importersLoading, setImportersLoading] = useState(false);
  const [gstMap, setGstMap] = useState<Record<number, 0 | 1>>({});
  const [gstUpdating, setGstUpdating] = useState<Record<number, boolean>>({});

  // ── Importer search ──
  const [importerSearch, setImporterSearch] = useState('');

  // ── Add importer form ──
  const [addingImporter, setAddingImporter] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [addingLoading, setAddingLoading] = useState(false);

  // ── File update ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpdate = useRef<{ importer: ImporterRow; docKey: DocKey } | null>(null);
  const [fileUpdating, setFileUpdating] = useState(false);

  const reqSeq = useRef(0);

  // ── Fetch client info ──
  useEffect(() => {
    if (!userId) {
      setError('No user ID provided.');
      return;
    }
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    fetch(buildApiUrl(GET_CLIENT_USER_INFO), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (seq !== reqSeq.current) return;
        const row = Array.isArray(data?.data) ? (data.data[0] ?? null) : null;
        setInfo(row);
        if (row) setUserType(row.User_Type != null ? String(row.User_Type) : '');
      })
      .catch((e) => {
        if (seq !== reqSeq.current) return;
        setError(e?.message || 'Failed');
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false);
      });
  }, [userId]);

  // ── Fetch importers ──
  const fetchImporters = useCallback(async () => {
    if (!userId) return;
    setImportersLoading(true);
    try {
      const res = await fetch(buildApiUrl(IMPORTER_LIST_WITH_DOCS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, importer_status: 0 }),
      });
      const data = await res.json();
      const raw: ImporterRow[] = (
        Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      ).map(coerceImporter);
      // Deduplicate by id, falling back to name
      const seen = new Set<string>();
      const rows = raw.filter((r) => {
        const key = r.id != null ? `id:${r.id}` : `name:${r.Name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setImporters(rows);

      // Fetch GST for all importer ids
      const ids = rows.map((r) => r.id).filter(Boolean);
      if (ids.length) {
        const gstRes = await fetch(buildApiUrl(GET_IMPORTER_GST_DUTY), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, importer_id: ids }),
        });
        const gstData = await gstRes.json();
        const gstRows: any[] = Array.isArray(gstData?.data) ? gstData.data : [];
        const map: Record<number, 0 | 1> = {};
        gstRows.forEach((r) => {
          map[Number(r.importer_id)] = Number(r.gst_duty) === 1 ? 1 : 0;
        });
        setGstMap(map);
      }
    } catch {
      setImporters([]);
    } finally {
      setImportersLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchImporters();
  }, [fetchImporters]);

  // ── Fetch sales users ──
  const fetchSalesUsers = useCallback(async () => {
    setSalesUsersLoading(true);
    try {
      const [resSales, resCS] = await Promise.all([
        fetch(buildApiUrl(GET_SPECIFIC_USER), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: 'Sales' }),
        }).then((r) => r.json()),
        fetch(buildApiUrl(GET_SPECIFIC_USER), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: 'Customer Service' }),
        }).then((r) => r.json()),
      ]);
      const salesArr = Array.isArray(resSales)
        ? resSales
        : Array.isArray(resSales?.data)
          ? resSales.data
          : [];
      const csArr = Array.isArray(resCS) ? resCS : Array.isArray(resCS?.data) ? resCS.data : [];
      setSalesUsers([...salesArr, ...csArr]);
    } catch {
      setSalesUsers([]);
    } finally {
      setSalesUsersLoading(false);
    }
  }, []);

  const refreshAssigned = useCallback(async () => {
    if (!userId) return;
    setAssignedLoading(true);
    try {
      const res = await fetch(buildApiUrl(FETCH_ALL_SALESBOND_CUSTOMERS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setAssignedList(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch {
      setAssignedList([]);
    } finally {
      setAssignedLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (canAssignSales && userId) {
      fetchSalesUsers();
      refreshAssigned();
    }
  }, [canAssignSales, userId, fetchSalesUsers, refreshAssigned]);

  // ── Handlers ──

  const handleUpdateType = async () => {
    if (!userId) return;
    setTypeUpdating(true);
    setTypeMsg('');
    try {
      const res = await fetch(buildApiUrl(UPDATE_CLIENT_USER_TYPE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_type: userType === '' ? null : Number(userType),
        }),
      });
      const data = await res.json();
      setTypeMsg(data?.message || 'Updated');
    } catch (e: any) {
      setTypeMsg(e?.message || 'Update failed');
    } finally {
      setTypeUpdating(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedSalesId) {
      setAssignMsg(tt('sales.pickSales'));
      return;
    }
    setAssigning(true);
    setAssignMsg('');
    try {
      const userName = info?.user_name ?? info?.User_Name ?? info?.Account_Name?.name ?? '';
      await fetch(buildApiUrl(INSERT_SALES_CUSTOMERS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          sales_id: Number(selectedSalesId),
        }),
      });
      setAssignMsg(tt('sales.assignedOk'));
      setSelectedSalesId('');
      refreshAssigned();
    } catch (e: any) {
      setAssignMsg(e?.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const handleGstToggle = async (importer: ImporterRow, value: 0 | 1) => {
    const id = Number(importer.id);
    if (!id) return;
    setGstUpdating((prev) => ({ ...prev, [id]: true }));
    const prev = gstMap[id];
    setGstMap((m) => ({ ...m, [id]: value }));
    try {
      await fetch(buildApiUrl(UPDATE_IMPORTER_GST_DUTY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, importer_id: id, gst_duty: value }),
      });
      toast.success(tt('importer.gstUpdated'));
    } catch {
      setGstMap((m) => ({ ...m, [id]: prev }));
      toast.error(tt('importer.gstFailed'));
    } finally {
      setGstUpdating((p) => ({ ...p, [id]: false }));
    }
  };

  const handleAddImporter = async () => {
    if (!newName.trim()) {
      toast.warning(tt('importer.nameRequired'));
      return;
    }
    setAddingLoading(true);
    try {
      // 1. Create importer record
      const createRes = await fetch(buildApiUrl(CREATE_IMPORTER), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: newName.trim() }),
      });
      const createData = await createRes.json();
      const importerId = createData?.data?.importer_id ?? createData?.importer_id;

      // 2. Upload files if any
      if (newFiles.length && importerId) {
        const fd = new FormData();
        newFiles.forEach((f) => fd.append('files', f));
        newFiles.forEach(() => {
          fd.append('user_ids', userId);
          fd.append('poa_names', newName.trim());
          fd.append('statuses', '0');
          fd.append('importer_ids', String(importerId));
          fd.append('doc_types', 'POA');
        });
        await fetch(buildApiUrl(UPLOAD_POA_FILES), { method: 'POST', body: fd });
      }

      toast.success(tt('importer.addedOk'));
      setNewName('');
      setNewFiles([]);
      setAddingImporter(false);
      fetchImporters();
    } catch {
      toast.error(tt('importer.addFailed'));
    } finally {
      setAddingLoading(false);
    }
  };

  const triggerFileUpdate = (importer: ImporterRow, docKey: DocKey) => {
    pendingUpdate.current = { importer, docKey };
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingUpdate.current;
    if (!file || !pending) return;
    e.target.value = '';

    const { importer, docKey } = pending;
    if (!importer.id) return;
    setFileUpdating(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      fd.append('user_ids', userId);
      fd.append('poa_names', importer.Name);
      fd.append('statuses', '0');
      fd.append('importer_ids', String(importer.id));
      fd.append('doc_types', docKey);
      await fetch(buildApiUrl(UPLOAD_POA_FILES), { method: 'POST', body: fd });

      // Replace old file if one existed
      const oldUrl: string | null = (importer as any)[docKey];
      if (oldUrl) {
        await fetch(buildApiUrl(REPLACE_FILE), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldUrl,
            importer_id: importer.id,
            doc_type: docKey,
            user_id: userId,
          }),
        });
      }

      toast.success(tt('importer.fileUpdated'));
      fetchImporters();
    } catch {
      toast.error(tt('importer.fileFailed'));
    } finally {
      setFileUpdating(false);
    }
  };

  // ── Filtered importers ──
  const filteredImporters = importerSearch.trim()
    ? importers.filter((imp) =>
        imp.Name.toLowerCase().includes(importerSearch.trim().toLowerCase())
      )
    : importers;

  // ── Display helpers ──
  const salesLabel = (u: any) => {
    const name =
      u?.user_name ??
      u?.name ??
      u?.account_name ??
      `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim();
    return String(name || `Sales ${u?.id ?? ''}`);
  };
  const currencyText = (c: unknown) => (Number(c) === 1 ? 'USD' : 'CAD');
  const contact = info?.contact_name ?? info?.Full_Name ?? '';
  const parts = String(contact).trim().split(/\s+/);
  const displayFirst = info?.First_Name ?? (parts[0] || '');
  const displayLast = info?.Last_Name ?? (parts.slice(1).join(' ') || '');

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('userInfo.title')} pageTitle="User Management" />

        <div className="mb-3">
          <Button color="secondary" outline onClick={() => navigate('/user/run')}>
            &larr; {tt('userInfo.back')}
          </Button>
        </div>

        {error && <Alert color="danger">{error}</Alert>}
        {loading && (
          <Card>
            <CardBody className="text-center py-5">
              <Spinner />
            </CardBody>
          </Card>
        )}
        {!loading && !info && !error && (
          <Card>
            <CardBody className="text-center text-muted py-5">{tt('userInfo.notFound')}</CardBody>
          </Card>
        )}

        {!loading && info && (
          <>
            {/* ── Client Info ── */}
            <Card className="mb-3">
              <CardHeader className="fw-bold">{tt('userInfo.clientInfo')}</CardHeader>
              <CardBody>
                <Row className="g-0">
                  <Col xs={12} md={6}>
                    <Table borderless size="sm" className="mb-0">
                      <tbody>
                        <tr>
                          <th className="text-muted userinfo-th-label">
                            {tt('userInfo.fields.userId')}
                          </th>
                          <td>{info.id ?? info.user_id ?? '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.username')}</th>
                          <td>{info.User_Name ?? info.user_name ?? '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.firstName')}</th>
                          <td>{displayFirst || '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.lastName')}</th>
                          <td>{displayLast || '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.phone')}</th>
                          <td>{info.Phone ?? info.phone ?? '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.email')}</th>
                          <td>{info.Email ?? info.email ?? '-'}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </Col>
                  <Col xs={12} md={6}>
                    <Table borderless size="sm" className="mb-0">
                      <tbody>
                        <tr>
                          <th className="text-muted userinfo-th-label">
                            {tt('userInfo.fields.company')}
                          </th>
                          <td>{info.Account_Name?.name ?? info.company_name ?? '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.currency')}</th>
                          <td>
                            <Badge color="info">
                              {currencyText(info.Currency ?? info.currency)}
                            </Badge>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.billTerm')}</th>
                          <td>{info.Bill_Term ?? '-'}</td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.clientType')}</th>
                          <td>
                            <div className="d-flex gap-2 align-items-center flex-wrap">
                              <Input
                                type="select"
                                bsSize="sm"
                                className="userinfo-type-select"
                                value={userType}
                                onChange={(e) => setUserType(e.target.value)}
                              >
                                <option value="">{tt('userInfo.fields.typeNA')}</option>
                                <option value="0">{tt('userInfo.fields.typeSalesClient')}</option>
                                <option value="1">{tt('userInfo.fields.typeCompanyClient')}</option>
                              </Input>
                              <Button
                                size="sm"
                                color="primary"
                                outline
                                onClick={() => void handleUpdateType()}
                                disabled={typeUpdating}
                              >
                                {typeUpdating ? <Spinner size="sm" className="me-1" /> : null}
                                {tt('common.save')}
                              </Button>
                              {typeMsg && <span className="text-success small">{typeMsg}</span>}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th className="text-muted">{tt('userInfo.fields.created')}</th>
                          <td>{fmtDate(info.Create_Time ?? info.create_time)}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </Col>
                </Row>
              </CardBody>
            </Card>

            {/* ── Assign Sales ── */}
            {canAssignSales && (
              <Card className="mb-3">
                <CardHeader className="fw-bold">{tt('sales.addtitle')}</CardHeader>
                <CardBody>
                  <Row className="g-2 align-items-end mb-3">
                    <Col xs={12} sm={5} md={4}>
                      <Input
                        type="select"
                        value={selectedSalesId}
                        onChange={(e) => setSelectedSalesId(e.target.value)}
                        disabled={salesUsersLoading}
                      >
                        <option value="">
                          {salesUsersLoading ? tt('common.loading') : tt('sales.pickSales')}
                        </option>
                        {salesUsers.map((u) => (
                          <option
                            key={u?.id ?? u?.user_id}
                            value={String(u?.id ?? u?.user_id ?? '')}
                          >
                            {salesLabel(u)}
                          </option>
                        ))}
                      </Input>
                    </Col>
                    <Col xs="auto">
                      <Button color="primary" onClick={handleAssign} disabled={assigning}>
                        {assigning ? <Spinner size="sm" className="me-1" /> : null}
                        {tt('sales.submit')}
                      </Button>
                    </Col>
                    <Col xs="auto">
                      <Button
                        color="secondary"
                        outline
                        onClick={refreshAssigned}
                        disabled={assignedLoading}
                      >
                        {tt('sales.refresh')}
                      </Button>
                    </Col>
                    {assignMsg && (
                      <Col xs={12}>
                        <span className="small text-success">{assignMsg}</span>
                      </Col>
                    )}
                  </Row>
                  <p className="fw-semibold mb-2">{tt('sales.salesLists')}</p>
                  <Card className="sl-table-card">
                    <CardBody className="p-0">
                      <div className="sl-table-scroll">
                        <Table className="mb-0 sl-table">
                          <thead>
                            <tr>
                              <th>{tt('sales.salesName')}</th>
                              <th>{tt('sales.customerName')}</th>
                              <th>{tt('sales.createDate')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignedLoading && (
                              <tr>
                                <td colSpan={3} className="text-center py-5">
                                  <Spinner color="primary" size="sm" />
                                </td>
                              </tr>
                            )}
                            {!assignedLoading && assignedList.length === 0 && (
                              <tr>
                                <td colSpan={3} className="text-center text-muted py-5">
                                  {tt('sales.noTicket')}
                                </td>
                              </tr>
                            )}
                            {!assignedLoading &&
                              assignedList.map((r, i) => (
                                <tr key={i}>
                                  <td>{r?.sales_name ?? r?.name ?? r?.user_name ?? '-'}</td>
                                  <td>{r?.user_name ?? '-'}</td>
                                  <td>{r?.create_time ?? '-'}</td>
                                </tr>
                              ))}
                          </tbody>
                        </Table>
                      </div>
                    </CardBody>
                  </Card>
                </CardBody>
              </Card>
            )}

            {/* ── Importers & Documents ── */}
            <Card className="mb-3">
              <CardHeader>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="fw-bold me-auto">{tt('importer.sectionTitle')}</span>
                  <div className="userinfo-search-wrap position-relative">
                    <Input
                      bsSize="sm"
                      placeholder={tt('importer.searchPlaceholder')}
                      value={importerSearch}
                      onChange={(e) => setImporterSearch(e.target.value)}
                      className="userinfo-search-input"
                    />
                    {importerSearch && (
                      <button
                        className="btn btn-link p-0 position-absolute userinfo-search-clear"
                        onClick={() => setImporterSearch('')}
                      >
                        <i className="ri-close-line text-muted" />
                      </button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    outline
                    onClick={() => {
                      setAddingImporter((v) => !v);
                      setNewName('');
                      setNewFiles([]);
                    }}
                  >
                    {addingImporter ? tt('importer.cancelBtn') : tt('importer.addBtn')}
                  </Button>
                </div>
              </CardHeader>

              <CardBody>
                {/* Add importer form */}
                {addingImporter && (
                  <div className="p-3 mb-4 border rounded bg-light">
                    <Row className="g-2 align-items-end">
                      <Col xs={12} sm={4}>
                        <Label className="small fw-semibold mb-1">{tt('importer.nameLabel')}</Label>
                        <Input
                          bsSize="sm"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. ABC Imports Inc."
                        />
                      </Col>
                      <Col xs={12} sm={5}>
                        <Label className="small fw-semibold mb-1">
                          {tt('importer.poaFileLabel')}
                        </Label>
                        <Input
                          bsSize="sm"
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
                        />
                      </Col>
                      <Col xs="auto">
                        <Button
                          size="sm"
                          color="primary"
                          onClick={handleAddImporter}
                          disabled={addingLoading}
                        >
                          {addingLoading ? <Spinner size="sm" className="me-1" /> : null}
                          {tt('importer.addSubmit')}
                        </Button>
                      </Col>
                    </Row>
                  </div>
                )}

                {importersLoading && (
                  <div className="text-center py-4">
                    <Spinner />
                  </div>
                )}

                {!importersLoading && importers.length === 0 && (
                  <div className="text-center text-muted py-4">{tt('importer.noImporters')}</div>
                )}

                {!importersLoading && importers.length > 0 && filteredImporters.length === 0 && (
                  <div className="text-center text-muted py-4">
                    {tt('importer.noMatch')} "<strong>{importerSearch}</strong>"
                  </div>
                )}

                {!importersLoading &&
                  filteredImporters.map((imp, idx) => {
                    const id = Number(imp.id ?? 0);
                    const gst = gstMap[id];
                    const docRows = DOC_KEYS.map((k) => ({
                      key: k,
                      value: (imp as any)[k] as string | null,
                    }));
                    const filledDocs = docRows.filter((d) => d.value);

                    return (
                      <div
                        key={imp.id != null ? `id-${imp.id}` : `idx-${idx}`}
                        className="mb-3 border rounded overflow-hidden"
                      >
                        {/* Importer header */}
                        <div className="px-3 py-2 bg-light d-flex justify-content-between align-items-center">
                          <span className="fw-semibold">{imp.Name || '—'}</span>
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-muted small me-1">{tt('importer.gstDuty')}:</span>
                            {gstUpdating[id] ? (
                              <Spinner size="sm" />
                            ) : (
                              <div className="btn-group btn-group-sm">
                                <button
                                  className={`btn btn-sm ${gst === 1 ? 'btn-success' : 'btn-outline-secondary'}`}
                                  onClick={() => handleGstToggle(imp, 1)}
                                >
                                  {tt('importer.yes')}
                                </button>
                                <button
                                  className={`btn btn-sm ${gst === 0 ? 'btn-danger' : 'btn-outline-secondary'}`}
                                  onClick={() => handleGstToggle(imp, 0)}
                                >
                                  {tt('importer.no')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Documents table */}
                        <div className="table-responsive">
                          <Table size="sm" className="mb-0 align-middle">
                            <tbody>
                              {DOC_KEYS.map((docKey) => {
                                const val: string | null = (imp as any)[docKey];
                                return (
                                  <tr key={docKey}>
                                    <td className="text-muted ps-3 userinfo-doc-label-cell">
                                      <span className={val ? 'fw-semibold text-dark' : ''}>
                                        {docKey}
                                      </span>
                                    </td>
                                    <td className="text-truncate userinfo-doc-link-cell">
                                      {val ? (
                                        <a
                                          href={toPreviewUrl(val)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary small userinfo-doc-link"
                                        >
                                          {val.split('/').pop() || val}
                                        </a>
                                      ) : (
                                        <span className="text-muted small">—</span>
                                      )}
                                    </td>
                                    <td className="pe-3 text-end userinfo-doc-action-cell">
                                      <Button
                                        size="sm"
                                        color={val ? 'primary' : 'secondary'}
                                        outline
                                        disabled={fileUpdating}
                                        onClick={() => triggerFileUpdate(imp, docKey)}
                                      >
                                        {val ? tt('importer.update') : tt('importer.upload')}
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </div>
                      </div>
                    );
                  })}
              </CardBody>
            </Card>

            {/* Hidden file input for doc replacement */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="d-none"
              onChange={handleFileInputChange}
            />
          </>
        )}
      </Container>
    </div>
  );
};

export default UserInfo;
