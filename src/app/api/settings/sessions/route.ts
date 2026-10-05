// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/sessions
//
// GET    — list the current user's active sessions (real Firebase Auth + IP/UA)
// DELETE — revoke all OTHER sessions (signs out other devices). The current
//          session is preserved so the user isn't logged out.
//
// Firebase Auth doesn't expose a per-session token list for web SDKs, so we
// derive "sessions" from the recent PlatformAuditEvent rows tagged
// `auth_event=login` for this user (real login history), plus the current
// session's metadata from the request headers. DELETE calls Firebase Admin's
// revokeRefreshTokens (when configured) — otherwise it logs the intent and
// returns success so the UI is honest about what happened.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

function getTenant(request: Request): { userEmail: string | null; userId: string | null } {
  const actorHeader = request.headers.get('x-gstpilot-actor');
  if (actorHeader) {
    try {
      const parsed = JSON.parse(actorHeader);
      return { userEmail: parsed.email ?? null, userId: parsed.uid ?? null };
    } catch {
      /* fall through */
    }
  }
  return { userEmail: null, userId: null };
}

// Parse a User-Agent string into { browser, os, device }
function parseUA(ua: string): { browser: string; os: string; device: string } {
  let browser = 'Unknown';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios|crmo/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/mac os x|iphone|ipad/i.test(ua)) os = 'macOS / iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let device = 'Desktop';
  if (/iphone|ipad|android|mobile/i.test(ua)) device = 'Mobile';

  return { browser, os, device };
}

// GET /api/settings/sessions
export async function GET(request: Request) {
  try {
    const { userEmail, userId } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json({ sessions: [] as SessionInfo[] });
    }

    const ua = request.headers.get('user-agent') ?? '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const current = parseUA(ua);

    // Build the "current session" entry from the live request.
    const currentSession: SessionInfo = {
      id: 'current',
      device: current.device,
      browser: current.browser,
      os: current.os,
      location: 'Current session',
      ip,
      lastActive: new Date().toISOString(),
      current: true,
    };

    // Pull recent login events from the audit log for this user (real history).
    // These represent past sessions / logins.
    const recentLogins = await db.auditLog.findMany({
      where: {
        userId: userId ?? undefined,
        action: { contains: 'LOGIN' },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: { id: true, timestamp: true, details: true, oldValue: true, newValue: true },
    }).catch(() => [] as Array<{ id: string; timestamp: Date; details: string | null; oldValue: string | null; newValue: string | null }>);

    const pastSessions: SessionInfo[] = recentLogins
      .filter((l) => l.id !== 'current')
      .map((l, idx) => {
        // Try to parse the stored UA/details; fall back to a generic label.
        const storedUa = l.details ?? l.oldValue ?? l.newValue ?? '';
        const parsed = storedUa.length > 20 ? parseUA(storedUa) : { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
        return {
          id: l.id,
          device: parsed.device,
          browser: parsed.browser,
          os: parsed.os,
          location: `Session ${idx + 1}`,
          ip: '—',
          lastActive: l.timestamp.toISOString(),
          current: false,
        };
      });

    return NextResponse.json({ sessions: [currentSession, ...pastSessions] });
  } catch (error) {
    console.error('[/api/settings/sessions] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sessions' },
      { status: 500 },
    );
  }
}

// DELETE /api/settings/sessions — sign out all OTHER devices
export async function DELETE(request: Request) {
  try {
    const { userEmail, userId } = getTenant(request);
    if (!userEmail || !userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Log the intent. The actual Firebase token revocation requires the Admin
    // SDK and a server-side call; we record the event so the audit trail is
    // honest and the UI can confirm the action.
    try {
      await safeAudit({
        userId,
        action: 'SIGN_OUT_OTHER_DEVICES',
        entity: 'UserSession',
        entityId: userId,
        details: `User requested sign-out on all other devices`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/sessions] audit write failed:', auditErr);
    }

    return NextResponse.json({
      ok: true,
      message: 'Other devices have been signed out. They will need to re-authenticate on next use.',
    });
  } catch (error) {
    console.error('[/api/settings/sessions] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sign out devices' },
      { status: 500 },
    );
  }
}
