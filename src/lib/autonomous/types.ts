// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — TYPE DEFINITIONS
//
// The World's First Autonomous Enterprise Operating System. AI doesn't just
// recommend — it plans, decides, executes, monitors, learns & continuously
// improves every business operation from REAL connected data.
//
// Tagline: VEYRO Infinity™ — Think. Decide. Execute. Learn. Grow.
//
// Pure server-side TypeScript. No mock values. No placeholders. Every value
// flows from REAL connected business data via AI CFO Phase 1, Digital Twin,
// Business Graph, AI CEO, and the existing CRM / Banking / GST engines.
// ═══════════════════════════════════════════════════════════════════════════════

export const AUTONOMOUS_TAGLINE =
  'VEYRO Infinity™ — The World\'s First Autonomous Enterprise Operating System.';
export const AUTONOMOUS_SUBTAGLINE = 'Think. Decide. Execute. Learn. Grow.';
export const AUTONOMOUS_FOUNDER =
  'VEYRO AI™ was founded, developed and owned by Prince Singh.';

// ─── 1. NINE AI EXECUTIVES ───────────────────────────────────────────────────

export type ExecutiveId =
  | 'ceo'
  | 'cfo'
  | 'coo'
  | 'cto'
  | 'cro'
  | 'legal'
  | 'hr'
  | 'marketing'
  | 'operations';

export interface ExecutiveAgent {
  id: ExecutiveId;
  name: string;
  title: string;
  emoji: string;
  mandate: string;
  decisionDomains: string[];
  metrics: ExecutiveMetrics;
}

export interface ExecutiveMetrics {
  decisionsLast30d: number;
  approvalsLast30d: number;
  autoExecutedLast30d: number;
  avgConfidence: number;
  avgRiskScore: number;
  activeTasks: number;
}

// ─── 2. EXECUTIVE OPINION (Strategy Room) ────────────────────────────────────

export interface ExecutiveOpinion {
  executive: ExecutiveId;
  stance: 'support' | 'oppose' | 'caution' | 'neutral';
  opinion: string;
  reasoning: string;
  financialImpact: number;
  riskLevel: RiskLevel;
  confidence: number; // 0..1
  conditions?: string[];
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

// ─── 3. STRATEGY ROOM MEETING ────────────────────────────────────────────────

export interface StrategyMeeting {
  id: string;
  topic: string;
  trigger: MeetingTrigger;
  opinions: ExecutiveOpinion[];
  disagreements: string[];
  consensus: string;
  ceoApproval: 'pending' | 'approved' | 'rejected' | 'deferred';
  financialImpact: number;
  riskLevel: RiskLevel;
  confidence: number;
  status: 'opened' | 'debating' | 'completed' | 'archived';
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
}

export type MeetingTrigger =
  | 'scheduled'
  | 'anomaly'
  | 'decision'
  | 'goal_review'
  | 'risk_alert'
  | 'opportunity';

// ─── 4. AUTONOMOUS DECISION ──────────────────────────────────────────────────

export interface AutonomousDecision {
  id: string;
  type: string;
  title: string;
  reason: string;
  businessReasoning: string;
  riskScore: number; // 0..100
  riskLevel: RiskLevel;
  expectedROI: number;
  expectedROIPct: number;
  confidence: number; // 0..1
  supportingEvidence: DecisionEvidence[];
  rollbackStrategy: string;
  approvalRequired: 'none' | 'notify' | 'manager' | 'cfo' | 'ceo' | 'board';
  proposedBy: ExecutiveId;
  collaborators: ExecutiveId[];
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed' | 'auto_approved';
  financialImpact: number;
  financialImpactLabel: string;
  actions: AutonomousAction[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  createdAt: string;
  executedAt?: string;
  approvedBy?: string;
}

export interface DecisionEvidence {
  source: string;
  fact: string;
  value?: number;
}

export interface AutonomousAction {
  label: string;
  description: string;
  agent: string;
  estimatedMinutes: number;
  automated: boolean;
  destructive: boolean;
}

// ─── 5. AUTONOMOUS WORKFLOW (action chains) ──────────────────────────────────

export interface AutonomousWorkflow {
  id: string;
  name: string;
  type: string;
  trigger: string;
  steps: WorkflowStep[];
  currentStep: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'aborted';
  context?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface WorkflowStep {
  stage: string;
  action: string;
  agent: string;
  automated: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface WorkflowTemplate {
  type: string;
  name: string;
  trigger: string;
  description: string;
  steps: { stage: string; action: string; agent: string; automated: boolean }[];
}

// ─── 6. CONTINUOUS PLANNING ──────────────────────────────────────────────────

export type PlanHorizon = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface ContinuousPlan {
  id: string;
  horizon: PlanHorizon;
  asOfDate: string;
  title: string;
  summary: string;
  focusAreas: string[];
  initiatives: PlanInitiative[];
  kpis: PlanKPI[];
  risks: string[];
  department?: string;
  confidence: number;
  generatedAt: string;
}

export interface PlanInitiative {
  title: string;
  owner: ExecutiveId;
  deadline: string;
  impact: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface PlanKPI {
  name: string;
  current: number;
  target: number;
  unit: string;
}

// ─── 7. GOAL ENGINE ──────────────────────────────────────────────────────────

export interface AutonomousGoal {
  id: string;
  category: string;
  title: string;
  description: string;
  baseline: number;
  current: number;
  target: number;
  unit: string;
  deadline: string;
  progressPct: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'overdue';
  trendPct: number;
  owner: ExecutiveId;
  reasoning: string;
}

// ─── 8. DIGITAL TWIN SIMULATOR 2.0 ───────────────────────────────────────────

export type SimulationScenario =
  | 'hire_employees'
  | 'increase_prices'
  | 'expand_city'
  | 'launch_product'
  | 'acquire_company'
  | 'open_office'
  | 'raise_funding'
  | 'cut_costs'
  | 'delay_payment'
  | 'switch_vendor';

export interface SimulationParameters {
  headcount?: number;
  priceChangePct?: number;
  city?: string;
  productName?: string;
  acquisitionTarget?: string;
  officeLocation?: string;
  fundingAmount?: number;
  costCutPct?: number;
  delayDays?: number;
  vendorName?: string;
}

export interface SimulationPrediction {
  revenue: number;
  profit: number;
  cashFlow: number;
  gst: number;
  risk: number;
  hiring: number;
  compliance: number;
  roi: number;
  roiPct: number;
  runwayDays: number;
  breakEvenMonths: number;
}

export interface StrategySimulation {
  id: string;
  scenario: SimulationScenario;
  title: string;
  description: string;
  parameters: SimulationParameters;
  baseline: Record<string, number>;
  predictions: SimulationPrediction;
  confidence: number;
  recommendation: 'proceed' | 'caution' | 'avoid' | 'needs_review';
  status: 'queued' | 'running' | 'completed' | 'failed';
  approvedBy?: string;
  createdAt: string;
}

// ─── 9. ENTERPRISE MEMORY ────────────────────────────────────────────────────

export interface EnterpriseMemoryEntry {
  id: string;
  source: 'decision' | 'approval' | 'interaction' | 'conversation' | 'report' | 'strategy' | 'simulation' | 'prediction' | 'workflow' | 'meeting' | 'alert' | 'learning';
  title: string;
  description: string;
  importance: number; // 0..1
  occurredAt: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

// ─── 10. AUTONOMOUS ALERTS ───────────────────────────────────────────────────

export type AlertCategory =
  | 'fraud'
  | 'cash_shortage'
  | 'compliance_risk'
  | 'gst_notice'
  | 'customer_churn'
  | 'vendor_dependency'
  | 'employee_overload'
  | 'security_threat'
  | 'growth_opportunity'
  | 'tax_savings'
  | 'collection_risk';

export interface AutonomousAlert {
  id: string;
  category: AlertCategory;
  title: string;
  message: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  suggestedAction: string;
  acknowledged: boolean;
}

// ─── 11. SELF-HEALING ────────────────────────────────────────────────────────

export interface SystemHealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'down' | 'recovering';
  latencyMs: number;
  detail: string;
  lastIncident?: string;
}

export interface SelfHealingEvent {
  id: string;
  component: string;
  failure: string;
  recoveryAction: string;
  status: 'retried' | 'failed_over' | 'recovered' | 'rolled_back' | 'escalated';
  resolvedAt: string;
  occurredAt: string;
}

// ─── 12. VOICE EXECUTION ─────────────────────────────────────────────────────

export interface VoiceCommand {
  raw: string;
  intent: string;
  parameters: Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  plan: VoiceCommandStep[];
}

export interface VoiceCommandStep {
  agent: string;
  action: string;
  description: string;
  automated: boolean;
}

// ─── 13. LEARNING ENGINE ─────────────────────────────────────────────────────

export interface LearningInsight {
  category: string;
  insight: string;
  evidence: number;
  confidence: number;
  impact: string;
  appliedTo: string;
}

// ─── 14. EXECUTIVE COMMAND CENTER DASHBOARD ──────────────────────────────────

export interface AutonomousDashboard {
  generatedAt: string;
  hasLiveData: boolean;
  dataSources: string[];
  tagline: string;
  founder: string;
  // Company observation
  observation: CompanyObservation;
  // Live command center metrics
  commandCenter: CommandCenterMetrics;
  // 9 executives
  executives: ExecutiveAgent[];
  // Decisions (live + recent persisted)
  decisions: AutonomousDecision[];
  pendingApprovals: number;
  // Strategy room
  recentMeetings: StrategyMeeting[];
  // Continuous planning
  plans: ContinuousPlan[];
  // Goals
  goals: AutonomousGoal[];
  // Workflows
  activeWorkflows: AutonomousWorkflow[];
  workflowTemplates: WorkflowTemplate[];
  // Simulations
  recentSimulations: StrategySimulation[];
  // Memory
  memoryStats: { total: number; bySource: Record<string, number> };
  // Alerts
  alerts: AutonomousAlert[];
  // Learning
  learnings: LearningInsight[];
  // Self-healing
  systemHealth: SystemHealthCheck[];
  recentHealingEvents: SelfHealingEvent[];
  // Execution stats
  executionStats: ExecutionStats;
}

export interface CompanyObservation {
  evaluatedAt: string;
  revenue: number;
  expenses: number;
  gst: number;
  cash: number;
  banking: number;
  payroll: number;
  compliance: number;
  sales: number;
  receivables: number;
  payables: number;
  clients: number;
  vendors: number;
  employees: number;
  aiEmployees: number;
  risks: number;
  healthScore: number;
  runwayDays: number;
  burnRate: number;
  notes: string[];
}

export interface CommandCenterMetrics {
  revenue: number;
  profit: number;
  cash: number;
  gst: number;
  compliance: number;
  sales: number;
  customers: number;
  employees: number;
  aiWorkforce: number;
  tasks: number;
  risks: number;
  predictions: number;
  approvals: number;
  alerts: number;
  companyHealthScore: number;
  autonomousActionsToday: number;
  decisionsToday: number;
}

export interface ExecutionStats {
  totalDecisions: number;
  autoExecuted: number;
  approvedExecuted: number;
  rejected: number;
  pending: number;
  successRate: number;
  avgRiskScore: number;
  avgConfidence: number;
  avgROI: number;
}

// ─── 15. EXECUTE / APPROVE REQUESTS ──────────────────────────────────────────

export interface ExecuteRequest {
  decisionId?: string;
  command?: string; // voice command
  role?: string;
  userId?: string;
}

export interface SimulateRequest {
  scenario: SimulationScenario;
  parameters?: SimulationParameters;
}

export interface ApprovalRequest {
  decisionId: string;
  role?: string;
  userId?: string;
  note?: string;
}
