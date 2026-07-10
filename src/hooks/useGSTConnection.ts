'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — useGSTConnection() Hook
//
// The SINGLE hook every GSTPilot component uses to interact with the GST
// connection. Mirrors the useInvoices() + useGenerationJobs() pattern:
//
//   • READ — real-time subscriptions to connection, profile, returns, notices,
//     ledgers (org-scoped via onSnapshot)
//   • CONNECT — request OTP → verify OTP → persist encrypted session
//   • DISCONNECT — invalidate session + cascade-delete all GST data
//   • REFRESH — renew an expired session
//   • SYNC — full or scoped sync (profile / returns / notices / ledgers)
//   • VERIFY GSTIN — public lookup (no session required)
//
// All tenant scoping is automatic — components never touch `organizationId`.
// If the user has no organization yet, every operation no-ops safely.
//
// Architecture:
//   1. Mutations call the API route (/api/gstn/*) for provider work
//      (OTP, sync, refresh). The API returns plain data + the encrypted session.
//   2. The hook then persists the result to Firestore via the service layer.
//   3. Real-time onSnapshot subscriptions surface the change to every
//      connected client instantly.
//
// Security: the encrypted session blob is stored in Firestore but can ONLY be
// decrypted by the server (AES-256-GCM with a server-only master key). The
// client passes it opaquely to /api/gstn/* routes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToConnection,
  saveConnection,
  updateConnection,
  cascadeDisconnect,
  subscribeToProfile,
  saveProfile,
  subscribeToReturns,
  saveReturns,
  subscribeToNotices,
  saveNotices,
  subscribeToLedger,
  saveLedgers,
  createSyncJob,
  updateSyncJob,
  type GSTConnection,
  type GSTProfile,
  type GSTReturn,
  type GSTNotice,
  type GSTLedger,
  type GSTAuthStatus,
} from '@/lib/gstn-provider';
import type { VerifyGSTINResult } from '@/lib/gstn-provider/types';

// ─── Hook return type ────────────────────────────────────────────────────────

export interface UseGSTConnectionResult {
  /** The current org's GST connection (null if none). */
  connection: GSTConnection | null;
  /** GST profile (null if not yet synced / no connection). */
  profile: GSTProfile | null;
  /** GST returns (newest period first). */
  returns: GSTReturn[];
  /** GST notices (newest issueDate first). */
  notices: GSTNotice[];
  /** Cash ledger (null if not synced). */
  cashLedger: GSTLedger | null;
  /** Credit ledger (null if not synced). */
  creditLedger: GSTLedger | null;
  /** Liability ledger (null if not synced). */
  liabilityLedger: GSTLedger | null;

  /** Convenience: is there an active session? */
  isConnected: boolean;
  /** Convenience: current auth status (disconnected if no connection). */
  authStatus: GSTAuthStatus;

  loading: boolean;
  error: string | null;
  /** True while any mutation is in-flight. */
  saving: boolean;

  // ─── Mutations ────────────────────────────────────────────────────────────

  /** Step 1: request an OTP from GSTN for the given GSTIN + username. */
  requestOTP: (gstin: string, username: string) => Promise<boolean>;
  /** Step 2: verify the OTP and establish a session. Persists connection + profile. */
  verifyOTP: (gstin: string, username: string, otp: string) => Promise<boolean>;
  /** Disconnect — invalidate session + delete all GST data. */
  disconnect: () => Promise<boolean>;
  /** Refresh an expired session. */
  refreshSession: () => Promise<boolean>;
  /** Sync data from GSTN. scope: 'full' | 'profile' | 'returns' | 'notices' | 'ledgers'. */
  sync: (scope?: 'full' | 'profile' | 'returns' | 'notices' | 'ledgers') => Promise<boolean>;
  /** Public GSTIN lookup (no session required). */
  verifyGSTIN: (gstin: string) => Promise<VerifyGSTINResult | null>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useGSTConnection(): UseGSTConnectionResult {
  const { organization } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

  const [connection, setConnection] = useState<GSTConnection | null>(null);
  const [profile, setProfile] = useState<GSTProfile | null>(null);
  const [returns, setReturns] = useState<GSTReturn[]>([]);
  const [notices, setNotices] = useState<GSTNotice[]>([]);
  const [cashLedger, setCashLedger] = useState<GSTLedger | null>(null);
  const [creditLedger, setCreditLedger] = useState<GSTLedger | null>(null);
  const [liabilityLedger, setLiabilityLedger] = useState<GSTLedger | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Subscription refs (for cleanup)
  const unsubConnRef = useRef<(() => void) | null>(null);
  const unsubProfileRef = useRef<(() => void) | null>(null);
  const unsubReturnsRef = useRef<(() => void) | null>(null);
  const unsubNoticesRef = useRef<(() => void) | null>(null);
  const unsubCashRef = useRef<(() => void) | null>(null);
  const unsubCreditRef = useRef<(() => void) | null>(null);
  const unsubLiabilityRef = useRef<(() => void) | null>(null);

  // ─── Real-time subscriptions ──────────────────────────────────────────────

  useEffect(() => {
    // Cleanup previous subs
    unsubConnRef.current?.();
    unsubProfileRef.current?.();
    unsubReturnsRef.current?.();
    unsubNoticesRef.current?.();
    unsubCashRef.current?.();
    unsubCreditRef.current?.();
    unsubLiabilityRef.current?.();

    if (!orgId) {
      setConnection(null);
      setProfile(null);
      setReturns([]);
      setNotices([]);
      setCashLedger(null);
      setCreditLedger(null);
      setLiabilityLedger(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const onSubError = (err: Error) => {
      // Firestore backend unreachable (e.g. sandbox preview). Don't crash —
      // just surface a friendly error. The UI will show an empty state.
      console.warn('[useGSTConnection] subscription error:', err.message);
      setError(err.message);
      setLoading(false);
    };

    unsubConnRef.current = subscribeToConnection(
      orgId,
      (conn) => {
        setConnection(conn);
        setLoading(false);
        setError(null);
      },
      { onError: onSubError },
    );

    unsubProfileRef.current = subscribeToProfile(orgId, setProfile, { onError: onSubError });
    unsubReturnsRef.current = subscribeToReturns(orgId, setReturns, { onError: onSubError });
    unsubNoticesRef.current = subscribeToNotices(orgId, setNotices, {
      onError: onSubError,
      limitCount: 50,
    });
    unsubCashRef.current = subscribeToLedger(orgId, 'cash', setCashLedger, { onError: onSubError });
    unsubCreditRef.current = subscribeToLedger(orgId, 'credit', setCreditLedger, { onError: onSubError });
    unsubLiabilityRef.current = subscribeToLedger(orgId, 'liability', setLiabilityLedger, { onError: onSubError });

    return () => {
      unsubConnRef.current?.();
      unsubProfileRef.current?.();
      unsubReturnsRef.current?.();
      unsubNoticesRef.current?.();
      unsubCashRef.current?.();
      unsubCreditRef.current?.();
      unsubLiabilityRef.current?.();
    };
  }, [orgId]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const createdBy = {
    uid: user?.id ?? '',
    name: user?.name ?? 'Unknown',
    email: user?.email ?? '',
  };

  // ─── Mutation: requestOTP ──────────────────────────────────────────────────

  const requestOTP = useCallback(
    async (gstin: string, username: string): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/gstn/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, gstin, username }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to request OTP.');
        }

        // Persist a connection doc with authStatus='otp_requested'.
        // If a connection already exists, update it; otherwise create.
        if (connection?.id) {
          await updateConnection(orgId, connection.id, {
            gstin: gstin.toUpperCase(),
            username,
            authStatus: 'otp_requested',
            lastError: null,
          });
        } else {
          await saveConnection(orgId, {
            organizationId: orgId,
            gstin: gstin.toUpperCase(),
            legalName: '',
            tradeName: '',
            stateCode: gstin.slice(0, 2),
            username,
            authStatus: 'otp_requested',
            lastSync: null,
            sessionExpiry: null,
            encryptedSession: null,
            lastError: null,
            createdBy,
          });
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connection?.id, createdBy],
  );

  // ─── Mutation: verifyOTP ───────────────────────────────────────────────────

  const verifyOTP = useCallback(
    async (gstin: string, username: string, otp: string): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/gstn/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, gstin, username, otp }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'OTP verification failed.');
        }

        const { encryptedSession, sessionExpiry, profile: initialProfile } = data.result;

        // Update the connection with the encrypted session + active status.
        if (connection?.id) {
          await updateConnection(orgId, connection.id, {
            gstin: gstin.toUpperCase(),
            username,
            authStatus: 'session_active',
            sessionExpiry,
            encryptedSession,
            lastError: null,
            legalName: initialProfile.legalName ?? connection.legalName,
            tradeName: initialProfile.tradeName ?? connection.tradeName,
            stateCode: initialProfile.stateCode ?? gstin.slice(0, 2),
          });
        }

        // Persist the initial profile if the provider returned one.
        if (initialProfile.gstin) {
          await saveProfile(orgId, {
            id: `${gstin.toUpperCase()}-profile`,
            organizationId: orgId,
            connectionId: connection?.id ?? '',
            gstin: initialProfile.gstin ?? gstin.toUpperCase(),
            legalName: initialProfile.legalName ?? '',
            tradeName: initialProfile.tradeName ?? '',
            businessConstitution: initialProfile.businessConstitution ?? '',
            registrationDate: initialProfile.registrationDate ?? '',
            taxpayerType: initialProfile.taxpayerType ?? '',
            principalAddress: initialProfile.principalAddress ?? '',
            additionalPlaceOfBusiness: initialProfile.additionalPlaceOfBusiness ?? [],
            state: initialProfile.state ?? '',
            stateCode: initialProfile.stateCode ?? gstin.slice(0, 2),
            jurisdiction: initialProfile.jurisdiction ?? '',
            status: initialProfile.status ?? '',
            filingFrequency: initialProfile.filingFrequency ?? 'monthly',
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        // Mark the connection with the error if it exists.
        if (connection?.id) {
          await updateConnection(orgId, connection.id, {
            authStatus: 'error',
            lastError: msg,
          }).catch(() => {});
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connection?.id],
  );

  // ─── Mutation: disconnect ──────────────────────────────────────────────────

  const disconnect = useCallback(async (): Promise<boolean> => {
    if (!orgId || !connection?.id) return false;
    setSaving(true);
    setError(null);
    try {
      // Invalidate the session server-side (idempotent).
      await fetch('/api/gstn/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedSession: connection.encryptedSession }),
      });
      // Cascade-delete all GST data for this connection.
      await cascadeDisconnect(orgId, connection.id);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId, connection?.id, connection?.encryptedSession]);

  // ─── Mutation: refreshSession ─────────────────────────────────────────────

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!orgId || !connection?.id || !connection.encryptedSession) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/gstn/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedSession: connection.encryptedSession }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Session refresh failed. Please reconnect.');
      }
      const { encryptedSession, sessionExpiry } = data.result;
      await updateConnection(orgId, connection.id, {
        encryptedSession,
        sessionExpiry,
        authStatus: 'session_active',
        lastError: null,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      // Mark session as expired so the UI can prompt for reconnect.
      if (connection?.id) {
        await updateConnection(orgId, connection.id, {
          authStatus: 'session_expired',
          lastError: msg,
        }).catch(() => {});
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId, connection?.id, connection?.encryptedSession]);

  // ─── Mutation: sync ─────────────────────────────────────────────────────────

  const sync = useCallback(
    async (scope: 'full' | 'profile' | 'returns' | 'notices' | 'ledgers' = 'full'): Promise<boolean> => {
      if (!orgId || !connection?.id || !connection.encryptedSession) return false;
      setSaving(true);
      setError(null);

      // Record the sync job for audit.
      const syncJobId = await createSyncJob(orgId, {
        connectionId: connection.id,
        type: scope === 'full' ? 'full' : scope,
        trigger: 'manual',
        maxRetries: 3,
      }).catch(() => null);

      try {
        const res = await fetch('/api/gstn/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId: connection.id,
            encryptedSession: connection.encryptedSession,
            scope,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Sync failed.');
        }

        const { profile: p, returns: r, notices: n, ledgers: l } = data.result;

        // Persist each piece to Firestore (the real-time subs update the UI).
        if (p) await saveProfile(orgId, p);
        if (r && Array.isArray(r)) await saveReturns(orgId, r);
        if (n && Array.isArray(n)) await saveNotices(orgId, n);
        if (l && Array.isArray(l)) await saveLedgers(orgId, l);

        // Update the connection's lastSync + active status.
        await updateConnection(orgId, connection.id, {
          authStatus: 'session_active',
          lastSync: new Date().toISOString(),
          lastError: null,
        });

        // Mark the sync job complete.
        if (syncJobId) {
          await updateSyncJob(orgId, syncJobId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: {
              profileSynced: !!p,
              returnsSynced: r?.length ?? 0,
              noticesSynced: n?.length ?? 0,
              ledgersSynced: l?.length ?? 0,
            },
          }).catch(() => {});
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        // Mark the sync job failed.
        if (syncJobId) {
          await updateSyncJob(orgId, syncJobId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: msg,
          }).catch(() => {});
        }
        // If the session expired, mark the connection.
        if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired')) {
          await updateConnection(orgId, connection.id, {
            authStatus: 'session_expired',
            lastError: msg,
          }).catch(() => {});
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, connection?.id, connection?.encryptedSession],
  );

  // ─── Mutation: verifyGSTIN (public lookup) ────────────────────────────────

  const verifyGSTIN = useCallback(
    async (gstin: string): Promise<VerifyGSTINResult | null> => {
      if (!orgId) return null;
      try {
        const res = await fetch('/api/gstn/verify-gstin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, gstin }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'GSTIN verification failed.');
        }
        return data.result as VerifyGSTINResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return null;
      }
    },
    [orgId],
  );

  // ─── Derived state ─────────────────────────────────────────────────────────

  const authStatus: GSTAuthStatus = connection?.authStatus ?? 'disconnected';
  const isConnected = authStatus === 'session_active';

  return {
    connection,
    profile,
    returns,
    notices,
    cashLedger,
    creditLedger,
    liabilityLedger,
    isConnected,
    authStatus,
    loading,
    error,
    saving,
    requestOTP,
    verifyOTP,
    disconnect,
    refreshSession,
    sync,
    verifyGSTIN,
  };
}
