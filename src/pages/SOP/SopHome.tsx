import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
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
  Badge,
} from 'reactstrap';
import classnames from 'classnames';
import { toast } from 'react-toastify';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import FileUploadPicker from '../../Components/Common/FileUploadPicker';
import { useTT } from '../../helpers/useTT';
import { getRestriction, getUserIdFromSession } from '../../helpers/userInformation';
import { buildPageList } from '../OrderLists/helper';
import {
  addSopCategoryApi,
  deleteSopCategoryApi,
  retrieveSopCategoriesApi,
  retrieveSopSettingsApi,
  retrieveSopsApi,
  setSopPublicLockApi,
  submitSopApi,
  updateSopCategoryApi,
} from '../../helpers/api_fetch/sop';
import {
  SopDepartment,
  canAccessSopDh,
  canManageSopDept,
  canUploadSop,
  categoryLabel,
  departmentLabel,
  DOCUMENT_ACCEPT,
  materialTypeColor,
  materialTypeIcon,
  materialTypeLabel,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_FILES,
  MAX_THUMBNAIL_BYTES,
  MAX_VIDEO_BYTES,
  SOP_MATERIAL_TYPE,
  Sop,
  SopCategory,
  THUMBNAIL_ACCEPT,
  VIDEO_ACCEPT,
} from './sopConfig';

const ALL = '__all__';
const PAGE_SIZE = 12;

const SopHome: React.FC<{ department: SopDepartment }> = ({ department }) => {
  const { tt } = useTT();
  const navigate = useNavigate();
  const userId = getUserIdFromSession();

  // This page is bound to a single SOP library (DH or Public); there's no tab switcher.
  const activeDept = department;
  const [categories, setCategories] = useState<SopCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(ALL); // '' sentinel ALL, else category_name
  const [materialType, setMaterialType] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [rows, setRows] = useState<Sop[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Public library upload lock — only a restriction-1 admin can toggle it.
  const isAdmin = getRestriction() === 1;
  const [publicLocked, setPublicLocked] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);
  const isPublic = activeDept === 'Public';

  const canManage = canManageSopDept(activeDept); // edit/delete/rename — curators
  const canUpload =
    canUploadSop(activeDept) && !(isPublic && publicLocked); // new SOP / new category
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageItems = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  const fetchCategories = useCallback(async (dept: string) => {
    try {
      const res = await retrieveSopCategoriesApi(dept);
      setCategories(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchList = useCallback(
    async (opts: { dept: string; category: string; type: string; search: string; page: number }) => {
      setLoading(true);
      setError('');
      try {
        const res = await retrieveSopsApi({
          department: opts.dept,
          category: opts.category === ALL ? undefined : opts.category,
          material_type: opts.type === '' ? undefined : opts.type,
          search: opts.search.trim() || undefined,
          page: opts.page,
          pageSize: PAGE_SIZE,
        });
        setRows(Array.isArray(res?.data) ? res.data : []);
        setTotal(Number(res?.total || 0));
      } catch (e: any) {
        setError(e?.message || tt('sop.loadFailed'));
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [tt]
  );

  // Initial + whenever department changes: reload categories and reset filters.
  useEffect(() => {
    fetchCategories(activeDept);
    setActiveCategory(ALL);
    setMaterialType('');
    setSearchInput('');
    setSearch('');
    setPage(1);
    fetchList({ dept: activeDept, category: ALL, type: '', search: '', page: 1 });
  }, [activeDept, fetchCategories, fetchList]);

  useEffect(() => {
    retrieveSopSettingsApi()
      .then((res) => setPublicLocked(!!res?.data?.publicUploadsLocked))
      .catch(() => {});
  }, []);

  const toggleLock = async () => {
    setLockSaving(true);
    try {
      const next = !publicLocked;
      await setSopPublicLockApi(next);
      setPublicLocked(next);
      toast.success(next ? tt('sop.publicLock.closed') : tt('sop.publicLock.opened'));
    } catch (e: any) {
      toast.error(e?.message || tt('sop.publicLock.failed'));
    } finally {
      setLockSaving(false);
    }
  };

  const reload = (patch: Partial<{ category: string; type: string; search: string; page: number }> = {}) => {
    const next = {
      dept: activeDept,
      category: patch.category ?? activeCategory,
      type: patch.type ?? materialType,
      search: patch.search ?? search,
      page: patch.page ?? 1,
    };
    if (patch.page === undefined) setPage(1);
    fetchList(next);
  };

  const doSearch = () => {
    setSearch(searchInput);
    reload({ search: searchInput });
  };

  // ---------------- Upload modal ----------------
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uTitle, setUTitle] = useState('');
  const [uCategory, setUCategory] = useState('');
  const [uDescription, setUDescription] = useState('');
  const [uVideo, setUVideo] = useState<File[]>([]);
  const [uThumb, setUThumb] = useState<File[]>([]);
  const [uDocs, setUDocs] = useState<File[]>([]);
  const [uError, setUError] = useState('');
  const [uSaving, setUSaving] = useState(false);

  const openUpload = () => {
    setUTitle('');
    // Default to the category the user is currently filtered to (if any), else the first one.
    const preselect =
      activeCategory !== ALL && categories.some((c) => c.category_name === activeCategory)
        ? activeCategory
        : categories[0]?.category_name || '';
    setUCategory(preselect);
    setUDescription('');
    setUVideo([]);
    setUThumb([]);
    setUDocs([]);
    setUError('');
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!uTitle.trim() || !uCategory) {
      setUError(tt('sop.upload.missingFields'));
      return;
    }
    if (uVideo.length === 0 && uDocs.length === 0) {
      setUError(tt('sop.upload.needContent'));
      return;
    }
    if (!userId) {
      setUError(tt('sop.noUser'));
      return;
    }
    setUSaving(true);
    setUError('');
    try {
      await submitSopApi({
        title: uTitle.trim(),
        description: uDescription.trim(),
        department: activeDept,
        category: uCategory,
        user_id: userId,
        videoFile: uVideo[0] || null,
        thumbnailFile: uThumb[0] || null,
        documentFiles: uDocs,
      });
      toast.success(tt('sop.upload.success'));
      setUploadOpen(false);
      reload({ page });
    } catch (e: any) {
      setUError(e?.message || tt('sop.upload.failed'));
    } finally {
      setUSaving(false);
    }
  };

  // ---------------- Add category modal ----------------
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  const submitCategory = async () => {
    const name = catName.trim();
    if (!name) return;
    if (!userId) {
      setCatError(tt('sop.noUser'));
      return;
    }
    setCatSaving(true);
    setCatError('');
    try {
      await addSopCategoryApi({ department: activeDept, category_name: name, user_id: userId });
      await fetchCategories(activeDept);
      setActiveCategory(name);
      setCatName('');
      setCatOpen(false);
      reload({ category: name });
    } catch (e: any) {
      setCatError(e?.message || tt('sop.category.failed'));
    } finally {
      setCatSaving(false);
    }
  };

  // ---------------- Rename category modal ----------------
  const [renameCat, setRenameCat] = useState<SopCategory | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Backend allows renaming only non-default categories, and (by default) only by
  // the creator — mirror that so the pencil doesn't appear when it would 403.
  const canRenameCategory = (cat: SopCategory) =>
    canManage &&
    Number(cat.is_default) !== 1 &&
    (cat.created_by == null || String(cat.created_by) === String(userId ?? ''));

  const openRename = (cat: SopCategory) => {
    setRenameCat(cat);
    setRenameName(cat.category_name);
    setRenameError('');
  };

  // ---------------- Delete category ----------------
  // Backend requires a curator and blocks default categories / categories still in use.
  const [deleteCat, setDeleteCat] = useState<SopCategory | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // A curator can delete any category; otherwise only the person who created it.
  const canDeleteCategory = (cat: SopCategory) =>
    Number(cat.is_default) !== 1 &&
    (canManage || (cat.created_by != null && String(cat.created_by) === String(userId ?? '')));

  const openDelete = (cat: SopCategory) => {
    setDeleteCat(cat);
    setDeleteError('');
  };

  const submitDeleteCategory = async () => {
    if (!deleteCat) return;
    if (!userId) {
      setDeleteError(tt('sop.noUser'));
      return;
    }
    setDeleteSaving(true);
    setDeleteError('');
    try {
      await deleteSopCategoryApi({ category_id: deleteCat.category_id, user_id: userId });
      const wasActive = activeCategory === deleteCat.category_name;
      await fetchCategories(activeDept);
      toast.success(tt('sop.category.deleteSuccess'));
      setDeleteCat(null);
      if (wasActive) {
        setActiveCategory(ALL);
        reload({ category: ALL });
      } else {
        reload({ page });
      }
    } catch (e: any) {
      setDeleteError(e?.message || tt('sop.category.deleteFailed'));
    } finally {
      setDeleteSaving(false);
    }
  };

  const submitRename = async () => {
    const name = renameName.trim();
    if (!renameCat || !name || name === renameCat.category_name) {
      setRenameCat(null);
      return;
    }
    if (!userId) {
      setRenameError(tt('sop.noUser'));
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    try {
      await updateSopCategoryApi({
        category_id: renameCat.category_id,
        category_name: name,
        user_id: userId,
      });
      const wasActive = activeCategory === renameCat.category_name;
      await fetchCategories(activeDept);
      if (wasActive) {
        setActiveCategory(name);
        reload({ category: name });
      } else {
        reload({ page });
      }
      setRenameCat(null);
    } catch (e: any) {
      setRenameError(e?.message || tt('sop.category.renameFailed'));
    } finally {
      setRenameSaving(false);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  };

  // The DH library is DH / Logistic staff + full admins only.
  if (activeDept === 'DH' && !canAccessSopDh()) {
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
        <BreadCrumb
          title={departmentLabel(activeDept, tt)}
          pageTitle={tt('menu.sop')}
        />

        <Card>
          <CardBody>
            <Row className="g-2 align-items-center mb-3">
              <Col md={4}>
                <div className="search-box">
                  <Input
                    type="text"
                    className="form-control"
                    placeholder={tt('sop.searchPlaceholder')}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                  />
                  <i className="ri-search-line search-icon" />
                </div>
              </Col>
              <Col md={3}>
                <Input
                  type="select"
                  value={materialType}
                  onChange={(e) => {
                    setMaterialType(e.target.value);
                    reload({ type: e.target.value });
                  }}
                >
                  <option value="">{tt('sop.materialType.all')}</option>
                  <option value={SOP_MATERIAL_TYPE.VIDEO}>{tt('sop.materialType.video')}</option>
                  <option value={SOP_MATERIAL_TYPE.DOCUMENT}>{tt('sop.materialType.document')}</option>
                  <option value={SOP_MATERIAL_TYPE.VIDEO_WITH_DOCUMENTS}>
                    {tt('sop.materialType.videoWithDocuments')}
                  </option>
                  <option value={SOP_MATERIAL_TYPE.OTHER}>{tt('sop.materialType.other')}</option>
                </Input>
              </Col>
              <Col md={5} className="d-flex justify-content-md-end gap-2">
                <Button color="light" onClick={doSearch}>
                  {tt('common.search')}
                </Button>
                {isPublic && isAdmin && (
                  <Button
                    color={publicLocked ? 'danger' : 'secondary'}
                    outline
                    onClick={toggleLock}
                    disabled={lockSaving}
                    title={tt('sop.publicLock.hint')}
                  >
                    <i
                      className={`${publicLocked ? 'ri-lock-line' : 'ri-lock-unlock-line'} align-bottom me-1`}
                    />
                    {publicLocked ? tt('sop.publicLock.open') : tt('sop.publicLock.close')}
                  </Button>
                )}
                {canUpload && (
                  <>
                    <Button color="secondary" outline onClick={() => setCatOpen(true)}>
                      <i className="ri-price-tag-3-line align-bottom me-1" />
                      {tt('sop.addCategory')}
                    </Button>
                    <Button color="primary" onClick={openUpload}>
                      <i className="ri-upload-2-line align-bottom me-1" />
                      {tt('sop.uploadSop')}
                    </Button>
                  </>
                )}
              </Col>
            </Row>

            {isPublic && publicLocked && (
              <Alert color="warning" className="py-2">
                {tt('sop.publicLock.notice')}
              </Alert>
            )}

            <div className="d-flex flex-wrap gap-2 mb-4">
              <span
                className={classnames('training-category-pill', {
                  'bg-primary text-white': activeCategory === ALL,
                })}
                role="button"
                onClick={() => {
                  setActiveCategory(ALL);
                  reload({ category: ALL });
                }}
              >
                {tt('sop.allCategories')}
              </span>
              {categories.map((cat) => (
                <span
                  key={cat.category_id}
                  className={classnames('training-category-pill', {
                    'bg-primary text-white': activeCategory === cat.category_name,
                  })}
                  role="button"
                  onClick={() => {
                    setActiveCategory(cat.category_name);
                    reload({ category: cat.category_name });
                  }}
                >
                  {categoryLabel(cat.category_name, tt)}
                  {canRenameCategory(cat) && (
                    <i
                      className="ri-pencil-line ms-1"
                      title={tt('sop.category.rename')}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRename(cat);
                      }}
                    />
                  )}
                  {canDeleteCategory(cat) && (
                    <i
                      className="ri-delete-bin-line ms-1"
                      title={tt('sop.category.delete')}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDelete(cat);
                      }}
                    />
                  )}
                </span>
              ))}
            </div>

            {error && <Alert color="danger">{error}</Alert>}

            {loading ? (
              <div className="text-center py-5">
                <Spinner color="primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center text-muted py-5">{tt('sop.noItems')}</div>
            ) : (
              <Row className="g-3">
                {rows.map((s) => (
                  <Col key={s.sopId} xxl={3} lg={4} md={6} xs={12}>
                    <Card
                      className="training-video-card h-100 mb-0"
                      onClick={() => navigate(`/sop/details?id=${s.sopId}`)}
                    >
                      <div className="training-video-thumb">
                        {s.thumbnailUrl ? (
                          <img src={s.thumbnailUrl} alt={s.title} />
                        ) : (
                          <div className="sop-thumb-placeholder">
                            <i className={materialTypeIcon(s.materialType)} />
                          </div>
                        )}
                        {(s.materialType === SOP_MATERIAL_TYPE.VIDEO ||
                          s.materialType === SOP_MATERIAL_TYPE.VIDEO_WITH_DOCUMENTS) && (
                          <i className="ri-play-circle-fill training-video-play" />
                        )}
                      </div>
                      <CardBody>
                        <div className="training-video-title mb-1">{s.title}</div>
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          <span className="training-category-pill d-inline-flex">
                            {categoryLabel(s.category, tt)}
                          </span>
                          <Badge color={materialTypeColor(s.materialType)}>
                            {materialTypeLabel(s.materialType, tt)}
                          </Badge>
                        </div>
                        <div className="training-video-meta mt-2 d-flex justify-content-between">
                          <span>
                            {s.uploaderName} &middot; {fmtDate(s.createdAt)}
                          </span>
                          <span>
                            {s.documents.length > 0 && (
                              <>
                                <i className="ri-attachment-2 align-bottom me-1" />
                                {s.documents.length}
                              </>
                            )}{' '}
                            <i className="ri-eye-line align-bottom ms-2 me-1" />
                            {s.viewCount}
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {totalPages > 1 && (
              <div className="sl-pagination mt-3">
                <span className="sl-pg-total">
                  {tt('sop.total')} {total}
                </span>
                <button
                  className="sl-pg-btn"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage(page - 1);
                    fetchList({ dept: activeDept, category: activeCategory, type: materialType, search, page: page - 1 });
                  }}
                >
                  ‹
                </button>
                {pageItems.map((p, i) =>
                  p === '...' ? (
                    <span key={`e${i}`} className="sl-pg-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      className={`sl-pg-btn${page === p ? ' active' : ''}`}
                      onClick={() => {
                        setPage(p as number);
                        fetchList({
                          dept: activeDept,
                          category: activeCategory,
                          type: materialType,
                          search,
                          page: p as number,
                        });
                      }}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  className="sl-pg-btn"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage(page + 1);
                    fetchList({ dept: activeDept, category: activeCategory, type: materialType, search, page: page + 1 });
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </CardBody>
        </Card>
      </Container>

      {/* Upload modal */}
      <Modal isOpen={uploadOpen} toggle={() => !uSaving && setUploadOpen(false)} centered size="lg">
        <ModalHeader toggle={() => !uSaving && setUploadOpen(false)}>
          {tt('sop.upload.title')} &mdash; {departmentLabel(activeDept, tt)}
        </ModalHeader>
        <ModalBody>
          {uError && <Alert color="danger">{uError}</Alert>}

          <FormGroup>
            <Label>{tt('sop.fields.title')} *</Label>
            <Input value={uTitle} onChange={(e) => setUTitle(e.target.value)} maxLength={255} />
          </FormGroup>

          <FormGroup>
            <Label>{tt('sop.fields.category')} *</Label>
            <Input type="select" value={uCategory} onChange={(e) => setUCategory(e.target.value)}>
              {categories.length === 0 && <option value="">{tt('sop.noCategories')}</option>}
              {categories.map((cat) => (
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
              value={uDescription}
              onChange={(e) => setUDescription(e.target.value)}
            />
          </FormGroup>

          <p className="text-muted small mb-2">{tt('sop.fields.contentHint')}</p>

          <FileUploadPicker
            id="sop-upload-docs"
            label={tt('sop.fields.documents')}
            accept={DOCUMENT_ACCEPT}
            maxFiles={MAX_DOCUMENT_FILES}
            maxSizeBytes={MAX_DOCUMENT_BYTES}
            files={uDocs}
            onChange={setUDocs}
            hint={tt('sop.fields.documentsHint')}
          />
          <FileUploadPicker
            id="sop-upload-video"
            label={tt('sop.fields.videoFile')}
            accept={VIDEO_ACCEPT}
            maxFiles={1}
            maxSizeBytes={MAX_VIDEO_BYTES}
            files={uVideo}
            onChange={setUVideo}
            hint={tt('sop.fields.videoHint')}
          />
          <FileUploadPicker
            id="sop-upload-thumb"
            label={tt('sop.fields.thumbnail')}
            accept={THUMBNAIL_ACCEPT}
            maxFiles={1}
            maxSizeBytes={MAX_THUMBNAIL_BYTES}
            files={uThumb}
            onChange={setUThumb}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={() => setUploadOpen(false)} disabled={uSaving}>
            {tt('common.cancel')}
          </Button>
          <Button color="primary" onClick={submitUpload} disabled={uSaving}>
            {uSaving ? <Spinner size="sm" className="me-1" /> : null}
            {tt('sop.upload.submit')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add category modal */}
      <Modal isOpen={catOpen} toggle={() => !catSaving && setCatOpen(false)} centered>
        <ModalHeader toggle={() => !catSaving && setCatOpen(false)}>
          {tt('sop.addCategory')} &mdash; {departmentLabel(activeDept, tt)}
        </ModalHeader>
        <ModalBody>
          {catError && <Alert color="danger">{catError}</Alert>}
          <FormGroup>
            <Label>{tt('sop.categoryName')}</Label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              maxLength={150}
              onKeyDown={(e) => e.key === 'Enter' && submitCategory()}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={() => setCatOpen(false)} disabled={catSaving}>
            {tt('common.cancel')}
          </Button>
          <Button color="primary" onClick={submitCategory} disabled={catSaving}>
            {catSaving ? <Spinner size="sm" className="me-1" /> : null}
            {tt('common.save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Rename category modal */}
      <Modal isOpen={!!renameCat} toggle={() => !renameSaving && setRenameCat(null)} centered>
        <ModalHeader toggle={() => !renameSaving && setRenameCat(null)}>
          {tt('sop.category.rename')}
        </ModalHeader>
        <ModalBody>
          {renameError && <Alert color="danger">{renameError}</Alert>}
          <FormGroup>
            <Label>{tt('sop.categoryName')}</Label>
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              maxLength={150}
              onKeyDown={(e) => e.key === 'Enter' && submitRename()}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={() => setRenameCat(null)} disabled={renameSaving}>
            {tt('common.cancel')}
          </Button>
          <Button color="primary" onClick={submitRename} disabled={renameSaving}>
            {renameSaving ? <Spinner size="sm" className="me-1" /> : null}
            {tt('common.save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete category modal */}
      <Modal isOpen={!!deleteCat} toggle={() => !deleteSaving && setDeleteCat(null)} centered>
        <ModalHeader toggle={() => !deleteSaving && setDeleteCat(null)}>
          {tt('sop.category.delete')}
        </ModalHeader>
        <ModalBody>
          {deleteError && <Alert color="danger">{deleteError}</Alert>}
          <p className="mb-0">
            {tt('sop.category.deleteConfirm', { name: deleteCat?.category_name || '' })}
          </p>
          <p className="text-muted small mb-0 mt-2">{tt('sop.category.deleteHint')}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={() => setDeleteCat(null)} disabled={deleteSaving}>
            {tt('common.cancel')}
          </Button>
          <Button color="danger" onClick={submitDeleteCategory} disabled={deleteSaving}>
            {deleteSaving ? <Spinner size="sm" className="me-1" /> : null}
            {tt('common.delete')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default SopHome;
