// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Oracle Daily Briefing (Proactive CFO Engine)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle does NOT wait for prompts. Oracle wakes up with knowledge.
//
// This engine produces the "Daily Briefing" — a proactive summary of what
// Oracle has ALREADY done for the user overnight / since last visit, and what
// needs their approval. It reads the same real Prisma data as the workflow
// engine + business snapshot, but structures it as a CFO would speak:
//
//   "7 invoices paid. I matched 6. 1 still needs review. Approve?"
//   "GST Return due in 3 days. Prepared. Waiting for approval."
//   "Payment from ABC Industries received. Invoice matched. Done."
//   "Vendor GST mismatch detected. I prepared a correction. Approve?"
//
// The briefing has 4 sections:
//   1. headline        — one-sentence summary of today's state
//   2. done            — what Oracle already finished (auto-matched, prepared,
//                        synced, categorized). Each item is a win the user
//                        didn't have to do.
//   3. needsAttention  — what Oracle needs from the user (approvals, reviews).
//                        Each item has a one-click action.
//   4. watchlist       — things Oracle is monitoring (not urgent, but tracked)
//
// No LLM call — deterministic, fully auditable. An LLM can later polish the
// prose, but the structure + counts are fixed so the briefing is always usable.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getWorkflowPipeline } from '@/lib/workflow/engine';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BriefingItemKind = 'done' | 'attention' | 'watch';

export interface BriefingItem {
  id: string;
  kind: BriefingItemKind;
  /** Short headline, CFO-voice. e.g. "I matched 6 of 7 payments" */
  title: string;
  /** Supporting detail. e.g. "₹4,50,000 reconciled overnight" */
  detail: string;
  /** CTA label. e.g. "Approve", "Review", "File now" */
  actionLabel?: string;
  /** View to navigate to when the action is clicked */
  actionView?: string;
  /** Tone: emerald (done), amber (attention), blue (watch) */
  tone: 'emerald' | 'amber' | 'blue';
  /** Optional amount for display */
  amount?: number;
}

export interface OracleDailyBriefing {
  /** ISO timestamp */
  computedAt: string;
  /** One-sentence CFO headline */
  headline: string;
  /** Sub-headline with the 2-3 most important numbers */
  subheadline: string;
  /** Oracle's mood: 'proactive' | 'monitoring' | 'celebrating' | 'concerned' */
  mood: 'proactive' | 'monitoring' | 'celebrating' | 'concerned';
  /** Items Oracle already finished (wins) */
  done: BriefingItem[];
  /** Items needing the user's approval / review */
  needsAttention: BriefingItem[];
  /** Items Oracle is watching (informational) */
  watchlist: BriefingItem[];
  /** Quick stats for the briefing header */
  stats: {
    paymentsMatched: number;
    paymentsPending: number;
    returnsPrepared: number;
    returnsDueSoon: number;
    invoicesIssued: number;
    invoicesOverdue: number;
  };
}

// ─── Cache (60s — briefings don't change every second) ────────────────────────

const cache = new Map<string, { briefing: OracleDailyBriefing; ts: number }>();
const CACHE_TTL_MS = 60_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function abbreviateINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

// ─── Main: assemble the daily briefing ────────────────────────────────────────

export async function getOracleDailyBriefing(
  organizationId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<OracleDailyBriefing> {
  if (!organizationId) {
    return emptyBriefing();
  }

  if (!opts.forceRefresh) {
    const cached = cache.get(organizationId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.briefing;
    }
  }

  // Normalize the org ID for banking queries. BankAccount / BankTransaction /
  // BankReconciliation records are seeded with organizationId = 'local'. When
  // a demo user session creates a local-* org (e.g. local-abc123), we still
  // want them to see the seeded banking data.
  const isLocal = organizationId === 'local' || organizationId.startsWith('local-');
  const bankingOrgId = isLocal ? 'local' : organizationId;

  // Fetch the workflow pipeline (reuses cached data) + targeted queries
  //
  // NOTE (PQA-8-9-10 — remove dashboard duplicates):
  //   We NO LONGER fetch `overdueInvoices` here. The Action Center on the
  //   dashboard already surfaces "N overdue invoices · ₹X past due" as an
  //   actionable item — Oracle repeating the same count + amount in its
  //   briefing was a duplicate. Oracle now focuses on what it DID (matched,
  //   collected, prepared) and what specifically needs ITS sign-off
  //   (unmatched credits, prepared returns awaiting filing, auto-matched
  //   transactions awaiting approval).
  // PERF FIX (Phase 2): We previously ran 4 duplicate Prisma queries here that
  // overlapped with the workflow pipeline. We now:
  //   • Read `reconciledTransactions` from pipeline.doneBreakdown (was an
  //     identical db.bankTransaction.count — pure duplicate).
  //   • Org-scope `recentPaidInvoices` via client.firmId (was un-scoped —
  //     cross-tenant leak + full table scan).
  // `upcomingReturns` (GSTReturn) and `recentCredits` (BankTransaction) cannot
  // be deduped: GSTReturn has no org field in the schema, and recentCredits
  // has a different filter than the pipeline's bankCreditsUnreconciled (we
  // want matched+unmatched credits, pipeline wants only unmatched).
  const [pipeline, recentPaidInvoices, upcomingReturns, recentCredits] =
    await Promise.all([
      getWorkflowPipeline(organizationId, opts),
      // Invoices paid this month (Oracle "collected" these) — org-scoped via client.firmId
      db.invoice.findMany({
        where: { client: { firmId: organizationId }, status: 'paid', invoiceDate: { gte: startOfMonth().toISOString().slice(0, 10) } },
        take: 5,
        orderBy: { invoiceDate: 'desc' },
        select: { id: true, invoiceNumber: true, buyerName: true, totalAmount: true, invoiceDate: true },
      }).catch(() => []),
      // GST returns due soon (not filed) — used to surface "prepared, ready to file"
      db.gSTReturn.findMany({
        where: { status: { in: ['not_started', 'prepared', 'draft'] } },
        take: 5,
        orderBy: { period: 'desc' },
        select: { id: true, type: true, period: true, totalTax: true, status: true },
      }).catch(() => []),
      // Recent bank credits (incoming payments)
      db.bankTransaction.findMany({
        where: { organizationId: bankingOrgId, type: 'credit', status: { in: ['posted', 'pending'] } },
        take: 3,
        orderBy: { date: 'desc' },
        select: { id: true, description: true, counterparty: true, amount: true, date: true, matched: true },
      }).catch(() => []),
    ]);

  // Reconciled transactions this month — read from the pipeline's doneBreakdown
  // (was: db.bankTransaction.count(...) — identical to workflow's reconTxnsCount)
  const recentReconciled = pipeline.doneBreakdown.reconciledTransactions;

  const done: BriefingItem[] = [];
  const needsAttention: BriefingItem[] = [];
  const watchlist: BriefingItem[] = [];

  // ── DONE: payments matched ──
  const matchedCount = recentReconciled;
  const unreconciledCredits = recentCredits.filter((c) => !c.matched).length;
  if (matchedCount > 0) {
    const totalMatched = recentCredits.reduce((sum, c) => c.matched ? sum + c.amount : sum, 0);
    done.push({
      id: 'matched-payments',
      kind: 'done',
      title: `I matched ${matchedCount} payment${matchedCount === 1 ? '' : 's'}`,
      detail: `${abbreviateINR(totalMatched)} reconciled with invoices this month`,
      tone: 'emerald',
      amount: totalMatched,
    });
  }

  // ── ATTENTION: unmatched credits ──
  if (unreconciledCredits > 0) {
    needsAttention.push({
      id: 'review-credits',
      kind: 'attention',
      title: `${unreconciledCredits} payment${unreconciledCredits === 1 ? '' : 's'} need review`,
      detail: 'Incoming bank credits I could not auto-match',
      actionLabel: 'Review',
      actionView: 'banking',
      tone: 'amber',
    });
  }

  // ── DONE: invoices collected ──
  if (recentPaidInvoices.length > 0) {
    const totalCollected = recentPaidInvoices.reduce((s, i) => s + i.totalAmount, 0);
    done.push({
      id: 'collected',
      kind: 'done',
      title: `${recentPaidInvoices.length} invoice${recentPaidInvoices.length === 1 ? '' : 's'} collected`,
      detail: `${abbreviateINR(totalCollected)} received from customers this month`,
      tone: 'emerald',
      amount: totalCollected,
    });
  }

  // ── ATTENTION / DONE: GST returns ──
  // Oracle surfaces returns it has PREPARED (ready to file) — that's Oracle's
  // proactive action. Returns that are merely "not started" are NOT surfaced
  // here anymore: the Action Center already shows the next upcoming/overdue
  // return as an actionable item, so duplicating it as a watchlist entry was
  // redundant. Oracle speaks about what Oracle did, not what the user hasn't
  // done yet.
  const preparedReturns = upcomingReturns.filter((r) => r.status === 'prepared' || r.status === 'draft');

  if (preparedReturns.length > 0) {
    const top = preparedReturns[0];
    needsAttention.push({
      id: 'file-gst',
      kind: 'attention',
      title: `${top.type} prepared — ready to file`,
      detail: `${top.invoiceCount ?? 0} invoices · ${abbreviateINR(top.totalTax)} tax`,
      actionLabel: 'File now',
      actionView: 'returns',
      tone: 'amber',
      amount: top.totalTax,
    });
  }

  // NOTE (PQA-8-9-10): The "overdue-chase" attention item was removed here.
  // The Action Center on the dashboard already surfaces
  // "N overdue invoices · ₹X past due · click to follow up" as an actionable
  // item — Oracle repeating the same count + amount was a duplicate. Oracle
  // now focuses on its OWN proactive actions (matched, collected, prepared)
  // and the specific sign-offs only IT can need (unmatched credits, prepared
  // returns, auto-matched transactions).

  // ── WATCH: unreconciled auto-matches awaiting approval ──
  const pendingReconStage = pipeline.stages.find((s) => s.id === 'auto-match');
  if (pendingReconStage && pendingReconStage.count > 0) {
    needsAttention.push({
      id: 'approve-matches',
      kind: 'attention',
      title: `I auto-matched ${pendingReconStage.count} transaction${pendingReconStage.count === 1 ? '' : 's'}`,
      detail: 'Confidence is high — one click to approve all',
      actionLabel: 'Approve',
      actionView: 'reconcile',
      tone: 'emerald',
    });
  }

  // ── Build headline + mood ──
  const totalDone = done.length;
  const totalAttention = needsAttention.length;
  const paidCount = recentPaidInvoices.length;

  let headline: string;
  let subheadline: string;
  let mood: OracleDailyBriefing['mood'];

  if (totalAttention > 2) {
    mood = 'concerned';
    headline = `${totalAttention} things need your attention`;
    subheadline = `I’ve handled ${totalDone} task${totalDone === 1 ? '' : 's'} already — review the rest when ready.`;
  } else if (totalDone > 2 && totalAttention === 0) {
    mood = 'celebrating';
    headline = `Everything’s on track — I handled ${totalDone} task${totalDone === 1 ? '' : 's'}`;
    subheadline = paidCount > 0
      ? `${paidCount} invoice${paidCount === 1 ? '' : 's'} collected, ${matchedCount} payment${matchedCount === 1 ? '' : 's'} matched.`
      : `${matchedCount} payment${matchedCount === 1 ? '' : 's'} matched this month.`;
  } else if (totalAttention > 0) {
    mood = 'proactive';
    headline = `I’ve done ${totalDone} task${totalDone === 1 ? '' : 's'} — ${totalAttention} need${totalAttention === 1 ? 's' : ''} your sign-off`;
    subheadline = 'Review and approve to keep the workflow moving.';
  } else {
    mood = 'monitoring';
    headline = 'All quiet — I’m monitoring your workflows';
    subheadline = 'I’ll surface actions here as invoices come due, payments arrive, and returns need filing.';
  }

  const briefing: OracleDailyBriefing = {
    computedAt: new Date().toISOString(),
    headline,
    subheadline,
    mood,
    done,
    needsAttention,
    watchlist,
    stats: {
      paymentsMatched: matchedCount,
      paymentsPending: unreconciledCredits,
      returnsPrepared: preparedReturns.length,
      returnsDueSoon: upcomingReturns.length,
      invoicesIssued: pipeline.stages.find((s) => s.id === 'invoice-created')?.count ?? 0,
      // No longer fetched separately (the overdue-chase attention item that
      // used it was removed — Action Center handles overdue invoices now).
      invoicesOverdue: 0,
    },
  };

  cache.set(organizationId, { briefing, ts: Date.now() });
  return briefing;
}

function emptyBriefing(): OracleDailyBriefing {
  return {
    computedAt: new Date().toISOString(),
    headline: 'Welcome — I’m Oracle, your AI CFO',
    subheadline: 'Create your first invoice and I’ll start watching your workflows.',
    mood: 'monitoring',
    done: [],
    needsAttention: [],
    watchlist: [],
    stats: {
      paymentsMatched: 0,
      paymentsPending: 0,
      returnsPrepared: 0,
      returnsDueSoon: 0,
      invoicesIssued: 0,
      invoicesOverdue: 0,
    },
  };
}
