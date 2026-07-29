'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — global-error.tsx (Next.js convention)
//
// Catches errors that `error.tsx` CANNOT:
//   • Errors thrown in `layout.tsx` itself
//   • Errors thrown in `error.tsx` itself (recovery loop)
//   • Errors thrown in the root `<html>` / `<body>` render
//
// Next.js requires this file to render its OWN <html> and <body> tags because
// the root layout is bypassed when this boundary activates.
//
// UX: Branded, matches the app's dark theme. Two escape hatches: Reload page
// and Sign in again (in case the error was a stale auth state).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
     
    console.error('[GlobalError]', error);
  }, [error]);

  const safeMessage =
    error?.message && !/firebase|firestore|prisma/i.test(error.message)
      ? error.message.slice(0, 180)
      : 'Something went wrong on our end. Please try again.';

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleSignIn = () => {
    if (typeof window !== 'undefined') {
      // Clear any stale auth state and bounce to root.
      try {
        localStorage.removeItem('gstpilot_session');
        localStorage.removeItem('gstpilot_auth_v2');
      } catch {
        // ignore
      }
      window.location.href = '/';
    }
  };

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#fff' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '28rem',
              borderRadius: '1rem',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              padding: '1.5rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                margin: '0 auto 0.75rem',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239,68,68,0.1)',
              }}
            >
              <AlertTriangle size={24} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
              GSTPilot ran into a problem
            </h1>
            <p
              style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.5,
              }}
            >
              {safeMessage}
            </p>
            {error?.digest && (
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.3)',
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
            <div
              style={{
                marginTop: '1.25rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  background: '#fff',
                  color: '#000',
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#fff',
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                Reload page
              </button>
              <button
                onClick={handleSignIn}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#fff',
                  padding: '0.5rem 0.875rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                }}
              >
                <LogIn size={16} />
                Sign in again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
