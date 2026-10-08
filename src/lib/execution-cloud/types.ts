// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — ENTERPRISE EXECUTION CLOUD™ (MISSION CONTROL)
// Shared Type Contracts — Phase 10
// One global execution pipeline. Every action from every module flows through it.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════
// Pure-TypeScript — no Prisma, no React. Importable from API routes + client.
// Mirrors the Prisma models (ExecutionJob / Worker / Queue / Trace / TaskEdge /
// Alert / Schedule) so the engine layer can stay ORM-agnostic.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MODULE REGISTRY — the 22 modules that flow through the Execution Cloud ───
// Every module's activity is materialised as a unified ExecutionJob. These IDs
// are stable strings used in the `module` column and across the dashboard.
export type ExecutionModule =
  | 'oracle'
  | 'ai_ceo'
  | 'ai_cfo'
  | 'ai_coo'
  | 'ai_cto'
  | 'ai_cro'
  | 'ai_legal'
  | 'ai_hr'
  | 'ai_marketing'
  | 'ai_operations'
  | 'business_graph'
  | 'knowledge_graph'
  | 'digital_twin'
  | 'autonomous_enterprise'
  | 'connectivity_fabric'
  | 'global_enterprise'
  | 'ai_software_factory'
  | 'crm'
  | 'banking'
  | 'gst'
  | 'reports'
  | 'automation';

export const ALL_MODULES: ExecutionModule[] = [
  'oracle', 'ai_ceo', 'ai_cfo', 'ai_coo', 'ai_cto', 'ai_cro',
  'ai_legal', 'ai_hr', 'ai_marketing', 'ai_operations',
  'business_graph', 'knowledge_graph', 'digital_twin',
  'autonomous_enterprise', 'connectivity_fabric', 'global_enterprise',
  'ai_software_factory', 'crm', 'banking', 'gst', 'reports', 'automation',
];

export interface ModuleMeta {
  id: ExecutionModule;
  label: string;
  category: 'ai_executive' | 'intelligence' | 'infrastructure' | 'business' | 'platform';
  color: string;   // tailwind text color class
  accent: string;  // tailwind bg/border color class
  icon: string;    // emoji glyph (UI uses lucide elsewhere; this is a quick marker)
}

export const MODULE_META: Record<ExecutionModule, ModuleMeta> = {
  oracle:                 { id: 'oracle',                 label: 'Oracle™',                category: 'ai_executive', color: 'text-violet-600',  accent: 'bg-violet-500',   icon: '🔮' },
  ai_ceo:                 { id: 'ai_ceo',                 label: 'AI CEO™',                category: 'ai_executive', color: 'text-fuchsia-600', accent: 'bg-fuchsia-500',  icon: '👔' },
  ai_cfo:                 { id: 'ai_cfo',                 label: 'AI CFO™',                category: 'ai_executive', color: 'text-emerald-600', accent: 'bg-emerald-500',  icon: '💰' },
  ai_coo:                 { id: 'ai_coo',                 label: 'AI COO™',                category: 'ai_executive', color: 'text-orange-600',  accent: 'bg-orange-500',   icon: '⚙️' },
  ai_cto:                 { id: 'ai_cto',                 label: 'AI CTO™',                category: 'ai_executive', color: 'text-cyan-600',    accent: 'bg-cyan-500',     icon: '🖥️' },
  ai_cro:                 { id: 'ai_cro',                 label: 'AI CRO™',                category: 'ai_executive', color: 'text-rose-600',    accent: 'bg-rose-500',     icon: '📈' },
  ai_legal:               { id: 'ai_legal',               label: 'AI Legal™',              category: 'ai_executive', color: 'text-amber-700',   accent: 'bg-amber-600',    icon: '⚖️' },
  ai_hr:                  { id: 'ai_hr',                  label: 'AI HR™',                 category: 'ai_executive', color: 'text-pink-600',    accent: 'bg-pink-500',     icon: '🧑‍💼' },
  ai_marketing:           { id: 'ai_marketing',           label: 'AI Marketing™',          category: 'ai_executive', color: 'text-red-600',     accent: 'bg-red-500',      icon: '📣' },
  ai_operations:          { id: 'ai_operations',          label: 'AI Operations™',         category: 'ai_executive', color: 'text-teal-600',    accent: 'bg-teal-500',     icon: '🔧' },
  business_graph:         { id: 'business_graph',         label: 'Business Graph™',        category: 'intelligence', color: 'text-indigo-600',  accent: 'bg-indigo-500',   icon: '🕸️' },
  knowledge_graph:        { id: 'knowledge_graph',        label: 'Knowledge Graph™',       category: 'intelligence', color: 'text-blue-600',    accent: 'bg-blue-500',     icon: '📚' },
  digital_twin:           { id: 'digital_twin',           label: 'Digital Twin™',          category: 'intelligence', color: 'text-purple-600',  accent: 'bg-purple-500',   icon: '🌀' },
  autonomous_enterprise:  { id: 'autonomous_enterprise',  label: 'Autonomous Enterprise™', category: 'intelligence', color: 'text-lime-600',    accent: 'bg-lime-500',     icon: '🤖' },
  connectivity_fabric:    { id: 'connectivity_fabric',    label: 'Connectivity Fabric™',   category: 'infrastructure',color: 'text-sky-600',    accent: 'bg-sky-500',      icon: '🔌' },
  global_enterprise:      { id: 'global_enterprise',      label: 'Global Enterprise™',     category: 'platform',     color: 'text-green-600',   accent: 'bg-green-500',    icon: '🌍' },
  ai_software_factory:    { id: 'ai_software_factory',    label: 'AI Software Factory™',   category: 'platform',     color: 'text-yellow-600',  accent: 'bg-yellow-500',   icon: '🏭' },
  crm:                    { id: 'crm',                    label: 'CRM™',                   category: 'business',     color: 'text-orange-600',  accent: 'bg-orange-500',   icon: '📇' },
  banking:                { id: 'banking',                label: 'Banking™',               category: 'business',     color: 'text-emerald-700', accent: 'bg-emerald-600',  icon: '🏦' },
  gst:                    { id: 'gst',                    label: 'GST™',                   category: 'business',     color: 'text-amber-600',   accent: 'bg-amber-500',    icon: '🧾' },
  reports:                { id: 'reports',                label: 'Reports™',               category: 'business',     color: 'text-slate-600',   accent: 'bg-slate-500',    icon: '📊' },
  automation:             { id: 'automation',             label: 'Automation™',            category: 'business',     color: 'text-cyan-700',    accent: 'bg-cyan-600',     icon: '⚡' },
};

// ─── EXECUTION JOB (the unified pipeline row) ────────────────────────────────

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'awaiting_approval'
  | 'cancelled';

export type ExecutionPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

export interface ExecutionJob {
  id: string;
  module: ExecutionModule;
  type: string;                       // module-specific action type
  description: string;
  status: ExecutionStatus;
  priority: ExecutionPriority;
  organizationId: string | null;
  countryIso: string | null;
  entityId: string | null;
  userId: string | null;
  aiModule: string | null;            // which AI executive authored the job
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  auditId: string | null;
  sourceJobId: string | null;         // upstream dependency (task graph)
  workerId: string | null;
  queueName: string;
  retryCount: number;
  maxRetries: number;
  durationMs: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── EXECUTION WORKER ─────────────────────────────────────────────────────────

export type WorkerType =
  | 'local'
  | 'distributed'
  | 'edge'
  | 'regional'
  | 'country'
  | 'ai'
  | 'connector'
  | 'software_factory';

export type WorkerStatus = 'idle' | 'busy' | 'offline' | 'draining';

export interface ExecutionWorker {
  id: string;
  workerId: string;
  type: WorkerType;
  region: string | null;
  countryIso: string | null;
  status: WorkerStatus;
  currentJobId: string | null;
  capacity: number;
  jobsCompleted: number;
  jobsFailed: number;
  avgLatencyMs: number;
  utilizationPct: number;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── SMART EXECUTION QUEUE ────────────────────────────────────────────────────

export type QueueStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'cancelled'
  | 'awaiting_approval';

export interface ExecutionQueueEntry {
  id: string;
  queueName: string;
  jobId: string;
  priority: number;                   // 0 (critical) … 100 (deferred)
  scheduledFor: string | null;
  status: QueueStatus;
  dependencies: string[];
  workerId: string | null;
  enqueuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface QueueSummary {
  queueName: string;
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  delayed: number;
  awaitingApproval: number;
  oldestQueuedAt: string | null;
  avgWaitMs: number;
}

// ─── EXECUTION TRACE (replay-able steps) ──────────────────────────────────────

export type TraceStage =
  | 'ai_reasoning'
  | 'api_request'
  | 'db_update'
  | 'graph_mutation'
  | 'connector_event'
  | 'user_approval'
  | 'business_event';

export interface ExecutionTrace {
  id: string;
  jobId: string;
  stepIndex: number;
  stage: TraceStage;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  status: 'completed' | 'failed' | 'skipped' | 'replayed';
  createdAt: string;
}

// ─── ENTERPRISE TASK GRAPH ────────────────────────────────────────────────────

export type TaskEdgeRelation =
  | 'lead_to'
  | 'proposal_to'
  | 'negotiation_to'
  | 'invoice_to'
  | 'payment_to'
  | 'gst_to'
  | 'accounting_to'
  | 'forecast_to'
  | 'knowledge_to'
  | 'graph_to'
  | 'oracle_to'
  | 'depends_on'
  | 'triggers'
  | 'rollback_of';

export interface TaskEdge {
  id: string;
  fromJobId: string;
  toJobId: string;
  relation: TaskEdgeRelation;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TaskGraphNode {
  jobId: string;
  module: ExecutionModule;
  description: string;
  status: ExecutionStatus;
  degree: number;                     // in+out edges
}

export interface TaskGraphPath {
  steps: { jobId: string; module: ExecutionModule; description: string; status: ExecutionStatus }[];
  totalDurationMs: number;
  edgeRelations: TaskEdgeRelation[];
}

export interface TaskGraphSummary {
  nodes: number;
  edges: number;
  longestPath: TaskGraphPath | null;
  topHubs: TaskGraphNode[];           // nodes with highest degree
  byRelation: Record<TaskEdgeRelation, number>;
  samplePaths: TaskGraphPath[];
}

// ─── EXECUTION TIMELINE ───────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  jobId: string;
  module: ExecutionModule;
  type: string;
  description: string;
  status: ExecutionStatus;
  timestamp: string;
  durationMs: number;
  actor: string | null;               // user or AI module that initiated
  organizationId: string | null;
  countryIso: string | null;
  auditId: string | null;
}

export interface TimelineSummary {
  total: number;
  todayCount: number;
  last24hCount: number;
  byModule: Record<string, number>;
  byStatus: Record<string, number>;
  entries: TimelineEntry[];
}

// ─── EXECUTION OBSERVABILITY ──────────────────────────────────────────────────

export interface ObservabilityMetrics {
  queueSize: number;
  runningJobs: number;
  failedJobs: number;
  retryCount: number;
  successRate: number;                // 0-100
  avgAiLatencyMs: number;
  avgApiLatencyMs: number;
  avgWorkerLatencyMs: number;
  avgConnectorLatencyMs: number;
  cacheHitRatio: number;              // 0-100
  workerUtilizationPct: number;       // 0-100
  throughputPerMin: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
}

// ─── GLOBAL ALERT CENTER ──────────────────────────────────────────────────────

export type AlertType =
  | 'workflow_failed'
  | 'connector_slow'
  | 'ai_failure'
  | 'job_failed'
  | 'queue_congested'
  | 'missing_approval'
  | 'deployment_failed'
  | 'payment_failed'
  | 'compliance_failed';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ExecutionAlert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  moduleId: ExecutionModule | null;
  jobId: string | null;
  proposedFix: string | null;
  status: 'open' | 'acknowledged' | 'resolved';
  detectedAt: string;
  resolvedAt: string | null;
}

export interface AlertCenterSummary {
  total: number;
  open: number;
  critical: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<AlertSeverity, number>;
  byModule: Record<string, number>;
  recent: ExecutionAlert[];
}

// ─── EXECUTION REPLAY ─────────────────────────────────────────────────────────

export interface ReplayStep {
  stepIndex: number;
  stage: TraceStage;
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
  status: 'completed' | 'failed' | 'skipped' | 'replayed';
  createdAt: string;
}

export interface ReplayResult {
  jobId: string;
  module: ExecutionModule;
  description: string;
  originalStatus: ExecutionStatus;
  steps: ReplayStep[];
  totalDurationMs: number;
  replayable: boolean;
  notes: string[];
}

// ─── LIVE EXECUTION MAP ───────────────────────────────────────────────────────

export interface LiveMapNode {
  id: string;
  kind: 'organization' | 'country' | 'module' | 'worker' | 'queue' | 'api' | 'connector';
  label: string;
  status: 'healthy' | 'busy' | 'degraded' | 'down';
  activeJobs: number;
  detail?: string;
}

export interface LiveMapEdge {
  from: string;
  to: string;
  weight: number;                     // number of jobs flowing along this edge
}

export interface LiveMapRegion {
  region: string;
  countries: string[];
  activeJobs: number;
  healthyWorkers: number;
  totalWorkers: number;
  utilizationPct: number;
}

export interface LiveExecutionMap {
  organizations: LiveMapNode[];
  countries: LiveMapNode[];
  modules: LiveMapNode[];
  workers: LiveMapNode[];
  queues: LiveMapNode[];
  apis: LiveMapNode[];
  connectors: LiveMapNode[];
  edges: LiveMapEdge[];
  regions: LiveMapRegion[];
  systemHealth: 'healthy' | 'degraded' | 'critical';
  totalActiveJobs: number;
  totalHealthyWorkers: number;
  totalWorkers: number;
  updatedAt: string;
}

// ─── EXECUTION ANALYTICS ──────────────────────────────────────────────────────

export interface AnalyticsSummary {
  throughput: {
    totalExecutions: number;
    perMin: number;
    perHour: number;
    perDay: number;
  };
  successRate: number;
  avgDurationMs: number;
  failureCauses: { cause: string; count: number; pct: number }[];
  costPerExecution: number;           // INR
  aiCost: number;                     // INR
  connectorCost: number;              // INR
  productivityGains: number;          // INR (hours saved × rate)
  automationSavings: number;          // INR
  roi: number;                        // (savings / cost) × 100
  byModule: { module: ExecutionModule; executions: number; successRate: number; avgDurationMs: number; cost: number; savings: number }[];
  byHour: { hour: string; executions: number; successRate: number }[];
  trend: 'up' | 'flat' | 'down';
}

// ─── EXECUTION SCHEDULE (cron / scheduled jobs) ───────────────────────────────

export interface ExecutionSchedule {
  id: string;
  name: string;
  module: ExecutionModule;
  type: string;
  cron: string | null;
  organizationId: string | null;
  countryIso: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: 'completed' | 'failed' | 'running' | null;
  enabled: boolean;
  runsCount: number;
}

// ─── UNIFIED DASHBOARD (the /api/execution/dashboard payload) ─────────────────

export interface ExecutionDashboard {
  // Pipeline overview
  totals: {
    totalJobs: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    awaitingApproval: number;
    cancelled: number;
  };
  byModule: { module: ExecutionModule; label: string; jobs: number; successRate: number; avgDurationMs: number; color: string }[];
  byPriority: Record<ExecutionPriority, number>;
  byStatus: Record<ExecutionStatus, number>;
  // Subsystem snapshots
  timeline: TimelineSummary;
  taskGraph: TaskGraphSummary;
  queues: QueueSummary[];
  workers: {
    total: number;
    active: number;
    byType: Record<WorkerType, number>;
    byStatus: Record<WorkerStatus, number>;
    avgUtilizationPct: number;
    roster: ExecutionWorker[];
  };
  observability: ObservabilityMetrics;
  alerts: AlertCenterSummary;
  analytics: AnalyticsSummary;
  liveMap: LiveExecutionMap;
  schedules: ExecutionSchedule[];
  // Oracle narrative — derived from the real job stream, never mocked
  oracleNarrative: string;
  updatedAt: string;
}

// ─── Run / Cancel / Retry / Schedule request bodies ───────────────────────────

export interface RunJobRequest {
  module: ExecutionModule;
  type: string;
  description?: string;
  priority?: ExecutionPriority;
  organizationId?: string;
  countryIso?: string;
  entityId?: string;
  userId?: string;
  aiModule?: string;
  payload?: Record<string, unknown>;
  queueName?: string;
  sourceJobId?: string;
}

export interface ScheduleJobRequest {
  module: ExecutionModule;
  type: string;
  name: string;
  cron?: string;
  organizationId?: string;
  countryIso?: string;
  priority?: ExecutionPriority;
  payload?: Record<string, unknown>;
}

export interface CancelJobRequest { jobId: string; reason?: string }
export interface RetryJobRequest { jobId: string }
export interface ReplayJobRequest { jobId: string }

// ─── EXECUTION CYCLE (Observe → Think → Decide → Execute → Confirm → Learn) ────

export interface ExecutionCycleStage {
  name: 'observe' | 'think' | 'decide' | 'execute' | 'confirm' | 'learn';
  status: 'completed' | 'skipped' | 'failed';
  durationMs: number;
  summary: string;
}

export interface ExecutionCycleAction {
  id: string;
  module: ExecutionModule;
  type: string;
  description: string;
  status: ExecutionStatus;
  dispatchedAt: string;
}

export interface ExecutionCycle {
  cycleId: string;
  trigger: string;
  command: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stages: ExecutionCycleStage[];
  actions: ExecutionCycleAction[];
  summary: string;
}

// ─── Action API request/response contracts ─────────────────────────────────────

export interface ExecuteActionRequest {
  trigger?: string;
  command?: string;
}

export interface ExecuteActionResponse {
  ok: boolean;
  cycle: ExecutionCycle;
  message: string;
}

// ─── Communication action contracts ────────────────────────────────────────────

export type CommChannel = 'whatsapp' | 'email' | 'sms' | 'notice' | 'report';

export interface CommActionRequest {
  channel: CommChannel;
  to: string;
  toName?: string;
  subject: string;
  body?: string;
  template?: string;
}

export interface CommMessage {
  id: string;
  channel: CommChannel;
  to: string;
  toName: string;
  subject: string;
  preview: string;
  status: 'sent' | 'queued' | 'failed';
  template?: string;
  at: string;
}

export interface CommActionResponse {
  ok: boolean;
  message: CommMessage;
}

// ─── Phase 8 — Execution Cloud (legacy 8-module UI) contracts ─────────────────
// These contracts back the /api/execution-cloud/* family of routes and the
// legacy ExecutionCloudPage UI. They are deliberately permissive (lots of
// optional fields) because the real provider for GSTN/banking/invoice is not
// wired in this environment — the routes return honest 501s and the state
// surfaces "not configured" rather than fabricated data.

export type PlanId = 'free' | 'starter' | 'professional' | 'business' | 'enterprise';

export interface CurrentSubscription {
  planId: PlanId;
  planName: string;
  monthlyAmountINR: number;
  yearlyAmountINR: number;
  status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'expired';
  billingCycle: 'monthly' | 'yearly';
  seatCount: number;
  companyCount: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  paymentMethod: string | null;
}

export type BillingAction = 'upgrade' | 'downgrade' | 'cancel' | 'retry_payment';

export interface BillingActionRequest {
  action: BillingAction;
  planId?: PlanId;
}

export interface BillingActionResponse {
  ok: boolean;
  subscription: CurrentSubscription;
  message: string;
}

// ─── Background job system (POST /api/execution-cloud/jobs) ───────────────────

export type JobQueueStatus = 'queued' | 'running' | 'completed' | 'failed' | 'delayed' | 'cancelled';

export interface BackgroundJob {
  id: string;
  type: string;
  queue: string;
  status: JobQueueStatus;
  priority: ExecutionPriority;
  scheduledFor: string | null;
  enqueuedAt: string;
}

export interface JobActionRequest {
  type: string;
  priority?: ExecutionPriority;
  scheduledFor?: string;
}

export interface JobActionResponse {
  ok: boolean;
  job: BackgroundJob;
  message: string;
}

export interface JobSystemStats {
  jobsCompletedToday: number;
  jobsFailedToday: number;
  activeWorkers: number;
  queueDepth: number;
  avgLatencyMs: number;
}

// ─── GSTN Live module state ───────────────────────────────────────────────────

export type GstnCapability = 'gstr1' | 'gstr3b' | 'gstr2b' | 'einvoice' | 'ewaybill' | 'gstsearch' | 'panverify';
export type GstnOperation = 'file' | 'fetch' | 'generate' | 'search' | 'verify';

export interface GstnConnection {
  gstin: string;
  legalName: string;
  state: string;
  status: 'active' | 'suspended' | 'cancelled';
  connectedAt: string;
}

export interface GstnModuleState {
  configured: boolean;
  connections: GstnConnection[];
  operationsToday: number;
  filingsThisMonth: number;
  capabilities: { id: GstnCapability; label: string; emoji: string; enabled: boolean }[];
}

// ─── Banking Cloud module state ───────────────────────────────────────────────

export type BankingCapability = 'sync' | 'collect' | 'fetch' | 'reconcile';
export type CloudRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BankAccount {
  id: string;
  bankName: string;
  accountMasked: string;
  ifsc: string;
  balanceINR: number;
  syncedAt: string | null;
  healthy: boolean;
}

export interface BankingModuleState {
  configured: boolean;
  accounts: BankAccount[];
  totalBalanceINR: number;
  reconMatchRatePct: number;
  pendingReconciliations: number;
}

// ─── Real Invoice Engine module state ─────────────────────────────────────────

export type Invoice2 = 'sales' | 'purchase' | 'tds' | 'payroll';

export interface InvoiceRecord {
  id: string;
  type: Invoice2;
  party: string;
  amountINR: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  date: string;
}

export interface InvoiceTypeBucket {
  type: Invoice2;
  label: string;
  count: number;
  amountINR: number;
}

export interface InvoiceModuleState {
  configured: boolean;
  todayCount: number;
  outstandingINR: number;
  buckets: InvoiceTypeBucket[];
  recent: InvoiceRecord[];
}

// ─── Communication Cloud module state ─────────────────────────────────────────

export interface CommModuleState {
  totalSentToday: number;
  avgDeliveryRatePct: number;
  byChannel: Record<CommChannel, number>;
}

// ─── Execution Engine module state ────────────────────────────────────────────

export type ExecStage = 'observe' | 'think' | 'decide' | 'execute' | 'confirm' | 'learn';

export interface ExecutionModuleState {
  pipelineHealth: CloudRiskLevel;
  autonomousExecutionsToday: number;
  lastCycle: ExecutionCycle | null;
}

// ─── SaaS Billing module state ────────────────────────────────────────────────

export interface BillingModuleState {
  current: CurrentSubscription;
  mrrINR: number;
  arrINR: number;
  paymentMethodOnFile: boolean;
}

// ─── Mobile Apps module state ─────────────────────────────────────────────────

export type CloudJobStatus = 'queued' | 'building' | 'success' | 'failed' | 'cancelled';

export interface MobileAppBuild {
  id: string;
  platform: 'ios' | 'android';
  version: string;
  status: CloudJobStatus;
  buildNumber: number;
  createdAt: string;
  artifactUrl: string | null;
}

export interface MobileDevice {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  lastSeenAt: string;
  appVersion: string;
  pushToken: string | null;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  deliveredTo: number;
}

export interface MobileState {
  builds: MobileAppBuild[];
  devices: MobileDevice[];
  notifications: PushNotification[];
  iosLatestVersion: string | null;
  androidLatestVersion: string | null;
  activeDevices: number;
}

// ─── Full ExecutionCloudState (GET /api/execution-cloud) ──────────────────────

export interface ExecutionCloudState {
  generatedAt: string;
  clientCount: number;
  hasLiveData: boolean;
  headline: string;
  gstn: GstnModuleState;
  banking: BankingModuleState;
  invoices: InvoiceModuleState;
  communication: CommModuleState;
  execution: ExecutionModuleState;
  jobs: { stats: JobSystemStats; recent: BackgroundJob[] };
  billing: BillingModuleState;
  mobile: MobileState;
}

// ─── UI constants (used by ExecutionCloudPage) ────────────────────────────────

export const BILLING_PLANS: { id: PlanId; name: string; priceMonthly: number; emoji: string; tagline: string }[] = [
  { id: 'free',         name: 'Free',         priceMonthly: 0,     emoji: '🆓', tagline: 'Solo founders' },
  { id: 'starter',      name: 'Starter',      priceMonthly: 1499,  emoji: '🚀', tagline: 'Small businesses' },
  { id: 'professional', name: 'Professional', priceMonthly: 4999,  emoji: '⚡', tagline: 'Most popular' },
  { id: 'business',     name: 'Business',     priceMonthly: 14999, emoji: '🏢', tagline: 'Growing teams' },
  { id: 'enterprise',   name: 'Enterprise',   priceMonthly: 49999, emoji: '🏛️', tagline: 'Large orgs' },
];

export const CLOUD_RISK_GLYPH: Record<CloudRiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

export const CLOUD_RISK_LABEL: Record<CloudRiskLevel, string> = {
  low: 'Healthy',
  medium: 'Watch',
  high: 'At risk',
  critical: 'Critical',
};

export const JOB_STATUS_GLYPH: Record<CloudJobStatus, string> = {
  queued: '⏳',
  building: '🔨',
  success: '✅',
  failed: '❌',
  cancelled: '↩️',
};

export const JOB_STATUS_LABEL: Record<CloudJobStatus, string> = {
  queued: 'Queued',
  building: 'Building',
  success: 'Success',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const STAGE_GLYPH: Record<ExecStage, string> = {
  observe: '👁️',
  think: '🧠',
  decide: '⚖️',
  execute: '⚡',
  confirm: '✅',
  learn: '📚',
};

export const STAGE_LABEL: Record<ExecStage, string> = {
  observe: 'Observe',
  think: 'Think',
  decide: 'Decide',
  execute: 'Execute',
  confirm: 'Confirm',
  learn: 'Learn',
};
