// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — Expense Cloud™ (Prisma-free utils)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure utility functions extracted out of `./expenses` so client components
// (InvoiceCloudPage) can render UI without dragging Prisma into their bundle.
// The Prisma-backed queries (getExpenses) live in `./expenses` (server-only)
// and re-export the pure functions from here.
//
// ZERO imports from `@/lib/db` or `@prisma/client`. Pure TypeScript only.
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

// ─── Seed data ───────────────────────────────────────────────────────────────
// Mock/demo expense seed data has been REMOVED. Firestore is the only source
// of truth for expenses: organizations/GSTpilot_SAAS/expenses (see
// @/lib/gstpilot-data). This function is retained for backward-compatible
// imports but returns an empty array — no fabricated records.

export function seedExpenses(): Expense[] {
  return [];
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
