'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: MULTI-LANGUAGE PLATFORM™ (BILLION-DOLLAR GRADE)
//
// Internationalization hub for VEYRO — 8 languages, RTL support, live preview,
// translation management, QA dashboard, RTL preview, cultural adaptation guide &
// translator workflow. All values derived from @/lib/global/data. No API calls.
//
//   • Header with 8 Languages badge
//   • Language cards grid (8 languages) — flag, native name, code, RTL, coverage
//   • Live Preview panel — sample dashboard card translated in active language
//   • Translation Management table (TRANSLATION_QA) — selectable language column
//   • Localization QA Dashboard — coverage %, missing/review-needed counts
//   • RTL Preview Panel — mirrored layout when Arabic is active
//   • Cultural Adaptation Guide — date/number/currency/address format examples
//   • Translator Workflow — Kanban-style board with sample translation tasks
//   • Stats: total languages, avg coverage, RTL count
// ═══════════════════════════════════════════════════════════════════════════════

import { Fragment, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Languages, Globe2, Sparkles, Type, ArrowLeft, ArrowRight,
  LayoutDashboard, DollarSign, ShieldCheck, MapPin, CheckCircle2,
  type LucideIcon,
  Table2, ClipboardCheck, FlipHorizontal2, CalendarDays, Hash,
  Banknote, MapPinned, KanbanSquare, AlertCircle, Clock,
  Search, Filter, Edit3, MessageSquare,
  Database, Leaf, Users, Droplets, Recycle, HeartHandshake, Vote,
  ChevronDown, ChevronRight, Gavel, ThumbsUp,
  ThumbsDown, MinusCircle, Crown, Sun,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { LANGUAGES, TRANSLATION_QA, getCountry, type Language, type TranslationKey, type CountryCode } from '@/lib/global/data';
import {
  TRANSLATION_MEMORY, ESG_METRICS, BOARD_MEMBERS, BOARD_RESOLUTIONS,
  type ESGMetric, type BoardMember, type BoardResolution,
} from '@/lib/global/data-enterprise';

// ─── Mock Translation Map (for Live Preview) ──────────────────────────────────

interface SampleCard {
  icon: LucideIcon;
  key: 'dashboard' | 'revenue' | 'compliance' | 'countries';
  value: string;
  accent: 'emerald' | 'teal' | 'cyan' | 'violet';
}

// SAMPLE_CARDS — previously 4 cards with hardcoded mock KPI values
// ('$5.68M' revenue, '91%' compliance, '10' countries). Removed during
// mock-data audit (Task 7). Values now use neutral '—' placeholders so the
// translation preview still renders translated labels without showing
// fabricated KPIs. Replace with real KPIs from /api/business-snapshot.
const SAMPLE_CARDS: SampleCard[] = [
  { icon: LayoutDashboard, key: 'dashboard', value: 'VEYRO', accent: 'teal' },
  { icon: DollarSign, key: 'revenue', value: '—', accent: 'emerald' },
  { icon: ShieldCheck, key: 'compliance', value: '—', accent: 'cyan' },
  { icon: MapPin, key: 'countries', value: '—', accent: 'violet' },
];

const TRANSLATIONS: Record<string, Record<SampleCard['key'], string>> = {
  en: { dashboard: 'Dashboard', revenue: 'Total Revenue', compliance: 'Compliance Score', countries: 'Active Countries' },
  hi: { dashboard: 'डैशबोर्ड', revenue: 'कुल राजस्व', compliance: 'अनुपालन स्कोर', countries: 'सक्रिय देश' },
  fr: { dashboard: 'Tableau de bord', revenue: 'Revenu Total', compliance: 'Score de Conformité', countries: 'Pays Actifs' },
  de: { dashboard: 'Übersicht', revenue: 'Gesamtumsatz', compliance: 'Compliance-Wert', countries: 'Aktive Länder' },
  es: { dashboard: 'Panel', revenue: 'Ingresos Totales', compliance: 'Puntuación de Cumplimiento', countries: 'Países Activos' },
  ar: { dashboard: 'لوحة التحكم', revenue: 'إجمالي الإيرادات', compliance: 'نتيجة الامتثال', countries: 'الدول النشطة' },
  ja: { dashboard: 'ダッシュボード', revenue: '総収益', compliance: 'コンプライアンススコア', countries: '稼働国' },
  zh: { dashboard: '仪表板', revenue: '总收入', compliance: '合规评分', countries: '活跃国家' },
};

// ─── Style Maps ────────────────────────────────────────────────────────────────

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};

const TRANSLATION_STATUS_STYLE: Record<'translated' | 'review' | 'missing', { badge: string; dot: string; label: string }> = {
  translated: { badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400', label: 'Translated' },
  review: { badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400', label: 'Review' },
  missing: { badge: 'border-rose-500/30 bg-rose-500/10 text-rose-400', dot: 'bg-rose-400', label: 'Missing' },
};

// ─── Cultural Adaptation Guide data ────────────────────────────────────────────

interface CulturalRegion {
  code: string;
  region: string;
  flag: string;
  languages: string[];
  dateFormat: string;
  dateExample: string;
  numberFormat: string;
  numberExample: string;
  currencyFormat: string;
  currencyExample: string;
  firstDayOfWeek: string;
  addressFormat: string;
  addressExample: string;
}

const CULTURAL_REGIONS: CulturalRegion[] = [
  {
    code: 'IN', region: 'India', flag: '🇮🇳', languages: ['hi', 'en'],
    dateFormat: 'DD/MM/YYYY', dateExample: '03/10/2024',
    numberFormat: '##,##,###.## (lakh/crore)', numberExample: '12,34,567.89',
    currencyFormat: '₹ ##,##,###', currencyExample: '₹ 84,72,000',
    firstDayOfWeek: 'Sunday',
    addressFormat: 'Name → Premise → Street → Area → City → PIN → State',
    addressExample: 'A-203, Trade Tower, BKC, Bandra E, Mumbai 400051, MH',
  },
  {
    code: 'US', region: 'United States', flag: '🇺🇸', languages: ['en'],
    dateFormat: 'MM/DD/YYYY', dateExample: '10/03/2024',
    numberFormat: '#,###,###.##', numberExample: '1,234,567.89',
    currencyFormat: '$ #,###,###.##', currencyExample: '$1,240,000.00',
    firstDayOfWeek: 'Sunday',
    addressFormat: 'Name → Number Street → Suite → City, ST ZIP',
    addressExample: '300 Newark Ave, Suite 410, Newark, NJ 07102',
  },
  {
    code: 'EU', region: 'European Union', flag: '🇪🇺', languages: ['fr', 'de'],
    dateFormat: 'DD.MM.YYYY', dateExample: '03.10.2024',
    numberFormat: '#.###.##0,##', numberExample: '1.234.567,89',
    currencyFormat: '##.##0,00 €', currencyExample: '580.000,00 €',
    firstDayOfWeek: 'Monday',
    addressFormat: 'Name → Street Number → ZIP City → Country',
    addressExample: 'Frankfurter Str. 12, 60311 Frankfurt, DE',
  },
  {
    code: 'GB', region: 'United Kingdom', flag: '🇬🇧', languages: ['en'],
    dateFormat: 'DD/MM/YYYY', dateExample: '03/10/2024',
    numberFormat: '#,###,###.##', numberExample: '1,234,567.89',
    currencyFormat: '£ #,###,###.##', currencyExample: '£680,000.00',
    firstDayOfWeek: 'Monday',
    addressFormat: 'Name → Number Street → City → POSTCODE',
    addressExample: '27 London Bridge St, London SE1 9SG',
  },
  {
    code: 'AE', region: 'UAE (Arabic)', flag: '🇦🇪', languages: ['ar'],
    dateFormat: 'DD/MM/YYYY (Hijri optional)', dateExample: '٠٣/١٠/٢٠٢٤',
    numberFormat: '#,###,###.## (Arabic-Indic digits)', numberExample: '١٬٢٣٤٬٥٦٧٫٨٩',
    currencyFormat: 'د.إ ##,###', currencyExample: 'د.إ ١٬٨٠٬٠٠٠',
    firstDayOfWeek: 'Sunday',
    addressFormat: 'Name → Building → Street → Area → Emirate (RTL)',
    addressExample: 'مبنى ٣، شارع الشيخ زايد، دبي',
  },
  {
    code: 'JP', region: 'Japan', flag: '🇯🇵', languages: ['ja'],
    dateFormat: 'YYYY年MM月DD日 (和暦)', dateExample: '令和6年10月3日',
    numberFormat: '#,###,### (万/億 units)', numberExample: '123万4567',
    currencyFormat: '¥#,###', currencyExample: '¥98,000,000',
    firstDayOfWeek: 'Sunday',
    addressFormat: '〒ZIP → Prefecture → City → Street → Number (big-to-small)',
    addressExample: '〒100-0001 東京都千代田区千代田1-1',
  },
];

// ─── Translator Workflow (Kanban mock) ─────────────────────────────────────────

interface TranslationTask {
  id: string;
  key: string;
  source: string;
  targetLang: string;
  targetFlag: string;
  status: 'todo' | 'review' | 'approved';
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  wordCount: number;
}

const TRANSLATION_TASKS: TranslationTask[] = [
  { id: 't-1', key: 'reports.transferPricing', source: 'Transfer Pricing Report', targetLang: 'ar', targetFlag: '🇦🇪', status: 'todo', priority: 'high', assignee: 'Layla Hassan', wordCount: 24 },
  { id: 't-2', key: 'audit.trail', source: 'Audit Trail', targetLang: 'ja', targetFlag: '🇯🇵', status: 'todo', priority: 'medium', assignee: 'Yuki Tanaka', wordCount: 8 },
  { id: 't-3', key: 'compliance.gdpr', source: 'GDPR Data Protection Notice', targetLang: 'zh', targetFlag: '🇨🇳', status: 'todo', priority: 'high', assignee: 'Wei Chen', wordCount: 142 },
  { id: 't-4', key: 'nav.crossBorder', source: 'Cross-Border Payments', targetLang: 'ar', targetFlag: '🇦🇪', status: 'review', priority: 'medium', assignee: 'Layla Hassan', wordCount: 18 },
  { id: 't-5', key: 'invoices.export', source: 'Export Invoice Template', targetLang: 'de', targetFlag: '🇩🇪', status: 'review', priority: 'low', assignee: 'Markus Webb', wordCount: 64 },
  { id: 't-6', key: 'nav.compliance', source: 'Compliance', targetLang: 'ja', targetFlag: '🇯🇵', status: 'review', priority: 'medium', assignee: 'Yuki Tanaka', wordCount: 6 },
  { id: 't-7', key: 'nav.dashboard', source: 'Dashboard', targetLang: 'fr', targetFlag: '🇫🇷', status: 'approved', priority: 'low', assignee: 'Camille Dubois', wordCount: 4 },
  { id: 't-8', key: 'tax.vat', source: 'VAT Return Summary', targetLang: 'es', targetFlag: '🇪🇸', status: 'approved', priority: 'medium', assignee: 'Carlos Ruiz', wordCount: 22 },
  { id: 't-9', key: 'tax.gst', source: 'GST Filing', targetLang: 'hi', targetFlag: '🇮🇳', status: 'approved', priority: 'high', assignee: 'Priya Menon', wordCount: 12 },
];

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

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-zinc-500 uppercase tracking-wider">Coverage</span>
          <span className="text-zinc-200 font-medium tabular-nums">{lang.coverage}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${lang.coverage}%` }}
            transition={{ duration: 0.6, delay: index * 0.04, ease: 'easeOut' as const }}
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

// ─── RTL Preview Panel ─────────────────────────────────────────────────────────

function RTLPreviewPanel({ lang }: { lang: Language }) {
  const isRTL = lang.rtl;
  const t = TRANSLATIONS[lang.code] ?? TRANSLATIONS.en;
  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300">
            <FlipHorizontal2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">RTL / Directional Preview</h2>
            <p className="text-[11px] text-zinc-500">Layout adapts to {isRTL ? 'right-to-left' : 'left-to-right'} reading order</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] ${isRTL ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
          dir = {dir}
        </Badge>
      </div>

      {/* Mock UI in active direction */}
      <div
        className="rounded-lg border border-white/[0.08] bg-black/30 p-4"
        dir={dir}
      >
        {/* Mock nav row */}
        <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/[0.06]" dir={dir}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <LayoutDashboard className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-zinc-100">{t.dashboard}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">{lang.code.toUpperCase()}</Badge>
            <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">RTL</Badge>
          </div>
        </div>

        {/* Mock content */}
        <div className="space-y-2" dir={dir}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <DollarSign className="h-3 w-3 text-emerald-400" />
              {t.revenue}
            </span>
            <span className="text-zinc-100 font-semibold tabular-nums">$5.68M</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-cyan-400" />
              {t.compliance}
            </span>
            <span className="text-zinc-100 font-semibold tabular-nums">91%</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-violet-400" />
              {t.countries}
            </span>
            <span className="text-zinc-100 font-semibold tabular-nums">10</span>
          </div>
        </div>

        {/* Mock button row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]" dir={dir}>
          <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            <span>Submit</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] text-zinc-300 px-2.5 py-1 text-[10px]">
            <ArrowRight className="h-3 w-3" />
            <span>Next</span>
          </div>
          <div className="ml-auto text-[9px] text-zinc-500" dir="ltr">
            ← mirrored icon direction
          </div>
        </div>
      </div>

      {/* Adaptation checklist */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className={`flex items-center gap-1.5 rounded-md border p-1.5 ${isRTL ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300' : 'border-white/[0.06] bg-white/[0.02] text-zinc-500'}`}>
          <CheckCircle2 className="h-3 w-3" />
          <span>Text direction {isRTL ? 'flipped' : 'default'}</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-md border p-1.5 ${isRTL ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300' : 'border-white/[0.06] bg-white/[0.02] text-zinc-500'}`}>
          <CheckCircle2 className="h-3 w-3" />
          <span>Icon flow {isRTL ? 'reversed' : 'default'}</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-md border p-1.5 ${isRTL ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300' : 'border-white/[0.06] bg-white/[0.02] text-zinc-500'}`}>
          <CheckCircle2 className="h-3 w-3" />
          <span>Padding/margins {isRTL ? 'swapped' : 'default'}</span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-md border p-1.5 ${isRTL ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300' : 'border-white/[0.06] bg-white/[0.02] text-zinc-500'}`}>
          <CheckCircle2 className="h-3 w-3" />
          <span>Numbers stay LTR</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Translation Management Table ──────────────────────────────────────────────

function TranslationManagement() {
  const [selectedLang, setSelectedLang] = useState<string>('ar');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'translated' | 'review' | 'missing'>('all');

  const filtered = useMemo(() => {
    return TRANSLATION_QA.filter((k) => {
      if (search) {
        const q = search.toLowerCase();
        if (!k.key.toLowerCase().includes(q) && !k.english.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'all') {
        const st = k.status[selectedLang];
        if (!st || st !== statusFilter) return false;
      }
      return true;
    });
  }, [selectedLang, search, statusFilter]);

  const selectedLangObj = LANGUAGES.find((l) => l.code === selectedLang) ?? LANGUAGES[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <Table2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Translation Management</h2>
            <p className="text-[11px] text-zinc-500">
              {TRANSLATION_QA.length} keys · viewing {selectedLangObj.flag} {selectedLangObj.nativeName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search keys…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-8 pl-7 w-32"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-8 w-28">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/[0.08]">
              <SelectItem value="all" className="text-zinc-100 text-xs">All Status</SelectItem>
              <SelectItem value="translated" className="text-zinc-100 text-xs">Translated</SelectItem>
              <SelectItem value="review" className="text-zinc-100 text-xs">Review</SelectItem>
              <SelectItem value="missing" className="text-zinc-100 text-xs">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedLang} onValueChange={setSelectedLang}>
            <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/[0.08]">
              {LANGUAGES.filter((l) => l.code !== 'en').map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-zinc-100 text-xs">
                  {l.flag} {l.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <ScrollArea className="max-h-[440px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-40">Translation Key</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">English Source</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <div className="flex items-center gap-1">
                    <span className="text-base leading-none">{selectedLangObj.flag}</span>
                    <span>{selectedLangObj.nativeName}</span>
                  </div>
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-[11px] text-zinc-500 py-8">
                    No translation keys match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((k: TranslationKey) => {
                  const status = k.status[selectedLang];
                  const translated = k.translated[selectedLang];
                  const sty = status ? TRANSLATION_STATUS_STYLE[status] : TRANSLATION_STATUS_STYLE.missing;
                  return (
                    <TableRow key={k.key} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <TableCell className="font-mono text-[10px] text-emerald-300">{k.key}</TableCell>
                      <TableCell className="text-[11px] text-zinc-200">{k.english}</TableCell>
                      <TableCell className="text-[11px] text-zinc-100" dir={selectedLangObj.rtl ? 'rtl' : 'ltr'}>
                        {translated ?? <span className="text-zinc-600 italic">— not translated —</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${sty.badge}`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${sty.dot}`} />
                          {sty.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Showing {filtered.length} of {TRANSLATION_QA.length} keys</span>
        <span>Click column header to sort · Select language to view column</span>
      </div>
    </motion.div>
  );
}

// ─── Localization QA Dashboard ─────────────────────────────────────────────────

function LocalizationQADashboard() {
  const stats = useMemo(() => {
    return LANGUAGES.filter((l) => l.code !== 'en').map((l) => {
      const keys = TRANSLATION_QA.length;
      let translated = 0, review = 0, missing = 0;
      for (const k of TRANSLATION_QA) {
        const st = k.status[l.code];
        if (st === 'translated') translated += 1;
        else if (st === 'review') review += 1;
        else missing += 1;
      }
      const coveragePct = (translated / keys) * 100;
      return { lang: l, keys, translated, review, missing, coveragePct };
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-teal-500/20 bg-teal-500/10 text-teal-300">
          <ClipboardCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Localization QA Dashboard</h2>
          <p className="text-[11px] text-zinc-500">Coverage %, missing translations & review-needed counts per language</p>
        </div>
      </div>

      <div className="space-y-2">
        {stats.map((s, i) => {
          const barColor =
            s.coveragePct >= 90 ? 'bg-emerald-500' :
            s.coveragePct >= 70 ? 'bg-teal-400' :
            s.coveragePct >= 50 ? 'bg-amber-400' :
            'bg-rose-500';
          return (
            <motion.div
              key={s.lang.code}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{s.lang.flag}</span>
                <span className="text-xs font-semibold text-zinc-100 flex-1">{s.lang.nativeName}</span>
                <Badge variant="outline" className={`text-[9px] ${s.coveragePct >= 90 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : s.coveragePct >= 70 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
                  {s.coveragePct.toFixed(0)}%
                </Badge>
              </div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.translated / s.keys) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04 }}
                  className="h-full bg-emerald-500"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.review / s.keys) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04 + 0.1 }}
                  className="h-full bg-amber-400"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.missing / s.keys) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04 + 0.2 }}
                  className="h-full bg-rose-500"
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {s.translated} translated
                </span>
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {s.review} review
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                  {s.missing} missing
                </span>
                <span className="ml-auto text-zinc-500">of {s.keys} keys</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Translated</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Needs Review</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />Missing</span>
      </div>
    </motion.div>
  );
}

// ─── Cultural Adaptation Guide ─────────────────────────────────────────────────

const CULTURAL_ICONS: { key: keyof Omit<CulturalRegion, 'code' | 'region' | 'flag' | 'languages'>; label: string; icon: LucideIcon; accent: 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose' }[] = [
  { key: 'dateExample', label: 'Date Format', icon: CalendarDays, accent: 'emerald' },
  { key: 'numberExample', label: 'Number Format', icon: Hash, accent: 'teal' },
  { key: 'currencyExample', label: 'Currency Format', icon: Banknote, accent: 'cyan' },
  { key: 'firstDayOfWeek', label: 'First Day of Week', icon: CalendarDays, accent: 'violet' },
  { key: 'addressExample', label: 'Address Format', icon: MapPinned, accent: 'amber' },
];

function CulturalAdaptationGuide() {
  const [selected, setSelected] = useState<CulturalRegion>(CULTURAL_REGIONS[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <Globe2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Cultural Adaptation Guide</h2>
          <p className="text-[11px] text-zinc-500">Region-specific formatting for dates, numbers, currency & addresses</p>
        </div>
      </div>

      {/* Region selector */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {CULTURAL_REGIONS.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => setSelected(r)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
              selected.code === r.code
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {r.flag} {r.region}
          </button>
        ))}
      </div>

      {/* Selected region detail */}
      <div className="rounded-lg border border-white/[0.06] bg-black/30 p-4">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
          <span className="text-2xl">{selected.flag}</span>
          <div>
            <div className="text-sm font-semibold text-zinc-100">{selected.region}</div>
            <div className="text-[10px] text-zinc-500">
              Languages: {selected.languages.map((l) => l.toUpperCase()).join(' · ')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CULTURAL_ICONS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${ACCENT_RING[item.accent]}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</span>
                </div>
                {item.key === 'firstDayOfWeek' ? (
                  <div className="text-[11px] font-mono text-zinc-100">{selected[item.key]}</div>
                ) : (
                  <>
                    <div className="text-[11px] text-zinc-500 mb-0.5">
                      {item.key === 'dateExample' ? selected.dateFormat :
                       item.key === 'numberExample' ? selected.numberFormat :
                       item.key === 'currencyExample' ? selected.currencyFormat :
                       selected.addressFormat}
                    </div>
                    <div className="text-[12px] font-mono text-zinc-100 break-all" dir={selected.code === 'AE' ? 'rtl' : 'ltr'}>
                      {selected[item.key]}
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Translator Workflow (Kanban) ──────────────────────────────────────────────

const TASK_PRIORITY_STYLE: Record<TranslationTask['priority'], string> = {
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

const KANBAN_COLUMNS: { key: TranslationTask['status']; label: string; accent: 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose'; icon: LucideIcon }[] = [
  { key: 'todo', label: 'To Translate', accent: 'rose', icon: Edit3 },
  { key: 'review', label: 'In Review', accent: 'amber', icon: Clock },
  { key: 'approved', label: 'Approved', accent: 'emerald', icon: CheckCircle2 },
];

function TranslatorWorkflow() {
  const grouped = useMemo(() => {
    const g: Record<TranslationTask['status'], TranslationTask[]> = { todo: [], review: [], approved: [] };
    for (const t of TRANSLATION_TASKS) g[t.status].push(t);
    return g;
  }, []);

  const totalWords = TRANSLATION_TASKS.reduce((s, t) => s + t.wordCount, 0);
  const completedWords = TRANSLATION_TASKS.filter((t) => t.status === 'approved').reduce((s, t) => s + t.wordCount, 0);
  const completionPct = (completedWords / totalWords) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <KanbanSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Translator Workflow</h2>
            <p className="text-[11px] text-zinc-500">
              {TRANSLATION_TASKS.length} tasks · {completedWords}/{totalWords} words completed ({completionPct.toFixed(0)}%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {KANBAN_COLUMNS.map((c) => (
            <Badge key={c.key} variant="outline" className={`text-[9px] ${TASK_PRIORITY_STYLE[c.key === 'todo' ? 'high' : c.key === 'review' ? 'medium' : 'low']}`}>
              <c.icon className="h-2.5 w-2.5" />
              {grouped[c.key].length} {c.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {KANBAN_COLUMNS.map((col, colIdx) => {
          const Icon = col.icon;
          const tasks = grouped[col.key];
          return (
            <motion.div
              key={col.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: colIdx * 0.1 }}
              className="rounded-lg border border-white/[0.06] bg-black/30 p-3 min-h-[200px]"
            >
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${col.accent === 'rose' ? 'text-rose-300' : col.accent === 'amber' ? 'text-amber-300' : 'text-emerald-300'}`} />
                  <span className="text-[11px] font-semibold text-zinc-100">{col.label}</span>
                </div>
                <span className="text-[10px] text-zinc-500 tabular-nums">{tasks.length}</span>
              </div>
              <div className="space-y-1.5">
                {tasks.length === 0 ? (
                  <div className="text-center text-[10px] text-zinc-600 italic py-4">No tasks</div>
                ) : (
                  tasks.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-white/[0.14] transition-all"
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="font-mono text-[9px] text-emerald-300 truncate">{t.key}</span>
                        <Badge variant="outline" className={`text-[8px] capitalize shrink-0 ${TASK_PRIORITY_STYLE[t.priority]}`}>
                          {t.priority}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-100 mb-1.5">{t.source}</div>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
                        <span className="text-base leading-none">{t.targetFlag}</span>
                        <span className="uppercase">{t.targetLang}</span>
                        <span className="ml-auto">{t.wordCount}w</span>
                      </div>
                      <Separator className="my-1.5 bg-white/[0.06]" />
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-400">
                        <MessageSquare className="h-2.5 w-2.5" />
                        <span className="truncate">{t.assignee}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
        <AlertCircle className="h-3 w-3 text-cyan-400" />
        <span>Drag-and-drop workflow simulated — tasks move left-to-right through approval pipeline</span>
      </div>
    </motion.div>
  );
}

// ─── Translation Memory & Glossary ─────────────────────────────────────────────

const TM_DOMAIN_STYLE: Record<string, string> = {
  Finance: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Tax: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Regulatory: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Compliance: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  Trade: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

function qualityBadge(q: number): string {
  if (q >= 98) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (q >= 94) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
}

const TM_LANG_FLAGS: Record<string, string> = {
  hi: '🇮🇳', fr: '🇫🇷', de: '🇩🇪', ar: '🇦🇪', ja: '🇯🇵', zh: '🇨🇳', es: '🇪🇸',
};

function TranslationMemoryGlossary() {
  const [expanded, setExpanded] = useState<string | null>(TRANSLATION_MEMORY[0]?.id ?? null);

  const kpis = useMemo(() => {
    const total = TRANSLATION_MEMORY.length;
    const totalUsage = TRANSLATION_MEMORY.reduce((s, t) => s + t.usageCount, 0);
    const allQualities: number[] = [];
    for (const t of TRANSLATION_MEMORY) {
      for (const lang of Object.keys(t.translations)) {
        allQualities.push(t.translations[lang].quality);
      }
    }
    const avgQuality = allQualities.length
      ? allQualities.reduce((s, q) => s + q, 0) / allQualities.length
      : 0;
    return { total, totalUsage, avgQuality };
  }, []);

  const fmtUsage = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <Database className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Translation Memory & Glossary</h2>
          <p className="text-[11px] text-zinc-500">
            {TRANSLATION_MEMORY.length} entries · 7-language canonical glossary with QA scores & reviewers
          </p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total TM Entries</div>
          <div className="text-lg font-semibold text-zinc-50 tabular-nums">{kpis.total}</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Usage</div>
          <div className="text-lg font-semibold text-emerald-300 tabular-nums">{fmtUsage(kpis.totalUsage)}</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Quality</div>
          <div className="text-lg font-semibold text-teal-300 tabular-nums">{kpis.avgQuality.toFixed(1)}</div>
        </div>
      </div>

      {/* TM Table */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-8" />
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Source Text</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-24">Domain</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-24 text-right">Usage</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-28">Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TRANSLATION_MEMORY.map((entry) => {
              const isExpanded = expanded === entry.id;
              const domainStyle = TM_DOMAIN_STYLE[entry.domain] ?? 'border-white/[0.06] bg-white/[0.02] text-zinc-300';
              return (
                <Fragment key={entry.id}>
                  <TableRow
                    className="border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  >
                    <TableCell className="text-zinc-500">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </TableCell>
                    <TableCell className="text-[12px] font-medium text-zinc-100">{entry.sourceText}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] ${domainStyle}`}>{entry.domain}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-300 text-right tabular-nums">
                      {fmtUsage(entry.usageCount)}
                    </TableCell>
                    <TableCell className="text-[10px] text-zinc-500 font-mono">{entry.lastUpdated}</TableCell>
                  </TableRow>
                  <AnimatePresence>
                    {isExpanded && (
                      <TableRow className="border-white/[0.04] bg-black/30">
                        <TableCell colSpan={5} className="p-0">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="p-3"
                          >
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                              Translations across 7 languages
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {Object.entries(entry.translations).map(([langCode, t]) => (
                                <div
                                  key={langCode}
                                  className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5"
                                  dir={langCode === 'ar' ? 'rtl' : 'ltr'}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-base leading-none">{TM_LANG_FLAGS[langCode] ?? '🏳️'}</span>
                                      <span className="text-[10px] uppercase tracking-wider text-zinc-400">{langCode}</span>
                                    </div>
                                    <Badge variant="outline" className={`text-[9px] ${qualityBadge(t.quality)}`}>
                                      {t.quality}
                                    </Badge>
                                  </div>
                                  <div className="text-[12px] text-zinc-100 mb-1.5 leading-snug">{t.text}</div>
                                  <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    <span className="truncate">Reviewed by {t.reviewer}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Click a row to expand 7-language translations</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />≥98</span>
          <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />94-97</span>
          <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />&lt;94</span>
        </span>
      </div>
    </motion.div>
  );
}

// ─── ESG & Sustainability Dashboard ────────────────────────────────────────────

function ESGDashboard() {
  const summary = useMemo(() => {
    const scope1 = ESG_METRICS.reduce((s, e) => s + e.scope1Emissions, 0);
    const scope2 = ESG_METRICS.reduce((s, e) => s + e.scope2Emissions, 0);
    const scope3 = ESG_METRICS.reduce((s, e) => s + e.scope3Emissions, 0);
    const avgRenewable = ESG_METRICS.reduce((s, e) => s + e.renewableEnergyPct, 0) / ESG_METRICS.length;
    const avgSatisfaction = ESG_METRICS.reduce((s, e) => s + e.employeeSatisfaction, 0) / ESG_METRICS.length;
    return { scope1, scope2, scope3, avgRenewable, avgSatisfaction };
  }, []);

  const maxScope = Math.max(...ESG_METRICS.map((e) => e.scope1Emissions + e.scope2Emissions + e.scope3Emissions));

  const fmtTCO2 = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString('en-US');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <Leaf className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">ESG & Sustainability Dashboard</h2>
          <p className="text-[11px] text-zinc-500">
            Carbon emissions, renewable energy, water & community investment across {ESG_METRICS.length} countries
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Scope 1 + 2 (tCO₂e)</div>
          <div className="text-base font-semibold text-rose-300 tabular-nums">{fmtTCO2(summary.scope1 + summary.scope2)}</div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Scope 3 (tCO₂e)</div>
          <div className="text-base font-semibold text-amber-300 tabular-nums">{fmtTCO2(summary.scope3)}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Renewable %</div>
          <div className="text-base font-semibold text-emerald-300 tabular-nums">{summary.avgRenewable.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Satisfaction</div>
          <div className="text-base font-semibold text-teal-300 tabular-nums">{summary.avgSatisfaction.toFixed(1)}/100</div>
        </div>
      </div>

      {/* ESG Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {ESG_METRICS.map((m, i) => {
          const c = getCountry(m.countryCode as CountryCode);
          const totalEmissions = m.scope1Emissions + m.scope2Emissions + m.scope3Emissions;
          const s1Pct = (m.scope1Emissions / totalEmissions) * 100;
          const s2Pct = (m.scope2Emissions / totalEmissions) * 100;
          const s3Pct = (m.scope3Emissions / totalEmissions) * 100;
          const totalBarPct = (totalEmissions / maxScope) * 100;
          const renewableColor = m.renewableEnergyPct >= 60 ? 'text-emerald-300' : m.renewableEnergyPct >= 40 ? 'text-amber-300' : 'text-rose-300';
          return (
            <motion.div
              key={m.countryCode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-emerald-500/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{c?.flag ?? '🏳️'}</span>
                  <span className="text-[11px] font-semibold text-zinc-100">{c?.code ?? m.countryCode}</span>
                </div>
                <Badge variant="outline" className={`text-[9px] ${renewableColor} border-current/30 bg-current/10`}>
                  <Sun className="h-2.5 w-2.5" />
                  {m.renewableEnergyPct}%
                </Badge>
              </div>

              {/* Emissions stacked bar */}
              <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Emissions (tCO₂e)</div>
              <div className="h-2 rounded-full bg-black/40 overflow-hidden flex" title={`Scope 1: ${m.scope1Emissions} · Scope 2: ${m.scope2Emissions} · Scope 3: ${m.scope3Emissions}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s1Pct * totalBarPct) / 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04 }}
                  className="h-full bg-rose-500"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s2Pct * totalBarPct) / 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04 + 0.05 }}
                  className="h-full bg-amber-400"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s3Pct * totalBarPct) / 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04 + 0.1 }}
                  className="h-full bg-teal-400"
                />
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5 tabular-nums">{fmtTCO2(totalEmissions)}</div>

              {/* Mini stat grid */}
              <div className="mt-2 grid grid-cols-2 gap-1 text-[9px]">
                <div className="flex items-center gap-1 text-zinc-400">
                  <Droplets className="h-2.5 w-2.5 text-cyan-400" />
                  <span className="tabular-nums">{(m.waterUsage / 1000).toFixed(1)}K m³</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-400">
                  <Recycle className="h-2.5 w-2.5 text-emerald-400" />
                  <span className="tabular-nums">{m.wasteRecycledPct}%</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-400">
                  <Users className="h-2.5 w-2.5 text-violet-400" />
                  <span className="tabular-nums">{m.diversityScore}/100</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-400">
                  <HeartHandshake className="h-2.5 w-2.5 text-rose-400" />
                  <span className="tabular-nums">{m.employeeSatisfaction}%</span>
                </div>
              </div>

              <Separator className="my-2 bg-white/[0.06]" />

              <div className="flex items-center gap-1 text-[10px] text-emerald-300">
                <HeartHandshake className="h-2.5 w-2.5" />
                <span className="tabular-nums">${(m.communityInvestment / 1000).toFixed(0)}K community</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />Scope 1</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />Scope 2</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400" />Scope 3</span>
        <span className="ml-auto">Net-zero target: 2030 (Scope 1+2) · 2040 (Scope 3)</span>
      </div>
    </motion.div>
  );
}

// ─── Board & Governance ────────────────────────────────────────────────────────

const BOARD_TYPE_STYLE: Record<BoardResolution['type'], string> = {
  Financial: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Strategic: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  Governance: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Compliance: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

const BOARD_STATUS_STYLE: Record<BoardResolution['status'], string> = {
  passed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  tabled: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

function BoardGovernance() {
  const avgAttendance = useMemo(
    () => BOARD_MEMBERS.reduce((s, m) => s + m.attendance, 0) / BOARD_MEMBERS.length,
    [],
  );
  const totalShares = useMemo(
    () => BOARD_MEMBERS.reduce((s, m) => s + m.shares, 0),
    [],
  );
  const independentCount = BOARD_MEMBERS.filter((m) => m.independent).length;
  const passedCount = BOARD_RESOLUTIONS.filter((r) => r.status === 'passed').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] to-transparent p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300">
          <Gavel className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Board & Governance</h2>
          <p className="text-[11px] text-zinc-500">
            {BOARD_MEMBERS.length} directors · {independentCount} independent · {BOARD_RESOLUTIONS.length} resolutions ({passedCount} passed)
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Attendance</div>
          <div className="text-base font-semibold text-emerald-300 tabular-nums">{avgAttendance.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total Director Shares</div>
          <div className="text-base font-semibold text-teal-300 tabular-nums">{(totalShares / 1000).toFixed(0)}K</div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Independent</div>
          <div className="text-base font-semibold text-cyan-300 tabular-nums">{((independentCount / BOARD_MEMBERS.length) * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Board Members Table */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden mb-3">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <Crown className="h-3 w-3 text-amber-300" />
          <span className="text-[11px] font-semibold text-zinc-100">Board Members</span>
        </div>
        <ScrollArea className="max-h-[320px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Director</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-20">Role</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-20">Indep.</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Committees</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-20 text-right">Attend.</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-20">Since</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-20 text-right">Shares</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BOARD_MEMBERS.map((m) => {
                const c = getCountry(m.countryCode as CountryCode);
                return (
                  <TableRow key={m.id} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{c?.flag ?? '🏳️'}</span>
                        <div>
                          <div className="text-[12px] font-medium text-zinc-100">{m.name}</div>
                          <div className="text-[9px] text-zinc-500">{m.nationality}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-200">{m.role}</TableCell>
                    <TableCell>
                      {m.independent ? (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" />Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-white/[0.08] bg-white/[0.02] text-zinc-500">
                          Exec
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {m.committees.map((cm) => (
                          <span key={cm} className="text-[9px] px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.02] text-zinc-400">
                            {cm}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-[11px] font-semibold tabular-nums ${
                        m.attendance >= 95 ? 'text-emerald-300' :
                        m.attendance >= 90 ? 'text-teal-300' :
                        'text-amber-300'
                      }`}>{m.attendance}%</span>
                    </TableCell>
                    <TableCell className="text-[10px] text-zinc-400 font-mono">{m.since}</TableCell>
                    <TableCell className="text-[11px] text-zinc-200 text-right tabular-nums">
                      {(m.shares / 1000).toFixed(0)}K
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Board Resolutions Table */}
      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <Vote className="h-3 w-3 text-violet-300" />
          <span className="text-[11px] font-semibold text-zinc-100">Board Resolutions</span>
        </div>
        <ScrollArea className="max-h-[320px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500">Resolution</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-24">Date</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-24">Type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-20">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-zinc-500 w-32">Vote Tally</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BOARD_RESOLUTIONS.map((r) => (
                <TableRow key={r.id} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors align-top">
                  <TableCell>
                    <div className="text-[11px] font-medium text-zinc-100">{r.title}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{r.summary}</div>
                  </TableCell>
                  <TableCell className="text-[10px] text-zinc-400 font-mono">{r.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] ${BOARD_TYPE_STYLE[r.type]}`}>{r.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] capitalize ${BOARD_STATUS_STYLE[r.status]}`}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="flex items-center gap-0.5 text-emerald-300">
                        <ThumbsUp className="h-2.5 w-2.5" />{r.votesFor}
                      </span>
                      <span className="flex items-center gap-0.5 text-rose-400">
                        <ThumbsDown className="h-2.5 w-2.5" />{r.votesAgainst}
                      </span>
                      <span className="flex items-center gap-0.5 text-zinc-500">
                        <MinusCircle className="h-2.5 w-2.5" />{r.abstentions}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
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
    accent: 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose';
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
          Full internationalization stack — 8 native languages with RTL support, real-time UI string
          coverage, translation management, QA dashboard, cultural adaptation & translator workflow.
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

      {/* RTL Preview Panel */}
      <RTLPreviewPanel lang={activeLang} />

      {/* Translation Management + QA Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TranslationManagement />
        </div>
        <div className="lg:col-span-1">
          <LocalizationQADashboard />
        </div>
      </div>

      {/* Cultural Adaptation Guide */}
      <CulturalAdaptationGuide />

      {/* Translator Workflow */}
      <TranslatorWorkflow />

      {/* Translation Memory & Glossary */}
      <TranslationMemoryGlossary />

      {/* ESG & Sustainability Dashboard */}
      <ESGDashboard />

      {/* Board & Governance */}
      <BoardGovernance />

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 pt-2">
        <Languages className="h-3 w-3" />
        <span>VEYRO™ Multi-Language Platform — {LANGUAGES.length} languages · {TRANSLATION_QA.length} tracked translation keys · {stats.rtlCount} RTL</span>
      </div>
    </div>
  );
}
