// ═══════════════════════════════════════════════════════════════════════════════
// Action: Add CRM Lead
// ═══════════════════════════════════════════════════════════════════════════════
//
// Creates a Client row with status='lead' + entityType='lead'. There's no
// dedicated Lead service, so we go straight to Prisma (db.client.create) —
// the same table the Customers page reads from, just filtered by status.
// A LOCAL- GSTIN is generated (leads rarely have a GSTIN up-front).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_SOURCES = ['website', 'referral', 'cold-call', 'event', 'other'] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const addCrmLeadAction: OracleAction = {
  name: 'addCrmLead',
  displayName: 'Add CRM Lead',
  description: 'Add a new CRM lead (prospective customer). Creates a Client record with status="lead" and a synthetic LOCAL- GSTIN.',
  category: 'crm',
  icon: 'Users',
  intentKeywords: [
    'add lead', 'new lead', 'create lead', 'add crm lead', 'log lead', 'prospective customer',
  ],
  paramSchema: [
    { key: 'name', label: 'Lead Name', type: 'string', required: true, description: 'Contact or prospect name' },
    { key: 'company', label: 'Company', type: 'string', required: false, description: 'Company / legal name' },
    { key: 'email', label: 'Email', type: 'string', required: false, description: 'Contact email' },
    { key: 'phone', label: 'Phone', type: 'string', required: false, description: 'Contact phone' },
    { key: 'source', label: 'Source', type: 'enum', required: false, options: [...VALID_SOURCES], description: 'Lead source' },
    { key: 'value', label: 'Deal Value', type: 'number', required: false, description: 'Estimated deal value ₹' },
    { key: 'notes', label: 'Notes', type: 'string', required: false, description: 'Free-form notes' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Name ──
    const name = String(args.name ?? '').trim();
    if (!name) {
      fields.push({ key: 'name', label: 'Lead Name', status: 'error', message: 'Name is required' });
      errors.push('Lead name is required.');
    } else {
      const dup = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: name }, status: 'lead' },
        select: { id: true, tradeName: true },
      }).catch(() => null);
      if (dup) {
        fields.push({ key: 'name', label: 'Lead Name', status: 'error', message: 'A lead with this name already exists', resolvedValue: name });
        errors.push(`A lead named "${name}" already exists.`);
      } else {
        fields.push({ key: 'name', label: 'Lead Name', status: 'ok', resolvedValue: name });
        resolvedRefs.name = name;
      }
    }

    // ── Company ──
    if (args.company) {
      fields.push({ key: 'company', label: 'Company', status: 'ok', resolvedValue: String(args.company) });
    }

    // ── Email ──
    if (args.email) {
      const email = String(args.email);
      if (!EMAIL_REGEX.test(email)) {
        fields.push({ key: 'email', label: 'Email', status: 'warn', message: 'Does not look like a valid email', resolvedValue: email });
        warnings.push(`Email "${email}" may be invalid.`);
      } else {
        fields.push({ key: 'email', label: 'Email', status: 'ok', resolvedValue: email });
      }
    }

    // ── Phone ──
    if (args.phone) {
      fields.push({ key: 'phone', label: 'Phone', status: 'ok', resolvedValue: String(args.phone) });
    }

    // ── Source ──
    const source = String(args.source ?? '').toLowerCase();
    if (source && !VALID_SOURCES.includes(source as any)) {
      fields.push({ key: 'source', label: 'Source', status: 'warn', message: `Unknown source — defaulting to "other"`, resolvedValue: 'other' });
      warnings.push(`Unknown source "${source}" — defaulting to "other".`);
      resolvedRefs.source = 'other';
    } else if (source) {
      fields.push({ key: 'source', label: 'Source', status: 'ok', resolvedValue: source });
      resolvedRefs.source = source;
    }

    // ── Value ──
    if (args.value !== undefined && args.value !== null && args.value !== '') {
      const value = Number(args.value);
      if (isNaN(value) || value < 0) {
        fields.push({ key: 'value', label: 'Deal Value', status: 'warn', message: 'Must be a non-negative number', resolvedValue: String(args.value) });
        warnings.push(`Deal value "${args.value}" is invalid — it will be ignored.`);
      } else {
        fields.push({ key: 'value', label: 'Deal Value', status: 'ok', resolvedValue: inr(value) });
        resolvedRefs.value = value;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const name = refs.name ?? String(args.name ?? '—');
    const company = args.company ? String(args.company) : '—';
    const email = args.email ? String(args.email) : '—';
    const phone = args.phone ? String(args.phone) : '—';
    const source = refs.source ?? (args.source ? String(args.source) : '—');
    const value = refs.value !== undefined ? inr(refs.value) : (args.value ? inr(Number(args.value)) : '—');
    return {
      title: `Add lead "${name}"`,
      fields: [
        { label: 'Name', value: name, emphasize: true },
        { label: 'Company', value: company },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'Source', value: source },
        { label: 'Deal Value', value: value },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'A new lead will be created with a synthetic LOCAL- GSTIN. Leads can be converted to customers later.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const name = String(args.name).trim();
    const company = args.company ? String(args.company).trim() : null;
    const email = args.email ? String(args.email).trim() : null;
    const phone = args.phone ? String(args.phone).trim() : null;
    const source = VALID_SOURCES.includes(String(args.source).toLowerCase() as any)
      ? String(args.source).toLowerCase()
      : 'other';
    const valueNum = args.value !== undefined && args.value !== null && args.value !== ''
      ? Number(args.value)
      : NaN;
    const value = isNaN(valueNum) ? null : valueNum;
    const notes = args.notes ? String(args.notes) : null;
    const gstin = `LOCAL-${Date.now()}`;

    const lead = await db.client.create({
      data: {
        firmId: orgId,
        tradeName: name,
        legalName: company ?? name,
        gstin,
        contactEmail: email,
        contactPhone: phone,
        entityType: 'lead',
        status: 'lead',
      },
      select: { id: true, tradeName: true, gstin: true, contactEmail: true, contactPhone: true },
    }).catch((e) => {
      console.error('[addCrmLead] client.create failed:', e);
      return null;
    });

    if (!lead) {
      return { ok: false, summary: `Failed to create lead "${name}". Database error.` };
    }

    await logActivity(orgId, 'crm', `Lead "${name}" added (source: ${source}${value !== null ? `, value: ${inr(value)}` : ''})`, {
      leadId: lead.id, name, source, value, company, email, phone,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'crm.lead_added',
      title: `New lead "${name}" added`,
      description: `Source: ${source}${value !== null ? ` · estimated value ${inr(value)}` : ''}${company ? ` · company: ${company}` : ''}.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { leadId: lead.id, name, source, value, company, email, phone, notes },
    });

    return {
      ok: true,
      summary: `✅ Added lead **${name}**${company ? ` (${company})` : ''} — source: ${source}${value !== null ? `, est. value ${inr(value)}` : ''}. You can now schedule follow-ups or convert them to a customer.`,
      data: { id: lead.id, name: lead.tradeName, gstin: lead.gstin, email: lead.contactEmail, phone: lead.contactPhone, source, value, company, notes },
      followUp: { label: 'Schedule follow-up', prompt: `Schedule a follow-up call with ${name} next week` },
      viewIn: { label: 'View in CRM', href: '/crm' },
    };
  },
};

registerAction(addCrmLeadAction);
