'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Payment Link Action Card (Production)
//
// Renders inline below an Oracle assistant message when the user asks to create
// a payment link. This is the REAL production flow:
//
//   1. Detects intent → calls /create to extract + validate + detect provider
//   2. If blocked (no invoice / no provider) → shows clear blocking reason
//   3. Shows full approval summary (Customer / Invoice / Amount / Provider / Expiry / Fees)
//   4. Approve → calls /execute → REAL provider API → persist → email + WhatsApp
//   5. Shows execution result with link URL + copy button + delivery status
//   6. Cancel → no changes made
//
// Dark theme matching Oracle workspace. Emerald accent. NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

// ─── Types (mirror of payment-link-engine.ts) ───────────────────────────────

interface PaymentLinkIntent {
  invoiceNumber: string | null;
  invoiceId: string | null;
  customerName: string | null;
  amount: number | null;
  currency: string;
  provider: 'razorpay' | 'stripe' | 'auto' | null;
  dueDate: string | null;
  notes: string | null;
  missingFields: string[];
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  status: string;
  dueDate: string | null;
  invoiceDate: string | null;
}

interface ProviderIntegration {
  connected: boolean;
  provider: 'razorpay' | 'stripe' | null;
  testMode: boolean;
}

interface ApprovalSummary {
  intent: PaymentLinkIntent;
  invoice: InvoiceRecord | null;
  provider: ProviderIntegration;
  amount: number;
  currency: string;
  linkExpiry: string;
  paymentMethods: string[];
  estimatedFees: { percentage: number; fixed: number; estimated: number };
  delivery: { email: boolean; whatsapp: boolean; emailNote: string; whatsappNote: string };
  warnings: string[];
  canProceed: boolean;
  blockingReasons: string[];
}

interface CreateResponse {
  intent: PaymentLinkIntent;
  approval: ApprovalSummary;
  durationMs: number;
}

interface ExecuteResult {
  success: boolean;
  message: string;
  paymentId: string | null;
  providerPaymentId: string | null;
  linkUrl: string | null;
  linkExpiry: string | null;
  status: string;
  emailDelivery: { sent: boolean; message: string };
  whatsappDelivery: { sent: boolean; message: string };
  recordsAffected: Array<{ collection: string; id: string; action: string }>;
  rollbackStatus: string;
  error?: string;
  durationMs?: number;
}

interface PaymentLinkActionCardProps {
  userMessage: string;
  organizationId: string;
  firmId: string | null;
  userId: string;
  userEmail: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PaymentLinkActionCard({
  userMessage,
  organizationId,
  firmId,
  userId,
  userEmail,
}: PaymentLinkActionCardProps) {
  const [phase, setPhase] = useState<'analyzing' | 'review' | 'blocked' | 'executing' | 'executed' | 'failed' | 'cancelled'>('analyzing');
  const [createResponse, setCreateResponse] = useState<CreateResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Step 1: Analyze ──
  const analyze = useCallback(async () => {
    setPhase('analyzing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/payment-link/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          organizationId,
          firmId,
          userId,
          userEmail,
        }),
      });
      const data: CreateResponse = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setCreateResponse(data);
      if (data.approval.canProceed) {
        setPhase('review');
      } else {
        setPhase('blocked');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze payment link request');
      setPhase('failed');
    }
  }, [userMessage, organizationId, firmId, userId, userEmail]);

  const analyzedRef = useRef(false);
  useEffect(() => {
    if (!analyzedRef.current && phase === 'analyzing' && !createResponse) {
      analyzedRef.current = true;
      void analyze();
    }
  }, [phase, createResponse, analyze]);

  // ─── Step 2: Execute after approval ──
  const handleApprove = useCallback(async () => {
    if (!createResponse) return;
    setPhase('executing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/payment-link/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: createResponse.intent,
          organizationId,
          firmId,
          userId,
          userEmail,
        }),
      });
      const data: ExecuteResult = await res.json();
      setExecuteResult(data);
      if (data.success) {
        setPhase('executed');
      } else {
        // If the link was actually created (linkUrl present) but persistence failed
        // (preview mode), show it as a partial success
        if (data.linkUrl) {
          setPhase('executed');
        } else {
          setPhase('failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute payment link creation');
      setPhase('failed');
    }
  }, [createResponse, organizationId, firmId, userId, userEmail]);

  const handleCancel = useCallback(() => {
    setPhase('cancelled');
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!executeResult?.linkUrl) return;
    try {
      await navigator.clipboard.writeText(executeResult.linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [executeResult]);

  // ─── Render ──
  const inr = (n: number, currency = 'INR') => {
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
    return `${symbol}${n.toLocaleString('en-IN')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl border overflow-hidden"
      style={{ borderColor: 'rgba(37,99,235,0.2)', background: '#0a0a0a' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(20,184,166,0.04) 100%)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard className="h-4 w-4 shrink-0" style={{ color: '#2563EB' }} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Payment Link Creation</div>
            <div className="text-xs text-white/50">
              {phase === 'analyzing' && 'Analyzing your request…'}
              {phase === 'review' && 'Review the details and approve'}
              {phase === 'blocked' && 'Action required before proceeding'}
              {phase === 'executing' && 'Creating payment link via provider…'}
              {phase === 'executed' && 'Payment link created successfully'}
              {phase === 'failed' && 'Creation failed'}
              {phase === 'cancelled' && 'Cancelled — no changes made'}
            </div>
          </div>
        </div>
        {createResponse && (
          <code className="text-[10px] text-white/40 font-mono shrink-0 hidden sm:block">
            {createResponse.durationMs}ms
          </code>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ── ANALYZING ── */}
        {phase === 'analyzing' && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#2563EB' }} />
            <div className="text-sm text-white/70">
              Looking up the invoice, checking the connected payment provider, and building the approval summary…
            </div>
          </div>
        )}

        {/* ── BLOCKED ── */}
        {phase === 'blocked' && createResponse && (
          <div className="space-y-3">
            <div
              className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
              style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <div className="text-sm">
                <div className="font-semibold text-white">Cannot create payment link yet</div>
                <div className="text-white/60 text-xs mt-1">
                  The following must be resolved before Oracle can create a real payment link:
                </div>
              </div>
            </div>
            <ul className="space-y-2">
              {createResponse.approval.blockingReasons.map((reason, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs text-white/70"
                  style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}
                >
                  <X className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            {createResponse.approval.warnings.length > 0 && (
              <div className="space-y-1.5">
                {createResponse.approval.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {phase === 'review' && createResponse && createResponse.approval.invoice && (
          <div className="space-y-4">
            {/* Customer + Invoice */}
            <section>
              <SectionLabel icon={<Building2Icon />} label="Customer & Invoice" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoCell label="Customer" value={createResponse.approval.invoice.clientName} />
                <InfoCell label="Invoice Number" value={createResponse.approval.invoice.invoiceNumber} />
                <InfoCell label="Invoice Status" value={createResponse.approval.invoice.status.toUpperCase()} />
                <InfoCell
                  label="Outstanding Balance"
                  value={inr(createResponse.approval.invoice.balanceDue, createResponse.approval.invoice.currency)}
                  highlight
                />
                {createResponse.approval.invoice.clientEmail && (
                  <InfoCell label="Customer Email" value={createResponse.approval.invoice.clientEmail} />
                )}
                {createResponse.approval.invoice.clientPhone && (
                  <InfoCell label="Customer Phone" value={createResponse.approval.invoice.clientPhone} />
                )}
              </div>
            </section>

            {/* Payment Details */}
            <section>
              <SectionLabel icon={<CreditCard className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="Payment Details" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoCell
                  label="Payment Amount"
                  value={inr(createResponse.approval.amount, createResponse.approval.currency)}
                  highlight
                />
                <InfoCell label="Currency" value={createResponse.approval.currency} />
                <InfoCell
                  label="Provider"
                  value={
                    createResponse.approval.provider.provider === 'razorpay'
                      ? `Razorpay${createResponse.approval.provider.testMode ? ' (Test)' : ''}`
                      : `Stripe${createResponse.approval.provider.testMode ? ' (Test)' : ''}`
                  }
                />
                <InfoCell
                  label="Link Expiry"
                  value={new Date(createResponse.approval.linkExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {createResponse.approval.paymentMethods.map((m) => (
                  <span
                    key={m}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white/60"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </section>

            {/* Fees */}
            <section>
              <SectionLabel icon={<Zap className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />} label="Estimated Gateway Fees" />
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <Row label={`Provider fee (${createResponse.approval.estimatedFees.percentage}% + ${inr(createResponse.approval.estimatedFees.fixed, createResponse.approval.currency)})`} value={inr(createResponse.approval.estimatedFees.estimated, createResponse.approval.currency)} />
                <Row label="You'll receive (approx)" value={inr(createResponse.approval.amount - createResponse.approval.estimatedFees.estimated, createResponse.approval.currency)} bold />
              </div>
            </section>

            {/* Delivery */}
            <section>
              <SectionLabel icon={<Mail className="h-3.5 w-3.5" style={{ color: '#14b8a6' }} />} label="Delivery Channels" />
              <div className="space-y-1.5">
                <DeliveryRow
                  icon={<Mail className="h-3.5 w-3.5" />}
                  channel="Email"
                  note={createResponse.approval.delivery.emailNote}
                  ready={createResponse.approval.delivery.email}
                />
                <DeliveryRow
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  channel="WhatsApp"
                  note={createResponse.approval.delivery.whatsappNote}
                  ready={createResponse.approval.delivery.whatsapp}
                />
              </div>
            </section>

            {/* Warnings */}
            {createResponse.approval.warnings.length > 0 && (
              <div className="space-y-1.5">
                {createResponse.approval.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Approval buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApprove}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
              >
                <Check className="h-4 w-4" />
                Approve & Create Link
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <div className="ml-auto flex items-center gap-1 text-xs text-white/40">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit logged
              </div>
            </div>
          </div>
        )}

        {/* ── EXECUTING ── */}
        {phase === 'executing' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#2563EB' }} />
              <div className="text-sm text-white/70">
                Calling the payment provider API, persisting the payment record, and queuing email + WhatsApp delivery…
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-white/40">
              <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Contacting provider API</div>
              <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Writing payment record to Firestore</div>
              <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Queuing email + WhatsApp notifications</div>
              <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Writing activity + audit logs</div>
            </div>
          </div>
        )}

        {/* ── EXECUTED ── */}
        {phase === 'executed' && executeResult && (
          <div className="space-y-4">
            <div
              className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
              style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.05)' }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#2563EB' }} />
              <div className="text-sm">
                <div className="font-semibold text-white">Payment link created</div>
                <div className="text-white/60 text-xs mt-0.5">{executeResult.message}</div>
              </div>
            </div>

            {/* Link URL with copy + open */}
            {executeResult.linkUrl && (
              <section>
                <SectionLabel icon={<ExternalLink className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="Payment Link URL" />
                <div
                  className="rounded-lg border px-3 py-2.5 flex items-center gap-2"
                  style={{ borderColor: 'rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.03)' }}
                >
                  <code className="text-xs text-white/80 flex-1 truncate font-mono">{executeResult.linkUrl}</code>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium text-white/70 hover:text-white"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    {copied ? <Check className="h-3 w-3" style={{ color: '#2563EB' }} /> : <Copy className="h-3 w-3" />}
                  </button>
                  <a
                    href={executeResult.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium text-white/70 hover:text-white"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="text-xs text-white/40 mt-1.5">
                  Expires: {executeResult.linkExpiry ? new Date(executeResult.linkExpiry).toLocaleString('en-IN') : 'N/A'}
                  {executeResult.providerPaymentId && ` · Provider ID: ${executeResult.providerPaymentId}`}
                </div>
              </section>
            )}

            {/* Delivery status */}
            <section>
              <SectionLabel icon={<Mail className="h-3.5 w-3.5" style={{ color: '#14b8a6' }} />} label="Delivery Status" />
              <div className="space-y-1.5">
                <DeliveryStatusRow
                  icon={<Mail className="h-3.5 w-3.5" />}
                  channel="Email"
                  sent={executeResult.emailDelivery.sent}
                  message={executeResult.emailDelivery.message}
                />
                <DeliveryStatusRow
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  channel="WhatsApp"
                  sent={executeResult.whatsappDelivery.sent}
                  message={executeResult.whatsappDelivery.message}
                />
              </div>
            </section>

            {/* Records affected */}
            {executeResult.recordsAffected.length > 0 && (
              <section>
                <SectionLabel icon={<ShieldCheck className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />} label="Database Changes" />
                <div className="space-y-1">
                  {executeResult.recordsAffected.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                      <Check className="h-3 w-3" style={{ color: '#2563EB' }} />
                      <code className="font-mono">{r.collection}/{r.id.slice(-12)}</code>
                      <span className="text-white/30">·</span>
                      <span>{r.action}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Partial-success note (preview mode) */}
            {!executeResult.success && executeResult.linkUrl && (
              <div
                className="rounded-lg border px-3 py-2 flex items-start gap-2"
                style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <div className="text-xs text-white/60">
                  The payment link was created at the provider but could not be fully persisted (preview mode). The link is LIVE — sign in to save the payment record to your dashboard.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FAILED ── */}
        {phase === 'failed' && (
          <div className="space-y-3">
            <div
              className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
              style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <div className="text-sm">
                <div className="font-semibold text-white">Payment link creation failed</div>
                <div className="text-white/60 text-xs mt-0.5">
                  {error || executeResult?.message || 'An unexpected error occurred.'}
                </div>
                {executeResult?.rollbackStatus && executeResult.rollbackStatus !== 'not-needed' && (
                  <div className="text-white/40 text-xs mt-1">
                    {executeResult.rollbackStatus === 'rolled-back'
                      ? 'Partial changes have been rolled back.'
                      : 'Rollback attempted — please verify your dashboard.'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPhase('analyzing');
                  setCreateResponse(null);
                  setExecuteResult(null);
                  setError(null);
                  analyzedRef.current = false;
                  void analyze();
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── CANCELLED ── */}
        {phase === 'cancelled' && (
          <div className="flex items-center gap-2 py-3 text-sm text-white/50">
            <X className="h-4 w-4" />
            <span>Payment link creation cancelled. No changes were made.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {icon}
      <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: highlight ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.06)',
        background: highlight ? 'rgba(37,99,235,0.04)' : 'transparent',
      }}
    >
      <div className="text-[10px] text-white/40 uppercase tracking-wide">{label}</div>
      <div className={`text-sm ${highlight ? 'text-white font-semibold' : 'text-white/80'}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className={`text-xs ${bold ? 'text-white font-semibold' : 'text-white/60'}`}>{label}</span>
      <span className={`text-xs ${bold ? 'text-white font-semibold' : 'text-white/80'}`}>{value}</span>
    </div>
  );
}

function DeliveryRow({ icon, channel, note, ready }: { icon: React.ReactNode; channel: string; note: string; ready: boolean }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: ready ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)',
        background: ready ? 'rgba(37,99,235,0.03)' : 'transparent',
      }}
    >
      <span style={{ color: ready ? '#2563EB' : '#666' }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/80">{channel}</span>
          {ready ? (
            <span className="text-[10px] text-emerald-400 font-medium">Ready</span>
          ) : (
            <span className="text-[10px] text-white/40 font-medium">Not configured</span>
          )}
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">{note}</div>
      </div>
    </div>
  );
}

function DeliveryStatusRow({ icon, channel, sent, message }: { icon: React.ReactNode; channel: string; sent: boolean; message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border px-3 py-2"
      style={{
        borderColor: sent ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)',
        background: sent ? 'rgba(37,99,235,0.03)' : 'transparent',
      }}
    >
      <span style={{ color: sent ? '#2563EB' : '#666' }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/80">{channel}</span>
          {sent ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <Check className="h-2.5 w-2.5" /> Sent
            </span>
          ) : (
            <span className="text-[10px] text-white/40 font-medium">Skipped</span>
          )}
        </div>
        <div className="text-[11px] text-white/50 mt-0.5">{message}</div>
      </div>
    </div>
  );
}

function Building2Icon() {
  return <Sparkles className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />;
}
