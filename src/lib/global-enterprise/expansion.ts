// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Expansion Opportunities Engine — Identifies and ranks target countries for
// expansion using market attractiveness, regulatory complexity, tax burden, and
// ease of doing business. Recommendations grounded in REAL enterprise state.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry, listCountries, TAX_RULES_REGISTRY, COMPLIANCE_DEADLINES_REGISTRY } from './registry';
import { getConsolidationReport, currentPeriod } from './consolidation';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import type { ExpansionOpportunity, Region } from './types';

// ─── Country attractiveness scoring ──────────────────────────────────────────
//
// Scores are derived from canonical country + tax + compliance registry data.
// Each country gets 0-100 scores on:
//   - marketAttractiveness: GDP-proxy (currency importance, region, tax system modernity)
//   - regulatoryComplexity: count + risk of compliance deadlines (lower = easier)
//   - taxBurden: aggregate of standard tax rates (lower = better)
//   - easeOfDoingBusiness: banking standard + accounting standard + language coverage
//
// Final expansionScore = weighted blend favouring low complexity + low tax + high market.

interface CountryScores {
  countryIso: string;
  marketAttractiveness: number;
  regulatoryComplexity: number;
  taxBurden: number;
  easeOfDoingBusiness: number;
  expansionScore: number;
}

function scoreMarketAttractiveness(iso: string): number {
  const country = getCountry(iso);
  if (!country) return 30;
  let score = 50;
  // Major economy proxies
  if (['US', 'CN', 'JP', 'DE', 'IN', 'GB', 'FR', 'IT', 'BR', 'CA'].includes(iso)) score += 30;
  else if (['AE', 'SG', 'AU', 'KR', 'ES', 'MX', 'SA', 'NL', 'CH', 'ZA'].includes(iso)) score += 20;
  else score += 10;
  // Region bonus (Asia = high growth)
  if (country.region === 'Asia') score += 8;
  if (country.region === 'Middle East') score += 6;
  // Tax system modernity (GST/VAT = modern, easier compliance)
  if (country.taxSystem === 'gst' || country.taxSystem === 'vat') score += 5;
  if (country.taxSystem === 'sales_tax') score += 3; // fragmented
  // Cap
  return Math.min(100, score);
}

function scoreRegulatoryComplexity(iso: string): number {
  const deadlines = COMPLIANCE_DEADLINES_REGISTRY.filter((d) => d.countryIso === iso && d.isActive);
  if (deadlines.length === 0) return 30;
  const criticalCount = deadlines.filter((d) => d.riskLevel === 'critical').length;
  const highCount = deadlines.filter((d) => d.riskLevel === 'high').length;
  // More deadlines + more critical = higher complexity (worse)
  let score = 30 + deadlines.length * 5 + criticalCount * 8 + highCount * 4;
  return Math.min(100, score);
}

function scoreTaxBurden(iso: string): number {
  const rules = TAX_RULES_REGISTRY.filter((r) => r.countryIso === iso && r.isActive);
  if (rules.length === 0) return 40;
  // Sum standard rates (lower = better)
  const totalRate = rules.reduce((s, r) => s + r.ratePct, 0);
  let score = 30 + totalRate * 0.8;
  // Corporate tax is the heaviest weight
  const corp = rules.find((r) => r.taxType === 'corporate');
  if (corp && corp.ratePct > 25) score += 10;
  if (corp && corp.ratePct < 15) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function scoreEaseOfDoingBusiness(iso: string): number {
  const country = getCountry(iso);
  if (!country) return 40;
  let score = 50;
  // IBAN = modern banking infrastructure
  if (country.bankingStandard === 'iban') score += 15;
  else if (country.bankingStandard === 'routing') score += 10;
  else if (country.bankingStandard === 'local_rails') score -= 5;
  // IFRS = globally accepted
  if (country.accountingStandard === 'ifrs') score += 12;
  else if (country.accountingStandard === 'us_gaap') score += 8;
  // English-speaking advantage
  if (country.language === 'en') score += 10;
  // Monthly payroll = simpler
  if (country.payrollStandard === 'monthly') score += 5;
  return Math.max(0, Math.min(100, score));
}

function computeCountryScores(iso: string): CountryScores {
  const market = scoreMarketAttractiveness(iso);
  const regulatory = scoreRegulatoryComplexity(iso);
  const tax = scoreTaxBurden(iso);
  const ease = scoreEaseOfDoingBusiness(iso);
  // Weighted blend: market 35%, ease 25%, regulatory-inverse 20%, tax-inverse 20%
  const expansionScore = Math.round(
    market * 0.35 +
    ease * 0.25 +
    (100 - regulatory) * 0.20 +
    (100 - tax) * 0.20
  );
  return {
    countryIso: iso,
    marketAttractiveness: market,
    regulatoryComplexity: regulatory,
    taxBurden: tax,
    easeOfDoingBusiness: ease,
    expansionScore,
  };
}

// ─── Get all expansion opportunities ─────────────────────────────────────────

export async function getExpansionOpportunities(
  options?: { firmId?: string; limit?: number; region?: Region; excludeOperating?: boolean }
): Promise<ExpansionOpportunity[]> {
  const limit = options?.limit ?? 15;
  const cacheKey = buildKey('expansion-opportunities', {
    firm: options?.firmId ?? 'all',
    region: options?.region ?? 'all',
    exclude: options?.excludeOperating ? '1' : '0',
    limit,
  });
  const cached = cacheGet<ExpansionOpportunity[]>(cacheKey);
  if (cached) return cached.value;

  // Determine which countries are already operating (from real consolidation)
  let operatingCountries = new Set<string>();
  if (options?.excludeOperating) {
    try {
      const report = await getConsolidationReport(currentPeriod(), options?.firmId);
      operatingCountries = new Set(report.byCountry.map((c) => c.countryIso));
    } catch { /* ignore */ }
  }

  // Score every country in registry
  const allCountries = listCountries().filter((c) => c.isoCode !== 'IN' || !options?.excludeOperating); // keep India as baseline
  const scored = allCountries
    .filter((c) => !operatingCountries.has(c.isoCode))
    .filter((c) => !options?.region || getCountry(c.isoCode)?.region === options.region)
    .map((c) => computeCountryScores(c.isoCode))
    .sort((a, b) => b.expansionScore - a.expansionScore)
    .slice(0, limit);

  const opportunities: ExpansionOpportunity[] = scored.map((s) => {
    const country = getCountry(s.countryIso);
    if (!country) return null;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    if (s.marketAttractiveness >= 70) reasonsFor.push(`Strong market attractiveness (${s.marketAttractiveness}/100)`);
    if (s.easeOfDoingBusiness >= 70) reasonsFor.push(`Easy business environment (${s.easeOfDoingBusiness}/100) — ${country.bankingStandard} banking, ${country.accountingStandard.toUpperCase()} accounting`);
    if (s.taxBurden <= 40) reasonsFor.push(`Competitive tax burden (${s.taxBurden}/100)`);
    if (s.regulatoryComplexity <= 40) reasonsFor.push(`Light regulatory load (${s.regulatoryComplexity}/100)`);
    if (country.taxSystem === 'gst' || country.taxSystem === 'vat') reasonsFor.push(`Modern ${country.taxSystem.toUpperCase()} tax system — familiar to VEYRO`);

    if (s.regulatoryComplexity >= 70) reasonsAgainst.push(`Heavy regulatory complexity (${s.regulatoryComplexity}/100)`);
    if (s.taxBurden >= 70) reasonsAgainst.push(`High tax burden (${s.taxBurden}/100)`);
    if (s.easeOfDoingBusiness <= 40) reasonsAgainst.push(`Challenging business environment (${s.easeOfDoingBusiness}/100)`);
    if (country.bankingStandard === 'local_rails') reasonsAgainst.push('Local-only banking rails — limited international transfer support');

    // Estimate setup cost (derived from regulatory complexity + tax system)
    const baseCostUsd = 25000;
    const regulatoryCost = s.regulatoryComplexity * 1500;
    const bankingCost = country.bankingStandard === 'iban' ? 2000 : country.bankingStandard === 'routing' ? 3000 : 8000;
    const estimatedSetupCostUsd = baseCostUsd + regulatoryCost + bankingCost;

    // Time to operation (derived from complexity)
    const estimatedTimeToOperationMonths = Math.max(2, Math.round(s.regulatoryComplexity / 12));

    // Recommended structure
    let recommendedStructure: 'branch' | 'subsidiary' | 'jv' | 'rep_office';
    if (s.expansionScore >= 75) recommendedStructure = 'subsidiary';
    else if (s.expansionScore >= 55) recommendedStructure = 'branch';
    else if (s.expansionScore >= 40) recommendedStructure = 'jv';
    else recommendedStructure = 'rep_office';

    const keyConsiderations: string[] = [
      `Tax authority: ${country.taxAuthority ?? 'N/A'}`,
      `Fiscal year starts: ${country.fiscalYearStart}`,
      `Payroll cycle: ${country.payrollStandard}`,
      `Banking standard: ${country.bankingStandard}`,
      `Primary language: ${country.language.toUpperCase()}`,
      `Timezone: ${country.timezone}`,
    ];

    return {
      countryIso: country.isoCode,
      countryName: country.name,
      region: country.region,
      expansionScore: s.expansionScore,
      marketAttractiveness: s.marketAttractiveness,
      regulatoryComplexity: s.regulatoryComplexity,
      taxBurden: s.taxBurden,
      easeOfDoingBusiness: s.easeOfDoingBusiness,
      reasonsFor,
      reasonsAgainst,
      estimatedSetupCostUsd,
      estimatedTimeToOperationMonths,
      recommendedStructure,
      keyConsiderations,
    };
  }).filter((o): o is ExpansionOpportunity => o !== null);

  cacheSet(cacheKey, opportunities, TTL_PRESETS.COLD);
  return opportunities;
}

// ─── Get expansion opportunity for one country ───────────────────────────────

export async function getExpansionOpportunity(countryIso: string): Promise<ExpansionOpportunity | null> {
  const iso = countryIso.toUpperCase();
  const country = getCountry(iso);
  if (!country) return null;
  const scores = computeCountryScores(iso);

  const reasonsFor: string[] = [];
  const reasonsAgainst: string[] = [];
  if (scores.marketAttractiveness >= 70) reasonsFor.push(`Strong market attractiveness (${scores.marketAttractiveness}/100)`);
  if (scores.easeOfDoingBusiness >= 70) reasonsFor.push(`Easy business environment (${scores.easeOfDoingBusiness}/100)`);
  if (scores.taxBurden <= 40) reasonsFor.push(`Competitive tax burden (${scores.taxBurden}/100)`);
  if (scores.regulatoryComplexity <= 40) reasonsFor.push(`Light regulatory load (${scores.regulatoryComplexity}/100)`);
  if (scores.regulatoryComplexity >= 70) reasonsAgainst.push(`Heavy regulatory complexity (${scores.regulatoryComplexity}/100)`);
  if (scores.taxBurden >= 70) reasonsAgainst.push(`High tax burden (${scores.taxBurden}/100)`);
  if (scores.easeOfDoingBusiness <= 40) reasonsAgainst.push(`Challenging business environment (${scores.easeOfDoingBusiness}/100)`);

  const estimatedSetupCostUsd = 25000 + scores.regulatoryComplexity * 1500 +
    (country.bankingStandard === 'iban' ? 2000 : country.bankingStandard === 'routing' ? 3000 : 8000);
  const estimatedTimeToOperationMonths = Math.max(2, Math.round(scores.regulatoryComplexity / 12));
  let recommendedStructure: 'branch' | 'subsidiary' | 'jv' | 'rep_office';
  if (scores.expansionScore >= 75) recommendedStructure = 'subsidiary';
  else if (scores.expansionScore >= 55) recommendedStructure = 'branch';
  else if (scores.expansionScore >= 40) recommendedStructure = 'jv';
  else recommendedStructure = 'rep_office';

  return {
    countryIso: country.isoCode,
    countryName: country.name,
    region: country.region,
    expansionScore: scores.expansionScore,
    marketAttractiveness: scores.marketAttractiveness,
    regulatoryComplexity: scores.regulatoryComplexity,
    taxBurden: scores.taxBurden,
    easeOfDoingBusiness: scores.easeOfDoingBusiness,
    reasonsFor,
    reasonsAgainst,
    estimatedSetupCostUsd,
    estimatedTimeToOperationMonths,
    recommendedStructure,
    keyConsiderations: [
      `Tax authority: ${country.taxAuthority ?? 'N/A'}`,
      `Fiscal year starts: ${country.fiscalYearStart}`,
      `Payroll cycle: ${country.payrollStandard}`,
      `Banking standard: ${country.bankingStandard}`,
      `Primary language: ${country.language.toUpperCase()}`,
      `Timezone: ${country.timezone}`,
    ],
  };
}

// ─── Operating footprint summary ─────────────────────────────────────────────

export async function getOperatingFootprint(firmId?: string): Promise<{
  totalCountries: number;
  totalEntities: number;
  totalBankAccounts: number;
  countries: Array<{
    iso: string;
    name: string;
    region: string;
    entityCount: number;
    bankAccountCount: number;
    revenueBase: number;
  }>;
  regions: Array<{ region: Region; countryCount: number; revenueBase: number }>;
}> {
  try {
    const [entities, bankAccounts, consolidation] = await Promise.all([
      db.globalEntity.findMany({
        where: { ...(firmId ? { firmId } : {}), status: { not: 'divested' } },
        include: { country: true },
      }),
      db.bankAccount.findMany({
        where: { isActive: true },
        select: { countryIso: true, entityId: true },
      }),
      getConsolidationReport(currentPeriod(), firmId).catch(() => null),
    ]);

    const countryMap = new Map<string, { iso: string; name: string; region: string; entityCount: number; bankAccountCount: number; revenueBase: number }>();
    for (const e of entities) {
      const existing = countryMap.get(e.countryIso) ?? {
        iso: e.countryIso,
        name: e.country?.name ?? e.countryIso,
        region: e.country?.region ?? 'Asia',
        entityCount: 0,
        bankAccountCount: 0,
        revenueBase: 0,
      };
      existing.entityCount += 1;
      countryMap.set(e.countryIso, existing);
    }
    for (const b of bankAccounts) {
      const existing = countryMap.get(b.countryIso);
      if (existing) existing.bankAccountCount += 1;
    }
    if (consolidation) {
      for (const c of consolidation.byCountry) {
        const existing = countryMap.get(c.countryIso);
        if (existing) existing.revenueBase = c.revenue;
      }
    }

    const countries = Array.from(countryMap.values()).sort((a, b) => b.revenueBase - a.revenueBase);
    const regionMap = new Map<Region, { countryCount: number; revenueBase: number }>();
    for (const c of countries) {
      const r = c.region as Region;
      const e = regionMap.get(r) ?? { countryCount: 0, revenueBase: 0 };
      e.countryCount += 1;
      e.revenueBase += c.revenueBase;
      regionMap.set(r, e);
    }
    const regions = Array.from(regionMap.entries())
      .map(([region, v]) => ({ region, ...v }))
      .sort((a, b) => b.revenueBase - a.revenueBase);

    return {
      totalCountries: countries.length,
      totalEntities: entities.length,
      totalBankAccounts: bankAccounts.length,
      countries,
      regions,
    };
  } catch (err) {
    console.error('[expansion] footprint error:', err);
    return { totalCountries: 0, totalEntities: 0, totalBankAccounts: 0, countries: [], regions: [] };
  }
}
