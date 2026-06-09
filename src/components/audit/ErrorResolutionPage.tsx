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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  UserPlus,
  MessageSquare,
  Search,
  Filter,
} from 'lucide-react';
import type { Issue, IssueSeverity } from '@/types/gst';
import { ISSUE_SEVERITY_CONFIG } from '@/types/gst';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientOption {
  id: string;
  tradeName: string;
}

interface NoteEntry {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

// ─── Team members for assignment ──────────────────────────────────────────────
const TEAM_MEMBERS = ['Rajesh', 'Priya', 'Amit'];

// ─── Issue categories ────────────────────────────────────────────────────────
const ISSUE_CATEGORIES = [
  'GSTIN Mismatch',
  'Tax Mismatch',
  'Duplicate Invoice',
  'Missing Invoice',
  'Invalid GSTIN',
  'Filing Delay',
  'Amount Mismatch',
  'Date Mismatch',
  'Other',
];

// ─── Status badge config ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  Issue['status'],
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  open: {
    label: 'Open',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  ignored: {
    label: 'Ignored',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
};

// ─── Skeletons ────────────────────────────────────────────────────────────────
function BucketSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
            <div className="h-3 w-36 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-5 w-16 bg-muted animate-pulse rounded" />
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
              <div className="h-5 w-48 bg-muted animate-pulse rounded flex-1" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ErrorResolutionPage() {
  const { selectedClientId, setSelectedClientId } = useApp();

  // Data state
  const [issues, setIssues] = useState<Issue[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail dialog state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Resolution workflow state
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [ignoreReason, setIgnoreReason] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Fetch issues ────────────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterClient !== 'all') params.set('clientId', filterClient);
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCategory !== 'all') params.set('category', filterCategory);

      const res = await fetch(`/api/errors?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch issues');
      const data = await res.json();
      setIssues(data.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filterClient, filterSeverity, filterStatus, filterCategory]);

  // ─── Fetch clients for filter dropdown ───────────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) return;
      const data = await res.json();
      setClients(
        (data.clients ?? []).map((c: { id: string; tradeName: string }) => ({
          id: c.id,
          tradeName: c.tradeName,
        }))
      );
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Sync with global client selection
  useEffect(() => {
    if (selectedClientId) {
      setFilterClient(selectedClientId);
    }
  }, [selectedClientId]);

  // ─── Computed values ─────────────────────────────────────────────────────
  const criticalCount = issues.filter(
    (i) => i.severity === 'critical' && i.status === 'open'
  ).length;
  const warningCount = issues.filter(
    (i) => i.severity === 'warning' && i.status === 'open'
  ).length;
  const infoCount = issues.filter(
    (i) => i.severity === 'info' && i.status === 'open'
  ).length;

  // Search filter
  const filteredIssues = issues.filter((issue) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      issue.title.toLowerCase().includes(q) ||
      issue.category.toLowerCase().includes(q) ||
      (issue.client?.tradeName ?? '').toLowerCase().includes(q) ||
      (issue.invoice?.invoiceNumber ?? '').toLowerCase().includes(q) ||
      (issue.assignedTo ?? '').toLowerCase().includes(q)
    );
  });

  // ─── Parse notes history ─────────────────────────────────────────────────
  function parseNotes(notes?: string | null): NoteEntry[] {
    if (!notes) return [];
    try {
      const parsed = JSON.parse(notes);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // treat as single note
      return [
        {
          id: '1',
          author: 'System',
          text: notes,
          timestamp: new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  // ─── Action handlers ─────────────────────────────────────────────────────
  async function handleResolve() {
    if (!selectedIssue) return;
    setActionLoading(true);
    try {
      const existingNotes = parseNotes(selectedIssue.notes);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        author: 'You',
        text: resolutionNotes || 'Issue resolved.',
        timestamp: new Date().toISOString(),
      };
      const updatedNotes = JSON.stringify([...existingNotes, newNote]);

      const res = await fetch('/api/errors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedIssue.id,
          status: 'resolved',
          notes: updatedNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to resolve issue');
      await fetchIssues();
      setDetailOpen(false);
      setResolutionNotes('');
      setSelectedIssue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleIgnore() {
    if (!selectedIssue) return;
    setActionLoading(true);
    try {
      const existingNotes = parseNotes(selectedIssue.notes);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        author: 'You',
        text: `Ignored: ${ignoreReason || 'No reason provided'}`,
        timestamp: new Date().toISOString(),
      };
      const updatedNotes = JSON.stringify([...existingNotes, newNote]);

      const res = await fetch('/api/errors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedIssue.id,
          status: 'ignored',
          notes: updatedNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to ignore issue');
      await fetchIssues();
      setDetailOpen(false);
      setIgnoreReason('');
      setSelectedIssue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ignore');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssign() {
    if (!selectedIssue || !assignTo) return;
    setActionLoading(true);
    try {
      const existingNotes = parseNotes(selectedIssue.notes);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        author: 'You',
        text: `Assigned to ${assignTo}`,
        timestamp: new Date().toISOString(),
      };
      const updatedNotes = JSON.stringify([...existingNotes, newNote]);

      const res = await fetch('/api/errors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedIssue.id,
          assignedTo: assignTo,
          notes: updatedNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to assign issue');
      await fetchIssues();
      setSelectedIssue((prev) =>
        prev ? { ...prev, assignedTo: assignTo } : null
      );
      setAssignTo('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleQuickAction(
    issue: Issue,
    action: 'resolve' | 'ignore'
  ) {
    try {
      const existingNotes = parseNotes(issue.notes);
      const newNote: NoteEntry = {
        id: Date.now().toString(),
        author: 'You',
        text:
          action === 'resolve'
            ? 'Issue resolved via quick action.'
            : 'Ignored via quick action.',
        timestamp: new Date().toISOString(),
      };
      const updatedNotes = JSON.stringify([...existingNotes, newNote]);

      const res = await fetch('/api/errors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: issue.id,
          status: action === 'resolve' ? 'resolved' : 'ignored',
          notes: updatedNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to update issue');
      await fetchIssues();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function openDetail(issue: Issue) {
    setSelectedIssue(issue);
    setResolutionNotes('');
    setIgnoreReason('');
    setAssignTo('');
    setDetailOpen(true);
  }

  // ─── Severity icon ───────────────────────────────────────────────────────
  function SeverityIcon({ severity }: { severity: IssueSeverity }) {
    const config = ISSUE_SEVERITY_CONFIG[severity];
    switch (severity) {
      case 'critical':
        return <ShieldAlert className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-sky-600" />;
    }
  }

  // ─── Format date ─────────────────────────────────────────────────────────
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Smart Error Resolution Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Identify, track, and resolve GST compliance issues
          </p>
        </div>
      </div>

      {/* ===== Issue Buckets ===== */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BucketSkeleton />
          <BucketSkeleton />
          <BucketSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Critical Issues */}
          <Card className="hover:shadow-md transition-shadow border-red-200 bg-red-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-red-100">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Critical Issues
                  </p>
                  <p className="text-3xl font-bold text-red-700">
                    {criticalCount}
                  </p>
                  <p className="text-xs text-red-600/70">
                    Requires immediate attention
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          <Card className="hover:shadow-md transition-shadow border-amber-200 bg-amber-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-100">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700">
                    Warnings
                  </p>
                  <p className="text-3xl font-bold text-amber-700">
                    {warningCount}
                  </p>
                  <p className="text-xs text-amber-600/70">
                    Should be reviewed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="hover:shadow-md transition-shadow border-sky-200 bg-sky-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-sky-100">
                  <Info className="h-6 w-6 text-sky-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-sky-700">
                    Info
                  </p>
                  <p className="text-3xl font-bold text-sky-700">
                    {infoCount}
                  </p>
                  <p className="text-xs text-sky-600/70">
                    For your awareness
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== Action Bar / Filters ===== */}
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="font-medium">Filters:</span>
            </div>

            {/* Client filter */}
            <Select
              value={filterClient}
              onValueChange={(val) => {
                setFilterClient(val);
                setSelectedClientId(val === 'all' ? null : val);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity filter */}
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>

            {/* Category filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ISSUE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Issues Table ===== */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Issues ({filteredIssues.length})
            </CardTitle>
            <CardDescription>
              Manage and resolve GST compliance issues
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="w-[140px]">Category</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[140px]">Client</TableHead>
                    <TableHead className="w-[110px]">Invoice #</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[110px]">Assigned To</TableHead>
                    <TableHead className="w-[100px]">Created</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-12 text-muted-foreground"
                      >
                        No issues found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIssues.map((issue) => {
                      const severityConfig =
                        ISSUE_SEVERITY_CONFIG[issue.severity];
                      const statusConfig = STATUS_CONFIG[issue.status];
                      return (
                        <TableRow key={issue.id} className="group">
                          {/* Severity */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`gap-1 ${severityConfig.bgColor} ${severityConfig.color} ${severityConfig.borderColor}`}
                            >
                              <SeverityIcon severity={issue.severity} />
                              {severityConfig.label}
                            </Badge>
                          </TableCell>

                          {/* Category */}
                          <TableCell className="text-sm">
                            {issue.category}
                          </TableCell>

                          {/* Title */}
                          <TableCell className="font-medium text-sm max-w-[250px] truncate">
                            {issue.title}
                          </TableCell>

                          {/* Client */}
                          <TableCell className="text-sm text-muted-foreground">
                            {issue.client?.tradeName ?? '—'}
                          </TableCell>

                          {/* Invoice # */}
                          <TableCell className="text-sm text-muted-foreground">
                            {issue.invoice?.invoiceNumber ?? '—'}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
                            >
                              {statusConfig.label}
                            </Badge>
                          </TableCell>

                          {/* Assigned To */}
                          <TableCell className="text-sm">
                            {issue.assignedTo ?? (
                              <span className="text-muted-foreground italic">
                                Unassigned
                              </span>
                            )}
                          </TableCell>

                          {/* Created */}
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(issue.createdAt)}
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {issue.status === 'open' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() =>
                                      handleQuickAction(issue, 'resolve')
                                    }
                                    title="Resolve"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                    onClick={() =>
                                      handleQuickAction(issue, 'ignore')
                                    }
                                    title="Ignore"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => openDetail(issue)}
                                title="View Details"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => openDetail(issue)}
                                title="View Details"
                              >
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Issue Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SeverityIcon severity={selectedIssue.severity} />
                  <span>{selectedIssue.title}</span>
                </DialogTitle>
                <DialogDescription>
                  Issue details and resolution workflow
                </DialogDescription>
              </DialogHeader>

              {/* Issue meta */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Severity
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${
                        ISSUE_SEVERITY_CONFIG[selectedIssue.severity].bgColor
                      } ${
                        ISSUE_SEVERITY_CONFIG[selectedIssue.severity].color
                      } ${
                        ISSUE_SEVERITY_CONFIG[selectedIssue.severity]
                          .borderColor
                      }`}
                    >
                      {ISSUE_SEVERITY_CONFIG[selectedIssue.severity].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Status
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${
                        STATUS_CONFIG[selectedIssue.status].bgColor
                      } ${STATUS_CONFIG[selectedIssue.status].color} ${
                        STATUS_CONFIG[selectedIssue.status].borderColor
                      }`}
                    >
                      {STATUS_CONFIG[selectedIssue.status].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Category
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {selectedIssue.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Client
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {selectedIssue.client?.tradeName ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Assigned To
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {selectedIssue.assignedTo ?? 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Created
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {formatDate(selectedIssue.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedIssue.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                        Description
                      </p>
                      <p className="text-sm leading-relaxed">
                        {selectedIssue.description}
                      </p>
                    </div>
                  </>
                )}

                {/* Related Invoice Info */}
                {selectedIssue.invoice && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                        Related Invoice
                      </p>
                      <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50 border">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Invoice #
                          </p>
                          <p className="text-sm font-medium">
                            {selectedIssue.invoice.invoiceNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="text-sm font-medium">
                            {formatDate(selectedIssue.invoice.invoiceDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Amount
                          </p>
                          <p className="text-sm font-medium">
                            {formatCurrency(
                              selectedIssue.invoice.totalAmount
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Notes History */}
                {parseNotes(selectedIssue.notes).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                        Notes History
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {parseNotes(selectedIssue.notes).map((note) => (
                          <div
                            key={note.id}
                            className="flex gap-3 p-2 rounded-lg bg-muted/30 border border-border/50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">
                                  {note.author}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(note.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5">{note.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Action section */}
                {selectedIssue.status === 'open' ? (
                  <div className="space-y-4">
                    {/* Resolve section */}
                    <div>
                      <p className="text-sm font-medium text-emerald-700 mb-2">
                        Resolve Issue
                      </p>
                      <Textarea
                        placeholder="Add resolution notes..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="min-h-[80px] mb-2"
                      />
                      <Button
                        onClick={handleResolve}
                        disabled={actionLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {actionLoading ? 'Resolving...' : 'Resolve'}
                      </Button>
                    </div>

                    {/* Ignore section */}
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        Ignore Issue
                      </p>
                      <Textarea
                        placeholder="Reason for ignoring..."
                        value={ignoreReason}
                        onChange={(e) => setIgnoreReason(e.target.value)}
                        className="min-h-[60px] mb-2"
                      />
                      <Button
                        variant="outline"
                        onClick={handleIgnore}
                        disabled={actionLoading}
                        className="border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        <X className="h-4 w-4 mr-1" />
                        {actionLoading ? 'Ignoring...' : 'Ignore'}
                      </Button>
                    </div>

                    {/* Assign section */}
                    <div>
                      <p className="text-sm font-medium text-amber-700 mb-2">
                        Assign To
                      </p>
                      <div className="flex items-center gap-2">
                        <Select value={assignTo} onValueChange={setAssignTo}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select team member" />
                          </SelectTrigger>
                          <SelectContent>
                            {TEAM_MEMBERS.map((member) => (
                              <SelectItem key={member} value={member}>
                                {member}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={handleAssign}
                          disabled={actionLoading || !assignTo}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm text-emerald-700 font-medium">
                      This issue has been{' '}
                      {selectedIssue.status === 'resolved'
                        ? 'resolved'
                        : 'ignored'}
                      {selectedIssue.resolvedAt &&
                        ` on ${formatDate(selectedIssue.resolvedAt)}`}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDetailOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
