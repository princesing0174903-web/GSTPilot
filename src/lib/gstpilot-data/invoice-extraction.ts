// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 3: AI Invoice Extraction (Gemini / VLM)
//
// SERVER-ONLY module. Uses z-ai-web-dev-sdk's vision model to read a real
// invoice document (PDF or image) and return a structured JSON object with
// every GST-relevant field.
//
// CRITICAL RULES (per Phase 3 spec):
//   • Extract ONLY information actually present in the document.
//   • Never invent missing values — use null.
//   • Return structured JSON only.
//   • Handle rotated documents, multi-page PDFs, low-quality scans, and
//     mobile-camera photos gracefully.
//   • Surface clear errors when extraction is impossible.
//
// No Firestore access here — this is a pure document→JSON transform.
// Matching against Firestore customers/products happens client-side.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { GST_RATES, type GstRate } from './config';
import { sanitizeGstRate } from './gst';
import type { ProductUnit } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single line item as extracted by the VLM (before product matching). */
export interface ExtractedLineItem {
  description: string | null;
  hsnSac: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  taxableValue: number | null;
  gstRate: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  amount: number | null;
}

/** The full extraction result returned to the client for review. */
export interface ExtractedInvoice {
  vendorName: string | null;
  vendorGstin: string | null;
  vendorAddress: string | null;
  vendorStateCode: string | null;
  customerName: string | null;
  customerGstin: string | null;
  customerAddress: string | null;
  customerStateCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  placeOfSupply: string | null;
  lineItems: ExtractedLineItem[];
  taxableAmount: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  totalGst: number | null;
  grandTotal: number | null;
  currency: string | null;
}

export interface ExtractionResult {
  ok: boolean;
  extracted: ExtractedInvoice | null;
  /** Verbatim VLM response text (for audit / debug). */
  rawText: string;
  /** Overall confidence 0–1. */
  confidence: number;
  /** AI model identifier. */
  model: string;
  /** Extraction wall-clock time in ms. */
  processingTimeMs: number;
  /** Human-readable notes about extraction quality. */
  notes: string[];
  error?: string;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an expert Indian GST invoice data extractor. Analyze this invoice document carefully and extract the following information as STRICT JSON.

CRITICAL RULES:
1. Extract ONLY what is actually printed in the document. NEVER guess, invent, or hallucinate values.
2. If a field is unreadable, blurred, missing, or you are not confident, use null.
3. Handle rotated, skewed, and low-quality scans. Handle multi-page PDFs by reading all pages.
4. The "vendor" is the SELLER/supplier who issued the invoice. The "customer" is the BUYER/bill-to party.
5. GSTIN is a 15-character code (2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric). The first 2 digits are the state code.
6. For line items, extract EACH item row separately with its description, HSN/SAC code, quantity, unit price, taxable value, GST rate, CGST, SGST, IGST, and total amount.
7. All monetary values must be numbers (no currency symbols, no commas). If the document shows "₹1,234.56", return 1234.56.
8. Dates must be in YYYY-MM-DD format. If the date is "15/03/2024" return "2024-03-15". If you cannot parse the date, use null.
9. GST rate must be a number (0, 0.25, 3, 5, 12, 18, 28). If not shown, use null.

Return ONLY this JSON object, no markdown, no explanation:
{
  "vendorName": string | null,
  "vendorGstin": string | null,
  "vendorAddress": string | null,
  "vendorStateCode": string | null,
  "customerName": string | null,
  "customerGstin": string | null,
  "customerAddress": string | null,
  "customerStateCode": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": string | null,
  "dueDate": string | null,
  "placeOfSupply": string | null,
  "lineItems": [
    {
      "description": string | null,
      "hsnSac": string | null,
      "quantity": number | null,
      "unit": string | null,
      "unitPrice": number | null,
      "taxableValue": number | null,
      "gstRate": number | null,
      "cgst": number | null,
      "sgst": number | null,
      "igst": number | null,
      "amount": number | null
    }
  ],
  "taxableAmount": number | null,
  "cgst": number | null,
  "sgst": number | null,
  "igst": number | null,
  "totalGst": number | null,
  "grandTotal": number | null,
  "currency": string | null
}

If the document is NOT an invoice (e.g. a photo of a cat), return {"grandTotal": null} with all other fields null. If the document is unreadable, return all-null fields.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip markdown code fences and extract the JSON object from a VLM reply. */
function tryParseJSON(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[₹,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toLineItem(raw: Record<string, unknown>): ExtractedLineItem {
  return {
    description: toStr(raw.description),
    hsnSac: toStr(raw.hsnSac),
    quantity: toNum(raw.quantity),
    unit: toStr(raw.unit),
    unitPrice: toNum(raw.unitPrice),
    taxableValue: toNum(raw.taxableValue),
    gstRate: toNum(raw.gstRate),
    cgst: toNum(raw.cgst),
    sgst: toNum(raw.sgst),
    igst: toNum(raw.igst),
    amount: toNum(raw.amount),
  };
}

/** Snap an extracted GST rate to the nearest allowed Indian slab. */
function snapGstRate(rate: number | null): { rate: GstRate | null; snapped: boolean } {
  if (rate === null) return { rate: null, snapped: false };
  const sanitized = sanitizeGstRate(rate);
  return { rate: sanitized, snapped: sanitized !== rate };
}

/**
 * Validate a GSTIN. Returns the cleaned (uppercase, trimmed) GSTIN if valid,
 * or null if malformed. Does NOT reject — just normalizes. The UI will warn.
 */
function normalizeGstin(gstin: string | null): string | null {
  if (!gstin) return null;
  const cleaned = gstin.trim().toUpperCase();
  if (cleaned.length !== 15) return cleaned;
  return cleaned;
}

/** Extract a 2-digit state code from a GSTIN (first 2 chars) if valid. */
function stateCodeFromGstin(gstin: string | null): string | null {
  if (!gstin) return null;
  const cleaned = gstin.trim().toUpperCase();
  if (cleaned.length < 2) return null;
  const first2 = cleaned.slice(0, 2);
  return /^\d{2}$/.test(first2) ? first2 : null;
}

/**
 * Compute an overall confidence score from the parsed object.
 * Confidence = fraction of key fields present (vendor, customer, invoice #,
 * date, grand total, at least one line item with a description).
 */
function computeConfidence(parsed: Record<string, unknown> | null): number {
  if (!parsed) return 0.15;
  const checks = [
    parsed.vendorName != null,
    parsed.vendorGstin != null,
    parsed.customerName != null,
    parsed.invoiceNumber != null,
    parsed.invoiceDate != null,
    parsed.grandTotal != null,
    Array.isArray(parsed.lineItems) && (parsed.lineItems as unknown[]).length > 0,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.max(0.2, Math.min(0.98, 0.25 + (passed / checks.length) * 0.73));
}

/** Build human-readable notes about extraction quality / issues. */
function buildNotes(
  parsed: Record<string, unknown> | null,
  extracted: ExtractedInvoice | null,
): string[] {
  const notes: string[] = [];
  if (!parsed || !extracted) {
    notes.push('Could not parse the AI response as JSON. Manual review required.');
    return notes;
  }
  if (!extracted.vendorName) notes.push('Vendor name could not be read.');
  if (!extracted.vendorGstin) notes.push('Vendor GSTIN could not be read.');
  if (!extracted.customerName) notes.push('Customer name could not be read.');
  if (!extracted.invoiceNumber) notes.push('Invoice number could not be read.');
  if (!extracted.invoiceDate) notes.push('Invoice date could not be read.');
  if (!extracted.grandTotal) notes.push('Grand total could not be read.');
  if (extracted.lineItems.length === 0) {
    notes.push('No line items were detected. The document may not be a standard GST invoice.');
  } else {
    const noHsn = extracted.lineItems.filter((li) => !li.hsnSac).length;
    if (noHsn > 0) notes.push(`${noHsn} line item(s) are missing HSN/SAC codes.`);
    const noPrice = extracted.lineItems.filter((li) => li.unitPrice == null).length;
    if (noPrice > 0) notes.push(`${noPrice} line item(s) are missing unit prices.`);
  }
  // Check for GST-rate snapping.
  let snappedCount = 0;
  for (const li of extracted.lineItems) {
    if (li.gstRate != null) {
      const { snapped } = snapGstRate(li.gstRate);
      if (snapped) snappedCount++;
    }
  }
  if (snappedCount > 0) {
    notes.push(`${snappedCount} line item GST rate(s) were adjusted to the nearest valid slab.`);
  }
  return notes;
}

// ─── Main extraction function ─────────────────────────────────────────────────

/**
 * Extract structured invoice data from a base64 data URL.
 *
 * @param dataUrl  - "data:image/jpeg;base64,..." or "data:application/pdf;base64,..."
 * @param mimeType - "image/jpeg" | "image/png" | "image/jpg" | "application/pdf"
 */
export async function extractInvoiceFromDataUrl(
  dataUrl: string,
  mimeType: string,
): Promise<ExtractionResult> {
  const startedAt = Date.now();
  const notes: string[] = [];

  // Decide content type: images use image_url, PDFs use file_url.
  const isPdf = mimeType === 'application/pdf' || dataUrl.startsWith('data:application/pdf');
  const contentBlock = isPdf
    ? { type: 'file_url' as const, file_url: { url: dataUrl } }
    : { type: 'image_url' as const, image_url: { url: dataUrl } };

  let model = 'glm-4.5v';
  let rawText = '';

  try {
    const zai = await ZAI.create();
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: EXTRACTION_PROMPT }, contentBlock],
        },
      ],
      thinking: { type: 'disabled' },
    });
    rawText = response.choices[0]?.message?.content ?? '';
    // Best-effort model capture from the response.
    const respModel = (response as { model?: string }).model;
    if (respModel) model = respModel;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'VLM call failed';
    return {
      ok: false,
      extracted: null,
      rawText: '',
      confidence: 0,
      model,
      processingTimeMs: Date.now() - startedAt,
      notes: ['The AI model could not process the document. Please try a clearer scan.'],
      error: message,
    };
  }

  const parsed = tryParseJSON(rawText);
  const confidence = computeConfidence(parsed);

  // Transform the parsed blob into our typed ExtractedInvoice.
  let extracted: ExtractedInvoice | null = null;
  if (parsed) {
    const rawItems = Array.isArray(parsed.lineItems)
      ? (parsed.lineItems as Array<Record<string, unknown>>)
      : [];
    const lineItems = rawItems.map(toLineItem);

    const vendorGstin = normalizeGstin(toStr(parsed.vendorGstin));
    const customerGstin = normalizeGstin(toStr(parsed.customerGstin));

    extracted = {
      vendorName: toStr(parsed.vendorName),
      vendorGstin,
      vendorAddress: toStr(parsed.vendorAddress),
      vendorStateCode:
        toStr(parsed.vendorStateCode) ?? stateCodeFromGstin(vendorGstin),
      customerName: toStr(parsed.customerName),
      customerGstin,
      customerAddress: toStr(parsed.customerAddress),
      customerStateCode:
        toStr(parsed.customerStateCode) ?? stateCodeFromGstin(customerGstin),
      invoiceNumber: toStr(parsed.invoiceNumber),
      invoiceDate: toStr(parsed.invoiceDate),
      dueDate: toStr(parsed.dueDate),
      placeOfSupply: toStr(parsed.placeOfSupply),
      lineItems,
      taxableAmount: toNum(parsed.taxableAmount),
      cgst: toNum(parsed.cgst),
      sgst: toNum(parsed.sgst),
      igst: toNum(parsed.igst),
      totalGst: toNum(parsed.totalGst),
      grandTotal: toNum(parsed.grandTotal),
      currency: toStr(parsed.currency) ?? 'INR',
    };

    // Snap line-item GST rates to valid slabs.
    for (const li of extracted.lineItems) {
      if (li.gstRate != null) {
        const { rate } = snapGstRate(li.gstRate);
        li.gstRate = rate;
      }
    }
  }

  const allNotes = buildNotes(parsed, extracted);
  if (extracted && extracted.lineItems.length === 0) {
    allNotes.push(
      'No line items detected. You can add them manually in the review step.',
    );
  }

  return {
    ok: true,
    extracted,
    rawText,
    confidence,
    model,
    processingTimeMs: Date.now() - startedAt,
    notes: allNotes,
  };
}

// Re-export for the ingestion module + UI.
export { snapGstRate, GST_RATES, normalizeGstin };
export type { ProductUnit };
