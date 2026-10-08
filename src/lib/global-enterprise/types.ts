// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — GLOBAL ENTERPRISE OPERATING SYSTEM™
// Type System — Multi-country / multi-entity / multi-currency / multi-tax.
// Founder & Owner: Prince Singh. All values derived from REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Country & Tax System ────────────────────────────────────────────────────

export type TaxSystem =
  | 'gst' // India, Australia
  | 'vat' // EU, UK, UAE, most of world
  | 'sales_tax' // USA
  | 'gst_vat_hybrid' // Canada (GST + provincial VAT)
  | 'none'; // tax-free jurisdictions

export type Region =
  | 'Asia'
  | 'Europe'
  | 'Americas'
  | 'Africa'
  | 'Middle East'
  | 'Oceania';

export type BankingStandard = 'iban' | 'swift_only' | 'local_rails' | 'routing';
export type PayrollCycle = 'monthly' | 'bi_weekly' | 'weekly' | 'semi_monthly';
export type AccountingStandard = 'ifrs' | 'ind_as' | 'us_gaap' | 'local_gaap';

export interface CountryRecord {
  isoCode: string;              // ISO 3166-1 alpha-2
  name: string;
  officialName?: string;
  region: Region;
  taxSystem: TaxSystem;
  currencyCode: string;         // ISO 4217
  currencySymbol?: string;
  currencyDecimals: number;
  language: string;
  timezone: string;
  fiscalYearStart: string;      // MM-DD
  govIdLabels: Record<string, string>;
  bankingStandard: BankingStandard;
  payrollStandard: PayrollCycle;
  accountingStandard: AccountingStandard;
  taxAuthority?: string;
}

export type TaxType =
  | 'gst'
  | 'vat'
  | 'sales_tax'
  | 'corporate'
  | 'payroll'
  | 'customs'
  | 'import_duty'
  | 'withholding'
  | 'digital_service';

export interface TaxRuleRecord {
  id?: string;
  countryIso: string;
  taxType: TaxType;
  taxName: string;
  ratePct: number;
  reducedRatePct: number;
  thresholdAmount: number;
  filingFrequency: 'monthly' | 'quarterly' | 'annually' | 'bi_weekly' | 'weekly' | 'semi_monthly';
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  isActive: boolean;
}

export interface TaxCalculationResult {
  taxType: TaxType;
  taxName: string;
  countryIso: string;
  taxableAmountLocal: number;
  rateAppliedPct: number;
  taxAmountLocal: number;
  taxAmountBase: number;        // converted to INR
  filingFrequency: string;
  notes?: string;
}

// ─── Currency ────────────────────────────────────────────────────────────────

export interface CurrencyRateRecord {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;                 // 1 base = rate quote
  inverseRate: number;          // 1 quote = inverseRate base
  asOfDate: string;             // YYYY-MM-DD
  source: string;
}

export interface CurrencyConversionResult {
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  rateUsed: number;
  asOfDate: string;
  source: string;
}

export interface MultiCurrencySummary {
  totalBase: number;            // INR equivalent
  byCurrency: Array<{
    currency: string;
    localAmount: number;
    baseAmount: number;
    fxRate: number;
    fxAsOf: string;
    pctOfTotal: number;
  }>;
  fxExposureUsd: number;        // total non-base currency exposure in USD
  baseCurrency: string;
  asOfDate: string;
}

// ─── Compliance ──────────────────────────────────────────────────────────────

export type RegulationType =
  | 'tax_filing'
  | 'audit'
  | 'labor'
  | 'corporate'
  | 'financial_reporting'
  | 'privacy'
  | 'gst_return'
  | 'vat_return'
  | 'payroll';

export interface ComplianceDeadlineRecord {
  id?: string;
  countryIso: string;
  regulationType: RegulationType;
  title: string;
  description?: string;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'annually';
  dueDateRule: string;
  penaltyLate?: string;
  authority?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  // Computed (only populated by Compliance Engine, optional elsewhere)
  nextDueDate?: string | null;
  daysUntil?: number | null;
}

export interface ComplianceStatus {
  countryIso: string;
  countryName: string;
  totalDeadlines: number;
  upcomingDeadlines: number;
  criticalOpen: number;
  complianceScore: number;      // 0-100
  nextDeadline?: {
    title: string;
    dueDate: string;
    daysUntil: number;
    riskLevel: string;
  };
  regulations: ComplianceDeadlineRecord[];
}

export interface GlobalComplianceReport {
  overallScore: number;
  totalJurisdictions: number;
  totalDeadlines: number;
  criticalOpen: number;
  byCountry: ComplianceStatus[];
  byRegulationType: Array<{ type: RegulationType; count: number; criticalOpen: number }>;
  oracleNarrative: string;
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export interface TaxBracket {
  from: number;
  to: number | null;            // null = infinity
  rate: number;                 // percent
}

export interface PayrollStructureRecord {
  id?: string;
  countryIso: string;
  structureName: string;
  currencyCode: string;
  payCycle: PayrollCycle;
  minWageMonthly: number;
  socialSecurityEmployerPct: number;
  socialSecurityEmployeePct: number;
  medicareEmployerPct: number;
  medicareEmployeePct: number;
  retirementEmployerPct: number;
  retirementEmployeePct: number;
  annualLeaveDays: number;
  sickLeaveDays: number;
  maternityLeaveDays: number;
  incomeTaxBrackets: TaxBracket[];
  notes?: string;
}

export interface PayrollCalculationResult {
  countryIso: string;
  grossMonthly: number;         // local currency
  currency: string;
  // Employer breakdown
  socialSecurityEmployer: number;
  medicareEmployer: number;
  retirementEmployer: number;
  totalEmployerCost: number;    // gross + employer contributions
  // Employee breakdown
  socialSecurityEmployee: number;
  medicareEmployee: number;
  retirementEmployee: number;
  incomeTax: number;
  netPay: number;               // gross - employee deductions - income tax
  totalDeductions: number;
  effectiveTaxRate: number;     // income tax as % of gross
  totalCostBase: number;        // INR equivalent
}

// ─── Banking ─────────────────────────────────────────────────────────────────

export interface BankAccountRecord {
  id?: string;
  entityId: string;
  countryIso: string;
  accountName: string;
  bankName: string;
  accountNumberMasked: string;
  iban?: string;
  bic?: string;
  routingNumber?: string;
  accountCurrency: string;
  accountType: 'checking' | 'savings' | 'treasury' | 'escrow';
  balanceLocal: number;
  balanceAsOf?: string;
  treasuryPoolId?: string;
  isActive: boolean;
}

export interface TreasurySummary {
  totalCashBase: number;        // INR equivalent
  byCurrency: Array<{
    currency: string;
    accountCount: number;
    totalLocal: number;
    totalBase: number;
    pctOfTotal: number;
  }>;
  byCountry: Array<{
    countryIso: string;
    accountCount: number;
    totalBase: number;
    pctOfTotal: number;
  }>;
  byEntity: Array<{
    entityId: string;
    legalName: string;
    accountCount: number;
    totalBase: number;
    pctOfTotal: number;
  }>;
  cashPools: Array<{
    poolId: string;
    accountCount: number;
    totalBase: number;
  }>;
  currencyExposure: MultiCurrencySummary;
  baseCurrency: string;
  asOfDate: string;
}

// ─── Consolidation ───────────────────────────────────────────────────────────

export type ConsolidationMetric =
  | 'revenue'
  | 'expense'
  | 'profit'
  | 'tax'
  | 'payroll'
  | 'cash_inflow'
  | 'cash_outflow'
  | 'cash_balance'
  | 'assets'
  | 'liabilities'
  | 'equity';

export interface ConsolidationEntryRecord {
  entityId: string;
  entityName: string;
  countryIso: string;
  currency: string;
  period: string;
  metric: ConsolidationMetric;
  valueLocal: number;
  valueBase: number;
  fxRateUsed: number;
  fxRateAsOf: string;
}

export interface ConsolidationReport {
  period: string;
  baseCurrency: string;
  totalRevenue: number;
  totalExpense: number;
  totalProfit: number;
  totalTax: number;
  totalPayroll: number;
  totalCashInflow: number;
  totalCashOutflow: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netCashFlow: number;
  profitMarginPct: number;
  effectiveTaxRatePct: number;
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    currency: string;
    entityCount: number;
    revenue: number;
    expense: number;
    profit: number;
    tax: number;
    payroll: number;
    profitMarginPct: number;
    pctOfGroupRevenue: number;
  }>;
  byEntity: Array<{
    entityId: string;
    legalName: string;
    countryIso: string;
    currency: string;
    ownershipPct: number;
    revenue: number;
    expense: number;
    profit: number;
    consolidatedRevenue: number; // revenue * ownership%
    consolidatedProfit: number;
  }>;
  byMetric: Record<ConsolidationMetric, number>;
  fxImpactBase: number;         // FX translation gain/loss vs prior period
  oracleNarrative: string;
}

// ─── Cross-Border Digital Twin ───────────────────────────────────────────────

export type CrossBorderScenarioType =
  | 'open_country'
  | 'acquire_company'
  | 'hire_global'
  | 'currency_shock'
  | 'tax_change'
  | 'downturn'
  | 'supply_disruption'
  | 'expansion';

export interface CrossBorderScenarioParameters {
  scenarioType: CrossBorderScenarioType;
  targetCountryIso?: string;
  monthsAhead: number;          // projection horizon
  magnitudePct: number;         // shock magnitude (e.g. 10 = +10%)
  investmentAmount?: number;    // for open_country / acquire
  hireCount?: number;           // for hire_global
  hireCountryIso?: string;
  hireRoleBand?: 'junior' | 'mid' | 'senior' | 'executive';
  disruptionSeverity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
}

export interface CrossBorderProjection {
  month: number;                // 1..N
  revenueBase: number;
  expenseBase: number;
  profitBase: number;
  cashFlowBase: number;
  taxLiabilityBase: number;
  riskScore: number;            // 0-100
  complianceScore: number;      // 0-100
}

export interface CrossBorderSimulationResult {
  scenarioType: CrossBorderScenarioType;
  scenarioName: string;
  targetCountryIso?: string;
  horizonMonths: number;
  projections: CrossBorderProjection[];
  cumulativeRevenue: number;
  cumulativeProfit: number;
  cumulativeCashFlow: number;
  cumulativeTaxLiability: number;
  avgRiskScore: number;
  avgComplianceScore: number;
  roiPct: number;
  paybackMonths: number | null;
  verdict: 'proceed' | 'caution' | 'avoid';
  rationale: string;
  complianceImpact: string[];
  recommendedActions: string[];
  methodology: string;
}

// ─── Global AI Executives ────────────────────────────────────────────────────

export type ExecutiveRole =
  | 'ceo'
  | 'cfo'
  | 'coo'
  | 'legal'
  | 'hr'
  | 'marketing'
  | 'operations';

export interface ExecutiveBrief {
  executiveRole: ExecutiveRole;
  briefDate: string;
  headline: string;
  summary: string;
  keyActions: string[];
  risks: string[];
  opportunities: string[];
  confidencePct: number;
  contextScope: 'global' | 'entity' | 'country';
  metrics: Record<string, number | string>;
}

export interface GlobalExecutiveReport {
  asOfDate: string;
  briefs: ExecutiveBrief[];
  crossExecutivePriorities: string[];
  oracleNarrative: string;
}

// ─── Executive Dashboard ─────────────────────────────────────────────────────

export interface GlobalExecutiveDashboard {
  asOfDate: string;
  baseCurrency: string;
  enterprise: {
    totalEntities: number;
    totalCountries: number;
    totalBankAccounts: number;
    totalEmployees: number;
    enterpriseHealthScore: number; // 0-100
  };
  financials: {
    totalRevenueBase: number;
    totalProfitBase: number;
    totalCashBase: number;
    totalTaxExposureBase: number;
    totalPayrollBase: number;
    profitMarginPct: number;
    revenueChangePct: number;     // vs prior period
  };
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    currency: string;
    entityCount: number;
    revenueBase: number;
    profitBase: number;
    cashBase: number;
    payrollBase: number;
    complianceScore: number;
    growthPct: number;
    pctOfGroupRevenue: number;
    flag?: string;
  }>;
  byRegion: Array<{
    region: Region;
    countryCount: number;
    revenueBase: number;
    profitBase: number;
    growthPct: number;
    pctOfGroupRevenue: number;
  }>;
  currencyExposure: MultiCurrencySummary;
  compliance: {
    overallScore: number;
    criticalOpen: number;
    upcomingDeadlines: number;
    topRisks: Array<{ countryIso: string; title: string; riskLevel: string; daysUntil: number }>;
  };
  treasury: TreasurySummary;
  executives: GlobalExecutiveReport;
  oracleNarrative: string;
  contributors: {
    founder: string;
    tagline: string;
  };
}

// ─── Entity Management ───────────────────────────────────────────────────────

export interface EntityRecord {
  id?: string;
  firmId?: string;
  parentEntityId?: string;
  legalName: string;
  tradeName?: string;
  entityKind: 'operating' | 'holding' | 'branch' | 'subsidiary' | 'jv' | 'rep_office';
  countryIso: string;
  registrationNo?: string;
  taxId?: string;
  address?: string;
  baseCurrency: string;
  consolidated: boolean;
  ownershipPct: number;
  status: 'active' | 'dormant' | 'divested';
  metadata?: Record<string, unknown>;
}

export interface EntityTree {
  entity: EntityRecord;
  countryName: string;
  childEntities: EntityTree[];
  bankAccountCount: number;
  revenueBase: number;
  profitBase: number;
}

// ─── Expansion Opportunities ─────────────────────────────────────────────────

export interface ExpansionOpportunity {
  countryIso: string;
  countryName: string;
  region: Region;
  expansionScore: number;        // 0-100
  marketAttractiveness: number;  // 0-100
  regulatoryComplexity: number;  // 0-100 (lower = easier)
  taxBurden: number;             // 0-100 (lower = better)
  easeOfDoingBusiness: number;   // 0-100 (higher = better)
  reasonsFor: string[];
  reasonsAgainst: string[];
  estimatedSetupCostUsd: number;
  estimatedTimeToOperationMonths: number;
  recommendedStructure: 'branch' | 'subsidiary' | 'jv' | 'rep_office';
  keyConsiderations: string[];
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

export interface GlobalApiContext {
  query: URLSearchParams;
  body?: unknown;
}

export interface GlobalApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: {
    endpoint: string;
    responseTimeMs: number;
    cached: boolean;
    asOfDate: string;
  };
}
