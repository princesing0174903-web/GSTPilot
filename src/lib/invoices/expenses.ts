// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Expense Cloud™
// Operational spend tracking, auto-categorization, GST claimability detection.
// Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Expense, ExpenseCategory } from './types';

// ─── Category catalog ─────────────────────────────────────────────────────────

export interface ExpenseCategoryMeta {
  label: ExpenseCategory;
  icon: string; // lucide icon name
  defaultGstRate: number; // %
  claimable: boolean;
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, ExpenseCategoryMeta> = {
  Office: { label: 'Office', icon: 'Briefcase', defaultGstRate: 18, claimable: true },
  Travel: { label: 'Travel', icon: 'Plane', defaultGstRate: 5, claimable: true },
  Salary: { label: 'Salary', icon: 'Users', defaultGstRate: 0, claimable: false },
  Marketing: { label: 'Marketing', icon: 'Megaphone', defaultGstRate: 18, claimable: true },
  Rent: { label: 'Rent', icon: 'Building2', defaultGstRate: 18, claimable: true },
  Utilities: { label: 'Utilities', icon: 'Zap', defaultGstRate: 18, claimable: true },
  Software: { label: 'Software', icon: 'Code2', defaultGstRate: 18, claimable: true },
  Miscellaneous: { label: 'Miscellaneous', icon: 'Package', defaultGstRate: 0, claimable: false },
};

// ─── GST claimability detection ───────────────────────────────────────────────

export interface GstClaimableResult {
  claimable: boolean;
  estimatedGst: number;
  rate: number;
}

/**
 * Determines if GST is claimable for an expense category and estimates the GST
 * portion based on the category's default GST rate. Salaries and miscellaneous
 * spend are not GST-claimable in India.
 */
export function detectGstClaimable(category: ExpenseCategory, amount: number): GstClaimableResult {
  const meta = EXPENSE_CATEGORIES[category];
  if (!meta || !meta.claimable || meta.defaultGstRate <= 0) {
    return { claimable: false, estimatedGst: 0, rate: 0 };
  }
  const rate = meta.defaultGstRate;
  const taxableValue = amount / (1 + rate / 100);
  const estimatedGst = round2(amount - taxableValue);
  return { claimable: true, estimatedGst, rate };
}

// ─── Auto-categorization ──────────────────────────────────────────────────────

const AUTO_CATEGORY_RULES: Array<{ category: ExpenseCategory; keywords: string[] }> = [
  { category: 'Travel', keywords: ['flight', 'hotel', 'taxi', 'uber', 'ola', 'irctc', 'train', 'airline', 'lodging', 'travel'] },
  { category: 'Office', keywords: ['office', 'stationery', 'furniture', 'printer', 'paper', 'ink', 'toner', 'consumables'] },
  { category: 'Marketing', keywords: ['adwords', 'facebook', 'instagram', 'linkedin ad', 'marketing', 'agency', 'campaign', 'seo', 'sem'] },
  { category: 'Utilities', keywords: ['electricity', 'internet', 'broadband', 'water', 'telecom', 'gas', 'utility', 'jio', 'aertel'] },
  { category: 'Salary', keywords: ['salary', 'payroll', 'wage', 'bonus', 'incentive'] },
  { category: 'Rent', keywords: ['rent', 'lease', 'coworking', 'office space', 'premises'] },
  { category: 'Software', keywords: ['saas', 'subscription', 'aws', 'azure', 'gcp', 'license', 'github', 'figma', 'notion', 'slack', 'jetbrains'] },
];

/**
 * Keyword-based heuristic auto-categorization. Searches description + vendor
 * for the first matching rule's keyword. Falls back to Miscellaneous.
 */
export function autoCategorize(description: string, vendor: string): ExpenseCategory {
  const haystack = `${description} ${vendor}`.toLowerCase();
  for (const rule of AUTO_CATEGORY_RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.category;
  }
  return 'Miscellaneous';
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ExpenseStatsResult {
  total: number;
  totalGst: number;
  byCategory: Record<ExpenseCategory, number>;
  claimableGst: number;
}

export function getExpenseStats(expenses: Expense[]): ExpenseStatsResult {
  const byCategory = {
    Office: 0,
    Travel: 0,
    Salary: 0,
    Marketing: 0,
    Rent: 0,
    Utilities: 0,
    Software: 0,
    Miscellaneous: 0,
  } as Record<ExpenseCategory, number>;
  let total = 0;
  let totalGst = 0;
  let claimableGst = 0;
  for (const e of expenses) {
    total += e.amount;
    totalGst += e.gst;
    if (e.gstClaimable) claimableGst += e.gst;
    const cat = (e.category as ExpenseCategory) in byCategory ? (e.category as ExpenseCategory) : 'Miscellaneous';
    byCategory[cat] += e.amount;
  }
  return {
    total: round2(total),
    totalGst: round2(totalGst),
    byCategory,
    claimableGst: round2(claimableGst),
  };
}

// ─── Seed data: 12 realistic Indian expenses across all 8 categories ─────────

const EXPENSE_SEED: Array<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    clientId: 'seed-client-1',
    category: 'Office',
    description: 'A4 paper, toner cartridges & printer maintenance',
    vendor: 'Jyothi Stationers',
    amount: 14750,
    gst: 2246,
    gstClaimable: true,
    date: '2025-05-08',
    paymentMode: 'upi',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Quarterly office supplies',
  },
  {
    clientId: 'seed-client-1',
    category: 'Travel',
    description: 'Mumbai→Bengaluru round-trip flight + airport taxi',
    vendor: 'MakeMyTrip',
    amount: 18400,
    gst: 876,
    gstClaimable: true,
    date: '2025-06-14',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Client onsite visit',
  },
  {
    clientId: 'seed-client-2',
    category: 'Salary',
    description: 'Junior accountant monthly salary',
    vendor: 'Internal Payroll',
    amount: 42000,
    gst: 0,
    gstClaimable: false,
    date: '2025-07-31',
    paymentMode: 'bank',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: false,
    notes: 'Payroll run for July 2025',
  },
  {
    clientId: 'seed-client-1',
    category: 'Marketing',
    description: 'Google Ads campaign — GST compliance keywords',
    vendor: 'Google India',
    amount: 65000,
    gst: 9915,
    gstClaimable: true,
    date: '2025-08-03',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Q2 performance marketing',
  },
  {
    clientId: 'seed-client-3',
    category: 'Rent',
    description: 'Office space monthly rent — Andheri East',
    vendor: 'Powai Realty LLP',
    amount: 125000,
    gst: 19068,
    gstClaimable: true,
    date: '2025-09-01',
    paymentMode: 'bank',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: false,
    notes: 'Lease agreement #PR-2024-088',
  },
  {
    clientId: 'seed-client-1',
    category: 'Utilities',
    description: 'Tata Power commercial electricity bill',
    vendor: 'Tata Power Ltd',
    amount: 38400,
    gst: 5847,
    gstClaimable: true,
    date: '2025-09-30',
    paymentMode: 'bank',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'September electricity',
  },
  {
    clientId: 'seed-client-2',
    category: 'Software',
    description: 'GitHub Enterprise + JetBrains All Products Pack',
    vendor: 'GitHub Inc',
    amount: 54000,
    gst: 8237,
    gstClaimable: true,
    date: '2025-10-12',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Annual developer tooling',
  },
  {
    clientId: 'seed-client-1',
    category: 'Software',
    description: 'AWS EC2 + S3 + CloudFront consumption',
    vendor: 'Amazon Web Services India',
    amount: 108560,
    gst: 16560,
    gstClaimable: true,
    date: '2025-11-01',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'October cloud consumption',
  },
  {
    clientId: 'seed-client-3',
    category: 'Travel',
    description: 'Hotel stay — Taj Vivanta, Bengaluru (2 nights)',
    vendor: 'IHCL Taj',
    amount: 24000,
    gst: 1143,
    gstClaimable: true,
    date: '2025-11-18',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Sales kickoff event',
  },
  {
    clientId: 'seed-client-2',
    category: 'Marketing',
    description: 'LinkedIn Sponsored Content campaign',
    vendor: 'LinkedIn India',
    amount: 45000,
    gst: 6864,
    gstClaimable: true,
    date: '2025-12-05',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Talent acquisition ads',
  },
  {
    clientId: 'seed-client-1',
    category: 'Miscellaneous',
    description: 'Team offsite catering + decor',
    vendor: 'Eventures Planners',
    amount: 32500,
    gst: 0,
    gstClaimable: false,
    date: '2025-12-20',
    paymentMode: 'bank',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: false,
    notes: 'Annual day function',
  },
  {
    clientId: 'seed-client-3',
    category: 'Office',
    description: 'Standing desk + ergonomic chairs (4 units)',
    vendor: 'Urban Ladder',
    amount: 78500,
    gst: 11959,
    gstClaimable: true,
    date: '2026-01-15',
    paymentMode: 'card',
    status: 'recorded',
    receiptUrl: null,
    ocrExtracted: true,
    notes: 'Office furniture refresh',
  },
];

export function seedExpenses(): Expense[] {
  const nowIso = new Date().toISOString();
  return EXPENSE_SEED.map((row, idx) => ({
    ...row,
    id: `seed-exp-${idx + 1}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
