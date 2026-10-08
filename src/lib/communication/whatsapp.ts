// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Communication Cloud™ — WhatsApp Business Cloud™ Engine
// Send invoices, payment reminders, GST reminders, collection notices, reports,
// and bulk campaigns via WhatsApp Business Platform.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WhatsAppMessage, WhatsAppStats, WhatsAppCategory } from './types';
import { getTemplate, renderTemplate, type TemplateDef } from './templates';

// ─── Time helpers ─────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

// ─── Seed data (no-op) ─────────────────────────────────────────────────────────
// Previously this function emitted 14 hardcoded WhatsApp messages attributed
// to fake Indian recipients and fabricated invoice numbers. The export name
// is preserved so existing callers continue to compile, but it now returns
// `[]` so the UI renders a proper empty state. Real WhatsApp messages come
// from `db.whatsAppMessage.findMany()` via the API routes.

export function seedWhatsAppMessages(): WhatsAppMessage[] {
  return [];
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

/** Compute aggregate stats from a list of WhatsApp messages. */
export function getWhatsAppStats(messages: WhatsAppMessage[]): WhatsAppStats {
  const total = messages.length;
  const sent = messages.filter((m) => m.status !== 'queued').length;
  const delivered = messages.filter((m) => m.status === 'delivered' || m.status === 'read').length;
  const read = messages.filter((m) => m.status === 'read').length;
  const failed = messages.filter((m) => m.status === 'failed').length;
  const byCategory: Record<string, number> = {};
  for (const m of messages) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
  }
  return {
    total,
    sent,
    delivered,
    read,
    failed,
    deliveryRate: total > 0 ? round2((delivered / total) * 100) : 0,
    readRate: total > 0 ? round2((read / total) * 100) : 0,
    byCategory,
  };
}

// ─── Message generation ────────────────────────────────────────────────────────

/**
 * Generate a WhatsApp message body for the given type using the template registry.
 * Falls back to a simple inline message if no template matches.
 */
export function generateWhatsAppMessage(
  type: WhatsAppCategory | string,
  data: Record<string, string | number>,
): { body: string; templateName: string | null } {
  const templateMap: Record<string, string> = {
    invoice: 'invoice_reminder_whatsapp',
    reminder: 'invoice_reminder_whatsapp',
    gst_notice: 'gst_filing_reminder_whatsapp',
    collection: 'collection_gentle_whatsapp',
    payslip: 'payslip_whatsapp',
    otp: 'otp_sms', // OTP via WhatsApp uses the same code
  };

  const templateName = templateMap[type];
  const template: TemplateDef | undefined = templateName ? getTemplate(templateName) : undefined;

  if (template) {
    return { body: renderTemplate(template, data), templateName: template.name };
  }

  // Fallback inline message
  return {
    body: `Dear ${data.customer_name ?? 'Customer'},\n\n${data.message ?? 'This is a notification from VEYRO.'}\n\n— ${data.firm_name ?? 'VEYRO'}`,
    templateName: null,
  };
}

/**
 * Render a specific template by name with the provided variables.
 * Returns the rendered message body.
 */
export function formatWhatsAppMessage(
  templateName: string,
  variables: Record<string, string | number>,
): string {
  const template = getTemplate(templateName);
  if (!template) {
    throw new Error(`WhatsApp template "${templateName}" not found`);
  }
  return renderTemplate(template, variables);
}

// ─── Bulk campaigns ────────────────────────────────────────────────────────────

export interface BulkCampaignRecipient {
  recipientPhone: string;
  recipientName: string;
  clientId?: string | null;
  data: Record<string, string | number>;
}

/**
 * Build a list of bulk campaign recipients from overdue invoices.
 * Each recipient gets a personalised collection reminder.
 */
export function bulkCampaignRecipients(
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    buyerName?: string | null;
    balanceAmount: number;
    dueDate?: string | null;
    clientPhone?: string | null;
  }>,
  firmName = 'VEYRO',
): BulkCampaignRecipient[] {
  return invoices
    .filter((inv) => inv.balanceAmount > 0 && inv.clientPhone)
    .map((inv) => {
      const daysOverdue = inv.dueDate
        ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000))
        : 0;
      return {
        recipientPhone: inv.clientPhone!,
        recipientName: inv.buyerName ?? 'Customer',
        clientId: inv.id,
        data: {
          customer_name: inv.buyerName ?? 'Customer',
          invoice_no: inv.invoiceNumber,
          amount: inv.balanceAmount.toLocaleString('en-IN'),
          due_date: inv.dueDate ?? '—',
          days_overdue: daysOverdue,
          firm_name: firmName,
        },
      };
    });
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export { now as _waNow };
