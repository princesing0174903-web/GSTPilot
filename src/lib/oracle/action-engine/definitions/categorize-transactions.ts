// ═══════════════════════════════════════════════════════════════════════════════
// Action: Categorize Transactions
// ═══════════════════════════════════════════════════════════════════════════════
//
// Two modes:
//   • mode='rules' (default) → applyRules() re-evaluates every active rule
//     against every transaction, only overwriting categories when missing or
//     'misc' (never clobbers explicit user categorization). Returns
//     { applied, touched }.
//   • mode='single'          → categorize() sets the category on ONE
//     transaction. Requires transactionId + category.
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankingService } from '@/lib/banking-service';
import type { TransactionCategory } from '@/lib/banking-service';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_MODES = ['rules', 'single'] as const;
const VALID_CATEGORIES: TransactionCategory[] = [
  'sales', 'payment_received', 'vendor_payment', 'salary', 'rent', 'utilities',
  'tax', 'fees', 'refund', 'transfer', 'interest', 'misc',
];

export const categorizeTransactionsAction: OracleAction = {
  name: 'categorizeTransactions',
  displayName: 'Categorize Transactions',
  description: 'Auto-categorize transactions using active categorization rules (mode=rules, default) OR set a specific category on one transaction (mode=single). Calls the Banking Service.',
  category: 'finance',
  icon: 'Tags',
  intentKeywords: [
    'categorize transactions', 'auto categorize', 'apply categories', 'categorize all',
  ],
  paramSchema: [
    { key: 'mode', label: 'Mode', type: 'enum', required: false, options: [...VALID_MODES], description: 'rules (default — apply all active rules) or single (set one transaction\'s category)' },
    { key: 'transactionId', label: 'Transaction ID', type: 'string', required: false, description: 'Required when mode=single' },
    { key: 'category', label: 'Category', type: 'enum', required: false, options: [...VALID_CATEGORIES], description: 'Required when mode=single — one of: sales, payment_received, vendor_payment, salary, rent, utilities, tax, fees, refund, transfer, interest, misc' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Mode ──
    const mode = String(args.mode ?? 'rules').toLowerCase();
    if (!VALID_MODES.includes(mode as any)) {
      fields.push({ key: 'mode', label: 'Mode', status: 'warn', message: `Unknown — defaulting to "rules"`, resolvedValue: 'rules' });
      warnings.push(`Unknown mode "${mode}" — defaulting to rules.`);
      resolvedRefs.mode = 'rules';
    } else {
      fields.push({ key: 'mode', label: 'Mode', status: 'ok', resolvedValue: mode });
      resolvedRefs.mode = mode;
    }

    // ── Transaction ID (required when single) ──
    const transactionId = String(args.transactionId ?? '').trim();
    if (resolvedRefs.mode === 'single') {
      if (!transactionId) {
        fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'error', message: 'Required when mode=single' });
        errors.push('Transaction ID is required when mode=single.');
      } else {
        fields.push({ key: 'transactionId', label: 'Transaction ID', status: 'ok', resolvedValue: transactionId });
        resolvedRefs.transactionId = transactionId;
      }
    }

    // ── Category (required when single) ──
    const category = String(args.category ?? '').toLowerCase();
    if (resolvedRefs.mode === 'single') {
      if (!category) {
        fields.push({ key: 'category', label: 'Category', status: 'error', message: 'Required when mode=single' });
        errors.push('Category is required when mode=single.');
      } else if (!VALID_CATEGORIES.includes(category as TransactionCategory)) {
        fields.push({ key: 'category', label: 'Category', status: 'error', message: `Must be one of: ${VALID_CATEGORIES.join(', ')}`, resolvedValue: category });
        errors.push(`Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}.`);
      } else {
        fields.push({ key: 'category', label: 'Category', status: 'ok', resolvedValue: category });
        resolvedRefs.category = category;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const mode = refs.mode ?? 'rules';
    const fields: ActionPreview['fields'] = [
      { label: 'Mode', value: mode === 'rules' ? 'Apply all active rules' : 'Set category on one transaction', emphasize: true },
    ];
    if (mode === 'single') {
      fields.push({ label: 'Transaction ID', value: refs.transactionId ?? String(args.transactionId ?? '—') });
      fields.push({ label: 'Category', value: refs.category ?? String(args.category ?? '—'), emphasize: true });
    }
    return {
      title: mode === 'rules' ? 'Re-categorize all transactions' : 'Categorize one transaction',
      fields,
      note: mode === 'rules'
        ? 'Rules only overwrite categories that are missing or "misc" — your explicit categorizations are preserved.'
        : 'Sets the category on the specified transaction. This overrides any AI-suggested category.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const mode = VALID_MODES.includes(String(args.mode ?? 'rules').toLowerCase() as any)
      ? (String(args.mode ?? 'rules').toLowerCase() as 'rules' | 'single')
      : 'rules';

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    if (mode === 'single') {
      const transactionId = String(args.transactionId).trim();
      const category = String(args.category).toLowerCase() as TransactionCategory;
      if (!transactionId || !VALID_CATEGORIES.includes(category)) {
        return { ok: false, summary: 'Cannot categorize: transactionId and a valid category are required for single mode.' };
      }
      let tx;
      try {
        tx = await svc.categorize(orgId, transactionId, category);
      } catch (e) {
        const msg = (e as Error).message;
        console.error('[categorizeTransactions] categorize failed:', msg);
        return { ok: false, summary: `Categorization failed: ${msg}` };
      }
      await logActivity(orgId, 'banking', `Categorized transaction ${transactionId} as "${category}"`, {
        mode: 'single', transactionId, category,
      });
      await emitTimelineEvent({
        organizationId: orgId,
        type: 'banking.categorized',
        title: `Transaction categorized as "${category}"`,
        description: `Transaction ${transactionId} → ${category}.`,
        severity: 'info',
        actor: { userId: ctx.userId, userName: ctx.userId },
        metadata: { mode: 'single', transactionId, category },
      });
      return {
        ok: true,
        summary: `✅ Transaction **${transactionId}** categorized as **${category}**.`,
        data: { transactionId, category, mode: 'single' },
        viewIn: { label: 'View transactions', href: '/banking' },
      };
    }

    // mode === 'rules'
    let outcome;
    try {
      outcome = await svc.applyRules(orgId);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[categorizeTransactions] applyRules failed:', msg);
      return { ok: false, summary: `Rule application failed: ${msg}` };
    }
    await logActivity(orgId, 'banking', `Applied ${outcome.applied} categorization rules, recategorized ${outcome.touched} transactions`, {
      mode: 'rules', applied: outcome.applied, touched: outcome.touched,
    });
    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.rules_applied',
      title: `Applied ${outcome.applied} rules — ${outcome.touched} re-categorized`,
      description: `Re-evaluated every active rule against every transaction. ${outcome.applied} rules applied, ${outcome.touched} transactions re-categorized.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { mode: 'rules', applied: outcome.applied, touched: outcome.touched },
    });
    return {
      ok: true,
      summary: `✅ Applied **${outcome.applied}** categorization rule(s) — **${outcome.touched}** transaction(s) re-categorized. Existing explicit categories were preserved.`,
      data: { applied: outcome.applied, touched: outcome.touched, mode: 'rules' },
      viewIn: { label: 'View transactions', href: '/banking' },
    };
  },
};

registerAction(categorizeTransactionsAction);
