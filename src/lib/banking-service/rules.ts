// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Service — Categorization Rules Engine (Pure Helpers)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure functions used by the MockBankingProvider (and any future provider) to:
//   1. Match a transaction's description against an active CategorizationRule.
//   2. Extract a counterparty name from a typical Indian banking description
//      (UPI/NAME/Note, NEFT/BANK/NAME, POS/PURCHASE/MERCHANT, CHQ/DEPOSIT/NAME,
//      BILLPAY/CATEGORY/ISSUER, etc.).
//   3. Look up display metadata (label + tone + Tailwind color) for a category.
//
// Keeping these as pure functions makes them trivially unit-testable and lets
// the provider swap categorization strategies without touching its surface area.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CategorizationRule, TransactionCategory } from './types';

// ─── Match ────────────────────────────────────────────────────────────────────

/**
 * Returns true if `rule.pattern` matches `description`.
 *
 * - Regex rules: case-insensitive RegExp test. We catch invalid patterns so a
 *   misconfigured rule never crashes the engine (treated as non-match + warn).
 * - Substring rules: case-insensitive `includes`.
 *
 * Both branches are case-insensitive because bank statement descriptions are
 * inconsistently cased ("UPI/Steel Corp/Payment" vs "upi/steel corp/payment").
 */
export function matchRule(rule: CategorizationRule, description: string): boolean {
  if (!rule.active) return false;
  const haystack = String(description ?? '').toLowerCase();
  if (!haystack) return false;
  const needle = String(rule.pattern ?? '');

  if (rule.isRegex) {
    try {
      return new RegExp(needle, 'i').test(haystack);
    } catch {
      // Invalid regex — fail safe (no match) rather than throw.
      return false;
    }
  }

  // Substring match.
  return haystack.includes(needle.toLowerCase());
}

/**
 * Find the highest-priority active rule whose pattern matches `description`.
 * Rules are sorted by priority (desc) — the first match wins.
 *
 * Returns the matched category + optional counterparty override + ruleId, or
 * `null` when nothing matches.
 */
export function evaluateRules(
  rules: CategorizationRule[],
  description: string,
): { category: TransactionCategory; counterparty?: string; ruleId: string } | null {
  if (!rules?.length || !description) return null;

  // Sort by priority desc — ties broken by createdAt asc (older = higher
  // precedence, mimics "first-defined wins").
  const sorted = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

  for (const rule of sorted) {
    if (matchRule(rule, description)) {
      return {
        category: rule.category,
        counterparty: rule.counterparty,
        ruleId: rule.id,
      };
    }
  }
  return null;
}

// ─── Counterparty extraction ──────────────────────────────────────────────────

/**
 * Extracts a counterparty name from a typical Indian banking description.
 *
 * Recognized patterns (case-insensitive):
 *   "UPI/STEEL CORP/Payment"        → "STEEL CORP"
 *   "UPI/RAJESH K/Consulting"       → "RAJESH K"
 *   "NEFT/HDFC/Salary Oct"          → "Salary Oct"   (NEFT drops the bank segment)
 *   "POS/PURCHASE/BIGBASKET"        → "BIGBASKET"
 *   "CHQ/DEPOSIT/ACME PVT"          → "ACME PVT"
 *   "BILLPAY/ELECTRICITY/TANGEDCO"  → "TANGEDCO"
 *   "GST/PAYMENT/2024-10"           → "GST"          (no merchant — return issuer)
 *   "IMPS/9876543210/RAJESH K"      → "RAJESH K"
 *   "ATM/WDL/HDFC/INDIRA NAGAR"     → "HDFC INDIRA NAGAR"
 *
 * Returns `undefined` when no recognizable pattern is present.
 */
export function extractCounterparty(description: string): string | undefined {
  if (!description) return undefined;
  const parts = String(description).split('/').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;

  const tag = parts[0].toUpperCase();
  const remainder = parts.slice(1);

  switch (tag) {
    case 'UPI': {
      // UPI/<name>/<note> — name is segment 1.
      return remainder[0] || undefined;
    }
    case 'NEFT':
    case 'RTGS': {
      // NEFT/<bank>/<note> — drop the bank segment, the note describes the party.
      return remainder.slice(1).join(' ') || remainder[0] || undefined;
    }
    case 'IMPS': {
      // IMPS/<number>/<name> — name is segment 2.
      return remainder[1] || remainder[0] || undefined;
    }
    case 'POS':
    case 'CHQ':
    case 'BILLPAY':
    case 'CARD':
    case 'DBT': {
      // POS/PURCHASE/MERCHANT | CHQ/DEPOSIT/NAME | BILLPAY/CATEGORY/ISSUER
      // Skip a known "purpose" sub-tag (PURCHASE/DEPOSIT/WDL/DEPOSIT), then
      // join the remaining segments as the counterparty.
      const PURPOSE_TAGS = new Set([
        'PURCHASE',
        'DEPOSIT',
        'WDL',
        'WITHDRAWAL',
        'REFUND',
        'PAYMENT',
        'ELECTRICITY',
        'WATER',
        'GAS',
        'BROADBAND',
        'INSURANCE',
        'LOAN',
        'TAX',
        'GST',
      ]);
      const filtered = remainder.filter((p, idx) => {
        // Drop only the FIRST purpose-tag occurrence (so a name like "GAS CORP"
        // isn't accidentally stripped after the first non-tag token).
        if (idx === 0 && PURPOSE_TAGS.has(p.toUpperCase())) return false;
        return true;
      });
      const joined = filtered.join(' ').trim();
      return joined || remainder[remainder.length - 1] || undefined;
    }
    case 'ATM': {
      // ATM/WDL/<bank>/<location>
      return remainder.slice(1).join(' ') || remainder[0] || undefined;
    }
    case 'GST':
    case 'TDS': {
      // No merchant — return the tag itself.
      return tag;
    }
    default: {
      // Unknown structure — return the most "name-like" segment (last non-numeric).
      for (let i = remainder.length - 1; i >= 0; i--) {
        const seg = remainder[i];
        if (!/^\d+$/.test(seg)) return seg;
      }
      return remainder[0] || undefined;
    }
  }
}

// ─── Category metadata (UI badges / chart colors) ─────────────────────────────

export interface CategoryMeta {
  label: string;
  tone: 'positive' | 'negative' | 'neutral';
  color: string; // Tailwind hex
}

/**
 * Display metadata for every TransactionCategory. Used by the UI for:
 *   - badge labels and tones (green=positive, amber=negative, gray=neutral)
 *   - chart slice colors (donut, bar, area)
 *
 * The colors below are Tailwind's hex equivalents so they render identically
 * to the rest of the design system.
 */
export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  sales: { label: 'Sales', tone: 'positive', color: '#10b981' },
  payment_received: { label: 'Payment Received', tone: 'positive', color: '#10b981' },
  vendor_payment: { label: 'Vendor Payment', tone: 'negative', color: '#f59e0b' },
  salary: { label: 'Salary', tone: 'negative', color: '#f59e0b' },
  rent: { label: 'Rent', tone: 'negative', color: '#f59e0b' },
  utilities: { label: 'Utilities', tone: 'negative', color: '#f59e0b' },
  tax: { label: 'Tax', tone: 'neutral', color: '#8b5cf6' },
  fees: { label: 'Bank Fees', tone: 'neutral', color: '#6b7280' },
  refund: { label: 'Refund', tone: 'positive', color: '#06b6d4' },
  transfer: { label: 'Transfer', tone: 'neutral', color: '#6b7280' },
  interest: { label: 'Interest', tone: 'positive', color: '#10b981' },
  misc: { label: 'Miscellaneous', tone: 'neutral', color: '#6b7280' },
};

/** All categories in stable display order (drives chart legend ordering). */
export const CATEGORY_ORDER: TransactionCategory[] = [
  'sales',
  'payment_received',
  'vendor_payment',
  'salary',
  'rent',
  'utilities',
  'tax',
  'fees',
  'refund',
  'transfer',
  'interest',
  'misc',
];
