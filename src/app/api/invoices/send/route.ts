import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import type { SendChannel } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

// POST /api/invoices/send
// Body: { id: string; channel?: 'email' | 'whatsapp' | 'sms' }
// Marks the invoice as sent (status → 'sent' if it was 'draft') and logs an
// audit entry. The actual email/whatsapp/sms dispatch is handled by the
// communication service in production; here we mark sent + return the invoice.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as { id: string; channel?: SendChannel };
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

    // Tenant scope check.
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

    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'Invoice Sent',
        entity: 'invoice',
        entityId: existing.id,
        details: `Invoice ${existing.invoiceNumber} sent via ${body.channel ?? 'email'}`,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: updated,
      message: `Invoice ${existing.invoiceNumber} sent via ${body.channel ?? 'email'}.`,
    });
  } catch (err) {
    console.error('[API /invoices/send] error:', err);
    return friendlyApiError(err, 'We could not send this invoice right now. Please try again.');
  }
}
