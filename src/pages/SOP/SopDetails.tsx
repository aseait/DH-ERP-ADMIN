import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
} from 'reactstrap';
import { toast } from 'react-toastify';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import FileUploadPicker from '../../Components/Common/FileUploadPicker';
import { openPreview, resolvePreviewUrl } from '../../helpers/filePreview';
import { useTT } from '../../helpers/useTT';
import OfficeInlinePreview from './OfficeInlinePreview';
import { getUserIdFromSession } from '../../helpers/userInformation';
import {
  deleteSopApi,
  incrementSopViewApi,
  retrieveSopCategoriesApi,
  retrieveSopDetailsApi,
  updateSopApi,
} from '../../helpers/api_fetch/sop';
import {
  canAccessSopDh,
  canManageSopDept,
  categoryLabel,
  departmentLabel,
  DOCUMENT_ACCEPT,
  formatFileSize,
  materialTypeColor,
  materialTypeLabel,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_FILES,
  MAX_THUMBNAIL_BYTES,
  MAX_VIDEO_BYTES,
  Sop,
  SopCategory,
  SopFile,
  THUMBNAIL_ACCEPT,
  VIDEO_ACCEPT,
} from './sopConfig';

const useQueryId = (): string => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get('id') || '', [search]);
};

const extOf = (name: string): string => {
  const m = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

const previewKind = (f: SopFile): 'image' | 'pdf' | 'office' | 'none' => {
  const mime = (f.mimeType || '').toLowerCase();
  const ext = extOf(f.originalFileName) || extOf(f.fileUrl);
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  // .docx / .xls(x) / .csv render in-browser (see OfficeInlinePreview); legacy
  // .doc and PowerPoint fall through there to a download panel.
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext) ||
    mime.includes('officedocument') ||
    mime === 'application/msword' ||
    mime === 'text/csv'
  ) {
    return 'office';
  }
  return 'none';
};

// Clicking a filename: Office files download directly (the inline block below
// already renders them); everything else opens via the shared helper (new tab).
const openSopFile = (f: SopFile) => {
  if (previewKind(f) === 'office') {
    window.open(f.fileUrl, '_blank', 'noopener');
  } else {
    openPreview(f.fileUrl);
  }
};

// Inline preview embedded in the page (no click). Hoisted to module scope so its
// <iframe> isn't remounted on every parent re-render.
const DocInlinePreview: React.FC<{ f: SopFile }> = ({ f }) => {
  const kind = previewKind(f);
  if (kind === 'none') return null;

  if (kind === 'office') {
    return <OfficeInlinePreview f={f} />;
  }

  const src = resolvePreviewUrl(f.fileUrl);
  return (
    <div className="mt-2">
      {kind === 'image' ? (
        <img src={src} alt={f.originalFileName} className="img-fluid rounded border" style={{ maxHeight: '70vh' }} />
      ) : (
        <iframe
          src={src}
          title={f.originalFileName}
          className="border rounded w-100"
          style={{ height: '70vh' }}
        />
      )}
    </div>
  );
};

const SopDetails: React.FC = () => {
  const { tt } = useTT();
  const navigate = useNavigate();
  const id = useQueryId();
  const userId = getUserIdFromSession();

  const [sop, setSop] = useState<Sop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setError(tt('sop.details.notFound'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await retrieveSopDetailsApi(id);
      setSop(res?.data || null);
      if (!res?.data) setError(tt('sop.details.notFound'));
    } catch (e: any) {
      setError(e?.message || tt('sop.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, tt]);

  useEffect(() => {
    load();
  }, [load]);

  // Count a view once per mounted id.
  const countedRef = useRef<string | null>(null);
  useEffect(() => {
    if (id && countedRef.current !== id) {
      countedRef.current = id;
      incrementSopViewApi(id).catch(() => {});
    }
  }, [id]);

  const canManage = sop ? canManageSopDept(sop.department) : false;
  const homeHref = sop?.department === 'Public' ? '/sop/public' : '/sop/dh';

  const [copyMsg, setCopyMsg] = useState('');
  const copyShareLink = async () => {
    const url = `${window.location.origin}/sop/details?id=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg(tt('sop.details.linkCopied'));
    } catch {
      setCopyMsg(url);
    }
    setTimeout(() => setCopyMsg(''), 3000);
  };

  // ---------------- Edit modal ----------------
  const [editOpen, setEditOpen] = useState(false);
  const [editCategories, setEditCategories] = useState<SopCategory[]>([]);
  const [eTitle, setETitle] = useState('');
  const [eCategory, setECategory] = useState('');
  const [eDescription, setEDescription] = useState('');
  const [eVideo, setEVideo] = useState<File[]>([]);
  const [eThumb, setEThumb] = useState<File[]>([]);
  const [eDocs, setEDocs] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<number[]>([]);
  const [eError, setEError] = useState('');
  const [eSaving, setESaving] = useState(false);

  const openEdit = async () => {
    if (!sop) return;
    setETitle(sop.title);
    setECategory(sop.category);
    setEDescription(sop.description);
    setEVideo([]);
    setEThumb([]);
    setEDocs([]);
    setRemoveIds([]);
    setEError('');
    setEditOpen(true);
    try {
      const res = await retrieveSopCategoriesApi(sop.department);
      setEditCategories(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setEditCategories([]);
    }
  };

  const toggleRemove = (fileId: number) =>
    setRemoveIds((prev) => (prev.includes(fileId) ? prev.filter((x) => x !== fileId) : [...prev, fileId]));

  const submitEdit = async () => {
    if (!sop) return;
    if (!eTitle.trim()) {
      setEError(tt('sop.edit.titleRequired'));
      return;
    }
    if (!userId) {
      setEError(tt('sop.noUser'));
      return;
    }
    setESaving(true);
    setEError('');
    try {
      const res = await updateSopApi({
        sop_id: sop.sopId,
        user_id: userId,
        title: eTitle.trim(),
        description: eDescription.trim(),
        category: eCategory || undefined,
        removeFileIds: removeIds,
        videoFile: eVideo[0] || null,
        thumbnailFile: eThumb[0] || null,
        documentFiles: eDocs,
      });
      setSop(res?.data || sop);
      toast.success(tt('sop.edit.success'));
      setEditOpen(false);
    } catch (e: any) {
      setEError(e?.message || tt('sop.edit.failed'));
    } finally {
      setESaving(false);
    }
  };

  // ---------------- Delete ----------------
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = async () => {
    if (!sop || !userId) return;
    setDeleting(true);
    try {
      await deleteSopApi(sop.sopId, userId);
      toast.success(tt('sop.details.deleted'));
      navigate(homeHref);
    } catch (e: any) {
      toast.error(e?.message || tt('sop.details.deleteFailed'));
      setDeleting(false);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  const FileRow: React.FC<{ f: SopFile; removable?: boolean }> = ({ f, removable }) => {
    return (
      <li className="d-flex align-items-center gap-2 mb-1">
        <i className="ri-attachment-2" />
        <Button
          color="link"
          className="p-0 text-truncate text-start"
          style={{ maxWidth: 360 }}
          onClick={() => openSopFile(f)}
        >
          {f.originalFileName}
        </Button>
        {f.fileSize ? <span className="text-muted small">{formatFileSize(f.fileSize)}</span> : null}
        <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-muted" title={tt('sop.details.download')}>
          <i className="ri-download-2-line" />
        </a>
        {removable && (
          <FormGroup check className="mb-0 ms-1">
            <Input
              type="checkbox"
              id={`rm-${f.fileId}`}
              checked={removeIds.includes(f.fileId)}
              onChange={() => toggleRemove(f.fileId)}
            />
            <Label check for={`rm-${f.fileId}`} className="small text-danger">
              {tt('sop.edit.remove')}
            </Label>
          </FormGroup>
        )}
      </li>
    );
  };

  if (loading) {
    return (
      <div className="page-content">
        <Container fluid>
          <div className="text-center py-5">
            <Spinner color="primary" />
          </div>
        </Container>
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title={tt('sop.details.notFound')} pageTitle={tt('menu.sop')} />
          <Alert color="warning">{error || tt('sop.details.notFound')}</Alert>
          <Button color="secondary" outline onClick={() => navigate(homeHref)}>
            &larr; {tt('sop.details.back')}
          </Button>
        </Container>
      </div>
    );
  }

  // Internal DH SOP — only DH / Logistic staff and full admins may view it.
  if (sop.department === 'DH' && !canAccessSopDh()) {
    return (
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title={tt('menu.sopDh')} pageTitle={tt('menu.sop')} />
          <Alert color="warning">{tt('common.noPermission')}</Alert>
          <Button color="secondary" outline onClick={() => navigate('/sop/public')}>
            {tt('menu.sopPublic')}
          </Button>
        </Container>
      </div>
    );
  }

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title={sop.title} pageTitle={tt('menu.sop')} />

        <div className="mb-3">
          <Button color="secondary" outline onClick={() => navigate(homeHref)}>
            &larr; {tt('sop.details.back')}
          </Button>
        </div>

        <Row>
          <Col lg={8}>
            <Card>
              <CardBody>
                {sop.videoUrl ? (
                  <div className="training-player-wrap mb-3">
                    <video src={sop.videoUrl} poster={sop.thumbnailUrl || undefined} controls />
                  </div>
                ) : sop.thumbnailUrl ? (
                  <img src={sop.thumbnailUrl} alt={sop.title} className="img-fluid rounded mb-3" />
                ) : null}

                <h4 className="mb-2">{sop.title}</h4>
                <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                  {sop.description || tt('sop.details.noDescription')}
                </p>

                {sop.documents.length > 0 && (
                  <>
                    <hr />
                    <h6 className="mb-2">{tt('sop.details.documents')}</h6>
                    {sop.documents.map((f) => (
                      <div key={f.fileId} className="mb-4">
                        <div className="d-flex align-items-center gap-2 small">
                          <i className="ri-attachment-2" />
                          <Button
                            color="link"
                            className="p-0 text-truncate text-start"
                            style={{ maxWidth: 360 }}
                            onClick={() => openSopFile(f)}
                          >
                            {f.originalFileName}
                          </Button>
                          {f.fileSize ? (
                            <span className="text-muted">{formatFileSize(f.fileSize)}</span>
                          ) : null}
                          <a
                            href={f.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted"
                            title={tt('sop.details.download')}
                          >
                            <i className="ri-download-2-line" />
                          </a>
                        </div>
                        <DocInlinePreview f={f} />
                      </div>
                    ))}
                  </>
                )}
              </CardBody>
            </Card>
          </Col>

          <Col lg={4}>
            <Card>
              <CardBody>
                {copyMsg && <Alert color="success">{copyMsg}</Alert>}

                <div className="mb-2 d-flex flex-wrap gap-1">
                  <span className="training-category-pill">{departmentLabel(sop.department, tt)}</span>
                  <span className="training-category-pill">{categoryLabel(sop.category, tt)}</span>
                  <Badge color={materialTypeColor(sop.materialType)}>
                    {materialTypeLabel(sop.materialType, tt)}
                  </Badge>
                </div>

                <div className="training-video-meta mb-1">
                  {tt('sop.details.uploadedBy')}: {sop.uploaderName}
                </div>
                <div className="training-video-meta mb-1">
                  {tt('sop.details.uploadedAt')}: {fmtDate(sop.createdAt)}
                </div>
                <div className="training-video-meta mb-3">
                  {tt('sop.details.views')}: {sop.viewCount}
                </div>

                <Button color="primary" outline className="w-100 mb-2" onClick={copyShareLink}>
                  <i className="ri-link me-1" />
                  {tt('sop.details.copyLink')}
                </Button>

                {canManage && (
                  <>
                    <Button color="secondary" className="w-100 mb-2" onClick={openEdit}>
                      <i className="ri-edit-line me-1" />
                      {tt('sop.details.edit')}
                    </Button>
                    <Button color="danger" outline className="w-100" onClick={() => setDeleteOpen(true)}>
                      <i className="ri-delete-bin-line me-1" />
                      {tt('sop.details.delete')}
                    </Button>
                  </>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Edit modal */}
      <Modal isOpen={editOpen} toggle={() => !eSaving && setEditOpen(false)} centered size="lg">
        <ModalHeader toggle={() => !eSaving && setEditOpen(false)}>{tt('sop.details.edit')}</ModalHeader>
        <ModalBody>
          {eError && <Alert color="danger">{eError}</Alert>}

          <FormGroup>
            <Label>{tt('sop.fields.title')} *</Label>
            <Input value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={255} />
          </FormGroup>

          <FormGroup>
            <Label>{tt('sop.fields.category')}</Label>
            <Input type="select" value={eCategory} onChange={(e) => setECategory(e.target.value)}>
              {editCategories.map((cat) => (
                <option key={cat.category_id} value={cat.category_name}>
                  {categoryLabel(cat.category_name, tt)}
                </option>
              ))}
            </Input>
          </FormGroup>

          <FormGroup>
            <Label>{tt('sop.fields.description')}</Label>
            <Input
              type="textarea"
              rows={3}
              value={eDescription}
              onChange={(e) => setEDescription(e.target.value)}
            />
          </FormGroup>

          {sop.files.length > 0 && (
            <FormGroup>
              <Label>{tt('sop.edit.currentFiles')}</Label>
              <ul className="list-unstyled small mb-0">
                {sop.files.map((f) => (
                  <FileRow key={f.fileId} f={f} removable />
                ))}
              </ul>
            </FormGroup>
          )}

          <FileUploadPicker
            id="sop-edit-video"
            label={tt('sop.edit.replaceVideo')}
            accept={VIDEO_ACCEPT}
            maxFiles={1}
            maxSizeBytes={MAX_VIDEO_BYTES}
            files={eVideo}
            onChange={setEVideo}
          />
          <FileUploadPicker
            id="sop-edit-thumb"
            label={tt('sop.edit.replaceThumbnail')}
            accept={THUMBNAIL_ACCEPT}
            maxFiles={1}
            maxSizeBytes={MAX_THUMBNAIL_BYTES}
            files={eThumb}
            onChange={setEThumb}
          />
          <FileUploadPicker
            id="sop-edit-docs"
            label={tt('sop.edit.addDocuments')}
            accept={DOCUMENT_ACCEPT}
            maxFiles={MAX_DOCUMENT_FILES}
            maxSizeBytes={MAX_DOCUMENT_BYTES}
            files={eDocs}
            onChange={setEDocs}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={() => setEditOpen(false)} disabled={eSaving}>
            {tt('common.cancel')}
          </Button>
          <Button color="primary" onClick={submitEdit} disabled={eSaving}>
            {eSaving ? <Spinner size="sm" className="me-1" /> : null}
            {tt('common.save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={deleteOpen} toggle={() => !deleting && setDeleteOpen(false)} centered>
        <ModalHeader toggle={() => !deleting && setDeleteOpen(false)}>{tt('sop.details.delete')}</ModalHeader>
        <ModalBody>{tt('sop.details.deleteConfirm')}</ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={() => setDeleteOpen(false)} disabled={deleting}>
            {tt('common.cancel')}
          </Button>
          <Button color="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Spinner size="sm" className="me-1" /> : null}
            {tt('sop.details.delete')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default SopDetails;
