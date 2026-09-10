import { buildApiUrl } from '../apiBase';
import { ADMIN_DELETE_FILE, RETRIEVE_FILES, UPLOAD_FILES, UPLOAD_TRUCK_FILES } from '../url_helper';

type AnyObj = Record<string, any>;

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function throwIfNotOk(res: Response, data: any) {
  if (!res.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
}

/**
 * POST /uploadFiles (multipart)
 * Works for Marine + Air because your backend accepts:
 * cb_marine_ids, cb_air_ids, logistic_marine_ids, logistic_air_ids, wms_marine_id, wms_air_id, container_number
 * sub_categories (JSON string per entry)
 * updates (JSON string)
 */
export const uploadMarineAndAirFilesApi = async (payload: {
  files?: File[];

  updates?: Array<{ file_id: string | number; status: string | number }>;

  sub_categories?: AnyObj | string;

  cb_marine_ids?: Array<string | number> | string | number;
  cb_air_ids?: Array<string | number> | string | number;
  logistic_marine_ids?: Array<string | number> | string | number;
  logistic_air_ids?: Array<string | number> | string | number;

  wms_marine_ids?: Array<string | number> | string | number;
  wms_air_ids?: Array<string | number> | string | number;

  container_number?: Array<string> | string;
}) => {
  const url = buildApiUrl(UPLOAD_FILES);
  const fd = new FormData();

  // files
  (payload?.files || []).forEach((f) => fd.append('files', f, f.name));

  if (payload?.sub_categories != null) {
    const sub =
      typeof payload.sub_categories === 'string'
        ? payload.sub_categories
        : JSON.stringify(payload.sub_categories);

    fd.append('sub_categories', sub);
  }

  if (payload?.updates !== undefined) {
    fd.append('updates', JSON.stringify(payload.updates || []));
  }

  // ids/fields
  toArray(payload?.cb_marine_ids).forEach((v) => fd.append('cb_marine_ids', String(v)));
  toArray(payload?.cb_air_ids).forEach((v) => fd.append('cb_air_ids', String(v)));
  toArray(payload?.logistic_marine_ids).forEach((v) => fd.append('logistic_marine_ids', String(v)));
  toArray(payload?.logistic_air_ids).forEach((v) => fd.append('logistic_air_ids', String(v)));

  toArray(payload?.wms_marine_ids).forEach((v) => fd.append('wms_marine_ids', String(v)));
  toArray(payload?.wms_air_ids).forEach((v) => fd.append('wms_air_ids', String(v)));

  toArray(payload?.container_number).forEach((v) => fd.append('container_number', String(v)));

  const res = await fetch(url, { method: 'POST', body: fd });
  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

// helpers/api_fetch/files.ts (or wherever your uploadTruckFilesApi lives)
export const uploadTruckFilesApi = async (payload: {
  files?: File[];
  updates?: Array<{ file_id: string | number; status: string | number }>;
  sub_categories?: AnyObj[] | AnyObj | string;
  truck_cb_ids?: Array<string | number> | string | number;
  truck_logistic_ids?: Array<string | number> | string | number;
  truck_us_ca_ids?: Array<string | number> | string | number;
  container_number?: Array<string> | string;
}) => {
  const url = buildApiUrl(UPLOAD_TRUCK_FILES);
  const fd = new FormData();

  const filesArr = Array.isArray(payload?.files) ? payload.files : [];
  filesArr.forEach((f) => {
    if (f instanceof File) {
      fd.append('files', f, f.name);
    }
  });

  const rawSub = payload?.sub_categories as any;
  let subList: any[] = [];

  if (Array.isArray(rawSub)) {
    subList = rawSub;
  } else if (typeof rawSub === 'string' && rawSub.trim()) {
    try {
      const parsed = JSON.parse(rawSub);
      subList = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      subList = [];
    }
  } else if (rawSub && typeof rawSub === 'object') {
    subList = [rawSub];
  }

  subList.forEach((entry) => {
    if (entry && typeof entry === 'object') {
      fd.append('sub_categories', JSON.stringify(entry));
    }
  });

  if (payload?.updates !== undefined) {
    fd.append('updates', JSON.stringify(payload.updates || []));
  }

  toArray(payload?.truck_cb_ids).forEach((v) => fd.append('truck_cb_ids', String(v)));
  toArray(payload?.truck_logistic_ids).forEach((v) => fd.append('truck_logistic_ids', String(v)));
  toArray(payload?.truck_us_ca_ids).forEach((v) => fd.append('truck_us_ca_ids', String(v)));
  toArray(payload?.container_number).forEach((v) => fd.append('container_number', String(v)));

  const res = await fetch(url, { method: 'POST', body: fd });
  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

export const adminDeleteFileApi = async (file_id: number) => {
  const url = buildApiUrl(ADMIN_DELETE_FILE);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: { file_id } }),
  });
  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};

/**
 * POST /retrieveFiles (JSON)
 */
export const retrieveFilesApi = async (payload: AnyObj) => {
  const url = buildApiUrl(RETRIEVE_FILES);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

  const data = await safeJson(res);
  throwIfNotOk(res, data);
  return data;
};
