'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — ZohoHeader
// ═══════════════════════════════════════════════════════════════════════════════
//
// Sticky connection-header bar shown at the top of the connected-mode
// dashboard. Glass-effect backdrop blur, never overlaps content.
//
// Layout:
//   • Left: Zoho brand tile + "Zoho Books" + status pill +
//           organizationName + dataCenter badge
//   • Right: "Sync Now" (primary, blue) + "Refresh Token" (ghost) +
//            "Disconnect" (destructive ghost) + "Settings" (icon button)
//   • Below: subtle row — "Last sync: {relative}" · "Auto-sync: ON" ·
//            "Token expires in: {time}"  (auto-sync line hidden when expired)
//
// STATE-AWARE UI:
//   • tokenExpired === true  → amber "Action needed" pill, prominent amber
//     banner above the bar with a one-click "Refresh Token" CTA, "Sync Now"
//     disabled with tooltip "Refresh token first".
//   • tokenExpired === false → green "Connected" pill, normal meta row.
//
// RULE 6: BLUE primary actions. emerald-400 ONLY for the "Connected" success
// pill (sparingly). amber-400 for warnings. No green elsewhere.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Loader2,
  Unplug,
  Settings2,
  Zap,
  Clock,
  Repeat,
  AlertTriangle,
  X,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatRelative } from './types';
import type { ZohoOrgListItem } from '@/hooks/useZohoBooks';

interface ZohoHeaderProps {
  /** Display name of the connected Zoho Books organization. */
  organizationName: string | null;
  /** Data center short code (in / com / eu / …). */
  dataCenter: string | null;
  /** ISO timestamp of the most-recent sync completion (or start, if running). */
  lastSyncAt: string | null;
  /** ISO timestamp the access token expires at (best-effort, may be null). */
  tokenExpiresAt: string | null;
  /** True while a sync is currently running (toggles Sync button spinner). */
  syncing: boolean;
  /** True while a connect/disconnect/refresh call is in-flight. */
  pending: boolean;
  /** Fire-and-forget sync trigger (calls /api/integrations/zoho/sync). */
  onSyncNow: () => Promise<{ ok: boolean; error: string | null }>;
  /** Token refresh (calls /api/integrations/zoho/refresh). */
  onRefreshToken: () => Promise<{ error: string | null }>;
  /** Disconnect (calls /api/integrations/zoho/disconnect). */
  onDisconnect: () => Promise<{ error: string | null }>;
  /** Real connection verification (live probe). Optional. */
  onVerify?: () => Promise<unknown>;
  /** Available Zoho Books organizations (for the org selector). */
  organizations?: ZohoOrgListItem[];
  organizationsLoading?: boolean;
  onListOrganizations?: () => Promise<unknown>;
  onSelectOrganization?: (zohoOrgId: string, zohoOrgName?: string) => Promise<{ ok: boolean; error: string | null }>;
}

function dataCenterLabel(dc: string | null): string {
  if (!dc) return '—';
  const map: Record<string, string> = {
    in: 'India',
    com: 'US',
    eu: 'Europe',
    au: 'Australia',
    jp: 'Japan',
    ca: 'Canada',
    sa: 'South Africa',
  };
  return map[dc] ?? dc.toUpperCase();
}

function tokenExpiresInLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const seconds = Math.floor((d.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return 'expired';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function isTokenExpired(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getTime() <= Date.now();
}

export function ZohoHeader({
  organizationName,
  dataCenter,
  lastSyncAt,
  tokenExpiresAt,
  syncing,
  pending,
  onSyncNow,
  onRefreshToken,
  onDisconnect,
  onVerify,
  organizations,
  organizationsLoading,
  onListOrganizations,
  onSelectOrganization,
}: ZohoHeaderProps) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  const tokenExpired = isTokenExpired(tokenExpiresAt);

  // Lazy-load the org list when the user opens the org selector (only if the
  // caller supports it). Avoids an extra API call on every page load.
  useEffect(() => {
    if (orgMenuOpen && onListOrganizations && (organizations ?? []).length === 0) {
      void onListOrganizations();
    }
  }, [orgMenuOpen, onListOrganizations, organizations]);

  const handleSync = useCallback(async () => {
    if (tokenExpired) {
      toast.error('Token expired', {
        description: 'Please refresh your Zoho Books token before syncing.',
        action: {
          label: 'Refresh Token',
          onClick: () => void onRefreshToken(),
        },
      });
      return;
    }
    const { ok, error } = await onSyncNow();
    if (!ok && error) {
      toast.error("We couldn't start the sync", {
        description: error,
        action: { label: 'Retry', onClick: () => void onSyncNow() },
      });
    } else if (ok) {
      toast.success('Sync started', {
        description: 'Pulling the latest records from Zoho Books.',
      });
    }
  }, [onSyncNow, onRefreshToken, tokenExpired]);

  const handleRefreshToken = useCallback(async () => {
    setRefreshing(true);
    const { error } = await onRefreshToken();
    setRefreshing(false);
    if (error) {
      toast.error("Couldn't refresh the Zoho token", { description: error });
    } else {
      toast.success('Token refreshed', {
        description: 'Your Zoho Books connection is reauthorized.',
      });
      setBannerDismissed(false);
    }
  }, [onRefreshToken]);

  const handleConfirmDisconnect = useCallback(async () => {
    setConfirmDisconnect(false);
    const { error } = await onDisconnect();
    if (error) {
      toast.error("Couldn't disconnect Zoho Books", { description: error });
    } else {
      toast.success('Zoho Books disconnected');
    }
  }, [onDisconnect]);

  const handleVerify = useCallback(async () => {
    if (!onVerify) return;
    setVerifying(true);
    try {
      await onVerify();
    } finally {
      setVerifying(false);
    }
  }, [onVerify]);

  const handleSelectOrg = useCallback(
    async (orgId: string, orgName: string) => {
      setOrgMenuOpen(false);
      if (!onSelectOrganization) return;
      const { error } = await onSelectOrganization(orgId, orgName);
      if (error) {
        toast.error("Couldn't switch Zoho organization", { description: error });
      } else {
        toast.success('Zoho organization updated', { description: orgName });
      }
    },
    [onSelectOrganization],
  );

  const orgs = organizations ?? [];
  const showOrgSelector = orgs.length > 1 && onSelectOrganization;

  return (
    <>
      {/* ─── Token-expired warning banner (amber, dismissible) ─── */}
      {tokenExpired && !bannerDismissed ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-3 text-amber-300 sm:items-center"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold">Zoho Books token expired</p>
            <p className="text-xs text-amber-300/80">
              Syncing is paused. Refresh your connection to resume live data
              flow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleRefreshToken}
              disabled={refreshing || pending}
              className="gap-1.5 border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 hover:text-amber-100"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {refreshing ? 'Refreshing…' : 'Refresh Token'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Dismiss banner"
              onClick={() => setBannerDismissed(true)}
              className="h-8 w-8 text-amber-300/70 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <header
        className="sticky top-0 z-20 -mx-4 border-b border-white/[0.06] bg-background/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6"
        aria-label="Zoho Books connection"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: brand + connection pill + org + data center */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.08]"
              style={{
                background: 'linear-gradient(135deg, #C8202F 0%, #9B1822 100%)',
              }}
            >
              <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M9 22V20.4L17.2 11H9.4V9H20.4V10.6L12.2 20H20.4V22H9Z"
                  fill="white"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Zoho Books
                </span>
                {tokenExpired ? (
                  <Badge
                    variant="outline"
                    className="border-amber-400/30 bg-amber-400/10 text-amber-400"
                  >
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Action needed
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                  >
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </Badge>
                )}
                {organizationName ? (
                  showOrgSelector ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOrgMenuOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        aria-haspopup="listbox"
                        aria-expanded={orgMenuOpen}
                        aria-label="Switch Zoho organization"
                      >
                        {organizationName}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {orgMenuOpen ? (
                        <div
                          role="listbox"
                          className="absolute left-0 top-full z-30 mt-1 min-w-[14rem] rounded-lg border border-white/[0.08] bg-[#0C0C0C] p-1 shadow-xl"
                        >
                          {organizationsLoading ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading organizations…
                            </div>
                          ) : null}
                          {orgs.map((o) => (
                            <button
                              key={o.organization_id}
                              type="button"
                              role="option"
                              aria-selected={o.name === organizationName}
                              onClick={() => void handleSelectOrg(o.organization_id, o.name)}
                              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06] ${
                                o.name === organizationName ? 'text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              <span className="truncate">{o.name}</span>
                              {o.is_default_org ? (
                                <span className="shrink-0 rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-muted-foreground">
                                  default
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {organizationName}
                    </span>
                  )
                ) : null}
                {dataCenter ? (
                  <Badge
                    variant="outline"
                    className="border-white/[0.08] bg-white/[0.04] text-muted-foreground"
                  >
                    {dataCenterLabel(dataCenter)}
                  </Badge>
                ) : null}
              </div>
              {/* Subtle meta row — auto-sync hidden when token expired */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last sync: {formatRelative(lastSyncAt)}
                </span>
                {!tokenExpired ? (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="h-3 w-3" />
                      Auto-sync: ON
                    </span>
                  </>
                ) : null}
                <span className="text-white/[0.12]">·</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    tokenExpired ? 'text-amber-400' : ''
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  Token: {tokenExpiresInLabel(tokenExpiresAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider delayDuration={200}>
              {tokenExpired ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} aria-label="Sync disabled — token expired">
                      <Button
                        size="sm"
                        disabled
                        className="gap-1.5 cursor-not-allowed opacity-60"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Sync Now
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Refresh your token to enable syncing
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing || pending}
                  className="gap-1.5"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </Button>
              )}
            </TooltipProvider>

            {!tokenExpired ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefreshToken}
                disabled={refreshing || pending || syncing}
                className="gap-1.5"
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh Token
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDisconnect(true)}
              disabled={pending || syncing}
              className="gap-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-400"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </Button>
            {onVerify ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleVerify}
                      disabled={verifying || pending || syncing}
                      className="gap-1.5"
                    >
                      {verifying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">Verify</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Test the live Zoho Books connection
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Settings"
                    className="h-8 w-8"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Settings (coming soon)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Disconnect confirmation */}
      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Zoho Books?</AlertDialogTitle>
            <AlertDialogDescription>
              You&rsquo;ll lose live sync until you reconnect. Your previously
              synced records stay in VEYRO. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDisconnect}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ZohoHeader;
