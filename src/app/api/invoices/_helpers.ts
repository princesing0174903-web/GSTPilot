// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Invoice API shared helpers
//
// `assertInvoiceTenantAccess` — single source of truth for the "is this caller
// allowed to read/mutate this invoice?" check. Returns `null` when access is
// granted, or a `NextResponse` (404 for orphan invoices, 403 for non-members)
// that the route should return immediately.
//
// Why a helper: the Prisma `Invoice` model has NO `firmId` — tenant scoping
// goes through `client.firmId`, which is nullable. Calling
// `requireOrgMembership(uid, '')` returns 403 (NO_ORG), which leaks the fact
// that an invoice exists at all. Orphan invoices (no firm) should be
// invisible — we return 404 "Invoice not found" instead.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireOrgMembership } from '@/lib/auth/session';

interface InvoiceWithClient {
  client: { firmId: string | null } | null;
}

/**
 * Returns `null` when the caller may access the invoice, otherwise a
 * `NextResponse` (404 for orphan invoices, 403 for non-members) the route
 * should return immediately.
 *
 * Usage:
 *   const accessErr = assertInvoiceTenantAccess(uid, invoice);
 *   if (accessErr) return accessErr;
 */
export async function assertInvoiceTenantAccess(
  uid: string,
  invoice: InvoiceWithClient | null,
): Promise<NextResponse | null> {
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }
  const firmId = invoice.client?.firmId ?? '';
  if (!firmId) {
    // Orphan invoice (no firm) — never reveal its existence.
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }
  const memberResult = await requireOrgMembership(uid, firmId);
  if (memberResult instanceof NextResponse) return memberResult;
  return null;
}
