// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — WORKING CAPITAL ENGINE
//
// Real working capital analytics:
//   • Current Assets = Cash + AR + Inventory + Prepaid
//   • Current Liabilities = AP + GST Payable + Short-term Debt
//   • Working Capital = CA - CL
//   • Working Capital Ratio = CA / CL
//   • Quick Ratio = (CA - Inventory) / CL
//   • Liquidity Risk (Low/Medium/High/Critical)
//
// All numbers derived from connected Invoice (AR), PurchaseBill (AP),
// Payment (cash), Expense (prepaid), GSTRFiling (GST payable) data.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkingCapitalAnalytics, SeverityLevel } from '../types';
import type { RawCFOData } from './data';
import { now, startOfMonth, addDays, trendFromPct, pctChange } from './data';

export function computeWorkingCapital(data: RawCFOData): WorkingCapitalAnalytics {
  const { invoices, purchaseBills, payments, expenses, filings } = data;
  const today = now();
  const mStart = startOfMonth();
  const tomorrow = addDays(today, 1);

  // ─── Current Assets ───────────────────────────────────────────────────────
  // Cash: net positive balance from customer payments - vendor payments - expenses
  const cashIn = payments
    .filter((p) => p.partyType === 'customer' && (p.status === 'completed' || p.status === 'reconciled'))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const cashOut = payments
    .filter((p) => p.partyType === 'vendor' && (p.status === 'completed' || p.status === 'reconciled'))
    .reduce((s, p) => s + (p.amount || 0), 0)
    + expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const cash = Math.max(cashIn - cashOut, 0);

  // Accounts Receivable: outstanding invoice balances (unpaid/partial/overdue)
  const accountsReceivable = invoices
    .filter((i) => i.paymentStatus !== 'paid')
    .reduce((s, i) => s + (i.balanceAmount || i.totalAmount || 0), 0);

  // Inventory: VEYRO is services-first, so inventory ≈ 0 unless purchaseBills
  // have category 'inventory' or 'stock'
  const inventoryValue = purchaseBills
    .filter((p) => {
      const cat = (p.category || '').toLowerCase();
      return cat.includes('inventory') || cat.includes('stock') || cat.includes('goods');
    })
    .reduce((s, p) => s + (p.balanceAmount || p.totalAmount || 0), 0);

  // Prepaid expenses: expenses recorded this month for future periods
  // (heuristic: expenses in current month with status 'recorded' but no paymentMode)
  const prepaidExpenses = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= mStart && d <= tomorrow && !e.paymentMode;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  const currentAssets = cash + accountsReceivable + inventoryValue + prepaidExpenses;

  // ─── Current Liabilities ──────────────────────────────────────────────────
  // Accounts Payable: outstanding vendor bills
  const accountsPayable = purchaseBills
    .filter((p) => p.paymentStatus !== 'paid')
    .reduce((s, p) => s + (p.balanceAmount || p.totalAmount || 0), 0);

  // GST Payable: output tax this month - ITC (net liability)
  const outputTaxThisMonth = invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= mStart && d <= tomorrow; })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);
  const itcAvailable = purchaseBills
    .reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);
  const gstPayable = Math.max(outputTaxThisMonth - itcAvailable, 0);

  // Short-term debt: heuristic — overdue vendor bills + overdue GST filings
  const overduePayables = purchaseBills
    .filter((p) => p.dueDate && new Date(p.dueDate) < today && p.paymentStatus !== 'paid')
    .reduce((s, p) => s + (p.balanceAmount || p.totalAmount || 0), 0);
  const overdueFilingsLiability = filings
    .filter((f) => f.status !== 'filed')
    .reduce((s, f) => s + (f.totalTax || 0), 0);
  const shortTermDebt = overduePayables + overdueFilingsLiability;

  const currentLiabilities = accountsPayable + gstPayable + shortTermDebt;

  // ─── Working Capital ──────────────────────────────────────────────────────
  const workingCapital = currentAssets - currentLiabilities;
  // When CL = 0 and CA > 0, the ratio is technically infinite (very healthy).
  // Use a large sentinel (999) so it doesn't trigger risk thresholds designed
  // for low ratios.
  const workingCapitalRatio = currentLiabilities > 0
    ? currentAssets / currentLiabilities
    : (currentAssets > 0 ? 999 : 0);
  const quickRatio = currentLiabilities > 0
    ? (currentAssets - inventoryValue) / currentLiabilities
    : (currentAssets > 0 ? 999 : 0);

  // ─── Liquidity Risk ───────────────────────────────────────────────────────
  let liquidityRisk: SeverityLevel = 'low';
  let liquidityRiskReason = 'Healthy liquidity position — current assets comfortably cover current liabilities.';
  if (currentLiabilities === 0 && currentAssets === 0) {
    liquidityRisk = 'low';
    liquidityRiskReason = 'No current liabilities recorded — working capital neutral.';
  } else if (currentLiabilities === 0 && currentAssets > 0) {
    liquidityRisk = 'low';
    liquidityRiskReason = `No current liabilities — current assets of ₹${Math.round(currentAssets).toLocaleString('en-IN')} are unencumbered. Very healthy liquidity.`;
  } else if (workingCapitalRatio < 0.5) {
    liquidityRisk = 'critical';
    liquidityRiskReason = `Working capital ratio is ${workingCapitalRatio.toFixed(2)} — significantly below 1.0. The business cannot meet short-term obligations.`;
  } else if (workingCapitalRatio < 0.8) {
    liquidityRisk = 'high';
    liquidityRiskReason = `Working capital ratio is ${workingCapitalRatio.toFixed(2)} — below 1.0. Immediate action needed to improve liquidity.`;
  } else if (workingCapitalRatio < 1.2) {
    liquidityRisk = 'medium';
    liquidityRiskReason = `Working capital ratio is ${workingCapitalRatio.toFixed(2)} — close to 1.0. Tight liquidity, monitor receivables closely.`;
  } else if (workingCapitalRatio > 3 && currentAssets > 0) {
    liquidityRisk = 'low';
    liquidityRiskReason = `Working capital ratio is ${workingCapitalRatio === 999 ? '∞ (no current liabilities)' : workingCapitalRatio.toFixed(2)} — very strong. Consider deploying excess cash for growth.`;
  }

  // ─── Trend (this month vs last month working capital proxy) ────────────────
  const lastMonthReceivables = accountsReceivable; // simplified
  const lastMonthPayables = accountsPayable;
  const trend = trendFromPct(pctChange(currentAssets, currentLiabilities + lastMonthReceivables - lastMonthPayables));

  return {
    currentAssets: Math.round(currentAssets),
    currentLiabilities: Math.round(currentLiabilities),
    workingCapital: Math.round(workingCapital),
    // Display 999 (sentinel for "no CL") as 999.0 — UI knows to render ∞
    workingCapitalRatio: workingCapitalRatio === 999 ? 999 : Math.round(workingCapitalRatio * 100) / 100,
    quickRatio: quickRatio === 999 ? 999 : Math.round(quickRatio * 100) / 100,
    liquidityRisk,
    liquidityRiskReason,
    accountsReceivable: Math.round(accountsReceivable),
    accountsPayable: Math.round(accountsPayable),
    inventoryValue: Math.round(inventoryValue),
    prepaidExpenses: Math.round(prepaidExpenses),
    shortTermDebt: Math.round(shortTermDebt),
    trend,
  };
}
