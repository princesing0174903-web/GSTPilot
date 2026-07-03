// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Role-Based Access Control (RBAC) Permission Matrix
//
// A single source of truth for what each role can do. Pure functions — no
// React, no Firestore. Safe to import from client, server, or rules tooling.
//
// Usage:
//   import { can, hasPermission } from '@/lib/auth/permissions';
//   if (can(userRole, 'invoices.edit')) { ... }
// ═══════════════════════════════════════════════════════════════════════════════

import type { OrgRole, Permission } from './types';

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
    'ai.cfo', 'ai.oracle',
    'documents.upload', 'documents.view',
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
    'ai.cfo', 'ai.oracle',
    'documents.upload', 'documents.view',
    // Admin cannot: org.delete
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
 * `true` if the role can mutate ANY data (i.e. not a read-only tier).
 */
export function canMutate(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'accountant' || role === 'employee';
}

/**
 * `true` if the role is a read-only tier (auditor or viewer).
 */
export function isReadOnly(role: OrgRole | null | undefined): boolean {
  return role === 'auditor' || role === 'viewer';
}
