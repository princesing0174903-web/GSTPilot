// ═══════════════════════════════════════════════════════════════════════════════
// Action: Send Invoice
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/invoices.ts → sendInvoice)
// so the send performs the EXACT same Prisma write (sentToCustomer=true,
// status=issued) + audit log + timeline event + activity log as a UI-driven
// send.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { sendInvoice as sendInvoiceService } from '@/lib/services';
import {
  registerAction,
  inr,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_CHANNELS = ['email', 'whatsapp', 'sms'];

export const sendInvoiceAction: OracleAction = {
  name: 'sendInvoice',
  displayName: 'Send Invoice',
  description: 'Mark an invoice as sent to the customer (email / WhatsApp / SMS) and record the delivery channel.',
  category: 'communication',
  icon: 'Send',
  intentKeywords: [
    'send invoice', 'email invoice', 'share invoice', 'deliver invoice', 'send bill',
  ],
  paramSchema: [
    { key: 'id', label: 'Invoice ID', type: 'string', required: false, description: 'Invoice id' },
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'string', required: false, description: 'e.g. INV-2024-001 — resolved to id if id is omitted' },
    { key: 'channel', label: 'Channel', type: 'enum', required: false, options: VALID_CHANNELS, description: 'Default: email' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    const invoiceNumber = String(args.invoiceNumber ?? '').trim();

    let invoice: { id: string; invoiceNumber: string; totalAmount: number; buyerName: string | null; client: { tradeName: string | null; contactEmail: string | null } | null } | null = null;

    if (id) {
      invoice = await db.invoice.findFirst({
        where: { id, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true, client: { select: { tradeName: true, contactEmail: true } } },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`Invoice "${id}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'id', label: 'Invoice ID', status: 'ok', message: 'Found', resolvedValue: invoice.invoiceNumber });
      }
    } else if (invoiceNumber) {
      invoice = await db.invoice.findFirst({
        where: { invoiceNumber, client: { firmId: orgId } },
        select: { id: true, invoiceNumber: true, totalAmount: true, buyerName: true, client: { select: { tradeName: true, contactEmail: true } } },
      }).catch(() => null);
      if (!invoice) {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'error', message: 'Invoice not found in your tenant' });
        errors.push(`No invoice "${invoiceNumber}" was found in your tenant.`);
      } else {
        fields.push({ key: 'invoiceNumber', label: 'Invoice Number', status: 'ok', message: 'Resolved', resolvedValue: `${invoice.invoiceNumber} (${invoice.id})` });
      }
    } else {
      fields.push({ key: 'id', label: 'Invoice ID', status: 'error', message: 'Either id or invoiceNumber is required' });
      errors.push('Provide either the invoice id or invoice number to send.');
    }

    if (invoice) {
      resolvedRefs.invoiceId = invoice.id;
      resolvedRefs.invoiceNumber = invoice.invoiceNumber;
      resolvedRefs.invoiceTotal = invoice.totalAmount ?? 0;
      resolvedRefs.customerName = invoice.client?.tradeName ?? invoice.buyerName ?? 'customer';
      resolvedRefs.customerEmail = invoice.client?.contactEmail ?? null;

      if (!resolvedRefs.customerEmail) {
        fields.push({ key: 'recipient', label: 'Recipient Email', status: 'warn', message: 'Customer has no email on file', resolvedValue: '(no email)' });
        warnings.push(`Customer "${resolvedRefs.customerName}" has no email on file — the invoice will be marked sent, but no email can be delivered. Update the customer record or pick a different channel.`);
      } else {
        fields.push({ key: 'recipient', label: 'Recipient Email', status: 'ok', resolvedValue: resolvedRefs.customerEmail });
      }
    }

    // Channel
    const channel = String(args.channel ?? 'email');
    if (!VALID_CHANNELS.includes(channel)) {
      fields.push({ key: 'channel', label: 'Channel', status: 'warn', message: 'Unknown channel — defaulting to email', resolvedValue: channel });
      warnings.push(`Unknown channel "${channel}" — defaulting to email.`);
      resolvedRefs.channel = 'email';
    } else {
      fields.push({ key: 'channel', label: 'Channel', status: 'ok', resolvedValue: channel });
      resolvedRefs.channel = channel;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const invoiceNumber = refs.invoiceNumber ?? String(args.invoiceNumber ?? args.id ?? '—');
    const customerName = refs.customerName ?? '—';
    const email = refs.customerEmail ?? '—';
    const channel = refs.channel ?? String(args.channel ?? 'email');
    const total = Number(refs.invoiceTotal ?? 0);
    return {
      title: `Send invoice ${invoiceNumber} via ${channel}`,
      fields: [
        { label: 'Invoice', value: invoiceNumber, emphasize: true },
        { label: 'Customer', value: customerName },
        { label: 'Amount', value: inr(total) },
        { label: 'Channel', value: channel },
        { label: 'Recipient', value: email },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    let id = String(args.id ?? '').trim();
    if (!id) {
      const invoiceNumber = String(args.invoiceNumber ?? '').trim();
      if (invoiceNumber) {
        const found = await db.invoice.findFirst({
          where: { invoiceNumber, client: { firmId: orgId } },
          select: { id: true },
        }).catch(() => null);
        if (found) id = found.id;
      }
    }
    if (!id) {
      return { ok: false, summary: 'Failed to send invoice — could not resolve the invoice. Provide the id or invoice number.' };
    }

    const channelArg = String(args.channel ?? 'email');
    const channel = (VALID_CHANNELS.includes(channelArg) ? channelArg : 'email') as 'email' | 'whatsapp' | 'sms';

    // Look up the recipient for the summary message.
    const inv = await db.invoice.findUnique({
      where: { id },
      select: { invoiceNumber: true, client: { select: { tradeName: true, contactEmail: true } } },
    }).catch(() => null);
    const recipientName = inv?.client?.tradeName ?? 'customer';
    const recipientEmail = inv?.client?.contactEmail ?? null;

    const result = await sendInvoiceService(
      orgId,
      id,
      channel,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to send invoice. ${result.error ?? 'Database error.'}` };
    }

    const sent = result.data;
    const recipientLabel = channel === 'email' ? (recipientEmail ?? recipientName) : recipientName;
    return {
      ok: true,
      summary: `✅ Sent invoice **${sent.invoiceNumber}** to ${recipientLabel} via ${channel}.`,
      data: { id: sent.id, invoiceNumber: sent.invoiceNumber, channel, sentToCustomer: sent.sentToCustomer, status: sent.status },
      viewIn: { label: 'View in Invoices', href: '/invoices' },
    };
  },
};

registerAction(sendInvoiceAction);
