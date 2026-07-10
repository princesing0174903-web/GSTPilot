// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE NETWORK™ — WORLD BUSINESS NETWORK
// One worldwide business graph. Every organisation becomes a node.
// Customers / Vendors / Suppliers / Partners / Governments / Banks / Investors /
// Employees / Accountants / Auditors / Logistics — all interconnected.
// Oracle coordinates millions of companies simultaneously.
// Tagline: One Network. Every Enterprise. Infinite Intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

export const NETWORK_TAGLINE =
  'GSTPilot Global Enterprise Network™ — One Network. Every Enterprise. Infinite Intelligence.';

// ─── Subsystem identifiers (the 13 specified, all extended on real data) ──────
export const NETWORK_SUBSYSTEMS = [
  'Global Business Graph™',
  'Enterprise Network™',
  'Global Supplier Network™',
  'B2B Commerce Cloud™',
  'Global Payments Network™',
  'Shared AI Knowledge™',
  'Industry Benchmarking™',
  'Trust Network™',
  'Global Opportunity Engine™',
  'Network Observability™',
  'Executive APIs™',
  'Security™',
  'Performance™',
] as const;

export const TOTAL_NETWORK_SUBSYSTEMS = NETWORK_SUBSYSTEMS.length;

// ─── Node types (every business entity in the world graph) ────────────────────
export type NodeType =
  | 'organization'
  | 'customer'
  | 'vendor'
  | 'supplier'
  | 'partner'
  | 'government'
  | 'bank'
  | 'investor'
  | 'accountant'
  | 'auditor'
  | 'logistics';

export type RelationshipType =
  | 'customer'
  | 'vendor'
  | 'supplier'
  | 'partner'
  | 'government'
  | 'bank'
  | 'investor'
  | 'accountant'
  | 'auditor'
  | 'logistics';

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export type RfqStatus = 'open' | 'closed' | 'awarded' | 'cancelled';
export type RfqCategory =
  | 'goods'
  | 'services'
  | 'raw_materials'
  | 'equipment'
  | 'logistics'
  | 'consulting';

export type QuotationStatus = 'submitted' | 'accepted' | 'rejected' | 'expired';
export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'fulfilled'
  | 'cancelled';

export type ContractType =
  | 'supply'
  | 'service'
  | 'partnership'
  | 'nda'
  | 'msa'
  | 'sla';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export type TransactionType =
  | 'invoice'
  | 'purchase_order'
  | 'payment'
  | 'quotation'
  | 'contract'
  | 'document'
  | 'shipment';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'disputed';

export type PaymentMethod =
  | 'domestic_transfer'
  | 'international_wire'
  | 'upi'
  | 'card'
  | 'rtgs'
  | 'neft'
  | 'imps';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed';

export type ShipmentStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'cancelled';

export type OpportunityType =
  | 'new_customer'
  | 'new_supplier'
  | 'partnership'
  | 'new_market'
  | 'cross_sell'
  | 'expansion'
  | 'cost_saving';

export type OpportunityStatus =
  | 'discovered'
  | 'qualified'
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'expired';

export type TrustEventType =
  | 'trust_score_change'
  | 'compliance_update'
  | 'payment_event'
  | 'review'
  | 'verification'
  | 'violation';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type KnowledgeSignal =
  | 'industry_trend'
  | 'best_practice'
  | 'market_opportunity'
  | 'supply_shortage'
  | 'tax_change'
  | 'economic_signal';

export type BenchmarkMetric =
  | 'revenue_growth'
  | 'profitability'
  | 'gst_compliance'
  | 'payroll_efficiency'
  | 'cash_flow'
  | 'ai_adoption'
  | 'operational_efficiency';

// ─── Domain objects ───────────────────────────────────────────────────────────

export interface NetworkNode {
  id: string;
  organizationId: string | null;
  nodeType: NodeType;
  legalName: string;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string;
  state: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  sector: string | null;
  employeeCount: number;
  annualRevenue: number;
  yearsInBusiness: number;
  trustScore: number;
  complianceScore: number;
  paymentReliabilityScore: number;
  supplierRating: number;
  customerRating: number;
  aiConfidenceScore: number;
  riskLevel: RiskLevel;
  verified: boolean;
  verificationDate: string | null;
  verificationSource: string | null;
  totalConnections: number;
  totalTransactions: number;
  totalTransactionValue: number;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkEdgeSummary {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromName: string;
  toName: string;
  relationshipType: RelationshipType;
  status: string;
  strength: number;
  totalTransactionValue: number;
  transactionCount: number;
  startedAt: string;
}

export interface NetworkConnectionSummary {
  id: string;
  fromOrgId: string;
  toOrgId: string;
  fromNodeName: string;
  toNodeName: string;
  status: ConnectionStatus;
  relationshipType: RelationshipType;
  message: string | null;
  initiatedBy: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface RfqSummary {
  id: string;
  rfqNumber: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string | null;
  toName: string | null;
  title: string;
  description: string;
  category: RfqCategory;
  quantity: number;
  unit: string;
  budgetMax: number;
  currency: string;
  deliveryDate: string | null;
  deliveryLocation: string | null;
  status: RfqStatus;
  quotationsCount: number;
  createdAt: string;
}

export interface QuotationSummary {
  id: string;
  rfqId: string;
  rfqNumber: string;
  fromNodeId: string;
  fromName: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  totalPrice: number;
  deliveryDays: number;
  validUntil: string | null;
  status: QuotationStatus;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string;
  toName: string;
  title: string;
  totalValue: number;
  currency: string;
  status: PurchaseOrderStatus;
  deliveryDate: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  createdAt: string;
}

export interface ContractSummary {
  id: string;
  contractNumber: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string;
  toName: string;
  title: string;
  type: ContractType;
  value: number;
  currency: string;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  terms: string | null;
  signedAt: string | null;
  createdAt: string;
}

export interface TransactionSummary {
  id: string;
  transactionNumber: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string | null;
  toName: string | null;
  type: TransactionType;
  reference: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface PaymentSummary {
  id: string;
  paymentNumber: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string;
  toName: string;
  poId: string | null;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  fxRate: number;
  settledAt: string | null;
  createdAt: string;
}

export interface ShipmentSummary {
  id: string;
  shipmentNumber: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string;
  toName: string;
  carrier: string | null;
  trackingNumber: string | null;
  origin: string | null;
  destination: string | null;
  status: ShipmentStatus;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface OpportunitySummary {
  id: string;
  forNodeId: string;
  forName: string;
  type: OpportunityType;
  title: string;
  description: string;
  potentialValue: number;
  currency: string;
  probability: number;
  source: string;
  status: OpportunityStatus;
  createdAt: string;
}

export interface TrustEventSummary {
  id: string;
  nodeId: string;
  nodeName: string;
  eventType: TrustEventType;
  delta: number;
  newScore: number | null;
  description: string;
  createdAt: string;
}

export interface BenchmarkSummary {
  id: string;
  industry: string;
  metric: BenchmarkMetric;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleSize: number;
  period: string;
  createdAt: string;
}

export interface SharedKnowledgeSummary {
  id: string;
  signal: KnowledgeSignal;
  title: string;
  description: string;
  industry: string | null;
  region: string | null;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  affectedMetrics: string | null;
  sourcesCount: number;
  createdAt: string;
}

// ─── Subsystem summaries ──────────────────────────────────────────────────────

export interface BusinessGraphSummary {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  verifiedNodes: number;
  avgTrustScore: number;
  topIndustries: Array<{ industry: string; count: number }>;
  topRegions: Array<{ region: string; count: number }>;
  networkDensity: number;
  totalTransactionValue: number;
}

export interface EnterpriseNetworkSummary {
  totalConnections: number;
  pendingConnections: number;
  acceptedConnections: number;
  activeCollaborations: number;
  sharedWorkflows: number;
  exchangedDocuments: number;
  exchangedInvoices: number;
  exchangedPurchaseOrders: number;
  exchangedContracts: number;
  recentConnections: NetworkConnectionSummary[];
}

export interface SupplierNetworkSummary {
  totalSuppliers: number;
  verifiedSuppliers: number;
  avgSupplierRating: number;
  avgDeliveryDays: number;
  avgPaymentTerms: number;
  suppliersByCategory: Record<string, number>;
  topSuppliers: NetworkNode[];
  oracleRecommendations: Array<{
    supplierName: string;
    reason: string;
    rating: number;
    expectedSaving: number;
  }>;
}

export interface B2BCommerceSummary {
  totalRfqs: number;
  openRfqs: number;
  totalQuotations: number;
  totalPurchaseOrders: number;
  totalContracts: number;
  activeContracts: number;
  totalRfqValue: number;
  totalPoValue: number;
  totalContractValue: number;
  recentRfqs: RfqSummary[];
  recentPurchaseOrders: PurchaseOrderSummary[];
  recentContracts: ContractSummary[];
}

export interface PaymentsNetworkSummary {
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  totalPaymentValue: number;
  domesticValue: number;
  internationalValue: number;
  byMethod: Record<string, { count: number; value: number }>;
  byCurrency: Record<string, number>;
  reconciliationRate: number;
  treasuryVisibility: number;
  recentPayments: PaymentSummary[];
}

export interface SharedAISummary {
  totalSignals: number;
  bySignal: Record<string, number>;
  highImpactSignals: number;
  avgConfidence: number;
  recentSignals: SharedKnowledgeSummary[];
  detectedTrends: Array<{
    trend: string;
    confidence: number;
    affectedIndustries: string[];
  }>;
}

export interface BenchmarkingSummary {
  totalBenchmarks: number;
  industriesCovered: number;
  metricsCovered: number;
  totalSamples: number;
  benchmarks: BenchmarkSummary[];
  industries: string[];
}

export interface TrustNetworkSummary {
  avgTrustScore: number;
  avgComplianceScore: number;
  avgPaymentReliabilityScore: number;
  avgSupplierRating: number;
  avgCustomerRating: number;
  avgAiConfidenceScore: number;
  trustDistribution: { high: number; medium: number; low: number };
  verifiedNodes: number;
  verificationRate: number;
  totalTrustEvents: number;
  recentTrustEvents: TrustEventSummary[];
  topTrustedNodes: NetworkNode[];
  atRiskNodes: NetworkNode[];
}

export interface OpportunityEngineSummary {
  totalOpportunities: number;
  discoveredOpportunities: number;
  qualifiedOpportunities: number;
  proposedOpportunities: number;
  acceptedOpportunities: number;
  totalPotentialValue: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  avgProbability: number;
  topOpportunities: OpportunitySummary[];
}

export interface ObservabilitySummary {
  connectedOrganizations: number;
  activeCollaborations: number;
  transactionsToday: number;
  transactions30d: number;
  paymentsFlowing: number;
  supplyChainHealth: number;
  networkHealth: number;
  transactionsByDay: Array<{ day: string; count: number; value: number }>;
  transactionsByType: Record<string, number>;
  networkLatency: number;
  errorRate: number;
  topActiveNodes: Array<{ nodeId: string; name: string; activity: number }>;
}

export interface NetworkSecuritySummary {
  organizationIsolation: boolean;
  rbacEnforced: boolean;
  zeroTrust: boolean;
  e2eEncryption: boolean;
  digitalSignatures: boolean;
  auditLogs: boolean;
  consentManagement: boolean;
  dataResidency: boolean;
  auditEvents30d: number;
  consentRecords: number;
  securityScore: number;
}

export interface NetworkPerformanceSummary {
  targetOrganizations: number;
  currentOrganizations: number;
  targetRelationships: number;
  currentRelationships: number;
  targetDailyTransactions: number;
  currentDailyTransactions: number;
  regions: number;
  multiRegion: boolean;
  edgeSynchronization: boolean;
  distributedGraph: boolean;
  utilization: number;
  p95Latency: number;
  uptime: number;
}

// ─── Top-level dashboard ──────────────────────────────────────────────────────

export interface NetworkDashboard {
  tagline: string;
  generatedAt: string;
  cacheTtlMs: number;
  hasLiveData: boolean;
  subsystemsImplemented: number;
  subsystemsTotal: number;
  subsystems: string[];
  dataSources: string[];

  // Headline KPIs
  totalNodes: number;
  totalEdges: number;
  totalConnections: number;
  totalTransactions: number;
  totalTransactionValue: number;
  totalOpportunities: number;
  totalPotentialValue: number;
  avgTrustScore: number;
  totalRfqs: number;
  totalPayments: number;
  totalPaymentValue: number;
  verifiedNodes: number;
  activeCollaborations: number;

  // Subsystem summaries
  businessGraph: BusinessGraphSummary;
  enterpriseNetwork: EnterpriseNetworkSummary;
  suppliers: SupplierNetworkSummary;
  commerce: B2BCommerceSummary;
  payments: PaymentsNetworkSummary;
  knowledge: SharedAISummary;
  benchmarking: BenchmarkingSummary;
  trust: TrustNetworkSummary;
  opportunities: OpportunityEngineSummary;
  observability: ObservabilitySummary;
  security: NetworkSecuritySummary;
  performance: NetworkPerformanceSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatCompactINR(value: number): string {
  if (!value || value === 0) return '₹0';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

export function formatCompact(value: number): string {
  if (!value || value === 0) return '0';
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
