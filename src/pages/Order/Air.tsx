import React, {useCallback, useMemo, useRef, useState} from 'react';
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
import { useDispatch } from 'react-redux';

import BreadCrumb from '../../Components/Common/BreadCrumb';
import UploadFile from '../Order/Components/UploadFile';
import AddPoa, { type AddPoaRef } from '../Order/Components/AddPoa';
import Spinners from '../../Components/Common/NewSpinner';

import { toast } from 'react-toastify';
import { uploadMarineAndAirFiles } from '../../slices/file/thunk';
import { updateAirCbTicketDetails } from '../../slices/air/thunk';
import { getUserIdFromSession } from '../../helpers/userInformation';
import { buildServiceLabels, useTT } from '../../helpers/useTT';

import { getImporterGstDutyApi, listImporterNamesApi } from '../../helpers/api_fetch/poa';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// UploadFile items can be File OR {file: File, name/date...} like your Vue component style
type UploadItem = any;
type TempFiles = Record<string, UploadItem[]>;

const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

const unwrapFile = (it: any): File | null => {
  if (!it) return null;
  if (it instanceof File) return it;
  if (it.file instanceof File) return it.file;
  if (it.originFileObj instanceof File) return it.originFileObj;
  return null;
};

const mergeUnique = (prev: UploadItem[], incoming: UploadItem[]) => {
  const map = new Map<string, UploadItem>();
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

const UploadAir: React.FC = () => {
  const { tt } = useTT();

  const q = useQuery();
  const nav = useNavigate();
  const dispatch: any = useDispatch();

  const addPoaRef = useRef<AddPoaRef | null>(null);

  const sessionUserId = getUserIdFromSession?.() || '';
  const clientUserIdParam = q.get('client_user_id') || '';
  const userId = clientUserIdParam || sessionUserId;

  const value = q.get('value') || '';
  const types = useMemo(() => (value ? value.split(',') : []), [value]);

  const cb_air_id = q.get('cb_air_id') || '';
  const logistic_air_id = q.get('logistic_air_id') || '';
  const wms_air_id = q.get('wms_air_id') || '';

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  // importer (POA selection)
  const [qingguanval, setQingguanval] = useState<string>('');

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);

  const [tempFiles, setTempFiles] = useState<TempFiles>({
    'AN/EMF': [],
    POA: [],
    'Packing List/Invoice': [],
    Others: [],
    Pickup: [],
    Telex: [],
    'Delivery Instructions': [],
    'BILL OF LADING': [],
    CAD: [],
  });

  const checkShow = useCallback((need: string[]) => need.some((x) => types.includes(x)), [types]);

  const addFiles = useCallback((key: string, files: UploadItem[]) => {
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
      if ((tempFiles['AN/EMF']?.length || 0) <= 0) missing.push(tt('uploadAir.fileTitles.anEmf'));
      if ((tempFiles['Packing List/Invoice']?.length || 0) <= 0)
        missing.push(tt('uploadAir.fileTitles.packingInvoice'));
      if ((tempFiles['BILL OF LADING']?.length || 0) <= 0)
        missing.push(tt('uploadAir.fileTitles.billOfLading'));
      // importer optional: do NOT push into missing anymore
    }

    if (types.includes('3')) {
      if ((tempFiles['Delivery Instructions']?.length || 0) <= 0)
        missing.push(tt('uploadAir.fileTitles.deliveryInstructions'));
    }

    return Array.from(new Set(missing));
  }, [types, tempFiles, tt]);

  // ===== Importer GST sync (same logic as MarineDetails) =====
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
   * Upload ONE file per request with sub_categories as {type,value}.
   */
  const uploadOneFile = useCallback(
    async (f: File, groupKey: string) => {
      const includeCb = types.includes('1') && !!cb_air_id;
      const includeLog = types.includes('2') && !!logistic_air_id;
      const includeWms = types.includes('3') && !!wms_air_id;

      const payload: any = {
        files: [f],
        sub_categories: { type: groupKey, value: f.name },
        ...(includeCb ? { cb_air_ids: String(cb_air_id) } : {}),
        ...(includeLog ? { logistic_air_ids: String(logistic_air_id) } : {}),
        ...(includeWms ? { wms_air_ids: String(wms_air_id) } : {}),
        updates: [],
      };

      await dispatch(uploadMarineAndAirFiles(payload));
    },
    [dispatch, types, cb_air_id, logistic_air_id, wms_air_id]
  );

  const doUpload = useCallback(async () => {
    setErr('');
    setSubmitting(true);

    try {
      const uploadedPoaName = await addPoaRef.current?.submitPoa();

      const finalImporterName = String(uploadedPoaName || qingguanval || '').trim();

      // 2) upload files one by one
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

      // 3) importer optional; if selected/uploaded -> update importer and sync gst_status
      if (finalImporterName && cb_air_id) {
        const gst01 = await fetchImporterGstDuty01(finalImporterName);

        await dispatch(
            updateAirCbTicketDetails({
              cb_air_id,
              importer: finalImporterName,
              ...(gst01 === null ? {} : { gst_status: gst01 }),
            })
        );
      }

      toast.success(tt('uploadAir.success.filesUploaded') || 'Files uploaded successfully', { autoClose: 2500 });
      nav('/order_run/list/all');
    } catch (e: any) {
      setErr(e?.message || tt('uploadAir.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [
    dispatch,
    tempFiles,
    totalFileCount,
    uploadOneFile,
    qingguanval,
    cb_air_id,
    fetchImporterGstDuty01,
    nav,
    tt,
  ]);

  const onSubmit = useCallback(async () => {
    setErr('');

    if (types.includes('1')) {
      const hasPoa = addPoaRef.current?.hasPoa?.() || false;

      if (!hasPoa) {
        setErr(tt('addPoa.poaRequired'));
        return;
      }
    }

    const missing = getMissingRequired();

    // if no files at all
    if (totalFileCount === 0) {
      missing.unshift(tt('uploadAir.missing.atLeastOneFile'));
    }

    if (missing.length > 0) {
      setMissingRequired(Array.from(new Set(missing)));
      setConfirmOpen(true);
      return;
    }

    await doUpload();
  }, [types, getMissingRequired, totalFileCount, doUpload, tt]);

  const serviceLabelText = useMemo(() => {
    return buildServiceLabels(
      types,
      tt,
      {
        '1': 'uploadAir.serviceOptions.customs',
        '2': 'uploadAir.serviceOptions.pickup',
        '3': 'uploadAir.serviceOptions.warehouse',
      },
      'uploadAir.serviceOptions.none'
    );
  }, [types, tt]);

  return (
    <div className="page-content position-relative">
      {submitting ? <Spinners size="lg" /> : null}

      {/* Confirm Modal */}
      <Modal isOpen={confirmOpen} toggle={() => setConfirmOpen(false)} centered>
        <ModalHeader toggle={() => setConfirmOpen(false)}>
          {tt('uploadAir.modals.missingFiles.title')}
        </ModalHeader>
        <ModalBody>
          <div className="mb-2">{tt('uploadAir.modals.missingFiles.desc')}</div>

          {missingRequired.length ? (
            <div className="mt-2">
              <div className="fw-semibold mb-1">{tt('uploadAir.modals.missingFiles.missing')}:</div>
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
            {tt('uploadAir.actions.cancel')}
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
            {tt('uploadAir.actions.proceed')}
          </Button>
        </ModalFooter>
      </Modal>

      <Container fluid className={submitting ? 'opacity-50' : ''}>
        <BreadCrumb title={tt('uploadAir.title')} pageTitle={tt('uploadAir.breadcrumb')} />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="fw-bold fs-5">
              {tt('uploadAir.prepareListWithServices', { services: serviceLabelText })}
            </div>
          </div>

          <Button color="secondary" onClick={() => nav(-1)} disabled={submitting}>
            {tt('uploadAir.actions.back')}
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
                    title={tt('uploadAir.fileTitles.anEmf')}
                    required={types.includes('1') || types.includes('2')}
                    value={tempFiles['AN/EMF']}
                    onChange={(files: any[]) => addFiles('AN/EMF', files)}
                    onRemove={(index: number) => removeFile('AN/EMF', index)}
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
                  <div className="fw-semibold mb-2">
                    {tt('uploadAir.labels.customsImporter')} <span className="text-danger">*</span>
                  </div>

                  <AddPoa
                      ref={addPoaRef}
                      userId={userId}
                      onSelect={(name: string) => setQingguanval(name)}
                      disabled={submitting}
                  />

                  <div className="text-muted small mt-2">
                    {tt('uploadAir.labels.selected')}: {qingguanval || '-'}
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
                    title={tt('uploadAir.fileTitles.packingInvoice')}
                    required={types.includes('1')}
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
                    title={tt('uploadAir.fileTitles.billOfLading')}
                    required={types.includes('1')}
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
                    title={tt('uploadAir.fileTitles.deliveryInstructions')}
                    required={types.includes('3')}
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
                  title={tt('uploadAir.fileTitles.others')}
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
            {submitting ? tt('uploadAir.actions.submitting') : tt('uploadAir.actions.submit')}
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default UploadAir;
