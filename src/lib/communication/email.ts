// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — Email Cloud™ Engine
// Invoice emails, GST notices, collection reminders, reports, forecast reports,
// and payroll slips. Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { EmailMessage, EmailStats, EmailCategory } from './types';
import { getTemplate, renderEmailTemplate, type TemplateDef } from './templates';

// ─── Seed data (no-op) ─────────────────────────────────────────────────────────
// Previously this function emitted 14 hardcoded email messages attributed to
// fake Indian recipients and fabricated invoice numbers. The export name is
// preserved so existing callers continue to compile, but it now returns `[]`
// so the UI renders a proper empty state. Real email messages come from
// `db.emailMessage.findMany()` via the API routes.

export function seedEmailMessages(): EmailMessage[] {
  return [];
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
