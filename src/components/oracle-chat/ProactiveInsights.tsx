'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Proactive Insights Panel & Recommended Actions
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  AlertTriangle, AlertCircle, TrendingUp, Info, Lightbulb,
  ArrowRight, Flame, ShieldAlert, Clock,
} from 'lucide-react';
import type { ProactiveInsight, RecommendedAction } from '@/lib/oracle-chat/types';

const SEVERITY_STYLE: Record<ProactiveInsight['severity'], { icon: typeof AlertTriangle; ring: string; bg: string; text: string; label: string }> = {
  critical: { icon: Flame, ring: 'ring-rose-400/30', bg: 'bg-rose-400/[0.08]', text: 'text-rose-300', label: 'Critical' },
  warning: { icon: AlertTriangle, ring: 'ring-amber-400/30', bg: 'bg-amber-400/[0.08]', text: 'text-amber-300', label: 'Warning' },
  positive: { icon: TrendingUp, ring: 'ring-emerald-400/30', bg: 'bg-emerald-400/[0.08]', text: 'text-emerald-300', label: 'Positive' },
  info: { icon: Info, ring: 'ring-sky-400/30', bg: 'bg-sky-400/[0.08]', text: 'text-sky-300', label: 'Info' },
};

export function ProactiveInsightsPanel({ insights }: { insights: ProactiveInsight[] }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="space-y-2">
      {insights.map((ins, i) => {
        const s = SEVERITY_STYLE[ins.severity];
        const Icon = s.icon;
        return (
          <motion.div
            key={ins.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-xl p-3 ring-1 ring-inset ${s.ring} ${s.bg}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-50">I noticed</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${s.text}`}>{s.label}</span>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-zinc-100">{ins.headline}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{ins.detail}</p>
                {ins.suggestedAction && (
                  <div className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-300">
                    <ArrowRight className={`h-3 w-3 ${s.text}`} />
                    <span>{ins.suggestedAction}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

const PRIORITY_STYLE: Record<RecommendedAction['priority'], { ring: string; bg: string; text: string; icon: typeof ShieldAlert }> = {
  critical: { ring: 'ring-rose-400/30', bg: 'bg-rose-400/[0.06]', text: 'text-rose-300', icon: Flame },
  high: { ring: 'ring-orange-400/30', bg: 'bg-orange-400/[0.06]', text: 'text-orange-300', icon: ShieldAlert },
  medium: { ring: 'ring-amber-400/30', bg: 'bg-amber-400/[0.06]', text: 'text-amber-300', icon: AlertCircle },
  low: { ring: 'ring-sky-400/30', bg: 'bg-sky-400/[0.06]', text: 'text-sky-300', icon: Clock },
};

export function RecommendedActions({ actions }: { actions: RecommendedAction[] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="space-y-2">
      {actions.map((a, i) => {
        const s = PRIORITY_STYLE[a.priority];
        const Icon = s.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex items-start gap-3 rounded-lg p-2.5 ring-1 ring-inset ${s.ring} ${s.bg}`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.text}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{a.priority}</span>
                <span className="text-sm font-semibold text-zinc-100">{a.title}</span>
              </div>
              {a.detail && a.detail !== a.title && (
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{a.detail}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Sidebar proactive insights (fetched on load) ─────────────────────────────

interface ProactiveData {
  generatedAt: string;
  insights: ProactiveInsight[];
  hasData: boolean;
}

export function ProactiveSidebar() {
  const [data, setData] = useState<ProactiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/oracle-chat/proactive', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as ProactiveData;
          if (!cancelled) setData(json);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Oracle Notices</h3>
        {data && data.insights.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-inset ring-amber-400/30">
            {data.insights.length}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03] ring-1 ring-white/5" />
          ))}
        </div>
      ) : data && data.insights.length > 0 ? (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          <ProactiveInsightsPanel insights={data.insights} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 ring-1 ring-emerald-400/20">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-zinc-300">All clear</p>
          <p className="text-xs text-zinc-500">
            {data?.hasData
              ? 'No critical business alerts right now.'
              : 'Add business data and Oracle will surface insights here.'}
          </p>
        </div>
      )}
    </div>
  );
}
