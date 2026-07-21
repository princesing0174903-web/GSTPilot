// ═══════════════════════════════════════════════════════════════════════════════
// Action: Create Customer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/customers.ts) so the
// create performs the EXACT same Prisma write + audit log + graph event +
// timeline event + activity log as the /api/clients POST route. Zero
// duplication between the UI and Oracle.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { createCustomer as createCustomerService } from '@/lib/services';
import {
  registerAction,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

// Basic GSTIN format check: 2 digits (state) + 10 chars (PAN+entity) + 1 char (Z) + 1 checksum
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

export const createCustomerAction: OracleAction = {
  name: 'createCustomer',
  displayName: 'Create Customer',
  description: 'Create a new customer (Client) with name, GSTIN, contact, and state.',
  category: 'crm',
  icon: 'Users',
  intentKeywords: [
    'create customer', 'add customer', 'new customer', 'register customer',
    'onboard customer', 'create client', 'add client', 'new client',
  ],
  paramSchema: [
    { key: 'name', label: 'Customer Name', type: 'string', required: true, description: 'Trade name' },
    { key: 'gstin', label: 'GSTIN', type: 'string', required: false, description: 'GSTIN (must be unique). If omitted, a synthetic LOCAL- GSTIN is generated.' },
    { key: 'email', label: 'Email', type: 'string', required: false, description: 'Contact email' },
    { key: 'phone', label: 'Phone', type: 'string', required: false, description: 'Contact phone' },
    { key: 'state', label: 'State', type: 'string', required: false, description: 'State name' },
    { key: 'stateCode', label: 'State Code', type: 'string', required: false, description: 'GST state code (e.g. 07 for Delhi)' },
    { key: 'address', label: 'Address', type: 'string', required: false, description: 'Full address' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // Name
    const tradeName = String(args.name ?? args.tradeName ?? '').trim();
    if (!tradeName) {
      fields.push({ key: 'name', label: 'Customer Name', status: 'error', message: 'Name is required' });
      errors.push('Customer name is required.');
    } else {
      // Check for duplicates (case-insensitive)
      const existing = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: tradeName } },
        select: { id: true, tradeName: true, gstin: true },
      }).catch(() => null);
      if (existing) {
        fields.push({ key: 'name', label: 'Customer Name', status: 'error', message: `Already exists (GSTIN: ${existing.gstin})`, resolvedValue: existing.tradeName });
        errors.push(`A customer named "${tradeName}" already exists. Use a different name, or add an invoice for the existing one.`);
      } else {
        fields.push({ key: 'name', label: 'Customer Name', status: 'ok', resolvedValue: tradeName });
      }
    }

    // GSTIN
    const gstinRaw = String(args.gstin ?? '').trim();
    const gstin = gstinRaw ? gstinRaw.toUpperCase() : '';
    if (gstin) {
      if (!GSTIN_REGEX.test(gstin)) {
        fields.push({ key: 'gstin', label: 'GSTIN', status: 'warn', message: 'Does not match standard GSTIN format', resolvedValue: gstin });
        warnings.push(`GSTIN "${gstin}" does not match the standard 15-character format. It will still be saved.`);
      } else {
        // Check uniqueness
        const existingGstin = await db.client.findUnique({ where: { gstin }, select: { id: true, tradeName: true } }).catch(() => null);
        if (existingGstin) {
          fields.push({ key: 'gstin', label: 'GSTIN', status: 'error', message: `Already used by "${existingGstin.tradeName}"`, resolvedValue: gstin });
          errors.push(`GSTIN "${gstin}" is already registered to another customer.`);
        } else {
          fields.push({ key: 'gstin', label: 'GSTIN', status: 'ok', message: 'Valid format, unique', resolvedValue: gstin });
          resolvedRefs.gstin = gstin;
          // Auto-derive state code from GSTIN first 2 digits
          if (!args.stateCode) resolvedRefs.stateCode = gstin.slice(0, 2);
        }
      }
    } else {
      // No GSTIN provided — we'll generate a synthetic one
      fields.push({ key: 'gstin', label: 'GSTIN', status: 'warn', message: 'Will generate a synthetic LOCAL- GSTIN' });
      warnings.push('No GSTIN provided — a synthetic LOCAL- prefixed GSTIN will be generated for local/unregistered customers.');
    }

    // Email format
    if (args.email) {
      const email = String(args.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fields.push({ key: 'email', label: 'Email', status: 'warn', message: 'Does not look like a valid email', resolvedValue: email });
        warnings.push(`Email "${email}" may be invalid.`);
      } else {
        fields.push({ key: 'email', label: 'Email', status: 'ok', resolvedValue: email });
      }
    }

    if (args.phone) fields.push({ key: 'phone', label: 'Phone', status: 'ok', resolvedValue: String(args.phone) });
    if (args.state) fields.push({ key: 'state', label: 'State', status: 'ok', resolvedValue: String(args.state) });

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const tradeName = String(args.name ?? args.tradeName ?? '').trim() || '—';
    const gstin = args.gstin ? String(args.gstin).toUpperCase() : '(auto-generated)';
    const email = args.email ? String(args.email) : '—';
    const phone = args.phone ? String(args.phone) : '—';
    const state = args.state ? String(args.state) : '—';
    return {
      title: `Create customer "${tradeName}"`,
      fields: [
        { label: 'Name', value: tradeName, emphasize: true },
        { label: 'GSTIN', value: gstin },
        { label: 'Email', value: email },
        { label: 'Phone', value: phone },
        { label: 'State', value: state },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const tradeName = String(args.name ?? args.tradeName ?? '').trim();
    // Generate a synthetic GSTIN when none provided (for unregistered customers)
    const gstin = String(args.gstin ?? `LOCAL-${Date.now()}`).trim().toUpperCase();
    const stateCode = args.stateCode
      ? String(args.stateCode)
      : (gstin.length >= 2 ? gstin.slice(0, 2) : undefined);

    const result = await createCustomerService(
      orgId,
      {
        tradeName,
        legalName: tradeName,
        gstin,
        contactEmail: args.email ? String(args.email) : undefined,
        contactPhone: args.phone ? String(args.phone) : undefined,
        state: args.state ? String(args.state) : undefined,
        stateCode,
        address: args.address ? String(args.address) : undefined,
      },
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to create customer "${tradeName}". ${result.error ?? 'Database error.'}` };
    }

    const c = result.data;
    return {
      ok: true,
      summary: `✅ Created customer **${c.tradeName}** (GSTIN: ${c.gstin}). You can now create invoices for this customer.`,
      data: { id: c.id, tradeName: c.tradeName, gstin: c.gstin, email: c.contactEmail, state: c.state },
      followUp: { label: 'Create an invoice', prompt: `Create an invoice for ${c.tradeName} for ₹25,000` },
      viewIn: { label: 'View in Customers', href: '/customers' },
    };
  },
};

registerAction(createCustomerAction);
