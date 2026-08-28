// ═══════════════════════════════════════════════════════════════════════════════
// Action: Sync Zoho Books
// ═══════════════════════════════════════════════════════════════════════════════
//
// Triggers a Zoho Books sync via the canonical `runZohoFullSync` engine. The
// engine reads/writes the same ZohoBooksToken + ZohoSyncLog + mirror tables
// as the Zoho Books page, so the action is the EXACT same operation.
//
// Connection check: the real Zoho Books connection is tracked in the
// ZohoBooksToken table (organizationId + revokedAt=null). The Integration
// table is also queried as a fallback (tenantId=orgId, provider='zoho-books',
// status='connected') per the action spec.
//
// The engine maxDuration is 30s — we wrap the sync in a 25s timeout. If it
// times out, we report that the sync is running in the background (the
// sync-engine writes ZohoSyncLog rows as it goes, so progress is visible).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
// Zoho integration removed — stub for rebuild
const runZohoFullSync = async () => ({ ok: false, error: 'Zoho integration rebuilding' });
type SyncEngineResult = { ok: boolean; error?: string };
type SyncModuleResult = { module: string; fetched: number; imported: number; updated: number; failed: number };
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_MODES = ['full', 'incremental'] as const;
const SYNC_TIMEOUT_MS = 25_000;

export const syncZohoAction: OracleAction = {
  name: 'syncZoho',
  displayName: 'Sync Zoho Books',
  description: 'Pull the latest data from Zoho Books (customers, vendors, invoices, bills, payments, items, etc.). Uses the same sync engine as the Zoho Books page.',
  category: 'operations',
  icon: 'RefreshCw',
  intentKeywords: [
    'sync zoho', 'zoho sync', 'refresh zoho', 'pull from zoho', 'sync zoho books',
  ],
  paramSchema: [
    { key: 'mode', label: 'Mode', type: 'enum', required: false, options: [...VALID_MODES], description: 'full (default) or incremental' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Mode ──
    const mode = String(args.mode ?? 'full').toLowerCase();
    if (!VALID_MODES.includes(mode as any)) {
      fields.push({ key: 'mode', label: 'Mode', status: 'warn', message: `Unknown — defaulting to "full"`, resolvedValue: 'full' });
      warnings.push(`Unknown sync mode "${mode}" — defaulting to full.`);
      resolvedRefs.mode = 'full';
    } else {
      fields.push({ key: 'mode', label: 'Mode', status: 'ok', resolvedValue: mode });
      resolvedRefs.mode = mode;
    }

    // ── Connection check ──
    const tokenCount = await db.zohoBooksToken.count({
      where: { organizationId: orgId, revokedAt: null },
    }).catch(() => 0);
    const integrationRow = tokenCount > 0
      ? null
      : await db.integration.findFirst({
          where: { tenantId: orgId, provider: 'zoho-books', status: 'connected' },
          select: { id: true, provider: true, status: true },
        }).catch(() => null);

    if (tokenCount === 0 && !integrationRow) {
      fields.push({ key: 'mode', label: 'Zoho Connection', status: 'error', message: 'Zoho Books is not connected' });
      errors.push('Zoho Books is not connected. Connect it from the Integrations page first.');
    } else {
      fields.push({ key: 'mode', label: 'Zoho Connection', status: 'ok', message: 'Connected', resolvedValue: tokenCount > 0 ? 'token' : 'integration' });
      resolvedRefs.connected = true;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const mode = refs.mode ?? String(args.mode ?? 'full');
    return {
      title: `Sync Zoho Books (${mode})`,
      fields: [
        { label: 'Mode', value: mode, emphasize: true },
        { label: 'Connection', value: refs.connected ? 'Connected' : 'Not connected' },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'Will pull the latest data from Zoho Books. If the sync takes longer than 25s, it continues in the background — check the Zoho Books page for progress.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const mode = VALID_MODES.includes(String(args.mode ?? 'full').toLowerCase() as any)
      ? (String(args.mode ?? 'full').toLowerCase() as 'full' | 'incremental')
      : 'full';

    // Re-check connection
    const tokenCount = await db.zohoBooksToken.count({
      where: { organizationId: orgId, revokedAt: null },
    }).catch(() => 0);
    if (tokenCount === 0) {
      const integrationRow = await db.integration.findFirst({
        where: { tenantId: orgId, provider: 'zoho-books', status: 'connected' },
        select: { id: true },
      }).catch(() => null);
      if (!integrationRow) {
        return { ok: false, summary: 'Zoho Books is not connected. Connect it from the Integrations page first.' };
      }
    }

    // Run the sync with a 25s timeout
    let result: SyncEngineResult | null = null;
    let timedOut = false;
    try {
      result = await Promise.race([
        runZohoFullSync({ organizationId: orgId, userId: ctx.userId ?? null, mode }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SYNC_TIMEOUT_MS)),
      ]);
      if (result === null) {
        timedOut = true;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[syncZoho] runZohoFullSync threw:', msg);
      return { ok: false, summary: `Zoho sync failed: ${msg}` };
    }

    if (timedOut || !result) {
      await logActivity(orgId, 'integration', `Zoho Books ${mode} sync started in background (timed out after 25s)`, { mode });
      await emitTimelineEvent({
        organizationId: orgId,
        type: 'integration.zoho_sync_started',
        title: 'Zoho Books sync started in background',
        description: `Mode: ${mode}. Timed out after 25s — check the Zoho Books page for progress.`,
        severity: 'info',
        actor: { userId: ctx.userId, userName: ctx.userId },
        metadata: { mode, timedOut: true },
      });
      return {
        ok: true,
        summary: `⏳ Sync started in the background — check the Zoho Books page for progress. The sync engine writes progress to ZohoSyncLog as it imports each module.`,
        data: { mode, timedOut: true },
        viewIn: { label: 'View Zoho sync', href: '/zoho-books' },
      };
    }

    if (!result.ok) {
      await logActivity(orgId, 'integration', `Zoho Books ${mode} sync failed: ${result.error ?? 'unknown'}`, { mode, error: result.error });
      await emitTimelineEvent({
        organizationId: orgId,
        type: 'integration.zoho_sync_failed',
        title: 'Zoho Books sync failed',
        description: result.error ?? 'Unknown error.',
        severity: 'warning',
        actor: { userId: ctx.userId, userName: ctx.userId },
        metadata: { mode, error: result.error },
      });
      return {
        ok: false,
        summary: `Zoho sync failed: ${result.error ?? 'Unknown error.'}`,
        data: { mode, status: result.status, error: result.error },
        viewIn: { label: 'View Zoho sync', href: '/zoho-books' },
      };
    }

    await logActivity(orgId, 'integration', `Zoho Books ${mode} sync completed: fetched ${result.totalFetched}, imported ${result.totalImported}, updated ${result.totalUpdated}, failed ${result.totalFailed} (${result.durationMs}ms)`, {
      mode, status: result.status,
      totalFetched: result.totalFetched,
      totalImported: result.totalImported,
      totalUpdated: result.totalUpdated,
      totalFailed: result.totalFailed,
      durationMs: result.durationMs,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'integration.zoho_sync_completed',
      title: 'Zoho Books sync completed',
      description: `Fetched ${result.totalFetched}, imported ${result.totalImported}, updated ${result.totalUpdated}, failed ${result.totalFailed} in ${result.durationMs}ms.`,
      severity: 'success',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: {
        mode, status: result.status,
        totalFetched: result.totalFetched,
        totalImported: result.totalImported,
        totalUpdated: result.totalUpdated,
        totalFailed: result.totalFailed,
        durationMs: result.durationMs,
      },
    });

    const moduleRows = (result.modules ?? []).map((m: SyncModuleResult) => ({
      Module: m.module,
      Status: m.status,
      Fetched: String(m.fetched),
      Imported: String(m.imported),
      Updated: String(m.updated),
      Failed: String(m.failed),
    }));

    return {
      ok: true,
      summary: `✅ Zoho Books ${mode} sync completed in ${(result.durationMs / 1000).toFixed(1)}s: fetched ${result.totalFetched}, imported ${result.totalImported}, updated ${result.totalUpdated}, failed ${result.totalFailed}.`,
      data: {
        mode,
        status: result.status,
        totalFetched: result.totalFetched,
        totalImported: result.totalImported,
        totalUpdated: result.totalUpdated,
        totalFailed: result.totalFailed,
        durationMs: result.durationMs,
        moduleCount: result.modules.length,
      },
      artifacts: moduleRows.length > 0 ? [{
        kind: 'table',
        title: 'Per-module sync breakdown',
        columns: ['Module', 'Status', 'Fetched', 'Imported', 'Updated', 'Failed'],
        rows: moduleRows,
      }] : undefined,
      viewIn: { label: 'View Zoho sync', href: '/zoho-books' },
    };
  },
};

registerAction(syncZohoAction);
