import { buildApiUrl } from '../apiBase';
import {
  UPDATE_MARINE_CB_TICKET_DETAILS,
  UPDATE_MARINE_LOGISTIC_TICKET_DETAILS,
  UPDATE_MARINE_WAREHOUSE_TICKET_DETAILS,
} from '../url_helper';
import { doFetch } from './helper/fetchHelper';

export async function updateMarineCbTicketDetailsApi(payload: {
  cb_marine_id: string | number;
  importer?: string;
  destination?: string;
  shipline?: string;
  cad_status?: number;
  cad_note?: string;
  rail?: string;
  gst_status?: number;
  note?: string;
  status?: number;
  assigned_name?: string;
  fcl?: any;
  containers?: Array<{ container_number: string; portETA?: string; trainETA?: string }>;
}) {
  const url = buildApiUrl(UPDATE_MARINE_CB_TICKET_DETAILS);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- LOGISTIC ----------
export async function updateMarineLogisticTicketDetailsApi(payload: {
  logistic_marine_id: string;
  estimated_arrival_date?: string;
  warehouse_status?: number;
  go_warehouse?: number;
  goc_status?: number;
  ers_status?: number;
  fcl?: any;
  destination?: string;
  rail?: string;
  note?: string;
  status?: number;
  containers?: Array<{
    container_number: string;
    portETA?: string;
    shipline?: string;
    trainETA?: string;
    tele?: number;
    pk_num?: string;
    pickup_container_date?: string;
    return_container_date?: string;
    status?: number;
  }>;
}) {
  const url = buildApiUrl(UPDATE_MARINE_LOGISTIC_TICKET_DETAILS);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- WAREHOUSE ----------
export async function updateMarineWarehouseTicketDetailsApi(payload: {
  wms_marine_id: string;
  note?: string;
  containers?: Array<{
    container_id: string | number;
    container_number?: string;
    new_status?: number;
  }>;
}) {
  const url = buildApiUrl(UPDATE_MARINE_WAREHOUSE_TICKET_DETAILS);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}
