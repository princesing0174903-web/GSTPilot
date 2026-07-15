// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Compliance Analyzer
//
// Inspects GST returns, ITC position, and notices to detect compliance risks
// (pending returns, ITC mismatches, open notices) and opportunities (ITC
// available to claim).
// ═══════════════════════════════════════════════════════════════════════════════

import type { Analyzer, AnalyzerResult, Signal } from '../types';
import { getDataset } from '../types';
import type { GstData } from '../types';
import { currentGstPeriod } from '../collectors/gst';

/** Days until the 20th of next month (GSTR-3B due date). */
function daysUntilGstr3bDue(now = new Date()): number {
  const due = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  return Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** Days until the 11th of next month (GSTR-1 due date). */
function daysUntilGstr1Due(now = new Date()): number {
  const due = new Date(now.getFullYear(), now.getMonth() + 1, 11);
  return Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export const complianceAnalyzer: Analyzer = {
  id: 'compliance',
  label: 'GST Compliance',
  analyze(dataset): AnalyzerResult {
    const signals: Signal[] = [];
    const metrics: Record<string, number> = {};

    const gst = getDataset<GstData>(dataset, 'gst');

    const pendingReturns = gst?.totals.pendingReturns ?? 0;
    const openNotices = gst?.totals.openNotices ?? 0;
    const itcMismatched = gst?.totals.itcMismatched ?? 0;
    const itcAvailable = gst?.totals.itcAvailable ?? 0;
    const outputTaxLiability = gst?.totals.outputTaxLiability ?? 0;

    metrics.pendingReturns = pendingReturns;
    metrics.openNotices = openNotices;
    metrics.itcMismatched = itcMismatched;
    metrics.itcAvailable = itcAvailable;
    metrics.outputTaxLiability = outputTaxLiability;
    metrics.gstr1DueInDays = daysUntilGstr1Due();
    metrics.gstr3bDueInDays = daysUntilGstr3bDue();

    if (!gst) {
      return { analyzer: 'compliance', signals, metrics };
    }

    const curPeriod = currentGstPeriod();

    // ── Problem: pending GSTR-1 for current period ──────────────────────────
    if (pendingReturns > 0) {
      const daysToGstr1 = daysUntilGstr1Due();
      const severity = daysToGstr1 <= 3 ? 'critical' : daysToGstr1 <= 7 ? 'high' : 'medium';
      signals.push({
        id: 'compliance:pending-gstr1',
        kind: 'problem',
        category: 'compliance',
        severity,
        title: `GSTR-1 for ${curPeriod} is not yet filed`,
        description: `GSTR-1 for the current period (${curPeriod}) is pending. Filing after the 11th attracts a late fee of ₹50/day (₹20/day for nil returns), capped at ₹10,000.`,
        recommendation: 'Prepare and file GSTR-1 before the 11th to avoid late fees and ITC blocking for buyers.',
        monetaryValue: Math.min(outputTaxLiability, 10000),
        dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 11).toISOString(),
        confidence: 0.95,
        evidence: [{ source: 'gst', reference: `GSTReturn period=${curPeriod}` }],
        analyzer: 'compliance',
        tags: { daysToDue: daysToGstr1 },
      });
    }

    // ── Problem: open GST notices ───────────────────────────────────────────
    if (openNotices > 0) {
      const urgentNotices = gst.notices.filter(
        (n) => n.status === 'open' && n.dueDate && Date.parse(n.dueDate) <= Date.now() + 7 * 24 * 60 * 60 * 1000,
      );
      const severity = urgentNotices.length > 0 ? 'critical' : 'high';
      signals.push({
        id: 'compliance:open-notices',
        kind: 'problem',
        category: 'notice',
        severity,
        title: `${openNotices} GST notice${openNotices === 1 ? '' : 's'} require${openNotices === 1 ? 's' : ''} response`,
        description: `There ${openNotices === 1 ? 'is' : 'are'} ${openNotices} open GST notice${openNotices === 1 ? '' : 's'}. ${urgentNotices.length > 0 ? `${urgentNotices.length} ${urgentNotices.length === 1 ? 'is' : 'are'} due within 7 days.` : 'Respond promptly to avoid escalation to adjudication.'}`,
        recommendation: 'Review each notice and file a response before the due date. Engage a CA if any notice is a SCN (Show Cause Notice).',
        monetaryValue: 0,
        dueDate: urgentNotices[0]?.dueDate ?? null,
        confidence: 0.9,
        evidence: gst.notices
          .filter((n) => n.status === 'open')
          .slice(0, 3)
          .map((n) => ({
            source: 'gst',
            reference: n.noticeNumber ? `Notice ${n.noticeNumber}` : n.subject,
          })),
        analyzer: 'compliance',
        tags: { urgentCount: urgentNotices.length },
      });
    }

    // ── Problem: ITC mismatches with GSTR-2B ────────────────────────────────
    if (itcMismatched > 0) {
      signals.push({
        id: 'compliance:itc-mismatch',
        kind: 'problem',
        category: 'itc',
        severity: 'high',
        title: 'Input Tax Credit mismatched with GSTR-2B',
        description: `₹${itcMismatched.toLocaleString('en-IN')} of ITC is unmatched or mismatched against GSTR-2B. Claiming unmatched ITC risks reversal with 18% interest under Section 50.`,
        recommendation: 'Reconcile the purchase register with GSTR-2B and follow up with suppliers whose invoices are not reflected.',
        monetaryValue: itcMismatched,
        dueDate: null,
        confidence: 0.85,
        evidence: gst.gstr2b
          .filter((g) => g.matchStatus === 'mismatched' || g.matchStatus === 'unmatched')
          .slice(0, 3)
          .map((g) => ({
            source: 'gst',
            reference: `2B ${g.period} ${g.supplierGSTIN} ${g.invoiceNo}`,
          })),
        analyzer: 'compliance',
      });
    }

    // ── Opportunity: ITC available to claim ─────────────────────────────────
    if (itcAvailable > 0) {
      signals.push({
        id: 'compliance:itc-available',
        kind: 'opportunity',
        category: 'itc',
        severity: 'medium',
        title: 'Input Tax Credit available to claim',
        description: `₹${itcAvailable.toLocaleString('en-IN')} of ITC is eligible to be claimed in GSTR-3B. Ensure it is claimed within the Section 16(4) time limit (30th November of the following financial year).`,
        recommendation: 'Verify the matched invoices are reflected in GSTR-2B and claim the ITC in the current period GSTR-3B.',
        monetaryValue: itcAvailable,
        dueDate: null,
        confidence: 0.8,
        evidence: [{ source: 'gst', reference: 'GSTR-2B matched invoices' }],
        analyzer: 'compliance',
      });
    }

    // ── Problem: output tax liability unfiled ───────────────────────────────
    if (outputTaxLiability > 0 && pendingReturns === 0) {
      // No pending GSTR-1 but there is unfiled output tax — check GSTR-3B
      const gstr3bPending = gst.returns.filter(
        (r) => r.type === 'GSTR-3B' && r.period === curPeriod && r.status !== 'filed',
      );
      if (gstr3bPending.length > 0) {
        const daysToGstr3b = daysUntilGstr3bDue();
        const severity = daysToGstr3b <= 3 ? 'critical' : daysToGstr3b <= 7 ? 'high' : 'medium';
        signals.push({
          id: 'compliance:pending-gstr3b',
          kind: 'problem',
          category: 'compliance',
          severity,
          title: `GSTR-3B for ${curPeriod} is not yet filed`,
          description: `GSTR-3B for ${curPeriod} is pending with an output tax liability of ₹${outputTaxLiability.toLocaleString('en-IN')}. Late filing attracts 18% interest under Section 50 plus late fees.`,
          recommendation: 'File GSTR-3B before the 20th to avoid interest and late-fee exposure.',
          monetaryValue: outputTaxLiability,
          dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 20).toISOString(),
          confidence: 0.9,
          evidence: gstr3bPending.slice(0, 2).map((r) => ({
            source: 'gst',
            reference: `GSTReturn ${r.type} ${r.period}`,
          })),
          analyzer: 'compliance',
          tags: { daysToDue: daysToGstr3b },
        });
      }
    }

    return { analyzer: 'compliance', signals, metrics };
  },
};
