// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — TYPE DEFINITIONS
//
// The Autonomous AI Employee Ecosystem. Oracle evolves from a single AI CEO
// into an entire AI Company — a hierarchy of specialized AI Employees that
// continuously collaborate to run the business.
//
// Tagline: "VEYRO AI Workforce™ — Don't just use AI. Build an AI Company."
//
// Pure server-side TypeScript. No mock values. No placeholders. Every value
// flows from REAL connected business data via AI CEO™, AI CFO™, Digital Twin™,
// Business Graph™, CRM™, Banking™, GST™, Reports™, Automation™, and Knowledge
// Graph™.
// ═══════════════════════════════════════════════════════════════════════════════

export const WORKFORCE_TAGLINE = 'VEYRO AI Workforce™ — Don\'t just use AI. Build an AI Company.';
export const WORKFORCE_FOUNDER = 'VEYRO AI™ was founded, developed and owned by Prince Singh.';

// ─── 1. AI ORGANIZATION™ — ROLES & HIERARCHY ────────────────────────────────

export type EmployeeRole =
  | 'ceo'
  | 'cfo'
  | 'coo'
  | 'cto'
  | 'cmo'
  | 'chro'
  | 'sales_manager'
  | 'marketing_manager'
  | 'finance_manager'
  | 'compliance_manager'
  | 'support_manager'
  | 'operations_manager'
  | 'data_analyst'
  | 'risk_manager'
  | 'procurement_manager'
  | 'legal_advisor'
  | 'customer_success';

export type Department =
  | 'executive'
  | 'finance'
  | 'operations'
  | 'sales'
  | 'marketing'
  | 'compliance'
  | 'risk'
  | 'legal'
  | 'hr'
  | 'support'
  | 'procurement'
  | 'technology'
  | 'data';

export type EmployeeStatus =
  | 'active'
  | 'idle'
  | 'reviewing'
  | 'deciding'
  | 'executing'
  | 'collaborating'
  | 'offline';

export type EmployeeTier = 'c_suite' | 'director' | 'manager' | 'analyst' | 'advisor';

export interface AIEmployee {
  role: EmployeeRole;
  name: string;
  title: string;
  department: Department;
  tier: EmployeeTier;
  reportsTo: EmployeeRole | null;
  directReports: EmployeeRole[];
  status: EmployeeStatus;
  healthScore: number;
  avatarColor: string;
  icon: string;
  responsibilities: string[];
  monitors: string[];
  kpis: EmployeeKPI[];
  openTaskCount: number;
  activeAlertCount: number;
  pendingDecisionCount: number;
  recommendations: EmployeeRecommendation[];
  performance: EmployeePerformance;
  recentMemory: EmployeeMemoryEntry[];
  skills: EmployeeSkill[];
  lastActiveAt: string;
  dataSources: string[];
  hasLiveData: boolean;
}

export interface EmployeeKPI {
  name: string;
  value: number;
  unit: 'inr' | 'pct' | 'days' | 'count' | 'ratio';
  target?: number;
  trendPct?: number;
  status?: 'green' | 'amber' | 'red';
  source: string;
}

export interface EmployeeRecommendation {
  title: string;
  rationale: string;
  impact: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedValue?: number;
  suggestedAction?: string;
}

// ─── 2. AI COLLABORATION ENGINE™ ─────────────────────────────────────────────

export type CollaborationMessageType =
  | 'handoff'
  | 'approval_request'
  | 'alert'
  | 'update'
  | 'decision'
  | 'insight'
  | 'escalation';

export type CollaborationStatus = 'sent' | 'acknowledged' | 'acted_on' | 'completed' | 'blocked';

export interface CollaborationMessage {
  id: string;
  from: EmployeeRole;
  to: EmployeeRole;
  type: CollaborationMessageType;
  subject: string;
  body: string;
  status: CollaborationStatus;
  timestamp: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
  chainId?: string;
  departmentContext?: string;
}

export interface CollaborationChain {
  id: string;
  title: string;
  trigger: string;
  steps: CollaborationChainStep[];
  status: 'in_progress' | 'completed' | 'blocked';
  startedAt: string;
  completedAt?: string;
  businessImpact: string;
}

export interface CollaborationChainStep {
  order: number;
  role: EmployeeRole;
  action: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'skipped';
  completedAt?: string;
  output?: string;
}

// ─── 3. AI MEETING ENGINE™ ───────────────────────────────────────────────────

export type MeetingType =
  | 'daily_standup'
  | 'weekly_leadership'
  | 'monthly_board'
  | 'quarterly_strategy'
  | 'annual_planning';

export interface AIMeeting {
  id: string;
  type: MeetingType;
  title: string;
  scheduledFor: string;
  attendees: EmployeeRole[];
  agenda: MeetingAgendaItem[];
  insights: string[];
  risks: MeetingRisk[];
  kpis: MeetingKPI[];
  actionItems: MeetingActionItem[];
  minutes: string;
  executiveSummary: string;
  generatedAt: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  dataSources: string[];
}

export interface MeetingAgendaItem {
  topic: string;
  owner: EmployeeRole;
  duration: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MeetingRisk {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  owner: EmployeeRole;
  mitigation: string;
}

export interface MeetingKPI {
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  owner: EmployeeRole;
}

export interface MeetingActionItem {
  task: string;
  owner: EmployeeRole;
  deadline: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'done';
}

// ─── 4. CROSS-DEPARTMENT DECISION ENGINE™ ────────────────────────────────────

export type CrossDecisionStatus =
  | 'proposed'
  | 'step_1_approved'
  | 'step_2_approved'
  | 'fully_approved'
  | 'executing'
  | 'executed'
  | 'rejected'
  | 'superseded';

export interface CrossDepartmentDecision {
  id: string;
  title: string;
  description: string;
  initiatedBy: EmployeeRole;
  trigger: string;
  financialImpact: number;
  businessImpact: string;
  steps: CrossDecisionStep[];
  currentStepIndex: number;
  status: CrossDecisionStatus;
  confidence: number;
  createdAt: string;
  executedAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface CrossDecisionStep {
  order: number;
  role: EmployeeRole;
  action: string;
  approvalType: 'review' | 'approve' | 'execute' | 'notify';
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'executed';
  approvedAt?: string;
  approvedBy?: string;
  comment?: string;
}

// ─── 5. AI PERFORMANCE ENGINE™ ───────────────────────────────────────────────

export interface EmployeePerformance {
  role: EmployeeRole;
  accuracy: number;
  speed: number;
  businessImpact: number;
  roiGenerated: number;
  tasksCompleted: number;
  revenueInfluenced: number;
  costSaved: number;
  automationSuccess: number;
  confidence: number;
  learningProgress: number;
  overallScore: number;
  rank: number;
  trendPct: number;
  period: string;
}

export interface PerformanceLeaderboardEntry {
  role: EmployeeRole;
  name: string;
  department: Department;
  overallScore: number;
  rank: number;
  highlight: string;
  roiGenerated: number;
  tasksCompleted: number;
}

// ─── 6. AI MEMORY™ ───────────────────────────────────────────────────────────

export type EmployeeMemoryType =
  | 'decision'
  | 'conversation'
  | 'mistake'
  | 'success'
  | 'outcome'
  | 'strategy'
  | 'meeting'
  | 'learning'
  | 'risk_event'
  | 'milestone';

export interface EmployeeMemoryEntry {
  id: string;
  role: EmployeeRole;
  memoryType: EmployeeMemoryType;
  title: string;
  description: string;
  importance: number;
  occurredAt: string;
  tags: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
}

// ─── 7. AI SKILLS™ ───────────────────────────────────────────────────────────

export type SkillCategory =
  | 'tax'
  | 'sales'
  | 'marketing'
  | 'support'
  | 'compliance'
  | 'operations'
  | 'finance'
  | 'legal'
  | 'technology'
  | 'hr';

export interface EmployeeSkill {
  role: EmployeeRole;
  name: string;
  category: SkillCategory;
  level: number;
  lastUpdated: string;
  learningsCount: number;
  recentInsight: string;
  trend: 'improving' | 'stable' | 'declining';
}

// ─── 8. AI MARKETPLACE™ ──────────────────────────────────────────────────────

export type MarketplaceIndustry =
  | 'manufacturing'
  | 'healthcare'
  | 'construction'
  | 'retail'
  | 'education'
  | 'hotel'
  | 'logistics'
  | 'restaurant'
  | 'legal'
  | 'chartered_accountant'
  | 'auditor'
  | 'real_estate'
  | 'agriculture'
  | 'fintech';

export interface MarketplaceEmployee {
  id: string;
  name: string;
  industry: MarketplaceIndustry;
  title: string;
  description: string;
  capabilities: string[];
  department: Department;
  installed: boolean;
  rating: number;
  installCount: number;
  icon: string;
  estimatedRoi: string;
}

// ─── 9. DEPARTMENT DASHBOARD ─────────────────────────────────────────────────

export interface DepartmentDashboard {
  department: Department;
  name: string;
  lead: EmployeeRole;
  members: EmployeeRole[];
  healthScore: number;
  kpis: EmployeeKPI[];
  goals: DepartmentGoal[];
  openTasks: number;
  alerts: number;
  aiDecisions: number;
  recommendations: EmployeeRecommendation[];
  budgetUtilizationPct?: number;
  status: 'green' | 'amber' | 'red';
}

export interface DepartmentGoal {
  title: string;
  current: number;
  target: number;
  unit: 'inr' | 'pct' | 'days' | 'count';
  progressPct: number;
  deadline: string;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved';
}

// ─── 10. HUMAN + AI MANAGEMENT™ ──────────────────────────────────────────────

export type ManagementRole = 'ceo' | 'cfo' | 'manager' | 'employee' | 'auditor';

export type DelegationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'escalated'
  | 'overridden';

export interface Delegation {
  id: string;
  from: EmployeeRole;
  to: ManagementRole;
  toUserId?: string;
  task: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline: string;
  status: DelegationStatus;
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
  aiConfidence: number;
  businessImpact: string;
  canOverride: boolean;
}

export interface Escalation {
  id: string;
  fromRole: EmployeeRole;
  toRole: EmployeeRole;
  reason: string;
  subject: string;
  severity: 'high' | 'medium' | 'low';
  createdAt: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

// ─── 11. WORKFORCE DASHBOARD BUNDLE ──────────────────────────────────────────

export interface WorkforceDashboard {
  generatedAt: string;
  hasLiveData: boolean;
  dataSources: string[];
  organization: AIEmployee[];
  departmentCount: number;
  activeEmployeeCount: number;
  departments: DepartmentDashboard[];
  collaborationFeed: CollaborationMessage[];
  activeChains: CollaborationChain[];
  meetings: AIMeeting[];
  crossDecisions: CrossDepartmentDecision[];
  pendingCrossDecisionCount: number;
  performance: PerformanceLeaderboardEntry[];
  topEmployee: PerformanceLeaderboardEntry | null;
  topCollaboration: CollaborationChain | null;
  marketplace: MarketplaceEmployee[];
  installedMarketplaceCount: number;
  delegations: Delegation[];
  openDelegationCount: number;
  escalations: Escalation[];
  openEscalationCount: number;
  aggregateMetrics: WorkforceAggregateMetrics;
  oracleCapabilities: string[];
  tagline: string;
}

export interface WorkforceAggregateMetrics {
  totalEmployees: number;
  activeEmployees: number;
  totalTasksCompleted: number;
  totalDecisions: number;
  totalROIGenerated: number;
  totalRevenueInfluenced: number;
  totalCostSaved: number;
  automationRatePct: number;
  avgHealthScore: number;
  collaborationMessagesToday: number;
  meetingsThisWeek: number;
  activeCrossDecisions: number;
}

// ─── 12. ORACLE WORKFORCE CONTEXT ────────────────────────────────────────────

export interface WorkforceOracleContext {
  hasLiveData: boolean;
  dataSources: string[];
  totalEmployees: number;
  activeEmployees: number;
  avgHealthScore: number;
  departmentsGreen: number;
  departmentsRed: number;
  collaborationMessagesToday: number;
  pendingCrossDecisions: number;
  openDelegations: number;
  topEmployeeName: string | null;
  topEmployeeScore: number;
  topCollaborationTitle: string | null;
  nextMeetingTitle: string | null;
  nextMeetingType: MeetingType | null;
  aggregateROI: number;
  automationRatePct: number;
}

// ─── 13. API REQUEST / RESULT TYPES ──────────────────────────────────────────

export interface ApproveWorkforceRequest {
  decisionId: string;
  role: ManagementRole;
  userId?: string;
  comment?: string;
  stepIndex?: number;
}

export interface ExecuteWorkforceRequest {
  decisionId: string;
  role: ManagementRole;
  userId?: string;
  workflowType?: string;
}

export interface DelegateRequest {
  from: EmployeeRole;
  to: ManagementRole;
  toUserId?: string;
  task: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline: string;
  businessImpact: string;
  aiConfidence: number;
}

export interface ApproveWorkforceResult {
  decisionId: string;
  status: CrossDecisionStatus;
  message: string;
  currentStepIndex: number;
  approvedAt: string;
}

export interface ExecuteWorkforceResult {
  decisionId: string;
  status: CrossDecisionStatus;
  message: string;
  executedAt: string;
  outputs?: Record<string, unknown>;
}

export interface DelegateResult {
  delegationId: string;
  status: DelegationStatus;
  message: string;
  createdAt: string;
}
