// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — GSTPilot Live Data Context Block
//
// Server-side loader that reads the REAL Firestore collections at:
//   organizations/GSTpilot_SAAS/{customers,products,invoices}
//
// Produces a formatted context block injected into the Oracle system prompt so
// that when the user asks "Show customers / invoices / products", Oracle replies
// with the ACTUAL live data — never fabricated, never mock.
//
// Firestore is the ONLY source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  getCustomersOnce,
  getProductsOnce,
  getInvoicesOnce,
  computeInvoiceStatsLocal,
  computeProductStats,
  type Customer,
  type Product,
  type Invoice,
  type InvoiceStats,
  type ProductStats,
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
  invoiceStats: InvoiceStats;
  productStats: ProductStats;
  customerCount: number;
  withGstin: number;
  totalCustomerOutstanding: number;
  loaded: boolean;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Load a one-shot snapshot of all three GSTPilot collections from Firestore.
 * Safe to call server-side (API route). Returns an empty (loaded:false) snapshot
 * if Firestore is unreachable or permission is denied (preview mode).
 */
export async function loadGSTpilotSnapshot(): Promise<GSTpilotSnapshot> {
  try {
    const [customers, products, invoices] = await Promise.all([
      getCustomersOnce(),
      getProductsOnce(),
      getInvoicesOnce(),
    ]);

    const invoiceStats = computeInvoiceStatsLocal(invoices);
    const productStats = computeProductStats(products);
    const totalCustomerOutstanding = Math.round(
      customers.reduce((s, c) => s + (c.balance || 0), 0) * 100,
    ) / 100;
    const withGstin = customers.filter((c) => !!c.gstin).length;

    return {
      customers,
      products,
      invoices,
      invoiceStats,
      productStats,
      customerCount: customers.length,
      withGstin,
      totalCustomerOutstanding,
      loaded: true,
    };
  } catch {
    return {
      customers: [],
      products: [],
      invoices: [],
      invoiceStats: computeInvoiceStatsLocal([]),
      productStats: computeProductStats([]),
      customerCount: 0,
      withGstin: 0,
      totalCustomerOutstanding: 0,
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
  if (!snap.loaded || (snap.customerCount === 0 && snap.products.length === 0 && snap.invoices.length === 0)) {
    return `## GSTPILOT LIVE REGISTRY (organizations/GSTpilot_SAAS)
Source: Firestore — organizations/GSTpilot_SAAS/{customers,products,invoices}
Status: No documents found yet (the collections are empty, or preview-mode security rules blocked the read).

When the user asks to "show customers", "show invoices", or "show products", reply honestly that the registry is currently empty and guide them to add their first customer/product/invoice from the CRM, Inventory, or Invoices pages. NEVER fabricate customer, product, or invoice records.`;
  }

  const s = snap.invoiceStats;
  const lines: string[] = [];

  lines.push(`## GSTPILOT LIVE REGISTRY (organizations/GSTpilot_SAAS)`);
  lines.push(`Source: Firestore — organizations/GSTpilot_SAAS/{customers,products,invoices} (real-time, onSnapshot)`);
  lines.push(`Status: LIVE — ${snap.customerCount} customers, ${snap.products.length} products, ${s.count} invoices.`);
  lines.push(``);

  // ── Aggregate KPIs ──
  lines.push(`### AGGREGATE KPIs (real)`);
  lines.push(`- Total Customers: ${snap.customerCount} (${snap.withGstin} with GSTIN)`);
  lines.push(`- Customer Outstanding (sum of balances): ${inrFull(snap.totalCustomerOutstanding)}`);
  lines.push(`- Total Products: ${snap.products.length} (stock value ${inrFull(snap.productStats.totalStockValue)}, ${snap.productStats.lowStockCount} low, ${snap.productStats.outOfStockCount} out of stock)`);
  lines.push(`- Total Invoices: ${s.count}`);
  lines.push(`- Total Invoiced (excl. cancelled): ${inrFull(s.totalInvoiced)}`);
  lines.push(`- Total Paid: ${inrFull(s.totalPaid)}`);
  lines.push(`- Total Outstanding: ${inrFull(s.totalOutstanding)}`);
  lines.push(`- Total Tax Collected: ${inrFull(s.totalTaxCollected)}`);
  lines.push(`- By status: draft ${s.byStatus.draft}, sent ${s.byStatus.sent}, paid ${s.byStatus.paid}, partial ${s.byStatus.partial}, overdue ${s.byStatus.overdue}, cancelled ${s.byStatus.cancelled}`);
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

  // ── Behaviour instructions ──
  lines.push(`### COMMANDS — "Show customers / invoices / products"`);
  lines.push(`When the user asks to "show customers", "list customers", "who are my customers", or similar — reply with a concise list drawn from the CUSTOMERS section above (name · GSTIN · state · outstanding). Cite real names and real outstanding amounts. NEVER invent customers.`);
  lines.push(`When the user asks to "show invoices", "list invoices", "recent invoices", or similar — reply with a concise list drawn from the INVOICES section above (invoice number · customer · total · balance · status). NEVER invent invoices or invoice numbers.`);
  lines.push(`When the user asks to "show products", "list products", "what do I sell", or similar — reply with a concise list drawn from the PRODUCTS section above (name · HSN · GST rate · price · stock). NEVER invent products.`);
  lines.push(`When the user asks for totals (revenue, outstanding, tax collected, customer count, product count, invoice count) — cite the AGGREGATE KPIs above exactly. Round money to rupees.`);
  lines.push(`If a section is empty, say so plainly (e.g. "You have no invoices yet.") and suggest the relevant page. Do NOT pad with fabricated examples.`);

  return lines.join('\n');
}

/**
 * Convenience: load + format in one call. Fail-safe (returns a graceful
 * "unavailable" block on any error so the Oracle prompt still builds).
 */
export async function buildGSTpilotContextBlock(): Promise<string> {
  try {
    const snap = await loadGSTpilotSnapshot();
    return formatGSTpilotContextBlock(snap);
  } catch (err) {
    console.warn('[Oracle] GSTPilot context unavailable:', err);
    return `## GSTPILOT LIVE REGISTRY (organizations/GSTpilot_SAAS)
The live GSTPilot registry could not be loaded right now. If the user asks to "show customers / invoices / products", reply that the registry is temporarily unavailable and suggest they try again in a moment. NEVER fabricate customer, product, or invoice records.`;
  }
}
