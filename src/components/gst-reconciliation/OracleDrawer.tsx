'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Premium Oracle AI Drawer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Slide-in drawer with:
//   • Status badge + confidence color bar
//   • Books vs GSTR-2B side-by-side comparison
//   • Mismatched fields table (Books → GSTR-2B)
//   • Per-field score breakdown (8 bars)
//   • Oracle Explanation card (CFO-grade narrative)
//   • AI Suggestion card (primary action + alternatives)
//   • Auto-Fix panel (preview changes before applying)
//   • ITC at Risk callout
//   • Mark Resolved / Reopen + Close buttons
//
// All API calls use fetchWithTimeout for auth injection.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, Loader2, Zap, AlertTriangle, CheckCircle2, ArrowRight,
  Mail, Clock, ShieldAlert, Wand2, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fetchWithTimeout } from '@/lib/async';
import {
  type MatchRow, type MatchStatus, type FixSuggestion, type AISuggestion,
  type ScoreBreakdown, STATUS_META, fmtINR, confidenceColor,
} from './parts';

interface ExplainResponse {
  explanation: string;
  recommendation: string;
  action: { label: string; type: string };
  suggestion: AISuggestion;
  alternatives: AISuggestion[];
  fixes: FixSuggestion[];
  scoreBreakdown: ScoreBreakdown;
}

interface AutoFixResponse {
  ok: boolean;
  applied: boolean;
  fix: FixSuggestion;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  itcImpact: number;
  newStatus: string;
  appliedToBooks: boolean;
}

const SUGGESTION_ICONS: Record<string, typeof Mail> = {
  contact_supplier: Mail,
  wait_for_gstr1: Clock,
  raise_dispute: ShieldAlert,
  claim_later: Clock,
  ignore_mismatch: CheckCircle2,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const SEVERITY_COLORS: Record<string, string> = {
  safe: '#10B981',
  moderate: '#F59E0B',
  risky: '#EF4444',
};

export function OracleDrawer({
  match, runId, onClose, onResolved, onFixApplied,
}: {
  match: MatchRow;
  runId: string;
  onClose: () => void;
  onResolved: (resolved: boolean) => void;
  onFixApplied: () => void;
}) {
  const [explanation, setExplanation] = useState(match.aiExplanation);
  const [recommendation, setRecommendation] = useState(match.aiRecommendation);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [alternatives, setAlternatives] = useState<AISuggestion[]>([]);
  const [fixes, setFixes] = useState<FixSuggestion[]>(match.fixSuggestions || []);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(match.scoreBreakdown || null);
  const [loading, setLoading] = useState(!match.aiExplanation);
  const [resolving, setResolving] = useState(false);
  const [expandedFix, setExpandedFix] = useState<string | null>(null);
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    if (!match.aiExplanation) {
      void (async () => {
        try {
          const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: match.id }),
          });
          const data: ExplainResponse = await res.json();
          if (res.ok) {
            setExplanation(data.explanation);
            setRecommendation(data.recommendation);
            setSuggestion(data.suggestion);
            setAlternatives(data.alternatives);
            setFixes(data.fixes);
            setScoreBreakdown(data.scoreBreakdown);
          }
        } catch {
          // ignore
        } finally {
          setLoading(false);
        }
      })();
    } else {
      // If we already have an explanation but no suggestion object, fetch the full set
      if (!suggestion) {
        void (async () => {
          try {
            const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/explain`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ matchId: match.id }),
            });
            const data: ExplainResponse = await res.json();
            if (res.ok) {
              setSuggestion(data.suggestion);
              setAlternatives(data.alternatives);
              setFixes(data.fixes);
              setScoreBreakdown(data.scoreBreakdown);
            }
          } catch {
            // ignore
          } finally {
            setLoading(false);
          }
        })();
      }
    }
  }, [match.id, match.aiExplanation, match.fixSuggestions, match.scoreBreakdown, runId, suggestion]);

  const meta = STATUS_META[match.status as MatchStatus];
  const Icon = meta.icon;
  const confColor = confidenceColor(match.confidence);

  const handleResolve = async (resolved: boolean) => {
    setResolving(true);
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, resolved }),
      });
      if (!res.ok) throw new Error('Failed');
      onResolved(resolved);
      toast.success(resolved ? 'Marked as resolved' : 'Reopened');
    } catch {
      toast.error('Could not update status');
    } finally {
      setResolving(false);
    }
  };

  const handlePreviewFix = async (fix: FixSuggestion) => {
    if (expandedFix === `${fix.type}-${fix.field}`) {
      setExpandedFix(null);
      return;
    }
    setExpandedFix(`${fix.type}-${fix.field}`);
  };

  const handleApplyFix = async (fix: FixSuggestion) => {
    setApplyingFix(`${fix.type}-${fix.field}`);
    try {
      const res = await fetchWithTimeout(`/api/gst-reconciliation/${runId}/auto-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          fixType: fix.type,
          field: fix.field,
          dryRun: false,
        }),
      });
      const data: AutoFixResponse = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || 'Failed to apply fix');
      toast.success(
        data.appliedToBooks
          ? `Fix applied — Books updated (${data.newStatus})`
          : `Fix flagged for review (${data.newStatus})`,
      );
      onFixApplied();
      onResolved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply fix');
    } finally {
      setApplyingFix(null);
      setExpandedFix(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-[#2A2E36] bg-[#0F1115] custom-scrollbar"
        style={{
          boxShadow: '-24px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        <div className="sticky top-0 z-10 border-b border-[#2A2E36] bg-[#0F1115]/95 p-5 backdrop-blur">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB]/20 to-[#2563EB]/5">
                <Sparkles className="h-5 w-5 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="gst-card-title">Oracle AI Analysis</h2>
                <p className="gst-caption">Mismatch breakdown + recommended action</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#171A21]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status + confidence row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`gst-status gst-status-${meta.color}`}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            {match.confidence > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">confidence</span>
                <span className="text-xs font-bold" style={{ color: confColor }}>
                  {Math.round(match.confidence * 100)}%
                </span>
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[#1F1F1F]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(match.confidence * 100)}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: confColor }}
                  />
                </div>
              </div>
            )}
            {match.fixApplied && (
              <Badge variant="outline" className="border-[#10B981]/40 bg-[#10B981]/10 text-[#34D399]">
                <Zap className="mr-1 h-3 w-3" /> Auto-fixed
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Books vs GSTR-2B comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#2A2E36] bg-[#171A21] p-3">
              <div className="gst-caption mb-1.5">Books (Purchase Register)</div>
              <div className="font-mono text-xs text-foreground">{match.booksInvoiceNo || '—'}</div>
              <div className="mt-1 text-xs text-muted-foreground">{match.booksInvoiceDate || '—'}</div>
              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                <div>Taxable: <span className="text-foreground">{fmtINR(match.booksTaxableValue)}</span></div>
                <div>CGST/SGST/IGST: <span className="text-foreground">{fmtINR(match.booksCGST + match.booksSGST + match.booksIGST)}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-[#2A2E36] bg-[#171A21] p-3">
              <div className="gst-caption mb-1.5">GSTR-2B (Filed by Supplier)</div>
              <div className="font-mono text-xs text-foreground">{match.gstr2bInvoiceNo || '—'}</div>
              <div className="mt-1 text-xs text-muted-foreground">{match.gstr2bInvoiceDate || '—'}</div>
              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                <div>Taxable: <span className="text-foreground">{fmtINR(match.gstr2bTaxableValue)}</span></div>
                <div>CGST/SGST/IGST: <span className="text-foreground">{fmtINR(match.gstr2bCGST + match.gstr2bSGST + match.gstr2bIGST)}</span></div>
              </div>
            </div>
          </div>

          {/* Mismatched fields */}
          {match.mismatchReasons.length > 0 && (
            <div>
              <div className="gst-label mb-2">Mismatched Fields ({match.mismatchReasons.length})</div>
              <div className="space-y-1.5">
                {match.mismatchReasons.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-[#2A2E36] bg-[#171A21] px-3 py-2 text-xs">
                    <span className="font-medium uppercase tracking-wider text-muted-foreground">{m.field}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-foreground">{String(m.booksValue ?? '—')}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="tabular-nums text-[#60A5FA]">{String(m.gstr2bValue ?? '—')}</span>
                      {m.delta != null && m.delta !== 0 && (
                        <Badge variant="outline" className="text-[9px]">
                          Δ {fmtINR(Math.abs(m.delta))}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-field score breakdown */}
          {scoreBreakdown && match.confidence > 0 && (
            <div>
              <div className="gst-label mb-2">Confidence Breakdown (per field)</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(scoreBreakdown).map(([field, score]) => (
                  <div key={field} className="rounded-md border border-[#2A2E36] bg-[#171A21] px-2.5 py-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="uppercase tracking-wider text-muted-foreground">{field}</span>
                      <span className="font-semibold" style={{ color: confidenceColor(score) }}>
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#1F1F1F]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(score * 100)}%` }}
                        transition={{ duration: 0.5, delay: 0.05 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: confidenceColor(score) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Oracle Explanation */}
          <div className="rounded-xl border border-[#2563EB]/20 bg-gradient-to-br from-[#2563EB]/[0.08] to-[#2563EB]/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#60A5FA]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">Oracle Explanation</span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing mismatch...
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-foreground">{explanation}</p>
            )}
          </div>

          {/* Primary AI Suggestion */}
          {suggestion && !loading && (
            <div className="rounded-xl border border-[#2A2E36] bg-[#171A21] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#FBBF24]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">Recommended Action</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={{ color: PRIORITY_COLORS[suggestion.priority], borderColor: `${PRIORITY_COLORS[suggestion.priority]}44` }}
                >
                  {suggestion.priority}
                </Badge>
              </div>
              <div className="mb-2 flex items-center gap-2">
                {(() => {
                  const SuggIcon = SUGGESTION_ICONS[suggestion.key] || Info;
                  return <SuggIcon className="h-4 w-4 text-[#60A5FA]" />;
                })()}
                <span className="text-sm font-semibold text-foreground">{suggestion.label}</span>
                <span className="text-[10px] text-muted-foreground">· ~{suggestion.estimatedResolutionDays}d</span>
              </div>
              <p className="mb-2 text-sm font-medium text-foreground">{suggestion.reason}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{suggestion.detail}</p>

              {alternatives.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    className="flex items-center gap-1 text-xs text-[#60A5FA] hover:underline"
                  >
                    {showAlternatives ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showAlternatives ? 'Hide' : 'Show'} {alternatives.length} alternative actions
                  </button>
                  <AnimatePresence>
                    {showAlternatives && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-2"
                      >
                        {alternatives.map((alt, i) => {
                          const AltIcon = SUGGESTION_ICONS[alt.key] || Info;
                          return (
                            <div key={i} className="rounded-lg border border-[#2A2E36] bg-[#0F1115] p-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <AltIcon className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium text-foreground">{alt.label}</span>
                                </div>
                                <span className="text-[9px] uppercase tracking-wider" style={{ color: PRIORITY_COLORS[alt.priority] }}>
                                  {alt.priority}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">{alt.reason}</p>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Auto-Fix Panel */}
          {fixes.length > 0 && !loading && (
            <div>
              <div className="gst-label mb-2 flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5 text-[#A78BFA]" />
                Auto-Fix Suggestions ({fixes.length})
              </div>
              <div className="space-y-2">
                {fixes.map((fix, i) => {
                  const fixKey = `${fix.type}-${fix.field}`;
                  const isExpanded = expandedFix === fixKey;
                  const isApplying = applyingFix === fixKey;
                  const sevColor = SEVERITY_COLORS[fix.severity];
                  return (
                    <div key={i} className="rounded-xl border border-[#2A2E36] bg-[#171A21] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Wand2 className="h-3.5 w-3.5 text-[#A78BFA]" />
                            <span className="text-sm font-medium text-foreground">{fix.label}</span>
                            <Badge
                              variant="outline"
                              className="text-[9px]"
                              style={{ color: sevColor, borderColor: `${sevColor}44` }}
                            >
                              {fix.severity}
                            </Badge>
                            {fix.canAutoApply && (
                              <Badge variant="outline" className="border-[#10B981]/40 bg-[#10B981]/10 text-[9px] text-[#34D399]">
                                auto-apply
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="tabular-nums">{fix.from}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="tabular-nums text-[#60A5FA]">{fix.to}</span>
                            {fix.itcImpact != null && fix.itcImpact > 0 && (
                              <span className="text-[#F87171]">· ITC impact: {fmtINR(fix.itcImpact)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handlePreviewFix(fix)}
                          className="gst-btn gst-btn-ghost gst-btn-sm !h-7"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 border-t border-[#2A2E36] pt-3"
                          >
                            <div className="mb-2 rounded-md border border-[#2A2E36] bg-[#0F1115] p-2.5">
                              <div className="gst-caption mb-1">Preview</div>
                              <p className="text-xs leading-relaxed text-foreground">{fix.preview}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApplyFix(fix)}
                                disabled={isApplying}
                                className="gst-btn gst-btn-primary gst-btn-sm flex-1"
                              >
                                {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                                {isApplying ? 'Applying...' : 'Apply Fix'}
                              </button>
                              <button
                                onClick={() => setExpandedFix(null)}
                                className="gst-btn gst-btn-ghost gst-btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                            {!fix.canAutoApply && (
                              <p className="mt-2 flex items-center gap-1 text-[10px] text-[#FBBF24]">
                                <AlertTriangle className="h-3 w-3" />
                                This fix requires human review — applying will flag it for verification.
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendation (legacy) */}
          {recommendation && !suggestion && !loading && (
            <div className="rounded-xl border border-[#2A2E36] bg-[#171A21] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#FBBF24]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#FBBF24]">Recommended Action</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{recommendation}</p>
            </div>
          )}

          {/* ITC at Risk callout */}
          {match.itcAtRisk > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-[#EF4444]/20 bg-gradient-to-r from-[#EF4444]/[0.08] to-[#EF4444]/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#F87171]" />
                <span className="text-sm text-[#F87171]">ITC at Risk</span>
              </div>
              <span className="gst-metric text-[#F87171]">{fmtINR(match.itcAtRisk)}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleResolve(!match.resolved)}
              disabled={resolving}
              className={`gst-btn gst-btn-lg flex-1 ${match.resolved ? 'gst-btn-secondary' : 'gst-btn-primary'}`}
            >
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : match.resolved ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {match.resolved ? 'Reopen' : 'Mark Resolved'}
            </button>
            <button onClick={onClose} className="gst-btn gst-btn-ghost gst-btn-lg">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
