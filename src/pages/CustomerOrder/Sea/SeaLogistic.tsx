import React, { useCallback, useEffect, useRef, useState, useMemo, Children, isValidElement } from 'react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
import ReactDOM from 'react-dom';
import {
  Button, Card, CardBody, Container, Input, Spinner, Alert,
  Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label,
} from 'reactstrap';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import BreadCrumb from '../../../Components/Common/BreadCrumb';
import StickyTableHeader from '../StickyTableHeader';
import SelectUser from '../../../Components/Common/SelectUser';
import SelectDestination from '../../../Components/Common/SelectDestination';
import { buildApiUrl } from '../../../helpers/apiBase';
import {
  MARINE_LOGISTIC_TICKET_DETAILS,
  UPDATE_MARINE_LOGISTIC_TICKET_DETAILS,
  MARINE_CONTAINER_EVENTS,
  GET_STATUS_AMOUNT,
  MAIN_TICKET_DETAILS,
  BULK_CREATE_LOGISTIC_MARINE_EXCEL,
  BULK_UPDATE_TRAIN_ETA_EXCEL,
} from '../../../helpers/url_helper';
import { useTT } from '../../../helpers/useTT';
import { retrieveLeaveMessagesApi, retrieveInternalNotesApi } from '../../../helpers/api_fetch/leaveMessage';
import { doFetch } from '../../../helpers/api_fetch/helper/fetchHelper';
import { fmtDate } from '../../../helpers/dateUtils';
import { getUserNameFromSession } from '../../../helpers/userInformation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SavedFilters = Partial<{
  userId: string;
  containerNo: string;
  note: string;
  portEtaStart: string;
  portEtaEnd: string;
  pickupStart: string;
  pickupEnd: string;
  completeStart: string;
  completeEnd: string;
  mbl: string;
  hbl: string;
  rail: string;
  destination: string;
  sortField: string;
  isPickupContainer: string;
  pkNumEmpty: string;
  ersStatus: string;
  goWarehouse: string;
  statusFilter: string;
  sortByNotify: boolean;
  page: number;
  pageSize: number;
}>;

type FiltersSnap = {
  userId: string;
  containerNo: string;
  note: string;
  portEtaStart: string;
  portEtaEnd: string;
  pickupStart: string;
  pickupEnd: string;
  completeStart: string;
  completeEnd: string;
  mbl: string;
  hbl: string;
  rail: string;
  destination: string;
  sortField: string;
  isPickupContainer: string;
  pkNumEmpty: string;
  ersStatus: string;
  goWarehouse: string;
  statusFilter: string;
};

const toStr = (v: unknown, fallback = ''): string => {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
};

const toBool = (v: unknown, fallback = false): boolean => {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
};

const toNum = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const readSavedFilters = (key: string): SavedFilters => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SavedFilters) : {};
  } catch {
    return {};
  }
};

// Vue: c.container_status == 4 ? 'danger' : c.container_status == 10 ? 'warning' : 'success'
const containerStatusClass = (v: unknown): string => {
  const n = Number(v);
  if (n === 4)  return 'sl-text-danger';
  if (n === 10) return 'sl-text-warning';
  if (n === 8)  return 'sl-text-warning';
  return 'sl-text-success';
};

const containerStatusLabel = (v: unknown, tt: (k: string) => string): string => {
  const n = Number(v);
  const map: Record<number, string> = {
    0: 'logistic.status.underReview',
    1: 'logistic.status.processing',
    2: 'logistic.status.inTransit',
    8: 'logistic.status.pendingComplete',
    3: 'logistic.status.deliveryCompleted',
    4: 'logistic.status.rejected',
    6: 'logistic.status.completed',
    10: 'logistic.status.deletePending',
  };
  return map[n] ? tt(map[n]) : '-';
};

// Vue formatNewGoWarehouse
const goWarehouseLabel = (v: unknown, tt: (k: string) => string): string => {
  const n = Number(String(v ?? '').trim());
  if (n === 0) return tt('logistic.goWarehouse.dhWarehouse');
  if (n === 1) return tt('logistic.goWarehouse.thirdParty');
  if (n === 2) return tt('logistic.goWarehouse.do');
  return '-';
};

// Vue formatGoWarehouse / formatAnEmf — Yes / No
const ynLabel = (v: unknown, tt: (k: string) => string): string =>
    Number(v) === 1 ? tt('common.yes') : tt('common.no');

// Vue formatDateOnly (common/helper/usePinGuard.ts) — first 10 chars, no reformatting
const formatDateOnly = (v: unknown): string => (v ? String(v).slice(0, 10) : '');

// Vue formatCurrency (common/helper/usePinGuard.ts)
const formatCurrencyLabel = (v: unknown): string => {
  const n = Number(String(v ?? '').trim());
  if (n === 0) return 'CAD';
  if (n === 1) return 'USD';
  return '-';
};

// Vue toToronto — moment.utc(v).tz('America/Toronto').format('YYYY-MM-DD HH:mm:ss'),
// reimplemented with Intl so no moment-timezone dependency is needed.
const toTorontoTime = (v: unknown): string => {
  if (!v) return '-';
  const raw = String(v).trim();
  if (!raw) return '-';
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
};

// ─── Container grouping — mirrors Vue groupedDataList ─────────────────────────

const groupRows = (rows: any[]): any[] => {
  if (!rows.length) return rows;

  const firstIdx = new Map<string, number>();
  rows.forEach((r, i) => {
    const key = String(r.logistic_marine_id ?? '');
    if (key && !firstIdx.has(key)) firstIdx.set(key, i);
  });

  const map = new Map<string, any>();
  for (const r of rows) {
    const key = String(r.logistic_marine_id ?? '');
    if (!key) continue;
    const cont = {
      container_number: r.container_number,
      shipline: r.shipline,
      portETA: r.portETA,
      trainETA: r.trainETA,
      last_free_day: r.last_free_day,
      tele: r.tele,
      pk_num: r.pk_num,
      pickup_container_date: r.pickup_container_date,
      return_container_date: r.return_container_date,
      container_status: r.container_status,
      complete_time: r.complete_time,
      container_note: r.container_note,
    };
    if (!map.has(key)) map.set(key, { ...r, containers: [cont] });
    else map.get(key).containers.push(cont);
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    const ia = firstIdx.get(String(a.logistic_marine_id)) ?? 0;
    const ib = firstIdx.get(String(b.logistic_marine_id)) ?? 0;
    return ia - ib;
  });

  const result: any[] = [];
  for (const g of sorted) {
    const hasMbl = String(g.mbl ?? '').trim().length > 0;
    if (hasMbl) {
      // Vue sets top-level fields from first container, keeps containers[] for multi-cell rendering
      const first = g.containers?.[0];
      if (first) {
        g.container_number        = first.container_number;
        g.shipline                = first.shipline;
        g.portETA                 = first.portETA;
        g.trainETA                = first.trainETA;
        g.last_free_day           = first.last_free_day;
        g.tele                    = first.tele;
        g.pk_num                  = first.pk_num;
        g.pickup_container_date   = first.pickup_container_date;
        g.return_container_date   = first.return_container_date;
        g.complete_time           = first.complete_time;
        g.container_status        = first.container_status;
        g.container_note          = first.container_note;
      }
      result.push(g);
    } else {
      for (const r of rows) {
        if (String(r.logistic_marine_id ?? '') === String(g.logistic_marine_id ?? ''))
          result.push({ ...r, containers: [] }); // no grouping — individual row
      }
    }
  }
  return result;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FI: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="sl-fi">{children}</div>
);

const CS: React.FC<{
  value: string; onChange: (v: string) => void;
  placeholder: string; className?: string; children: React.ReactNode;
}> = ({ value, onChange, placeholder, className, children }) => {
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

const CI: React.FC<{
  value: string; onChange: (v: string) => void;
  placeholder: string; className?: string; onEnter?: () => void;
}> = ({ value, onChange, placeholder, className, onEnter }) => (
    <div className={`sl-wrap${value ? ' sl-has-clear' : ''}${className ? ` ${className}` : ''}`}>
      <Input value={value} onChange={e => onChange(e.target.value)}
             placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && onEnter?.()} />
      {value && <button type="button" className="sl-clear-input" onClick={() => onChange('')}>×</button>}
    </div>
);

const DR: React.FC<{
  label: string; start: string; end: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
  tt: (k: string) => string;
}> = ({ label, start, end, onStart, onEnd, tt }) => (
    <div>
      <div className="sl-date-label">{label}</div>
      <div className="sl-date-row">
        <div className={`sl-date-field${!start ? ' sl-date-field--empty' : ''}`}>
          {!start && <span className="sl-date-placeholder">{tt('serviceList.filters.startDate')}</span>}
          <Input type="date" className="sl-date-input" value={start} onChange={e => onStart(e.target.value)} />
        </div>
        <span className="sl-date-sep">—</span>
        <div className={`sl-date-field${!end ? ' sl-date-field--empty' : ''}`}>
          {!end && <span className="sl-date-placeholder">{tt('serviceList.filters.endDate')}</span>}
          <Input type="date" className="sl-date-input" value={end} onChange={e => onEnd(e.target.value)} />
        </div>
        {(start || end) && (
            <button type="button" className="sl-date-clear" onClick={() => { onStart(''); onEnd(''); }}>×</button>
        )}
      </div>
    </div>
);

// Copyable overflow tooltip — portals popup to document.body so sticky/overflow parents can't clip it
const OverflowTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const hideTimer = React.useRef<number | null>(null);

  const clearHideTimer = () => {
    const timer = hideTimer.current;
    if (timer !== null) {
      window.clearTimeout(timer);
      hideTimer.current = null;
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
      hideTimer.current = null;
    }, 120);
  };

  const cancelHide  = () => {
    clearHideTimer();
  };

  React.useEffect(() => () => {
    clearHideTimer();
  }, []);

  if (!text) return <>{children}</>;
  return (
      <>
      <span className="sl-ot-trigger" onMouseEnter={show} onMouseLeave={scheduleHide}>
        {children}
      </span>
        {pos && ReactDOM.createPortal(
            <div className="sl-ot-popup" style={{ left: pos.left, top: pos.top }}
                 onMouseEnter={cancelHide} onMouseLeave={scheduleHide}>
              {text}
            </div>,
            document.body
        )}
      </>
  );
};

// Multi-container cell
const MC: React.FC<{
  row: any; field: string; fmt?: (v: any) => React.ReactNode;
}> = ({ row, field, fmt }) => {
  const conts: any[] = Array.isArray(row.containers) && row.containers.length > 1
      ? row.containers : [];
  if (conts.length) {
    return (
        <div className="sl-multi-cont">
          {conts.map((c, i) => (
              <div key={i}>{fmt ? fmt(c[field]) : (c[field] || '-')}</div>
          ))}
        </div>
    );
  }
  const val = row[field];
  return <>{fmt ? fmt(val) : (val || '-')}</>;
};

// ─── Component ────────────────────────────────────────────────────────────────

const SeaLogistic: React.FC = () => {
  const { tt } = useTT();
  const navigate = useNavigate();

  const STATUS_TABS = useMemo(() => [
    { value: '0',  label: tt('logistic.status.underReview') },
    { value: '1',  label: tt('logistic.status.processing') },
    { value: '2',  label: tt('logistic.status.inTransit') },
    { value: '8',  label: tt('logistic.status.pendingComplete') },
    { value: '3',  label: tt('logistic.status.completed') },
    { value: '6',  label: tt('logistic.status.totalCompleted') },
    { value: '4',  label: tt('logistic.status.rejected') },
    { value: '5',  label: tt('logistic.status.all') },
    { value: '10', label: tt('logistic.status.deletePending') },
  ], [tt]);

  // ── Session persistence
  const SESSION_KEY = 'sl_logistic_marine';
  const sf = useRef<SavedFilters>(readSavedFilters(SESSION_KEY)).current;

  // ── Filters
  const [userId, setUserId]                       = useState<string>(toStr(sf.userId));
  const [containerNo, setContainerNo]             = useState<string>(toStr(sf.containerNo));
  const [note, setNote]                           = useState<string>(toStr(sf.note));
  const [portEtaStart, setPortEtaStart]           = useState<string>(toStr(sf.portEtaStart));
  const [portEtaEnd, setPortEtaEnd]               = useState<string>(toStr(sf.portEtaEnd));
  const [pickupStart, setPickupStart]             = useState<string>(toStr(sf.pickupStart));
  const [pickupEnd, setPickupEnd]                 = useState<string>(toStr(sf.pickupEnd));
  const [completeStart, setCompleteStart]         = useState<string>(toStr(sf.completeStart));
  const [completeEnd, setCompleteEnd]             = useState<string>(toStr(sf.completeEnd));
  const [mbl, setMbl]                             = useState<string>(toStr(sf.mbl));
  const [hbl, setHbl]                             = useState<string>(toStr(sf.hbl));
  const [rail, setRail]                           = useState<string>(toStr(sf.rail));
  const [destination, setDestination]             = useState<string>(toStr(sf.destination));
  const [sortField, setSortField]                 = useState<string>(toStr(sf.sortField));
  const [isPickupContainer, setIsPickupContainer] = useState<string>(toStr(sf.isPickupContainer));
  const [pkNumEmpty, setPkNumEmpty]               = useState<string>(toStr(sf.pkNumEmpty));
  const [ersStatus, setErsStatus]                 = useState<string>(toStr(sf.ersStatus));
  const [goWarehouse, setGoWarehouse]             = useState<string>(toStr(sf.goWarehouse));
  const [sortByNotify, setSortByNotify]           = useState<boolean>(toBool(sf.sortByNotify));
  const [statusFilter, setStatusFilter]           = useState<string>(toStr(sf.statusFilter, '5') || '5');

  const [page, setPage]         = useState<number>(toNum(sf.page, 1));
  const [pageSize, setPageSize] = useState<number>(toNum(sf.pageSize, 20));
  const pageSizeRef             = useRef<number>(toNum(sf.pageSize, 20));
  const [jumpInput, setJumpInput] = useState<string>('');

  // ── Data
  const [rows, setRows]                 = useState<any[]>([]);
  const [total, setTotal]               = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null);
  const highlightTimer                  = useRef<number | null>(null);

  // ── Unread dot maps (client messages and internal notes tracked separately)
  const [clientDotMap, setClientDotMap] = useState<Record<string, boolean>>({});
  const [internalDotMap, setInternalDotMap] = useState<Record<string, boolean>>({});
  const dotsCancelRef = useRef(0);
  const currentUserName = getUserNameFromSession();
  const uploadRef = useRef<HTMLInputElement>(null);
  const trainEtaRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [trainEtaUploading, setTrainEtaUploading] = useState(false);

  // ── Examine modal
  const [examineOpen, setExamineOpen]       = useState(false);
  const [examineRow, setExamineRow]         = useState<any>(null);
  const [examineType, setExamineType]       = useState<'1' | '2'>('1');
  const [examineNote, setExamineNote]       = useState('');
  const [examineLoading, setExamineLoading] = useState(false);

  // ── Track modal
  const [trackOpen, setTrackOpen]           = useState(false);
  const [trackContainer, setTrackContainer] = useState('');
  const [trackData, setTrackData]           = useState<any[]>([]);
  const [trackLoading, setTrackLoading]     = useState(false);

  const reqSeq = useRef(0);

  // Keep filter snapshot for buildQuery (avoids stale closures)
  const filtersSnap = useRef<FiltersSnap>({
    userId, containerNo, note, portEtaStart, portEtaEnd,
    pickupStart, pickupEnd, completeStart, completeEnd,
    mbl, hbl, rail, destination, sortField,
    isPickupContainer, pkNumEmpty, ersStatus, goWarehouse, statusFilter,
  });
  filtersSnap.current = {
    userId, containerNo, note, portEtaStart, portEtaEnd,
    pickupStart, pickupEnd, completeStart, completeEnd,
    mbl, hbl, rail, destination, sortField,
    isPickupContainer, pkNumEmpty, ersStatus, goWarehouse, statusFilter,
  };

  const buildQuery = useCallback((pg: number) => {
    const f = filtersSnap.current;
    const q: any = { page: pg, pageSize: pageSizeRef.current };
    if (f.statusFilter !== '5') q.status = f.statusFilter;
    if (f.userId) q.user_id = f.userId;
    if (f.containerNo.trim()) q.container_number = f.containerNo.trim().replace(/\s+/g, '');
    if (f.note.trim()) q.note = f.note.trim();
    if (f.portEtaStart) q.portETA_start = f.portEtaStart;
    if (f.portEtaEnd)   q.portETA_end   = f.portEtaEnd;
    if (f.pickupStart)  q.pickup_container_date_start = f.pickupStart;
    if (f.pickupEnd)    q.pickup_container_date_end   = f.pickupEnd;
    if (f.completeStart) q.complete_time_start = `${f.completeStart} 00:00:00`;
    if (f.completeEnd)   q.complete_time_end   = `${f.completeEnd} 23:59:59`;
    if (f.mbl.trim()) q.mbl = f.mbl.trim();
    if (f.hbl.trim()) q.hbl = f.hbl.trim();
    if (f.rail)        q.rail        = f.rail;
    if (f.destination) q.destination = f.destination;
    if (f.sortField)   q.sortField   = f.sortField;
    if (f.isPickupContainer !== '') q.is_pickup_container = Number(f.isPickupContainer);
    if (f.pkNumEmpty   !== '') q.pk_num_empty = Number(f.pkNumEmpty);
    if (f.ersStatus    !== '') q.ers_status   = Number(f.ersStatus);
    if (f.goWarehouse  !== '') q.go_warehouse = Number(f.goWarehouse);
    return q;
  }, []);

  const fetchList = useCallback(async (pg: number, silent = false) => {
    const seq = ++reqSeq.current;
    if (!silent) { setLoading(true); setError(''); }
    try {
      const res = await fetch(buildApiUrl(MARINE_LOGISTIC_TICKET_DETAILS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildQuery(pg)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (seq !== reqSeq.current) return;
      setRows(Array.isArray(data?.data) ? data.data : []);
      setTotal(Number(data?.totalRows ?? 0));
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      if (!silent) setError(e?.message || 'Failed to load data');
    } finally {
      if (seq === reqSeq.current && !silent) setLoading(false);
    }
  }, [buildQuery]);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(GET_STATUS_AMOUNT), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'logistic_marine' }),
      });
      const data = await res.json();
      setStatusCounts(data?.statusCounts ?? {});
    } catch { /* silent */ }
  }, []);

  const initDone = useRef(false);
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    fetchList(toNum(sf.page, 1));
    fetchStatusCounts();
  }, []); // intentional: run once on mount

  // Persist filters to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        userId, containerNo, note, portEtaStart, portEtaEnd,
        pickupStart, pickupEnd, completeStart, completeEnd,
        mbl, hbl, rail, destination, sortField,
        isPickupContainer, pkNumEmpty, ersStatus, goWarehouse,
        sortByNotify, statusFilter, page, pageSize,
      }));
    } catch { /* ignore */ }
  }, [
    SESSION_KEY,
    userId, containerNo, note, portEtaStart, portEtaEnd,
    pickupStart, pickupEnd, completeStart, completeEnd,
    mbl, hbl, rail, destination, sortField,
    isPickupContainer, pkNumEmpty, ersStatus, goWarehouse,
    sortByNotify, statusFilter, page, pageSize,
  ]);

  const handleSearch = () => { setPage(1); fetchList(1); fetchStatusCounts(); };

  const handleStatusTab = (s: string) => {
    setStatusFilter(s);
    setPage(1);
    // flush state then fetch
    window.setTimeout(() => { filtersSnap.current.statusFilter = s; fetchList(1); }, 0);
  };

  const changePage = (p: number) => {
    setPage(p); fetchList(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handlePageSizeChange = (size: number) => {
    pageSizeRef.current = size; setPageSize(size); setPage(1); fetchList(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) changePage(n);
    setJumpInput('');
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  // Optimistic patch
  const patchRow = useCallback((logisticId: any, containers: { container_number: string; status: number }[]) => {
    setRows(prev => prev.map(r => {
      if (String(r.logistic_marine_id) !== String(logisticId)) return r;
      const match = containers.find(c => c.container_number === r.container_number);
      return match ? { ...r, container_status: match.status } : r;
    }));
    setUpdatedRowId(String(logisticId));

    const timer = highlightTimer.current;
    if (timer !== null) {
      window.clearTimeout(timer);
    }

    highlightTimer.current = window.setTimeout(() => {
      setUpdatedRowId(null);
      highlightTimer.current = null;
    }, 900);
  }, []);

  const displayRows = useMemo(() => groupRows(rows), [rows]);

  // Matches dh-admin-app's order_run/sea/logistic.vue exportToExcel exactly:
  // one row per ticket (not per container), container-level fields joined
  // with ',' (Note joined with ' | '), same column set/order.
  const exportToExcel = () => {
    const headers = [
      'User', 'MBL', 'HBL', 'Container Number', 'Need Pickup', 'Go Warehouse',
      'Destination', 'Shipline', 'Port ETA', 'Rail', 'Train ETA', 'Last Free Day',
      'Pickup Number', 'Pickup Date', 'Return Date', 'Telex', 'FCL', 'ERS',
      'Quotation', 'Quotation Currency', 'Cost', 'Cost Currency', 'Note', 'Status', 'Create Time',
    ];

    const dataRows = displayRows.map((r) => {
      const isGrouped = Array.isArray(r.containers) && r.containers.length > 1;
      const hbl = Array.isArray(r.hbl_list) && r.hbl_list.length ? r.hbl_list.join(',') : (r.hbl || '');

      const containerNumber = isGrouped
          ? r.containers.map((c: any) => c.container_number || '').join(',')
          : (r.container_number || '');
      const shipline = isGrouped
          ? r.containers.map((c: any) => c.shipline || '').join(',')
          : (r.shipline || '');
      const portETA = isGrouped
          ? r.containers.map((c: any) => c.portETA || '').join(',')
          : (r.portETA || '');
      const trainETA = isGrouped
          ? r.containers.map((c: any) => c.trainETA || '').join(',')
          : (r.trainETA || '');
      const lastFreeDay = isGrouped
          ? r.containers.map((c: any) => formatDateOnly(c.last_free_day)).join(',')
          : formatDateOnly(r.last_free_day);
      const pkNum = isGrouped
          ? r.containers.map((c: any) => c.pk_num || '').join(',')
          : (r.pk_num || '');
      const pickupDate = isGrouped
          ? r.containers.map((c: any) => c.pickup_container_date || '').join(',')
          : (r.pickup_container_date || '');
      const returnDate = isGrouped
          ? r.containers.map((c: any) => c.return_container_date || '').join(',')
          : (r.return_container_date || '');
      const telex = isGrouped
          ? r.containers.map((c: any) => ynLabel(c.tele, tt)).join(',')
          : ynLabel(r.tele, tt);
      const note = isGrouped
          ? r.containers.map((c: any) => c.container_note || '').join(' | ')
          : (r.container_note || '');
      const status = isGrouped
          ? r.containers.map((c: any) => containerStatusLabel(c.container_status, tt)).join(',')
          : containerStatusLabel(r.container_status, tt);

      return [
        r.user_name || '',
        r.mbl || '',
        hbl,
        containerNumber,
        ynLabel(r.is_pickup_container, tt),
        goWarehouseLabel(r.go_warehouse, tt),
        r.destination || '',
        shipline,
        portETA,
        r.rail || '',
        trainETA,
        lastFreeDay,
        pkNum,
        pickupDate,
        returnDate,
        telex,
        r.fcl == 1 ? 'Yes' : 'No',
        r.ers_status == 1 ? 'Yes' : 'No',
        r.quotation ?? '-',
        formatCurrencyLabel(r.quotation_currency),
        r.cost ?? '-',
        formatCurrencyLabel(r.cost_currency),
        note,
        status,
        toTorontoTime(r.logistic_marine_create_time),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Container Report');
    XLSX.writeFile(wb, 'Logistic_Container_Report.xlsx');
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(buildApiUrl(BULK_CREATE_LOGISTIC_MARINE_EXCEL), { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      toast.success(tt('serviceList.actions.uploadSuccess'));
      fetchList(1);
    } catch {
      toast.error(tt('serviceList.actions.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleTrainEtaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTrainEtaUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(buildApiUrl(BULK_UPDATE_TRAIN_ETA_EXCEL), { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message);
      toast.success(json?.message || tt('serviceList.actions.uploadSuccess'));
      fetchList(1);
    } catch {
      toast.error(tt('serviceList.actions.uploadFailed'));
    } finally {
      setTrainEtaUploading(false);
    }
  };

  const updateNoteDots = useCallback(async (list: any[]) => {
    const seq = ++dotsCancelRef.current;
    const myName = currentUserName.trim();

    // Collect unique main_ids
    const mainIdSet = new Set<string>();
    for (const row of list) {
      const mainId = String(row.main_id ?? '').trim();
      if (mainId) mainIdSet.add(mainId);
    }

    if (!mainIdSet.size) {
      if (seq === dotsCancelRef.current) {
        setClientDotMap({});
        setInternalDotMap({});
      }
      return;
    }

    // Fetch mainTicketDetails for each unique main_id to get cb_marine_id, wms_marine_id, logistic_marine_id
    const mainIdDetailMap: Record<string, { cb_marine_id: string; wms_marine_id: string; logistic_marine_id: string }> = {};
    const detailUrl = buildApiUrl(MAIN_TICKET_DETAILS);
    await Promise.allSettled(
        Array.from(mainIdSet).map(async (mainId) => {
          try {
            const data = await doFetch(detailUrl, { method: 'POST', body: JSON.stringify({ task_id: mainId }) });
            const result = data?.data ?? data;
            mainIdDetailMap[mainId] = {
              cb_marine_id:       String(result?.cb_marine_id       ?? '').trim(),
              wms_marine_id:      String(result?.wms_marine_id      ?? '').trim(),
              logistic_marine_id: String(result?.logistic_marine_id ?? '').trim(),
            };
          } catch {}
        })
    );

    if (seq !== dotsCancelRef.current) return;

    // Build one entry per unique (main_id, container) pair with extra_task_ids
    type Entry = { mapKey: string; mainId: string; container: string; extraTaskIds: string[] };
    const entries: Entry[] = [];
    const seenKeys = new Set<string>();

    for (const row of list) {
      const mainId = String(row.main_id ?? '').trim();
      if (!mainId) continue;
      const details = mainIdDetailMap[mainId];
      const extraTaskIds = details
          ? [details.cb_marine_id, details.logistic_marine_id, details.wms_marine_id].filter(Boolean)
          : [];
      const containers: string[] = Array.isArray(row.containers) && row.containers.length > 1
          ? row.containers.map((c: any) => String(c.container_number ?? '').trim().toUpperCase())
          : [String(row.container_number ?? '').trim().toUpperCase()];

      for (const container of containers) {
        if (!container) continue;
        const mapKey = `${mainId}_${container}`;
        if (seenKeys.has(mapKey)) continue;
        seenKeys.add(mapKey);
        entries.push({ mapKey, mainId, container, extraTaskIds });
      }
    }

    if (!entries.length) {
      if (seq === dotsCancelRef.current) {
        setClientDotMap({});
        setInternalDotMap({});
      }
      return;
    }

    // One batched notes call per entry — backend queries task_id + extra_task_ids
    const [leaveResults, internalResults] = await Promise.all([
      Promise.allSettled(
          entries.map(({ mainId, container, extraTaskIds }) =>
              retrieveLeaveMessagesApi({ task_id: mainId, container_number: container, awb: null, extra_task_ids: extraTaskIds })
          )
      ),
      Promise.allSettled(
          entries.map(({ mainId, container, extraTaskIds }) =>
              retrieveInternalNotesApi({ task_id: mainId, container_number: container, awb: null, extra_task_ids: extraTaskIds })
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

    const newClientDotMap: Record<string, boolean> = {};
    const newInternalDotMap: Record<string, boolean> = {};

    entries.forEach((entry, i) => {
      const leaveNotes = normalizeNotes(leaveResults[i]);
      const hasUnreadLeave = leaveNotes.some((note: any) => {
        const readBy = typeof note?.read_status_admin === 'string'
            ? note.read_status_admin.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [];
        return !readBy.includes(myName);
      });
      if (hasUnreadLeave) newClientDotMap[entry.mapKey] = true;

      const internalNotes = normalizeNotes(internalResults[i]);
      const hasUnreadInternal = internalNotes.some((note: any) => {
        if (String(note?.sender_name ?? '').trim() === myName) return false;
        const readBy = typeof note?.read_status_internal === 'string'
            ? note.read_status_internal.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [];
        return !readBy.includes(myName);
      });
      if (hasUnreadInternal) newInternalDotMap[entry.mapKey] = true;
    });

    setClientDotMap(newClientDotMap);
    setInternalDotMap(newInternalDotMap);
  }, [currentUserName]);

  const rowContainers = useCallback((row: any): string[] => {
    return Array.isArray(row.containers) && row.containers.length > 1
        ? row.containers.map((c: any) => String(c.container_number ?? '').trim().toUpperCase())
        : [String(row.container_number ?? '').trim().toUpperCase()];
  }, []);

  const hasClientMessageForRow = useCallback((row: any): boolean => {
    const taskId = String(row.main_id ?? '').trim();
    return rowContainers(row).some(cont => !!clientDotMap[`${taskId}_${cont}`]);
  }, [clientDotMap, rowContainers]);

  const hasInternalMessageForRow = useCallback((row: any): boolean => {
    const taskId = String(row.main_id ?? '').trim();
    return rowContainers(row).some(cont => !!internalDotMap[`${taskId}_${cont}`]);
  }, [internalDotMap, rowContainers]);

  useEffect(() => {
    updateNoteDots(rows);
  }, [rows, updateNoteDots]);

  // ── Examine ─────────────────────────────────────────────────────────────────

  const handleExamine = (row: any) => {
    setExamineRow({ ...row });
    setExamineType('1');
    setExamineNote('');
    setExamineOpen(true);
  };

  const calcNextStatus = (curStatus: number): number => {
    const cur = Number(curStatus ?? 0);
    if (cur === 10) return 7;
    if (cur === 4)  return 1;
    if (cur === 3)  return 6;
    if (cur === 2)  return 8; // In Transit -> Pending Complete
    if (cur === 8)  return 3; // Pending Complete -> Delivery Completed
    return cur + 1;
  };

  const submitExamine = async () => {
    if (!examineRow) return;
    if (examineType === '2' && !examineNote.trim()) {
      toast.warning(tt('serviceList.rejectNoteRequired')); return;
    }
    setExamineLoading(true);
    const logisticId = examineRow.logistic_marine_id;
    const conts = (Array.isArray(examineRow.containers) && examineRow.containers.length)
        ? examineRow.containers.map((c: any) => ({
          container_number: String(c.container_number ?? '').trim().toUpperCase(),
          container_status: Number(c.container_status ?? 0),
        }))
        : [{ container_number: String(examineRow.container_number ?? '').trim().toUpperCase(),
          container_status: Number(examineRow.container_status ?? 0) }];

    let payload: any;
    if (examineType === '1') {
      const payloadContainers = conts
          .filter((c: any) => c.container_status !== 6)
          .map((c: any) => ({ container_number: c.container_number, status: calcNextStatus(c.container_status) }));
      if (!payloadContainers.length) {
        toast.info('All containers already completed.');
        setExamineOpen(false); setExamineLoading(false); return;
      }
      payload = { logistic_marine_id: logisticId, containers: payloadContainers };
    } else {
      payload = {
        note: examineNote.trim(),
        logistic_marine_id: logisticId,
        containers: conts.map((c: any) => ({ container_number: c.container_number, status: 4 })),
      };
    }

    try {
      const res = await fetch(buildApiUrl(UPDATE_MARINE_LOGISTIC_TICKET_DETAILS), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      patchRow(logisticId, payload.containers);
      setExamineOpen(false);
      toast.success('Updated successfully.');
      fetchList(page, true);
      fetchStatusCounts();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed.');
    } finally {
      setExamineLoading(false);
    }
  };

  // ── Track — Vue uses row.container_number directly ─────────────────────────

  const handleTrack = async (row: any) => {
    const containerNum = String(row.container_number ?? '').trim();
    setTrackContainer(containerNum);
    setTrackData([]); setTrackOpen(true); setTrackLoading(true);
    try {
      const res = await fetch(buildApiUrl(MARINE_CONTAINER_EVENTS), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: containerNum }),
      });
      const data = await res.json();
      setTrackData(Array.isArray(data?.data) ? data.data : []);
    } catch { setTrackData([]); }
    finally { setTrackLoading(false); }
  };

  // Vue handleInfoClick — navigate with view_id=logistic
  const handleInfoClick = (row: any) => {
    const id = row?.main_id ?? row?.task_id;
    if (!id) return;
    // clear dots for this row's containers when navigating to details
    const taskId = String(row.main_id ?? '').trim();
    const containers = rowContainers(row);
    const clearKeys = (prev: Record<string, boolean>) => {
      const next = { ...prev };
      containers.forEach(cont => delete next[`${taskId}_${cont}`]);
      return next;
    };
    setClientDotMap(clearKeys);
    setInternalDotMap(clearKeys);
    navigate(`/order_run/info/h_info?id=${id}&view_id=logistic&view_no=${row.container_number ?? ''}`);
  };

  // ── Pager ─────────────────────────────────────────────────────────────────

  const buildPageNums = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)              return [1, 2, 3, 4, 5, '...', totalPages];
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title={tt('logistic.title')} pageTitle="Customer Order / Sea" />

          {/* Filters + status tabs stay pinned below the top bar while the table scrolls */}
          <div className="sl-sticky-filters">

          {/* ─── Filter bar ─── */}
          <Card className="mb-3">
            <CardBody>
              <div className="sl-filter-bar">

                <FI>
                  <SelectUser value={userId} onChange={setUserId}
                              placeholder={tt('serviceList.filters.selectClient')} className="sl-w-220" />
                </FI>

                <FI>
                  <CI value={containerNo} onChange={setContainerNo}
                      placeholder={tt('serviceList.filters.containerNo')}
                      onEnter={handleSearch} className="sl-w-200" />
                </FI>

                <FI>
                  <CI value={note} onChange={setNote}
                      placeholder={tt('serviceList.filters.note')}
                      onEnter={handleSearch} className="sl-w-200" />
                </FI>

                <FI>
                  <DR label={tt('serviceList.filters.portEta')}
                      start={portEtaStart} end={portEtaEnd}
                      onStart={setPortEtaStart} onEnd={setPortEtaEnd} tt={tt} />
                </FI>

                <FI>
                  <CS value={rail} onChange={setRail}
                      placeholder={tt('serviceList.filters.rail')} className="sl-w-200">
                    {['CN', 'CP', 'NA', 'ERROR'].map(v => <option key={v} value={v}>{v}</option>)}
                  </CS>
                </FI>

                <FI>
                  <SelectDestination value={destination} onChange={setDestination}
                                     placeholder={tt('serviceList.filters.destination')} className="sl-w-200" />
                </FI>

                <FI>
                  <CS value={sortField} onChange={setSortField}
                      placeholder={tt('serviceList.filters.sortBy')} className="sl-w-200">
                    <option value="portETA">Port ETA</option>
                    <option value="trainETA">Train ETA</option>
                  </CS>
                </FI>

                <FI>
                  <DR label={tt('logistic.filters.pickupDate')}
                      start={pickupStart} end={pickupEnd}
                      onStart={setPickupStart} onEnd={setPickupEnd} tt={tt} />
                </FI>

                <FI>
                  <DR label={tt('logistic.filters.completeTime')}
                      start={completeStart} end={completeEnd}
                      onStart={setCompleteStart} onEnd={setCompleteEnd} tt={tt} />
                </FI>

                <FI>
                  <CI value={mbl} onChange={setMbl} placeholder="MBL"
                      onEnter={handleSearch} className="sl-w-200" />
                </FI>

                <FI>
                  <CI value={hbl} onChange={setHbl} placeholder="HBL"
                      onEnter={handleSearch} className="sl-w-200" />
                </FI>

                <FI>
                  <CS value={isPickupContainer} onChange={setIsPickupContainer}
                      placeholder={tt('logistic.filters.needPickup')} className="sl-w-200">
                    <option value="1">{tt('common.yes')}</option>
                    <option value="0">{tt('common.no')}</option>
                  </CS>
                </FI>

                <FI>
                  <CS value={pkNumEmpty} onChange={setPkNumEmpty}
                      placeholder={tt('logistic.filters.hasPickupNo')} className="sl-w-200">
                    <option value="0">{tt('logistic.filters.hasPkNum')}</option>
                    <option value="1">{tt('logistic.filters.noPkNum')}</option>
                  </CS>
                </FI>

                <FI>
                  <CS value={ersStatus} onChange={setErsStatus}
                      placeholder="ERS" className="sl-w-200">
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </CS>
                </FI>

                <FI>
                  <CS value={goWarehouse} onChange={setGoWarehouse}
                      placeholder={tt('logistic.filters.goWarehouse')} className="sl-w-200">
                    <option value="0">{tt('logistic.goWarehouse.dhWarehouse')}</option>
                    <option value="1">{tt('logistic.goWarehouse.thirdParty')}</option>
                    <option value="2">{tt('logistic.goWarehouse.do')}</option>
                  </CS>
                </FI>

                <FI>
                  <Button color={sortByNotify ? 'primary' : 'secondary'} outline={!sortByNotify}
                          onClick={() => setSortByNotify(v => !v)}>
                    {tt('serviceList.filters.notifications')} {sortByNotify ? 'ON' : 'OFF'}
                  </Button>
                </FI>

                <FI>
                  <Button color="primary" onClick={handleSearch} disabled={loading}>
                    {loading && <Spinner size="sm" className="me-1" />}
                    {tt('serviceList.filters.refresh')}
                  </Button>
                </FI>

              </div>
            </CardBody>
          </Card>

          {error && <Alert color="danger">{error}</Alert>}

          {/* ─── Status tabs ─── */}
          <div className="orderlist-status-tabs mb-3">
            {STATUS_TABS.map(tab => {
              const count = tab.value === '5' ? statusCounts['all'] : statusCounts[tab.value];
              return (
                  <div key={tab.value} className="btn-badge-wrap">
                    <button type="button"
                            className={`orderlist-status-tab${statusFilter === tab.value ? ' active' : ''}`}
                            onClick={() => handleStatusTab(tab.value)}>
                      {tab.label}
                    </button>
                    {Number(count) > 0 && (
                        <span className="sl-tab-badge">{Number(count) > 999 ? '999+' : Number(count)}</span>
                    )}
                  </div>
              );
            })}
          </div>

          </div>{/* /.sl-sticky-filters */}

          {/* ─── Table — column order mirrors Vue el-table ─── */}
          <Card className="sl-table-card">
            <CardBody className="p-0">
              <div className="sl-table-scroll" ref={tableScrollRef}>
                <table className="mb-0 sl-table sl-log-table">
                  <thead>
                  <tr>
                    <th className="sl-col-sticky-left  sl-log-col-username">{tt('serviceList.table.client')}</th>
                    <th className="sl-col-sticky-left2 sl-log-col-note">Note</th>
                    <th className="sl-col-sticky-left3 sl-log-col-container">{tt('orderList.columns.containerNumber')}</th>
                    <th className="sl-col-sticky-left4 sl-log-col-destination">{tt('orderList.columns.destination')}</th>
                    <th className="sl-mw-170">{tt('logistic.columns.needPickup')}</th>
                    <th className="sl-mw-170">{tt('logistic.columns.goWarehouse')}</th>
                    <th className="sl-mw-200">{tt('orderList.columns.shipline')}</th>
                    <th className="sl-mw-200">{tt('orderList.columns.portEta')}</th>
                    <th className="sl-mw-110">RAIL</th>
                    <th className="sl-mw-200">{tt('orderList.columns.trainEta')}</th>
                    <th className="sl-mw-160">Last Free Day</th>
                    <th className="sl-mw-200">{tt('logistic.columns.pickupNo')}</th>
                    <th className="sl-mw-200">{tt('logistic.columns.pickupDate')}</th>
                    <th className="sl-mw-200">{tt('logistic.columns.returnDate')}</th>
                    <th className="sl-mw-180">MBL</th>
                    <th className="sl-mw-240">HBL</th>
                    <th className="sl-mw-200">{tt('logistic.columns.telex')}</th>
                    <th className="sl-mw-100">FCL</th>
                    <th className="sl-mw-100">ERS</th>
                    <th className="sl-mw-200">{tt('logistic.columns.containerStatus')}</th>
                    <th className="sl-mw-190">{tt('logistic.columns.createTime')}</th>
                    <th className="sl-mw-150">{tt('serviceList.columns.creator')}</th>
                    <th className="sl-mw-140">{tt('logistic.columns.completeTime')}</th>
                    <th className="sl-col-sticky-right sl-th-actions-wide">{tt('serviceList.table.action')}</th>
                  </tr>
                  </thead>
                  <tbody>
                  {loading && (
                      <tr><td colSpan={24} className="text-center py-5"><Spinner color="primary" /></td></tr>
                  )}
                  {!loading && displayRows.length === 0 && (
                      <tr><td colSpan={24} className="text-center text-muted py-5">{tt('serviceList.table.noRecords')}</td></tr>
                  )}
                  {!loading && displayRows.map((row, i) => {
                    const rowLogisticId = String(row.logistic_marine_id ?? i);
                    const rowKey = row.container_number ? `${rowLogisticId}_${row.container_number}` : rowLogisticId;
                    const isHighlighted = updatedRowId === rowLogisticId;
                    const isGrouped = Array.isArray(row.containers) && row.containers.length > 1;
                    const showClientMsg  = hasClientMessageForRow(row);
                    const showInternalMsg = hasInternalMessageForRow(row);
                    const showUnread = showClientMsg || showInternalMsg;

                    return (
                        <tr key={rowKey} className={isHighlighted ? 'sl-row-updated' : undefined}>

                          {/* user_name — Vue fixed="left" col 1 */}
                          <td className="sl-col-sticky-left sl-log-col-username">
                            {row.user_name || '-'}
                          </td>

                          {/* container_note — truncated, full text on hover */}
                          <td className="sl-col-sticky-left2 sl-log-col-note">
                            {isGrouped
                                ? <div className="sl-multi-cont">
                                  {row.containers.map((c: any, ci: number) => (
                                      <div key={ci}>
                                        <OverflowTooltip text={c.container_note || ''}>
                                          {c.container_note || '-'}
                                        </OverflowTooltip>
                                      </div>
                                  ))}
                                </div>
                                : <OverflowTooltip text={row.container_note || ''}>
                                  {row.container_note || '-'}
                                </OverflowTooltip>
                            }
                          </td>

                          {/* container_number — Vue fixed="left" col 3 */}
                          <td className="sl-col-sticky-left3 sl-log-col-container">
                            {showClientMsg && (
                                <div className="orderlist-newmsg-wrap">
                                  <span className="orderlist-newmsg-tag">{tt('chat.newClientMessage')}</span>
                                </div>
                            )}
                            {showInternalMsg && (
                                <div className="orderlist-newmsg-wrap">
                                  <span className="orderlist-internalmsg-tag">{tt('chat.internalMessage')}</span>
                                </div>
                            )}
                            {isGrouped
                                ? <div className="sl-multi-cont">
                                  {row.containers.map((c: any, ci: number) => (
                                      <div key={ci}>{c.container_number || '-'}</div>
                                  ))}
                                </div>
                                : (row.container_number || '-')
                            }
                          </td>

                          {/* destination — Vue fixed="left" col 4 */}
                          <td className="sl-col-sticky-left4 sl-log-col-destination">
                            {row.destination || '-'}
                          </td>

                          <td>{ynLabel(row.is_pickup_container, tt)}</td>
                          <td>{goWarehouseLabel(row.go_warehouse, tt)}</td>
                          <td><MC row={row} field="shipline" /></td>
                          <td><MC row={row} field="portETA" fmt={fmtDate} /></td>
                          <td>{row.rail || '-'}</td>
                          <td><MC row={row} field="trainETA" fmt={fmtDate} /></td>
                          <td><MC row={row} field="last_free_day" fmt={fmtDate} /></td>
                          <td><MC row={row} field="pk_num" /></td>
                          <td><MC row={row} field="pickup_container_date" fmt={fmtDate} /></td>
                          <td><MC row={row} field="return_container_date" fmt={fmtDate} /></td>
                          <td>{row.mbl || '-'}</td>
                          <td>{Array.isArray(row.hbl_list) && row.hbl_list.length
                              ? <div className="d-flex flex-wrap gap-1">{row.hbl_list.map((h: string, hi: number) => <span key={hi} className="badge bg-info-subtle text-info">{h}</span>)}</div>
                              : (row.hbl || '-')}
                          </td>
                          <td><MC row={row} field="tele" fmt={(v: unknown) => ynLabel(v, tt)} /></td>
                          <td>{row.fcl == 1 ? 'Yes' : 'No'}</td>
                          <td>{row.ers_status == 1 ? 'Yes' : 'No'}</td>
                          <td>{isGrouped
                              ? <div className="sl-multi-cont">{row.containers.map((c: any, ci: number) => (
                                  <div key={ci}><span className={containerStatusClass(c.container_status)}>{containerStatusLabel(c.container_status, tt)}</span></div>
                              ))}</div>
                              : <span className={containerStatusClass(row.container_status)}>{containerStatusLabel(row.container_status, tt)}</span>}
                          </td>
                          <td>{row.logistic_marine_create_time || '-'}</td>
                          <td>{row.creator_name || '-'}</td>
                          <td><MC row={row} field="complete_time" fmt={fmtDate} /></td>

                          {/* actions — Vue: Confirm (if status!=6), Track, Info */}
                          <td className="sl-col-sticky-right">
                            <div className="d-flex gap-1 flex-wrap">
                              {row.container_status != 6 && (
                                  <Button size="sm" color="primary" outline className="sl-confirm-btn" onClick={() => handleExamine(row)}>
                                    {tt('common.confirm')}
                                  </Button>
                              )}
                              <Button size="sm" color="info" outline onClick={() => handleTrack(row)}>
                                {tt('orderList.table.viewTrack')}
                              </Button>
                              <span className="btn-badge-wrap">
                              <Button size="sm" color="primary" outline onClick={() => handleInfoClick(row)}>
                                {tt('orderList.table.detailStatus')}
                              </Button>
                                {showUnread && <span className="btn-unread-dot" />}
                            </span>
                            </div>
                          </td>

                        </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Fixed copy of the header row, shown once the real one scrolls under the filter bar */}
          <StickyTableHeader scrollRef={tableScrollRef} />

          {/* ─── Pagination ─── */}
          <div className="sl-pagination">
          <span className="sl-pg-total">
            {tt('serviceList.pagination.total')} {total} {tt('serviceList.pagination.items')}
          </span>
            <Input type="select" bsSize="sm" className="sl-page-size-select"
                   value={pageSize} onChange={e => handlePageSizeChange(Number(e.target.value))}>
              {[10, 15, 20, 30, 50, 500].map(n => (
                  <option key={n} value={n}>{n} {tt('serviceList.pagination.perPage')}</option>
              ))}
            </Input>
            <button className="sl-pg-btn" disabled={page <= 1} onClick={() => changePage(page - 1)}>‹</button>
            {buildPageNums().map((p, idx) =>
                p === '...'
                    ? <span key={`e${idx}`} className="sl-pg-ellipsis">…</span>
                    : <button key={p}
                              className={`sl-pg-btn${page === p ? ' active' : ''}`}
                              onClick={() => changePage(p as number)}>{p}</button>
            )}
            <button className="sl-pg-btn" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>›</button>
            <span className="sl-pg-jumper">
            {tt('serviceList.pagination.goto')}
              <input type="number" className="sl-jump-input" min={1} max={totalPages}
                     value={jumpInput}
                     onChange={e => setJumpInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleJump()} />
              {tt('serviceList.pagination.page')}
          </span>
          </div>

          {/* ─── Page actions ─── */}
          <div className="sl-page-actions">
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={uploadRef} onChange={handleUploadChange} />
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={trainEtaRef} onChange={handleTrainEtaChange} />
            <Button color="primary" onClick={exportToExcel}>{tt('serviceList.actions.exportExcel')}</Button>
            <Button color="primary" disabled={uploading} onClick={() => uploadRef.current?.click()}>
              {uploading ? tt('serviceList.actions.uploading') : tt('serviceList.actions.uploadExcel')}
            </Button>
            <Button color="primary" disabled={trainEtaUploading} onClick={() => trainEtaRef.current?.click()}>
              {trainEtaUploading ? tt('serviceList.actions.uploading') : tt('serviceList.actions.updateTrainEta')}
            </Button>
          </div>

          {/* ─── Examine dialog ─── */}
          <Modal isOpen={examineOpen} toggle={() => setExamineOpen(false)} centered>
            <ModalHeader toggle={() => setExamineOpen(false)}>{tt('common.confirm')}</ModalHeader>
            <ModalBody>
              <div className="d-flex gap-4">
                <FormGroup check className="mb-0">
                  <Input id="logApprove" type="radio" name="logExType"
                         checked={examineType === '1'} onChange={() => setExamineType('1')} />
                  <Label check htmlFor="logApprove">{tt('common.approve')}</Label>
                </FormGroup>
                <FormGroup check className="mb-0">
                  <Input id="logReject" type="radio" name="logExType"
                         checked={examineType === '2'} onChange={() => setExamineType('2')} />
                  <Label check htmlFor="logReject">{tt('common.reject')}</Label>
                </FormGroup>
              </div>
              {examineType === '2' && (
                  <div className="mt-3">
                    <Input type="textarea" rows={3} value={examineNote}
                           onChange={e => setExamineNote(e.target.value)}
                           placeholder="Enter reject reason..." />
                  </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="secondary" onClick={() => setExamineOpen(false)}>
                {tt('changeService.actions.close')}
              </Button>
              <Button color="primary" onClick={submitExamine} disabled={examineLoading}>
                {examineLoading && <Spinner size="sm" className="me-1" />}
                {tt('common.confirm')}
              </Button>
            </ModalFooter>
          </Modal>

          {/* ─── Track modal ─── */}
          <Modal isOpen={trackOpen} toggle={() => setTrackOpen(false)} size="lg" centered>
            <ModalHeader toggle={() => setTrackOpen(false)}>
              {tt('tracking.title')} — {trackContainer}
            </ModalHeader>
            <ModalBody className="sl-track-modal-body">
              {trackLoading
                  ? <div className="text-center py-5"><Spinner /></div>
                  : trackData.length === 0
                      ? <div className="text-center text-muted py-5">No Data</div>
                      : <div>
                        {trackData.map((item, idx) => (
                            <div key={idx} className="d-flex gap-3 pb-3 mb-3 border-bottom">
                              <div className="text-muted small text-nowrap sl-track-time">{item.event_time || '-'}</div>
                              <div>
                                <div className="fw-semibold small">{item.location || '-'}</div>
                                <div className="small text-muted">{item.description || ''}</div>
                              </div>
                            </div>
                        ))}
                      </div>
              }
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onClick={() => setTrackOpen(false)}>
                {tt('changeService.actions.close')}
              </Button>
            </ModalFooter>
          </Modal>

        </Container>
      </div>
  );
};

export default SeaLogistic;