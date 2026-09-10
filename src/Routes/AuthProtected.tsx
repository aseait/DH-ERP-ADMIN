import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { setAuthorization } from '../helpers/api_helper';
import { buildApiUrl } from '../helpers/apiBase';
import { useDispatch } from 'react-redux';

import { useProfile } from '../Components/Hooks/UserHooks';

import { logoutUser } from '../slices/auth/login/thunk';

const AuthProtected = (props: any) => {
  const dispatch: any = useDispatch();
  const location = useLocation();
  const { userProfile, loading, token } = useProfile();
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    if (userProfile && !loading && token) {
      setAuthorization(token);
    } else if (!userProfile && loading && !token) {
      dispatch(logoutUser());
    }
  }, [token, userProfile, loading, dispatch]);

  // Force-logout an already-open session once must_change_password flips
  // to true on the backend, instead of only checking at login time.
  // Checked once per protected-page load (not on a recurring timer).
  useEffect(() => {
    const username = userProfile?.username || userProfile?.email;
    if (!username) return;

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch(buildApiUrl('/adminUser/passwordStatus'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.must_change_password) {
          sessionStorage.setItem('pendingPasswordChangeUser', username);
          dispatch(logoutUser());
          setMustChangePassword(true);
        }
      } catch {
        // Network hiccup: leave the session alone for this page load.
      }
    };

    checkStatus();

    return () => {
      cancelled = true;
    };
  }, [userProfile, dispatch]);

  /*
    Navigate is un-auth access protected routes via url
    */

  if (mustChangePassword) {
    return <Navigate to={{ pathname: '/change-required-password' }} />;
  }

  if (!userProfile && loading && !token) {
    // Remember where the user was headed (e.g. a shared /support/tickets/:ticketNumber
    // link) so Login can send them back there instead of always landing on /work.
    return <Navigate to="/login" state={{ from: location }} />;
  }

  return <>{props.children}</>;
};

export default AuthProtected;
