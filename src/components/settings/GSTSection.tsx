'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Settings → GST / GSTN Connection Center
// ═══════════════════════════════════════════════════════════════════════════════
//
// Premium enterprise control surface for the org's GSP (GST Suvidha Provider)
// integration. ONE source of truth — every state is derived from the canonical
// `GET /api/gst/status` response. The UI can NEVER show contradictory states
// (e.g. "Connected" + "Not connected" at the same time).
//
// Layout (top → bottom):
//   1. Connection Status Card        — always visible once loaded.
//      Shows the canonical mode badge (LIVE / SANDBOX / DEMO / NOT CONNECTED),
//      provider name, GSTIN, legal/trade name, last test, last sync, token
//      expiry.
//   2. Provider Configuration Card   — shown when (a) NOT connected, OR
//      (b) the user clicks "Reconfigure" while connected.
//      Lets the user pick a provider, choose sandbox/production, fill in
//      credentials, enter their GSTIN, and Save.
//   3. Actions Card                   — shown ONLY when connected.
//      Test Connection / Verify GSTIN / Sync GSTR-2B / Disconnect.
//   4. GSTIN Verification Result Card — appears after a successful verify.
//
// DESIGN — matches the rest of the Settings page exactly:
//   • .gst-card / .gst-btn / .gst-status / .gst-label design system
//   • Black background (#0A0A0A), dark cards (#0F1115), white typography,
//     BLUE accent (#2563EB).
//   • Emerald ONLY for the LIVE success badge (allowed by the GREEN
//     NEUTRALIZATION CASCADE exception).
//   • Skeleton loaders (animate-pulse) while fetching — never "Loading...".
//
// CRITICAL RULES:
//   • The mode badge ALWAYS reflects the backend's canonical state. The UI
//     NEVER claims "LIVE" unless `/api/gst/status` returns mode='live'.
//   • If status is 'not_connected', the Actions Card is HIDDEN — no live-data
//     actions are exposed until the user connects.
//   • If status is 'demo', a clear "Demo mode" banner is shown.
//   • Secrets are NEVER shown. After save, only masked indicators are
//     displayed (e.g. "Clie••••ab12").
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ShieldCheck, ShieldAlert, Loader2, CheckCircle2, XCircle, RefreshCw,
  Plug, Power, Zap, Clock, AlertTriangle, KeyRound,
  Activity, Eye, EyeOff, Save, ChevronDown, ChevronUp,
  Sparkles, Wifi, WifiOff, FlaskConical, Server, ExternalLink,
  History, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Auth headers helper (mirrors useSettingsHeaders in SettingsPage) ──
// Required so /api/gst/* routes can authenticate demo/local-workspace
// users who don't have a Firebase Bearer token. The x-gstpilot-actor
// header carries the uid+email that requireAuth() falls back to.
function useGstHeaders() {
  const { organization, membership, role } = useOrg();
  const { user } = useAuth();
  const buildHeaders = useCallback(
    (extra: Record<string, string> = {}): Record<string, string> => ({
      'Content-Type': 'application/json',
      'x-gstpilot-orgid': organization?.id ?? '',
      'x-gstpilot-actor': JSON.stringify({
        uid: user?.id ?? membership?.userId ?? '',
        email: user?.email ?? membership?.userEmail ?? '',
        name: user?.name ?? membership?.userDisplayName ?? null,
        role: role ?? null,
      }),
      ...extra,
    }),
    [organization?.id, user?.id, user?.email, user?.name, membership, role],
  );
  return buildHeaders;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type GSPMode = 'live' | 'sandbox' | 'demo' | 'not_connected';

interface GstStatus {
  mode: GSPMode;
  modeLabel: string;
  // Connection state machine — secondary signal alongside `mode`.
  // Values: not_connected | connecting | connected | syncing | synced |
  // token_expired | connection_error | rate_limited | partial_sync
  connectionState: string;
  providerKey: string;
  providerName: string;
  providerDisplayName: string;
  gstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  lastTestOk: boolean | null;
  lastTestedAt: string | null;
  lastTestMessage: string | null;
  lastSyncAt: string | null;
  tokenExpiry: string | null;
  tokenExpired: boolean;
  configId: string | null;
}

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
}

interface ProviderMeta {
  key: string;
  displayName: string;
  isLive: boolean;
  description: string;
  fields: ProviderField[];
  defaults?: { sandboxUrl?: string; productionUrl?: string };
}

interface TestResult {
  ok: boolean;
  provider: string;
  message: string;
  latencyMs?: number;
}

interface VerifyResult {
  gstin: string;
  valid: boolean;
  legalName: string;
  tradeName: string;
  stateCode: string;
  status: string;
  source: 'live' | 'sandbox' | 'demo';
  message?: string;
}

interface SyncSummary {
  recordsFetched: number;
  recordsImported: number;
  recordsChanged: number;
  // Per-record outcome breakdown (added with the sync-2b-runner upgrade).
  recordsUpdated: number;  // existing rows that had values changed
  recordsSkipped: number;  // existing rows that were unchanged (no-op)
  recordsFailed: number;   // records that errored during insert/update
  recordsRemoved: number;
  durationMs: number;
  mode: string;
  isLive: boolean;
  provider: string;
}

interface SyncJobRow {
  id: string;
  gstin: string;
  period: string;
  providerKey: string;
  mode: string;
  status: string;
  trigger: string;
  recordsFetched: number;
  recordsImported: number;
  recordsChanged: number;
  // Per-record outcome breakdown (added with the sync-jobs route upgrade).
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  recordsRemoved: number;
  durationMs: number | null;
  errorMessage: string | null;
  // If this job is a retry, points to the original job's id.
  retryOf: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ─── Mode → badge classes (matches server provider-mode.ts) ──────────────────

function modeBadgeClass(mode: GSPMode): string {
  switch (mode) {
    case 'live':
      // Emerald is allowed ONLY for the LIVE success badge (per GREEN
      // NEUTRALIZATION CASCADE exception).
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'sandbox':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'demo':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    case 'not_connected':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
}

function modeBannerClass(mode: GSPMode): string {
  switch (mode) {
    case 'live':
      return 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300';
    case 'sandbox':
      return 'border-amber-500/25 bg-amber-500/5 text-amber-300';
    case 'demo':
      return 'border-zinc-500/25 bg-zinc-500/5 text-zinc-300';
    case 'not_connected':
      return 'border-red-500/25 bg-red-500/5 text-red-300';
  }
}

function modeIcon(mode: GSPMode) {
  switch (mode) {
    case 'live':
      return <Wifi className="h-4 w-4" />;
    case 'sandbox':
      return <FlaskConical className="h-4 w-4" />;
    case 'demo':
      return <Sparkles className="h-4 w-4" />;
    case 'not_connected':
      return <WifiOff className="h-4 w-4" />;
  }
}

function modeBannerText(mode: GSPMode): string {
  switch (mode) {
    case 'live':
      return 'Live — connected to production GSTN. All data is fetched from the real GST portal.';
    case 'sandbox':
      return 'Sandbox — connected to the GSP test environment. Real HTTP, sample data.';
    case 'demo':
      return 'Demo mode — data is simulated offline. Connect a real GSP provider to fetch live GSTR-2B.';
    case 'not_connected':
      return 'Not connected — configure a GSP provider below to fetch live GSTR-2B data.';
  }
}

// ─── Connection-state badge (secondary indicator next to the mode badge) ────
//
// The mode badge (LIVE / SANDBOX / DEMO / NOT CONNECTED) is the PRIMARY
// indicator. The connectionState badge is SECONDARY — it surfaces what the
// backend's state machine currently says about the live connection (e.g.
// "syncing", "token_expired", "rate_limited"). Subtle styling so the mode
// badge stays the visual anchor.

function connectionStateBadge(state: string | null | undefined): React.ReactNode {
  if (!state || state === 'not_connected') return null;
  const label = state.replace(/_/g, ' ');
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  switch (state) {
    case 'connecting':
    case 'syncing':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          {pretty}
        </span>
      );
    case 'connected':
    case 'synced':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {pretty}
        </span>
      );
    case 'token_expired':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Token expired
        </span>
      );
    case 'rate_limited':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Rate limited
        </span>
      );
    case 'connection_error':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300">
          <XCircle className="h-3 w-3" />
          Connection error
        </span>
      );
    case 'partial_sync':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Partial sync
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
          {pretty}
        </span>
      );
  }
}

// ─── Sync job row badge helpers ──────────────────────────────────────────────
//
// Mirrors the modeBadgeClass shape but accepts plain string (the job.mode
// column is a free-text string in the schema, even though we always store
// 'live' | 'sandbox' | 'demo').

function jobModeBadgeClass(mode: string): string {
  switch (mode) {
    case 'live':
      // Emerald is allowed ONLY for LIVE badges (per GREEN NEUTRALIZATION CASCADE exception).
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'sandbox':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'demo':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    default:
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
  }
}

function jobStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      // Use blue success token (gst-status-success is blue per the design system,
      // emerald is reserved for LIVE mode only).
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'partial':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'failed':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'running':
      return 'border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#A78BFA]';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300';
  }
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES — mirror the ones in SettingsPage.tsx exactly so the
// GST section looks identical to the rest of the Settings page.
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsCard({
  title, description, children, action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gst-card border-[#1F1F1F] bg-[#0A0A0A] p-0 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[#1F1F1F] px-6 py-5">
        <div className="min-w-0">
          <CardTitle className="gst-card-title text-white">{title}</CardTitle>
          {description && (
            <CardDescription className="gst-description mt-1 text-zinc-400">
              {description}
            </CardDescription>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor} className="gst-label text-zinc-300">{children}</Label>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={`h-9 rounded-md border-[#2A2A2A] bg-[#0A0A0A] text-white placeholder:text-zinc-600 focus:border-[#2563EB] focus-visible:ring-[#2563EB]/20 ${props.className ?? ''}`}
    />
  );
}

function PrimaryButton({
  children, loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      className="gst-btn gst-btn-primary h-9 gap-2 border-0 disabled:cursor-not-allowed"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function GhostButton({
  children, loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      variant="outline"
      className="gst-btn gst-btn-outline h-9 gap-2"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function DangerButton({
  children, loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      className="gst-btn gst-btn-danger h-9 gap-2 border-0 disabled:cursor-not-allowed"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="h-8 w-1 rounded-full bg-[#2563EB]" aria-hidden />
      <div>
        <h2 className="gst-section-title text-white">{title}</h2>
        <p className="gst-description mt-1 text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────────────

function StatusSkeleton() {
  return (
    <Card className="gst-card border-[#1F1F1F] bg-[#0A0A0A] p-0">
      <CardHeader className="border-b border-[#1F1F1F] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-[#181818]" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-[#181818]" />
            <div className="h-3 w-48 animate-pulse rounded bg-[#141414]" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-[#181818]" />
            <div className="h-5 w-32 animate-pulse rounded bg-[#141414]" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ConfigSkeleton() {
  return (
    <Card className="gst-card border-[#1F1F1F] bg-[#0A0A0A] p-0">
      <CardHeader className="border-b border-[#1F1F1F] px-6 py-5">
        <div className="h-4 w-40 animate-pulse rounded bg-[#181818]" />
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[#181818]" />
            <div className="h-9 w-full animate-pulse rounded bg-[#141414]" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function GSTSection() {
  const { organization } = useOrg();
  const buildHeaders = useGstHeaders();
  const orgId = organization?.id ?? '';

  const [status, setStatus] = useState<GstStatus | null>(null);
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Configuration form state
  const [providerKey, setProviderKey] = useState<string>('mock');
  const [envMode, setEnvMode] = useState<'sandbox' | 'production'>('sandbox');
  const [gstinInput, setGstinInput] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Show/hide the config card while connected
  const [showConfig, setShowConfig] = useState(false);

  // Action results
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);

  // Action loading flags
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Sync history (recent GSTR-2B sync jobs) — shown in the Sync History card.
  const [syncJobs, setSyncJobs] = useState<SyncJobRow[]>([]);
  const [syncJobsLoading, setSyncJobsLoading] = useState(false);

  // ── Load status + providers ──
  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [statusRes, provRes] = await Promise.all([
        fetch(`/api/gst/status?organizationId=${encodeURIComponent(orgId)}`, { headers: buildHeaders() }).then((r) => r.json()),
        fetch('/api/gst/providers', { headers: buildHeaders() }).then((r) => r.json()),
      ]);
      if (statusRes.ok && statusRes.status) {
        setStatus(statusRes.status);
        // Pre-fill the form with the current config so "Reconfigure" shows the
        // current provider/GSTIN.
        if (statusRes.status.providerKey) setProviderKey(statusRes.status.providerKey);
        if (statusRes.status.gstin) setGstinInput(statusRes.status.gstin);
      }
      if (provRes.ok && Array.isArray(provRes.providers)) {
        setProviders(provRes.providers);
      }
    } catch {
      /* non-fatal — empty state will render */
    } finally {
      setLoading(false);
    }
  }, [orgId, buildHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Load sync history (recent GSTR-2B sync jobs) ──
  // Shown in the Sync History card. Refreshed after every sync/retry and via
  // the Refresh button on the card.
  const loadSyncHistory = useCallback(async () => {
    if (!orgId) return;
    setSyncJobsLoading(true);
    try {
      const res = await fetch(
        `/api/gst/sync-jobs?organizationId=${encodeURIComponent(orgId)}&limit=10`,
        { headers: buildHeaders() },
      );
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.jobs)) {
        setSyncJobs(data.jobs as SyncJobRow[]);
      }
    } catch {
      /* non-fatal — empty state will render */
    } finally {
      setSyncJobsLoading(false);
    }
  }, [orgId, buildHeaders]);

  // ── Resolve the selected provider meta ──
  const selectedProvider = useMemo<ProviderMeta | null>(() => {
    return providers.find((p) => p.key === providerKey) ?? null;
  }, [providers, providerKey]);

  // When the provider changes, pre-fill the apiEndpoint default + clear fields.
  useEffect(() => {
    if (!selectedProvider) return;
    const defaults = selectedProvider.defaults;
    const next = envMode === 'production' ? defaults?.productionUrl : defaults?.sandboxUrl;
    if (next) setApiEndpoint(next);
    // Reset field values for the new provider (don't carry over old secrets).
    setFieldValues({});
    setShowSecrets({});
  }, [selectedProvider, envMode]);

  // When env mode toggles, swap the apiEndpoint default too.
  useEffect(() => {
    if (!selectedProvider?.defaults) return;
    const next = envMode === 'production'
      ? selectedProvider.defaults.productionUrl
      : selectedProvider.defaults.sandboxUrl;
    if (next) setApiEndpoint(next);
  }, [envMode, selectedProvider]);

  // ── Save configuration ──
  const handleSave = async () => {
    if (!orgId || !selectedProvider) return;
    // Validate GSTIN if the provider is live (mock provider allows blank).
    const trimmedGstin = gstinInput.trim().toUpperCase();
    if (selectedProvider.isLive && trimmedGstin.length !== 15) {
      toast.error('GSTIN must be exactly 15 characters.');
      return;
    }
    // Validate required fields
    for (const f of selectedProvider.fields) {
      if (f.required && !fieldValues[f.key]?.trim()) {
        toast.error(`${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        organizationId: orgId,
        providerKey: selectedProvider.key,
        mode: envMode,
      };
      if (trimmedGstin) body.gstin = trimmedGstin;
      if (apiEndpoint) body.apiEndpoint = apiEndpoint;
      for (const f of selectedProvider.fields) {
        const v = fieldValues[f.key];
        if (v && v.trim()) body[f.key] = v.trim();
      }
      const res = await fetch('/api/gst/connect', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to save configuration.');
      }
      toast.success('GST configuration saved. Test the connection to activate it.');
      // Clear secrets from local state immediately — never hold them in memory.
      setFieldValues({});
      setShowSecrets({});
      setTestResult(null);
      setVerifyResult(null);
      setSyncResult(null);
      setShowConfig(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection ──
  const handleTest = async () => {
    if (!orgId) return;
    setActionLoading('test');
    setTestResult(null);
    try {
      const res = await fetch('/api/gst/test', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Test failed.');
      }
      setTestResult(data.result);
      if (data.result?.ok) {
        toast.success('Connection test succeeded.');
      } else {
        toast.error(`Test failed — ${data.result?.message ?? 'unknown error'}`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Verify GSTIN ──
  const handleVerify = async () => {
    if (!orgId) return;
    const gstin = (status?.gstin ?? gstinInput ?? '').trim().toUpperCase();
    if (gstin.length !== 15) {
      toast.error('A 15-character GSTIN is required before verifying.');
      return;
    }
    setActionLoading('verify');
    setVerifyResult(null);
    try {
      const res = await fetch('/api/gst/verify-gstin', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ organizationId: orgId, gstin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'GSTIN verification failed.');
      }
      setVerifyResult(data.result);
      if (data.result?.valid) {
        toast.success(`GSTIN verified (${data.result.source.toUpperCase()}).`);
      } else {
        toast.error('GSTIN failed validation.');
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'GSTIN verification failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Sync GSTR-2B ──
  const handleSync = async () => {
    if (!orgId) return;
    setActionLoading('sync');
    setSyncResult(null);
    try {
      const res = await fetch('/api/gst/sync-2b', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // The backend returns HTTP 409 with code='NOT_TESTED' when a real
        // provider is configured but has not been Test-Connection'd yet.
        // Surface a clear, actionable error so the user knows what to do.
        if (res.status === 409 && data.code === 'NOT_TESTED') {
          throw new Error('Provider not tested. Click "Test Connection" first to activate it.');
        }
        throw new Error(data.error ?? 'Sync failed.');
      }
      setSyncResult(data.summary);
      toast.success(
        `Sync complete (${data.summary.mode.toUpperCase()}) — ` +
        `${data.summary.recordsFetched} fetched, ` +
        `${data.summary.recordsImported} imported.`,
      );
      await load();
      await loadSyncHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Retry a previous sync job ──
  // Calls POST /api/gst/sync-2b/retry with the original job's id. The retry
  // route re-runs the sync with trigger='retry' and retryOf=<originalJobId>,
  // using the original job's period (the user does NOT re-supply it).
  const handleRetry = async (jobId: string) => {
    if (!orgId || !jobId) return;
    setActionLoading(`retry:${jobId}`);
    setSyncResult(null);
    try {
      const res = await fetch('/api/gst/sync-2b/retry', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ organizationId: orgId, jobId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (res.status === 409 && data.code === 'NOT_TESTED') {
          throw new Error('Provider not tested. Click "Test Connection" first to activate it.');
        }
        throw new Error(data.error ?? 'Retry failed.');
      }
      setSyncResult(data.summary);
      toast.success(
        `Retry complete (${data.summary.mode.toUpperCase()}) — ` +
        `${data.summary.recordsFetched} fetched, ` +
        `${data.summary.recordsImported} imported.`,
      );
      await load();
      await loadSyncHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Disconnect ──
  const handleDisconnect = async () => {
    if (!orgId) return;
    setActionLoading('disconnect');
    try {
      const res = await fetch('/api/gst/disconnect', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Disconnect failed.');
      }
      toast.success('GST provider disconnected.');
      setTestResult(null);
      setVerifyResult(null);
      setSyncResult(null);
      setShowConfig(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Disconnect failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Derived state ──
  const isConnected = !!status && status.mode !== 'not_connected';
  const isDemo = status?.mode === 'demo';
  const isLive = status?.mode === 'live';
  const isSandbox = status?.mode === 'sandbox';

  // Load sync history once the org is connected (or once we discover that
  // jobs exist for the org even if `mode` is somehow not_connected — defensive).
  useEffect(() => {
    if (isConnected) {
      void loadSyncHistory();
    }
  }, [isConnected, loadSyncHistory]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="GST / GSTN"
          subtitle="Connect a GSP to fetch live GSTR-2B, verify GSTINs, and reconcile purchase data."
        />
        <StatusSkeleton />
        <ConfigSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="GST / GSTN"
        subtitle="Connect a GSP to fetch live GSTR-2B, verify GSTINs, and reconcile purchase data."
      />

      {/* ── Mode banner — clear, mode-specific messaging ── */}
      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${modeBannerClass(status.mode)}`}
          role="status"
          aria-live="polite"
        >
          <span className="mt-0.5 shrink-0">{modeIcon(status.mode)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-5">
              {modeBannerText(status.mode)}
            </p>
            {status.tokenExpired && (
              <p className="mt-1 text-xs opacity-90">
                Token expired — please re-enter your credentials and re-test.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── 1. CONNECTION STATUS CARD ── */}
      {status && (
        <Card className="gst-card border-[#1F1F1F] bg-[#0A0A0A] p-0">
          <CardHeader className="flex flex-col gap-3 border-b border-[#1F1F1F] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/5">
                <ShieldCheck className="h-5 w-5 text-[#60A5FA]" />
              </div>
              <div>
                <CardTitle className="gst-card-title text-white">
                  Connection Status
                </CardTitle>
                <CardDescription className="gst-description mt-0.5 text-zinc-400">
                  The canonical state of your GST integration.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${modeBadgeClass(status.mode)}`}
              >
                {modeIcon(status.mode)}
                {status.modeLabel}
              </span>
              {/* Secondary connection-state badge — subtle, surfaces what the
                  backend's state machine currently says (e.g. "syncing",
                  "token_expired", "rate_limited"). Hidden when state is
                  not_connected (the mode badge already covers that case). */}
              {connectionStateBadge(status.connectionState)}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* Provider */}
              <div>
                <p className="gst-label mb-1">Provider</p>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-zinc-500" />
                  <p className="text-sm font-medium text-white">
                    {status.providerDisplayName || '—'}
                  </p>
                </div>
                <p className="gst-caption mt-1 text-zinc-500">
                  {status.providerName || 'No provider configured'}
                </p>
              </div>

              {/* GSTIN */}
              <div>
                <p className="gst-label mb-1">GSTIN</p>
                {status.gstin ? (
                  <p className="font-mono text-sm text-white">{status.gstin}</p>
                ) : (
                  <p className="text-sm text-zinc-500">Not set</p>
                )}
                {status.legalName && (
                  <p className="gst-caption mt-1 text-zinc-400">{status.legalName}</p>
                )}
                {status.tradeName && status.tradeName !== status.legalName && (
                  <p className="gst-caption text-zinc-500">t/a {status.tradeName}</p>
                )}
              </div>

              {/* Last test */}
              <div>
                <p className="gst-label mb-1">Last Test</p>
                <div className="flex items-center gap-2">
                  {status.lastTestOk === null ? (
                    <span className="gst-status gst-status-neutral">Never tested</span>
                  ) : status.lastTestOk ? (
                    <span className="gst-status gst-status-success">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </span>
                  ) : (
                    <span className="gst-status gst-status-danger">
                      <XCircle className="h-3 w-3" /> Failed
                    </span>
                  )}
                  <span className="gst-caption text-zinc-500">
                    {fmtRelative(status.lastTestedAt)}
                  </span>
                </div>
                {status.lastTestMessage && (
                  <p className="gst-caption mt-1 line-clamp-2 text-zinc-500">
                    {status.lastTestMessage}
                  </p>
                )}
              </div>

              {/* Last sync */}
              <div>
                <p className="gst-label mb-1">Last Sync</p>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-zinc-500" />
                  <p className="text-sm text-white">
                    {status.lastSyncAt ? fmtRelative(status.lastSyncAt) : 'Never synced'}
                  </p>
                </div>
                <p className="gst-caption mt-1 text-zinc-500">
                  {status.lastSyncAt ? fmtDate(status.lastSyncAt) : '—'}
                </p>
              </div>

              {/* Token expiry */}
              <div>
                <p className="gst-label mb-1">Token Expiry</p>
                {status.tokenExpiry ? (
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${status.tokenExpired ? 'text-red-400' : 'text-zinc-500'}`} />
                    <p className={`text-sm ${status.tokenExpired ? 'text-red-400' : 'text-white'}`}>
                      {fmtDate(status.tokenExpiry)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">N/A</p>
                )}
                {status.tokenExpired && (
                  <p className="gst-caption mt-1 text-red-400">Expired — reconnect required.</p>
                )}
              </div>

              {/* Config ID */}
              <div>
                <p className="gst-label mb-1">Config ID</p>
                {status.configId ? (
                  <p className="font-mono text-[12px] text-zinc-400 break-all">
                    {status.configId}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500">No config</p>
                )}
              </div>
            </div>

            {/* Reconfigure toggle (only when connected) */}
            {isConnected && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#1F1F1F] pt-4">
                <GhostButton onClick={() => setShowConfig((v) => !v)}>
                  {showConfig ? (
                    <>
                      <ChevronUp className="h-4 w-4" /> Hide Configuration
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" /> Reconfigure
                    </>
                  )}
                </GhostButton>
                <a
                  href="/?view=gst-reconciliation"
                  className="gst-btn gst-btn-ghost h-9 gap-2 text-zinc-400 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" /> Open Reconciliation
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 2. PROVIDER CONFIGURATION CARD ── */}
      {/* Show when (a) not connected, OR (b) user clicked Reconfigure */}
      {(!isConnected || showConfig) && (
        <SettingsCard
          title="Provider Configuration"
          description="Choose a GSP, set your credentials, and enter your GSTIN. Secrets are encrypted at rest."
          action={
            selectedProvider?.isLive ? (
              <span className="gst-status gst-status-success">
                <Zap className="h-3 w-3" /> Live provider
              </span>
            ) : selectedProvider ? (
              <span className="gst-status gst-status-neutral">
                <Sparkles className="h-3 w-3" /> Demo
              </span>
            ) : null
          }
        >
          <div className="space-y-5">
            {/* Provider picker */}
            <div className="space-y-2">
              <FieldLabel htmlFor="gst-provider-select">Provider</FieldLabel>
              <Select value={providerKey} onValueChange={setProviderKey}>
                <SelectTrigger
                  id="gst-provider-select"
                  className="h-9 w-full border-[#2A2A2A] bg-[#0A0A0A] text-white focus:border-[#2563EB]"
                >
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent className="max-h-80 border-[#2A2A2A] bg-[#0A0A0A]">
                  {providers.map((p) => (
                    <SelectItem
                      key={p.key}
                      value={p.key}
                      className="text-white focus:bg-[#181818] focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span>{p.displayName}</span>
                        {p.isLive ? (
                          <Badge className="gst-status gst-status-success !px-1.5 !py-0 text-[10px]">
                            LIVE
                          </Badge>
                        ) : (
                          <Badge className="gst-status gst-status-neutral !px-1.5 !py-0 text-[10px]">
                            DEMO
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProvider && (
                <p className="gst-caption text-zinc-500">{selectedProvider.description}</p>
              )}
            </div>

            {/* Environment toggle (segmented control) */}
            {selectedProvider?.isLive && (
              <div className="space-y-2">
                <FieldLabel>Environment</FieldLabel>
                <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-1">
                  <button
                    type="button"
                    onClick={() => setEnvMode('sandbox')}
                    className={`h-8 rounded-md px-4 text-[13px] font-medium transition-all ${
                      envMode === 'sandbox'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <FlaskConical className="mr-1.5 inline h-3.5 w-3.5" />
                    Sandbox
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvMode('production')}
                    className={`h-8 rounded-md px-4 text-[13px] font-medium transition-all ${
                      envMode === 'production'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Wifi className="mr-1.5 inline h-3.5 w-3.5" />
                    Production
                  </button>
                </div>
                <p className="gst-caption text-zinc-500">
                  {envMode === 'production'
                    ? 'Production — calls the real GSTN portal. Verify your credentials carefully.'
                    : 'Sandbox — calls the GSP test environment. Use for evaluation.'}
                </p>
              </div>
            )}

            {/* Dynamic fields */}
            {selectedProvider?.fields.map((f) => {
              const isPassword = f.type === 'password';
              const shown = !!showSecrets[f.key];
              return (
                <div key={f.key} className="space-y-2">
                  <FieldLabel htmlFor={`gst-field-${f.key}`}>
                    {f.label}
                    {f.required && <span className="ml-1 text-red-400">*</span>}
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id={`gst-field-${f.key}`}
                      type={isPassword && !shown ? 'password' : 'text'}
                      autoComplete="off"
                      value={fieldValues[f.key] ?? ''}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      className="h-9 rounded-md border-[#2A2A2A] bg-[#0A0A0A] pr-10 font-mono text-sm text-white placeholder:font-sans placeholder:text-zinc-600 focus:border-[#2563EB] focus-visible:ring-[#2563EB]/20"
                    />
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets((prev) => ({ ...prev, [f.key]: !prev[f.key] }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-200"
                        aria-label={shown ? 'Hide value' : 'Show value'}
                        tabIndex={-1}
                      >
                        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* API endpoint (for providers with defaults) */}
            {selectedProvider?.defaults && (
              <div className="space-y-2">
                <FieldLabel htmlFor="gst-api-endpoint">API Endpoint</FieldLabel>
                <FieldInput
                  id="gst-api-endpoint"
                  type="url"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.example.com"
                  className="font-mono text-[13px]"
                />
                <p className="gst-caption text-zinc-500">
                  Pre-filled from the provider default. Override only if your gateway uses a custom URL.
                </p>
              </div>
            )}

            {/* GSTIN */}
            <div className="space-y-2">
              <FieldLabel htmlFor="gst-gstin-input">
                GSTIN
                {selectedProvider?.isLive && <span className="ml-1 text-red-400">*</span>}
              </FieldLabel>
              <Input
                id="gst-gstin-input"
                value={gstinInput}
                onChange={(e) =>
                  setGstinInput(e.target.value.toUpperCase().slice(0, 15))
                }
                placeholder="27AAACR5058K1Z5"
                maxLength={15}
                className="h-9 rounded-md border-[#2A2A2A] bg-[#0A0A0A] font-mono text-sm uppercase text-white placeholder:normal-case placeholder:text-zinc-600 focus:border-[#2563EB] focus-visible:ring-[#2563EB]/20"
              />
              <p className="gst-caption text-zinc-500">
                15-character GST Identification Number.
              </p>
            </div>

            {/* Save + Cancel */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[#1F1F1F] pt-4">
              <PrimaryButton onClick={handleSave} loading={saving}>
                <Save className="h-4 w-4" />
                Save Configuration
              </PrimaryButton>
              {showConfig && (
                <GhostButton onClick={() => setShowConfig(false)}>
                  Cancel
                </GhostButton>
              )}
              <p className="gst-caption ml-auto text-zinc-500">
                Secrets are encrypted (AES-256-GCM) and never returned in API responses.
              </p>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ── 3. ACTIONS CARD (only when connected) ── */}
      {isConnected && (
        <SettingsCard
          title="Actions"
          description="Test the connection, verify your GSTIN, sync GSTR-2B, or disconnect."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Test Connection */}
            <div className="rounded-lg border border-[#1F1F1F] bg-[#0F1115] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Plug className="h-4 w-4 text-blue-400" /> Test Connection
                  </p>
                  <p className="gst-caption mt-1 text-zinc-500">
                    Authenticate with the GSP and confirm credentials are valid.
                  </p>
                </div>
                <PrimaryButton onClick={handleTest} loading={actionLoading === 'test'}>
                  Test
                </PrimaryButton>
              </div>
              {testResult && (
                <div className="mt-3 rounded-md border border-[#1F1F1F] bg-[#0A0A0A] p-3 text-xs">
                  <div className="flex items-center gap-2">
                    {testResult.ok ? (
                      <span className="gst-status gst-status-success">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </span>
                    ) : (
                      <span className="gst-status gst-status-danger">
                        <XCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                    {typeof testResult.latencyMs === 'number' && (
                      <span className="gst-caption text-zinc-500">{testResult.latencyMs}ms</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-zinc-400">{testResult.message}</p>
                </div>
              )}
            </div>

            {/* Verify GSTIN */}
            <div className="rounded-lg border border-[#1F1F1F] bg-[#0F1115] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="h-4 w-4 text-blue-400" /> Verify GSTIN
                  </p>
                  <p className="gst-caption mt-1 text-zinc-500">
                    Look up legal name, trade name, and status against GSTN.
                  </p>
                </div>
                <PrimaryButton onClick={handleVerify} loading={actionLoading === 'verify'}>
                  Verify
                </PrimaryButton>
              </div>
            </div>

            {/* Sync GSTR-2B */}
            <div className="rounded-lg border border-[#1F1F1F] bg-[#0F1115] p-4 sm:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <RefreshCw className="h-4 w-4 text-blue-400" /> Sync GSTR-2B
                  </p>
                  <p className="gst-caption mt-1 text-zinc-500">
                    Fetch the current month&apos;s GSTR-2B from {status?.providerDisplayName}.
                    {isDemo && ' Demo mode returns simulated sample data.'}
                  </p>
                </div>
                <PrimaryButton onClick={handleSync} loading={actionLoading === 'sync'}>
                  Sync Now
                </PrimaryButton>
              </div>
              {syncResult && (
                <div className="mt-3 rounded-md border border-[#1F1F1F] bg-[#0A0A0A] p-3 text-xs">
                  {/* Per-record outcome grid. "Changed" is hidden when it
                      equals recordsUpdated (the runner sets both to the same
                      value for backward compat — showing both would be
                      confusing). "Failed" is shown in red when > 0. */}
                  {(() => {
                    const updated = typeof syncResult.recordsUpdated === 'number'
                      ? syncResult.recordsUpdated
                      : (typeof syncResult.recordsChanged === 'number' ? syncResult.recordsChanged : 0);
                    const changed = typeof syncResult.recordsChanged === 'number' ? syncResult.recordsChanged : 0;
                    const skipped = typeof syncResult.recordsSkipped === 'number' ? syncResult.recordsSkipped : 0;
                    const failed = typeof syncResult.recordsFailed === 'number' ? syncResult.recordsFailed : 0;
                    const showChanged = typeof syncResult.recordsChanged === 'number' && changed !== updated;
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          <div>
                            <p className="gst-label">Fetched</p>
                            <p className="text-sm font-semibold text-white">{syncResult.recordsFetched}</p>
                          </div>
                          <div>
                            <p className="gst-label">Imported</p>
                            <p className="text-sm font-semibold text-white">{syncResult.recordsImported}</p>
                          </div>
                          <div>
                            <p className="gst-label">Updated</p>
                            <p className="text-sm font-semibold text-white">{updated}</p>
                          </div>
                          <div>
                            <p className="gst-label">Skipped</p>
                            <p className="text-sm font-semibold text-white">{skipped}</p>
                          </div>
                          <div>
                            <p className="gst-label">Failed</p>
                            <p className={`text-sm font-semibold ${failed > 0 ? 'text-red-400' : 'text-white'}`}>
                              {failed}
                            </p>
                          </div>
                          <div>
                            <p className="gst-label">Duration</p>
                            <p className="text-sm font-semibold text-white">{syncResult.durationMs}ms</p>
                          </div>
                        </div>
                        {showChanged && (
                          <div className="mt-2 flex items-center gap-2 border-t border-[#1F1F1F] pt-2">
                            <p className="gst-label">Changed (legacy)</p>
                            <p className="text-sm font-semibold text-zinc-300">{changed}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="mt-2 flex items-center gap-2 border-t border-[#1F1F1F] pt-2">
                    <span className={`gst-status ${
                      syncResult.mode === 'live' ? 'gst-status-success' :
                      syncResult.mode === 'sandbox' ? 'gst-status-warning' :
                      'gst-status-neutral'
                    }`}>
                      {syncResult.mode.toUpperCase()}
                    </span>
                    <span className="gst-caption text-zinc-500">{syncResult.provider}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Disconnect */}
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-300">
                <Power className="h-4 w-4" /> Disconnect Provider
              </p>
              <p className="gst-caption mt-1 text-zinc-400">
                Disables the config. You can reconnect later without re-entering credentials.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DangerButton disabled={actionLoading === 'disconnect'}>
                  <Power className="h-4 w-4" /> Disconnect
                </DangerButton>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-[#2A2A2A] bg-[#0A0A0A]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Disconnect GST provider?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    This will disable <strong className="text-zinc-200">{status?.providerDisplayName}</strong> for this organization. Live data fetches will stop and the reconciliation engine will fall back to demo mode. The configuration row is preserved so you can reconnect later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-[#2A2A2A] bg-transparent text-zinc-300 hover:bg-[#181818] hover:text-white">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDisconnect}
                    className="gst-btn gst-btn-danger border-0 text-white hover:bg-[#DC2626]"
                  >
                    {actionLoading === 'disconnect' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SettingsCard>
      )}

      {/* ── 4. SYNC HISTORY CARD ── */}
      {/* Shown when connected OR when sync jobs already exist (so a user who
          disconnects after syncing can still see the audit trail until they
          reconnect). */}
      {(isConnected || syncJobs.length > 0) && (
        <SettingsCard
          title="Sync History"
          description="Recent GSTR-2B sync jobs for this organization. Retry failed or partial runs."
          action={
            <GhostButton
              onClick={() => void loadSyncHistory()}
              loading={syncJobsLoading}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </GhostButton>
          }
        >
          {syncJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#181818]">
                <History className="h-5 w-5 text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400">
                No sync jobs yet. Click{' '}
                <span className="font-medium text-white">Sync Now</span> to fetch
                your first GSTR-2B.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border border-[#1F1F1F]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#0A0A0A]">
                  <tr className="border-b border-[#1F1F1F] text-zinc-500">
                    <th className="px-2 py-2 font-medium">Period</th>
                    <th className="px-2 py-2 font-medium">Provider</th>
                    <th className="px-2 py-2 font-medium">Mode</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 text-right font-medium">Fetched</th>
                    <th className="px-2 py-2 text-right font-medium">Imported</th>
                    <th className="px-2 py-2 text-right font-medium">Updated</th>
                    <th className="px-2 py-2 text-right font-medium">Skipped</th>
                    <th className="px-2 py-2 text-right font-medium">Failed</th>
                    <th className="px-2 py-2 text-right font-medium">Duration</th>
                    <th className="px-2 py-2 font-medium">Trigger</th>
                    <th className="px-2 py-2 font-medium">Started</th>
                    <th className="px-2 py-2 font-medium">{/* Retry */}</th>
                  </tr>
                </thead>
                <tbody>
                  {syncJobs.map((job) => {
                    const failed = job.recordsFailed ?? 0;
                    const canRetry = job.status === 'failed' || job.status === 'partial';
                    const retryLoading = actionLoading === `retry:${job.id}`;
                    return (
                      <tr
                        key={job.id}
                        className="border-b border-[#1F1F1F]/60 hover:bg-[#0F1115]/50"
                      >
                        <td className="px-2 py-2 font-mono text-zinc-300">{job.period}</td>
                        <td className="px-2 py-2 text-zinc-400">{job.providerKey}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase ${jobModeBadgeClass(job.mode)}`}>
                            {job.mode}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${jobStatusBadgeClass(job.status)}`}>
                            {job.status}
                          </span>
                          {job.status === 'running' && (
                            <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-[#A78BFA]" />
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-300">{job.recordsFetched}</td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-300">{job.recordsImported}</td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-300">{job.recordsUpdated ?? 0}</td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-400">{job.recordsSkipped ?? 0}</td>
                        <td className={`px-2 py-2 text-right font-mono ${failed > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                          {failed}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-zinc-400">
                          {job.durationMs != null ? `${job.durationMs}ms` : '—'}
                        </td>
                        <td className="px-2 py-2 text-zinc-400">{job.trigger}</td>
                        <td className="px-2 py-2 text-zinc-500">
                          {fmtRelative(job.startedAt ?? job.createdAt)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {canRetry && (
                            <GhostButton
                              onClick={() => void handleRetry(job.id)}
                              loading={retryLoading}
                              disabled={retryLoading}
                              className="h-7 gap-1 !px-2 text-[11px]"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </GhostButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {syncJobs.length > 0 && (
            <p className="gst-caption mt-3 text-zinc-500">
              Showing the {syncJobs.length} most recent{' '}
              {syncJobs.length === 1 ? 'job' : 'jobs'}. Click Refresh to reload.
            </p>
          )}
        </SettingsCard>
      )}

      {/* ── 5. GSTIN VERIFICATION RESULT CARD ── */}
      {verifyResult && (
        <SettingsCard
          title="GSTIN Verification Result"
          description="Lookup result from the configured provider."
          action={
            <span className={`gst-status ${
              verifyResult.source === 'live' ? 'gst-status-success' :
              verifyResult.source === 'sandbox' ? 'gst-status-warning' :
              'gst-status-neutral'
            }`}>
              <Activity className="h-3 w-3" />
              {verifyResult.source.toUpperCase()}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="gst-label mb-1">GSTIN</p>
              <p className="font-mono text-sm text-white">{verifyResult.gstin}</p>
            </div>
            <div>
              <p className="gst-label mb-1">Legal Name</p>
              <p className="text-sm text-white">
                {verifyResult.legalName || <span className="text-zinc-500">Not available</span>}
              </p>
            </div>
            <div>
              <p className="gst-label mb-1">Trade Name</p>
              <p className="text-sm text-white">
                {verifyResult.tradeName || <span className="text-zinc-500">Not available</span>}
              </p>
            </div>
            <div>
              <p className="gst-label mb-1">State Code</p>
              <p className="text-sm text-white">{verifyResult.stateCode || '—'}</p>
            </div>
            <div>
              <p className="gst-label mb-1">Status</p>
              <p className="text-sm text-white">{verifyResult.status || '—'}</p>
            </div>
            <div>
              <p className="gst-label mb-1">Valid</p>
              {verifyResult.valid ? (
                <span className="gst-status gst-status-success">
                  <CheckCircle2 className="h-3 w-3" /> Valid
                </span>
              ) : (
                <span className="gst-status gst-status-danger">
                  <XCircle className="h-3 w-3" /> Invalid
                </span>
              )}
            </div>
          </div>
          {verifyResult.message && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-[#1F1F1F] bg-[#0F1115] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-zinc-300">{verifyResult.message}</p>
            </div>
          )}
          {verifyResult.source === 'demo' && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <p className="text-xs text-blue-200">
                Connect a real GSP provider (e.g. MastersIndia) to verify legal name and status against GSTN.
              </p>
            </div>
          )}
        </SettingsCard>
      )}

      {/* ── Empty state (no org) ── */}
      {!status && !loading && (
        <Card className="gst-card border-[#1F1F1F] bg-[#0A0A0A] p-6">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#181818]">
              <ShieldAlert className="h-6 w-6 text-zinc-500" />
            </div>
            <p className="gst-card-title text-white">No organization selected</p>
            <p className="gst-description mt-1 text-zinc-400">
              Select an organization to manage its GST integration.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default GSTSection;
