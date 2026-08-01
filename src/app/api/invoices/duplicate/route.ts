import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, friendlyApiError } from '@/lib/auth/session';
import { assertInvoiceTenantAccess } from '../_helpers';
import { generateInvoiceNumber } from '@/lib/invoices/invoices';
import { invalidateGraph } from '@/lib/graph/live-update';

export const dynamic = 'force-dynamic';

// POST /api/invoices/duplicate
// Body: { id: string }
//
// Clones an existing invoice into a fresh draft with a new invoice number.
// Copies buyer/seller GSTIN, invoice type, totals, due date, notes, and all
// line items (with a fresh 1..N lineNumber sequence). The cloned invoice is
// always created with status='draft', paymentStatus='unpaid', paidAmount=0,
// balanceAmount=totalAmount, sentToCustomer=false — even if the source was
// paid/sent/overdue.
//
// Auth + tenant-scoped via assertInvoiceTenantAccess. Writes an AuditLog row
// (action: 'invoice_duplicated') and invalidates the graph cache.
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = (await req.json()) as { id: string };
    if (!body.id) {
      return NextResponse.json(
        { error: 'Invoice id is required.' },
        { status: 400 },
      );
    }

    const source = await db.invoice.findUnique({
      where: { id: body.id },
      include: {
        client: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });
    const accessErr = await assertInvoiceTenantAccess(uid, source);
    if (accessErr) return accessErr;

    // Generate the next invoice number for the current FY.
    const existing = await db.invoice.findMany({
      where: { invoiceNumber: { startsWith: `INV-${new Date().getFullYear()}-` } },
      select: { invoiceNumber: true },
    });
    const invoiceNumber = generateInvoiceNumber(existing.map((i) => i.invoiceNumber));
    const today = new Date().toISOString().split('T')[0];

    const newInvoice = await db.invoice.create({
      data: {
        clientId: source.clientId,
        invoiceNumber,
        invoiceDate: today,
        sellerGstin: source.sellerGstin,
        buyerGstin: source.buyerGstin,
        buyerName: source.buyerName,
        invoiceType: source.invoiceType,
        gstr1Section: source.gstr1Section,
        taxableValue: source.taxableValue,
        cgst: source.cgst,
        sgst: source.sgst,
        igst: source.igst,
        cess: source.cess,
        gstAmount: source.gstAmount,
        totalAmount: source.totalAmount,
        hsnCode: source.hsnCode,
        reverseCharge: source.reverseCharge,
        status: 'draft',
        matchStatus: 'unmatched',
        riskLevel: 'low',
        riskScore: 0,
        period: today.slice(0, 7),
        notes: source.notes,
        // Financial fields — always reset on duplicate.
        dueDate: source.dueDate,
        paidAmount: 0,
        balanceAmount: source.totalAmount,
        paymentStatus: 'unpaid',
        recurring: false,
        recurringCycle: null,
        notesFinance: source.notesFinance,
        sentToCustomer: false,
        // Clone line items with a fresh 1..N sequence.
        items: source.items.length > 0
          ? {
              create: source.items.map((it, idx) => ({
                lineNumber: idx + 1,
                description: it.description,
                hsnCode: it.hsnCode,
                quantity: it.quantity,
                unit: it.unit,
                unitPrice: it.unitPrice,
                taxableValue: it.taxableValue,
                cgstRate: it.cgstRate,
                sgstRate: it.sgstRate,
                igstRate: it.igstRate,
                cessRate: it.cessRate,
                cgst: it.cgst,
                sgst: it.sgst,
                igst: it.igst,
                cess: it.cess,
                totalAmount: it.totalAmount,
              })),
            }
          : undefined,
      },
      include: {
        client: true,
        items: { orderBy: { lineNumber: 'asc' } },
      },
    });

    await db.auditLog.create({
      data: {
        clientId: source.clientId,
        action: 'invoice_duplicated',
        entity: 'invoice',
        entityId: newInvoice.id,
        details: JSON.stringify({ sourceId: source.id }),
      },
    });

    invalidateGraph();

    return NextResponse.json(
      {
        invoice: newInvoice,
        message: `Duplicated Invoice ${source.invoiceNumber} → ${invoiceNumber} (draft).`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[API /invoices/duplicate] error:', err);
    return friendlyApiError(err, 'We could not duplicate this invoice right now. Please try again.');
  }
}
