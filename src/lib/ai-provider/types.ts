// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Type Definitions
//
// The single source of truth for the AI data model. Every type maps 1:1 to a
// Firestore document (ai_memory collection) or is a transient analysis result.
// All types are PURE (no Firebase imports) so they are safe to import from
// both client and server code.
//
// Provider pattern:
//   • IAIProvider (see provider.ts) — the contract every AI backend implements
//   • MockAIProvider        — deterministic real-data analysis (default, NO LLM)
//   • FutureOpenAIProvider  — OpenAI GPT (placeholder, throws NotImplementedError)
//   • FutureGeminiProvider  — Google Gemini (placeholder)
//   • FutureClaudeProvider  — Anthropic Claude (placeholder)
//   • Switch to production later by changing ONE env var in registry.ts
//
// Multi-tenant: every persisted document carries `organizationId`. Every query
// filters on it. The AI NEVER accesses data belonging to another organization.
//
// CRITICAL DESIGN PRINCIPLE: The MockAIProvider does NOT fabricate values. It
// analyses REAL Firestore data (invoices, GST, banking) using deterministic
// rules and template phrasing. "Never answer using fake data" is enforced at
// the type level — every Insight / Recommendation / ChatResponse carries the
// real metric it was derived from.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Provider Identifiers ────────────────────────────────────────────────────

/**
 * The set of supported AI provider backends. Today only 'mock' is live; the
 * rest are placeholders that throw NotImplementedError until implemented.
 */
export type AIProviderName =
  | 'mock'      // MockAIProvider — deterministic real-data analysis (default)
  | 'openai'    // FutureOpenAIProvider — OpenAI GPT (placeholder)
  | 'gemini'    // FutureGeminiProvider — Google Gemini (placeholder)
  | 'claude';   // FutureClaudeProvider — Anthropic Claude (placeholder)

// ─── Insights ─────────────────────────────────────────────────────────────────

/**
 * The categories of business events the Insight Engine can detect.
 * Each maps to a deterministic detection rule in insights.ts.
 */
export type InsightType =
  | 'revenue_increase'      // revenue up vs previous period
  | 'revenue_decrease'      // revenue down vs previous period
  | 'cash_flow_risk'        // net cash flow negative or runway < 30 days
  | 'high_gst_liability'    // GST output tax liability above threshold
  | 'customers_delaying'    // overdue receivables growing
  | 'unusual_expense'       // expense spike vs average
  | 'large_withdrawal'      // bank outflow above threshold
  | 'duplicate_invoice'     // same amount + party detected
  | 'duplicate_expense'     // same expense vendor + amount detected
  | 'low_bank_balance'      // bank balance below threshold
  | 'high_receivables'      // receivables > 40% of revenue
  | 'high_payables'         // payables > 40% of revenue
  | 'gst_filing_overdue'    // GST return period past due, not filed
  | 'positive_growth';      // composite positive signal

export type InsightSeverity = 'info' | 'positive' | 'warning' | 'critical';

/**
 * A single AI-generated insight. Derived from REAL BusinessContext metrics.
 * Stored in `ai_memory` with type='insight'.
 */
export interface Insight {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  /** The module this insight relates to. */
  category: 'revenue' | 'expense' | 'cashflow' | 'gst' | 'banking' | 'invoices' | 'compliance' | 'customers';
  /** The real metric value the insight was derived from (NOT fabricated). */
  metric?: number;
  /** Human-readable label for the metric (e.g. 'Revenue', 'Bank Balance'). */
  metricLabel?: string;
  /** Percentage change vs the comparison baseline, if applicable. */
  changePercent?: number;
  /** Optional reference to the entity that triggered the insight. */
  relatedEntityId?: string;
  relatedEntityType?: 'invoice' | 'client' | 'transaction' | 'return' | 'expense';
  /** ISO timestamp the insight was generated. */
  createdAt: string;
  /** Whether the user has dismissed this insight. */
  dismissed?: boolean;
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export type RecommendationType =
  | 'follow_up_customer'    // chase an overdue customer
  | 'file_gstr3b'           // file GSTR-3B for the current period
  | 'file_gstr1'            // file GSTR-1 for the current period
  | 'pay_gst'               // pay GST before the due date
  | 'reduce_expenses'       // cut unnecessary spending
  | 'send_invoice_reminder' // remind a customer about an unpaid invoice
  | 'improve_cash_flow'     // accelerate collections / delay payables
  | 'reconcile_bank'        // reconcile unmatched bank transactions
  | 'connect_bank'          // connect a bank account for live data
  | 'review_overdue'        // review overdue invoices / returns
  | 'verify_gstn'           // verify a client's GSTIN
  | 'connect_gstn';         // connect GSTN for live returns

export type RecommendationPriority = 'high' | 'medium' | 'low';
export type RecommendationStatus = 'active' | 'done' | 'dismissed';

/**
 * A single AI-generated recommendation. Derived from REAL BusinessContext +
 * Insights. Stored in `ai_memory` with type='recommendation'.
 */
export interface Recommendation {
  id: string;
  organizationId: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  /** Why the AI is recommending this — references the real metric. */
  rationale: string;
  /** The UI action label (e.g. 'File now', 'Follow up', 'Review'). */
  actionLabel: string;
  /** The view/action the UI should navigate to when the user clicks. */
  actionType: string;
  /** Optional related entity (invoice id, client id, period, etc.). */
  relatedEntityId?: string;
  relatedEntityType?: 'invoice' | 'client' | 'transaction' | 'return' | 'period';
  /** Optional ISO date by which the action should be taken. */
  dueDate?: string;
  status: RecommendationStatus;
  createdAt: string;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertSource = 'gst' | 'banking' | 'invoices' | 'compliance' | 'ai';

/**
 * A time-sensitive alert. Derived from Insights with severity >= warning.
 * NOT persisted by default — recomputed live. May be cached in ai_memory.
 */
export interface Alert {
  id: string;
  organizationId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  source: AlertSource;
  /** UI navigation target. */
  actionLabel?: string;
  actionType?: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Whether the user has read/dismissed the alert. */
  read?: boolean;
}

// ─── Scores ──────────────────────────────────────────────────────────────────

export type ScoreTrend = 'up' | 'down' | 'stable';
export type ScoreGrade = 'A' | 'B' | 'C' | 'D';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Composite Business Score (0-100). Higher is better.
 * Components are weighted: revenue growth, cash flow health, compliance,
 * collections efficiency, and inverse risk.
 */
export interface BusinessScore {
  score: number;
  grade: ScoreGrade;
  trend: ScoreTrend;
  components: {
    revenue: number;       // 0-100
    cashflow: number;      // 0-100
    compliance: number;    // 0-100
    collections: number;   // 0-100
    risk: number;          // 0-100 (inverse of risk score)
  };
  summary: string;
  /** ISO timestamp the score was computed. */
  asOf: string;
}

/**
 * Risk Score (0-100). Higher = riskier. Inverse of the risk component in
 * BusinessScore. Includes the top contributing risk factors.
 */
export interface RiskScore {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  summary: string;
  asOf: string;
}

export interface RiskFactor {
  label: string;
  /** 0-100 contribution to the overall risk score. */
  impact: number;
  detail: string;
}

// ─── Business Context (Knowledge Engine output) ──────────────────────────────

/**
 * The complete real-data snapshot of the organization that every AI method
 * receives. Built by the Business Knowledge Engine (knowledge.ts) from live
 * Firestore data. This is what makes Oracle "understand" the business.
 *
 * EVERY field is derived from real Firestore documents — never fabricated.
 */
export interface BusinessContext {
  organizationId: string;
  /** ISO timestamp the context was assembled. */
  asOf: string;
  /** Current billing period (YYYY-MM) the analysis is scoped to. */
  period: string;

  revenue: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
    /** Number of invoices contributing to current revenue. */
    invoiceCount: number;
  };

  expenses: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
    /** Top 3 expense categories by amount. */
    topCategories: { label: string; amount: number }[];
  };

  profit: {
    current: number;
    margin: number; // 0-1
  };

  outstanding: {
    receivables: number;   // unpaid customer invoices
    payables: number;      // unpaid vendor bills
    net: number;           // receivables - payables
  };

  gst: {
    /** Output tax liability for the current period (CGST+SGST+IGST+cess). */
    liability: number;
    /** Input tax credit available. */
    itcAvailable: number;
    /** Net GST payable = liability - itcAvailable. */
    netPayable: number;
    /** Whether the current period return is filed. */
    filingStatus: 'not_filed' | 'draft' | 'filed' | 'overdue';
    /** Count of pending (non-filed) returns. */
    pendingReturns: number;
    /** Next filing due date (ISO), if known. */
    nextDueDate: string | null;
  };

  banking: {
    totalBalance: number;
    availableBalance: number;
    incomingPayments: number;
    outgoingPayments: number;
    pendingReconciliation: number;
    connectedAccounts: number;
  };

  cashFlow: {
    /** Net inflow for the period (incoming - outgoing). */
    netInflow: number;
    /** Average monthly outflow (burn rate). */
    burnRate: number;
    /** Estimated months of runway at current burn, Infinity if positive. */
    runwayMonths: number;
  };

  invoices: {
    total: number;
    pending: number;     // sent, not paid
    overdue: number;     // past due date
    draft: number;       // not sent
    /** Total value of overdue invoices. */
    overdueValue: number;
    /** Total value of pending invoices. */
    pendingValue: number;
  };

  customers: {
    total: number;
    /** Number of customers with at least one overdue invoice. */
    overdue: number;
    /** Top 5 debtors by outstanding amount. */
    topDebtors: { id: string; name: string; amount: number }[];
  };

  deadlines: {
    /** Upcoming deadlines (GST filings, payments), sorted by date. */
    upcoming: {
      label: string;
      date: string;
      type: 'gst_filing' | 'gst_payment' | 'invoice_due' | 'other';
      daysRemaining: number;
    }[];
  };

  /** Whether the org has connected GSTN (live returns). */
  gstnConnected: boolean;
  /** Whether the org has connected at least one bank account. */
  bankConnected: boolean;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string;
  /** Optional metadata (which data sources were used, confidence, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Oracle's answer to a business question. Derived from REAL BusinessContext —
 * never fabricated. `dataUsed` records exactly which real metrics informed
 * the answer so the user can trust (and audit) the response.
 */
export interface ChatResponse {
  answer: string;
  /** Human-readable list of the real data sources / metrics used. */
  sources: string[];
  /** How confident the AI is in the answer, based on data completeness. */
  confidence: 'high' | 'medium' | 'low';
  /** Related insight ids that reinforce the answer. */
  relatedInsights?: string[];
  /** Related recommendation ids the user could act on. */
  relatedRecommendations?: string[];
  /** A summary of the real data that informed the answer. */
  dataUsed?: {
    summary: string;
    metrics: { label: string; value: string }[];
  };
}

// ─── Predictions ─────────────────────────────────────────────────────────────

export interface PredictionPoint {
  label: string;          // e.g. 'Next month', '2024-02'
  value: number;
  /** Lower bound of the prediction interval. */
  lower?: number;
  /** Upper bound of the prediction interval. */
  upper?: number;
}

export interface Prediction {
  metric: 'revenue' | 'cashflow';
  points: PredictionPoint[];
  summary: string;
  /** 0-1 confidence based on data volume & variance. */
  confidence: number;
  /** The methodology used (deterministic for Mock, model-based for future). */
  method: string;
}

// ─── Analysis Result ─────────────────────────────────────────────────────────

export type AnalysisModule = 'business' | 'cashflow' | 'gst' | 'invoices' | 'expenses';

export interface AnalysisResult {
  module: AnalysisModule;
  summary: string;
  metrics: {
    label: string;
    value: number;
    /** Optional comparison value. */
    previous?: number;
    changePercent?: number;
    format?: 'currency' | 'percent' | 'number';
  }[];
  insights: Insight[];
  recommendations: Recommendation[];
}

// ─── AI Memory (ai_memory collection) ────────────────────────────────────────

/**
 * The type of memory entry. Drives what the Oracle remembers and surfaces.
 */
export type AIMemoryType =
  | 'insight'         // an Insight that was generated
  | 'recommendation'  // a Recommendation that was generated
  | 'alert'           // an Alert that fired
  | 'analysis'        // a module analysis result
  | 'conversation'    // a user conversation (Q&A)
  | 'pattern'         // a detected business pattern
  | 'outcome'         // the result of a taken action
  | 'fact';           // a derived business fact

/**
 * The data source the memory entry originated from.
 */
export type AIMemorySource =
  | 'invoices'
  | 'gst'
  | 'banking'
  | 'reports'
  | 'tasks'
  | 'conversation'
  | 'analysis'
  | 'system';

/**
 * A single AI memory entry — the Oracle's persistent knowledge of the business.
 * Stored in Firestore `ai_memory/{memoryId}`, scoped by `organizationId`.
 *
 * IMPORTANT: the Firestore rules enforce `organizationId` (NOT the legacy
 * `firmId`). This service always writes `organizationId`.
 */
export interface AIMemory {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  type: AIMemoryType;
  source: AIMemorySource;
  /** Short human-readable summary of the memory. */
  summary: string;
  /**
   * Placeholder for a future vector embedding. Today this is a deterministic
   * hash of the summary so memories can be de-duplicated. When a real
   * embedding provider is plugged in, this becomes the vector.
   */
  embeddingPlaceholder: string;
  /** Structured payload (the full Insight / Recommendation / ChatResponse / etc.). */
  metadata: Record<string, unknown>;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp — updated whenever the memory is refreshed. */
  updatedAt: string;
}

// ─── Provider Diagnostics ────────────────────────────────────────────────────

export interface AIProviderDiagnostics {
  name: string;
  provider: AIProviderName;
  isLive: boolean;
  configured: boolean;
}
