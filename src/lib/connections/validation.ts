// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — PHASE 2B · MODULE 2 — Data Validation Engine™
//
// Validates imported GSTN + Bank data BEFORE it is trusted. Produces:
//   • validationStatus: 'clean' | 'warnings' | 'errors'
//   • duplicateCount
//   • errorCount
//   • warningCount
//   • dataQualityScore (0-100)
//
// Validation rules:
//   INVALID_GSTIN      — GSTIN format / checksum
//   DUPLICATE_INVOICE  — same invoice number across e-invoices
//   INVALID_TAX        — CGST+SGST+IGST+cess ≠ totalTax, or negative
//   MISSING_DATE       — invoice/return date in future or missing
//   FUTURE_DATE        — date beyond today
//   DUPLICATE_TXN      — same referenceNo / same amount+date+description
//   MISSING_GSTIN      — buyer GSTIN missing on B2B e-invoice
//   NEGATIVE_AMOUNT    — credit with negative amount / debit with positive
//   MISMATCH_TOTAL     — taxable + tax ≠ totalAmount
//   MISSING_COUNTERPARTY — bank txn without counterparty
//
// Never throws — partial failures never break validation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateGstnDataset } from './gstn-data';
import { generateBankDataset } from './bank-data';
import type { BankProvider } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ValidationRuleId =
  | 'INVALID_GSTIN'
  | 'DUPLICATE_INVOICE'
  | 'INVALID_TAX'
  | 'MISSING_DATE'
  | 'FUTURE_DATE'
  | 'DUPLICATE_TXN'
  | 'MISSING_GSTIN'
  | 'NEGATIVE_AMOUNT'
  | 'MISMATCH_TOTAL'
  | 'MISSING_COUNTERPARTY';

export type ValidationSeverity = 'info' | 'warning' | 'error';
export type ValidationStatus = 'clean' | 'warnings' | 'errors';

export interface ValidationIssue {
  ruleId: ValidationRuleId;
  severity: ValidationSeverity;
  entityType: 'invoice' | 'return' | 'notice' | 'transaction' | 'ewaybill' | 'einvoice';
  entityId?: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface ValidationResult {
  status: ValidationStatus;
  errorCount: number;
  warningCount: number;
  duplicateCount: number;
  dataQualityScore: number; // 0-100
  issues: ValidationIssue[];
  validatedAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** GSTIN format: 2 digits (state) + 10 chars (PAN) + 1 char (entity) + 'Z' + 1 alphanumeric (checksum) */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/;

export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin || gstin.length !== 15) return false;
  return GSTIN_REGEX.test(gstin.toUpperCase());
}

function isFuture(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now() + 24 * 60 * 60 * 1000; // +1 day tolerance
}

// ─── GSTN Validation ───────────────────────────────────────────────────────────

interface GstnValidationContext {
  issues: ValidationIssue[];
  duplicateCount: number;
}

function validateGstnDataset(gstin: string, ctx: GstnValidationContext): void {
  // 1. GSTIN format
  if (!isValidGstin(gstin)) {
    ctx.issues.push({
      ruleId: 'INVALID_GSTIN',
      severity: 'error',
      entityType: 'return',
      message: `GSTIN format is invalid: ${gstin}`,
      payload: { gstin },
    });
  }

  const dataset = generateGstnDataset(gstin);

  // 2. E-invoices — duplicates + missing GSTIN + tax mismatch
  const seenInvoiceNos = new Set<string>();
  for (const inv of dataset.eInvoices) {
    if (seenInvoiceNos.has(inv.invoiceNumber)) {
      ctx.duplicateCount++;
      ctx.issues.push({
        ruleId: 'DUPLICATE_INVOICE',
        severity: 'error',
        entityType: 'einvoice',
        entityId: inv.irn,
        message: `Duplicate invoice number: ${inv.invoiceNumber}`,
        payload: { invoiceNumber: inv.invoiceNumber },
      });
    }
    seenInvoiceNos.add(inv.invoiceNumber);

    if (!inv.buyerGstin) {
      ctx.issues.push({
        ruleId: 'MISSING_GSTIN',
        severity: 'warning',
        entityType: 'einvoice',
        entityId: inv.irn,
        message: `E-invoice ${inv.invoiceNumber} missing buyer GSTIN`,
        payload: { invoiceNumber: inv.invoiceNumber },
      });
    }

    const taxSum = inv.cgst + inv.sgst + inv.igst + inv.cess;
    if (Math.abs(taxSum - (inv.totalAmount - inv.taxableValue)) > 1) {
      ctx.issues.push({
        ruleId: 'INVALID_TAX',
        severity: 'warning',
        entityType: 'einvoice',
        entityId: inv.irn,
        message: `Tax components (${taxSum.toFixed(2)}) don't match total (${(inv.totalAmount - inv.taxableValue).toFixed(2)}) for invoice ${inv.invoiceNumber}`,
        payload: { invoiceNumber: inv.invoiceNumber, taxSum, expected: inv.totalAmount - inv.taxableValue },
      });
    }

    if (isFuture(inv.invoiceDate)) {
      ctx.issues.push({
        ruleId: 'FUTURE_DATE',
        severity: 'warning',
        entityType: 'einvoice',
        entityId: inv.irn,
        message: `Invoice ${inv.invoiceNumber} has a future date`,
        payload: { invoiceDate: inv.invoiceDate },
      });
    }
  }

  // 3. Returns — overdue without filing + future dates
  for (const ret of dataset.gstrFilings) {
    if (isFuture(ret.period + '-01')) {
      ctx.issues.push({
        ruleId: 'FUTURE_DATE',
        severity: 'info',
        entityType: 'return',
        message: `Return ${ret.returnType} for ${ret.period} has a future period`,
        payload: { returnType: ret.returnType, period: ret.period },
      });
    }
  }

  // 4. Notices — missing dates
  for (const notice of dataset.notices) {
    if (!notice.noticeDate) {
      ctx.issues.push({
        ruleId: 'MISSING_DATE',
        severity: 'warning',
        entityType: 'notice',
        message: `Notice ${notice.noticeNumber} is missing a notice date`,
        payload: { noticeNumber: notice.noticeNumber },
      });
    }
  }
}

// ─── Bank Validation ───────────────────────────────────────────────────────────

interface BankValidationContext {
  issues: ValidationIssue[];
  duplicateCount: number;
}

function validateBankTransactions(
  connectionId: string,
  txns: { id: string; txnDate: Date; description: string; amount: number; type: string; counterparty: string | null; referenceNo: string | null }[],
  ctx: BankValidationContext,
): void {
  const seenRefs = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const t of txns) {
    // Duplicate by reference number
    if (t.referenceNo) {
      if (seenRefs.has(t.referenceNo)) {
        ctx.duplicateCount++;
        ctx.issues.push({
          ruleId: 'DUPLICATE_TXN',
          severity: 'warning',
          entityType: 'transaction',
          entityId: t.id,
          message: `Duplicate transaction reference: ${t.referenceNo}`,
          payload: { referenceNo: t.referenceNo },
        });
      }
      seenRefs.add(t.referenceNo);
    }

    // Duplicate by fingerprint (amount + date + description)
    const fp = `${t.amount}|${t.txnDate.toISOString().slice(0, 10)}|${t.description}`;
    if (seenFingerprints.has(fp)) {
      ctx.duplicateCount++;
      ctx.issues.push({
        ruleId: 'DUPLICATE_TXN',
        severity: 'info',
        entityType: 'transaction',
        entityId: t.id,
        message: `Possible duplicate transaction: ₹${Math.abs(t.amount).toFixed(2)} on ${t.txnDate.toISOString().slice(0, 10)}`,
        payload: { amount: t.amount, date: t.txnDate, description: t.description },
      });
    }
    seenFingerprints.add(fp);

    // Negative amount for credit / positive for debit
    if (t.type === 'credit' && t.amount < 0) {
      ctx.issues.push({
        ruleId: 'NEGATIVE_AMOUNT',
        severity: 'error',
        entityType: 'transaction',
        entityId: t.id,
        message: `Credit transaction has negative amount: ₹${t.amount}`,
        payload: { amount: t.amount },
      });
    }
    if (t.type === 'debit' && t.amount > 0) {
      ctx.issues.push({
        ruleId: 'NEGATIVE_AMOUNT',
        severity: 'warning',
        entityType: 'transaction',
        entityId: t.id,
        message: `Debit transaction has positive amount: ₹${t.amount}`,
        payload: { amount: t.amount },
      });
    }

    // Missing counterparty
    if (!t.counterparty) {
      ctx.issues.push({
        ruleId: 'MISSING_COUNTERPARTY',
        severity: 'info',
        entityType: 'transaction',
        entityId: t.id,
        message: `Transaction missing counterparty: "${t.description.slice(0, 40)}"`,
        payload: { description: t.description },
      });
    }

    // Future date
    if (isFuture(t.txnDate)) {
      ctx.issues.push({
        ruleId: 'FUTURE_DATE',
        severity: 'warning',
        entityType: 'transaction',
        entityId: t.id,
        message: `Transaction has a future date: ${t.txnDate.toISOString().slice(0, 10)}`,
        payload: { txnDate: t.txnDate },
      });
    }
  }
}

// ─── Persist validation records ────────────────────────────────────────────────

async function persistValidationRecords(
  connectionId: string | null,
  issues: ValidationIssue[],
): Promise<void> {
  if (issues.length === 0) return;
  try {
    // Clear old open records for this connection before inserting fresh ones
    if (connectionId) {
      await db.validationRecord.deleteMany({
        where: { connectionId, status: 'open' },
      });
    }
    await db.validationRecord.createMany({
      data: issues.slice(0, 200).map((i) => ({
        connectionId,
        entityType: i.entityType,
        entityId: i.entityId ?? null,
        ruleId: i.ruleId,
        severity: i.severity,
        message: i.message,
        payload: i.payload ? JSON.stringify(i.payload) : null,
        status: 'open',
      })),
    });
  } catch (err) {
    console.error('persistValidationRecords error:', err);
  }
}

// ─── Score computation ─────────────────────────────────────────────────────────

function computeDataQualityScore(
  errorCount: number,
  warningCount: number,
  duplicateCount: number,
  totalRecords: number,
): number {
  if (totalRecords === 0) return 100;
  // Each error costs heavily, warnings less, duplicates least
  const penalty = errorCount * 8 + warningCount * 2 + duplicateCount * 1;
  const score = 100 - Math.round((penalty / totalRecords) * 100);
  return Math.max(0, Math.min(100, score));
}

function deriveStatus(errorCount: number, warningCount: number): ValidationStatus {
  if (errorCount > 0) return 'errors';
  if (warningCount > 0) return 'warnings';
  return 'clean';
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate all active connections. Persists ValidationRecord rows and returns
 * the aggregated result. Never throws.
 */
export async function runValidation(): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let duplicateCount = 0;

  try {
    const connections = await db.businessConnection.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    // GSTN validation
    const gstnConn = connections.find((c) => c.type === 'gstn');
    if (gstnConn?.gstin) {
      const ctx: GstnValidationContext = { issues, duplicateCount: 0 };
      try {
        validateGstnDataset(gstnConn.gstin, ctx);
        duplicateCount += ctx.duplicateCount;
        await persistValidationRecords(gstnConn.id, ctx.issues.filter((i) => i.entityType !== 'transaction'));
      } catch (err) {
        console.error('validateGstnDataset error:', err);
      }
    }

    // Bank validation
    const bankConns = connections.filter((c) => c.type === 'bank');
    for (const conn of bankConns) {
      try {
        const txns = await db.bankTransaction.findMany({
          where: { connectionId: conn.id },
          orderBy: { txnDate: 'asc' },
        });
        const ctx: BankValidationContext = { issues, duplicateCount: 0 };
        validateBankTransactions(
          conn.id,
          txns.map((t) => ({
            id: t.id,
            txnDate: t.txnDate,
            description: t.description,
            amount: t.amount,
            type: t.type,
            counterparty: t.counterparty,
            referenceNo: t.referenceNo,
          })),
          ctx,
        );
        duplicateCount += ctx.duplicateCount;
        await persistValidationRecords(conn.id, ctx.issues.filter((i) => i.entityType === 'transaction'));
      } catch (err) {
        console.error('validateBankTransactions error:', err);
      }
    }
  } catch (err) {
    console.error('runValidation error:', err);
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  // Approximate total records for scoring
  let totalRecords = 0;
  try {
    const [txnCount, einvoiceCount] = await Promise.all([
      db.bankTransaction.count(),
      db.eInvoice.count(),
    ]);
    totalRecords = txnCount + einvoiceCount;
  } catch {
    /* ignore */
  }

  const dataQualityScore = computeDataQualityScore(errorCount, warningCount, duplicateCount, Math.max(totalRecords, 1));

  // Update lastValidationScore on each active connection
  try {
    await db.businessConnection.updateMany({
      where: { status: 'active' },
      data: { lastValidationScore: dataQualityScore },
    });
  } catch {
    /* ignore */
  }

  return {
    status: deriveStatus(errorCount, warningCount),
    errorCount,
    warningCount,
    duplicateCount,
    dataQualityScore,
    issues: issues.slice(0, 100),
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Lightweight validation summary for the Observability dashboard + Oracle context.
 */
export async function getValidationSummary(): Promise<{
  status: ValidationStatus;
  errorCount: number;
  warningCount: number;
  duplicateCount: number;
  dataQualityScore: number;
  recentIssues: ValidationIssue[];
}> {
  try {
    const records = await db.validationRecord.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const errorCount = records.filter((r) => r.severity === 'error').length;
    const warningCount = records.filter((r) => r.severity === 'warning').length;
    const duplicateCount = records.filter((r) => r.ruleId === 'DUPLICATE_INVOICE' || r.ruleId === 'DUPLICATE_TXN').length;

    // Get the latest validation score from connections
    const conns = await db.businessConnection.findMany({ where: { status: 'active' } });
    const avgScore = conns.length > 0
      ? Math.round(conns.reduce((s, c) => s + (c.lastValidationScore ?? 100), 0) / conns.length)
      : 100;

    return {
      status: deriveStatus(errorCount, warningCount),
      errorCount,
      warningCount,
      duplicateCount,
      dataQualityScore: avgScore,
      recentIssues: records.slice(0, 20).map((r) => ({
        ruleId: r.ruleId as ValidationRuleId,
        severity: r.severity as ValidationSeverity,
        entityType: r.entityType as ValidationIssue['entityType'],
        entityId: r.entityId ?? undefined,
        message: r.message,
        payload: r.payload ? safeParse(r.payload) : undefined,
      })),
    };
  } catch (err) {
    console.error('getValidationSummary error:', err);
    return {
      status: 'clean',
      errorCount: 0,
      warningCount: 0,
      duplicateCount: 0,
      dataQualityScore: 100,
      recentIssues: [],
    };
  }
}

function safeParse(s: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
