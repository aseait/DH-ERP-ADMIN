import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MarineState = {
  updatingCb: boolean;
  updatingLogistic: boolean;
  updatingWarehouse: boolean;

  lastCbResponse: any | null;
  lastLogisticResponse: any | null;
  lastWarehouseResponse: any | null;

  error: string | null;
};

export const initialState: MarineState = {
  updatingCb: false,
  updatingLogistic: false,
  updatingWarehouse: false,

  lastCbResponse: null,
  lastLogisticResponse: null,
  lastWarehouseResponse: null,

  error: null,
};

const marineSlice = createSlice({
  name: 'marine',
  initialState,
  reducers: {
    marineError(state, action: PayloadAction<string>) {
      state.error = action.payload;

      // stop flags
      state.updatingCb = false;
      state.updatingLogistic = false;
      state.updatingWarehouse = false;
    },

    clearMarineError(state) {
      state.error = null;
    },

    // loading
    setUpdatingCb(state, action: PayloadAction<boolean>) {
      state.updatingCb = action.payload;
    },
    setUpdatingLogistic(state, action: PayloadAction<boolean>) {
      state.updatingLogistic = action.payload;
    },
    setUpdatingWarehouse(state, action: PayloadAction<boolean>) {
      state.updatingWarehouse = action.payload;
    },

    // success
    updateCbSuccess(state, action: PayloadAction<any>) {
      state.lastCbResponse = action.payload;
      state.updatingCb = false;
      state.error = null;
    },
    updateLogisticSuccess(state, action: PayloadAction<any>) {
      state.lastLogisticResponse = action.payload;
      state.updatingLogistic = false;
      state.error = null;
    },
    updateWarehouseSuccess(state, action: PayloadAction<any>) {
      state.lastWarehouseResponse = action.payload;
      state.updatingWarehouse = false;
      state.error = null;
    },

    resetMarineState(state) {
      state.updatingCb = false;
      state.updatingLogistic = false;
      state.updatingWarehouse = false;

      state.lastCbResponse = null;
      state.lastLogisticResponse = null;
      state.lastWarehouseResponse = null;

      state.error = null;
    },
  },
});

export const {
  marineError,
  clearMarineError,
  setUpdatingCb,
  setUpdatingLogistic,
  setUpdatingWarehouse,
  updateCbSuccess,
  updateLogisticSuccess,
  updateWarehouseSuccess,
  resetMarineState,
} = marineSlice.actions;

export default marineSlice.reducer;
