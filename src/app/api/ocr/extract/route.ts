// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase Gamma-7: OCR Engine API
//
// POST /api/ocr/extract
//
// Accepts a base64-encoded image (or PDF page rendered as image) and a
// `documentType` hint. Uses the ZAI Vision Language Model to extract
// structured data with a confidence score. Returns normalized JSON that the
// frontend can route to the right review queue.
//
// Supported document types:
//   • invoice      — supplier GSTIN, invoice number, date, taxable/tax/total
//   • bill         — vendor, amount, date, category hint
//   • receipt      — merchant, amount, date, payment mode
//   • bank_statement — bank name, account, period, transaction rows
//   • credit_note  — original invoice ref, reason, adjusted amount
//   • debit_note   — original invoice ref, reason, adjusted amount
//   • purchase_order — PO number, vendor, line items, total
//   • delivery_challan — DC number, consignor, consignee, items
//
// Architecture:
//   image (base64) → VLM extraction → JSON validation → confidence score → response
//
// The VLM is instructed to return STRICT JSON. If parsing fails, we return
// the raw text with a low confidence flag so the user can review manually.
// Never fake extraction — if the model can't read the document, say so.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // VLM can take 10-30s on complex documents

// ─── Types ─────────────────────────────────────────────────────────────────────

type DocumentType =
  | 'invoice'
  | 'bill'
  | 'receipt'
  | 'bank_statement'
  | 'credit_note'
  | 'debit_note'
  | 'purchase_order'
  | 'delivery_challan';

interface ExtractRequest {
  image: string;        // base64 data URL: data:image/jpeg;base64,...
  documentType: DocumentType;
  organizationId?: string;
}

interface ExtractedField {
  value: string | number | null;
  confidence: number;   // 0-1
}

interface ExtractResponse {
  ok: boolean;
  documentType: DocumentType;
  extracted: Record<string, ExtractedField>;
  rawText: string;
  overallConfidence: number;
  needsReview: boolean;
  error?: string;
}

// ─── Prompts per document type ─────────────────────────────────────────────────

const PROMPTS: Record<DocumentType, string> = {
  invoice: `You are an expert GST invoice extractor. Analyze this invoice image and extract the following fields as STRICT JSON (no markdown, no commentary):
{
  "supplierName": string,
  "supplierGSTIN": string (15-char GSTIN or null),
  "invoiceNumber": string,
  "invoiceDate": string (YYYY-MM-DD or null),
  "dueDate": string (YYYY-MM-DD or null),
  "placeOfSupply": string or null,
  "taxableAmount": number,
  "cgst": number,
  "sgst": number,
  "igst": number,
  "cess": number or null,
  "totalAmount": number,
  "currency": string (default "INR")
}
Return ONLY the JSON object. If a field is unreadable, use null.`,
  bill: `Extract key fields from this bill image as STRICT JSON:
{"vendorName": string, "billNumber": string, "billDate": string (YYYY-MM-DD), "amount": number, "category": string (e.g. "utilities", "rent", "office"), "currency": "INR"}
Return ONLY JSON. Use null for unreadable fields.`,
  receipt: `Extract fields from this receipt image as STRICT JSON:
{"merchantName": string, "receiptNumber": string, "date": string (YYYY-MM-DD), "amount": number, "paymentMode": string (cash/card/upi/cheque), "currency": "INR"}
Return ONLY JSON. Use null for unreadable fields.`,
  bank_statement: `Extract the bank account header info from this bank statement image as STRICT JSON:
{"bankName": string, "accountNumber": string, "accountHolder": string, "statementPeriod": string, "openingBalance": number, "closingBalance": number}
Return ONLY JSON. Use null for unreadable fields. Do NOT extract individual transactions from this call.`,
  credit_note: `Extract fields from this credit note image as STRICT JSON:
{"supplierName": string, "creditNoteNumber": string, "date": string (YYYY-MM-DD), "originalInvoiceNumber": string, "reason": string, "taxableAmount": number, "totalAmount": number, "currency": "INR"}
Return ONLY JSON. Use null for unreadable fields.`,
  debit_note: `Extract fields from this debit note image as STRICT JSON:
{"supplierName": string, "debitNoteNumber": string, "date": string (YYYY-MM-DD), "originalInvoiceNumber": string, "reason": string, "taxableAmount": number, "totalAmount": number, "currency": "INR"}
Return ONLY JSON. Use null for unreadable fields.`,
  purchase_order: `Extract fields from this purchase order image as STRICT JSON:
{"poNumber": string, "vendorName": string, "poDate": string (YYYY-MM-DD), "deliveryDate": string (YYYY-MM-DD), "totalAmount": number, "currency": "INR"}
Return ONLY JSON. Use null for unreadable fields.`,
  delivery_challan: `Extract fields from this delivery challan image as STRICT JSON:
{"challanNumber": string, "consignorName": string, "consigneeName": string, "date": string (YYYY-MM-DD), "totalItems": number}
Return ONLY JSON. Use null for unreadable fields.`,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function tryParseJSON(text: string): Record<string, unknown> | null {
  // Strip markdown code fences if present.
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object in the text.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function computeOverallConfidence(parsed: Record<string, unknown> | null): number {
  if (!parsed) return 0.2;
  const values = Object.values(parsed);
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  // Confidence = fraction of non-null fields, with a floor of 0.3 for any parse.
  const ratio = values.length > 0 ? nonNull.length / values.length : 0;
  return Math.max(0.3, Math.min(0.98, 0.4 + ratio * 0.6));
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExtractRequest;

    if (!body.image || !body.documentType) {
      return NextResponse.json(
        { ok: false, error: 'image and documentType are required' },
        { status: 400 },
      );
    }

    if (!body.image.startsWith('data:image/')) {
      return NextResponse.json(
        { ok: false, error: 'image must be a base64 data URL (data:image/...)' },
        { status: 400 },
      );
    }

    const prompt = PROMPTS[body.documentType];
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: `Unsupported document type: ${body.documentType}` },
        { status: 400 },
      );
    }

    // ── Call the VLM ──
    const zai = await ZAI.create();
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: body.image } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const rawText = response.choices[0]?.message?.content ?? '';
    const parsed = tryParseJSON(rawText);
    const overallConfidence = computeOverallConfidence(parsed);

    // Build the extracted fields map with per-field confidence (approximated
    // from the overall confidence — non-null fields get the full score, null
    // fields get 0).
    const extracted: Record<string, ExtractedField> = {};
    if (parsed) {
      for (const [key, value] of Object.entries(parsed)) {
        const isPresent = value !== null && value !== undefined && value !== '';
        extracted[key] = {
          value: value as string | number | null,
          confidence: isPresent ? overallConfidence : 0,
        };
      }
    }

    const result: ExtractResponse = {
      ok: true,
      documentType: body.documentType,
      extracted,
      rawText,
      overallConfidence,
      needsReview: overallConfidence < 0.7 || parsed === null,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/ocr/extract] error:', err);
    const message = err instanceof Error ? err.message : 'OCR extraction failed';
    return NextResponse.json(
      {
        ok: false,
        error: 'Document analysis failed. Please ensure the image is clear and try again.',
        technicalDetail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 },
    );
  }
}
