// ═══════════════════════════════════════════════════════════════════════════════
// /api/settings/profile
//
// GET  — read the current user's UserProfile + email-derived defaults
// PUT  — upsert the current user's UserProfile (name, role, designation, etc.)
//
// Backed by the Prisma `UserProfile` model (userEmail-keyed). Real persistence,
// real reload after refresh. No local-state-only saves.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { parseBody, schemas } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getTenant(request: Request): { userEmail: string | null; userId: string | null } {
  const actorHeader = request.headers.get('x-gstpilot-actor');
  if (actorHeader) {
    try {
      const parsed = JSON.parse(actorHeader);
      return {
        userEmail: parsed.email ?? null,
        userId: parsed.uid ?? null,
      };
    } catch {
      /* fall through */
    }
  }
  return { userEmail: null, userId: null };
}

// GET /api/settings/profile
export async function GET(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { userEmail } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated', profile: null },
        { status: 401 },
      );
    }
    void uid;

    const profile = await db.userProfile.findUnique({ where: { userEmail } });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[/api/settings/profile] GET error:', error);
    return friendlyApiError(error, 'We could not load your profile right now. Please try again.');
  }
}

// PUT /api/settings/profile
// Body: { name?, role?, designation?, firmName?, industry?, city?, timezone?, preferredLanguage? }
export async function PUT(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { userEmail } = getTenant(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ── SECURITY (POLISH-06): zod validation via schemas.profileUpdate.
    // Caps every field at 200 chars and rejects unknown fields (so a caller
    // can't smuggle `id` or `userEmail` overrides into the Prisma upsert).
    const [body, validationErr] = await parseBody(request, schemas.profileUpdate);
    if (validationErr) return validationErr;

    const allowed: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string' && v.trim() !== '') {
        allowed[k] = v.trim();
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const profile = await db.userProfile.upsert({
      where: { userEmail },
      create: { userEmail, ...allowed },
      update: allowed,
    });

    try {
      await safeAudit({
        userId: uid,
        action: 'PROFILE_UPDATED',
        entity: 'UserProfile',
        entityId: profile.id,
        newValue: JSON.stringify(allowed),
        details: `User profile updated — ${Object.keys(allowed).join(', ')}`,
      });
    } catch (auditErr) {
      console.warn('[/api/settings/profile] audit write failed:', auditErr);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[/api/settings/profile] PUT error:', error);
    return friendlyApiError(error, 'We could not update your profile right now. Please try again.');
  }
}
