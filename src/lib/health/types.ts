// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Health, Monitoring & Alerting — Type System
//
// Pure types only. No imports from Firebase / Prisma / Next — safe to import
// from both client and server code. The implementations (checks, monitor,
// alerts) live in sibling files and are server-only.
//
// Status model:
//   • healthy   — check passed, all metrics within expected range
//   • degraded  — check passed but slow / partial / fallback in use
//   • unhealthy — check failed / errored / timed out
//   • unknown   — check could not be evaluated (e.g. feature disabled)
//
// Aggregation rule for SystemHealth.overall:
//   - 'unhealthy' wins over everything (any check unhealthy → overall unhealthy)
//   - 'degraded' wins over 'healthy' and 'unknown'
//   - 'healthy' wins over 'unknown'
//   - 'unknown' alone → 'unknown'
//   - 'healthy' + 'unknown' → 'healthy'
//
// Alert levels (escalating severity):
//   info < warning < error < critical
// ═══════════════════════════════════════════════════════════════════════════════

/** The status of a single health check or the system overall. */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/** A single health-check result. */
export interface HealthCheck {
  /** Stable identifier for the check (e.g. 'firestore', 'billing'). */
  name: string;
  /** Aggregated status of this check. */
  status: HealthStatus;
  /** Latency in milliseconds (rounded). Undefined when not measured. */
  latencyMs?: number;
  /** ISO timestamp when this check was last evaluated. */
  lastCheckedAt: string;
  /** Short human-readable explanation (set on degraded/unhealthy/unknown). */
  message?: string;
  /** Free-form structured details (metrics, error codes, provider name, etc.). */
  details?: Record<string, unknown>;
}

/** The system-wide health snapshot returned by /api/health. */
export interface SystemHealth {
  /** Worst-of status across all checks (with 'unknown' not dragging it down). */
  overall: HealthStatus;
  /** All individual check results, in stable order. */
  checks: HealthCheck[];
  /** App version from package.json (best-effort). */
  version: string;
  /** Process uptime in seconds. */
  uptime: number;
  /** ISO timestamp when this snapshot was generated. */
  timestamp: string;
}

/** Severity levels for alerts, escalating. */
export type AlertLevel = 'info' | 'warning' | 'error' | 'critical';

/** A single alert raised by an alert rule. */
export interface Alert {
  /** Stable unique id (rule-id + timestamp hash, persisted to Firestore). */
  id: string;
  /** Severity — drives notification channel + paging. */
  level: AlertLevel;
  /** Short human-readable title. */
  title: string;
  /** Detailed message describing what happened. */
  message: string;
  /** Which check / subsystem raised this alert (e.g. 'firestore', 'billing'). */
  source: string;
  /** ISO timestamp when the alert was first raised. */
  timestamp: string;
  /** ISO timestamp when a human acknowledged the alert (undefined until acked). */
  acknowledgedAt?: string;
  /** UID of the user who acknowledged the alert. */
  acknowledgedBy?: string;
  /** ISO timestamp when the underlying condition cleared (undefined if still active). */
  resolvedAt?: string;
  /** Free-form structured metadata (rule id, metric values, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * A rule that, when its condition matches the current SystemHealth, raises an
 * Alert. Rules are pure functions — they must NOT have side effects. The
 * alerting layer handles cooldown + persistence.
 */
export interface AlertRule {
  /** Stable id (used as the alert id prefix + cooldown key). */
  id: string;
  /** Human-readable rule name. */
  name: string;
  /** Returns true when the alert should fire. */
  condition: (health: SystemHealth) => boolean;
  /** Severity to assign to alerts raised by this rule. */
  level: AlertLevel;
  /** Message body to use when raising an alert. */
  message: string;
  /**
   * Minimum time between two alerts from the same rule, in milliseconds.
   * Prevents alert storms when a flapping condition fires repeatedly.
   */
  cooldownMs: number;
}

/** A summary of historical health readings for the dashboard. */
export interface HealthSummary {
  /** Fraction of historical readings where overall === 'healthy' (0..1). */
  uptime: number;
  /** Per-check p95 latency in ms (only for checks that report latencyMs). */
  p95LatencyByCheck: Record<string, number>;
  /** List of incidents (consecutive non-healthy readings) detected in history. */
  incidents: {
    /** ISO timestamp when the incident started. */
    start: string;
    /** ISO timestamp when the incident ended (last non-healthy reading). */
    end: string;
    /** Duration of the incident in seconds. */
    duration: number;
    /** Name of the check (or 'overall') that was non-healthy. */
    check: string;
    /** Worst status observed during the incident. */
    status: HealthStatus;
  }[];
  /** Number of historical readings used to compute this summary. */
  sampleCount: number;
  /** Time range covered by the summary, in hours. */
  hours: number;
}

/** Subscription callback for real-time alert delivery. */
export type AlertSubscription = (alert: Alert) => void;
