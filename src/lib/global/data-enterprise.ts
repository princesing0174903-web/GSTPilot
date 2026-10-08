// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: ENTERPRISE DATA EXPANSION (Billion-Dollar Tier)
//
// Supplementary enterprise-grade data layer for Global Expansion modules.
// Adds: international entities, transfer pricing, global payroll, FX hedging,
// audit trail, country risk, intercompany loans, trade treaties, customs,
// consolidated financials, global AR/AP, tax credits, insurance, ESG, cash
// pooling, board governance, revenue breakdown, FX forward curve, SLA monitoring.
//
// NO API calls. NO Math.random. Deterministic & typed.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CountryCode } from './data';

// ─── International Entities (Subsidiaries) ─────────────────────────────────────

export interface InternationalEntity {
  id: string;
  name: string;
  countryCode: CountryCode;
  entity: string;          // Pte Ltd / LLC / GmbH / Ltd / SARL / KK
  ownership: number;       // %
  incorporationDate: string;
  taxId: string;
  revenue: number;         // USD
  expenses: number;        // USD
  netIncome: number;       // USD
  assets: number;          // USD
  liabilities: number;     // USD
  equity: number;          // USD
  headcount: number;
  currency: string;
  status: 'active' | 'dormant' | 'pending';
  segment: string;
}

export const INTERNATIONAL_ENTITIES: InternationalEntity[] = [
  { id: 'ent-in-1', name: 'VEYRO India Pvt Ltd', countryCode: 'IN', entity: 'Pvt Ltd', ownership: 100, incorporationDate: '2019-03-15', taxId: 'GSTIN-27ABCDE1234F1Z5', revenue: 2840000, expenses: 1980000, netIncome: 860000, assets: 4200000, liabilities: 1680000, equity: 2520000, headcount: 342, currency: 'INR', status: 'active', segment: 'Core SaaS' },
  { id: 'ent-in-2', name: 'VEYRO R&D India Pvt Ltd', countryCode: 'IN', entity: 'Pvt Ltd', ownership: 100, incorporationDate: '2021-07-01', taxId: 'GSTIN-27FGHIJ5678K1Z2', revenue: 0, expenses: 420000, netIncome: -420000, assets: 180000, liabilities: 60000, equity: 120000, headcount: 86, currency: 'INR', status: 'active', segment: 'R&D' },
  { id: 'ent-us-1', name: 'VEYRO Inc (Delaware)', countryCode: 'US', entity: 'LLC', ownership: 100, incorporationDate: '2020-01-20', taxId: 'EIN 88-1234567', revenue: 1240000, expenses: 892000, netIncome: 348000, assets: 2100000, liabilities: 740000, equity: 1360000, headcount: 128, currency: 'USD', status: 'active', segment: 'Core SaaS' },
  { id: 'ent-us-2', name: 'VEYRO Payments LLC', countryCode: 'US', entity: 'LLC', ownership: 100, incorporationDate: '2022-09-14', taxId: 'EIN 88-7654321', revenue: 380000, expenses: 240000, netIncome: 140000, assets: 680000, liabilities: 220000, equity: 460000, headcount: 34, currency: 'USD', status: 'active', segment: 'Payments' },
  { id: 'ent-gb-1', name: 'VEYRO UK Ltd', countryCode: 'GB', entity: 'Ltd', ownership: 100, incorporationDate: '2020-06-12', taxId: 'CRN 12894756', revenue: 480000, expenses: 356000, netIncome: 124000, assets: 920000, liabilities: 340000, equity: 580000, headcount: 64, currency: 'GBP', status: 'active', segment: 'Core SaaS' },
  { id: 'ent-sg-1', name: 'VEYRO Asia Pte Ltd', countryCode: 'SG', entity: 'Pte Ltd', ownership: 100, incorporationDate: '2021-02-08', taxId: 'UEN 202103847K', revenue: 610000, expenses: 427000, netIncome: 183000, assets: 1180000, liabilities: 380000, equity: 800000, headcount: 92, currency: 'SGD', status: 'active', segment: 'APAC HQ' },
  { id: 'ent-ae-1', name: 'VEYRO FZ-LLC', countryCode: 'AE', entity: 'FZ-LLC', ownership: 100, incorporationDate: '2022-03-01', taxId: 'TRN 100123456700003', revenue: 520000, expenses: 364000, netIncome: 156000, assets: 840000, liabilities: 260000, equity: 580000, headcount: 48, currency: 'AED', status: 'active', segment: 'MENA HQ' },
  { id: 'ent-de-1', name: 'VEYRO GmbH', countryCode: 'DE', entity: 'GmbH', ownership: 100, incorporationDate: '2021-11-15', taxId: 'HRB 156842 B', revenue: 720000, expenses: 548000, netIncome: 172000, assets: 1340000, liabilities: 520000, equity: 820000, headcount: 76, currency: 'EUR', status: 'active', segment: 'EU HQ' },
  { id: 'ent-fr-1', name: 'VEYRO SARL', countryCode: 'FR', entity: 'SARL', ownership: 100, incorporationDate: '2022-05-20', taxId: 'SIRET 89342156700018', revenue: 540000, expenses: 412000, netIncome: 128000, assets: 680000, liabilities: 280000, equity: 400000, headcount: 52, currency: 'EUR', status: 'active', segment: 'EU Sales' },
  { id: 'ent-au-1', name: 'VEYRO Pty Ltd', countryCode: 'AU', entity: 'Pty Ltd', ownership: 100, incorporationDate: '2021-09-10', taxId: 'ACN 654321987', revenue: 380000, expenses: 274000, netIncome: 106000, assets: 540000, liabilities: 180000, equity: 360000, headcount: 38, currency: 'AUD', status: 'active', segment: 'ANZ Sales' },
  { id: 'ent-ca-1', name: 'VEYRO Canada Inc', countryCode: 'CA', entity: 'Inc', ownership: 100, incorporationDate: '2022-01-18', taxId: 'BN 876543210 RC0001', revenue: 640000, expenses: 458000, netIncome: 182000, assets: 720000, liabilities: 240000, equity: 480000, headcount: 44, currency: 'CAD', status: 'active', segment: 'NA Sales' },
  { id: 'ent-jp-1', name: 'VEYRO K.K.', countryCode: 'JP', entity: 'K.K.', ownership: 100, incorporationDate: '2023-04-03', taxId: '法人番号 8-1234-5678901', revenue: 680000, expenses: 480000, netIncome: 200000, assets: 860000, liabilities: 320000, equity: 540000, headcount: 36, currency: 'JPY', status: 'active', segment: 'JP Sales' },
  { id: 'ent-in-3', name: 'VEYRO Infrastructure India', countryCode: 'IN', entity: 'Pvt Ltd', ownership: 100, incorporationDate: '2023-06-01', taxId: 'GSTIN-27KLMNOP9012Q1Z8', revenue: 0, expenses: 180000, netIncome: -180000, assets: 320000, liabilities: 80000, equity: 240000, headcount: 24, currency: 'INR', status: 'active', segment: 'Infrastructure' },
  { id: 'ent-sg-2', name: 'VEYRO Treasury Pte Ltd', countryCode: 'SG', entity: 'Pte Ltd', ownership: 100, incorporationDate: '2023-08-15', taxId: 'UEN 202318923H', revenue: 24000, expenses: 86000, netIncome: -62000, assets: 2400000, liabilities: 1800000, equity: 600000, headcount: 8, currency: 'SGD', status: 'active', segment: 'Treasury' },
  { id: 'ent-us-3', name: 'VEYRO AI Labs Inc', countryCode: 'US', entity: 'Inc', ownership: 100, incorporationDate: '2023-10-01', taxId: 'EIN 88-9876543', revenue: 0, expenses: 320000, netIncome: -320000, assets: 140000, liabilities: 40000, equity: 100000, headcount: 28, currency: 'USD', status: 'active', segment: 'AI Research' },
];

// ─── Transfer Pricing ─────────────────────────────────────────────────────────

export interface TransferPricingTxn {
  id: string;
  fromEntity: string;
  toEntity: string;
  fromCountry: CountryCode;
  toCountry: CountryCode;
  type: 'Royalty' | 'Service Fee' | 'Management Fee' | 'Intercompany Sale' | 'Cost Share' | 'Loan Interest';
  amount: number;
  currency: string;
  amountUSD: number;
  method: 'CUP' | 'Resale Price' | 'Cost Plus' | 'TNMM' | 'Profit Split';
  markupPct: number;
  armLengthRange: string;
  documentation: 'Current' | 'Expiring' | 'Overdue';
  riskLevel: 'low' | 'medium' | 'high';
}

export const TRANSFER_PRICING: TransferPricingTxn[] = [
  { id: 'tp-1', fromEntity: 'VEYRO India Pvt Ltd', toEntity: 'VEYRO Inc (Delaware)', fromCountry: 'IN', toCountry: 'US', type: 'Royalty', amount: 18000000, currency: 'INR', amountUSD: 216000, method: 'CUP', markupPct: 0, armLengthRange: '$200K–$240K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-2', fromEntity: 'VEYRO Inc (Delaware)', toEntity: 'VEYRO India Pvt Ltd', fromCountry: 'US', toCountry: 'IN', type: 'Service Fee', amount: 340000, currency: 'USD', amountUSD: 340000, method: 'Cost Plus', markupPct: 12, armLengthRange: '$320K–$360K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-3', fromEntity: 'VEYRO Asia Pte Ltd', toEntity: 'VEYRO India Pvt Ltd', fromCountry: 'SG', toCountry: 'IN', type: 'Management Fee', amount: 420000, currency: 'SGD', amountUSD: 311000, method: 'TNMM', markupPct: 8, armLengthRange: '$290K–$330K', documentation: 'Current', riskLevel: 'medium' },
  { id: 'tp-4', fromEntity: 'VEYRO GmbH', toEntity: 'VEYRO SARL', fromCountry: 'DE', toCountry: 'FR', type: 'Intercompany Sale', amount: 280000, currency: 'EUR', amountUSD: 302000, method: 'Resale Price', markupPct: 15, armLengthRange: '$285K–$320K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-5', fromEntity: 'VEYRO R&D India Pvt Ltd', toEntity: 'VEYRO Inc (Delaware)', fromCountry: 'IN', toCountry: 'US', type: 'Cost Share', amount: 12000000, currency: 'INR', amountUSD: 144000, method: 'Profit Split', markupPct: 0, armLengthRange: '$130K–$160K', documentation: 'Expiring', riskLevel: 'medium' },
  { id: 'tp-6', fromEntity: 'VEYRO FZ-LLC', toEntity: 'VEYRO Asia Pte Ltd', fromCountry: 'AE', toCountry: 'SG', type: 'Service Fee', amount: 680000, currency: 'AED', amountUSD: 184000, method: 'Cost Plus', markupPct: 10, armLengthRange: '$170K–$200K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-7', fromEntity: 'VEYRO UK Ltd', toEntity: 'VEYRO India Pvt Ltd', fromCountry: 'GB', toCountry: 'IN', type: 'Intercompany Sale', amount: 240000, currency: 'GBP', amountUSD: 305000, method: 'CUP', markupPct: 0, armLengthRange: '$290K–$320K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-8', fromEntity: 'VEYRO K.K.', toEntity: 'VEYRO Asia Pte Ltd', fromCountry: 'JP', toCountry: 'SG', type: 'Management Fee', amount: 18000000, currency: 'JPY', amountUSD: 121000, method: 'TNMM', markupPct: 7, armLengthRange: '$110K–$135K', documentation: 'Overdue', riskLevel: 'high' },
  { id: 'tp-9', fromEntity: 'VEYRO Pty Ltd', toEntity: 'VEYRO Asia Pte Ltd', fromCountry: 'AU', toCountry: 'SG', type: 'Service Fee', amount: 280000, currency: 'AUD', amountUSD: 185000, method: 'Cost Plus', markupPct: 11, armLengthRange: '$175K–$195K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-10', fromEntity: 'VEYRO Canada Inc', toEntity: 'VEYRO Inc (Delaware)', fromCountry: 'CA', toCountry: 'US', type: 'Intercompany Sale', amount: 540000, currency: 'CAD', amountUSD: 394000, method: 'Resale Price', markupPct: 14, armLengthRange: '$375K–$415K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-11', fromEntity: 'VEYRO Treasury Pte Ltd', toEntity: 'VEYRO FZ-LLC', fromCountry: 'SG', toCountry: 'AE', type: 'Loan Interest', amount: 96000, currency: 'SGD', amountUSD: 71000, method: 'CUP', markupPct: 0, armLengthRange: '$65K–$78K', documentation: 'Current', riskLevel: 'low' },
  { id: 'tp-12', fromEntity: 'VEYRO AI Labs Inc', toEntity: 'VEYRO R&D India Pvt Ltd', fromCountry: 'US', toCountry: 'IN', type: 'Cost Share', amount: 220000, currency: 'USD', amountUSD: 220000, method: 'Profit Split', markupPct: 0, armLengthRange: '$200K–$250K', documentation: 'Expiring', riskLevel: 'medium' },
];

// ─── Global Payroll ───────────────────────────────────────────────────────────

export interface GlobalPayrollEntry {
  countryCode: CountryCode;
  entity: string;
  headcount: number;
  grossPayroll: number;      // local currency / month
  currency: string;
  grossPayrollUSD: number;
  employerTax: number;       // USD
  employeeTax: number;       // USD
  netPayroll: number;        // USD
  avgSalary: number;         // USD
  payDate: string;
  status: 'processed' | 'pending' | 'review';
}

export const GLOBAL_PAYROLL: GlobalPayrollEntry[] = [
  { countryCode: 'IN', entity: 'VEYRO India Pvt Ltd', headcount: 342, grossPayroll: 42800000, currency: 'INR', grossPayrollUSD: 514000, employerTax: 61700, employeeTax: 56540, netPayroll: 395760, avgSalary: 1502, payDate: '2024-09-30', status: 'processed' },
  { countryCode: 'IN', entity: 'VEYRO R&D India Pvt Ltd', headcount: 86, grossPayroll: 12800000, currency: 'INR', grossPayrollUSD: 154000, employerTax: 18480, employeeTax: 16940, netPayroll: 118580, avgSalary: 1791, payDate: '2024-09-30', status: 'processed' },
  { countryCode: 'US', entity: 'VEYRO Inc (Delaware)', headcount: 128, grossPayroll: 840000, currency: 'USD', grossPayrollUSD: 840000, employerTax: 128520, employeeTax: 161280, netPayroll: 550200, avgSalary: 6563, payDate: '2024-09-30', status: 'processed' },
  { countryCode: 'US', entity: 'VEYRO Payments LLC', headcount: 34, grossPayroll: 248000, currency: 'USD', grossPayrollUSD: 248000, employerTax: 37940, employeeTax: 47620, netPayroll: 162440, avgSalary: 7294, payDate: '2024-09-30', status: 'processed' },
  { countryCode: 'US', entity: 'VEYRO AI Labs Inc', headcount: 28, grossPayroll: 320000, currency: 'USD', grossPayrollUSD: 320000, employerTax: 48960, employeeTax: 61440, netPayroll: 209600, avgSalary: 11429, payDate: '2024-09-30', status: 'pending' },
  { countryCode: 'GB', entity: 'VEYRO UK Ltd', headcount: 64, grossPayroll: 320000, currency: 'GBP', grossPayrollUSD: 406000, employerTax: 56030, employeeTax: 91400, netPayroll: 258570, avgSalary: 6344, payDate: '2024-09-28', status: 'processed' },
  { countryCode: 'SG', entity: 'VEYRO Asia Pte Ltd', headcount: 92, grossPayroll: 680000, currency: 'SGD', grossPayrollUSD: 503000, employerTax: 85510, employeeTax: 50300, netPayroll: 367190, avgSalary: 5467, payDate: '2024-09-25', status: 'processed' },
  { countryCode: 'AE', entity: 'VEYRO FZ-LLC', headcount: 48, grossPayroll: 720000, currency: 'AED', grossPayrollUSD: 194000, employerTax: 0, employeeTax: 0, netPayroll: 194000, avgSalary: 4042, payDate: '2024-09-28', status: 'processed' },
  { countryCode: 'DE', entity: 'VEYRO GmbH', headcount: 76, grossPayroll: 560000, currency: 'EUR', grossPayrollUSD: 605000, employerTax: 119200, employeeTax: 152460, netPayroll: 333340, avgSalary: 7961, payDate: '2024-09-28', status: 'processed' },
  { countryCode: 'FR', entity: 'VEYRO SARL', headcount: 52, grossPayroll: 340000, currency: 'EUR', grossPayrollUSD: 367000, employerTax: 80740, employeeTax: 102760, netPayroll: 183500, avgSalary: 7058, payDate: '2024-09-28', status: 'review' },
  { countryCode: 'AU', entity: 'VEYRO Pty Ltd', headcount: 38, grossPayroll: 340000, currency: 'AUD', grossPayrollUSD: 224000, employerTax: 24640, employeeTax: 47490, netPayroll: 151870, avgSalary: 5895, payDate: '2024-09-26', status: 'processed' },
  { countryCode: 'CA', entity: 'VEYRO Canada Inc', headcount: 44, grossPayroll: 380000, currency: 'CAD', grossPayrollUSD: 277000, employerTax: 39330, employeeTax: 55400, netPayroll: 182270, avgSalary: 6295, payDate: '2024-09-28', status: 'processed' },
  { countryCode: 'JP', entity: 'VEYRO K.K.', headcount: 36, grossPayroll: 58000000, currency: 'JPY', grossPayrollUSD: 389000, employerTax: 63800, employeeTax: 54460, netPayroll: 270740, avgSalary: 10806, payDate: '2024-09-25', status: 'processed' },
  { countryCode: 'IN', entity: 'VEYRO Infrastructure India', headcount: 24, grossPayroll: 2800000, currency: 'INR', grossPayrollUSD: 33600, employerTax: 4030, employeeTax: 3700, netPayroll: 25870, avgSalary: 1400, payDate: '2024-09-30', status: 'processed' },
  { countryCode: 'SG', entity: 'VEYRO Treasury Pte Ltd', headcount: 8, grossPayroll: 96000, currency: 'SGD', grossPayrollUSD: 71000, employerTax: 12070, employeeTax: 7100, netPayroll: 51830, avgSalary: 8875, payDate: '2024-09-25', status: 'processed' },
];

// ─── FX Hedging ───────────────────────────────────────────────────────────────

export interface FXHedge {
  id: string;
  instrument: 'Forward' | 'Option' | 'NDF' | 'Cross-Currency Swap';
  pair: string;
  direction: 'Buy' | 'Sell';
  notional: number;
  notionalUSD: number;
  rate: number;
  maturity: string;
  premium: number;
  status: 'active' | 'matured' | 'pending';
  hedgeRatio: number;
  effectiveness: number;
  counterparty: string;
}

export const FX_HEDGES: FXHedge[] = [
  { id: 'fxh-1', instrument: 'Forward', pair: 'EUR/USD', direction: 'Sell', notional: 480000, notionalUSD: 518400, rate: 1.0850, maturity: '2025-03-31', premium: 0, status: 'active', hedgeRatio: 72, effectiveness: 98.4, counterparty: 'HSBC' },
  { id: 'fxh-2', instrument: 'Forward', pair: 'GBP/USD', direction: 'Sell', notional: 320000, notionalUSD: 406400, rate: 1.2700, maturity: '2024-12-31', premium: 0, status: 'active', hedgeRatio: 68, effectiveness: 96.8, counterparty: 'Citibank' },
  { id: 'fxh-3', instrument: 'Option', pair: 'JPY/USD', direction: 'Buy', notional: 14200000, notionalUSD: 95140, rate: 0.0067, maturity: '2025-06-30', premium: 2840, status: 'active', hedgeRatio: 55, effectiveness: 91.2, counterparty: 'MUFG' },
  { id: 'fxh-4', instrument: 'Forward', pair: 'AUD/USD', direction: 'Sell', notional: 280000, notionalUSD: 184800, rate: 0.6600, maturity: '2024-12-31', premium: 0, status: 'active', hedgeRatio: 60, effectiveness: 94.5, counterparty: 'HSBC' },
  { id: 'fxh-5', instrument: 'Forward', pair: 'SGD/USD', direction: 'Sell', notional: 540000, notionalUSD: 399600, rate: 0.7400, maturity: '2025-03-31', premium: 0, status: 'active', hedgeRatio: 65, effectiveness: 95.7, counterparty: 'DBS' },
  { id: 'fxh-6', instrument: 'NDF', pair: 'INR/USD', direction: 'Buy', notional: 28000000, notionalUSD: 336000, rate: 83.20, maturity: '2025-01-31', premium: 0, status: 'active', hedgeRatio: 48, effectiveness: 89.3, counterparty: 'HSBC' },
  { id: 'fxh-7', instrument: 'Option', pair: 'EUR/USD', direction: 'Buy', notional: 240000, notionalUSD: 259200, rate: 1.0900, maturity: '2025-09-30', premium: 4200, status: 'pending', hedgeRatio: 0, effectiveness: 0, counterparty: 'Deutsche Bank' },
  { id: 'fxh-8', instrument: 'Cross-Currency Swap', pair: 'USD/SGD', direction: 'Sell', notional: 1200000, notionalUSD: 1200000, rate: 0.7400, maturity: '2026-03-31', premium: 0, status: 'active', hedgeRatio: 82, effectiveness: 99.1, counterparty: 'HSBC' },
  { id: 'fxh-9', instrument: 'Forward', pair: 'CAD/USD', direction: 'Sell', notional: 420000, notionalUSD: 306600, rate: 0.7300, maturity: '2024-12-31', premium: 0, status: 'active', hedgeRatio: 58, effectiveness: 93.8, counterparty: 'RBC' },
  { id: 'fxh-10', instrument: 'Forward', pair: 'AED/USD', direction: 'Sell', notional: 680000, notionalUSD: 183600, rate: 0.2723, maturity: '2025-03-31', premium: 0, status: 'matured', hedgeRatio: 0, effectiveness: 97.2, counterparty: 'Emirates NBD' },
];

// ─── Global Audit Trail ───────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  module: string;
  countryCode: CountryCode | 'GLOBAL';
  entityType: string;
  entityId: string;
  severity: 'info' | 'warning' | 'critical';
  ipAddress: string;
  detail: string;
}

export const AUDIT_TRAIL: AuditEntry[] = [
  { id: 'aud-1', timestamp: '2024-10-04 14:32:18', actor: 'priya.sharma@gstpilot.in', action: 'APPROVE_CROSS_BORDER', module: 'Cross-Border Payments', countryCode: 'IN', entityType: 'Payment', entityId: 'cbp-3', severity: 'info', ipAddress: '103.21.244.18', detail: 'Approved JPY 14,200,000 outbound payment to Osaka Precision' },
  { id: 'aud-2', timestamp: '2024-10-04 13:18:42', actor: 'james.wilson@gstpilot.com', action: 'FILE_GST_RETURN', module: 'Compliance', countryCode: 'IN', entityType: 'Return', entityId: 'GSTR-3B-Sep-2024', severity: 'info', ipAddress: '49.36.82.104', detail: 'Filed GSTR-3B for September 2024 — tax liability ₹15.2Cr' },
  { id: 'aud-3', timestamp: '2024-10-04 11:45:09', actor: 'system', action: 'FX_RATE_UPDATE', module: 'Multi-Currency', countryCode: 'GLOBAL', entityType: 'Rate', entityId: 'EUR-USD-2024-10-04', severity: 'info', ipAddress: 'internal', detail: 'EUR/USD rate updated to 1.0850 (prev: 1.0836)' },
  { id: 'aud-4', timestamp: '2024-10-04 10:22:33', actor: 'marie.dupont@gstpilot.fr', action: 'CREATE_INVOICE', module: 'Invoicing', countryCode: 'FR', entityType: 'Invoice', entityId: 'INV-FR-2024-0892', severity: 'info', ipAddress: '82.64.32.18', detail: 'Created invoice €52,000 to Bayern GmbH' },
  { id: 'aud-5', timestamp: '2024-10-04 09:14:51', actor: 'system', action: 'COMPLIANCE_ALERT', module: 'Compliance', countryCode: 'CA', entityType: 'Framework', entityId: 'ca-gst-hst', severity: 'warning', ipAddress: 'internal', detail: 'Canada GST/HST filing window opens in 14 days — status: attention' },
  { id: 'aud-6', timestamp: '2024-10-03 18:42:07', actor: 'raj.kumar@gstpilot.in', action: 'TRANSFER_PRICING_REVIEW', module: 'Transfer Pricing', countryCode: 'IN', entityType: 'Transaction', entityId: 'tp-8', severity: 'warning', ipAddress: '103.21.244.18', detail: 'TP documentation for JP→SG management fee flagged as overdue' },
  { id: 'aud-7', timestamp: '2024-10-03 16:30:22', actor: 'sarah.chen@gstpilot.sg', action: 'APPROVE_HEDGE', module: 'FX Hedging', countryCode: 'SG', entityType: 'Hedge', entityId: 'fxh-1', severity: 'info', ipAddress: '119.73.144.82', detail: 'Approved EUR/USD forward €480K at 1.0850 maturing 2025-03-31' },
  { id: 'aud-8', timestamp: '2024-10-03 15:18:44', actor: 'david.mueller@gstpilot.de', action: 'VAT_OSS_FILING', module: 'Compliance', countryCode: 'DE', entityType: 'Return', entityId: 'OSS-Q3-2024', severity: 'info', ipAddress: '91.64.32.108', detail: 'Filed EU VAT OSS return for Q3 2024 — 14 member states' },
  { id: 'aud-9', timestamp: '2024-10-03 14:02:19', actor: 'system', action: 'FAILED_LOGIN_BLOCK', module: 'Security', countryCode: 'GLOBAL', entityType: 'Session', entityId: 'sess-8932', severity: 'critical', ipAddress: '185.220.101.42', detail: 'Blocked login attempt — 5 failed tries from TOR exit node' },
  { id: 'aud-10', timestamp: '2024-10-03 12:45:33', actor: 'yuki.tanaka@gstpilot.jp', action: 'CUSTOMS_DECLARATION', module: 'Trade', countryCode: 'JP', entityType: 'Customs', entityId: 'CUS-2024-0891', severity: 'info', ipAddress: '126.243.82.14', detail: 'Filed customs declaration for Osaka→Singapore shipment' },
  { id: 'aud-11', timestamp: '2024-10-03 11:20:08', actor: 'olivia.brown@gstpilot.au', action: 'PAYROLL_RUN', module: 'Payroll', countryCode: 'AU', entityType: 'Payroll', entityId: 'PAY-AU-Sep-2024', severity: 'info', ipAddress: '203.219.84.16', detail: 'Processed September payroll — 38 employees, AUD 340K gross' },
  { id: 'aud-12', timestamp: '2024-10-03 10:08:41', actor: 'system', action: 'BANK_RECONCILIATION', module: 'Banking', countryCode: 'IN', entityType: 'Reconciliation', entityId: 'RECON-IN-Sep-2024', severity: 'info', ipAddress: 'internal', detail: 'Auto-reconciled 2,847 transactions across 4 bank accounts' },
];

// ─── Country Risk Assessment ──────────────────────────────────────────────────

export interface CountryRisk {
  countryCode: CountryCode;
  politicalRisk: number;      // 0-100 (lower = better)
  economicRisk: number;
  currencyRisk: number;
  complianceRisk: number;
  operationalRisk: number;
  sovereignRating: string;    // S&P style
  currencyPeg: string;
  capitalControls: 'None' | 'Low' | 'Moderate' | 'High';
  sanctionsStatus: 'Clear' | 'Monitored' | 'Restricted';
  riskFactors: string[];
  mitigationActions: string[];
}

export const COUNTRY_RISKS: CountryRisk[] = [
  { countryCode: 'IN', politicalRisk: 28, economicRisk: 32, currencyRisk: 38, complianceRisk: 22, operationalRisk: 26, sovereignRating: 'BBB-', currencyPeg: 'Float', capitalControls: 'Moderate', sanctionsStatus: 'Clear', riskFactors: ['INR volatility vs USD', 'GST rate changes', 'FEMA compliance'], mitigationActions: ['INR NDF hedge 48%', 'Automated GSTR filing', 'FEMA pre-approval for >$25K'] },
  { countryCode: 'US', politicalRisk: 18, economicRisk: 15, currencyRisk: 5, complianceRisk: 20, operationalRisk: 14, sovereignRating: 'AA+', currencyPeg: 'Reserve', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['State sales tax nexus complexity', 'SOX compliance', 'FATCA reporting'], mitigationActions: ['Economic nexus engine', 'SOX quarterly audit', 'FATCA auto-filing'] },
  { countryCode: 'GB', politicalRisk: 24, economicRisk: 22, currencyRisk: 28, complianceRisk: 18, operationalRisk: 16, sovereignRating: 'AA', currencyPeg: 'Float', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['Post-Brexit trade rules', 'GBP volatility', 'VAT MTD'], mitigationActions: ['GBP forward hedge 68%', 'MTD-compatible filing', 'Customs declaration automation'] },
  { countryCode: 'SG', politicalRisk: 8, economicRisk: 12, currencyRisk: 14, complianceRisk: 8, operationalRisk: 10, sovereignRating: 'AAA', currencyPeg: 'Managed', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['MAS regulatory changes', 'SGD managed float'], mitigationActions: ['MAS compliance monitoring', 'SGD forward hedge 65%'] },
  { countryCode: 'AE', politicalRisk: 15, economicRisk: 18, currencyRisk: 8, complianceRisk: 20, operationalRisk: 14, sovereignRating: 'AA-', currencyPeg: 'USD Peg', capitalControls: 'Low', sanctionsStatus: 'Monitored', riskFactors: ['New 9% corporate tax', 'VAT compliance', 'Sanctions screening (dual-use)'], mitigationActions: ['FTA registration complete', 'VAT auto-filing', 'Enhanced sanctions screening'] },
  { countryCode: 'DE', politicalRisk: 16, economicRisk: 20, currencyRisk: 12, complianceRisk: 16, operationalRisk: 14, sovereignRating: 'AAA', currencyPeg: 'EUR', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['EU sanctions compliance', 'Supply chain act', 'Energy costs'], mitigationActions: ['EU sanctions screening', 'Supply chain audit', 'Energy cost hedging'] },
  { countryCode: 'FR', politicalRisk: 26, economicRisk: 24, currencyRisk: 12, complianceRisk: 22, operationalRisk: 18, sovereignRating: 'AA-', currencyPeg: 'EUR', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['Labor law complexity', 'Pension reform impact', 'Strikes'], mitigationActions: ['Legal counsel retainer', 'Payroll compliance automation', 'Business continuity plan'] },
  { countryCode: 'AU', politicalRisk: 14, economicRisk: 16, currencyRisk: 22, complianceRisk: 12, operationalRisk: 12, sovereignRating: 'AAA', currencyPeg: 'Float', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['AUD commodity correlation', 'STP reporting', 'ASIC fees'], mitigationActions: ['AUD forward hedge 60%', 'STP automation', 'ASIC fee tracking'] },
  { countryCode: 'CA', politicalRisk: 16, economicRisk: 18, currencyRisk: 20, complianceRisk: 18, operationalRisk: 14, sovereignRating: 'AA+', currencyPeg: 'Float', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['CAD oil correlation', 'Provincial tax complexity', 'FINTRAC reporting'], mitigationActions: ['CAD forward hedge 58%', 'Provincial tax engine', 'FINTRAC auto-filing'] },
  { countryCode: 'JP', politicalRisk: 12, economicRisk: 22, currencyRisk: 30, complianceRisk: 16, operationalRisk: 14, sovereignRating: 'A+', currencyPeg: 'Float', capitalControls: 'None', sanctionsStatus: 'Clear', riskFactors: ['JPY volatility', 'Consumption tax invoice system', 'Aging workforce'], mitigationActions: ['JPY option hedge 55%', 'Qualified invoice system', 'Talent retention program'] },
];

// ─── Intercompany Loans ───────────────────────────────────────────────────────

export interface IntercompanyLoan {
  id: string;
  lender: string;
  borrower: string;
  lenderCountry: CountryCode;
  borrowerCountry: CountryCode;
  principal: number;
  currency: string;
  principalUSD: number;
  interestRate: number;
  term: string;
  outstanding: number;
  nextPayment: string;
  status: 'active' | 'repaid' | 'restructured';
}

export const INTERCOMPANY_LOANS: IntercompanyLoan[] = [
  { id: 'icl-1', lender: 'VEYRO Treasury Pte Ltd', borrower: 'VEYRO India Pvt Ltd', lenderCountry: 'SG', borrowerCountry: 'IN', principal: 800000, currency: 'USD', principalUSD: 800000, interestRate: 4.5, term: '3 years', outstanding: 640000, nextPayment: '2024-12-31', status: 'active' },
  { id: 'icl-2', lender: 'VEYRO Inc (Delaware)', borrower: 'VEYRO AI Labs Inc', lenderCountry: 'US', borrowerCountry: 'US', principal: 500000, currency: 'USD', principalUSD: 500000, interestRate: 5.0, term: '2 years', outstanding: 420000, nextPayment: '2024-12-31', status: 'active' },
  { id: 'icl-3', lender: 'VEYRO Treasury Pte Ltd', borrower: 'VEYRO FZ-LLC', lenderCountry: 'SG', borrowerCountry: 'AE', principal: 1200000, currency: 'USD', principalUSD: 1200000, interestRate: 4.25, term: '5 years', outstanding: 1080000, nextPayment: '2025-03-31', status: 'active' },
  { id: 'icl-4', lender: 'VEYRO Inc (Delaware)', borrower: 'VEYRO UK Ltd', lenderCountry: 'US', borrowerCountry: 'GB', principal: 400000, currency: 'USD', principalUSD: 400000, interestRate: 4.75, term: '3 years', outstanding: 280000, nextPayment: '2024-12-31', status: 'active' },
  { id: 'icl-5', lender: 'VEYRO Asia Pte Ltd', borrower: 'VEYRO K.K.', lenderCountry: 'SG', borrowerCountry: 'JP', principal: 600000, currency: 'USD', principalUSD: 600000, interestRate: 4.5, term: '4 years', outstanding: 480000, nextPayment: '2025-01-31', status: 'active' },
  { id: 'icl-6', lender: 'VEYRO Inc (Delaware)', borrower: 'VEYRO SARL', lenderCountry: 'US', borrowerCountry: 'FR', principal: 300000, currency: 'EUR', principalUSD: 324000, interestRate: 4.0, term: '3 years', outstanding: 210000, nextPayment: '2024-12-31', status: 'active' },
  { id: 'icl-7', lender: 'VEYRO Treasury Pte Ltd', borrower: 'VEYRO Pty Ltd', lenderCountry: 'SG', borrowerCountry: 'AU', principal: 250000, currency: 'AUD', principalUSD: 165000, interestRate: 4.5, term: '2 years', outstanding: 140000, nextPayment: '2025-03-31', status: 'active' },
  { id: 'icl-8', lender: 'VEYRO Inc (Delaware)', borrower: 'VEYRO Canada Inc', lenderCountry: 'US', borrowerCountry: 'CA', principal: 350000, currency: 'CAD', principalUSD: 256000, interestRate: 4.5, term: '3 years', outstanding: 260000, nextPayment: '2024-12-31', status: 'active' },
];

// ─── Trade Treaties & Tax Agreements ──────────────────────────────────────────

export interface TradeTreaty {
  id: string;
  name: string;
  type: 'DTAA' | 'FTA' | 'PTA' | 'Investment';
  countries: CountryCode[];
  effectiveDate: string;
  withholdingDividend: number;
  withholdingInterest: number;
  withholdingRoyalty: number;
  capitalGains: string;
  permanentEstablishment: string;
  status: 'active' | 'under-review' | 'pending';
}

export const TRADE_TREATIES: TradeTreaty[] = [
  { id: 'tr-1', name: 'India–Singapore DTAA (CECA)', type: 'DTAA', countries: ['IN', 'SG'], effectiveDate: '2005-08-01', withholdingDividend: 15, withholdingInterest: 15, withholdingRoyalty: 10, capitalGains: 'Source-based (transition)', permanentEstablishment: '183 days', status: 'active' },
  { id: 'tr-2', name: 'India–USA DTAA', type: 'DTAA', countries: ['IN', 'US'], effectiveDate: '1991-01-01', withholdingDividend: 15, withholdingInterest: 15, withholdingRoyalty: 10, capitalGains: 'Resident-based', permanentEstablishment: '90 days', status: 'active' },
  { id: 'tr-3', name: 'India–UK DTAA', type: 'DTAA', countries: ['IN', 'GB'], effectiveDate: '1994-10-25', withholdingDividend: 15, withholdingInterest: 15, withholdingRoyalty: 10, capitalGains: 'Resident-based', permanentEstablishment: '90 days', status: 'active' },
  { id: 'tr-4', name: 'India–UAE DTAA', type: 'DTAA', countries: ['IN', 'AE'], effectiveDate: '1993-05-23', withholdingDividend: 0, withholdingInterest: 0, withholdingRoyalty: 0, capitalGains: 'Resident-based', permanentEstablishment: '90 days', status: 'under-review' },
  { id: 'tr-5', name: 'India–Japan DTAA', type: 'DTAA', countries: ['IN', 'JP'], effectiveDate: '1960-04-01', withholdingDividend: 10, withholdingInterest: 10, withholdingRoyalty: 10, capitalGains: 'Resident-based', permanentEstablishment: '90 days', status: 'active' },
  { id: 'tr-6', name: 'India–Australia DTAA (CECA)', type: 'DTAA', countries: ['IN', 'AU'], effectiveDate: '1991-10-30', withholdingDividend: 15, withholdingInterest: 15, withholdingRoyalty: 10, capitalGains: 'Source-based', permanentEstablishment: '183 days', status: 'active' },
  { id: 'tr-7', name: 'India–Canada DTAA', type: 'DTAA', countries: ['IN', 'CA'], effectiveDate: '1997-05-13', withholdingDividend: 15, withholdingInterest: 15, withholdingRoyalty: 10, capitalGains: 'Resident-based', permanentEstablishment: '90 days', status: 'active' },
  { id: 'tr-8', name: 'India–Germany DTAA', type: 'DTAA', countries: ['IN', 'DE'], effectiveDate: '1996-10-26', withholdingDividend: 10, withholdingInterest: 10, withholdingRoyalty: 10, capitalGains: 'Resident-based', permanentEstablishment: '180 days', status: 'active' },
  { id: 'tr-9', name: 'India–France DTAA', type: 'DTAA', countries: ['IN', 'FR'], effectiveDate: '1994-08-29', withholdingDividend: 10, withholdingInterest: 10, withholdingRoyalty: 10, capitalGains: 'Resident-based', permanentEstablishment: '180 days', status: 'active' },
  { id: 'tr-10', name: 'Singapore–Japan EPA', type: 'FTA', countries: ['SG', 'JP'], effectiveDate: '2002-11-30', withholdingDividend: 0, withholdingInterest: 0, withholdingRoyalty: 0, capitalGains: 'Resident-based', permanentEstablishment: '180 days', status: 'active' },
  { id: 'tr-11', name: 'US–UK DTAA', type: 'DTAA', countries: ['US', 'GB'], effectiveDate: '2003-03-31', withholdingDividend: 5, withholdingInterest: 0, withholdingRoyalty: 0, capitalGains: 'Resident-based', permanentEstablishment: '183 days', status: 'active' },
  { id: 'tr-12', name: 'EU–Japan EPA', type: 'FTA', countries: ['DE', 'FR', 'JP'], effectiveDate: '2019-02-01', withholdingDividend: 0, withholdingInterest: 0, withholdingRoyalty: 0, capitalGains: 'Resident-based', permanentEstablishment: '183 days', status: 'active' },
  { id: 'tr-13', name: 'UAE–Singapore DTAA', type: 'DTAA', countries: ['AE', 'SG'], effectiveDate: '2015-09-01', withholdingDividend: 0, withholdingInterest: 0, withholdingRoyalty: 0, capitalGains: 'Resident-based', permanentEstablishment: '183 days', status: 'active' },
  { id: 'tr-14', name: 'Australia–Japan JAEPA', type: 'FTA', countries: ['AU', 'JP'], effectiveDate: '2015-01-15', withholdingDividend: 0, withholdingInterest: 0, withholdingRoyalty: 0, capitalGains: 'Resident-based', permanentEstablishment: '183 days', status: 'active' },
];

// ─── Global Customs Declarations ──────────────────────────────────────────────

export interface CustomsDeclaration {
  id: string;
  reference: string;
  type: 'Import' | 'Export';
  originCountry: CountryCode;
  destinationCountry: CountryCode;
  hsCode: string;
  description: string;
  declaredValue: number;
  currency: string;
  declaredValueUSD: number;
  dutyRate: number;
  dutyPaid: number;
  gstVatPaid: number;
  status: 'filed' | 'cleared' | 'held' | 'pending';
  port: string;
  filingDate: string;
  incoterm: string;
}

export const CUSTOMS_DECLARATIONS: CustomsDeclaration[] = [
  { id: 'cus-1', reference: 'BOE-2024-0891', type: 'Import', originCountry: 'SG', destinationCountry: 'IN', hsCode: '8517.62.00', description: 'Telecom networking modules', declaredValue: 184000, currency: 'USD', declaredValueUSD: 184000, dutyRate: 15, dutyPaid: 27600, gstVatPaid: 33120, status: 'cleared', port: 'Nhava Sheva (IN)', filingDate: '2024-10-02', incoterm: 'CIF' },
  { id: 'cus-2', reference: 'BOE-2024-0892', type: 'Import', originCountry: 'DE', destinationCountry: 'US', hsCode: '8471.50.01', description: 'Industrial CNC machinery', declaredValue: 312000, currency: 'EUR', declaredValueUSD: 337000, dutyRate: 3.4, dutyPaid: 11458, gstVatPaid: 0, status: 'held', port: 'Newark, NJ (US)', filingDate: '2024-10-01', incoterm: 'FOB' },
  { id: 'cus-3', reference: 'BOE-2024-0893', type: 'Import', originCountry: 'JP', destinationCountry: 'SG', hsCode: '9031.49.00', description: 'Precision optical instruments', declaredValue: 142000, currency: 'USD', declaredValueUSD: 142000, dutyRate: 0, dutyPaid: 0, gstVatPaid: 12780, status: 'filed', port: 'Port of Singapore', filingDate: '2024-10-03', incoterm: 'CIF' },
  { id: 'cus-4', reference: 'SAD-2024-0894', type: 'Export', originCountry: 'IN', destinationCountry: 'AE', hsCode: '8542.31.00', description: 'Electronic integrated circuits', declaredValue: 86000, currency: 'USD', declaredValueUSD: 86000, dutyRate: 5, dutyPaid: 4300, gstVatPaid: 0, status: 'cleared', port: 'Mumbai (IN)', filingDate: '2024-09-30', incoterm: 'CIF' },
  { id: 'cus-5', reference: 'BOE-2024-0895', type: 'Import', originCountry: 'FR', destinationCountry: 'AE', hsCode: '5208.52.00', description: 'Woven cotton textiles', declaredValue: 64000, currency: 'EUR', declaredValueUSD: 69120, dutyRate: 5, dutyPaid: 3456, gstVatPaid: 3110, status: 'pending', port: 'Jebel Ali (AE)', filingDate: '2024-10-04', incoterm: 'CIF' },
  { id: 'cus-6', reference: 'SAD-2024-0896', type: 'Export', originCountry: 'GB', destinationCountry: 'DE', hsCode: '7208.51.00', description: 'Hot-rolled steel plates', declaredValue: 88000, currency: 'GBP', declaredValueUSD: 111760, dutyRate: 0, dutyPaid: 0, gstVatPaid: 21234, status: 'cleared', port: 'Felixstowe (GB)', filingDate: '2024-10-01', incoterm: 'FOB' },
  { id: 'cus-7', reference: 'BOE-2024-0897', type: 'Import', originCountry: 'US', destinationCountry: 'IN', hsCode: '8473.30.00', description: 'Computer components & parts', declaredValue: 96000, currency: 'USD', declaredValueUSD: 96000, dutyRate: 10, dutyPaid: 9600, gstVatPaid: 17280, status: 'cleared', port: 'Chennai (IN)', filingDate: '2024-09-28', incoterm: 'EXW' },
  { id: 'cus-8', reference: 'BOE-2024-0898', type: 'Import', originCountry: 'AU', destinationCountry: 'IN', hsCode: '2601.11.00', description: 'Iron ore concentrates', declaredValue: 48000, currency: 'AUD', declaredValueUSD: 31680, dutyRate: 5, dutyPaid: 1584, gstVatPaid: 5702, status: 'filed', port: 'Visakhapatnam (IN)', filingDate: '2024-10-03', incoterm: 'CIF' },
];

// ─── Consolidated Financials ──────────────────────────────────────────────────

export interface ConsolidatedBalance {
  category: string;
  inr: number;
  usd: number;
  eur: number;
  gbp: number;
  other: number;
  totalUSD: number;
  pctOfTotal: number;
}

export const CONSOLIDATED_ASSETS: ConsolidatedBalance[] = [
  { category: 'Cash & Equivalents', inr: 18000000, usd: 3200000, eur: 680000, gbp: 240000, other: 840000, totalUSD: 5958000, pctOfTotal: 30.2 },
  { category: 'Accounts Receivable', inr: 24000000, usd: 1840000, eur: 420000, gbp: 180000, other: 320000, totalUSD: 5036000, pctOfTotal: 25.5 },
  { category: 'Inventory', inr: 12000000, usd: 680000, eur: 180000, gbp: 90000, other: 140000, totalUSD: 2620000, pctOfTotal: 13.3 },
  { category: 'Prepaid Expenses', inr: 3200000, usd: 240000, eur: 80000, gbp: 40000, other: 60000, totalUSD: 820000, pctOfTotal: 4.2 },
  { category: 'Property, Plant & Equipment', inr: 8400000, usd: 1200000, eur: 340000, gbp: 120000, other: 180000, totalUSD: 2904000, pctOfTotal: 14.7 },
  { category: 'Intangible Assets', inr: 4800000, usd: 680000, eur: 120000, gbp: 60000, other: 80000, totalUSD: 1500000, pctOfTotal: 7.6 },
  { category: 'Intercompany Receivables', inr: 6000000, usd: 420000, eur: 140000, gbp: 80000, other: 100000, totalUSD: 1360000, pctOfTotal: 6.9 },
  { category: 'Deferred Tax Assets', inr: 2000000, usd: 140000, eur: 40000, gbp: 20000, other: 30000, totalUSD: 480000, pctOfTotal: 2.4 },
];

export const CONSOLIDATED_LIABILITIES: ConsolidatedBalance[] = [
  { category: 'Accounts Payable', inr: 16000000, usd: 1240000, eur: 280000, gbp: 120000, other: 200000, totalUSD: 3480000, pctOfTotal: 28.4 },
  { category: 'Accrued Expenses', inr: 8000000, usd: 680000, eur: 160000, gbp: 80000, other: 120000, totalUSD: 2140000, pctOfTotal: 17.5 },
  { category: 'Deferred Revenue', inr: 12000000, usd: 920000, eur: 240000, gbp: 100000, other: 160000, totalUSD: 3140000, pctOfTotal: 25.6 },
  { category: 'Short-Term Debt', inr: 4000000, usd: 480000, eur: 80000, gbp: 40000, other: 60000, totalUSD: 1140000, pctOfTotal: 9.3 },
  { category: 'Intercompany Payables', inr: 5000000, usd: 340000, eur: 100000, gbp: 60000, other: 80000, totalUSD: 1080000, pctOfTotal: 8.8 },
  { category: 'Long-Term Debt', inr: 3000000, usd: 520000, eur: 60000, gbp: 30000, other: 40000, totalUSD: 780000, pctOfTotal: 6.4 },
  { category: 'Deferred Tax Liabilities', inr: 1600000, usd: 120000, eur: 40000, gbp: 20000, other: 20000, totalUSD: 380000, pctOfTotal: 3.1 },
  { category: 'Lease Liabilities', inr: 1000000, usd: 80000, eur: 20000, gbp: 10000, other: 10000, totalUSD: 220000, pctOfTotal: 1.8 },
];

// ─── Global AR/AP Aging ───────────────────────────────────────────────────────

export interface ARAPAging {
  countryCode: CountryCode;
  receivablesCurrent: number;
  receivables30: number;
  receivables60: number;
  receivables90: number;
  receivablesTotal: number;
  payablesCurrent: number;
  payables30: number;
  payables60: number;
  payables90: number;
  payablesTotal: number;
  dso: number;   // days sales outstanding
  dpo: number;   // days payable outstanding
}

export const AR_AP_AGING: ARAPAging[] = [
  { countryCode: 'IN', receivablesCurrent: 8400000, receivables30: 2200000, receivables60: 680000, receivables90: 240000, receivablesTotal: 11520000, payablesCurrent: 5200000, payables30: 1400000, payables60: 420000, payables90: 180000, payablesTotal: 7200000, dso: 48, dpo: 62 },
  { countryCode: 'US', receivablesCurrent: 980000, receivables30: 240000, receivables60: 80000, receivables90: 20000, receivablesTotal: 1320000, payablesCurrent: 620000, payables30: 180000, payables60: 60000, payables90: 20000, payablesTotal: 880000, dso: 39, dpo: 54 },
  { countryCode: 'GB', receivablesCurrent: 280000, receivables30: 80000, receivables60: 24000, receivables90: 8000, receivablesTotal: 392000, payablesCurrent: 180000, payables30: 60000, payables60: 20000, payables90: 6000, payablesTotal: 266000, dso: 34, dpo: 52 },
  { countryCode: 'SG', receivablesCurrent: 420000, receivables30: 120000, receivables60: 40000, receivables90: 10000, receivablesTotal: 590000, payablesCurrent: 240000, payables30: 80000, payables60: 30000, payables90: 8000, payablesTotal: 358000, dso: 36, dpo: 48 },
  { countryCode: 'AE', receivablesCurrent: 320000, receivables30: 100000, receivables60: 30000, receivables90: 12000, receivablesTotal: 462000, payablesCurrent: 180000, payables30: 60000, payables60: 24000, payables90: 6000, payablesTotal: 270000, dso: 38, dpo: 46 },
  { countryCode: 'DE', receivablesCurrent: 480000, receivables30: 140000, receivables60: 40000, receivables90: 10000, receivablesTotal: 670000, payablesCurrent: 280000, payables30: 100000, payables60: 36000, payables90: 8000, payablesTotal: 424000, dso: 40, dpo: 58 },
  { countryCode: 'FR', receivablesCurrent: 320000, receivables30: 100000, receivables60: 28000, receivables90: 8000, receivablesTotal: 456000, payablesCurrent: 200000, payables30: 70000, payables60: 24000, payables90: 6000, payablesTotal: 300000, dso: 42, dpo: 50 },
  { countryCode: 'AU', receivablesCurrent: 180000, receivables30: 50000, receivables60: 16000, receivables90: 4000, receivablesTotal: 250000, payablesCurrent: 120000, payables30: 40000, payables60: 14000, payables90: 4000, payablesTotal: 178000, dso: 31, dpo: 44 },
  { countryCode: 'CA', receivablesCurrent: 240000, receivables30: 70000, receivables60: 20000, receivables90: 6000, receivablesTotal: 336000, payablesCurrent: 140000, payables30: 50000, payables60: 18000, payables90: 4000, payablesTotal: 212000, dso: 33, dpo: 47 },
  { countryCode: 'JP', receivablesCurrent: 380000, receivables30: 100000, receivables60: 30000, receivables90: 8000, receivablesTotal: 518000, payablesCurrent: 200000, payables30: 70000, payables60: 24000, payables90: 6000, payablesTotal: 300000, dso: 35, dpo: 49 },
];

// ─── Tax Credits & Incentives ─────────────────────────────────────────────────

export interface TaxCredit {
  id: string;
  name: string;
  countryCode: CountryCode;
  type: 'R&D Credit' | 'Investment Allowance' | 'Export Incentive' | 'SEZ Benefit' | 'Regional Benefit';
  eligibleAmount: number;
  claimedAmount: number;
  remaining: number;
  expiry: string;
  status: 'claimed' | 'pending' | 'expiring' | 'expired';
  savingUSD: number;
}

export const TAX_CREDITS: TaxCredit[] = [
  { id: 'tc-1', name: 'India R&D Tax Credit (Sec 35(2AB))', countryCode: 'IN', type: 'R&D Credit', eligibleAmount: 840000, claimedAmount: 588000, remaining: 252000, expiry: '2025-03-31', status: 'claimed', savingUSD: 147000 },
  { id: 'tc-2', name: 'India SEZ Export Benefit (Section 10AA)', countryCode: 'IN', type: 'SEZ Benefit', eligibleAmount: 420000, claimedAmount: 210000, remaining: 210000, expiry: '2025-03-31', status: 'claimed', savingUSD: 52500 },
  { id: 'tc-3', name: 'UK R&D SME Tax Credit', countryCode: 'GB', type: 'R&D Credit', eligibleAmount: 530000, claimedAmount: 0, remaining: 530000, expiry: '2025-04-05', status: 'pending', savingUSD: 98600 },
  { id: 'tc-4', name: 'US R&D Tax Credit (IRC 41)', countryCode: 'US', type: 'R&D Credit', eligibleAmount: 680000, claimedAmount: 408000, remaining: 272000, expiry: '2025-12-31', status: 'claimed', savingUSD: 136000 },
  { id: 'tc-5', name: 'Singapore PIC+ Innovation Credit', countryCode: 'SG', type: 'R&D Credit', eligibleAmount: 320000, claimedAmount: 160000, remaining: 160000, expiry: '2025-12-31', status: 'claimed', savingUSD: 27200 },
  { id: 'tc-6', name: 'Australia R&D Tax Incentive', countryCode: 'AU', type: 'R&D Credit', eligibleAmount: 180000, claimedAmount: 0, remaining: 180000, expiry: '2025-06-30', status: 'pending', savingUSD: 32400 },
  { id: 'tc-7', name: 'France CIR (Crédit Impôt Recherche)', countryCode: 'FR', type: 'R&D Credit', eligibleAmount: 240000, claimedAmount: 120000, remaining: 120000, expiry: '2025-12-31', status: 'claimed', savingUSD: 21600 },
  { id: 'tc-8', name: 'Japan R&D Tax System (Special)', countryCode: 'JP', type: 'R&D Credit', eligibleAmount: 160000, claimedAmount: 80000, remaining: 80000, expiry: '2025-03-15', status: 'expiring', savingUSD: 14400 },
  { id: 'tc-9', name: 'Germany Investment Allowance', countryCode: 'DE', type: 'Investment Allowance', eligibleAmount: 280000, claimedAmount: 140000, remaining: 140000, expiry: '2026-12-31', status: 'claimed', savingUSD: 42340 },
  { id: 'tc-10', name: 'UAE Free Zone 0% Corporate Tax', countryCode: 'AE', type: 'Regional Benefit', eligibleAmount: 920000, claimedAmount: 460000, remaining: 460000, expiry: '2027-06-01', status: 'claimed', savingUSD: 41400 },
  { id: 'tc-11', name: 'Canada SR&ED Tax Credit', countryCode: 'CA', type: 'R&D Credit', eligibleAmount: 140000, claimedAmount: 0, remaining: 140000, expiry: '2025-06-30', status: 'pending', savingUSD: 36400 },
  { id: 'tc-12', name: 'India Merchandise Export Incentive (RODTEP)', countryCode: 'IN', type: 'Export Incentive', eligibleAmount: 180000, claimedAmount: 90000, remaining: 90000, expiry: '2025-09-30', status: 'claimed', savingUSD: 18000 },
];

// ─── Global Insurance & Risk Transfer ─────────────────────────────────────────

export interface InsurancePolicy {
  id: string;
  name: string;
  type: 'D&O' | 'Cyber' | 'Property' | 'Business Interruption' | 'Trade Credit' | 'Professional Indemnity';
  coverage: number;
  premium: number;
  deductible: number;
  insurer: string;
  renewalDate: string;
  status: 'active' | 'renewing' | 'expiring';
  regions: string[];
}

export const INSURANCE_POLICIES: InsurancePolicy[] = [
  { id: 'ins-1', name: 'Global D&O Liability', type: 'D&O', coverage: 50000000, premium: 280000, deductible: 500000, insurer: 'AIG', renewalDate: '2025-06-30', status: 'active', regions: ['Global'] },
  { id: 'ins-2', name: 'Cyber Liability Plus', type: 'Cyber', coverage: 25000000, premium: 180000, deductible: 250000, insurer: 'Chubb', renewalDate: '2025-03-31', status: 'active', regions: ['Global'] },
  { id: 'ins-3', name: 'Global Property All-Risk', type: 'Property', coverage: 18000000, premium: 96000, deductible: 100000, insurer: 'Allianz', renewalDate: '2025-01-31', status: 'renewing', regions: ['IN', 'US', 'SG', 'DE'] },
  { id: 'ins-4', name: 'Business Interruption', type: 'Business Interruption', coverage: 12000000, premium: 84000, deductible: 200000, insurer: 'AXA', renewalDate: '2025-01-31', status: 'renewing', regions: ['Global'] },
  { id: 'ins-5', name: 'Global Trade Credit Insurance', type: 'Trade Credit', coverage: 20000000, premium: 120000, deductible: 50000, insurer: 'Euler Hermes', renewalDate: '2025-09-30', status: 'active', regions: ['Global'] },
  { id: 'ins-6', name: 'Professional Indemnity', type: 'Professional Indemnity', coverage: 10000000, premium: 68000, deductible: 100000, insurer: 'Hiscox', renewalDate: '2025-04-30', status: 'active', regions: ['Global'] },
  { id: 'ins-7', name: 'APAC Property Extension', type: 'Property', coverage: 6000000, premium: 32000, deductible: 75000, insurer: 'Allianz', renewalDate: '2025-01-31', status: 'renewing', regions: ['IN', 'SG', 'AU', 'JP'] },
  { id: 'ins-8', name: 'US Cyber Extension', type: 'Cyber', coverage: 10000000, premium: 64000, deductible: 100000, insurer: 'Chubb', renewalDate: '2025-03-31', status: 'active', regions: ['US', 'CA'] },
];

// ─── ESG / Sustainability Metrics ─────────────────────────────────────────────

export interface ESGMetric {
  countryCode: CountryCode;
  scope1Emissions: number;    // tCO2e
  scope2Emissions: number;    // tCO2e
  scope3Emissions: number;    // tCO2e
  renewableEnergyPct: number;
  waterUsage: number;          // m³
  wasteRecycledPct: number;
  diversityScore: number;      // 0-100
  employeeSatisfaction: number;
  communityInvestment: number; // USD
}

export const ESG_METRICS: ESGMetric[] = [
  { countryCode: 'IN', scope1Emissions: 420, scope2Emissions: 2840, scope3Emissions: 18600, renewableEnergyPct: 42, waterUsage: 12400, wasteRecycledPct: 78, diversityScore: 72, employeeSatisfaction: 84, communityInvestment: 180000 },
  { countryCode: 'US', scope1Emissions: 180, scope2Emissions: 920, scope3Emissions: 8400, renewableEnergyPct: 38, waterUsage: 4200, wasteRecycledPct: 82, diversityScore: 68, employeeSatisfaction: 81, communityInvestment: 120000 },
  { countryCode: 'GB', scope1Emissions: 80, scope2Emissions: 340, scope3Emissions: 3200, renewableEnergyPct: 64, waterUsage: 1800, wasteRecycledPct: 88, diversityScore: 74, employeeSatisfaction: 86, communityInvestment: 64000 },
  { countryCode: 'SG', scope1Emissions: 120, scope2Emissions: 680, scope3Emissions: 5400, renewableEnergyPct: 28, waterUsage: 2400, wasteRecycledPct: 76, diversityScore: 82, employeeSatisfaction: 83, communityInvestment: 84000 },
  { countryCode: 'AE', scope1Emissions: 140, scope2Emissions: 820, scope3Emissions: 4200, renewableEnergyPct: 22, waterUsage: 3200, wasteRecycledPct: 68, diversityScore: 64, employeeSatisfaction: 79, communityInvestment: 56000 },
  { countryCode: 'DE', scope1Emissions: 90, scope2Emissions: 280, scope3Emissions: 3800, renewableEnergyPct: 72, waterUsage: 1600, wasteRecycledPct: 91, diversityScore: 76, employeeSatisfaction: 88, communityInvestment: 72000 },
  { countryCode: 'FR', scope1Emissions: 70, scope2Emissions: 220, scope3Emissions: 2800, renewableEnergyPct: 68, waterUsage: 1400, wasteRecycledPct: 89, diversityScore: 78, employeeSatisfaction: 85, communityInvestment: 48000 },
  { countryCode: 'AU', scope1Emissions: 60, scope2Emissions: 240, scope3Emissions: 2200, renewableEnergyPct: 46, waterUsage: 1200, wasteRecycledPct: 84, diversityScore: 70, employeeSatisfaction: 82, communityInvestment: 36000 },
  { countryCode: 'CA', scope1Emissions: 65, scope2Emissions: 260, scope3Emissions: 2400, renewableEnergyPct: 68, waterUsage: 1400, wasteRecycledPct: 86, diversityScore: 72, employeeSatisfaction: 84, communityInvestment: 42000 },
  { countryCode: 'JP', scope1Emissions: 55, scope2Emissions: 220, scope3Emissions: 2000, renewableEnergyPct: 24, waterUsage: 1100, wasteRecycledPct: 87, diversityScore: 66, employeeSatisfaction: 80, communityInvestment: 38000 },
];

// ─── Cash Pooling ─────────────────────────────────────────────────────────────

export interface CashPoolPosition {
  id: string;
  entity: string;
  countryCode: CountryCode;
  accountType: 'Header' | 'Participant';
  balance: number;
  currency: string;
  balanceUSD: number;
  sweepStatus: 'swept' | 'pending' | 'manual';
  interestRate: number;
  lastSweep: string;
}

export const CASH_POOL: CashPoolPosition[] = [
  { id: 'cp-1', entity: 'VEYRO Treasury Pte Ltd (Header)', countryCode: 'SG', accountType: 'Header', balance: 4200000, currency: 'USD', balanceUSD: 4200000, sweepStatus: 'swept', interestRate: 4.8, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-2', entity: 'VEYRO India Pvt Ltd', countryCode: 'IN', accountType: 'Participant', balance: 28000000, currency: 'INR', balanceUSD: 336000, sweepStatus: 'swept', interestRate: 4.2, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-3', entity: 'VEYRO Inc (Delaware)', countryCode: 'US', accountType: 'Participant', balance: 1840000, currency: 'USD', balanceUSD: 1840000, sweepStatus: 'swept', interestRate: 4.8, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-4', entity: 'VEYRO UK Ltd', countryCode: 'GB', accountType: 'Participant', balance: 680000, currency: 'GBP', balanceUSD: 863600, sweepStatus: 'swept', interestRate: 4.6, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-5', entity: 'VEYRO GmbH', countryCode: 'DE', accountType: 'Participant', balance: 920000, currency: 'EUR', balanceUSD: 993600, sweepStatus: 'pending', interestRate: 4.4, lastSweep: '2024-10-03 06:00' },
  { id: 'cp-6', entity: 'VEYRO FZ-LLC', countryCode: 'AE', accountType: 'Participant', balance: 1200000, currency: 'AED', balanceUSD: 324000, sweepStatus: 'swept', interestRate: 4.0, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-7', entity: 'VEYRO Asia Pte Ltd', countryCode: 'SG', accountType: 'Participant', balance: 680000, currency: 'SGD', balanceUSD: 503200, sweepStatus: 'swept', interestRate: 4.5, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-8', entity: 'VEYRO Pty Ltd', countryCode: 'AU', accountType: 'Participant', balance: 340000, currency: 'AUD', balanceUSD: 224400, sweepStatus: 'manual', interestRate: 4.2, lastSweep: '2024-10-02 06:00' },
  { id: 'cp-9', entity: 'VEYRO Canada Inc', countryCode: 'CA', accountType: 'Participant', balance: 420000, currency: 'CAD', balanceUSD: 306600, sweepStatus: 'swept', interestRate: 4.3, lastSweep: '2024-10-04 06:00' },
  { id: 'cp-10', entity: 'VEYRO K.K.', countryCode: 'JP', accountType: 'Participant', balance: 38000000, currency: 'JPY', balanceUSD: 254600, sweepStatus: 'swept', interestRate: 4.1, lastSweep: '2024-10-04 06:00' },
];

// ─── Board & Governance ───────────────────────────────────────────────────────

export interface BoardMember {
  id: string;
  name: string;
  role: string;
  independent: boolean;
  nationality: string;
  countryCode: CountryCode;
  committees: string[];
  attendance: number;       // %
  since: string;
  shares: number;
}

export const BOARD_MEMBERS: BoardMember[] = [
  { id: 'bm-1', name: 'Arjun Mehta', role: 'Chairman & CEO', independent: false, nationality: 'Indian', countryCode: 'IN', committees: ['Executive', 'Strategy'], attendance: 100, since: '2019-03-15', shares: 4200000 },
  { id: 'bm-2', name: 'Sarah Chen', role: 'Independent Director', independent: true, nationality: 'Singaporean', countryCode: 'SG', committees: ['Audit', 'Risk'], attendance: 96, since: '2020-06-12', shares: 180000 },
  { id: 'bm-3', name: 'David Wilson', role: 'CFO', independent: false, nationality: 'American', countryCode: 'US', committees: ['Executive', 'Audit'], attendance: 100, since: '2020-01-20', shares: 240000 },
  { id: 'bm-4', name: 'Marie Dupont', role: 'Independent Director', independent: true, nationality: 'French', countryCode: 'FR', committees: ['Audit', 'ESG'], attendance: 92, since: '2021-02-08', shares: 120000 },
  { id: 'bm-5', name: 'Raj Kumar', role: 'COO', independent: false, nationality: 'Indian', countryCode: 'IN', committees: ['Executive', 'Risk'], attendance: 98, since: '2019-08-01', shares: 320000 },
  { id: 'bm-6', name: 'James Anderson', role: 'Independent Director', independent: true, nationality: 'British', countryCode: 'GB', committees: ['Remuneration', 'Nominations'], attendance: 94, since: '2021-11-15', shares: 96000 },
  { id: 'bm-7', name: 'Yuki Tanaka', role: 'Independent Director', independent: true, nationality: 'Japanese', countryCode: 'JP', committees: ['Risk', 'ESG'], attendance: 90, since: '2023-04-03', shares: 64000 },
];

export interface BoardResolution {
  id: string;
  title: string;
  date: string;
  type: 'Financial' | 'Strategic' | 'Governance' | 'Compliance';
  status: 'passed' | 'pending' | 'tabled';
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  summary: string;
}

export const BOARD_RESOLUTIONS: BoardResolution[] = [
  { id: 'br-1', title: 'Q3 FY24 Financial Statements Approval', date: '2024-10-01', type: 'Financial', status: 'passed', votesFor: 7, votesAgainst: 0, abstentions: 0, summary: 'Approved consolidated Q3 FY24 financials with unqualified audit opinion' },
  { id: 'br-2', title: 'Japan Entity Incorporation — VEYRO K.K.', date: '2023-04-03', type: 'Strategic', status: 'passed', votesFor: 6, votesAgainst: 1, abstentions: 0, summary: 'Approved Japan market entry via K.K. entity with ¥100M initial capital' },
  { id: 'br-3', title: 'Transfer Pricing Policy Update FY24', date: '2024-09-15', type: 'Compliance', status: 'passed', votesFor: 7, votesAgainst: 0, abstentions: 0, summary: 'Updated OECD-aligned transfer pricing policy across all 14 entities' },
  { id: 'br-4', title: 'Singapore Treasury Center Establishment', date: '2023-08-15', type: 'Strategic', status: 'passed', votesFor: 7, votesAgainst: 0, abstentions: 0, summary: 'Established VEYRO Treasury Pte Ltd as global cash pooling header' },
  { id: 'br-5', title: 'Cyber Insurance Coverage Enhancement', date: '2024-08-20', type: 'Governance', status: 'passed', votesFor: 6, votesAgainst: 0, abstentions: 1, summary: 'Increased cyber liability coverage from $15M to $25M' },
  { id: 'br-6', title: 'AI Labs Subsidiary Formation', date: '2023-10-01', type: 'Strategic', status: 'passed', votesFor: 5, votesAgainst: 2, abstentions: 0, summary: 'Formed VEYRO AI Labs Inc for frontier AI research' },
  { id: 'br-7', title: 'FY25 Audit Firm Reappointment', date: '2024-09-30', type: 'Compliance', status: 'pending', votesFor: 0, votesAgainst: 0, abstentions: 0, summary: 'Reappointment of Big-4 audit firm for FY25 — pending vote' },
  { id: 'br-8', title: 'ESG Net-Zero Commitment 2030', date: '2024-09-15', type: 'Governance', status: 'passed', votesFor: 7, votesAgainst: 0, abstentions: 0, summary: 'Committed to net-zero Scope 1+2 emissions by 2030, Scope 3 by 2040' },
];

// ─── Revenue Breakdown by Segment ─────────────────────────────────────────────

export interface RevenueSegment {
  segment: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  fyTotal: number;
  yoyGrowth: number;
  grossMargin: number;
  color: string;
}

export const REVENUE_SEGMENTS: RevenueSegment[] = [
  { segment: 'Core SaaS Subscriptions', q1: 980000, q2: 1120000, q3: 1280000, q4: 1440000, fyTotal: 4820000, yoyGrowth: 42, grossMargin: 82, color: 'emerald' },
  { segment: 'Payments Processing', q1: 180000, q2: 220000, q3: 260000, q4: 320000, fyTotal: 980000, yoyGrowth: 68, grossMargin: 64, color: 'teal' },
  { segment: 'Professional Services', q1: 120000, q2: 140000, q3: 160000, q4: 180000, fyTotal: 600000, yoyGrowth: 24, grossMargin: 48, color: 'cyan' },
  { segment: 'API Platform & Data', q1: 80000, q2: 100000, q3: 120000, q4: 160000, fyTotal: 460000, yoyGrowth: 88, grossMargin: 91, color: 'violet' },
  { segment: 'Enterprise Licenses', q1: 240000, q2: 180000, q3: 200000, q4: 280000, fyTotal: 900000, yoyGrowth: 18, grossMargin: 72, color: 'amber' },
  { segment: 'International Trade Finance', q1: 60000, q2: 80000, q3: 100000, q4: 140000, fyTotal: 380000, yoyGrowth: 124, grossMargin: 56, color: 'rose' },
];

// ─── FX Forward Curve ─────────────────────────────────────────────────────────

export interface FXForwardPoint {
  pair: string;
  spot: number;
  fwd1M: number;
  fwd3M: number;
  fwd6M: number;
  fwd1Y: number;
  trend: 'up' | 'down' | 'flat';
}

export const FX_FORWARD_CURVE: FXForwardPoint[] = [
  { pair: 'EUR/USD', spot: 1.0850, fwd1M: 1.0862, fwd3M: 1.0890, fwd6M: 1.0930, fwd1Y: 1.1010, trend: 'up' },
  { pair: 'GBP/USD', spot: 1.2700, fwd1M: 1.2718, fwd3M: 1.2750, fwd6M: 1.2800, fwd1Y: 1.2900, trend: 'up' },
  { pair: 'USD/INR', spot: 83.20, fwd1M: 83.48, fwd3M: 84.10, fwd6M: 84.95, fwd1Y: 86.80, trend: 'up' },
  { pair: 'USD/JPY', spot: 149.25, fwd1M: 149.80, fwd3M: 151.20, fwd6M: 153.40, fwd1Y: 158.20, trend: 'up' },
  { pair: 'AUD/USD', spot: 0.6600, fwd1M: 0.6588, fwd3M: 0.6560, fwd6M: 0.6520, fwd1Y: 0.6440, trend: 'down' },
  { pair: 'USD/SGD', spot: 1.3400, fwd1M: 1.3412, fwd3M: 1.3438, fwd6M: 1.3478, fwd1Y: 1.3560, trend: 'up' },
  { pair: 'USD/CAD', spot: 1.3700, fwd1M: 1.3718, fwd3M: 1.3750, fwd6M: 1.3800, fwd1Y: 1.3900, trend: 'up' },
  { pair: 'AED/USD', spot: 0.2723, fwd1M: 0.2723, fwd3M: 0.2723, fwd6M: 0.2723, fwd1Y: 0.2723, trend: 'flat' },
];

// ─── SLA & Uptime Monitoring ──────────────────────────────────────────────────

export interface SLAContract {
  id: string;
  customer: string;
  tier: 'Starter' | 'Growth' | 'Enterprise' | 'Strategic';
  uptimeSLA: number;
  responseSLA: number;
  resolutionSLA: number;
  currentUptime: number;
  avgResponse: number;
  avgResolution: number;
  monthlyValue: number;
  status: 'meeting' | 'at-risk' | 'breached';
}

export const SLA_CONTRACTS: SLAContract[] = [
  { id: 'sla-1', customer: 'Global Tech Inc (US)', tier: 'Strategic', uptimeSLA: 99.99, responseSLA: 15, resolutionSLA: 60, currentUptime: 99.992, avgResponse: 8, avgResolution: 28, monthlyValue: 48000, status: 'meeting' },
  { id: 'sla-2', customer: 'Bayern GmbH (DE)', tier: 'Enterprise', uptimeSLA: 99.95, responseSLA: 30, resolutionSLA: 120, currentUptime: 99.968, avgResponse: 18, avgResolution: 84, monthlyValue: 28000, status: 'meeting' },
  { id: 'sla-3', customer: 'Manchester Steel (GB)', tier: 'Enterprise', uptimeSLA: 99.95, responseSLA: 30, resolutionSLA: 120, currentUptime: 99.941, avgResponse: 42, avgResolution: 156, monthlyValue: 22000, status: 'at-risk' },
  { id: 'sla-4', customer: 'Osaka Precision (JP)', tier: 'Growth', uptimeSLA: 99.9, responseSLA: 60, resolutionSLA: 240, currentUptime: 99.984, avgResponse: 24, avgResolution: 92, monthlyValue: 12000, status: 'meeting' },
  { id: 'sla-5', customer: 'Lyon Textiles (FR)', tier: 'Growth', uptimeSLA: 99.9, responseSLA: 60, resolutionSLA: 240, currentUptime: 99.912, avgResponse: 68, avgResolution: 280, monthlyValue: 8400, status: 'breached' },
  { id: 'sla-6', customer: 'Sydney Retail Pty (AU)', tier: 'Starter', uptimeSLA: 99.5, responseSLA: 120, resolutionSLA: 480, currentUptime: 99.94, avgResponse: 48, avgResolution: 184, monthlyValue: 3200, status: 'meeting' },
  { id: 'sla-7', customer: 'Dubai Traders LLC (AE)', tier: 'Enterprise', uptimeSLA: 99.95, responseSLA: 30, resolutionSLA: 120, currentUptime: 99.97, avgResponse: 22, avgResolution: 76, monthlyValue: 24000, status: 'meeting' },
  { id: 'sla-8', customer: 'Toronto Logistics (CA)', tier: 'Growth', uptimeSLA: 99.9, responseSLA: 60, resolutionSLA: 240, currentUptime: 99.96, avgResponse: 32, avgResolution: 108, monthlyValue: 14000, status: 'meeting' },
];

// ─── Payment Rail Analytics ───────────────────────────────────────────────────

export interface PaymentRail {
  id: string;
  rail: string;
  avgSettlementHrs: number;
  successRate: number;
  avgFee: number;
  monthlyVolume: number;
  monthlyTxns: number;
  regions: string[];
  color: string;
}

export const PAYMENT_RAILS: PaymentRail[] = [
  { id: 'pr-1', rail: 'SWIFT MT103', avgSettlementHrs: 48, successRate: 98.2, avgFee: 32, monthlyVolume: 4200000, monthlyTxns: 3120, regions: ['Global'], color: 'emerald' },
  { id: 'pr-2', rail: 'SEPA Instant', avgSettlementHrs: 0.2, successRate: 99.6, avgFee: 0.4, monthlyVolume: 1840000, monthlyTxns: 4280, regions: ['EU'], color: 'teal' },
  { id: 'pr-3', rail: 'SEPA Standard', avgSettlementHrs: 24, successRate: 99.4, avgFee: 0.25, monthlyVolume: 920000, monthlyTxns: 1840, regions: ['EU'], color: 'cyan' },
  { id: 'pr-4', rail: 'FedWire', avgSettlementHrs: 0.1, successRate: 99.9, avgFee: 18, monthlyVolume: 2800000, monthlyTxns: 1240, regions: ['US'], color: 'violet' },
  { id: 'pr-5', rail: 'ACH', avgSettlementHrs: 72, successRate: 99.2, avgFee: 0.35, monthlyVolume: 1640000, monthlyTxns: 6820, regions: ['US'], color: 'amber' },
  { id: 'pr-6', rail: 'UPI', avgSettlementHrs: 0.01, successRate: 99.4, avgFee: 0.05, monthlyVolume: 1850000, monthlyTxns: 22400, regions: ['IN'], color: 'rose' },
  { id: 'pr-7', rail: 'IMPS', avgSettlementHrs: 0.01, successRate: 99.8, avgFee: 0.15, monthlyVolume: 420000, monthlyTxns: 3200, regions: ['IN'], color: 'emerald' },
  { id: 'pr-8', rail: 'FPS (UK)', avgSettlementHrs: 0.02, successRate: 99.7, avgFee: 0.2, monthlyVolume: 380000, monthlyTxns: 1840, regions: ['GB'], color: 'teal' },
  { id: 'pr-9', rail: 'Fast (SG)', avgSettlementHrs: 0.02, successRate: 99.5, avgFee: 0.3, monthlyVolume: 240000, monthlyTxns: 920, regions: ['SG'], color: 'cyan' },
  { id: 'pr-10', rail: 'Zengin (JP)', avgSettlementHrs: 4, successRate: 99.9, avgFee: 0.8, monthlyVolume: 680000, monthlyTxns: 480, regions: ['JP'], color: 'violet' },
];

// ─── Regulatory Report Calendar ───────────────────────────────────────────────

export interface RegulatoryReport {
  id: string;
  name: string;
  jurisdiction: string;
  countryCode: CountryCode;
  frequency: string;
  nextDue: string;
  daysRemaining: number;
  status: 'filed' | 'in-progress' | 'not-started' | 'overdue';
  responsible: string;
  complexity: 'low' | 'medium' | 'high';
  penaltyRisk: string;
}

export const REGULATORY_REPORTS: RegulatoryReport[] = [
  { id: 'rr-1', name: 'GSTR-3B (September)', jurisdiction: 'India GSTN', countryCode: 'IN', frequency: 'Monthly', nextDue: '2024-10-20', daysRemaining: 16, status: 'filed', responsible: 'Priya Sharma', complexity: 'medium', penaltyRisk: '₹200/day' },
  { id: 'rr-2', name: 'GSTR-1 (October)', jurisdiction: 'India GSTN', countryCode: 'IN', frequency: 'Monthly', nextDue: '2024-10-11', daysRemaining: 7, status: 'in-progress', responsible: 'Priya Sharma', complexity: 'medium', penaltyRisk: '₹200/day' },
  { id: 'rr-3', name: 'VAT Return Q3 (UK MTD)', jurisdiction: 'UK HMRC', countryCode: 'GB', frequency: 'Quarterly', nextDue: '2024-11-07', daysRemaining: 34, status: 'in-progress', responsible: 'James Wilson', complexity: 'medium', penaltyRisk: '£400 + points' },
  { id: 'rr-4', name: 'EU VAT OSS Q3', jurisdiction: 'EU (OSS Portal)', countryCode: 'DE', frequency: 'Quarterly', nextDue: '2024-10-31', daysRemaining: 27, status: 'in-progress', responsible: 'David Müller', complexity: 'high', penaltyRisk: '€1,000 per MS' },
  { id: 'rr-5', name: 'FBAR (FinCEN 114)', jurisdiction: 'US Treasury', countryCode: 'US', frequency: 'Annual', nextDue: '2025-04-15', daysRemaining: 193, status: 'not-started', responsible: 'David Wilson', complexity: 'high', penaltyRisk: '$10,000+' },
  { id: 'rr-6', name: 'FATCA Form 8938', jurisdiction: 'US IRS', countryCode: 'US', frequency: 'Annual', nextDue: '2025-04-15', daysRemaining: 193, status: 'not-started', responsible: 'David Wilson', complexity: 'high', penaltyRisk: '$10,000+' },
  { id: 'rr-7', name: 'UAE VAT Q3 (FTA)', jurisdiction: 'UAE FTA', countryCode: 'AE', frequency: 'Quarterly', nextDue: '2024-11-28', daysRemaining: 55, status: 'in-progress', responsible: 'Ahmed Al-Rashid', complexity: 'low', penaltyRisk: 'AED 1,000' },
  { id: 'rr-8', name: 'Singapore GST F5', jurisdiction: 'IRAS Singapore', countryCode: 'SG', frequency: 'Quarterly', nextDue: '2024-11-30', daysRemaining: 57, status: 'in-progress', responsible: 'Sarah Chen', complexity: 'low', penaltyRisk: 'SGD 200' },
  { id: 'rr-9', name: 'Australia BAS Q1', jurisdiction: 'ATO Australia', countryCode: 'AU', frequency: 'Quarterly', nextDue: '2024-10-28', daysRemaining: 24, status: 'in-progress', responsible: 'Olivia Brown', complexity: 'medium', penaltyRisk: 'AUD 330' },
  { id: 'rr-10', name: 'Canada GST/HST Annual', jurisdiction: 'CRA Canada', countryCode: 'CA', frequency: 'Annual', nextDue: '2025-06-15', daysRemaining: 254, status: 'not-started', responsible: 'Toronto Finance', complexity: 'medium', penaltyRisk: 'CAD 250' },
  { id: 'rr-11', name: 'Japan Consumption Tax', jurisdiction: 'NTA Japan', countryCode: 'JP', frequency: 'Annual', nextDue: '2025-02-28', daysRemaining: 147, status: 'in-progress', responsible: 'Yuki Tanaka', complexity: 'high', penaltyRisk: 'JPY 500K' },
  { id: 'rr-12', name: 'SOX 404 Certification', jurisdiction: 'US SEC', countryCode: 'US', frequency: 'Annual', nextDue: '2025-03-31', daysRemaining: 178, status: 'in-progress', responsible: 'David Wilson', complexity: 'high', penaltyRisk: 'Delisting risk' },
  { id: 'rr-13', name: 'Germany Umsatzsteuer', jurisdiction: 'BZSt Germany', countryCode: 'DE', frequency: 'Monthly', nextDue: '2024-10-10', daysRemaining: 6, status: 'in-progress', responsible: 'David Müller', complexity: 'medium', penaltyRisk: '€2,500' },
  { id: 'rr-14', name: 'France TVA', jurisdiction: 'DGFiP France', countryCode: 'FR', frequency: 'Monthly', nextDue: '2024-10-20', daysRemaining: 16, status: 'filed', responsible: 'Marie Dupont', complexity: 'medium', penaltyRisk: '€1,500' },
];

// ─── Translation Memory & Glossary ────────────────────────────────────────────

export interface TranslationMemory {
  id: string;
  sourceText: string;
  domain: string;
  translations: Record<string, { text: string; quality: number; reviewer: string }>;
  usageCount: number;
  lastUpdated: string;
}

export const TRANSLATION_MEMORY: TranslationMemory[] = [
  { id: 'tm-1', sourceText: 'Invoice', domain: 'Finance', translations: { hi: { text: 'चालान', quality: 100, reviewer: 'Priya S.' }, fr: { text: 'Facture', quality: 100, reviewer: 'Marie D.' }, de: { text: 'Rechnung', quality: 100, reviewer: 'David M.' }, ar: { text: 'فاتورة', quality: 98, reviewer: 'Ahmed R.' }, ja: { text: '請求書', quality: 100, reviewer: 'Yuki T.' }, zh: { text: '发票', quality: 100, reviewer: 'Sarah C.' }, es: { text: 'Factura', quality: 100, reviewer: 'Auto' } }, usageCount: 18420, lastUpdated: '2024-09-28' },
  { id: 'tm-2', sourceText: 'Goods and Services Tax', domain: 'Tax', translations: { hi: { text: 'वस्तु एवं सेवा कर', quality: 100, reviewer: 'Priya S.' }, fr: { text: 'Taxe sur les biens et services', quality: 96, reviewer: 'Marie D.' }, de: { text: 'Warenumsatzsteuer', quality: 94, reviewer: 'David M.' }, ar: { text: 'ضريبة السلع والخدمات', quality: 97, reviewer: 'Ahmed R.' }, ja: { text: '物品サービス税', quality: 95, reviewer: 'Yuki T.' }, zh: { text: '商品及服务税', quality: 98, reviewer: 'Sarah C.' }, es: { text: 'Impuesto sobre Bienes y Servicios', quality: 97, reviewer: 'Auto' } }, usageCount: 12480, lastUpdated: '2024-09-30' },
  { id: 'tm-3', sourceText: 'Cross-border payment', domain: 'Finance', translations: { hi: { text: 'सीमा पार भुगतान', quality: 99, reviewer: 'Priya S.' }, fr: { text: 'Paiement transfrontalier', quality: 100, reviewer: 'Marie D.' }, de: { text: 'Grenzüberschreitende Zahlung', quality: 98, reviewer: 'David M.' }, ar: { text: 'دفع عبر الحدود', quality: 96, reviewer: 'Ahmed R.' }, ja: { text: '越境支払い', quality: 94, reviewer: 'Yuki T.' }, zh: { text: '跨境支付', quality: 100, reviewer: 'Sarah C.' }, es: { text: 'Pago transfronterizo', quality: 99, reviewer: 'Auto' } }, usageCount: 8920, lastUpdated: '2024-10-01' },
  { id: 'tm-4', sourceText: 'Compliance', domain: 'Regulatory', translations: { hi: { text: 'अनुपालन', quality: 100, reviewer: 'Priya S.' }, fr: { text: 'Conformité', quality: 100, reviewer: 'Marie D.' }, de: { text: 'Compliance', quality: 100, reviewer: 'David M.' }, ar: { text: 'الامتثال', quality: 98, reviewer: 'Ahmed R.' }, ja: { text: 'コンプライアンス', quality: 96, reviewer: 'Yuki T.' }, zh: { text: '合规', quality: 100, reviewer: 'Sarah C.' }, es: { text: 'Cumplimiento', quality: 100, reviewer: 'Auto' } }, usageCount: 24600, lastUpdated: '2024-09-30' },
  { id: 'tm-5', sourceText: 'Tax liability', domain: 'Tax', translations: { hi: { text: 'कर देयता', quality: 100, reviewer: 'Priya S.' }, fr: { text: 'Passif fiscal', quality: 97, reviewer: 'Marie D.' }, de: { text: 'Steuerschuld', quality: 98, reviewer: 'David M.' }, ar: { text: 'الالتزام الضريبي', quality: 96, reviewer: 'Ahmed R.' }, ja: { text: '納税義務', quality: 95, reviewer: 'Yuki T.' }, zh: { text: '纳税义务', quality: 98, reviewer: 'Sarah C.' }, es: { text: 'Pasivo fiscal', quality: 97, reviewer: 'Auto' } }, usageCount: 9340, lastUpdated: '2024-09-29' },
  { id: 'tm-6', sourceText: 'Foreign exchange rate', domain: 'Finance', translations: { hi: { text: 'विदेशी मुद्रा दर', quality: 98, reviewer: 'Priya S.' }, fr: { text: 'Taux de change', quality: 100, reviewer: 'Marie D.' }, de: { text: 'Wechselkurs', quality: 100, reviewer: 'David M.' }, ar: { text: 'سعر الصرف', quality: 97, reviewer: 'Ahmed R.' }, ja: { text: '為替レート', quality: 98, reviewer: 'Yuki T.' }, zh: { text: '汇率', quality: 100, reviewer: 'Sarah C.' }, es: { text: 'Tipo de cambio', quality: 99, reviewer: 'Auto' } }, usageCount: 14200, lastUpdated: '2024-10-02' },
];

// ─── AI Scenario Planning ─────────────────────────────────────────────────────

export interface AIScenario {
  id: string;
  name: string;
  probability: number;
  impactUSD: number;
  timeHorizon: string;
  countries: CountryCode[];
  description: string;
  mitigation: string;
  confidence: number;
}

export const AI_SCENARIOS: AIScenario[] = [
  { id: 'sc-1', name: 'INR Depreciation 5% vs USD', probability: 68, impactUSD: -280000, timeHorizon: '6 months', countries: ['IN'], description: 'RBI may allow INR to depreciate to 87.5/USD due to oil import pressure and rate differential.', mitigation: 'Increase NDF hedge ratio from 48% to 65%; lock 6-month forwards at 84.95.', confidence: 82 },
  { id: 'sc-2', name: 'EU Digital Services Tax Expansion', probability: 42, impactUSD: -120000, timeHorizon: '12 months', countries: ['DE', 'FR'], description: 'EU may expand DST to cover B2B SaaS at 3% rate, affecting Germany and France revenue.', mitigation: 'Restructure EU contracts via Irish entity; monitor OECD Pillar 1 implementation.', confidence: 71 },
  { id: 'sc-3', name: 'US Section 174 R&D Capitalization', probability: 92, impactUSD: -180000, timeHorizon: 'Current FY', countries: ['US'], description: 'IRC Section 174 requires 5-year amortization of R&D costs, increasing US tax burden.', mitigation: 'File Form 8974 for R&D payroll tax credit offset; restructure AI Labs costs.', confidence: 96 },
  { id: 'sc-4', name: 'Singapore GST Rate Increase to 10%', probability: 28, impactUSD: -68000, timeHorizon: '18 months', countries: ['SG'], description: 'Singapore may accelerate GST rate increase to 10% (currently 9%) earlier than planned.', mitigation: 'Pre-build GST calculation engine for 10%; communicate price adjustment clause to customers.', confidence: 64 },
  { id: 'sc-5', name: 'UAE Corporate Tax Audit (FY2024)', probability: 35, impactUSD: -42000, timeHorizon: '9 months', countries: ['AE'], description: 'FTA may select VEYRO FZ-LLC for first-year corporate tax audit under new 9% regime.', mitigation: 'Complete transfer pricing documentation; maintain Qualified Free Zone Person status.', confidence: 78 },
  { id: 'sc-6', name: 'GBP Strengthening Post-Election', probability: 54, impactUSD: 95000, timeHorizon: '4 months', countries: ['GB'], description: 'GBP may strengthen to 1.32/USD on stability post-election, increasing UK entity USD valuation.', mitigation: 'Reduce GBP hedge ratio from 68% to 45%; lock gains on GBP receivables.', confidence: 76 },
  { id: 'sc-7', name: 'Japan Qualified Invoice System Penalties', probability: 18, impactUSD: -28000, timeHorizon: '3 months', countries: ['JP'], description: 'NTA may enforce penalties for non-compliant invoice issuers under QIS regime.', mitigation: 'Verify all 340 vendors have Qualified Invoice Issuer registration; implement auto-rejection.', confidence: 88 },
  { id: 'sc-8', name: 'India GST Rate Rationalization', probability: 48, impactUSD: 140000, timeHorizon: '12 months', countries: ['IN'], description: 'GST Council may rationalize slabs (18%→16%, 28%→24%), reducing overall tax burden.', mitigation: 'Update tax engine for new slabs; model impact on 2.8M invoices; prepare customer comms.', confidence: 69 },
];

// ─── Supply Chain Risk Monitor ────────────────────────────────────────────────

export interface SupplyChainRisk {
  id: string;
  vendor: string;
  vendorCountry: CountryCode;
  category: string;
  riskScore: number;
  leadTimeDays: number;
  onTimeRate: number;
  singleSource: boolean;
  alternatives: number;
  lastIncident: string;
  status: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
}

export const SUPPLY_CHAIN_RISKS: SupplyChainRisk[] = [
  { id: 'scr-1', vendor: 'Shenzhen Electronics Co.', vendorCountry: 'SG', category: 'Electronics', riskScore: 72, leadTimeDays: 28, onTimeRate: 94.2, singleSource: false, alternatives: 3, lastIncident: '2024-08-15', status: 'medium', mitigation: 'Dual-source via Vietnam supplier; 45-day buffer stock' },
  { id: 'scr-2', vendor: 'Bayern Maschinen GmbH', vendorCountry: 'DE', category: 'Machinery', riskScore: 38, leadTimeDays: 42, onTimeRate: 98.4, singleSource: true, alternatives: 1, lastIncident: '2024-03-20', status: 'low', mitigation: 'Sole-source due to IP; 90-day advance PO' },
  { id: 'scr-3', vendor: 'Texas Components Inc.', vendorCountry: 'US', category: 'Semiconductors', riskScore: 45, leadTimeDays: 35, onTimeRate: 96.8, singleSource: false, alternatives: 4, lastIncident: '2024-06-10', status: 'low', mitigation: 'Multi-source US/TW/KR; 60-day strategic buffer' },
  { id: 'scr-4', vendor: 'Lyon Textiles SARL', vendorCountry: 'FR', category: 'Textiles', riskScore: 28, leadTimeDays: 18, onTimeRate: 99.1, singleSource: false, alternatives: 6, lastIncident: '2024-01-05', status: 'low', mitigation: 'Commodity; 5+ qualified alternates' },
  { id: 'scr-5', vendor: 'Osaka Precision Ltd.', vendorCountry: 'JP', category: 'Optics', riskScore: 68, leadTimeDays: 52, onTimeRate: 92.4, singleSource: true, alternatives: 0, lastIncident: '2024-09-12', status: 'high', mitigation: 'Critical sole-source; exploring German alt; 120-day buffer' },
  { id: 'scr-6', vendor: 'Manchester Steelworks', vendorCountry: 'GB', category: 'Steel', riskScore: 52, leadTimeDays: 24, onTimeRate: 95.6, singleSource: false, alternatives: 3, lastIncident: '2024-07-22', status: 'medium', mitigation: 'EU + India dual-source; 30-day buffer' },
  { id: 'scr-7', vendor: 'Mumbai Cloud Services', vendorCountry: 'IN', category: 'Cloud Infra', riskScore: 22, leadTimeDays: 1, onTimeRate: 99.97, singleSource: false, alternatives: 3, lastIncident: '2024-02-18', status: 'low', mitigation: 'Multi-cloud AWS+Azure+GCP; auto-failover' },
  { id: 'scr-8', vendor: 'Dubai Logistics FZ', vendorCountry: 'AE', category: 'Logistics', riskScore: 34, leadTimeDays: 7, onTimeRate: 97.8, singleSource: false, alternatives: 4, lastIncident: '2024-05-14', status: 'low', mitigation: '4PL with backup 3PL; MEA redundancy' },
];

// ─── Global KPI Summary (Enterprise Tier) ─────────────────────────────────────

export const ENTERPRISE_KPIS = {
  totalEntities: 15,
  totalHeadcount: 1112,
  totalRevenueUSD: 9140000,
  totalAssetsUSD: 19744000,
  totalEquityUSD: 9920000,
  totalHedgeNotionalUSD: 3815340,
  totalIntercompanyLoansUSD: 4595000,
  totalTaxCreditsUSD: 617400,
  totalInsuranceCoverageUSD: 139000000,
  totalCashPoolUSD: 5982000,
  consolidatedNetIncomeUSD: 2498000,
  effectiveTaxRate: 22.4,
  weightedDSO: 42,
  weightedDPO: 56,
  hedgingEffectiveness: 94.8,
  auditFindings: 3,
  pendingRegulatoryReports: 9,
};
