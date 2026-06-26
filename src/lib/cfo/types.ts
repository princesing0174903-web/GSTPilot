// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Type Definitions
// Shared types for the AI CFO Operating System (Phase 3).
// ═══════════════════════════════════════════════════════════════════════════════

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskGlyph {
  level: RiskLevel;
  glyph: string; // 🟢 🟡 🔴
  label: string;
}

export const RISK_GLYPHS: Record<RiskLevel, RiskGlyph> = {
  low: { level: 'low', glyph: '🟢', label: 'Low' },
  medium: { level: 'medium', glyph: '🟡', label: 'Medium' },
  high: { level: 'high', glyph: '🔴', label: 'High' },
};

// ─── Module 1: CFO Dashboard ───────────────────────────────────────────────────

export interface RevenueSnapshot {
  today: number;
  thisMonth: number;
  lastMonth: number;
  growthPct: number; // signed %
  sparkline: number[]; // last 8 months
}

export interface ProfitSnapshot {
  grossProfit: number;
  netProfit: number;
  marginPct: number;
  grossMarginPct: number;
}

export interface CashSnapshot {
  currentBalance: number;
  availableCash: number;
  runwayDays: number; // 0 = infinite / unknown
  burnRatePerDay: number;
}

export interface ReceivablesSnapshot {
  pendingCollections: number;
  overdueCollections: number;
  collectionEfficiencyPct: number;
  overdueCount: number;
}

export interface PayablesSnapshot {
  vendorDues: number;
  upcomingPayments: number; // next 30 days
  upcomingCount: number;
}

export interface GSTSnapshot {
  liability: number;
  itcAvailable: number;
  upcomingDueDates: Array<{ returnType: string; period: string; dueDate: string; daysLeft: number }>;
}

export interface HealthScoreSnapshot {
  overall: number; // 0-100
  compliance: number;
  cashFlow: number;
  growth: number;
  profitability: number;
  risk: number;
  collections: number;
  // Phase 3 — extended to 8 dimensions
  revenue: number;
  liquidity: number;
  /** Human-readable explanation of WHY the score changed */
  drivers: HealthScoreDriver[];
}

export interface HealthScoreDriver {
  label: string;
  direction: 'up' | 'down' | 'stable';
  impact: number; // signed contribution to overall
  note: string;
}

export interface CFODashboard {
  revenue: RevenueSnapshot;
  profit: ProfitSnapshot;
  cash: CashSnapshot;
  receivables: ReceivablesSnapshot;
  payables: PayablesSnapshot;
  gst: GSTSnapshot;
  healthScore: HealthScoreSnapshot;
}

// ─── Module 2: Financial Prediction Engine ─────────────────────────────────────

export interface RevenueForecast {
  sevenDay: number;
  thirtyDay: number;
  ninetyDay: number;
  yearEnd: number;
  confidencePct: number;
}

export interface CashFlowForecast {
  dailyPosition: number; // projected cash at end of today
  monthlyPosition: number; // projected cash at end of month
  burnRatePerDay: number;
  runwayDays: number;
  confidencePct: number;
}

export interface GSTForecast {
  upcomingLiability: number;
  itcUtilization: number; // % of available ITC expected to be utilized
  refundPrediction: number;
  confidencePct: number;
}

export interface CollectionForecast {
  paymentDelays: number; // expected # of delayed payments next 30d
  riskyClients: Array<{ name: string; gstin: string; riskScore: number; outstanding: number }>;
  expectedCollections: number; // next 30 days
  confidencePct: number;
}

export interface CFOPredictions {
  revenue: RevenueForecast;
  cashFlow: CashFlowForecast;
  gst: GSTForecast;
  collections: CollectionForecast;
}

// ─── Module 3: Business Risk Engine ────────────────────────────────────────────

export type RiskCategory =
  | 'revenue'
  | 'compliance'
  | 'cash'
  | 'collection'
  | 'notice'
  | 'profitability';

export interface RiskAssessment {
  category: RiskCategory;
  level: RiskLevel;
  score: number; // 0-100 (higher = riskier)
  reasons: string[];
  recommendation?: string;
}

// ─── Module 4: Daily CFO Brief ─────────────────────────────────────────────────

export interface PriorityAction {
  id: string;
  title: string;
  detail: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  actionType: 'recover' | 'file' | 'respond' | 'claim' | 'pay' | 'review';
  amount?: number;
}

export interface DailyBrief {
  greeting: string;
  dateLabel: string;
  snapshot: {
    revenue: number;
    cashPosition: number;
    receivables: number;
    payables: number;
    gstLiability: number;
    itcAvailable: number;
  };
  healthScore: number;
  priorityActions: PriorityAction[];
}

// ─── Module 6: CFO Recommendation Engine ───────────────────────────────────────

export type RecommendationType =
  | 'revenue_falling'
  | 'cash_shortage'
  | 'itc_opportunity'
  | 'growth_opportunity'
  | 'compliance_risk'
  | 'collection_risk';

export interface CFORecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  headline: string;
  description: string;
  severity: 'critical' | 'warning' | 'opportunity' | 'info';
  actions: string[];
  metric?: { label: string; value: string };
}

// ─── Module 8: CFO Memory ──────────────────────────────────────────────────────

export interface ClientBehaviorRecord {
  clientName: string;
  gstin: string;
  delays: number;
  averageDelayDays: number;
  totalOutstanding: number;
  lastPaymentDate?: string;
  riskLabel: string;
}

export interface CFOMemory {
  revenueTrends: Array<{ month: string; value: number; trend: 'up' | 'down' | 'stable' }>;
  collectionHistory: Array<{ month: string; collected: number; overdue: number }>;
  cashPatterns: Array<{ quarter: string; avgBalance: number; shortageRisk: RiskLevel }>;
  clientBehavior: ClientBehaviorRecord[];
  filingHistory: Array<{ period: string; filed: number; pending: number; overdue: number }>;
  insights: string[]; // natural-language remembered insights
}

// ─── Aggregate response ────────────────────────────────────────────────────────

export interface CFOResponse {
  dashboard: CFODashboard;
  predictions: CFOPredictions;
  risks: RiskAssessment[];
  brief: DailyBrief;
  recommendations: CFORecommendation[];
  memory: CFOMemory;
  generatedAt: string;
  hasLiveData: boolean;
  clientCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — AI CFO™ Extensions
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Extended CFO Dashboard metrics (Phase 3) ──────────────────────────────────

export interface ExtendedCFOMetrics {
  expenses: number;                  // this month
  operatingMarginPct: number;        // operating margin %
  bankBalance: number;               // distinct from cash — bank account balance
  workingCapital: number;            // AR - AP
  monthlyBurnRate: number;           // avg monthly cash outflow
  revenueGrowthPct: number;          // signed % (already in revenue but explicit)
  profitTrend: 'up' | 'down' | 'stable';
  upcomingPayments: number;          // next 30 days (already in payables but explicit)
  upcomingCollections: number;       // next 30 days expected
}

// ─── Module 10: Automatic Financial Analysis (Phase 3) ────────────────────────

export type AnalysisConditionType =
  | 'revenue_decline'
  | 'expense_increase'
  | 'profit_reduction'
  | 'negative_cash_flow'
  | 'collection_delays'
  | 'gst_penalties'
  | 'itc_opportunities'
  | 'duplicate_expenses'
  | 'vendor_risks'
  | 'customer_risks'
  | 'late_payments';

export interface FinancialCondition {
  type: AnalysisConditionType;
  severity: 'critical' | 'warning' | 'info' | 'opportunity';
  title: string;
  description: string;
  metric?: { label: string; value: string; delta?: string };
  detected: boolean;
  evidence?: string[];
}

export interface FinancialAnalysis {
  conditions: FinancialCondition[];
  detectedCount: number;
  criticalCount: number;
}

// ─── Module 11: Smart CFO Insights (Phase 3) ───────────────────────────────────

export interface SmartInsight {
  id: string;
  category: 'risk' | 'opportunity' | 'action' | 'summary';
  title: string;
  detail: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  metric?: { label: string; value: string };
  actionLabel?: string;
  actionView?: string;
}

export type SummaryPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PeriodSummary {
  period: SummaryPeriod;
  label: string;
  headline: string;
  revenue: number;
  expenses: number;
  profit: number;
  highlights: string[];
  concerns: string[];
  outlook: string;
}

export interface SmartCFOInsights {
  topRisks: SmartInsight[];
  topOpportunities: SmartInsight[];
  urgentActions: SmartInsight[];
  summaries: PeriodSummary[];
}

// ─── Module 12: What-If Simulator (Phase 3) ────────────────────────────────────

export type WhatIfScenarioType =
  | 'revenue_change'
  | 'expense_change'
  | 'headcount_change'
  | 'gst_change'
  | 'collection_improvement';

export interface WhatIfScenario {
  type: WhatIfScenarioType;
  label: string;
  description: string;
  /** The user-facing change magnitude (e.g. -20 for "revenue falls 20%") */
  changePct: number;
  /** Optional absolute headcount delta for headcount_change */
  headcountDelta?: number;
}

export interface WhatIfResult {
  scenario: WhatIfScenario;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedProfit: number;
  projectedCash: number;
  projectedRunwayDays: number;
  projectedHealthScore: number;
  deltaRevenue: number;
  deltaProfit: number;
  deltaCash: number;
  deltaHealthScore: number;
  verdict: string;
  recommendation: string;
  confidencePct: number;
}

// ─── Module 13: CFO Report Generation (Phase 3) ───────────────────────────────

export type CFOReportType =
  | 'executive_summary'
  | 'financial_report'
  | 'cash_flow_report'
  | 'profit_report'
  | 'gst_report'
  | 'risk_report'
  | 'board_report'
  | 'monthly_cfo'
  | 'quarterly_cfo'
  | 'annual_review';

export interface CFOReportSection {
  title: string;
  /** Key-value pairs rendered as a clean two-column table */
  metrics?: Array<{ label: string; value: string; delta?: string }>;
  /** Narrative paragraphs */
  narrative?: string[];
  /** Tabular data with headers */
  table?: { headers: string[]; rows: string[][] };
  /** Bullet recommendations */
  bullets?: string[];
}

export interface CFOReport {
  type: CFOReportType;
  title: string;
  subtitle: string;
  generatedAt: string;
  period: string;
  sections: CFOReportSection[];
  healthScore: number;
  firmName?: string;
}

// ─── Extended CFOResponse (Phase 3) ───────────────────────────────────────────

export interface CFOResponseV2 extends CFOResponse {
  extended: ExtendedCFOMetrics;
  analysis: FinancialAnalysis;
  insights: SmartCFOInsights;
}
