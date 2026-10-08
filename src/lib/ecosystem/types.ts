// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE AI PLATFORM™ (ECOSYSTEM EDITION) — TYPE SYSTEM
// Turns VEYRO from an enterprise application into a platform developers &
// partners can build on. Real extensions/apps, real webhooks, real low-code
// studio, real api-gateway usage analytics, real developer registry.
// Tagline: One Platform. Unlimited Enterprise Intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

export const ECOSYSTEM_TAGLINE =
  'VEYRO Enterprise AI Platform™ — One Platform. Unlimited Enterprise Intelligence.';

// ─── Subsystem identifiers (the 12 specified, all extended on real data) ──────
export const ECOSYSTEM_SUBSYSTEMS = [
  'Enterprise App Marketplace™',
  'Developer Platform™',
  'Enterprise Extensions™',
  'Plugin System™',
  'API Gateway™',
  'Webhook Engine™',
  'Low-Code Studio™',
  'Enterprise App Store™',
  'Enterprise Tenant Platform™',
  'Observability™',
  'Security™',
  'Performance™',
] as const;

export const TOTAL_ECOSYSTEM_SUBSYSTEMS = ECOSYSTEM_SUBSYSTEMS.length;

// ─── Extension kinds & categories ─────────────────────────────────────────────
export type ExtensionKind =
  | 'app'
  | 'agent'
  | 'workflow'
  | 'dashboard'
  | 'connector'
  | 'template'
  | 'report'
  | 'compliance_pack'
  | 'plugin';

export type ExtensionCategory =
  | 'hr'
  | 'banking'
  | 'crm'
  | 'manufacturing'
  | 'retail'
  | 'logistics'
  | 'healthcare'
  | 'legal'
  | 'tax'
  | 'ai';

export type ExtensionVisibility = 'public' | 'private';
export type ExtensionPricing = 'free' | 'one_time' | 'subscription' | 'usage_based';
export type ExtensionStatus = 'draft' | 'in_review' | 'published' | 'suspended' | 'deprecated';
export type InstallStatus =
  | 'installing'
  | 'installed'
  | 'disabled'
  | 'update_available'
  | 'uninstalled';

export interface ExtensionManifest {
  permissions: string[];           // e.g. ['invoices:read','gst:write','ai:execute']
  entrypoints: string[];           // UI routes the extension contributes
  configSchema?: Record<string, unknown>;
  minPlatformVersion?: string;
}

export interface Extension {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string;
  publisher: string;
  developerId: string | null;
  kind: ExtensionKind;
  category: ExtensionCategory;
  version: string;
  visibility: ExtensionVisibility;
  pricingModel: ExtensionPricing;
  priceInr: number;
  status: ExtensionStatus;
  manifest: ExtensionManifest;
  iconUrl: string | null;
  screenshots: string[];
  installCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionInstall {
  id: string;
  extensionId: string;
  extensionSlug: string;
  extensionName: string;
  extensionKind: ExtensionKind;
  organizationId: string;
  version: string;
  status: InstallStatus;
  permissions: string[];
  config: Record<string, unknown> | null;
  installedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionReview {
  id: string;
  extensionId: string;
  extensionSlug: string;
  authorEmail: string;
  authorName: string;
  rating: number;                  // 1..5
  title: string;
  body: string;
  helpfulCount: number;
  createdAt: string;
}

// ─── Webhook engine ───────────────────────────────────────────────────────────
export type WebhookStatus = 'active' | 'paused' | 'failing' | 'deleted';
export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WebhookEventType {
  type: string;                    // e.g. invoice.created
  label: string;
  module: string;                  // invoices | payments | gst | crm | payroll | compliance | ai | deployment
  description: string;
}

export interface WebhookSubscription {
  id: string;
  organizationId: string;
  label: string;
  targetUrl: string;
  eventTypes: string[];            // ["*"] = all
  secret: string | null;
  status: WebhookStatus;
  deliveries: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastDeliveryAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseMs: number | null;
  attempt: number;
  status: DeliveryStatus;
  error: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

// ─── API Gateway ──────────────────────────────────────────────────────────────
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  fullKey?: string;                // only present on create
  scopes: string[];
  rateLimitPerMin: number;
  rateLimitPerDay: number;
  callsTotal: number;
  callsToday: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
}

export interface ApiGatewaySummary {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  callsToday: number;
  calls30d: number;
  callsTotal: number;
  errorRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  rateLimits: { perMin: number; perDay: number };
  authModes: string[];             // OAuth2 | JWT | API Keys | RBAC
  topEndpoints: { endpoint: string; calls: number; avgMs: number; errors: number }[];
  keys: ApiKeySummary[];
}

// ─── Low-Code Studio ──────────────────────────────────────────────────────────
export type FormFieldType = 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'tel';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  key: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface LowCodeForm {
  id: string;
  organizationId: string;
  slug: string;
  title: string;
  description: string | null;
  schema: FormField[];
  status: 'active' | 'archived';
  submissionsCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LowCodeSubmission {
  id: string;
  formId: string;
  formTitle: string;
  data: Record<string, unknown>;
  submitterEmail: string | null;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  type: 'action' | 'condition' | 'delay' | 'notify' | 'ai' | 'transform';
  name: string;
  config: Record<string, unknown>;
}

export type WorkflowTrigger = 'form.submitted' | 'invoice.created' | 'payment.received' | 'schedule' | 'manual' | 'webhook' | 'gst.filed';

export interface LowCodeWorkflow {
  id: string;
  organizationId: string;
  slug: string;
  title: string;
  description: string | null;
  trigger: WorkflowTrigger;
  triggerConfig: Record<string, unknown> | null;
  steps: WorkflowStep[];
  status: 'active' | 'paused' | 'draft';
  runsCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LowCodeStudioSummary {
  totalForms: number;
  activeForms: number;
  totalSubmissions: number;
  totalWorkflows: number;
  activeWorkflows: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  forms: LowCodeForm[];
  workflows: LowCodeWorkflow[];
  recentSubmissions: LowCodeSubmission[];
}

// ─── Developers ───────────────────────────────────────────────────────────────
export type DeveloperTier = 'individual' | 'partner' | 'certified' | 'strategic';

export interface Developer {
  id: string;
  email: string;
  name: string;
  handle: string;
  status: 'pending' | 'active' | 'suspended';
  tier: DeveloperTier;
  organizationId: string | null;
  appsPublished: number;
  totalInstalls: number;
  joinedAt: string;
  createdAt: string;
}

export interface DeveloperPlatformSummary {
  totalDevelopers: number;
  activeDevelopers: number;
  certifiedCount: number;
  strategicCount: number;
  totalAppsPublished: number;
  totalInstalls: number;
  sdks: SdkDefinition[];
  developers: Developer[];
}

export interface SdkDefinition {
  language: string;
  package: string;
  version: string;
  installCommand: string;
  authSupport: string[];
}

// ─── Observability ────────────────────────────────────────────────────────────
export interface ObservabilitySummary {
  apiCallsToday: number;
  apiCalls7d: number;
  apiCalls30d: number;
  uniqueEndpoints: number;
  errorRatePct: number;
  avgLatencyMs: number;
  callsByEndpoint: { endpoint: string; calls: number; errors: number; avgMs: number }[];
  callsByDay: { date: string; calls: number; errors: number }[];
  callsByStatusCode: { code: number; count: number }[];
  pluginUsage: { plugin: string; installs: number; calls: number }[];
  marketplaceRevenue: number;
  marketplaceRevenue30d: number;
  installedApps: number;
  sdkActivity: { sdk: string; downloads: number };
  developerActivity: { metric: string; value: number }[];
  topKeys: { name: string; calls: number; errors: number }[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface EcosystemDashboard {
  tagline: string;
  generatedAt: string;
  cacheTtlMs: number;
  hasLiveData: boolean;
  subsystemsImplemented: number;
  subsystemsTotal: number;
  subsystems: string[];
  dataSources: string[];

  // Headline KPIs
  totalExtensions: number;
  publicExtensions: number;
  privateExtensions: number;
  totalInstalls: number;
  activeWebhooks: number;
  totalApiKeys: number;
  apiCallsToday: number;
  apiCalls30d: number;
  totalDevelopers: number;
  marketplaceRevenue: number;
  lowCodeForms: number;
  lowCodeWorkflows: number;

  // Subsystem summaries
  marketplace: MarketplaceSummary;
  extensions: Extension[];
  myInstalls: ExtensionInstall[];
  webhooks: WebhookSummary;
  apiGateway: ApiGatewaySummary;
  lowCode: LowCodeStudioSummary;
  observability: ObservabilitySummary;
  developers: DeveloperPlatformSummary;
  security: EcosystemSecuritySummary;
  performance: EcosystemPerformanceSummary;
}

export interface MarketplaceSummary {
  totalListings: number;
  publicListings: number;
  privateListings: number;
  totalInstalls: number;
  totalReviews: number;
  avgRating: number;
  paidApps: number;
  freeApps: number;
  featured: Extension[];
  topCategories: { category: string; count: number; installs: number }[];
  topPublishers: { publisher: string; apps: number; installs: number }[];
  revenue: number;
  revenue30d: number;
}

export interface WebhookSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalDeliveries: number;
  successRate: number;
  recentDeliveries: WebhookDelivery[];
  subscriptions: WebhookSubscription[];
  eventCatalog: WebhookEventType[];
}

export interface EcosystemSecuritySummary {
  rbacRoles: number;
  abacPolicies: number;
  sandboxedExtensions: number;
  signedExtensions: number;
  approvalWorkflows: number;
  auditEvents30d: number;
  tenantIsolation: boolean;
  orgIsolatedInstalls: number;
}

export interface EcosystemPerformanceSummary {
  targetOrgs: number;
  targetApiCallsPerDay: number;
  currentOrgs: number;
  currentApiCallsPerDay: number;
  orgUtilizationPct: number;
  apiUtilizationPct: number;
  regions: string[];
  horizontalScaling: boolean;
  edgeNetwork: boolean;
  multiRegion: boolean;
}
