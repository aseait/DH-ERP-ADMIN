import React, { useCallback, useMemo, useState, useRef } from 'react';
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
import { uploadTruckFiles } from '../../slices/file/thunk';
import { updateTruckCbContainer } from '../../slices/parse/thunk';
import { getUserIdFromSession } from '../../helpers/userInformation';

import { buildServiceLabels, useTT } from '../../helpers/useTT';

/** Helper hook to parse URL query string */
function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** TempFiles stores selected files grouped by category name */
type TempFiles = Record<string, any[]>;

// ---- helper: sanitize names so backend mapping works (avoid comma / slash issues)
const sanitizeName = (name: string) =>
  String(name || '')
    .replace(/[,\|/\\]/g, '_')
    .replace(/\s{2,}/g, ' ')
    .trim() || 'unnamed';

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

const UploadTruck: React.FC = () => {
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

  const truck_cb_id = q.get('truck_cb_id') || '';
  const truck_logistic_id = q.get('truck_logistic_id') || '';
  const truck_us_ca_id = q.get('truck_us_ca_id') || '';
  const container_number = q.get('container_number') || '';

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const [qingguanval, setQingguanval] = useState<string>('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[]>([]);

  //Include ALL groups you had (even if UI doesn’t render some, it’s safe)
  const [tempFiles, setTempFiles] = useState<TempFiles>({
    'AN/EMF': [],
    POA: [],
    'Packing List/Invoice': [],
    Others: [],
    Pickup: [],
    Telex: [],
    HBL: [],
    MBL: [],
    'Delivery Instructions': [],
    INV: [],
    Parse: [],
    CAD: [],
    'Separate Cargo Files': [],
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

    // if user selected nothing
    if (totalFileCount === 0) missing.push(tt('uploadTruck.missing.atLeastOneFile'));

    // type 2/3/4 -> AN/EMF required
    if (types.includes('2') || types.includes('3') || types.includes('4')) {
      if ((tempFiles['AN/EMF']?.length || 0) <= 0) missing.push(tt('uploadTruck.fileTitles.anEmf'));
    }

    // type 1/3/4 -> Packing required
    if (types.includes('1') || types.includes('3') || types.includes('4')) {
      if ((tempFiles['Packing List/Invoice']?.length || 0) <= 0)
        missing.push(tt('uploadTruck.fileTitles.packingInvoice'));
    }

    // type 3 -> Separate Cargo Files required
    if (types.includes('3')) {
      if ((tempFiles['Separate Cargo Files']?.length || 0) <= 0)
        missing.push(tt('uploadTruck.fileTitles.separateCargoFiles'));
    }

    // Importer (star only, warn but let proceed like Vue confirm)
    if (types.includes('1') && !qingguanval?.trim()) {
      missing.push(tt('uploadTruck.labels.importerPoa'));
    }

    return Array.from(new Set(missing));
  }, [types, tempFiles, qingguanval, totalFileCount, tt]);

  const uploadOneFile = useCallback(
    async (fileRaw: File, groupKey: string) => {
      const safeName = sanitizeName(fileRaw.name);
      const f =
        safeName === fileRaw.name
          ? fileRaw
          : new File([fileRaw], safeName, {
              type: fileRaw.type,
              lastModified: fileRaw.lastModified,
            });

      // Only send service IDs for selected services to avoid “extra service” confusion.
      const payload: any = {
        files: [f],
        sub_categories: { type: groupKey, value: safeName },

        ...(types.includes('1') && truck_cb_id
          ? { truck_cb_ids: String(truck_cb_id), truck_cb_id: String(truck_cb_id) }
          : {}),
        ...(types.includes('2') && truck_logistic_id
          ? {
              truck_logistic_ids: String(truck_logistic_id),
              truck_logistic_id: String(truck_logistic_id),
            }
          : {}),
        ...(types.includes('3') && truck_us_ca_id
          ? { truck_us_ca_ids: String(truck_us_ca_id), truck_us_ca_id: String(truck_us_ca_id) }
          : {}),

        ...(container_number ? { container_number: String(container_number) } : {}),

        updates: [],
        poa: qingguanval?.trim() || '',
      };

      await dispatch(uploadTruckFiles(payload));
    },
    [dispatch, types, truck_cb_id, truck_logistic_id, truck_us_ca_id, container_number, qingguanval]
  );

  const doUpload = useCallback(async () => {
    setErr('');
    setSubmitting(true);

    try {
      const uploadedPoaName = await addPoaRef.current?.submitPoa();

      const finalImporterName = String(uploadedPoaName || qingguanval || '').trim();

      // 1) Upload all files one-by-one
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

      // 2) Update importer
      if (finalImporterName && truck_cb_id) {
        await dispatch(
            updateTruckCbContainer({
              truck_cb_id,
              importer: finalImporterName,
            })
        );
      }

      toast.success(tt('uploadTruck.success.filesUploaded') || 'Files uploaded successfully', { autoClose: 2500 });
      nav('/order_run/list/all');
    } catch (e: any) {
      setErr(e?.message || tt('uploadTruck.errors.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [tempFiles, totalFileCount, uploadOneFile, qingguanval, truck_cb_id, dispatch, nav, tt]);

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

    if (missing.length > 0) {
      setMissingRequired(missing);
      setConfirmOpen(true);
      return;
    }

    await doUpload();
  }, [types, getMissingRequired, doUpload, tt]);


  const serviceLabelText = useMemo(() => {
    return buildServiceLabels(
      types,
      tt,
      {
        '1': 'uploadTruck.serviceOptions.customs',
        '2': 'uploadTruck.serviceOptions.pickupDelivery',
        '3': 'uploadTruck.serviceOptions.usaToCanada',
        '4': 'uploadTruck.serviceOptions.type4',
      },
      'uploadTruck.serviceOptions.none'
    );
  }, [types, tt]);

  return (
    <div className="page-content position-relative">
      {submitting ? <Spinners size="lg" /> : null}

      <Modal isOpen={confirmOpen} toggle={() => setConfirmOpen(false)} centered>
        <ModalHeader toggle={() => setConfirmOpen(false)}>
          {tt('uploadTruck.modals.missingFiles.title')}
        </ModalHeader>
        <ModalBody>
          <div className="mb-2">{tt('uploadTruck.modals.missingFiles.desc')}</div>

          {missingRequired.length ? (
            <div className="mt-2">
              <div className="fw-semibold mb-1">
                {tt('uploadTruck.modals.missingFiles.missing')}:
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
            {tt('uploadTruck.actions.cancel')}
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
            {tt('uploadTruck.actions.proceed')}
          </Button>
        </ModalFooter>
      </Modal>

      <Container fluid className={submitting ? 'opacity-50' : ''}>
        <BreadCrumb title={tt('uploadTruck.title')} pageTitle={tt('uploadTruck.breadcrumb')} />

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <div className="fw-bold fs-5">
              {tt('uploadTruck.prepareListWithServices', { services: serviceLabelText })}
            </div>
          </div>

          <Button color="secondary" onClick={() => nav(-1)} disabled={submitting}>
            {tt('uploadTruck.actions.back')}
          </Button>
        </div>

        {err ? <Alert color="danger">{err}</Alert> : null}

        <Row className="g-3">
          {checkShow(['2', '3', '4']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="AN/EMF"
                    title={tt('uploadTruck.fileTitles.anEmf')}
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

          {checkShow(['1']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <div className="fw-semibold mb-2">
                    {tt('uploadTruck.labels.customsImporter')}{' '}
                    <span className="text-danger">*</span>
                  </div>

                  <AddPoa
                      ref={addPoaRef}
                      userId={userId}
                      onSelect={(name: string) => setQingguanval(name)}
                      disabled={submitting}
                  />

                  <div className="text-muted small mt-2">
                    {tt('uploadTruck.labels.selected')}: {qingguanval || '-'}
                  </div>
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['2', '3']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Hbl"
                    title={tt('uploadTruck.fileTitles.hbl')}
                    required={false}
                    value={tempFiles['HBL']}
                    onChange={(files: any[]) => addFiles('HBL', files)}
                    onRemove={(index: number) => removeFile('HBL', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['2', '3']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Mbl"
                    title={tt('uploadTruck.fileTitles.mbl')}
                    required={false}
                    value={tempFiles['MBL']}
                    onChange={(files: any[]) => addFiles('MBL', files)}
                    onRemove={(index: number) => removeFile('MBL', index)}
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
                    id="Pickup"
                    title={tt('uploadTruck.fileTitles.parsNumber')}
                    required={false}
                    value={tempFiles['Parse']}
                    onChange={(files: any[]) => addFiles('Parse', files)}
                    onRemove={(index: number) => removeFile('Parse', index)}
                    disabled={submitting}
                  />
                </CardBody>
              </Card>
            </Col>
          )}

          {checkShow(['1', '3', '4']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Packing"
                    title={tt('uploadTruck.fileTitles.packingInvoice')}
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

          {checkShow(['3']) && (
            <Col md={6}>
              <Card>
                <CardBody>
                  <UploadFile
                    id="Delivery"
                    title={tt('uploadTruck.fileTitles.separateCargoFiles')}
                    required
                    value={tempFiles['Separate Cargo Files']}
                    onChange={(files: any[]) => addFiles('Separate Cargo Files', files)}
                    onRemove={(index: number) => removeFile('Separate Cargo Files', index)}
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
                  title={tt('uploadTruck.fileTitles.others')}
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
            {submitting ? tt('uploadTruck.actions.submitting') : tt('uploadTruck.actions.submit')}
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default UploadTruck;
