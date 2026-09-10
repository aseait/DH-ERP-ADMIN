import { buildApiUrl } from '../apiBase';
import { doFetch } from './helper/fetchHelper';
import {
  INSERT_SALES_QUOTE,
  UPDATE_SALES_QUOTE,
  RETRIEVE_SALES_QUOTE,
} from '../url_helper';

export interface InsertSalesQuotePayload {
  user_id: string;
  sales_id: number;
  service: string;
  service_details: string;
  fee: number;
  note?: string | null;
  currency: number;
  address?: string | null;
  delivery_city?: string | null;
  postcode?: string | null;
  dock?: 0 | 1;
  optional?: 0 | 1;
  unit?: string | null;
  additional_information?: string | null;
  confirm_duplicate?: boolean | 0 | 1 | '0' | '1';
  effective_date?: string | null;
}

export interface UpdateSalesQuotePayload {
  quote_id: number;
  note?: string | null;
  fee: number;
  currency: 0 | 1;
  address?: string | null;
  delivery_city: string | null;
  postcode: string | null;
  dock?: 0 | 1;
  optional?: 0 | 1;
  unit?: string | null;
  additional_information?: string | null;
}

export interface RetrieveSalesQuotePayload {
  sales_id: number;
  user_id?: number;
  page?: number;
  pageSize?: number;
  orderBy?: 'user_id' | 'service' | 'service_details' | 'fee' | 'currency';
  orderDir?: 'ASC' | 'DESC';
}

export async function insertSalesQuoteApi(payload: InsertSalesQuotePayload) {
  const url = buildApiUrl(INSERT_SALES_QUOTE);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateSalesQuoteApi(payload: UpdateSalesQuotePayload) {
  const url = buildApiUrl(UPDATE_SALES_QUOTE);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

export async function retrieveSalesQuoteApi(payload: RetrieveSalesQuotePayload) {
  const url = buildApiUrl(RETRIEVE_SALES_QUOTE);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}
