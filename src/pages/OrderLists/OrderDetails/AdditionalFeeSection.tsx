import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import { Button, Input, Spinner, Badge, Card, CardBody } from 'reactstrap';
import { toast } from 'react-toastify';
import { buildApiUrl } from '../../../helpers/apiBase';
import { uploadMarineAndAirFilesApi, uploadTruckFilesApi, retrieveFilesApi } from '../../../helpers/api_fetch/files';
import { openPreview } from '../../../helpers/filePreview';
import { GET_SPECIFIC_USER, GET_DAILY_PIN } from '../../../helpers/url_helper';
import { useTT } from '../../../helpers/useTT';

const MARINE_CHARGE_TYPES = [
  'Title Fee',
  'Handling Fee',
  'Handling Fee 1',
  'Handling Fee 2',
  'Rail/Port Storage Admin Fee',
  'Demurrage/Detention Admin Fee',
  'Admin Fee',
  'High Value',
  'Ocean Freight',
  'Emanifest Fee',
  'CBSA Uploading Fee',
  'ISF5/ISF10',
  'ERS Application Fee',
  'Exam Handling Fee',
  'Drayage Fee',
  'Bond Agent Fee',
  'Prepull/Extra Stop',
  'CARM Register Fee',
  'Waiting Time Fee',
  'Terminal Waiting Fee',
  'NRI Application Fee',
  'Chassis Rental',
  'Local Company Registration Fee',
  'Yard Storage',
  'CFIA Application Fee',
  'Dead Run',
  'Other Brokerage Service',
  'Trucking and Loading',
  'Other Drayage Charges',
];

const TRUCK_CHARGE_TYPES = [
  'Tailgate Fee',
  'Waiting Fee',
  'Dead Run Fee',
  'Inbond Fee',
  'Outbond Fee',
  'House Fee',
  'DG Fee',
  'Admin Fee',
  'Truck Fee',
  'Bond Fee',
];

const AUTO_COST_TYPES = ['admin fee', 'handling fee'];

const ADDITIONAL_FEE_INSERT_URL = '/finance/insertAdditionalFee';
const ADDITIONAL_FEE_RETRIEVE_URL = '/finance/retrieveAdditionalFee';

type Currency = 'USD' | 'CAD' | '';

interface BillRow {
  id?: number;
  container_number: string;
  charge_types: string;
  quantity: number | '';
  rate: number | '';
  rate_currency_str: Currency;
  left_notes: string;
  cost_amount: number | '';
  cost_currency_str: Currency;
  vender: string;
  invoice_number: string;
  right_notes: string;
  applicant: string;
  approver: string;
  approverChecked: boolean;
  ap: string;
  apChecked: boolean;
  ar: string;
  arChecked: boolean;
  status: 0 | 1;
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

const ADMIN_FEE_USER_ID = '20251224013128303912';

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
  user_id?: string | number;
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

function isAutoCostType(v: string): boolean {
  return AUTO_COST_TYPES.includes(norm(v));
}

function applyAutoCostFields(row: BillRow): BillRow {
  if (!isAutoCostType(row.charge_types)) return row;
  return { ...row, cost_amount: 0, cost_currency_str: 'CAD', vender: 'DH', invoice_number: '000' };
}

function makeEmpty(defaultContainer: string, userName: string): BillRow {
  return {
    container_number: defaultContainer,
    charge_types: '',
    quantity: '',
    rate: '',
    rate_currency_str: '',
    left_notes: '',
    cost_amount: '',
    cost_currency_str: '',
    vender: '',
    invoice_number: '',
    right_notes: '',
    applicant: userName,
    approver: '',
    approverChecked: false,
    ap: '',
    apChecked: false,
    ar: '',
    arChecked: false,
    status: 0,
    attachment: [],
    _fromDb: false,
    _editing: true,
    _deletable: false,
    _uploaded_file_id: '',
    _localFile: null,
  };
}

const PIN_SESSION_KEY = 'dailyPinOverride';

export default function AdditionalFeeSection({
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
  user_id,
}: Props) {
  const { tt } = useTT();
  const authUser = useMemo(() => getAuthUser(), []);
  const userName: string = authUser?.account_name || authUser?.user_name || '';
  const userRestriction: number = Number(authUser?.restriction ?? 0);

  const chargeTypes = serviceType === 'truck' ? TRUCK_CHARGE_TYPES : MARINE_CHARGE_TYPES;

  const defaultContainer = useMemo(() => normalizeContainer(container_number), [container_number]);

  const normalizedOptions = useMemo<string[]>(() => {
    const raw = Array.isArray(container_options) ? container_options : [];
    const merged = [...raw.map(normalizeContainer), defaultContainer].filter(Boolean);
    return Array.from(new Set(merged));
  }, [container_options, defaultContainer]);

  const normalizedOptionsKey = normalizedOptions.join(',');
  const loadReqSeq = useRef(0);

  const [rows, setRows] = useState<BillRow[]>(() => [makeEmpty(defaultContainer, userName)]);
  const [allEditing, setAllEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pinOverride, setPinOverride] = useState(false);
  const [approverList, setApproverList] = useState<UserOption[]>([]);
  const [financeUserList, setFinanceUserList] = useState<UserOption[]>([]);
  const [profitRate, setProfitRate] = useState<number | null>(null);

  const allLocked = locked && !pinOverride;
  const hasTaskId = !!task_id;

  useEffect(() => {
    const todayKey = `ok-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(PIN_SESSION_KEY) === todayKey) setPinOverride(true);
  }, []);

  const fetchUserLists = useCallback(async () => {
    try {
      const [logRes, finRes] = await Promise.allSettled([
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

      setApproverList(
        logArr.filter(
          (u) => u.department === 'Logistic' && Number(u.restriction) === 3
        )
      );
      setFinanceUserList(finArr);
    } catch {
      /* ignore */
    }
  }, []);

  const canEditApproval = useCallback(() => {
    if (allLocked) return false;
    if (userRestriction === 1) return true;
    return approverList.some(
      (u) => u.account_name === userName && u.department === 'Logistic' && Number(u.restriction) === 3
    );
  }, [allLocked, userRestriction, approverList, userName]);

  const canEditAp = useCallback(() => {
    if (allLocked) return false;
    return financeUserList.some((u) => u.account_name === userName);
  }, [allLocked, financeUserList, userName]);

  const canEditAr = useCallback(() => {
    if (allLocked) return false;
    return financeUserList.some((u) => u.account_name === userName);
  }, [allLocked, financeUserList, userName]);

  const buildFeePayload = useCallback(
    (row: BillRow, values: any) => ({
      task_id: Number(task_id),
      container_number: normalizeContainer(row.container_number),
      ...(row.id ? { id: row.id, matchOn: ['id'] } : {}),
      values,
    }),
    [task_id]
  );

  const upsertFee = useCallback(
    async (row: BillRow, values: any) => {
      if (!task_id || !row.container_number) return null;
      const url = buildApiUrl(ADDITIONAL_FEE_INSERT_URL);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFeePayload(row, values)),
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
    [task_id, buildFeePayload]
  );

  const loadRows = useCallback(async () => {
    const seq = ++loadReqSeq.current;
    if (!hasTaskId) {
      setRows([makeEmpty(defaultContainer, userName)]);
      setProfitRate(null);
      return;
    }
    // Container list for this section hasn't resolved yet — wait rather than
    // fetching with no container filter, which would return every fee row for
    // this task_id, including ones belonging to unrelated containers/services.
    if (!normalizedOptionsKey) return;
    const validContainers = new Set(normalizedOptionsKey.split(','));
    try {
      const url = buildApiUrl(ADDITIONAL_FEE_RETRIEVE_URL);
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
      setProfitRate(
        data?.profit_rate !== undefined && data?.profit_rate !== null
          ? Number(data.profit_rate)
          : null
      );
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
          charge_types: r.charge_types || '',
          quantity: r.quantity ?? '',
          rate: r.rate ?? '',
          rate_currency_str: fromNumCurrency(r.rate_currency),
          left_notes: r.note || '',
          cost_amount: r.cost_amount ?? '',
          cost_currency_str: fromNumCurrency(r.cost_currency),
          vender: r.vender || '',
          invoice_number: r.invoice_number || '',
          right_notes: r.cost_note || '',
          applicant: r.applicant || userName,
          approver: r.approver || '',
          approverChecked: !!r.approver,
          ap: r.ap || '',
          apChecked: !!r.ap,
          ar: r.ar || '',
          arChecked: !!r.ar,
          status: r.status === 1 ? 1 : 0,
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
      setProfitRate(null);
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
          if (!row.charge_types || !row.container_number) return row;
          const contNeed = normalizeContainer(row.container_number);
          const typeNeed = norm(row.charge_types);
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

  useEffect(() => { fetchUserLists(); }, [fetchUserLists]);
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

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
        toast.success(tt('tollFee.toast.unlocked'));
      } else {
        toast.error(tt('tollFee.toast.incorrectPin'));
      }
    } catch {
      toast.error(tt('tollFee.toast.pinFailed'));
    }
  }, [tt]);

  const updateRow = useCallback((idx: number, patch: Partial<BillRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const startEditAll = useCallback(() => {
    if (allLocked) { toast.warning(tt('tollFee.toast.locked')); return; }
    if (!hasTaskId) return;
    setAllEditing(true);
    setRows((prev) =>
      prev.map((r) => ({ ...r, _editing: true, _backup: JSON.parse(JSON.stringify({ ...r, _backup: undefined })) }))
    );
  }, [allLocked, hasTaskId, tt]);

  const cancelEditAll = useCallback(() => {
    setAllEditing(false);
    setRows((prev) => {
      const restored = prev
        .filter((r) => r._fromDb || r.id)
        .map((r) => {
          if (r._backup) return { ...r._backup, _editing: false, _backup: undefined };
          return { ...r, _editing: false };
        });
      return restored.length ? restored : [makeEmpty(defaultContainer, userName)];
    });
  }, [defaultContainer, userName]);

  const addRow = useCallback(() => {
    if (allLocked) { toast.warning(tt('tollFee.toast.locked')); return; }
    if (!hasTaskId) return;
    setRows((prev) => [...prev, { ...makeEmpty(defaultContainer, userName), _deletable: true }]);
  }, [allLocked, hasTaskId, defaultContainer, userName, tt]);

  const removeRow = useCallback((idx: number) => {
    if (allLocked) { toast.warning(tt('tollFee.toast.locked')); return; }
    setRows((prev) => {
      if (!prev[idx]?._deletable) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, [allLocked, tt]);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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
      const subCat = { type: row.charge_types || 'Other', value: row._localFile.name, container_number: normalizeContainer(row.container_number) };
      let res: any;
      if (serviceType === 'truck') {
        res = await uploadTruckFilesApi({
          files: [row._localFile],
          sub_categories: subCat,
          updates,
          truck_cb_ids: truck_cb_id ?? undefined,
          truck_logistic_ids: truck_logistic_id ?? undefined,
          truck_us_ca_ids: truck_us_ca_id ?? undefined,
        });
      } else {
        res = await uploadMarineAndAirFilesApi({
          files: [row._localFile],
          sub_categories: subCat,
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

  const handleApproverCheck = useCallback(
    async (idx: number, checked: boolean) => {
      if (!canEditApproval()) { toast.warning(tt('tollFee.toast.noPermissionApprove')); return; }
      if (!task_id || !rows[idx]?.container_number) { toast.warning(tt('tollFee.toast.selectContainer')); return; }
      const row = rows[idx];
      if (!checked && row.approver) { toast.info(tt('tollFee.toast.approverLocked')); return; }
      const newApprover = checked ? userName : '';
      updateRow(idx, { approver: newApprover, approverChecked: checked });
      try {
        await upsertFee({ ...row, approver: newApprover }, {
          container_number: normalizeContainer(row.container_number),
          charge_types: row.charge_types,
          invoice_number: row.invoice_number || '',
          vender: row.vender || '',
          approver: newApprover,
        });
      } catch {
        updateRow(idx, { approver: row.approver, approverChecked: row.approverChecked });
        toast.error(tt('tollFee.toast.saveApproverFailed'));
      }
    },
    [canEditApproval, task_id, rows, userName, updateRow, upsertFee, tt]
  );

  const handleApCheck = useCallback(
    async (idx: number, checked: boolean) => {
      if (!canEditAp()) { toast.warning(tt('tollFee.toast.noPermissionAp')); return; }
      if (!task_id || !rows[idx]?.container_number) { toast.warning(tt('tollFee.toast.selectContainer')); return; }
      const row = rows[idx];
      if (!checked && row.ap) { toast.info(tt('tollFee.toast.apLocked')); return; }
      const newAp = checked ? userName : '';
      updateRow(idx, { ap: newAp, apChecked: checked });
      try {
        await upsertFee({ ...row, ap: newAp }, {
          container_number: normalizeContainer(row.container_number),
          charge_types: row.charge_types,
          invoice_number: row.invoice_number || '',
          vender: row.vender || '',
          ap: newAp,
        });
      } catch {
        updateRow(idx, { ap: row.ap, apChecked: row.apChecked });
        toast.error(tt('tollFee.toast.saveApFailed'));
      }
    },
    [canEditAp, task_id, rows, userName, updateRow, upsertFee, tt]
  );

  const handleArCheck = useCallback(
    async (idx: number, checked: boolean) => {
      if (!canEditAr()) { toast.warning(tt('tollFee.toast.noPermissionAr')); return; }
      if (!task_id || !rows[idx]?.container_number) { toast.warning(tt('tollFee.toast.selectContainer')); return; }
      const row = rows[idx];
      if (!checked && row.ar) { toast.info(tt('tollFee.toast.arLocked')); return; }
      const newAr = checked ? userName : '';
      updateRow(idx, { ar: newAr, arChecked: checked });
      try {
        await upsertFee({ ...row, ar: newAr }, {
          container_number: normalizeContainer(row.container_number),
          charge_types: row.charge_types,
          invoice_number: row.invoice_number || '',
          vender: row.vender || '',
          ar: newAr,
        });
      } catch {
        updateRow(idx, { ar: row.ar, arChecked: row.arChecked });
        toast.error(tt('tollFee.toast.saveArFailed'));
      }
    },
    [canEditAr, task_id, rows, userName, updateRow, upsertFee, tt]
  );

  const handleStatusChange = useCallback(
    async (idx: number, newStatus: 0 | 1) => {
      if (allLocked || !hasTaskId) return;
      const row = rows[idx];
      const prev = row.status;
      updateRow(idx, { status: newStatus });
      // In edit mode, defer the API call to Submit so the recalculation uses
      // all updated fields together, not just the stale DB values.
      if (row._editing) return;
      if (!row._fromDb && !row.id) return;
      try {
        await upsertFee(row, {
          container_number: normalizeContainer(row.container_number),
          charge_types: row.charge_types,
          invoice_number: row.invoice_number || '',
          vender: row.vender || '',
          status: Number(newStatus),
        });
      } catch {
        updateRow(idx, { status: prev });
      }
    },
    [allLocked, hasTaskId, rows, updateRow, upsertFee]
  );

  const handleSubmit = useCallback(async () => {
    if (allLocked) { toast.warning(tt('tollFee.toast.locked')); return; }
    if (!hasTaskId) { toast.error(tt('tollFee.toast.noTaskId')); return; }
    if (rows.some((r) => !normalizeContainer(r.container_number))) {
      toast.warning(tt('tollFee.toast.requireContainer'));
      return;
    }
    if (rows.some((r) => !r.charge_types)) {
      toast.warning(tt('tollFee.toast.requireChargeType'));
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hasQty = row.quantity !== '' && row.quantity !== null && row.quantity !== undefined;
      const hasRate = row.rate !== '' && row.rate !== null && row.rate !== undefined;
      const hasRateCur = !!String(row.rate_currency_str || '').trim();
      if (!hasQty || !hasRate || !hasRateCur) {
        toast.warning(tt('tollFee.toast.rowRequireFields').replace('{n}', String(i + 1)));
        return;
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hasCostAmount = row.cost_amount !== '' && row.cost_amount !== null && row.cost_amount !== undefined;
      const hasCostCurrency = !!String(row.cost_currency_str || '').trim();
      const hasVendor = !!String(row.vender || '').trim();
      const hasInvoiceNumber = !!String(row.invoice_number || '').trim();
      const rightHasAny = hasCostAmount || hasCostCurrency || hasVendor || hasInvoiceNumber;
      const rightIsComplete = hasCostAmount && hasCostCurrency && hasVendor && hasInvoiceNumber;
      if (rightHasAny && !rightIsComplete) {
        toast.warning(tt('tollFee.toast.rowRequireRightFields').replace('{n}', String(i + 1)));
        return;
      }
    }

    setSubmitting(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row._localFile) {
          try { await uploadRowAttachment(row); } catch {
            toast.error(tt('tollFee.toast.rowFileUploadFailed').replace('{n}', String(i + 1)));
            return;
          }
        }
        const filled = applyAutoCostFields(row);
        const values: any = {
          container_number: normalizeContainer(filled.container_number),
          charge_types: filled.charge_types,
          quantity: filled.quantity === '' ? null : Number(filled.quantity),
          rate: filled.rate === '' ? null : Number(filled.rate),
          rate_currency: toNumCurrency(filled.rate_currency_str || ''),
          note: filled.left_notes || '',
          cost_amount: filled.cost_amount === '' ? null : Number(filled.cost_amount),
          cost_currency: toNumCurrency(filled.cost_currency_str || ''),
          vender: filled.vender || '',
          invoice_number: filled.invoice_number || '',
          cost_note: filled.right_notes || '',
          applicant: filled.applicant || '',
          approver: filled.approver || '',
          ap: filled.ap || '',
          ar: filled.ar || '',
        };
        if (filled._fromDb || filled.id) values.status = Number(filled.status);
        try {
          await upsertFee(filled, values);
        } catch (e: any) {
          toast.error(e?.message || tt('tollFee.toast.rowSaveFailed').replace('{n}', String(i + 1)));
          return;
        }
      }
      setAllEditing(false);
      await loadRows();
      await fetchAttachments();
      onLoadList?.();
      toast.success(tt('tollFee.toast.success'));
    } catch (e: any) {
      toast.error(e?.message || tt('tollFee.toast.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [allLocked, hasTaskId, rows, upsertFee, uploadRowAttachment, loadRows, fetchAttachments, onLoadList, tt]);

  const profitRatePercent = profitRate !== null ? Number((profitRate * 100).toFixed(2)) : null;
  const profitRateColor = profitRatePercent === null ? 'secondary' : profitRatePercent > 10 ? 'success' : profitRatePercent >= 0 ? 'warning' : 'danger';

  return (
    <Card className="md-section" style={{ marginTop: 16 }}>
      <div className="md-sectionHead d-flex justify-content-between align-items-center p-3" style={{ borderBottom: '1px solid #eee' }}>
        <span className="md-sectionHead__title">{tt('tollFee.title')}</span>
        {allLocked && (
          <div className="d-flex gap-2 align-items-center">
            <Badge color="danger">{tt('tollFee.locked')}</Badge>
            <Button size="sm" color="primary" outline onClick={tryUnlock}>{tt('tollFee.unlockPin')}</Button>
          </div>
        )}
      </div>
      <CardBody>
        {!hasTaskId && (
          <div className="alert alert-warning py-2 mb-3 fee-section__info">{tt('tollFee.taskIdRequired')}</div>
        )}

        <div className="d-flex flex-wrap gap-2 mb-2 fee-section__info">
          <strong>{tt('tollFee.defaultContainer')}:</strong>
          {defaultContainer
            ? <span className="badge bg-light text-dark border px-2 py-1">{defaultContainer}</span>
            : <span className="text-muted">{tt('tollFee.noContainer')}</span>}
          <strong className="ms-2">{tt('tollFee.available')}:</strong>
          {normalizedOptions.map((c) => (
            <span key={c} className="badge bg-light text-dark border px-2 py-1">{c}</span>
          ))}
        </div>

        <div className="d-flex gap-2 mb-3 align-items-center fee-section__info">
          <strong>{tt('tollFee.profitRate')}:</strong>
          {profitRatePercent !== null
            ? <Badge color={profitRateColor}>{profitRatePercent}%</Badge>
            : <span className="text-muted">{tt('tollFee.noProfitRate')}</span>}
        </div>

        <div className="mb-3">
          {!allEditing ? (
            <Button size="sm" color="primary" disabled={allLocked || !hasTaskId} onClick={startEditAll}>{tt('common.edit')}</Button>
          ) : (
            <Button size="sm" color="warning" disabled={!hasTaskId} onClick={cancelEditAll}>{tt('common.cancel')}</Button>
          )}
        </div>

        <div className="fee-section__scroll">
          <table className="table table-bordered table-sm fee-section__table toll-table">
            <thead className="table-light">
              <tr>
                <th className="fc-160">{tt('tollFee.col.containerNumber')}</th>
                <th className="fc-200">{tt('tollFee.col.chargeTypes')}</th>
                <th className="fc-100">{tt('tollFee.col.quantity')}</th>
                <th className="fc-120">{tt('tollFee.col.rate')}</th>
                <th className="fc-100">{tt('tollFee.col.currency')}</th>
                <th className="fc-200">{tt('tollFee.col.notes')}</th>
                <th className="fc-80">{tt('tollFee.col.record')}</th>
                <th className="fc-130">{tt('tollFee.col.arName')}</th>
                <th className="fc-130">{tt('tollFee.col.costAmount')}</th>
                <th className="fc-100">{tt('tollFee.col.currency')}</th>
                <th className="fc-140">{tt('tollFee.col.vendor')}</th>
                <th className="fc-140">{tt('tollFee.col.invoiceNo')}</th>
                <th className="fc-240">{tt('tollFee.col.attachment')}</th>
                <th className="fc-200">{tt('tollFee.col.notes')}</th>
                <th className="fc-130">{tt('tollFee.col.applicant')}</th>
                <th className="fc-80">{tt('tollFee.col.approve')}</th>
                <th className="fc-130">{tt('tollFee.col.approver')}</th>
                <th className="fc-80">{tt('tollFee.col.record')}</th>
                <th className="fc-130">{tt('tollFee.col.apName')}</th>
                <th className="fc-130">{tt('tollFee.col.operation')}</th>
                <th className="fc-140">{tt('tollFee.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isArApproved = !!row.ar;
                const isApproverApproved = !!row.approver;
                const lockLeft = !row._editing || isArApproved;
                const lockRight = !row._editing || isApproverApproved;
                return (
                  <tr key={idx} className={row._editing ? 'fee-section__row--editing' : row.status === 1 ? 'fee-section__row--done' : 'fee-section__row--default'}>
                    {/* Container Number */}
                    <td>
                      {row._editing ? (
                        <Input type="select" bsSize="sm" value={row.container_number} disabled={allLocked || !hasTaskId}
                          onChange={(e) => updateRow(idx, { container_number: e.target.value })}>
                          <option value="">{tt('tollFee.select')}</option>
                          {normalizedOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </Input>
                      ) : (
                        row.container_number
                          ? <span className="badge bg-light text-dark border">{row.container_number}</span>
                          : <span className="text-muted">{tt('tollFee.noContainer')}</span>
                      )}
                    </td>

                    {/* Types of Charges */}
                    <td>
                      {row._editing ? (
                        <Select
                          isDisabled={allLocked || lockLeft}
                          isClearable
                          isSearchable
                          className="rs-sm"
                          classNamePrefix="rs"
                          options={chargeTypes.map((t) => ({ value: t, label: t }))}
                          value={row.charge_types ? { value: row.charge_types, label: row.charge_types } : null}
                          onChange={(opt: any) => {
                            const ct = opt ? opt.value : '';
                            let patch: Partial<BillRow> = { charge_types: ct };
                            if (isAutoCostType(ct)) patch = { ...patch, cost_amount: 0, cost_currency_str: 'CAD', vender: 'DH', invoice_number: '000' };
                            if (norm(ct) === 'admin fee') {
                              // client 20251224013128303912 → 45, everyone else → 35; both sides in USD
                              const adminRate = String(user_id ?? '') === ADMIN_FEE_USER_ID ? 45 : 35;
                              patch = { ...patch, rate: adminRate, quantity: 1, rate_currency_str: 'USD', cost_currency_str: 'USD' };
                            }
                            updateRow(idx, patch);
                          }}
                          placeholder={tt('tollFee.select')}
                          menuPortalTarget={document.body}
                          styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
                        />
                      ) : (
                        row.charge_types
                          ? <span className="badge bg-secondary">{row.charge_types}</span>
                          : <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" type="number" min="0" value={String(row.quantity)} disabled={allLocked || lockLeft}
                          onChange={(e) => updateRow(idx, { quantity: e.target.value === '' ? '' : Number(e.target.value) })} />
                      ) : <span className="fee-section__amount">{row.quantity !== '' ? String(row.quantity) : '—'}</span>}
                    </td>

                    {/* Rate */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" type="number" min="0" value={String(row.rate)} disabled={allLocked || lockLeft}
                          onChange={(e) => updateRow(idx, { rate: e.target.value === '' ? '' : Number(e.target.value) })} />
                      ) : <span className="fee-section__amount">{moneyText(row.rate, row.rate_currency_str)}</span>}
                    </td>

                    {/* Rate Currency */}
                    <td>
                      {row._editing ? (
                        <Input type="select" bsSize="sm" value={row.rate_currency_str} disabled={allLocked || lockLeft}
                          onChange={(e) => updateRow(idx, { rate_currency_str: e.target.value as Currency })}>
                          <option value="">—</option>
                          <option value="USD">USD</option>
                          <option value="CAD">CAD</option>
                        </Input>
                      ) : row.rate_currency_str ? <span className="badge bg-light text-dark border">{row.rate_currency_str}</span> : <span className="text-muted">—</span>}
                    </td>

                    {/* Left Notes */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" value={row.left_notes} disabled={allLocked || !hasTaskId}
                          onChange={(e) => updateRow(idx, { left_notes: e.target.value })} />
                      ) : (
                        <span title={row.left_notes || undefined} className={`fee-section__notes${row.left_notes ? ' fee-section__notes--help' : ''}`}>
                          {row.left_notes || tt('tollFee.noNotes')}
                        </span>
                      )}
                    </td>

                    {/* AR checkbox */}
                    <td className="text-center">
                      {row._editing ? (
                        <input type="checkbox" checked={row.arChecked}
                          disabled={allLocked || !hasTaskId || !canEditAr() || row.arChecked}
                          onChange={(e) => handleArCheck(idx, e.target.checked)} />
                      ) : (
                        <span className={`badge ${row.arChecked ? 'bg-success' : 'bg-secondary'}`}>
                          {row.arChecked ? tt('common.yes') : tt('common.no')}
                        </span>
                      )}
                    </td>

                    {/* AR Name */}
                    <td><span className={row.ar ? 'fee-section__amount' : undefined}>{row.ar || tt('tollFee.notRecorded')}</span></td>

                    {/* Cost Amount */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" type="number" min="0" value={String(row.cost_amount)} disabled={allLocked || lockRight}
                          onChange={(e) => updateRow(idx, { cost_amount: e.target.value === '' ? '' : Number(e.target.value) })} />
                      ) : <span className="fee-section__amount">{moneyText(row.cost_amount, row.cost_currency_str)}</span>}
                    </td>

                    {/* Cost Currency */}
                    <td>
                      {row._editing ? (
                        <Input type="select" bsSize="sm" value={row.cost_currency_str} disabled={allLocked || lockRight}
                          onChange={(e) => updateRow(idx, { cost_currency_str: e.target.value as Currency })}>
                          <option value="">—</option>
                          <option value="USD">USD</option>
                          <option value="CAD">CAD</option>
                        </Input>
                      ) : row.cost_currency_str ? <span className="badge bg-light text-dark border">{row.cost_currency_str}</span> : <span className="text-muted">—</span>}
                    </td>

                    {/* Vendor */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" value={row.vender} disabled={allLocked || lockRight}
                          onChange={(e) => updateRow(idx, { vender: e.target.value })} />
                      ) : <span>{row.vender || '—'}</span>}
                    </td>

                    {/* Invoice No */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" value={row.invoice_number} disabled={allLocked || lockRight}
                          onChange={(e) => updateRow(idx, { invoice_number: e.target.value })} />
                      ) : <span>{row.invoice_number || '—'}</span>}
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
                          <Button size="sm" outline disabled={allLocked || !hasTaskId}
                            onClick={() => fileInputRefs.current[idx]?.click()}>
                            {tt('tollFee.chooseFile')}
                          </Button>
                          {row.attachment[0] && (
                            <span>
                              {row.attachment[0].status === 'ready' ? (
                                <>
                                  <a href="#" onClick={(e) => { e.preventDefault(); openPreview(row.attachment[0].url); }}>
                                    {row.attachment[0].name}
                                  </a>
                                  <button type="button" className="btn-close btn-close-sm ms-1 fee-section__close"
                                    onClick={() => updateRow(idx, { attachment: [], _localFile: null })} />
                                </>
                              ) : (
                                <span className="text-muted">{tt('tollFee.uploaded')}</span>
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
                            <span className="badge bg-success">{tt('tollFee.uploaded')}</span>
                          </div>
                        ) : (
                          <span className="text-muted">{tt('tollFee.noAttachment')}</span>
                        )
                      )}
                    </td>

                    {/* Right Notes */}
                    <td>
                      {row._editing ? (
                        <Input bsSize="sm" value={row.right_notes} disabled={allLocked || !hasTaskId}
                          onChange={(e) => updateRow(idx, { right_notes: e.target.value })} />
                      ) : (
                        <span title={row.right_notes || undefined} className={`fee-section__notes${row.right_notes ? ' fee-section__notes--help' : ''}`}>
                          {row.right_notes || tt('tollFee.noNotes')}
                        </span>
                      )}
                    </td>

                    {/* Applicant */}
                    <td><span className="fee-section__amount">{row.applicant || '—'}</span></td>

                    {/* Approver checkbox */}
                    <td className="text-center">
                      {row._editing ? (
                        <input type="checkbox" checked={row.approverChecked}
                          disabled={allLocked || !hasTaskId || !canEditApproval() || row.approverChecked}
                          onChange={(e) => handleApproverCheck(idx, e.target.checked)} />
                      ) : (
                        <span className={`badge ${row.approverChecked ? 'bg-success' : 'bg-secondary'}`}>
                          {row.approverChecked ? tt('common.yes') : tt('common.no')}
                        </span>
                      )}
                    </td>

                    {/* Approver Name */}
                    <td><span>{row.approver || tt('tollFee.notRecorded')}</span></td>

                    {/* AP checkbox */}
                    <td className="text-center">
                      {row._editing ? (
                        <input type="checkbox" checked={row.apChecked}
                          disabled={allLocked || !hasTaskId || !canEditAp() || row.apChecked}
                          onChange={(e) => handleApCheck(idx, e.target.checked)} />
                      ) : (
                        <span className={`badge ${row.apChecked ? 'bg-success' : 'bg-secondary'}`}>
                          {row.apChecked ? tt('common.yes') : tt('common.no')}
                        </span>
                      )}
                    </td>

                    {/* AP Name */}
                    <td><span>{row.ap || tt('tollFee.notRecorded')}</span></td>

                    {/* Operation */}
                    <td>
                      {row._editing && row._deletable && (
                        <Button size="sm" color="danger" disabled={allLocked || !hasTaskId}
                          className="me-1" onClick={() => removeRow(idx)}>{tt('common.delete')}</Button>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      {row._editing ? (
                        <Input type="select" bsSize="sm" value={String(row.status)}
                          disabled={allLocked || !hasTaskId}
                          onChange={(e) => handleStatusChange(idx, Number(e.target.value) as 0 | 1)}>
                          <option value="0">{tt('tollFee.status.processing')}</option>
                          <option value="1">{tt('tollFee.status.finished')}</option>
                        </Input>
                      ) : (
                        <span className={`badge ${row.status === 1 ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {row.status === 1 ? tt('tollFee.status.finished') : tt('tollFee.status.processing')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button color="primary" outline size="sm" className="mb-3"
          disabled={allLocked || !hasTaskId} onClick={addRow}>
          {tt('tollFee.addRow')}
        </Button>

        <hr />

        <Button color="success" disabled={allLocked || !hasTaskId || submitting} onClick={handleSubmit} className="fee-section__submit">
          {submitting ? <Spinner size="sm" className="me-1" /> : null}
          {tt('tollFee.submitAll')}
        </Button>
      </CardBody>
    </Card>
  );
}
