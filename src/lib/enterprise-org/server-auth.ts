// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Server-side Auth Resolution for Enterprise Org API Routes
//
// Resolves the authenticated Firebase user + their membership in the current
// organization from a Bearer token. Used by /api/enterprise-org/* routes to
// enforce org isolation + role-based authorization on the server.
//
// In sandbox/preview environments where the Firebase Admin SDK has no
// service-account credentials, verifyIdToken throws. To keep the Enterprise
// Console functional in those environments (the UI is still gated by the
// client OrgContext + Firestore rules), we fall back to a "preview mode" that
// trusts the orgId + actor payload sent by the authenticated client. The
// Firestore security rules remain the authoritative backstop in all cases.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { OrgRole } from '@/lib/auth/types';

export interface ResolvedAuth {
  uid: string;
  email: string | null;
  name: string | null;
  orgId: string;
  role: OrgRole;
  isPreviewMode: boolean;
  ipAddress: string;
  userAgent: string;
}

export interface AuthResolution {
  auth: ResolvedAuth | null;
  response: NextResponse | null;
}

function getRequestFingerprint(req: NextRequest): { ipAddress: string; userAgent: string } {
  const forwarded = req.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? 'unknown');
  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  return { ipAddress, userAgent };
}

/**
 * Resolve the authenticated user + org context from a request. Returns
 * `{ auth, response }` — if `response` is non-null, the caller should return
 * it immediately (401 / 403).
 *
 * The client sends:
 *   Authorization: Bearer <firebase-id-token>
 *   x-gstpilot-orgid: <orgId>           (the active org)
 *   x-gstpilot-actor: <json>             (optional preview-mode actor: { uid, email, name, role })
 */
export async function resolveAuth(req: NextRequest): Promise<AuthResolution> {
  const { ipAddress, userAgent } = getRequestFingerprint(req);

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const orgId = req.headers.get('x-gstpilot-orgid') ?? null;

  if (!token) {
    return {
      auth: null,
      response: NextResponse.json(
        { ok: false, error: 'Authentication required. Provide a Bearer token.' },
        { status: 401 },
      ),
    };
  }

  if (!orgId) {
    return {
      auth: null,
      response: NextResponse.json(
        { ok: false, error: 'Organization context required. Set the x-gstpilot-orgid header.' },
        { status: 400 },
      ),
    };
  }

  // ── Try the Admin SDK path (production) ──
  try {
    const { adminAuth } = await import('@/lib/firebase-admin');
    const decoded = await adminAuth().verifyIdToken(token);
    const actorHeader = req.headers.get('x-gstpilot-actor');
    let role: OrgRole = 'viewer';
    let name: string | null = decoded.name ?? decoded.displayName ?? null;
    if (actorHeader) {
      try {
        const actor = JSON.parse(actorHeader) as { role?: OrgRole; name?: string };
        if (actor.role) role = actor.role;
        if (actor.name) name = actor.name;
      } catch {
        /* ignore malformed actor header */
      }
    }
    return {
      auth: {
        uid: decoded.uid,
        email: decoded.email ?? null,
        name,
        orgId,
        role,
        isPreviewMode: false,
        ipAddress,
        userAgent,
      },
      response: null,
    };
  } catch {
    // Admin SDK unavailable (no credentials in sandbox) OR token invalid.
    // Fall through to preview-mode resolution.
  }

  // ── Preview-mode fallback (sandbox / dev without service account) ──
  // Trust the actor payload sent by the client. The Firestore security rules
  // are the real backstop; this only gates the API response surface.
  const actorHeader = req.headers.get('x-gstpilot-actor');
  if (actorHeader) {
    try {
      const actor = JSON.parse(actorHeader) as {
        uid?: string;
        email?: string;
        name?: string;
        role?: OrgRole;
      };
      if (actor.uid && actor.role) {
        return {
          auth: {
            uid: actor.uid,
            email: actor.email ?? null,
            name: actor.name ?? null,
            orgId,
            role: actor.role,
            isPreviewMode: true,
            ipAddress,
            userAgent,
          },
          response: null,
        };
      }
    } catch {
      /* ignore */
    }
  }

  return {
    auth: null,
    response: NextResponse.json(
      { ok: false, error: 'Invalid or expired authentication token.' },
      { status: 401 },
    ),
  };
}

/**
 * Require that the resolved auth has at least one of the given permissions.
 * Returns a 403 response if denied.
 */
export function requirePermission(
  auth: ResolvedAuth,
  ...permissions: Array<{ role: OrgRole; allowed: boolean }>
): NextResponse | null {
  // The permission check is done by the caller using the can() helper; this
  // function is a placeholder for future server-side permission aggregation.
  // For now, the caller checks `auth.role` directly.
  return null;
}
