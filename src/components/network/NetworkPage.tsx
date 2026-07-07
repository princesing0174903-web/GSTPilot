'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Network Page (Obsidian Infinity™)
//
// A calm, premium "business network" view. The living graph of clients,
// partners, and connections that Oracle orchestrates.
//
//   • When the firm has no data yet → a beautiful, inviting empty state.
//   • When there is live data       → a calm 3-card status row + activity feed.
//   • Always                        → a quiet footer of "what the network does".
//
// No fake data. No clutter. Palantir-meets-Linear whitespace.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  Globe,
  Users,
  IndianRupee,
  HeartPulse,
  Activity,
  Sparkles,
  GitBranch,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import { useApp } from '@/contexts/AppContext';
import { useOracleStore } from '@/lib/oracle-store';
import {
  useLiveDashboardMetrics,
  useFireClients,
  useFireRecentActivities,
} from '@/hooks/use-firestore';

// ─── timeAgo helper ───────────────────────────────────────────────────────────
// Accepts Date | ISO string | Firestore Timestamp { toDate() }.
function timeAgo(createdAt: unknown): string {
  if (!createdAt) return 'just now';
  let date: Date;
  if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === 'string') {
    date = new Date(createdAt);
  } else if (
    typeof createdAt === 'object' &&
    createdAt !== null &&
    'toDate' in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === 'function'
  ) {
    date = (createdAt as { toDate: () => Date }).toDate();
  } else {
    return 'just now';
  }
  if (isNaN(date.getTime())) return 'just now';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ─── Status card (Clients / Tax Volume / Health) ──────────────────────────────
interface StatusCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  sublabel?: string;
}

function StatusCard({ icon: Icon, value, label, sublabel }: StatusCardProps) {
  return (
    <div className="glass-surface hover-lift rounded-[20px] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] accent-gradient-soft">
        <Icon className="h-5 w-5 text-[#00F5D4]" />
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
        {sublabel ? (
          <div className="mt-0.5 text-xs text-muted-foreground/70">{sublabel}</div>
        ) : null}
      </div>
    </div>
  );
}

// ─── "What the network does" footer card ──────────────────────────────────────
interface FooterCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function FooterCard({ icon: Icon, title, description }: FooterCardProps) {
  return (
    <div className="glass-surface hover-lift rounded-[20px] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] accent-gradient-soft">
        <Icon className="h-4 w-4 text-[#00F5D4]" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function NetworkPage() {
  const { setCurrentView } = useApp();
  const openWorkspace = useOracleStore((s) => s.openWorkspace);
  const { metrics, loading: metricsLoading } = useLiveDashboardMetrics();
  const { loading: clientsLoading } = useFireClients();
  const { data: activities } = useFireRecentActivities(5);

  const loading = metricsLoading || clientsLoading;
  const hasData = !loading && metrics.totalClients > 0;

  const taxVolumeDisplay =
    metrics.totalTaxVolume > 0
      ? `₹${(metrics.totalTaxVolume / 100000).toFixed(1)}L`
      : '—';
  const healthDisplay =
    metrics.averageHealthScore > 0
      ? `${metrics.averageHealthScore}/100`
      : '—';
  const recentActivities = activities.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Globe className="h-3.5 w-3.5 text-[#00F5D4]" />
          Network
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-[32px]">
          Your business network.
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Every client, partner, and connection — orchestrated by Oracle.
        </p>
      </motion.div>

      {/* ── Status section (when data exists) ────────────────────────────── */}
      {hasData ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const, delay: 0.05 }}
          className="mt-8 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatusCard
              icon={Users}
              value={String(metrics.totalClients)}
              label="Clients"
              sublabel={`${metrics.activeClients} active`}
            />
            <StatusCard
              icon={IndianRupee}
              value={taxVolumeDisplay}
              label="Tax Volume"
            />
            <StatusCard
              icon={HeartPulse}
              value={healthDisplay}
              label="Health"
            />
          </div>

          {/* Network activity */}
          <div className="glass-surface rounded-[20px] p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#00F5D4]" />
              <h2 className="text-sm font-semibold text-foreground">
                Network activity
              </h2>
            </div>
            <div className="mt-4 space-y-1">
              {recentActivities.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground/70">
                  No recent activity yet — your network is quiet.
                </div>
              ) : (
                recentActivities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00F5D4]" />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {a.title || 'Activity'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        /* ── Beautiful empty state hero ─────────────────────────────────── */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const, delay: 0.05 }}
          className="mt-8"
        >
          <div className="glass-surface relative overflow-hidden rounded-[28px] p-8 md:p-12">
            {/* Soft ambient mint glow inside */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.10]"
              style={{
                background:
                  'radial-gradient(circle, #00F5D4 0%, rgba(0,184,255,0.6) 50%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />

            <div className="relative flex flex-col items-center text-center">
              <div
                className="accent-gradient-soft flex h-[72px] w-[72px] items-center justify-center rounded-[20px]"
                style={{ boxShadow: '0 0 40px rgba(0,245,212,0.18)' }}
              >
                <InfinitySymbol size={36} />
              </div>

              <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                Your network is waiting.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Connect your client database and integrations to bring your
                business network alive. Oracle will map every relationship.
              </p>

              <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setCurrentView('clients')}
                  className="accent-gradient hover-lift inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black"
                >
                  <Users className="h-4 w-4" />
                  Import Clients
                </button>
                <button
                  type="button"
                  onClick={() => openWorkspace('Map my business network')}
                  className="glass-surface hover-lift inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-foreground"
                >
                  <Sparkles className="h-4 w-4 text-[#00F5D4]" />
                  Ask Oracle to map my network
                </button>
              </div>

              <div className="mt-7 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[#00F5D4]/70" />
                Your network grows smarter as you connect more data.
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── "What the network does" footer (always shown, calm) ──────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const, delay: 0.1 }}
        className="mt-8"
      >
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          What the network does
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FooterCard
            icon={GitBranch}
            title="Map relationships"
            description="Every client, vendor, and transaction connected."
          />
          <FooterCard
            icon={ShieldAlert}
            title="Detect risks"
            description="Oracle flags risky clients before they hurt you."
          />
          <FooterCard
            icon={TrendingUp}
            title="Find opportunities"
            description="Cross-sell, upsell, and recover collections."
          />
        </div>
      </motion.div>
    </div>
  );
}

export default NetworkPage;
