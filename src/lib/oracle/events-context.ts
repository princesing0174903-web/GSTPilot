// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — PHASE 2B · MODULE 5 — Oracle Live Events Context™
//
// Auto-loads recent business events, latest sync state, data quality, and pending
// alerts into every Oracle prompt. Renders a concise markdown block so Oracle can
// answer questions like "Anything important today?" from real live events.
//
// Mirrors the pattern of lib/oracle/graph.ts (load + render). Never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { listRecentEvents } from '@/lib/connections/change-detection';
import { getAlertSummary, listAlerts } from '@/lib/connections/alerts';
import { getValidationSummary } from '@/lib/connections/validation';
import { getAutoSyncStatus } from '@/lib/connections/auto-sync';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LiveEventsContext {
  recentEvents: Array<{
    type: string;
    severity: string;
    title: string;
    description?: string;
    createdAt: string;
  }>;
  latestSync?: {
    lastSyncedAt?: string;
    nextSyncAt?: string;
    autoSyncEnabled: boolean;
    dueNow: number;
    queueDepth: number;
  };
  dataQuality: {
    score: number;
    status: string;
    errorCount: number;
    warningCount: number;
    duplicateCount: number;
  };
  pendingAlerts: {
    total: number;
    open: number;
    critical: number;
    warning: number;
    positive: number;
    topAlerts: Array<{
      type: string;
      severity: string;
      title: string;
      message: string;
    }>;
  };
  newNotices: number;
  itcChanges: Array<{ direction: 'up' | 'down'; title: string; description?: string }>;
  cashChanges: Array<{ title: string; description?: string }>;
  revenueChanges: Array<{ title: string; description?: string }>;
  collectedAt: string;
}

// ─── Public: load the live events context ──────────────────────────────────────

export async function loadLiveEventsContext(): Promise<LiveEventsContext | null> {
  try {
    // Check if any connections exist — if not, skip
    const connCount = await db.businessConnection.count({ where: { status: 'active' } });
    if (connCount === 0) return null;

    // Load everything in parallel
    const [recentEvents, alertSummary, topAlerts, validation, autoSyncStatus] = await Promise.all([
      listRecentEvents(20),
      getAlertSummary(),
      listAlerts({ limit: 5 }),
      getValidationSummary(),
      getAutoSyncStatus(),
    ]);

    // Categorize recent events by type for the context block
    const newNotices = recentEvents.filter((e) => e.type === 'NEW_NOTICE').length;
    const itcChanges = recentEvents
      .filter((e) => e.type === 'ITC_INCREASED' || e.type === 'ITC_DECREASED')
      .slice(0, 3)
      .map((e) => ({
        direction: (e.type === 'ITC_INCREASED' ? 'up' : 'down') as 'up' | 'down',
        title: e.title,
        description: e.description,
      }));
    const cashChanges = recentEvents
      .filter((e) => e.type === 'CASH_POSITION_CHANGED')
      .slice(0, 3)
      .map((e) => ({ title: e.title, description: e.description }));
    const revenueChanges = recentEvents
      .filter((e) => e.type === 'COLLECTION_DROPPED' || e.type === 'COLLECTION_SURGE' || e.type === 'REVENUE_CHANGED')
      .slice(0, 3)
      .map((e) => ({ title: e.title, description: e.description }));

    // Latest sync info
    const latestSync = {
      lastSyncedAt: autoSyncStatus.lastRunAt,
      nextSyncAt: autoSyncStatus.nextRunAt,
      autoSyncEnabled: autoSyncStatus.autoSyncEnabled > 0,
      dueNow: autoSyncStatus.dueNow,
      queueDepth: autoSyncStatus.queueDepth,
    };

    return {
      recentEvents: recentEvents.slice(0, 10).map((e) => ({
        type: e.type,
        severity: e.severity,
        title: e.title,
        description: e.description,
        createdAt: e.createdAt,
      })),
      latestSync,
      dataQuality: {
        score: validation.dataQualityScore,
        status: validation.status,
        errorCount: validation.errorCount,
        warningCount: validation.warningCount,
        duplicateCount: validation.duplicateCount,
      },
      pendingAlerts: {
        total: alertSummary.total,
        open: alertSummary.open,
        critical: alertSummary.critical,
        warning: alertSummary.warning,
        positive: alertSummary.positive,
        topAlerts: topAlerts.map((a) => ({
          type: a.type,
          severity: a.severity,
          title: a.title,
          message: a.message,
        })),
      },
      newNotices,
      itcChanges,
      cashChanges,
      revenueChanges,
      collectedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('loadLiveEventsContext error:', err);
    return null;
  }
}

// ─── Public: render the events context as a markdown block ─────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  positive: '🟢',
  info: '🔵',
};

export function renderEventsBlock(ctx: LiveEventsContext): string {
  const lines: string[] = ['## LIVE BUSINESS EVENTS'];

  // Pending alerts summary
  const a = ctx.pendingAlerts;
  if (a.open > 0) {
    const parts: string[] = [];
    if (a.critical > 0) parts.push(`🔴 ${a.critical} critical`);
    if (a.warning > 0) parts.push(`🟡 ${a.warning} warning`);
    if (a.positive > 0) parts.push(`🟢 ${a.positive} positive`);
    lines.push(`**Pending alerts:** ${a.open} open (${parts.join(', ')})`);
    for (const alert of a.topAlerts.slice(0, 5)) {
      lines.push(`- ${SEVERITY_EMOJI[alert.severity] ?? '⚪'} ${alert.title}`);
    }
  } else {
    lines.push('**Pending alerts:** None — all clear.');
  }

  // Recent events (last 24h, top 8)
  if (ctx.recentEvents.length > 0) {
    lines.push('');
    lines.push('**Recent events:**');
    for (const e of ctx.recentEvents.slice(0, 8)) {
      const emoji = SEVERITY_EMOJI[e.severity] ?? '⚪';
      lines.push(`- ${emoji} ${e.title} (${timeAgo(e.createdAt)})`);
    }
  }

  // Specific change categories
  if (ctx.newNotices > 0) {
    lines.push('');
    lines.push(`**New GST notices:** ${ctx.newNotices} new notice${ctx.newNotices === 1 ? '' : 's'} received in the latest sync.`);
  }

  if (ctx.itcChanges.length > 0) {
    lines.push('');
    lines.push('**ITC changes:**');
    for (const c of ctx.itcChanges) {
      lines.push(`- ${c.direction === 'up' ? '📈' : '📉'} ${c.title}`);
    }
  }

  if (ctx.cashChanges.length > 0) {
    lines.push('');
    lines.push('**Cash position changes:**');
    for (const c of ctx.cashChanges) {
      lines.push(`- ${c.title}`);
    }
  }

  if (ctx.revenueChanges.length > 0) {
    lines.push('');
    lines.push('**Revenue / collection changes:**');
    for (const c of ctx.revenueChanges) {
      lines.push(`- ${c.title}`);
    }
  }

  // Data quality + sync status
  lines.push('');
  lines.push(`**Data quality:** ${ctx.dataQuality.score}/100 (${ctx.dataQuality.status}) — ${ctx.dataQuality.errorCount} errors, ${ctx.dataQuality.warningCount} warnings, ${ctx.dataQuality.duplicateCount} duplicates.`);

  if (ctx.latestSync) {
    const syncParts: string[] = [];
    if (ctx.latestSync.lastSyncedAt) {
      syncParts.push(`last sync ${timeAgo(ctx.latestSync.lastSyncedAt)}`);
    }
    if (ctx.latestSync.nextSyncAt) {
      syncParts.push(`next sync in ${timeAgo(ctx.latestSync.nextSyncAt).replace(' ago', '')}`);
    }
    if (ctx.latestSync.autoSyncEnabled) {
      syncParts.push('auto-sync ON');
    }
    if (syncParts.length > 0) {
      lines.push(`**Sync status:** ${syncParts.join(' · ')}`);
    }
  }

  return lines.join('\n');
}
