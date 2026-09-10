import { toast } from 'react-toastify';
import { apiError, fetchSuccess, setLoading } from './reducer';
import { buildApiUrl, getApiBase } from '../../helpers/apiBase';
import { MARINE_CONTAINER_EVENTS } from '../../helpers/url_helper';

export const fetchMarineContainerEvents =
  (payload?: { container_number?: string }) => async (dispatch: any) => {
    try {
      if (!getApiBase()) {
        dispatch(apiError('API base URL is missing.'));
        return Promise.reject('API base URL is missing.');
      }

      dispatch(setLoading(true));

      const res = await fetch(buildApiUrl(MARINE_CONTAINER_EVENTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const errJson = await res.json();
          msg = errJson?.message || msg;
        } catch {}
        dispatch(apiError(msg));
        toast.error(msg, { autoClose: 2500 });
        return Promise.reject(msg);
      }

      const data = await res.json();
      const events = Array.isArray(data) ? data : (data?.data ?? []);

      dispatch(fetchSuccess({ events, query: payload ?? null }));
      return events;
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch container events';
      dispatch(apiError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(msg);
    } finally {
      dispatch(setLoading(false));
    }
  };
