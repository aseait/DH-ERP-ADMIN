import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MarineContainerEvent = {
  id?: number | string;
  container_number?: string;
  event_time?: string; // already converted server-side to Toronto time
  event_type?: string;
  event_description?: string;
  location?: string;
  [k: string]: any;
};

export type MarineContainerEventsState = {
  loading: boolean;
  error: string | null;
  events: MarineContainerEvent[];
  lastQuery: { container_number?: string } | null;
};

const initialState: MarineContainerEventsState = {
  loading: false,
  error: null,
  events: [],
  lastQuery: null,
};

const marineContainerEventsSlice = createSlice({
  name: 'marineContainerEvents',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
    },
    clearError(state) {
      state.error = null;
    },
    fetchSuccess(
      state,
      action: PayloadAction<{
        events: MarineContainerEvent[];
        query: { container_number?: string } | null;
      }>
    ) {
      state.events = action.payload.events;
      state.lastQuery = action.payload.query;
      state.loading = false;
      state.error = null;
    },
    resetState() {
      return initialState;
    },
  },
});

export const { setLoading, apiError, clearError, fetchSuccess, resetState } =
  marineContainerEventsSlice.actions;

export default marineContainerEventsSlice.reducer;
