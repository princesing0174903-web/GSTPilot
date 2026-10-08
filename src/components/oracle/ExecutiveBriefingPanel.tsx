'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Executive Briefing Panel (collapsible, 8 sections)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders a collapsible "Today's Briefing" panel at the top of VEYRO AI view.
// When expanded, it fetches /api/oracle/executive-briefing?orgId=X and renders
// the 8 sections:
//   1. Today's Financial Status  — headline + revenue/cash/receivables/GST grid
//   2. Top 3 Risks               — red/amber/yellow cards
//   3. Top 3 Opportunities       — green cards
//   4. Collections to Chase      — customers with outstanding amounts
//   5. GST Actions               — pending/overdue returns + ITC at risk
//   6. Cash Flow Alerts          — runway/burn warnings
//   7. Important Customer Events — concentration + new customers
//   8. Pending Actions           — expired integrations + stale data
//
// Behavior:
//   - Collapsible (chevron toggle, default-collapsed on mobile, expanded on desktop).
//   - When collapsed, shows a small summary badge: "3 risks · 5 items to chase".
//   - Loading skeleton (pulsing gray bars) while fetching.
//   - Friendly error message + Retry button if fetch fails (401/403/500).
//   - Never crashes VEYRO AI view — all errors are caught + isolated.
//
// Each item card shows: title, detail, "Why it matters", "Recommended action",
// and an evidence badge if evidenceId is present.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus,
  IndianRupee, Wallet, Receipt, Users, Send, ShieldAlert, Clock, Zap,
  AlertCircle, type LucideIcon,
} from 'lucide-react';
import type {
  ExecutiveBriefing,
  BriefingSectionItem,
} from '@/lib/oracle/executive-briefing';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function pctStr(n: number | null): string {
  if (n === null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// Tone → card styling (mirrors the briefing's tone values)
const TONE_STYLES: Record<
  BriefingSectionItem['tone'],
  { border: string; bg: string; iconBg: string; iconColor: string; label: string }
> = {
  critical: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/[0.04]',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    label: 'Critical',
  },
  high: {
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/[0.04]',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    label: 'High',
  },
  medium: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/[0.04]',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    label: 'Medium',
  },
  low: {
    border: 'border-zinc-500/20',
    bg: 'bg-zinc-500/[0.03]',
    iconBg: 'bg-zinc-500/15',
    iconColor: 'text-zinc-400',
    label: 'Low',
  },
  positive: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/[0.04]',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    label: 'Opportunity',
  },
  info: {
    border: 'border-teal-500/25',
    bg: 'bg-teal-500/[0.03]',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    label: 'Info',
  },
};

// ─── Section metadata ─────────────────────────────────────────────────────────

interface SectionMeta {
  key: string;
  title: string;
  icon: LucideIcon;
  accent: string; // tailwind text color class
}

const SECTIONS: Array<SectionMeta & { items: (b: ExecutiveBriefing) => BriefingSectionItem[] }> = [
  {
    key: 'risks',
    title: 'Top Risks',
    icon: ShieldAlert,
    accent: 'text-rose-400',
    items: (b) => b.topRisks,
  },
  {
    key: 'opportunities',
    title: 'Opportunities',
    icon: TrendingUp,
    accent: 'text-emerald-400',
    items: (b) => b.topOpportunities,
  },
  {
    key: 'collections',
    title: 'Collections to Chase',
    icon: Send,
    accent: 'text-orange-400',
    items: (b) => b.collectionsToChase,
  },
  {
    key: 'gst',
    title: 'GST Actions',
    icon: Receipt,
    accent: 'text-amber-400',
    items: (b) => b.gstActions,
  },
  {
    key: 'cashflow',
    title: 'Cash Flow Alerts',
    icon: Wallet,
    accent: 'text-teal-400',
    items: (b) => b.cashFlowAlerts,
  },
  {
    key: 'customers',
    title: 'Customer Events',
    icon: Users,
    accent: 'text-violet-400',
    items: (b) => b.customerEvents,
  },
  {
    key: 'pending',
    title: 'Pending Actions',
    icon: Clock,
    accent: 'text-zinc-300',
    items: (b) => b.pendingActions,
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExecutiveBriefingPanelProps {
  orgId: string | null;
  /** Default expanded on desktop, collapsed on mobile. */
  defaultExpanded?: boolean;
  /** Navigation handler — passed to EvidenceCard for click-through. */
  onNavigate?: (view: string, entityId?: string) => void;
  /** Called when a CTA in the briefing is clicked (e.g. "Send Reminder"). */
  onAction?: (prompt: string) => void;
  className?: string;
  /** Async function returning auth headers for the current user. The briefing
   *  route uses requireAuth + requireOrgMembership — without these headers it
   *  returns HTTP 401 AUTH_REQUIRED. Built by OracleBrain from useAuth/useOrg. */
  getAuthHeaders?: () => Promise<Record<string, string>>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExecutiveBriefingPanel({
  orgId,
  defaultExpanded,
  onNavigate,
  onAction,
  className,
  getAuthHeaders,
}: ExecutiveBriefingPanelProps) {
  // Default: expanded on desktop (sm+), collapsed on mobile.
  const [expanded, setExpanded] = useState<boolean>(
    defaultExpanded ?? (typeof window !== 'undefined' ? window.innerWidth >= 768 : true),
  );
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (getAuthHeaders) {
        try {
          const authHeaders = await getAuthHeaders();
          Object.assign(headers, authHeaders);
        } catch (err) {
          console.warn('[executive-briefing] getAuthHeaders failed:', err);
        }
      }
      const res = await fetch(
        `/api/oracle/executive-briefing?orgId=${encodeURIComponent(orgId)}`,
        { headers },
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('You do not have access to this briefing.');
        }
        throw new Error(`Failed to load briefing (HTTP ${res.status}).`);
      }
      const data = await res.json();
      if (!data?.ok || !data?.briefing) {
        throw new Error('Malformed briefing response.');
      }
      setBriefing(data.briefing as ExecutiveBriefing);
    } catch (e: any) {
      setError(e?.message || 'We could not load your briefing right now.');
    } finally {
      setLoading(false);
    }
  }, [orgId, getAuthHeaders]);

  // Fetch when expanded AND orgId changes
  useEffect(() => {
    if (!expanded || !orgId) return;
    if (briefing && error === null) return; // already loaded
    fetchBriefing();
  }, [expanded, orgId, briefing, error, fetchBriefing]);

  // Summary line for the collapsed header
  const summary = useMemo(() => {
    if (!briefing) return null;
    const risks = briefing.topRisks.length;
    const chase = briefing.collectionsToChase.length;
    const pending = briefing.pendingActions.length;
    const parts: string[] = [];
    if (risks > 0) parts.push(`${risks} risk${risks === 1 ? '' : 's'}`);
    if (chase > 0) parts.push(`${chase} to chase`);
    if (pending > 0) parts.push(`${pending} pending action${pending === 1 ? '' : 's'}`);
    return parts.length > 0 ? parts.join(' · ') : 'No urgent items — all clear';
  }, [briefing]);

  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl border border-[#1F1F1F] bg-[#0A0A0A] overflow-hidden',
        className,
      )}
    >
      {/* ─── Header / Toggle ─── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#0F0F0F] transition-colors text-left"
      >
        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Today&apos;s Briefing</span>
            {briefing?.isDemoWorkspace && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                Demo
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
            {loading
              ? 'Loading your daily executive summary…'
              : error
                ? 'Could not load briefing.'
                : summary ?? 'Your daily executive summary.'}
          </div>
        </div>
        {!loading && !error && briefing && (
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            {briefing.topRisks.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 px-2 py-0.5 text-[10px] font-semibold">
                <ShieldAlert className="h-2.5 w-2.5" />
                {briefing.topRisks.length} risk{briefing.topRisks.length === 1 ? '' : 's'}
              </span>
            )}
            {briefing.collectionsToChase.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 px-2 py-0.5 text-[10px] font-semibold">
                <Send className="h-2.5 w-2.5" />
                {briefing.collectionsToChase.length} to chase
              </span>
            )}
          </div>
        )}
        <ChevronDown
          className={cn('h-4 w-4 text-zinc-500 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {/* ─── Collapsible Content ─── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-4 pb-4 pt-1 space-y-5 border-t border-[#1F1F1F]">
              {loading && <BriefingSkeleton />}
              {!loading && error && (
                <BriefingError message={error} onRetry={fetchBriefing} />
              )}
              {!loading && !error && briefing && (
                <BriefingContent
                  briefing={briefing}
                  onNavigate={onNavigate}
                  onAction={onAction}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ─── Briefing content (8 sections) ────────────────────────────────────────────

function BriefingContent({
  briefing,
  onNavigate,
  onAction,
}: {
  briefing: ExecutiveBriefing;
  onNavigate?: (view: string, entityId?: string) => void;
  onAction?: (prompt: string) => void;
}) {
  return (
    <>
      {/* Section 1: Today's Financial Status */}
      <FinancialStatusSection briefing={briefing} onNavigate={onNavigate} />

      {/* Sections 2–8: item lists */}
      {SECTIONS.map((section) => {
        const items = section.items(briefing);
        if (items.length === 0) return null;
        return (
          <BriefingSection
            key={section.key}
            title={section.title}
            icon={section.icon}
            accent={section.accent}
            items={items}
            onNavigate={onNavigate}
            onAction={onAction}
          />
        );
      })}

      {/* Anomalies (informational footer) */}
      {briefing.anomalies.length > 0 && (
        <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Statistical Anomalies Detected ({briefing.anomalies.length})
            </span>
          </div>
          <div className="space-y-1">
            {briefing.anomalies.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-[12px]">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider shrink-0',
                    a.severity === 'critical' && 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                    a.severity === 'high' && 'bg-orange-500/10 text-orange-400 border-orange-500/30',
                    a.severity === 'medium' && 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                    a.severity === 'low' && 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
                  )}
                >
                  {a.severity}
                </span>
                <span className="text-zinc-300 flex-1">{a.title}</span>
                {!a.hasSufficientData && (
                  <span className="text-[10px] text-zinc-600 shrink-0" title="Insufficient historical data — low confidence">
                    low data
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section 1: Financial Status ──────────────────────────────────────────────

function FinancialStatusSection({
  briefing,
  onNavigate,
}: {
  briefing: ExecutiveBriefing;
  onNavigate?: (view: string, entityId?: string) => void;
}) {
  const f = briefing.financialStatus;
  const trendIcon =
    f.revenueTrend === 'up' ? TrendingUp : f.revenueTrend === 'down' ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor =
    f.revenueTrend === 'up'
      ? 'text-emerald-400'
      : f.revenueTrend === 'down'
        ? 'text-rose-400'
        : 'text-zinc-400';

  const metrics: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    accent: string;
  }> = [
    { label: 'Revenue (FY)', value: formatINR(f.revenue), icon: TrendingUp, accent: 'text-emerald-400' },
    { label: 'Cash Position', value: formatINR(f.cash), icon: Wallet, accent: 'text-teal-400' },
    { label: 'Receivables', value: formatINR(f.receivables), icon: IndianRupee, accent: 'text-amber-400' },
    { label: 'GST Liability', value: formatINR(f.gstLiability), icon: Receipt, accent: 'text-rose-400' },
  ];

  return (
    <div className="space-y-3">
      {/* Headline */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Today&apos;s Financial Status
          </div>
          <div className="text-[13px] text-zinc-200 mt-0.5 leading-relaxed">
            {f.headline}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white tabular-nums">{f.healthScore}</span>
            <span className="text-[11px] text-zinc-500">/100</span>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              f.healthScore >= 65 && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              f.healthScore >= 50 && f.healthScore < 65 && 'bg-amber-500/10 text-amber-400 border-amber-500/30',
              f.healthScore < 50 && 'bg-rose-500/10 text-rose-400 border-rose-500/30',
            )}
          >
            {f.healthLabel}
          </span>
        </div>
      </div>

      {/* Revenue trend pill */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-zinc-500">Revenue MoM:</span>
        <span className={cn('inline-flex items-center gap-0.5 font-semibold', trendColor)}>
          <TrendIcon className="h-3 w-3" />
          {pctStr(f.revenueChangePct)}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500 capitalize">{f.revenueTrend}</span>
      </div>

      {/* 4-metric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={cn('h-3 w-3', m.accent)} />
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium truncate">
                  {m.label}
                </span>
              </div>
              <div className="text-sm font-semibold text-white tabular-nums">{m.value}</div>
            </div>
          );
        })}
      </div>

      {/* Optional evidence card for the financial status section */}
      {f.evidenceId && (
        <EvidenceLinkRow evidenceId={f.evidenceId} onNavigate={onNavigate} />
      )}
    </div>
  );
}

// ─── Generic briefing section (sections 2–8) ──────────────────────────────────

function BriefingSection({
  title,
  icon: Icon,
  accent,
  items,
  onNavigate,
  onAction,
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  items: BriefingSectionItem[];
  onNavigate?: (view: string, entityId?: string) => void;
  onAction?: (prompt: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', accent)} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </span>
        <span className="text-[10px] text-zinc-600">·</span>
        <span className="text-[10px] text-zinc-600">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <BriefingItemCard
            key={item.id}
            item={item}
            onNavigate={onNavigate}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Single item card ─────────────────────────────────────────────────────────

function BriefingItemCard({
  item,
  onNavigate,
  onAction,
}: {
  item: BriefingSectionItem;
  onNavigate?: (view: string, entityId?: string) => void;
  onAction?: (prompt: string) => void;
}) {
  const tone = TONE_STYLES[item.tone];

  // The "Send Reminder" CTA for collections items.
  const isChaseItem = item.id.startsWith('chase-');
  const chasePrompt = isChaseItem
    ? `Send a payment reminder to ${item.title}. Outstanding: ${item.amount ? formatINR(item.amount) : 'see invoice'}.`
    : null;

  return (
    <div className={cn('rounded-lg border p-3', tone.border, tone.bg)}>
      <div className="flex items-start gap-2">
        <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5', tone.iconBg)}>
          <span className={cn('text-[10px] font-bold uppercase', tone.iconColor)}>
            {tone.label.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[13px] font-semibold text-white leading-snug">
              {item.title}
            </div>
            {item.amount != null && item.amount !== 0 && (
              <span className="text-[12px] font-semibold text-zinc-200 tabular-nums shrink-0">
                {formatINR(item.amount)}
              </span>
            )}
          </div>
          {item.detail && (
            <div className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">
              {item.detail}
            </div>
          )}
          <div className="mt-1.5 space-y-1">
            <div className="text-[11px] text-zinc-500 leading-relaxed">
              <span className="text-zinc-600 font-medium">Why it matters:</span>{' '}
              {item.whyItMatters}
            </div>
            <div className="text-[11px] text-zinc-300 leading-relaxed">
              <span className="text-zinc-500 font-medium">Recommended:</span>{' '}
              {item.recommendedAction}
            </div>
          </div>
          {/* CTA row */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {item.actionView && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(item.actionView!.replace(/^\//, '').replace(/\?.*$/, '') || 'dashboard')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
              >
                View
              </button>
            )}
            {isChaseItem && chasePrompt && onAction && (
              <button
                type="button"
                onClick={() => onAction(chasePrompt)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                <Send className="h-3 w-3" />
                Send Reminder
              </button>
            )}
            {item.evidenceId && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/80 px-1.5 py-0.5 text-[9px] text-zinc-500 font-mono"
                title={`Evidence ID: ${item.evidenceId}`}
              >
                <Receipt className="h-2.5 w-2.5" />
                {item.evidenceId}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline evidence link row (used by FinancialStatusSection) ────────────────

function EvidenceLinkRow({
  evidenceId,
  onNavigate,
}: {
  evidenceId: string;
  onNavigate?: (view: string, entityId?: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
      <Receipt className="h-3 w-3" />
      <span className="font-mono">{evidenceId}</span>
      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate('invoices')}
          className="ml-auto text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          View source →
        </button>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BriefingSkeleton() {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32 bg-[#1F1F1F]" />
        <Skeleton className="h-4 w-full bg-[#1F1F1F]" />
        <Skeleton className="h-4 w-3/4 bg-[#1F1F1F]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full bg-[#1F1F1F]" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 bg-[#1F1F1F]" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16 w-full bg-[#1F1F1F]" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28 bg-[#1F1F1F]" />
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16 w-full bg-[#1F1F1F]" />
        ))}
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function BriefingError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.04] p-4 text-center">
      <div className="flex items-center justify-center mb-2">
        <div className="h-9 w-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-rose-400" />
        </div>
      </div>
      <div className="text-[13px] font-semibold text-white">Briefing unavailable</div>
      <div className="text-[12px] text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
        {message}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

export default ExecutiveBriefingPanel;
