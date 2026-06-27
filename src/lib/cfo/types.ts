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

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — AI CFO™ FINANCIAL INTELLIGENCE ENGINE
// "Every business deserves a world-class CFO."
//
// Pure server-side TypeScript modules that read connected business data
// (GSTN, Bank, Invoices, Expenses, Clients, Collections, Returns, Reports,
//  Business Graph) and compute real CFO-grade analytics.
// No mock values. No placeholder analytics.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Real Financial Health Score (Phase 1) ────────────────────────────────────

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HealthScoreFactor {
  key: string;                     // 'revenue_growth' | 'profit_margin' | ...
  label: string;                   // Human-readable label
  rawValue: number;                // Raw metric (e.g. growthPct=12.5)
  rawUnit: 'percent' | 'inr' | 'days' | 'count' | 'ratio';
  score: number;                   // 0-100 sub-score for this factor
  weight: number;                  // 0-1, weights sum to 1.0
  contribution: number;            // score * weight (signed contribution to overall)
  direction: 'up' | 'down' | 'stable';
  explanation: string;             // WHY this factor scored this way
  benchmark?: string;              // Industry benchmark text
}

export interface RealFinancialHealthScore {
  overall: number;                 // 0-100 weighted
  tier: 'excellent' | 'healthy' | 'attention' | 'at_risk' | 'critical';
  factors: HealthScoreFactor[];    // 10 factors with full explanation
  summary: string;                 // 1-2 sentence executive summary
  topDriver: string;               // Biggest positive driver
  topDrag: string;                 // Biggest negative driver
  asOfDate: string;
}

// ─── Revenue Engine (Phase 1) ─────────────────────────────────────────────────

export interface RevenuePeriodBreakdown {
  monthly: Array<{ month: string; revenue: number; growthPct: number }>;
  quarterly: Array<{ quarter: string; revenue: number; growthPct: number }>;
  yearly: Array<{ year: string; revenue: number; growthPct: number }>;
  ytdRevenue: number;
  ytdGrowthPct: number;
}

export interface RevenueByClient {
  clientId: string;
  clientName: string;
  gstin: string;
  revenue: number;
  invoiceCount: number;
  sharePct: number;                // % of total revenue
  trend: 'up' | 'down' | 'stable';
}

export interface RevenueByIndustry {
  industry: string;
  revenue: number;
  sharePct: number;
  clientCount: number;
}

export interface RevenueAnalytics {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisQuarter: number;
  thisYear: number;
  lastMonth: number;
  growthPct: number;               // MoM
  qoqGrowthPct: number;            // Quarter-on-quarter
  yoyGrowthPct: number;            // Year-on-year
  periods: RevenuePeriodBreakdown;
  byClient: RevenueByClient[];     // top 10
  byIndustry: RevenueByIndustry[]; // top 10
  topClients: Array<{ name: string; revenue: number; sharePct: number; trend: 'up' | 'down' | 'stable' }>;
  trend: 'up' | 'down' | 'stable';
  forecast: { thirtyDay: number; ninetyDay: number; yearEnd: number };
  sparkline: number[];             // last 12 months
}

// ─── Profitability Engine (Phase 1) ───────────────────────────────────────────

export interface ProfitMonthlyTrend {
  month: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  netProfit: number;
  grossMarginPct: number;
  operatingMarginPct: number;
  netMarginPct: number;
  ebitdaMarginPct: number;
}

export interface CustomerProfitability {
  clientId: string;
  clientName: string;
  revenue: number;
  directCost: number;              // cost attributable to serving this client
  grossProfit: number;
  grossMarginPct: number;
  netProfit: number;
  profitRank: number;              // 1 = most profitable
}

export interface VendorCostRow {
  vendorName: string;
  vendorGstin?: string;
  totalSpend: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  sharePct: number;                // % of total vendor spend
  overdueAmount: number;
}

export interface ProfitabilityAnalytics {
  revenue: number;                 // this month
  cogs: number;                    // cost of goods/services delivered (purchase bills + attributable)
  grossProfit: number;
  grossMarginPct: number;
  opex: number;                    // operating expenses (excl. COGS)
  operatingMarginPct: number;
  ebitda: number;                  // earnings before interest, tax, depreciation, amortization
  ebitdaMarginPct: number;
  netProfit: number;
  netMarginPct: number;
  expenseRatioPct: number;         // total expenses / revenue
  monthlyTrends: ProfitMonthlyTrend[]; // last 6 months
  customerProfitability: CustomerProfitability[]; // top 10 + bottom 5
  vendorCosts: VendorCostRow[];    // top 10 vendors by spend
  trend: 'up' | 'down' | 'stable';
}

// ─── Cash Flow Engine (Phase 1) ───────────────────────────────────────────────

export interface CashFlowProjection {
  period: '7d' | '30d' | '90d' | '365d';
  inflow: number;                  // expected collections + other inflows
  outflow: number;                 // expected expenses + payables + GST
  net: number;                     // inflow - outflow
  endingCash: number;              // projected closing balance
  confidencePct: number;
}

export interface CashFlowAnalytics {
  currentCash: number;             // bank + cash on hand
  availableCash: number;           // current - reserve
  burnRatePerDay: number;          // daily cash outflow
  burnRatePerMonth: number;
  runwayDays: number;              // 0 = infinite
  runwayDate: string | null;       // ISO date when cash runs out (null if >365d)
  inflowThisMonth: number;
  outflowThisMonth: number;
  netThisMonth: number;
  projections: CashFlowProjection[]; // 4 periods
  whyDecreasing: string[];         // root-cause explanations for cash decline
  trend: 'up' | 'down' | 'stable';
}

// ─── Working Capital Engine (Phase 1) ─────────────────────────────────────────

export interface WorkingCapitalAnalytics {
  currentAssets: number;           // cash + AR + inventory + prepaid
  currentLiabilities: number;      // AP + GST payable + accrued + short-term debt
  workingCapital: number;          // CA - CL
  workingCapitalRatio: number;     // CA / CL
  quickRatio: number;              // (CA - inventory) / CL
  liquidityRisk: SeverityLevel;
  liquidityRiskReason: string;
  accountsReceivable: number;
  accountsPayable: number;
  inventoryValue: number;
  prepaidExpenses: number;
  shortTermDebt: number;
  trend: 'up' | 'down' | 'stable';
}

// ─── Expense Engine (Phase 1) ─────────────────────────────────────────────────

export type ExpenseCategory =
  | 'payroll' | 'gst' | 'rent' | 'utilities' | 'software'
  | 'marketing' | 'travel' | 'professional_fees' | 'subscriptions' | 'other';

export interface ExpenseCategoryBreakdown {
  category: ExpenseCategory;
  label: string;
  amount: number;
  sharePct: number;                // % of total expenses
  invoiceCount: number;
  momChangePct: number;            // month-over-month change
  trend: 'up' | 'down' | 'stable';
}

export interface ExpenseAnalytics {
  totalThisMonth: number;
  totalLastMonth: number;
  momChangePct: number;
  avgMonthly: number;               // last 6 months average
  byCategory: ExpenseCategoryBreakdown[];
  monthlyTrends: Array<{ month: string; total: number; byCategory: Record<ExpenseCategory, number> }>;
  topVendors: Array<{ vendor: string; amount: number; count: number }>;
  recurringExpenses: number;       // total monthly recurring
  oneTimeExpenses: number;
  trend: 'up' | 'down' | 'stable';
}

// ─── Collection Engine (Phase 1) ──────────────────────────────────────────────

export interface CollectionRow {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientGstin: string;
  invoiceAmount: number;
  outstandingAmount: number;
  invoiceDate: string;
  dueDate: string | null;
  daysOverdue: number;             // 0 if not overdue
  collectionProbabilityPct: number; // 0-100
  badDebtRisk: SeverityLevel;
  recoveryStrategy: string;        // recommended action
}

export interface CollectionAnalytics {
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  expectedCollections30d: number;
  averageDaysToPay: number;
  collectionEfficiencyPct: number;
  badDebtReserve: number;          // estimated uncollectable
  latePayments: CollectionRow[];   // sorted by daysOverdue desc
  riskyClients: Array<{ name: string; gstin: string; outstanding: number; overdue: number; riskScore: number }>;
  recoveryStrategy: string[];      // top-level recommendations
  trend: 'up' | 'down' | 'stable';
}

// ─── Forecast Engine (Phase 1) ────────────────────────────────────────────────

export interface ForecastRow {
  metric: 'revenue' | 'cash_flow' | 'profit' | 'gst_liability' | 'expenses' | 'collections';
  label: string;
  currentValue: number;
  sevenDay: number;
  thirtyDay: number;
  ninetyDay: number;
  yearEnd: number;
  confidencePct: number;
  trend: 'up' | 'down' | 'stable';
  drivers: string[];               // what's driving the forecast
}

export interface ForecastAnalytics {
  rows: ForecastRow[];             // 6 metrics
  overallConfidencePct: number;
  methodology: string;             // brief explanation of how forecasts are computed
  generatedAt: string;
}

// ─── Business Risk Engine v2 (Phase 1) ────────────────────────────────────────

export type BusinessRiskType =
  | 'cash_shortage' | 'revenue_drop' | 'profit_decline' | 'gst_risk'
  | 'itc_loss' | 'customer_concentration' | 'vendor_dependency'
  | 'late_payments' | 'compliance_risk' | 'liquidity_risk';

export interface BusinessRisk {
  type: BusinessRiskType;
  label: string;
  severity: SeverityLevel;         // low | medium | high | critical
  score: number;                   // 0-100 (higher = riskier)
  current: string;                 // current state description
  threshold: string;               // what triggers next severity
  impact: string;                  // financial/business impact
  evidence: string[];              // supporting data points
  recommendation: string;          // mitigation action
}

export interface BusinessRiskEngine {
  risks: BusinessRisk[];
  overallRiskLevel: SeverityLevel;
  overallRiskScore: number;
  criticalCount: number;
  highCount: number;
  generatedAt: string;
}

// ─── AI CFO Recommendations v2 (Phase 1) ──────────────────────────────────────

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface AIRecommendation {
  id: string;
  title: string;                   // "Reduce marketing spend"
  reason: string;                  // WHY this is recommended
  financialImpact: string;         // "Saves ₹2.4L/month"
  financialImpactValue: number;    // numeric value for sorting
  priority: RecommendationPriority;
  confidencePct: number;           // 0-100
  category: 'cost_reduction' | 'revenue_acceleration' | 'cash_flow' | 'compliance' | 'growth' | 'risk_mitigation';
  actions: string[];               // specific steps
  timeframe: 'immediate' | '7_days' | '30_days' | '90_days';
}

export interface AIRecommendations {
  recommendations: AIRecommendation[];
  totalImpactValue: number;        // sum of financialImpactValue (positive = savings/gains)
  criticalCount: number;
  generatedAt: string;
}

// ─── Executive Summary (Phase 1) ──────────────────────────────────────────────

export interface ExecutiveSummary {
  headline: string;                // 1-line business status
  healthScore: number;             // 0-100
  healthTier: string;
  revenueThisMonth: number;
  revenueGrowthPct: number;
  netProfit: number;
  netMarginPct: number;
  cashPosition: number;
  runwayDays: number;
  burnRatePerDay: number;
  topRisk: string;                 // 1-line top risk
  topOpportunity: string;          // 1-line top opportunity
  keyMetrics: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'stable' }>;
  generatedAt: string;
}

// ─── GST & ITC Position (Phase 1) ─────────────────────────────────────────────

export interface GSTPositionAnalytics {
  outputLiability: number;         // current period output tax
  inputTaxCredit: number;          // ITC available
  netGSTPayable: number;           // output - ITC
  itcUtilizationPct: number;       // ITC used / available
  pendingFilings: number;
  overdueFilings: number;
  upcomingDueDates: Array<{ returnType: string; period: string; dueDate: string; daysLeft: number; liability: number }>;
  itcAtRisk: number;               // ITC expiring soon (180-day rule)
  itcReversalRisk: number;         // ITC to reverse (rule 37)
  filingHistory: Array<{ period: string; filed: boolean; onTime: boolean; liability: number }>;
}

// ─── Full Phase 1 Financial Intelligence Bundle ───────────────────────────────

export interface FinancialIntelligenceBundle {
  executiveSummary: ExecutiveSummary;
  healthScore: RealFinancialHealthScore;
  revenue: RevenueAnalytics;
  profitability: ProfitabilityAnalytics;
  cashFlow: CashFlowAnalytics;
  workingCapital: WorkingCapitalAnalytics;
  expenses: ExpenseAnalytics;
  collections: CollectionAnalytics;
  gst: GSTPositionAnalytics;
  forecast: ForecastAnalytics;
  risks: BusinessRiskEngine;
  recommendations: AIRecommendations;
  generatedAt: string;
  hasLiveData: boolean;
  dataSources: string[];           // ['GSTN', 'Bank', 'Invoices', ...]
  clientCount: number;
  invoiceCount: number;
  tagline: string;
}
