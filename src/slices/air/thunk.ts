import { toast } from 'react-toastify';

import i18n from '../../i18n';
import {
  airApiError,
  setUpdatingCb,
  setUpdatingLogistic,
  setUpdatingWarehouse,
  updateAirCbSuccess,
  updateAirLogisticSuccess,
  updateAirWarehouseSuccess,
} from './reducer';

import {
  updateAirCbTicketDetailsApi,
  updateAirLogisticTicketDetailsApi,
  updateAirWarehouseTicketDetailsApi,
  UpdateAirCbPayload,
  UpdateAirLogisticPayload,
  UpdateAirWarehousePayload,
} from '../../helpers/api_fetch/air';

// 1) Update CB
export const updateAirCbTicketDetails = (payload: UpdateAirCbPayload) => async (dispatch: any) => {
  try {
    dispatch(setUpdatingCb(true));

    const data = await updateAirCbTicketDetailsApi(payload);
    dispatch(updateAirCbSuccess(data));

    toast.success(i18n.t('info.airCbUpdated'), { autoClose: 2500 });
    return data;
  } catch (err: any) {
    const msg = err?.message || i18n.t('info.airCbUpdateFailed');
    dispatch(airApiError(msg));
    toast.error(msg, { autoClose: 2500 });
    return Promise.reject(err);
  } finally {
    dispatch(setUpdatingCb(false));
  }
};

// 2) Update Logistic
export const updateAirLogisticTicketDetails =
  (payload: UpdateAirLogisticPayload) => async (dispatch: any) => {
    try {
      dispatch(setUpdatingLogistic(true));

      const data = await updateAirLogisticTicketDetailsApi(payload);
      dispatch(updateAirLogisticSuccess(data));

      toast.success(i18n.t('info.airLogisticUpdated'), { autoClose: 2500 });
      return data;
    } catch (err: any) {
      const msg = err?.message || i18n.t('info.airLogisticUpdateFailed');
      dispatch(airApiError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(err);
    } finally {
      dispatch(setUpdatingLogistic(false));
    }
  };

// 3) Update Warehouse
export const updateAirWarehouseTicketDetails =
  (payload: UpdateAirWarehousePayload) => async (dispatch: any) => {
    try {
      dispatch(setUpdatingWarehouse(true));

      const data = await updateAirWarehouseTicketDetailsApi(payload);
      dispatch(updateAirWarehouseSuccess(data));

      toast.success(i18n.t('info.airWarehouseUpdated'), { autoClose: 2500 });
      return data;
    } catch (err: any) {
      const msg = err?.message || i18n.t('info.airWarehouseUpdateFailed');
      dispatch(airApiError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(err);
    } finally {
      dispatch(setUpdatingWarehouse(false));
    }
  };
