import { toast } from 'react-toastify';
import {
  apiError,
  setRetrievingFiles,
  setUploadingMarineAir,
  setUploadingTruck,
  setUploadingPoa,
  setRetrievingPoa,
  retrieveFilesSuccess,
  uploadMarineAirFilesSuccess,
  uploadTruckFilesSuccess,
  uploadPoaSuccess,
  getPoaFileSuccess,
  setLoadingImporterNames,
  fetchImporterNamesSuccess,
} from './reducer';

import {
  uploadMarineAndAirFilesApi,
  uploadTruckFilesApi,
  retrieveFilesApi,
} from '../../helpers/api_fetch/files';

import { uploadPoaApi, getPoaFileApi, listImporterNamesApi } from '../../helpers/api_fetch/poa';

// 1) Retrieve files
export const retrieveFiles = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setRetrievingFiles(true));

    const data = await retrieveFilesApi(payload ?? {});
    const list = data?.data ?? data ?? [];

    dispatch(retrieveFilesSuccess(Array.isArray(list) ? list : []));
    return list;
  } catch (err: any) {
    const msg = err?.message || 'Failed to retrieve files';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setRetrievingFiles(false));
  }
};

// 2) Upload Marine + Air files (supports optional status updates)
export const uploadMarineAndAirFiles = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setUploadingMarineAir(true));

    const data = await uploadMarineAndAirFilesApi(payload ?? {});
    dispatch(uploadMarineAirFilesSuccess(data));

    return data;
  } catch (err: any) {
    const msg = err?.message || 'Failed to upload files (Marine/Air)';
    dispatch(apiError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(msg);
  } finally {
    dispatch(setUploadingMarineAir(false));
  }
};

// 3) Upload Truck files (NO updates supported by backend)
export const uploadTruckFiles = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setUploadingTruck(true));
    const data = await uploadTruckFilesApi(payload ?? {});
    dispatch(uploadTruckFilesSuccess(data));
    return data;
  } catch (err: any) {
    console.error('[thunk uploadTruckFiles] error =', err);
    const msg = err?.message || 'Failed to upload files (Truck)';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setUploadingTruck(false));
  }
};

// 4) Upload POA files OR update POA statuses
export const uploadPoaFiles = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setUploadingPoa(true));

    // payload can be either:
    // A) upload: { files, user_id, poa_name, status }
    // B) updates: { updates: [{ poa_id, status }, ...] }
    const data = await uploadPoaApi(payload ?? {});
    dispatch(uploadPoaSuccess(data));

    toast.success('POA processed successfully', { autoClose: 2500 });
    return data;
  } catch (err: any) {
    const msg = err?.message || 'Failed to process POA';
    dispatch(apiError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(msg);
  } finally {
    dispatch(setUploadingPoa(false));
  }
};

// 5) Get POA files by user_id (single or array)
export const getPoaFile = (payload: { user_id: any }) => async (dispatch: any) => {
  try {
    dispatch(setRetrievingPoa(true));

    const data = await getPoaFileApi(payload ?? { user_id: [] });
    const list = data?.data ?? data ?? [];

    dispatch(getPoaFileSuccess(Array.isArray(list) ? list : []));
    return list;
  } catch (err: any) {
    const msg = err?.message || 'Failed to retrieve POA files';
    dispatch(apiError(msg));
    return Promise.reject(msg);
  } finally {
    dispatch(setRetrievingPoa(false));
  }
};

export const fetchImporterNames =
  (payload: { user_id: string | number; status?: number }) => async (dispatch: any) => {
    try {
      dispatch(setLoadingImporterNames(true));

      const data = await listImporterNamesApi(payload);
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      dispatch(fetchImporterNamesSuccess(Array.isArray(list) ? list : []));
      return list;
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch importer names';
      dispatch(apiError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(msg);
    } finally {
      dispatch(setLoadingImporterNames(false));
    }
  };
