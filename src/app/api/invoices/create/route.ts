import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { createInvoice } from '@/lib/invoices/invoices';
import type { CreateInvoiceInput } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

// POST /api/invoices/create — thin wrapper around the engine's createInvoice().
// Auth + tenant-scoped: the caller must be a member of the org that owns the
// target client's firmId. Prevents cross-tenant invoice creation.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as CreateInvoiceInput & {
      organizationId?: string;
      firmId?: string;
    };

    // FIX 3: clientId is required — 400 if missing.
    if (!body.clientId) {
      return NextResponse.json(
        { error: 'clientId is required to create an invoice.' },
        { status: 400 },
      );
    }
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 },
      );
    }

    // FIX 3: look up the target client + verify the caller is a member of
    // the org that owns the client's firmId. The client's firmId is the
    // single source of truth for tenant scoping — header/body org hints
    // are NOT used as a fallback, because that would let a caller create
    // invoices for an orphan client "under" a different org (tenant
    // isolation bug). Orphan clients (null firmId) → 400 with an
    // actionable message.
    const client = await db.client.findUnique({
      where: { id: body.clientId },
      select: { firmId: true, tradeName: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: 'The selected client could not be found.' },
        { status: 404 },
      );
    }
    // Per spec: requireOrgMembership(uid, client.firmId ?? ''). When the
    // client is orphan (null firmId) we surface a friendlier 400 instead
    // of the generic 403 NO_ORG, so the user knows to assign the client.
    const orgIdToVerify = client.firmId ?? '';
    if (!orgIdToVerify) {
      return NextResponse.json(
        { error: 'This client is not associated with any workspace. Please assign it to an organization first.' },
        { status: 400 },
      );
    }
    const memberResult = await requireOrgMembership(uid, orgIdToVerify);
    if (memberResult instanceof NextResponse) return memberResult;

    const invoice = await createInvoice(body);
    return NextResponse.json({
      success: true,
      invoice,
      message: `I've created Invoice ${invoice.invoiceNo} for ${invoice.clientName} (₹${invoice.total} total).`,
    });
  } catch (err) {
    console.error('[API /invoices/create] error:', err);
    return friendlyApiError(err, 'We could not create this invoice right now. Please try again.');
  }
}
