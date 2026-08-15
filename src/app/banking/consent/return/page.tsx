// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Setu Consent Return Page
//
// /banking/consent/return
//
// Setu redirects the user's browser here after they approve/deny the data-
// sharing consent in the Setu webview. The redirect includes query params:
//   ?consentId=...&status=...   (Setu's redirect — params may vary by product)
//
// This page shows three states:
//   1. SUCCESS  — consent was approved; the bank connection is being finalized.
//   2. PENDING  — consent is still pending; the user should wait or retry.
//   3. FAILURE  — consent was rejected/expired; the user should retry.
//
// The page calls POST /api/banking/complete?connectionRef=<consentId> to
// finalize the connection (fetch the FI data + persist it). If the consent
// isn't approved yet, it polls every 5s for up to 2 minutes.
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, Loader2, Landmark, ArrowLeft } from 'lucide-react';

type PageState = 'loading' | 'success' | 'pending' | 'failure' | 'no-consent';

export default function ConsentReturnPage() {
  const searchParams = useSearchParams();
  const consentId = searchParams.get('consentId') || searchParams.get('consent') || searchParams.get('id');
  const initialStatus = searchParams.get('status')?.toUpperCase();

  // Derive the INITIAL state + message directly from the URL params (no effect).
  // This avoids the setState-in-effect anti-pattern.
  const { initialState, initialMessage, shouldPoll } = React.useMemo(() => {
    if (!consentId) {
      return {
        initialState: 'no-consent' as PageState,
        initialMessage: '',
        shouldPoll: false,
      };
    }
    if (initialStatus === 'ACTIVE' || initialStatus === 'APPROVED' || initialStatus === 'SUCCESS') {
      return {
        initialState: 'success' as PageState,
        initialMessage: 'Consent approved! Finalizing your bank connection…',
        shouldPoll: true,
      };
    }
    if (initialStatus === 'REJECTED' || initialStatus === 'DENIED' || initialStatus === 'FAILED') {
      return {
        initialState: 'failure' as PageState,
        initialMessage: 'The consent request was rejected. Please try again.',
        shouldPoll: false,
      };
    }
    if (initialStatus === 'EXPIRED') {
      return {
        initialState: 'failure' as PageState,
        initialMessage: 'The consent request expired. Please try again.',
        shouldPoll: false,
      };
    }
    return {
      initialState: 'pending' as PageState,
      initialMessage: 'Waiting for the consent to be approved…',
      shouldPoll: true,
    };
  }, [consentId, initialStatus]);

  const [state, setState] = useState<PageState>(initialState);
  const [message, setMessage] = useState<string>(initialMessage);
  const pollCountRef = useRef(0);

  // NOTE: We intentionally do NOT sync `state`/`message` from `initialState`/
  // `initialMessage` via an effect when URL params change. This page is a
  // redirect target from Setu — the user lands here once with fixed query
  // params and does not navigate within it. The polling effect below handles
  // all state transitions after mount.

  useEffect(() => {
    if (!shouldPoll || !consentId) return;

    // Attempt to finalize the connection by calling /api/banking/complete.
    // This polls the Setu consent status server-side and creates the data
    // session when the consent is ACTIVE.
    let cancelled = false;
    const poll = async () => {
      while (!cancelled && pollCountRef.current < 24) {
        // 24 polls × 5s = 2 minutes max
        pollCountRef.current += 1;
        try {
          const res = await fetch(
            `/api/banking/complete?connectionRef=${encodeURIComponent(consentId)}`,
            { method: 'POST' },
          );
          const data = await res.json();

          if (cancelled) return;

          if (res.ok && data.ok) {
            setState('success');
            setMessage('Your bank account is connected! You can return to the dashboard.');
            return;
          }

          if (res.status === 409 && data.code === 'CONSENT_PENDING') {
            setState('pending');
            setMessage(data.error || 'Consent is still pending. Waiting for approval…');
          } else if (res.status === 410) {
            setState('failure');
            setMessage(data.error || 'The consent was rejected. Please try again.');
            return;
          } else if (res.status === 401 || res.status === 403) {
            setState('failure');
            setMessage('Authentication required. Please sign in and try again.');
            return;
          } else if (res.status === 503) {
            setState('failure');
            setMessage(
              data.error ||
                'Setu is not configured on this server. Contact your administrator.',
            );
            return;
          } else {
            // Unknown error — keep polling (might be transient).
            setState('pending');
            setMessage('Checking consent status…');
          }
        } catch {
          if (cancelled) return;
          setState('pending');
          setMessage('Waiting for the consent to be approved…');
        }
        await new Promise((r) => setTimeout(r, 5000));
      }

      if (!cancelled) {
        setState('pending');
        setMessage(
          'We are still waiting for Setu to confirm your consent. You can return to the dashboard — we will finalize the connection automatically when the consent is approved.',
        );
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [shouldPoll, consentId]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo / Icon */}
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-500/10">
            <Landmark className="h-8 w-8 text-blue-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {state === 'success' && 'Bank Connected'}
              {state === 'pending' && 'Awaiting Consent'}
              {state === 'failure' && 'Connection Failed'}
              {state === 'loading' && 'Finalizing…'}
              {state === 'no-consent' && 'Nothing to do here'}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {message ||
                'This page is shown after you approve bank data sharing via Setu Account Aggregator.'}
            </p>
          </div>

          {/* State icon */}
          <div className="py-4">
            {state === 'loading' && (
              <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
            )}
            {state === 'success' && (
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            )}
            {state === 'pending' && (
              <Clock className="h-12 w-12 text-amber-400 animate-pulse" />
            )}
            {state === 'failure' && <XCircle className="h-12 w-12 text-red-400" />}
            {state === 'no-consent' && (
              <Clock className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          {/* Consent ID (for debugging) */}
          {consentId && (
            <p className="text-xs text-muted-foreground/60 font-mono">
              Consent ID: {consentId}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Dashboard
            </a>
            {(state === 'failure' || state === 'no-consent') && (
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Try Again
              </a>
            )}
          </div>

          {/* Footer note */}
          <p className="text-xs text-muted-foreground/50 pt-4">
            GSTPilot uses the Setu Account Aggregator gateway to securely fetch
            your bank data with your explicit consent. You can revoke consent
            at any time from your banking settings.
          </p>
        </div>
      </div>
    </main>
  );
}
