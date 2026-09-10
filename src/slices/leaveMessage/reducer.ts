import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type LeaveMessageState = {
  posting: boolean;
  retrieving: boolean;
  markingRead: boolean;

  lastPostResponse: any | null;
  lastRetrieveResponse: any | null;
  lastMarkReadResponse: any | null;

  messages: any[]; // cached list from retrieve

  error: string | null;
};

export const initialState: LeaveMessageState = {
  posting: false,
  retrieving: false,
  markingRead: false,

  lastPostResponse: null,
  lastRetrieveResponse: null,
  lastMarkReadResponse: null,

  messages: [],

  error: null,
};

const leaveMessageSlice = createSlice({
  name: 'leaveMessage',
  initialState,
  reducers: {
    leaveMessageError(state, action: PayloadAction<string>) {
      state.error = action.payload;

      state.posting = false;
      state.retrieving = false;
      state.markingRead = false;
    },

    clearLeaveMessageError(state) {
      state.error = null;
    },

    setPosting(state, action: PayloadAction<boolean>) {
      state.posting = action.payload;
    },
    setRetrieving(state, action: PayloadAction<boolean>) {
      state.retrieving = action.payload;
    },
    setMarkingRead(state, action: PayloadAction<boolean>) {
      state.markingRead = action.payload;
    },

    postMessageSuccess(state, action: PayloadAction<any>) {
      state.lastPostResponse = action.payload;
      state.posting = false;
      state.error = null;
    },

    retrieveMessagesSuccess(state, action: PayloadAction<any>) {
      state.lastRetrieveResponse = action.payload;
      state.retrieving = false;
      state.error = null;

      const list = action.payload?.data;
      state.messages = Array.isArray(list) ? list : [];
    },

    markReadSuccess(state, action: PayloadAction<any>) {
      state.lastMarkReadResponse = action.payload;
      state.markingRead = false;
      state.error = null;

      // optional: update cached list
      const ids: any[] = action.payload?.note_ids;
      if (Array.isArray(ids) && ids.length) {
        state.messages = state.messages.map((m: any) =>
          ids.includes(m.note_id) ? { ...m, read_status_user: 1 } : m
        );
      }
    },

    resetLeaveMessageState(state) {
      state.posting = false;
      state.retrieving = false;
      state.markingRead = false;

      state.lastPostResponse = null;
      state.lastRetrieveResponse = null;
      state.lastMarkReadResponse = null;

      state.messages = [];
      state.error = null;
    },
  },
});

export const {
  leaveMessageError,
  clearLeaveMessageError,

  setPosting,
  setRetrieving,
  setMarkingRead,

  postMessageSuccess,
  retrieveMessagesSuccess,
  markReadSuccess,

  resetLeaveMessageState,
} = leaveMessageSlice.actions;

export default leaveMessageSlice.reducer;
