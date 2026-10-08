// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Type System
// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Chat agent. Every response is grounded in REAL business data.
// No fabrication. Every conclusion cites real database records via SourceRef.
// ═══════════════════════════════════════════════════════════════════════════════

/** A hard reference to a real database record. Every Oracle conclusion cites these. */
export interface SourceRef {
  kind:
    | 'invoice'
    | 'client'
    | 'vendor'
    | 'payment'
    | 'expense'
    | 'purchaseBill'
    | 'gstReturn'
    | 'gstFiling'
    | 'bankAccount'
    | 'bankTransaction'
    | 'email'
    | 'tds'
    | 'employee'
    | 'payroll'
    | 'notice'
    | 'task';
  id: string;
  label: string;
  amount?: number;
  date?: string;
  status?: string;
}

/** A recommended action Oracle suggests to the executive. */
export interface RecommendedAction {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  rationale: string;
}

/** A tool the agent decided to call. */
export interface ToolCall {
  name: ToolName;
  label: string;
  reason: string;
  startedAt: string;
}

/** The result of a tool call. */
export interface ToolResult {
  name: ToolName;
  label: string;
  recordCount: number;
  /** Compact JSON-safe summary of the records (capped for the LLM context). */
  summary: string;
  sources: SourceRef[];
  durationMs: number;
}

export type ToolName =
  | 'memory_snapshot'
  | 'search_invoices'
  | 'search_payments'
  | 'search_customers'
  | 'search_vendors'
  | 'search_expenses'
  | 'search_purchases'
  | 'search_gst_returns'
  | 'search_tds'
  | 'search_emails'
  | 'search_bank_transactions'
  | 'receivables_summary'
  | 'payables_summary'
  | 'cash_flow_summary'
  | 'gst_liability'
  | 'overdue_invoices'
  | 'customer_followups'
  | 'revenue_trend'
  | 'expense_breakdown'
  | 'executive_kpis'
  // ─── New analytical tools (real data, no fabrication) ───
  | 'period_comparison'      // Compare two months/quarters (e.g. June vs July)
  | 'gst_forecast'           // Project next month's GST from real trend
  | 'vendor_price_trends'    // Detect vendors whose prices increased
  | 'customer_churn_risk'    // Flag customers likely to churn
  | 'board_summary';         // Executive board-meeting briefing material

/** A single message in a conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'oracle';
  content: string;
  /** Oracle-only: structured sections */
  executiveSummary?: string;
  analysis?: string;
  evidence?: string;
  recommendedActions?: RecommendedAction[];
  confidence?: number; // 0-100
  sources?: SourceRef[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  insights?: ProactiveInsight[];
  followUps?: string[];
  /** Whether the answer is streaming in */
  streaming?: boolean;
  /** Whether the stream errored */
  error?: boolean;
  /** DB id of the persisted OracleAIMessage (for updates) */
  dbMessageId?: string;
  createdAt: string;
}

/** A proactive insight Oracle surfaces without being asked. */
export interface ProactiveInsight {
  id: string;
  severity: 'critical' | 'warning' | 'positive' | 'info';
  category: 'cash_flow' | 'receivables' | 'payables' | 'gst' | 'compliance' | 'customer' | 'expense';
  headline: string;
  detail: string;
  sources: SourceRef[];
  suggestedAction?: string;
}

/** The request body for the streaming chat endpoint. */
export interface OracleChatRequest {
  message: string;
  conversationId?: string;
  /** Previous messages for conversation memory (user + oracle pairs) */
  history?: { role: 'user' | 'oracle'; content: string }[];
}

/** SSE event types streamed to the client. */
export type OracleStreamEvent =
  | { type: 'conversation'; conversationId: string; isNew?: boolean }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; tool: ToolCall }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'token'; text: string }
  | { type: 'section'; section: 'executive_summary' | 'analysis' | 'evidence'; text: string }
  | { type: 'actions'; actions: RecommendedAction[] }
  | { type: 'confidence'; score: number }
  | { type: 'sources'; sources: SourceRef[] }
  | { type: 'insights'; insights: ProactiveInsight[] }
  | { type: 'followups'; followUps: string[] }
  | { type: 'done'; finalContent: string; messageId?: string }
  | { type: 'error'; message: string };

/** A complete finalized Oracle response. */
export interface OracleResponse {
  conversationId: string;
  content: string;
  executiveSummary: string;
  analysis: string;
  evidence: string;
  recommendedActions: RecommendedAction[];
  confidence: number;
  sources: SourceRef[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  insights: ProactiveInsight[];
  followUps: string[];
}

// ─── DB persistence types (real database memory) ──────────────────────────────

/** A persisted conversation session (maps to OracleAISession). */
export interface ConversationSummary {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  messageCount: number;
  pinned: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A message part stored in OracleAIMessage.parts (JSON). */
export interface MessagePart {
  kind: 'thinking' | 'tool_call' | 'tool_result' | 'section' | 'actions' | 'confidence' | 'sources' | 'insights' | 'followups';
  data: unknown;
}
