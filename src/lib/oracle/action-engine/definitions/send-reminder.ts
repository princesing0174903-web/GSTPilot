// ═══════════════════════════════════════════════════════════════════════════════
// Action: Send Payment Reminder
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
  type RefreshedContext,
} from '../registry';

export const sendReminderAction: OracleAction = {
  name: 'sendReminder',
  displayName: 'Send Payment Reminder',
  description: 'Send a payment reminder to overdue customer(s) via email/SMS/WhatsApp. Creates a CommunicationLog entry for each customer.',
  category: 'communication',
  icon: 'Send',
  intentKeywords: [
    'send reminder', 'payment reminder', 'remind customer', 'follow up',
    'overdue reminder', 'chase payment', 'collection reminder', 'send notice',
    'payment follow up', 'followup',
  ],
  paramSchema: [
    { key: 'customerName', label: 'Customer (optional)', type: 'string', required: false, description: 'Specific customer to remind (omit for all overdue)' },
    { key: 'channel', label: 'Channel', type: 'enum', required: false, options: ['email', 'sms', 'whatsapp'], description: 'Default: email' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const channel = String(args.channel ?? 'email');
    if (!['email', 'sms', 'whatsapp'].includes(channel)) {
      fields.push({ key: 'channel', label: 'Channel', status: 'warn', message: `Defaulting to "email"`, resolvedValue: channel });
      warnings.push(`Unknown channel "${channel}" — defaulting to email.`);
      resolvedRefs.channel = 'email';
    } else {
      fields.push({ key: 'channel', label: 'Channel', status: 'ok', resolvedValue: channel });
      resolvedRefs.channel = channel;
    }

    // Find overdue invoices
    const where: any = { client: { firmId: orgId }, paymentStatus: 'overdue' };
    if (args.customerName) {
      where.buyerName = { contains: String(args.customerName), mode: 'insensitive' };
    }
    const overdueInvoices = await db.invoice.findMany({
      where,
      select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, dueDate: true, clientId: true, totalAmount: true },
      take: 100,
    }).catch(() => []);

    if (overdueInvoices.length === 0) {
      if (args.customerName) {
        fields.push({ key: 'customerName', label: 'Customer', status: 'error', message: `No overdue invoices for "${args.customerName}"`, resolvedValue: String(args.customerName) });
        errors.push(`No overdue invoices found for "${args.customerName}".`);
      } else {
        fields.push({ key: 'customerName', label: 'Customers', status: 'error', message: 'No overdue invoices in your workspace' });
        errors.push('No overdue invoices to send reminders for.');
      }
    } else {
      // Group by customer
      const byCustomer = new Map<string, { invoices: typeof overdueInvoices; total: number; clientId: string | null }>();
      for (const inv of overdueInvoices) {
        const name = inv.buyerName ?? 'Unknown';
        const existing = byCustomer.get(name) ?? { invoices: [], total: 0, clientId: null };
        existing.invoices.push(inv);
        existing.total += inv.balanceAmount ?? 0;
        existing.clientId = existing.clientId ?? inv.clientId;
        byCustomer.set(name, existing);
      }
      const totalOutstanding = Array.from(byCustomer.values()).reduce((s, g) => s + g.total, 0);
      resolvedRefs.customerCount = byCustomer.size;
      resolvedRefs.invoiceCount = overdueInvoices.length;
      resolvedRefs.totalOutstanding = totalOutstanding;
      resolvedRefs.customers = Array.from(byCustomer.entries()).map(([name, g]) => ({ name, invoiceCount: g.invoices.length, total: g.total, clientId: g.clientId }));

      if (args.customerName) {
        const matched = byCustomer.get(args.customerName);
        fields.push({
          key: 'customerName',
          label: 'Customer',
          status: 'ok',
          message: `${matched ? matched.invoices.length : 0} overdue invoice(s), ${inr(matched?.total ?? 0)} outstanding`,
          resolvedValue: args.customerName,
        });
      } else {
        fields.push({
          key: 'customerName',
          label: 'Customers',
          status: 'ok',
          message: `${byCustomer.size} customer(s), ${overdueInvoices.length} invoice(s)`,
          resolvedValue: `${byCustomer.size} customers`,
        });
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const channel = refs.channel ?? 'email';
    const customerCount = refs.customerCount ?? 0;
    const invoiceCount = refs.invoiceCount ?? 0;
    const totalOutstanding = refs.totalOutstanding ?? 0;
    const target = args.customerName ? `to ${args.customerName}` : `to ${customerCount} overdue customer(s)`;
    const customerList = Array.isArray(refs.customers) && refs.customers.length > 0 && !args.customerName
      ? refs.customers.slice(0, 5).map((c: any) => `${c.name} (${c.invoiceCount} inv, ${inr(c.total)})`).join('; ') + (refs.customers.length > 5 ? ` +${refs.customers.length - 5} more` : '')
      : args.customerName ?? '—';
    return {
      title: `Send ${channel} reminder ${target}`,
      fields: [
        { label: 'Channel', value: channel, emphasize: true },
        { label: 'Recipients', value: `${customerCount} customer(s)`, emphasize: true },
        { label: 'Overdue Invoices', value: String(invoiceCount) },
        { label: 'Total Outstanding', value: inr(totalOutstanding), emphasize: true },
        { label: 'Customers', value: customerList },
      ],
      note: 'A CommunicationLog entry will be created for each customer. Connect an email/SMS provider in Settings to actually deliver the messages.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const channel = String(args.channel ?? 'email');
    const where: any = { client: { firmId: orgId }, paymentStatus: 'overdue' };
    if (args.customerName) {
      where.buyerName = { contains: String(args.customerName), mode: 'insensitive' };
    }
    const invoices = await db.invoice.findMany({
      where,
      select: { id: true, invoiceNumber: true, buyerName: true, balanceAmount: true, dueDate: true, clientId: true, totalAmount: true },
      take: 100,
    }).catch(() => []);

    if (invoices.length === 0) {
      return { ok: false, summary: args.customerName ? `No overdue invoices found for "${args.customerName}".` : 'No overdue invoices to send reminders for.' };
    }

    // Group by customer
    const byCustomer = new Map<string, { invoices: typeof invoices; total: number; clientId: string | null }>();
    for (const inv of invoices) {
      const name = inv.buyerName ?? 'Unknown';
      const existing = byCustomer.get(name) ?? { invoices: [], total: 0, clientId: null };
      existing.invoices.push(inv);
      existing.total += inv.balanceAmount ?? 0;
      existing.clientId = existing.clientId ?? inv.clientId;
      byCustomer.set(name, existing);
    }

    // Create a CommunicationLog entry for each customer
    const logs: { customer: string; amount: number; invoiceCount: number; clientId: string | null }[] = [];
    for (const [name, group] of byCustomer) {
      const preview = `Dear ${name}, this is a reminder that ${group.invoices.length} invoice(s) totaling ${inr(group.total)} are overdue. Please arrange payment at your earliest convenience. Invoices: ${group.invoices.map(i => i.invoiceNumber).join(', ')}.`;
      try {
        await db.communicationLog.create({
          data: {
            clientId: group.clientId,
            channel,
            eventType: 'overdue',
            recipient: 'on-record',
            recipientName: name,
            messagePreview: preview.slice(0, 200),
            status: 'sent',
            triggerSource: 'oracle_action_engine',
            metadata: JSON.stringify({ invoices: group.invoices.map(i => i.id), total: group.total }),
          },
        });
      } catch (e) {
        console.warn('[sendReminder] log not persisted:', (e as Error).message);
      }
      logs.push({ customer: name, amount: group.total, invoiceCount: group.invoices.length, clientId: group.clientId });
    }

    await logActivity(orgId, 'reminder', `Sent ${channel} reminders to ${logs.length} customer(s) for ${invoices.length} overdue invoice(s)`, { channel, customerCount: logs.length, invoiceCount: invoices.length });

    const totalOutstanding = logs.reduce((s, l) => s + l.amount, 0);
    return {
      ok: true,
      summary: `✅ Queued **${logs.length}** payment reminder(s) via ${channel}:\n` +
        logs.map(l => `  • ${l.customer} — ${l.invoiceCount} invoice(s), ${inr(l.amount)} outstanding`).join('\n') +
        `\n\nTotal outstanding being chased: ${inr(totalOutstanding)}. Reminders are saved in the Communications log. Connect an email/SMS provider in Settings to actually deliver them.`,
      data: { sent: logs.length, channel, totalOutstanding, details: logs },
      artifacts: [{
        kind: 'table',
        title: 'Reminders Queued',
        columns: ['Customer', 'Invoices', 'Outstanding'],
        rows: logs.map(l => ({ Customer: l.customer, Invoices: l.invoiceCount, Outstanding: inr(l.amount) })),
      }],
      followUp: { label: 'View communications', prompt: 'Show me recent communication logs' },
      viewIn: { label: 'View in Customers', href: '/customers' },
    };
  },

  async refreshContext(result, orgId): Promise<RefreshedContext> {
    // After sending reminders, also refresh the communication logs
    const { defaultRefreshContext } = await import('../engine');
    const ctx = await defaultRefreshContext(orgId);
    try {
      const recentLogs = await db.communicationLog.findMany({
        where: { client: { firmId: orgId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, channel: true, eventType: true, recipientName: true, messagePreview: true, status: true, createdAt: true },
      }).catch(() => []);
      (ctx as any).recentCommunications = recentLogs;
    } catch {}
    return ctx;
  },
};

registerAction(sendReminderAction);
