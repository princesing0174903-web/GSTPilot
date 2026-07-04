// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Disconnect API
//
// POST /api/gstn/disconnect
//   Body: { encryptedSession }
//   Returns: { ok: true }
//
// Invalidates the GSTN session server-side (idempotent — does not throw if the
// session is already invalid). The client is responsible for deleting the
// Firestore connection doc + cascading deletes (profiles/returns/notices/
// ledgers) via `cascadeDisconnect()` from the service layer.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { terminateConnection } from '@/lib/gstn-provider/server/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { encryptedSession } = body as { encryptedSession?: string | null };

    // Idempotent — passing null/empty is a no-op.
    await terminateConnection(encryptedSession ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Disconnect is intentionally lenient — never surface a hard error to the
    // user. They're disconnecting; the session may already be dead.
    console.warn('[api/gstn/disconnect] non-fatal error:', err);
    return NextResponse.json({ ok: true });
  }
}
