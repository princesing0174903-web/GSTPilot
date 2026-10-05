// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Data Types
//
// Type definitions for Customer / Product / Invoice documents stored in
// Firestore at:
//   organizations/GSTpilot_SAAS/{customers,products,invoices}
//
// All documents use string ids (Firestore auto-id) and ISO date strings for
// any timestamp field (converted from Firestore Timestamps on read).
// Money fields are stored as Numbers (rupees, 2-decimal precision).
// ═══════════════════════════════════════════════════════════════════════════════

import type { GstRate } from './config';

// ─── Customer ────────────────────────────────────────────────────────────────

export type CustomerType = 'business' | 'individual';

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  /** GST Identification Number (15 chars) or null for individuals. */
  gstin: string | null;
  /** PAN (10 chars) or null. */
  pan: string | null;
  /** Billing contact email. */
  email: string | null;
  /** Billing contact phone (with country code). */
  phone: string | null;
  /** Street + city + pincode combined, or separate lines. */
  address: string | null;
  /** Indian state name — drives intra vs inter-state GST. */
  state: string | null;
  /** GST state code (2 digits). */
  stateCode: string | null;
  /** Free-form notes. */
  notes: string | null;
  /** Running total of all invoiced amounts (maintained on invoice create). */
  totalBilled: number;
  /** Running total of all paid amounts. */
  totalPaid: number;
  /** Running outstanding balance. */
  balance: number;
  /** ISO timestamp — when the customer was created. */
  createdAt: string | null;
  /** ISO timestamp — when the customer was last updated. */
  updatedAt: string | null;
}

export interface CreateCustomerInput {
  name: string;
  type?: CustomerType;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  stateCode?: string | null;
  notes?: string | null;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

// ─── Invoice Source (AI ingestion metadata) ──────────────────────────────────
// Captured when an invoice is created from an uploaded document via the
// Gemini/VLM extraction pipeline (Phase 3). Manual invoices leave this null.

export interface InvoiceSource {
  /** How the invoice entered the system. */
  type: 'upload' | 'manual' | 'import';
  /** Firebase Storage download URL for the original uploaded file. */
  storageUrl: string | null;
  /** Storage object path (organizations/GSTpilot_SAAS/invoices/uploads/...). */
  storagePath: string | null;
  /** Original file name as uploaded by the user. */
  fileName: string | null;
  /** MIME type (application/pdf, image/jpeg, image/png). */
  mimeType: string | null;
  /** File size in bytes. */
  fileSize: number | null;
  /** Raw structured JSON returned by the VLM (verbatim, for audit). */
  aiExtraction: Record<string, unknown> | null;
  /** AI model identifier used for extraction (e.g. "glm-4.5v"). */
  aiModel: string | null;
  /** Overall extraction confidence (0–1). */
  confidence: number | null;
  /** End-to-end processing time in milliseconds (upload → extraction). */
  processingTimeMs: number | null;
  /** ISO timestamp when the file was uploaded. */
  uploadedAt: string | null;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export type ProductUnit = 'NOS' | 'KG' | 'GM' | 'LTR' | 'ML' | 'MTR' | 'BOX' | 'PCS' | 'SET' | 'HR' | 'DAY' | 'MONTH';

export interface Product {
  id: string;
  /** Product / service name. */
  name: string;
  /** SKU / internal code. */
  sku: string | null;
  /** Free-text description. */
  description: string | null;
  /** HSN code for goods, SAC for services. */
  hsnSac: string;
  /** Applicable GST rate (%). */
  gstRate: GstRate;
  /** Unit of measurement. */
  unit: ProductUnit;
  /** Selling price per unit (excl. GST), in rupees. */
  price: number;
  /** Cost price per unit (excl. GST), in rupees — for margin tracking. */
  costPrice: number | null;
  /** Current stock on hand (null for services). */
  stock: number | null;
  /** Low-stock alert threshold. */
  reorderLevel: number | null;
  /** Is this a service (no stock tracking)? */
  isService: boolean;
  /** ISO timestamp. */
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateProductInput {
  name: string;
  sku?: string | null;
  description?: string | null;
  hsnSac?: string;
  gstRate?: GstRate;
  unit?: ProductUnit;
  price: number;
  costPrice?: number | null;
  stock?: number | null;
  reorderLevel?: number | null;
  isService?: boolean;
}

export type UpdateProductInput = Partial<CreateProductInput>;

// ─── Invoice ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface InvoiceLineItem {
  /** Stable client-side id for React keys. */
  id: string;
  /** Linked product id (null for ad-hoc lines). */
  productId: string | null;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: ProductUnit;
  /** Unit price (excl. GST), in rupees. */
  unitPrice: number;
  /** Line discount (%). */
  discount: number;
  /** GST rate (%) applied to this line. */
  gstRate: GstRate;
  // ── Calculated fields (derived in gst.ts) ──
  /** Taxable value after discount, before GST. */
  taxableValue: number;
  /** CGST amount (intra-state, half of GST). */
  cgst: number;
  /** SGST amount (intra-state, half of GST). */
  sgst: number;
  /** IGST amount (inter-state, full GST). */
  igst: number;
  /** Total line amount including GST. */
  amount: number;
}

export interface Invoice {
  id: string;
  /** Unique invoice number (e.g. INV-2025-0001). */
  invoiceNumber: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;

  // ── Buyer (customer) ──
  customerId: string | null;
  customerName: string;
  customerGstin: string | null;
  customerAddress: string | null;
  customerState: string | null;
  customerStateCode: string | null;

  // ── Seller (the organization) ──
  sellerName: string;
  sellerGstin: string | null;
  sellerAddress: string | null;
  sellerStateCode: string | null;

  // ── Dates (ISO strings) ──
  invoiceDate: string;
  dueDate: string | null;

  // ── Line items + totals (all server-calculated) ──
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Total GST = cgst + sgst + igst. */
  totalTax: number;
  /** Grand total = taxableValue + totalTax. */
  grandTotal: number;
  /** Amount already paid against this invoice. */
  paidAmount: number;
  /** Outstanding balance = grandTotal - paidAmount. */
  balanceDue: number;

  /** Whether the sale is intra-state (CGST+SGST) or inter-state (IGST). */
  isIntraState: boolean;

  /** Free-form notes printed on the invoice. */
  notes: string | null;
  /** Internal private notes (not printed). */
  privateNotes: string | null;

  /** Provenance metadata — populated when the invoice was created from an
   *  uploaded document via AI extraction. Null for manually-created invoices. */
  source: InvoiceSource | null;

  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateInvoiceInput {
  customerId: string | null;
  customerName?: string;
  customerGstin?: string | null;
  customerAddress?: string | null;
  customerState?: string | null;
  customerStateCode?: string | null;
  sellerName: string;
  sellerGstin?: string | null;
  sellerAddress?: string | null;
  sellerStateCode?: string | null;
  invoiceDate?: string;
  dueDate?: string | null;
  items: Array<
    Omit<InvoiceLineItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'amount'>
  >;
  notes?: string | null;
  privateNotes?: string | null;
  /** Optional provenance metadata for AI-ingested invoices. */
  source?: InvoiceSource | null;
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput> & {
  status?: InvoiceStatus;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
};

// ─── Aggregated stats ────────────────────────────────────────────────────────

export interface InvoiceStats {
  count: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalTaxCollected: number;
  byStatus: Record<InvoiceStatus, number>;
}

export interface ProductStats {
  count: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface CustomerStats {
  count: number;
  totalOutstanding: number;
  withGstin: number;
}

// ─── Vendor ──────────────────────────────────────────────────────────────────
// A vendor is a supplier / payee the organization owes money to (for expenses,
// purchases, services). Stored at organizations/GSTpilot_SAAS/vendors.

export type VendorCategory =
  | 'Supplier'
  | 'Contractor'
  | 'Service Provider'
  | 'Freelancer'
  | 'Utility'
  | 'Other';

export interface Vendor {
  id: string;
  name: string;
  type: CustomerType;
  /** GSTIN (15 chars) or null for unregistered vendors. */
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  category: VendorCategory;
  contactPerson: string | null;
  notes: string | null;
  /** Running total of all bills/expenses from this vendor. */
  totalBilled: number;
  /** Running total of all payments made to this vendor. */
  totalPaid: number;
  /** Outstanding payable balance = totalBilled - totalPaid. */
  balance: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateVendorInput {
  name: string;
  type?: CustomerType;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  stateCode?: string | null;
  category?: VendorCategory;
  contactPerson?: string | null;
  notes?: string | null;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export interface VendorStats {
  count: number;
  totalPayable: number;
  withGstin: number;
}

// ─── Expense ─────────────────────────────────────────────────────────────────
// A business expense (purchase / bill). Stored at
// organizations/GSTpilot_SAAS/expenses.

export type ExpenseCategory =
  | 'Office'
  | 'Travel'
  | 'Salary'
  | 'Marketing'
  | 'Rent'
  | 'Utilities'
  | 'Software'
  | 'Miscellaneous';

export type PaymentMode = 'cash' | 'upi' | 'bank' | 'card' | 'cheque' | 'other';

export type ExpenseStatus = 'recorded' | 'billed' | 'paid';

export interface Expense {
  id: string;
  /** Linked vendor id (optional — ad-hoc expenses may have none). */
  vendorId: string | null;
  vendorName: string;
  category: ExpenseCategory;
  description: string;
  /** Total amount inclusive of GST, in rupees. */
  amount: number;
  /** GST amount included in `amount`. */
  gst: number;
  /** Whether the GST on this expense is claimable as ITC. */
  gstClaimable: boolean;
  /** ISO date string (YYYY-MM-DD) the expense was incurred. */
  date: string;
  paymentMode: PaymentMode;
  status: ExpenseStatus;
  /** UTR / cheque / reference number. */
  referenceNo: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateExpenseInput {
  vendorId?: string | null;
  vendorName?: string;
  category?: ExpenseCategory;
  description: string;
  amount: number;
  gst?: number;
  gstClaimable?: boolean;
  date?: string;
  paymentMode?: PaymentMode;
  status?: ExpenseStatus;
  referenceNo?: string | null;
  notes?: string | null;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput>;

export interface ExpenseStats {
  count: number;
  totalAmount: number;
  totalGst: number;
  claimableGst: number;
}

// ─── Payment ─────────────────────────────────────────────────────────────────
// A payment (money in from a customer OR money out to a vendor). Stored at
// organizations/GSTpilot_SAAS/payments. When linked to an invoice, the
// invoice's paidAmount / balanceDue / paymentStatus are auto-updated.

export type PartyType = 'customer' | 'vendor';
export type PaymentTxStatus = 'completed' | 'pending' | 'failed';

export interface Payment {
  id: string;
  partyType: PartyType;
  /** Linked customer or vendor id (optional). */
  partyId: string | null;
  partyName: string;
  /** Linked invoice id (optional — for customer payments). */
  invoiceId: string | null;
  invoiceNumber: string | null;
  /** Payment amount, in rupees. */
  amount: number;
  /** ISO date string (YYYY-MM-DD). */
  paymentDate: string;
  paymentMode: PaymentMode;
  /** UTR / cheque / reference number. */
  referenceNo: string | null;
  status: PaymentTxStatus;
  /** Whether this payment has been reconciled against a bank statement. */
  reconciled: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreatePaymentInput {
  partyType: PartyType;
  partyId?: string | null;
  partyName?: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  amount: number;
  paymentDate?: string;
  paymentMode?: PaymentMode;
  referenceNo?: string | null;
  status?: PaymentTxStatus;
  reconciled?: boolean;
  notes?: string | null;
}

export type UpdatePaymentInput = Partial<CreatePaymentInput>;

export interface PaymentStats {
  count: number;
  totalReceived: number;
  totalPaidOut: number;
  totalReconciled: number;
}
