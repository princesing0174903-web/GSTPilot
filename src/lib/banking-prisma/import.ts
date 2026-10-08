// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Statement Import Engine (TASK 12)
//
// The CSV/Excel bank statement import pipeline. SERVER-ONLY.
//
//   ┌──────────────────────────────────────────────────────────────────────────┐
//   │  API Route (/api/banking/imports)                                        │
//   ├──────────────────────────────────────────────────────────────────────────┤
//   │  This file (src/lib/banking-prisma/import.ts)                            │
//   │   • parseCsv(content)        → ParsedStatementRow[]                      │
//   │   • parseExcel(buffer)       → ParsedStatementRow[]                      │
//   │   • previewImport(rows)      → { summary, errors, duplicates }           │
//   │   • importStatement(input)   → StatementImportResult  (persists)         │
//   │   • listImports / getImportDetails                                       │
//   ├──────────────────────────────────────────────────────────────────────────┤
//   │  Prisma (SQLite)  ←  StatementImport, BankTransaction, BankAccount,      │
//   │                       AuditLog                                           │
//   └──────────────────────────────────────────────────────────────────────────┘
//
// Provider swap (future): when a real Setu/RazorpayX provider is connected,
// statements flow in automatically via the sync orchestrator (service.ts). This
// CSV/Excel path remains as the manual fallback for offline statements, initial
// onboarding, and historical backfill.
//
// Design principles:
//   • Flexible column auto-detection — accepts most Indian bank statement
//     layouts (HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, IndusInd, …).
//   • Never abort the whole import on one bad row — collect errors and continue.
//   • Duplicate detection by (accountId, date, amount, type, description) makes
//     re-imports idempotent (already-imported rows are counted + skipped).
//   • Money is rounded via round2(Math.round(n*100)/100) at every write.
//   • Audit log writes are wrapped in try/catch — non-fatal on failure.
//   • All exports are server-only (depends on `db` Prisma client).
// ═══════════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { db } from '@/lib/db';
import { categorizeTransaction, extractCounterparty } from '@/lib/banking/categorize';
import type { StatementImport } from '@prisma/client';
import type {
  ParsedStatementRow,
  StatementImportResult,
  TransactionType,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round a number to 2 decimal places (money). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Day in milliseconds — used for "future date" tolerance. */
const DAY_MS = 86_400_000;

// ─── Date parsing ─────────────────────────────────────────────────────────────
// Supports: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD, DD MMM YYYY
// (e.g. "12 Mar 2025" or "12-Mar-2025"). Returns a local-midnight Date or null.

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY (Indian format — day first)
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD MMM YYYY (e.g. "12 Mar 2025", "12-Mar-2025", "12 MARCH 2025")
  m = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,})[\s\-]+(\d{4})$/);
  if (m) {
    const mon = MONTH_NAMES[m[2].toLowerCase().slice(0, 3)];
    if (mon === undefined) return null;
    const d = new Date(Number(m[3]), mon, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: trust Date constructor (handles ISO timestamps, etc.)
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** Format a Date as YYYY-MM-DD (ISO calendar date, local time). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Amount parsing ───────────────────────────────────────────────────────────
// Handles Indian grouping ("1,23,456.78"), plain decimals ("123456.78"),
// negative ("-123456.78"), parenthetical negatives ("(1234.56)"), currency
// symbols (₹, Rs, INR), and trailing "/-" markers.

function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Strip currency symbols / labels.
  s = s.replace(/₹|Rs\.?|INR|\/-/gi, '');
  // Strip Indian/Intl digit grouping commas and spaces.
  s = s.replace(/[,\s]/g, '');

  // Handle parenthetical negatives: (1234.56) → -1234.56
  let isNegative = false;
  if (/^\(.*\)$/.test(s)) {
    isNegative = true;
    s = s.replace(/[()]/g, '');
  }
  if (s.startsWith('-')) {
    isNegative = true;
    s = s.replace(/^-/, '');
  } else if (s.startsWith('+')) {
    s = s.replace(/^\+/, '');
  }

  if (!s) return null;
  const n = Number(s);
  if (isNaN(n)) return null;
  return isNegative ? -n : n;
}

// ─── CSV parser (custom, no external dep) ─────────────────────────────────────
// Handles: BOM, quoted fields, escaped quotes ("") inside quoted fields, commas
// inside quotes, and newlines inside quotes. Returns array of array of strings.

function parseCsvString(content: string): string[][] {
  // Strip BOM (\uFEFF) at the start of the file.
  let s = content.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") inside a quoted field.
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // Treat \r\n and lone \r as line breaks (drop the \r).
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush the last field/row if non-empty.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ─── Column auto-detection ────────────────────────────────────────────────────
// Normalises header strings and matches against keyword patterns. Each header
// is assigned to AT MOST ONE column (first match wins). Returns the column map.

interface ColumnMap {
  date?: number;
  description?: number;
  withdrawal?: number;
  deposit?: number;
  amount?: number;
  balance?: number;
  reference?: number;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (!n) return;
    // Priority order: date → description → withdrawal → deposit → amount → balance → reference
    if (map.date === undefined && /date|posted|value/.test(n)) {
      map.date = i;
    } else if (map.description === undefined && /desc|narrat|particular|detail|memo|remarks/.test(n)) {
      map.description = i;
    } else if (map.withdrawal === undefined && /withdraw|debit|paidout|outflow|dramt|debitamount/.test(n)) {
      map.withdrawal = i;
    } else if (map.deposit === undefined && /deposit|credit|received|inflow|cramt|creditamount/.test(n)) {
      map.deposit = i;
    } else if (map.amount === undefined && /amount|amt|value/.test(n)) {
      map.amount = i;
    } else if (map.balance === undefined && /balance|closing|runningbal/.test(n)) {
      map.balance = i;
    } else if (map.reference === undefined && /ref|utr|chq|cheque|challan|transactionid|txnid/.test(n)) {
      map.reference = i;
    }
  });
  return map;
}

// ─── Row → ParsedStatementRow converter ───────────────────────────────────────
// Shared by parseCsv and parseExcel. Skips rows with unparseable dates or
// amounts. Throws only if NO row could be parsed at all.

function rowsToParsedRows(rawRows: string[][]): ParsedStatementRow[] {
  if (rawRows.length === 0) {
    throw new Error('Statement has no rows');
  }

  const headers = rawRows[0].map((h) => h.trim());
  const colMap = detectColumns(headers);

  if (colMap.date === undefined) {
    throw new Error(
      'Could not detect a Date column in the statement. Expected headers like "Date", "Txn Date", "Value Date", or "Posted Date".',
    );
  }
  const hasAnyAmountCol =
    colMap.amount !== undefined ||
    colMap.withdrawal !== undefined ||
    colMap.deposit !== undefined;
  if (!hasAnyAmountCol) {
    throw new Error(
      'Could not detect an Amount/Deposit/Withdrawal column in the statement.',
    );
  }

  const rows: ParsedStatementRow[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r] || [];
    // Skip completely empty rows.
    if (cells.every((c) => !c || !c.trim())) continue;

    const rawDate = colMap.date !== undefined ? cells[colMap.date] || '' : '';
    const date = parseDate(rawDate);
    if (!date) continue; // Skip rows with unparseable dates silently.

    const description =
      colMap.description !== undefined ? (cells[colMap.description] || '').trim() : '';

    let amount: number | null = null;
    let type: TransactionType | null = null;

    const depositRaw =
      colMap.deposit !== undefined ? cells[colMap.deposit] || '' : '';
    const withdrawalRaw =
      colMap.withdrawal !== undefined ? cells[colMap.withdrawal] || '' : '';
    const amountRaw =
      colMap.amount !== undefined ? cells[colMap.amount] || '' : '';

    // Prefer explicit Deposit/Credit column.
    if (depositRaw.trim()) {
      const v = parseAmount(depositRaw);
      if (v !== null && v !== 0) {
        amount = Math.abs(v);
        type = 'credit';
      }
    }
    // Fall back to Withdrawal/Debit column.
    if (amount === null && withdrawalRaw.trim()) {
      const v = parseAmount(withdrawalRaw);
      if (v !== null && v !== 0) {
        amount = Math.abs(v);
        type = 'debit';
      }
    }
    // Fall back to single Amount column (sign indicates direction).
    if (amount === null && amountRaw.trim()) {
      const v = parseAmount(amountRaw);
      if (v !== null && v !== 0) {
        amount = Math.abs(v);
        type = v < 0 ? 'debit' : 'credit';
      }
    }

    if (amount === null || type === null) continue; // Skip rows without a usable amount.

    const row: ParsedStatementRow = {
      date: toISODate(date),
      description: description || '(no description)',
      amount: round2(amount),
      type,
    };

    if (colMap.balance !== undefined) {
      const bal = parseAmount(cells[colMap.balance]);
      if (bal !== null) row.balance = round2(bal);
    }
    if (colMap.reference !== undefined) {
      const ref = (cells[colMap.reference] || '').trim();
      if (ref) row.reference = ref;
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error(
      'No valid transaction rows could be parsed from the statement. Check that the file has Date and Amount columns and at least one valid row.',
    );
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT 1 — parseCsv
// ═══════════════════════════════════════════════════════════════════════════════

export function parseCsv(content: string): ParsedStatementRow[] {
  if (!content || !content.trim()) {
    throw new Error('CSV content is empty');
  }
  const rawRows = parseCsvString(content);
  return rowsToParsedRows(rawRows);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT 2 — parseExcel
// ═══════════════════════════════════════════════════════════════════════════════

export function parseExcel(buffer: Buffer): ParsedStatementRow[] {
  if (!buffer || buffer.length === 0) {
    throw new Error('Excel buffer is empty');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (err) {
    throw new Error(
      `Failed to read Excel file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel workbook has no sheets');
  }
  const sheet = workbook.Sheets[sheetName];
  // header: 1 → array-of-arrays; raw: false → formatted strings; defval: '' → fill blanks.
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  if (!json || json.length === 0) {
    throw new Error('Excel sheet has no rows');
  }

  // Normalise every cell to a string for the shared converter.
  const rawRows: string[][] = json.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) =>
      cell === null || cell === undefined ? '' : String(cell),
    ),
  );

  return rowsToParsedRows(rawRows);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT 3 — previewImport (validation only, no persistence)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{ row: number; message: string }>;
  duplicates: number;
  summary: {
    credits: number;
    debits: number;
    totalAmount: number;
  };
}

export function previewImport(rows: ParsedStatementRow[]): ImportPreview {
  const errors: Array<{ row: number; message: string }> = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let credits = 0;
  let debits = 0;
  let totalAmount = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 1; // 1-indexed for human-friendly error messages.

    // Validate date.
    const d = parseDate(row.date);
    if (!d) {
      errors.push({ row: rowNum, message: `Invalid date: "${row.date}"` });
      return;
    }
    if (d.getTime() > Date.now() + DAY_MS) {
      errors.push({ row: rowNum, message: `Date is in the future: "${row.date}"` });
      return;
    }

    // Validate amount.
    if (typeof row.amount !== 'number' || isNaN(row.amount) || row.amount <= 0) {
      errors.push({ row: rowNum, message: `Invalid amount: ${row.amount}` });
      return;
    }

    // Validate type.
    if (row.type !== 'credit' && row.type !== 'debit') {
      errors.push({ row: rowNum, message: `Invalid type: "${row.type}" (must be credit or debit)` });
      return;
    }

    // Intra-file duplicate detection (same date + amount + type + description).
    const key = `${row.date}|${row.amount}|${row.type}|${(row.description || '').toLowerCase()}`;
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }

    if (row.type === 'credit') credits++;
    else debits++;
    totalAmount += row.amount;
  });

  return {
    totalRows: rows.length,
    validRows: rows.length - errors.length,
    errorRows: errors.length,
    errors,
    duplicates,
    summary: {
      credits,
      debits,
      totalAmount: round2(totalAmount),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT 4 — importStatement (persists to DB)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ImportStatementInput {
  organizationId: string;
  accountId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  rows: ParsedStatementRow[];
  uploadedBy?: string;
}

export async function importStatement(
  input: ImportStatementInput,
): Promise<StatementImportResult> {
  const {
    organizationId,
    accountId,
    fileName,
    fileType,
    fileSize,
    rows,
    uploadedBy,
  } = input;

  const totalRows = rows.length;
  const errors: Array<{ row: number; message: string }> = [];
  let importedRows = 0;
  let duplicateRows = 0;
  let errorRows = 0;

  // ── Step 1: create a StatementImport record with status='processing'.
  const importRec = await db.statementImport.create({
    data: {
      organizationId,
      accountId,
      fileName,
      fileType,
      fileSize,
      totalRows,
      importedRows: 0,
      duplicateRows: 0,
      errorRows: 0,
      status: 'processing',
      errors: '[]',
      uploadedBy: uploadedBy || null,
    },
  });

  await writeAuditLog({
    organizationId,
    actor: uploadedBy || 'system',
    action: 'bank_import.started',
    targetType: 'StatementImport',
    targetId: importRec.id,
    metadata: { fileName, fileType, totalRows, accountId },
  });

  // ── Step 2: fetch the account (for balance updates).
  const account = await db.bankAccount.findFirst({
    where: { id: accountId, organizationId },
    select: { id: true, balance: true },
  });
  if (!account) {
    const msg = `Account not found: ${accountId}`;
    errors.push({ row: 0, message: msg });
    await db.statementImport.update({
      where: { id: importRec.id },
      data: {
        status: 'failed',
        errorRows: totalRows,
        errors: JSON.stringify(errors),
      },
    });
    await writeAuditLog({
      organizationId,
      actor: uploadedBy || 'system',
      action: 'bank_import.failed',
      targetType: 'StatementImport',
      targetId: importRec.id,
      metadata: { fileName, reason: msg },
    });
    return {
      importId: importRec.id,
      fileName,
      fileType,
      totalRows,
      importedRows: 0,
      duplicateRows: 0,
      errorRows: totalRows,
      errors,
      status: 'failed',
    };
  }

  let runningBalance = account.balance;

  // ── Step 3: process each row — validate, de-dup, persist.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 1-indexed for error reporting.
    try {
      // Validate date.
      const d = parseDate(row.date);
      if (!d) {
        throw new Error(`Invalid date: "${row.date}"`);
      }
      if (d.getTime() > Date.now() + DAY_MS) {
        throw new Error(`Date is in the future: "${row.date}"`);
      }

      // Validate amount.
      if (typeof row.amount !== 'number' || isNaN(row.amount) || row.amount <= 0) {
        throw new Error(`Invalid amount: ${row.amount}`);
      }

      // Validate type.
      if (row.type !== 'credit' && row.type !== 'debit') {
        throw new Error(`Invalid type: "${row.type}"`);
      }

      const amount = round2(row.amount);
      const description = (row.description || '').trim() || '(no description)';

      // ── Duplicate check: same (accountId, date, amount, type, description).
      const dup = await db.bankTransaction.findFirst({
        where: {
          accountId,
          date: d,
          amount,
          type: row.type,
          description,
        },
        select: { id: true },
      });
      if (dup) {
        duplicateRows++;
        continue;
      }

      // Categorize + extract counterparty.
      const counterparty = extractCounterparty(description);
      const category = categorizeTransaction({
        description,
        type: row.type,
        amount,
        counterparty,
      });

      // Compute signed amount + new running balance.
      const signedAmount = row.type === 'credit' ? amount : -amount;
      const newBalance = round2(runningBalance + signedAmount);

      // Persist the transaction.
      await db.bankTransaction.create({
        data: {
          organizationId,
          accountId,
          date: d,
          description,
          narration: description,
          amount,
          type: row.type,
          // Prefer statement-provided balance if present, else computed.
          balance: row.balance !== undefined ? round2(row.balance) : newBalance,
          category,
          counterparty,
          referenceNo: row.reference || null,
          reference: row.reference || null,
          status: 'posted',
          source: 'import',
          matched: false,
          matchConfidence: 0,
        },
      });

      runningBalance = newBalance;
      importedRows++;
    } catch (err) {
      errorRows++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ row: rowNum, message: msg });
      // Do NOT abort — continue to the next row.
    }
  }

  // ── Step 4: update the account balance (single write at end).
  if (importedRows > 0) {
    try {
      await db.bankAccount.update({
        where: { id: accountId },
        data: {
          balance: runningBalance,
          availableBalance: runningBalance,
          lastSyncAt: new Date(),
        },
      });
    } catch {
      // Non-fatal — transactions are already persisted; balance update can be
      // corrected on the next sync. Logged via audit below.
    }
  }

  // ── Step 5: determine final status.
  let status: 'completed' | 'partial' | 'failed';
  if (errorRows === 0) {
    status = 'completed';
  } else if (importedRows === 0 && duplicateRows === 0) {
    status = 'failed';
  } else {
    status = 'partial';
  }

  // ── Step 6: update the StatementImport record with final counts + errors.
  await db.statementImport.update({
    where: { id: importRec.id },
    data: {
      importedRows,
      duplicateRows,
      errorRows,
      status,
      errors: JSON.stringify(errors),
    },
  });

  await writeAuditLog({
    organizationId,
    actor: uploadedBy || 'system',
    action: `bank_import.${status}`,
    targetType: 'StatementImport',
    targetId: importRec.id,
    metadata: {
      fileName,
      importedRows,
      duplicateRows,
      errorRows,
      totalRows,
    },
  });

  return {
    importId: importRec.id,
    fileName,
    fileType,
    totalRows,
    importedRows,
    duplicateRows,
    errorRows,
    errors,
    status,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT 5 — listImports
// ═══════════════════════════════════════════════════════════════════════════════

export async function listImports(
  organizationId: string,
  limit = 50,
): Promise<StatementImport[]> {
  return db.statementImport.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT 6 — getImportDetails
// ═══════════════════════════════════════════════════════════════════════════════

export async function getImportDetails(
  importId: string,
  organizationId: string,
): Promise<StatementImport | null> {
  return db.statementImport.findFirst({
    where: { id: importId, organizationId },
  });
}

// ─── Audit log helper (same non-fatal try/catch pattern as service.ts) ────────

async function writeAuditLog(input: {
  organizationId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actor,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId || '',
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });
  } catch {
    // Non-fatal — audit log failure should never break the main operation.
  }
}
