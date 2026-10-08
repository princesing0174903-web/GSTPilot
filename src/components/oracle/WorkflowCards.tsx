'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Workflow UI Cards
// ═══════════════════════════════════════════════════════════════════════════════
//
// Two inline cards rendered in VEYRO AI chat thread for the Autonomous
// Workflow Engine (Priority 2):
//
//   1. WorkflowPlanCard      — shows the plan (title, category, steps, risk)
//                              with Confirm / Cancel buttons. On confirm, it
//                              POSTs to /api/oracle/brain/workflow/execute and
//                              morphs into the progress card.
//
//   2. WorkflowProgressCard  — shows live per-step progress as SSE events
//                              stream in. Each step shows a status icon
//                              (pending ○ / running spinner / success ✓ /
//                              failed ✗ / skipped ⊘ / rolled-back ⟲) + label
//                              + summary. On complete, shows the final
//                              overall summary + view-in links.
//
// Both cards are purely presentational — all state lives in the parent
// (OracleBrainCore) and is mutated via updateWorkflowPart() as events arrive.
//
// Styling matches the existing ActionConfirmCard: rounded-xl border, accent
// color by state, header with icon + title + badge, body with structured rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Sparkles, ArrowRight,
  Workflow as WorkflowIcon, RotateCcw, X, FileText, Receipt, IndianRupee,
  ShieldCheck, BarChart3, Users, Zap, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  WorkflowPlan,
  WorkflowStepResult,
  WorkflowResult,
  WorkflowCategory,
  WorkflowRiskLevel,
} from '@/lib/oracle/workflow-engine/types';

// ─── Category → icon + color ──────────────────────────────────────────────────

const CATEGORY_META: Record<WorkflowCategory, { icon: any; color: string; label: string }> = {
  sales:     { icon: Receipt,      color: 'text-emerald-400',  label: 'Sales' },
  payment:   { icon: IndianRupee,  color: 'text-sky-400',      label: 'Payment' },
  gst:       { icon: ShieldCheck,  color: 'text-emerald-400',   label: 'GST' },
  crm:       { icon: Users,        color: 'text-amber-400',    label: 'CRM' },
  reports:   { icon: BarChart3,    color: 'text-rose-400',     label: 'Reports' },
  operations:{ icon: Zap,          color: 'text-zinc-400',     label: 'Operations' },
  custom:    { icon: WorkflowIcon, color: 'text-emerald-400',  label: 'Workflow' },
};

const RISK_META: Record<WorkflowRiskLevel, { label: string; color: string }> = {
  low:    { label: 'Low risk',    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  medium: { label: 'Medium risk', color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  high:   { label: 'High risk',   color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' },
};

// ─── Part type (mirrors the shape persisted in chat message parts) ────────────

export interface WorkflowPart {
  type: 'workflow-plan';
  plan: WorkflowPlan;
  source?: 'template' | 'llm';
  // Lifecycle state
  state: 'planning' | 'pending' | 'executing' | 'success' | 'partial' | 'failed' | 'cancelled';
  // Populated during execution
  stepResults?: WorkflowStepResult[];
  // Populated after completion
  result?: WorkflowResult;
  // Error message (if planning/executing failed before any step ran)
  error?: string;
}

// ─── Step status icon ─────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: WorkflowStepResult['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-rose-400 shrink-0" />;
    case 'skipped':
      return <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />;
    case 'rolled-back':
      return <RotateCcw className="h-4 w-4 text-amber-400 shrink-0" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-sky-400 shrink-0 animate-spin" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-zinc-700 shrink-0" />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WorkflowPlanCard — shows the plan + Confirm/Cancel (state: pending)
// ═══════════════════════════════════════════════════════════════════════════════

export function WorkflowPlanCard({
  part,
  onConfirm,
  onCancel,
}: {
  part: WorkflowPart;
  onConfirm?: (plan: WorkflowPlan) => void;
  onCancel?: (plan: WorkflowPlan) => void;
}) {
  const { plan } = part;
  // Default to 'pending' if state is missing (e.g. session reloaded from DB —
  // the persisted part has no state field, so we treat it as a fresh plan).
  const state = part.state ?? 'pending';
  const catMeta = CATEGORY_META[plan.category] ?? CATEGORY_META.custom;
  const riskMeta = RISK_META[plan.riskLevel] ?? RISK_META.medium;
  const CatIcon = catMeta.icon;
  const isPending = state === 'pending';
  const isExecuting = state === 'executing';
  const isCancelled = state === 'cancelled';
  const isComplete = state === 'success' || state === 'partial' || state === 'failed';

  // Accent color by state
  const accent = isPending
    ? 'border-sky-500/40 bg-sky-500/[0.04]'
    : isExecuting
      ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
      : state === 'success'
        ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
        : state === 'partial'
          ? 'border-amber-500/40 bg-amber-500/[0.04]'
          : state === 'failed'
            ? 'border-rose-500/40 bg-rose-500/[0.04]'
            : 'border-zinc-700/60 bg-zinc-800/40'; // cancelled

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border ${accent} overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-${catMeta.color.replace('text-', '')}/15 ${catMeta.color}`}>
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : state === 'failed' ? (
            <XCircle className="h-4 w-4 text-rose-400" />
          ) : state === 'partial' ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : isCancelled ? (
            <X className="h-4 w-4 text-zinc-400" />
          ) : (
            <CatIcon className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-100 truncate">{plan.title}</span>
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 capitalize ${catMeta.color} border-current/40`}>
              {catMeta.label}
            </Badge>
            {(isPending || isExecuting) && (
              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${riskMeta.color}`}>
                {riskMeta.label}
              </Badge>
            )}
            {isExecuting && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                Running
              </Badge>
            )}
            {state === 'success' && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                Complete
              </Badge>
            )}
            {state === 'partial' && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-400 border-amber-500/40 bg-amber-500/10">
                Partial
              </Badge>
            )}
            {state === 'failed' && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-rose-400 border-rose-500/40 bg-rose-500/10">
                Failed
              </Badge>
            )}
            {isCancelled && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-zinc-500 border-zinc-700 bg-zinc-800/60">
                Cancelled
              </Badge>
            )}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5 truncate">{plan.description}</div>
        </div>
      </div>

      {/* Body — plan steps (pending) or live progress (executing/complete) */}
      <div className="px-4 py-3 space-y-3">
        {/* Plan description (only when pending) */}
        {isPending && (
          <div className="text-[11px] text-zinc-400 leading-relaxed">
            Oracle planned this as a <span className="text-zinc-200 font-medium">{plan.steps.length}-step</span> workflow.
            {plan.source === 'template' ? ' Matched a built-in template.' : ' Custom-built by the AI planner.'}
            {' '}Review the steps below and confirm to execute them in order.
          </div>
        )}

        {/* Step list — plan view (pending) + progress view (executing/complete) */}
        <div className="space-y-1.5">
          {plan.steps.map((step, i) => {
            const stepResult = part.stepResults?.find(r => r.stepId === step.id);
            const status = stepResult?.status ?? (isPending ? 'pending' : 'pending');
            const isCurrent = isExecuting && status === 'running';
            return (
              <div
                key={step.id}
                className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 ${
                  isCurrent ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-zinc-950/30 border border-transparent'
                }`}
              >
                <div className="flex flex-col items-center pt-0.5">
                  {isPending ? (
                    <div className="h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                      {i + 1}
                    </div>
                  ) : (
                    <StepStatusIcon status={status} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${status === 'success' ? 'text-zinc-200' : status === 'failed' ? 'text-rose-300' : status === 'skipped' ? 'text-zinc-500' : status === 'rolled-back' ? 'text-amber-300' : 'text-zinc-200'}`}>
                      {step.label}
                    </span>
                    {step.critical === false && isPending && (
                      <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-zinc-500 border-zinc-700 bg-zinc-800/40">
                        optional
                      </Badge>
                    )}
                    {step.rollback && isPending && (
                      <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-sky-400/70 border-sky-500/30 bg-sky-500/5">
                        ↩ rollback
                      </Badge>
                    )}
                  </div>
                  {step.description && isPending && (
                    <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{step.description}</div>
                  )}
                  {stepResult?.summary && !isPending && (
                    <div className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed line-clamp-2">{stepResult.summary}</div>
                  )}
                  {stepResult?.error && (
                    <div className="text-[10px] text-rose-400 mt-0.5 leading-relaxed line-clamp-2">{stepResult.error}</div>
                  )}
                </div>
                {isPending && (
                  <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-mono pt-0.5">
                    {step.actionName}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Execution error (if any, before steps ran) */}
        {part.error && (state === 'failed') && (
          <div className="flex items-start gap-1.5 text-[11px] text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-md px-2 py-1.5">
            <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap">{part.error}</span>
          </div>
        )}

        {/* Final summary (complete) */}
        {isComplete && part.result?.summary && (
          <div className="rounded-md bg-zinc-950/40 border border-zinc-800/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Workflow summary</div>
            <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
              <ReactMarkdown>{part.result.summary}</ReactMarkdown>
            </div>
            {/* Counters */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-zinc-800/60 text-[10px]">
              <span className="text-emerald-400">✓ {part.result.completedCount} completed</span>
              {part.result.skippedCount > 0 && <span className="text-zinc-500">⊘ {part.result.skippedCount} skipped</span>}
              {part.result.failedCount > 0 && <span className="text-rose-400">✗ {part.result.failedCount} failed</span>}
              <span className="text-zinc-600 ml-auto">{(part.result.durationMs / 1000).toFixed(1)}s</span>
            </div>
            {/* View-in links */}
            {part.result.viewIn && part.result.viewIn.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {part.result.viewIn.map((v, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                    <ArrowRight className="h-2.5 w-2.5" />
                    {v.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons (pending only) */}
        {isPending && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onConfirm?.(plan)}
              className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Run workflow ({plan.steps.length} steps)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel?.(plan)}
              className="h-8 gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        )}

        {/* Cancelled note */}
        {isCancelled && (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <X className="h-3 w-3" />
            Workflow cancelled — no changes were made to your data.
          </div>
        )}
      </div>
    </motion.div>
  );
}
