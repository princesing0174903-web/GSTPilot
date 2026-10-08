// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Observability Barrel Export + Init
//
// Single import surface for the centralized logging, audit, error-tracking,
// and performance infrastructure:
//
//   import { logger, recordAudit, captureError, trackApiCall } from '@/lib/observability';
//
// ─── initObservability() ──────────────────────────────────────────────────────
// Call ONCE at app startup. Server-side: from a Next.js instrumentation hook
// or a top-level server module load. Client-side: from a one-time effect in
// the root layout.
//
// It installs:
//   • Global error handlers (process.unhandledRejection / uncaughtException
//     on Node, window.onerror / unhandledrejection in the browser).
//   • The performance-metric flush interval (drains the in-memory ring
//     buffer to Firestore once per minute).
//
// Idempotent — safe to call multiple times.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Logger ───────────────────────────────────────────────────────────────────
export {
  Logger,
  logger,
  createLogger,
  logRequest,
  generateRequestId,
  type LogLevel,
  type LogEntry,
} from './logger';

// ─── Audit Log ────────────────────────────────────────────────────────────────
export {
  recordAudit,
  queryAuditLogs,
  subscribeToAuditLogs,
  flushAuditBuffer,
  getAuditBufferSize,
  stopAuditFlushTimer,
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogEntry,
  type AuditLogQueryFilters,
  type AuditLogQueryResult,
  type AuditLogSubscriptionOptions,
} from './audit-log';

// ─── Error Tracking ───────────────────────────────────────────────────────────
export {
  captureError,
  captureMessage,
  addBreadcrumb,
  withRequestContext,
  fingerprintError,
  installGlobalErrorHandlers,
  type Breadcrumb,
  type ErrorType,
  type TrackedError,
} from './error-tracking';

// ─── Performance ──────────────────────────────────────────────────────────────
export {
  recordMetric,
  trackApiCall,
  trackFirestoreRead,
  trackFirestoreWrite,
  trackFunctionDuration,
  getMetricsSummary,
  getMetricSnapshot,
  startMetricFlushInterval,
  stopMetricFlushInterval,
  flushMetrics,
  type PerformanceMetric,
  type MetricUnit,
  type MetricsSummary,
} from './performance';

// ─── Init ─────────────────────────────────────────────────────────────────────

import { installGlobalErrorHandlers } from './error-tracking';
import { startMetricFlushInterval } from './performance';

let observabilityInitialized = false;

/**
 * Initialize the centralized observability infrastructure.
 *
 * Call ONCE at app startup. On the server: from a Next.js instrumentation
 * hook (`src/instrumentation.ts`) or from the top of a server-only init
 * module. In the browser: from a one-time `useEffect` in the root layout
 * (or any client component that's guaranteed to mount once).
 *
 * What it does:
 *   1. Installs global error handlers (unhandled rejections, uncaught
 *      exceptions, window.onerror). These capture errors that escape
 *      try/catch blocks so they don't vanish silently.
 *   2. Starts the performance-metric flush interval (drains the in-memory
 *      ring buffer to Firestore `performance_metrics` once per minute).
 *
 * Idempotent — calling multiple times is safe (subsequent calls are no-ops).
 */
export function initObservability(): void {
  if (observabilityInitialized) return;
  observabilityInitialized = true;

  try {
    installGlobalErrorHandlers();
  } catch (err) {
     
    console.error('[observability/init] failed to install global error handlers:', err);
  }

  try {
    // The flush interval is server-only (it writes to Firestore via
    // firebase-admin). On the browser, startMetricFlushInterval is a no-op
    // because the firebase-admin dynamic import will fail and the timer's
    // flush calls will silently drop.
    if (typeof window === 'undefined') {
      startMetricFlushInterval();
    }
  } catch (err) {
     
    console.error('[observability/init] failed to start metric flush interval:', err);
  }
}
