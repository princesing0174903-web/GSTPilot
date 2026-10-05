// ═══════════════════════════════════════════════════════════════════════════════
// Action: Record Expense
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { findOrCreateCustomer, createExpense as createExpenseService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_CATEGORIES = ['Office', 'Travel', 'Salary', 'Marketing', 'Rent', 'Utilities', 'Software', 'Miscellaneous'];

export const recordExpenseAction: OracleAction = {
  name: 'createExpense',
  displayName: 'Record Expense',
  description: 'Record a new business expense with vendor, category, amount, and optional GST.',
  category: 'finance',
  icon: 'Receipt',
  intentKeywords: [
    'record expense', 'log expense', 'add expense', 'new expense',
    'paid for', 'expense incurred', 'spent on', 'business expense',
  ],
  paramSchema: [
    { key: 'vendor', label: 'Vendor', type: 'string', required: true, description: 'Vendor name' },
    { key: 'amount', label: 'Amount (₹)', type: 'number', required: true, description: 'Total amount in INR' },
    { key: 'category', label: 'Category', type: 'enum', required: true, options: VALID_CATEGORIES, description: 'Expense category' },
    { key: 'date', label: 'Date', type: 'date', required: true, description: 'ISO date YYYY-MM-DD' },
    { key: 'gst', label: 'GST Portion (₹)', type: 'number', required: false, description: 'GST portion (claimable as ITC)' },
    { key: 'paymentMode', label: 'Payment Mode', type: 'enum', required: false, options: ['upi', 'bank', 'cash', 'cheque', 'card'], description: 'Default: upi' },
    { key: 'description', label: 'Description', type: 'string', required: false, description: 'Expense description' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // Vendor
    const vendor = String(args.vendor ?? '').trim();
    if (!vendor) {
      fields.push({ key: 'vendor', label: 'Vendor', status: 'error', message: 'Vendor name is required' });
      errors.push('Vendor name is required.');
    } else {
      const existing = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: vendor } },
        select: { id: true, tradeName: true },
      }).catch(() => null);
      if (existing) {
        fields.push({ key: 'vendor', label: 'Vendor', status: 'ok', message: 'Found in your records', resolvedValue: existing.tradeName });
        resolvedRefs.clientId = existing.id;
      } else {
        fields.push({ key: 'vendor', label: 'Vendor', status: 'warn', message: 'Will be created as a new contact', resolvedValue: vendor });
        warnings.push(`"${vendor}" is not in your vendor list — a new contact will be created.`);
      }
    }

    // Amount
    const amount = Number(args.amount ?? 0);
    if (!amount || amount <= 0) {
      fields.push({ key: 'amount', label: 'Amount', status: 'error', message: 'Amount must be greater than 0' });
      errors.push('Amount must be greater than 0.');
    } else {
      fields.push({ key: 'amount', label: 'Amount', status: 'ok', resolvedValue: inr(amount) });
    }

    // Category
    let category = String(args.category ?? 'Miscellaneous').trim();
    if (!VALID_CATEGORIES.includes(category)) {
      // Try to map common variations
      const lower = category.toLowerCase();
      const match = VALID_CATEGORIES.find(c => c.toLowerCase() === lower);
      if (match) {
        category = match;
        fields.push({ key: 'category', label: 'Category', status: 'ok', resolvedValue: category });
      } else {
        fields.push({ key: 'category', label: 'Category', status: 'warn', message: `Defaulting to "Miscellaneous"`, resolvedValue: category });
        warnings.push(`Category "${category}" is not standard — defaulting to "Miscellaneous".`);
        category = 'Miscellaneous';
      }
    } else {
      fields.push({ key: 'category', label: 'Category', status: 'ok', resolvedValue: category });
    }
    resolvedRefs.category = category;

    // Date
    const date = args.date ? String(args.date) : new Date().toISOString().slice(0, 10);
    fields.push({ key: 'date', label: 'Date', status: 'ok', resolvedValue: date });

    // GST
    const gst = Number(args.gst ?? 0);
    if (gst > 0) {
      if (gst > amount) {
        fields.push({ key: 'gst', label: 'GST Portion', status: 'error', message: 'GST cannot exceed total amount', resolvedValue: inr(gst) });
        errors.push('GST portion cannot exceed the total amount.');
      } else {
        fields.push({ key: 'gst', label: 'GST Portion', status: 'ok', message: `Claimable as ITC`, resolvedValue: inr(gst) });
        resolvedRefs.gst = gst;
      }
    } else {
      fields.push({ key: 'gst', label: 'GST Portion', status: 'warn', message: 'No GST — not claimable as ITC' });
    }

    if (args.paymentMode) fields.push({ key: 'paymentMode', label: 'Payment Mode', status: 'ok', resolvedValue: String(args.paymentMode) });
    if (args.description) fields.push({ key: 'description', label: 'Description', status: 'ok', resolvedValue: String(args.description) });

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const vendor = String(args.vendor ?? '').trim() || '—';
    const amount = Number(args.amount ?? 0);
    const category = validation.resolvedRefs?.category ?? String(args.category ?? 'Miscellaneous');
    const date = args.date ? String(args.date) : new Date().toISOString().slice(0, 10);
    const gst = Number(args.gst ?? 0);
    const paymentMode = args.paymentMode ? String(args.paymentMode) : '—';
    const fields: ActionPreview['fields'] = [
      { label: 'Vendor', value: vendor, emphasize: true },
      { label: 'Category', value: category },
      { label: 'Amount', value: inr(amount), emphasize: true },
      { label: 'Date', value: date },
      { label: 'Payment Mode', value: paymentMode },
    ];
    if (gst > 0) {
      fields.push({ label: 'GST (claimable)', value: inr(gst) });
      fields.push({ label: 'Net Cost', value: inr(amount - gst) });
    }
    if (args.description) fields.push({ label: 'Description', value: String(args.description) });
    return {
      title: `Record expense: ${category} — ${vendor}, ${inr(amount)}`,
      fields,
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const vendor = String(args.vendor ?? '').trim();
    const amount = Number(args.amount ?? 0);
    // Category was normalized in validate(); fall back to Miscellaneous if execute
    // is called directly without validation.
    const category = VALID_CATEGORIES.includes(String(args.category))
      ? String(args.category)
      : 'Miscellaneous';
    const date = String(args.date ?? new Date().toISOString().slice(0, 10));
    const gst = Number(args.gst ?? 0);

    // Find-or-create the vendor as a Client (so expenses link to a party).
    // Vendors are stored as Client records with entityType 'vendor' — the
    // find-or-create uses the vendor name and generates a LOCAL- GSTIN.
    const clientResult = await findOrCreateCustomer(
      orgId,
      vendor,
      {},
      { userId: ctx.userId, userName: ctx.userId },
    );
    const clientId = ('data' in clientResult && clientResult.data) ? clientResult.data.id : undefined;

    const result = await createExpenseService(
      orgId,
      {
        clientId,
        vendor,
        category,
        amount,
        gst,
        date,
        paymentMode: args.paymentMode ? String(args.paymentMode) : undefined,
        description: args.description ? String(args.description) : undefined,
      },
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to record expense. ${result.error ?? 'Database error.'}` };
    }

    const expense = result.data;

    return {
      ok: true,
      summary: `✅ Recorded expense: **${expense.category}** — ${vendor}, ${inr(expense.amount)} on ${date}.`,
      data: { id: expense.id, vendor: expense.vendor, amount: expense.amount, category: expense.category, date: expense.date, gstClaimable: gst > 0 },
      artifacts: [{
        kind: 'metric',
        title: 'Expense Recorded',
        items: [
          { label: 'Amount', value: inr(amount) },
          { label: 'Category', value: category },
          { label: 'Vendor', value: vendor },
          { label: 'Date', value: date },
          ...(gst > 0 ? [{ label: 'GST (ITC claimable)', value: inr(gst) }] : []),
        ],
      }],
      followUp: { label: 'View all expenses', prompt: 'Show me my recent expenses' },
      viewIn: { label: 'View in Banking', href: '/banking' },
    };
  },
};

registerAction(recordExpenseAction);
