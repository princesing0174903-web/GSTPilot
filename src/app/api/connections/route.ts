// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Real Data Activation · Connections API
//
// GET  /api/connections       → list active connections with summary cards
// POST /api/connections       → connect a new GSTN or Bank source
//
// All orchestration goes through /src/lib/connections/index.ts (no duplication).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import {
  connectGstn,
  connectBank,
  listConnections,
  loadOracleLiveData,
} from '@/lib/connections';
import { db } from '@/lib/db';
import { validateGSTIN } from '@/lib/gst-utils';
import type { BankProvider, GstnDataset, BankDataset } from '@/lib/connections/types';
import { logActivity, getOptionalUserId } from '@/lib/activity-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── helpers ───────────────────────────────────────────────────────────────────

interface RecentLogEntry {
  id: string;
  status: string;
  recordsImported: number;
  errorsCount: number;
  message: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ConnectionSummary {
  id: string;
  type: 'gstn' | 'bank';
  provider: string;
  status: string;
  legalName?: string | null;
  tradeName?: string | null;
  gstin?: string | null;
  maskedRef?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  // PHASE 2A — Real-Time Sync Center fields (top-level, not inside summary)
  syncStatus: string;
  lastSyncRecords: number;
  lastSyncErrors: number;
  lastSyncMessage: string | null;
  recentLogs: RecentLogEntry[];
  // PHASE 2B — Auto Sync Engine fields
  autoSync: boolean;
  syncIntervalMins: number;
  nextSyncAt: string | null;
  lastSyncDurationMs: number;
  consecutiveFailures: number;
  lastValidationScore: number;
  summary:
    | {
        kind: 'gstn';
        legalName: string;
        tradeName: string;
        gstin: string;
        complianceScore: number;
        pendingReturns: number;
        overdueReturns: number;
        activeNotices: number;
      }
    | {
        kind: 'bank';
        provider: string;
        maskedAccount: string;
        closingBalance: number;
        monthlyCollections: number;
      };
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── GET /api/connections ──────────────────────────────────────────────────────
// Returns active connections enriched with a summary field that the UI can render
// directly (legal name / compliance score / masked account / closing balance …).
// PHASE 2A: includes top-level syncStatus, lastSyncRecords, lastSyncErrors,
// lastSyncMessage, and a recentLogs array (last 5 SyncLog rows per connection).
export async function GET() {
  try {
    // PHASE 2B: trigger lazy sync-on-read so data is always fresh
    try {
      const { triggerLazySync } = await import('@/lib/connections/auto-sync');
      triggerLazySync();
    } catch {
      /* ignore */
    }

    const [connections, live] = await Promise.all([
      listConnections(),
      loadOracleLiveData(),
    ]);

    // Batched fetch of recent SyncLog rows for all connections (avoid N+1).
    const ids = connections.map((c) => c.id);
    let logsByConn: Record<string, RecentLogEntry[]> = {};
    if (ids.length > 0) {
      try {
        const logs = await db.syncLog.findMany({
          where: { connectionId: { in: ids } },
          orderBy: { startedAt: 'desc' },
          take: 5 * ids.length, // ~5 per connection (we slice in memory)
        });
        for (const l of logs) {
          const arr = logsByConn[l.connectionId] ?? [];
          if (arr.length < 5) {
            arr.push({
              id: l.id,
              status: l.status,
              recordsImported: l.recordsImported,
              errorsCount: l.errorsCount,
              message: l.message,
              startedAt: l.startedAt.toISOString(),
              completedAt: l.completedAt?.toISOString() ?? null,
            });
          }
          logsByConn[l.connectionId] = arr;
        }
      } catch (logErr) {
        console.error('GET /api/connections — recentLogs fetch failed (non-fatal):', logErr);
      }
    }

    const result: ConnectionSummary[] = connections.map((c) => {
      const baseFields = {
        id: c.id,
        type: c.type as 'gstn' | 'bank',
        provider: c.provider,
        status: c.status,
        legalName: c.legalName,
        tradeName: c.tradeName,
        gstin: c.gstin,
        maskedRef: c.maskedRef,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        syncStatus: c.syncStatus ?? 'connected',
        lastSyncRecords: c.lastSyncRecords ?? 0,
        lastSyncErrors: c.lastSyncErrors ?? 0,
        lastSyncMessage: c.lastSyncMessage ?? null,
        recentLogs: logsByConn[c.id] ?? [],
        autoSync: c.autoSync ?? true,
        syncIntervalMins: c.syncIntervalMins ?? 15,
        nextSyncAt: c.nextSyncAt?.toISOString() ?? null,
        lastSyncDurationMs: c.lastSyncDurationMs ?? 0,
        consecutiveFailures: c.consecutiveFailures ?? 0,
        lastValidationScore: c.lastValidationScore ?? 100,
      };

      if (c.type === 'gstn') {
        return {
          ...baseFields,
          summary: {
            kind: 'gstn',
            legalName: c.legalName ?? '—',
            tradeName: c.tradeName ?? c.legalName ?? '—',
            gstin: c.gstin ?? '—',
            complianceScore: live.compliance?.score ?? 0,
            pendingReturns: live.compliance?.pendingReturns ?? 0,
            overdueReturns: live.compliance?.overdueReturns ?? 0,
            activeNotices: live.compliance?.activeNotices ?? 0,
          },
        } satisfies ConnectionSummary;
      }

      // bank
      return {
        ...baseFields,
        summary: {
          kind: 'bank',
          provider: c.provider,
          maskedAccount: c.maskedRef ?? 'XXXXXX0000',
          closingBalance: live.bank?.cashAvailable ?? 0,
          monthlyCollections: live.bank?.monthlyCollections ?? 0,
        },
      } satisfies ConnectionSummary;
    });

    return NextResponse.json({ connections: result });
  } catch (error) {
    console.error('GET /api/connections error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list connections' },
      { status: 500 },
    );
  }
}

// ─── POST /api/connections ─────────────────────────────────────────────────────
// Body: { type: 'gstn' | 'bank', gstin?, provider?, accountRef? }
// Returns: { ok: true, connection, dataset }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          type: 'gstn' | 'bank';
          gstin?: string;
          provider?: BankProvider;
          accountRef?: string;
          organizationId?: string;
        }
      | null;

    if (!body || (body.type !== 'gstn' && body.type !== 'bank')) {
      return NextResponse.json(
        { error: "Invalid body — expected { type: 'gstn' | 'bank', … }" },
        { status: 400 },
      );
    }

    // Best-effort attribution: Bearer token → decoded uid (for activity log).
    // Not required — the connection is still created if the caller is unauth'd.
    const userId = await getOptionalUserId(req);
    const organizationId =
      typeof body.organizationId === 'string' && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    if (body.type === 'gstn') {
      const gstinRaw = (body.gstin ?? '').trim().toUpperCase();
      if (!gstinRaw) {
        return NextResponse.json({ error: 'GSTIN is required' }, { status: 400 });
      }
      if (!validateGSTIN(gstinRaw)) {
        return NextResponse.json(
          {
            error:
              'Invalid GSTIN format. GSTIN must be 15 chars: 2 digits · 5 letters · 4 digits · 1 letter · 1 alphanumeric · Z · 1 alphanumeric.',
          },
          { status: 400 },
        );
      }

      const { connection, dataset } = await connectGstn(gstinRaw);

      // PHASE 2A — initial SyncLog row + syncStatus connected
      const initialRecords =
        dataset.gstrFilings.length +
        dataset.eInvoices.length +
        dataset.eWayBills.length +
        dataset.notices.length;
      const initMsg = `Initial sync — ${initialRecords} records imported`;
      try {
        await db.syncLog.create({
          data: {
            connectionId: connection.id,
            status: 'success',
            recordsImported: initialRecords,
            errorsCount: 0,
            message: initMsg,
            startedAt: connection.createdAt,
            completedAt: new Date(),
          },
        });
        await db.businessConnection.update({
          where: { id: connection.id },
          data: {
            syncStatus: 'connected',
            lastSyncRecords: initialRecords,
            lastSyncErrors: 0,
            lastSyncMessage: initMsg,
          },
        });
      } catch (syncErr) {
        console.error('POST /api/connections — initial SyncLog failed (non-fatal):', syncErr);
      }

      // Business Timeline event — "GSTN connected"
      if (organizationId) {
        await logActivity({
          organizationId,
          userId,
          type: 'integration_connected',
          title: 'GSTN Connected',
          description: `Connected GSTIN ${gstinRaw} (${dataset.tradeName ?? dataset.legalName ?? '—'}). Imported ${initialRecords} records.`,
          entityType: 'connection',
          entityId: connection.id,
          metadata: {
            provider: 'GSTN',
            gstin: gstinRaw,
            recordsImported: initialRecords,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        connection: serializeConnection(connection),
        dataset: serializeGstnDataset(dataset),
      });
    }

    // bank
    const VALID_BANKS: BankProvider[] = ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'YES'];
    const provider = (body.provider ?? '').toUpperCase() as BankProvider;
    if (!VALID_BANKS.includes(provider)) {
      return NextResponse.json(
        { error: `Unsupported bank provider. Supported: ${VALID_BANKS.join(', ')}` },
        { status: 400 },
      );
    }
    const accountRefRaw = (body.accountRef ?? '').replace(/\s+/g, '');
    if (!accountRefRaw || accountRefRaw.length < 4) {
      return NextResponse.json(
        { error: 'Account number must be at least 4 digits' },
        { status: 400 },
      );
    }

    const { connection, dataset } = await connectBank(provider, accountRefRaw);

    // PHASE 2A — initial SyncLog row + syncStatus connected
    const initialBankRecords = dataset.transactions.length;
    const initBankMsg = `Initial sync — ${initialBankRecords} records imported`;
    try {
      await db.syncLog.create({
        data: {
          connectionId: connection.id,
          status: 'success',
          recordsImported: initialBankRecords,
          errorsCount: 0,
          message: initBankMsg,
          startedAt: connection.createdAt,
          completedAt: new Date(),
        },
      });
      await db.businessConnection.update({
        where: { id: connection.id },
        data: {
          syncStatus: 'connected',
          lastSyncRecords: initialBankRecords,
          lastSyncErrors: 0,
          lastSyncMessage: initBankMsg,
        },
      });
    } catch (syncErr) {
      console.error('POST /api/connections — initial SyncLog failed (non-fatal):', syncErr);
    }

    // Business Timeline event — "Bank connected"
    if (organizationId) {
      await logActivity({
        organizationId,
        userId,
        type: 'integration_connected',
        title: 'Bank Connected',
        description: `Connected ${provider} account ${dataset.maskedAccount}. Imported ${initialBankRecords} transactions.`,
        entityType: 'connection',
        entityId: connection.id,
        metadata: {
          provider,
          maskedAccount: dataset.maskedAccount,
          recordsImported: initialBankRecords,
          closingBalance: dataset.closingBalance,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      connection: serializeConnection(connection),
      dataset: serializeBankDataset(dataset),
    });
  } catch (error) {
    console.error('POST /api/connections error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect' },
      { status: 500 },
    );
  }
}

// ─── serializers (Prisma rows + datasets → plain JSON-safe objects) ────────────
// (Avoid returning Prisma Date objects directly which NextResponse.json may choke
// on in some Next versions, and trim the dataset down to what the UI needs.)

type PrismaConnection = Awaited<ReturnType<typeof listConnections>>[number];

function serializeConnection(c: PrismaConnection) {
  return {
    id: c.id,
    type: c.type,
    provider: c.provider,
    gstin: c.gstin,
    legalName: c.legalName,
    tradeName: c.tradeName,
    status: c.status,
    maskedRef: c.maskedRef,
    metadata: c.metadata,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    // PHASE 2A — Real-Time Sync Center fields
    syncStatus: c.syncStatus ?? 'connected',
    lastSyncRecords: c.lastSyncRecords ?? 0,
    lastSyncErrors: c.lastSyncErrors ?? 0,
    lastSyncMessage: c.lastSyncMessage ?? null,
  };
}

function serializeGstnDataset(d: GstnDataset) {
  return {
    gstin: d.gstin,
    legalName: d.legalName,
    tradeName: d.tradeName,
    state: d.state,
    stateCode: d.stateCode,
    businessType: d.businessType,
    registrationDate: d.registrationDate,
    compliance: d.compliance,
    gstrFilingsCount: d.gstrFilings.length,
    eInvoicesCount: d.eInvoices.length,
    eWayBillsCount: d.eWayBills.length,
    activeNotices: d.notices.filter((n) => n.status === 'open').length,
    recentFilings: d.gstrFilings.slice(-6),
    recentNotices: d.notices.slice(0, 3),
  };
}

function serializeBankDataset(d: BankDataset) {
  return {
    provider: d.provider,
    maskedAccount: d.maskedAccount,
    accountType: d.accountType,
    openingBalance: d.openingBalance,
    closingBalance: d.closingBalance,
    totalCredits: d.totalCredits,
    totalDebits: d.totalDebits,
    transactionsCount: d.transactions.length,
    monthlyCollections: d.monthlyCollections,
    recentTransactions: d.transactions.slice(-10).reverse(),
  };
}
