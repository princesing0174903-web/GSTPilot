// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Type Definitions
// Shared types for the Business Graph™ Operating System (Phase 5 → Phase 6 LIVE).
// Tagline: "Understand Everything. Connect Everything. Predict Everything."
//
// Phase 6 additions (additive, no breaking changes):
//   - 8 new NodeType entries (itc-record, transaction, payment, collection,
//     expense, meeting, asset, loan, tax-payment)
//   - 10 new RelationshipType entries (RECEIVES, SUPPLIES, CLEARS, REDUCES,
//     AFFECTS, MANAGES, DERIVES_FROM, PAID_BY, RECORDED_IN, GENERATES_LIABILITY)
//   - RootCauseChain + RootCauseQuestion types for the Root Cause Engine
//   - LiveGraphEvent type for the live-update event log
//   - GraphState extended with rootCauseChains + liveEvents + memoryGraph
//     extensions (all OPTIONAL fields, backwards compatible)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Module 1: Knowledge Graph Engine ────────────────────────────────────────

export type NodeType =
  | 'business'
  | 'client'
  | 'vendor'
  | 'invoice'
  | 'gst-return'
  | 'bank-account'
  | 'employee'
  | 'task'
  | 'report'
  | 'notice'
  | 'conversation'
  | 'prediction'
  // ── Phase 6 LIVE additions ────────────────────────────────────────────────
  | 'itc-record'      // ITC record derived from PurchaseBill (claimable input tax)
  | 'transaction'     // Bank transaction derived from Payment + Expense + SyncedRecord
  | 'payment'         // Settlement node (customer payment or vendor payment)
  | 'collection'      // Customer collection (Payment with partyType=customer)
  | 'expense'         // Operational expense from Expense table
  | 'meeting'         // Meeting / scheduled interaction (from CommunicationLog)
  | 'asset'           // Business asset (from Expense with category=Asset, or synthesised)
  | 'loan'            // Loan account (from Expense with category=Loan EMI)
  | 'tax-payment';    // Tax payment (TDS + GST paid to government)

export interface NodeLabel {
  type: NodeType;
  emoji: string;
  label: string;
  color: string;   // hex used by the visual explorer
}

export const NODE_LABELS: Record<NodeType, NodeLabel> = {
  business:        { type: 'business',      emoji: '🏢', label: 'Business',       color: '#10b981' },
  client:          { type: 'client',        emoji: '👤', label: 'Client',         color: '#22d3ee' },
  vendor:          { type: 'vendor',        emoji: '🚚', label: 'Vendor',         color: '#f59e0b' },
  invoice:         { type: 'invoice',       emoji: '📄', label: 'Invoice',        color: '#a78bfa' },
  'gst-return':    { type: 'gst-return',    emoji: '🧾', label: 'GST Return',     color: '#34d399' },
  'bank-account':  { type: 'bank-account',  emoji: '🏦', label: 'Bank Account',   color: '#60a5fa' },
  employee:        { type: 'employee',      emoji: '🧑‍💼', label: 'Employee',     color: '#f472b6' },
  task:            { type: 'task',          emoji: '✅', label: 'Task',           color: '#facc15' },
  report:          { type: 'report',        emoji: '📊', label: 'Report',         color: '#fb923c' },
  notice:          { type: 'notice',        emoji: '⚠️', label: 'Notice',         color: '#ef4444' },
  conversation:    { type: 'conversation',  emoji: '💬', label: 'Conversation',   color: '#94a3b8' },
  prediction:      { type: 'prediction',    emoji: '🔮', label: 'Prediction',     color: '#c084fc' },
  // ── Phase 6 LIVE additions ─────────────────────────────────────────────────
  'itc-record':    { type: 'itc-record',    emoji: '💳', label: 'ITC Record',     color: '#22c55e' },
  transaction:     { type: 'transaction',   emoji: '💸', label: 'Transaction',    color: '#0ea5e9' },
  payment:         { type: 'payment',       emoji: '💵', label: 'Payment',        color: '#14b8a6' },
  collection:      { type: 'collection',    emoji: '📥', label: 'Collection',     color: '#06d6a0' },
  expense:         { type: 'expense',       emoji: '🧾', label: 'Expense',        color: '#f43f5e' },
  meeting:         { type: 'meeting',       emoji: '📅', label: 'Meeting',        color: '#8b5cf6' },
  asset:           { type: 'asset',         emoji: '🏗️', label: 'Asset',          color: '#475569' },
  loan:            { type: 'loan',          emoji: '🏦', label: 'Loan',           color: '#dc2626' },
  'tax-payment':   { type: 'tax-payment',   emoji: '🏛️', label: 'Tax Payment',   color: '#7c3aed' },
};

export type RelationshipType =
  | 'OWNS'
  | 'PAYS'
  | 'OWES'
  | 'FILES'
  | 'GENERATES'
  | 'RESPONDS_TO'
  | 'WORKS_WITH'
  | 'ASSIGNED_TO'
  | 'CONNECTED_TO'
  | 'PREDICTED_BY'
  | 'CREATED_BY'
  // ── Phase 6 LIVE additions ─────────────────────────────────────────────────
  | 'RECEIVES'              // Client receives Invoice; Vendor receives Payment
  | 'SUPPLIES'              // Vendor supplies Purchase / Expense
  | 'CLEARS'                // Payment clears Invoice; Collection clears Invoice
  | 'REDUCES'               // Expense reduces Cash; Tax Payment reduces Cash
  | 'AFFECTS'               // Notice affects Compliance; Loan affects Cash Flow
  | 'MANAGES'               // Employee manages Client
  | 'DERIVES_FROM'          // ITC derives from Purchase; Prediction derives from Revenue
  | 'PAID_BY'               // Invoice paid by Bank Transaction
  | 'RECORDED_IN'           // Transaction recorded in Bank Account
  | 'GENERATES_LIABILITY';  // GST Return generates Tax Liability

export interface GraphNode {
  id: string;            // globally unique: `${type}:${entityId}`
  type: NodeType;
  entityId: string;      // the underlying Prisma ID
  label: string;         // human-readable name
  subtitle?: string;     // e.g. "GSTR-1 · 2026-06" or "₹1,25,000"
  amount?: number;       // ₹ involved, if any
  riskScore?: number;    // 0–100 (higher = riskier)
  riskLevel?: RiskLevel; // derived from riskScore
  meta?: Record<string, string | number | boolean>;
  // Visual layout position (computed by engine for first render)
  x?: number;
  y?: number;
  // Explorer display
  expanded?: boolean;
  hidden?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;        // GraphNode.id
  target: string;        // GraphNode.id
  type: RelationshipType;
  weight?: number;       // 1..10 visual weight
  amount?: number;       // ₹ amount flowing along this edge
  label?: string;        // human-readable edge label
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeCountByType: Record<NodeType, number>;
  edgeCountByType: Record<RelationshipType, number>;
}

// ─── Module 3: Risk Graph ────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const RISK_GLYPH: Record<RiskLevel, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  low: '#10b981',
  medium: '#facc15',
  high: '#f97316',
  critical: '#ef4444',
};

export type RiskCategory =
  | 'late_payment'
  | 'gst_notice'
  | 'cash_flow'
  | 'vendor_dependency'
  | 'revenue_concentration'
  | 'compliance'
  | 'fraud';

export interface RiskNode {
  id: string;            // nodeId of the at-risk entity
  nodeId: string;
  entityName: string;
  entityType: NodeType;
  category: RiskCategory;
  level: RiskLevel;
  score: number;         // 0–100
  reasons: string[];
  impact: string;        // human-readable: "₹5,00,000 cash flow impact"
  amountAtRisk?: number;
  recommendation: string;
}

export interface RiskGraph {
  nodes: RiskNode[];
  countByLevel: Record<RiskLevel, number>;
  countByCategory: Record<RiskCategory, number>;
  overallLevel: RiskLevel;     // worst active level
  topRisks: RiskNode[];        // top 5 sorted by score
}

// ─── Module 4: Business Dependency Graph ─────────────────────────────────────

export interface DependencyEdge {
  fromId: string;
  fromName: string;
  fromType: NodeType;
  toId: string;
  toName: string;
  toType: NodeType;
  relationship: RelationshipType;
  amount?: number;
  note: string;          // why this dependency matters
}

export interface DependencyAnswer {
  question: string;      // canonical question text
  answer: string;        // 1–3 sentence NL answer
  bullets: string[];     // supporting bullet list
  relatedNodes: string[];// nodeIds to highlight in the explorer
}

export interface DependencyGraph {
  topRevenueClients: DependencyEdge[];
  criticalVendors: DependencyEdge[];
  noticesAffectingCashFlow: DependencyEdge[];
  invoicesLinkedToOverdueReturns: DependencyEdge[];
  employeesAndTheirClients: DependencyEdge[];
}

// ─── Module 5: Natural Language Graph Queries ────────────────────────────────

export type GraphQueryIntent =
  | 'why_revenue_drop'
  | 'risky_clients'
  | 'overdue_invoices'
  | 'vendor_profitability'
  | 'businesses_with_notices'
  | 'employee_for_client'
  | 'cash_flow_down'
  | 'gst_liability_up'
  | 'most_profitable'
  | 'critical_vendor'
  | 'collection_bottleneck'
  | 'unknown';

export interface GraphQueryResult {
  rawText: string;
  intent: GraphQueryIntent;
  confidence: number;
  answer: string;            // primary NL answer
  bullets: string[];
  relatedNodeIds: string[];  // node IDs to highlight in the Visual Explorer
  relatedRiskIds?: string[]; // risk IDs if relevant
  spokenAck: string;
}

// ─── Module 6: Visual Graph Explorer ─────────────────────────────────────────

export interface ExplorerFilter {
  types: NodeType[];        // visible node types
  minRiskLevel?: RiskLevel; // hide nodes below this risk
  search?: string;          // label/substring match
}

export interface ExplorerLayoutNode {
  id: string;
  x: number;
  y: number;
}

// ─── Module 7: Business Memory Graph ─────────────────────────────────────────

export interface MemoryRelationship {
  id: string;
  subject: string;          // e.g. "ABC Pvt Ltd"
  subjectType: NodeType;
  predicate: string;        // e.g. "usually pays late"
  object?: string;          // e.g. "12 days avg delay"
  evidence: string;         // supporting evidence/source
  recordedAt: string;       // ISO
  category: 'behaviour' | 'performance' | 'history' | 'pattern';
}

export interface BusinessMemoryGraph {
  relationships: MemoryRelationship[];
  insights: string[];       // natural-language remembered insights
  clientBehaviourCount: number;
  teamPerformanceCount: number;
  historyCount: number;
}

// ─── Module 8: Prediction Graph ──────────────────────────────────────────────

export type ScenarioType =
  | 'client_delays_payment'
  | 'revenue_falls_pct'
  | 'gst_liability_increases'
  | 'vendor_price_increase'
  | 'notice_escalation';

export interface WhatIfScenario {
  id: string;
  type: ScenarioType;
  trigger: string;          // human-readable trigger
  assumption: string;       // NL assumption
  impactOnCash: number;     // ₹ delta (negative = drain)
  impactOnRevenue: number;  // ₹ delta
  impactOnGST: number;      // ₹ delta
  impactOnCompliance: number; // score delta 0-100
  impactOnRiskLevel: RiskLevel; // resulting risk level
  affectedNodes: string[];  // node IDs affected
  explanation: string;      // NL explanation chain
}

export interface PredictionGraph {
  scenarios: WhatIfScenario[];
  defaultScenarios: WhatIfScenario[]; // 3 canned scenarios
}

// ─── Module 9: Graph Insights ────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export interface GraphInsight {
  id: string;
  title: string;
  emoji: string;
  severity: InsightSeverity;
  category: 'risk' | 'opportunity' | 'dependency' | 'performance' | 'prediction';
  body: string;
  relatedNodeIds: string[];
  amount?: number;
}

// ─── Module 2: Client Relationship Graph (chains) ────────────────────────────

export interface RelationshipChain {
  id: string;
  title: string;            // "ABC Pvt Ltd cash-flow chain"
  steps: RelationshipChainStep[];
  totalImpact: number;      // ₹ impact at the end of the chain
  riskLevel: RiskLevel;
}

export interface RelationshipChainStep {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  relationship: RelationshipType | 'IMPLIES';
  impact: string;           // "cash flow drops by ₹5,00,000"
  amount?: number;
}

// ─── Aggregated Graph State ──────────────────────────────────────────────────

export interface GraphState {
  knowledgeGraph: KnowledgeGraph;
  riskGraph: RiskGraph;
  dependencyGraph: DependencyGraph;
  dependencyAnswers: DependencyAnswer[]; // pre-computed answers for Module 4 canonical questions
  memoryGraph: BusinessMemoryGraph;
  predictionGraph: PredictionGraph;
  insights: GraphInsight[];
  relationshipChains: RelationshipChain[]; // Module 2 chains
  generatedAt: string;
  hasLiveData: boolean;
  clientCount: number;
  invoiceCount: number;
  filingCount: number;
  noticeCount: number;
  // ── Phase 6 LIVE additions (all optional — backwards compatible) ──────────
  rootCauseChains?: RootCauseChain[];      // Module 11: Root Cause Engine
  liveEvents?: LiveGraphEvent[];           // Module 12: Live Update Event Log
  memory?: BusinessMemoryGraph;            // alias for memoryGraph (Oracle integration)
  sourceCount?: number;                    // connected data sources count
  vendorCount?: number;                    // total vendors in graph
  employeeCount?: number;                  // total employees in graph
  reportCount?: number;                    // total reports in graph
  paymentCount?: number;                   // total payments in graph
  expenseCount?: number;                   // total expenses in graph
  itcCount?: number;                       // total ITC records in graph
  transactionCount?: number;               // total bank transactions in graph
}

// ─── Subgraph responses (for /api/graph/client/:id etc.) ──────────────────────

export interface ClientSubgraph {
  centerNodeId: string;
  graph: KnowledgeGraph;
  riskForClient?: RiskNode;
  relationshipChain?: RelationshipChain;
  insights: GraphInsight[];
}

export interface BusinessSubgraph {
  centerNodeId: string;
  graph: KnowledgeGraph;
  topDependencies: DependencyEdge[];
  riskNodes: RiskNode[];
  insights: GraphInsight[];
}

// ─── Module 11: Root Cause Engine™ (Phase 6) ────────────────────────────────
//
// Answers canonical "why did X happen?" questions by tracing the full
// dependency chain through the Business Graph. Each chain shows the complete
// path from symptom → root cause, with ₹ impact at every hop.

export type RootCauseQuestionId =
  | 'why_revenue_drop'
  | 'why_cash_flow_low'
  | 'which_vendor_caused_delay'
  | 'which_client_affects_profit'
  | 'which_return_created_liability'
  | 'which_employee_manages_client';

export interface RootCauseStep {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  relationship: RelationshipType | 'IMPLIES' | 'THEREFORE';
  impact: string;        // NL impact description for this hop
  amount?: number;       // ₹ amount involved at this hop
  evidence?: string;     // supporting evidence (data point, date, etc.)
}

export interface RootCauseChain {
  id: string;
  questionId: RootCauseQuestionId;
  question: string;            // canonical question text
  answer: string;              // 1-3 sentence NL answer
  rootCause: string;           // the deepest identified cause
  totalImpact: number;         // ₹ total impact (negative = drain)
  steps: RootCauseStep[];      // ordered chain: symptom → ... → root cause
  relatedNodeIds: string[];    // all node IDs touched (for highlighting)
  confidence: number;          // 0..1 confidence in the chain
  evidenceCount: number;       // number of supporting data points
}

// ─── Module 12: Live Update Event Log™ (Phase 6) ────────────────────────────
//
// Whenever data syncs (invoice created, GST filed, bank synced, WhatsApp
// received, email received, task completed, report generated, Oracle answers),
// a LiveGraphEvent is appended. The log retains the last 50 events and is
// surfaced in the graph UI + Oracle context block.

export type LiveEventSource =
  | 'gstn'
  | 'bank'
  | 'gmail'
  | 'whatsapp'
  | 'tally'
  | 'zoho'
  | 'quickbooks'
  | 'oracle'
  | 'reports'
  | 'employees'
  | 'clients'
  | 'vendors'
  | 'invoices'
  | 'returns'
  | 'notices'
  | 'payments'
  | 'expenses'
  | 'system';

export type LiveEventType =
  | 'invoice_created'
  | 'invoice_paid'
  | 'gst_filed'
  | 'gst_notice_received'
  | 'bank_synced'
  | 'transaction_recorded'
  | 'payment_received'
  | 'payment_made'
  | 'expense_recorded'
  | 'whatsapp_received'
  | 'whatsapp_sent'
  | 'email_received'
  | 'email_sent'
  | 'task_completed'
  | 'report_generated'
  | 'oracle_answered'
  | 'client_created'
  | 'vendor_created'
  | 'employee_added'
  | 'itc_claimed'
  | 'prediction_updated'
  | 'connector_synced';

export interface LiveGraphEvent {
  id: string;
  source: LiveEventSource;
  type: LiveEventType;
  title: string;             // short NL title: "Invoice INV-001 created"
  description?: string;      // longer description
  nodeId?: string;           // primary graph node affected
  relatedNodeIds?: string[]; // additional nodes affected
  amount?: number;           // ₹ amount involved
  timestamp: string;         // ISO
}

// ─── Generic Node Subgraph (for /api/graph/node/:id) ─────────────────────────
//
// Returns a 2-hop BFS subgraph around ANY node type (business, client, vendor,
// invoice, gst-return, notice, payment, expense, employee, etc.). Used by the
// new /api/graph/node/:id endpoint.

export interface NodeSubgraph {
  centerNodeId: string;
  centerNode: GraphNode;
  graph: KnowledgeGraph;
  riskForNode?: RiskNode;
  relationshipChains: RelationshipChain[];
  insights: GraphInsight[];
  rootCauseChains: RootCauseChain[];
}

// ─── Vendor Subgraph (for /api/graph/vendor/:id) ────────────────────────────

export interface VendorSubgraph {
  centerNodeId: string;
  graph: KnowledgeGraph;
  totalSpend: number;
  pendingPayables: number;
  overdueBills: number;
  reliabilityScore: number;       // 0..100 (100 = always on time)
  riskForVendor?: RiskNode;
  insights: GraphInsight[];
}

// ─── Invoice Subgraph (for /api/graph/invoice/:id) ──────────────────────────

export interface InvoiceSubgraph {
  centerNodeId: string;
  graph: KnowledgeGraph;
  paymentStatus: string;
  amountPaid: number;
  amountDue: number;
  linkedReturn?: GraphNode;
  linkedPayment?: GraphNode;
  insights: GraphInsight[];
}
