// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Conflict Resolution Engine (SERVER)
//
// Handles the conflicts that arise during ERP sync:
//   • Duplicate customers (same GSTIN/name in ERP and VEYRO)
//   • Duplicate invoices (same invoice number)
//   • Deleted records (in ERP but marked active in VEYRO)
//   • Modified records (different amount/date on re-sync)
//   • Version conflicts (concurrent edits)
//   • Sync failures (partial data)
//
// Pure functions — no Firebase imports. The orchestrator calls these to decide
// what to write to Firestore.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ERPCustomer,
  ERPInvoice,
  ERPInventoryItem,
  ERPLedger,
} from '../types';

// ─── Conflict types ───────────────────────────────────────────────────────────

export type ConflictType =
  | 'duplicate_customer'
  | 'duplicate_invoice'
  | 'deleted_record'
  | 'modified_record'
  | 'version_conflict'
  | 'sync_failure';

export type ResolutionStrategy =
  | 'skip'           // keep existing, ignore ERP record
  | 'overwrite'      // replace existing with ERP record
  | 'merge'          // combine fields (ERP wins on financials)
  | 'create_new'     // create a new VEYRO record
  | 'flag_manual'    // flag for manual review
  | 'retry';         // retry the sync

export interface Conflict {
  type: ConflictType;
  entityId: string;
  entityKind: 'customer' | 'invoice' | 'ledger' | 'inventory';
  description: string;
  resolution: ResolutionStrategy;
  /** The ERP record (if applicable). */
  erpRecord?: unknown;
  /** The existing VEYRO record (if applicable). */
  existingRecord?: unknown;
  /** Fields that differ (for modified records). */
  diff?: Array<{ field: string; erpValue: unknown; existingValue: unknown }>;
}

// ─── Duplicate customer resolution ────────────────────────────────────────────

/**
 * Detect + resolve duplicate customers.
 * Strategy: if GSTIN matches → merge (ERP wins on outstanding balance).
 *           if name matches (no GSTIN) → flag for manual review.
 */
export function resolveDuplicateCustomer(
  erpCustomer: ERPCustomer,
  existing: Array<{ id: string; name: string; gstin?: string | null }>,
): { conflict: Conflict | null; action: 'skip' | 'merge' | 'create_new'; existingId?: string } {
  if (erpCustomer.gstin) {
    const match = existing.find(
      (c) => c.gstin && c.gstin.toUpperCase() === erpCustomer.gstin!.toUpperCase(),
    );
    if (match) {
      return {
        conflict: {
          type: 'duplicate_customer',
          entityId: match.id,
          entityKind: 'customer',
          description: `ERP customer '${erpCustomer.name}' matches existing client by GSTIN ${erpCustomer.gstin}.`,
          resolution: 'merge',
          erpRecord: erpCustomer,
          existingRecord: match,
        },
        action: 'merge',
        existingId: match.id,
      };
    }
  }
  const normalizedName = normalize(erpCustomer.name);
  const nameMatch = existing.find((c) => normalize(c.name) === normalizedName);
  if (nameMatch) {
    // Name matches but GSTIN doesn't (or one is null) — flag for manual review.
    return {
      conflict: {
        type: 'duplicate_customer',
        entityId: nameMatch.id,
        entityKind: 'customer',
        description: `ERP customer '${erpCustomer.name}' may match existing client '${nameMatch.name}' (name similar, GSTIN differs).`,
        resolution: 'flag_manual',
        erpRecord: erpCustomer,
        existingRecord: nameMatch,
      },
      action: 'skip',
      existingId: nameMatch.id,
    };
  }
  return { conflict: null, action: 'create_new' };
}

// ─── Duplicate invoice resolution ─────────────────────────────────────────────

/**
 * Detect + resolve duplicate invoices.
 * Strategy: if invoice number matches → compare amounts:
 *   • same amount → skip (already synced)
 *   • different amount → overwrite (ERP is source of truth)
 */
export function resolveDuplicateInvoice(
  erpInvoice: ERPInvoice,
  existing: Array<{
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    updatedAt?: string;
  }>,
): {
  conflict: Conflict | null;
  action: 'skip' | 'overwrite' | 'create_new';
  existingId?: string;
} {
  const match = existing.find(
    (i) => i.invoiceNumber.toUpperCase() === erpInvoice.erpInvoiceNumber.toUpperCase(),
  );
  if (match) {
    if (match.grandTotal === erpInvoice.grandTotal) {
      return {
        conflict: {
          type: 'duplicate_invoice',
          entityId: match.id,
          entityKind: 'invoice',
          description: `Invoice ${erpInvoice.erpInvoiceNumber} already synced with matching amount.`,
          resolution: 'skip',
          erpRecord: erpInvoice,
          existingRecord: match,
        },
        action: 'skip',
        existingId: match.id,
      };
    }
    return {
      conflict: {
        type: 'modified_record',
        entityId: match.id,
        entityKind: 'invoice',
        description: `Invoice ${erpInvoice.erpInvoiceNumber} amount changed from ${match.grandTotal} to ${erpInvoice.grandTotal}.`,
        resolution: 'overwrite',
        erpRecord: erpInvoice,
        existingRecord: match,
        diff: [{ field: 'grandTotal', erpValue: erpInvoice.grandTotal, existingValue: match.grandTotal }],
      },
      action: 'overwrite',
      existingId: match.id,
    };
  }
  return { conflict: null, action: 'create_new' };
}

// ─── Deleted record detection ─────────────────────────────────────────────────

/**
 * Detect records that exist in VEYRO but not in the latest ERP sync.
 * These were likely deleted in the ERP — flag for manual review (don't auto-delete).
 */
export function detectDeletedRecords<T extends { id: string; erpCustomerId?: string; erpInvoiceNumber?: string; erpItemId?: string; erpLedgerId?: string }>(
  syncedRecords: T[],
  existingErpIds: Set<string>,
  getErpId: (r: T) => string | undefined,
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const rec of syncedRecords) {
    const erpId = getErpId(rec);
    if (erpId && !existingErpIds.has(erpId)) {
      conflicts.push({
        type: 'deleted_record',
        entityId: rec.id,
        entityKind: 'customer',
        description: `Record with ERP id ${erpId} was not found in the latest sync — may have been deleted in the ERP.`,
        resolution: 'flag_manual',
        existingRecord: rec,
      });
    }
  }
  return conflicts;
}

// ─── Sync failure handling ────────────────────────────────────────────────────

/**
 * Decide whether to retry a failed sync job.
 * Retries are allowed up to maxRetries, with exponential backoff.
 */
export function shouldRetrySync(
  retryCount: number,
  maxRetries: number,
  lastError: string,
): { retry: boolean; delayMs: number; conflict?: Conflict } {
  if (retryCount >= maxRetries) {
    return {
      retry: false,
      delayMs: 0,
      conflict: {
        type: 'sync_failure',
        entityId: 'sync-job',
        entityKind: 'customer', // unused
        description: `Sync failed after ${maxRetries} retries. Last error: ${lastError}`,
        resolution: 'flag_manual',
      },
    };
  }
  // Exponential backoff: 30s, 2m, 8m, ...
  const delayMs = Math.min(30000 * Math.pow(4, retryCount), 30 * 60 * 1000);
  return { retry: true, delayMs };
}

// ─── Aggregate conflict summary ───────────────────────────────────────────────

export interface ConflictSummary {
  total: number;
  byType: Record<ConflictType, number>;
  byResolution: Record<ResolutionStrategy, number>;
  conflicts: Conflict[];
}

export function summarizeConflicts(conflicts: Conflict[]): ConflictSummary {
  const byType: Record<ConflictType, number> = {
    duplicate_customer: 0,
    duplicate_invoice: 0,
    deleted_record: 0,
    modified_record: 0,
    version_conflict: 0,
    sync_failure: 0,
  };
  const byResolution: Record<ResolutionStrategy, number> = {
    skip: 0, overwrite: 0, merge: 0, create_new: 0, flag_manual: 0, retry: 0,
  };
  for (const c of conflicts) {
    byType[c.type]++;
    byResolution[c.resolution]++;
  }
  return { total: conflicts.length, byType, byResolution, conflicts };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|pvt|private|ltd\.|co|company|inc|llp|india)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
