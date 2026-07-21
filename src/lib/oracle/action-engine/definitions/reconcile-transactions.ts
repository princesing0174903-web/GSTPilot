// ═══════════════════════════════════════════════════════════════════════════════
// Action: Reconcile Transactions
// ═══════════════════════════════════════════════════════════════════════════════
//
// Reconciles bank transactions against the company ledger (invoices, payments,
// expenses). Two modes:
//   • mode='all' (default)  → reconcileAll() over every unreconciled/pending tx
//   • mode='single'         → reconcileOne() for a specific transactionId
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// The service's reconcile engine matches by amount + date + counterparty and
// returns ReconcileResult(s) with status matched / suggested / partial /
// unmatched + ranked candidates.
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankingService } from '@/lib/banking-service';
import type { ReconcileResult } from '@/lib/banking-service';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_MODES = ['all', 'single'] as const;

function tally(results: ReconcileResult[]): { matched: number; partial: number; unmatched: number; suggested: number } {
  const t = { matched: 0, partial: 0, unmatched: 0, suggested: 0 };
  for (const r of results) {
    if (r.status === 'matched') t.matched++;
    else if (r.status === 'suggested') t.suggested++;
    else if (r.status === 'partial') t.partial++;
    else if (r.status === 'unmatched') t.unmatched++;
  }
  return t;
}

export const reconcileTransactionsAction: OracleAction = {
  name: 'reconcileTransactions',
  displayName: 'Reconcile Transactions',
  description: 'Auto-reconcile bank transactions against invoices, payments, and expenses by amount + date + counterparty. Mode "all" reconciles every unreconciled transaction; mode "single" reconciles one transaction. Calls the Banking Service.',
  category: 'finance',
  icon: 'ArrowLeftRight',
  intentKeywords: [
    'reconcile transactions', 'reconcile bank', 'auto reconcile',
    'match transactions', 'reconcile all',
  ],
  paramSchema: [
    { key: 'mode', label: 'Mode', type: 'enum', required: false, options: [...VALID_MODES], description: 'all (default) or single' },
    { key: 'transactionId', label: 'Transaction ID', type: 'string', required: false, description: 'Required when mode=single — the specific transaction to reconcile' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Mode ──
    const mode = String(args.mode ?? 'all').toLowerCase();
    if (!VALID_MODES.includes(mode as any)) {
      fields.push({ key: 'mode', label: 'Mode', status: 'warn', message: `Unknown — defaulting to "all"`, resolvedValue: 'all' });
      warnings.push(`Unknown mode "${mode}" — defaulting to all.`);
      resolvedRefs.mode = 'all';
    } else {
      fields.push({ key: 'mode', label: 'Mode', status: 'ok', resolvedValue: mode });
      resolvedRefs.mode = mode;
    }

    // ── Transaction ID (required when single) ──
    const transactionId = String(args.transactionId ?? '').trim();
    if (resolvedRefs.mode === 'single' && !transactionId) {
      fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'error', message: 'Required when mode=single' });
      errors.push('Transaction ID is required when mode=single.');
    } else if (transactionId) {
      fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'ok', resolvedValue: transactionId });
      resolvedRefs.transactionId = transactionId;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const mode = refs.mode ?? 'all';
    const txId = refs.transactionId ?? String(args.transactionId ?? '');
    const fields: ActionPreview['fields'] = [
      { label: 'Scope', value: mode === 'single' ? `Single transaction (${txId || '—'})` : 'All unreconciled transactions', emphasize: true },
    ];
    if (mode === 'single' && txId) {
      fields.push({ label: 'Transaction ID', value: txId });
    }
    return {
      title: mode === 'single' ? 'Reconcile one transaction' : 'Reconcile all transactions',
      fields,
      note: 'Oracle will match transactions against invoices, payments, and expenses by amount + date + counterparty. Review the suggested matches on the Banking page before confirming any fuzzy match.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const mode = VALID_MODES.includes(String(args.mode ?? 'all').toLowerCase() as any)
      ? (String(args.mode ?? 'all').toLowerCase() as 'all' | 'single')
      : 'all';
    const transactionId = String(args.transactionId ?? '').trim();

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    if (mode === 'single') {
      if (!transactionId) {
        return { ok: false, summary: 'Cannot reconcile a single transaction without a transactionId.' };
      }
      let result: ReconcileResult;
      try {
        result = await svc.reconcileOne(orgId, transactionId);
      } catch (e) {
        const msg = (e as Error).message;
        console.error('[reconcileTransactions] reconcileOne failed:', msg);
        return { ok: false, summary: `Reconciliation failed: ${msg}` };
      }
      const t = tally([result]);
      await logActivity(orgId, 'banking', `Reconciled transaction ${transactionId}: ${result.status}${result.bestMatch ? ` (best match: ${result.bestMatch.label}, ${(result.bestMatch.confidence * 100).toFixed(0)}%)` : ''}`, {
        mode: 'single', transactionId, status: result.status,
      });
      await emitTimelineEvent({
        organizationId: orgId,
        type: 'banking.reconciled',
        title: `Transaction reconciled: ${result.status}`,
        description: `Transaction ${transactionId} → ${result.status}${result.bestMatch ? ` · best match: ${result.bestMatch.label} (${(result.bestMatch.confidence * 100).toFixed(0)}%)` : ''}.`,
        severity: result.status === 'matched' ? 'success' : 'info',
        actor: { userId: ctx.userId, userName: ctx.userId },
        metadata: { mode: 'single', transactionId, status: result.status, candidateCount: result.candidates.length },
      });
      return {
        ok: true,
        summary: `✅ Transaction **${transactionId}** → **${result.status}**${result.bestMatch ? ` — best match: **${result.bestMatch.label}** (${(result.bestMatch.confidence * 100).toFixed(0)}% confidence).` : ' (no candidates found).'} ${result.reason ? `\n\n_${result.reason}_` : ''}`,
        data: {
          resultsCount: 1,
          matched: t.matched,
          partial: t.partial,
          unmatched: t.unmatched,
          suggested: t.suggested,
          results: [result],
        },
        viewIn: { label: 'View reconciliation', href: '/banking' },
      };
    }

    // mode === 'all'
    let results: ReconcileResult[];
    try {
      results = await svc.reconcileAll(orgId);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[reconcileTransactions] reconcileAll failed:', msg);
      return { ok: false, summary: `Reconciliation failed: ${msg}` };
    }
    const t = tally(results);
    await logActivity(orgId, 'banking', `Reconciled all transactions: ${t.matched} matched, ${t.suggested} suggested, ${t.partial} partial, ${t.unmatched} unmatched (of ${results.length})`, {
      mode: 'all', ...t, total: results.length,
    });
    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.reconciled_all',
      title: `Reconciliation complete — ${t.matched} matched`,
      description: `Processed ${results.length} transaction(s): ${t.matched} matched, ${t.suggested} suggested, ${t.partial} partial, ${t.unmatched} unmatched.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { mode: 'all', total: results.length, ...t },
    });
    return {
      ok: true,
      summary: `✅ Reconciliation complete. Processed **${results.length}** transaction(s): **${t.matched} matched**, **${t.suggested} suggested**, **${t.partial} partial**, **${t.unmatched} unmatched**. Review the suggested matches on the Banking page.`,
      data: {
        resultsCount: results.length,
        matched: t.matched,
        partial: t.partial,
        unmatched: t.unmatched,
        suggested: t.suggested,
      },
      artifacts: results.length > 0 ? [{
        kind: 'table',
        title: 'Reconciliation breakdown',
        columns: ['Transaction ID', 'Status', 'Best Match', 'Confidence'],
        rows: results.slice(0, 25).map(r => ({
          'Transaction ID': r.transactionId,
          Status: r.status,
          'Best Match': r.bestMatch?.label ?? '—',
          Confidence: r.bestMatch ? `${(r.bestMatch.confidence * 100).toFixed(0)}%` : '—',
        })),
      }] : undefined,
      viewIn: { label: 'View reconciliation', href: '/banking' },
    };
  },
};

registerAction(reconcileTransactionsAction);
