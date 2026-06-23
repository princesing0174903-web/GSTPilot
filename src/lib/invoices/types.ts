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
