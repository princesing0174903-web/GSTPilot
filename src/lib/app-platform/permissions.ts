// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — App Permissions Engine
// Every app declares permissions. Every install requires approval.
// Permission approval is required before an app can access tenant data.
// ═══════════════════════════════════════════════════════════════════════════════

import { APP_PERMISSION_CATALOG, type AppPermission } from './types';

/** Risk level of a permission. */
export type PermissionRisk = 'low' | 'medium' | 'high' | 'critical';

/** Get the risk level of a permission. */
export function getPermissionRisk(permission: AppPermission): PermissionRisk {
  const entry = APP_PERMISSION_CATALOG.find((p) => p.key === permission);
  return entry?.risk ?? 'medium';
}

/** Get the label for a permission. */
export function getPermissionLabel(permission: AppPermission): string {
  const entry = APP_PERMISSION_CATALOG.find((p) => p.key === permission);
  return entry?.label ?? permission;
}

/** Get the description for a permission. */
export function getPermissionDescription(permission: AppPermission): string {
  const entry = APP_PERMISSION_CATALOG.find((p) => p.key === permission);
  return entry?.description ?? 'No description available.';
}

/** Get the category for a permission. */
export function getPermissionCategory(permission: AppPermission): string {
  const entry = APP_PERMISSION_CATALOG.find((p) => p.key === permission);
  return entry?.category ?? 'general';
}

/** Group permissions by category for UI display. */
export function groupPermissionsByCategory(permissions: AppPermission[]): { category: string; label: string; permissions: { key: AppPermission; label: string; risk: PermissionRisk; description: string }[] }[] {
  const groups: Record<string, { key: AppPermission; label: string; risk: PermissionRisk; description: string }[]> = {};
  const categoryLabels: Record<string, string> = {
    crm: 'CRM',
    banking: 'Banking',
    invoices: 'Invoices',
    gst: 'GST',
    reports: 'Reports',
    files: 'Files',
    automation: 'Automation',
    notifications: 'Notifications',
    ai: 'AI Engines',
    platform: 'Platform',
    admin: 'Administration',
    general: 'General',
  };
  for (const perm of permissions) {
    const category = getPermissionCategory(perm);
    if (!groups[category]) groups[category] = [];
    groups[category].push({
      key: perm,
      label: getPermissionLabel(perm),
      risk: getPermissionRisk(perm),
      description: getPermissionDescription(perm),
    });
  }
  return Object.entries(groups).map(([category, perms]) => ({
    category,
    label: categoryLabels[category] ?? category,
    permissions: perms,
  }));
}

/** Compute the overall risk of a set of permissions (highest wins). */
export function computePermissionSetRisk(permissions: AppPermission[]): PermissionRisk {
  if (permissions.length === 0) return 'low';
  const riskOrder: PermissionRisk[] = ['low', 'medium', 'high', 'critical'];
  let maxIndex = 0;
  for (const perm of permissions) {
    const risk = getPermissionRisk(perm);
    const idx = riskOrder.indexOf(risk);
    if (idx > maxIndex) maxIndex = idx;
  }
  return riskOrder[maxIndex];
}

/** Validate that an app's declared permissions are all known/valid. */
export function validateDeclaredPermissions(permissions: AppPermission[]): { valid: boolean; unknown: string[] } {
  const known = new Set(APP_PERMISSION_CATALOG.map((p) => p.key));
  const unknown = permissions.filter((p) => !known.has(p));
  return { valid: unknown.length === 0, unknown };
}

/** Check whether a set of granted permissions covers a required permission.
 *  Write permissions imply read permissions for the same category. */
export function isPermissionGranted(required: AppPermission, granted: AppPermission[]): boolean {
  if (granted.includes(required)) return true;
  // write:X implies read:X
  if (required.startsWith('read:')) {
    const writePerm = `write:${required.slice(5)}` as AppPermission;
    if (granted.includes(writePerm)) return true;
  }
  // access:ai implies nothing more specific; but access:ai_ceo etc. require explicit grant
  return false;
}

/** Check all required permissions against granted set. Returns missing ones. */
export function checkPermissions(required: AppPermission[], granted: AppPermission[]): AppPermission[] {
  return required.filter((p) => !isPermissionGranted(p, granted));
}

/** Whether a permission set requires explicit admin approval (any critical or high). */
export function requiresAdminApproval(permissions: AppPermission[]): boolean {
  return permissions.some((p) => {
    const risk = getPermissionRisk(p);
    return risk === 'high' || risk === 'critical';
  });
}

/** Human-readable summary of what a permission set allows. */
export function summarizePermissionSet(permissions: AppPermission[]): string {
  if (permissions.length === 0) return 'No special permissions required.';
  const groups = groupPermissionsByCategory(permissions);
  return groups
    .map((g) => `${g.label}: ${g.permissions.map((p) => p.label).join(', ')}`)
    .join('; ');
}
