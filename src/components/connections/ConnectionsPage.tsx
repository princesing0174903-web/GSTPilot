'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Data Engine™ — Connections Page
// ═══════════════════════════════════════════════════════════════════════════════
//
// Manage all real data connections: GSTN, Bank, Gmail, WhatsApp, Tally/Zoho/QB.
// Each connector shows connection status, last sync, record count, and capabilities.
// Connect buttons trigger real OAuth flows (Gmail) or validation (GSTIN).
//
// Design: matches the existing GSTPilot premium design system (black bg, glass,
// blue→purple gradients). This is a NEW page — does not redesign any existing UI.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Landmark, Mail, MessageCircle, Calculator, BookOpen, Wallet,
  Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, ShieldCheck,
  Activity, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  CONNECTOR_DEFINITIONS,
  SUPPORTED_BANKS,
  type ConnectorType,
  type Connection,
} from '@/lib/connectors/types';

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  FileText, Landmark, Mail, MessageCircle, Calculator, BookOpen, Wallet,
};

// ─── Connection state from API ────────────────────────────────────────────────
interface ApiConnection {
  id: string;
  type: ConnectorType;
  status: string;
  label: string;
  identifier: string | null;
  metadata: Record<string, unknown>;
  lastSyncAt: string | null;
  syncInterval: string;
  errorMessage: string | null;
  recordCount: number;
  createdAt: string;
}

export default function ConnectionsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [activeConnector, setActiveConnector] = useState<ConnectorType | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/connectors?userId=${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections ?? []);
      }
    } catch (err) {
      console.warn('[Connections] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    try {
      await fetch(`/api/connectors/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.warn('[Connections] Delete error:', err);
    }
  };

  const handleSync = async (id: string, type: string) => {
    if (!user?.id) return;
    setSyncing(id);
    try {
      const body: Record<string, unknown> = {};
      // Gmail sync needs a fresh access token — trigger GIS flow
      if (type === 'gmail') {
        const token = await getGmailAccessToken();
        if (!token) {
          setSyncing(null);
          return;
        }
        body.accessToken = token;
      }
      await fetch(`/api/connectors/${id}/sync?userId=${encodeURIComponent(user.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await fetchConnections();
    } catch (err) {
      console.warn('[Connections] Sync error:', err);
    } finally {
      setSyncing(null);
    }
  };

  const connectedCount = connections.filter(c => c.status === 'connected').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8"
    >
      {/* ═══ HEADER ═══ */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Real Data Engine™
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          <span className="brand-text">Connections</span>
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Connect your real data sources. Oracle uses only connected data — no demo values, no mock values.
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-white/60">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            {connectedCount} active connection{connectedCount !== 1 ? 's' : ''}
          </span>
          <span className="text-white/40">
            {connections.length} total
          </span>
        </div>
      </div>

      {/* ═══ CONNECTOR GRID ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONNECTOR_DEFINITIONS.map((def, i) => {
          const Icon = ICON_MAP[def.icon] ?? FileText;
          const conn = connections.find(c => c.type === def.type);
          const isConnected = conn?.status === 'connected';

          return (
            <motion.div
              key={def.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04, duration: 0.4, ease: EASE }}
              className={cn(
                'group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300',
                isConnected
                  ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                  : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]',
              )}
            >
              {/* Status badge */}
              <div className="flex items-start justify-between">
                <span className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  isConnected
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-blue-300',
                )}>
                  <Icon className="h-5 w-5" />
                </span>
                {isConnected ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Not Connected
                  </span>
                )}
              </div>

              {/* Name + description */}
              <h3 className="mt-3 text-base font-semibold text-white">{def.name}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{def.description}</p>

              {/* Capabilities */}
              <div className="mt-3 flex flex-wrap gap-1">
                {def.capabilities.slice(0, 4).map(cap => (
                  <span key={cap} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/50">
                    {cap}
                  </span>
                ))}
                {def.capabilities.length > 4 && (
                  <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/40">
                    +{def.capabilities.length - 4}
                  </span>
                )}
              </div>

              {/* Connection details (if connected) */}
              {conn && (
                <div className="mt-3 border-t border-white/[0.05] pt-3">
                  <p className="text-xs font-medium text-white/70">{conn.label}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-white/40">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {conn.recordCount} records
                    </span>
                    <span>
                      {conn.lastSyncAt
                        ? `Synced ${timeAgo(conn.lastSyncAt)}`
                        : 'Never synced'}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => handleSync(conn!.id, conn!.type)}
                      disabled={syncing === conn!.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-medium text-white/70 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                    >
                      {syncing === conn!.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Sync
                    </button>
                    <button
                      onClick={() => handleDelete(conn!.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 transition-all hover:bg-red-500/10 hover:text-red-300"
                      aria-label="Disconnect"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setActiveConnector(def.type)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {def.connectLabel}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ═══ CONNECT MODAL ═══ */}
      {activeConnector && (
        <ConnectModal
          type={activeConnector}
          userId={user?.id}
          onClose={() => setActiveConnector(null)}
          onConnected={() => {
            setActiveConnector(null);
            fetchConnections();
          }}
        />
      )}

      {/* ═══ DATA QUALITY SUMMARY ═══ */}
      <DataQualitySection userId={user?.id} />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECT MODAL — handles each connector type's connection flow
// ═══════════════════════════════════════════════════════════════════════════════

function ConnectModal({
  type, userId, onClose, onConnected,
}: {
  type: ConnectorType;
  userId?: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const def = CONNECTOR_DEFINITIONS.find(d => d.type === type)!;
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GSTN state
  const [gstin, setGstin] = useState('');

  // Bank state
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  // WhatsApp state
  const [phone, setPhone] = useState('');

  // Accounting state
  const [companyName, setCompanyName] = useState('');
  const [companyGstin, setCompanyGstin] = useState('');

  const handleConnect = async () => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }
    setConnecting(true);
    setError(null);

    try {
      let endpoint = '';
      let body: Record<string, unknown> = { userId };

      if (type === 'gstn') {
        if (!gstin.trim()) { setError('GSTIN is required'); setConnecting(false); return; }
        endpoint = '/api/connect/gstn';
        body.gstin = gstin.trim();
      } else if (type === 'bank') {
        if (!bankCode) { setError('Select a bank'); setConnecting(false); return; }
        if (!accountNumber.trim()) { setError('Account number is required'); setConnecting(false); return; }
        endpoint = '/api/connect/bank';
        body.bankCode = bankCode;
        body.accountNumber = accountNumber.trim();
        body.ifsc = ifsc.trim();
      } else if (type === 'gmail') {
        // Gmail uses Google Identity Services for OAuth
        const accessToken = await getGmailAccessToken();
        if (!accessToken) {
          setError('Gmail authorization failed or was cancelled');
          setConnecting(false);
          return;
        }
        endpoint = '/api/connect/gmail';
        body.accessToken = accessToken;
      } else if (type === 'whatsapp') {
        if (!phone.trim()) { setError('Phone number is required'); setConnecting(false); return; }
        endpoint = '/api/connect/whatsapp';
        body.phoneNumber = phone.trim();
      } else if (type === 'tally' || type === 'zoho' || type === 'quickbooks') {
        if (!companyName.trim()) { setError('Company name is required'); setConnecting(false); return; }
        endpoint = '/api/connect/accounting';
        body.software = type;
        body.companyName = companyName.trim();
        body.companyGstin = companyGstin.trim();
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details?.join('; ') || 'Connection failed');
        setConnecting(false);
        return;
      }

      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnecting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0a0f] p-6 backdrop-blur-xl"
      >
        <h2 className="text-lg font-semibold text-white">{def.connectLabel}</h2>
        <p className="mt-1 text-xs text-white/50">{def.description}</p>

        <div className="mt-5 space-y-4">
          {type === 'gstn' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">GSTIN</label>
              <input
                value={gstin}
                onChange={e => setGstin(e.target.value)}
                placeholder="e.g. 27ABCDE1234F1Z5"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-white/35">
                15-character GSTIN. Validated with real checksum algorithm (state code + PAN + entity + Z + checksum).
              </p>
            </div>
          )}

          {type === 'bank' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">Bank</label>
                <select
                  value={bankCode}
                  onChange={e => setBankCode(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white focus:border-blue-500/40 focus:outline-none"
                >
                  <option value="">Select your bank</option>
                  {SUPPORTED_BANKS.map(b => (
                    <option key={b.code} value={b.code} className="bg-[#0a0a0f]">{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">Account Number</label>
                <input
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. 50100123456789"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">IFSC (optional)</label>
                <input
                  value={ifsc}
                  onChange={e => setIfsc(e.target.value)}
                  placeholder="e.g. HDFC0001234"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
                />
              </div>
            </>
          )}

          {type === 'gmail' && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.05] p-4">
              <p className="text-sm text-white/70">
                Click <strong className="text-white">Connect Gmail</strong> to open Google's secure OAuth consent screen.
                GSTPilot will read GST-related emails (notices, invoices, tax communications) with{' '}
                <code className="rounded bg-white/10 px-1 text-[11px]">gmail.readonly</code> scope.
              </p>
              <p className="mt-2 text-[11px] text-white/40">
                Your access token is used once for sync, then discarded. Only parsed email data is stored.
              </p>
            </div>
          )}

          {type === 'whatsapp' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">WhatsApp Business Phone Number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-white/35">
                Indian mobile number. Validated for 10-digit format starting with 6-9.
              </p>
            </div>
          )}

          {(type === 'tally' || type === 'zoho' || type === 'quickbooks') && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">Company Name</label>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Industries Pvt Ltd"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">Company GSTIN (optional)</label>
                <input
                  value={companyGstin}
                  onChange={e => setCompanyGstin(e.target.value)}
                  placeholder="e.g. 27ABCDE1234F1Z5"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg brand-gradient py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
            ) : (
              <><ShieldCheck className="h-4 w-4" /> Connect</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA QUALITY SECTION — shows auto-detected issues
// ═══════════════════════════════════════════════════════════════════════════════

function DataQualitySection({ userId }: { userId?: string }) {
  const [report, setReport] = useState<{ totalAlerts: number; critical: number; high: number; alerts: Array<{ title: string; severity: string; category: string }> } | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/data-quality?userId=${encodeURIComponent(userId)}`)
      .then(res => res.json())
      .then(data => setReport(data))
      .catch(() => {});
  }, [userId]);

  if (!report) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4, ease: EASE }}
      className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">
            <span className="brand-text">Data Quality Engine™</span>
          </h2>
          <p className="text-xs text-white/40">Auto-detected issues across your connected data</p>
        </div>
      </div>

      {report.totalAlerts === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-300/80">All data quality checks passed. No issues detected.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-3">
            <div className="flex-1 rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3 text-center">
              <p className="text-2xl font-semibold text-red-300">{report.critical}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-red-300/60">Critical</p>
            </div>
            <div className="flex-1 rounded-lg border border-orange-500/15 bg-orange-500/[0.04] p-3 text-center">
              <p className="text-2xl font-semibold text-orange-300">{report.high}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-orange-300/60">High</p>
            </div>
            <div className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-2xl font-semibold text-white">{report.totalAlerts}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Total</p>
            </div>
          </div>
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {report.alerts.slice(0, 8).map((alert, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] p-2.5">
                <span className={cn(
                  'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                  alert.severity === 'critical' && 'bg-red-400',
                  alert.severity === 'high' && 'bg-orange-400',
                  alert.severity === 'medium' && 'bg-amber-400',
                  alert.severity === 'low' && 'bg-white/30',
                )} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">{alert.title}</p>
                  <p className="text-[10px] text-white/35">{alert.category}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GMAIL OAUTH — Google Identity Services (GIS) token client
// ═══════════════════════════════════════════════════════════════════════════════

let googleClient: { requestAccessToken: (config: { callback: (resp: { access_token?: string }) => void }) => void } | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as unknown as { google?: unknown }).google) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

async function getGmailAccessToken(): Promise<string | null> {
  try {
    await loadGoogleIdentityServices();
    const google = (window as unknown as { google?: { accounts?: { oauth2?: { initTokenClient: (config: unknown) => { requestAccessToken: (c: unknown) => void } } } } }).google;
    if (!google?.accounts?.oauth2) return null;

    // Use the Firebase project's OAuth client ID (public, safe for frontend)
    const clientId = '44040248808-466c38a29dd3f7a8dd185d.apps.googleusercontent.com';

    return new Promise<string | null>((resolve) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: (response: { access_token?: string }) => {
          resolve(response.access_token ?? null);
        },
      });
      client.requestAccessToken({});
    });
  } catch (err) {
    console.warn('[Gmail] OAuth error:', err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN');
}
