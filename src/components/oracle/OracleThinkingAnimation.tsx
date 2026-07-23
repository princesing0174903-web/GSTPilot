'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Thinking Animation — Premium AI CFO reasoning sequence
//
// Exact 5-step cognitive journey shown before every streamed answer:
//   1. Thinking...
//   2. Analyzing business...
//   3. Checking invoices...
//   4. Reviewing GST...
//   5. Preparing response...  → then tokens stream naturally
//
// Each step appears with a staggered fade, a gold icon tile, a spinner while
// active, and an emerald check when complete. The whole sequence feels like a
// real CFO opening ledgers, not a loading bar.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Brain, Building2, Receipt, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Thinking', icon: Brain, hint: 'Parsing your question' },
  { label: 'Analyzing business', icon: Building2, hint: 'Loading your company profile' },
  { label: 'Checking invoices', icon: Receipt, hint: 'Scanning sales & purchases' },
  { label: 'Reviewing GST', icon: ShieldCheck, hint: 'Cross-checking tax liability' },
  { label: 'Preparing response', icon: Sparkles, hint: 'Composing your answer' },
] as const;

const STEP_INTERVAL = 360; // ms between each step reveal

export function OracleThinkingAnimation({ compact = false }: { compact?: boolean }) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSteps(i + 1), STEP_INTERVAL * (i + 1)));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={compact ? 'py-2' : 'py-5'}>
      {/* ── Header line: "Thinking ..." pulsing ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center gap-2"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 ring-1 ring-amber-500/25">
          <Brain className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-amber-300">Oracle is thinking</span>
        <motion.span
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm text-white/40"
        >
          •••
        </motion.span>
      </motion.div>

      {/* ── Staggered checklist ── */}
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {STEPS.slice(0, visibleSteps).map((step, i) => {
            const isLast = i === visibleSteps - 1 && visibleSteps < STEPS.length;
            const isComplete = i < visibleSteps - 1 || visibleSteps === STEPS.length;
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="flex items-center gap-3"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md ring-1 transition-colors ${
                    isComplete
                      ? 'bg-emerald-500/10 ring-emerald-500/20'
                      : 'bg-amber-500/10 ring-amber-500/20'
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />
                  ) : (
                    <Icon className={`h-3.5 w-3.5 ${isLast ? 'text-amber-400' : 'text-white/50'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`block text-[13px] ${
                      isComplete ? 'text-white/55 line-through decoration-white/20' : 'text-white/85 font-medium'
                    }`}
                  >
                    {step.label}
                  </span>
                  {!isComplete && (
                    <span className="block text-[10.5px] text-white/35">{step.hint}</span>
                  )}
                </div>
                {!isComplete && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ── Final "Streaming answer..." once all steps done ── */}
        {visibleSteps >= STEPS.length && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 flex items-center gap-3 border-t border-[#1F1F1F] pt-3"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-amber-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            </div>
            <span className="text-[13px] font-medium text-amber-300">Streaming your answer…</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default OracleThinkingAnimation;
