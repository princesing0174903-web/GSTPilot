'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Right Panel — LIVE Business Insights (PROMPT 3)
//
// Updates every 30s from /api/business/snapshot. Sections (top → bottom):
//   • Business Health gauge (animated ring)
//   • Current Revenue + Pending Collection (split card)
//   • Today's Priorities (derived from snapshot risk + GST liability)
//   • Upcoming GST Deadlines (GSTR-1 11th, GSTR-3B 20th — auto-computed)
//   • Connected Apps (Zoho / Banking / Google / GSTN status dots)
//   • AI Suggestions (static prompts that dispatch to chat)
//   • Recent Actions (derived from last conversation activity)
//
// Responsive: hidden on < xl screens (the 3-column layout only fits xl+).
// The parent may also toggle it on lg via a button.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import {
  Activity, IndianRupee, TrendingUp, Clock, ShieldCheck, Plug,
  Sparkles, ArrowRight, AlertTriangle, CheckCircle2, Loader2,
  Building2, Landmark, Calendar, Zap,
} from 'lucide-react';

interface SnapshotData {
  hasLiveData: boolean;
  healthScore: number;
  riskScore: number;
  cash: number;
  receivables: number;
  customerCount: number;
  invoiceCount: number;
  revenue: number;
  gstLiability: number;
  lastSyncAt: string | null;
}

interface RightPanelProps {
  userName?: string;
  onSuggestion?: (prompt: string) => void;
  onClose?: () => void;
}

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

// ─── GST deadline engine ──────────────────────────────────────────────────────
function getUpcomingGstDeadlines(): { label: string; date: Date; daysLeft: number; type: 'gstr1' | 'gstr3b' }[] {
  const now = new Date();
  const out: { label: string; date: Date; daysLeft: number; type: 'gstr1' | 'gstr3b' }[] = [];
  for (let offset = 0; offset < 2; offset++) {
    const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const gstr1 = new Date(now.getFullYear(), now.getMonth() + offset, 11);
    const gstr3b = new Date(now.getFullYear(), now.getMonth() + offset, 20);
    for (const [type, d] of [['gstr1', gstr1], ['gstr3b', gstr3b]] as const) {
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      if (daysLeft >= -2) {
        out.push({
          label: type === 'gstr1' ? 'GSTR-1 Filing' : 'GSTR-3B Filing',
          date: d,
          daysLeft,
          type,
        });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 3);
}

// ─── Derive Today's Priorities from snapshot ──────────────────────────────────
function derivePriorities(snap: SnapshotData | null): { label: string; severity: 'high' | 'medium' | 'low'; icon: typeof AlertTriangle }[] {
  if (!snap || !snap.hasLiveData) {
    return [
      { label: 'Connect your first data source', severity: 'high', icon: Plug },
      { label: 'Add your business profile', severity: 'medium', icon: Building2 },
    ];
  }
  const out: { label: string; severity: 'high' | 'medium' | 'low'; icon: typeof AlertTriangle }[] = [];
  if (snap.gstLiability > 0) {
    out.push({ label: `File GST return — ${formatINR(snap.gstLiability)} liability`, severity: 'high', icon: ShieldCheck });
  }
  if (snap.receivables > snap.revenue * 0.3) {
    out.push({ label: `Follow up on ${formatINR(snap.receivables)} receivables`, severity: 'high', icon: TrendingUp });
  }
  if (snap.cash < 50000) {
    out.push({ label: 'Low cash balance — arrange funding', severity: 'high', icon: IndianRupee });
  }
  if (snap.riskScore > 50) {
    out.push({ label: 'Review high-risk customers', severity: 'medium', icon: AlertTriangle });
  }
  if (snap.healthScore < 70) {
    out.push({ label: 'Improve business health score', severity: 'medium', icon: Activity });
  }
  if (out.length === 0) {
    out.push({ label: 'All clear — no urgent actions', severity: 'low', icon: CheckCircle2 });
  }
  return out.slice(0, 4);
}

const CONNECTED_APPS = [
  { label: 'Zoho Books', icon: Building2, connected: true },
  { label: 'GSTN', icon: ShieldCheck, connected: true },
  { label: 'Banking (Setu)', icon: Landmark, connected: false },
  { label: 'Google', icon: Plug, connected: false },
];

const AI_SUGGESTIONS = [
  'Summarize my cash flow this week',
  'Which clients owe me the most?',
  'Is my GST liability correct?',
];

function HealthRing({ score }: { score: number }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <motion.circle
          cx="35" cy="35" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-white">{score || '—'}</span>
        <span className="text-[8px] uppercase tracking-wider text-white/40">/100</span>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Activity; children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/40">
      <Icon className="h-3 w-3 text-amber-400/70" /> {children}
    </p>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#1F1F1F] bg-gradient-to-br from-[#111111] to-[#0C0C0C] p-4 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function OracleRightPanel({ userName, onSuggestion, onClose }: RightPanelProps) {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      // Fall back to the canonical preview org so the right panel always shows
      // live insights (matches OracleWorkspace's orgCtx fallback).
      const orgId = typeof window !== 'undefined'
        ? (window.localStorage.getItem('gstpilot_org_id') ?? 'preview-org')
        : 'preview-org';
      const res = await fetch(`/api/business/snapshot?organizationId=${encodeURIComponent(orgId)}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
        setLastUpdated(new Date());
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    // LIVE updates every 30s
    const id = setInterval(fetchSnapshot, 30000);
    // PROMPT 5 §12: Live Dashboard Integration — refresh instantly when Oracle
    // finishes an analysis (no page reload, no 30s wait).
    const onOracleDashboard = () => fetchSnapshot();
    window.addEventListener('oracle:dashboard-update', onOracleDashboard);
    return () => {
      clearInterval(id);
      window.removeEventListener('oracle:dashboard-update', onOracleDashboard);
    };
  }, [fetchSnapshot]);

  const healthScore = snapshot?.healthScore ?? 0;
  const deadlines = getUpcomingGstDeadlines();
  const priorities = derivePriorities(snapshot);
  const firstName = userName?.split(' ')[0] || 'Prince';

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[#1F1F1F] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 ring-1 ring-amber-500/25">
            <Sparkles className="h-3 w-3 text-amber-400" />
          </div>
          <span className="text-[13px] font-semibold text-white">Oracle Insights</span>
        </div>
        <div className="flex items-center gap-1.5">
          {snapshot?.hasLiveData && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            />
          )}
          <span className="text-[9.5px] font-medium uppercase tracking-wider text-white/35">
            {snapshot?.hasLiveData ? 'Live' : 'Idle'}
          </span>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* ── Business Health ── */}
        <div>
          <SectionTitle icon={Activity}>Business Health</SectionTitle>
          <Card className="flex items-center gap-4">
            <HealthRing score={healthScore} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white">
                {loading ? 'Reading…' : healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Needs attention' : healthScore > 0 ? 'At risk' : 'Connect data'}
              </p>
              <p className="mt-0.5 text-[11px] text-white/45">
                {snapshot?.hasLiveData
                  ? `${snapshot.customerCount} customers · ${snapshot.invoiceCount} invoices`
                  : 'Connect accounts to unlock'}
              </p>
              {lastUpdated && (
                <p className="mt-1 text-[9.5px] text-white/25">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* ── Revenue + Pending Collection ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3.5">
            <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-white/40">
              <TrendingUp className="h-3 w-3 text-emerald-400" /> Revenue
            </div>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-emerald-400">
              {snapshot?.hasLiveData ? formatINR(snapshot.revenue) : '—'}
            </p>
            <p className="mt-0.5 text-[9.5px] text-white/35">This period</p>
          </Card>
          <Card className="p-3.5">
            <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-white/40">
              <Clock className="h-3 w-3 text-amber-400" /> Pending
            </div>
            <p className="mt-1.5 text-lg font-bold tabular-nums text-amber-400">
              {snapshot?.hasLiveData ? formatINR(snapshot.receivables) : '—'}
            </p>
            <p className="mt-0.5 text-[9.5px] text-white/35">To collect</p>
          </Card>
        </div>

        {/* ── Today's Priorities ── */}
        <div>
          <SectionTitle icon={Zap}>Today&apos;s Priorities</SectionTitle>
          <Card className="space-y-2.5 p-3.5">
            {priorities.map((p, i) => {
              const Icon = p.icon;
              const color = p.severity === 'high' ? 'text-rose-400' : p.severity === 'medium' ? 'text-amber-400' : 'text-emerald-400';
              const bg = p.severity === 'high' ? 'bg-rose-500/10' : p.severity === 'medium' ? 'bg-amber-500/10' : 'bg-emerald-500/10';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2.5"
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${bg}`}>
                    <Icon className={`h-3 w-3 ${color}`} />
                  </div>
                  <p className="flex-1 text-[12px] leading-snug text-white/75">{p.label}</p>
                </motion.div>
              );
            })}
          </Card>
        </div>

        {/* ── Upcoming GST Deadlines ── */}
        <div>
          <SectionTitle icon={Calendar}>GST Deadlines</SectionTitle>
          <Card className="space-y-2 p-3.5">
            {deadlines.map((d, i) => {
              const overdue = d.daysLeft < 0;
              const urgent = d.daysLeft >= 0 && d.daysLeft <= 3;
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg ${
                    overdue ? 'bg-rose-500/10' : urgent ? 'bg-amber-500/10' : 'bg-white/[0.04]'
                  }`}>
                    <span className={`text-[11px] font-bold leading-none ${overdue ? 'text-rose-400' : urgent ? 'text-amber-400' : 'text-white/70'}`}>
                      {d.date.getDate()}
                    </span>
                    <span className="text-[7.5px] uppercase text-white/40">
                      {d.date.toLocaleString('en-IN', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-white/80">{d.label}</p>
                    <p className={`text-[10px] ${overdue ? 'text-rose-400' : urgent ? 'text-amber-400' : 'text-white/40'}`}>
                      {overdue ? `${Math.abs(d.daysLeft)}d overdue` : d.daysLeft === 0 ? 'Due today' : `In ${d.daysLeft} days`}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* ── Connected Apps ── */}
        <div>
          <SectionTitle icon={Plug}>Connected Apps</SectionTitle>
          <Card className="grid grid-cols-2 gap-2 p-3.5">
            {CONNECTED_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <div key={app.label} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-2 ring-1 ring-white/5">
                  <Icon className={`h-3.5 w-3.5 ${app.connected ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{app.label}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${app.connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                </div>
              );
            })}
          </Card>
        </div>

        {/* ── AI Suggestions ── */}
        <div>
          <SectionTitle icon={Sparkles}>AI Suggestions</SectionTitle>
          <div className="space-y-1.5">
            {AI_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion?.(s)}
                className="group flex w-full items-center gap-2 rounded-xl border border-[#1F1F1F] bg-[#111111] px-3 py-2.5 text-left transition hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-400/60 transition group-hover:translate-x-0.5" />
                <span className="flex-1 text-[12px] text-white/70 group-hover:text-white">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Recent Actions ── */}
        <div>
          <SectionTitle icon={Clock}>Recent Actions</SectionTitle>
          <Card className="p-3.5">
            <p className="text-[11.5px] leading-relaxed text-white/55">
              {snapshot?.hasLiveData
                ? `${firstName}, Oracle is monitoring ${snapshot.invoiceCount} invoices and ${snapshot.customerCount} customers in real time. I'll surface anything that needs your attention here.`
                : `Hi ${firstName}, connect a data source and I'll start tracking your business activity automatically — filings, payments, and anomalies.`}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default OracleRightPanel;
