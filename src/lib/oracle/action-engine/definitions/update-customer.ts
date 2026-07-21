// ═══════════════════════════════════════════════════════════════════════════════
// Action: Update Customer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/customers.ts → updateCustomer)
// so the update performs the EXACT same Prisma write + audit log + graph event +
// timeline event + activity log as the /api/clients PUT route. Zero duplication
// between the UI and Oracle.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { updateCustomer as updateCustomerService } from '@/lib/services';
import {
  registerAction,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

export const updateCustomerAction: OracleAction = {
  name: 'updateCustomer',
  displayName: 'Update Customer',
  description: 'Update an existing customer\'s profile (name, GSTIN, contact, state, address).',
  category: 'crm',
  icon: 'Users',
  intentKeywords: [
    'update customer', 'edit customer', 'modify customer', 'change customer',
    'update client', 'edit client',
  ],
  paramSchema: [
    { key: 'id', label: 'Customer ID', type: 'string', required: true, description: 'Customer (Client) id' },
    { key: 'name', label: 'Customer Name', type: 'string', required: false, description: 'Trade name (mapped to tradeName)' },
    { key: 'tradeName', label: 'Trade Name', type: 'string', required: false, description: 'Trade name (alternate key for name)' },
    { key: 'gstin', label: 'GSTIN', type: 'string', required: false, description: 'GSTIN (must remain unique)' },
    { key: 'email', label: 'Email', type: 'string', required: false, description: 'Contact email' },
    { key: 'phone', label: 'Phone', type: 'string', required: false, description: 'Contact phone' },
    { key: 'state', label: 'State', type: 'string', required: false, description: 'State name' },
    { key: 'stateCode', label: 'State Code', type: 'string', required: false, description: 'GST state code' },
    { key: 'address', label: 'Address', type: 'string', required: false, description: 'Full address' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // Resolve the customer by id, scoped to the tenant.
    const id = String(args.id ?? '').trim();
    if (!id) {
      fields.push({ key: 'id', label: 'Customer ID', status: 'error', message: 'Customer id is required' });
      errors.push('Customer id is required.');
    } else {
      const existing = await db.client.findFirst({
        where: { id, firmId: orgId },
        select: { id: true, tradeName: true, gstin: true, contactEmail: true, contactPhone: true, state: true, stateCode: true, address: true },
      }).catch(() => null);
      if (!existing) {
        fields.push({ key: 'id', label: 'Customer ID', status: 'error', message: 'Customer not found in your tenant' });
        errors.push(`Customer "${id}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'id', label: 'Customer ID', status: 'ok', message: 'Found', resolvedValue: existing.tradeName });
        resolvedRefs.customerId = existing.id;
        resolvedRefs.customerName = existing.tradeName;
        resolvedRefs.original = existing;
      }
    }

    // Collect the requested updates (excluding the id itself).
    const updates: Record<string, unknown> = {};
    const tradeName = String(args.name ?? args.tradeName ?? '').trim();
    if (tradeName) updates.tradeName = tradeName;

    const gstinRaw = String(args.gstin ?? '').trim();
    const gstin = gstinRaw ? gstinRaw.toUpperCase() : '';
    if (gstin) {
      if (!GSTIN_REGEX.test(gstin)) {
        fields.push({ key: 'gstin', label: 'GSTIN', status: 'warn', message: 'Does not match standard GSTIN format', resolvedValue: gstin });
        warnings.push(`GSTIN "${gstin}" does not match the standard 15-character format. It will still be saved.`);
        updates.gstin = gstin;
      } else {
        // Uniqueness check across all clients (Prisma @unique on gstin)
        const duplicate = await db.client.findUnique({ where: { gstin }, select: { id: true, tradeName: true } }).catch(() => null);
        if (duplicate && duplicate.id !== resolvedRefs.customerId) {
          fields.push({ key: 'gstin', label: 'GSTIN', status: 'error', message: `Already used by "${duplicate.tradeName}"`, resolvedValue: gstin });
          errors.push(`GSTIN "${gstin}" is already registered to another customer.`);
        } else {
          fields.push({ key: 'gstin', label: 'GSTIN', status: 'ok', message: 'Valid format, unique', resolvedValue: gstin });
          updates.gstin = gstin;
        }
      }
    }

    if (args.email !== undefined) {
      const email = String(args.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fields.push({ key: 'email', label: 'Email', status: 'warn', message: 'Does not look like a valid email', resolvedValue: email });
        warnings.push(`Email "${email}" may be invalid.`);
      } else {
        fields.push({ key: 'email', label: 'Email', status: 'ok', resolvedValue: email || '(cleared)' });
      }
      updates.contactEmail = email || null;
    }
    if (args.phone !== undefined) {
      updates.contactPhone = String(args.phone) || null;
      fields.push({ key: 'phone', label: 'Phone', status: 'ok', resolvedValue: String(args.phone) || '(cleared)' });
    }
    if (args.state !== undefined) {
      updates.state = String(args.state) || null;
      fields.push({ key: 'state', label: 'State', status: 'ok', resolvedValue: String(args.state) || '(cleared)' });
    }
    if (args.stateCode !== undefined) {
      updates.stateCode = String(args.stateCode) || null;
      fields.push({ key: 'stateCode', label: 'State Code', status: 'ok', resolvedValue: String(args.stateCode) || '(cleared)' });
    }
    if (args.address !== undefined) {
      updates.address = String(args.address) || null;
      fields.push({ key: 'address', label: 'Address', status: 'ok', resolvedValue: String(args.address) || '(cleared)' });
    }

    // Require at least one updatable field
    if (Object.keys(updates).length === 0 && errors.length === 0) {
      warnings.push('No fields were supplied — nothing to update.');
    }

    resolvedRefs.updates = updates;
    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const name = String(args.name ?? args.tradeName ?? refs.customerName ?? '—');
    const updates: Record<string, unknown> = refs.updates ?? {};
    const changedFields: string[] = [];
    if (updates.tradeName) changedFields.push(`name → ${updates.tradeName}`);
    if (updates.gstin) changedFields.push(`GSTIN → ${updates.gstin}`);
    if (updates.contactEmail !== undefined) changedFields.push(`email → ${updates.contactEmail || '(cleared)'}`);
    if (updates.contactPhone !== undefined) changedFields.push(`phone → ${updates.contactPhone || '(cleared)'}`);
    if (updates.state !== undefined) changedFields.push(`state → ${updates.state || '(cleared)'}`);
    if (updates.stateCode !== undefined) changedFields.push(`stateCode → ${updates.stateCode || '(cleared)'}`);
    if (updates.address !== undefined) changedFields.push(`address → ${updates.address || '(cleared)'}`);
    const changeSummary = changedFields.length > 0 ? changedFields.join('; ') : 'no changes';
    return {
      title: `Update customer "${name}"`,
      fields: [
        { label: 'Customer', value: name, emphasize: true },
        { label: 'Changes', value: changeSummary },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : undefined,
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const id = String(args.id ?? '').trim();
    const updates: Record<string, unknown> = {};
    const tradeName = String(args.name ?? args.tradeName ?? '').trim();
    if (tradeName) updates.tradeName = tradeName;
    if (args.gstin !== undefined && String(args.gstin).trim()) updates.gstin = String(args.gstin).trim().toUpperCase();
    if (args.email !== undefined) updates.contactEmail = String(args.email) || null;
    if (args.phone !== undefined) updates.contactPhone = String(args.phone) || null;
    if (args.state !== undefined) updates.state = String(args.state) || null;
    if (args.stateCode !== undefined) updates.stateCode = String(args.stateCode) || null;
    if (args.address !== undefined) updates.address = String(args.address) || null;

    const result = await updateCustomerService(
      orgId,
      id,
      updates,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to update customer. ${result.error ?? 'Database error.'}` };
    }

    const c = result.data;
    return {
      ok: true,
      summary: `✅ Updated customer **${c.tradeName}** (GSTIN: ${c.gstin}).`,
      data: { id: c.id, tradeName: c.tradeName, gstin: c.gstin, email: c.contactEmail, state: c.state },
      viewIn: { label: 'View in Customers', href: '/customers' },
    };
  },
};

registerAction(updateCustomerAction);
