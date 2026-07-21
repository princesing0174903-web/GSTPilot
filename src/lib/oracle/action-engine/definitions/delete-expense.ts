// ═══════════════════════════════════════════════════════════════════════════════
// Action: Delete Expense
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/expenses.ts → deleteExpense)
// so the delete performs the EXACT same audit log + timeline event as a
// UI-driven delete. Hard delete — Oracle always asks for explicit confirmation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { deleteExpense as deleteExpenseService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const deleteExpenseAction: OracleAction = {
  name: 'deleteExpense',
  displayName: 'Delete Expense',
  description: 'Permanently delete an expense record. Audit log is written before deletion.',
  category: 'finance',
  icon: 'Receipt',
  intentKeywords: [
    'delete expense', 'remove expense',
  ],
  paramSchema: [
    { key: 'id', label: 'Expense ID', type: 'string', required: true, description: 'Expense id' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    if (!id) {
      fields.push({ key: 'id', label: 'Expense ID', status: 'error', message: 'Expense id is required' });
      errors.push('Expense id is required.');
    } else {
      const existing = await db.expense.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, vendor: true, category: true, amount: true, date: true },
      }).catch(() => null);
      if (!existing) {
        fields.push({ key: 'id', label: 'Expense ID', status: 'error', message: 'Expense not found in your tenant' });
        errors.push(`Expense "${id}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'id', label: 'Expense ID', status: 'ok', message: 'Found', resolvedValue: `${existing.category} — ${existing.vendor ?? 'vendor'}` });
        resolvedRefs.expenseId = existing.id;
        resolvedRefs.vendor = existing.vendor;
        resolvedRefs.category = existing.category;
        resolvedRefs.amount = existing.amount ?? 0;
        resolvedRefs.date = existing.date;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const label = `${refs.category ?? 'Expense'} — ${refs.vendor ?? 'vendor'}`;
    const amount = Number(refs.amount ?? 0);
    const date = refs.date ?? '—';
    return {
      title: `Delete expense "${label}"`,
      fields: [
        { label: 'Expense', value: label, emphasize: true },
        { label: 'Amount', value: inr(amount) },
        { label: 'Date', value: date },
      ],
      note: '⚠️ This will permanently delete the expense. The audit log and timeline event are preserved, but the expense record cannot be recovered.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const id = String(args.id ?? '').trim();
    if (!id) {
      return { ok: false, summary: 'Failed to delete expense — no id supplied.' };
    }

    const result = await deleteExpenseService(
      orgId,
      id,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to delete expense. ${result.error ?? 'Database error.'}` };
    }

    const exp = result.data;
    return {
      ok: true,
      summary: `✅ Deleted expense: **${exp.category}** (${inr(exp.amount)}).`,
      data: { id: exp.id, amount: exp.amount, category: exp.category },
      viewIn: { label: 'View in Expenses', href: '/expenses' },
    };
  },
};

registerAction(deleteExpenseAction);
