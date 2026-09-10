import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type LoginUser = {
  user_id?: string;
  user_name?: string;
  email?: string;
  company_name?: string;
  contact_id?: number | string;
  contact_name?: string;
  create_time?: string;
};

export type LoginState = {
  user: Partial<LoginUser>;
  error: string;
  loading: boolean;
  isUserLogout: boolean;
  errorMsg: boolean;
};

export const initialState: LoginState = {
  user: {},
  error: '',
  loading: false,
  isUserLogout: false,
  errorMsg: false,
};

const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    apiError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
      state.isUserLogout = false;
      state.errorMsg = true;
    },
    loginSuccess(state, action: PayloadAction<LoginUser>) {
      state.user = action.payload;
      state.loading = false;
      state.errorMsg = false;
    },
    logoutUserSuccess(state, action: PayloadAction<boolean>) {
      state.isUserLogout = action.payload;
    },
    reset_login_flag(state) {
      state.error = '';
      state.loading = false;
      state.errorMsg = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { apiError, loginSuccess, logoutUserSuccess, reset_login_flag, setLoading } =
  loginSlice.actions;

export default loginSlice.reducer;
