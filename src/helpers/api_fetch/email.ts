import { buildApiUrl } from '../apiBase';
import { FETCH_EMAIL, SEND_MAIL } from '../url_helper';
import { doFetch } from './helper/fetchHelper';

export async function fetchUserEmailApi(userId: string | number): Promise<{
  email?: string;
  user_name?: string;
  language?: 0 | 1;
}> {
  const url = buildApiUrl(FETCH_EMAIL);
  const data = await doFetch(url, {
    method: 'POST',
    body: JSON.stringify({ user_id: String(userId) }),
  });
  return data?.data || data || {};
}

export async function sendMailApi(payload: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
}) {
  const url = buildApiUrl(SEND_MAIL);
  return doFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
