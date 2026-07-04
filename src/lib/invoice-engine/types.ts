// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Type Definitions
//
// The single source of truth for the invoice data model. Every field here maps
// 1:1 to the Firestore `invoices` collection. All calculations (subtotal,
// discount, CGST/SGST/IGST/CESS, round-off, grand total, balance due) are
// derived on the backend — the UI never computes totals.
//
// Collection: invoices/{invoiceId}
// Multi-tenant: every document carries `organizationId` and every query filters
// on it. Users can never access another organization's invoices.
// ═══════════════════════════════════════════════════════════════════════════════

/** Lifecycle status of an invoice. Drives payment-status derivation. */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

/** Payment state — derived from paidAmount vs grandTotal and dueDate. */
export type PaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

/** A single line item on an invoice. The engine computes per-line taxes. */
export interface InvoiceLineItem {
  /** Stable id within the invoice (used as React key + for updates). */
  id: string;
  description: string;
  /** HSN (goods) or SAC (services) classification code. */
  hsnSac: string;
  quantity: number;
  /** Unit of measure — e.g. NOS, KGS, LTR, HRS. */
  unit: string;
  unitPrice: number;
  /** Line-level discount amount (absolute, not percentage). */
  discount: number;
  /** GST rate applied to this line (e.g. 18 for 18%). */
  gstRate: number;
  /** Computed: (quantity × unitPrice) − discount. */
  taxableValue: number;
  /** Computed: taxableValue × cgstRate/100. For intra-state = gstRate/2. */
  cgst: number;
  /** Computed: taxableValue × sgstRate/100. For intra-state = gstRate/2. */
  sgst: number;
  /** Computed: taxableValue × igstRate/100. For inter-state = gstRate. */
  igst: number;
  /** Computed: taxableValue + cgst + sgst + igst. */
  amount: number;
}

/** The complete invoice document stored in Firestore. */
export interface Invoice {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  invoiceNumber: string;

  /** Links to the customers/clients collection. May be null for ad-hoc invoices. */
  customerId: string | null;
  /** Denormalized customer name for display even if the customer doc is deleted. */
  customerName: string;
  customerGstin: string | null;
  customerAddress: string | null;
  customerState: string | null;
  customerStateCode: string | null;

  /** Seller (organization) details — denormalized at creation time. */
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string | null;
  sellerStateCode: string | null;

  status: InvoiceStatus;
  paymentStatus: PaymentStatus;

  invoiceDate: string; // ISO date (YYYY-MM-DD)
  dueDate: string; // ISO date

  items: InvoiceLineItem[];

  // ── Computed totals (all calculated server-side) ───────────────────────────
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;

  notes: string | null;
  terms: string | null;

  /** { uid, name, email } of the user who created the invoice. */
  createdBy: {
    uid: string;
    name: string;
    email: string;
  };

  /** Inter-state vs intra-state — determines CGST+SGST vs IGST split. */
  isInterState: boolean;

  /** Optional recurring-invoice metadata. */
  recurring: boolean;
  recurringCycle: 'monthly' | 'quarterly' | 'yearly' | null;

  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Payload accepted by createInvoice(). Items may omit computed fields. */
export interface CreateInvoiceInput {
  organizationId: string;
  invoiceNumber?: string;
  customerId: string | null;
  customerName: string;
  customerGstin?: string | null;
  customerAddress?: string | null;
  customerState?: string | null;
  customerStateCode?: string | null;
  sellerName: string;
  sellerGstin: string;
  sellerAddress?: string | null;
  sellerStateCode?: string | null;
  invoiceDate: string;
  dueDate: string;
  items: Array<{
    id?: string;
    description: string;
    hsnSac: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount?: number;
    gstRate: number;
  }>;
  isInterState?: boolean;
  cess?: number;
  notes?: string | null;
  terms?: string | null;
  recurring?: boolean;
  recurringCycle?: 'monthly' | 'quarterly' | 'yearly' | null;
  createdBy: Invoice['createdBy'];
}

/** Payload accepted by updateInvoice(). All fields optional except id+orgId. */
export interface UpdateInvoiceInput {
  customerId?: string | null;
  customerName?: string;
  customerGstin?: string | null;
  customerAddress?: string | null;
  customerState?: string | null;
  customerStateCode?: string | null;
  sellerName?: string;
  sellerGstin?: string;
  sellerAddress?: string | null;
  sellerStateCode?: string | null;
  invoiceDate?: string;
  dueDate?: string;
  items?: CreateInvoiceInput['items'];
  isInterState?: boolean;
  cess?: number;
  notes?: string | null;
  terms?: string | null;
  status?: InvoiceStatus;
  recurring?: boolean;
  recurringCycle?: 'monthly' | 'quarterly' | 'yearly' | null;
}

/** Result of calculateInvoiceTotals — all money fields rounded to 2 decimals. */
export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  grandTotal: number;
}

/** Aggregated stats for a list of invoices — used by dashboards/reports. */
export interface InvoiceStats {
  count: number;
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalTaxCollected: number;
  byStatus: Record<InvoiceStatus, number>;
  byPaymentStatus: Record<PaymentStatus, number>;
}
