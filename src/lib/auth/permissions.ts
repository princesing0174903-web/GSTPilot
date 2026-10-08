// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Role-Based Access Control (RBAC) Permission Matrix
//
// A single source of truth for what each role can do. Pure functions — no
// React, no Firestore. Safe to import from client, server, or rules tooling.
//
// Usage:
//   import { can, hasPermission } from '@/lib/auth/permissions';
//   if (can(userRole, 'invoices.edit')) { ... }
// ═══════════════════════════════════════════════════════════════════════════════

import type { OrgRole, Permission } from './types';
import { ROLE_RANK } from './types';

/**
 * The permission matrix. `true` = role has the capability.
 *
 * Privilege flows downward: owner ⊇ admin ⊇ accountant ⊇ employee, and
 * auditor / viewer are read-only tiers. This matrix is exhaustive — if a
 * permission is not listed for a role, the role does not have it.
 */
const PERMISSION_MATRIX: Record<OrgRole, Set<Permission>> = {
  owner: new Set<Permission>([
    // Owner has everything.
    'org.view', 'org.settings', 'org.billing', 'org.delete',
    'org.members.manage', 'org.members.invite', 'org.export',
    'clients.create', 'clients.edit', 'clients.delete', 'clients.view',
    'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.view',
    'returns.create', 'returns.edit', 'returns.delete', 'returns.view', 'returns.approve',
    'payments.create', 'payments.edit', 'payments.view',
    'expenses.create', 'expenses.edit', 'expenses.view',
    'banking.connect', 'banking.view',
    'gst.profile.manage', 'gst.view',
    'notices.manage', 'notices.view',
    'reports.generate', 'reports.view',
    'tasks.create', 'tasks.edit', 'tasks.view',
    'ai.cfo', 'ai.oracle', 'ai.settings',
    'documents.upload', 'documents.view',
    // Enterprise extensions
    'payroll.view', 'payroll.manage',
    'integrations.view', 'integrations.manage',
    'admin.view', 'admin.manage',
    'apikeys.view', 'apikeys.manage',
    'audit.view',
  ]),

  admin: new Set<Permission>([
    'org.view', 'org.settings', 'org.billing',
    'org.members.manage', 'org.members.invite', 'org.export',
    'clients.create', 'clients.edit', 'clients.delete', 'clients.view',
    'invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.view',
    'returns.create', 'returns.edit', 'returns.delete', 'returns.view', 'returns.approve',
    'payments.create', 'payments.edit', 'payments.view',
    'expenses.create', 'expenses.edit', 'expenses.view',
    'banking.connect', 'banking.view',
    'gst.profile.manage', 'gst.view',
    'notices.manage', 'notices.view',
    'reports.generate', 'reports.view',
    'tasks.create', 'tasks.edit', 'tasks.view',
    'ai.cfo', 'ai.oracle', 'ai.settings',
    'documents.upload', 'documents.view',
    // Enterprise extensions
    'payroll.view', 'payroll.manage',
    'integrations.view', 'integrations.manage',
    'admin.view', 'admin.manage',
    'apikeys.view', 'apikeys.manage',
    'audit.view',
    // Admin cannot: org.delete
  ]),

  manager: new Set<Permission>([
    'org.view', 'org.export',
    'org.members.manage', 'org.members.invite',
    'clients.create', 'clients.edit', 'clients.view',
    'invoices.create', 'invoices.edit', 'invoices.view',
    'returns.create', 'returns.edit', 'returns.view', 'returns.approve',
    'payments.create', 'payments.edit', 'payments.view',
    'expenses.create', 'expenses.edit', 'expenses.view',
    'banking.connect', 'banking.view',
    'gst.profile.manage', 'gst.view',
    'notices.manage', 'notices.view',
    'reports.generate', 'reports.view',
    'tasks.create', 'tasks.edit', 'tasks.view',
    'ai.cfo', 'ai.oracle',
    'documents.upload', 'documents.view',
    // Enterprise extensions
    'payroll.view', 'payroll.manage',
    'integrations.view',
    'audit.view',
    // Manager cannot: org.settings, org.billing, org.delete, clients.delete,
    //                 invoices.delete, returns.delete, admin.manage, apikeys.manage,
    //                 integrations.manage, ai.settings
  ]),

  accountant: new Set<Permission>([
    'org.view', 'org.export',
    'clients.create', 'clients.edit', 'clients.view',
    'invoices.create', 'invoices.edit', 'invoices.view',
    'returns.create', 'returns.edit', 'returns.view', 'returns.approve',
    'payments.create', 'payments.edit', 'payments.view',
    'expenses.create', 'expenses.edit', 'expenses.view',
    'banking.connect', 'banking.view',
    'gst.profile.manage', 'gst.view',
    'notices.manage', 'notices.view',
    'reports.generate', 'reports.view',
    'tasks.create', 'tasks.edit', 'tasks.view',
    'ai.cfo', 'ai.oracle',
    'documents.upload', 'documents.view',
    // Enterprise extensions (read-only tiers)
    'payroll.view',
    'integrations.view',
    'audit.view',
    // Accountant cannot: clients.delete, invoices.delete, returns.delete,
    //                    org.settings, org.billing, org.members.manage, org.members.invite, org.delete
  ]),

  employee: new Set<Permission>([
    'org.view',
    'clients.view',
    'invoices.create', 'invoices.edit', 'invoices.view',
    'returns.create', 'returns.edit', 'returns.view',
    'payments.view',
    'expenses.create', 'expenses.view',
    'banking.view',
    'gst.view',
    'notices.view',
    'reports.view',
    'tasks.create', 'tasks.edit', 'tasks.view',
    'ai.oracle',
    'documents.upload', 'documents.view',
    // Enterprise extensions
    'integrations.view',
    // Employee cannot: delete anything, approve returns, settings, billing, members, export
  ]),

  auditor: new Set<Permission>([
    'org.view',
    'clients.view',
    'invoices.view',
    'returns.view',
    'payments.view',
    'expenses.view',
    'banking.view',
    'gst.view',
    'notices.view',
    'reports.view',
    'tasks.view',
    'documents.view',
    // Enterprise extensions (read-only)
    'payroll.view',
    'integrations.view',
    'admin.view',
    'audit.view',
    // Auditor: read-only everywhere, no mutation, no AI actions.
  ]),

  viewer: new Set<Permission>([
    'org.view',
    'clients.view',
    'invoices.view',
    'returns.view',
    'payments.view',
    'expenses.view',
    'gst.view',
    'reports.view',
    'tasks.view',
    // Enterprise extensions (read-only, limited)
    'integrations.view',
    // Viewer: read-only, subset (no banking, no notices, no documents, no AI).
  ]),
};

/**
 * Check whether a role grants a specific permission.
 *
 * @returns `true` if the role has the permission, `false` otherwise (including
 *          when the role is unknown / null).
 *
 * @example
 *   can('accountant', 'invoices.edit')   // true
 *   can('viewer', 'invoices.create')     // false
 *   can(null, 'invoices.view')           // false
 */
export function can(role: OrgRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = PERMISSION_MATRIX[role];
  return perms ? perms.has(permission) : false;
}

/**
 * Check whether a role grants ALL of the given permissions.
 */
export function canAll(role: OrgRole | null | undefined, permissions: Permission[]): boolean {
  if (!role || permissions.length === 0) return false;
  return permissions.every((p) => can(role, p));
}

/**
 * Check whether a role grants ANY of the given permissions.
 */
export function canAny(role: OrgRole | null | undefined, permissions: Permission[]): boolean {
  if (!role || permissions.length === 0) return false;
  return permissions.some((p) => can(role, p));
}

/**
 * Alias for {@link can} — `hasPermission` reads naturally in guard clauses.
 */
export const hasPermission = can;

/**
 * Returns the full list of permissions for a role. Useful for debugging,
 * audit logs, and UI that shows a role's capabilities.
 */
export function permissionsFor(role: OrgRole): Permission[] {
  const perms = PERMISSION_MATRIX[role];
  return perms ? Array.from(perms) : [];
}

/**
 * Higher-privilege tier check. Used by the settings / billing UI to decide
 * whether to show management controls.
 */
export function isPrivileged(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * `true` if the role can manage members (invite, change roles, remove).
 */
export function canManageMembers(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

/**
 * `true` if the role can mutate ANY data (i.e. not a read-only tier).
 */
export function canMutate(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager' || role === 'accountant' || role === 'employee';
}

/**
 * `true` if the role is a read-only tier (auditor or viewer).
 */
export function isReadOnly(role: OrgRole | null | undefined): boolean {
  return role === 'auditor' || role === 'viewer';
}

/**
 * Returns the numeric privilege rank of a role (higher = more powerful).
 * Unknown / null roles return 0.
 */
export function rankOf(role: OrgRole | null | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role] ?? 0;
}

/**
 * `true` if `actorRole` can assign or manage a member with `targetRole`.
 * A user may never manage someone at or above their own rank (prevents
 * privilege escalation), and may never grant a role at or above their own.
 */
export function canManageRole(
  actorRole: OrgRole | null | undefined,
  targetRole: OrgRole | null | undefined,
): boolean {
  if (!actorRole || !targetRole) return false;
  return rankOf(actorRole) > rankOf(targetRole);
}

/**
 * `true` if `actorRole` is allowed to assign `targetRole` to a new/existing
 * member. The target must be strictly lower-ranked than the actor.
 */
export function canAssignRole(
  actorRole: OrgRole | null | undefined,
  targetRole: OrgRole,
): boolean {
  if (!actorRole) return false;
  return rankOf(actorRole) > rankOf(targetRole);
}
