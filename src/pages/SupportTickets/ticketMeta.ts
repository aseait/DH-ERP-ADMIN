// 4 = "On Hold" — the ticket can't be worked on right now (blocked / waiting on
// something). Appended as 4 to keep existing rows valid; ordered in the UI after
// "In Progress".
export const TICKET_STATUS = [0, 1, 4, 2, 3] as const;
export const TICKET_TYPE = [0, 1, 2, 3, 4, 5] as const;
export const DEFAULT_TICKET_TYPE = 5;
export const DEFAULT_TICKET_PRIORITY = 1;
export const TICKET_PRIORITY = [0, 1, 2, 3] as const;

const STATUS_KEYS: Record<number, string> = {
  0: 'supportTickets.status.open',
  1: 'supportTickets.status.inProgress',
  2: 'supportTickets.status.resolved',
  3: 'supportTickets.status.closed',
  4: 'supportTickets.status.onHold',
};

const STATUS_COLORS: Record<number, string> = {
  0: 'primary',
  1: 'warning',
  2: 'success',
  3: 'secondary',
  4: 'dark',
};

const TYPE_KEYS: Record<number, string> = {
  0: 'supportTickets.type.general',
  1: 'supportTickets.type.hardware',
  2: 'supportTickets.type.software',
  3: 'supportTickets.type.network',
  4: 'supportTickets.type.accessAccount',
  5: 'supportTickets.type.lingxing',
};

const PRIORITY_KEYS: Record<number, string> = {
  0: 'supportTickets.priority.low',
  1: 'supportTickets.priority.medium',
  2: 'supportTickets.priority.high',
  3: 'supportTickets.priority.urgent',
};

const PRIORITY_COLORS: Record<number, string> = {
  0: 'success', // Low
  1: 'info', // Medium
  2: 'warning', // High
  3: 'danger', // Urgent
};

export const getStatusLabel = (v: unknown, tt: (key: string) => string): string =>
  tt(STATUS_KEYS[Number(v)] ?? STATUS_KEYS[0]);

export const getStatusColor = (v: unknown): string => STATUS_COLORS[Number(v)] ?? 'secondary';

export const getTypeLabel = (v: unknown, tt: (key: string) => string): string =>
  tt(TYPE_KEYS[Number(v)] ?? TYPE_KEYS[0]);

export const getPriorityLabel = (v: unknown, tt: (key: string) => string): string =>
  tt(PRIORITY_KEYS[Number(v)] ?? PRIORITY_KEYS[0]);

export const getPriorityColor = (v: unknown): string => PRIORITY_COLORS[Number(v)] ?? 'secondary';

export type TicketFile = {
  file_id: number;
  ticket_id: number;
  comment_id?: number | null;
  file_section: 'note' | 'assigned_response' | 'comment';
  file_name: string;
  original_file_name: string;
  file_url: string;
  oss_object_name: string;
  mime_type: string | null;
  file_size: number | null;
  create_time?: string;
};

export type TicketCommentAuthorType = 'requester' | 'support';

export type TicketComment = {
  comment_id: number;
  ticket_id: number;
  author_id: number;
  author_name: string | null;
  author_email: string | null;
  author_type: TicketCommentAuthorType;
  message: string | null;
  is_internal: number;
  create_time: string;
  files: TicketFile[];
};

export const SUPPORT_FILE_ACCEPT =
  '.png,.jpg,.jpeg,.pdf,.xlsx,.xls,.csv,.zip,image/png,image/jpeg,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,' +
  'text/csv,application/zip,application/x-zip-compressed';

export const SUPPORT_FILE_MAX_COUNT = 10;
export const SUPPORT_FILE_MAX_SIZE_BYTES = 20 * 1024 * 1024;

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(i === 0 || val >= 10 ? 0 : 1)} ${units[i]}`;
};
