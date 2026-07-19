// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/logout
//
// POST — server-side logout audit. Records a SIGN_OUT event in the audit log.
//
// NOTE: The actual Firebase signOut() runs on the CLIENT (AuthContext.logout())
// because only the client holds the Firebase Auth instance. This route exists
// so the sign-out is audit-logged server-side before the client clears its
// session — giving us a complete login/logout trail in the AuditLog table.
//
// Flow:
//   1. User clicks "Log out" in Settings
//   2. Client POSTs to /api/settings/logout (this route) — writes audit log
//   3. Client calls AuthContext.logout() — Firebase signOut + clears local state
//   4. Client redirects to /login
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const actorHeader = request.headers.get('x-gstpilot-actor');
    let userId: string | null = null;
    let email: string | null = null;
    if (actorHeader) {
      try {
        const parsed = JSON.parse(actorHeader);
        userId = parsed.uid ?? null;
        email = parsed.email ?? null;
      } catch {
        /* ignore */
      }
    }

    if (userId) {
      try {
        await safeAudit({
          userId,
          action: 'SIGN_OUT',
          entity: 'UserSession',
          entityId: userId,
          details: `User signed out${email ? ` (${email})` : ''}`,
        });
      } catch (auditErr) {
        console.warn('[/api/settings/logout] audit write failed:', auditErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[/api/settings/logout] POST error:', error);
    // Non-fatal — the client still clears local state.
    return NextResponse.json({ ok: true });
  }
}
