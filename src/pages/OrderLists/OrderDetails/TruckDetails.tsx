import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {useDispatch, useSelector} from 'react-redux';
import type {AnyAction} from 'redux';
import type {ThunkDispatch} from 'redux-thunk';
import {useLocation, useNavigate} from 'react-router-dom';

import BreadCrumb from '../../../Components/Common/BreadCrumb';
import NewSpinner from '../../../Components/Common/NewSpinner';

import {useTT} from '../../../helpers/useTT';
import {getUserIdFromSession, canDeleteFileFromSession, canEditLogisticService, canEditCbService} from '../../../helpers/userInformation';

import {fetchMainTicketDetails} from '../../../slices/ticketDetails/thunk';
import {retrieveFiles, uploadTruckFiles, fetchImporterNames} from '../../../slices/file/thunk';
import {fetchCities} from '../../../slices/order/thunk';

import {
    updateTruckCbContainer,
    updateTruckLogistic,
    updateTruckUsToCa,
} from '../../../slices/parse/thunk';

import TicketHeader from '../../../Components/Common/TicketHeader';
import FileGroupsSection from '../../../Components/Common/FileGroupsSection';
import FileMini from '../../../Components/Common/FileMini';

import {createStatusMaps, lookupMap, safeStr, toNum} from '../helper';
import {openPreview} from '../../../helpers/filePreview';
import {normalizeYesNo, YesNoRadio, yesNoTo01} from '../../../Components/Common/YesNoRadio';
import {badgeColorByKind} from '../../../helpers/helpers';

import LeaveMessageChat from '../../../Components/Common/LeaveMessageChat';
import InternalLeaveMessageChat from '../../../Components/Common/InternalLeaveMessageChat';
import PartiallyRepaySection from './PartiallyRepaySection';
import AdditionalFeeSection from './AdditionalFeeSection';
import { adminDeleteFileApi } from '../../../helpers/api_fetch/files';
import { fetchUserEmailApi, sendMailApi } from '../../../helpers/api_fetch/email';
import { buildCadEmail, parseRecipientList } from '../../../helpers/mailTemplates';

// ---------------- types ----------------
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

    truck_cb_id?: any;
    truck_logistic_id?: any;
    truck_us_ca_id?: any;
    container_number?: any;
};

type FileGroup = { key: string; value: FileRow[] };
type ImporterName = { id: number | string; Name: string };

function useQuery() {
    const {search} = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

function normalizeTicket(details: any) {
    const root = Array.isArray(details?.data) ? details.data[0] : (details?.data ?? details ?? {});

    const cb = Array.isArray(root?.truck_cb) ? root.truck_cb : root?.truck_cb ? [root.truck_cb] : [];
    const lg = Array.isArray(root?.truck_logistic)
        ? root.truck_logistic
        : root?.truck_logistic
            ? [root.truck_logistic]
            : [];
    const us = Array.isArray(root?.truck_us_to_ca)
        ? root.truck_us_to_ca
        : Array.isArray(root?.truck_us_ca)
            ? root?.truck_us_ca
            : root?.truck_us_to_ca
                ? [root.truck_us_to_ca]
                : root?.truck_us_ca
                    ? [root.truck_us_ca]
                    : [];

    return {
        main: root ?? {},
        truck_cb: cb ?? [],
        truck_logistic: lg ?? [],
        truck_us_to_ca: us ?? [],
    };
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

// Truck file groups (match your Vue)
const DEFAULT_TRUCK_FILE_GROUPS: FileGroup[] = [
    {key: 'AN/EMF', value: []},
    {key: 'Packing List/Invoice', value: []},
    {key: 'MBL', value: []},
    {key: 'HBL', value: []},
    {key: 'Pars', value: []},
    {key: 'Separate Cargo Files', value: []},
    {key: 'Others', value: []},
];

const DEFAULT_TRUCK_SUPPORTING_FILE_GROUPS: FileGroup[] = [
    {key: 'POD', value: []},
    {key: 'Proof of Charges', value: []},
];

const TRUCK_SUPPORTING_DOC_KEYS = ['POD', 'Proof of Charges'];

const pickTicketDetails = (s: any) =>
    s.TicketDetails || s.ticketDetails || s.MainTicketDetails || {};
const pickFileSlice = (s: any) => s.File || s.files || {};
const pickTruckSlice = (s: any) => s.Truck || s.truck || {};
const pickOrderSlice = (s: any) => s.Order || s.order || {};

const isZeroDate = (s: string) => /^0000-00-00/.test(s);

const toDateOnly = (v: any) => {
    const s = safeStr(v);
    if (!s || isZeroDate(s)) return '';
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? s.slice(0, 10);
};

const toDatetimeLocal = (v: any) => {
    const s = safeStr(v);
    if (!s || isZeroDate(s)) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;

    const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
    if (m) return `${m[1]}T${m[2]}:${m[3]}`;

    const m2 = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (m2) return `${m2[1]}T${m2[2]}:${m2[3]}`;

    return '';
};

const toDatetimeDisplay = (v: any): string => {
    const s = toDatetimeLocal(v);
    return s ? s.replace('T', ' ') : '';
};

// very defensive extractor for thunk return shapes
const extractAnyList = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.payload)) return res.payload;
    if (Array.isArray(res?.payload?.data)) return res.payload.data;
    if (Array.isArray(res?.result?.data)) return res.result.data;
    return [];
};

const TruckDetails: React.FC = () => {
    const {tt} = useTT();
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const query = useQuery();

    const main_id = query.get('id') || '';
    const viewId = query.get('view_id') || '';
    const userId = useMemo(() => getUserIdFromSession(), []);

    const maps = useMemo(() => createStatusMaps((k, fallback) => tt(k) || fallback), [tt]);

    // ticket
    const ticketState = useSelector(pickTicketDetails);
    const {result, loading, error, errorMsg} = ticketState;

    const normalized = useMemo(() => normalizeTicket(result), [result]);
    const main = normalized.main;
    const truck_cb_list = normalized.truck_cb;
    const truck_logistic_list = normalized.truck_logistic;
    const truck_us_list = normalized.truck_us_to_ca;

    const truck_cb_id = main?.truck_cb_id ?? '';
    const truck_logistic_id = main?.truck_logistic_id ?? '';
    const truck_us_ca_id = main?.truck_us_ca_id ?? '';

    const canEdit = useMemo(() => {
        const st = main?.status;
        return st === null || st === undefined || String(st) === 'null' || toNum(st) === 0;
    }, [main?.status]);

    // TOLL Fee lock — truck_cb and truck_us_to_ca only (truck_logistic is
    // intentionally excluded per instruction). Each uses its own row status
    // (ticket_status) with its own "complete" value, confirmed against
    // production data: truck_cb completes at 5, truck_us_to_ca at 6 (its
    // "pickup" scale's Total Completed). A service only has to agree if it's
    // actually present on this order; if neither is present, nothing locks.
    const financeLocked = useMemo(() => {
        const cb = truck_cb_list ?? [];
        const usToCa = truck_us_list ?? [];
        if (cb.length === 0 && usToCa.length === 0) return false;
        const cbDone = cb.length === 0 || cb.every((r: any) => toNum(r?.ticket_status) === 5);
        const usToCaDone = usToCa.length === 0 || usToCa.every((r: any) => toNum(r?.ticket_status) === 6);
        return cbDone && usToCaDone;
    }, [truck_cb_list, truck_us_list]);

    const canDeleteFile = useMemo(() => canDeleteFileFromSession(), []);

    // US to CA section belongs to the Logistic department.
    const canEditUsToCa = useMemo(() => canEditLogisticService(), []);

    // Truck Customs Brokerage (CB) section: DH department only.
    const canEditCb = useMemo(() => canEditCbService(), []);

    const stepActive = useMemo(() => {
        const n = toNum(main?.status);
        return Math.max(0, Math.min(2, Number.isFinite(n) ? n : 0));
    }, [main?.status]);

    // files slice
    const filesState = useSelector(pickFileSlice);
    const retrievingFiles = !!filesState.retrievingFiles;
    const uploadingTruck = !!filesState.uploadingTruck;
    const loadingImporterNames = !!filesState.loadingImporterNames;

    // truck updating flag
    const truckState = useSelector(pickTruckSlice);
    const updating = !!truckState?.updating;

    // importer names
    const importerNames: ImporterName[] = useMemo(() => {
        const raw = filesState.importerNames ?? [];
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const list: ImporterName[] = arr
            .map((x: any) => ({id: x?.id ?? '', Name: x?.Name ?? ''}))
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
        cb: !fromLogistic,
        logistic: !fromCustoms,
        ustoca: !fromLogistic && !fromCustoms,
        files: true,
        supportingFiles: true,
    });

    // rows
    const [cbRows, setCbRows] = useState<AnyObj[]>([]);
    const [logisticRows, setLogisticRows] = useState<AnyObj[]>([]);
    const [usRows, setUsRows] = useState<AnyObj[]>([]);

    // copies
    const [copyCb, setCopyCb] = useState<AnyObj>({});
    const [copyLogistic, setCopyLogistic] = useState<AnyObj>({});
    const [copyUsToCa, setCopyUsToCa] = useState<AnyObj>({});

    // files groups + CAD
    const [fileGroups, setFileGroups] = useState<FileGroup[]>(
        () => JSON.parse(JSON.stringify(DEFAULT_TRUCK_FILE_GROUPS)) as FileGroup[]
    );

    const [supportingFileGroups, setSupportingFileGroups] = useState<FileGroup[]>(
        () => JSON.parse(JSON.stringify(DEFAULT_TRUCK_SUPPORTING_FILE_GROUPS)) as FileGroup[]
    );

    const [cadFile, setCadFile] = useState<FileRow | null>(null);
    const [releaseCadFile, setReleaseCadFile] = useState<FileRow | null>(null);

    // upload refs
    const [fileOpLoading, setFileOpLoading] = useState(false);
    const replaceInputRef = useRef<HTMLInputElement | null>(null);
    const addInputRef = useRef<HTMLInputElement | null>(null);
    const [replaceTarget, setReplaceTarget] = useState<{ file: FileRow; groupKey: string } | null>(
        null
    );
    const [addTargetGroup, setAddTargetGroup] = useState<string>('');

    const cadUploadRef = useRef<HTMLInputElement | null>(null);
    const releaseCadUploadRef = useRef<HTMLInputElement | null>(null);

    // `edit === false` means that row's edit form is currently open — i.e.
    // there are in-progress changes that have not been submitted yet.
    const hasUnsavedEdits = useMemo(
        () =>
            cbRows.some((r) => r?.edit === false) ||
            logisticRows.some((r) => r?.edit === false) ||
            usRows.some((r) => r?.edit === false),
        [cbRows, logisticRows, usRows]
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

    useEffect(() => {
        if (!main_id) return;
        dispatch(fetchMainTicketDetails({main_id} as any));
    }, [dispatch, main_id]);

    useEffect(() => {
        dispatch(fetchCities() as any);
    }, [dispatch]);

    useEffect(() => {
        if (!canEdit) return;
        const ticketUserId = main?.user_id;
        if (!ticketUserId) return;
        dispatch(fetchImporterNames({user_id: ticketUserId, status: 0} as any) as any);
    }, [dispatch, canEdit, main?.user_id]);

    useEffect(() => {
        setCbRows((truck_cb_list || []).map((x: any) => ({...x, edit: true})));
        setLogisticRows((truck_logistic_list || []).map((x: any) => ({...x, edit: true})));
        setUsRows((truck_us_list || []).map((x: any) => ({...x, edit: true})));
    }, [truck_cb_list, truck_logistic_list, truck_us_list]);

    const handlePreviewFile = useCallback((url?: string) => {
        if (!url) return;
        openPreview(url);
    }, []);

    const applyFileList = useCallback((list: FileRow[]) => {
        const mainBase: FileGroup[] = JSON.parse(JSON.stringify(DEFAULT_TRUCK_FILE_GROUPS));
        const supportingBase: FileGroup[] = JSON.parse(
            JSON.stringify(DEFAULT_TRUCK_SUPPORTING_FILE_GROUPS)
        );

        let cad: FileRow | null = null;
        let release: FileRow | null = null;

        (Array.isArray(list) ? list : []).forEach((f) => {
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

            if (TRUCK_SUPPORTING_DOC_KEYS.includes(type)) {
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
        if (truck_cb_id) payload.truck_cb_id = truck_cb_id;
        if (truck_logistic_id) payload.truck_logistic_id = truck_logistic_id;
        if (truck_us_ca_id) payload.truck_us_ca_id = truck_us_ca_id;

        if (!Object.keys(payload).length) {
            if (seq === loadSeqRef.current) applyFileList([]);
            return;
        }

        const res: any = await dispatch(retrieveFiles(payload) as any);

        if (seq !== loadSeqRef.current) return;

        const list = extractAnyList(res);

        applyFileList(list);
    }, [dispatch, truck_cb_id, truck_logistic_id, truck_us_ca_id, applyFileList]);

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

    const toggle = useCallback((key: keyof typeof open) => {
        setOpen((p) => ({...p, [key]: !p[key]}));
    }, []);


    const truckMsgPrimaryTaskId = useMemo(() => {
        return String(main?.main_id ?? main_id ?? '').trim();
    }, [main?.main_id, main_id]);

    const truckMsgExtraTaskIds = useMemo(() => {
        const ids = [truck_cb_id, truck_logistic_id, truck_us_ca_id]
            .map((v) => String(v || '').trim())
            .filter(Boolean);

        return Array.from(new Set(ids));
    }, [truck_cb_id, truck_logistic_id, truck_us_ca_id]);

    const truckMsgContainerOptions = useMemo(() => {
        const set = new Set<string>();

        [...(cbRows || []), ...(logisticRows || []), ...(usRows || [])].forEach((r: any) => {
            const c = String(r?.container_number || '').trim().toUpperCase();
            if (c) set.add(c);
        });

        return Array.from(set);
    }, [cbRows, logisticRows, usRows]);

    const truckMsgNumber = useMemo(() => {
        return truckMsgContainerOptions.find(Boolean) || '';
    }, [truckMsgContainerOptions]);


    const cbNumber = useMemo(() => safeStr(cbRows?.[0]?.container_number || ''), [cbRows]);
    const logisticNumber = useMemo(
        () => safeStr(logisticRows?.[0]?.container_number || ''),
        [logisticRows]
    );

    const getUploadContainerNumbers = useCallback((): string[] => {
        const nums = [
            ...(cbRows || []).map((x: any) => safeStr(x?.container_number)).filter(Boolean),
            ...(logisticRows || []).map((x: any) => safeStr(x?.container_number)).filter(Boolean),
            ...(usRows || []).map((x: any) => safeStr(x?.container_number)).filter(Boolean),
        ];

        const seen = new Set<string>();
        const result = nums.filter((n) => {
            const k = n.trim();
            if (!k) return false;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        return result;
    }, [cbRows, logisticRows, usRows]);

    // ========= CB =========
    const startEditCb = useCallback((idx: number) => {
        if (!canEditCb) {
            toast.error(tt('common.noPermission'));
            return;
        }
        setCbRows((prev) => {
            const next = prev.map((x, i) => (i === idx ? {...x, edit: false} : x));
            const row = next[idx] || {};
            setCopyCb({
                ...row,
                importer: safeStr(row.importer),
                destination: safeStr(row.destination),
                transaction: safeStr(row.transaction),
                parse_code: safeStr(row.parse_code ?? row.parse ?? row.parse_code),
                cross_border_location: safeStr(row.cross_border_location),
                cross_border_time: toDatetimeLocal(row.cross_border_time),
                note: safeStr(row.note),
                gst_status: normalizeYesNo(row.gst_status),
                custom_status: row.custom_status ?? '',
                custom_status_time: toDatetimeLocal(row.custom_status_time),
            });
            return next;
        });
    }, [canEditCb, tt]);

    const cancelEditCb = useCallback((idx: number) => {
        setCbRows((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
    }, []);

    const submitCb = useCallback(
        async (idx: number) => {
            if (!truck_cb_id) return;
            if (!canEditCb) {
                toast.error(tt('common.noPermission'));
                return;
            }

            const row = cbRows[idx] || {};

            const payload: any = {
                truck_cb_id,
                container_id: row?.container_id ?? row?.truck_cb_container_id ?? row?.id,
                importer: copyCb.importer,
                destination: copyCb.destination,
                transaction: copyCb.transaction,
                parse: copyCb.parse_code,
                cross_border_location: copyCb.cross_border_location,
                cross_border_time: copyCb.cross_border_time
                    ? safeStr(copyCb.cross_border_time).replace('T', ' ') + ':00'
                    : '',
                note: copyCb.note,
                gst_status: yesNoTo01(copyCb.gst_status),
                custom_status: copyCb.custom_status !== '' && copyCb.custom_status !== undefined
                    ? Number(copyCb.custom_status)
                    : undefined,
                custom_status_time: copyCb.custom_status_time
                    ? safeStr(copyCb.custom_status_time).replace('T', ' ') + ':00'
                    : '',
            };

            await dispatch(updateTruckCbContainer(payload as any) as any);

            await dispatch(fetchMainTicketDetails({main_id} as any));
            await loadFiles();

            setCbRows((prev) => prev.map((x, i) => (i === idx ? {...x, ...copyCb, edit: true} : x)));
        },
        [dispatch, truck_cb_id, copyCb, userId, main_id, loadFiles, cbRows, canEditCb, tt]
    );

    // ========= Logistic =========
    const startEditLogistic = useCallback((idx: number) => {
        setLogisticRows((prev) => {
            const next = prev.map((x, i) => (i === idx ? {...x, edit: false} : x));
            const row = next[idx] || {};
            setCopyLogistic({
                ...row,
                container_id: row?.container_id ?? row?.truck_logistic_container_id ?? row?.id,
                container_number: safeStr(row.container_number),
                destination: safeStr(row.destination),
                destination_us: safeStr(row.destination_us),
                cross_border_location: safeStr(row.cross_border_location),
                cross_border_time: toDatetimeLocal(row.cross_border_time),
                warehouse_arrival_date: toDatetimeLocal(row.warehouse_arrival_date),
                portETA: toDatetimeLocal(row.portETA),
                pickup_container_date: toDateOnly(row.pickup_container_date),
                return_container_date: toDateOnly(row.return_container_date),
                cbm: safeStr(row.cbm),
                weight: safeStr(row.weight),
                container_note: safeStr(row.container_note),
                fcl: normalizeYesNo(row.fcl),
            });
            return next;
        });
    }, []);

    const cancelEditLogistic = useCallback((idx: number) => {
        setLogisticRows((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
    }, []);

    const submitLogistic = useCallback(
        async (idx: number) => {
            if (!truck_logistic_id) return;
            const row = logisticRows[idx] || {};
            const containerId = row.container_id ?? row.truck_logistic_container_id ?? row.id;

            const containerObj = {
                container_id: containerId,
                truck_logistic_container_id: containerId,
                container_number: copyLogistic.container_number,
                destination: copyLogistic.destination,
                cross_border_location: copyLogistic.cross_border_location,
                cross_border_time: copyLogistic.cross_border_time
                    ? safeStr(copyLogistic.cross_border_time).replace('T', ' ') + ':00'
                    : '',
                warehouse_arrival_date: copyLogistic.warehouse_arrival_date
                    ? safeStr(copyLogistic.warehouse_arrival_date).replace('T', ' ') + ':00'
                    : '',
                weight: copyLogistic.weight,
                cbm: copyLogistic.cbm,
                container_note: copyLogistic.container_note,
            };

            const payload: any = {
                truck_logistic_id,
                container_id: containerId,
                truck_logistic_container_id: containerId,
                fcl: yesNoTo01(copyLogistic.fcl),
                portETA: copyLogistic.portETA
                    ? safeStr(copyLogistic.portETA).replace('T', ' ') + ':00'
                    : '',
                destination_us: copyLogistic.destination_us,
                pickup_container_date: copyLogistic.pickup_container_date,
                return_container_date: copyLogistic.return_container_date,
                containers: [containerObj],
                truck_logistic_containers: [containerObj],
            };

            await dispatch(updateTruckLogistic(payload as any) as any);

            await dispatch(fetchMainTicketDetails({main_id} as any));
            await loadFiles();

            setLogisticRows((prev) =>
                prev.map((x, i) => (i === idx ? {...x, ...copyLogistic, edit: true} : x))
            );
        },
        [dispatch, truck_logistic_id, copyLogistic, logisticRows, userId, main_id, loadFiles]
    );

    // ========= US -> CA =========
    const startEditUsToCa = useCallback((idx: number) => {
        if (!canEditUsToCa) {
            toast.error(tt('common.noPermission'));
            return;
        }
        setUsRows((prev) => {
            const next = prev.map((x, i) => (i === idx ? {...x, edit: false} : x));
            const row = next[idx] || {};
            setCopyUsToCa({
                ...row,
                container_id: row?.container_id ?? row?.truck_us_ca_container_id ?? row?.id,
                container_number: safeStr(row.container_number),
                truck_company: safeStr(row.truck_company),
                destination: safeStr(row.destination),
                destination_us: safeStr(row.destination_us),
                cross_border_location: safeStr(row.cross_border_location),
                cross_border_time: toDatetimeLocal(row.cross_border_time),
                warehouse_arrival_date: toDatetimeLocal(row.warehouse_arrival_date),
                portETA: toDatetimeLocal(row.portETA),
                pickup_container_date: toDateOnly(row.pickup_container_date),
                return_container_date: toDateOnly(row.return_container_date),
                parse_code: safeStr(row.parse_code ?? row.parse ?? ''),
                cbm: safeStr(row.cbm),
                weight: safeStr(row.weight),
                service_type: row.service_type != null ? String(row.service_type) : '',
                container_note: safeStr(row.container_note),
                fcl: normalizeYesNo(row.fcl),
                go_warehouse: normalizeYesNo(row.go_warehouse),
            });
            return next;
        });
    }, [canEditUsToCa, tt]);

    const cancelEditUsToCa = useCallback((idx: number) => {
        setUsRows((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
    }, []);

    const submitUsToCa = useCallback(
        async (idx: number) => {
            if (!truck_us_ca_id) return;
            if (!canEditUsToCa) {
                toast.error(tt('common.noPermission'));
                return;
            }
            const row = usRows[idx] || {};
            const containerId = row.container_id ?? row.truck_us_ca_container_id ?? row.id;

            const containerObj = {
                container_id: containerId,
                truck_us_ca_container_id: containerId,
                container_number: copyUsToCa.container_number,
                truck_company: copyUsToCa.truck_company,
                destination: copyUsToCa.destination,
                cross_border_location: copyUsToCa.cross_border_location,
                cross_border_time: copyUsToCa.cross_border_time
                    ? safeStr(copyUsToCa.cross_border_time).replace('T', ' ') + ':00'
                    : '',
                warehouse_arrival_date: copyUsToCa.warehouse_arrival_date
                    ? safeStr(copyUsToCa.warehouse_arrival_date).replace('T', ' ') + ':00'
                    : '',
                parse: copyUsToCa.parse_code,
                weight: copyUsToCa.weight,
                cbm: copyUsToCa.cbm,
                container_note: copyUsToCa.container_note,
            };

            const payload: any = {
                truck_us_ca_id,
                container_id: containerId,
                truck_us_ca_container_id: containerId,
                fcl: yesNoTo01(copyUsToCa.fcl),
                go_warehouse: yesNoTo01(copyUsToCa.go_warehouse),
                service_type: copyUsToCa.service_type !== '' ? toNum(copyUsToCa.service_type) : undefined,
                portETA: copyUsToCa.portETA ? safeStr(copyUsToCa.portETA).replace('T', ' ') + ':00' : '',
                destination_us: copyUsToCa.destination_us,
                pickup_container_date: copyUsToCa.pickup_container_date,
                return_container_date: copyUsToCa.return_container_date,
                containers: [containerObj],
                truck_us_ca_containers: [containerObj],
            };

            await dispatch(updateTruckUsToCa(payload as any) as any);

            await dispatch(fetchMainTicketDetails({main_id} as any));
            await loadFiles();

            setUsRows((prev) =>
                prev.map((x, i) => (i === idx ? {
                    ...x,
                    ...copyUsToCa,
                    fcl: yesNoTo01(copyUsToCa.fcl),
                    go_warehouse: yesNoTo01(copyUsToCa.go_warehouse),
                    edit: true,
                } : x))
            );
        },
        [dispatch, truck_us_ca_id, copyUsToCa, usRows, userId, main_id, loadFiles, canEditUsToCa, tt]
    );

    // ========= CAD upload (admin uploads draft; client confirms) =========
    // ========= FILES =========
    const buildTruckUploadPayload = useCallback(
        (
            file: File,
            groupKey: string,
            updates?: Array<{ file_id: string | number; status: string | number }>
        ) => {
            const containerNums = getUploadContainerNumbers();

            const payload = {
                files: [file],
                sub_categories: [{type: groupKey, value: file.name}],
                truck_cb_ids: truck_cb_id ? [truck_cb_id] : undefined,
                truck_logistic_ids: truck_logistic_id ? [truck_logistic_id] : undefined,
                truck_us_ca_ids: truck_us_ca_id ? [truck_us_ca_id] : undefined,
                container_number: containerNums.length ? containerNums : undefined,
                updates: updates ?? [],
            };
            return payload;
        },
        [getUploadContainerNumbers, truck_cb_id, truck_logistic_id, truck_us_ca_id]
    );

    const replaceFile = useCallback((file: FileRow, groupKey: string) => {
        setReplaceTarget({file, groupKey});
        replaceInputRef.current?.click();
    }, []);

    const onReplaceChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const picked = e.target.files?.[0];
            e.target.value = '';

            if (!picked || !replaceTarget) return;

            setFileOpLoading(true);
            try {
                const oldFileId = replaceTarget.file?.file_id;

                const updates =
                    oldFileId !== undefined && oldFileId !== null && String(oldFileId).trim() !== ''
                        ? [{file_id: String(oldFileId), status: 3}]
                        : [];

                const payload = buildTruckUploadPayload(picked, replaceTarget.groupKey, updates);

                const res = await dispatch(uploadTruckFiles(payload as any) as any);
                await loadFiles();
                setReplaceTarget(null);
            } catch (err) {
                console.error('[onReplaceChange] error =', err);
            } finally {
                setFileOpLoading(false);
            }
        },
        [dispatch, buildTruckUploadPayload, loadFiles, replaceTarget]
    );

    const addFile = useCallback((groupKey: string) => {
        setAddTargetGroup(groupKey);
        addInputRef.current?.click();
    }, []);

    const onAddChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const picked = e.target.files?.[0];
            e.target.value = '';

            if (!picked || !addTargetGroup) return;

            setFileOpLoading(true);
            try {
                const payload = buildTruckUploadPayload(picked, addTargetGroup);
                const res = await dispatch(uploadTruckFiles(payload as any) as any);
                await loadFiles();
                setAddTargetGroup('');
            } catch (err) {
                console.error('[onAddChange] error =', err);
            } finally {
                setFileOpLoading(false);
            }
        },
        [dispatch, buildTruckUploadPayload, loadFiles, addTargetGroup]
    );

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
                    identifier: truckMsgNumber,
                    identifierKind: 'container',
                    jobId: main?.main_id,
                    dutiesAndTaxes: dutiesAndTaxes ?? undefined,
                });
                await sendMailApi({ to: recipients, subject, text, html });
            } catch (e) {
                console.error('[TruckDetails.notifyCad] email failed silently', e);
            }
        },
        [main?.user_id, main?.main_id, truckMsgNumber]
    );

    const handleUploadCad = useCallback(() => {
        cadUploadRef.current?.click();
    }, []);

    const onCadUploadChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (!picked || !truck_cb_id) return;

            setFileOpLoading(true);
            try {
                const updates = cadFile?.file_id
                    ? [{ file_id: String(cadFile.file_id), status: 3 }]
                    : [];
                const payload = buildTruckUploadPayload(picked, 'CAD', updates);
                await dispatch(uploadTruckFiles(payload as any) as any);
                await dispatch(
                    updateTruckCbContainer({ truck_cb_id, cad_status: 1 } as any) as any
                );
                await loadFiles();
                await notifyCad('draft', cadFile?.duties_and_taxes ?? null);
            } catch (err) {
                console.error('[onCadUploadChange]', err);
            } finally {
                setFileOpLoading(false);
            }
        },
        [dispatch, truck_cb_id, cadFile, buildTruckUploadPayload, loadFiles, notifyCad]
    );

    const handleUploadReleaseCad = useCallback(() => {
        releaseCadUploadRef.current?.click();
    }, []);

    const onReleaseCadUploadChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (!picked) return;

            setFileOpLoading(true);
            try {
                const updates = releaseCadFile?.file_id
                    ? [{ file_id: String(releaseCadFile.file_id), status: 3 }]
                    : [];
                const payload = buildTruckUploadPayload(picked, 'Release CAD', updates);
                await dispatch(uploadTruckFiles(payload as any) as any);
                await loadFiles();
                await notifyCad('release', releaseCadFile?.duties_and_taxes ?? null);
            } catch (err) {
                console.error('[onReleaseCadUploadChange]', err);
            } finally {
                setFileOpLoading(false);
            }
        },
        [dispatch, releaseCadFile, buildTruckUploadPayload, loadFiles, notifyCad]
    );

    const leaveMessage = useCallback(() => {
        alert(tt('orderList.table.note'));
    }, [tt]);

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
                {loading && <NewSpinner size="lg"/>}

                <Container fluid className="md-container">
                    <div className="md-topbar">
                        <BreadCrumb
                            title={tt('createOrder.truck.title')}
                            pageTitle={tt('orderList.breadcrumb')}
                        />
                    </div>

                    {(errorMsg || error) && (
                        <Alert color="danger" className="md-alert">
                            {errorMsg || error}
                        </Alert>
                    )}

                    <Card className="md-shell">
                        <CardBody className="md-shell__body">
                            <TicketHeader tt={tt} stepActive={stepActive} ticketType="Truck"/>

                            <div className="md-actionsRow">
                                <Button color="primary" className="md-btn md-btn--primary" onClick={goBack}>
                                    {tt('uploadMarine.actions.back')}
                                </Button>
                                {truckMsgPrimaryTaskId ? (
                                    <div className="d-flex align-items-center gap-2">
                                        <LeaveMessageChat
                                            title="Truck Message"
                                            taskId={truckMsgPrimaryTaskId}
                                            extraTaskIds={truckMsgExtraTaskIds}
                                            number={truckMsgNumber}
                                            id="truck_scrollbar_main"
                                            type={0}
                                            placement="end"
                                            openKey="chat.title"
                                            sendKey="chat.send"
                                            placeholderKey="chat.notification"
                                            userId={main?.user_id}
                                        />
                                        <InternalLeaveMessageChat
                                            title="Internal Chat"
                                            taskId={truckMsgPrimaryTaskId}
                                            extraTaskIds={truckMsgExtraTaskIds}
                                            number={truckMsgNumber}
                                            placement="end"
                                        />
                                    </div>
                                ) : null}
                            </div>

                            {/* ================= Truck CB ================= */}
                            {cbRows.length > 0 && <Card className="md-section">
                                <div className="md-sectionHead">
                                    <button
                                        className="md-sectionHead__toggle"
                                        onClick={() => toggle('cb')}
                                        type="button"
                                    >
                                        <span className={`md-chevron ${open.cb ? 'open' : ''}`}/>
                                        <span className="md-sectionHead__title">
                    {tt('orderList.sections.customsInfo')}
                  </span>
                                    </button>
                                </div>

                                <Collapse isOpen={open.cb}>
                                    <div className="md-section__body">
                                        {cbRows.map((m: AnyObj, idx: number) => {
                                            const editing = m.edit === false;

                                            return (
                                                <div className="md-item" key={`cb_${idx}`}>
                                                    <div className="md-item__head">
                                                        <div className="md-item__title">
                                                        <span
                                                            className="md-mono">{safeStr(m.container_number) || '-'}</span>

                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('order', m.ticket_status ?? m.status)}
                                                            >
                                                                {lookupMap(maps.order, m.ticket_status ?? m.status, '-')}
                                                            </Badge>

                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('customs', m.custom_status)}
                                                            >
                                                                {lookupMap(maps.customs, m.custom_status, '-')}
                                                            </Badge>

                                                            {m?.note && toNum(m.ticket_status) === 6 ? (
                                                                <span className="md-noteDanger">
                                {tt('state.cad.rejectReason')}: {safeStr(m.note)}
                              </span>
                                                            ) : null}
                                                        </div>

                                                        {canEdit && canEditCb && truck_cb_id && !editing ? (
                                                            <div className="md-item__actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--soft md-btn--compact"
                                                                    onClick={() => startEditCb(idx)}
                                                                >
                                                                    {tt('common.edit')}
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="md-grid">
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.importer')}
                                                            </div>
                                                            {editing ? (
                                                                <Input
                                                                    type="select"
                                                                    className="md-control"
                                                                    value={safeStr(copyCb.importer || '')}
                                                                    disabled={loadingImporterNames}
                                                                    onChange={(e) =>
                                                                        setCopyCb((p: AnyObj) => ({
                                                                            ...p,
                                                                            importer: e.target.value
                                                                        }))
                                                                    }
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
                                                                <Input className="md-control" value={safeStr(m.importer)}
                                                                       disabled/>
                                                            )}
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.referenceNumber')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(m.container_number)}
                                                                disabled
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.destination')}
                                                            </div>
                                                            {editing ? (
                                                                <Input
                                                                    type="select"
                                                                    className="md-control"
                                                                    value={safeStr(copyCb.destination || '')}
                                                                    disabled={loadingCities}
                                                                    onChange={(e) =>
                                                                        setCopyCb((p: AnyObj) => ({
                                                                            ...p,
                                                                            destination: e.target.value
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
                                                                    {cityOptions.map((c) => (
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

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.transaction')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyCb.transaction : m.transaction)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyCb((p: AnyObj) => ({
                                                                        ...p,
                                                                        transaction: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.parse')}</div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyCb.parse_code : m.parse_code)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyCb((p: AnyObj) => ({
                                                                        ...p,
                                                                        parse_code: e.target.value
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.crossBorderLocation')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyCb.cross_border_location : m.cross_border_location
                                                                )}
                                                                disabled={!editing}
                                                                maxLength={4}
                                                                onChange={(e) =>
                                                                    setCopyCb((p: AnyObj) => ({
                                                                        ...p,
                                                                        cross_border_location: e.target.value
                                                                            .replace(/\D/g, '')
                                                                            .slice(0, 4),
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.crossBorderTime')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "datetime-local" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyCb.cross_border_time
                                                                        : toDatetimeDisplay(m.cross_border_time)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyCb((p: AnyObj) => ({
                                                                        ...p,
                                                                        cross_border_time: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

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
                                                                {canEdit && truck_cb_id && toNum(m.ticket_status ?? m.status) !== 5 ? (
                                                                    <Button
                                                                        size="sm"
                                                                        className="md-btn md-btn--primary md-btn--compact"
                                                                        onClick={handleUploadCad}
                                                                        disabled={fileOpLoading}
                                                                    >
                                                                        Upload
                                                                    </Button>
                                                                ) : null}
                                                            </div>

                                                            <FileMini
                                                                file={cadFile as any}
                                                                viewLabel={tt('createOrder.actions.viewFile')}
                                                            />
                                                            {toNum(m.cad_status) === 3 && m.cad_note ? (
                                                                <div className="md-error-text">
                                                                    Rejected: {m.cad_note}
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.releaseCad')}
                                                            </div>
                                                            <div className="md-inline">
                                                                {canEdit && truck_cb_id && toNum(m.ticket_status ?? m.status) !== 5 ? (
                                                                    <Button
                                                                        size="sm"
                                                                        className="md-btn md-btn--primary md-btn--compact"
                                                                        onClick={handleUploadReleaseCad}
                                                                        disabled={fileOpLoading}
                                                                    >
                                                                        Upload
                                                                    </Button>
                                                                ) : null}
                                                            </div>
                                                            <FileMini
                                                                file={releaseCadFile as any}
                                                                viewLabel={tt('createOrder.actions.viewFile')}
                                                            />
                                                            {(releaseCadFile as any)?.classification_count != null ? (
                                                                <div className="md-hint-link md-hint-link--sm md-inline--mt">
                                                                    Valid Number {(releaseCadFile as any).classification_count}
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">GST + DUTY</div>
                                                            {editing ? (
                                                                <YesNoRadio
                                                                    name={`gst_cb_${idx}`}
                                                                    value={copyCb.gst_status}
                                                                    onChange={(v) =>
                                                                        setCopyCb((p: AnyObj) => ({...p, gst_status: v}))
                                                                    }
                                                                    yesLabel={tt('common.yes')}
                                                                    noLabel={tt('common.no')}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    className="md-control"
                                                                    value={
                                                                        toNum(m.gst_status) === 1 ? tt('common.yes') : tt('common.no')
                                                                    }
                                                                    disabled
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.table.note')}</div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyCb.note : m.note)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyCb((p: AnyObj) => ({...p, note: e.target.value}))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.orderStatus')}
                                                            </div>
                                                            <Badge
                                                                pill
                                                                className="md-badge md-badge--big"
                                                                color={badgeColorByKind('order', m.ticket_status ?? m.status)}
                                                            >
                                                                {lookupMap(maps.order, m.ticket_status ?? m.status, '-')}
                                                            </Badge>
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.iidStatus')}
                                                            </div>
                                                            {editing ? (
                                                                <Input
                                                                    type="select"
                                                                    className="md-control"
                                                                    value={safeStr(copyCb.custom_status ?? '')}
                                                                    onChange={(e) =>
                                                                        setCopyCb((p: AnyObj) => ({
                                                                            ...p,
                                                                            custom_status: e.target.value,
                                                                        }))
                                                                    }
                                                                >
                                                                    <option value="0">Unclear Customs</option>
                                                                    <option value="1">Accepted</option>
                                                                    <option value="2">Rejected</option>
                                                                    <option value="4">Released</option>
                                                                    <option value="5">Exam Required</option>
                                                                    <option value="9">Accepted/Waiting</option>
                                                                    <option value="34">Accepted/Awaiting Customs</option>
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

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.customsStatusTime')}
                                                            </div>
                                                            {editing ? (
                                                                <Input
                                                                    type="datetime-local"
                                                                    className="md-control"
                                                                    value={safeStr(copyCb.custom_status_time || '')}
                                                                    onChange={(e) =>
                                                                        setCopyCb((p: AnyObj) => ({
                                                                            ...p,
                                                                            custom_status_time: e.target.value,
                                                                        }))
                                                                    }
                                                                />
                                                            ) : (
                                                                <span className="md-value">{safeStr(m.custom_status_time) || '-'}</span>
                                                            )}
                                                        </div>
                                                        {canEdit && canEditCb && truck_cb_id && editing && (
                                                            <div className="md-field md-field--wide md-field--actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--ghost md-btn--compact"
                                                                    onClick={() => cancelEditCb(idx)}
                                                                >
                                                                    {tt('uploadMarine.actions.cancel')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--primary md-btn--compact"
                                                                    onClick={() => submitCb(idx)}
                                                                >
                                                                    {updating && <Spinner size="sm" className="me-2"/>}
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
                            </Card>}

                            {/* ================= Truck Logistic ================= */}
                            {logisticRows.length > 0 && <Card className="md-section">
                                <div className="md-sectionHead">
                                    <button
                                        className="md-sectionHead__toggle"
                                        onClick={() => toggle('logistic')}
                                        type="button"
                                    >
                                        <span className={`md-chevron ${open.logistic ? 'open' : ''}`}/>
                                        <span className="md-sectionHead__title">
                    {tt('orderList.sections.logisticsInfo')}
                  </span>
                                    </button>

                                </div>

                                <Collapse isOpen={open.logistic}>
                                    <div className="md-section__body">
                                        {logisticRows.map((m: AnyObj, idx: number) => {
                                            const editing = m.edit === false;
                                            return (
                                                <div className="md-item" key={`lg_${idx}`}>
                                                    <div className="md-item__head">
                                                        <div className="md-item__title">
                                                        <span
                                                            className="md-mono">{safeStr(m.container_number) || '-'}</span>
                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('pickup', m.container_status ?? m.status)}
                                                            >
                                                                {lookupMap(maps.pickup, m.container_status ?? m.status, '-')}
                                                            </Badge>
                                                        </div>

                                                        {canEdit && truck_logistic_id && !editing ? (
                                                            <div className="md-item__actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--soft md-btn--compact"
                                                                    onClick={() => startEditLogistic(idx)}
                                                                >
                                                                    {tt('common.edit')}
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="md-grid">
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.referenceNumber')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyLogistic.container_number : m.container_number
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        container_number: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.destination')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyLogistic.destination : m.destination)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        destination: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.destinationUs')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyLogistic.destination_us : m.destination_us
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        destination_us: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.crossBorderLocation')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyLogistic.cross_border_location
                                                                        : m.cross_border_location
                                                                )}
                                                                disabled={!editing}
                                                                maxLength={4}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        cross_border_location: e.target.value
                                                                            .replace(/\D/g, '')
                                                                            .slice(0, 4),
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.crossBorderTime')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "datetime-local" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyLogistic.cross_border_time
                                                                        : toDatetimeDisplay(m.cross_border_time)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        cross_border_time: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.cargoArrivalTime')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "datetime-local" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyLogistic.warehouse_arrival_date
                                                                        : toDatetimeDisplay(m.warehouse_arrival_date)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        warehouse_arrival_date: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.portEta')}</div>
                                                            <Input
                                                                type={editing ? "datetime-local" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyLogistic.portETA : toDatetimeDisplay(m.portETA)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        portETA: e.target.value
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.pickupDate')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "date" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyLogistic.pickup_container_date
                                                                        : toDateOnly(m.pickup_container_date)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        pickup_container_date: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.returnDate')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "date" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyLogistic.return_container_date
                                                                        : toDateOnly(m.return_container_date)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        return_container_date: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.shippingUnits')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyLogistic.cbm : m.cbm)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        cbm: e.target.value
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{`${tt('orderList.columns.weight')} (kg)`}</div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyLogistic.weight : m.weight)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        weight: e.target.value
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.table.note')}</div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyLogistic.container_note : m.container_note
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        container_note: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.fcl')}</div>
                                                            {editing ? (
                                                                <YesNoRadio
                                                                    name={`fcl_lg_${idx}`}
                                                                    value={copyLogistic.fcl}
                                                                    onChange={(v) => setCopyLogistic((p: AnyObj) => ({
                                                                        ...p,
                                                                        fcl: v
                                                                    }))}
                                                                    yesLabel={tt('common.yes')}
                                                                    noLabel={tt('common.no')}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    className="md-control"
                                                                    value={toNum(m.fcl) === 1 ? tt('common.yes') : tt('common.no')}
                                                                    disabled
                                                                />
                                                            )}
                                                        </div>
                                                        {canEdit && truck_logistic_id && editing && (
                                                            <div className="md-field md-field--wide md-field--actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--ghost md-btn--compact"
                                                                    onClick={() => cancelEditLogistic(idx)}
                                                                >
                                                                    {tt('uploadMarine.actions.cancel')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--primary md-btn--compact"
                                                                    onClick={() => submitLogistic(idx)}
                                                                >
                                                                    {updating && <Spinner size="sm" className="me-2"/>}
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
                            </Card>}

                            {/* ================= US -> CA ================= */}
                            {usRows.length > 0 && <Card className="md-section">
                                <div className="md-sectionHead">
                                    <button
                                        className="md-sectionHead__toggle"
                                        onClick={() => toggle('ustoca')}
                                        type="button"
                                    >
                                        <span className={`md-chevron ${open.ustoca ? 'open' : ''}`}/>
                                        <span className="md-sectionHead__title">
                    {tt('orderList.sections.truckUsCaInfo')}
                  </span>
                                    </button>
                                </div>

                                <Collapse isOpen={open.ustoca}>
                                    <div className="md-section__body">
                                        {usRows.map((m: AnyObj, idx: number) => {
                                            const editing = m.edit === false;
                                            return (
                                                <div className="md-item" key={`us_${idx}`}>
                                                    <div className="md-item__head">
                                                        <div className="md-item__title">
                                                        <span
                                                            className="md-mono">{safeStr(m.container_number) || '-'}</span>
                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('pickup', m.container_status ?? m.status)}
                                                            >
                                                                {lookupMap(maps.pickup, m.container_status ?? m.status, '-')}
                                                            </Badge>
                                                        </div>

                                                        {canEdit && canEditUsToCa && truck_us_ca_id && !editing ? (
                                                            <div className="md-item__actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--soft md-btn--compact"
                                                                    onClick={() => startEditUsToCa(idx)}
                                                                >
                                                                    {tt('common.edit')}
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="md-grid">
                                                        {/* Row 1: UserName | Container No | FCL | Is in Warehouse */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">UserName</div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(m.user_name)}
                                                                disabled
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.containerNumber')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyUsToCa.container_number : m.container_number
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        container_number: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">{tt('orderList.columns.fcl')}</div>
                                                            {editing ? (
                                                                <YesNoRadio
                                                                    name={`fcl_us_${idx}`}
                                                                    value={copyUsToCa.fcl}
                                                                    onChange={(v) => setCopyUsToCa((p: AnyObj) => ({...p, fcl: v}))}
                                                                    yesLabel={tt('common.yes')}
                                                                    noLabel={tt('common.no')}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    className="md-control"
                                                                    value={toNum(m.fcl) === 1 ? tt('common.yes') : tt('common.no')}
                                                                    disabled
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.goWarehouse')}
                                                            </div>
                                                            {editing ? (
                                                                <YesNoRadio
                                                                    name={`go_warehouse_us_${idx}`}
                                                                    value={copyUsToCa.go_warehouse}
                                                                    onChange={(v) => setCopyUsToCa((p: AnyObj) => ({...p, go_warehouse: v}))}
                                                                    yesLabel={tt('common.yes')}
                                                                    noLabel={tt('common.no')}
                                                                />
                                                            ) : (
                                                                <Input
                                                                    className="md-control"
                                                                    value={toNum(m.go_warehouse) === 1 ? tt('common.yes') : tt('common.no')}
                                                                    disabled
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Row 2: Truck Company | (spacer) | Destination | Departure */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.truckCompany')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyUsToCa.truck_company : m.truck_company)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        truck_company: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field" />

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.destination')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyUsToCa.destination : m.destination)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        destination: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.departure')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyUsToCa.destination_us : m.destination_us
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        destination_us: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        {/* Row 3: Port of Entry | Cross Board Time | Warehouse Arrival Date | Date for Pickup */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.crossBorderLocation')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                placeholder={tt('order.digits') || 'Enter 4-digit number'}
                                                                value={safeStr(
                                                                    editing ? copyUsToCa.cross_border_location : m.cross_border_location
                                                                )}
                                                                disabled={!editing}
                                                                maxLength={4}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        cross_border_location: e.target.value
                                                                            .replace(/\D/g, '')
                                                                            .slice(0, 4),
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.crossBorderTime')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "datetime-local" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyUsToCa.cross_border_time
                                                                        : toDatetimeDisplay(m.cross_border_time)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        cross_border_time: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.cargoArrivalTime')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "datetime-local" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyUsToCa.warehouse_arrival_date
                                                                        : toDatetimeDisplay(m.warehouse_arrival_date)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        warehouse_arrival_date: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.pickupDate')}
                                                            </div>
                                                            <Input
                                                                type={editing ? "date" : "text"}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing
                                                                        ? copyUsToCa.pickup_container_date
                                                                        : toDateOnly(m.pickup_container_date)
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        pickup_container_date: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        {/* Row 4: PARS | Shipping Units | Weight (kg) | Process Status */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.parse')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyUsToCa.parse_code : m.parse_code ?? m.parse)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        parse_code: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.shippingUnits')}
                                                            </div>
                                                            <Input
                                                                className="md-control"
                                                                placeholder="e.g. 10 pallets"
                                                                value={safeStr(editing ? copyUsToCa.cbm : m.cbm)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        cbm: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">{`${tt('orderList.columns.weight')} (kg)`}</div>
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(editing ? copyUsToCa.weight : m.weight)}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        weight: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>

                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('logistic.columns.containerStatus')}
                                                            </div>
                                                            <Badge
                                                                pill
                                                                className="md-badge md-badge--big"
                                                                color={badgeColorByKind('pickup', m.container_status ?? m.status)}
                                                            >
                                                                {lookupMap(maps.pickup, m.container_status ?? m.status, '-')}
                                                            </Badge>
                                                        </div>

                                                        {/* Row 5: Service Type | Note (spans 3 cols) */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.serviceType')}
                                                            </div>
                                                            {editing ? (
                                                                <Input
                                                                    type="select"
                                                                    className="md-control"
                                                                    value={safeStr(copyUsToCa.service_type ?? '')}
                                                                    onChange={(e) =>
                                                                        setCopyUsToCa((p: AnyObj) => ({
                                                                            ...p,
                                                                            service_type: e.target.value,
                                                                        }))
                                                                    }
                                                                >
                                                                    <option value="">{tt('common.select')}</option>
                                                                    <option value="0">{tt('truckUsaToCa.serviceType.usaToCa')}</option>
                                                                    <option value="1">{tt('truckUsaToCa.serviceType.caToUsa')}</option>
                                                                    <option value="2">{tt('truckUsaToCa.serviceType.dropship')}</option>
                                                                    <option value="3">{tt('truckUsaToCa.serviceType.fba')}</option>
                                                                    <option value="4">{tt('truckUsaToCa.serviceType.firstMile')}</option>
                                                                    <option value="5">{tt('truckUsaToCa.serviceType.thirdParty')}</option>
                                                                </Input>
                                                            ) : (
                                                                <Input
                                                                    className="md-control"
                                                                    value={(() => {
                                                                        const v = toNum(m.service_type);
                                                                        const map: Record<number, string> = {
                                                                            0: tt('truckUsaToCa.serviceType.usaToCa'),
                                                                            1: tt('truckUsaToCa.serviceType.caToUsa'),
                                                                            2: tt('truckUsaToCa.serviceType.dropship'),
                                                                            3: tt('truckUsaToCa.serviceType.fba'),
                                                                            4: tt('truckUsaToCa.serviceType.firstMile'),
                                                                            5: tt('truckUsaToCa.serviceType.thirdParty'),
                                                                        };
                                                                        return map[v] ?? '-';
                                                                    })()}
                                                                    disabled
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="md-field md-span-3">
                                                            <div className="md-field__label">{tt('orderList.table.note')}</div>
                                                            <Input
                                                                type="textarea"
                                                                rows={5}
                                                                className="md-control"
                                                                value={safeStr(
                                                                    editing ? copyUsToCa.container_note : m.container_note
                                                                )}
                                                                disabled={!editing}
                                                                onChange={(e) =>
                                                                    setCopyUsToCa((p: AnyObj) => ({
                                                                        ...p,
                                                                        container_note: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </div>
                                                        {canEdit && canEditUsToCa && truck_us_ca_id && editing && (
                                                            <div className="md-field md-field--wide md-field--actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--ghost md-btn--compact"
                                                                    onClick={() => cancelEditUsToCa(idx)}
                                                                >
                                                                    {tt('uploadMarine.actions.cancel')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--primary md-btn--compact"
                                                                    onClick={() => submitUsToCa(idx)}
                                                                >
                                                                    {updating && <Spinner size="sm" className="me-2"/>}
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
                            </Card>}

                            {/* ================= Toll Fee (PartiallyRepay) ================= */}
                            <PartiallyRepaySection
                                serviceType="truck"
                                task_id={main_id}
                                container_number={truckMsgNumber}
                                container_options={truckMsgContainerOptions}
                                truck_cb_id={truck_cb_id ? String(truck_cb_id) : undefined}
                                truck_logistic_id={truck_logistic_id ? String(truck_logistic_id) : undefined}
                                truck_us_ca_id={truck_us_ca_id ? String(truck_us_ca_id) : undefined}
                                locked={financeLocked}
                            />

                            {/* ================= Additional Fee ================= */}
                            <AdditionalFeeSection
                                serviceType="truck"
                                task_id={main_id}
                                container_number={truckMsgNumber}
                                container_options={truckMsgContainerOptions}
                                truck_cb_id={truck_cb_id ? String(truck_cb_id) : undefined}
                                truck_logistic_id={truck_logistic_id ? String(truck_logistic_id) : undefined}
                                truck_us_ca_id={truck_us_ca_id ? String(truck_us_ca_id) : undefined}
                                locked={financeLocked}
                                user_id={main?.user_id}
                            />

                            {/* ================= Files ================= */}
                            <FileGroupsSection
                                tt={tt}
                                open={open.files}
                                onToggle={() => toggle('files')}
                                canEdit={canEdit}
                                canDelete={canEdit && canDeleteFile}
                                fileGroups={fileGroups.map((g) => ({...g, key: g.key}))}
                                retrievingFiles={retrievingFiles}
                                uploadingMarineAir={uploadingTruck || fileOpLoading}
                                onAddFile={addFile}
                                onReplaceFile={replaceFile}
                                onDeleteFile={handleDeleteFile}
                                onPreviewFile={(url?: string) => url && handlePreviewFile(url)}
                                addInputRef={addInputRef}
                                replaceInputRef={replaceInputRef}
                                onAddChange={onAddChange}
                                onReplaceChange={onReplaceChange}
                            />


                            <FileGroupsSection
                                title={tt('files.supportingDocuments')}
                                tt={tt}
                                open={open.supportingFiles}
                                onToggle={() => toggle('supportingFiles')}
                                canEdit={canEdit}
                                canDelete={canEdit && canDeleteFile}
                                fileGroups={supportingFileGroups.map((g) => ({...g, key: g.key}))}
                                retrievingFiles={retrievingFiles}
                                uploadingMarineAir={uploadingTruck || fileOpLoading}
                                onAddFile={addFile}
                                onReplaceFile={replaceFile}
                                onDeleteFile={handleDeleteFile}
                                onPreviewFile={(url?: string) => url && handlePreviewFile(url)}
                                addInputRef={addInputRef}
                                replaceInputRef={replaceInputRef}
                                onAddChange={onAddChange}
                                onReplaceChange={onReplaceChange}
                            />

                        </CardBody>
                    </Card>

                    <input ref={cadUploadRef} type="file" accept=".pdf" className="d-none" onChange={onCadUploadChange} />
                    <input ref={releaseCadUploadRef} type="file" accept=".pdf" className="d-none" onChange={onReleaseCadUploadChange} />
                </Container>
            </div>
        </>
    );
};

export default TruckDetails;
