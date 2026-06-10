'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ListTodo,
  Sparkles,
  Clock,
  CheckCircle2,
  Loader2,
  Bot,
  Play,
  UserCheck,
  ArrowRightLeft,
  Calendar,
  FileWarning,
  ShieldAlert,
  FileQuestion,
  Scale,
  Stamp,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/gst-utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ─── Types ────────────────────────────────────────────────────────────────
type TaskSourceType = 'notice' | 'risk_alert' | 'missing_document' | 'pending_reconciliation' | 'pending_approval';
type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
type TaskStatus = 'pending' | 'in_progress' | 'completed';

interface AITask {
  id: string;
  sourceType: TaskSourceType;
  title: string;
  description?: string;
  clientName?: string;
  clientId?: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  autoAssigned: boolean;
  assignedTo?: string;
  assignedToAvatar?: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
}

interface ClientOption {
  id: string;
  tradeName: string;
}

interface TasksData {
  tasks: AITask[];
}

// ─── Config Maps ──────────────────────────────────────────────────────────
const SOURCE_TYPE_CONFIG: Record<TaskSourceType, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  notice: { label: 'GST Notice', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800', icon: <FileWarning className="h-3 w-3" /> },
  risk_alert: { label: 'Risk Alert', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800', icon: <ShieldAlert className="h-3 w-3" /> },
  missing_document: { label: 'Missing Document', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800', icon: <FileQuestion className="h-3 w-3" /> },
  pending_reconciliation: { label: 'Pending Reconciliation', color: 'text-teal-700 dark:text-teal-400', bgColor: 'bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800', icon: <Scale className="h-3 w-3" /> },
  pending_approval: { label: 'Pending Approval', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800', icon: <Stamp className="h-3 w-3" /> },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800' },
  high: { label: 'High', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800' },
  medium: { label: 'Medium', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' },
  low: { label: 'Low', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' },
  in_progress: { label: 'In Progress', color: 'text-teal-700 dark:text-teal-400', bgColor: 'bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800' },
  completed: { label: 'Completed', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'notice', label: 'GST Notices' },
  { key: 'risk_alert', label: 'Risk Alerts' },
  { key: 'missing_document', label: 'Missing Documents' },
  { key: 'pending_reconciliation', label: 'Pending Reconciliations' },
  { key: 'pending_approval', label: 'Pending Approvals' },
] as const;

// ─── Default / Mock Data ──────────────────────────────────────────────────
const mockTeamMembers: TeamMember[] = [
  { id: 'tm1', name: 'Rajesh Sharma' },
  { id: 'tm2', name: 'Priya Patel' },
  { id: 'tm3', name: 'Amit Desai' },
  { id: 'tm4', name: 'Sneha Iyer' },
];

const mockClients: ClientOption[] = [
  { id: '1', tradeName: 'TechVista Solutions Pvt Ltd' },
  { id: '2', tradeName: 'Maharashtra Traders Corp' },
  { id: '3', tradeName: 'GreenLeaf Exports Ltd' },
  { id: '4', tradeName: 'Sunrise Retail Chain' },
  { id: '5', tradeName: 'Pinnacle Infrastructure Pvt Ltd' },
  { id: '6', tradeName: 'Digital Dreams Software' },
];

const mockTasks: AITask[] = [
  {
    id: 't1', sourceType: 'notice', title: 'Respond to GST Show Cause Notice', description: 'Show cause notice received for ITC discrepancy in Q3 FY24-25. Draft response needed within 15 days.',
    clientName: 'GreenLeaf Exports Ltd', clientId: '3', priority: 'urgent', dueDate: '2026-03-10', status: 'pending', autoAssigned: true, assignedTo: 'Rajesh Sharma', createdAt: '2026-02-25',
  },
  {
    id: 't2', sourceType: 'risk_alert', title: 'Review High-Value ITC Claims', description: 'ITC claims exceeding ₹10L detected — verify supplier GSTIN validity before filing.',
    clientName: 'Pinnacle Infrastructure Pvt Ltd', clientId: '5', priority: 'high', dueDate: '2026-03-12', status: 'in_progress', autoAssigned: true, assignedTo: 'Priya Patel', createdAt: '2026-02-26',
  },
  {
    id: 't3', sourceType: 'missing_document', title: 'Upload Missing Purchase Invoices', description: '23 purchase invoices from Q3 are not yet uploaded to the system. Reconciliation blocked.',
    clientName: 'Maharashtra Traders Corp', clientId: '2', priority: 'medium', dueDate: '2026-03-15', status: 'pending', autoAssigned: false, assignedTo: 'Amit Desai', createdAt: '2026-02-27',
  },
  {
    id: 't4', sourceType: 'pending_reconciliation', title: 'Complete GSTR-2B Reconciliation', description: 'Auto-reconciliation flagged 14 mismatches for February period. Manual review required.',
    clientName: 'TechVista Solutions Pvt Ltd', clientId: '1', priority: 'high', dueDate: '2026-03-08', status: 'in_progress', autoAssigned: true, assignedTo: 'Sneha Iyer', createdAt: '2026-02-28',
  },
  {
    id: 't5', sourceType: 'pending_approval', title: 'Approve GSTR-1 Filing for February', description: 'GSTR-1 JSON generated and validated. Awaiting final approval before submission.',
    clientName: 'Sunrise Retail Chain', clientId: '4', priority: 'medium', dueDate: '2026-03-07', status: 'pending', autoAssigned: false, assignedTo: 'Rajesh Sharma', createdAt: '2026-03-01',
  },
  {
    id: 't6', sourceType: 'risk_alert', title: 'Investigate Duplicate ITC Claim', description: 'Potential duplicate ITC claim of ₹3.2L detected across two return periods. Verify and rectify.',
    clientName: 'Maharashtra Traders Corp', clientId: '2', priority: 'urgent', dueDate: '2026-03-05', status: 'pending', autoAssigned: true, assignedTo: 'Priya Patel', createdAt: '2026-03-01',
  },
  {
    id: 't7', sourceType: 'notice', title: 'File Response to GST Assessment Order', description: 'Assessment order for FY 2023-24 received. Response must be filed within 30 days.',
    clientName: 'Pinnacle Infrastructure Pvt Ltd', clientId: '5', priority: 'high', dueDate: '2026-03-20', status: 'pending', autoAssigned: false, assignedTo: 'Amit Desai', createdAt: '2026-02-20',
  },
  {
    id: 't8', sourceType: 'missing_document', title: 'Collect Pending E-Way Bills', description: '8 e-way bills for inter-state movement are missing from records. Coordinate with logistics.',
    clientName: 'GreenLeaf Exports Ltd', clientId: '3', priority: 'low', dueDate: '2026-03-25', status: 'completed', autoAssigned: true, assignedTo: 'Sneha Iyer', createdAt: '2026-02-15',
  },
  {
    id: 't9', sourceType: 'pending_reconciliation', title: 'Resolve GSTR-3B vs Books Discrepancy', description: 'Tax liability difference of ₹87,000 between GSTR-3B and books for January.',
    clientName: 'Digital Dreams Software', clientId: '6', priority: 'medium', dueDate: '2026-03-18', status: 'pending', autoAssigned: false, assignedTo: 'Rajesh Sharma', createdAt: '2026-03-02',
  },
  {
    id: 't10', sourceType: 'pending_approval', title: 'Approve Annual Return Filing', description: 'GSTR-9 annual return prepared and ready for final review and approval.',
    clientName: 'TechVista Solutions Pvt Ltd', clientId: '1', priority: 'low', dueDate: '2026-03-30', status: 'completed', autoAssigned: true, assignedTo: 'Priya Patel', createdAt: '2026-02-10',
  },
];

// ─── Animated Card Wrapper ────────────────────────────────────────────────
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
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Countdown helper ─────────────────────────────────────────────────────
function getCountdown(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `${diffDays}d remaining`;
}

function getCountdownColor(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'text-red-600 dark:text-red-400';
  if (diffDays <= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

// ─── Skeletons ────────────────────────────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border/30">
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AITaskGeneratorPage() {
  // ── State ───────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<AITask[]>(mockTasks);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [clients, setClients] = useState<ClientOption[]>(mockClients);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Create task form state
  const [formClient, setFormClient] = useState('');
  const [formSourceType, setFormSourceType] = useState<TaskSourceType>('notice');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAssignTo, setFormAssignTo] = useState('');

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksRes, teamRes, clientsRes] = await Promise.allSettled([
        fetch('/api/ai-tasks'),
        fetch('/api/team-members'),
        fetch('/api/clients'),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const tasksData = await tasksRes.value.json();
        if (tasksData.tasks && tasksData.tasks.length > 0) {
          setTasks(tasksData.tasks);
        }
      }

      if (teamRes.status === 'fulfilled' && teamRes.value.ok) {
        const teamData = await teamRes.value.json();
        if (teamData.members && teamData.members.length > 0) {
          setTeamMembers(teamData.members);
        }
      }

      if (clientsRes.status === 'fulfilled' && clientsRes.value.ok) {
        const clientsData = await clientsRes.value.json();
        if (clientsData.clients && clientsData.clients.length > 0) {
          setClients(
            clientsData.clients.map((c: { id: string; tradeName: string }) => ({
              id: c.id,
              tradeName: c.tradeName,
            }))
          );
        }
      }
    } catch (err) {
      console.error('AI Tasks fetch error:', err);
      setError('Failed to load task data. Using sample data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Computed values ─────────────────────────────────────────────────────
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const filteredTasks = activeFilter === 'all'
    ? tasks
    : tasks.filter((t) => t.sourceType === activeFilter);

  // ── Task Actions ────────────────────────────────────────────────────────
  async function handleStartTask(task: AITask) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/ai-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: 'in_progress' }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'in_progress' as TaskStatus } : t))
        );
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'in_progress' as TaskStatus } : t))
        );
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'in_progress' as TaskStatus } : t))
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteTask(task: AITask) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/ai-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: 'completed' }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'completed' as TaskStatus } : t))
        );
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'completed' as TaskStatus } : t))
        );
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'completed' as TaskStatus } : t))
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleReassign(task: AITask) {
    // In a real app, this would open a reassign dialog
    const nextMember = teamMembers.find((m) => m.name !== task.assignedTo);
    if (nextMember) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, assignedTo: nextMember.name, autoAssigned: false } : t
        )
      );
    }
  }

  async function handleCreateTask() {
    if (!formTitle.trim()) return;
    const newTask: AITask = {
      id: `t${Date.now()}`,
      sourceType: formSourceType,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      clientName: clients.find((c) => c.id === formClient)?.tradeName,
      clientId: formClient || undefined,
      priority: formPriority,
      dueDate: formDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: 'pending',
      autoAssigned: false,
      assignedTo: teamMembers.find((m) => m.id === formAssignTo)?.name,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTasks((prev) => [newTask, ...prev]);
    // Reset form
    setFormClient('');
    setFormSourceType('notice');
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormDueDate('');
    setFormAssignTo('');
    setCreateDialogOpen(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────
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
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <ListTodo className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Task Generator
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Auto-generated tasks from AI intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Powered
          </Badge>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            + Create Task
          </Button>
        </div>
      </motion.div>

      {/* ═══ TASK SUMMARY ROW ═══ */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnimatedCard delay={0.05}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Tasks</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {pendingCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.1}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50">
                  <Loader2 className="h-6 w-6 text-teal-600 dark:text-teal-400 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                    {inProgressCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.15}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {completedCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>
      )}

      {/* ═══ FILTER TABS ═══ */}
      <AnimatedCard delay={0.2}>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={activeFilter === tab.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveFilter(tab.key)}
                className={`h-8 text-xs font-medium ${
                  activeFilter === tab.key
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </AnimatedCard>

      {/* ═══ ERROR STATE ═══ */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ═══ TASK LIST ═══ */}
      <AnimatedCard delay={0.25}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-5 w-5 text-emerald-500" />
            Tasks
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
            >
              {formatNumber(filteredTasks.length)}
            </Badge>
          </CardTitle>
          <CardDescription>
            {activeFilter === 'all' ? 'All AI-generated and manual tasks' : `Filtered by ${FILTER_TABS.find((t) => t.key === activeFilter)?.label}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TaskSkeleton />
          ) : filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No tasks found for this filter.
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-2 pr-2">
                <AnimatePresence>
                  {filteredTasks.map((task, index) => {
                    const srcConfig = SOURCE_TYPE_CONFIG[task.sourceType];
                    const priConfig = PRIORITY_CONFIG[task.priority];
                    const staConfig = STATUS_CONFIG[task.status];

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.4 }}
                        whileHover={{ x: 2, backgroundColor: 'rgba(16, 185, 129, 0.02)' }}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all group"
                      >
                        {/* Left: Source type badge */}
                        <Badge
                          variant="outline"
                          className={`gap-1 px-2 py-1 text-[10px] font-semibold border shrink-0 w-fit ${srcConfig.bgColor} ${srcConfig.color}`}
                        >
                          {srcConfig.icon}
                          {srcConfig.label}
                        </Badge>

                        {/* Middle: Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {task.title}
                            </p>
                            {task.autoAssigned && (
                              <Bot className="h-3.5 w-3.5 text-emerald-500 shrink-0" title="Auto-assigned by AI" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {task.clientName && (
                              <span className="text-xs text-muted-foreground truncate">
                                {task.clientName}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/60">•</span>
                            <span className={`text-xs flex items-center gap-1 ${getCountdownColor(task.dueDate)}`}>
                              <Calendar className="h-3 w-3" />
                              {getCountdown(task.dueDate)}
                            </span>
                          </div>
                        </div>

                        {/* Right: Badges + Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0.5 text-[10px] font-semibold border ${priConfig.bgColor} ${priConfig.color}`}
                          >
                            {priConfig.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`px-1.5 py-0.5 text-[10px] font-semibold border ${staConfig.bgColor} ${staConfig.color}`}
                          >
                            {staConfig.label}
                          </Badge>

                          {/* Assigned to avatar */}
                          {task.assignedTo && (
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarFallback className="text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                {task.assignedTo.split(' ').map((n) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          {/* Quick Actions */}
                          <div className="flex items-center gap-0.5 ml-1">
                            {task.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                                onClick={() => handleStartTask(task)}
                                disabled={actionLoading}
                                title="Start Task"
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => handleCompleteTask(task)}
                                disabled={actionLoading}
                                title="Complete Task"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {task.status !== 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => handleReassign(task)}
                                title="Reassign"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </AnimatedCard>

      {/* ═══ CREATE TASK DIALOG ═══ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-emerald-500" />
              Create New Task
            </DialogTitle>
            <DialogDescription>
              Add a new task to the AI Task Generator
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client</Label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Source Type</Label>
              <Select value={formSourceType} onValueChange={(v) => setFormSourceType(v as TaskSourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title *</Label>
              <Input
                placeholder="Task title..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                placeholder="Task description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Priority + Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priority</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Due Date</Label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Assign To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assign To</Label>
              <Select value={formAssignTo} onValueChange={setFormAssignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!formTitle.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
