import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { assertInvoiceTenantAccess } from '../_helpers';
import { derivePaymentStatus } from '@/lib/invoices/invoices';
import { invalidateGraph } from '@/lib/graph/live-update';
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot';
import { parseBody, schemas } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// POST /api/invoices/mark-paid
// Body: { id: string, paidAmount?: number, paymentMode?: string, paymentDate?: string }
//
// Marks an invoice as (fully or partially) paid. When `paidAmount` is omitted
// the invoice is marked fully paid (= totalAmount). Recomputes balanceAmount
// and paymentStatus via the shared engine helpers, and bumps `status` to
// 'paid' when fully paid (never downgrades from 'paid'). Draft invoices that
// receive a partial payment are promoted to 'sent'.
//
// Auth + tenant-scoped via assertInvoiceTenantAccess. Writes an AuditLog row
// and invalidates the graph cache so live dashboards reflect the change.
//
// SECURITY (POLISH-06): zod validation via schemas.invoiceMarkPaid.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const [body, validationErr] = await parseBody(req, schemas.invoiceMarkPaid);
    if (validationErr) return validationErr;

    const existing = await db.invoice.findUnique({
      where: { id: body.id },
      include: { client: true },
    });
    const accessErr = await assertInvoiceTenantAccess(uid, existing);
    if (accessErr) return accessErr;

    const total = Number(existing.totalAmount) || 0;
    // Default → fully paid (= totalAmount).
    const paid = body.paidAmount !== undefined ? Number(body.paidAmount) : total;
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    const paymentStatus = derivePaymentStatus(paid, total, existing.dueDate ?? undefined);

    // Status logic:
    //   • Fully paid → 'paid' (don't downgrade from 'paid').
    //   • Partial payment on a draft → 'sent' (now visible to the customer).
    //   • Otherwise → leave the existing status untouched.
    let newStatus = existing.status;
    if (paid >= total && total > 0) {
      newStatus = 'paid';
    } else if (existing.status === 'draft') {
      newStatus = 'sent';
    }

    const invoice = await db.invoice.update({
      where: { id: body.id },
      data: {
        paidAmount: paid,
        paymentMode: body.paymentMode ?? existing.paymentMode ?? null,
        paymentDate: body.paymentDate ?? new Date().toISOString().split('T')[0],
        balanceAmount: balance,
        paymentStatus,
        status: newStatus,
      },
      include: { client: true, items: { orderBy: { lineNumber: 'asc' } } },
    });

    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'invoice_marked_paid',
        entity: 'invoice',
        entityId: existing.id,
        details: `Invoice ${existing.invoiceNumber} marked paid (₹${paid} of ₹${total}; status=${paymentStatus}).`,
      },
    });

    invalidateGraph();

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Invoice paid → cash, receivables, collection rate, customer outstanding,
    // health score, and reports all need recomputation.
    if (existing.client?.firmId) {
      invalidateBusinessSnapshotCache(existing.client.firmId);
    }

    return NextResponse.json({
      invoice,
      message: `Marked Invoice ${existing.invoiceNumber} as paid (₹${paid} of ₹${total}).`,
    });
  } catch (err) {
    console.error('[API /invoices/mark-paid] error:', err);
    return friendlyApiError(err, 'We could not mark this invoice as paid right now. Please try again.');
  }
}
