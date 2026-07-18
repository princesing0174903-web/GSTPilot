// ═══════════════════════════════════════════════════════════════════════════════
// Module 4 — GSTR-1™
// Sales register: B2B, B2C, Exports, Amendments, Debit/Credit Notes.
// Prepare draft → Generate JSON → File return.
// Oracle: "I've prepared your GSTR-1 draft." / "I've generated the filing JSON."
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateGstr1Data, isValidGstinFormat, nowISO, getOrCreateGstProfile } from './client';
import type { GSTR1Draft, FilingResult } from './client';

export async function prepareGstr1(gstin: string, period: string): Promise<GSTR1Draft> {
  if (!isValidGstinFormat(gstin)) {
    throw new Error(`Invalid GSTIN format: "${gstin}".`);
  }
  await getOrCreateGstProfile(gstin);
  const data = generateGstr1Data(gstin, period);
  const jsonPayload = JSON.stringify({
    gstin,
    period,
    b2b: Array.from({ length: Math.min(data.b2bInvoices, 3) }, (_, i) => ({
      inum: `B2B-${period}-${1000 + i}`,
      idt: `${period}-0${(i % 9) + 1}-15`,
      val: 85000 + i * 5000,
      txval: 85000 + i * 5000,
      irt: 18,
      iamt: Math.round((85000 + i * 5000) * 0.18),
    })),
    b2cl: Array.from({ length: Math.min(data.b2cInvoices, 2) }, (_, i) => ({
      inum: `B2C-${period}-${2000 + i}`,
      val: 12000 + i * 1000,
      txval: 12000 + i * 1000,
      rt: 18,
    })),
    summary: data,
  });

  const draft: GSTR1Draft = {
    gstin,
    period,
    ...data,
    jsonPayload,
    preparedAt: nowISO(),
  };

  // Persist as draft return
  const existing = await db.gSTReturn.findFirst({ where: { gstin, type: 'GSTR-1', period } });
  if (existing) {
    await db.gSTReturn.update({
      where: { id: existing.id },
      data: {
        status: 'prepared',
        jsonPayload,
        totalTaxableValue: data.totalTaxableValue,
        totalTax: data.totalIGST + data.totalCGST + data.totalSGST + data.totalCess,
        invoiceCount: data.b2bInvoices + data.b2cInvoices + data.exportInvoices,
      },
    });
  } else {
    await db.gSTReturn.create({
      data: {
        gstin,
        type: 'GSTR-1',
        period,
        status: 'prepared',
        jsonPayload,
        totalTaxableValue: data.totalTaxableValue,
        totalTax: data.totalIGST + data.totalCGST + data.totalSGST + data.totalCess,
        invoiceCount: data.b2bInvoices + data.b2cInvoices + data.exportInvoices,
      },
    });
  }

  return draft;
}

export async function getGstr1Draft(gstin: string, period: string) {
  return db.gSTReturn.findFirst({ where: { gstin, type: 'GSTR-1', period } });
}

export async function fileGstr1(gstin: string, period: string): Promise<FilingResult> {
  const draft = await getGstr1Draft(gstin, period);
  if (!draft || draft.status !== 'prepared') {
    throw new Error(`No prepared GSTR-1 draft found for ${gstin} / ${period}. Prepare the draft first.`);
  }
  // ── PRODUCTION SAFETY ──
  // We do NOT fabricate a fake acknowledgment number and mark the return as
  // "filed". Real GSTN filing requires the official GST portal API with a
  // valid OTP / DSC. Until that integration is live, we mark the return as
  // "submitted" (not "filed") so the user knows it still needs to be filed
  // on the GST portal.
  //
  // The previous implementation called genAckNo() (a random string) and
  // marked the return as "filed" — this was a fake government filing.
  await db.gSTReturn.update({
    where: { id: draft.id },
    data: {
      status: 'submitted',
      filedAt: new Date(),
    },
  });
  return {
    gstin,
    returnType: 'GSTR-1',
    period,
    status: 'submitted',
    ackNo: null,
    filedAt: nowISO(),
    message: `GSTR-1 for ${period} has been submitted. Complete the filing on the GST portal using your OTP / DSC. The return will be marked "filed" once the portal returns an acknowledgment number (ARN).`,
  };
}

export async function getGstr1Status(gstin: string, period: string) {
  const record = await db.gSTReturn.findFirst({ where: { gstin, type: 'GSTR-1', period } });
  if (!record) return { gstin, period, status: 'not_started', message: 'No GSTR-1 record found. Prepare a draft first.' };
  return {
    gstin,
    period,
    status: record.status,
    ackNo: record.ackNo,
    filedAt: record.filedAt,
    invoiceCount: record.invoiceCount,
    totalTaxableValue: record.totalTaxableValue,
    totalTax: record.totalTax,
  };
}
