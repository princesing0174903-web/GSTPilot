// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Document Intelligence
//
// Reads PDF, Excel, invoices, GST notices, bank statements, and images that a
// user attaches to a chat. Returns plain text + a structured summary that the
// Oracle chat route injects into the conversation so Oracle can answer questions
// about the document.
//
// Extraction strategy:
//   • text-like files (.txt/.csv/.json/.md) → read UTF-8 directly.
//   • images (.png/.jpg/.gif/.webp/.bmp) → VLM (createVision) with a data URI.
//   • PDF / DOCX / XLSX / other → VLM (createVision) via file_url data URI.
//
// All paths run on the server (z-ai-web-dev-sdk is server-only).
// Failures degrade gracefully: a ready row with status='failed' and an empty
// extraction is returned so the chat never breaks.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OracleDocType =
  | 'pdf'
  | 'excel'
  | 'invoice'
  | 'gst_notice'
  | 'bank_statement'
  | 'image'
  | 'text'
  | 'other';

export interface ExtractedDocument {
  id: string;
  fileName: string;
  docType: OracleDocType;
  extractedText: string;
  summary: string;
  metadata: Record<string, unknown>;
}

// ─── Classification ────────────────────────────────────────────────────────────

const TEXT_EXTS = new Set(['txt', 'csv', 'json', 'md', 'log']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);
const PDF_EXTS = new Set(['pdf']);
const DOC_EXTS = new Set(['docx', 'doc']);
const SHEET_EXTS = new Set(['xlsx', 'xls']);

export function classifyDocument(fileName: string, mimeType?: string): OracleDocType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (PDF_EXTS.has(ext) || mimeType === 'application/pdf') return 'pdf';
  if (IMAGE_EXTS.has(ext) || (mimeType ?? '').startsWith('image/')) return 'image';
  if (SHEET_EXTS.has(ext) || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'excel';
  if (DOC_EXTS.has(ext)) return 'text';
  if (TEXT_EXTS.has(ext) || (mimeType ?? '').startsWith('text/')) return 'text';

  // Semantic hints from the filename.
  const n = fileName.toLowerCase();
  if (/\b(notice|asmt|drc|scn)\b/.test(n)) return 'gst_notice';
  if (/\b(bank|statement|hdfc|icici|sbi|axis|kotak|yes)\b/.test(n)) return 'bank_statement';
  if (/\b(invoice|bill|inv_)\b/.test(n)) return 'invoice';
  return 'other';
}

function extOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? 'bin';
}

function mimeTypeFor(fileName: string): string {
  const ext = extOf(fileName);
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    md: 'text/markdown',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ─── Direct text extraction (text-like files) ─────────────────────────────────

function extractPlainText(buffer: Buffer): string {
  const text = buffer.toString('utf-8');
  // Truncate to a sane context window for the LLM.
  return text.length > 8000 ? `${text.slice(0, 8000)}\n\n[…truncated…]` : text;
}

// ─── VLM extraction (images / PDF / DOCX / XLSX) ──────────────────────────────

const VLM_INSTRUCTIONS = `You are a GST & finance document reader. Extract ALL the following from this document as plain text:
1. The full textual content (preserve key numbers, GSTINs, dates, amounts, party names).
2. A concise 2–3 line summary of what the document is.
3. Any GSTINs, invoice numbers, amounts (with ₹), dates (DD/MM/YYYY), and party names found.

Return your answer as plain text in this exact structure:
SUMMARY: <one or two line summary>
CONTENT: <the extracted text, up to ~1500 words, well-organized>
KEY FACTS: <comma-separated list of GSTINs, invoice numbers, amounts, dates>

If the document is a GST notice, capture the notice type (ASMT-10/DRC-01/DRC-07 etc.), issue date, due date, and the alleged discrepancy. If it is a bank statement, capture opening/closing balance, total credits/debits, and 3–5 key transactions. If it is an invoice, capture invoice number, date, supplier & buyer GSTIN, taxable value, CGST/SGST/IGST, and total.`;

async function extractViaVLM(
  fileName: string,
  docType: OracleDocType,
  buffer: Buffer,
): Promise<{ text: string; summary: string }> {
  const ext = extOf(fileName);
  const isImage = IMAGE_EXTS.has(ext);
  const mime = mimeTypeFor(fileName);
  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;

  const zai = await ZAI.create();
  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: VLM_INSTRUCTIONS },
          isImage
            ? { type: 'image_url', image_url: { url: dataUri } }
            : { type: 'file_url', file_url: { url: dataUri } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  });

  const raw = response.choices?.[0]?.message?.content ?? '';
  // Parse the structured-ish response into text + summary.
  const summaryMatch = raw.match(/SUMMARY:\s*([\s\S]*?)(\n\s*CONTENT:|\n\s*KEY FACTS:|$)/i);
  const contentMatch = raw.match(/CONTENT:\s*([\s\S]*?)(\n\s*KEY FACTS:|$)/i);
  const summary = (summaryMatch?.[1] ?? '').trim() || `Extracted ${docType} document (${fileName}).`;
  const text = (contentMatch?.[1] ?? raw).trim();
  return { text, summary };
}

// ─── Public: extract + persist a document ─────────────────────────────────────

export interface IngestInput {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
}

/**
 * Extract text + summary from an uploaded document, persist an OracleDocument
 * row, and return a compact payload for chat-context injection.
 *
 * For images and small PDFs we keep the dataUri so Oracle can re-analyze if the
 * user asks a follow-up. Large files are stored text-only to respect DB size.
 */
export async function ingestDocument(input: IngestInput): Promise<ExtractedDocument> {
  const { fileName, buffer } = input;
  const docType = classifyDocument(fileName, input.mimeType);
  const ext = extOf(fileName);
  const mime = input.mimeType ?? mimeTypeFor(fileName);
  const sizeBytes = buffer.byteLength;

  // Decide extraction path.
  let extractedText = '';
  let summary = '';
  let status: 'ready' | 'failed' = 'ready';

  try {
    if (TEXT_EXTS.has(ext)) {
      extractedText = extractPlainText(buffer);
      summary = `Text file (${fileName}). ${extractedText.split('\n').length} lines.`;
    } else {
      const out = await extractViaVLM(fileName, docType, buffer);
      extractedText = out.text;
      summary = out.summary;
    }
    if (!extractedText.trim()) {
      extractedText = '';
      summary = `Could not extract readable text from ${fileName}.`;
      status = 'failed';
    }
  } catch {
    extractedText = '';
    summary = `Unable to read ${fileName} — the document may be corrupted or in an unsupported format.`;
    status = 'failed';
  }

  // Only persist the dataUri for images / small PDFs (<= 1.5 MB) to bound DB size.
  const keepDataUri =
    (IMAGE_EXTS.has(ext) || PDF_EXTS.has(ext)) && sizeBytes <= 1_500_000;
  const dataUri = keepDataUri ? `data:${mime};base64,${buffer.toString('base64')}` : null;

  const row = await db.oracleDocument.create({
    data: {
      fileName,
      fileType: ext,
      mimeType: mime,
      fileSize: sizeBytes,
      docType,
      status,
      extractedText: extractedText.slice(0, 12_000),
      summary: summary.slice(0, 1_200),
      metadata: JSON.stringify({ sizeBytes, docType }),
      dataUri,
    },
  });

  return {
    id: row.id,
    fileName,
    docType,
    extractedText,
    summary,
    metadata: { sizeBytes, docType },
  };
}

// ─── Public: render a document block for the system prompt ────────────────────

export function renderDocumentBlock(docs: ExtractedDocument[]): string {
  if (docs.length === 0) return '';
  const lines: string[] = [];
  lines.push('## ATTACHED DOCUMENTS (the user uploaded these — answer using their content)');
  for (const d of docs) {
    lines.push(`### ${d.fileName} (${d.docType})`);
    lines.push(`Summary: ${d.summary}`);
    if (d.extractedText) {
      const body = d.extractedText.length > 3000 ? `${d.extractedText.slice(0, 3000)}\n[…truncated…]` : d.extractedText;
      lines.push('Content:');
      lines.push(body);
    } else {
      lines.push('Content: [unreadable — tell the user the document could not be parsed and suggest re-uploading as PDF or image]');
    }
    lines.push('');
  }
  return lines.join('\n');
}
