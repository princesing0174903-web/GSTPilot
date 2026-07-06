'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: AI GLOBAL ADVISOR™ (ORACLE™ FOR INTL FINANCE)
//
// The Oracle for international finance — multi-jurisdiction tax, currency, compliance,
// cross-border & regulatory insights with an Ask-Oracle conversational interface.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with Oracle™ branded badge
//   • Ask Oracle panel — chat input with 3 canned suggested questions
//   • Summary stats — total insights, high impact, total potential savings
//   • Category filter — All / Tax / Currency / Compliance / Cross-Border / Regulation
//   • Insight cards — category, impact, recommendation, potential saving highlighted
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, Sparkles, Send, Lightbulb, TrendingUp, ShieldCheck,
  Coins, Globe2, Scale, ArrowRight, Zap, Target, type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AI_ADVISOR_INSIGHTS, getCountry, type AIAdvisorInsight, type CountryCode,
} from '@/lib/global/data';

// ─── Category Style Maps ───────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<AIAdvisorInsight['category'], {
  badge: string;
  ring: string;
  icon: LucideIcon;
}> = {
  Tax: {
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    ring: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    icon: Scale,
  },
  Currency: {
    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    ring: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    icon: Coins,
  },
  Compliance: {
    badge: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    ring: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
    icon: ShieldCheck,
  },
  'Cross-Border': {
    badge: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    ring: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
    icon: Globe2,
  },
  Regulation: {
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    ring: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    icon: Scale,
  },
};

const IMPACT_STYLE: Record<AIAdvisorInsight['impact'], string> = {
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};

const IMPACT_DOT: Record<AIAdvisorInsight['impact'], string> = {
  high: 'bg-rose-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};

const CATEGORY_TABS = ['All', 'Tax', 'Currency', 'Compliance', 'Cross-Border', 'Regulation'] as const;
type CategoryTab = typeof CATEGORY_TABS[number];

// ─── Saving Parser ─────────────────────────────────────────────────────────────

interface ParsedSaving {
  amount: number; // USD normalized
  raw: string;
  monetary: boolean;
}

function parseSaving(raw: string): ParsedSaving {
  // Match patterns like $240K, $38K, £78K, €50K, $62K/qtr
  const m = raw.match(/[$£€¥]\s*([\d.]+)\s*([KMB]?)/i);
  if (!m) return { amount: 0, raw, monetary: false };
  const num = parseFloat(m[1]);
  const mult = m[2].toUpperCase();
  const factor = mult === 'K' ? 1000 : mult === 'M' ? 1000000 : mult === 'B' ? 1000000000 : 1;
  // Approximate currency conversion to USD (only USD counted at face; others approximated)
  const sym = m[0].trim()[0];
  const rate = sym === '£' ? 1.27 : sym === '€' ? 1.08 : sym === '¥' ? 0.0067 : 1;
  return { amount: num * factor * rate, raw, monetary: true };
}

// ─── Canned Oracle Q&A ─────────────────────────────────────────────────────────

interface OracleQA {
  question: string;
  answer: string;
  tags: string[];
}

const ORACLE_QAS: OracleQA[] = [
  {
    question: 'What are the VAT implications of selling to Germany?',
    answer:
      'B2C sales to Germany from outside the EU trigger EU VAT OSS registration once cross-border EU sales exceed €10,000/year. After registration, collect VAT at the German standard rate (19%) and remit via the OSS portal quarterly. B2B sales to German VAT-registered customers use reverse-charge — no VAT charged, but capture the customer\'s VAT ID and report via the EC Sales List. GSTPilot™ auto-detects the threshold, registers you for OSS in your identification member state, and pre-fills the quarterly OSS return. Compliance with EU VAT OSS framework is currently in "compliant" status (next audit Oct 2024).',
    tags: ['VAT', 'EU', 'Germany', 'OSS'],
  },
  {
    question: 'How do I optimize cross-border taxes between India and Singapore?',
    answer:
      'Three levers available via the India-Singapore DTAA: (1) Royalty/FTS payments from India to Singapore are taxed at 10% (vs 20% standard) under Article 12 — restructure inter-company royalty to align with arm\'s length principle. (2) Capital gains are exempt under Article 6 — favorable for share transfers. (3) Route US→IN shipments via Singapore FTZ and apply CECA preferential tariff to save ~4.2% import duty. Combined annual savings: ~$240K in transfer pricing optimization + $62K/qtr in duty reduction. Action: file DTAA relief forms with Indian revenue authority and update transfer pricing documentation.',
    tags: ['DTAA', 'Transfer Pricing', 'Singapore', 'India'],
  },
  {
    question: 'What currency risks should I hedge this quarter?',
    answer:
      'Three FX exposures detected this quarter: (1) EUR/USD volatility on €80K Q4 receivables from DE + FR — enter a 6-month forward at 1.0850 to lock in $87K, saves $38K vs unhedged. (2) GBP receivables from UK entity — natural hedge exists if you have GBP payables; net exposure is minimal. (3) JPY exposure on inbound payment to Osaka Precision (¥14.2M / ~$95K) — JPY has appreciated 4% over 6 months, consider a 3-month forward contract. Total recommended hedged exposure: ~$182K across EUR + JPY. Estimated protective value: $38K + FX downside cap.',
    tags: ['FX', 'Hedging', 'EUR', 'JPY'],
  },
];

// ─── Insight Card ──────────────────────────────────────────────────────────────

function InsightCard({ insight, index }: { insight: AIAdvisorInsight; index: number }) {
  const cat = CATEGORY_STYLE[insight.category];
  const saving = parseSaving(insight.potentialSaving);
  const CatIcon = cat.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.14] transition-all flex flex-col"
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${cat.ring}`}>
            <CatIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 leading-tight">{insight.title}</h3>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${cat.badge}`}>{insight.category}</Badge>
              <Badge variant="outline" className={`text-[10px] capitalize ${IMPACT_STYLE[insight.impact]}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${IMPACT_DOT[insight.impact]}`} />
                {insight.impact} impact
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* countries */}
      <div className="mt-3 flex items-center gap-1 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">Countries</span>
        {insight.countries.map((cc) => {
          const c = getCountry(cc as CountryCode);
          return (
            <span key={cc} title={c?.name ?? cc} className="text-sm leading-none">
              {c?.flag ?? '🏳️'}
            </span>
          );
        })}
      </div>

      {/* description */}
      <p className="mt-3 text-[12px] text-zinc-300 leading-relaxed">{insight.description}</p>

      {/* recommendation */}
      <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-2.5">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-violet-300 mb-1">
          <Lightbulb className="h-3 w-3" />Oracle Recommendation
        </div>
        <p className="text-[11px] text-zinc-200 leading-relaxed">{insight.recommendation}</p>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* potential saving */}
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
          <Target className="h-3 w-3" />Potential Saving
        </span>
        <Badge
          variant="outline"
          className={`text-xs font-bold ${
            saving.monetary
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
          }`}
        >
          {insight.potentialSaving}
        </Badge>
      </div>
    </motion.div>
  );
}

// ─── Ask Oracle Panel ──────────────────────────────────────────────────────────

function AskOracle() {
  const [active, setActive] = useState<OracleQA | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] via-emerald-500/[0.02] to-transparent p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Ask Oracle</h2>
            <p className="text-[11px] text-zinc-400">AI Global Advisor for international finance</p>
          </div>
        </div>
        <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px]">
          <Sparkles className="h-3 w-3" />Oracle™
        </Badge>
      </div>

      {/* Chat input mock */}
      <div className="rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask about cross-border taxes, VAT, FX hedging…"
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
          readOnly
        />
        <Button size="sm" className="h-7 px-2.5 bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30" disabled>
          <Send className="h-3 w-3" />
        </Button>
      </div>

      {/* Suggested questions */}
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Suggested Questions</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ORACLE_QAS.map((qa, i) => (
            <motion.button
              key={qa.question}
              type="button"
              onClick={() => setActive(qa)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              whileHover={{ y: -1 }}
              className={`text-left rounded-lg border p-2.5 transition-all ${
                active?.question === qa.question
                  ? 'border-violet-500/40 bg-violet-500/[0.08]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-violet-500/30'
              }`}
            >
              <div className="flex items-start gap-1.5">
                <Zap className="h-3 w-3 text-violet-300 mt-0.5 shrink-0" />
                <span className="text-[11px] text-zinc-200 leading-snug">{qa.question}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Answer */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.question}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <BrainCircuit className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold text-emerald-300">Oracle Response</span>
                <div className="ml-auto flex items-center gap-1">
                  {active.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[9px] border-white/[0.08] bg-white/[0.02] text-zinc-400">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-[12px] text-zinc-200 leading-relaxed">{active.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AIGlobalAdvisor() {
  const [category, setCategory] = useState<CategoryTab>('All');

  const filtered = useMemo(
    () =>
      category === 'All'
        ? AI_ADVISOR_INSIGHTS
        : AI_ADVISOR_INSIGHTS.filter((i) => i.category === category),
    [category],
  );

  const stats = useMemo(() => {
    const total = AI_ADVISOR_INSIGHTS.length;
    const highImpact = AI_ADVISOR_INSIGHTS.filter((i) => i.impact === 'high').length;
    const totalSavings = AI_ADVISOR_INSIGHTS.reduce(
      (s, i) => s + parseSaving(i.potentialSaving).amount,
      0,
    );
    return { total, highImpact, totalSavings };
  }, []);

  const STAT_TILES: {
    icon: LucideIcon;
    label: string;
    value: string;
    sub: string;
    accent: 'emerald' | 'teal' | 'cyan' | 'violet';
  }[] = [
    { icon: Lightbulb, label: 'Total Insights', value: String(stats.total), sub: 'AI-generated', accent: 'teal' },
    { icon: Zap, label: 'High Impact', value: String(stats.highImpact), sub: 'Priority actions', accent: 'violet' },
    {
      icon: TrendingUp,
      label: 'Potential Savings',
      value: stats.totalSavings > 0 ? `$${(stats.totalSavings / 1000).toFixed(0)}K+` : '—',
      sub: 'Identified value',
      accent: 'emerald',
    },
    {
      icon: Target,
      label: 'Active Categories',
      value: String(new Set(AI_ADVISOR_INSIGHTS.map((i) => i.category)).size),
      sub: 'Risk domains',
      accent: 'cyan',
    },
  ];

  return (
    <div className="space-y-6">
      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-50">
            AI Global Advisor
            <sup className="text-[10px] text-violet-300 ml-0.5">™</sup>
          </h1>
          <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px]">
            <Sparkles className="h-3 w-3" />Oracle™
          </Badge>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-2xl">
          The Oracle for international finance — multi-jurisdiction tax optimization, currency
          hedging, compliance gap analysis & cross-border trade recommendations across 10 countries.
        </p>
      </motion.div>

      {/* Ask Oracle */}
      <AskOracle />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_TILES.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                s.accent === 'emerald' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                s.accent === 'teal' ? 'text-teal-300 bg-teal-500/10 border-teal-500/20' :
                s.accent === 'cyan' ? 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' :
                'text-violet-300 bg-violet-500/10 border-violet-500/20'
              }`}>
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">{s.label}</span>
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-50 tabular-nums">{s.value}</div>
            <div className="text-[10px] text-zinc-500">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setCategory(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all flex items-center gap-1.5 ${
              category === t
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.14]'
            }`}
          >
            {t}
            <span className="text-[10px] text-zinc-500">
              {t === 'All'
                ? AI_ADVISOR_INSIGHTS.length
                : AI_ADVISOR_INSIGHTS.filter((i) => i.category === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Insights grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
