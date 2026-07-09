// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Usage Meter (SERVER-ONLY, pure functions)
//
// Pure functions for usage tracking:
//   • Create UsageRecord docs (one per event)
//   • Aggregate usage by period
//   • Check plan limits
//   • Format usage for display
//
// All functions are PURE (no Firebase). The orchestrator persists UsageRecords
// via the service layer.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  SubscriptionPlanLimits,
  Subscription,
  UsageMetricType,
  UsageRecord,
} from '../types';
import { getPlan } from './plans';

// ─── Constants ────────────────────────────────────────────────────────────────

export const USAGE_METRIC_LABELS: Record<UsageMetricType, string> = {
  oracle_requests: 'Oracle Requests',
  storage_bytes: 'Storage',
  ai_tokens: 'AI Tokens',
  invoices_generated: 'Invoices Generated',
  returns_filed: 'Returns Filed',
  api_calls: 'API Calls',
  automation_runs: 'Automation Runs',
};

export const USAGE_METRIC_UNITS: Record<UsageMetricType, 'bytes' | 'count' | 'tokens'> = {
  oracle_requests: 'count',
  storage_bytes: 'bytes',
  ai_tokens: 'tokens',
  invoices_generated: 'count',
  returns_filed: 'count',
  api_calls: 'count',
  automation_runs: 'count',
};

/**
 * Map a UsageMetricType to the corresponding SubscriptionPlanLimits field.
 * Returns null for metrics without a direct limit (e.g. ai_tokens).
 */
export const USAGE_METRIC_TO_LIMIT: Record<UsageMetricType, keyof SubscriptionPlanLimits | null> = {
  oracle_requests: 'oracleRequestsMonthly',
  storage_bytes: 'storageBytes',
  ai_tokens: null, // AI tokens are part of aiCreditsMonthly but tracked separately
  invoices_generated: 'invoicesMonthly',
  returns_filed: 'returnsMonthly',
  api_calls: 'apiCallsMonthly',
  automation_runs: 'automationRunsMonthly',
};

// ─── Usage Record Builder ─────────────────────────────────────────────────────

/**
 * Build a UsageRecord doc (does NOT persist). The orchestrator will call the
 * service to save it.
 */
export function recordUsage(
  organizationId: string,
  subscriptionId: string,
  metric: UsageMetricType,
  quantity: number,
  metadata: Record<string, unknown> = {},
): UsageRecord {
  const now = new Date();
  return {
    id: '', // Set by Firestore on save
    organizationId,
    subscriptionId,
    metric,
    quantity,
    periodStart: now.toISOString(),
    periodEnd: now.toISOString(),
    metadata,
    createdAt: now.toISOString(),
  };
}

// ─── Period Aggregation ───────────────────────────────────────────────────────

/**
 * Get total usage for a specific metric in a period (one-shot aggregation).
 * Pure: works on a list of UsageRecords.
 */
export function getUsageForPeriod(
  usageRecords: UsageRecord[],
  metric: UsageMetricType,
  periodStart: string,
  periodEnd: string,
): number {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  return usageRecords
    .filter(
      (r) =>
        r.metric === metric &&
        new Date(r.createdAt).getTime() >= start &&
        new Date(r.createdAt).getTime() <= end,
    )
    .reduce((sum, r) => sum + r.quantity, 0);
}

/**
 * Get usage summary for all metrics in a period.
 * Returns a Record<UsageMetricType, number>.
 */
export function getUsageSummary(
  usageRecords: UsageRecord[],
  periodStart: string,
  periodEnd: string,
): Record<UsageMetricType, number> {
  const metrics: UsageMetricType[] = [
    'oracle_requests',
    'storage_bytes',
    'ai_tokens',
    'invoices_generated',
    'returns_filed',
    'api_calls',
    'automation_runs',
  ];
  const summary = {} as Record<UsageMetricType, number>;
  for (const m of metrics) {
    summary[m] = getUsageForPeriod(usageRecords, m, periodStart, periodEnd);
  }
  return summary;
}

// ─── Limit Checking ───────────────────────────────────────────────────────────

/**
 * Check whether a usage metric has exceeded its plan limit.
 */
export function checkUsageLimit(
  currentUsage: number,
  metric: UsageMetricType,
  planLimits: SubscriptionPlanLimits,
): {
  exceeded: boolean;
  current: number;
  limit: number;
  percentUsed: number;
} {
  const limitKey = USAGE_METRIC_TO_LIMIT[metric];
  if (!limitKey) {
    // No limit for this metric.
    return { exceeded: false, current: currentUsage, limit: Infinity, percentUsed: 0 };
  }
  const limit = planLimits[limitKey];
  const percentUsed = getUsagePercent(currentUsage, limit);
  return {
    exceeded: !isFinite(limit) ? false : currentUsage >= limit,
    current: currentUsage,
    limit,
    percentUsed,
  };
}

/**
 * Compute usage percentage. Returns 0..100, or Infinity if limit is Infinity.
 */
export function getUsagePercent(current: number, limit: number): number {
  if (!isFinite(limit) || limit === 0) return 0;
  return (current / limit) * 100;
}

// ─── Billing Period ───────────────────────────────────────────────────────────

/**
 * Get the current billing period dates for a subscription.
 */
export function getBillingPeriodDates(
  subscription: Subscription,
): { start: string; end: string } {
  return {
    start: subscription.currentPeriodStart,
    end: subscription.currentPeriodEnd,
  };
}

// ─── Display Formatting ───────────────────────────────────────────────────────

/**
 * Format a usage value for display.
 *   • bytes → "1.2 GB", "500 MB"
 *   • tokens → "12,345 tokens"
 *   • count → "89 calls" / "5 returns"
 */
export function formatUsageForDisplay(metric: UsageMetricType, value: number): string {
  const unit = USAGE_METRIC_UNITS[metric];
  switch (unit) {
    case 'bytes':
      return formatBytes(value);
    case 'tokens':
      return `${value.toLocaleString('en-IN')} tokens`;
    case 'count':
      return `${value.toLocaleString('en-IN')} ${metric.replace(/_/g, ' ')}`;
    default:
      return String(value);
  }
}

/**
 * Format bytes into a human-readable string (KB / MB / GB / TB).
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (!isFinite(bytes)) return '∞';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ─── Plan Limit Lookup ────────────────────────────────────────────────────────

/**
 * Get the plan limits for a subscription's plan.
 */
export function getPlanLimitsForSubscription(subscription: Subscription): SubscriptionPlanLimits | null {
  const plan = getPlan(subscription.planId);
  return plan ? plan.limits : null;
}
