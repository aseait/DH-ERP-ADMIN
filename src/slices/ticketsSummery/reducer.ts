import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type TicketSummaryPayload = {
  x: string[];
  y: number[];
};

export type TicketSummaryResult = {
  message?: string;
  data?: TicketSummaryPayload;
};

export type TicketSummaryState = {
  result: TicketSummaryResult | null;
  loading: boolean;
  error: string;
  errorMsg: boolean;
};

export const initialState: TicketSummaryState = {
  result: null,
  loading: false,
  error: '',
  errorMsg: false,
};

const ticketSummarySlice = createSlice({
  name: 'ticketSummary',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
      state.errorMsg = true;
    },
    ticketSummarySuccess(state, action: PayloadAction<TicketSummaryResult>) {
      state.result = action.payload;
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
    reset_ticket_summary_flag(state) {
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    clearTicketSummary(state) {
      state.result = null;
      state.loading = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  apiError,
  ticketSummarySuccess,
  reset_ticket_summary_flag,
  setLoading,
  clearTicketSummary,
} = ticketSummarySlice.actions;

export default ticketSummarySlice.reducer;
