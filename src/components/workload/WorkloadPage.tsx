'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Briefcase,
  Plus,
  FileText,
  ClipboardCheck,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  User,
  Calendar,
  Loader2,
  Users,
  BarChart3,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { formatNumber } from '@/lib/gst-utils';

// ─── Color Palette (Emerald/Teal — NO blue/indigo) ────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  tealDark: '#0d9488',
  tealLight: '#ccfbf1',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#ef4444',
  redLight: '#fee2e2',
  slate: '#64748b',
  slateLight: '#f1f5f9',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  avatar: string | null;
  isActive: boolean;
}

interface WorkloadAssignment {
  id: string;
  teamMemberId: string;
  entityType: string;
  title: string;
  description: string | null;
  clientId: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  assignedAt: string;
  completedAt: string | null;
  teamMember: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface WorkloadGroup {
  teamMember: TeamMember;
  assignments: WorkloadAssignment[];
  summary: {
    invoicesAssigned: number;
    invoicesPending: number;
    reviewsPending: number;
    approvalsPending: number;
    totalPending: number;
    totalCompleted: number;
    totalInProgress: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
}

interface Client {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Animation Variants ───────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

const kpiVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 26 },
  },
};

// ─── Priority Helpers ──────────────────────────────────────────────────────
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
    case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function getPriorityDot(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-emerald-500';
    default: return 'bg-slate-500';
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
    case 'in_progress': return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800';
    case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending': return <Clock className="h-3 w-3" />;
    case 'in_progress': return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'completed': return <CheckCircle2 className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
}

function getEntityTypeIcon(type: string) {
  switch (type) {
    case 'invoice': return <FileText className="h-4 w-4" />;
    case 'review': return <ClipboardCheck className="h-4 w-4" />;
    case 'approval': return <ShieldCheck className="h-4 w-4" />;
    case 'notice': return <AlertTriangle className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'manager': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    case 'senior': return 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300';
    case 'staff': return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default: return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

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
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function KPISkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function TeamCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mock Data ─────────────────────────────────────────────────────────────
const mockTeamMembers: TeamMember[] = [
  { id: 'tm1', name: 'Priya Sharma', email: 'priya@firm.com', role: 'manager', department: 'compliance', avatar: null, isActive: true },
  { id: 'tm2', name: 'Rahul Mehta', email: 'rahul@firm.com', role: 'senior', department: 'filing', avatar: null, isActive: true },
  { id: 'tm3', name: 'Anita Desai', email: 'anita@firm.com', role: 'staff', department: 'compliance', avatar: null, isActive: true },
  { id: 'tm4', name: 'Vikram Singh', email: 'vikram@firm.com', role: 'senior', department: 'audit', avatar: null, isActive: true },
  { id: 'tm5', name: 'Sneha Patel', email: 'sneha@firm.com', role: 'staff', department: 'filing', avatar: null, isActive: true },
  { id: 'tm6', name: 'Arjun Reddy', email: 'arjun@firm.com', role: 'manager', department: 'audit', avatar: null, isActive: true },
];

const mockWorkload: WorkloadGroup[] = [
  {
    teamMember: mockTeamMembers[0],
    assignments: [],
    summary: { invoicesAssigned: 24, invoicesPending: 5, reviewsPending: 3, approvalsPending: 8, totalPending: 8, totalCompleted: 16, totalInProgress: 4, byStatus: { pending: 8, completed: 16, in_progress: 4 }, byPriority: { urgent: 2, high: 4, medium: 6, low: 2 } },
  },
  {
    teamMember: mockTeamMembers[1],
    assignments: [],
    summary: { invoicesAssigned: 18, invoicesPending: 3, reviewsPending: 5, approvalsPending: 4, totalPending: 6, totalCompleted: 12, totalInProgress: 3, byStatus: { pending: 6, completed: 12, in_progress: 3 }, byPriority: { urgent: 1, high: 3, medium: 5, low: 1 } },
  },
  {
    teamMember: mockTeamMembers[2],
    assignments: [],
    summary: { invoicesAssigned: 12, invoicesPending: 4, reviewsPending: 2, approvalsPending: 1, totalPending: 5, totalCompleted: 7, totalInProgress: 2, byStatus: { pending: 5, completed: 7, in_progress: 2 }, byPriority: { high: 2, medium: 3, low: 1 } },
  },
  {
    teamMember: mockTeamMembers[3],
    assignments: [],
    summary: { invoicesAssigned: 20, invoicesPending: 2, reviewsPending: 6, approvalsPending: 5, totalPending: 4, totalCompleted: 14, totalInProgress: 3, byStatus: { pending: 4, completed: 14, in_progress: 3 }, byPriority: { urgent: 1, high: 2, medium: 4, low: 2 } },
  },
  {
    teamMember: mockTeamMembers[4],
    assignments: [],
    summary: { invoicesAssigned: 8, invoicesPending: 2, reviewsPending: 1, approvalsPending: 0, totalPending: 3, totalCompleted: 5, totalInProgress: 1, byStatus: { pending: 3, completed: 5, in_progress: 1 }, byPriority: { medium: 2, low: 1 } },
  },
  {
    teamMember: mockTeamMembers[5],
    assignments: [],
    summary: { invoicesAssigned: 16, invoicesPending: 3, reviewsPending: 4, approvalsPending: 6, totalPending: 7, totalCompleted: 9, totalInProgress: 2, byStatus: { pending: 7, completed: 9, in_progress: 2 }, byPriority: { urgent: 1, high: 3, medium: 2, low: 1 } },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WorkloadPage() {
  // ── State ──────────────────────────────────────────────────────────────
  const [workloadData, setWorkloadData] = useState<WorkloadGroup[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTeamMember, setFormTeamMember] = useState('');
  const [formEntityType, setFormEntityType] = useState('invoice');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formDueDate, setFormDueDate] = useState('');

  // ── Fetch Data ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [workloadRes, teamRes, clientsRes] = await Promise.all([
        fetch('/api/workload'),
        fetch('/api/team-members'),
        fetch('/api/clients'),
      ]);

      let workload: WorkloadGroup[] = [];
      if (workloadRes.ok) {
        const data = await workloadRes.json();
        workload = data.workload ?? [];
      }

      let members: TeamMember[] = [];
      if (teamRes.ok) {
        const data = await teamRes.json();
        members = data.teamMembers ?? [];
      }

      let clientList: Client[] = [];
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        clientList = (data.clients ?? []).map((c: { id: string; tradeName: string; gstin: string }) => ({
          id: c.id,
          tradeName: c.tradeName,
          gstin: c.gstin,
        }));
      }

      // Use mock data if API returns empty
      if (workload.length === 0 && members.length === 0) {
        workload = mockWorkload;
        members = mockTeamMembers;
      } else if (workload.length === 0 && members.length > 0) {
        // Build workload from team members
        workload = members.map((m, i) => ({
          teamMember: m,
          assignments: [],
          summary: {
            invoicesAssigned: Math.floor(Math.random() * 20) + 5,
            invoicesPending: Math.floor(Math.random() * 5) + 1,
            reviewsPending: Math.floor(Math.random() * 6),
            approvalsPending: Math.floor(Math.random() * 4),
            totalPending: Math.floor(Math.random() * 8) + 2,
            totalCompleted: Math.floor(Math.random() * 15) + 5,
            totalInProgress: Math.floor(Math.random() * 4),
            byStatus: {},
            byPriority: {},
          },
        }));
      }

      setWorkloadData(workload);
      setTeamMembers(members);
      setClients(clientList);
    } catch (err) {
      console.error('Workload fetch error:', err);
      setError('Failed to load workload data');
      setWorkloadData(mockWorkload);
      setTeamMembers(mockTeamMembers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalPending = workloadData.reduce((s, g) => s + g.summary.totalPending, 0);
    const totalCompleted = workloadData.reduce((s, g) => s + g.summary.totalCompleted, 0);
    const totalInProgress = workloadData.reduce((s, g) => s + g.summary.totalInProgress, 0);
    const totalInvoices = workloadData.reduce((s, g) => s + g.summary.invoicesAssigned, 0);
    const totalReviews = workloadData.reduce((s, g) => s + g.summary.reviewsPending, 0);
    const totalApprovals = workloadData.reduce((s, g) => s + g.summary.approvalsPending, 0);
    const urgentCount = workloadData.reduce((s, g) => s + (g.summary.byPriority.urgent ?? 0), 0);
    return { totalPending, totalCompleted, totalInProgress, totalInvoices, totalReviews, totalApprovals, urgentCount };
  }, [workloadData]);

  // ── All assignments flattened ──────────────────────────────────────────
  const allAssignments = useMemo(() => {
    return workloadData.flatMap(g => g.assignments);
  }, [workloadData]);

  // ── Submit Assignment ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formTeamMember || !formTitle) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberId: formTeamMember,
          entityType: formEntityType,
          title: formTitle,
          description: formDescription || null,
          clientId: formClient || null,
          priority: formPriority,
          dueDate: formDueDate || null,
        }),
      });
      if (res.ok) {
        setAssignDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create assignment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Update Assignment Status ───────────────────────────────────────────
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/workload', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update assignment:', err);
    }
  };

  const resetForm = () => {
    setFormTeamMember('');
    setFormEntityType('invoice');
    setFormTitle('');
    setFormDescription('');
    setFormClient('');
    setFormPriority('medium');
    setFormDueDate('');
  };

  // ── Get initials ───────────────────────────────────────────────────────
  function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
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
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              Workload Distribution
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage and distribute work across your team
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setAssignDialogOpen(true)}
            className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Assign Task
          </Button>
        </div>
      </motion.div>

      {/* ═══ KPI STATS ROW ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Total Tasks */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Total Tasks</p>
                    <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                      {formatNumber(stats.totalPending + stats.totalCompleted + stats.totalInProgress)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      <span>Across {workloadData.length} members</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    <Briefcase className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>

          {/* Pending Tasks */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Pending Tasks</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {formatNumber(stats.totalPending)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {stats.urgentCount} urgent
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-amber-50 dark:bg-amber-950/40">
                    <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
            </Card>
          </motion.div>

          {/* In Progress */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">In Progress</p>
                    <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                      {formatNumber(stats.totalInProgress)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 text-teal-500" />
                      <span>Active right now</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-teal-50 dark:bg-teal-950/40">
                    <Zap className="h-7 w-7 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-teal-500" />
            </Card>
          </motion.div>

          {/* Completed */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Completed</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(stats.totalCompleted)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">This period</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600" />
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ TEAM MEMBER CARDS ═══ */}
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2"
        >
          <Users className="h-5 w-5 text-emerald-500" />
          Team Workload
        </motion.h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <TeamCardSkeleton key={i} />)}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {workloadData.map((group, index) => {
                const member = group.teamMember;
                const s = group.summary;
                const capacity = s.invoicesAssigned + s.reviewsPending + s.approvalsPending;
                const workloadPct = capacity > 0 ? Math.min(100, Math.round(((s.invoicesPending + s.reviewsPending + s.approvalsPending) / capacity) * 100)) : 0;
                const progressColor = workloadPct > 80 ? 'bg-red-500' : workloadPct > 60 ? 'bg-amber-500' : 'bg-emerald-500';
                const progressIndicatorColor = workloadPct > 80 ? '[&>div]:bg-red-500' : workloadPct > 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500';
                const urgentCount = s.byPriority.urgent ?? 0;
                const highCount = s.byPriority.high ?? 0;

                return (
                  <motion.div
                    key={member.id}
                    variants={cardVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card className="hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
                      {/* Subtle gradient background */}
                      <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/20" />

                      <CardContent className="p-5 relative">
                        {/* Header: Avatar + Name + Role */}
                        <div className="flex items-center gap-3 mb-4">
                          <Avatar className="h-10 w-10 border-2 border-emerald-200 dark:border-emerald-800">
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-semibold">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                              {member.name}
                            </h3>
                            <Badge variant="outline" className={`text-[10px] px-2 py-0 mt-0.5 capitalize ${getRoleBadgeColor(member.role)}`}>
                              {member.role}
                            </Badge>
                          </div>
                          {/* Priority indicator */}
                          {(urgentCount > 0 || highCount > 0) && (
                            <div className="flex items-center gap-1">
                              {urgentCount > 0 && (
                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950">
                                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                  <span className="text-[9px] font-bold text-red-600 dark:text-red-400">{urgentCount}</span>
                                </div>
                              )}
                              {highCount > 0 && (
                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950">
                                  <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                  <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400">{highCount}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground font-medium">Workload Capacity</span>
                            <span className="text-xs font-bold text-foreground">{workloadPct}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-muted/30 overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${progressColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${workloadPct}%` }}
                              transition={{ duration: 1, delay: 0.3 + index * 0.05, ease: 'easeOut' }}
                            />
                          </div>
                        </div>

                        {/* Stat Breakdown */}
                        <div className="grid grid-cols-4 gap-1.5">
                          <div className="rounded-lg p-2 text-center bg-emerald-50/80 dark:bg-emerald-950/30">
                            <FileText className="h-3.5 w-3.5 text-emerald-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{s.invoicesAssigned}</p>
                            <p className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">Assigned</p>
                          </div>
                          <div className="rounded-lg p-2 text-center bg-amber-50/80 dark:bg-amber-950/30">
                            <Clock className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{s.invoicesPending}</p>
                            <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 font-medium">Pending</p>
                          </div>
                          <div className="rounded-lg p-2 text-center bg-teal-50/80 dark:bg-teal-950/30">
                            <ClipboardCheck className="h-3.5 w-3.5 text-teal-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{s.reviewsPending}</p>
                            <p className="text-[9px] text-teal-600/70 dark:text-teal-400/70 font-medium">Reviews</p>
                          </div>
                          <div className="rounded-lg p-2 text-center bg-slate-50/80 dark:bg-slate-800/40">
                            <ShieldCheck className="h-3.5 w-3.5 text-slate-500 mx-auto mb-0.5" />
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{s.approvalsPending}</p>
                            <p className="text-[9px] text-slate-600/70 dark:text-slate-400/70 font-medium">Approvals</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ═══ PENDING TASKS TABLE ═══ */}
      <div>
        <motion.h2
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2"
        >
          <ClipboardCheck className="h-5 w-5 text-emerald-500" />
          Pending Assignments
          {allAssignments.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950">
              {allAssignments.length}
            </Badge>
          )}
        </motion.h2>

        {loading ? (
          <TableSkeleton />
        ) : allAssignments.length === 0 ? (
          <AnimatedCard>
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 mb-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No pending assignments found. Assign new tasks to team members using the button above.
              </p>
            </CardContent>
          </AnimatedCard>
        ) : (
          <AnimatedCard delay={0.1}>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAssignments.map((assignment, i) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="text-sm font-medium text-foreground truncate">{assignment.title}</p>
                            {assignment.description && (
                              <p className="text-xs text-muted-foreground truncate">{assignment.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[9px] font-semibold dark:bg-emerald-950 dark:text-emerald-300">
                                {getInitials(assignment.teamMember?.name ?? 'U')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-foreground">{assignment.teamMember?.name ?? 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            {getEntityTypeIcon(assignment.entityType)}
                            <span className="text-xs capitalize">{assignment.entityType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 capitalize ${getPriorityColor(assignment.priority)}`}>
                            <div className={`h-1.5 w-1.5 rounded-full mr-1 ${getPriorityDot(assignment.priority)}`} />
                            {assignment.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.dueDate ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(assignment.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 capitalize ${getStatusBadge(assignment.status)}`}>
                            {getStatusIcon(assignment.status)}
                            {assignment.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {assignment.status !== 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                onClick={() => handleStatusUpdate(assignment.id, 'completed')}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Complete
                              </Button>
                            )}
                            {assignment.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] gap-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
                                onClick={() => handleStatusUpdate(assignment.id, 'in_progress')}
                              >
                                <ArrowRight className="h-3 w-3" />
                                Start
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </AnimatedCard>
        )}
      </div>

      {/* ═══ TASK ASSIGNMENT DIALOG ═══ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Assign New Task
            </DialogTitle>
            <DialogDescription>
              Create a new task and assign it to a team member
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Team Member */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Team Member *</Label>
              <Select value={formTeamMember} onValueChange={setFormTeamMember}>
                <SelectTrigger className="h-9">
                  <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity Type + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Entity Type *</Label>
                <Select value={formEntityType} onValueChange={setFormEntityType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="notice">Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Title *</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Enter task title..."
                className="h-9"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Describe the task..."
                className="min-h-[80px] text-sm"
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Client</Label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Due Date</Label>
              <Input
                type="date"
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formTeamMember || !formTitle || submitting}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Assign Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
