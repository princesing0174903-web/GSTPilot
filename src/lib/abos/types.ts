// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS BUSINESS OPERATING SYSTEM™ (ABOS) — Type Definitions
// Phase 7 — The final trillion-dollar phase.
//
// Tagline: "Think. Decide. Execute. Grow Automatically."
//          "Observe. Think. Decide. Execute. Learn. Grow."
//
// ABOS transforms VEYRO from an assistant into a system that can run an
// entire business autonomously — 24/7 monitoring, problem detection, planning,
// decision-making, execution, learning, and growth.
//
// Modules:
//   Module 1  — Autonomous CEO™
//   Module 2  — Business Digital Twin™
//   Module 3  — Decision Engine™
//   Module 4  — Execution Engine™
//   Module 5  — Multi-Agent System™
//   Module 6  — Event Engine™
//   Module 7  — Prediction Lab™
//   Module 8  — Autonomous Workflows™
//   Module 9  — Learning Engine™
//   Module 10 — Command Center™
//   +         — Oracle Autonomous Personality™
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Shared primitives ────────────────────────────────────────────────────────

export type AbosRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const ABOS_RISK_GLYPH: Record<AbosRiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

export const ABOS_RISK_LABEL: Record<AbosRiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export type ExecutionStatus = 'detected' | 'planning' | 'executing' | 'completed' | 'monitoring' | 'failed' | 'idle';

export const EXEC_STATUS_GLYPH: Record<ExecutionStatus, string> = {
  detected: '👁️',
  planning: '🧠',
  executing: '⚙️',
  completed: '✅',
  monitoring: '📡',
  failed: '⚠️',
  idle: '⚪',
};

export const EXEC_STATUS_LABEL: Record<ExecutionStatus, string> = {
  detected: 'Detected',
  planning: 'Planning',
  executing: 'Executing',
  completed: 'Completed',
  monitoring: 'Monitoring',
  failed: 'Failed',
  idle: 'Idle',
};

// ─── Module 5: Multi-Agent System™ (defined first — referenced everywhere) ────

export type AbosAgentId =
  | 'ceo-agent'
  | 'cfo-agent'
  | 'gst-agent'
  | 'analyst-agent'
  | 'collections-agent'
  | 'compliance-agent'
  | 'growth-agent'
  | 'legal-agent';

export interface AbosAgent {
  id: AbosAgentId;
  name: string;
  emoji: string;
  role: string;
  tagline: string;
  expertise: string[];
  responsibilities: string[];
  status: 'monitoring' | 'working' | 'alert' | 'idle';
  currentTask?: string;
  activeWorkflows: number;
  completedToday: number;
  decisionsToday: number;
  lastAction?: string;
  collaboratesWith: AbosAgentId[];   // which other agents it handoffs to
}

// ─── Module 1: Autonomous CEO™ ────────────────────────────────────────────────

export interface AutonomousCEO {
  status: 'monitoring' | 'thinking' | 'executing' | 'learning';
  uptimeHours: number;                // continuous monitoring uptime
  cycleCount: number;                 // think-decide-execute cycles run today
  detectedProblems: DetectedProblem[];
  activePlans: CEOPlan[];
  executedActionsToday: number;
  learningLog: string[];              // what it learned today
  headline: string;                   // one-line CEO read of the business right now
  operatingMode: 'autonomous' | 'assisted' | 'monitoring';
}

export interface DetectedProblem {
  id: string;
  title: string;
  description: string;
  category: 'revenue' | 'cash' | 'collections' | 'compliance' | 'vendor' | 'notice' | 'profitability';
  severity: AbosRiskLevel;
  detectedAt: string;                 // ISO
  routedTo: AbosAgentId;
  status: ExecutionStatus;
  proposedAction: string;
}

export interface CEOPlan {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  ownerAgent: AbosAgentId;
  status: ExecutionStatus;
  progressPct: number;
  expectedOutcome: string;
}

// ─── Module 2: Business Digital Twin™ ─────────────────────────────────────────

export interface DigitalTwin {
  twinState: TwinSnapshot;            // current mirror of the business
  scenarios: WhatIfScenario[];        // pre-computed simulations
  description: string;
}

export interface TwinSnapshot {
  revenue: number;
  cash: number;
  gstLiability: number;
  netProfit: number;
  profitMarginPct: number;
  pendingCollections: number;
  employeeCount: number;
  vendorCount: number;
  healthScore: number;
}

export interface WhatIfScenario {
  id: string;
  title: string;
  emoji: string;
  question: string;                   // "What happens if sales fall 30%?"
  inputDelta: {                       // the perturbation applied
    label: string;
    value: string;                    // human-readable delta e.g. "-30%"
  };
  projection: TwinProjection;
  impactSummary: string;              // one-line plain-English outcome
  recommendation: string;
  confidencePct: number;
  riskAfter: AbosRiskLevel;
}

export interface TwinProjection {
  revenue: number;
  cash: number;
  gstLiability: number;
  netProfit: number;
  profitMarginPct: number;
  pendingCollections: number;
  runwayDays: number;
  deltas: {                           // change vs current twinState
    revenue: number;
    cash: number;
    netProfit: number;
    profitMarginPct: number;
  };
}

export interface SimulationRequest {
  type: 'revenue_change' | 'hire_employees' | 'gst_change' | 'cost_change' | 'vendor_change' | 'price_change';
  label: string;
  magnitudePct: number;               // signed % change
  detail?: string;
}

export interface SimulationResult extends WhatIfScenario {
  requestedBy: 'user' | 'system';
  simulatedAt: string;
}

// ─── Module 3: Decision Engine™ ───────────────────────────────────────────────

export type DecisionArea =
  | 'pricing'
  | 'hiring'
  | 'expansion'
  | 'cost_cutting'
  | 'tax_planning'
  | 'vendor_change'
  | 'collections_strategy';

export interface BusinessDecision {
  id: string;
  area: DecisionArea;
  title: string;
  headline: string;                   // one-line recommendation
  rationale: string;                  // WHY
  impact: string;                     // what changes
  impactMagnitudeINR: number;         // ₹ quantified impact (annualised where possible)
  confidencePct: number;              // 0–100
  risk: AbosRiskLevel;
  expectedROI: number;                // % expected return
  timeHorizon: '7d' | '30d' | '90d' | '1y';
  ownerAgent: AbosAgentId;
  actions: string[];                  // concrete next steps
  status: 'proposed' | 'approved' | 'executing' | 'completed';
  autoExecutable: boolean;            // can ABOS run it without approval?
}

// ─── Module 4: Execution Engine™ ──────────────────────────────────────────────

export type ExecutionCapability =
  | 'generate_report'
  | 'prepare_gst_return'
  | 'send_reminders'
  | 'schedule_meeting'
  | 'create_task'
  | 'assign_employee'
  | 'prepare_notice'
  | 'generate_forecast';

export interface ExecutionAction {
  id: string;
  capability: ExecutionCapability;
  title: string;
  description: string;
  status: ExecutionStatus;
  ownerAgent: AbosAgentId;
  triggeredBy: 'ceo' | 'event' | 'workflow' | 'user' | 'schedule';
  amountINR?: number;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  progressPct: number;
}

export interface ExecutionCapabilityStatus {
  capability: ExecutionCapability;
  label: string;
  emoji: string;
  enabled: boolean;                   // autonomy toggle
  runsToday: number;
  lastRun?: string;
  lastOutput?: string;
}

// ─── Module 6: Event Engine™ ──────────────────────────────────────────────────

export type EventTrigger =
  | 'gst_notice_received'
  | 'collections_drop'
  | 'revenue_falls'
  | 'vendor_failure'
  | 'gst_due_date'
  | 'cash_shortage'
  | 'itc_blocked'
  | 'client_churn';

export const TRIGGER_AGENT_MAP: Record<EventTrigger, AbosAgentId> = {
  gst_notice_received: 'compliance-agent',
  collections_drop: 'collections-agent',
  revenue_falls: 'cfo-agent',
  vendor_failure: 'growth-agent',
  gst_due_date: 'gst-agent',
  cash_shortage: 'cfo-agent',
  itc_blocked: 'compliance-agent',
  client_churn: 'growth-agent',
};

export interface NetworkEvent {
  id: string;
  trigger: EventTrigger;
  title: string;
  description: string;
  severity: AbosRiskLevel;
  firedAt: string;                    // ISO
  routedTo: AbosAgentId;             // which agent picked it up
  actionTaken: string;
  outcome?: string;
  status: ExecutionStatus;
  autoHandled: boolean;              // did ABOS handle without human?
}

// ─── Module 7: Prediction Lab™ ────────────────────────────────────────────────

export type PredictionMetric =
  | 'revenue'
  | 'cash_flow'
  | 'gst'
  | 'profit'
  | 'client_churn'
  | 'payment_delays'
  | 'growth';

export type PredictionHorizon = '7d' | '30d' | '90d' | '1y';

export const HORIZON_LABEL: Record<PredictionHorizon, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '1y': '1 Year',
};

export interface PredictionReading {
  value: number;                      // projected value
  unit: 'INR' | 'count' | 'pct';
  confidencePct: number;
  trend: 'up' | 'down' | 'stable';
  note: string;                       // plain-English driver
}

export interface PredictionMatrix {
  metric: PredictionMetric;
  label: string;
  emoji: string;
  unit: 'INR' | 'count' | 'pct';
  horizons: Record<PredictionHorizon, PredictionReading>;
  currentBaseline: number;
}

// ─── Module 8: Autonomous Workflows™ ──────────────────────────────────────────

export type WorkflowId =
  | 'collections_recovery'
  | 'gst_compliance'
  | 'cash_protection'
  | 'notice_response'
  | 'vendor_resilience'
  | 'growth_engine';

export interface WorkflowStep {
  order: number;
  title: string;
  detail: string;
  status: ExecutionStatus;
  ownerAgent: AbosAgentId;
  completedAt?: string;
}

export interface AutonomousWorkflow {
  id: WorkflowId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  status: 'running' | 'idle' | 'alert' | 'completed' | 'monitoring';
  enabled: boolean;
  steps: WorkflowStep[];
  lastRunAt?: string;
  nextRunAt?: string;
  runsToday: number;
  outcomeSummary?: string;
  impactINR?: number;                 // ₹ recovered / saved / generated
}

// ─── Module 9: Learning Engine™ ───────────────────────────────────────────────

export type LearnedFactType =
  | 'user_behavior'
  | 'business_routine'
  | 'filing_pattern'
  | 'payment_habit'
  | 'employee_performance'
  | 'successful_action'
  | 'client_pattern';

export interface LearnedFact {
  id: string;
  type: LearnedFactType;
  subject: string;                    // who/what it's about
  fact: string;                       // the learned statement
  evidence: string;                   // how we know
  confidencePct: number;
  observedCount: number;              // times observed
  firstSeen: string;
  lastSeen: string;
  actionable: boolean;                // can ABOS act on it?
}

export interface LearningMemory {
  facts: LearnedFact[];
  behaviourPatterns: string[];        // plain-English learned patterns
  successRate: number;                // % of autonomous actions that succeeded
  totalLearned: number;
  insights: string[];                 // higher-order insights
}

// ─── Module 10: Command Center™ (Morning Brief) ───────────────────────────────

export interface MorningBrief {
  greeting: string;
  userName: string;
  dateLabel: string;
  tagline: string;
  metrics: {
    revenue: number;
    cash: number;
    gst: number;
    collections: number;
  };
  riskLevel: AbosRiskLevel;
  riskLabel: string;
  forecastLabel: string;              // "Positive" / "Cautious" / "At Risk"
  todaysDecisions: MorningDecision[];
  generatedAt: string;
}

export interface MorningDecision {
  rank: number;
  text: string;
  amountINR?: number;
  ownerAgent: AbosAgentId;
  autoExecutable: boolean;
}

// ─── Oracle Autonomous Personality™ ───────────────────────────────────────────

export interface AbosPersonality {
  roles: string[];                    // CEO, CFO, COO, Analyst, Ops Manager, EA, AI Employees
  tagline: string;
  spokenBehaviours: string[];         // "I've prepared the return." etc.
  forbiddenPhrases: string[];
  operatingPrinciples: string[];
  successCriteria: string[];
}

// ─── Aggregated ABOS State ────────────────────────────────────────────────────

export interface AbosState {
  ceo: AutonomousCEO;
  digitalTwin: DigitalTwin;
  decisions: BusinessDecision[];
  execution: {
    capabilities: ExecutionCapabilityStatus[];
    recentActions: ExecutionAction[];
    executedToday: number;
    pendingToday: number;
  };
  agents: AbosAgent[];
  events: NetworkEvent[];
  predictions: PredictionMatrix[];
  workflows: AutonomousWorkflow[];
  learning: LearningMemory;
  morningBrief: MorningBrief;
  personality: AbosPersonality;
  generatedAt: string;
  hasLiveData: boolean;
  clientCount: number;
}

// ─── What-If presets (plain data — safe for client import) ────────────────────

export const WHATIF_PRESETS: SimulationRequest[] = [
  { type: 'revenue_change', label: 'Sales fall 30%', magnitudePct: -30 },
  { type: 'revenue_change', label: 'Sales rise 20%', magnitudePct: 20 },
  { type: 'hire_employees', label: 'Hire 5 employees', magnitudePct: 8, detail: '5 employees' },
  { type: 'gst_change', label: 'GST liability +25%', magnitudePct: 25 },
  { type: 'cost_change', label: 'Costs cut 15%', magnitudePct: -15 },
  { type: 'price_change', label: 'Prices raised 5%', magnitudePct: 5 },
];

