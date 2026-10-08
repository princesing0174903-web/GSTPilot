/**
 * VEYRO Enterprise Cloud™ — Shared Types
 * Phase 7 · Enterprise Multi-Tenant SaaS Platform
 *
 * Every type here is tenant-scoped. Zero cross-tenant data leakage is enforced
 * at the service layer (tenant context) and verified by the audit engine.
 */

// ── Organization hierarchy node types ──────────────────────────────────────────
export type OrgType =
  | 'holding'
  | 'company'
  | 'group'
  | 'subsidiary'
  | 'branch'
  | 'department'
  | 'team'
  | 'business_unit'
  | 'project';

export const ORG_TYPES: OrgType[] = [
  'holding',
  'company',
  'group',
  'subsidiary',
  'branch',
  'department',
  'team',
  'business_unit',
  'project',
];

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

// ── Subscription plans (Subscription Engine™) ─────────────────────────────────
export type PlanKey = 'free' | 'starter' | 'professional' | 'business' | 'enterprise';

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  priceMonthly: number; // INR
  priceYearly: number; // INR
  seats: number;
  companies: number;
  storageMb: number;
  aiRequestsPerMonth: number;
  apiCallsPerMonth: number;
  automationRunsPerMonth: number;
  features: string[];
  highlight?: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    seats: 3,
    companies: 1,
    storageMb: 500,
    aiRequestsPerMonth: 100,
    apiCallsPerMonth: 1000,
    automationRunsPerMonth: 50,
    features: ['1 Company', '1 GSTIN', 'Basic Dashboard', 'Community Support'],
  },
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 1499,
    priceYearly: 14990,
    seats: 5,
    companies: 2,
    storageMb: 5000,
    aiRequestsPerMonth: 2000,
    apiCallsPerMonth: 10000,
    automationRunsPerMonth: 500,
    features: ['2 Companies', '3 GSTINs', 'AI CFO™', 'GST Filing', 'Email Support'],
  },
  {
    key: 'professional',
    name: 'Professional',
    priceMonthly: 4999,
    priceYearly: 49990,
    seats: 15,
    companies: 5,
    storageMb: 25000,
    aiRequestsPerMonth: 15000,
    apiCallsPerMonth: 75000,
    automationRunsPerMonth: 5000,
    features: ['5 Companies', '10 GSTINs', 'AI CEO™ + Workforce™', 'Digital Twin™', 'Business Graph™', 'Priority Support'],
    highlight: true,
  },
  {
    key: 'business',
    name: 'Business',
    priceMonthly: 14999,
    priceYearly: 149990,
    seats: 50,
    companies: 25,
    storageMb: 100000,
    aiRequestsPerMonth: 100000,
    apiCallsPerMonth: 500000,
    automationRunsPerMonth: 50000,
    features: ['25 Companies', 'Unlimited GSTINs', 'Full AI Suite', 'Inter-company Accounting', 'SSO + SCIM', 'Dedicated Manager'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 49999,
    priceYearly: 499990,
    seats: 200,
    companies: 100,
    storageMb: 1000000,
    aiRequestsPerMonth: 1000000,
    apiCallsPerMonth: 5000000,
    automationRunsPerMonth: 500000,
    features: ['100+ Companies', 'Unlimited Everything', 'Custom Roles', 'SAML/Okta/Azure AD', 'Audit Logs Export', 'SLA 99.99%', 'On-prem Option'],
  },
];

export function getPlan(key: string): PlanDefinition {
  return PLAN_DEFINITIONS.find((p) => p.key === key) ?? PLAN_DEFINITIONS[0];
}

// ── RBAC (Enterprise RBAC™) ───────────────────────────────────────────────────
export type SystemRoleKey =
  | 'owner'
  | 'ceo'
  | 'cfo'
  | 'coo'
  | 'cto'
  | 'cmo'
  | 'chro'
  | 'manager'
  | 'employee'
  | 'ca'
  | 'auditor'
  | 'consultant'
  | 'client'
  | 'vendor'
  | 'guest';

export interface SystemRoleDefinition {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

// Permission catalogue — feature-scoped permission keys
export const PERMISSION_CATALOGUE = [
  // Tenant / admin
  'tenant.manage',
  'tenant.billing',
  'tenant.delete',
  'tenant.invite',
  'tenant.suspend',
  // Organization
  'org.create',
  'org.update',
  'org.delete',
  // Users & roles
  'users.read',
  'users.manage',
  'roles.manage',
  // Finance
  'finance.read',
  'finance.manage',
  'invoices.read',
  'invoices.manage',
  'payments.read',
  'payments.manage',
  'banking.read',
  'banking.manage',
  // GST / compliance
  'gst.read',
  'gst.file',
  'gst.manage',
  'compliance.read',
  'compliance.manage',
  // CRM / business
  'crm.read',
  'crm.manage',
  'clients.read',
  'clients.manage',
  // AI
  'ai.oracle',
  'ai.ceo',
  'ai.cfo',
  'ai.workforce',
  'ai.execute',
  // Reports & audit
  'reports.read',
  'reports.export',
  'audit.read',
  'audit.export',
  // Settings
  'settings.read',
  'settings.manage',
  'apikeys.manage',
  'integrations.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOGUE)[number];

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full control over the tenant, billing and all data.',
    permissions: [...PERMISSION_CATALOGUE],
    isSystem: true,
  },
  {
    key: 'ceo',
    name: 'CEO',
    description: 'Strategic oversight, AI CEO access, all reads + approvals.',
    permissions: [
      'tenant.invite', 'org.create', 'org.update', 'users.read', 'roles.manage',
      'finance.read', 'invoices.read', 'payments.read', 'banking.read',
      'gst.read', 'compliance.read', 'crm.read', 'clients.read',
      'ai.oracle', 'ai.ceo', 'ai.cfo', 'ai.workforce', 'ai.execute',
      'reports.read', 'reports.export', 'audit.read', 'settings.read',
    ],
    isSystem: true,
  },
  {
    key: 'cfo',
    name: 'CFO',
    description: 'Financial control — invoices, payments, banking, AI CFO.',
    permissions: [
      'finance.read', 'finance.manage', 'invoices.read', 'invoices.manage',
      'payments.read', 'payments.manage', 'banking.read', 'banking.manage',
      'gst.read', 'compliance.read', 'ai.oracle', 'ai.cfo',
      'reports.read', 'reports.export', 'audit.read', 'settings.read',
    ],
    isSystem: true,
  },
  {
    key: 'coo',
    name: 'COO',
    description: 'Operations — automation, workforce, tasks, inventory.',
    permissions: [
      'org.update', 'users.read', 'crm.read', 'crm.manage', 'clients.read', 'clients.manage',
      'ai.workforce', 'ai.execute', 'reports.read', 'settings.read',
    ],
    isSystem: true,
  },
  {
    key: 'cto',
    name: 'CTO',
    description: 'Technology — integrations, API keys, settings, security.',
    permissions: [
      'users.read', 'apikeys.manage', 'integrations.manage', 'settings.read', 'settings.manage',
      'audit.read', 'reports.read',
    ],
    isSystem: true,
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Team management within assigned organization/department.',
    permissions: [
      'users.read', 'invoices.read', 'payments.read', 'gst.read', 'compliance.read',
      'crm.read', 'crm.manage', 'clients.read', 'clients.manage', 'ai.workforce',
      'reports.read', 'settings.read',
    ],
    isSystem: true,
  },
  {
    key: 'employee',
    name: 'Employee',
    description: 'Day-to-day operations within assigned scope.',
    permissions: [
      'invoices.read', 'gst.read', 'compliance.read', 'crm.read', 'clients.read',
      'ai.oracle', 'reports.read',
    ],
    isSystem: true,
  },
  {
    key: 'ca',
    name: 'CA / Accountant',
    description: 'Compliance and filing specialist.',
    permissions: [
      'invoices.read', 'invoices.manage', 'gst.read', 'gst.file', 'gst.manage',
      'compliance.read', 'compliance.manage', 'reports.read', 'reports.export', 'audit.read',
    ],
    isSystem: true,
  },
  {
    key: 'auditor',
    name: 'Auditor',
    description: 'Read-only access to financial and audit records.',
    permissions: ['finance.read', 'invoices.read', 'payments.read', 'gst.read', 'audit.read', 'reports.read'],
    isSystem: true,
  },
  {
    key: 'consultant',
    name: 'Consultant',
    description: 'Advisory read access.',
    permissions: ['finance.read', 'gst.read', 'compliance.read', 'reports.read'],
    isSystem: true,
  },
  {
    key: 'client',
    name: 'Client',
    description: 'Client portal — own invoices and filings only.',
    permissions: ['invoices.read', 'gst.read'],
    isSystem: true,
  },
  {
    key: 'vendor',
    name: 'Vendor',
    description: 'Vendor portal — own purchase orders and payments.',
    permissions: ['invoices.read', 'payments.read'],
    isSystem: true,
  },
  {
    key: 'guest',
    name: 'Guest',
    description: 'Limited guest access.',
    permissions: [],
    isSystem: true,
  },
];

export function getSystemRole(key: string): SystemRoleDefinition | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key);
}

// ── Identity providers (Enterprise Identity™) ─────────────────────────────────
export const IDENTITY_PROVIDERS = [
  { key: 'google', name: 'Google', category: 'oauth' },
  { key: 'microsoft', name: 'Microsoft', category: 'oauth' },
  { key: 'apple', name: 'Apple', category: 'oauth' },
  { key: 'github', name: 'GitHub', category: 'oauth' },
  { key: 'linkedin', name: 'LinkedIn', category: 'oauth' },
  { key: 'saml', name: 'SAML 2.0', category: 'sso' },
  { key: 'azure_ad', name: 'Azure AD', category: 'sso' },
  { key: 'okta', name: 'Okta', category: 'sso' },
  { key: 'auth0', name: 'Auth0', category: 'sso' },
  { key: 'scim', name: 'SCIM 2.0', category: 'provisioning' },
  { key: 'magic_link', name: 'Magic Links', category: 'passwordless' },
  { key: 'mfa', name: 'MFA / TOTP', category: 'security' },
  { key: 'passkeys', name: 'Passkeys / WebAuthn', category: 'security' },
  { key: 'device_trust', name: 'Device Trust', category: 'security' },
] as const;

// ── Usage metrics (Usage Metering™) ───────────────────────────────────────────
export const USAGE_METRICS = [
  { key: 'ai_requests', label: 'AI Requests', unit: 'calls' },
  { key: 'storage_mb', label: 'Storage', unit: 'MB' },
  { key: 'api_calls', label: 'API Calls', unit: 'calls' },
  { key: 'automation_runs', label: 'Automation Runs', unit: 'runs' },
  { key: 'invoices', label: 'Invoices', unit: 'count' },
  { key: 'gst_filings', label: 'GST Filings', unit: 'count' },
  { key: 'bank_txns', label: 'Bank Transactions', unit: 'count' },
  { key: 'emails', label: 'Emails', unit: 'count' },
  { key: 'whatsapp', label: 'WhatsApp Messages', unit: 'count' },
  { key: 'voice_calls', label: 'Voice Calls', unit: 'count' },
  { key: 'reports', label: 'Reports', unit: 'count' },
  { key: 'exports', label: 'Exports', unit: 'count' },
] as const;

// ── Audit actor types & actions (Enterprise Audit Engine™) ────────────────────
export type AuditActorType =
  | 'user'
  | 'ai_employee'
  | 'ai_ceo'
  | 'automation'
  | 'api'
  | 'integration'
  | 'approval'
  | 'system';

export const AUDIT_ACTIONS = [
  'login', 'logout', 'create', 'update', 'delete', 'approve', 'reject',
  'suspend', 'restore', 'invite', 'switch_company', 'assign_role',
  'export', 'file', 'api_call', 'payment', 'refund', 'config_change',
] as const;

// ── Notification channels (Global Notification Engine™) ───────────────────────
export const NOTIFICATION_CHANNELS = [
  'email', 'sms', 'whatsapp', 'slack', 'teams', 'push', 'in_app', 'webhook', 'voice',
] as const;

// ── Security event types ───────────────────────────────────────────────────────
export const SECURITY_EVENT_TYPES = [
  'login', 'logout', 'mfa_challenge', 'mfa_success', 'failed_login',
  'password_reset', 'api_key_used', 'suspicious', 'sso', 'session_revoked',
] as const;

// ── DTOs returned by the service layer ────────────────────────────────────────
export interface TenantContext {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: TenantStatus;
}

export interface HierarchyNode {
  id: string;
  name: string;
  type: OrgType;
  code: string | null;
  parentId: string | null;
  children: HierarchyNode[];
  memberCount: number;
  companyCount: number;
}

export interface AdminDashboard {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    region: string;
    timezone: string;
    createdAt: string;
  };
  counts: {
    organizations: number;
    companies: number;
    members: number;
    activeMembers: number;
    roles: number;
    integrations: number;
    apiKeys: number;
    auditEvents24h: number;
    securityEvents24h: number;
  };
  subscription: {
    plan: string;
    status: string;
    billingCycle: string;
    seatCount: number;
    companyCount: number;
    amount: number;
    currentPeriodEnd: string;
  } | null;
  usage: { metric: string; label: string; used: number; limit: number; pct: number }[];
  health: {
    status: 'healthy' | 'degraded' | 'down';
    dbLatencyMs: number;
    cacheLatencyMs: number;
    apiLatencyMs: number;
    uptimePct: number;
    errorRatePct: number;
  };
  mrr: number;
  arr: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    name: string;
    status: 'operational' | 'degraded' | 'down';
    latencyMs: number;
    detail: string;
  }[];
  uptimePct: number;
  errorRatePct: number;
  activeWorkers: number;
  queueDepth: number;
  dbConnections: number;
  cacheHitPct: number;
  checkedAt: string;
}

export interface GlobalSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  url: string | null;
  tenantName: string | null;
  updatedAt: string | null;
}
