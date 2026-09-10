import React from 'react';
import { Table } from 'reactstrap';

// ----------------------
// Small helpers
// ----------------------
export const safeStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export const buildPageList = (current: number, total: number): (number | '...')[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [];
  const push = (v: number | '...') => {
    if (!pages.length || pages[pages.length - 1] !== v) pages.push(v);
  };

  push(1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) push('...');
  for (let p = start; p <= end; p++) push(p);
  if (end < total - 1) push('...');
  push(total);

  return pages;
};

// ----------------------
// Types
// ----------------------
export type RowType = 'marine' | 'air' | 'truck' | 'unknown';

// Minimal row shape (avoid implicit any, but keep flexible)
export type MainRow = Record<string, any> & {
  main_id: string | number;
  status?: any;
  create_time?: string;
};

export type RowMeta = {
  type: RowType;
  no: string;
  num: number;
  rejected: boolean;
  qgOk: boolean;
  tihuoOk: boolean;
  cangkuOk: boolean;
};

export type RowVM = { row: MainRow; meta: RowMeta };

export type StatusMaps = {
  cad: Record<number, string>;
  customs: Record<number, string>;
  order: Record<number, string>;
  pickup: Record<number, string>;
  warehouse: Record<number, string>;
};

// ----------------------
// Row logic (reusable)
// ----------------------
export const getRowType = (row: MainRow): RowType => {
  if (row?.cb_marine_id || row?.logistic_marine_id || row?.wms_marine_id) return 'marine';
  if (row?.cb_air_id || row?.logistic_air_id || row?.wms_air_id) return 'air';
  if (row?.truck_cb_id || row?.truck_logistic_id || row?.truck_us_ca_id) return 'truck';
  return 'unknown';
};

export const hasAnyActiveTicket = (row: MainRow) => {
  const statuses = [
    row?.cb_marine?.[0]?.status,
    row?.logistic_marine?.[0]?.container_status,
    row?.wms_marine?.[0]?.status ?? row?.wms_marine?.[0]?.container_status,

    row?.cb_air?.[0]?.status,
    row?.logistic_air?.[0]?.container_status ?? row?.logistic_air?.[0]?.status,
    row?.wms_air?.[0]?.status,

    row?.truck_cb?.[0]?.ticket_status,
    row?.truck_logistic?.[0]?.container_status,
    row?.truck_us_to_ca?.[0]?.container_status,
  ];

  return statuses.some((s) => s !== 7 && s !== undefined);
};

export const pickPrimaryNo = (row: MainRow): { no: string; num: number } => {
  // Marine
  if (row?.cb_marine_id && row?.cb_marine?.length)
    return { no: row.cb_marine[0].container_number, num: row.cb_marine.length };
  if (row?.logistic_marine_id && row?.logistic_marine?.length)
    return { no: row.logistic_marine[0].container_number, num: row.logistic_marine.length };
  if (row?.wms_marine_id && row?.wms_marine?.length)
    return { no: row.wms_marine[0].container_number, num: row.wms_marine.length };

  // Air
  if (row?.cb_air_id && row?.cb_air?.length)
    return { no: row.cb_air[0].awb, num: row.cb_air.length };
  if (row?.logistic_air_id && row?.logistic_air?.length)
    return { no: row.logistic_air[0].awb, num: row.logistic_air.length };
  if (row?.wms_air_id && row?.wms_air?.length)
    return { no: row.wms_air[0].awb, num: row.wms_air.length };

  // Truck
  if (row?.truck_cb_id && row?.truck_cb?.length)
    return { no: row.truck_cb[0].container_number, num: row.truck_cb.length };
  if (row?.truck_logistic_id && row?.truck_logistic?.length)
    return { no: row.truck_logistic[0].container_number, num: row.truck_logistic.length };
  if (row?.truck_us_ca_id && row?.truck_us_to_ca?.length)
    return { no: row.truck_us_to_ca[0].container_number, num: row.truck_us_to_ca.length };

  return { no: '', num: 0 };
};

export const isRowRejected = (row: MainRow) => {
  const is6 = (x: any) => toNum(x) === 6; // CB rejected
  const is4 = (x: any) => toNum(x) === 4; // pickup/logistic rejected

  return (
    row?.cb_marine?.some((m: any) => is6(m?.status)) ||
    row?.cb_air?.some((m: any) => is6(m?.status)) ||
    row?.truck_cb?.some((m: any) => is6(m?.ticket_status)) ||
    row?.logistic_marine?.some((m: any) => is4(m?.container_status)) ||
    row?.logistic_air?.some((m: any) => is4(m?.status ?? m?.container_status)) ||
    row?.truck_logistic?.some((m: any) => is4(m?.ticket_status)) ||
    row?.truck_us_to_ca?.some((m: any) => is4(m?.ticket_status))
  );
};

export const allOk = (arr: any[], get: (x: any) => any, ok: (n: number) => boolean) => {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every((x) => ok(toNum(get(x))));
};

export const buildRowMeta = (row: MainRow): RowMeta => {
  const { no, num } = pickPrimaryNo(row);
  const type = getRowType(row);
  const rejected = isRowRejected(row);

  const qgOk =
    (row?.cb_marine_id &&
      allOk(
        row.cb_marine,
        (x) => x.status,
        (n) => n === 5
      )) ||
    (row?.cb_air_id &&
      allOk(
        row.cb_air,
        (x) => x.status,
        (n) => n === 5
      )) ||
    (row?.truck_cb_id &&
      allOk(
        row.truck_cb,
        (x) => x.ticket_status,
        (n) => n === 5
      ));

  const tihuoOk =
    (row?.logistic_marine_id &&
      allOk(
        row.logistic_marine,
        (x) => x.container_status,
        (n) => n === 3 || n === 6
      )) ||
    (row?.logistic_air_id &&
      allOk(
        row.logistic_air,
        (x) => x.container_status ?? x.status,
        (n) => n === 3
      )) ||
    (row?.truck_logistic_id &&
      allOk(
        row.truck_logistic,
        (x) => x.ticket_status,
        (n) => n === 3
      ));

  const cangkuOk =
    (row?.wms_marine_id &&
      allOk(
        row.wms_marine,
        (x) => x.status ?? x.container_status,
        (n) => n === 3
      )) ||
    (row?.wms_air_id &&
      allOk(
        row.wms_air,
        (x) => x.status,
        (n) => n === 3
      )) ||
    (row?.truck_us_ca_id &&
      allOk(
        row.truck_us_to_ca,
        (x) => x.ticket_status,
        (n) => n === 3
      ));

  return { type, no, num, rejected, qgOk, tihuoOk, cangkuOk };
};

// ----------------------
// Status maps builder
// ----------------------
export const createStatusMaps = (tOr: (key: string, fallback: string) => string): StatusMaps => {
  const cad: Record<number, string> = {
    0: tOr('state.cad.notSubmit', 'Not Submitted'),
    1: tOr('serviceList.cadOptions.notConfirmed', 'Not Confirmed'),
    2: tOr('serviceList.cadOptions.confirmed', 'Confirmed'),
    3: tOr('state.cad.rejected', 'Rejected'),
  };

  const customs: Record<number, string> = {
    0:  tOr('state.customs.notStarted', 'Unclear Customs'),
    1:  tOr('state.customs.cbsaAccepted', 'Accepted'),
    2:  tOr('state.customs.cbsaRejected', 'Rejected'),
    4:  tOr('state.customs.cbsaReleased', 'Released'),
    5:  tOr('state.customs.cbsaExamRequired', 'Exam Required'),
    9:  tOr('state.customs.cbsaAcceptedWaiting', 'Accepted / Waiting'),
    34: tOr('state.customs.cbsaAcceptedAwaitingCustoms', 'Accepted / Awaiting Customs'),
  };

  const order: Record<number, string> = {
    0: tOr('state.order.reviewing', 'Under Review'),
    1: tOr('state.order.processing', 'Processing'),
    2: tOr('state.order.pendingSubmission', 'Pending Submission'),
    3: tOr('state.order.submitted', 'Submitted'),
    4: tOr('state.order.released', 'Released'),
    5: tOr('state.order.completed', 'Completed'),
    6: tOr('state.order.rejected', 'Rejected'),
    7: tOr('state.order.deleted', 'Deleted'),
    10: tOr('state.order.deletePending', 'Delete Pending'),
  };

  const pickup: Record<number, string> = {
    0: tOr('state.order.reviewing', 'Under Review'),
    1: tOr('state.order.processing', 'Processing'),
    2: tOr('state.pickup.inTransit', 'In Transit'),
    8: tOr('state.pickup.pendingComplete', 'Pending Complete'),
    3: tOr('state.pickup.deliveryCompleted', 'Delivery Completed'),
    6: tOr('state.pickup.totalCompleted', 'Total Completed'),
    4: tOr('state.order.rejected', 'Rejected'),
    7: tOr('state.order.deleted', 'Deleted'),
    10: tOr('state.order.deletePending', 'Delete Pending'),
  };

  const warehouse: Record<number, string> = {
    0: tOr('state.warehouse.arrived', 'Arrived at Warehouse'),
    1: tOr('state.warehouse.inStorage', 'In Storage'),
    2: tOr('state.warehouse.dispatched', 'Dispatched'),
    3: tOr('state.warehouse.delivered', 'Delivered'),
    7: tOr('state.order.deleted', 'Deleted'),
    10: tOr('state.order.deletePending', 'Delete Pending'),
  };

  return { cad, customs, order, pickup, warehouse };
};

export const lookupMap = (m: Record<number, string>, v: any, fallback = '') => {
  const n = toNum(v);
  return m[n] ?? fallback;
};

// ----------------------
// Generic MiniTable (reusable)
// FIX: make the exported component non-generic (props use any)
// This prevents TS from inferring <unknown> in JSX and breaking columns typing.
// ----------------------
export type ColDef<T = any> = {
  header: string;
  className?: string;
  tdClassName?: string;
  title?: (r: T) => string;
  render?: (r: T) => React.ReactNode;
  field?: keyof T;
};

export type MiniTableProps<T = any> = {
  rows: T[];
  columns: ColDef<T>[];
  actionHeader?: string;
  renderAction?: (r: T) => React.ReactNode;
  rowKey?: (r: T, idx: number) => React.Key;
};

const MiniTableInner: React.FC<MiniTableProps<any>> = ({
                                                         rows,
                                                         columns,
                                                         actionHeader,
                                                         renderAction,
                                                         rowKey,
                                                       }) => {
  const isDeletePendingText = (v: unknown) => {
    const s = safeStr(v).trim();
    return s === 'Delete Pending' || s === '删除待处理';
  };

  return (
      <div className="inner-table-wrap">
        <Table size="sm" className="orderlist-inner-table">
          <thead>
          <tr>
            {columns.map((c, i) => (
                <th key={i} className={c.className}>
                  {c.header}
                </th>
            ))}
            {renderAction && <th className="text-end">{actionHeader || 'Actions'}</th>}
          </tr>
          </thead>

          <tbody>
          {rows.map((r, idx) => (
              <tr key={rowKey ? rowKey(r, idx) : idx}>
                {columns.map((c, i) => {
                  const content = c.render ? c.render(r) : c.field ? (r as any)[c.field] : '';
                  const title = c.title ? c.title(r) : undefined;

                  const plainText =
                      typeof content === 'string' || typeof content === 'number'
                          ? String(content)
                          : title || '';

                  const pendingClass = isDeletePendingText(plainText) ? 'text-warning fw-semibold' : '';
                  const tdClassName = [c.tdClassName, pendingClass].filter(Boolean).join(' ');

                  return (
                      <td key={i} className={tdClassName} title={title}>
                        {content}
                      </td>
                  );
                })}
                {renderAction && <td className="text-end">{renderAction(r)}</td>}
              </tr>
          ))}
          </tbody>
        </Table>
      </div>
  );
};

export const MiniTable = React.memo(MiniTableInner);

(MiniTable as any).displayName = 'MiniTable';
