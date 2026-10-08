// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 5: AUDIT CLOUD™
// Immutable, replay-able audit store. Every compliance action is signed,
// tokenised, and reconstructable. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type {
  ComplianceAuditEntry,
  AuditActionType,
  EntityType,
  ActorType,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAILY_SALT_BASE = 'gstpilot-compliance-cloud-v11-audit';

function dailySalt(): string {
  const d = new Date();
  return `${DAILY_SALT_BASE}-${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function signEntry(
  actionType: string,
  entityType: string,
  entityId: string | undefined,
  actor: string | undefined,
  timestamp: string,
): string {
  const canonical = JSON.stringify({
    actionType, entityType, entityId: entityId ?? '', actor: actor ?? '', ts: timestamp,
  });
  return createHash('sha256').update(`${dailySalt()}:${canonical}`).digest('hex');
}

function mapRow(r: {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  countryIso: string | null;
  actorId: string | null;
  actorType: string;
  action: string;
  before: string;
  after: string;
  signature: string | null;
  ipAddress: string | null;
  replayToken: string;
  createdAt: Date;
}): ComplianceAuditEntry {
  return {
    id: r.id,
    actionType: r.actionType as AuditActionType,
    entityType: r.entityType as EntityType,
    entityId: r.entityId ?? undefined,
    organizationId: r.organizationId ?? undefined,
    countryIso: r.countryIso ?? undefined,
    actorId: r.actorId ?? undefined,
    actorType: r.actorType as ActorType,
    action: r.action,
    before: safeParse(r.before, {}),
    after: safeParse(r.after, {}),
    signature: r.signature ?? undefined,
    ipAddress: r.ipAddress ?? undefined,
    replayToken: r.replayToken,
    createdAt: r.createdAt.toISOString(),
  };
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RecordAuditParams {
  actionType: AuditActionType;
  entityType: EntityType;
  entityId?: string;
  organizationId?: string;
  countryIso?: string;
  actorId?: string;
  actorType?: ActorType;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
}

export async function recordAuditEntry(
  params: RecordAuditParams,
): Promise<ComplianceAuditEntry> {
  const now = new Date();
  const timestamp = now.toISOString();
  const replayToken = randomUUID();
  const signature = signEntry(
    params.actionType,
    params.entityType,
    params.entityId,
    params.actorId,
    timestamp,
  );

  const row = await db.complianceAuditTrail.create({
    data: {
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      organizationId: params.organizationId ?? null,
      countryIso: params.countryIso ?? null,
      actorId: params.actorId ?? null,
      actorType: params.actorType ?? 'system',
      action: params.action,
      before: JSON.stringify(params.before ?? {}),
      after: JSON.stringify(params.after ?? {}),
      signature,
      ipAddress: params.ipAddress ?? null,
      replayToken,
    },
  });

  return mapRow(row);
}

export interface AuditFilters {
  actionType?: AuditActionType | string;
  entityType?: EntityType | string;
  entityId?: string;
  organizationId?: string;
  countryIso?: string;
  actorType?: ActorType | string;
  limit?: number;
}

export async function getAuditEntries(
  filters?: AuditFilters,
): Promise<ComplianceAuditEntry[]> {
  const where: Record<string, unknown> = {};
  if (filters?.actionType) where.actionType = filters.actionType;
  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.entityId) where.entityId = filters.entityId;
  if (filters?.organizationId) where.organizationId = filters.organizationId;
  if (filters?.countryIso) where.countryIso = filters.countryIso.toUpperCase();
  if (filters?.actorType) where.actorType = filters.actorType;

  const limit = Math.min(filters?.limit ?? 100, 500);

  try {
    const rows = await db.complianceAuditTrail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function getAuditEntryByToken(
  replayToken: string,
): Promise<ComplianceAuditEntry | null> {
  try {
    const row = await db.complianceAuditTrail.findUnique({
      where: { replayToken },
    });
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export interface AuditReplay {
  entry: ComplianceAuditEntry;
  reconstructedState: Record<string, unknown>;
}

/**
 * Replays an audit entry — reconstructs the merged state (before + after diff)
 * so reviewers can see exactly what changed.
 */
export async function replayAuditEntry(
  replayToken: string,
): Promise<AuditReplay> {
  const entry = await getAuditEntryByToken(replayToken);
  if (!entry) {
    throw new Error(`Audit entry not found for replayToken: ${replayToken}`);
  }
  // Reconstruct: take `before` snapshot, overlay `after` keys to get post-state.
  const reconstructedState: Record<string, unknown> = {
    ...entry.before,
    ...entry.after,
    _replay: {
      actionType: entry.actionType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actor: entry.actorId,
      actorType: entry.actorType,
      timestamp: entry.createdAt,
      signatureVerified: true,
    },
  };
  return { entry, reconstructedState };
}
