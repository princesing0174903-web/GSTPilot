// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/notifications
//
// GET — read the current user's notification preferences (UserPreference row)
// PUT — upsert the current user's notification preferences (persisted to DB)
//
// Backed by the Prisma `UserPreference` model. The `notifications` column is a
// JSON string. We parse it on read and stringify on write.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface NotificationPrefs {
  emailNotifications: boolean;
  browserNotifications: boolean;
  invoiceAlerts: boolean;
  syncAlerts: boolean;
  securityAlerts: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailNotifications: true,
  browserNotifications: false,
  invoiceAlerts: true,
  syncAlerts: true,
  securityAlerts: true,
};

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

function parsePrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

// GET /api/settings/notifications
export async function GET(request: Request) {
  try {
    const { userEmail } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated', prefs: DEFAULT_PREFS },
        { status: 401 },
      );
    }

    const pref = await db.userPreference.findUnique({ where: { userEmail } });
    const prefs = parsePrefs(pref?.notifications);
    return NextResponse.json({ prefs });
  } catch (error) {
    console.error('[/api/settings/notifications] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load preferences' },
      { status: 500 },
    );
  }
}

// PUT /api/settings/notifications
// Body: NotificationPrefs
export async function PUT(request: Request) {
  try {
    const { userEmail, userId } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const prefs: NotificationPrefs = {
      emailNotifications: Boolean(body.emailNotifications),
      browserNotifications: Boolean(body.browserNotifications),
      invoiceAlerts: Boolean(body.invoiceAlerts),
      syncAlerts: Boolean(body.syncAlerts),
      securityAlerts: Boolean(body.securityAlerts),
    };

    const pref = await db.userPreference.upsert({
      where: { userEmail },
      create: { userEmail, notifications: JSON.stringify(prefs) },
      update: { notifications: JSON.stringify(prefs) },
    });

    try {
      await safeAudit({
        userId: userId ?? null,
        action: 'NOTIFICATION_PREFS_UPDATED',
        entity: 'UserPreference',
        entityId: pref.id,
        newValue: JSON.stringify(prefs),
        details: `Notification preferences updated`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/notifications] audit write failed:', auditErr);
    }

    return NextResponse.json({ prefs });
  } catch (error) {
    console.error('[/api/settings/notifications] PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save preferences' },
      { status: 500 },
    );
  }
}
