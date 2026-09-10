import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import {
  Alert, Button, FormGroup, Input, Label,
  Modal, ModalBody, ModalFooter, ModalHeader,
  Spinner,
} from 'reactstrap';
import ServiceListPage, { fmtDate, fmtDateTime, type ColDef } from '../_ServiceListPage';
import { TRUCK_LOGISTIC_TICKET_DETAILS, MARINE_CONTAINER_EVENTS, UPLOAD_MARINE_EXCEL, BULK_UPDATE_TRAIN_ETA_EXCEL } from '../../../helpers/url_helper';
import { buildApiUrl } from '../../../helpers/apiBase';
import { useTT } from '../../../helpers/useTT';
import TrackTimeline from '../../OrderLists/TrackTimeline';
import { updateTruckLogisticApi } from '../../../helpers/api_fetch/parse';

const truckStatusClass = (v: unknown): string => {
  if (Number(v) === 4) return 'sl-text-danger';
  return 'sl-text-success';
};

const safeStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const TruckLogistic: React.FC = () => {
  const { tt } = useTT();

  // ── Track modal state
  const [trackOpen, setTrackOpen]           = useState(false);
  const [trackContainerNo, setTrackContainerNo] = useState('');
  const [trackEvents, setTrackEvents]       = useState<any[]>([]);
  const [trackLoading, setTrackLoading]     = useState(false);
  const [trackError, setTrackError]         = useState('');

  // ── Confirm (examine) modal state
  const [examineOpen, setExamineOpen]       = useState(false);
  const [examineRow, setExamineRow]         = useState<any>(null);
  const [examineType, setExamineType]       = useState<'approve' | 'reject'>('approve');
  const [examineNote, setExamineNote]       = useState('');
  const [examineLoading, setExamineLoading] = useState(false);
  const [examineError, setExamineError]     = useState('');

  // refreshKey triggers ServiceListPage to silently reload after examine
  const [refreshKey, setRefreshKey]         = useState(0);
  const rowsRef = useRef<any[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const trainEtaRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [trainEtaUploading, setTrainEtaUploading] = useState(false);

  const exportToExcel = () => {
    const headers = ['Container Number','Go Warehouse','Destination','Departure','Truck Company','Cross Border Location','Cross Border Time','Parse','CBM','Port ETA','Pickup Date','Return Date','Warehouse Arrival Date','Note','Container Status'];
    const data = rowsRef.current.map(r => [r.container_number||'',r.go_warehouse??'',r.destination||'',r.destination_us||'',r.truck_company||'',r.cross_border_location||'',r.cross_border_time||'',r.logistic_parse||'',r.cbm??'',r.portETA||'',r.pickup_container_date||'',r.return_container_date||'',r.warehouse_arrival_date||'',r.container_note||'',r.container_status??'']);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'Truck_Pickup_Report.xlsx');
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

  // ── Track handlers
  const handleTrack = useCallback(async (row: any) => {
    const cn = row.container_number || '';
    setTrackContainerNo(cn);
    setTrackEvents([]);
    setTrackError('');
    setTrackOpen(true);
    setTrackLoading(true);
    try {
      const res = await fetch(buildApiUrl(MARINE_CONTAINER_EVENTS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: cn }),
      });
      const data = await res.json();
      setTrackEvents(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (e: any) {
      setTrackError(e?.message || 'Failed to load tracking data');
    } finally {
      setTrackLoading(false);
    }
  }, []);

  const closeTrack = useCallback(() => setTrackOpen(false), []);

  // ── Confirm (examine) handlers
  const handleExamine = useCallback((row: any) => {
    setExamineRow(row);
    setExamineType('approve');
    setExamineNote('');
    setExamineError('');
    setExamineOpen(true);
  }, []);

  const closeExamine = useCallback(() => {
    if (examineLoading) return;
    setExamineOpen(false);
  }, [examineLoading]);

  const submitExamine = useCallback(async () => {
    if (!examineRow) return;

    if (examineType === 'reject' && !examineNote.trim()) {
      setExamineError('Please enter a reason for rejection.');
      return;
    }

    const currentStatus = Number(examineRow.container_status ?? 0);
    const nextStatus = examineType === 'approve'
      ? (currentStatus === 4 ? 1 : currentStatus + 1)
      : 4;

    setExamineLoading(true);
    setExamineError('');
    try {
      await updateTruckLogisticApi({
        truck_logistic_id: examineRow.truck_logistic_id,
        container_id:      examineRow.container_id,
        status:            nextStatus,
        ...(examineType === 'reject' ? { note: examineNote.trim() } : {}),
      });
      setExamineOpen(false);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      setExamineError(e?.message || 'Failed to submit');
    } finally {
      setExamineLoading(false);
    }
  }, [examineRow, examineType, examineNote]);

  // ── Status tabs
  const statusTabs = useMemo(() => [
    { value: '0', label: tt('logistic.status.underReview') },
    { value: '1', label: tt('logistic.status.processing') },
    { value: '2', label: tt('logistic.status.inTransit') },
    { value: '3', label: tt('logistic.status.completed') },
    { value: '4', label: tt('logistic.status.rejected') },
    { value: '5', label: tt('logistic.status.all') },
  ], [tt]);

  // ── Columns
  const COLUMNS = useMemo<ColDef[]>(() => {
    const goWarehouseLabel = (v: unknown): string =>
      Number(v) === 1 ? tt('common.yes') : tt('common.no');

    const statusMap: Record<number, string> = {
      0: 'logistic.status.underReview',
      1: 'logistic.status.processing',
      2: 'logistic.status.inTransit',
      3: 'logistic.status.deliveryCompleted',
      4: 'logistic.status.rejected',
    };

    return [
      { label: tt('orderList.columns.containerNumber'),       width: 200, render: r => r.container_number || '-' },
      { label: tt('orderList.columns.goWarehouse'),           width: 200, render: r => goWarehouseLabel(r.go_warehouse) },
      { label: tt('orderList.columns.destination'),           width: 150, render: r => r.destination || '-' },
      { label: tt('orderList.columns.departure'),             width: 200, render: r => r.destination_us || '-' },
      { label: tt('orderList.columns.truckCompany'),          width: 200, render: r => r.truck_company || '-' },
      { label: tt('orderList.columns.crossBorderLocation'),   width: 200, render: r => r.cross_border_location || '-' },
      { label: tt('orderList.columns.crossBorderTime'),       width: 200, render: r => fmtDateTime(r.cross_border_time) || '-' },
      { label: tt('orderList.columns.parse'),                 width: 200, render: r => r.logistic_parse || '-' },
      { label: tt('orderList.columns.shippingUnits'),         width: 200, render: r => r.cbm != null ? String(r.cbm) : '-' },
      { label: tt('orderList.columns.portEta'),               width: 150, render: r => fmtDate(r.portETA) || '-' },
      { label: tt('logistic.columns.pickupDate'),             width: 200, render: r => fmtDate(r.pickup_container_date) || '-' },
      { label: tt('logistic.columns.returnDate'),             width: 200, render: r => fmtDate(r.return_container_date) || '-' },
      { label: tt('logistic.columns.warehouseArrivalDate'),   width: 200, render: r => fmtDate(r.warehouse_arrival_date) || '-' },
      { label: tt('orderList.columns.note'),                  width: 200, render: r => r.container_note || '-' },
      {
        label: tt('logistic.columns.containerStatus'), width: 200,
        render: r => {
          const v = r.container_status ?? r.status;
          const n = Number(v);
          return (
            <span className={truckStatusClass(v)}>
              {statusMap[n] ? tt(statusMap[n]) : String(v ?? '-')}
            </span>
          );
        },
      },
    ];
  }, [tt]);

  // ── Extra action buttons per row
  const extraActions = useCallback((row: any) => (
    <>
      {Number(row.container_status) !== 3 && (
        <Button size="sm" color="primary" outline className="sl-confirm-btn" onClick={() => handleExamine(row)}>
          {tt('common.confirm')}
        </Button>
      )}
      <Button size="sm" color="info" outline onClick={() => handleTrack(row)}>
        {tt('orderList.table.viewTrack')}
      </Button>
    </>
  ), [handleExamine, handleTrack, tt]);

  return (
    <>
      <ServiceListPage
        title="Truck — Logistic"
        breadcrumb="Customer Order / Truck"
        endpoint={TRUCK_LOGISTIC_TICKET_DETAILS}
        statusService="logistic_truck"
        detailRoute="/order_run/info/t_info"
        detailExtraParams="view_id=logistic"
        identifierField="container_number"
        noteTaskIdField="truck_logistic_id"
        columns={COLUMNS}
        extraActions={extraActions}
        refreshKey={refreshKey}
        rowsRef={rowsRef}
        statusTabsOverride={statusTabs}
        allStatusValue="5"
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

      {/* ── Track modal ── */}
      <Modal isOpen={trackOpen} toggle={closeTrack} size="lg">
        <ModalHeader toggle={closeTrack}>
          {tt('orderList.table.viewTrack')} — {trackContainerNo || '-'}
        </ModalHeader>
        <ModalBody>
          {trackLoading && (
            <div className="text-center py-4"><Spinner color="primary" /></div>
          )}
          {trackError && <Alert color="danger">{trackError}</Alert>}
          {!trackLoading && !trackError && trackEvents.length === 0 && (
            <Alert color="info" className="mb-0">{tt('common.noData')}</Alert>
          )}
          {!trackLoading && trackEvents.length > 0 && (
            <TrackTimeline
              events={trackEvents}
              containerNo={trackContainerNo}
              tt={tt}
              safeStr={safeStr}
              newestFirst={true}
            />
          )}
        </ModalBody>
      </Modal>

      {/* ── Confirm (examine) modal ── */}
      <Modal isOpen={examineOpen} toggle={closeExamine} size="sm">
        <ModalHeader toggle={closeExamine}>
          {tt('common.confirm')} — {examineRow?.container_number || '-'}
        </ModalHeader>
        <ModalBody>
          <FormGroup tag="fieldset">
            <FormGroup check>
              <Input
                type="radio"
                name="examineType"
                checked={examineType === 'approve'}
                onChange={() => { setExamineType('approve'); setExamineError(''); }}
              />
              <Label check>{tt('common.approve')}</Label>
            </FormGroup>
            <FormGroup check className="mt-2">
              <Input
                type="radio"
                name="examineType"
                checked={examineType === 'reject'}
                onChange={() => { setExamineType('reject'); setExamineError(''); }}
              />
              <Label check>{tt('common.reject')}</Label>
            </FormGroup>
          </FormGroup>

          {examineType === 'reject' && (
            <Input
              type="textarea"
              rows={3}
              className="mt-2"
              placeholder="Reason for rejection"
              value={examineNote}
              onChange={e => setExamineNote(e.target.value)}
            />
          )}

          {examineError && (
            <Alert color="danger" className="mt-2 mb-0">{examineError}</Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={closeExamine} disabled={examineLoading}>
            {tt('common.cancel')}
          </Button>
          <Button color="primary" onClick={submitExamine} disabled={examineLoading}>
            {examineLoading ? <Spinner size="sm" className="me-1" /> : null}
            {tt('common.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default TruckLogistic;
