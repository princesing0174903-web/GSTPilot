import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const filings = await db.gSTRFiling.findMany({
      include: {
        client: true,
        events: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ filings });
  } catch (error) {
    console.error('Error fetching GSTR filings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GSTR filings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, returnType, period, financialYear } = body;

    if (!clientId || !returnType || !period) {
      return NextResponse.json(
        { error: 'clientId, returnType, and period are required' },
        { status: 400 }
      );
    }

    // Check if a filing already exists for this client + returnType + period
    const existing = await db.gSTRFiling.findFirst({
      where: {
        clientId,
        returnType,
        period,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A filing already exists for this client, return type, and period', filing: existing },
        { status: 409 }
      );
    }

    // Count invoices for this client and period
    const invoiceCount = await db.invoice.count({
      where: {
        clientId,
        period,
      },
    });

    const totalTaxable = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { taxableValue: true },
    });

    const totalTax = await db.invoice.aggregate({
      where: { clientId, period },
      _sum: { cgst: true, sgst: true, igst: true },
    });

    const taxSum =
      (totalTax._sum.cgst ?? 0) + (totalTax._sum.sgst ?? 0) + (totalTax._sum.igst ?? 0);

    const filing = await db.gSTRFiling.create({
      data: {
        clientId,
        returnType,
        period,
        financialYear: financialYear ?? null,
        status: 'draft',
        totalInvoices: invoiceCount,
        readyForFiling: 0,
        issuesFound: 0,
        criticalErrors: 0,
        warnings: 0,
        totalTaxableValue: totalTaxable._sum.taxableValue ?? 0,
        totalTax: taxSum,
      },
      include: {
        client: true,
      },
    });

    // Create filing event
    await db.filingEvent.create({
      data: {
        filingId: filing.id,
        clientId,
        eventType: 'data_imported',
        description: `New ${returnType} filing created for period ${period}`,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Filing Created',
        entity: 'gstr_filing',
        entityId: filing.id,
        details: `New ${returnType} filing created for period ${period}`,
      },
    });

    return NextResponse.json({ filing }, { status: 201 });
  } catch (error) {
    console.error('POST /api/gstr-filing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create filing' },
      { status: 500 }
    );
  }
}
