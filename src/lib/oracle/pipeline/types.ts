// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Pipeline Types (PROMPT 5: Autonomous AI CFO)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every user message follows this pipeline:
//   Question → Intent → Tools → Real Data → Multi-Agent Reasoning
//            → Scores → Timeline → Insights → Executive Brief → Stream
//
// Oracle NEVER hallucinates. All metrics/scores are computed DETERMINISTICALLY
// from real Prisma data. The LLM only writes the executive narrative over the
// real data and structured findings — it never invents numbers.
// ═══════════════════════════════════════════════════════════════════════════════

/** The classified intent of a user question. Drives tool selection. */
export type IntentId =
  | 'business_overview'
  | 'revenue'
  | 'cash'
  | 'gst'
  | 'customers'
  | 'invoices'
  | 'collections'
  | 'compliance'
  | 'forecast'
  | 'expenses'
  | 'profit'
  | 'risk'
  | 'banking'
  | 'report'
  | 'general';

/** A tool Oracle can execute to read REAL business data. */
export interface ToolDef {
  id: string;
  label: string;
  description: string;
}

/** Live execution status of a tool, streamed to the UI as it runs. */
export interface ToolExecution {
  toolId: string;
  label: string;
  status: 'running' | 'done' | 'error';
  /** One-line summary of what the tool found (e.g. "12 invoices · ₹4.2L taxable"). */
  summary: string;
  recordCount?: number;
  durationMs?: number;
}

/** A deterministic KPI card computed from real data (never LLM-generated). */
export interface MetricCard {
  key: string;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'positive' | 'negative' | 'neutral' | 'warning';
}

/** An action button rendered beneath the answer. */
export interface ActionButton {
  id: string;
  label: string;
  icon: string;
  /** Prompt sent back to Oracle when the user clicks the button. */
  prompt: string;
  tone?: 'primary' | 'default';
}

// ─── PROMPT 5: Multi-Agent Reasoning ──────────────────────────────────────────

/** Specialist agent identifiers (internal reasoning — never shown to user). */
export type AgentId =
  | 'cfo'
  | 'gst'
  | 'risk'
  | 'analyst'
  | 'collections'
  | 'forecast'
  | 'compliance';

/** A finding produced by one specialist agent. */
export interface AgentFinding {
  agent: AgentId;
  /** Short headline of the finding (e.g. "Cash runway critical at 23 days"). */
  headline: string;
  /** 1-3 sentence detailed analysis grounded in real data. */
  analysis: string;
  /** Severity the agent assigns to this finding. */
  severity: 'info' | 'watch' | 'warn' | 'critical';
  /** Confidence the agent has in this finding (0-100). */
  confidence: number;
  /** Key data points that support the finding (cited in narrative). */
  evidence: string[];
}

/** Aggregated output of all specialist agents. */
export interface AgentReport {
  findings: AgentFinding[];
  /** Executive synthesis — the merged CFO-level view. */
  synthesis: string;
}

// ─── PROMPT 5: Confidence Scoring ─────────────────────────────────────────────

/** A confidence-tagged conclusion shown to the user. */
export interface ConfidenceTag {
  /** The metric/conclusion name (e.g. "Revenue Growth", "GST Liability"). */
  label: string;
  /** Confidence percentage 0-100. */
  confidence: number;
  /** Why this confidence level (data quality, sample size, freshness). */
  rationale: string;
}

// ─── PROMPT 5: Business Score Engine ──────────────────────────────────────────

/** A single business health score component. */
export interface ScoreComponent {
  key: string;
  label: string;
  /** Score 0-100. */
  score: number;
  /** Grade label (Excellent / Good / Fair / Poor / Critical). */
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  /** One-line reason for the score. */
  reason: string;
}

/** Full business health scorecard (8 dimensions + overall). */
export interface BusinessScorecard {
  revenue: ScoreComponent;
  profitability: ScoreComponent;
  liquidity: ScoreComponent;
  compliance: ScoreComponent;
  customerHealth: ScoreComponent;
  risk: ScoreComponent;
  growth: ScoreComponent;
  overall: ScoreComponent;
}

// ─── PROMPT 5: AI Timeline ────────────────────────────────────────────────────

export type TimelineBucket = 'today' | 'this_week' | 'this_month' | 'upcoming' | 'missed' | 'events';

/** A single timeline item. */
export interface TimelineItem {
  /** Bucket the item belongs to. */
  bucket: TimelineBucket;
  /** ISO date or relative label. */
  when: string;
  /** Human-readable label. */
  title: string;
  /** Optional detail. */
  detail?: string;
  /** Severity / importance. */
  severity?: 'info' | 'watch' | 'warn' | 'critical';
}

/** Aggregated AI timeline. */
export interface AITimeline {
  items: TimelineItem[];
}

// ─── PROMPT 5: Autonomous Insights ────────────────────────────────────────────

export type InsightTone = 'positive' | 'negative' | 'warning' | 'opportunity';

/** A proactive observation Oracle noticed without being asked. */
export interface AutonomousInsight {
  id: string;
  /** Short headline (e.g. "Revenue up 18% MoM"). */
  headline: string;
  /** 1-2 sentence detail grounded in real data. */
  detail: string;
  tone: InsightTone;
  /** The real number that triggered this insight. */
  metric?: string;
  /** Suggested action prompt (clickable). */
  actionPrompt?: string;
}

// ─── PROMPT 5: Structured Recommendations ─────────────────────────────────────

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/** A recommendation with full explain-why structure. */
export interface StructuredRecommendation {
  id: string;
  /** What to do. */
  title: string;
  priority: Priority;
  /** WHY this is recommended — the underlying reason. */
  reason: string;
  /** What changes if the user acts (quantified impact). */
  impact: string;
  /** Estimated outcome — measurable result. */
  estimatedOutcome: string;
  /** Optional action prompt to execute. */
  actionPrompt?: string;
}

// ─── PROMPT 5: Smart Follow-up Questions ──────────────────────────────────────

/** A smart follow-up question Oracle asks after answering. */
export interface SmartFollowUp {
  id: string;
  /** The follow-up question text. */
  question: string;
  /** Why Oracle is asking (context). */
  rationale?: string;
}

// ─── PROMPT 5: Live Dashboard Update ──────────────────────────────────────────

/** Update payload sent to the right-side dashboard after each answer. */
export interface DashboardUpdate {
  healthScore: number;
  healthLabel: string;
  revenue: string;
  receivables: string;
  gstLiability: string;
  cash: string;
  riskScore: number;
  priorities: { label: string; severity: 'info' | 'watch' | 'warn' | 'critical' }[];
  upcomingDeadlines: { label: string; when: string; severity: 'info' | 'watch' | 'warn' | 'critical' }[];
}

// ─── Complete pipeline result ─────────────────────────────────────────────────

/** The complete result of running the pipeline for one user message. */
export interface PipelineResult {
  intent: IntentId;
  tools: ToolExecution[];
  metrics: MetricCard[];
  actions: ActionButton[];
  /** PROMPT 5: Multi-agent reasoning findings. */
  agents: AgentReport;
  /** PROMPT 5: Confidence tags for each conclusion. */
  confidences: ConfidenceTag[];
  /** PROMPT 5: Business health scorecard. */
  scorecard: BusinessScorecard | null;
  /** PROMPT 5: AI timeline. */
  timeline: AITimeline;
  /** PROMPT 5: Autonomous proactive insights. */
  insights: AutonomousInsight[];
  /** PROMPT 5: Smart follow-up questions. */
  followUps: SmartFollowUp[];
  /** PROMPT 5: Structured recommendations. */
  recommendations: StructuredRecommendation[];
  /** PROMPT 5: Live dashboard update payload. */
  dashboard: DashboardUpdate | null;
  /** Formatted real-data block injected into the LLM system prompt. */
  dataContext: string;
  /** The full system prompt (identity + real data + executive format). */
  systemPrompt: string;
  /** Whether any real business data was found. */
  hasRealData: boolean;
}

/** SSE event shape emitted by the chat route. */
export interface PipelineSSEEvent {
  /** Live tool execution trace. */
  tools?: ToolExecution[];
  /** Intent classification. */
  intent?: IntentId;
  /** Deterministic KPI cards. */
  metrics?: MetricCard[];
  /** Action buttons. */
  actions?: ActionButton[];
  /** PROMPT 5: Multi-agent findings. */
  agents?: AgentFinding[];
  /** PROMPT 5: Confidence tags. */
  confidences?: ConfidenceTag[];
  /** PROMPT 5: Business scorecard. */
  scorecard?: BusinessScorecard | null;
  /** PROMPT 5: AI timeline. */
  timeline?: TimelineItem[];
  /** PROMPT 5: Autonomous insights. */
  insights?: AutonomousInsight[];
  /** PROMPT 5: Smart follow-up questions. */
  followUps?: SmartFollowUp[];
  /** PROMPT 5: Structured recommendations. */
  recommendations?: StructuredRecommendation[];
  /** PROMPT 5: Live dashboard update. */
  dashboard?: DashboardUpdate | null;
  /** Streamed narrative token. */
  token?: string;
  /** Done signal. */
  done?: boolean;
  /** Error signal (friendly message). */
  error?: string;
}
