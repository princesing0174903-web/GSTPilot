// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for GSTN functionality. This file is CLIENT-SAFE —
// it only re-exports types, errors, the provider interface, and the client-side
// Firestore service. The server-only modules (crypto, providers, orchestrator,
// scheduler) are NOT re-exported here; they must be imported directly from
// `./server/*` by API routes only.
//
// Importing from this file:
//   import { useGSTConnection, GSTConnection, GSTAuthStatus } from '@/lib/gstn-provider';
//
// API routes import the server modules directly:
//   import { getGSTProvider } from '@/lib/gstn-provider/server/registry';
//   import { fullSync } from '@/lib/gstn-provider/server/orchestrator';
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Errors — pure classes, safe for client + server
export * from './errors';

// Provider interface — pure, safe for client + server
export type { IGSTProvider, GSTSession } from './provider';

// Client-safe Firestore service (reads + writes + real-time subs)
export {
  GST_COLLECTIONS,
  toConnection,
  subscribeToConnection,
  getConnection,
  saveConnection,
  updateConnection,
  deleteConnection,
  toProfile,
  subscribeToProfile,
  saveProfile,
  getProfile,
  toReturn,
  subscribeToReturns,
  saveReturns,
  deleteReturnsForConnection,
  getReturns,
  toNotice,
  subscribeToNotices,
  saveNotices,
  deleteNoticesForConnection,
  getNotices,
  toLedger,
  subscribeToLedger,
  saveLedgers,
  deleteLedgersForConnection,
  getLedger,
  toSyncJob,
  subscribeToSyncJobs,
  createSyncJob,
  updateSyncJob,
  getSyncJobs,
  cascadeDisconnect,
} from './service';
