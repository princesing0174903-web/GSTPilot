// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Pipeline Types (PROMPT 4: Real AI Business Brain)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every user message follows this pipeline:
//   User Question → Intent → Tools → Real Data → Reason → Executive Answer
//
// Oracle NEVER hallucinates. Key metrics are computed DETERMINISTICALLY from
// real Prisma data. The LLM only reasons over the real data and writes the
// executive narrative — it never invents numbers.
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

/** The complete result of running the pipeline for one user message. */
export interface PipelineResult {
  intent: IntentId;
  tools: ToolExecution[];
  metrics: MetricCard[];
  actions: ActionButton[];
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
  /** Streamed narrative token. */
  token?: string;
  /** Follow-up suggestion prompts. */
  followUps?: string[];
  /** Done signal. */
  done?: boolean;
  /** Error signal (friendly message). */
  error?: string;
}
