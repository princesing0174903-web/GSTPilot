// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 14: Global Expansion Data Layer
//
// Pure static data for Multi-Country Accounting, Multi-Currency, Multi-Tax,
// International Banking, Global Compliance, International ERP, Multi-Language,
// AI Global Advisor, Global Dashboards, Cross-Border Payments & Reports.
//
// NO API calls. NO Math.random. Deterministic & typed.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Countries ─────────────────────────────────────────────────────────────────

export type CountryCode =
  | 'IN' | 'US' | 'CA' | 'GB' | 'AU' | 'AE' | 'SG' | 'DE' | 'FR' | 'JP';

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;            // emoji flag
  currency: string;        // ISO 4217
  timezone: string;
  taxSystem: TaxSystemType;
  primaryTaxName: string;  // GST / VAT / Sales Tax
  taxRate: number;         // % standard rate
  corporateTaxRate: number;// %
  payrollTaxRate: number;   // %
  importDuty: number;       // %
  exportDuty: number;       // %
  language: string;
  complianceBodies: string[];
  fiscalYearStart: string;  // month
  revenue: number;          // revenue from this country (INR equiv, deterministic)
  expenses: number;
  taxLiability: number;
  organizations: number;    // # orgs operating in this country
  growthScore: number;      // 0-100
  riskScore: number;        // 0-100
  complianceScore: number;  // 0-100
}

export type TaxSystemType = 'GST' | 'VAT' | 'Sales Tax' | 'Consumption Tax';

export const COUNTRIES: Country[] = [
  {
    code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', timezone: 'Asia/Kolkata',
    taxSystem: 'GST', primaryTaxName: 'GST', taxRate: 18, corporateTaxRate: 25.17,
    payrollTaxRate: 12, importDuty: 15, exportDuty: 0, language: 'Hindi / English',
    complianceBodies: ['GSTN', 'Income Tax Dept', 'RBI', 'MCA', 'CBIC'],
    fiscalYearStart: 'April',
    revenue: 847200000, expenses: 612400000, taxLiability: 152596000,
    organizations: 1247, growthScore: 82, riskScore: 24, complianceScore: 94,
  },
  {
    code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', timezone: 'America/New_York',
    taxSystem: 'Sales Tax', primaryTaxName: 'Sales Tax', taxRate: 7.25, corporateTaxRate: 21,
    payrollTaxRate: 15.3, importDuty: 3.4, exportDuty: 0, language: 'English',
    complianceBodies: ['IRS', 'State Revenue', 'FinCEN', 'SEC', 'DOL'],
    fiscalYearStart: 'January',
    revenue: 1240000, expenses: 892000, taxLiability: 260400,
    organizations: 834, growthScore: 88, riskScore: 18, complianceScore: 91,
  },
  {
    code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', timezone: 'America/Toronto',
    taxSystem: 'GST', primaryTaxName: 'GST/HST', taxRate: 13, corporateTaxRate: 26.5,
    payrollTaxRate: 14.2, importDuty: 5, exportDuty: 0, language: 'English / French',
    complianceBodies: ['CRA', 'Provincial Revenue', 'FINTRAC'],
    fiscalYearStart: 'April',
    revenue: 640000, expenses: 458000, taxLiability: 83200,
    organizations: 312, growthScore: 76, riskScore: 21, complianceScore: 93,
  },
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', timezone: 'Europe/London',
    taxSystem: 'VAT', primaryTaxName: 'VAT', taxRate: 20, corporateTaxRate: 25,
    payrollTaxRate: 13.8, importDuty: 4.7, exportDuty: 0, language: 'English',
    complianceBodies: ['HMRC', 'FCA', 'Companies House'],
    fiscalYearStart: 'April',
    revenue: 480000, expenses: 356000, taxLiability: 96000,
    organizations: 287, growthScore: 74, riskScore: 26, complianceScore: 90,
  },
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', timezone: 'Australia/Sydney',
    taxSystem: 'GST', primaryTaxName: 'GST', taxRate: 10, corporateTaxRate: 30,
    payrollTaxRate: 11, importDuty: 5, exportDuty: 0, language: 'English',
    complianceBodies: ['ATO', 'ASIC', 'AUSTRAC'],
    fiscalYearStart: 'July',
    revenue: 380000, expenses: 274000, taxLiability: 38000,
    organizations: 198, growthScore: 79, riskScore: 19, complianceScore: 95,
  },
  {
    code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', timezone: 'Asia/Dubai',
    taxSystem: 'VAT', primaryTaxName: 'VAT', taxRate: 5, corporateTaxRate: 9,
    payrollTaxRate: 0, importDuty: 5, exportDuty: 0, language: 'Arabic / English',
    complianceBodies: ['FTA', 'Central Bank', 'MoE'],
    fiscalYearStart: 'January',
    revenue: 520000, expenses: 364000, taxLiability: 26000,
    organizations: 156, growthScore: 91, riskScore: 15, complianceScore: 88,
  },
  {
    code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', timezone: 'Asia/Singapore',
    taxSystem: 'GST', primaryTaxName: 'GST', taxRate: 9, corporateTaxRate: 17,
    payrollTaxRate: 17, importDuty: 0, exportDuty: 0, language: 'English / Malay / Chinese / Tamil',
    complianceBodies: ['IRAS', 'MAS', 'ACRA'],
    fiscalYearStart: 'January',
    revenue: 610000, expenses: 427000, taxLiability: 54900,
    organizations: 224, growthScore: 86, riskScore: 12, complianceScore: 97,
  },
  {
    code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', timezone: 'Europe/Berlin',
    taxSystem: 'VAT', primaryTaxName: 'MwSt (VAT)', taxRate: 19, corporateTaxRate: 30.2,
    payrollTaxRate: 19.7, importDuty: 4.2, exportDuty: 0, language: 'German',
    complianceBodies: ['BZSt', 'BaFin', 'Bundesbank'],
    fiscalYearStart: 'January',
    revenue: 720000, expenses: 548000, taxLiability: 136800,
    organizations: 341, growthScore: 71, riskScore: 22, complianceScore: 92,
  },
  {
    code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', timezone: 'Europe/Paris',
    taxSystem: 'VAT', primaryTaxName: 'TVA (VAT)', taxRate: 20, corporateTaxRate: 25.8,
    payrollTaxRate: 22, importDuty: 4.2, exportDuty: 0, language: 'French',
    complianceBodies: ['DGFiP', 'ACPR', 'AMF'],
    fiscalYearStart: 'January',
    revenue: 540000, expenses: 412000, taxLiability: 108000,
    organizations: 203, growthScore: 68, riskScore: 28, complianceScore: 89,
  },
  {
    code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', timezone: 'Asia/Tokyo',
    taxSystem: 'Consumption Tax', primaryTaxName: 'Consumption Tax', taxRate: 10, corporateTaxRate: 30.6,
    payrollTaxRate: 16.4, importDuty: 3.6, exportDuty: 0, language: 'Japanese',
    complianceBodies: ['NTA', 'FSA', 'METI'],
    fiscalYearStart: 'April',
    revenue: 98000000, expenses: 74500000, taxLiability: 9800000,
    organizations: 176, growthScore: 65, riskScore: 20, complianceScore: 94,
  },
];

export const getCountry = (code: CountryCode): Country =>
  COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];

// ─── Currencies ─────────────────────────────────────────────────────────────────

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  rateToUSD: number;   // 1 unit = rateToUSD USD
  change24h: number;   // % change vs USD
  supported: boolean;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', rateToUSD: 1, change24h: 0, supported: true },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳', rateToUSD: 0.012, change24h: -0.21, supported: true },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', rateToUSD: 1.08, change24h: 0.14, supported: true },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', rateToUSD: 1.27, change24h: -0.08, supported: true },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪', rateToUSD: 0.27, change24h: 0.01, supported: true },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', rateToUSD: 0.73, change24h: -0.15, supported: true },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', rateToUSD: 0.0067, change24h: 0.32, supported: true },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', rateToUSD: 0.66, change24h: -0.19, supported: true },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', rateToUSD: 0.74, change24h: 0.05, supported: true },
];

export const convertCurrency = (amount: number, from: string, to: string): number => {
  const fromCur = CURRENCIES.find(c => c.code === from);
  const toCur = CURRENCIES.find(c => c.code === to);
  if (!fromCur || !toCur) return amount;
  const usd = amount * fromCur.rateToUSD;
  return usd / toCur.rateToUSD;
};

export const formatCurrency = (amount: number, code: string): string => {
  const cur = CURRENCIES.find(c => c.code === code);
  if (!cur) return `${amount.toFixed(2)}`;
  const decimals = code === 'JPY' || code === 'INR' ? 0 : 2;
  return `${cur.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

// ─── Tax Systems ────────────────────────────────────────────────────────────────

export interface TaxSystem {
  type: TaxSystemType;
  name: string;
  countries: CountryCode[];
  description: string;
  standardRate: number;
  reducedRate: number;
  zeroRate: number;
  features: string[];
}

export const TAX_SYSTEMS: TaxSystem[] = [
  {
    type: 'GST', name: 'Goods & Services Tax (GST)',
    countries: ['IN', 'CA', 'AU', 'SG'],
    description: 'Multi-stage value-added tax on goods and services',
    standardRate: 18, reducedRate: 5, zeroRate: 0,
    features: ['Input Tax Credit', 'E-invoicing', 'E-way bill', 'GSTR filing', 'Reverse charge'],
  },
  {
    type: 'VAT', name: 'Value Added Tax (VAT)',
    countries: ['GB', 'AE', 'DE', 'FR'],
    description: 'Consumption tax levied on value added at each stage',
    standardRate: 20, reducedRate: 5, zeroRate: 0,
    features: ['VAT returns', 'EC Sales lists', 'Intrastat', 'Reverse charge', 'MOSS'],
  },
  {
    type: 'Sales Tax', name: 'Sales Tax',
    countries: ['US'],
    description: 'State-level tax on retail sales of goods and services',
    standardRate: 7.25, reducedRate: 0, zeroRate: 0,
    features: ['State nexus', 'Economic nexus', 'Marketplace facilitator', 'Origin/destination', 'Exemption certificates'],
  },
  {
    type: 'Consumption Tax', name: 'Consumption Tax',
    countries: ['JP'],
    description: 'National tax on consumption of goods and services',
    standardRate: 10, reducedRate: 8, zeroRate: 0,
    features: ['Reduced rate (food)', 'Invoice system', 'Qualified invoice', 'Tax-exempt businesses'],
  },
];

export interface TaxCalculation {
  taxType: string;
  rate: number;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export const calculateTax = (
  amount: number,
  countryCode: CountryCode,
  taxType: 'indirect' | 'corporate' | 'payroll' | 'import' | 'export' = 'indirect'
): TaxCalculation => {
  const country = getCountry(countryCode);
  let rate = 0;
  let taxName = '';
  switch (taxType) {
    case 'indirect': rate = country.taxRate; taxName = country.primaryTaxName; break;
    case 'corporate': rate = country.corporateTaxRate; taxName = 'Corporate Tax'; break;
    case 'payroll': rate = country.payrollTaxRate; taxName = 'Payroll Tax'; break;
    case 'import': rate = country.importDuty; taxName = 'Import Duty'; break;
    case 'export': rate = country.exportDuty; taxName = 'Export Duty'; break;
  }
  return {
    taxType: taxName,
    rate,
    baseAmount: amount,
    taxAmount: (amount * rate) / 100,
    totalAmount: amount + (amount * rate) / 100,
  };
};

// ─── International Banking ──────────────────────────────────────────────────────

export interface BankIntegration {
  id: string;
  name: string;
  type: string;
  region: string;
  countries: string[];
  status: 'connected' | 'available' | 'coming-soon';
  transactions: number;       // monthly tx count
  volume: number;             // monthly volume (USD)
  fees: string;
  features: string[];
  logo: string;               // emoji or letter
  color: string;              // accent
}

export const BANK_INTEGRATIONS: BankIntegration[] = [
  {
    id: 'stripe', name: 'Stripe', type: 'Payment Processor', region: 'Global',
    countries: ['US', 'GB', 'DE', 'FR', 'AU', 'CA', 'SG'],
    status: 'connected', transactions: 14820, volume: 2840000, fees: '2.9% + $0.30',
    features: ['Cards', 'ACH', 'SEPA', 'Apple Pay', 'Google Pay', 'Subscriptions'],
    logo: 'S', color: 'violet',
  },
  {
    id: 'paypal', name: 'PayPal', type: 'Digital Wallet', region: 'Global',
    countries: ['US', 'GB', 'DE', 'FR', 'AU', 'CA', 'AE', 'SG'],
    status: 'connected', transactions: 6230, volume: 1180000, fees: '3.49% + fixed',
    features: ['PayPal balance', 'Cards', 'Pay Later', 'Payouts', 'Invoicing'],
    logo: 'P', color: 'blue',
  },
  {
    id: 'wise', name: 'Wise', type: 'Cross-Border', region: 'Global',
    countries: ['US', 'GB', 'DE', 'FR', 'AU', 'CA', 'AE', 'SG', 'JP'],
    status: 'connected', transactions: 1840, volume: 890000, fees: '0.41% avg',
    features: ['Multi-currency', 'Mid-market rate', 'Borderless account', 'Debit card', 'API'],
    logo: 'W', color: 'emerald',
  },
  {
    id: 'revolut', name: 'Revolut Business', type: 'Neobank', region: 'EU/UK',
    countries: ['GB', 'DE', 'FR'],
    status: 'available', transactions: 0, volume: 0, fees: 'From £25/mo',
    features: ['Multi-currency', 'Cards', 'FX', 'Payments', 'Analytics'],
    logo: 'R', color: 'slate',
  },
  {
    id: 'mercury', name: 'Mercury', type: 'Neobank', region: 'US',
    countries: ['US'],
    status: 'connected', transactions: 920, volume: 540000, fees: 'Free',
    features: ['Business banking', 'FDIC insured', 'API', 'Virtual cards', 'Treasury'],
    logo: 'M', color: 'orange',
  },
  {
    id: 'brex', name: 'Brex', type: 'Corporate Cards', region: 'US',
    countries: ['US'],
    status: 'available', transactions: 0, volume: 0, fees: 'Free',
    features: ['Corporate cards', 'Banking', 'Spend mgmt', 'Rewards', 'Bill pay'],
    logo: 'B', color: 'teal',
  },
  {
    id: 'hsbc', name: 'HSBC', type: 'Global Bank', region: 'Global',
    countries: ['GB', 'AE', 'SG', 'IN'],
    status: 'connected', transactions: 3120, volume: 4200000, fees: 'Custom',
    features: ['Global accounts', 'Trade finance', 'FX', 'Treasury', 'Cash mgmt'],
    logo: 'H', color: 'red',
  },
  {
    id: 'citibank', name: 'Citibank', type: 'Global Bank', region: 'Global',
    countries: ['US', 'GB', 'AE', 'SG', 'IN'],
    status: 'connected', transactions: 2480, volume: 3600000, fees: 'Custom',
    features: ['Global network', 'CitiDirect BEB', 'Cash mgmt', 'Trade', 'FX'],
    logo: 'C', color: 'blue',
  },
  {
    id: 'jpmorgan', name: 'JP Morgan', type: 'Investment Bank', region: 'Global',
    countries: ['US', 'GB', 'DE', 'SG'],
    status: 'available', transactions: 0, volume: 0, fees: 'Enterprise',
    features: ['Treasury services', 'Trade finance', 'Custody', 'FX', 'Commercial cards'],
    logo: 'J', color: 'slate',
  },
  {
    id: 'razorpay', name: 'Razorpay', type: 'Payment Gateway', region: 'India',
    countries: ['IN'],
    status: 'connected', transactions: 22400, volume: 1850000, fees: '2% domestic',
    features: ['UPI', 'Cards', 'Net banking', 'Subscriptions', 'Route', 'Payouts'],
    logo: 'R', color: 'blue',
  },
  {
    id: 'cashfree', name: 'Cashfree', type: 'Payment Gateway', region: 'India',
    countries: ['IN'],
    status: 'connected', transactions: 11200, volume: 920000, fees: '1.75% domestic',
    features: ['UPI', 'Cards', 'Payouts', 'Split pay', 'International', 'Auto-collect'],
    logo: 'C', color: 'emerald',
  },
];

// ─── Global Compliance ──────────────────────────────────────────────────────────

export interface ComplianceFramework {
  id: string;
  name: string;
  region: string;
  countries: string[];
  category: string;
  description: string;
  requirements: string[];
  deadline: string;
  status: 'compliant' | 'in-progress' | 'attention' | 'upcoming';
  lastAudit: string;
  nextAudit: string;
}

export const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'gst-india', name: 'GST Returns (India)', region: 'India', countries: ['IN'],
    category: 'Indirect Tax',
    description: 'Monthly/quarterly GST return filing under Indian GST regime',
    requirements: ['GSTR-1 (outward supplies)', 'GSTR-3B (summary)', 'GSTR-2B (auto ITC)', 'Annual return GSTR-9'],
    deadline: '20th of next month', status: 'compliant',
    lastAudit: 'Aug 2024', nextAudit: 'Oct 2024',
  },
  {
    id: 'us-sales-tax', name: 'US Sales Tax Nexus', region: 'United States', countries: ['US'],
    category: 'Indirect Tax',
    description: 'State-by-state sales tax collection and remittance',
    requirements: ['Economic nexus tracking', 'State registration', 'Tax filing per state', 'Exemption certificates'],
    deadline: 'Quarterly', status: 'in-progress',
    lastAudit: 'Jul 2024', nextAudit: 'Oct 2024',
  },
  {
    id: 'uk-vat', name: 'UK VAT (HMRC)', region: 'United Kingdom', countries: ['GB'],
    category: 'Indirect Tax',
    description: 'VAT registration, returns, and MTD compliance',
    requirements: ['VAT registration', 'MTD-compatible software', 'Quarterly returns', 'VAT EC Sales List'],
    deadline: 'Quarterly', status: 'compliant',
    lastAudit: 'Aug 2024', nextAudit: 'Nov 2024',
  },
  {
    id: 'eu-vat-oss', name: 'EU VAT OSS', region: 'European Union', countries: ['DE', 'FR'],
    category: 'Indirect Tax',
    description: 'One Stop Shop for cross-border B2C VAT in the EU',
    requirements: ['OSS registration', 'Quarterly OSS return', 'Intrastat reporting', 'EC Sales lists'],
    deadline: 'Quarterly', status: 'compliant',
    lastAudit: 'Jul 2024', nextAudit: 'Oct 2024',
  },
  {
    id: 'gdpr', name: 'GDPR (EU)', region: 'European Union', countries: ['DE', 'FR'],
    category: 'Data Protection',
    description: 'General Data Protection Regulation compliance',
    requirements: ['Data processing records', 'DPO appointment', 'Privacy policy', 'Data subject rights', 'Breach notification'],
    deadline: 'Continuous', status: 'compliant',
    lastAudit: 'Jun 2024', nextAudit: 'Dec 2024',
  },
  {
    id: 'sox', name: 'SOX 404 (US)', region: 'United States', countries: ['US'],
    category: 'Financial Reporting',
    description: 'Sarbanes-Oxley internal controls over financial reporting',
    requirements: ['Internal controls', 'Audit committee', 'CEO/CFO certification', 'External audit'],
    deadline: 'Annual', status: 'in-progress',
    lastAudit: 'Mar 2024', nextAudit: 'Mar 2025',
  },
  {
    id: 'ae-vat', name: 'UAE VAT (FTA)', region: 'UAE', countries: ['AE'],
    category: 'Indirect Tax',
    description: 'Federal Tax Authority VAT compliance',
    requirements: ['VAT registration', 'Tax invoices', 'Quarterly returns', 'Reverse charge'],
    deadline: 'Quarterly', status: 'compliant',
    lastAudit: 'Aug 2024', nextAudit: 'Nov 2024',
  },
  {
    id: 'sg-gst', name: 'Singapore GST (IRAS)', region: 'Singapore', countries: ['SG'],
    category: 'Indirect Tax',
    description: 'IRAS GST registration and filing',
    requirements: ['GST registration', 'Taxable supply tracking', 'Quarterly returns', 'GST F5'],
    deadline: 'Quarterly', status: 'compliant',
    lastAudit: 'Aug 2024', nextAudit: 'Nov 2024',
  },
  {
    id: 'aus-gst', name: 'Australia GST (ATO)', region: 'Australia', countries: ['AU'],
    category: 'Indirect Tax',
    description: 'ATO GST, BAS, and PAYG compliance',
    requirements: ['GST registration', 'BAS filing', 'PAYG withholding', 'STP reporting'],
    deadline: 'Quarterly', status: 'compliant',
    lastAudit: 'Jul 2024', nextAudit: 'Oct 2024',
  },
  {
    id: 'ca-gst-hst', name: 'Canada GST/HST (CRA)', region: 'Canada', countries: ['CA'],
    category: 'Indirect Tax',
    description: 'CRA GST/HST registration and filing',
    requirements: ['GST/HST registration', 'Input tax credits', 'Annual/quarterly returns', 'Rebate claims'],
    deadline: 'Annual', status: 'attention',
    lastAudit: 'May 2024', nextAudit: 'Dec 2024',
  },
  {
    id: 'jp-ct', name: 'Japan Consumption Tax (NTA)', region: 'Japan', countries: ['JP'],
    category: 'Indirect Tax',
    description: 'NTA consumption tax and qualified invoice system',
    requirements: ['Qualified invoice issuer', 'Tax returns', 'Simplified taxation', 'Tax exemption'],
    deadline: 'Annual', status: 'upcoming',
    lastAudit: 'Feb 2024', nextAudit: 'Feb 2025',
  },
  {
    id: 'fatca', name: 'FATCA (US)', region: 'United States', countries: ['US'],
    category: 'Financial Reporting',
    description: 'Foreign Account Tax Compliance Act reporting',
    requirements: ['FFI registration', 'Account identification', 'Annual reporting', 'Withholding'],
    deadline: 'Annual', status: 'compliant',
    lastAudit: 'Mar 2024', nextAudit: 'Mar 2025',
  },
];

// ─── International ERP ──────────────────────────────────────────────────────────

export interface Warehouse {
  id: string;
  name: string;
  country: CountryCode;
  city: string;
  capacity: number;          // units
  utilized: number;
  items: number;
  type: 'Owned' | 'Leased' | '3PL';
}

export const WAREHOUSES: Warehouse[] = [
  { id: 'wh-1', name: 'Mumbai DC', country: 'IN', city: 'Mumbai', capacity: 50000, utilized: 38200, items: 1240, type: 'Owned' },
  { id: 'wh-2', name: 'Bengaluru Hub', country: 'IN', city: 'Bengaluru', capacity: 35000, utilized: 28900, items: 980, type: 'Owned' },
  { id: 'wh-3', name: 'Newark East', country: 'US', city: 'Newark, NJ', capacity: 40000, utilized: 31200, items: 1450, type: 'Leased' },
  { id: 'wh-4', name: 'LA West', country: 'US', city: 'Los Angeles, CA', capacity: 30000, utilized: 21600, items: 720, type: '3PL' },
  { id: 'wh-5', name: 'London DC', country: 'GB', city: 'London', capacity: 25000, utilized: 19400, items: 610, type: 'Leased' },
  { id: 'wh-6', name: 'Frankfurt Hub', country: 'DE', city: 'Frankfurt', capacity: 28000, utilized: 22300, items: 840, type: 'Owned' },
  { id: 'wh-7', name: 'Dubai Free Zone', country: 'AE', city: 'Dubai', capacity: 22000, utilized: 16800, items: 520, type: '3PL' },
  { id: 'wh-8', name: 'Singapore Logistics', country: 'SG', city: 'Singapore', capacity: 32000, utilized: 26100, items: 1130, type: 'Owned' },
  { id: 'wh-9', name: 'Sydney South', country: 'AU', city: 'Sydney', capacity: 18000, utilized: 12400, items: 380, type: 'Leased' },
  { id: 'wh-10', name: 'Tokyo Bay', country: 'JP', city: 'Tokyo', capacity: 20000, utilized: 15600, items: 290, type: '3PL' },
];

export interface InternationalPO {
  id: string;
  poNumber: string;
  vendor: string;
  vendorCountry: CountryCode;
  originCountry: CountryCode;
  destinationCountry: CountryCode;
  amount: number;
  currency: string;
  status: 'pending' | 'in-transit' | 'customs' | 'delivered' | 'cancelled';
  items: number;
  eta: string;
  incoterm: string;
}

export const INTERNATIONAL_POS: InternationalPO[] = [
  { id: 'po-1', poNumber: 'PO-2024-0891', vendor: 'Shenzhen Electronics Co.', vendorCountry: 'SG', originCountry: 'SG', destinationCountry: 'IN', amount: 184000, currency: 'USD', status: 'in-transit', items: 4200, eta: '2024-10-15', incoterm: 'CIF' },
  { id: 'po-2', poNumber: 'PO-2024-0892', vendor: 'Bayern Maschinen GmbH', vendorCountry: 'DE', originCountry: 'DE', destinationCountry: 'US', amount: 312000, currency: 'EUR', status: 'customs', items: 80, eta: '2024-10-08', incoterm: 'FOB' },
  { id: 'po-3', poNumber: 'PO-2024-0893', vendor: 'Texas Components Inc.', vendorCountry: 'US', originCountry: 'US', destinationCountry: 'GB', amount: 96000, currency: 'USD', status: 'delivered', items: 12400, eta: '2024-09-28', incoterm: 'EXW' },
  { id: 'po-4', poNumber: 'PO-2024-0894', vendor: 'Lyon Textiles SARL', vendorCountry: 'FR', originCountry: 'FR', destinationCountry: 'AE', amount: 64000, currency: 'EUR', status: 'pending', items: 8800, eta: '2024-10-22', incoterm: 'CIF' },
  { id: 'po-5', poNumber: 'PO-2024-0895', vendor: 'Osaka Precision Ltd.', vendorCountry: 'JP', originCountry: 'JP', destinationCountry: 'SG', amount: 142000, currency: 'USD', status: 'in-transit', items: 340, eta: '2024-10-12', incoterm: 'CIF' },
  { id: 'po-6', poNumber: 'PO-2024-0896', vendor: 'Manchester Steelworks', vendorCountry: 'GB', originCountry: 'GB', destinationCountry: 'DE', amount: 88000, currency: 'GBP', status: 'customs', items: 220, eta: '2024-10-05', incoterm: 'FOB' },
];

// ─── Languages ──────────────────────────────────────────────────────────────────

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
  coverage: number;        // % of UI translated
  supported: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', rtl: false, coverage: 100, supported: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false, coverage: 96, supported: true },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false, coverage: 92, supported: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false, coverage: 89, supported: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false, coverage: 94, supported: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇦🇪', rtl: true, coverage: 81, supported: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false, coverage: 78, supported: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false, coverage: 85, supported: true },
];

// ─── AI Global Advisor ──────────────────────────────────────────────────────────

export interface AIAdvisorInsight {
  id: string;
  category: 'Tax' | 'Currency' | 'Compliance' | 'Cross-Border' | 'Regulation';
  title: string;
  description: string;
  countries: string[];
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  potentialSaving: string;
}

export const AI_ADVISOR_INSIGHTS: AIAdvisorInsight[] = [
  {
    id: 'ai-1', category: 'Tax', title: 'Transfer Pricing Optimization',
    description: 'Realign inter-company pricing between IN and SG entities to leverage the India-Singapore DTAA.',
    countries: ['IN', 'SG'], impact: 'high',
    recommendation: 'Restructure royalty payments to align with arm\'s length principle and DTAA rates.',
    potentialSaving: '$240K/yr',
  },
  {
    id: 'ai-2', category: 'Currency', title: 'EUR Hedge Opportunity',
    description: 'EUR/USD volatility suggests a 6-month forward contract to lock in receivables from DE and FR.',
    countries: ['DE', 'FR'], impact: 'high',
    recommendation: 'Enter forward contracts for €480K at 1.0850 to hedge Q4 receivables.',
    potentialSaving: '$38K',
  },
  {
    id: 'ai-3', category: 'Compliance', title: 'EU VAT OSS Registration',
    description: 'Cross-border B2C sales exceed €10K threshold — OSS registration required to simplify VAT filing.',
    countries: ['DE', 'FR'], impact: 'medium',
    recommendation: 'Register in Germany as OSS identification member state before next quarter.',
    potentialSaving: 'Avoid penalties',
  },
  {
    id: 'ai-4', category: 'Cross-Border', title: 'US-India Invoice Routing',
    description: 'Routing US→IN shipments via Singapore Free Trade Zone reduces duty by 4.2%.',
    countries: ['US', 'IN', 'SG'], impact: 'high',
    recommendation: 'Use Singapore FTZ for transshipment; apply CECA preferential tariff.',
    potentialSaving: '$62K/qtr',
  },
  {
    id: 'ai-5', category: 'Regulation', title: 'UAE Corporate Tax Filing',
    description: 'UAE corporate tax (9%) effective June 2023 — first return due for FY2024.',
    countries: ['AE'], impact: 'medium',
    recommendation: 'Register with FTA, file Q1 2025 return, maintain transfer pricing documentation.',
    potentialSaving: 'Compliance',
  },
  {
    id: 'ai-6', category: 'Tax', title: 'UK R&D Tax Credit',
    description: 'Software development in UK entity qualifies for SME R&D tax credit at 186% enhancement.',
    countries: ['GB'], impact: 'high',
    recommendation: 'File R&D claim for £420K qualifying expenditure; expect £78K credit.',
    potentialSaving: '£78K',
  },
];

// ─── Cross-Border Payments ──────────────────────────────────────────────────────

export interface CrossBorderPayment {
  id: string;
  reference: string;
  type: 'invoice' | 'collection' | 'payout' | 'reconciliation';
  direction: 'inbound' | 'outbound';
  fromCountry: CountryCode;
  toCountry: CountryCode;
  amount: number;
  currency: string;
  amountUSD: number;
  method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fxRate: number;
  fees: number;
  date: string;
  counterparty: string;
}

export const CROSS_BORDER_PAYMENTS: CrossBorderPayment[] = [
  { id: 'cbp-1', reference: 'INV-INT-0891', type: 'collection', direction: 'inbound', fromCountry: 'US', toCountry: 'IN', amount: 84000, currency: 'USD', amountUSD: 84000, method: 'Wise', status: 'completed', fxRate: 83.2, fees: 344, date: '2024-09-28', counterparty: 'Global Tech Inc.' },
  { id: 'cbp-2', reference: 'INV-INT-0892', type: 'collection', direction: 'inbound', fromCountry: 'DE', toCountry: 'IN', amount: 52000, currency: 'EUR', amountUSD: 56160, method: 'Stripe SEPA', status: 'processing', fxRate: 90.4, fees: 1180, date: '2024-10-01', counterparty: 'Bayern GmbH' },
  { id: 'cbp-3', reference: 'PO-INT-0893', type: 'payout', direction: 'outbound', fromCountry: 'IN', toCountry: 'JP', amount: 14200000, currency: 'JPY', amountUSD: 95140, method: 'HSBC', status: 'pending', fxRate: 0.0067, fees: 420, date: '2024-10-02', counterparty: 'Osaka Precision' },
  { id: 'cbp-4', reference: 'INV-INT-0894', type: 'collection', direction: 'inbound', fromCountry: 'GB', toCountry: 'IN', amount: 38000, currency: 'GBP', amountUSD: 48260, method: 'Wise', status: 'completed', fxRate: 105.6, fees: 156, date: '2024-09-30', counterparty: 'Manchester Steel' },
  { id: 'cbp-5', reference: 'PO-INT-0895', type: 'payout', direction: 'outbound', fromCountry: 'US', toCountry: 'SG', amount: 96000, currency: 'USD', amountUSD: 96000, method: 'Mercury', status: 'completed', fxRate: 1.35, fees: 15, date: '2024-09-29', counterparty: 'Singapore Logistics' },
  { id: 'cbp-6', reference: 'INV-INT-0896', type: 'invoice', direction: 'outbound', fromCountry: 'IN', toCountry: 'AE', amount: 180000, currency: 'AED', amountUSD: 48600, method: 'Razorpay Intl', status: 'processing', fxRate: 22.7, fees: 840, date: '2024-10-03', counterparty: 'Dubai Traders LLC' },
  { id: 'cbp-7', reference: 'REC-INT-0897', type: 'reconciliation', direction: 'inbound', fromCountry: 'FR', toCountry: 'IN', amount: 24000, currency: 'EUR', amountUSD: 25920, method: 'Stripe SEPA', status: 'completed', fxRate: 90.4, fees: 540, date: '2024-09-27', counterparty: 'Lyon Textiles' },
  { id: 'cbp-8', reference: 'INV-INT-0898', type: 'collection', direction: 'inbound', fromCountry: 'AU', toCountry: 'IN', amount: 62000, currency: 'AUD', amountUSD: 40920, method: 'Wise', status: 'pending', fxRate: 54.8, fees: 168, date: '2024-10-04', counterparty: 'Sydney Retail Pty' },
];

// ─── Global Reports ─────────────────────────────────────────────────────────────

export interface GlobalReport {
  id: string;
  name: string;
  category: 'Country' | 'Currency' | 'Cash Flow' | 'P&L' | 'Regional' | 'Tax';
  scope: string;
  period: string;
  generatedOn: string;
  format: 'PDF' | 'XLSX' | 'CSV';
  status: 'ready' | 'generating' | 'scheduled';
}

export const GLOBAL_REPORTS: GlobalReport[] = [
  { id: 'rpt-1', name: 'India — Q3 FY24 GST Summary', category: 'Country', scope: 'India', period: 'Q3 FY24', generatedOn: '2024-09-30', format: 'PDF', status: 'ready' },
  { id: 'rpt-2', name: 'USA — State Sales Tax Report', category: 'Tax', scope: 'United States', period: 'Q3 2024', generatedOn: '2024-09-30', format: 'XLSX', status: 'ready' },
  { id: 'rpt-3', name: 'Global Cash Flow — Q3 2024', category: 'Cash Flow', scope: 'All Countries', period: 'Q3 2024', generatedOn: '2024-10-01', format: 'PDF', status: 'ready' },
  { id: 'rpt-4', name: 'EUR Consolidated P&L', category: 'P&L', scope: 'EU Region', period: 'Q3 2024', generatedOn: '2024-10-01', format: 'XLSX', status: 'ready' },
  { id: 'rpt-5', name: 'Multi-Currency Exposure Report', category: 'Currency', scope: 'All Currencies', period: 'Sep 2024', generatedOn: '2024-10-02', format: 'PDF', status: 'ready' },
  { id: 'rpt-6', name: 'APAC Regional Analytics', category: 'Regional', scope: 'APAC', period: 'Q3 2024', generatedOn: '2024-10-02', format: 'PDF', status: 'generating' },
  { id: 'rpt-7', name: 'Cross-Border Transfer Pricing', category: 'Tax', scope: 'Global', period: 'FY24', generatedOn: '2024-10-03', format: 'XLSX', status: 'scheduled' },
  { id: 'rpt-8', name: 'UK — VAT MTD Report', category: 'Country', scope: 'United Kingdom', period: 'Q3 2024', generatedOn: '2024-10-03', format: 'CSV', status: 'ready' },
];

// ─── Global Dashboard KPIs ──────────────────────────────────────────────────────

export const GLOBAL_KPIS = {
  totalRevenueUSD: 5684000,
  totalExpensesUSD: 4148000,
  netCashFlowUSD: 1536000,
  totalTaxLiabilityUSD: 842000,
  countriesActive: 10,
  currenciesActive: 9,
  banksConnected: 7,
  complianceScore: 91,
  exchangeGainLossUSD: 42800,
  crossBorderVolumeUSD: 594000,
  avgGrowthScore: 78,
  avgRiskScore: 21,
};

// ─── Exchange Rate History (deterministic) ──────────────────────────────────────

export const EXCHANGE_RATE_HISTORY = [
  { month: 'Apr', usdInr: 83.2, usdEur: 0.93, usdGbp: 0.79, usdJpy: 151.4 },
  { month: 'May', usdInr: 83.4, usdEur: 0.92, usdGbp: 0.79, usdJpy: 157.3 },
  { month: 'Jun', usdInr: 83.5, usdEur: 0.93, usdGbp: 0.79, usdJpy: 160.8 },
  { month: 'Jul', usdInr: 83.7, usdEur: 0.92, usdGbp: 0.78, usdJpy: 155.2 },
  { month: 'Aug', usdInr: 83.9, usdEur: 0.91, usdGbp: 0.78, usdJpy: 149.6 },
  { month: 'Sep', usdInr: 83.2, usdEur: 0.92, usdGbp: 0.79, usdJpy: 148.3 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

export const fmtUSD = (n: number): string =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const fmtINR = (n: number): string =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

export const statusColor = (status: string): string => {
  switch (status) {
    case 'compliant':
    case 'completed':
    case 'connected':
    case 'delivered':
    case 'ready':
      return 'emerald';
    case 'in-progress':
    case 'processing':
    case 'in-transit':
    case 'generating':
      return 'amber';
    case 'attention':
    case 'pending':
    case 'customs':
    case 'failed':
      return 'rose';
    case 'coming-soon':
    case 'upcoming':
    case 'scheduled':
    case 'cancelled':
      return 'slate';
    default:
      return 'slate';
  }
};
