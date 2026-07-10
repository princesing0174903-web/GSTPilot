// ═══════════════════════════════════════════════════════════════════════════════
// Module 7 — E-Invoice™
// Generate IRN + QR Code, Cancel IRN, Get IRN Status.
// Oracle: "I've generated your E-Invoice." / "IRN pushed to IRP."
// ═══════════════════════════════════════════════════════════════════════════════

import { genIRN, genAckNo, nowISO, isValidGstinFormat } from './client';
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
  const irn = genIRN();
  const ackNo = genAckNo();
  // Generate a simulated QR code (base64 placeholder)
  const qrData = JSON.stringify({
    irn,
    sellerGstin: params.sellerGstin,
    buyerGstin: params.buyerGstin,
    invoiceNo: params.invoiceNo,
    invoiceValue: params.invoiceValue,
  });
  const qrCode = Buffer.from(qrData).toString('base64').slice(0, 200);

  const result: EInvoiceResult = {
    irn,
    qrCode,
    ackNo,
    ackDate: nowISO(),
    signedInvoice: Buffer.from(JSON.stringify(params)).toString('base64'),
    status: 'generated',
  };
  irnStore.set(irn, result);
  return result;
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
