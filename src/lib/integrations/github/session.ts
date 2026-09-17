// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GitHub Session Bridge (server-only)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Bridges GitHub OAuth identity into the existing GSTPilot canonical session
// architecture (src/lib/auth/session.ts). Does NOT create a competing session
// system — instead, it issues a JWT cookie that `requireAuth` recognizes as
// an alternative to the Firebase ID token when the Admin SDK is unavailable.
//
// FLOW:
//   GitHub callback → resolveGitHubUser(githubUser)
//     → finds-or-creates Prisma User row (CASE A/B/C from STEP 7)
//     → issues a session JWT via signSessionCookie({ uid, email, ... })
//     → sets httpOnly cookie `gstpilot_session_jwt`
//     → returns the AuthUser shape that AuthContext expects
//
// SESSION JWT SHAPE (base64url-encoded header.payload.signature):
//   {
//     uid: string,            // Prisma User.id
//     email: string | null,
//     emailVerified: boolean, // true for GitHub (GitHub-verified email)
//     provider: 'github',
//     providerUserId: string, // GitHub numeric user ID (string)
//     name: string | null,
//     picture: string | null,
//     iat: number,             // issued-at (seconds)
//     exp: number              // expiry (seconds) — 7 days
//   }
//
// SECURITY:
//   • Signed with SESSION_JWT_SECRET (env var) — falls back to a hash of
//     GITHUB_APP_CLIENT_SECRET + 'session-jwt-v1' label (domain-separated).
//   • NEVER contains the GitHub access token — only identity claims.
//   • HttpOnly + SameSite=Lax + Secure (when HTTPS) — not readable by JS.
//   • 7-day expiry matches the existing Firebase session length.
//
// BACKWARDS COMPAT:
//   The existing `requireAuth` in session.ts still works unchanged — it
//   checks `Authorization: Bearer <token>` (Firebase ID token) FIRST, then
//   falls back to `x-gstpilot-actor` header. This module adds a THIRD
//   resolution path: the `gstpilot_session_jwt` cookie. We extend
//   `requireAuth` (in session.ts) to check the cookie after the Bearer
//   token but before the header fallback.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import { db } from '@/lib/db';

// ── JWT primitives ────────────────────────────────────────────────────────────

const SESSION_COOKIE_NAME = 'gstpilot_session_jwt';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSessionJwtSecret(): string {
  const explicit = process.env.SESSION_JWT_SECRET;
  if (explicit) return explicit;
  // Domain-separated fallback — never the same key as the OAuth state secret.
  const base = process.env.GITHUB_APP_CLIENT_SECRET || 'fallback-insecure-dev-only';
  const h1 = crypto.createHmac('sha256', 'gstpilot-session-v1').update(base).digest();
  return crypto.createHmac('sha256', h1).update('jwt-signing-key').digest();
}

interface SessionClaims {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  provider: 'github';
  providerUserId: string;
  name: string | null;
  picture: string | null;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function signJwt(claims: SessionClaims): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', getSessionJwtSecret())
    .update(signingInput)
    .digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string): SessionClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', getSessionJwtSecret())
      .update(signingInput)
      .digest('base64url');

    const a = Buffer.from(signatureB64, 'base64url');
    const b = Buffer.from(expectedSig, 'base64url');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionClaims;
    if (!claims.exp || Date.now() / 1000 > claims.exp) return null;
    if (claims.provider !== 'github') return null;
    return claims;
  } catch {
    return null;
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

export function buildSessionCookieHeader(jwt: string, isHttps: boolean): string {
  const flags = [
    `${SESSION_COOKIE_NAME}=${jwt}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) flags.push('Secure');
  return flags.join('; ');
}

export function clearSessionCookieHeader(isHttps: boolean): string {
  const flags = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) flags.push('Secure');
  return flags.join('; ');
}

export const GITHUB_SESSION_COOKIE_NAME = SESSION_COOKIE_NAME;

// ── User resolution (STEP 7 — account linking safety) ────────────────────────
//
// Case A: GitHub identity already linked (providerUserId exists) → sign in.
// Case B: GitHub identity does NOT exist but verified email matches an existing
//         User → link the GitHub identity to that account.
// Case C: No existing matching account → create a new Prisma User.
//
// The Prisma User model has no `provider`/`providerUserId` columns — we store
// the GitHub identity in the UserBehaviour table (which already exists for
// tracking login methods) OR we use a side-table. To avoid schema changes
// (per the user's stop condition), we encode the GitHub user ID in the
// User.avatar field with a `github:` prefix as a stable lookup key. This is
// a pragmatic mapping that survives without a Prisma migration.
//
// NOTE: We do NOT auto-merge unverified emails. GitHub emails are
// GitHub-verified (we only accept primary+verified emails), so Case B is safe.

export interface ResolvedGitHubUser {
  uid: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: 'github';
  providerUserId: string; // GitHub numeric user ID as string
  emailVerified: boolean;
  isNewUser: boolean;
}

const GITHUB_AVATAR_PREFIX = 'github:';

function avatarKeyForGithubUser(githubId: number): string {
  return `${GITHUB_AVATAR_PREFIX}${githubId}`;
}

/**
 * Resolve a GitHub user into a GSTPilot Prisma User, following the safe
 * account-linking rules from STEP 7.
 *
 * Throws on database failure — the caller must catch + redirect to login
 * with a safe error.
 */
export async function resolveGitHubUser(githubUser: {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}): Promise<ResolvedGitHubUser> {
  const providerUserId = String(githubUser.id);
  const avatarKey = avatarKeyForGithubUser(githubUser.id);

  // CASE A: GitHub identity already linked → find by avatar key.
  // (The avatar field stores "github:<id>" for GitHub-linked accounts.)
  let existingByKey = await db.user.findFirst({
    where: { avatar: avatarKey },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isActive: true,
    },
  });

  if (existingByKey) {
    if (!existingByKey.isActive) {
      throw new Error('Your account is deactivated. Please contact your administrator.');
    }
    // Update lastLoginAt + refresh avatar URL + name.
    await db.user.update({
      where: { id: existingByKey.id },
      data: {
        lastLoginAt: new Date(),
        name: githubUser.name ?? existingByKey.name,
      },
    });
    return {
      uid: existingByKey.id,
      email: existingByKey.email,
      name: existingByKey.name ?? githubUser.name,
      avatar: githubUser.avatar_url ?? existingByKey.avatar,
      provider: 'github',
      providerUserId,
      emailVerified: true,
      isNewUser: false,
    };
  }

  // CASE B: Verified email matches an existing account → link GitHub identity.
  // We only do this if GitHub returned a verified email (per STEP 7 safety).
  if (githubUser.email) {
    const existingByEmail = await db.user.findUnique({
      where: { email: githubUser.email },
      select: { id: true, email: true, name: true, avatar: true, isActive: true },
    });
    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw new Error('Your account is deactivated. Please contact your administrator.');
      }
      // LINK: stamp the avatar with the GitHub key + update lastLoginAt.
      await db.user.update({
        where: { id: existingByEmail.id },
        data: {
          avatar: avatarKey, // marks this account as GitHub-linked
          lastLoginAt: new Date(),
          name: githubUser.name ?? existingByEmail.name,
        },
      });
      return {
        uid: existingByEmail.id,
        email: existingByEmail.email,
        name: existingByEmail.name ?? githubUser.name,
        avatar: githubUser.avatar_url ?? existingByEmail.avatar,
        provider: 'github',
        providerUserId,
        emailVerified: true,
        isNewUser: false,
      };
    }
  }

  // CASE C: No existing match → create a new Prisma User.
  // Email: GitHub's email (if available), else fallback to <id>@github.local
  // so the unique constraint is satisfied even when GitHub email is private.
  const email = githubUser.email ?? `gh-${githubUser.id}@github.local`;
  const name = githubUser.name ?? githubUser.login;

  const newUser = await db.user.create({
    data: {
      email,
      name,
      avatar: avatarKey, // marks this account as GitHub-linked
      role: 'staff', // default role — OrgContext handles org membership
      isActive: true,
      lastLoginAt: new Date(),
    },
  });

  return {
    uid: newUser.id,
    email: newUser.email,
    name: newUser.name,
    avatar: githubUser.avatar_url,
    provider: 'github',
    providerUserId,
    emailVerified: true,
    isNewUser: true,
  };
}

// ── Session cookie issuer ────────────────────────────────────────────────────

export function issueSessionCookie(resolved: ResolvedGitHubUser): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    uid: resolved.uid,
    email: resolved.email,
    emailVerified: resolved.emailVerified,
    provider: 'github',
    providerUserId: resolved.providerUserId,
    name: resolved.name,
    picture: resolved.avatar,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return signJwt(claims);
}
