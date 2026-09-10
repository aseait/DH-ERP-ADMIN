import { UPDATE_SERVICE } from '../../helpers/url_helper';
import { setSubmitting, changeServiceError, changeServiceSuccess } from './reducer';
import { buildApiUrl, getApiBase } from '../../helpers/apiBase';

export type ChangeServicePayload = {
  main_id: string | number;
  user_id?: string | number;
  service: string;
  action: 'add' | 'delete';
  serviceDetails?: Record<string, any>;
  containerDetails?: Array<{ container_number: string }>;
  additional_information?: string | null;
};

export const submitChangeService = (payload: ChangeServicePayload) => async (dispatch: any) => {
  try {
    if (!getApiBase()) {
      const msg = 'API base URL is missing.';
      dispatch(changeServiceError(msg));
      return Promise.reject(msg);
    }

    dispatch(setSubmitting(true));
    dispatch(changeServiceError(null));

    const res = await fetch(buildApiUrl(UPDATE_SERVICE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      const msg = data?.message || `Request failed (${res.status})`;
      dispatch(changeServiceError(String(msg)));
      dispatch(setSubmitting(false));
      return Promise.reject(msg);
    }

    dispatch(changeServiceSuccess(data));
    dispatch(setSubmitting(false));
    return data;
  } catch (e: any) {
    const msg = e?.message || 'Request failed';
    dispatch(changeServiceError(String(msg)));
    dispatch(setSubmitting(false));
    return Promise.reject(msg);
  }
};
