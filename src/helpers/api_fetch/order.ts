// src/api/order.ts
import {
  FETCH_CITIES,
  CREATE_MARINE_MAIN_TICKET,
  CREATE_AIR_MAIN_TICKET,
  CREATE_PARSE_MAIN_TICKET,
  ADMIN_CONTACTS_SEARCH,
} from '../url_helper';
import { buildApiUrl } from '../apiBase';
import { doFetch } from './helper/fetchHelper';

// 1) Fetch destination city list
export const fetchCitiesApi = async () => {
  const url = buildApiUrl(FETCH_CITIES);
  return doFetch(url, { method: 'GET' });
};

// 2) Create marine main ticket
export const createMarineMainTicketApi = async (data: any) => {
  const url = buildApiUrl(CREATE_MARINE_MAIN_TICKET);
  return doFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// 3) Create air main ticket
export const createAirMainTicketApi = async (data: any) => {
  const url = buildApiUrl(CREATE_AIR_MAIN_TICKET);
  return doFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// 4) Create parse/truck main ticket
export const createParseMainTicketApi = async (data: any) => {
  const url = buildApiUrl(CREATE_PARSE_MAIN_TICKET);
  return doFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// 5) Fetch admin contacts (for SelectUser)
export const fetchAdminContactsApi = async (keyword = '', per_page = 999) => {
  const url = buildApiUrl(ADMIN_CONTACTS_SEARCH);
  return doFetch(url, {
    method: 'POST',
    body: JSON.stringify({ keyword, per_page }),
  });
};
