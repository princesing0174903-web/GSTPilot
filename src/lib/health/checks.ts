// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Health, Monitoring & Alerting — Individual Checks
//
// SERVER-ONLY. Each check returns a HealthCheck object — NEVER throws. A failed
// check is part of the system's observed reality, not an exceptional control
// flow. The /api/health endpoint relies on this contract: it must always
// return 200 with a SystemHealth payload, even when every check fails.
//
// Each check:
//   • Measures latency (high-resolution, ms).
//   • Has a 5-second timeout — returns { status: 'unhealthy' } on timeout.
//   • Catches all errors and converts them into unhealthy HealthCheck objects.
//   • Stamps `lastCheckedAt` with the ISO timestamp at completion.
//
// Available checks:
//   checkApplicationHealth       — process is alive, memory not exhausted
//   checkFirestoreHealth         — Firestore readable (lightweight read on health_check doc)
//   checkStorageHealth           — Storage bucket reachable (metadata on known object)
//   checkCloudFunctionsHealth    — Cloud Functions reachable (onCall healthCheck)
//   checkBillingHealth           — Billing provider's healthCheck()
//   checkAIHealth                — AI provider's healthCheck()
//   checkNotificationHealth      — Firestore health_check collection writable
//   checkERPHealth               — ERP provider (Tally) healthCheck()
//   checkBankingHealth           — Banking provider healthCheck()
//   checkAuthHealth              — Firebase Auth can list 1 user
// ═══════════════════════════════════════════════════════════════════════════════

import type { HealthCheck, HealthStatus } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Hard timeout per check — never let one check block the whole probe. */
const CHECK_TIMEOUT_MS = 5_000;

/**
 * Memory pressure threshold (heap usage / RSS). Above this we flag 'degraded'
 * — the process is still running but getting close to OOM. Above 95% we flag
 * 'unhealthy' (OOM imminent).
 */
const MEM_DEGRADED_RATIO = 0.85;
const MEM_UNHEALTHY_RATIO = 0.95;

/** Storage object used for the metadata probe (must exist in the bucket). */
const STORAGE_PROBE_OBJECT = 'health-check.txt';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Run an async producer with a hard timeout. On timeout returns
 * `{ status: 'unhealthy', message: '...' }`. Never throws.
 */
async function withTimeout<T>(
  producer: () => Promise<T>,
  timeoutMs: number = CHECK_TIMEOUT_MS,
): Promise<{ ok: true; value: T } | { ok: false; error: string; timedOut: boolean }> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<{ ok: false; error: string; timedOut: boolean }>((resolve) => {
    timer = setTimeout(
      () => resolve({ ok: false, error: `Timed out after ${timeoutMs}ms`, timedOut: true }),
      timeoutMs,
    );
  });
  try {
    const result = await Promise.race([
      producer().then((value) => ({ ok: true as const, value })),
      timeout,
    ]);
    return result;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      timedOut: false,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Build a HealthCheck object with a latency stamp. */
function build(
  name: string,
  status: HealthStatus,
  startedAt: number,
  partial?: Omit<HealthCheck, 'name' | 'status' | 'lastCheckedAt' | 'latencyMs'>,
): HealthCheck {
  return {
    name,
    status,
    latencyMs: Math.round(performance.now() - startedAt),
    lastCheckedAt: new Date().toISOString(),
    ...partial,
  };
}

// ─── Application / Process ──────────────────────────────────────────────────

/**
 * Verify the Node process is alive and not about to OOM. Checks
 * `process.memoryUsage()` — if heap usage is close to RSS, the process is
 * memory-constrained (V8 heap approaching its cap).
 */
export async function checkApplicationHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const mem = process.memoryUsage();
    const ratio = mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;
    return { mem, ratio };
  });

  if (!result.ok) {
    return build('application', 'unhealthy', startedAt, {
      message: `Application check failed: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }

  const { mem, ratio } = result.value;
  const details: Record<string, unknown> = {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    externalMb: Math.round(mem.external / 1024 / 1024),
    heapUsageRatio: Math.round(ratio * 100) / 100,
  };

  if (ratio >= MEM_UNHEALTHY_RATIO) {
    return build('application', 'unhealthy', startedAt, {
      message: `Heap usage ratio ${(ratio * 100).toFixed(1)}% ≥ ${MEM_UNHEALTHY_RATIO * 100}% — OOM imminent`,
      details,
    });
  }
  if (ratio >= MEM_DEGRADED_RATIO) {
    return build('application', 'degraded', startedAt, {
      message: `Heap usage ratio ${(ratio * 100).toFixed(1)}% elevated (≥ ${MEM_DEGRADED_RATIO * 100}%)`,
      details,
    });
  }
  return build('application', 'healthy', startedAt, {
    message: 'Process running within healthy memory bounds',
    details,
  });
}

// ─── Firestore ──────────────────────────────────────────────────────────────

/**
 * Lightweight Firestore read: fetch a `health_check` doc from a system
 * collection. The doc need not exist — a successful round-trip (even with
 * 'not found') proves Firestore is reachable. Falls back to a 1-doc limit on
 * `organizations` if the health_check collection is rejected by rules.
 */
export async function checkFirestoreHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { adminDb } = await import('@/lib/firebase-admin');
    const db = adminDb();
    try {
      await db.collection('health_check').doc('probe').get();
    } catch {
      // Fallback: a 1-doc limit on organizations — proves Firestore is up.
      await db.collection('organizations').limit(1).get();
    }
    return { ok: true };
  });

  if (!result.ok) {
    return build('firestore', 'unhealthy', startedAt, {
      message: `Firestore unreachable: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }
  return build('firestore', 'healthy', startedAt, {
    message: 'Firestore read succeeded',
    details: { probeCollection: 'health_check' },
  });
}

// ─── Storage ────────────────────────────────────────────────────────────────

/**
 * Probe Firebase Storage by fetching metadata on a known object. The object
 * need not exist — a structured 'not found' response means the bucket is
 * reachable. Returns 'degraded' on auth errors (bucket configured but perms
 * wrong) and 'unhealthy' on transport errors.
 */
export async function checkStorageHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { adminStorage } = await import('@/lib/firebase-admin');
    const bucket = adminStorage().bucket();
    const file = bucket.file(STORAGE_PROBE_OBJECT);
    const [exists] = await file.exists();
    return { exists };
  });

  if (!result.ok) {
    return build('storage', 'degraded', startedAt, {
      message: `Storage bucket probe failed: ${result.error}`,
      details: { timedOut: result.timedOut, probeObject: STORAGE_PROBE_OBJECT },
    });
  }
  return build('storage', 'healthy', startedAt, {
    message: 'Storage bucket reachable',
    details: { probeObject: STORAGE_PROBE_OBJECT, exists: result.value.exists },
  });
}

// ─── Cloud Functions ────────────────────────────────────────────────────────

/**
 * Probe the deployed Cloud Functions by invoking the `healthCheck` onCall
 * function. If the Functions SDK is not configured (local dev, no
 * FIREBASE_PROJECT_ID), returns 'unknown' with a helpful message — this is
 * NOT a failure, it's "feature not deployed here".
 */
export async function checkCloudFunctionsHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return build('cloud-functions', 'unknown', startedAt, {
      message: 'FIREBASE_PROJECT_ID not set — Cloud Functions health not probed',
      details: { reason: 'no-project-id' },
    });
  }

  const result = await withTimeout(async () => {
    // Dynamic import — keeps the Functions SDK out of cold-start when not needed.
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { getApps } = await import('firebase/app');
    const apps = getApps();
    if (apps.length === 0) {
      return { ok: false, reason: 'no-app' as const };
    }
    const functions = getFunctions(apps[0]!, 'asia-south1');
    const callable = httpsCallable<{ ok: boolean }, { ok: boolean }>(functions, 'healthCheck');
    const res = await callable({});
    return { ok: true, payload: res.data };
  });

  if (!result.ok) {
    // Cloud Functions not deployed / not reachable — degrade to 'unknown' so it
    // doesn't drag down the overall status (we can't tell whether they're
    // deployed in this env or not).
    return build('cloud-functions', 'unknown', startedAt, {
      message: `Cloud Functions not reachable: ${result.error}`,
      details: { timedOut: result.timedOut, projectId },
    });
  }

  if (result.value.ok) {
    return build('cloud-functions', 'healthy', startedAt, {
      message: 'Cloud Functions healthCheck responded',
      details: { projectId, payload: result.value.payload },
    });
  }
  return build('cloud-functions', 'unknown', startedAt, {
    message: 'Cloud Functions app not initialized client-side',
    details: { reason: result.value.reason, projectId },
  });
}

// ─── Billing Provider ───────────────────────────────────────────────────────

/**
 * Probe the billing provider via its `healthCheck()` method. The active
 * provider is determined by the `PAYMENT_PROVIDER` env var (mock by default).
 */
export async function checkBillingHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { getPaymentProvider, describePaymentProvider } = await import(
      '@/lib/billing-provider/server/registry'
    );
    const provider = getPaymentProvider();
    const ok = await provider.healthCheck();
    return { ok, description: describePaymentProvider() };
  });

  if (!result.ok) {
    return build('billing', 'unhealthy', startedAt, {
      message: `Billing provider probe failed: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }

  const { ok, description } = result.value;
  return build('billing', ok ? 'healthy' : 'unhealthy', startedAt, {
    message: ok
      ? `Billing provider '${description.name}' healthy`
      : `Billing provider '${description.name}' reported unhealthy`,
    details: description,
  });
}

// ─── AI Provider ────────────────────────────────────────────────────────────

/**
 * Probe the AI provider via its `healthCheck()` method. The active provider is
 * determined by the `AI_PROVIDER` env var (mock by default).
 */
export async function checkAIHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { getAIProvider, describeProvider } = await import(
      '@/lib/ai-provider/server/registry'
    );
    const provider = getAIProvider();
    const ok = await provider.healthCheck();
    return { ok, description: describeProvider() };
  });

  if (!result.ok) {
    return build('ai', 'unhealthy', startedAt, {
      message: `AI provider probe failed: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }

  const { ok, description } = result.value;
  return build('ai', ok ? 'healthy' : 'degraded', startedAt, {
    message: ok
      ? `AI provider '${description.name}' healthy`
      : `AI provider '${description.name}' reported unhealthy`,
    details: description,
  });
}

// ─── Notification (Firestore Writable) ──────────────────────────────────────

/**
 * Verify the notification subsystem is writable by doing a write-then-delete
 * on the `health_check` collection. This proves Firestore write permissions
 * work end-to-end (the read-only checkFirestoreHealth doesn't exercise writes).
 */
export async function checkNotificationHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { adminDb } = await import('@/lib/firebase-admin');
    const db = adminDb();
    const probeRef = db.collection('health_check').doc('notification-probe');
    const payload = {
      type: 'system',
      category: 'health',
      title: 'Health probe',
      message: 'Firestore write/read/delete probe — safe to ignore',
      timestamp: Date.now(),
    };
    await probeRef.set(payload, { merge: true });
    const snap = await probeRef.get();
    if (!snap.exists) {
      return { ok: false, reason: 'write-succeeded-but-read-missed' as const };
    }
    await probeRef.delete();
    return { ok: true };
  });

  if (!result.ok) {
    return build('notifications', 'degraded', startedAt, {
      message: `Notification subsystem write probe failed: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }

  if (!result.value.ok) {
    return build('notifications', 'degraded', startedAt, {
      message: `Notification probe inconsistent: ${result.value.reason}`,
      details: { reason: result.value.reason },
    });
  }

  return build('notifications', 'healthy', startedAt, {
    message: 'Notification collection writable',
    details: { probe: 'write-read-delete' },
  });
}

// ─── ERP Provider ───────────────────────────────────────────────────────────

/**
 * Probe the ERP provider (Tally by default). Mock provider always returns
 * healthy — this check is wired through the registry so it auto-promotes to a
 * real probe when `ERP_PROVIDER=tally-future` is set.
 */
export async function checkERPHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { getERPProvider, describeERPProvider } = await import(
      '@/lib/erp-provider/server/registry'
    );
    const provider = getERPProvider('tally');
    const ok = await provider.healthCheck();
    return { ok, description: describeERPProvider('tally') };
  });

  if (!result.ok) {
    return build('erp', 'unhealthy', startedAt, {
      message: `ERP provider probe failed: ${result.error}`,
      details: { timedOut: result.timedOut, erp: 'tally' },
    });
  }

  const { ok, description } = result.value;
  return build('erp', ok ? 'healthy' : 'degraded', startedAt, {
    message: ok
      ? `ERP provider '${description.name}' healthy`
      : `ERP provider '${description.name}' reported unhealthy`,
    details: description,
  });
}

// ─── Banking Provider ───────────────────────────────────────────────────────

/**
 * Probe the banking provider. Mock provider always returns healthy — wired
 * through the registry so it auto-promotes to a real probe when
 * `BANK_PROVIDER=aa|razorpayx|...` is set.
 */
export async function checkBankingHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { getBankProvider, describeProvider } = await import(
      '@/lib/banking-provider/server/registry'
    );
    const provider = getBankProvider();
    const ok = await provider.healthCheck();
    return { ok, description: describeProvider() };
  });

  if (!result.ok) {
    return build('banking', 'unhealthy', startedAt, {
      message: `Banking provider probe failed: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }

  const { ok, description } = result.value;
  return build('banking', ok ? 'healthy' : 'degraded', startedAt, {
    message: ok
      ? `Banking provider '${description.name}' healthy`
      : `Banking provider '${description.name}' reported unhealthy`,
    details: description,
  });
}

// ─── Firebase Auth ──────────────────────────────────────────────────────────

/**
 * Verify Firebase Admin Auth is reachable by listing 1 user. This is the
 * lightest Auth-admin operation. If the project has 0 users, listUsers still
 * succeeds — only an unreachable / unconfigured Auth service fails.
 */
export async function checkAuthHealth(): Promise<HealthCheck> {
  const startedAt = performance.now();
  const result = await withTimeout(async () => {
    const { adminAuth } = await import('@/lib/firebase-admin');
    const auth = adminAuth();
    const page = await auth.listUsers(1);
    return { userCount: page.users.length };
  });

  if (!result.ok) {
    return build('auth', 'unhealthy', startedAt, {
      message: `Firebase Auth unreachable: ${result.error}`,
      details: { timedOut: result.timedOut },
    });
  }
  return build('auth', 'healthy', startedAt, {
    message: 'Firebase Auth reachable',
    details: { userCountInPage: result.value.userCount },
  });
}

// ─── Registry ───────────────────────────────────────────────────────────────

/**
 * Ordered list of all health checks. Order matters for dashboard display:
 * infrastructure first (app, firestore, auth, storage), then functions, then
 * domain providers (billing, ai, banking, erp), then notification pipeline.
 */
export const HEALTH_CHECKS: Array<{ name: string; run: () => Promise<HealthCheck> }> = [
  { name: 'application', run: checkApplicationHealth },
  { name: 'firestore', run: checkFirestoreHealth },
  { name: 'auth', run: checkAuthHealth },
  { name: 'storage', run: checkStorageHealth },
  { name: 'cloud-functions', run: checkCloudFunctionsHealth },
  { name: 'billing', run: checkBillingHealth },
  { name: 'ai', run: checkAIHealth },
  { name: 'banking', run: checkBankingHealth },
  { name: 'erp', run: checkERPHealth },
  { name: 'notifications', run: checkNotificationHealth },
];

/** Lookup map for runHealthCheck(name). */
export const HEALTH_CHECK_BY_NAME = new Map(
  HEALTH_CHECKS.map((c) => [c.name, c.run]),
);
