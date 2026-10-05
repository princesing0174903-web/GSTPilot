'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — AI Response Cards (Premium Inline Detection)
//
// When Oracle returns text that contains structured financial data, this module
// detects the pattern and renders a beautiful premium card INSTEAD of (or above)
// the plain markdown text.
//
// Supported card types (auto-detected from the streamed text):
//   • GST Summary       — "GST Liability: ₹1,20,000" / "Output Tax: … Input Tax: …"
//   • Revenue Card      — "Revenue: ₹5,00,000 (+12% YoY)"
//   • Profit Card       — "Net Profit: ₹1,20,000 (Margin: 24%)"
//   • Vendor Card       — "Vendor: ABC Traders — Payable: ₹45,000"
//   • Invoice Card      — "Invoice #INV-001 — ₹12,000 — Due: 2024-03-15"
//   • Risk Card         — "Risk Score: 72/100 (High)"
//
// Detection is conservative — we only render a card when the pattern is strong.
// Otherwise the text falls through to normal markdown rendering.
//
// Pure detection + render. No state, no side effects. Memoized for performance.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt, TrendingUp, TrendingDown, Building2, FileText, AlertTriangle,
  ShieldCheck, ArrowUpRight, ArrowDownRight, type LucideIcon,
} from 'lucide-react';

// ─── Detected card types ─────────────────────────────────────────────────────

export type ResponseCardType =
  | 'gst-summary'
  | 'revenue'
  | 'profit'
  | 'vendor'
  | 'invoice'
  | 'risk';

export interface ResponseCard {
  type: ResponseCardType;
  title: string;
  /** Primary metric shown large. */
  value: string;
  /** Secondary line / context. */
  subtitle?: string;
  /** Trend indicator. */
  trend?: { direction: 'up' | 'down' | 'flat'; label: string; tone: 'positive' | 'negative' | 'neutral' };
  /** Extra detail rows. */
  details?: { label: string; value: string }[];
}

// ─── Pattern matchers ────────────────────────────────────────────────────────
// Each matcher scans the streamed text and returns a card if a strong pattern
// is found. We intentionally require multiple signals (e.g. keyword + amount)
// to avoid false positives on ordinary prose.

function parseAmount(raw: string): string | null {
  // Matches ₹1,20,000 | Rs. 1,20,000 | INR 120000 | ₹ 12.5L | $5,000 | 12,000
  const m = raw.match(/[₹$]\s?[\d,]+(?:\.\d+)?(?:\s?[LMK])?|(?:Rs\.?|INR)\s?[\d,]+(?:\.\d+)?(?:\s?[LMK])?|[\d,]{4,}(?:\.\d+)?/i);
  return m?.[0] ? m[0].trim() : null;
}

function parsePercent(raw: string): string | null {
  const m = raw.match(/(-?\d+(?:\.\d+)?)\s?%/);
  return m?.[1] ? `${m[1]}%` : null;
}

function matchGstSummary(text: string): ResponseCard | null {
  if (!/\bgst\b|tax liability|output tax|input tax|itc\b/i.test(text)) return null;
  const amount = parseAmount(text);
  if (!amount) return null;
  const details: { label: string; value: string }[] = [];

  const outputMatch = text.match(/output\s+tax[^a-z0-9]*([₹$\d,\.]+)/i);
  const inputMatch = text.match(/input\s+tax[^a-z0-9]*([₹$\d,\.]+)/i);
  const itcMatch = text.match(/itc[^a-z0-9]*([₹$\d,\.]+)/i);
  if (outputMatch?.[1]) details.push({ label: 'Output Tax', value: outputMatch[1] });
  if (inputMatch?.[1]) details.push({ label: 'Input Tax', value: inputMatch[1] });
  else if (itcMatch?.[1]) details.push({ label: 'ITC Available', value: itcMatch[1] });

  const net = details.length >= 2
    ? `Net Liability: ${amount}`
    : 'GST liability for the period';
  return {
    type: 'gst-summary',
    title: 'GST Summary',
    value: amount,
    subtitle: net,
    details: details.length > 0 ? details : undefined,
  };
}

function matchRevenue(text: string): ResponseCard | null {
  if (!/revenue|total sales|top.?line|gross income/i.test(text)) return null;
  const amount = parseAmount(text);
  if (!amount) return null;
  const pct = parsePercent(text);
  const trend = pct
    ? { direction: (!pct.startsWith('-') ? 'up' : 'down') as 'up' | 'down', label: pct, tone: (!pct.startsWith('-') ? 'positive' : 'negative') as 'positive' | 'negative' }
    : undefined;
  return {
    type: 'revenue',
    title: 'Revenue',
    value: amount,
    subtitle: 'Total revenue for the period',
    trend,
  };
}

function matchProfit(text: string): ResponseCard | null {
  if (!/(?:net\s+)?profit|bottom.?line|margin|ebitda/i.test(text)) return null;
  const amount = parseAmount(text);
  if (!amount) return null;
  const marginMatch = text.match(/margin[^a-z0-9]*(-?\d+(?:\.\d+)?)\s?%/i);
  const margin = marginMatch ? `${marginMatch[1]}%` : parsePercent(text);
  return {
    type: 'profit',
    title: 'Profitability',
    value: amount,
    subtitle: margin ? `Margin: ${margin}` : 'Net profit for the period',
    trend: margin
      ? { direction: (!margin.startsWith('-') ? 'up' : 'down') as 'up' | 'down', label: margin, tone: (!margin.startsWith('-') ? 'positive' : 'negative') as 'positive' | 'negative' }
      : undefined,
  };
}

function matchVendor(text: string): ResponseCard | null {
  if (!/vendor|supplier|payable|creditor/i.test(text)) return null;
  const amount = parseAmount(text);
  if (!amount) return null;
  // Try to grab a vendor name
  const nameMatch = text.match(/(?:vendor|supplier|creditor)\s*[:\-]?\s*([A-Z][A-Za-z0-9&'.\- ]{2,40})/);
  const name = nameMatch?.[1]?.trim();
  return {
    type: 'vendor',
    title: name ? `Vendor — ${name}` : 'Vendor Analysis',
    value: amount,
    subtitle: 'Outstanding payable',
  };
}

function matchInvoice(text: string): ResponseCard | null {
  if (!/invoice/i.test(text)) return null;
  const amount = parseAmount(text);
  const invNo = text.match(/(?:invoice|inv)[\s#:-]*([A-Z0-9-]{3,20})/i);
  if (!amount && !invNo) return null;
  const dueMatch = text.match(/due[^a-z0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s[a-z]{3,9}\s[0-9]{4})/i);
  return {
    type: 'invoice',
    title: invNo ? `Invoice ${invNo[1]}` : 'Invoice',
    value: amount ?? '—',
    subtitle: dueMatch ? `Due: ${dueMatch[1]}` : 'Invoice details',
  };
}

function matchRisk(text: string): ResponseCard | null {
  if (!/risk\s+score|risk\s+level|risk\s+rating|risk:\s*(?:high|medium|low|critical)/i.test(text)) return null;
  const scoreMatch = text.match(/risk\s+score[^a-z0-9]*(\d{1,3})\s*(?:\/\s*100)?/i);
  const score = scoreMatch?.[1] ? `${scoreMatch[1]}/100` : '—';
  const levelMatch = text.match(/risk\s+level[^a-z]*(critical|high|medium|low)/i);
  const level = levelMatch?.[1]?.toLowerCase() ?? '';
  const tone = level === 'critical' || level === 'high' ? 'negative' : level === 'medium' ? 'neutral' : 'positive';
  return {
    type: 'risk',
    title: 'Risk Assessment',
    value: score,
    subtitle: level ? `Risk Level: ${level.charAt(0).toUpperCase()}${level.slice(1)}` : 'Composite risk score',
    trend: level ? { direction: 'flat', label: level.toUpperCase(), tone: tone as 'positive' | 'negative' | 'neutral' } : undefined,
  };
}

const MATCHERS = [matchGstSummary, matchRevenue, matchProfit, matchVendor, matchInvoice, matchRisk];

/**
 * Scan the streamed text for any recognizable financial pattern and return the
 * best-matching card (or null if none). We pick the FIRST matcher that returns
 * a hit so we don't render multiple overlapping cards for the same response.
 *
 * NOTE: This is conservative by design. If the text is generic prose, no card
 * is rendered and the caller falls back to normal markdown.
 */
export function detectResponseCard(text: string): ResponseCard | null {
  if (!text || text.length < 10) return null;
  for (const m of MATCHERS) {
    try {
      const card = m(text);
      if (card) return card;
    } catch { /* non-fatal — fall through */ }
  }
  return null;
}

// ─── Card rendering ───────────────────────────────────────────────────────────

const CARD_META: Record<ResponseCardType, { icon: LucideIcon; accent: string; ring: string; iconBg: string }> = {
  'gst-summary': { icon: ShieldCheck, accent: 'text-amber-300', ring: 'ring-amber-500/20', iconBg: 'bg-amber-500/15' },
  revenue: { icon: TrendingUp, accent: 'text-emerald-300', ring: 'ring-emerald-500/20', iconBg: 'bg-emerald-500/15' },
  profit: { icon: TrendingUp, accent: 'text-emerald-300', ring: 'ring-emerald-500/20', iconBg: 'bg-emerald-500/15' },
  vendor: { icon: Building2, accent: 'text-sky-300', ring: 'ring-sky-500/20', iconBg: 'bg-sky-500/15' },
  invoice: { icon: FileText, accent: 'text-amber-300', ring: 'ring-amber-500/20', iconBg: 'bg-amber-500/15' },
  risk: { icon: AlertTriangle, accent: 'text-rose-300', ring: 'ring-rose-500/20', iconBg: 'bg-rose-500/15' },
};

function TrendBadge({ trend }: { trend: NonNullable<ResponseCard['trend']> }) {
  const Icon = trend.direction === 'up' ? ArrowUpRight : trend.direction === 'down' ? ArrowDownRight : null;
  const color =
    trend.tone === 'positive' ? 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20'
    : trend.tone === 'negative' ? 'text-rose-400 bg-rose-500/10 ring-rose-500/20'
    : 'text-amber-400 bg-amber-500/10 ring-amber-500/20';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${color}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {trend.label}
    </span>
  );
}

function ResponseCardView({ card }: { card: ResponseCard }) {
  const meta = CARD_META[card.type];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`mb-3 overflow-hidden rounded-2xl border border-[#232323] bg-gradient-to-br from-[#131313] to-[#0E0E0E] ring-1 ${meta.ring}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[#1F1F1F] px-4 py-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${meta.accent}`} />
        </div>
        <span className="text-[12px] font-semibold uppercase tracking-wider text-white/70">{card.title}</span>
        {card.trend && <div className="ml-auto"><TrendBadge trend={card.trend} /></div>}
      </div>
      {/* Body */}
      <div className="px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-bold tracking-tight text-white tabular-nums">{card.value}</span>
        </div>
        {card.subtitle && <p className="mt-0.5 text-[12px] text-white/55">{card.subtitle}</p>}
        {card.details && card.details.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {card.details.map((d) => (
              <div key={d.label} className="rounded-lg border border-[#1C1C1C] bg-[#0B0B0B] px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{d.label}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-white/90 tabular-nums">{d.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const MemoizedResponseCardView = memo(ResponseCardView);

/**
 * Convenience wrapper: detect a card from text and render it if present.
 * Returns null when no card pattern is found (caller renders plain markdown).
 */
export function OracleResponseCard({ text }: { text: string }): ReactNode {
  const card = detectResponseCard(text);
  if (!card) return null;
  return <MemoizedResponseCardView card={card} />;
}

export default OracleResponseCard;
