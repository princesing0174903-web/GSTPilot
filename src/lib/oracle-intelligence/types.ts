// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Type System
// ═══════════════════════════════════════════════════════════════════════════════
// Every type here maps to REAL data pulled from the Prisma database.
// No placeholders. No demo shapes. Every Oracle statement is traceable to a
// source record via `EntityRef`.
// ═══════════════════════════════════════════════════════════════════════════════

/** A hard reference to a real database record. Every Oracle conclusion cites these. */
export interface EntityRef {
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
    | 'task'
    | 'meeting'
    | 'file';
  id: string;
  label: string; // human-readable identifier (invoice no, party name, etc.)
}

/** A single memory record — one unified row in Oracle's brain. */
export interface MemoryRecord {
  ref: EntityRef;
  category:
    | 'invoice'
    | 'customer'
    | 'vendor'
    | 'payment'
    | 'expense'
    | 'gst'
    | 'bank'
    | 'email'
    | 'tds'
    | 'purchase';
  title: string;
  summary: string;
  amount?: number;
  date?: string; // ISO string of the canonical event date
  status?: string;
  tags: string[];
}

/** The full memory snapshot — everything Oracle currently remembers. */
export interface MemorySnapshot {
  generatedAt: string;
  counts: Record<MemoryRecord['category'], number>;
  totalRecords: number;
  records: MemoryRecord[];
  // Aggregate financial truths (all computed from real rows)
  financials: {
    totalSalesInvoiced: number;
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    totalExpenses: number;
    totalGstCollected: number;
    totalGstPaid: number; // ITC
    totalPayables: number;
    totalBankBalance: number;
    totalTdsDeducted: number;
  };
  empty: boolean; // true when the database has no business data at all
}

// ─── Phase 2 — Business Graph ─────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  kind: EntityRef['kind'];
  label: string;
  amount?: number;
  status?: string;
}

export type EdgeKind =
  | 'owns' // client → invoice
  | 'settled_by' // invoice → payment
  | 'supplied' // vendor → purchaseBill
  | 'paid_to' // purchaseBill → payment
  | 'incurred' // client → expense
  | 'filed' // client → gstFiling
  | 'transacted_on' // payment → bankTransaction
  | 'emailed' // client → email
  | 'deducted_for' // client → tds
  | 'held_in'; // payment → bankAccount

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  weight?: number;
  label?: string;
}

export interface BusinessGraph {
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    byKind: Record<string, number>;
  };
}

// ─── Phase 3 — Reasoning Engine ───────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'neutral';
export type InsightCategory =
  | 'cash_flow'
  | 'receivables'
  | 'payables'
  | 'gst'
  | 'customer'
  | 'vendor'
  | 'expense'
  | 'compliance';

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  headline: string; // e.g. "ABC Traders usually pays 11 days late."
  detail: string; // full explanation
  metric?: number; // the computed number behind the conclusion
  metricLabel?: string;
  sources: EntityRef[]; // REAL records this conclusion is built on
  recommendation?: string;
}

export interface ReasoningResult {
  generatedAt: string;
  insights: Insight[];
  executiveSummary: string; // LLM-synthesised narrative grounded in real data
  dataPoints: number; // how many real records informed this
  empty: boolean;
}

// ─── Phase 4 — Timeline ───────────────────────────────────────────────────────

export type TimelineKind =
  | 'invoice_created'
  | 'invoice_paid'
  | 'payment_received'
  | 'payment_sent'
  | 'expense_recorded'
  | 'purchase_recorded'
  | 'gst_filed'
  | 'gst_prepared'
  | 'email_sent'
  | 'tds_deducted'
  | 'bank_transaction'
  | 'bank_synced';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  timestamp: string; // ISO
  title: string;
  description: string;
  amount?: number;
  ref: EntityRef;
  party?: string;
}

export interface TimelineResult {
  generatedAt: string;
  events: TimelineEvent[];
  total: number;
  empty: boolean;
}

// ─── Phase 5 — Command Center ─────────────────────────────────────────────────

export interface CommandResult {
  query: string;
  interpreted: string; // what Oracle understood
  answer: string; // the natural-language answer
  data?: unknown; // the raw rows that back the answer
  sources: EntityRef[];
  durationMs: number;
  empty: boolean;
}

// ─── Phase 6 — Executive Dashboard ────────────────────────────────────────────

export interface ExecutiveDashboard {
  generatedAt: string;
  empty: boolean;
  memory: MemorySnapshot;
  graph: BusinessGraph;
  timeline: TimelineResult;
  reasoning: ReasoningResult;
  // Pre-computed KPIs (all real)
  kpis: {
    revenue30d: number;
    collected30d: number;
    outstandingNow: number;
    overdueNow: number;
    expenses30d: number;
    gstThisMonth: number;
    activeCustomers: number;
    activeVendors: number;
    avgPaymentDelayDays: number;
    cashRunwayDays: number | null;
  };
}
