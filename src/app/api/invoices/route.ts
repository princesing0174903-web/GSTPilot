import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const invoices = await db.invoice.findMany({
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
