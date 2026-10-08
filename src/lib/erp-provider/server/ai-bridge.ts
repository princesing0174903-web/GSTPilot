// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — AI Bridge (SERVER-ONLY)
//
// Connects the ERP Provider to the AI Oracle:
//   1. Reads ERP-synced data from Firestore (org-scoped): connections, customers,
//      vendors, invoices, inventory, ledgers, payments, bank transactions, taxes.
//   2. Writes ERP-derived facts to `ai_memory` so Oracle can answer questions
//      like "What's my revenue from ERP?", "Which inventory is low?", "What's
//      my net tax liability?".
//   3. Generates ERP-derived insights:
//       • Revenue / expense / profit (from ERP invoices)
//       • Outstanding receivables / payables (from ERP parties)
//       • Inventory value + low-stock alerts
//       • Cash position (from ERP ledgers)
//       • Net GST liability (from ERP tax summaries)
//       • Top customers / vendors (concentration risk)
//       • Overdue invoices (collection risk)
//
// This module is SERVER-ONLY — it reads Firestore via the firebase/firestore
// server SDK and writes to ai_memory via the AI service.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as limitFn,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { saveMemory, clearMemoriesByType, hashSummary } from '@/lib/ai-provider/service';
import type { ERPProviderName } from '../types';
import { computeERPSummary, toConnection, toCustomer, toVendor, toInvoice, toInventoryItem, toLedger, toTax } from '../service';
import type {
  ERPConnection,
  ERPCustomer,
  ERPVendor,
  ERPInvoice,
  ERPInventoryItem,
  ERPLedger,
  ERPTax,
} from '../types';

// ─── ERP Context Snapshot ─────────────────────────────────────────────────────

/**
 * A snapshot of the organization's ERP state, used by the AI Oracle to enrich
 * its business context. Built from real Firestore data.
 */
export interface ERPSnapshot {
  /** True if any ERP connection exists with status='connected'. */
  erpConnected: boolean;
  /** List of connected providers (e.g. ['tally', 'zoho_books']). */
  connectedProviders: ERPProviderName[];
  /** Total revenue (Σ sales invoices grandTotal). */
  totalRevenue: number;
  /** Total expenses (Σ purchase invoices grandTotal). */
  totalExpenses: number;
  /** Net profit. */
  netProfit: number;
  /** Outstanding receivables. */
  outstandingReceivables: number;
  /** Outstanding payables. */
  outstandingPayables: number;
  /** Inventory stock value. */
  inventoryValue: number;
  /** Count of low/out-of-stock items. */
  lowStockItems: number;
  /** Cash position (bank + cash ledger balances). */
  cashPosition: number;
  /** Count of overdue invoices. */
  overdueInvoices: number;
  /** Net GST liability (output - input). */
  netTaxLiability: number;
  /** Top 5 customers by total sales. */
  topCustomers: Array<{ name: string; totalSales: number }>;
  /** Top 5 vendors by total purchases. */
  topVendors: Array<{ name: string; totalPurchases: number }>;
  /** Customer count. */
  customerCount: number;
  /** Vendor count. */
  vendorCount: number;
  /** Inventory item count. */
  inventoryItemCount: number;
  /** Recent invoices (newest 10). */
  recentInvoices: ERPInvoice[];
  /** Low-stock items (needs restocking). */
  lowStockList: ERPInventoryItem[];
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

/**
 * Build the ERP snapshot from real Firestore data.
 * Returns null if the org has no ERP data synced yet.
 */
export async function gatherERPContext(organizationId: string): Promise<ERPSnapshot | null> {
  if (!organizationId) return null;

  // Read all ERP collections in parallel (org-scoped).
  const [
    connectionsRaw,
    customersRaw,
    vendorsRaw,
    invoicesRaw,
    inventoryRaw,
    ledgersRaw,
    taxesRaw,
  ] = await Promise.all([
    readCollection(organizationId, 'erp_connections'),
    readCollection(organizationId, 'erp_customers'),
    readCollection(organizationId, 'erp_vendors'),
    readCollection(organizationId, 'erp_invoices'),
    readCollection(organizationId, 'erp_inventory'),
    readCollection(organizationId, 'erp_ledgers'),
    readCollection(organizationId, 'erp_taxes'),
  ]);

  if (
    connectionsRaw.length === 0 &&
    customersRaw.length === 0 &&
    invoicesRaw.length === 0
  ) {
    return null;
  }

  const connections = connectionsRaw.map((r) => toConnection(r.id, r.data));
  const customers = customersRaw.map((r) => toCustomer(r.id, r.data));
  const vendors = vendorsRaw.map((r) => toVendor(r.id, r.data));
  const invoices = invoicesRaw.map((r) => toInvoice(r.id, r.data));
  const inventory = inventoryRaw.map((r) => toInventoryItem(r.id, r.data));
  const ledgers = ledgersRaw.map((r) => toLedger(r.id, r.data));
  const taxes = taxesRaw.map((r) => toTax(r.id, r.data));

  const summary = computeERPSummary(connections, customers, vendors, invoices, inventory, ledgers, taxes);

  const connected = connections.filter((c) => c.connectionStatus === 'connected');

  return {
    erpConnected: connected.length > 0,
    connectedProviders: connected.map((c) => c.provider),
    totalRevenue: summary.totalRevenue,
    totalExpenses: summary.totalExpenses,
    netProfit: summary.netProfit,
    outstandingReceivables: summary.outstandingReceivables,
    outstandingPayables: summary.outstandingPayables,
    inventoryValue: summary.inventoryValue,
    lowStockItems: summary.lowStockItems,
    cashPosition: summary.cashPosition,
    overdueInvoices: summary.overdueInvoices,
    netTaxLiability: summary.netTaxLiability,
    topCustomers: summary.topCustomers,
    topVendors: summary.topVendors,
    customerCount: summary.customerCount,
    vendorCount: summary.vendorCount,
    inventoryItemCount: summary.inventoryItemCount,
    recentInvoices: summary.recentInvoices,
    lowStockList: inventory.filter(
      (i) => i.stockStatus === 'low_stock' || i.stockStatus === 'out_of_stock',
    ).slice(0, 10),
  };
}

// ─── ERP Insights → AI Memory ─────────────────────────────────────────────────

/**
 * Analyze the ERP snapshot and write AI memory entries to ai_memory.
 * These facts let Oracle answer questions like:
 *   - "What's my revenue from my ERP?"
 *   - "Which inventory items are running low?"
 *   - "What's my net GST liability?"
 *   - "Who are my top customers?"
 *   - "What's my cash position?"
 *
 * Returns the count of memory entries written.
 */
export async function persistERPInsightsToMemory(
  organizationId: string,
  snapshot: ERPSnapshot,
): Promise<number> {
  if (!organizationId) return 0;

  // Clear stale ERP facts so we don't accumulate duplicates across runs.
  await clearMemoriesByType(organizationId, 'fact').catch(() => 0);

  let count = 0;
  const now = new Date().toISOString();

  // 1. Revenue / expense / profit fact
  if (snapshot.erpConnected && snapshot.totalRevenue > 0) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `ERP revenue: ₹${snapshot.totalRevenue.toLocaleString('en-IN')}, expenses: ₹${snapshot.totalExpenses.toLocaleString('en-IN')}, net profit: ₹${snapshot.netProfit.toLocaleString('en-IN')} (synced from ${snapshot.connectedProviders.join(', ')}).`,
      embeddingPlaceholder: hashSummary(`erp|revenue|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_revenue',
        totalRevenue: snapshot.totalRevenue,
        totalExpenses: snapshot.totalExpenses,
        netProfit: snapshot.netProfit,
        providers: snapshot.connectedProviders,
      },
    }).catch(() => null);
    count++;
  }

  // 2. Outstanding receivables / payables fact
  if (snapshot.outstandingReceivables > 0 || snapshot.outstandingPayables > 0) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `Outstanding receivables: ₹${snapshot.outstandingReceivables.toLocaleString('en-IN')}, payables: ₹${snapshot.outstandingPayables.toLocaleString('en-IN')} from ERP data.`,
      embeddingPlaceholder: hashSummary(`erp|outstanding|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_outstanding',
        outstandingReceivables: snapshot.outstandingReceivables,
        outstandingPayables: snapshot.outstandingPayables,
      },
    }).catch(() => null);
    count++;
  }

  // 3. Inventory value + low-stock alert
  if (snapshot.inventoryItemCount > 0) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `Inventory: ${snapshot.inventoryItemCount} items valued at ₹${snapshot.inventoryValue.toLocaleString('en-IN')}. ${snapshot.lowStockItems} item(s) need restocking.`,
      embeddingPlaceholder: hashSummary(`erp|inventory|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_inventory',
        inventoryValue: snapshot.inventoryValue,
        itemCount: snapshot.inventoryItemCount,
        lowStockItems: snapshot.lowStockItems,
        lowStockList: snapshot.lowStockList.map((i) => ({ name: i.name, code: i.itemCode, status: i.stockStatus })),
      },
    }).catch(() => null);
    count++;
  }

  // 4. Cash position fact
  if (snapshot.cashPosition !== 0) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `Cash position from ERP ledgers: ₹${snapshot.cashPosition.toLocaleString('en-IN')} (bank + cash accounts).`,
      embeddingPlaceholder: hashSummary(`erp|cash|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_cash',
        cashPosition: snapshot.cashPosition,
      },
    }).catch(() => null);
    count++;
  }

  // 5. Net GST liability fact
  if (snapshot.netTaxLiability > 0) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `Net GST liability from ERP tax summaries: ₹${snapshot.netTaxLiability.toLocaleString('en-IN')} (output tax minus input tax credit).`,
      embeddingPlaceholder: hashSummary(`erp|tax|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_tax',
        netTaxLiability: snapshot.netTaxLiability,
      },
    }).catch(() => null);
    count++;
  }

  // 6. Top customers (concentration insight)
  if (snapshot.topCustomers.length > 0) {
    const top3 = snapshot.topCustomers.slice(0, 3);
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `Top customers by revenue: ${top3.map((c) => `${c.name} (₹${c.totalSales.toLocaleString('en-IN')})`).join(', ')}.`,
      embeddingPlaceholder: hashSummary(`erp|topcustomers|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_top_customers',
        topCustomers: snapshot.topCustomers,
      },
    }).catch(() => null);
    count++;
  }

  // 7. Top vendors (supplier concentration)
  if (snapshot.topVendors.length > 0) {
    const top3 = snapshot.topVendors.slice(0, 3);
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'erp',
      summary: `Top vendors by purchases: ${top3.map((v) => `${v.name} (₹${v.totalPurchases.toLocaleString('en-IN')})`).join(', ')}.`,
      embeddingPlaceholder: hashSummary(`erp|topvendors|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_top_vendors',
        topVendors: snapshot.topVendors,
      },
    }).catch(() => null);
    count++;
  }

  // 8. Overdue invoices alert
  if (snapshot.overdueInvoices > 0) {
    await saveMemory(organizationId, {
      type: 'alert',
      source: 'erp',
      summary: `${snapshot.overdueInvoices} overdue invoice(s) in ERP data — collection action needed.`,
      embeddingPlaceholder: hashSummary(`erp|overdue|${organizationId}|${now.slice(0, 10)}`),
      metadata: {
        category: 'erp_overdue',
        overdueInvoices: snapshot.overdueInvoices,
      },
    }).catch(() => null);
    count++;
  }

  return count;
}

// ─── Oracle chat enrichment ───────────────────────────────────────────────────

/**
 * Build a human-readable context string from the ERP snapshot, for injecting
 * into Oracle chat prompts. Returns empty string if no ERP data.
 */
export function buildERPContextText(snapshot: ERPSnapshot | null): string {
  if (!snapshot || !snapshot.erpConnected) return '';
  const lines: string[] = [];
  lines.push(`ERP Integrations: ${snapshot.connectedProviders.join(', ')}`);
  if (snapshot.totalRevenue > 0) {
    lines.push(`ERP Revenue: ₹${snapshot.totalRevenue.toLocaleString('en-IN')}`);
    lines.push(`ERP Expenses: ₹${snapshot.totalExpenses.toLocaleString('en-IN')}`);
    lines.push(`ERP Net Profit: ₹${snapshot.netProfit.toLocaleString('en-IN')}`);
  }
  if (snapshot.outstandingReceivables > 0) {
    lines.push(`Outstanding Receivables: ₹${snapshot.outstandingReceivables.toLocaleString('en-IN')}`);
  }
  if (snapshot.outstandingPayables > 0) {
    lines.push(`Outstanding Payables: ₹${snapshot.outstandingPayables.toLocaleString('en-IN')}`);
  }
  if (snapshot.inventoryValue > 0) {
    lines.push(`Inventory Value: ₹${snapshot.inventoryValue.toLocaleString('en-IN')} (${snapshot.inventoryItemCount} items, ${snapshot.lowStockItems} low stock)`);
  }
  if (snapshot.cashPosition !== 0) {
    lines.push(`Cash Position: ₹${snapshot.cashPosition.toLocaleString('en-IN')}`);
  }
  if (snapshot.netTaxLiability > 0) {
    lines.push(`Net GST Liability: ₹${snapshot.netTaxLiability.toLocaleString('en-IN')}`);
  }
  if (snapshot.overdueInvoices > 0) {
    lines.push(`Overdue Invoices: ${snapshot.overdueInvoices}`);
  }
  return lines.join('\n');
}

// ─── Firestore read helper ────────────────────────────────────────────────────

async function readCollection(
  organizationId: string,
  collName: string,
  maxDocs = 500,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const q = query(
    collection(db, collName),
    where('organizationId', '==', organizationId),
    orderBy('updatedAt', 'desc'),
    limitFn(maxDocs),
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
  } catch {
    return [];
  }
}

// ─── Type re-exports ─────────────────────────────────────────────────────────

export type {
  ERPConnection,
  ERPCustomer,
  ERPVendor,
  ERPInvoice,
  ERPInventoryItem,
  ERPLedger,
  ERPTax,
};
