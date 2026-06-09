'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ScrollText,
  Search,
  Filter,
  Clock,
  Activity,
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  Trash2,
  User,
} from 'lucide-react';
import { format, isToday, subDays } from 'date-fns';
import { AuditLogEntry } from '@/types/gst';
import { formatNumber, periodToLabel } from '@/lib/gst-utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  'GSTR Generated',
  'GSTR Downloaded',
  'Return Filed',
  'Return Reviewed',
  'Invoice Approved',
  'Reconciliation Completed',
  'Client Created',
  'Invoice Created',
] as const;

const ENTITY_OPTIONS = ['client', 'invoice', 'filing', 'reconciliation', 'health_score'] as const;

const ACTION_COLOR_MAP: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  Created: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: <Plus className="size-3.5" /> },
  Updated: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: <RefreshCw className="size-3.5" /> },
  Deleted: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: <Trash2 className="size-3.5" /> },
  Filed: { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: <CheckCircle2 className="size-3.5" /> },
  Generated: { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: <FileText className="size-3.5" /> },
  Downloaded: { color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: <Download className="size-3.5" /> },
  Approved: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="size-3.5" /> },
  Completed: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="size-3.5" /> },
  Reviewed: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: <Eye className="size-3.5" /> },
  Exported: { color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: <Download className="size-3.5" /> },
  Imported: { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: <FileText className="size-3.5" /> },
};

const FILING_ACTIONS = ['GSTR Generated', 'GSTR Downloaded', 'Return Filed', 'Return Reviewed'];

const PAGE_SIZE = 20;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getActionCategory(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('creat')) return 'Created';
  if (lower.includes('updat')) return 'Updated';
  if (lower.includes('delet')) return 'Deleted';
  if (lower.includes('filed') || lower.includes('file ')) return 'Filed';
  if (lower.includes('generat')) return 'Generated';
  if (lower.includes('download')) return 'Downloaded';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('complet')) return 'Completed';
  if (lower.includes('review')) return 'Reviewed';
  if (lower.includes('export')) return 'Exported';
  if (lower.includes('import')) return 'Imported';
  return 'Updated';
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return format(date, 'MMM d, yyyy h:mm a');
  } catch {
    return ts;
  }
}

function formatTimestampShort(ts: string): string {
  try {
    const date = new Date(ts);
    if (isToday(date)) return format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  } catch {
    return ts;
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', PAGE_SIZE.toString());
      params.set('offset', ((currentPage - 1) * PAGE_SIZE).toString());

      if (filterClient !== 'all') params.set('clientId', filterClient);
      if (filterAction !== 'all') params.set('action', filterAction);
      if (filterEntity !== 'all') params.set('entity', filterEntity);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? data ?? []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterClient, filterAction, filterEntity]);

  // Fetch clients separately
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          const clientList = (data.clients ?? data ?? []).map((c: { id: string; tradeName: string; gstin: string }) => ({
            id: c.id,
            tradeName: c.tradeName,
            gstin: c.gstin,
          }));
          setClients(clientList);
        }
      } catch {
        // Silently handle
      }
    }
    fetchClients();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const totalEvents = pagination.total;
  const todayEvents = logs.filter((l) => isToday(new Date(l.timestamp))).length;
  const filingEvents = logs.filter((l) =>
    FILING_ACTIONS.some((fa) => l.action?.toLowerCase().includes(fa.toLowerCase().split(' ')[0].toLowerCase()))
  ).length;
  const lastActivity = logs.length > 0 ? logs[0].timestamp : null;

  // Apply client-side search filter
  const displayLogs = searchQuery
    ? logs.filter((l) => l.details?.toLowerCase().includes(searchQuery.toLowerCase()))
    : logs;

  // Apply date range filter client-side
  const filteredLogs = displayLogs.filter((l) => {
    if (filterStartDate) {
      const logDate = new Date(l.timestamp);
      const start = new Date(filterStartDate);
      if (logDate < start) return false;
    }
    if (filterEndDate) {
      const logDate = new Date(l.timestamp);
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      if (logDate > end) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(pagination.total / PAGE_SIZE));

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleClearFilters = () => {
    setFilterClient('all');
    setFilterAction('all');
    setFilterEntity('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  // ─── Loading Skeleton ────────────────────────────────────────────────────
  if (loading && logs.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <ScrollText className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">
              Track all activities and changes across the system
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Summary Cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Events */}
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{formatNumber(totalEvents)}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <Activity className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Events */}
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Events</p>
                <p className="text-2xl font-bold">{todayEvents}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <Clock className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filing Events */}
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Filing Events</p>
                <p className="text-2xl font-bold">{filingEvents}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50">
                <FileText className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Activity */}
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Activity</p>
                <p className="text-lg font-bold">
                  {lastActivity ? formatTimestampShort(lastActivity) : '—'}
                </p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <Clock className="size-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Filter Bar
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-emerald-600" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Client Filter */}
            <Select value={filterClient} onValueChange={(v) => { setFilterClient(v); setCurrentPage(1); }}>
              <SelectTrigger>
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

            {/* Action Filter */}
            <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity Filter */}
            <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {ENTITY_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e.charAt(0).toUpperCase() + e.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="gap-2 w-full"
              >
                <Filter className="size-3.5" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          Audit Log Table
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4 text-emerald-600" />
            Activity Log
            <Badge variant="secondary" className="ml-2">
              {formatNumber(pagination.total)} entries
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border" style={{ minWidth: '900px' }}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap">Action</TableHead>
                  <TableHead className="whitespace-nowrap">Entity</TableHead>
                  <TableHead className="whitespace-nowrap">Entity ID</TableHead>
                  <TableHead className="whitespace-nowrap">Client</TableHead>
                  <TableHead className="whitespace-nowrap">User</TableHead>
                  <TableHead className="whitespace-nowrap">Details</TableHead>
                  <TableHead className="whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <ScrollText className="size-8 text-muted-foreground/50" />
                        <p>No audit logs found matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const category = getActionCategory(log.action);
                    const colorConfig = ACTION_COLOR_MAP[category] ?? ACTION_COLOR_MAP['Updated'];
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`gap-1 ${colorConfig.color} ${colorConfig.bgColor} text-xs`}
                          >
                            {colorConfig.icon}
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {log.entity ? (
                            <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                              {log.entity}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                          {log.entityId ? log.entityId.slice(0, 8) + '...' : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {log.client?.tradeName ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1.5">
                            <User className="size-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{log.userId ?? 'System'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                          {log.details ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0"
                            onClick={() => handleViewDetail(log)}
                            title="View Details"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} &middot; {formatNumber(pagination.total)} total entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="gap-1"
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="gap-1"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          Log Detail Dialog
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-emerald-600" />
              Log Entry Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Action & Entity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Action</p>
                  <Badge
                    variant="outline"
                    className={`gap-1 ${ACTION_COLOR_MAP[getActionCategory(selectedLog.action)]?.color ?? ''} ${ACTION_COLOR_MAP[getActionCategory(selectedLog.action)]?.bgColor ?? ''}`}
                  >
                    {selectedLog.action}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Entity</p>
                  <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                    {selectedLog.entity ?? '—'}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Log ID</p>
                  <p className="font-mono text-xs">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity ID</p>
                  <p className="font-mono text-xs">{selectedLog.entityId ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p>{selectedLog.client?.tradeName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">User</p>
                  <p>{selectedLog.userId ?? 'System'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Timestamp</p>
                  <p>{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
              </div>

              {/* Details / JSON */}
              {selectedLog.details && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Details</p>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <pre className="max-h-48 overflow-auto text-xs whitespace-pre-wrap break-words">
                        {(() => {
                          try {
                            const parsed = JSON.parse(selectedLog.details);
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return selectedLog.details;
                          }
                        })()}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
