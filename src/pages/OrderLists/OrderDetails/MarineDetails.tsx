import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {toast} from 'react-toastify';
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
import Spinners from '../../../Components/Common/Spinner';
import {useTT} from '../../../helpers/useTT';
import {
    getUserIdFromSession,
    canDeleteFileFromSession,
    canEditLogisticService,
    canEditCbService,
} from '../../../helpers/userInformation';

import {fetchMainTicketDetails} from '../../../slices/ticketDetails/thunk';
import {
    retrieveFiles,
    uploadMarineAndAirFiles,
    fetchImporterNames,
} from '../../../slices/file/thunk';
import {
    updateMarineCbTicketDetails,
    updateMarineLogisticTicketDetails,
} from '../../../slices/marine/thunk';

import {fetchCities} from '../../../slices/order/thunk';

import FileGroupsSection from '../../../Components/Common/FileGroupsSection';
import TicketHeader from '../../../Components/Common/TicketHeader';
import FileMini from '../../../Components/Common/FileMini';
import Select from 'react-select';
import {createStatusMaps, lookupMap, safeStr, toNum} from '../helper';
import {openPreview} from '../../../helpers/filePreview';
import {normalizeYesNo, YesNoRadio, yesNoTo01} from '../../../Components/Common/YesNoRadio';
import {toDateOnly, toDateTimeLocal, fromDateTimeLocal} from '../../../helpers/date';
import {fmtDate, fmtDateTime} from '../../../helpers/dateUtils';

import {getImporterGstDutyApi} from '../../../helpers/api_fetch/poa';
import {adminDeleteFileApi} from '../../../helpers/api_fetch/files';
import {fetchUserEmailApi, sendMailApi} from '../../../helpers/api_fetch/email';
import {buildCadEmail, parseRecipientList} from '../../../helpers/mailTemplates';
import {
    badgeColorByKind,
    formatCanadianPostcode,
    formatDeliveryCity,
    isValidCanadianPostcode
} from '../../../helpers/helpers';
import LeaveMessageChat from '../../../Components/Common/LeaveMessageChat';
import InternalLeaveMessageChat from '../../../Components/Common/InternalLeaveMessageChat';
import {SHIPLINE_OPTIONS, getShiplineDisplay} from '../../../helpers/shipline';
import PartiallyRepaySection from './PartiallyRepaySection';
import AdditionalFeeSection from './AdditionalFeeSection';
import {buildApiUrl} from '../../../helpers/apiBase';
import {
    CREATE_MARINE_AN_EMF_UPLOAD_LINK,
    DOWNLOAD_ALL_FILES_ZIP,
    GET_CLIENT_USER_LIST,
    RETRIEVE_SALES_QUOTE_BY_USER
} from '../../../helpers/url_helper';

type AppDispatch = ThunkDispatch<any, any, AnyAction>;
type AnyObj = Record<string, any>;

export type ImporterName = { id: number | string; Name: string };


export type FileRow = {
    file_id?: any;
    file_url?: string;
    original_file_name?: string;
    fileName?: string;
    note?: string;
    sub_category?: any;
    status?: number;
    duties_and_taxes?: number | null;
    classification_count?: number | null;
};

export type FileGroup = { key: string; value: FileRow[] };

const DEFAULT_MAIN_FILE_GROUPS: FileGroup[] = [
    {key: 'AN/EMF', value: []},
    {key: 'Packing List/Invoice', value: []},
    {key: 'Pickup', value: []},
    {key: 'Telex', value: []},
    {key: 'Delivery Instructions', value: []},
    {key: 'BILL OF LADING', value: []},
    {key: 'Others', value: []},
];

const DEFAULT_SUPPORTING_FILE_GROUPS: FileGroup[] = [
    {key: 'POD', value: []},
    {key: 'EIR', value: []},
    {key: 'Proof of Charges', value: []},
];

const SUPPORTING_DOC_KEYS = ['POD', 'EIR', 'Proof of Charges'];

function useQuery() {
    const {search} = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

const pickTicketSlice = (s: any) => s.MainTicketDetails || {};
const pickFilesSlice = (s: any) => s.File || {};
const pickMarineSlice = (s: any) => s.Marine || {};
const pickCitiesSlice = (s: any) => s?.Order || {};

const MarineDetails = () => {
    const {tt, i18n} = useTT();
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const q = useQuery();

    const mainId = q.get('id') || '';
    const viewId = q.get('view_id') || '';
    const userId = useMemo(() => getUserIdFromSession(), []);

    const maps = useMemo(() => createStatusMaps((k, fallback) => tt(k) || fallback), [tt]);

    const ticketDetailsState = useSelector(pickTicketSlice);
    const loading = !!ticketDetailsState.loading;
    const errorMsg = ticketDetailsState.errorMsg;
    const error = ticketDetailsState.error;
    const result = ticketDetailsState.result;

    const dataInfo = useMemo(() => (result?.data?.[0] ?? null) as AnyObj | null, [result]);

    const filesState = useSelector(pickFilesSlice);
    const retrievingFiles = !!filesState.retrievingFiles;
    const uploadingMarineAir = !!filesState.uploadingMarineAir;

    const marineState = useSelector(pickMarineSlice);
    const updatingCb = !!marineState.updatingCb;
    const updatingLogistic = !!marineState.updatingLogistic;

    const [fileOpLoading, setFileOpLoading] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    const [updateBlockedMsg, setUpdateBlockedMsg] = useState<string>('');

    const citiesState = useSelector(pickCitiesSlice);
    const cities = useMemo(() => {
        const raw = citiesState?.cities ?? [];
        return raw;
    }, [citiesState]);

    const loadingCities = !!(
        citiesState?.loadingCities ??
        citiesState?.isLoading ??
        citiesState?.loading ??
        false
    );

    const cityOptions = useMemo(() => {
        const arr = Array.isArray(cities) ? cities : [];
        return arr
            .map((x: any) => {
                if (typeof x === 'string') return x;
                return x?.city ?? '';
            })
            .filter(Boolean);
    }, [cities]);

    const {importerNames, loadingImporterNames} = useMemo(() => {
        const raw = filesState.importerNames ?? [];
        const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const normalized: ImporterName[] = arr
            .map((x: any) => ({
                id: x?.id ?? '',
                Name: x?.Name ?? '',
            }))
            .filter((x: any) => !!safeStr(x.Name).trim());

        const seen = new Set<string>();
        const deduped = normalized.filter((x) => {
            const k = safeStr(x.Name).trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        const loadingFlag = !!filesState.loadingImporterNames || false;
        return {importerNames: deduped, loadingImporterNames: loadingFlag};
    }, [filesState]);

    const [cbMarine, setCbMarine] = useState<AnyObj[]>([]);
    const [logisticMarine, setLogisticMarine] = useState<AnyObj[]>([]);
    const [wmsMarine, setWmsMarine] = useState<AnyObj[]>([]);

    const fromLogistic = viewId === 'logistic';
    const fromCustoms = viewId === 'customs';
    const [open, setOpen] = useState({
        customs: !fromLogistic,
        pickup: !fromCustoms,
        warehouse: !fromLogistic && !fromCustoms,
        files: !fromLogistic,
        supportingFiles: !fromLogistic,
        quotes: true,
    });

    const [copyCustoms, setCopyCustoms] = useState<AnyObj>({});
    const [copyPickup, setCopyPickup] = useState<AnyObj>({});
    const [clientUsers, setClientUsers] = useState<{ user_id: string; user_name: string; company_name: string }[]>([]);

    // Sales Quotes
    const [quoteRows, setQuoteRows] = useState<any[]>([]);
    const [quoteTotal, setQuoteTotal] = useState(0);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quotePage, setQuotePage] = useState(1);
    const quotePageSize = 100;

    const [editingCustomsIdx, setEditingCustomsIdx] = useState<number | null>(null);
    const [gstTouched, setGstTouched] = useState(false);

    const [fileGroups, setFileGroups] = useState<FileGroup[]>(() =>
        JSON.parse(JSON.stringify(DEFAULT_MAIN_FILE_GROUPS))
    );

    const [supportingFileGroups, setSupportingFileGroups] = useState<FileGroup[]>(() =>
        JSON.parse(JSON.stringify(DEFAULT_SUPPORTING_FILE_GROUPS))
    );

    const [cadFile, setCadFile] = useState<FileRow | null>(null);
    const [releaseCadFile, setReleaseCadFile] = useState<FileRow | null>(null);


    const [hblInputVisible, setHblInputVisible] = useState(false);
    const [hblInputValue, setHblInputValue] = useState('');

    const replaceInputRef = useRef<HTMLInputElement | null>(null);
    const addInputRef = useRef<HTMLInputElement | null>(null);
    const cadFileInputRef = useRef<HTMLInputElement | null>(null);
    const releaseCadFileInputRef = useRef<HTMLInputElement | null>(null);

    const [replaceTarget, setReplaceTarget] = useState<{ file: FileRow; groupKey: string } | null>(
        null
    );
    const [addTargetGroup, setAddTargetGroup] = useState<string>('');

    // Pending Complete (8) stays editable even though it's numerically past
    // In Transit (2) — only statuses beyond that (Delivery/Total Completed,
    // Rejected, etc.) actually lock editing.
    const isUpdateLocked = useCallback((statusVal: any) => {
        const n = toNum(statusVal);
        return n > 2 && n !== 8;
    }, []);

    const canEdit = useMemo(() => {
        const s = dataInfo?.status;
        return s === null || s === undefined || toNum(s) === 0;
    }, [dataInfo?.status]);

    const canDeleteFile = useMemo(() => canDeleteFileFromSession(), []);

    // Logistic (Pickup) section: Logistic department or restriction 1 only.
    // Customs Brokerage (CB) section: DH department only.
    const canEditLogistic = useMemo(() => canEditLogisticService(), []);
    const canEditCb = useMemo(() => canEditCbService(), []);

    // `edit === false` means that row's edit form is currently open (see the
    // startEdit*/cancelEdit*/submit* functions above) — i.e. there are
    // in-progress changes that have not been submitted yet.
    const hasUnsavedEdits = useMemo(
        () =>
            cbMarine.some((r) => r?.edit === false) ||
            logisticMarine.some((r) => r?.edit === false),
        [cbMarine, logisticMarine]
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

    const formatMarineGoWarehouse = useCallback((v: any) => {
        const s = String(v ?? '');
        if (s === '0') return 'DH Warehouse';
        if (s === '1') return 'Third Party';
        if (s === '2') return 'D/O';
        return '-';
    }, []);

    const formatYesNoText = useCallback(
        (v: any) => {
            const s = String(v ?? '');
            if (s === '1') return tt('common.yes');
            if (s === '0') return tt('common.no');
            return '-';
        },
        [tt]
    );

    const toggleSection = useCallback((k: keyof typeof open) => {
        setOpen((p) => ({...p, [k]: !p[k]}));
    }, []);

    // wrapper preview
    const onPreviewFile = useCallback((url?: string) => {
        if (!url) return;
        openPreview(url);
    }, []);

    useEffect(() => {
        if (!mainId) return;
        dispatch(fetchMainTicketDetails({main_id: mainId} as any));
    }, [dispatch, mainId, userId]);

    useEffect(() => {
        if (!dataInfo) return;
        setCbMarine(
            Array.isArray(dataInfo.cb_marine)
                ? dataInfo.cb_marine.map((x: any) => ({...x, edit: true}))
                : []
        );
        setLogisticMarine(
            Array.isArray(dataInfo.logistic_marine)
                ? dataInfo.logistic_marine.map((x: any) => ({...x, edit: true}))
                : []
        );
        setWmsMarine(
            Array.isArray(dataInfo.wms_marine) ? dataInfo.wms_marine.map((x: any) => ({...x})) : []
        );
    }, [dataInfo]);

    useEffect(() => {
        if (!canEdit) return;
        const ticketUserId = dataInfo?.user_id;
        if (!ticketUserId) return;
        dispatch(fetchImporterNames({user_id: ticketUserId, status: 0}) as any);
    }, [dispatch, canEdit, dataInfo?.user_id]);

    useEffect(() => {
        dispatch(fetchCities() as any);
    }, [dispatch]);

    useEffect(() => {
        fetch(buildApiUrl(GET_CLIENT_USER_LIST), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({pageSize: 999, sortField: 'company_name', sortOrder: 'ASC'}),
        })
            .then((r) => r.json())
            .then((data) => {
                const list = Array.isArray(data?.data) ? data.data : [];
                setClientUsers(list.map((u: any) => ({
                    user_id: String(u.user_id ?? ''),
                    user_name: safeStr(u.user_name),
                    company_name: safeStr(u.company_name),
                })));
            })
            .catch(() => {
            });
    }, []);

    // Derived as a primitive (not the `logisticMarine` array itself) so this effect
    // only re-fires when the actual container number changes, not on every
    // edit/cancel/save toggle — startEditPickup/cancelEditPickup/submitPickup all
    // replace the whole `logisticMarine` array reference via .map(), which would
    // otherwise re-trigger a redundant fetch on nearly every Pickup interaction.
    const firstLogisticContainerNumber = String(logisticMarine?.[0]?.container_number ?? '').trim().toUpperCase();


    const firstLogisticPostcodePrefix = String(
        logisticMarine?.[0]?.postcode ?? ''
    )
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3);


    useEffect(() => {
        const userId = String(dataInfo?.user_id ?? '').trim();
        const logisticMarineId = String(
            dataInfo?.logistic_marine_id ?? ''
        ).trim();

        if (!userId) return;

        let cancelled = false;

        setQuoteLoading(true);

        fetch(buildApiUrl(RETRIEVE_SALES_QUOTE_BY_USER), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,

                ...(logisticMarineId && firstLogisticContainerNumber
                    ? {
                        logistic_marine_id: logisticMarineId,
                        container_number: firstLogisticContainerNumber,
                    }
                    : {}),

                page: quotePage,
                pageSize: quotePageSize,
                orderBy: 'create_time',
                orderDir: 'DESC',
            }),
        })
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;

                setQuoteRows(
                    Array.isArray(d?.data) ? d.data : []
                );

                setQuoteTotal(
                    Number(d?.totalRows ?? 0)
                );
            })
            .catch(() => {
            })
            .finally(() => {
                if (!cancelled) {
                    setQuoteLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        dataInfo?.user_id,
        dataInfo?.logistic_marine_id,
        firstLogisticContainerNumber,
        firstLogisticPostcodePrefix,
        quotePage,
    ]);

    // CAD / Release CAD will NOT go into "Others"
    const applyFileList = useCallback((list: FileRow[]) => {
        const mainBase: FileGroup[] = JSON.parse(JSON.stringify(DEFAULT_MAIN_FILE_GROUPS));
        const supportingBase: FileGroup[] = JSON.parse(JSON.stringify(DEFAULT_SUPPORTING_FILE_GROUPS));

        let cad: FileRow | null = null;
        let release: FileRow | null = null;

        (list || []).forEach((f) => {
            if (f?.status === 3) return;

            let sub: any = f.sub_category;
            if (typeof sub === 'string') {
                try {
                    sub = JSON.parse(sub);
                } catch {
                    sub = {};
                }
            }

            const type = sub?.type;

            if (type === 'CAD') {
                cad = f;
                return;
            }

            if (type === 'Release CAD') {
                release = f;
                return;
            }

            if (SUPPORTING_DOC_KEYS.includes(type)) {
                const idx = supportingBase.findIndex((g) => g.key === type);
                if (idx > -1) {
                    supportingBase[idx].value.push({...f});
                }
                return;
            }

            const idx = mainBase.findIndex((g) => g.key === type);
            if (idx > -1) {
                mainBase[idx].value.push({...f});
            } else {
                mainBase.find((g) => g.key === 'Others')?.value.push({...f});
            }
        });

        setFileGroups(mainBase);
        setSupportingFileGroups(supportingBase);
        setCadFile(cad);
        setReleaseCadFile(release);
    }, []);

    const marineMsgContainerOptions = useMemo(() => {
        const set = new Set<string>();

        (cbMarine || []).forEach((r: any) => {
            const c = String(r?.container_number || '').trim().toUpperCase();
            if (c) set.add(c);
        });

        (logisticMarine || []).forEach((r: any) => {
            const c = String(r?.container_number || '').trim().toUpperCase();
            if (c) set.add(c);
        });

        (wmsMarine || []).forEach((r: any) => {
            const c = String(r?.container_number || '').trim().toUpperCase();
            if (c) set.add(c);
        });

        return Array.from(set);
    }, [cbMarine, logisticMarine, wmsMarine]);

    const marineMsgPrimaryTaskId = useMemo(() => {
        return String(dataInfo?.main_id || '').trim();
    }, [dataInfo?.main_id]);

    const marineMsgExtraTaskIds = useMemo(() => {
        const ids = [
            dataInfo?.cb_marine_id,
            dataInfo?.logistic_marine_id,
            dataInfo?.wms_marine_id,
        ]
            .map((v) => String(v || '').trim())
            .filter(Boolean);

        return Array.from(new Set(ids));
    }, [dataInfo?.cb_marine_id, dataInfo?.logistic_marine_id, dataInfo?.wms_marine_id]);

    const marineMsgNumber = useMemo(() => {
        return marineMsgContainerOptions[0] || '';
    }, [marineMsgContainerOptions]);

    const marineAssignedName = useMemo(
        () => String(cbMarine?.[0]?.assigned_name || '').trim(),
        [cbMarine]
    );

    const marineTicketUserName = useMemo(
        () => String(cbMarine?.[0]?.user_name || '').trim(),
        [cbMarine]
    );

    const logisticMbl = useMemo(() => {
        const v = dataInfo?.logistic_marine?.[0]?.mbl;
        return v != null && String(v).trim() ? String(v).trim() : '';
    }, [dataInfo?.logistic_marine]);

    const logisticHblList = useMemo<string[]>(() => {
        const row = dataInfo?.logistic_marine?.[0];
        const arr = row?.hbl_list;
        if (Array.isArray(arr)) return arr.map((s: any) => String(s ?? '').trim()).filter(Boolean);
        const raw = row?.hbl;
        return raw ? String(raw).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    }, [dataInfo?.logistic_marine]);

    const loadSeqRef = useRef(0);

    const loadFiles = useCallback(async () => {
        if (!dataInfo) return;
        const seq = ++loadSeqRef.current;

        const p: any = {};
        if (dataInfo.cb_marine_id) p.cb_marine_id = dataInfo.cb_marine_id;
        else if (dataInfo.logistic_marine_id) p.logistic_marine_id = dataInfo.logistic_marine_id;
        else if (dataInfo.wms_marine_id) p.wms_marine_id = dataInfo.wms_marine_id;

        if (!Object.keys(p).length) {
            if (seq === loadSeqRef.current) applyFileList([]);
            return;
        }

        const list = await dispatch(retrieveFiles(p) as any);

        if (seq !== loadSeqRef.current) return;

        applyFileList(Array.isArray(list) ? list : []);
    }, [dispatch, dataInfo, applyFileList]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    const handleDeleteFile = useCallback(async (file: FileRow) => {
        const fileId = Number(file.file_id);
        if (!fileId) return;
        if (!window.confirm(tt('info.confirmDeleteFile', {fileName: file.original_file_name || file.fileName || ''}))) return;
        try {
            await adminDeleteFileApi(fileId);
            toast.success(tt('info.fileDeleteSuccess'));
            await loadFiles();
        } catch (e: any) {
            toast.error(e?.message || tt('info.fileDeleteFailed'));
        }
    }, [loadFiles, tt]);

    const hasCustoms = useMemo(() => {
        const st = cbMarine?.[0]?.status;
        return Boolean(dataInfo?.cb_marine_id && st !== 7);
    }, [dataInfo?.cb_marine_id, cbMarine]);

    const hasPickup = useMemo(() => {
        const st = logisticMarine?.[0]?.container_status;
        return Boolean(dataInfo?.logistic_marine_id && st !== 7);
    }, [dataInfo?.logistic_marine_id, logisticMarine]);

    const hasWarehouse = useMemo(() => {
        const st = wmsMarine?.[0]?.container_status ?? wmsMarine?.[0]?.status;
        return Boolean(dataInfo?.wms_marine_id && st !== 7);
    }, [dataInfo?.wms_marine_id, wmsMarine]);

    const stepActive = useMemo(() => {
        const n = toNum(dataInfo?.status);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(2, n));
    }, [dataInfo?.status]);

    const fetchImporterGstDuty = useCallback(
        async (importerName: string): Promise<0 | 1 | null> => {
            try {
                const nameKey = safeStr(importerName).trim().toLowerCase();
                const im = importerNames.find((x) => safeStr(x.Name).trim().toLowerCase() === nameKey);
                const importer_id = im?.id;

                const ticketUserId = userId;

                if (!importer_id || !ticketUserId) return null;

                const resp = await getImporterGstDutyApi({
                    user_id: String(ticketUserId),
                    importer_id: Number(importer_id),
                });

                const rows = Array.isArray(resp?.data) ? resp.data : [];
                const row = rows.find((r: any) => String(r?.importer_id) === String(importer_id));

                if (!row) return null;

                return Number(row?.gst_duty) === 1 ? 1 : 0;
            } catch {
                return null;
            }
        },
        [importerNames, userId]
    );

    // ===== Customs edit =====
    const startEditCustoms = (idx: number) => {
        if (!canEditCb) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            return;
        }
        const row = cbMarine?.[idx] ?? {};
        if (toNum(row?.status) === 5) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            return;
        }
        setUpdateBlockedMsg('');

        setCbMarine((prev) => {
            // Only one row may be in edit mode at a time — copyCustoms is a single
            // shared buffer, so leaving a previous row's edit open while starting
            // another would make both rows render (and save) the same values,
            // silently overwriting the first row's data with the second row's.
            const next = prev.map((x, i): AnyObj => ({...x, edit: i !== idx}));
            const r = next[idx];

            setEditingCustomsIdx(idx);
            setGstTouched(false);

            setCopyCustoms({
                ...r,
                importer: safeStr(r?.importer),
                destination: safeStr(r?.destination),
                fcl: normalizeYesNo(r?.fcl),
                rail: safeStr(r?.rail),
                shipline: safeStr(r?.shipline),
                gst_status: normalizeYesNo(r?.gst_status ?? r?.gst_duty),
                note: safeStr(r?.note),
                portETA: toDateTimeLocal(r?.portETA),
                trainETA: toDateTimeLocal(r?.trainETA),
                last_free_day: toDateTimeLocal(r?.last_free_day),
                custom_status: r?.custom_status !== undefined && r?.custom_status !== null ? String(r.custom_status) : '',
                custom_status_time: toDateTimeLocal(r?.custom_status_time),
                transaction: safeStr(r?.transaction),
            });

            return next;
        });
    };

    // Auto-sync GST when importer changes ONLY IF:
    // - currently editing a customs row
    // - user has NOT touched GST
    useEffect(() => {
        if (editingCustomsIdx === null) return;

        const importer = safeStr(copyCustoms?.importer).trim();
        if (!importer) return;

        if (gstTouched) return;

        (async () => {
            const v = await fetchImporterGstDuty(importer);
            if (v === null) return;

            setCopyCustoms((p) => ({
                ...p,
                gst_status: v === 1 ? 'Yes' : 'No',
            }));
        })();
    }, [editingCustomsIdx, copyCustoms?.importer, gstTouched, fetchImporterGstDuty]);

    const cancelEditCustoms = (idx: number) => {
        setCbMarine((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
        setEditingCustomsIdx(null);
        setGstTouched(false);
        setUpdateBlockedMsg('');
    };

    const submitCustoms = async (idx: number) => {
        if (!dataInfo?.cb_marine_id) return;
        if (!canEditCb) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            return;
        }
        const row = cbMarine[idx];

        if (toNum(row?.status) === 5) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            setCbMarine((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
            setEditingCustomsIdx(null);
            return;
        }
        setUpdateBlockedMsg('');

        setSavingEdit(true);
        try {
            const payload: any = {
                cb_marine_id: String(dataInfo.cb_marine_id),
                importer: copyCustoms.importer,
                destination: copyCustoms.destination,
                shipline: copyCustoms.shipline,
                note: copyCustoms.note ?? row?.note,
                fcl: yesNoTo01(copyCustoms.fcl),
                gst_status: yesNoTo01(copyCustoms.gst_status),
                rail: copyCustoms.rail,
                transaction: copyCustoms.transaction || undefined,
                custom_status: copyCustoms.custom_status !== '' && copyCustoms.custom_status !== undefined
                    ? Number(copyCustoms.custom_status)
                    : undefined,
                custom_status_time: fromDateTimeLocal(copyCustoms.custom_status_time),
                containers: [{
                    container_number: String(copyCustoms.container_number || row.container_number),
                    portETA: fromDateTimeLocal(copyCustoms.portETA),
                    trainETA: fromDateTimeLocal(copyCustoms.trainETA),
                    last_free_day: fromDateTimeLocal(copyCustoms.last_free_day),
                }],
            };

            await dispatch(updateMarineCbTicketDetails(payload) as any);
            await dispatch(fetchMainTicketDetails({main_id: mainId} as any));

            setCbMarine((prev) =>
                prev.map((x, i) =>
                    i === idx
                        ? {
                            ...x, ...copyCustoms,
                            fcl: yesNoTo01(copyCustoms.fcl),
                            gst_status: yesNoTo01(copyCustoms.gst_status),
                            edit: true
                        }
                        : x
                )
            );

            setEditingCustomsIdx(null);
            setGstTouched(false);
        } finally {
            setSavingEdit(false);
        }
    };

    // ===== Pickup edit =====
    const startEditPickup = (idx: number) => {
        if (!canEditLogistic) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            return;
        }
        const row = logisticMarine?.[idx] ?? {};
        if (isUpdateLocked(row?.container_status)) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            return;
        }
        setUpdateBlockedMsg('');
        setHblInputVisible(false);
        setHblInputValue('');

        setLogisticMarine((prev) => {
            // Only one row may be in edit mode at a time — copyPickup is a single
            // shared buffer, so leaving a previous row's edit open while starting
            // another would make both rows render (and save) the same values,
            // silently overwriting the first row's pk_num/note with the second
            // row's (often blank) ones.
            const next = prev.map((x, i): AnyObj => ({...x, edit: i !== idx}));
            const r = next[idx];

            const hblList: string[] = Array.isArray(r?.hbl_list)
                ? r.hbl_list.map((s: any) => String(s ?? '').trim()).filter(Boolean)
                : safeStr(r?.hbl)
                    ? safeStr(r.hbl).split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [];

            setCopyPickup({
                ...r,
                destination: safeStr(r?.destination),
                fcl: normalizeYesNo(r?.fcl),
                ers_status: normalizeYesNo(r?.ers_status),
                rail: safeStr(r?.rail),
                shipline: safeStr(r?.shipline ?? r?.vessel),
                tele: normalizeYesNo(r?.tele),
                pk_num: safeStr(r?.pk_num),
                goc_status: normalizeYesNo(r?.goc_status),
                go_warehouse:
                    r?.go_warehouse === 0 || r?.go_warehouse === '0'
                        ? '0'
                        : r?.go_warehouse === 1 || r?.go_warehouse === '1'
                            ? '1'
                            : r?.go_warehouse === 2 || r?.go_warehouse === '2'
                                ? '2'
                                : '',
                is_pickup_container:
                    r?.is_pickup_container === 1 || r?.is_pickup_container === '1'
                        ? '1'
                        : r?.is_pickup_container === 0 || r?.is_pickup_container === '0'
                            ? '0'
                            : '',
                pickup_container_date: toDateOnly(r?.pickup_container_date),
                return_container_date: toDateOnly(r?.return_container_date),
                delivery_city: safeStr(r?.delivery_city),
                postcode: safeStr(r?.postcode),
                user_id: safeStr(r?.user_id),
                mbl: safeStr(r?.mbl),
                hbl_list: hblList,
                container_note: safeStr(r?.container_note),
                last_free_day: toDateOnly(r?.last_free_day),
                portETA: toDateTimeLocal(r?.portETA),
                trainETA: toDateTimeLocal(r?.trainETA),
            });

            return next;
        });
    };

    const cancelEditPickup = (idx: number) => {
        setLogisticMarine((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
        setUpdateBlockedMsg('');
        setHblInputVisible(false);
        setHblInputValue('');
    };

    const submitPickup = async (idx: number) => {
        if (!dataInfo?.logistic_marine_id) return;
        if (!canEditLogistic) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            return;
        }
        const row = logisticMarine[idx];

        if (isUpdateLocked(row?.container_status)) {
            setUpdateBlockedMsg(tt('common.noPermission'));
            setLogisticMarine((prev) => prev.map((x, i) => (i === idx ? {...x, edit: true} : x)));
            return;
        }
        setUpdateBlockedMsg('');

        const pickupDate = toDateOnly(copyPickup.pickup_container_date);
        const returnDate = toDateOnly(copyPickup.return_container_date);
        const formattedDeliveryCity = formatDeliveryCity(copyPickup.delivery_city);
        const formattedPostcode = formatCanadianPostcode(copyPickup.postcode);
        if (formattedPostcode && !isValidCanadianPostcode(formattedPostcode)) {
            setUpdateBlockedMsg(tt('createOrder.errors.marine.badCanadianPostcode'));
            return;
        }
        setSavingEdit(true);
        try {
            const hblCsv = Array.isArray(copyPickup.hbl_list)
                ? copyPickup.hbl_list.map((s: any) => String(s ?? '').trim()).filter(Boolean).join(',')
                : safeStr(copyPickup.hbl ?? '');

            const payload: any = {
                logistic_marine_id: String(dataInfo.logistic_marine_id),
                destination: copyPickup.destination,
                mbl: copyPickup.mbl || undefined,
                hbl: hblCsv || undefined,
                fcl: yesNoTo01(copyPickup.fcl),
                ers_status: yesNoTo01(copyPickup.ers_status),
                go_warehouse:
                    copyPickup.go_warehouse === '' || copyPickup.go_warehouse === undefined
                        ? undefined
                        : Number(copyPickup.go_warehouse),
                is_pickup_container:
                    copyPickup.is_pickup_container === '' || copyPickup.is_pickup_container === undefined
                        ? undefined
                        : Number(copyPickup.is_pickup_container),
                rail: copyPickup.rail,
                goc_status: yesNoTo01(copyPickup.goc_status),
                containers: [
                    {
                        container_number: String(copyPickup.container_number ?? row.container_number),
                        shipline: copyPickup.shipline,
                        pk_num: copyPickup.pk_num,
                        tele: yesNoTo01(copyPickup.tele) || undefined,
                        pickup_container_date: pickupDate || undefined,
                        return_container_date: returnDate || undefined,
                        delivery_city: formattedDeliveryCity || undefined,
                        postcode: formattedPostcode || undefined,
                        portETA: copyPickup.portETA ? copyPickup.portETA.replace('T', ' ') + ':00' : undefined,
                        trainETA: copyPickup.trainETA ? copyPickup.trainETA.replace('T', ' ') + ':00' : undefined,
                        last_free_day: copyPickup.last_free_day || undefined,
                        container_note: copyPickup.container_note || undefined,
                    },
                ],
            };

            if (toNum(row.container_status) === 0 && copyPickup.user_id) {
                payload.user_id = String(copyPickup.user_id).trim();
            }

            await dispatch(updateMarineLogisticTicketDetails(payload) as any);
            await dispatch(fetchMainTicketDetails({main_id: mainId} as any));

            setLogisticMarine((prev) =>
                prev.map((x, i) =>
                    i === idx ? {...x, ...copyPickup, hbl: hblCsv, edit: true} : x
                )
            );
            setHblInputVisible(false);
            setHblInputValue('');
        } finally {
            setSavingEdit(false);
        }
    };


    const getMarineIdsPayload = useCallback(() => {
        return {
            cb_marine_ids: dataInfo?.cb_marine_id ? String(dataInfo.cb_marine_id) : undefined,
            logistic_marine_ids: dataInfo?.logistic_marine_id
                ? String(dataInfo.logistic_marine_id)
                : undefined,
            wms_marine_ids: dataInfo?.wms_marine_id ? String(dataInfo.wms_marine_id) : undefined,
            wms_marine_id: dataInfo?.wms_marine_id ? String(dataInfo.wms_marine_id) : undefined,
        };
    }, [dataInfo?.cb_marine_id, dataInfo?.logistic_marine_id, dataInfo?.wms_marine_id]);

    const financeLocked = useMemo(() => {
        const collectTimes = (rows: any[]) =>
            (Array.isArray(rows) ? rows : [])
                .map((r: any) => String(r?.completed_time || '').trim())
                .filter(Boolean);
        const times = [
            ...collectTimes(dataInfo?.cb_marine),
            ...collectTimes(dataInfo?.logistic_marine),
        ];
        if (!times.length) return false;
        const mostRecent = times.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
        const completedMs = new Date(mostRecent).getTime();
        if (isNaN(completedMs)) return false;
        return (Date.now() - completedMs) / (1000 * 60 * 60 * 24) >= 30;
    }, [dataInfo?.cb_marine, dataInfo?.logistic_marine]);

    const notifyCad = useCallback(
        async (kind: 'draft' | 'release', dutiesAndTaxes?: number | null) => {
            const ticketUserId = dataInfo?.user_id;
            if (!ticketUserId) return;
            try {
                const emailInfo = await fetchUserEmailApi(ticketUserId);
                const recipients = parseRecipientList(emailInfo?.email);
                if (!recipients.length) return;
                const container = cbMarine[0]?.container_number || logisticMarine[0]?.container_number || '';
                const {subject, text, html} = buildCadEmail({
                    kind,
                    lang: (emailInfo?.language ?? 0) as 0 | 1,
                    userName: emailInfo?.user_name,
                    identifier: container,
                    identifierKind: 'container',
                    jobId: dataInfo?.main_id,
                    dutiesAndTaxes: dutiesAndTaxes ?? undefined,
                });
                await sendMailApi({to: recipients, subject, text, html});
            } catch (e) {
                console.error('[MarineDetails.notifyCad] email failed silently', e);
            }
        },
        [dataInfo?.user_id, dataInfo?.main_id, cbMarine, logisticMarine]
    );

    const handleUploadCad = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !dataInfo?.cb_marine_id) return;
            setFileOpLoading(true);
            try {
                const payload: any = {
                    files: [file],
                    sub_categories: {type: 'CAD', value: file.name},
                    ...getMarineIdsPayload(),
                };
                if (cadFile?.file_id) {
                    payload.updates = [{file_id: cadFile.file_id, status: 3}];
                }
                await dispatch(uploadMarineAndAirFiles(payload) as any);
                await dispatch(
                    updateMarineCbTicketDetails({
                        cb_marine_id: String(dataInfo.cb_marine_id),
                        cad_status: 1,
                    } as any) as any
                );
                await loadFiles();
                await notifyCad('draft', cadFile?.duties_and_taxes ?? null);
            } finally {
                setFileOpLoading(false);
            }
        },
        [dataInfo?.cb_marine_id, cadFile, dispatch, getMarineIdsPayload, uploadMarineAndAirFiles, updateMarineCbTicketDetails, loadFiles, notifyCad]
    );

    const handleUploadReleaseCad = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file || !dataInfo?.cb_marine_id) return;
            setFileOpLoading(true);
            try {
                const payload: any = {
                    files: [file],
                    sub_categories: {type: 'Release CAD', value: file.name},
                    ...getMarineIdsPayload(),
                };
                if (releaseCadFile?.file_id) {
                    payload.updates = [{file_id: releaseCadFile.file_id, status: 3}];
                }
                await dispatch(uploadMarineAndAirFiles(payload) as any);
                await dispatch(
                    updateMarineCbTicketDetails({
                        cb_marine_id: String(dataInfo.cb_marine_id),
                        release_cad_status: 1,
                    } as any) as any
                );
                await loadFiles();
                await notifyCad('release', releaseCadFile?.duties_and_taxes ?? null);
            } finally {
                setFileOpLoading(false);
            }
        },
        [dataInfo?.cb_marine_id, releaseCadFile, dispatch, getMarineIdsPayload, uploadMarineAndAirFiles, updateMarineCbTicketDetails, loadFiles, notifyCad]
    );

    const handleCopyAnEmfLink = useCallback(async (item: AnyObj) => {
        const cbMarineId = String(item?.cb_marine_id || dataInfo?.cb_marine_id || '').trim();
        const containerNumber = String(item?.container_number || '').trim().toUpperCase();
        if (!cbMarineId || !containerNumber) {
            toast.error(tt('info.missingIdsForLink'));
            return;
        }
        try {
            const res = await fetch(buildApiUrl(CREATE_MARINE_AN_EMF_UPLOAD_LINK), {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({cb_marine_id: cbMarineId, container_number: containerNumber}),
            });
            const json = await res.json();
            console.log('[copyAnEmfLink] server response:', JSON.stringify(json));
            // Server returns { uploadUrl: "..." } at root (axios in Vue reads res.data.uploadUrl)
            const link = String(json?.uploadUrl || json?.data?.uploadUrl || '').trim();
            if (!link) throw new Error(json?.message || json?.error || 'No upload link returned');
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(link);
            } else {
                const ta = document.createElement('textarea');
                ta.value = link;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            toast.success(tt('info.copyLink') + ' ✓');
        } catch (e: any) {
            toast.error(e?.message || tt('info.createLinkFailed'));
        }
    }, [dataInfo?.cb_marine_id, tt]);

    const handleDownloadAllFiles = useCallback(async () => {
        const payload: any = {
            exclude_types: ['CAD', 'Release CAD'],
        };

        if (dataInfo?.cb_marine_id) {
            payload.cb_marine_id = dataInfo.cb_marine_id;
        }

        if (dataInfo?.logistic_marine_id) {
            payload.logistic_marine_id =
                dataInfo.logistic_marine_id;
        }

        if (dataInfo?.wms_marine_id) {
            payload.wms_marine_id = dataInfo.wms_marine_id;
        }

        if (
            !Object.keys(payload).filter(
                (key) => key !== 'exclude_types'
            ).length
        ) {
            toast.warning(
                tt('info.noServiceIdForDownload')
            );
            return;
        }

        const toastId = toast.loading(
            tt('info.zipPreparing') || 'Preparing zip…'
        );

        try {
            const res = await fetch(
                buildApiUrl(DOWNLOAD_ALL_FILES_ZIP),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                throw new Error(
                    `Download failed with status ${res.status}`
                );
            }

            const contentLength =
                res.headers.get('Content-Length');

            const parsedContentLength = contentLength
                ? Number.parseInt(contentLength, 10)
                : 0;

            const total =
                Number.isFinite(parsedContentLength) &&
                parsedContentLength > 0
                    ? parsedContentLength
                    : 0;

            let blob: Blob;

            if (total > 0 && res.body) {
                const reader = res.body.getReader();

                /*
                 * Use ArrayBuffer[] instead of Uint8Array[].
                 *
                 * This avoids the newer TypeScript generic typed-array
                 * issue involving Uint8Array<ArrayBufferLike>.
                 */
                const chunks: ArrayBuffer[] = [];
                let received = 0;

                while (true) {
                    const {done, value} =
                        await reader.read();

                    if (done) {
                        break;
                    }

                    /*
                     * reader.read() may return value as undefined
                     * according to its TypeScript definition.
                     */
                    if (!value) {
                        continue;
                    }

                    /*
                     * Make a safe ArrayBuffer-backed copy.
                     */
                    const copiedChunk = new Uint8Array(
                        value.byteLength
                    );

                    copiedChunk.set(value);

                    chunks.push(copiedChunk.buffer);

                    received += copiedChunk.byteLength;

                    toast.update(toastId, {
                        progress: Math.min(
                            received / total,
                            1
                        ),
                    });
                }

                blob = new Blob(chunks, {
                    type: 'application/zip',
                });
            } else {
                blob = await res.blob();
            }

            if (blob.size === 0) {
                throw new Error(
                    'The downloaded ZIP file is empty.'
                );
            }

            const url = URL.createObjectURL(blob);

            try {
                const anchor =
                    document.createElement('a');

                anchor.href = url;
                anchor.download = 'exported_files.zip';

                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
            } finally {
                URL.revokeObjectURL(url);
            }

            toast.update(toastId, {
                render:
                    tt('info.zipDone') ||
                    'Download complete!',
                type: 'success',
                isLoading: false,
                autoClose: 3000,
                progress: undefined,
            });
        } catch (error) {
            console.error(
                '[handleDownloadAllFiles] error:',
                error
            );

            toast.update(toastId, {
                render:
                    tt('info.zipFailed') ||
                    'Failed to download zip',
                type: 'error',
                isLoading: false,
                autoClose: 4000,
                progress: undefined,
            });
        }
    }, [
        dataInfo?.cb_marine_id,
        dataInfo?.logistic_marine_id,
        dataInfo?.wms_marine_id,
        tt,
    ]);

    const replaceFile = (file: FileRow, groupKey: string) => {
        setReplaceTarget({file, groupKey});
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
                sub_categories: {type: replaceTarget.groupKey, value: f.name},
                updates: [{file_id: replaceTarget.file.file_id, status: 3}],
                ...getMarineIdsPayload(),
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
                sub_categories: {type: addTargetGroup, value: f.name},
                ...getMarineIdsPayload(),
            };

            await dispatch(uploadMarineAndAirFiles(payload as any) as any);
            await loadFiles();
            setAddTargetGroup('');
        } finally {
            setFileOpLoading(false);
        }
    };

    return (
        <div className="md-page">
            {loading && <NewSpinner size="lg"/>}

            {(fileOpLoading || uploadingMarineAir || savingEdit) && (
                <Spinners size="lg" setLoading={setFileOpLoading}/>
            )}

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

            <Container fluid className="md-container">
                <div className="md-topbar">
                    <div className="md-topbar__left">
                        <BreadCrumb
                            title={tt('uploadMarine.title')}
                            pageTitle={tt('uploadMarine.breadcrumb')}
                        />
                    </div>
                </div>

                {(errorMsg || error) && (
                    <Alert color="danger" className="md-alert">
                        {errorMsg || error}
                    </Alert>
                )}

                {updateBlockedMsg ? (
                    <div className="md-center-alert">
                        <Alert color="warning" toggle={() => setUpdateBlockedMsg('')}>
                            {updateBlockedMsg}
                        </Alert>
                    </div>
                ) : null}


                <Card className="md-shell">
                    <CardBody className="md-shell__body">
                        <TicketHeader tt={tt} stepActive={stepActive} ticketType="Marine"/>

                        <div className="md-actionsRow">
                            <Button color="primary" className="md-btn md-btn--primary" onClick={goBack}>
                                {tt('uploadMarine.actions.back')}
                            </Button>
                            <div className="d-flex align-items-center gap-2">
                                {marineMsgPrimaryTaskId && marineMsgNumber ? (
                                    <LeaveMessageChat
                                        title="Marine Message"
                                        taskId={marineMsgPrimaryTaskId}
                                        extraTaskIds={marineMsgExtraTaskIds}
                                        number={marineMsgNumber}
                                        id="scrollbar1"
                                        type={0}
                                        placement="end"
                                        openKey="chat.title"
                                        sendKey="chat.send"
                                        placeholderKey="chat.notification"
                                        assignedName={marineAssignedName}
                                        ticketUserName={marineTicketUserName}
                                        userId={dataInfo?.user_id}
                                    />
                                ) : null}
                                {marineMsgPrimaryTaskId && marineMsgNumber ? (
                                    <InternalLeaveMessageChat
                                        title="Internal Chat"
                                        taskId={marineMsgPrimaryTaskId}
                                        extraTaskIds={marineMsgExtraTaskIds}
                                        number={marineMsgNumber}
                                        id="scrollbar_internal_1"
                                        placement="end"
                                    />
                                ) : null}
                            </div>
                        </div>

                        {/* ================= Customs ================= */}
                        {hasCustoms && (
                            <Card className="md-section">
                                <div className="md-sectionHead">
                                    <button
                                        type="button"
                                        className="md-sectionHead__toggle"
                                        onClick={() => toggleSection('customs')}
                                    >
                                        <span className={`md-chevron ${open.customs ? 'open' : ''}`}/>
                                        <span className="md-sectionHead__title">
                      {tt('uploadMarine.serviceOptions.customs')}
                    </span>
                                    </button>

                                </div>

                                <Collapse isOpen={open.customs}>
                                    <CardBody className="md-section__body">
                                        {cbMarine.map((item: AnyObj, idx: number) => {
                                            const showRejectNote = item?.note && toNum(item?.status) === 6;
                                            const allowEditBtn = canEdit && canEditCb && toNum(item?.status) !== 5;

                                            return (
                                                <div className="md-item" key={`cb_${idx}`}>
                                                    <div className="md-item__head">
                                                        <div className="md-item__title">
                                                            <span
                                                                className="md-mono">{safeStr(item.container_number)}</span>

                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('order', item.status)}
                                                            >
                                                                {lookupMap(maps.order, item.status, '-')}
                                                            </Badge>

                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('customs', item.custom_status)}
                                                            >
                                                                {lookupMap(maps.customs, item.custom_status, '-')}
                                                            </Badge>

                                                            {showRejectNote ? (
                                                                <span className="md-noteDanger">
                                  {tt('orderList.table.note')}: {safeStr(item.note)}
                                </span>
                                                            ) : null}
                                                        </div>

                                                        <div className="md-item__actions">
                                                            <Button
                                                                size="sm"
                                                                color="success"
                                                                outline
                                                                className="md-btn md-btn--compact"
                                                                onClick={() => handleCopyAnEmfLink(item)}
                                                            >
                                                                {tt('info.copyLink') || 'Copy Link'}
                                                            </Button>

                                                            {allowEditBtn && item.edit && (
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--soft"
                                                                    onClick={() => startEditCustoms(idx)}
                                                                >
                                                                    {tt('common.edit')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="md-grid">
                                                        {/* 1. Importer */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.importer')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {!item.edit ? (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.importer || '')}
                                                                        disabled={loadingImporterNames}
                                                                        onChange={(e) => {
                                                                            setCopyCustoms((p) => ({
                                                                                ...p,
                                                                                importer: e.target.value,
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <option value="">
                                                                            {loadingImporterNames
                                                                                ? tt('ticketSummary.loading')
                                                                                : tt('common.selectImporter')}
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
                                                                        value={safeStr(item.importer)}
                                                                        disabled
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 2. Container Number */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.containerNumber')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(item.container_number)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.container_number ?? item.container_number)}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            container_number: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 3. Destination */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.destination')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(item.destination)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.destination || '')}
                                                                        disabled={loadingCities}
                                                                        onChange={(e) =>
                                                                            setCopyCustoms((p) => ({
                                                                                ...p,
                                                                                destination: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.selectDestination')}
                                                                        </option>

                                                                        {cityOptions.length === 0 && !loadingCities ? (
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
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 4. Shipline */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.shipline')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={getShiplineDisplay(item.shipline)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.shipline ?? item.shipline ?? '')}
                                                                        onChange={(e) =>
                                                                            setCopyCustoms((p) => ({
                                                                                ...p,
                                                                                shipline: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.select')}
                                                                        </option>
                                                                        {SHIPLINE_OPTIONS.map((opt) => (
                                                                            <option key={opt.code} value={opt.code}>
                                                                                {opt.label} - {opt.code}
                                                                            </option>
                                                                        ))}
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 5. portETA */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.portEta')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDateTime(item.portETA)} disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="datetime-local"
                                                                        className={`md-control${!copyCustoms.portETA ? ' md-date-empty' : ''}`}
                                                                        value={copyCustoms.portETA ?? ''}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            portETA: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 6. trainETA */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.trainEta')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDateTime(item.trainETA)} disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="datetime-local"
                                                                        className={`md-control${!copyCustoms.trainETA ? ' md-date-empty' : ''}`}
                                                                        value={copyCustoms.trainETA ?? ''}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            trainETA: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 7. Last Free Day */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">Last Free Day</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDateTime(item.last_free_day)}
                                                                           disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="datetime-local"
                                                                        className={`md-control${!copyCustoms.last_free_day ? ' md-date-empty' : ''}`}
                                                                        value={copyCustoms.last_free_day ?? ''}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            last_free_day: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 8. Draft CAD */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.draftCad')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    className="d-none"
                                                                    ref={cadFileInputRef}
                                                                    onChange={handleUploadCad}
                                                                />
                                                                <div className="md-inline">
                                                                    <Badge
                                                                        pill
                                                                        className="md-badge md-badge--big"
                                                                        color={badgeColorByKind('cad', item.cad_status)}
                                                                    >
                                                                        {lookupMap(maps.cad, item.cad_status, '-')}
                                                                    </Badge>

                                                                    <Button
                                                                        size="sm"
                                                                        color="primary"
                                                                        className="md-btn md-btn--compact"
                                                                        disabled={fileOpLoading || uploadingMarineAir || toNum(item.status) === 5}
                                                                        onClick={() => cadFileInputRef.current?.click()}
                                                                    >
                                                                        Upload
                                                                    </Button>

                                                                </div>

                                                                <FileMini
                                                                    file={cadFile}
                                                                    viewLabel={tt('createOrder.actions.viewFile')}
                                                                />

                                                                {cadFile?.file_id && (
                                                                    <div className="md-inline md-inline--mt">
                                                                        {cadFile.duties_and_taxes != null && (
                                                                            <span className="md-hint-link">
                                        CA${cadFile.duties_and_taxes}
                                      </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {toNum(item.cad_status) === 3 && item.cad_note && (
                                                                    <div className="md-error-text">
                                                                        {tt('info.txt79') || 'Rejected'}: {item.cad_note}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 9. Release CAD */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.releaseCad')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    className="d-none"
                                                                    ref={releaseCadFileInputRef}
                                                                    onChange={handleUploadReleaseCad}
                                                                />
                                                                <div className="md-inline md-inline--mb">
                                                                    <Button
                                                                        size="sm"
                                                                        color="primary"
                                                                        className="md-btn md-btn--compact"
                                                                        disabled={fileOpLoading || uploadingMarineAir || toNum(item.status) === 5}
                                                                        onClick={() => releaseCadFileInputRef.current?.click()}
                                                                    >
                                                                        Upload
                                                                    </Button>
                                                                </div>
                                                                <FileMini
                                                                    file={releaseCadFile}
                                                                    viewLabel={tt('createOrder.actions.viewFile')}
                                                                />
                                                                {releaseCadFile?.file_id && (
                                                                    <div className="md-inline md-inline--mt">
                                                                        {releaseCadFile.duties_and_taxes != null && (
                                                                            <span className="md-hint-link">
                                        CA${releaseCadFile.duties_and_taxes}
                                      </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {releaseCadFile?.classification_count != null && (
                                                                    <div className="md-hint-link md-inline--mt">
                                                                        Valid
                                                                        Number {releaseCadFile.classification_count}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 10. Custom Status */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.iidStatus') || 'Customs Status'}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Badge pill className="md-badge md-badge--big"
                                                                           color={badgeColorByKind('customs', item.custom_status)}>
                                                                        {lookupMap(maps.customs, item.custom_status, '-')}
                                                                    </Badge>
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.custom_status ?? '')}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            custom_status: e.target.value
                                                                        }))}
                                                                    >
                                                                        <option value="">— Select —</option>
                                                                        <option
                                                                            value="0">{lookupMap(maps.customs, 0, 'Unclear Customs')}</option>
                                                                        <option
                                                                            value="1">{lookupMap(maps.customs, 1, 'Accepted')}</option>
                                                                        <option
                                                                            value="2">{lookupMap(maps.customs, 2, 'Rejected')}</option>
                                                                        <option
                                                                            value="4">{lookupMap(maps.customs, 4, 'Released')}</option>
                                                                        <option
                                                                            value="5">{lookupMap(maps.customs, 5, 'Exam Required')}</option>
                                                                        <option
                                                                            value="9">{lookupMap(maps.customs, 9, 'Accepted / Waiting')}</option>
                                                                        <option
                                                                            value="34">{lookupMap(maps.customs, 34, 'Accepted / Awaiting Customs')}</option>
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 10b. Custom Status Time */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.customsStatusTime')}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDateTime(item.custom_status_time) || ''}
                                                                           disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="datetime-local"
                                                                        className="md-control"
                                                                        value={copyCustoms.custom_status_time ?? ''}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            custom_status_time: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 11. Order Status */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.status') || 'Order Status'}
                                                            </div>
                                                            <div className="md-field__control">
                                                                <Badge
                                                                    pill
                                                                    className="md-badge md-badge--big"
                                                                    color={badgeColorByKind('order', item.status)}
                                                                >
                                                                    {lookupMap(maps.order, item.status, '-')}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {/* 13. Transaction */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">Transaction</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={safeStr(item.transaction)} disabled/>
                                                                ) : (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.transaction ?? '')}
                                                                        onChange={(e) => setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            transaction: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 14. Assignee */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('info.assignee') || 'Assignee'}</div>
                                                            <div className="md-field__control">
                                                                <Input className="md-control"
                                                                       value={safeStr(item.user_name)} disabled/>
                                                            </div>
                                                        </div>

                                                        {/* 15. Creator */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('info.creator') || 'Creator'}</div>
                                                            <div className="md-field__control">
                                                                <Input className="md-control"
                                                                       value={safeStr(item.creator_name) || '-'}
                                                                       disabled/>
                                                            </div>
                                                        </div>

                                                        {/* 16. FCL (FCL/LCL labels to match Vue) */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.fcl')}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={toNum(item.fcl) === 1 ? 'FCL' : 'LCL'}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <div className="d-flex gap-3">
                                                                        <label
                                                                            className="d-flex align-items-center gap-1 cursor-pointer">
                                                                            <input
                                                                                type="radio"
                                                                                name={`cb_fcl_${idx}`}
                                                                                value="1"
                                                                                checked={toNum(copyCustoms.fcl) === 1}
                                                                                onChange={() => setCopyCustoms((p) => ({
                                                                                    ...p,
                                                                                    fcl: 1
                                                                                }))}
                                                                            />
                                                                            FCL
                                                                        </label>
                                                                        <label
                                                                            className="d-flex align-items-center gap-1 cursor-pointer">
                                                                            <input
                                                                                type="radio"
                                                                                name={`cb_fcl_${idx}`}
                                                                                value="0"
                                                                                checked={toNum(copyCustoms.fcl) === 0}
                                                                                onChange={() => setCopyCustoms((p) => ({
                                                                                    ...p,
                                                                                    fcl: 0
                                                                                }))}
                                                                            />
                                                                            LCL
                                                                        </label>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 17. Rail (CN/CP) */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.rail')}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(item.rail)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyCustoms.rail ?? item.rail ?? '')}
                                                                        onChange={(e) =>
                                                                            setCopyCustoms((p) => ({
                                                                                ...p,
                                                                                rail: e.target.value,
                                                                            }))
                                                                        }
                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.select')}
                                                                        </option>
                                                                        <option value="CP">CP</option>
                                                                        <option value="CN">CN</option>
                                                                        <option value="NA">NA</option>
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 18. GST+DUTY */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">{'GST+DUTY'}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={toNum(item.gst_status ?? item.gst_duty) === 1 ? 'Yes' : 'No'}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <YesNoRadio
                                                                        name={`cb_gst_${idx}`}
                                                                        value={copyCustoms.gst_status}
                                                                        yesLabel={tt('common.yes')}
                                                                        noLabel={tt('common.no')}
                                                                        onChange={(v) => {
                                                                            setGstTouched(true);
                                                                            setCopyCustoms((p) => ({
                                                                                ...p,
                                                                                gst_status: v,
                                                                            }));
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 19. Note */}
                                                        <div className="md-field md-field--wide">
                                                            <div
                                                                className="md-field__label">{tt('orderList.table.note')}</div>
                                                            <div className="md-field__control">
                                                                <Input
                                                                    type="textarea"
                                                                    className="md-control"
                                                                    rows={4}
                                                                    value={
                                                                        item.edit
                                                                            ? safeStr(item.note)
                                                                            : safeStr(copyCustoms.note ?? item.note)
                                                                    }
                                                                    disabled={item.edit ? true : false}
                                                                    onChange={(e) =>
                                                                        !item.edit &&
                                                                        setCopyCustoms((p) => ({
                                                                            ...p,
                                                                            note: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder={tt('orderList.table.note')}
                                                                />
                                                            </div>
                                                        </div>
                                                        {allowEditBtn && !item.edit && (
                                                            <div className="md-field md-field--wide md-field--actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--ghost"
                                                                    onClick={() => cancelEditCustoms(idx)}
                                                                >
                                                                    {tt('uploadMarine.actions.cancel')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--primary"
                                                                    disabled={savingEdit || updatingCb}
                                                                    onClick={() => submitCustoms(idx)}
                                                                >
                                                                    {savingEdit || updatingCb ? (
                                                                        <Spinner size="sm" className="me-2"/>
                                                                    ) : null}
                                                                    {tt('uploadMarine.actions.submit')}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardBody>
                                </Collapse>
                            </Card>
                        )}

                        {/* ================= Pickup ================= */}
                        {hasPickup && (
                            <Card className="md-section md-section--compact">
                                <div className="md-sectionHead">
                                    <button
                                        type="button"
                                        className="md-sectionHead__toggle"
                                        onClick={() => toggleSection('pickup')}
                                    >
                                        <span className={`md-chevron ${open.pickup ? 'open' : ''}`}/>
                                        <span className="md-sectionHead__title">
                      {tt('uploadMarine.serviceOptions.pickup')}
                    </span>
                                    </button>

                                    {(logisticMbl || logisticHblList.length > 0) && (
                                        <div className="d-flex flex-wrap gap-1 align-items-center ms-3">
                                            {logisticMbl && (
                                                <span className="badge border text-secondary md-badge-sm">
                          MBL: {logisticMbl}
                        </span>
                                            )}
                                            {logisticHblList.map((h, i) => (
                                                <span key={`hbl_head_${i}`}
                                                      className="badge border text-secondary md-badge-sm">
                          HBL: {h}
                        </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <Collapse isOpen={open.pickup}>
                                    <CardBody className="md-section__body">
                                        {logisticMarine.map((item: AnyObj, idx: number) => {
                                            const pickupDate = toDateOnly(item.pickup_container_date);
                                            const returnDate = toDateOnly(item.return_container_date);
                                            const isRejected = toNum(item?.container_status) === 4;
                                            const rejectReason = safeStr(item?.note);
                                            const allowEditPickupBtn = canEditLogistic && !isUpdateLocked(item.container_status);
                                            return (
                                                <div className="md-item" key={`log_${idx}`}>
                                                    <div className="md-item__head">
                                                        <div className="md-item__title">
                                                            <span
                                                                className="md-mono">{safeStr(item.container_number)}</span>

                                                            <Badge
                                                                pill
                                                                className="md-badge"
                                                                color={badgeColorByKind('pickup', item.container_status)}
                                                            >
                                                                {lookupMap(maps.pickup, item.container_status, '-')}
                                                            </Badge>
                                                            {isRejected && rejectReason ? (
                                                                <span className="md-noteDanger">
                                  {tt('orderList.table.note')}: {rejectReason}
                                </span>
                                                            ) : null}
                                                        </div>

                                                        <div className="md-item__actions">
                                                            {item.edit && allowEditPickupBtn && (
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--soft"
                                                                    onClick={() => startEditPickup(idx)}
                                                                >
                                                                    {tt('common.edit')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="md-grid">
                                                        {/* 1. Assignee */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('info.assignee') || 'Assignee'}</div>
                                                            <div className="md-field__control">
                                                                {!item.edit && toNum(item.container_status) === 0 ? (
                                                                    <div className="md-stack">
                                                                        <Select
                                                                            options={clientUsers.map(u => ({
                                                                                value: u.user_id,
                                                                                label: u.company_name || u.user_name
                                                                            }))}
                                                                            value={clientUsers.map(u => ({
                                                                                value: u.user_id,
                                                                                label: u.company_name || u.user_name
                                                                            })).find(o => o.value === safeStr(copyPickup.user_id ?? '')) ?? null}
                                                                            onChange={(opt: {
                                                                                value: string;
                                                                                label: string
                                                                            } | null) => {
                                                                                setCopyPickup((p: any) => ({
                                                                                    ...p,
                                                                                    user_id: opt?.value ?? '',
                                                                                    user_name: opt?.label ?? '',
                                                                                }));
                                                                            }}
                                                                            placeholder={tt('createOrder.common.select') || '— Select —'}
                                                                            classNamePrefix="rs"
                                                                            isClearable
                                                                            isSearchable
                                                                        />
                                                                        <Input
                                                                            className="md-control"
                                                                            value={safeStr(copyPickup.user_name ?? '')}
                                                                            disabled
                                                                        />
                                                                    </div>
                                                                ) : !item.edit ? (
                                                                    <div className="md-stack">
                                                                        <Input className="md-control"
                                                                               value={safeStr(copyPickup.user_name ?? item.user_name)}
                                                                               disabled/>
                                                                        <small className="text-muted">Only editable when
                                                                            status is 0</small>
                                                                    </div>
                                                                ) : (
                                                                    <Input className="md-control"
                                                                           value={safeStr(item.user_name)} disabled/>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 2. Container Number — editable in edit mode (matches Vue) */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.containerNumber')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(item.container_number)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.container_number ?? item.container_number)}
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            container_number: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 3. MBL */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">MBL</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={safeStr(item.mbl)} disabled/>
                                                                ) : (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.mbl ?? '')}
                                                                        placeholder="MBL"
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            mbl: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 4. HBL */}
                                                        <div className="md-field md-field--wide">
                                                            <div className="md-field__label">HBL</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <div className="d-flex flex-wrap gap-2">
                                                                        {safeStr(item.hbl) ? (
                                                                            safeStr(item.hbl).split(',').map((h: string) => h.trim()).filter(Boolean).map((h: string, i: number) => (
                                                                                <span key={`hbl_v_${i}`}
                                                                                      className="badge bg-light text-dark border me-1 mb-1 px-2 py-1 md-badge-13">{h}</span>
                                                                            ))
                                                                        ) : (
                                                                            <span className="text-muted">-</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div
                                                                        className="d-flex flex-wrap gap-2 align-items-center">
                                                                        {Array.isArray(copyPickup.hbl_list) && copyPickup.hbl_list.map((h: string, i: number) => (
                                                                            <span key={`hbl_e_${i}`}
                                                                                  className="badge bg-light text-dark border d-flex align-items-center gap-1 px-2 py-1 md-badge-13">
                                        {h}
                                                                                <button type="button"
                                                                                        className="btn-close btn-close-sm ms-1 md-close-9"
                                                                                        onClick={() => {
                                                                                            setCopyPickup((p: any) => ({
                                                                                                ...p,
                                                                                                hbl_list: (p.hbl_list || []).filter((_: any, idx2: number) => idx2 !== i),
                                                                                            }));
                                                                                        }}/>
                                      </span>
                                                                        ))}
                                                                        {hblInputVisible ? (
                                                                            <input
                                                                                className="form-control form-control-sm md-select-160"
                                                                                autoFocus
                                                                                value={hblInputValue}
                                                                                placeholder="Enter HBL"
                                                                                onChange={(e) => setHblInputValue(e.target.value)}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        const v = hblInputValue.trim();
                                                                                        setHblInputVisible(false);
                                                                                        setHblInputValue('');
                                                                                        if (v) {
                                                                                            setCopyPickup((p: any) => {
                                                                                                const list = Array.isArray(p.hbl_list) ? p.hbl_list : [];
                                                                                                if (list.some((x: string) => x.toLowerCase() === v.toLowerCase())) return p;
                                                                                                return {
                                                                                                    ...p,
                                                                                                    hbl_list: [...list, v]
                                                                                                };
                                                                                            });
                                                                                        }
                                                                                    } else if (e.key === 'Escape') {
                                                                                        setHblInputVisible(false);
                                                                                        setHblInputValue('');
                                                                                    }
                                                                                }}
                                                                                onBlur={() => {
                                                                                    const v = hblInputValue.trim();
                                                                                    setHblInputVisible(false);
                                                                                    setHblInputValue('');
                                                                                    if (v) {
                                                                                        setCopyPickup((p: any) => {
                                                                                            const list = Array.isArray(p.hbl_list) ? p.hbl_list : [];
                                                                                            if (list.some((x: string) => x.toLowerCase() === v.toLowerCase())) return p;
                                                                                            return {
                                                                                                ...p,
                                                                                                hbl_list: [...list, v]
                                                                                            };
                                                                                        });
                                                                                    }
                                                                                }}
                                                                            />
                                                                        ) : (
                                                                            <Button size="sm" color="primary" outline
                                                                                    onClick={() => {
                                                                                        setHblInputVisible(true);
                                                                                        setHblInputValue('');
                                                                                    }}>
                                                                                + Add
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 5. Creator */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('info.creator') || 'Creator'}</div>
                                                            <div className="md-field__control">
                                                                <Input className="md-control"
                                                                       value={safeStr(item.creator_name) || '-'}
                                                                       disabled/>
                                                            </div>
                                                        </div>

                                                        {/* 6. FCL */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.fcl')}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={normalizeYesNo(item.fcl)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <YesNoRadio
                                                                        name={`pk_fcl_${idx}`}
                                                                        value={copyPickup.fcl}
                                                                        yesLabel={tt('common.yes')}
                                                                        noLabel={tt('common.no')}
                                                                        onChange={(v) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                fcl: v,
                                                                            }))
                                                                        }
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 7. Go Warehouse */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('createOrder.marine.goWarehouse')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={formatMarineGoWarehouse(item.go_warehouse)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.go_warehouse ?? '')}
                                                                        onChange={(e) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                go_warehouse: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.select')}
                                                                        </option>
                                                                        <option value="0">DH Warehouse</option>
                                                                        <option value="1">Third Party</option>
                                                                        <option value="2">D/O</option>
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 8. Whether need pickup */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('createOrder.marine.whetherNeedPickUp')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={formatYesNoText(item.is_pickup_container)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.is_pickup_container ?? '')}
                                                                        onChange={(e) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                is_pickup_container: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.select')}
                                                                        </option>
                                                                        <option value="1">{tt('common.yes')}</option>
                                                                        <option value="0">{tt('common.no')}</option>
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 9. Destination */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.destination')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(item.destination)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.destination || '')}
                                                                        disabled={loadingCities}
                                                                        onChange={(e) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                destination: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.selectDestination')}
                                                                        </option>

                                                                        {cityOptions.length === 0 && !loadingCities ? (
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
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 10. Shipline */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.shipline')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={getShiplineDisplay(item.shipline ?? item.vessel)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.shipline ?? item.shipline ?? item.vessel ?? '')}
                                                                        onChange={(e) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                shipline: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.select')}
                                                                        </option>
                                                                        {SHIPLINE_OPTIONS.map((opt) => (
                                                                            <option key={opt.code} value={opt.code}>
                                                                                {opt.label} - {opt.code}
                                                                            </option>
                                                                        ))}
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 11. portETA */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.portEta')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDateTime(item.portETA)} disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="datetime-local"
                                                                        className={`md-control${!copyPickup.portETA ? ' md-date-empty' : ''}`}
                                                                        value={copyPickup.portETA ?? ''}
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            portETA: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 12. trainETA */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.trainEta')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDateTime(item.trainETA)} disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="datetime-local"
                                                                        className={`md-control${!copyPickup.trainETA ? ' md-date-empty' : ''}`}
                                                                        value={copyPickup.trainETA ?? ''}
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            trainETA: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 13. Rail (CN/CP) */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.rail')}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={safeStr(item.rail)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <Input
                                                                        type="select"
                                                                        className="md-control"
                                                                        value={safeStr(copyPickup.rail ?? item.rail ?? '')}
                                                                        onChange={(e) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                rail: e.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="" disabled hidden>
                                                                            {tt('createOrder.common.select')}
                                                                        </option>
                                                                        <option value="CP">CP</option>
                                                                        <option value="CN">CN</option>
                                                                        <option value="NA">NA</option>
                                                                    </Input>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 14. Pickup Date */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.pickupDate')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDate(item.pickup_container_date)}
                                                                           disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="date"
                                                                        className={`md-control${!copyPickup.pickup_container_date && !pickupDate ? ' md-date-empty' : ''}`}
                                                                        value={safeStr(copyPickup.pickup_container_date ?? pickupDate)}
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            pickup_container_date: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 15. Return Date */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.returnDate')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDate(item.return_container_date)}
                                                                           disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="date"
                                                                        className={`md-control${!copyPickup.return_container_date && !returnDate ? ' md-date-empty' : ''}`}
                                                                        value={safeStr(copyPickup.return_container_date ?? returnDate)}
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            return_container_date: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 16. Last Free Day */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">Last Free Day</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input className="md-control"
                                                                           value={fmtDate(item.last_free_day)}
                                                                           disabled/>
                                                                ) : (
                                                                    <Input
                                                                        type="date"
                                                                        className={`md-control${!copyPickup.last_free_day ? ' md-date-empty' : ''}`}
                                                                        value={copyPickup.last_free_day ?? ''}
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            last_free_day: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 17. ERS */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.ers')}</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={normalizeYesNo(item.ers_status)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <YesNoRadio
                                                                        name={`pk_ers_${idx}`}
                                                                        value={copyPickup.ers_status}
                                                                        yesLabel={tt('common.yes')}
                                                                        noLabel={tt('common.no')}
                                                                        onChange={(v) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                ers_status: v,
                                                                            }))
                                                                        }
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 18. Tele */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">Tele</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={normalizeYesNo(item.tele)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <YesNoRadio
                                                                        name={`pk_tele_${idx}`}
                                                                        value={copyPickup.tele}
                                                                        yesLabel={tt('common.yes')}
                                                                        noLabel={tt('common.no')}
                                                                        onChange={(v) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                tele: v,
                                                                            }))
                                                                        }
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 19. Picker Number */}
                                                        <div className="md-field">
                                                            <div
                                                                className="md-field__label">{tt('orderList.columns.pkNum')}</div>
                                                            <div className="md-field__control">
                                                                <Input
                                                                    className="md-control"
                                                                    value={
                                                                        item.edit
                                                                            ? safeStr(item.pk_num)
                                                                            : safeStr(copyPickup.pk_num ?? item.pk_num)
                                                                    }
                                                                    disabled={item.edit}
                                                                    onChange={(e) =>
                                                                        !item.edit &&
                                                                        setCopyPickup((p) => ({
                                                                            ...p,
                                                                            pk_num: e.target.value,
                                                                        }))
                                                                    }
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* 20. GOC */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">GOC</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <Input
                                                                        className="md-control"
                                                                        value={normalizeYesNo(item.goc_status)}
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <YesNoRadio
                                                                        name={`pk_goc_${idx}`}
                                                                        value={copyPickup.goc_status}
                                                                        yesLabel={tt('common.yes')}
                                                                        noLabel={tt('common.no')}
                                                                        onChange={(v) =>
                                                                            setCopyPickup((p) => ({
                                                                                ...p,
                                                                                goc_status: v,
                                                                            }))
                                                                        }
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 21. Process Status */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('orderList.columns.process')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                <Badge
                                                                    pill
                                                                    className="md-badge md-badge--big"
                                                                    color={badgeColorByKind('pickup', item.container_status)}
                                                                >
                                                                    {lookupMap(maps.pickup, item.container_status, '-')}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {/* 22. Delivery City */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('createOrder.common.deliveryCity')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                <Input
                                                                    className="md-control"
                                                                    value={
                                                                        item.edit
                                                                            ? safeStr(item.delivery_city)
                                                                            : safeStr(copyPickup.delivery_city ?? item.delivery_city)
                                                                    }
                                                                    disabled={item.edit}
                                                                    onChange={(e) =>
                                                                        !item.edit &&
                                                                        setCopyPickup((p) => ({
                                                                            ...p,
                                                                            delivery_city: e.target.value,
                                                                        }))
                                                                    }
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* 23. Postcode */}
                                                        <div className="md-field">
                                                            <div className="md-field__label">
                                                                {tt('createOrder.common.postcode')}
                                                            </div>
                                                            <div className="md-field__control">
                                                                <Input
                                                                    className="md-control"
                                                                    value={
                                                                        item.edit
                                                                            ? safeStr(item.postcode)
                                                                            : safeStr(copyPickup.postcode ?? item.postcode)
                                                                    }
                                                                    disabled={item.edit}
                                                                    onChange={(e) =>
                                                                        !item.edit &&
                                                                        setCopyPickup((p) => ({
                                                                            ...p,
                                                                            postcode: e.target.value,
                                                                        }))
                                                                    }
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* 24. Note */}
                                                        <div className="md-field md-field--wide">
                                                            <div className="md-field__label">Note</div>
                                                            <div className="md-field__control">
                                                                {item.edit ? (
                                                                    <div
                                                                        className={`md-logistic-note-view${item.container_note ? '' : ' md-logistic-note-view--empty'}`}
                                                                    >
                                                                        {safeStr(item.container_note) || 'No logistic note'}
                                                                    </div>
                                                                ) : (
                                                                    <Input
                                                                        type="textarea"
                                                                        className="md-control"
                                                                        rows={6}
                                                                        value={safeStr(copyPickup.container_note ?? '')}
                                                                        placeholder="Enter logistic note"
                                                                        onChange={(e) => setCopyPickup((p) => ({
                                                                            ...p,
                                                                            container_note: e.target.value
                                                                        }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                        {!item.edit && canEditLogistic && (
                                                            <div className="md-field md-field--wide md-field--actions">
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--ghost"
                                                                    onClick={() => cancelEditPickup(idx)}
                                                                >
                                                                    {tt('uploadMarine.actions.cancel')}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="md-btn md-btn--primary"
                                                                    disabled={savingEdit || updatingLogistic}
                                                                    onClick={() => submitPickup(idx)}
                                                                >
                                                                    {savingEdit || updatingLogistic ? (
                                                                        <Spinner size="sm" className="me-2"/>
                                                                    ) : null}
                                                                    {tt('uploadMarine.actions.submit')}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardBody>
                                </Collapse>
                            </Card>
                        )}

                        {/* ================= Warehouse ================= */}
                        {hasWarehouse && (
                            <Card className="md-section">
                                <div className="md-sectionHead">
                                    <button
                                        type="button"
                                        className="md-sectionHead__toggle"
                                        onClick={() => toggleSection('warehouse')}
                                    >
                                        <span className={`md-chevron ${open.warehouse ? 'open' : ''}`}/>
                                        <span className="md-sectionHead__title">
                      {tt('uploadMarine.serviceOptions.warehouse')}
                    </span>
                                    </button>
                                    <div className="md-sectionHead__right"/>
                                </div>

                                <Collapse isOpen={open.warehouse}>
                                    <CardBody className="md-section__body">
                                        {wmsMarine.map((item: AnyObj, idx: number) => (
                                            <div className="md-item" key={`wms_${idx}`}>
                                                <div className="md-grid">
                                                    <div className="md-field">
                                                        <div className="md-field__label">
                                                            {tt('orderList.columns.containerNumber')}
                                                        </div>
                                                        <div className="md-field__control">
                                                            <Input
                                                                className="md-control"
                                                                value={safeStr(item.container_number)}
                                                                disabled
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="md-field">
                                                        <div
                                                            className="md-field__label">{tt('orderList.columns.status')}</div>
                                                        <div className="md-field__control">
                                                            <Badge
                                                                pill
                                                                className="md-badge md-badge--big"
                                                                color={badgeColorByKind(
                                                                    'warehouse',
                                                                    item.container_status ?? item.status
                                                                )}
                                                            >
                                                                {lookupMap(
                                                                    maps.warehouse,
                                                                    item.container_status ?? item.status,
                                                                    '-'
                                                                )}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </CardBody>
                                </Collapse>
                            </Card>
                        )}

                        {/* ================= Files ================= */}
                        <div className="mb-2 mt-2">
                            <Button color="primary" size="sm" onClick={handleDownloadAllFiles}>
                                {tt('info.txt106') || 'Download All Files'}
                            </Button>
                        </div>

                        <FileGroupsSection
                            tt={tt}
                            open={open.files}
                            onToggle={() => toggleSection('files')}
                            canEdit={canEdit}
                            canDelete={canEdit && canDeleteFile}
                            fileGroups={fileGroups.map((g) => ({...g, key: g.key}))}
                            retrievingFiles={retrievingFiles}
                            uploadingMarineAir={uploadingMarineAir || fileOpLoading}
                            onAddFile={addFile}
                            onReplaceFile={replaceFile}
                            onDeleteFile={handleDeleteFile}
                            onPreviewFile={onPreviewFile}
                            addInputRef={addInputRef}
                            replaceInputRef={replaceInputRef}
                            onAddChange={onAddChange}
                            onReplaceChange={onReplaceChange}
                        />

                        <FileGroupsSection
                            title={tt('files.supportingDocuments')}
                            tt={tt}
                            open={open.supportingFiles}
                            onToggle={() => toggleSection('supportingFiles')}
                            canEdit={canEdit}
                            canDelete={canEdit && canDeleteFile}
                            fileGroups={supportingFileGroups.map((g) => ({...g, key: g.key}))}
                            retrievingFiles={retrievingFiles}
                            uploadingMarineAir={uploadingMarineAir || fileOpLoading}
                            onAddFile={addFile}
                            onReplaceFile={replaceFile}
                            onDeleteFile={handleDeleteFile}
                            onPreviewFile={onPreviewFile}
                            addInputRef={addInputRef}
                            replaceInputRef={replaceInputRef}
                            onAddChange={onAddChange}
                            onReplaceChange={onReplaceChange}
                        />

                        {(dataInfo?.cb_marine_id || dataInfo?.logistic_marine_id || dataInfo?.wms_marine_id) && (
                            <>
                                <PartiallyRepaySection
                                    cb_marine_id={dataInfo?.cb_marine_id ? String(dataInfo.cb_marine_id) : undefined}
                                    logistic_marine_id={dataInfo?.logistic_marine_id ? String(dataInfo.logistic_marine_id) : undefined}
                                    wms_marine_id={dataInfo?.wms_marine_id ? String(dataInfo.wms_marine_id) : undefined}
                                    task_id={dataInfo?.main_id ? Number(dataInfo.main_id) : undefined}
                                    container_number={(
                                        String(dataInfo?.cb_marine?.[0]?.container_number || dataInfo?.logistic_marine?.[0]?.container_number || '')
                                    ).trim().toUpperCase()}
                                    container_options={marineMsgContainerOptions}
                                    locked={financeLocked}
                                    onLoadList={loadFiles}
                                />

                                <AdditionalFeeSection
                                    cb_marine_id={dataInfo?.cb_marine_id ? String(dataInfo.cb_marine_id) : undefined}
                                    logistic_marine_id={dataInfo?.logistic_marine_id ? String(dataInfo.logistic_marine_id) : undefined}
                                    wms_marine_id={dataInfo?.wms_marine_id ? String(dataInfo.wms_marine_id) : undefined}
                                    task_id={dataInfo?.main_id ? Number(dataInfo.main_id) : undefined}
                                    container_number={(
                                        String(dataInfo?.cb_marine?.[0]?.container_number || dataInfo?.logistic_marine?.[0]?.container_number || '')
                                    ).trim().toUpperCase()}
                                    container_options={marineMsgContainerOptions}
                                    locked={financeLocked}
                                    onLoadList={loadFiles}
                                    user_id={dataInfo?.user_id}
                                />
                            </>
                        )}
                    </CardBody>
                </Card>

                {dataInfo?.user_id && (() => {
                    const isZh = i18n.language?.startsWith('zh');
                    const QUOTE_CATS: Record<string, { en: string; zh: string }> = {
                        brokerage: {en: 'Brokerage', zh: '清关服务费'},
                        logistics: {en: 'Logistics', zh: '物流服务费'},
                        warehouse: {en: 'Warehouse', zh: '海外仓服务费'},
                    };
                    const QUOTE_SVCS: Record<string, { en: string; zh: string }> = {
                        BrokerageFee: {en: 'Brokerage Fee', zh: '报关费'},
                        LineCharge: {en: 'Line Charge', zh: '海关条目费'},
                        DutyGSTAdmin: {en: 'Duty/GST Admin Fee', zh: '税金代付费'},
                        Emanifest: {en: 'Emanifest Fee', zh: '电子载货舱单'},
                        ISF5_10: {en: 'ISF-5 / ISF-10', zh: '美国过境进口申报费'},
                        ExamHandle: {en: 'Exam Handling Fee', zh: '查验操作费'},
                        BondAgent: {en: 'Bond Agent Fee', zh: 'Bond代理购买费'},
                        BrokerAppFee: {en: 'Brokerage Application Fee', zh: '代理申请费'},
                        TitleFee: {en: 'Title Fee', zh: '清关主体使用费'},
                        HandlingFee: {en: 'Handling Fee', zh: '跟货操作费'},
                        PCAdminFee: {en: 'PC Admin Fee', zh: '第三方账单代付费'},
                        LogisticsApp: {en: 'Logistics Application Fee', zh: '物流代理申请费'},
                        OceanFee: {en: 'Ocean Fee', zh: '海运费'},
                        TruckLoading: {en: 'Trucking and Loading', zh: '提货/派送费'},
                        DrayageFee: {en: 'Drayage Fee', zh: '提柜费'},
                        DutyGSTAdvance: {en: 'Duty/GST Advance Payment', zh: '关税代缴'},
                        PrePull: {en: 'Pre-pull', zh: '预提/预拉'},
                        StorageFee: {en: 'Yard Storage', zh: '堆场存柜费'},
                        ChassisRental: {en: 'Chassis Rental', zh: '车架租赁'},
                        LiveUnloadWaiting: {en: 'Live-unload Waiting Time', zh: '现场卸货等时费'},
                        TerminalWaiting: {en: 'Terminal Waiting Time', zh: '码头等时费'},
                        DGSurcharge: {en: 'DG Surcharge', zh: '危险品附加费'},
                        DGLabelRemove: {en: 'DG Label Remove', zh: '危险品标签移除费'},
                        ExtraStopSOC: {en: 'Extra Stop/SOC', zh: '额外停靠/SOC'},
                        DropOff: {en: 'Drop Off', zh: '还柜/Drop off'},
                        OtherLocalTrucking: {en: 'Other Local Trucking', zh: '其他本地拖车费'},
                        ChassisYard: {en: 'Chassis Rental/Yard Storage', zh: '车架费/存柜费'},
                        LiftOnOff: {en: 'Lift On/Lift Off', zh: '起重机上/下架费'},
                        DrayDeadRun: {en: 'Drayage Dead Run', zh: '提/还柜空跑费'},
                        DeStuff: {en: 'De-stuff Fee', zh: '卸柜费'},
                        SortingFee: {en: 'Sorting Fee', zh: '理货费'},
                        PalletWrap: {en: 'Palletize and Wrapping Fee', zh: '打板缠膜费'},
                        Labelling: {en: 'Labelling Fee', zh: '贴标/换标费'},
                        InLoading: {en: 'In Loading Fee', zh: '入库费'},
                        AMZAppt: {en: 'Amazon Appointment Fee', zh: '亚马逊派送预约费'},
                        FBAActive: {en: 'FBA Active', zh: 'FBA激活费'},
                        DeliveryAMZ: {en: 'Delivery to Amazon Fee', zh: '亚马逊派送费'},
                        DeliveryFee: {en: 'Delivery Fee', zh: '私人地址派送费'},
                        HandlingOut: {en: 'Handling out', zh: '出库费'},
                        DelivWait: {en: 'Delivery Waiting Time', zh: '亚马逊送仓等时费'},
                        DelivDead: {en: 'Delivery Dead Run Fee', zh: '派送空跑费'},
                        WHStorage: {en: 'Warehouse Storage Fee', zh: '货物仓储费'},
                        FCLAllIn: {en: 'FCL ALL-IN Service', zh: '整柜一口价服务费'},
                        USCAFTLAll: {en: 'US to CA FTL ALL-IN', zh: '美转加整柜一口价服务费'},
                        WHOther: {en: 'Warehouse Other Service', zh: '库内其它服务费'},
                    };
                    const catLabel = (key: string) => {
                        const c = QUOTE_CATS[key];
                        return c ? (isZh ? c.zh : c.en) : key;
                    };
                    const svcLabel = (code: string) => {
                        const s = QUOTE_SVCS[code];
                        return s ? (isZh ? s.zh : s.en) : code;
                    };
                    const totalPages = Math.ceil(quoteTotal / quotePageSize) || 1;
                    return (
                        <Card className="md-section">
                            <div className="md-sectionHead">
                                <button
                                    type="button"
                                    className="md-sectionHead__toggle"
                                    onClick={() => toggleSection('quotes')}
                                >
                                    <span className={`md-chevron ${open.quotes ? 'open' : ''}`}/>
                                    <span className="md-sectionHead__title">{tt('quote.title1')}</span>
                                </button>
                                {quoteLoading && <Spinner size="sm" className="ms-2"/>}
                                {!quoteLoading && quoteTotal > 0 && (
                                    <Badge color="secondary" className="ms-2">{quoteTotal}</Badge>
                                )}
                            </div>

                            <Collapse isOpen={open.quotes}>
                                <CardBody className="md-section__body">
                                    {quoteLoading ? (
                                        <div className="text-center py-4"><Spinner/></div>
                                    ) : quoteRows.length === 0 ? (
                                        <p className="text-muted mb-0">{tt('quote.noQuotes')}</p>
                                    ) : (
                                        <>
                                            <div className="table-responsive">
                                                <table
                                                    className="table table-bordered table-hover table-sm align-middle mb-0">
                                                    <thead className="table-light">
                                                    <tr>
                                                        <th className="text-nowrap">{tt('quote.createDate')}</th>
                                                        <th className="text-nowrap">{tt('info.assignee')}</th>
                                                        <th className="text-nowrap">{tt('quote.category')}</th>
                                                        <th className="text-nowrap">{tt('quote.service')}</th>
                                                        <th className="text-nowrap">{tt('quote.note')}</th>
                                                        <th className="text-nowrap text-center">{tt('quote.currency')}</th>
                                                        <th className="text-nowrap text-end">{tt('quote.fee')}</th>
                                                        <th className="text-nowrap">{tt('quote.address')}</th>
                                                        <th className="text-nowrap">{tt('quote.deliveryCity')}</th>
                                                        <th className="text-nowrap">{tt('quote.postcode')}</th>
                                                        <th className="text-nowrap text-center">{tt('quote.dock')}</th>
                                                        <th className="text-nowrap">{tt('quote.effectiveDate')}</th>
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    {quoteRows.map((row: any, i: number) => {
                                                        const isCad = Number(row.currency) === 0;
                                                        const feeAmt = Number(row.fee || 0).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        });
                                                        return (
                                                            <tr key={i}>
                                                                <td className="text-nowrap text-muted small">{safeStr(row.create_time)}</td>
                                                                <td className="text-nowrap">{safeStr(row.user_name) || '-'}</td>
                                                                <td>
                                                                    <Badge color="light"
                                                                           className="text-dark border fw-medium">
                                                                        {catLabel(row.service)}
                                                                    </Badge>
                                                                </td>
                                                                <td>{svcLabel(row.service_details)}</td>
                                                                <td
                                                                    className="text-muted md-truncate-200"
                                                                    title={safeStr(row.note) || undefined}
                                                                >{safeStr(row.note) || '-'}</td>
                                                                <td className="text-center">
                                                                    <Badge
                                                                        color={isCad ? 'primary' : 'warning'}>{isCad ? 'CAD' : 'USD'}</Badge>
                                                                </td>
                                                                <td className="text-end fw-bold text-nowrap">
                                                                    {isCad ? 'C$' : 'US$'} {feeAmt}
                                                                    {row.unit && <div
                                                                        className="text-muted fw-normal small">{row.unit}</div>}
                                                                    {row.additional_information && <div
                                                                        className="text-muted fw-normal small">{row.additional_information}</div>}
                                                                </td>
                                                                <td>{safeStr(row.address) || '-'}</td>
                                                                <td className="text-nowrap">{safeStr(row.delivery_city) || '-'}</td>
                                                                <td className="text-nowrap">{safeStr(row.postcode) || '-'}</td>
                                                                <td className="text-center">
                                                                    <Badge
                                                                        color={Number(row.dock) === 1 ? 'success' : 'secondary'}>
                                                                        {Number(row.dock) === 1 ? tt('quote.dockYes') : tt('quote.dockNo')}
                                                                    </Badge>
                                                                </td>
                                                                <td className="text-nowrap">{safeStr(row.effective_date) || '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {quoteTotal > quotePageSize && (
                                                <div
                                                    className="d-flex align-items-center justify-content-end gap-2 mt-3">
                                                    <Button size="sm" color="light" disabled={quotePage <= 1}
                                                            onClick={() => setQuotePage(p => p - 1)}>
                                                        &lsaquo; {tt('common.prev') || 'Prev'}
                                                    </Button>
                                                    <span className="text-muted small">{quotePage} / {totalPages}</span>
                                                    <Button size="sm" color="light" disabled={quotePage >= totalPages}
                                                            onClick={() => setQuotePage(p => p + 1)}>
                                                        {tt('common.next') || 'Next'} &rsaquo;
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardBody>
                            </Collapse>
                        </Card>
                    );
                })()}

            </Container>
        </div>
    );
};

export default MarineDetails;
