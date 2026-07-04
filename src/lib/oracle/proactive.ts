// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Proactive Insights Engine (Daily Briefing)
//
// Computes "Today's Briefing" — a single, executive-grade summary that tells the
// user what matters *right now*: overdue returns, available ITC, collection risks,
// revenue opportunities, today's priorities, the overall business health score,
// and an estimated cash runway in days.
//
// Design principles:
//   • Authoritative — derived from the same `loadOracleLiveData()` payload Oracle
//     itself uses, so the briefing always matches what the chatbot will say.
//   • Resilient — every DB call is wrapped in try/catch and degrades to sensible
//     empty defaults. The endpoint NEVER returns a 500; at worst it returns a
//     `degraded: true` briefing.
//   • Decision-ready — every section ends with concrete, prioritized actions.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { loadOracleLiveData } from '@/lib/connections';
import type { OracleLiveData } from '@/lib/connections/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyBriefing {
  overdueReturns: {
    count: number;
    items: { period: string; type: string; dueDate?: string }[];
  };
  availableItc: { amount: number; note?: string };
  collectionRisks: {
    count: number;
    clients: { name: string; reason: string; amount: number }[];
  };
  revenueOpportunities: {
    growthPct: number;
    signals: { text: string; tone: 'positive' | 'warning' | 'negative' | 'neutral' }[];
  };
  todaysPriorities: {
    text: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }[];
  healthScore: number | null;
  cashRunwayDays: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBriefing(): DailyBriefing {
  return {
    overdueReturns: { count: 0, items: [] },
    availableItc: { amount: 0 },
    collectionRisks: { count: 0, clients: [] },
    revenueOpportunities: { growthPct: 0, signals: [] },
    todaysPriorities: [],
    healthScore: null,
    cashRunwayDays: null,
  };
}

// ─── DB fetchers (each isolated — never throws) ───────────────────────────────

async function fetchOverdueReturns(
  liveData: OracleLiveData,
): Promise<{ count: number; items: { period: string; type: string; dueDate?: string }[] }> {
  const count = liveData.compliance?.overdueReturns ?? 0;
  let items: { period: string; type: string; dueDate?: string }[] = [];
  try {
    const rows = await db.gSTRFiling.findMany({
      where: { status: 'overdue' },
      take: 10,
      orderBy: { period: 'desc' },
    });
    items = rows.map((r) => ({
      period: r.period,
      type: r.returnType,
      dueDate: r.filedDate ?? undefined,
    }));
  } catch {
    /* keep items = [] */
  }
  return { count, items };
}

async function fetchPendingReturnsCount(liveData: OracleLiveData): Promise<number> {
  // Use the live-data summary first (no DB round-trip); fall back to a count.
  const fromLive = liveData.compliance?.pendingReturns ?? 0;
  if (fromLive > 0) return fromLive;
  try {
    return await db.gSTRFiling.count({ where: { status: 'pending' } });
  } catch {
    return 0;
  }
}

async function fetchActiveNoticesCount(liveData: OracleLiveData): Promise<number> {
  const fromLive = liveData.compliance?.activeNotices ?? 0;
  if (fromLive > 0) return fromLive;
  try {
    return await db.notice.count({ where: { status: 'open' } });
  } catch {
    return 0;
  }
}

// ─── Main entry: computeDailyBriefing ─────────────────────────────────────────

export async function computeDailyBriefing(): Promise<DailyBriefing> {
  const briefing = emptyBriefing();

  // Load live data first — never throws (the orchestrator handles its own errors).
  let liveData: OracleLiveData;
  try {
    liveData = await loadOracleLiveData();
  } catch {
    // Catastrophic — return a fully-empty briefing. The endpoint will mark it
    // `degraded: true` if computeDailyBriefing itself throws upstream.
    return briefing;
  }

  // ── Overdue returns (DB-backed list + live count) ──
  try {
    briefing.overdueReturns = await fetchOverdueReturns(liveData);
  } catch {
    /* keep defaults */
  }

  // ── Available ITC ──
  try {
    const itc = liveData.compliance?.itcAvailable ?? 0;
    briefing.availableItc = {
      amount: itc,
      note:
        itc > 0
          ? 'Claimable ITC per latest GSTR-2B. Ensure invoices are reflected before the November deadline.'
          : undefined,
    };
  } catch {
    /* keep defaults */
  }

  // ── Collection risks (from risky-clients engine) ──
  try {
    const risky = (liveData.riskyClients ?? []).slice(0, 5);
    briefing.collectionRisks = {
      count: risky.length,
      clients: risky.map((r) => ({
        name: r.name,
        reason: r.reason,
        amount: r.amount,
      })),
    };
  } catch {
    /* keep defaults */
  }

  // ── Revenue opportunities (signals + growth) ──
  try {
    const signals = (liveData.health?.signals ?? []).slice(0, 4).map((s) => ({
      text: s.text,
      tone: s.tone,
    }));
    // Use the actual revenue-growth percentage from components (not the 0–100
    // sub-score) so `growthPct` is a real percentage. Fall back to the growth
    // sub-score, then 0.
    const growthPct =
      liveData.health?.components?.revenueGrowthPct ??
      liveData.health?.growth ??
      0;
    briefing.revenueOpportunities = { growthPct: Math.round(growthPct), signals };
  } catch {
    /* keep defaults */
  }

  // ── Health score ──
  briefing.healthScore = liveData.health?.overall ?? null;

  // ── Cash runway (days) ──
  try {
    if (liveData.hasBank && liveData.bank) {
      const cash = liveData.bank.cashAvailable ?? 0;
      const monthlyExpenses = liveData.bank.monthlyExpenses ?? 0;
      // Avoid divide-by-zero with max(1, …); convert months→days.
      const days = Math.round((cash / Math.max(1, monthlyExpenses)) * 30);
      briefing.cashRunwayDays = Math.max(0, Math.min(365, days));
    }
  } catch {
    /* keep null */
  }

  // ── Today's priorities — built from the live numbers above ──
  try {
    const priorities: DailyBriefing['todaysPriorities'] = [];

    // HIGH — overdue returns
    if (briefing.overdueReturns.count > 0) {
      priorities.push({
        text: `File ${briefing.overdueReturns.count} overdue GSTR return${
          briefing.overdueReturns.count > 1 ? 's' : ''
        } immediately — penalties accrue ₹50/day.`,
        priority: 'high',
        category: 'compliance',
      });
    }

    // HIGH — active notices
    const activeNotices = await fetchActiveNoticesCount(liveData);
    if (activeNotices > 0) {
      priorities.push({
        text: `Respond to ${activeNotices} active GST notice${
          activeNotices > 1 ? 's' : ''
        } before the due date.`,
        priority: 'high',
        category: 'notices',
      });
    }

    // HIGH — risky clients
    if (briefing.collectionRisks.count > 0) {
      const top = briefing.collectionRisks.clients[0];
      priorities.push({
        text: `Follow up with ${top.name} — ${top.reason.toLowerCase()} (₹${top.amount.toLocaleString(
          'en-IN',
        )} at stake).`,
        priority: 'high',
        category: 'collections',
      });
    }

    // MEDIUM — pending returns
    const pending = await fetchPendingReturnsCount(liveData);
    if (pending > 0) {
      priorities.push({
        text: `Prepare ${pending} pending return${pending > 1 ? 's' : ''} before they become overdue.`,
        priority: 'medium',
        category: 'compliance',
      });
    }

    // MEDIUM — ITC reconciliation
    if (briefing.availableItc.amount > 0) {
      priorities.push({
        text: `Reconcile ITC (₹${briefing.availableItc.amount.toLocaleString(
          'en-IN',
        )} available) against purchase register to avoid blocked credit.`,
        priority: 'medium',
        category: 'itc',
      });
    }

    // LOW — expense review
    if (liveData.bank && liveData.bank.expenseChangePct > 5) {
      priorities.push({
        text: `Review expenses — they rose ${Math.round(
          liveData.bank.expenseChangePct,
        )}% month-on-month.`,
        priority: 'low',
        category: 'cashflow',
      });
    } else if (liveData.bank) {
      priorities.push({
        text: 'Review this month\'s expense breakdown for any leakages.',
        priority: 'low',
        category: 'cashflow',
      });
    }

    // LOW — forecast review
    priorities.push({
      text: 'Review the revenue forecast and update targets for the next 30 days.',
      priority: 'low',
      category: 'planning',
    });

    briefing.todaysPriorities = priorities;
  } catch {
    /* keep priorities = [] */
  }

  return briefing;
}
