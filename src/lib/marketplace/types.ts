// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global Integration Marketplace™ — Type System
// Universal connectivity platform: 2,000+ connectors, event bus, sync engine.
// ═══════════════════════════════════════════════════════════════════════════════

/** Marketplace categories — 25 domains covering the entire business tech stack. */
export type MarketplaceCategory =
  | 'finance'
  | 'accounting'
  | 'crm'
  | 'erp'
  | 'marketing'
  | 'sales'
  | 'hr'
  | 'payroll'
  | 'legal'
  | 'ecommerce'
  | 'logistics'
  | 'healthcare'
  | 'education'
  | 'manufacturing'
  | 'hospitality'
  | 'construction'
  | 'retail'
  | 'government'
  | 'cloud'
  | 'developer-tools'
  | 'communication'
  | 'productivity'
  | 'analytics'
  | 'ai-platforms'
  | 'identity'

/** Authentication / connection protocol supported by a connector. */
export type AuthType =
  | 'oauth2'
  | 'api_key'
  | 'webhook'
  | 'sdk'
  | 'graphql'
  | 'rest'
  | 'soap'
  | 'sftp'
  | 'imap'
  | 'ftp'
  | 'database'

/** Installed integration lifecycle status. */
export type IntegrationStatus =
  | 'installed'
  | 'connected'
  | 'syncing'
  | 'error'
  | 'disconnected'

/** Health of an installed integration. */
export type IntegrationHealth = 'healthy' | 'degraded' | 'down' | 'unknown'

/** Sync frequency options. */
export type SyncFrequency = 'realtime' | '15m' | '1h' | '6h' | 'daily' | 'manual'

/** Sync job type. */
export type SyncJobType = 'realtime' | 'scheduled' | 'incremental' | 'manual'

/** Sync job status. */
export type SyncJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'retry'

/** Sync direction. */
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional'

/** Connector catalog health status. */
export type CatalogHealth = 'operational' | 'degraded' | 'down' | 'unknown'

/** A connector definition in the marketplace catalog. */
export interface ConnectorCatalogEntry {
  slug: string
  name: string
  displayName: string
  category: MarketplaceCategory
  provider: string
  description: string
  logo: string
  color: string
  authType: AuthType
  documentationUrl?: string
  pricing: 'Free' | 'Freemium' | 'Paid' | 'Custom'
  rating: number
  reviews: number
  installs: number
  popularity: number
  verified: boolean
  featured?: boolean
  supportedFeatures: string[]
  permissions: string[]
  capabilities: string[]
  healthStatus: CatalogHealth
  version: string
  developer?: string
  tags: string[]
}

/** Installed integration (tenant-scoped). */
export interface InstalledIntegrationDTO {
  id: string
  tenantId: string
  connectorId: string
  connectorSlug: string
  displayName: string
  status: IntegrationStatus
  health: IntegrationHealth
  authType: AuthType
  config: Record<string, unknown>
  scopes: string[]
  connectedAccountId: string | null
  lastSyncAt: string | null
  syncFrequency: SyncFrequency
  lastError: string | null
  installedAt: string
  connector?: ConnectorCatalogEntry
}

/** Sync job record. */
export interface SyncJobDTO {
  id: string
  installedIntegrationId: string
  type: SyncJobType
  status: SyncJobStatus
  direction: SyncDirection
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  conflictCount: number
  retryCount: number
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  error: string | null
}

/** Integration event published on the Event Bus. */
export interface IntegrationEventDTO {
  id: string
  tenantId: string
  connectorSlug: string
  eventType: string
  source: string
  severity: 'info' | 'warning' | 'critical'
  payload: Record<string, unknown>
  consumed: boolean
  consumedBy: string | null
  publishedAt: string
}

/** Connector log entry. */
export interface ConnectorLogDTO {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  code: string | null
  timestamp: string
}

/** Connector analytics summary. */
export interface ConnectorAnalyticsSummary {
  totalApiCalls: number
  totalSyncSuccess: number
  totalSyncFailed: number
  totalEventsPublished: number
  totalRecordsSynced: number
  avgLatencyMs: number
  totalErrors: number
  totalAutomationTriggered: number
  totalAiUsage: number
  totalRevenueImpact: number
  avgHealthScore: number
  syncSuccessRate: number
  byConnector: ConnectorAnalyticsRow[]
  timeseries: { date: string; apiCalls: number; events: number; errors: number }[]
}

export interface ConnectorAnalyticsRow {
  connectorSlug: string
  displayName: string
  apiCalls: number
  syncSuccess: number
  syncFailed: number
  eventsPublished: number
  avgLatencyMs: number
  healthScore: number
  revenueImpact: number
  status: string
}

/** Marketplace browse result. */
export interface MarketplaceBrowseResult {
  connectors: ConnectorCatalogEntry[]
  total: number
  categories: { category: MarketplaceCategory; label: string; count: number; icon: string }[]
  page: number
  pageSize: number
}

/** Health dashboard. */
export interface HealthDashboard {
  overall: CatalogHealth
  totalConnectors: number
  operational: number
  degraded: number
  down: number
  installedCount: number
  healthyInstalled: number
  degradedInstalled: number
  downInstalled: number
  eventsLastHour: number
  syncsLastHour: number
  failuresLastHour: number
  connectors: { slug: string; name: string; status: CatalogHealth; icon: string }[]
}

/** AI Connector Engine — natural language → connector action. */
export interface AIConnectorIntent {
  matched: boolean
  connectorSlug: string | null
  connectorName: string | null
  action: string
  description: string
  requiresInstall: boolean
  confidence: number
}

/** Developer platform — published connector submission. */
export interface DeveloperSubmission {
  id: string
  name: string
  slug: string
  category: MarketplaceCategory
  authType: AuthType
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'published'
  developer: string
  version: string
  submittedAt: string
  sdkVersion: string
  certification: 'none' | 'sandbox' | 'certified'
  revenueSharePct: number
}

/** Category metadata for the marketplace UI. */
export const CATEGORY_META: Record<MarketplaceCategory, { label: string; icon: string; color: string }> = {
  finance: { label: 'Finance', icon: 'Wallet', color: '#10b981' },
  accounting: { label: 'Accounting', icon: 'Calculator', color: '#06b6d4' },
  crm: { label: 'CRM', icon: 'Users', color: '#8b5cf6' },
  erp: { label: 'ERP', icon: 'Boxes', color: '#f59e0b' },
  marketing: { label: 'Marketing', icon: 'Megaphone', color: '#ec4899' },
  sales: { label: 'Sales', icon: 'TrendingUp', color: '#3b82f6' },
  hr: { label: 'HR', icon: 'UserCog', color: '#14b8a6' },
  payroll: { label: 'Payroll', icon: 'Banknote', color: '#84cc16' },
  legal: { label: 'Legal', icon: 'Scale', color: '#a78bfa' },
  ecommerce: { label: 'E-commerce', icon: 'ShoppingCart', color: '#f97316' },
  logistics: { label: 'Logistics', icon: 'Truck', color: '#0891b2' },
  healthcare: { label: 'Healthcare', icon: 'HeartPulse', color: '#ef4444' },
  education: { label: 'Education', icon: 'GraduationCap', color: '#6366f1' },
  manufacturing: { label: 'Manufacturing', icon: 'Factory', color: '#71717a' },
  hospitality: { label: 'Hospitality', icon: 'UtensilsCrossed', color: '#d946ef' },
  construction: { label: 'Construction', icon: 'HardHat', color: '#a16207' },
  retail: { label: 'Retail', icon: 'Store', color: '#db2777' },
  government: { label: 'Government', icon: 'Landmark', color: '#1d4ed8' },
  cloud: { label: 'Cloud', icon: 'Cloud', color: '#0ea5e9' },
  'developer-tools': { label: 'Developer Tools', icon: 'Code2', color: '#22c55e' },
  communication: { label: 'Communication', icon: 'MessageSquare', color: '#eab308' },
  productivity: { label: 'Productivity', icon: 'Zap', color: '#f43f5e' },
  analytics: { label: 'Analytics', icon: 'BarChart3', color: '#0284c7' },
  'ai-platforms': { label: 'AI Platforms', icon: 'BrainCircuit', color: '#9333ea' },
  identity: { label: 'Identity', icon: 'ShieldCheck', color: '#059669' },
}

/** Standard event types published on the Event Bus. */
export const STANDARD_EVENT_TYPES = [
  'invoice.paid',
  'invoice.created',
  'lead.created',
  'lead.qualified',
  'order.placed',
  'order.fulfilled',
  'meeting.scheduled',
  'gst.filed',
  'payment.failed',
  'payment.received',
  'contract.signed',
  'employee.joined',
  'employee.left',
  'ticket.created',
  'ticket.resolved',
  'campaign.completed',
  'deal.won',
  'deal.lost',
  'expense.submitted',
  'expense.approved',
  'document.uploaded',
  'task.completed',
  'sync.completed',
  'sync.failed',
] as const

/** AI Connector Engine — intent templates. */
export const AI_CONNECTOR_INTENTS: { pattern: RegExp; connectorSlug: string; action: string; description: string }[] = [
  { pattern: /sync.*shopify|shopify.*order/i, connectorSlug: 'shopify', action: 'sync_orders', description: 'Sync all Shopify orders into GSTPilot' },
  { pattern: /invoice.*razorpay|razorpay.*invoice/i, connectorSlug: 'razorpay', action: 'generate_invoices', description: 'Generate invoices from Razorpay payments' },
  { pattern: /lead.*gmail|gmail.*lead|crm.*gmail/i, connectorSlug: 'gmail', action: 'create_leads', description: 'Create CRM leads from Gmail conversations' },
  { pattern: /jira.*ticket|ticket.*jira/i, connectorSlug: 'jira', action: 'create_ticket', description: 'Open a Jira ticket from Support AI' },
  { pattern: /zoom.*meeting|schedule.*zoom/i, connectorSlug: 'zoom', action: 'schedule_meeting', description: 'Schedule a Zoom meeting' },
  { pattern: /slack.*message|message.*slack/i, connectorSlug: 'slack', action: 'send_message', description: 'Send a Slack message' },
  { pattern: /whatsapp.*send|send.*whatsapp/i, connectorSlug: 'whatsapp-business', action: 'send_message', description: 'Send a WhatsApp Business message' },
  { pattern: /stripe.*payment|charge.*stripe/i, connectorSlug: 'stripe', action: 'create_charge', description: 'Create a Stripe payment/charge' },
  { pattern: /tally.*sync|sync.*tally/i, connectorSlug: 'tally', action: 'sync_ledger', description: 'Sync Tally Prime ledger' },
  { pattern: /quickbooks.*sync|sync.*quickbooks/i, connectorSlug: 'quickbooks', action: 'sync_books', description: 'Sync QuickBooks books' },
  { pattern: /hubspot.*contact|contact.*hubspot/i, connectorSlug: 'hubspot', action: 'sync_contacts', description: 'Sync HubSpot contacts' },
  { pattern: /salesforce.*opportunity|opportunity.*salesforce/i, connectorSlug: 'salesforce', action: 'sync_opportunities', description: 'Sync Salesforce opportunities' },
  { pattern: /github.*issue|issue.*github/i, connectorSlug: 'github', action: 'create_issue', description: 'Create a GitHub issue' },
  { pattern: /notion.*page|page.*notion/i, connectorSlug: 'notion', action: 'create_page', description: 'Create a Notion page' },
  { pattern: /gst.*file|file.*gst/i, connectorSlug: 'gstn', action: 'file_return', description: 'File GST return via GSTN' },
]
