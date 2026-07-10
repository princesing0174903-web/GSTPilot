// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for banking functionality. This file is CLIENT-SAFE —
// it only re-exports types, errors, the provider interface, and the client-side
// Firestore service. The server-only modules (crypto, providers, orchestrator,
// scheduler) are NOT re-exported here; they must be imported directly from
// `./server/*` by API routes only.
//
// Importing from this file:
//   import { useBanking, BankConnection, BankingSummary } from '@/lib/banking-provider';
//
// API routes import the server modules directly:
//   import { getBankProvider } from '@/lib/banking-provider/server/registry';
//   import { fullBankSync } from '@/lib/banking-provider/server/orchestrator';
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Errors — pure classes, safe for client + server
export * from './errors';

// Provider interface — pure, safe for client + server
export type { IBankProvider, BankSession } from './provider';

// Client-safe Firestore service (reads + writes + real-time subs + summary)
export {
  BANK_COLLECTIONS,
  toConnection,
  subscribeToConnections,
  subscribeToConnection,
  getConnections,
  getConnection,
  saveConnection,
  updateConnection,
  deleteConnection,
  toTransaction,
  subscribeToTransactions,
  saveTransactions,
  updateTransaction,
  deleteTransactionsForConnection,
  getTransactionsForPeriod,
  toSyncJob,
  subscribeToSyncJobs,
  createSyncJob,
  updateSyncJob,
  cascadeDisconnect,
  computeBankingSummary,
} from './service';
