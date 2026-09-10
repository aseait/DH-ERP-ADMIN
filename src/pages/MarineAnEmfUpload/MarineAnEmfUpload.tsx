import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Input,
  Label,
  Row,
  Spinner,
} from 'reactstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';

import { uploadMarineCbAnEmfOnly } from '../../slices/anemf/thunk';
import { resetAnEmfState } from '../../slices/anemf/reducer';
import DragCaptcha, { DragCaptchaRef } from '../../Components/Common/DragCaptcha';


const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

const isAllowedFile = (file: File) => {
  const name = String(file?.name || '').toLowerCase();
  return ALLOWED_EXT.some((ext) => name.endsWith(ext));
};

const MarineAnEmfUpload: React.FC = () => {
  const dispatch: any = useDispatch();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captchaRef = useRef<DragCaptchaRef | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [captchaPassed, setCaptchaPassed] = useState(false);

  const { uploading, lastUploadResponse, error, errorMsg } = useSelector((state: any) => ({
    uploading: state.AnEmf?.uploading ?? false,
    lastUploadResponse: state.AnEmf?.lastUploadResponse ?? null,
    error: state.AnEmf?.error ?? '',
    errorMsg: state.AnEmf?.errorMsg ?? false,
  }));

  useEffect(() => {
    return () => {
      dispatch(resetAnEmfState());
    };
  }, [dispatch]);

  const clearMessages = () => {
    setLocalError('');
    setSuccessMsg('');
    dispatch(resetAnEmfState());
  };

  const resetFileInput = () => {
    const input = fileInputRef.current;
    if (input) {
      input.value = '';
    }
  };

  const resetCaptcha = () => {
    setCaptchaPassed(false);
    captchaRef.current?.resetResult();
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearMessages();

    const picked = Array.from(e.target.files || []);

    if (!picked.length) {
      setFiles([]);
      return;
    }

    const invalidFiles = picked.filter((f) => !isAllowedFile(f));
    if (invalidFiles.length) {
      setFiles([]);
      setLocalError(
          `Only PDF, JPG, JPEG, PNG files are allowed. Invalid file(s): ${invalidFiles
              .map((f) => f.name)
              .join(', ')}`
      );
      resetFileInput();
      return;
    }

    setFiles(picked);
  };

  const handleSubmit = async () => {
    clearMessages();

    if (!token) {
      setLocalError('Missing or invalid upload link.');
      return;
    }

    if (!files.length) {
      setLocalError('Please choose file(s) first.');
      return;
    }

    if (!captchaPassed) {
      setLocalError('Please complete the slide verification first.');
      return;
    }

    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('token', token);

      const data = await dispatch(uploadMarineCbAnEmfOnly(formData));

      const uploadedCount = files.length;
      const successMessage =
          data?.message ||
          `Successfully uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''}.`;

      setSuccessMsg(successMessage);
      setFiles([]);
      resetFileInput();
      resetCaptcha();
    } catch (err: any) {
      setLocalError(
          typeof err === 'string' ? err : err?.message || 'Upload failed. Please try again.'
      );
      resetCaptcha();
    }
  };

  return (
      <div className="marine-an-emf-upload">
        <Container>
          <Row className="justify-content-center">
            <Col md={10} lg={7} xl={6}>
              <Card className="marine-an-emf-upload__card">
                <CardBody className="marine-an-emf-upload__card-body">
                  <div className="marine-an-emf-upload__header">
                    <h3 className="marine-an-emf-upload__title">EMF Upload</h3>
                    <p className="marine-an-emf-upload__subtitle">
                      Marine Customs Brokerage Shipment
                    </p>
                  </div>

                  <div className="marine-an-emf-upload__info-box">
                    <div className="marine-an-emf-upload__info-row">
                      <strong>File Type:</strong> EMF
                    </div>
                    <div className="marine-an-emf-upload__info-row">
                      <strong>Upload Link:</strong> {token ? 'Valid link detected' : 'Invalid link'}
                    </div>
                  </div>

                  {successMsg ? <Alert color="success">{successMsg}</Alert> : null}

                  {!successMsg && lastUploadResponse?.message ? (
                      <Alert color="success">{lastUploadResponse.message}</Alert>
                  ) : null}

                  {localError ? <Alert color="danger">{localError}</Alert> : null}

                  {!localError && errorMsg && error ? (
                      <Alert color="danger">{String(error)}</Alert>
                  ) : null}

                  <div className="marine-an-emf-upload__section">
                    <Label className="form-label">Choose Files</Label>
                    <Input
                        innerRef={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        onChange={handlePickFile}
                    />
                    <div className="marine-an-emf-upload__helper-text">
                      Only PDF, JPG, JPEG, PNG files are allowed.
                    </div>
                  </div>

                  <div className="marine-an-emf-upload__selected-box">
                    <strong>Selected Files:</strong>{' '}
                    {files.length ? (
                        <ul className="marine-an-emf-upload__file-list">
                          {files.map((f, index) => (
                              <li key={`${f.name}-${index}`}>{f.name}</li>
                          ))}
                        </ul>
                    ) : (
                        'No file selected'
                    )}
                  </div>

                  <div className="marine-an-emf-upload__section">
                    <Label className="form-label">Verification</Label>
                    <DragCaptcha
                        ref={captchaRef}
                        value={captchaPassed}
                        onChange={setCaptchaPassed}
                    />
                  </div>

                  <Button
                      color="primary"
                      className="marine-an-emf-upload__submit-btn"
                      disabled={uploading || !files.length || !token || !captchaPassed}
                      onClick={handleSubmit}
                  >
                    {uploading ? (
                        <>
                          <Spinner size="sm" className="me-2" />
                          Uploading...
                        </>
                    ) : (
                        `Upload EMF${files.length > 1 ? ` (${files.length} files)` : ''}`
                    )}
                  </Button>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
  );
};

export default MarineAnEmfUpload;