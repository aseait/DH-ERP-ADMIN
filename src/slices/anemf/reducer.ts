import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AnEmfState = {
  uploading: boolean;
  lastUploadResponse: any | null;
  error: string;
  errorMsg: boolean;
};

export const initialState: AnEmfState = {
  uploading: false,
  lastUploadResponse: null,
  error: '',
  errorMsg: false,
};

const anEmfSlice = createSlice({
  name: 'anEmf',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.errorMsg = true;
      state.uploading = false;
    },

    resetAnEmfState(state) {
      state.uploading = false;
      state.lastUploadResponse = null;
      state.error = '';
      state.errorMsg = false;
    },

    clearAnEmfState(state) {
      state.uploading = false;
      state.lastUploadResponse = null;
      state.error = '';
      state.errorMsg = false;
    },

    setUploading(state, action: PayloadAction<boolean>) {
      state.uploading = action.payload;
    },

    uploadMarineCbAnEmfOnlySuccess(state, action: PayloadAction<any>) {
      state.lastUploadResponse = action.payload;
      state.uploading = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  apiError,
  resetAnEmfState,
  clearAnEmfState,
  setUploading,
  uploadMarineCbAnEmfOnlySuccess,
} = anEmfSlice.actions;

export default anEmfSlice.reducer;
