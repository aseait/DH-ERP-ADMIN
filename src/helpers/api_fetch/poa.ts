import { buildApiUrl } from '../apiBase';
import {
  CREATE_IMPORTER,
  GET_IMPORTER_GST_DUTY,
  LIST_IMPORTER_NAMES,
  RETRIEVE_POA_FILES,
  UPLOAD_POA_FILES,
} from '../url_helper';

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
function throwIfNotOk(res: Response, data: any) {
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
}

export const createImporterApi = async (payload: {
  user_id: string | number;
  name: string;
  status?: number;
}): Promise<{ message: string; importer_id: number }> => {
  const url = buildApiUrl(CREATE_IMPORTER);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: payload.user_id, name: payload.name, status: payload.status ?? 0 }),
  });
  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

export const uploadPoaApi = async (payload: {
  files: File[];
  user_ids: Array<string | number>;
  poa_names: string[];
  statuses: Array<string | number>;
  importer_ids?: Array<string | number>;
  doc_types?: string[];
}) => {
  const url = buildApiUrl(UPLOAD_POA_FILES);

  const fd = new FormData();
  (payload.files || []).forEach((f) => fd.append('files', f));

  payload.user_ids.forEach((v) => fd.append('user_ids', String(v)));
  payload.poa_names.forEach((v) => fd.append('poa_names', String(v)));
  payload.statuses.forEach((v) => fd.append('statuses', String(v)));
  (payload.importer_ids ?? []).forEach((v) => fd.append('importer_ids', String(v)));
  (payload.doc_types ?? []).forEach((v) => fd.append('doc_types', String(v)));

  const res = await fetch(url, { method: 'POST', body: fd });
  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

export const getPoaFileApi = async (payload: {
  user_id: string | number | Array<string | number>;
}) => {
  const url = buildApiUrl(RETRIEVE_POA_FILES);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: payload.user_id }),
  });
  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

export const listImporterNamesApi = async (payload: {
  user_id: string | number;
  status?: number;
}) => {
  const url = buildApiUrl(LIST_IMPORTER_NAMES);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: payload.user_id,
      status: payload.status ?? 0,
    }),
  });

  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

export const getImporterGstDutyApi = async (payload: {
  user_id: string | number;
  importer_id: string | number | Array<string | number>;
}) => {
  const url = buildApiUrl(GET_IMPORTER_GST_DUTY);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: payload.user_id,
      importer_id: payload.importer_id,
    }),
  });

  const data = await safeJson(res);
  console.log(data);
  throwIfNotOk(res, data);
  return data as {
    message: string;
    data: Array<{
      importer_id: number;
      Name: string;
      gst_duty: number; // 0 or 1
    }>;
  };
};
