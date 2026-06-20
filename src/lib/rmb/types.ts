// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT RUN MY BUSINESS™ — Type Definitions
// Shared types for the Run My Business™ Operating System (Phase 4).
// Tagline: "Ask Anything. Delegate Everything. Think. Execute. Operate."
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Task Execution Engine (Module 4) ────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'scheduled';

export const TASK_STATUS_GLYPH: Record<TaskStatus, string> = {
  pending: '⚪',
  running: '🟡',
  completed: '🟢',
  failed: '🔴',
  scheduled: '🔵',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  scheduled: 'Scheduled',
};

export type TaskCategory =
  | 'gst'
  | 'collection'
  | 'reporting'
  | 'finance'
  | 'compliance'
  | 'communication'
  | 'analysis';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface RmbTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: AgentId;     // which Business Agent owns it
  amount?: number;             // ₹ involved, if any
  createdAt: string;           // ISO
  startedAt?: string;
  completedAt?: string;
  dueAt?: string;              // ISO deadline
  progressPct: number;         // 0–100
  output?: string;             // human-readable result
  logs?: TaskLogEntry[];
}

export interface TaskLogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

// ─── Business Agents (Module 5) ──────────────────────────────────────────────

export type AgentId =
  | 'gst-agent'
  | 'finance-agent'
  | 'collections-agent'
  | 'compliance-agent'
  | 'reporting-agent';

export interface BusinessAgent {
  id: AgentId;
  name: string;
  emoji: string;
  role: string;               // short title
  tagline: string;
  expertise: string[];
  handles: string[];          // bullet list of responsibilities
  status: 'idle' | 'working' | 'monitoring' | 'alert';
  currentTask?: string;       // what it's doing right now
  activeTaskCount: number;
  completedToday: number;
  failedToday: number;
  lastAction?: string;        // human-readable last action
}

// ─── Autopilot Engine (Module 3) ─────────────────────────────────────────────

export type AutopilotId =
  | 'gst-autopilot'
  | 'collection-autopilot'
  | 'reporting-autopilot'
  | 'finance-autopilot';

export type AutopilotStatus = 'on' | 'off' | 'running' | 'error';

export interface AutopilotRoutine {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;         // last-run status of the routine
  lastRunAt?: string;
  nextRunAt?: string;
  output?: string;
}

export interface AutopilotState {
  id: AutopilotId;
  name: string;
  emoji: string;
  description: string;
  status: AutopilotStatus;
  cadenceLabel: string;       // e.g. "Daily 9:00 AM", "On due-date"
  routines: AutopilotRoutine[];
  lastRunSummary?: string;
}

// ─── Business Command Center (Module 1) ──────────────────────────────────────

export interface BusinessStatus {
  revenue: number;            // current month revenue ₹
  cash: number;               // current cash position ₹
  gstLiability: number;       // outstanding GST liability ₹
  pendingCollections: number; // overdue receivables ₹
  healthScore: number;        // 0–100
  healthLabel: string;        // Critical / Needs Attention / Healthy
}

export interface CommandCenterSection {
  id: string;
  title: string;
  emoji: string;
  count: number;              // how many items in this section
  items: CommandCenterItem[];
  cta: string;                // button label e.g. "Open Returns"
  ctaView?: string;           // nav target view id
}

export interface CommandCenterItem {
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  urgency?: TaskPriority;
  dueLabel?: string;
  meta?: string;
}

export interface CommandCenter {
  businessStatus: BusinessStatus;
  sections: CommandCenterSection[];   // Today's Tasks / Pending Returns / Collections / Notices / Reports / Team Tasks
  teamTasks: RmbTask[];
}

// ─── Natural Language Business Commands (Module 2) ───────────────────────────

export type CommandIntentType =
  | 'recover_collections'
  | 'file_returns'
  | 'generate_report'
  | 'create_reminders'
  | 'send_whatsapp'
  | 'show_risky_clients'
  | 'prepare_forecast'
  | 'run_my_business_today'
  | 'prepare_compliance_report'
  | 'generate_pnl'
  | 'reconcile'
  | 'prepare_gstr1'
  | 'prepare_gstr3b'
  | 'escalate_clients'
  | 'unknown';

export interface CommandIntent {
  intent: CommandIntentType;
  confidence: number;          // 0–1
  rawText: string;
  matchedPhrases: string[];
  parameters?: Record<string, string | number>;
  generatedTaskPlan: RmbTask[];   // concrete tasks produced from this command
  spokenAck: string;              // how Oracle acknowledges: "I've created the task…"
}

// ─── Orchestrator (Module 6) ─────────────────────────────────────────────────

export interface OrchestrationStep {
  id: number;
  name: string;
  emoji: string;
  detail: string;
  producedTasks: number;
  status: TaskStatus;
}

export interface OrchestrationPlan {
  trigger: string;                  // "Run my business today"
  generatedAt: string;
  analysis: string;                 // one-paragraph business read
  priorities: PriorityItem[];
  tasksCreated: number;
  tasksByAgent: Record<AgentId, number>;
  steps: OrchestrationStep[];
  completionReport: string;         // summary of what was executed
}

export interface PriorityItem {
  rank: number;
  title: string;
  detail: string;
  urgency: TaskPriority;
  agentId: AgentId;
}

// ─── Daily CEO Brief (Module 7) ──────────────────────────────────────────────

export interface DailyCEOBrief {
  greeting: string;
  userName: string;
  dateLabel: string;
  tagline: string;
  metrics: {
    revenue: number;
    collections: number;
    cash: number;
    gst: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  riskLabel: string;
  priorityActions: PriorityActionCEO[];
  generatedAt: string;
}

export interface PriorityActionCEO {
  rank: number;
  text: string;
  amount?: number;
  agentId: AgentId;
}

// ─── Delegation Engine (Module 8) ────────────────────────────────────────────

export interface DelegationRequest {
  rawText: string;
}

export interface DelegationPlan {
  request: string;
  understood: string;              // "Understood — I'll prepare the monthly compliance report."
  intent: CommandIntentType;
  tasks: RmbTask[];
  scheduledFor?: string;           // ISO if scheduled
  executionMode: 'now' | 'scheduled' | 'queued';
  ack: string;                     // "I've scheduled the report."
}

// ─── Memory (Module 9) ───────────────────────────────────────────────────────

export interface RmbMemory {
  taskHistory: TaskHistoryItem[];
  completedActions: number;
  failedActions: number;
  teamPerformance: TeamPerfRecord[];
  reportsGenerated: ReportRecord[];
  collectionHistory: CollectionHistoryRecord[];
  routines: BusinessRoutine[];
  insights: string[];              // natural-language memory insights
}

export interface TaskHistoryItem {
  date: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  agentId?: AgentId;
  amount?: number;
}

export interface TeamPerfRecord {
  agentId: AgentId;
  name: string;
  completed: number;
  failed: number;
  onTimePct: number;
  highlight: string;
}

export interface ReportRecord {
  id: string;
  title: string;
  type: string;
  generatedAt: string;
  generatedBy: AgentId;
  pages?: number;
}

export interface CollectionHistoryRecord {
  clientName: string;
  usualBehaviour: 'on_time' | 'slight_delay' | 'chronic_late' | 'no_data';
  avgDelayDays: number;
  outstanding: number;
  note: string;
}

export interface BusinessRoutine {
  id: string;
  name: string;
  cadence: string;
  lastRun: string;
  owner: AgentId;
}

// ─── Personality (Module 10) ─────────────────────────────────────────────────

export const RMB_PERSONA_ROLES = ['COO', 'Operations Manager', 'Executive Assistant', 'AI Employees Team'] as const;

export interface RmbPersonality {
  roles: string[];
  tagline: string;
  spokenBehaviours: string[];      // "I've created the task.", etc.
  forbiddenPhrases: string[];      // "I am just an AI", "I cannot do that"
  operatingPrinciples: string[];
}

// ─── Aggregated RMB State ────────────────────────────────────────────────────

export interface RmbState {
  commandCenter: CommandCenter;
  autopilots: AutopilotState[];
  agents: BusinessAgent[];
  orchestrator: OrchestrationPlan;
  dailyBrief: DailyCEOBrief;
  memory: RmbMemory;
  personality: RmbPersonality;
  recentTasks: RmbTask[];          // last ~12 tasks across all agents
  generatedAt: string;
  hasLiveData: boolean;
  clientCount: number;
}
