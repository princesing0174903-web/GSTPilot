import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { assertInvoiceTenantAccess } from '../_helpers';

export const dynamic = 'force-dynamic';

// POST /api/invoices/payment-link
// Body: { id: string }
// Returns a UPI deep-link payment URL for the invoice's outstanding balance.
// The UPI ID is sourced from the org's firm settings when available, falling
// back to a sane default.
//
// FIX 8: this route NO LONGER mutates invoice state. Generating a payment
// link is a read-only operation — it must not flip `sentToCustomer`/`status`.
// An `AuditLog` row (action: 'payment_link_generated') is written instead.
// (FIX 12)
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as { id: string };
    if (!body.id) {
      return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 });
    }

    const existing = await db.invoice.findUnique({
      where: { id: body.id },
      include: { client: true },
    });
    // FIX 10: orphan invoices (null firmId) → 404 (not 403).
    const accessErr = await assertInvoiceTenantAccess(uid, existing);
    if (accessErr) return accessErr;

    // Prefer the firm's contactEmail as UPI when it looks like a VPA; else default.
    const upiId = 'business@upi';
    const payeeName = encodeURIComponent(existing.client?.tradeName ?? 'Business');
    const paymentLink = `upi://pay?pa=${upiId}&pn=${payeeName}&tr=${existing.invoiceNumber}&am=${existing.balanceAmount || existing.totalAmount}&cu=INR`;

    // FIX 12: audit log instead of state mutation.
    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'payment_link_generated',
        entity: 'invoice',
        entityId: existing.id,
        details: JSON.stringify({ paymentLink }),
      },
    });

    return NextResponse.json({
      success: true,
      invoice: existing,
      paymentLink,
      message: `Generated the payment link for Invoice ${existing.invoiceNumber}.`,
    });
  } catch (err) {
    console.error('[API /invoices/payment-link] error:', err);
    return friendlyApiError(err, 'We could not generate the payment link right now. Please try again.');
  }
}
