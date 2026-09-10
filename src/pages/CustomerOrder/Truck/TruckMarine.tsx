import React, { useState, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Badge,
    Button,
    Input,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Spinner,
} from 'reactstrap';
import { toast } from 'react-toastify';
import { useTT } from '../../../helpers/useTT';
import { RESTRICT } from '../../../helpers/userInformation';
import ServiceListPage, {
    cadStatusLabel,
    customStatusMarine,
    fmtDate,
    fmtDateTime,
    statusLabel,
    type ColDef,
} from '../_ServiceListPage';
import {
    MARINE_CONTAINER_EVENTS,
    TRUCK_CB_TICKET_DETAILS,
    UPDATE_TRUCK_CB_CONTAINER,
    UPLOAD_MARINE_EXCEL,
} from '../../../helpers/url_helper';
import { buildApiUrl } from '../../../helpers/apiBase';

// Session-local history map for examine reject/re-approve flow (mirrors Vue orderStore)
const examineHistoryMap = new Map<string, number>();

const calcNextStatus = (row: any): number => {
    const status = Number(row.status);
    if (status === 10) return 7;
    if (status === 6) {
        const saved = examineHistoryMap.get(String(row.truck_cb_id));
        examineHistoryMap.delete(String(row.truck_cb_id));
        return saved ?? 1;
    }
    if (status === 4) {
        examineHistoryMap.delete(String(row.truck_cb_id));
    }
    return status + 1;
};

const canClickExamine = (row: any): boolean => {
    const status = Number(row.status);
    if (status === 10) return true;
    return !((status === 1 && Number(row.cad_status) !== 2) || (status === 3 && Number(row.custom_status) !== 4));
};

const customStatusClass = (v: unknown): string => {
    const n = Number(v);
    if (n === 4) return 'sl-text-success';
    if (n === 2 || n === 5) return 'sl-text-danger';
    if (n === 0 || n === 1 || n === 9 || n === 34) return 'sl-text-warning';
    return 'sl-text-primary';
};

const statusClass = (status: unknown): string => {
    const n = Number(status);
    if (n === 6 || n === 7) return 'sl-text-danger';
    if (n === 10) return 'sl-text-warning';
    return 'sl-text-success';
};

const TruckMarine: React.FC = () => {
    const { tt } = useTT();

    const COLUMNS = useMemo<ColDef[]>(() => [
        {
            label: tt('orderList.columns.containerNumber'),
            width: 180,
            render: r => r.container_number || '-',
            getTitle: r => r.container_number || '',
        },
        { label: tt('orderList.columns.destination'),         width: 120, render: r => r.destination || '-',                        getTitle: r => r.destination || '' },
        { label: tt('orderList.columns.parse'),               width: 130, render: r => r.cb_parse || r.parse_value || '-',           getTitle: r => r.cb_parse || r.parse_value || '' },
        { label: tt('orderList.columns.crossBorderLocation'), width: 160, render: r => r.cross_border_location || '-',               getTitle: r => r.cross_border_location || '' },
        { label: tt('orderList.columns.crossBorderTime'),     width: 160, render: r => fmtDateTime(r.cross_border_time) || '-', getTitle: r => fmtDateTime(r.cross_border_time) },
        { label: tt('orderList.columns.transaction'),         width: 160, render: r => r.transaction || '-',                        getTitle: r => r.transaction || '' },
        { label: tt('orderList.columns.cad'),       width: 110, render: r => cadStatusLabel(r.cad_status, tt) },
        {
            label: tt('orderList.columns.iidStatus'), width: 160,
            render: r => <span className={customStatusClass(r.custom_status)}>{customStatusMarine(r.custom_status, tt)}</span>,
            getTitle: r => customStatusMarine(r.custom_status, tt),
        },
        { label: tt('orderList.columns.customStatusTime'), width: 160, render: r => fmtDateTime(r.custom_status_time) || '-', getTitle: r => fmtDateTime(r.custom_status_time) },
        { label: tt('orderList.columns.importer'),         width: 150, render: r => r.importer || '-',          getTitle: r => r.importer || '' },
        { label: tt('orderList.columns.note'),             width: 150, render: r => r.note || '-',              getTitle: r => r.note || '' },
        {
            label: tt('orderList.columns.status'), width: 110,
            render: r => <span className={statusClass(r.status)}>{statusLabel(r.status, tt)}</span>,
        },
    ], [tt]);


    const [refreshKey, setRefreshKey] = useState(0);
    const rowsRef = useRef<any[]>([]);
    const uploadRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const exportToExcel = () => {
      const headers = ['Container Number','Destination','Parse','Cross Border Location','Cross Border Time','Transaction','CAD Status','IID Status','Custom Status Time','Importer','Note','Order Status'];
      const data = rowsRef.current.map(r => [
        r.container_number||'', r.destination||'', r.cb_parse||r.parse_value||'',
        r.cross_border_location||'', r.cross_border_time||'', r.transaction||'',
        cadStatusLabel(r.cad_status, tt), customStatusMarine(r.custom_status, tt),
        r.custom_status_time||'', r.importer||'', r.note||'',
        statusLabel(r.status, tt),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, 'Truck_Customs_Report.xlsx');
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

    // ── Examine dialog ──
    const [examineOpen, setExamineOpen] = useState(false);
    const [examineRow, setExamineRow] = useState<any>(null);
    const [examineType, setExamineType] = useState<'1' | '2'>('1');
    const [examineNote, setExamineNote] = useState('');
    const [examineLoading, setExamineLoading] = useState(false);

    // ── Track modal ──
    const [trackOpen, setTrackOpen] = useState(false);
    const [trackContainer, setTrackContainer] = useState('');
    const [trackData, setTrackData] = useState<any[]>([]);
    const [trackLoading, setTrackLoading] = useState(false);

    const openExamine = useCallback((row: any) => {
        setExamineRow(row);
        setExamineType('1');
        setExamineNote('');
        setExamineOpen(true);
    }, []);

    const openTrack = useCallback(async (row: any) => {
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

    const submitExamine = useCallback(async () => {
        if (!examineRow) return;

        if (examineType === '2' && !examineNote.trim()) {
            toast.warning(tt('serviceList.rejectNoteRequired'));
            return;
        }

        setExamineLoading(true);
        try {
            let payload: Record<string, any>;

            if (examineType === '1') {
                const nextStatus = calcNextStatus(examineRow);
                payload = { truck_cb_id: examineRow.truck_cb_id, status: nextStatus };
            } else {
                examineHistoryMap.set(String(examineRow.truck_cb_id), Number(examineRow.status));
                payload = { truck_cb_id: examineRow.truck_cb_id, status: 6, note: examineNote };
            }

            await fetch(buildApiUrl(UPDATE_TRUCK_CB_CONTAINER), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            setExamineOpen(false);
            setRefreshKey(k => k + 1);
        } catch {
            // silent
        } finally {
            setExamineLoading(false);
        }
    }, [examineRow, examineType, examineNote]);

    const extraActions = useCallback((row: any) => (
        <>
            {Number(row.status) !== 5 && (
                <Button
                    size="sm"
                    color="primary"
                    outline
                    className="sl-confirm-btn"
                    disabled={!canClickExamine(row)}
                    onClick={() => openExamine(row)}
                >
                    {tt('common.confirm')}
                </Button>
            )}
            <Button
                size="sm"
                color="info"
                outline
                onClick={() => openTrack(row)}
            >
                {tt('orderList.table.viewTrack')}
            </Button>
        </>
    ), [openExamine, openTrack, tt]);

    return (
        <>
            <ServiceListPage
                title="Truck — Customs Brokerage"
                breadcrumb="Customer Order / Truck"
                endpoint={TRUCK_CB_TICKET_DETAILS}
                statusService="cb_truck"
                detailRoute="/order_run/info/t_info"
                detailExtraParams="view_id=customs"
                identifierField="container_number"
                updateAssignEndpoint={UPDATE_TRUCK_CB_CONTAINER}
                updateAssignIdField="truck_cb_id"
                assignRestrictions={RESTRICT.ASSIGN_TRUCK_CB}
                columns={COLUMNS}
                cadStatusFilter
                customStatusFilterMarine
                transactionFilter
                parsFilter
                customStatusTimeFilter
                allStatusValue="7"
                refreshKey={refreshKey}
                extraActions={extraActions}
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
            />

            {/* ── Examine Dialog ── */}
            <Modal isOpen={examineOpen} toggle={() => setExamineOpen(false)}>
                <ModalHeader toggle={() => setExamineOpen(false)}>
                    {tt('common.confirm')}
                </ModalHeader>
                <ModalBody>
                    <div className="d-flex gap-3 mb-3">
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="exam-pass"
                                name="examType"
                                checked={examineType === '1'}
                                onChange={() => setExamineType('1')}
                            />
                            <label className="form-check-label" htmlFor="exam-pass">
                                {tt('common.approve')}
                            </label>
                        </div>
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="exam-reject"
                                name="examType"
                                checked={examineType === '2'}
                                onChange={() => setExamineType('2')}
                            />
                            <label className="form-check-label" htmlFor="exam-reject">
                                {tt('common.reject')}
                            </label>
                        </div>
                    </div>
                    {examineType === '2' && (
                        <Input
                            placeholder={tt('info.txt79')}
                            value={examineNote}
                            onChange={e => setExamineNote(e.target.value)}
                        />
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" onClick={() => setExamineOpen(false)}>
                        {tt('common.cancel')}
                    </Button>
                    <Button color="primary" onClick={submitExamine} disabled={examineLoading}>
                        {examineLoading && <Spinner size="sm" className="me-1" />}
                        {tt('common.confirm')}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* ── Track Modal ── */}
            <Modal isOpen={trackOpen} toggle={() => setTrackOpen(false)} size="lg" scrollable>
                <ModalHeader toggle={() => setTrackOpen(false)}>
                    {tt('tracking.title')}{trackContainer ? ` — ${trackContainer}` : ''}
                </ModalHeader>
                <ModalBody style={{ maxHeight: 500, overflowY: 'auto' }}>
                    {trackLoading && (
                        <div className="text-center py-4">
                            <Spinner color="primary" />
                        </div>
                    )}
                    {!trackLoading && trackData.length === 0 && (
                        <div className="text-center text-muted py-4">{tt('tracking.noData')}</div>
                    )}
                    {!trackLoading && trackData.map((ev: any, i: number) => (
                        <div key={i} className="d-flex gap-3 mb-3 pb-3 border-bottom">
                            <div className="text-muted flex-shrink-0" style={{ minWidth: 140, fontSize: 12 }}>
                                {ev.event_time || ''}
                            </div>
                            <div>
                                <div className="fw-medium">{ev.location || ''}</div>
                                <div className="text-muted small">{ev.description || ''}</div>
                            </div>
                        </div>
                    ))}
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onClick={() => setTrackOpen(false)}>
                        {tt('common.confirm')}
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
};

export default TruckMarine;
