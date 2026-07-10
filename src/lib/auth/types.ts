// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Multi-Tenant Auth & Organization Type System
//
// Production-grade type definitions for the multi-tenant SaaS architecture.
// Every user belongs to exactly one active organization. Every Firestore
// document carries an `organizationId` and is isolated by tenant.
//
// Design references: Stripe (organizations + members), Linear (roles),
// Notion (workspaces), Vercel (teams).
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Organization roles, ordered by descending privilege.
 *
 * - `owner`      — Full control. Billing, delete org, transfer ownership. (1 per org)
 * - `admin`      — Manage members, settings, and all data. Cannot delete org / transfer ownership.
 * - `accountant` — Create / edit financial data (invoices, returns, expenses, payments).
 * - `employee`   — Day-to-day operational access (own tasks, assigned clients). No settings.
 * - `auditor`    — Read-only across the org. Cannot mutate anything.
 * - `viewer`     — Read-only, limited to non-sensitive dashboards.
 */
export type OrgRole =
  | 'owner'
  | 'admin'
  | 'accountant'
  | 'employee'
  | 'auditor'
  | 'viewer';

/**
 * Fine-grained capabilities. A capability is a specific action a role may or
 * may not perform. The permission matrix in `permissions.ts` maps roles → caps.
 */
export type Permission =
  | 'org.view'
  | 'org.settings'
  | 'org.billing'
  | 'org.delete'
  | 'org.members.manage'
  | 'org.members.invite'
  | 'org.export'
  // Data CRUD
  | 'clients.create'
  | 'clients.edit'
  | 'clients.delete'
  | 'clients.view'
  | 'invoices.create'
  | 'invoices.edit'
  | 'invoices.delete'
  | 'invoices.view'
  | 'returns.create'
  | 'returns.edit'
  | 'returns.delete'
  | 'returns.view'
  | 'returns.approve'
  | 'payments.create'
  | 'payments.edit'
  | 'payments.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'expenses.view'
  | 'banking.connect'
  | 'banking.view'
  | 'gst.profile.manage'
  | 'gst.view'
  | 'notices.manage'
  | 'notices.view'
  | 'reports.generate'
  | 'reports.view'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.view'
  | 'ai.cfo'
  | 'ai.oracle'
  | 'documents.upload'
  | 'documents.view';

/**
 * The membership status of a user within an organization.
 */
export type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed';

// ─── Firestore Document Shapes ───────────────────────────────────────────────

/**
 * `organizations/{orgId}`
 *
 * The top-level tenant document. Every other tenant-scoped collection carries
 * `organizationId` pointing back here.
 */
export interface OrganizationDoc {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  logoUrl: string | null;
  gstin: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: unknown;
  updatedAt: unknown;
  // ── Extended firm-profile fields (written by SettingsPage, previously
  //    stripped by toOrgDoc() → caused settings to reset on refresh). ──
  legalName?: string | null;
  state?: string | null;
  entityType?: string | null;
  caRegNumber?: string | null;
  officeAddress?: string | null;
  gstConfig?: {
    returnFrequency?: 'monthly' | 'quarterly';
    fyStartMonth?: number;
    gstr1Enabled?: boolean;
    gstr3bEnabled?: boolean;
    itcMethod?: 'invoice' | 'provisional';
    lateFilingAlert?: boolean;
    dueDateReminderDays?: number;
  } | null;
  notifications?: {
    emailUpdates?: boolean;
    gstReminders?: boolean;
    clientActivity?: boolean;
    aiInsights?: boolean;
    securityAlerts?: boolean;
    marketingUpdates?: boolean;
  } | null;
  branding?: {
    primaryColor?: string;
    accentColor?: string;
    customDomain?: string | null;
  } | null;
  integrations?: Record<string, { connected: boolean; connectedAt?: string | null }> | null;
}

/**
 * `organization_members/{memberId}`
 *
 * A join document linking a Firebase Auth user to an organization with a role.
 * A user may have membership rows for multiple orgs, but only one is "current"
 * (tracked on the user doc as `currentOrganizationId`).
 */
export interface OrganizationMemberDoc {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  role: OrgRole;
  status: MemberStatus;
  invitedBy: string | null;
  invitedAt: unknown;
  joinedAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * `users/{uid}` — the per-user profile document.
 *
 * Firebase Auth handles authentication only. This document stores the user's
 * profile (name, photo, phone, company, gstin, role) and their currently
 * selected organization.
 */
export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  phone: string | null;
  company: string | null;
  gstin: string | null;
  role: OrgRole;
  provider: 'google' | 'email';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  currentOrganizationId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

// ─── Context Shapes ──────────────────────────────────────────────────────────

/**
 * A fully-resolved membership record as consumed by the UI / permission layer.
 */
export interface OrgMembership {
  organization: OrganizationDoc;
  member: OrganizationMemberDoc;
}

/**
 * The shape of the resolved "current organization context" — user + org + role
 * + the full member roster for that org. Loaded once after auth and cached in
 * `OrgContext`.
 */
export interface ResolvedOrgContext {
  user: {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string | null;
    phone: string | null;
    company: string | null;
    gstin: string | null;
    role: OrgRole;
    provider: 'google' | 'email';
    emailVerified: boolean;
    onboardingCompleted: boolean;
  };
  organization: OrganizationDoc | null;
  membership: OrganizationMemberDoc | null;
  members: OrganizationMemberDoc[];
  /** True until the first org-context load attempt completes. */
  loading: boolean;
  /** Set if the org context could not be loaded (e.g. network, rules). */
  error: string | null;
  /** True when the user is authenticated but has no organization yet. */
  needsOrganization: boolean;
}

export const ALL_ROLES: OrgRole[] = [
  'owner',
  'admin',
  'accountant',
  'employee',
  'auditor',
  'viewer',
];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  employee: 'Employee',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full control. Billing, members, settings, and deletion.',
  admin: 'Manage members, settings, and all organization data.',
  accountant: 'Create and edit invoices, returns, expenses, and payments.',
  employee: 'Operational access — assigned tasks and clients.',
  auditor: 'Read-only access across the entire organization.',
  viewer: 'Read-only access to dashboards and reports.',
};
