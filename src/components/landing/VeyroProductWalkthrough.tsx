'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Check,
  Zap,
  Lock,
  ChevronRight,
  Receipt,
  FileText,
  Landmark,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface WalkthroughStep {
  id: number;
  label: string;
  durationSec: number;
  badge: string;
  title: string;
  description: string;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 1,
    label: 'Dashboard',
    durationSec: 3.5,
    badge: '01 / 07 · COMMAND CENTER',
    title: 'Real-time financial vitals across your enterprise',
    description: 'Instant visibility into cash position, burn velocity, pending GST liabilities, and receivables.',
  },
  {
    id: 2,
    label: 'Oracle Alert',
    durationSec: 3.5,
    badge: '02 / 07 · ORACLE AI DETECTION',
    title: 'Autonomous anomaly detection before issues escalate',
    description: 'Oracle monitors ledger health 24/7, pinpointing overdue invoices and cash-flow risks.',
  },
  {
    id: 3,
    label: 'Bank Match',
    durationSec: 3.5,
    badge: '03 / 07 · SMART RECONCILIATION',
    title: 'Automated bank credit matching with 99.8% precision',
    description: 'Incoming settlements are correlated to invoice line items without manual spreadsheet entry.',
  },
  {
    id: 4,
    label: 'GST Flag',
    durationSec: 3.5,
    badge: '04 / 07 · COMPLIANCE ENGINE',
    title: 'GSTR-2B vs Books reconciliation prevents ITC leakage',
    description: 'Instant delta detection against vendor portal uploads to protect eligible tax credits.',
  },
  {
    id: 5,
    label: 'Action Plan',
    durationSec: 3.5,
    badge: '05 / 07 · ORACLE SYNTHESIS',
    title: 'Oracle prepares resolution actions under your control',
    description: 'Generates vendor dispute notices and ledger adjustments aligned with tax regulations.',
  },
  {
    id: 6,
    label: 'Approval',
    durationSec: 3.5,
    badge: '06 / 07 · HUMAN IN THE LOOP',
    title: 'One-click executive review & execution',
    description: 'Review the evidence, check the compliance trail, and authorize actions in seconds.',
  },
  {
    id: 7,
    label: 'Audit Trail',
    durationSec: 4.0,
    badge: '07 / 07 · IMMUTABLE AUDIT',
    title: 'Complete ledger synchronization and audit logging',
    description: 'Cryptographically stamped verification synced across Zoho Books and GST records.',
  },
];

const TOTAL_DURATION_SEC = WALKTHROUGH_STEPS.reduce((acc, s) => acc + s.durationSec, 0);

interface VeyroProductWalkthroughProps {
  onExplore?: () => void;
  className?: string;
}

export default function VeyroProductWalkthrough({
  onExplore,
  className = '',
}: VeyroProductWalkthroughProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progressRatio, setProgressRatio] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = WALKTHROUGH_STEPS[activeStepIndex];

  // Advance to next step
  const goToNextStep = useCallback(() => {
    setActiveStepIndex((prev) => (prev + 1) % WALKTHROUGH_STEPS.length);
  }, []);

  const goToPrevStep = useCallback(() => {
    setActiveStepIndex((prev) => (prev - 1 + WALKTHROUGH_STEPS.length) % WALKTHROUGH_STEPS.length);
  }, []);

  // Step timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const stepDurationMs = currentStep.durationSec * 1000;
    const intervalMs = 50;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += intervalMs;
      const ratio = Math.min(elapsed / stepDurationMs, 1);
      setProgressRatio(ratio);

      if (elapsed >= stepDurationMs) {
        goToNextStep();
        elapsed = 0;
      }
    }, intervalMs);

    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [isPlaying, activeStepIndex, currentStep.durationSec, goToNextStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        goToNextStep();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        goToPrevStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextStep, goToPrevStep]);

  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* ── Outer Frame (Apple / Linear hardware-grade enclosure) ── */}
      <div className="relative rounded-2xl md:rounded-3xl border border-white/[0.12] bg-[#0A0A0A] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8),0_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden">
        
        {/* Top Browser / Chrome Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111111]/90 border-b border-white/[0.08] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#272727] border border-white/10" />
            <span className="h-3 w-3 rounded-full bg-[#272727] border border-white/10" />
            <span className="h-3 w-3 rounded-full bg-[#272727] border border-white/10" />
            <div className="ml-3 hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/[0.06] text-[11px] font-mono text-[#A1A1A1]">
              <Lock className="h-3 w-3 text-white/50" />
              <span>app.veyro.com/workspace</span>
            </div>
          </div>

          {/* Live Walkthrough Badge */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="text-[11px] font-semibold tracking-wider text-white uppercase font-mono">
              Live Product Demo
            </span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-2 text-white/50 hover:text-white transition-colors cursor-pointer p-1"
              title="Watch full product tour"
              aria-label="Expand product tour"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Main Viewport Canvas (16:10 aspect ratio for crisp UI display) ── */}
        <div className="relative aspect-[16/10] w-full bg-[#000000] overflow-hidden flex flex-col justify-between p-4 sm:p-6 md:p-8">
          
          {/* Background Ambient Grid */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #FFFFFF 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Step Header Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.12] text-[11px] font-mono font-medium text-white tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>{currentStep.badge}</span>
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-mono text-[#A1A1A1]">
                STEP {currentStep.id} OF {WALKTHROUGH_STEPS.length}
              </span>
            </div>
          </div>

          {/* ── DYNAMIC FRAME CONTENT PER STEP ── */}
          <div className="relative z-10 flex-1 flex items-center justify-center my-2 sm:my-4">
            <AnimatePresence mode="wait">
              
              {/* STEP 1: Command Center */}
              {activeStepIndex === 0 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-2xl space-y-3.5"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-3.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1A1] block">Cash Position</span>
                      <span className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 block">₹42,50,000</span>
                      <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block">+14.2% MoM</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-3.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1A1] block">Monthly Revenue</span>
                      <span className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 block">₹18,40,000</span>
                      <span className="text-[10px] text-white/70 font-medium mt-0.5 block">24 Invoices</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-3.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1A1] block">Pending GST</span>
                      <span className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 block">₹1,12,400</span>
                      <span className="text-[10px] text-amber-400 font-medium mt-0.5 block">Due 20th Oct</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-3.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#A1A1A1] block">Receivables</span>
                      <span className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 block">₹3,20,000</span>
                      <span className="text-[10px] text-rose-400 font-medium mt-0.5 block">2 Overdue</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">ICICI Corporate Bank Feed</p>
                        <p className="text-[11px] text-[#A1A1A1]">Live sync active · 3 accounts connected</p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      SYNCED
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Oracle Overdue Alert */}
              {activeStepIndex === 1 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-xl rounded-2xl border border-amber-500/30 bg-[#0E0E0E] p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                          Oracle Cash Intelligence Alert
                        </span>
                        <h4 className="text-sm font-bold text-white mt-0.5">
                          High-Risk Overdue Invoice Detected
                        </h4>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-mono font-bold">
                      12 DAYS OVERDUE
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-3.5 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#A1A1A1]">Invoice:</span>
                      <span className="font-mono font-semibold text-white">#INV-2026-084</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#A1A1A1]">Client:</span>
                      <span className="font-semibold text-white">Apex Technologies Private Limited</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#A1A1A1]">Outstanding Amount:</span>
                      <span className="font-mono font-bold text-white text-sm">₹1,84,000.00</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#A1A1A1] leading-relaxed">
                    Oracle analysis: Apex Tech credit history shows recurring 14-day payment lag. Recovery probability drops by 4.2% per week past due.
                  </p>
                </motion.div>
              )}

              {/* STEP 3: Smart Bank Match */}
              {activeStepIndex === 2 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-xl rounded-2xl border border-white/[0.12] bg-[#0E0E0E] p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                          Automated Bank Feed Matching
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          Incoming Credit Correlated
                        </h4>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      99.8% CONFIDENCE
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-[#A1A1A1] block">ICICI BANK CREDIT · UTR ICIC90248102</span>
                        <span className="text-xs font-semibold text-white">CMS/NEFT/APEX TECH PVT LTD</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-emerald-400">+₹1,84,000.00</span>
                    </div>

                    <div className="flex justify-center -my-1">
                      <div className="h-5 w-px bg-white/20" />
                    </div>

                    <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-[#A1A1A1] block">CORRELATED INVOICE</span>
                        <span className="text-xs font-semibold text-white">Invoice #INV-2026-084</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-full">
                        MATCHED & RECONCILED
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: GST 2B Discrepancy */}
              {activeStepIndex === 3 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-[#0E0E0E] p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                          GSTR-2B Automated Cross-Check
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          ITC Discrepancy Detected
                        </h4>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full">
                      DELTA DETECTED
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-white/[0.08] bg-black/40 p-2.5">
                      <span className="text-[10px] text-[#A1A1A1] font-mono block">Books ITC</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-white mt-1 block">₹1,42,800</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-black/40 p-2.5">
                      <span className="text-[10px] text-[#A1A1A1] font-mono block">Portal 2B</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-white mt-1 block">₹1,28,600</span>
                    </div>
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-2.5">
                      <span className="text-[10px] text-rose-300 font-mono block">ITC Risk Delta</span>
                      <span className="text-xs sm:text-sm font-bold font-mono text-rose-400 mt-1 block">-₹14,200</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-3 text-xs text-[#A1A1A1] space-y-1">
                    <p className="font-semibold text-white">Vendor: Vertex Dynamics (07AABCV1234F1Z8)</p>
                    <p>Filing mismatch: Vendor filed under B2C rather than B2B in GSTR-1 for Sep 2026.</p>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: Oracle Action Plan */}
              {activeStepIndex === 4 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-xl rounded-2xl border border-white/[0.15] bg-[#0E0E0E] p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                        <Sparkles className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 font-bold block">
                          Oracle Autonomous Plan
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          Recommended Resolution Package
                        </h4>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#A1A1A1] border border-white/10 px-2 py-0.5 rounded-full">
                      COMPLIANCE VERIFIED
                    </span>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-2.5">
                    <div className="flex items-start gap-2.5 text-xs text-white">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Draft vendor reconciliation notice referencing Invoice #VD-882</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-white">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Segregate ₹14,200 to Ineligible ITC Table 4(B)(2) in GSTR-3B draft</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-xs text-white">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Automate amendment follow-up reminder for vendor Oct cycle</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#A1A1A1] font-mono">
                    Statutory reference: CGST Act Section 16(2)(aa) audit compliance preserved.
                  </p>
                </motion.div>
              )}

              {/* STEP 6: Approval */}
              {activeStepIndex === 5 && (
                <motion.div
                  key="step-6"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-xl rounded-2xl border border-white/[0.2] bg-[#0E0E0E] p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold block">
                      Executive Authorization Gate
                    </span>
                    <h4 className="text-base font-bold text-white">
                      Review & Execute Resolution
                    </h4>
                    <p className="text-xs text-[#A1A1A1]">
                      You retain full control over financial actions. Click to execute.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#A1A1A1]">Action Type:</span>
                      <span className="font-semibold text-white">Ledger Correction & Vendor Dispatch</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1A1]">Target Vendor:</span>
                      <span className="font-semibold text-white">Vertex Dynamics Pvt Ltd</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1A1]">Tax Period:</span>
                      <span className="font-mono text-white">September 2026</span>
                    </div>
                  </div>

                  {/* Primary CTA pill matching universal button reference */}
                  <div className="pt-2 flex justify-center">
                    <Button
                      onClick={goToNextStep}
                      className="px-8 py-3.5 bg-white text-black font-bold rounded-full hover:bg-[#E5E5E5] active:scale-[0.98] transition-all shadow-xl min-h-[46px] text-[15px]"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirm & Execute Action
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 7: Audit Trail */}
              {activeStepIndex === 6 && (
                <motion.div
                  key="step-7"
                  initial={{ opacity: 0, scale: 0.98, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="w-full max-w-xl rounded-2xl border border-emerald-500/30 bg-[#0E0E0E] p-5 sm:p-6 shadow-2xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                          Verified Audit Complete
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          Action Executed & Sealed
                        </h4>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono font-bold">
                      <Check className="h-3 w-3" />
                      IMMUTABLE
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3.5 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-[#A1A1A1]">
                      <span>Cryptographic Stamp:</span>
                      <span className="text-white">0x8F2A...C914</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1A1]">
                      <span>Zoho Books Status:</span>
                      <span className="text-emerald-400">SYNCHRONIZED</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1A1]">
                      <span>GSTR-3B Table 4(B):</span>
                      <span className="text-emerald-400">UPDATED</span>
                    </div>
                    <div className="flex justify-between text-[#A1A1A1]">
                      <span>Execution Timestamp:</span>
                      <span className="text-white">2026-10-20 11:42:15 IST</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-[#A1A1A1]">Workflow finalized with 0 discrepancies.</span>
                    <button
                      onClick={() => setActiveStepIndex(0)}
                      className="text-xs text-white hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" /> Replay demo
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* ── Subtitle & Description Footer ── */}
          <div className="relative z-10 pt-2 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                {currentStep.title}
              </h3>
              <p className="text-[11px] text-[#A1A1A1] truncate">
                {currentStep.description}
              </p>
            </div>

            {/* Video Controls (Play/Pause, Prev, Next) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={goToPrevStep}
                className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Previous step"
                aria-label="Previous step"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>

              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="h-8 px-3 rounded-full border border-white/10 bg-white/[0.08] hover:bg-white/15 flex items-center gap-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
                title={isPlaying ? 'Pause walkthrough' : 'Play walkthrough'}
                aria-label={isPlaying ? 'Pause walkthrough' : 'Play walkthrough'}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <button
                onClick={goToNextStep}
                className="h-8 w-8 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="Next step"
                aria-label="Next step"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar under viewport */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.06]">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-white transition-all duration-75"
              style={{
                width: `${((activeStepIndex + progressRatio) / WALKTHROUGH_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* ── Interactive Step Selector Pills (Under Frame) ── */}
        <div className="p-3 sm:p-4 bg-[#0A0A0A] border-t border-white/[0.06] flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {WALKTHROUGH_STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={step.id}
                onClick={() => {
                  setActiveStepIndex(idx);
                  setProgressRatio(0);
                }}
                className={`group px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'bg-white/[0.04] text-[#A1A1A1] hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                }`}
              >
                <span className={`text-[10px] font-mono ${isActive ? 'text-black/70' : 'text-white/40'}`}>
                  0{step.id}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fullscreen Theater Modal ── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 sm:p-8"
          >
            <div className="relative w-full max-w-5xl rounded-3xl border border-white/20 bg-[#0A0A0A] p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  <div>
                    <h2 className="text-lg font-bold text-white">VEYRO Product Walkthrough</h2>
                    <p className="text-xs text-[#A1A1A1]">Autonomous Financial Operating System in Action</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Step indicator in modal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {WALKTHROUGH_STEPS.map((step, idx) => (
                  <button
                    key={step.id}
                    onClick={() => setActiveStepIndex(idx)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      idx === activeStepIndex
                        ? 'border-white bg-white text-black font-bold'
                        : 'border-white/10 bg-white/[0.02] text-[#A1A1A1] hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="text-[10px] font-mono block">STEP 0{step.id}</span>
                    <span className="text-xs font-semibold block mt-0.5">{step.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => {
                    setIsModalOpen(false);
                    if (onExplore) onExplore();
                  }}
                  className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-[#E5E5E5]"
                >
                  Explore Veyro Workspace <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
