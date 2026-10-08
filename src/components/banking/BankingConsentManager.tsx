'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — BankingConsentManager
//
// Displays the Account Aggregator consent lifecycle:
//   - Active consents (with expiry countdown)
//   - Revoke consent button
//   - Consent history (revoked / expired)
//   - Lifecycle event log
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️  PREPARATION MODE  ⚠️
// ═══════════════════════════════════════════════════════════════════════════════
//
// This component is STRUCTURALLY COMPLETE and renders real data from the
// existing BankConnection collection (consentExpiry, status fields). It works
// fully with the Mock provider — showing "no active consents" empty states
// because Mock connections don't carry AA consent metadata.
//
// When Setu goes live, the consent API will populate the consentId / vua /
// linkedAccounts fields from the decrypted session metadata, and this
// component will display them without any code changes.
//
// The "Revoke Consent" button calls the existing /api/banking/disconnect
// endpoint — which works for both Mock (clears the connection) and Setu
// (calls SetuAAProvider.disconnect → client.revokeConsent once wired).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Ban,
  History,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import type {
  BankConsent,
  ConsentHistoryEntry,
  ConsentManagementState,
  ConsentStatus,
} from '@/lib/banking-provider/consent-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(isoDate: string | null): number {
  if (!isoDate) return -1;
  const ms = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function formatExpiry(isoDate: string | null): string {
  if (!isoDate) return '—';
  const days = daysUntil(isoDate);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 30) return `Expires in ${days}d`;
  const months = Math.floor(days / 30);
  return `Expires in ${months}mo`;
}

function statusBadge(status: ConsentStatus): React.ReactNode {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/20">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/20">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    case 'revoked':
      return (
        <Badge className="bg-zinc-500/15 text-zinc-300 border-zinc-500/30 hover:bg-zinc-500/20">
          <Ban className="w-3 h-3 mr-1" /> Revoked
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-zinc-500/15 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20">
          <Clock className="w-3 h-3 mr-1" /> Expired
        </Badge>
      );
    default:
      return null;
  }
}

function eventIcon(event: ConsentHistoryEntry['event']): React.ReactNode {
  switch (event) {
    case 'consent_requested':
      return <Smartphone className="w-4 h-4 text-blue-400" />;
    case 'consent_approved':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'consent_rejected':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'consent_revoked':
      return <Ban className="w-4 h-4 text-zinc-400" />;
    case 'consent_expired':
      return <Clock className="w-4 h-4 text-zinc-500" />;
    case 'consent_refreshed':
      return <ShieldCheck className="w-4 h-4 text-blue-400" />;
    case 'data_synced':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    default:
      return <Info className="w-4 h-4 text-zinc-400" />;
  }
}

// ─── Active Consent Card ─────────────────────────────────────────────────────

interface ActiveConsentCardProps {
  consent: BankConsent;
  onRevoke: (consent: BankConsent) => void;
  revoking: boolean;
}

function ActiveConsentCard({ consent, onRevoke, revoking }: ActiveConsentCardProps) {
  const expiryWarning = consent.daysRemaining >= 0 && consent.daysRemaining <= 7;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{consent.bankName}</span>
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-1">
              {consent.accountNumberMasked}
              {consent.vua && (
                <span className="ml-2 text-zinc-500">· VUA: {consent.vua}</span>
              )}
            </CardDescription>
          </div>
          {statusBadge(consent.status)}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Expiry */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatExpiry(consent.consentExpiry)}
          </span>
          {expiryWarning && (
            <span className="text-amber-400 flex items-center gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" />
              Expires soon
            </span>
          )}
        </div>

        {/* Linked accounts (Setu only — empty for Mock) */}
        {consent.linkedAccounts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Linked Accounts ({consent.linkedAccounts.length})
            </p>
            {consent.linkedAccounts.map((acc, i) => (
              <div
                key={acc.linkRefNumber || i}
                className="flex items-center justify-between text-xs bg-zinc-950/50 rounded px-2 py-1.5"
              >
                <span className="text-zinc-300 font-mono">{acc.maskedAccNumber}</span>
                <span className="text-zinc-500">
                  {acc.accType} · {acc.fipId}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Consent ID (Setu only — null for Mock) */}
        {consent.consentId && (
          <div className="text-xs text-zinc-600 font-mono truncate">
            Consent ID: {consent.consentId}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => onRevoke(consent)}
            disabled={revoking}
          >
            <Ban className="w-3 h-3 mr-1" />
            {revoking ? 'Revoking...' : 'Revoke Consent'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── History Row ─────────────────────────────────────────────────────────────

function HistoryRow({ consent }: { consent: BankConsent }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {statusBadge(consent.status)}
        <div className="min-w-0">
          <p className="text-sm text-zinc-300 truncate">
            {consent.bankName} · {consent.accountNumberMasked}
          </p>
          <p className="text-xs text-zinc-600">
            {consent.revokedAt
              ? `Revoked ${new Date(consent.revokedAt).toLocaleDateString()}`
              : consent.consentExpiry
                ? `Expired ${new Date(consent.consentExpiry).toLocaleDateString()}`
                : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Event Log Row ───────────────────────────────────────────────────────────

function EventRow({ entry }: { entry: ConsentHistoryEntry }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-800/50 last:border-0">
      <div className="mt-0.5 shrink-0">{eventIcon(entry.event)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300">{entry.description}</p>
        <p className="text-xs text-zinc-600">
          {new Date(entry.timestamp).toLocaleString()} · {entry.provider}
        </p>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function NoConsentsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
        <ShieldAlert className="w-6 h-6 text-zinc-500" />
      </div>
      <p className="text-sm text-zinc-400 font-medium">No active consents</p>
      <p className="text-xs text-zinc-600 mt-1 max-w-sm">
        Connect a bank account via the Account Aggregator to manage consents here.
        Consents grant time-limited access to your bank data — you can revoke
        them at any time.
      </p>
    </div>
  );
}

// ─── Preparation Mode Banner ─────────────────────────────────────────────────

function PreparationModeBanner() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-200/90">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
      <div className="text-xs space-y-1">
        <p className="font-medium">Banking integration is in preparation mode</p>
        <p className="text-amber-200/70">
          The Setu Account Aggregator adapter is structurally complete but not
          yet connected. Mock connections work normally. Real AA consents will
          appear here once Setu sandbox credentials are verified.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface BankingConsentManagerProps {
  /** The consent management state from the API. */
  state: ConsentManagementState | null;
  /** Loading flag. */
  loading?: boolean;
  /** Callback to revoke a consent. */
  onRevokeConsent: (consent: BankConsent) => Promise<void>;
}

export function BankingConsentManager({
  state,
  loading = false,
  onRevokeConsent,
}: BankingConsentManagerProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = useCallback(
    async (consent: BankConsent) => {
      setRevokingId(consent.connectionId);
      try {
        await onRevokeConsent(consent);
        toast.success('Consent revoked', {
          description: `${consent.bankName} connection has been disconnected.`,
        });
      } catch (err) {
        toast.error('Failed to revoke consent', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setRevokingId(null);
      }
    },
    [onRevokeConsent],
  );

  const activeConsents = useMemo(
    () => state?.activeConsents ?? [],
    [state?.activeConsents],
  );
  const consentHistory = useMemo(
    () => state?.consentHistory ?? [],
    [state?.consentHistory],
  );
  const events = useMemo(() => state?.events ?? [], [state?.events]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-zinc-900/60 border border-zinc-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preparation mode banner (only when Setu not live) */}
      {state && !state.providerLive && <PreparationModeBanner />}

      {/* Active Consents */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-zinc-200">Active Consents</h3>
          <Badge variant="outline" className="text-zinc-400 border-zinc-700">
            {activeConsents.length}
          </Badge>
        </div>

        {activeConsents.length === 0 ? (
          <NoConsentsEmptyState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeConsents.map((consent) => (
              <ActiveConsentCard
                key={consent.connectionId}
                consent={consent}
                onRevoke={handleRevoke}
                revoking={revokingId === consent.connectionId}
              />
            ))}
          </div>
        )}
      </section>

      {/* Consent History */}
      {consentHistory.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-200">Consent History</h3>
            <Badge variant="outline" className="text-zinc-400 border-zinc-700">
              {consentHistory.length}
            </Badge>
          </div>
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="pt-4">
              {consentHistory.map((consent) => (
                <HistoryRow key={consent.connectionId} consent={consent} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Event Log */}
      {events.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-200">Lifecycle Events</h3>
          </div>
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardContent className="pt-4">
              {events.slice(0, 20).map((entry) => (
                <EventRow key={entry.id} entry={entry} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
