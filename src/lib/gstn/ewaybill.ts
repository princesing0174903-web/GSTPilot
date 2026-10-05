// ═══════════════════════════════════════════════════════════════════════════════
// Module 8 — E-Way Bill™
// Generate, Update, Extend, Cancel, Track.
// Oracle: "I've generated your E-Way Bill."
// ═══════════════════════════════════════════════════════════════════════════════

import { isValidGstinFormat } from './client';
import type { EWayBillResult } from './client';

const ewbStore = new Map<string, EWayBillResult>();

export async function generateEWayBill(params: {
  supplierGstin: string;
  recipientGstin: string;
  documentNo: string;
  documentDate: string;
  transactionType: 'regular' | 'bill_from' | 'bill_to' | 'combined';
  supplyType: 'intra' | 'inter';
  subSupplyType: string;
  fromState: string;
  toState: string;
  totalValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  transporterId?: string;
  vehicleNo?: string;
  distanceKm: number;
}): Promise<EWayBillResult> {
  if (!isValidGstinFormat(params.supplierGstin)) {
    throw new Error(`Invalid supplier GSTIN: "${params.supplierGstin}".`);
  }
  // ── PRODUCTION SAFETY ──
  // The E-Way Bill number (EWB No) and consignment ID are official government
  // identifiers issued ONLY by the NIC E-Way Bill portal. Fabricating them
  // locally with Math.random() (as the previous implementation did) would
  // constitute forging a legal transport document.
  // Until the real NIC EWB API integration is wired up, refuse to generate
  // and surface a clear error so the user knows to connect the GST portal.
  // TODO: Replace with real NIC EWB API integration when available.
  throw new Error(
    'GSTN API not configured. Set GSTN_API_KEY and connect GST portal to generate E-Way Bills through the NIC EWB portal.'
  );
}

export async function extendEWayBill(ewbNo: string, extraDays: number, reason: string): Promise<EWayBillResult> {
  const existing = ewbStore.get(ewbNo);
  if (!existing) throw new Error(`E-Way Bill ${ewbNo} not found.`);
  const newValidUpto = new Date(new Date(existing.validUpto).getTime() + extraDays * 86400000).toISOString();
  const updated: EWayBillResult = { ...existing, validUpto: newValidUpto, status: 'extended' };
  ewbStore.set(ewbNo, updated);
  return updated;
}

export async function cancelEWayBill(ewbNo: string, reason: string): Promise<EWayBillResult> {
  const existing = ewbStore.get(ewbNo);
  if (!existing) throw new Error(`E-Way Bill ${ewbNo} not found.`);
  const updated: EWayBillResult = { ...existing, status: 'cancelled' };
  ewbStore.set(ewbNo, updated);
  return updated;
}

export async function getEWayBillStatus(ewbNo: string): Promise<EWayBillResult | null> {
  const existing = ewbStore.get(ewbNo);
  if (!existing) return null;
  // Check expiry
  if (existing.status === 'generated' || existing.status === 'extended') {
    if (new Date(existing.validUpto).getTime() < Date.now()) {
      const updated = { ...existing, status: 'expired' as const };
      ewbStore.set(ewbNo, updated);
      return updated;
    }
  }
  return existing;
}
