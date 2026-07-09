/**
 * GSTPilot Cloud Functions — single entry point.
 *
 * Every trigger is exported here so `firebase deploy --only functions` picks
 * them all up. The `package.json` `main` field points to `lib/index.js`,
 * which is the compiled output of this file.
 *
 * Trigger types:
 *   onCall      — callable from the client via Firebase Functions SDK
 *   onRequest   — HTTPS webhook (Razorpay/Stripe)
 *   onSchedule  — cron-based scheduled job (Asia/Kolkata timezone)
 */

// ─── Auth lifecycle ──────────────────────────────────────────────────────
export { onUserCreate } from './triggers/auth-on-create';
export { onUserDelete } from './triggers/auth-on-delete';

// ─── Billing ─────────────────────────────────────────────────────────────
export { billingWebhook } from './triggers/billing-webhook';
export { billingRenewals } from './triggers/billing-renewals';
export { billingGraceExpiry } from './triggers/billing-grace-expiry';

// ─── Maintenance ─────────────────────────────────────────────────────────
export { cleanupOrphanStorage } from './triggers/cleanup-orphan-storage';

// ─── Secure onCall operations ────────────────────────────────────────────
export { orgRoleChange } from './triggers/org-role-change';
export { aiContextGather } from './triggers/ai-context-gather';
export { auditLogWrite } from './triggers/audit-log-write';
export { dataExport } from './triggers/data-export';
export { usageMeter } from './triggers/usage-meter';
export { emailSend } from './triggers/email-send';
