'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 3: Invoice Upload & AI Extraction Dialog
//
// Multi-step pipeline:
//   1. Select file (PDF/JPG/JPEG/PNG, ≤20 MB) + validate
//   2. Upload to Firebase Storage (progress bar) → call /api/invoices/extract
//   3. Review extracted data:
//        • AI confidence + quality notes
//        • Duplicate-detection banner
//        • Customer matching (reuse existing / create new)
//        • Per-line-item product matching (reuse existing / create new)
//        • Editable fields (invoice #, dates, GSTINs, line items, totals)
//   4. Save → Firestore invoice with full AI provenance metadata
//
// No mock OCR. No fake responses. Every value is either read by Gemini from the
// document or entered/edited by the user.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Plus,
  Link2,
  UserPlus,
  Package,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import { useGSTpilotCustomers } from '@/hooks/useGSTpilotCustomers';
import { useGSTpilotProducts } from '@/hooks/useGSTpilotProducts';
import { useGSTpilotInvoices } from '@/hooks/useGSTpilotInvoices';
import {
  GST_RATES,
  STATE_CODES,
  calculateInvoiceTotals,
  sanitizeGstRate,
} from '@/lib/gstpilot-data';
import type { ProductUnit, Invoice } from '@/lib/gstpilot-data/types';
import type { ExtractedInvoice } from '@/lib/gstpilot-data/invoice-extraction';
import {
  validateInvoiceFile,
  resolveMimeType,
  uploadInvoiceFile,
  compressForExtraction,
  callExtractionApi,
  matchCustomer,
  matchProduct,
  detectDuplicates,
  saveExtractedInvoice,
  MAX_FILE_SIZE,
  type ExtractionApiResponse,
  type ReviewedLineItem,
} from '@/lib/gstpilot-data/invoice-ingestion';

type Step = 'select' | 'processing' | 'review';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (invoice: Invoice) => void;
}

export function InvoiceUploadDialog({
  open,
  onOpenChange,
  onSaved,
}: UploadDialogProps) {
  const { organization } = useOrg();
  const orgId = organization?.id ?? null;
  const { customers } = useGSTpilotCustomers();
  const { products } = useGSTpilotProducts();
  const { invoices } = useGSTpilotInvoices();

  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingLabel, setProcessingLabel] = useState('');
  const [extraction, setExtraction] = useState<ExtractionApiResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Stashes the Firebase Storage upload result (path/url/size) for the save step. */
  const uploadMetaRef = useRef<{
    url: string;
    path: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  // ── Reviewed (editable) form state ──
  const [vendorName, setVendorName] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorStateCode, setVendorStateCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerStateCode, setCustomerStateCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<ReviewedLineItem[]>([]);
  const [createNewCustomer, setCreateNewCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // Reset everything when the dialog closes.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('select');
        setFile(null);
        setValidationError(null);
        setUploadPercent(0);
        setProcessingLabel('');
        setExtraction(null);
        setSaving(false);
        setRetryCount(0);
        setVendorName('');
        setVendorGstin('');
        setVendorAddress('');
        setVendorStateCode('');
        setCustomerName('');
        setCustomerGstin('');
        setCustomerAddress('');
        setCustomerStateCode('');
        setInvoiceNumber('');
        setInvoiceDate('');
        setDueDate('');
        setNotes('');
        setLineItems([]);
        setCreateNewCustomer(false);
        setSelectedCustomerId(null);
        setConfirmOverwrite(false);
        uploadMetaRef.current = null;
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Customer match (memoized against live customers + extracted buyer) ──
  const customerMatch = useMemo(() => {
    if (!extraction?.extracted) return null;
    return matchCustomer(extraction.extracted, customers, 'customer');
  }, [extraction, customers]);

  // ── Duplicate detection (memoized against live invoices) ──
  const duplicateResult = useMemo(() => {
    if (!extraction?.extracted) return null;
    return detectDuplicates(extraction.extracted, invoices);
  }, [extraction, invoices]);

  // ── Live totals preview ──
  const totalsPreview = useMemo(() => {
    if (lineItems.length === 0) return null;
    return calculateInvoiceTotals({
      items: lineItems.map((li) => ({
        id: li.productId ?? 'preview',
        productId: li.productId,
        description: li.description,
        hsnSac: li.hsnSac,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unitPrice,
        discount: li.discount,
        gstRate: li.gstRate,
      })),
      sellerStateCode: vendorStateCode || null,
      customerStateCode: customerStateCode || null,
      paidAmount: 0,
    });
  }, [lineItems, vendorStateCode, customerStateCode]);

  // ── File selection ──
  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    const v = validateInvoiceFile(f);
    if (!v.ok) {
      setValidationError(v.error ?? 'Invalid file.');
      setFile(null);
      return;
    }
    setValidationError(null);
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // ── Run the full upload + extraction pipeline ──
  const runPipeline = useCallback(async () => {
    if (!file) return;
    setStep('processing');
    setUploadPercent(0);
    setProcessingLabel('Uploading to Firebase Storage…');
    setExtraction(null);
    setRetryCount((c) => c + 1);

    let uploadResult;
    try {
      uploadResult = await uploadInvoiceFile(orgId, file, (pct) => {
        setUploadPercent(pct);
        if (pct >= 100) setProcessingLabel('Running Gemini AI extraction…');
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setValidationError(msg);
      setStep('select');
      toast.error('Upload failed', { description: msg });
      return;
    }

    // Compress (images only) + read as data URL, then call extraction API.
    try {
      setProcessingLabel('Preparing document for AI…');
      const { dataUrl, mimeType } = await compressForExtraction(file);
      setProcessingLabel('Running Gemini AI extraction…');
      const result = await callExtractionApi({
        dataUrl,
        mimeType,
        fileName: uploadResult.fileName,
        storageUrl: uploadResult.url,
      });
      if (!result.ok || !result.extracted) {
        throw new Error(result.error ?? 'AI extraction returned no data.');
      }
      setExtraction(result);
      hydrateReviewForm(result.extracted, uploadResult);
      setStep('review');
      toast.success('Extraction complete', {
        description: `Confidence ${Math.round(result.confidence * 100)}% · ${result.processingTimeMs}ms`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Extraction failed.';
      setValidationError(msg);
      setStep('select');
      toast.error('AI extraction failed', { description: msg });
    }
  }, [file, orgId]);

  // ── Hydrate the editable form from the extraction result ──
  function hydrateReviewForm(
    ex: ExtractedInvoice,
    upload: { url: string; path: string; fileName: string; mimeType: string; fileSize: number },
  ) {
    setVendorName(ex.vendorName ?? '');
    setVendorGstin(ex.vendorGstin ?? '');
    setVendorAddress(ex.vendorAddress ?? '');
    setVendorStateCode(ex.vendorStateCode ?? '');
    setCustomerName(ex.customerName ?? '');
    setCustomerGstin(ex.customerGstin ?? '');
    setCustomerAddress(ex.customerAddress ?? '');
    setCustomerStateCode(ex.customerStateCode ?? '');
    setInvoiceNumber(ex.invoiceNumber ?? '');
    setInvoiceDate(ex.invoiceDate ?? new Date().toISOString().slice(0, 10));
    setDueDate(ex.dueDate ?? '');
    setNotes('');

    const items: ReviewedLineItem[] = (ex.lineItems ?? []).map((li, idx) => {
      const match = matchProduct(li, products);
      return {
        productId: match?.product?.id ?? null,
        description: li.description ?? `Item ${idx + 1}`,
        hsnSac: li.hsnSac ?? '',
        quantity: li.quantity ?? 1,
        unit: 'NOS',
        unitPrice: li.unitPrice ?? 0,
        discount: 0,
        gstRate: li.gstRate != null ? sanitizeGstRate(li.gstRate) : 18,
        createNewProduct: match?.product == null,
      };
    });
    setLineItems(items.length > 0 ? items : [emptyLine()]);

    // Auto-pick the customer match if one exists.
    const match = matchCustomer(ex, customers, 'customer');
    if (match?.customer) {
      setSelectedCustomerId(match.customer.id);
      setCreateNewCustomer(false);
    } else {
      setSelectedCustomerId(null);
      setCreateNewCustomer(true);
    }

    // Stash upload metadata for the save step.
    uploadMetaRef.current = upload;
  }

  // ── Save the reviewed invoice ──
  const handleSave = useCallback(async () => {
    if (saving) return;
    if (lineItems.length === 0) {
      toast.error('Add at least one line item before saving.');
      return;
    }
    if (!vendorName.trim()) {
      toast.error('Vendor / seller name is required.');
      return;
    }
    if (!customerName.trim() && !selectedCustomerId && !createNewCustomer) {
      toast.error('Customer name is required, or pick an existing customer.');
      return;
    }
    if (duplicateResult?.isDuplicate && !confirmOverwrite) {
      toast.error('Possible duplicate detected — confirm to overwrite / save anyway.', {
        description: duplicateResult.top
          ? `Matches ${duplicateResult.top.invoice.invoiceNumber} (${Math.round(duplicateResult.top.score * 100)}%)`
          : undefined,
      });
      return;
    }

    setSaving(true);
    try {
      const upload = uploadMetaRef.current;
      // Resolve customer details: if an existing customer is selected, use their data.
      let resolvedCustomerId = selectedCustomerId;
      let resolvedCustomerName = customerName;
      let resolvedCustomerGstin = customerGstin || null;
      let resolvedCustomerAddress = customerAddress || null;
      let resolvedCustomerStateCode = customerStateCode || null;
      let resolvedCustomerState: string | null = null;

      if (selectedCustomerId) {
        const c = customers.find((x) => x.id === selectedCustomerId);
        if (c) {
          resolvedCustomerName = c.name;
          resolvedCustomerGstin = c.gstin;
          resolvedCustomerAddress = c.address;
          resolvedCustomerStateCode = c.stateCode;
          resolvedCustomerState = c.state;
        }
      } else if (customerStateCode) {
        // Derive state name from code.
        const entry = Object.entries(STATE_CODES).find(([, code]) => code === customerStateCode);
        if (entry) resolvedCustomerState = entry[0];
      }

      const invoice = await saveExtractedInvoice(orgId, {
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerGstin: resolvedCustomerGstin,
        customerAddress: resolvedCustomerAddress,
        customerState: resolvedCustomerState,
        customerStateCode: resolvedCustomerStateCode,
        createNewCustomer: !resolvedCustomerId && createNewCustomer,
        sellerName: vendorName,
        sellerGstin: vendorGstin || null,
        sellerAddress: vendorAddress || null,
        sellerStateCode: vendorStateCode || null,
        invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate: dueDate || null,
        notes: notes || null,
        lineItems,
        source: {
          type: 'upload',
          storageUrl: upload?.url ?? extraction?.storageUrl ?? null,
          storagePath: upload?.path ?? null,
          fileName: upload?.fileName ?? extraction?.fileName ?? null,
          mimeType: upload?.mimeType ?? null,
          fileSize: upload?.fileSize ?? null,
          aiExtraction: (extraction?.extracted as unknown as Record<string, unknown>) ?? null,
          aiModel: extraction?.model ?? null,
          confidence: extraction?.confidence ?? null,
          processingTimeMs: extraction?.processingTimeMs ?? null,
          uploadedAt: new Date().toISOString(),
        },
      });

      toast.success('Invoice saved', {
        description: `${invoice.invoiceNumber} · ${invoice.customerName} · ${formatINR(invoice.grandTotal)}`,
      });
      onSaved?.(invoice);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save the invoice.';
      toast.error('Save failed', { description: msg });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    lineItems,
    vendorName,
    customerName,
    selectedCustomerId,
    createNewCustomer,
    duplicateResult,
    confirmOverwrite,
    customers,
    customerGstin,
    customerAddress,
    customerStateCode,
    vendorGstin,
    vendorAddress,
    vendorStateCode,
    invoiceDate,
    dueDate,
    notes,
    extraction,
    orgId,
    onSaved,
    onOpenChange,
  ]);

  // ── Line item editing helpers ──
  function updateLine(idx: number, patch: Partial<ReviewedLineItem>) {
    setLineItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, ...patch } : li)),
    );
  }
  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }
  function removeLine(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function pickProductForLine(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setLineItems((prev) =>
      prev.map((li, i) =>
        i === idx
          ? {
              ...li,
              productId: p.id,
              description: p.name,
              hsnSac: p.hsnSac,
              unitPrice: p.price,
              gstRate: p.gstRate,
              unit: p.unit,
              createNewProduct: false,
            }
          : li,
      ),
    );
  }

  // ── Render ──
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden border-white/10 bg-[#0a0e1a] p-0">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg text-white">
            <UploadCloud className="h-5 w-5 text-emerald-400" />
            Upload Invoice — AI Extraction
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Upload a PDF or image. Gemini extracts GST data, matches customers &amp; products, then saves to Firestore.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(92vh-9rem)]">
          <div className="px-6 py-5">
            {step === 'select' && (
              <SelectStep
                file={file}
                dragOver={dragOver}
                validationError={validationError}
                fileInputRef={fileInputRef}
                onDrop={onDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onFileSelect={(e) => handleFile(e.target.files?.[0] ?? null)}
                onClearFile={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                onRun={runPipeline}
                retryCount={retryCount}
              />
            )}

            {step === 'processing' && (
              <ProcessingStep
                percent={uploadPercent}
                label={processingLabel}
                fileName={file?.name}
              />
            )}

            {step === 'review' && extraction && (
              <ReviewStep
                extraction={extraction}
                vendorName={vendorName}
                setVendorName={setVendorName}
                vendorGstin={vendorGstin}
                setVendorGstin={setVendorGstin}
                vendorAddress={vendorAddress}
                setVendorAddress={setVendorAddress}
                vendorStateCode={vendorStateCode}
                setVendorStateCode={setVendorStateCode}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerGstin={customerGstin}
                setCustomerGstin={setCustomerGstin}
                customerAddress={customerAddress}
                setCustomerAddress={setCustomerAddress}
                customerStateCode={customerStateCode}
                setCustomerStateCode={setCustomerStateCode}
                invoiceNumber={invoiceNumber}
                setInvoiceNumber={setInvoiceNumber}
                invoiceDate={invoiceDate}
                setInvoiceDate={setInvoiceDate}
                dueDate={dueDate}
                setDueDate={setDueDate}
                notes={notes}
                setNotes={setNotes}
                lineItems={lineItems}
                updateLine={updateLine}
                addLine={addLine}
                removeLine={removeLine}
                pickProductForLine={pickProductForLine}
                customers={customers}
                products={products}
                customerMatch={customerMatch}
                duplicateResult={duplicateResult}
                confirmOverwrite={confirmOverwrite}
                setConfirmOverwrite={setConfirmOverwrite}
                createNewCustomer={createNewCustomer}
                setCreateNewCustomer={setCreateNewCustomer}
                selectedCustomerId={selectedCustomerId}
                setSelectedCustomerId={setSelectedCustomerId}
                totalsPreview={totalsPreview}
              />
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-white/10 bg-white/[0.02] px-6 py-3">
          {step === 'select' && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 text-white/70 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={runPipeline}
                disabled={!file}
                className="bg-emerald-500 text-black hover:bg-emerald-400"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Upload &amp; Extract
              </Button>
            </>
          )}
          {step === 'processing' && (
            <Button disabled className="border-white/10 text-white/50">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing…
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('select');
                  setExtraction(null);
                }}
                className="border-white/10 text-white/70 hover:text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Start Over
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-500 text-black hover:bg-emerald-400"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {saving ? 'Saving…' : 'Save Invoice'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyLine(): ReviewedLineItem {
  return {
    productId: null,
    description: '',
    hsnSac: '',
    quantity: 1,
    unit: 'NOS',
    unitPrice: 0,
    discount: 0,
    gstRate: 18,
    createNewProduct: true,
  };
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

// ─── Step 1: Select ───────────────────────────────────────────────────────────

function SelectStep(props: {
  file: File | null;
  dragOver: boolean;
  validationError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onRun: () => void;
  retryCount: number;
}) {
  const { file, dragOver, validationError, fileInputRef } = props;
  return (
    <div className="space-y-5">
      <div
        onDrop={props.onDrop}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? 'border-emerald-400 bg-emerald-500/[0.06]'
            : 'border-white/15 bg-white/[0.02] hover:border-emerald-400/50 hover:bg-white/[0.03]'
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <UploadCloud className="h-7 w-7 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">
            Drop an invoice here, or click to browse
          </p>
          <p className="mt-1 text-xs text-white/40">
            PDF, JPG, JPEG, PNG · up to 20 MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={props.onFileSelect}
        />
      </div>

      {file && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileText className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{file.name}</p>
              <p className="text-xs text-white/40">
                {resolveMimeType(file)} · {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/40 hover:text-rose-300"
            onClick={(e) => {
              e.stopPropagation();
              props.onClearFile();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {validationError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/50">
        <p className="flex items-center gap-2 font-medium text-white/70">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          How it works
        </p>
        <ul className="mt-2 space-y-1 pl-6 list-disc">
          <li>File uploads to Firebase Storage under your organization.</li>
          <li>Gemini AI reads vendor, customer, GSTIN, line items, and GST amounts.</li>
          <li>Existing customers &amp; products are auto-matched — no duplicates.</li>
          <li>You review every field before saving to Firestore.</li>
          <li>Duplicate invoices are flagged for confirmation.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Step 2: Processing ───────────────────────────────────────────────────────

function ProcessingStep(props: {
  percent: number;
  label: string;
  fileName?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-12 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
        <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin" />
        <Sparkles className="h-8 w-8 text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{props.label}</p>
        {props.fileName && (
          <p className="text-xs text-white/40">{props.fileName}</p>
        )}
      </div>
      <div className="w-full max-w-md">
        <Progress value={props.percent} className="h-2 bg-white/10" />
        <p className="mt-2 text-xs text-white/40">{props.percent}%</p>
      </div>
      <p className="max-w-sm text-xs text-white/30">
        Gemini is reading the document. Multi-page PDFs may take 20–40 seconds.
      </p>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function ReviewStep(props: {
  extraction: ExtractionApiResponse;
  vendorName: string;
  setVendorName: (v: string) => void;
  vendorGstin: string;
  setVendorGstin: (v: string) => void;
  vendorAddress: string;
  setVendorAddress: (v: string) => void;
  vendorStateCode: string;
  setVendorStateCode: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerGstin: string;
  setCustomerGstin: (v: string) => void;
  customerAddress: string;
  setCustomerAddress: (v: string) => void;
  customerStateCode: string;
  setCustomerStateCode: (v: string) => void;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  lineItems: ReviewedLineItem[];
  updateLine: (idx: number, patch: Partial<ReviewedLineItem>) => void;
  addLine: () => void;
  removeLine: (idx: number) => void;
  pickProductForLine: (idx: number, productId: string) => void;
  customers: ReturnType<typeof useGSTpilotCustomers>['customers'];
  products: ReturnType<typeof useGSTpilotProducts>['products'];
  customerMatch: ReturnType<typeof matchCustomer> | null;
  duplicateResult: ReturnType<typeof detectDuplicates> | null;
  confirmOverwrite: boolean;
  setConfirmOverwrite: (v: boolean) => void;
  createNewCustomer: boolean;
  setCreateNewCustomer: (v: boolean) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (v: string | null) => void;
  totalsPreview: ReturnType<typeof calculateInvoiceTotals> | null;
}) {
  const ex = props.extraction;
  const confPct = Math.round((ex.confidence ?? 0) * 100);
  const confTone =
    confPct >= 75 ? 'emerald' : confPct >= 50 ? 'amber' : 'rose';

  return (
    <div className="space-y-5">
      {/* Confidence + notes */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <Badge
          className={`border ${
            confTone === 'emerald'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : confTone === 'amber'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          AI Confidence {confPct}%
        </Badge>
        <span className="text-xs text-white/40">
          Model: <span className="text-white/60">{ex.model}</span> · {ex.processingTimeMs}ms
        </span>
        {ex.notes.length > 0 && (
          <div className="w-full space-y-1 pt-1">
            {ex.notes.slice(0, 4).map((n, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-white/50">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                {n}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Duplicate warning */}
      {props.duplicateResult?.isDuplicate && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-200">
                Possible duplicate detected
              </p>
              {props.duplicateResult.matches.map((m, i) => (
                <p key={i} className="text-xs text-amber-300/80">
                  · {m.invoice.invoiceNumber} — {m.invoice.customerName} · ₹
                  {m.invoice.grandTotal.toFixed(2)} ({Math.round(m.score * 100)}% match: {m.reasons.join(', ')})
                </p>
              ))}
              <label className="flex items-center gap-2 pt-1 text-xs text-amber-200">
                <input
                  type="checkbox"
                  checked={props.confirmOverwrite}
                  onChange={(e) => props.setConfirmOverwrite(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-500/40 bg-transparent accent-amber-400"
                />
                I confirm this is not a duplicate — save anyway
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Invoice meta */}
      <Section title="Invoice Details" icon={<FileText className="h-4 w-4 text-emerald-400" />}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Invoice Number">
            <Input
              value={props.invoiceNumber}
              onChange={(e) => props.setInvoiceNumber(e.target.value)}
              placeholder="INV-2025-0001"
              className="border-white/10 bg-white/[0.03] text-white"
            />
          </Field>
          <Field label="Invoice Date">
            <Input
              type="date"
              value={props.invoiceDate}
              onChange={(e) => props.setInvoiceDate(e.target.value)}
              className="border-white/10 bg-white/[0.03] text-white"
            />
          </Field>
          <Field label="Due Date">
            <Input
              type="date"
              value={props.dueDate}
              onChange={(e) => props.setDueDate(e.target.value)}
              className="border-white/10 bg-white/[0.03] text-white"
            />
          </Field>
        </div>
      </Section>

      {/* Vendor (seller) */}
      <Section title="Vendor / Seller" icon={<Package className="h-4 w-4 text-violet-400" />}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Vendor Name">
            <Input
              value={props.vendorName}
              onChange={(e) => props.setVendorName(e.target.value)}
              placeholder="Acme Supplies Pvt Ltd"
              className="border-white/10 bg-white/[0.03] text-white"
            />
          </Field>
          <Field label="Vendor GSTIN">
            <Input
              value={props.vendorGstin}
              onChange={(e) => props.setVendorGstin(e.target.value.toUpperCase())}
              placeholder="27ABCDE1234F1Z5"
              className="border-white/10 bg-white/[0.03] text-white uppercase"
              maxLength={15}
            />
          </Field>
          <Field label="Vendor State Code">
            <Select
              value={props.vendorStateCode || 'none'}
              onValueChange={(v) => props.setVendorStateCode(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {Object.entries(STATE_CODES).map(([name, code]) => (
                  <SelectItem key={code} value={code}>
                    {code} — {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vendor Address">
            <Input
              value={props.vendorAddress}
              onChange={(e) => props.setVendorAddress(e.target.value)}
              placeholder="Address line"
              className="border-white/10 bg-white/[0.03] text-white"
            />
          </Field>
        </div>
      </Section>

      {/* Customer (buyer) — with matching */}
      <Section title="Customer / Buyer" icon={<UserPlus className="h-4 w-4 text-teal-400" />}>
        {props.customerMatch?.customer ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2 text-xs text-emerald-300">
            <Link2 className="h-4 w-4" />
            Matched existing customer: <strong>{props.customerMatch.customer.name}</strong>
            <span className="text-emerald-300/60">({props.customerMatch.reason})</span>
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            No existing customer matches. A new customer will be created on save.
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="radio"
              checked={!props.createNewCustomer}
              onChange={() => {
                props.setCreateNewCustomer(false);
                if (!props.selectedCustomerId) props.setSelectedCustomerId('__pick__');
              }}
              className="h-3.5 w-3.5 accent-emerald-400"
            />
            Use existing
          </label>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="radio"
              checked={props.createNewCustomer}
              onChange={() => {
                props.setCreateNewCustomer(true);
                props.setSelectedCustomerId(null);
              }}
              className="h-3.5 w-3.5 accent-emerald-400"
            />
            Create new
          </label>
        </div>
        {!props.createNewCustomer && (
          <div className="mb-3">
            <Field label="Pick existing customer">
              <Select
                value={props.selectedCustomerId ?? 'none'}
                onValueChange={(v) =>
                  props.setSelectedCustomerId(v === 'none' ? null : v)
                }
              >
                <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {props.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.gstin ? `(${c.gstin})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer Name">
            <Input
              value={props.customerName}
              onChange={(e) => props.setCustomerName(e.target.value)}
              disabled={!props.createNewCustomer && !!props.selectedCustomerId && props.selectedCustomerId !== 'none'}
              placeholder="Customer name"
              className="border-white/10 bg-white/[0.03] text-white disabled:opacity-50"
            />
          </Field>
          <Field label="Customer GSTIN">
            <Input
              value={props.customerGstin}
              onChange={(e) => props.setCustomerGstin(e.target.value.toUpperCase())}
              placeholder="29XYZAB5678C1Z9"
              maxLength={15}
              className="border-white/10 bg-white/[0.03] text-white uppercase"
            />
          </Field>
          <Field label="Customer State Code">
            <Select
              value={props.customerStateCode || 'none'}
              onValueChange={(v) => props.setCustomerStateCode(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="border-white/10 bg-white/[0.03] text-white">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {Object.entries(STATE_CODES).map(([name, code]) => (
                  <SelectItem key={code} value={code}>
                    {code} — {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Customer Address">
            <Input
              value={props.customerAddress}
              onChange={(e) => props.setCustomerAddress(e.target.value)}
              placeholder="Address line"
              className="border-white/10 bg-white/[0.03] text-white"
            />
          </Field>
        </div>
      </Section>

      {/* Line items */}
      <Section
        title="Line Items"
        icon={<Package className="h-4 w-4 text-amber-400" />}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={props.addLine}
            className="border-white/10 text-white/70 hover:text-white"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Item
          </Button>
        }
      >
        <div className="space-y-3">
          {props.lineItems.map((li, idx) => {
            const match = matchProduct(
              {
                description: li.description,
                hsnSac: li.hsnSac,
                quantity: li.quantity,
                unit: li.unit,
                unitPrice: li.unitPrice,
                taxableValue: null,
                gstRate: li.gstRate,
                cgst: null,
                sgst: null,
                igst: null,
                amount: null,
              },
              props.products,
            );
            return (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    {li.productId ? (
                      <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        <Link2 className="mr-1 h-3 w-3" />
                        {match?.product?.name ?? 'Linked product'}
                      </Badge>
                    ) : (
                      <Badge className="border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        <UserPlus className="mr-1 h-3 w-3" />
                        New product on save
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-white/40 hover:text-rose-300"
                    onClick={() => props.removeLine(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mb-2">
                  <Select
                    value={li.productId ?? 'none'}
                    onValueChange={(v) =>
                      v === 'none'
                        ? props.updateLine(idx, { productId: null, createNewProduct: true })
                        : props.pickProductForLine(idx, v)
                    }
                  >
                    <SelectTrigger className="h-8 border-white/10 bg-white/[0.03] text-xs text-white">
                      <SelectValue placeholder="Link to existing product (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— New product (create on save) —</SelectItem>
                      {props.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.hsnSac ? `· ${p.hsnSac}` : ''} · ₹{p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="col-span-2">
                    <Input
                      value={li.description}
                      onChange={(e) => props.updateLine(idx, { description: e.target.value })}
                      placeholder="Description"
                      className="h-8 border-white/10 bg-white/[0.03] text-xs text-white"
                    />
                  </div>
                  <Input
                    value={li.hsnSac}
                    onChange={(e) => props.updateLine(idx, { hsnSac: e.target.value })}
                    placeholder="HSN/SAC"
                    className="h-8 border-white/10 bg-white/[0.03] text-xs text-white"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={li.quantity}
                    onChange={(e) =>
                      props.updateLine(idx, { quantity: Number(e.target.value) || 0 })
                    }
                    placeholder="Qty"
                    className="h-8 border-white/10 bg-white/[0.03] text-xs text-white"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={li.unitPrice}
                    onChange={(e) =>
                      props.updateLine(idx, { unitPrice: Number(e.target.value) || 0 })
                    }
                    placeholder="Unit Price"
                    className="h-8 border-white/10 bg-white/[0.03] text-xs text-white"
                  />
                  <Select
                    value={String(li.gstRate)}
                    onValueChange={(v) =>
                      props.updateLine(idx, { gstRate: sanitizeGstRate(Number(v)) })
                    }
                  >
                    <SelectTrigger className="h-8 border-white/10 bg-white/[0.03] text-xs text-white">
                      <SelectValue placeholder="GST" />
                    </SelectTrigger>
                    <SelectContent>
                      {GST_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}% GST
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
          {props.lineItems.length === 0 && (
            <p className="py-4 text-center text-sm text-white/40">
              No line items. Click “Add Item” to create one.
            </p>
          )}
        </div>
      </Section>

      {/* Totals preview */}
      {props.totalsPreview && (
        <Section title="GST Summary (auto-calculated)" icon={<Sparkles className="h-4 w-4 text-emerald-400" />}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TotalsBox label="Taxable Value" value={formatINR(props.totalsPreview.taxableValue)} tone="white" />
            <TotalsBox
              label={props.totalsPreview.isIntraState ? 'CGST + SGST' : 'IGST'}
              value={formatINR(props.totalsPreview.cgst + props.totalsPreview.sgst + props.totalsPreview.igst)}
              tone="cyan"
            />
            <TotalsBox label="Total GST" value={formatINR(props.totalsPreview.totalTax)} tone="amber" />
            <TotalsBox label="Grand Total" value={formatINR(props.totalsPreview.grandTotal)} tone="emerald" />
          </div>
          <p className="mt-2 text-xs text-white/40">
            {props.totalsPreview.isIntraState
              ? 'Intra-state sale → CGST + SGST (split equally).'
              : 'Inter-state sale → IGST (full GST to centre).'}
          </p>
        </Section>
      )}

      {/* Notes */}
      <Section title="Notes" icon={<FileText className="h-4 w-4 text-white/40" />}>
        <Textarea
          value={props.notes}
          onChange={(e) => props.setNotes(e.target.value)}
          placeholder="Optional notes printed on the invoice…"
          className="min-h-[60px] border-white/10 bg-white/[0.03] text-white"
        />
      </Section>
    </div>
  );
}

// ─── Small presentational helpers ─────────────────────────────────────────────

function Section(props: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          {props.icon}
          {props.title}
        </h3>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-white/50">{props.label}</Label>
      {props.children}
    </div>
  );
}

function TotalsBox(props: {
  label: string;
  value: string;
  tone: 'white' | 'cyan' | 'amber' | 'emerald';
}) {
  const toneCls =
    props.tone === 'cyan'
      ? 'text-cyan-300'
      : props.tone === 'amber'
        ? 'text-amber-300'
        : props.tone === 'emerald'
          ? 'text-emerald-300'
          : 'text-white';
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-xs text-white/40">{props.label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneCls}`}>{props.value}</p>
    </div>
  );
}
