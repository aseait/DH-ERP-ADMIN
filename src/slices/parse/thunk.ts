import { toast } from 'react-toastify';

import i18n from '../../i18n';
import {
  updateTruckCbContainerApi,
  updateTruckLogisticApi,
  updateTruckUsToCaApi,
} from '../../helpers/api_fetch/parse';
import {
  setTruckUpdating,
  setTruckUpdateError,
  updateTruckCbContainerSuccess,
  updateTruckLogisticSuccess,
  updateTruckUsToCaSuccess,
} from './reducer';

/** CB container update */
export const updateTruckCbContainer = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setTruckUpdating(true));
    dispatch(setTruckUpdateError(''));

    const data = await updateTruckCbContainerApi(payload);

    dispatch(updateTruckCbContainerSuccess(data));
    toast.success(i18n.t('info.truckCbUpdated'), { autoClose: 2000 });

    return data;
  } catch (err: any) {
    const msg = err?.message || i18n.t('info.truckCbUpdateFailed');
    dispatch(setTruckUpdateError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(err);
  } finally {
    dispatch(setTruckUpdating(false));
  }
};

/** truck_logistic + truck_logistic_container update */
export const updateTruckLogistic = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setTruckUpdating(true));
    dispatch(setTruckUpdateError(''));

    const data = await updateTruckLogisticApi(payload);

    dispatch(updateTruckLogisticSuccess(data));
    toast.success(i18n.t('info.truckLogisticUpdated'), { autoClose: 2000 });

    return data;
  } catch (err: any) {
    const msg = err?.message || i18n.t('info.truckLogisticUpdateFailed');
    dispatch(setTruckUpdateError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(err);
  } finally {
    dispatch(setTruckUpdating(false));
  }
};

/** truck_us_to_ca + truck_us_to_ca_container update */
export const updateTruckUsToCa = (payload: any) => async (dispatch: any) => {
  try {
    dispatch(setTruckUpdating(true));
    dispatch(setTruckUpdateError(''));

    const data = await updateTruckUsToCaApi(payload);

    dispatch(updateTruckUsToCaSuccess(data));
    toast.success(i18n.t('info.truckUsToCaUpdated'), { autoClose: 2000 });

    return data;
  } catch (err: any) {
    const msg = err?.message || i18n.t('info.truckUsToCaUpdateFailed');
    dispatch(setTruckUpdateError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(err);
  } finally {
    dispatch(setTruckUpdating(false));
  }
};
