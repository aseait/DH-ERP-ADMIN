import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ChangeServiceState = {
  submitting: boolean;
  error: string | null;
  success: boolean;
  data: any;
};

const initialState: ChangeServiceState = {
  submitting: false,
  error: null,
  success: false,
  data: null,
};

const changeServiceSlice = createSlice({
  name: 'ChangeService',
  initialState,
  reducers: {
    setSubmitting(state, action: PayloadAction<boolean>) {
      state.submitting = action.payload;
    },
    changeServiceError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.success = false;
    },
    changeServiceSuccess(state, action: PayloadAction<any>) {
      state.data = action.payload;
      state.success = true;
      state.error = null;
    },
    resetChangeService(state) {
      state.submitting = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
});

export const { setSubmitting, changeServiceError, changeServiceSuccess, resetChangeService } =
  changeServiceSlice.actions;

export default changeServiceSlice.reducer;
