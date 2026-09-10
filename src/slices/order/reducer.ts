import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type OrderState = {
  cities: any[];
  loadingCities: boolean;

  creatingMarine: boolean;
  creatingAir: boolean;
  creatingParse: boolean;

  lastMarineResponse: any | null;
  lastAirResponse: any | null;
  lastParseResponse: any | null;

  error: string;
  errorMsg: boolean;
};

export const initialState: OrderState = {
  cities: [],
  loadingCities: false,

  creatingMarine: false,
  creatingAir: false,
  creatingParse: false,

  lastMarineResponse: null,
  lastAirResponse: null,
  lastParseResponse: null,

  error: '',
  errorMsg: false,
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.errorMsg = true;

      // stop all loading flags on error (safe default)
      state.loadingCities = false;
      state.creatingMarine = false;
      state.creatingAir = false;
      state.creatingParse = false;
    },

    resetOrderState(state) {
      state.lastMarineResponse = null;
      state.lastAirResponse = null;
      state.lastParseResponse = null;

      state.error = '';
      state.errorMsg = false;

      // do not force-stop loading here; keep it minimal/neutral
    },

    clearOrder(state) {
      state.cities = [];
      state.loadingCities = false;

      state.creatingMarine = false;
      state.creatingAir = false;
      state.creatingParse = false;

      state.lastMarineResponse = null;
      state.lastAirResponse = null;
      state.lastParseResponse = null;

      state.error = '';
      state.errorMsg = false;
    },

    setLoadingCities(state, action: PayloadAction<boolean>) {
      state.loadingCities = action.payload;
    },
    setCreatingMarine(state, action: PayloadAction<boolean>) {
      state.creatingMarine = action.payload;
    },
    setCreatingAir(state, action: PayloadAction<boolean>) {
      state.creatingAir = action.payload;
    },
    setCreatingParse(state, action: PayloadAction<boolean>) {
      state.creatingParse = action.payload;
    },

    fetchCitiesSuccess(state, action: PayloadAction<any[]>) {
      state.cities = action.payload || [];
      state.loadingCities = false;
      state.error = '';
      state.errorMsg = false;
    },

    createMarineMainTicketSuccess(state, action: PayloadAction<any>) {
      state.lastMarineResponse = action.payload;
      state.creatingMarine = false;
      state.error = '';
      state.errorMsg = false;
    },

    createAirMainTicketSuccess(state, action: PayloadAction<any>) {
      state.lastAirResponse = action.payload;
      state.creatingAir = false;
      state.error = '';
      state.errorMsg = false;
    },

    createParseMainTicketSuccess(state, action: PayloadAction<any>) {
      state.lastParseResponse = action.payload;
      state.creatingParse = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  apiError,
  resetOrderState,
  clearOrder,
  setLoadingCities,
  setCreatingMarine,
  setCreatingAir,
  setCreatingParse,
  fetchCitiesSuccess,
  createMarineMainTicketSuccess,
  createAirMainTicketSuccess,
  createParseMainTicketSuccess,
} = orderSlice.actions;

export default orderSlice.reducer;
