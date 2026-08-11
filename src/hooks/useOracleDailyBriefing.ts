'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * useOracleDailyBriefing — Oracle's proactive daily brief
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Fetches /api/oracle/daily-briefing — what Oracle ALREADY did + what needs
 * the user's approval. 60s auto-refresh.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { fetchWithTimeout } from '@/lib/async';
import type { OracleDailyBriefing } from '@/lib/oracle/daily-briefing';

const REFRESH_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

interface State {
  briefing: OracleDailyBriefing | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useOracleDailyBriefing(): State {
  const { organization } = useOrg();
  // ── PERF FIX: only fetch when we have a REAL org id. Previously this used
  //    `?? 'local'`, which fired a request immediately on mount BEFORE
  //    OrgContext resolved the real org. That request either returned empty
  //    data (wasted round-trip) or 401'd (auth header not yet attached),
  //    then the hook fired AGAIN when the real org id arrived. Now we wait.
  const orgId = organization?.id ?? null;

  const [briefing, setBriefing] = useState<OracleDailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    // Don't fire until the real org id is available. This prevents a
    // wasted request with the placeholder 'local' id that OrgContext
    // hasn't resolved yet (which also caused 401s because the auth
    // header wasn't attached for the placeholder).
    if (!orgId) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    fetchWithTimeout(
      `/api/oracle/daily-briefing?organizationId=${encodeURIComponent(orgId)}`,
      { signal: ac.signal, timeoutMs: FETCH_TIMEOUT_MS },
    )
      .then(async (res) => {
        const data = (await res.json()) as OracleDailyBriefing;
        setBriefing(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError(err?.message ?? 'Failed to load briefing');
        setLoading(false);
      })
      .finally(() => {
        inFlightRef.current = false;
      });

    return () => {
      ac.abort();
    };
  }, [orgId, refreshTick]);

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((n) => n + 1), REFRESH_INTERVAL_MS);
    const onFocus = () => setRefreshTick((n) => n + 1);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return { briefing, loading, error, refresh };
}
