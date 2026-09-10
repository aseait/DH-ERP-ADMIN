import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { createSelector } from 'reselect';
import { useSelector } from 'react-redux';

/** ——— Types matching your backend response ——— */
type AuthUser = {
  id?: number | string;
  user_id?: string;
  username?: string;
  account_name?: string;
  user_name?: string;
  department?: string;
  restriction?: number | string;
  email?: string;
  company_name?: string;
  contact_id?: number | string;
  contact_name?: string;
  create_time?: string;
};

const ProfileDropdown = () => {
  const selectAccountSlice = (s: any) => s.Account; // if your store key is lowercase, change to s.account
  const accountUserSelector = useMemo(
    () =>
      createSelector([selectAccountSlice], (account) => {
        return (account?.user as Partial<AuthUser>) || {};
      }),
    []
  );

  const userFromRedux = useSelector(accountUserSelector);

  /** ===== Derive a friendly display name ===== */
  const pickDisplayName = (u?: Partial<AuthUser> | null) => {
    if (!u) return 'User';
    return (
      u.account_name ||
      u.user_name ||
      u.contact_name ||
      u.company_name ||
      (u.email ? u.email.split('@')[0] : '') ||
      'User'
    );
  };

  const getInitials = (name: string) => {
    const cleaned = (name || '').trim();
    if (!cleaned) return 'U';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') || '';
    return (first + last).toUpperCase();
  };

  /** ===== Dropdown open/close ===== */
  const [isProfileDropdown, setIsProfileDropdown] = useState(false);
  const toggleProfileDropdown = () => setIsProfileDropdown((v) => !v);

  /**
   *  Unify user source:
   * - Prefer Redux user (after login)
   * - Fallback to sessionStorage user (after refresh)
   */
  const [user, setUser] = useState<Partial<AuthUser>>({});

  useEffect(() => {
    // 1) Prefer Redux
    if (userFromRedux && Object.keys(userFromRedux).length > 0) {
      setUser(userFromRedux);
      return;
    }

    // 2) Fallback: sessionStorage
    const raw = sessionStorage.getItem('authUser');
    if (raw) {
      try {
        const parsed: Partial<AuthUser> = JSON.parse(raw);
        setUser(parsed || {});
      } catch {
        setUser({});
      }
    }
  }, [userFromRedux]);

  /** ===== Derived UI strings ===== */
  const userName = pickDisplayName(user);
  const emailName = user?.email;

  return (
    <React.Fragment>
      <Dropdown
        isOpen={isProfileDropdown}
        toggle={toggleProfileDropdown}
        className="ms-sm-3 header-item topbar-user"
      >
        <DropdownToggle tag="button" type="button" className="btn">
          <span className="d-flex align-items-center">
            {/* Initials Avatar */}
            <div
              className="rounded-circle header-profile-user d-flex align-items-center justify-content-center"
              style={{
                width: 32,
                height: 32,
                fontWeight: 700,
                fontSize: 12,
                background: '#e9ecef',
                color: '#495057',
                userSelect: 'none',
              }}
              aria-label="User Avatar"
              title={userName}
            >
              {getInitials(userName)}
            </div>

            <span className="text-start ms-xl-2">
              <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">
                {userName}
              </span>

              {/* Subtitle: use email name */}
              <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">
                {emailName}
              </span>
            </span>
          </span>
        </DropdownToggle>

        <DropdownMenu className="dropdown-menu-end">
          <h6 className="dropdown-header">Welcome {userName}!</h6>

          <DropdownItem className="p-0">
            <Link to="/profile" className="dropdown-item">
              <i className="mdi mdi-account-circle text-muted fs-16 align-middle me-1"></i>
              <span className="align-middle">Profile</span>
            </Link>
          </DropdownItem>

          {/*<DropdownItem className="p-0">*/}
          {/*    <Link to="/apps-chat" className="dropdown-item">*/}
          {/*        <i className="mdi mdi-message-text-outline text-muted fs-16 align-middle me-1"></i>*/}
          {/*        <span className="align-middle">Messages</span>*/}
          {/*    </Link>*/}
          {/*</DropdownItem>*/}

          {/*<DropdownItem className="p-0">*/}
          {/*    <Link to="#" className="dropdown-item">*/}
          {/*        <i className="mdi mdi-calendar-check-outline text-muted fs-16 align-middle me-1"></i>*/}
          {/*        <span className="align-middle">Taskboard</span>*/}
          {/*    </Link>*/}
          {/*</DropdownItem>*/}

          {/*<DropdownItem className="p-0">*/}
          {/*    <Link to="/pages-faqs" className="dropdown-item">*/}
          {/*        <i className="mdi mdi-lifebuoy text-muted fs-16 align-middle me-1"></i>*/}
          {/*        <span className="align-middle">Help</span>*/}
          {/*    </Link>*/}
          {/*</DropdownItem>*/}

          {/*      <div className="dropdown-divider"></div>*/}

          {/*      <DropdownItem className="p-0">*/}
          {/*          <Link to="/pages-profile" className="dropdown-item">*/}
          {/*              <i className="mdi mdi-wallet text-muted fs-16 align-middle me-1"></i>*/}
          {/*              <span className="align-middle">*/}
          {/*  Balance : <b>$5971.67</b>*/}
          {/*</span>*/}
          {/*          </Link>*/}
          {/*      </DropdownItem>*/}

          {/*      <DropdownItem className="p-0">*/}
          {/*          <Link to="/pages-profile-settings" className="dropdown-item">*/}
          {/*<span className="badge bg-success-subtle text-success mt-1 float-end">*/}
          {/*  New*/}
          {/*</span>*/}
          {/*              <i className="mdi mdi-cog-outline text-muted fs-16 align-middle me-1"></i>*/}
          {/*              <span className="align-middle">Settings</span>*/}
          {/*          </Link>*/}
          {/*      </DropdownItem>*/}

          {/*      <DropdownItem className="p-0">*/}
          {/*          <Link to="/auth-lockscreen-basic" className="dropdown-item">*/}
          {/*              <i className="mdi mdi-lock text-muted fs-16 align-middle me-1"></i>*/}
          {/*              <span className="align-middle">Lock screen</span>*/}
          {/*          </Link>*/}
          {/*      </DropdownItem>*/}

          <DropdownItem className="p-0">
            <Link to="/logout" className="dropdown-item">
              <i className="mdi mdi-logout text-muted fs-16 align-middle me-1"></i>
              <span className="align-middle">Logout</span>
            </Link>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </React.Fragment>
  );
};

export default ProfileDropdown;
