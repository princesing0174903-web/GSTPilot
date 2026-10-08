// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Communication Cloud™ — Template Registry
// All WhatsApp / Email / SMS templates with {{variable}} placeholders.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CommunicationChannel } from './types';

// ─── Template definition ───────────────────────────────────────────────────────

export interface TemplateDef {
  name: string;
  channel: CommunicationChannel;
  category: string;
  subject?: string; // email only
  body: string;
  variables: string[]; // variable names without braces
}

// ─── Master registry ───────────────────────────────────────────────────────────

export const COMMUNICATION_TEMPLATES: TemplateDef[] = [
  // ═══ WhatsApp — Invoice & Payment ═══
  {
    name: 'invoice_reminder_whatsapp',
    channel: 'whatsapp',
    category: 'reminder',
    body: `Dear {{customer_name}},\n\nYour invoice {{invoice_no}} for ₹{{amount}} is due on {{due_date}}. Kindly arrange the payment at your earliest convenience.\n\nView invoice: {{invoice_url}}\n\n— {{firm_name}}`,
    variables: ['customer_name', 'invoice_no', 'amount', 'due_date', 'invoice_url', 'firm_name'],
  },
  {
    name: 'payment_received_whatsapp',
    channel: 'whatsapp',
    category: 'invoice',
    body: `Hi {{customer_name}},\n\nI've received your payment of ₹{{amount}} against invoice {{invoice_no}}. Thank you for the prompt settlement!\n\nReceipt: {{receipt_url}}\n\n— {{firm_name}}`,
    variables: ['customer_name', 'amount', 'invoice_no', 'receipt_url', 'firm_name'],
  },
  {
    name: 'payslip_whatsapp',
    channel: 'whatsapp',
    category: 'payslip',
    body: `Hi {{employee_name}},\n\nYour salary slip for {{period}} is ready. Net pay: ₹{{net_salary}}.\n\nPayslip: {{payslip_url}}\n\n— {{firm_name}} HR`,
    variables: ['employee_name', 'period', 'net_salary', 'payslip_url', 'firm_name'],
  },

  // ═══ WhatsApp — GST & Compliance ═══
  {
    name: 'gst_filing_reminder_whatsapp',
    channel: 'whatsapp',
    category: 'gst_notice',
    body: `Dear {{customer_name}},\n\nGSTR-{{return_type}} for {{period}} is due on {{due_date}} ({{days_left}} days left). I've prepared your return — please approve at your earliest convenience.\n\n— {{firm_name}}`,
    variables: ['customer_name', 'return_type', 'period', 'due_date', 'days_left', 'firm_name'],
  },

  // ═══ WhatsApp — Collection Recovery ═══
  {
    name: 'collection_gentle_whatsapp',
    channel: 'whatsapp',
    category: 'collection',
    body: `Dear {{customer_name}},\n\nA gentle reminder that invoice {{invoice_no}} for ₹{{amount}} was due on {{due_date}} ({{days_overdue}} days ago). We'd appreciate your payment at your earliest convenience.\n\n— {{firm_name}}`,
    variables: ['customer_name', 'invoice_no', 'amount', 'due_date', 'days_overdue', 'firm_name'],
  },

  // ═══ Email — Invoice & Payment ═══
  {
    name: 'invoice_reminder_email',
    channel: 'email',
    category: 'invoice',
    subject: 'Invoice {{invoice_no}} — ₹{{amount}} due {{due_date}}',
    body: `<p>Dear {{customer_name}},</p><p>Thank you for your business. Please find attached invoice <strong>{{invoice_no}}</strong> for <strong>₹{{amount}}</strong>, due on <strong>{{due_date}}</strong>.</p><p>You can view and download the invoice here: <a href="{{invoice_url}}">{{invoice_url}}</a></p><p>For any queries, feel free to reply to this email.</p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['customer_name', 'invoice_no', 'amount', 'due_date', 'invoice_url', 'firm_name'],
  },
  {
    name: 'payment_confirmation_email',
    channel: 'email',
    category: 'invoice',
    subject: 'Payment Received — ₹{{amount}} against {{invoice_no}}',
    body: `<p>Dear {{customer_name}},</p><p>I've received your payment of <strong>₹{{amount}}</strong> against invoice <strong>{{invoice_no}}</strong>. The payment has been reconciled and your account is now settled.</p><p>Receipt: <a href="{{receipt_url}}">{{receipt_url}}</a></p><p>Thank you for your prompt payment.</p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['customer_name', 'amount', 'invoice_no', 'receipt_url', 'firm_name'],
  },

  // ═══ Email — GST Notices ═══
  {
    name: 'gst_filing_reminder_email',
    channel: 'email',
    category: 'gst_notice',
    subject: 'GSTR-{{return_type}} for {{period}} — Due {{due_date}}',
    body: `<p>Dear {{customer_name}},</p><p>This is to inform you that your <strong>GSTR-{{return_type}}</strong> return for the period <strong>{{period}}</strong> is due on <strong>{{due_date}}</strong> ({{days_left}} days remaining).</p><p>I've prepared your return based on your sales and purchase data. Please review and approve at your earliest convenience to avoid late fees of ₹50/day.</p><p><strong>GST Liability:</strong> ₹{{liability}}<br/><strong>ITC Available:</strong> ₹{{itc}}<br/><strong>Net Payable:</strong> ₹{{net_payable}}</p><p>Review and file: <a href="{{filing_url}}">{{filing_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['customer_name', 'return_type', 'period', 'due_date', 'days_left', 'liability', 'itc', 'net_payable', 'filing_url', 'firm_name'],
  },

  // ═══ Email — Collection Recovery ═══
  {
    name: 'collection_firm_email',
    channel: 'email',
    category: 'collection',
    subject: 'Payment Overdue — Invoice {{invoice_no}} ({{days_overdue}} days)',
    body: `<p>Dear {{customer_name}},</p><p>This is a firm reminder that invoice <strong>{{invoice_no}}</strong> for <strong>₹{{amount}}</strong> is now <strong>{{days_overdue}} days overdue</strong> (original due date: {{due_date}}).</p><p>We request you to process the payment immediately to avoid further escalation. If the payment has already been made, please share the UTR/reference number so we can reconcile.</p><p>Pay now: <a href="{{payment_url}}">{{payment_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['customer_name', 'invoice_no', 'amount', 'days_overdue', 'due_date', 'payment_url', 'firm_name'],
  },
  {
    name: 'collection_final_email',
    channel: 'email',
    category: 'collection',
    subject: 'FINAL NOTICE — Invoice {{invoice_no}} — Escalation Pending',
    body: `<p>Dear {{customer_name}},</p><p>This is the <strong>final notice</strong> regarding invoice <strong>{{invoice_no}}</strong> for <strong>₹{{amount}}</strong>, now <strong>{{days_overdue}} days overdue</strong>.</p><p>Despite previous reminders, the payment remains outstanding. If the payment is not received within <strong>7 days</strong>, we will be compelled to escalate this matter to our management and consider legal recovery options.</p><p>Please treat this as urgent. Contact us immediately at {{contact_phone}} to discuss payment arrangements.</p><p>Best regards,<br/>{{firm_name}}<br/>Collections Department</p>`,
    variables: ['customer_name', 'invoice_no', 'amount', 'days_overdue', 'contact_phone', 'firm_name'],
  },

  // ═══ SMS — Alerts & OTP ═══
  {
    name: 'otp_sms',
    channel: 'sms',
    category: 'otp',
    body: '{{otp}} is your VEYRO verification code. Valid for 10 minutes. Do not share with anyone. — VEYRO',
    variables: ['otp'],
  },
  {
    name: 'gst_filing_reminder_sms',
    channel: 'sms',
    category: 'gst_alert',
    body: 'VEYRO: GSTR-{{return_type}} for {{period}} due {{due_date}} ({{days_left}}d left). Reply STOP to opt out.',
    variables: ['return_type', 'period', 'due_date', 'days_left'],
  },
  {
    name: 'payment_reminder_sms',
    channel: 'sms',
    category: 'payment_reminder',
    body: 'VEYRO: Invoice {{invoice_no}} for Rs.{{amount}} due {{due_date}}. Please process payment. — {{firm_name}}',
    variables: ['invoice_no', 'amount', 'due_date', 'firm_name'],
  },
  {
    name: 'due_date_alert_sms',
    channel: 'sms',
    category: 'due_date',
    body: 'VEYRO ALERT: Invoice {{invoice_no}} (Rs.{{amount}}) is {{days_overdue}}d overdue. Immediate payment needed. — {{firm_name}}',
    variables: ['invoice_no', 'amount', 'days_overdue', 'firm_name'],
  },
  {
    name: 'collection_escalation_sms',
    channel: 'sms',
    category: 'collection',
    body: 'VEYRO ESCALATION: {{customer_name}} invoice {{invoice_no}} (Rs.{{amount}}) {{days_overdue}}d overdue. Manager notified. Recovery action initiated.',
    variables: ['customer_name', 'invoice_no', 'amount', 'days_overdue'],
  },

  // ═══ Email — Payslip & Payroll ═══
  {
    name: 'payslip_email',
    channel: 'email',
    category: 'payslip',
    subject: 'Salary Slip — {{period}} — {{firm_name}}',
    body: `<p>Dear {{employee_name}},</p><p>Your salary slip for <strong>{{period}}</strong> is ready.</p><p><strong>Gross Salary:</strong> ₹{{gross_salary}}<br/><strong>PF Deduction:</strong> ₹{{pf}}<br/><strong>TDS:</strong> ₹{{tds}}<br/><strong>Net Pay:</strong> ₹{{net_salary}}</p><p>Download your payslip: <a href="{{payslip_url}}">{{payslip_url}}</a></p><p>Best regards,<br/>{{firm_name}} HR</p>`,
    variables: ['employee_name', 'period', 'gross_salary', 'pf', 'tds', 'net_salary', 'payslip_url', 'firm_name'],
  },

  // ═══ Email — Report Distribution ═══
  {
    name: 'gst_summary_report_email',
    channel: 'email',
    category: 'report',
    subject: 'Monthly GST Summary — {{period}}',
    body: `<p>Dear {{recipient_name}},</p><p>Please find attached your <strong>Monthly GST Summary</strong> for <strong>{{period}}</strong>.</p><p><strong>Highlights:</strong></p><ul><li>Total Output GST: ₹{{output_gst}}</li><li>Total Input Tax Credit: ₹{{input_gst}}</li><li>Net GST Payable: ₹{{net_payable}}</li><li>Returns Filed: {{returns_filed}}</li></ul><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['recipient_name', 'period', 'output_gst', 'input_gst', 'net_payable', 'returns_filed', 'report_url', 'firm_name'],
  },
  {
    name: 'cash_flow_report_email',
    channel: 'email',
    category: 'report',
    subject: 'Cash Flow Forecast — Next 30 Days',
    body: `<p>Dear {{recipient_name}},</p><p>I've prepared your <strong>Cash Flow Forecast</strong> for the next 30 days.</p><p><strong>Projected Inflow:</strong> ₹{{inflow}}<br/><strong>Projected Outflow:</strong> ₹{{outflow}}<br/><strong>Net Position:</strong> ₹{{net_position}}<br/><strong>Runway:</strong> {{runway}} days</p><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['recipient_name', 'inflow', 'outflow', 'net_position', 'runway', 'report_url', 'firm_name'],
  },
  {
    name: 'receivables_report_email',
    channel: 'email',
    category: 'report',
    subject: 'Receivables Aging Report — {{period}}',
    body: `<p>Dear {{recipient_name}},</p><p>Please find your <strong>Receivables Aging Report</strong> for <strong>{{period}}</strong>.</p><p><strong>Summary:</strong></p><ul><li>Total Outstanding: ₹{{outstanding}}</li><li>Overdue: ₹{{overdue}}</li><li>Collection Rate: {{collection_rate}}%</li><li>Avg Days to Pay: {{dso}} days</li></ul><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['recipient_name', 'period', 'outstanding', 'overdue', 'collection_rate', 'dso', 'report_url', 'firm_name'],
  },
  {
    name: 'payables_report_email',
    channel: 'email',
    category: 'report',
    subject: 'Payables & Vendor Dues Report — {{period}}',
    body: `<p>Dear {{recipient_name}},</p><p>Please find your <strong>Payables Report</strong> for <strong>{{period}}</strong>.</p><p><strong>Summary:</strong></p><ul><li>Total Payable: ₹{{total_payable}}</li><li>Due This Week: ₹{{due_this_week}}</li><li>Overdue to Vendors: ₹{{overdue}}</li></ul><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['recipient_name', 'period', 'total_payable', 'due_this_week', 'overdue', 'report_url', 'firm_name'],
  },
  {
    name: 'tds_report_email',
    channel: 'email',
    category: 'report',
    subject: 'TDS Quarterly Report — {{quarter}}',
    body: `<p>Dear {{recipient_name}},</p><p>Please find your <strong>TDS Report</strong> for <strong>{{quarter}}</strong>.</p><p><strong>Summary:</strong></p><ul><li>Total TDS Deducted: ₹{{total_tds}}</li><li>TDS Paid: ₹{{paid}}</li><li>Pending Deposit: ₹{{pending}}</li></ul><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>{{firm_name}}</p>`,
    variables: ['recipient_name', 'quarter', 'total_tds', 'paid', 'pending', 'report_url', 'firm_name'],
  },
  {
    name: 'payroll_report_email',
    channel: 'email',
    category: 'report',
    subject: 'Payroll Summary — {{period}}',
    body: `<p>Dear {{recipient_name}},</p><p>Please find your <strong>Payroll Summary</strong> for <strong>{{period}}</strong>.</p><p><strong>Summary:</strong></p><ul><li>Employees: {{employee_count}}</li><li>Gross Payroll: ₹{{gross}}</li><li>Net Payroll: ₹{{net}}</li><li>PF + ESI + TDS: ₹{{deductions}}</li></ul><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>{{firm_name}} HR</p>`,
    variables: ['recipient_name', 'period', 'employee_count', 'gross', 'net', 'deductions', 'report_url', 'firm_name'],
  },
  {
    name: 'ai_cfo_report_email',
    channel: 'email',
    category: 'report',
    subject: 'AI CFO Monthly Briefing — {{period}}',
    body: `<p>Dear {{recipient_name}},</p><p>I've prepared your <strong>AI CFO Monthly Briefing</strong> for <strong>{{period}}</strong>.</p><p><strong>Executive Summary:</strong> {{executive_summary}}</p><p><strong>Key Metrics:</strong></p><ul><li>Revenue: ₹{{revenue}}</li><li>Net Profit: ₹{{profit}}</li><li>Cash Position: ₹{{cash}}</li><li>Health Score: {{health_score}}/100</li></ul><p><strong>Top Risks:</strong></p><ul>{{top_risks}}</ul><p><strong>Recommendations:</strong></p><ol>{{recommendations}}</ol><p>Full report: <a href="{{report_url}}">{{report_url}}</a></p><p>Best regards,<br/>VEYRO AI™ — Your AI CFO</p>`,
    variables: ['recipient_name', 'period', 'executive_summary', 'revenue', 'profit', 'cash', 'health_score', 'top_risks', 'recommendations', 'report_url'],
  },
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────

/** Get a template by its unique name. Returns undefined if not found. */
export function getTemplate(name: string): TemplateDef | undefined {
  return COMMUNICATION_TEMPLATES.find((t) => t.name === name);
}

/** Filter templates by channel (whatsapp | email | sms). */
export function getTemplatesByChannel(channel: CommunicationChannel): TemplateDef[] {
  return COMMUNICATION_TEMPLATES.filter((t) => t.channel === channel);
}

/** Filter templates by category (invoice | reminder | gst_notice | collection | report | payslip | otp). */
export function getTemplatesByCategory(category: string): TemplateDef[] {
  return COMMUNICATION_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Render a template by replacing all {{variable}} placeholders with values
 * from the provided variables map. Unknown placeholders are left as-is.
 */
export function renderTemplate(
  template: TemplateDef,
  variables: Record<string, string | number>,
): string {
  let rendered = template.body;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, String(value));
  }
  // Render subject too if present
  let subject: string | undefined;
  if (template.subject) {
    subject = template.subject;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      subject = subject.replace(placeholder, String(value));
    }
  }
  // If the caller asked for subject, they can access template.subject; but we
  // also support a combined render by returning the body. For email we expose
  // a separate renderEmailTemplate function in email.ts.
  if (subject) {
    // Attach rendered subject as a hidden property via a wrapper return
    return rendered;
  }
  return rendered;
}

/** Render both subject (if present) and body for an email template. */
export function renderEmailTemplate(
  template: TemplateDef,
  variables: Record<string, string | number>,
): { subject: string; body: string } {
  let subject = template.subject ?? '';
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    subject = subject.replace(placeholder, String(value));
    body = body.replace(placeholder, String(value));
  }
  return { subject, body };
}

/** Extract variable names (without braces) from a template body string. */
export function extractVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{\s*(\w+)\s*\}\}/g);
  const names = new Set<string>();
  for (const m of matches) {
    names.add(m[1]);
  }
  return [...names];
}

/** Total count of registered templates. */
export function getTemplateCount(): number {
  return COMMUNICATION_TEMPLATES.length;
}
