// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Enterprise Security Layer: RBAC Permission Engine
//
// The single source of truth for what each role can do. Pure functions — no
// React, no Firestore, no I/O. Safe to import from client, server, Edge
// middleware, or Cloud Functions.
//
// Decision semantics:
//   • Owner  = everything (all 8 permissions × all 14 resources).
//   • Admin  = everything EXCEPT org deletion (no `manage_org` `delete`
//              specifically — see matrix below).
//   • Accountant = read/write on financial resources (clients, invoices,
//              returns, payments, banking, erp, reports, documents), read on
//              audit_logs/organization, NO user management, NO billing, NO
//              org management.
//   • Viewer = read-only everywhere. NO mutations, NO billing, NO user mgmt.
//   • Member = limited read (operational data only — clients, invoices,
//              returns, payments, documents, reports). NO banking, NO ERP,
//              NO billing, NO user mgmt, NO admin actions.
//
// Usage:
//   import { can, requirePermission } from '@/lib/security/rbac';
//   if (can('accountant', 'invoices', 'write')) { ... }
//   requirePermission(role, 'users', 'manage_users'); // throws if denied
// ═══════════════════════════════════════════════════════════════════════════════

import { AuthorizationError } from './errors';
import type {
  OrgRole,
  Permission,
  PermissionMatrix,
  Resource,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Every permission, used for the `owner` row. */
const ALL_PERMISSIONS: Permission[] = [
  'read',
  'write',
  'delete',
  'admin',
  'billing',
  'export',
  'manage_users',
  'manage_org',
];

/** Read-only permission set (used for `viewer`). */
const READ_ONLY: Permission[] = ['read'];

/** Read + write (no delete, no admin/billing) — used for `accountant` financial rows. */
const READ_WRITE: Permission[] = ['read', 'write'];

/**
 * Admin-equivalent permission set (everything except `manage_org`).
 *
 * Note: the spec says "Admin = everything except org deletion". `manage_org`
 * is the permission that covers both editing org metadata AND deleting the
 * org. Admins need to be able to edit org metadata (rename, update GSTIN,
 * change logo) but NOT delete the org. The `abac.ts` engine enforces the
 * finer-grained "admin cannot delete org" rule via an attribute policy. Here
 * we grant admins the full set minus `manage_org` for safety — the ABAC
 * layer can selectively re-enable org-edit on a per-action basis.
 */
const ADMIN_PERMS: Permission[] = [
  'read',
  'write',
  'delete',
  'admin',
  'billing',
  'export',
  'manage_users',
  // NOTE: `manage_org` deliberately omitted — see comment above.
];

/** Read + write + delete (no admin/billing/manage_users/manage_org) — full data CRUD. */
const FULL_CRUD: Permission[] = ['read', 'write', 'delete'];

// ─── The Permission Matrix ───────────────────────────────────────────────────

/**
 * The default permission matrix. Maps every role → every resource → the list
 * of permissions that role is granted on that resource.
 *
 * Owner    : ALL_PERMISSIONS on every resource.
 * Admin    : ADMIN_PERMS on every resource (everything except manage_org).
 * Accountant: READ_WRITE on financial + document resources, READ_ONLY on
 *             audit_logs/organization/reports, empty (no access) on billing/
 *             users/settings/erp-admin (still READ_WRITE on erp sync data).
 * Viewer   : READ_ONLY on every resource EXCEPT billing/users/settings (empty).
 * Member   : READ_ONLY on operational resources only (clients, invoices,
 *             returns, payments, documents, reports). No access to banking,
 *             erp, billing, organization, users, audit_logs, settings.
 */
export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  owner: {
    clients: [...ALL_PERMISSIONS],
    invoices: [...ALL_PERMISSIONS],
    returns: [...ALL_PERMISSIONS],
    payments: [...ALL_PERMISSIONS],
    documents: [...ALL_PERMISSIONS],
    banking: [...ALL_PERMISSIONS],
    erp: [...ALL_PERMISSIONS],
    billing: [...ALL_PERMISSIONS],
    ai: [...ALL_PERMISSIONS],
    organization: [...ALL_PERMISSIONS],
    users: [...ALL_PERMISSIONS],
    audit_logs: [...ALL_PERMISSIONS],
    settings: [...ALL_PERMISSIONS],
    reports: [...ALL_PERMISSIONS],
  },

  admin: {
    clients: [...ADMIN_PERMS],
    invoices: [...ADMIN_PERMS],
    returns: [...ADMIN_PERMS],
    payments: [...ADMIN_PERMS],
    documents: [...ADMIN_PERMS],
    banking: [...ADMIN_PERMS],
    erp: [...ADMIN_PERMS],
    billing: [...ADMIN_PERMS],
    ai: [...ADMIN_PERMS],
    organization: [...ADMIN_PERMS],
    users: [...ADMIN_PERMS],
    audit_logs: [...ADMIN_PERMS],
    settings: [...ADMIN_PERMS],
    reports: [...ADMIN_PERMS],
  },

  accountant: {
    // Financial resources — full read/write.
    clients: [...READ_WRITE],
    invoices: [...READ_WRITE],
    returns: [...READ_WRITE],
    payments: [...READ_WRITE],
    banking: [...READ_WRITE],
    // ERP — accountant can sync & view ERP data but not delete connections.
    erp: [...READ_WRITE],
    // Documents — accountant can upload + view.
    documents: [...READ_WRITE],
    // AI — accountant can use AI features (read + write prompts).
    ai: [...READ_WRITE],
    // Reports — accountant can generate + view.
    reports: [...READ_WRITE],
    // Audit logs — read-only.
    audit_logs: [...READ_ONLY],
    // Organization — read-only (can view org info).
    organization: [...READ_ONLY],
    // NO access to billing, users, settings.
    billing: [],
    users: [],
    settings: [],
  },

  viewer: {
    // Read-only everywhere except billing/users/settings (no access).
    clients: [...READ_ONLY],
    invoices: [...READ_ONLY],
    returns: [...READ_ONLY],
    payments: [...READ_ONLY],
    documents: [...READ_ONLY],
    banking: [...READ_ONLY],
    erp: [...READ_ONLY],
    ai: [...READ_ONLY],
    organization: [...READ_ONLY],
    audit_logs: [...READ_ONLY],
    reports: [...READ_ONLY],
    // NO access to billing, users, settings (sensitive management surfaces).
    billing: [],
    users: [],
    settings: [],
  },

  member: {
    // Operational data — limited read.
    clients: [...READ_ONLY],
    invoices: [...READ_ONLY],
    returns: [...READ_ONLY],
    payments: [...READ_ONLY],
    documents: [...READ_ONLY],
    reports: [...READ_ONLY],
    // NO access to sensitive management / financial infrastructure surfaces.
    banking: [],
    erp: [],
    billing: [],
    ai: [],
    organization: [],
    users: [],
    audit_logs: [],
    settings: [],
  },
};

// ─── Engine Functions ────────────────────────────────────────────────────────

/**
 * Look up the permission list for a (role, resource) pair.
 *
 * @returns a new array (safe to mutate). Empty if the role has no access to
 *          the resource or the role/resource is unknown.
 */
export function getPermissions(
  role: OrgRole,
): Record<Resource, Permission[]> {
  const row = DEFAULT_PERMISSION_MATRIX[role];
  if (!row) {
    // Unknown role — return an all-empty map (deny-by-default).
    const empty: Record<Resource, Permission[]> = {
      clients: [],
      invoices: [],
      returns: [],
      payments: [],
      documents: [],
      banking: [],
      erp: [],
      billing: [],
      ai: [],
      organization: [],
      users: [],
      audit_logs: [],
      settings: [],
      reports: [],
    };
    return empty;
  }
  // Return a shallow copy so callers can't mutate the source matrix.
  const copy: Partial<Record<Resource, Permission[]>> = {};
  for (const key of Object.keys(row) as Resource[]) {
    copy[key] = [...row[key]];
  }
  return copy as Record<Resource, Permission[]>;
}

/**
 * Check whether a role is granted a specific (resource, action) permission.
 *
 * @returns `true` if the role has the permission, `false` otherwise (including
 *          when the role or resource is unknown — deny-by-default).
 */
export function can(
  role: OrgRole | null | undefined,
  resource: Resource,
  action: Permission,
): boolean {
  if (!role) return false;
  const row = DEFAULT_PERMISSION_MATRIX[role];
  if (!row) return false;
  const perms = row[resource];
  if (!perms || perms.length === 0) return false;
  return perms.includes(action);
}

/**
 * Check whether a role is granted ANY of the given actions on a resource.
 *
 * @returns `true` if at least one action is permitted, `false` otherwise.
 */
export function canAny(
  role: OrgRole | null | undefined,
  resource: Resource,
  actions: Permission[],
): boolean {
  if (!role || actions.length === 0) return false;
  return actions.some((a) => can(role, resource, a));
}

/**
 * Check whether a role is granted ALL of the given actions on a resource.
 *
 * @returns `true` only if every action is permitted, `false` otherwise.
 */
export function canAll(
  role: OrgRole | null | undefined,
  resource: Resource,
  actions: Permission[],
): boolean {
  if (!role || actions.length === 0) return false;
  return actions.every((a) => can(role, resource, a));
}

/**
 * Require that a role has a specific permission. Throws `AuthorizationError`
 * (HTTP 403) if denied.
 *
 * @throws {AuthorizationError} when the role lacks the permission.
 */
export function requirePermission(
  role: OrgRole | null | undefined,
  resource: Resource,
  action: Permission,
): void {
  if (!can(role, resource, action)) {
    throw new AuthorizationError(
      `Permission denied: role "${role ?? 'null'}" cannot "${action}" on "${resource}"`,
      {
        code: 'PERMISSION_DENIED',
        details: { role, resource, action },
      },
    );
  }
}

/**
 * Convenience: returns `true` if the role can mutate data on the resource
 * (i.e. has any of write/delete/admin/manage_users/manage_org/billing).
 */
export function canMutate(
  role: OrgRole | null | undefined,
  resource: Resource,
): boolean {
  return canAny(role, resource, [
    'write',
    'delete',
    'admin',
    'manage_users',
    'manage_org',
    'billing',
  ]);
}

/**
 * Returns `true` if the role is a privileged tier (owner or admin).
 */
export function isPrivilegedRole(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Returns `true` if the role is a read-only tier (viewer). Note: `member` is
 * also effectively read-only but is treated separately for clarity.
 */
export function isReadOnlyRole(role: OrgRole | null | undefined): boolean {
  return role === 'viewer';
}
