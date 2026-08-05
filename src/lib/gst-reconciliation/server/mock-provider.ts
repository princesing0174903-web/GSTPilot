// ═══════════════════════════════════════════════════════════════════════════════
// MockGSPProvider — Deterministic simulated GSTR-2B data
// ═══════════════════════════════════════════════════════════════════════════════
//
// The default GSP provider. Returns deterministic GSTR-2B records that mirror
// the org's purchase invoices with controlled variations (so the reconciliation
// engine has realistic mismatches to classify). Used in sandbox/preview mode.
//
// Production providers (MastersIndia, Clarity, ClearTax) implement the same
// IGSPProvider interface and are registered in registry.ts.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGSPProvider, GSPSession, GSTR2BFetchResult, GSTR2BRecord, GSPConnectionTest } from '../types';

/**
 * A deterministic mock GSTR-2B record generator.
 * Given a GSTIN + period, produces a stable set of records that mirror real
 * supplier invoices with realistic variation (some perfect matches, some
 * value mismatches, some date mismatches, some missing, some duplicates).
 */
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Convert to 0-1 range
  return ((h >>> 0) % 10000) / 10000;
}

const SAMPLE_SUPPLIERS = [
  { gstin: '27AAACR5058K1Z5', name: 'Reliance Retail Ltd' },
  { gstin: '29AABCB2894G1ZJ', name: 'TCS Limited' },
  { gstin: '33AAACT2727Q1ZW', name: 'Tata Motors Ltd' },
  { gstin: '07AAACI1681G1Z9', name: 'IBM India Pvt Ltd' },
  { gstin: '06AABCB2894G1Z3', name: 'Wipro Enterprises' },
  { gstin: '24AABCI3209K1Z7', name: 'Adani Power Ltd' },
];

const SAMPLE_INVOICE_NUMBERS = [
  'INV-2026-001', 'INV-2026-002', 'INV-2026-003', 'INV-2026-004',
  'INV-2026-005', 'INV-2026-006', 'INV-2026-007', 'INV-2026-008',
  'BILL-7891', 'BILL-7892', 'BILL-7893',
];

export class MockGSPProvider implements IGSPProvider {
  readonly key = 'mock';
  readonly displayName = 'Mock GSP (Sandbox)';

  async testConnection(): Promise<GSPConnectionTest> {
    return {
      ok: true,
      provider: this.key,
      message: 'Mock GSP is always available in sandbox mode.',
      latencyMs: Math.floor(seededRandom('latency') * 50) + 5,
    };
  }

  async authenticate(config: { clientId?: string; apikey?: string }): Promise<GSPSession> {
    return {
      accessToken: `mock-token-${Date.now()}`,
      clientId: config.clientId || 'mock-client',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      metadata: { provider: this.key, mode: 'sandbox' },
    };
  }

  async fetchGSTR2B(
    _session: GSPSession,
    gstin: string,
    period: string,
  ): Promise<GSTR2BFetchResult> {
    // Generate deterministic records based on gstin + period
    const records: GSTR2BRecord[] = [];
    const seedBase = `${gstin}-${period}`;

    // 8-12 records per period
    const count = 8 + Math.floor(seededRandom(seedBase + '-count') * 5);

    for (let i = 0; i < count; i++) {
      const supplier = SAMPLE_SUPPLIERS[i % SAMPLE_SUPPLIERS.length];
      const invoiceNo = SAMPLE_INVOICE_NUMBERS[i % SAMPLE_INVOICE_NUMBERS.length];
      const r1 = seededRandom(`${seedBase}-${i}-taxable`);
      const r2 = seededRandom(`${seedBase}-${i}-igst`);
      const taxable = Math.round((10000 + r1 * 200000) * 100) / 100;
      const isInterState = r2 > 0.5;
      const taxRate = isInterState ? 0.18 : 0.18;
      const tax = Math.round(taxable * taxRate * 100) / 100;

      records.push({
        supplierGSTIN: supplier.gstin,
        supplierName: supplier.name,
        invoiceNo,
        invoiceDate: `${period}-1${i % 9}`, // YYYY-MM-1X
        taxableValue: taxable,
        igst: isInterState ? tax : 0,
        cgst: isInterState ? 0 : tax / 2,
        sgst: isInterState ? 0 : tax / 2,
        cess: 0,
        itcAvailable: tax,
        itcEligible: true,
        docType: 'invoice',
        uploadStatus: 'Uploaded',
      });
    }

    // Add a deliberate duplicate (same invoice number, same supplier) to exercise
    // the duplicate-detection classification.
    if (records.length > 0) {
      records.push({ ...records[0] });
    }

    return {
      gstin,
      period,
      records,
      totalRecords: records.length,
      generatedAt: new Date().toISOString(),
      isLive: false,
      metadata: { provider: this.key, mockVariations: true },
    };
  }
}
