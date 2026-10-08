// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — Type System
// Ecosystem platform: apps, AI employees, SDK, webhooks, plugins, monetization.
// Catalog models are GLOBAL; installs/webhooks/plugins/sandbox/analytics are tenant-scoped.
// ═══════════════════════════════════════════════════════════════════════════════

/** Application types supported by the platform. */
export type AppType =
  | 'native'
  | 'ai'
  | 'industry'
  | 'dashboard'
  | 'widget'
  | 'ai_employee'
  | 'report'
  | 'connector'
  | 'automation'
  | 'api'
  | 'custom_page';

/** App Store categories — 20 domains covering every business function. */
export type AppCategory =
  | 'finance'
  | 'accounting'
  | 'crm'
  | 'sales'
  | 'marketing'
  | 'hr'
  | 'operations'
  | 'manufacturing'
  | 'retail'
  | 'healthcare'
  | 'construction'
  | 'education'
  | 'hospitality'
  | 'legal'
  | 'logistics'
  | 'ai_tools'
  | 'developer_tools'
  | 'analytics'
  | 'security'
  | 'productivity';

/** Pricing model for an app. */
export type PricingModel = 'free' | 'paid' | 'subscription' | 'usage_based' | 'enterprise';

/** App lifecycle status. */
export type AppStatus = 'draft' | 'in_review' | 'published' | 'suspended' | 'deprecated';

/** Install lifecycle status. */
export type InstallStatus = 'active' | 'paused' | 'updating' | 'error' | 'uninstalled';

/** Install scope — where the app is installed. */
export type InstallScope = 'tenant' | 'organization' | 'department' | 'workspace';

/** Sandbox execution status. */
export type SandboxStatus = 'running' | 'completed' | 'failed' | 'shutdown' | 'killed';

/** Sandbox shutdown reason. */
export type ShutdownReason = 'quota_exceeded' | 'timeout' | 'error' | 'manual' | null;

/** Webhook subscription status. */
export type WebhookStatus = 'active' | 'paused' | 'disabled';

/** Plugin status. */
export type PluginStatus = 'active' | 'disabled';

/** Developer partner level. */
export type PartnerLevel = 'standard' | 'silver' | 'gold' | 'platinum' | 'strategic';

/** Payout status. */
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

/** Analytics event types tracked per app. */
export type AnalyticsEventType =
  | 'install'
  | 'uninstall'
  | 'update'
  | 'rollback'
  | 'api_call'
  | 'error'
  | 'revenue'
  | 'retention'
  | 'ai_usage'
  | 'automation_usage'
  | 'crash'
  | 'engagement';

/** Extension points a plugin can hook into (without modifying core platform). */
export type ExtensionPoint =
  | 'navigation'
  | 'dashboard'
  | 'widget'
  | 'report'
  | 'ai_agent'
  | 'command'
  | 'automation'
  | 'notification'
  | 'menu'
  | 'page'
  | 'settings'
  | 'search';

/** App permission scopes — declared by every app, approved by the tenant. */
export type AppPermission =
  | 'read:crm'
  | 'write:crm'
  | 'read:banking'
  | 'write:banking'
  | 'read:invoices'
  | 'write:invoices'
  | 'read:gst'
  | 'write:gst'
  | 'read:reports'
  | 'write:reports'
  | 'read:files'
  | 'write:files'
  | 'read:automation'
  | 'write:automation'
  | 'read:notifications'
  | 'write:notifications'
  | 'access:ai'
  | 'access:ai_ceo'
  | 'access:ai_workforce'
  | 'access:ai_cfo'
  | 'access:digital_twin'
  | 'access:business_graph'
  | 'access:knowledge_graph'
  | 'access:oracle'
  | 'access:enterprise_cloud'
  | 'access:marketplace'
  | 'manage:users'
  | 'manage:billing'
  | 'manage:audit'
  | 'publish:apps';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

/** Published app in the catalog. */
export interface AppDTO {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  developerId: string;
  developerName: string;
  developerVerified: boolean;
  type: AppType;
  category: AppCategory;
  version: string;
  logo: string | null;
  color: string;
  screenshots: { url: string; caption?: string }[];
  pricingModel: PricingModel;
  priceAmount: number;
  priceCurrency: string;
  billingInterval: string | null;
  rating: number;
  reviewCount: number;
  installCount: number;
  downloadCount: number;
  compatibility: string[];
  permissions: AppPermission[];
  releaseNotes: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
  license: string;
  homepageUrl: string | null;
  repositoryUrl: string | null;
  status: AppStatus;
  featured: boolean;
  verified: boolean;
  signed: boolean;
  publishedAt: string | null;
  createdAt: string;
}

/** App version history entry. */
export interface AppVersionDTO {
  id: string;
  appId: string;
  version: string;
  releaseNotes: string;
  changelog: string | null;
  downloadUrl: string | null;
  checksum: string | null;
  signature: string | null;
  status: string;
  breakingChanges: boolean;
  migrationGuide: string | null;
  fileSizeBytes: number;
  publishedAt: string;
}

/** Installed app (tenant-scoped). */
export interface AppInstallDTO {
  id: string;
  tenantId: string;
  organizationId: string | null;
  appId: string;
  appSlug: string;
  appName: string;
  appType: AppType;
  appCategory: AppCategory;
  appLogo: string | null;
  appColor: string;
  version: string;
  status: InstallStatus;
  scope: InstallScope;
  config: Record<string, unknown>;
  grantedPermissions: AppPermission[];
  sandboxEnabled: boolean;
  memoryLimitMb: number;
  cpuLimitPct: number;
  storageQuotaMb: number;
  apiQuotaPerMin: number;
  networkRestricted: boolean;
  autoUpdate: boolean;
  installedById: string | null;
  lastUpdatedAt: string | null;
  installedAt: string;
  developerName: string;
}

/** App review. */
export interface AppReviewDTO {
  id: string;
  appId: string;
  appName: string;
  reviewerUserId: string | null;
  reviewerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  helpfulCount: number;
  verifiedPurchase: boolean;
  developerReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

/** Developer profile. */
export interface AppDeveloperDTO {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  email: string;
  website: string | null;
  logo: string | null;
  bio: string | null;
  verified: boolean;
  partnerLevel: PartnerLevel;
  revenueSharePct: number;
  totalRevenue: number;
  totalInstalls: number;
  totalApps: number;
  avgRating: number;
  country: string | null;
  joinedAt: string;
}

/** Developer payout. */
export interface AppPayoutDTO {
  id: string;
  developerId: string;
  developerName: string;
  period: string;
  grossRevenue: number;
  platformFee: number;
  netPayout: number;
  currency: string;
  transactionCount: number;
  status: PayoutStatus;
  paidAt: string | null;
  invoiceUrl: string | null;
  createdAt: string;
}

/** Webhook subscription. */
export interface AppWebhookDTO {
  id: string;
  tenantId: string;
  appId: string | null;
  installId: string | null;
  name: string;
  targetUrl: string;
  eventTypes: string[];
  secret: string | null;
  status: WebhookStatus;
  deliveryCount: number;
  successCount: number;
  failureCount: number;
  lastDeliveryAt: string | null;
  lastResponseCode: number | null;
  lastError: string | null;
  createdAt: string;
}

/** Installed plugin. */
export interface AppPluginDTO {
  id: string;
  tenantId: string;
  installId: string | null;
  pluginKey: string;
  name: string;
  extensionPoints: ExtensionPoint[];
  config: Record<string, unknown>;
  status: PluginStatus;
  enabled: boolean;
  createdAt: string;
}

/** Sandbox execution record. */
export interface AppSandboxExecutionDTO {
  id: string;
  tenantId: string;
  installId: string | null;
  appId: string | null;
  executionType: string;
  status: SandboxStatus;
  memoryUsedMb: number;
  cpuUsedPct: number;
  storageUsedMb: number;
  apiCallsMade: number;
  durationMs: number;
  triggeredBy: string;
  shutdownReason: ShutdownReason;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

/** Analytics summary for the platform / a single app / a developer. */
export interface AppAnalyticsSummary {
  totalInstalls: number;
  totalUninstalls: number;
  activeInstalls: number;
  totalRevenue: number;
  totalApiCalls: number;
  totalErrors: number;
  totalCrashes: number;
  avgRating: number;
  totalReviews: number;
  retentionRate: number;
  aiUsageCalls: number;
  automationRuns: number;
  byCategory: { category: AppCategory; label: string; installs: number; revenue: number; apps: number }[];
  byType: { type: AppType; label: string; count: number }[];
  timeseries: { date: string; installs: number; revenue: number; apiCalls: number; errors: number }[];
  topApps: { appId: string; name: string; installs: number; revenue: number; rating: number }[];
}

/** Monetization summary. */
export interface MonetizationSummary {
  grossRevenue: number;
  platformFee: number;
  developerPayouts: number;
  pendingPayouts: number;
  totalTransactions: number;
  activeSubscriptions: number;
  freeApps: number;
  paidApps: number;
  subscriptionApps: number;
  enterpriseApps: number;
  avgRevenuePerApp: number;
  topEarners: { developerId: string; name: string; revenue: number; apps: number }[];
  recentPayouts: AppPayoutDTO[];
}

/** Developer dashboard data. */
export interface DeveloperDashboardDTO {
  developer: AppDeveloperDTO;
  publishedApps: AppDTO[];
  totalRevenue: number;
  totalDownloads: number;
  avgRating: number;
  crashReports: { appId: string; appName: string; count: number; lastAt: string }[];
  usageAnalytics: { apiCalls: number; aiUsage: number; automationRuns: number };
  webhookLogs: { id: string; event: string; status: string; deliveredAt: string }[];
  apiKeys: { id: string; name: string; scopes: string[]; lastUsedAt: string | null; status: string }[];
  sandboxTests: { id: string; appName: string; status: string; durationMs: number; at: string }[];
  releases: { id: string; app: string; version: string; status: string; publishedAt: string }[];
  ciCdPipelines: { id: string; app: string; branch: string; status: string; lastRunAt: string }[];
}

/** Extension SDK info. */
export interface ExtensionSDKInfo {
  version: string;
  languages: { key: string; name: string; logo: string; minVersion: string }[];
  templates: { key: string; name: string; description: string; type: AppType }[];
  cliVersion: string;
  cliCommands: { command: string; description: string }[];
  emulatorEnabled: boolean;
  packagingEnabled: boolean;
  publishingEnabled: boolean;
  liveReloadEnabled: boolean;
  documentationUrl: string;
  testingFrameworks: string[];
}

/** AI App Builder — Oracle generates app specs from natural language. */
export interface AIAppBuilderIntent {
  matched: boolean;
  appType: AppType | null;
  category: AppCategory | null;
  action: string;
  description: string;
  suggestedName: string;
  suggestedPermissions: AppPermission[];
  confidence: number;
}

/** AI App Builder — generated app specification. */
export interface GeneratedAppSpec {
  name: string;
  slug: string;
  type: AppType;
  category: AppCategory;
  tagline: string;
  description: string;
  permissions: AppPermission[];
  extensionPoints: ExtensionPoint[];
  pricingModel: PricingModel;
  priceAmount: number;
  features: string[];
  estimatedBuildTimeMin: number;
  sdkTemplate: string;
  ready: boolean;
}

/** Marketplace search result. */
export interface MarketplaceSearchResult {
  query: string;
  apps: AppDTO[];
  aiEmployees: AppDTO[];
  developers: AppDeveloperDTO[];
  templates: { key: string; name: string; type: AppType; category: AppCategory }[];
  plugins: AppPluginDTO[];
  totalResults: number;
  searchTimeMs: number;
}

/** App Store browse result. */
export interface AppStoreBrowseResult {
  apps: AppDTO[];
  total: number;
  categories: { category: AppCategory; label: string; count: number; icon: string; color: string }[];
  featured: AppDTO[];
  page: number;
  pageSize: number;
}

// ─── Catalog metadata ──────────────────────────────────────────────────────────

/** Category metadata for the App Store UI. */
export const APP_CATEGORY_META: Record<AppCategory, { label: string; icon: string; color: string }> = {
  finance: { label: 'Finance', icon: 'Wallet', color: '#10b981' },
  accounting: { label: 'Accounting', icon: 'Calculator', color: '#06b6d4' },
  crm: { label: 'CRM', icon: 'Users', color: '#8b5cf6' },
  sales: { label: 'Sales', icon: 'TrendingUp', color: '#3b82f6' },
  marketing: { label: 'Marketing', icon: 'Megaphone', color: '#ec4899' },
  hr: { label: 'HR', icon: 'UserCog', color: '#14b8a6' },
  operations: { label: 'Operations', icon: 'Settings2', color: '#f59e0b' },
  manufacturing: { label: 'Manufacturing', icon: 'Factory', color: '#71717a' },
  retail: { label: 'Retail', icon: 'Store', color: '#db2777' },
  healthcare: { label: 'Healthcare', icon: 'HeartPulse', color: '#ef4444' },
  construction: { label: 'Construction', icon: 'HardHat', color: '#a16207' },
  education: { label: 'Education', icon: 'GraduationCap', color: '#6366f1' },
  hospitality: { label: 'Hospitality', icon: 'UtensilsCrossed', color: '#d946ef' },
  legal: { label: 'Legal', icon: 'Scale', color: '#a78bfa' },
  logistics: { label: 'Logistics', icon: 'Truck', color: '#0891b2' },
  ai_tools: { label: 'AI Tools', icon: 'BrainCircuit', color: '#9333ea' },
  developer_tools: { label: 'Developer Tools', icon: 'Code2', color: '#22c55e' },
  analytics: { label: 'Analytics', icon: 'BarChart3', color: '#0284c7' },
  security: { label: 'Security', icon: 'ShieldCheck', color: '#059669' },
  productivity: { label: 'Productivity', icon: 'Zap', color: '#f43f5e' },
};

/** App type metadata. */
export const APP_TYPE_META: Record<AppType, { label: string; icon: string; description: string }> = {
  native: { label: 'Native App', icon: 'AppWindow', description: 'Full-featured application integrated into VEYRO' },
  ai: { label: 'AI App', icon: 'BrainCircuit', description: 'AI-powered application with model access' },
  industry: { label: 'Industry App', icon: 'Building2', description: 'Industry-specific solution module' },
  dashboard: { label: 'Dashboard', icon: 'LayoutDashboard', description: 'Custom dashboard with widgets' },
  widget: { label: 'Widget', icon: 'LayoutGrid', description: 'Reusable UI widget' },
  ai_employee: { label: 'AI Employee', icon: 'Bot', description: 'Specialized AI worker for a domain' },
  report: { label: 'Report', icon: 'FileBarChart', description: 'Custom report template' },
  connector: { label: 'Connector', icon: 'Cable', description: 'Third-party data connector' },
  automation: { label: 'Automation', icon: 'Workflow', description: 'Automated workflow' },
  api: { label: 'API', icon: 'Webhook', description: 'Public API extension' },
  custom_page: { label: 'Custom Page', icon: 'FileCode', description: 'Custom page in the workspace' },
};

/** Permission catalog — every permission an app can declare. */
export const APP_PERMISSION_CATALOG: { key: AppPermission; label: string; category: string; risk: 'low' | 'medium' | 'high' | 'critical'; description: string }[] = [
  { key: 'read:crm', label: 'Read CRM', category: 'crm', risk: 'low', description: 'View leads, deals, contacts, and customer data' },
  { key: 'write:crm', label: 'Write CRM', category: 'crm', risk: 'high', description: 'Create and modify CRM records' },
  { key: 'read:banking', label: 'Read Banking', category: 'banking', risk: 'medium', description: 'View bank accounts and transactions' },
  { key: 'write:banking', label: 'Write Banking', category: 'banking', risk: 'critical', description: 'Initiate payments and modify bank data' },
  { key: 'read:invoices', label: 'Read Invoices', category: 'invoices', risk: 'low', description: 'View invoices and billing records' },
  { key: 'write:invoices', label: 'Write Invoices', category: 'invoices', risk: 'high', description: 'Create and modify invoices' },
  { key: 'read:gst', label: 'Read GST', category: 'gst', risk: 'low', description: 'View GST filings and returns' },
  { key: 'write:gst', label: 'Write GST', category: 'gst', risk: 'critical', description: 'File GST returns and modify GST data' },
  { key: 'read:reports', label: 'Read Reports', category: 'reports', risk: 'low', description: 'View generated reports' },
  { key: 'write:reports', label: 'Write Reports', category: 'reports', risk: 'medium', description: 'Create and modify report templates' },
  { key: 'read:files', label: 'Access Files (Read)', category: 'files', risk: 'medium', description: 'Read uploaded documents' },
  { key: 'write:files', label: 'Access Files (Write)', category: 'files', risk: 'high', description: 'Upload and modify documents' },
  { key: 'read:automation', label: 'Read Automation', category: 'automation', risk: 'low', description: 'View automation workflows' },
  { key: 'write:automation', label: 'Write Automation', category: 'automation', risk: 'high', description: 'Create and modify automation workflows' },
  { key: 'read:notifications', label: 'Read Notifications', category: 'notifications', risk: 'low', description: 'View user notifications' },
  { key: 'write:notifications', label: 'Send Notifications', category: 'notifications', risk: 'medium', description: 'Send notifications to users' },
  { key: 'access:ai', label: 'Access AI', category: 'ai', risk: 'medium', description: 'Use AI features (general)' },
  { key: 'access:ai_ceo', label: 'Access AI CEO™', category: 'ai', risk: 'high', description: 'Interact with AI CEO decision engine' },
  { key: 'access:ai_workforce', label: 'Access AI Workforce™', category: 'ai', risk: 'high', description: 'Interact with AI employee ecosystem' },
  { key: 'access:ai_cfo', label: 'Access AI CFO™', category: 'ai', risk: 'high', description: 'Interact with financial intelligence engine' },
  { key: 'access:digital_twin', label: 'Access Digital Twin™', category: 'ai', risk: 'high', description: 'Interact with business simulator' },
  { key: 'access:business_graph', label: 'Access Business Graph™', category: 'ai', risk: 'medium', description: 'Query the business knowledge graph' },
  { key: 'access:knowledge_graph', label: 'Access Knowledge Graph™', category: 'ai', risk: 'medium', description: 'Query the knowledge graph' },
  { key: 'access:oracle', label: 'Access Oracle™', category: 'ai', risk: 'critical', description: 'Interact with Oracle conversational AI' },
  { key: 'access:enterprise_cloud', label: 'Access Enterprise Cloud™', category: 'platform', risk: 'high', description: 'Access multi-tenant cloud features' },
  { key: 'access:marketplace', label: 'Access Integration Marketplace™', category: 'platform', risk: 'medium', description: 'Access integration marketplace' },
  { key: 'manage:users', label: 'Manage Users', category: 'admin', risk: 'critical', description: 'Create and modify user accounts' },
  { key: 'manage:billing', label: 'Manage Billing', category: 'admin', risk: 'critical', description: 'Modify billing and subscriptions' },
  { key: 'manage:audit', label: 'Manage Audit', category: 'admin', risk: 'critical', description: 'Access and modify audit logs' },
  { key: 'publish:apps', label: 'Publish Apps', category: 'admin', risk: 'high', description: 'Publish apps to the marketplace' },
];

/** Standard webhook events developers can subscribe to. */
export const STANDARD_WEBHOOK_EVENTS: { event: string; label: string; description: string; module: string }[] = [
  { event: 'lead.created', label: 'Lead Created', description: 'A new CRM lead was created', module: 'CRM' },
  { event: 'invoice.paid', label: 'Invoice Paid', description: 'An invoice was fully paid', module: 'Invoices' },
  { event: 'invoice.created', label: 'Invoice Created', description: 'A new invoice was generated', module: 'Invoices' },
  { event: 'gst.filed', label: 'GST Filed', description: 'A GST return was filed', module: 'GST' },
  { event: 'task.assigned', label: 'Task Assigned', description: 'A task was assigned to a user or AI employee', module: 'Tasks' },
  { event: 'workflow.completed', label: 'Workflow Completed', description: 'An automation workflow finished', module: 'Automation' },
  { event: 'ai.decision', label: 'AI Decision', description: 'An AI engine made a decision', module: 'AI CEO' },
  { event: 'approval.granted', label: 'Approval Granted', description: 'An approval request was approved', module: 'Approvals' },
  { event: 'organization.created', label: 'Organization Created', description: 'A new organization was created', module: 'Enterprise Cloud' },
  { event: 'employee.added', label: 'Employee Added', description: 'A new employee joined an organization', module: 'Directory' },
  { event: 'customer.created', label: 'Customer Created', description: 'A new customer was created', module: 'CRM' },
  { event: 'automation.executed', label: 'Automation Executed', description: 'An automation rule fired', module: 'Automation' },
  { event: 'payment.received', label: 'Payment Received', description: 'A payment was received', module: 'Banking' },
  { event: 'document.uploaded', label: 'Document Uploaded', description: 'A document was uploaded', module: 'Files' },
  { event: 'app.installed', label: 'App Installed', description: 'An app was installed', module: 'App Platform' },
  { event: 'app.uninstalled', label: 'App Uninstalled', description: 'An app was uninstalled', module: 'App Platform' },
];

/** Extension points a plugin can hook into. */
export const EXTENSION_POINTS_META: { key: ExtensionPoint; label: string; description: string }[] = [
  { key: 'navigation', label: 'Navigation', description: 'Add items to the sidebar / nav' },
  { key: 'dashboard', label: 'Dashboard', description: 'Add dashboard panels' },
  { key: 'widget', label: 'Widget', description: 'Provide reusable widgets' },
  { key: 'report', label: 'Report', description: 'Add report templates' },
  { key: 'ai_agent', label: 'AI Agent', description: 'Register custom AI agents' },
  { key: 'command', label: 'Command', description: 'Add command palette commands' },
  { key: 'automation', label: 'Automation', description: 'Provide automation triggers/actions' },
  { key: 'notification', label: 'Notification', description: 'Send custom notifications' },
  { key: 'menu', label: 'Menu', description: 'Add context menu items' },
  { key: 'page', label: 'Page', description: 'Add custom pages' },
  { key: 'settings', label: 'Settings', description: 'Add settings panels' },
  { key: 'search', label: 'Search', description: 'Register search providers' },
];

/** AI Employee Marketplace — industry-specialized AI workers. */
export interface AIEmployeeAppDef {
  slug: string;
  name: string;
  role: string;
  industry: AppCategory;
  description: string;
  capabilities: string[];
  autoConnectEngines: string[];
  permissions: AppPermission[];
  color: string;
  icon: string;
}

/** 12 specialized AI employees installable from the marketplace. */
export const AI_EMPLOYEE_APPS: AIEmployeeAppDef[] = [
  {
    slug: 'manufacturing-ai',
    name: 'Manufacturing AI™',
    role: 'Plant Operations Manager',
    industry: 'manufacturing',
    description: 'Optimizes production schedules, tracks OEE, predicts maintenance, and manages supply chain.',
    capabilities: ['Production planning', 'OEE monitoring', 'Predictive maintenance', 'Quality control', 'Supply chain optimization'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'digital_twin', 'business_graph', 'automation', 'knowledge_graph'],
    permissions: ['read:reports', 'access:ai', 'access:ai_ceo', 'access:digital_twin', 'read:automation'],
    color: '#71717a',
    icon: 'Factory',
  },
  {
    slug: 'retail-ai',
    name: 'Retail AI™',
    role: 'Store Operations Manager',
    industry: 'retail',
    description: 'Manages inventory, optimizes pricing, forecasts demand, and personalizes customer experience.',
    capabilities: ['Inventory optimization', 'Dynamic pricing', 'Demand forecasting', 'Customer personalization', 'Store layout'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'digital_twin', 'business_graph', 'automation'],
    permissions: ['read:crm', 'read:reports', 'access:ai', 'access:ai_ceo'],
    color: '#db2777',
    icon: 'Store',
  },
  {
    slug: 'construction-ai',
    name: 'Construction AI™',
    role: 'Project Manager',
    industry: 'construction',
    description: 'Tracks project milestones, manages subcontractors, monitors safety compliance, and controls costs.',
    capabilities: ['Project tracking', 'Subcontractor management', 'Safety compliance', 'Cost control', 'Schedule optimization'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'automation', 'knowledge_graph'],
    permissions: ['read:reports', 'read:files', 'access:ai', 'access:ai_ceo'],
    color: '#a16207',
    icon: 'HardHat',
  },
  {
    slug: 'healthcare-ai',
    name: 'Healthcare AI™',
    role: 'Practice Manager',
    industry: 'healthcare',
    description: 'Manages patient appointments, billing, insurance claims, and compliance with healthcare regulations.',
    capabilities: ['Appointment scheduling', 'Insurance claims', 'Patient billing', 'HIPAA compliance', 'Revenue cycle'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'automation', 'knowledge_graph'],
    permissions: ['read:crm', 'read:invoices', 'read:reports', 'access:ai'],
    color: '#ef4444',
    icon: 'HeartPulse',
  },
  {
    slug: 'education-ai',
    name: 'Education AI™',
    role: 'Academic Administrator',
    industry: 'education',
    description: 'Manages admissions, fee collection, academic scheduling, and student performance analytics.',
    capabilities: ['Admissions management', 'Fee collection', 'Academic scheduling', 'Performance analytics', 'Parent communication'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'automation'],
    permissions: ['read:crm', 'read:invoices', 'read:reports', 'access:ai'],
    color: '#6366f1',
    icon: 'GraduationCap',
  },
  {
    slug: 'hotel-ai',
    name: 'Hotel AI™',
    role: 'Hospitality Manager',
    industry: 'hospitality',
    description: 'Manages reservations, room pricing, guest experience, and F&B operations.',
    capabilities: ['Reservation management', 'Dynamic room pricing', 'Guest experience', 'F&B operations', 'Review management'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'digital_twin', 'automation'],
    permissions: ['read:crm', 'read:invoices', 'access:ai', 'access:ai_ceo'],
    color: '#d946ef',
    icon: 'UtensilsCrossed',
  },
  {
    slug: 'restaurant-ai',
    name: 'Restaurant AI™',
    role: 'F&B Operations Manager',
    industry: 'hospitality',
    description: 'Manages orders, menu optimization, inventory, and table turnover.',
    capabilities: ['Order management', 'Menu optimization', 'Inventory tracking', 'Table turnover', 'Delivery integration'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'automation', 'business_graph'],
    permissions: ['read:crm', 'read:invoices', 'read:reports', 'access:ai'],
    color: '#f97316',
    icon: 'UtensilsCrossed',
  },
  {
    slug: 'law-firm-ai',
    name: 'Law Firm AI™',
    role: 'Legal Practice Manager',
    industry: 'legal',
    description: 'Manages case files, billable hours, client matters, and compliance deadlines.',
    capabilities: ['Case management', 'Billable hours tracking', 'Matter management', 'Deadline tracking', 'Document automation'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'automation', 'knowledge_graph'],
    permissions: ['read:crm', 'read:files', 'read:reports', 'access:ai'],
    color: '#a78bfa',
    icon: 'Scale',
  },
  {
    slug: 'ca-ai',
    name: 'CA AI™',
    role: 'Chartered Accountant',
    industry: 'accounting',
    description: 'Manages audit, tax filing, compliance, and client practice operations.',
    capabilities: ['Audit management', 'Tax filing', 'Compliance tracking', 'Client practice', 'Financial statements'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'ai_cfo', 'automation', 'knowledge_graph'],
    permissions: ['read:gst', 'read:invoices', 'read:reports', 'access:ai', 'access:ai_cfo'],
    color: '#06b6d4',
    icon: 'Calculator',
  },
  {
    slug: 'auditor-ai',
    name: 'Auditor AI™',
    role: 'Internal Auditor',
    industry: 'accounting',
    description: 'Conducts internal audits, risk assessments, and compliance reviews.',
    capabilities: ['Internal audit', 'Risk assessment', 'Compliance review', 'Control testing', 'Audit reporting'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'ai_cfo', 'knowledge_graph'],
    permissions: ['read:reports', 'manage:audit', 'read:gst', 'access:ai'],
    color: '#0891b2',
    icon: 'ShieldCheck',
  },
  {
    slug: 'export-ai',
    name: 'Export AI™',
    role: 'Export Manager',
    industry: 'logistics',
    description: 'Manages export documentation, shipping, customs, and forex compliance.',
    capabilities: ['Export documentation', 'Shipping management', 'Customs compliance', 'Forex management', 'Letter of credit'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'automation', 'business_graph'],
    permissions: ['read:invoices', 'read:gst', 'read:files', 'access:ai'],
    color: '#0891b2',
    icon: 'Truck',
  },
  {
    slug: 'supply-chain-ai',
    name: 'Supply Chain AI™',
    role: 'Supply Chain Manager',
    industry: 'logistics',
    description: 'Optimizes procurement, logistics, warehouse operations, and vendor management.',
    capabilities: ['Procurement optimization', 'Logistics planning', 'Warehouse management', 'Vendor management', 'Demand planning'],
    autoConnectEngines: ['ai_ceo', 'ai_workforce', 'digital_twin', 'business_graph', 'automation'],
    permissions: ['read:reports', 'read:crm', 'access:ai', 'access:digital_twin'],
    color: '#1d4ed8',
    icon: 'Truck',
  },
];

/** Helper to safely parse a JSON string field into a typed array. */
export function parseJsonArray<T>(s: string | null | undefined, fallback: T[] = []): T[] {
  if (!s) return fallback;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Helper to safely parse a JSON string field into a typed object. */
export function parseJsonObject<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(s) as T) };
  } catch {
    return fallback;
  }
}

/** Default sandbox quotas for a new install. */
export const DEFAULT_SANDBOX_QUOTAS = {
  memoryLimitMb: 256,
  cpuLimitPct: 25,
  storageQuotaMb: 512,
  apiQuotaPerMin: 100,
  networkRestricted: true,
} as const;

/** Platform revenue share — developer gets 70%, platform keeps 30%. */
export const PLATFORM_REVENUE_SHARE_PCT = 30;
