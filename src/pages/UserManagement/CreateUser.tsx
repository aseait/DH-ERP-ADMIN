import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Card, CardBody, CardHeader,
  Button, Input, Label, FormGroup, FormFeedback,
  Row, Col, Spinner, Alert,
} from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { buildApiUrl } from '../../helpers/apiBase';
import { CLIENT_USER_REGISTER } from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { can, RESTRICT } from '../../helpers/userInformation';

type FormState = {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  phone: string;
  email: string;
  company: string;
  currency: 'CAD' | 'USD';
  billTerm: 'Per Deal' | 'Monthly';
};

const INIT: FormState = {
  username: '',
  password: '',
  firstname: '',
  lastname: '',
  phone: '',
  email: '',
  company: '',
  currency: 'CAD',
  billTerm: 'Per Deal',
};

const emailRe = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

const CreateUser = () => {
  const navigate = useNavigate();
  const { tt } = useTT();

  const [form, setForm] = useState<FormState>(INIT);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);

  const hasPermission = can(RESTRICT.CREATE_USER);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const touch = (field: keyof FormState) => () =>
    setTouched(t => ({ ...t, [field]: true }));

  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.username.trim())  errors.username  = tt('createUser.validation.usernameRequired');
  else if (!/^[A-Za-z]+$/.test(form.username.trim())) errors.username = tt('createUser.validation.usernameEnglishOnly');
  if (!form.password)         errors.password  = tt('createUser.validation.passwordRequired');
  if (!form.firstname.trim()) errors.firstname = tt('createUser.validation.firstNameRequired');
  if (!form.lastname.trim())  errors.lastname  = tt('createUser.validation.lastNameRequired');
  if (!form.phone.trim())     errors.phone     = tt('createUser.validation.phoneRequired');
  if (!form.email.trim())     errors.email     = tt('createUser.validation.emailRequired');
  else if (!emailRe.test(form.email)) errors.email = tt('createUser.validation.emailInvalid');
  if (!form.company.trim())   errors.company   = tt('createUser.validation.companyRequired');

  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      username: true, password: true, firstname: true, lastname: true,
      phone: true, email: true, company: true,
    });
    if (hasErrors || !hasPermission) return;

    setLoading(true);
    setApiError('');
    setSuccess('');
    try {
      const res = await fetch(buildApiUrl(CLIENT_USER_REGISTER), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          contact_name: `${form.firstname.trim()} ${form.lastname.trim()}`.trim(),
          company_name: form.company.trim(),
          phone: form.phone.trim(),
          currency: form.currency,
          Bill_Term: form.billTerm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data?.message || `HTTP ${res.status}`);
        return;
      }
      setSuccess(data?.message || tt('createUser.validation.usernameRequired'));
      setForm(INIT);
      setTouched({});
    } catch (err: any) {
      setApiError(err?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const field = (name: keyof FormState) => ({
    id: name,
    name,
    value: form[name],
    onChange: set(name),
    onBlur: touch(name),
    invalid: !!(touched[name] && errors[name]),
    valid: !!(touched[name] && !errors[name]),
  });

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('createUser.title')} pageTitle={tt('createUser.title')} />

        <div className="mb-3">
          <Button color="secondary" outline onClick={() => navigate('/user/run')}>
            &larr; {tt('createUser.back')}
          </Button>
        </div>

        <Row className="justify-content-center">
          <Col xs={12} md={8} lg={6}>
            <Card>
              <CardHeader className="fw-bold">{tt('createUser.subtitle')}</CardHeader>
              <CardBody>
                {!hasPermission && (
                  <Alert color="danger" className="text-center">
                    {tt('createUser.noPermission')}
                  </Alert>
                )}

                {apiError && <Alert color="danger">{apiError}</Alert>}
                {success && <Alert color="success">{success}</Alert>}

                <form onSubmit={handleSubmit} noValidate>
                  <fieldset disabled={!hasPermission}>
                    <Row className="g-3">
                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="username">{tt('createUser.fields.username')} *</Label>
                          <Input {...field('username')} placeholder={tt('createUser.fields.username')} autoComplete="off" />
                          {touched.username && errors.username && <FormFeedback>{errors.username}</FormFeedback>}
                        </FormGroup>
                      </Col>
                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="password">{tt('createUser.fields.password')} *</Label>
                          <div className="input-group">
                            <Input
                              {...field('password')}
                              type={showPw ? 'text' : 'password'}
                              placeholder={tt('createUser.fields.password')}
                              autoComplete="new-password"
                              className="rounded-end-0"
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => setShowPw(v => !v)}
                              tabIndex={-1}
                            >
                              <i className={`ri-eye${showPw ? '-off' : ''}-line`} />
                            </button>
                          </div>
                          {touched.password && errors.password && (
                            <div className="invalid-feedback d-block">{errors.password}</div>
                          )}
                        </FormGroup>
                      </Col>

                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="firstname">{tt('createUser.fields.firstName')} *</Label>
                          <Input {...field('firstname')} placeholder={tt('createUser.fields.firstName')} />
                          {touched.firstname && errors.firstname && <FormFeedback>{errors.firstname}</FormFeedback>}
                        </FormGroup>
                      </Col>
                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="lastname">{tt('createUser.fields.lastName')} *</Label>
                          <Input {...field('lastname')} placeholder={tt('createUser.fields.lastName')} />
                          {touched.lastname && errors.lastname && <FormFeedback>{errors.lastname}</FormFeedback>}
                        </FormGroup>
                      </Col>

                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="phone">{tt('createUser.fields.phone')} *</Label>
                          <Input {...field('phone')} placeholder={tt('createUser.fields.phone')} />
                          {touched.phone && errors.phone && <FormFeedback>{errors.phone}</FormFeedback>}
                        </FormGroup>
                      </Col>
                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="email">{tt('createUser.fields.email')} *</Label>
                          <Input {...field('email')} type="email" placeholder={tt('createUser.fields.email')} />
                          {touched.email && errors.email && <FormFeedback>{errors.email}</FormFeedback>}
                        </FormGroup>
                      </Col>

                      <Col xs={12}>
                        <FormGroup>
                          <Label for="company">{tt('createUser.fields.company')} *</Label>
                          <Input {...field('company')} placeholder={tt('createUser.fields.company')} />
                          {touched.company && errors.company && <FormFeedback>{errors.company}</FormFeedback>}
                        </FormGroup>
                      </Col>

                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="currency">{tt('createUser.fields.currency')}</Label>
                          <Input type="select" id="currency" name="currency" value={form.currency} onChange={set('currency')}>
                            <option value="CAD">CAD</option>
                            <option value="USD">USD</option>
                          </Input>
                        </FormGroup>
                      </Col>
                      <Col xs={12} sm={6}>
                        <FormGroup>
                          <Label for="billTerm">{tt('createUser.fields.billTerm')}</Label>
                          <Input type="select" id="billTerm" name="billTerm" value={form.billTerm} onChange={set('billTerm')}>
                            <option value="Per Deal">{tt('createUser.billTermOptions.perDeal')}</option>
                            <option value="Monthly">{tt('createUser.billTermOptions.monthly')}</option>
                          </Input>
                        </FormGroup>
                      </Col>

                      <Col xs={12} className="d-flex gap-2">
                        <Button type="submit" color="primary" disabled={loading || !hasPermission}>
                          {loading ? <Spinner size="sm" className="me-1" /> : null}
                          {tt('createUser.submit')}
                        </Button>
                        <Button
                          type="button" color="secondary" outline
                          onClick={() => { setForm(INIT); setTouched({}); setApiError(''); setSuccess(''); }}
                        >
                          {tt('createUser.reset')}
                        </Button>
                      </Col>
                    </Row>
                  </fieldset>
                </form>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default CreateUser;
