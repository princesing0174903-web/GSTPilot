// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Type Definitions
// Phase 8 Step 3 — Shared types for the Invoice Cloud™ / Payables Cloud™ /
// Expense Cloud™ / Payroll Cloud™ / TDS Cloud™ / AI Cash Conversion Engine.
//
// Pure TypeScript — importable from both client and server. No Prisma, no Next.
// Field names mirror prisma/schema.prisma exactly (Invoice, PurchaseBill,
// Expense, Payment, Employee, Payroll, RevenueForecast, TDSRecord).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Enum-like union types ─────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export type ExpenseCategory =
  | 'Office'
  | 'Travel'
  | 'Salary'
  | 'Marketing'
  | 'Rent'
  | 'Utilities'
  | 'Software'
  | 'Miscellaneous';

// ─── Entity interfaces (mirror Prisma schema) ──────────────────────────────────

export interface InvoiceCloudInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  sellerGstin: string;
  buyerGstin?: string | null;
  buyerName?: string | null;
  invoiceType: string; // B2B | B2C | ...
  gstr1Section: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  hsnCode?: string | null;
  reverseCharge: boolean;
  status: string; // InvoiceStatus as string
  matchStatus: string;
  riskLevel: string;
  riskScore: number;
  aiExplanation?: string | null;
  notes?: string | null;
  period?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;

  // Invoice Cloud™ financial fields
  dueDate?: string | null;
  gstAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string; // PaymentStatus as string
  paymentMode?: string | null;
  paymentDate?: string | null;
  recurring: boolean;
  recurringCycle?: string | null;
  notesFinance?: string | null;
  sentToCustomer: boolean;
  sentAt?: string | null;
}

export interface PurchaseBill {
  id: string;
  clientId?: string | null;
  vendorName: string;
  vendorGstin?: string | null;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string; // recorded | matched | paid | partial | overdue
  paymentStatus: string;
  category?: string | null;
  hsnCode?: string | null;
  notes?: string | null;
  ocrExtracted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  clientId?: string | null;
  category: string; // ExpenseCategory as string
  description?: string | null;
  vendor?: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  paymentMode?: string | null;
  status: string; // recorded | reimbursed | claimed
  receiptUrl?: string | null;
  ocrExtracted: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  clientId?: string | null;
  invoiceId?: string | null;
  purchaseBillId?: string | null;
  partyName: string;
  partyType: string; // customer | vendor
  amount: number;
  paymentDate: string;
  paymentMode: string; // upi | bank | cash | cheque | card
  referenceNo?: string | null;
  status: string; // completed | pending | failed | reconciled
  reconciled: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  clientId?: string | null;
  name: string;
  designation?: string | null;
  department?: string | null;
  employeeId?: string | null;
  pan?: string | null;
  aadhaar?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  salary: number; // gross monthly
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  tds: number;
  professionalTax: number;
  netSalary: number;
  status: string; // active | inactive | resigned
  joinedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  period: string; // YYYY-MM
  grossSalary: number;
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  tds: number;
  professionalTax: number;
  netSalary: number;
  status: string; // generated | paid | held
  paidAt?: string | null;
  payslipUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueForecast {
  id: string;
  period: string; // YYYY-MM
  forecastType: string; // cash_flow | revenue | collection
  projectedInflow: number;
  projectedOutflow: number;
  projectedNet: number;
  confidence: number;
  factors?: string | null; // JSON string
  aiSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TDSRecord {
  id: string;
  clientId?: string | null;
  section: string; // 194C | 194J | 194I | 194H | 94Q
  deducteeName: string;
  deducteePan?: string | null;
  paymentAmount: number;
  tdsRate: number;
  tdsAmount: number;
  date: string;
  status: string; // deducted | paid | filed
  quarter?: string | null; // Q1 | Q2 | Q3 | Q4
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Aggregated summary types ──────────────────────────────────────────────────

export interface AgingBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  amount: number;
}

export interface ReceivablesSummary {
  totalOutstanding: number;
  totalOverdue: number;
  collectionRate: number;
  avgDaysToPay: number;
  forecast: number;
}

export interface PayablesSummary {
  totalPayable: number;
  totalOverdue: number;
  dueThisWeek: number;
  dueNextWeek: number;
}

export interface CashFlowForecast {
  period: string;
  projectedInflow: number;
  projectedOutflow: number;
  projectedNet: number;
  confidence: number;
  factors: string[];
  aiSummary: string;
}

export interface InvoiceEngineStats {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalReceivables: number;
  totalPayables: number;
  netCashFlow: number;
  outstandingCount: number;
  overdueCount: number;
}

export interface TDSSummary {
  totalLiability: number;
  totalPaid: number;
  totalPending: number;
  bySection: Record<string, number>;
}

export interface PayrollSummary {
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  totalPF: number;
  totalESI: number;
  totalTDS: number;
  totalPT: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared utility helpers — date math + INR formatting
// ═══════════════════════════════════════════════════════════════════════════════

/** Current month as YYYY-MM. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Previous month as YYYY-MM. */
export function lastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/** Human-readable label for a YYYY-MM string, e.g. "Jan 25". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

/** Today's date as YYYY-MM-DD. */
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Date `n` days from now as YYYY-MM-DD (negative = past). */
export function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Compact INR formatter: 1.2L, 3.4Cr, ₹12,345. */
export function inrShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DTO + list-result types (consumed by analytics, intelligence, ocr, oracle)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Invoice creation input + send channel ──────────────────────────────────────

export interface CreateInvoiceLineItem {
  description?: string;
  hsnCode?: string;
  taxableValue: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

export interface CreateInvoiceInput {
  clientId: string;
  invoiceDate?: string;
  dueDate?: string;
  sellerGstin?: string;
  buyerGstin?: string;
  buyerName?: string;
  invoiceType?: string;
  items: CreateInvoiceLineItem[];
  notes?: string;
  recurring?: boolean;
  recurringCycle?: string;
}

export type SendChannel = 'email' | 'whatsapp' | 'sms';

// ─── Sales Invoice DTO ─────────────────────────────────────────────────────────

export interface InvoiceDTO {
  id: string;
  clientId: string;
  invoiceNo: string;
  clientName: string;
  invoiceDate: string;
  dueDate?: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  paymentStatus: string;
  paymentMode?: string | null;
  recurring: boolean;
}

export interface InvoiceListResult {
  invoices: InvoiceDTO[];
  total: number;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  hasLiveData: boolean;
}

// ─── Purchase Bill DTO ──────────────────────────────────────────────────────────

export interface PurchaseBillDTO {
  id: string;
  billNo: string;
  vendorName: string;
  vendorGstin?: string | null;
  billDate: string;
  dueDate?: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  itcEligible: boolean;
  itcAmount: number;
  itcBlockReason?: string | null;
  status: string;
  paymentStatus: string;
  category?: string | null;
}

export interface VendorDTO {
  id: string;
  name: string;
  gstin?: string | null;
  category?: string | null;
  totalBilled: number;
  outstanding: number;
  status: string;
}

export interface PurchaseListResult {
  bills: PurchaseBillDTO[];
  total: number;
  totalPurchaseValue: number;
  eligibleITC: number;
  blockedITC: number;
  totalOutstanding: number;
  vendors: VendorDTO[];
  hasLiveData: boolean;
}

// ─── Expense DTO ───────────────────────────────────────────────────────────────

export interface ExpenseDTO {
  id: string;
  category: string;
  description?: string | null;
  vendor?: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  paymentMode?: string | null;
  status: string;
  recurring: boolean;
}

export interface ExpenseCategoryBreakdown {
  label: string;
  total: number;
  count: number;
  changePct: number;
}

export interface ExpenseListResult {
  expenses: ExpenseDTO[];
  total: number;
  totalAmount: number;
  thisMonthTotal: number;
  lastMonthTotal: number;
  changePct: number;
  recurringCount: number;
  byCategory: ExpenseCategoryBreakdown[];
  hasLiveData: boolean;
}

// ─── Receivables DTO ────────────────────────────────────────────────────────────

export interface ReceivableDTO {
  id: string;
  invoiceId?: string | null;
  customerName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  daysOverdue: number;
  riskLevel: string;
  collectionProbability: number;
  expectedAmount: number;
  status: string;
}

export interface ReceivablesAgingBucket {
  label: string;
  count: number;
  amount: number;
  expectedCollection: number;
}

export interface ReceivablesListResult {
  receivables: ReceivableDTO[];
  total: number;
  totalOutstanding: number;
  totalExpected: number;
  collectionEfficiencyPct: number;
  overdueCount: number;
  overdueAmount: number;
  avgDaysOverdue: number;
  riskLevel: string;
  byAging: ReceivablesAgingBucket[];
  hasLiveData: boolean;
}

// ─── Payables DTO ───────────────────────────────────────────────────────────────

export interface PayableDTO {
  id: string;
  vendorName: string;
  billNo: string;
  billDate: string;
  dueDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  daysUntilDue: number;
  priority: string;
  priorityScore: number;
  status: string;
}

export interface PayablesListResult {
  payables: PayableDTO[];
  total: number;
  totalDue: number;
  dueIn7Days: number;
  dueIn30Days: number;
  overdueAmount: number;
  scheduledCount: number;
  avgPriorityScore: number;
  hasLiveData: boolean;
}

// ─── Payment DTO ────────────────────────────────────────────────────────────────

export interface PaymentDTO {
  id: string;
  direction: 'incoming' | 'outgoing';
  customerName?: string | null;
  vendorName?: string | null;
  amount: number;
  paidAt: string;
  mode: string;
  referenceNo?: string | null;
  reconciled: boolean;
  status: string;
  invoiceId?: string | null;
}

export interface PaymentListResult {
  payments: PaymentDTO[];
  total: number;
  totalIncoming: number;
  totalOutgoing: number;
  incomingCount: number;
  outgoingCount: number;
  reconciliationRatePct: number;
  reconciledCount: number;
  unreconciledCount: number;
  hasLiveData: boolean;
}

// ─── Payroll DTO ────────────────────────────────────────────────────────────────

export interface PayrollStatsDTO {
  month: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employerPF: number;
  employerESI: number;
  totalCost: number;
  processed: number;
  paid: number;
  pending: number;
}

export interface PayrollListResult {
  currentMonthPayroll: PayrollStatsDTO;
  totalEmployees: number;
  activeEmployees: number;
  hasLiveData: boolean;
}

// ─── TDS DTO ────────────────────────────────────────────────────────────────────

export interface TDSRecordDTO {
  id: string;
  section: string;
  natureOfPayment: string;
  deducteeName: string;
  deducteePan?: string | null;
  paymentAmount: number;
  tdsRate: number;
  tdsAmount: number;
  date: string;
  status: string;
  quarter?: string | null;
}

export interface TDSBySection {
  section: string;
  natureOfPayment: string;
  count: number;
  paymentAmount: number;
  tdsAmount: number;
}

export interface TDSListResult {
  records: TDSRecordDTO[];
  total: number;
  totalPaymentAmount: number;
  totalTDS: number;
  pendingChallanCount: number;
  pendingReturnCount: number;
  byStatus: { deducted: number; challan_ready: number; challan_paid: number; return_filed: number };
  bySection: TDSBySection[];
  hasLiveData: boolean;
}

// ─── Analytics ──────────────────────────────────────────────────────────────────

export interface TopClient {
  clientId: string;
  clientName: string;
  invoiceCount: number;
  totalRevenue: number;
  totalCollected: number;
  outstanding: number;
  pctOfRevenue: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  collected: number;
  expenses: number;
  profit: number;
  marginPct: number;
}

export interface AnalyticsResult {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowthPct: number;
  totalExpenses: number;
  grossMargin: number;
  grossMarginPct: number;
  netProfit: number;
  netMarginPct: number;
  expenseRatioPct: number;
  collectionEfficiencyPct: number;
  avgCollectionDays: number;
  topClients: TopClient[];
  monthlyTrend: MonthlyRevenue[];
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalPurchaseValue: number;
  totalITC: number;
  totalPayrollCost: number;
  hasLiveData: boolean;
}

// ─── Revenue Intelligence ──────────────────────────────────────────────────────

export type ForecastHorizon = 'next_week' | 'next_month' | 'next_quarter';

export interface RevenuePipelineStage {
  stage: string;
  label: string;
  amount: number;
  count: number;
  deltaPct: number;
}

export interface CashPositionSnapshot {
  cashInHand: number;
  cashInflow30d: number;
  cashOutflow30d: number;
  netCashFlow30d: number;
  runwayMonths: number;
  burnRate: number;
}

export interface ForecastPoint {
  horizon: ForecastHorizon;
  horizonLabel: string;
  targetMonth: string;
  expectedRevenue: number;
  expectedCollections: number;
  expectedExpenses: number;
  expectedPayroll: number;
  expectedPayables: number;
  projectedProfit: number;
  projectedMarginPct: number;
  projectedCashInflow: number;
  projectedCashOutflow: number;
  netCashPosition: number;
  confidence: number;
  drivers: string[];
}

export interface IntelligenceResult {
  pipeline: RevenuePipelineStage[];
  mrr: number;
  arr: number;
  mrrTrendPct: number;
  revenue: number;
  revenueThisMonth: number;
  revenueGrowthPct: number;
  expenses: number;
  expensesThisMonth: number;
  profit: number;
  marginPct: number;
  cashPosition: CashPositionSnapshot;
  collectionsNext7Days: number;
  collectionsNext30Days: number;
  collectionForecast: number;
  forecasts: ForecastPoint[];
  insights: string[];
  hasLiveData: boolean;
}

// ─── OCR Engine ────────────────────────────────────────────────────────────────

export type BillCategory =
  | 'Office'
  | 'Travel'
  | 'Salary'
  | 'Marketing'
  | 'Rent'
  | 'Utilities'
  | 'Software'
  | 'Miscellaneous';

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  hsnCode?: string | null;
}

export interface OCRConfidence {
  vendorName: number;
  billNo: number;
  billDate: number;
  totalAmount: number;
  lineItems: number;
  overall: number;
}

export interface OCRResult {
  fileName: string;
  vendorName?: string | null;
  billNo?: string | null;
  billDate?: string | null;
  dueDate?: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  totalAmount: number;
  itcEligible: boolean;
  itcAmount: number;
  itcBlockReason?: string | null;
  category: BillCategory;
  lineItems: ExtractedLineItem[];
  confidenceScore: number;
  confidence: OCRConfidence;
  needsReview: boolean;
}

export interface OCRListResult {
  recent: OCRResult[];
  total: number;
  highConfidence: number;
  needsReview: number;
  failed: number;
  hasLiveData: boolean;
}

// ─── Invoice Cloud State (composed by oracle.ts) ───────────────────────────────

export interface InvoiceCloudState {
  invoices: InvoiceListResult;
  purchases: PurchaseListResult;
  expenses: ExpenseListResult;
  receivables: ReceivablesListResult;
  payables: PayablesListResult;
  payments: PaymentListResult;
  tds: TDSListResult;
  payroll: PayrollListResult;
  analytics: AnalyticsResult;
  ocr: OCRListResult;
  intelligence: IntelligenceResult;
  hasLiveData: boolean;
}
