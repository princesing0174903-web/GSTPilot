'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — ZohoDisconnected
// ═══════════════════════════════════════════════════════════════════════════════
//
// Premium centered connection screen shown when `status.connected === false`.
//
// RULE 2 of the redesign spec — this is the ONLY content rendered in
// disconnected mode:
//   • Centered hero card (max-w-2xl, mx-auto, vertically centered in main)
//   • Stylized Zoho "Z" tile in a red-tinted gradient square (Zoho brand = red)
//   • H1 + subtitle
//   • 4 feature bullets with icons
//   • Primary CTA "Connect Zoho Books" (calls connect())
//   • Secondary "Learn more" link
//   • Lock-icon trust badge
//   • Subtle radial-gradient background + faint Zoho watermark
//
// NO KPIs, NO modules, NO sync history, NO Oracle insights, NO latest records.
// One source of truth: connected === false → ONLY this screen.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from 'react';
import {
  RefreshCw,
  Lock,
  ArrowRight,
  ArrowLeftRight,
  ReceiptText,
  Activity,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FeatureBullet {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: FeatureBullet[] = [
  {
    icon: ArrowLeftRight,
    title: 'Two-way sync',
    body: 'Push and pull invoices, customers, bills, and payments without leaving GSTPilot.',
  },
  {
    icon: ReceiptText,
    title: 'Auto GST reconciliation',
    body: 'Match Zoho invoices against GSTR-2B in real time. Surface mismatches instantly.',
  },
  {
    icon: Activity,
    title: 'Real-time cash flow',
    body: 'Live bank feeds + receivables + payables rolled into one cash-flow pulse.',
  },
  {
    icon: Sparkles,
    title: 'Oracle AI insights',
    body: 'Predictive collection reminders, cash-runway forecasts, and anomaly alerts.',
  },
];

export function ZohoDisconnected({
  connect,
  requiresReconnect = false,
  reason = null,
  lastConnectedAt = null,
  organizationName = null,
}: {
  connect: () => Promise<{
    authUrl: string | null;
    error: string | null;
    notConfigured?: boolean;
    requiredEnvVars?: string[];
  }>;
  /** True when a token row exists but the server can't use it (secret missing/rotated). */
  requiresReconnect?: boolean;
  /** Human-readable reason for the disconnected state (from /status). */
  reason?: string | null;
  /** ISO timestamp of the last successful connection (for the reconnect prompt). */
  lastConnectedAt?: string | null;
  /** Zoho Books organization name (shown in the reconnect prompt if known). */
  organizationName?: string | null;
}) {
  const [connecting, setConnecting] = useState(false);
  // Don't pre-populate from status — the status reason is shown in the
  // dedicated banner above. This state is only set when the user ACTUALLY
  // clicks Connect and the server returns ZOHO_NOT_CONFIGURED, so the user
  // gets immediate feedback after the click (not on page load).
  const [notConfigured, setNotConfigured] = useState(false);
  const [requiredEnvVars, setRequiredEnvVars] = useState<string[] | undefined>();

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setNotConfigured(false);
    try {
      const { authUrl, error, notConfigured: nc, requiredEnvVars: vars } = await connect();
      if (nc) {
        // Honest "configuration required" state — the server has no Zoho OAuth
        // credentials. Show exactly what's needed instead of a misleading error.
        setNotConfigured(true);
        setRequiredEnvVars(vars);
        toast.error('Zoho Books is not configured', {
          description: 'An administrator must add the Zoho OAuth credentials before you can connect.',
        });
        return;
      }
      if (error) {
        toast.error("We couldn't start the Zoho connection", {
          description: error,
        });
        return;
      }
      if (authUrl) {
        // Hand off to Zoho's OAuth screen. The callback redirects back here.
        window.location.href = authUrl;
      } else {
        toast.error('Zoho did not return an authorization URL. Please try again.');
      }
    } catch {
      toast.error("We couldn't reach the Zoho connection service. Please try again.");
    } finally {
      setConnecting(false);
    }
  }, [connect]);

  return (
    <div
      className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-10"
      aria-labelledby="zoho-connect-title"
    >
      {/* ─── Premium background: radial gradient + faint Z watermark ─── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 35%, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.04) 35%, transparent 70%), radial-gradient(40% 30% at 50% 80%, rgba(200,32,47,0.06) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <span
          className="select-none text-[28rem] font-black leading-none text-white/[0.015]"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          Z
        </span>
      </div>

      {/* ─── Centered hero card ─── */}
      <div className="relative w-full max-w-2xl">
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/80 p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-10">
          {/* Brand tile */}
          <div className="flex flex-col items-center text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/[0.08]"
              style={{
                background:
                  'linear-gradient(135deg, #C8202F 0%, #9B1822 100%)',
              }}
            >
              <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
                <path
                  d="M9 22V20.4L17.2 11H9.4V9H20.4V10.6L12.2 20H20.4V22H9Z"
                  fill="white"
                />
              </svg>
            </div>

            <h1
              id="zoho-connect-title"
              className="mt-6 text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
            >
              {requiresReconnect ? 'Reconnect Zoho Books' : 'Connect Zoho Books'}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {requiresReconnect
                ? 'Your previous Zoho Books connection can no longer be used. Reconnect to resume syncing your financial data.'
                : 'Sync your customers, invoices, bills, payments, and taxes into GSTPilot&rsquo;s unified financial brain.'}
            </p>
          </div>

          {/* Reconnect / configuration reason banner — honest explanation of
              WHY the user is seeing the disconnected screen. Only shown when
              the /status endpoint provided a reason (token row exists but
              unusable, or credentials not configured). */}
          {(requiresReconnect || notConfigured) && reason ? (
            <div
              role="alert"
              className={`mt-6 rounded-xl border p-4 text-left ${
                notConfigured
                  ? 'border-amber-400/30 bg-amber-400/[0.06]'
                  : 'border-orange-400/30 bg-orange-400/[0.06]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  notConfigured ? 'bg-amber-400/15' : 'bg-orange-400/15'
                }`}>
                  <Settings className={`h-4 w-4 ${notConfigured ? 'text-amber-300' : 'text-orange-300'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${
                    notConfigured ? 'text-amber-200' : 'text-orange-200'
                  }`}>
                    {notConfigured ? 'Configuration required' : 'Reconnection required'}
                  </p>
                  <p className={`mt-1 text-xs leading-relaxed ${
                    notConfigured ? 'text-amber-200/80' : 'text-orange-200/80'
                  }`}>
                    {reason}
                  </p>
                  {lastConnectedAt ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Last connected: {new Date(lastConnectedAt).toLocaleString()}
                      {organizationName ? ` · ${organizationName}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Feature bullets */}
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12]"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/12">
                  <Icon className="h-4 w-4 text-[#60A5FA]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* CTA row */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={connecting}
              className="w-full sm:w-auto"
            >
              {connecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : null}
              {connecting ? 'Connecting…' : requiresReconnect ? 'Reconnect Zoho Books' : 'Connect Zoho Books'}
            </Button>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Learn more about Zoho integration
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Configuration-required notice — only when the server reports
              Zoho OAuth credentials are missing. Honest, actionable, never
              fakes a connection. */}
          {notConfigured ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
                  <Settings className="h-4 w-4 text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-200">
                    Configuration required
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                    Zoho Books OAuth credentials aren&rsquo;t set on this server.
                    An administrator needs to add the following environment
                    variables before you can connect:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {(requiredEnvVars ?? [
                      'ZOHO_CLIENT_ID',
                      'ZOHO_CLIENT_SECRET',
                      'ZOHO_DC',
                      'ZOHO_REDIRECT_URI',
                    ]).map((v) => (
                      <li
                        key={v}
                        className="flex items-center gap-2 font-mono text-[11px] text-amber-100/90"
                      >
                        <span className="h-1 w-1 rounded-full bg-amber-400" />
                        {v}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] leading-relaxed text-amber-200/60">
                    Create a self-client in the{' '}
                    <span className="font-medium">Zoho API Console</span>, add
                    the Books scope, and set the authorized redirect URI to this
                    app&rsquo;s callback. Then restart the server.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Trust badge */}
          <div className="mt-8 flex items-center justify-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] py-3 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-[#60A5FA]" />
            <span>
              Your data is encrypted end-to-end. GSTPilot never stores your Zoho
              password.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ZohoDisconnected;
