import React, { useState, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
    Button,
    Input,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Spinner,
} from 'reactstrap';
import { useTT } from '../../../helpers/useTT';
import ServiceListPage, { fmtDate, fmtDateTime, type ColDef } from '../_ServiceListPage';
import {
    MARINE_CONTAINER_EVENTS,
    TRUCK_US_TO_CA_TICKET_DETAILS,
    UPDATE_TRUCK_US_TO_CA,
} from '../../../helpers/url_helper';
import { buildApiUrl } from '../../../helpers/apiBase';

// Session-local history for re-approve after rejection (mirrors Vue orderStore for truck_ustoca)
const examineHistoryMap = new Map<string, number>();

const statusClass = (status: any): string => {
    const n = Number(status);
    if (n === 4)  return 'sl-text-danger';
    if (n === 10) return 'sl-text-warning';
    if (n === 8)  return 'sl-text-warning';
    return 'sl-text-success';
};

const calcNextStatus = (row: any): number => {
    const status = Number(row.container_status);
    if (status === 10) return 7;
    if (status === 4) {
        const saved = examineHistoryMap.get(String(row.truck_us_ca_id));
        examineHistoryMap.delete(String(row.truck_us_ca_id));
        return saved ?? 1;
    }
    if (status === 2) { examineHistoryMap.delete(String(row.truck_us_ca_id)); return 8; }
    if (status === 8) return 3;
    if (status === 3) return 6;
    return status + 1;
};

const TruckUsaToCa: React.FC = () => {
    const { tt } = useTT();
    const [refreshKey, setRefreshKey] = useState(0);

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

    const formatServiceType = useCallback((v: any): string => {
        const n = Number(v);
        if (n === 0) return tt('truckUsaToCa.serviceType.usaToCa');
        if (n === 1) return tt('truckUsaToCa.serviceType.caToUsa');
        if (n === 2) return tt('truckUsaToCa.serviceType.dropship');
        if (n === 3) return tt('truckUsaToCa.serviceType.fba');
        if (n === 4) return tt('truckUsaToCa.serviceType.firstMile');
        if (n === 5) return tt('truckUsaToCa.serviceType.thirdParty');
        return '-';
    }, [tt]);

    const formatGoWarehouse = useCallback((v: any): string =>
        Number(v) === 1
            ? tt('truckUsaToCa.goWarehouse.yes')
            : tt('truckUsaToCa.goWarehouse.no'),
    [tt]);

    const statusLabel = useCallback((status: any): string => {
        const n = Number(status);
        if (n === 0) return tt('logistic.status.underReview');
        if (n === 1) return tt('logistic.status.processing');
        if (n === 2) return tt('logistic.status.inTransit');
        if (n === 8) return tt('logistic.status.pendingComplete');
        if (n === 3) return tt('logistic.status.deliveryCompleted');
        if (n === 4) return tt('logistic.status.rejected');
        if (n === 6) return tt('logistic.status.totalCompleted');
        if (n === 10) return tt('logistic.status.deletePending');
        return '-';
    }, [tt]);

    const rowsRef = useRef<any[]>([]);

    const exportToExcel = useCallback(() => {
        const safeDate = (v: any) => (!v || String(v).toLowerCase().startsWith('invalid')) ? '' : v;
        const headers = ['Client','Note','Service Type','Container Number','Go Warehouse','Destination','Destination US','Truck Company','Cross Border Location','Cross Border Time','Parse','Shipping Units','Pickup Date','Warehouse Arrival Date','Container Status','Create Time'];
        const data = rowsRef.current.map(r => [
            r.user_name||'', r.container_note||'', formatServiceType(r.service_type), r.container_number||'',
            formatGoWarehouse(r.go_warehouse), r.destination||'', r.destination_us||'',
            r.truck_company||'', r.cross_border_location||'', safeDate(r.cross_border_time),
            r.parse_value||'', r.cbm??'', safeDate(r.pickup_container_date),
            safeDate(r.warehouse_arrival_date), statusLabel(r.container_status), safeDate(r.create_time),
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, 'Truck_UsaToCa_Report.xlsx');
    }, [formatServiceType, formatGoWarehouse, statusLabel]);

    const STATUS_TABS = useMemo(() => [
        { value: '0',  label: tt('logistic.status.underReview') },
        { value: '1',  label: tt('logistic.status.processing') },
        { value: '2',  label: tt('logistic.status.inTransit') },
        { value: '8',  label: tt('logistic.status.pendingComplete') },
        { value: '3',  label: tt('logistic.status.completed') },
        { value: '6',  label: tt('logistic.status.totalCompleted') },
        { value: '4',  label: tt('logistic.status.rejected') },
        { value: '5',  label: tt('logistic.status.all') },
        { value: '10', label: tt('logistic.status.deletePending') },
    ], [tt]);

    const COLUMNS = useMemo<ColDef[]>(() => [
        { label: tt('orderList.columns.note'),                width: 160, render: r => r.container_note || '-',    getTitle: r => r.container_note || '' },
        { label: tt('orderList.columns.serviceType'),         width: 120, render: r => formatServiceType(r.service_type) },
        { label: tt('orderList.columns.containerNumber'),     width: 180, render: r => r.container_number || '-',  getTitle: r => r.container_number || '' },
        { label: tt('orderList.columns.goWarehouse'),         width: 130, render: r => formatGoWarehouse(r.go_warehouse) },
        { label: tt('orderList.columns.destination'),         width: 130, render: r => r.destination || '-',       getTitle: r => r.destination || '' },
        { label: tt('orderList.columns.destinationUs'),       width: 160, render: r => r.destination_us || '-',   getTitle: r => r.destination_us || '' },
        { label: tt('orderList.columns.truckCompany'),        width: 150, render: r => r.truck_company || '-',     getTitle: r => r.truck_company || '' },
        { label: tt('orderList.columns.crossBorderLocation'), width: 160, render: r => r.cross_border_location || '-', getTitle: r => r.cross_border_location || '' },
        { label: tt('orderList.columns.crossBorderTime'),     width: 150, render: r => fmtDateTime(r.cross_border_time) || '-' },
        { label: tt('orderList.columns.parse'),               width: 120, render: r => r.parse_value || '-' },
        { label: tt('orderList.columns.shippingUnits'),       width: 100, render: r => r.cbm ?? '-' },
        { label: tt('logistic.columns.pickupDate'),           width: 130, render: r => fmtDate(r.pickup_container_date) || '-' },
        { label: tt('logistic.columns.warehouseArrivalDate'), width: 140, render: r => fmtDate(r.warehouse_arrival_date) || '-' },
        {
            label: tt('logistic.columns.containerStatus'), width: 140,
            render: r => <span className={statusClass(r.container_status)}>{statusLabel(r.container_status)}</span>,
        },
        { label: tt('orderList.columns.createTime'),          width: 140, render: r => fmtDateTime(r.create_time) || '-' },
    ], [tt, formatServiceType, formatGoWarehouse, statusLabel]);

    const SORT_FIELD_OPTIONS = useMemo(() => [
        { label: tt('orderList.columns.serviceType'),             value: 'service_type' },
        { label: tt('logistic.columns.pickupDate'),               value: 'pickup_container_date' },
        { label: tt('logistic.columns.warehouseArrivalDate'),     value: 'warehouse_arrival_date' },
        { label: tt('orderList.columns.crossBorderTime'),         value: 'cross_border_time' },
        { label: tt('orderList.columns.containerNumber'),         value: 'container_number' },
    ], [tt]);

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
            alert(tt('message.bohui') || 'Please provide a rejection reason');
            return;
        }

        setExamineLoading(true);
        try {
            let payload: Record<string, any>;

            if (examineType === '1') {
                const nextStatus = calcNextStatus(examineRow);
                payload = {
                    truck_us_ca_id: examineRow.truck_us_ca_id,
                    container_id: examineRow.container_id,
                    containers: [{
                        container_id: examineRow.container_id,
                        container_number: examineRow.container_number,
                        status: nextStatus,
                    }],
                };
            } else {
                examineHistoryMap.set(
                    String(examineRow.truck_us_ca_id),
                    Number(examineRow.container_status),
                );
                payload = {
                    note: examineNote,
                    truck_us_ca_id: examineRow.truck_us_ca_id,
                    container_id: examineRow.container_id,
                    containers: [{
                        container_id: examineRow.container_id,
                        container_number: examineRow.container_number,
                        status: 4,
                    }],
                };
            }

            await fetch(buildApiUrl(UPDATE_TRUCK_US_TO_CA), {
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
    }, [examineRow, examineType, examineNote, tt]);

    const extraActions = useCallback((row: any) => (
        <>
            {Number(row.container_status) !== 6 && (
                <Button
                    size="sm"
                    color="primary"
                    outline
                    className="sl-confirm-btn"
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
                title="Truck — USA to Canada"
                breadcrumb="Customer Order / Truck"
                endpoint={TRUCK_US_TO_CA_TICKET_DETAILS}
                statusService="ustoca_truck"
                detailRoute="/order_run/info/t_info"
                identifierField="container_number"
                columns={COLUMNS}
                serviceTypeFilter
                sortFieldOptions={SORT_FIELD_OPTIONS}
                statusTabsOverride={STATUS_TABS}
                allStatusValue="5"
                refreshKey={refreshKey}
                extraActions={extraActions}
                rowsRef={rowsRef}
                pageActions={
                    <Button color="primary" onClick={exportToExcel}>
                        {tt('serviceList.actions.exportExcel')}
                    </Button>
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
                            placeholder={tt('info.txt64') || 'Rejection reason'}
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
                    {tt('info.txt47') || 'Track'}{trackContainer ? ` — ${trackContainer}` : ''}
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
                        {tt('common.confirm') || 'OK'}
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
};

export default TruckUsaToCa;
