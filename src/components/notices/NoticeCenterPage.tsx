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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bell,
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  UserPlus,
  ShieldCheck,
  Loader2,
  Calendar,
  FileText,
  Building2,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { formatNumber } from '@/lib/gst-utils';
import { toast } from 'sonner';
import { useFireNotices, useFireClients } from '@/hooks/use-firestore';
import { createNotice, updateNotice } from '@/lib/firestore-service';
import { EmptyState } from '@/components/shared';
import { Bell as BellIcon } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  avatar: string | null;
}

interface Notice {
  id: string;
  clientId: string;
  clientTradeName: string;
  clientGstin: string;
  noticeType: string;
  noticeNumber: string | null;
  noticeDate: string | null;
  subject: string;
  description: string | null;
  status: string;
  assignedTo: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  priority: string;
  dueDate: string | null;
  responseDate: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
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
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
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

// ─── Helpers ───────────────────────────────────────────────────────────────
// P1-M2: Notice types now come from the FirestoreNotice.NoticeType enum
// (gst_show_cause, gst_demand, gst_assessment, gst_scrutiny,
// gst_refund_rejection, gst_cancellation, gst_3b_mismatch, roc_notice,
// income_tax_notice, tds_notice, other). The badge/icon helpers map each
// enum value to a human-readable label + Tailwind classes.
function getNoticeTypeBadge(type: string): { label: string; classes: string } {
  switch (type) {
    // GST-related — red family
    case 'gst_show_cause':
    case 'gst_demand':
    case 'gst_cancellation':
      return { label: 'GST Notice', classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800' };
    case 'gst_assessment':
    case 'gst_scrutiny':
    case 'gst_3b_mismatch':
      return { label: 'GST Scrutiny', classes: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' };
    case 'gst_refund_rejection':
      return { label: 'GST Refund', classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' };
    // Non-GST department notices — amber family
    case 'roc_notice':
    case 'income_tax_notice':
    case 'tds_notice':
      return { label: 'Dept Notice', classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' };
    default:
      return { label: 'Notice', classes: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
  }
}

function getNoticeTypeIcon(type: string) {
  switch (type) {
    case 'gst_show_cause':
    case 'gst_demand':
    case 'gst_assessment':
    case 'gst_scrutiny':
    case 'gst_cancellation':
    case 'gst_3b_mismatch':
    case 'gst_refund_rejection':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'roc_notice':
    case 'income_tax_notice':
    case 'tds_notice':
      return <FileText className="h-3.5 w-3.5" />;
    default:
      return <Bell className="h-3.5 w-3.5" />;
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'open': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800';
    case 'in_progress': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
    case 'resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    default: return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'open': return <XCircle className="h-3 w-3" />;
    case 'in_progress': return <Clock className="h-3 w-3" />;
    case 'resolved': return <CheckCircle2 className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
}

function getPriorityBadge(priority: string): string {
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
    case 'urgent': return 'bg-red-500 animate-pulse';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-emerald-500';
    default: return 'bg-slate-500';
  }
}

function getCountdown(dueDate: string | null): { text: string; color: string; urgent: boolean } {
  if (!dueDate) return { text: 'No due date', color: 'text-muted-foreground', urgent: false };
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-red-600 dark:text-red-400', urgent: true };
  if (days === 0) return { text: 'Due today', color: 'text-red-600 dark:text-red-400', urgent: true };
  if (days <= 3) return { text: `${days}d left`, color: 'text-amber-600 dark:text-amber-400', urgent: true };
  if (days <= 7) return { text: `${days}d left`, color: 'text-amber-600 dark:text-amber-400', urgent: false };
  return { text: `${days}d left`, color: 'text-emerald-600 dark:text-emerald-400', urgent: false };
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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
      transition={{ delay, duration: 0.5, ease: 'easeOut' as const }}
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
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function NoticeSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-5 w-3/4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mock Data ─────────────────────────────────────────────────────────────
// mockNotices + mockClients removed in P1-M2 — notices now come from Firestore
// (useFireNotices) and clients come from useFireClients. Team members still
// come from REST because memberships are not one of the 15 collections.
const mockTeamMembers: TeamMember[] = [
  { id: 'tm1', name: 'Priya Sharma', email: 'priya@firm.com', role: 'manager', department: 'compliance', avatar: null },
  { id: 'tm2', name: 'Rahul Mehta', email: 'rahul@firm.com', role: 'senior', department: 'filing', avatar: null },
  { id: 'tm3', name: 'Anita Desai', email: 'anita@firm.com', role: 'staff', department: 'compliance', avatar: null },
  { id: 'tm4', name: 'Vikram Singh', email: 'vikram@firm.com', role: 'senior', department: 'audit', avatar: null },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function NoticeCenterPage() {
  // ── State ──────────────────────────────────────────────────────────────
  // P1-M2: notices + clients now come from Firestore hooks (real-time).
  // Team members still come from REST (memberships aren't one of the 15
  // collections the user requested to migrate to Firestore).
  const fireNoticesQ = useFireNotices();
  const fireClientsQ = useFireClients();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);

  // Map Firestore notices (noticeId → id, timestamps already ISO-stringified
  // by useFirestoreCollection's convertDoc helper).
  const notices: Notice[] = useMemo(() => {
    return (fireNoticesQ.data ?? []).map(n => ({
      id: n.noticeId,
      clientId: n.clientId ?? '',
      clientTradeName: n.clientTradeName ?? '',
      clientGstin: n.clientGstin ?? '',
      noticeType: n.noticeType ?? 'other',
      noticeNumber: n.noticeNumber ?? null,
      noticeDate: n.noticeDate ?? null,
      subject: n.subject ?? '',
      description: n.description ?? null,
      status: n.status ?? 'open',
      assignedTo: n.assignedTo ?? null,
      assigneeName: n.assigneeName ?? null,
      assigneeEmail: n.assigneeEmail ?? null,
      priority: n.priority ?? 'medium',
      dueDate: n.dueDate ?? null,
      responseDate: n.responseDate ?? null,
      resolution: n.resolution ?? null,
      createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString(),
      updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : new Date().toISOString(),
    }));
  }, [fireNoticesQ.data]);

  const clients: Client[] = useMemo(() => {
    return (fireClientsQ.data ?? []).map(c => ({
      id: c.clientId,
      tradeName: c.tradeName,
      gstin: c.gstin,
    }));
  }, [fireClientsQ.data]);

  const loading = fireNoticesQ.loading || fireClientsQ.loading;
  const error = fireNoticesQ.error ?? fireClientsQ.error;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [formClient, setFormClient] = useState('');
  const [formNoticeType, setFormNoticeType] = useState('gst_show_cause');
  const [formNoticeNumber, setFormNoticeNumber] = useState('');
  const [formNoticeDate, setFormNoticeDate] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAssignTo, setFormAssignTo] = useState('');

  // Detail dialog - resolution form
  const [resolutionText, setResolutionText] = useState('');
  const [reassignTo, setReassignTo] = useState('');

  // ── Fetch Team Members (REST — kept as-is) ─────────────────────────────
  // Notices + clients come from Firestore; team members stay on REST because
  // memberships aren't one of the 15 collections the user requested to migrate.
  const fetchTeamMembers = useCallback(async () => {
    try {
      setTeamMembersLoading(true);
      const teamRes = await fetch('/api/team-members');
      let members: TeamMember[] = [];
      if (teamRes.ok) {
        const data = await teamRes.json();
        members = data.teamMembers ?? [];
      }
      setTeamMembers(members);
    } catch (err) {
      console.error('Team members fetch error:', err);
      setTeamMembers([]);
    } finally {
      setTeamMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // ── Derived Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const open = notices.filter(n => n.status === 'open').length;
    const inProgress = notices.filter(n => n.status === 'in_progress').length;
    const resolved = notices.filter(n => n.status === 'resolved').length;
    const urgent = notices.filter(n => n.priority === 'urgent' && n.status !== 'resolved').length;
    return { open, inProgress, resolved, total: notices.length, urgent };
  }, [notices]);

  // ── Filtered Notices ──────────────────────────────────────────────────
  const filteredNotices = useMemo(() => {
    return notices.filter(notice => {
      // Status filter
      if (statusFilter !== 'all' && notice.status !== statusFilter) return false;
      // Type filter
      if (typeFilter !== 'all' && notice.noticeType !== typeFilter) return false;
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchSubject = notice.subject.toLowerCase().includes(q);
        const matchClient = notice.clientTradeName.toLowerCase().includes(q);
        const matchNumber = notice.noticeNumber?.toLowerCase().includes(q);
        const matchGstin = notice.clientGstin.toLowerCase().includes(q);
        if (!matchSubject && !matchClient && !matchNumber && !matchGstin) return false;
      }
      return true;
    });
  }, [notices, statusFilter, typeFilter, searchQuery]);

  // ── Create Notice ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!formClient || !formSubject) return;
    try {
      setSubmitting(true);
      const selectedClient = clients.find(c => c.id === formClient);
      const selectedMember = teamMembers.find(m => m.id === formAssignTo);
      await createNotice({
        clientId: formClient,
        clientTradeName: selectedClient?.tradeName ?? null,
        clientGstin: selectedClient?.gstin ?? null,
        noticeType: formNoticeType as Notice['noticeType'],
        noticeNumber: formNoticeNumber || null,
        noticeDate: formNoticeDate || null,
        subject: formSubject,
        description: formDescription || null,
        status: 'open',
        priority: formPriority as Notice['priority'],
        assignedTo: formAssignTo || null,
        assigneeName: selectedMember?.name ?? null,
        assigneeEmail: selectedMember?.email ?? null,
        dueDate: formDueDate || null,
        responseDate: null,
        resolution: null,
        attachmentUrl: null,
      });
      toast.success('Notice created');
      setCreateDialogOpen(false);
      resetCreateForm();
    } catch (err) {
      console.error('Failed to create notice:', err);
      toast.error('Failed to create notice');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Update Notice (Resolve / Reassign) ────────────────────────────────
  const handleResolve = async () => {
    if (!selectedNotice) return;
    try {
      await updateNotice(selectedNotice.id, {
        status: 'resolved',
        resolution: resolutionText || 'Resolved',
        responseDate: new Date().toISOString(),
      });
      toast.success('Notice resolved');
      setDetailDialogOpen(false);
      setResolutionText('');
    } catch (err) {
      console.error('Failed to resolve notice:', err);
      toast.error('Failed to resolve notice');
    }
  };

  const handleReassign = async () => {
    if (!selectedNotice || !reassignTo) return;
    try {
      const member = teamMembers.find(m => m.id === reassignTo);
      await updateNotice(selectedNotice.id, {
        assignedTo: reassignTo,
        assigneeName: member?.name ?? null,
        assigneeEmail: member?.email ?? null,
      });
      toast.success('Notice reassigned');
      setDetailDialogOpen(false);
      setReassignTo('');
    } catch (err) {
      console.error('Failed to reassign notice:', err);
      toast.error('Failed to reassign notice');
    }
  };

  const handleQuickAction = async (noticeId: string, action: 'in_progress' | 'resolved', assignTo?: string) => {
    try {
      const updates: Record<string, unknown> = {};
      if (action) updates.status = action;
      if (assignTo) {
        const member = teamMembers.find(m => m.id === assignTo);
        updates.assignedTo = assignTo;
        updates.assigneeName = member?.name ?? null;
        updates.assigneeEmail = member?.email ?? null;
      }
      if (action === 'resolved') {
        updates.responseDate = new Date().toISOString();
      }
      await updateNotice(noticeId, updates);
      toast.success('Notice updated');
    } catch (err) {
      console.error('Failed to update notice:', err);
      toast.error('Failed to update notice');
    }
  };

  const resetCreateForm = () => {
    setFormClient('');
    setFormNoticeType('gst_show_cause');
    setFormNoticeNumber('');
    setFormNoticeDate('');
    setFormSubject('');
    setFormDescription('');
    setFormPriority('medium');
    setFormDueDate('');
    setFormAssignTo('');
  };

  const openDetail = (notice: Notice) => {
    setSelectedNotice(notice);
    setResolutionText(notice.resolution || '');
    setReassignTo(notice.assignedTo || '');
    setDetailDialogOpen(true);
  };

  // ── Timeline generation for detail dialog ──────────────────────────────
  function generateTimeline(notice: Notice) {
    const timeline: { date: string; event: string; color: string }[] = [];
    timeline.push({
      date: notice.createdAt,
      event: 'Notice received',
      color: 'text-red-500',
    });
    if (notice.assignedTo && notice.assigneeName) {
      timeline.push({
        date: notice.createdAt,
        event: `Assigned to ${notice.assigneeName}`,
        color: 'text-amber-500',
      });
    }
    if (notice.status === 'in_progress') {
      timeline.push({
        date: notice.updatedAt,
        event: 'Work in progress',
        color: 'text-amber-500',
      });
    }
    if (notice.status === 'resolved' && notice.responseDate) {
      timeline.push({
        date: notice.responseDate,
        event: `Resolved${notice.resolution ? ': ' + notice.resolution.slice(0, 80) : ''}`,
        color: 'text-emerald-500',
      });
    }
    return timeline;
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
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-700 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              Notice Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track and manage GST notices and department queries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchTeamMembers(); }}
            className="gap-1.5 h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Create Notice
          </Button>
        </div>
      </motion.div>

      {/* ═══ NOTICE STATS ROW ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* Open Notices */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Open Notices</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                      {formatNumber(stats.open)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {stats.urgent} urgent
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-red-50 dark:bg-red-950/40">
                    <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
            </Card>
          </motion.div>

          {/* In Progress */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">In Progress</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {formatNumber(stats.inProgress)}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 text-amber-500" />
                      <span>Being worked on</span>
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

          {/* Resolved */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Resolved</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNumber(stats.resolved)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}% resolution rate
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ FILTER BAR ═══ */}
      <AnimatedCard delay={0.15}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notices..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="gst_show_cause">GST Show Cause</SelectItem>
                <SelectItem value="gst_demand">GST Demand</SelectItem>
                <SelectItem value="gst_assessment">GST Assessment</SelectItem>
                <SelectItem value="gst_scrutiny">GST Scrutiny</SelectItem>
                <SelectItem value="gst_refund_rejection">GST Refund Rejection</SelectItem>
                <SelectItem value="gst_cancellation">GST Cancellation</SelectItem>
                <SelectItem value="gst_3b_mismatch">GSTR-3B Mismatch</SelectItem>
                <SelectItem value="roc_notice">ROC Notice</SelectItem>
                <SelectItem value="income_tax_notice">Income Tax Notice</SelectItem>
                <SelectItem value="tds_notice">TDS Notice</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Result count */}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredNotices.length} of {notices.length} notices
            </span>
          </div>
        </CardContent>
      </AnimatedCard>

      {/* ═══ ERROR BANNER ═══ */}
      {error && !loading && (
        <AnimatedCard>
          <CardContent className="p-4 flex items-center justify-between gap-3 border-red-200 bg-red-50/50">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span>Failed to load notices: {error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </CardContent>
        </AnimatedCard>
      )}

      {/* ═══ NOTICE LIST ═══ */}
      <div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <NoticeSkeleton key={i} />)}
          </div>
        ) : filteredNotices.length === 0 ? (
          searchQuery || statusFilter !== 'all' || typeFilter !== 'all' ? (
            <AnimatedCard>
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 mb-3">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">No notices found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Try adjusting your search or filters to find notices.
                </p>
              </CardContent>
            </AnimatedCard>
          ) : (
            <AnimatedCard>
              <CardContent className="p-8">
                <EmptyState
                  icon={BellIcon}
                  title="No notices yet"
                  description="Regulatory and GST notices will appear here when received."
                />
              </CardContent>
            </AnimatedCard>
          )
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredNotices.map((notice, index) => {
                const typeBadge = getNoticeTypeBadge(notice.noticeType);
                const countdown = getCountdown(notice.dueDate);

                return (
                  <motion.div
                    key={notice.id}
                    variants={cardVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -1 }}
                  >
                    <Card className="hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
                      {/* Accent line */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        notice.status === 'open' ? 'bg-red-500' :
                        notice.status === 'in_progress' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`} />

                      <CardContent className="p-5 pl-6">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          {/* Left: Notice Info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Top row: Type badge + Priority + Status */}
                            <div className="flex items-center flex-wrap gap-1.5">
                              <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 ${typeBadge.classes}`}>
                                {getNoticeTypeIcon(notice.noticeType)}
                                {typeBadge.label}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 capitalize ${getPriorityBadge(notice.priority)}`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${getPriorityDot(notice.priority)}`} />
                                {notice.priority}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 capitalize ${getStatusBadge(notice.status)}`}>
                                {getStatusIcon(notice.status)}
                                {notice.status.replace('_', ' ')}
                              </Badge>
                            </div>

                            {/* Subject */}
                            <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors cursor-pointer" onClick={() => openDetail(notice)}>
                              {notice.subject}
                            </h3>

                            {/* Client Info */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span className="font-medium text-foreground">{notice.clientTradeName}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">{notice.clientGstin}</span>
                            </div>

                            {/* Notice Number + Date */}
                            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                              {notice.noticeNumber && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>#{notice.noticeNumber}</span>
                                </div>
                              )}
                              {notice.noticeDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{new Date(notice.noticeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                              )}
                            </div>

                            {/* Assigned To + Due Date */}
                            <div className="flex items-center gap-4 flex-wrap">
                              {notice.assigneeName ? (
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[8px] font-semibold dark:bg-emerald-950 dark:text-emerald-300">
                                      {getInitials(notice.assigneeName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">{notice.assigneeName}</span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-2 py-0 bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
                                  Unassigned
                                </Badge>
                              )}

                              {notice.dueDate && (
                                <div className={`flex items-center gap-1 text-xs font-medium ${countdown.color}`}>
                                  <Clock className="h-3 w-3" />
                                  <span>{countdown.text}</span>
                                  {countdown.urgent && (
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse ml-0.5" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Quick Actions */}
                          <div className="flex items-center gap-1.5 lg:flex-col lg:items-end shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              onClick={() => openDetail(notice)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            {notice.status !== 'resolved' && !notice.assignedTo && teamMembers.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                onClick={() => handleQuickAction(notice.id, notice.status === 'open' ? 'open' : notice.status, teamMembers[0].id)}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Assign
                              </Button>
                            )}
                            {notice.status !== 'resolved' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                onClick={() => handleQuickAction(notice.id, 'resolved')}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Resolve
                              </Button>
                            )}
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

      {/* ═══ CREATE NOTICE DIALOG ═══ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Create New Notice
            </DialogTitle>
            <DialogDescription>
              Record a new GST notice or department query
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Client *</Label>
              <Select value={formClient} onValueChange={setFormClient}>
                <SelectTrigger className="h-9">
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notice Type + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notice Type</Label>
                <Select value={formNoticeType} onValueChange={setFormNoticeType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gst_show_cause">GST Show Cause</SelectItem>
                    <SelectItem value="gst_demand">GST Demand</SelectItem>
                    <SelectItem value="gst_assessment">GST Assessment</SelectItem>
                    <SelectItem value="gst_scrutiny">GST Scrutiny</SelectItem>
                    <SelectItem value="gst_refund_rejection">GST Refund Rejection</SelectItem>
                    <SelectItem value="gst_cancellation">GST Cancellation</SelectItem>
                    <SelectItem value="gst_3b_mismatch">GSTR-3B Mismatch</SelectItem>
                    <SelectItem value="roc_notice">ROC Notice</SelectItem>
                    <SelectItem value="income_tax_notice">Income Tax Notice</SelectItem>
                    <SelectItem value="tds_notice">TDS Notice</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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

            {/* Notice Number + Notice Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notice Number</Label>
                <Input
                  value={formNoticeNumber}
                  onChange={e => setFormNoticeNumber(e.target.value)}
                  placeholder="e.g., GST/2026/001"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notice Date</Label>
                <Input
                  type="date"
                  value={formNoticeDate}
                  onChange={e => setFormNoticeDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subject *</Label>
              <Input
                value={formSubject}
                onChange={e => setFormSubject(e.target.value)}
                placeholder="Enter notice subject..."
                className="h-9"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Describe the notice details..."
                className="min-h-[80px] text-sm"
              />
            </div>

            {/* Due Date + Assign To */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Due Date</Label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={e => setFormDueDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign To</Label>
                <Select value={formAssignTo} onValueChange={setFormAssignTo}>
                  <SelectTrigger className="h-9">
                    <UserPlus className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formClient || !formSubject || submitting}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Notice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ NOTICE DETAIL DIALOG ═══ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedNotice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                    <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Notice Details
                </DialogTitle>
                <DialogDescription>
                  View full notice information and take action
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Status + Type Badges */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 ${getNoticeTypeBadge(selectedNotice.noticeType).classes}`}>
                    {getNoticeTypeIcon(selectedNotice.noticeType)}
                    {getNoticeTypeBadge(selectedNotice.noticeType).label}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 capitalize ${getStatusBadge(selectedNotice.status)}`}>
                    {getStatusIcon(selectedNotice.status)}
                    {selectedNotice.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 gap-1 capitalize ${getPriorityBadge(selectedNotice.priority)}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${getPriorityDot(selectedNotice.priority)}`} />
                    {selectedNotice.priority}
                  </Badge>
                </div>

                {/* Subject */}
                <div>
                  <h3 className="text-base font-semibold text-foreground">{selectedNotice.subject}</h3>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client</p>
                    <p className="text-sm font-medium text-foreground">{selectedNotice.clientTradeName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedNotice.clientGstin}</p>
                  </div>
                  <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Assigned To</p>
                    {selectedNotice.assigneeName ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[8px] font-semibold dark:bg-emerald-950 dark:text-emerald-300">
                            {getInitials(selectedNotice.assigneeName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground">{selectedNotice.assigneeName}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unassigned</p>
                    )}
                  </div>
                  <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notice Number</p>
                    <p className="text-sm font-medium text-foreground">{selectedNotice.noticeNumber || '—'}</p>
                  </div>
                  <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notice Date</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedNotice.noticeDate
                        ? new Date(selectedNotice.noticeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedNotice.description && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</p>
                    <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selectedNotice.description}</p>
                    </div>
                  </div>
                )}

                {/* Due Date */}
                {selectedNotice.dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Due: </span>
                    <span className={`text-sm font-medium ${getCountdown(selectedNotice.dueDate).color}`}>
                      {new Date(selectedNotice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' '}({getCountdown(selectedNotice.dueDate).text})
                    </span>
                  </div>
                )}

                <Separator />

                {/* Timeline / History */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status History</p>
                  <div className="space-y-2">
                    {generateTimeline(selectedNotice).map((entry, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`mt-1 h-2 w-2 rounded-full ${entry.color === 'text-red-500' ? 'bg-red-500' : entry.color === 'text-amber-500' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground">{entry.event}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resolution / Actions (only for non-resolved) */}
                {selectedNotice.status !== 'resolved' && (
                  <>
                    <Separator />

                    {/* Resolve Form */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resolve Notice</p>
                      <div className="space-y-3">
                        <Textarea
                          value={resolutionText}
                          onChange={e => setResolutionText(e.target.value)}
                          placeholder="Enter resolution details..."
                          className="min-h-[70px] text-sm"
                        />
                        <Button
                          onClick={handleResolve}
                          disabled={!resolutionText.trim()}
                          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Mark as Resolved
                        </Button>
                      </div>
                    </div>

                    {/* Reassign */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reassign</p>
                      <div className="flex items-center gap-2">
                        <Select value={reassignTo} onValueChange={setReassignTo}>
                          <SelectTrigger className="h-9 flex-1">
                            <UserPlus className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <SelectValue placeholder="Select team member" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleReassign}
                          disabled={!reassignTo || reassignTo === selectedNotice.assignedTo}
                          variant="outline"
                          className="h-9 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Reassign
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Show resolution if resolved */}
                {selectedNotice.status === 'resolved' && selectedNotice.resolution && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resolution</p>
                      <div className="rounded-lg p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{selectedNotice.resolution}</p>
                        {selectedNotice.responseDate && (
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Resolved on {new Date(selectedNotice.responseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
