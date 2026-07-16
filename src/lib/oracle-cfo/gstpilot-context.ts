// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — GSTPilot Live Data Context Block
//
// Server-side loader that reads the REAL Firestore collections at:
//   organizations/{organizationId}/{customers,products,invoices,vendors,expenses,payments}
//
// Produces a formatted context block injected into the Oracle system prompt so
// that when the user asks "Show customers / invoices / products", Oracle replies
// with the ACTUAL live data — never fabricated, never mock.
//
// ORG-SCOPED (MULTI-TENANT): the caller must pass the real `organizationId`
// (sourced from the request context). If null/empty, the loader returns an
// empty snapshot — no Firestore read, no permission error.
//
// Firestore is the ONLY source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getCustomersOnce,
  getProductsOnce,
  getInvoicesOnce,
  getVendorsOnce,
  getExpensesOnce,
  getPaymentsOnce,
  computeInvoiceStatsLocal,
  computeProductStats,
  computeExpenseStatsLocal,
  computePaymentStatsLocal,
  type Customer,
  type Product,
  type Invoice,
  type Vendor,
  type Expense,
  type Payment,
  type InvoiceStats,
  type ProductStats,
  type VendorStats,
  type ExpenseStats,
  type PaymentStats,
} from '@/lib/gstpilot-data';

// ─── INR formatting (server-side, short form) ─────────────────────────────────

function inrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function inrFull(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

// ─── Snapshot type ────────────────────────────────────────────────────────────

export interface GSTpilotSnapshot {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  vendors: Vendor[];
  expenses: Expense[];
  payments: Payment[];
  invoiceStats: InvoiceStats;
  productStats: ProductStats;
  expenseStats: ExpenseStats;
  paymentStats: PaymentStats;
  vendorStats: VendorStats;
  customerCount: number;
  withGstin: number;
  totalCustomerOutstanding: number;
  vendorCount: number;
  totalPayable: number;
  loaded: boolean;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load a one-shot snapshot of all three GSTPilot collections from Firestore.
 * Safe to call server-side (API route). Returns an empty (loaded:false) snapshot
 * if Firestore is unreachable or permission is denied (preview mode).
 *
 * ORG-SCOPED: pass the real `organizationId` from the request context. If null/
 * empty, no Firestore read is attempted — returns an unloaded snapshot.
 */
export async function loadGSTpilotSnapshot(
  organizationId: string | null | undefined,
): Promise<GSTpilotSnapshot> {
  if (!organizationId || !organizationId.trim()) {
    return {
      customers: [],
      products: [],
      invoices: [],
      vendors: [],
      expenses: [],
      payments: [],
      invoiceStats: computeInvoiceStatsLocal([]),
      productStats: computeProductStats([]),
      expenseStats: computeExpenseStatsLocal([]),
      paymentStats: computePaymentStatsLocal([]),
      vendorStats: { count: 0, totalPayable: 0, withGstin: 0 },
      customerCount: 0,
      withGstin: 0,
      totalCustomerOutstanding: 0,
      vendorCount: 0,
      totalPayable: 0,
      loaded: false,
    };
  }
  try {
    const [customers, products, invoices, vendors, expenses, payments] = await Promise.all([
      getCustomersOnce(organizationId),
      getProductsOnce(organizationId),
      getInvoicesOnce(organizationId),
      getVendorsOnce(organizationId),
      getExpensesOnce(organizationId),
      getPaymentsOnce(organizationId),
    ]);

    const invoiceStats = computeInvoiceStatsLocal(invoices);
    const productStats = computeProductStats(products);
    const expenseStats = computeExpenseStatsLocal(expenses);
    const paymentStats = computePaymentStatsLocal(payments);
    const totalCustomerOutstanding = Math.round(
      customers.reduce((s, c) => s + (c.balance || 0), 0) * 100,
    ) / 100;
    const withGstin = customers.filter((c) => !!c.gstin).length;
    const vendorCount = vendors.length;
    const vendorWithGstin = vendors.filter((v) => !!v.gstin).length;
    const totalPayable = Math.round(
      vendors.reduce((s, v) => s + (v.balance || 0), 0) * 100,
    ) / 100;

    return {
      customers,
      products,
      invoices,
      vendors,
      expenses,
      payments,
      invoiceStats,
      productStats,
      expenseStats,
      paymentStats,
      vendorStats: {
        count: vendorCount,
        totalPayable,
        withGstin: vendorWithGstin,
      },
      customerCount: customers.length,
      withGstin,
      totalCustomerOutstanding,
      vendorCount,
      totalPayable,
      loaded: true,
    };
  } catch {
    return {
      customers: [],
      products: [],
      invoices: [],
      vendors: [],
      expenses: [],
      payments: [],
      invoiceStats: computeInvoiceStatsLocal([]),
      productStats: computeProductStats([]),
      expenseStats: computeExpenseStatsLocal([]),
      paymentStats: computePaymentStatsLocal([]),
      vendorStats: { count: 0, totalPayable: 0, withGstin: 0 },
      customerCount: 0,
      withGstin: 0,
      totalCustomerOutstanding: 0,
      vendorCount: 0,
      totalPayable: 0,
      loaded: false,
    };
  }
}

// ─── Formatter ────────────────────────────────────────────────────────────────

/**
 * Format the GSTPilot snapshot into a markdown context block for the Oracle
 * system prompt. Includes:
 *   • Aggregate KPIs (counts, revenue, outstanding, tax)
 *   • Top customers by outstanding balance
 *   • Top products by name
 *   • Recent invoices (most recent first)
 *   • Explicit instructions for "Show customers / invoices / products" commands
 */
export function formatGSTpilotContextBlock(snap: GSTpilotSnapshot): string {
  const anyData =
    snap.customerCount > 0 ||
    snap.products.length > 0 ||
    snap.invoices.length > 0 ||
    snap.vendorCount > 0 ||
    snap.expenses.length > 0 ||
    snap.payments.length > 0;
  if (!snap.loaded || !anyData) {
    return `## GSTPILOT LIVE REGISTRY (organizations/GSTpilot_SAAS)
Source: Firestore — organizations/GSTpilot_SAAS/{customers,products,invoices,vendors,expenses,payments}
Status: No documents found yet (the collections are empty, or preview-mode security rules blocked the read).

When the user asks to "show customers / invoices / products / vendors / expenses / payments", reply honestly that the registry is currently empty and guide them to add their first record from the relevant page (CRM, Inventory, Invoices, Vendors, Expenses, or Payments). NEVER fabricate customer, product, invoice, vendor, expense, or payment records.`;
  }

  const s = snap.invoiceStats;
  const e = snap.expenseStats;
  const p = snap.paymentStats;
  const lines: string[] = [];

  lines.push(`## GSTPILOT LIVE REGISTRY (organizations/GSTpilot_SAAS)`);
  lines.push(`Source: Firestore — organizations/GSTpilot_SAAS/{customers,products,invoices,vendors,expenses,payments} (real-time, onSnapshot)`);
  lines.push(`Status: LIVE — ${snap.customerCount} customers, ${snap.products.length} products, ${s.count} invoices, ${snap.vendorCount} vendors, ${e.count} expenses, ${p.count} payments.`);
  lines.push(``);

  // ── Aggregate KPIs ──
  lines.push(`### AGGREGATE KPIs (real)`);
  lines.push(`- Total Customers: ${snap.customerCount} (${snap.withGstin} with GSTIN)`);
  lines.push(`- Customer Outstanding (sum of balances): ${inrFull(snap.totalCustomerOutstanding)}`);
  lines.push(`- Total Vendors: ${snap.vendorCount} (${snap.vendorStats.withGstin} with GSTIN)`);
  lines.push(`- Total Payable (vendors): ${inrFull(snap.totalPayable)}`);
  lines.push(`- Total Products: ${snap.products.length} (stock value ${inrFull(snap.productStats.totalStockValue)}, ${snap.productStats.lowStockCount} low, ${snap.productStats.outOfStockCount} out of stock)`);
  lines.push(`- Total Invoices: ${s.count}`);
  lines.push(`- Total Invoiced (excl. cancelled): ${inrFull(s.totalInvoiced)}`);
  lines.push(`- Total Paid: ${inrFull(s.totalPaid)}`);
  lines.push(`- Total Outstanding: ${inrFull(s.totalOutstanding)}`);
  lines.push(`- Total Tax Collected: ${inrFull(s.totalTaxCollected)}`);
  lines.push(`- By status: draft ${s.byStatus.draft}, sent ${s.byStatus.sent}, paid ${s.byStatus.paid}, partial ${s.byStatus.partial}, overdue ${s.byStatus.overdue}, cancelled ${s.byStatus.cancelled}`);
  lines.push(`- Total Expenses: ${e.count} (sum ${inrFull(e.totalAmount)})`);
  lines.push(`- Expense GST (claimable ITC): ${inrFull(e.claimableGst)} of ${inrFull(e.totalGst)} GST total`);
  lines.push(`- Total Payments Received: ${inrFull(p.totalReceived)}`);
  lines.push(`- Total Payments Paid Out: ${inrFull(p.totalPaidOut)}`);
  lines.push(``);

  // ── Top customers by outstanding balance ──
  const topCustomers = [...snap.customers]
    .sort((a, b) => (b.balance || 0) - (a.balance || 0))
    .slice(0, 15);
  if (topCustomers.length > 0) {
    lines.push(`### CUSTOMERS (top ${topCustomers.length} by outstanding balance)`);
    for (const c of topCustomers) {
      const parts = [c.name];
      if (c.gstin) parts.push(`GSTIN ${c.gstin}`);
      if (c.state) parts.push(c.state);
      if (c.email) parts.push(c.email);
      if ((c.balance || 0) > 0) parts.push(`outstanding ${inrFull(c.balance)}`);
      lines.push(`- ${parts.join(' · ')}`);
    }
    lines.push(``);
  }

  // ── Products ──
  const topProducts = snap.products.slice(0, 15);
  if (topProducts.length > 0) {
    lines.push(`### PRODUCTS / SERVICES (first ${topProducts.length})`);
    for (const p of topProducts) {
      const parts = [p.name];
      if (p.sku) parts.push(`SKU ${p.sku}`);
      parts.push(`HSN ${p.hsnSac || '-'}`);
      parts.push(`GST ${p.gstRate}%`);
      parts.push(`${inrFull(p.price)}/${p.unit}`);
      if (!p.isService && p.stock != null) parts.push(`stock ${p.stock}`);
      if (p.isService) parts.push('service');
      lines.push(`- ${parts.join(' · ')}`);
    }
    lines.push(``);
  }

  // ── Recent invoices ──
  const recentInvoices = snap.invoices.slice(0, 15);
  if (recentInvoices.length > 0) {
    lines.push(`### INVOICES (most recent ${recentInvoices.length})`);
    for (const inv of recentInvoices) {
      const parts = [inv.invoiceNumber, inv.customerName];
      if (inv.customerGstin) parts.push(`buyer ${inv.customerGstin}`);
      parts.push(`dated ${inv.invoiceDate}`);
      parts.push(`${inrFull(inv.grandTotal)}`);
      if ((inv.balanceDue || 0) > 0) parts.push(`balance ${inrFull(inv.balanceDue)}`);
      parts.push(inv.status);
      parts.push(inv.paymentStatus);
      lines.push(`- ${parts.join(' · ')}`);
    }
    lines.push(``);
  }

  // ── Vendors ──
  const topVendors = snap.vendors.slice(0, 15);
  if (topVendors.length > 0) {
    lines.push(`### VENDORS (first ${topVendors.length})`);
    for (const v of topVendors) {
      const parts = [v.name];
      parts.push(`GSTIN ${v.gstin || 'unregistered'}`);
      parts.push(v.category);
      if ((v.balance || 0) > 0) parts.push(`payable ${inrFull(v.balance)}`);
      lines.push(`- ${parts.join(' · ')}`);
    }
    lines.push(``);
  }

  // ── Recent expenses ──
  const recentExpenses = snap.expenses.slice(0, 15);
  if (recentExpenses.length > 0) {
    lines.push(`### EXPENSES (most recent ${recentExpenses.length})`);
    for (const ex of recentExpenses) {
      const desc = ex.description.length > 60 ? ex.description.slice(0, 57) + '...' : ex.description;
      const parts = [ex.date, ex.vendorName || 'Ad-hoc', ex.category, desc];
      parts.push(`${inrFull(ex.amount)}`);
      if (ex.gst > 0) parts.push(`GST ${inrFull(ex.gst)}`);
      parts.push(ex.status);
      lines.push(`- ${parts.join(' · ')}`);
    }
    lines.push(``);
  }

  // ── Recent payments ──
  const recentPayments = snap.payments.slice(0, 15);
  if (recentPayments.length > 0) {
    lines.push(`### PAYMENTS (most recent ${recentPayments.length})`);
    for (const pay of recentPayments) {
      const parts = [pay.paymentDate, pay.partyType, pay.partyName || '—'];
      parts.push(`inv ${pay.invoiceNumber || '—'}`);
      parts.push(`${inrFull(pay.amount)}`);
      parts.push(pay.paymentMode);
      parts.push(pay.status);
      lines.push(`- ${parts.join(' · ')}`);
    }
    lines.push(``);
  }

  // ── Behaviour instructions ──
  lines.push(`### COMMANDS — "Show customers / invoices / products / vendors / expenses / payments"`);
  lines.push(`When the user asks to "show customers", "list customers", "who are my customers", or similar — reply with a concise list drawn from the CUSTOMERS section above (name · GSTIN · state · outstanding). Cite real names and real outstanding amounts. NEVER invent customers.`);
  lines.push(`When the user asks to "show invoices", "list invoices", "recent invoices", or similar — reply with a concise list drawn from the INVOICES section above (invoice number · customer · total · balance · status). NEVER invent invoices or invoice numbers.`);
  lines.push(`When the user asks to "show products", "list products", "what do I sell", or similar — reply with a concise list drawn from the PRODUCTS section above (name · HSN · GST rate · price · stock). NEVER invent products.`);
  lines.push(`When the user asks to "show vendors", "list vendors", "who are my suppliers", or similar — reply with a concise list drawn from the VENDORS section above (name · GSTIN or "unregistered" · category · payable balance). Cite real names and real payable amounts. NEVER invent vendors.`);
  lines.push(`When the user asks to "show expenses", "list expenses", "recent expenses", or similar — reply with a concise list drawn from the EXPENSES section above (date · vendor or "Ad-hoc" · category · description · amount · GST · status). NEVER invent expenses or amounts.`);
  lines.push(`When the user asks to "show payments", "list payments", "recent payments", or similar — reply with a concise list drawn from the PAYMENTS section above (date · partyType · partyName · invoice# · amount · mode · status). NEVER invent payments.`);
  lines.push(`When the user asks for totals (revenue, outstanding, tax collected, customer count, product count, invoice count, vendor count, total payable, total expenses, expense GST claimable, total payments received, total payments paid out) — cite the AGGREGATE KPIs above exactly. Round money to rupees.`);
  lines.push(`If a section is empty, say so plainly (e.g. "You have no invoices yet." or "You have no vendors yet.") and suggest the relevant page (CRM, Inventory, Invoices, Vendors, Expenses, or Payments). Do NOT pad with fabricated examples.`);

  return lines.join('\n');
}

/**
 * Convenience: load + format in one call. Fail-safe (returns a graceful
 * "unavailable" block on any error so the Oracle prompt still builds).
 *
 * Pass the real `organizationId` from the request context. If null/empty, the
 * returned block reports the registry as unavailable (honest empty state).
 */
export async function buildGSTpilotContextBlock(
  organizationId: string | null | undefined,
): Promise<string> {
  try {
    const snap = await loadGSTpilotSnapshot(organizationId);
    return formatGSTpilotContextBlock(snap);
  } catch (err) {
    console.warn('[Oracle] GSTPilot context unavailable:', err);
    return `## GSTPILOT LIVE REGISTRY (organizations/${organizationId ?? '(no org)'})
The live GSTPilot registry could not be loaded right now. If the user asks to "show customers / invoices / products / vendors / expenses / payments", reply that the registry is temporarily unavailable and suggest they try again in a moment. NEVER fabricate customer, product, invoice, vendor, expense, or payment records.`;
  }
}
