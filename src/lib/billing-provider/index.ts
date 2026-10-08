// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Barrel Export (CLIENT-SAFE)
//
// The single import surface for billing functionality. This file is CLIENT-SAFE —
// it only re-exports types, errors, the provider interface, and the client-side
// Firestore service. The server-only modules (crypto, providers, orchestrator,
// scheduler) are NOT re-exported here; they must be imported directly from
// `./server/*` by API routes only.
//
// Importing from this file:
//   import { useBilling, Subscription, BillingSummary } from '@/lib/billing-provider';
//
// API routes import the server modules directly:
//   import { getPaymentProvider } from '@/lib/billing-provider/server/registry';
//   import { createSubscription } from '@/lib/billing-provider/server/orchestrator';
// ═══════════════════════════════════════════════════════════════════════════════

// Types — pure, safe for client + server
export * from './types';

// Errors — pure classes, safe for client + server
export * from './errors';

// Provider interface — pure, safe for client + server
export type { IPaymentProvider, ProviderCustomerSession } from './provider';

// Client-safe Firestore service (reads + writes + real-time subs + summary)
export {
  BILLING_COLLECTIONS,
  getSubscriptionPlans,
  getSubscriptionPlan,
  toSubscription,
  subscribeToSubscription,
  getSubscription,
  toBillingAccount,
  subscribeToBillingAccount,
  toInvoice,
  subscribeToInvoices,
  getInvoices,
  toPayment,
  subscribeToPayments,
  toPaymentAttempt,
  subscribeToPaymentAttempts,
  toReceipt,
  subscribeToReceipts,
  toCoupon,
  subscribeToCoupons,
  toUsageRecord,
  subscribeToUsageRecords,
  getUsageForPeriod,
  recordUsage,
  computeBillingSummary,
  markSubscriptionCancelled,
} from './service';
