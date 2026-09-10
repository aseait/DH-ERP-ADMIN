import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ImporterName = { id: number | string; Name: string };

export type FilesState = {
  // Retrieve files
  retrievingFiles: boolean;
  files: any[];

  // Upload files (Marine/Air)
  uploadingMarineAir: boolean;
  lastUploadMarineAirResponse: any | null;

  // Upload files (Truck)
  uploadingTruck: boolean;
  lastUploadTruckResponse: any | null;

  // POA
  uploadingPoa: boolean;
  retrievingPoa: boolean;
  poaFiles: any[];
  lastUploadPoaResponse: any | null;

  // Importer list
  loadingImporterNames: boolean;
  importerNames: ImporterName[];

  // Common error
  error: string;
  errorMsg: boolean;
};

export const initialState: FilesState = {
  retrievingFiles: false,
  files: [],

  uploadingMarineAir: false,
  lastUploadMarineAirResponse: null,

  uploadingTruck: false,
  lastUploadTruckResponse: null,

  uploadingPoa: false,
  retrievingPoa: false,
  poaFiles: [],
  lastUploadPoaResponse: null,

  loadingImporterNames: false,
  importerNames: [],

  error: '',
  errorMsg: false,
};

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.errorMsg = true;

      // stop all loading flags on error (safe default)
      state.retrievingFiles = false;
      state.uploadingMarineAir = false;
      state.uploadingTruck = false;
      state.uploadingPoa = false;
      state.retrievingPoa = false;
      state.loadingImporterNames = false;
    },

    resetFilesState(state) {
      state.lastUploadMarineAirResponse = null;
      state.lastUploadTruckResponse = null;
      state.lastUploadPoaResponse = null;

      state.error = '';
      state.errorMsg = false;
      // keep lists & loading neutral
    },

    clearFiles(state) {
      state.retrievingFiles = false;
      state.files = [];

      state.uploadingMarineAir = false;
      state.lastUploadMarineAirResponse = null;

      state.uploadingTruck = false;
      state.lastUploadTruckResponse = null;

      state.uploadingPoa = false;
      state.retrievingPoa = false;
      state.poaFiles = [];
      state.lastUploadPoaResponse = null;

      // importer list
      state.loadingImporterNames = false;
      state.importerNames = [];

      state.error = '';
      state.errorMsg = false;
    },

    // loading flags
    setRetrievingFiles(state, action: PayloadAction<boolean>) {
      state.retrievingFiles = action.payload;
    },
    setUploadingMarineAir(state, action: PayloadAction<boolean>) {
      state.uploadingMarineAir = action.payload;
    },
    setUploadingTruck(state, action: PayloadAction<boolean>) {
      state.uploadingTruck = action.payload;
    },
    setUploadingPoa(state, action: PayloadAction<boolean>) {
      state.uploadingPoa = action.payload;
    },
    setRetrievingPoa(state, action: PayloadAction<boolean>) {
      state.retrievingPoa = action.payload;
    },

    // importer loading
    setLoadingImporterNames(state, action: PayloadAction<boolean>) {
      state.loadingImporterNames = action.payload;
    },

    // success reducers
    retrieveFilesSuccess(state, action: PayloadAction<any[]>) {
      state.files = action.payload || [];
      state.retrievingFiles = false;
      state.error = '';
      state.errorMsg = false;
    },

    uploadMarineAirFilesSuccess(state, action: PayloadAction<any>) {
      state.lastUploadMarineAirResponse = action.payload;
      state.uploadingMarineAir = false;
      state.error = '';
      state.errorMsg = false;
    },

    uploadTruckFilesSuccess(state, action: PayloadAction<any>) {
      state.lastUploadTruckResponse = action.payload;
      state.uploadingTruck = false;
      state.error = '';
      state.errorMsg = false;
    },

    uploadPoaSuccess(state, action: PayloadAction<any>) {
      state.lastUploadPoaResponse = action.payload;
      state.uploadingPoa = false;
      state.error = '';
      state.errorMsg = false;
    },

    getPoaFileSuccess(state, action: PayloadAction<any[]>) {
      state.poaFiles = action.payload || [];
      state.retrievingPoa = false;
      state.error = '';
      state.errorMsg = false;
    },

    fetchImporterNamesSuccess(
      state,
      action: PayloadAction<{ message?: string; data?: ImporterName[] } | ImporterName[]>
    ) {
      const list = Array.isArray(action.payload) ? action.payload : (action.payload?.data ?? []);

      state.importerNames = Array.isArray(list) ? list : [];
      state.loadingImporterNames = false;
      state.error = '';
      state.errorMsg = false;
    },
  },
});

export const {
  apiError,
  resetFilesState,
  clearFiles,

  setRetrievingFiles,
  setUploadingMarineAir,
  setUploadingTruck,
  setUploadingPoa,
  setRetrievingPoa,

  setLoadingImporterNames,
  fetchImporterNamesSuccess,

  retrieveFilesSuccess,
  uploadMarineAirFilesSuccess,
  uploadTruckFilesSuccess,
  uploadPoaSuccess,
  getPoaFileSuccess,
} = filesSlice.actions;

export default filesSlice.reducer;
