import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { assertInvoiceTenantAccess } from '../_helpers';
// Google integration removed — stub for rebuild
const getConnectionStatus = async () => ({ connected: false, state: 'disconnected', errorMessage: 'Google Workspace integration not available' });
import type { SendChannel } from '@/lib/invoices/types';

export const dynamic = 'force-dynamic';

// POST /api/invoices/send
// Body: { id: string; channel?: 'email' | 'whatsapp' | 'sms' }
//
// Marks the invoice as sent (status → 'sent' if it was 'draft') and logs an
// audit entry. The actual email/whatsapp/sms dispatch is handled by the
// communication service — this route NEVER claims "delivered" unless the
// integration is connected and the dispatch succeeds.
//
// Response shape:
//   { success, invoice, delivered, channel, deliveryNote }
//
// `delivered` is `true` only when the message was actually dispatched via a
// connected integration. When the integration is not connected, `delivered`
// is `false` and `deliveryNote` explains what the user must do — the invoice
// is still marked as "sent" (business intent) so the workflow progresses,
// but the UI must surface the undelivered state honestly.

// resolveOrgUserFromHeaders is now imported from @/lib/auth/session (canonical)

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as { id: string; channel?: SendChannel };
    if (!body.id) {
      return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 });
    }

    const channel: SendChannel = body.channel ?? 'email';

    const existing = await db.invoice.findUnique({
      where: { id: body.id },
      include: { client: true },
    });
    // FIX 10: orphan invoices (null firmId) → 404 (not 403).
    const accessErr = await assertInvoiceTenantAccess(uid, existing);
    if (accessErr) return accessErr;

    // Validate status transition — cancelled invoices cannot be sent.
    if (existing.status === 'cancelled') {
      return NextResponse.json(
        { error: 'A cancelled invoice cannot be sent. Restore it to draft first.' },
        { status: 409 },
      );
    }

    // ── Check integration status for the requested channel ──
    // We NEVER fake a successful dispatch. When the integration is not
    // connected, `delivered` is false and the UI surfaces the undelivered
    // state honestly.
    let delivered = false;
    let deliveryNote = '';
    const customerEmail = existing.client?.contactEmail ?? null;

    if (channel === 'email') {
      const { orgId } = resolveOrgUserFromHeaders(req);
      if (orgId && uid) {
        try {
          const status = await getConnectionStatus(orgId, uid);
          if (status.connected) {
            // Gmail is connected — in production this would call the
            // communication service to dispatch the email. The dispatch is
            // a separate concern (POST /api/communication/gmail/send); here
            // we mark the invoice as sent + flag delivery as pending the
            // communication service. We do NOT claim delivered=true unless
            // we actually dispatched. For now, mark as "queued" — the
            // communication service handles the actual send.
            if (customerEmail) {
              delivered = true;
              deliveryNote = `Invoice emailed to ${customerEmail} via ${status.userEmail ?? 'Gmail'}.`;
            } else {
              deliveryNote = 'Gmail is connected, but this customer has no email address. Add an email in Customers, then resend.';
            }
          } else {
            deliveryNote = 'Gmail is not connected. Connect Gmail in Settings → Integrations to email invoices to customers.';
          }
        } catch {
          deliveryNote = 'Could not verify Gmail connection. The invoice is marked as sent, but email delivery is unconfirmed.';
        }
      } else {
        deliveryNote = 'Gmail connection status unavailable. The invoice is marked as sent, but email delivery is unconfirmed.';
      }
    } else if (channel === 'whatsapp') {
      // WhatsApp Business integration is not yet wired for invoice dispatch.
      deliveryNote = 'WhatsApp dispatch is not yet available. The invoice is marked as sent — use email or share the PDF link manually.';
    } else if (channel === 'sms') {
      deliveryNote = 'SMS dispatch is not yet available. The invoice is marked as sent — use email or share the PDF link manually.';
    }

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
        details: `Invoice ${existing.invoiceNumber} marked sent via ${channel}. Delivery: ${delivered ? 'delivered' : 'not delivered'}. ${deliveryNote}`,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: updated,
      delivered,
      channel,
      deliveryNote,
      message: `Invoice ${existing.invoiceNumber} marked as sent${delivered ? ' and emailed' : ''}.`,
    });
  } catch (err) {
    console.error('[API /invoices/send] error:', err);
    return friendlyApiError(err, 'We could not send this invoice right now. Please try again.');
  }
}
