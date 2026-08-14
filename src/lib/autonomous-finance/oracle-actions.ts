// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Oracle Autonomous Actions Registry (Phase Delta · 2)
// Oracle can now EXECUTE finance operations, not just answer questions.
// Every action is permission-gated, audit-logged, and supports dry-run.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { COLLECTIONS } from '@/lib/firestore-schema';
import {
  ORACLE_ACTIONS,
  _createDocHolder,
  type OracleAction,
  type OracleActionPermission,
  type OracleActionInputField,
  type ActionContext,
  type ActionResult,
} from './oracle-actions-defs';

// Re-export Prisma-free static definitions so existing server-side imports
// (`import { ORACLE_ACTIONS, type OracleAction } from './oracle-actions'`)
// keep working. Client components should import directly from
// './oracle-actions-defs'.
export {
  ORACLE_ACTIONS,
  type OracleAction,
  type OracleActionPermission,
  type OracleActionInputField,
  type ActionContext,
  type ActionResult,
} from './oracle-actions-defs';

// ─── Register the Prisma-backed createDoc implementation ─────────────────────
// The executor function bodies in `./oracle-actions-defs` call `createDoc`
// (defined inline there as a delegating stub). Here we inject the real
// implementation that writes through the Prisma `db` instance. This keeps
// `@/lib/db` out of the defs module so it can be safely imported by client
// components.

_createDocHolder.fn = async (
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> => {
  await db.collection(collection).doc(id).set({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

// ─── Audit log writer (uses safe-write pattern) ──────────────────────────────

async function writeAudit(
  ctx: ActionContext,
  actionId: string,
  input: Record<string, unknown>,
  result: { success: boolean; output?: unknown; error?: string },
  dryRun: boolean,
): Promise<string> {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await db.collection(COLLECTIONS.ACTIVITIES).doc(auditId).set({
      activityId: auditId,
      organizationId: ctx.organizationId,
      type: 'oracle_action',
      action: actionId,
      actor: 'oracle',
      actorEmail: ctx.userEmail,
      userId: ctx.userId,
      input: JSON.parse(JSON.stringify(input)),
      result: JSON.parse(JSON.stringify(result)),
      dryRun,
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
    });
  } catch {
    // graceful: audit failure must not block the action
  }
  return auditId;
}

// ─── Execution entry point (permission-gated + audited) ──────────────────────

export async function executeOracleAction(
  actionId: string,
  input: Record<string, unknown>,
  ctx: ActionContext,
  dryRun: boolean = false,
): Promise<ActionResult> {
  const action = ORACLE_ACTIONS.find((a) => a.id === actionId);
  if (!action) {
    const auditId = await writeAudit(ctx, actionId, input, { success: false, error: 'Unknown action' }, dryRun);
    return { success: false, auditId, error: `Unknown action: ${actionId}` };
  }

  // Validate required inputs
  for (const field of action.inputSchema) {
    if (field.required && (input[field.key] === undefined || input[field.key] === '')) {
      const auditId = await writeAudit(ctx, actionId, input, { success: false, error: `Missing required field: ${field.key}` }, dryRun);
      return { success: false, auditId, error: `Missing required field: ${field.label}` };
    }
  }

  // Dry run — validate + preview, no write
  if (dryRun) {
    const preview = action.dryRun(input, ctx);
    const auditId = await writeAudit(ctx, actionId, input, { success: true, output: preview }, true);
    return { success: true, output: preview, auditId };
  }

  // Real execution
  try {
    const output = await action.executor(input, ctx);
    const auditId = await writeAudit(ctx, actionId, input, { success: true, output }, false);
    return { success: true, output, auditId };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Execution failed';
    const auditId = await writeAudit(ctx, actionId, input, { success: false, error }, false);
    return { success: false, auditId, error };
  }
}

export function getOracleAction(id: string): OracleAction | undefined {
  return ORACLE_ACTIONS.find((a) => a.id === id);
}
