// ═══════════════════════════════════════════════════════════════════════════════
// Action: Import Bank Statement
// ═══════════════════════════════════════════════════════════════════════════════
//
// Imports a bank statement (CSV / Excel / PDF text) into the Banking Service.
// Pipeline: previewImport → categorizeImport → commitImport.
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// This keeps Oracle provider-agnostic — when Setu is wired up later, the same
// action works against live data because it goes through the same service.
//
// Banking Service methods used:
//   • previewImport(orgId, format, rawContent, accountId) — parse + map columns
//   • categorizeImport(orgId, preview)                   — run rules engine
//   • commitImport(orgId, preview, accountId)            — persist transactions
//   • listAccounts(orgId)                                — verify the account exists
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

const VALID_FORMATS = ['csv', 'excel', 'pdf'] as const;

export const importStatementAction: OracleAction = {
  name: 'importStatement',
  displayName: 'Import Bank Statement',
  description: 'Import a bank statement (CSV / Excel / PDF text) into Banking. Oracle parses the rows, AI-categorizes each one, then commits the transactions. Calls the Banking Service — provider-agnostic.',
  category: 'finance',
  icon: 'Upload',
  intentKeywords: [
    'import statement', 'import bank statement', 'upload statement',
    'import transactions', 'import csv',
  ],
  paramSchema: [
    { key: 'format', label: 'Format', type: 'enum', required: true, options: [...VALID_FORMATS], description: 'csv | excel | pdf (the file format of the statement text)' },
    { key: 'rawContent', label: 'Statement Content', type: 'string', required: true, description: 'The raw file text (CSV rows, tabular text from Excel, or extracted text from PDF). Must be ≥10 chars.' },
    { key: 'accountId', label: 'Account ID', type: 'string', required: true, description: 'The Banking Service account id to import the statement into' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Format ──
    const format = String(args.format ?? '').toLowerCase();
    if (!VALID_FORMATS.includes(format as any)) {
      fields.push({ key: 'format', label: 'Format', status: 'error', message: `Must be one of: ${VALID_FORMATS.join(', ')}`, resolvedValue: format });
      errors.push(`Invalid format "${format}". Must be one of: ${VALID_FORMATS.join(', ')}.`);
    } else {
      fields.push({ key: 'format', label: 'Format', status: 'ok', resolvedValue: format });
      resolvedRefs.format = format;
    }

    // ── Raw content ──
    const rawContent = String(args.rawContent ?? '');
    if (rawContent.trim().length < 10) {
      fields.push({ key: 'rawContent', label: 'Statement Content', status: 'error', message: 'Statement content is empty or too short', resolvedValue: `${rawContent.length} chars` });
      errors.push('Statement content is required and must be at least 10 characters.');
    } else {
      const lineCount = rawContent.split(/\r?\n/).filter(l => l.trim().length > 0).length;
      fields.push({ key: 'rawContent', label: 'Statement Content', status: 'ok', message: `${rawContent.length} chars, ~${lineCount} lines detected`, resolvedValue: `${lineCount} lines` });
      resolvedRefs.lineCount = lineCount;
    }

    // ── Account ID ──
    const accountId = String(args.accountId ?? '').trim();
    if (!accountId) {
      fields.push({ key: 'accountId', label: 'Account ID', status: 'error', message: 'Account ID is required' });
      errors.push('Account ID is required.');
    } else {
      // Best-effort: verify the account exists in the Banking Service
      try {
        const svc = await getBankingService();
        const account = await svc.getAccount(orgId, accountId);
        if (!account) {
          fields.push({ key: 'accountId', label: 'Account ID', status: 'error', message: 'Account not found', resolvedValue: accountId });
          errors.push(`Banking account "${accountId}" was not found.`);
        } else {
          fields.push({ key: 'accountId', label: 'Account ID', status: 'ok', message: `${account.bankName} ${account.accountMasked}`, resolvedValue: accountId });
          resolvedRefs.accountLabel = `${account.bankName} ${account.accountMasked}`;
        }
      } catch (e) {
        // Service unavailable — don't block, just warn
        fields.push({ key: 'accountId', label: 'Account ID', status: 'warn', message: 'Could not verify (service unavailable)', resolvedValue: accountId });
        warnings.push(`Could not verify account "${accountId}" — Banking Service unavailable. Will attempt the import anyway.`);
        resolvedRefs.accountLabel = accountId;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const format = refs.format ?? String(args.format ?? '—');
    const accountLabel = refs.accountLabel ?? String(args.accountId ?? '—');
    const lineCount = refs.lineCount ?? (args.rawContent ? String(args.rawContent).split(/\r?\n/).filter(l => l.trim()).length : 0);
    return {
      title: `Import ${format.toUpperCase()} statement`,
      fields: [
        { label: 'Format', value: format.toUpperCase(), emphasize: true },
        { label: 'Account', value: accountLabel, emphasize: true },
        { label: 'Detected rows', value: `~${lineCount}` },
      ],
      note: validation.warnings.length > 0
        ? validation.warnings.join(' ')
        : 'AI will categorize each row using your active rules; you can review before commit.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const format = VALID_FORMATS.includes(String(args.format).toLowerCase() as any)
      ? (String(args.format).toLowerCase() as typeof VALID_FORMATS[number])
      : 'csv';
    const rawContent = String(args.rawContent);
    const accountId = String(args.accountId);

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    // Stage 1 — parse
    let preview;
    try {
      preview = await svc.previewImport(orgId, format, rawContent, accountId);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[importStatement] previewImport failed:', msg);
      return { ok: false, summary: `Failed to parse the ${format.toUpperCase()} statement: ${msg}` };
    }

    // Stage 2 — AI categorize
    try {
      preview = await svc.categorizeImport(orgId, preview);
    } catch (e) {
      console.warn('[importStatement] categorizeImport failed (continuing without categories):', (e as Error).message);
      // Non-fatal — commit with whatever categories previewImport detected
    }

    // Stage 3 — commit
    let result;
    try {
      result = await svc.commitImport(orgId, preview, accountId);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[importStatement] commitImport failed:', msg);
      return { ok: false, summary: `Import parsed but commit failed: ${msg}` };
    }

    await logActivity(orgId, 'banking', `Imported ${result.importedCount} transactions from ${format.toUpperCase()} statement (skipped ${result.skippedCount}, ${result.categorizationApplied} categorized)`, {
      format, accountId,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      categorizationApplied: result.categorizationApplied,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.statement_imported',
      title: `Imported ${result.importedCount} transactions`,
      description: `${format.toUpperCase()} statement into account ${accountId} — ${result.importedCount} imported, ${result.skippedCount} skipped, ${result.categorizationApplied} AI-categorized.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { format, accountId, importedCount: result.importedCount, skippedCount: result.skippedCount, categorizationApplied: result.categorizationApplied },
    });

    return {
      ok: result.ok,
      summary: result.summary || `✅ Imported **${result.importedCount}** transaction(s) from the ${format.toUpperCase()} statement (${result.skippedCount} skipped, ${result.categorizationApplied} AI-categorized).`,
      data: {
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        categorizationApplied: result.categorizationApplied,
        transactionIds: result.transactionIds,
        format,
        accountId,
      },
      viewIn: { label: 'View transactions', href: '/banking' },
    };
  },
};

registerAction(importStatementAction);
