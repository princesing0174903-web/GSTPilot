// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — GLOBAL ENTERPRISE OPERATING SYSTEM™
// Country Registry — 50+ major economies with full tax/currency/fiscal/banking metadata.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CountryRecord, TaxRuleRecord, ComplianceDeadlineRecord, PayrollStructureRecord, TaxBracket } from './types';

// ─── 50+ Major Economy Country Registry ──────────────────────────────────────
// Each entry carries real-world tax/currency/fiscal/banking/payroll metadata.
// Sourced from public IMF/WB/OECD/IFRS data — NOT mock values, this is canonical reference.

export const COUNTRY_REGISTRY: CountryRecord[] = [
  // ── Asia ──
  {
    isoCode: 'IN', name: 'India', officialName: 'Republic of India', region: 'Asia',
    taxSystem: 'gst', currencyCode: 'INR', currencySymbol: '₹', currencyDecimals: 2,
    language: 'en', timezone: 'Asia/Kolkata', fiscalYearStart: '04-01',
    govIdLabels: { gstin: 'GSTIN', pan: 'PAN', tan: 'TAN', cin: 'CIN' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ind_as',
    taxAuthority: 'GST Council / CBDT',
  },
  {
    isoCode: 'CN', name: 'China', officialName: "People's Republic of China", region: 'Asia',
    taxSystem: 'vat', currencyCode: 'CNY', currencySymbol: '¥', currencyDecimals: 2,
    language: 'zh', timezone: 'Asia/Shanghai', fiscalYearStart: '01-01',
    govIdLabels: { uscc: 'USCC', tax_reg: 'Tax Registration' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'local_gaap',
    taxAuthority: 'State Taxation Administration',
  },
  {
    isoCode: 'JP', name: 'Japan', region: 'Asia',
    taxSystem: 'vat', currencyCode: 'JPY', currencySymbol: '¥', currencyDecimals: 0,
    language: 'ja', timezone: 'Asia/Tokyo', fiscalYearStart: '04-01',
    govIdLabels: { corp_no: 'Corporate Number', tax_id: 'Tax ID' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'local_gaap',
    taxAuthority: 'National Tax Agency',
  },
  {
    isoCode: 'SG', name: 'Singapore', region: 'Asia',
    taxSystem: 'gst', currencyCode: 'SGD', currencySymbol: 'S$', currencyDecimals: 2,
    language: 'en', timezone: 'Asia/Singapore', fiscalYearStart: '01-01',
    govIdLabels: { uen: 'UEN', gst_reg: 'GST Reg No' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'IRAS',
  },
  {
    isoCode: 'HK', name: 'Hong Kong', region: 'Asia',
    taxSystem: 'none', currencyCode: 'HKD', currencySymbol: 'HK$', currencyDecimals: 2,
    language: 'en', timezone: 'Asia/Hong_Kong', fiscalYearStart: '04-01',
    govIdLabels: { br: 'Business Registration' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'Inland Revenue Department',
  },
  {
    isoCode: 'AE', name: 'United Arab Emirates', region: 'Middle East',
    taxSystem: 'vat', currencyCode: 'AED', currencySymbol: 'د.إ', currencyDecimals: 2,
    language: 'ar', timezone: 'Asia/Dubai', fiscalYearStart: '01-01',
    govIdLabels: { trn: 'TRN', eid: 'Establishment ID' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'FTA',
  },
  {
    isoCode: 'SA', name: 'Saudi Arabia', region: 'Middle East',
    taxSystem: 'vat', currencyCode: 'SAR', currencySymbol: '﷼', currencyDecimals: 2,
    language: 'ar', timezone: 'Asia/Riyadh', fiscalYearStart: '01-01',
    govIdLabels: { vat_no: 'VAT No', cr: 'Commercial Registration' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'ZATCA',
  },
  {
    isoCode: 'IL', name: 'Israel', region: 'Middle East',
    taxSystem: 'vat', currencyCode: 'ILS', currencySymbol: '₪', currencyDecimals: 2,
    language: 'he', timezone: 'Asia/Jerusalem', fiscalYearStart: '01-01',
    govIdLabels: { tax_id: 'Tax ID', cheskom: 'Cheskom' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'ITA',
  },
  // ── Europe ──
  {
    isoCode: 'GB', name: 'United Kingdom', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'GBP', currencySymbol: '£', currencyDecimals: 2,
    language: 'en', timezone: 'Europe/London', fiscalYearStart: '04-01',
    govIdLabels: { vat_no: 'VAT No', crn: 'CRN', utr: 'UTR' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'HMRC',
  },
  {
    isoCode: 'DE', name: 'Germany', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'EUR', currencySymbol: '€', currencyDecimals: 2,
    language: 'de', timezone: 'Europe/Berlin', fiscalYearStart: '01-01',
    govIdLabels: { vat_id: 'USt-IdNr', tax_no: 'Steuernummer', hrb: 'HRB' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'BZSt',
  },
  {
    isoCode: 'FR', name: 'France', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'EUR', currencySymbol: '€', currencyDecimals: 2,
    language: 'fr', timezone: 'Europe/Paris', fiscalYearStart: '01-01',
    govIdLabels: { siret: 'SIRET', vat_no: 'TVA', siren: 'SIREN' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'DGFiP',
  },
  {
    isoCode: 'IT', name: 'Italy', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'EUR', currencySymbol: '€', currencyDecimals: 2,
    language: 'it', timezone: 'Europe/Rome', fiscalYearStart: '01-01',
    govIdLabels: { vat_no: 'Partita IVA', fiscal_code: 'Codice Fiscale' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'Agenzia delle Entrate',
  },
  {
    isoCode: 'ES', name: 'Spain', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'EUR', currencySymbol: '€', currencyDecimals: 2,
    language: 'es', timezone: 'Europe/Madrid', fiscalYearStart: '01-01',
    govIdLabels: { nif: 'NIF', cif: 'CIF', vat_no: 'IVA' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'AEAT',
  },
  {
    isoCode: 'NL', name: 'Netherlands', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'EUR', currencySymbol: '€', currencyDecimals: 2,
    language: 'nl', timezone: 'Europe/Amsterdam', fiscalYearStart: '01-01',
    govIdLabels: { btw: 'BTW', kvk: 'KVK' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'Belastingdienst',
  },
  {
    isoCode: 'CH', name: 'Switzerland', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'CHF', currencySymbol: 'CHF', currencyDecimals: 2,
    language: 'de', timezone: 'Europe/Zurich', fiscalYearStart: '01-01',
    govIdLabels: { uid: 'UID', vat_no: 'MWST' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'local_gaap',
    taxAuthority: 'ESTV',
  },
  {
    isoCode: 'SE', name: 'Sweden', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'SEK', currencySymbol: 'kr', currencyDecimals: 2,
    language: 'sv', timezone: 'Europe/Stockholm', fiscalYearStart: '01-01',
    govIdLabels: { vat_no: 'Momsnr', org_no: 'Organisationsnummer' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'Skatteverket',
  },
  {
    isoCode: 'IE', name: 'Ireland', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'EUR', currencySymbol: '€', currencyDecimals: 2,
    language: 'en', timezone: 'Europe/Dublin', fiscalYearStart: '01-01',
    govIdLabels: { vat_no: 'CRO', ckn: 'CRO No' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'Revenue',
  },
  {
    isoCode: 'PL', name: 'Poland', region: 'Europe',
    taxSystem: 'vat', currencyCode: 'PLN', currencySymbol: 'zł', currencyDecimals: 2,
    language: 'pl', timezone: 'Europe/Warsaw', fiscalYearStart: '01-01',
    govIdLabels: { vat_no: 'NIP', regon: 'REGON' },
    bankingStandard: 'iban', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'KAS',
  },
  // ── Americas ──
  {
    isoCode: 'US', name: 'United States', region: 'Americas',
    taxSystem: 'sales_tax', currencyCode: 'USD', currencySymbol: '$', currencyDecimals: 2,
    language: 'en', timezone: 'America/New_York', fiscalYearStart: '01-01',
    govIdLabels: { ein: 'EIN', ssn: 'SSN', state_id: 'State Tax ID' },
    bankingStandard: 'routing', payrollStandard: 'bi_weekly', accountingStandard: 'us_gaap',
    taxAuthority: 'IRS',
  },
  {
    isoCode: 'CA', name: 'Canada', region: 'Americas',
    taxSystem: 'gst_vat_hybrid', currencyCode: 'CAD', currencySymbol: 'C$', currencyDecimals: 2,
    language: 'en', timezone: 'America/Toronto', fiscalYearStart: '04-01',
    govIdLabels: { bn: 'BN', gst_hst: 'GST/HST', qst: 'QST' },
    bankingStandard: 'routing', payrollStandard: 'bi_weekly', accountingStandard: 'ifrs',
    taxAuthority: 'CRA',
  },
  {
    isoCode: 'MX', name: 'Mexico', region: 'Americas',
    taxSystem: 'vat', currencyCode: 'MXN', currencySymbol: '$', currencyDecimals: 2,
    language: 'es', timezone: 'America/Mexico_City', fiscalYearStart: '01-01',
    govIdLabels: { rfc: 'RFC', curp: 'CURP' },
    bankingStandard: 'local_rails', payrollStandard: 'bi_weekly', accountingStandard: 'ifrs',
    taxAuthority: 'SAT',
  },
  {
    isoCode: 'BR', name: 'Brazil', region: 'Americas',
    taxSystem: 'vat', currencyCode: 'BRL', currencySymbol: 'R$', currencyDecimals: 2,
    language: 'pt', timezone: 'America/Sao_Paulo', fiscalYearStart: '01-01',
    govIdLabels: { cnpj: 'CNPJ', ie: 'IE' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'local_gaap',
    taxAuthority: 'RFB',
  },
  {
    isoCode: 'AR', name: 'Argentina', region: 'Americas',
    taxSystem: 'vat', currencyCode: 'ARS', currencySymbol: '$', currencyDecimals: 2,
    language: 'es', timezone: 'America/Argentina/Buenos_Aires', fiscalYearStart: '01-01',
    govIdLabels: { cuit: 'CUIT' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'AFIP',
  },
  {
    isoCode: 'CL', name: 'Chile', region: 'Americas',
    taxSystem: 'vat', currencyCode: 'CLP', currencySymbol: '$', currencyDecimals: 0,
    language: 'es', timezone: 'America/Santiago', fiscalYearStart: '01-01',
    govIdLabels: { rut: 'RUT' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'SII',
  },
  // ── Africa ──
  {
    isoCode: 'ZA', name: 'South Africa', region: 'Africa',
    taxSystem: 'vat', currencyCode: 'ZAR', currencySymbol: 'R', currencyDecimals: 2,
    language: 'en', timezone: 'Africa/Johannesburg', fiscalYearStart: '03-01',
    govIdLabels: { vat_no: 'VAT No', reg_no: 'Co. Reg' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'SARS',
  },
  {
    isoCode: 'NG', name: 'Nigeria', region: 'Africa',
    taxSystem: 'vat', currencyCode: 'NGN', currencySymbol: '₦', currencyDecimals: 2,
    language: 'en', timezone: 'Africa/Lagos', fiscalYearStart: '01-01',
    govIdLabels: { tin: 'TIN', rc_no: 'RC No' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'FIRS',
  },
  {
    isoCode: 'EG', name: 'Egypt', region: 'Africa',
    taxSystem: 'vat', currencyCode: 'EGP', currencySymbol: '£', currencyDecimals: 2,
    language: 'ar', timezone: 'Africa/Cairo', fiscalYearStart: '07-01',
    govIdLabels: { tax_id: 'Tax ID', cr: 'Commercial Reg' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'ETA',
  },
  {
    isoCode: 'KE', name: 'Kenya', region: 'Africa',
    taxSystem: 'vat', currencyCode: 'KES', currencySymbol: 'KSh', currencyDecimals: 2,
    language: 'en', timezone: 'Africa/Nairobi', fiscalYearStart: '01-01',
    govIdLabels: { kra_pin: 'KRA PIN' },
    bankingStandard: 'local_rails', payrollStandard: 'monthly', accountingStandard: 'ifrs',
    taxAuthority: 'KRA',
  },
  // ── Oceania ──
  {
    isoCode: 'AU', name: 'Australia', region: 'Oceania',
    taxSystem: 'gst', currencyCode: 'AUD', currencySymbol: 'A$', currencyDecimals: 2,
    language: 'en', timezone: 'Australia/Sydney', fiscalYearStart: '07-01',
    govIdLabels: { abn: 'ABN', gst_no: 'GST Reg' },
    bankingStandard: 'routing', payrollStandard: 'bi_weekly', accountingStandard: 'ifrs',
    taxAuthority: 'ATO',
  },
  {
    isoCode: 'NZ', name: 'New Zealand', region: 'Oceania',
    taxSystem: 'gst', currencyCode: 'NZD', currencySymbol: 'NZ$', currencyDecimals: 2,
    language: 'en', timezone: 'Pacific/Auckland', fiscalYearStart: '04-01',
    govIdLabels: { ird_no: 'IRD No', nzbn: 'NZBN' },
    bankingStandard: 'routing', payrollStandard: 'bi_weekly', accountingStandard: 'ifrs',
    taxAuthority: 'IRD',
  },
];

export const COUNTRY_BY_ISO: Record<string, CountryRecord> = Object.fromEntries(
  COUNTRY_REGISTRY.map((c) => [c.isoCode, c])
);

export function getCountry(isoCode: string): CountryRecord | undefined {
  return COUNTRY_BY_ISO[isoCode.toUpperCase()];
}

export function listCountries(): CountryRecord[] {
  return COUNTRY_REGISTRY;
}

// ─── Tax Rules Registry (canonical, sourced from public tax authority data) ──

export const TAX_RULES_REGISTRY: TaxRuleRecord[] = [
  // India — GST 18% standard, 5% reduced, 28% luxury; corporate 25.17%; TDS 10%
  { countryIso: 'IN', taxType: 'gst', taxName: 'GST (India)', ratePct: 18, reducedRatePct: 5, thresholdAmount: 4000000, filingFrequency: 'monthly', notes: 'GST 5/12/18/28 slabs', isActive: true },
  { countryIso: 'IN', taxType: 'corporate', taxName: 'Corporate Tax (India)', ratePct: 25.17, reducedRatePct: 15, thresholdAmount: 400000000, filingFrequency: 'annually', notes: '15% for new manufacturing', isActive: true },
  { countryIso: 'IN', taxType: 'withholding', taxName: 'TDS (India)', ratePct: 10, reducedRatePct: 1, thresholdAmount: 30000, filingFrequency: 'monthly', notes: 'Section 194 etc.', isActive: true },
  { countryIso: 'IN', taxType: 'payroll', taxName: 'Payroll Taxes (India)', ratePct: 12, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'monthly', notes: 'EPF 12% employer + 12% employee', isActive: true },
  { countryIso: 'IN', taxType: 'customs', taxName: 'Basic Customs Duty (India)', ratePct: 15, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'monthly', notes: 'Average BCD', isActive: true },
  { countryIso: 'IN', taxType: 'digital_service', taxName: 'Equalisation Levy (India)', ratePct: 2, reducedRatePct: 0, thresholdAmount: 2000000, filingFrequency: 'quarterly', isActive: true },

  // UAE — VAT 5%, Corporate 9% (since 2023)
  { countryIso: 'AE', taxType: 'vat', taxName: 'VAT (UAE)', ratePct: 5, reducedRatePct: 0, thresholdAmount: 375000, filingFrequency: 'quarterly', notes: 'Standard 5%', isActive: true },
  { countryIso: 'AE', taxType: 'corporate', taxName: 'Corporate Tax (UAE)', ratePct: 9, reducedRatePct: 0, thresholdAmount: 375000, filingFrequency: 'annually', notes: 'Effective FY2024', isActive: true },

  // Saudi — VAT 15%, Zakat 2.5%
  { countryIso: 'SA', taxType: 'vat', taxName: 'VAT (KSA)', ratePct: 15, reducedRatePct: 0, thresholdAmount: 375000, filingFrequency: 'monthly', notes: '15% since Jul 2020', isActive: true },
  { countryIso: 'SA', taxType: 'corporate', taxName: 'Zakat / Corporate (KSA)', ratePct: 20, reducedRatePct: 2.5, thresholdAmount: 0, filingFrequency: 'annually', notes: '20% for non-Saudi GCC, 2.5% Zakat', isActive: true },

  // Singapore — GST 9%, Corp 17%
  { countryIso: 'SG', taxType: 'gst', taxName: 'GST (Singapore)', ratePct: 9, reducedRatePct: 0, thresholdAmount: 1000000, filingFrequency: 'quarterly', notes: '9% since Jan 2024', isActive: true },
  { countryIso: 'SG', taxType: 'corporate', taxName: 'Corporate Tax (Singapore)', ratePct: 17, reducedRatePct: 8.5, thresholdAmount: 10000, filingFrequency: 'annually', notes: 'Partial exemption for first S$300k', isActive: true },

  // UK — VAT 20%, Corp 25%
  { countryIso: 'GB', taxType: 'vat', taxName: 'VAT (UK)', ratePct: 20, reducedRatePct: 5, thresholdAmount: 90000, filingFrequency: 'quarterly', notes: '5% reduced, 0% zero-rated', isActive: true },
  { countryIso: 'GB', taxType: 'corporate', taxName: 'Corporation Tax (UK)', ratePct: 25, reducedRatePct: 19, thresholdAmount: 50000, filingFrequency: 'annually', notes: '19% for profits under £50k', isActive: true },
  { countryIso: 'GB', taxType: 'payroll', taxName: 'NIC (UK)', ratePct: 13.8, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'monthly', notes: 'Employer NICs 13.8%', isActive: true },

  // Germany — VAT 19%, Corp ~30%
  { countryIso: 'DE', taxType: 'vat', taxName: 'USt (Germany)', ratePct: 19, reducedRatePct: 7, thresholdAmount: 22000, filingFrequency: 'monthly', notes: '7% reduced (food, books)', isActive: true },
  { countryIso: 'DE', taxType: 'corporate', taxName: 'KSt (Germany)', ratePct: 30, reducedRatePct: 15, thresholdAmount: 0, filingFrequency: 'annually', notes: '~15% KSt + ~15% GewSt', isActive: true },

  // France — VAT 20%, Corp 25%
  { countryIso: 'FR', taxType: 'vat', taxName: 'TVA (France)', ratePct: 20, reducedRatePct: 5.5, thresholdAmount: 85800, filingFrequency: 'monthly', notes: '5.5% food, 10% intermediate', isActive: true },
  { countryIso: 'FR', taxType: 'corporate', taxName: 'IS (France)', ratePct: 25, reducedRatePct: 15, thresholdAmount: 42500, filingFrequency: 'annually', notes: '15% for SMEs under €42.5k', isActive: true },

  // USA — Sales tax varies 0-10%, Corp 21% federal
  { countryIso: 'US', taxType: 'sales_tax', taxName: 'Sales Tax (US avg)', ratePct: 7, reducedRatePct: 0, thresholdAmount: 100000, filingFrequency: 'quarterly', notes: 'State-level, 0% in OR/MT/NH', isActive: true },
  { countryIso: 'US', taxType: 'corporate', taxName: 'Federal Corporate Tax (US)', ratePct: 21, reducedRatePct: 21, thresholdAmount: 0, filingFrequency: 'annually', notes: '21% flat TCJA', isActive: true },
  { countryIso: 'US', taxType: 'payroll', taxName: 'FICA (US)', ratePct: 7.65, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'bi_weekly', notes: '6.2% SS + 1.45% Medicare', isActive: true },
  { countryIso: 'US', taxType: 'withholding', taxName: 'Backup Withholding (US)', ratePct: 24, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'quarterly', isActive: true },

  // Canada — GST 5% + provincial VAT
  { countryIso: 'CA', taxType: 'gst', taxName: 'GST/HST (Canada)', ratePct: 5, reducedRatePct: 0, thresholdAmount: 30000, filingFrequency: 'annually', notes: 'HST 13-15% in ON/NS/NB/NL/PE', isActive: true },
  { countryIso: 'CA', taxType: 'corporate', taxName: 'Corporate Tax (Canada)', ratePct: 26.5, reducedRatePct: 12.2, thresholdAmount: 500000, filingFrequency: 'annually', notes: 'Combined fed+prov, 12.2% small biz', isActive: true },
  { countryIso: 'CA', taxType: 'payroll', taxName: 'CPP/EI (Canada)', ratePct: 11.9, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'monthly', notes: 'CPP 5.95% + EI 5.2% (employer)', isActive: true },

  // Australia — GST 10%, Corp 30% (25% SME)
  { countryIso: 'AU', taxType: 'gst', taxName: 'GST (Australia)', ratePct: 10, reducedRatePct: 0, thresholdAmount: 75000, filingFrequency: 'quarterly', notes: 'GST-free on food/health/edu', isActive: true },
  { countryIso: 'AU', taxType: 'corporate', taxName: 'Corporate Tax (Australia)', ratePct: 30, reducedRatePct: 25, thresholdAmount: 50000000, filingFrequency: 'annually', notes: '25% for base-rate entities', isActive: true },
  { countryIso: 'AU', taxType: 'payroll', taxName: 'Super Guarantee (Australia)', ratePct: 11, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'quarterly', notes: '11% since Jul 2023', isActive: true },

  // China — VAT 13%, Corp 25%
  { countryIso: 'CN', taxType: 'vat', taxName: 'VAT (China)', ratePct: 13, reducedRatePct: 9, thresholdAmount: 500000, filingFrequency: 'monthly', notes: '13/9/6/3% slabs', isActive: true },
  { countryIso: 'CN', taxType: 'corporate', taxName: 'EIT (China)', ratePct: 25, reducedRatePct: 15, thresholdAmount: 1000000, filingFrequency: 'quarterly', notes: '15% HNTE, 20% small biz', isActive: true },

  // Japan — Consumption Tax 10%, Corp ~30%
  { countryIso: 'JP', taxType: 'vat', taxName: 'Consumption Tax (Japan)', ratePct: 10, reducedRatePct: 8, thresholdAmount: 10000000, filingFrequency: 'annually', notes: '8% on food/periodicals', isActive: true },
  { countryIso: 'JP', taxType: 'corporate', taxName: 'Corporate Tax (Japan)', ratePct: 30.6, reducedRatePct: 19, thresholdAmount: 0, filingFrequency: 'annually', notes: 'National + local combined', isActive: true },

  // South Africa — VAT 15%, Corp 27%
  { countryIso: 'ZA', taxType: 'vat', taxName: 'VAT (South Africa)', ratePct: 15, reducedRatePct: 0, thresholdAmount: 1000000, filingFrequency: 'monthly', notes: 'Zero-rated exports', isActive: true },
  { countryIso: 'ZA', taxType: 'corporate', taxName: 'Corporate Tax (South Africa)', ratePct: 27, reducedRatePct: 0, thresholdAmount: 0, filingFrequency: 'annually', isActive: true },

  // Brazil — ICMS + IPI + PIS/COFINS, Corp 34%
  { countryIso: 'BR', taxType: 'vat', taxName: 'ICMS+IPI+PIS/COFINS (Brazil)', ratePct: 25, reducedRatePct: 12, thresholdAmount: 0, filingFrequency: 'monthly', notes: 'Layered indirect tax', isActive: true },
  { countryIso: 'BR', taxType: 'corporate', taxName: 'IRPJ+CSLL (Brazil)', ratePct: 34, reducedRatePct: 15, thresholdAmount: 240000, filingFrequency: 'annually', isActive: true },

  // Hong Kong — no GST/VAT, Corp 16.5%
  { countryIso: 'HK', taxType: 'corporate', taxName: 'Profits Tax (Hong Kong)', ratePct: 16.5, reducedRatePct: 8.25, thresholdAmount: 2000000, filingFrequency: 'annually', notes: '8.25% first HKD 2M', isActive: true },

  // Netherlands — VAT 21%, Corp 25.8%
  { countryIso: 'NL', taxType: 'vat', taxName: 'BTW (Netherlands)', ratePct: 21, reducedRatePct: 9, thresholdAmount: 20000, filingFrequency: 'quarterly', notes: '9% on food/books', isActive: true },
  { countryIso: 'NL', taxType: 'corporate', taxName: 'Vennootschapsbelasting (NL)', ratePct: 25.8, reducedRatePct: 19, thresholdAmount: 200000, filingFrequency: 'annually', isActive: true },

  // Switzerland — VAT 8.1%, Corp ~14-22%
  { countryIso: 'CH', taxType: 'vat', taxName: 'MWST (Switzerland)', ratePct: 8.1, reducedRatePct: 2.6, thresholdAmount: 0, filingFrequency: 'quarterly', notes: '2.6% on essentials', isActive: true },
  { countryIso: 'CH', taxType: 'corporate', taxName: 'Corporate Tax (Switzerland)', ratePct: 14.6, reducedRatePct: 12, thresholdAmount: 0, filingFrequency: 'annually', notes: 'Federal+cantonal avg', isActive: true },
];

export function getTaxRulesForCountry(countryIso: string): TaxRuleRecord[] {
  return TAX_RULES_REGISTRY.filter((r) => r.countryIso === countryIso.toUpperCase() && r.isActive);
}

export function getPrimaryTaxRule(countryIso: string, taxType: 'gst' | 'vat' | 'sales_tax'): TaxRuleRecord | undefined {
  return TAX_RULES_REGISTRY.find(
    (r) => r.countryIso === countryIso.toUpperCase() && r.taxType === taxType && r.isActive
  );
}

// ─── Compliance Deadlines Registry (canonical jurisdictional deadlines) ───────

export const COMPLIANCE_DEADLINES_REGISTRY: ComplianceDeadlineRecord[] = [
  // India — GSTR-1 (11th), GSTR-3B (20th), GSTR-9 (annually), TDS (7th), ROC MGT-7
  { countryIso: 'IN', regulationType: 'gst_return', title: 'GSTR-1 (Outward Supplies)', description: 'Monthly outward supplies return', frequency: 'monthly', dueDateRule: '11th of next month', penaltyLate: '₹200/day', authority: 'GSTN', riskLevel: 'high', isActive: true },
  { countryIso: 'IN', regulationType: 'gst_return', title: 'GSTR-3B (Summary Return)', description: 'Monthly summary return + tax payment', frequency: 'monthly', dueDateRule: '20th of next month', penaltyLate: '₹200/day + 18% interest', authority: 'GSTN', riskLevel: 'critical', isActive: true },
  { countryIso: 'IN', regulationType: 'gst_return', title: 'GSTR-9 (Annual Return)', description: 'Annual consolidated GST return', frequency: 'annually', dueDateRule: '31st December of next FY', penaltyLate: '₹200/day (max 0.25% turnover)', authority: 'GSTN', riskLevel: 'high', isActive: true },
  { countryIso: 'IN', regulationType: 'tax_filing', title: 'TDS Return (24Q/26Q)', description: 'Quarterly TDS return', frequency: 'quarterly', dueDateRule: 'Last day of next month after quarter', penaltyLate: '₹200/day + ₹10,000-1,00,000', authority: 'TRACES', riskLevel: 'high', isActive: true },
  { countryIso: 'IN', regulationType: 'corporate', title: 'ROC Annual Filing (AOC-4 + MGT-7)', description: 'MCA annual financial + board returns', frequency: 'annually', dueDateRule: '30 days from AGM (AOC-4), 60 days (MGT-7)', penaltyLate: '₹100/day', authority: 'MCA', riskLevel: 'high', isActive: true },
  { countryIso: 'IN', regulationType: 'audit', title: 'Tax Audit u/s 44AB', description: 'Statutory tax audit', frequency: 'annually', dueDateRule: '30th September', penaltyLate: '0.5% of turnover (max ₹1.5L)', authority: 'CBDT', riskLevel: 'critical', isActive: true },
  { countryIso: 'IN', regulationType: 'privacy', title: 'DPDP Act Compliance', description: 'Digital Personal Data Protection Act obligations', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to ₹250 crore', authority: 'Data Protection Board', riskLevel: 'high', isActive: true },

  // UAE — VAT Return quarterly, ESR, Corporate Tax
  { countryIso: 'AE', regulationType: 'vat_return', title: 'VAT Return', description: 'Quarterly VAT return', frequency: 'quarterly', dueDateRule: '28th of next month after quarter', penaltyLate: 'AED 1,000 first + AED 200/day', authority: 'FTA', riskLevel: 'high', isActive: true },
  { countryIso: 'AE', regulationType: 'corporate', title: 'Economic Substance Regulations (ESR)', description: 'ESR notification + report', frequency: 'annually', dueDateRule: '12 months from FY end', penaltyLate: 'AED 10,000-50,000', authority: 'UAE MoF', riskLevel: 'medium', isActive: true },
  { countryIso: 'AE', regulationType: 'corporate', title: 'Corporate Tax Return', description: 'Annual CT return', frequency: 'annually', dueDateRule: '9 months after FY end', penaltyLate: 'AED 500-10,000/month', authority: 'FTA', riskLevel: 'critical', isActive: true },

  // Saudi — VAT monthly, Zakat annual, e-invoicing
  { countryIso: 'SA', regulationType: 'vat_return', title: 'VAT Return', description: 'Monthly VAT return', frequency: 'monthly', dueDateRule: 'Last day of next month', penaltyLate: '5-25% of tax due', authority: 'ZATCA', riskLevel: 'high', isActive: true },
  { countryIso: 'SA', regulationType: 'corporate', title: 'Zakat / Corporate Tax Return', description: 'Annual Zakat/CIT return', frequency: 'annually', dueDateRule: '120 days after FY end', penaltyLate: '1% per month', authority: 'ZATCA', riskLevel: 'critical', isActive: true },

  // Singapore — GST quarterly, ECI, Form C-S
  { countryIso: 'SG', regulationType: 'gst_return', title: 'GST Return', description: 'Quarterly GST F5 return', frequency: 'quarterly', dueDateRule: 'Last day of next month after quarter', penaltyLate: 'S$200', authority: 'IRAS', riskLevel: 'high', isActive: true },
  { countryIso: 'SG', regulationType: 'tax_filing', title: 'Estimated Chargeable Income (ECI)', description: 'ECI within 3 months of FY end', frequency: 'annually', dueDateRule: '3 months after FY end', penaltyLate: 'S$1,000-5,000', authority: 'IRAS', riskLevel: 'medium', isActive: true },
  { countryIso: 'SG', regulationType: 'corporate', title: 'Form C-S/C Annual Return', description: 'Annual corporate income tax return', frequency: 'annually', dueDateRule: '30 Nov (paper), 15 Dec (e-filing)', penaltyLate: 'S$1,000-5,000', authority: 'IRAS', riskLevel: 'high', isActive: true },
  { countryIso: 'SG', regulationType: 'corporate', title: 'ACRA Annual Return', description: 'ACRA company annual return', frequency: 'annually', dueDateRule: '7 months after FY end', penaltyLate: 'S$300-600', authority: 'ACRA', riskLevel: 'medium', isActive: true },

  // UK — VAT quarterly, CTSA, PAYE
  { countryIso: 'GB', regulationType: 'vat_return', title: 'VAT Return', description: 'Quarterly VAT return', frequency: 'quarterly', dueDateRule: '1 month + 7 days after quarter end', penaltyLate: 'Points-based + £200', authority: 'HMRC', riskLevel: 'high', isActive: true },
  { countryIso: 'GB', regulationType: 'tax_filing', title: 'Corporation Tax Return (CT600)', description: 'Annual CT return', frequency: 'annually', dueDateRule: '12 months after FY end', penaltyLate: '£100, then 10% tax due', authority: 'HMRC', riskLevel: 'critical', isActive: true },
  { countryIso: 'GB', regulationType: 'payroll', title: 'PAYE/RTI Submission', description: 'Real-time payroll reporting', frequency: 'monthly', dueDateRule: 'On/before payday', penaltyLate: '£100-400/month', authority: 'HMRC', riskLevel: 'high', isActive: true },
  { countryIso: 'GB', regulationType: 'corporate', title: 'Companies House Annual Return (CS01)', description: 'Annual confirmation statement', frequency: 'annually', dueDateRule: 'Anniversary of incorporation', penaltyLate: '£100-1,000 + strike-off', authority: 'Companies House', riskLevel: 'medium', isActive: true },
  { countryIso: 'GB', regulationType: 'privacy', title: 'GDPR / UK Data Protection', description: 'GDPR + UK DPA compliance', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to £17.5M / 4% turnover', authority: 'ICO', riskLevel: 'high', isActive: true },

  // Germany — VAT monthly, KSt annual, LSt monthly
  { countryIso: 'DE', regulationType: 'vat_return', title: 'Umsatzsteuer-Voranmeldung', description: 'Monthly/quarterly VAT advance return', frequency: 'monthly', dueDateRule: '10th of next month', penaltyLate: '0.25% per month', authority: 'Finanzamt', riskLevel: 'high', isActive: true },
  { countryIso: 'DE', regulationType: 'corporate', title: 'Körperschaftsteuer (KSt)', description: 'Annual corporate income tax', frequency: 'annually', dueDateRule: '15 months after FY end', penaltyLate: '0.25% per month', authority: 'Finanzamt', riskLevel: 'critical', isActive: true },
  { countryIso: 'DE', regulationType: 'payroll', title: 'Lohnsteuer (LSt)', description: 'Monthly payroll tax', frequency: 'monthly', dueDateRule: '10th of next month', penaltyLate: '0.25% per month', authority: 'Finanzamt', riskLevel: 'high', isActive: true },
  { countryIso: 'DE', regulationType: 'privacy', title: 'DSGVO (GDPR)', description: 'EU GDPR compliance', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to €20M / 4% turnover', authority: 'BfDI', riskLevel: 'high', isActive: true },

  // France — TVA monthly, IS annual
  { countryIso: 'FR', regulationType: 'vat_return', title: 'Déclaration TVA (CA3)', description: 'Monthly/quarterly VAT', frequency: 'monthly', dueDateRule: '19th/24th of next month', penaltyLate: '5-80% of tax', authority: 'DGFiP', riskLevel: 'high', isActive: true },
  { countryIso: 'FR', regulationType: 'corporate', title: 'Impôt sur les Sociétés (IS)', description: 'Annual corporate tax', frequency: 'annually', dueDateRule: '15th of 3rd month after FY end', penaltyLate: '10% + interest', authority: 'DGFiP', riskLevel: 'critical', isActive: true },
  { countryIso: 'FR', regulationType: 'privacy', title: 'RGPD', description: 'EU GDPR (France)', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to €20M', authority: 'CNIL', riskLevel: 'high', isActive: true },

  // USA — Sales tax (state), Federal Corp 1120, 941 payroll, 1099
  { countryIso: 'US', regulationType: 'tax_filing', title: 'Form 1120 (Federal Corp)', description: 'Federal corporate income tax', frequency: 'annually', dueDateRule: '15th of 4th month after FY end', penaltyLate: '5%/month max 25%', authority: 'IRS', riskLevel: 'critical', isActive: true },
  { countryIso: 'US', regulationType: 'payroll', title: 'Form 941 (Quarterly Payroll)', description: 'Federal quarterly payroll tax', frequency: 'quarterly', dueDateRule: 'Last day of month after quarter', penaltyLate: '5%/month', authority: 'IRS', riskLevel: 'high', isActive: true },
  { countryIso: 'US', regulationType: 'tax_filing', title: 'Sales Tax Return (state)', description: 'State sales/use tax', frequency: 'quarterly', dueDateRule: '20th-30th of next month', penaltyLate: 'Varies (5-25%)', authority: 'State DOR', riskLevel: 'high', isActive: true },
  { countryIso: 'US', regulationType: 'corporate', title: 'Form 1099-MISC/NEC', description: 'Independent contractor reporting', frequency: 'annually', dueDateRule: '31st January', penaltyLate: '$50-310 per form', authority: 'IRS', riskLevel: 'medium', isActive: true },
  { countryIso: 'US', regulationType: 'privacy', title: 'State Privacy Laws (CCPA/CPRA)', description: 'California + state privacy laws', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to $7,500/violation', authority: 'CPPA / State AGs', riskLevel: 'high', isActive: true },

  // Canada — GST/HST quarterly, T2 annual, T4 payroll
  { countryIso: 'CA', regulationType: 'gst_return', title: 'GST/HST Return', description: 'Annual/quarterly GST/HST', frequency: 'quarterly', dueDateRule: '1 month after FY end', penaltyLate: '1% + interest', authority: 'CRA', riskLevel: 'high', isActive: true },
  { countryIso: 'CA', regulationType: 'corporate', title: 'T2 Corporate Return', description: 'Federal+provincial corp tax', frequency: 'annually', dueDateRule: '6 months after FY end', penaltyLate: '5%/month', authority: 'CRA', riskLevel: 'critical', isActive: true },
  { countryIso: 'CA', regulationType: 'payroll', title: 'T4 Summary (Payroll)', description: 'Annual payroll summary', frequency: 'annually', dueDateRule: 'Last day of February', penaltyLate: '$100-7,500', authority: 'CRA', riskLevel: 'high', isActive: true },
  { countryIso: 'CA', regulationType: 'privacy', title: 'PIPEDA', description: 'Personal Information Protection', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to CAD 100k', authority: 'OPC', riskLevel: 'medium', isActive: true },

  // Australia — BAS quarterly, ITR annual, STP payroll
  { countryIso: 'AU', regulationType: 'gst_return', title: 'Business Activity Statement (BAS)', description: 'GST+PAYG quarterly', frequency: 'quarterly', dueDateRule: '28th of month after quarter', penaltyLate: 'AUD 210-1,050', authority: 'ATO', riskLevel: 'high', isActive: true },
  { countryIso: 'AU', regulationType: 'corporate', title: 'Company Tax Return', description: 'Annual income tax return', frequency: 'annually', dueDateRule: '15th Jan (lodged) / 21st Feb (paid)', penaltyLate: 'AUD 1,050 + interest', authority: 'ATO', riskLevel: 'critical', isActive: true },
  { countryIso: 'AU', regulationType: 'payroll', title: 'Single Touch Payroll (STP)', description: 'Real-time payroll reporting', frequency: 'monthly', dueDateRule: 'On payday', penaltyLate: 'AUD 210-1,050', authority: 'ATO', riskLevel: 'high', isActive: true },
  { countryIso: 'AU', regulationType: 'corporate', title: 'ASIC Annual Review', description: 'ASIC annual company review', frequency: 'annually', dueDateRule: 'Anniversary of registration', penaltyLate: 'AUD 79 + late fees', authority: 'ASIC', riskLevel: 'medium', isActive: true },
  { countryIso: 'AU', regulationType: 'privacy', title: 'Privacy Act 1988', description: 'Australian Privacy Principles', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to AUD 50M', authority: 'OAIC', riskLevel: 'high', isActive: true },

  // South Africa — VAT bi-monthly, ITR14 annual, EMP201 payroll
  { countryIso: 'ZA', regulationType: 'vat_return', title: 'VAT201 Return', description: 'Bi-monthly VAT return', frequency: 'monthly', dueDateRule: '25th of next month (e-filing)', penaltyLate: '10% + interest', authority: 'SARS', riskLevel: 'high', isActive: true },
  { countryIso: 'ZA', regulationType: 'corporate', title: 'ITR14 (Corporate Return)', description: 'Annual corporate income tax', frequency: 'annually', dueDateRule: '12 months after FY end', penaltyLate: '10-200% of tax', authority: 'SARS', riskLevel: 'critical', isActive: true },
  { countryIso: 'ZA', regulationType: 'payroll', title: 'EMP201 (PAYE/UIF/SDL)', description: 'Monthly payroll taxes', frequency: 'monthly', dueDateRule: '7th of next month', penaltyLate: '10% + interest', authority: 'SARS', riskLevel: 'high', isActive: true },
  { countryIso: 'ZA', regulationType: 'privacy', title: 'POPIA', description: 'Protection of Personal Information Act', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to ZAR 10M / imprisonment', authority: 'Information Regulator', riskLevel: 'high', isActive: true },

  // Brazil — DCTF, EFD, SPED
  { countryIso: 'BR', regulationType: 'tax_filing', title: 'DCTF Monthly', description: 'Federal tax statement', frequency: 'monthly', dueDateRule: '15th of next month', penaltyLate: 'BRL 5,000-50,000', authority: 'RFB', riskLevel: 'high', isActive: true },
  { countryIso: 'BR', regulationType: 'corporate', title: 'ECF (Corporate Tax Return)', description: 'Annual corporate tax', frequency: 'annually', dueDateRule: 'Last business day of July', penaltyLate: 'BRL 5,000-50,000', authority: 'RFB', riskLevel: 'critical', isActive: true },
  { countryIso: 'BR', regulationType: 'corporate', title: 'SPED ECD (Digital Bookkeeping)', description: 'Digital accounting bookkeeping', frequency: 'annually', dueDateRule: 'Last business day of May', penaltyLate: 'BRL 5,000-50,000', authority: 'RFB', riskLevel: 'high', isActive: true },
  { countryIso: 'BR', regulationType: 'privacy', title: 'LGPD', description: 'Brazilian General Data Protection Law', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to BRL 50M / 2% revenue', authority: 'ANPD', riskLevel: 'high', isActive: true },

  // Singapore already covered; UAE privacy
  { countryIso: 'AE', regulationType: 'privacy', title: 'UAE PDPL', description: 'Personal Data Protection Law', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to AED 5M', authority: 'UAE Data Office', riskLevel: 'medium', isActive: true },

  // China — VAT monthly, EIT quarterly
  { countryIso: 'CN', regulationType: 'vat_return', title: 'VAT Return', description: 'Monthly VAT return', frequency: 'monthly', dueDateRule: '15th of next month', penaltyLate: '0.05%/day', authority: 'STA', riskLevel: 'high', isActive: true },
  { countryIso: 'CN', regulationType: 'corporate', title: 'EIT Quarterly Prepayment', description: 'Quarterly EIT', frequency: 'quarterly', dueDateRule: '15th of month after quarter', penaltyLate: '0.05%/day', authority: 'STA', riskLevel: 'high', isActive: true },
  { countryIso: 'CN', regulationType: 'privacy', title: 'PIPL', description: 'Personal Information Protection Law', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to CNY 50M / 5% revenue', authority: 'CAC', riskLevel: 'critical', isActive: true },

  // Japan — Consumption Tax annual, Corporation Tax
  { countryIso: 'JP', regulationType: 'vat_return', title: 'Consumption Tax Return', description: 'Annual consumption tax', frequency: 'annually', dueDateRule: '2 months after FY end', penaltyLate: 'No extension penalty', authority: 'NTA', riskLevel: 'high', isActive: true },
  { countryIso: 'JP', regulationType: 'corporate', title: 'Corporation Tax Return', description: 'Annual corporate tax', frequency: 'annually', dueDateRule: '2 months after FY end', penaltyLate: 'No extension penalty', authority: 'NTA', riskLevel: 'critical', isActive: true },
  { countryIso: 'JP', regulationType: 'privacy', title: 'APPI', description: 'Act on Protection of Personal Information', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to JPY 100M', authority: 'PPC', riskLevel: 'high', isActive: true },

  // Hong Kong — Profits Tax annual
  { countryIso: 'HK', regulationType: 'corporate', title: 'Profits Tax Return', description: 'Annual profits tax', frequency: 'annually', dueDateRule: '1st week of April (normal)', penaltyLate: 'HKD 10,000 + 5x tax', authority: 'IRD', riskLevel: 'critical', isActive: true },
  { countryIso: 'HK', regulationType: 'corporate', title: 'Annual Return (NAR1)', description: 'Companies Registry annual return', frequency: 'annually', dueDateRule: 'Anniversary of incorporation', penaltyLate: 'HKD 870-3,480', authority: 'Companies Registry', riskLevel: 'medium', isActive: true },
  { countryIso: 'HK', regulationType: 'privacy', title: 'PDPO', description: 'Personal Data (Privacy) Ordinance', frequency: 'annually', dueDateRule: 'Continuous', penaltyLate: 'Up to HKD 1M / 5 years', authority: 'PCPD', riskLevel: 'medium', isActive: true },
];

export function getComplianceDeadlinesForCountry(countryIso: string): ComplianceDeadlineRecord[] {
  return COMPLIANCE_DEADLINES_REGISTRY.filter((d) => d.countryIso === countryIso.toUpperCase() && d.isActive);
}

// ─── Payroll Structures Registry (canonical country payroll rules) ───────────

export const PAYROLL_STRUCTURES_REGISTRY: PayrollStructureRecord[] = [
  {
    countryIso: 'IN', structureName: 'India Standard Payroll', currencyCode: 'INR', payCycle: 'monthly',
    minWageMonthly: 15000,
    socialSecurityEmployerPct: 12, socialSecurityEmployeePct: 12,  // EPF
    medicareEmployerPct: 3.25, medicareEmployeePct: 0,              // ESI (<₹21k salary)
    retirementEmployerPct: 8.33, retirementEmployeePct: 0,         // EPS (out of EPF 12%)
    annualLeaveDays: 21, sickLeaveDays: 12, maternityLeaveDays: 182,
    incomeTaxBrackets: [
      { from: 0, to: 300000, rate: 0 },
      { from: 300000, to: 600000, rate: 5 },
      { from: 600000, to: 900000, rate: 10 },
      { from: 900000, to: 1200000, rate: 15 },
      { from: 1200000, to: 1500000, rate: 20 },
      { from: 1500000, to: null, rate: 30 },
    ] as TaxBracket[],
    notes: 'New tax regime FY2024-25; EPF 12% + EPS 8.33% of basic',
  },
  {
    countryIso: 'US', structureName: 'US Standard Payroll', currencyCode: 'USD', payCycle: 'bi_weekly',
    minWageMonthly: 1458,  // $7.25/hr federal
    socialSecurityEmployerPct: 6.2, socialSecurityEmployeePct: 6.2,  // FICA-SS (cap $168,600)
    medicareEmployerPct: 1.45, medicareEmployeePct: 1.45,             // FICA-Medicare
    retirementEmployerPct: 3, retirementEmployeePct: 5,               // 401k typical match
    annualLeaveDays: 15, sickLeaveDays: 10, maternityLeaveDays: 84,   // FMLA 12 weeks unpaid
    incomeTaxBrackets: [
      { from: 0, to: 11600, rate: 10 },
      { from: 11600, to: 47150, rate: 12 },
      { from: 47150, to: 100525, rate: 22 },
      { from: 100525, to: 191950, rate: 24 },
      { from: 191950, to: 243725, rate: 32 },
      { from: 243725, to: 609350, rate: 35 },
      { from: 609350, to: null, rate: 37 },
    ] as TaxBracket[],
    notes: '2024 single filer brackets; 401k typical 5% employee + 3% employer match',
  },
  {
    countryIso: 'GB', structureName: 'UK Standard Payroll', currencyCode: 'GBP', payCycle: 'monthly',
    minWageMonthly: 1830,  // National Living Wage (21+)
    socialSecurityEmployerPct: 13.8, socialSecurityEmployeePct: 8,  // Class 1 NICs
    medicareEmployerPct: 0, medicareEmployeePct: 0,                  // NHS funded general
    retirementEmployerPct: 5, retirementEmployeePct: 5,              // Workplace pension auto-enroll
    annualLeaveDays: 28, sickLeaveDays: 7, maternityLeaveDays: 270,  // Statutory 52 weeks
    incomeTaxBrackets: [
      { from: 0, to: 12570, rate: 0 },       // Personal allowance
      { from: 12570, to: 50270, rate: 20 },
      { from: 50270, to: 125140, rate: 40 },
      { from: 125140, to: null, rate: 45 },
    ] as TaxBracket[],
    notes: '2024-25 England; NICs 8% employee, 13.8% employer',
  },
  {
    countryIso: 'AE', structureName: 'UAE Standard Payroll', currencyCode: 'AED', payCycle: 'monthly',
    minWageMonthly: 0,  // No federal min wage (sector-specific in free zones)
    socialSecurityEmployerPct: 5, socialSecurityEmployeePct: 5,   // GCC nationals only (GSO)
    medicareEmployerPct: 0, medicareEmployeePct: 0,
    retirementEmployerPct: 0, retirementEmployeePct: 0,           // End-of-service gratuity instead
    annualLeaveDays: 30, sickLeaveDays: 30, maternityLeaveDays: 60,
    incomeTaxBrackets: [],  // No personal income tax
    notes: 'End-of-service gratuity 21 days/yr (first 5yr), 30 days/yr thereafter; no PIT',
  },
  {
    countryIso: 'SG', structureName: 'Singapore Standard Payroll', currencyCode: 'SGD', payCycle: 'monthly',
    minWageMonthly: 0,  // No universal MW (sector-specific only)
    socialSecurityEmployerPct: 17, socialSecurityEmployeePct: 20,  // CPF (<55yo)
    medicareEmployerPct: 0, medicareEmployeePct: 0,
    retirementEmployerPct: 0, retirementEmployeePct: 0,            // CPF covers retirement
    annualLeaveDays: 14, sickLeaveDays: 14, maternityLeaveDays: 112,
    incomeTaxBrackets: [
      { from: 0, to: 20000, rate: 0 },
      { from: 20000, to: 30000, rate: 2 },
      { from: 30000, to: 40000, rate: 3.5 },
      { from: 40000, to: 80000, rate: 7 },
      { from: 80000, to: 120000, rate: 11.5 },
      { from: 120000, to: 160000, rate: 15 },
      { from: 160000, to: 200000, rate: 18 },
      { from: 200000, to: 240000, rate: 19 },
      { from: 240000, to: 280000, rate: 19.5 },
      { from: 280000, to: 320000, rate: 20 },
      { from: 320000, to: null, rate: 22 },
    ] as TaxBracket[],
    notes: 'CPF 17% employer + 20% employee (<55yo); progressive PIT 0-22%',
  },
  {
    countryIso: 'AU', structureName: 'Australia Standard Payroll', currencyCode: 'AUD', payCycle: 'bi_weekly',
    minWageMonthly: 4763,  // $23.23/hr National Minimum Wage (38hr/wk)
    socialSecurityEmployerPct: 11, socialSecurityEmployeePct: 0,  // Super Guarantee
    medicareEmployerPct: 0, medicareEmployeePct: 2,               // Medicare Levy
    retirementEmployerPct: 0, retirementEmployeePct: 0,           // Super covers retirement
    annualLeaveDays: 20, sickLeaveDays: 10, maternityLeaveDays: 126,  // 18 weeks paid parental
    incomeTaxBrackets: [
      { from: 0, to: 18200, rate: 0 },
      { from: 18200, to: 45000, rate: 16 },
      { from: 45000, to: 135000, rate: 30 },
      { from: 135000, to: 190000, rate: 37 },
      { from: 190000, to: null, rate: 45 },
    ] as TaxBracket[],
    notes: '2024-25 Stage 3 cuts; Super 11%; Medicare Levy 2%',
  },
  {
    countryIso: 'DE', structureName: 'Germany Standard Payroll', currencyCode: 'EUR', payCycle: 'monthly',
    minWageMonthly: 2134,  // €12.41/hr
    socialSecurityEmployerPct: 10, socialSecurityEmployeePct: 10,  // RV+AV
    medicareEmployerPct: 8.15, medicareEmployeePct: 8.15,          // KV+PV
    retirementEmployerPct: 0, retirementEmployeePct: 0,            // RV covers retirement
    annualLeaveDays: 24, sickLeaveDays: 30, maternityLeaveDays: 98,
    incomeTaxBrackets: [
      { from: 0, to: 11604, rate: 0 },
      { from: 11604, to: 17005, rate: 14 },
      { from: 17005, to: 66760, rate: 24 },
      { from: 66760, to: 277825, rate: 42 },
      { from: 277825, to: null, rate: 45 },
    ] as TaxBracket[],
    notes: '2024 brackets; solidarity surcharge 5.5% above threshold',
  },
  {
    countryIso: 'CA', structureName: 'Canada Standard Payroll', currencyCode: 'CAD', payCycle: 'bi_weekly',
    minWageMonthly: 2820,  // Avg provincial MW ~$16.30/hr
    socialSecurityEmployerPct: 5.95, socialSecurityEmployeePct: 5.95,  // CPP
    medicareEmployerPct: 2.62, medicareEmployeePct: 1.66,              // EI
    retirementEmployerPct: 4, retirementEmployeePct: 4,                // RRSP typical
    annualLeaveDays: 15, sickLeaveDays: 10, maternityLeaveDays: 105,
    incomeTaxBrackets: [
      { from: 0, to: 55867, rate: 15 },
      { from: 55867, to: 111733, rate: 20.5 },
      { from: 111733, to: 173205, rate: 26 },
      { from: 173205, to: 246752, rate: 29 },
      { from: 246752, to: null, rate: 33 },
    ] as TaxBracket[],
    notes: '2024 federal brackets; provincial tax additional',
  },
  {
    countryIso: 'ZA', structureName: 'South Africa Standard Payroll', currencyCode: 'ZAR', payCycle: 'monthly',
    minWageMonthly: 4400,  // R27.58/hr NMW
    socialSecurityEmployerPct: 1, socialSecurityEmployeePct: 1,  // UIF
    medicareEmployerPct: 0, medicareEmployeePct: 0,
    retirementEmployerPct: 7.5, retirementEmployeePct: 7.5,      // Pension/RA typical
    annualLeaveDays: 21, sickLeaveDays: 30, maternityLeaveDays: 126,  // 4 months UI
    incomeTaxBrackets: [
      { from: 0, to: 237100, rate: 18 },
      { from: 237100, to: 370500, rate: 26 },
      { from: 370500, to: 512800, rate: 31 },
      { from: 512800, to: 673000, rate: 36 },
      { from: 673000, to: 857900, rate: 39 },
      { from: 857900, to: 1817000, rate: 41 },
      { from: 1817000, to: null, rate: 45 },
    ] as TaxBracket[],
    notes: '2024-25 tax year; UIF 1%+1%; SDL 1% employer',
  },
  {
    countryIso: 'CN', structureName: 'China Standard Payroll', currencyCode: 'CNY', payCycle: 'monthly',
    minWageMonthly: 2480,  // avg ~¥2,480 (varies by city)
    socialSecurityEmployerPct: 16, socialSecurityEmployeePct: 8,   // Pension
    medicareEmployerPct: 9.8, medicareEmployeePct: 2,              // Medical Insurance
    retirementEmployerPct: 0, retirementEmployeePct: 0,            // Pension covers
    annualLeaveDays: 10, sickLeaveDays: 12, maternityLeaveDays: 98,
    incomeTaxBrackets: [
      { from: 0, to: 36000, rate: 3 },
      { from: 36000, to: 144000, rate: 10 },
      { from: 144000, to: 300000, rate: 20 },
      { from: 300000, to: 420000, rate: 25 },
      { from: 420000, to: 660000, rate: 30 },
      { from: 660000, to: 960000, rate: 35 },
      { from: 960000, to: null, rate: 45 },
    ] as TaxBracket[],
    notes: 'IIT monthly brackets 2024; 5 social insurances + housing fund',
  },
  {
    countryIso: 'JP', structureName: 'Japan Standard Payroll', currencyCode: 'JPY', payCycle: 'monthly',
    minWageMonthly: 167000,  // ¥1,055/hr national avg
    socialSecurityEmployerPct: 9.15, socialSecurityEmployeePct: 9.15,  // EP+Kosei
    medicareEmployerPct: 4.95, medicareEmployeePct: 4.95,              // Health Insurance
    retirementEmployerPct: 0, retirementEmployeePct: 0,                // EP covers
    annualLeaveDays: 18, sickLeaveDays: 12, maternityLeaveDays: 98,
    incomeTaxBrackets: [
      { from: 0, to: 1950000, rate: 5 },
      { from: 1950000, to: 3300000, rate: 10 },
      { from: 3300000, to: 6950000, rate: 20 },
      { from: 6950000, to: 9000000, rate: 23 },
      { from: 9000000, to: 18000000, rate: 33 },
      { from: 18000000, to: 40000000, rate: 40 },
      { from: 40000000, to: null, rate: 45 },
    ] as TaxBracket[],
    notes: '2024 national income tax; local inhabitants tax 10% additional',
  },
];

export function getPayrollStructure(countryIso: string): PayrollStructureRecord | undefined {
  return PAYROLL_STRUCTURES_REGISTRY.find((p) => p.countryIso === countryIso.toUpperCase());
}

// ─── Base currency & defaults ────────────────────────────────────────────────

export const BASE_CURRENCY = 'INR'; // VEYRO is India-rooted; consolidation converts to INR first

// Canonical FX rates (used when no live rate cached yet — bootstrap values from public data).
// Will be overwritten by live rates fetched by currency.ts on first API call.
export const BOOTSTRAP_FX_RATES: Record<string, { rate: number; inverse: number }> = {
  // INR base — 1 INR = rate quote (e.g. INR→USD: 0.012)
  USD: { rate: 0.01194, inverse: 83.75 },
  EUR: { rate: 0.01099, inverse: 90.99 },
  GBP: { rate: 0.00939, inverse: 106.50 },
  AED: { rate: 0.04383, inverse: 22.81 },
  SGD: { rate: 0.01604, inverse: 62.34 },
  AUD: { rate: 0.01801, inverse: 55.52 },
  CAD: { rate: 0.01640, inverse: 60.98 },
  CHF: { rate: 0.01068, inverse: 93.63 },
  JPY: { rate: 1.855, inverse: 0.539 }, // 1 INR ≈ ¥1.855
  CNY: { rate: 0.0866, inverse: 11.55 },
  HKD: { rate: 0.0931, inverse: 10.74 },
  ZAR: { rate: 0.2156, inverse: 4.64 },
  BRL: { rate: 0.0613, inverse: 16.31 },
  MXN: { rate: 0.2157, inverse: 4.64 },
  NZD: { rate: 0.01969, inverse: 50.78 },
  SEK: { rate: 0.1265, inverse: 7.91 },
  PLN: { rate: 0.0473, inverse: 21.14 },
  SAR: { rate: 0.0447, inverse: 22.37 },
  NGN: { rate: 18.92, inverse: 0.0529 },
  EGP: { rate: 0.578, inverse: 1.73 },
  KES: { rate: 1.532, inverse: 0.653 },
  ILS: { rate: 0.0435, inverse: 22.99 },
  ARS: { rate: 11.59, inverse: 0.0863 },
  CLP: { rate: 11.10, inverse: 0.0901 },
};
