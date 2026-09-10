import React, { useEffect, useMemo, useState, useCallback, useDeferredValue, useRef } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  Button,
  Alert,
  Table,
  Collapse,
  Input,
  FormGroup,
  Label,
  Modal,
  ModalHeader,
  ModalBody,
  Badge,
} from 'reactstrap';
import { useDispatch, useSelector } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { toast } from 'react-toastify';

import BreadCrumb from '../../Components/Common/BreadCrumb';
import Spinners from '../../Components/Common/NewSpinner';
import SelectUser from '../../Components/Common/SelectUser';
import SelectDestination from '../../Components/Common/SelectDestination';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMainTicketDetails } from '../../slices/ticketDetails/thunk';
import { fetchMarineContainerEvents } from '../../slices/containerEvents/thunk';
import { fetchMarineTrainTracking } from '../../slices/trainTracking/thunk';

import { useTT } from '../../helpers/useTT';
import { getUserIdFromSession, getUserNameFromSession } from '../../helpers/userInformation';
import { createSessionState } from '../../helpers/sessionHelper';

import TrackTimeline from './TrackTimeline';
import ChangeServiceModal from './ChangeServiceModal';

import { badgeColorByKind, textClassByKind } from '../../helpers/helpers';

import {
  safeStr,
  toNum,
  buildPageList,
  hasAnyActiveTicket,
  buildRowMeta,
  createStatusMaps,
  lookupMap,
  MiniTable,
  type MainRow,
  type RowVM,
  type ColDef,
} from './helper';

import { retrieveLeaveMessagesApi } from '../../helpers/api_fetch/leaveMessage';

type AppDispatch = ThunkDispatch<any, any, AnyAction>;

type QueryParams = {
  page: number;
  pageSize: number;
  user_id?: any;

  service_state: '1' | '2';
  portETA_start: string;
  portETA_end: string;
  trainETA_start: string;
  trainETA_end: string;
  service: '' | 'marine' | 'air' | 'truck';
  destination: string;

  status: '0' | '1' | '2' | '3' | '4';
  // cargoNumber lives in the URL (?q=) so it reacts to navigate() without needing state
};

const ORDERLIST_SESSION_KEY = 'orderlist.queryParams.v1';
const orderListSession = createSessionState<QueryParams>(ORDERLIST_SESSION_KEY);

type TaskToCheck = {
  id: any;
  container?: string;
  awb?: string;
};

const All: React.FC = () => {
  const { tt } = useTT();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const currentUserId = getUserIdFromSession();
  const currentUserName = getUserNameFromSession();

  const [searchParams, setSearchParams] = useSearchParams();

  // -------- main list ----------
  const { result, loading, error, errorMsg } = useSelector((state: any) => state.MainTicketDetails);

  const apiRows = useMemo<MainRow[]>(() => (result?.data ?? []) as MainRow[], [result]);
  const totalRows = useMemo<number>(() => (result?.totalRows ?? 0) as number, [result]);

  // -------- track events ----------
  const {
    events: trackEvents,
    loading: trackLoading,
    error: trackError,
  } = useSelector((state: any) => state.ContainerEvent);

  const {
    events: trainEvents,
    loading: trainLoading,
  } = useSelector((state: any) => state.TrainTracking);

  // cargoNumber is driven entirely by the URL (?q=) — reactive to any navigate() call
  const cargoNumber = searchParams.get('q') || '';
  const deferredCargo = useDeferredValue(cargoNumber);

  const [isDotMap, setIsDotMap] = useState<Record<string, boolean>>({});
  const dotsCancelRef = useRef(0);

  const [trackOpen, setTrackOpen] = useState(false);
  const [trackContainerNo, setTrackContainerNo] = useState<string>('');
  const [trackCustomStatus, setTrackCustomStatus] = useState<any>(null);
  const [trackCustomStatusTime, setTrackCustomStatusTime] = useState<string>('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [queryParams, setQueryParams] = useState<QueryParams>(() => {
    const base: QueryParams = {
      page: 1,
      pageSize: 10,
      user_id: '',

      service_state: '1',
      portETA_start: '',
      portETA_end: '',
      trainETA_start: '',
      trainETA_end: '',

      service: '',
      destination: '',
      status: '4',
    };

    const saved = orderListSession.read();
    return { ...base, ...(saved ?? {}), user_id: '' };
  });

  const tOr = useCallback((key: string, fallback: string) => tt(key) || fallback, [tt]);

  const persistedQuery = useMemo(() => {
    const { user_id, ...rest } = queryParams;
    return rest;
  }, [queryParams]);

  useEffect(() => {
    orderListSession.write(persistedQuery as any);
  }, [persistedQuery]);

  // Top header search bar fires this event when already on this page —
  // update the URL so cargoNumber (from searchParams) stays reactive
  useEffect(() => {
    const handler = (e: Event) => {
      const cargo = (e as CustomEvent<{ cargoNumber: string }>).detail.cargoNumber;
      setSearchParams((prev) => {
        const np = new URLSearchParams(prev);
        if (cargo) { np.set('q', cargo); } else { np.delete('q'); }
        return np;
      }, { replace: true });
      setQueryParams((p) => ({ ...p, page: 1 }));
    };
    window.addEventListener('orderlist:cargo-search', handler);
    return () => window.removeEventListener('orderlist:cargo-search', handler);
  }, [setSearchParams]);

  // status maps from helper
  const maps = useMemo(() => createStatusMaps(tOr), [tOr]);

  const dispCad = useCallback((v: any) => lookupMap(maps.cad, v, ''), [maps]);
  const dispCustoms = useCallback((v: any) => lookupMap(maps.customs, v, ''), [maps]);
  const dispOrderStatus = useCallback((v: any) => lookupMap(maps.order, v, ''), [maps]);
  const pickupProcess = useCallback((v: any) => lookupMap(maps.pickup, v, ''), [maps]);
  const dispWarehouseStatus = useCallback((v: any) => lookupMap(maps.warehouse, v, ''), [maps]);

  // Merge container events + train tracking into one sorted list for the track modal
  const mergedTrackEvents = useMemo(() => {
    const containerEvts = (Array.isArray(trackEvents) ? trackEvents : []).map((e: any) => ({
      ...e,
      _source: 'container' as const,
    }));
    const trainEvts = (Array.isArray(trainEvents) ? trainEvents : []).map((e: any) => ({
      ...e,
      _source: 'train' as const,
      // use event_time if present, fall back to train_eta so it lands on the timeline
      event_time: e.event_time || e.train_eta,
      event_type: e.event_type || 'Train',
    }));
    return [...containerEvts, ...trainEvts];
  }, [trackEvents, trainEvents]);

  const formatGoWarehouse = useCallback(
    (e: number | boolean): string => {
      return Number(e) === 1
        ? tt('state.warehouseFlag.inWarehouse')
        : tt('state.warehouseFlag.notInWarehouse');
    },
    [tt]
  );

  const formatMarineGoWarehouse = useCallback((e: any): string => {
    const v = String(e ?? '');
    if (v === '0') return 'DH Warehouse';
    if (v === '1') return 'Third Party';
    if (v === '2') return 'D/O';
    return '-';
  }, []);

  const formatYesNo = useCallback(
    (e: any): string => {
      const v = String(e ?? '');
      if (v === '1') return tt('common.yes');
      if (v === '0') return tt('common.no');
      return '-';
    },
    [tt]
  );

    const renderPickupProcess = useCallback(
        (v: any) => {
            const label = pickupProcess(v) || '-';
            return <span className={textClassByKind('pickup', v)}>{label}</span>;
        },
        [pickupProcess]
    );

  // Main list pill text: 0/null => Under Review, 1 => Processing, 2 => Completed
  const dispMainOrderType = useCallback(
    (status: any) => {
      const v = toNum(status);
      if (status === null || status === undefined || status === 'null' || v === 0)
        return tt('state.order.reviewing');
      if (v === 1) return tt('state.order.processing');
      if (v === 2) return tt('state.order.completed');
      return tt('state.order.reviewing');
    },
    [tt]
  );

  const updateFilters = useCallback((patch: Partial<QueryParams>) => {
    setQueryParams((p) => ({ ...p, ...patch, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setQueryParams((p) => ({ ...p, page }));
  }, []);

  // stable payload (and use deferred cargoNumber)
  const payload = useMemo(() => {
    const p: any = {
      ...queryParams,
      cargoNumber: deferredCargo,
    };
    if (!p.user_id) delete p.user_id;     // omit → admin sees all users
    if (p.status === '4' || p.status === 4) delete p.status;
    return p;
  }, [
    queryParams.page,
    queryParams.pageSize,
    queryParams.user_id,
    queryParams.service_state,
    queryParams.portETA_start,
    queryParams.portETA_end,
    queryParams.trainETA_start,
    queryParams.trainETA_end,
    queryParams.service,
    queryParams.destination,
    queryParams.status,
    deferredCargo,
  ]);

  useEffect(() => {
    dispatch(fetchMainTicketDetails(payload));
  }, [dispatch, payload]);

  // Build view-model rows once
  const rowsVM = useMemo<RowVM[]>(() => {
    return (apiRows ?? [])
      .filter(hasAnyActiveTicket)
      .map((row: MainRow) => ({ row, meta: buildRowMeta(row) }));
  }, [apiRows]);

  const totalPages = Math.max(1, Math.ceil(totalRows / queryParams.pageSize));
  const pageItems = useMemo(
    () => buildPageList(queryParams.page, totalPages),
    [queryParams.page, totalPages]
  );

  const toggleExpand = useCallback((id: string | number) => {
    const key = String(id);
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // View Track => fetch container events + open modal
  const handleTrack = useCallback(
    (item: any) => {
      const containerNo = item?.container_number || item?.containerNo || item?.container || '';

      if (!containerNo) {
        toast.error('Container number is missing.', { autoClose: 2000 });
        return;
      }

      setTrackContainerNo(containerNo);
      setTrackCustomStatus(item?.custom_status ?? null);
      setTrackCustomStatusTime(safeStr(item?.custom_status_time));
      setTrackOpen(true);
      dispatch(fetchMarineContainerEvents({ container_number: containerNo }));
      dispatch(fetchMarineTrainTracking({ container_number: containerNo }));
    },
    [dispatch]
  );

  const closeTrack = useCallback(() => {
    setTrackOpen(false);
    setTrackContainerNo('');
    setTrackCustomStatus(null);
    setTrackCustomStatusTime('');
  }, []);

  const [changeOpen, setChangeOpen] = useState(false);
  const [changeRow, setChangeRow] = useState<MainRow | null>(null);

  const openChangeService = useCallback((row: MainRow) => {
    setChangeRow(row);
    setChangeOpen(true);
  }, []);

  const closeChangeService = useCallback(() => {
    setChangeOpen(false);
    setChangeRow(null);
  }, []);

  const handleService = useCallback(
    (row: MainRow) => {

        openChangeService(row);
    },
    [openChangeService]
  );

  // same navigation logic, but we will clear dots before navigate
    const getTasksToCheck = useCallback((row: any): TaskToCheck[] => {
        const tasks: TaskToCheck[] = [];

        const pushTask = (id: any, opts?: { container?: any; awb?: any }) => {
            const taskId = String(id ?? '').trim();
            const container = String(opts?.container ?? '').trim().toUpperCase();
            const awb = String(opts?.awb ?? '').trim().toUpperCase();

            if (!taskId) return;
            if (!container && !awb) return;

            tasks.push({
                id: taskId,
                container: container || undefined,
                awb: awb || undefined,
            });
        };

        // ---------- Marine ----------
        const marineContainer =
            row.cb_marine?.[0]?.container_number ||
            row.logistic_marine?.[0]?.container_number ||
            row.wms_marine?.[0]?.container_number ||
            '';

        pushTask(row.main_id, { container: marineContainer });
        pushTask(row.cb_marine_id, { container: row.cb_marine?.[0]?.container_number });
        pushTask(row.logistic_marine_id, { container: row.logistic_marine?.[0]?.container_number });
        pushTask(row.wms_marine_id, { container: row.wms_marine?.[0]?.container_number });

        // ---------- Air ----------
        const airAwb =
            row.cb_air?.[0]?.awb ||
            row.logistic_air?.[0]?.awb ||
            row.wms_air?.[0]?.awb ||
            '';

        pushTask(row.main_id, { awb: airAwb });
        pushTask(row.cb_air_id, { awb: row.cb_air?.[0]?.awb });
        pushTask(row.logistic_air_id, { awb: row.logistic_air?.[0]?.awb });
        pushTask(row.wms_air_id, { awb: row.wms_air?.[0]?.awb });

        // ---------- Truck ----------
        const truckContainer =
            row.truck_cb?.[0]?.container_number ||
            row.truck_logistic?.[0]?.container_number ||
            row.truck_us_to_ca?.[0]?.container_number ||
            row.truck_us_ca?.[0]?.container_number ||
            '';

        pushTask(row.main_id, { container: truckContainer });
        pushTask(row.truck_cb_id, { container: row.truck_cb?.[0]?.container_number });
        pushTask(row.truck_logistic_id, { container: row.truck_logistic?.[0]?.container_number });
        pushTask(row.truck_us_ca_id, {
            container:
                row.truck_us_to_ca?.[0]?.container_number || row.truck_us_ca?.[0]?.container_number,
        });

        // dedupe
        const seen = new Set<string>();
        return tasks.filter((t) => {
            const key = `${t.id}_${t.container || ''}_${t.awb || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, []);

  const hasUnreadForRow = useCallback(
    (row: any) => {
      const tasks = getTasksToCheck(row);
      return tasks.some((t) => {
        const key = `${t.id}_${t.container || t.awb || ''}`;
        return !!isDotMap[key];
      });
    },
    [getTasksToCheck, isDotMap]
  );

  const updateNoteDots = useCallback(
    async (list: any[]) => {
      const seq = ++dotsCancelRef.current;

      type TaskEntry = { key: string; task: TaskToCheck };
      const entries: TaskEntry[] = list.flatMap((item) =>
        getTasksToCheck(item).map((task) => ({
          key: `${task.id}_${task.container || task.awb || ''}`,
          task,
        }))
      );

      if (!entries.length) {
        if (seq === dotsCancelRef.current) setIsDotMap({});
        return;
      }

      const results = await Promise.allSettled(
        entries.map(({ task }) =>
          retrieveLeaveMessagesApi({
            task_id: task.id,
            container_number: task.container ?? null,
            awb: task.awb ?? null,
          })
        )
      );

      if (seq !== dotsCancelRef.current) return;

      const dotMap: Record<string, boolean> = {};
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return;
        const data = result.value as any;
        const raw = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.data)
            ? data.data.data
            : [];
        const myName = currentUserName.trim();
        const hasUnread = (Array.isArray(raw) ? raw : []).some((note: any) => {
          if (String(note?.user_id) === String(currentUserId)) return false;
          const readBy = typeof note?.read_status_admin === 'string'
            ? note.read_status_admin.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [];
          return !readBy.includes(myName);
        });
        if (hasUnread) dotMap[entries[i].key] = true;
      });

      setIsDotMap(dotMap);
    },
    [getTasksToCheck, currentUserId, currentUserName]
  );

  // ✅ when table list changes, update unread dots
  useEffect(() => {
    // only check current page rows (same as Vue: filtered list)
    updateNoteDots(apiRows as any[]);
  }, [apiRows, updateNoteDots]);

  const clearDotsForRow = useCallback(
    (row: any) => {
      const tasks = getTasksToCheck(row);
      setIsDotMap((prev) => {
        const next = { ...prev };
        for (const t of tasks) {
          const k = `${t.id}_${t.container || t.awb || ''}`;
          delete next[k];
        }
        return next;
      });
    },
    [getTasksToCheck]
  );

  const handleInfo = useCallback(
    (row: MainRow) => {
      // ✅ clear dot locally when user enters details
      clearDotsForRow(row);

      const mainId = row?.main_id;

      const isMarine = !!(row?.cb_marine_id || row?.logistic_marine_id || row?.wms_marine_id);
      const isAir = !!(row?.cb_air_id || row?.logistic_air_id || row?.wms_air_id);
      const isTruck = !!(row?.truck_cb_id || row?.truck_logistic_id || row?.truck_us_ca_id);

      if (!mainId) {
        toast.error(tt('common.noData') || 'Missing main id', { autoClose: 2000 });
        return;
      }

      if (isMarine) return navigate(`/order_run/info/h_info?id=${mainId}`);
      if (isAir) return navigate(`/order_run/info/k_info?id=${mainId}`);
      if (isTruck) return navigate(`/order_run/info/t_info?id=${mainId}`);

      toast.info(tt('common.comingSoon') || 'Details page coming soon', { autoClose: 2000 });
    },
    [navigate, tt, clearDotsForRow]
  );

  // --------- Column defs — order mirrors Vue marine.vue ----------
  const marineCbCols = useMemo<ColDef<any>[]>(
    () => [
      {
        header: tt('orderList.columns.containerNumber'),
        tdClassName: 'cell-mono',
        render: (m) => m.container_number,
      },
      {
        header: tt('orderList.columns.destination'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.destination),
        render: (m) => m.destination,
      },
      {
        header: tt('orderList.columns.shipline'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.shipline),
        render: (m) => m.shipline,
      },
      {
        header: tt('orderList.columns.portEta'),
        tdClassName: 'cell-mono',
        render: (m) => m.portETA,
      },
      {
        header: tt('orderList.columns.fcl') || 'FCL',
        render: (m) => (Number(m.fcl) === 1 ? 'FCL' : 'LCL'),
      },
      {
        header: tt('orderList.columns.rail'),
        tdClassName: 'cell-mono',
        render: (m) => m.rail || '-',
      },
      {
        header: tt('orderList.columns.trainEta'),
        tdClassName: 'cell-mono',
        render: (m) => m.trainETA,
      },
      {
        header: tt('serviceList.columns.lastFreeDay'),
        tdClassName: 'cell-mono',
        render: (m) => m.last_free_day || '-',
      },
      {
        header: tt('serviceList.columns.anEmf'),
        render: (m) => (Number(m.an_emf) === 1 ? tt('common.yes') : tt('common.no')),
      },
      {
        header: tt('orderList.columns.transaction'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.transaction),
        render: (m) => m.transaction || '-',
      },
      {
        header: tt('orderList.columns.cad'),
        render: (m) => (
          <span className={textClassByKind('cad', m.cad_status)}>
            {dispCad(m.cad_status) || '-'}
          </span>
        ),
      },
      {
        header: tt('orderList.columns.iidStatus'),
        render: (m) => (
          <span className={textClassByKind('customs', m.custom_status)}>
            {dispCustoms(m.custom_status) || '-'}
          </span>
        ),
      },
      {
        header: tt('serviceList.filters.customStatusTime'),
        tdClassName: 'cell-mono',
        render: (m) => (m.custom_status_time && !/^0000-00-00/.test(String(m.custom_status_time))) ? String(m.custom_status_time) : '-',
      },
      {
        header: tt('orderList.columns.importer'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.importer),
        render: (m) => m.importer || '-',
      },
      {
        header: tt('orderList.table.note'),
        tdClassName: 'text-clamp-2 cell-note',
        title: (m) => safeStr(m.note),
        render: (m) => m.note || '-',
      },
      {
        header: tt('serviceList.columns.creator'),
        tdClassName: 'text-clamp-1',
        render: (m) => m.creator_name || '-',
      },
      {
        header: tt('orderList.columns.orderStatus'),
        render: (m) => (
          <span className={textClassByKind('order', m.status)}>
            {lookupMap(maps.order, m.status, '') || '-'}
          </span>
        ),
      },
    ],
    [tt, dispCad, dispCustoms, maps.order]
  );

  const logisticMarineCols = useMemo<ColDef<any>[]>(
    () => [
      {
        header: tt('orderList.columns.containerNumber'),
        tdClassName: 'cell-mono',
        render: (m) => m.container_number,
      },
      {
        header: tt('orderList.columns.fcl') || 'FCL',
        render: (m) => (Number(m.fcl) === 1 ? tt('common.yes') : tt('common.no')),
      },
      {
        header: tt('orderList.columns.shipline'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.shipline),
        render: (m) => m.shipline,
      },
      {
        header: tt('orderList.columns.portEta'),
        tdClassName: 'cell-mono',
        render: (m) => m.portETA,
      },
      {
        header: tt('orderList.columns.trainEta'),
        tdClassName: 'cell-mono',
        render: (m) => m.trainETA,
      },
      {
        header: tt('orderList.columns.rail'),
        tdClassName: 'cell-mono',
        render: (m) => m.rail || '-',
      },
      {
        header: tt('createOrder.marine.whetherNeedPickUp'),
        render: (m) => formatYesNo(m.is_pickup_container),
      },
      {
        header: tt('createOrder.marine.goWarehouse'),
        render: (m) => formatMarineGoWarehouse(m.go_warehouse),
      },
      {
        header: tt('orderList.columns.pkNum'),
        tdClassName: 'cell-mono',
        render: (m) => m.pk_num,
      },
      {
        header: tt('orderList.columns.pickupDate'),
        tdClassName: 'cell-mono',
        render: (m) => m.pickup_container_date,
      },
      {
        header: tt('orderList.columns.returnDate'),
        tdClassName: 'cell-mono',
        render: (m) => m.return_container_date,
      },
      {
        header: tt('orderList.columns.ers'),
        render: (m) => (Number(m.ers_status) === 1 ? tt('common.yes') : tt('common.no')),
      },
      {
        header: tt('orderList.columns.process'),
        render: (m) => (
          <span className={textClassByKind('pickup', m.container_status)}>
            {renderPickupProcess(m.container_status) || '-'}
          </span>
        ),
      },
    ],
    [tt, formatMarineGoWarehouse, formatYesNo, renderPickupProcess]
  );

  const wmsMarineCols = useMemo<ColDef<any>[]>(
    () => [
      {
        header: tt('orderList.columns.containerNumber'),
        tdClassName: 'cell-mono',
        render: (m) => m.container_number,
      },
      {
        header: tt('orderList.columns.status'),
        render: (m) => dispWarehouseStatus(m.status ?? m.container_status),
      },
    ],
    [tt, dispWarehouseStatus]
  );

  const airCbCols = useMemo<ColDef<any>[]>(
    () => [
      {
        header: tt('orderList.columns.importer'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.importer),
        render: (m) => m.importer,
      },
      { header: tt('orderList.columns.awb'), tdClassName: 'cell-mono', render: (m) => m.awb },
      {
        header: tt('orderList.columns.destination'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.destination),
        render: (m) => m.destination,
      },
      {
        header: tt('orderList.columns.airline'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.airline),
        render: (m) => m.airline,
      },
      { header: tt('orderList.columns.eta'), tdClassName: 'cell-mono', render: (m) => m.eta },
      {
        header: tt('orderList.columns.cad'),
        render: (m) => (
          <span className={textClassByKind('cad', m.cad_status)}>
            {dispCad(m.cad_status) || '-'}
          </span>
        ),
      },
      {
        header: tt('orderList.columns.iidStatus'),
        render: (m) => (
          <span className={textClassByKind('customs', m.custom_status)}>
            {dispCustoms(m.custom_status) || '-'}
          </span>
        ),
      },
      {
        header: tt('orderList.columns.orderStatus'),
        render: (m) => (
          <span className={textClassByKind('order', m.status)}>
            {lookupMap(maps.order, m.status, '') || '-'}
          </span>
        ),
      },
    ],
    [tt, dispCad, dispCustoms, maps.order]
  );

  const airLogisticCols = useMemo<ColDef<any>[]>(
    () => [
      { header: tt('orderList.columns.awb'), tdClassName: 'cell-mono', render: (m) => m.awb },
      {
        header: tt('orderList.columns.airline'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.airline),
        render: (m) => m.airline,
      },
      {
        header: tt('orderList.columns.shippingUnits'),
        tdClassName: 'cell-mono',
        render: (m) => m.shipping_units,
      },
      {
        header: tt('orderList.columns.supervisionWarehouse'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.supervision_wareshouse),
        render: (m) => m.supervision_wareshouse,
      },
      { header: tt('orderList.columns.ata'), tdClassName: 'cell-mono', render: (m) => m.ata },
      {
        header: tt('orderList.columns.cargoArrivalTime'),
        tdClassName: 'cell-mono',
        render: (m) => m.cargo_arrival_time,
      },
      {
        header: tt('orderList.columns.cargoPickupTime'),
        tdClassName: 'cell-mono',
        render: (m) => m.cargo_pickup_time,
      },
      {
        header: tt('orderList.columns.process'),
        render: (m) => renderPickupProcess(m.status ?? m.container_status),
      },
    ],
    [tt, renderPickupProcess]
  );

  const airWmsCols = useMemo<ColDef<any>[]>(
    () => [
      { header: tt('orderList.columns.awb'), tdClassName: 'cell-mono', render: (m) => m.awb },
      { header: tt('orderList.columns.status'), render: (m) => dispWarehouseStatus(m.status) },
    ],
    [tt, dispWarehouseStatus]
  );

  const truckCbCols = useMemo<ColDef<any>[]>(
    () => [
      {
        header: tt('orderList.columns.containerNumber'),
        tdClassName: 'cell-mono',
        render: (m) => m.container_number,
      },
      { header: tt('orderList.columns.parse'), tdClassName: 'cell-mono', render: (m) => m.parse },
      {
        header: tt('orderList.columns.crossBorderLocation'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.cross_border_location),
        render: (m) => m.cross_border_location,
      },
      {
        header: tt('orderList.columns.crossBorderTime'),
        tdClassName: 'cell-mono',
        render: (m) => m.cross_border_time,
      },
      {
        header: tt('orderList.columns.transaction'),
        tdClassName: 'cell-mono',
        render: (m) => m.transaction,
      },
      {
        header: tt('orderList.columns.cad'),
        render: (m) => (
          <span className={textClassByKind('cad', m.cad_status)}>
            {dispCad(m.cad_status) || '-'}
          </span>
        ),
      },
      {
        header: tt('orderList.columns.iidStatus'),
        render: (m) => (
          <span className={textClassByKind('customs', m.custom_status)}>
            {dispCustoms(m.custom_status) || '-'}
          </span>
        ),
      },
      {
        header: tt('orderList.columns.orderStatus'),
        render: (m) => (
          <span className={textClassByKind('order', m.ticket_status)}>
            {lookupMap(maps.order, m.ticket_status, '') || '-'}
          </span>
        ),
      },
    ],
    [tt, dispCad, dispCustoms, maps.order]
  );

  const truckLogisticCols = useMemo<ColDef<any>[]>(
    () => [
      {
        header: tt('orderList.columns.containerNumber'),
        tdClassName: 'cell-mono',
        render: (m) => m.container_number,
      },
      {
        header: tt('orderList.columns.destination'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.destination),
        render: (m) => m.destination,
      },
      {
        header: tt('orderList.columns.destinationUs'),
        tdClassName: 'text-clamp-1',
        title: (m) => safeStr(m.destination_us),
        render: (m) => m.destination_us,
      },
      {
        header: tt('orderList.columns.pickupDate'),
        tdClassName: 'cell-mono',
        render: (m) => m.pickup_container_date,
      },
      {
        header: tt('orderList.columns.returnDate'),
        tdClassName: 'cell-mono',
        render: (m) => m.return_container_date,
      },
      {
        header: tt('orderList.columns.transactionDate'),
        tdClassName: 'cell-mono',
        render: (m) => m.transaction_date,
      },
      {
        header: tt('orderList.columns.goWarehouse'),
        render: (m) => formatGoWarehouse(m.go_warehouse),
      },
      {
        header: tt('orderList.columns.orderStatus'),
        render: (m) => renderPickupProcess(m.ticket_status),
      },
    ],
    [tt, formatGoWarehouse, renderPickupProcess]
  );

  const truckUsCaCols = truckLogisticCols;

  return (
    <div className="orderlist-page">
      {loading && <Spinners size="lg" />}

      <Container fluid>
        <BreadCrumb title={tt('orderList.title')} pageTitle={tt('orderList.breadcrumb')} />

        {(errorMsg || error) && (
          <Alert color="danger" className="mb-3">
            {errorMsg || error}
          </Alert>
        )}

        {/* Filters */}
        <Card className="orderlist-card mb-3">
          <CardBody>
            <Row className="g-2 align-items-end">
              <Col md="auto">
                <FormGroup className="mb-0">
                  <SelectUser
                    value={queryParams.user_id ?? ''}
                    onChange={(v) => updateFilters({ user_id: v })}
                    placeholder={tt('createOrder.common.select')}
                    className="sl-w-220"
                  />
                </FormGroup>
              </Col>

              <Col md="auto">
                <FormGroup className="mb-0">
                  <SelectDestination
                    value={queryParams.destination}
                    onChange={(v) => updateFilters({ destination: v })}
                    placeholder={tt('createOrder.common.select')}
                    className="sl-w-180"
                  />
                </FormGroup>
              </Col>

              <Col md="auto">
                <FormGroup className="mb-0">
                  <Input
                    type="select"
                    value={queryParams.service}
                    className="sl-w-180"
                    onChange={(e) => updateFilters({ service: e.target.value as any })}
                  >
                    <option value="">{tt('orderList.filters.service')}</option>
                    <option value="marine">{tt('createOrder.services.marine')}</option>
                    <option value="air">{tt('createOrder.services.air')}</option>
                    <option value="truck">{tt('createOrder.services.truck')}</option>
                  </Input>
                </FormGroup>
              </Col>

              <Col md="auto">
                <FormGroup className="mb-0">
                  <Input
                    type="select"
                    value={queryParams.service_state}
                    className="sl-w-180"
                    onChange={(e) => updateFilters({
                      service_state: e.target.value as any,
                      portETA_start: '',
                      portETA_end: '',
                      trainETA_start: '',
                      trainETA_end: '',
                    })}
                  >
                    <option value="1">{tt('orderList.filters.portEta') || 'Port ETA'}</option>
                    <option value="2">{tt('orderList.filters.trainEta') || 'Train ETA'}</option>
                  </Input>
                </FormGroup>
              </Col>

              <Col md="auto">
                <FormGroup className="mb-0">
                  <div className="sl-date-row">
                    <Input
                      type="date"
                      className="sl-date-input"
                      value={queryParams.service_state === '1' ? queryParams.portETA_start : queryParams.trainETA_start}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (queryParams.service_state === '1') updateFilters({ portETA_start: v });
                        else updateFilters({ trainETA_start: v });
                      }}
                    />
                    <span className="sl-date-sep">-</span>
                    <Input
                      type="date"
                      className="sl-date-input"
                      value={queryParams.service_state === '1' ? queryParams.portETA_end : queryParams.trainETA_end}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (queryParams.service_state === '1') updateFilters({ portETA_end: v });
                        else updateFilters({ trainETA_end: v });
                      }}
                    />
                  </div>
                </FormGroup>
              </Col>

              <Col md="auto">
                <FormGroup className="mb-0">
                  <Input
                    type="text"
                    value={cargoNumber}
                    placeholder={tt('orderList.table.containerOrAwb')}
                    className="sl-w-200"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\s+/g, '');
                      setSearchParams((prev) => {
                        const np = new URLSearchParams(prev);
                        if (v) { np.set('q', v); } else { np.delete('q'); }
                        return np;
                      }, { replace: true });
                      setQueryParams((p) => ({ ...p, page: 1 }));
                    }}
                  />
                </FormGroup>
              </Col>

              <Col md="auto">
                <FormGroup className="mb-0">
                  <Button
                    color="primary"
                    onClick={() => dispatch(fetchMainTicketDetails(payload))}
                  >
                    {tt('common.refresh') || 'Refresh'}
                  </Button>
                </FormGroup>
              </Col>
            </Row>

            {/* Status tab bar */}
            <div className="orderlist-status-tabs mt-3">
              {([
                { val: '0', label: tt('state.order.reviewing') },
                { val: '1', label: tt('state.order.processing') },
                { val: '2', label: tt('state.pickup.inTransit') },
                { val: '3', label: tt('state.order.completed') },
                { val: '4', label: tt('common.all') },
              ] as { val: string; label: string }[]).map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  className={`orderlist-status-tab${queryParams.status === val ? ' active' : ''}`}
                  onClick={() => updateFilters({ status: val as any })}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Main table */}
        <Card className="orderlist-card">
          <CardBody>
            <div className="orderlist-table-wrap">
              <Table responsive hover className="orderlist-table">
                <thead>
                  <tr>
                    <th className="orderlist-cell-expand" />
                    <th>{tt('orderList.table.type')}</th>
                    <th>{tt('orderList.table.containerOrAwb')}</th>
                    <th>{tt('orderList.table.mainId')}</th>
                    <th>{tt('orderList.table.orderStatus')}</th>
                    <th>{tt('orderList.table.customs')}</th>
                    <th>{tt('orderList.table.pickupCargo')}</th>
                    <th>{tt('orderList.table.warehouseUsCa')}</th>
                    <th>{tt('orderList.table.createTime')}</th>
                    <th>{tt('orderList.table.actions')}</th>
                  </tr>
                </thead>

                <tbody>
                  {rowsVM.map(({ row, meta }: RowVM) => {
                    const key = String(row.main_id);
                    const open = !!expanded[key];

                    const typeLabel =
                      meta.type === 'marine'
                        ? tt('createOrder.services.marine')
                        : meta.type === 'air'
                          ? tt('createOrder.services.air')
                          : meta.type === 'truck'
                            ? tt('createOrder.services.truck')
                            : '-';

                    const badgeClass = (() => {
                      const v = toNum(row.status);
                      if (meta.rejected) return 'badge-danger';
                      if (v === 2) return 'badge-success';
                      return 'badge-info';
                    })();

                    const showUnread = hasUnreadForRow(row);

                    return (
                      <React.Fragment key={row.main_id}>
                        <tr className={`orderlist-row ${open ? 'is-open' : ''}`}>
                          <td className="orderlist-cell-expand">
                            <button
                              type="button"
                              className="orderlist-expand-btn"
                              onClick={() => toggleExpand(row.main_id)}
                              aria-label="expand"
                            >
                              <span className={'orderlist-arrow' + (open ? ' open' : '')} />
                            </button>
                          </td>

                          <td>
                            <span className="orderlist-pill">{typeLabel}</span>
                          </td>

                          <td className="cell-mono">
                            {showUnread && (
                              <div className="orderlist-newmsg-wrap">
                                <span className="orderlist-newmsg-tag">
                                  {tt('chat.newMessage')}
                                </span>
                              </div>
                            )}

                            <div>
                              {meta.no || '-'}
                              {meta.num > 1 && (
                                <span className="orderlist-count">({meta.num})</span>
                              )}
                            </div>
                          </td>

                          <td className="cell-mono">{row.main_id}</td>

                          <td>
                            <span className={`orderlist-badge ${badgeClass}`}>
                              {dispMainOrderType(row.status)}
                            </span>
                          </td>

                          <td>
                            <span className={'status-dot ' + (meta.qgOk ? 'status-dot--ok' : '')} />
                          </td>

                          <td>
                            <span
                              className={'status-dot ' + (meta.tihuoOk ? 'status-dot--ok' : '')}
                            />
                          </td>

                          <td>
                            <span
                              className={'status-dot ' + (meta.cangkuOk ? 'status-dot--ok' : '')}
                            />
                          </td>

                          <td className="cell-mono">{row.create_time}</td>

                          <td>
                            <div className="orderlist-actions">
                              <Button
                                size="sm"
                                color="primary"
                                outline
                                className="orderlist-action-btn"
                                onClick={() => handleService(row)}
                              >
                                {tt('orderList.table.updateService')}
                              </Button>

                              {/* red-dot badge on info button */}
                              <span className="btn-badge-wrap">
                                <Button
                                  size="sm"
                                  color="secondary"
                                  outline
                                  className="orderlist-action-btn"
                                  onClick={() => handleInfo(row)}
                                >
                                  {tt('orderList.table.detailStatus')}
                                </Button>

                                {showUnread && <span className="btn-unread-dot" />}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded content */}
                        <tr className="orderlist-expand-row">
                          <td colSpan={10}>
                            <Collapse isOpen={open}>
                              <div className="orderlist-expand-body">
                                {/* Marine CB */}
                                {row.cb_marine_id && row.cb_marine?.[0]?.status !== 7 && (
                                  <div className="body-table">
                                    <div className="bl-title">
                                      {tt('orderList.sections.customsInfo')}
                                    </div>
                                    <MiniTable
                                      rows={(row.cb_marine ?? []) as any[]}
                                      columns={marineCbCols}
                                      actionHeader={tt('orderList.table.actions')}
                                      renderAction={(m) => (
                                        <Button
                                          size="sm"
                                          color="primary"
                                          outline
                                          className="orderlist-mini-btn"
                                          onClick={() => handleTrack(m)}
                                        >
                                          {tt('orderList.table.viewTrack')}
                                        </Button>
                                      )}
                                    />
                                  </div>
                                )}

                                {/* Logistic Marine */}
                                {row.logistic_marine_id &&
                                  row.logistic_marine?.[0]?.container_status !== 7 && (
                                    <div className="body-table">
                                      <div className="bl-title">
                                        {tt('orderList.sections.logisticsInfo')}
                                      </div>
                                      <MiniTable
                                        rows={(row.logistic_marine ?? []) as any[]}
                                        columns={logisticMarineCols}
                                        actionHeader={tt('orderList.table.actions')}
                                        renderAction={(m) => (
                                          <Button
                                            size="sm"
                                            color="primary"
                                            outline
                                            className="orderlist-mini-btn"
                                            onClick={() => handleTrack(m)}
                                          >
                                            {tt('orderList.table.viewTrack')}
                                          </Button>
                                        )}
                                      />
                                    </div>
                                  )}

                                {/* WMS Marine */}
                                {row.wms_marine_id &&
                                  (row.wms_marine?.[0]?.status ??
                                    row.wms_marine?.[0]?.container_status) !== 7 && (
                                    <div className="body-table">
                                      <div className="bl-title">
                                        {tt('orderList.sections.warehouseInfo')}
                                      </div>
                                      <MiniTable
                                        rows={(row.wms_marine ?? []) as any[]}
                                        columns={wmsMarineCols}
                                        actionHeader={tt('orderList.table.actions')}
                                        renderAction={(m) => (
                                          <Button
                                            size="sm"
                                            color="primary"
                                            outline
                                            className="orderlist-mini-btn"
                                            onClick={() => handleTrack(m)}
                                          >
                                            {tt('orderList.table.viewTrack')}
                                          </Button>
                                        )}
                                      />
                                    </div>
                                  )}

                                {/* Air CB */}
                                {row.cb_air_id && row.cb_air?.[0]?.status !== 7 && (
                                  <div className="body-table">
                                    <div className="bl-title">
                                      {tt('orderList.sections.customsInfo')}
                                    </div>
                                    <MiniTable
                                      rows={(row.cb_air ?? []) as any[]}
                                      columns={airCbCols}
                                      actionHeader={tt('orderList.table.actions')}
                                      renderAction={(m) => (
                                        <Button
                                          size="sm"
                                          color="primary"
                                          outline
                                          className="orderlist-mini-btn"
                                          onClick={() => handleTrack(m)}
                                        >
                                          {tt('orderList.table.viewTrack')}
                                        </Button>
                                      )}
                                    />
                                  </div>
                                )}

                                {/* Air Logistic */}
                                {row.logistic_air_id &&
                                  (row.logistic_air?.[0]?.status ??
                                    row.logistic_air?.[0]?.container_status) !== 7 && (
                                    <div className="body-table">
                                      <div className="bl-title">
                                        {tt('orderList.sections.logisticsInfo')}
                                      </div>
                                      <MiniTable
                                        rows={(row.logistic_air ?? []) as any[]}
                                        columns={airLogisticCols}
                                        actionHeader={tt('orderList.table.actions')}
                                        renderAction={(m) => (
                                          <Button
                                            size="sm"
                                            color="primary"
                                            outline
                                            className="orderlist-mini-btn"
                                            onClick={() => handleTrack(m)}
                                          >
                                            {tt('orderList.table.viewTrack')}
                                          </Button>
                                        )}
                                      />
                                    </div>
                                  )}

                                {/* Air WMS */}
                                {row.wms_air_id && row.wms_air?.[0]?.status !== 7 && (
                                  <div className="body-table">
                                    <div className="bl-title">
                                      {tt('orderList.sections.warehouseInfo')}
                                    </div>
                                    <MiniTable
                                      rows={(row.wms_air ?? []) as any[]}
                                      columns={airWmsCols}
                                      actionHeader={tt('orderList.table.actions')}
                                      renderAction={(m) => (
                                        <Button
                                          size="sm"
                                          color="primary"
                                          outline
                                          className="orderlist-mini-btn"
                                          onClick={() => handleTrack(m)}
                                        >
                                          {tt('orderList.table.viewTrack')}
                                        </Button>
                                      )}
                                    />
                                  </div>
                                )}

                                {/* Truck CB */}
                                {row.truck_cb_id && row.truck_cb?.[0]?.ticket_status !== 7 && (
                                  <div className="body-table">
                                    <div className="bl-title">
                                      {tt('orderList.sections.truckCustomsInfo')}
                                    </div>
                                    <MiniTable
                                      rows={(row.truck_cb ?? []) as any[]}
                                      columns={truckCbCols}
                                      actionHeader={tt('orderList.table.actions')}
                                      renderAction={(m) => (
                                        <Button
                                          size="sm"
                                          color="primary"
                                          outline
                                          className="orderlist-mini-btn"
                                          onClick={() => handleTrack(m)}
                                        >
                                          {tt('orderList.table.viewTrack')}
                                        </Button>
                                      )}
                                    />
                                  </div>
                                )}

                                {/* Truck Logistic */}
                                {row.truck_logistic_id &&
                                  row.truck_logistic?.[0]?.container_status !== 7 && (
                                    <div className="body-table">
                                      <div className="bl-title">
                                        {tt('orderList.sections.truckLogisticsInfo')}
                                      </div>
                                      <MiniTable
                                        rows={(row.truck_logistic ?? []) as any[]}
                                        columns={truckLogisticCols}
                                        actionHeader={tt('orderList.table.actions')}
                                        renderAction={(m) => (
                                          <Button
                                            size="sm"
                                            color="primary"
                                            outline
                                            className="orderlist-mini-btn"
                                            onClick={() => handleTrack(m)}
                                          >
                                            {tt('orderList.table.viewTrack')}
                                          </Button>
                                        )}
                                      />
                                    </div>
                                  )}

                                {/* Truck US->CA */}
                                {row.truck_us_ca_id &&
                                  row.truck_us_to_ca?.[0]?.container_status !== 7 && (
                                    <div className="body-table">
                                      <div className="bl-title">
                                        {tt('orderList.sections.truckUsCaInfo')}
                                      </div>
                                      <MiniTable
                                        rows={(row.truck_us_to_ca ?? []) as any[]}
                                        columns={truckUsCaCols}
                                        actionHeader={tt('orderList.table.actions')}
                                        renderAction={(m) => (
                                          <Button
                                            size="sm"
                                            color="primary"
                                            outline
                                            className="orderlist-mini-btn"
                                            onClick={() => handleTrack(m)}
                                          >
                                            {tt('orderList.table.viewTrack')}
                                          </Button>
                                        )}
                                      />
                                    </div>
                                  )}
                              </div>
                            </Collapse>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Pagination — matches Customer Order pages' sl-pagination */}
            {totalPages > 1 && (
              <div className="sl-pagination">
                <button
                  className="sl-pg-btn"
                  disabled={queryParams.page <= 1}
                  onClick={() => setPage(Math.max(1, queryParams.page - 1))}
                  title="Previous"
                >
                  ‹
                </button>

                {pageItems.map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="sl-pg-ellipsis">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`sl-pg-btn${p === queryParams.page ? ' active' : ''}`}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  className="sl-pg-btn"
                  disabled={queryParams.page >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, queryParams.page + 1))}
                  title="Next"
                >
                  ›
                </button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Track modal */}
        <Modal isOpen={trackOpen} toggle={closeTrack} size="lg">
          <ModalHeader toggle={closeTrack}>
            {tt('orderList.table.viewTrack')} — {trackContainerNo || '-'}
          </ModalHeader>
          <ModalBody>
            {/* Customs brokerage status row */}
            {trackCustomStatus !== null && trackCustomStatus !== undefined && (
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="text-muted small">{tt('orderList.columns.iidStatus')}:</span>
                <Badge color={badgeColorByKind('customs', trackCustomStatus)}>
                  {dispCustoms(trackCustomStatus) || '-'}
                </Badge>
                {trackCustomStatusTime && (
                  <span className="text-muted small cell-mono">{trackCustomStatusTime}</span>
                )}
              </div>
            )}

            {(trackLoading || trainLoading) && <Spinners size="sm" />}

            {trackError && (
              <Alert color="danger" className="mb-3">
                {trackError}
              </Alert>
            )}

            {!trackLoading && !trainLoading && mergedTrackEvents.length === 0 && (
              <Alert color="info" className="mb-0">
                {tt('common.noData')}
              </Alert>
            )}

            {!trackLoading && !trainLoading && mergedTrackEvents.length > 0 && (
              <TrackTimeline
                events={mergedTrackEvents}
                containerNo={trackContainerNo}
                tt={tt}
                safeStr={safeStr}
                newestFirst={true}
              />
            )}
          </ModalBody>
        </Modal>

          <ChangeServiceModal
              isOpen={changeOpen}
              toggle={closeChangeService}
              tt={tt}
              row={changeRow}
              onSubmitted={() => {
                  closeChangeService();
                  dispatch(fetchMainTicketDetails(payload));
              }}
          />
      </Container>
    </div>
  );
};

export default All;
