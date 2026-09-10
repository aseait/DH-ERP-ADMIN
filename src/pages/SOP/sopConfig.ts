import { SopDepartment } from '../../helpers/userInformation';

export type { SopDepartment };
export {
  SOP_DEPARTMENTS,
  canManageSopDept,
  canUploadSop,
  canAccessSopDh,
} from '../../helpers/userInformation';

// ---- sop_materials.material_type (see backend sopController) ----
export const SOP_MATERIAL_TYPE = {
  VIDEO: 0,
  DOCUMENT: 1,
  VIDEO_WITH_DOCUMENTS: 2,
  OTHER: 3,
} as const;

// ---- sop_material_files.file_type ----
export const SOP_FILE_TYPE = {
  VIDEO: 0,
  THUMBNAIL: 1,
  DOCUMENT: 2,
  IMAGE: 3,
  OTHER: 4,
} as const;

// Per-file size caps — mirror the backend limits so we fail fast in the browser.
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GB
export const MAX_THUMBNAIL_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_DOCUMENT_FILES = 10;

export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,video/mpeg';
export const THUMBNAIL_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.webp,' +
  'application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/csv,text/plain,image/png,image/jpeg,image/webp';

export const materialTypeLabel = (v: unknown, tt: (k: string) => string): string => {
  switch (Number(v)) {
    case SOP_MATERIAL_TYPE.VIDEO:
      return tt('sop.materialType.video');
    case SOP_MATERIAL_TYPE.DOCUMENT:
      return tt('sop.materialType.document');
    case SOP_MATERIAL_TYPE.VIDEO_WITH_DOCUMENTS:
      return tt('sop.materialType.videoWithDocuments');
    default:
      return tt('sop.materialType.other');
  }
};

export const materialTypeColor = (v: unknown): string => {
  switch (Number(v)) {
    case SOP_MATERIAL_TYPE.VIDEO:
      return 'info';
    case SOP_MATERIAL_TYPE.DOCUMENT:
      return 'secondary';
    case SOP_MATERIAL_TYPE.VIDEO_WITH_DOCUMENTS:
      return 'primary';
    default:
      return 'light';
  }
};

export const materialTypeIcon = (v: unknown): string => {
  switch (Number(v)) {
    case SOP_MATERIAL_TYPE.VIDEO:
      return 'ri-play-circle-line';
    case SOP_MATERIAL_TYPE.DOCUMENT:
      return 'ri-file-text-line';
    case SOP_MATERIAL_TYPE.VIDEO_WITH_DOCUMENTS:
      return 'ri-film-line';
    default:
      return 'ri-folder-3-line';
  }
};

// Default per-department seed labels get a localized name; manager-added
// categories are free text and just display as typed.
const TRANSLATED_CATEGORIES: Record<string, string> = {
  Onboarding: 'sop.categories.onboarding',
  'Product Training': 'sop.categories.productTraining',
  'Tools & Systems': 'sop.categories.toolsSystems',
  Other: 'sop.categories.other',
  SOP: 'sop.categories.sop',
  'Customs & Compliance': 'sop.categories.customsCompliance',
  'Policies & Benefits': 'sop.categories.policiesBenefits',
  'Performance Reviews': 'sop.categories.performanceReviews',
  'Expense & Reimbursement': 'sop.categories.expenseReimbursement',
  'Reporting & Compliance': 'sop.categories.reportingCompliance',
  'Fulfillment SOP': 'sop.categories.fulfillmentSop',
  'Support SOP': 'sop.categories.supportSop',
};

export const categoryLabel = (name: string, tt: (k: string) => string): string => {
  const key = TRANSLATED_CATEGORIES[name];
  return key ? tt(key) : name;
};

const TRANSLATED_DEPARTMENTS: Partial<Record<SopDepartment, string>> = {
  Public: 'sop.departments.public',
};

export const departmentLabel = (dept: SopDepartment, tt: (k: string) => string): string => {
  const key = TRANSLATED_DEPARTMENTS[dept];
  return key ? tt(key) : dept;
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(i === 0 || val >= 10 ? 0 : 1)} ${units[i]}`;
};

// ---- API response shapes (from backend mapSOP / retrieveSOPFilesMap) ----
export type SopFile = {
  fileId: number;
  sopId: number;
  fileType: number;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  ossObjectName: string;
  mimeType: string | null;
  fileSize: number | null;
  sortOrder: number;
  uploadedBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Sop = {
  id: string;
  sopId: number;
  title: string;
  description: string;
  department: SopDepartment;
  categoryId: number;
  category: string;
  materialType: number;
  uploaderId: number | null;
  uploaderName: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  videoUrl: string;
  thumbnailUrl: string;
  videoFile: SopFile | null;
  thumbnailFile: SopFile | null;
  documents: SopFile[];
  files: SopFile[];
};

export type SopCategory = {
  category_id: number;
  department: string;
  category_name: string;
  is_default: number;
  created_by: number | null;
};
