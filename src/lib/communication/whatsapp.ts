// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — WhatsApp Business Cloud™ Engine
// Send invoices, payment reminders, GST reminders, collection notices, reports,
// and bulk campaigns via WhatsApp Business Platform.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WhatsAppMessage, WhatsAppStats, WhatsAppCategory } from './types';
import { getTemplate, renderTemplate, type TemplateDef } from './templates';

// ─── Seed data ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();
const daysAgo = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
};
const daysAhead = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
};

/**
 * Returns 14 realistic Indian business WhatsApp messages covering all categories:
 * invoice, reminder, gst_notice, collection, report, payslip, otp, general.
 */
export function seedWhatsAppMessages(): WhatsAppMessage[] {
  return [
    {
      id: 'wa-seed-001',
      clientId: null,
      recipientName: 'Rajesh Verma',
      recipientPhone: '+91 98765 43210',
      templateName: 'invoice_reminder_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Rajesh Verma,\n\nYour invoice INV-2026-001 for ₹1,18,000 is due on 15 Jan 2026. Kindly arrange the payment at your earliest convenience.\n\n— Verma Industries LLP',
      category: 'reminder',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      readAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: 'wa-seed-002',
      clientId: null,
      recipientName: 'Priya Sharma',
      recipientPhone: '+91 98200 11223',
      templateName: 'collection_gentle_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Priya Sharma,\n\nA gentle reminder that invoice INV-2026-004 for ₹84,000 was due on 28 Dec 2025 (7 days ago). We\'d appreciate your payment at your earliest convenience.\n\n— Sharma & Sons',
      category: 'collection',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: daysAgo(1),
      readAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'wa-seed-003',
      clientId: null,
      recipientName: 'Amit Mehta',
      recipientPhone: '+91 99300 44556',
      templateName: 'gst_filing_reminder_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Amit Mehta,\n\nGSTR-1 for Dec 2025 is due on 11 Jan 2026 (5 days left). I\'ve prepared your return — please approve at your earliest convenience.\n\n— Mehta Traders',
      category: 'gst_notice',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      id: 'wa-seed-004',
      clientId: null,
      recipientName: 'Sunita Patel',
      recipientPhone: '+91 90040 77889',
      templateName: 'payment_received_whatsapp',
      messageType: 'text',
      messageBody: 'Hi Sunita Patel,\n\nI\'ve received your payment of ₹2,50,000 against invoice INV-2026-002. Thank you for the prompt settlement!\n\n— Patel Enterprises',
      category: 'invoice',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(4),
      deliveredAt: daysAgo(4),
      readAt: daysAgo(3),
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
    },
    {
      id: 'wa-seed-005',
      clientId: null,
      recipientName: 'Karthik Iyer',
      recipientPhone: '+91 94440 22110',
      templateName: 'payslip_whatsapp',
      messageType: 'text',
      messageBody: 'Hi Karthik Iyer,\n\nYour salary slip for Dec 2025 is ready. Net pay: ₹78,500.\n\n— GSTPilot HR',
      category: 'payslip',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(5),
      deliveredAt: daysAgo(5),
      readAt: null,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: 'wa-seed-006',
      clientId: null,
      recipientName: 'Deepak Agarwal',
      recipientPhone: '+91 98110 33445',
      templateName: 'collection_gentle_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Deepak Agarwal,\n\nA gentle reminder that invoice INV-2025-088 for ₹1,56,000 was due on 15 Dec 2025 (22 days ago). We\'d appreciate your payment at your earliest convenience.\n\n— Agarwal Supplies',
      category: 'collection',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(6),
      deliveredAt: daysAgo(6),
      readAt: daysAgo(4),
      createdAt: daysAgo(6),
      updatedAt: daysAgo(4),
    },
    {
      id: 'wa-seed-007',
      clientId: null,
      recipientName: 'Fatima Khan',
      recipientPhone: '+91 98990 55667',
      templateName: 'invoice_reminder_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Fatima Khan,\n\nYour invoice INV-2026-006 for ₹92,500 is due on 20 Jan 2026. Kindly arrange the payment at your earliest convenience.\n\n— Khan Exports',
      category: 'reminder',
      status: 'sent',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: null,
      readAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'wa-seed-008',
      clientId: null,
      recipientName: 'Vikram Singh',
      recipientPhone: '+91 99888 99001',
      templateName: 'gst_filing_reminder_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Vikram Singh,\n\nGSTR-3B for Dec 2025 is due on 20 Jan 2026 (14 days left). I\'ve prepared your return — please approve at your earliest convenience.\n\n— Singh Logistics',
      category: 'gst_notice',
      status: 'failed',
      errorMessage: 'Recipient phone not on WhatsApp',
      sentAt: daysAgo(2),
      deliveredAt: null,
      readAt: null,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: 'wa-seed-009',
      clientId: null,
      recipientName: 'Ananya Reddy',
      recipientPhone: '+91 90010 22334',
      templateName: 'payslip_whatsapp',
      messageType: 'document',
      messageBody: 'Hi Ananya Reddy,\n\nYour salary slip for Dec 2025 is ready. Net pay: ₹65,200.\n\n— GSTPilot HR',
      mediaUrl: '/reports/payslip-ananya-dec2025.pdf',
      caption: 'Salary Slip — Dec 2025',
      category: 'payslip',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(5),
      deliveredAt: daysAgo(5),
      readAt: daysAgo(4),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
    {
      id: 'wa-seed-010',
      clientId: null,
      recipientName: 'Rohan Desai',
      recipientPhone: '+91 98250 66778',
      templateName: 'collection_gentle_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Rohan Desai,\n\nA gentle reminder that invoice INV-2025-091 for ₹3,40,000 was due on 10 Dec 2025 (30 days ago). We\'d appreciate your payment at your earliest convenience.\n\n— Desai Manufacturing',
      category: 'collection',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      readAt: null,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'wa-seed-011',
      clientId: null,
      recipientName: 'Meera Joshi',
      recipientPhone: '+91 99220 88990',
      templateName: 'invoice_reminder_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Meera Joshi,\n\nYour invoice INV-2026-007 for ₹47,500 is due on 25 Jan 2026. Kindly arrange the payment at your earliest convenience.\n\n— Joshi Consulting',
      category: 'reminder',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      readAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: 'wa-seed-012',
      clientId: null,
      recipientName: 'Arjun Nair',
      recipientPhone: '+91 94470 11223',
      templateName: 'payment_received_whatsapp',
      messageType: 'text',
      messageBody: 'Hi Arjun Nair,\n\nI\'ve received your payment of ₹1,12,000 against invoice INV-2026-003. Thank you for the prompt settlement!\n\n— Nair Tech Solutions',
      category: 'invoice',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: daysAgo(1),
      readAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'wa-seed-013',
      clientId: null,
      recipientName: 'Pooja Bhat',
      recipientPhone: '+91 98450 33445',
      templateName: 'gst_filing_reminder_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Pooja Bhat,\n\nGSTR-1 for Dec 2025 is due on 11 Jan 2026 (5 days left). I\'ve prepared your return — please approve at your earliest convenience.\n\n— Bhat & Associates',
      category: 'gst_notice',
      status: 'read',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      id: 'wa-seed-014',
      clientId: null,
      recipientName: 'Sai Krishna',
      recipientPhone: '+91 99660 77889',
      templateName: 'collection_gentle_whatsapp',
      messageType: 'text',
      messageBody: 'Dear Sai Krishna,\n\nA gentle reminder that invoice INV-2025-094 for ₹78,000 was due on 05 Dec 2025 (35 days ago). We\'d appreciate your payment at your earliest convenience.\n\n— Krishna Traders',
      category: 'collection',
      status: 'failed',
      errorMessage: 'WhatsApp Business API rate limit exceeded',
      sentAt: daysAgo(1),
      deliveredAt: null,
      readAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ];
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
    body: `Dear ${data.customer_name ?? 'Customer'},\n\n${data.message ?? 'This is a notification from GSTPilot.'}\n\n— ${data.firm_name ?? 'GSTPilot'}`,
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
  firmName = 'GSTPilot',
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
