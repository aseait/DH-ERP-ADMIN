/**
 * Shared list component for Sea / Air / Truck service sub-pages.
 * Filter bar order and controls mirror the Vue admin marine.vue exactly.
 */
import React, { useCallback, useEffect, useRef, useState, Children, isValidElement } from 'react';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardBody,
  Button,
  Input,
  Spinner,
  Alert,
  Table,
} from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import SelectUser from '../../Components/Common/SelectUser';
import SelectDestination from '../../Components/Common/SelectDestination';
import { buildApiUrl, getApiBase } from '../../helpers/apiBase';
import { GET_STATUS_AMOUNT, GET_SPECIFIC_USER } from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { can, getUserNameFromSession, getUserIdFromSession } from '../../helpers/userInformation';
import { retrieveLeaveMessagesApi, retrieveInternalNotesApi } from '../../helpers/api_fetch/leaveMessage';
import { fmtDate, fmtDateTime } from '../../helpers/dateUtils';
import StickyTableHeader from './StickyTableHeader';
export { fmtDate, fmtDateTime };

// ─── Status helpers — accept optional tt for i18n ────────────────────────────

type TT = (key: string) => string;

/** English-only STATUS_TABS kept for backward compat; translated version built inside component. */
export const STATUS_TABS = [
  { value: '0',  label: 'Under Review' },
  { value: '1',  label: 'Processing' },
  { value: '2',  label: 'Pending Submission' },
  { value: '3',  label: 'Submitted' },
  { value: '4',  label: 'Released' },
  { value: '5',  label: 'Completed' },
  { value: '6',  label: 'Rejected' },
  { value: '7',  label: 'ALL' },
  { value: '10', label: 'Pending Delete' },
];

export const statusLabel = (v: unknown, tt?: TT) => {
  const n = Number(v);
  const keys: Record<number, string> = {
    0: 'state.order.reviewing',
    1: 'state.order.processing',
    2: 'state.order.pendingSubmission',
    3: 'state.order.submitted',
    4: 'state.order.released',
    5: 'state.order.completed',
    6: 'state.order.rejected',
    7: 'state.order.deleted',
    10: 'state.order.deletePending',
  };
  const en: Record<number, string> = {
    0: 'Under Review',
    1: 'Processing',
    2: 'Pending Submission',
    3: 'Submitted',
    4: 'Released',
    5: 'Completed',
    6: 'Rejected',
    7: 'Deleted',
    10: 'Pending Delete',
  };
  if (keys[n]) return tt ? tt(keys[n]) : en[n];
  return String(v ?? '-');
};

export const cadStatusLabel = (v: unknown, tt?: TT) => {
  const n = Number(v);
  if (n === 2) return tt ? tt('serviceList.cadOptions.confirmed') : 'Confirmed';
  if (n === 3) return tt ? tt('state.cad.rejected') : 'Rejected';
  return tt ? tt('serviceList.cadOptions.notConfirmed') : 'Not Confirmed';
};

export const customStatusMarine = (v: unknown, tt?: TT) => {
  const n = Number(v);
  const keys: Record<number, string> = {
    0: 'state.customs.notStarted',
    1: 'state.customs.cbsaAccepted',
    2: 'state.customs.cbsaRejected',
    4: 'state.customs.cbsaReleased',
    5: 'state.customs.cbsaExamRequired',
    9: 'state.customs.cbsaAcceptedWaiting',
    34: 'state.customs.cbsaAcceptedAwaitingCustoms',
  };
  const en: Record<number, string> = {
    0: 'Unclear Customs',
    1: 'Accepted',
    2: 'Rejected',
    4: 'Released',
    5: 'Exam Required',
    9: 'Accepted/Waiting',
    34: 'Accepted/Awaiting Customs',
  };
  if (keys[n]) return tt ? tt(keys[n]) : en[n];
  return '-';
};

export const anEmfLabel = (v: unknown, tt?: TT) =>
    Number(v) === 1
        ? (tt ? tt('common.yes') : 'Yes')
        : (tt ? tt('common.no') : 'No');

// ─── Column definition ───────────────────────────────────────────────────────

export type ColDef = {
  label: string;
  width?: number;
  render: (row: any) => React.ReactNode;
  /** Plain-text value used as the native hover tooltip (mirrors Vue show-overflow-tooltip). */
  getTitle?: (row: any) => string;
};

// ─── Config passed by each page ──────────────────────────────────────────────

export type ServiceListConfig = {
  title: string;
  breadcrumb: string;
  endpoint: string;
  statusService: string;
  detailRoute: string;
  identifierField: string;
  updateAssignEndpoint?: string;
  updateAssignIdField?: string;
  /** Restriction values that may edit the assign dropdown. Omit = everyone can edit. */
  assignRestrictions?: readonly number[];
  /** Field name on each row to use as task_id for note/dot lookups. Defaults to main_id ?? task_id. */
  noteTaskIdField?: string;
  columns: ColDef[];
  /** Column index that receives the unread-message notification badge. Defaults to 0. */
  notificationColIdx?: number;
  /** Extra query params appended to the detail route URL (e.g. "view_id=logistic"). No leading &. */
  detailExtraParams?: string;
  extraActions?: (row: any) => React.ReactNode;
  refreshKey?: number;
  /** Ref that receives a patchRow(id, patch) function for optimistic row updates */
  patchRowsRef?: React.MutableRefObject<((id: any, patch: Record<string, any>) => void) | null>;
  /** Ref that receives the current rows array for external export/processing */
  rowsRef?: React.MutableRefObject<any[]>;
  /** Content rendered below the pagination row (e.g. Export / Upload buttons) */
  pageActions?: React.ReactNode;

  // Optional filters — SeaMarine enables all of these
  cadStatusFilter?: boolean;
  customStatusFilterMarine?: boolean;
  railFilter?: boolean;
  portEtaFilter?: boolean;
  trainEtaFilter?: boolean;
  transactionFilter?: boolean;
  parsFilter?: boolean;
  customStatusTimeFilter?: boolean;
  ataFilter?: boolean;
  cargoArrivalFilter?: boolean;
  cargoPickupFilter?: boolean;
  serviceTypeFilter?: boolean;
  sortFieldOptions?: { label: string; value: string }[];
  /** Override the status tabs (default tabs use sea/air CB statuses with '7' as ALL) */
  statusTabsOverride?: { value: string; label: string }[];
  /** The sentinel value that means "all" in this service's status scheme (default '7') */
  allStatusValue?: string;
};

// ─── CAD / Custom status option lists (translated at render time) ─────────────

const makeCadOptions = (tt: TT) => [
  { value: '0', label: tt('serviceList.cadOptions.notConfirmed') },
  { value: '2', label: tt('serviceList.cadOptions.confirmed') },
  { value: '3', label: tt('state.cad.rejected') },
];

const makeCustomStatusMarineOptions = (tt: TT) => [
  { value: '0',  label: tt('state.customs.notStarted') },
  { value: '1',  label: tt('state.customs.cbsaAccepted') },
  { value: '2',  label: tt('state.customs.cbsaRejected') },
  { value: '4',  label: tt('state.customs.cbsaReleased') },
  { value: '5',  label: tt('state.customs.cbsaExamRequired') },
  { value: '9',  label: tt('state.customs.cbsaAcceptedWaiting') },
  { value: '34', label: tt('state.customs.cbsaAcceptedAwaitingCustoms') },
];

const RAIL_OPTIONS = [
  { value: 'CN',    label: 'CN' },
  { value: 'CP',    label: 'CP' },
  { value: 'NA',    label: 'NA' },
  { value: 'ERROR', label: 'ERROR' },
];

// Clearable select — uses react-select for polished look matching Vue el-select
export const CS: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  children: React.ReactNode;
}> = ({ value, onChange, placeholder, className, children }) => {
  // Parse <option value="x">Label</option> children into react-select options
  const options = Children.toArray(children)
      .filter(isValidElement)
      .map((child: any) => ({
        value: String(child.props.value ?? ''),
        label: String(child.props.children ?? ''),
      }));

  const selected = options.find(o => o.value === value) ?? null;

  return (
      <div className={`sl-wrap${className ? ` ${className}` : ''}`}>
        <Select
            classNamePrefix="rs"
            options={options}
            value={selected}
            onChange={(opt: { value: string; label: string } | null) => onChange(opt ? opt.value : '')}
            placeholder={placeholder}
            isClearable
            styles={{
              control: (base: object) => ({ ...base, minHeight: 32, height: 32, fontSize: 13 }),
              valueContainer: (base: object) => ({ ...base, padding: '0 8px' }),
              indicatorsContainer: (base: object) => ({ ...base, height: 32 }),
              menu: (base: object) => ({ ...base, zIndex: 9999, fontSize: 13 }),
            }}
        />
      </div>
  );
};

// Clearable text input — × is inside at right; sl-has-clear adds padding via CSS
export const CI: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  onEnter?: () => void;
  onBlur?: () => void;
}> = ({ value, onChange, placeholder, className, onEnter, onBlur }) => (
    <div className={`sl-wrap${value ? ' sl-has-clear' : ''}${className ? ` ${className}` : ''}`}>
      <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
          onBlur={onBlur}
      />

      {value && (
          <button
              type="button"
              className="sl-clear-input"
              onClick={() => onChange('')}
              title="Clear"
          >
            ×
          </button>
      )}
    </div>
);

// Copyable overflow tooltip — mirrors Vue show-overflow-tooltip with a black popup
const OverflowTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const hideTimer = React.useRef<number>(0);

  const clearHideTimer = () => {
    if (hideTimer.current > 0) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = 0;
    }
  };

  const show = (e: React.MouseEvent<HTMLElement>) => {
    clearHideTimer();
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6 });
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setPos(null);
      hideTimer.current = 0;
    }, 120);
  };

  const cancelHide = () => {
    clearHideTimer();
  };

  React.useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, []);

  if (!text) return <>{children}</>;

  return (
      <>
      <span onMouseEnter={show} onMouseLeave={scheduleHide}>
        {children}
      </span>

        {pos && (
            <div
                className="sl-ot-popup"
                style={{ left: pos.left, top: pos.top }}
                onMouseEnter={cancelHide}
                onMouseLeave={scheduleHide}
            >
              {text}
            </div>
        )}
      </>
  );
};

// Date range with a visible label and a combined × clear button
const DR: React.FC<{
  label: string;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  tt: (k: string) => string;
}> = ({ label, start, end, onStart, onEnd, tt }) => (
    <div>
      <div className="sl-date-label">{label}</div>

      <div className="sl-date-row">
        <div className={`sl-date-field${!start ? ' sl-date-field--empty' : ''}`}>
          {!start && <span className="sl-date-placeholder">{tt('serviceList.filters.startDate')}</span>}
          <Input
              type="date"
              className="sl-date-input"
              value={start}
              onChange={e => onStart(e.target.value)}
          />
        </div>

        <span className="sl-date-sep">—</span>

        <div className={`sl-date-field${!end ? ' sl-date-field--empty' : ''}`}>
          {!end && <span className="sl-date-placeholder">{tt('serviceList.filters.endDate')}</span>}
          <Input
              type="date"
              className="sl-date-input"
              value={end}
              onChange={e => onEnd(e.target.value)}
          />
        </div>

        {(start || end) && (
            <button
                type="button"
                className="sl-date-clear"
                onClick={() => {
                  onStart('');
                  onEnd('');
                }}
                title="Clear"
            >
              ×
            </button>
        )}
      </div>
    </div>
);

// ─── Inline form item wrapper (mirrors Vue el-form-item) ─────────────────────

export const FI: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="sl-fi">{children}</div>
);

// ─── Component ───────────────────────────────────────────────────────────────

const ServiceListPage: React.FC<ServiceListConfig> = ({
                                                        title,
                                                        breadcrumb,
                                                        endpoint,
                                                        statusService,
                                                        detailRoute,
                                                        identifierField,
                                                        updateAssignEndpoint,
                                                        updateAssignIdField,
                                                        assignRestrictions,
                                                        columns,
                                                        notificationColIdx = 0,
                                                        detailExtraParams = '',
                                                        extraActions,
                                                        refreshKey,
                                                        patchRowsRef,
                                                        rowsRef,
                                                        pageActions,
                                                        noteTaskIdField,
                                                        cadStatusFilter,
                                                        customStatusFilterMarine,
                                                        railFilter,
                                                        portEtaFilter,
                                                        trainEtaFilter,
                                                        transactionFilter,
                                                        parsFilter,
                                                        customStatusTimeFilter,
                                                        ataFilter,
                                                        cargoArrivalFilter,
                                                        cargoPickupFilter,
                                                        serviceTypeFilter,
                                                        sortFieldOptions,
                                                        statusTabsOverride,
                                                        allStatusValue = '7',
                                                      }) => {
  const navigate = useNavigate();
  const { tt } = useTT();

  const canEditAssign = !assignRestrictions || can(assignRestrictions);

  // ── Translated option lists (re-built on language change via tt)
  const statusTabs = [
    { value: '0',  label: tt('state.order.reviewing') },
    { value: '1',  label: tt('state.order.processing') },
    { value: '2',  label: tt('state.order.pendingSubmission') },
    { value: '3',  label: tt('state.order.submitted') },
    { value: '4',  label: tt('state.order.released') },
    { value: '5',  label: tt('state.order.completed') },
    { value: '6',  label: tt('state.order.rejected') },
    { value: '7',  label: tt('serviceList.tabs.all') },
    { value: '10', label: tt('state.order.deletePending') },
  ];

  const cadOptions = makeCadOptions(tt);
  const customStatusMarineOptions = makeCustomStatusMarineOptions(tt);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Session persistence (mirrors Vue's watch + onMounted sessionStorage pattern)
  const SESSION_KEY = `sl_${endpoint}_${getUserIdFromSession() ?? ''}`;
  const sessionRef = useRef<Record<string, any> | null>(null);

  if (sessionRef.current === null) {
    try {
      sessionRef.current = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') ?? {};
    } catch {
      sessionRef.current = {};
    }
  }

  const sf: Record<string, any> = sessionRef.current ?? {};

  // ── Filters (match Vue queryParms exactly) — seeded from sessionStorage
  const [userId, setUserId] = useState<string>(sf.userId ?? '');
  const [containerOrAwb, setContainerOrAwb] = useState<string>(sf.containerOrAwb ?? '');
  const [cadStatus, setCadStatus] = useState<string>(sf.cadStatus ?? '');
  const [customStatus, setCustomStatus] = useState<string>(sf.customStatus ?? '');
  const [portEtaStart, setPortEtaStart] = useState<string>(sf.portEtaStart ?? '');
  const [portEtaEnd, setPortEtaEnd] = useState<string>(sf.portEtaEnd ?? '');
  const [trainEtaStart, setTrainEtaStart] = useState<string>(sf.trainEtaStart ?? '');
  const [trainEtaEnd, setTrainEtaEnd] = useState<string>(sf.trainEtaEnd ?? '');
  const [transaction, setTransaction] = useState<string>(sf.transaction ?? '');
  const [parse, setParse] = useState<string>(sf.parse ?? '');
  const [destination, setDestination] = useState<string>(sf.destination ?? '');
  const [rail, setRail] = useState<string>(sf.rail ?? '');
  const [assignedName, setAssignedName] = useState<string>(sf.assignedName ?? '');
  const [customStatusTimeStart, setCustomStatusTimeStart] = useState<string>(sf.customStatusTimeStart ?? '');
  const [customStatusTimeEnd, setCustomStatusTimeEnd] = useState<string>(sf.customStatusTimeEnd ?? '');
  const [ataStart, setAtaStart] = useState<string>(sf.ataStart ?? '');
  const [ataEnd, setAtaEnd] = useState<string>(sf.ataEnd ?? '');
  const [cargoArrivalStart, setCargoArrivalStart] = useState<string>(sf.cargoArrivalStart ?? '');
  const [cargoArrivalEnd, setCargoArrivalEnd] = useState<string>(sf.cargoArrivalEnd ?? '');
  const [cargoPickupStart, setCargoPickupStart] = useState<string>(sf.cargoPickupStart ?? '');
  const [cargoPickupEnd, setCargoPickupEnd] = useState<string>(sf.cargoPickupEnd ?? '');
  const [sortField, setSortField] = useState<string>(sf.sortField ?? '');
  const [serviceType, setServiceType] = useState<string>(sf.serviceType ?? '');
  const [sortByNotify, setSortByNotify] = useState<boolean>(sf.sortByNotify ?? false);
  const [statusFilter, setStatusFilter] = useState<string>(sf.statusFilter ?? allStatusValue);

  const [page, setPage] = useState<number>(sf.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(sf.pageSize ?? 20);
  const pageSizeRef = useRef<number>(sf.pageSize ?? 20);
  const [jumpInput, setJumpInput] = useState('');

  // ── Column resize
  const colDefaults = columns.map(c => c.width ?? 120);
  const [colWidths, setColWidths] = useState<number[]>(() => {
    const saved = sf.colWidths;
    return Array.isArray(saved) && saved.length === colDefaults.length ? saved : [...colDefaults];
  });
  const thRefs = useRef<Array<HTMLTableCellElement | null>>(columns.map(() => null));
  const resizingRef = useRef<{ idx: number; startX: number; startW: number } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const [clientWidth, setClientWidth] = useState<number>(() => {
    const saved = sf.clientWidth;
    return typeof saved === 'number' && saved >= 60 ? saved : 130;
  });
  const clientThRef = useRef<HTMLTableCellElement | null>(null);
  const clientResizingRef = useRef<{ startX: number; startW: number } | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [userOptions, setUserOptions] = useState<{ account_name: string }[]>([]);
  const [assignedNameOverrides, setAssignedNameOverrides] = useState<Record<string, string>>({});
  const [updatedRowId, setUpdatedRowId] = useState<any>(null);
  const highlightTimer = useRef<number>(0);

  // ── Unread dot maps
  const [isDotMap, setIsDotMap] = useState<Record<string, boolean>>({});
  const [internalDotMap, setInternalDotMap] = useState<Record<string, boolean>>({});
  const dotsCancelRef = useRef(0);
  const currentUserName = getUserNameFromSession();

  const reqSeq = useRef(0);

  const filtersRef = useRef({
    statusFilter,
    containerOrAwb,
    userId,
    assignedName,
    destination,
    cadStatus,
    customStatus,
    rail,
    portEtaStart,
    portEtaEnd,
    trainEtaStart,
    trainEtaEnd,
    transaction,
    parse,
    customStatusTimeStart,
    customStatusTimeEnd,
    ataStart,
    ataEnd,
    cargoArrivalStart,
    cargoArrivalEnd,
    cargoPickupStart,
    cargoPickupEnd,
    sortField,
    serviceType,
  });

  filtersRef.current = {
    statusFilter,
    containerOrAwb,
    userId,
    assignedName,
    destination,
    cadStatus,
    customStatus,
    rail,
    portEtaStart,
    portEtaEnd,
    trainEtaStart,
    trainEtaEnd,
    transaction,
    parse,
    customStatusTimeStart,
    customStatusTimeEnd,
    ataStart,
    ataEnd,
    cargoArrivalStart,
    cargoArrivalEnd,
    cargoPickupStart,
    cargoPickupEnd,
    sortField,
    serviceType,
  };

  const buildQuery = useCallback((pg: number) => {
    const f = filtersRef.current;
    const q: any = { page: pg, pageSize: pageSizeRef.current };

    if (f.statusFilter !== allStatusValue) q.status = f.statusFilter;

    if (f.containerOrAwb.trim()) {
      if (identifierField === 'awb') q.awb = f.containerOrAwb.trim().toUpperCase();
      else q.container_number = f.containerOrAwb.trim().toUpperCase();
    }

    if (f.userId) q.user_id = f.userId;
    if (f.assignedName) q.assigned_name = f.assignedName;
    if (f.destination) q.destination = f.destination;
    if (f.cadStatus) q.cad_status = f.cadStatus;
    if (f.customStatus) q.custom_status = f.customStatus;
    if (f.rail) q.rail = f.rail;
    if (f.portEtaStart) q.portETA_start = f.portEtaStart;
    if (f.portEtaEnd) q.portETA_end = f.portEtaEnd;
    if (f.trainEtaStart) q.trainETA_start = f.trainEtaStart;
    if (f.trainEtaEnd) q.trainETA_end = f.trainEtaEnd;
    if (f.transaction.trim()) q.transaction = f.transaction.trim();
    if ((f as any).parse?.trim()) q.parse = (f as any).parse.trim();
    if (f.customStatusTimeStart) q.custom_status_time_start = f.customStatusTimeStart;
    if (f.customStatusTimeEnd) q.custom_status_time_end = f.customStatusTimeEnd;
    if (f.ataStart) q.ata_start = f.ataStart;
    if (f.ataEnd) q.ata_end = f.ataEnd;
    if (f.cargoArrivalStart) q.cargo_arrival_start = f.cargoArrivalStart;
    if (f.cargoArrivalEnd) q.cargo_arrival_end = f.cargoArrivalEnd;
    if (f.cargoPickupStart) q.cargo_pickup_start = f.cargoPickupStart;
    if (f.cargoPickupEnd) q.cargo_pickup_end = f.cargoPickupEnd;
    if (f.sortField) q.sortField = f.sortField;
    if (f.serviceType !== '') q.service_type = Number(f.serviceType);

    return q;
  }, [identifierField, allStatusValue]);

  const patchRow = useCallback((id: any, patch: Record<string, any>) => {
    setRows(prev => prev.map(r => {
      const rId = r[updateAssignIdField ?? 'main_id'] ?? r.main_id;
      return String(rId) === String(id) ? { ...r, ...patch } : r;
    }));

    setUpdatedRowId(String(id));

    if (highlightTimer.current > 0) {
      window.clearTimeout(highlightTimer.current);
    }

    highlightTimer.current = window.setTimeout(() => {
      setUpdatedRowId(null);
      highlightTimer.current = 0;
    }, 900);
  }, [updateAssignIdField]);

  // Keep the ref in sync so SeaMarine can call it imperatively
  useEffect(() => {
    if (patchRowsRef) patchRowsRef.current = patchRow;
  }, [patchRowsRef, patchRow]);

  // Expose current rows for external export
  useEffect(() => {
    if (rowsRef) rowsRef.current = rows;
  }, [rowsRef, rows]);

  const resolveTaskId = useCallback((row: any): string => {
    if (noteTaskIdField) return String(row[noteTaskIdField] ?? '').trim();
    return String(row.main_id ?? row.task_id ?? '').trim();
  }, [noteTaskIdField]);

  const updateNoteDots = useCallback(async (list: any[]) => {
    const seq = ++dotsCancelRef.current;
    const myName = currentUserName.trim();

    type Entry = {
      key: string;
      taskId: string;
      container: string | null;
      awb: string | null;
      extraTaskIds: string[];
    };

    const entries: Entry[] = list
        .map((row) => {
          const taskId = resolveTaskId(row);
          const container = identifierField !== 'awb'
              ? String(row.container_number ?? '').trim().toUpperCase()
              : null;
          const awb = identifierField === 'awb'
              ? String(row.awb ?? row.container_number ?? '').trim().toUpperCase()
              : null;

          if (!taskId || (!container && !awb)) return null;

          const extraTaskIds = [row.cb_marine_id, row.wms_marine_id, row.logistic_marine_id]
              .map((v: any) => String(v ?? '').trim())
              .filter(Boolean);

          return {
            key: `${taskId}_${container || awb}`,
            taskId,
            container,
            awb,
            extraTaskIds,
          };
        })
        .filter(Boolean) as Entry[];

    if (!entries.length) {
      if (seq === dotsCancelRef.current) {
        setIsDotMap({});
        setInternalDotMap({});
      }
      return;
    }

    const [leaveResults, internalResults] = await Promise.all([
      Promise.allSettled(
          entries.map(({ taskId, container, awb, extraTaskIds }) =>
              retrieveLeaveMessagesApi({
                task_id: taskId,
                container_number: container,
                awb,
                extra_task_ids: extraTaskIds.length ? extraTaskIds : undefined,
              })
          )
      ),
      Promise.allSettled(
          entries.map(({ taskId, container, awb, extraTaskIds }) =>
              retrieveInternalNotesApi({
                task_id: taskId,
                container_number: container,
                awb,
                extra_task_ids: extraTaskIds.length ? extraTaskIds : undefined,
              })
          )
      ),
    ]);

    if (seq !== dotsCancelRef.current) return;

    const normalizeNotes = (result: PromiseSettledResult<any>): any[] => {
      if (result.status !== 'fulfilled') return [];
      const data = result.value as any;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.data?.data)) return data.data.data;
      return [];
    };

    const dotMap: Record<string, boolean> = {};
    const intMap: Record<string, boolean> = {};

    entries.forEach((entry, i) => {
      const leaveNotes = normalizeNotes(leaveResults[i]);
      const hasUnreadLeave = leaveNotes.some((note: any) => {
        const readBy = typeof note?.read_status_admin === 'string'
            ? note.read_status_admin.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [];
        return !readBy.includes(myName);
      });

      if (hasUnreadLeave) dotMap[entry.key] = true;

      const internalNotes = normalizeNotes(internalResults[i]);
      const hasUnreadInternal = internalNotes.some((note: any) => {
        if (String(note?.sender_name ?? '').trim() === myName) return false;

        const readBy = typeof note?.read_status_internal === 'string'
            ? note.read_status_internal.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [];

        return !readBy.includes(myName);
      });

      if (hasUnreadInternal) intMap[entry.key] = true;
    });

    setIsDotMap(dotMap);
    setInternalDotMap(intMap);
  }, [identifierField, currentUserName, resolveTaskId]);

  const hasUnreadForRow = useCallback((row: any): boolean => {
    const taskId = resolveTaskId(row);
    const identifier = identifierField !== 'awb'
        ? String(row.container_number ?? '').trim().toUpperCase()
        : String(row.awb ?? row.container_number ?? '').trim().toUpperCase();

    return !!isDotMap[`${taskId}_${identifier}`];
  }, [isDotMap, identifierField, resolveTaskId]);

  const hasInternalForRow = useCallback((row: any): boolean => {
    const taskId = resolveTaskId(row);
    const identifier = identifierField !== 'awb'
        ? String(row.container_number ?? '').trim().toUpperCase()
        : String(row.awb ?? row.container_number ?? '').trim().toUpperCase();

    return !!internalDotMap[`${taskId}_${identifier}`];
  }, [internalDotMap, identifierField, resolveTaskId]);

  // Run dot check whenever the row list refreshes
  useEffect(() => {
    updateNoteDots(rows);
  }, [rows, updateNoteDots]);

  const fetchList = useCallback(async (pg: number, silent = false) => {
    const seq = ++reqSeq.current;

    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const res = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildQuery(pg)),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (seq !== reqSeq.current) return;

      setRows(Array.isArray(data?.data) ? data.data : []);
      setTotal(Number(data?.totalRows ?? 0));
      setAssignedNameOverrides({});
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      if (!silent) setError(e?.message || 'Failed to load data');
    } finally {
      if (seq === reqSeq.current && !silent) setLoading(false);
    }
  }, [endpoint, buildQuery]);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(GET_STATUS_AMOUNT), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: statusService }),
      });

      const data = await res.json();
      setStatusCounts(data?.statusCounts ?? {});
    } catch {
      /* silent */
    }
  }, [statusService]);

  useEffect(() => {
    // Load staff assignee options
    fetch(buildApiUrl(GET_SPECIFIC_USER), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: 'DH' }),
    })
        .then(r => r.json())
        .then(d => {
          const arr = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
          setUserOptions(
              arr
                  .map((x: any) => ({
                    account_name: String(x?.account_name || '').trim(),
                  }))
                  .filter((x: any) => x.account_name)
          );
        })
        .catch(() => {});

    fetchStatusCounts();
  }, [fetchStatusCounts]);

  const handleSearch = () => {
    setPage(1);
    fetchList(1);
    fetchStatusCounts();
  };

  const handleStatusTab = (s: string) => {
    setStatusFilter(s);
    setPage(1);
  };

  // On mount: restore saved page. On status-tab change: always reset to page 1.
  const isFirstFetch = useRef(true);
  const savedPage = useRef<number>(sf.page ?? 1);

  useEffect(() => {
    if (!getApiBase()) return;

    if (isFirstFetch.current) {
      isFirstFetch.current = false;
      fetchList(savedPage.current);
    } else {
      setPage(1);
      fetchList(1);
    }
  }, [statusFilter, fetchList]);

  // Persist all filter state to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        userId,
        containerOrAwb,
        cadStatus,
        customStatus,
        portEtaStart,
        portEtaEnd,
        trainEtaStart,
        trainEtaEnd,
        transaction,
        parse,
        destination,
        rail,
        assignedName,
        customStatusTimeStart,
        customStatusTimeEnd,
        ataStart,
        ataEnd,
        cargoArrivalStart,
        cargoArrivalEnd,
        cargoPickupStart,
        cargoPickupEnd,
        sortField,
        serviceType,
        sortByNotify,
        statusFilter,
        page,
        pageSize,
      }));
    } catch {
      /* storage full or private mode */
    }
  }, [
    SESSION_KEY,
    userId,
    containerOrAwb,
    cadStatus,
    customStatus,
    portEtaStart,
    portEtaEnd,
    trainEtaStart,
    trainEtaEnd,
    transaction,
    parse,
    destination,
    rail,
    assignedName,
    customStatusTimeStart,
    customStatusTimeEnd,
    ataStart,
    ataEnd,
    cargoArrivalStart,
    cargoArrivalEnd,
    cargoPickupStart,
    cargoPickupEnd,
    sortField,
    serviceType,
    sortByNotify,
    statusFilter,
    page,
    pageSize,
  ]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchList(page, true);
      fetchStatusCounts();
    }
  }, [refreshKey]);

  // Persist column widths separately (don't want to merge into the filter effect's deps)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...prev, colWidths }));
    } catch { /* ignore */ }
  }, [colWidths]); // eslint-disable-line

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...prev, clientWidth }));
    } catch { /* ignore */ }
  }, [clientWidth]); // eslint-disable-line

  // ── Column resize handlers (Pointer Events + setPointerCapture)
  const handleResizerPD = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizingRef.current = { idx, startX: e.clientX, startW: colWidths[idx] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]); // eslint-disable-line

  const handleResizerPM = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    const r = resizingRef.current;
    if (!r || r.idx !== idx) return;
    const { startX, startW: sw } = r;
    const newW = Math.max(60, sw + (e.clientX - startX));
    const th = thRefs.current[idx];
    if (th) th.style.width = newW + 'px';
  }, []); // eslint-disable-line

  const handleResizerPU = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    const r = resizingRef.current;
    if (!r || r.idx !== idx) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const th = thRefs.current[idx];
    const finalW = th ? (parseFloat(th.style.width) || colWidths[idx]) : colWidths[idx];
    resizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setColWidths(prev => prev.map((w, i) => i === idx ? finalW : w));
  }, [colWidths]); // eslint-disable-line

  const handleClientResizePD = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    clientResizingRef.current = { startX: e.clientX, startW: clientWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [clientWidth]); // eslint-disable-line

  const handleClientResizePM = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!clientResizingRef.current) return;
    const { startX, startW } = clientResizingRef.current;
    const newW = Math.max(60, startW + (e.clientX - startX));
    const th = clientThRef.current;
    if (th) th.style.width = newW + 'px';
  }, []); // eslint-disable-line

  const handleClientResizePU = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!clientResizingRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const th = clientThRef.current;
    const finalW = th ? (parseFloat(th.style.width) || clientWidth) : clientWidth;
    clientResizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setClientWidth(finalW);
  }, [clientWidth]); // eslint-disable-line

  const changePage = (p: number) => {
    setPage(p);
    fetchList(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (size: number) => {
    pageSizeRef.current = size;
    setPageSize(size);
    setPage(1);
    fetchList(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);

    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      changePage(n);
    }

    setJumpInput('');
  };

  const goDetail = (row: any) => {
    const id = row?.main_id ?? row?.task_id;
    if (!id) return;

    // clear dot locally when navigating into details
    const taskId = resolveTaskId(row);
    const identifier = identifierField !== 'awb'
        ? String(row.container_number ?? '').trim().toUpperCase()
        : String(row.awb ?? row.container_number ?? '').trim().toUpperCase();

    setIsDotMap(prev => {
      const next = { ...prev };
      delete next[`${taskId}_${identifier}`];
      return next;
    });

    navigate(`${detailRoute}?id=${id}${detailExtraParams ? `&${detailExtraParams}` : ''}`);
  };

  const handleAssign = async (recordId: any, accountName: string) => {
    if (!updateAssignEndpoint || !updateAssignIdField) return;

    try {
      await fetch(buildApiUrl(updateAssignEndpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [updateAssignIdField]: recordId,
          assigned_name: accountName || null,
        }),
      });
    } catch {
      /* silent */
    }
  };

  // Sort by notifications: put notify rows first if toggled on
  const displayRows = sortByNotify
      ? [...rows].sort((a, b) => (b._hasNotify ? 1 : 0) - (a._hasNotify ? 1 : 0))
      : rows;

  const totalPages = Math.ceil(total / pageSize) || 1;

  const identifierLabel = identifierField === 'awb'
      ? tt('serviceList.filters.awb')
      : tt('serviceList.filters.containerNo');

  return (
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title={title} pageTitle={breadcrumb} />

          {/* Filters + status tabs stay pinned below the top bar while the table scrolls */}
          <div className="sl-sticky-filters">

          {/* ─── Filters — inline style matching Vue el-form :inline="true" ─── */}
          <Card className="mb-3">
            <CardBody>
              <div className="sl-filter-bar">

                {/* 1. Client user — always first */}
                <FI>
                  <SelectUser
                      value={userId}
                      onChange={setUserId}
                      placeholder={tt('serviceList.filters.selectClient')}
                      className="sl-w-220"
                  />
                </FI>

                {/* 2. Container / AWB */}
                <FI>
                  <CI
                      value={containerOrAwb}
                      onChange={setContainerOrAwb}
                      placeholder={identifierLabel}
                      onEnter={handleSearch}
                      className="sl-w-200"
                  />
                </FI>

                {/* 3. CAD Status */}
                {cadStatusFilter && (
                    <FI>
                      <CS
                          value={cadStatus}
                          onChange={setCadStatus}
                          placeholder={tt('serviceList.filters.cadStatus')}
                          className="sl-w-200"
                      >
                        {cadOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </CS>
                    </FI>
                )}

                {/* 4. Custom Status */}
                {customStatusFilterMarine && (
                    <FI>
                      <CS
                          value={customStatus}
                          onChange={setCustomStatus}
                          placeholder={tt('serviceList.filters.customStatus')}
                          className="sl-w-200"
                      >
                        {customStatusMarineOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </CS>
                    </FI>
                )}

                {/* 5. Port ETA range */}
                {portEtaFilter && (
                    <FI>
                      <DR
                          label={tt('serviceList.filters.portEta')}
                          start={portEtaStart}
                          end={portEtaEnd}
                          onStart={setPortEtaStart}
                          onEnd={setPortEtaEnd}
                          tt={tt}
                      />
                    </FI>
                )}

                {/* 6. Train ETA range */}
                {trainEtaFilter && (
                    <FI>
                      <DR
                          label={tt('serviceList.filters.trainEta')}
                          start={trainEtaStart}
                          end={trainEtaEnd}
                          onStart={setTrainEtaStart}
                          onEnd={setTrainEtaEnd}
                          tt={tt}
                      />
                    </FI>
                )}

                {/* 7. Transaction */}
                {transactionFilter && (
                    <FI>
                      <CI
                          value={transaction}
                          onChange={setTransaction}
                          placeholder={tt('serviceList.filters.transaction')}
                          onEnter={handleSearch}
                          className="sl-w-200"
                      />
                    </FI>
                )}

                {/* 7b. PARS */}
                {parsFilter && (
                    <FI>
                      <CI
                          value={parse}
                          onChange={setParse}
                          placeholder={tt('serviceList.filters.pars')}
                          onEnter={handleSearch}
                          className="sl-w-200"
                      />
                    </FI>
                )}

                {/* 8. Destination */}
                <FI>
                  <SelectDestination
                      value={destination}
                      onChange={setDestination}
                      placeholder={tt('serviceList.filters.destination')}
                      className="sl-w-200"
                  />
                </FI>

                {/* 9. Rail */}
                {railFilter && (
                    <FI>
                      <CS
                          value={rail}
                          onChange={setRail}
                          placeholder={tt('serviceList.filters.rail')}
                          className="sl-w-200"
                      >
                        {RAIL_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </CS>
                    </FI>
                )}

                {/* 10. Assignee (staff) */}
                <FI>
                  <CS
                      value={assignedName}
                      onChange={setAssignedName}
                      placeholder={tt('serviceList.filters.assignee')}
                      className="sl-w-200"
                  >
                    {userOptions.map(u => (
                        <option key={u.account_name} value={u.account_name}>{u.account_name}</option>
                    ))}
                  </CS>
                </FI>

                {/* 11. Custom Status Time range */}
                {customStatusTimeFilter && (
                    <FI>
                      <DR
                          label={tt('serviceList.filters.customStatusTime')}
                          start={customStatusTimeStart}
                          end={customStatusTimeEnd}
                          onStart={setCustomStatusTimeStart}
                          onEnd={setCustomStatusTimeEnd}
                          tt={tt}
                      />
                    </FI>
                )}

                {/* 12. ATA range */}
                {ataFilter && (
                    <FI>
                      <DR
                          label={tt('serviceList.filters.ata')}
                          start={ataStart}
                          end={ataEnd}
                          onStart={setAtaStart}
                          onEnd={setAtaEnd}
                          tt={tt}
                      />
                    </FI>
                )}

                {/* 13. Cargo Arrival Time range */}
                {cargoArrivalFilter && (
                    <FI>
                      <DR
                          label={tt('serviceList.filters.cargoArrivalTime')}
                          start={cargoArrivalStart}
                          end={cargoArrivalEnd}
                          onStart={setCargoArrivalStart}
                          onEnd={setCargoArrivalEnd}
                          tt={tt}
                      />
                    </FI>
                )}

                {/* 14. Cargo Pickup Time range */}
                {cargoPickupFilter && (
                    <FI>
                      <DR
                          label={tt('serviceList.filters.cargoPickupTime')}
                          start={cargoPickupStart}
                          end={cargoPickupEnd}
                          onStart={setCargoPickupStart}
                          onEnd={setCargoPickupEnd}
                          tt={tt}
                      />
                    </FI>
                )}

                {/* 15. Service Type */}
                {serviceTypeFilter && (
                    <FI>
                      <CS
                          value={serviceType}
                          onChange={setServiceType}
                          placeholder={tt('serviceList.filters.serviceType')}
                          className="sl-w-200"
                      >
                        <option value="0">USA to CA</option>
                        <option value="1">CA to USA</option>
                        <option value="2">Dropship</option>
                        <option value="3">FBA</option>
                        <option value="4">First Mile</option>
                        <option value="5">3rd Party</option>
                      </CS>
                    </FI>
                )}

                {/* 16. Sort Field */}
                {sortFieldOptions && sortFieldOptions.length > 0 && (
                    <FI>
                      <CS
                          value={sortField}
                          onChange={setSortField}
                          placeholder={tt('serviceList.filters.sortBy')}
                          className="sl-w-200"
                      >
                        {sortFieldOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </CS>
                    </FI>
                )}

                {/* 16. Sort by Notifications toggle */}
                <FI>
                  <Button
                      color={sortByNotify ? 'primary' : 'secondary'}
                      outline={!sortByNotify}
                      onClick={() => setSortByNotify(v => !v)}
                  >
                    {tt('serviceList.filters.notifications')} {sortByNotify ? 'ON' : 'OFF'}
                  </Button>
                </FI>

                {/* 17. Refresh */}
                <FI>
                  <Button color="primary" onClick={handleSearch} disabled={loading}>
                    {loading ? <Spinner size="sm" className="me-1" /> : null}
                    {tt('serviceList.filters.refresh')}
                  </Button>
                </FI>
              </div>
            </CardBody>
          </Card>

          {error && <Alert color="danger">{error}</Alert>}

          {/* ─── Status tabs with badges (mirrors Vue el-badge + it-bu) ─── */}
          <div className="orderlist-status-tabs mb-3">
            {(statusTabsOverride ?? statusTabs).map(tab => {
              const count = tab.value === allStatusValue ? statusCounts['all'] : statusCounts[tab.value];
              const active = statusFilter === tab.value;

              return (
                  <div key={tab.value} className="btn-badge-wrap">
                    <button
                        type="button"
                        onClick={() => handleStatusTab(tab.value)}
                        className={`orderlist-status-tab${active ? ' active' : ''}`}
                    >
                      {tab.label}
                    </button>

                    {Number(count) > 0 && (
                        <span className="sl-tab-badge">
                    {Number(count) > 999 ? '999+' : Number(count)}
                  </span>
                    )}
                  </div>
              );
            })}
          </div>

          </div>{/* /.sl-sticky-filters */}

          {/* ─── Table ─── */}
          <Card className="sl-table-card">
            <CardBody className="p-0">
              <div className="sl-table-scroll" ref={tableScrollRef}>
                <Table className="mb-0 sl-table">
                  <thead>
                  <tr>
                    {updateAssignEndpoint && (
                        <th className="sl-th-assignee sl-col-sticky-left">
                          {tt('serviceList.table.assignee')}
                        </th>
                    )}

                    <th
                        className="sl-th-client"
                        ref={clientThRef}
                        style={{ width: clientWidth, minWidth: 60, position: 'relative' }}
                    >
                      {tt('serviceList.table.client')}
                      <div
                          className="sl-col-resizer"
                          onPointerDown={handleClientResizePD}
                          onPointerMove={handleClientResizePM}
                          onPointerUp={handleClientResizePU}
                      />
                    </th>

                    {columns.map((col, i) => (
                        <th
                          key={i}
                          ref={(el) => { thRefs.current[i] = el; }}
                          style={{ width: colWidths[i], minWidth: 60, position: 'relative' }}
                        >
                          {col.label}
                          <div
                            className="sl-col-resizer"
                            onPointerDown={(e) => handleResizerPD(e, i)}
                            onPointerMove={(e) => handleResizerPM(e, i)}
                            onPointerUp={(e) => handleResizerPU(e, i)}
                          />
                        </th>
                    ))}

                    <th className={`sl-col-sticky-right ${extraActions ? 'sl-th-actions-wide' : 'sl-th-actions'}`}>
                      {tt('serviceList.table.action')}
                    </th>
                  </tr>
                  </thead>

                  <tbody>
                  {loading && (
                      <tr>
                        <td colSpan={columns.length + 3} className="text-center py-5">
                          <Spinner color="primary" />
                        </td>
                      </tr>
                  )}

                  {!loading && displayRows.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 3} className="text-center text-muted py-5">
                          {tt('serviceList.table.noRecords')}
                        </td>
                      </tr>
                  )}

                  {!loading && displayRows.map((row, i) => {
                    const rowKey = row[updateAssignIdField ?? 'main_id'] ?? row.main_id ?? i;
                    const assignKey = String(row[updateAssignIdField ?? 'main_id'] ?? row.main_id ?? i);
                    const showUnread = hasUnreadForRow(row);
                    const showInternal = hasInternalForRow(row);
                    const displayAssigned = assignKey in assignedNameOverrides
                        ? assignedNameOverrides[assignKey]
                        : (row.assigned_name || '');

                    return (
                        <tr
                            key={rowKey}
                            className={updatedRowId === String(rowKey) ? 'sl-row-updated' : undefined}
                        >
                          {updateAssignEndpoint && (
                              <td className="sl-col-sticky-left">
                                {canEditAssign ? (
                                    <div className="sl-assignee-input">
                                      <Select
                                          classNamePrefix="rs"
                                          options={[
                                            { value: '', label: tt('serviceList.table.unassigned') },
                                            ...userOptions.map(u => ({ value: u.account_name, label: u.account_name })),
                                          ]}
                                          value={{ value: displayAssigned, label: displayAssigned || tt('serviceList.table.unassigned') }}
                                          onChange={(opt: { value: string; label: string } | null) => {
                                            const val = opt ? opt.value : '';
                                            setAssignedNameOverrides(prev => ({ ...prev, [assignKey]: val }));
                                            handleAssign(row[updateAssignIdField ?? 'id'], val);
                                          }}
                                          menuPortalTarget={document.body}
                                          menuPosition="fixed"
                                          styles={{
                                            control: (base: object) => ({ ...base, minHeight: 24, height: 24, fontSize: 9 }),
                                            valueContainer: (base: object) => ({ ...base, padding: '0 4px' }),
                                            indicatorsContainer: (base: object) => ({ ...base, height: 24 }),
                                            dropdownIndicator: (base: object) => ({ ...base, padding: '0 2px' }),
                                            menuPortal: (base: object) => ({ ...base, zIndex: 9999 }),
                                            menu: (base: object) => ({ ...base, fontSize: 12 }),
                                          }}
                                      />
                                    </div>
                                ) : (
                                    <span className="text-muted small">{displayAssigned || '-'}</span>
                                )}
                              </td>
                          )}

                          <td>
                            <OverflowTooltip text={row.user_name || ''}>
                              {row.user_name || '-'}
                            </OverflowTooltip>
                          </td>

                          {columns.map((col, ci) => (
                              <td key={ci}>
                                {ci === notificationColIdx && showUnread && (
                                    <div className="orderlist-newmsg-wrap">
                                <span className="orderlist-newmsg-tag">
                                  {tt('chat.newClientMessage')}
                                </span>
                                    </div>
                                )}

                                {ci === notificationColIdx && showInternal && (
                                    <div className="orderlist-newmsg-wrap">
                                <span className="orderlist-internalmsg-tag">
                                  {tt('chat.internalMessage')}
                                </span>
                                    </div>
                                )}

                                {col.getTitle
                                    ? (
                                        <OverflowTooltip text={col.getTitle(row)}>
                                          {col.render(row)}
                                        </OverflowTooltip>
                                    )
                                    : col.render(row)}
                              </td>
                          ))}

                          <td className="sl-col-sticky-right">
                            <div className="d-flex gap-1 flex-wrap">
                              {extraActions && extraActions(row)}

                              <span className="btn-badge-wrap">
                              <Button
                                  size="sm"
                                  color="primary"
                                  outline
                                  onClick={() => goDetail(row)}
                              >
                                {tt('orderList.table.detailStatus')}
                              </Button>

                                {(showUnread || showInternal) && <span className="btn-unread-dot" />}
                            </span>
                            </div>
                          </td>
                        </tr>
                    );
                  })}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          </Card>

          {/* Fixed copy of the header row, shown once the real one scrolls under the filter bar */}
          <StickyTableHeader scrollRef={tableScrollRef} />

          {/* ─── Pagination — mirrors Vue el-pagination layout: total,sizes,prev,pager,next,jumper ─── */}
          <div className="sl-pagination">
            {/* total */}
            <span className="sl-pg-total">
            {tt('serviceList.pagination.total')} {total} {tt('serviceList.pagination.items')}
          </span>

            {/* sizes */}
            <Input
                type="select"
                bsSize="sm"
                className="sl-page-size-select"
                value={pageSize}
                onChange={e => handlePageSizeChange(Number(e.target.value))}
            >
              {[10, 15, 20, 30, 50, 500].map(n => (
                  <option key={n} value={n}>
                    {n} {tt('serviceList.pagination.perPage')}
                  </option>
              ))}
            </Input>

            {/* prev */}
            <button
                className="sl-pg-btn"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                title="Previous"
            >
              ‹
            </button>

            {/* pager — numbered buttons with ellipsis */}
            {(() => {
              const pages: (number | '...')[] = [];

              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else if (page <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
              } else if (page >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
              } else {
                pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
              }

              return pages.map((p, i) =>
                  p === '...'
                      ? (
                          <span key={`e${i}`} className="sl-pg-ellipsis">
                    …
                  </span>
                      )
                      : (
                          <button
                              key={p}
                              className={`sl-pg-btn${page === p ? ' active' : ''}`}
                              onClick={() => changePage(p as number)}
                          >
                            {p}
                          </button>
                      )
              );
            })()}

            {/* next */}
            <button
                className="sl-pg-btn"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
                title="Next"
            >
              ›
            </button>

            {/* jumper */}
            <span className="sl-pg-jumper">
            {tt('serviceList.pagination.goto')}

              <input
                  type="number"
                  className="sl-jump-input"
                  min={1}
                  max={totalPages}
                  value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJump()}
              />

              {tt('serviceList.pagination.page')}
          </span>
          </div>

          {pageActions && (
              <div className="sl-page-actions">{pageActions}</div>
          )}
        </Container>
      </div>
  );
};

export default ServiceListPage;