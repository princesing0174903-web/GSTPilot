'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FileText,
  AlertTriangle,
  Shield,
  Filter,
  RotateCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Teal — NO blue/indigo) ────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
};

// ─── Types ────────────────────────────────────────────────────────────────
interface AutomationLog {
  id: string;
  ruleId: string;
  trigger: string;
  status: string;
  details: string | null;
  executedAt: string;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  conditions: string | null;
  actions: string;
  isActive: boolean;
  lastRunAt: string | null;
  runCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  logs: AutomationLog[];
}

// ─── Trigger Configuration ────────────────────────────────────────────────
const TRIGGER_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  invoice_uploaded: {
    label: 'Invoice Upload',
    color: 'text-sky-700 dark:text-sky-400',
    bgColor: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800',
    icon: FileText,
  },
  return_ready: {
    label: 'Return Ready',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor:
      'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  return_filed: {
    label: 'Return Filed',
    color: 'text-teal-700 dark:text-teal-400',
    bgColor:
      'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800',
    icon: Shield,
  },
  notice_received: {
    label: 'Notice Received',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    icon: AlertTriangle,
  },
};

// ─── Animated Card Wrapper ─────────────────────────────────────────────────
function AnimatedCard({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      <Card
        className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}
      >
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Trigger Badge ─────────────────────────────────────────────────────────
function TriggerBadge({ trigger }: { trigger: string }) {
  const config = TRIGGER_CONFIG[trigger];
  if (!config) {
    return <Badge variant="outline">{trigger}</Badge>;
  }
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-xs font-medium border ${config.bgColor} ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ─── Visual Workflow Diagram ───────────────────────────────────────────────
function WorkflowDiagram({ rule }: { rule: AutomationRule }) {
  const triggerConfig = TRIGGER_CONFIG[rule.trigger];
  const TriggerIcon = triggerConfig?.icon || Zap;

  const hasConditions = !!rule.conditions && rule.conditions.trim().length > 0;

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {/* Trigger Node */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${
            triggerConfig?.bgColor || 'bg-slate-50 border-slate-200'
          } ${triggerConfig?.color || 'text-slate-700'}`}
        >
          <TriggerIcon className="h-3.5 w-3.5" />
          {triggerConfig?.label || rule.trigger}
        </div>
        <span className="text-[9px] text-muted-foreground mt-1">Trigger</span>
      </div>

      {/* Arrow */}
      <div className="flex items-center mx-1 shrink-0">
        <svg width="32" height="12" viewBox="0 0 32 12">
          <line
            x1="0"
            y1="6"
            x2="26"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted-foreground/40"
          />
          <polygon
            points="26,2 32,6 26,10"
            className="fill-muted-foreground/40"
          />
        </svg>
      </div>

      {/* Condition Node */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${
            hasConditions
              ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
          }`}
        >
          {hasConditions ? (
            <Filter className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {hasConditions ? 'Check Conditions' : 'No Conditions'}
        </div>
        <span className="text-[9px] text-muted-foreground mt-1">Condition</span>
      </div>

      {/* Arrow */}
      <div className="flex items-center mx-1 shrink-0">
        <svg width="32" height="12" viewBox="0 0 32 12">
          <line
            x1="0"
            y1="6"
            x2="26"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted-foreground/40"
          />
          <polygon
            points="26,2 32,6 26,10"
            className="fill-muted-foreground/40"
          />
        </svg>
      </div>

      {/* Action Node */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
          <Play className="h-3.5 w-3.5" />
          {rule.actions.length > 30
            ? rule.actions.substring(0, 30) + '...'
            : rule.actions}
        </div>
        <span className="text-[9px] text-muted-foreground mt-1">Action</span>
      </div>
    </div>
  );
}

// ─── Skeleton Loaders ──────────────────────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function RulesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Format Timestamp ──────────────────────────────────────────────────────
function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Invalid date';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AutomationCenterPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AutomationRule | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'failed'>('all');

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTrigger, setFormTrigger] = useState('');
  const [formConditions, setFormConditions] = useState('');
  const [formActions, setFormActions] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/automation');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Failed to fetch automation rules:', err);
      toast.error('Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ── Derived Stats ────────────────────────────────────────────────────────
  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;
  const totalExecutions = rules.reduce((sum, r) => sum + r.runCount, 0);
  const allLogs = rules.flatMap((r) => r.logs);
  const successCount = allLogs.filter((l) => l.status === 'success').length;
  const successRate =
    allLogs.length > 0
      ? Math.round((successCount / allLogs.length) * 100)
      : 0;

  const filteredLogs = allLogs
    .filter((l) => {
      if (logFilter === 'success') return l.status === 'success';
      if (logFilter === 'failed') return l.status === 'failed';
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    )
    .slice(0, 20);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreateRule = async () => {
    if (!formName.trim() || !formTrigger || !formActions.trim()) {
      toast.error('Missing required fields', {
        description: 'Name, Trigger, and Actions are required.',
      });
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          trigger: formTrigger,
          conditions: formConditions.trim() || null,
          actions: formActions.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRules((prev) => [data.rule, ...prev]);
        setCreateDialogOpen(false);
        resetForm();
        toast.success('Automation rule created', {
          description: `"${formName}" is now active.`,
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create rule');
      }
    } catch (err) {
      toast.error('Failed to create rule', {
        description:
          err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      const res = await fetch('/api/automation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          isActive: !rule.isActive,
        }),
      });

      if (res.ok) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === rule.id ? { ...r, isActive: !r.isActive } : r
          )
        );
        toast.success(
          rule.isActive ? 'Rule deactivated' : 'Rule activated',
          {
            description: `"${rule.name}" is now ${rule.isActive ? 'inactive' : 'active'}.`,
          }
        );
      }
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    try {
      const res = await fetch('/api/automation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingRule.id }),
      });

      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
        setDeleteDialogOpen(false);
        setDeletingRule(null);
        toast.success('Rule deleted', {
          description: `"${deletingRule.name}" has been removed.`,
        });
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTrigger('');
    setFormConditions('');
    setFormActions('');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </motion.div>
        <StatsSkeleton />
        <RulesSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-600/20">
            <Workflow className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Automation Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure workflow automations and triggers
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </motion.div>

      {/* ═══ STATS ROW ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Rules',
            value: totalRules,
            icon: Workflow,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          },
          {
            label: 'Active Rules',
            value: activeRules,
            icon: Play,
            color: 'text-teal-600 dark:text-teal-400',
            bg: 'bg-teal-50 dark:bg-teal-950/30',
          },
          {
            label: 'Total Executions',
            value: totalExecutions,
            icon: Activity,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-950/30',
          },
          {
            label: 'Success Rate',
            value: `${successRate}%`,
            icon: CheckCircle2,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-950/30',
          },
        ].map((stat, idx) => (
          <AnimatedCard key={stat.label} delay={0.05 + idx * 0.05}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                    {typeof stat.value === 'number'
                      ? formatNumber(stat.value)
                      : stat.value}
                  </p>
                </div>
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-xl ${stat.bg}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        ))}
      </div>

      {/* ═══ AUTOMATION RULES LIST ═══ */}
      <div className="space-y-3">
        <AnimatePresence>
          {rules.length === 0 ? (
            <AnimatedCard delay={0.2}>
              <CardContent className="p-8 text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 mx-auto mb-4">
                  <Workflow className="h-7 w-7 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  No automation rules yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                  Create your first automation rule to streamline your GST
                  workflow and reduce manual effort.
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Rule
                </Button>
              </CardContent>
            </AnimatedCard>
          ) : (
            rules.map((rule, idx) => (
              <AnimatedCard key={rule.id} delay={0.1 + idx * 0.05}>
                <CardContent className="p-4 md:p-5">
                  {/* Rule Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-foreground">
                          {rule.name}
                        </h3>
                        <TriggerBadge trigger={rule.trigger} />
                        {rule.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1 text-[10px]">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-50 text-slate-500 hover:bg-slate-100 border-slate-200 gap-1 text-[10px]">
                            <Pause className="h-2.5 w-2.5" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {rule.description}
                        </p>
                      )}
                    </div>

                    {/* Toggle + Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">
                          {rule.isActive ? 'On' : 'Off'}
                        </Label>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleRule(rule)}
                        />
                      </div>
                      <Separator orientation="vertical" className="h-6" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        title="Edit rule"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => {
                          setDeletingRule(rule);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Action Summary */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 mb-3">
                    <Zap className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate">
                      {rule.actions}
                    </span>
                  </div>

                  {/* Visual Workflow Diagram */}
                  <div className="rounded-xl border border-border/30 bg-muted/10 p-3 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Workflow
                    </p>
                    <WorkflowDiagram rule={rule} />
                  </div>

                  {/* Footer Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <RotateCw className="h-3 w-3" />
                      <span>
                        {formatNumber(rule.runCount)} run
                        {rule.runCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>
                        Last run: {formatTimestamp(rule.lastRunAt)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </AnimatedCard>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ═══ AUTOMATION LOGS ═══ */}
      {allLogs.length > 0 && (
        <AnimatedCard delay={0.3}>
          <CardHeader className="pb-2">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setLogsExpanded(!logsExpanded)}
            >
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-emerald-500" />
                Execution Logs
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 border-border/50"
                >
                  {allLogs.length}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                {logsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            <CardDescription>
              Recent automation execution history
            </CardDescription>
          </CardHeader>
          <AnimatePresence>
            {logsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0">
                  {/* Log Filters */}
                  <div className="flex items-center gap-2 mb-3">
                    {(['all', 'success', 'failed'] as const).map((filter) => (
                      <Button
                        key={filter}
                        variant={logFilter === filter ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 text-xs ${
                          logFilter === filter
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'border-border/50 text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setLogFilter(filter)}
                      >
                        {filter === 'all' && 'All'}
                        {filter === 'success' && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {filter === 'success' && 'Success'}
                        {filter === 'failed' && (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {filter === 'failed' && 'Failed'}
                      </Button>
                    ))}
                  </div>

                  {/* Log Entries */}
                  <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {filteredLogs.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        No logs matching the filter
                      </div>
                    ) : (
                      filteredLogs.map((log, idx) => {
                        const parentRule = rules.find(
                          (r) => r.id === log.ruleId
                        );
                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:bg-muted/20 transition-colors"
                          >
                            <div
                              className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${
                                log.status === 'success'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30'
                                  : 'bg-red-50 dark:bg-red-950/30'
                              }`}
                            >
                              {log.status === 'success' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {parentRule?.name || 'Unknown Rule'}
                                </span>
                                <TriggerBadge trigger={log.trigger} />
                              </div>
                              {log.details && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {log.details}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  log.status === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
                                }`}
                              >
                                {log.status === 'success' ? 'Success' : 'Failed'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatTimestamp(log.executedAt)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatedCard>
      )}

      {/* ═══ CREATE RULE DIALOG ═══ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-emerald-500" />
              Create Automation Rule
            </DialogTitle>
            <DialogDescription>
              Define a trigger and action to automate your GST workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Rule Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name" className="text-sm font-medium">
                Rule Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rule-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Auto-file on invoice match"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="rule-desc" className="text-sm font-medium">
                Description
              </Label>
              <Input
                id="rule-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of what this rule does"
              />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <Label htmlFor="rule-trigger" className="text-sm font-medium">
                Trigger <span className="text-red-500">*</span>
              </Label>
              <Select value={formTrigger} onValueChange={setFormTrigger}>
                <SelectTrigger className="w-full" id="rule-trigger">
                  <SelectValue placeholder="Select a trigger event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice_uploaded">
                    Invoice Upload
                  </SelectItem>
                  <SelectItem value="return_ready">
                    Return Ready
                  </SelectItem>
                  <SelectItem value="return_filed">
                    Return Filed
                  </SelectItem>
                  <SelectItem value="notice_received">
                    Notice Received
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <Label htmlFor="rule-conditions" className="text-sm font-medium">
                Conditions
              </Label>
              <Textarea
                id="rule-conditions"
                value={formConditions}
                onChange={(e) => setFormConditions(e.target.value)}
                placeholder='e.g., {"matchStatus": "perfect_match"} or key=value pairs'
                rows={3}
                className="font-mono text-sm resize-none"
              />
              <p className="text-xs text-muted-foreground">
                JSON format or key=value pairs (optional)
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Label htmlFor="rule-actions" className="text-sm font-medium">
                Actions <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rule-actions"
                value={formActions}
                onChange={(e) => setFormActions(e.target.value)}
                placeholder="e.g., Auto-assign to filing team and send notification"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreateRule}
              disabled={
                creating ||
                !formName.trim() ||
                !formTrigger ||
                !formActions.trim()
              }
            >
              {creating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Create Rule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION DIALOG ═══ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Automation Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingRule?.name}&quot;?
              This action cannot be undone and will also delete all associated
              execution logs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingRule(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRule}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
