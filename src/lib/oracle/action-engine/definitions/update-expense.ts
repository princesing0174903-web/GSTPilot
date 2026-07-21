// ═══════════════════════════════════════════════════════════════════════════════
// Action: Update Expense
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/expenses.ts → updateExpense)
// so the update performs the EXACT same Prisma write + audit log + timeline
// event as a UI-driven edit.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { updateExpense as updateExpenseService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_CATEGORIES = ['Office', 'Travel', 'Salary', 'Marketing', 'Rent', 'Utilities', 'Software', 'Miscellaneous'];

export const updateExpenseAction: OracleAction = {
  name: 'updateExpense',
  displayName: 'Update Expense',
  description: 'Update an existing expense\'s vendor, category, amount, GST, date, payment mode, or description.',
  category: 'finance',
  icon: 'Receipt',
  intentKeywords: [
    'update expense', 'edit expense', 'modify expense', 'change expense',
  ],
  paramSchema: [
    { key: 'id', label: 'Expense ID', type: 'string', required: true, description: 'Expense id' },
    { key: 'vendor', label: 'Vendor', type: 'string', required: false, description: 'Vendor name' },
    { key: 'category', label: 'Category', type: 'enum', required: false, options: VALID_CATEGORIES, description: 'Expense category' },
    { key: 'amount', label: 'Amount (₹)', type: 'number', required: false, description: 'Total amount in INR' },
    { key: 'gst', label: 'GST Portion (₹)', type: 'number', required: false, description: 'GST portion (claimable as ITC)' },
    { key: 'date', label: 'Date', type: 'date', required: false, description: 'ISO date YYYY-MM-DD' },
    { key: 'paymentMode', label: 'Payment Mode', type: 'enum', required: false, options: ['upi', 'bank', 'cash', 'cheque', 'card'], description: 'How the expense was paid' },
    { key: 'description', label: 'Description', type: 'string', required: false, description: 'Expense description' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // Resolve the expense by id (scoped via client.firmId).
    const id = String(args.id ?? '').trim();
    if (!id) {
      fields.push({ key: 'id', label: 'Expense ID', status: 'error', message: 'Expense id is required' });
      errors.push('Expense id is required.');
    } else {
      const existing = await db.expense.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, vendor: true, category: true, amount: true, gst: true, date: true, paymentMode: true, description: true },
      }).catch(() => null);
      if (!existing) {
        fields.push({ key: 'id', label: 'Expense ID', status: 'error', message: 'Expense not found in your tenant' });
        errors.push(`Expense "${id}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'id', label: 'Expense ID', status: 'ok', message: 'Found', resolvedValue: `${existing.category} — ${existing.vendor ?? 'vendor'}` });
        resolvedRefs.expenseId = existing.id;
        resolvedRefs.original = existing;
      }
    }

    // Collect updates
    const updates: Record<string, unknown> = {};

    if (args.vendor !== undefined) {
      updates.vendor = String(args.vendor) || null;
      fields.push({ key: 'vendor', label: 'Vendor', status: 'ok', resolvedValue: String(args.vendor) || '(cleared)' });
    }
    if (args.category !== undefined) {
      const cat = String(args.category);
      const match = VALID_CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase());
      if (match) {
        updates.category = match;
        fields.push({ key: 'category', label: 'Category', status: 'ok', resolvedValue: match });
      } else {
        fields.push({ key: 'category', label: 'Category', status: 'warn', message: `Unknown — defaulting to "Miscellaneous"`, resolvedValue: cat });
        warnings.push(`Category "${cat}" is not standard — defaulting to "Miscellaneous".`);
        updates.category = 'Miscellaneous';
      }
    }
    if (args.amount !== undefined) {
      const amount = Number(args.amount);
      if (!isFinite(amount) || amount <= 0) {
        fields.push({ key: 'amount', label: 'Amount', status: 'error', message: 'Amount must be greater than 0', resolvedValue: String(args.amount) });
        errors.push('Amount must be greater than 0.');
      } else {
        updates.amount = amount;
        fields.push({ key: 'amount', label: 'Amount', status: 'ok', resolvedValue: inr(amount) });
      }
    }
    if (args.gst !== undefined) {
      const gst = Number(args.gst);
      if (!isFinite(gst) || gst < 0) {
        fields.push({ key: 'gst', label: 'GST Portion', status: 'error', message: 'GST cannot be negative', resolvedValue: String(args.gst) });
        errors.push('GST portion cannot be negative.');
      } else {
        const amount = Number(args.amount ?? resolvedRefs.original?.amount ?? 0);
        if (amount && gst > amount) {
          fields.push({ key: 'gst', label: 'GST Portion', status: 'error', message: 'GST cannot exceed total amount', resolvedValue: inr(gst) });
          errors.push('GST portion cannot exceed the total amount.');
        } else {
          updates.gst = gst;
          fields.push({ key: 'gst', label: 'GST Portion', status: 'ok', resolvedValue: inr(gst) });
        }
      }
    }
    if (args.date !== undefined) {
      updates.date = String(args.date);
      fields.push({ key: 'date', label: 'Date', status: 'ok', resolvedValue: String(args.date) });
    }
    if (args.paymentMode !== undefined) {
      updates.paymentMode = String(args.paymentMode) || null;
      fields.push({ key: 'paymentMode', label: 'Payment Mode', status: 'ok', resolvedValue: String(args.paymentMode) || '(cleared)' });
    }
    if (args.description !== undefined) {
      updates.description = String(args.description) || null;
      fields.push({ key: 'description', label: 'Description', status: 'ok', resolvedValue: String(args.description) || '(cleared)' });
    }

    if (Object.keys(updates).length === 0 && errors.length === 0) {
      warnings.push('No updatable fields were supplied — nothing to change.');
    }

    resolvedRefs.updates = updates;
    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const original = refs.original ?? {};
    const updates: Record<string, unknown> = refs.updates ?? {};
    const changed: string[] = [];
    if (updates.vendor !== undefined) changed.push(`vendor → ${updates.vendor || '(cleared)'}`);
    if (updates.category !== undefined) changed.push(`category → ${updates.category}`);
    if (updates.amount !== undefined) changed.push(`amount → ${inr(Number(updates.amount))}`);
    if (updates.gst !== undefined) changed.push(`GST → ${inr(Number(updates.gst))}`);
    if (updates.date !== undefined) changed.push(`date → ${updates.date}`);
    if (updates.paymentMode !== undefined) changed.push(`payment mode → ${updates.paymentMode || '(cleared)'}`);
    if (updates.description !== undefined) changed.push(`description → ${updates.description || '(cleared)'}`);
    const changeSummary = changed.length > 0 ? changed.join('; ') : 'no changes';
    const label = `${original.category ?? 'Expense'} — ${original.vendor ?? 'vendor'}`;
    return {
      title: `Update expense "${label}"`,
      fields: [
        { label: 'Expense', value: label, emphasize: true },
        { label: 'Current Amount', value: inr(Number(original.amount ?? 0)) },
        { label: 'Changes', value: changeSummary },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const id = String(args.id ?? '').trim();
    if (!id) {
      return { ok: false, summary: 'Failed to update expense — no id supplied.' };
    }

    const updates: Record<string, unknown> = {};
    if (args.vendor !== undefined) updates.vendor = String(args.vendor) || null;
    if (args.category !== undefined) {
      const cat = String(args.category);
      const match = VALID_CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase());
      updates.category = match ?? 'Miscellaneous';
    }
    if (args.amount !== undefined) {
      const amount = Number(args.amount);
      if (isFinite(amount) && amount > 0) updates.amount = amount;
    }
    if (args.gst !== undefined) {
      const gst = Number(args.gst);
      if (isFinite(gst) && gst >= 0) updates.gst = gst;
    }
    if (args.date !== undefined) updates.date = String(args.date);
    if (args.paymentMode !== undefined) updates.paymentMode = String(args.paymentMode) || null;
    if (args.description !== undefined) updates.description = String(args.description) || null;

    const result = await updateExpenseService(
      orgId,
      id,
      updates,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to update expense. ${result.error ?? 'Database error.'}` };
    }

    const exp = result.data;
    return {
      ok: true,
      summary: `✅ Updated expense: **${exp.category}** — ${exp.vendor ?? 'vendor'}, ${inr(exp.amount)} on ${exp.date}.`,
      data: { id: exp.id, vendor: exp.vendor, amount: exp.amount, category: exp.category, date: exp.date },
      viewIn: { label: 'View in Expenses', href: '/expenses' },
    };
  },
};

registerAction(updateExpenseAction);
