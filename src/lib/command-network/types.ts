// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Enterprise Command Network™ (GLOBAL COMMAND CENTER)
// Type System — shared by all 16 command subsystems.
// One Command. Every Team. Entire Enterprise. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Enterprise Command Engine™ — connected modules ────────────────────────
export type CommandModule =
  | 'oracle' | 'ai_ceo' | 'ai_cfo' | 'ai_coo' | 'ai_cto' | 'ai_cro'
  | 'ai_legal' | 'ai_hr' | 'ai_marketing' | 'ai_operations'
  | 'crm' | 'gst' | 'banking' | 'payroll'
  | 'global_enterprise' | 'compliance_cloud' | 'execution_cloud'
  | 'data_intelligence' | 'business_graph' | 'knowledge_graph'
  | 'digital_twin' | 'marketplace' | 'ai_software_factory';

export interface ConnectedModule {
  module: CommandModule;
  label: string;
  role: string;                    // what this module contributes to the network
  status: 'online' | 'degraded' | 'offline';
  messagesLastHour: number;        // commands routed through this module in last hour
  coordinatedWorkflows: number;    // active workflows this module participates in
  lastHeartbeat: string | null;
}

export interface CommandFabric {
  totalModules: number;
  onlineModules: number;
  totalConnections: number;        // sum of messagesLastHour across modules
  activeWorkflows: number;
  moduleGraph: ConnectedModule[];
}

// ─── 2. Enterprise Decision Network™ ──────────────────────────────────────────
export type DecisionCategory =
  | 'revenue' | 'operations' | 'finance' | 'hr' | 'compliance'
  | 'legal' | 'growth' | 'risk' | 'product' | 'expansion';

export type DecisionStageStatus =
  | 'pending' | 'in_review' | 'approved' | 'rejected' | 'skipped' | 'blocked';

export interface DecisionStage {
  order: number;
  module: CommandModule;           // which module reviews at this stage
  role: string;                    // reviewer role (e.g. "Marketing Impact")
  status: DecisionStageStatus;
  review: string;                  // plain-English assessment from that module
  financialImpactINR: number;      // projected impact at this stage
  riskNote: string | null;
  confidence: number;              // 0-1
  reviewedAt: string | null;
  reviewerId: string | null;
}

export interface CoordinatedDecision {
  id: string;
  decisionKey: string;
  title: string;
  summary: string;
  category: DecisionCategory;
  initiator: string;
  stages: DecisionStage[];
  currentStage: number;
  status: 'proposed' | 'in_review' | 'approved' | 'executing' | 'executed' | 'failed' | 'rejected' | 'aborted';
  financialImpact: number;
  riskScore: number;
  confidence: number;
  requiresApproval: string;
  approvedBy: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  rollbackStrategy: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionNetworkSummary {
  totalDecisions: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byInitiator: Record<string, number>;
  avgStageCount: number;
  avgConfidence: number;
  pendingReview: number;
  executedThisWeek: number;
}

// ─── 3. Cross-Module Coordination™ ────────────────────────────────────────────
export interface CoordinatedDepartment {
  department: CommandModule;
  label: string;
  activeWorkflows: number;
  pendingApprovals: number;
  openTasks: number;
  lastSyncAt: string | null;
  syncLagMin: number;              // minutes since last coordinated sync
  status: 'synced' | 'syncing' | 'stale' | 'error';
}

export interface CrossModuleSync {
  totalDepartments: number;
  syncedDepartments: number;
  staleDepartments: number;
  totalPendingApprovals: number;
  totalOpenTasks: number;
  totalActiveWorkflows: number;
  avgSyncLagMin: number;
  departments: CoordinatedDepartment[];
}

// ─── 4. Global Operations Map™ ────────────────────────────────────────────────
export type OperationNodeType =
  | 'country' | 'office' | 'factory' | 'warehouse' | 'team'
  | 'department' | 'organization' | 'ai_executive' | 'connector' | 'worker' | 'queue';

export interface OperationNode {
  id: string;
  type: OperationNodeType;
  label: string;
  country: string | null;          // ISO code
  parent: string | null;           // parent node id (for hierarchy)
  status: 'active' | 'idle' | 'busy' | 'error' | 'offline';
  healthScore: number;             // 0-100
  metrics: Record<string, number>; // live metrics (revenue, tasks, etc.)
  lastUpdate: string | null;
}

export interface OperationsMapSummary {
  totalNodes: number;
  byType: Record<string, number>;
  byCountry: Record<string, number>;
  byStatus: Record<string, number>;
  avgHealthScore: number;
  nodes: OperationNode[];
}

// ─── 5. Command Workflows™ ────────────────────────────────────────────────────
export type WorkflowType =
  | 'hire_employee' | 'lead_to_cash' | 'gst_filing' | 'payroll_cycle'
  | 'vendor_onboarding' | 'quarter_end' | 'funding_round' | 'product_launch'
  | 'disaster_recovery' | 'acquisition' | 'international_expansion';

export type WorkflowStepStatus =
  | 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'blocked';

export interface WorkflowStep {
  order: number;
  module: CommandModule;
  action: string;                  // what happens at this step
  agent: string | null;            // oracle | gst_agent | cfo_agent | etc.
  status: WorkflowStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  durationMs: number | null;
}

export interface CoordinatedWorkflow {
  id: string;
  workflowKey: string;
  name: string;
  type: WorkflowType;
  description: string;
  steps: WorkflowStep[];
  currentStep: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'aborted' | 'failed';
  trigger: string | null;
  coordinatedModules: CommandModule[];
  startedAt: string | null;
  completedAt: string | null;
  relatedDecisionId: string | null;
  relatedIncidentId: string | null;
  initiatedBy: string | null;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  totalWorkflows: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  activeNow: number;
  completedToday: number;
  failedToday: number;
  avgStepCount: number;
  avgDurationMin: number;
}

// ─── 6. Enterprise Incident Center™ ───────────────────────────────────────────
export type IncidentCategory =
  | 'production_failure' | 'revenue_drop' | 'compliance_violation'
  | 'cyber_threat' | 'connector_outage' | 'payment_failure'
  | 'execution_failure' | 'infrastructure_failure' | 'data_quality'
  | 'cash_shortage' | 'gst_notice' | 'vendor_risk' | 'payroll_issue';

export type IncidentSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus =
  | 'open' | 'investigating' | 'contained' | 'recovering'
  | 'resolved' | 'closed' | 'false_positive';

export interface RecoveryStep {
  order: number;
  action: string;
  module: CommandModule;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
}

export interface CommandIncident {
  id: string;
  incidentKey: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  rootCause: string | null;
  impactAssessment: string | null;
  affectedModules: CommandModule[];
  affectedEntities: string[];
  recoveryPlan: RecoveryStep[];
  resolution: string | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  containedAt: string | null;
  resolvedAt: string | null;
  detectedBy: string;
  coordinatedWorkflowIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IncidentSummary {
  totalIncidents: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  openCritical: number;
  resolvedToday: number;
  avgResolutionMin: number;
  mttrMin: number;                 // mean time to resolve
}

// ─── 7. Enterprise Playbooks™ ─────────────────────────────────────────────────
export type PlaybookType =
  | 'quarter_end' | 'gst_filing' | 'audit' | 'funding_round'
  | 'international_expansion' | 'payroll_cycle' | 'disaster_recovery'
  | 'incident_response' | 'acquisition' | 'product_launch';

export interface PlaybookPhase {
  name: string;
  actions: string[];
  modules: CommandModule[];
  expectedDurationHrs: number;
  ownerRole: string;
}

export interface CommandPlaybook {
  id: string;
  playbookKey: string;
  name: string;
  type: PlaybookType;
  description: string;
  trigger: string;                 // natural-language condition for auto-selection
  objective: string;
  phases: PlaybookPhase[];
  successCriteria: string[];
  risks: string[];
  estimatedDurationHrs: number;
  lastUsedAt: string | null;
  useCount: number;
  successRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookSummary {
  totalPlaybooks: number;
  byType: Record<string, number>;
  activePlaybooks: number;
  totalUses: number;
  avgSuccessRate: number;
  lastUsedAt: string | null;
}

// ─── 8. Command Simulator™ ────────────────────────────────────────────────────
export type SimulationRecommendation = 'proceed' | 'caution' | 'avoid' | 'needs_review';

export interface CommandSimulation {
  id: string;
  scenario: string;
  title: string;
  description: string;
  commandType: string;
  parameters: Record<string, unknown>;
  baseline: Record<string, unknown>;
  financialImpact: number;
  operationalImpact: number;
  complianceImpact: string;
  legalImpact: string;
  riskScore: number;
  expectedROI: number;
  confidence: number;
  recommendation: SimulationRecommendation;
  rollbackStrategy: string | null;
  relatedDecisionId: string | null;
  approvedBy: string | null;
  status: string;
  createdAt: string;
}

export interface SimulationSummary {
  totalSimulations: number;
  byRecommendation: Record<string, number>;
  byCommandType: Record<string, number>;
  avgConfidence: number;
  avgROI: number;
  proceedCount: number;
  avoidCount: number;
}

// ─── 9. Enterprise Command Analytics™ ─────────────────────────────────────────
export interface CommandAnalytics {
  decisionSpeedHrs: number;        // avg time from proposed → executed
  executionEfficiency: number;     // 0-100 — completed/(completed+failed)
  departmentProductivity: number;  // 0-100 — tasks completed / open
  crossTeamCollaboration: number;  // 0-100 — % workflows spanning 3+ modules
  automationCoverage: number;      // 0-100 — % commands auto-executed
  revenueImpactINR: number;        // sum of executed-decision financial impact
  compliancePerformance: number;   // 0-100 — compliance workflows on-time
  executivePerformance: number;    // 0-100 — executive decision accuracy
  operationalEfficiency: number;   // 0-100 — workflow throughput
  globalPerformance: number;       // 0-100 — composite command-network health
  trendDelta: Record<string, number>;
}

// ─── 10. Live Command Observability™ ──────────────────────────────────────────
export type ObservabilityTarget =
  | 'organization' | 'department' | 'country' | 'worker' | 'queue'
  | 'connector' | 'ai_model' | 'execution' | 'compliance'
  | 'infrastructure' | 'api';

export type ObservabilityStatus = 'healthy' | 'warning' | 'critical' | 'down';

export interface ObservabilitySignal {
  id: string;
  target: ObservabilityTarget;
  targetId: string;
  label: string;
  status: ObservabilityStatus;
  metricName: string;              // latency | throughput | error_rate | queue_depth | uptime
  metricValue: number;
  metricUnit: string;              // ms | req/s | % | count
  threshold: number;
  message: string;
  observedAt: string;
}

export interface ObservabilitySummary {
  totalSignals: number;
  byStatus: Record<string, number>;
  byTarget: Record<string, number>;
  healthScore: number;             // 0-100
  criticalCount: number;
  warningCount: number;
}

// ─── 11. Live Collaboration Network™ ──────────────────────────────────────────
export type CollaboratorType =
  | 'executive' | 'department' | 'country' | 'partner'
  | 'vendor' | 'customer' | 'ai_agent';

export interface CollaborationMessage {
  id: string;
  threadId: string;
  collaboratorType: CollaboratorType;
  collaboratorId: string;
  collaboratorLabel: string;
  message: string;
  intent: string;                  // proposal | review | approval | escalation | status | question
  moduleRef: CommandModule | null;
  oracleMemorySaved: boolean;      // whether this became part of Oracle Memory
  timestamp: string;
}

export interface CollaborationSummary {
  totalThreads: number;
  totalMessages: number;
  byCollaboratorType: Record<string, number>;
  byIntent: Record<string, number>;
  oracleMemoryMessages: number;
  activeThreads: number;
  recentMessages: CollaborationMessage[];
}

// ─── 12. Command Automation™ ──────────────────────────────────────────────────
export type AutomationType =
  | 'workflow' | 'ai_reasoning' | 'approval' | 'notification'
  | 'connector_sync' | 'compliance_check' | 'payroll' | 'reporting'
  | 'deployment' | 'recovery_action';

export interface AutomationRule {
  id: string;
  name: string;
  type: AutomationType;
  trigger: string;                 // natural-language trigger condition
  action: string;                  // what Oracle automatically does
  coordinatedModules: CommandModule[];
  enabled: boolean;
  executionsToday: number;
  totalExecutions: number;
  successRate: number;
  lastFiredAt: string | null;
}

export interface AutomationSummary {
  totalRules: number;
  enabledRules: number;
  byType: Record<string, number>;
  executionsToday: number;
  totalExecutions: number;
  avgSuccessRate: number;
  recentRules: AutomationRule[];
}

// ─── 13. Security™ (Command Audit) ────────────────────────────────────────────
export type RbacDecision = 'allow' | 'deny' | 'needs_approval';

export interface CommandAuditRecord {
  id: string;
  commandType: string;             // execute | simulate | playbook | escalate | recover | approve | reject
  targetModule: CommandModule;
  targetEntity: string | null;
  actorId: string | null;
  actorType: string;
  role: string;
  rbacDecision: RbacDecision;
  signature: string;
  replayToken: string;
  policyChecks: string[];
  payloadHash: string | null;
  result: 'success' | 'denied' | 'failed' | 'pending';
  errorMessage: string | null;
  ipAddress: string | null;
  occurredAt: string;
}

export interface SecuritySummary {
  totalCommands: number;
  byResult: Record<string, number>;
  byActorType: Record<string, number>;
  deniedCommands: number;
  rbacAllowRate: number;           // 0-100
  policyViolations: number;
  recentAudit: CommandAuditRecord[];
}

// ─── 14. Executive (AI executive roster) ──────────────────────────────────────
export interface CommandExecutive {
  id: string;
  role: string;                    // CEO | CFO | COO | CTO | CRO | Legal | HR | Marketing | Operations
  module: CommandModule;
  name: string;
  mandate: string;
  decisionsToday: number;
  activeWorkflows: number;
  incidentsOwned: number;
  approvalAccuracy: number;        // 0-100
  lastActiveAt: string | null;
  status: 'active' | 'idle' | 'reviewing';
}

// ─── 15. Global Command Center Dashboard (orchestrator bundle) ────────────────
export interface CommandDashboard {
  generatedAt: string;
  // Global Command Center™ live cards
  organizationHealth: number;      // 0-100
  globalOperations: {
    activeWorkflows: number;
    openIncidents: number;
    pendingDecisions: number;
    activeExecutives: number;
  };
  criticalAlerts: CommandIncident[];
  countries: { iso: string; name: string; entities: number; health: number }[];
  legalEntities: number;
  cashPositionINR: number;
  revenueMTD: number;
  complianceScore: number;
  executionHealth: number;
  aiActivity: {
    activeExecutives: number;
    decisionsToday: number;
    simulationsToday: number;
    automationsFired: number;
  };
  systemHealth: number;
  // subsystem bundles
  fabric: CommandFabric;
  decisions: { summary: DecisionNetworkSummary; recent: CoordinatedDecision[] };
  coordination: CrossModuleSync;
  operationsMap: OperationsMapSummary;
  workflows: { summary: WorkflowSummary; recent: CoordinatedWorkflow[] };
  incidents: { summary: IncidentSummary; recent: CommandIncident[] };
  playbooks: { summary: PlaybookSummary; recent: CommandPlaybook[] };
  simulations: { summary: SimulationSummary; recent: CommandSimulation[] };
  analytics: CommandAnalytics;
  observability: { summary: ObservabilitySummary; recent: ObservabilitySignal[] };
  collaboration: CollaborationSummary;
  automation: AutomationSummary;
  security: SecuritySummary;
  executives: CommandExecutive[];
}
