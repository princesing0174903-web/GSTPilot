// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — Email Cloud™ Engine
// Invoice emails, GST notices, collection reminders, reports, forecast reports,
// and payroll slips. Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { EmailMessage, EmailStats, EmailCategory } from './types';
import { getTemplate, renderEmailTemplate, type TemplateDef } from './templates';

// ─── Seed data ─────────────────────────────────────────────────────────────────

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
 * Returns 14 realistic Indian business emails covering all categories:
 * invoice, gst_notice, collection, report, payslip, forecast, general.
 */
export function seedEmailMessages(): EmailMessage[] {
  return [
    {
      id: 'em-seed-001',
      clientId: null,
      recipientName: 'Rajesh Verma',
      recipientEmail: 'rajesh@vermaindustries.in',
      templateName: 'collection_firm_email',
      subject: 'Payment Overdue — Invoice INV-2026-001 (7 days)',
      bodyHtml: '<p>Dear Rajesh Verma,</p><p>This is a firm reminder that invoice <strong>INV-2026-001</strong> for <strong>₹1,18,000</strong> is now <strong>7 days overdue</strong>.</p><p>We request you to process the payment immediately.</p><p>Best regards,<br/>Verma Industries LLP</p>',
      bodyText: 'Dear Rajesh Verma, This is a firm reminder that invoice INV-2026-001 for ₹1,18,000 is now 7 days overdue.',
      category: 'collection',
      attachments: null,
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      openedAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: 'em-seed-002',
      clientId: null,
      recipientName: 'Priya Sharma',
      recipientEmail: 'priya@sharmasons.com',
      templateName: 'gst_summary_report_email',
      subject: 'Monthly GST Summary — Dec 2025',
      bodyHtml: '<p>Dear Priya Sharma,</p><p>Please find attached your <strong>Monthly GST Summary</strong> for <strong>Dec 2025</strong>.</p><p>Net GST Payable: ₹2,84,500</p>',
      bodyText: 'Monthly GST Summary for Dec 2025. Net GST Payable: ₹2,84,500.',
      category: 'report',
      attachments: '["/reports/gst-summary-dec2025.pdf"]',
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      openedAt: daysAgo(2),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      id: 'em-seed-003',
      clientId: null,
      recipientName: 'Karthik Iyer',
      recipientEmail: 'karthik@iyerassociates.in',
      templateName: 'payslip_email',
      subject: 'Salary Slip — Dec 2025 — GSTPilot',
      bodyHtml: '<p>Dear Karthik Iyer,</p><p>Your salary slip for <strong>Dec 2025</strong> is ready. Net Pay: ₹78,500.</p>',
      bodyText: 'Salary slip for Dec 2025. Net Pay: ₹78,500.',
      category: 'payslip',
      attachments: '["/reports/payslip-karthik-dec2025.pdf"]',
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(5),
      deliveredAt: daysAgo(5),
      openedAt: daysAgo(4),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
    {
      id: 'em-seed-004',
      clientId: null,
      recipientName: 'Amit Mehta',
      recipientEmail: 'amit@mehtatraders.in',
      templateName: 'gst_filing_reminder_email',
      subject: 'GSTR-1 for Dec 2025 — Due 11 Jan 2026',
      bodyHtml: '<p>Dear Amit Mehta,</p><p>GSTR-1 for Dec 2025 is due on 11 Jan 2026 (5 days left). Net Payable: ₹1,42,000.</p>',
      bodyText: 'GSTR-1 for Dec 2025 due 11 Jan 2026. Net Payable: ₹1,42,000.',
      category: 'gst_notice',
      attachments: null,
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(4),
      deliveredAt: daysAgo(4),
      openedAt: daysAgo(3),
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
    },
    {
      id: 'em-seed-005',
      clientId: null,
      recipientName: 'Sunita Patel',
      recipientEmail: 'sunita@patelent.in',
      templateName: 'cash_flow_report_email',
      subject: 'Cash Flow Forecast — Next 30 Days',
      bodyHtml: '<p>Dear Sunita Patel,</p><p>Projected Inflow: ₹14.2L, Outflow: ₹9.1L, Net: ₹5.1L surplus, Runway: 180 days.</p>',
      bodyText: 'Cash Flow Forecast. Inflow ₹14.2L, Outflow ₹9.1L, Surplus ₹5.1L.',
      category: 'forecast',
      attachments: '["/reports/cashflow-forecast.pdf"]',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: daysAgo(1),
      openedAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'em-seed-006',
      clientId: null,
      recipientName: 'Deepak Agarwal',
      recipientEmail: 'deepak@agarwalsupplies.in',
      templateName: 'collection_final_email',
      subject: 'FINAL NOTICE — Invoice INV-2025-088 — Escalation Pending',
      bodyHtml: '<p>Dear Deepak Agarwal,</p><p>This is the <strong>final notice</strong> regarding invoice <strong>INV-2025-088</strong> for <strong>₹1,56,000</strong>, now <strong>22 days overdue</strong>.</p>',
      bodyText: 'FINAL NOTICE: Invoice INV-2025-088 ₹1,56,000, 22 days overdue.',
      category: 'collection',
      attachments: null,
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      openedAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: 'em-seed-007',
      clientId: null,
      recipientName: 'Fatima Khan',
      recipientEmail: 'fatima@khanexports.in',
      templateName: 'invoice_reminder_email',
      subject: 'Invoice INV-2026-006 — ₹92,500 due 20 Jan 2026',
      bodyHtml: '<p>Dear Fatima Khan,</p><p>Invoice <strong>INV-2026-006</strong> for <strong>₹92,500</strong>, due on <strong>20 Jan 2026</strong>.</p>',
      bodyText: 'Invoice INV-2026-006 for ₹92,500 due 20 Jan 2026.',
      category: 'invoice',
      attachments: '["/invoices/INV-2026-006.pdf"]',
      status: 'sent',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: null,
      openedAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'em-seed-008',
      clientId: null,
      recipientName: 'Vikram Singh',
      recipientEmail: 'vikram@singhlogistics.in',
      templateName: 'receivables_report_email',
      subject: 'Receivables Aging Report — Dec 2025',
      bodyHtml: '<p>Dear Vikram Singh,</p><p>Outstanding: ₹18.2L, Overdue: ₹4.6L, Collection Rate: 74%, DSO: 47 days.</p>',
      bodyText: 'Receivables Report. Outstanding ₹18.2L, Overdue ₹4.6L.',
      category: 'report',
      attachments: '["/reports/receivables-dec2025.pdf"]',
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      openedAt: daysAgo(2),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      id: 'em-seed-009',
      clientId: null,
      recipientName: 'Ananya Reddy',
      recipientEmail: 'ananya@reddytech.in',
      templateName: 'payslip_email',
      subject: 'Salary Slip — Dec 2025 — GSTPilot',
      bodyHtml: '<p>Dear Ananya Reddy,</p><p>Net Pay: ₹65,200 for Dec 2025.</p>',
      bodyText: 'Salary slip Dec 2025. Net Pay: ₹65,200.',
      category: 'payslip',
      attachments: '["/reports/payslip-ananya-dec2025.pdf"]',
      status: 'bounced',
      errorMessage: 'Recipient mailbox full',
      sentAt: daysAgo(5),
      deliveredAt: null,
      openedAt: null,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: 'em-seed-010',
      clientId: null,
      recipientName: 'Rohan Desai',
      recipientEmail: 'rohan@desaimfg.in',
      templateName: 'collection_firm_email',
      subject: 'Payment Overdue — Invoice INV-2025-091 (30 days)',
      bodyHtml: '<p>Dear Rohan Desai,</p><p>Invoice <strong>INV-2025-091</strong> for <strong>₹3,40,000</strong> is now <strong>30 days overdue</strong>.</p>',
      bodyText: 'Invoice INV-2025-091 ₹3,40,000, 30 days overdue.',
      category: 'collection',
      attachments: null,
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      openedAt: daysAgo(2),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      id: 'em-seed-011',
      clientId: null,
      recipientName: 'Meera Joshi',
      recipientEmail: 'meera@joshiconsulting.in',
      templateName: 'ai_cfo_report_email',
      subject: 'AI CFO Monthly Briefing — Dec 2025',
      bodyHtml: '<p>Dear Meera Joshi,</p><p>Revenue: ₹42L, Net Profit: ₹8.4L, Cash: ₹15.2L, Health Score: 78/100.</p>',
      bodyText: 'AI CFO Briefing Dec 2025. Revenue ₹42L, Health 78/100.',
      category: 'report',
      attachments: '["/reports/ai-cfo-dec2025.pdf"]',
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      openedAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      id: 'em-seed-012',
      clientId: null,
      recipientName: 'Arjun Nair',
      recipientEmail: 'arjun@nairtech.in',
      templateName: 'payment_confirmation_email',
      subject: 'Payment Received — ₹1,12,000 against INV-2026-003',
      bodyHtml: '<p>Dear Arjun Nair,</p><p>I\'ve received your payment of ₹1,12,000 against invoice INV-2026-003.</p>',
      bodyText: 'Payment received ₹1,12,000 against INV-2026-003.',
      category: 'invoice',
      attachments: null,
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: daysAgo(1),
      openedAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'em-seed-013',
      clientId: null,
      recipientName: 'Pooja Bhat',
      recipientEmail: 'pooja@bhatassociates.in',
      templateName: 'tds_report_email',
      subject: 'TDS Quarterly Report — Q3 FY26',
      bodyHtml: '<p>Dear Pooja Bhat,</p><p>Total TDS Deducted: ₹84,000, Paid: ₹84,000, Pending: ₹0.</p>',
      bodyText: 'TDS Q3 FY26. Total ₹84,000, Paid ₹84,000.',
      category: 'report',
      attachments: '["/reports/tds-q3-fy26.pdf"]',
      status: 'opened',
      errorMessage: null,
      sentAt: daysAgo(4),
      deliveredAt: daysAgo(4),
      openedAt: daysAgo(3),
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
    },
    {
      id: 'em-seed-014',
      clientId: null,
      recipientName: 'Sai Krishna',
      recipientEmail: 'sai@krishnatraders.in',
      templateName: 'payroll_report_email',
      subject: 'Payroll Summary — Dec 2025',
      bodyHtml: '<p>Dear Sai Krishna,</p><p>Employees: 8, Gross: ₹6.4L, Net: ₹5.2L, Deductions: ₹1.2L.</p>',
      bodyText: 'Payroll Dec 2025. 8 employees, Gross ₹6.4L, Net ₹5.2L.',
      category: 'report',
      attachments: '["/reports/payroll-dec2025.pdf"]',
      status: 'failed',
      errorMessage: 'SMTP connection timeout',
      sentAt: daysAgo(2),
      deliveredAt: null,
      openedAt: null,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ];
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

/** Compute aggregate stats from a list of email messages. */
export function getEmailStats(messages: EmailMessage[]): EmailStats {
  const total = messages.length;
  const sent = messages.filter((m) => m.status !== 'queued').length;
  const opened = messages.filter((m) => m.status === 'opened').length;
  const failed = messages.filter((m) => m.status === 'failed').length;
  const bounced = messages.filter((m) => m.status === 'bounced').length;
  const byCategory: Record<string, number> = {};
  for (const m of messages) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
  }
  return {
    total,
    sent,
    opened,
    failed,
    bounced,
    openRate: total > 0 ? round2((opened / total) * 100) : 0,
    byCategory,
  };
}

// ─── Email rendering ───────────────────────────────────────────────────────────

/**
 * Wrap body content in a premium dark HTML email template with GSTPilot branding.
 * The template is responsive and works across all major email clients.
 */
export function renderEmailHtml(subject: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a1a,#0a0a0a);padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <table width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://gstpilot.in/brand/gstpilot-icon-transparent.png" width="40" height="40" alt="GSTPilot" style="vertical-align:middle;margin-right:12px;border-radius:8px;" />
                    <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.02em;vertical-align:middle;">GSTPilot<span style="color:#3B82F6;"> Infinity™</span></span>
                    <br/><span style="font-size:11px;color:rgba(255,255,255,0.5);margin-left:52px;">The Financial Brain of India</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:rgba(255,255,255,0.85);font-size:14px;line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);background:#0d0d0d;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.5;">
                This email was sent by GSTPilot Infinity™ — your AI CFO & COO.<br/>
                © ${new Date().getFullYear()} GSTPilot. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Generate an email subject line for the given category and data. */
export function generateEmailSubject(
  type: EmailCategory | string,
  data: Record<string, string | number>,
): string {
  const templateMap: Record<string, string> = {
    invoice: 'invoice_reminder_email',
    gst_notice: 'gst_filing_reminder_email',
    collection: 'collection_firm_email',
    report: 'gst_summary_report_email',
    payslip: 'payslip_email',
    forecast: 'cash_flow_report_email',
  };
  const templateName = templateMap[type];
  const template: TemplateDef | undefined = templateName ? getTemplate(templateName) : undefined;
  if (template?.subject) {
    let subject = template.subject;
    for (const [key, value] of Object.entries(data)) {
      subject = subject.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value));
    }
    return subject;
  }
  return `GSTPilot Notification — ${type}`;
}

/**
 * Render an email template (both subject and body) with the provided variables.
 * Returns { subject, body } where body is wrapped in the premium HTML template.
 */
export function formatEmailBody(
  templateName: string,
  variables: Record<string, string | number>,
): { subject: string; bodyHtml: string; bodyText: string } {
  const template = getTemplate(templateName);
  if (!template) {
    throw new Error(`Email template "${templateName}" not found`);
  }
  const { subject, body } = renderEmailTemplate(template, variables);
  const bodyText = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    subject,
    bodyHtml: renderEmailHtml(subject, body),
    bodyText,
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
