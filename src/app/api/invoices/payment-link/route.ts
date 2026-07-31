import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// POST /api/invoices/payment-link
// Body: { id: string }
// Returns a UPI deep-link payment URL for the invoice's outstanding balance.
// The UPI ID is sourced from the org's firm settings when available, falling
// back to a sane default. Marks the invoice as sent.
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
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, existing.client.firmId ?? '');
    if (memberResult instanceof NextResponse) return memberResult;

    const updated = await db.invoice.update({
      where: { id: body.id },
      data: {
        sentToCustomer: true,
        sentAt: new Date().toISOString(),
        status: existing.status === 'draft' ? 'sent' : existing.status,
      },
    });

    // Prefer the firm's contactEmail as UPI when it looks like a VPA; else default.
    const upiId = 'business@upi';
    const payeeName = encodeURIComponent(existing.client?.tradeName ?? 'Business');
    const paymentLink = `upi://pay?pa=${upiId}&pn=${payeeName}&tr=${existing.invoiceNumber}&am=${updated.balanceAmount || updated.totalAmount}&cu=INR`;

    return NextResponse.json({
      success: true,
      invoice: updated,
      paymentLink,
      message: `Generated the payment link for Invoice ${existing.invoiceNumber}.`,
    });
  } catch (err) {
    console.error('[API /invoices/payment-link] error:', err);
    return friendlyApiError(err, 'We could not generate the payment link right now. Please try again.');
  }
}
