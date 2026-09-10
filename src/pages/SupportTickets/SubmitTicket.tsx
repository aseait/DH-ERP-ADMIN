import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, CardBody, Col, Container, FormGroup, Input, Label, Row } from 'reactstrap';
import Select from 'react-select';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { buildApiUrl } from '../../helpers/apiBase';
import { SUBMIT_IT_SUPPORT_TICKET } from '../../helpers/url_helper';
import { useTT } from '../../helpers/useTT';
import { getUserIdFromSession, getUserNameFromSession } from '../../helpers/userInformation';
import { FilePicker } from './FilePicker';
import {
  DEFAULT_TICKET_PRIORITY,
  DEFAULT_TICKET_TYPE,
  getPriorityLabel,
  getTypeLabel,
  TICKET_PRIORITY,
  TICKET_TYPE,
} from './ticketMeta';
import { useUserOptions } from './useUserOptions';

const userOptionLabel = (u: { account_name: string; department?: string }): string =>
  u.department ? `${u.account_name} (${u.department})` : u.account_name;

const SubmitTicket: React.FC = () => {
  const { tt } = useTT();
  const navigate = useNavigate();
  const { users, loading: usersLoading } = useUserOptions();
  // Only staff with a department set are valid assignees for a new ticket.
  const assignableUsers = users.filter((u) => !!u.department);

  const userId = getUserIdFromSession();
  const requesterName = getUserNameFromSession();

  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState(DEFAULT_TICKET_TYPE);
  const [priority, setPriority] = useState(DEFAULT_TICKET_PRIORITY);
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successTicket, setSuccessTicket] = useState('');

  const submit = async () => {
    if (!subject.trim() || !note.trim()) {
      setError(tt('supportTickets.submit.missingFields'));
      return;
    }

    if (!userId) {
      setError(tt('supportTickets.submit.noUser'));
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessTicket('');
    try {
      const formData = new FormData();
      formData.append('user_id', String(userId));
      assignedIds.forEach((id) => formData.append('assigned_ids', id));
      formData.append('subject', subject.trim());
      formData.append('note', note.trim());
      formData.append('type', String(type));
      formData.append('priority', String(priority));
      noteFiles.forEach((f) => formData.append('note_files', f));

      const res = await fetch(buildApiUrl(SUBMIT_IT_SUPPORT_TICKET), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setSuccessTicket(data?.ticket_number || '');
      setSubject('');
      setNote('');
      setType(DEFAULT_TICKET_TYPE);
      setPriority(DEFAULT_TICKET_PRIORITY);
      setAssignedIds([]);
      setNoteFiles([]);
    } catch (e: any) {
      setError(e?.message || tt('supportTickets.submit.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={tt('supportTickets.submit.title')} pageTitle={tt('menu.itSupport')} />

        <Row className="justify-content-center">
          <Col lg={7}>
            <Card>
              <CardBody>
                {successTicket && (
                  <Alert color="success">
                    {tt('supportTickets.submit.success', { ticket: successTicket })}{' '}
                    <Button color="link" className="p-0 align-baseline" onClick={() => navigate('/support/tickets')}>
                      {tt('supportTickets.submit.viewTickets')}
                    </Button>
                  </Alert>
                )}
                {error && <Alert color="danger">{error}</Alert>}

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>{tt('supportTickets.fields.requester')}</Label>
                      <Input value={requesterName} disabled readOnly />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>{tt('supportTickets.fields.assignTo')}</Label>
                      <Select
                        isMulti
                        options={assignableUsers.map((u) => ({ value: String(u.id), label: userOptionLabel(u) }))}
                        value={assignedIds.map((id) => {
                          const u = assignableUsers.find((au) => String(au.id) === id);
                          return { value: id, label: u ? userOptionLabel(u) : id };
                        })}
                        onChange={(opts: readonly { value: string; label: string }[] | null) =>
                          setAssignedIds(opts ? opts.map((o) => o.value) : [])
                        }
                        placeholder={tt('supportTickets.fields.unassigned')}
                        isClearable
                        isSearchable
                        isDisabled={usersLoading}
                        classNamePrefix="rs"
                      />
                    </FormGroup>
                  </Col>
                </Row>

                <FormGroup>
                  <Label>{tt('supportTickets.fields.subject')} *</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </FormGroup>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>{tt('supportTickets.fields.type')}</Label>
                      <Input type="select" value={type} onChange={(e) => setType(Number(e.target.value))}>
                        {TICKET_TYPE.map((v) => (
                          <option key={v} value={v}>
                            {getTypeLabel(v, tt)}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>{tt('supportTickets.fields.priority')}</Label>
                      <Input type="select" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                        {TICKET_PRIORITY.map((v) => (
                          <option key={v} value={v}>
                            {getPriorityLabel(v, tt)}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                  </Col>
                </Row>

                <FormGroup>
                  <Label>{tt('supportTickets.fields.note')} *</Label>
                  <Input type="textarea" rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
                </FormGroup>

                <FormGroup>
                  <Label>{tt('supportTickets.fields.attachments')}</Label>
                  <FilePicker files={noteFiles} onChange={setNoteFiles} />
                </FormGroup>

                <Button color="primary" onClick={submit} disabled={submitting}>
                  {submitting ? tt('supportTickets.submit.submitting') : tt('supportTickets.submit.submit')}
                </Button>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default SubmitTicket;
