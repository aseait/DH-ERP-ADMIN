import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { Button, Input, Spinner, Badge, Card, CardBody } from 'reactstrap';
import { toast } from 'react-toastify';
import { buildApiUrl } from '../../../helpers/apiBase';
import { uploadMarineAndAirFilesApi, uploadTruckFilesApi, retrieveFilesApi } from '../../../helpers/api_fetch/files';
import { openPreview } from '../../../helpers/filePreview';
import { GET_SPECIFIC_USER, GET_DAILY_PIN } from '../../../helpers/url_helper';
import { useTT } from '../../../helpers/useTT';

const BILL_TYPES = [
  'ERS',
  'Demurrage/Detention',
  'Rail/Port Storage',
  'Freight Forwarding',
  'Terminal/Dock Fee',
  'Inspection Fee',
  'Other',
];

const INVOICE_FEE_INSERT_URL = '/finance/insertInvoiceFee';
const INVOICE_FEE_RETRIEVE_URL = '/finance/retrieveInvoiceFee';

type Currency = 'USD' | 'CAD' | '';

interface BillRow {
  id?: number;
  container_number: string;
  type: string;
  amount: string | number;
  currency: Currency;
  notes: string;
  applicant: string;
  approver: string;
  approverChecked: boolean;
  ap: string;
  apChecked: boolean;
  ar: string;
  arChecked: boolean;
  attachment: AttachFile[];
  _fromDb?: boolean;
  _editing?: boolean;
  _backup?: any;
  _deletable?: boolean;
  _uploaded_file_id?: string | number;
  _localFile?: File | null;
}

interface AttachFile {
  name: string;
  url: string;
  status: 'ready' | 'success';
  file_id?: string | number;
}

interface UserOption {
  account_name: string;
  department: string;
  restriction: number | null;
}

interface Props {
  serviceType?: 'marine' | 'truck';
  cb_marine_id?: string;
  logistic_marine_id?: string;
  wms_marine_id?: string;
  truck_cb_id?: string;
  truck_logistic_id?: string;
  truck_us_ca_id?: string;
  task_id?: number | string;
  container_number?: string;
  container_options?: string[];
  locked?: boolean;
  onLoadList?: () => void;
}

function getAuthUser() {
  try {
    const raw = sessionStorage.getItem('authUser');
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function fromNumCurrency(n: number | null | undefined): Currency {
  return n === 1 ? 'USD' : n === 2 ? 'CAD' : '';
}
function toNumCurrency(s: string): number {
  return s === 'USD' ? 1 : s === 'CAD' ? 2 : 0;
}

function normalizeContainer(v: any): string {
  return String(v ?? '').trim().toUpperCase();
}
function norm(s: any): string {
  return String(s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}
function moneyText(amount: any, currency: any): string {
  const hasAmt = amount !== '' && amount !== null && amount !== undefined;
  const cur = String(currency ?? '').trim();
  if (!hasAmt && !cur) return '—';
  return `${hasAmt ? amount : '—'}${cur ? ` ${cur}` : ''}`;
}

function makeKey(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function makeEmpty(defaultContainer: string, username: string): BillRow {
  return {
    container_number: defaultContainer,
    type: '',
    amount: '',
    currency: '',
    notes: '',
    applicant: username,
    approver: '',
    approverChecked: false,
    ap: '',
    apChecked: false,
    ar: '',
    arChecked: false,
    attachment: [],
    _fromDb: false,
    _editing: true,
    _deletable: false,
    _uploaded_file_id: '',
    _localFile: null,
  };
}

const PIN_SESSION_KEY = 'dailyPinOverride';

export default function PartiallyRepaySection({
  serviceType = 'marine',
  cb_marine_id,
  logistic_marine_id,
  wms_marine_id,
  truck_cb_id,
  truck_logistic_id,
  truck_us_ca_id,
  task_id,
  container_number,
  container_options = [],
  locked = false,
  onLoadList,
}: Props) {
  const { tt } = useTT();
  const authUser = useMemo(() => getAuthUser(), []);
  const userName: string = authUser?.account_name || authUser?.user_name || '';
  const userRestriction: number = Number(authUser?.restriction ?? 0);
  const userDept: string = String(authUser?.department ?? '').toLowerCase();

  const defaultContainer = useMemo(() => normalizeContainer(container_number), [container_number]);

  const normalizedOptions = useMemo<string[]>(() => {
    const raw = Array.isArray(container_options) ? container_options : [];
    const merged = [...raw.map(normalizeContainer), defaultContainer].filter(Boolean);
    return Array.from(new Set(merged));
  }, [container_options, defaultContainer]);

  const normalizedOptionsKey = normalizedOptions.join(',');
  const loadReqSeq = useRef(0);

  const [rows, setRows] = useState<BillRow[]>(() => [makeEmpty(defaultContainer, userName)]);
  const [submitting, setSubmitting] = useState(false);
  const [pinOverride, setPinOverride] = useState(false);
  const [approverList, setApproverList] = useState<UserOption[]>([]);
  const [financeUserList, setFinanceUserList] = useState<UserOption[]>([]);
  const [dhUserList, setDhUserList] = useState<UserOption[]>([]);

  const allLocked = locked && !pinOverride;
  const hasTaskId = !!task_id;

  useEffect(() => {
    const todayKey = `ok-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(PIN_SESSION_KEY) === todayKey) setPinOverride(true);
  }, []);

  const fetchUserLists = useCallback(async () => {
    try {
      const [logRes, finRes, dhRes] = await Promise.allSettled([
        fetch(buildApiUrl(GET_SPECIFIC_USER), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: 'Logistic' }),
        }).then((r) => r.json()),
        fetch(buildApiUrl(GET_SPECIFIC_USER), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: 'Finance' }),
        }).then((r) => r.json()),
        fetch(buildApiUrl(GET_SPECIFIC_USER), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: 'DH' }),
        }).then((r) => r.json()),
      ]);

      const toArr = (res: PromiseSettledResult<any>) =>
        res.status === 'fulfilled'
          ? Array.isArray(res.value)
            ? res.value
            : Array.isArray(res.value?.data)
            ? res.value.data
            : []
          : [];

      const logArr: UserOption[] = toArr(logRes);
      const finArr: UserOption[] = toArr(finRes);
      const dhArr: UserOption[] = toArr(dhRes);

      setApproverList(
        logArr.filter(
          (u) => u.department === 'Logistic' && [1, 3].includes(Number(u.restriction))
        )
      );
      setFinanceUserList(finArr);
      setDhUserList(dhArr);
    } catch {
      /* ignore */
    }
  }, []);

  const isDhAdmin = useMemo(() => {
    const me = norm(userName);
    return dhUserList.some(
      (u) =>
        norm(u.account_name) === me &&
        (String(u.department ?? '').toUpperCase() === 'DH' || u.department === '8') &&
        Number(u.restriction) === 8
    );
  }, [userName, dhUserList]);

  const canEditApproval = useCallback(() => {
    if (allLocked) return false;
    const isR1 = userRestriction === 1;
    const isLogisticR3 = userDept === 'logistic' && userRestriction === 3;
    const logisticApprover = approverList.some((u) => norm(u.account_name) === norm(userName));
    return isDhAdmin || isR1 || isLogisticR3 || logisticApprover;
  }, [allLocked, userRestriction, userDept, approverList, userName, isDhAdmin]);

  const canEditAp = useCallback(() => {
    if (allLocked) return false;
    return financeUserList.some((u) => norm(u.account_name) === norm(userName));
  }, [allLocked, financeUserList, userName]);

  const canEditAr = useCallback(() => {
    if (allLocked) return false;
    return financeUserList.some((u) => norm(u.account_name) === norm(userName));
  }, [allLocked, financeUserList, userName]);

  const buildFeeBody = useCallback(
    (row: BillRow, values: any) => {
      const identity = {
        task_id: Number(task_id),
        container_number: normalizeContainer(row.container_number),
      };
      return {
        ...identity,
        ...(row.id ? { id: row.id, matchOn: ['id'] } : { matchOn: ['container_number', 'charge_types'] }),
        values,
      };
    },
    [task_id]
  );

  const upsertFee = useCallback(
    async (row: BillRow, values: any) => {
      if (!task_id || !row.container_number) return null;
      const url = buildApiUrl(INVOICE_FEE_INSERT_URL);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFeeBody(row, values)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);
      if (data?.id) {
        setRows((prev) =>
          prev.map((r) => (r === row ? { ...r, id: Number(data.id) } : r))
        );
      }
      return data;
    },
    [task_id, buildFeeBody]
  );

  const loadRows = useCallback(async () => {
    const seq = ++loadReqSeq.current;
    if (!hasTaskId) {
      setRows([makeEmpty(defaultContainer, userName)]);
      return;
    }
    // Container list for this section hasn't resolved yet — wait rather than
    // fetching with no container filter, which would return every fee row for
    // this task_id, including ones belonging to unrelated containers/services.
    if (!normalizedOptionsKey) return;
    const validContainers = new Set(normalizedOptionsKey.split(','));
    try {
      const url = buildApiUrl(INVOICE_FEE_RETRIEVE_URL);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: Number(task_id),
          container_numbers: Array.from(validContainers),
          page: 1,
          pageSize: 500,
          orderBy: 'id',
          orderDir: 'DESC',
        }),
      });
      const data = await res.json();
      if (seq !== loadReqSeq.current) return;
      const fetched = (Array.isArray(data?.data) ? data.data : [])
        .filter((r: any) => validContainers.has(normalizeContainer(r.container_number ?? '')));
      if (!fetched.length) {
        setRows([makeEmpty(defaultContainer, userName)]);
        return;
      }
      setRows(
        fetched.map((r: any) => ({
          id: r.id,
          container_number: normalizeContainer(r.container_number ?? defaultContainer),
          type: r.charge_types || '',
          amount: r.rate ?? '',
          currency: fromNumCurrency(r.rate_currency),
          notes: r.note || '',
          applicant: r.applicant || userName,
          approver: r.approver || '',
          approverChecked: !!r.approver,
          ap: r.ap || '',
          apChecked: !!r.ap,
          ar: r.ar || '',
          arChecked: !!r.ar,
          attachment: [],
          _fromDb: true,
          _editing: false,
          _deletable: false,
          _uploaded_file_id: '',
          _localFile: null,
        }))
      );
    } catch {
      if (seq !== loadReqSeq.current) return;
      setRows([makeEmpty(defaultContainer, userName)]);
    }
  }, [hasTaskId, task_id, defaultContainer, userName, normalizedOptionsKey]);

  const fetchAttachments = useCallback(async () => {
    if (!hasTaskId) return;
    try {
      const body: any = {};
      if (serviceType === 'truck') {
        if (truck_cb_id) { body.truck_cb_id = truck_cb_id; body.truck_cb_ids = truck_cb_id; }
        if (truck_logistic_id) { body.truck_logistic_id = truck_logistic_id; body.truck_logistic_ids = truck_logistic_id; }
        if (truck_us_ca_id) { body.truck_us_ca_id = truck_us_ca_id; body.truck_us_ca_ids = truck_us_ca_id; }
      } else {
        if (cb_marine_id) { body.cb_marine_id = cb_marine_id; body.cb_marine_ids = cb_marine_id; }
        if (logistic_marine_id) { body.logistic_marine_id = logistic_marine_id; body.logistic_marine_ids = logistic_marine_id; }
        if (wms_marine_id) { body.wms_marine_id = wms_marine_id; body.wms_marine_ids = wms_marine_id; }
      }
      if (!Object.keys(body).length) return;
      const files = await retrieveFilesApi(body);
      const fileList: any[] = Array.isArray(files?.data) ? files.data : Array.isArray(files) ? files : [];

      setRows((prev) =>
        prev.map((row) => {
          if (!row.type || !row.container_number) return row;
          const contNeed = normalizeContainer(row.container_number);
          const typeNeed = norm(row.type);
          const match = fileList.find((f) => {
            let sub: any = f.sub_category ?? f.sub_categories ?? {};
            if (typeof sub === 'string') { try { sub = JSON.parse(sub); } catch { sub = {}; } }
            const ft = norm(sub?.type || '');
            const fc = normalizeContainer(f.container_number || sub?.container_number || '');
            return (ft === typeNeed) && (fc === contNeed);
          });
          if (!match) return { ...row, attachment: [] };
          const fileId = match.file_id || match.id || '';
          return {
            ...row,
            attachment: [{
              name: match.original_file_name || match.name || 'attachment',
              url: match.file_url || match.url || '',
              status: 'success' as const,
              file_id: fileId,
            }],
            _uploaded_file_id: fileId,
          };
        })
      );
    } catch {
      /* ignore */
    }
  }, [hasTaskId, serviceType, cb_marine_id, logistic_marine_id, wms_marine_id, truck_cb_id, truck_logistic_id, truck_us_ca_id]);

  useEffect(() => {
    fetchUserLists();
  }, [fetchUserLists]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const tryUnlock = useCallback(async () => {
    const pin = window.prompt('Enter today\'s 4-digit security PIN:');
    if (!pin) return;
    try {
      const url = buildApiUrl(GET_DAILY_PIN);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const serverPin = String(data?.pin ?? data?.data?.pin ?? '');
      if (serverPin && pin.trim() === serverPin.trim()) {
        const todayKey = `ok-${new Date().toISOString().slice(0, 10)}`;
        sessionStorage.setItem(PIN_SESSION_KEY, todayKey);
        setPinOverride(true);
        toast.success(tt('paymentApproval.toast.unlocked'));
      } else {
        toast.error(tt('paymentApproval.toast.incorrectPin'));
      }
    } catch {
      toast.error(tt('paymentApproval.toast.pinFailed'));
    }
  }, [tt]);

  const updateRow = useCallback((idx: number, patch: Partial<BillRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const startEdit = useCallback((idx: number) => {
    if (allLocked) { toast.warning(tt('paymentApproval.toast.locked')); return; }
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, _editing: true, _backup: JSON.parse(JSON.stringify({ ...r, _backup: undefined })) } : r))
    );
  }, [allLocked, tt]);

  const cancelEdit = useCallback((idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (r._backup) return { ...r._backup, _editing: false, _backup: undefined };
        return { ...r, _editing: false };
      })
    );
  }, []);

  const addRow = useCallback(() => {
    if (allLocked) { toast.warning(tt('paymentApproval.toast.locked')); return; }
    setRows((prev) => [...prev, { ...makeEmpty(defaultContainer, userName), _deletable: true }]);
  }, [allLocked, defaultContainer, userName, tt]);

  const removeRow = useCallback((idx: number) => {
    if (allLocked) { toast.warning(tt('paymentApproval.toast.locked')); return; }
    setRows((prev) => {
      if (!prev[idx]?._deletable) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, [allLocked, tt]);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleApproverCheck = useCallback(
    async (idx: number, checked: boolean) => {
      if (!canEditApproval()) { toast.warning(tt('paymentApproval.toast.noPermissionApprove')); return; }
      if (!task_id || !rows[idx]?.container_number) { toast.warning(tt('paymentApproval.toast.selectContainer')); return; }
      const row = rows[idx];
      if (!checked && row.approver) { toast.info(tt('paymentApproval.toast.approverLocked')); return; }
      const newApprover = checked ? userName : '';
      updateRow(idx, { approver: newApprover, approverChecked: checked });
      try {
        await upsertFee({ ...row, approver: newApprover }, { charge_types: row.type, approver: newApprover });
      } catch {
        updateRow(idx, { approver: row.approver, approverChecked: row.approverChecked });
        toast.error(tt('paymentApproval.toast.saveApproverFailed'));
      }
    },
    [canEditApproval, task_id, rows, userName, updateRow, upsertFee, tt]
  );

  const handleApCheck = useCallback(
    async (idx: number, checked: boolean) => {
      if (!canEditAp()) { toast.warning(tt('paymentApproval.toast.noPermissionAp')); return; }
      if (!task_id || !rows[idx]?.container_number) { toast.warning(tt('paymentApproval.toast.selectContainer')); return; }
      const row = rows[idx];
      if (!checked && row.ap) { toast.info(tt('paymentApproval.toast.apLocked')); return; }
      const newAp = checked ? userName : '';
      updateRow(idx, { ap: newAp, apChecked: checked });
      try {
        await upsertFee({ ...row, ap: newAp }, { charge_types: row.type, ap: newAp });
      } catch {
        updateRow(idx, { ap: row.ap, apChecked: row.apChecked });
        toast.error(tt('paymentApproval.toast.saveApFailed'));
      }
    },
    [canEditAp, task_id, rows, userName, updateRow, upsertFee, tt]
  );

  const handleArCheck = useCallback(
    async (idx: number, checked: boolean) => {
      if (!canEditAr()) { toast.warning(tt('paymentApproval.toast.noPermissionAr')); return; }
      if (!task_id || !rows[idx]?.container_number) { toast.warning(tt('paymentApproval.toast.selectContainer')); return; }
      const row = rows[idx];
      if (!checked && row.ar) { toast.info(tt('paymentApproval.toast.arLocked')); return; }
      const newAr = checked ? userName : '';
      updateRow(idx, { ar: newAr, arChecked: checked });
      try {
        await upsertFee({ ...row, ar: newAr }, { charge_types: row.type, ar: newAr });
      } catch {
        updateRow(idx, { ar: row.ar, arChecked: row.arChecked });
        toast.error(tt('paymentApproval.toast.saveArFailed'));
      }
    },
    [canEditAr, task_id, rows, userName, updateRow, upsertFee, tt]
  );

  const handleFileChange = useCallback(
    (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      updateRow(idx, {
        _localFile: file,
        attachment: [{ name: file.name, url: URL.createObjectURL(file), status: 'ready' }],
      });
    },
    [updateRow]
  );

  const uploadRowAttachment = useCallback(
    async (row: BillRow): Promise<string | number | ''> => {
      if (!row._localFile) return row._uploaded_file_id ?? '';
      const updates = row._uploaded_file_id
        ? [{ file_id: String(row._uploaded_file_id), status: 3 }]
        : undefined;
      const subCategories = { type: row.type || 'Other', value: row._localFile.name, container_number: normalizeContainer(row.container_number) };
      let res: any;
      if (serviceType === 'truck') {
        res = await uploadTruckFilesApi({
          files: [row._localFile],
          sub_categories: subCategories,
          updates,
          truck_cb_ids: truck_cb_id ?? undefined,
          truck_logistic_ids: truck_logistic_id ?? undefined,
          truck_us_ca_ids: truck_us_ca_id ?? undefined,
        });
      } else {
        res = await uploadMarineAndAirFilesApi({
          files: [row._localFile],
          sub_categories: subCategories,
          updates,
          cb_marine_ids: cb_marine_id ?? undefined,
          logistic_marine_ids: logistic_marine_id ?? undefined,
          wms_marine_ids: wms_marine_id ?? undefined,
        });
      }
      return res?.uploadedFiles?.[0]?.file_id || res?.data?.[0]?.file_id || '';
    },
    [serviceType, cb_marine_id, logistic_marine_id, wms_marine_id, truck_cb_id, truck_logistic_id, truck_us_ca_id]
  );

  const handleSubmit = useCallback(async () => {
    if (allLocked) { toast.warning(tt('paymentApproval.toast.locked')); return; }
    if (!hasTaskId) { toast.error(tt('paymentApproval.toast.noTaskId')); return; }
    if (rows.some((r) => !normalizeContainer(r.container_number))) {
      toast.warning(tt('paymentApproval.toast.requireContainer'));
      return;
    }
    if (rows.some((r) => !r.type || r.amount === '' || !r.currency)) {
      toast.warning(tt('paymentApproval.toast.requireFields'));
      return;
    }

    setSubmitting(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let uploadedId = row._uploaded_file_id;
        if (row._localFile && !row.approver) {
          try { uploadedId = await uploadRowAttachment(row); } catch {
            toast.error(tt('paymentApproval.toast.rowFileUploadFailed').replace('{n}', String(i + 1)));
            return;
          }
        }
        const values: any = {
          container_number: normalizeContainer(row.container_number),
          charge_types: row.type,
          rate: row.amount === '' ? null : Number(row.amount),
          rate_currency: toNumCurrency(row.currency || ''),
          note: row.notes || '',
          applicant: row.applicant || userName,
          approver: row.approver || '',
          ap: row.ap || '',
          ar: row.ar || '',
        };
        try {
          await upsertFee(row, values);
        } catch (e: any) {
          toast.error(e?.message || tt('paymentApproval.toast.rowSaveFailed').replace('{n}', String(i + 1)));
          return;
        }
      }
      await loadRows();
      await fetchAttachments();
      onLoadList?.();
      toast.success(tt('paymentApproval.toast.success'));
    } catch (e: any) {
      toast.error(e?.message || tt('paymentApproval.toast.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [allLocked, hasTaskId, rows, userName, upsertFee, uploadRowAttachment, loadRows, fetchAttachments, onLoadList, tt]);

  return (
    <Card className="md-section" style={{ marginTop: 16 }}>
      <div className="md-sectionHead d-flex justify-content-between align-items-center p-3" style={{ borderBottom: '1px solid #eee' }}>
        <span className="md-sectionHead__title">{tt('paymentApproval.title')}</span>
        {allLocked && (
          <div className="d-flex gap-2 align-items-center">
            <Badge color="danger">{tt('paymentApproval.locked')}</Badge>
            <Button size="sm" color="primary" outline onClick={tryUnlock}>{tt('paymentApproval.unlockPin')}</Button>
          </div>
        )}
      </div>
      <CardBody>
        <div className="d-flex flex-wrap gap-2 mb-3 fee-section__info">
          <strong>{tt('paymentApproval.defaultContainer')}:</strong>
          {defaultContainer
            ? <span className="badge bg-light text-dark border px-2 py-1">{defaultContainer}</span>
            : <span className="text-muted">{tt('paymentApproval.noContainer')}</span>}
          <strong className="ms-2">{tt('paymentApproval.available')}:</strong>
          {normalizedOptions.map((c) => (
            <span key={c} className="badge bg-light text-dark border px-2 py-1">{c}</span>
          ))}
        </div>

        <div className="fee-section__scroll">
          <table className="table table-bordered table-sm fee-section__table pay-table">
            <thead className="table-light">
              <tr>
                <th className="fc-160">{tt('paymentApproval.col.containerNumber')}</th>
                <th className="fc-180">{tt('paymentApproval.col.billTypes')}</th>
                <th className="fc-120">{tt('paymentApproval.col.amount')}</th>
                <th className="fc-100">{tt('paymentApproval.col.currency')}</th>
                <th className="fc-240">{tt('paymentApproval.col.attachment')}</th>
                <th className="fc-200">{tt('paymentApproval.col.notes')}</th>
                <th className="fc-130">{tt('paymentApproval.col.applicant')}</th>
                <th className="fc-90">{tt('paymentApproval.col.approver')}</th>
                <th className="fc-130">{tt('paymentApproval.col.approverName')}</th>
                <th className="fc-70">{tt('paymentApproval.col.ap')}</th>
                <th className="fc-110">{tt('paymentApproval.col.apName')}</th>
                <th className="fc-70">{tt('paymentApproval.col.ar')}</th>
                <th className="fc-110">{tt('paymentApproval.col.arName')}</th>
                <th className="fc-180">{tt('paymentApproval.col.operation')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={row._editing ? 'fee-section__row--editing' : 'fee-section__row--default'}>
                  {/* Container Number */}
                  <td>
                    {row._editing ? (
                      <Input type="select" bsSize="sm" value={row.container_number} disabled={allLocked}
                        onChange={(e) => updateRow(idx, { container_number: e.target.value })}>
                        <option value="">{tt('paymentApproval.select')}</option>
                        {normalizedOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Input>
                    ) : (
                      row.container_number
                        ? <span className="badge bg-light text-dark border">{row.container_number}</span>
                        : <span className="text-muted">{tt('paymentApproval.noContainer')}</span>
                    )}
                  </td>

                  {/* Types of Bills */}
                  <td>
                    {row._editing ? (
                      <Select
                        isDisabled={allLocked || !!row.approver}
                        isClearable
                        isSearchable
                        className="rs-sm"
                        classNamePrefix="rs"
                        options={BILL_TYPES.map((t) => ({ value: t, label: t }))}
                        value={row.type ? { value: row.type, label: row.type } : null}
                        onChange={(opt: any) => updateRow(idx, { type: opt ? opt.value : '' })}
                        placeholder={tt('paymentApproval.select')}
                        menuPortalTarget={document.body}
                        styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
                      />
                    ) : (
                      row.type
                        ? <span className="badge bg-secondary">{row.type}</span>
                        : <span className="text-muted">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td>
                    {row._editing ? (
                      <Input bsSize="sm" type="number" value={String(row.amount)} disabled={allLocked || !!row.approver}
                        onChange={(e) => updateRow(idx, { amount: e.target.value })} />
                    ) : (
                      <span className="fee-section__amount">{moneyText(row.amount, row.currency)}</span>
                    )}
                  </td>

                  {/* Currency */}
                  <td>
                    {row._editing ? (
                      <Input type="select" bsSize="sm" value={row.currency} disabled={allLocked || !!row.approver}
                        onChange={(e) => updateRow(idx, { currency: e.target.value as Currency })}>
                        <option value="">—</option>
                        <option value="USD">USD</option>
                        <option value="CAD">CAD</option>
                      </Input>
                    ) : (
                      row.currency
                        ? <span className="badge bg-light text-dark border">{row.currency}</span>
                        : <span className="text-muted">—</span>
                    )}
                  </td>

                  {/* Attachment */}
                  <td>
                    {row._editing ? (
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,image/*"
                          className="d-none"
                          ref={(el) => { fileInputRefs.current[idx] = el; }}
                          onChange={(e) => handleFileChange(idx, e)}
                        />
                        <Button size="sm" outline disabled={allLocked || !!row.approver}
                          onClick={() => fileInputRefs.current[idx]?.click()}>
                          {tt('paymentApproval.chooseFile')}
                        </Button>
                        {row.attachment[0] && (
                          <span>
                            {row.attachment[0].status === 'ready' ? (
                              <>
                                <a href="#" onClick={(e) => { e.preventDefault(); openPreview(row.attachment[0].url); }}>
                                  {row.attachment[0].name}
                                </a>
                                {!row.approver && (
                                  <button type="button" className="btn-close btn-close-sm ms-1 fee-section__close"
                                    onClick={() => updateRow(idx, { attachment: [], _localFile: null })} />
                                )}
                              </>
                            ) : (
                              <span className="text-muted">{tt('paymentApproval.uploaded')}</span>
                            )}
                          </span>
                        )}
                      </div>
                    ) : (
                      row.attachment[0] ? (
                        <div className="d-flex align-items-center gap-2">
                          <a href="#" className="fee-section__link" onClick={(e) => { e.preventDefault(); openPreview(row.attachment[0].url); }}>
                            {row.attachment[0].name || tt('actions.viewFile')}
                          </a>
                          <span className="badge bg-success">{tt('paymentApproval.uploaded')}</span>
                        </div>
                      ) : (
                        <span className="text-muted">{tt('paymentApproval.noAttachment')}</span>
                      )
                    )}
                  </td>

                  {/* Notes */}
                  <td>
                    {row._editing ? (
                      <Input bsSize="sm" value={row.notes} disabled={allLocked}
                        onChange={(e) => updateRow(idx, { notes: e.target.value })} />
                    ) : (
                      <span title={row.notes || undefined} className={`fee-section__notes${row.notes ? ' fee-section__notes--help' : ''}`}>
                        {row.notes || tt('paymentApproval.noNotes')}
                      </span>
                    )}
                  </td>

                  {/* Applicant */}
                  <td><span className="fee-section__amount">{row.applicant || '—'}</span></td>

                  {/* Approver checkbox */}
                  <td className="text-center">
                    {row._editing ? (
                      <input type="checkbox" checked={row.approverChecked}
                        disabled={!canEditApproval() || row.approverChecked || allLocked}
                        onChange={(e) => handleApproverCheck(idx, e.target.checked)} />
                    ) : (
                      <span className={`badge ${row.approverChecked ? 'bg-success' : 'bg-secondary'}`}>
                        {row.approverChecked ? tt('common.yes') : tt('common.no')}
                      </span>
                    )}
                  </td>

                  {/* Approver Name */}
                  <td><span>{row.approver || (!row.approverChecked ? tt('paymentApproval.notRecorded') : tt('paymentApproval.recorded'))}</span></td>

                  {/* AP checkbox */}
                  <td className="text-center">
                    {row._editing ? (
                      <input type="checkbox" checked={row.apChecked}
                        disabled={!canEditAp() || row.apChecked || allLocked}
                        onChange={(e) => handleApCheck(idx, e.target.checked)} />
                    ) : (
                      <span className={`badge ${row.apChecked ? 'bg-success' : 'bg-secondary'}`}>
                        {row.apChecked ? tt('common.yes') : tt('common.no')}
                      </span>
                    )}
                  </td>

                  {/* AP Name */}
                  <td><span>{row.ap || (!row.apChecked ? tt('paymentApproval.notRecorded') : tt('paymentApproval.recorded'))}</span></td>

                  {/* AR checkbox */}
                  <td className="text-center">
                    {row._editing ? (
                      <input type="checkbox" checked={row.arChecked}
                        disabled={!canEditAr() || row.arChecked || allLocked}
                        onChange={(e) => handleArCheck(idx, e.target.checked)} />
                    ) : (
                      <span className={`badge ${row.arChecked ? 'bg-success' : 'bg-secondary'}`}>
                        {row.arChecked ? tt('common.yes') : tt('common.no')}
                      </span>
                    )}
                  </td>

                  {/* AR Name */}
                  <td><span>{row.ar || (!row.arChecked ? tt('paymentApproval.notRecorded') : tt('paymentApproval.recorded'))}</span></td>

                  {/* Operation */}
                  <td>
                    <div className="d-flex gap-1 flex-wrap">
                      {row._deletable && row._editing && (
                        <Button size="sm" color="danger" disabled={allLocked} onClick={() => removeRow(idx)}>{tt('common.delete')}</Button>
                      )}
                      {!row._editing ? (
                        <Button size="sm" outline disabled={allLocked} onClick={() => startEdit(idx)}>{tt('common.edit')}</Button>
                      ) : (
                        <Button size="sm" color="warning" onClick={() => cancelEdit(idx)}>{tt('common.cancel')}</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button color="primary" outline size="sm" className="mb-3" disabled={allLocked || !hasTaskId} onClick={addRow}>
          {tt('paymentApproval.addRow')}
        </Button>

        <hr />

        <Button color="success" disabled={allLocked || !hasTaskId || submitting} onClick={handleSubmit} className="fee-section__submit">
          {submitting ? <Spinner size="sm" className="me-1" /> : null}
          {tt('paymentApproval.submitAll')}
        </Button>
      </CardBody>
    </Card>
  );
}
