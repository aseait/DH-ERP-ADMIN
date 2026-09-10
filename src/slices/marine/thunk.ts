import { toast } from 'react-toastify';

import i18n from '../../i18n';
import {
  marineError,
  setUpdatingCb,
  setUpdatingLogistic,
  setUpdatingWarehouse,
  updateCbSuccess,
  updateLogisticSuccess,
  updateWarehouseSuccess,
} from './reducer';

import {
  updateMarineCbTicketDetailsApi,
  updateMarineLogisticTicketDetailsApi,
  updateMarineWarehouseTicketDetailsApi,
} from '../../helpers/api_fetch/marine';

// ---------- CB ----------
export const updateMarineCbTicketDetails =
  (payload: {
    cb_marine_id: string | number;
    importer?: string;
    destination?: string;
    shipline?: string;
    cad_status?: number;
    cad_note?: string;
    rail?: string;
    gst_status?: number;
    note?: string;
    status?: number;
    assigned_name?: string;
    fcl?: any;
    containers?: Array<{ container_number: string; portETA?: string; trainETA?: string }>;
  }) =>
  async (dispatch: any) => {
    try {
      dispatch(setUpdatingCb(true));
      const data = await updateMarineCbTicketDetailsApi(payload);
      dispatch(updateCbSuccess(data));

      toast.success(i18n.t('info.cbTicketUpdated'), { autoClose: 2000 });
      return data;
    } catch (err: any) {
      const msg = err?.message || i18n.t('info.cbTicketUpdateFailed');
      dispatch(marineError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(msg);
    } finally {
      dispatch(setUpdatingCb(false));
    }
  };

// ---------- LOGISTIC ----------
export const updateMarineLogisticTicketDetails =
  (payload: {
    logistic_marine_id: string;
    estimated_arrival_date?: string;
    warehouse_status?: number;
    go_warehouse?: number;
    goc_status?: number;
    ers_status?: number;
    fcl?: any;
    destination?: string;
    rail?: string;
    note?: string;
    status?: number;
    containers?: Array<{
      container_number: string;
      portETA?: string;
      shipline?: string;
      trainETA?: string;
      tele?: number;
      pk_num?: string;
      pickup_container_date?: string;
      return_container_date?: string;
      status?: number;
    }>;
  }) =>
  async (dispatch: any) => {
    try {
      dispatch(setUpdatingLogistic(true));
      const data = await updateMarineLogisticTicketDetailsApi(payload);
      dispatch(updateLogisticSuccess(data));

      toast.success(i18n.t('info.logisticTicketUpdated'), { autoClose: 2000 });
      return data;
    } catch (err: any) {
      const msg = err?.message || i18n.t('info.logisticTicketUpdateFailed');
      dispatch(marineError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(msg);
    } finally {
      dispatch(setUpdatingLogistic(false));
    }
  };

// ---------- WAREHOUSE ----------
export const updateMarineWarehouseTicketDetails =
  (payload: {
    wms_marine_id: string;
    note?: string;
    containers?: Array<{
      container_id: string | number;
      container_number?: string;
      new_status?: number;
    }>;
  }) =>
  async (dispatch: any) => {
    try {
      dispatch(setUpdatingWarehouse(true));
      const data = await updateMarineWarehouseTicketDetailsApi(payload);
      dispatch(updateWarehouseSuccess(data));

      toast.success(i18n.t('info.warehouseTicketUpdated'), { autoClose: 2000 });
      return data;
    } catch (err: any) {
      const msg = err?.message || i18n.t('info.warehouseTicketUpdateFailed');
      dispatch(marineError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(msg);
    } finally {
      dispatch(setUpdatingWarehouse(false));
    }
  };
