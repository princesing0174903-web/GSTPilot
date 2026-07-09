// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Production Type System
//
// Every Oracle response is a structured `CFOAnswer` containing:
//   • reasoning trace      — the multi-step pipeline that produced the answer
//   • supporting records   — real database records used to derive the answer
//   • confidence           — calibrated 0-1 score with rationale
//   • calculation          — explicit math breakdown (no black-box numbers)
//   • risks                — what could go wrong if recommendations are followed
//   • alternatives         — other valid approaches with trade-offs
//   • proposed actions     — executable operations requiring user approval
//
// This is NOT a chat completion. It is a structured financial analysis that
// happens to be rendered in a chat UI. Every field is sourced from real data.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Business Context (auto-loaded, cached 30s) ──────────────────────────────

export interface BusinessContext {
  organizationId: string;
  organizationName: string;
  financialYear: string;        // e.g. "FY2024-25"
  currentGstPeriod: string;     // e.g. "11-2024" (MM-YYYY)
  loadedAt: string;             // ISO timestamp
  loadDurationMs: number;       // performance trace

  // Live data counts (so Oracle can say "you have 12 unpaid invoices" with proof)
  clients: { total: number; active: number };
  invoices: {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
    totalOutstanding: number;     // ₹ sum of unpaid invoices
    totalOverdue: number;         // ₹ sum of overdue invoices
  };
  payments: {
    total: number;
    received: number;             // ₹ sum of customer payments (last 90d)
    paid: number;                 // ₹ sum of vendor payments (last 90d)
    pending: number;              // ₹ sum of pending payment links
  };
  expenses: {
    total: number;
    totalAmount: number;          // ₹ sum (last 90d)
  };
  gstReturns: {
    total: number;
    filed: number;
    draft: number;
    overdue: number;
    nextDueDate: string | null;
  };
  bankAccounts: {
    total: number;
    connected: number;
    totalBalance: number;         // ₹ sum of connected account balances
  };
  tasks: {
    total: number;
    open: number;
    overdue: number;
  };
  compliance: {
    score: number;                // 0-100
    pendingFilings: number;
    upcomingDeadlines: Array<{ title: string; dueDate: string; daysLeft: number }>;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    summary: string;
    timestamp: string;
  }>;

  // Honest signal: if any data source is empty, Oracle says so explicitly
  dataAvailability: {
    hasInvoices: boolean;
    hasPayments: boolean;
    hasBankAccounts: boolean;
    hasGstReturns: boolean;
    hasClients: boolean;
    hasExpenses: boolean;
    overall: 'empty' | 'sparse' | 'partial' | 'complete';
  };
}

// ─── Reasoning Pipeline ───────────────────────────────────────────────────────

export type ReasoningStepStatus = 'success' | 'warning' | 'skipped' | 'failed';

export interface ReasoningStep {
  step: number;
  name: string;                  // "Retrieve Invoices", "Validate Data", etc.
  description: string;           // what was attempted
  status: ReasoningStepStatus;
  finding: string;               // what was found (1-2 sentences)
  durationMs: number;
  recordsTouched: number;        // how many DB records this step read
}

// ─── Supporting Records (real database citations) ────────────────────────────

export type SupportingRecordKind =
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'client'
  | 'gst-return'
  | 'bank-transaction'
  | 'task'
  | 'activity'
  | 'report'
  | 'notice';

export interface SupportingRecord {
  kind: SupportingRecordKind;
  id: string;
  label: string;                 // human-readable, e.g. "INV-2024-001 · Acme Corp"
  summary: string;               // 1-line summary of why this record matters
  amount?: number;               // ₹ value if relevant
  date?: string;                 // ISO date if relevant
  status?: string;               // status badge if relevant
}

// ─── Proposed Actions (require user approval) ────────────────────────────────

export type ProposedActionStatus =
  | 'pending-approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'expired';

export type ProposedActionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ProposedAction {
  approvalId: string;            // unique ID for the approval workflow
  actionId: string;              // matches an ORACLE_ACTIONS registry id
  actionName: string;            // human label, e.g. "Create Invoice"
  description: string;           // what this action will do
  severity: ProposedActionSeverity;
  reason: string;                // WHY Oracle is proposing this
  preFilledInput: Record<string, unknown>;  // input values Oracle derived
  inputSchema: Array<{           // for the frontend to render an input form
    key: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'select' | 'boolean' | 'textarea';
    required?: boolean;
    options?: { label: string; value: string }[];
    placeholder?: string;
  }>;
  dryRunPreview?: unknown;       // what would happen if executed
  status: ProposedActionStatus;
  executedAt?: string;
  executionResult?: { success: boolean; output?: unknown; error?: string; auditId?: string };
  expiresAt: string;             // ISO timestamp — approvals expire after 10 min
}

// ─── The Structured CFO Answer ───────────────────────────────────────────────

export interface CFOAnswerParts {
  keyInsight: string;            // headline (1 sentence)
  analysis: string;              // multi-paragraph strategic analysis
  recommendedActions: string[];  // numbered recommendations
  potentialRisks: string[];      // what could go wrong
  nextBestStep: string;          // single most impactful next action
}

export interface CFOAnswer {
  // Identity
  answerId: string;
  conversationTurnId: string;    // links to client-side conversation turn
  question: string;              // the original user query
  createdAt: string;

  // The structured brief (compatible with existing OracleMessage parts)
  parts: CFOAnswerParts;

  // New production-grade metadata
  reasoning: ReasoningStep[];
  supportingRecords: SupportingRecord[];
  confidence: number;            // 0-1
  confidenceRationale: string;   // why this confidence level
  calculation: string;           // explicit math breakdown (plain text)
  alternatives: Array<{ option: string; tradeOff: string }>;
  proposedActions: ProposedAction[];

  // Provenance
  businessContext: {
    organizationId: string;
    organizationName: string;
    financialYear: string;
    currentGstPeriod: string;
    dataAvailability: BusinessContext['dataAvailability'];
  };
  dataSourcesUsed: string[];     // e.g. ["invoices", "payments", "gst_returns"]

  // Performance + audit
  totalDurationMs: number;
  aiProvider: string;            // e.g. "zai-glm-4.6"
  auditId: string;               // audit log entry for this answer

  // Error (if any)
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };
}

// ─── Request types ───────────────────────────────────────────────────────────

export interface CFOAskRequest {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  conversationTurnId?: string;
}

export interface CFOApproveRequest {
  approvalId: string;
  overrides?: Record<string, unknown>;  // user may edit input values
  organizationId?: string;
  userId?: string;
  userEmail?: string;
}

export interface CFOAuditLogEntry {
  auditId: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  organizationId: string;
  operationType: 'cfo-answer' | 'cfo-approve' | 'cfo-reject' | 'cfo-execute' | 'cfo-retry' | 'cfo-error';
  actionId?: string;
  question?: string;
  recordsAffected: number;
  aiProvider: string;
  executionTimeMs: number;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
  rollbackStatus: 'not-required' | 'rolled-back' | 'rollback-failed' | 'rollback-pending';
}
