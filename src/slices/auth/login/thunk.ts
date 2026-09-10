// login thunk (runtime-only API base)
import { loginSuccess, logoutUserSuccess, apiError, reset_login_flag, setLoading } from './reducer';

const RUNTIME_BASE = typeof window !== 'undefined' ? window.__APP_CONFIG__?.API_BASE?.trim() : '';

const API_BASE = (RUNTIME_BASE && RUNTIME_BASE.replace(/\/+$/, '')) || '';

function extractAuthPayload(data: any): { user?: any; token?: string } {
  // Admin login returns { message, user } with no token
  if (data?.user && (data.user.id || data.user.user_id)) {
    return { user: data.user, token: data.token || data.accessToken };
  }
  if (data?.data?.user) {
    return { user: data.data.user, token: data.data.token || data.data.accessToken };
  }
  if (data?.token || data?.accessToken) {
    return { user: data.profile || data.user, token: data.token || data.accessToken };
  }
  return { user: undefined, token: undefined };
}

export const loginUser =
  (payload: { username: string; password: string }, navigate: any, redirectTo?: string) =>
  async (dispatch: any) => {
    try {
      if (!API_BASE) {
        dispatch(
          apiError(
            'API base URL is missing. Provide it in public/config.js (window.__APP_CONFIG__.API_BASE).'
          )
        );
        return;
      }

      dispatch(setLoading(true));

      const res = await fetch(`${API_BASE}/adminUser/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        let msg = data?.message || `Login failed (HTTP ${res.status})`;
        if (res.status === 401) msg = 'Unauthorized: wrong username or password.';
        else if (res.status === 404)
          msg = 'Network/Internet error. Please check your connection and try again.';
        else if (res.status === 500) msg = 'Server error. Please try again later.';
        dispatch(apiError(msg));
        return;
      }

      if (data?.must_change_password) {
        dispatch(setLoading(false));
        sessionStorage.setItem('pendingPasswordChangeUser', payload.username);
        navigate('/change-required-password');
        return;
      }

      const { user, token } = extractAuthPayload(data);
      if (!user) {
        dispatch(apiError('Login response did not include a user object.'));
        return;
      }

      sessionStorage.setItem('authUser', JSON.stringify(user));
      if (token) sessionStorage.setItem('authToken', token);

      dispatch(loginSuccess(user));
      navigate(redirectTo || '/work');
    } catch (err: any) {
      dispatch(apiError(err?.message || 'Network error'));
    }
  };

export const logoutUser = () => async (dispatch: any) => {
  try {
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('authToken');
    dispatch(logoutUserSuccess(true));
  } catch (error: any) {
    dispatch(apiError(String(error)));
  }
};

export const resetLoginFlag = () => async (dispatch: any) => {
  try {
    return dispatch(reset_login_flag());
  } catch (error: any) {
    dispatch(apiError(String(error)));
  }
};

export const socialLogin = () => async (dispatch: any) => {
  dispatch(apiError('Social login not enabled.'));
};
