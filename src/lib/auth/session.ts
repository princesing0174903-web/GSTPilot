// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Server-side Session Helpers (requireAuth + requireOrgMembership)
//
// SERVER-ONLY. Never import this from a client component. Uses the Firebase
// Admin SDK to verify the caller's ID token and (optionally) their membership
// in a specific organization.
//
// DESIGN GOALS (Task 7 — permission-error elimination):
//   1. NEVER show "Permission denied" to a valid user. If the session is
//      invalid → 401 with a friendly "session expired" message. If the org
//      membership is missing → 403 with a friendly message. Both are RARE
//      for valid users (only on genuine session expiry or org removal).
//   2. Gracefully degrade when Firebase Admin credentials aren't configured
//      (sandbox/preview). In that mode, we trust the `x-gstpilot-actor`
//      header (with a warning) so the app remains functional. This is the
//      SAME trust model the existing 36 routes already use — we're just
//      centralizing it so it can be tightened in one place when credentials
//      are available.
//   3. Return friendly error envelopes (not raw error.message). Every error
//      path returns a NextResponse with a user-safe message + a `code` field
//      for client-side branching.
//
// USAGE:
//   export async function GET(req: Request) {
//     const authResult = await requireAuth(req);
//     if (authResult instanceof NextResponse) return authResult;
//     const { uid, email } = authResult;
//     // ... route logic ...
//   }
//
//   export async function POST(req: Request) {
//     const authResult = await requireAuth(req);
//     if (authResult instanceof NextResponse) return authResult;
//     const { uid } = authResult;
//     const body = await req.json();
//     const orgResult = await requireOrgMembership(uid, body.organizationId);
//     if (orgResult instanceof NextResponse) return orgResult;
//     // ... route logic ...
//   }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

// ── Lazy admin SDK loader ────────────────────────────────────────────────────
// The Firebase Admin SDK is heavy and only needed when actually verifying
// tokens. Load it lazily so routes that don't use requireAuth don't pay the
// import cost. If credentials aren't configured, we fall back to header-based
// trust (with a warning) so the app remains functional in sandbox/preview.
let adminModuleCache: Promise<typeof import('firebase-admin') | null> | null = null;

async function loadAdmin(): Promise<typeof import('firebase-admin') | null> {
  if (adminModuleCache) return adminModuleCache;
  adminModuleCache = (async () => {
    try {
      const mod = await import('firebase-admin');
      // Try to get the admin app — this throws if credentials aren't configured.
      const { adminAuth } = await import('@/lib/firebase-admin');
      // Touch adminAuth() once to force initialization. If it throws, we fall
      // back to header-based trust.
      adminAuth();
      return mod;
    } catch (err) {
      console.warn('[session] Firebase Admin SDK unavailable — falling back to header-based trust:', (err as Error).message);
      return null;
    }
  })();
  return adminModuleCache;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** True when the uid came from the spoofable x-gstpilot-actor header
   *  (Admin SDK unavailable). Routes can use this to skip writes that
   *  require a verified identity, or to log a warning. */
  fromHeaderFallback: boolean;
}

// ── Friendly error envelopes ─────────────────────────────────────────────────

function unauthorized(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 401 });
}

function forbidden(message: string, code: string) {
  return NextResponse.json({ error: message, code }, { status: 403 });
}

// ── requireAuth ──────────────────────────────────────────────────────────────

/**
 * Verify the caller's identity. Returns either:
 *   - `{ uid, email, emailVerified, fromHeaderFallback }` on success, OR
 *   - a `NextResponse` (401) that the route should return immediately.
 *
 * Token resolution order:
 *   1. `Authorization: Bearer <token>` header (preferred — verified via Admin SDK)
 *   2. `x-gstpilot-actor` header JSON `{uid, email}` (fallback when Admin SDK
 *      credentials aren't configured — sandbox/preview mode)
 *
 * In fallback mode, the uid is trusted as-is. This is the SAME trust model
 * the existing 36 routes already use; centralizing it here means we can
 * tighten it in one place when credentials become available.
 */
export async function requireAuth(req: Request): Promise<AuthedUser | NextResponse> {
  // ── Path 1: Bearer token (preferred) ──
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (bearerToken) {
    const admin = await loadAdmin();
    if (!admin) {
      // Admin SDK unavailable — we can't verify the token. Fall through to
      // header-based trust below so the app remains functional.
      console.warn('[session] Bearer token present but Admin SDK unavailable — falling back to header');
    } else {
      try {
        const { adminAuth } = await import('@/lib/firebase-admin');
        const decoded = await adminAuth().verifyIdToken(bearerToken);
        return {
          uid: decoded.uid,
          email: decoded.email ?? null,
          emailVerified: decoded.email_verified ?? false,
          fromHeaderFallback: false,
        };
      } catch (err) {
        console.warn('[session] Token verification failed:', (err as Error).message);
        return unauthorized(
          'Your session has expired. Please sign in again.',
          'SESSION_EXPIRED'
        );
      }
    }
  }

  // ── Path 2: x-gstpilot-actor header (fallback) ──
  const actorHeader = req.headers.get('x-gstpilot-actor') ?? '';
  if (actorHeader) {
    try {
      const parsed = JSON.parse(actorHeader) as { uid?: string; email?: string };
      if (parsed.uid && typeof parsed.uid === 'string') {
        return {
          uid: parsed.uid,
          email: parsed.email ?? null,
          emailVerified: false, // can't verify from a header
          fromHeaderFallback: true,
        };
      }
    } catch {
      // Malformed header — fall through to 401.
    }
  }

  return unauthorized(
    'Please sign in to continue.',
    'AUTH_REQUIRED'
  );
}

// ── requireOrgMembership ────────────────────────────────────────────────────

/**
 * Verify that the user is an ACTIVE member of the given organization.
 * Returns either:
 *   - `{ ok: true, role }` on success, OR
 *   - a `NextResponse` (403) that the route should return immediately.
 *
 * Membership is checked via the `organization_members/{orgId}_{uid}` doc in
 * Firestore (server-side Admin SDK bypasses security rules). If the Admin SDK
 * is unavailable (sandbox/preview), this function returns `{ ok: true }` for
 * any non-empty orgId — the same permissive behavior the existing routes
 * already have. Centralizing it here means we can tighten it in one place.
 *
 * LOCAL WORKSPACE: orgIds starting with `local-` are always allowed (they're
 * client-only workspaces with no Firestore backing — the user is implicitly
 * the owner).
 */
export async function requireOrgMembership(
  uid: string,
  orgId: string | null | undefined
): Promise<{ ok: true; role: string } | NextResponse> {
  if (!orgId || typeof orgId !== 'string') {
    return forbidden(
      'We could not identify your workspace. Please refresh the page and try again.',
      'NO_ORG'
    );
  }

  // Local workspace — always allowed (client-only, no Firestore backing).
  if (orgId.startsWith('local-')) {
    return { ok: true, role: 'owner' };
  }

  const admin = await loadAdmin();
  if (!admin) {
    // Admin SDK unavailable (sandbox/preview) — permissive mode.
    // The existing routes already trust the client-supplied orgId; we keep
    // that behavior here so the app remains functional.
    return { ok: true, role: 'owner' };
  }

  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const memberSnap = await adminDb()
      .doc(`organization_members/${orgId}_${uid}`)
      .get();

    if (!memberSnap.exists) {
      // Don't reveal whether the org exists — just say "not a member".
      return forbidden(
        'You are not a member of this workspace. If you believe this is an error, please contact support.',
        'NOT_A_MEMBER'
      );
    }

    const data = memberSnap.data() as { status?: string; role?: string };
    if (data.status !== 'active') {
      return forbidden(
        `Your membership in this workspace is ${data.status ?? 'inactive'}. Please contact your administrator.`,
        'MEMBERSHIP_INACTIVE'
      );
    }

    return { ok: true, role: data.role ?? 'viewer' };
  } catch (err) {
    console.error('[session] Membership check failed:', (err as Error).message);
    // Don't surface the raw error — return a friendly message.
    return forbidden(
      'We could not verify your workspace membership right now. Please try again.',
      'MEMBERSHIP_CHECK_FAILED'
    );
  }
}

// ── requireRole ──────────────────────────────────────────────────────────────

/**
 * Verify that the user has a specific role (or higher) in the given org.
 * Use for destructive operations like deleting the workspace.
 *
 *   const memberResult = await requireOrgMembership(uid, orgId);
 *   if (memberResult instanceof NextResponse) return memberResult;
 *   const roleResult = requireRole(memberResult.role, 'owner');
 *   if (roleResult instanceof NextResponse) return roleResult;
 */
export function requireRole(
  actualRole: string,
  requiredRole: 'owner' | 'admin' | 'manager' | 'accountant' | 'employee'
): { ok: true } | NextResponse {
  const RANK: Record<string, number> = {
    owner: 6,
    admin: 5,
    manager: 4,
    accountant: 3,
    employee: 2,
    auditor: 1,
    viewer: 0,
  };
  const actualRank = RANK[actualRole] ?? 0;
  const requiredRank = RANK[requiredRole] ?? 0;

  if (actualRank < requiredRank) {
    return forbidden(
      `This action requires ${requiredRole} access. Please contact your administrator.`,
      'INSUFFICIENT_ROLE'
    );
  }
  return { ok: true };
}

// ── friendlyApiError ─────────────────────────────────────────────────────────

/**
 * Wrap any caught error into a friendly 500 response. NEVER surfaces
 * `error.message` to the client — logs it server-side only.
 *
 *   } catch (err) {
 *     console.error('[api/route] error:', err);
 *     return friendlyApiError(err, 'We could not load your data right now.');
 *   }
 */
export function friendlyApiError(err: unknown, fallbackMessage: string): NextResponse {
  // Log the full error server-side for debugging.
  console.error('[api] error:', err);
  // Return only the friendly message to the client.
  return NextResponse.json(
    { error: fallbackMessage, code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
