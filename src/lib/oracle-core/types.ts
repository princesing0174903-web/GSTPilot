// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Type System
// One Brain. Every Decision. Entire Enterprise.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── AI Module Registry ─────────────────────────────────────────────────────
// Every existing AI module is registered here. The Orchestrator routes work
// to these modules and never duplicates their logic.

export type AIModuleId =
  | 'oracle'           // self — the unifying brain
  | 'ceo'              // AI CEO™
  | 'cfo'              // AI CFO™
  | 'coo'              // AI COO™ (Autonomous Enterprise operations)
  | 'cto'              // AI CTO™ (Software Factory technology)
  | 'cro'              // AI CRO™ (risk)
  | 'legal'            // AI Legal™
  | 'hr'               // AI HR™
  | 'marketing'        // AI Marketing™
  | 'operations'       // AI Operations™
  | 'graph'            // Business Graph™
  | 'knowledge'        // Knowledge Graph™
  | 'twin'             // Digital Twin™
  | 'autonomous'       // Autonomous Enterprise™
  | 'connectivity'     // Connectivity Fabric™
  | 'factory'          // AI Software Factory™
  | 'event';           // Event Stream Engine™

export interface AIModuleInfo {
  id: AIModuleId;
  label: string;
  entryPoint: string;
  status: 'online' | 'offline' | 'degraded';
  lastCheckedAt: string | null;
}

// ─── Unified Memory™ ────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'customer' | 'vendor' | 'employee' | 'invoice' | 'gst' | 'payment'
  | 'meeting' | 'voice' | 'strategy' | 'plan' | 'prediction' | 'report'
  | 'simulation' | 'approval' | 'graph_change' | 'knowledge_update'
  | 'connector_event' | 'marketplace_install' | 'factory_build'
  | 'reasoning' | 'conversation' | 'insight' | 'learning';

export type MemorySource =
  | 'oracle' | 'ceo' | 'cfo' | 'coo' | 'cto' | 'cro' | 'legal' | 'hr'
  | 'marketing' | 'operations' | 'graph' | 'twin' | 'autonomous'
  | 'connectivity' | 'factory' | 'user';

export interface MemoryRecord {
  id: string;
  firmId: string;
  userId: string | null;
  category: MemoryCategory;
  entityType: string | null;
  entityId: string | null;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  tags: string[];
  importance: number;
  source: MemorySource;
  createdAt: string;
  expiresAt: string | null;
}

export interface MemorySearchResult {
  total: number;
  records: MemoryRecord[];
  sources: MemorySource[];
  suggestions: string[];
}

// ─── Multi-Model AI Router™ ─────────────────────────────────────────────────

export type AIProvider =
  | 'openai' | 'anthropic' | 'gemini' | 'xai' | 'deepseek' | 'mistral'
  | 'perplexity' | 'llama' | 'azure_openai' | 'nvidia_nim' | 'zai';

export type ModelTier = 'fast' | 'standard' | 'deep' | 'vision' | 'voice';

export type ModelPurpose =
  | 'reasoning' | 'code' | 'summary' | 'vision' | 'voice' | 'embedding';

export interface ModelChoice {
  provider: AIProvider;
  model: string;
  tier: ModelTier;
  purpose: ModelPurpose;
  rationale: string;
  costPer1kUsd: number;
  estimatedLatencyMs: number;
}

export interface RouteRequest {
  purpose: ModelPurpose;
  tier?: ModelTier;
  inputTokensEstimate: number;
  longContext?: boolean;
  requiresVision?: boolean;
  requiresVoice?: boolean;
  preferredProvider?: AIProvider;
}

export interface ModelCallLog {
  id: string;
  firmId: string;
  userId: string | null;
  provider: AIProvider;
  model: string;
  tier: ModelTier;
  purpose: ModelPurpose;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  costUsd: number;
  reasoningId: string | null;
  createdAt: string;
}

// ─── Enterprise Prompt Engine™ ──────────────────────────────────────────────

export type PromptTemplateId =
  | 'ceo_strategy' | 'cfo_cash' | 'cfo_risk' | 'coo_operations'
  | 'cto_architecture' | 'cro_risk' | 'legal_compliance' | 'hr_hiring'
  | 'marketing_demand' | 'crm_followup' | 'sales_pipeline'
  | 'banking_cash' | 'reports_executive' | 'forecasting_revenue'
  | 'twin_simulation' | 'automation_workflow' | 'factory_build'
  | 'voice_command' | 'gst_filing' | 'gst_reconciliation' | 'gst_notice'
  | 'oracle_orchestrate';

export interface PromptTemplate {
  id: PromptTemplateId;
  version: string;
  label: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  defaultTier: ModelTier;
  defaultPurpose: ModelPurpose;
  tags: string[];
  createdAt: string;
}

// ─── Context Engine™ ────────────────────────────────────────────────────────

export interface BusinessContext {
  gatheredAt: string;
  firmId: string;
  graph: {
    nodeCount: number;
    edgeCount: number;
    topRisks: Array<{ id: string; label: string; score: number }>;
    recentChanges: Array<{ type: string; description: string; at: string }>;
  };
  twin: {
    healthScore: number;
    cashRunwayDays: number;
    anomalies: number;
    forecastDirection: 'up' | 'down' | 'stable';
  };
  knowledge: {
    entityCount: number;
    recentUpdates: number;
  };
  recentEvents: Array<{
    type: string;
    severity: string;
    title: string;
    at: string;
  }>;
  connectedSystems: {
    total: number;
    healthy: number;
    failing: number;
    avgReliability: number;
  };
  finance: {
    cashBalance: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    gstCollected: number;
    gstPaid: number;
    receivables: number;
    payables: number;
  };
  recentInvoices: Array<{
    invoiceNumber: string;
    total: number;
    status: string;
    date: string;
  }>;
  recentReports: Array<{ title: string; type: string; at: string }>;
  previousConversations: Array<{
    topic: string;
    at: string;
    consensus: string | null;
  }>;
  goals: Array<{ title: string; progress: number; deadline: string | null }>;
  strategies: Array<{ title: string; status: string }>;
  pendingApprovals: Array<{
    id: string;
    title: string;
    type: string;
    requestedBy: string;
    at: string;
  }>;
  estimatedTokens: number;
}

// ─── Enterprise Reasoning Engine™ ───────────────────────────────────────────

export interface ReasoningRequest {
  firmId: string;
  userId: string | null;
  request: string;
  requestType: 'ask' | 'plan' | 'analyze' | 'decide' | 'simulate';
  executives?: AIModuleId[];
  callLLM?: boolean;
  preferredTier?: ModelTier;
}

export interface ReasoningResult {
  id: string;
  firmId: string;
  userId: string | null;
  request: string;
  requestType: ReasoningRequest['requestType'];
  businessReasoning: string;
  financialReasoning: string;
  riskReasoning: string;
  complianceReasoning: string;
  operationalReasoning: string;
  legalReasoning: string;
  historicalEvidence: string;
  supportingData: Record<string, unknown>;
  confidence: number;
  alternatives: Array<{
    label: string;
    pros: string[];
    cons: string[];
    estimatedRoi: string;
  }>;
  expectedRoi: string | null;
  rollbackStrategy: string;
  finalAnswer: string;
  modelUsed: AIProvider;
  modelTier: ModelTier;
  executivesConsulted: AIModuleId[];
  approved: boolean;
  rejected: boolean;
  outcome: 'success' | 'failure' | 'partial' | 'pending' | null;
  outcomeNote: string | null;
  createdAt: string;
}

// ─── Executive Conversation™ ────────────────────────────────────────────────

export interface ConversationTurn {
  executive: AIModuleId;
  executiveLabel: string;
  message: string;
  reasoning: string;
  confidence: number;
  at: string;
}

export interface Conversation {
  id: string;
  firmId: string;
  userId: string | null;
  topic: string;
  trigger: 'user_ask' | 'daily_synthesis' | 'ceo_initiative' | 'alert';
  participants: AIModuleId[];
  turns: ConversationTurn[];
  consensus: string | null;
  status: 'active' | 'consensus_reached' | 'abandoned';
  createdAt: string;
  completedAt: string | null;
}

// ─── Self-Improvement Engine™ ───────────────────────────────────────────────

export type LearningCategory =
  | 'accepted_rec' | 'rejected_rec' | 'successful_auto' | 'failed_auto'
  | 'revenue_growth' | 'customer_behavior' | 'collections' | 'expenses'
  | 'compliance';

export interface LearningRecord {
  id: string;
  firmId: string;
  category: LearningCategory;
  signal: string;
  evidence: Record<string, unknown>;
  lessonLearned: string;
  weight: number;
  appliedCount: number;
  successCount: number;
  createdAt: string;
  lastAppliedAt: string | null;
}

// ─── Knowledge Synthesis™ ───────────────────────────────────────────────────

export type InsightCategory =
  | 'business_insight' | 'risk_summary' | 'growth_opportunity'
  | 'cost_saving' | 'compliance_warning' | 'revenue_forecast'
  | 'cash_forecast' | 'executive_summary';

export interface InsightRecord {
  id: string;
  firmId: string;
  synthesisDate: string;
  category: InsightCategory;
  title: string;
  body: string;
  confidence: number;
  impactScore: number;
  actionItems: string[];
  dataSources: AIModuleId[];
  acknowledged: boolean;
  actedOn: boolean;
  createdAt: string;
}

// ─── Explainable AI™ ────────────────────────────────────────────────────────

export interface Explanation {
  why: string;
  how: string;
  basedOn: string[];
  whatIfIgnored: string;
  whatHappensNext: string;
  expectedBenefit: string;
  risk: string;
  confidence: number;
}

// ─── Orchestrator Dashboard ─────────────────────────────────────────────────

export interface OracleDashboard {
  gatheredAt: string;
  firmId: string;
  brainHealth: {
    overall: number;
    modulesOnline: number;
    modulesTotal: number;
    modules: AIModuleInfo[];
    cacheHitRate: number;
    avgResponseMs: number;
  };
  memory: {
    totalRecords: number;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
    last24h: number;
  };
  router: {
    totalCalls: number;
    byProvider: Record<string, number>;
    byTier: Record<string, number>;
    successRate: number;
    avgLatencyMs: number;
    totalCostUsd: number;
    fallbacksTriggered: number;
  };
  reasoning: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    byType: Record<string, number>;
    avgConfidence: number;
  };
  conversations: {
    total: number;
    active: number;
    consensusReached: number;
  };
  insights: {
    total: number;
    byCategory: Record<string, number>;
    acknowledged: number;
    actedOn: number;
    topImpact: InsightRecord | null;
  };
  learning: {
    totalLessons: number;
    appliedRecently: number;
    topLessons: LearningRecord[];
  };
  security: {
    totalCalls: number;
    rateLimited: number;
    rbacEnforced: number;
    auditLogged: number;
    errors: number;
  };
  recentActivity: Array<{
    type: string;
    title: string;
    at: string;
    module: AIModuleId;
  }>;
}
