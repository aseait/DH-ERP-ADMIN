import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AirState = {
  updatingCb: boolean;
  updatingLogistic: boolean;
  updatingWarehouse: boolean;

  lastCbResponse: any | null;
  lastLogisticResponse: any | null;
  lastWarehouseResponse: any | null;

  error: string;
  errorMsg: boolean;
};

export const initialState: AirState = {
  updatingCb: false,
  updatingLogistic: false,
  updatingWarehouse: false,

  lastCbResponse: null,
  lastLogisticResponse: null,
  lastWarehouseResponse: null,

  error: '',
  errorMsg: false,
};

const airSlice = createSlice({
  name: 'air',
  initialState,
  reducers: {
    airApiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.errorMsg = true;

      state.updatingCb = false;
      state.updatingLogistic = false;
      state.updatingWarehouse = false;
    },

    clearAirState(state) {
      state.updatingCb = false;
      state.updatingLogistic = false;
      state.updatingWarehouse = false;

      state.lastCbResponse = null;
      state.lastLogisticResponse = null;
      state.lastWarehouseResponse = null;

      state.error = '';
      state.errorMsg = false;
    },

    setUpdatingCb(state, action: PayloadAction<boolean>) {
      state.updatingCb = action.payload;
    },
    setUpdatingLogistic(state, action: PayloadAction<boolean>) {
      state.updatingLogistic = action.payload;
    },
    setUpdatingWarehouse(state, action: PayloadAction<boolean>) {
      state.updatingWarehouse = action.payload;
    },

    updateAirCbSuccess(state, action: PayloadAction<any>) {
      state.lastCbResponse = action.payload;
      state.updatingCb = false;
      state.error = '';
      state.errorMsg = false;
    },

    updateAirLogisticSuccess(state, action: PayloadAction<any>) {
      state.lastLogisticResponse = action.payload;
      state.updatingLogistic = false;
      state.error = '';
      state.errorMsg = false;
    },

    updateAirWarehouseSuccess(state, action: PayloadAction<any>) {
      state.lastWarehouseResponse = action.payload;
      state.updatingWarehouse = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  airApiError,
  clearAirState,

  setUpdatingCb,
  setUpdatingLogistic,
  setUpdatingWarehouse,

  updateAirCbSuccess,
  updateAirLogisticSuccess,
  updateAirWarehouseSuccess,
} = airSlice.actions;

export default airSlice.reducer;
