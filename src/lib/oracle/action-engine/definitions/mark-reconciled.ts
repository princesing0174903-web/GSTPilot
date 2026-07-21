// ═══════════════════════════════════════════════════════════════════════════════
// Action: Mark Transaction Reconciled
// ═══════════════════════════════════════════════════════════════════════════════
//
// Marks a single bank transaction as reconciled (manual confirmation of a
// suggested match, or a manual link to a specific invoice/payment/expense).
// Calls Banking Service markReconciled(orgId, transactionId, candidateId?,
// candidateKind?).
//
// candidateKind options: invoice | payment | expense | refund | receipt.
// If candidateId + candidateKind are omitted, the transaction is simply marked
// "reconciled" with matchType='manual' (e.g. the user reviewed the candidates
// and confirmed the match Oracle suggested, or marked it reconciled without a
// specific ledger link).
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankingService } from '@/lib/banking-service';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_CANDIDATE_KINDS = ['invoice', 'payment', 'expense', 'refund', 'receipt'] as const;

export const markReconciledAction: OracleAction = {
  name: 'markReconciled',
  displayName: 'Mark Transaction Reconciled',
  description: 'Mark a single bank transaction as reconciled. Optionally link it to a specific candidate (invoice / payment / expense / refund / receipt) by id + kind. Confirms an Oracle-suggested match or applies a manual one. Calls the Banking Service.',
  category: 'finance',
  icon: 'CheckCircle2',
  intentKeywords: [
    'mark reconciled', 'mark as reconciled', 'reconcile this transaction', 'confirm match',
  ],
  paramSchema: [
    { key: 'transactionId', label: 'Transaction ID', type: 'string', required: true, description: 'The bank transaction to mark reconciled (required)' },
    { key: 'candidateId', label: 'Candidate ID', type: 'string', required: false, description: 'Optional — the invoice/payment/expense id to link this transaction to' },
    { key: 'candidateKind', label: 'Candidate Kind', type: 'enum', required: false, options: [...VALID_CANDIDATE_KINDS], description: 'Required when candidateId is provided — invoice | payment | expense | refund | receipt' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Transaction ID (required) ──
    const transactionId = String(args.transactionId ?? '').trim();
    if (!transactionId) {
      fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'error', message: 'Required' });
      errors.push('Transaction ID is required.');
    } else {
      // Best-effort: verify the transaction exists
      try {
        const svc = await getBankingService();
        const tx = await svc.getTransaction(orgId, transactionId);
        if (!tx) {
          fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'error', message: 'Transaction not found', resolvedValue: transactionId });
          errors.push(`Transaction "${transactionId}" was not found.`);
        } else {
          fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'ok', message: `${tx.description} · ${tx.amount} ${tx.type}`, resolvedValue: transactionId });
          resolvedRefs.transactionLabel = `${tx.description} (${tx.amount} ${tx.type})`;
        }
      } catch (e) {
        fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'warn', message: 'Could not verify (service unavailable)', resolvedValue: transactionId });
        warnings.push(`Could not verify transaction "${transactionId}" — Banking Service unavailable.`);
        resolvedRefs.transactionLabel = transactionId;
      }
    }

    // ── Candidate ID + Kind (optional, but kind required when candidateId present) ──
    const candidateId = String(args.candidateId ?? '').trim();
    const candidateKind = String(args.candidateKind ?? '').toLowerCase();
    if (candidateId && !candidateKind) {
      fields.push({ key: 'candidateKind', label: 'Candidate Kind', status: 'error', message: 'Required when candidateId is provided' });
      errors.push('candidateKind is required when candidateId is provided.');
    } else if (candidateKind && !VALID_CANDIDATE_KINDS.includes(candidateKind as any)) {
      fields.push({ key: 'candidateKind', label: 'Candidate Kind', status: 'error', message: `Must be one of: ${VALID_CANDIDATE_KINDS.join(', ')}`, resolvedValue: candidateKind });
      errors.push(`Invalid candidateKind "${candidateKind}". Must be one of: ${VALID_CANDIDATE_KINDS.join(', ')}.`);
    } else if (candidateKind) {
      fields.push({ key: 'candidateKind', label: 'Candidate Kind', status: 'ok', resolvedValue: candidateKind });
      resolvedRefs.candidateKind = candidateKind;
      if (candidateId) {
        fields.push({ key: 'candidateId', label: 'Candidate ID', status: 'ok', resolvedValue: candidateId });
        resolvedRefs.candidateId = candidateId;
        resolvedRefs.candidateLabel = `${candidateKind} ${candidateId}`;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const txLabel = refs.transactionLabel ?? String(args.transactionId ?? '—');
    const candidateLabel = refs.candidateLabel ?? (args.candidateId ? `${args.candidateKind ?? 'candidate'} ${args.candidateId}` : null);
    const fields: ActionPreview['fields'] = [
      { label: 'Transaction', value: txLabel, emphasize: true },
    ];
    if (candidateLabel) {
      fields.push({ label: 'Linking to', value: candidateLabel, emphasize: true });
    }
    return {
      title: candidateLabel ? `Confirm match: transaction → ${candidateLabel}` : 'Mark transaction as reconciled',
      fields,
      note: candidateLabel
        ? 'Sets the transaction status to "reconciled" with matchType="manual" and links it to the specified candidate.'
        : 'Sets the transaction status to "reconciled" with matchType="manual". No specific ledger entity is linked.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const transactionId = String(args.transactionId).trim();
    const candidateId = args.candidateId ? String(args.candidateId).trim() : undefined;
    const candidateKind = args.candidateKind
      ? (VALID_CANDIDATE_KINDS.includes(String(args.candidateKind).toLowerCase() as any)
          ? (String(args.candidateKind).toLowerCase() as typeof VALID_CANDIDATE_KINDS[number])
          : undefined)
      : undefined;

    if (!transactionId) {
      return { ok: false, summary: 'Cannot mark reconciled: transactionId is required.' };
    }
    if (candidateId && !candidateKind) {
      return { ok: false, summary: 'Cannot mark reconciled: candidateKind is required when candidateId is provided.' };
    }

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    let tx;
    try {
      tx = await svc.markReconciled(orgId, transactionId, candidateId, candidateKind);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[markReconciled] markReconciled failed:', msg);
      return { ok: false, summary: `Failed to mark transaction reconciled: ${msg}` };
    }

    await logActivity(orgId, 'banking', `Marked transaction ${transactionId} as reconciled${candidateId ? ` (linked to ${candidateKind} ${candidateId})` : ' (manual)'}`, {
      transactionId, candidateId, candidateKind,
      matchType: tx.matchType,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.marked_reconciled',
      title: 'Transaction marked reconciled',
      description: `Transaction ${transactionId} → reconciled${candidateId ? ` · linked to ${candidateKind} ${candidateId}` : ' · manual'}.`,
      severity: 'success',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { transactionId, candidateId, candidateKind, matchType: tx.matchType },
    });

    return {
      ok: true,
      summary: `✅ Transaction **${transactionId}** marked as **reconciled**${candidateId ? ` and linked to **${candidateKind} ${candidateId}**` : ' (manual match)'}.`,
      data: {
        transactionId,
        status: tx.status,
        matchType: tx.matchType ?? 'manual',
        linkedInvoiceId: tx.linkedInvoiceId ?? null,
        linkedInvoiceNumber: tx.linkedInvoiceNumber ?? null,
      },
      viewIn: { label: 'View reconciliation', href: '/banking' },
    };
  },
};

registerAction(markReconciledAction);
