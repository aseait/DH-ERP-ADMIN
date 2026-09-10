import { buildApiUrl } from '../apiBase';
import { doFetch } from './helper/fetchHelper';
import {
  POST_NOTES,
  RETRIEVE_NOTES,
  MARK_NOTES_AS_READ,
  POST_INTERNAL_NOTES,
  RETRIEVE_INTERNAL_NOTES,
  MARK_INTERNAL_NOTES_AS_READ,
  GET_SPECIFIC_USER,
} from '../url_helper';

// ---------- POST (create note / add new note) ----------
export async function postLeaveMessageApi(payload: {
  user_id: string | number;
  task_id: string | number;
  note_text: string;
  sender_type: string;
  container_number?: string | null;
  awb?: string | null;
  read_status_user?: number | null;
  read_status_admin?: string | null;
}) {
  const url = buildApiUrl(POST_NOTES);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- RETRIEVE (get notes by task + container/awb) ----------
export async function retrieveLeaveMessagesApi(payload: {
  task_id: string | number;
  container_number?: string | null;
  awb?: string | null;
  extra_task_ids?: Array<string | number>;
}) {
  const url = buildApiUrl(RETRIEVE_NOTES);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- MARK READ (bulk) ----------
export async function markLeaveMessagesAsReadApi(payload: { note_ids: Array<string | number>; name?: string }) {
  const url = buildApiUrl(MARK_NOTES_AS_READ);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- INTERNAL NOTES ----------
export async function postInternalNoteApi(payload: {
  task_id: string | number;
  note_text: string;
  sender_name: string;
  sender_department?: string;
  read_status_internal?: string;
  container_number?: string | null;
  awb?: string | null;
}) {
  const url = buildApiUrl(POST_INTERNAL_NOTES);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

export async function retrieveInternalNotesApi(payload: {
  task_id: string | number;
  container_number?: string | null;
  awb?: string | null;
  extra_task_ids?: Array<string | number>;
}) {
  const url = buildApiUrl(RETRIEVE_INTERNAL_NOTES);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

export async function markInternalNotesAsReadApi(payload: { note_ids: Array<string | number>; name?: string }) {
  const url = buildApiUrl(MARK_INTERNAL_NOTES_AS_READ);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------- GET SPECIFIC USER (for @mention candidates) ----------
export async function getSpecificUserApi(payload: { department: string }) {
  const url = buildApiUrl(GET_SPECIFIC_USER);
  return doFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}
