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
