import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const period = searchParams.get('period');

    const where: Record<string, string> = {};
    if (clientId) where.clientId = clientId;
    if (period) where.period = period;

    const invoices = await db.invoice.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

// POST /api/invoices — Create a new invoice
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      clientId,
      invoiceNumber,
      invoiceDate,
      sellerGstin,
      buyerGstin,
      buyerName,
      invoiceType,
      gstr1Section,
      taxableValue,
      cgst,
      sgst,
      igst,
      cess,
      totalAmount,
      hsnCode,
      reverseCharge,
      status,
      matchStatus,
      riskLevel,
      riskScore,
      period,
      notes,
    } = body;

    if (!clientId || !invoiceNumber) {
      return NextResponse.json(
        { error: 'clientId and invoiceNumber are required' },
        { status: 400 }
      );
    }

    const invoice = await db.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        invoiceDate: invoiceDate ?? new Date().toISOString().split('T')[0],
        sellerGstin: sellerGstin ?? '',
        buyerGstin: buyerGstin ?? null,
        buyerName: buyerName ?? null,
        invoiceType: invoiceType ?? 'B2B',
        gstr1Section: gstr1Section ?? 'b2b',
        taxableValue: taxableValue ?? 0,
        cgst: cgst ?? 0,
        sgst: sgst ?? 0,
        igst: igst ?? 0,
        cess: cess ?? 0,
        totalAmount: totalAmount ?? 0,
        hsnCode: hsnCode ?? null,
        reverseCharge: reverseCharge ?? false,
        status: status ?? 'draft',
        matchStatus: matchStatus ?? 'unmatched',
        riskLevel: riskLevel ?? 'low',
        riskScore: riskScore ?? 0,
        period: period ?? null,
        notes: notes ?? null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Invoice Created',
        entity: 'invoice',
        entityId: invoice.id,
        details: `New invoice ${invoiceNumber} created for client ${clientId}`,
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

// PATCH /api/invoices — Update an existing invoice
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice id is required' },
        { status: 400 }
      );
    }

    // Remove fields that shouldn't be directly updated
    delete updates.createdAt;
    delete updates.updatedAt;

    const invoice = await db.invoice.update({
      where: { id },
      data: updates,
      include: { client: true },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: invoice.clientId,
        action: 'Invoice Updated',
        entity: 'invoice',
        entityId: invoice.id,
        details: `Invoice ${invoice.invoiceNumber} updated`,
      },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('PATCH /api/invoices error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    );
  }
}
