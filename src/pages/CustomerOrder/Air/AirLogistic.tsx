import React, { useCallback, useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter,
  FormGroup, Label, Input, Spinner,
} from 'reactstrap';
import { toast } from 'react-toastify';
import ServiceListPage, {
  fmtDate, type ColDef,
} from '../_ServiceListPage';
import {
  AIR_LOGISTIC_TICKET_DETAILS,
  UPDATE_AIR_LOGISTIC_TICKET_DETAILS,
  MARINE_CONTAINER_EVENTS,
  BULK_CREATE_LOGISTIC_MARINE_EXCEL,
  BULK_UPDATE_TRAIN_ETA_EXCEL,
} from '../../../helpers/url_helper';
import { buildApiUrl } from '../../../helpers/apiBase';
import { useTT } from '../../../helpers/useTT';

// ─── Colored text helper (logistic: 3=green, 4=red, 10=orange, else green) ────

const statusClass = (v: unknown) => {
  const n = Number(v);
  if (n === 4) return 'sl-text-danger';
  if (n === 10) return 'sl-text-warning';
  return 'sl-text-success';
};

const logisticStatusLabel = (v: unknown, tt: (k: string) => string) => {
  const n = Number(v);
  const map: Record<number, string> = {
    0: 'logistic.status.underReview',
    1: 'logistic.status.processing',
    2: 'logistic.status.inTransit',
    3: 'logistic.status.deliveryCompleted',
    4: 'logistic.status.rejected',
    10: 'logistic.status.deletePending',
  };
  return map[n] ? tt(map[n]) : String(v ?? '-');
};

// ─── Component ────────────────────────────────────────────────────────────────

const AirLogistic: React.FC = () => {
  const { tt } = useTT();

  const statusTabs = useMemo(() => [
    { value: '0',  label: tt('logistic.status.underReview') },
    { value: '1',  label: tt('logistic.status.processing') },
    { value: '2',  label: tt('logistic.status.inTransit') },
    { value: '3',  label: tt('logistic.status.deliveryCompleted') },
    { value: '4',  label: tt('logistic.status.rejected') },
    { value: '5',  label: tt('logistic.status.all') },
    { value: '10', label: tt('logistic.status.deletePending') },
  ], [tt]);

  const COLUMNS = useMemo<ColDef[]>(() => [
    { label: tt('orderList.columns.awb'),                 width: 170, render: r => r.awb || '-', getTitle: r => r.awb || '' },
    { label: tt('orderList.columns.airline'),             width: 110, render: r => r.airline || '-' },
    { label: tt('orderList.columns.shippingUnits'),       width: 110, render: r => r.shipping_units != null ? String(r.shipping_units) : '-' },
    { label: tt('orderList.columns.supervisionWarehouse'), width: 150, render: r => r.supervision_wareshouse || '-' },
    { label: tt('orderList.columns.ata'),                 width: 110, render: r => fmtDate(r.ata) },
    { label: tt('orderList.columns.cargoArrivalTime'),    width: 120, render: r => fmtDate(r.cargo_arrival_time) },
    { label: tt('orderList.columns.cargoPickupTime'),     width: 120, render: r => fmtDate(r.cargo_pickup_time) },
    {
      label: tt('logistic.columns.containerStatus'), width: 150,
      render: r => <span className={statusClass(r.status)}>{logisticStatusLabel(r.status, tt)}</span>,
    },
  ], [tt]);

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
  const trainEtaRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [trainEtaUploading, setTrainEtaUploading] = useState(false);

  const exportToExcel = () => {
    const headers = ['AWB','Airline','Shipping Units','Supervision Warehouse','ATA','Cargo Arrival Time','Cargo Pickup Time','Status'];
    const data = rowsRef.current.map(r => [r.awb||'',r.airline||'',r.shipping_units??'',r.supervision_wareshouse||'',r.ata||'',r.cargo_arrival_time||'',r.cargo_pickup_time||'',r.status??'']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'Air_Pickup_Report.xlsx');
  };

  const handleUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(buildApiUrl(BULK_CREATE_LOGISTIC_MARINE_EXCEL), { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      toast.success(tt('serviceList.actions.uploadSuccess'));
      setRefreshKey(k => k + 1);
    } catch {
      toast.error(tt('serviceList.actions.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleTrainEtaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTrainEtaUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(buildApiUrl(BULK_UPDATE_TRAIN_ETA_EXCEL), { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message);
      toast.success(json?.message || tt('serviceList.actions.uploadSuccess'));
      setRefreshKey(k => k + 1);
    } catch {
      toast.error(tt('serviceList.actions.uploadFailed'));
    } finally {
      setTrainEtaUploading(false);
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
        body: JSON.stringify({ container_number: row.awb || row.container_number }),
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
      toast.warning(tt('state.cad.rejectReason') + ' is required.');
      return;
    }
    setExamineLoading(true);
    try {
      let body: any = { logistic_air_id: examineRow.logistic_air_id };
      if (examineType === '1') {
        // Restore from rejected (4) → processing (1); otherwise advance
        body.status = Number(examineRow.status) === 4 ? 1 : Number(examineRow.status) + 1;
      } else {
        body.status = 4;
        body.note = examineNote.trim();
      }
      const res = await fetch(buildApiUrl(UPDATE_AIR_LOGISTIC_TICKET_DETAILS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      patchRowsRef.current?.(examineRow.logistic_air_id, { status: body.status, note: body.note ?? examineRow.note });
      setExamineOpen(false);
      toast.success('Updated successfully.');
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      toast.error(e?.message || 'Update failed.');
    } finally {
      setExamineLoading(false);
    }
  };

  const extraActions = useCallback((row: any) => (
    <>
      {Number(row.status) !== 3 && (
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
        title="Air — Logistic"
        breadcrumb="Customer Order / Air"
        endpoint={AIR_LOGISTIC_TICKET_DETAILS}
        statusService="logistic_air"
        detailRoute="/order_run/info/k_info"
        detailExtraParams="view_id=logistic"
        identifierField="awb"
        columns={COLUMNS}
        extraActions={extraActions}
        refreshKey={refreshKey}
        patchRowsRef={patchRowsRef}
        rowsRef={rowsRef}
        statusTabsOverride={statusTabs}
        allStatusValue="5"
        ataFilter
        cargoArrivalFilter
        cargoPickupFilter
        pageActions={
          <>
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={uploadRef} onChange={handleUploadChange} />
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} ref={trainEtaRef} onChange={handleTrainEtaChange} />
            <Button color="primary" onClick={exportToExcel}>{tt('serviceList.actions.exportExcel')}</Button>
            <Button color="primary" disabled={uploading} onClick={() => uploadRef.current?.click()}>
              {uploading ? tt('serviceList.actions.uploading') : tt('serviceList.actions.uploadExcel')}
            </Button>
            <Button color="primary" disabled={trainEtaUploading} onClick={() => trainEtaRef.current?.click()}>
              {trainEtaUploading ? tt('serviceList.actions.uploading') : tt('serviceList.actions.updateTrainEta')}
            </Button>
          </>
        }
      />

      {/* ─── Examine Modal ─── */}
      <Modal isOpen={examineOpen} toggle={() => setExamineOpen(false)} centered>
        <ModalHeader toggle={() => setExamineOpen(false)}>{tt('common.confirm')}</ModalHeader>
        <ModalBody>
          <FormGroup>
            <div className="d-flex gap-4">
              <FormGroup check className="mb-0">
                <Input id="lgExamineApprove" type="radio" name="lgExamineType"
                  checked={examineType === '1'} onChange={() => setExamineType('1')} />
                <Label check htmlFor="lgExamineApprove">{tt('common.approve')}</Label>
              </FormGroup>
              <FormGroup check className="mb-0">
                <Input id="lgExamineReject" type="radio" name="lgExamineType"
                  checked={examineType === '2'} onChange={() => setExamineType('2')} />
                <Label check htmlFor="lgExamineReject">{tt('common.reject')}</Label>
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

export default AirLogistic;
