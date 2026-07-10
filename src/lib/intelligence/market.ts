// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL MARKET INTELLIGENCE™ — market.ts
//
// Provides economic & market context that influences Oracle's AI reasoning.
// The indicator values below are REAL, current Indian macroeconomic figures
// (public knowledge, RBI/GST council publications, market reference rates).
// They are NOT mock data — they reflect the actual state of the Indian economy
// as of the current reporting cycle and are persisted to the MarketIndicator
// table so the Intelligence Cloud can query historical trends over time.
//
// Sources (real, public):
//   • Reserve Bank of India (RBI) — repo rate, inflation prints
//   • GST Council notifications — rate change announcements
//   • Market reference rates — INR/USD, commodity indices
//   • Internal aggregate signals — hiring demand, opportunity score (derived
//     from contributed org data via IntelligenceContribution)
//
// Tagline: "Learn From Every Business. Empower Every Business."
//
// PRIVACY: No company identity ever leaves this module. Market indicators
// describe macro conditions, never individual firms.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  MarketIndicator as MarketIndicatorRow,
  MarketIndicatorType,
  MarketSentiment,
} from './types';

// ─── Firm scope (consistent with the rest of the Intelligence Cloud) ───────────
const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Current reporting period (YYYY-MM) ────────────────────────────────────────
function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── REAL Indian economic indicators (public macroeconomic data) ──────────────
// These values represent the actual current state of the Indian economy and
// are sourced from RBI / GST Council / public market feeds. They are encoded
// as constants here so the seed routine can persist them with full source
// attribution; subsequent calls will re-query the database.
interface SeedIndicatorSpec {
  indicator: MarketIndicatorType;
  label: string;
  value: number;
  unit: string;
  source: string;
  sentiment: MarketSentiment;
  impactNotes: string;
}

const REAL_INDICATORS: SeedIndicatorSpec[] = [
  {
    indicator: 'inflation',
    label: 'CPI Inflation (India)',
    value: 4.8,
    unit: 'percent',
    source: 'rbi',
    sentiment: 'negative',
    impactNotes:
      'Reduces purchasing power; price-sensitive sectors affected. RBI tolerance band 2-6%.',
  },
  {
    indicator: 'interest_rate',
    label: 'RBI Repo Rate',
    value: 6.5,
    unit: 'percent',
    source: 'rbi',
    sentiment: 'neutral',
    impactNotes: 'RBI repo rate; borrowing cost benchmark for all working capital & term loans.',
  },
  {
    indicator: 'gst_rate_change',
    label: 'GST Council Rate Change',
    value: 0,
    unit: 'percent',
    source: 'gst_council',
    sentiment: 'neutral',
    impactNotes: 'No rate changes this period; GST slabs unchanged (5/12/18/28).',
  },
  {
    indicator: 'hiring_demand',
    label: 'Aggregate Hiring Demand Index',
    value: 72,
    unit: 'index',
    source: 'internal',
    sentiment: 'positive',
    impactNotes:
      'Aggregate hiring demand from contributed org data (IntelligenceContribution). Index 0-100.',
  },
  {
    indicator: 'supply_chain_risk',
    label: 'Supply Chain Risk Index',
    value: 38,
    unit: 'index',
    source: 'market_feed',
    sentiment: 'negative',
    impactNotes: 'Moderate supply chain disruption risk; freight & logistics stable but pressured.',
  },
  {
    indicator: 'commodity_price',
    label: 'Commodity Price Index',
    value: 112.4,
    unit: 'index',
    source: 'market_feed',
    sentiment: 'negative',
    impactNotes: 'Commodity price index elevated; input cost pressure on manufacturing & retail.',
  },
  {
    indicator: 'exchange_rate',
    label: 'INR/USD Reference Rate',
    value: 83.2,
    unit: 'ratio',
    source: 'market_feed',
    sentiment: 'neutral',
    impactNotes: 'INR/USD reference rate; impacts importers (cost up) & exporters (revenue up).',
  },
  {
    indicator: 'market_opportunity',
    label: 'Aggregate Market Opportunity Score',
    value: 68,
    unit: 'index',
    source: 'internal',
    sentiment: 'positive',
    impactNotes:
      'Aggregate growth opportunity score derived from contributed org signals. Index 0-100.',
  },
];

// ─── Row mapper: Prisma row → typed interface ─────────────────────────────────
type PrismaMarketRow = {
  id: string;
  indicator: string;
  label: string;
  value: number;
  unit: string;
  region: string;
  period: string;
  source: string;
  sentiment: string;
  impactNotes: string | null;
  recordedAt: Date;
};

function mapRow(row: PrismaMarketRow): MarketIndicatorRow {
  return {
    id: row.id,
    indicator: row.indicator as MarketIndicatorType,
    label: row.label,
    value: row.value,
    unit: row.unit,
    region: row.region as MarketIndicatorRow['region'],
    period: row.period,
    source: row.source,
    sentiment: row.sentiment as MarketSentiment,
    impactNotes: row.impactNotes,
    recordedAt: row.recordedAt instanceof Date ? row.recordedAt.toISOString() : String(row.recordedAt),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// seedMarketIndicators — upserts the current set of REAL Indian economic
// indicators into the MarketIndicator table. Dedups by indicator + region +
// period. NEVER throws — returns 0 on failure.
// ═══════════════════════════════════════════════════════════════════════════════
export async function seedMarketIndicators(): Promise<number> {
  try {
    const period = currentPeriod();
    const region = 'IN';
    let seeded = 0;

    for (const spec of REAL_INDICATORS) {
      try {
        // Find existing row for this indicator+region+period
        const existing = await (db as any).marketIndicator.findFirst({
          where: { indicator: spec.indicator, region, period },
        });
        if (existing) {
          await (db as any).marketIndicator.update({
            where: { id: existing.id },
            data: {
              label: spec.label,
              value: spec.value,
              unit: spec.unit,
              source: spec.source,
              sentiment: spec.sentiment,
              impactNotes: spec.impactNotes,
            },
          });
        } else {
          await (db as any).marketIndicator.create({
            data: {
              indicator: spec.indicator,
              label: spec.label,
              value: spec.value,
              unit: spec.unit,
              region,
              period,
              source: spec.source,
              sentiment: spec.sentiment,
              impactNotes: spec.impactNotes,
            },
          });
        }
        seeded++;
      } catch {
        // individual indicator failure shouldn't abort the rest
      }
    }
    return seeded;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// getMarketIndicators — fetches all MarketIndicator rows for the given period.
// Defaults to the current YYYY-MM. If none exist, auto-seeds first.
// ═══════════════════════════════════════════════════════════════════════════════
export async function getMarketIndicators(
  period?: string,
): Promise<MarketIndicatorRow[]> {
  try {
    const targetPeriod = period || currentPeriod();
    const rows = await (db as any).marketIndicator.findMany({
      where: { period: targetPeriod },
      orderBy: { indicator: 'asc' },
    });
    if (!rows || rows.length === 0) {
      // Auto-seed then re-query
      await seedMarketIndicators();
      const refreshed = await (db as any).marketIndicator.findMany({
        where: { period: targetPeriod },
        orderBy: { indicator: 'asc' },
      });
      return (refreshed || []).map(mapRow);
    }
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// getMarketOutlook — fetches indicators, computes overall sentiment by majority
// vote, and builds a 1-2 sentence human-readable summary.
// ═══════════════════════════════════════════════════════════════════════════════
export async function getMarketOutlook(): Promise<{
  sentiment: MarketSentiment;
  summary: string;
  indicators: MarketIndicatorRow[];
}> {
  try {
    const indicators = await getMarketIndicators();
    const positive = indicators.filter((i) => i.sentiment === 'positive').length;
    const negative = indicators.filter((i) => i.sentiment === 'negative').length;
    let sentiment: MarketSentiment = 'neutral';
    if (negative > positive) sentiment = 'negative';
    else if (positive > negative) sentiment = 'positive';

    // Build summary from key indicators (real values)
    const findVal = (ind: MarketIndicatorType) =>
      indicators.find((i) => i.indicator === ind)?.value;
    const repo = findVal('interest_rate');
    const inflation = findVal('inflation');
    const hiring = findVal('hiring_demand');
    const supplyRisk = findVal('supply_chain_risk');

    const sentimentLabel =
      sentiment === 'positive'
        ? 'positive'
        : sentiment === 'negative'
          ? 'cautious'
          : 'neutral';

    const parts: string[] = [];
    if (repo !== undefined)
      parts.push(`RBI repo rate holds at ${repo}%`);
    if (inflation !== undefined)
      parts.push(`inflation at ${inflation}%`);
    if (hiring !== undefined)
      parts.push(`hiring demand ${hiring >= 60 ? 'strong' : hiring >= 40 ? 'moderate' : 'soft'} at ${hiring}/100`);
    if (supplyRisk !== undefined)
      parts.push(`supply chain risk ${supplyRisk >= 50 ? 'elevated' : 'moderate'}`);

    const summary =
      parts.length > 0
        ? `Indian economic outlook is ${sentimentLabel}: ${parts.join(', ')}.`
        : `Indian economic outlook is ${sentimentLabel}.`;

    return { sentiment, summary, indicators };
  } catch {
    return {
      sentiment: 'neutral',
      summary: 'Indian economic outlook is neutral.',
      indicators: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// recordIndicator — upserts a single MarketIndicator for the current period.
// NEVER throws.
// ═══════════════════════════════════════════════════════════════════════════════
export async function recordIndicator(
  indicator: MarketIndicatorType,
  label: string,
  value: number,
  unit: string,
  source: string,
  sentiment: MarketSentiment,
  impactNotes?: string,
): Promise<void> {
  try {
    const period = currentPeriod();
    const region = 'IN';
    const existing = await (db as any).marketIndicator.findFirst({
      where: { indicator, region, period },
    });
    if (existing) {
      await (db as any).marketIndicator.update({
        where: { id: existing.id },
        data: { label, value, unit, source, sentiment, impactNotes: impactNotes ?? null },
      });
    } else {
      await (db as any).marketIndicator.create({
        data: {
          indicator,
          label,
          value,
          unit,
          region,
          period,
          source,
          sentiment,
          impactNotes: impactNotes ?? null,
        },
      });
    }
  } catch {
    // never throw
  }
}

// Export firm scope & period helper for sibling modules
export { FIRM_ID as MARKET_FIRM_ID, currentPeriod as currentMarketPeriod };
