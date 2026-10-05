// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — Shared Type Contracts
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// All 8 engine files import from here. Mirrors the Prisma models but stays
// pure-TypeScript (no Prisma dependency) so it's client + server importable.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MODULE 1 — Observation Engine™ ────────────────────────────────────────────

export type BusinessEventType =
  | 'gst_due'
  | 'bank_transaction'
  | 'receivable'
  | 'payable'
  | 'payroll'
  | 'tds'
  | 'client_behaviour'
  | 'cash_flow'
  | 'collection_risk';

export type EventSource =
  | 'system'
  | 'gst'
  | 'banking'
  | 'invoice'
  | 'communication'
  | 'payroll'
  | 'manual';

export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type EventStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated';

export interface BusinessEvent {
  id: string;
  businessId: string | null;
  type: BusinessEventType;
  source: EventSource;
  payload: Record<string, unknown> | null;
  severity: EventSeverity;
  status: EventStatus;
  createdAt: string;
}

export interface ObservationSummary {
  totalEvents: number;
  openEvents: number;
  criticalEvents: number;
  highSeverityEvents: number;
  byType: Record<BusinessEventType, number>;
  bySeverity: Record<EventSeverity, number>;
  recentEvents: BusinessEvent[];
  detectedIssues: DetectedIssue[];
}

export interface DetectedIssue {
  type: BusinessEventType;
  title: string;
  description: string;
  severity: EventSeverity;
  suggestedAction: string;
}

// ─── MODULE 2 — Decision Engine™ ───────────────────────────────────────────────

export type DecisionPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'superseded';
export type DecisionAction =
  | 'prepare_return'
  | 'send_reminder'
  | 'reconcile'
  | 'delay_payment'
  | 'forecast'
  | 'escalate'
  | 'download_2b'
  | 'run_payroll'
  | 'calc_tds'
  | 'send_invoice';

export interface Decision {
  id: string;
  eventId: string;
  reason: string;
  priority: DecisionPriority;
  action: DecisionAction;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionSummary {
  total: number;
  pending: number;
  approved: number;
  executed: number;
  byPriority: Record<DecisionPriority, number>;
  byAction: Record<string, number>;
  recentDecisions: Decision[];
}

// ─── MODULE 3 — Autonomous Execution Engine™ ───────────────────────────────────

export type ExecutionTaskType =
  | 'gst_prepare'
  | 'gst_json'
  | 'download_2b'
  | 'bank_reconcile'
  | 'send_invoice'
  | 'send_report'
  | 'send_whatsapp'
  | 'send_email'
  | 'send_sms'
  | 'run_payroll'
  | 'calc_tds';

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'awaiting_approval'
  | 'cancelled';

export type AgentName =
  | 'gst_agent'
  | 'cfo_agent'
  | 'collection_agent'
  | 'compliance_agent'
  | 'reporting_agent';

export interface ExecutionTask {
  id: string;
  decisionId: string | null;
  type: ExecutionTaskType;
  description: string;
  status: ExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  riskScore: number;
  agent: AgentName | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionSummary {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  awaitingApproval: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
  successRate: number;
  recentTasks: ExecutionTask[];
}

// ─── MODULE 4 — Approval Engine™ ───────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';

export interface Approval {
  id: string;
  taskId: string;
  risk: number;
  status: ApprovalStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  autoApproved: number;
  pendingApprovals: Approval[];
  riskThreshold: number;
}

// ─── MODULE 5 — Workflow Engine™ ───────────────────────────────────────────────

export type WorkflowType =
  | 'collection_recovery'
  | 'gst_filing'
  | 'cash_crisis'
  | 'onboarding'
  | 'tds_filing'
  | 'payroll_run';

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'aborted';

export interface WorkflowStep {
  stage: string;
  action: string;
  agent: AgentName | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface Workflow {
  id: string;
  name: string;
  type: WorkflowType;
  trigger: string | null;
  steps: WorkflowStep[];
  currentStep: number;
  status: WorkflowStatus;
  context: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  total: number;
  running: number;
  completed: number;
  paused: number;
  byType: Record<string, number>;
  activeWorkflows: Workflow[];
}

// ─── MODULE 6 — Learning Engine™ ───────────────────────────────────────────────

export type BehaviourAction =
  | 'approve_filing'
  | 'reject_reminder'
  | 'delay_payment'
  | 'prefer_time'
  | 'payment_behaviour'
  | 'filing_pattern';

export interface UserBehaviour {
  id: string;
  userId: string | null;
  action: BehaviourAction;
  preference: string;
  confidence: number;
  evidence: number;
  updatedAt: string;
  createdAt: string;
}

export interface LearningSummary {
  totalMemories: number;
  highConfidence: number;
  byAction: Record<string, number>;
  topPreferences: UserBehaviour[];
  learnedPatterns: LearnedPattern[];
}

export interface LearnedPattern {
  action: BehaviourAction;
  pattern: string;
  confidence: number;
  evidence: number;
  insight: string;
}

// ─── MODULE 7 — Execution Timeline™ ────────────────────────────────────────────

export type TimelineStage = 'observe' | 'think' | 'decide' | 'execute' | 'confirm' | 'learn';

export interface ExecutionTimelineEntry {
  id: string;
  taskId: string | null;
  agent: AgentName | 'oracle' | null;
  stage: TimelineStage;
  title: string;
  description: string | null;
  timestamp: string;
}

export interface TimelineSummary {
  total: number;
  todayCount: number;
  byStage: Record<TimelineStage, number>;
  byAgent: Record<string, number>;
  entries: ExecutionTimelineEntry[];
}

// ─── MODULE 8 — Agent Memory™ ──────────────────────────────────────────────────

export type MemoryType = 'fact' | 'preference' | 'pattern' | 'outcome' | 'skill';

export interface AgentMemory {
  id: string;
  agent: AgentName | 'oracle';
  memoryType: MemoryType;
  key: string;
  value: string;
  importance: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMemorySummary {
  total: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
  highImportance: number;
  recentMemories: AgentMemory[];
}

// ─── AI Agent Definitions ──────────────────────────────────────────────────────

export interface AIAgent {
  id: AgentName;
  name: string;
  title: string;
  description: string;
  capabilities: string[];
  status: 'idle' | 'active' | 'busy';
  tasksExecuted: number;
  successRate: number;
  color: string;
  icon: string;
}

export interface AgentRoster {
  agents: AIAgent[];
  totalAgents: number;
  activeAgents: number;
  totalTasksExecuted: number;
  avgSuccessRate: number;
}

// ─── Aggregated Execution Engine State (for /api/execution + Oracle context) ──

export interface ExecutionEngineState {
  observation: ObservationSummary;
  decisions: DecisionSummary;
  execution: ExecutionSummary;
  approvals: ApprovalSummary;
  workflows: WorkflowSummary;
  learning: LearningSummary;
  timeline: TimelineSummary;
  agents: AgentRoster;
  pipeline: ExecutionPipelineEntry[];
}

export interface ExecutionPipelineEntry {
  stage: TimelineStage;
  title: string;
  description: string;
  agent: AgentName | 'oracle' | null;
  timestamp: string;
  status: 'done' | 'in_progress' | 'queued';
}
