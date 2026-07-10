import { NextResponse } from 'next/server';
import { extractBill, importBillToPurchase, type OCRInput } from '@/lib/invoices/ocr';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OCRInput & { import?: boolean };
    if (!body.fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    // ── Run OCR extraction (deterministic) ──
    const ocr = await extractBill(body);

    // ── Optionally import into PurchaseBill master ──
    let imported: { billId: string; vendorId: string; created: boolean } | null = null;
    if (body.import !== false && ocr.success && ocr.totalAmount > 0) {
      try {
        imported = await importBillToPurchase(ocr);
      } catch (importErr) {
        console.warn('[API /invoices/import] bill import skipped:', importErr);
      }
    }

    return NextResponse.json({
      success: true,
      ocr,
      imported,
      message: ocr.vendorDetected
        ? `I've extracted invoice details from ${body.fileName} — vendor ${ocr.vendorName ?? 'detected'}, ${ocr.confidence} confidence, ITC ${ocr.itcEligible ? 'eligible' : 'blocked'}.`
        : `I've extracted ${ocr.confidence}-confidence details from ${body.fileName}${ocr.warnings.length ? ' — ' + ocr.warnings[0] : ''}.`,
    });
  } catch (err) {
    console.error('[API /invoices/import] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to import bill' },
      { status: 500 },
    );
  }
}
