// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Business Context Loader (Real Data Layer)
//
// Auto-loads live business data into a structured `BusinessContext` object.
// This is the SINGLE source of truth for "what does Oracle know about this
// business right now." Every CFO answer cites this context.
//
// Performance: 30-second in-memory cache per organization. Cache invalidates
// on org switch. Target load time: <200ms (cache hit) / <800ms (cache miss).
//
// Honesty: if a data source is empty (no invoices, no bank accounts, etc.),
// the `dataAvailability` field records this so Oracle can say "you haven't
// connected any bank accounts yet" instead of fabricating numbers.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import type { BusinessContext } from './types';

// ─── In-memory cache (per-org, 30s TTL) ──────────────────────────────────────

interface CacheEntry {
  context: BusinessContext;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const cache = new Map<string, CacheEntry>();

export function invalidateBusinessContextCache(organizationId?: string): void {
  if (organizationId) {
    cache.delete(organizationId);
  } else {
    cache.clear();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inrSum(values: Array<{ amount?: number | null }>): number {
  return values.reduce((sum, v) => sum + (typeof v.amount === 'number' ? v.amount : 0), 0);
}

function currentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // Indian FY: April 1 → March 31. So if month >= 4 (April), FY is year-(year+1).
  // Otherwise FY is (year-1)-year.
  if (month >= 4) {
    return `FY${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY${year - 1}-${String(year).slice(-2)}`;
}

function currentGstPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${month}-${now.getFullYear()}`;
}

function daysFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isOverdue(dateStr: string | null | undefined): boolean {
  const days = daysFromNow(dateStr);
  return days !== null && days < 0;
}

function classifyDataAvailability(ctx: {
  hasInvoices: boolean;
  hasPayments: boolean;
  hasBankAccounts: boolean;
  hasGstReturns: boolean;
  hasClients: boolean;
  hasExpenses: boolean;
}): BusinessContext['dataAvailability']['overall'] {
  const flags = [
    ctx.hasInvoices,
    ctx.hasPayments,
    ctx.hasBankAccounts,
    ctx.hasGstReturns,
    ctx.hasClients,
    ctx.hasExpenses,
  ];
  const trueCount = flags.filter(Boolean).length;
  if (trueCount === 0) return 'empty';
  if (trueCount <= 2) return 'sparse';
  if (trueCount <= 4) return 'partial';
  return 'complete';
}

// ─── Prisma loaders (with graceful fallback) ─────────────────────────────────

async function safePrisma<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

// ─── Main loader ─────────────────────────────────────────────────────────────

/**
 * Load the full business context for an organization.
 *
 * Reads from BOTH:
 *   - Prisma (Invoice, Payment, Expense, Client models — the relational store)
 *   - Firestore via adminDb (bank_accounts, gst_returns, tasks, activities —
 *     the document store)
 *
 * This dual-source pattern is intentional: financial transactions live in
 * Prisma (ACID guarantees for money), while operational records live in
 * Firestore (real-time sync, flexible schema).
 */
export async function loadBusinessContext(
  organizationId: string,
  organizationName: string = 'Your Organization',
): Promise<BusinessContext> {
  // Cache check
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  const start = Date.now();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ── Prisma queries (run in parallel) ──
  const [
    clients,
    invoices,
    payments,
    expenses,
  ] = await Promise.all([
    safePrisma(
      db.client.findMany({ where: { organizationId }, select: { id: true, status: true, name: true } }),
      [],
    ),
    safePrisma(
      db.invoice.findMany({
        where: { organizationId },
        select: {
          id: true, invoiceNumber: true, status: true, totalAmount: true,
          invoiceDate: true, dueDate: true, clientId: true, organizationId: true,
        },
        orderBy: { invoiceDate: 'desc' },
        take: 500,
      }),
      [],
    ),
    safePrisma(
      db.payment.findMany({
        where: { organizationId, paymentDate: { gte: ninetyDaysAgo } },
        select: { id: true, amount: true, partyType: true, status: true, paymentDate: true },
        orderBy: { paymentDate: 'desc' },
        take: 500,
      }),
      [],
    ),
    safePrisma(
      db.expense.findMany({
        where: { organizationId, date: { gte: ninetyDaysAgo } },
        select: { id: true, amount: true, date: true },
        orderBy: { date: 'desc' },
        take: 500,
      }),
      [],
    ),
  ]);

  // ── Firestore queries (run in parallel) ──
  const [bankAccountsSnap, gstReturnsSnap, tasksSnap, activitiesSnap] = await Promise.all([
    safeFirestore('bank_accounts', organizationId),
    safeFirestore('gst_returns', organizationId),
    safeFirestore('tasks', organizationId),
    safeFirestore('activities', organizationId),
  ]);

  const bankAccounts = bankAccountsSnap;
  const gstReturns = gstReturnsSnap;
  const tasks = tasksSnap;
  const recentActivities = activitiesSnap.slice(0, 10);

  // ── Aggregate invoices ──
  const invoiceStats = {
    total: invoices.length,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    totalOutstanding: 0,
    totalOverdue: 0,
  };
  for (const inv of invoices) {
    const status = (inv.status ?? '').toLowerCase();
    const amount = typeof inv.totalAmount === 'number' ? inv.totalAmount : 0;
    if (status === 'draft') invoiceStats.draft++;
    else if (status === 'sent' || status === 'unpaid') invoiceStats.sent++;
    else if (status === 'paid') invoiceStats.paid++;
    if (status !== 'paid' && status !== 'cancelled') {
      invoiceStats.totalOutstanding += amount;
      if (isOverdue(inv.dueDate?.toString() ?? null)) {
        invoiceStats.overdue++;
        invoiceStats.totalOverdue += amount;
      }
    }
  }

  // ── Aggregate payments ──
  const paymentStats = {
    total: payments.length,
    received: 0,
    paid: 0,
    pending: 0,
  };
  for (const p of payments) {
    const amount = typeof p.amount === 'number' ? p.amount : 0;
    const status = (p.status ?? '').toLowerCase();
    const partyType = (p.partyType ?? '').toLowerCase();
    if (status === 'pending') paymentStats.pending += amount;
    else if (partyType === 'customer' || partyType === 'incoming') paymentStats.received += amount;
    else if (partyType === 'vendor' || partyType === 'outgoing') paymentStats.paid += amount;
  }

  // ── Aggregate expenses ──
  const expenseStats = {
    total: expenses.length,
    totalAmount: inrSum(expenses),
  };

  // ── Aggregate GST returns ──
  const gstStats = {
    total: gstReturns.length,
    filed: 0,
    draft: 0,
    overdue: 0,
    nextDueDate: null as string | null,
  };
  const upcomingDeadlines: BusinessContext['compliance']['upcomingDeadlines'] = [];
  for (const r of gstReturns) {
    const status = (r.status ?? '').toLowerCase();
    if (status === 'filed') gstStats.filed++;
    else if (status === 'draft') gstStats.draft++;
    const dueDate = r.dueDate ?? null;
    if (status !== 'filed' && dueDate) {
      const days = daysFromNow(dueDate);
      if (days !== null && days >= -30 && days <= 60) {
        if (days < 0) gstStats.overdue++;
        if (gstStats.nextDueDate === null || new Date(dueDate) < new Date(gstStats.nextDueDate)) {
          gstStats.nextDueDate = dueDate;
        }
        upcomingDeadlines.push({
          title: `${r.returnType ?? 'GST Return'} (${r.period ?? 'current period'})`,
          dueDate,
          daysLeft: days,
        });
      }
    }
  }
  upcomingDeadlines.sort((a, b) => a.daysLeft - b.daysLeft);

  // ── Aggregate bank accounts ──
  const bankStats = {
    total: bankAccounts.length,
    connected: 0,
    totalBalance: 0,
  };
  for (const a of bankAccounts) {
    if ((a.status ?? '').toLowerCase() === 'connected' || a.isConnected === true) {
      bankStats.connected++;
      bankStats.totalBalance += typeof a.currentBalance === 'number' ? a.currentBalance : 0;
    }
  }

  // ── Aggregate tasks ──
  const taskStats = { total: tasks.length, open: 0, overdue: 0 };
  for (const t of tasks) {
    const status = (t.status ?? '').toLowerCase();
    if (status === 'open' || status === 'in-progress' || status === 'pending') taskStats.open++;
    if (isOverdue(t.dueDate ?? null)) taskStats.overdue++;
  }

  // ── Compliance score (weighted blend) ──
  let complianceScore = 100;
  complianceScore -= Math.min(30, gstStats.overdue * 10);          // overdue GST returns: -10 each, cap -30
  complianceScore -= Math.min(25, invoiceStats.overdue * 2);        // overdue invoices: -2 each, cap -25
  complianceScore -= Math.min(20, taskStats.overdue * 3);           // overdue tasks: -3 each, cap -20
  complianceScore -= Math.min(15, Math.max(0, 5 - bankStats.connected) * 3); // unconnected banks: -3 each, cap -15
  complianceScore -= Math.min(10, (clients.length === 0 ? 5 : 0)); // no clients: -5
  complianceScore = Math.max(0, Math.min(100, complianceScore));

  // ── Data availability ──
  const dataAvailability = {
    hasInvoices: invoices.length > 0,
    hasPayments: payments.length > 0,
    hasBankAccounts: bankAccounts.length > 0,
    hasGstReturns: gstReturns.length > 0,
    hasClients: clients.length > 0,
    hasExpenses: expenses.length > 0,
  };

  const context: BusinessContext = {
    organizationId,
    organizationName,
    financialYear: currentFinancialYear(),
    currentGstPeriod: currentGstPeriod(),
    loadedAt: new Date().toISOString(),
    loadDurationMs: Date.now() - start,
    clients: {
      total: clients.length,
      active: clients.filter((c) => (c.status ?? '').toLowerCase() === 'active').length,
    },
    invoices: invoiceStats,
    payments: paymentStats,
    expenses: expenseStats,
    gstReturns: gstStats,
    bankAccounts: bankStats,
    tasks: taskStats,
    compliance: {
      score: complianceScore,
      pendingFilings: gstStats.total - gstStats.filed,
      upcomingDeadlines: upcomingDeadlines.slice(0, 5),
    },
    recentActivities: recentActivities.map((a) => ({
      id: String(a.id ?? a.activityId ?? ''),
      type: String(a.type ?? a.action ?? 'activity'),
      summary: String(a.summary ?? a.description ?? a.title ?? 'Activity recorded'),
      timestamp: String(a.timestamp ?? a.createdAt ?? new Date().toISOString()),
    })),
    dataAvailability: {
      ...dataAvailability,
      overall: classifyDataAvailability(dataAvailability),
    },
  };

  // Cache it
  cache.set(organizationId, {
    context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return context;
}

// ─── Firestore safe loader ───────────────────────────────────────────────────

async function safeFirestore(
  collection: string,
  organizationId: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    const snap = await adminDb()
      .collection(collection)
      .where('organizationId', '==', organizationId)
      .limit(200)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // Firestore may be unreachable in preview/dev — return empty
    return [];
  }
}

// ─── Context summary for AI prompt injection ─────────────────────────────────

export function formatContextForPrompt(ctx: BusinessContext): string {
  const lines: string[] = [
    `## LIVE BUSINESS CONTEXT (auto-loaded, real data)`,
    `Organization: ${ctx.organizationName} (${ctx.organizationId})`,
    `Financial Year: ${ctx.financialYear}  |  GST Period: ${ctx.currentGstPeriod}`,
    `Context loaded in ${ctx.loadDurationMs}ms`,
    ``,
    `### DATA AVAILABILITY: ${ctx.dataAvailability.overall.toUpperCase()}`,
    ...Object.entries(ctx.dataAvailability)
      .filter(([k]) => k !== 'overall')
      .map(([k, v]) => `  - ${k}: ${v ? 'AVAILABLE' : 'EMPTY'}`),
    ``,
    `### CURRENT STATE (real numbers from database)`,
    `  Clients: ${ctx.clients.total} total (${ctx.clients.active} active)`,
    `  Invoices: ${ctx.invoices.total} total — ${ctx.invoices.draft} draft, ${ctx.invoices.sent} sent, ${ctx.invoices.paid} paid, ${ctx.invoices.overdue} overdue`,
    `  Outstanding: ₹${ctx.invoices.totalOutstanding.toLocaleString('en-IN')} (₹${ctx.invoices.totalOverdue.toLocaleString('en-IN')} overdue)`,
    `  Payments (90d): ₹${ctx.payments.received.toLocaleString('en-IN')} received, ₹${ctx.payments.paid.toLocaleString('en-IN')} paid, ₹${ctx.payments.pending.toLocaleString('en-IN')} pending`,
    `  Expenses (90d): ₹${ctx.expenses.totalAmount.toLocaleString('en-IN')} across ${ctx.expenses.total} entries`,
    `  GST Returns: ${ctx.gstReturns.total} total — ${ctx.gstReturns.filed} filed, ${ctx.gstReturns.draft} draft, ${ctx.gstReturns.overdue} overdue`,
    `  Bank Accounts: ${ctx.bankAccounts.total} total (${ctx.bankAccounts.connected} connected) — ₹${ctx.bankAccounts.totalBalance.toLocaleString('en-IN')} balance`,
    `  Tasks: ${ctx.tasks.total} total (${ctx.tasks.open} open, ${ctx.tasks.overdue} overdue)`,
    `  Compliance Score: ${ctx.compliance.score}/100`,
    `  Pending GST Filings: ${ctx.compliance.pendingFilings}`,
  ];

  if (ctx.compliance.upcomingDeadlines.length > 0) {
    lines.push(``, `### UPCOMING DEADLINES`);
    for (const d of ctx.compliance.upcomingDeadlines) {
      const tense = d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} days OVERDUE` : `${d.daysLeft} days left`;
      lines.push(`  - ${d.title} — ${tense} (due ${d.dueDate})`);
    }
  }

  if (ctx.recentActivities.length > 0) {
    lines.push(``, `### RECENT ACTIVITIES (last 10)`);
    for (const a of ctx.recentActivities) {
      lines.push(`  - [${a.type}] ${a.summary} (${a.timestamp})`);
    }
  }

  lines.push(
    ``,
    `### STRICT RULES`,
    `1. NEVER fabricate numbers. If a data source is EMPTY, say so explicitly.`,
    `2. Every financial figure in your answer MUST come from the numbers above.`,
    `3. If asked about something not in this context, say "I don't have that data connected yet."`,
    `4. Cite the specific source (e.g. "from your 12 unpaid invoices totaling ₹X").`,
    `5. When proposing actions, use the EXACT record counts above.`,
  );

  return lines.join('\n');
}
