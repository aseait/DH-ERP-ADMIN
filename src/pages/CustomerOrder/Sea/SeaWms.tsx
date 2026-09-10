import React from 'react';
import { Badge } from 'reactstrap';
import ServiceListPage, { fmtDate, statusLabel, type ColDef } from '../_ServiceListPage';
import {
  MARINE_WAREHOUSE_TICKET_DETAILS,
  UPDATE_MARINE_WAREHOUSE_TICKET_DETAILS,
} from '../../../helpers/url_helper';

const statusColor = (lbl: string) =>
  ({ Pending: 'warning', 'In Review': 'info', Completed: 'success', Closed: 'success', Rejected: 'danger', Cancelled: 'secondary' }[lbl] ?? 'secondary');

const COLUMNS: ColDef[] = [
  { label: 'Container No.', width: 150, render: r => r.container_number || '-' },
  { label: 'Destination', width: 120, render: r => r.destination || '-' },
  { label: 'Warehouse Date', width: 130, render: r => fmtDate(r.warehouse_date) },
  { label: 'Out Date', width: 100, render: r => fmtDate(r.out_date) },
  { label: 'CBM', width: 70, render: r => r.cbm != null ? String(r.cbm) : '-' },
  { label: 'Pieces', width: 70, render: r => r.pieces != null ? String(r.pieces) : '-' },
  {
    label: 'Status', width: 110,
    render: r => { const lbl = statusLabel(r.status); return <Badge color={statusColor(lbl)}>{lbl}</Badge>; },
  },
];

const SeaWms = () => (
  <ServiceListPage
    title="Sea — Warehouse"
    breadcrumb="Customer Order / Sea"
    endpoint={MARINE_WAREHOUSE_TICKET_DETAILS}
    statusService="wms_marine"
    detailRoute="/order_run/info/h_info"
    identifierField="container_number"
    updateAssignEndpoint={UPDATE_MARINE_WAREHOUSE_TICKET_DETAILS}
    updateAssignIdField="marine_warehouse_id"
    columns={COLUMNS}
  />
);

export default SeaWms;
