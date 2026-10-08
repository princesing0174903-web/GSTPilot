// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — TYPE DEFINITIONS
//
// The Autonomous Business Operating System. Oracle continuously monitors the
// business, recommends decisions, plans strategy, creates tasks, predicts risks,
// executes approved workflows — behaving like a world-class CEO.
//
// Tagline: "VEYRO AI CEO™ — Run Your Business. Not Your Software."
//
// Pure server-side TypeScript. No mock values. No placeholders. Every value
// flows from REAL connected business data via CFO Phase 1, Digital Twin, and
// the existing Business Graph / CRM / Banking / GST engines.
// ═══════════════════════════════════════════════════════════════════════════════

export const CEO_TAGLINE = 'VEYRO AI CEO™ — Run Your Business. Not Your Software.';
export const CEO_FOUNDER = 'VEYRO AI™ was founded, developed and owned by Prince Singh.';

// ─── 1. ROLES & SECURITY ─────────────────────────────────────────────────────

export type ExecutiveRole = 'ceo' | 'cfo' | 'manager' | 'employee' | 'auditor';

export type DecisionStatus =
  | 'pending'        // waiting for approval
  | 'approved'       // approved, not yet executed
  | 'rejected'       // rejected by an authorised role
  | 'executing'      // workflow is running
  | 'executed'       // workflow finished successfully
  | 'failed'         // workflow ran but failed
  | 'superseded'     // newer decision replaced this one
  | 'auto_approved'; // below risk threshold, executed automatically

export type DecisionPriority = 'critical' | 'high' | 'medium' | 'low';
export type DecisionRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ApprovalRequirement = 'none' | 'notify' | 'manager' | 'cfo' | 'ceo' | 'board';

// ─── 2. EXECUTIVE DECISION ENGINE™ ────────────────────────────────────────────

export type DecisionType =
  | 'recover_payment'
  | 'remind_client'
  | 'follow_up_lead'
  | 'increase_prices'
  | 'reduce_expenses'
  | 'pause_marketing'
  | 'increase_marketing'
  | 'delay_purchase'
  | 'pay_gst'
  | 'claim_itc'
  | 'hire_employees'
  | 'delay_hiring'
  | 'suggest_loan'
  | 'repay_loan'
  | 'optimize_cash'
  | 'reduce_vendor_dependency'
  | 'improve_collections'
  | 'improve_profitability'
  | 'improve_runway'
  | 'review_compliance'
  | 'review_expense'
  | 'approve_payroll'
  | 'renew_subscription'
  | 'review_contract'
  | 'pay_vendor'
  | 'reply_customer'
  | 'schedule_meeting'
  | 'file_overdue_return'
  | 'investigate_anomaly'
  | 'create_quotation';

export interface ExecutiveDecision {
  id: string;
  type: DecisionType;
  title: string;
  reason: string;
  financialImpact: number;
  financialImpactLabel: string;
  confidence: number;
  priority: DecisionPriority;
  risk: DecisionRisk;
  businessImpact: string;
  rollbackPlan: string;
  approvalRequired: ApprovalRequirement;
  requiresRole: ExecutiveRole;
  actions: DecisionAction[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  evidence: DecisionEvidence[];
  status: DecisionStatus;
  createdAt: string;
  expiresAt?: string;
  executedAt?: string;
  executedBy?: string;
  approvedBy?: string;
}

export interface DecisionAction {
  label: string;
  description: string;
  agent: string;
  estimatedMinutes: number;
  automated: boolean;
  destructive: boolean;
}

export interface DecisionEvidence {
  source: string;
  fact: string;
  value?: number;
}

// ─── 3. DAILY CEO BRIEF™ ─────────────────────────────────────────────────────

export interface DailyCEOBrief {
  generatedAt: string;
  greeting: string;
  asOfDay: string;
  executiveSummary: string;
  metrics: BriefMetrics;
  criticalRisks: BriefRiskItem[];
  todaysPriorities: BriefPriority[];
  meetings: BriefMeeting[];
  collections: BriefCollection[];
  gstDeadlines: BriefGSTDeadline[];
  bankBalance: BriefBankPosition;
  upcomingExpenses: BriefUpcomingExpense[];
  payrollStatus: BriefPayrollStatus;
  oracleRecommendations: BriefRecommendation[];
  topOpportunity: string;
  oneLiner: string;
}

export interface BriefMetrics {
  revenueMTD: number;
  profitMTD: number;
  cash: number;
  healthScore: number;
  riskScore: number;
  runwayDays: number;
  clients: number;
  receivables: number;
  payables: number;
  gstPayable: number;
}

export interface BriefRiskItem {
  title: string;
  severity: DecisionRisk;
  detail: string;
}

export interface BriefPriority {
  title: string;
  reason: string;
  deadline: string;
  impact: string;
  priority: DecisionPriority;
}

export interface BriefMeeting {
  title: string;
  at: string;
  with: string;
}

export interface BriefCollection {
  client: string;
  amount: number;
  daysOverdue: number;
  action: string;
}

export interface BriefGSTDeadline {
  returnType: string;
  period: string;
  dueDate: string;
  daysLeft: number;
  status: 'pending' | 'ready' | 'filed' | 'overdue';
}

export interface BriefBankPosition {
  totalBalance: number;
  accounts: { bank: string; balance: number; syncedAt: string | null }[];
}

export interface BriefUpcomingExpense {
  vendor: string;
  amount: number;
  dueIn: number;
  category: string;
}

export interface BriefPayrollStatus {
  nextRunDate: string;
  headcount: number;
  amount: number;
  status: 'scheduled' | 'processing' | 'paid' | 'unknown';
}

export interface BriefRecommendation {
  title: string;
  impact: string;
  priority: DecisionPriority;
}

// ─── 4. AUTONOMOUS TASK ENGINE™ ──────────────────────────────────────────────

export type TaskType =
  | 'recover_overdue'
  | 'file_gst'
  | 'reply_customer'
  | 'review_expense'
  | 'approve_payroll'
  | 'review_compliance'
  | 'renew_subscription'
  | 'review_contract'
  | 'pay_vendor'
  | 'follow_up_lead'
  | 'generate_invoice'
  | 'send_reminder'
  | 'schedule_meeting'
  | 'generate_report'
  | 'send_proposal'
  | 'create_quotation'
  | 'investigate_anomaly';

export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

export interface AutonomousTask {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  priority: DecisionPriority;
  deadline: string;
  owner: string;
  businessImpact: string;
  aiExplanation: string;
  status: TaskStatus;
  relatedDecisionId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
}

// ─── 5. AI STRATEGY ENGINE™ ──────────────────────────────────────────────────

export type StrategyStatus = 'proposed' | 'active' | 'on_track' | 'at_risk' | 'completed' | 'paused';

export interface Strategy {
  id: string;
  title: string;
  description: string;
  category: 'revenue' | 'expenses' | 'collections' | 'gst' | 'margin' | 'runway' | 'diversification' | 'growth';
  objectives: string[];
  milestones: StrategyMilestone[];
  kpis: StrategyKPI[];
  timeline: string;
  expectedROI: number;
  expectedROIPct: number;
  confidence: number;
  status: StrategyStatus;
  progressPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyMilestone {
  label: string;
  targetDate: string;
  status: 'pending' | 'in_progress' | 'done' | 'missed';
}

export interface StrategyKPI {
  name: string;
  baseline: number;
  target: number;
  current: number;
  unit: 'inr' | 'pct' | 'days' | 'count';
}

// ─── 6. EXECUTIVE ALERT SYSTEM™ ──────────────────────────────────────────────

export type AlertType =
  | 'cash_shortage'
  | 'compliance_risk'
  | 'fraud_suspected'
  | 'revenue_drop'
  | 'profit_decline'
  | 'customer_churn'
  | 'vendor_risk'
  | 'payroll_issue'
  | 'gst_issue'
  | 'bank_anomaly'
  | 'collections_problem'
  | 'inventory_issue'
  | 'anomaly_detected';

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface ExecutiveAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  detectedAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  suggestedDecisionType?: DecisionType;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

// ─── 7. AUTONOMOUS WORKFLOW ENGINE™ ──────────────────────────────────────────

export type WorkflowType =
  | 'send_reminder'
  | 'generate_invoice'
  | 'schedule_meeting'
  | 'create_follow_up'
  | 'generate_report'
  | 'send_proposal'
  | 'create_quotation'
  | 'assign_task';

export interface AutonomousWorkflow {
  type: WorkflowType;
  label: string;
  description: string;
  destructive: boolean;
  steps: string[];
  requiresApproval: ApprovalRequirement;
  requiresRole: ExecutiveRole;
  estimatedMinutes: number;
}

export interface WorkflowExecutionResult {
  workflowType: WorkflowType;
  decisionId: string;
  status: 'queued' | 'executing' | 'completed' | 'failed' | 'awaiting_approval';
  message: string;
  startedAt: string;
  completedAt?: string;
  outputs?: Record<string, unknown>;
}

// ─── 8. BOARD MEETING MODE™ ──────────────────────────────────────────────────

export interface BoardReport {
  generatedAt: string;
  period: string;
  financialSummary: BoardFinancialSummary;
  growth: BoardGrowthSection;
  forecast: BoardForecastSection;
  businessHealth: BoardHealthSection;
  majorRisks: BoardRiskItem[];
  departmentPerformance: BoardDepartmentPerformance[];
  recommendations: string[];
  futureStrategy: string[];
  executiveSummary: string;
}

export interface BoardFinancialSummary {
  revenue: number;
  revenueChangePct: number;
  profit: number;
  profitChangePct: number;
  cash: number;
  cashChangePct: number;
  gstPaid: number;
  receivables: number;
  payables: number;
  ebitda: number;
}

export interface BoardGrowthSection {
  revenueGrowthPct: number;
  clientGrowthPct: number;
  newClients: number;
  churnedClients: number;
  headcount: number;
  headcountChange: number;
}

export interface BoardForecastSection {
  next30dRevenue: number;
  next90dRevenue: number;
  next30dCash: number;
  next30dProfit: number;
  confidencePct: number;
}

export interface BoardHealthSection {
  overallScore: number;
  tier: string;
  topDrivers: string[];
  topDrags: string[];
}

export interface BoardRiskItem {
  title: string;
  severity: DecisionRisk;
  mitigation: string;
}

export interface BoardDepartmentPerformance {
  department: string;
  metric: string;
  value: string;
  status: 'green' | 'amber' | 'red';
}

// ─── 9. BUSINESS GOALS™ ──────────────────────────────────────────────────────

export type GoalCategory =
  | 'revenue'
  | 'profit'
  | 'collections'
  | 'gst_compliance'
  | 'customer_growth'
  | 'employee_growth'
  | 'runway'
  | 'market_expansion';

export interface BusinessGoal {
  id: string;
  category: GoalCategory;
  title: string;
  description: string;
  baseline: number;
  current: number;
  target: number;
  unit: 'inr' | 'pct' | 'days' | 'count';
  deadline: string;
  progressPct: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved' | 'overdue';
  trendPct: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 10. CEO MEMORY™ ─────────────────────────────────────────────────────────

export type MemoryType =
  | 'decision'
  | 'strategy'
  | 'milestone'
  | 'board_meeting'
  | 'market_change'
  | 'growth_event'
  | 'risk_event'
  | 'learning';

export interface CEOMemory {
  id: string;
  memoryType: MemoryType;
  title: string;
  description: string;
  importance: number;
  occurredAt: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

// ─── 11. EXECUTIVE DASHBOARD BUNDLE ──────────────────────────────────────────

export interface CEODashboard {
  generatedAt: string;
  hasLiveData: boolean;
  dataSources: string[];
  role: ExecutiveRole;
  liveState: CEOLiveState;
  decisions: ExecutiveDecision[];
  pendingDecisionCount: number;
  brief: DailyCEOBrief | null;
  alerts: ExecutiveAlert[];
  activeAlertCount: number;
  criticalAlertCount: number;
  strategies: Strategy[];
  activeStrategyCount: number;
  tasks: AutonomousTask[];
  openTaskCount: number;
  goals: BusinessGoal[];
  workflows: AutonomousWorkflow[];
  memory: CEOMemory[];
  boardReport: BoardReport | null;
  healthScore: number;
  riskScore: number;
  cashPosition: number;
  runwayDays: number;
  topDecision: ExecutiveDecision | null;
  topAlert: ExecutiveAlert | null;
  tagline: string;
}

export interface CEOLiveState {
  revenue: number;
  profit: number;
  cash: number;
  workingCapital: number;
  gstPayable: number;
  itc: number;
  receivables: number;
  payables: number;
  expenses: number;
  payroll: number;
  employees: number;
  clients: number;
  vendors: number;
  healthScore: number;
  riskScore: number;
  compliance: number;
  runwayDays: number;
  burnRate: number;
  forecastRevenue30d: number;
  forecastCash30d: number;
  forecastConfidencePct: number;
}

// ─── 12. ORACLE CEO CONTEXT (compact, for chat route) ────────────────────────

export interface CEOOracleContext {
  hasLiveData: boolean;
  dataSources: string[];
  healthScore: number;
  riskScore: number;
  cash: number;
  revenueMTD: number;
  profitMTD: number;
  runwayDays: number;
  pendingDecisions: number;
  criticalAlerts: number;
  openTasks: number;
  activeStrategies: number;
  topDecisionTitle: string | null;
  topAlertTitle: string | null;
  briefOneLiner: string | null;
}

// ─── 13. APPROVAL / EXECUTE REQUESTS ─────────────────────────────────────────

export interface ApproveRequest {
  decisionId: string;
  role: ExecutiveRole;
  userId?: string;
  comment?: string;
}

export interface RejectRequest extends ApproveRequest {
  reason?: string;
}

export interface ExecuteRequest {
  decisionId: string;
  role: ExecutiveRole;
  userId?: string;
  workflowType?: WorkflowType;
}

export interface ApproveResult {
  decisionId: string;
  status: DecisionStatus;
  message: string;
  workflowResult?: WorkflowExecutionResult;
  approvedAt: string;
}

export interface RejectResult {
  decisionId: string;
  status: DecisionStatus;
  message: string;
  rejectedAt: string;
}

export interface ExecuteResult {
  decisionId: string;
  status: DecisionStatus;
  message: string;
  workflowResult: WorkflowExecutionResult;
  executedAt: string;
}
