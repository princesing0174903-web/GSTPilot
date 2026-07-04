// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™ (UNIFIED ENTERPRISE DATA BRAIN)
// Enterprise Data Quality Engine™ — continuous scanning of REAL production data.
// Extends the existing DataQualityAlert table with computed issues + suggested fixes.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataQualityAlert as PrismaQualityAlertRow } from '@prisma/client';

import {
  db,
  safeFindMany,
  safeCount,
  countBy,
  sumBy,
  cached,
  TTL,
} from './helpers';
import type { DataQualityIssue } from './types';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type QualitySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface QualitySummary {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  openIssues: number;
  avgQualityScore: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** System user id used for alerts NOT tied to a specific connector. */
const SYSTEM_USER_ID = 'system';

/** Category → human-readable suggested fix. */
const SUGGESTED_FIX: Record<string, string> = {
  duplicate: 'Merge master records',
  missing_invoice: 'Re-sync connector',
  gst_mismatch: 'Reconcile ITC',
  reconciliation: 'Match payment to invoice',
  stale_data: 'Trigger connector sync',
  employee_kyc: 'Collect KYC documents',
  gstr_nil_mismatch: 'Reconcile filing with invoices',
};

/** Category → canonical dataset key. */
const DATASET_KEY_BY_CATEGORY: Record<string, string> = {
  duplicate: 'synced_records',
  missing_invoice: 'invoices',
  gst_mismatch: 'purchase_bills',
  reconciliation: 'payments',
  stale_data: 'data_connections',
  employee_kyc: 'employees',
  gstr_nil_mismatch: 'gstr_filings',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a connector syncInterval like '15m' | '1h' | '6h' | 'daily' → minutes. */
function parseSyncIntervalMinutes(interval: string | null | undefined): number {
  if (!interval) return 60;
  const lower = interval.toLowerCase().trim();
  if (lower === 'daily') return 1440;
  const m = lower.match(/^(\d+)\s*(m|h|d)$/);
  if (!m) return 60;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n <= 0) return 60;
  if (m[2] === 'm') return n;
  if (m[2] === 'h') return n * 60;
  return n * 1440;
}

function mapAlert(row: PrismaQualityAlertRow): DataQualityIssue {
  return {
    id: row.id,
    datasetKey: DATASET_KEY_BY_CATEGORY[row.category] ?? null,
    severity: row.severity as QualitySeverity,
    category: row.category,
    title: row.title,
    description: row.description ?? '',
    amount: row.amount,
    suggestedFix: SUGGESTED_FIX[row.category] ?? null,
    status: row.resolved ? 'resolved' : 'open',
    detectedAt: row.createdAt.toISOString(),
  };
}

// ─── Quality Scan ─────────────────────────────────────────────────────────────

/**
 * Scan REAL production data and upsert DataQualityAlert rows for 7 categories.
 * Idempotent: an open alert with the same (category, title, connectionId) is
 * not duplicated on re-scan. Resolved alerts are preserved as history.
 *
 * Returns the full alerts list (open + resolved).
 */
export async function runQualityScan(): Promise<DataQualityIssue[]> {
  // Snapshot existing OPEN alerts so we don't duplicate them on each scan.
  const existingOpen = await safeFindMany(() =>
    db.dataQualityAlert.findMany({
      where: { resolved: false },
      select: { category: true, title: true, connectionId: true },
    }),
  );
  const openKeys = new Set(
    existingOpen.map(
      (a) => `${a.category}|${a.title}|${a.connectionId ?? ''}`,
    ),
  );

  function isOpenKey(
    category: string,
    title: string,
    connectionId?: string | null,
  ): boolean {
    return openKeys.has(`${category}|${title}|${connectionId ?? ''}`);
  }

  async function createAlert(input: {
    userId?: string;
    connectionId?: string | null;
    severity: QualitySeverity;
    category: string;
    title: string;
    description: string;
    amount?: number | null;
  }): Promise<void> {
    if (isOpenKey(input.category, input.title, input.connectionId ?? null)) return;
    try {
      await db.dataQualityAlert.create({
        data: {
          userId: input.userId ?? SYSTEM_USER_ID,
          connectionId: input.connectionId ?? null,
          severity: input.severity,
          category: input.category,
          title: input.title,
          description: input.description,
          amount: input.amount ?? null,
          resolved: false,
        },
      });
      openKeys.add(
        `${input.category}|${input.title}|${input.connectionId ?? ''}`,
      );
    } catch {
      // Defensive — a single failed insert must not abort the whole scan.
    }
  }

  // (a) Duplicate SyncedRecords by externalId.
  const syncedRecords = await safeFindMany(() =>
    db.syncedRecord.findMany({
      select: {
        id: true,
        externalId: true,
        connectionId: true,
        amount: true,
        title: true,
      },
    }),
  );
  const byExternal = new Map<
    string,
    Array<{
      id: string;
      connectionId: string;
      amount: number | null;
      title: string | null;
    }>
  >();
  for (const r of syncedRecords) {
    if (!r.externalId) continue;
    const list = byExternal.get(r.externalId) ?? [];
    list.push({
      id: r.id,
      connectionId: r.connectionId,
      amount: r.amount,
      title: r.title,
    });
    byExternal.set(r.externalId, list);
  }
  for (const [externalId, dupes] of byExternal) {
    if (dupes.length < 2) continue;
    const severity: QualitySeverity = dupes.length >= 5 ? 'high' : 'medium';
    const totalAmount = sumBy(dupes, (d) => d.amount ?? 0);
    await createAlert({
      userId: SYSTEM_USER_ID,
      connectionId: dupes[0]?.connectionId ?? null,
      severity,
      category: 'duplicate',
      title: `Duplicate SyncedRecord: externalId=${externalId} (${dupes.length} copies)`,
      description: `${dupes.length} records share externalId "${externalId}". Record IDs: ${dupes
        .slice(0, 6)
        .map((d) => d.id)
        .join(', ')}${dupes.length > 6 ? ` … (+${dupes.length - 6} more)` : ''}.`,
      amount: totalAmount,
    });
  }

  // (b) Invoices missing client linkage — sellerGstin on the invoice does not
  // match the linked Client's gstin (i.e. invoice is not correctly linked to
  // the right business master record).
  const clients = await safeFindMany(() =>
    db.client.findMany({ select: { id: true, gstin: true, tradeName: true, status: true } }),
  );
  const clientByGstin = new Map(clients.map((c) => [c.gstin, c]));
  const invoices = await safeFindMany(() =>
    db.invoice.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        sellerGstin: true,
        clientId: true,
        totalAmount: true,
        status: true,
      },
    }),
  );
  for (const inv of invoices) {
    const linkedClient = clients.find((c) => c.id === inv.clientId);
    if (!linkedClient) {
      // FK enforced so this is rare, but flag defensively.
      await createAlert({
        severity: 'critical',
        category: 'missing_invoice',
        title: `Invoice ${inv.invoiceNumber} has no linked client`,
        description: `Invoice ${inv.id} (${inv.invoiceNumber}) has clientId=${inv.clientId} but no matching Client row.`,
        amount: inv.totalAmount,
      });
      continue;
    }
    // The linked client must be the party on the invoice (gstin match).
    if (linkedClient.gstin !== inv.sellerGstin) {
      // Could be that sellerGstin is OUR business and client is the buyer —
      // only flag when the seller is also a tracked Client (B2B self-invoice case).
      if (clientByGstin.has(inv.sellerGstin)) {
        await createAlert({
          severity: 'high',
          category: 'missing_invoice',
          title: `Invoice ${inv.invoiceNumber} sellerGstin mismatches linked client`,
          description: `Invoice ${inv.id} is linked to client "${linkedClient.tradeName}" (gstin ${linkedClient.gstin}) but sellerGstin is ${inv.sellerGstin} which matches a different client master record.`,
          amount: inv.totalAmount,
        });
      }
    }
    if (linkedClient.status && linkedClient.status !== 'active') {
      await createAlert({
        severity: 'medium',
        category: 'missing_invoice',
        title: `Invoice ${inv.invoiceNumber} linked to inactive client`,
        description: `Invoice ${inv.id} is linked to client "${linkedClient.tradeName}" (status=${linkedClient.status}). Client linkage is stale.`,
        amount: inv.totalAmount,
      });
    }
  }

  // (c) PurchaseBills with GST mismatch vs invoices — internal GST component
  // inconsistency: gstAmount should equal cgst + sgst + igst + cess. Anything
  // else means the bill's tax breakdown doesn't reconcile.
  const purchaseBills = await safeFindMany(() =>
    db.purchaseBill.findMany({
      select: {
        id: true,
        invoiceNo: true,
        vendorName: true,
        gstAmount: true,
        cgst: true,
        sgst: true,
        igst: true,
        cess: true,
        totalAmount: true,
      },
    }),
  );
  for (const pb of purchaseBills) {
    const componentSum = (pb.cgst ?? 0) + (pb.sgst ?? 0) + (pb.igst ?? 0) + (pb.cess ?? 0);
    const diff = Math.abs((pb.gstAmount ?? 0) - componentSum);
    if (diff > 1) {
      await createAlert({
        severity: 'high',
        category: 'gst_mismatch',
        title: `Purchase bill ${pb.invoiceNo} GST mismatch`,
        description: `PurchaseBill ${pb.id} from "${pb.vendorName}" (invoice ${pb.invoiceNo}) has gstAmount=${pb.gstAmount?.toFixed(2)} but component sum (cgst+sgst+igst+cess)=${componentSum.toFixed(2)} — diff ₹${diff.toFixed(2)}. ITC reconciliation will fail.`,
        amount: diff,
      });
    }
  }

  // (d) Payments unmatched to invoices — customer payments with invoiceId null.
  const payments = await safeFindMany(() =>
    db.payment.findMany({
      select: {
        id: true,
        partyName: true,
        partyType: true,
        invoiceId: true,
        amount: true,
        paymentDate: true,
        referenceNo: true,
      },
    }),
  );
  for (const p of payments) {
    if (p.invoiceId) continue;
    if (p.partyType && p.partyType !== 'customer') continue;
    await createAlert({
      severity: 'medium',
      category: 'reconciliation',
      title: `Unmatched payment from ${p.partyName}`,
      description: `Payment ${p.id} of ₹${p.amount?.toFixed(2) ?? '0.00'} on ${p.paymentDate} from "${p.partyName}" has no linked invoice (reference ${p.referenceNo ?? 'n/a'}). Reconciliation required.`,
      amount: p.amount,
    });
  }

  // (e) Stale DataConnections — lastSyncAt older than syncInterval.
  const connections = await safeFindMany(() =>
    db.dataConnection.findMany({
      select: {
        id: true,
        userId: true,
        type: true,
        label: true,
        syncInterval: true,
        lastSyncAt: true,
      },
    }),
  );
  const nowMs = Date.now();
  for (const conn of connections) {
    if (!conn.lastSyncAt) {
      await createAlert({
        userId: conn.userId,
        connectionId: conn.id,
        severity: 'high',
        category: 'stale_data',
        title: `Connector "${conn.label}" has never synced`,
        description: `DataConnection ${conn.id} (type=${conn.type}, label="${conn.label}") has lastSyncAt=null. No data has ever been ingested.`,
      });
      continue;
    }
    const intervalMin = parseSyncIntervalMinutes(conn.syncInterval);
    const lastMs = conn.lastSyncAt.getTime();
    const elapsedMin = (nowMs - lastMs) / 60_000;
    if (elapsedMin > intervalMin) {
      const overdueBy = elapsedMin - intervalMin;
      const severity: QualitySeverity = overdueBy > intervalMin * 2 ? 'high' : 'medium';
      await createAlert({
        userId: conn.userId,
        connectionId: conn.id,
        severity,
        category: 'stale_data',
        title: `Connector "${conn.label}" sync is stale`,
        description: `DataConnection ${conn.id} (type=${conn.type}, interval=${conn.syncInterval}) last synced ${Math.round(elapsedMin)} min ago — overdue by ${Math.round(overdueBy)} min.`,
      });
    }
  }

  // (f) Employees missing PAN/Aadhaar.
  const employees = await safeFindMany(() =>
    db.employee.findMany({
      select: {
        id: true,
        name: true,
        employeeId: true,
        pan: true,
        aadhaar: true,
        designation: true,
        department: true,
      },
    }),
  );
  for (const emp of employees) {
    const missingPAN = !emp.pan || emp.pan.trim() === '';
    const missingAadhaar = !emp.aadhaar || emp.aadhaar.trim() === '';
    if (!missingPAN && !missingAadhaar) continue;
    const missingFields: string[] = [];
    if (missingPAN) missingFields.push('PAN');
    if (missingAadhaar) missingFields.push('Aadhaar');
    await createAlert({
      severity: 'high',
      category: 'employee_kyc',
      title: `Employee ${emp.name} missing ${missingFields.join(' + ')}`,
      description: `Employee ${emp.id} (${emp.name}${emp.employeeId ? `, code=${emp.employeeId}` : ''}${emp.designation ? `, ${emp.designation}` : ''}) is missing KYC field(s): ${missingFields.join(', ')}. Payroll/TDS filing blocked.`,
    });
  }

  // (g) GSTRFilings with nil liability but non-zero invoices in period.
  const filings = await safeFindMany(() =>
    db.gSTRFiling.findMany({
      select: {
        id: true,
        returnType: true,
        period: true,
        status: true,
        totalInvoices: true,
        totalTax: true,
        totalTaxableValue: true,
        clientId: true,
      },
    }),
  );
  for (const f of filings) {
    const nilTax = (f.totalTax ?? 0) < 1;
    const hasInvoices = (f.totalInvoices ?? 0) > 0 || (f.totalTaxableValue ?? 0) > 0;
    if (nilTax && hasInvoices) {
      await createAlert({
        severity: 'high',
        category: 'gstr_nil_mismatch',
        title: `GSTR-${f.returnType} ${f.period} claims nil tax but has invoices`,
        description: `GSTRFiling ${f.id} (type=${f.returnType}, period=${f.period}, status=${f.status}) reports totalTax=${f.totalTax?.toFixed(2)} (nil) but totalInvoices=${f.totalInvoices} and totalTaxableValue=${f.totalTaxableValue?.toFixed(2)}. Filing understates liability.`,
        amount: f.totalTaxableValue ?? null,
      });
    }
  }

  // Return the full current alerts list (open + resolved) as DataQualityIssue[].
  const allAlerts = await safeFindMany(() =>
    db.dataQualityAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  );
  return allAlerts.map(mapAlert);
}

// ─── Read API ─────────────────────────────────────────────────────────────────

/** Return all DataQualityAlert rows mapped to DataQualityIssue[] (with suggestedFix). */
export async function getQualityIssues(): Promise<DataQualityIssue[]> {
  return cached('di:quality:issues', TTL.SHORT, async () => {
    const rows = await safeFindMany(() =>
      db.dataQualityAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    );
    return rows.map(mapAlert);
  });
}

/** Aggregate summary of all quality alerts — computed from REAL rows. */
export async function getQualitySummary(): Promise<QualitySummary> {
  return cached('di:quality:summary', TTL.SHORT, async () => {
    const rows = await safeFindMany(() =>
      db.dataQualityAlert.findMany({
        select: {
          severity: true,
          category: true,
          resolved: true,
        },
      }),
    );

    const bySeverity = countBy(rows, (r) => r.severity);
    const byCategory = countBy(rows, (r) => r.category);
    const openIssues = rows.filter((r) => !r.resolved).length;

    const critical = bySeverity.critical ?? 0;
    const high = bySeverity.high ?? 0;
    const medium = bySeverity.medium ?? 0;
    const avgQualityScore = Math.max(0, 100 - critical * 5 - high * 3 - medium * 1);

    return {
      totalIssues: rows.length,
      bySeverity,
      byCategory,
      openIssues,
      avgQualityScore,
    };
  });
}

/** Mark a DataQualityAlert resolved=true, resolvedAt=now. Real state change. */
export async function repairIssue(
  issueId: string,
): Promise<DataQualityIssue | null> {
  try {
    const updated = await db.dataQualityAlert.update({
      where: { id: issueId },
      data: { resolved: true, resolvedAt: new Date() },
    });
    return mapAlert(updated);
  } catch {
    return null;
  }
}

// safeCount re-exported for callers that want to count without crashing.
export { safeCount };
