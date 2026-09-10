import React from 'react';
import { Badge } from 'reactstrap';
import ServiceListPage, { fmtDate, statusLabel, type ColDef } from '../_ServiceListPage';
import {
  AIR_WAREHOUSE_TICKET_DETAILS,
  UPDATE_AIR_WAREHOUSE_TICKET_DETAILS,
} from '../../../helpers/url_helper';

const statusColor = (lbl: string) =>
  ({ Pending: 'warning', 'In Review': 'info', Completed: 'success', Closed: 'success', Rejected: 'danger', Cancelled: 'secondary' }[lbl] ?? 'secondary');

const COLUMNS: ColDef[] = [
  { label: 'AWB', width: 150, render: r => r.awb || '-' },
  { label: 'Destination', width: 120, render: r => r.destination || '-' },
  { label: 'Airline', width: 100, render: r => r.airline || '-' },
  { label: 'Warehouse Date', width: 130, render: r => fmtDate(r.warehouse_date) },
  { label: 'Out Date', width: 100, render: r => fmtDate(r.out_date) },
  { label: 'CBM', width: 70, render: r => r.cbm != null ? String(r.cbm) : '-' },
  { label: 'Pieces', width: 70, render: r => r.pieces != null ? String(r.pieces) : '-' },
  {
    label: 'Status', width: 110,
    render: r => { const lbl = statusLabel(r.status); return <Badge color={statusColor(lbl)}>{lbl}</Badge>; },
  },
];

const AirWms = () => (
  <ServiceListPage
    title="Air — Warehouse"
    breadcrumb="Customer Order / Air"
    endpoint={AIR_WAREHOUSE_TICKET_DETAILS}
    statusService="wms_air"
    detailRoute="/order_run/info/k_info"
    identifierField="awb"
    updateAssignEndpoint={UPDATE_AIR_WAREHOUSE_TICKET_DETAILS}
    updateAssignIdField="air_warehouse_id"
    columns={COLUMNS}
  />
);

export default AirWms;
