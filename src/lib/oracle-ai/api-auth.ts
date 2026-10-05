// ═══════════════════════════════════════════════════════════════════════════════
// Oracle AI™ API — Auth helper
//
// Resolves the Oracle AI context for a request. Tries proper Firebase Auth
// verification first (Bearer token → requireAuth). If no token is present,
// falls back to a demo context using NEXT_PUBLIC_FIRM_ID — this matches the
// existing /api/oracle/* routes' pattern so the workspace is usable in
// preview/demo mode without breaking production auth.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/security/middleware-helpers';
import { AuthenticationError } from '@/lib/security/errors';

const FALLBACK_FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

export interface OracleAICtx {
  uid: string;
  email: string | null;
  firmId: string;
  isSuperAdmin: boolean;
  isDemo: boolean;
}

/**
 * Resolve the Oracle AI context for a request.
 *
 * Strategy:
 *   1. If a Bearer token is present → verify it via Firebase Admin and return
 *      the authenticated context.
 *   2. If no Bearer token is present → return a demo context (uid='demo-user',
 *      firmId=FALLBACK_FIRM_ID). This keeps the workspace functional in
 *      preview mode and matches the existing Oracle routes.
 *   3. If a token is present but invalid → throw (401).
 */
export async function resolveOracleAICtx(req: NextRequest): Promise<OracleAICtx> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !/^Bearer\s+.+/i.test(authHeader)) {
    return {
      uid: 'demo-user',
      email: null,
      firmId: FALLBACK_FIRM_ID,
      isSuperAdmin: false,
      isDemo: true,
    };
  }
  try {
    const sec = await requireAuth(req);
    return {
      uid: sec.uid,
      email: null,
      firmId: sec.orgId ?? FALLBACK_FIRM_ID,
      isSuperAdmin: sec.isSuperAdmin,
      isDemo: false,
    };
  } catch (err) {
    if (err instanceof AuthenticationError) {
      // Token was present but invalid — surface the 401.
      throw err;
    }
    // Unknown error — degrade to demo context so a flaky Firebase Admin doesn't
    // take the workspace down.
    return {
      uid: 'demo-user',
      email: null,
      firmId: FALLBACK_FIRM_ID,
      isSuperAdmin: false,
      isDemo: true,
    };
  }
}

/** Convert an AuthenticationError / generic Error into a NextResponse. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthenticationError) {
    return NextResponse.json(
      { error: err.message, code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}
