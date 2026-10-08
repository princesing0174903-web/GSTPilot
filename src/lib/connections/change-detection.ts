// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — PHASE 2B · MODULE 3 — Change Detection Engine™
//
// Snapshots key business metrics before & after every sync, diffs them, and
// generates typed BusinessEvent rows. Events flow into the Alert Center (M4)
// and the Oracle Live Events Context (M5).
//
// Event types:
//   NEW_NOTICE            — a new GST notice appeared
//   NOTICE_RESOLVED       — a notice was closed/responded
//   ITC_INCREASED         — available ITC went up
//   ITC_DECREASED         — available ITC went down
//   RETURN_OVERDUE        — a return tipped into 'overdue'
//   RETURN_FILED          — a return was filed
//   NEW_RETURN            — a new return period appeared
//   COLLECTION_DROPPED    — monthly collections dropped > threshold
//   COLLECTION_SURGE      — monthly collections surged
//   CASH_POSITION_CHANGED — cash balance moved > threshold
//   REVENUE_CHANGED       — revenue changed materially
//   COMPLIANCE_CHANGED    — compliance score moved materially
//   SYNC_COMPLETED        — a sync finished successfully
//   SYNC_FAILED           — a sync failed
//
// Snapshot persistence: stored in OracleMemory(category='sync_state', key='snapshot')
// so it survives process restarts. Never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { loadOracleLiveData } from './index';
import type { OracleLiveData } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BusinessEventType =
  | 'NEW_NOTICE'
  | 'NOTICE_RESOLVED'
  | 'ITC_INCREASED'
  | 'ITC_DECREASED'
  | 'RETURN_OVERDUE'
  | 'RETURN_FILED'
  | 'NEW_RETURN'
  | 'COLLECTION_DROPPED'
  | 'COLLECTION_SURGE'
  | 'CASH_POSITION_CHANGED'
  | 'REVENUE_CHANGED'
  | 'COMPLIANCE_CHANGED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED';

export type EventSeverity = 'info' | 'warning' | 'critical' | 'positive';

export interface BusinessEventRow {
  id: string;
  type: BusinessEventType;
  severity: EventSeverity;
  title: string;
  description?: string;
  sourceConnectionId?: string;
  payload?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface BusinessSnapshot {
  complianceScore: number;
  pendingReturns: number;
  overdueReturns: number;
  filedReturns: number;
  activeNotices: number;
  itcAvailable: number;
  cashAvailable: number;
  monthlyCollections: number;
  monthlyExpenses: number;
  noticeNumbers: string[];
  returnPeriods: string[];
  capturedAt: string;
}

// ─── Snapshot capture ──────────────────────────────────────────────────────────

async function captureSnapshot(): Promise<BusinessSnapshot | null> {
  try {
    const live = await loadOracleLiveData();
    if (!live.hasGstn && !live.hasBank) return null;

    const compliance = live.compliance;
    const bank = live.bank;

    // Gather notice identifiers from the GSTN dataset
    let noticeNumbers: string[] = [];
    let returnPeriods: string[] = [];
    if (live.hasGstn && compliance) {
      // Re-derive from the generated dataset (canonical source).
      // NOTE: `generateGstnDataset` now returns null (real GSTN API pending),
      // so noticeNumbers + returnPeriods stay empty until a real GSTN client
      // populates them. The snapshot still captures compliance metrics below.
      try {
        const conn = await db.businessConnection.findFirst({
          where: { type: 'gstn', status: 'active' },
        });
        if (conn?.gstin) {
          const { generateGstnDataset } = await import('./gstn-data');
          const ds = generateGstnDataset(conn.gstin);
          if (ds) {
            noticeNumbers = ds.notices.map((n) => n.noticeNumber);
            returnPeriods = ds.gstrFilings.map((f) => `${f.returnType}:${f.period}`);
          }
        }
      } catch {
        /* ignore */
      }
    }

    return {
      complianceScore: compliance?.score ?? 0,
      pendingReturns: compliance?.pendingReturns ?? 0,
      overdueReturns: compliance?.overdueReturns ?? 0,
      filedReturns: compliance?.filedReturns ?? 0,
      activeNotices: compliance?.activeNotices ?? 0,
      itcAvailable: compliance?.itcAvailable ?? 0,
      cashAvailable: bank?.cashAvailable ?? 0,
      monthlyCollections: bank?.monthlyCollections ?? 0,
      monthlyExpenses: bank?.monthlyExpenses ?? 0,
      noticeNumbers,
      returnPeriods,
      capturedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('captureSnapshot error:', err);
    return null;
  }
}

// ─── Snapshot persistence ──────────────────────────────────────────────────────

const SNAPSHOT_KEY = 'snapshot';
const SNAPSHOT_CATEGORY = 'sync_state';

async function loadPreviousSnapshot(): Promise<BusinessSnapshot | null> {
  try {
    const row = await db.oracleMemory.findUnique({
      where: { category_key: { category: SNAPSHOT_CATEGORY, key: SNAPSHOT_KEY } },
    });
    if (!row) return null;
    return JSON.parse(row.value) as BusinessSnapshot;
  } catch {
    return null;
  }
}

async function saveSnapshot(snap: BusinessSnapshot): Promise<void> {
  try {
    await db.oracleMemory.upsert({
      where: { category_key: { category: SNAPSHOT_CATEGORY, key: SNAPSHOT_KEY } },
      create: {
        category: SNAPSHOT_CATEGORY,
        key: SNAPSHOT_KEY,
        value: JSON.stringify(snap),
        source: 'system',
      },
      update: { value: JSON.stringify(snap), updatedAt: new Date() },
    });
  } catch (err) {
    console.error('saveSnapshot error:', err);
  }
}

// ─── Diff + event generation ───────────────────────────────────────────────────

// Thresholds — what constitutes a "material" change
const ITC_THRESHOLD = 10000; // ₹10K
const CASH_THRESHOLD_PCT = 10; // 10% move
const COLLECTION_THRESHOLD_PCT = 15; // 15% move
const COMPLIANCE_THRESHOLD = 5; // 5-point move

interface DetectedChange {
  type: BusinessEventType;
  severity: EventSeverity;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
}

function diffSnapshots(
  prev: BusinessSnapshot,
  curr: BusinessSnapshot,
): DetectedChange[] {
  const changes: DetectedChange[] = [];

  // ── New notices ──
  const prevNoticeSet = new Set(prev.noticeNumbers);
  const newNotices = curr.noticeNumbers.filter((n) => !prevNoticeSet.has(n));
  for (const noticeNo of newNotices) {
    changes.push({
      type: 'NEW_NOTICE',
      severity: 'critical',
      title: `New GST notice received: ${noticeNo}`,
      description: `A new GST notice (${noticeNo}) was detected in the latest sync.`,
      payload: { noticeNumber: noticeNo },
    });
  }

  // ── Resolved notices ──
  const currNoticeSet = new Set(curr.noticeNumbers);
  const resolvedNotices = prev.noticeNumbers.filter((n) => !currNoticeSet.has(n));
  if (resolvedNotices.length > 0) {
    changes.push({
      type: 'NOTICE_RESOLVED',
      severity: 'positive',
      title: `${resolvedNotices.length} notice${resolvedNotices.length === 1 ? '' : 's'} resolved`,
      description: `Notice(s) ${resolvedNotices.join(', ')} no longer appear as active.`,
      payload: { noticeNumbers: resolvedNotices },
    });
  }

  // ── ITC changes ──
  const itcDelta = curr.itcAvailable - prev.itcAvailable;
  if (Math.abs(itcDelta) >= ITC_THRESHOLD) {
    if (itcDelta > 0) {
      changes.push({
        type: 'ITC_INCREASED',
        severity: 'positive',
        title: `ITC increased by ₹${formatINR(itcDelta)}`,
        description: `Available ITC rose from ₹${formatINR(prev.itcAvailable)} to ₹${formatINR(curr.itcAvailable)}.`,
        payload: { oldValue: prev.itcAvailable, newValue: curr.itcAvailable, delta: itcDelta },
      });
    } else {
      changes.push({
        type: 'ITC_DECREASED',
        severity: 'warning',
        title: `ITC decreased by ₹${formatINR(Math.abs(itcDelta))}`,
        description: `Available ITC fell from ₹${formatINR(prev.itcAvailable)} to ₹${formatINR(curr.itcAvailable)}.`,
        payload: { oldValue: prev.itcAvailable, newValue: curr.itcAvailable, delta: itcDelta },
      });
    }
  }

  // ── Overdue returns ──
  if (curr.overdueReturns > prev.overdueReturns) {
    const newOverdue = curr.overdueReturns - prev.overdueReturns;
    changes.push({
      type: 'RETURN_OVERDUE',
      severity: 'critical',
      title: `${newOverdue} return${newOverdue === 1 ? '' : 's'} became overdue`,
      description: `Overdue returns increased from ${prev.overdueReturns} to ${curr.overdueReturns}. Late fees are accruing.`,
      payload: { oldValue: prev.overdueReturns, newValue: curr.overdueReturns },
    });
  }

  // ── Filed returns ──
  if (curr.filedReturns > prev.filedReturns) {
    const newFiled = curr.filedReturns - prev.filedReturns;
    changes.push({
      type: 'RETURN_FILED',
      severity: 'positive',
      title: `${newFiled} return${newFiled === 1 ? '' : 's'} filed`,
      description: `Filed returns increased from ${prev.filedReturns} to ${curr.filedReturns}.`,
      payload: { oldValue: prev.filedReturns, newValue: curr.filedReturns },
    });
  }

  // ── New return periods ──
  const prevReturnSet = new Set(prev.returnPeriods);
  const newReturns = curr.returnPeriods.filter((r) => !prevReturnSet.has(r));
  if (newReturns.length > 0) {
    changes.push({
      type: 'NEW_RETURN',
      severity: 'info',
      title: `${newReturns.length} new return period${newReturns.length === 1 ? '' : 's'} detected`,
      description: `New filing period(s): ${newReturns.slice(0, 5).join(', ')}.`,
      payload: { newPeriods: newReturns },
    });
  }

  // ── Collections dropped/surged ──
  if (prev.monthlyCollections > 0) {
    const collPct = ((curr.monthlyCollections - prev.monthlyCollections) / prev.monthlyCollections) * 100;
    if (collPct <= -COLLECTION_THRESHOLD_PCT) {
      changes.push({
        type: 'COLLECTION_DROPPED',
        severity: 'warning',
        title: `Collections dropped ${Math.abs(Math.round(collPct))}%`,
        description: `Monthly collections fell from ₹${formatINR(prev.monthlyCollections)} to ₹${formatINR(curr.monthlyCollections)}.`,
        payload: { oldValue: prev.monthlyCollections, newValue: curr.monthlyCollections, deltaPct: Math.round(collPct) },
      });
    } else if (collPct >= COLLECTION_THRESHOLD_PCT) {
      changes.push({
        type: 'COLLECTION_SURGE',
        severity: 'positive',
        title: `Collections surged ${Math.round(collPct)}%`,
        description: `Monthly collections rose from ₹${formatINR(prev.monthlyCollections)} to ₹${formatINR(curr.monthlyCollections)}.`,
        payload: { oldValue: prev.monthlyCollections, newValue: curr.monthlyCollections, deltaPct: Math.round(collPct) },
      });
    }
  }

  // ── Cash position changed ──
  if (prev.cashAvailable > 0) {
    const cashPct = ((curr.cashAvailable - prev.cashAvailable) / prev.cashAvailable) * 100;
    if (Math.abs(cashPct) >= CASH_THRESHOLD_PCT) {
      const positive = cashPct > 0;
      changes.push({
        type: 'CASH_POSITION_CHANGED',
        severity: positive ? 'positive' : 'warning',
        title: `Cash balance ${positive ? 'increased' : 'decreased'} ${Math.abs(Math.round(cashPct))}%`,
        description: `Cash position moved from ₹${formatINR(prev.cashAvailable)} to ₹${formatINR(curr.cashAvailable)}.`,
        payload: { oldValue: prev.cashAvailable, newValue: curr.cashAvailable, deltaPct: Math.round(cashPct) },
      });
    }
  }

  // ── Compliance score changed ──
  const compDelta = curr.complianceScore - prev.complianceScore;
  if (Math.abs(compDelta) >= COMPLIANCE_THRESHOLD) {
    changes.push({
      type: 'COMPLIANCE_CHANGED',
      severity: compDelta > 0 ? 'positive' : 'warning',
      title: `Compliance score ${compDelta > 0 ? 'improved' : 'fell'} ${Math.abs(compDelta)} points`,
      description: `Compliance score moved from ${prev.complianceScore} to ${curr.complianceScore}.`,
      payload: { oldValue: prev.complianceScore, newValue: curr.complianceScore, delta: compDelta },
    });
  }

  return changes;
}

// ─── Sync outcome events ───────────────────────────────────────────────────────

export async function recordSyncOutcome(
  connectionId: string,
  success: boolean,
  recordsImported: number,
  errorsCount: number,
): Promise<void> {
  try {
    const conn = await db.businessConnection.findUnique({ where: { id: connectionId } });
    const provider = conn?.provider ?? 'Unknown';
    if (success) {
      await db.businessEvent.create({
        data: {
          type: 'SYNC_COMPLETED',
          severity: 'info',
          title: `${provider} sync completed`,
          description: `Synced ${recordsImported} records successfully${errorsCount > 0 ? ` with ${errorsCount} errors` : ''}.`,
          sourceConnectionId: connectionId,
          payload: JSON.stringify({ recordsImported, errorsCount, provider }),
        },
      });
    } else {
      await db.businessEvent.create({
        data: {
          type: 'SYNC_FAILED',
          severity: 'critical',
          title: `${provider} sync failed`,
          description: `Sync failed after multiple attempts. Manual intervention may be required.`,
          sourceConnectionId: connectionId,
          payload: JSON.stringify({ recordsImported, errorsCount, provider }),
        },
      });
    }
  } catch (err) {
    console.error('recordSyncOutcome error:', err);
  }
}

// ─── Public: detect + persist changes ──────────────────────────────────────────

/**
 * Captures the current snapshot, diffs against the previous one, persists all
 * detected changes as BusinessEvent rows, and saves the new snapshot.
 * Returns the list of newly-created events. Never throws.
 */
export async function detectChanges(
  sourceConnectionId?: string,
): Promise<BusinessEventRow[]> {
  try {
    const curr = await captureSnapshot();
    if (!curr) return [];

    const prev = await loadPreviousSnapshot();

    // First-ever snapshot — no diff possible, just save and return.
    if (!prev) {
      await saveSnapshot(curr);
      return [];
    }

    const changes = diffSnapshots(prev, curr);

    // Persist events
    const created: BusinessEventRow[] = [];
    for (const c of changes) {
      try {
        const row = await db.businessEvent.create({
          data: {
            type: c.type,
            severity: c.severity,
            title: c.title,
            description: c.description,
            sourceConnectionId: sourceConnectionId ?? null,
            payload: c.payload ? JSON.stringify(c.payload) : null,
          },
        });
        created.push({
          id: row.id,
          type: row.type as BusinessEventType,
          severity: row.severity as EventSeverity,
          title: row.title,
          description: row.description ?? undefined,
          sourceConnectionId: row.sourceConnectionId ?? undefined,
          payload: row.payload ? safeParse(row.payload) : undefined,
          isRead: row.isRead,
          createdAt: row.createdAt.toISOString(),
        });
      } catch (err) {
        console.error('detectChanges create event error:', err);
      }
    }

    // Save the new snapshot
    await saveSnapshot(curr);

    return created;
  } catch (err) {
    console.error('detectChanges error:', err);
    return [];
  }
}

// ─── Public: list recent events ────────────────────────────────────────────────

export async function listRecentEvents(limit = 50): Promise<BusinessEventRow[]> {
  try {
    const rows = await db.businessEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type as BusinessEventType,
      severity: r.severity as EventSeverity,
      title: r.title,
      description: r.description ?? undefined,
      sourceConnectionId: r.sourceConnectionId ?? undefined,
      payload: r.payload ? safeParse(r.payload) : undefined,
      isRead: r.isRead,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('listRecentEvents error:', err);
    return [];
  }
}

// ─── Public: mark event as read ────────────────────────────────────────────────

export async function markEventRead(eventId: string): Promise<void> {
  try {
    await db.businessEvent.update({
      where: { id: eventId },
      data: { isRead: true, readAt: new Date() },
    });
  } catch (err) {
    console.error('markEventRead error:', err);
  }
}

export async function markAllEventsRead(): Promise<void> {
  try {
    await db.businessEvent.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  } catch (err) {
    console.error('markAllEventsRead error:', err);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('en-IN');
}

function safeParse(s: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
