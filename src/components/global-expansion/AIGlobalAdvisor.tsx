'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: AI GLOBAL ADVISOR™ (BILLION-DOLLAR GRADE)
//
// The Oracle for international finance — multi-jurisdiction tax, currency, compliance,
// cross-border & regulatory insights with a real multi-turn chat interface, regulatory
// impact analyzer, DTAA optimizer, PE risk checker & cross-border tax planner.
// All values derived from static data layer (@/lib/global/data). No API calls.
//
//   • Header with Oracle™ branded badge
//   • Multi-turn Advisory Chat — real chat with messages array + 6+ suggested Qs
//   • Summary stats — total insights, high impact, total potential savings
//   • Category filter — All / Tax / Currency / Compliance / Cross-Border / Regulation
//   • Insight cards — category, impact, recommendation, potential saving highlighted
//   • Regulatory Change Impact Analyzer — AI-style analysis with recommended actions
//   • DTAA Optimizer — interactive 2-country picker with rate matrix + structuring advice
//   • Permanent Establishment Risk Checker — interactive country + activities selector
//   • Cross-Border Tax Planning scenario builder — entity structure recommendations
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, Sparkles, Send, Lightbulb, TrendingUp, ShieldCheck,
  Coins, Globe2, Scale, ArrowRight, Zap, Target, type LucideIcon,
  AlertTriangle, Network, Building2, Briefcase, Server, UserCheck,
  Warehouse, Bot, User, RefreshCw, ArrowLeftRight, CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AI_ADVISOR_INSIGHTS, REGULATORY_CHANGES, DTAA_MATRIX, getCountry,
  fmtUSD,
  type AIAdvisorInsight, type CountryCode, type RegulatoryChange,
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

const REG_IMPACT_STYLE: Record<RegulatoryChange['impact'], string> = {
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  low: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
};

const CATEGORY_TABS = ['All', 'Tax', 'Currency', 'Compliance', 'Cross-Border', 'Regulation'] as const;
type CategoryTab = typeof CATEGORY_TABS[number];

const ACCENT_RING: Record<'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose', string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};

// ─── Saving Parser ─────────────────────────────────────────────────────────────

interface ParsedSaving {
  amount: number; // USD normalized
  raw: string;
  monetary: boolean;
}

function parseSaving(raw: string): ParsedSaving {
  const m = raw.match(/[$£€¥]\s*([\d.]+)\s*([KMB]?)/i);
  if (!m) return { amount: 0, raw, monetary: false };
  const num = parseFloat(m[1]);
  const mult = m[2].toUpperCase();
  const factor = mult === 'K' ? 1000 : mult === 'M' ? 1000000 : mult === 'B' ? 1000000000 : 1;
  const sym = m[0].trim()[0];
  const rate = sym === '£' ? 1.27 : sym === '€' ? 1.08 : sym === '¥' ? 0.0067 : 1;
  return { amount: num * factor * rate, raw, monetary: true };
}

// ─── Oracle Knowledge Base (canned Q&A) ────────────────────────────────────────

interface OracleQA {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  tags: string[];
  category: AIAdvisorInsight['category'];
}

const ORACLE_QAS: OracleQA[] = [
  {
    id: 'qa-dtaa-in-sg',
    question: 'DTAA implications India-Singapore',
    keywords: ['dtaa', 'india', 'singapore', 'withholding', 'royalty', 'ceca'],
    category: 'Tax',
    tags: ['DTAA', 'Transfer Pricing', 'Singapore', 'India'],
    answer:
      'Three levers are available via the India-Singapore Comprehensive Economic Cooperation Agreement (CECA). First, royalty and Fees for Technical Services (FTS) payments from India to Singapore are taxed at a reduced 10% withholding rate under Article 12 of the DTAA — versus the 20% statutory rate under domestic Indian law. Restructuring inter-company royalty to align with the arm\'s length principle can yield significant savings. Second, capital gains on share transfers are exempt under Article 6, which is highly favorable for holding-company structures. Third, routing US→IN shipments via the Singapore Free Trade Zone and applying the CECA preferential tariff saves approximately 4.2% in import duty.\n\nCombined annual savings: approximately $240K in transfer pricing optimization plus $62K/qtr in duty reduction. Recommended actions: file DTAA relief forms (Form 10F) with the Indian revenue authority, obtain a Tax Residency Certificate (TRC) from IRAS Singapore, and update your transfer pricing documentation to reflect the restructured royalty flows. GSTPilot™ auto-generates the TRC request and pre-fills Form 10F.',
  },
  {
    id: 'qa-vat-eu-thresholds',
    question: 'VAT registration thresholds in EU',
    keywords: ['vat', 'eu', 'oss', 'threshold', 'germany', 'france', 'registration'],
    category: 'Compliance',
    tags: ['VAT', 'EU', 'OSS', 'Germany', 'France'],
    answer:
      'EU VAT registration follows two distinct pathways depending on whether you sell B2B or B2C. For B2C cross-border sales within the EU, the One Stop Shop (OSS) scheme applies once your total annual cross-border EU sales exceed €10,000. Below this threshold, you may charge VAT at your home country\'s rate; above it, you must register for OSS in your identification member state and charge VAT at the customer\'s country rate.\n\nFor Germany, the standard VAT rate is 19% and France is 20%. Once registered for OSS in Germany (your identification member state), you file a single quarterly OSS return covering all EU B2C sales — eliminating the need for VAT registration in each individual member state. For B2B sales to EU VAT-registered customers, the reverse-charge mechanism applies — you do not charge VAT, but you must capture the customer\'s VAT ID and report the sale via the EC Sales List.\n\nVoluntary VAT registration is also possible below the threshold if you want to recover input VAT on EU expenses. GSTPilot™ auto-tracks the €10,000 threshold across all EU member states and pre-fills the quarterly OSS return.',
  },
  {
    id: 'qa-tp-docs',
    question: 'Transfer pricing documentation requirements',
    keywords: ['transfer pricing', 'documentation', 'oecd', 'master file', 'local file', 'cbcr'],
    category: 'Compliance',
    tags: ['Transfer Pricing', 'OECD', 'BEPS', 'Documentation'],
    answer:
      'Transfer pricing documentation under OECD BEPS Action 13 follows a three-tiered structure: (1) Master File — providing a high-level overview of the MNE group\'s global operations and TP policies, required for groups with consolidated revenue above €750M (Country-by-Country Reporting threshold); (2) Local File — detailed transaction-level TP analysis for each jurisdiction, required for entities with related-party transactions above local thresholds (e.g., India requires ₹50Cr+ transactions); (3) Country-by-Country Report (CbCR) — filed by the ultimate parent entity of groups with revenue above €750M, automatically exchanged between tax authorities under the Multilateral Competent Authority Agreement.\n\nIn India specifically, Form 3CEB must be filed by October 31 (one month before the income tax return) disclosing all international related-party transactions. Failure to maintain TP documentation triggers a 2% penalty on the value of the transaction under Section 271BA, plus potential adjustment-related penalties of 100-300% of the tax shortfall.\n\nGSTPilot™ auto-generates Master File and Local File templates using the OECD standard, syncs with your inter-company transaction ledger, and pre-fills Form 3CEB for Indian entities.',
  },
  {
    id: 'qa-eur-hedging',
    question: 'Currency hedging strategy for EUR exposure',
    keywords: ['eur', 'hedge', 'currency', 'forward', 'fx', 'europe'],
    category: 'Currency',
    tags: ['FX', 'Hedging', 'EUR', 'Forward'],
    answer:
      'Your current EUR exposure stands at €1.26M ($1.36M USD equivalent), with 66.7% hedged ($840K) and 33.3% unhedged ($420K). EUR/USD 30-day volatility is 6.8%, and your forward rate (6m) is 1.0850 vs the spot of 1.0800 — forward points of 50 imply a slight USD strengthening bias.\n\nRecommended hedging strategy: Layered forwards. Enter a 6-month forward contract for €400K at 1.0850 to lock in $434K — protecting against EUR depreciation below 1.0850. This brings your hedge ratio to ~95% and eliminates most downside risk. If EUR appreciates above 1.0850, you forfeit upside, but predictable cash flows support operational planning. For longer-dated receivables (12m+), consider a participating forward (zero-premium option) that allows 50% participation in EUR appreciation while capping downside.\n\nAvoid over-hedging beyond 100% of exposure — this creates speculative positions. Net exposure after hedging should target ≤10% of revenue for predictable P&L. GSTPilot™ monitors FX exposure in real-time across all currencies and auto-triggers hedge recommendations at configurable thresholds.',
  },
  {
    id: 'qa-pe-uae',
    question: 'Permanent establishment risk in UAE',
    keywords: ['pe', 'permanent establishment', 'uae', 'risk', 'nexus'],
    category: 'Cross-Border',
    tags: ['PE', 'UAE', 'Corporate Tax', 'Nexus'],
    answer:
      'The UAE Corporate Tax Law (Federal Decree-Law No. 47 of 2022) introduced PE concepts aligned with OECD Model Tax Convention. A non-resident person has a PE in the UAE if it has a fixed place of business (branch, office, factory, workshop, etc.) through which its business is conducted, OR a dependent agent that habitually concludes contracts on its behalf.\n\nSpecific PE triggers under UAE law include: (1) a physical office or branch in the UAE; (2) employees or agents habitually concluding contracts in the UAE; (3) a warehouse used for delivery or storage of inventory on a regular basis; (4) construction or installation projects lasting more than 6 months; (5) a server or computer equipment located in the UAE providing digital services. Importantly, the FTA clarified that purely preparatory or auxiliary activities (e.g., data storage alone) do not generally create a PE.\n\nIf a PE exists, the non-resident is subject to 9% UAE corporate tax on the profits attributable to the PE. To mitigate PE risk: (a) ensure any UAE agent is independent and acts in the ordinary course of its own business; (b) limit warehouse activities to storage-only with no sales concluded locally; (c) limit employee visits to ≤30 days/year for non-sales activities; (d) structure digital services through cloud infrastructure outside UAE jurisdiction. GSTPilot\'s PE Risk Checker (below) quantifies your specific exposure based on current activities.',
  },
  {
    id: 'qa-customs-electronics',
    question: 'Customs classification for electronics',
    keywords: ['customs', 'classification', 'electronics', 'hs code', 'duty', 'tariff'],
    category: 'Cross-Border',
    tags: ['Customs', 'HS Code', 'Electronics', 'Duty'],
    answer:
      'Electronics classification under the Harmonized System (HS) is critical for duty determination. Common classifications include: HS 8471 (automatic data processing machines — computers/laptops, typically 0% MFN duty in most WTO members); HS 8517 (telecommunications equipment — phones/routers, 0-5%); HS 8528 (monitors and displays, 0-14%); HS 8504 (power adapters/converters, 0-5%); HS 8542 (electronic integrated circuits — semiconductors, 0% in major markets).\n\nKey planning considerations: (1) Determine the correct 8-10 digit HS code using the destination country\'s tariff schedule — wrong classification triggers duty underpayment penalties of 100-300% plus interest. (2) For multi-component shipments (e.g., a laptop + adapter + case), apply the General Rules of Interpretation (GRI) — typically GRI 3(b) essential character rule classifies under the laptop (8471). (3) Free Trade Agreements can reduce or eliminate duties — Singapore-India CECA eliminates duty on most electronics traded between the two; US-Japan EPA reduces semiconductor duties to 0%.\n\nFor Singapore→India electronics shipments, route through Singapore FTZ to claim CECA preferential origin and reduce duty from 15% to 0-5%. Maintain a Bill of Materials (BOM) with regional value content ≥40% to qualify for preferential origin. GSTPilot™ auto-suggests HS codes from product descriptions and validates FTA eligibility in real-time.',
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

      <p className="mt-3 text-[12px] text-zinc-300 leading-relaxed">{insight.description}</p>

      <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-2.5">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-violet-300 mb-1">
          <Lightbulb className="h-3 w-3" />Oracle Recommendation
        </div>
        <p className="text-[11px] text-zinc-200 leading-relaxed">{insight.recommendation}</p>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

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

// ─── Multi-turn Advisory Chat ──────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'oracle';
  text: string;
  tags?: string[];
  category?: AIAdvisorInsight['category'];
  timestamp: string;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function findAnswer(input: string): OracleQA | null {
  const q = input.toLowerCase();
  let bestMatch: OracleQA | null = null;
  let bestScore = 0;
  for (const qa of ORACLE_QAS) {
    let score = 0;
    for (const kw of qa.keywords) {
      if (q.includes(kw)) score += 3;
    }
    // Also check if question words appear
    const qWords = qa.question.toLowerCase().split(/\s+/);
    for (const w of qWords) {
      if (w.length > 3 && q.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }
  return bestScore > 0 ? bestMatch : null;
}

function MultiTurnChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'oracle',
      text: "Hello, I'm the Oracle™ — your AI Global Advisor for international finance. I can help with cross-border tax planning, VAT/GST optimization, currency hedging, transfer pricing, permanent establishment risk, customs classification, and regulatory compliance across 10 jurisdictions. Try one of the suggested questions below, or type your own query.",
      tags: ['Oracle™', 'Welcome'],
      timestamp: 'now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const sendQuestion = (question: string) => {
    if (!question.trim()) return;
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      text: question,
      timestamp: 'now',
    };
    setMessages((p) => [...p, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate Oracle thinking + canned response
    setTimeout(() => {
      const match = findAnswer(question);
      const responseText = match
        ? match.answer
        : "I can provide detailed insights on: DTAA implications between specific countries, VAT registration thresholds across the EU, transfer pricing documentation under OECD BEPS Action 13, currency hedging strategies for EUR/GBP/JPY exposure, permanent establishment risk analysis (especially UAE, India, US), and customs HS code classification for electronics and other goods. Please select one of the suggested questions or rephrase your query using these topics.";
      const oracleMsg: ChatMessage = {
        id: generateId(),
        role: 'oracle',
        text: responseText,
        tags: match?.tags,
        category: match?.category,
        timestamp: 'now',
      };
      setMessages((p) => [...p, oracleMsg]);
      setIsThinking(false);
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

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
            <h2 className="text-base font-semibold text-zinc-50">Advisory Chat</h2>
            <p className="text-[11px] text-zinc-400">Multi-turn conversation with Oracle™ for international finance</p>
          </div>
        </div>
        <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px]">
          <Sparkles className="h-3 w-3" />{messages.filter((m) => m.role === 'user').length} turns
        </Badge>
      </div>

      {/* Chat window */}
      <div
        ref={scrollRef}
        className="rounded-lg border border-white/[0.08] bg-black/40 p-3 max-h-[420px] overflow-y-auto space-y-3"
      >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
              m.role === 'user'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-300'
            }`}>
              {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div className={`max-w-[80%] ${m.role === 'user' ? 'text-right' : ''}`}>
              <div className={`rounded-lg px-3 py-2 ${
                m.role === 'user'
                  ? 'bg-cyan-500/10 border border-cyan-500/20'
                  : 'bg-violet-500/[0.06] border border-violet-500/20'
              }`}>
                <p className="text-[12px] text-zinc-100 leading-relaxed whitespace-pre-line text-left">{m.text}</p>
              </div>
              {m.tags && m.tags.length > 0 && (
                <div className={`mt-1 flex items-center gap-1 flex-wrap ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[8px] border-white/[0.08] bg-white/[0.02] text-zinc-400">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-lg px-3 py-2 bg-violet-500/[0.06] border border-violet-500/20">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <Input
          type="text"
          placeholder="Ask about cross-border taxes, VAT, FX hedging, transfer pricing, PE risk…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="bg-black/40 border-white/[0.08] text-zinc-100 text-sm placeholder:text-zinc-500"
        />
        <Button type="submit" size="sm" className="bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>

      {/* Suggested questions */}
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Suggested Questions</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {ORACLE_QAS.map((qa, i) => (
            <motion.button
              key={qa.id}
              type="button"
              onClick={() => sendQuestion(qa.question)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              whileHover={{ y: -1 }}
              className="text-left rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all"
            >
              <div className="flex items-start gap-1.5">
                <Zap className="h-3 w-3 text-violet-300 mt-0.5 shrink-0" />
                <span className="text-[11px] text-zinc-200 leading-snug">{qa.question}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 flex-wrap">
                {qa.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[8px] text-zinc-500">#{t}</span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Regulatory Change Impact Analyzer ─────────────────────────────────────────

interface RegAnalysis {
  change: RegulatoryChange;
  analysis: string;
  recommendedActions: string[];
  estimatedCost: string;
  timeToComply: string;
}

function buildRegAnalysis(rc: RegulatoryChange): RegAnalysis {
  const c = getCountry(rc.country as CountryCode);
  const analyses: Record<string, Omit<RegAnalysis, 'change'>> = {
    'rc-1': {
      analysis: `UAE Corporate Tax Law introduces a 9% federal tax on profits exceeding AED 375,000 (~$102K USD), effective from financial years starting on or after June 1, 2023. Your UAE entity (GSTPilot FZ-LLC) had revenue of AED 1.91M ($520K) and taxable income of AED 522K ($142K) in the prior period, putting you well above the threshold. Estimated annual UAE corporate tax liability: ~$12,780. Transfer pricing documentation is mandatory for related-party transactions exceeding AED 63M; you currently fall below this threshold but should prepare documentation proactively.`,
      recommendedActions: [
        'Register with the Federal Tax Authority (FTA) for Corporate Tax — obtain Tax Registration Number (TRN)',
        'Align fiscal year with calendar year (or apply for FTA approval for alternative period)',
        'Implement transfer pricing documentation aligned with OECD guidelines',
        'Update ERP and accounting systems to track UAE CT separately from VAT',
        'File first Corporate Tax return for FY2024 by Q1 2025',
      ],
      estimatedCost: '$12,780 annual tax + $5K compliance cost',
      timeToComply: `${rc.daysToComply} days remaining`,
    },
    'rc-2': {
      analysis: `India's GST e-invoicing mandate now applies to businesses with turnover ≥ ₹5 Cr (previously ₹100 Cr). This significantly expands the scope — your India entity (GSTPilot India Pvt Ltd) has turnover of ₹84.7 Cr, already within scope, but you should validate that all B2B invoices are registered on the Invoice Registration Portal (IRP) and QR codes are properly printed. Non-compliance carries a penalty of 10% of the tax amount (minimum ₹10,000) per invoice.`,
      recommendedActions: [
        'Validate IRP integration — confirm all B2B invoices ≥ ₹50,000 are registered',
        'Update invoice templates to include IRN and QR code as required',
        'Reconcile e-invoice records with GSTR-1 filings monthly',
        'Train accounts payable/receivable teams on new thresholds',
        'Configure ERP auto-retry for IRP timeout failures',
      ],
      estimatedCost: '~$2K one-time ERP update + ₹10K/invoice penalty risk',
      timeToComply: `${rc.daysToComply} days remaining`,
    },
    'rc-3': {
      analysis: `UK Making Tax Digital for Income Tax Self Assessment (MTD ITSA) phases in from April 2026 for self-employed and landlords with income > £50K, lowering to £30K and £20K in subsequent years. While your UK entity (GSTPilot UK Ltd) is a corporation not directly affected by MTD ITSA, individual shareholders and partners drawing income > £50K from the business will need MTD-compatible software. Plan ahead by ensuring digital record-keeping for all individual UK tax matters.`,
      recommendedActions: [
        'Audit personal UK tax records for affected individuals (directors, shareholders)',
        'Subscribe to MTD-compatible personal tax software (e.g., QuickBooks, Xero)',
        'Establish digital record-keeping habits — no more spreadsheet-based personal accounting',
        'Schedule quarterly "digest" updates for affected individuals',
        'Coordinate with personal tax advisor for transition planning',
      ],
      estimatedCost: '~£250/year per affected individual for MTD software',
      timeToComply: `${rc.daysToComply} days remaining`,
    },
    'rc-4': {
      analysis: `The EU's VAT in the Digital Age (ViDA) package introduces three pillars: (1) Digital Reporting Requirements (DRR) — real-time e-invoicing for intra-EU B2B transactions by 2030; (2) Single VAT Registration — extension of OSS to B2B and domestic transactions, eliminating need for VAT registration in each member state; (3) Platform Economy — deemed supplier rules for digital platforms. Your German entity (GSTPilot GmbH) currently files monthly Umsatzsteuervoranmeldung — under ViDA, you'll consolidate via OSS in Germany as your identification member state and eliminate French VAT registration.`,
      recommendedActions: [
        'Migrate to Peppol-compatible e-invoicing infrastructure (EU standard)',
        'Consolidate EU VAT registrations — close FR VAT registration, use OSS-DE for all EU B2C',
        'Update ERP to support ViDA digital reporting schemas (XML-based)',
        'Plan platform economy deemed-supplier rules for any marketplace activity',
        'Engage with German BZSt for OSS identification member state confirmation',
      ],
      estimatedCost: '~$15K one-time system migration + $4K/yr compliance savings',
      timeToComply: `${rc.daysToComply} days remaining`,
    },
    'rc-5': {
      analysis: `FinCEN's Beneficial Ownership Information (BOI) reporting under the Corporate Transparency Act requires all US LLCs, corporations, and similar entities to file BOI reports disclosing individuals who own ≥25% or exercise substantial control. Initial report due by January 1, 2025 for entities formed before 2024. Your US entity (GSTPilot Inc. Delaware) must file — failure carries civil penalty of $591/day and potential criminal penalties up to $10,000 + 3 years imprisonment.`,
      recommendedActions: [
        'Identify all beneficial owners (≥25% ownership or substantial control)',
        'Collect required info: full legal name, DOB, residential address, ID number + image',
        "File BOI report via FinCEN's secure portal at boiefiling.fincen.treas.gov",
        'Update BOI report within 30 days of any ownership change',
        'Maintain internal beneficial ownership register for audit trail',
      ],
      estimatedCost: '~$0 filing fee + $500 admin time',
      timeToComply: `${rc.daysToComply} days remaining — URGENT`,
    },
    'rc-6': {
      analysis: `Japan's Qualified Invoice System (QIS) effective October 1, 2023, requires businesses issuing invoices to be "Qualified Invoice Issuers" registered with the NTA. Purchasers can only claim input consumption tax credit if they receive qualified invoices from registered issuers. Your Japan-related transactions involve Osaka Precision Ltd. (registered issuer). However, you should validate that all Japan vendors in your supply chain are QIS-registered to preserve input credit eligibility.`,
      recommendedActions: [
        'Validate QIS registration status for all Japan vendors via NTA registry',
        'Update invoice templates to include registration number + tax rate per item',
        'Filter vendor master — flag non-QIS vendors as "input tax credit blocked"',
        'For small vendors below ¥10M threshold, document the 80% special exemption if applicable',
        'File Japan consumption tax return using QIS-compliant records',
      ],
      estimatedCost: '~$1K vendor audit + risk of lost input credits',
      timeToComply: rc.daysToComply === 0 ? 'In effect — verify compliance now' : `${rc.daysToComply} days remaining`,
    },
  };
  const fallback = analyses['rc-1'];
  const a = analyses[rc.id] ?? { ...fallback, analysis: `${rc.title}: ${rc.description}. Country: ${c.name}.` };
  return { change: rc, ...a };
}

function RegulatoryImpactAnalyzer() {
  const sorted = useMemo(
    () => [...REGULATORY_CHANGES].sort((a, b) => a.daysToComply - b.daysToComply),
    [],
  );

  const [expandedId, setExpandedId] = useState<string | null>(sorted[0]?.id ?? null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Regulatory Change Impact Analyzer</h2>
          <p className="text-[11px] text-zinc-500">AI-generated analysis with recommended actions per change</p>
        </div>
      </div>

      <ScrollArea className="max-h-[600px] pr-2">
        <div className="space-y-2">
          {sorted.map((rc, i) => {
            const analysis = buildRegAnalysis(rc);
            const c = getCountry(rc.country as CountryCode);
            const isExpanded = expandedId === rc.id;
            const isUrgent = rc.daysToComply <= 12 && rc.actionRequired;
            return (
              <motion.div
                key={rc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className={`rounded-lg border ${
                  isUrgent ? 'border-rose-500/30 bg-rose-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'
                } overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rc.id)}
                  className="w-full text-left p-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xl leading-none mt-0.5">{c?.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-zinc-100">{rc.title}</span>
                      <Badge variant="outline" className={`text-[9px] capitalize ${REG_IMPACT_STYLE[rc.impact]}`}>
                        {rc.impact} impact
                      </Badge>
                      {rc.actionRequired && (
                        <Badge variant="outline" className="text-[9px] border-rose-500/40 bg-rose-500/10 text-rose-300">
                          <AlertTriangle className="h-2.5 w-2.5" />Action Required
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {c?.name} · {rc.category} · Effective {rc.effectiveDate}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500">Days Left</div>
                    <div className={`text-sm font-bold tabular-nums ${
                      rc.daysToComply === 0 ? 'text-rose-400' :
                      rc.daysToComply <= 12 ? 'text-amber-300' : 'text-zinc-100'
                    }`}>
                      {rc.daysToComply === 0 ? 'Overdue' : `${rc.daysToComply}d`}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 space-y-3">
                        <Separator className="bg-white/[0.06]" />
                        {/* Oracle Analysis */}
                        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-3">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300 mb-1.5">
                            <BrainCircuit className="h-3 w-3" />Oracle Analysis
                          </div>
                          <p className="text-[11px] text-zinc-200 leading-relaxed">{analysis.analysis}</p>
                        </div>

                        {/* Recommended actions */}
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300 mb-2">
                            <Lightbulb className="h-3 w-3" />Recommended Actions
                          </div>
                          <ul className="space-y-1.5">
                            {analysis.recommendedActions.map((a, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-[11px] text-zinc-300">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[8px] font-bold mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Separator className="bg-white/[0.06]" />

                        {/* Meta */}
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="rounded-md border border-white/[0.06] bg-black/30 p-2">
                            <div className="text-zinc-500 uppercase tracking-wider mb-0.5">Estimated Cost</div>
                            <div className="text-zinc-100 font-semibold">{analysis.estimatedCost}</div>
                          </div>
                          <div className="rounded-md border border-white/[0.06] bg-black/30 p-2">
                            <div className="text-zinc-500 uppercase tracking-wider mb-0.5">Time to Comply</div>
                            <div className={`font-semibold ${isUrgent ? 'text-rose-300' : 'text-emerald-300'}`}>{analysis.timeToComply}</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

// ─── DTAA Optimizer ────────────────────────────────────────────────────────────

function DTAAOptimizer() {
  const [country1, setCountry1] = useState<CountryCode>('IN');
  const [country2, setCountry2] = useState<CountryCode>('SG');

  const match = useMemo(() => {
    return DTAA_MATRIX.find(
      (d) =>
        (d.country1 === country1 && d.country2 === country2) ||
        (d.country1 === country2 && d.country2 === country1),
    );
  }, [country1, country2]);

  const c1 = getCountry(country1);
  const c2 = getCountry(country2);

  // Build rate cards
  const rateCards = match
    ? [
        { label: 'Withholding Tax (Royalty/FTS)', rate: match.withholdingTax, baseRate: Math.max(match.withholdingTax, 15) },
        { label: 'Dividend Tax', rate: match.dividendTax, baseRate: Math.max(match.dividendTax, 20) },
        { label: 'Interest Tax', rate: match.interestTax, baseRate: Math.max(match.interestTax, 15) },
      ]
    : [];

  const swap = () => {
    setCountry1(country2);
    setCountry2(country1);
  };

  // Recommendation logic
  const recommendation = useMemo(() => {
    if (!match) {
      return {
        title: 'No DTAA in force',
        text: `There is currently no Double Tax Avoidance Agreement between ${c1.name} and ${c2.name}. Cross-border payments will be subject to statutory withholding rates under domestic law of the source country. Consider routing through a jurisdiction with which both countries have DTAAs (e.g., Singapore, UAE, Mauritius) to optimize tax efficiency — but ensure substance requirements are met to avoid treaty shopping challenges under BEPS Action 6 (PPT rule).`,
        strategy: 'Routing via third country',
        savings: 'Variable — case-by-case analysis',
      };
    }
    if (match.status === 'negotiating') {
      return {
        title: 'DTAA under negotiation',
        text: `A DTAA between ${c1.name} and ${c2.name} is under negotiation but not yet in force. Until ratification, apply domestic withholding rates and monitor treaty status. Once in force, file for refund of excess tax withheld within applicable limitation periods (typically 3-6 years).`,
        strategy: 'Wait & file refund later',
        savings: 'Future relief — track ratification',
      };
    }
    // Active DTAA
    const bestRate = Math.min(match.withholdingTax, match.dividendTax, match.interestTax);
    const avgRate = (match.withholdingTax + match.dividendTax + match.interestTax) / 3;
    const strategy =
      bestRate <= 5 ? 'Aggressive treaty optimization' :
      bestRate <= 10 ? 'Standard treaty utilization' :
      'Limited treaty benefit';
    return {
      title: `${match.ftaType} in force — optimal structure available`,
      text: `Active ${match.ftaType} between ${c1.name} (${c1.flag}) and ${c2.name} (${c2.flag}) enables reduced withholding rates: ${match.withholdingTax}% on royalties (vs ~15% statutory), ${match.dividendTax}% on dividends (vs ~20% statutory), ${match.interestTax}% on interest (vs ~15% statutory). To claim benefits, obtain a Tax Residency Certificate (TRC) from the resident country's tax authority and file Form 10F (or equivalent) with the source country's revenue authority. Average effective rate across payment types: ${avgRate.toFixed(1)}%.\n\nRecommended structuring: route inter-company royalty and FTS payments from ${c1.name} to ${c2.name} to leverage the ${match.withholdingTax}% withholding rate. For dividend repatriation, time distributions to align with the ${match.dividendTax}% rate. Capital gains are typically protected under separate articles — review Article 6 (capital gains) for share-transfer planning.`,
      strategy,
      savings: `${avgRate.toFixed(1)}% effective WHT vs ~16.7% statutory`,
    };
  }, [match, c1, c2]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
          <Network className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">DTAA Optimizer</h2>
          <p className="text-[11px] text-zinc-500">Double Tax Avoidance Agreement rate matrix & structuring advisor</p>
        </div>
      </div>

      {/* Country pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end mb-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Source Country</label>
          <Select value={country1} onValueChange={(v) => setCountry1(v as CountryCode)}>
            <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/[0.08]">
              {(['IN', 'US', 'GB', 'DE', 'FR', 'AE', 'SG', 'JP', 'CA', 'AU'] as CountryCode[]).map((cc) => (
                <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                  {getCountry(cc).flag} {getCountry(cc).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          type="button"
          onClick={swap}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-all"
          title="Swap countries"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Resident Country</label>
          <Select value={country2} onValueChange={(v) => setCountry2(v as CountryCode)}>
            <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/[0.08]">
              {(['IN', 'US', 'GB', 'DE', 'FR', 'AE', 'SG', 'JP', 'CA', 'AU'] as CountryCode[]).map((cc) => (
                <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                  {getCountry(cc).flag} {getCountry(cc).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Route header */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{c1.flag}</span>
          <div className="flex flex-col items-center">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
            {match && (
              <span className="text-[9px] text-emerald-300 mt-0.5">{match.ftaType}</span>
            )}
          </div>
          <span className="text-2xl">{c2.flag}</span>
          <div className="ml-1">
            <div className="text-xs font-semibold text-zinc-100">{c1.name} → {c2.name}</div>
            <div className="text-[10px] text-zinc-500">
              {match ? `${match.ftaType} · ${match.status}` : 'No treaty in force'}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            match?.status === 'active'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : match?.status === 'negotiating'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {match?.status === 'active' ? 'Active Treaty' : match?.status === 'negotiating' ? 'Negotiating' : 'No Treaty'}
        </Badge>
      </div>

      {/* Rate cards */}
      {match && rateCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {rateCards.map((r, i) => {
            const savingsPct = ((r.baseRate - r.rate) / r.baseRate) * 100;
            return (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="rounded-lg border border-white/[0.06] bg-black/30 p-3"
              >
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">{r.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-emerald-300 tabular-nums">{r.rate}%</span>
                  <span className="text-[10px] text-zinc-500 line-through tabular-nums">{r.baseRate}%</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">
                  ↓ {savingsPct.toFixed(0)}% savings
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Recommendation */}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300 mb-2">
          <Lightbulb className="h-3 w-3" />Oracle Recommendation
        </div>
        <div className="text-[12px] font-semibold text-zinc-100 mb-1.5">{recommendation.title}</div>
        <p className="text-[11px] text-zinc-200 leading-relaxed whitespace-pre-line">{recommendation.text}</p>
        <Separator className="my-2.5 bg-white/[0.06]" />
        <div className="flex items-center gap-3 text-[10px]">
          <div>
            <span className="text-zinc-500 uppercase tracking-wider">Strategy: </span>
            <span className="text-emerald-300 font-semibold">{recommendation.strategy}</span>
          </div>
          <div>
            <span className="text-zinc-500 uppercase tracking-wider">Savings: </span>
            <span className="text-emerald-300 font-semibold">{recommendation.savings}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Permanent Establishment Risk Checker ──────────────────────────────────────

interface PEActivity {
  id: string;
  label: string;
  icon: LucideIcon;
  weight: number; // 0-100 contribution to PE risk
  description: string;
}

const PE_ACTIVITIES: PEActivity[] = [
  { id: 'sales-office', label: 'Sales Office', icon: Building2, weight: 35, description: 'Physical office where sales activities are conducted' },
  { id: 'warehouse', label: 'Warehouse (used for fulfillment)', icon: Warehouse, weight: 20, description: 'Storage facility used to deliver goods to customers (not just storage)' },
  { id: 'employee-183', label: 'Employee >183 days', icon: UserCheck, weight: 30, description: 'Employee present in country for >183 days conducting business' },
  { id: 'server-hosting', label: 'Server Hosting', icon: Server, weight: 15, description: 'Own/leased server located in country providing digital services' },
  { id: 'agent-contracts', label: 'Agent Concluding Contracts', icon: Briefcase, weight: 40, description: 'Dependent agent habitually concluding contracts on your behalf' },
];

const PE_COUNTRY_GUIDANCE: Record<string, string> = {
  IN: 'India follows OECD-aligned PE rules under the Income Tax Act. A "business connection" PE includes any place of business or dependent agent. Article 5 of India DTAAs typically excludes preparatory/auxiliary activities. India also has a "Significant Economic Presence" (SEP) test for digital businesses — revenue ≥₹2M or ≥100,000 users/downloads triggers SEP-based nexus.',
  US: 'The US applies PE concepts only via treaties. For non-treaty countries, US-source income is taxed on a gross basis. Treaty PE requires a "fixed place of business" or dependent agent. State-level nexus rules (e.g., economic nexus for sales tax) operate independently of federal PE rules.',
  GB: 'The UK follows OECD Model Article 5 closely. A "fixed place of business" PE requires duration + permanence. The UK also has a Diverted Profits Tax (DPT) at 25% that targets structures artificially avoiding PE. Modified PE rules for digital businesses under OECD Pillar One are being implemented.',
  DE: 'Germany strictly interprets PE — even a single employee with contracting authority can create an agency PE. Germany requires "fixed place of business" with geographical + temporal permanence. Server-only PEs are generally NOT recognized in Germany (unlike some other EU members).',
  FR: 'France follows OECD Model PE rules. France has aggressive interpretation of agency PE — even occasional contract conclusion by an agent can trigger PE. France has unilateral digital PE rules (Article 209 B — though largely superseded by EU ATAD directives). Construction PEs require 12+ months.',
  AE: 'UAE Corporate Tax Law (2022) introduced PE concepts aligned with OECD Model. A non-resident has PE if it has a fixed place of business OR a dependent agent concluding contracts. Construction/installation projects >6 months create PE. Servers in UAE providing digital services may create PE — FTA guidance pending.',
  SG: 'Singapore follows OECD Model PE rules strictly. A "fixed place of business" PE requires duration + permanence + productive activity. Singapore does NOT recognize server-only PEs. Agency PE requires habitual contract conclusion. Singapore has unilateral SEP rules for digital services.',
  JP: 'Japan follows OECD Model PE rules. A "fixed place of business" PE requires availability + use for the business. Japan recognizes server PE if the server is essential to the business and the enterprise operates it. Construction PE requires 12+ months under most Japan treaties.',
  CA: 'Canada follows OECD Model PE rules. A "fixed place of business" PE requires location + permanence + business activity. Canada has been aggressive on agency PE — commissionaire arrangements can create PE. Server-only PE generally not recognized.',
  AU: 'Australia follows OECD Model PE rules. A "fixed place of business" PE requires fixed + permanent. Australia has Stronger Multinational Anti-Avoidance Law (MAAL) targeting structures artificially avoiding PE. Server-only PE generally not recognized unless actively operated by the enterprise.',
};

function PERiskChecker() {
  const [country, setCountry] = useState<CountryCode>('AE');
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['sales-office', 'employee-183']);

  const toggleActivity = (id: string) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const totalRisk = useMemo(() => {
    return selectedActivities.reduce((s, id) => {
      const a = PE_ACTIVITIES.find((x) => x.id === id);
      return s + (a?.weight ?? 0);
    }, 0);
  }, [selectedActivities]);

  const riskLevel: 'Low' | 'Medium' | 'High' = totalRisk >= 70 ? 'High' : totalRisk >= 35 ? 'Medium' : 'Low';
  const riskColor = riskLevel === 'High' ? 'rose' : riskLevel === 'Medium' ? 'amber' : 'emerald';
  const riskPct = Math.min(100, totalRisk);

  const c = getCountry(country);
  const guidance = PE_COUNTRY_GUIDANCE[country] ?? 'No country-specific guidance available.';

  const mitigationSteps = useMemo(() => {
    const steps: string[] = [];
    if (selectedActivities.includes('sales-office')) {
      steps.push('Convert sales office to "preparatory or auxiliary" activities only — limit to market research, advertising, information storage. Avoid concluding contracts locally.');
    }
    if (selectedActivities.includes('warehouse')) {
      steps.push('Ensure warehouse is operated by an independent 3PL — not your employees. Limit activities to storage-only with no delivery/sales conclusion.');
    }
    if (selectedActivities.includes('employee-183')) {
      steps.push('Track employee days-in-country carefully — implement 183-day monitoring. Consider splitting assignments across multiple employees or fiscal years.');
    }
    if (selectedActivities.includes('server-hosting')) {
      steps.push('Use a third-party cloud provider (AWS, Azure, GCP) — servers owned/operated by independent providers generally do not create PE. Avoid "your" servers physically located in-country.');
    }
    if (selectedActivities.includes('agent-contracts')) {
      steps.push('Convert dependent agent to independent agent — must act in ordinary course of own business, represent multiple principals, and bear entrepreneurial risk.');
    }
    if (steps.length === 0) {
      steps.push('No PE-creating activities selected — maintain current structure. Periodically review activities to ensure no inadvertent PE triggers emerge.');
    }
    return steps;
  }, [selectedActivities]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-300">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Permanent Establishment Risk Checker</h2>
          <p className="text-[11px] text-zinc-500">Select country & business activities to assess PE exposure</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Country of Activity</label>
            <Select value={country} onValueChange={(v) => setCountry(v as CountryCode)}>
              <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/[0.08]">
                {(['IN', 'US', 'GB', 'DE', 'FR', 'AE', 'SG', 'JP', 'CA', 'AU'] as CountryCode[]).map((cc) => (
                  <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                    {getCountry(cc).flag} {getCountry(cc).name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Business Activities in {c.name}</div>
            <div className="space-y-1.5">
              {PE_ACTIVITIES.map((a) => {
                const isSel = selectedActivities.includes(a.id);
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleActivity(a.id)}
                    className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                      isSel
                        ? 'border-rose-500/30 bg-rose-500/[0.06]'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isSel ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-white/[0.06] text-zinc-500'}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-zinc-100">{a.label}</span>
                          <Badge variant="outline" className={`text-[8px] ${isSel ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-white/[0.06] text-zinc-500'}`}>
                            {a.weight} risk pts
                          </Badge>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{a.description}</div>
                      </div>
                      <div className={`h-3 w-3 shrink-0 rounded border-2 mt-0.5 ${isSel ? 'bg-rose-500 border-rose-500' : 'border-zinc-600'}`}>
                        {isSel && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="space-y-3">
          {/* Risk meter */}
          <div className={`rounded-lg border p-4 ${
            riskColor === 'rose' ? 'border-rose-500/30 bg-rose-500/[0.06]' :
            riskColor === 'amber' ? 'border-amber-500/30 bg-amber-500/[0.06]' :
            'border-emerald-500/30 bg-emerald-500/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">PE Risk Assessment</span>
              <span className="text-[10px] text-zinc-400">{c.flag} {c.name}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold ${
                riskColor === 'rose' ? 'text-rose-400' :
                riskColor === 'amber' ? 'text-amber-300' :
                'text-emerald-300'
              }`}>{riskLevel}</span>
              <span className="text-[11px] text-zinc-400">Risk</span>
            </div>
            <div className="h-2 rounded-full bg-black/40 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${riskPct}%` }}
                transition={{ duration: 0.6 }}
                className={`h-full ${
                  riskColor === 'rose' ? 'bg-rose-500' :
                  riskColor === 'amber' ? 'bg-amber-400' :
                  'bg-emerald-500'
                }`}
              />
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 tabular-nums">
              {totalRisk} / 100 risk score · {selectedActivities.length} activit{selectedActivities.length === 1 ? 'y' : 'ies'} selected
            </div>
          </div>

          {/* Country guidance */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-cyan-300 mb-1.5">
              <Globe2 className="h-3 w-3" />{c.name} PE Rules
            </div>
            <p className="text-[11px] text-zinc-200 leading-relaxed">{guidance}</p>
          </div>

          {/* Mitigation steps */}
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-violet-300 mb-2">
              <Lightbulb className="h-3 w-3" />Mitigation Strategy
            </div>
            <ul className="space-y-1.5">
              {mitigationSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-[8px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Cross-Border Tax Planning Scenario Builder ────────────────────────────────

interface EntityStructure {
  id: string;
  name: string;
  flag: string;
  corporateRate: number;
  effectiveRate: number;
  setupCost: string;
  annualCost: string;
  repatriationCost: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

function CrossBorderTaxPlanner() {
  const [revenue, setRevenue] = useState<number>(2000000);
  const [country1, setCountry1] = useState<CountryCode>('IN');
  const [country2, setCountry2] = useState<CountryCode>('SG');

  const c1 = getCountry(country1);
  const c2 = getCountry(country2);

  const structures = useMemo<EntityStructure[]>(() => {
    const profitMargin = 0.22; // 22% net margin
    const profit = revenue * profitMargin;
    const baseRate1 = c1.corporateTaxRate;
    const baseRate2 = c2.corporateTaxRate;

    return [
      {
        id: 's1',
        name: `Single Entity — ${c1.name}`,
        flag: c1.flag,
        corporateRate: baseRate1,
        effectiveRate: baseRate1,
        setupCost: '~$5K',
        annualCost: '~$8K compliance',
        repatriationCost: 'None (single entity)',
        pros: [
          'Simplest structure — one legal entity',
          'Lower compliance overhead',
          'Single audit and tax return',
        ],
        cons: [
          `High effective rate ${baseRate1}% on full profit`,
          'No inter-company pricing optimization',
          'Limited treaty access for cross-border flows',
        ],
        recommended: false,
      },
      {
        id: 's2',
        name: `Holding Company in ${c2.name} + OpCo in ${c1.name}`,
        flag: `${c1.flag}+${c2.flag}`,
        corporateRate: baseRate2,
        effectiveRate: Math.round((baseRate1 * 0.55 + baseRate2 * 0.45) * 10) / 10,
        setupCost: '~$25K',
        annualCost: '~$18K compliance + TP docs',
        repatriationCost: '5-15% dividend WHT (DTAA-reduced)',
        pros: [
          `Shift 45% of profit to ${c2.name} at ${baseRate2}% (vs ${baseRate1}%)`,
          'DTAA access for royalty/interest/dividend flows',
          `Effective blended rate ~${Math.round((baseRate1 * 0.55 + baseRate2 * 0.45) * 10) / 10}%`,
          `Annual tax savings ~${fmtUSD((baseRate1 - (baseRate1 * 0.55 + baseRate2 * 0.45)) / 100 * profit * 0.6)}`,
        ],
        cons: [
          'Transfer pricing documentation mandatory',
          'Substance requirements in holding country',
          'BEPS Action 6 PPT rule — must have genuine business purpose',
        ],
        recommended: true,
      },
      {
        id: 's3',
        name: `Regional HQ in UAE + OpCos in ${c1.name} & ${c2.name}`,
        flag: `${c1.flag}+${c2.flag}+🇦🇪`,
        corporateRate: 9, // UAE rate
        effectiveRate: Math.round((baseRate1 * 0.45 + baseRate2 * 0.30 + 9 * 0.25) * 10) / 10,
        setupCost: '~$40K',
        annualCost: '~$30K compliance + TP + UAE CT filing',
        repatriationCost: '5% WHT to UAE (CEPA); 0% on UAE onward',
        pros: [
          `UAE HQ at 9% corporate tax — among lowest globally`,
          `Route inter-company flows via UAE for ${getCountry('AE').flag} CEPA/DTAA benefits`,
          'Holding company regime — no WHT on outward dividends',
          `Effective blended rate ~${Math.round((baseRate1 * 0.45 + baseRate2 * 0.30 + 9 * 0.25) * 10) / 10}%`,
        ],
        cons: [
          'Highest setup + annual compliance cost',
          'Economic substance requirements in UAE (ESR)',
          'BEPS Pillar 2 — minimum 15% effective rate for MNEs >€750M revenue',
          'Complex three-entity structure — requires dedicated tax counsel',
        ],
        recommended: revenue >= 5000000,
      },
    ];
  }, [revenue, country1, country2, c1, c2]);

  const profitMargin = 0.22;
  const profit = revenue * profitMargin;
  const singleTax = profit * (c1.corporateTaxRate / 100);
  const bestStructure = structures.find((s) => s.recommended) ?? structures[0];
  const optimizedTax = profit * (bestStructure.effectiveRate / 100);
  const savings = singleTax - optimizedTax;
  const savingsPct = (savings / singleTax) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-teal-500/20 bg-teal-500/10 text-teal-300">
          <Scale className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Cross-Border Tax Planning</h2>
          <p className="text-[11px] text-zinc-500">Scenario builder — input revenue, select jurisdictions, compare entity structures</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Annual Revenue (USD)</label>
          <Input
            type="number"
            min={100000}
            step={100000}
            value={revenue}
            onChange={(e) => setRevenue(Math.max(100000, Number(e.target.value) || 0))}
            className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9 tabular-nums"
          />
          <div className="flex items-center gap-1 mt-1">
            {[1000000, 2000000, 5000000, 10000000].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRevenue(r)}
                className={`px-1.5 py-0.5 rounded text-[9px] border ${
                  revenue === r
                    ? 'border-teal-500/40 bg-teal-500/15 text-teal-300'
                    : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                ${(r / 1000000).toFixed(1)}M
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Primary Operating Country</label>
          <Select value={country1} onValueChange={(v) => setCountry1(v as CountryCode)}>
            <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/[0.08]">
              {(['IN', 'US', 'GB', 'DE', 'FR', 'AE', 'SG', 'JP', 'CA', 'AU'] as CountryCode[]).map((cc) => (
                <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                  {getCountry(cc).flag} {getCountry(cc).name} ({getCountry(cc).corporateTaxRate}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 block">Secondary Country</label>
          <Select value={country2} onValueChange={(v) => setCountry2(v as CountryCode)}>
            <SelectTrigger className="bg-black/40 border-white/[0.06] text-zinc-100 text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/[0.08]">
              {(['IN', 'US', 'GB', 'DE', 'FR', 'AE', 'SG', 'JP', 'CA', 'AU'] as CountryCode[]).filter((cc) => cc !== country1).map((cc) => (
                <SelectItem key={cc} value={cc} className="text-zinc-100 text-xs">
                  {getCountry(cc).flag} {getCountry(cc).name} ({getCountry(cc).corporateTaxRate}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">Est. Profit (22% margin)</div>
          <div className="text-sm font-bold text-zinc-100 tabular-nums">{fmtUSD(profit)}</div>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-2.5">
          <div className="text-[9px] uppercase tracking-wider text-rose-300">Single-Entity Tax</div>
          <div className="text-sm font-bold text-rose-300 tabular-nums">{fmtUSD(singleTax)}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
          <div className="text-[9px] uppercase tracking-wider text-emerald-300">Optimized Tax</div>
          <div className="text-sm font-bold text-emerald-300 tabular-nums">{fmtUSD(optimizedTax)}</div>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
          <div className="text-[9px] uppercase tracking-wider text-violet-300">Annual Savings</div>
          <div className="text-sm font-bold text-violet-300 tabular-nums">
            {fmtUSD(savings)} <span className="text-[9px] text-zinc-500">({savingsPct.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {/* Structure comparison cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {structures.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className={`rounded-lg border p-3 ${
              s.recommended
                ? 'border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20'
                : 'border-white/[0.06] bg-white/[0.02]'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{s.flag}</span>
                <span className="text-[12px] font-semibold text-zinc-100 leading-tight">{s.name}</span>
              </div>
              {s.recommended && (
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shrink-0">
                  <Sparkles className="h-2.5 w-2.5" />Recommended
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px]">
              <div className="rounded-md bg-black/30 px-2 py-1">
                <div className="text-zinc-500 uppercase tracking-wider">Effective Rate</div>
                <div className={`font-bold ${s.recommended ? 'text-emerald-300' : 'text-zinc-100'} tabular-nums`}>{s.effectiveRate}%</div>
              </div>
              <div className="rounded-md bg-black/30 px-2 py-1">
                <div className="text-zinc-500 uppercase tracking-wider">Annual Tax</div>
                <div className={`font-bold tabular-nums ${s.recommended ? 'text-emerald-300' : 'text-zinc-100'}`}>
                  {fmtUSD(profit * (s.effectiveRate / 100))}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-zinc-500 mb-2 space-y-0.5">
              <div className="flex items-center justify-between">
                <span>Setup cost:</span>
                <span className="text-zinc-300">{s.setupCost}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Annual cost:</span>
                <span className="text-zinc-300">{s.annualCost}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Repatriation:</span>
                <span className="text-zinc-300 text-right">{s.repatriationCost}</span>
              </div>
            </div>

            <Separator className="bg-white/[0.06] my-2" />

            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-emerald-300">Pros</div>
              {s.pros.map((p, idx) => (
                <div key={idx} className="flex items-start gap-1 text-[10px] text-zinc-300">
                  <span className="text-emerald-400 shrink-0">+</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 mt-2">
              <div className="text-[9px] uppercase tracking-wider text-rose-300">Cons</div>
              {s.cons.map((cn, idx) => (
                <div key={idx} className="flex items-start gap-1 text-[10px] text-zinc-400">
                  <span className="text-rose-400 shrink-0">−</span>
                  <span>{cn}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
        <RefreshCw className="h-3 w-3" />
        <span>Recalculates dynamically — adjust revenue & jurisdictions to compare structures in real-time</span>
      </div>
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
    accent: 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose';
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
          The Oracle for international finance — multi-jurisdiction tax optimization, currency hedging,
          compliance gap analysis, cross-border trade recommendations, regulatory impact, DTAA structuring,
          PE risk assessment & entity structure planning across 10 countries.
        </p>
      </motion.div>

      {/* Multi-turn Advisory Chat */}
      <MultiTurnChat />

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

      {/* Regulatory Change Impact Analyzer */}
      <RegulatoryImpactAnalyzer />

      {/* DTAA Optimizer + PE Risk Checker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DTAAOptimizer />
        <PERiskChecker />
      </div>

      {/* Cross-Border Tax Planner */}
      <CrossBorderTaxPlanner />

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 pt-2">
        <BrainCircuit className="h-3 w-3" />
        <span>GSTPilot Infinity™ AI Global Advisor — {ORACLE_QAS.length} canned insights · {REGULATORY_CHANGES.length} regulatory changes · {DTAA_MATRIX.length} DTAA pairs analyzed</span>
      </div>
    </div>
  );
}
