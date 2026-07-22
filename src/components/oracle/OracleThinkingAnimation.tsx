'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Thinking Animation — ChatGPT-style reasoning checklist
//
// Shows a animated checklist of data sources Oracle is reading before
// generating a response. Each item appears with a stagger, then a checkmark
// animates in. The final "Generating recommendations..." shows a spinner.
//
// Used inside Oracle message bubbles while streaming is in progress.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Database, Landmark, Receipt, TrendingUp, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Reading Zoho Books', icon: Database },
  { label: 'Reading Banking', icon: Landmark },
  { label: 'Reading GST', icon: Receipt },
  { label: 'Calculating Cash Flow', icon: TrendingUp },
  { label: 'Checking Compliance', icon: ShieldCheck },
];

export function OracleThinkingAnimation({ compact = false }: { compact?: boolean }) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSteps(i + 1), 300 * (i + 1)));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={compact ? 'py-2' : 'py-6'}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-4"
      >
        <span className="text-sm font-semibold text-amber-400 tracking-tight">
          Thinking
        </span>
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-sm text-white/40"
        >
          ...
        </motion.span>
      </motion.div>

      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {STEPS.slice(0, visibleSteps).map((step, i) => {
            const isLast = i === visibleSteps - 1 && visibleSteps < STEPS.length;
            const isComplete = i < visibleSteps - 1 || visibleSteps === STEPS.length;
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Icon className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <span className="text-[13px] text-white/70 flex-1">{step.label}</span>
                {isComplete ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                  </motion.div>
                ) : (
                  <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visibleSteps >= STEPS.length && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 pt-1"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 ring-1 ring-amber-500/20">
              <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
            </div>
            <span className="text-[13px] text-amber-300 font-medium">
              Generating recommendations...
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default OracleThinkingAnimation;
