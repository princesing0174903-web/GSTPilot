'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// useAsyncAction — single-flight async action hook with loading + error states
// ═══════════════════════════════════════════════════════════════════════════════
//
// Returns a tuple `[run, { loading, error, reset }]` where `run` is a stable
// callback that wraps your async function. Key properties:
//
//   • Single-flight: while `loading` is true, additional `run()` calls are
//     no-ops. This prevents double-click duplicate requests.
//   • Loading state always resets: a `finally` block guarantees `loading=false`
//     even if the async function never returns (combined with the caller's
//     timeout/fetchWithTimeout this means no infinite spinners).
//   • Error state: the caught error is exposed via `error`. The hook does NOT
//     toast — the caller decides how to surface errors (toast, inline, etc.).
//   • Unmount-safe: if the component unmounts mid-action, state updates are
//     skipped (via `useMountedRef`).
//
// Usage:
//   const [save, { loading: saving, error: saveError }] = useAsyncAction(
//     async (data) => { await fetch('/api/save', { ... }); }
//   );
//   <Button disabled={saving} onClick={() => save(formData)}>Save</Button>
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react';
import { useMountedRef } from './useMountedRef';

export interface UseAsyncActionState<TArgs extends unknown[], TResult> {
  loading: boolean;
  error: string | null;
  data: TResult | null;
  /** Reset `error` and `data` back to initial state. */
  reset: () => void;
}

export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): [(...args: TArgs) => Promise<TResult | null>, UseAsyncActionState<TArgs, TResult>] {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TResult | null>(null);
  const mountedRef = useMountedRef();
  // Single-flight guard — a ref so it's read synchronously at click time.
  const inFlightRef = useRef(false);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      // Single-flight: if a previous invocation is still pending, bail out.
      if (inFlightRef.current) {
        return null;
      }
      inFlightRef.current = true;
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await fn(...args);
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong';
        if (mountedRef.current) {
          setError(msg);
          setLoading(false);
        }
        return null;
      } finally {
        inFlightRef.current = false;
      }
    },
    [fn, mountedRef],
  );

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setError(null);
      setData(null);
    }
  }, [mountedRef]);

  return [run, { loading, error, data, reset }];
}
