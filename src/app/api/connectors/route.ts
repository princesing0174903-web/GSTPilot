// ═══════════════════════════════════════════════════════════════════════════════
// /api/connectors
//
// GET  /api/connectors?userId=<firebase_uid>     — list all data connections
// POST /api/connectors                            — create a new DataConnection
//   Body: { userId, type, label, identifier?, metadata?, status?, syncInterval? }
//   type must be one of: gstn | bank | gmail | whatsapp | tally | zoho | quickbooks
//
// The POST route is the canonical DataConnection create path used by the
// "Connect Bank" / "Connect GSTN" / "Connect Tally" / "Connect Zoho" flows.
// On success it calls the appropriate graph emit helper so the new connection
// becomes a node in the Business Graph:
//   - type=bank  → emitBankNode (bank-account node, owned by firm)
//   - type=gstn  → emitGstnNode (gstn node, connected to firm)
//   - other      → invalidateGraph (graph still derives connection rows)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateGraph, graphEvents } from '@/lib/graph/live-update';
import { emitBankNode, emitGstnNode } from '@/lib/graph/auto-emit';
import { safeAudit } from '@/lib/audit/safe-write';

const ALLOWED_TYPES = new Set([
  'gstn', 'bank', 'gmail', 'whatsapp', 'tally', 'zoho', 'quickbooks',
]);

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const connections = await db.dataConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { syncedRecords: true } } },
    });

    const result = connections.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      label: c.label,
      identifier: c.identifier,
      metadata: c.metadata ? JSON.parse(c.metadata) : {},
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      syncInterval: c.syncInterval,
      errorMessage: c.errorMessage,
      recordCount: c._count.syncedRecords,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ connections: result });
  } catch (err) {
    console.error('[Connectors] List error:', err);
    return NextResponse.json({ error: 'Failed to list connections' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: {
    userId?: string;
    type?: string;
    label?: string;
    identifier?: string;
    metadata?: Record<string, unknown> | string;
    status?: string;
    syncInterval?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const type = body.type;
  const label = body.label;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: `type is required and must be one of: ${Array.from(ALLOWED_TYPES).join(', ')}` },
      { status: 400 },
    );
  }
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  const identifier = body.identifier ?? null;
  const metadataStr =
    typeof body.metadata === 'string'
      ? body.metadata
      : body.metadata
        ? JSON.stringify(body.metadata)
        : null;

  try {
    // Idempotency: if a connection with the same userId+type+identifier exists, refresh it.
    const existing = identifier
      ? await db.dataConnection.findFirst({
          where: { userId, type, identifier },
        })
      : null;

    let connectionId: string;
    if (existing) {
      await db.dataConnection.update({
        where: { id: existing.id },
        data: {
          status: body.status ?? 'connected',
          label,
          identifier,
          metadata: metadataStr ?? existing.metadata,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      connectionId = existing.id;
    } else {
      const conn = await db.dataConnection.create({
        data: {
          userId,
          type,
          status: body.status ?? 'connected',
          label,
          identifier,
          metadata: metadataStr,
          lastSyncAt: new Date(),
          syncInterval: body.syncInterval ?? '15m',
        },
      });
      connectionId = conn.id;
    }

    // ── Real Business Graph Engine™ — auto-emit a node for the new connection ──
    // Bank connections become bank-account nodes; GSTN connections become gstn nodes.
    // All other types still invalidate the cache so the engine re-derives rows.
    try {
      if (type === 'bank') {
        await emitBankNode(connectionId);
      } else if (type === 'gstn') {
        await emitGstnNode(connectionId);
      } else {
        graphEvents.connectorSynced(type, label);
        invalidateGraph();
      }
    } catch (e) {
      console.error('[graph] connector emit failed', e);
    }

    // ── AuditLog entry — CONNECT_<TYPE> ──
    // Persists the connection event so the action is fully traceable across
    // Mission Control, Audit Logs page, and the Business Graph timeline.
    const ACTION_BY_TYPE: Record<string, string> = {
      gstn: 'CONNECT_GSTN',
      bank: 'CONNECT_BANK',
      gmail: 'CONNECT_GMAIL',
      whatsapp: 'CONNECT_WHATSAPP',
      tally: 'CONNECT_TALLY',
      zoho: 'CONNECT_ZOHO',
      quickbooks: 'CONNECT_QUICKBOOKS',
    };
    try {
      await safeAudit({
        userId,
        action: ACTION_BY_TYPE[type] ?? 'CONNECT_CONNECTOR',
        entity: 'DataConnection',
        entityId: connectionId,
        newValue: JSON.stringify({ type, label, identifier }),
        details: `Connected ${type.toUpperCase()} — ${label}`,
      });
    } catch (auditErr) {
      console.warn('[Connectors] AuditLog write failed:', auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        connectionId,
        connection: { id: connectionId, type, label, identifier },
        type,
        label,
        identifier,
        message: `${label} connected — Business Graph updated`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[Connectors] Create error:', err);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }
}
