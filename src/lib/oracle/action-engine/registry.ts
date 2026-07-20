// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Action Engine: Registry
// ═══════════════════════════════════════════════════════════════════════════════
//
// The generic, reusable registry that powers Oracle's ability to perform real
// business actions. Every action (Create Invoice, Create Customer, Record
// Payment, Record Expense, Send Reminder, and future actions like GST Filing,
// Zoho Sync, Banking, Reports, WhatsApp, Email) plugs into this registry by
// implementing the OracleAction interface — Oracle's core logic never needs to
// change when a new action is added.
//
// Flow (handled by engine.ts):
//   User Request
//     ↓
//   Intent Detection          ← registry.detectIntent(message)
//     ↓
//   Parameter Extraction      ← LLM emits structured args (handled by brain route)
//     ↓
//   Validation                ← action.validate(args, orgId) — live DB checks
//     ↓
//   Confirmation              ← action.buildPreview(args, validation) → UI card
//     ↓
//   Action Execution          ← action.execute(args, orgId, ctx) — real Prisma write
//     ↓
//   Database Update           ← (happens inside execute)
//     ↓
//   Refresh Dashboard & Oracle Context  ← action.refreshContext? or default
//     ↓
//   Success Response          ← action.buildSuccessMessage(result)
//
// Adding a new action = create a file in definitions/, call registerAction().
// Nothing in brain/route.ts, confirm/route.ts, or OracleBrainCore.tsx changes.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Context passed to every action's validate() and execute(). */
export interface ActionContext {
  orgId: string;
  userId?: string;
  sessionId?: string;
  messageId?: string;
  /** The tool-call audit row id (from OracleAIToolCall) — used to update status. */
  toolCallId?: string;
}

/** A single parameter field in an action's schema. */
export interface ParamField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'array' | 'object' | 'enum';
  required: boolean;
  description?: string;
  /** For enum: the allowed values. */
  options?: string[];
  /** For array/object: the nested schema. */
  fields?: ParamField[];
}

/** Result of validating an action's args against live DB data. */
export interface ValidationResult {
  ok: boolean;
  /** Per-field validation results — drives the green checkmarks in the UI. */
  fields: Array<{
    key: string;
    label: string;
    status: 'ok' | 'warn' | 'error';
    message?: string;
    /** The resolved value (e.g. matched customer ID) — shown in the preview. */
    resolvedValue?: string;
  }>;
  /** Hard errors that block execution. */
  errors: string[];
  /** Soft warnings — user can still proceed. */
  warnings: string[];
  /** Resolved entity references (e.g. { customerId: '...', customerName: '...' }). */
  resolvedRefs?: Record<string, any>;
}

/** Human-readable preview for the confirmation card. */
export interface ActionPreview {
  /** One-line summary shown at the top of the card. */
  title: string;
  /** Structured key→value rows rendered as a table in the card. */
  fields: Array<{ label: string; value: string; emphasize?: boolean }>;
  /** Optional footer note (e.g. "A new customer will be created"). */
  note?: string;
}

/** Result of executing an action. */
export interface ActionResult {
  ok: boolean;
  /** Human-readable success message (the LLM relays this). */
  summary: string;
  /** The created entity (e.g. { invoiceId, invoiceNumber, totalAmount }). */
  data?: Record<string, any>;
  /** Structured artifacts for rich rendering (tables, metrics). */
  artifacts?: Array<{
    kind: 'table' | 'metric' | 'list';
    title: string;
    columns?: string[];
    rows?: Record<string, any>[];
    items?: any[];
  }>;
  /** Optional follow-up suggestion shown as a chip after success. */
  followUp?: { label: string; prompt: string };
  /** Optional deep-link to the relevant module page. */
  viewIn?: { label: string; href: string };
}

/** Refreshed dashboard context returned after a successful action. */
export interface RefreshedContext {
  snapshot?: any;
  recentInvoices?: any[];
  recentActivity?: any[];
  memory?: any[];
  revenue?: number;
  receivables?: number;
  cash?: number;
}

/** The interface every Oracle action implements. */
export interface OracleAction {
  /** Unique action name (matches the tool name in tools.ts, e.g. 'createInvoice'). */
  name: string;
  /** Display name shown in the UI (e.g. 'Create Invoice'). */
  displayName: string;
  /** Short description. */
  description: string;
  /** Category for grouping in the UI. */
  category: 'finance' | 'crm' | 'compliance' | 'communication' | 'operations';
  /** Lucide icon name (resolved by the UI). */
  icon: string;
  /** Keywords/phrases that signal this action (for intent detection). */
  intentKeywords: string[];
  /** Structured parameter schema. */
  paramSchema: ParamField[];
  /** Validate args against live DB. Called BEFORE showing the confirmation card. */
  validate: (args: Record<string, any>, orgId: string) => Promise<ValidationResult>;
  /** Build a human-readable preview for the confirmation card. */
  buildPreview: (args: Record<string, any>, validation: ValidationResult) => ActionPreview;
  /** Execute the action — real Prisma write. Called only after user confirms. */
  execute: (args: Record<string, any>, orgId: string, ctx: ActionContext) => Promise<ActionResult>;
  /**
   * Refresh affected dashboard data after a successful execution.
   * Default implementation in engine.ts refreshes snapshot + recent invoices +
   * activity. Override for action-specific refresh (e.g. sendReminder refreshes
   * communication logs).
   */
  refreshContext?: (result: ActionResult, orgId: string) => Promise<RefreshedContext>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, OracleAction>();
const intentIndex: Array<{ action: OracleAction; patterns: RegExp[] }> = [];

/**
 * Register a new action. Called once at module load for each action definition.
 * Adding a new action = create a definition file that calls this.
 */
export function registerAction(action: OracleAction): void {
  if (registry.has(action.name)) {
    console.warn(`[action-engine] action "${action.name}" already registered — overwriting.`);
  }
  registry.set(action.name, action);
  // Build intent patterns from keywords (word-boundary, case-insensitive)
  const patterns = action.intentKeywords.map(kw => new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i'));
  intentIndex.push({ action, patterns });
}

/** Get an action by name. */
export function getAction(name: string): OracleAction | undefined {
  return registry.get(name);
}

/** List all registered actions. */
export function listActions(): OracleAction[] {
  return Array.from(registry.values());
}

/**
 * Detect which action (if any) a user message is asking for.
 * Returns the first matching action by keyword hit count.
 * This is a fast pre-filter — the LLM still does the real intent + param
 * extraction via tool calls. This is used by the engine to enrich the
 * confirmation flow.
 */
export function detectIntent(message: string): OracleAction | null {
  if (!message) return null;
  let best: { action: OracleAction; score: number } | null = null;
  for (const { action, patterns } of intentIndex) {
    let score = 0;
    for (const p of patterns) {
      if (p.test(message)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { action, score };
    }
  }
  return best?.action ?? null;
}

/** Check if a tool name is a registered action that requires confirmation. */
export function isRegisteredAction(toolName: string): boolean {
  return registry.has(toolName);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Format INR amounts consistently across all actions. */
export function inr(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

/** Find or create a client by trade name (used by multiple actions). */
export async function findOrCreateClient(
  orgId: string,
  tradeName: string,
  extra: { gstin?: string; email?: string; phone?: string; state?: string } = {},
): Promise<{ id: string; gstin: string; tradeName: string; created: boolean }> {
  const existing = await db.client.findFirst({
    where: { firmId: orgId, tradeName: { equals: tradeName } },
    select: { id: true, gstin: true, tradeName: true },
  }).catch(() => null);
  if (existing) return { ...existing, created: false };
  const gstin = extra.gstin?.trim() || `LOCAL-${Date.now()}`;
  const created = await db.client.create({
    data: {
      firmId: orgId,
      tradeName,
      legalName: tradeName,
      gstin,
      contactEmail: extra.email ?? null,
      contactPhone: extra.phone ?? null,
      state: extra.state ?? null,
      entityType: 'regular',
      status: 'active',
    },
    select: { id: true, gstin: true, tradeName: true },
  });
  return { ...created, created: true };
}

/** Log an activity event (used by all actions for the timeline). */
export async function logActivity(
  orgId: string,
  type: string,
  description: string,
  metadata: Record<string, any> = {},
): Promise<void> {
  try {
    await db.activity.create({
      data: { firmId: orgId, type, description, metadata: JSON.stringify(metadata) },
    });
  } catch (e) {
    console.warn(`[action-engine] activity log failed:`, (e as Error).message);
  }
}
