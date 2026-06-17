'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  User,
  BarChart3,
  FileText,
  Receipt,
  Users,
  FolderOpen,
  Filter,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  Zap,
  TrendingUp,
  Timer,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, differenceInHours, parseISO } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ApprovalType = 'return_filing' | 'invoice_processing' | 'client_onboarding' | 'document_signoff';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'in_review';
type Priority = 'urgent' | 'high' | 'normal' | 'low';

interface ApprovalStep {
  level: number;
  role: string;
  assignee: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  timestamp?: string;
  comment?: string;
}

interface ApprovalRequest {
  id: string;
  title: string;
  type: ApprovalType;
  requestedBy: string;
  requestedAt: string;
  priority: Priority;
  status: ApprovalStatus;
  currentLevel: number;
  totalLevels: number;
  steps: ApprovalStep[];
  details: string;
  delegateTo?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ApprovalType, { label: string; icon: React.ElementType; color: string }> = {
  return_filing: { label: 'Return Filing', icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  invoice_processing: { label: 'Invoice Processing', icon: Receipt, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  client_onboarding: { label: 'Client Onboarding', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  document_signoff: { label: 'Document Sign-off', icon: FolderOpen, color: 'text-teal-600 bg-teal-50 border-teal-200' },
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Clock className="size-3.5" /> },
  in_review: { label: 'In Review', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: <Eye className="size-3.5" /> },
  approved: { label: 'Approved', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle className="size-3.5" /> },
  rejected: { label: 'Rejected', color: 'text-red-700 bg-red-50 border-red-200', icon: <XCircle className="size-3.5" /> },
  changes_requested: { label: 'Changes Requested', color: 'text-orange-700 bg-orange-50 border-orange-200', icon: <MessageSquare className="size-3.5" /> },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-700 bg-red-50', dot: 'bg-red-500' },
  high: { label: 'High', color: 'text-orange-700 bg-orange-50', dot: 'bg-orange-500' },
  normal: { label: 'Normal', color: 'text-blue-700 bg-blue-50', dot: 'bg-blue-500' },
  low: { label: 'Low', color: 'text-slate-700 bg-slate-50', dot: 'bg-slate-400' },
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

function generateMockApprovals(): ApprovalRequest[] {
  const items: ApprovalRequest[] = [
    {
      id: 'APR-001',
      title: 'GSTR-1 Filing - Acme Industries',
      type: 'return_filing',
      requestedBy: 'Amit Patel',
      requestedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      priority: 'urgent',
      status: 'pending',
      currentLevel: 1,
      totalLevels: 2,
      steps: [
        { level: 1, role: 'Manager', assignee: 'Priya Sharma', status: 'pending' },
        { level: 2, role: 'Admin', assignee: 'Rajesh Kumar', status: 'pending' },
      ],
      details: 'GSTR-1 for October 2024 period. Total taxable value: ₹15,23,450. 23 invoices processed.',
    },
    {
      id: 'APR-002',
      title: 'Invoice INV-2024-0156 - Vendor Payment',
      type: 'invoice_processing',
      requestedBy: 'Priya Sharma',
      requestedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      priority: 'high',
      status: 'in_review',
      currentLevel: 1,
      totalLevels: 2,
      steps: [
        { level: 1, role: 'Manager', assignee: 'Priya Sharma', status: 'approved', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), comment: 'Amount verified' },
        { level: 2, role: 'Admin', assignee: 'Rajesh Kumar', status: 'pending' },
      ],
      details: 'Invoice amount: ₹4,50,000. Vendor: TechSolutions Pvt Ltd. GST: ₹81,000.',
    },
    {
      id: 'APR-003',
      title: 'New Client: Sharma & Associates',
      type: 'client_onboarding',
      requestedBy: 'Rajesh Kumar',
      requestedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      priority: 'normal',
      status: 'approved',
      currentLevel: 2,
      totalLevels: 2,
      steps: [
        { level: 1, role: 'Manager', assignee: 'Priya Sharma', status: 'approved', timestamp: new Date(Date.now() - 20 * 3600000).toISOString(), comment: 'Documents verified' },
        { level: 2, role: 'Admin', assignee: 'Rajesh Kumar', status: 'approved', timestamp: new Date(Date.now() - 12 * 3600000).toISOString() },
      ],
      details: 'New client onboarding. GSTIN: 27AAACR5055K1ZI. Entity: Partnership firm.',
    },
    {
      id: 'APR-004',
      title: 'Annual Return Document Sign-off',
      type: 'document_signoff',
      requestedBy: 'Amit Patel',
      requestedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      priority: 'normal',
      status: 'changes_requested',
      currentLevel: 1,
      totalLevels: 1,
      steps: [
        { level: 1, role: 'Manager', assignee: 'Priya Sharma', status: 'rejected', timestamp: new Date(Date.now() - 36 * 3600000).toISOString(), comment: 'Need to update Section 8 details before approval' },
      ],
      details: 'Annual return document for FY 2023-24. Client requested revision in depreciation schedule.',
    },
    {
      id: 'APR-005',
      title: 'GSTR-3B Filing - Beta Corp',
      type: 'return_filing',
      requestedBy: 'Anita Desai',
      requestedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      priority: 'high',
      status: 'rejected',
      currentLevel: 1,
      totalLevels: 2,
      steps: [
        { level: 1, role: 'Manager', assignee: 'Priya Sharma', status: 'rejected', timestamp: new Date(Date.now() - 60 * 3600000).toISOString(), comment: 'ITC mismatch detected. Please reconcile before resubmitting.' },
        { level: 2, role: 'Admin', assignee: 'Rajesh Kumar', status: 'skipped' },
      ],
      details: 'GSTR-3B for November 2024. ITC claimed: ₹3,45,600. Mismatch with GSTR-2A.',
    },
    {
      id: 'APR-006',
      title: 'Invoice INV-2024-0187 - Service Fee',
      type: 'invoice_processing',
      requestedBy: 'Amit Patel',
      requestedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
      priority: 'low',
      status: 'pending',
      currentLevel: 1,
      totalLevels: 1,
      steps: [
        { level: 1, role: 'Manager', assignee: 'Priya Sharma', status: 'pending' },
      ],
      details: 'Professional services invoice. Amount: ₹1,20,000. Client: Delta Industries.',
    },
  ];
  return items;
}

function Eye(props: React.SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const [approvals] = useState<ApprovalRequest[]>(() => generateMockApprovals());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_changes'>('approve');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [comment, setComment] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const pendingApprovals = useMemo(() =>
    approvals.filter((a) => a.status === 'pending' || a.status === 'in_review'),
  [approvals]);

  const completedApprovals = useMemo(() =>
    approvals.filter((a) => a.status === 'approved' || a.status === 'rejected' || a.status === 'changes_requested'),
  [approvals]);

  const displayList = activeTab === 'pending' ? pendingApprovals : completedApprovals;

  const filteredList = useMemo(() => {
    let result = [...displayList];
    if (filterType !== 'all') result = result.filter((a) => a.type === filterType);
    if (filterPriority !== 'all') result = result.filter((a) => a.priority === filterPriority);
    return result;
  }, [displayList, filterType, filterPriority]);

  // Analytics
  const avgApprovalTime = useMemo(() => {
    const completed = approvals.filter((a) => a.status === 'approved');
    if (completed.length === 0) return 0;
    const totalHours = completed.reduce((sum, a) => {
      const lastStep = a.steps.filter((s) => s.status === 'approved').pop();
      if (lastStep?.timestamp) {
        return sum + differenceInHours(parseISO(lastStep.timestamp), parseISO(a.requestedAt));
      }
      return sum;
    }, 0);
    return Math.round(totalHours / completed.length);
  }, [approvals]);

  const approvalRate = useMemo(() => {
    const total = approvals.length;
    const approved = approvals.filter((a) => a.status === 'approved').length;
    return total > 0 ? Math.round((approved / total) * 100) : 0;
  }, [approvals]);

  const handleAction = (approval: ApprovalRequest, type: 'approve' | 'reject' | 'request_changes') => {
    setSelectedApproval(approval);
    setActionType(type);
    setComment('');
    setActionOpen(true);
  };

  const submitAction = () => {
    // In production, this would call an API
    setActionOpen(false);
    setSelectedApproval(null);
    setComment('');
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
          <CheckCircle className="size-5 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Approvals</h1>
          <p className="text-sm text-muted-foreground">Manage approval workflows and delegation</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingApprovals.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-2xl font-bold">{approvalRate}%</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Approval Time</p>
                <p className="text-2xl font-bold">{avgApprovalTime}h</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50">
                <Timer className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedApprovals.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50">
                <CheckCircle2 className="size-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="size-4" />
              Pending ({pendingApprovals.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <CheckCircle className="size-4" />
              History ({completedApprovals.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="size-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Priorities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Approval Cards */}
          <div className="space-y-3">
            <AnimatePresence>
              {filteredList.map((approval) => {
                const typeCfg = TYPE_CONFIG[approval.type];
                const statusCfg = STATUS_CONFIG[approval.status];
                const priorityCfg = PRIORITY_CONFIG[approval.priority];
                const TypeIcon = typeCfg.icon;
                const hoursAgo = differenceInHours(new Date(), parseISO(approval.requestedAt));

                return (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Left: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`gap-1 text-xs ${typeCfg.color}`}>
                                <TypeIcon className="size-3" />
                                {typeCfg.label}
                              </Badge>
                              <Badge variant="outline" className={`gap-1 text-xs ${priorityCfg.color}`}>
                                <div className={`size-1.5 rounded-full ${priorityCfg.dot}`} />
                                {priorityCfg.label}
                              </Badge>
                              <Badge variant="outline" className={`gap-1 text-xs ${statusCfg.color}`}>
                                {statusCfg.icon}
                                {statusCfg.label}
                              </Badge>
                            </div>
                            <h3 className="font-semibold mt-2 text-sm">{approval.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{approval.details}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="size-3" />
                                {approval.requestedBy}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {hoursAgo}h ago
                              </span>
                              <span className="flex items-center gap-1">
                                Level {approval.currentLevel}/{approval.totalLevels}
                              </span>
                            </div>
                          </div>

                          {/* Middle: Approval Chain */}
                          <div className="flex items-center gap-1 shrink-0">
                            {approval.steps.map((step, idx) => (
                              <React.Fragment key={step.level}>
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                                  step.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                  step.status === 'rejected' ? 'bg-red-50 text-red-700' :
                                  step.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                  'bg-slate-50 text-slate-400'
                                }`}>
                                  {step.status === 'approved' && <CheckCircle2 className="size-3" />}
                                  {step.status === 'rejected' && <XCircle className="size-3" />}
                                  {step.status === 'pending' && <Clock className="size-3" />}
                                  {step.status === 'skipped' && <RotateCcw className="size-3" />}
                                  <span>{step.assignee.split(' ')[0]}</span>
                                </div>
                                {idx < approval.steps.length - 1 && (
                                  <ArrowRight className="size-3 text-muted-foreground" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {/* Right: Actions */}
                          {(approval.status === 'pending' || approval.status === 'in_review') && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleAction(approval, 'approve')}
                              >
                                <CheckCircle className="size-3.5" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleAction(approval, 'reject')}
                              >
                                <XCircle className="size-3.5" />
                                Reject
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleAction(approval, 'request_changes')}
                              >
                                <MessageSquare className="size-3.5" />
                                Changes
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredList.length === 0 && (
              <Card>
                <CardContent className="py-16">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircle className="size-8 opacity-50" />
                    <p>No pending approvals</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="space-y-3">
            {completedApprovals.map((approval) => {
              const typeCfg = TYPE_CONFIG[approval.type];
              const statusCfg = STATUS_CONFIG[approval.status];
              const TypeIcon = typeCfg.icon;

              return (
                <Card key={approval.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-9 items-center justify-center rounded-lg ${typeCfg.color.split(' ').slice(1, 3).join(' ')}`}>
                        <TypeIcon className={`size-4 ${typeCfg.color.split(' ')[0]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{approval.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`gap-1 text-xs ${statusCfg.color}`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            by {approval.requestedBy} &middot; {format(parseISO(approval.requestedAt), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Approval by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4 text-emerald-600" />
                  Approvals by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const typeCounts: Record<string, number> = {};
                  approvals.forEach((a) => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
                  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
                  const max = Math.max(...sorted.map(([, c]) => c), 1);
                  return (
                    <div className="space-y-3">
                      {sorted.map(([type, count], i) => {
                        const cfg = TYPE_CONFIG[type as ApprovalType];
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className="text-xs font-medium w-28 shrink-0">{cfg.label}</span>
                            <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-emerald-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${(count / max) * 100}%` }}
                                transition={{ duration: 0.6, delay: i * 0.1 }}
                              />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-6">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Bottleneck Areas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Bottleneck Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const stepTimes: Record<string, { total: number; count: number }> = {};
                    approvals.forEach((a) => {
                      a.steps.forEach((s) => {
                        if (s.timestamp && s.status !== 'skipped') {
                          const key = `${s.role} (Level ${s.level})`;
                          const hours = differenceInHours(parseISO(s.timestamp), parseISO(a.requestedAt));
                          if (!stepTimes[key]) stepTimes[key] = { total: 0, count: 0 };
                          stepTimes[key].total += hours;
                          stepTimes[key].count += 1;
                        }
                      });
                    });
                    const sorted = Object.entries(stepTimes)
                      .map(([key, data]) => ({ key, avg: Math.round(data.total / data.count) }))
                      .sort((a, b) => b.avg - a.avg);

                    return sorted.map((item, i) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <span className="text-sm">{item.key}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${i === 0 ? 'bg-red-400' : i === 1 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${(item.avg / (sorted[0]?.avg || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{item.avg}h avg</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Delegation Rules */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="size-4 text-emerald-600" />
                  Auto-Delegation Rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  When an approver is unavailable, approvals can be automatically delegated.
                </p>
                <div className="space-y-3">
                  {[
                    { from: 'Priya Sharma (Manager)', to: 'Rajesh Kumar (Admin)', trigger: 'Away for 4+ hours', active: true },
                    { from: 'Rajesh Kumar (Admin)', to: 'Priya Sharma (Manager)', trigger: 'Out of office', active: true },
                    { from: 'Amit Patel (Staff)', to: 'Priya Sharma (Manager)', trigger: 'On leave', active: false },
                  ].map((rule) => (
                    <div key={rule.from} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-medium">{rule.from}</span>
                          <ArrowRight className="size-3.5 text-muted-foreground" />
                          <span>{rule.to}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{rule.trigger}</span>
                        <Badge variant="outline" className={rule.active ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-slate-400'}>
                          {rule.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' && <CheckCircle className="size-4 text-emerald-600" />}
              {actionType === 'reject' && <XCircle className="size-4 text-red-600" />}
              {actionType === 'request_changes' && <MessageSquare className="size-4 text-amber-600" />}
              {actionType === 'approve' ? 'Approve Request' : actionType === 'reject' ? 'Reject Request' : 'Request Changes'}
            </DialogTitle>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="font-medium text-sm">{selectedApproval.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Level {selectedApproval.currentLevel} of {selectedApproval.totalLevels} &middot; {TYPE_CONFIG[selectedApproval.type].label}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Comment</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    actionType === 'approve' ? 'Optional approval comment...' :
                    actionType === 'reject' ? 'Reason for rejection...' :
                    'Describe the changes needed...'
                  }
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button
              onClick={submitAction}
              className={
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                'bg-amber-600 hover:bg-amber-700'
              }
            >
              {actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
