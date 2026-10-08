// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — Type Definitions
//
// A living digital replica of every connected business. The twin mirrors the
// real business in real time, remembers every event, and can replay history,
// simulate decisions, and predict the future — all from REAL connected data.
//
// Tagline: "VEYRO Digital Twin™ — Remember Everything. Understand Everything.
//           Simulate Everything. Predict Everything."
//
// Pure server-side TypeScript. No mock values. No placeholders. Everything is
// computed from GSTN, Bank Accounts, Invoices, Expenses, Clients, Collections,
// Returns, Reports, AuditLog, BusinessEvent, FilingEvent, ExecutionTimeline.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. LIVE BUSINESS STATE ──────────────────────────────────────────────────
// One centralized state containing the current reality of the business.

export interface LiveBusinessState {
  // Core financials
  revenue: number;                    // MTD revenue
  profit: number;                     // MTD net profit
  cash: number;                       // current cash + bank balance
  workingCapital: number;             // current assets - current liabilities
  gstPosition: number;                // net GST payable (output - ITC)
  itc: number;                        // input tax credit available

  // Operational
  employees: number;                  // active headcount
  payroll: number;                    // monthly payroll cost
  collections: number;                // collected this month
  receivables: number;                // outstanding AR
  payables: number;                   // outstanding AP
  expenses: number;                   // MTD expenses

  // Asset / liability
  inventory: number;                  // inventory value (if tracked)
  assets: number;                     // total assets
  loans: number;                      // outstanding loan balance
  bankAccounts: BankAccountState[];   // live bank account balances

  // Relationships
  clients: number;                    // active client count
  vendors: number;                    // active vendor count

  // Intelligence
  healthScore: number;                // 0-100
  riskScore: number;                  // 0-100 (higher = riskier)
  compliance: number;                 // 0-100 compliance score
  forecast: TwinForecastSummary;      // forward-looking projection

  // Meta
  asOf: string;                       // ISO timestamp
  hasLiveData: boolean;
  dataSources: string[];
}

export interface BankAccountState {
  id: string;
  bank: string;                       // bank label / connection label
  type: string;                       // 'current' | 'savings' | 'od' | 'cc' | 'salary'
  balance: number;                    // current balance
  syncedAt: string | null;            // last sync
}

export interface TwinForecastSummary {
  revenue30d: number;
  cash30d: number;
  profit30d: number;
  gstLiabilityNext: number;
  confidencePct: number;
}

// ─── 2. BUSINESS TIMELINE™ ───────────────────────────────────────────────────
// A complete chronological history. Every event becomes permanent memory.

export type TimelineEventType =
  | 'invoice_created'
  | 'invoice_paid'
  | 'gst_filed'
  | 'gst_updated'
  | 'bank_synced'
  | 'expense_added'
  | 'employee_added'
  | 'payroll_processed'
  | 'whatsapp_received'
  | 'email_received'
  | 'task_completed'
  | 'collection_received'
  | 'vendor_updated'
  | 'oracle_action'
  | 'notice_received'
  | 'report_generated'
  | 'payment_made'
  | 'purchase_added'
  | 'reconciliation_done'
  | 'return_prepared'
  | 'health_changed'
  | 'risk_changed'
  | 'cash_changed'
  | 'client_added'
  | 'connection_synced'
  | 'decision_simulated'
  | 'anomaly_detected'
  | 'snapshot_created'
  | 'other';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;                      // "Invoice Created" / "Payment Received"
  description: string;                // human-readable detail
  timestamp: string;                  // ISO
  source: string;                     // 'gst' | 'bank' | 'invoice' | 'oracle' | ...
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  actor?: string;                     // who/what triggered it
  entityId?: string;                  // related record id
  entityType?: string;                // 'invoice' | 'client' | 'return' | ...
  amount?: number;                    // monetary impact if any
  metadata?: Record<string, unknown>; // extra context
}

export interface BusinessTimeline {
  events: TimelineEvent[];
  totalCount: number;
  todayCount: number;
  asOf: string;
}

// ─── 3. BUSINESS SNAPSHOTS™ ──────────────────────────────────────────────────
// Automatically created snapshots: daily, weekly, monthly, quarterly, yearly.

export type SnapshotFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface BusinessSnapshot {
  id: string;
  frequency: SnapshotFrequency;
  periodLabel: string;                // "2025-03-15" / "2025-W11" / "2025-03" / "Q1 2025" / "2025"
  periodStart: string;                // ISO
  periodEnd: string;                  // ISO
  revenue: number;
  profit: number;
  cash: number;
  gst: number;
  healthScore: number;
  riskScore: number;
  forecast: number;                   // forecasted revenue for next period
  collections: number;
  expenses: number;
  employees: number;
  assets: number;
  liabilities: number;
  createdAt: string;
}

export interface SnapshotComparison {
  current: BusinessSnapshot;
  previous: BusinessSnapshot | null;
  deltas: SnapshotDelta[];
  summary: string;                    // narrative comparison
}

export interface SnapshotDelta {
  metric: string;
  current: number;
  previous: number;
  delta: number;                      // absolute change
  deltaPct: number;                   // % change
  direction: 'up' | 'down' | 'stable';
}

export interface SnapshotBundle {
  daily: BusinessSnapshot[];
  weekly: BusinessSnapshot[];
  monthly: BusinessSnapshot[];
  quarterly: BusinessSnapshot[];
  yearly: BusinessSnapshot[];
  comparisons: {
    todayVsYesterday: SnapshotComparison;
    thisMonthVsLastMonth: SnapshotComparison;
    thisYearVsLastYear: SnapshotComparison;
  };
  asOf: string;
}

// ─── 4. DIGITAL TWIN PLAYBACK™ ───────────────────────────────────────────────
// Allow business owners to replay history.

export type PlaybackRange = 'yesterday' | 'last_week' | 'last_month' | 'last_quarter' | 'q1' | 'q2' | 'q3' | 'q4' | 'this_year' | 'last_year' | 'all';

export interface PlaybackFrame {
  timestamp: string;
  state: PlaybackState;
  events: TimelineEvent[];           // events that occurred up to this frame
  deltaFromPrevious?: StateDelta[];
}

export interface PlaybackState {
  revenue: number;
  profit: number;
  cash: number;
  healthScore: number;
  riskScore: number;
  collections: number;
  expenses: number;
  employees: number;
}

export interface StateDelta {
  metric: string;
  from: number;
  to: number;
  delta: number;
  deltaPct: number;
  direction: 'up' | 'down' | 'stable';
}

export interface PlaybackResult {
  range: PlaybackRange;
  periodStart: string;
  periodEnd: string;
  totalEvents: number;
  frames: PlaybackFrame[];           // aggregated frames across the range
  startState: PlaybackState;
  endState: PlaybackState;
  evolution: StateDelta[];           // overall change from start to end
  narrative: string;                 // "Revenue grew 12.3% over Q1, driven by..."
}

// ─── 5. DECISION IMPACT ENGINE™ ──────────────────────────────────────────────
// Before any action, Oracle simulates the impact.

export type DecisionType =
  | 'hire_employees'
  | 'open_office'
  | 'increase_salaries'
  | 'buy_equipment'
  | 'take_loan'
  | 'increase_marketing'
  | 'expand_city'
  | 'custom';

export interface DecisionRequest {
  type: DecisionType;
  label: string;                      // "Hire 5 employees"
  params: {
    headcountDelta?: number;          // for hire_employees
    salaryIncreasePct?: number;       // for increase_salaries
    monthlyCost?: number;             // for open_office, increase_marketing, buy_equipment (EMI)
    loanAmount?: number;              // for take_loan
    loanInterestPct?: number;         // annual %
    loanTenureMonths?: number;
    city?: string;                    // for expand_city
    revenueUpliftPct?: number;        // expected revenue increase
    upfrontCost?: number;             // one-time cost
  };
}

export interface DecisionImpact {
  type: DecisionType;
  label: string;

  // Impact dimensions
  cashImpact: number;                 // monthly cash impact (negative = drain)
  profitImpact: number;              // monthly profit impact
  gstImpact: number;                 // monthly GST impact (change in liability)
  riskImpact: number;                // risk score delta (signed)
  workingCapitalImpact: number;      // working capital delta
  healthImpact: number;              // health score delta (signed)

  // Projected state after decision
  projectedCash: number;
  projectedProfit: number;
  projectedHealthScore: number;
  projectedRiskScore: number;
  projectedRunwayDays: number;

  // Verdict
  recommendation: 'go' | 'caution' | 'hold' | 'avoid';
  confidence: number;                // 0-100
  reason: string;                    // why this recommendation
  conditions: string[];              // conditions to watch
  actions: string[];                 // recommended follow-up actions
}

// ─── 6. LIVE KPI ENGINE™ ─────────────────────────────────────────────────────
// Continuously calculated KPIs.

export interface LiveKPIs {
  revenue: number;                    // MTD
  profit: number;                     // MTD net
  cash: number;                       // current
  ebitda: number;                     // MTD
  runwayDays: number;                 // 0 = infinite
  burnRate: number;                   // monthly
  workingCapital: number;
  customerLifetimeValue: number;      // CLV
  averageCollectionTime: number;      // days
  averagePaymentTime: number;         // days
  vendorReliability: number;          // 0-100
  clientReliability: number;          // 0-100
  businessGrowthPct: number;          // MoM
  asOf: string;
}

// ─── 7. BUSINESS ANOMALY DETECTION™ ──────────────────────────────────────────
// Detect abnormal events instantly.

export type AnomalyType =
  | 'revenue_drop'
  | 'expense_spike'
  | 'gst_unusually_high'
  | 'cash_drain'
  | 'duplicate_payment'
  | 'fraud_pattern'
  | 'vendor_overcharging'
  | 'customer_payment_delay'
  | 'collection_drop'
  | 'profit_decline'
  | 'compliance_lag';

export interface BusinessAnomaly {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  metric: string;                     // "Revenue" / "Cash" / etc
  currentValue: number;
  expectedValue: number;
  deviationPct: number;               // how far from expected
  evidence: string[];
  recommendation: string;
  status: 'open' | 'acknowledged' | 'resolved';
}

export interface AnomalyReport {
  anomalies: BusinessAnomaly[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  asOf: string;
  scannedMetrics: string[];
}

// ─── 8. DIGITAL TWIN BUNDLE (full state) ─────────────────────────────────────
// Aggregated response combining every engine.

export interface DigitalTwinBundle {
  state: LiveBusinessState;
  timeline: BusinessTimeline;
  snapshots: SnapshotBundle;
  kpis: LiveKPIs;
  anomalies: AnomalyReport;
  forecast: TwinForecast;
  asOf: string;
  hasLiveData: boolean;
  dataSources: string[];
  tagline: string;
}

export interface TwinForecast {
  revenue: { sevenDay: number; thirtyDay: number; ninetyDay: number; yearEnd: number; confidencePct: number };
  cashFlow: { sevenDay: number; thirtyDay: number; ninetyDay: number; yearEnd: number; confidencePct: number };
  profit: { sevenDay: number; thirtyDay: number; ninetyDay: number; yearEnd: number; confidencePct: number };
  gstLiability: { nextFiling: number; next30d: number; confidencePct: number };
  expenses: { thirtyDay: number; ninetyDay: number; confidencePct: number };
  collections: { thirtyDay: number; ninetyDay: number; confidencePct: number };
  overallConfidencePct: number;
  generatedAt: string;
}

export const TWIN_TAGLINE = 'VEYRO Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';

// ─── 9. ORACLE INTEGRATION ───────────────────────────────────────────────────
// Compact summary injected into Oracle chat context (kept small to avoid token bloat).

export interface TwinOracleContext {
  healthScore: number;
  riskScore: number;
  revenue: number;
  profit: number;
  cash: number;
  runwayDays: number;
  todayEventCount: number;
  recentEvents: TimelineEvent[];      // last 8 — for "what changed today" questions
  latestSnapshot?: BusinessSnapshot;
  activeAnomalies: number;
  criticalAnomalies: number;
  dataSources: string[];
  hasLiveData: boolean;
}
