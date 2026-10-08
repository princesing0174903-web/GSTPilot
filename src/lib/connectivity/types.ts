// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL CONNECTIVITY FABRIC™ — TYPE SYSTEM
// Universal Business Network — every external service becomes part of one
// unified Business Graph. Real connected production data only. No mocks.
// ═══════════════════════════════════════════════════════════════════════════════

export const CONNECTIVITY_FOUNDER = 'VEYRO Connectivity Fabric™ was founded, developed and owned by Prince Singh.';
export const CONNECTIVITY_TAGLINE = 'The Universal Business Connectivity Platform';
export const CONNECTIVITY_SUBTAGLINE = 'Connect Everything. Synchronize Everything. Automate Everything.';

// ─── Categories ──────────────────────────────────────────────────────────────────
export type ConnectorCategory =
  | 'banking'
  | 'government'
  | 'communication'
  | 'cloud'
  | 'erp'
  | 'crm'
  | 'accounting'
  | 'ai'
  | 'payments'
  | 'storage'
  | 'ecommerce'
  | 'logistics'
  | 'iot'
  | 'pos'
  | 'analytics'
  | 'devtools'
  | 'hrms'
  | 'payroll';

export const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  banking: 'Banking Network™',
  government: 'Government Network™',
  communication: 'Communication Fabric™',
  cloud: 'Cloud Connectivity™',
  erp: 'ERP Connectors™',
  crm: 'CRM Connectors™',
  accounting: 'Accounting Connectors™',
  ai: 'AI Provider Fabric™',
  payments: 'Payment Fabric™',
  storage: 'Storage Connectors™',
  ecommerce: 'E-Commerce Connectors™',
  logistics: 'Logistics Connectors™',
  iot: 'IoT Connectors™',
  pos: 'POS Connectors™',
  analytics: 'Analytics Connectors™',
  devtools: 'Developer Tools™',
  hrms: 'HRMS Connectors™',
  payroll: 'Payroll Connectors™',
};

// ─── Auth Methods ────────────────────────────────────────────────────────────────
export type AuthMethod =
  | 'oauth2'
  | 'oidc'
  | 'api_key'
  | 'certificate'
  | 'basic'
  | 'bearer'
  | 'mtls'
  | 'webhook';

// ─── Status ──────────────────────────────────────────────────────────────────────
export type ConnectorStatus =
  | 'active'
  | 'inactive'
  | 'error'
  | 'syncing'
  | 'expired'
  | 'revoked';

export type SyncInterval = '5m' | '15m' | '1h' | '6h' | 'daily' | 'hourly' | 'realtime';

// ─── Catalog: Connector Definition ───────────────────────────────────────────────
export interface ConnectorDefinition {
  key: string;                // e.g. "bank.sbi", "gov.gstn", "crm.salesforce"
  provider: string;           // "SBI", "GSTN", "Salesforce"
  name: string;               // "State Bank of India"
  category: ConnectorCategory;
  description: string;
  capabilities: string[];
  authMethods: AuthMethod[];
  regions: string[];          // ["IN"], ["US"], ["global"]
  docsUrl?: string;
  certified: boolean;         // production-certified vs community
  popularity: number;         // 0..100 — relative install volume
  syncIntervalDefault: SyncInterval;
  realTime?: boolean;         // supports webhook push
}

// ─── Installed instance (from ConnectorInstance row) ─────────────────────────────
export interface InstalledConnector {
  id: string;
  firmId: string | null;
  userId: string | null;
  connectorKey: string;
  category: ConnectorCategory;
  provider: string;
  displayName: string;
  identifier: string | null;
  status: ConnectorStatus;
  authMethod: AuthMethod;
  scopes: string[];
  metadata: Record<string, unknown>;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  nextSyncAt: string | null;
  syncInterval: SyncInterval;
  lastError: string | null;
  apiLatencyMs: number;
  reliabilityPct: number;
  installedFrom: 'catalog' | 'marketplace';
  marketplaceId: string | null;
  // Real joined metrics
  eventCount: number;
  logCount: number;
  syncJobCount: number;
  lastSyncJob?: SyncJobRecord;
  credentials: CredentialSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CredentialSummary {
  id: string;
  type: string;               // access_token | refresh_token | api_key | secret | certificate
  label: string | null;
  scopes: string[];
  expiresAt: string | null;
  lastRotatedAt: string | null;
}

// ─── Events ──────────────────────────────────────────────────────────────────────
export interface ConnectorEventRecord {
  id: string;
  firmId: string | null;
  connectorId: string;
  connectorKey: string;
  provider: string;
  category: ConnectorCategory;
  type: string;               // invoice.paid | gst.filed | payment.received | ...
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  externalId: string | null;
  reaction: string | null;
  reactionNote: string | null;
  createdAt: string;
}

// ─── Logs ────────────────────────────────────────────────────────────────────────
export interface ConnectorLogRecord {
  id: string;
  connectorId: string;
  provider: string;
  connectorKey: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  action: string;
  message: string;
  details: Record<string, unknown> | null;
  durationMs: number;
  statusCode: number | null;
  createdAt: string;
}

// ─── Sync Jobs ───────────────────────────────────────────────────────────────────
export interface SyncJobRecord {
  id: string;
  connectorId: string;
  provider: string;
  connectorKey: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'partial' | 'cancelled';
  trigger: 'scheduled' | 'manual' | 'webhook' | 'event' | 'retry';
  recordsTotal: number;
  recordsSynced: number;
  recordsFailed: number;
  entities: string[];
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

// ─── Health ──────────────────────────────────────────────────────────────────────
export interface ConnectorHealth {
  connectorId: string;
  connectorKey: string;
  provider: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  apiLatencyMs: number;
  reliabilityPct: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  credentialExpiresAt: string | null;
  credentialExpired: boolean;
  credentialExpiringSoon: boolean;  // <7 days
  webhookHealthy: boolean;
  rateLimitRemaining: number | null;
  dataFreshnessHours: number | null;
  recentFailures: number;
  recentSuccesses: number;
  healthScore: number;        // 0..100
  recommendation: string | null;
}

export interface HealthCenter {
  totalConnectors: number;
  healthy: number;
  degraded: number;
  down: number;
  expired: number;
  expiringSoon: number;
  avgReliability: number;
  avgLatencyMs: number;
  totalEvents24h: number;
  totalFailures24h: number;
  totalSyncs24h: number;
  totalApiCalls24h: number;
  topIssues: HealthIssue[];
  connectors: ConnectorHealth[];
}

export interface HealthIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  connectorKey: string;
  provider: string;
  issue: string;
  recommendation: string;
}

// ─── Marketplace ─────────────────────────────────────────────────────────────────
export interface MarketplaceListing {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  developerName: string;
  developerHandle: string | null;
  category: ConnectorCategory;
  provider: string;
  version: string;
  pricingModel: 'free' | 'freemium' | 'paid' | 'usage_based' | 'enterprise';
  priceUsd: number;
  certification: 'certified' | 'verified' | 'community' | 'sandbox';
  capabilities: string[];
  authMethods: AuthMethod[];
  regions: string[];
  rating: number;
  reviewCount: number;
  installCount: number;
  activeInstalls: number;
  revenueSharePct: number;
  licenseType: 'standard' | 'enterprise' | 'exclusive' | 'white_label';
  publishedAt: string;
  updatedAt: string;
}

export interface ConnectorReviewRecord {
  id: string;
  connectorSlug: string;
  reviewerName: string;
  reviewerHandle: string | null;
  rating: number;             // 1..5
  title: string | null;
  body: string | null;
  verified: boolean;
  helpfulVotes: number;
  createdAt: string;
}

// ─── Document Intelligence ───────────────────────────────────────────────────────
export type DocumentKind =
  | 'invoice'
  | 'gst_return'
  | 'purchase_order'
  | 'bank_statement'
  | 'contract'
  | 'bill'
  | 'receipt'
  | 'pdf'
  | 'scan'
  | 'image'
  | 'email';

export interface DocumentIntelligenceResult {
  documentId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  kind: DocumentKind;
  confidence: number;
  extractedFields: Record<string, unknown>;
  linkedClientId: string | null;
  linkedClientName: string | null;
  linkedInvoiceId: string | null;
  linkedInvoiceNumber: string | null;
  suggestedActions: string[];
  processedAt: string;
}

// ─── Universal Sync ──────────────────────────────────────────────────────────────
export interface SyncEntityStatus {
  entity: string;             // customers | invoices | gst | payments | inventory | employees | payroll | meetings | tasks | calendar | emails | documents | business_graph | knowledge_graph | digital_twin
  totalRecords: number;
  lastSyncedAt: string | null;
  sourceConnectors: string[]; // provider names
  status: 'in_sync' | 'partial' | 'out_of_sync' | 'never_synced';
  freshnessHours: number | null;
}

export interface UniversalSyncReport {
  totalEntities: number;
  inSync: number;
  partial: number;
  outOfSync: number;
  neverSynced: number;
  totalRecords: number;
  lastFullSyncAt: string | null;
  entities: SyncEntityStatus[];
}

// ─── Security ────────────────────────────────────────────────────────────────────
export interface SecurityPosture {
  oauth2Connections: number;
  apiKeyConnections: number;
  mtlsConnections: number;
  webhookVerified: number;
  webhookUnverified: number;
  tokenRotationEnabled: number;
  tokenRotationDisabled: number;
  expiringTokens7d: number;
  expiredTokens: number;
  zeroTrustEnforced: boolean;
  orgIsolationEnforced: boolean;
  auditLogEnabled: boolean;
  encryptionEnabled: boolean;
  certificateValidation: boolean;
  totalAuditEvents: number;
  securityScore: number;      // 0..100
}

// ─── Dashboard (orchestrator output) ─────────────────────────────────────────────
export interface ConnectivityDashboard {
  // Brand
  tagline: string;
  subtagline: string;
  founder: string;
  generatedAt: string;

  // KPIs
  totalAvailableConnectors: number;
  totalInstalled: number;
  activeConnectors: number;
  failingConnectors: number;
  totalApiCalls24h: number;
  totalEvents24h: number;
  totalSyncs24h: number;
  totalRecords: number;
  avgReliability: number;
  avgLatencyMs: number;
  marketplaceListings: number;
  marketplaceInstalls: number;

  // Category breakdown
  categoryStats: Array<{
    category: ConnectorCategory;
    label: string;
    available: number;
    installed: number;
    active: number;
  }>;

  // Bundles
  installed: InstalledConnector[];
  health: HealthCenter;
  recentEvents: ConnectorEventRecord[];
  recentLogs: ConnectorLogRecord[];
  recentSyncJobs: SyncJobRecord[];
  marketplace: MarketplaceListing[];
  topMarketplace: MarketplaceListing[];
  syncReport: UniversalSyncReport;
  security: SecurityPosture;
  documentIntelligence: DocumentIntelligenceResult[];

  // Real connected data sources
  realDataSources: RealDataSources;
}

export interface RealDataSources {
  clients: number;
  invoices: number;
  gstrFilings: number;
  documents: number;
  dataConnections: number;
  syncedRecords: number;
  businessEvents: number;
  communicationLogs: number;
  payments: number;
  employees: number;
}

// ─── Action results ──────────────────────────────────────────────────────────────
export interface InstallResult {
  success: boolean;
  connectorId: string | null;
  message: string;
  status: ConnectorStatus;
}

export interface AuthResult {
  success: boolean;
  authenticated: boolean;
  message: string;
  expiresAt: string | null;
  scopes: string[];
}

export interface TestResult {
  success: boolean;
  reachable: boolean;
  latencyMs: number;
  statusCode: number | null;
  message: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}

export interface SyncTriggerResult {
  success: boolean;
  jobId: string | null;
  message: string;
  status: string;
  recordsSynced: number;
}
