// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 3: Invoice Ingestion (CLIENT-SIDE)
//
// Orchestrates the full upload → extract → match → save pipeline. Everything
// Firestore/Storage here uses the CLIENT Firebase SDK so it runs under the
// authenticated user's context — exactly like the existing onSnapshot hooks.
//
// Flow:
//   1. uploadInvoiceFile(file, onProgress) → Firebase Storage upload + URL
//   2. (client calls /api/invoices/extract with the data URL)
//   3. matchCustomer(extracted, customers)  → reuse existing or create new
//   4. matchProduct(lineItem, products)     → reuse existing or create new (per item)
//   5. detectDuplicates(extracted, invoices)→ warn before save
//   6. saveExtractedInvoice(reviewed)       → createInvoice with `source` metadata
//
// No mock data. No local arrays. Firestore + Storage are the only sources of truth.
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTaskSnapshot,
} from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { ORG_PATH } from './config';
import { createCustomer } from './customers';
import { createProduct } from './products';
import { createInvoice } from './invoices';
import { sanitizeGstRate } from './gst';
import type {
  Customer,
  Product,
  Invoice,
  CreateInvoiceInput,
  InvoiceSource,
  InvoiceLineItem,
  ProductUnit,
} from './types';
import type { ExtractedInvoice, ExtractedLineItem } from './invoice-extraction';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

// ─── File validation ──────────────────────────────────────────────────────────

export interface FileValidation {
  ok: boolean;
  error?: string;
}

export function validateInvoiceFile(file: File): FileValidation {
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasValidExt) {
    return {
      ok: false,
      error: `Unsupported file type. Only PDF, JPG, JPEG, PNG are accepted.`,
    };
  }
  // Some browsers report empty type for PDFs; accept by extension too.
  if (file.type && !ALLOWED_MIME.has(file.type) && file.type !== '') {
    return {
      ok: false,
      error: `Unsupported MIME type: ${file.type}. Only PDF, JPG, JPEG, PNG are accepted.`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is 20 MB.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: 'File is empty. Please select a valid document.' };
  }
  return { ok: true };
}

/** Resolve the effective MIME type (some browsers return '' for PDFs). */
export function resolveMimeType(file: File): string {
  if (file.type && ALLOWED_MIME.has(file.type)) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  return file.type || 'application/octet-stream';
}

// ─── Firebase Storage upload ──────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  path: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Upload an invoice file to Firebase Storage under the organization's
 * invoices/uploads/ folder. Reports progress via the callback.
 *
 * Storage path:  organizations/GSTpilot_SAAS/invoices/uploads/{ts}-{slug}
 */
export function uploadInvoiceFile(
  file: File,
  onProgress?: (percent: number, snapshot: UploadTaskSnapshot) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const mimeType = resolveMimeType(file);
    const ext = safeName.split('.').pop() ?? 'bin';
    const base = safeName.slice(0, safeName.length - ext.length - 1) || 'invoice';
    const path = `${ORG_PATH}/invoices/uploads/${ts}-${base}.${ext}`;
    const storageRef = ref(storage, path);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: mimeType,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        module: 'gstpilot-phase3',
      },
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent =
          snapshot.totalBytes > 0
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            : 0;
        onProgress?.(Math.round(percent), snapshot);
      },
      (err) => {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        reject(new Error(translateStorageError(msg)));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url,
            path,
            fileName: file.name,
            mimeType,
            fileSize: file.size,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not get download URL';
          reject(new Error(translateStorageError(msg)));
        }
      },
    );
  });
}

function translateStorageError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('unauthorized')) {
    return 'Firebase Storage permission denied. Check your Storage security rules — the authenticated user needs write access to organizations/GSTpilot_SAAS/invoices/uploads/.';
  }
  if (lower.includes('quota') || lower.includes('billing')) {
    return 'Firebase Storage quota exceeded. Check your Firebase project billing plan.';
  }
  if (lower.includes('network') || lower.includes('retry') || lower.includes('offline')) {
    return 'Network error during upload. Please check your connection and retry.';
  }
  return `Upload failed: ${msg}`;
}

// ─── Read file as data URL (for the extraction API) ───────────────────────────

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale an image file (JPG/PNG) to a max dimension + JPEG quality to keep
 * the extraction request body small. PDFs are returned unchanged.
 */
export async function compressForExtraction(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
}> {
  const mimeType = resolveMimeType(file);
  if (mimeType === 'application/pdf') {
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, mimeType };
  }
  // Image: downscale via canvas to max 1600px, JPEG quality 0.85.
  const maxDim = 1600;
  const quality = 0.85;
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl, mimeType };
  }
  ctx.drawImage(img, 0, 0, width, height);
  const compressed = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl: compressed, mimeType: 'image/jpeg' };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image.'));
    img.src = src;
  });
}

// ─── Extraction API call ──────────────────────────────────────────────────────

export interface ExtractionApiResponse {
  ok: boolean;
  extracted: ExtractedInvoice | null;
  confidence: number;
  model: string;
  processingTimeMs: number;
  notes: string[];
  fileName: string | null;
  storageUrl: string | null;
  error?: string;
}

export async function callExtractionApi(params: {
  dataUrl: string;
  mimeType: string;
  fileName: string;
  storageUrl: string;
}): Promise<ExtractionApiResponse> {
  const res = await fetch('/api/invoices/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as ExtractionApiResponse;
  if (!res.ok) {
    throw new Error(data.error ?? `Extraction failed (HTTP ${res.status})`);
  }
  return data;
}

// ─── Customer matching ────────────────────────────────────────────────────────

export interface CustomerMatch {
  customer: Customer | null;
  confidence: number; // 0–1
  reason: string;
  /** Suggested new-customer payload when no match exists. */
  suggestedNew?: {
    name: string;
    gstin: string | null;
    address: string | null;
    state: string | null;
    stateCode: string | null;
  };
}

/**
 * Find an existing customer matching the extracted vendor/buyer.
 * The extraction pipeline treats the vendor (seller) as the customer of
 * GSTPilot's registry when ingesting a purchase invoice. The UI lets the
 * user pick which party to register.
 */
export function matchCustomer(
  extracted: ExtractedInvoice,
  customers: Customer[],
  party: 'vendor' | 'customer' = 'customer',
): CustomerMatch {
  const name = (party === 'vendor' ? extracted.vendorName : extracted.customerName)?.trim();
  const gstin = (party === 'vendor' ? extracted.vendorGstin : extracted.customerGstin)?.trim().toUpperCase() ?? null;
  const address = party === 'vendor' ? extracted.vendorAddress : extracted.customerAddress;
  const stateCode = party === 'vendor' ? extracted.vendorStateCode : extracted.customerStateCode;

  // 1. Exact GSTIN match → highest confidence.
  if (gstin && gstin.length === 15) {
    const byGstin = customers.find(
      (c) => (c.gstin ?? '').trim().toUpperCase() === gstin,
    );
    if (byGstin) {
      return {
        customer: byGstin,
        confidence: 0.98,
        reason: `Matched by GSTIN ${gstin}`,
      };
    }
  }

  // 2. Name match (case-insensitive, trimmed, startsWith or equality).
  if (name) {
    const lower = name.toLowerCase();
    const byNameExact = customers.find(
      (c) => c.name.trim().toLowerCase() === lower,
    );
    if (byNameExact) {
      return {
        customer: byNameExact,
        confidence: 0.85,
        reason: `Matched by exact name "${byNameExact.name}"`,
      };
    }
    const byNameStart = customers.find(
      (c) =>
        c.name.trim().toLowerCase().startsWith(lower) ||
        lower.startsWith(c.name.trim().toLowerCase()),
    );
    if (byNameStart && name.length >= 3) {
      return {
        customer: byNameStart,
        confidence: 0.7,
        reason: `Close name match "${byNameStart.name}" — please confirm`,
      };
    }
  }

  // 3. No match → suggest creating a new customer.
  return {
    customer: null,
    confidence: 0,
    reason: 'No existing customer matches — create a new one?',
    suggestedNew: {
      name: name ?? 'New Customer',
      gstin: gstin ?? null,
      address: address ?? null,
      state: null,
      stateCode: stateCode ?? null,
    },
  };
}

// ─── Product matching (per line item) ─────────────────────────────────────────

export interface ProductMatch {
  product: Product | null;
  confidence: number;
  reason: string;
  suggestedNew?: {
    name: string;
    hsnSac: string;
    gstRate: number;
    unit: ProductUnit;
    price: number;
  };
}

/**
 * Find an existing product matching an extracted line item.
 * Strategy: exact HSN match → description keyword match → no match.
 */
export function matchProduct(
  lineItem: ExtractedLineItem,
  products: Product[],
): ProductMatch {
  const hsn = lineItem.hsnSac?.trim() ?? null;
  const desc = lineItem.description?.trim() ?? null;
  const price = lineItem.unitPrice ?? 0;
  const gstRate = lineItem.gstRate != null ? sanitizeGstRate(lineItem.gstRate) : 18;

  // 1. Exact HSN match (and price within 5%).
  if (hsn && hsn.length >= 4) {
    const byHsn = products.filter((p) => (p.hsnSac ?? '').trim() === hsn);
    if (byHsn.length === 1) {
      return {
        product: byHsn[0],
        confidence: 0.95,
        reason: `Matched by HSN/SAC ${hsn}`,
      };
    }
    if (byHsn.length > 1 && desc) {
      // Multiple HSN matches → narrow by description keyword.
      const lower = desc.toLowerCase();
      const narrowed = byHsn.find((p) =>
        p.name.toLowerCase().includes(lower.slice(0, 12)),
      );
      if (narrowed) {
        return {
          product: narrowed,
          confidence: 0.8,
          reason: `Matched by HSN ${hsn} + description`,
        };
      }
      // Return the first HSN match as a suggestion.
      return {
        product: byHsn[0],
        confidence: 0.6,
        reason: `${byHsn.length} products share HSN ${hsn} — picked closest, please confirm`,
      };
    }
  }

  // 2. Description keyword match (first 10+ chars).
  if (desc && desc.length >= 3) {
    const lower = desc.toLowerCase();
    const key = lower.slice(0, Math.min(15, lower.length));
    const byDesc = products.find(
      (p) =>
        p.name.toLowerCase().includes(key) ||
        (p.sku ?? '').toLowerCase().includes(key),
    );
    if (byDesc) {
      return {
        product: byDesc,
        confidence: 0.7,
        reason: `Matched by name "${byDesc.name}"`,
      };
    }
  }

  // 3. No match → suggest creating a new product.
  return {
    product: null,
    confidence: 0,
    reason: 'No existing product matches — create a new one?',
    suggestedNew: {
      name: desc?.slice(0, 80) ?? 'New Product',
      hsnSac: hsn ?? '',
      gstRate,
      unit: 'NOS',
      price,
    },
  };
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export interface DuplicateMatch {
  invoice: Invoice;
  score: number; // 0–1, higher = more likely duplicate
  reasons: string[];
}

export interface DuplicateResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  /** Strongest match (highest score), if any. */
  top: DuplicateMatch | null;
}

/**
 * Detect likely duplicates before saving. Checks invoice number, vendor name,
 * grand total, and invoice date. Returns a ranked list of candidate matches.
 */
export function detectDuplicates(
  extracted: ExtractedInvoice,
  invoices: Invoice[],
): DuplicateResult {
  const candidates: DuplicateMatch[] = [];
  const invNo = extracted.invoiceNumber?.trim().toUpperCase() ?? null;
  const vendor = extracted.vendorName?.trim().toLowerCase() ?? null;
  const total = extracted.grandTotal ?? null;
  const date = extracted.invoiceDate ?? null;

  for (const inv of invoices) {
    if (inv.status === 'cancelled') continue;
    let score = 0;
    const reasons: string[] = [];

    // Invoice number exact match → very strong signal.
    if (invNo && invNo.length >= 3) {
      const existingNo = inv.invoiceNumber.trim().toUpperCase();
      if (existingNo === invNo) {
        score += 0.6;
        reasons.push(`same invoice number ${invNo}`);
      } else if (existingNo.includes(invNo) || invNo.includes(existingNo)) {
        score += 0.35;
        reasons.push(`similar invoice number (${inv.invoiceNumber})`);
      }
    }

    // Vendor/customer name match.
    if (vendor && vendor.length >= 3) {
      const existingParty = inv.customerName.trim().toLowerCase();
      const existingSeller = inv.sellerName.trim().toLowerCase();
      if (existingParty === vendor || existingSeller === vendor) {
        score += 0.2;
        reasons.push(`same party name`);
      }
    }

    // Grand total exact match (within ₹1).
    if (total != null && Math.abs(inv.grandTotal - total) < 1) {
      score += 0.2;
      reasons.push(`same amount ₹${inv.grandTotal.toFixed(2)}`);
    }

    // Same invoice date.
    if (date && inv.invoiceDate === date) {
      score += 0.1;
      reasons.push(`same date ${date}`);
    }

    if (score >= 0.35) {
      candidates.push({ invoice: inv, score: Math.min(1, score), reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0] ?? null;
  return {
    isDuplicate: candidates.length > 0,
    matches: candidates.slice(0, 3),
    top,
  };
}

// ─── Save reviewed invoice ────────────────────────────────────────────────────

export interface ReviewedLineItem {
  productId: string | null;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: ProductUnit;
  unitPrice: number;
  discount: number;
  gstRate: number;
  /** Whether to create a new product for this line (when productId is null). */
  createNewProduct: boolean;
}

export interface SaveExtractedInvoiceInput {
  /** Reviewed customer fields. */
  customerId: string | null;
  customerName: string;
  customerGstin: string | null;
  customerAddress: string | null;
  customerState: string | null;
  customerStateCode: string | null;
  /** Whether to create a new customer (when customerId is null). */
  createNewCustomer: boolean;

  /** Seller fields (the vendor from the document). */
  sellerName: string;
  sellerGstin: string | null;
  sellerAddress: string | null;
  sellerStateCode: string | null;

  invoiceDate: string;
  dueDate: string | null;
  notes: string | null;

  lineItems: ReviewedLineItem[];

  /** AI provenance metadata. */
  source: Omit<InvoiceSource, 'type'> & { type?: 'upload' | 'manual' | 'import' };
}

/**
 * Persist the reviewed extraction as a real Firestore invoice.
 * Optionally creates a new customer and/or new products first, then calls
 * createInvoice with the AI source metadata attached.
 */
export async function saveExtractedInvoice(
  input: SaveExtractedInvoiceInput,
): Promise<Invoice> {
  // 1. Optionally create a new customer.
  let customerId = input.customerId;
  if (!customerId && input.createNewCustomer && input.customerName.trim()) {
    const newCustomer = await createCustomer({
      name: input.customerName.trim(),
      gstin: input.customerGstin ?? null,
      address: input.customerAddress ?? null,
      state: input.customerState ?? null,
      stateCode: input.customerStateCode ?? null,
      type: input.customerGstin ? 'business' : 'business',
    });
    customerId = newCustomer.id;
  }

  // 2. Optionally create new products per line item.
  const itemsForInvoice: Array<
    Omit<InvoiceLineItem, 'taxableValue' | 'cgst' | 'sgst' | 'igst' | 'amount'>
  > = [];

  for (const li of input.lineItems) {
    let productId = li.productId;
    if (!productId && li.createNewProduct && li.description.trim()) {
      const newProduct = await createProduct({
        name: li.description.trim(),
        hsnSac: li.hsnSac || '',
        gstRate: sanitizeGstRate(li.gstRate),
        unit: li.unit,
        price: li.unitPrice,
        isService: false,
      });
      productId = newProduct.id;
    }
    itemsForInvoice.push({
      id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      description: li.description.trim(),
      hsnSac: li.hsnSac.trim(),
      quantity: Number(li.quantity) || 0,
      unit: li.unit,
      unitPrice: Number(li.unitPrice) || 0,
      discount: Number(li.discount) || 0,
      gstRate: sanitizeGstRate(li.gstRate),
    });
  }

  if (itemsForInvoice.length === 0) {
    throw new Error('At least one line item is required to save the invoice.');
  }

  // 3. Build the CreateInvoiceInput + source metadata.
  const createInput: CreateInvoiceInput = {
    customerId,
    customerName: input.customerName.trim() || 'Walk-in Customer',
    customerGstin: input.customerGstin?.trim().toUpperCase() || null,
    customerAddress: input.customerAddress?.trim() || null,
    customerState: input.customerState?.trim() || null,
    customerStateCode: input.customerStateCode?.trim() || null,
    sellerName: input.sellerName.trim() || 'Unknown Seller',
    sellerGstin: input.sellerGstin?.trim().toUpperCase() || null,
    sellerAddress: input.sellerAddress?.trim() || null,
    sellerStateCode: input.sellerStateCode?.trim() || null,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate ?? null,
    notes: input.notes?.trim() || null,
    items: itemsForInvoice,
    source: {
      type: input.source.type ?? 'upload',
      storageUrl: input.source.storageUrl ?? null,
      storagePath: input.source.storagePath ?? null,
      fileName: input.source.fileName ?? null,
      mimeType: input.source.mimeType ?? null,
      fileSize: input.source.fileSize ?? null,
      aiExtraction: input.source.aiExtraction ?? null,
      aiModel: input.source.aiModel ?? null,
      confidence: input.source.confidence ?? null,
      processingTimeMs: input.source.processingTimeMs ?? null,
      uploadedAt: input.source.uploadedAt ?? new Date().toISOString(),
    },
  };

  // 4. createInvoice computes GST atomically + writes to Firestore.
  return createInvoice(createInput);
}
