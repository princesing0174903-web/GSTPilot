// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — INFINITY AGI™ (AUTONOMOUS ENTERPRISE INTELLIGENCE)
// Type System — shared by all AGI subsystems.
//
// The World's First Enterprise AGI Operating System. Oracle becomes the
// autonomous intelligence that can understand, reason, decide, execute, learn,
// coordinate, and continuously improve an entire enterprise.
//
// One Intelligence. Every Decision. Entire Enterprise. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

export const AGI_TAGLINE = 'GSTPilot Infinity™ — Infinity AGI™';
export const AGI_SUBTAGLINE = 'One Intelligence. Every Decision. Entire Enterprise.';
export const AGI_FOUNDER = 'GSTPilot Infinity™ was founded, developed and owned by Prince Singh.';

// ─── 1. Enterprise AGI Core™ — integrated capability surface ─────────────────
// Every existing system becomes a capability of the AGI.

export type AGICapability =
  | 'oracle_intelligence' | 'business_graph' | 'knowledge_graph'
  | 'digital_twin' | 'execution_cloud' | 'compliance_cloud'
  | 'data_intelligence' | 'command_network' | 'global_enterprise'
  | 'ai_software_factory' | 'crm' | 'banking' | 'gst' | 'payroll'
  | 'marketplace' | 'autonomous_enterprise' | 'ceo' | 'cfo' | 'coo'
  | 'cto' | 'cro' | 'hr' | 'legal' | 'marketing' | 'operations';

export interface AGICapabilitySurface {
  capability: AGICapability;
  label: string;
  role: string;                          // what this capability contributes to the AGI
  status: 'online' | 'degraded' | 'offline';
  signalsLastCycle: number;              // data signals the AGI pulled last cycle
  decisionsContributed: number;          // decisions this capability informed
  lastSync: string | null;
}

export interface AGICoreState {
  totalCapabilities: number;
  onlineCapabilities: number;
  totalSignals: number;                  // sum of signalsLastCycle
  totalDecisionsContributed: number;
  capabilityGraph: AGICapabilitySurface[];
  reasoningEngine: {
    status: 'active' | 'idle' | 'paused' | 'shutdown';
    cyclesToday: number;
    avgCycleMs: number;
    lastCycleAt: string | null;
  };
  safetyState: {
    emergencyShutdown: boolean;
    guardrailsActive: boolean;
    humanApprovalQueue: number;
    rolledBackActions: number;
  };
}

// ─── 2. Continuous Autonomous Reasoning™ ─────────────────────────────────────
// Oracle reasons continuously — not only when asked.

export type ReasoningTrigger =
  | 'scheduled' | 'anomaly' | 'goal_review' | 'incident'
  | 'opportunity' | 'human';

export type ReasoningFocus =
  | 'health' | 'opportunity' | 'risk' | 'failure'
  | 'growth' | 'planning' | 'prioritization';

export interface AGIConclusion {
  focus: ReasoningFocus;
  finding: string;                       // what Oracle concluded
  supportingEvidence: string[];          // data points that support it
  proposedActions: string[];             // actions Oracle proposes
  confidence: number;                    // 0-1
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReasoningCycle {
  id: string;
  cycleNumber: number;
  trigger: ReasoningTrigger;
  focus: ReasoningFocus;
  observation: ReasoningObservation;     // enterprise snapshot reasoned over
  reasoning: string;                     // multi-step reasoning chain
  conclusions: AGIConclusion[];
  actionsProposed: number;
  actionsApproved: number;
  actionsExecuted: number;
  confidence: number;
  durationMs: number;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  shutdownFlag: boolean;
  createdAt: string;
}

export interface ReasoningObservation {
  organizationHealth: number;
  cashPositionINR: number;
  revenueMTD: number;
  complianceScore: number;
  openIncidents: number;
  activeGoals: number;
  pendingDecisions: number;
  activeAgents: number;
  runwayDays: number;
  topRisks: string[];
  topOpportunities: string[];
  evaluatedAt: string;
}

export interface ReasoningSummary {
  totalCycles: number;
  cyclesToday: number;
  avgConfidence: number;
  avgDurationMs: number;
  lastCycleAt: string | null;
  triggersBreakdown: Record<ReasoningTrigger, number>;
  focusBreakdown: Record<ReasoningFocus, number>;
  actionsProposed: number;
  actionsExecuted: number;
  executionRate: number;                 // executed / proposed
  emergencyShutdownActive: boolean;
}

// ─── 3. Multi-Agent Swarm™ ───────────────────────────────────────────────────
// 15 specialized autonomous agents collaborating continuously.

export type AgentId =
  | 'ceo' | 'cfo' | 'coo' | 'cto' | 'cro'
  | 'hr' | 'legal' | 'marketing' | 'sales' | 'finance'
  | 'compliance' | 'banking' | 'engineering'
  | 'customer_success' | 'security';

export type AgentStatus =
  | 'active' | 'idle' | 'thinking' | 'executing' | 'paused' | 'shutdown';

export interface SwarmAgent {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  mandate: string;
  capabilities: string[];
  decisionDomains: string[];
  status: AgentStatus;
  currentTask: string | null;
  decisionsLast24h: number;
  decisionsTotal: number;
  messagesExchanged: number;
  avgConfidence: number;
  successRate: number;                   // 0-1
  lastActiveAt: string | null;
}

export interface AgentMessage {
  id: string;
  fromAgent: AgentId;
  toAgent: AgentId | 'oracle' | 'all';
  intent: 'inform' | 'request' | 'propose' | 'approve' | 'reject' | 'coordinate' | 'alert';
  content: string;
  relatedDecision: string | null;
  createdAt: string;
}

export interface SwarmSummary {
  totalAgents: number;
  activeAgents: number;
  thinkingAgents: number;
  executingAgents: number;
  totalDecisions24h: number;
  totalMessagesExchanged: number;
  avgConfidence: number;
  avgSuccessRate: number;
  topContributor: AgentId | null;
  coordinationLoad: number;              // messages in last cycle
}

// ─── 4. Long-Term Memory™ ────────────────────────────────────────────────────
// Oracle remembers everything forever. Every memory is searchable.

export type MemoryCategory =
  | 'conversation' | 'decision' | 'failure' | 'customer'
  | 'employee' | 'strategy' | 'roadmap' | 'experiment'
  | 'meeting' | 'approval' | 'deployment' | 'financial'
  | 'execution' | 'learning';

export interface AGIMemory {
  id: string;
  memoryKey: string;
  category: MemoryCategory;
  title: string;
  content: string;
  summary: string | null;
  tags: string[];
  sourceModule: string | null;
  sourceEntity: string | null;
  importance: number;                    // 0-1
  retrievalCount: number;
  createdAt: string;
}

export interface MemorySearchResult {
  memory: AGIMemory;
  score: number;                         // 0-1 relevance
  matchedOn: string[];                   // which terms/fields matched
}

export interface MemorySummary {
  totalMemories: number;
  byCategory: Record<MemoryCategory, number>;
  totalRetrievals: number;
  avgImportance: number;
  oldestMemory: string | null;
  newestMemory: string | null;
  storageBytes: number;                  // approximate
}

// ─── 5. Goal Engine™ ─────────────────────────────────────────────────────────
// Businesses define goals. Oracle breaks them into projects, milestones, work.

export type GoalCategory =
  | 'revenue' | 'cost' | 'retention' | 'expansion'
  | 'compliance' | 'efficiency' | 'growth' | 'profit';

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalStatus = 'active' | 'paused' | 'achieved' | 'failed' | 'archived';

export interface AGIMilestone {
  order: number;
  label: string;
  targetValue: number;
  achievedValue: number;
  status: 'pending' | 'in_progress' | 'achieved' | 'missed';
  targetDate: string | null;
}

export interface AGIGoal {
  id: string;
  goalKey: string;
  title: string;
  description: string;
  category: GoalCategory;
  priority: GoalPriority;
  targetMetric: string;
  targetValue: number;
  currentValue: number;
  baselineValue: number;
  unit: string | null;
  deadline: string | null;
  ownerId: string | null;                // agent id
  status: GoalStatus;
  progressPct: number;                   // 0-100
  milestones: AGIMilestone[];
  planIds: string[];
  confidence: number;                    // 0-1
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalSummary {
  totalGoals: number;
  activeGoals: number;
  achievedGoals: number;
  failedGoals: number;
  avgProgress: number;                   // 0-100
  avgConfidence: number;
  byCategory: Record<GoalCategory, number>;
  byPriority: Record<GoalPriority, number>;
  goalsAtRisk: number;                   // active + progress < 50 + deadline near
}

// ─── 6. Autonomous Project Manager™ ──────────────────────────────────────────
// Oracle creates tasks, estimates timelines, assigns agents, predicts delays.

export type PlanType = 'project' | 'initiative' | 'sprint' | 'workflow' | 'recovery';
export type PlanStatus = 'planning' | 'active' | 'blocked' | 'completed' | 'cancelled';

export interface AGITask {
  id: string;
  title: string;
  description: string;
  assignedAgent: AgentId | 'human' | null;
  estimatedHours: number;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  dependsOn: string[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface AGIPlan {
  id: string;
  goalId: string | null;
  title: string;
  description: string;
  planType: PlanType;
  status: PlanStatus;
  ownerAgent: AgentId | null;
  tasks: AGITask[];
  milestones: string[];
  estimatedDays: number;
  startedAt: string | null;
  targetDate: string | null;
  completedAt: string | null;
  progressPct: number;
  riskOfDelayPct: number;                // 0-100 Oracle's prediction
  resourceAlloc: Record<string, number>; // agent/human -> hours
  parentPlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectManagerSummary {
  totalPlans: number;
  activePlans: number;
  blockedPlans: number;
  completedPlans: number;
  totalTasks: number;
  doneTasks: number;
  avgProgress: number;
  avgDelayRisk: number;                  // 0-100
  plansAtRisk: number;                   // riskOfDelayPct > 60
  agentUtilization: Record<AgentId, number>; // hours allocated
}

// ─── 7. Self-Improvement System™ ─────────────────────────────────────────────
// Oracle learns from successes, failures, feedback, accuracy, execution.

export type LearningType =
  | 'success' | 'failure' | 'feedback' | 'accuracy'
  | 'execution' | 'compliance' | 'efficiency' | 'routing';

export interface LearningEpisode {
  id: string;
  learningType: LearningType;
  sourceEntity: string | null;
  sourceModule: string | null;
  subject: string;
  observation: string;
  lesson: string;
  appliedOptimization: string | null;
  beforeMetric: number | null;
  afterMetric: number | null;
  improvementPct: number;
  confidence: number;
  status: 'observed' | 'learned' | 'applied' | 'verified' | 'discarded';
  createdAt: string;
}

export interface LearningSummary {
  totalEpisodes: number;
  appliedOptimizations: number;
  verifiedImprovements: number;
  avgImprovementPct: number;
  byType: Record<LearningType, number>;
  byStatus: Record<string, number>;
  topLesson: string | null;
  selfImprovementRate: number;           // applied / total
}

// ─── 8. Organizational Digital Twin™ ─────────────────────────────────────────
// Living simulation of the enterprise. Predict outcomes before execution.

export type SimulationScenario =
  | 'acquisition' | 'expansion' | 'hiring' | 'layoffs'
  | 'pricing' | 'tax' | 'compliance' | 'investment'
  | 'funding' | 'launch' | 'competitor';

export interface TwinSimulation {
  id: string;
  scenarioKey: SimulationScenario;
  title: string;
  description: string;
  inputs: Record<string, number | string | boolean>;
  baselineState: Record<string, number>;
  projectedState: Record<string, number>;
  financialImpact: number;               // INR delta
  revenueImpact: number;
  costImpact: number;
  riskScore: number;                     // 0-100
  confidence: number;                    // 0-1
  timeline: string | null;
  recommendation: 'proceed' | 'caution' | 'avoid' | 'needs_review';
  rollbackStrategy: string | null;
  competitorReaction: string | null;
  initiatedBy: string | null;
  approvedBy: string | null;
  status: 'simulated' | 'approved' | 'executing' | 'executed' | 'rejected' | 'rolled_back';
  createdAt: string;
}

export interface TwinSummary {
  totalSimulations: number;
  executedSimulations: number;
  avgConfidence: number;
  byScenario: Record<SimulationScenario, number>;
  byRecommendation: Record<string, number>;
  totalProjectedImpactINR: number;
  rollbackRate: number;
}

// ─── 9. AGI Decision (signed, explainable) ───────────────────────────────────

export type DecisionCategory =
  | 'revenue' | 'operations' | 'finance' | 'hr' | 'compliance'
  | 'legal' | 'growth' | 'risk' | 'product' | 'expansion';

export interface AGIDecision {
  id: string;
  cycleId: string | null;
  decisionKey: string;
  title: string;
  summary: string;
  reasoning: string;                     // explainable chain
  category: DecisionCategory;
  proposingAgent: AgentId;
  collaborators: AgentId[];
  financialImpact: number;
  expectedROI: number;
  riskScore: number;                     // 0-100
  confidence: number;                    // 0-1
  approvalRequired: 'none' | 'notify' | 'manager' | 'cfo' | 'ceo' | 'board';
  approvedBy: string | null;
  approvedAt: string | null;
  signature: string;
  rollbackStrategy: string | null;
  status: 'proposed' | 'in_review' | 'approved' | 'rejected' | 'executing' | 'executed' | 'failed' | 'rolled_back';
  executedAt: string | null;
  createdAt: string;
}

// ─── 10. AGI Security™ ───────────────────────────────────────────────────────

export interface AGIApproval {
  id: string;
  decisionId: string | null;
  goalId: string | null;
  planId: string | null;
  simulationId: string | null;
  requestType: 'decision' | 'goal' | 'plan' | 'simulation' | 'execute' | 'shutdown';
  title: string;
  description: string;
  riskScore: number;
  requestedBy: string;
  requiredRole: 'manager' | 'cfo' | 'ceo' | 'board';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface AGIAuditRecord {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  actorId: string | null;
  actorType: string;
  role: string;
  rbacDecision: 'allow' | 'deny' | 'needs_approval';
  signature: string;
  policyChecks: string[];
  reason: string | null;
  result: 'success' | 'denied' | 'failed' | 'blocked' | 'rolled_back';
  errorMessage: string | null;
  occurredAt: string;
}

export interface SecuritySummary {
  totalActions: number;
  rbacAllowRate: number;                 // 0-100
  deniedActions: number;
  pendingApprovals: number;
  policyViolations: number;
  emergencyShutdownActive: boolean;
  rolledBackActions: number;
  auditTrailSize: number;
  guardrails: Guardrail[];
}

export interface Guardrail {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  violations: number;
}

// ─── 11. Enterprise AGI Dashboard (unified bundle) ───────────────────────────

export interface AGIDashboard {
  generatedAt: string;

  // AGI Core live cards
  agiHealth: number;                     // 0-100 — Oracle's enterprise AGI health
  organizationHealth: number;
  capabilitiesOnline: number;
  reasoningStatus: 'active' | 'idle' | 'paused' | 'shutdown';
  cyclesToday: number;
  activeAgents: number;
  activeGoals: number;
  pendingApprovals: number;
  memoryEntries: number;
  learningsApplied: number;
  simulationsRun: number;
  emergencyShutdown: boolean;

  // Subsystem bundles
  core: AGICoreState;
  reasoning: { summary: ReasoningSummary; recent: ReasoningCycle[] };
  swarm: { summary: SwarmSummary; agents: SwarmAgent[]; recentMessages: AgentMessage[] };
  memory: { summary: MemorySummary; recent: AGIMemory[] };
  goals: { summary: GoalSummary; recent: AGIGoal[] };
  plans: { summary: ProjectManagerSummary; recent: AGIPlan[] };
  learning: { summary: LearningSummary; recent: LearningEpisode[] };
  twin: { summary: TwinSummary; recent: TwinSimulation[] };
  decisions: { recent: AGIDecision[]; pending: number };
  security: { summary: SecuritySummary; recentAudit: AGIAuditRecord[]; pendingApprovals: AGIApproval[] };

  // Live enterprise state (grounded in real data)
  liveState: {
    cashPositionINR: number;
    revenueMTD: number;
    complianceScore: number;
    runwayDays: number;
    openIncidents: number;
    activeWorkflows: number;
    dataSources: string[];
  };

  tagline: string;
  subtagline: string;
  founder: string;
}
