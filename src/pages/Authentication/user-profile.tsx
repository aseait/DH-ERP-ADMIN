import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Alert,
  CardBody,
  Button,
  Label,
  Input,
  FormFeedback,
  Form,
} from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from 'reselect';

import { editProfile, resetProfileFlag } from '../../slices/thunks';
import { buildApiUrl } from '../../helpers/apiBase';
import { useTT } from '../../helpers/useTT';

/** Types that reflect your backend login payload */
type AuthUser = {
  id?: number | string;
  user_id?: string;
  username?: string;
  account_name?: string;
  user_name?: string;
  department?: string;
  restriction?: number | string;
  contact_id?: number | string;
  contact_name?: string;
  company_name?: string;
  email?: string;
  create_time?: string;
};

const UserProfile = () => {
  const dispatch: any = useDispatch();
  const { tt } = useTT();

  /** ----- Select from Redux Profile slice ----- */
  // Adjust to your store keys if needed (e.g., state.profile instead of state.Profile)
  const selectProfile = (state: any) => state.Profile;
  const profileSelector = createSelector([selectProfile], (p) => ({
    user: p?.user || {},
    success: p?.success,
    error: p?.error,
  }));
  const { user: profileUser, success, error } = useSelector(profileSelector);

  /** ----- Helper: derive display values from an AuthUser ----- */
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
  const pickUsername = (u?: Partial<AuthUser> | null) =>
    u?.username || u?.email || '';
  const pickIdx = (u?: Partial<AuthUser> | null) =>
    String(u?.id || u?.user_id || u?.contact_id || '');

  /** ----- Local UI state (derived from Redux user, or sessionStorage fallback) ----- */
  const [displayName, setDisplayName] = useState<string>('User');
  const [username, setUsername] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [idx, setIdx] = useState<string>('');

  /** ----- Change password (self-service, requires current password) ----- */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const pwMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const pwSameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError(tt('changePassword.allFieldsRequired'));
      return;
    }
    if (pwMismatch) {
      setPwError(tt('changePassword.mismatch'));
      return;
    }
    if (pwSameAsCurrent) {
      setPwError(tt('changePassword.sameAsCurrent'));
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch(buildApiUrl('/adminUser/changePassword'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setPwError(data?.message || `${tt('changePassword.failed')} (HTTP ${res.status})`);
        return;
      }

      setPwSuccess(tt('changePassword.profileSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err?.message || tt('changePassword.failed'));
    } finally {
      setPwLoading(false);
    }
  };


  // On mount & whenever Redux profile user changes, compute display fields.
  useEffect(() => {
    // Prefer Redux Profile user if present
    const fromStore = (profileUser || {}) as Partial<AuthUser>;

    const applyUser = (u: Partial<AuthUser>) => {
      setDisplayName(pickDisplayName(u));
      setUsername(pickUsername(u));
      setDepartment(u.department || '');
      setIdx(pickIdx(u));
    };

    if (Object.keys(fromStore).length > 0) {
      applyUser(fromStore);
    } else {
      const raw = sessionStorage.getItem('authUser');
      if (raw) {
        try { applyUser(JSON.parse(raw)); } catch { /* ignore */ }
      }
    }
  }, [profileUser]);

  // Auto-clear success/error banner after 3s
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        dispatch(resetProfileFlag());
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [success, error, dispatch]);

  /** ----- Formik: only editing the display name (mapped to username for API) ----- */
  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      display_name: displayName || 'User',
      idx: idx || '1',
    },
    validationSchema: Yup.object({
      display_name: Yup.string().required('Please enter your user name'),
    }),
    onSubmit: (values) => {
      // Your editProfile thunk expects: { username, idx }
      dispatch(
        editProfile({
          username: values.display_name,
          idx: values.idx,
        })
      );
    },
  });

  return (
    <React.Fragment>
      <div className="page-content mt-lg-5">
        <Container fluid>
          <Row>
            <Col lg="12">
              {error ? <Alert color="danger">{String(error)}</Alert> : null}
              {success ? (
                <Alert color="success">Username updated to {validation.values.display_name}</Alert>
              ) : null}

              <Card>
                <CardBody>
                  <div className="d-flex">
                    <div className="mx-3">
                      <div
                        className="avatar-md rounded-circle img-thumbnail d-flex align-items-center justify-content-center"
                        style={{
                          fontWeight: 700,
                          fontSize: 20,
                          background: '#e9ecef',
                          color: '#495057',
                          userSelect: 'none',
                        }}
                        title={displayName}
                        aria-label="User Avatar"
                      >
                        {getInitials(displayName)}
                      </div>
                    </div>
                    <div className="flex-grow-1 align-self-center">
                      <div className="text-muted">
                        <h5>{displayName}</h5>
                        {username && <p className="mb-1">Email: {username}</p>}
                        {department && <p className="mb-1">Department: {department}</p>}
                        {idx && <p className="mb-0">ID: #{idx}</p>}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <h4 className="card-title mb-4">Change User Name</h4>

          <Card>
            <CardBody>
              <Form
                className="form-horizontal"
                onSubmit={(e) => {
                  e.preventDefault();
                  validation.handleSubmit();
                  return false;
                }}
              >
                <div className="form-group">
                  <Label className="form-label">User Name</Label>
                  <Input
                    name="display_name"
                    className="form-control"
                    placeholder="Enter User Name"
                    type="text"
                    disabled={true}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    value={validation.values.display_name || ''}
                    invalid={!!(validation.touched.display_name && validation.errors.display_name)}
                  />
                  {validation.touched.display_name && validation.errors.display_name ? (
                    <FormFeedback type="invalid">
                      {validation.errors.display_name as string}
                    </FormFeedback>
                  ) : null}

                  {/* Hidden field for idx (id to send) */}
                  <Input name="idx" value={validation.values.idx} type="hidden" readOnly />
                </div>

                <div className="text-center mt-4">
                  <Button type="submit" color="danger" disabled={true}>
                    Update User Name
                  </Button>
                </div>
              </Form>
            </CardBody>
          </Card>

          <h4 className="card-title mb-4">{tt('changePassword.title')}</h4>

          <Card>
            <CardBody>
              {pwError && <Alert color="danger">{pwError}</Alert>}
              {pwSuccess && <Alert color="success">{pwSuccess}</Alert>}

              <Form className="form-horizontal" onSubmit={handleChangePassword}>
                <div className="form-group mb-3">
                  <Label className="form-label">{tt('changePassword.currentPasswordGeneric')}</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder={tt('changePassword.currentPasswordGenericPlaceholder')}
                  />
                </div>

                <div className="form-group mb-3">
                  <Label className="form-label">{tt('changePassword.newPassword')}</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={tt('changePassword.newPasswordPlaceholder')}
                    invalid={pwSameAsCurrent}
                  />
                  {pwSameAsCurrent && <FormFeedback>{tt('changePassword.sameAsCurrent')}</FormFeedback>}
                  <div className="form-text">{tt('changePassword.requirements')}</div>
                </div>

                <div className="form-group mb-3">
                  <Label className="form-label">{tt('changePassword.confirmPassword')}</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={tt('changePassword.confirmPasswordPlaceholder')}
                    invalid={pwMismatch}
                  />
                  {pwMismatch && <FormFeedback>{tt('changePassword.mismatch')}</FormFeedback>}
                </div>

                <div className="form-check mb-3">
                  <Input
                    type="checkbox"
                    className="form-check-input"
                    id="profileShowPwCheck"
                    checked={showPw}
                    onChange={() => setShowPw((v) => !v)}
                  />
                  <Label className="form-check-label" htmlFor="profileShowPwCheck">
                    {tt('changePassword.showPasswords')}
                  </Label>
                </div>

                <div className="text-center mt-4">
                  <Button type="submit" color="primary" disabled={pwLoading}>
                    {tt('changePassword.submit')}
                  </Button>
                </div>
              </Form>
            </CardBody>
          </Card>
        </Container>
      </div>
    </React.Fragment>
  );
};

export default UserProfile;
