import { buildApiUrl } from '../apiBase';
import { getUserIdFromSession } from '../userInformation';
import { doFetch } from './helper/fetchHelper';

// The backend needs the caller's id to gate the DH library (restriction 1 /
// DH / Logistic only). Read endpoints don't otherwise need it.
const meId = () => getUserIdFromSession();
import {
  ADD_SOP_CATEGORY,
  DELETE_SOP,
  DELETE_SOP_CATEGORY,
  INCREMENT_SOP_VIEW,
  RETRIEVE_SOP_CATEGORIES,
  RETRIEVE_SOP_DETAILS,
  RETRIEVE_SOPS,
  PROXY_SOP_FILE,
  RETRIEVE_SOP_SETTINGS,
  SET_SOP_PUBLIC_LOCK,
  SUBMIT_SOP,
  UPDATE_SOP,
  UPDATE_SOP_CATEGORY,
} from '../url_helper';

// multipart requests must NOT carry a JSON Content-Type — let the browser set
// the multipart boundary. Small helper mirroring the shape doFetch returns.
async function postForm(path: string, form: FormData) {
  const res = await fetch(buildApiUrl(path), { method: 'POST', body: form });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw { status: res.status, message: data?.error || res.statusText || 'Request failed', ...data };
  }
  return data;
}

export type SopListParams = {
  department?: string;
  category_id?: number | string;
  category?: string;
  material_type?: number | string;
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
};

export function retrieveSopSettingsApi(): Promise<{ data?: { publicUploadsLocked?: boolean } }> {
  return doFetch(buildApiUrl(RETRIEVE_SOP_SETTINGS), { method: 'POST', body: '{}' });
}

export function setSopPublicLockApi(locked: boolean) {
  return doFetch(buildApiUrl(SET_SOP_PUBLIC_LOCK), {
    method: 'POST',
    body: JSON.stringify({ locked, user_id: meId() }),
  });
}

export function retrieveSopCategoriesApi(department?: string) {
  return doFetch(buildApiUrl(RETRIEVE_SOP_CATEGORIES), {
    method: 'POST',
    body: JSON.stringify({ user_id: meId(), ...(department ? { department } : {}) }),
  });
}

export function addSopCategoryApi(payload: {
  department: string;
  category_name: string;
  user_id: string | number;
}) {
  return doFetch(buildApiUrl(ADD_SOP_CATEGORY), { method: 'POST', body: JSON.stringify(payload) });
}

export function updateSopCategoryApi(payload: {
  category_id: number | string;
  category_name: string;
  user_id: string | number;
}) {
  return doFetch(buildApiUrl(UPDATE_SOP_CATEGORY), { method: 'POST', body: JSON.stringify(payload) });
}

export function deleteSopCategoryApi(payload: {
  category_id: number | string;
  user_id: string | number;
}) {
  return doFetch(buildApiUrl(DELETE_SOP_CATEGORY), { method: 'POST', body: JSON.stringify(payload) });
}

export function retrieveSopsApi(params: SopListParams) {
  return doFetch(buildApiUrl(RETRIEVE_SOPS), {
    method: 'POST',
    body: JSON.stringify({ user_id: meId(), ...params }),
  });
}

export function retrieveSopDetailsApi(sopId: string | number) {
  return doFetch(buildApiUrl(RETRIEVE_SOP_DETAILS), {
    method: 'POST',
    body: JSON.stringify({ sop_id: sopId, user_id: meId() }),
  });
}

export function deleteSopApi(sopId: string | number, userId: string | number) {
  return doFetch(buildApiUrl(DELETE_SOP), {
    method: 'POST',
    body: JSON.stringify({ sop_id: sopId, user_id: userId }),
  });
}

// Fetches a SOP file's raw bytes through the API (which sends CORS headers),
// so the client-side Word/Excel renderers can read them without an OSS CORS rule.
export async function fetchSopFileBytes(fileId: number | string): Promise<ArrayBuffer> {
  const res = await fetch(buildApiUrl(PROXY_SOP_FILE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, user_id: meId() }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = (await res.json())?.error || msg;
    } catch {
      /* streamed / non-JSON */
    }
    throw new Error(msg);
  }
  return res.arrayBuffer();
}

export function incrementSopViewApi(sopId: string | number) {
  return doFetch(buildApiUrl(INCREMENT_SOP_VIEW), {
    method: 'POST',
    body: JSON.stringify({ sop_id: sopId }),
  });
}

export type SopSubmitInput = {
  title: string;
  description: string;
  department: string;
  category_id?: number | string;
  category?: string;
  user_id: string | number;
  videoFile?: File | null;
  thumbnailFile?: File | null;
  documentFiles?: File[];
};

export function submitSopApi(input: SopSubmitInput) {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description);
  form.append('department', input.department);
  form.append('user_id', String(input.user_id));
  if (input.category_id !== undefined && input.category_id !== '') {
    form.append('category_id', String(input.category_id));
  } else if (input.category) {
    form.append('category', input.category);
  }
  if (input.videoFile) form.append('video_file', input.videoFile);
  if (input.thumbnailFile) form.append('thumbnail_file', input.thumbnailFile);
  (input.documentFiles || []).forEach((f) => form.append('document_files', f));
  return postForm(SUBMIT_SOP, form);
}

export type SopUpdateInput = {
  sop_id: string | number;
  user_id: string | number;
  title?: string;
  description?: string;
  category_id?: number | string;
  category?: string;
  removeFileIds?: number[];
  videoFile?: File | null;
  thumbnailFile?: File | null;
  documentFiles?: File[];
};

export function updateSopApi(input: SopUpdateInput) {
  const form = new FormData();
  form.append('sop_id', String(input.sop_id));
  form.append('user_id', String(input.user_id));
  if (input.title !== undefined) form.append('title', input.title);
  if (input.description !== undefined) form.append('description', input.description);
  if (input.category_id !== undefined && input.category_id !== '') {
    form.append('category_id', String(input.category_id));
  } else if (input.category) {
    form.append('category', input.category);
  }
  if (input.removeFileIds && input.removeFileIds.length > 0) {
    form.append('remove_file_ids', JSON.stringify(input.removeFileIds));
  }
  if (input.videoFile) form.append('video_file', input.videoFile);
  if (input.thumbnailFile) form.append('thumbnail_file', input.thumbnailFile);
  (input.documentFiles || []).forEach((f) => form.append('document_files', f));
  return postForm(UPDATE_SOP, form);
}
