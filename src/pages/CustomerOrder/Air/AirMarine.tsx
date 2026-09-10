import React, { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useDispatch } from 'react-redux';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, Label, Input, Spinner,
} from 'reactstrap';
import { toast } from 'react-toastify';
import ServiceListPage, {
  cadStatusLabel, customStatusMarine, fmtDate, fmtDateTime, statusLabel, type ColDef,
} from '../_ServiceListPage';
import {
  AIR_CB_TICKET_DETAILS,
  UPDATE_AIR_CB_TICKET_DETAILS,
  MARINE_CONTAINER_EVENTS,
  UPLOAD_MARINE_EXCEL,
} from '../../../helpers/url_helper';
import { RESTRICT } from '../../../helpers/userInformation';
import { buildApiUrl } from '../../../helpers/apiBase';
import { useTT } from '../../../helpers/useTT';
import { updateAirCbTicketDetails } from '../../../slices/air/thunk';

// ─── Colored text helpers (mirrors Vue dispCustomStatusColor / dispqinggustatus) ─

const customStatusClass = (v: unknown) => {
  const n = Number(v);
  if (n === 4) return 'sl-text-success';
  if (n === 2 || n === 5) return 'sl-text-danger';
  if (n === 0 || n === 1 || n === 9 || n === 34) return 'sl-text-warning';
  return 'sl-text-primary';
};

const statusClass = (v: unknown) => {
  const n = Number(v);
  if (n === 6) return 'sl-text-danger';
  if (n === 10) return 'sl-text-warning';
  return 'sl-text-success';
};

// ─── Component ────────────────────────────────────────────────────────────────

const AirMarine: React.FC = () => {
  const { tt } = useTT();
  const dispatch = useDispatch<any>();

  const COLUMNS: ColDef[] = [
    { label: tt('orderList.columns.importer'),    width: 140, render: r => r.importer    || '-', getTitle: r => r.importer    || '' },
    { label: tt('orderList.columns.transaction'), width: 140, render: r => r.transaction || '-', getTitle: r => r.transaction || '' },
    { label: tt('orderList.columns.awb'),         width: 170, render: r => r.awb         || '-', getTitle: r => r.awb         || '' },
    { label: tt('orderList.columns.destination'), width: 120, render: r => r.destination || '-' },
    { label: tt('orderList.columns.airline'),     width: 110, render: r => r.airline     || '-' },
    { label: tt('orderList.columns.eta'),         width: 115, render: r => fmtDate(r.eta ?? r.flightETA ?? r.flight_eta) || '-' },
    { label: tt('orderList.columns.cad'),         width: 120, render: r => cadStatusLabel(r.cad_status, tt) },
    {
      label: tt('orderList.columns.iidStatus'), width: 170,
      render: r => <span className={customStatusClass(r.custom_status)}>{customStatusMarine(r.custom_status, tt)}</span>,
      getTitle: r => customStatusMarine(r.custom_status, tt),
    },
    { label: tt('orderList.columns.customsStatusTime'), width: 250, render: r => fmtDateTime(r.custom_status_time) || '-' },
    {
      label: tt('orderList.columns.status'), width: 130,
      render: r => <span className={statusClass(r.status)}>{statusLabel(r.status, tt)}</span>,
    },
  ];

  // ── Examine modal
  const [examineOpen, setExamineOpen] = useState(false);
  const [examineRow, setExamineRow] = useState<any>(null);
  const [examineType, setExamineType] = useState<'1' | '2'>('1');
  const [examineNote, setExamineNote] = useState('');
  const [examineLoading, setExamineLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const patchRowsRef = React.useRef<((id: any, patch: Record<string, any>) => void) | null>(null);
  const rowsRef = useRef<any[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const exportToExcel = () => {
    const headers = ['Importer','Transaction','AWB','Destination','Airline','ETA','CAD Status','Custom Status','Status'];
    const data = rowsRef.current.map(r => [r.importer||'',r.transaction||'',r.awb||'',r.destination||'',r.airline||'',r.eta||r.flightETA||'',r.cad_status??'',r.custom_status??'',r.status??'']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'Air_Customs_Report.xlsx');
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(buildApiUrl(UPLOAD_MARINE_EXCEL), { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      toast.success(tt('serviceList.actions.uploadSuccess'));
      setRefreshKey(k => k + 1);
    } catch {
      toast.error(tt('serviceList.actions.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  // ── Track modal
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackLabel, setTrackLabel] = useState('');
  const [trackData, setTrackData] = useState<any[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);

  const handleExamine = useCallback((row: any) => {
    setExamineRow(row);
    setExamineType('1');
    setExamineNote('');
    setExamineOpen(true);
  }, []);

  const handleTrack = useCallback(async (row: any) => {
    const label = row.awb || row.container_number || '';
    setTrackLabel(label);
    setTrackData([]);
    setTrackOpen(true);
    setTrackLoading(true);
    try {
      const res = await fetch(buildApiUrl(MARINE_CONTAINER_EVENTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: row.container_number || row.awb }),
      });
      const data = await res.json();
      setTrackData(Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []);
    } catch {
      setTrackData([]);
    } finally {
      setTrackLoading(false);
    }
  }, []);

  const submitExamine = async () => {
    if (!examineRow) return;
    if (examineType === '2' && !examineNote.trim()) {
      toast.warning(tt('serviceList.rejectNoteRequired'));
      return;
    }
    setExamineLoading(true);
    try {
      let body: { cb_air_id: any; status?: number; note?: string } = { cb_air_id: examineRow.cb_air_id };
      if (examineType === '1') {
        if (Number(examineRow.status) === 10) body.status = 7;
        else if (Number(examineRow.status) === 6) body.status = 1;
        else body.status = Number(examineRow.status) + 1;
      } else {
        body.status = 6;
        body.note = examineNote.trim();
      }
      await dispatch(updateAirCbTicketDetails(body));
      patchRowsRef.current?.(examineRow.cb_air_id, { status: body.status, note: body.note ?? examineRow.note });
      setExamineOpen(false);
      setRefreshKey(k => k + 1);
    } catch {
      // toast handled inside thunk
    } finally {
      setExamineLoading(false);
    }
  };

  const extraActions = useCallback((row: any) => (
    <>
      {Number(row.status) !== 5 && (
        <Button
          size="sm" color="primary" outline className="me-1 sl-confirm-btn"
          onClick={() => handleExamine(row)}
        >
          {tt('common.confirm')}
        </Button>
      )}
      <Button size="sm" color="info" outline className="me-1" onClick={() => handleTrack(row)}>
        {tt('orderList.table.viewTrack')}
      </Button>
    </>
  ), [handleExamine, handleTrack, tt]);

  return (
    <>
      <ServiceListPage
        title="Air — Customs Clearance"
        breadcrumb="Customer Order / Air"
        endpoint={AIR_CB_TICKET_DETAILS}
        statusService="cb_air"
        detailRoute="/order_run/info/k_info"
        detailExtraParams="view_id=customs"
        identifierField="awb"
        updateAssignEndpoint={UPDATE_AIR_CB_TICKET_DETAILS}
        updateAssignIdField="cb_air_id"
        assignRestrictions={RESTRICT.ASSIGN_AIR_CB}
        columns={COLUMNS}
        notificationColIdx={2}
        extraActions={extraActions}
        refreshKey={refreshKey}
        patchRowsRef={patchRowsRef}
        rowsRef={rowsRef}
        pageActions={
          <>
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={uploadRef} onChange={handleUploadChange} />
            <Button color="primary" onClick={exportToExcel}>{tt('serviceList.actions.exportExcel')}</Button>
            <Button color="primary" disabled={uploading} onClick={() => uploadRef.current?.click()}>
              {uploading ? tt('serviceList.actions.uploading') : tt('serviceList.actions.uploadExcel')}
            </Button>
          </>
        }
        cadStatusFilter
        customStatusFilterMarine
        transactionFilter
      />

      {/* ─── Examine Modal ─── */}
      <Modal isOpen={examineOpen} toggle={() => setExamineOpen(false)} centered>
        <ModalHeader toggle={() => setExamineOpen(false)}>{tt('common.confirm')}</ModalHeader>
        <ModalBody>
          <FormGroup>
            <div className="d-flex gap-4">
              <FormGroup check className="mb-0">
                <Input id="airExamineApprove" type="radio" name="airExamineType"
                  checked={examineType === '1'} onChange={() => setExamineType('1')} />
                <Label check htmlFor="airExamineApprove">{tt('common.approve')}</Label>
              </FormGroup>
              <FormGroup check className="mb-0">
                <Input id="airExamineReject" type="radio" name="airExamineType"
                  checked={examineType === '2'} onChange={() => setExamineType('2')} />
                <Label check htmlFor="airExamineReject">{tt('common.reject')}</Label>
              </FormGroup>
            </div>
          </FormGroup>
          {examineType === '2' && (
            <FormGroup className="mt-3">
              <Label>{tt('state.cad.rejectReason')}</Label>
              <Input type="textarea" rows={3} value={examineNote}
                onChange={e => setExamineNote(e.target.value)}
                placeholder={tt('state.cad.rejectReason') + '...'} />
            </FormGroup>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setExamineOpen(false)}>{tt('changeService.actions.close')}</Button>
          <Button color="primary" onClick={submitExamine} disabled={examineLoading}>
            {examineLoading && <Spinner size="sm" className="me-1" />}{tt('common.confirm')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ─── Track Modal ─── */}
      <Modal isOpen={trackOpen} toggle={() => setTrackOpen(false)} size="lg" centered>
        <ModalHeader toggle={() => setTrackOpen(false)}>
          {tt('tracking.title')} — {trackLabel}
        </ModalHeader>
        <ModalBody className="sl-track-modal-body">
          {trackLoading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : trackData.length === 0 ? (
            <div className="text-center text-muted py-5">{tt('tracking.noData')}</div>
          ) : (
            <div>
              {trackData.map((item, i) => (
                <div key={i} className="d-flex gap-3 pb-3 mb-3 border-bottom">
                  <div className="text-muted small text-nowrap sl-track-time">
                    {item.event_time || '-'}
                  </div>
                  <div>
                    <div className="fw-semibold small">{item.location || '-'}</div>
                    <div className="small text-muted">{item.description || ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={() => setTrackOpen(false)}>{tt('changeService.actions.close')}</Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default AirMarine;
