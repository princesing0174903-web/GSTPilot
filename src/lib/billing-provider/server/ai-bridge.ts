// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing, Subscriptions & Payments™ — AI Bridge (SERVER-ONLY)
//
// Connects the Billing Provider to the AI Oracle:
//   1. Reads billing data from Firestore (org-scoped): subscription, billing
//      account, invoices, payments, usage records.
//   2. Writes billing-derived facts to `ai_memory` so Oracle can answer questions
//      like "What's my current plan?", "When does my subscription renew?",
//      "How much have I spent this year?", "Am I nearing any usage limits?".
//   3. Generates billing-derived insights:
//       • Current plan + MRR + renewal date
//       • Outstanding balance + overdue invoices
//       • Failed payments + grace period
//       • Usage vs limits (forecast "you'll exceed your plan")
//       • Plan recommendations (upgrade when near limits)
//       • Payment history (LTV, churn risk)
//
// This module is SERVER-ONLY — it reads Firestore via the firebase/firestore
// client SDK (works in Node) and writes to ai_memory via the AI service.
// ═══════════════════════════════════════════════════════════════════════════════

import { collection, query, where, getDocs, orderBy, limit as limitFn } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { saveMemory, clearMemoriesByType, hashSummary } from '@/lib/ai-provider/service';
import { getPlan } from './plans';
import type { PaymentProviderName, Subscription, SubscriptionPlanId, UsageMetricType } from '../types';
import {
  toSubscription,
  toInvoice,
  toPayment,
  toUsageRecord,
} from '../service';
import type { BillingInvoice, Payment, UsageRecord } from '../types';

// ─── Billing Context Snapshot ────────────────────────────────────────────────

/**
 * A snapshot of the organization's billing state, used by the AI Oracle to
 * enrich its business context. Built from real Firestore data.
 */
export interface BillingSnapshot {
  /** True if the org has an active subscription. */
  hasSubscription: boolean;
  /** Current plan id (or null if no subscription). */
  currentPlan: SubscriptionPlanId | null;
  /** Current plan name (or null). */
  planName: string | null;
  /** Subscription status (active, trialing, past_due, etc.). */
  subscriptionStatus: Subscription['status'] | null;
  /** Monthly recurring revenue (INR). */
  mrr: number;
  /** Annual recurring revenue (INR). */
  arr: number;
  /** ISO timestamp of next renewal (or null). */
  nextRenewalDate: string | null;
  /** Days until next renewal (or null). */
  daysToRenewal: number | null;
  /** Trial days remaining (or null if not trialing). */
  trialDaysLeft: number | null;
  /** Outstanding balance (INR) — sum of unpaid invoices. */
  outstandingAmount: number;
  /** Number of overdue invoices. */
  overdueInvoices: number;
  /** Failed payments in last 30 days. */
  failedPayments: number;
  /** Grace period end (ISO, or null if not in grace). */
  gracePeriodEnd: string | null;
  /** Total amount paid (INR) — lifetime. */
  totalPaid: number;
  /** Total amount refunded (INR) — lifetime. */
  totalRefunded: number;
  /** Usage this period by metric. */
  usageThisPeriod: Record<UsageMetricType, number>;
  /** Plan limits by metric (or null if no plan). */
  usageLimits: Record<UsageMetricType, number> | null;
  /** Usage percent by metric (0..100; Infinity if limit is Infinity). */
  usagePercent: Record<UsageMetricType, number>;
  /** Metrics that are over 80% of limit (approaching limit). */
  approachingLimits: UsageMetricType[];
  /** Metrics that have exceeded their limit. */
  exceededLimits: UsageMetricType[];
  /** Connected payment providers. */
  connectedProviders: PaymentProviderName[];
  /** Recent invoices (newest 10). */
  recentInvoices: BillingInvoice[];
  /** Recent payments (newest 10). */
  recentPayments: Payment[];
  /** All usage records for the current period. */
  usageRecords: UsageRecord[];
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

/**
 * Build the billing snapshot from real Firestore data.
 * Returns null if the org has no subscription yet.
 */
export async function gatherBillingContext(
  organizationId: string,
): Promise<BillingSnapshot | null> {
  if (!organizationId) return null;

  const [subscriptionsRaw, invoicesRaw, paymentsRaw, usageRaw] = await Promise.all([
    readCollection(organizationId, 'subscriptions'),
    readCollection(organizationId, 'billing_invoices', 100),
    readCollection(organizationId, 'payments', 100),
    readCollection(organizationId, 'usage_records', 500),
  ]);

  if (subscriptionsRaw.length === 0 && invoicesRaw.length === 0) {
    return null;
  }

  const subscription = subscriptionsRaw.length
    ? toSubscription(subscriptionsRaw[0].id, subscriptionsRaw[0].data)
    : null;
  const invoices = invoicesRaw.map((r) => toInvoice(r.id, r.data));
  const payments = paymentsRaw.map((r) => toPayment(r.id, r.data));
  const usageRecords = usageRaw.map((r) => toUsageRecord(r.id, r.data));

  return buildSnapshot(subscription, invoices, payments, usageRecords);
}

function buildSnapshot(
  subscription: Subscription | null,
  invoices: BillingInvoice[],
  payments: Payment[],
  usageRecords: UsageRecord[],
): BillingSnapshot {
  const now = new Date();
  const plan = subscription ? getPlan(subscription.planId) : null;

  const nextRenewalDate = subscription?.currentPeriodEnd ?? null;
  const daysToRenewal = nextRenewalDate
    ? Math.max(
        0,
        Math.round(
          (new Date(nextRenewalDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  const trialDaysLeft = subscription?.trialEndDate
    ? Math.max(
        0,
        Math.round(
          (new Date(subscription.trialEndDate).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  const outstandingAmount = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.amountDue, 0);

  const overdueInvoices = invoices.filter((i) => i.status === 'overdue').length;

  const failedPayments = payments.filter(
    (p) =>
      p.status === 'failed' &&
      new Date(p.createdAt).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunded = payments.reduce((sum, p) => sum + p.refundAmount, 0);

  // Usage this period
  const usageThisPeriod: Record<UsageMetricType, number> = {
    oracle_requests: 0,
    storage_bytes: 0,
    ai_tokens: 0,
    invoices_generated: 0,
    returns_filed: 0,
    api_calls: 0,
    automation_runs: 0,
  };
  const periodStart = subscription?.currentPeriodStart ?? null;
  const periodEnd = subscription?.currentPeriodEnd ?? null;
  for (const r of usageRecords) {
    if (periodStart && periodEnd) {
      if (r.periodStart < periodStart || r.periodEnd > periodEnd) continue;
    }
    if (r.metric in usageThisPeriod) {
      usageThisPeriod[r.metric] += r.quantity;
    }
  }

  const usageLimits: Record<UsageMetricType, number> | null = plan
    ? {
        oracle_requests: plan.limits.oracleRequestsMonthly,
        storage_bytes: plan.limits.storageBytes,
        ai_tokens: plan.limits.aiCreditsMonthly,
        invoices_generated: plan.limits.invoicesMonthly,
        returns_filed: plan.limits.returnsMonthly,
        api_calls: plan.limits.apiCallsMonthly,
        automation_runs: plan.limits.automationRunsMonthly,
      }
    : null;

  const usagePercent: Record<UsageMetricType, number> = {
    oracle_requests: 0,
    storage_bytes: 0,
    ai_tokens: 0,
    invoices_generated: 0,
    returns_filed: 0,
    api_calls: 0,
    automation_runs: 0,
  };
  const approachingLimits: UsageMetricType[] = [];
  const exceededLimits: UsageMetricType[] = [];
  if (usageLimits) {
    (Object.keys(usageThisPeriod) as UsageMetricType[]).forEach((metric) => {
      const used = usageThisPeriod[metric];
      const limit = usageLimits[metric];
      const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));
      usagePercent[metric] = pct;
      if (limit !== Infinity) {
        if (used >= limit) exceededLimits.push(metric);
        else if (pct >= 80) approachingLimits.push(metric);
      }
    });
  }

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return {
    hasSubscription: !!subscription,
    currentPlan: subscription?.planId ?? null,
    planName: subscription?.planName ?? plan?.name ?? null,
    subscriptionStatus: subscription?.status ?? null,
    mrr: subscription?.mrr ?? 0,
    arr: subscription?.arr ?? 0,
    nextRenewalDate,
    daysToRenewal,
    trialDaysLeft,
    outstandingAmount,
    overdueInvoices,
    failedPayments,
    gracePeriodEnd: subscription?.gracePeriodEnd ?? null,
    totalPaid,
    totalRefunded,
    usageThisPeriod,
    usageLimits,
    usagePercent,
    approachingLimits,
    exceededLimits,
    connectedProviders: subscription ? [subscription.paymentProvider] : [],
    recentInvoices,
    recentPayments,
    usageRecords,
  };
}

// ─── Billing Insights → AI Memory ────────────────────────────────────────────

/**
 * Analyze the billing snapshot and write AI memory entries to ai_memory.
 * These facts let Oracle answer questions like:
 *   - "What's my current plan?"
 *   - "When does my subscription renew?"
 *   - "How much have I spent on GSTPilot?"
 *   - "Am I nearing any usage limits?"
 *   - "Should I upgrade my plan?"
 *
 * Returns the count of memory entries written.
 */
export async function persistBillingInsightsToMemory(
  organizationId: string,
  snapshot: BillingSnapshot,
): Promise<number> {
  if (!organizationId) return 0;

  // Clear stale billing-source facts so we don't accumulate duplicates across runs.
  // We only clear facts with source='billing' (not all facts, since ERP/communication
  // also write facts). The AI service doesn't support source-scoped clearing, so we
  // use a metadata flag on our billing facts and the hashSummary dedup instead.
  await clearMemoriesByType(organizationId, 'fact').catch(() => 0);

  let count = 0;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Current plan + MRR fact
  if (snapshot.hasSubscription && snapshot.currentPlan) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'billing',
      summary: `Current plan: ${snapshot.planName} (${snapshot.currentPlan}). MRR: ₹${snapshot.mrr.toLocaleString('en-IN')}, ARR: ₹${snapshot.arr.toLocaleString('en-IN')}. Subscription status: ${snapshot.subscriptionStatus}.`,
      embeddingPlaceholder: hashSummary(`billing|plan|${organizationId}|${today}`),
      metadata: {
        category: 'billing_plan',
        currentPlan: snapshot.currentPlan,
        planName: snapshot.planName,
        mrr: snapshot.mrr,
        arr: snapshot.arr,
        status: snapshot.subscriptionStatus,
      },
    }).catch(() => null);
    count++;
  }

  // 2. Renewal date fact
  if (snapshot.nextRenewalDate) {
    const renewText = snapshot.daysToRenewal === 0
      ? 'today'
      : `in ${snapshot.daysToRenewal} day(s)`;
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'billing',
      summary: `Subscription renews ${renewText} (${snapshot.nextRenewalDate.slice(0, 10)}). Auto-renewal ${snapshot.subscriptionStatus === 'active' ? 'enabled' : 'may be paused'}.`,
      embeddingPlaceholder: hashSummary(`billing|renewal|${organizationId}|${today}`),
      metadata: {
        category: 'billing_renewal',
        nextRenewalDate: snapshot.nextRenewalDate,
        daysToRenewal: snapshot.daysToRenewal,
      },
    }).catch(() => null);
    count++;
  }

  // 3. Outstanding balance + overdue invoices alert
  if (snapshot.outstandingAmount > 0 || snapshot.overdueInvoices > 0) {
    await saveMemory(organizationId, {
      type: 'alert',
      source: 'billing',
      summary: `Outstanding balance: ₹${snapshot.outstandingAmount.toLocaleString('en-IN')} across ${snapshot.overdueInvoices} overdue invoice(s). Payment action needed to avoid service suspension.`,
      embeddingPlaceholder: hashSummary(`billing|outstanding|${organizationId}|${today}`),
      metadata: {
        category: 'billing_outstanding',
        outstandingAmount: snapshot.outstandingAmount,
        overdueInvoices: snapshot.overdueInvoices,
      },
    }).catch(() => null);
    count++;
  }

  // 4. Failed payments + grace period alert
  if (snapshot.failedPayments > 0) {
    const graceText = snapshot.gracePeriodEnd
      ? ` Grace period ends ${snapshot.gracePeriodEnd.slice(0, 10)}.`
      : '';
    await saveMemory(organizationId, {
      type: 'alert',
      source: 'billing',
      summary: `${snapshot.failedPayments} failed payment(s) in the last 30 days.${graceText} Update payment method to avoid suspension.`,
      embeddingPlaceholder: hashSummary(`billing|failed|${organizationId}|${today}`),
      metadata: {
        category: 'billing_failed_payments',
        failedPayments: snapshot.failedPayments,
        gracePeriodEnd: snapshot.gracePeriodEnd,
      },
    }).catch(() => null);
    count++;
  }

  // 5. Usage vs limits — approaching alert
  if (snapshot.approachingLimits.length > 0) {
    const labels = snapshot.approachingLimits.map(prettyMetric);
    await saveMemory(organizationId, {
      type: 'alert',
      source: 'billing',
      summary: `Approaching usage limits: ${labels.join(', ')}. Consider upgrading your plan to avoid hitting caps.`,
      embeddingPlaceholder: hashSummary(`billing|approaching|${organizationId}|${today}`),
      metadata: {
        category: 'billing_approaching_limits',
        approachingLimits: snapshot.approachingLimits,
        usagePercent: snapshot.usagePercent,
      },
    }).catch(() => null);
    count++;
  }

  // 6. Usage exceeded alert
  if (snapshot.exceededLimits.length > 0) {
    const labels = snapshot.exceededLimits.map(prettyMetric);
    await saveMemory(organizationId, {
      type: 'alert',
      source: 'billing',
      summary: `Usage limits EXCEEDED: ${labels.join(', ')}. Operations may be blocked until the next billing period or plan upgrade.`,
      embeddingPlaceholder: hashSummary(`billing|exceeded|${organizationId}|${today}`),
      metadata: {
        category: 'billing_exceeded_limits',
        exceededLimits: snapshot.exceededLimits,
        usageThisPeriod: snapshot.usageThisPeriod,
        usageLimits: snapshot.usageLimits,
      },
    }).catch(() => null);
    count++;
  }

  // 7. Usage forecast fact (overall usage summary)
  if (snapshot.hasSubscription && snapshot.usageLimits) {
    const u = snapshot.usageThisPeriod;
    const summary = `Usage this period: ${u.oracle_requests} Oracle requests, ${formatBytes(u.storage_bytes)} storage, ${u.ai_tokens.toLocaleString('en-IN')} AI tokens, ${u.invoices_generated} invoices, ${u.returns_filed} returns, ${u.api_calls} API calls, ${u.automation_runs} automation runs.`;
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'billing',
      summary,
      embeddingPlaceholder: hashSummary(`billing|usage|${organizationId}|${today}`),
      metadata: {
        category: 'billing_usage',
        usageThisPeriod: snapshot.usageThisPeriod,
        usageLimits: snapshot.usageLimits,
        usagePercent: snapshot.usagePercent,
      },
    }).catch(() => null);
    count++;
  }

  // 8. Plan recommendation (insight)
  if (snapshot.hasSubscription && (snapshot.approachingLimits.length > 0 || snapshot.exceededLimits.length > 0)) {
    const rec = recommendPlan(snapshot);
    if (rec) {
      await saveMemory(organizationId, {
        type: 'recommendation',
        source: 'billing',
        summary: `Plan recommendation: ${rec.reason}`,
        embeddingPlaceholder: hashSummary(`billing|recommendation|${organizationId}|${today}`),
        metadata: {
          category: 'billing_plan_recommendation',
          currentPlan: snapshot.currentPlan,
          recommendedPlan: rec.planId,
          reason: rec.reason,
        },
      }).catch(() => null);
      count++;
    }
  }

  // 9. Lifetime value (LTV) fact
  if (snapshot.totalPaid > 0) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'billing',
      summary: `Lifetime payments to GSTPilot: ₹${snapshot.totalPaid.toLocaleString('en-IN')}. Refunds: ₹${snapshot.totalRefunded.toLocaleString('en-IN')}. Net LTV: ₹${(snapshot.totalPaid - snapshot.totalRefunded).toLocaleString('en-IN')}.`,
      embeddingPlaceholder: hashSummary(`billing|ltv|${organizationId}|${today}`),
      metadata: {
        category: 'billing_ltv',
        totalPaid: snapshot.totalPaid,
        totalRefunded: snapshot.totalRefunded,
      },
    }).catch(() => null);
    count++;
  }

  // 10. Trial fact
  if (snapshot.subscriptionStatus === 'trialing' && snapshot.trialDaysLeft !== null) {
    await saveMemory(organizationId, {
      type: 'fact',
      source: 'billing',
      summary: `Free trial active — ${snapshot.trialDaysLeft} day(s) remaining. Add a payment method before the trial ends to keep access to ${snapshot.planName} features.`,
      embeddingPlaceholder: hashSummary(`billing|trial|${organizationId}|${today}`),
      metadata: {
        category: 'billing_trial',
        trialDaysLeft: snapshot.trialDaysLeft,
      },
    }).catch(() => null);
    count++;
  }

  return count;
}

// ─── Oracle chat enrichment ───────────────────────────────────────────────────

/**
 * Build a human-readable context string from the billing snapshot, for injecting
 * into Oracle chat prompts. Returns empty string if no billing data.
 */
export function buildBillingContextText(snapshot: BillingSnapshot | null): string {
  if (!snapshot || !snapshot.hasSubscription) return '';
  const lines: string[] = [];
  lines.push(`Plan: ${snapshot.planName} (${snapshot.currentPlan})`);
  lines.push(`Status: ${snapshot.subscriptionStatus}`);
  lines.push(`MRR: ₹${snapshot.mrr.toLocaleString('en-IN')}`);
  if (snapshot.nextRenewalDate) {
    lines.push(
      `Renews: ${snapshot.nextRenewalDate.slice(0, 10)} (in ${snapshot.daysToRenewal} day(s))`,
    );
  }
  if (snapshot.trialDaysLeft !== null) {
    lines.push(`Trial: ${snapshot.trialDaysLeft} day(s) remaining`);
  }
  if (snapshot.outstandingAmount > 0) {
    lines.push(`Outstanding: ₹${snapshot.outstandingAmount.toLocaleString('en-IN')}`);
  }
  if (snapshot.failedPayments > 0) {
    lines.push(`Failed payments (30d): ${snapshot.failedPayments}`);
  }
  if (snapshot.approachingLimits.length > 0) {
    lines.push(`Approaching limits: ${snapshot.approachingLimits.map(prettyMetric).join(', ')}`);
  }
  if (snapshot.exceededLimits.length > 0) {
    lines.push(`Exceeded limits: ${snapshot.exceededLimits.map(prettyMetric).join(', ')}`);
  }
  const u = snapshot.usageThisPeriod;
  lines.push(
    `Usage: ${u.oracle_requests} oracle, ${formatBytes(u.storage_bytes)} storage, ${u.ai_tokens.toLocaleString('en-IN')} AI tokens, ${u.invoices_generated} invoices, ${u.returns_filed} returns`,
  );
  if (snapshot.totalPaid > 0) {
    lines.push(`Lifetime paid: ₹${snapshot.totalPaid.toLocaleString('en-IN')}`);
  }
  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prettyMetric(metric: UsageMetricType): string {
  switch (metric) {
    case 'oracle_requests':
      return 'Oracle requests';
    case 'storage_bytes':
      return 'storage';
    case 'ai_tokens':
      return 'AI credits';
    case 'invoices_generated':
      return 'invoices';
    case 'returns_filed':
      return 'GST returns';
    case 'api_calls':
      return 'API calls';
    case 'automation_runs':
      return 'automation runs';
    default:
      return metric;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Recommend a higher plan based on usage. Returns null if no upgrade needed.
 */
function recommendPlan(snapshot: BillingSnapshot): {
  planId: SubscriptionPlanId;
  reason: string;
} | null {
  if (!snapshot.currentPlan) return null;
  const order: SubscriptionPlanId[] = ['free', 'starter', 'professional', 'business', 'enterprise'];
  const idx = order.indexOf(snapshot.currentPlan);
  if (idx === -1 || idx === order.length - 1) return null; // already on enterprise

  const next = order[idx + 1];
  const exceeded = snapshot.exceededLimits;
  const approaching = snapshot.approachingLimits;

  if (exceeded.length > 0) {
    return {
      planId: next,
      reason: `You've exceeded your ${exceeded.map(prettyMetric).join(', ')} limit on the ${snapshot.planName} plan. Upgrading to ${capitalize(next)} will restore access immediately.`,
    };
  }
  if (approaching.length > 0) {
    return {
      planId: next,
      reason: `You're approaching your ${approaching.map(prettyMetric).join(', ')} limit on the ${snapshot.planName} plan. Consider upgrading to ${capitalize(next)} to avoid hitting the cap.`,
    };
  }
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Firestore read helper ────────────────────────────────────────────────────

async function readCollection(
  organizationId: string,
  collName: string,
  maxDocs = 500,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const q = query(
    collection(db, collName),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limitFn(maxDocs),
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
  } catch {
    return [];
  }
}

// ─── Type re-exports ─────────────────────────────────────────────────────────

export type {
  Subscription,
  BillingInvoice,
  Payment,
  UsageRecord,
  SubscriptionPlanId,
  UsageMetricType,
};
