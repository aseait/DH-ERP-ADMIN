import { buildApiUrl } from '../apiBase';
import {
  UPDATE_AIR_CB_TICKET_DETAILS,
  UPDATE_AIR_LOGISTIC_TICKET_DETAILS,
  UPDATE_AIR_WAREHOUSE_TICKET_DETAILS,
} from '../url_helper';
import { doFetch } from './helper/fetchHelper';

// ---------- CB ----------
export type UpdateAirCbPayload = {
  cb_air_id?: string | number;
  awb?: string;

  destination?: string;
  airline?: string;
  eta?: string;
  cad_status?: number;
  note?: string;
  status?: number;
  assigned_name?: string;
  importer?: string;
};

export async function updateAirCbTicketDetailsApi(payload: UpdateAirCbPayload) {
  const url = buildApiUrl(UPDATE_AIR_CB_TICKET_DETAILS);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- LOGISTIC ----------
export type UpdateAirLogisticPayload = {
  logistic_air_id?: string;
  awb?: string;

  destination?: string;
  shipping_units?: any;
  gross_weight?: any;
  chargeable_weight?: any;
  last_mile?: any;

  supervision_wareshouse?: any;
  supervision_fee?: any;
  supervision_status?: any;

  eta?: string;
  ata?: string;
  cargo_pickup_time?: string;
  cargo_arrival_time?: string;
  note?: string;
};

export async function updateAirLogisticTicketDetailsApi(payload: UpdateAirLogisticPayload) {
  const url = buildApiUrl(UPDATE_AIR_LOGISTIC_TICKET_DETAILS);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- WAREHOUSE ----------
export type UpdateAirWarehousePayload = {
  wms_air_id?: string;
  awb?: string;

  location?: string;
  capacity?: any;
  managerName?: string;
  contactInfo?: string;
};

export async function updateAirWarehouseTicketDetailsApi(payload: UpdateAirWarehousePayload) {
  const url = buildApiUrl(UPDATE_AIR_WAREHOUSE_TICKET_DETAILS);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}
