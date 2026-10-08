// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE CLOUD PLATFORM™ — TYPE SYSTEM
// Global SaaS infrastructure layer. Every organisation receives an isolated
// enterprise (workspace + AI memory + Business Graph + Knowledge Graph +
// Digital Twin + Execution Cloud + Compliance Cloud + Data Intelligence Cloud +
// Command Network + AGI instance). Oracle™ now powers customers.
// Tagline: Build Once. Deploy Globally. Scale Infinitely.
// ═══════════════════════════════════════════════════════════════════════════════

export const PLATFORM_TAGLINE = 'VEYRO Enterprise Cloud Platform™ — Build Once. Deploy Globally. Scale Infinitely.';

// ─── Plan definitions ──────────────────────────────────────────────────────────

export type PlanKey = 'starter' | 'professional' | 'business' | 'enterprise' | 'enterprise_plus' | 'custom';

export interface PlanLimits {
  seats: number | null;              // null = unlimited
  storageGb: number;
  apiCallsPerMonth: number;
  aiCreditsPerMonth: number;
  workflowExecutions: number;
  agiExecutions: number;
  connectors: number;
  marketplaceApps: number | null;
  environments: number;              // dev / staging / prod etc.
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  tagline: string;
  monthlyPrice: number;              // INR
  annualPrice: number;               // INR (per year)
  seatPrice: number;                 // INR per seat / month
  recommended?: boolean;
  highlight?: string;
  limits: PlanLimits;
  features: string[];
  support: string;
  sla?: string;
}

export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';

export interface Subscription {
  id: string;
  organizationId: string;
  plan: PlanKey;
  planName: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  seats: number;
  seatPrice: number;
  monthlyBase: number;
  annualBase: number;
  discountPct: number;
  couponCode?: string | null;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Organizations ─────────────────────────────────────────────────────────────

export type OrganizationType = 'standalone' | 'parent' | 'subsidiary' | 'branch';

export interface BrandingConfig {
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  loginHeading?: string;
  emailFromName?: string;
  domain?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  legalName?: string | null;
  country: string;
  timezone: string;
  currency: string;
  parentId?: string | null;
  organizationType: OrganizationType;
  plan: PlanKey;
  planStatus: SubscriptionStatus;
  trialEndsAt?: string | null;
  status: string;
  industry?: string | null;
  employeeCount: number;
  monthlyRevenue: number;            // MRR
  seatsUsed: number;
  seatsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
  apiCallsMonth: number;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  healthScore: number;
  churnRisk: number;
  branding: BrandingConfig;
  provisioningState: string;
  provisionedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // aggregated in orchestrator
  departmentsCount?: number;
  branchesCount?: number;
  costCentersCount?: number;
  usersCount?: number;
  subsidiaries?: Organization[];
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  parentId?: string | null;
  headUserId?: string | null;
  costCenterId?: string | null;
  headcount: number;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  city?: string | null;
  state?: string | null;
  country: string;
  timezone: string;
  gstin?: string | null;
  isHeadquarters: boolean;
  headcount: number;
}

export interface CostCenter {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  budget: number;
  spent: number;
  currency: string;
  ownerId?: string | null;
}

// ─── Enterprise Identity Cloud ─────────────────────────────────────────────────

export type IdentityProviderKey =
  | 'email'
  | 'google'
  | 'microsoft'
  | 'github'
  | 'saml'
  | 'azure_ad'
  | 'okta'
  | 'ldap'
  | 'passwordless';

export interface IdentityProviderConfig {
  key: IdentityProviderKey;
  label: string;
  status: 'configured' | 'connected' | 'disabled' | 'error' | 'available';
  userCount: number;
  lastSyncAt?: string | null;
  ssoReady: boolean;
  supportsMfa: boolean;
  supportsPasswordless: boolean;
}

export interface TenantUser {
  id: string;
  organizationId: string;
  email: string;
  name?: string | null;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'billing' | 'auditor';
  status: 'active' | 'invited' | 'suspended' | 'removed';
  mfaEnabled: boolean;
  lastActiveAt?: string | null;
  invitedAt: string;
  joinedAt?: string | null;
}

export interface IdentitySummary {
  providers: IdentityProviderConfig[];
  totalUsers: number;
  activeUsers: number;
  mfaAdoptionPct: number;
  passwordlessAdoptionPct: number;
  ssoAdoptionPct: number;
  deviceTrustEnabled: boolean;
  sessionPolicy: {
    maxSessionHours: number;
    idleTimeoutMinutes: number;
    concurrentSessions: number;
  };
}

// ─── Billing Engine ────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void' | 'overdue' | 'refunded';

export interface InvoiceLineItem {
  name: string;
  category: 'seats' | 'ai_tokens' | 'api_usage' | 'storage' | 'connectors' | 'workflow_executions' | 'agi_executions' | 'marketplace' | 'add_on';
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  taxPct: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface BillingSummary {
  mrr: number;                       // monthly recurring revenue (platform-wide)
  arr: number;                       // annual recurring revenue
  totalOrganizations: number;
  payingOrganizations: number;
  trialOrganizations: number;
  churnedThisMonth: number;
  averageRevenuePerOrg: number;
  outstanding: number;               // overdue invoices total
  collectedThisMonth: number;
  recentInvoices: Invoice[];
  revenueByPlan: { plan: PlanKey; planName: string; organizations: number; mrr: number }[];
  usageBreakdown: {
    seats: number;
    aiCreditsUsed: number;
    apiCallsMonth: number;
    storageUsedMb: number;
    workflowExecutions: number;
    agiExecutions: number;
  };
}

// ─── Marketplace Platform ──────────────────────────────────────────────────────

export type MarketplaceAppKind = 'app' | 'agent' | 'workflow' | 'template' | 'dashboard' | 'connector' | 'report' | 'compliance_pack';

export interface MarketplaceListing {
  id: string;
  name: string;
  slug: string;
  kind: MarketplaceAppKind;
  publisher: string;
  version: string;
  description: string;
  category: string;
  rating: number;
  installs: number;
  price: number;                     // one-time INR; 0 = free
  monthlyPrice?: number;             // recurring INR
  iconColor: string;
  tags: string[];
  featured: boolean;
}

export interface MarketplaceInstall {
  id: string;
  organizationId: string;
  appId: string;
  appName: string;
  appKind: MarketplaceAppKind;
  publisher: string;
  version: string;
  status: 'installing' | 'installed' | 'failed' | 'uninstalled' | 'update_available';
  installedBy?: string | null;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceSummary {
  totalListings: number;
  totalInstalls: number;
  featuredApps: MarketplaceListing[];
  topCategories: { category: string; count: number }[];
  installsByKind: { kind: MarketplaceAppKind; count: number }[];
  recentInstalls: MarketplaceInstall[];
  topPublishers: { publisher: string; apps: number; installs: number }[];
}

// ─── API Platform ──────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMin: number;
  rateLimitPerDay: number;
  callsTotal: number;
  callsToday: number;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  status: 'active' | 'revoked' | 'expired';
  createdBy?: string | null;
  createdAt: string;
}

export interface ApiEndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
  auth: 'api_key' | 'oauth' | 'public';
  rateLimited: boolean;
}

export interface ApiPlatformSummary {
  totalKeys: number;
  activeKeys: number;
  totalCalls: number;
  callsToday: number;
  averageLatencyMs: number;
  errorRatePct: number;
  endpoints: ApiEndpointSpec[];
  webhooks: { id: string; url: string; events: string[]; status: string; deliveries: number }[];
  sdks: { language: string; version: string; installs: number }[];
  oauthApps: number;
  rateLimits: { tier: string; perMinute: number; perDay: number };
}

// ─── DevOps Cloud ──────────────────────────────────────────────────────────────

export type EnvironmentType = 'production' | 'staging' | 'development' | 'sandbox' | 'preview';

export interface DevopsEnvironment {
  id: string;
  organizationId: string;
  name: string;
  environmentType: EnvironmentType;
  region: string;
  version?: string | null;
  status: 'provisioning' | 'healthy' | 'deploying' | 'unhealthy' | 'rolled_back';
  strategy: 'rolling' | 'blue_green' | 'canary' | 'recreate';
  replicas: number;
  uptimePct: number;
  latencyMs: number;
  errorRatePct: number;
  cpuUsagePct: number;
  memUsageMb: number;
  lastDeployAt?: string | null;
  lastDeployBy?: string | null;
}

export interface DevopsSummary {
  totalEnvironments: number;
  healthy: number;
  deploying: number;
  unhealthy: number;
  ciCdPipelines: number;
  recentDeploys: DevopsEnvironment[];
  regions: { region: string; environments: number; healthy: number }[];
  deploymentStrategies: { strategy: string; count: number }[];
  rollbackAvailable: number;
}

// ─── Enterprise Monitoring ─────────────────────────────────────────────────────

export interface MonitoringSummary {
  totalOrganizations: number;
  activeUsers24h: number;
  activeUsers30d: number;
  apiCallsToday: number;
  apiCalls30d: number;
  agiExecutionsToday: number;
  agiExecutions30d: number;
  errorRatePct: number;
  uptimePct: number;
  p95LatencyMs: number;
  totalStorageMb: number;
  activeConnectors: number;
  topErrors: { error: string; count: number; severity: string }[];
  usageByHour: { hour: string; apiCalls: number; agiExecutions: number }[];
  regionsHealth: { region: string; status: string; uptimePct: number }[];
}

// ─── Customer Success Center ───────────────────────────────────────────────────

export interface CustomerHealthRecord {
  organizationId: string;
  organizationName: string;
  score: number;
  adoptionPct: number;
  churnRisk: number;
  expansionScore: number;
  openTickets: number;
  satisfaction: number;
  lastContactAt?: string | null;
  recommendedActions: string[];
  plan: PlanKey;
  mrr: number;
}

export interface CustomerSuccessSummary {
  totalOrganizations: number;
  averageHealth: number;
  atRisk: number;
  expansionOpportunities: number;
  openTickets: number;
  averageSatisfaction: number;
  adoptionAverage: number;
  healthDistribution: { bucket: string; count: number }[];
  topRisks: CustomerHealthRecord[];
  expansionCandidates: CustomerHealthRecord[];
  recommendedActions: { action: string; impact: string; priority: string }[];
}

// ─── Security ──────────────────────────────────────────────────────────────────

export interface SecuritySummary {
  rbacRoles: number;
  abacPolicies: number;
  auditEvents30d: number;
  criticalEvents: number;
  encryptionStatus: {
    atRest: boolean;
    inTransit: boolean;
    keyRotationDays: number;
  };
  secretsManaged: number;
  tenantIsolationVerified: boolean;
  zeroTrustEnabled: boolean;
  soc2Readiness: number;             // 0-100
  iso27001Readiness: number;         // 0-100
  recentAuditEvents: {
    id: string;
    organizationId: string;
    actor: string;
    action: string;
    category: string;
    severity: string;
    createdAt: string;
  }[];
}

// ─── Performance ───────────────────────────────────────────────────────────────

export interface PerformanceTargets {
  maxOrganizations: number;
  maxUsers: number;
  maxApiRequestsPerDay: number;
  targetUptimePct: number;
  targetP95LatencyMs: number;
}

export interface PerformanceSummary {
  targets: PerformanceTargets;
  current: {
    organizations: number;
    users: number;
    apiRequestsToday: number;
    uptimePct: number;
    p95LatencyMs: number;
  };
  utilization: {
    organizationsPct: number;
    usersPct: number;
    apiPct: number;
  };
  scaling: {
    horizontalScaling: boolean;
    autoscaling: boolean;
    cdnEnabled: boolean;
    regionsDeployed: number;
    replicasTotal: number;
    haEnabled: boolean;
  };
  regionalDeployment: { region: string; status: string; organizations: number }[];
}

// ─── Customer Admin Center (lightweight summary) ───────────────────────────────

export interface CustomerAdminSummary {
  managedUsers: number;
  managedRoles: number;
  managedPermissions: number;
  managedDepartments: number;
  managedIntegrations: number;
  aiExecutivesEnabled: number;
  budgetsTracked: number;
  policiesEnforced: number;
  brandingApplied: number;
}

// ─── White Label ───────────────────────────────────────────────────────────────

export interface WhiteLabelSummary {
  brandedOrganizations: number;
  customDomains: number;
  customLogos: number;
  brandColorsApplied: number;
  brandedEmailTemplates: number;
  brandedLoginPage: number;
  brandedReports: number;
  brandedPdf: number;
  brandedMobile: number;
}

// ─── Platform Dashboard (orchestrator output) ──────────────────────────────────

export interface PlatformDashboard {
  generatedAt: string;
  tagline: string;

  // ── Headline KPIs ──
  headline: {
    totalOrganizations: number;
    payingOrganizations: number;
    trialOrganizations: number;
    totalUsers: number;
    activeUsers24h: number;
    mrr: number;
    arr: number;
    averageHealthScore: number;
    averageSatisfaction: number;
    uptimePct: number;
    apiCallsToday: number;
    agiExecutionsToday: number;
    marketplaceInstalls: number;
  };

  // ── 14 Subsystems ──
  organizations: {
    summary: {
      total: number;
      parents: number;
      subsidiaries: number;
      branches: number;
      departmentsTotal: number;
      costCentersTotal: number;
      countries: number;
      timezones: number;
    };
    topOrganizations: Organization[];
    recentOrganizations: Organization[];
    orgTypeDistribution: { type: OrganizationType; count: number }[];
  };
  identity: IdentitySummary;
  subscription: {
    byPlan: { plan: PlanKey; planName: string; organizations: number; mrr: number; pct: number }[];
    billingCycles: { cycle: BillingCycle; organizations: number }[];
    trials: { active: number; expiring7d: number; converted30d: number; conversionRate: number };
    coupons: { code: string; uses: number; discountPct: number }[];
  };
  billing: BillingSummary;
  customerAdmin: CustomerAdminSummary;
  whiteLabel: WhiteLabelSummary;
  marketplace: MarketplaceSummary;
  apiPlatform: ApiPlatformSummary;
  devops: DevopsSummary;
  monitoring: MonitoringSummary;
  customerSuccess: CustomerSuccessSummary;
  security: SecuritySummary;
  performance: PerformanceSummary;

  // ── Meta ──
  hasLiveData: boolean;
  dataSources: string[];
  subsystemsImplemented: number;
  subsystemsTotal: number;
}
