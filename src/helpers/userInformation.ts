const getAuthUser = () => {
  try { return JSON.parse(sessionStorage.getItem('authUser') || '{}'); }
  catch { return {}; }
};

export function getRestriction(): number {
  return Number(getAuthUser()?.restriction ?? 0);
}

/** Named permission sets — update here when requirements change. */
export const RESTRICT = {
  ASSIGN_SEA_CB:         [1, 2, 8] as const,
  ASSIGN_AIR_CB:         [1, 2]    as const,
  ASSIGN_TRUCK_CB:       [1, 2]    as const,
  CREATE_USER:           [1, 2, 3, 6] as const,
  VIEW_USER_LIST:        [1, 2, 8, 6] as const,
  ASSIGN_SALES_TO_CLIENT:[1, 6]    as const,
} as const;

/** Returns true if the current user's restriction is in the allowed list. */
export function can(allowed: readonly number[]): boolean {
  return (allowed as number[]).includes(getRestriction());
}

// small helper: get user_id from sessionStorage
// Admin logins store the id under `id` (see userManagementController.loginUser);
// some other auth flows store it under `user_id` — check both.
export function getUserIdFromSession(): string | number | undefined {
  try {
    const raw = sessionStorage.getItem('authUser');
    if (!raw) return undefined;
    const user = JSON.parse(raw);
    return user?.user_id ?? user?.id;
  } catch {
    return undefined;
  }
}

export function canDeleteFileFromSession(): boolean {
  try {
    const raw = sessionStorage.getItem('authUser');
    if (!raw) return false;
    const u = JSON.parse(raw);
    const restriction = Number(u?.restriction);
    if (restriction === 1) return true;
    const dept = String(u?.department ?? '').trim().toLowerCase();
    if (restriction === 2 && dept.includes('dh')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Logistic-service edit gate: department "Logistic", or restriction 1. */
export function canEditLogisticService(): boolean {
  try {
    const u = getAuthUser();
    if (Number(u?.restriction) === 1) return true;
    const dept = String(u?.department ?? '').trim().toLowerCase();
    return dept.includes('logistic');
  } catch {
    return false;
  }
}

/** Customs-Brokerage (CB) edit gate: department "DH", or restriction 1. */
export function canEditCbService(): boolean {
  try {
    const u = getAuthUser();
    if (Number(u?.restriction) === 1) return true;
    const dept = String(u?.department ?? '').trim().toLowerCase();
    return dept.includes('dh');
  } catch {
    return false;
  }
}

/**
 * SOP "scopes" (stored in the backend as `department`; must match SOP_DEPARTMENTS there).
 * - DH     — internal DH SOP library
 * - Public — company-wide SOPs everyone can see
 */
export const SOP_DEPARTMENTS = ['DH', 'Public'] as const;
export type SopDepartment = (typeof SOP_DEPARTMENTS)[number];

/**
 * The SOP curator group: restriction 1 (full admin), or a user whose free-text
 * department contains "dh" or "logistic".
 */
function isSopCurator(): boolean {
  try {
    const u = getAuthUser();
    if (Number(u?.restriction) === 1) return true;
    const userDept = String(u?.department ?? '').trim().toLowerCase();
    return !!userDept && (userDept.includes('dh') || userDept.includes('logistic'));
  } catch {
    return false;
  }
}

/**
 * Who can edit / delete SOPs and rename categories — always the curator group,
 * for both libraries. The `dept` arg is kept for call-site compatibility.
 */
export function canManageSopDept(_dept?: string): boolean {
  return isSopCurator();
}

/**
 * Who can upload a new SOP / add a category:
 * - Public — any signed-in user
 * - DH     — curators only
 */
export function canUploadSop(dept?: string): boolean {
  if (String(dept) === 'Public') return !!getUserIdFromSession();
  return isSopCurator();
}

/**
 * Who can even open the internal **DH** SOP library (view is restricted here —
 * DH / Logistic staff and full admins only). The Public library has no view gate.
 */
export function canAccessSopDh(): boolean {
  return isSopCurator();
}

export function getUserNameFromSession(): string {
  try {
    const raw = sessionStorage.getItem('authUser');
    if (!raw) return '';
    const u = JSON.parse(raw);
    // same priority as LeaveMessageChat's pickDisplayName so names match read_status_admin
    return u?.user_name || u?.account_name || u?.contact_name || u?.company_name ||
      (u?.email ? u.email.split('@')[0] : '') || '';
  } catch {
    return '';
  }
}
