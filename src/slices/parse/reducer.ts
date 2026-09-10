import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type TruckUpdateState = {
  updating: boolean;
  error: string;

  // last responses (useful for UI)
  lastCbUpdate: any | null;
  lastLogisticUpdate: any | null;
  lastUsToCaUpdate: any | null;
};

const initialState: TruckUpdateState = {
  updating: false,
  error: '',
  lastCbUpdate: null,
  lastLogisticUpdate: null,
  lastUsToCaUpdate: null,
};

const truckSlice = createSlice({
  name: 'Truck',
  initialState,
  reducers: {
    setTruckUpdating(state, action: PayloadAction<boolean>) {
      state.updating = action.payload;
    },
    setTruckUpdateError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },

    updateTruckCbContainerSuccess(state, action: PayloadAction<any>) {
      state.lastCbUpdate = action.payload;
    },
    updateTruckLogisticSuccess(state, action: PayloadAction<any>) {
      state.lastLogisticUpdate = action.payload;
    },
    updateTruckUsToCaSuccess(state, action: PayloadAction<any>) {
      state.lastUsToCaUpdate = action.payload;
    },
  },
});

export const {
  setTruckUpdating,
  setTruckUpdateError,
  updateTruckCbContainerSuccess,
  updateTruckLogisticSuccess,
  updateTruckUsToCaSuccess,
} = truckSlice.actions;

export default truckSlice.reducer;
