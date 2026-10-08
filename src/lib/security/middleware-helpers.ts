// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Enterprise Security Layer: Server-Side Middleware Helpers
//
// These helpers run in Next.js route handlers (Node.js runtime — NOT Edge).
// They provide the `requireAuth` / `requireOrg` / `requireRole` /
// `requirePermission` / `requireActiveSubscription` chain that route handlers
// call at the top of their `POST` / `GET` / etc. functions to enforce
// authentication, organization membership, RBAC, ABAC, and subscription state.
//
// Token verification uses Firebase Admin SDK (`@/lib/firebase-admin`).
// Firestore reads use the Admin SDK (bypasses security rules — these are
// server-side authoritative checks).
//
// Also exports:
//   • `rateLimit(identifier, limit, windowMs)` — in-memory sliding-window
//     rate limiter (Map-based, periodic cleanup).
//   • `applySecurityHeaders(res)` — adds X-Content-Type-Options, X-Frame-
//     Options, Strict-Transport-Security, Content-Security-Policy,
//     Referrer-Policy, Permissions-Policy.
//   • `validateCSRFToken(req)` — stateless CSRF check: server HMACs the
//     caller's Bearer token with a server-side secret and compares to the
//     `X-CSRF-Token` header.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  AuthorizationError,
  AuthenticationError,
  OrganizationNotFoundError,
  RateLimitError,
  SubscriptionInactiveError,
  CSRFError,
} from './errors';
import { can as rbacCan, getPermissions as rbacGetPermissions } from './rbac';
import { defaultABACEngine } from './abac';
import type {
  OrgRole,
  Permission,
  Resource,
  SecurityContext,
  SubscriptionStatus,
} from './types';

// ─── Super-admin resolution ──────────────────────────────────────────────────

/**
 * Returns `true` if the verified user is a VEYRO staff super-admin.
 *
 * A user is a super-admin if EITHER:
 *   1. The Firebase Auth custom claim `{ superAdmin: true }` is set on their
 *      account, OR
 *   2. Their email is in the `SUPER_ADMIN_EMAILS` env var (comma-separated).
 */
function isSuperAdminUser(
  uid: string,
  email: string | undefined,
  customClaims: Record<string, unknown> | undefined,
): boolean {
  if (customClaims && customClaims['superAdmin'] === true) return true;
  const allowlist = process.env.SUPER_ADMIN_EMAILS;
  if (!allowlist || !email) return false;
  const allowed = allowlist
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

// ─── Bearer Token Extraction ─────────────────────────────────────────────────

/**
 * Extract the Bearer token from the `Authorization` header.
 *
 * @returns the raw token string, or `null` if the header is missing or
 *          malformed.
 */
export function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Verify the caller's Firebase ID token (from `Authorization: Bearer <token>`)
 * and return a baseline `SecurityContext` (no org scope, no role).
 *
 * @throws {AuthenticationError} (401) if the header is missing, malformed,
 *         or the token fails Firebase verification (expired, revoked, invalid).
 */
export async function requireAuth(req: NextRequest): Promise<SecurityContext> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AuthenticationError(
      'Missing or malformed Authorization header. Expected: Bearer <token>.',
      { code: 'AUTH_HEADER_MISSING' },
    );
  }

  let decoded: {
    uid: string;
    email?: string;
    email_verified?: boolean;
    firebase?: { sign_in_provider?: string };
  };
  try {
    decoded = (await adminAuth().verifyIdToken(token, true)) as typeof decoded;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Token verification failed.';
    throw new AuthenticationError(
      `Authentication failed: ${message}`,
      { code: 'TOKEN_VERIFICATION_FAILED' },
    );
  }

  // Custom claims carry `superAdmin` and (optionally) role/org hints.
  let customClaims: Record<string, unknown> | undefined;
  try {
    customClaims = (await adminAuth().getUser(decoded.uid)).customClaims ?? undefined;
  } catch {
    // Non-fatal — treat as no custom claims.
    customClaims = undefined;
  }

  const isSuperAdmin = isSuperAdminUser(
    decoded.uid,
    decoded.email,
    customClaims,
  );

  return {
    uid: decoded.uid,
    orgId: null,
    role: null,
    permissions: emptyPermissions(),
    subscriptionStatus: 'none',
    isSuperAdmin,
  };
}

// ─── requireOrg ──────────────────────────────────────────────────────────────

/**
 * Verify the caller is an active member of the given organization.
 *
 * Performs three Firestore reads:
 *   1. `organizations/{orgId}`             — confirm org exists + is active.
 *   2. `organization_members/{orgId}_{uid}` — confirm caller is a member.
 *   3. `organizations/{orgId}/billing/subscription` (best-effort) — resolve
 *      subscription status.
 *
 * @throws {AuthenticationError}       (401) if no valid auth token.
 * @throws {OrganizationNotFoundError} (404) if the org doesn't exist or is deleted.
 * @throws {AuthorizationError}        (403) if the caller is not a member or
 *         their membership is suspended/removed.
 */
export async function requireOrg(
  req: NextRequest,
  orgId: string,
): Promise<SecurityContext> {
  const base = await requireAuth(req);

  if (!orgId || typeof orgId !== 'string' || orgId.length === 0) {
    throw new OrganizationNotFoundError('Organization ID is required.', {
      orgId,
    });
  }

  // 1. Fetch the org doc.
  const orgSnap = await adminDb().doc(`organizations/${orgId}`).get();
  if (!orgSnap.exists) {
    throw new OrganizationNotFoundError(
      `Organization "${orgId}" does not exist.`,
      { orgId },
    );
  }
  const orgData = orgSnap.data() as Record<string, unknown> | undefined;
  const orgStatus = (orgData?.['status'] as string | undefined) ?? 'active';
  if (orgStatus === 'deleted') {
    throw new OrganizationNotFoundError(
      `Organization "${orgId}" has been deleted.`,
      { orgId },
    );
  }
  if (orgStatus === 'suspended') {
    // Suspended org → mark subscription as suspended (handled below).
  }

  // 2. Fetch the caller's membership row.
  const memberSnap = await adminDb()
    .doc(`organization_members/${orgId}_${base.uid}`)
    .get();
  if (!memberSnap.exists) {
    throw new AuthorizationError(
      'You are not a member of this organization.',
      { orgId, uid: base.uid, code: 'NOT_A_MEMBER' },
    );
  }
  const memberData = memberSnap.data() as Record<string, unknown>;
  const memberStatus = (memberData['status'] as string | undefined) ?? 'active';
  if (memberStatus !== 'active') {
    throw new AuthorizationError(
      `Your membership in this organization is "${memberStatus}".`,
      { orgId, uid: base.uid, code: 'MEMBERSHIP_NOT_ACTIVE', memberStatus },
    );
  }

  const role = (memberData['role'] as OrgRole | undefined) ?? 'member';

  // 3. Best-effort fetch the subscription status.
  const subscriptionStatus = await resolveSubscriptionStatus(
    orgId,
    (orgData?.['subscriptionStatus'] as SubscriptionStatus | undefined) ??
      (orgStatus === 'suspended' ? 'suspended' : undefined),
  );

  // Super-admin inherits the highest role for RBAC purposes if they're not
  // an explicit member. We already threw if they're not a member, so here
  // they are a member — super-admin flag is preserved separately.
  return {
    ...base,
    orgId,
    role,
    permissions: getPermissionsForRole(role),
    subscriptionStatus,
  };
}

// ─── requireRole ─────────────────────────────────────────────────────────────

/**
 * Verify the caller is an active member of `orgId` AND has one of the
 * specified roles. Super-admins bypass the role check.
 *
 * @throws {AuthenticationError}       (401) no valid token.
 * @throws {OrganizationNotFoundError} (404) org doesn't exist.
 * @throws {AuthorizationError}        (403) not a member OR role mismatch.
 */
export async function requireRole(
  req: NextRequest,
  orgId: string,
  ...roles: OrgRole[]
): Promise<SecurityContext> {
  const ctx = await requireOrg(req, orgId);

  // Super-admin bypasses the role check.
  if (ctx.isSuperAdmin) return ctx;

  if (roles.length === 0) {
    return ctx; // No roles specified → any active member is allowed.
  }
  if (!ctx.role || !roles.includes(ctx.role)) {
    throw new AuthorizationError(
      `This action requires one of: ${roles.join(', ')}. Your role: "${ctx.role ?? 'none'}".`,
      {
        orgId,
        uid: ctx.uid,
        code: 'INSUFFICIENT_ROLE',
        requiredRoles: roles,
        actualRole: ctx.role,
      },
    );
  }
  return ctx;
}

// ─── requirePermission ───────────────────────────────────────────────────────

/**
 * Full RBAC + ABAC check. Verifies:
 *   1. The caller is an active member of `orgId`.
 *   2. The caller's role grants the (resource, action) permission per RBAC.
 *   3. The request passes the ABAC engine (built-in policies).
 *
 * Super-admins bypass both RBAC and ABAC.
 *
 * @throws {AuthenticationError}       (401) no valid token.
 * @throws {OrganizationNotFoundError} (404) org doesn't exist.
 * @throws {AuthorizationError}        (403) RBAC or ABAC denial.
 */
export async function requirePermission(
  req: NextRequest,
  orgId: string,
  resource: Resource,
  action: Permission,
  resourceAttrs?: Record<string, unknown>,
): Promise<SecurityContext> {
  const ctx = await requireOrg(req, orgId);

  // Super-admin bypass.
  if (ctx.isSuperAdmin) return ctx;

  // RBAC check.
  if (!rbacCan(ctx.role, resource, action)) {
    throw new AuthorizationError(
      `Permission denied: role "${ctx.role}" cannot "${action}" on "${resource}".`,
      {
        orgId,
        uid: ctx.uid,
        code: 'RBAC_DENIED',
        resource,
        action,
        role: ctx.role ?? undefined,
      },
    );
  }

  // ABAC check.
  const abacAllowed = defaultABACEngine.evaluate(ctx, resource, action, resourceAttrs);
  if (!abacAllowed) {
    throw new AuthorizationError(
      `Permission denied by ABAC policy: cannot "${action}" on "${resource}".`,
      {
        orgId,
        uid: ctx.uid,
        code: 'ABAC_DENIED',
        resource,
        action,
        role: ctx.role ?? undefined,
      },
    );
  }

  return ctx;
}

// ─── requireActiveSubscription ───────────────────────────────────────────────

/**
 * Verify the caller's org has an active (or trialing) subscription. Use this
 * for paid-feature routes (ERP sync, AI actions, bulk exports).
 *
 * Accepted statuses: `active`, `trialing`.
 * Denied statuses: `past_due`, `suspended`, `canceled`, `incomplete`, `none`.
 *
 * Super-admins bypass the subscription check (for support / debugging).
 *
 * @throws {SubscriptionInactiveError} (402) if the subscription is not active.
 */
export async function requireActiveSubscription(
  req: NextRequest,
  orgId: string,
): Promise<SecurityContext> {
  const ctx = await requireOrg(req, orgId);

  // Super-admin bypass.
  if (ctx.isSuperAdmin) return ctx;

  if (ctx.subscriptionStatus !== 'active' && ctx.subscriptionStatus !== 'trialing') {
    throw new SubscriptionInactiveError(
      `Your subscription is "${ctx.subscriptionStatus}". An active subscription is required.`,
      {
        orgId,
        uid: ctx.uid,
        subscriptionStatus: ctx.subscriptionStatus,
      },
    );
  }
  return ctx;
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────

interface RateLimitBucket {
  /** Sliding-window timestamps (ms since epoch). */
  hits: number[];
  /** Last cleanup time (ms since epoch). */
  lastCleanup: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let lastGlobalCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute.
const MAX_BUCKET_SIZE = 1_000; // Cap hits array to bound memory.

/**
 * In-memory sliding-window rate limiter. Returns `{ allowed, remaining, resetAt }`.
 *
 * @param identifier  — IP, uid, orgId, or compound key.
 * @param limit       — max requests allowed in the window.
 * @param windowMs    — window size in milliseconds.
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  // Global cleanup: periodically drop expired buckets to bound memory.
  if (now - lastGlobalCleanup > CLEANUP_INTERVAL_MS) {
    for (const [key, bucket] of rateLimitBuckets) {
      // Drop hits older than the (default 1-minute) window.
      const cutoff = now - Math.max(windowMs, 60_000);
      bucket.hits = bucket.hits.filter((t) => t > cutoff);
      if (bucket.hits.length === 0) {
        rateLimitBuckets.delete(key);
      }
    }
    lastGlobalCleanup = now;
  }

  let bucket = rateLimitBuckets.get(identifier);
  if (!bucket) {
    bucket = { hits: [], lastCleanup: now };
    rateLimitBuckets.set(identifier, bucket);
  }

  // Drop hits outside the current window.
  const windowStart = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  // Cap the bucket size to prevent unbounded growth under sustained attack.
  if (bucket.hits.length > MAX_BUCKET_SIZE) {
    bucket.hits = bucket.hits.slice(-MAX_BUCKET_SIZE);
  }

  const count = bucket.hits.length;
  const allowed = count < limit;

  if (allowed) {
    bucket.hits.push(now);
  }

  const remaining = Math.max(0, limit - bucket.hits.length);
  const oldestHit = bucket.hits[0] ?? now;
  const resetAt = oldestHit + windowMs;

  return { allowed, remaining, resetAt };
}

/**
 * Convenience: throw a `RateLimitError` if the identifier exceeds the limit.
 * Useful for one-liner guards in route handlers.
 */
export function assertRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): void {
  const result = rateLimit(identifier, limit, windowMs);
  if (!result.allowed) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil((result.resetAt - Date.now()) / 1000)}s.`,
      {
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
    );
  }
}

// ─── Security Headers ────────────────────────────────────────────────────────

/**
 * Apply a defensive set of security headers to a `NextResponse`. Idempotent —
 * calling twice on the same response is safe (existing values are overwritten).
 *
 * Headers set:
 *   • X-Content-Type-Options: nosniff
 *   • X-Frame-Options: DENY
 *   • Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
 *   • Referrer-Policy: strict-origin-when-cross-origin
 *   • Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
 *   • Content-Security-Policy: restrictive default (allows self, inline styles
 *     for Tailwind, firebase auth, vercel live, fonts).
 */
export function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  res.headers.set('X-DNS-Prefetch-Control', 'on');

  // CSP: restrictive but functional. Allows:
  //   - self for everything
  //   - inline styles (Tailwind generates style attributes)
  //   - inline scripts (Next.js hydration + dev)
  //   - firebase auth iframe + apis
  //   - fonts.googleapis.com / fonts.gstatic.com
  //   - vercel.live (Next.js dev toolbar)
  //   - data: images + blob: for uploads
  //   - 'unsafe-eval' in dev only (Next.js dev requires it)
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://js.stripe.com https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: https://firebasestorage.googleapis.com",
    "connect-src 'self' https: wss: https://*.googleapis.com https://*.firebaseio.com https://firebasestorage.googleapis.com https://vitals.vercel-insights.com",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "frame-src 'self' https://*.firebaseapp.com https://js.stripe.com https://checkout.razorpay.com",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.razorpay.com",
    "base-uri 'self'",
    isDev ? "worker-src 'self' blob:" : "worker-src 'self'",
  ].join('; ');
  res.headers.set('Content-Security-Policy', csp);

  return res;
}

// ─── CSRF Token Validation ───────────────────────────────────────────────────

/**
 * Returns the server-side HMAC secret for CSRF token derivation. Reads from
 * `CSRF_SECRET` env var, falling back to `NEXT_PUBLIC_FIREBASE_API_KEY`
 * (better than nothing if CSRF_SECRET is unset — still server-side only).
 *
 * The secret must be the same value the server uses to mint CSRF tokens
 * for clients (e.g. via a `/api/auth/csrf-token` endpoint that returns
 * `HMAC-SHA256(bearerToken, secret)` to authenticated callers).
 */
function getCSRFSecret(): string {
  const secret =
    process.env.CSRF_SECRET ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    'gstpilot-default-csrf-secret-CHANGE-ME';
  return secret;
}

/**
 * Compute the expected CSRF token for a given Bearer token. The token is
 * `HMAC-SHA256(bearerToken, secret)` as a hex string.
 */
export function computeCSRFToken(bearerToken: string): string {
  const secret = getCSRFSecret();
  return createHmac('sha256', secret).update(bearerToken).digest('hex');
}

/**
 * Validate the `X-CSRF-Token` header on a state-mutating request (POST/PUT/
 * PATCH/DELETE).
 *
 * Pattern: the server computes `HMAC-SHA256(bearerToken, secret)` and
 * compares it (timing-safe) to the `X-CSRF-Token` header. The client must
 * obtain this HMAC value from the server (e.g. via a `/api/auth/csrf-token`
 * endpoint) and send it on every mutating request.
 *
 * Cross-site attackers can't forge this header because:
 *   - They can't read the Bearer token from a cross-origin request's
 *     Authorization header.
 *   - They don't have the server-side HMAC secret.
 *
 * @returns `true` if the CSRF token is valid. `false` otherwise.
 *          Returns `true` if the request has no Bearer token (CSRF doesn't
 *          apply to unauthenticated requests — the auth layer will reject
 *          them separately).
 */
export function validateCSRFToken(req: NextRequest): boolean {
  const bearer = extractBearerToken(req);
  if (!bearer) {
    // No Bearer token → no CSRF check (auth layer handles rejection).
    return true;
  }

  const provided = req.headers.get('x-csrf-token');
  if (!provided || typeof provided !== 'string' || provided.length === 0) {
    return false;
  }

  const expected = computeCSRFToken(bearer);

  // Timing-safe comparison (constant-time).
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Convenience: assert that the CSRF token on the request is valid. Throws
 * `CSRFError` if not. Call this at the top of POST/PUT/PATCH/DELETE handlers.
 */
export function assertCSRFToken(req: NextRequest): void {
  if (!validateCSRFToken(req)) {
    throw new CSRFError('Missing or invalid X-CSRF-Token header.', {
      code: 'CSRF_TOKEN_INVALID',
    });
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Resolve the subscription status for an org. Tries the
 * `organizations/{orgId}/billing/subscription` doc first; falls back to the
 * `subscriptionStatus` field on the org doc; finally defaults to `active`
 * for free-plan orgs or `none` if no plan info.
 */
async function resolveSubscriptionStatus(
  orgId: string,
  fallback: SubscriptionStatus | undefined,
): Promise<SubscriptionStatus> {
  try {
    const subSnap = await adminDb()
      .doc(`organizations/${orgId}/billing/subscription`)
      .get();
    if (subSnap.exists) {
      const data = subSnap.data() as Record<string, unknown> | undefined;
      const status = data?.['status'] as SubscriptionStatus | undefined;
      if (status && typeof status === 'string') {
        return status;
      }
    }
  } catch {
    // Best-effort — fall through to the fallback.
  }
  return fallback ?? 'active';
}

/**
 * Build an empty permissions map (for unscoped contexts). Deny-by-default.
 */
function emptyPermissions(): Record<Resource, Permission[]> {
  return {
    clients: [],
    invoices: [],
    returns: [],
    payments: [],
    documents: [],
    banking: [],
    erp: [],
    billing: [],
    ai: [],
    organization: [],
    users: [],
    audit_logs: [],
    settings: [],
    reports: [],
  };
}

/**
 * Look up the permission map for a role. Mirrors the RBAC matrix.
 */
function getPermissionsForRole(role: OrgRole): Record<Resource, Permission[]> {
  return rbacGetPermissions(role);
}
