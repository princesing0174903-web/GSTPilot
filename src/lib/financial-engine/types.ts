// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Financial Engine: Shared Types
//
// Every metric in VEYRO flows through these types. No page or component
// should ever define its own financial shape — import from here.
//
// GOLDEN RULE: When the database has no data, every field returns zero or
// an empty array. We never invent numbers.
// ═══════════════════════════════════════════════════════════════════════════════

/** The canonical business snapshot returned by GET /api/business/snapshot. */
export interface BusinessSnapshot {
  // ── Top-line financials ──
  revenue: number;
  expenses: number;
  profit: number;
  cash: number;
  bankBalance: number;

  // ── Invoice & collections ──
  invoices: {
    total: number;
    count: number;
    paid: number;
    outstanding: number;
    overdue: number;
    draftCount: number;
  };
  collections: {
    collectionRate: number; // 0–100
    totalCollected: number;
    totalOutstanding: number;
    averageDaysToPay: number;
  };
  receivables: number;
  payables: number;

  // ── GST ──
  gst: {
    outputTax: number;   // GST collected on sales (liability)
    inputTax: number;    // GST paid on purchases (ITC)
    netLiability: number; // outputTax - inputTax (what you owe the government)
    itcAvailable: number; // same as inputTax (claimable)
  };
  itc: number; // alias for gst.itcAvailable

  // ── Entities ──
  customers: number;
  vendors: number;

  // ── Risk & health ──
  healthScore: number;   // 0–100
  /**
   * Canonical label from the rich snapshot engine
   * (`src/lib/business/snapshot.ts::computeHealthScore`).
   * One of: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'.
   * Populated by `/api/business/snapshot` (merged from rich).
   * Optional because the legacy financial-engine snapshot doesn't compute it;
   * consumers should fall back to deriving a label from `healthScore` only
   * when this field is undefined.
   */
  healthScoreLabel?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  risks: {
    overallRisk: number;  // 0–100 (higher = worse)
    overdueExposure: number;
    complianceRisk: number;
    cashFlowRisk: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };

  // ── Forecast & runway ──
  forecast: {
    nextMonthRevenue: number;
    nextMonthExpenses: number;
    projectedCash: number;
    confidence: number; // 0–100
  };
  runway: {
    monthsRemaining: number | null; // null = infinite or cannot calculate
    monthlyBurnRate: number;
    isProfitable: boolean;
  };

  // ── Notices ──
  notices: number;

  // ── Metadata ──
  updatedAt: string;
  hasLiveData: boolean;
}

/** Empty snapshot returned when the tenant has no data at all. */
export function emptySnapshot(): BusinessSnapshot {
  return {
    revenue: 0,
    expenses: 0,
    profit: 0,
    cash: 0,
    bankBalance: 0,
    invoices: { total: 0, count: 0, paid: 0, outstanding: 0, overdue: 0, draftCount: 0 },
    collections: { collectionRate: 0, totalCollected: 0, totalOutstanding: 0, averageDaysToPay: 0 },
    receivables: 0,
    payables: 0,
    gst: { outputTax: 0, inputTax: 0, netLiability: 0, itcAvailable: 0 },
    itc: 0,
    customers: 0,
    vendors: 0,
    healthScore: 0,
    healthScoreLabel: 'Critical',
    risks: { overallRisk: 0, overdueExposure: 0, complianceRisk: 0, cashFlowRisk: 0, riskLevel: 'low' },
    forecast: { nextMonthRevenue: 0, nextMonthExpenses: 0, projectedCash: 0, confidence: 0 },
    runway: { monthsRemaining: null, monthlyBurnRate: 0, isProfitable: false },
    notices: 0,
    updatedAt: new Date().toISOString(),
    hasLiveData: false,
  };
}

/** Raw data bundle fetched from Prisma — passed to each calculator. */
export interface FinancialData {
  invoices: InvoiceRow[];
  purchaseBills: PurchaseBillRow[];
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  bankAccounts: BankAccountRow[];
  clients: ClientRow[];
  notices: NoticeRow[];
  gstrFilings: GSTRFilingRow[];
}

export interface InvoiceRow {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin: string | null;
  buyerName: string | null;
  invoiceType: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string | null;
  createdAt: Date;
}

export interface PurchaseBillRow {
  id: string;
  clientId: string | null;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: Date;
}

export interface ExpenseRow {
  id: string;
  clientId: string | null;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  paymentMode: string | null;
  status: string;
  createdAt: Date;
}

export interface PaymentRow {
  id: string;
  clientId: string | null;
  invoiceId: string | null;
  purchaseBillId: string | null;
  partyName: string;
  partyType: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  status: string;
  createdAt: Date;
}

export interface BankAccountRow {
  id: string;
  bankName: string;
  accountMasked: string;
  accountType: string;
  balance: number;
  availableBalance: number;
  overdraftLimit: number;
  status: string;
}

export interface ClientRow {
  id: string;
  gstin: string;
  tradeName: string;
  legalName: string | null;
  state: string | null;
  stateCode: string | null;
  status: string;
  healthScore: number;
  firmId: string | null;
}

export interface NoticeRow {
  id: string;
  status: string;
  createdAt: Date;
}

export interface GSTRFilingRow {
  id: string;
  returnType: string;
  period: string;
  status: string;
  totalTaxableValue: number;
  totalTax: number;
  createdAt: Date;
}
