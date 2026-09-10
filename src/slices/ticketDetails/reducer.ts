import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MainTicketDetailsState = {
  result: any;
  loading: boolean;
  error: string;
  errorMsg: boolean;
  latestRequestId: number;
};

export const initialState: MainTicketDetailsState = {
  result: null,
  loading: false,
  error: '',
  errorMsg: false,
  latestRequestId: 0,
};

const mainTicketDetailsSlice = createSlice({
  name: 'mainTicketDetails',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
      state.errorMsg = true;
    },
    mainTicketDetailsSuccess(state, action: PayloadAction<{ data: any; requestId: number }>) {
      const { data, requestId } = action.payload;
      // A slower, older request (e.g. the page's initial mount fetch) can resolve
      // after a newer one (e.g. the fetch issued right after a Save). Without this
      // guard the stale response silently wins and reverts the screen back to
      // pre-save values, which looks exactly like "my save didn't stick".
      if (requestId < state.latestRequestId) return;
      state.latestRequestId = requestId;
      state.result = data;
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
    reset_main_ticket_details_flag(state) {
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    clearMainTicketDetails(state) {
      state.result = null;
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  apiError,
  mainTicketDetailsSuccess,
  reset_main_ticket_details_flag,
  setLoading,
  clearMainTicketDetails,
} = mainTicketDetailsSlice.actions;

export default mainTicketDetailsSlice.reducer;
