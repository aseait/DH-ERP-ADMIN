import { toast } from 'react-toastify';
import { apiError, setUploading, uploadMarineCbAnEmfOnlySuccess } from './reducer';
import { uploadMarineCbAnEmfOnlyApi } from '../../helpers/api_fetch/anemf';

export const uploadMarineCbAnEmfOnly = (payload: FormData) => async (dispatch: any) => {
  try {
    dispatch(setUploading(true));

    const data = await uploadMarineCbAnEmfOnlyApi(payload);
    dispatch(uploadMarineCbAnEmfOnlySuccess(data));

    toast.success('AN/EMF uploaded successfully', { autoClose: 2500 });
    return data;
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || 'Failed to upload AN/EMF';
    dispatch(apiError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(msg);
  } finally {
    dispatch(setUploading(false));
  }
};
