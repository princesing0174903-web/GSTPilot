// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Public API Surface (TASK 12)
//
// Re-exports everything the API routes and UI hooks need. Keeps import paths
// stable: `import { ... } from '@/lib/banking-prisma'`.
//
// Architecture:
//   API Routes → service / reconciliation / cashflow / oracle / import / reports
//                ↓
//                Prisma (SQLite)  ←  local database
//                ↓
//                IBankProvider (MockBankProvider now, SetuProvider later)
//
// Provider swap: change `BANK_PROVIDER` env var → registry returns the new
// provider → service.syncAccount() calls provider.fetchTransactions() → same
// DB schema, same API contracts, same UI. Zero changes elsewhere.
// ═══════════════════════════════════════════════════════════════════════════════

export * from './types';
export * from './service';
export { runReconciliation, getReconciliationSummary, listReconciliations, approveReconciliation, rejectReconciliation, manualMatch } from './reconciliation';
export { getCashFlow, getCashFlowSnapshot, recordCashFlowSnapshot } from './cashflow';
export { generateReport, listAvailableReports } from './reports';
export { getBankingOracleInsights } from './oracle';
export { parseCsv, parseExcel, previewImport, importStatement, listImports, getImportDetails } from './import';
export { seedBankingData, ensureSeeded } from './seed';
