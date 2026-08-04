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
  const orgId = organization?.id ?? 'local';

  const [briefing, setBriefing] = useState<OracleDailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
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
