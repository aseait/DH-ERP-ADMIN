import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Container,
  Card,
  CardBody,
  Button,
  Alert,
  Collapse,
  Input,
  Badge,
  Spinner,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { useDispatch, useSelector } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { useLocation, useNavigate } from 'react-router-dom';

import BreadCrumb from '../../../Components/Common/BreadCrumb';
import NewSpinner from '../../../Components/Common/NewSpinner';

import { useTT } from '../../../helpers/useTT';
import { getUserIdFromSession, canDeleteFileFromSession, canEditCbService } from '../../../helpers/userInformation';

import { fetchMainTicketDetails } from '../../../slices/ticketDetails/thunk';
import { clearMainTicketDetails } from '../../../slices/ticketDetails/reducer';
import {
  retrieveFiles,
  uploadMarineAndAirFiles,
  fetchImporterNames,
} from '../../../slices/file/thunk';
import {
  updateAirCbTicketDetails,
  updateAirLogisticTicketDetails,
} from '../../../slices/air/thunk';
import { fetchCities } from '../../../slices/order/thunk';

import FileGroupsSection from '../../../Components/Common/FileGroupsSection';
import TicketHeader from '../../../Components/Common/TicketHeader';
import FileMini from '../../../Components/Common/FileMini';

import { createStatusMaps, lookupMap, safeStr, toNum } from '../helper';
import { openPreview } from '../../../helpers/filePreview';
import { normalizeYesNo, YesNoRadio, yesNoTo01 } from '../../../Components/Common/YesNoRadio';
import { toDateOnly, toDateTimeLocal } from '../../../helpers/date';
import { getImporterGstDutyApi } from '../../../helpers/api_fetch/poa';
import { adminDeleteFileApi } from '../../../helpers/api_fetch/files';
import { badgeColorByKind } from '../../../helpers/helpers';
import { fetchUserEmailApi, sendMailApi } from '../../../helpers/api_fetch/email';
import { buildCadEmail, parseRecipientList } from '../../../helpers/mailTemplates';
import LeaveMessageChat from '../../../Components/Common/LeaveMessageChat';
import InternalLeaveMessageChat from '../../../Components/Common/InternalLeaveMessageChat';


type AppDispatch = ThunkDispatch<any, any, AnyAction>;
type AnyObj = Record<string, any>;

type FileRow = {
  file_id?: any;
  file_url?: string;
  original_file_name?: string;
  fileName?: string;
  note?: string;
  sub_category?: any;
  status?: number;
  duties_and_taxes?: number | null;
};

type FileGroup = { key: string; value: FileRow[] };

type ImporterName = { id: number | string; Name: string };

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function normalizeTicket(details: any) {
  const root = Array.isArray(details?.data) ? details.data[0] : (details?.data ?? details ?? {});
  const cb =
      root?.cb_air?.[0] ?? (Array.isArray(root?.cb_air) ? root?.cb_air[0] : root?.cb_air) ?? {};
  const lg =
      root?.logistic_air?.[0] ??
      (Array.isArray(root?.logistic_air) ? root?.logistic_air[0] : root?.logistic_air) ??
      {};
  const wms =
      root?.wms_air?.[0] ?? (Array.isArray(root?.wms_air) ? root?.wms_air[0] : root?.wms_air) ?? {};
  return { main: root ?? {}, cb_air: cb ?? {}, logistic_air: lg ?? {}, wms_air: wms ?? {} };
}

function getSubType(f: any): string {
  let raw = f?.sub_category;
  if (!raw) return '';
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  return safeStr(raw?.type);
}

const DEFAULT_AIR_FILE_GROUPS: FileGroup[] = [
  { key: 'AN/EMF', value: [] },
  { key: 'Packing List/Invoice', value: [] },
  { key: 'Pickup', value: [] },
  { key: 'Telex', value: [] },
  { key: 'Delivery Instructions', value: [] },
  { key: 'BILL OF LADING', value: [] },
  { key: 'Others', value: [] },
];

const DEFAULT_AIR_SUPPORTING_FILE_GROUPS: FileGroup[] = [
  { key: 'POD', value: [] },
  { key: 'Proof of Charges', value: [] },
];

const AIR_SUPPORTING_DOC_KEYS = ['POD', 'Proof of Charges'];

const pickTicketDetails = (s: any) =>
    s.TicketDetails || s.ticketDetails || s.MainTicketDetails || {};
const pickFileSlice = (s: any) => s.File || {};
const pickAirSlice = (s: any) => s.Air || s.air || {};
const pickOrderSlice = (s: any) => s.Order || s.order || {};

// ---------------- component ----------------
const AirDetails: React.FC = () => {
  const { tt } = useTT();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const query = useQuery();

  const main_id = query.get('id') || '';
  const viewId = query.get('view_id') || '';
  const userId = useMemo(() => getUserIdFromSession(), []);

  const maps = useMemo(() => createStatusMaps((k, fallback) => tt(k) || fallback), [tt]);

  // ticket
  const ticketState = useSelector(pickTicketDetails);
  const { result, loading, error, errorMsg } = ticketState;

  const normalized = useMemo(() => normalizeTicket(result), [result]);
  const main = normalized.main;
  const cb_air = normalized.cb_air;
  const logistic_air = normalized.logistic_air;
  const wms_air = normalized.wms_air;

  const cb_air_id = main?.cb_air_id ?? cb_air?.cb_air_id ?? '';
  const logistic_air_id = main?.logistic_air_id ?? logistic_air?.logistic_air_id ?? '';
  const wms_air_id = main?.wms_air_id ?? wms_air?.wms_air_id ?? '';

  const canEdit = useMemo(() => {
    const st = main?.status;
    return st === null || st === undefined || String(st) === 'null' || toNum(st) === 0;
  }, [main?.status]);

  const canDeleteFile = useMemo(() => canDeleteFileFromSession(), []);

  // Air Customs Brokerage (CB) section: DH department only.
  const canEditCb = useMemo(() => canEditCbService(), []);

  const stepActive = useMemo(() => {
    const n = toNum(main?.status);
    return Math.max(0, Math.min(2, Number.isFinite(n) ? n : 0));
  }, [main?.status]);

  // files slice
  const filesState = useSelector(pickFileSlice);
  const retrievingFiles = !!filesState.retrievingFiles;
  const uploadingMarineAir = !!filesState.uploadingMarineAir;
  const loadingImporterNames = !!filesState.loadingImporterNames;

  // air slice loading flags
  const airState = useSelector(pickAirSlice);
  const updatingCb = !!(
      airState?.updatingCb ||
      airState?.updatingAirCb ||
      airState?.loadingUpdateCb ||
      airState?.loading
  );
  const updatingLogistic = !!(
      airState?.updatingLogistic ||
      airState?.updatingAirLogistic ||
      airState?.loadingUpdateLogistic
  );

  // importer names
  const importerNames: ImporterName[] = useMemo(() => {
    const raw = filesState.importerNames ?? [];
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const list: ImporterName[] = arr
        .map((x: any) => ({ id: x?.id ?? '', Name: x?.Name ?? '' }))
        .filter((x: any) => !!safeStr(x.Name).trim());

    const seen = new Set<string>();
    return list.filter((x) => {
      const k = safeStr(x.Name).trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [filesState.importerNames]);

  // cities
  const orderState = useSelector(pickOrderSlice);
  const loadingCities = !!(orderState?.loadingCities || orderState?.loading);
  const cityOptions: string[] = useMemo(() => {
    const raw = orderState?.cities ?? orderState?.cityList ?? orderState?.result?.data ?? [];
    const arr = Array.isArray(raw) ? raw : [];
    const list = arr
        .map((x: any) => {
          if (typeof x === 'string') return x;
          return x?.city ?? x?.label ?? x?.Name ?? x?.name ?? '';
        })
        .map((s: any) => safeStr(s).trim())
        .filter(Boolean);

    const seen = new Set<string>();
    return list.filter((c: string) => {
      const k = c.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [orderState]);

  // open sections
  const fromLogistic = viewId === 'logistic';
  const fromCustoms = viewId === 'customs';
  const [open, setOpen] = useState({
    customs: !fromLogistic,
    pickup: !fromCustoms,
    warehouse: !fromLogistic && !fromCustoms,
    files: true,
    supportingFiles: true,
  });
  // rows
  const [cbRows, setCbRows] = useState<AnyObj[]>([]);
  const [pickupRows, setPickupRows] = useState<AnyObj[]>([]);
  const [wmsRows, setWmsRows] = useState<AnyObj[]>([]);

  // `edit === false` means that row's edit form is currently open — i.e.
  // there are in-progress changes that have not been submitted yet.
  const hasUnsavedEdits = useMemo(
    () => cbRows.some((r) => r?.edit === false) || pickupRows.some((r) => r?.edit === false),
    [cbRows, pickupRows]
  );

  useEffect(() => {
    if (!hasUnsavedEdits) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEdits]);

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const goBack = useCallback(() => {
    if (!hasUnsavedEdits) {
      navigate(-1);
      return;
    }
    setShowUnsavedModal(true);
  }, [hasUnsavedEdits, navigate]);

  const [copyCustoms, setCopyCustoms] = useState<AnyObj>({});
  const [copyPickup, setCopyPickup] = useState<AnyObj>({});

  const [gstTouched, setGstTouched] = useState(false);

  // files groups + CAD
  const [fileGroups, setFileGroups] = useState<FileGroup[]>(
      () => JSON.parse(JSON.stringify(DEFAULT_AIR_FILE_GROUPS)) as FileGroup[]
  );

  const [supportingFileGroups, setSupportingFileGroups] = useState<FileGroup[]>(
      () => JSON.parse(JSON.stringify(DEFAULT_AIR_SUPPORTING_FILE_GROUPS)) as FileGroup[]
  );

  const [cadFile, setCadFile] = useState<FileRow | null>(null);
  const [releaseCadFile, setReleaseCadFile] = useState<FileRow | null>(null);

  // upload refs
  const [fileOpLoading, setFileOpLoading] = useState(false);
  const [cadOpLoading, setCadOpLoading] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const cadInputRef = useRef<HTMLInputElement | null>(null);
  const releaseCadInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<{ file: FileRow; groupKey: string } | null>(
      null
  );
  const [addTargetGroup, setAddTargetGroup] = useState<string>('');

  // Clear stale ticket data immediately on mount so cbRows/pickupRows never show old sea data
  useEffect(() => {
    dispatch(clearMainTicketDetails());
  }, [dispatch]);

  // load ticket + cities + importer list
  useEffect(() => {
    if (!main_id) return;
    dispatch(fetchMainTicketDetails({ main_id } as any));
  }, [dispatch, main_id, userId]);

  useEffect(() => {
    dispatch(fetchCities() as any);
  }, [dispatch]);

  useEffect(() => {
    if (!canEdit) return;
    const ticketUserId = main?.user_id;
    if (!ticketUserId) return;
    dispatch(fetchImporterNames({ user_id: ticketUserId, status: 0 } as any) as any);
  }, [dispatch, canEdit, main?.user_id]);

  // hydrate rows
  useEffect(() => {
    const root = Array.isArray(result?.data) ? result.data[0] : (result?.data ?? null);
    if (!root) return;

    const cbArr = Array.isArray(root?.cb_air) ? root.cb_air : root?.cb_air ? [root.cb_air] : [];
    const lgArr = Array.isArray(root?.logistic_air)
        ? root.logistic_air
        : root?.logistic_air
            ? [root.logistic_air]
            : [];
    const wArr = Array.isArray(root?.wms_air) ? root.wms_air : root?.wms_air ? [root.wms_air] : [];

    setCbRows(cbArr.map((x: any) => ({ ...x, edit: true })));
    setPickupRows(lgArr.map((x: any) => ({ ...x, edit: true })));
    setWmsRows(wArr.map((x: any) => ({ ...x })));
  }, [result]);

  // preview
  const onPreviewFile = useCallback((url?: string) => {
    if (!url) return;
    openPreview(url);
  }, []);

  // group files
  const applyFileList = useCallback((list: FileRow[]) => {
    const mainBase: FileGroup[] = JSON.parse(JSON.stringify(DEFAULT_AIR_FILE_GROUPS));
    const supportingBase: FileGroup[] = JSON.parse(
        JSON.stringify(DEFAULT_AIR_SUPPORTING_FILE_GROUPS)
    );

    let cad: FileRow | null = null;
    let release: FileRow | null = null;

    (list || []).forEach((f) => {
      if (toNum(f?.status) === 3) return;

      const type = getSubType(f);

      if (type === 'CAD') {
        cad = f;
        return;
      }

      if (type === 'Release CAD') {
        release = f;
        return;
      }

      if (AIR_SUPPORTING_DOC_KEYS.includes(type)) {
        const idx = supportingBase.findIndex((g) => g.key === type);
        if (idx > -1) {
          supportingBase[idx].value.push({ ...f });
        }
        return;
      }

      const idx = mainBase.findIndex((g) => g.key === type);
      if (idx > -1) {
        mainBase[idx].value.push({ ...f });
      } else {
        mainBase.find((g) => g.key === 'Others')?.value.push({ ...f });
      }
    });

    setFileGroups(mainBase);
    setSupportingFileGroups(supportingBase);
    setCadFile(cad);
    setReleaseCadFile(release);
  }, []);

  const loadSeqRef = useRef(0);

  const loadFiles = useCallback(async () => {
    const seq = ++loadSeqRef.current;

    const payload: any = {};
    if (cb_air_id) payload.cb_air_id = cb_air_id;
    else if (logistic_air_id) payload.logistic_air_id = logistic_air_id;
    else if (wms_air_id) payload.wms_air_id = wms_air_id;

    if (!Object.keys(payload).length) {
      if (seq === loadSeqRef.current) applyFileList([]);
      return;
    }

    let res: any;
    try {
      res = await dispatch(retrieveFiles(payload) as any);
    } catch {
      if (seq === loadSeqRef.current) applyFileList([]);
      return;
    }

    if (seq !== loadSeqRef.current) return;

    const list = res?.payload?.data ?? res?.payload ?? res?.data ?? res ?? [];
    applyFileList(Array.isArray(list) ? list : []);
  }, [dispatch, cb_air_id, logistic_air_id, wms_air_id, applyFileList]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDeleteFile = useCallback(async (file: FileRow) => {
    const fileId = Number(file.file_id);
    if (!fileId) return;
    if (!window.confirm(tt('info.confirmDeleteFile', { fileName: file.original_file_name || file.fileName || '' }))) return;
    try {
      await adminDeleteFileApi(fileId);
      toast.success(tt('info.fileDeleteSuccess'));
      await loadFiles();
    } catch (e: any) {
      toast.error(e?.message || tt('info.fileDeleteFailed'));
    }
  }, [loadFiles, tt]);

  // toggle sections
  const toggle = useCallback((key: keyof typeof open) => {
    setOpen((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  // ---------- customs edit ----------
  const startEditCustoms = useCallback((idx: number) => {
    if (!canEditCb) {
      toast.error(tt('common.noPermission'));
      return;
    }
    setCbRows((prev) => {
      const next = prev.map((x, i) => (i === idx ? { ...x, edit: false } : x));
      const row = next[idx] || {};
      setCopyCustoms({
        ...row,
        awb: safeStr(row.awb),
        airline: safeStr(row.airline),
        destination: safeStr(row.destination),
        eta: toDateOnly(row.eta),
        custom_status_time: toDateTimeLocal(row.custom_status_time),
        cost: safeStr(row.cost),
        end_journey: safeStr(row.end_journey),
        plate_number: safeStr(row.plate_number),
        importer: safeStr(row.importer),
        note: safeStr(row.note),
        gst: row.gst ?? row.duties_and_taxes ?? '',
      });
      setGstTouched(false);
      return next;
    });
  }, [canEditCb, tt]);

  const cancelEditCustoms = useCallback((idx: number) => {
    setCbRows((prev) => prev.map((x, i) => (i === idx ? { ...x, edit: true } : x)));
  }, []);

  useEffect(() => {
    const importerName = safeStr(copyCustoms?.importer).trim();
    if (!importerName) return;
    if (gstTouched) return;

    const found = importerNames.find((x) => safeStr(x.Name).trim() === importerName);
    const importer_id = found?.id;

    if (!userId || !importer_id) return;

    let alive = true;
    (async () => {
      try {
        const res: any = await getImporterGstDutyApi({ user_id: userId, importer_id } as any);
        const gst =
            res?.data?.gst ??
            res?.gst ??
            res?.data?.duties_and_taxes ??
            res?.duties_and_taxes ??
            res?.data?.tax ??
            res?.tax;

        if (!alive) return;
        if (gst != null) setCopyCustoms((p: AnyObj) => ({ ...p, gst }));
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [copyCustoms?.importer, gstTouched, importerNames, userId]);

  const submitCustoms = useCallback(
      async (idx: number) => {
        if (!cb_air_id) return;
        if (!canEditCb) {
          toast.error(tt('common.noPermission'));
          return;
        }

        const payload: any = {
          cb_air_id,
          awb: copyCustoms.awb,
          airline: copyCustoms.airline,
          destination: copyCustoms.destination,
          eta: copyCustoms.eta,
          custom_status: copyCustoms.custom_status,
          custom_status_time: copyCustoms.custom_status_time
              ? safeStr(copyCustoms.custom_status_time).replace('T', ' ') + ':00'
              : copyCustoms.custom_status_time,
          transaction: copyCustoms.transaction,

          importer: copyCustoms.importer,

          cost: copyCustoms.cost,
          end_journey: copyCustoms.end_journey,
          plate_number: copyCustoms.plate_number,

          note: copyCustoms.note,
          gst: copyCustoms.gst,
        };

        await dispatch(updateAirCbTicketDetails(payload as any) as any);

        if (userId) await dispatch(fetchMainTicketDetails({ main_id } as any));
        await loadFiles();

        setCbRows((prev) =>
            prev.map((x, i) => (i === idx ? { ...x, ...copyCustoms, edit: true } : x))
        );
      },
      [dispatch, cb_air_id, copyCustoms, userId, main_id, loadFiles, canEditCb, tt]
  );

  // ---------- pickup edit ----------
  const startEditPickup = useCallback((idx: number) => {
    setPickupRows((prev) => {
      const next = prev.map((x, i) => (i === idx ? { ...x, edit: false } : x));
      const row = next[idx] || {};
      setCopyPickup({
        ...row,
        shipping_units: safeStr(row.shipping_units),
        supervision_fee: safeStr(row.supervision_fee),
        terminal_cost: safeStr(row.terminal_cost),
        gross_weight: safeStr(row.gross_weight),
        supervision_wareshouse: safeStr(row.supervision_wareshouse),
        ata: toDateOnly(row.ata),
        cargo_arrival_time: safeStr(row.cargo_arrival_time),
        cargo_pickup_time: safeStr(row.cargo_pickup_time),
        supervised: normalizeYesNo(row.supervised),
        note: safeStr(row.note),
      });
      return next;
    });
  }, []);

  const cancelEditPickup = useCallback((idx: number) => {
    setPickupRows((prev) => prev.map((x, i) => (i === idx ? { ...x, edit: true } : x)));
  }, []);

  const submitPickup = useCallback(
      async (idx: number) => {
        if (!logistic_air_id) return;

        const payload: any = {
          logistic_air_id,
          awb: cb_air?.awb || logistic_air?.awb,

          shipping_units: copyPickup.shipping_units || null,
          supervision_fee: copyPickup.supervision_fee || null,
          terminal_cost: copyPickup.terminal_cost || null,
          gross_weight: copyPickup.gross_weight || null,
          supervision_wareshouse: copyPickup.supervision_wareshouse || null,
          ata: copyPickup.ata || null,
          cargo_arrival_time: copyPickup.cargo_arrival_time || null,
          cargo_pickup_time: copyPickup.cargo_pickup_time || null,
          note: copyPickup.note,

          supervised: yesNoTo01(copyPickup.supervised),
        };

        await dispatch(updateAirLogisticTicketDetails(payload as any) as any);

        if (userId) await dispatch(fetchMainTicketDetails({ main_id } as any));
        await loadFiles();

        setPickupRows((prev) =>
            prev.map((x, i) => (i === idx ? { ...x, ...copyPickup, edit: true } : x))
        );
      },
      [dispatch, logistic_air_id, cb_air, logistic_air, copyPickup, userId, main_id, loadFiles]
  );


  // ---------- uploads ----------
  const getAirIdsPayload = useCallback(() => {
    return {
      cb_air_ids: cb_air_id ? String(cb_air_id) : undefined,
      logistic_air_ids: logistic_air_id ? String(logistic_air_id) : undefined,
      wms_air_ids: wms_air_id ? String(wms_air_id) : undefined,
      cb_air_id: cb_air_id ? String(cb_air_id) : undefined,
      logistic_air_id: logistic_air_id ? String(logistic_air_id) : undefined,
      wms_air_id: wms_air_id ? String(wms_air_id) : undefined,
    };
  }, [cb_air_id, logistic_air_id, wms_air_id]);


  const replaceFile = (file: FileRow, groupKey: string) => {
    setReplaceTarget({ file, groupKey });
    replaceInputRef.current?.click();
  };

  const onReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !replaceTarget) return;

    setFileOpLoading(true);
    try {
      const payload = {
        files: [f],
        sub_categories: { type: replaceTarget.groupKey, value: f.name },
        updates: [{ file_id: replaceTarget.file.file_id, status: 3 }],
        ...getAirIdsPayload(),
      };

      await dispatch(uploadMarineAndAirFiles(payload as any) as any);
      await loadFiles();
      setReplaceTarget(null);
    } finally {
      setFileOpLoading(false);
    }
  };

  const addFile = (groupKey: string) => {
    setAddTargetGroup(groupKey);
    addInputRef.current?.click();
  };

  const onAddChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !addTargetGroup) return;

    setFileOpLoading(true);
    try {
      const payload = {
        files: [f],
        sub_categories: { type: addTargetGroup, value: f.name },
        ...getAirIdsPayload(),
      };

      await dispatch(uploadMarineAndAirFiles(payload as any) as any);
      await loadFiles();
      setAddTargetGroup('');
    } finally {
      setFileOpLoading(false);
    }
  };


  const mainTaskId = useMemo(
      () => safeStr(main?.main_id || main_id || ''),
      [main?.main_id, main_id]
  );
  const awbValue = useMemo(() => {
    return safeStr(
        cbRows?.[0]?.awb ||
        pickupRows?.[0]?.awb ||
        cb_air?.awb ||
        logistic_air?.awb ||
        wms_air?.awb ||
        ''
    );
  }, [cbRows, pickupRows, cb_air, logistic_air, wms_air]);

  const notifyCad = useCallback(
      async (kind: 'draft' | 'release', dutiesAndTaxes?: number | null) => {
        const ticketUserId = main?.user_id;
        if (!ticketUserId) return;
        try {
          const emailInfo = await fetchUserEmailApi(ticketUserId);
          const recipients = parseRecipientList(emailInfo?.email);
          if (!recipients.length) return;
          const { subject, text, html } = buildCadEmail({
            kind,
            lang: (emailInfo?.language ?? 0) as 0 | 1,
            userName: emailInfo?.user_name,
            identifier: awbValue,
            identifierKind: 'awb',
            jobId: main?.main_id,
            dutiesAndTaxes: dutiesAndTaxes ?? undefined,
          });
          await sendMailApi({ to: recipients, subject, text, html });
        } catch (e) {
          console.error('[AirDetails.notifyCad] email failed silently', e);
        }
      },
      [main?.user_id, main?.main_id, awbValue]
  );

  // CAD upload (admin uploads draft CAD, sets cad_status=1)
  const onCadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !cb_air_id) return;
    setCadOpLoading(true);
    try {
      const ids = getAirIdsPayload();
      const payload: any = {
        files: [f],
        sub_categories: { type: 'CAD', value: f.name },
        ...ids,
      };
      if (cadFile?.file_id) {
        payload.updates = [{ file_id: cadFile.file_id, status: 3 }];
      }
      await dispatch(uploadMarineAndAirFiles(payload as any) as any);
      await dispatch(updateAirCbTicketDetails({ cb_air_id, cad_status: 1 } as any) as any);
      await loadFiles();
      dispatch(fetchMainTicketDetails({ main_id } as any));
      await notifyCad('draft', cadFile?.duties_and_taxes ?? null);
    } finally {
      setCadOpLoading(false);
    }
  }, [cb_air_id, cadFile, getAirIdsPayload, dispatch, loadFiles, main_id, userId, notifyCad]);

  // Release CAD upload
  const onReleaseCadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setCadOpLoading(true);
    try {
      const ids = getAirIdsPayload();
      const payload: any = {
        files: [f],
        sub_categories: { type: 'Release CAD', value: f.name },
        ...ids,
      };
      if (releaseCadFile?.file_id) {
        payload.updates = [{ file_id: releaseCadFile.file_id, status: 3 }];
      }
      await dispatch(uploadMarineAndAirFiles(payload as any) as any);
      await loadFiles();
      await notifyCad('release', releaseCadFile?.duties_and_taxes ?? null);
    } finally {
      setCadOpLoading(false);
    }
  }, [releaseCadFile, getAirIdsPayload, dispatch, loadFiles, notifyCad]);

  const airMsgExtraTaskIds = useMemo(() => {
    const ids = [cb_air_id, logistic_air_id, wms_air_id]
        .map((v) => String(v || '').trim())
        .filter(Boolean);

    return Array.from(new Set(ids));
  }, [cb_air_id, logistic_air_id, wms_air_id]);

  // ========= render =========
  return (
      <>
        <Modal isOpen={showUnsavedModal} toggle={() => setShowUnsavedModal(false)} centered>
          <ModalHeader toggle={() => setShowUnsavedModal(false)}>
            {tt('common.warning')}
          </ModalHeader>
          <ModalBody>{tt('info.unsavedChangesConfirm')}</ModalBody>
          <ModalFooter>
            <Button color="secondary" outline onClick={() => setShowUnsavedModal(false)}>
              {tt('common.cancel')}
            </Button>
            <Button
              color="primary"
              onClick={() => {
                setShowUnsavedModal(false);
                navigate(-1);
              }}
            >
              {tt('info.unsavedChangesLeaveBtn')}
            </Button>
          </ModalFooter>
        </Modal>

        <div className="md-page">
          {loading && <NewSpinner size="lg" />}

          <Container fluid className="md-container">
            <div className="md-topbar">
              <BreadCrumb title={tt('createOrder.air.title')} pageTitle={tt('orderList.breadcrumb')} />
            </div>

            {(errorMsg || error) && (
                <Alert color="danger" className="md-alert">
                  {errorMsg || error}
                </Alert>
            )}

            <Card className="md-shell">
              <CardBody className="md-shell__body">
                <TicketHeader tt={tt} stepActive={stepActive} ticketType="Air" />

                <div className="md-actionsRow">
                  <Button color="primary" className="md-btn md-btn--primary" onClick={goBack}>
                    {tt('uploadMarine.actions.back')}
                  </Button>
                  <div className="d-flex align-items-center gap-2">
                    {mainTaskId && awbValue ? (
                        <LeaveMessageChat
                            title="Air Message"
                            taskId={mainTaskId}
                            extraTaskIds={airMsgExtraTaskIds}
                            awb={awbValue}
                            id="air_scrollbar_main"
                            type={1}
                            placement="end"
                            openKey="chat.title"
                            sendKey="chat.send"
                            placeholderKey="chat.notification"
                            userId={main?.user_id}
                        />
                    ) : null}
                    {mainTaskId && awbValue ? (
                        <InternalLeaveMessageChat
                            title="Internal Chat"
                            taskId={mainTaskId}
                            extraTaskIds={airMsgExtraTaskIds}
                            awb={awbValue}
                            id="air_scrollbar_internal"
                            placement="end"
                        />
                    ) : null}
                  </div>
                </div>

                {/* ================= Customs ================= */}
                {cbRows.length > 0 && (
                    <Card className="md-section">
                      <div className="md-sectionHead">
                        <button
                            className="md-sectionHead__toggle"
                            onClick={() => toggle('customs')}
                            type="button"
                        >
                          <span className={`md-chevron ${open.customs ? 'open' : ''}`} />
                          <span className="md-sectionHead__title">
                      {tt('orderList.sections.customsInfo')}
                    </span>
                        </button>
                      </div>

                      <Collapse isOpen={open.customs}>
                        <div className="md-section__body">
                          {cbRows.length === 0 ? (
                              <div className="md-empty">
                                <div className="md-empty__icon">📄</div>
                                <div className="md-empty__text">{tt('common.noData')}</div>
                              </div>
                          ) : null}

                          {cbRows.map((m: AnyObj, idx: number) => {
                            const editing = m.edit === false;

                            return (
                                <div className="md-item" key={`cb_${idx}`}>
                                  <div className="md-item__head">
                                    <div className="md-item__title">
                              <span className="md-mono">
                                {safeStr(editing ? copyCustoms.awb : m.awb) || '-'}
                              </span>

                                      <Badge
                                          pill
                                          className="md-badge"
                                          color={badgeColorByKind('order', m.status)}
                                      >
                                        {lookupMap(maps.order, m.status, '-')}
                                      </Badge>

                                      <Badge
                                          pill
                                          className="md-badge"
                                          color={badgeColorByKind('customs', m.custom_status)}
                                      >
                                        {lookupMap(maps.customs, m.custom_status, '-')}
                                      </Badge>

                                      {m?.note && toNum(m.status) === 6 ? (
                                          <span className="md-noteDanger">
                                  {tt('state.cad.rejectReason')}: {safeStr(m.note)}
                                </span>
                                      ) : null}
                                    </div>

                                    {canEdit && canEditCb && cb_air_id && !editing ? (
                                        <div className="md-item__actions">
                                          <Button
                                              size="sm"
                                              className="md-btn md-btn--soft md-btn--compact"
                                              onClick={() => startEditCustoms(idx)}
                                          >
                                            {tt('common.edit')}
                                          </Button>
                                        </div>
                                    ) : null}
                                  </div>

                                  <div className="md-grid">
                                    {/* Importer */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.importer')}
                                      </div>
                                      {editing ? (
                                          <Input
                                              type="select"
                                              className="md-control"
                                              value={safeStr(copyCustoms.importer || '')}
                                              disabled={loadingImporterNames}
                                              onChange={(e) => {
                                                setCopyCustoms((p: AnyObj) => ({
                                                  ...p,
                                                  importer: e.target.value,
                                                }));
                                                setGstTouched(false);
                                              }}
                                          >
                                            <option value="">
                                              {loadingImporterNames
                                                  ? tt('ticketSummary.loading')
                                                  : tt('createOrder.common.select')}
                                            </option>
                                            {!loadingImporterNames && importerNames.length === 0 ? (
                                                <option value="" disabled>
                                                  {tt('common.noData')}
                                                </option>
                                            ) : null}
                                            {importerNames.map((im) => (
                                                <option key={String(im.id)} value={im.Name}>
                                                  {im.Name}
                                                </option>
                                            ))}
                                          </Input>
                                      ) : (
                                          <Input
                                              className="md-control"
                                              value={safeStr(m.importer)}
                                              disabled
                                          />
                                      )}
                                    </div>

                                    {/* Air No (AWB) */}
                                    <div className="md-field">
                                      <div className="md-field__label">{tt('orderList.columns.awb')}</div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyCustoms.awb : m.awb)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                awb: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* Airline Company */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.airline')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyCustoms.airline : m.airline)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                airline: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* Destination */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.destination')}
                                      </div>
                                      {editing ? (
                                          <Input
                                              type="select"
                                              className="md-control"
                                              value={safeStr(copyCustoms.destination || '')}
                                              disabled={loadingCities}
                                              onChange={(e) =>
                                                  setCopyCustoms((p: AnyObj) => ({
                                                    ...p,
                                                    destination: e.target.value,
                                                  }))
                                              }
                                          >
                                            <option value="" disabled>
                                              {loadingCities
                                                  ? tt('ticketSummary.loading')
                                                  : tt('createOrder.common.selectDestination')}
                                            </option>
                                            {!loadingCities && cityOptions.length === 0 ? (
                                                <option value="" disabled>
                                                  {tt('common.noData')}
                                                </option>
                                            ) : null}
                                            {cityOptions.map((c: string) => (
                                                <option key={c} value={c}>
                                                  {c}
                                                </option>
                                            ))}
                                          </Input>
                                      ) : (
                                          <Input
                                              className="md-control"
                                              value={safeStr(m.destination)}
                                              disabled
                                          />
                                      )}
                                    </div>

                                    {/* Cost */}
                                    <div className="md-field">
                                      <div className="md-field__label">{tt('orderList.columns.cost')}</div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyCustoms.cost : m.cost)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                cost: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* End journey */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.endJourney')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyCustoms.end_journey : m.end_journey)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                end_journey: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* Plate Number */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.plateNumber')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyCustoms.plate_number : m.plate_number)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                plate_number: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* ETA */}
                                    <div className="md-field">
                                      <div className="md-field__label">{tt('orderList.columns.eta')}</div>
                                      <Input
                                          className="md-control"
                                          type="date"
                                          value={safeStr(editing ? copyCustoms.eta : toDateOnly(m.eta))}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                eta: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* Transaction */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.transaction')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyCustoms.transaction : m.transaction)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyCustoms((p: AnyObj) => ({
                                                ...p,
                                                transaction: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    {/* IID Status (Custom Status) — editable select in edit mode */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.iidStatus')}
                                      </div>
                                      {editing ? (
                                          <Input
                                              type="select"
                                              className="md-control"
                                              value={String(copyCustoms.custom_status ?? '')}
                                              onChange={(e) =>
                                                  setCopyCustoms((p: AnyObj) => ({
                                                    ...p,
                                                    custom_status: e.target.value,
                                                  }))
                                              }
                                          >
                                            <option value="">—</option>
                                            <option value="0">{tt('state.customs.notStarted')}</option>
                                            <option value="1">{tt('state.customs.cbsaAccepted')}</option>
                                            <option value="2">{tt('state.customs.cbsaRejected')}</option>
                                            <option value="4">{tt('state.customs.cbsaReleased')}</option>
                                            <option value="5">{tt('state.customs.cbsaExamRequired')}</option>
                                            <option value="9">{tt('state.customs.cbsaAcceptedWaiting')}</option>
                                            <option value="34">{tt('state.customs.cbsaAcceptedAwaitingCustoms')}</option>
                                          </Input>
                                      ) : (
                                          <Badge
                                              pill
                                              className="md-badge md-badge--big"
                                              color={badgeColorByKind('customs', m.custom_status)}
                                          >
                                            {lookupMap(maps.customs, m.custom_status, '-')}
                                          </Badge>
                                      )}
                                    </div>

                                    {/* Custom Status Time — editable in edit mode */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.customStatusTime')}
                                      </div>
                                      {editing ? (
                                          <Input
                                              type="datetime-local"
                                              className={`md-control${!copyCustoms.custom_status_time ? ' md-date-empty' : ''}`}
                                              value={copyCustoms.custom_status_time ?? ''}
                                              onChange={(e) =>
                                                  setCopyCustoms((p: AnyObj) => ({
                                                    ...p,
                                                    custom_status_time: e.target.value,
                                                  }))
                                              }
                                          />
                                      ) : (
                                          <Input
                                              className="md-control"
                                              value={safeStr(m.custom_status_time)}
                                              disabled
                                          />
                                      )}
                                    </div>

                                    {/* Draft CAD — admin uploads the file */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.draftCad')}
                                      </div>
                                      <div className="md-inline">
                                        <Badge
                                            pill
                                            className="md-badge md-badge--big"
                                            color={badgeColorByKind('cad', m.cad_status)}
                                        >
                                          {lookupMap(maps.cad, m.cad_status, '-')}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            className="md-btn md-btn--primary md-btn--compact"
                                            disabled={cadOpLoading || toNum(m.status) === 5}
                                            onClick={() => cadInputRef.current?.click()}
                                        >
                                          {cadOpLoading ? <Spinner size="sm" className="me-1" /> : null}
                                          {tt('common.upload')}
                                        </Button>
                                      </div>
                                      {toNum(m.cad_status) === 3 && m.cad_note ? (
                                          <div className="text-danger small mt-1">
                                            {tt('state.cad.rejectReason')}: {safeStr(m.cad_note)}
                                          </div>
                                      ) : null}
                                      <FileMini
                                          file={cadFile}
                                          viewLabel={tt('createOrder.actions.viewFile')}
                                      />
                                    </div>

                                    {/* Release CAD — admin uploads the file */}
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.releaseCad')}
                                      </div>
                                      <div className="md-inline">
                                        <Button
                                            size="sm"
                                            className="md-btn md-btn--primary md-btn--compact"
                                            disabled={cadOpLoading || toNum(m.status) === 5}
                                            onClick={() => releaseCadInputRef.current?.click()}
                                        >
                                          {cadOpLoading ? <Spinner size="sm" className="me-1" /> : null}
                                          {tt('common.upload')}
                                        </Button>
                                      </div>
                                      <FileMini
                                          file={releaseCadFile}
                                          viewLabel={tt('createOrder.actions.viewFile')}
                                      />
                                    </div>
                                    {canEdit && canEditCb && cb_air_id && editing && (
                                        <div className="md-field md-field--wide md-field--actions">
                                          <Button
                                              size="sm"
                                              className="md-btn md-btn--ghost md-btn--compact"
                                              onClick={() => cancelEditCustoms(idx)}
                                          >
                                            {tt('uploadMarine.actions.cancel')}
                                          </Button>
                                          <Button
                                              size="sm"
                                              className="md-btn md-btn--primary md-btn--compact"
                                              onClick={() => submitCustoms(idx)}
                                          >
                                            {updatingCb ? <Spinner size="sm" className="me-2" /> : null}
                                            {tt('uploadMarine.actions.submit')}
                                          </Button>
                                        </div>
                                    )}
                                  </div>
                                </div>
                            );
                          })}
                        </div>
                      </Collapse>
                    </Card>
                )}

                {/* ================= Pickup ================= */}
                {pickupRows.length > 0 && (
                    <Card className="md-section">
                      <div className="md-sectionHead">
                        <button
                            className="md-sectionHead__toggle"
                            onClick={() => toggle('pickup')}
                            type="button"
                        >
                          <span className={`md-chevron ${open.pickup ? 'open' : ''}`} />
                          <span className="md-sectionHead__title">
                      {tt('orderList.sections.logisticsInfo')}
                    </span>
                        </button>
                      </div>

                      <Collapse isOpen={open.pickup}>
                        <div className="md-section__body">
                          {pickupRows.length === 0 ? (
                              <div className="md-empty">
                                <div className="md-empty__icon">🚚</div>
                                <div className="md-empty__text">{tt('common.noData')}</div>
                              </div>
                          ) : null}

                          {pickupRows.map((m: AnyObj, idx: number) => {
                            const editing = m.edit === false;
                            const proc = m.status ?? m.container_status;

                            return (
                                <div className="md-item" key={`lg_${idx}`}>
                                  <div className="md-item__head">
                                    <div className="md-item__title">
                              <span className="md-mono">
                                {safeStr(cbRows?.[0]?.awb || cb_air?.awb) || '-'}
                              </span>

                                      <Badge
                                          pill
                                          className="md-badge"
                                          color={badgeColorByKind('pickup', proc)}
                                      >
                                        {lookupMap(maps.pickup, proc, '-')}
                                      </Badge>

                                      {m?.note && toNum(m.status) === 4 ? (
                                          <span className="md-noteDanger">
                                  {tt('state.cad.rejectReason')}: {safeStr(m.note)}
                                </span>
                                      ) : null}
                                    </div>

                                    {canEdit && logistic_air_id && !editing ? (
                                        <div className="md-item__actions">
                                          <Button
                                              size="sm"
                                              className="md-btn md-btn--soft md-btn--compact"
                                              onClick={() => startEditPickup(idx)}
                                          >
                                            {tt('common.edit')}
                                          </Button>
                                        </div>
                                    ) : null}
                                  </div>

                                  <div className="md-grid">
                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.shippingUnits')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(
                                              editing ? copyPickup.shipping_units : m.shipping_units
                                          )}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({
                                                ...p,
                                                shipping_units: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.supervisionFee')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(
                                              editing ? copyPickup.supervision_fee : m.supervision_fee
                                          )}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({
                                                ...p,
                                                supervision_fee: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.terminalCost')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(
                                              editing ? copyPickup.terminal_cost : m.terminal_cost
                                          )}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({
                                                ...p,
                                                terminal_cost: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('createOrder.air.grossWeight')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(editing ? copyPickup.gross_weight : m.gross_weight)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({
                                                ...p,
                                                gross_weight: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.supervisionWarehouse')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={safeStr(
                                              editing
                                                  ? copyPickup.supervision_wareshouse
                                                  : m.supervision_wareshouse
                                          )}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({
                                                ...p,
                                                supervision_wareshouse: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">{tt('orderList.columns.ata')}</div>
                                      <Input
                                          className="md-control"
                                          type="date"
                                          value={safeStr(editing ? copyPickup.ata : toDateOnly(m.ata))}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({
                                                ...p,
                                                ata: e.target.value,
                                              }))
                                          }
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.cargoArrivalTime')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={toDateOnly(m.cargo_arrival_time)}
                                          disabled
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.cargoPickupTime')}
                                      </div>
                                      <Input
                                          className="md-control"
                                          value={toDateOnly(m.cargo_pickup_time)}
                                          disabled
                                      />
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">
                                        {tt('orderList.columns.process')}
                                      </div>
                                      <Badge
                                          pill
                                          className="md-badge md-badge--big"
                                          color={badgeColorByKind('pickup', proc)}
                                      >
                                        {lookupMap(maps.pickup, proc, '-')}
                                      </Badge>
                                    </div>

                                    <div className="md-field">
                                      <div className="md-field__label">{tt('common.supervised') || 'Supervised'}</div>
                                      {editing ? (
                                          <YesNoRadio
                                              name={`air_supervised_${idx}`}
                                              value={copyPickup.supervised}
                                              yesLabel={tt('common.yes')}
                                              noLabel={tt('common.no')}
                                              onChange={(v) =>
                                                  setCopyPickup((p: AnyObj) => ({ ...p, supervised: v }))
                                              }
                                          />
                                      ) : (
                                          <Input
                                              className="md-control"
                                              value={normalizeYesNo(m.supervised) || '-'}
                                              disabled
                                          />
                                      )}
                                    </div>

                                    <div className="md-field md-field--wide md-span-4">
                                      <div className="md-field__label">{tt('orderList.table.note')}</div>
                                      <Input
                                          type="textarea"
                                          className="md-control"
                                          rows={4}
                                          value={editing ? safeStr(copyPickup.note) : safeStr(m.note)}
                                          disabled={!editing}
                                          onChange={(e) =>
                                              setCopyPickup((p: AnyObj) => ({ ...p, note: e.target.value }))
                                          }
                                      />
                                    </div>
                                    {canEdit && logistic_air_id && editing && (
                                        <div className="md-field md-field--wide md-field--actions">
                                          <Button
                                              size="sm"
                                              className="md-btn md-btn--ghost md-btn--compact"
                                              onClick={() => cancelEditPickup(idx)}
                                          >
                                            {tt('uploadMarine.actions.cancel')}
                                          </Button>
                                          <Button
                                              size="sm"
                                              className="md-btn md-btn--primary md-btn--compact"
                                              onClick={() => submitPickup(idx)}
                                          >
                                            {updatingLogistic ? (
                                                <Spinner size="sm" className="me-2" />
                                            ) : null}
                                            {tt('uploadMarine.actions.submit')}
                                          </Button>
                                        </div>
                                    )}
                                  </div>
                                </div>
                            );
                          })}
                        </div>
                      </Collapse>
                    </Card>
                )}

                {/* ================= Warehouse ================= */}
                {wmsRows.length > 0 && (
                    <Card className="md-section">
                      <div className="md-sectionHead">
                        <button
                            className="md-sectionHead__toggle"
                            onClick={() => toggle('warehouse')}
                            type="button"
                        >
                          <span className={`md-chevron ${open.warehouse ? 'open' : ''}`} />
                          <span className="md-sectionHead__title">
                      {tt('orderList.sections.warehouseInfo')}
                    </span>
                        </button>
                      </div>

                      <Collapse isOpen={open.warehouse}>
                        <div className="md-section__body">
                          {wmsRows.length === 0 ? (
                              <div className="md-empty">
                                <div className="md-empty__icon">🏬</div>
                                <div className="md-empty__text">{tt('common.noData')}</div>
                              </div>
                          ) : null}

                          {wmsRows.map((m: AnyObj, idx: number) => (
                              <div className="md-item" key={`wms_${idx}`}>
                                <div className="md-grid md-grid--compact">
                                  <div className="md-field">
                                    <div className="md-field__label">{tt('orderList.columns.status')}</div>
                                    <Badge
                                        pill
                                        className="md-badge md-badge--big"
                                        color={badgeColorByKind('warehouse', m.status ?? m.container_status)}
                                    >
                                      {lookupMap(maps.warehouse, m.status ?? m.container_status, '-')}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                          ))}
                        </div>
                      </Collapse>
                    </Card>
                )}

                {/* ================= Files ================= */}
                <FileGroupsSection
                    tt={tt}
                    open={open.files}
                    onToggle={() => toggle('files')}
                    canEdit={canEdit}
                    canDelete={canEdit && canDeleteFile}
                    fileGroups={fileGroups.map((g) => ({ ...g, key: g.key }))}
                    retrievingFiles={retrievingFiles}
                    uploadingMarineAir={uploadingMarineAir || fileOpLoading}
                    onAddFile={addFile}
                    onReplaceFile={replaceFile}
                    onDeleteFile={handleDeleteFile}
                    onPreviewFile={(url?: string) => url && onPreviewFile(url)}
                    addInputRef={addInputRef}
                    replaceInputRef={replaceInputRef}
                    onAddChange={onAddChange}
                    onReplaceChange={onReplaceChange}
                />

                <FileGroupsSection
                    tt={tt}
                    title={tt('files.supportingDocuments')}
                    open={open.supportingFiles}
                    onToggle={() => toggle('supportingFiles')}
                    canEdit={canEdit}
                    canDelete={canEdit && canDeleteFile}
                    fileGroups={supportingFileGroups.map((g) => ({ ...g, key: g.key }))}
                    retrievingFiles={retrievingFiles}
                    uploadingMarineAir={uploadingMarineAir || fileOpLoading}
                    onAddFile={addFile}
                    onReplaceFile={replaceFile}
                    onDeleteFile={handleDeleteFile}
                    onPreviewFile={(url?: string) => url && onPreviewFile(url)}
                    addInputRef={addInputRef}
                    replaceInputRef={replaceInputRef}
                    onAddChange={onAddChange}
                    onReplaceChange={onReplaceChange}
                />

              </CardBody>
            </Card>

            {/* hidden inputs for upload */}
            <input ref={addInputRef} type="file" className="d-none" onChange={onAddChange} />
            <input ref={replaceInputRef} type="file" className="d-none" onChange={onReplaceChange} />
            <input ref={cadInputRef} type="file" accept=".pdf" className="d-none" onChange={onCadChange} />
            <input ref={releaseCadInputRef} type="file" accept=".pdf" className="d-none" onChange={onReleaseCadChange} />

          </Container>
        </div>
      </>
  );
};

export default AirDetails;
