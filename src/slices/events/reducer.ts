import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type EventTrackingState = {
  list: any[];
  raw: any;
  loading: boolean;
  error: string;
  errorMsg: boolean;
};

export const initialState: EventTrackingState = {
  list: [],
  raw: null,
  loading: false,
  error: '',
  errorMsg: false,
};

const eventTrackingSlice = createSlice({
  name: 'eventTracking',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
      state.errorMsg = true;
    },
    eventTrackingSuccess(state, action: PayloadAction<any>) {
      state.raw = action.payload;
      state.list = Array.isArray(action.payload?.data) ? action.payload.data : [];
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
    reset_event_tracking_flag(state) {
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    clearEventTracking(state) {
      state.list = [];
      state.raw = null;
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  apiError,
  eventTrackingSuccess,
  reset_event_tracking_flag,
  setLoading,
  clearEventTracking,
} = eventTrackingSlice.actions;

export default eventTrackingSlice.reducer;
