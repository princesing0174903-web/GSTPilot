// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Action Engine (barrel + auto-registration)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Importing from this barrel automatically registers all built-in actions.
// To add a new action: create a file in ./definitions/, call registerAction()
// inside it, and add an import below. Nothing else in the codebase changes —
// the brain route, confirm route, and OracleBrainCore all read from the
// registry dynamically.
// ═══════════════════════════════════════════════════════════════════════════════

// Importing these files registers their actions via registerAction() side-effect.
import './definitions/create-invoice';
import './definitions/create-customer';
import './definitions/record-payment';
import './definitions/record-expense';
import './definitions/send-reminder';
// Phase 1 — Action Engine expansion: migrated createTask + generateGSTReturn
// from legacy inline tools, and added the new generateReport action.
import './definitions/create-task';
import './definitions/generate-gst-return';
import './definitions/generate-report';
// Priority 1.5 — Complete SaaS Integration: full CRUD for every module.
// Oracle can now do everything the UI can — update/delete/duplicate/send for
// invoices + customers + expenses + payments, plus GST (GSTR-3B), banking,
// reports, CRM leads + follow-ups, team invites, profile, and Zoho/Google sync.
// Every action calls the same shared service layer (src/lib/services/) or the
// same lib functions as the REST API routes — zero business-logic duplication.
import './definitions/update-customer';
import './definitions/delete-customer';
import './definitions/update-invoice';
import './definitions/delete-invoice';
import './definitions/duplicate-invoice';
import './definitions/send-invoice';
import './definitions/update-expense';
import './definitions/delete-expense';
import './definitions/mark-invoice-paid';
import './definitions/refund-payment';
import './definitions/prepare-gstr3b';
import './definitions/add-crm-lead';
import './definitions/schedule-follow-up';
import './definitions/invite-team-member';
import './definitions/update-profile';
import './definitions/connect-bank-account';
import './definitions/export-report';
import './definitions/sync-zoho';
import './definitions/sync-google';
// Priority 3 — Banking Intelligence: import statements, reconcile, categorize,
// forecast, reports, exports, manual reconciliation. Every action calls the
// Banking Service (src/lib/banking-service) — provider-agnostic. When Setu is
// wired up later, the same actions work against live data with zero changes.
import './definitions/import-statement';
import './definitions/reconcile-transactions';
import './definitions/categorize-transactions';
import './definitions/forecast-cash-flow';
import './definitions/generate-cash-report';
import './definitions/export-statement';
import './definitions/mark-reconciled';

// Public API
export {
  registerAction,
  getAction,
  listActions,
  detectIntent,
  isRegisteredAction,
  inr,
  findOrCreateClient,
  logActivity,
  type OracleAction,
  type ParamField,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
  type RefreshedContext,
  type ActionContext,
} from './registry';

export {
  buildConfirmation,
  executeAndRefresh,
  cancelAction,
  defaultRefreshContext,
  type ActionConfirmation,
  type ActionSuccessResponse,
  type ActionCancelResponse,
} from './engine';
