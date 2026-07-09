'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Production Assistant Panel
//
// Renders inline BELOW an Oracle assistant message when the CFO analyze
// endpoint detects an actionable intent. This is NOT a new page, NOT a
// redesign — it's an inline panel that turns Oracle's chat answer into a
// real, executable, audited business action.
//
// Flow:
//   1. Oracle answers the question (streaming chat — unchanged)
//   2. This panel appears below the answer showing:
//      • The detected tool + confidence
//      • WHY (explainable decision card)
//      • Supporting records (real IDs)
//      • Calculation breakdown
//      • Risks + alternatives
//      • Input params (editable if missing)
//   3. If approval required → Approve / Reject buttons
//   4. On Approve → POST /api/oracle/cfo/execute → real tool runs
//   5. Result shown inline: success/failure, records affected, audit ID
//
// Dark theme matching Oracle workspace: bg #0a0a0a, border rgba(255,255,255,0.08),
// accent emerald. NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types (mirror the API response shapes) ─────────────────────────────────

interface DecisionCard {
  toolId: string;
  toolName: string;
  why: string;
  records: Array<{ collection: string; id: string; label: string; detail: string }>;
  confidence: number;
  confidenceFactors: Array<{ label: string; weight: number; score: number }>;
  calculation: Array<{ label: string; value: string }>;
  risks: Array<{ severity: 'low' | 'medium' | 'high'; description: string; mitigation?: string }>;
  alternatives: Array<{ title: string; tradeOff: string; recommended: boolean }>;
  generatedAt: string;
}

interface ApprovalRequest {
  approvalId: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  category: string;
  input: Record<string, unknown>;
  decisionCard: DecisionCard;
  missingParams: string[];
  createdAt: string;
}

interface ExecuteResult {
  success: boolean;
  message: string;
  recordsAffected: Array<{ collection: string; id: string; action: 'created' | 'updated' | 'deleted' }>;
  output?: Record<string, unknown>;
  executionMs: number;
  rollbackStatus?: string;
}

interface CFOAssistantPanelProps {
  approvalRequests: ApprovalRequest[];
  organizationId: string;
  userId: string;
  userEmail: string;
  onExecuted?: () => void;
}

// ─── Icon map (tool icon name → Lucide component) ───────────────────────────

const TOOL_ICONS: Record<string, LucideIcon> = {
  FileText,
  Mail,
  MessageCircle,
  Receipt,
  CheckCircle2,
  CheckSquare: CheckCircle2,
  FileBarChart: FileText,
  CreditCard: Zap,
};

// ─── Confidence color ───────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 80) return '#10b981'; // emerald
  if (c >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // rose
}

function riskColor(sev: 'low' | 'medium' | 'high'): string {
  if (sev === 'high') return '#ef4444';
  if (sev === 'medium') return '#f59e0b';
  return '#10b981';
}

// ─── Single Approval Card ───────────────────────────────────────────────────

function ApprovalCard({
  approval,
  organizationId,
  userId,
  userEmail,
  onExecuted,
}: {
  approval: ApprovalRequest;
  organizationId: string;
  userId: string;
  userEmail: string;
  onExecuted?: () => void;
}) {
  const [status, setStatus] = useState<'pending' | 'executing' | 'executed' | 'failed' | 'rejected'>('pending');
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const card = approval.decisionCard;
  const ToolIcon = TOOL_ICONS[approval.toolIcon] ?? Sparkles;
  const confColor = confidenceColor(card.confidence);
  const hasMissingParams = approval.missingParams.length > 0;

  const handleExecute = useCallback(async () => {
    setStatus('executing');
    setError(null);
    try {
      const res = await fetch('/api/oracle/cfo/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.approvalId,
          decision: 'approved',
          organizationId,
          userId,
          userEmail,
          // Pass the full approval inline so the server can execute even in
          // preview mode where Firestore reads are denied by security rules.
          approval: {
            toolId: approval.toolId,
            toolName: approval.toolName,
            toolIcon: approval.toolIcon,
            category: approval.category,
            input: approval.input,
            decisionCard: approval.decisionCard,
            createdAt: approval.createdAt,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || 'Execution failed');
      }
      setResult(data.result);
      setStatus(data.success ? 'executed' : 'failed');
      onExecuted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setStatus('failed');
    }
  }, [approval, organizationId, userId, userEmail, onExecuted]);

  const handleReject = useCallback(async () => {
    setStatus('executing');
    try {
      await fetch('/api/oracle/cfo/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId: approval.approvalId,
          decision: 'rejected',
          organizationId,
          userId,
          userEmail,
        }),
      });
      setStatus('rejected');
    } catch {
      setStatus('rejected');
    }
  }, [approval.approvalId, organizationId, userId, userEmail]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-3 overflow-hidden rounded-xl border"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0a0a0a' }}
    >
      {/* ─── Header ─── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        style={{ background: 'rgba(16,185,129,0.04)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.2) 100%)' }}
          >
            <ToolIcon className="h-4 w-4" style={{ color: '#10b981' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{approval.toolName}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
              >
                Oracle CFO
              </span>
            </div>
            <div className="text-xs text-white/50">
              {card.confidence}% confidence · {approval.category}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === 'executed' && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#10b981' }}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </span>
          )}
          {status === 'failed' && (
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#ef4444' }}>
              <AlertTriangle className="h-3.5 w-3.5" /> Failed
            </span>
          )}
          {status === 'rejected' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-white/50">
              <X className="h-3.5 w-3.5" /> Rejected
            </span>
          )}
          {status === 'executing' && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
            </span>
          )}
          {status === 'pending' && (
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Clock className="h-3.5 w-3.5" /> Pending approval
            </span>
          )}
        </div>
      </div>

      {/* ─── Body (expandable) ─── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {/* WHY */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: '#10b981' }} />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Why this action</h4>
                </div>
                <p className="text-sm text-white/85 leading-relaxed">{card.why}</p>
              </section>

              {/* SUPPORTING RECORDS */}
              {card.records.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Database className="h-3.5 w-3.5" style={{ color: '#14b8a6' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Supporting records</h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.records.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#111111' }}
                      >
                        <div className="text-xs font-mono text-white/40 w-20 shrink-0 truncate">{r.collection}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{r.label}</div>
                          <div className="text-xs text-white/50 truncate">{r.detail}</div>
                        </div>
                        <code className="text-[10px] text-white/40 font-mono shrink-0">{r.id.slice(-12)}</code>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CALCULATION */}
              {card.calculation.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Zap className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Calculation</h4>
                  </div>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {card.calculation.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-1.5 text-sm"
                        style={{ background: i % 2 === 0 ? '#0d0d0d' : '#111111' }}
                      >
                        <span className="text-white/60">{c.label}</span>
                        <span className="font-mono font-semibold text-white">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CONFIDENCE BREAKDOWN */}
              {card.confidenceFactors.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" style={{ color: confColor }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">
                      Confidence: {card.confidence}%
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.confidenceFactors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-white/60 w-48 shrink-0 truncate">{f.label}</span>
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${f.score * 100}%`, background: confidenceColor(f.score * 100) }}
                          />
                        </div>
                        <span className="text-xs font-mono text-white/40 w-10 text-right shrink-0">
                          {Math.round(f.score * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* RISKS */}
              {card.risks.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Potential risks</h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.risks.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#111111' }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0"
                            style={{ background: `${riskColor(r.severity)}20`, color: riskColor(r.severity) }}
                          >
                            {r.severity}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm text-white/85">{r.description}</div>
                            {r.mitigation && <div className="text-xs text-white/50 mt-0.5">→ {r.mitigation}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ALTERNATIVES */}
              {card.alternatives.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ArrowRight className="h-3.5 w-3.5" style={{ color: '#a78bfa' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-white/60">Alternatives</h4>
                  </div>
                  <div className="space-y-1.5">
                    {card.alternatives.map((a, i) => (
                      <div
                        key={i}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#111111' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{a.title}</span>
                          {a.recommended && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                            >
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white/50 mt-0.5">{a.tradeOff}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* MISSING PARAMS WARNING */}
              {hasMissingParams && status === 'pending' && (
                <div
                  className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
                  style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                  <div className="text-sm">
                    <div className="font-semibold text-white">Missing information</div>
                    <div className="text-white/60 text-xs mt-0.5">
                      Some required details weren&apos;t found in your message or live data:{' '}
                      <span className="font-mono text-white/80">{approval.missingParams.join(', ')}</span>.
                      Default values will be used — review before approving.
                    </div>
                  </div>
                </div>
              )}

              {/* RESULT (after execution) */}
              {result && (
                <div
                  className="rounded-lg border px-3 py-3"
                  style={{
                    borderColor: result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                    background: result.success ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: '#10b981' }} />
                    ) : (
                      <AlertTriangle className="h-4 w-4" style={{ color: '#ef4444' }} />
                    )}
                    <span className="text-sm font-semibold text-white">
                      {result.success ? 'Action executed successfully' : 'Action failed'}
                    </span>
                    <span className="ml-auto text-xs text-white/40 font-mono">{result.executionMs}ms</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{result.message}</p>
                  {result.recordsAffected.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.recordsAffected.map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
                        >
                          <span style={{ color: r.action === 'created' ? '#10b981' : r.action === 'updated' ? '#f59e0b' : '#ef4444' }}>
                            {r.action}
                          </span>
                          {r.collection}/{r.id.slice(-8)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div
                  className="rounded-lg border px-3 py-2.5 flex items-start gap-2"
                  style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <div className="text-sm">
                    <div className="font-semibold text-white">Something went wrong</div>
                    <div className="text-white/60 text-xs mt-0.5">{error}</div>
                    <div className="text-white/40 text-xs mt-1">The error has been logged. You can retry safely.</div>
                  </div>
                </div>
              )}

              {/* APPROVAL BUTTONS */}
              {status === 'pending' && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={status !== 'pending'}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    <Check className="h-4 w-4" />
                    Approve & Execute
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={status !== 'pending'}
                    className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium text-white/70 transition-all hover:text-white hover:bg-white/5 disabled:opacity-50"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <div className="ml-auto flex items-center gap-1 text-xs text-white/40">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Audit logged
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Panel (wraps multiple approval cards) ─────────────────────────────

export function CFOAssistantPanel({
  approvalRequests,
  organizationId,
  userId,
  userEmail,
  onExecuted,
}: CFOAssistantPanelProps) {
  if (approvalRequests.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {approvalRequests.map((approval) => (
          <ApprovalCard
            key={approval.approvalId}
            approval={approval}
            organizationId={organizationId}
            userId={userId}
            userEmail={userEmail}
            onExecuted={onExecuted}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
