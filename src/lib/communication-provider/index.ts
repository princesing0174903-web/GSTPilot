// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Gmail & WhatsApp Business Automation™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for communication functionality. This file is
// CLIENT-SAFE — it only re-exports types, errors, the provider interfaces, the
// pure analysis engine, and the client-side Firestore service. The server-only
// modules (crypto, providers, registry, orchestrator, automation) are NOT
// re-exported here; they must be imported directly from `./server/*` by API
// routes only.
//
// Importing from this file (client components + hooks):
//   import { useCommunications, GmailMessage, WhatsAppMessage } from '@/lib/communication-provider';
//
// API routes import the server modules directly:
//   import { getGmailProvider } from '@/lib/communication-provider/server/registry';
//   import { connectGmail, syncEmails, sendEmail } from '@/lib/communication-provider/server/orchestrator';
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Errors — pure classes, safe for client + server
export * from './errors';

// Provider interfaces — pure, safe for client + server
export type {
  IGmailProvider,
  GmailSession,
  IWhatsAppProvider,
  WhatsAppSession,
} from './provider';

// Pure analysis engine — safe for client + server
export {
  classifyEmail,
  classifyWhatsAppMessage,
  detectEmailSentiment,
  detectWhatsAppSentiment,
  summarizeEmail,
  summarizeWhatsAppMessage,
  hasPendingReply,
  isPendingClientReply,
  type CommunicationSentiment,
} from './communication-analysis';

// Client-safe Firestore service (reads + writes + real-time subs + summary)
export {
  COMMUNICATION_COLLECTIONS,
  // Gmail connections
  toGmailConnection,
  subscribeToGmailConnections,
  getGmailConnections,
  saveGmailConnection,
  updateGmailConnection,
  deleteGmailConnection,
  // WhatsApp connections
  toWhatsAppConnection,
  subscribeToWhatsAppConnections,
  getWhatsAppConnections,
  saveWhatsAppConnection,
  updateWhatsAppConnection,
  deleteWhatsAppConnection,
  // Gmail messages
  toGmailMessage,
  subscribeToGmailMessages,
  getGmailMessages,
  saveGmailMessages,
  updateGmailMessage,
  deleteGmailMessagesForConnection,
  // WhatsApp messages
  toWhatsAppMessage,
  subscribeToWhatsAppMessages,
  getWhatsAppMessages,
  saveWhatsAppMessages,
  updateWhatsAppMessage,
  deleteWhatsAppMessagesForConnection,
  // Scheduled messages
  toScheduledMessage,
  subscribeToScheduledMessages,
  createScheduledMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
  getDueScheduledMessages,
  // Sync jobs
  toSyncJob,
  createSyncJob,
  updateSyncJob,
  // Cascade disconnect
  cascadeDisconnectGmail,
  cascadeDisconnectWhatsApp,
  // Summary + helpers
  computeCommunicationSummary,
  isoFromNow,
  nextRunForRecurrence,
} from './service';
