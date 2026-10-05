// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Real Data Activation Layer
// Shared types for GSTN + Bank connection data.
// ═══════════════════════════════════════════════════════════════════════════════

export type ConnectionType = 'gstn' | 'bank';

export type BankProvider = 'HDFC' | 'ICICI' | 'SBI' | 'AXIS' | 'KOTAK' | 'YES';

export interface GstrFilingSummary {
  returnType: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B';
  period: string;          // YYYY-MM
  status: 'filed' | 'draft' | 'pending' | 'overdue';
  filedDate?: string;
  acknowledgmentNumber?: string;
  totalInvoices: number;
  totalTaxableValue: number;
  totalTax: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  itcAvailable?: number;   // GSTR-2B only
  itcReversed?: number;    // GSTR-2B only
}

export interface EInvoiceRecord {
  irn: string;
  ackNo: string;
  ackDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  buyerGstin: string;
  buyerName: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  status: 'active' | 'cancelled';
}

export interface EWayBillRecord {
  ewayBillNo: string;
  generatedDate: string;
  validUntil: string;
  docNumber: string;
  docDate: string;
  buyerGstin: string;
  buyerName: string;
  supplyType: 'outward' | 'inward';
  taxableValue: number;
  totalTax: number;
  totalAmount: number;
  transporterId?: string;
  vehicleNo?: string;
  fromPlace: string;
  toPlace: string;
  distanceKm: number;
  status: 'active' | 'expired' | 'cancelled';
}

export interface GstNoticeRecord {
  noticeType: 'ASMT-10' | 'ASMT-11' | 'DRC-01' | 'DRC-01A' | 'DRC-07' | 'intimation';
  noticeNumber: string;
  noticeDate: string;
  subject: string;
  description: string;
  status: 'open' | 'responded' | 'closed';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface FilingHistoryEntry {
  period: string;
  returnType: string;
  status: string;
  filedDate?: string;
  acknowledgmentNumber?: string;
  delayedByDays: number;
}

export interface ComplianceStatus {
  score: number;                    // 0-100
  pendingReturns: number;
  overdueReturns: number;
  filedReturns: number;
  lastFilingDate?: string;
  nextDueDate?: string;
  itcAvailable: number;
  itcReversed: number;
  activeNotices: number;
  status: 'compliant' | 'at_risk' | 'non_compliant';
}

export interface Gstr9Summary {
  financialYear: string;
  status: 'filed' | 'draft' | 'pending' | 'overdue';
  turnover: number;
  taxableValue: number;
  totalTax: number;
  itcClaimed: number;
  lateFee: number;
  filedDate?: string;
}

export interface RegistrationProfile {
  registrationDate: string;
  constitution: string;
  businessType: string;
  centerJurisdiction: string;
  stateJurisdiction: string;
  filingFrequency: 'monthly' | 'quarterly';
  taxpayerType: string;
}

export interface LedgerSummary {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalBalance: number;
  // ITC ledger extras:
  openingBalance?: number;
  availableItc?: number;
  reversedItc?: number;
  utilizedItc?: number;
  closingBalance?: number;
  // Liability ledger extras:
  pendingTax?: number;
  pendingInterest?: number;
  pendingLateFee?: number;
  totalLiability?: number;
}

export interface GstnDataset {
  gstin: string;
  legalName: string;
  tradeName: string;
  state: string;
  stateCode: string;
  businessType: string;
  registrationDate: string;
  filingHistory: FilingHistoryEntry[];
  gstrFilings: GstrFilingSummary[];
  eInvoices: EInvoiceRecord[];
  eWayBills: EWayBillRecord[];
  notices: GstNoticeRecord[];
  compliance: ComplianceStatus;
  // ── PHASE 2A — Real Data Platform extensions ──
  gstr9?: Gstr9Summary;
  registrationProfile: RegistrationProfile;
  itcLedger: LedgerSummary;
  cashLedger: LedgerSummary;
  liabilityLedger: LedgerSummary;
  lateFees: number;
  taxLiability: number;
}

export interface BankTransactionRecord {
  txnDate: string;       // ISO date
  description: string;
  amount: number;        // signed: + credit, - debit
  type: 'credit' | 'debit';
  category: 'sales' | 'expense' | 'tax_payment' | 'salary' | 'vendor' | 'loan' | 'refund' | 'interest' | 'other';
  counterparty?: string;
  referenceNo?: string;
  balanceAfter: number;
}

export interface BankDataset {
  provider: BankProvider;
  maskedAccount: string;
  accountType: 'current' | 'savings';
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactions: BankTransactionRecord[];
  monthlyCollections: { month: string; collections: number; expenses: number }[];
}

export interface BusinessHealthBreakdown {
  overall: number;
  compliance: number;
  cashFlow: number;
  collection: number;
  growth: number;
  profitability: number;
  risk: number;
  signals: { text: string; tone: 'positive' | 'warning' | 'negative' | 'neutral'; score: number }[];
  components: {
    pendingReturns: number;
    overdueReturns: number;
    itcAvailable: number;
    cashAvailable: number;
    monthlyCollections: number;
    monthlyExpenses: number;
    collectionChangePct: number;
    expenseChangePct: number;
    activeNotices: number;
    revenueGrowthPct: number;
  };
}

export interface OracleLiveData {
  hasGstn: boolean;
  hasBank: boolean;
  gstin?: string;
  tradeName?: string;
  compliance: {
    score: number;
    pendingReturns: number;
    overdueReturns: number;
    lastFilingDate?: string;
    nextDueDate?: string;
    itcAvailable: number;
    activeNotices: number;
    status: string;
  } | null;
  bank: {
    provider?: string;
    cashAvailable: number;
    monthlyCollections: number;
    monthlyExpenses: number;
    collectionChangePct: number;
    expenseChangePct: number;
    totalCredits: number;
    totalDebits: number;
  } | null;
  health: BusinessHealthBreakdown | null;
  recentTransactions?: BankTransactionRecord[];
  riskyClients?: { name: string; reason: string; amount: number }[];

  // ── PHASE 2A — Real Data Platform extensions (all optional) ──
  cashBurn?: number;              // monthly average expenses
  runwayDays?: number;            // cashAvailable / monthlyExpenses * 30, clamped 0–365
  collectionEfficiency?: number;  // 0–100 ratio
  expenseCategories?: { category: string; amount: number; pct: number }[];
  dailyCashFlow?: { date: string; inflow: number; outflow: number; net: number }[];
  topClients?: { name: string; amount: number; sharePct: number }[];

  // GSTN dataset slices (populated when gstn exists)
  firmProfile?: RegistrationProfile;
  gstr9?: Gstr9Summary;
  itcLedger?: LedgerSummary;
  cashLedger?: LedgerSummary;
  liabilityLedger?: LedgerSummary;
  lateFees?: number;
  taxLiability?: number;
  recentReturns?: GstrFilingSummary[];
  activeNoticesList?: GstNoticeRecord[];
}
