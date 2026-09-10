import { apiError, ticketSummarySuccess, reset_ticket_summary_flag, setLoading } from './reducer';

import { GET_NON_CLOSED_TICKET_SUMMARY, GET_TICKET_SUMMARY } from '../../helpers/url_helper';
import { buildApiUrl } from '../../helpers/apiBase';

export const fetchTicketSummary = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setLoading(true));

    const url = buildApiUrl(GET_TICKET_SUMMARY);

    if (!url || url.startsWith('undefined')) {
      dispatch(apiError('API base URL is missing.'));
      return Promise.reject('API base URL is missing.');
    }

    const res = await fetch(url, {
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
      dispatch(apiError(msg));
      return Promise.reject(msg);
    }

    dispatch(ticketSummarySuccess(data));
    return data;
  } catch (err: any) {
    const msg = err?.message || 'Network error';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  }
};

export const fetchNonClosedTicketSummary = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setLoading(true));

    const url = buildApiUrl(GET_NON_CLOSED_TICKET_SUMMARY);
    if (!url || url.startsWith('undefined')) {
      const msg = 'API base URL is missing.';
      dispatch(apiError(msg));
      return Promise.reject(msg);
    }

    const res = await fetch(url, {
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
      dispatch(apiError(msg));
      return Promise.reject(msg);
    }

    dispatch(ticketSummarySuccess(data));
    return data;
  } catch (err: any) {
    const msg = err?.message || 'Network error';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setLoading(false));
  }
};

export const resetTicketSummaryFlag = () => async (dispatch: any) => {
  try {
    return dispatch(reset_ticket_summary_flag());
  } catch (error: any) {
    dispatch(apiError(String(error)));
  }
};
