'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-LANGUAGE PLATFORM™
//
// Internationalization hub for GSTPilot — 8 languages, RTL support, live preview.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with 8 Languages badge
//   • Language cards grid (8 languages) — flag, native name, code, RTL, coverage
//   • Live Preview panel — sample dashboard card translated in active language
//   • Language switcher — clickable cards set the active language
//   • Stats: total languages, avg coverage, RTL count
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Languages, Globe2, Sparkles, Type, ArrowLeft, ArrowRight,
  LayoutDashboard, DollarSign, ShieldCheck, MapPin, CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LANGUAGES, type Language } from '@/lib/global/data';

// ─── Mock Translation Map ──────────────────────────────────────────────────────

interface SampleCard {
  icon: LucideIcon;
  key: 'dashboard' | 'revenue' | 'compliance' | 'countries';
  value: string;
  accent: 'emerald' | 'teal' | 'cyan' | 'violet';
}

const SAMPLE_CARDS: SampleCard[] = [
  { icon: LayoutDashboard, key: 'dashboard', value: 'GSTPilot', accent: 'teal' },
  { icon: DollarSign, key: 'revenue', value: '$5.68M', accent: 'emerald' },
  { icon: ShieldCheck, key: 'compliance', value: '91%', accent: 'cyan' },
  { icon: MapPin, key: 'countries', value: '10', accent: 'violet' },
];

const TRANSLATIONS: Record<string, Record<SampleCard['key'], string>> = {
  en: {
    dashboard: 'Dashboard',
    revenue: 'Total Revenue',
    compliance: 'Compliance Score',
    countries: 'Active Countries',
  },
  hi: {
    dashboard: 'डैशबोर्ड',
    revenue: 'कुल राजस्व',
    compliance: 'अनुपालन स्कोर',
    countries: 'सक्रिय देश',
  },
  fr: {
    dashboard: 'Tableau de bord',
    revenue: 'Revenu Total',
    compliance: 'Score de Conformité',
    countries: 'Pays Actifs',
  },
  de: {
    dashboard: 'Übersicht',
    revenue: 'Gesamtumsatz',
    compliance: 'Compliance-Wert',
    countries: 'Aktive Länder',
  },
  es: {
    dashboard: 'Panel',
    revenue: 'Ingresos Totales',
    compliance: 'Puntuación de Cumplimiento',
    countries: 'Países Activos',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    revenue: 'إجمالي الإيرادات',
    compliance: 'نتيجة الامتثال',
    countries: 'الدول النشطة',
  },
  ja: {
    dashboard: 'ダッシュボード',
    revenue: '総収益',
    compliance: 'コンプライアンススコア',
    countries: '稼働国',
  },
  zh: {
    dashboard: '仪表板',
    revenue: '总收入',
    compliance: '合规评分',
    countries: '活跃国家',
  },
};

// ─── Style Maps ────────────────────────────────────────────────────────────────

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'violet' | 'amber', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
};

// ─── Language Card ─────────────────────────────────────────────────────────────

function LanguageCard({
  lang, active, onSelect, index,
}: {
  lang: Language;
  active: boolean;
  onSelect: () => void;
  index: number;
}) {
  const accentBar =
    lang.coverage >= 90 ? 'bg-emerald-500' :
    lang.coverage >= 80 ? 'bg-teal-400' :
    'bg-amber-400';

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={{ y: -2 }}
      className={`text-left rounded-xl border p-4 backdrop-blur-sm transition-all ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl leading-none">{lang.flag}</span>
          <div className="min-w-0">
            <div className="text-base font-semibold text-zinc-50 leading-tight truncate" dir={lang.rtl ? 'rtl' : 'ltr'}>
              {lang.nativeName}
            </div>
            <div className="text-[11px] text-zinc-400">{lang.name} · <span className="font-mono text-zinc-500">{lang.code}</span></div>
          </div>
        </div>
        {active && (
          <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shrink-0">
            <CheckCircle2 className="h-3 w-3" />Active
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {lang.rtl && (
          <Badge variant="outline" className="text-[9px] border-violet-500/30 bg-violet-500/10 text-violet-300">
            <ArrowLeft className="h-2.5 w-2.5" />RTL
          </Badge>
        )}
        <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          {lang.supported ? 'Supported' : 'Beta'}
        </Badge>
      </div>

      {/* coverage bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-zinc-500 uppercase tracking-wider">Coverage</span>
          <span className="text-zinc-200 font-medium tabular-nums">{lang.coverage}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${lang.coverage}%` }}
            transition={{ duration: 0.6, delay: index * 0.04, ease: 'easeOut' }}
            className={`h-full ${accentBar}`}
          />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ lang }: { lang: Language }) {
  const t = TRANSLATIONS[lang.code] ?? TRANSLATIONS.en;
  const dir = lang.rtl ? 'rtl' : 'ltr';
  const Arrow = lang.rtl ? ArrowLeft : ArrowRight;

  return (
    <motion.div
      key={lang.code}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
      dir={dir}
    >
      <div className="flex items-center justify-between gap-2 mb-4" dir={dir}>
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{lang.flag}</span>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500" dir="ltr">
              Live Preview · {lang.code.toUpperCase()}
            </div>
            <div className="text-sm font-semibold text-zinc-100">{lang.nativeName}</div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <Arrow className="h-3 w-3" />{lang.rtl ? 'RTL' : 'LTR'}
        </Badge>
      </div>

      {/* sample dashboard card */}
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4">
        <div className="flex items-center gap-2 mb-3" dir={dir}>
          <LayoutDashboard className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-100">{t.dashboard}</span>
        </div>
        <div className="grid grid-cols-2 gap-3" dir={dir}>
          {SAMPLE_CARDS.slice(1).map((c) => (
            <div key={c.key} className="rounded-lg bg-black/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${ACCENT_RING[c.accent]}`}>
                  <c.icon className="h-3 w-3" />
                </div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-500">{t[c.key]}</span>
              </div>
              <div className="text-lg font-bold text-zinc-50 tabular-nums">{c.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-zinc-400" dir={dir}>
        <Type className="h-3 w-3 text-emerald-400" />
        <span dir="ltr">
          Native rendering with {lang.coverage}% UI coverage · {lang.rtl ? 'right-to-left layout' : 'left-to-right layout'}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function MultiLanguagePlatform() {
  const [activeCode, setActiveCode] = useState<string>('en');
  const activeLang = useMemo(
    () => LANGUAGES.find((l) => l.code === activeCode) ?? LANGUAGES[0],
    [activeCode],
  );

  const stats = useMemo(() => {
    const total = LANGUAGES.length;
    const avgCoverage = Math.round(
      LANGUAGES.reduce((s, l) => s + l.coverage, 0) / total,
    );
    const rtlCount = LANGUAGES.filter((l) => l.rtl).length;
    return { total, avgCoverage, rtlCount };
  }, []);

  const STAT_TILES: {
    icon: LucideIcon;
    label: string;
    value: string;
    sub: string;
    accent: 'emerald' | 'teal' | 'cyan' | 'violet';
  }[] = [
    { icon: Languages, label: 'Total Languages', value: String(stats.total), sub: 'Live localizations', accent: 'teal' },
    { icon: Globe2, label: 'Avg Coverage', value: `${stats.avgCoverage}%`, sub: 'UI strings translated', accent: 'emerald' },
    { icon: ArrowLeft, label: 'RTL Languages', value: String(stats.rtlCount), sub: 'Right-to-left layouts', accent: 'violet' },
    { icon: Type, label: 'Active', value: activeLang.nativeName, sub: `${activeLang.code.toUpperCase()} · ${activeLang.coverage}%`, accent: 'cyan' },
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
          <Languages className="h-5 w-5 text-teal-400" />
          <h1 className="text-xl font-semibold text-zinc-50">
            Multi-Language Platform
            <sup className="text-[10px] text-teal-400 ml-0.5">™</sup>
          </h1>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
            <Sparkles className="h-3 w-3" />8 Languages
          </Badge>
        </div>
        <p className="mt-1.5 text-xs text-zinc-400 max-w-2xl">
          Full internationalization stack — 8 native languages with RTL support, real-time UI
          string coverage, and live translation preview across every GSTPilot surface.
        </p>
      </motion.div>

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
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${ACCENT_RING[s.accent]}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400">{s.label}</span>
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-50 truncate" title={s.value}>{s.value}</div>
            <div className="text-[10px] text-zinc-500 truncate">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Main grid: languages + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Languages */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-100">Supported Languages</h2>
              <span className="text-[10px] text-zinc-500">Click to preview →</span>
            </div>
            <Separator className="mb-4 bg-white/[0.06]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {LANGUAGES.map((l, i) => (
                  <LanguageCard
                    key={l.code}
                    lang={l}
                    active={l.code === activeCode}
                    onSelect={() => setActiveCode(l.code)}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-3">
            <LivePreview lang={activeLang} />
          </div>
        </div>
      </div>
    </div>
  );
}
