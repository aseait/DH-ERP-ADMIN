import { apiError, eventTrackingSuccess, reset_event_tracking_flag, setLoading } from './reducer';

import { EVENT_TRACKING } from '../../helpers/url_helper';
import { buildApiUrl, getApiBase } from '../../helpers/apiBase';

export const fetchEventTracking = (payload: any) => async (dispatch: any) => {
  try {
    if (!getApiBase()) {
      dispatch(apiError('API base URL is missing.'));
      return Promise.reject('API base URL is missing.');
    }

    dispatch(setLoading(true));

    const res = await fetch(buildApiUrl(EVENT_TRACKING), {
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
    dispatch(eventTrackingSuccess(data));
    return data;
  } catch (err: any) {
    const msg = err?.message || 'Network error';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  }
};
