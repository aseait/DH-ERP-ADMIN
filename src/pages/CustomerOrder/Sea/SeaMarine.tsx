import React, { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useDispatch } from 'react-redux';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, Label, Input, Spinner,
} from 'reactstrap';
import { toast } from 'react-toastify';
import ServiceListPage, {
  anEmfLabel, cadStatusLabel, customStatusMarine, fmtDate, fmtDateTime, statusLabel, type ColDef,
} from '../_ServiceListPage';
import {
  MARINE_CB_TICKET_DETAILS,
  UPDATE_MARINE_CB_TICKET_DETAILS,
  MARINE_CONTAINER_EVENTS,
  UPLOAD_MARINE_EXCEL,
} from '../../../helpers/url_helper';
import { RESTRICT } from '../../../helpers/userInformation';
import { buildApiUrl } from '../../../helpers/apiBase';
import { useTT } from '../../../helpers/useTT';
import { updateMarineCbTicketDetails } from '../../../slices/marine/thunk';

// ─── Colored text helpers — mirror Vue el-text :type="success/danger/warning" ─

// Vue dispCustomStatusColor: 4→success, 2|5→danger, 0|1|9|34→warning, else→primary
const customStatusClass = (v: unknown) => {
  const n = Number(v);
  if (n === 4) return 'sl-text-success';
  if (n === 2 || n === 5) return 'sl-text-danger';
  if (n === 0 || n === 1 || n === 9 || n === 34) return 'sl-text-warning';
  return 'sl-text-primary';
};

// Vue: status==6 → danger, status==10 → warning, else → success
const statusClass = (v: unknown) => {
  const n = Number(v);
  if (n === 6) return 'sl-text-danger';
  if (n === 10) return 'sl-text-warning';
  return 'sl-text-success';
};

// ─── Examine eligibility — mirrors Vue canClickExamine ────────────────────────

const canClickExamine = (row: any): boolean => {
  if (Number(row.status) === 10) return true;
  return !(
    (row.status === 1 && row.cad_status !== 2) ||
    (row.status === 3 && row.custom_status !== 4) ||
    row.an_emf !== 1
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const SeaMarine: React.FC = () => {
  const { tt } = useTT();
  const dispatch = useDispatch<any>();

  const COLUMNS: ColDef[] = [
    { label: tt('orderList.columns.containerNumber'), width: 200, render: r => r.container_number || '-' },
    { label: tt('orderList.columns.destination'),     width: 140, render: r => r.destination || '-' },
    { label: tt('orderList.columns.shipline'),        width: 100, render: r => r.shipline || '-' },
    { label: tt('orderList.columns.portEta'),         width: 170, render: r => fmtDateTime(r.portETA) },
    { label: tt('orderList.columns.fcl'),             width:  80, render: r => r.fcl == 1 ? tt('common.fcl') : r.fcl == 0 ? tt('common.lcl') : (r.fcl_lcl || '-') },
    { label: tt('orderList.columns.rail'),            width:  90, render: r => r.rail || '-' },
    { label: tt('orderList.columns.trainEta'),        width: 170, render: r => fmtDateTime(r.trainETA) },
    { label: tt('serviceList.columns.lastFreeDay'),   width: 170, render: r => fmtDateTime(r.last_free_day) },
    { label: tt('serviceList.columns.anEmf'),         width:  80, render: r => anEmfLabel(r.an_emf, tt) },
    { label: tt('orderList.columns.transaction'),     width: 130, render: r => r.transaction || '-', getTitle: r => r.transaction || '' },
    { label: tt('orderList.columns.cad'),             width: 130, render: r => cadStatusLabel(r.cad_status, tt) },
    {
      label: tt('orderList.columns.iidStatus'), width: 160,
      render: r => <span className={customStatusClass(r.custom_status)}>{customStatusMarine(r.custom_status, tt)}</span>,
      getTitle: r => customStatusMarine(r.custom_status, tt),
    },
    { label: tt('orderList.columns.customsStatusTime'), width: 250, render: r => { const v = r.custom_status_time; return (!v || String(v).toLowerCase().startsWith('invalid')) ? '-' : fmtDate(v); } },
    { label: tt('orderList.columns.importer'),        width: 140, render: r => r.importer || '-', getTitle: r => r.importer || '' },
    { label: tt('serviceList.columns.note'),          width: 100, render: r => r.note || '-',     getTitle: r => r.note || '' },
    { label: tt('serviceList.columns.creator'),       width: 140, render: r => r.creator_name || '-', getTitle: r => r.creator_name || '' },
    {
      label: tt('orderList.columns.status'), width: 140,
      render: r => <span className={statusClass(r.status)}>{statusLabel(r.status, tt)}</span>,
    },
  ];

  const SORT_FIELD_OPTIONS = [
    { label: tt('orderList.columns.portEta'),  value: 'portETA' },
    { label: tt('orderList.columns.trainEta'), value: 'trainETA' },
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
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const exportToExcel = () => {
    const headers = ['Container Number','Destination','Shipline','Port ETA','FCL/LCL','Rail','Train ETA','Last Free Day','AN/EMF','Transaction','CAD Status','Custom Status','Custom Status Time','Importer','Note','Creator','Status'];
    const data = rowsRef.current.map(r => [r.container_number||'',r.destination||'',r.shipline||'',r.portETA||'',r.fcl==1?'FCL':'LCL',r.rail||'',r.trainETA||'',r.last_free_day||'',r.an_emf||'',r.transaction||'',r.cad_status??'',r.custom_status??'',r.custom_status_time||'',r.importer||'',r.note||'',r.creator_name||'',r.status??'']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'Sea_Customs_Report.xlsx');
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
  const [trackContainer, setTrackContainer] = useState('');
  const [trackData, setTrackData] = useState<any[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);

  const handleExamine = useCallback((row: any) => {
    setExamineRow(row);
    setExamineType('1');
    setExamineNote('');
    setExamineOpen(true);
  }, []);

  const handleTrack = useCallback(async (row: any) => {
    setTrackContainer(row.container_number || '');
    setTrackData([]);
    setTrackOpen(true);
    setTrackLoading(true);
    try {
      const res = await fetch(buildApiUrl(MARINE_CONTAINER_EVENTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: row.container_number }),
      });
      const data = await res.json();
      setTrackData(Array.isArray(data?.data) ? data.data : []);
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
      let body: { cb_marine_id: any; status?: number; note?: string } = { cb_marine_id: examineRow.cb_marine_id };
      if (examineType === '1') {
        if (Number(examineRow.status) === 10) body.status = 7;
        else if (Number(examineRow.status) === 6) body.status = 1;
        else body.status = Number(examineRow.status) + 1;
      } else {
        body.status = 6;
        body.note = examineNote.trim();
      }
      await dispatch(updateMarineCbTicketDetails(body));
      patchRowsRef.current?.(examineRow.cb_marine_id, { status: body.status, note: body.note ?? examineRow.note });
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
      {row.status !== 5 && (
        <Button
          size="sm" color="primary" outline className="me-1 sl-confirm-btn"
          disabled={!canClickExamine(row)}
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
        title="Sea — Customs Clearance"
        breadcrumb="Customer Order / Sea"
        endpoint={MARINE_CB_TICKET_DETAILS}
        statusService="cb_marine"
        detailRoute="/order_run/info/h_info"
        detailExtraParams="view_id=customs"
        identifierField="container_number"
        updateAssignEndpoint={UPDATE_MARINE_CB_TICKET_DETAILS}
        updateAssignIdField="cb_marine_id"
        assignRestrictions={RESTRICT.ASSIGN_SEA_CB}
        columns={COLUMNS}
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
        railFilter
        portEtaFilter
        trainEtaFilter
        transactionFilter
        customStatusTimeFilter
        sortFieldOptions={SORT_FIELD_OPTIONS}
      />

      {/* ─── Examine Modal ─── */}
      <Modal isOpen={examineOpen} toggle={() => setExamineOpen(false)} centered>
        <ModalHeader toggle={() => setExamineOpen(false)}>{tt('common.confirm')}</ModalHeader>
        <ModalBody>
          <FormGroup>
            <div className="d-flex gap-4">
              <FormGroup check className="mb-0">
                <Input id="examineApprove" type="radio" name="examineType"
                  checked={examineType === '1'} onChange={() => setExamineType('1')} />
                <Label check htmlFor="examineApprove">{tt('common.approve')}</Label>
              </FormGroup>
              <FormGroup check className="mb-0">
                <Input id="examineReject" type="radio" name="examineType"
                  checked={examineType === '2'} onChange={() => setExamineType('2')} />
                <Label check htmlFor="examineReject">{tt('common.reject')}</Label>
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
          {tt('tracking.title')} — {trackContainer}
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

export default SeaMarine;
