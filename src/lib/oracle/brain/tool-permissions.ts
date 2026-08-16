// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Tool Permission System (3-tier, server-enforced)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every Oracle tool is classified into one of three permission tiers. The
// permission check happens SERVER-SIDE in the brain route + confirm route —
// the LLM can never bypass it.
//
// TIERS:
//   1. READ_ONLY       — safe to execute without confirmation. Querying data,
//                        fetching snapshots, listing records.
//   2. CONFIRMATION    — mutates data but is reversible / low-impact. Creating
//                        invoices, customers, expenses, payments, tasks. Requires
//                        a user click on an action preview card.
//   3. STRONG_CONFIRM  — destructive, externally visible, or financially
//                        sensitive. Sending emails, submitting GST returns,
//                        deleting records, cancelling invoices, refunding
//                        payments. Requires an explicit second confirmation
//                        with a typed confirm or a deliberate "Approve" click
//                        on a high-contrast preview.
//
// The LLM is told which tier each tool is in via the system prompt, but the
// server ENFORCES the tier regardless of what the LLM emits. A tool call
// without the required confirmation is rejected with a 403.
//
// ROLE GATING (future-ready): The permission resolver also accepts a user role.
// Today all authenticated org members can use all tools they have confirmation
// for, but the structure allows per-role tool allowlists to be added without
// changing call sites.
// ═══════════════════════════════════════════════════════════════════════════════

export type PermissionTier = 'read-only' | 'confirmation' | 'strong-confirm';

export interface ToolPermission {
  tool: string;
  tier: PermissionTier;
  /** Why this tier — shown in audit logs. */
  reason: string;
  /** Optional role gate — if present, only these roles can use the tool. */
  requiredRoles?: Array<'owner' | 'admin' | 'manager' | 'accountant' | 'employee' | 'viewer'>;
}

// ─── Tool Classification ──────────────────────────────────────────────────────
//
// This is the authoritative classification. Adding a new tool = add a row here.
// Tools not listed default to STRONG_CONFIRM (fail-safe — better to over-protect).
//
const TOOL_PERMISSIONS: Record<string, ToolPermission> = {
  // ── READ-ONLY (safe, no confirmation) ──
  getBusinessSnapshot:    { tool: 'getBusinessSnapshot',    tier: 'read-only',    reason: 'Reads aggregated business metrics.' },
  queryInvoices:          { tool: 'queryInvoices',          tier: 'read-only',    reason: 'Reads invoice records.' },
  queryCustomers:         { tool: 'queryCustomers',         tier: 'read-only',    reason: 'Reads customer records.' },
  queryExpenses:          { tool: 'queryExpenses',          tier: 'read-only',    reason: 'Reads expense records.' },
  queryPayments:          { tool: 'queryPayments',          tier: 'read-only',    reason: 'Reads payment records.' },
  getGSTStatus:           { tool: 'getGSTStatus',           tier: 'read-only',    reason: 'Reads GST filing + liability status.' },
  getBankAccounts:        { tool: 'getBankAccounts',        tier: 'read-only',    reason: 'Reads bank account balances.' },
  getOverdueCustomers:    { tool: 'getOverdueCustomers',    tier: 'read-only',    reason: 'Reads overdue customer list.' },
  getCashflowAnalysis:    { tool: 'getCashflowAnalysis',    tier: 'read-only',    reason: 'Reads cash flow summary.' },
  getTopCustomer:         { tool: 'getTopCustomer',         tier: 'read-only',    reason: 'Reads top customer by revenue.' },
  getNewestInvoice:       { tool: 'getNewestInvoice',       tier: 'read-only',    reason: 'Reads newest invoice.' },
  getInvoiceMetrics:      { tool: 'getInvoiceMetrics',      tier: 'read-only',    reason: 'Reads invoice aggregate metrics.' },
  getRecentActivity:      { tool: 'getRecentActivity',      tier: 'read-only',    reason: 'Reads recent activity log.' },
  getConnectedIntegrations: { tool: 'getConnectedIntegrations', tier: 'read-only', reason: 'Reads integration connection status.' },
  getIntegrationStatus:   { tool: 'getIntegrationStatus',  tier: 'read-only',    reason: 'Reads a single integration status.' },
  getPendingFilings:      { tool: 'getPendingFilings',      tier: 'read-only',    reason: 'Reads pending GST filings.' },
  getBankingIntelligence: { tool: 'getBankingIntelligence', tier: 'read-only',    reason: 'Reads banking intelligence summary.' },
  navigate:               { tool: 'navigate',               tier: 'read-only',    reason: 'Client-side navigation only.' },
  recallMemory:           { tool: 'recallMemory',           tier: 'read-only',    reason: 'Reads workspace memory.' },
  forecastCashFlow:       { tool: 'forecastCashFlow',       tier: 'read-only',    reason: 'Reads historical data to forecast.' },

  // ── CONFIRMATION (mutates data, reversible / low-impact) ──
  createInvoice:          { tool: 'createInvoice',          tier: 'confirmation', reason: 'Creates a new invoice (draft or sent).' },
  createCustomer:         { tool: 'createCustomer',         tier: 'confirmation', reason: 'Creates a new customer record.' },
  createExpense:          { tool: 'createExpense',          tier: 'confirmation', reason: 'Records a new expense.' },
  createPayment:          { tool: 'createPayment',          tier: 'confirmation', reason: 'Records a payment (not a bank transfer).' },
  createTask:             { tool: 'createTask',             tier: 'confirmation', reason: 'Creates an internal task.' },
  scheduleFollowUp:       { tool: 'scheduleFollowUp',       tier: 'confirmation', reason: 'Schedules a follow-up reminder.' },
  updateInvoice:          { tool: 'updateInvoice',          tier: 'confirmation', reason: 'Modifies an invoice (non-financial fields).' },
  updateCustomer:         { tool: 'updateCustomer',         tier: 'confirmation', reason: 'Modifies a customer record.' },
  updateExpense:          { tool: 'updateExpense',          tier: 'confirmation', reason: 'Modifies an expense record.' },
  markInvoicePaid:        { tool: 'markInvoicePaid',        tier: 'confirmation', reason: 'Marks an invoice as paid (status change).' },
  generateReport:         { tool: 'generateReport',         tier: 'confirmation', reason: 'Generates a report (read-only compute).' },
  prepareGstr3b:          { tool: 'prepareGstr3b',          tier: 'confirmation', reason: 'Prepares a GSTR-3B working paper (draft, not filed).' },
  generateGSTReturn:      { tool: 'generateGSTReturn',      tier: 'confirmation', reason: 'Generates a GST return working paper (draft).' },
  saveMemory:             { tool: 'saveMemory',             tier: 'confirmation', reason: 'Writes a workspace memory fact.' },
  addCrmLead:             { tool: 'addCrmLead',             tier: 'confirmation', reason: 'Creates a CRM lead.' },
  duplicateInvoice:       { tool: 'duplicateInvoice',       tier: 'confirmation', reason: 'Creates a copy of an invoice.' },
  inviteTeamMember:       { tool: 'inviteTeamMember',       tier: 'confirmation', reason: 'Sends a workspace invite (reversible).' },
  updateProfile:          { tool: 'updateProfile',          tier: 'confirmation', reason: 'Updates workspace profile.' },
  exportReport:           { tool: 'exportReport',           tier: 'confirmation', reason: 'Exports a report to file.' },
  generateCashReport:     { tool: 'generateCashReport',     tier: 'confirmation', reason: 'Generates a cash report.' },
  importStatement:        { tool: 'importStatement',        tier: 'confirmation', reason: 'Imports a bank statement (reviewable).' },
  reconcileTransactions:  { tool: 'reconcileTransactions',  tier: 'confirmation', reason: 'Reconciles bank transactions (reviewable).' },
  categorizeTransactions: { tool: 'categorizeTransactions', tier: 'confirmation', reason: 'Categorizes transactions (reviewable).' },
  markReconciled:         { tool: 'markReconciled',         tier: 'confirmation', reason: 'Marks a transaction as reconciled.' },
  syncZoho:               { tool: 'syncZoho',               tier: 'confirmation', reason: 'Triggers a Zoho Books sync (read-only on Zoho).' },
  syncGoogle:             { tool: 'syncGoogle',             tier: 'confirmation', reason: 'Triggers a Google Workspace sync.' },
  connectBankAccount:     { tool: 'connectBankAccount',     tier: 'confirmation', reason: 'Initiates a bank connection (consent flow).' },
  runWorkflow:            { tool: 'runWorkflow',            tier: 'confirmation', reason: 'Runs a workflow (multi-step, reviewable).' },
  sendReminder:           { tool: 'sendReminder',           tier: 'confirmation', reason: 'Sends a payment reminder (drafted, user-approved).' },

  // ── STRONG-CONFIRM (destructive / externally visible / financial) ──
  sendInvoice:            { tool: 'sendInvoice',            tier: 'strong-confirm', reason: 'Sends an invoice to a customer (externally visible).' },
  deleteInvoice:          { tool: 'deleteInvoice',          tier: 'strong-confirm', reason: 'Permanently deletes an invoice.' },
  deleteCustomer:         { tool: 'deleteCustomer',         tier: 'strong-confirm', reason: 'Permanently deletes a customer (cascades).' },
  deleteExpense:          { tool: 'deleteExpense',          tier: 'strong-confirm', reason: 'Permanently deletes an expense.' },
  refundPayment:          { tool: 'refundPayment',          tier: 'strong-confirm', reason: 'Issues a refund (financial transaction).' },
  exportStatement:        { tool: 'exportStatement',        tier: 'strong-confirm', reason: 'Exports a bank statement (sensitive financial data).' },
};

// ─── Resolver ─────────────────────────────────────────────────────────────────

export interface PermissionContext {
  uid: string;
  orgId: string;
  role: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  tier: PermissionTier;
  reason: string;
  /** Why the call was denied, if it was. */
  denialReason?: string;
}

/**
 * Check whether a user may call a tool, and if so, what confirmation tier it requires.
 * SERVER-SIDE ONLY. This is the authoritative gate — the LLM cannot override it.
 */
export function checkToolPermission(
  toolName: string,
  ctx: PermissionContext,
): PermissionCheckResult {
  const perm = TOOL_PERMISSIONS[toolName];

  // Fail-safe: unknown tools default to STRONG_CONFIRM.
  if (!perm) {
    return {
      allowed: false,
      tier: 'strong-confirm',
      reason: 'Unknown tool — not in permission registry.',
      denialReason: `Tool "${toolName}" is not registered. For safety, unknown tools are blocked.`,
    };
  }

  // Role gate (if the tool specifies one)
  if (perm.requiredRoles && perm.requiredRoles.length > 0) {
    const roleRank: Record<string, number> = {
      owner: 6, admin: 5, manager: 4, accountant: 3, employee: 2, viewer: 0,
    };
    const userRank = roleRank[ctx.role] ?? 0;
    const minRank = Math.min(...perm.requiredRoles.map(r => roleRank[r] ?? 0));
    if (userRank < minRank) {
      return {
        allowed: false,
        tier: perm.tier,
        reason: perm.reason,
        denialReason: `Your role (${ctx.role}) does not have permission to use "${toolName}". Required: ${perm.requiredRoles.join(' or ')}.`,
      };
    }
  }

  return { allowed: true, tier: perm.tier, reason: perm.reason };
}

/**
 * Verify that a confirmation was provided for a confirmation/strong-confirm tool.
 * Called by the brain route BEFORE executing the tool.
 */
export function verifyConfirmation(
  toolName: string,
  confirmation: { confirmed: boolean; strongConfirm?: boolean } | undefined,
): { ok: true; tier: PermissionTier } | { ok: false; reason: string } {
  const perm = TOOL_PERMISSIONS[toolName];
  if (!perm) {
    return { ok: false, reason: `Tool "${toolName}" is not registered.` };
  }

  if (perm.tier === 'read-only') {
    return { ok: true, tier: perm.tier };
  }

  if (!confirmation?.confirmed) {
    return { ok: false, reason: `Tool "${toolName}" requires confirmation before execution.` };
  }

  if (perm.tier === 'strong-confirm' && !confirmation?.strongConfirm) {
    return { ok: false, reason: `Tool "${toolName}" requires strong confirmation (explicit second approval) before execution.` };
  }

  return { ok: true, tier: perm.tier };
}

/** Get the permission tier for a tool (for UI display). */
export function getToolTier(toolName: string): PermissionTier {
  return TOOL_PERMISSIONS[toolName]?.tier ?? 'strong-confirm';
}

/** List all tools at a given tier (for the system prompt). */
export function toolsAtTier(tier: PermissionTier): string[] {
  return Object.values(TOOL_PERMISSIONS).filter(p => p.tier === tier).map(p => p.tool);
}

/** Build the permission block for the system prompt. */
export function buildPermissionPromptBlock(): string {
  return `## Tool Permissions (server-enforced — you cannot bypass these)

### READ-ONLY tools (execute freely, no confirmation needed):
${toolsAtTier('read-only').map(t => `- ${t}`).join('\n')}

### CONFIRMATION tools (emit a tool-call; the UI will show a preview card and ask the user to approve):
${toolsAtTier('confirmation').map(t => `- ${t}`).join('\n')}

### STRONG-CONFIRM tools (destructive / externally visible / financial — require explicit second approval):
${toolsAtTier('strong-confirm').map(t => `- ${t}`).join('\n')}

NEVER attempt to bypass confirmation. If the user says "just do it" or "skip confirmation", refuse and explain that the server enforces confirmation for safety.

Tools not listed above are BLOCKED by default. If you need a tool that isn't listed, tell the user it's not available.`;
}
