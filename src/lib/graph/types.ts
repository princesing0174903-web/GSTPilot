// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Type Definitions
// Shared types for the Business Graph™ Operating System (Phase 5).
// Tagline: "Understand Everything. Connect Everything. See Connections.
//           Understand Causes. Predict Outcomes. Operate Intelligently."
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
  | 'prediction';

export interface NodeLabel {
  type: NodeType;
  emoji: string;
  label: string;
  color: string;   // hex used by the visual explorer
}

export const NODE_LABELS: Record<NodeType, NodeLabel> = {
  business:      { type: 'business',      emoji: '🏢', label: 'Business',      color: '#10b981' },
  client:        { type: 'client',        emoji: '👤', label: 'Client',        color: '#22d3ee' },
  vendor:        { type: 'vendor',        emoji: '🚚', label: 'Vendor',        color: '#f59e0b' },
  invoice:       { type: 'invoice',       emoji: '📄', label: 'Invoice',       color: '#a78bfa' },
  'gst-return':  { type: 'gst-return',    emoji: '🧾', label: 'GST Return',    color: '#34d399' },
  'bank-account':{ type: 'bank-account',  emoji: '🏦', label: 'Bank Account',  color: '#60a5fa' },
  employee:      { type: 'employee',      emoji: '🧑‍💼', label: 'Employee',     color: '#f472b6' },
  task:          { type: 'task',          emoji: '✅', label: 'Task',          color: '#facc15' },
  report:        { type: 'report',        emoji: '📊', label: 'Report',        color: '#fb923c' },
  notice:        { type: 'notice',        emoji: '⚠️', label: 'Notice',        color: '#ef4444' },
  conversation:  { type: 'conversation',  emoji: '💬', label: 'Conversation',  color: '#94a3b8' },
  prediction:    { type: 'prediction',    emoji: '🔮', label: 'Prediction',    color: '#c084fc' },
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
  | 'CREATED_BY';

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
