// ═══════════════════════════════════════════════════════════════════════════════
// Module 7 — E-Invoice™
// Generate IRN + QR Code, Cancel IRN, Get IRN Status.
// Oracle: "I've generated your E-Invoice." / "IRN pushed to IRP."
// ═══════════════════════════════════════════════════════════════════════════════

import { nowISO, isValidGstinFormat } from './client';
import type { EInvoiceResult } from './client';

// In-memory IRN store (in production: DB table)
const irnStore = new Map<string, EInvoiceResult>();

export async function generateEInvoice(params: {
  sellerGstin: string;
  buyerGstin: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  hsnCode: string;
}): Promise<EInvoiceResult> {
  if (!isValidGstinFormat(params.sellerGstin)) {
    throw new Error(`Invalid seller GSTIN: "${params.sellerGstin}".`);
  }
  // ── PRODUCTION SAFETY ──
  // IRN, Ack No, signed QR code, and signed invoice are official government
  // artefacts issued ONLY by the IRP (Invoice Registration Portal) operated
  // by GSTN/NIC. Fabricating them locally with Math.random() (as the previous
  // implementation did) would constitute forging legal documents.
  // Until the real IRP API integration is wired up, refuse to generate and
  // surface a clear error so the user knows to connect the GST portal.
  // TODO: Replace with real IRP/NIC API integration when available.
  throw new Error(
    'GSTN API not configured. Set GSTN_API_KEY and connect GST portal to generate IRN through the IRP.'
  );
}

export async function cancelEInvoice(irn: string, reason: string): Promise<EInvoiceResult> {
  const existing = irnStore.get(irn);
  if (!existing) throw new Error(`IRN ${irn} not found.`);
  const updated: EInvoiceResult = {
    ...existing,
    status: 'cancelled',
    cancelledAt: nowISO(),
  };
  irnStore.set(irn, updated);
  return updated;
}

export async function getEInvoiceStatus(irn: string): Promise<EInvoiceResult | null> {
  return irnStore.get(irn) ?? null;
}
