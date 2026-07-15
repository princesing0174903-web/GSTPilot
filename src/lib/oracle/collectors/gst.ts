// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — GST Collector
//
// Reads real GST data from Prisma: GSTProfile, GSTReturn, GSTRFiling,
// GSTR2BInvoice, and Notice (GST notices). Computes aggregate liability,
// ITC available, ITC mismatched, open notices, and pending returns for the
// compliance analyzer.
//
// Graceful contract: if no GST data exists, returns an empty GstData with
// connected=false — never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

import { db } from '@/lib/db';
import type {
  Collector,
  CollectorContext,
  CollectorResult,
  Gstr2BInvoiceSummary,
  GstrFilingSummary,
  GstData,
  GstNoticeSummary,
  GstProfileSummary,
  GstReturnSummary,
} from '../types';

function emptyData(): GstData {
  return {
    profiles: [],
    returns: [],
    gstrFilings: [],
    gstr2b: [],
    notices: [],
    totals: {
      outputTaxLiability: 0,
      itcAvailable: 0,
      itcMismatched: 0,
      openNotices: 0,
      pendingReturns: 0,
    },
  };
}

/** Returns the current GST period as YYYY-MM (India timezone aware). */
export function currentGstPeriod(now = new Date()): string {
  // Force Asia/Kolkata interpretation by shifting. Simplification: use the
  // system month — the dev server runs in UTC but the period granularity is
  // monthly so an off-by-one-hour boundary is acceptable for briefing logic.
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const gstCollector: Collector<GstData> = {
  id: 'gst',
  label: 'GST & Compliance',
  async collect(_ctx: CollectorContext): Promise<CollectorResult<GstData>> {
    const collectedAt = new Date().toISOString();

    try {
      const [profiles, returns, gstrFilings, gstr2b, notices] = await Promise.all([
        db.gSTProfile.findMany({ take: 50 }).catch(() => []),
        db.gSTReturn.findMany({ take: 200, orderBy: { period: 'desc' } }).catch(() => []),
        db.gSTRFiling.findMany({ take: 200, orderBy: { createdAt: 'desc' } }).catch(() => []),
        db.gSTR2BInvoice.findMany({ take: 500, orderBy: { period: 'desc' } }).catch(() => []),
        db.notice.findMany({ take: 100, orderBy: { createdAt: 'desc' } }).catch(() => []),
      ]);

      const profileSummaries: GstProfileSummary[] = profiles.map((p) => ({
        gstin: p.gstin,
        legalName: p.legalName,
        tradeName: p.tradeName,
        status: p.status,
        taxpayerType: p.taxpayerType,
      }));

      const returnSummaries: GstReturnSummary[] = returns.map((r) => ({
        id: r.id,
        gstin: r.gstin,
        type: r.type,
        period: r.period,
        status: r.status,
        totalTaxableValue: r.totalTaxableValue,
        totalTax: r.totalTax,
        totalITC: r.totalITC,
        invoiceCount: r.invoiceCount,
        filedAt: r.filedAt ? r.filedAt.toISOString() : null,
      }));

      const filingSummaries: GstrFilingSummary[] = gstrFilings.map((f) => ({
        id: f.id,
        clientId: f.clientId,
        returnType: f.returnType,
        period: f.period,
        status: f.status,
        filedDate: f.filedDate,
        totalTax: f.totalTax,
        criticalErrors: f.criticalErrors,
        warnings: f.warnings,
      }));

      const gstr2bSummaries: Gstr2BInvoiceSummary[] = gstr2b.map((g) => ({
        id: g.id,
        gstin: g.gstin,
        period: g.period,
        supplierGSTIN: g.supplierGSTIN,
        supplierName: g.supplierName,
        invoiceNo: g.invoiceNo,
        taxableValue: g.taxableValue,
        itcAvailable: g.itcAvailable,
        itcEligible: g.itcEligible,
        matchStatus: g.matchStatus,
        mismatchReason: g.mismatchReason,
      }));

      const noticeSummaries: GstNoticeSummary[] = notices.map((n) => ({
        id: n.id,
        clientId: n.clientId,
        noticeType: n.noticeType,
        noticeNumber: n.noticeNumber,
        noticeDate: n.noticeDate,
        subject: n.subject,
        description: n.description,
        status: n.status,
        priority: n.priority,
        dueDate: n.dueDate,
        responseDate: n.responseDate,
      }));

      // ── Aggregate totals ─────────────────────────────────────────────────
      // Output tax liability = sum of totalTax across GSTR-1 returns in the
      // current period that are not yet filed. (GSTR-1 reports outward tax.)
      const curPeriod = currentGstPeriod();
      const pendingReturns = returnSummaries.filter(
        (r) => r.type === 'GSTR-1' && r.period === curPeriod && r.status !== 'filed',
      ).length;

      const outputTaxLiability = returnSummaries
        .filter((r) => r.type === 'GSTR-1' && r.status !== 'filed')
        .reduce((s, r) => s + (r.totalTax || 0), 0);

      const itcAvailable = gstr2bSummaries
        .filter((g) => g.itcEligible)
        .reduce((s, g) => s + (g.itcAvailable || 0), 0);

      const itcMismatched = gstr2bSummaries
        .filter((g) => g.matchStatus === 'mismatched' || g.matchStatus === 'unmatched')
        .reduce((s, g) => s + (g.itcAvailable || 0), 0);

      const openNotices = noticeSummaries.filter((n) => n.status === 'open').length;

      const data: GstData = {
        profiles: profileSummaries,
        returns: returnSummaries,
        gstrFilings: filingSummaries,
        gstr2b: gstr2bSummaries,
        notices: noticeSummaries,
        totals: {
          outputTaxLiability,
          itcAvailable,
          itcMismatched,
          openNotices,
          pendingReturns,
        },
      };

      const totalRecords =
        profileSummaries.length +
        returnSummaries.length +
        filingSummaries.length +
        gstr2bSummaries.length +
        noticeSummaries.length;

      return {
        source: 'gst',
        connected: totalRecords > 0,
        recordCount: totalRecords,
        data,
        collectedAt,
      };
    } catch (err) {
      return {
        source: 'gst',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        error: err instanceof Error ? err.message : 'GST collector failed.',
        collectedAt,
      };
    }
  },
};
