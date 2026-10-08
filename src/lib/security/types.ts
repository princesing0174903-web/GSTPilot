// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Enterprise Security Layer: Type System
//
// Phase 11 security infrastructure. Pure types — no runtime, no React, no
// Firestore. Safe to import from client, server, or Edge middleware.
//
// This module is the single source of truth for the security-layer vocabulary:
//   • OrgRole        — the five formal roles in a VEYRO organization
//   • Permission     — the eight coarse-grained actions the engine reasons about
//   • Resource       — the fourteen resource domains the engine protects
//   • PermissionMatrix — the role × resource × permission decision table
//   • SecurityContext — the per-request resolved identity + org + capabilities
//   • ABACPolicy     — attribute-based rule that can refine an RBAC decision
//
// NOTE: These types are intentionally distinct from the legacy `src/lib/auth/types.ts`
// `OrgRole` (which lists `owner | admin | accountant | employee | auditor | viewer`).
// The security layer formalizes a slightly different 5-role hierarchy
// (`owner | admin | accountant | viewer | member`) per the Phase 11 spec. Both
// type systems coexist — this one powers middleware + RBAC/ABAC; the legacy one
// powers the existing OrgContext UI. They are NOT cross-cast.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formal organization roles for the security engine, ordered by descending
 * privilege:
 *
 *  - `owner`       — Full control. Billing, deletion, ownership transfer. (1 per org.)
 *  - `admin`       — Manage members, settings, and all data. Cannot delete the org.
 *  - `accountant`  — Read/write financial resources (invoices, returns, payments,
 *                    banking). No user management, no org deletion.
 *  - `viewer`      — Read-only across the org. No mutations, no billing.
 *  - `member`      — Limited read. Day-to-day operational access on assigned data.
 */
export type OrgRole = 'owner' | 'admin' | 'accountant' | 'viewer' | 'member';

/**
 * Coarse-grained actions the security engine reasons about. Each (resource, action)
 * pair is evaluated against the permission matrix.
 *
 *  - `read`          — GET / view / list
 *  - `write`         — POST / PUT / PATCH / create / update
 *  - `delete`        — DELETE / remove / hard-delete
 *  - `admin`         — administrative action (manage org-level config)
 *  - `billing`       — billing / subscription management
 *  - `export`        — bulk data export (GDPR / CSV / backup)
 *  - `manage_users`  — invite / remove / change member roles
 *  - `manage_org`    — change org name, slug, gstin, plan; delete the org itself
 */
export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'admin'
  | 'billing'
  | 'export'
  | 'manage_users'
  | 'manage_org';

/**
 * Resource domains protected by the engine. Each domain maps to a set of
 * Firestore collections / API route prefixes.
 */
export type Resource =
  | 'clients'
  | 'invoices'
  | 'returns'
  | 'payments'
  | 'documents'
  | 'banking'
  | 'erp'
  | 'billing'
  | 'ai'
  | 'organization'
  | 'users'
  | 'audit_logs'
  | 'settings'
  | 'reports';

/**
 * The full role × resource × permission decision table. For every role, for
 * every resource, the list of permissions that role is granted. An empty array
 * means "no access to this resource."
 *
 * The matrix is exhaustive: if a (role, resource, action) triple is not listed,
 * the action is denied.
 */
export type PermissionMatrix = Record<OrgRole, Record<Resource, Permission[]>>;

/**
 * The active subscription status of an organization. Drives the
 * `requireActiveSubscription` middleware helper and the ABAC "trial users
 * can't use ERP sync" policy.
 */
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'suspended'
  | 'canceled'
  | 'incomplete'
  | 'none';

/**
 * A fully-resolved per-request security context. Built by `requireAuth` /
 * `requireOrg` / `requireRole` / `requirePermission` in `middleware-helpers.ts`
 * and consumed by route handlers, the RBAC engine, and the ABAC engine.
 */
export interface SecurityContext {
  /** Firebase Auth UID of the caller. */
  uid: string;
  /** The organization the caller is acting within. `null` for unscoped requests. */
  orgId: string | null;
  /** The caller's role within `orgId`. `null` if not a member of any org. */
  role: OrgRole | null;
  /** Resolved permission map for the caller's role (RBAC). */
  permissions: Record<Resource, Permission[]>;
  /** The org's subscription status. `none` if no subscription record exists. */
  subscriptionStatus: SubscriptionStatus;
  /**
   * `true` if the caller is a VEYRO staff super-admin (identified by an
   * allow-listed email / custom claim). Super-admins bypass RBAC entirely.
   */
  isSuperAdmin: boolean;
}

/**
 * An attribute-based access control policy. Policies refine RBAC decisions by
 * inspecting attributes of the security context (caller's org, role,
 * subscription) and the target resource (its owning org, sensitivity, etc.).
 *
 * A policy returns `true` to ALLOW the action and `false` to DENY it. The ABAC
 * engine combines policies with deny-wins semantics (any policy that returns
 * `false` denies the request).
 *
 * The `resource` field is the resource the policy applies to (or `'*'` for
 * all resources). The `action` field is the action (or `'*'` for all actions).
 */
export interface ABACPolicy {
  /** The resource this policy applies to, or `'*'` for all resources. */
  resource: Resource | '*';
  /** The action this policy applies to, or `'*'` for all actions. */
  action: Permission | '*';
  /**
   * The condition function. Returns `true` to ALLOW, `false` to DENY.
   * Receives the resolved security context and an optional resource-attribute
   * bag (e.g. `{ ownerUid, orgId }` for a specific document being accessed).
   */
  condition: (
    ctx: SecurityContext,
    resourceAttrs?: Record<string, unknown>,
  ) => boolean;
  /** Human-readable name for audit logs. */
  name: string;
}

/** All formal roles, ordered by descending privilege. */
export const ALL_SECURITY_ROLES: OrgRole[] = [
  'owner',
  'admin',
  'accountant',
  'viewer',
  'member',
];

/** All resources protected by the security engine. */
export const ALL_RESOURCES: Resource[] = [
  'clients',
  'invoices',
  'returns',
  'payments',
  'documents',
  'banking',
  'erp',
  'billing',
  'ai',
  'organization',
  'users',
  'audit_logs',
  'settings',
  'reports',
];

/** All permissions recognized by the engine. */
export const ALL_PERMISSIONS: Permission[] = [
  'read',
  'write',
  'delete',
  'admin',
  'billing',
  'export',
  'manage_users',
  'manage_org',
];

/** Human-readable labels for roles (for audit logs + admin UI). */
export const SECURITY_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  viewer: 'Viewer',
  member: 'Member',
};

/** Human-readable labels for permissions. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  read: 'Read',
  write: 'Write',
  delete: 'Delete',
  admin: 'Admin',
  billing: 'Billing',
  export: 'Export',
  manage_users: 'Manage Users',
  manage_org: 'Manage Organization',
};
