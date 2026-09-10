import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import Select from 'react-select';
import { toast } from 'react-toastify';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { buildApiUrl } from '../../helpers/apiBase';
import {
  RETRIEVE_IT_SUPPORT_TICKET_COMMENTS,
  RETRIEVE_IT_SUPPORT_TICKETS,
  SUBMIT_IT_SUPPORT_TICKET_COMMENT,
  UPDATE_IT_SUPPORT_TICKET,
} from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { getRestriction, getUserIdFromSession } from '../../helpers/userInformation';
import { buildPageList } from '../OrderLists/helper';
import { ExistingFileList, FilePicker, imageFilesFromClipboard, mergeAttachments } from './FilePicker';
import {
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
  getTypeLabel,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TicketComment,
  TicketFile,
} from './ticketMeta';
import { useUserOptions } from './useUserOptions';

const userOptionLabel = (u: { account_name: string; department?: string }): string =>
  u.department ? `${u.account_name} (${u.department})` : u.account_name;

const PAGE_SIZE = 15;

// status filter sentinel: 'active' = every status except Closed and On Hold
// (the default), '' = All, otherwise a specific numeric status as a string.
const STATUS_ACTIVE = 'active';

type FetchFilters = {
  search: string;
  assignedId: string;
  requesterId: string;
  status: string;
  priority: string; // '' = All
  onlyMine: boolean;
};

const DEFAULT_FILTERS: FetchFilters = {
  search: '',
  assignedId: '',
  requesterId: '',
  status: STATUS_ACTIVE,
  priority: '',
  onlyMine: true,
};

type Assignee = {
  user_id: number | string;
  user_name: string;
  email: string;
};

type Ticket = {
  ticket_id: number;
  ticket_number: string;
  user_id: number | string;
  user_name: string;
  requester_email: string;
  assigned_id: number | string | null;
  assigned_to: string | null;
  assigned_ids?: (number | string)[];
  assignees?: Assignee[];
  assigned_response: string | null;
  status: number;
  type: number;
  priority: number;
  subject: string;
  note: string;
  create_time: string;
  note_files?: TicketFile[];
  assigned_response_files?: TicketFile[];
};

// Ticket status values (see ticketMeta.ts). Assignees can only be changed while
// the ticket is still open/in-progress/resolved (not Closed).
const TICKET_STATUS_RESOLVED = 2;
const TICKET_STATUS_CLOSED = 3;
const TICKET_STATUS_ON_HOLD = 4;

// The default "Active" view hides finished/parked tickets — only Open + In Progress remain.
const STATUS_ACTIVE_EXCLUDES = [TICKET_STATUS_RESOLVED, TICKET_STATUS_CLOSED, TICKET_STATUS_ON_HOLD];

const assigneeNamesOf = (r: Pick<Ticket, 'assignees' | 'assigned_to'>, unassignedLabel: string): string =>
  r.assignees?.length ? r.assignees.map((a) => a.user_name).join(', ') : r.assigned_to || unassignedLabel;

type ColumnDef = {
  key: string;
  label: string;
  width: number;
  render: (r: Ticket) => React.ReactNode;
  getTitle?: (r: Ticket) => string;
};

// Copyable overflow tooltip — mirrors the same helper in SeaLogistic.tsx / _ServiceListPage.tsx
const OverflowTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const hideTimer = useRef<number>(0);

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

  const cancelHide = () => clearHideTimer();

  useEffect(() => () => clearHideTimer(), []);

  if (!text) return <>{children}</>;

  return (
    <>
      <span className="sl-ot-trigger" onMouseEnter={show} onMouseLeave={scheduleHide}>
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

const TicketList: React.FC = () => {
  const { tt } = useTT();
  const navigate = useNavigate();
  const { ticketNumber: ticketNumberParam } = useParams<{ ticketNumber?: string }>();
  const isAdmin = getRestriction() === 1;
  const myUserId = getUserIdFromSession();
  const { users } = useUserOptions();
  // Only staff with a department are ever assignable, so the Assign To filter should only offer them.
  const assignableUsers = users.filter((u) => !!u.department);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterAssignedId, setFilterAssignedId] = useState('');
  const [filterRequesterId, setFilterRequesterId] = useState('');
  // status: 'active' (default) = exclude Closed & On Hold, '' = All, else a numeric value.
  // priority: '' = All, else a numeric value.
  const [filterStatus, setFilterStatus] = useState(DEFAULT_FILTERS.status);
  const [filterPriority, setFilterPriority] = useState('');
  // Default view: only tickets the logged-in account is involved in — assigned to them
  // (any assignee slot) or created by them. Unchecking shows every ticket.
  const [onlyMine, setOnlyMine] = useState(true);
  const [rows, setRows] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchList = useCallback(
    async (pg: number, f: FetchFilters) => {
      setLoading(true);
      setError('');
      try {
        const body: Record<string, any> = {
          page: pg,
          pageSize: PAGE_SIZE,
          search: f.search.trim() || undefined,
          assigned_id: f.assignedId || undefined,
        };
        // Everyone can see every ticket now, not just admins — user_id is only applied when
        // someone actively picks a Requester filter (regardless of their own admin status).
        if (f.requesterId) {
          body.user_id = f.requesterId;
        }
        if (f.status === STATUS_ACTIVE) {
          // Default: only Open + In Progress (hide Resolved, Closed, On Hold).
          body.exclude_status = STATUS_ACTIVE_EXCLUDES;
        } else if (f.status !== '') {
          body.status = Number(f.status);
        }
        if (f.priority !== '') {
          body.priority = Number(f.priority);
        }
        // Default "involving me" filter — assigned to OR created by the logged-in account.
        if (f.onlyMine && myUserId != null && String(myUserId) !== '') {
          body.mine_user_id = myUserId;
        }

        const res = await fetch(buildApiUrl(RETRIEVE_IT_SUPPORT_TICKETS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setRows(Array.isArray(data?.data) ? data.data : []);
        setTotal(Number(data?.total || 0));
      } catch (e: any) {
        setError(e?.message || tt('supportTickets.list.loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [myUserId, tt]
  );

  useEffect(() => {
    fetchList(1, DEFAULT_FILTERS);
  }, [fetchList]);

  // Merge the current filter state with per-call overrides (state setters are async,
  // so a handler must pass its own new value here rather than rely on the stale state).
  const runFetch = (pg: number, overrides: Partial<FetchFilters> = {}) => {
    fetchList(pg, {
      search,
      assignedId: filterAssignedId,
      requesterId: filterRequesterId,
      status: filterStatus,
      priority: filterPriority,
      onlyMine,
      ...overrides,
    });
  };

  const handleSearch = () => {
    setPage(1);
    runFetch(1);
  };
  const handleReset = () => {
    setSearch('');
    setFilterAssignedId('');
    setFilterRequesterId('');
    setFilterStatus(DEFAULT_FILTERS.status);
    setFilterPriority('');
    setOnlyMine(true);
    setPage(1);
    fetchList(1, DEFAULT_FILTERS);
  };
  const handleAssignedFilterChange = (v: string) => {
    setFilterAssignedId(v);
    setPage(1);
    runFetch(1, { assignedId: v });
  };
  const handleRequesterFilterChange = (v: string) => {
    setFilterRequesterId(v);
    setPage(1);
    runFetch(1, { requesterId: v });
  };
  const handleStatusFilterChange = (v: string) => {
    setFilterStatus(v);
    setPage(1);
    runFetch(1, { status: v });
  };
  const handlePriorityFilterChange = (v: string) => {
    setFilterPriority(v);
    setPage(1);
    runFetch(1, { priority: v });
  };
  const handleOnlyMineChange = (checked: boolean) => {
    setOnlyMine(checked);
    setPage(1);
    runFetch(1, { onlyMine: checked });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const changePage = (p: number) => {
    setPage(p);
    runFetch(p);
  };
  const pageItems = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  const updateTicket = async (
    ticket: Ticket,
    patch: Record<string, any>,
    files?: { note_files?: File[]; assigned_response_files?: File[] }
  ): Promise<boolean> => {
    setSavingId(ticket.ticket_id);
    try {
      const formData = new FormData();
      formData.append('ticket_id', String(ticket.ticket_id));
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined) return;
        if (Array.isArray(value)) {
          // multer/append-field turns repeated same-name fields into an array on
          // the backend; an explicit '' marks "assign to nobody" (still present
          // on req.body, vs. omitting the field entirely which means "unchanged").
          if (value.length === 0) formData.append(key, '');
          else value.forEach((v) => formData.append(key, String(v)));
          return;
        }
        formData.append(key, value === null ? '' : String(value));
      });
      (files?.note_files || []).forEach((f) => formData.append('note_files', f));
      (files?.assigned_response_files || []).forEach((f) => formData.append('assigned_response_files', f));

      const res = await fetch(buildApiUrl(UPDATE_IT_SUPPORT_TICKET), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      if (data?.data) {
        setRows((prev) => prev.map((r) => (r.ticket_id === ticket.ticket_id ? { ...r, ...data.data } : r)));
      }
      return true;
    } catch (e: any) {
      setEditError(e?.message || tt('supportTickets.submit.failed'));
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { timeZone: 'America/Toronto' });
  };

  const isRequester = (r: Ticket) => String(r.user_id) === String(myUserId ?? '');
  const isAssignee = (r: Ticket) => {
    const me = String(myUserId ?? '');
    if (!me) return false;
    // Check every assignee slot, not just the legacy primary `assigned_id`.
    if (r.assigned_ids?.length) return r.assigned_ids.map(String).includes(me);
    return r.assigned_id != null && String(r.assigned_id) === me;
  };
  const canEditCore = (r: Ticket) => isAdmin || isRequester(r);
  const canEditResponse = (r: Ticket) => isAdmin || isAssignee(r);
  const canEditTicket = (r: Ticket) => canEditCore(r) || canEditResponse(r);
  // Status can be moved by an admin, any assignee, or the requester themselves.
  const canEditStatusOf = (r: Ticket) => isAdmin || isAssignee(r) || isRequester(r);

  // ── Edit modal
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [editPriority, setEditPriority] = useState(0);
  const [editStatus, setEditStatus] = useState(0);
  const [editAssignedIds, setEditAssignedIds] = useState<string[]>([]);
  const [editError, setEditError] = useState('');

  const editCanComment = editTicket ? canEditTicket(editTicket) : false;
  const editCanEditStatus = editTicket ? canEditStatusOf(editTicket) : false;
  const editAuthorType: 'requester' | 'support' = editTicket && isRequester(editTicket) ? 'requester' : 'support';
  // Assignees can be changed by an admin as long as the ticket (as currently persisted,
  // not whatever status is pending in the dropdown) isn't closed yet.
  const canEditAssignees = isAdmin && !!editTicket && editTicket.status !== TICKET_STATUS_CLOSED;

  const originalAssignedIds = editTicket
    ? (editTicket.assigned_ids?.length
        ? editTicket.assigned_ids
        : editTicket.assigned_id != null
        ? [editTicket.assigned_id]
        : []
      )
        .map(String)
        .sort()
    : [];
  const assignedIdsChanged =
    JSON.stringify(editAssignedIds.slice().sort()) !== JSON.stringify(originalAssignedIds);

  // Priority/Status/Assignees are the only top-section fields still changeable after creation — only
  // show Save once one the current user is allowed to change actually differs from the loaded ticket.
  const topSectionDirty =
    !!editTicket &&
    ((isAdmin && editPriority !== editTicket.priority) ||
      (editCanEditStatus && editStatus !== editTicket.status) ||
      (canEditAssignees && assignedIdsChanged));

  // ── Reply thread (comments)
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyInternal, setReplyInternal] = useState(false);
  const [replySending, setReplySending] = useState(false);

  const fetchComments = useCallback(
    async (ticketId: number) => {
      setCommentsLoading(true);
      setCommentsError('');
      try {
        const res = await fetch(buildApiUrl(RETRIEVE_IT_SUPPORT_TICKET_COMMENTS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: ticketId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setComments(Array.isArray(data?.data) ? data.data : []);
      } catch (e: any) {
        setCommentsError(e?.message || tt('supportTickets.replies.loadFailed'));
      } finally {
        setCommentsLoading(false);
      }
    },
    [tt]
  );

  // updateUrl is false when the modal is being opened *from* a /support/tickets/:ticketNumber
  // deep link — the URL is already correct in that case, no need to push a new entry.
  const openEdit = (r: Ticket, updateUrl: boolean = true) => {
    setEditTicket(r);
    setEditPriority(r.priority);
    setEditStatus(r.status);
    setEditAssignedIds(
      (r.assigned_ids?.length ? r.assigned_ids : r.assigned_id != null ? [r.assigned_id] : []).map(String)
    );
    setEditError('');
    setComments([]);
    setCommentsError('');
    setReplyMessage('');
    setReplyFiles([]);
    setReplyInternal(false);
    fetchComments(r.ticket_id);
    if (updateUrl) navigate(`/support/tickets/${r.ticket_number}`);
  };

  const closeEdit = () => {
    setEditTicket(null);
    navigate('/support/tickets');
  };

  // Deep link: /support/tickets/:ticketNumber fetches and opens that ticket directly,
  // regardless of the current list page/filters, so a shared link jumps straight to it.
  const fetchTicketByNumber = useCallback(
    async (num: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(buildApiUrl(RETRIEVE_IT_SUPPORT_TICKETS), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_number: num, page: 1, pageSize: 5 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        const list: Ticket[] = Array.isArray(data?.data) ? data.data : [];
        const match = list.find((t) => String(t.ticket_number) === String(num)) || null;
        if (!match) {
          setError(tt('supportTickets.list.ticketNotFound'));
          navigate('/support/tickets', { replace: true });
          return;
        }
        openEdit(match, false);
      } catch (e: any) {
        setError(e?.message || tt('supportTickets.list.loadFailed'));
        navigate('/support/tickets', { replace: true });
      } finally {
        setLoading(false);
      }
    },
    [tt, navigate] // eslint-disable-line
  );

  useEffect(() => {
    if (!ticketNumberParam) return;
    if (editTicket && String(editTicket.ticket_number) === String(ticketNumberParam)) return;
    fetchTicketByNumber(ticketNumberParam);
  }, [ticketNumberParam]); // eslint-disable-line

  const handleCopyLink = () => {
    const url = window.location.href;
    const fallbackCopy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast.success(tt('supportTickets.edit.linkCopied'));
      } catch {
        /* clipboard unsupported — the link is still visible in the address bar */
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => toast.success(tt('supportTickets.edit.linkCopied')), fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  // Posts whatever is currently in the reply box. Returns false (and leaves the draft intact) on failure,
  // so callers — the Send button and Save's flush-pending-reply step — can both safely rely on it.
  const submitReply = async (): Promise<boolean> => {
    if (!editTicket) return true;
    const trimmed = replyMessage.trim();
    if (!trimmed && replyFiles.length === 0) return true;
    setReplySending(true);
    setCommentsError('');
    try {
      const formData = new FormData();
      formData.append('ticket_id', String(editTicket.ticket_id));
      formData.append('author_id', String(myUserId));
      formData.append('author_type', editAuthorType);
      formData.append('message', trimmed);
      formData.append('is_internal', editAuthorType === 'support' && replyInternal ? '1' : '0');
      replyFiles.forEach((f) => formData.append('comment_files', f));

      const res = await fetch(buildApiUrl(SUBMIT_IT_SUPPORT_TICKET_COMMENT), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data?.data) {
        setComments((prev) => [...prev, data.data]);
      }
      setReplyMessage('');
      setReplyFiles([]);
      setReplyInternal(false);
      return true;
    } catch (e: any) {
      setCommentsError(e?.message || tt('supportTickets.submit.failed'));
      return false;
    } finally {
      setReplySending(false);
    }
  };

  // Subject/Type/Assign To/Description are locked once a ticket is created — only priority, status,
  // and replies can change after that. Save also flushes any unsent reply draft, so clicking Save
  // instead of Send never silently loses text the user typed into the Activity / Replies box.
  const submitEdit = async () => {
    if (!editTicket) return;
    const patch: Record<string, any> = {};
    if (isAdmin) {
      patch.priority = editPriority;
      if (canEditAssignees) {
        patch.assigned_ids = editAssignedIds.map((id) => Number(id));
      }
    }
    // Status: admin, any assignee, or the requester.
    if (editCanEditStatus) {
      patch.status = editStatus;
    }

    let ok = true;
    if (Object.keys(patch).length > 0) {
      ok = await updateTicket(editTicket, patch);
    }
    if (ok) {
      ok = await submitReply();
    }
    if (ok) closeEdit();
  };

  const columns: ColumnDef[] = [
    {
      key: 'ticketNumber',
      label: tt('supportTickets.list.columns.ticketNumber'),
      width: 140,
      render: (r) =>
        canEditTicket(r) ? (
          <Button color="link" className="p-0" onClick={() => openEdit(r)}>
            {r.ticket_number}
          </Button>
        ) : (
          r.ticket_number
        ),
    },
    {
      key: 'subject',
      label: tt('supportTickets.list.columns.subject'),
      width: 260,
      render: (r) => (
        <>
          <div className="fw-semibold sl-cell-truncate">{r.subject}</div>
          <div className="text-muted small sl-cell-truncate">{r.note}</div>
          {!!r.note_files?.length && (
            <div className="text-muted small">
              <i className="ri-attachment-2 align-middle" /> {r.note_files.length}
            </div>
          )}
        </>
      ),
      getTitle: (r) => (r.note ? `${r.subject}\n\n${r.note}` : r.subject),
    },
    {
      key: 'requester',
      label: tt('supportTickets.list.columns.requester'),
      width: 160,
      render: (r) => (
        <>
          <div className="sl-cell-truncate">{r.user_name}</div>
          <div className="text-muted small sl-cell-truncate">{r.requester_email}</div>
        </>
      ),
      getTitle: (r) => (r.requester_email ? `${r.user_name}\n${r.requester_email}` : r.user_name),
    },
    {
      key: 'type',
      label: tt('supportTickets.list.columns.type'),
      width: 140,
      render: (r) => getTypeLabel(r.type, tt),
    },
    {
      key: 'priority',
      label: tt('supportTickets.list.columns.priority'),
      width: 140,
      render: (r) => <Badge color={getPriorityColor(r.priority)}>{getPriorityLabel(r.priority, tt)}</Badge>,
    },
    {
      key: 'status',
      label: tt('supportTickets.list.columns.status'),
      width: 140,
      render: (r) => <Badge color={getStatusColor(r.status)}>{getStatusLabel(r.status, tt)}</Badge>,
    },
    {
      key: 'assignedTo',
      label: tt('supportTickets.list.columns.assignedTo'),
      width: 160,
      render: (r) => assigneeNamesOf(r, tt('supportTickets.fields.unassigned')),
    },
    {
      key: 'created',
      label: tt('supportTickets.list.columns.created'),
      width: 160,
      render: (r) => fmtDate(r.create_time),
    },
    {
      key: 'actions',
      label: tt('supportTickets.list.columns.actions'),
      width: 100,
      render: (r) =>
        canEditTicket(r) ? (
          <Button size="sm" color="secondary" outline onClick={() => openEdit(r)}>
            <i className="ri-edit-line align-bottom me-1" />
            {tt('common.edit')}
          </Button>
        ) : null,
    },
  ];

  // ── Column resize (Pointer Events + setPointerCapture), same pattern as _ServiceListPage.tsx
  // Every role now sees the same columns, so a single width key is fine.
  const colWidthsKey = 'supportTicketsColWidths:v2';
  const colDefaults = columns.map((c) => c.width);
  const [colWidths, setColWidths] = useState<number[]>(() => {
    try {
      const raw = sessionStorage.getItem(colWidthsKey);
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved) && saved.length === colDefaults.length) return saved;
    } catch {
      /* ignore */
    }
    return colDefaults;
  });
  const thRefs = useRef<Array<HTMLTableCellElement | null>>(columns.map(() => null));
  const resizingRef = useRef<{ idx: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(colWidthsKey, JSON.stringify(colWidths));
    } catch {
      /* storage full or unavailable — not critical */
    }
  }, [colWidths, colWidthsKey]);

  const handleResizerPD = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizingRef.current = { idx, startX: e.clientX, startW: colWidths[idx] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths]); // eslint-disable-line

  const handleResizerPM = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (!resizingRef.current || resizingRef.current.idx !== idx) return;
    const { startX, startW: sw } = resizingRef.current;
    const newW = Math.max(60, sw + (e.clientX - startX));
    const th = thRefs.current[idx];
    if (th) th.style.width = newW + 'px';
  }, []); // eslint-disable-line

  const handleResizerPU = useCallback((e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (!resizingRef.current || resizingRef.current.idx !== idx) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const th = thRefs.current[idx];
    const finalW = th ? parseFloat(th.style.width) || colWidths[idx] : colWidths[idx];
    resizingRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setColWidths((prev) => prev.map((w, i) => (i === idx ? finalW : w)));
  }, [colWidths]); // eslint-disable-line

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('supportTickets.list.title')} pageTitle={tt('menu.itSupport')} />

        <Card>
          <CardBody>
            {/* All filters on one line */}
            <Row className="g-2 align-items-end mb-2">
              <Col xs={12} sm={6} md>
                <Label className="mb-1 fw-semibold small">{tt('supportTickets.list.searchLabel')}</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tt('supportTickets.list.searchPlaceholder')}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </Col>
              <Col xs={12} sm={6} md>
                <Label className="mb-1 fw-semibold small">{tt('supportTickets.fields.assignTo')}</Label>
                <Select
                  options={assignableUsers.map((u) => ({ value: String(u.id), label: userOptionLabel(u) }))}
                  value={
                    filterAssignedId
                      ? {
                          value: filterAssignedId,
                          label: userOptionLabel(
                            assignableUsers.find((u) => String(u.id) === filterAssignedId) || {
                              account_name: filterAssignedId,
                            }
                          ),
                        }
                      : null
                  }
                  onChange={(opt: { value: string; label: string } | null) =>
                    handleAssignedFilterChange(opt ? opt.value : '')
                  }
                  placeholder={tt('common.all')}
                  isClearable
                  isSearchable
                  classNamePrefix="rs"
                />
              </Col>
              <Col xs={12} sm={6} md>
                <Label className="mb-1 fw-semibold small">{tt('supportTickets.fields.requester')}</Label>
                <Select
                  options={assignableUsers.map((u) => ({ value: String(u.id), label: userOptionLabel(u) }))}
                  value={
                    filterRequesterId
                      ? {
                          value: filterRequesterId,
                          label: userOptionLabel(
                            assignableUsers.find((u) => String(u.id) === filterRequesterId) || {
                              account_name: filterRequesterId,
                            }
                          ),
                        }
                      : null
                  }
                  onChange={(opt: { value: string; label: string } | null) =>
                    handleRequesterFilterChange(opt ? opt.value : '')
                  }
                  placeholder={tt('common.all')}
                  isClearable
                  isSearchable
                  classNamePrefix="rs"
                />
              </Col>
              <Col xs={12} sm={6} md>
                <Label className="mb-1 fw-semibold small">{tt('supportTickets.list.columns.status')}</Label>
                <Input
                  type="select"
                  value={filterStatus}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  disabled={loading}
                >
                  <option value={STATUS_ACTIVE}>{tt('supportTickets.list.statusActive')}</option>
                  <option value="">{tt('common.all')}</option>
                  {TICKET_STATUS.map((v) => (
                    <option key={v} value={v}>
                      {getStatusLabel(v, tt)}
                    </option>
                  ))}
                </Input>
              </Col>
              <Col xs={12} sm={6} md>
                <Label className="mb-1 fw-semibold small">{tt('supportTickets.fields.priority')}</Label>
                <Input
                  type="select"
                  value={filterPriority}
                  onChange={(e) => handlePriorityFilterChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="">{tt('common.all')}</option>
                  {TICKET_PRIORITY.map((v) => (
                    <option key={v} value={v}>
                      {getPriorityLabel(v, tt)}
                    </option>
                  ))}
                </Input>
              </Col>
            </Row>

            {/* Search / Reset / options on the second line */}
            <Row className="g-2 align-items-center mb-3">
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
                <FormGroup check className="mb-0">
                  <Input
                    type="checkbox"
                    id="onlyMineFilter"
                    checked={onlyMine}
                    onChange={(e) => handleOnlyMineChange(e.target.checked)}
                    disabled={loading}
                  />
                  <Label check for="onlyMineFilter" className="small">
                    {tt('supportTickets.list.onlyMine')}
                  </Label>
                </FormGroup>
              </Col>
              <Col className="text-end text-muted small">
                {tt('supportTickets.list.total')}: {total}
              </Col>
            </Row>

            {error && <Alert color="danger">{error}</Alert>}

            <Card className="sl-table-card">
              <CardBody className="p-0">
                <div className="sl-table-scroll">
                  <Table className="mb-0 sl-table">
                    <thead>
                      <tr>
                        {columns.map((col, i) => (
                          <th
                            key={col.key}
                            ref={(el) => {
                              thRefs.current[i] = el;
                            }}
                            className={col.key === 'actions' ? 'sl-col-sticky-right' : undefined}
                            style={{
                              width: colWidths[i],
                              minWidth: 60,
                              position: col.key === 'actions' ? undefined : 'relative',
                            }}
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
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={columns.length} className="text-center py-5">
                            <Spinner color="primary" />
                          </td>
                        </tr>
                      )}
                      {!loading && rows.length === 0 && (
                        <tr>
                          <td colSpan={columns.length} className="text-center text-muted py-5">
                            {tt('supportTickets.list.noData')}
                          </td>
                        </tr>
                      )}
                      {!loading &&
                        rows.map((r) => (
                          <tr key={r.ticket_id}>
                            {columns.map((col) => (
                              <td key={col.key} className={col.key === 'actions' ? 'sl-col-sticky-right' : undefined}>
                                {col.getTitle ? (
                                  <OverflowTooltip text={col.getTitle(r)}>{col.render(r)}</OverflowTooltip>
                                ) : (
                                  col.render(r)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              </CardBody>
            </Card>

            {totalPages > 1 && (
              <div className="sl-pagination">
                <span className="sl-pg-total">
                  {tt('supportTickets.list.total')} {total}
                </span>

                <button className="sl-pg-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} title="Previous">
                  ‹
                </button>

                {pageItems.map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="sl-pg-ellipsis">
                      …
                    </span>
                  ) : (
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
      </Container>

      <Modal isOpen={!!editTicket} toggle={closeEdit} centered size="lg">
        <ModalHeader toggle={closeEdit}>
          <div className="d-flex align-items-center gap-2">
            <span>
              {tt('supportTickets.edit.title')}
              {editTicket ? ` — ${editTicket.ticket_number}` : ''}
            </span>
            {editTicket && (
              <Button
                size="sm"
                color="link"
                className="p-0"
                onClick={handleCopyLink}
                title={tt('supportTickets.edit.copyLink')}
              >
                <i className="ri-link align-bottom" />
              </Button>
            )}
          </div>
        </ModalHeader>
        <ModalBody style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {editError && <Alert color="danger">{editError}</Alert>}

          {/* Subject / Type / Assign To / Description are fixed at creation time and cannot be edited afterward. */}
          <FormGroup>
            <Label>{tt('supportTickets.fields.subject')}</Label>
            <Input value={editTicket?.subject || ''} disabled readOnly />
          </FormGroup>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>{tt('supportTickets.fields.type')}</Label>
                <Input value={editTicket ? getTypeLabel(editTicket.type, tt) : ''} disabled readOnly />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>{tt('supportTickets.fields.assignTo')}</Label>
                {canEditAssignees ? (
                  <Select
                    isMulti
                    options={assignableUsers.map((u) => ({ value: String(u.id), label: userOptionLabel(u) }))}
                    value={editAssignedIds.map((id) => {
                      const u = assignableUsers.find((au) => String(au.id) === id);
                      return { value: id, label: u ? userOptionLabel(u) : id };
                    })}
                    onChange={(opts: readonly { value: string; label: string }[] | null) =>
                      setEditAssignedIds(opts ? opts.map((o) => o.value) : [])
                    }
                    placeholder={tt('supportTickets.fields.unassigned')}
                    isClearable
                    isSearchable
                    classNamePrefix="rs"
                  />
                ) : (
                  <Input value={editTicket ? assigneeNamesOf(editTicket, tt('supportTickets.fields.unassigned')) : ''} disabled readOnly />
                )}
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <Label>{tt('supportTickets.fields.requester')}</Label>
                <Input
                  value={
                    editTicket
                      ? editTicket.requester_email
                        ? `${editTicket.user_name} (${editTicket.requester_email})`
                        : editTicket.user_name
                      : ''
                  }
                  disabled
                  readOnly
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <Label>{tt('supportTickets.fields.priority')}</Label>
                {isAdmin ? (
                  <Input
                    type="select"
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value))}
                  >
                    {TICKET_PRIORITY.map((v) => (
                      <option key={v} value={v}>
                        {getPriorityLabel(v, tt)}
                      </option>
                    ))}
                  </Input>
                ) : (
                  <Input value={editTicket ? getPriorityLabel(editTicket.priority, tt) : ''} disabled readOnly />
                )}
              </FormGroup>
            </Col>
          </Row>

          <FormGroup>
            <Label>{tt('supportTickets.list.columns.status')}</Label>
            {editCanEditStatus ? (
              <Input type="select" value={editStatus} onChange={(e) => setEditStatus(Number(e.target.value))}>
                {TICKET_STATUS.map((v) => (
                  <option key={v} value={v}>
                    {getStatusLabel(v, tt)}
                  </option>
                ))}
              </Input>
            ) : (
              <Input value={editTicket ? getStatusLabel(editTicket.status, tt) : ''} disabled readOnly />
            )}
          </FormGroup>

          <FormGroup>
            <Label>{tt('supportTickets.fields.note')}</Label>
            <Input type="textarea" rows={4} value={editTicket?.note || ''} disabled readOnly />
            <ExistingFileList files={editTicket?.note_files} />
          </FormGroup>

          {editTicket && (
            <FormGroup>
              <Label>{tt('supportTickets.replies.title')}</Label>

              {(editTicket.assigned_response || !!editTicket.assigned_response_files?.length) && (
                <div className="text-muted small mb-2">
                  <em>{tt('supportTickets.replies.legacyResponse')}:</em> {editTicket.assigned_response}
                  <ExistingFileList files={editTicket.assigned_response_files} />
                </div>
              )}

              {commentsError && (
                <Alert color="danger" className="py-1 px-2 small">
                  {commentsError}
                </Alert>
              )}

              <div className="border rounded p-2 mb-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
                {commentsLoading && (
                  <div className="text-center py-2">
                    <Spinner size="sm" />
                  </div>
                )}
                {!commentsLoading && comments.length === 0 && (
                  <div className="text-muted small">{tt('supportTickets.replies.empty')}</div>
                )}
                {!commentsLoading &&
                  comments.map((c) => (
                    <div key={c.comment_id} className="mb-2 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-2 small">
                        <span className="fw-semibold">{c.author_name || '—'}</span>
                        <Badge color={c.author_type === 'support' ? 'info' : 'secondary'} pill>
                          {tt(
                            c.author_type === 'support'
                              ? 'supportTickets.replies.support'
                              : 'supportTickets.replies.requester'
                          )}
                        </Badge>
                        {!!c.is_internal && (
                          <Badge color="warning" pill>
                            {tt('supportTickets.replies.internalBadge')}
                          </Badge>
                        )}
                        <span className="text-muted ms-auto">{fmtDate(c.create_time)}</span>
                      </div>
                      {c.message && (
                        <div className="small mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                          {c.message}
                        </div>
                      )}
                      <ExistingFileList files={c.files} />
                    </div>
                  ))}
              </div>

              {editCanComment && (
                <div>
                  <Input
                    type="textarea"
                    rows={2}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onPaste={(e) => {
                      const pastedImages = imageFilesFromClipboard(e);
                      if (pastedImages.length === 0) return;
                      // Consume the paste so the raw image data doesn't land in the textarea.
                      e.preventDefault();
                      setReplyFiles((prev) => mergeAttachments(prev, pastedImages));
                    }}
                    placeholder={tt('supportTickets.replies.placeholder')}
                  />
                  <div className="text-muted small mt-1">{tt('supportTickets.replies.pasteHint')}</div>
                  <div className="mt-2">
                    <FilePicker files={replyFiles} onChange={setReplyFiles} />
                  </div>
                  <div className="d-flex align-items-center justify-content-between mt-2">
                    {editAuthorType === 'support' ? (
                      <FormGroup check className="mb-0">
                        <Input
                          type="checkbox"
                          checked={replyInternal}
                          onChange={(e) => setReplyInternal(e.target.checked)}
                          id="replyInternal"
                        />
                        <Label check for="replyInternal" className="small">
                          {tt('supportTickets.replies.internalNote')}
                        </Label>
                      </FormGroup>
                    ) : (
                      <span />
                    )}
                    <Button
                      size="sm"
                      color="primary"
                      onClick={submitReply}
                      disabled={
                        replySending ||
                        savingId === editTicket?.ticket_id ||
                        (!replyMessage.trim() && replyFiles.length === 0)
                      }
                    >
                      {replySending ? <Spinner size="sm" className="me-1" /> : null}
                      {tt('supportTickets.replies.send')}
                    </Button>
                  </div>
                </div>
              )}
            </FormGroup>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={closeEdit}>
            {tt('common.cancel')}
          </Button>
          {topSectionDirty && (
            <Button
              color="primary"
              onClick={submitEdit}
              disabled={savingId === editTicket?.ticket_id || replySending}
            >
              {tt('common.save')}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default TicketList;
