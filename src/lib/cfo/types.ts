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
