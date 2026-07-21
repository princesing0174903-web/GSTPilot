// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Action Engine (barrel + auto-registration)
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
