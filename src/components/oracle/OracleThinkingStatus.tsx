'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Intelligent Thinking Status (Premium AI Experience)
//
// Instead of freezing while Oracle thinks, we show a rotating sequence of
// intelligent, contextual status messages that adapt to the user's question:
//
//   "Reading your files…"
//   "Understanding your request…"
//   "Analyzing invoices…"
//   "Searching business memory…"
//   "Building response…"
//   "Finalizing answer…"
//
// Messages rotate naturally with a smooth fade transition. The sequence is
// derived from the user's prompt (GST questions get GST-themed messages, cash
// flow questions get finance-themed messages, etc.) so the experience feels
// genuinely intelligent — not a canned loading bar.
//
// Memory-safe: all timers are cleaned up on unmount.
// Accessible: role="status" + aria-live="polite" announces progress.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface ThinkingStep {
  label: string;
  icon: typeof Sparkles;
}

// ─── Phase pools — pick the pool that matches the user's question ────────────

const GENERIC_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Understanding the context', icon: Sparkles },
  { label: 'Searching business memory', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

const GST_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Pulling GST returns', icon: Sparkles },
  { label: 'Reconciling ITC', icon: Sparkles },
  { label: 'Cross-checking tax liability', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

const INVOICE_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Scanning invoices', icon: Sparkles },
  { label: 'Matching e-invoice records', icon: Sparkles },
  { label: 'Detecting anomalies', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

const CASHFLOW_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Loading bank transactions', icon: Sparkles },
  { label: 'Projecting cash runway', icon: Sparkles },
  { label: 'Modeling scenarios', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

const COMPLIANCE_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Checking filing deadlines', icon: Sparkles },
  { label: 'Scanning notices', icon: Sparkles },
  { label: 'Reviewing penalty exposure', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

const VENDOR_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Loading vendor ledger', icon: Sparkles },
  { label: 'Checking payment history', icon: Sparkles },
  { label: 'Flagging risk signals', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

const CUSTOMER_PHASES: ThinkingStep[] = [
  { label: 'Reading your request', icon: Sparkles },
  { label: 'Loading customer records', icon: Sparkles },
  { label: 'Analyzing receivables', icon: Sparkles },
  { label: 'Scoring collection risk', icon: Sparkles },
  { label: 'Building response', icon: Sparkles },
  { label: 'Finalizing answer', icon: Sparkles },
];

function pickPhasePool(prompt: string | undefined): ThinkingStep[] {
  const t = (prompt || '').toLowerCase();
  if (!t) return GENERIC_PHASES;
  if (/\bgst\b|gstr|itc|input tax|output tax|tax liability|tax credit|return filing/.test(t)) return GST_PHASES;
  if (/invoice|e-invoice|billed|billing/.test(t)) return INVOICE_PHASES;
  if (/cash\s*flow|runway|liquidity|burn|forecast/.test(t)) return CASHFLOW_PHASES;
  if (/compliance|notice|deadline|penalty|audit|reconcil|due date/.test(t)) return COMPLIANCE_PHASES;
  if (/vendor|supplier|payable|creditor/.test(t)) return VENDOR_PHASES;
  if (/customer|client|receivable|debtor|collection/.test(t)) return CUSTOMER_PHASES;
  return GENERIC_PHASES;
}

interface OracleThinkingStatusProps {
  /** The user's prompt — used to pick a contextually relevant phase pool. */
  prompt?: string;
  /** Compact mode (smaller padding, used inside tight bubbles). */
  compact?: boolean;
}

export function OracleThinkingStatus({ prompt, compact = false }: OracleThinkingStatusProps) {
  // Derive the phase pool from the prompt with useMemo — safe to read during
  // render (unlike a ref). Re-derives only when the prompt changes.
  const phases = useMemo<ThinkingStep[]>(() => pickPhasePool(prompt), [prompt]);
  const [stepIdx, setStepIdx] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Rotate through phases with a natural cadence. Each phase shows for ~1.4s
    // (slightly randomized so it doesn't feel mechanical). On the last phase,
    // we hold indefinitely until the parent unmounts us on first token.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const scheduleNext = (idx: number) => {
      if (idx >= phases.length - 1) return; // hold on last phase
      const delay = 1300 + Math.floor(Math.random() * 400);
      const t = setTimeout(() => {
        setStepIdx(idx + 1);
        scheduleNext(idx + 1);
      }, delay);
      timersRef.current.push(t);
    };

    scheduleNext(0);

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [phases]);

  const current = phases[stepIdx] ?? phases[0];
  const Icon = current?.icon ?? Sparkles;
  const progressPct = Math.round(((stepIdx + 1) / phases.length) * 100);

  return (
    <div
      className={compact ? 'py-2' : 'py-4'}
      role="status"
      aria-live="polite"
      aria-label={`Oracle is working: ${current?.label ?? 'thinking'}`}
    >
      {/* Header: gold avatar + "VEYRO AI is thinking" + animated dots */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 flex items-center gap-2"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 ring-1 ring-amber-500/25">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-amber-300">VEYRO AI is thinking</span>
        <motion.span
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm text-white/40"
        >
          •••
        </motion.span>
      </motion.div>

      {/* Rotating status line */}
      <div className="flex min-h-[28px] items-center gap-2.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/10 ring-1 ring-amber-500/15">
              <Icon className="h-3 w-3 text-amber-400" />
            </div>
            <span className="text-[13px] font-medium text-white/85">{current?.label}…</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slim progress track (indeterminate feel, but reflects phase progress) */}
      <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400"
          initial={{ width: '0%' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default OracleThinkingStatus;
