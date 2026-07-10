// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Autopilot Actions API
// POST /api/oracle/actions  → execute a detected action { type, title, description, payload, messageId? }
// GET  /api/oracle/actions  → list recent executed actions (default last 20)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { executeAction, type OracleActionIntent } from '@/lib/oracle/actions';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? '20'));
    const rows = await db.oracleAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({
      ok: true,
      actions: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        status: r.status,
        payload: r.payload ? JSON.parse(r.payload) : {},
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, actions: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OracleActionIntent & { messageId?: string };
    if (!body.type || !body.title) {
      return NextResponse.json({ ok: false, error: 'type, title required' }, { status: 400 });
    }
    const result = await executeAction(
      {
        type: body.type,
        title: body.title,
        description: body.description ?? '',
        payload: body.payload ?? {},
      },
      body.messageId,
    );
    return NextResponse.json({ ok: true, action: result });
  } catch {
    return NextResponse.json(
      { ok: false, action: { id: '', type: 'task', title: 'Action failed', status: 'failed' } },
      { status: 200 },
    );
  }
}

export const runtime = 'nodejs';
