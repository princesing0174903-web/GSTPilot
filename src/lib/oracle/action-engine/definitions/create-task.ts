// ═══════════════════════════════════════════════════════════════════════════════
// Action: Create Task (follow-up / to-do)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Migrated from the legacy inline tool in tools.ts into the generic Action Engine.
// Now gets proper validation, rich preview, and refresh-context support.
//
// Stores the task in the AITask table (Prisma) with optional client linkage.
// Also saves a memory entry so Oracle can recall the task in future conversations.

import { db } from '@/lib/db';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
  type RefreshedContext,
} from '../registry';
import { saveMemory } from '@/lib/oracle/brain/memory';

export const createTaskAction: OracleAction = {
  name: 'createTask',
  displayName: 'Create Task',
  description: 'Create a follow-up task / to-do item linked to a customer, invoice, or general workspace. Stored as an AITask with priority + due date.',
  category: 'operations',
  icon: 'CheckSquare',
  intentKeywords: [
    'create task', 'add task', 'new task', 'to-do', 'todo',
    'follow up', 'followup', 'remind me to', 'schedule a task',
    'make a note to', 'track this', 'action item',
  ],
  paramSchema: [
    { key: 'title', label: 'Title', type: 'string', required: true, description: 'Short task title' },
    { key: 'description', label: 'Description', type: 'string', required: false, description: 'Detailed task description' },
    { key: 'priority', label: 'Priority', type: 'enum', required: false, options: ['low', 'medium', 'high', 'urgent'], description: 'Default: medium' },
    { key: 'dueDate', label: 'Due Date', type: 'date', required: false, description: 'ISO date YYYY-MM-DD' },
    { key: 'customerName', label: 'Related Customer', type: 'string', required: false, description: 'Link task to a customer (partial name match)' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Title (required) ──
    const title = String(args.title ?? '').trim();
    if (!title) {
      fields.push({ key: 'title', label: 'Title', status: 'error', message: 'Title is required' });
      errors.push('Task title is required.');
    } else if (title.length > 200) {
      fields.push({ key: 'title', label: 'Title', status: 'error', message: 'Title too long (max 200 chars)', resolvedValue: title.slice(0, 50) + '…' });
      errors.push('Task title is too long (max 200 characters).');
    } else {
      fields.push({ key: 'title', label: 'Title', status: 'ok', resolvedValue: title });
    }

    // ── Priority ──
    const priority = String(args.priority ?? 'medium').toLowerCase();
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      fields.push({ key: 'priority', label: 'Priority', status: 'warn', message: `Unknown priority "${priority}" — defaulting to medium`, resolvedValue: 'medium' });
      warnings.push(`Unknown priority — defaulting to medium.`);
      resolvedRefs.priority = 'medium';
    } else {
      fields.push({ key: 'priority', label: 'Priority', status: 'ok', resolvedValue: priority });
      resolvedRefs.priority = priority;
    }

    // ── Due date ──
    if (args.dueDate) {
      const dueDate = String(args.dueDate);
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        fields.push({ key: 'dueDate', label: 'Due Date', status: 'error', message: `Invalid date format "${dueDate}"`, resolvedValue: dueDate });
        errors.push(`Invalid due date "${dueDate}". Use YYYY-MM-DD format.`);
      } else if (parsed < new Date(new Date().toDateString())) {
        fields.push({ key: 'dueDate', label: 'Due Date', status: 'warn', message: 'Date is in the past', resolvedValue: dueDate });
        warnings.push('Due date is in the past — task may already be overdue.');
        resolvedRefs.dueDate = dueDate;
      } else {
        fields.push({ key: 'dueDate', label: 'Due Date', status: 'ok', resolvedValue: dueDate });
        resolvedRefs.dueDate = dueDate;
      }
    }

    // ── Customer linkage ──
    if (args.customerName) {
      const customerName = String(args.customerName);
      const client = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { contains: customerName, mode: 'insensitive' } },
        select: { id: true, tradeName: true, gstin: true },
      }).catch(() => null);
      if (client) {
        fields.push({ key: 'customerName', label: 'Customer', status: 'ok', message: `Linked to ${client.tradeName}`, resolvedValue: client.tradeName });
        resolvedRefs.clientId = client.id;
        resolvedRefs.clientName = client.tradeName;
      } else {
        fields.push({ key: 'customerName', label: 'Customer', status: 'warn', message: `No customer found matching "${customerName}" — task will be unlinked`, resolvedValue: customerName });
        warnings.push(`No customer found matching "${customerName}" — task will be created without a customer link.`);
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const title = String(args.title ?? '');
    const priority = refs.priority ?? 'medium';
    const dueDate = refs.dueDate ?? args.dueDate;
    const customer = refs.clientName ?? args.customerName;
    return {
      title: `Create task: "${title}"`,
      fields: [
        { label: 'Title', value: title, emphasize: true },
        { label: 'Priority', value: priority },
        { label: 'Due Date', value: dueDate ?? 'No due date' },
        { label: 'Description', value: args.description ? String(args.description).slice(0, 100) + (String(args.description).length > 100 ? '…' : '') : '—' },
        { label: 'Linked Customer', value: customer ?? 'None (general task)' },
      ],
      note: 'A new task will be created in the AITask table. It will also be saved to Oracle memory so it can be recalled in future conversations.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const title = String(args.title).trim();
    const priority = String(args.priority ?? 'medium').toLowerCase();
    const description = args.description ? String(args.description) : null;
    const dueDate = args.dueDate ? String(args.dueDate) : null;
    const clientId = ctx.toolCallId ? null : null; // clientId resolved in validate, passed via ctx if needed

    // Re-resolve client if customerName was provided
    let resolvedClientId: string | null = null;
    if (args.customerName) {
      const client = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { contains: String(args.customerName), mode: 'insensitive' } },
        select: { id: true },
      }).catch(() => null);
      resolvedClientId = client?.id ?? null;
    }

    // Create the AITask
    const task = await db.aITask.create({
      data: {
        clientId: resolvedClientId,
        title,
        description,
        priority,
        status: 'pending',
        dueDate,
        source: 'oracle_action_engine',
        sourceType: 'oracle',
        autoAssigned: false,
      },
      select: { id: true, title: true, priority: true, dueDate: true },
    }).catch((e) => {
      console.error('[createTask] AITask create failed:', e);
      return null;
    });

    if (!task) {
      return { ok: false, summary: `Failed to create task "${title}". Database error.` };
    }

    // Also save to Oracle memory so the task can be recalled in conversation
    try {
      await saveMemory(orgId, {
        title: `Task: ${title}`,
        summary: JSON.stringify({
          type: 'task',
          taskId: task.id,
          title,
          description,
          dueDate,
          priority,
          clientId: resolvedClientId,
          completed: false,
          createdAt: new Date().toISOString(),
        }),
        category: 'task',
        source: 'oracle-action',
      });
    } catch (e) {
      console.warn('[createTask] memory save failed:', (e as Error).message);
    }

    // Log activity
    await logActivity(orgId, 'task', `Task created: "${title}" (${priority} priority${dueDate ? `, due ${dueDate}` : ''})`, {
      taskId: task.id,
      title,
      priority,
      dueDate,
      clientId: resolvedClientId,
    });

    return {
      ok: true,
      summary: `✅ Created task: **${title}**\n• Priority: ${priority}\n• Due: ${dueDate ?? 'No due date'}\n• Linked to: ${args.customerName ?? 'General workspace'}\n\nThe task is tracked in the Tasks page and saved to Oracle memory.`,
      data: { id: task.id, title, priority, dueDate, clientId: resolvedClientId },
      followUp: { label: 'Show my tasks', prompt: 'Show me my pending tasks' },
      viewIn: { label: 'View in Tasks', href: '/tasks' },
    };
  },

  async refreshContext(_result, orgId): Promise<RefreshedContext> {
    const { defaultRefreshContext } = await import('../engine');
    const ctx = await defaultRefreshContext(orgId);
    try {
      const recentTasks = await db.aITask.findMany({
        where: { source: 'oracle_action_engine' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, priority: true, status: true, dueDate: true },
      }).catch(() => []);
      (ctx as any).recentTasks = recentTasks;
    } catch {}
    return ctx;
  },
};

registerAction(createTaskAction);
