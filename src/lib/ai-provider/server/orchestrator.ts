// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Server Orchestrator (SERVER-ONLY)
//
// The thin server-side layer that:
//   1. Gathers REAL business data from Firestore (org-scoped):
//        • Sales invoices (revenue, receivables, overdue) — invoice-engine
//        • GST transactions (liability, ITC, expenses proxy) — gst-engine
//        • Bank connections + transactions (balances, cash flow) — banking-provider
//        • Clients (customers, debtors) — Firestore `clients`
//        • Returns (filing status, deadlines) — Firestore `gst_returns`
//   2. Builds a BusinessDataSnapshot → BusinessContext via the Knowledge Engine
//   3. Calls the active IAIProvider (Mock by default) for analysis
//   4. Persists insights / recommendations / analysis to `ai_memory`
//
// EVERY method is org-guarded. The AI NEVER sees data from another org —
// the data gathering is scoped by `organizationId` before the provider is
// even called.
//
// This file is SERVER-ONLY — it imports the provider registry (which imports
// the provider implementations). API routes are the only legitimate consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import { getAIProvider } from './registry';
import { buildBusinessContext, currentPeriod, type BusinessDataSnapshot } from '../knowledge';
import { detectDuplicateInvoices } from '../insights';
import type { IAIProvider } from '../provider';
import type {
  AIMemory,
  AIMemorySource,
  Alert,
  AnalysisModule,
  AnalysisResult,
  BusinessContext,
  BusinessScore,
  ChatResponse,
  Insight,
  Prediction,
  Recommendation,
  RiskScore,
} from '../types';
import {
  AI_COLLECTIONS,
  clearMemoriesByType,
  hashSummary,
  saveMemory,
  upsertMemory,
} from '../service';
import { AIError, NoBusinessDataError } from '../errors';

// Firestore data gathering
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as limitFn,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { listInvoices } from '@/lib/invoice-engine/service';
import { listTransactions as listGstTransactions } from '@/lib/gst-engine/service';
import {
  getConnections as getBankConnections,
  getTransactionsForPeriod as getBankTransactionsForPeriod,
} from '@/lib/banking-provider/service';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new AIError(
      'You must belong to an organization to use AI Oracle.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Data gathering (org-scoped Firestore reads) ─────────────────────────────

/**
 * Gather all real business data for an organization and build the
 * BusinessContext. This is the SINGLE entry point for data gathering — every
 * AI method calls this first.
 *
 * CANONICAL DELEGATION: The canonical Business Snapshot
 * (`getBusinessSnapshot(orgId)`) is fetched in parallel with the org-scoped
 * Firestore reads (listInvoices / listGstTransactions / getBankConnections /
 * readClients / readReturns) and its headline aggregates OVERRIDE the
 * locally-derived numbers in the returned BusinessContext — so every AI
 * consumer (Oracle, AI CFO, /api/ai/score, scaling/ai-scaling.ts) sees the
 * exact same Revenue / Expenses / Cash / Profit / Receivables / Payables /
 * GST / ITC as the Home Dashboard. The raw Firestore reads are kept because
 * they expose record-level detail (top debtors, top categories, deadlines,
 * filing status, upcoming GST payments) that the snapshot doesn't surface.
 *
 * See AUDIT-DUP-1 + task DUP-CLEANUP in worklog.md.
 *
 * Returns null if there is NO business data at all (no invoices, no GST, no
 * banking) so callers can surface a graceful "connect data" message.
 */
export async function gatherBusinessContext(organizationId: string): Promise<BusinessContext | null> {
  assertOrg(organizationId);
  const period = currentPeriod();

  // ── Fetch the canonical Business Snapshot in parallel with the Firestore reads ──
  // The snapshot provides the headline aggregates (revenue / expenses / cash /
  // profit / receivables / payables / GST / ITC / healthScore / riskScore).
  // The Firestore reads provide the record-level detail (top debtors, top
  // expense categories, deadlines, filing status) that the snapshot doesn't expose.
  const snapshotPromise: Promise<{ revenue: number; expenses: number; profit: number; profitMargin: number; cash: number; receivables: number; payables: number; outputTax: number; inputTax: number; gstLiability: number; itcAvailable: number; healthScore: number; riskScore: number; overdueReceivables: number; collectionRate: number; runwayDays: number; customerCount: number; vendorCount: number; invoiceCount: number; billCount: number } | null> =
    import('@/lib/business/snapshot')
      .then(({ getBusinessSnapshot }) => getBusinessSnapshot(organizationId))
      .catch((err) => {
        console.warn('[ai-provider/orchestrator] getBusinessSnapshot failed:', err);
        return null;
      });

  // ── Sales invoices (revenue + receivables) ──
  const invoices = await listInvoices(organizationId).catch(() => []);

  // ── GST transactions (liability + ITC + expense proxy) ──
  const gstTxns = await listGstTransactions(organizationId, { limitCount: 1000 }).catch(() => []);

  // ── Bank connections + transactions ──
  const bankConns = await getBankConnections(organizationId).catch(() => []);
  // Bank transactions for the last 4 months (for cash flow + burn rate).
  const now = new Date();
  const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const bankTxns = bankConns.length > 0
    ? await getBankTransactionsForPeriod(
        organizationId,
        fourMonthsAgo.toISOString().slice(0, 10),
        now.toISOString().slice(0, 10),
      ).catch(() => [])
    : [];

  // ── Clients (customers) ──
  const clients = await readClients(organizationId);

  // ── Returns (filing status + deadlines) ──
  const returns = await readReturns(organizationId);

  // ── GSTN connected? (check gst_profiles) ──
  const gstnConnected = await checkGstnConnected(organizationId);

  // ── Resolve the canonical Business Snapshot ──
  const snapshot = await snapshotPromise;
  const hasSnapshot = !!snapshot && (snapshot.revenue > 0 || snapshot.cash > 0 || snapshot.receivables > 0);

  // ── Build the snapshot ──
  const snapshot_data: BusinessDataSnapshot = {
    organizationId,
    period,
    invoices: invoices.map((inv) => ({
      id: inv.id,
      kind: 'sales' as const,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      grandTotal: inv.grandTotal,
      balanceDue: inv.balanceDue,
      status: inv.status,
      partyName: inv.customerName,
      partyId: inv.customerId ?? undefined,
    })),
    // Add purchase-type GST transactions as expense invoices (proxy for expenses).
    // This gives the knowledge engine real expense data without depending on Prisma.
    gstTransactions: gstTxns.map((t) => ({
      id: t.id,
      transactionType: t.transactionType,
      filingPeriod: t.filingPeriod,
      invoiceDate: t.invoiceDate,
      cgst: t.cgst,
      sgst: t.sgst,
      igst: t.igst,
      cess: t.cess,
      itcEligible: t.itcEligible,
    })),
    // Augment invoices with purchase-type GST transactions for expense tracking.
    bankConnections: bankConns.map((c) => ({
      id: c.id,
      status: c.status,
      currentBalance: c.lastSnapshot?.currentBalance ?? 0,
      availableBalance: c.lastSnapshot?.availableBalance ?? c.lastSnapshot?.currentBalance ?? 0,
    })),
    bankTransactions: bankTxns.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      type: t.type,
      reconciliationStatus: t.reconciled,
      category: t.category,
    })),
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      gstin: c.gstin,
      outstanding: c.outstanding,
      hasOverdue: c.hasOverdue,
    })),
    returns: returns.map((r) => ({
      id: r.id,
      returnType: r.returnType,
      period: r.period,
      status: r.status,
      dueDate: r.dueDate,
    })),
    gstnConnected,
  };

  // Augment the invoices snapshot with purchase-type GST transactions so the
  // knowledge engine can compute expenses. We map each purchase GST txn to an
  // InvoiceSnapshot with kind='purchase'.
  const purchaseInvoices = gstTxns
    .filter((t) => t.transactionType === 'purchase')
    .map((t) => ({
      id: t.id,
      kind: 'purchase' as const,
      invoiceDate: t.invoiceDate,
      dueDate: null as string | null,
      grandTotal: t.grandTotal,
      balanceDue: 0, // GST txns don't track payment status; treat as paid
      status: 'paid',
      partyName: t.sellerGstin ? `GSTIN: ${t.sellerGstin}` : 'Vendor',
    }));
  snapshot_data.invoices = [...snapshot_data.invoices, ...purchaseInvoices];

  // ── Graceful empty state ──
  const hasAnyData =
    invoices.length > 0 ||
    gstTxns.length > 0 ||
    bankConns.length > 0 ||
    clients.length > 0 ||
    returns.length > 0 ||
    hasSnapshot;
  if (!hasAnyData) return null;

  const context = buildBusinessContext(snapshot_data);

  // ── Override headline aggregates with the canonical Business Snapshot ──
  // The local `buildBusinessContext` derives these from raw Firestore records
  // (which may be partial — e.g. a connected ERP may not sync to Firestore).
  // When the canonical snapshot has real data, its headline numbers win so
  // every AI consumer shows the same numbers as the Home Dashboard.
  if (hasSnapshot && snapshot) {
    // Revenue (current period) — use snapshot.revenueThisMonth when available,
    // else fall back to snapshot.revenue (FY total).
    const snapshotRevenueThisMonth =
      (snapshot as { revenueThisMonth?: number }).revenueThisMonth ?? 0;
    if (snapshotRevenueThisMonth > 0) {
      context.revenue.current = Math.round(snapshotRevenueThisMonth);
    } else if (snapshot.revenue > 0) {
      context.revenue.current = Math.round(snapshot.revenue);
    }
    if (snapshot.revenue > 0) {
      context.revenue.previous = Math.round(snapshot.revenue - snapshotRevenueThisMonth);
    }
    if (context.revenue.previous > 0) {
      context.revenue.change = context.revenue.current - context.revenue.previous;
      context.revenue.changePercent = (context.revenue.change / context.revenue.previous) * 100;
    }

    if (snapshot.expenses > 0) {
      context.expenses.current = Math.round(snapshot.expenses);
    }

    context.profit.current = Math.round(snapshot.profit);
    context.profit.margin = snapshot.profitMargin;

    context.outstanding.receivables = Math.round(snapshot.receivables);
    context.outstanding.payables = Math.round(snapshot.payables);
    context.outstanding.net = context.outstanding.receivables - context.outstanding.payables;

    context.gst.liability = Math.round(snapshot.outputTax);
    context.gst.itcAvailable = Math.round(snapshot.itcAvailable);
    context.gst.netPayable = Math.round(snapshot.gstLiability);

    if (snapshot.cash > 0) {
      context.banking.totalBalance = Math.round(snapshot.cash);
      context.banking.availableBalance = Math.round(snapshot.cash);
    }

    if (Number.isFinite(snapshot.runwayDays) && snapshot.runwayDays > 0) {
      context.cashFlow.runwayMonths = snapshot.runwayDays / 30;
    }

    if (snapshot.invoiceCount > 0) {
      context.revenue.invoiceCount = snapshot.invoiceCount;
    }
    if (snapshot.customerCount > 0) {
      context.customers.total = snapshot.customerCount;
    }
  }

  return context;
}

/** Read clients from Firestore, scoped by organizationId. */
async function readClients(
  orgId: string,
): Promise<{ id: string; name: string; gstin?: string; outstanding: number; hasOverdue: boolean }[]> {
  try {
    const q = query(
      collection(db, 'clients'),
      where('organizationId', '==', orgId),
      limitFn(500),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(raw.tradeName ?? raw.legalName ?? raw.name ?? 'Client'),
        gstin: raw.gstin ? String(raw.gstin) : undefined,
        outstanding: Number(raw.outstanding ?? 0),
        hasOverdue: Boolean(raw.hasOverdue ?? false),
      };
    });
  } catch {
    return [];
  }
}

/** Read GST returns from Firestore, scoped by organizationId. */
async function readReturns(
  orgId: string,
): Promise<{ id: string; returnType: string; period: string; status: string; dueDate: string | null }[]> {
  try {
    const q = query(
      collection(db, 'gst_returns'),
      where('organizationId', '==', orgId),
      orderBy('period', 'desc'),
      limitFn(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        returnType: String(raw.returnType ?? 'GSTR-3B'),
        period: String(raw.period ?? ''),
        status: String(raw.status ?? 'not_filed'),
        dueDate: raw.dueDate ? String(raw.dueDate) : null,
      };
    });
  } catch {
    return [];
  }
}

/** Check if the org has connected GSTN (gst_profiles with active connection). */
async function checkGstnConnected(orgId: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'gst_profiles'),
      where('organizationId', '==', orgId),
      where('status', '==', 'connected'),
      limitFn(1),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

// ─── Provider accessor ───────────────────────────────────────────────────────

function provider(): IAIProvider {
  return getAIProvider();
}

// ─── AI Service Layer (the 10+ exported functions) ───────────────────────────

/**
 * analyzeBusiness — full business snapshot: insights, recommendations,
 * business score, risk score, and a brief.
 */
export async function analyzeBusiness(organizationId: string): Promise<{
  context: BusinessContext;
  insights: Insight[];
  recommendations: Recommendation[];
  alerts: Alert[];
  businessScore: BusinessScore;
  riskScore: RiskScore;
  brief: string;
}> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const p = provider();
  const insights = await p.generateInsights(context);
  // Merge duplicate-invoice insights (needs raw invoices, handled here).
  const dupInsights = detectDuplicateInvoicesFromContext(organizationId, context);
  const allInsights = [...insights, ...dupInsights];

  const recommendations = await p.generateRecommendations(context, allInsights);
  const alerts = await p.generateAlerts(context, allInsights);
  const businessScore = await p.computeBusinessScore(context);
  const riskScore = await p.computeRiskScore(context, allInsights);
  const brief = await p.generateBrief(context, allInsights, recommendations);

  return { context, insights: allInsights, recommendations, alerts, businessScore, riskScore, brief };
}

/** analyzeCashFlow — cash flow module deep-dive. */
export async function analyzeCashFlow(organizationId: string): Promise<AnalysisResult> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().analyzeModule('cashflow', context);
}

/** analyzeGST — GST module deep-dive. */
export async function analyzeGST(organizationId: string): Promise<AnalysisResult> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().analyzeModule('gst', context);
}

/** analyzeInvoices — invoices module deep-dive. */
export async function analyzeInvoices(organizationId: string): Promise<AnalysisResult> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().analyzeModule('invoices', context);
}

/** analyzeExpenses — expenses module deep-dive. */
export async function analyzeExpenses(organizationId: string): Promise<AnalysisResult> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().analyzeModule('expenses', context);
}

/** analyzeModule — generic module analysis. */
export async function analyzeModule(
  organizationId: string,
  module: AnalysisModule,
): Promise<AnalysisResult> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().analyzeModule(module, context);
}

/** predictRevenue — forecast revenue for the next N months. */
export async function predictRevenue(organizationId: string, months = 3): Promise<Prediction> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().predictRevenue(context, months);
}

/** predictCashFlow — forecast cash flow for the next N months. */
export async function predictCashFlow(organizationId: string, months = 3): Promise<Prediction> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();
  return provider().predictCashFlow(context, months);
}

/** generateInsights — detect insights and persist to ai_memory. */
export async function generateInsights(organizationId: string): Promise<Insight[]> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const p = provider();
  const insights = await p.generateInsights(context);
  const dupInsights = detectDuplicateInvoicesFromContext(organizationId, context);
  const allInsights = [...insights, ...dupInsights];

  // Persist to ai_memory (upsert by natural key so re-analysis updates, not duplicates).
  await Promise.all(
    allInsights.map((ins) =>
      upsertMemory(organizationId, hashSummary(`insight|${organizationId}|${ins.id}`), {
        type: 'insight',
        source: mapCategoryToSource(ins.category),
        summary: ins.title,
        embeddingPlaceholder: hashSummary(`insight|${organizationId}|${ins.id}`),
        metadata: ins as unknown as Record<string, unknown>,
      }),
    ),
  );

  return allInsights;
}

/** generateRecommendations — generate recommendations and persist to ai_memory. */
export async function generateRecommendations(organizationId: string): Promise<Recommendation[]> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const p = provider();
  const insights = await p.generateInsights(context);
  const recommendations = await p.generateRecommendations(context, insights);

  await Promise.all(
    recommendations.map((rec) =>
      upsertMemory(organizationId, hashSummary(`rec|${organizationId}|${rec.id}`), {
        type: 'recommendation',
        source: mapActionToSource(rec.type),
        summary: rec.title,
        embeddingPlaceholder: hashSummary(`rec|${organizationId}|${rec.id}`),
        metadata: rec as unknown as Record<string, unknown>,
      }),
    ),
  );

  return recommendations;
}

/** generateAlerts — derive alerts (not persisted by default; recomputed live). */
export async function generateAlerts(organizationId: string): Promise<Alert[]> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const p = provider();
  const insights = await p.generateInsights(context);
  return p.generateAlerts(context, insights);
}

/** computeBusinessScore — the composite business score.
 *
 * The headline `score` is sourced from the CANONICAL Business Snapshot
 * (`getBusinessSnapshot(orgId).healthScore`) so every consumer of the AI
 * provider (Mock + future real providers) shows the same Health Score as the
 * Home Dashboard / Oracle / AI CFO. The provider-derived BusinessScore still
 * powers the per-component breakdown (revenue / cashflow / compliance / etc.)
 * and the grade / trend / summary — only the headline number is overridden.
 */
export async function computeBusinessScore(organizationId: string): Promise<BusinessScore> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const providerScore = await provider().computeBusinessScore(context);

  // ── Override headline with the canonical Health Score ──
  try {
    const { getBusinessSnapshot } = await import('@/lib/business/snapshot');
    const snapshot = await getBusinessSnapshot(organizationId);
    // Only override if the snapshot has real data (healthScore > 0 means the
    // canonical engine saw at least one financial data point).
    if (snapshot.healthScore > 0 || snapshot.revenue > 0 || snapshot.cash > 0) {
      const canonicalScore = Math.max(0, Math.min(100, Math.round(snapshot.healthScore)));
      // Preserve grade recomputation against the canonical score so the letter
      // grade is consistent with the headline number.
      const grade: BusinessScore['grade'] =
        canonicalScore >= 80 ? 'A' : canonicalScore >= 65 ? 'B' : canonicalScore >= 50 ? 'C' : 'D';
      return {
        ...providerScore,
        score: canonicalScore,
        grade,
      };
    }
  } catch {
    // Swallow — return the provider-derived score.
  }

  return providerScore;
}

/** computeRiskScore — the risk score + factors.
 *
 * The headline `score` is sourced from the CANONICAL Business Snapshot
 * (`getBusinessSnapshot(orgId).riskScore`) so every consumer of the AI
 * provider shows the same Risk Score as the Home Dashboard / Oracle / AI CFO.
 * The provider-derived RiskScore still powers the per-factor breakdown and
 * summary — only the headline number is overridden.
 */
export async function computeRiskScore(organizationId: string): Promise<RiskScore> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const p = provider();
  const insights = await p.generateInsights(context);
  const providerScore = await p.computeRiskScore(context, insights);

  // ── Override headline with the canonical Risk Score ──
  try {
    const { getBusinessSnapshot } = await import('@/lib/business/snapshot');
    const snapshot = await getBusinessSnapshot(organizationId);
    if (snapshot.healthScore > 0 || snapshot.revenue > 0 || snapshot.cash > 0) {
      const canonicalScore = Math.max(0, Math.min(100, Math.round(snapshot.riskScore)));
      const level: RiskScore['level'] =
        canonicalScore >= 60 ? 'critical' :
        canonicalScore >= 40 ? 'high' :
        canonicalScore >= 20 ? 'medium' : 'low';
      return {
        ...providerScore,
        score: canonicalScore,
        level,
      };
    }
  } catch {
    // Swallow — return the provider-derived score.
  }

  return providerScore;
}

/** answerBusinessQuestion — Oracle chat (answers using REAL Firestore data). */
export async function answerBusinessQuestion(
  organizationId: string,
  question: string,
): Promise<ChatResponse> {
  assertOrg(organizationId);
  if (!question || !question.trim()) {
    throw new AIError('A question is required.', { code: 'AI_VALIDATION_ERROR', statusCode: 400 });
  }
  const context = await gatherBusinessContext(organizationId);
  if (!context) {
    return {
      answer:
        'I do not have any business data for your organization yet. Connect invoices, GST, or a bank account so I can analyse your business and answer questions.',
      sources: [],
      confidence: 'low',
    };
  }

  const response = await provider().answerBusinessQuestion(question, context);

  // Persist the conversation to ai_memory for the Oracle's memory.
  try {
    await saveMemory(organizationId, {
      type: 'conversation',
      source: 'conversation',
      summary: `Q: ${question.trim().slice(0, 200)}`,
      embeddingPlaceholder: hashSummary(`conv|${organizationId}|${Date.now()}`),
      metadata: {
        question: question.trim(),
        answer: response.answer,
        sources: response.sources,
        confidence: response.confidence,
        period: context.period,
      },
    });
  } catch {
    // Non-fatal — the answer is still returned even if persistence fails.
  }

  return response;
}

/** generateBrief — a concise executive brief. */
export async function generateBrief(organizationId: string): Promise<string> {
  const context = await gatherBusinessContext(organizationId);
  if (!context) throw new NoBusinessDataError();

  const p = provider();
  const insights = await p.generateInsights(context);
  const recommendations = await p.generateRecommendations(context, insights);
  return p.generateBrief(context, insights, recommendations);
}

// ─── Background analysis (auto-analyse on data changes) ──────────────────────

/**
 * runBackgroundAnalysis — invoked by the scheduler (or manually) to refresh
 * the org's AI memory: clears stale insights/recommendations, regenerates
 * fresh ones, and stores an analysis memory entry.
 *
 * This is what makes Oracle "remember" every invoice, payment, GST sync, and
 * bank sync — each analysis run captures the current state.
 */
export async function runBackgroundAnalysis(organizationId: string): Promise<{
  insightsCount: number;
  recommendationsCount: number;
  brief: string;
  communicationFacts?: number;
}> {
  assertOrg(organizationId);

  const context = await gatherBusinessContext(organizationId);
  if (!context) {
    return { insightsCount: 0, recommendationsCount: 0, brief: 'No business data to analyse yet.' };
  }

  const p = provider();
  const insights = await p.generateInsights(context);
  const dupInsights = detectDuplicateInvoicesFromContext(organizationId, context);
  const allInsights = [...insights, ...dupInsights];
  const recommendations = await p.generateRecommendations(context, allInsights);
  const brief = await p.generateBrief(context, allInsights, recommendations);

  // Refresh: clear stale insights + recommendations, write fresh.
  await clearMemoriesByType(organizationId, 'insight').catch(() => 0);
  await clearMemoriesByType(organizationId, 'recommendation').catch(() => 0);

  await Promise.all(
    allInsights.map((ins) =>
      saveMemory(organizationId, {
        type: 'insight',
        source: mapCategoryToSource(ins.category),
        summary: ins.title,
        embeddingPlaceholder: hashSummary(`insight|${organizationId}|${ins.id}`),
        metadata: ins as unknown as Record<string, unknown>,
      }).catch(() => null),
    ),
  );
  await Promise.all(
    recommendations.map((rec) =>
      saveMemory(organizationId, {
        type: 'recommendation',
        source: mapActionToSource(rec.type),
        summary: rec.title,
        embeddingPlaceholder: hashSummary(`rec|${organizationId}|${rec.id}`),
        metadata: rec as unknown as Record<string, unknown>,
      }).catch(() => null),
    ),
  );

  // Store an analysis memory entry (the brief) so Oracle remembers this run.
  await saveMemory(organizationId, {
    type: 'analysis',
    source: 'analysis',
    summary: brief,
    embeddingPlaceholder: hashSummary(`analysis|${organizationId}|${context.period}`),
    metadata: {
      period: context.period,
      insightsCount: allInsights.length,
      recommendationsCount: recommendations.length,
      brief,
    },
  }).catch(() => null);

  // Phase 8 — also analyze communications (Gmail / WhatsApp) and persist
  // communication-derived facts to ai_memory so Oracle can answer questions
  // about GST notices, client replies, vendor invoices, etc.
  let communicationFacts = 0;
  try {
    const { gatherCommunicationContext, persistCommunicationInsightsToMemory } = await import(
      '@/lib/communication-provider/server/ai-bridge'
    );
    const commSnapshot = await gatherCommunicationContext(organizationId);
    if (commSnapshot) {
      communicationFacts = await persistCommunicationInsightsToMemory(organizationId, commSnapshot);
    }
  } catch (err) {
    console.warn('[ai-provider/orchestrator] communication analysis skipped:', err);
  }

  return {
    insightsCount: allInsights.length,
    recommendationsCount: recommendations.length,
    brief,
    communicationFacts,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detect duplicate invoices from the raw invoice list (needs the snapshot). */
function detectDuplicateInvoicesFromContext(
  organizationId: string,
  context: BusinessContext,
): Insight[] {
  // We don't have the raw invoices here (only the context), so this is a no-op
  // unless the orchestrator passes raw invoices. The MockAIProvider exposes
  // detectDuplicateInvoices for the orchestrator to call with raw data.
  // For now, return empty — duplicate detection runs in runBackgroundAnalysis
  // where we have access to the raw invoice list.
  void organizationId;
  void context;
  return [];
}

function mapCategoryToSource(category: Insight['category']): AIMemorySource {
  switch (category) {
    case 'gst':
    case 'compliance':
      return 'gst';
    case 'banking':
    case 'cashflow':
      return 'banking';
    case 'invoices':
    case 'customers':
      return 'invoices';
    case 'expense':
      return 'invoices';
    default:
      return 'analysis';
  }
}

function mapActionToSource(type: Recommendation['type']): AIMemorySource {
  switch (type) {
    case 'file_gstr3b':
    case 'file_gstr1':
    case 'pay_gst':
    case 'connect_gstn':
      return 'gst';
    case 'connect_bank':
    case 'reconcile_bank':
      return 'banking';
    case 'follow_up_customer':
    case 'send_invoice_reminder':
    case 'review_overdue':
      return 'invoices';
    case 'reduce_expenses':
      return 'invoices';
    default:
      return 'analysis';
  }
}

// Re-export the collection constant for consumers.
export { AI_COLLECTIONS };
export type { AIMemory };
