import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  CardBody,
  Button,
  Alert,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import BreadCrumb from '../../Components/Common/BreadCrumb';
import UploadFile from '../Order/Components/UploadFile';
import AddPoa, { type AddPoaRef } from '../Order/Components/AddPoa';
import Spinners from '../../Components/Common/NewSpinner';

import { toast } from 'react-toastify';
import { uploadMarineAndAirFiles } from '../../slices/file/thunk';
import { updateMarineCbTicketDetails } from '../../slices/marine/thunk';
import { getUserIdFromSession } from '../../helpers/userInformation';
import { buildServiceLabels, useTT } from '../../helpers/useTT';
import { getImporterGstDutyApi, listImporterNamesApi } from '../../helpers/api_fetch/poa';

import { fetchMainTicketDetails } from '../../slices/ticketDetails/thunk';
/**
 * Helper hook to parse URL query string:
 */
function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type TempFiles = Record<string, any[]>;

// UploadFile items can be File OR {file: File, name?: string} etc.
const unwrapFile = (it: any): File | null => {
  if (!it) return null;
  if (it instanceof File) return it;
  if (it.file instanceof File) return it.file;
  if (it.originFileObj instanceof File) return it.originFileObj;
  return null;
};

const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

const mergeUnique = (prev: any[], incoming: any[]) => {
  const map = new Map<string, any>();

  (prev || []).forEach((it) => {
    const f = unwrapFile(it);
    const k = f ? fileKey(f) : JSON.stringify(it);
    map.set(k, it);
  });

  (incoming || []).forEach((it) => {
    const f = unwrapFile(it);
    const k = f ? fileKey(f) : JSON.stringify(it);
    map.set(k, it);
  });

  return Array.from(map.values());
};

const UploadMarine: React.FC = () => {
  const { tt } = useTT();
  const q = useQuery();
  const nav = useNavigate();
  const dispatch: any = useDispatch();
  const addPoaRef = useRef<AddPoaRef | null>(null);

  const sessionUserId = getUserIdFromSession?.() || '';
  const clientUserIdParam = q.get('client_user_id') || '';
  const userId = clientUserIdParam || sessionUserId;

  // Services selected on previous page, e.g. "1,2,3"
  const value = q.get('value') || '';
  const types = useMemo(() => (value ? value.split(',') : []), [value]);

  // IDs passed from CreateOrder -> Upload step
  const cb_marine_id = q.get('cb_marine_id') || '';
  const logistic_marine_id = q.get('logistic_marine_id') || '';
  const wms_marine_id = q.get('wms_marine_id') || '';
  const main_id = q.get('main_id') || '';
  const containersParam = q.get('containers') || '';

  const [submitting, setSubmitting] = useState(false);
  const [qingguanval, setQingguanval] = useState<string>(''); // importer name
  const [err, setErr] = useState<string>('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);
  const [noFilesConfirmOpen, setNoFilesConfirmOpen] = useState(false);

  const ticketState = useSelector(
    (s: any) => s?.TicketDetails ?? s?.ticketDetails ?? s?.MainTicketDetails ?? {}
  );
  const ticketResult = ticketState?.result;

  const [tempFiles, setTempFiles] = useState<TempFiles>({
    'AN/EMF': [],
    'Packing List/Invoice': [],
    'BILL OF LADING': [],
    'Delivery Instructions': [],
    Telex: [],
    Pickup: [],
    Others: [],
  });

  const checkShow = useCallback((need: string[]) => need.some((x) => types.includes(x)), [types]);

  const addFiles = useCallback((key: string, files: any[]) => {
    setErr('');
    setTempFiles((prev) => ({
      ...prev,
      [key]: mergeUnique(prev[key] || [], files || []),
    }));
  }, []);

  const removeFile = useCallback((key: string, index: number) => {
    setTempFiles((prev) => {
      const cur = prev[key] || [];
      return { ...prev, [key]: cur.filter((_: any, i: number) => i !== index) };
    });
  }, []);

  const totalFileCount = useMemo(() => {
    return Object.values(tempFiles).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  }, [tempFiles]);

  const getMissingRequired = useCallback((): string[] => {
    const missing: string[] = [];

    if (types.includes('1')) {
      if ((tempFiles['AN/EMF']?.length || 0) <= 0)
        missing.push(tt('uploadMarine.fileTitles.anEmf'));
      if ((tempFiles['Packing List/Invoice']?.length || 0) <= 0)
        missing.push(tt('uploadMarine.fileTitles.packingInvoice'));
      if ((tempFiles['BILL OF LADING']?.length || 0) <= 0)
        missing.push(tt('uploadMarine.fileTitles.billOfLading'));
      // importer is optional per your requirement (warn? you can add it back if you want)
      // if (!qingguanval?.trim()) missing.push(tt("uploadMarine.labels.poaImporter"));
    }

    if (types.includes('2')) {
      if ((tempFiles['AN/EMF']?.length || 0) <= 0)
        missing.push(tt('uploadMarine.fileTitles.anEmf'));
    }

    if (types.includes('3')) {
      if ((tempFiles['Delivery Instructions']?.length || 0) <= 0)
        missing.push(tt('uploadMarine.fileTitles.deliveryInstructions'));
    }

    return Array.from(new Set(missing));
  }, [types, tempFiles, tt]);

  useEffect(() => {
    if (!main_id || containersParam) return;
    dispatch(fetchMainTicketDetails({ main_id } as any));
  }, [dispatch, main_id, containersParam]);

  const containerNumbers: string[] = useMemo(() => {
    if (containersParam) {
      return containersParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z]{4}\d{7}$/.test(s));
    }

    const root = ticketResult?.data?.[0] || ticketResult?.data || ticketResult || {};

    const CONTAINER_RE = /[A-Z]{4}\d{7}/g;

    const parseAnyContainers = (v: any): string[] => {
      const s = String(v ?? '')
          .toUpperCase()
          .trim();

      if (!s) return [];

      const tokens = s
          .split(/[,\s]+/g)
          .map((x) => x.trim())
          .filter(Boolean);

      const validTokens = tokens.filter((t) => /^[A-Z]{4}\d{7}$/.test(t));
      if (validTokens.length) return validTokens;

      return s.match(CONTAINER_RE) || [];
    };

    let all: string[] = [];

    // main-level possible fields
    all = [
      ...all,
      ...parseAnyContainers(root?.container_number),
      ...parseAnyContainers(root?.container_numbers),
      ...parseAnyContainers(root?.container),
    ];

    // CB marine
    const cbMarine = Array.isArray(root?.cb_marine) ? root.cb_marine : [];
    all = [
      ...all,
      ...cbMarine.flatMap((x: any) => parseAnyContainers(x?.container_number)),
    ];

    // Logistic marine
    const logisticMarine = Array.isArray(root?.logistic_marine) ? root.logistic_marine : [];
    all = [
      ...all,
      ...logisticMarine.flatMap((x: any) => parseAnyContainers(x?.container_number)),
    ];

    // WMS marine
    const wmsMarine = Array.isArray(root?.wms_marine) ? root.wms_marine : [];
    all = [
      ...all,
      ...wmsMarine.flatMap((x: any) => parseAnyContainers(x?.container_number)),
    ];

    // Generic containers
    const containers = Array.isArray(root?.containers) ? root.containers : [];
    all = [
      ...all,
      ...containers.flatMap((x: any) => parseAnyContainers(x?.container_number)),
    ];

    // Possible backend names for logistic containers
    const logisticContainers = Array.isArray(root?.logistic_containers)
        ? root.logistic_containers
        : Array.isArray(root?.logistic_marine_containers)
            ? root.logistic_marine_containers
            : Array.isArray(root?.dh_logistic_marine_container)
                ? root.dh_logistic_marine_container
                : [];

    all = [
      ...all,
      ...logisticContainers.flatMap((x: any) => parseAnyContainers(x?.container_number)),
    ];

    const seen = new Set<string>();

    return all
        .map((n) => String(n || '').toUpperCase().trim())
        .filter(Boolean)
        .filter((n) => {
          if (seen.has(n)) return false;
          seen.add(n);
          return true;
        });
  }, [containersParam, ticketResult]);

  // ===== Importer GST sync helpers (same logic as MarineDetails) =====
  const fetchImporterIdByName = useCallback(
    async (name: string): Promise<number | null> => {
      const clean = String(name || '').trim();
      if (!clean || !userId) return null;

      const data: any = await listImporterNamesApi({ user_id: userId, status: 0 });
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      const row = (list || []).find(
        (x: any) =>
          String(x?.Name || '')
            .trim()
            .toLowerCase() === clean.toLowerCase()
      );

      const id = row?.id;
      if (id === null || id === undefined || id === '') return null;
      const n = Number(id);
      return Number.isFinite(n) ? n : null;
    },
    [userId]
  );

  const fetchImporterGstDuty01 = useCallback(
    async (importerName: string): Promise<0 | 1 | null> => {
      try {
        const importer_id = await fetchImporterIdByName(importerName);
        if (!importer_id || !userId) return null;

        const resp: any = await getImporterGstDutyApi({
          user_id: String(userId),
          importer_id: Number(importer_id),
        });

        const rows = Array.isArray(resp?.data) ? resp.data : [];
        const row = rows.find((r: any) => Number(r?.importer_id) === Number(importer_id));
        if (!row) return null;

        return Number(row?.gst_duty) === 1 ? 1 : 0;
      } catch {
        return null;
      }
    },
    [fetchImporterIdByName, userId]
  );

  /**
   * IMPORTANT: Match your WORKING MarineDetails upload format.
   * Upload ONE file per request with sub_categories as {type,value}.
   * This prevents everything being saved as "Others".
   */
  const uploadOneFile = useCallback(
    async (f: File, groupKey: string) => {
      const includeWms = types.includes('3') && !!wms_marine_id;

      const payload: any = {
        files: [f],
        sub_categories: { type: groupKey, value: f.name },

        // Only send ids for selected services (prevents extra warehouse weirdness)
        ...(types.includes('1') && cb_marine_id ? { cb_marine_ids: String(cb_marine_id) } : {}),
        ...(types.includes('2') && logistic_marine_id
          ? { logistic_marine_ids: String(logistic_marine_id) }
          : {}),
        ...(includeWms
          ? { wms_marine_ids: String(wms_marine_id), wms_marine_id: String(wms_marine_id) }
          : {}),

        updates: [],
      };

      await dispatch(uploadMarineAndAirFiles(payload));
    },
    [dispatch, types, cb_marine_id, logistic_marine_id, wms_marine_id]
  );

  const doUpload = useCallback(async () => {
    setErr('');
    setSubmitting(true);

    try {
      // 1) Upload POA first from AddPoa component
      // If user only selected existing importer, this returns selected importer name.
      // If user entered new POA + picked file, this uploads POA with status = 7.
      const uploadedPoaName = await addPoaRef.current?.submitPoa();

      const finalImporterName = String(uploadedPoaName || qingguanval || '').trim();

      // 2) upload normal marine files one by one, keep correct group type
      if (totalFileCount > 0) {
        for (const [groupKey, list] of Object.entries(tempFiles)) {
          const arr = list || [];
          for (const it of arr) {
            const f = unwrapFile(it);
            if (!f) continue;
            await uploadOneFile(f, groupKey);
          }
        }
      }

      // 3) importer optional, but if selected/uploaded -> sync gst_status with importer gst_duty
      if (finalImporterName && cb_marine_id) {
        const gst01 = await fetchImporterGstDuty01(finalImporterName);

        await dispatch(
            updateMarineCbTicketDetails({
              cb_marine_id,
              importer: finalImporterName,
              ...(gst01 === null ? {} : { gst_status: gst01 }),
            })
        );
      }

      toast.success(tt('uploadMarine.success.filesUploaded') || 'Files uploaded successfully', { autoClose: 2500 });
      nav('/order_run/list/all');
    } catch (e: any) {
      setErr(e?.message || tt('uploadMarine.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [
    dispatch,
    tempFiles,
    totalFileCount,
    qingguanval,
    cb_marine_id,
    fetchImporterGstDuty01,
    uploadOneFile,
    nav,
    tt,
  ]);

  const onSubmit = useCallback(async () => {
    if (types.includes('1')) {
      const hasPoa = addPoaRef.current?.hasPoa?.() || false;

      if (!hasPoa) {
        setErr(tt('addPoa.poaRequired'));
        return;
      }
    }

    if (totalFileCount === 0) {
      setNoFilesConfirmOpen(true);
      return;
    }

    const missing = getMissingRequired();
    if (missing.length > 0) {
      setMissingRequired(missing);
      setConfirmOpen(true);
      return;
    }

    await doUpload();
  }, [types, totalFileCount, getMissingRequired, doUpload, tt]);

  const serviceLabelText = useMemo(() => {
    return buildServiceLabels(
      types,
      tt,
      {
        '1': 'uploadTruck.serviceOptions.customs',
        '2': 'uploadTruck.serviceOptions.pickupDelivery',
        '3': 'uploadTruck.serviceOptions.usaToCanada',
      },
      'uploadTruck.serviceOptions.none'
    );
  }, [types, tt]);

  return (
    <div className="page-content position-relative">
      {submitting ? <Spinners /> : null}

      {/* Missing required (warn-only, allow proceed) */}
      <Modal isOpen={confirmOpen} toggle={() => setConfirmOpen(false)} centered>
        <ModalHeader toggle={() => setConfirmOpen(false)}>
          {tt('uploadMarine.modals.missingFiles.title')}
        </ModalHeader>
        <ModalBody>
          <div className="mb-2">{tt('uploadMarine.modals.missingFiles.desc')}</div>
          {missingRequired.length ? (
            <div className="mt-2">
              <div className="fw-semibold mb-1">
                {tt('uploadMarine.modals.missingFiles.missing')}:
              </div>
              <ul className="mb-0">
                {missingRequired.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            outline
            onClick={() => setConfirmOpen(false)}
            disabled={submitting}
          >
            {tt('uploadMarine.actions.cancel')}
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              if (types.includes('1')) {
                const hasPoa = addPoaRef.current?.hasPoa?.() || false;

                if (!hasPoa) {
                  setConfirmOpen(false);
                  setErr(tt('addPoa.poaRequired'));
                  return;
                }
              }
              setConfirmOpen(false);
              await doUpload();
            }}
            disabled={submitting}
          >
            {tt('uploadMarine.actions.proceed')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* No files */}
      <Modal isOpen={noFilesConfirmOpen} toggle={() => setNoFilesConfirmOpen(false)} centered>
        <ModalHeader toggle={() => setNoFilesConfirmOpen(false)}>
          {tt('uploadMarine.modals.noFiles.title')}
        </ModalHeader>
        <ModalBody>{tt('uploadMarine.modals.noFiles.desc')}</ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            outline
            onClick={() => setNoFilesConfirmOpen(false)}
            disabled={submitting}
          >
            {tt('uploadMarine.actions.cancel')}
          </Button>
          <Button
            color="primary"
            onClick={async () => {
              if (types.includes('1')) {
                const hasPoa = addPoaRef.current?.hasPoa?.() || false;

                if (!hasPoa) {
                  setNoFilesConfirmOpen(false);
                  setErr(tt('addPoa.poaRequired'));
                  return;
                }
              }

              setNoFilesConfirmOpen(false);
              await doUpload();
            }}
            disabled={submitting}
          >
            {tt('uploadMarine.actions.proceed')}
          </Button>
        </ModalFooter>
      </Modal>

      <Container fluid className={submitting ? 'opacity-50 pointer-events-none' : ''}>
        <BreadCrumb title={tt('uploadMarine.title')} pageTitle={tt('uploadMarine.breadcrumb')} />

        <Card className="mb-3 cn-card">
          <CardBody className="cn-body">
            <div className="cn-head">
              <div className="cn-left">
                <div className="cn-label">{tt('orderList.columns.containerNumber')}</div>
              </div>

              {/* optional: right side badge */}
              <div className="cn-right">
                <span className={`cn-dot ${containerNumbers?.length ? 'is-on' : 'is-off'}`} />
              </div>
            </div>

            <div className="cn-list">
              {containerNumbers?.length ? (
                containerNumbers.map((no) => (
                  <div key={no} className="cn-chip">
                    <span className="cn-chip__icon">📦</span>
                    <span className="cn-chip__text">{no}</span>
                  </div>
                ))
              ) : (
                <div className="cn-empty">-</div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {tt('uploadMarine.prepareListWithServices', { services: serviceLabelText })}
            </div>
          </div>

          <Button color="secondary" onClick={() => nav(-1)} disabled={submitting}>
            {tt('uploadMarine.actions.back')}
          </Button>
        </div>

        {err ? <Alert color="danger">{err}</Alert> : null}

        <Row className="g-3">
          {checkShow(['1', '2']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="AN/EMF"
                    title={tt('uploadMarine.fileTitles.anEmf')}
                    required
                    value={tempFiles['AN/EMF']}
                    onChange={(files: any[]) => addFiles('AN/EMF', files)}
                    onRemove={(index: number) => removeFile('AN/EMF', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['2']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Telex"
                    title={tt('uploadMarine.fileTitles.telex')}
                    required={false}
                    value={tempFiles['Telex']}
                    onChange={(files: any[]) => addFiles('Telex', files)}
                    onRemove={(index: number) => removeFile('Telex', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['2']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Pickup"
                    title={tt('uploadMarine.fileTitles.pickupNumber')}
                    required={false}
                    value={tempFiles['Pickup']}
                    onChange={(files: any[]) => addFiles('Pickup', files)}
                    onRemove={(index: number) => removeFile('Pickup', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['1']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>
                    {tt('uploadMarine.labels.customsImporter')}
                  </div>

                  <AddPoa
                      ref={addPoaRef}
                      userId={userId}
                      onSelect={(name: string) => setQingguanval(name)}
                      disabled={submitting}
                  />

                  <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                    {tt('uploadMarine.labels.selected')}: {qingguanval || '-'}
                  </div>
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['1']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Packing"
                    title={tt('uploadMarine.fileTitles.packingInvoice')}
                    required
                    value={tempFiles['Packing List/Invoice']}
                    onChange={(files: any[]) => addFiles('Packing List/Invoice', files)}
                    onRemove={(index: number) => removeFile('Packing List/Invoice', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['1']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="BILL"
                    title={tt('uploadMarine.fileTitles.billOfLading')}
                    required
                    value={tempFiles['BILL OF LADING']}
                    onChange={(files: any[]) => addFiles('BILL OF LADING', files)}
                    onRemove={(index: number) => removeFile('BILL OF LADING', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['3']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Delivery"
                    title={tt('uploadMarine.fileTitles.deliveryInstructions')}
                    required
                    value={tempFiles['Delivery Instructions']}
                    onChange={(files: any[]) => addFiles('Delivery Instructions', files)}
                    onRemove={(index: number) => removeFile('Delivery Instructions', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          <Col md={6}>
            <Card>
              <CardBody>
                <UploadFile
                  id="Others"
                  title={tt('uploadMarine.fileTitles.others')}
                  required={false}
                  value={tempFiles['Others']}
                  onChange={(files: any[]) => addFiles('Others', files)}
                  onRemove={(index: number) => removeFile('Others', index)}
                  disabled={submitting}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>

        <div className="d-flex justify-content-center mt-4">
          <Button color="primary" style={{ width: 250 }} onClick={onSubmit} disabled={submitting}>
            {submitting ? tt('uploadMarine.actions.submitting') : tt('uploadMarine.actions.submit')}
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default UploadMarine;
