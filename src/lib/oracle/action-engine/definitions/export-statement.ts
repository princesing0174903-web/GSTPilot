// ═══════════════════════════════════════════════════════════════════════════════
// Action: Export Bank Statement
// ═══════════════════════════════════════════════════════════════════════════════
//
// Exports transactions from the Banking Service as a CSV (or JSON) string.
// accountId empty = all accounts. Date range optional.
//
// Returns:
//   • summary "Exported N transactions as CSV."
//   • data: { rowCount, format, csvPreview: first 500 chars }
//
// NOTE: We return the data; the actual file download is handled by the UI.
// Oracle does NOT stream a file — it returns a CSV string for the UI to offer
// as a download. The CSV columns are: date, description, counterparty, amount,
// type, category, status, linkedInvoiceNumber.
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankingService } from '@/lib/banking-service';
import type { BankingTransaction } from '@/lib/banking-service';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_FORMATS = ['csv', 'json'] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: BankingTransaction[]): string {
  const header = ['date', 'description', 'counterparty', 'amount', 'type', 'category', 'status', 'linkedInvoiceNumber'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(r.date),
      csvEscape(r.description),
      csvEscape(r.counterparty),
      csvEscape(r.amount),
      csvEscape(r.type),
      csvEscape(r.category),
      csvEscape(r.status),
      csvEscape(r.linkedInvoiceNumber),
    ].join(','));
  }
  return lines.join('\n');
}

function buildJson(rows: BankingTransaction[]): string {
  return JSON.stringify(rows.map(r => ({
    date: r.date,
    description: r.description,
    counterparty: r.counterparty ?? null,
    amount: r.amount,
    type: r.type,
    category: r.category ?? null,
    status: r.status,
    linkedInvoiceNumber: r.linkedInvoiceNumber ?? null,
  })), null, 2);
}

export const exportStatementAction: OracleAction = {
  name: 'exportStatement',
  displayName: 'Export Bank Statement',
  description: 'Export bank transactions as CSV or JSON. accountId empty = all accounts. Optional date range. Returns the data inline — the actual file download is handled by the UI. Calls the Banking Service.',
  category: 'finance',
  icon: 'Download',
  intentKeywords: [
    'export statement', 'export transactions', 'download statement', 'export bank statement',
  ],
  paramSchema: [
    { key: 'accountId', label: 'Account ID', type: 'string', required: false, description: 'Optional — empty/omitted = all accounts' },
    { key: 'format', label: 'Format', type: 'enum', required: false, options: [...VALID_FORMATS], description: 'csv (default) or json' },
    { key: 'dateFrom', label: 'Date From', type: 'date', required: false, description: 'ISO date YYYY-MM-DD — start of export range' },
    { key: 'dateTo', label: 'Date To', type: 'date', required: false, description: 'ISO date YYYY-MM-DD — end of export range' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Format ──
    const format = String(args.format ?? 'csv').toLowerCase();
    if (!VALID_FORMATS.includes(format as any)) {
      fields.push({ key: 'format', label: 'Format', status: 'warn', message: `Unknown — defaulting to "csv"`, resolvedValue: 'csv' });
      warnings.push(`Unknown format "${format}" — defaulting to csv.`);
      resolvedRefs.format = 'csv';
    } else {
      fields.push({ key: 'format', label: 'Format', status: 'ok', resolvedValue: format });
      resolvedRefs.format = format;
    }

    // ── Account ID (optional) ──
    const accountId = String(args.accountId ?? '').trim();
    if (accountId) {
      fields.push({ key: 'accountId', label: 'Account ID', status: 'ok', resolvedValue: accountId });
      resolvedRefs.accountId = accountId;
      resolvedRefs.accountScope = accountId;
    } else {
      fields.push({ key: 'accountId', label: 'Account ID', status: 'ok', resolvedValue: 'all accounts' });
      resolvedRefs.accountScope = 'all accounts';
    }

    // ── Date range (optional, warn if malformed) ──
    if (args.dateFrom) {
      const d = String(args.dateFrom);
      if (!/^\d{4}-\d{2}-\d{2}/.test(d)) {
        fields.push({ key: 'dateFrom', label: 'Date From', status: 'warn', message: 'Should be YYYY-MM-DD', resolvedValue: d });
        warnings.push(`dateFrom "${d}" doesn't look like a YYYY-MM-DD date.`);
      } else {
        fields.push({ key: 'dateFrom', label: 'Date From', status: 'ok', resolvedValue: d });
        resolvedRefs.dateFrom = d;
      }
    }
    if (args.dateTo) {
      const d = String(args.dateTo);
      if (!/^\d{4}-\d{2}-\d{2}/.test(d)) {
        fields.push({ key: 'dateTo', label: 'Date To', status: 'warn', message: 'Should be YYYY-MM-DD', resolvedValue: d });
        warnings.push(`dateTo "${d}" doesn't look like a YYYY-MM-DD date.`);
      } else {
        fields.push({ key: 'dateTo', label: 'Date To', status: 'ok', resolvedValue: d });
        resolvedRefs.dateTo = d;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const format = refs.format ?? 'csv';
    const accountScope = refs.accountScope ?? (args.accountId ? String(args.accountId) : 'all accounts');
    const dateFrom = refs.dateFrom ?? (args.dateFrom ? String(args.dateFrom) : null);
    const dateTo = refs.dateTo ?? (args.dateTo ? String(args.dateTo) : null);
    const fields: ActionPreview['fields'] = [
      { label: 'Format', value: format.toUpperCase(), emphasize: true },
      { label: 'Account', value: accountScope, emphasize: true },
    ];
    if (dateFrom || dateTo) {
      fields.push({ label: 'Date range', value: `${dateFrom ?? '…'} → ${dateTo ?? '…'}` });
    }
    return {
      title: `Export bank statement (${format.toUpperCase()})`,
      fields,
      note: 'Pulls up to 10,000 transactions from the Banking Service and returns the data inline. The UI offers the file as a download — Oracle does not stream a file.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const format = VALID_FORMATS.includes(String(args.format ?? 'csv').toLowerCase() as any)
      ? (String(args.format ?? 'csv').toLowerCase() as 'csv' | 'json')
      : 'csv';
    const accountId = args.accountId ? String(args.accountId).trim() : undefined;
    const dateFrom = args.dateFrom ? String(args.dateFrom) : undefined;
    const dateTo = args.dateTo ? String(args.dateTo) : undefined;

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    let page;
    try {
      page = await svc.listTransactions(orgId, {
        accountId,
        dateFrom,
        dateTo,
        limit: 10000,
        offset: 0,
      });
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[exportStatement] listTransactions failed:', msg);
      return { ok: false, summary: `Failed to load transactions for export: ${msg}` };
    }

    const rows = page.rows ?? [];
    let payload = '';
    try {
      payload = format === 'csv' ? buildCsv(rows) : buildJson(rows);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[exportStatement] payload build failed:', msg);
      return { ok: false, summary: `Failed to build ${format.toUpperCase()} payload: ${msg}` };
    }

    await logActivity(orgId, 'banking', `Exported ${rows.length} transactions as ${format.toUpperCase()} (${accountId ? `account ${accountId}` : 'all accounts'}${dateFrom || dateTo ? `, ${dateFrom ?? '…'} → ${dateTo ?? '…'}` : ''})`, {
      format, accountId, dateFrom, dateTo, rowCount: rows.length,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.statement_exported',
      title: `Exported ${rows.length} transactions (${format.toUpperCase()})`,
      description: `${accountId ? `Account ${accountId}` : 'All accounts'}${dateFrom || dateTo ? ` · ${dateFrom ?? '…'} → ${dateTo ?? '…'}` : ''} · ${rows.length} rows.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { format, accountId, dateFrom, dateTo, rowCount: rows.length },
    });

    return {
      ok: true,
      summary: `✅ Exported **${rows.length}** transaction(s) as **${format.toUpperCase()}**${accountId ? ` from account ${accountId}` : ' (all accounts)'}${dateFrom || dateTo ? ` for ${dateFrom ?? '…'} → ${dateTo ?? '…'}` : ''}. The data is ready for download below.`,
      data: {
        rowCount: rows.length,
        format,
        accountId: accountId ?? null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        csvPreview: payload.slice(0, 500),
        payload,
      },
      artifacts: rows.length > 0 ? [{
        kind: 'table',
        title: `Exported transactions (${rows.length})`,
        columns: ['Date', 'Description', 'Amount', 'Type', 'Category', 'Status'],
        rows: rows.slice(0, 25).map(r => ({
          Date: (r.date || '').slice(0, 10),
          Description: r.description,
          Amount: String(r.amount),
          Type: r.type,
          Category: r.category ?? '—',
          Status: r.status,
        })),
      }] : undefined,
      viewIn: { label: 'View banking', href: '/banking' },
    };
  },
};

registerAction(exportStatementAction);
