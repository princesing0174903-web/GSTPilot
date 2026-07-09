// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Production Analytics Aggregator (server-only)
//
// Aggregates business / revenue / usage / billing metrics across the existing
// Firestore collections. Every query is wrapped in try/catch and returns
// zeroed defaults on failure so a single broken collection can never take the
// whole report down. The full combined report is cached in-memory for 60s.
//
// Collections touched (all already covered by firestore.rules):
//   organizations, organization_members, users, subscriptions,
//   billing_invoices, payments, usage_records, ai_jobs, audit_logs,
//   documents, task_queue, gst_returns, invoices
//
// IMPORTANT: server-only. Imports `adminDb()` from `@/lib/firebase-admin` which
// uses the Firebase Admin SDK (bypasses security rules). Do NOT import this
// module from any client code.
// ═══════════════════════════════════════════════════════════════════════════════

import { adminDb } from '@/lib/firebase-admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyActiveUsersPoint {
  date: string;     // YYYY-MM-DD
  dau: number;
  mau: number;      // trailing-30-day rolling count (approx, same scalar for every row)
}

export interface OrganizationMetrics {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  byPlan: Record<string, number>;
}

export interface RevenueDailyPoint {
  date: string;
  revenue: number;
}

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  totalCollected: number;
  outstanding: number;
  byPlan: Record<string, number>;
  daily: RevenueDailyPoint[];
}

export interface UsageDailyPoint {
  date: string;
  apiCalls: number;
  aiRequests: number;
  storageBytes: number;
}

export interface UsageMetrics {
  apiCalls: number;
  storageBytes: number;
  aiRequests: number;
  gstFilings: number;
  invoicesGenerated: number;
  daily: UsageDailyPoint[];
}

export interface BillingMetrics {
  activeSubscriptions: number;
  trialsActive: number;
  pastDue: number;
  cancelled: number;
  avgRevenuePerOrg: number;
  churnRate: number;       // fraction 0..1 over the trailing window
}

export interface ProductionReport {
  generatedAt: string;     // ISO timestamp
  cached: boolean;
  dau: DailyActiveUsersPoint[];
  organizations: OrganizationMetrics;
  revenue: RevenueMetrics;
  usage: UsageMetrics;
  billing: BillingMetrics;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Minimal structural shape we consume from a Firestore QuerySnapshot.
 * Using a local type avoids importing the `FirebaseFirestore` namespace
 * (which lives inside `firebase-admin/firestore`'s UMD types and isn't
 * always picked up by tsc's bundler resolution).
 */
interface SnapshotLike {
  docs: Array<{
    id: string;
    data(): Record<string, unknown>;
  }>;
  size: number;
}

/** Empty snapshot used as a catch() fallback so individual collection
 *  failures never break the whole report. */
const EMPTY_SNAP: SnapshotLike = { docs: [], size: 0 };

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgoIso(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyDailyArray(days: number): UsageDailyPoint[] {
  const out: UsageDailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: ymd(daysAgoIso(i)), apiCalls: 0, aiRequests: 0, storageBytes: 0 });
  return out;
}

function emptyRevenueDailyArray(days: number): RevenueDailyPoint[] {
  const out: RevenueDailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: ymd(daysAgoIso(i)), revenue: 0 });
  return out;
}

function emptyDauArray(days: number): DailyActiveUsersPoint[] {
  const out: DailyActiveUsersPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push({ date: ymd(daysAgoIso(i)), dau: 0, mau: 0 });
  }
  return out;
}

function safeNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// ─── DAU ─────────────────────────────────────────────────────────────────────

export async function getDailyActiveUsers(days = 30): Promise<DailyActiveUsersPoint[]> {
  try {
    const db = adminDb();
    const since = daysAgoIso(days);
    // Use audit_logs (server-side authoritative) when present, fallback to users.lastActiveAt.
    const [auditSnap, usersSnap] = await Promise.all([
      db.collection('audit_logs').where('timestamp', '>=', since).get().catch(() => EMPTY_SNAP),
      db.collection('users').get().catch(() => EMPTY_SNAP),
    ]);

    const perDay = new Map<string, Set<string>>();
    for (const doc of auditSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const dateStr = extractDate(data.timestamp ?? data.createdAt ?? data.eventAt);
      if (!dateStr) continue;
      const actor = String(data.actorUid ?? data.actor ?? data.uid ?? doc.id);
      if (!perDay.has(dateStr)) perDay.set(dateStr, new Set());
      perDay.get(dateStr)!.add(actor);
    }

    // Fallback: users.lastActiveAt
    const mauSet = new Set<string>();
    for (const doc of usersSnap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const la = data.lastActiveAt ?? data.lastSeenAt ?? data.updatedAt;
      const dateStr = extractDate(la);
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (d >= since) {
        if (!perDay.has(dateStr)) perDay.set(dateStr, new Set());
        perDay.get(dateStr)!.add(String(data.uid ?? doc.id));
      }
      if (la) mauSet.add(String(data.uid ?? doc.id));
    }

    const out: DailyActiveUsersPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = ymd(daysAgoIso(i));
      out.push({ date: d, dau: perDay.get(d)?.size ?? 0, mau: mauSet.size });
    }
    return out;
  } catch {
    return emptyDauArray(days);
  }
}

// ─── Organization Metrics ────────────────────────────────────────────────────

export async function getOrganizationMetrics(): Promise<OrganizationMetrics> {
  const zero: OrganizationMetrics = { total: 0, active: 0, trial: 0, suspended: 0, byPlan: {} };
  try {
    const db = adminDb();
    const snap = await db.collection('organizations').get();
    const byPlan: Record<string, number> = {};
    let active = 0, trial = 0, suspended = 0;
    for (const doc of snap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const status = String(d.status ?? 'active').toLowerCase();
      const plan = String(d.plan ?? 'free').toLowerCase();
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      if (status === 'suspended' || status === 'paused') suspended++;
      else if (status === 'trial' || d.trialEndsAt) trial++;
      else if (status === 'active') active++;
    }
    return { total: snap.size, active, trial, suspended, byPlan };
  } catch {
    return zero;
  }
}

// ─── Revenue Metrics ─────────────────────────────────────────────────────────

export async function getRevenueMetrics(days = 30): Promise<RevenueMetrics> {
  const zero: RevenueMetrics = {
    mrr: 0, arr: 0, totalCollected: 0, outstanding: 0,
    byPlan: {}, daily: emptyRevenueDailyArray(days),
  };
  try {
    const db = adminDb();
    const since = daysAgoIso(days);

    const [invSnap, paySnap] = await Promise.all([
      db.collection('billing_invoices').where('createdAt', '>=', since).get().catch(() => EMPTY_SNAP),
      db.collection('payments').where('createdAt', '>=', since).get().catch(() => EMPTY_SNAP),
    ]);

    const byPlan: Record<string, number> = {};
    let outstanding = 0;
    let totalCollected = 0;
    let mrr = 0;
    const dailyMap = new Map<string, number>();

    for (const doc of invSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const amount = safeNumber(d.amount ?? d.total ?? d.amountDue);
      const status = String(d.status ?? 'open').toLowerCase();
      const plan = String(d.plan ?? 'unknown').toLowerCase();
      byPlan[plan] = (byPlan[plan] ?? 0) + amount;
      if (status === 'paid' || status === 'completed') {
        totalCollected += amount;
      } else if (status === 'open' || status === 'pending' || status === 'overdue') {
        outstanding += amount;
      }
      if (status === 'paid' && d.billingPeriod === 'monthly') mrr += amount;
    }

    for (const doc of paySnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const status = String(d.status ?? 'success').toLowerCase();
      if (status !== 'success' && status !== 'captured' && status !== 'paid') continue;
      const amount = safeNumber(d.amount ?? 0);
      totalCollected += amount; // already-collected totals are in payments too
      const dateStr = extractDate(d.createdAt ?? d.paidAt ?? d.timestamp);
      if (dateStr) dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + amount);
    }

    const daily = emptyRevenueDailyArray(days).map(p => ({
      date: p.date,
      revenue: dailyMap.get(p.date) ?? 0,
    }));

    return {
      mrr,
      arr: mrr * 12,
      totalCollected,
      outstanding,
      byPlan,
      daily,
    };
  } catch {
    return zero;
  }
}

// ─── Usage Metrics ───────────────────────────────────────────────────────────

export async function getUsageMetrics(days = 30): Promise<UsageMetrics> {
  const zero: UsageMetrics = {
    apiCalls: 0, storageBytes: 0, aiRequests: 0,
    gstFilings: 0, invoicesGenerated: 0,
    daily: emptyDailyArray(days),
  };
  try {
    const db = adminDb();
    const since = daysAgoIso(days);

    const [usageSnap, aiSnap, auditSnap, gstrSnap, invSnap] = await Promise.all([
      db.collection('usage_records').where('createdAt', '>=', since).get().catch(() => EMPTY_SNAP),
      db.collection('ai_jobs').where('createdAt', '>=', since).get().catch(() => EMPTY_SNAP),
      db.collection('audit_logs').where('timestamp', '>=', since).get().catch(() => EMPTY_SNAP),
      db.collection('gst_returns').where('createdAt', '>=', since).get().catch(() => EMPTY_SNAP),
      db.collection('invoices').where('createdAt', '>=', since).get().catch(() => EMPTY_SNAP),
    ]);

    let apiCalls = 0, storageBytes = 0, aiRequests = 0, gstFilings = 0, invoicesGenerated = 0;
    const dailyMap = new Map<string, { apiCalls: number; aiRequests: number; storageBytes: number }>();

    const bump = (dateStr: string, k: 'apiCalls' | 'aiRequests' | 'storageBytes', v: number) => {
      const e = dailyMap.get(dateStr) ?? { apiCalls: 0, aiRequests: 0, storageBytes: 0 };
      e[k] += v;
      dailyMap.set(dateStr, e);
    };

    for (const doc of usageSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const metric = String(d.metric ?? '').toLowerCase();
      const units = safeNumber(d.units ?? d.count ?? 0);
      if (metric === 'api_call') {
        apiCalls += units;
        const dateStr = extractDate(d.createdAt ?? d.timestamp);
        if (dateStr) bump(dateStr, 'apiCalls', units);
      } else if (metric === 'storage_gb' || metric === 'storage_bytes') {
        const bytes = metric === 'storage_gb' ? units * 1024 ** 3 : units;
        storageBytes += bytes;
        const dateStr = extractDate(d.createdAt ?? d.timestamp);
        if (dateStr) bump(dateStr, 'storageBytes', bytes);
      } else if (metric === 'ai_query' || metric === 'ai_request') {
        aiRequests += units;
        const dateStr = extractDate(d.createdAt ?? d.timestamp);
        if (dateStr) bump(dateStr, 'aiRequests', units);
      }
    }

    // audit_logs: count api_call events as a fallback source for apiCalls
    for (const doc of auditSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const action = String(d.action ?? '').toLowerCase();
      if (action.includes('api') || action.includes('request')) {
        apiCalls += 1;
        const dateStr = extractDate(d.timestamp ?? d.createdAt);
        if (dateStr) bump(dateStr, 'apiCalls', 1);
      }
    }

    for (const doc of aiSnap.docs) {
      aiRequests += 1;
      const dateStr = extractDate((doc.data() as Record<string, unknown>).createdAt);
      if (dateStr) bump(dateStr, 'aiRequests', 1);
    }

    for (const doc of gstrSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const status = String(d.status ?? '').toLowerCase();
      if (status === 'filed' || status === 'submitted') gstFilings += 1;
    }

    invoicesGenerated = invSnap.size;

    const daily = emptyDailyArray(days).map(p => ({
      date: p.date,
      apiCalls: dailyMap.get(p.date)?.apiCalls ?? 0,
      aiRequests: dailyMap.get(p.date)?.aiRequests ?? 0,
      storageBytes: dailyMap.get(p.date)?.storageBytes ?? 0,
    }));

    return { apiCalls, storageBytes, aiRequests, gstFilings, invoicesGenerated, daily };
  } catch {
    return zero;
  }
}

function extractDate(v: unknown): string | null {
  if (v instanceof Date) return ymd(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : ymd(d);
  }
  if (v && typeof v === 'object' && '_seconds' in (v as Record<string, unknown>)) {
    const s = (v as { _seconds: number })._seconds;
    return ymd(new Date(s * 1000));
  }
  return null;
}

// ─── Billing Metrics ─────────────────────────────────────────────────────────

export async function getBillingMetrics(): Promise<BillingMetrics> {
  const zero: BillingMetrics = {
    activeSubscriptions: 0, trialsActive: 0, pastDue: 0, cancelled: 0,
    avgRevenuePerOrg: 0, churnRate: 0,
  };
  try {
    const db = adminDb();
    const [subSnap, orgSnap] = await Promise.all([
      db.collection('subscriptions').get().catch(() => EMPTY_SNAP),
      db.collection('organizations').get().catch(() => EMPTY_SNAP),
    ]);

    let active = 0, trial = 0, pastDue = 0, cancelled = 0, cancelledInWindow = 0, totalEver = 0;
    const since30 = daysAgoIso(30);

    for (const doc of subSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const status = String(d.status ?? 'active').toLowerCase();
      totalEver++;
      if (status === 'active') active++;
      else if (status === 'trialing' || status === 'trial') trial++;
      else if (status === 'past_due' || status === 'pastdue' || status === 'grace') pastDue++;
      else if (status === 'cancelled' || status === 'canceled') {
        cancelled++;
        const cancelledAt = d.cancelledAt ?? d.endedAt ?? d.updatedAt;
        const dt = extractDate(cancelledAt);
        if (dt && new Date(dt) >= since30) cancelledInWindow++;
      }
    }

    // avg revenue per org from MRR estimate
    let mrr = 0;
    for (const doc of subSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      if (String(d.status ?? '').toLowerCase() === 'active') {
        mrr += safeNumber(d.amount ?? d.mrr ?? 0);
      }
    }
    const avgRevenuePerOrg = orgSnap.size > 0 ? mrr / orgSnap.size : 0;
    const churnRate = totalEver > 0 ? cancelledInWindow / totalEver : 0;

    return {
      activeSubscriptions: active,
      trialsActive: trial,
      pastDue,
      cancelled,
      avgRevenuePerOrg,
      churnRate,
    };
  } catch {
    return zero;
  }
}

// ─── Full Production Report (60s cache) ──────────────────────────────────────

let cachedReport: ProductionReport | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getFullProductionReport(): Promise<ProductionReport> {
  const now = Date.now();
  if (cachedReport && now - cachedAt < CACHE_TTL_MS) {
    return { ...cachedReport, cached: true };
  }

  const [dau, organizations, revenue, usage, billing] = await Promise.all([
    getDailyActiveUsers(30),
    getOrganizationMetrics(),
    getRevenueMetrics(30),
    getUsageMetrics(30),
    getBillingMetrics(),
  ]);

  const report: ProductionReport = {
    generatedAt: new Date().toISOString(),
    cached: false,
    dau,
    organizations,
    revenue,
    usage,
    billing,
  };

  cachedReport = report;
  cachedAt = now;
  return report;
}

/** Test/ops helper — clears the 60s in-memory cache. */
export function clearProductionReportCache(): void {
  cachedReport = null;
  cachedAt = 0;
}
