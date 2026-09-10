import {
  apiError,
  mainTicketDetailsSuccess,
  reset_main_ticket_details_flag,
  setLoading,
} from './reducer';

import { MAIN_TICKET_DETAILS } from '../../helpers/url_helper';
import { buildApiUrl, getApiBase } from '../../helpers/apiBase';

// Monotonic counter shared by every dispatch of this thunk, across every page
// that uses it. Lets the reducer tell an in-order response from one that
// arrived late (e.g. the mount-time fetch resolving after a post-save refetch).
let ticketDetailsRequestSeq = 0;

export const fetchMainTicketDetails = (payload: any) => async (dispatch: any) => {
  const requestId = ++ticketDetailsRequestSeq;
  const isStale = () => requestId !== ticketDetailsRequestSeq;
  try {
    if (!getApiBase()) {
      if (!isStale()) dispatch(apiError('API base URL is missing.'));
      return Promise.reject('API base URL is missing.');
    }

    dispatch(setLoading(true));

    const res = await fetch(buildApiUrl(MAIN_TICKET_DETAILS), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      const msg = data?.message || `Request failed (HTTP ${res.status})`;
      if (!isStale()) dispatch(apiError(msg));
      return Promise.reject(msg);
    }

    dispatch(mainTicketDetailsSuccess({ data, requestId }));
    return data;
  } catch (err: any) {
    const msg = err?.message || 'Network error';
    if (!isStale()) dispatch(apiError(msg));
    return Promise.reject(msg);
  }
};

export const resetMainTicketDetailsFlag = () => async (dispatch: any) => {
  try {
    return dispatch(reset_main_ticket_details_flag());
  } catch (error: any) {
    dispatch(apiError(String(error)));
  }
};
