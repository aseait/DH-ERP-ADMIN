import { toast } from 'react-toastify';

import {
  salesQuoteError,
  setInserting,
  setUpdating,
  setRetrieving,
  insertSalesQuoteSuccess,
  updateSalesQuoteSuccess,
  retrieveSalesQuoteSuccess,
} from './reducer';

import {
  insertSalesQuoteApi,
  updateSalesQuoteApi,
  retrieveSalesQuoteApi,
  InsertSalesQuotePayload,
  UpdateSalesQuotePayload,
  RetrieveSalesQuotePayload,
} from '../../helpers/api_fetch/salesQuote';

export const insertSalesQuote =
  (payload: InsertSalesQuotePayload) => async (dispatch: any) => {
    try {
      dispatch(setInserting(true));
      const data = await insertSalesQuoteApi(payload);
      dispatch(insertSalesQuoteSuccess(data));
      toast.success(data?.message || 'Quote line created', { autoClose: 2000 });
      return data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create quote line';
      dispatch(salesQuoteError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(err);
    } finally {
      dispatch(setInserting(false));
    }
  };

export const updateSalesQuote =
  (payload: UpdateSalesQuotePayload) => async (dispatch: any) => {
    try {
      dispatch(setUpdating(true));
      const data = await updateSalesQuoteApi(payload);
      dispatch(updateSalesQuoteSuccess({ ...data, quote_id: payload.quote_id }));
      toast.success(data?.message || 'Quote updated', { autoClose: 2000 });
      return data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update quote';
      dispatch(salesQuoteError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(err);
    } finally {
      dispatch(setUpdating(false));
    }
  };

export const retrieveSalesQuote =
  (payload: RetrieveSalesQuotePayload) => async (dispatch: any) => {
    try {
      dispatch(setRetrieving(true));
      const data = await retrieveSalesQuoteApi(payload);
      dispatch(retrieveSalesQuoteSuccess(data));
      return data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to retrieve quotes';
      dispatch(salesQuoteError(msg));
      toast.error(msg, { autoClose: 2500 });
      return Promise.reject(err);
    } finally {
      dispatch(setRetrieving(false));
    }
  };
