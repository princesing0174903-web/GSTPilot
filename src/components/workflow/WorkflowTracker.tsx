'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Bot,
  ShieldCheck,
  GitCompareArrows,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useApp, type AppView } from '@/contexts/AppContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Workflow Step Definition ──────────────────────────────────────────────

export type WorkflowStepId =
  | 'upload'
  | 'extraction'
  | 'validation'
  | 'reconciliation'
  | 'preparation'
  | 'filing'
  | 'filed';

interface WorkflowStep {
  id: WorkflowStepId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  targetView: AppView;
  description: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'upload',
    label: 'Upload Documents',
    shortLabel: 'Upload',
    icon: Upload,
    targetView: 'invoices',
    description: 'Upload GST invoices and documents',
  },
  {
    id: 'extraction',
    label: 'AI Extraction',
    shortLabel: 'Extract',
    icon: Bot,
    targetView: 'invoices',
    description: 'AI extracts data from documents',
  },
  {
    id: 'validation',
    label: 'Validation',
    shortLabel: 'Validate',
    icon: ShieldCheck,
    targetView: 'invoices',
    description: 'Validate extracted invoice data',
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    shortLabel: 'Reconcile',
    icon: GitCompareArrows,
    targetView: 'reconcile',
    description: 'Match books with GST portal',
  },
  {
    id: 'preparation',
    label: 'Return Preparation',
    shortLabel: 'Prepare',
    icon: FileText,
    targetView: 'returns',
    description: 'Prepare GST returns for filing',
  },
  {
    id: 'filing',
    label: 'GST Filing',
    shortLabel: 'File',
    icon: Send,
    targetView: 'returns',
    description: 'File returns on GST portal',
  },
  {
    id: 'filed',
    label: 'Filed Successfully',
    shortLabel: 'Filed',
    icon: CheckCircle2,
    targetView: 'returns',
    description: 'Returns filed successfully',
  },
];

// ─── Workflow State from AppView ───────────────────────────────────────────

function getWorkflowStepFromView(view: AppView): WorkflowStepId {
  switch (view) {
    case 'dashboard':
      return 'upload';
    case 'invoices':
      return 'extraction';
    case 'reconcile':
      return 'reconciliation';
    case 'returns':
      return 'filing';
    case 'clients':
      return 'upload';
    case 'client-workspace':
      return 'upload';
    case 'settings':
      return 'upload';
    default:
      return 'upload';
  }
}

// ─── Step Progress Percentages ─────────────────────────────────────────────

export interface WorkflowProgress {
  upload: number;
  extraction: number;
  validation: number;
  reconciliation: number;
  preparation: number;
  filing: number;
  filed: number;
}

export const DEFAULT_WORKFLOW_PROGRESS: WorkflowProgress = {
  upload: 100,
  extraction: 100,
  validation: 92,
  reconciliation: 78,
  preparation: 55,
  filing: 25,
  filed: 8,
};

// ─── Bottleneck Detection ──────────────────────────────────────────────────

function getBottleneckStep(progress: WorkflowProgress): WorkflowStepId | null {
  const steps: WorkflowStepId[] = ['upload', 'extraction', 'validation', 'reconciliation', 'preparation', 'filing', 'filed'];
  let lowestProgress = 100;
  let bottleneck: WorkflowStepId | null = null;

  for (const step of steps) {
    if (progress[step] < lowestProgress && progress[step] > 0 && progress[step] < 100) {
      lowestProgress = progress[step];
      bottleneck = step;
    }
  }

  return bottleneck;
}

// ─── Progress Bar Color ────────────────────────────────────────────────────

function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-emerald-500';
  if (percent >= 70) return 'bg-emerald-400';
  if (percent >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function getStepStatus(stepIndex: number, currentStepIndex: number, progress: number): 'completed' | 'active' | 'pending' | 'bottleneck' {
  if (progress >= 100) return 'completed';
  if (stepIndex === currentStepIndex) return 'active';
  if (stepIndex < currentStepIndex && progress < 100) return 'bottleneck';
  if (stepIndex < currentStepIndex) return 'completed';
  return 'pending';
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

interface WorkflowTrackerProps {
  progress?: WorkflowProgress;
  compact?: boolean;
}

export default function WorkflowTracker({
  progress = DEFAULT_WORKFLOW_PROGRESS,
  compact = false,
}: WorkflowTrackerProps) {
  const { currentView, setCurrentView } = useApp();

  const currentStepId = getWorkflowStepFromView(currentView);
  const currentStepIndex = WORKFLOW_STEPS.findIndex(s => s.id === currentStepId);
  const bottleneck = getBottleneckStep(progress);

  const handleStepClick = (step: WorkflowStep) => {
    setCurrentView(step.targetView);
  };

  // ── Compact mode: Horizontal bar for page header ──
  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1 sm:gap-1.5 w-full overflow-x-auto py-1 scrollbar-none">
          {WORKFLOW_STEPS.map((step, idx) => {
            const stepProgress = progress[step.id];
            const status = getStepStatus(idx, currentStepIndex, stepProgress);
            const isBottleneck = bottleneck === step.id;
            const Icon = step.icon;
            const isActive = status === 'active';
            const isCompleted = status === 'completed';

            return (
              <React.Fragment key={step.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleStepClick(step)}
                      className={`
                        flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-all duration-200 shrink-0 whitespace-nowrap
                        ${isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                          : isCompleted
                          ? 'bg-emerald-50/50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-500 dark:border-emerald-900'
                          : isBottleneck
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-800/50'
                        }
                      `}
                    >
                      {isActive && stepProgress < 100 ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : isBottleneck ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                      <span className="hidden md:inline">{step.shortLabel}</span>
                      <span className="md:hidden">{step.shortLabel.slice(0, 3)}</span>
                      {stepProgress > 0 && stepProgress < 100 && (
                        <span className={`text-[9px] sm:text-[10px] font-semibold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : isBottleneck ? 'text-amber-600' : 'text-slate-400'}`}>
                          {stepProgress}%
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">{step.label}</p>
                    <p className="text-muted-foreground">{step.description}</p>
                    <p className="mt-1">Progress: {stepProgress}%</p>
                  </TooltipContent>
                </Tooltip>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  // ── Dashboard mode: Full-width pipeline visualization ──
  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full"
      >
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-border/50 shadow-sm p-4 md:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                <GitCompareArrows className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">GST Filing Workflow</h3>
            </div>
            {bottleneck && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  Bottleneck: {WORKFLOW_STEPS.find(s => s.id === bottleneck)?.label}
                </span>
              </div>
            )}
          </div>

          {/* Pipeline Steps */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {WORKFLOW_STEPS.map((step, idx) => {
              const stepProgress = progress[step.id];
              const status = getStepStatus(idx, currentStepIndex, stepProgress);
              const isBottleneck = bottleneck === step.id;
              const Icon = step.icon;
              const isActive = status === 'active';
              const isCompleted = status === 'completed';

              return (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleStepClick(step)}
                      className="group cursor-pointer transition-all duration-200 text-left"
                    >
                      <div className={`
                        relative rounded-lg p-2 sm:p-3 transition-all duration-200 border
                        ${isActive
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : isCompleted
                          ? 'bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900'
                          : isBottleneck
                          ? 'bg-amber-50 border-amber-200 shadow-sm shadow-amber-100 dark:bg-amber-950/30 dark:border-amber-800'
                          : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/80 dark:bg-slate-900/20 dark:border-slate-800 dark:hover:bg-slate-800/30'
                        }
                      `}>
                        {/* Step icon */}
                        <div className={`
                          flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md transition-colors mx-auto mb-1.5 sm:mb-2
                          ${isActive
                            ? 'bg-emerald-600 text-white'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400'
                            : isBottleneck
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          }
                        `}>
                          {isActive && stepProgress < 100 ? (
                            <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          ) : isBottleneck ? (
                            <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          ) : (
                            <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          )}
                        </div>

                        {/* Label */}
                        <p className={`text-[9px] sm:text-[11px] font-semibold text-center truncate ${
                          isActive ? 'text-emerald-700 dark:text-emerald-400'
                          : isCompleted ? 'text-emerald-600 dark:text-emerald-500'
                          : isBottleneck ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {step.shortLabel}
                        </p>

                        {/* Progress bar */}
                        <div className="h-1 sm:h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-1.5">
                          <motion.div
                            className={`h-full rounded-full ${getProgressColor(stepProgress)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${stepProgress}%` }}
                            transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                          />
                        </div>

                        {/* Percentage */}
                        <p className={`text-[9px] sm:text-[10px] font-medium mt-1 text-center ${
                          isActive ? 'text-emerald-600 dark:text-emerald-400'
                          : isCompleted ? 'text-emerald-500'
                          : isBottleneck ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                        }`}>
                          {stepProgress}%
                        </p>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                    <p className="font-semibold">{step.label}</p>
                    <p className="text-muted-foreground mt-0.5">{step.description}</p>
                    <p className="mt-1 font-medium">{stepProgress}% complete</p>
                    {isBottleneck && (
                      <p className="text-amber-600 mt-0.5">⚠ Bottleneck detected</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Overall progress summary */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Overall Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(Object.values(progress).reduce((a, b) => a + b, 0) / 7)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round(Object.values(progress).reduce((a, b) => a + b, 0) / 7)}%
                </span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {Object.values(progress).filter(v => v >= 100).length} of 7 steps complete
            </span>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
