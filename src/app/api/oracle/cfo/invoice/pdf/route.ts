// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Invoice PDF Download API
//
// GET /api/oracle/cfo/invoice/pdf?invoiceId=...
//
// Generates and returns the invoice PDF on demand. The invoice data is passed
// inline (query params / body) so this works even in preview mode where
// Firestore reads are denied.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateInvoicePDF } from '@/lib/oracle-cfo/invoice-pdf';
import type { InvoiceApprovalSummary } from '@/lib/oracle-cfo/invoice-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { summary, sellerDetails, invoiceId, placeOfSupply, hsnCode } = body;

    if (!summary) {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 });
    }

    const result = await generateInvoicePDF({
      summary: summary as InvoiceApprovalSummary,
      sellerDetails,
      invoiceId: invoiceId ?? 'manual',
      hsnCode: hsnCode ?? '998314',
      placeOfSupply: placeOfSupply ?? '—',
      termsAndConditions: [],
    });

    return new NextResponse(result.base64, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${(summary as InvoiceApprovalSummary).invoice.number}.pdf"`,
        'Content-Transfer-Encoding': 'base64',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'PDF generation failed', detail: msg },
      { status: 500 },
    );
  }
}
