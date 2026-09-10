import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type SalesQuoteState = {
  inserting: boolean;
  updating: boolean;
  retrieving: boolean;

  lastInsertResponse: any | null;
  lastUpdateResponse: any | null;

  quotes: any[];
  totalRows: number;

  error: string | null;
};

const initialState: SalesQuoteState = {
  inserting: false,
  updating: false,
  retrieving: false,

  lastInsertResponse: null,
  lastUpdateResponse: null,

  quotes: [],
  totalRows: 0,

  error: null,
};

const salesQuoteSlice = createSlice({
  name: 'salesQuote',
  initialState,
  reducers: {
    salesQuoteError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.inserting = false;
      state.updating = false;
      state.retrieving = false;
    },

    clearSalesQuoteError(state) {
      state.error = null;
    },

    setInserting(state, action: PayloadAction<boolean>) {
      state.inserting = action.payload;
    },
    setUpdating(state, action: PayloadAction<boolean>) {
      state.updating = action.payload;
    },
    setRetrieving(state, action: PayloadAction<boolean>) {
      state.retrieving = action.payload;
    },

    insertSalesQuoteSuccess(state, action: PayloadAction<any>) {
      state.lastInsertResponse = action.payload;
      state.inserting = false;
      state.error = null;
    },

    updateSalesQuoteSuccess(state, action: PayloadAction<any>) {
      state.lastUpdateResponse = action.payload;
      state.updating = false;
      state.error = null;

      // Update cached quote row in place
      const updated = action.payload?.quote_id;
      if (updated) {
        state.quotes = state.quotes.map((q: any) =>
          q.quote_id === updated ? { ...q, ...action.payload } : q
        );
      }
    },

    retrieveSalesQuoteSuccess(state, action: PayloadAction<any>) {
      state.quotes = Array.isArray(action.payload?.data) ? action.payload.data : [];
      state.totalRows = Number(action.payload?.totalRows ?? 0);
      state.retrieving = false;
      state.error = null;
    },

    resetSalesQuoteState(state) {
      state.inserting = false;
      state.updating = false;
      state.retrieving = false;
      state.lastInsertResponse = null;
      state.lastUpdateResponse = null;
      state.quotes = [];
      state.totalRows = 0;
      state.error = null;
    },
  },
});

export const {
  salesQuoteError,
  clearSalesQuoteError,
  setInserting,
  setUpdating,
  setRetrieving,
  insertSalesQuoteSuccess,
  updateSalesQuoteSuccess,
  retrieveSalesQuoteSuccess,
  resetSalesQuoteState,
} = salesQuoteSlice.actions;

export default salesQuoteSlice.reducer;
