// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/theme
//
// GET — read the current user's theme preference ('light' | 'dark' | 'system')
// PUT — upsert the current user's theme preference (persisted to UserPreference.theme)
//
// The CLIENT applies the theme via next-themes (attribute="class"). This route
// only persists the choice so it survives a refresh on a different device.
// next-themes also writes to localStorage for instant application; this DB
// write is the cross-device source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Theme = 'light' | 'dark' | 'system';

function getTenant(request: Request): { userEmail: string | null } {
  const actorHeader = request.headers.get('x-gstpilot-actor');
  if (actorHeader) {
    try {
      const parsed = JSON.parse(actorHeader);
      return { userEmail: parsed.email ?? null };
    } catch {
      /* fall through */
    }
  }
  return { userEmail: null };
}

// GET /api/settings/theme
export async function GET(request: Request) {
  try {
    const { userEmail } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json({ theme: 'system' as Theme });
    }
    const pref = await db.userPreference.findUnique({ where: { userEmail } });
    const theme = (pref?.theme as Theme) ?? 'system';
    return NextResponse.json({ theme });
  } catch (error) {
    console.error('[/api/settings/theme] GET error:', error);
    return NextResponse.json({ theme: 'system' as Theme });
  }
}

// PUT /api/settings/theme  Body: { theme: 'light' | 'dark' | 'system' }
export async function PUT(request: Request) {
  try {
    const { userEmail } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const theme = body.theme as Theme;
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }
    await db.userPreference.upsert({
      where: { userEmail },
      create: { userEmail, theme },
      update: { theme },
    });
    return NextResponse.json({ theme });
  } catch (error) {
    console.error('[/api/settings/theme] PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save theme' },
      { status: 500 },
    );
  }
}
