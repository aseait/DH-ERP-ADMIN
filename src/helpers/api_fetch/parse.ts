import { buildApiUrl } from '../apiBase';
import { doFetch } from './helper/fetchHelper';
import {
  UPDATE_TRUCK_CB_CONTAINER,
  UPDATE_TRUCK_CB_LOGISTIC,
  UPDATE_TRUCK_US_TO_CA,
} from '../url_helper';

/** ---------------- CB CONTAINER ---------------- */
export async function updateTruckCbContainerApi(payload: {
  truck_cb_id: string | number;

  importer?: string;
  destination?: string;
  transaction?: string;
  cad_status?: number;
  cad_note?: string;
  gst_status?: number;
  custom_status?: number;
  custom_status_time?: string;
  cross_border_location?: string;
  cross_border_time?: string;
  parse?: string;
  note?: string;
  an_emf?: string;
}) {
  const url = buildApiUrl(UPDATE_TRUCK_CB_CONTAINER);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

/** ---------------- TRUCK LOGISTIC + CONTAINER ---------------- */
export async function updateTruckLogisticApi(payload: {
  truck_logistic_id: string | number;
  container_id: string | number;

  // truck_logistic
  destination_us?: string;
  fcl?: string | number;
  portETA?: string;
  pickup_container_date?: string;
  return_container_date?: string;
  transaction_date?: string;
  custom_status?: number;
  custom_status_time?: string;
  warehouse_status?: number;
  goc_status?: number;
  ers_status?: number;
  status?: number;
  rail?: string;
  note?: string;
  an_emf?: string;

  // truck_logistic_container
  cbm?: number | string;
  truck_company?: string;
  destination?: string;
  cross_border_location?: string;
  cross_border_time?: string;
  warehouse_arrival_date?: string;
  weight?: number | string;
  parse?: string;
  container_note?: string;
}) {
  const url = buildApiUrl(UPDATE_TRUCK_CB_LOGISTIC);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

/** ---------------- US TO CA + CONTAINER ---------------- */
export async function updateTruckUsToCaApi(payload: {
  truck_us_ca_id: string | number;
  container_id: string | number;

  // truck_us_to_ca
  destination_us?: string;
  fcl?: string | number;
  portETA?: string;
  pickup_container_date?: string;
  return_container_date?: string;
  transaction_date?: string;
  custom_status?: number;
  custom_status_time?: string;
  warehouse_status?: number;
  goc_status?: number;
  ers_status?: number;
  status?: number;
  rail?: string;
  note?: string;
  an_emf?: string;

  // truck_us_to_ca_container
  cbm?: number | string;
  truck_company?: string;
  destination?: string;
  cross_border_location?: string;
  cross_border_time?: string;
  warehouse_arrival_date?: string;
  weight?: number | string;
  parse?: string;
  container_note?: string;
}) {
  const url = buildApiUrl(UPDATE_TRUCK_US_TO_CA);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}
