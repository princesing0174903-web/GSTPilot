// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books → VEYRO Mapper
//
// Pure functions that transform raw Zoho Books API responses into normalized
// VEYRO record payloads. ZERO `any`. NEVER stores raw Zoho JSON — only the
// normalized fields.
//
// Key normalization rules:
//   • Customer without GSTIN → synthetic key `ZOHO-CONTACT-{contact_id}`
//     (Client.gstin is @unique so we need a stable identifier)
//   • Vendor without GSTIN → null (Vendor.gstin is nullable)
//   • Zoho `payment_status` → VEYRO { unpaid | partial | paid | overdue }
//   • Zoho `last_modified_time` → ISO Date (for incremental watermark)
//   • Date strings (Zoho returns "2024-01-15") → kept as ISO date strings
//     (VEYRO's existing models use String for dates, not DateTime)
//   • Bank account numbers → masked (show only last 4 digits)
//   • Currency code dropped (VEYRO assumes INR)
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ZohoContact,
  ZohoInvoice,
  ZohoBill,
  ZohoExpense,
  ZohoBankAccount,
  ZohoBankTransaction,
  ZohoJournal,
  ZohoTax,
  ZohoCustomerPayment,
  ZohoVendorPayment,
  ZohoItem,
  ZohoCreditNote,
  NormalizedClient,
  NormalizedVendor,
  NormalizedInvoice,
  NormalizedPurchaseBill,
  NormalizedExpense,
  NormalizedBankAccount,
  NormalizedBankTransaction,
  NormalizedJournalEntry,
  NormalizedPayment,
  NormalizedItem,
  NormalizedCreditNote,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: string | undefined | null, fallback = ''): string =>
  v === undefined || v === null ? fallback : String(v);

const optionalStr = (v: string | undefined | null): string | null =>
  v === undefined || v === null || v === '' ? null : String(v);

/** Mask a bank account number: show only the last 4 digits. */
const maskAccount = (acct: string | undefined): string => {
  if (!acct) return '••••';
  const digits = acct.replace(/\D/g, '');
  return digits.length > 4 ? `••••${digits.slice(-4)}` : `••••${digits}`;
};

/**
 * VEYRO's Client model requires `gstin` to be @unique. Zoho customers may
 * not have a GSTIN (e.g., B2C customers, unregistered clients). To keep the
 * unique constraint satisfied without losing the customer, synthesize a
 * deterministic key: `ZOHO-CONTACT-{contact_id}`.
 */
export function syntheticGstinForContact(contactId: string): string {
  return `ZOHO-CONTACT-${contactId}`;
}

/**
 * Normalize a Zoho contact's GSTIN. Returns the real GSTIN if present,
 * otherwise a synthetic key (for customers) or null (for vendors).
 */
function normalizeGstin(
  contact: ZohoContact,
  fallback: 'synthetic' | 'null',
): string | null {
  const g = optionalStr(contact.gstin);
  if (g) return g;
  return fallback === 'synthetic' ? syntheticGstinForContact(contact.contact_id) : null;
}

/** Map Zoho's payment_status string to VEYRO's payment-status vocabulary. */
function normalizePaymentStatus(
  zohoStatus: string | undefined,
  balance: number,
  total: number,
): 'unpaid' | 'partial' | 'paid' | 'overdue' {
  const s = (zohoStatus ?? '').toLowerCase();
  if (s.includes('paid') && balance <= 0) return 'paid';
  if (s.includes('partial') || (total > 0 && balance > 0 && balance < total)) return 'partial';
  if (s.includes('overdue')) return 'overdue';
  return 'unpaid';
}

/** Extract state + state code from a Zoho billing address. */
function extractState(addr: ZohoContact['billing_address']): {
  state: string | null;
  stateCode: string | null;
} {
  if (!addr) return { state: null, stateCode: null };
  const state = optionalStr(addr.state);
  // Zoho doesn't return a separate state_code — derive from state name best-effort.
  // Indian states have 2-digit codes (01–36); we can't reverse-map without a table,
  // so leave stateCode null unless the state string itself starts with digits.
  const stateCodeMatch = state?.match(/^(\d{2})\s*[-–]?\s*(.+)$/);
  if (stateCodeMatch) {
    return { state: stateCodeMatch[2].trim(), stateCode: stateCodeMatch[1] };
  }
  return { state, stateCode: null };
}

/** Build a single-line address string from a Zoho address object. */
function flattenAddress(addr: ZohoContact['billing_address']): string | null {
  if (!addr) return null;
  const parts = [
    addr.address,
    addr.street2,
    addr.city,
    addr.state,
    addr.zip,
    addr.country,
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(', ') : null;
}

/** Parse a Zoho date string ("2024-01-15") to ISO date string. Pass-through if already ISO. */
function normalizeDate(d: string | undefined | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  // Zoho returns YYYY-MM-DD for date fields, ISO for created_time/last_modified_time.
  // Pass both through unchanged — they're already sortable ISO-format strings.
  return d;
}

/** Map Zoho payment_mode → VEYRO payment-mode vocabulary. */
function normalizePaymentMode(mode: string | undefined): string | null {
  if (!mode) return null;
  const m = mode.toLowerCase();
  if (m.includes('upi')) return 'upi';
  if (m.includes('bank') || m.includes('transfer') || m.includes('netbanking')) return 'bank';
  if (m.includes('cash')) return 'cash';
  if (m.includes('cheque') || m.includes('check')) return 'cheque';
  if (m.includes('card')) return 'card';
  return m;
}

/** Map Zoho expense category to VEYRO's Expense.category enum. */
function normalizeExpenseCategory(categoryName: string | undefined): string {
  const c = (categoryName ?? '').toLowerCase();
  if (c.includes('office')) return 'Office';
  if (c.includes('travel')) return 'Travel';
  if (c.includes('salary') || c.includes('payroll')) return 'Salary';
  if (c.includes('marketing') || c.includes('advertis')) return 'Marketing';
  if (c.includes('rent')) return 'Rent';
  if (c.includes('utilit') || c.includes('electric') || c.includes('internet')) return 'Utilities';
  if (c.includes('software') || c.includes('saas') || c.includes('subscription')) return 'Software';
  return 'Miscellaneous';
}

// ─── Customer → NormalizedClient ─────────────────────────────────────────────

export function mapCustomerToClient(
  c: ZohoContact,
  sellerGstin: string,
): NormalizedClient {
  const billingAddr = c.billing_address;
  const { state, stateCode } = extractState(billingAddr);
  const primaryPerson = c.contact_persons?.find((p) => p.is_primary_contact) ?? c.contact_persons?.[0];
  const gstin = normalizeGstin(c, 'synthetic') ?? sellerGstin;

  return {
    gstin,
    tradeName: str(c.company_name || c.contact_name, c.contact_name),
    legalName: optionalStr(c.contact_name),
    address: flattenAddress(billingAddr),
    state,
    stateCode,
    contactEmail: optionalStr(primaryPerson?.email ?? c.email),
    contactPhone: optionalStr(primaryPerson?.phone ?? c.phone),
    entityType: c.is_taxable === false ? 'composition' : 'regular',
    status: (c.status ?? 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
  };
}

// ─── Vendor → NormalizedVendor ───────────────────────────────────────────────

export function mapVendor(v: ZohoContact): NormalizedVendor {
  const { state, stateCode } = extractState(v.billing_address);
  const gstin = normalizeGstin(v, 'null');

  const metadata = JSON.stringify({
    source: 'zoho',
    zohoContactId: v.contact_id,
    zohoOrgId: null, // filled by caller
    currencyCode: v.currency_code ?? null,
    contactType: v.contact_type,
    zohoCreatedAt: v.created_time ?? null,
    zohoLastModifiedAt: v.last_modified_time ?? null,
  });

  return {
    name: str(v.company_name || v.contact_name, v.contact_name),
    gstin,
    category: optionalStr(v.contact_type),
    state,
    stateCode,
    status: (v.status ?? 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
    outstanding: num(v.outstanding_payable_amount),
    totalBilled: 0, // computed later from PurchaseBill aggregation
    metadata,
  };
}

// ─── Invoice → NormalizedInvoice ─────────────────────────────────────────────

export function mapInvoice(
  inv: ZohoInvoice,
  clientId: string,
  sellerGstin: string,
): NormalizedInvoice {
  const total = num(inv.total);
  const paid = num(inv.paid);
  const balance = num(inv.balance);
  const cgst = num(inv.cgst);
  const sgst = num(inv.sgst);
  const igst = num(inv.igst);
  const cess = num(inv.cess);
  const taxTotal = num(inv.tax_total);
  const subTotal = num(inv.sub_total);
  const gstAmount = cgst + sgst + igst + cess > 0 ? cgst + sgst + igst + cess : taxTotal;
  const taxableValue = subTotal > 0 ? subTotal - taxTotal : total - gstAmount - paid + paid; // subTotal minus tax

  const isB2B = Boolean(inv.gstin) || inv.gst_treatment === 'business_gst';
  const hasIgst = igst > 0;

  return {
    clientId,
    invoiceNumber: str(inv.invoice_number, inv.invoice_id),
    invoiceDate: normalizeDate(inv.date),
    sellerGstin,
    buyerGstin: optionalStr(inv.gstin),
    buyerName: optionalStr(inv.customer_name),
    invoiceType: isB2B ? 'B2B' : 'B2C',
    taxableValue: Math.max(0, taxableValue),
    cgst,
    sgst,
    igst,
    cess,
    totalAmount: total,
    gstAmount,
    paidAmount: paid,
    balanceAmount: balance,
    dueDate: optionalStr(inv.due_date),
    paymentStatus: normalizePaymentStatus(inv.payment_status, balance, total),
    status: (inv.status ?? 'sent').toLowerCase(),
  };
}

// ─── Bill → NormalizedPurchaseBill ───────────────────────────────────────────

export function mapBill(bill: ZohoBill, clientId: string | null): NormalizedPurchaseBill {
  const total = num(bill.total);
  const paid = num(bill.paid);
  const balance = num(bill.balance);
  const cgst = num(bill.cgst);
  const sgst = num(bill.sgst);
  const igst = num(bill.igst);
  const cess = num(bill.cess);
  const taxTotal = num(bill.tax_total);
  const subTotal = num(bill.sub_total);
  const gstAmount = cgst + sgst + igst + cess > 0 ? cgst + sgst + igst + cess : taxTotal;
  const taxableValue = subTotal > 0 ? subTotal - taxTotal : total - gstAmount;

  // First line item's HSN or account name → category
  const firstLine = bill.line_items?.[0];
  const category = optionalStr(
    firstLine?.account_name ?? firstLine?.hsn_or_sac ?? firstLine?.name,
  );

  return {
    clientId,
    vendorName: str(bill.vendor_name, 'Unknown Vendor'),
    vendorGstin: optionalStr(bill.gstin),
    invoiceNo: str(bill.bill_number, bill.bill_id),
    invoiceDate: normalizeDate(bill.date),
    dueDate: optionalStr(bill.due_date),
    taxableValue: Math.max(0, taxableValue),
    cgst,
    sgst,
    igst,
    cess,
    gstAmount,
    totalAmount: total,
    paidAmount: paid,
    balanceAmount: balance,
    status: (bill.status ?? 'open').toLowerCase(),
    paymentStatus: normalizePaymentStatus(bill.payment_status, balance, total),
    category,
  };
}

// ─── Expense → NormalizedExpense ─────────────────────────────────────────────

export function mapExpense(
  e: ZohoExpense,
  clientId: string | null,
): NormalizedExpense {
  const cgst = num(e.cgst);
  const sgst = num(e.sgst);
  const igst = num(e.igst);
  const cess = num(e.cess);
  const taxTotal = num(e.tax_total);
  const total = num(e.total);
  const gst = cgst + sgst + igst + cess > 0 ? cgst + sgst + igst + cess : taxTotal;

  return {
    clientId,
    category: normalizeExpenseCategory(e.category_name),
    description: optionalStr(e.description ?? e.category_name),
    vendor: optionalStr(e.vendor_name),
    amount: total,
    gst,
    gstClaimable: gst > 0,
    date: normalizeDate(e.date),
    paymentMode: normalizePaymentMode(e.payment_mode),
    status: (e.status ?? 'paid').toLowerCase() === 'paid' ? 'recorded' : 'recorded',
  };
}

// ─── Bank Account → NormalizedBankAccount ────────────────────────────────────

export function mapBankAccount(a: ZohoBankAccount): NormalizedBankAccount {
  const type = (a.account_type ?? 'current').toLowerCase();
  // Map Zoho's account_type strings to VEYRO's enum.
  const accountType =
    type.includes('saving') ? 'savings' :
    type.includes('current') ? 'current' :
    type.includes('overdraft') ? 'overdraft' :
    type.includes('credit') ? 'credit_card' :
    'current';

  return {
    bankName: str(a.bank_name || a.account_name, a.account_name),
    accountMasked: maskAccount(a.account_number),
    accountType,
    ifsc: optionalStr(a.ifsc_code),
    balance: num(a.current_balance),
    availableBalance: num(a.available_balance),
    status: (a.status ?? 'active').toLowerCase() === 'active' ? 'connected' : 'disconnected',
  };
}

// ─── Bank Transaction → NormalizedBankTransaction ────────────────────────────

export function mapBankTransaction(
  t: ZohoBankTransaction,
  accountId: string,
): NormalizedBankTransaction {
  // Zoho returns `debit_or_credit` to indicate direction.
  const dir = (t.debit_or_credit ?? '').toLowerCase();
  const type = dir.includes('credit') ? 'credit' : 'debit';
  // Zoho's `transaction_type` is a category hint (e.g., "sales", "expense", "tax").
  const category = optionalStr(t.transaction_type ?? t.offset_account_name);

  return {
    accountId,
    date: normalizeDate(t.date),
    description: str(
      t.description ?? t.payee ?? t.customer_name ?? t.vendor_name,
      'Bank transaction',
    ),
    amount: Math.abs(num(t.amount)),
    type,
    category,
    referenceNo: optionalStr(t.reference_number),
    matched: Boolean(t.matched) || (t.reconciliation_status ?? '').toLowerCase() === 'matched',
  };
}

// ─── Journal → NormalizedJournalEntry ────────────────────────────────────────

export function mapJournal(j: ZohoJournal): NormalizedJournalEntry {
  const lines = (j.line_items ?? []).map((l) => ({
    account: str(l.account_name, 'Unknown Account'),
    debit: num(l.debit),
    credit: num(l.credit),
    description: optionalStr(l.description),
  }));
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return {
    journalNumber: optionalStr(j.journal_number),
    referenceNumber: optionalStr(j.reference_number),
    date: normalizeDate(j.date),
    totalDebit,
    totalCredit,
    notes: optionalStr(j.notes),
    lines: JSON.stringify(lines),
    status: (j.status ?? 'posted').toLowerCase(),
  };
}

// ─── Tax (lookup-only — not persisted as a row, but tracked in ZohoEntityMap) ─
//
// Taxes are reference data: VEYRO's existing models embed tax amounts
// directly on invoices/bills/expenses (cgst/sgst/igst/cess), so there's no
// dedicated Tax table to write into. We still sync taxes to populate
// ZohoEntityMap (so the UI can show "Taxes: N imported" and future features
// can map Zoho tax_id → tax name).

export interface NormalizedTaxLookup {
  zohoTaxId: string;
  taxName: string;
  taxPercentage: number;
  taxType: string | null;
  status: string;
}

export function mapTax(t: ZohoTax): NormalizedTaxLookup {
  return {
    zohoTaxId: t.tax_id,
    taxName: str(t.tax_name, t.tax_id),
    taxPercentage: num(t.tax_percentage),
    taxType: optionalStr(t.tax_type),
    status: (t.status ?? 'active').toLowerCase(),
  };
}

// ─── Customer Payment → NormalizedPayment ────────────────────────────────────

export function mapCustomerPayment(p: ZohoCustomerPayment): NormalizedPayment {
  return {
    clientId: null, // resolved by caller via customer_id → ZohoEntityMap lookup
    invoiceId: null, // resolved by caller via invoice_id → ZohoEntityMap lookup
    purchaseBillId: null,
    partyName: str(p.customer_name, 'Unknown Customer'),
    partyType: 'customer',
    amount: num(p.amount),
    paymentDate: normalizeDate(p.date),
    paymentMode: normalizePaymentMode(p.payment_mode) ?? 'bank',
    referenceNo: optionalStr(p.reference_number ?? p.payment_number),
    status: (p.status ?? 'completed').toLowerCase() === 'void' ? 'failed' : 'completed',
    notes: optionalStr(p.description),
  };
}

// ─── Vendor Payment → NormalizedPayment ──────────────────────────────────────

export function mapVendorPayment(p: ZohoVendorPayment): NormalizedPayment {
  return {
    clientId: null,
    invoiceId: null,
    purchaseBillId: null, // resolved by caller via bill_id → ZohoEntityMap lookup
    partyName: str(p.vendor_name, 'Unknown Vendor'),
    partyType: 'vendor',
    amount: num(p.amount),
    paymentDate: normalizeDate(p.date),
    paymentMode: normalizePaymentMode(p.payment_mode) ?? 'bank',
    referenceNo: optionalStr(p.reference_number ?? p.payment_number),
    status: (p.status ?? 'completed').toLowerCase() === 'void' ? 'failed' : 'completed',
    notes: optionalStr(p.description),
  };
}

// ─── Item → NormalizedItem ───────────────────────────────────────────────────

export function mapItem(item: ZohoItem): NormalizedItem {
  return {
    name: str(item.name, item.item_id),
    description: optionalStr(item.description),
    itemType: str(item.item_type, 'goods').toLowerCase(),
    unit: optionalStr(item.unit) ?? 'NOS',
    hsnOrSac: optionalStr(item.hsn_or_sac),
    rate: num(item.rate),
    purchaseRate: num(item.purchase_rate),
    taxName: optionalStr(item.tax_name),
    taxPercentage: num(item.tax_percentage),
    isTaxable: item.is_taxable !== false,
    stockOnHand: num(item.stock_on_hand),
    reorderLevel: num(item.reorder_level),
    status: (item.status ?? 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
  };
}

// ─── last_modified_time parser (for incremental watermarks) ──────────────────

/**
 * Parse a Zoho `last_modified_time` (ISO 8601 string, e.g.
 * "2024-01-15T10:30:45+0530") into a JS Date. Returns null if invalid/missing.
 */
export function parseZohoLastModified(
  raw: string | undefined | null,
): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Credit Note mapper (Phase 5) ────────────────────────────────────────────

/**
 * Map a raw Zoho Books credit note to the NormalizedCreditNote shape that
 * gets upserted into the ZohoCreditNote Prisma model.
 */
export function mapCreditNote(cn: ZohoCreditNote): NormalizedCreditNote {
  const lineItems = Array.isArray(cn.line_items)
    ? cn.line_items.map((li) => ({
        lineItemId: li.line_item_id ?? null,
        itemId: li.item_id ?? null,
        name: li.name ?? null,
        description: li.description ?? null,
        quantity: li.quantity ?? 0,
        rate: li.rate ?? 0,
        amount: li.amount ?? li.item_total ?? 0,
        taxName: li.tax_name ?? null,
        taxPercentage: li.tax_percentage ?? 0,
      }))
    : [];

  return {
    zohoCreditNoteId: str(cn.creditnote_id, ''),
    creditNoteNumber: optionalStr(cn.creditnote_number),
    date: optionalStr(cn.date),
    status: str(cn.status, 'open').toLowerCase(),
    customerId: optionalStr(cn.customer_id),
    customerName: optionalStr(cn.customer_name),
    invoiceId: optionalStr(cn.invoice_id),
    invoiceNumber: optionalStr(cn.invoice_number),
    total: num(cn.total),
    subTotal: num(cn.sub_total),
    totalCredited: num(cn.total_credited),
    balance: num(cn.balance),
    currencyCode: optionalStr(cn.currency_code),
    reason: optionalStr(cn.reason),
    notes: optionalStr(cn.notes),
    lineItems: JSON.stringify(lineItems),
    zohoCreatedAt: parseZohoLastModified(cn.created_time),
    zohoUpdatedAt: parseZohoLastModified(cn.last_modified_time),
  };
}
