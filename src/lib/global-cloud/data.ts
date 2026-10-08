// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: GLOBAL FINANCIAL CLOUD™ DATA LAYER
//
// Type definitions + utility helpers for all 15 sub-modules of Phase 16 —
// Global Financial Cloud™, Open Platform & Developer Ecosystem™.
//
//   • NO API calls  • NO Math.random  • NO fetch  • NO Date.now side-effects
//
// ── PRODUCTION SAFETY ─────────────────────────────────────────────────────────
// Previously this module shipped ~1140 lines of curated STATIC data designed
// to "look like a real billion-dollar SaaS platform (VEYRO scale: ~2.4M
// developers, ~180K enterprises, ~$4.8Bn API revenue)". REST_ENDPOINTS,
// EVENT_TYPES (with fabricated dailyVolume / subscribers / p99LatencyMs),
// WEBHOOK_ENDPOINTS, plus curated fake platform stats across 100+ exports.
// All of these presented fabricated platform-scale metrics as real, which is
// misleading to users. The data arrays are now empty (type signatures are
// preserved so consumers continue to compile). ACCENT_HEX, ACCENT_CLASSES,
// and the fmt/fmtN/fmtPct helpers are kept since they are real utility code
// (color tokens + number formatting).
// TODO: Replace each export with real data from the corresponding /api/*
// endpoint when the underlying integration lands.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Phase 16 Accent Color Tokens ─────────────────────────────────────────────
// NEVER indigo/blue. Emerald / teal / cyan / violet / amber / rose only.
export type Accent = 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose';

export const ACCENT_HEX: Record<Accent, string> = {
  emerald: '#10b981',
  teal:    '#14b8a6',
  cyan:    '#06b6d4',
  violet:  '#8b5cf6',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
};

export const ACCENT_CLASSES: Record<Accent, {
  text: string; bg: string; border: string; ring: string; bar: string; glow: string;
}> = {
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', ring: 'ring-emerald-500/30', bar: 'bg-emerald-500', glow: 'shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)]' },
  teal:    { text: 'text-teal-300',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    ring: 'ring-teal-500/30',    bar: 'bg-teal-500',    glow: 'shadow-[0_0_30px_-5px_rgba(20,184,166,0.4)]' },
  cyan:    { text: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    ring: 'ring-cyan-500/30',    bar: 'bg-cyan-500',    glow: 'shadow-[0_0_30px_-5px_rgba(6,182,212,0.4)]' },
  violet:  { text: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  ring: 'ring-violet-500/30',  bar: 'bg-violet-500',  glow: 'shadow-[0_0_30px_-5px_rgba(139,92,246,0.4)]' },
  amber:   { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   ring: 'ring-amber-500/30',   bar: 'bg-amber-500',   glow: 'shadow-[0_0_30px_-5px_rgba(245,158,11,0.4)]' },
  rose:    { text: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    ring: 'ring-rose-500/30',    bar: 'bg-rose-500',    glow: 'shadow-[0_0_30px_-5px_rgba(244,63,94,0.4)]' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
export const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};
export const fmtN = (n: number): string => {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toFixed(0)}`;
};
export const fmtPct = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEVELOPER PLATFORM — APIs, SDKs, CLI, OAuth, API keys, Playground, Sandbox
// ═══════════════════════════════════════════════════════════════════════════════

export interface RestEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  desc: string;
  ratePerMin: number;
}

export const REST_ENDPOINTS: RestEndpoint[] = [];

export interface GraphQLOperation {
  name: string;
  type: 'Query' | 'Mutation' | 'Subscription';
  desc: string;
  returns: string;
}

export const GRAPHQL_OPS: GraphQLOperation[] = [];

export interface SdkLibrary {
  language: string;
  package: string;
  version: string;
  weeklyDownloads: number;
  install: string;
  accent: Accent;
}

export const SDKS: SdkLibrary[] = [];

export interface CliCommand {
  command: string;
  desc: string;
  example: string;
}

export const CLI_COMMANDS: CliCommand[] = [];

export interface OAuthProvider {
  name: string;
  type: string;
  scopes: number;
  flow: string;
  status: 'live' | 'beta';
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [];

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: 'live' | 'sandbox';
  created: string;
  lastUsed: string;
  scopes: string[];
  status: 'active' | 'revoked';
}

export const API_KEYS: ApiKey[] = [];

export interface PlaygroundSample {
  title: string;
  language: 'curl' | 'node' | 'python' | 'graphql';
  code: string;
  desc: string;
}

export const PLAYGROUND_SAMPLES: PlaygroundSample[] = [];

export interface SandboxEnv {
  id: string;
  name: string;
  region: string;
  records: number;
  resetSchedule: string;
  status: 'healthy' | 'resetting';
}

export const SANDBOX_ENVS: SandboxEnv[] = [];

export interface DocSection {
  category: string;
  articles: number;
  views: number;
  helpfulness: number;
  accent: Accent;
}

export const DOC_SECTIONS: DocSection[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ENTERPRISE API GATEWAY — 13 service domains with endpoints
// ═══════════════════════════════════════════════════════════════════════════════

export interface ServiceApi {
  domain: string;
  icon: string;
  endpoints: number;
  calls24h: number;
  p95Ms: number;
  errorRate: number;
  uptime: number;
  auth: string;
  accent: Accent;
  status: 'operational' | 'degraded' | 'maintenance';
  topEndpoints: string[];
}

export const SERVICE_APIS: ServiceApi[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 3. APP MARKETPLACE — Apps, Extensions, Plugins, AI Skills, Connectors, Templates, Automation Packs
// ═══════════════════════════════════════════════════════════════════════════════

export interface MarketplaceApp {
  id: string;
  name: string;
  publisher: string;
  category: 'App' | 'Extension' | 'Plugin' | 'AI Skill' | 'ERP Connector' | 'Industry Template' | 'Automation Pack';
  installs: number;
  rating: number;
  reviews: number;
  price: string;
  tagline: string;
  accent: Accent;
  featured: boolean;
}

export const MARKETPLACE_APPS: MarketplaceApp[] = [];

export interface MarketplaceCategory {
  name: string;
  count: number;
  installs: number;
  accent: Accent;
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [];

export interface DeveloperPublisher {
  name: string;
  apps: number;
  installs: number;
  revenue: number;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Verified';
}

export const TOP_PUBLISHERS: DeveloperPublisher[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GLOBAL INTEGRATION HUB — 20 native integrations
// ═══════════════════════════════════════════════════════════════════════════════

export interface Integration {
  name: string;
  category: 'ERP' | 'CRM' | 'Payments' | 'Banking' | 'Communication' | 'Productivity' | 'Government' | 'Commerce';
  status: 'connected' | 'available' | 'coming-soon';
  sync: 'Two-way' | 'Inbound' | 'Outbound';
  lastSync: string;
  records: number;
  accent: Accent;
}

export const INTEGRATIONS: Integration[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FINANCIAL DATA CLOUD — 11 unified data domains
// ═══════════════════════════════════════════════════════════════════════════════

export interface DataDomain {
  name: string;
  records: number;
  schema: string;
  syncStatus: 'synced' | 'syncing' | 'pending';
  freshness: string;
  consumers: number;
  storageGB: number;
  accent: Accent;
}

export const DATA_DOMAINS: DataDomain[] = [];

export interface DataSyncJob {
  domain: string;
  source: string;
  destination: string;
  records: number;
  duration: string;
  status: 'success' | 'running' | 'queued' | 'failed';
}

export const DATA_SYNC_JOBS: DataSyncJob[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 6. EVENT STREAMING PLATFORM — 9 event types
// ═══════════════════════════════════════════════════════════════════════════════

export interface EventType {
  name: string;
  topic: string;
  schema: string;
  subscribers: number;
  dailyVolume: number;
  p99LatencyMs: number;
  retention: string;
  accent: Accent;
}

export const EVENT_TYPES: EventType[] = [];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  successRate: number;
  avgLatencyMs: number;
  lastDelivery: string;
  status: 'active' | 'paused' | 'failing';
}

export const WEBHOOK_ENDPOINTS: WebhookEndpoint[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ENTERPRISE AUTOMATION STUDIO — workflow templates
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  triggers: number;
  conditions: number;
  actions: number;
  aiNodes: number;
  runs: number;
  successRate: number;
  avgDuration: string;
  accent: Accent;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [];

export interface AutomationNode {
  type: 'Trigger' | 'Condition' | 'Action' | 'AI Node' | 'API Node' | 'Webhook' | 'Schedule';
  name: string;
  desc: string;
  icon: string;
  accent: Accent;
}

export const AUTOMATION_NODES: AutomationNode[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ENTERPRISE DATA WAREHOUSE — datasets, queries, BI dashboards, data lake
// ═══════════════════════════════════════════════════════════════════════════════

export interface Dataset {
  name: string;
  rows: number;
  size: string;
  freshness: string;
  queries24h: number;
  accent: Accent;
}

export const WAREHOUSE_DATASETS: Dataset[] = [];

export interface SavedQuery {
  name: string;
  sql: string;
  author: string;
  runs: number;
  avgMs: number;
  cacheHit: number;
}

export const SAVED_QUERIES: SavedQuery[] = [];

export interface BIDashboard {
  name: string;
  owner: string;
  viewers: number;
  refresh: string;
  tiles: number;
  accent: Accent;
}

export const BI_DASHBOARDS: BIDashboard[] = [];

export interface AIQuery {
  question: string;
  sqlGenerated: string;
  confidence: number;
  runtime: string;
}

export const AI_QUERIES: AIQuery[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 9. GLOBAL IDENTITY PLATFORM — SSO, MFA, passwordless
// ═══════════════════════════════════════════════════════════════════════════════

export interface SSOConnection {
  name: string;
  protocol: 'SAML 2.0' | 'OIDC' | 'OAuth 2.0' | 'LDAP';
  users: number;
  lastLogin: string;
  mfa: boolean;
  accent: Accent;
}

export const SSO_CONNECTIONS: SSOConnection[] = [];

export interface MFAMethod {
  name: string;
  users: number;
  adoptionPct: number;
  avgSetupMin: number;
  accent: Accent;
}

export const MFA_METHODS: MFAMethod[] = [];

export interface IdentityEvent {
  type: string;
  user: string;
  ip: string;
  location: string;
  time: string;
  status: 'success' | 'challenge' | 'denied';
}

export const IDENTITY_EVENTS: IdentityEvent[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 10. DEVELOPER ANALYTICS — API usage, errors, latency, revenue, apps
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiUsageSeries {
  hour: string;
  calls: number;
  errors: number;
}

export const API_USAGE_SERIES: ApiUsageSeries[] = [];

export interface ApiErrorType {
  code: string;
  message: string;
  count: number;
  trend: number;
  accent: Accent;
}

export const API_ERROR_TYPES: ApiErrorType[] = [];

export interface DeveloperApp {
  name: string;
  publisher: string;
  calls24h: number;
  errorRate: number;
  revenue: number;
  trend: number;
  accent: Accent;
}

export const TOP_DEVELOPER_APPS: DeveloperApp[] = [];

export interface DeveloperMetric {
  label: string;
  value: string;
  trend: number;
  accent: Accent;
}

export const DEVELOPER_KPIS: DeveloperMetric[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 11. ENTERPRISE BILLING PLATFORM — subscriptions, usage, marketplace, contracts
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubscriptionPlan {
  name: string;
  mrr: number;
  customers: number;
  churn: number;
  growth: number;
  accent: Accent;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [];

export interface UsageBillable {
  metric: string;
  included: number;
  used: number;
  overage: number;
  rate: string;
  revenue: number;
}

export const USAGE_BILLABLES: UsageBillable[] = [];

export interface MarketplaceRevenue {
  app: string;
  publisher: string;
  revenue: number;
  gstpilotShare: number;
  publisherShare: number;
  accent: Accent;
}

export const MARKETPLACE_REVENUE: MarketplaceRevenue[] = [];

export interface EnterpriseContract {
  customer: string;
  arr: number;
  term: string;
  seats: number;
  status: 'active' | 'renewing' | 'expiring';
  accent: Accent;
}

export const ENTERPRISE_CONTRACTS: EnterpriseContract[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 12. MULTI-TENANT CLOUD INFRASTRUCTURE — regions, scaling, edge, CDN, HA
// ═══════════════════════════════════════════════════════════════════════════════

export interface CloudRegion {
  code: string;
  name: string;
  continent: string;
  orgs: number;
  apiCalls24h: number;
  p95Ms: number;
  status: 'operational' | 'degraded' | 'maintenance';
  accent: Accent;
}

export const CLOUD_REGIONS: CloudRegion[] = [];

export interface EdgePOP {
  city: string;
  country: string;
  cacheHitRatio: number;
  requestsPerSec: number;
  egressMbps: number;
  accent: Accent;
}

export const EDGE_POPS: EdgePOP[] = [];

export interface InfraMetric {
  label: string;
  value: string;
  sub: string;
  trend: number;
  accent: Accent;
}

export const INFRA_KPIS: InfraMetric[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 13. ENTERPRISE SECURITY — Zero Trust, encryption, threats, audit
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityControl {
  category: string;
  controls: number;
  passing: number;
  score: number;
  accent: Accent;
}

export const SECURITY_CONTROLS: SecurityControl[] = [];

export interface ThreatEvent {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  target: string;
  blocked: boolean;
  time: string;
}

export const THREAT_EVENTS: ThreatEvent[] = [];

export interface AuditLogEntry {
  actor: string;
  action: string;
  resource: string;
  ip: string;
  result: 'success' | 'denied' | 'warning';
  time: string;
}

export const AUDIT_LOGS: AuditLogEntry[] = [];

export interface ComplianceCert {
  name: string;
  standard: string;
  status: 'certified' | 'in-progress' | 'planned';
  lastAudit: string;
  nextAudit: string;
  accent: Accent;
}

export const COMPLIANCE_CERTS: ComplianceCert[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 14. GLOBAL FINANCIAL NETWORK — org-to-org connections, shared resources
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrgConnection {
  name: string;
  type: 'Customer' | 'Vendor' | 'Partner' | 'Bank' | 'Government';
  gstin: string;
  sharedDocs: number;
  sharedInvoices: number;
  sharedPayments: number;
  status: 'active' | 'pending' | 'invited';
  accent: Accent;
}

export const ORG_CONNECTIONS: OrgConnection[] = [];

export interface SharedResource {
  type: 'Invoice' | 'PO' | 'Payment' | 'Approval' | 'Document' | 'Vendor Collab' | 'Customer Collab';
  counterparty: string;
  amount: number;
  status: string;
  updated: string;
  accent: Accent;
}

export const SHARED_RESOURCES: SharedResource[] = [];

export interface NetworkMetric {
  label: string;
  value: string;
  trend: number;
  accent: Accent;
}

export const NETWORK_KPIS: NetworkMetric[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// 15. PLATFORM INTELLIGENCE — AI monitors across 6 dimensions
// ═══════════════════════════════════════════════════════════════════════════════

export interface IntelligenceDimension {
  dimension: string;
  score: number;
  status: 'optimal' | 'healthy' | 'watch' | 'action';
  actions24h: number;
  savings: number;
  accent: Accent;
  insight: string;
}

export const INTELLIGENCE_DIMENSIONS: IntelligenceDimension[] = [];

export interface AIAction {
  dimension: string;
  action: string;
  impact: string;
  confidence: number;
  auto: boolean;
  time: string;
}

export const AI_ACTIONS: AIAction[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 16 HUB NAVIGATION — 15 cards
// ═══════════════════════════════════════════════════════════════════════════════

export interface Phase16Module {
  id: string;
  number: number;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  accent: Accent;
  stats: { label: string; value: string }[];
}

export const PHASE16_MODULES: Phase16Module[] = [];

// ─── Aggregated Phase 16 Hero KPIs ────────────────────────────────────────────
export const PHASE16_HERO_KPIS = [];
