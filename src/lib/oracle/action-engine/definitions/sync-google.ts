// ═══════════════════════════════════════════════════════════════════════════════
// Action: Sync Google Workspace
// ═══════════════════════════════════════════════════════════════════════════════
//
// Best-effort action: logs the sync request + emits a timeline event + logs
// an activity. Google Workspace sync does NOT have a single sync-all function
// like Zoho — the actual ingestion happens via the existing Google hooks
// (Gmail Pub/Sub, Drive changes watch, Calendar sync). This action is the
// Oracle-visible trigger that records the user's intent and points them to
// the Google Workspace page.
//
// Connection check: the real Google Workspace connection is tracked in the
// GoogleWorkspaceToken table (organizationId + revokedAt=null). The
// Integration table is also queried as a fallback per the action spec.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_SERVICES = ['gmail', 'drive', 'calendar', 'all'] as const;

export const syncGoogleAction: OracleAction = {
  name: 'syncGoogle',
  displayName: 'Sync Google Workspace',
  description: 'Trigger a Google Workspace sync (Gmail / Drive / Calendar). Logs the request + emits a timeline event. Actual ingestion happens via the existing Google hooks.',
  category: 'operations',
  icon: 'RefreshCw',
  intentKeywords: [
    'sync google', 'google sync', 'refresh google', 'sync gmail', 'sync drive', 'sync calendar',
  ],
  paramSchema: [
    { key: 'service', label: 'Service', type: 'enum', required: false, options: [...VALID_SERVICES], description: 'gmail / drive / calendar / all (default: all)' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Service ──
    const service = String(args.service ?? 'all').toLowerCase();
    if (!VALID_SERVICES.includes(service as any)) {
      fields.push({ key: 'service', label: 'Service', status: 'warn', message: `Unknown — defaulting to "all"`, resolvedValue: 'all' });
      warnings.push(`Unknown service "${service}" — defaulting to all.`);
      resolvedRefs.service = 'all';
    } else {
      fields.push({ key: 'service', label: 'Service', status: 'ok', resolvedValue: service });
      resolvedRefs.service = service;
    }

    // ── Connection check ──
    const tokenCount = await db.googleWorkspaceToken.count({
      where: { organizationId: orgId, revokedAt: null },
    }).catch(() => 0);
    const integrationRow = tokenCount > 0
      ? null
      : await db.integration.findFirst({
          where: { tenantId: orgId, provider: 'google', status: 'connected' },
          select: { id: true, provider: true, status: true },
        }).catch(() => null);

    if (tokenCount === 0 && !integrationRow) {
      fields.push({ key: 'service', label: 'Google Connection', status: 'error', message: 'Google Workspace is not connected' });
      errors.push('Google Workspace is not connected. Connect it from the Integrations page first.');
    } else {
      fields.push({ key: 'service', label: 'Google Connection', status: 'ok', message: 'Connected', resolvedValue: tokenCount > 0 ? 'token' : 'integration' });
      resolvedRefs.connected = true;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const service = refs.service ?? String(args.service ?? 'all');
    return {
      title: `Sync Google Workspace (${service})`,
      fields: [
        { label: 'Service', value: service, emphasize: true },
        { label: 'Connection', value: refs.connected ? 'Connected' : 'Not connected' },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'Logs the sync request + emits a timeline event. New emails / events / files will appear in the timeline as they are ingested by the existing Google hooks.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const service = VALID_SERVICES.includes(String(args.service ?? 'all').toLowerCase() as any)
      ? (String(args.service ?? 'all').toLowerCase() as typeof VALID_SERVICES[number])
      : 'all';

    // Re-check connection
    const tokenCount = await db.googleWorkspaceToken.count({
      where: { organizationId: orgId, revokedAt: null },
    }).catch(() => 0);
    if (tokenCount === 0) {
      const integrationRow = await db.integration.findFirst({
        where: { tenantId: orgId, provider: 'google', status: 'connected' },
        select: { id: true },
      }).catch(() => null);
      if (!integrationRow) {
        return { ok: false, summary: 'Google Workspace is not connected. Connect it from the Integrations page first.' };
      }
    }

    await logActivity(orgId, 'integration', `Google Workspace sync triggered for ${service}`, { service });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'integration.google_sync_triggered',
      title: `Google Workspace sync triggered (${service})`,
      description: `New ${service === 'all' ? 'emails, events, and files' : service + ' items'} will appear in the timeline as they are ingested by the existing Google hooks.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { service },
    });

    return {
      ok: true,
      summary: `✅ Google Workspace sync triggered for **${service}**. New ${service === 'all' ? 'emails, events, and files' : `${service} items`} will appear in the timeline as they are ingested by the existing Google hooks.`,
      data: { service },
      viewIn: { label: 'View Google', href: '/google-workspace' },
    };
  },
};

registerAction(syncGoogleAction);
