'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Communication Action Card (Production)
//
// Renders inline below an Oracle assistant message when the user asks to send
// an email or WhatsApp message. This is the REAL production flow:
//
//   1. Detects intent → calls /create to extract + resolve recipient + detect
//      provider + generate message preview
//   2. If blocked (no recipient / no provider) → shows clear blocking reason
//   3. Shows full approval summary (Recipient / Subject / Preview / Attachments /
//      Delivery Provider) with Approve / Edit / Cancel buttons
//   4. Approve → calls /execute → REAL provider API → persist → webhook tracking
//   5. Shows execution result with delivery status + provider message IDs
//   6. Cancel → no changes made
//
// Dark theme matching Oracle workspace. Emerald accent. NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

// ─── Types (mirror of communication-engine.ts) ──────────────────────────────

interface CommunicationIntent {
  channel: 'email' | 'whatsapp' | 'both' | null;
  messageType: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  invoiceNumber: string | null;
  reportId: string | null;
  reportPeriod: string | null;
  paymentLinkId: string | null;
  attachmentKind: string | null;
  template: string | null;
  language: string;
  customMessage: string | null;
  missingFields: string[];
}

interface RecipientRecord {
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  status: string;
  communicationPreferences: { email: boolean; whatsapp: boolean; sms: boolean } | null;
}

interface EmailProviderIntegration {
  connected: boolean;
  provider: string | null;
  fromEmail: string | null;
  fromName: string | null;
  testMode: boolean;
}

interface WhatsAppProviderIntegration {
  connected: boolean;
  provider: string | null;
  fromNumber: string | null;
  testMode: boolean;
}

interface GeneratedMessage {
  channel: 'email' | 'whatsapp';
  subject: string;
  textBody: string;
  htmlBody?: string;
  templateName: string;
}

interface AttachmentSpec {
  kind: string;
  filename: string;
  mimeType: string;
}

interface ApprovalSummary {
  intent: CommunicationIntent;
  recipient: RecipientRecord | null;
  emailProvider: EmailProviderIntegration;
  whatsappProvider: WhatsAppProviderIntegration;
  message: GeneratedMessage | null;
  attachments: AttachmentSpec[];
  deliveryChannels: { email: boolean; whatsapp: boolean; emailNote: string; whatsappNote: string };
  warnings: string[];
  canProceed: boolean;
  blockingReasons: string[];
}

interface CreateResponse {
  intent: CommunicationIntent;
  approval: ApprovalSummary;
  durationMs: number;
}

interface SendResult {
  sent: boolean;
  status: string;
  providerMessageId: string | null;
  provider: string | null;
  message: string;
  retryable: boolean;
}

interface ExecuteResult {
  success: boolean;
  message: string;
  communicationId: string | null;
  emailDelivery: SendResult;
  whatsappDelivery: SendResult;
  recordsAffected: Array<{ collection: string; id: string; action: string }>;
  rollbackStatus: string;
  error?: string;
  durationMs?: number;
}

interface CommunicationActionCardProps {
  userMessage: string;
  organizationId: string;
  firmId: string | null;
  userId: string;
  userEmail: string;
  sellerName?: string;
  sellerEmail?: string;
}

type Phase = 'analyzing' | 'review' | 'blocked' | 'executing' | 'executed' | 'failed' | 'cancelled';

// ─── Main Component ─────────────────────────────────────────────────────────

export function CommunicationActionCard({
  userMessage,
  organizationId,
  firmId,
  userId,
  userEmail,
  sellerName = 'GSTPilot',
  sellerEmail,
}: CommunicationActionCardProps) {
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [createResponse, setCreateResponse] = useState<CreateResponse | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  // Derive sellerEmail from userEmail if not provided
  const effectiveSellerEmail = sellerEmail ?? userEmail;

  // ─── Step 1: Analyze ──
  const analyze = useCallback(async () => {
    setPhase('analyzing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/communicate/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          organizationId,
          firmId,
          userId,
          userEmail,
          sellerName,
          sellerEmail: effectiveSellerEmail,
        }),
      });
      const data: CreateResponse = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setCreateResponse(data);
      if (data.approval.message) {
        setEditedSubject(data.approval.message.subject);
        setEditedBody(data.approval.message.textBody);
      }
      if (data.approval.canProceed) {
        setPhase('review');
      } else {
        setPhase('blocked');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze communication request');
      setPhase('failed');
    }
  }, [userMessage, organizationId, firmId, userId, userEmail, sellerName, effectiveSellerEmail]);

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
      // If the user edited the message, override the intent with the edited values
      const intentWithEdits: CommunicationIntent = {
        ...createResponse.intent,
        customMessage: editMode && editedBody !== createResponse.message?.textBody ? editedBody : createResponse.intent.customMessage,
      };

      const res = await fetch('/api/oracle/cfo/communicate/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: intentWithEdits,
          organizationId,
          firmId,
          userId,
          userEmail,
          sellerName,
          sellerEmail: effectiveSellerEmail,
        }),
      });
      const data: ExecuteResult = await res.json();
      setExecuteResult(data);
      if (data.success) {
        setPhase('executed');
      } else if (data.emailDelivery.sent || data.whatsappDelivery.sent) {
        // Partial success — at least one channel delivered
        setPhase('executed');
      } else {
        setPhase('failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute communication');
      setPhase('failed');
    }
  }, [createResponse, organizationId, firmId, userId, userEmail, sellerName, effectiveSellerEmail, editMode, editedBody]);

  const handleCancel = useCallback(() => {
    setPhase('cancelled');
  }, []);

  // ─── Render helpers ──
  const channelLabel = (ch: string | null): string => {
    if (ch === 'email') return 'Email';
    if (ch === 'whatsapp') return 'WhatsApp';
    if (ch === 'both') return 'Email + WhatsApp';
    return '—';
  };

  const messageTypeLabel = (t: string | null): string => {
    const map: Record<string, string> = {
      payment_link: 'Payment Link',
      gst_report: 'GST Report',
      invoice: 'Invoice',
      payment_reminder: 'Payment Reminder',
      receipt: 'Receipt',
      outstanding_statement: 'Outstanding Statement',
      welcome: 'Welcome Email',
      compliance_reminder: 'Compliance Reminder',
      custom: 'Custom Message',
    };
    return t ? (map[t] ?? t) : '—';
  };

  const attachmentLabel = (kind: string | null): string => {
    const map: Record<string, string> = {
      invoice_pdf: 'Invoice PDF',
      gst_report_pdf: 'GST Report PDF',
      payment_link: 'Payment Link (embedded)',
      statement: 'Account Statement PDF',
      none: 'No attachment',
    };
    return kind ? (map[kind] ?? kind) : '—';
  };

  // ─── Render ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl border overflow-hidden"
      style={{ borderColor: 'rgba(16,185,129,0.2)', background: '#0a0a0a' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(20,184,166,0.04) 100%)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {createResponse?.intent.channel === 'whatsapp' ? (
            <MessageCircle className="h-4 w-4 shrink-0" style={{ color: '#10b981' }} />
          ) : (
            <Mail className="h-4 w-4 shrink-0" style={{ color: '#10b981' }} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Send Communication</div>
            <div className="text-xs text-white/50">
              {phase === 'analyzing' && 'Analyzing your request…'}
              {phase === 'review' && 'Review the message and approve to send'}
              {phase === 'blocked' && 'Action required before proceeding'}
              {phase === 'executing' && 'Sending via provider…'}
              {phase === 'executed' && 'Communication delivered'}
              {phase === 'failed' && 'Delivery failed'}
              {phase === 'cancelled' && 'Cancelled — nothing was sent'}
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
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#10b981' }} />
            <div className="text-sm text-white/70">
              Resolving recipient, detecting delivery provider, and generating the message preview…
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
                <div className="font-semibold text-white">Cannot send communication yet</div>
                <div className="text-white/60 text-xs mt-1">
                  The following must be resolved before Oracle can deliver a real message:
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
        {phase === 'review' && createResponse && createResponse.approval.message && (
          <div className="space-y-4">
            {/* Recipient */}
            <Section title="Recipient" icon={<Sparkles className="h-3.5 w-3.5" style={{ color: '#10b981' }} />}>
              {createResponse.approval.recipient ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Name" value={createResponse.approval.recipient.name} />
                  <Field label="Status" value={createResponse.approval.recipient.status} />
                  {createResponse.approval.recipient.email && (
                    <Field label="Email" value={createResponse.approval.recipient.email} />
                  )}
                  {createResponse.approval.recipient.phone && (
                    <Field label="Phone" value={createResponse.approval.recipient.phone} />
                  )}
                  {createResponse.approval.recipient.gstin && (
                    <Field label="GSTIN" value={createResponse.approval.recipient.gstin} />
                  )}
                </div>
              ) : (
                <div className="text-xs text-white/50">No recipient resolved.</div>
              )}
            </Section>

            {/* Message */}
            <Section title="Message Preview" icon={<FileText className="h-3.5 w-3.5" style={{ color: '#10b981' }} />}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Channel" value={channelLabel(createResponse.intent.channel)} />
                  <Field label="Type" value={messageTypeLabel(createResponse.intent.messageType)} />
                </div>
                {editMode ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40">Subject</label>
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="w-full mt-0.5 rounded-md border bg-black/40 px-2 py-1.5 text-xs text-white"
                        style={{ borderColor: 'rgba(16,185,129,0.3)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40">Message Body</label>
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={6}
                        className="w-full mt-0.5 rounded-md border bg-black/40 px-2 py-1.5 text-xs text-white font-mono"
                        style={{ borderColor: 'rgba(16,185,129,0.3)' }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40">Subject</label>
                      <div className="mt-0.5 rounded-md border px-2 py-1.5 text-xs text-white"
                        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        {createResponse.approval.message.subject}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-white/40">Body</label>
                      <pre className="mt-0.5 rounded-md border px-2 py-1.5 text-xs text-white/80 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto"
                        style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        {createResponse.approval.message.textBody}
                      </pre>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setEditMode((v) => !v)}
                  className="text-[10px] font-medium px-2 py-1 rounded-md border text-white/60 hover:text-white"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  {editMode ? 'Cancel edit' : 'Edit message'}
                </button>
              </div>
            </Section>

            {/* Attachments */}
            {createResponse.approval.attachments.length > 0 && (
              <Section title="Attachments" icon={<FileText className="h-3.5 w-3.5" style={{ color: '#10b981' }} />}>
                <div className="space-y-1.5">
                  {createResponse.approval.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                      <FileText className="h-3 w-3 shrink-0" style={{ color: '#10b981' }} />
                      <span className="text-white/80">{a.filename}</span>
                      <span className="text-white/40 text-[10px]">· {attachmentLabel(a.kind)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Delivery Provider */}
            <Section title="Delivery Provider" icon={<ShieldCheck className="h-3.5 w-3.5" style={{ color: '#10b981' }} />}>
              <div className="space-y-2">
                {createResponse.approval.deliveryChannels.email && (
                  <DeliveryRow
                    icon={<Mail className="h-3.5 w-3.5" />}
                    label="Email"
                    connected={createResponse.approval.emailProvider.connected}
                    note={createResponse.approval.deliveryChannels.emailNote}
                  />
                )}
                {createResponse.approval.deliveryChannels.whatsapp && (
                  <DeliveryRow
                    icon={<MessageCircle className="h-3.5 w-3.5" />}
                    label="WhatsApp"
                    connected={createResponse.approval.whatsappProvider.connected}
                    note={createResponse.approval.deliveryChannels.whatsappNote}
                  />
                )}
              </div>
            </Section>

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

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <Send className="h-3.5 w-3.5" />
                Approve & Send
              </button>
            </div>
          </div>
        )}

        {/* ── EXECUTING ── */}
        {phase === 'executing' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#10b981' }} />
              <div className="text-sm text-white/70">
                Sending via the connected provider…
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-white/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" style={{ color: '#10b981' }} />
                <span>Re-validating recipient</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" style={{ color: '#10b981' }} />
                <span>Generating attachments</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: '#10b981' }} />
                <span>Dispatching message via provider API</span>
              </div>
            </div>
          </div>
        )}

        {/* ── EXECUTED ── */}
        {phase === 'executed' && executeResult && (
          <div className="space-y-3">
            <div
              className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
              style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
              <div className="text-sm">
                <div className="font-semibold text-white">
                  {executeResult.success ? 'Communication delivered' : 'Partially delivered'}
                </div>
                <div className="text-white/70 text-xs mt-1">{executeResult.message}</div>
              </div>
            </div>

            {/* Delivery details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {executeResult.emailDelivery.status !== 'not-connected' && (
                <DeliveryResultCard
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Email"
                  delivery={executeResult.emailDelivery}
                />
              )}
              {executeResult.whatsappDelivery.status !== 'not-connected' && (
                <DeliveryResultCard
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  label="WhatsApp"
                  delivery={executeResult.whatsappDelivery}
                />
              )}
            </div>

            {/* Records affected */}
            {executeResult.recordsAffected.length > 0 && (
              <div className="text-[10px] text-white/40 font-mono">
                Records: {executeResult.recordsAffected.map((r) => `${r.collection}/${r.id} (${r.action})`).join(', ')}
              </div>
            )}

            {executeResult.durationMs && (
              <div className="text-[10px] text-white/40 font-mono">
                Executed in {executeResult.durationMs}ms
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ── FAILED ── */}
        {phase === 'failed' && (
          <div className="space-y-3">
            <div
              className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
              style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
            >
              <X className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <div className="text-sm">
                <div className="font-semibold text-white">Delivery failed</div>
                <div className="text-white/70 text-xs mt-1">
                  {error || executeResult?.message || 'An unexpected error occurred.'}
                </div>
              </div>
            </div>
            {executeResult && (executeResult.emailDelivery.message || executeResult.whatsappDelivery.message) && (
              <div className="space-y-1.5 text-xs">
                {executeResult.emailDelivery.message && (
                  <div className="flex items-start gap-2 text-white/60">
                    <Mail className="h-3 w-3 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <span>{executeResult.emailDelivery.message}</span>
                  </div>
                )}
                {executeResult.whatsappDelivery.message && (
                  <div className="flex items-start gap-2 text-white/60">
                    <MessageCircle className="h-3 w-3 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <span>{executeResult.whatsappDelivery.message}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-white/70 hover:text-white"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase('review');
                  setExecuteResult(null);
                  setError(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── CANCELLED ── */}
        {phase === 'cancelled' && (
          <div className="flex items-center gap-2 py-2 text-sm text-white/50">
            <Clock className="h-4 w-4" />
            <span>Cancelled — no message was sent.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-white/80 text-xs mt-0.5 break-words">{value}</div>
    </div>
  );
}

function DeliveryRow({
  icon,
  label,
  connected,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  note: string;
}) {
  return (
    <div
      className="rounded-md border px-2.5 py-2 flex items-start gap-2"
      style={{
        borderColor: connected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
        background: connected ? 'rgba(16,185,129,0.03)' : 'rgba(245,158,11,0.03)',
      }}
    >
      <div style={{ color: connected ? '#10b981' : '#f59e0b' }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{label}</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
            style={{
              background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: connected ? '#10b981' : '#f59e0b',
            }}
          >
            {connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <div className="text-[11px] text-white/60 mt-0.5">{note}</div>
      </div>
    </div>
  );
}

function DeliveryResultCard({
  icon,
  label,
  delivery,
}: {
  icon: React.ReactNode;
  label: string;
  delivery: SendResult;
}) {
  const isSent = delivery.sent || delivery.status === 'preview-mode';
  const isFailed = delivery.status === 'failed' || delivery.status === 'not-connected';
  const color = isSent ? '#10b981' : isFailed ? '#ef4444' : '#f59e0b';
  return (
    <div
      className="rounded-md border px-2.5 py-2"
      style={{
        borderColor: `${color}40`,
        background: `${color}08`,
      }}
    >
      <div className="flex items-center gap-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-xs font-semibold text-white">{label}</span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ml-auto"
          style={{ background: `${color}20`, color }}
        >
          {delivery.status}
        </span>
      </div>
      {delivery.provider && (
        <div className="text-[10px] text-white/40 mt-1 font-mono">via {delivery.provider}</div>
      )}
      {delivery.providerMessageId && (
        <div className="text-[10px] text-white/40 mt-0.5 font-mono truncate" title={delivery.providerMessageId}>
          ID: {delivery.providerMessageId}
        </div>
      )}
      <div className="text-[11px] text-white/60 mt-1">{delivery.message}</div>
    </div>
  );
}
