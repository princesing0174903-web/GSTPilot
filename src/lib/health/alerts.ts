// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Health, Monitoring & Alerting — Alerting Engine
//
// SERVER-ONLY. The alerting layer:
//   • Defines DEFAULT_ALERT_RULES — the built-in rules shipped with the app.
//   • evaluateAlerts(health) — runs every rule against a SystemHealth and
//     returns the set of new alerts (respecting per-rule cooldown).
//   • recordAlert(alert) — persists to Firestore `alerts` collection + fires
//     console.error for critical alerts + notifies in-process subscribers.
//   • acknowledgeAlert / resolveAlert — human-in-the-loop state transitions.
//   • subscribeToAlerts(callback) — in-process real-time fan-out (used by
//     /api/health/alerts SSE stream when wired).
//
// Cooldown model:
//   Each rule has a `cooldownMs`. After a rule fires, it won't fire again for
//   `cooldownMs` even if its condition is still true. This prevents alert
//   storms during flapping failures (e.g. Firestore read timeouts every 5s).
//   Cooldown is tracked per-rule in an in-memory Map keyed by rule id.
//
// Persistence:
//   Alerts are written to the `alerts` collection (global, not org-scoped —
//   system health is cross-tenant). Each alert document has the fields from
//   the Alert interface plus a `level` for security rules. Writes are
//   best-effort: a Firestore write failure is logged but does NOT throw —
//   the in-memory store still has the alert so /api/health/alerts can list it.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Alert, AlertLevel, AlertRule, AlertSubscription, SystemHealth } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum alerts kept in the in-memory store (FIFO eviction). */
const MAX_IN_MEMORY_ALERTS = 200;

/** Firestore collection for persisted alerts. */
const ALERTS_COLLECTION = 'alerts';

// ─── Built-in alert rules ───────────────────────────────────────────────────

/**
 * The default alert rules shipped with VEYRO. Each rule is a pure
 * condition over SystemHealth. Rules are evaluated in order; the first match
 * for a given source wins (so order them most-severe-first).
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'firestore-unhealthy',
    name: 'Firestore Unhealthy',
    level: 'critical',
    message:
      'Firestore is unreachable. Most app features depend on Firestore — expect cascading failures.',
    cooldownMs: 5 * 60_000, // 5 min
    condition: (h) =>
      h.checks.some((c) => c.name === 'firestore' && c.status === 'unhealthy'),
  },
  {
    id: 'auth-unhealthy',
    name: 'Firebase Auth Unhealthy',
    level: 'critical',
    message:
      'Firebase Auth is unreachable. Users cannot sign in, sign up, or refresh sessions.',
    cooldownMs: 5 * 60_000,
    condition: (h) =>
      h.checks.some((c) => c.name === 'auth' && c.status === 'unhealthy'),
  },
  {
    id: 'memory-pressure',
    name: 'Memory Pressure Critical',
    level: 'critical',
    message:
      'Process heap usage ratio ≥ 95% — OOM imminent. Restart the process or scale up memory.',
    cooldownMs: 60_000,
    condition: (h) => {
      const app = h.checks.find((c) => c.name === 'application');
      return app?.status === 'unhealthy' && !!app.details?.heapUsageRatio
        ? (app.details.heapUsageRatio as number) >= 0.9
        : false;
    },
  },
  {
    id: 'many-checks-degraded',
    name: 'Multiple Subsystems Degraded',
    level: 'critical',
    message:
      'Three or more subsystems are degraded simultaneously. Likely a platform-wide issue.',
    cooldownMs: 5 * 60_000,
    condition: (h) => {
      const degraded = h.checks.filter(
        (c) => c.status === 'degraded' || c.status === 'unhealthy',
      );
      return degraded.length >= 3;
    },
  },
  {
    id: 'billing-unhealthy',
    name: 'Billing Provider Down',
    level: 'error',
    message:
      'The billing provider failed its health check. Payments, refunds, and subscriptions will fail.',
    cooldownMs: 10 * 60_000,
    condition: (h) =>
      h.checks.some((c) => c.name === 'billing' && c.status === 'unhealthy'),
  },
  {
    id: 'ai-unhealthy',
    name: 'AI Provider Down',
    level: 'warning',
    message:
      'The AI provider failed its health check. Oracle, AI CFO, and insights will fall back to deterministic mode.',
    cooldownMs: 10 * 60_000,
    condition: (h) =>
      h.checks.some((c) => c.name === 'ai' && c.status === 'unhealthy'),
  },
  {
    id: 'high-latency',
    name: 'High Check Latency',
    level: 'warning',
    message:
      'One or more health checks took over 2000ms. The system is responding slowly.',
    cooldownMs: 5 * 60_000,
    condition: (h) =>
      h.checks.some((c) => typeof c.latencyMs === 'number' && c.latencyMs > 2000),
  },
];

// ─── In-memory state ────────────────────────────────────────────────────────

/** Active alert store (id → Alert). FIFO eviction at MAX_IN_MEMORY_ALERTS. */
const alertStore = new Map<string, Alert>();

/** Per-rule last-fired-at timestamps (for cooldown). */
const lastFiredAt = new Map<string, number>();

/** Real-time subscribers. */
const subscribers = new Set<AlertSubscription>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluate every rule against the current SystemHealth and return the new
 * alerts (those whose condition matches AND whose cooldown has elapsed).
 *
 * Does NOT record the alerts — callers (typically the monitor loop) decide
 * whether to persist + fan them out via recordAlert().
 *
 * Cooldown: a rule fires at most once per `cooldownMs`. The cooldown clock
 * starts when the rule first fires, not when the condition clears.
 */
export function evaluateAlerts(health: SystemHealth): Alert[] {
  const now = Date.now();
  const newAlerts: Alert[] = [];

  for (const rule of DEFAULT_ALERT_RULES) {
    let matches = false;
    try {
      matches = rule.condition(health);
    } catch (err) {
      // A buggy rule must not break the alerting loop.
      console.error(`[health/alerts] rule '${rule.id}' threw:`, err);
      continue;
    }
    if (!matches) continue;

    const last = lastFiredAt.get(rule.id);
    if (last !== undefined && now - last < rule.cooldownMs) {
      // Still in cooldown — suppress.
      continue;
    }

    lastFiredAt.set(rule.id, now);

    const alert: Alert = {
      id: `${rule.id}-${now}`,
      level: rule.level,
      title: rule.name,
      message: rule.message,
      source: rule.id,
      timestamp: new Date(now).toISOString(),
      metadata: {
        ruleId: rule.id,
        overallHealth: health.overall,
        systemTimestamp: health.timestamp,
      },
    };
    newAlerts.push(alert);
  }

  return newAlerts;
}

/**
 * Record (persist + fan out) an alert. Side effects:
 *   • Adds to the in-memory store (FIFO eviction at MAX_IN_MEMORY_ALERTS).
 *   • Best-effort writes to Firestore `alerts` collection.
 *   • For 'critical' alerts, fires console.error with the alert payload.
 *   • Notifies all in-process subscribers.
 *
 * Never throws — Firestore write failure is logged but the in-memory store
 * is still updated so /api/health/alerts can list the alert.
 */
export async function recordAlert(alert: Alert): Promise<void> {
  // 1. In-memory store.
  alertStore.set(alert.id, alert);
  if (alertStore.size > MAX_IN_MEMORY_ALERTS) {
    // FIFO eviction — delete the oldest entry.
    const oldest = alertStore.keys().next().value;
    if (oldest) alertStore.delete(oldest);
  }

  // 2. Console for critical.
  if (alert.level === 'critical') {
    console.error(`[CRITICAL ALERT] ${alert.title}: ${alert.message}`, {
      alertId: alert.id,
      source: alert.source,
      timestamp: alert.timestamp,
      metadata: alert.metadata,
    });
  } else {
    console.warn(
      `[ALERT/${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`,
      { alertId: alert.id, source: alert.source },
    );
  }

  // 3. Firestore persistence (best-effort).
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const db = adminDb();
    await db.collection(ALERTS_COLLECTION).doc(alert.id).set({
      ...alert,
      persistedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[health/alerts] failed to persist alert '${alert.id}' to Firestore:`,
      err,
    );
  }

  // 4. Fan out to subscribers (synchronous — keep callbacks fast).
  for (const sub of subscribers) {
    try {
      sub(alert);
    } catch (err) {
      console.error(`[health/alerts] subscriber threw for alert '${alert.id}':`, err);
    }
  }
}

/**
 * Acknowledge an alert. Stamps `acknowledgedAt` + `acknowledgedBy` and
 * updates both the in-memory store and Firestore.
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string,
): Promise<void> {
  const stamp = new Date().toISOString();
  const existing = alertStore.get(alertId);
  if (existing) {
    existing.acknowledgedAt = stamp;
    existing.acknowledgedBy = userId;
    alertStore.set(alertId, existing);
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const db = adminDb();
    await db.collection(ALERTS_COLLECTION).doc(alertId).set(
      { acknowledgedAt: stamp, acknowledgedBy: userId },
      { merge: true },
    );
  } catch (err) {
    console.error(
      `[health/alerts] failed to acknowledge alert '${alertId}' in Firestore:`,
      err,
    );
  }
}

/**
 * Resolve an alert. Stamps `resolvedAt` and updates both stores.
 */
export async function resolveAlert(alertId: string): Promise<void> {
  const stamp = new Date().toISOString();
  const existing = alertStore.get(alertId);
  if (existing) {
    existing.resolvedAt = stamp;
    alertStore.set(alertId, existing);
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const db = adminDb();
    await db.collection(ALERTS_COLLECTION).doc(alertId).set(
      { resolvedAt: stamp },
      { merge: true },
    );
  } catch (err) {
    console.error(
      `[health/alerts] failed to resolve alert '${alertId}' in Firestore:`,
      err,
    );
  }
}

/**
 * List alerts from the in-memory store. Optionally filtered by level /
 * active-only (i.e. unresolved).
 */
export function listAlerts(opts?: {
  level?: AlertLevel;
  activeOnly?: boolean;
  limit?: number;
}): Alert[] {
  let alerts = Array.from(alertStore.values());
  if (opts?.level) {
    alerts = alerts.filter((a) => a.level === opts.level);
  }
  if (opts?.activeOnly) {
    alerts = alerts.filter((a) => !a.resolvedAt);
  }
  alerts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  if (opts?.limit && opts.limit > 0) {
    alerts = alerts.slice(0, opts.limit);
  }
  return alerts;
}

/**
 * Subscribe to real-time alert events. The callback is invoked synchronously
 * from recordAlert — keep it fast. Returns an unsubscribe function.
 */
export function subscribeToAlerts(callback: AlertSubscription): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** Clear the in-memory alert store + cooldown tracking (mainly for tests). */
export function resetAlertState(): void {
  alertStore.clear();
  lastFiredAt.clear();
  subscribers.clear();
}
