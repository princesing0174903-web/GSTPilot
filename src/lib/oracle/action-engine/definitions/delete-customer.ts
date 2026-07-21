// ═══════════════════════════════════════════════════════════════════════════════
// Action: Delete Customer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses the shared service layer (src/lib/services/customers.ts → deleteCustomer)
// so the delete performs the EXACT same audit log + graph invalidation +
// timeline event + activity log as the /api/clients DELETE route. Hard delete —
// Oracle always asks for explicit confirmation.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { deleteCustomer as deleteCustomerService } from '@/lib/services';
import {
  registerAction,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

export const deleteCustomerAction: OracleAction = {
  name: 'deleteCustomer',
  displayName: 'Delete Customer',
  description: 'Permanently delete a customer. Fails if they have linked invoices or payments.',
  category: 'crm',
  icon: 'Users',
  intentKeywords: [
    'delete customer', 'remove customer', 'delete client', 'remove client',
  ],
  paramSchema: [
    { key: 'id', label: 'Customer ID', type: 'string', required: false, description: 'Customer (Client) id' },
    { key: 'name', label: 'Customer Name', type: 'string', required: false, description: 'Trade name — resolved to id if id is omitted' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const id = String(args.id ?? '').trim();
    const name = String(args.name ?? '').trim();

    let customer: { id: string; tradeName: string; gstin: string } | null = null;

    if (id) {
      customer = await db.client.findFirst({
        where: { id, firmId: orgId },
        select: { id: true, tradeName: true, gstin: true },
      }).catch(() => null);
      if (!customer) {
        fields.push({ key: 'id', label: 'Customer ID', status: 'error', message: 'Customer not found in your tenant' });
        errors.push(`Customer "${id}" was not found in your tenant.`);
      } else {
        fields.push({ key: 'id', label: 'Customer ID', status: 'ok', message: 'Found', resolvedValue: customer.tradeName });
      }
    } else if (name) {
      customer = await db.client.findFirst({
        where: { firmId: orgId, tradeName: { equals: name } },
        select: { id: true, tradeName: true, gstin: true },
      }).catch(() => null);
      if (!customer) {
        fields.push({ key: 'name', label: 'Customer Name', status: 'error', message: 'No customer with that name in your tenant' });
        errors.push(`No customer named "${name}" was found in your tenant.`);
      } else {
        fields.push({ key: 'name', label: 'Customer Name', status: 'ok', message: 'Resolved', resolvedValue: `${customer.tradeName} (${customer.id})` });
      }
    } else {
      fields.push({ key: 'id', label: 'Customer ID', status: 'error', message: 'Either id or name is required' });
      errors.push('Provide either the customer id or name to delete.');
    }

    if (customer) {
      resolvedRefs.customerId = customer.id;
      resolvedRefs.customerName = customer.tradeName;
      resolvedRefs.customerGstin = customer.gstin;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const name = refs.customerName ?? String(args.name ?? '—');
    const gstin = refs.customerGstin ?? String(args.gstin ?? '—');
    return {
      title: `Delete customer "${name}"`,
      fields: [
        { label: 'Customer', value: name, emphasize: true },
        { label: 'GSTIN', value: gstin },
      ],
      note: '⚠️ This will permanently delete the customer and may fail if they have linked invoices/payments.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const directId = String(args.id ?? '').trim();
    let id = directId;

    // When only a name was supplied, re-resolve to the customer id (execute()
    // does not receive the validation result, so we repeat the lookup here).
    if (!id) {
      const name = String(args.name ?? '').trim();
      if (name) {
        const found = await db.client.findFirst({
          where: { firmId: orgId, tradeName: { equals: name } },
          select: { id: true },
        }).catch(() => null);
        if (found) id = found.id;
      }
    }
    if (!id) {
      return { ok: false, summary: 'Failed to delete customer — could not resolve the customer. Provide the id or name.' };
    }

    const result = await deleteCustomerService(
      orgId,
      id,
      { userId: ctx.userId, userName: ctx.userId },
    );

    if (!result.ok || !result.data) {
      return { ok: false, summary: `Failed to delete customer. ${result.error ?? 'Database error.'}` };
    }

    const c = result.data;
    return {
      ok: true,
      summary: `✅ Deleted customer **${c.tradeName}** (GSTIN: ${c.gstin}).`,
      data: { id: c.id, tradeName: c.tradeName, gstin: c.gstin },
      viewIn: { label: 'View in Customers', href: '/customers' },
    };
  },
};

registerAction(deleteCustomerAction);
