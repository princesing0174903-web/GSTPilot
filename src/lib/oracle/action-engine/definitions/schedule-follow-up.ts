// ═══════════════════════════════════════════════════════════════════════════════
// Action: Schedule Follow-up
// ═══════════════════════════════════════════════════════════════════════════════
//
// Creates a follow-up task linked (optionally) to a Client. Stored in the
// AITask table — the same table the Tasks page reads from. The follow-up
// channel (call / email / whatsapp / meeting) is recorded in the description
// and sourceType so it can be filtered later.
//
// Prisma model: AITask { id, clientId?, source, sourceType, sourceId?, title,
//   description?, priority, status, assignedTo?, dueDate?(String),
//   autoAssigned, completedAt?, createdAt, updatedAt }
// (There is NO `Task` model in the schema — AITask is the canonical tasks
//  table; create-task.ts also uses it.)
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

const VALID_CHANNELS = ['call', 'email', 'whatsapp', 'meeting'] as const;

export const scheduleFollowUpAction: OracleAction = {
  name: 'scheduleFollowUp',
  displayName: 'Schedule Follow-up',
  description: 'Schedule a follow-up (call / email / WhatsApp / meeting) with a customer or lead. Creates an AITask with a due date, optionally linked to a Client.',
  category: 'crm',
  icon: 'Calendar',
  intentKeywords: [
    'schedule follow up', 'schedule followup', 'set reminder', 'follow up call',
    'remind me to call', 'schedule call', 'follow up',
  ],
  paramSchema: [
    { key: 'partyName', label: 'Party', type: 'string', required: true, description: 'Customer or lead name' },
    { key: 'dueDate', label: 'Due Date', type: 'date', required: true, description: 'When to follow up (YYYY-MM-DD)' },
    { key: 'channel', label: 'Channel', type: 'enum', required: false, options: [...VALID_CHANNELS], description: 'Default: call' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, description: 'What to discuss / context' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Party name ──
    const partyName = String(args.partyName ?? '').trim();
    if (!partyName) {
      fields.push({ key: 'partyName', label: 'Party', status: 'error', message: 'Party name is required' });
      errors.push('Party name is required.');
    } else {
      const client = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: partyName } },
        select: { id: true, tradeName: true, status: true },
      }).catch(() => null);
      if (client) {
        fields.push({ key: 'partyName', label: 'Party', status: 'ok', message: `Linked to ${client.tradeName} (${client.status})`, resolvedValue: client.tradeName });
        resolvedRefs.clientId = client.id;
        resolvedRefs.partyName = client.tradeName;
      } else {
        fields.push({ key: 'partyName', label: 'Party', status: 'warn', message: 'No matching customer/lead — follow-up will be unlinked', resolvedValue: partyName });
        warnings.push(`Will create a follow-up without a linked customer (no match for "${partyName}").`);
        resolvedRefs.partyName = partyName;
      }
    }

    // ── Due date ──
    if (!args.dueDate) {
      fields.push({ key: 'dueDate', label: 'Due Date', status: 'error', message: 'Due date is required' });
      errors.push('Due date is required.');
    } else {
      const dueDate = String(args.dueDate);
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        fields.push({ key: 'dueDate', label: 'Due Date', status: 'error', message: `Invalid date "${dueDate}"`, resolvedValue: dueDate });
        errors.push(`Invalid due date "${dueDate}". Use YYYY-MM-DD.`);
      } else {
        if (parsed < new Date(new Date().toDateString())) {
          fields.push({ key: 'dueDate', label: 'Due Date', status: 'warn', message: 'Date is in the past', resolvedValue: dueDate });
          warnings.push('Due date is in the past.');
        } else {
          fields.push({ key: 'dueDate', label: 'Due Date', status: 'ok', resolvedValue: dueDate });
        }
        resolvedRefs.dueDate = dueDate;
      }
    }

    // ── Channel ──
    const channel = String(args.channel ?? 'call').toLowerCase();
    if (!VALID_CHANNELS.includes(channel as any)) {
      fields.push({ key: 'channel', label: 'Channel', status: 'warn', message: `Unknown — defaulting to "call"`, resolvedValue: 'call' });
      warnings.push(`Unknown channel "${channel}" — defaulting to "call".`);
      resolvedRefs.channel = 'call';
    } else {
      fields.push({ key: 'channel', label: 'Channel', status: 'ok', resolvedValue: channel });
      resolvedRefs.channel = channel;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const partyName = refs.partyName ?? String(args.partyName ?? '—');
    const dueDate = refs.dueDate ?? (args.dueDate ? String(args.dueDate) : '—');
    const channel = refs.channel ?? (args.channel ? String(args.channel) : 'call');
    const notes = args.notes ? String(args.notes).slice(0, 100) + (String(args.notes).length > 100 ? '…' : '') : '—';
    return {
      title: `Schedule ${channel} follow-up with ${partyName}`,
      fields: [
        { label: 'Party', value: partyName, emphasize: true },
        { label: 'Due Date', value: dueDate, emphasize: true },
        { label: 'Channel', value: channel },
        { label: 'Notes', value: notes },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'A follow-up task will be created in the Tasks page with a pending status.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const partyName = String(args.partyName).trim();
    const dueDate = String(args.dueDate);
    const channel = VALID_CHANNELS.includes(String(args.channel ?? 'call').toLowerCase() as any)
      ? String(args.channel ?? 'call').toLowerCase()
      : 'call';
    const notes = args.notes ? String(args.notes) : null;

    // Re-resolve the client (validate may have run on a stale orgId snapshot)
    const client = await db.client.findFirst({
      where: { firmId: orgId, tradeName: { equals: partyName } },
      select: { id: true, tradeName: true },
    }).catch(() => null);

    const title = `Follow up with ${partyName}`;
    const description = [
      `Channel: ${channel}`,
      notes ? `Notes: ${notes}` : null,
      client ? `Linked customer: ${client.tradeName}` : 'Unlinked follow-up',
    ].filter(Boolean).join('\n');

    const task = await db.aITask.create({
      data: {
        clientId: client?.id ?? null,
        title,
        description,
        priority: 'medium',
        status: 'pending',
        dueDate,
        source: 'oracle_action_engine',
        sourceType: `follow_up:${channel}`,
        assignedTo: ctx.userId ?? null,
        autoAssigned: false,
      },
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
    }).catch((e) => {
      console.error('[scheduleFollowUp] AITask create failed:', e);
      return null;
    });

    if (!task) {
      return { ok: false, summary: `Failed to schedule follow-up with ${partyName}. Database error.` };
    }

    await logActivity(orgId, 'crm', `Follow-up scheduled with ${partyName} for ${dueDate} (${channel})`, {
      taskId: task.id, partyName, dueDate, channel, notes, clientId: client?.id ?? null,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'crm.followup_scheduled',
      title: `Follow-up scheduled with ${partyName}`,
      description: `${channel} follow-up due ${dueDate}.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { taskId: task.id, partyName, dueDate, channel, clientId: client?.id ?? null, notes },
    });

    return {
      ok: true,
      summary: `✅ Scheduled a **${channel}** follow-up with **${partyName}** for **${dueDate}**.${client ? ` Linked to customer "${client.tradeName}".` : ' (No linked customer — created as a general follow-up.)'} The task is on your Tasks page with a pending status.`,
      data: { id: task.id, title: task.title, dueDate: task.dueDate, status: task.status, priority: task.priority, channel, clientId: client?.id ?? null, partyName },
      viewIn: { label: 'View in Tasks', href: '/tasks' },
    };
  },
};

registerAction(scheduleFollowUpAction);
