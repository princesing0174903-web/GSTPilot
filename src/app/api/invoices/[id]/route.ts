import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/invoices/[id] — fetch a single invoice (with line items + client)
// Auth + tenant-scoped: the caller must be a member of the org that owns the
// invoice's client.firmId. Prevents cross-tenant reads.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Tenant scope check — verify the invoice belongs to a workspace the caller can access.
    const memberResult = await requireOrgMembership(uid, invoice.client.firmId ?? '');
    if (memberResult instanceof NextResponse) return memberResult;

    return NextResponse.json({ invoice });
  } catch (err) {
    console.error('[API /invoices/:id] error:', err);
    return friendlyApiError(err, 'We could not load this invoice right now. Please try again.');
  }
}
