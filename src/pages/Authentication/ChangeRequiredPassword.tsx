import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Label, Button, Form, FormFeedback, Alert, Spinner } from 'reactstrap';
import { buildApiUrl } from '../../helpers/apiBase';
import { useTT } from '../../helpers/useTT';
import LanguageDropdown from '../../Components/Common/LanguageDropdown';
import loginBg from '../../assets/images/login-bg.png';

const ChangeRequiredPassword = () => {
  const { tt } = useTT();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const pendingUser = sessionStorage.getItem('pendingPasswordChangeUser');
    if (!pendingUser) {
      navigate('/login');
      return;
    }
    setUsername(pendingUser);
  }, [navigate]);

  document.title = 'DH SUPPLY CHAIN | Change Password';

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setApiError(tt('changePassword.allFieldsRequired'));
      return;
    }
    if (mismatch) {
      setApiError(tt('changePassword.mismatch'));
      return;
    }
    if (sameAsCurrent) {
      setApiError(tt('changePassword.sameAsCurrent'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/adminUser/changeRequiredPassword'), {
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
        setApiError(data?.message || `${tt('changePassword.failed')} (HTTP ${res.status})`);
        return;
      }

      sessionStorage.removeItem('pendingPasswordChangeUser');
      setSuccess(tt('changePassword.success'));
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setApiError(err?.message || tt('changePassword.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-layout">
      <div className="login-split-left">
        <img src={loginBg} alt="" className="login-split-bg" />
      </div>

      <div className="login-split-right">
        <div className="login-split-inner">
          <div className="login-split-card">
            <div className="login-title-wrap mb-3">
              <div className="login-title-lang">
                <LanguageDropdown />
              </div>
              <div className="text-center">
                <h5 className="text-primary">{tt('changePassword.title')}</h5>
                <p className="text-muted">{tt('changePassword.subtitle')}</p>
              </div>
            </div>

            {apiError && <Alert color="danger">{apiError}</Alert>}
            {success && <Alert color="success">{success}</Alert>}

            <div className="p-2 mt-4">
              <Form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <Label className="form-label">{tt('changePassword.currentPassword')}</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder={tt('changePassword.currentPasswordPlaceholder')}
                  />
                </div>

                <div className="mb-3">
                  <Label className="form-label">{tt('changePassword.newPassword')}</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={tt('changePassword.newPasswordPlaceholder')}
                    invalid={sameAsCurrent}
                  />
                  {sameAsCurrent && <FormFeedback>{tt('changePassword.sameAsCurrent')}</FormFeedback>}
                  <div className="form-text">{tt('changePassword.requirements')}</div>
                </div>

                <div className="mb-3">
                  <Label className="form-label">{tt('changePassword.confirmPassword')}</Label>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={tt('changePassword.confirmPasswordPlaceholder')}
                    invalid={mismatch}
                  />
                  {mismatch && <FormFeedback>{tt('changePassword.mismatch')}</FormFeedback>}
                </div>

                <div className="form-check mb-3">
                  <Input
                    type="checkbox"
                    className="form-check-input"
                    id="showPwCheck"
                    checked={showPw}
                    onChange={() => setShowPw((v) => !v)}
                  />
                  <Label className="form-check-label" htmlFor="showPwCheck">
                    {tt('changePassword.showPasswords')}
                  </Label>
                </div>

                <div className="mt-4">
                  <Button color="success" disabled={loading} className="btn btn-success w-100" type="submit">
                    {loading && (
                      <Spinner size="sm" className="me-2">
                        Loading...
                      </Spinner>
                    )}
                    {tt('changePassword.submit')}
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeRequiredPassword;
