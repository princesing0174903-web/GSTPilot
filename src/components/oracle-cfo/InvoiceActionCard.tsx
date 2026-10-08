'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Invoice Action Card (Production)
//
// Renders inline below an Oracle assistant message when the user asks to
// create an invoice. This is the REAL production flow:
//
//   1. Detects intent → shows extraction summary
//   2. If customer needs selection → shows customer picker
//   3. If fields missing → asks for them
//   4. Shows full approval summary (Customer / Invoice / GST / Total / Due Date)
//   5. Approve → REAL Firestore write + PDF + Email + WhatsApp
//   6. Shows execution result with PDF download + delivery status
//   7. Cancel → no changes made
//
// Dark theme matching Oracle workspace. Emerald accent. NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GSTCalculation {
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  grandTotal: number;
  isInterState: boolean;
  reverseCharge: boolean;
  isExempt: boolean;
  calculationSteps: Array<{ label: string; value: string }>;
}

interface ApprovalSummary {
  customer: { name: string; gstin: string | null; email: string | null; phone: string | null; state: string | null };
  invoice: { number: string; date: string; dueDate: string; currency: string };
  amounts: { taxable: number; gst: number; total: number; grandTotal: number };
  gst: { rate: number; cgst: number; sgst: number; igst: number; isInterState: boolean; reverseCharge: boolean };
  description: string | null;
  paymentTerms: string | null;
  hsnCode: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  legalName?: string;
  gstin: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  stateCode: string | null;
  entityType: string;
  isNew?: boolean;
}

interface CreateResponse {
  step: 'review' | 'customer-required' | 'missing-fields';
  approvalId?: string;
  intent?: any;
  customer?: ClientOption;
  customerLookup?: {
    matched: ClientOption | null;
    alternatives: ClientOption[];
    needsSelection: boolean;
    needsCreation: boolean;
  };
  invoiceNumber?: { invoiceNumber: string; sequence: number; financialYear: string; series: string };
  gst?: GSTCalculation;
  summary?: ApprovalSummary;
  seller?: { gstin: string; state: string | null; stateCode: string | null };
  integrations?: {
    email: { connected: boolean; provider: string | null; fromEmail: string | null };
    whatsapp: { connected: boolean; provider: string | null; phoneNumber: string | null };
  };
  placeOfSupply?: string;
  hsnCode?: string;
  missingFields?: string[];
  message: string;
  durationMs: number;
}

interface ExecuteResult {
  success: boolean;
  status: string;
  invoiceId: string;
  invoiceNumber: string;
  message: string;
  recordsAffected: Array<{ collection: string; id: string; action: string }>;
  pdfGenerated: boolean;
  pdfBase64?: string;
  email: { sent: boolean; status: string; message: string };
  whatsapp: { sent: boolean; status: string; message: string };
  executionMs: number;
}

interface InvoiceActionCardProps {
  userMessage: string;
  organizationId: string;
  firmId: string | null;
  userId: string;
  userEmail: string;
  sellerDetails?: {
    tradeName: string;
    legalName?: string;
    gstin: string;
    address?: string;
    state?: string;
    stateCode?: string;
    email?: string;
    phone?: string;
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function InvoiceActionCard({
  userMessage,
  organizationId,
  firmId,
  userId,
  userEmail,
  sellerDetails,
}: InvoiceActionCardProps) {
  const [phase, setPhase] = useState<'analyzing' | 'review' | 'customer-required' | 'missing-fields' | 'executing' | 'executed' | 'failed' | 'cancelled'>('analyzing');
  const [createResponse, setCreateResponse] = useState<CreateResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<ApprovalSummary | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // ─── Step 1: Analyze the message ────────────────────────────────────
  const analyze = useCallback(async () => {
    setPhase('analyzing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/invoice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          organizationId,
          firmId,
          userId,
          userEmail,
          sellerGstin: sellerDetails?.gstin,
          sellerState: sellerDetails?.state,
          sellerStateCode: sellerDetails?.stateCode,
        }),
      });
      const data: CreateResponse = await res.json();
      if (!res.ok) throw new Error(data.message || 'Analysis failed');
      setCreateResponse(data);
      setEditedSummary(data.summary ?? null);
      if (data.step === 'review') setPhase('review');
      else if (data.step === 'customer-required') setPhase('customer-required');
      else if (data.step === 'missing-fields') setPhase('missing-fields');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze invoice request');
      setPhase('failed');
    }
  }, [userMessage, organizationId, firmId, userId, userEmail, sellerDetails]);

  // Auto-analyze on mount (once)
  const analyzedRef = useRef(false);
  useEffect(() => {
    if (!analyzedRef.current && phase === 'analyzing' && !createResponse) {
      analyzedRef.current = true;
      void analyze();
    }
  }, [phase, createResponse, analyze]);

  // ─── Step 2: Execute after approval ─────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!editedSummary || !createResponse) return;
    setPhase('executing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/invoice/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          summary: editedSummary,
          sellerDetails: {
            tradeName: sellerDetails?.tradeName ?? 'VEYRO',
            legalName: sellerDetails?.legalName ?? sellerDetails?.tradeName ?? 'VEYRO',
            gstin: createResponse.seller?.gstin ?? sellerDetails?.gstin ?? '',
            address: sellerDetails?.address ?? '',
            state: createResponse.seller?.state ?? sellerDetails?.state ?? '',
            stateCode: createResponse.seller?.stateCode ?? sellerDetails?.stateCode ?? '',
            email: sellerDetails?.email ?? userEmail,
            phone: sellerDetails?.phone ?? '',
          },
          clientId: createResponse.customer?.id,
          customerGstin: editedSummary.customer.gstin,
          placeOfSupply: createResponse.placeOfSupply,
          hsnCode: createResponse.hsnCode ?? editedSummary.hsnCode,
          organizationId,
          firmId,
          userId,
          userEmail,
        }),
      });
      const data: ExecuteResult = await res.json();
      if (!res.ok) throw new Error(data.message || 'Execution failed');
      setExecuteResult(data);
      setPhase(data.success ? 'executed' : 'failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
      setPhase('failed');
    }
  }, [editedSummary, createResponse, sellerDetails, userEmail, organizationId, firmId, userId]);

  // ─── Cancel ─────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    setPhase('cancelled');
    // Notify the execute endpoint about rejection (best-effort)
    if (createResponse?.approvalId) {
      try {
        await fetch('/api/oracle/cfo/invoice/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'rejected',
            organizationId,
            userId,
            userEmail,
          }),
        });
      } catch {
        // best-effort
      }
    }
  }, [createResponse, organizationId, userId, userEmail]);

  // ─── Download PDF ───────────────────────────────────────────────────
  const handleDownloadPDF = useCallback(() => {
    if (!executeResult?.pdfBase64) return;
    const binary = atob(executeResult.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `invoice-${executeResult.invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [executeResult]);

  // ─── Retry ──────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setCreateResponse(null);
    setExecuteResult(null);
    setError(null);
    setPhase('analyzing');
    void analyze();
  }, [analyze]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3 overflow-hidden rounded-xl border"
      style={{ borderColor: 'rgba(37,99,235,0.2)', background: '#0a0a0a' }}
    >
      {/* ─── Header ─── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(5,150,105,0.04) 100%)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(5,150,105,0.25) 100%)' }}
          >
            <FileText className="h-5 w-5" style={{ color: '#2563EB' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Create Invoice</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'rgba(37,99,235,0.15)', color: '#2563EB' }}
              >
                Production
              </span>
            </div>
            <div className="text-xs text-white/50">
              {phase === 'analyzing' && 'Analyzing your request…'}
              {phase === 'review' && 'Ready for approval'}
              {phase === 'customer-required' && 'Customer selection needed'}
              {phase === 'missing-fields' && 'Missing information'}
              {phase === 'executing' && 'Creating invoice…'}
              {phase === 'executed' && 'Invoice created successfully'}
              {phase === 'failed' && 'Action failed'}
              {phase === 'cancelled' && 'Cancelled'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase === 'analyzing' && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
          {phase === 'executing' && <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#2563EB' }} />}
          {phase === 'executed' && <CheckCircle2 className="h-4 w-4" style={{ color: '#2563EB' }} />}
          {phase === 'failed' && <AlertTriangle className="h-4 w-4" style={{ color: '#ef4444' }} />}
          {phase === 'cancelled' && <X className="h-4 w-4 text-white/40" />}
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="px-4 py-4 space-y-4">
        {/* ANALYZING */}
        {phase === 'analyzing' && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#2563EB' }} />
            <div className="text-sm text-white/60">
              <div>Extracting invoice details from your message…</div>
              <div className="text-xs text-white/40 mt-0.5">Customer, amount, GST rate, dates, payment terms</div>
            </div>
          </div>
        )}

        {/* CUSTOMER REQUIRED */}
        {phase === 'customer-required' && createResponse?.customerLookup && (
          <CustomerPicker
            alternatives={createResponse.customerLookup.alternatives}
            needsCreation={createResponse.customerLookup.needsCreation}
            query={createResponse.intent?.customerName ?? ''}
            onSelect={(client) => {
              // Re-analyze with selected client — for simplicity, we update the summary directly
              if (createResponse.summary) {
                setEditedSummary({
                  ...createResponse.summary,
                  customer: {
                    name: client.name,
                    gstin: client.gstin,
                    email: client.email,
                    phone: client.phone,
                    state: client.state,
                  },
                });
              }
              setCreateResponse({
                ...createResponse,
                customer: client,
                step: 'review',
              });
              setPhase('review');
            }}
            onCreateNew={() => {
              setPhase('missing-fields');
              setError('To create a new client, please provide their name, GSTIN (if available), email, and phone. You can add the client in the Clients page and then retry this invoice.');
            }}
          />
        )}

        {/* MISSING FIELDS */}
        {phase === 'missing-fields' && (
          <div
            className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
            style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <div className="text-sm">
              <div className="font-semibold text-white">Missing information</div>
              <div className="text-white/70 text-xs mt-1">
                {error || createResponse?.message || 'Some required details are missing. Please provide them and try again.'}
              </div>
              {createResponse?.missingFields && (
                <div className="text-white/50 text-xs mt-1 font-mono">
                  Missing: {createResponse.missingFields.join(', ')}
                </div>
              )}
              <button
                onClick={handleRetry}
                className="mt-3 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/5 transition-all"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <ArrowRight className="h-3.5 w-3.5" /> Retry with more details
              </button>
            </div>
          </div>
        )}

        {/* REVIEW — the approval summary */}
        {phase === 'review' && editedSummary && createResponse && (
          <ApprovalSummaryView
            summary={editedSummary}
            gst={createResponse.gst}
            invoiceNumber={createResponse.invoiceNumber?.invoiceNumber}
            customer={createResponse.customer}
            integrations={createResponse.integrations}
            isEditing={isEditing}
            onToggleEdit={() => setIsEditing((e) => !e)}
            onSummaryChange={setEditedSummary}
          />
        )}

        {/* EXECUTING */}
        {phase === 'executing' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#2563EB' }} />
              <div className="text-sm text-white/80">
                <div className="font-medium">Creating invoice…</div>
                <div className="text-xs text-white/50 mt-0.5">Writing to database · Generating PDF · Sending notifications</div>
              </div>
            </div>
            <div className="space-y-1.5 pl-8">
              {['Writing invoice to Firestore', 'Creating activity log', 'Generating PDF with QR code', 'Sending email', 'Sending WhatsApp'].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/40">
                  <div className="h-1 w-1 rounded-full bg-white/30" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXECUTED — success result */}
        {phase === 'executed' && executeResult && (
          <ExecutionResultView result={executeResult} onDownloadPDF={handleDownloadPDF} />
        )}

        {/* FAILED */}
        {phase === 'failed' && (
          <div
            className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
            style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div className="text-sm">
              <div className="font-semibold text-white">Something went wrong</div>
              <div className="text-white/60 text-xs mt-0.5">
                {error || executeResult?.message || 'An unexpected error occurred.'}
              </div>
              <div className="text-white/40 text-xs mt-1">
                Any partial changes have been rolled back. Your data is safe.
              </div>
              <button
                onClick={handleRetry}
                className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
              >
                <ArrowRight className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          </div>
        )}

        {/* CANCELLED */}
        {phase === 'cancelled' && (
          <div className="flex items-center gap-2 py-2 text-sm text-white/50">
            <X className="h-4 w-4" />
            Invoice creation cancelled. No changes were made to your data.
          </div>
        )}

        {/* ERROR (general) */}
        {error && phase !== 'failed' && phase !== 'missing-fields' && (
          <div
            className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
            style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div className="text-sm text-white/70">{error}</div>
          </div>
        )}

        {/* APPROVAL BUTTONS */}
        {phase === 'review' && (
          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button
              type="button"
              onClick={handleApprove}
              className="flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
            >
              <Check className="h-4 w-4" />
              Approve Invoice
            </button>
            <button
              type="button"
              onClick={() => setIsEditing((e) => !e)}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium text-white/70 transition-all hover:text-white hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Pencil className="h-4 w-4" />
              {isEditing ? 'Done Editing' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium text-white/50 transition-all hover:text-white/80"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <div className="ml-auto flex items-center gap-1 text-xs text-white/40">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
              Audit logged
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Customer Picker ────────────────────────────────────────────────────────

function CustomerPicker({
  alternatives,
  needsCreation,
  query,
  onSelect,
  onCreateNew,
}: {
  alternatives: ClientOption[];
  needsCreation: boolean;
  query: string;
  onSelect: (client: ClientOption) => void;
  onCreateNew: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4" style={{ color: '#2563EB' }} />
        <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">
          {alternatives.length > 0 ? 'Select Customer' : 'No Match Found'}
        </h4>
      </div>
      <p className="text-sm text-white/70">
        {alternatives.length > 0
          ? `I found ${alternatives.length} customers matching "${query}". Which one is this invoice for?`
          : `No existing customer matches "${query}". You can create a new one or try a different name.`}
      </p>
      <div className="space-y-2">
        {alternatives.map((client) => (
          <button
            key={client.id}
            onClick={() => onSelect(client)}
            className="w-full text-left rounded-lg border px-3 py-2.5 transition-all hover:bg-white/5"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{client.name}</div>
                <div className="text-xs text-white/50 truncate">
                  {client.gstin} {client.state && `· ${client.state}`}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 shrink-0" />
            </div>
          </button>
        ))}
      </div>
      {needsCreation && (
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium text-white/70 transition-all hover:text-white hover:bg-white/5"
          style={{ borderColor: 'rgba(37,99,235,0.3)' }}
        >
          <Plus className="h-4 w-4" style={{ color: '#2563EB' }} />
          Create new customer
        </button>
      )}
    </div>
  );
}

// ─── Approval Summary View ──────────────────────────────────────────────────

function ApprovalSummaryView({
  summary,
  gst,
  invoiceNumber,
  customer,
  integrations,
  isEditing,
  onToggleEdit,
  onSummaryChange,
}: {
  summary: ApprovalSummary;
  gst?: GSTCalculation;
  invoiceNumber?: string;
  customer?: ClientOption;
  integrations?: CreateResponse['integrations'];
  isEditing: boolean;
  onToggleEdit: () => void;
  onSummaryChange: (s: ApprovalSummary) => void;
}) {
  const update = (path: string, value: unknown) => {
    const updated = JSON.parse(JSON.stringify(summary)) as ApprovalSummary;
    const parts = path.split('.');
    let obj: any = updated;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    // Recalculate totals if amount or rate changed
    if (path === 'amounts.grandTotal' || path === 'gst.rate') {
      const amount = Number(updated.amounts.grandTotal);
      const rate = Number(updated.gst.rate);
      const taxable = Math.round((amount / (1 + rate / 100)) * 100) / 100;
      const gstAmt = Math.round((amount - taxable) * 100) / 100;
      updated.amounts.taxable = taxable;
      updated.amounts.gst = gstAmt;
      updated.amounts.total = amount;
      if (updated.gst.isInterState) {
        updated.gst.igst = gstAmt;
        updated.gst.cgst = 0;
        updated.gst.sgst = 0;
      } else {
        updated.gst.cgst = Math.round((gstAmt / 2) * 100) / 100;
        updated.gst.sgst = Math.round((gstAmt / 2) * 100) / 100;
        updated.gst.igst = 0;
      }
    }
    onSummaryChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Customer + Invoice meta */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0d0d0d' }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/50">Customer</span>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={summary.customer.name}
              onChange={(e) => update('customer.name', e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-white border-b border-white/10 focus:border-emerald-500/50 focus:outline-none pb-0.5"
            />
          ) : (
            <div className="text-sm font-semibold text-white">{summary.customer.name}</div>
          )}
          {summary.customer.gstin && (
            <div className="text-xs text-white/50 font-mono mt-0.5">{summary.customer.gstin}</div>
          )}
          {summary.customer.state && (
            <div className="text-xs text-white/40 mt-0.5">{summary.customer.state}</div>
          )}
          {customer?.isNew && (
            <span
              className="inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
            >
              New Customer
            </span>
          )}
        </div>

        <div
          className="rounded-lg border p-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0d0d0d' }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
            <span className="text-[10px] font-bold uppercase tracking-wide text-white/50">Invoice</span>
          </div>
          <div className="text-sm font-mono font-semibold text-white">
            {invoiceNumber ?? summary.invoice.number}
          </div>
          <div className="text-xs text-white/50 mt-0.5">
            Date: {formatDate(summary.invoice.date)}
          </div>
          <div className="text-xs text-white/50">
            Due: {formatDate(summary.invoice.dueDate)}
          </div>
        </div>
      </div>

      {/* GST breakdown */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: 'rgba(37,99,235,0.04)' }}>
          <Zap className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">
            GST Calculation · {summary.gst.isInterState ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'}
          </span>
        </div>
        <div>
          <CalcRow label="Taxable Value" value={`₹${summary.amounts.taxable.toLocaleString('en-IN')}`} />
          {summary.gst.isInterState ? (
            <CalcRow label={`IGST @ ${summary.gst.rate}%`} value={`₹${summary.gst.igst.toLocaleString('en-IN')}`} />
          ) : (
            <>
              <CalcRow label={`CGST @ ${summary.gst.rate / 2}%`} value={`₹${summary.gst.cgst.toLocaleString('en-IN')}`} />
              <CalcRow label={`SGST @ ${summary.gst.rate / 2}%`} value={`₹${summary.gst.sgst.toLocaleString('en-IN')}`} />
            </>
          )}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ background: 'rgba(37,99,235,0.06)' }}
          >
            <span className="text-sm font-bold text-white">Grand Total</span>
            {isEditing ? (
              <input
                type="number"
                value={summary.amounts.grandTotal}
                onChange={(e) => update('amounts.grandTotal', Number(e.target.value))}
                className="w-32 bg-transparent text-right text-sm font-mono font-bold text-white border-b border-white/10 focus:border-emerald-500/50 focus:outline-none"
              />
            ) : (
              <span className="text-sm font-mono font-bold" style={{ color: '#2563EB' }}>
                ₹{summary.amounts.grandTotal.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {summary.description && (
        <div
          className="rounded-lg border px-3 py-2"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0d0d0d' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/50 mb-1">Description</div>
          <div className="text-sm text-white/80">{summary.description}</div>
        </div>
      )}

      {/* Integration status */}
      {integrations && (
        <div className="flex flex-wrap gap-2">
          <IntegrationChip
            icon={Mail}
            label="Email"
            connected={integrations.email.connected}
            detail={integrations.email.connected ? integrations.email.provider ?? 'Connected' : 'Not connected'}
          />
          <IntegrationChip
            icon={MessageCircle}
            label="WhatsApp"
            connected={integrations.whatsapp.connected}
            detail={integrations.whatsapp.connected ? integrations.whatsapp.provider ?? 'Connected' : 'Not connected'}
          />
        </div>
      )}

      {/* HSN + Place of Supply */}
      <div className="flex items-center gap-4 text-xs text-white/40">
        <span>HSN/SAC: <span className="text-white/60 font-mono">{summary.hsnCode ?? '998314'}</span></span>
        <span>·</span>
        <span>Currency: <span className="text-white/60">{summary.invoice.currency}</span></span>
        {summary.gst.reverseCharge && (
          <>
            <span>·</span>
            <span style={{ color: '#f59e0b' }}>Reverse Charge</span>
          </>
        )}
      </div>
    </div>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 text-sm"
      style={{ background: '#0d0d0d' }}
    >
      <span className="text-white/60">{label}</span>
      <span className="font-mono font-semibold text-white">{value}</span>
    </div>
  );
}

function IntegrationChip({
  icon: Icon,
  label,
  connected,
  detail,
}: {
  icon: typeof Mail;
  label: string;
  connected: boolean;
  detail: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
      style={{
        borderColor: connected ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)',
        background: connected ? 'rgba(37,99,235,0.04)' : '#0d0d0d',
      }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: connected ? '#2563EB' : 'rgba(255,255,255,0.3)' }} />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">{label}</span>
        <span className="text-[10px]" style={{ color: connected ? '#2563EB' : 'rgba(255,255,255,0.4)' }}>
          {detail}
        </span>
      </div>
    </div>
  );
}

// ─── Execution Result View ──────────────────────────────────────────────────

function ExecutionResultView({
  result,
  onDownloadPDF,
}: {
  result: ExecuteResult;
  onDownloadPDF: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Success header */}
      <div
        className="rounded-lg border px-3 py-3 flex items-start gap-3"
        style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.05)' }}
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#2563EB' }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Invoice created successfully</div>
          <div className="text-xs text-white/60 mt-1">
            <span className="font-mono text-white/80">{result.invoiceNumber}</span>
            {' · '}
            <span className="text-white/40">{result.executionMs}ms</span>
          </div>
        </div>
      </div>

      {/* Records affected */}
      {result.recordsAffected.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/50 mb-1.5">
            Records created
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.recordsAffected.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono"
                style={{ background: 'rgba(37,99,235,0.08)', color: 'rgba(37,99,235,0.8)' }}
              >
                <Check className="h-2.5 w-2.5" />
                {r.collection}/{r.id.slice(-8)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PDF Download */}
      {result.pdfGenerated && result.pdfBase64 && (
        <button
          onClick={onDownloadPDF}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
        >
          <Download className="h-4 w-4" />
          Download Invoice PDF
        </button>
      )}

      {/* Email status */}
      <DeliveryStatusRow
        icon={Mail}
        label="Email"
        status={result.email.status}
        message={result.email.message}
      />

      {/* WhatsApp status */}
      <DeliveryStatusRow
        icon={MessageCircle}
        label="WhatsApp"
        status={result.whatsapp.status}
        message={result.whatsapp.message}
      />

      {/* Audit confirmation */}
      <div className="flex items-center gap-1.5 text-xs text-white/40 pt-1">
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
        <span>Full audit trail recorded · Dashboard will refresh automatically</span>
      </div>
    </div>
  );
}

function DeliveryStatusRow({
  icon: Icon,
  label,
  status,
  message,
}: {
  icon: typeof Mail;
  label: string;
  status: string;
  message: string;
}) {
  const isSuccess = status === 'sent';
  const isNotConnected = status === 'not-connected';
  const color = isSuccess ? '#2563EB' : isNotConnected ? '#f59e0b' : '#ef4444';
  const bgColor = isSuccess ? 'rgba(37,99,235,0.04)' : isNotConnected ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)';
  const borderColor = isSuccess ? 'rgba(37,99,235,0.15)' : isNotConnected ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';

  return (
    <div
      className="rounded-lg border px-3 py-2 flex items-start gap-2.5"
      style={{ borderColor, background: bgColor }}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
            style={{ background: `${color}15`, color }}
          >
            {status}
          </span>
        </div>
        <div className="text-xs text-white/60 mt-1 leading-relaxed">{message}</div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}
