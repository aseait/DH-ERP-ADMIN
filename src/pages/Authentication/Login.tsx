import React, { useEffect, useRef, useState } from 'react';
import { Input, Label, Button, Form, FormFeedback, Alert, Spinner } from 'reactstrap';
import { useSelector, useDispatch } from 'react-redux';
import withRouter from '../../Components/Common/withRouter';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { loginUser, resetLoginFlag } from '../../slices/thunks';
import loginBg from '../../assets/images/login-bg.png';
import { createSelector } from 'reselect';
import DragCaptcha, { DragCaptchaRef } from '../../Components/Common/DragCaptcha';
import LanguageDropdown from '../../Components/Common/LanguageDropdown';
import { useTT } from '../../helpers/useTT';

const Login = (props: any) => {
  const { tt } = useTT();
  const dispatch: any = useDispatch();

  const selectAccount = (s: any) => s.Account;
  const selectLogin = (s: any) => s.Login;

  const loginpageData = createSelector([selectAccount, selectLogin], (account, login) => ({
    user: account?.user,
    error: login?.error,
    loading: login?.loading,
    errorMsg: login?.errorMsg,
  }));

  const { error, loading, errorMsg } = useSelector(loginpageData);

  const [passwordShow, setPasswordShow] = useState<boolean>(false);
  const [captchaVal, setCaptchaVal] = useState<boolean>(false);
  const captchaRef = useRef<DragCaptchaRef | null>(null);

  const validation: any = useFormik({
    enableReinitialize: true,
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema: Yup.object({
      username: Yup.string().required(tt('login.userNameRequired')),
      password: Yup.string().required(tt('login.passwordRequired')),
    }),
    onSubmit: (values) => {
      if (!captchaVal) return;
      const from = props.router?.location?.state?.from;
      const redirectTo = from ? `${from.pathname || ''}${from.search || ''}` : undefined;
      dispatch(loginUser(values, props.router.navigate, redirectTo));
    },
  });

  useEffect(() => {
    if (errorMsg || error) {
      captchaRef.current?.resetResult();
      setCaptchaVal(false);

      const t = setTimeout(() => {
        dispatch(resetLoginFlag());
      }, 3000);

      return () => clearTimeout(t);
    }
  }, [dispatch, errorMsg, error]);

  document.title = 'DH SUPPLY CHAIN | Admin Login';

  return (
    <div className="login-split-layout">
      {/* Left — background image, same as Vue admin */}
      <div className="login-split-left">
        <img src={loginBg} alt="" className="login-split-bg" />
      </div>

      {/* Right — login form panel */}
      <div className="login-split-right">
        <div className="login-split-inner">
          <div className="login-split-card">
            <div className="login-title-wrap mb-3">
              <div className="login-title-lang">
                <LanguageDropdown />
              </div>
              <div className="text-center">
                <h5 className="text-primary">Welcome Back !</h5>
                <p className="text-muted">Sign in to continue to DH Admin Portal.</p>
              </div>
            </div>

            {error && <Alert color="danger">{String(error)}</Alert>}

            {!captchaVal && <Alert color="warning">{tt('captcha.notification')}</Alert>}

            <div className="p-2 mt-4">
              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  validation.handleSubmit();
                  return false;
                }}
              >
                <div className="mb-3">
                  <Label htmlFor="username" className="form-label">
                    {tt('login.userName')}
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    className="form-control"
                    placeholder={tt('login.enterUserName')}
                    type="text"
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    value={validation.values.username || ''}
                    invalid={!!(validation.touched.username && validation.errors.username)}
                  />
                  {validation.touched.username && validation.errors.username && (
                    <FormFeedback type="invalid">{validation.errors.username}</FormFeedback>
                  )}
                </div>

                <div className="mb-3">
                  <Label className="form-label" htmlFor="password-input">
                    {tt('login.password')}
                  </Label>

                  <div className="position-relative auth-pass-inputgroup mb-3 login-password-wrap">
                    <Input
                      id="password-input"
                      name="password"
                      value={validation.values.password || ''}
                      type={passwordShow ? 'text' : 'password'}
                      className="form-control pe-5"
                      placeholder={tt('login.enterPassword')}
                      onChange={validation.handleChange}
                      onBlur={validation.handleBlur}
                      invalid={!!(validation.touched.password && validation.errors.password)}
                    />

                    {validation.touched.password && validation.errors.password && (
                      <FormFeedback type="invalid">{validation.errors.password}</FormFeedback>
                    )}

                    <button
                      className="btn btn-link login-password-toggle"
                      type="button"
                      id="password-addon"
                      onClick={() => setPasswordShow(!passwordShow)}
                    >
                      <i className="ri-eye-fill align-middle"></i>
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <DragCaptcha
                    ref={captchaRef}
                    value={captchaVal}
                    onChange={setCaptchaVal}
                    successText="Verified successfully"
                  />
                </div>

                <div className="mt-4">
                  <Button
                    color="success"
                    disabled={loading || !captchaVal}
                    className="btn btn-success w-100"
                    type="submit"
                  >
                    {loading && (
                      <Spinner size="sm" className="me-2">
                        Loading...
                      </Spinner>
                    )}
                    {tt('login.signin')}
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </div>

        <footer className="login-split-footer">
          <p className="mb-0 text-muted small text-center">
            &copy; {new Date().getFullYear()} DH Supply Chain Inc{' '}
            <i className="mdi mdi-heart text-danger"></i> by DH IT DEPARTMENT
          </p>
        </footer>
      </div>
    </div>
  );
};

export default withRouter(Login);
