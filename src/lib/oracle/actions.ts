// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Action Engine (Autopilot Actions)
//
// Turns Oracle's answers into real, executable actions:
//   • generate reports
//   • create reminders
//   • prepare GST return drafts
//   • recover collections
//   • generate forecasts
//   • create checklists
//
// Two responsibilities:
//   1. detectActions(userMessage, oracleResponse, liveData) — scan the exchange
//      and propose 0–N actions as cards under the Oracle message.
//   2. executeAction(action) — persist + (where applicable) create real records
//      (AITask, Notification, ExecutiveReport) so the action is traceable.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { OracleLiveData } from '@/lib/connections/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OracleActionType =
  | 'reminder'
  | 'report'
  | 'return_draft'
  | 'collection_recovery'
  | 'forecast'
  | 'checklist'
  | 'task';

export interface OracleActionIntent {
  type: OracleActionType;
  title: string;
  description: string;
  /** The payload we'd persist if executed. */
  payload: Record<string, unknown>;
}

export interface ExecutedOracleAction {
  id: string;
  type: OracleActionType;
  title: string;
  status: 'created' | 'executed' | 'failed';
}

// ─── Intent detection ─────────────────────────────────────────────────────────

const SIGNATURES: {
  type: OracleActionType;
  patterns: RegExp[];
  build: (ctx: ActionContext) => Omit<OracleActionIntent, 'type'>;
}[] = [
  // Return preparation
  {
    type: 'return_draft',
    patterns: [
      /\bgstr-?3b\b/i, /\bgstr-?1\b/i, /\bfile (my |the )?return/i, /\bprepare (my |the )?(gstr|return)/i,
      /\breturn (draft|preparation)/i, /\b3b filing/i,
    ],
    build: (ctx) => ({
      title: 'Prepare GSTR-3B Return Draft',
      description: `Draft GSTR-3B for the current period${
        ctx.liveData?.compliance?.nextDueDate ? ` (due ${ctx.liveData.compliance.nextDueDate})` : ''
      } from your live invoices and ITC data.`,
      payload: {
        returnType: 'GSTR-3B',
        period: new Date().toISOString().slice(0, 7),
        dueDate: ctx.liveData?.compliance?.nextDueDate,
        pendingReturns: ctx.liveData?.compliance?.pendingReturns ?? 0,
      },
    }),
  },
  // Reminders
  {
    type: 'reminder',
    patterns: [
      /\bremind me\b/i, /\bset a reminder\b/i, /\bdue date\b/i, /\bdeadline\b/i,
      /\bdon't forget\b/i, /\bnotify me\b/i,
    ],
    build: (ctx) => ({
      title: 'Create Filing Reminder',
      description: ctx.liveData?.compliance?.nextDueDate
        ? `Remind me before the next GST due date (${ctx.liveData.compliance.nextDueDate}).`
        : 'Create a GST compliance reminder.',
      payload: {
        trigger: 'before_due_date',
        dueDate: ctx.liveData?.compliance?.nextDueDate,
        channel: 'in_app',
      },
    }),
  },
  // Reports
  {
    type: 'report',
    patterns: [
      /\bgenerate (a |the )?report/i, /\bmonthly report/i, /\breconciliation report/i,
      /\bitc report/i, /\bcompliance report/i, /\brevenue report/i, /\bcash flow report/i,
    ],
    build: (ctx) => ({
      title: 'Generate Compliance & Cash-Flow Report',
      description:
        'Compile a consolidated report covering pending returns, ITC position, cash flow, and risky clients from your live data.',
      payload: {
        reportType: 'compliance_cashflow',
        period: new Date().toISOString().slice(0, 7),
        healthScore: ctx.liveData?.health?.overall,
        pendingReturns: ctx.liveData?.compliance?.pendingReturns ?? 0,
      },
    }),
  },
  // Collection recovery
  {
    type: 'collection_recovery',
    patterns: [
      /\bcollection/i, /\brecover/i, /\breceivable/i, /\bpayment due/i, /\bclient .*(owe|due|unpaid)/i,
      /\bwhy did collections drop/i, /\bcollections? dropped/i,
    ],
    build: (ctx) => {
      const risky = ctx.liveData?.riskyClients ?? [];
      return {
        title: 'Recover Outstanding Collections',
        description: risky.length
          ? `Initiate recovery follow-ups for ${risky.length} at-risk client(s): ${risky.slice(0, 3).map((r) => r.name).join(', ')}${risky.length > 3 ? '…' : ''}.`
          : 'Open the collections recovery workflow to follow up on outstanding receivables.',
        payload: {
          riskyClients: risky.slice(0, 8),
          monthlyCollections: ctx.liveData?.bank?.monthlyCollections ?? 0,
          changePct: ctx.liveData?.bank?.collectionChangePct ?? 0,
        },
      };
    },
  },
  // Forecast
  {
    type: 'forecast',
    patterns: [
      /\bforecast/i, /\bpredict/i, /\bnext month/i, /\brevenue projection/i, /\bcash projection/i,
      /\bhow much cash will/i, /\bexpected revenue/i,
    ],
    build: (ctx) => ({
      title: 'Generate Revenue & Cash Forecast',
      description:
        'Project next-month revenue and cash position from your latest collections, growth score, and expense trend.',
      payload: {
        basis: 'last_3_months',
        growthScore: ctx.liveData?.health?.growth ?? 0,
        cashAvailable: ctx.liveData?.bank?.cashAvailable ?? 0,
        collectionChangePct: ctx.liveData?.bank?.collectionChangePct ?? 0,
      },
    }),
  },
  // Checklist
  {
    type: 'checklist',
    patterns: [
      /\bchecklist/i, /\bwhat should i do today/i, /\bwhat to do\b/i, /\bdaily actions/i,
      /\bpriority list/i, /\baction items/i, /\bto-do\b/i,
    ],
    build: (ctx) => {
      const items: string[] = [];
      if ((ctx.liveData?.compliance?.overdueReturns ?? 0) > 0)
        items.push(`File ${ctx.liveData!.compliance!.overdueReturns} overdue return(s)`);
      if ((ctx.liveData?.compliance?.pendingReturns ?? 0) > 0)
        items.push(`Prepare ${ctx.liveData!.compliance!.pendingReturns} pending return(s)`);
      if ((ctx.liveData?.compliance?.activeNotices ?? 0) > 0)
        items.push(`Respond to ${ctx.liveData!.compliance!.activeNotices} active GST notice(s)`);
      if ((ctx.liveData?.riskyClients?.length ?? 0) > 0)
        items.push(`Follow up with ${ctx.liveData!.riskyClients!.length} risky client(s)`);
      items.push('Reconcile GSTR-2B vs purchase register');
      return {
        title: 'Create Today\'s Action Checklist',
        description: `Generate a prioritized checklist with ${items.length} items based on your live compliance and cash position.`,
        payload: { items, healthScore: ctx.liveData?.health?.overall },
      };
    },
  },
];

export interface ActionContext {
  userMessage: string;
  oracleResponse: string;
  liveData?: OracleLiveData;
}

/**
 * Scan the user/oracle exchange and propose actionable intents.
 * Returns up to 3 actions, deduped by type, ordered by salience (user message
 * matches rank higher than response matches).
 */
export function detectActions(ctx: ActionContext): OracleActionIntent[] {
  const user = ctx.userMessage ?? '';
  const resp = ctx.oracleResponse ?? '';
  const found = new Map<OracleActionType, OracleActionIntent>();

  for (const sig of SIGNATURES) {
    const userHit = sig.patterns.some((p) => p.test(user));
    const respHit = sig.patterns.some((p) => p.test(resp));
    if (!userHit && !respHit) continue;
    const built = sig.build(ctx);
    found.set(sig.type, { type: sig.type, ...built });
  }

  // Always offer a checklist if there are real live-data issues, even without an explicit ask.
  const hasLiveIssues =
    (ctx.liveData?.compliance?.overdueReturns ?? 0) > 0 ||
    (ctx.liveData?.compliance?.activeNotices ?? 0) > 0 ||
    (ctx.liveData?.riskyClients?.length ?? 0) > 0;
  if (hasLiveIssues && !found.has('checklist')) {
    const sig = SIGNATURES.find((s) => s.type === 'checklist')!;
    found.set('checklist', { type: 'checklist', ...sig.build(ctx) });
  }

  return Array.from(found.values()).slice(0, 3);
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Persist + execute an action. Creates a traceable OracleAction row and, where
 * applicable, real downstream records (AITask, Notification, ExecutiveReport).
 */
export async function executeAction(
  intent: OracleActionIntent,
  messageId?: string,
): Promise<ExecutedOracleAction> {
  const row = await db.oracleAction.create({
    data: {
      type: intent.type,
      title: intent.title,
      description: intent.description,
      status: 'created',
      payload: JSON.stringify(intent.payload),
      messageId,
    },
  });

  try {
    switch (intent.type) {
      case 'reminder': {
        const dueDate = (intent.payload.dueDate as string | undefined) ?? undefined;
        await db.notification.create({
          data: {
            type: 'reminder',
            category: 'compliance',
            title: intent.title,
            message: intent.description,
            priority: 'high',
            scheduledAt: dueDate ? new Date(dueDate) : new Date(Date.now() + 86_400_000),
            isRead: false,
            dismissed: false,
          },
        });
        break;
      }
      case 'checklist':
      case 'task':
      case 'return_draft':
      case 'collection_recovery': {
        const items = (intent.payload.items as string[] | undefined) ?? [intent.title];
        for (const title of items.slice(0, 8)) {
          await db.aITask.create({
            data: {
              source: 'oracle',
              sourceType: intent.type,
              title,
              description: intent.description,
              priority: intent.type === 'collection_recovery' ? 'high' : 'medium',
              status: 'pending',
              autoAssigned: true,
              dueDate: (intent.payload.dueDate as string | undefined) ?? undefined,
            },
          });
        }
        break;
      }
      case 'report': {
        await db.executiveReport.create({
          data: {
            reportType: (intent.payload.reportType as string) ?? 'oracle_action',
            title: intent.title,
            description: intent.description,
            period: (intent.payload.period as string) ?? new Date().toISOString().slice(0, 7),
            data: JSON.stringify(intent.payload),
            format: 'pdf',
            status: 'generated',
            generatedBy: 'oracle',
          },
        });
        // Track in long-term memory so Oracle "remembers" reports generated.
        const { rememberFact } = await import('./memory-store');
        await rememberFact(
          'report',
          `report-${Date.now()}`,
          `${intent.title} (${new Date().toLocaleDateString('en-IN')})`,
          'oracle_inferred',
          1,
        );
        break;
      }
      case 'forecast': {
        await db.aIPrediction.create({
          data: {
            category: 'revenue',
            period: new Date().toISOString().slice(0, 7),
            predictedValue: Number(intent.payload.cashAvailable ?? 0),
            confidence: Math.min(0.95, 0.5 + Number(intent.payload.growthScore ?? 0) / 200),
            trend: Number(intent.payload.collectionChangePct ?? 0) >= 0 ? 'up' : 'down',
            modelVersion: 'oracle-v1',
            factors: JSON.stringify(intent.payload),
          },
        });
        break;
      }
    }

    await db.oracleAction.update({
      where: { id: row.id },
      data: { status: 'executed' },
    });
    return { id: row.id, type: intent.type, title: intent.title, status: 'executed' };
  } catch {
    await db.oracleAction.update({
      where: { id: row.id },
      data: { status: 'failed' },
    });
    return { id: row.id, type: intent.type, title: intent.title, status: 'failed' };
  }
}
