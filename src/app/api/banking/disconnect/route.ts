// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Disconnect API
//
// POST /api/banking/disconnect
//   Body: { encryptedConnection }
//   Returns: { ok: true }
//
// Idempotent — never throws, even if the connection is already invalid.
// The client is responsible for cascade-deleting the Firestore data via the
// service layer (cascadeDisconnect) after this returns.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { disconnectBank } from '@/lib/banking-provider/server/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { encryptedConnection } = body as { encryptedConnection?: string | null };

    // Idempotent — never throws.
    await disconnectBank(encryptedConnection ?? null);

    return NextResponse.json({ ok: true });
  } catch {
    // Disconnect must NEVER fail from the client's perspective.
    return NextResponse.json({ ok: true });
  }
}
