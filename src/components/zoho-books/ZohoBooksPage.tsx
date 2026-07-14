'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Integration Page (Phase 1: OAuth)
//
// Premium integration console mirroring the Google Workspace page design:
//   • Connection header (connect / disconnect / refresh / status)
//   • Connected-state card showing Organization + Scopes (Books, Invoices,
//     Customers, Bills, Expenses, Banking, Reports)
//   • OAuth success/error banner (reads ?zoho_connected=1 / ?zoho_error=…)
//   • Security note (AES-256-GCM encrypted tokens)
//
// Phase 1 milestone: OAuth + token encryption + token storage + token refresh
// + connected status. NO accounting data sync yet — that's Phase 2.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Plug,
  Unplug,
  AlertCircle,
  ShieldCheck,
  Building2,
  KeyRound,
  Database,
  Server,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useZohoBooks } from '@/hooks/useZohoBooks';
import { useOrg } from '@/contexts/OrgContext';

// ─── Zoho Books brand mark (red "Z" tile) ────────────────────────────────────

function ZohoBooksLogo({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08] ${className ?? ''}`}
    >
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#C8202F" />
        <path
          d="M9 22V20.4L17.2 11H9.4V9H20.4V10.6L12.2 20H20.4V22H9Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

// ─── Connection Header ───────────────────────────────────────────────────────

function ConnectionHeader() {
  const { status, statusLoading, connect, disconnect, refresh, pending, refreshStatus } = useZohoBooks();
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    const { authUrl, error } = await connect();
    if (error) {
      setConnectError(error);
      return;
    }
    if (authUrl) {
      window.location.href = authUrl;
    }
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Zoho Books? You will need to reconnect to use this integration.')) {
      return;
    }
    const { error } = await disconnect();
    if (error) setConnectError(error);
  }, [disconnect]);

  const handleRefresh = useCallback(async () => {
    setConnectError(null);
    const { error } = await refresh();
    if (error) setConnectError(error);
  }, [refresh]);

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ZohoBooksLogo className="h-12 w-12" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Zoho Books</h2>
              {statusLoading ? (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking…
                </Badge>
              ) : status?.connected ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected ✓
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" /> Not connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.connected
                ? `Connected as ${status.userEmail ?? 'unknown'}`
                : 'Connect your Zoho Books account to enable India\u2019s leading accounting platform.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refreshStatus()}
            disabled={statusLoading}
            className="h-8 gap-1.5 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {status?.connected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={pending}
                className="h-8 gap-1.5"
                title="Force-refresh the Zoho Books access token"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                Refresh Token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={pending}
                className="h-8 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={pending}
              className="h-8 gap-1.5 bg-[#C8202F] text-white hover:bg-[#a01a26]"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Connect Zoho
            </Button>
          )}
        </div>
        {connectError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {connectError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Connected-state details card ────────────────────────────────────────────

function ConnectionDetails() {
  const { status } = useZohoBooks();

  if (!status?.connected) {
    return null;
  }

  return (
    <Card className="border-border/60 bg-card/50 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold tracking-tight">Connection Details</span>
          </div>

          {/* Organization */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Organization
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {status.organizationName ?? 'Not mapped yet'}
              </span>
              {status.zohoOrgId ? (
                <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-mono text-muted-foreground">
                  ID: {status.zohoOrgId}
                </Badge>
              ) : null}
            </div>
            {status.dataCenter ? (
              <span className="text-[10px] text-muted-foreground/70">
                Data center: <span className="font-mono">{status.dataCenter}</span>
              </span>
            ) : null}
          </div>

          {/* Scopes */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              Scopes
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {status.scopeAreas.length > 0 ? (
                status.scopeAreas.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="h-6 px-2 text-[10px] font-medium border-[#C8202F]/20 bg-[#C8202F]/5 text-[#ff6b78]"
                  >
                    {s}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No scopes</span>
              )}
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <MetaItem
              icon={<KeyRound className="h-3.5 w-3.5" />}
              label="Access Token"
              value="AES-256-GCM encrypted"
              valueClassName="text-emerald-400"
            />
            <MetaItem
              icon={<Database className="h-3.5 w-3.5" />}
              label="Token Storage"
              value="ZohoBooksToken (Prisma)"
              valueClassName="text-muted-foreground font-mono"
            />
            <MetaItem
              icon={<Server className="h-3.5 w-3.5" />}
              label="Connected At"
              value={status.connectedAt ? new Date(status.connectedAt).toLocaleString() : '—'}
              valueClassName="text-muted-foreground"
            />
          </div>

          {/* Phase 1 notice */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-relaxed">
              <span className="font-medium">Phase 1 (OAuth)</span> — connection is live and tokens are encrypted at
              rest. Data sync (Invoices, Customers, Bills, Expenses, Banking) arrives in Phase 2.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaItem({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className={`text-xs ${valueClassName ?? 'text-foreground'}`}>{value}</span>
    </div>
  );
}

// ─── Not-connected gate ──────────────────────────────────────────────────────

function NotConnectedGate({ children }: { children: React.ReactNode }) {
  const { status, statusLoading } = useZohoBooks();
  if (statusLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (!status?.connected) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-border/60 bg-card/50 p-8 text-center shadow-sm backdrop-blur">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Plug className="h-7 w-7 text-amber-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight">Connect Zoho Books</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Click <span className="font-medium text-foreground">Connect Zoho</span> above to authorize GSTPilot
              to access your Zoho Books organization. Tokens are encrypted with AES-256-GCM at rest.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <span>India&apos;s leading accounting platform · OAuth 2.0 · Multi-tenant</span>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ZohoBooksPage() {
  const { organization } = useOrg();

  // Detect ?zoho_connected=1 or ?zoho_error=… from the OAuth callback
  // redirect and surface a one-shot toast-like banner.
  const [oauthBanner, setOauthBanner] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('zoho_connected')) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOauthBanner({ ok: true, message: 'Zoho Books connected successfully.' });
      } else if (params.get('zoho_error')) {
        setOauthBanner({
          ok: false,
          message: `Zoho connection failed: ${params.get('zoho_error')}`,
        });
      }
      // Clean the URL.
      if (params.get('zoho_connected') || params.get('zoho_error')) {
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    } catch {
      /* SSR guard */
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Zoho Books</h1>
          <Badge variant="outline" className="border-[#C8202F]/30 bg-[#C8202F]/10 text-[#ff6b78]">
            Accounting Integration
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {organization?.name ? `${organization.name} · ` : ''}
          India&apos;s leading accounting platform — connected with encrypted OAuth tokens.
        </p>
      </div>

      {/* OAuth banner */}
      <AnimatePresence>
        {oauthBanner ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              oauthBanner.ok
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            }`}
          >
            {oauthBanner.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            <span className="flex-1">{oauthBanner.message}</span>
            <button
              onClick={() => setOauthBanner(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Connection */}
      <ConnectionHeader />

      {/* Security note */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <span>
          Tokens are AES-256-GCM encrypted at rest. Only your organization can access them. Disconnect anytime to
          revoke access.
        </span>
      </div>

      {/* Connection details (only when connected) */}
      <NotConnectedGate>
        <ConnectionDetails />
      </NotConnectedGate>
    </div>
  );
}
