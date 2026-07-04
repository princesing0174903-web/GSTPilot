// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot GST Return Engine™ — Type Definitions
//
// The single source of truth for the GST transaction data model. Every field
// maps 1:1 to the `gst_transactions` Firestore collection. All types are PURE
// (no Firebase imports) so they are safe to import from both client and server.
//
// Architecture:
//   • Every invoice (sales/purchase/credit note/debit note) automatically
//     creates a GSTTransaction when it's created/updated.
//   • GST summaries are computed from GSTTransactions (cached, recomputed
//     only when transactions change).
//   • Return drafts (GSTR-1, GSTR-3B, GSTR-9) are prepared from GSTTransactions.
//   • ITC is calculated from purchase-type transactions.
//
// Multi-tenant: every document carries `organizationId`. Every query filters
// on it. Users can never access another organization's GST data.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Transaction Types ───────────────────────────────────────────────────────

/**
 * The kind of GST transaction — determines how it flows into returns.
 *   • sales        → GSTR-1 (output tax)
 *   • purchase     → GSTR-2B (input tax credit)
 *   • credit_note  → GSTR-1 adjustment (reduces output tax)
 *   • debit_note   → GSTR-1 adjustment (increases output tax)
 */
export type GSTTransactionType = 'sales' | 'purchase' | 'credit_note' | 'debit_note';

/**
 * GST invoice classification — drives which GSTR-1 section the transaction
 * appears in.
 *   • b2b       → Business-to-Business (customer has GSTIN)
 *   • b2c_large → B2C, inter-state, value > ₹2.5L
 *   • b2c_small → B2C, intra-state or value ≤ ₹2.5L
 *   • exports   → Zero-rated export (with/without payment of tax)
 *   • nil       → Nil-rated / exempt / non-GST supplies
 */
export type GSTInvoiceType = 'b2b' | 'b2c_large' | 'b2c_small' | 'exports' | 'nil';

/**
 * Filing status of a GST transaction.
 *   • draft    → Not yet included in a filed return
 *   • filed    → Included in a filed return (locked)
 *   • amended  → Amended in a subsequent return
 */
export type GSTTransactionStatus = 'draft' | 'filed' | 'amended';

// ─── GST Transaction (gst_transactions collection) ───────────────────────────

/**
 * A single GST transaction — one per invoice/credit note/debit note.
 * Automatically created when an invoice is created/updated.
 *
 * Stored in Firestore `gst_transactions/{transactionId}`.
 */
export interface GSTTransaction {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** The source invoice ID (links back to the invoices collection). */
  invoiceId: string;
  /** The customer/client ID (may be null for ad-hoc). */
  customerId: string | null;
  /** Denormalized customer name for display. */
  customerName: string;
  /** Customer GSTIN (null for B2C). */
  customerGstin: string | null;
  /** Customer state code (first 2 digits of GSTIN, or explicit). */
  customerStateCode: string | null;
  /** Seller GSTIN. */
  sellerGstin: string;
  /** Seller state code. */
  sellerStateCode: string | null;
  /** Invoice number from the source document. */
  invoiceNumber: string;
  /** Invoice date (ISO YYYY-MM-DD). */
  invoiceDate: string;

  /** What kind of transaction this is. */
  transactionType: GSTTransactionType;
  /** GSTR-1 classification. */
  invoiceType: GSTInvoiceType;
  /** Whether this is an inter-state supply (IGST) or intra-state (CGST+SGST). */
  isInterState: boolean;

  /** GST rate applied (e.g. 5, 12, 18, 28). */
  gstRate: number;
  /** Taxable value after discount (before GST). */
  taxableValue: number;
  /** Central GST (intra-state only). */
  cgst: number;
  /** State GST (intra-state only). */
  sgst: number;
  /** Integrated GST (inter-state only). */
  igst: number;
  /** CESS (if applicable). */
  cess: number;
  /** Total tax (cgst + sgst + igst + cess). */
  totalTax: number;
  /** Invoice grand total (taxableValue + totalTax + roundOff). */
  grandTotal: number;

  /** Whether ITC is eligible (for purchase transactions). */
  itcEligible: boolean;
  /** Whether this is a reverse-charge transaction. */
  reverseCharge: boolean;
  /** Whether this is a composition scheme supply. */
  composition: boolean;

  /** Filing period (YYYY-MM) derived from invoiceDate. */
  filingPeriod: string;
  /** Financial year (FY2024-25) derived from invoiceDate. */
  financialYear: string;

  /** Filing status. */
  status: GSTTransactionStatus;

  /** User who created the source invoice. */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── GST Summary ──────────────────────────────────────────────────────────────

/**
 * Aggregated GST summary for a period or financial year.
 * Computed from GSTTransactions via `generateGSTSummary()`.
 *
 * This is a CACHED value — recomputed only when transactions change.
 */
export interface GSTSummary {
  /** The period this summary covers (YYYY-MM or FY2024-25). */
  period: string;

  // ── Sales (output tax) ──────────────────────────────────────────────────
  /** Total taxable sales value. */
  taxableSales: number;
  /** Total CGST collected on sales. */
  cgstCollected: number;
  /** Total SGST collected on sales. */
  sgstCollected: number;
  /** Total IGST collected on sales. */
  igstCollected: number;
  /** Total CESS collected on sales. */
  cessCollected: number;
  /** Total output tax (cgst + sgst + igst + cess on sales). */
  totalOutputTax: number;

  // ── Purchases (input tax) ───────────────────────────────────────────────
  /** Total taxable purchase value. */
  taxablePurchases: number;
  /** Total CGST paid on purchases. */
  cgstPaid: number;
  /** Total SGST paid on purchases. */
  sgstPaid: number;
  /** Total IGST paid on purchases. */
  igstPaid: number;
  /** Total CESS paid on purchases. */
  cessPaid: number;
  /** Total input tax (cgst + sgst + igst + cess on purchases). */
  totalInputTax: number;

  // ── Adjustments ─────────────────────────────────────────────────────────
  /** Tax adjustments from credit notes. */
  creditNoteTax: number;
  /** Tax adjustments from debit notes. */
  debitNoteTax: number;

  // ── Net Liability ───────────────────────────────────────────────────────
  /** Net GST liability = outputTax - eligibleITC + adjustments. */
  netLiability: number;
  /** Outstanding GST (net liability not yet paid). */
  outstandingGST: number;
  /** GST health score (0-100, higher is better). */
  healthScore: number;

  // ── Transaction counts ──────────────────────────────────────────────────
  totalTransactions: number;
  salesCount: number;
  purchaseCount: number;
  creditNoteCount: number;
  debitNoteCount: number;

  // ── By GST rate ─────────────────────────────────────────────────────────
  byGstRate: Record<string, { taxableValue: number; tax: number; count: number }>;
  // ── By invoice type ─────────────────────────────────────────────────────
  byInvoiceType: Record<GSTInvoiceType, { taxableValue: number; tax: number; count: number }>;
}

// ─── ITC Summary ─────────────────────────────────────────────────────────────

/**
 * Input Tax Credit summary — computed from purchase-type transactions.
 */
export interface ITCSummary {
  /** Total ITC eligible to claim. */
  eligibleITC: number;
  /** ITC blocked under Section 17(5) (e.g. motor vehicles, food). */
  blockedITC: number;
  /** ITC under reverse charge. */
  reverseChargeITC: number;
  /** ITC pending (not yet claimed — e.g. invoice not yet received). */
  pendingITC: number;
  /** ITC already used to offset liability. */
  usedITC: number;
  /** ITC remaining available to offset future liability. */
  remainingITC: number;

  // ── Breakdown by tax type ───────────────────────────────────────────────
  eligibleCGST: number;
  eligibleSGST: number;
  eligibleIGST: number;
  eligibleCess: number;
}

// ─── Return Drafts ───────────────────────────────────────────────────────────

/**
 * GSTR-1 draft — outward supplies summary for a period.
 * NOT filed to GSTN — draft data only.
 */
export interface GSTR1Draft {
  period: string;
  financialYear: string;
  // Section 4: B2B Invoices
  b2b: Array<{
    customerGstin: string;
    customerName: string;
    invoiceNumber: string;
    invoiceDate: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    gstRate: number;
    reverseCharge: boolean;
  }>;
  // Section 5: B2C (Large)
  b2cl: Array<{
    invoiceNumber: string;
    invoiceDate: string;
    taxableValue: number;
    igst: number;
    cess: number;
    gstRate: number;
  }>;
  // Section 6: B2C (Small)
  b2cs: Array<{
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    gstRate: number;
  }>;
  // Section 9: Credit/Debit Notes
  creditDebitNotes: Array<{
    type: 'credit_note' | 'debit_note';
    customerGstin: string;
    noteNumber: string;
    noteDate: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    gstRate: number;
  }>;
  // Section 11: Nil-rated supplies
  nilRated: { exempt: number; nilRated: number; nonGST: number };
  // Totals
  totals: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    totalTax: number;
    invoiceCount: number;
  };
}

/**
 * GSTR-3B draft — monthly summary return.
 * NOT filed to GSTN — draft data only.
 */
export interface GSTR3BDraft {
  period: string;
  // 3.1 — Outward supplies (tax liability)
  outwardSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 3.2 — Inward supplies (ITC)
  itc: {
    eligibleCGST: number;
    eligibleSGST: number;
    eligibleIGST: number;
    eligibleCess: number;
    ineligibleITC: number;
    totalITC: number;
  };
  // 4 — Net tax liability
  netLiability: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // 5 — Tax paid
  taxPaid: {
    byCash: { igst: number; cgst: number; sgst: number; cess: number };
    byITC: { igst: number; cgst: number; sgst: number; cess: number };
  };
}

/**
 * GSTR-9 draft — annual consolidation.
 * NOT filed to GSTN — draft data only.
 */
export interface GSTR9Draft {
  financialYear: string;
  // Part II — Details of outward supplies
  outwardSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };
  // Part III — Details of inward supplies
  inwardSupplies: {
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    itcClaimed: number;
  };
  // Part IV — ITC
  itc: {
    totalITC: number;
    ineligibleITC: number;
    netITC: number;
  };
  // Part V — Tax paid
  taxPaid: {
    totalLiability: number;
    paidByCash: number;
    paidByITC: number;
  };
}

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
