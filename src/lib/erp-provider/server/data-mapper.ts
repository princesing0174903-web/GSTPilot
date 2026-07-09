// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Data Mapping Engine (SERVER-ONLY)
//
// Maps ERP records to GSTPilot's canonical entities:
//   • ERP Customer  → GSTPilot Client
//   • ERP Invoice   → GSTPilot Invoice
//   • ERP Ledger    → GSTPilot Ledger
//   • ERP Inventory → GSTPilot Inventory
//
// Pure functions — safe to call from both orchestrator (server) and service
// (client). No Firebase imports.
//
// The mapper produces a "mapping proposal" — the orchestrator decides whether
// to actually write the mapped entity (e.g. create a new Client) or link to an
// existing one (matched by GSTIN / name).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ERPCustomer,
  ERPInvoice,
  ERPInventoryItem,
  ERPLedger,
  ERPVendor,
} from '../types';

// ─── Mapping result types ─────────────────────────────────────────────────────

export interface CustomerMapping {
  /** The ERP customer being mapped. */
  erpCustomer: ERPCustomer;
  /** Proposed GSTPilot client payload (new or update). */
  clientPayload: {
    name: string;
    gstin: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    stateCode: string | null;
    /** Outstanding receivable from ERP. */
    openingBalance: number;
    /** Source identifier for traceability. */
    source: 'erp';
    sourceProvider: ERPCustomer['provider'];
    sourceId: string;
  };
  /** Match strategy used. */
  matchStrategy: 'gstin' | 'name' | 'phone' | 'none';
  /** Confidence 0..1 that this maps to an existing client. */
  confidence: number;
}

export interface InvoiceMapping {
  erpInvoice: ERPInvoice;
  invoicePayload: {
    invoiceNumber: string;
    clientName: string;
    clientGstin: string | null;
    invoiceDate: string;
    dueDate: string | null;
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    balanceDue: number;
    invoiceType: 'sales' | 'purchase';
    status: string;
    lineItems: Array<{
      description: string;
      hsn: string | null;
      quantity: number;
      rate: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
      total: number;
    }>;
    source: 'erp';
    sourceProvider: ERPInvoice['provider'];
    sourceInvoiceNumber: string;
  };
  matchStrategy: 'invoice_number' | 'party_gstin' | 'none';
  confidence: number;
}

export interface LedgerMapping {
  erpLedger: ERPLedger;
  ledgerPayload: {
    name: string;
    ledgerType: ERPLedger['ledgerType'];
    gstin: string | null;
    openingBalance: number;
    closingBalance: number;
    asOfDate: string;
    parentGroup: string | null;
    source: 'erp';
    sourceProvider: ERPLedger['provider'];
  };
}

export interface InventoryMapping {
  erpItem: ERPInventoryItem;
  itemPayload: {
    itemCode: string;
    name: string;
    hsn: string | null;
    unit: string | null;
    quantity: number;
    stockValue: number;
    salePrice: number;
    purchasePrice: number;
    reorderLevel: number;
    stockStatus: ERPInventoryItem['stockStatus'];
    source: 'erp';
    sourceProvider: ERPInventoryItem['provider'];
  };
}

// ─── Customer → Client mapping ────────────────────────────────────────────────

/**
 * Map an ERP customer to a GSTPilot client payload.
 *
 * Match strategy (highest priority first):
 *   1. GSTIN exact match → confidence 1.0
 *   2. Name normalized match → confidence 0.8
 *   3. Phone match → confidence 0.7
 *   4. No match → new client (confidence 0)
 *
 * `existingClients` is the list of existing GSTPilot clients to match against.
 */
export function mapCustomerToClient(
  erpCustomer: ERPCustomer,
  existingClients: Array<{
    id: string;
    name: string;
    gstin?: string | null;
    phone?: string | null;
  }> = [],
): CustomerMapping {
  // 1. GSTIN match (strongest)
  if (erpCustomer.gstin) {
    const gstinMatch = existingClients.find(
      (c) => c.gstin && c.gstin.toUpperCase() === erpCustomer.gstin!.toUpperCase(),
    );
    if (gstinMatch) {
      return {
        erpCustomer,
        clientPayload: buildClientPayload(erpCustomer),
        matchStrategy: 'gstin',
        confidence: 1.0,
      };
    }
  }
  // 2. Name normalized match
  const normalizedName = normalizeName(erpCustomer.name);
  const nameMatch = existingClients.find(
    (c) => normalizeName(c.name) === normalizedName,
  );
  if (nameMatch) {
    return {
      erpCustomer,
      clientPayload: buildClientPayload(erpCustomer),
      matchStrategy: 'name',
      confidence: 0.8,
    };
  }
  // 3. Phone match
  if (erpCustomer.phone) {
    const phoneMatch = existingClients.find(
      (c) => c.phone && c.phone.replace(/\D/g, '') === erpCustomer.phone!.replace(/\D/g, ''),
    );
    if (phoneMatch) {
      return {
        erpCustomer,
        clientPayload: buildClientPayload(erpCustomer),
        matchStrategy: 'phone',
        confidence: 0.7,
      };
    }
  }
  // 4. No match — new client
  return {
    erpCustomer,
    clientPayload: buildClientPayload(erpCustomer),
    matchStrategy: 'none',
    confidence: 0,
  };
}

function buildClientPayload(c: ERPCustomer): CustomerMapping['clientPayload'] {
  return {
    name: c.name,
    gstin: c.gstin,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    state: c.state,
    stateCode: c.stateCode,
    openingBalance: c.outstandingBalance,
    source: 'erp',
    sourceProvider: c.provider,
    sourceId: c.erpCustomerId,
  };
}

// ─── Vendor → Client (or vendor) mapping ──────────────────────────────────────

export function mapVendorToClient(
  erpVendor: ERPVendor,
  existingClients: Array<{ id: string; name: string; gstin?: string | null }> = [],
): CustomerMapping {
  if (erpVendor.gstin) {
    const m = existingClients.find(
      (c) => c.gstin && c.gstin.toUpperCase() === erpVendor.gstin!.toUpperCase(),
    );
    if (m) return { erpCustomer: vendorAsCustomer(erpVendor), clientPayload: buildVendorPayload(erpVendor), matchStrategy: 'gstin', confidence: 1.0 };
  }
  const nm = normalizeName(erpVendor.name);
  const m2 = existingClients.find((c) => normalizeName(c.name) === nm);
  if (m2) return { erpCustomer: vendorAsCustomer(erpVendor), clientPayload: buildVendorPayload(erpVendor), matchStrategy: 'name', confidence: 0.8 };
  return { erpCustomer: vendorAsCustomer(erpVendor), clientPayload: buildVendorPayload(erpVendor), matchStrategy: 'none', confidence: 0 };
}

function vendorAsCustomer(v: ERPVendor): ERPCustomer {
  return {
    id: v.id, organizationId: v.organizationId, connectionId: v.connectionId,
    provider: v.provider, erpCustomerId: v.erpVendorId, mappedClientId: null,
    name: v.name, gstin: v.gstin, email: v.email, phone: v.phone,
    address: v.address, city: v.city, state: v.state, stateCode: v.stateCode,
    outstandingBalance: 0, totalSales: 0, lastTransactionDate: v.lastTransactionDate,
    active: v.active, raw: v.raw, lastSyncedAt: v.lastSyncedAt, createdAt: v.createdAt, updatedAt: v.updatedAt,
  };
}

function buildVendorPayload(v: ERPVendor): CustomerMapping['clientPayload'] {
  return {
    name: v.name, gstin: v.gstin, email: v.email, phone: v.phone,
    address: v.address, city: v.city, state: v.state, stateCode: v.stateCode,
    openingBalance: -v.outstandingPayable, // negative = payable
    source: 'erp', sourceProvider: v.provider, sourceId: v.erpVendorId,
  };
}

// ─── Invoice mapping ──────────────────────────────────────────────────────────

export function mapInvoice(
  erpInvoice: ERPInvoice,
  existingInvoices: Array<{ id: string; invoiceNumber: string; clientGstin?: string | null }> = [],
): InvoiceMapping {
  // 1. Invoice number match
  const numMatch = existingInvoices.find(
    (i) => i.invoiceNumber.toUpperCase() === erpInvoice.erpInvoiceNumber.toUpperCase(),
  );
  if (numMatch) {
    return { erpInvoice, invoicePayload: buildInvoicePayload(erpInvoice), matchStrategy: 'invoice_number', confidence: 1.0 };
  }
  // 2. Party GSTIN match
  if (erpInvoice.partyGstin) {
    const gstinMatch = existingInvoices.find(
      (i) => i.clientGstin && i.clientGstin.toUpperCase() === erpInvoice.partyGstin!.toUpperCase(),
    );
    if (gstinMatch) {
      return { erpInvoice, invoicePayload: buildInvoicePayload(erpInvoice), matchStrategy: 'party_gstin', confidence: 0.85 };
    }
  }
  return { erpInvoice, invoicePayload: buildInvoicePayload(erpInvoice), matchStrategy: 'none', confidence: 0 };
}

function buildInvoicePayload(inv: ERPInvoice): InvoiceMapping['invoicePayload'] {
  return {
    invoiceNumber: inv.erpInvoiceNumber,
    clientName: inv.partyName,
    clientGstin: inv.partyGstin,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    subtotal: inv.subtotal,
    taxAmount: inv.taxAmount,
    grandTotal: inv.grandTotal,
    balanceDue: inv.balanceDue,
    invoiceType: inv.invoiceType,
    status: inv.status,
    lineItems: inv.lineItems.map((li) => ({
      description: li.description,
      hsn: li.hsn,
      quantity: li.quantity,
      rate: li.rate,
      taxableValue: li.taxableValue,
      igst: li.igst,
      cgst: li.cgst,
      sgst: li.sgst,
      cess: li.cess,
      total: li.total,
    })),
    source: 'erp',
    sourceProvider: inv.provider,
    sourceInvoiceNumber: inv.erpInvoiceNumber,
  };
}

// ─── Ledger mapping ───────────────────────────────────────────────────────────

export function mapLedger(erpLedger: ERPLedger): LedgerMapping {
  return {
    erpLedger,
    ledgerPayload: {
      name: erpLedger.name,
      ledgerType: erpLedger.ledgerType,
      gstin: erpLedger.gstin,
      openingBalance: erpLedger.openingBalance,
      closingBalance: erpLedger.closingBalance,
      asOfDate: erpLedger.asOfDate,
      parentGroup: erpLedger.parentGroup,
      source: 'erp',
      sourceProvider: erpLedger.provider,
    },
  };
}

// ─── Inventory mapping ────────────────────────────────────────────────────────

export function mapInventoryItem(erpItem: ERPInventoryItem): InventoryMapping {
  return {
    erpItem,
    itemPayload: {
      itemCode: erpItem.itemCode,
      name: erpItem.name,
      hsn: erpItem.hsn,
      unit: erpItem.unit,
      quantity: erpItem.quantity,
      stockValue: erpItem.stockValue,
      salePrice: erpItem.salePrice,
      purchasePrice: erpItem.purchasePrice,
      reorderLevel: erpItem.reorderLevel,
      stockStatus: erpItem.stockStatus,
      source: 'erp',
      sourceProvider: erpItem.provider,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|pvt|private|ltd\.|co|company|inc|llp|india)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
