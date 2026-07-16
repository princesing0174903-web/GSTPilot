// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Financial Engine (Barrel Export)
//
// This is the ONLY module any page or component should import for financial
// calculations. Import from '@/lib/financial-engine' — never from individual
// files.
//
// Usage:
//   import { getBusinessSnapshot, calculateRevenue } from '@/lib/financial-engine';
// ═══════════════════════════════════════════════════════════════════════════════

export { getBusinessSnapshot, invalidateSnapshotCache } from './businessSnapshot';
export { calculateRevenue, calculateRevenueForPeriod, calculateRevenueTrend } from './calculateRevenue';
export { calculateExpenses, calculateExpensesForPeriod } from './calculateExpenses';
export { calculateProfit } from './calculateProfit';
export { calculateCash } from './calculateCash';
export { calculateGST } from './calculateGST';
export {
  calculateCollections,
  calculateReceivablesPayables,
} from './calculateCollections';
export { calculateHealth } from './calculateHealth';
export { calculateRisk } from './calculateRisk';
export { calculateRunway, calculateForecast } from './calculateRunway';

export type {
  BusinessSnapshot,
  FinancialData,
  InvoiceRow,
  PurchaseBillRow,
  ExpenseRow,
  PaymentRow,
  BankAccountRow,
  ClientRow,
  NoticeRow,
  GSTRFilingRow,
} from './types';
export { emptySnapshot } from './types';
