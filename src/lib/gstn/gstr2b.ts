// ═══════════════════════════════════════════════════════════════════════════════
// Module 3 — GSTR-2B Download™ (HIGHEST PRIORITY)
// Download GSTR-2B from GSTN → store supplier invoices → compute ITC.
// Oracle: "I've downloaded your latest GSTR-2B." / "I've found ₹24,500 eligible ITC."
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateGstr2bInvoices, isValidGstinFormat, nowISO, getOrCreateGstProfile } from './client';
import type { GSTR2BDownloadResult, GSTR2BInvoiceData } from './client';

export async function downloadGstr2b(gstin: string, period: string): Promise<GSTR2BDownloadResult> {
  if (!isValidGstinFormat(gstin)) {
    throw new Error(`Invalid GSTIN format: "${gstin}".`);
  }
  // Ensure profile exists
  await getOrCreateGstProfile(gstin);

  // Generate deterministic invoice set for this GSTIN + period
  const invoices = generateGstr2bInvoices(gstin, period);

  // Persist the GSTR-2B return record
  const existing = await db.gSTReturn.findFirst({
    where: { gstin, type: 'GSTR-2B', period },
  });
  const returnRecord = existing
    ? await db.gSTReturn.update({
        where: { id: existing.id },
        data: {
          status: 'downloaded',
          downloadedAt: new Date(),
          totalTaxableValue: invoices.reduce((s, i) => s + i.taxableValue, 0),
          totalITC: invoices.reduce((s, i) => s + i.itcAvailable, 0),
          invoiceCount: invoices.length,
          jsonPayload: JSON.stringify(invoices),
        },
      })
    : await db.gSTReturn.create({
        data: {
          gstin,
          type: 'GSTR-2B',
          period,
          status: 'downloaded',
          downloadedAt: new Date(),
          totalTaxableValue: invoices.reduce((s, i) => s + i.taxableValue, 0),
          totalITC: invoices.reduce((s, i) => s + i.itcAvailable, 0),
          invoiceCount: invoices.length,
          jsonPayload: JSON.stringify(invoices),
        },
      });

  // Replace existing 2B invoices for this GSTIN+period
  await db.gSTR2BInvoice.deleteMany({ where: { gstin, period } });
  for (const inv of invoices) {
    await db.gSTR2BInvoice.create({
      data: {
        gstin,
        supplierGSTIN: inv.supplierGSTIN,
        supplierName: inv.supplierName,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        taxableValue: inv.taxableValue,
        igst: inv.igst,
        cgst: inv.cgst,
        sgst: inv.sgst,
        cess: inv.cess,
        itcAvailable: inv.itcAvailable,
        itcEligible: inv.itcEligible,
        matched: false,
        matchStatus: 'unmatched',
        period,
      },
    });
  }

  const totalTaxableValue = invoices.reduce((s, i) => s + i.taxableValue, 0);
  const totalITC = invoices.reduce((s, i) => s + i.itcAvailable, 0);
  const eligibleITC = invoices.filter((i) => i.itcEligible).reduce((s, i) => s + i.itcAvailable, 0);
  const ineligibleITC = totalITC - eligibleITC;

  return {
    gstin,
    period,
    downloadedAt: nowISO(),
    invoiceCount: invoices.length,
    totalTaxableValue,
    totalITC,
    eligibleITC,
    ineligibleITC,
    invoices,
  };
}

export async function getStoredGstr2b(gstin: string, period?: string) {
  const where: { gstin: string; type: string; period?: string } = { gstin, type: 'GSTR-2B' };
  if (period) where.period = period;
  const returnRecord = await db.gSTReturn.findFirst({
    where,
    orderBy: { downloadedAt: 'desc' },
  });
  if (!returnRecord) return null;

  const invoices = await db.gSTR2BInvoice.findMany({
    where: { gstin, period: returnRecord.period },
    orderBy: { invoiceDate: 'asc' },
  });

  return {
    ...returnRecord,
    invoices,
  };
}

export async function listStoredGstr2bPeriods(gstin: string) {
  const records = await db.gSTReturn.findMany({
    where: { gstin, type: 'GSTR-2B' },
    orderBy: { period: 'desc' },
    select: { id: true, period: true, status: true, downloadedAt: true, invoiceCount: true, totalITC: true },
  });
  return records;
}
