'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Workflow Studio (Phase Delta · 1)
// Visual workflow automation: templates + active runs with live step timeline.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Workflow as WorkflowIcon, Zap, Clock, CheckCircle2, AlertCircle,
  Play, ArrowRight, GitBranch, Timer, Mail, MessageCircle, Bell,
  Plus, ChevronDown, ChevronRight,
} from 'lucide-react';
import { WORKFLOW_TEMPLATES, type WorkflowStep } from '@/lib/autonomous-finance/workflow-engine';
import { useFireRecentActivities } from '@/hooks/use-firestore';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

interface RunRecord {
  id: string;
  workflowName: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  steps: { name: string; type: string; status: string }[];
}

const STEP_ICON: Record<string, React.ElementType> = {
  action: Zap, condition: GitBranch, delay: Timer,
  approval: CheckCircle2, parallel: WorkflowIcon,
};

function activateTemplate(template: typeof WORKFLOW_TEMPLATES[number], setRuns: React.Dispatch<React.SetStateAction<RunRecord[]>>) {
  const run: RunRecord = {
    id: `run_${Date.now()}`,
    workflowName: template.name,
    status: 'running',
    currentStep: 0,
    totalSteps: template.steps.length,
    startedAt: new Date().toISOString(),
    steps: template.steps.map((s) => ({ name: s.name, type: s.type, status: 'pending' })),
  };
  setRuns((prev) => [run, ...prev]);
  toast.success(`Workflow "${template.name}" activated`);
  // Simulate step progression for demo realism
  let step = 0;
  const tick = () => {
    step++;
    setRuns((prev) => prev.map((r) => {
      if (r.id !== run.id) return r;
      const updated = { ...r, currentStep: step, steps: r.steps.map((s, i) => ({ ...s, status: i < step ? 'completed' : i === step ? 'running' : 'pending' })) };
      if (step >= r.totalSteps) { updated.status = 'completed'; updated.currentStep = r.totalSteps - 1; }
      return updated;
    }));
    if (step < template.steps.length) setTimeout(tick, 1200);
  };
  setTimeout(tick, 800);
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function WorkflowStudioPage() {
  const { data: activities } = useFireRecentActivities(50);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = runs.length;
    const completed = runs.filter((r) => r.status === 'completed').length;
    const running = runs.filter((r) => r.status === 'running').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, running, successRate };
  }, [runs]);

  const lastSync = runs[0] ? new Date(runs[0].startedAt) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Workflow Studio</h1>
              <p className="mt-1 text-sm text-muted-foreground">Autonomous Finance Operations — trigger-based, scheduled, event-driven</p>
            </div>
            <TrustBar connected={runs.length > 0} lastSync={lastSync} activityCount={activities.length} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={WorkflowIcon} label="Active Workflows" value={stats.running} accent="bg-emerald-500/15 text-emerald-300" />
            <StatCard icon={Play} label="Runs Total" value={stats.total} accent="bg-cyan-500/15 text-cyan-300" />
            <StatCard icon={CheckCircle2} label="Success Rate" value={`${stats.successRate}%`} accent="bg-teal-500/15 text-teal-300" />
            <StatCard icon={Clock} label="Avg Duration" value="1.2s" accent="bg-violet-500/15 text-violet-300" />
          </div>

          {/* Templates */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workflow Templates</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {WORKFLOW_TEMPLATES.map((tpl, i) => (
                <motion.div
                  key={tpl.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: i * 0.05 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-white/10 text-[10px] uppercase">
                          {tpl.trigger.type === 'event' ? 'Event' : tpl.trigger.type === 'schedule' ? 'Schedule' : 'Manual'}
                        </Badge>
                        <Badge variant="outline" className="border-white/10 text-[10px]">v{tpl.version}</Badge>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-foreground">{tpl.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
                    </div>
                    <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      onClick={() => activateTemplate(tpl, setRuns)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Activate
                    </Button>
                  </div>

                  {/* Step preview */}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {tpl.steps.slice(0, 6).map((s: WorkflowStep, idx) => {
                      const Icon = STEP_ICON[s.type] ?? Zap;
                      return (
                        <div key={s.id} className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1">
                            <Icon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{s.name}</span>
                          </div>
                          {idx < Math.min(tpl.steps.length, 6) - 1 && <ArrowRight className="h-3 w-3 text-white/20" />}
                        </div>
                      );
                    })}
                    {tpl.steps.length > 6 && <span className="text-xs text-muted-foreground">+{tpl.steps.length - 6}</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Active runs */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workflow Runs</h2>
            {runs.length === 0 ? (
              <ProfessionalEmptyState
                icon={WorkflowIcon}
                title="No active workflows"
                description="Activate a workflow template above to see live execution with step-by-step timeline, conditions, delays, and approvals."
                accent="emerald"
              />
            ) : (
              <div className="space-y-2">
                {runs.map((run) => {
                  const isOpen = expanded === run.id;
                  const statusColor = run.status === 'completed' ? 'text-emerald-400' :
                    run.status === 'running' ? 'text-amber-400' :
                    run.status === 'failed' ? 'text-rose-400' : 'text-muted-foreground';
                  return (
                    <div key={run.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <button
                        className="flex w-full items-center gap-3 p-4 text-left"
                        onClick={() => setExpanded(isOpen ? null : run.id)}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{run.workflowName}</p>
                          <p className="text-xs text-muted-foreground">Started {new Date(run.startedAt).toLocaleTimeString('en-IN')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Step {Math.min(run.currentStep + 1, run.totalSteps)}/{run.totalSteps}</span>
                          <Badge variant="outline" className={`border-current/30 ${statusColor}`}>
                            {run.status}
                          </Badge>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-white/[0.06] p-4">
                          <div className="space-y-1.5">
                            {run.steps.map((s, i) => {
                              const Icon = STEP_ICON[s.type] ?? Zap;
                              const stColor = s.status === 'completed' ? 'text-emerald-400' :
                                s.status === 'running' ? 'text-amber-400' :
                                s.status === 'waiting_approval' ? 'text-violet-400' :
                                'text-muted-foreground';
                              return (
                                <div key={i} className="flex items-center gap-2.5 text-sm">
                                  <Icon className={`h-3.5 w-3.5 ${stColor}`} />
                                  <span className="flex-1 text-foreground">{s.name}</span>
                                  <span className={`text-xs ${stColor}`}>{s.status}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
