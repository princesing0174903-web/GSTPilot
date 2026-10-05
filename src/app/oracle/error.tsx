'use client';

// Oracle-specific error boundary. If anything in the Oracle route throws during
// render, the user sees an on-brand retry screen instead of a blank page. This
// is additive (only affects /oracle) — the global app error boundary is left
// untouched.

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function OracleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Oracle] render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070707] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#1F1F1F] bg-[#0A0A0A] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Oracle hit a snag</h2>
        <p className="mt-1.5 text-sm text-white/55">
          Something went wrong while loading Oracle. Your conversation history is
          safe — try again.
        </p>
        {error?.digest && (
          <p className="mt-2 text-[11px] text-white/30">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
