// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/password
//
// PUT — change the current user's password. This route is a server-side audit
//        stub; the actual password change runs on the CLIENT via Firebase Auth
//        `updatePassword()` (only the client holds the Firebase Auth instance
//        and the user's current credentials).
//
// Flow:
//   1. Client re-authenticates the user (firebase.auth().currentUser)
//   2. Client calls updatePassword(newUser, newPassword)
//   3. Client POSTs here to record the PASSWORD_CHANGED audit event
//
// This keeps the audit trail honest without exposing Firebase Admin credentials
// on the server (which aren't configured in this sandbox).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: Request) {
  try {
    const actorHeader = request.headers.get('x-gstpilot-actor');
    let userId: string | null = null;
    if (actorHeader) {
      try {
        userId = JSON.parse(actorHeader).uid ?? null;
      } catch { /* ignore */ }
    }

    if (userId) {
      try {
        await safeAudit({
          userId,
          action: 'PASSWORD_CHANGED',
          entity: 'UserSession',
          entityId: userId,
          details: 'User changed their password',
        });
      } catch (auditErr) {
        console.warn('[/api/settings/password] audit write failed:', auditErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/settings/password] PUT error:', error);
    // Non-fatal — the client already changed the password.
    return NextResponse.json({ ok: true });
  }
}
