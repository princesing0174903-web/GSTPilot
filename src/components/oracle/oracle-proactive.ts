'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Proactive Engine (Phase 3 — Agent Engine™)
//
// Oracle pushes intelligent notifications based on business memory — due dates,
// cash warnings, client behaviour signals, compliance drift. Like a real CFO
// who taps you on the shoulder before something breaks.
//
// This module:
//   • Generates a prioritized list of proactive notifications from Business Memory
//   • Persists dismissed notifications in localStorage (so we don't nag)
//   • Exposes a "next notification to surface" picker (deduped, not dismissed)
//
// NOTE: Pure functions only — isomorphic. Safe to import from client + server.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BusinessMemory,
  OracleActionKind,
  ProactiveNotification,
  ProactiveTone,
} from './oracle-types';

const DISMISSED_KEY = 'gstpilot.oracle.dismissed';

// ─── ID Generator ────────────────────────────────────────────────────────────

function newProactiveId(): string {
  return `proactive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Dismissed Set ───────────────────────────────────────────────────────────

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function dismissProactive(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = loadDismissed();
    set.add(key);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function isDismissed(key: string): boolean {
  return loadDismissed().has(key);
}

// ─── Notification Templates ──────────────────────────────────────────────────
// Each template produces 0..N notifications from Business Memory. The `key`
// field is a stable identifier used for deduplication + dismissal persistence.

interface ProactiveTemplate {
  key: string;
  title: string;
  detail: string;
  tone: ProactiveTone;
  actionKind?: OracleActionKind;
  actionLabel?: string;
}

function buildTemplates(b: BusinessMemory): ProactiveTemplate[] {
  const out: ProactiveTemplate[] = [];

  // 1. Overdue returns — most urgent.
  if (b.overdueReturns >= 1) {
    out.push({
      key: `overdue-returns-${b.overdueReturns}`,
      title: `${b.overdueReturns} GSTR return${b.overdueReturns === 1 ? '' : 's'} overdue`,
      detail:
        b.overdueReturns >= 3
          ? 'Late fees compounding daily. Interest under Section 50 accruing. Action needed today.'
          : 'Filing window narrowing. Block calendar time this week to clear the queue.',
      tone: b.overdueReturns >= 3 ? 'critical' : 'warning',
      actionKind: 'generate-gst-return',
      actionLabel: 'File now',
    });
  }

  // 2. Pending returns — due soon.
  if (b.pendingReturns >= 2 && b.overdueReturns === 0) {
    out.push({
      key: `pending-returns-${b.pendingReturns}`,
      title: `GSTR-3B due in ${Math.max(1, 20 - new Date().getDate())} days`,
      detail: `${b.pendingReturns} returns in the queue. Filing early avoids the last-week rush and late-fee risk.`,
      tone: 'info',
      actionKind: 'generate-gst-return',
      actionLabel: 'Prepare draft',
    });
  }

  // 3. Reconciliation mismatch — ITC at risk.
  if (b.matchPercentage < 95) {
    const atRisk = Math.round(((100 - b.matchPercentage) / 100) * b.totalTaxVolume);
    out.push({
      key: `recon-mismatch-${b.matchPercentage}`,
      title: `Match rate ${b.matchPercentage}% — ITC at risk`,
      detail:
        atRisk > 0
          ? `~₹${atRisk.toLocaleString('en-IN')} of input tax credit is exposed. A 2B reconciliation pass will recover most of it.`
          : 'Below the 95% safe threshold. Schedule a 2B reconciliation pass this week.',
      tone: 'warning',
      actionKind: 'prepare-reconciliation',
      actionLabel: 'Reconcile now',
    });
  }

  // 4. At-risk clients — collections exposure.
  if (b.atRiskClients.length >= 2) {
    out.push({
      key: `at-risk-clients-${b.atRiskClients.length}`,
      title: `${b.atRiskClients.length} clients likely to delay payments`,
      detail: `${b.atRiskClients.slice(0, 3).join(', ')} — health score below 60. Proactive outreach will improve recovery odds.`,
      tone: 'warning',
      actionKind: 'recover-collections',
      actionLabel: 'Recover collections',
    });
  }

  // 5. Cash position warning — only when we have tax volume to estimate from.
  if (b.totalTaxVolume > 0) {
    const estimated = Math.round(b.totalTaxVolume * 0.18);
    if (estimated > 0 && estimated < 150000) {
      out.push({
        key: `cash-low-${estimated}`,
        title: 'Cash may drop below ₹1.5L',
        detail: `Estimated receivable ~₹${estimated.toLocaleString('en-IN')}. Tight runway — accelerate collections or arrange a short-term credit line.`,
        tone: 'critical',
        actionKind: 'cash-flow-forecast',
        actionLabel: 'Forecast cash',
      });
    }
  }

  // 6. Portfolio health critical.
  if (b.averageHealthScore > 0 && b.averageHealthScore < 60) {
    out.push({
      key: `health-critical-${b.averageHealthScore}`,
      title: 'Portfolio health critical',
      detail: `Average client health at ${b.averageHealthScore}/100. Multiple clients drifting toward churn — review engagement quality.`,
      tone: 'critical',
      actionKind: 'create-report',
      actionLabel: 'Diagnose',
    });
  }

  // 7. Critical issues — ITC mismatches.
  if (b.criticalIssues >= 3) {
    out.push({
      key: `critical-issues-${b.criticalIssues}`,
      title: `${b.criticalIssues} reconciliation mismatches`,
      detail: 'Closing them unlocks blocked input tax credit. Worth a focused 2-hour sprint.',
      tone: 'warning',
      actionKind: 'prepare-reconciliation',
      actionLabel: 'Fix mismatches',
    });
  }

  // 8. Positive signal — collections improving (when match rate is good and overdue is 0).
  if (b.overdueReturns === 0 && b.matchPercentage >= 95 && b.filedReturns >= 2) {
    out.push({
      key: 'compliance-stable-positive',
      title: 'Compliance posture is green',
      detail: 'No overdue, no mismatch. Use the breathing room to deepen client advisory or upsell retainers.',
      tone: 'positive',
      actionKind: 'create-report',
      actionLabel: 'Plan growth',
    });
  }

  // 9. Growth signal — per-client tax volume is meaningful.
  if (b.totalTaxVolume > 0 && b.activeClients > 0) {
    const avgPerClient = Math.round(b.totalTaxVolume / Math.max(b.activeClients, 1));
    if (avgPerClient >= 25000) {
      out.push({
        key: `growth-avg-client-${avgPerClient}`,
        title: `₹${avgPerClient.toLocaleString('en-IN')} avg tax/client`,
        detail: 'Per-client tax volume is meaningful — consider a tiered advisory pricing model to capture more value.',
        tone: 'positive',
        actionKind: 'create-report',
        actionLabel: 'See pricing plan',
      });
    }
  }

  // 10. No data yet — onboarding nudge.
  if (b.clientCount === 0 && b.totalInvoices === 0) {
    out.push({
      key: 'onboard-first-client',
      title: 'Onboard your first client',
      detail: 'Oracle is ready. Onboard a client to unlock full strategic intelligence — GST, cash, compliance, growth.',
      tone: 'info',
      actionKind: 'open-clients',
      actionLabel: 'Open clients',
    });
  }

  return out;
}

// ─── Build Notifications (full list, before dedup) ──────────────────────────

export function buildProactiveNotifications(b: BusinessMemory): ProactiveNotification[] {
  const templates = buildTemplates(b);
  const now = new Date().toISOString();
  return templates.map((t) => ({
    id: newProactiveId(),
    title: t.title,
    detail: t.detail,
    tone: t.tone,
    actionKind: t.actionKind,
    actionLabel: t.actionLabel,
    createdAt: now,
  }));
}

// ─── Pick Next Notification (not dismissed) ──────────────────────────────────
// Returns the highest-priority notification the user hasn't dismissed yet.
// Priority order: critical > warning > info > positive.

const TONE_PRIORITY: Record<ProactiveTone, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

export function pickNextProactive(b: BusinessMemory): ProactiveNotification | null {
  const templates = buildTemplates(b).filter((t) => !isDismissed(t.key));
  if (templates.length === 0) return null;

  // Sort by tone priority (critical first), then by original order.
  templates.sort((a, b) => TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone]);

  const t = templates[0];
  return {
    id: newProactiveId(),
    title: t.title,
    detail: t.detail,
    tone: t.tone,
    actionKind: t.actionKind,
    actionLabel: t.actionLabel,
    createdAt: new Date().toISOString(),
  };
}
