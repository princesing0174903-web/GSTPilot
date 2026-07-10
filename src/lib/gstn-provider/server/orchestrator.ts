// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Server Orchestrator (SERVER-ONLY)
//
// The thin server-side layer that:
//   1. Resolves the active provider via the registry
//   2. Encrypts / decrypts sessions with AES-256-GCM (server-only key)
//   3. Calls the provider and returns fully-formed Firestore-ready objects
//
// This file is SERVER-ONLY — it imports `node:crypto` (via the provider + crypto
// modules) and must NEVER be bundled into client code. API routes are the only
// legitimate consumers.
//
// Multi-tenant: every function takes `organizationId` and stamps it onto every
// returned object so the client can write directly to Firestore without
// additional processing.
// ═══════════════════════════════════════════════════════════════════════════════

import { getGSTProvider } from './registry';
import { decryptSession, encryptSession } from './crypto';
import type { GSTSession } from '../provider';
import type {
  ConnectResult,
  GSTLedger,
  GSTNotice,
  GSTProfile,
  GSTReturn,
  GSTReturnType,
  RefreshSessionResult,
  VerifyGSTINResult,
  VerifyOTPResult,
} from '../types';
import { GSTNError, SessionExpiredError, friendlyGSTNError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new GSTNError(
      'You must belong to an organization to manage GST connections.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

function assertGstin(gstin: string | undefined | null): void {
  if (!gstin || gstin.length !== 15) {
    throw new GSTNError('A valid 15-character GSTIN is required.', {
      code: 'INVALID_GSTIN',
      statusCode: 400,
    });
  }
}

// ─── Connection lifecycle ────────────────────────────────────────────────────

/**
 * Step 1 of the connect flow — request an OTP from GSTN.
 * Does NOT touch Firestore. The client writes the connection doc with
 * authStatus='otp_requested' after this succeeds.
 */
export async function initiateConnection(
  organizationId: string,
  gstin: string,
  username: string,
): Promise<ConnectResult> {
  assertOrg(organizationId);
  assertGstin(gstin);
  if (!username || username.trim().length < 3) {
    throw new GSTNError('Username must be at least 3 characters.', {
      code: 'INVALID_USERNAME',
      statusCode: 400,
    });
  }
  const provider = getGSTProvider();
  try {
    return await provider.requestOTP(gstin.toUpperCase(), username.trim());
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Step 2 of the connect flow — verify the OTP and establish a session.
 * Returns the ENCRYPTED session (safe to store in Firestore) + initial profile.
 * The client writes both to Firestore after this succeeds.
 */
export async function completeConnection(
  organizationId: string,
  gstin: string,
  username: string,
  otp: string,
): Promise<VerifyOTPResult> {
  assertOrg(organizationId);
  assertGstin(gstin);
  if (!otp || otp.length < 4) {
    throw new GSTNError('A valid OTP is required.', {
      code: 'INVALID_OTP',
      statusCode: 400,
    });
  }
  const provider = getGSTProvider();
  try {
    const { session, profile } = await provider.verifyOTP(
      gstin.toUpperCase(),
      username.trim(),
      otp.trim(),
    );
    // Encrypt the session before returning to the client. The client stores
    // this blob in Firestore; it can never decrypt it.
    const encryptedSession = encryptSession(session);
    return {
      encryptedSession,
      sessionExpiry: session.expiresAt,
      profile,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Refresh an existing session using the refresh token.
 * The client passes the encrypted session blob; we decrypt, refresh, re-encrypt.
 */
export async function refreshSession(
  encryptedSession: string,
): Promise<RefreshSessionResult> {
  if (!encryptedSession) {
    throw new SessionExpiredError();
  }
  let session: GSTSession;
  try {
    session = decryptSession<GSTSession>(encryptedSession);
  } catch {
    throw new SessionExpiredError();
  }
  // If the session is already expired, the provider may throw — let it.
  const provider = getGSTProvider();
  try {
    const { session: newSession } = await provider.refreshSession(session);
    return {
      encryptedSession: encryptSession(newSession),
      sessionExpiry: newSession.expiresAt,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Disconnect — invalidate the session server-side.
 * Idempotent: does not throw if the session is already invalid.
 */
export async function terminateConnection(
  encryptedSession: string | null,
): Promise<void> {
  if (!encryptedSession) return;
  let session: GSTSession;
  try {
    session = decryptSession<GSTSession>(encryptedSession);
  } catch {
    // Already invalid / corrupt — nothing to terminate.
    return;
  }
  const provider = getGSTProvider();
  try {
    await provider.disconnect(session);
  } catch (err) {
    // Don't throw on disconnect — the user is disconnecting anyway.
    // Log and move on.
    console.warn('[gstn-provider] disconnect failed (non-fatal):', friendlyGSTNError(err));
  }
}

// ─── Public GSTIN lookup ─────────────────────────────────────────────────────

/**
 * Public GSTIN verification — no session required.
 * Anyone can look up any GSTIN's legal name / status.
 */
export async function verifyGstin(
  organizationId: string,
  gstin: string,
): Promise<VerifyGSTINResult> {
  assertOrg(organizationId);
  assertGstin(gstin);
  const provider = getGSTProvider();
  try {
    return await provider.verifyGSTIN(gstin.toUpperCase());
  } catch (err) {
    throw rethrowTyped(err);
  }
}

// ─── Data fetch (sync) operations ────────────────────────────────────────────

/**
 * Fetch the full GST profile. Returns a Firestore-ready GSTProfile (the client
 * writes it to gst_profiles).
 */
export async function fetchProfile(
  organizationId: string,
  connectionId: string,
  encryptedSession: string,
): Promise<GSTProfile> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new GSTNError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireSession(encryptedSession);
  const provider = getGSTProvider();
  try {
    const profile = await provider.getProfile(session);
    // Stamp tenant scope so the client can write directly.
    return {
      ...profile,
      id: profile.id || `${session.gstin}-profile`,
      organizationId,
      connectionId,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Fetch GST returns. Returns Firestore-ready GSTReturn[] (the client writes
 * them to gst_returns in a batch).
 */
export async function fetchReturns(
  organizationId: string,
  connectionId: string,
  encryptedSession: string,
  options?: { period?: string; returnTypes?: GSTReturnType[] },
): Promise<GSTReturn[]> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new GSTNError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireSession(encryptedSession);
  const provider = getGSTProvider();
  try {
    const { returns } = await provider.syncReturns(session, options);
    // Stamp tenant scope + ensure each return has a stable id.
    return returns.map((r) => ({
      ...r,
      id: r.id || `${session.gstin}-${r.returnType}-${r.period}`,
      organizationId,
      connectionId,
    }));
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Fetch GST notices. Returns Firestore-ready GSTNotice[].
 */
export async function fetchNotices(
  organizationId: string,
  connectionId: string,
  encryptedSession: string,
): Promise<GSTNotice[]> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new GSTNError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireSession(encryptedSession);
  const provider = getGSTProvider();
  try {
    const { notices } = await provider.syncNotices(session);
    return notices.map((n) => ({
      ...n,
      id: n.id || `${session.gstin}-notice-${n.referenceNumber}`,
      organizationId,
      connectionId,
    }));
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Fetch all three ledgers (cash, credit, liability). Returns Firestore-ready GSTLedger[].
 */
export async function fetchLedgers(
  organizationId: string,
  connectionId: string,
  encryptedSession: string,
): Promise<GSTLedger[]> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new GSTNError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireSession(encryptedSession);
  const provider = getGSTProvider();
  try {
    const { cash, credit, liability } = await provider.syncLedgers(session);
    return [cash, credit, liability].map((l) => ({
      ...l,
      id: l.id || `${session.gstin}-${l.ledgerType}`,
      organizationId,
      connectionId,
    }));
  } catch (err) {
    throw rethrowTyped(err);
  }
}

// ─── Full sync (orchestrates all fetches) ────────────────────────────────────

/**
 * Perform a full sync — profile + returns + notices + ledgers.
 * Returns everything in one shot so the client can write atomically.
 *
 * Used by:
 *   - Manual "Sync Now" button
 *   - Automatic scheduler
 *   - Background sync
 *   - Retry-failed logic
 */
export async function fullSync(
  organizationId: string,
  connectionId: string,
  encryptedSession: string,
): Promise<{
  profile: GSTProfile;
  returns: GSTReturn[];
  notices: GSTNotice[];
  ledgers: GSTLedger[];
}> {
  const profile = await fetchProfile(organizationId, connectionId, encryptedSession);
  const returns = await fetchReturns(organizationId, connectionId, encryptedSession);
  const notices = await fetchNotices(organizationId, connectionId, encryptedSession);
  const ledgers = await fetchLedgers(organizationId, connectionId, encryptedSession);
  return { profile, returns, notices, ledgers };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireSession(encryptedSession: string): GSTSession {
  if (!encryptedSession) {
    throw new SessionExpiredError();
  }
  try {
    return decryptSession<GSTSession>(encryptedSession);
  } catch {
    throw new SessionExpiredError();
  }
}

/**
 * Wrap an unknown error in a typed GSTNError if it isn't already one.
 * Preserves the original message + code.
 */
function rethrowTyped(err: unknown): never {
  if (err instanceof GSTNError) throw err;
  if (err instanceof Error) {
    throw new GSTNError(err.message, {
      code: 'PROVIDER_ERROR',
      statusCode: 502,
      retryable: true,
      cause: err,
    });
  }
  throw new GSTNError('An unknown error occurred while contacting GST.', {
    code: 'UNKNOWN',
    statusCode: 500,
  });
}

// ─── Provider diagnostics ────────────────────────────────────────────────────

export async function providerHealthCheck(): Promise<{
  healthy: boolean;
  name: string;
  isLive: boolean;
}> {
  const provider = getGSTProvider();
  try {
    const healthy = await provider.healthCheck();
    return { healthy, name: provider.name, isLive: provider.isLive };
  } catch {
    return { healthy: false, name: provider.name, isLive: provider.isLive };
  }
}
