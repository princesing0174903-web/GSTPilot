// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Global Tax Engine™ — Country-specific taxation (GST/VAT/SalesTax/Corporate/
// Payroll/Customs/ImportDuty/Withholding/DigitalService). Oracle auto-applies
// correct rule based on entity country.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry, getPrimaryTaxRule, TAX_RULES_REGISTRY } from './registry';
import { convertToBase } from './currency';
import type { TaxType, TaxRuleRecord, TaxCalculationResult } from './types';
import { cacheGet, cacheSet, TTL_PRESETS } from './cache';

// ─── Load tax rules (DB first, registry fallback) ────────────────────────────

export async function getTaxRules(countryIso: string, taxType?: TaxType): Promise<TaxRuleRecord[]> {
  const iso = countryIso.toUpperCase();
  const cacheKey = `tax-rules:${iso}:${taxType ?? 'all'}`;
  const cached = cacheGet<TaxRuleRecord[]>(cacheKey);
  if (cached) return cached.value;

  // DB
  const dbRows = await db.taxRule.findMany({
    where: { countryIso: iso, isActive: true, ...(taxType ? { taxType } : {}) },
  });
  let rules: TaxRuleRecord[];
  if (dbRows.length > 0) {
    rules = dbRows.map((r) => ({
      id: r.id,
      countryIso: r.countryIso,
      taxType: r.taxType as TaxType,
      taxName: r.taxName,
      ratePct: r.ratePct,
      reducedRatePct: r.reducedRatePct,
      thresholdAmount: r.thresholdAmount,
      filingFrequency: r.filingFrequency as 'monthly' | 'quarterly' | 'annually',
      effectiveFrom: r.effectiveFrom ?? undefined,
      effectiveTo: r.effectiveTo ?? undefined,
      notes: r.notes ?? undefined,
      isActive: r.isActive,
    }));
  } else {
    rules = TAX_RULES_REGISTRY.filter(
      (r) => r.countryIso === iso && r.isActive && (!taxType || r.taxType === taxType)
    );
  }
  cacheSet(cacheKey, rules, TTL_PRESETS.COLD);
  return rules;
}

// ─── Apply indirect tax (GST/VAT/SalesTax) to a transaction ─────────────────

export interface IndirectTaxInput {
  countryIso: string;
  amountLocal: number;            // pre-tax (net) amount
  reducedRate?: boolean;          // apply reduced rate (essentials/food)
  isExport?: boolean;             // exports are typically zero-rated
  isInterState?: boolean;         // for India GST inter-state IGST vs CGST+SGST
}

export async function applyIndirectTax(input: IndirectTaxInput): Promise<TaxCalculationResult> {
  const country = getCountry(input.countryIso);
  if (!country) {
    return {
      taxType: 'gst',
      taxName: 'Unknown',
      countryIso: input.countryIso,
      taxableAmountLocal: input.amountLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: 'Unknown country — no tax applied',
    };
  }
  // Exports → zero-rated
  if (input.isExport) {
    const base = await convertToBase(0, country.currencyCode);
    return {
      taxType: country.taxSystem === 'sales_tax' ? 'sales_tax' : country.taxSystem === 'vat' ? 'vat' : 'gst',
      taxName: `${country.taxSystem.toUpperCase()} (Export — Zero-rated)`,
      countryIso: country.isoCode,
      taxableAmountLocal: input.amountLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: 'Exports zero-rated per WTO / country export policy',
    };
  }

  const taxType: TaxType = country.taxSystem === 'sales_tax' ? 'sales_tax' : country.taxSystem === 'vat' ? 'vat' : 'gst';
  const primary = await getTaxRules(country.isoCode, taxType);
  const rule = primary[0] ?? getPrimaryTaxRule(country.isoCode, taxType);

  if (!rule) {
    return {
      taxType,
      taxName: `${country.taxSystem.toUpperCase()} (${country.name})`,
      countryIso: country.isoCode,
      taxableAmountLocal: input.amountLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: `${country.name} has no ${country.taxSystem} — tax not applied`,
    };
  }

  const rateApplied = input.reducedRate ? rule.reducedRatePct : rule.ratePct;
  const taxAmountLocal = (input.amountLocal * rateApplied) / 100;
  const base = await convertToBase(taxAmountLocal, country.currencyCode);

  // India-specific inter-state note
  let notes = rule.notes;
  if (country.isoCode === 'IN' && input.isInterState) {
    notes = 'IGST (integrated — inter-state)';
  } else if (country.isoCode === 'IN' && !input.isInterState) {
    notes = 'CGST 50% + SGST 50% (intra-state split)';
  }

  return {
    taxType: rule.taxType,
    taxName: rule.taxName,
    countryIso: country.isoCode,
    taxableAmountLocal: input.amountLocal,
    rateAppliedPct: rateApplied,
    taxAmountLocal,
    taxAmountBase: base.baseAmount,
    filingFrequency: rule.filingFrequency,
    notes,
  };
}

// ─── Apply corporate tax (annual profit) ─────────────────────────────────────

export interface CorporateTaxInput {
  countryIso: string;
  annualProfitLocal: number;
  isSME?: boolean;                // small/medium enterprise — often reduced rate
}

export async function applyCorporateTax(input: CorporateTaxInput): Promise<TaxCalculationResult> {
  const country = getCountry(input.countryIso);
  if (!country) {
    return {
      taxType: 'corporate',
      taxName: 'Unknown',
      countryIso: input.countryIso,
      taxableAmountLocal: input.annualProfitLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'annually',
      notes: 'Unknown country',
    };
  }
  const rules = await getTaxRules(country.isoCode, 'corporate');
  const rule = rules[0];
  if (!rule) {
    return {
      taxType: 'corporate',
      taxName: `Corporate Tax (${country.name})`,
      countryIso: country.isoCode,
      taxableAmountLocal: input.annualProfitLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'annually',
      notes: `${country.name} has no corporate tax (e.g. tax haven)`,
    };
  }
  // SME threshold check (use rule.thresholdAmount as the SME cutoff)
  const isSME = input.isSME || (rule.thresholdAmount > 0 && input.annualProfitLocal <= rule.thresholdAmount);
  const rateApplied = isSME ? rule.reducedRatePct : rule.ratePct;
  const taxAmountLocal = (input.annualProfitLocal * rateApplied) / 100;
  const base = await convertToBase(taxAmountLocal, country.currencyCode);

  return {
    taxType: 'corporate',
    taxName: rule.taxName,
    countryIso: country.isoCode,
    taxableAmountLocal: input.annualProfitLocal,
    rateAppliedPct: rateApplied,
    taxAmountLocal,
    taxAmountBase: base.baseAmount,
    filingFrequency: rule.filingFrequency,
    notes: isSME && rule.reducedRatePct > 0 ? `SME reduced rate applied (≤ ${rule.thresholdAmount} ${country.currencyCode})` : rule.notes,
  };
}

// ─── Apply withholding tax (TDS/Withholding on payments) ─────────────────────

export interface WithholdingTaxInput {
  countryIso: string;
  paymentAmountLocal: number;
  paymentNature?: 'professional' | 'rent' | 'interest' | 'dividend' | 'royalty' | 'contractor';
}

export async function applyWithholdingTax(input: WithholdingTaxInput): Promise<TaxCalculationResult> {
  const country = getCountry(input.countryIso);
  if (!country) {
    return {
      taxType: 'withholding',
      taxName: 'Unknown',
      countryIso: input.countryIso,
      taxableAmountLocal: input.paymentAmountLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: 'Unknown country',
    };
  }
  const rules = await getTaxRules(country.isoCode, 'withholding');
  const rule = rules[0];
  if (!rule) {
    return {
      taxType: 'withholding',
      taxName: `Withholding Tax (${country.name})`,
      countryIso: country.isoCode,
      taxableAmountLocal: input.paymentAmountLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: `${country.name} has no withholding tax`,
    };
  }
  const taxAmountLocal = (input.paymentAmountLocal * rule.ratePct) / 100;
  const base = await convertToBase(taxAmountLocal, country.currencyCode);

  return {
    taxType: 'withholding',
    taxName: rule.taxName,
    countryIso: country.isoCode,
    taxableAmountLocal: input.paymentAmountLocal,
    rateAppliedPct: rule.ratePct,
    taxAmountLocal,
    taxAmountBase: base.baseAmount,
    filingFrequency: rule.filingFrequency,
    notes: `${input.paymentNature ?? 'payment'} — rate ${rule.ratePct}%`,
  };
}

// ─── Apply customs/import duty ───────────────────────────────────────────────

export interface CustomsDutyInput {
  countryIso: string;
  goodsValueLocal: number;        // CIF value (cost + insurance + freight)
  hsCode?: string;                // for future HS-code-specific rate lookup
}

export async function applyCustomsDuty(input: CustomsDutyInput): Promise<TaxCalculationResult> {
  const country = getCountry(input.countryIso);
  if (!country) {
    return {
      taxType: 'customs',
      taxName: 'Unknown',
      countryIso: input.countryIso,
      taxableAmountLocal: input.goodsValueLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: 'Unknown country',
    };
  }
  const rules = await getTaxRules(country.isoCode, 'customs');
  const customsRule = rules[0];
  // import_duty rule as fallback
  const importRule = (await getTaxRules(country.isoCode, 'import_duty'))[0];
  const rule = customsRule ?? importRule;

  if (!rule) {
    return {
      taxType: 'customs',
      taxName: `Customs Duty (${country.name})`,
      countryIso: country.isoCode,
      taxableAmountLocal: input.goodsValueLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'monthly',
      notes: `${country.name} has no canonical customs rate — HS-code lookup required`,
    };
  }
  const taxAmountLocal = (input.goodsValueLocal * rule.ratePct) / 100;
  const base = await convertToBase(taxAmountLocal, country.currencyCode);

  return {
    taxType: 'customs',
    taxName: rule.taxName,
    countryIso: country.isoCode,
    taxableAmountLocal: input.goodsValueLocal,
    rateAppliedPct: rule.ratePct,
    taxAmountLocal,
    taxAmountBase: base.baseAmount,
    filingFrequency: rule.filingFrequency,
    notes: input.hsCode ? `HS Code ${input.hsCode} — average rate applied` : rule.notes,
  };
}

// ─── Apply digital service tax ───────────────────────────────────────────────

export interface DigitalServiceTaxInput {
  countryIso: string;
  revenueFromDigitalServicesLocal: number;
}

export async function applyDigitalServiceTax(input: DigitalServiceTaxInput): Promise<TaxCalculationResult> {
  const country = getCountry(input.countryIso);
  if (!country) {
    return {
      taxType: 'digital_service',
      taxName: 'Unknown',
      countryIso: input.countryIso,
      taxableAmountLocal: input.revenueFromDigitalServicesLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'quarterly',
      notes: 'Unknown country',
    };
  }
  const rules = await getTaxRules(country.isoCode, 'digital_service');
  const rule = rules[0];
  if (!rule) {
    return {
      taxType: 'digital_service',
      taxName: `Digital Service Tax (${country.name})`,
      countryIso: country.isoCode,
      taxableAmountLocal: input.revenueFromDigitalServicesLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: 'quarterly',
      notes: `${country.name} has no DST`,
    };
  }
  // Threshold check
  if (rule.thresholdAmount > 0 && input.revenueFromDigitalServicesLocal < rule.thresholdAmount) {
    return {
      taxType: 'digital_service',
      taxName: rule.taxName,
      countryIso: country.isoCode,
      taxableAmountLocal: input.revenueFromDigitalServicesLocal,
      rateAppliedPct: 0,
      taxAmountLocal: 0,
      taxAmountBase: 0,
      filingFrequency: rule.filingFrequency,
      notes: `Below threshold (${rule.thresholdAmount} ${country.currencyCode}) — DST not applicable`,
    };
  }
  const taxAmountLocal = (input.revenueFromDigitalServicesLocal * rule.ratePct) / 100;
  const base = await convertToBase(taxAmountLocal, country.currencyCode);

  return {
    taxType: 'digital_service',
    taxName: rule.taxName,
    countryIso: country.isoCode,
    taxableAmountLocal: input.revenueFromDigitalServicesLocal,
    rateAppliedPct: rule.ratePct,
    taxAmountLocal,
    taxAmountBase: base.baseAmount,
    filingFrequency: rule.filingFrequency,
    notes: rule.notes,
  };
}

// ─── Aggregate total tax exposure for an entity ──────────────────────────────

export interface EntityTaxExposure {
  countryIso: string;
  countryName: string;
  currency: string;
  indirectTaxBase: number;        // GST/VAT/SalesTax owed (base INR)
  corporateTaxBase: number;       // estimated corporate tax (base INR)
  withholdingTaxBase: number;     // TDS withheld (base INR)
  customsDutyBase: number;        // import duty (base INR)
  digitalServiceTaxBase: number;  // DST (base INR)
  totalTaxExposureBase: number;   // sum
  primaryTaxSystem: string;
  primaryRatePct: number;
}

export async function computeEntityTaxExposure(
  countryIso: string,
  metrics: {
    revenueLocal: number;
    annualProfitLocal: number;
    paymentsToLocalContractors: number;
    importsCifLocal: number;
    digitalServicesRevenueLocal: number;
  }
): Promise<EntityTaxExposure> {
  const country = getCountry(countryIso);
  if (!country) {
    return {
      countryIso,
      countryName: 'Unknown',
      currency: 'INR',
      indirectTaxBase: 0,
      corporateTaxBase: 0,
      withholdingTaxBase: 0,
      customsDutyBase: 0,
      digitalServiceTaxBase: 0,
      totalTaxExposureBase: 0,
      primaryTaxSystem: 'unknown',
      primaryRatePct: 0,
    };
  }
  const [indirect, corp, wht, customs, dst] = await Promise.all([
    applyIndirectTax({ countryIso, amountLocal: metrics.revenueLocal }),
    applyCorporateTax({ countryIso, annualProfitLocal: metrics.annualProfitLocal }),
    applyWithholdingTax({ countryIso, paymentAmountLocal: metrics.paymentsToLocalContractors, paymentNature: 'professional' }),
    applyCustomsDuty({ countryIso, goodsValueLocal: metrics.importsCifLocal }),
    applyDigitalServiceTax({ countryIso, revenueFromDigitalServicesLocal: metrics.digitalServicesRevenueLocal }),
  ]);
  const total = indirect.taxAmountBase + corp.taxAmountBase + wht.taxAmountBase + customs.taxAmountBase + dst.taxAmountBase;
  return {
    countryIso: country.isoCode,
    countryName: country.name,
    currency: country.currencyCode,
    indirectTaxBase: indirect.taxAmountBase,
    corporateTaxBase: corp.taxAmountBase,
    withholdingTaxBase: wht.taxAmountBase,
    customsDutyBase: customs.taxAmountBase,
    digitalServiceTaxBase: dst.taxAmountBase,
    totalTaxExposureBase: total,
    primaryTaxSystem: country.taxSystem,
    primaryRatePct: indirect.rateAppliedPct,
  };
}
