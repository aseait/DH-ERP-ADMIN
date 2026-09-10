import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type TrainTrackingEvent = {
  id?: number | string;
  container_number?: string;
  event_time?: string;
  train_eta?: string;
  pickup_container_date?: string;
  return_container_date?: string;
  event_type?: string;
  location?: string;
  event_description?: string;
  [k: string]: any;
};

export type TrainTrackingState = {
  loading: boolean;
  error: string | null;
  events: TrainTrackingEvent[];
};

const initialState: TrainTrackingState = {
  loading: false,
  error: null,
  events: [],
};

const trainTrackingSlice = createSlice({
  name: 'trainTracking',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
    },
    fetchSuccess(state, action: PayloadAction<TrainTrackingEvent[]>) {
      state.events = action.payload;
      state.loading = false;
      state.error = null;
    },
    resetState() {
      return initialState;
    },
  },
});

export const { setLoading, apiError, fetchSuccess, resetState } = trainTrackingSlice.actions;
export default trainTrackingSlice.reducer;
