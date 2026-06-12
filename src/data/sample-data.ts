// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Centralized Sample Dataset
// Single source of truth for all mock/fallback data across the app.
// All components should read from the Zustand store, which initializes from here.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FilingStatus, IssueSeverity, MatchStatus } from '@/types/gst';

// ─── Current operating period ─────────────────────────────────────────────────
export const CURRENT_PERIOD = '2025-06';
export const CURRENT_DATE = '2025-07-08';

// ─── Client Data ──────────────────────────────────────────────────────────────
export interface SampleClient {
  id: string;
  gstin: string;
  tradeName: string;
  legalName: string;
  state: string;
  stateCode: string;
  entityType: string;
  returnPeriod: string;
  lastFilingDate: string;
  status: 'active' | 'inactive' | 'suspended';
  healthScore: number;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export const SAMPLE_CLIENTS: SampleClient[] = [
  {
    id: 'client-1',
    gstin: '27AABCS1429B1Z5',
    tradeName: 'Sharma Enterprises',
    legalName: 'Sharma Enterprises Pvt Ltd',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-06-10',
    status: 'active',
    healthScore: 92,
    contactEmail: 'accounts@sharmaent.in',
    contactPhone: '+91 98200 12345',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-06-10T14:30:00Z',
  },
  {
    id: 'client-2',
    gstin: '24AABCP5678Q1Z3',
    tradeName: 'Patel & Sons',
    legalName: 'Patel & Sons Trading Co.',
    state: 'Gujarat',
    stateCode: '24',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-06-09',
    status: 'active',
    healthScore: 62,
    contactEmail: 'gst@patelsons.in',
    contactPhone: '+91 79123 45678',
    createdAt: '2025-01-20T09:00:00Z',
    updatedAt: '2025-06-09T11:20:00Z',
  },
  {
    id: 'client-3',
    gstin: '29AABCK9012L1Z7',
    tradeName: 'Krishna Traders',
    legalName: 'Krishna Traders Pvt Ltd',
    state: 'Karnataka',
    stateCode: '29',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-06-11',
    status: 'active',
    healthScore: 88,
    contactEmail: 'finance@krishnatraders.in',
    contactPhone: '+91 80123 98765',
    createdAt: '2025-02-01T08:00:00Z',
    updatedAt: '2025-06-11T16:00:00Z',
  },
  {
    id: 'client-4',
    gstin: '27AABCM3456N1Z9',
    tradeName: 'Metro Retail',
    legalName: 'Metro Retail Solutions Pvt Ltd',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-05-11',
    status: 'active',
    healthScore: 45,
    contactEmail: 'accounts@metroretail.in',
    contactPhone: '+91 22345 67890',
    createdAt: '2025-02-10T07:30:00Z',
    updatedAt: '2025-05-11T12:00:00Z',
  },
  {
    id: 'client-5',
    gstin: '27AABCX7890P1Z2',
    tradeName: 'Sunrise Exports',
    legalName: 'Sunrise Exports India Pvt Ltd',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-06-10',
    status: 'active',
    healthScore: 85,
    contactEmail: 'gst@sunriseexports.in',
    contactPhone: '+91 98765 43210',
    createdAt: '2025-02-15T06:00:00Z',
    updatedAt: '2025-06-10T09:30:00Z',
  },
  {
    id: 'client-6',
    gstin: '06AABCG2345R1Z4',
    tradeName: 'Gupta Manufacturing',
    legalName: 'Gupta Manufacturing Industries Pvt Ltd',
    state: 'Haryana',
    stateCode: '06',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-06-10',
    status: 'active',
    healthScore: 78,
    contactEmail: 'finance@guptamfg.in',
    contactPhone: '+91 12451 23456',
    createdAt: '2025-03-01T10:00:00Z',
    updatedAt: '2025-06-10T15:00:00Z',
  },
  {
    id: 'client-7',
    gstin: '27AABCA6789S1Z6',
    tradeName: 'Apex Logistics',
    legalName: 'Apex Logistics Solutions Pvt Ltd',
    state: 'Maharashtra',
    stateCode: '27',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2025-05-20',
    status: 'active',
    healthScore: 70,
    contactEmail: 'accounts@apexlogistics.in',
    contactPhone: '+91 98333 11111',
    createdAt: '2025-03-15T08:00:00Z',
    updatedAt: '2025-05-20T14:00:00Z',
  },
  {
    id: 'client-8',
    gstin: '29AABCR0123T1Z8',
    tradeName: 'RK Electronics',
    legalName: 'RK Electronics Pvt Ltd',
    state: 'Karnataka',
    stateCode: '29',
    entityType: 'regular',
    returnPeriod: 'quarterly',
    lastFilingDate: '2025-04-20',
    status: 'active',
    healthScore: 55,
    contactEmail: 'gst@rkelectronics.in',
    contactPhone: '+91 80555 22222',
    createdAt: '2025-04-01T09:00:00Z',
    updatedAt: '2025-04-20T11:00:00Z',
  },
];

// ─── Filing Data ──────────────────────────────────────────────────────────────
export interface SampleFiling {
  id: string;
  clientId: string;
  returnType: 'GSTR-1' | 'GSTR-3B';
  period: string;
  status: FilingStatus;
  filedDate?: string;
  acknowledgmentNumber?: string;
  totalInvoices: number;
  readyForFiling: number;
  issuesFound: number;
  criticalErrors: number;
  warnings: number;
  totalTaxableValue: number;
  totalTax: number;
  createdAt: string;
  updatedAt: string;
}

export const SAMPLE_FILINGS: SampleFiling[] = [
  // Sharma Enterprises
  { id: 'f1', clientId: 'client-1', returnType: 'GSTR-1', period: '2025-06', status: 'validated', totalInvoices: 47, readyForFiling: 47, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 3245000, totalTax: 452310, createdAt: '2025-07-01T10:15:00Z', updatedAt: '2025-07-02T09:00:00Z' },
  { id: 'f2', clientId: 'client-1', returnType: 'GSTR-3B', period: '2025-06', status: 'draft', totalInvoices: 47, readyForFiling: 0, issuesFound: 3, criticalErrors: 0, warnings: 3, totalTaxableValue: 3245000, totalTax: 245800, createdAt: '2025-07-01T10:15:00Z', updatedAt: '2025-07-01T10:15:00Z' },
  { id: 'f3', clientId: 'client-1', returnType: 'GSTR-1', period: '2025-05', status: 'filed', filedDate: '2025-06-10', acknowledgmentNumber: 'AA060625001234', totalInvoices: 43, readyForFiling: 43, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 2980000, totalTax: 218400, createdAt: '2025-06-01T10:00:00Z', updatedAt: '2025-06-10T16:45:00Z' },
  { id: 'f4', clientId: 'client-1', returnType: 'GSTR-3B', period: '2025-05', status: 'filed', filedDate: '2025-06-18', acknowledgmentNumber: 'AA060625005678', totalInvoices: 43, readyForFiling: 43, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 2980000, totalTax: 234100, createdAt: '2025-06-01T10:00:00Z', updatedAt: '2025-06-18T15:30:00Z' },

  // Patel & Sons
  { id: 'f5', clientId: 'client-2', returnType: 'GSTR-1', period: '2025-06', status: 'draft', totalInvoices: 23, readyForFiling: 0, issuesFound: 4, criticalErrors: 2, warnings: 2, totalTaxableValue: 1876000, totalTax: 341200, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-01T09:00:00Z' },
  { id: 'f6', clientId: 'client-2', returnType: 'GSTR-3B', period: '2025-05', status: 'prepared', totalInvoices: 28, readyForFiling: 20, issuesFound: 8, criticalErrors: 2, warnings: 6, totalTaxableValue: 2154000, totalTax: 672300, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-29T11:15:00Z' },
  { id: 'f7', clientId: 'client-2', returnType: 'GSTR-1', period: '2025-05', status: 'filed', filedDate: '2025-06-09', acknowledgmentNumber: 'AA060625009012', totalInvoices: 25, readyForFiling: 25, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 1956000, totalTax: 612500, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-09T14:30:00Z' },

  // Krishna Traders
  { id: 'f8', clientId: 'client-3', returnType: 'GSTR-1', period: '2025-06', status: 'validated', totalInvoices: 19, readyForFiling: 19, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 890000, totalTax: 110000, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-02T10:00:00Z' },
  { id: 'f9', clientId: 'client-3', returnType: 'GSTR-3B', period: '2025-06', status: 'prepared', totalInvoices: 19, readyForFiling: 15, issuesFound: 2, criticalErrors: 0, warnings: 2, totalTaxableValue: 890000, totalTax: 118500, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-03T08:00:00Z' },
  { id: 'f10', clientId: 'client-3', returnType: 'GSTR-1', period: '2025-05', status: 'filed', filedDate: '2025-06-11', acknowledgmentNumber: 'AA060625019012', totalInvoices: 17, readyForFiling: 17, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 820000, totalTax: 105200, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-11T12:00:00Z' },

  // Metro Retail
  { id: 'f11', clientId: 'client-4', returnType: 'GSTR-1', period: '2025-06', status: 'reviewed', totalInvoices: 56, readyForFiling: 48, issuesFound: 8, criticalErrors: 2, warnings: 6, totalTaxableValue: 4120000, totalTax: 337445, createdAt: '2025-07-02T09:30:00Z', updatedAt: '2025-07-04T14:00:00Z' },
  { id: 'f12', clientId: 'client-4', returnType: 'GSTR-3B', period: '2025-05', status: 'prepared', totalInvoices: 52, readyForFiling: 30, issuesFound: 12, criticalErrors: 4, warnings: 8, totalTaxableValue: 3850000, totalTax: 356200, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-30T14:10:00Z' },
  { id: 'f13', clientId: 'client-4', returnType: 'GSTR-1', period: '2025-05', status: 'prepared', totalInvoices: 48, readyForFiling: 38, issuesFound: 10, criticalErrors: 2, warnings: 8, totalTaxableValue: 3680000, totalTax: 328900, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-30T14:00:00Z' },
  { id: 'f14', clientId: 'client-4', returnType: 'GSTR-1', period: '2025-04', status: 'filed', filedDate: '2025-05-11', acknowledgmentNumber: 'AA050625031234', totalInvoices: 44, readyForFiling: 44, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 3450000, totalTax: 315600, createdAt: '2025-05-01T09:00:00Z', updatedAt: '2025-05-11T16:00:00Z' },

  // Sunrise Exports
  { id: 'f15', clientId: 'client-5', returnType: 'GSTR-1', period: '2025-06', status: 'validated', totalInvoices: 19, readyForFiling: 19, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 2340000, totalTax: 893420, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-02T08:00:00Z' },
  { id: 'f16', clientId: 'client-5', returnType: 'GSTR-1', period: '2025-05', status: 'filed', filedDate: '2025-06-10', acknowledgmentNumber: 'AA060625040001', totalInvoices: 16, readyForFiling: 16, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 2150000, totalTax: 812500, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-10T10:00:00Z' },

  // Gupta Manufacturing
  { id: 'f17', clientId: 'client-6', returnType: 'GSTR-1', period: '2025-06', status: 'validated', totalInvoices: 32, readyForFiling: 32, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 4850000, totalTax: 1287650, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-02T11:00:00Z' },
  { id: 'f18', clientId: 'client-6', returnType: 'GSTR-3B', period: '2025-05', status: 'filed', filedDate: '2025-06-20', acknowledgmentNumber: 'AA060625050001', totalInvoices: 28, readyForFiling: 28, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 4120000, totalTax: 945300, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-20T15:00:00Z' },

  // Apex Logistics
  { id: 'f19', clientId: 'client-7', returnType: 'GSTR-1', period: '2025-06', status: 'draft', totalInvoices: 38, readyForFiling: 0, issuesFound: 5, criticalErrors: 1, warnings: 4, totalTaxableValue: 2780000, totalTax: 489200, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-01T09:00:00Z' },
  { id: 'f20', clientId: 'client-7', returnType: 'GSTR-3B', period: '2025-05', status: 'filed', filedDate: '2025-06-20', acknowledgmentNumber: 'AA060625060001', totalInvoices: 35, readyForFiling: 35, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 2560000, totalTax: 452800, createdAt: '2025-06-01T09:00:00Z', updatedAt: '2025-06-20T14:00:00Z' },

  // RK Electronics
  { id: 'f21', clientId: 'client-8', returnType: 'GSTR-1', period: '2025-06', status: 'draft', totalInvoices: 24, readyForFiling: 0, issuesFound: 3, criticalErrors: 1, warnings: 2, totalTaxableValue: 1920000, totalTax: 312400, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2025-07-01T09:00:00Z' },
  { id: 'f22', clientId: 'client-8', returnType: 'GSTR-1', period: '2025-03', status: 'filed', filedDate: '2025-04-20', acknowledgmentNumber: 'AA040625070001', totalInvoices: 20, readyForFiling: 20, issuesFound: 0, criticalErrors: 0, warnings: 0, totalTaxableValue: 1650000, totalTax: 278500, createdAt: '2025-04-01T09:00:00Z', updatedAt: '2025-04-20T11:00:00Z' },
];

// ─── Invoice Data (for Return Prep Workspace) ────────────────────────────────
export interface SampleInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  date: string;
  customer: string;
  customerGstin?: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  status: 'validated' | 'warning' | 'error';
  errorDetail?: string;
  hsnCode?: string;
  placeOfSupply?: string;
}

export const SAMPLE_INVOICES: Record<string, SampleInvoice[]> = {
  'client-1': [
    { id: 'inv1', clientId: 'client-1', invoiceNumber: 'INV-2025-0801', date: '2025-06-02', customer: 'Reliance Industries Ltd', customerGstin: '27AAACR5055K1Z5', taxableValue: 450000, cgst: 40500, sgst: 40500, igst: 0, status: 'validated', hsnCode: '8471', placeOfSupply: '27' },
    { id: 'inv2', clientId: 'client-1', invoiceNumber: 'INV-2025-0802', date: '2025-06-04', customer: 'Tata Consultancy Services', customerGstin: '27AAACR4898K1Z3', taxableValue: 320000, cgst: 28800, sgst: 28800, igst: 0, status: 'validated', hsnCode: '9983', placeOfSupply: '27' },
    { id: 'inv3', clientId: 'client-1', invoiceNumber: 'INV-2025-0803', date: '2025-06-05', customer: 'Mahindra & Mahindra Ltd', customerGstin: '27AAACM1410M1Z1', taxableValue: 185000, cgst: 16650, sgst: 16650, igst: 0, status: 'validated', hsnCode: '8703', placeOfSupply: '27' },
    { id: 'inv4', clientId: 'client-1', invoiceNumber: 'INV-2025-0804', date: '2025-06-07', customer: 'Infosys Technologies', customerGstin: '29AABCI6782L1Z7', taxableValue: 275000, cgst: 0, sgst: 0, igst: 49500, status: 'validated', hsnCode: '9983', placeOfSupply: '29' },
    { id: 'inv5', clientId: 'client-1', invoiceNumber: 'INV-2025-0805', date: '2025-06-08', customer: 'Wipro Enterprises', customerGstin: '29AABCW7489P1Z9', taxableValue: 142000, cgst: 12780, sgst: 12780, igst: 0, status: 'warning', errorDetail: 'Missing HSN code for 2 line items', hsnCode: '' },
    { id: 'inv6', clientId: 'client-1', invoiceNumber: 'INV-2025-0806', date: '2025-06-10', customer: 'HDFC Bank Ltd', customerGstin: '27AABCH3681K1Z4', taxableValue: 95000, cgst: 8550, sgst: 8550, igst: 0, status: 'validated', hsnCode: '9997', placeOfSupply: '27' },
    { id: 'inv7', clientId: 'client-1', invoiceNumber: 'INV-2025-0807', date: '2025-06-11', customer: 'Bajaj Finserv Ltd', customerGstin: '27AABCB5342M1Z1', taxableValue: 210000, cgst: 0, sgst: 0, igst: 37800, status: 'validated', hsnCode: '9999', placeOfSupply: '29' },
    { id: 'inv8', clientId: 'client-1', invoiceNumber: 'INV-2025-0808', date: '2025-06-12', customer: 'Larsen & Toubro Ltd', customerGstin: '27AAACM5241Z2ZM', taxableValue: 520000, cgst: 46800, sgst: 46800, igst: 0, status: 'error', errorDetail: 'Invalid GSTIN: 27AAACM5241Z2ZM fails checksum', hsnCode: '8479', placeOfSupply: '27' },
    { id: 'inv9', clientId: 'client-1', invoiceNumber: 'INV-2025-0809', date: '2025-06-14', customer: 'Godrej Consumer Products', customerGstin: '27AAACG4735K1Z8', taxableValue: 168000, cgst: 15120, sgst: 15120, igst: 0, status: 'validated', hsnCode: '3304', placeOfSupply: '27' },
    { id: 'inv10', clientId: 'client-1', invoiceNumber: 'INV-2025-0810', date: '2025-06-15', customer: 'Maruti Suzuki India', customerGstin: '06AABCM6420B1Z2', taxableValue: 390000, cgst: 0, sgst: 0, igst: 70200, status: 'validated', hsnCode: '8703', placeOfSupply: '06' },
    { id: 'inv11', clientId: 'client-1', invoiceNumber: 'INV-2025-0811', date: '2025-06-17', customer: 'Adani Ports & SEZ', customerGstin: '27AAACA7392N1Z5', taxableValue: 245000, cgst: 22050, sgst: 22050, igst: 0, status: 'validated', hsnCode: '9983', placeOfSupply: '27' },
    { id: 'inv12', clientId: 'client-1', invoiceNumber: 'INV-2025-0812', date: '2025-06-18', customer: 'Bharti Airtel Ltd', customerGstin: '29AABCB6472H1Z3', taxableValue: 178000, cgst: 0, sgst: 0, igst: 32040, status: 'warning', errorDetail: 'Duplicate invoice number detected', hsnCode: '9984', placeOfSupply: '29' },
    { id: 'inv13', clientId: 'client-1', invoiceNumber: 'INV-2025-0813', date: '2025-06-20', customer: 'ICICI Lombard General', customerGstin: '27AAACI1847J1Z6', taxableValue: 134000, cgst: 12060, sgst: 12060, igst: 0, status: 'validated', hsnCode: '9996', placeOfSupply: '27' },
    { id: 'inv14', clientId: 'client-1', invoiceNumber: 'INV-2025-0814', date: '2025-06-22', customer: 'Hindustan Unilever Ltd', customerGstin: '27AAACH1542Q1Z3', taxableValue: 295000, cgst: 26550, sgst: 26550, igst: 0, status: 'error', errorDetail: 'Tax calculation error: CGST should be ₹26,550 but found ₹25,350', hsnCode: '3401', placeOfSupply: '27' },
    { id: 'inv15', clientId: 'client-1', invoiceNumber: 'INV-2025-0815', date: '2025-06-25', customer: 'Asian Paints Ltd', customerGstin: '27AAACA5321K1Z7', taxableValue: 88000, cgst: 7920, sgst: 7920, igst: 0, status: 'validated', hsnCode: '3209', placeOfSupply: '27' },
  ],
};

// ─── Validation Issues ────────────────────────────────────────────────────────
export interface SampleValidationIssue {
  id: string;
  clientId: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  invoiceRef: string;
  fixAction: string;
  resolved: boolean;
}

export const SAMPLE_ISSUES: Record<string, SampleValidationIssue[]> = {
  'client-1': [
    { id: 'v1', clientId: 'client-1', severity: 'critical', category: 'Invalid GSTIN', description: 'Buyer GSTIN 27AAACM5241Z2ZM in INV-2025-0808 fails checksum validation', invoiceRef: 'INV-2025-0808', fixAction: 'Correct GSTIN', resolved: false },
    { id: 'v2', clientId: 'client-1', severity: 'critical', category: 'Tax Calculation Error', description: 'CGST amount in INV-2025-0814 does not match 9% of taxable value ₹2,95,000 (expected ₹26,550, found ₹25,350)', invoiceRef: 'INV-2025-0814', fixAction: 'Recalculate Tax', resolved: false },
    { id: 'v3', clientId: 'client-1', severity: 'warning', category: 'Missing HSN Code', description: '2 line items in INV-2025-0805 missing HSN/SAC codes as required for GSTR-1 filing', invoiceRef: 'INV-2025-0805', fixAction: 'Add HSN Codes', resolved: false },
    { id: 'v4', clientId: 'client-1', severity: 'warning', category: 'Duplicate Invoice', description: 'INV-2025-0812 has same number as a previously filed invoice in May 2025 return', invoiceRef: 'INV-2025-0812', fixAction: 'Resolve Duplicate', resolved: false },
    { id: 'v5', clientId: 'client-1', severity: 'info', category: 'Missing Mandatory Field', description: 'Place of supply not specified for 3 inter-state invoices (INV-2025-0804, INV-2025-0807, INV-2025-0810)', invoiceRef: 'INV-2025-0804', fixAction: 'Add Place of Supply', resolved: false },
  ],
};

// ─── Reconciliation Drilldown Data ────────────────────────────────────────────
export interface SampleReconDrilldown {
  invoiceNumber: string;
  date: string;
  vendor: string;
  booksAmount: number;
  portalAmount: number;
  difference: number;
  reason: string;
}

export const SAMPLE_RECON_DRILLDOWNS: Record<string, Record<string, SampleReconDrilldown[]>> = {
  'client-1': {
    'Partial Match': [
      { invoiceNumber: 'INV-2025-0789', date: '2025-06-03', vendor: 'Tata Steel Ltd', booksAmount: 285000, portalAmount: 262000, difference: 23000, reason: 'Credit note of ₹23,000 not reflected in GSTR-2B yet' },
      { invoiceNumber: 'INV-2025-0795', date: '2025-06-08', vendor: 'Reliance Retail Ltd', booksAmount: 142000, portalAmount: 135000, difference: 7000, reason: 'Discount of ₹7,000 applied post-filing by supplier' },
      { invoiceNumber: 'INV-2025-0801', date: '2025-06-12', vendor: 'Hindustan Petroleum', booksAmount: 96000, portalAmount: 89000, difference: 7000, reason: 'TCS amount included in books but excluded from portal' },
      { invoiceNumber: 'INV-2025-0803', date: '2025-06-15', vendor: 'ITC Ltd', booksAmount: 178000, portalAmount: 164000, difference: 14000, reason: 'Supplier filed partial amount; amended return expected' },
    ],
    'Mismatch': [
      { invoiceNumber: 'INV-2025-0792', date: '2025-06-05', vendor: 'Mahindra Logistics', booksAmount: 340000, portalAmount: 285000, difference: 55000, reason: 'Wrong GSTIN used in portal; supplier filed under different entity' },
      { invoiceNumber: 'INV-2025-0798', date: '2025-06-10', vendor: 'Adani Wilmar Ltd', booksAmount: 225000, portalAmount: 180000, difference: 45000, reason: 'IGST vs CGST+SGST mismatch — inter-state filed as intra-state' },
      { invoiceNumber: 'INV-2025-0810', date: '2025-06-18', vendor: 'Dalmia Cement Ltd', booksAmount: 412000, portalAmount: 350000, difference: 62000, reason: 'Tax rate difference: 18% in books vs 12% in portal. HSN reclassification needed.' },
    ],
    'Missing in Books': [
      { invoiceNumber: 'G2B-2025-4421', date: '2025-06-07', vendor: 'Sun Pharma Industries', booksAmount: 0, portalAmount: 52000, difference: 52000, reason: 'Invoice present in GSTR-2B but not recorded in purchase register' },
      { invoiceNumber: 'G2B-2025-4456', date: '2025-06-14', vendor: "Divi's Laboratories", booksAmount: 0, portalAmount: 34000, difference: 34000, reason: 'Purchase invoice from vendor not entered; possibly received after month-end' },
    ],
    'Missing in Portal': [
      { invoiceNumber: 'INV-2025-0791', date: '2025-06-02', vendor: 'Bharat Petroleum', booksAmount: 89000, portalAmount: 0, difference: 89000, reason: 'Supplier has not filed GSTR-1 for June 2025 yet. Follow up required.' },
      { invoiceNumber: 'INV-2025-0804', date: '2025-06-09', vendor: 'Asian Paints Ltd', booksAmount: 67000, portalAmount: 0, difference: 67000, reason: 'Supplier filing deadline is Jul 11. Check again after due date.' },
      { invoiceNumber: 'INV-2025-0812', date: '2025-06-16', vendor: 'Pidilite Industries', booksAmount: 38000, portalAmount: 0, difference: 38000, reason: 'Invoice recorded in books; vendor may file under QRMP scheme' },
    ],
  },
};

// ─── Reconciliation Summary ──────────────────────────────────────────────────
export interface SampleReconCategory {
  label: string;
  count: number;
  amount: number;
  color: string;
  bgColor: string;
}

export const SAMPLE_RECON_SUMMARY: Record<string, SampleReconCategory[]> = {
  'client-1': [
    { label: 'Perfect Match', count: 38, amount: 2854000, color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
    { label: 'Partial Match', count: 4, amount: 312000, color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
    { label: 'Mismatch', count: 3, amount: 245000, color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
    { label: 'Missing in Books', count: 2, amount: 86000, color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
    { label: 'Missing in Portal', count: 3, amount: 194000, color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  ],
};

// ─── AI Insights ──────────────────────────────────────────────────────────────
export interface SampleAIInsight {
  id: string;
  clientId: string;
  type: 'risk_alert' | 'missing_doc' | 'tax_anomaly' | 'filing_rec';
  title: string;
  description: string;
  suggestedAction: string;
  urgency: 'high' | 'medium' | 'info';
  dismissed: boolean;
}

export const SAMPLE_AI_INSIGHTS: Record<string, SampleAIInsight[]> = {
  'client-1': [
    { id: 'ai1', clientId: 'client-1', type: 'risk_alert', title: 'Invalid GSTIN blocking 1 B2B invoice', description: 'INV-2025-0808 has GSTIN 27AAACM5241Z2ZM which fails checksum. This invoice (₹5,20,000 + ₹93,600 tax) cannot be included in filing until corrected.', suggestedAction: 'Fix GSTIN', urgency: 'high', dismissed: false },
    { id: 'ai2', clientId: 'client-1', type: 'tax_anomaly', title: 'Tax calculation discrepancy of ₹1,200', description: 'INV-2025-0814 shows CGST ₹25,350 instead of expected ₹26,550 (9% of ₹2,95,000). Likely a data entry error in the sales register.', suggestedAction: 'Recalculate', urgency: 'high', dismissed: false },
    { id: 'ai3', clientId: 'client-1', type: 'missing_doc', title: '3 invoices missing from GSTR-2B', description: 'Invoices from Adani Ports (₹2,45,000), Asian Paints (₹88,000), and ICICI Lombard (₹1,34,000) not reflected in GSTR-2B. Vendors may not have filed yet.', suggestedAction: 'Review Missing', urgency: 'medium', dismissed: false },
    { id: 'ai4', clientId: 'client-1', type: 'filing_rec', title: 'File GSTR-1 before July 11 deadline', description: '3 days remaining. Resolve 2 critical issues and 2 warnings to achieve 100% filing readiness.', suggestedAction: 'Resolve Issues', urgency: 'high', dismissed: false },
    { id: 'ai5', clientId: 'client-1', type: 'risk_alert', title: 'Duplicate invoice number may cause rejection', description: 'INV-2025-0812 duplicates a number already filed in May 2025. GST portal will reject the JSON. Renumber before filing.', suggestedAction: 'Fix Duplicate', urgency: 'medium', dismissed: false },
    { id: 'ai6', clientId: 'client-1', type: 'filing_rec', title: 'ITC of ₹18,240 at risk from recon mismatches', description: '3 invoices show mismatch between books and GSTR-2B. If unresolved, ITC claims will be disallowed during assessment.', suggestedAction: 'Run Reconciliation', urgency: 'info', dismissed: false },
  ],
};

// ─── Dashboard Metrics ────────────────────────────────────────────────────────
export interface SampleDashboardMetrics {
  readyToFile: number;
  criticalIssues: number;
  pendingReturns: number;
  filedThisMonth: number;
  totalReturns: number;
}

export const SAMPLE_DASHBOARD_METRICS: SampleDashboardMetrics = {
  readyToFile: 5,
  criticalIssues: 4,
  pendingReturns: 11,
  filedThisMonth: 5,
  totalReturns: 16,
};

// ─── Blocking Issues ──────────────────────────────────────────────────────────
export interface SampleBlockingIssue {
  id: string;
  clientId: string;
  clientName: string;
  category: 'gstin_error' | 'missing_invoice' | 'recon_mismatch' | 'validation_failure';
  title: string;
  detail: string;
  invoiceRef?: string;
  amount?: number;
}

export const SAMPLE_BLOCKING_ISSUES: SampleBlockingIssue[] = [
  { id: 'bi1', clientId: 'client-4', clientName: 'Metro Retail', category: 'gstin_error', title: 'Invalid GSTIN in 2 B2B invoices', detail: '27AAACM5241Z2ZM fails checksum — buyer GSTIN in INV-2025-1089, INV-2025-1092', invoiceRef: 'INV-2025-1089' },
  { id: 'bi2', clientId: 'client-2', clientName: 'Patel & Sons', category: 'recon_mismatch', title: '₹42,560 ITC mismatch on INV-2025-1045', detail: 'Books: ₹25,000 CGST + ₹25,000 SGST. Portal: ₹22,000 CGST + ₹22,000 SGST. Difference: ₹6,000', invoiceRef: 'INV-2025-1045', amount: 42560 },
  { id: 'bi3', clientId: 'client-7', clientName: 'Apex Logistics', category: 'missing_invoice', title: '4 invoices missing from GSTR-2B', detail: 'Purchase invoices from May 2025 not reflected in GSTR-2B. Vendors may not have filed.' },
  { id: 'bi4', clientId: 'client-3', clientName: 'Krishna Traders', category: 'validation_failure', title: 'HSN code validation failed for 3 line items', detail: 'HSN codes 8471, 8517, 8528 returned invalid in GSTR-1 JSON schema validation' },
  { id: 'bi5', clientId: 'client-8', clientName: 'RK Electronics', category: 'recon_mismatch', title: '₹18,240 tax difference in INV-2025-0923', detail: 'Books: ₹54,720 IGST. Portal: ₹36,480 IGST. Possible partial reporting by supplier.', invoiceRef: 'INV-2025-0923', amount: 18240 },
];

// ─── Recent Uploads ──────────────────────────────────────────────────────────
export interface SampleUpload {
  id: string;
  filename: string;
  uploadTime: string;
  status: 'processing' | 'extracted' | 'failed';
  clientName: string;
  clientId: string;
  rowCount?: number;
  invoiceCount?: number;
  accuracy?: number;
}

export const SAMPLE_UPLOADS: SampleUpload[] = [
  { id: 'u1', filename: 'Sales_Register_Jun2025.xlsx', uploadTime: '2 hours ago', status: 'extracted', clientName: 'Sharma Enterprises', clientId: 'client-1', rowCount: 342, invoiceCount: 47, accuracy: 98.7 },
  { id: 'u2', filename: 'Purchase_Register_Jun2025.pdf', uploadTime: '3 hours ago', status: 'processing', clientName: 'Gupta Manufacturing', clientId: 'client-6', rowCount: 186 },
  { id: 'u3', filename: 'GSTR1_May2025.json', uploadTime: '5 hours ago', status: 'extracted', clientName: 'Sunrise Exports', clientId: 'client-5', invoiceCount: 19, accuracy: 100 },
  { id: 'u4', filename: 'Bank_Statement_Jun2025.pdf', uploadTime: 'Yesterday', status: 'failed', clientName: 'Metro Retail', clientId: 'client-4' },
];

// ─── Helper: Get client by ID ────────────────────────────────────────────────
export function getClientById(id: string): SampleClient | undefined {
  return SAMPLE_CLIENTS.find(c => c.id === id);
}

export function getClientInvoices(clientId: string): SampleInvoice[] {
  return SAMPLE_INVOICES[clientId] ?? [];
}

export function getClientIssues(clientId: string): SampleValidationIssue[] {
  return SAMPLE_ISSUES[clientId] ?? [];
}

export function getClientInsights(clientId: string): SampleAIInsight[] {
  return SAMPLE_AI_INSIGHTS[clientId] ?? [];
}

export function getClientFilings(clientId: string): SampleFiling[] {
  return SAMPLE_FILINGS.filter(f => f.clientId === clientId);
}

export function getClientReconDrilldowns(clientId: string): Record<string, SampleReconDrilldown[]> {
  return SAMPLE_RECON_DRILLDOWNS[clientId] ?? {};
}

export function getClientReconSummary(clientId: string): SampleReconCategory[] {
  return SAMPLE_RECON_SUMMARY[clientId] ?? [];
}
