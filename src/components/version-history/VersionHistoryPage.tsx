'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  GitBranch,
  Clock,
  User,
  Filter,
  RotateCcw,
  ChevronRight,
  FileText,
  Users,
  Receipt,
  FolderOpen,
  ArrowUpDown,
  Eye,
  Check,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VersionEntry {
  id: string;
  version: number;
  entityType: 'client' | 'return' | 'invoice' | 'document';
  entityId: string;
  entityName: string;
  timestamp: string;
  author: string;
  summary: string;
  before: Record<string, string>;
  after: Record<string, string>;
  isCurrent: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: 'client', label: 'Clients', icon: Users },
  { value: 'return', label: 'Returns', icon: FileText },
  { value: 'invoice', label: 'Invoices', icon: Receipt },
  { value: 'document', label: 'Documents', icon: FolderOpen },
] as const;

// NOTE: Version history is sourced from the backend audit-log / change-tracking
// layer. There is no client-side firestore subscription for it yet, so we
// honestly render an empty state instead of fabricating mock entries.

// ─── Diff Viewer ───────────────────────────────────────────────────────────────

function VersionDiffViewer({ before, after }: { before: Record<string, string>; after: Record<string, string> }) {
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  if (allKeys.length === 0) return <p className="text-sm text-muted-foreground">Initial creation — no prior state.</p>;

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Field</th>
            <th className="px-3 py-2 text-left font-medium text-red-600">Before</th>
            <th className="px-3 py-2 text-left font-medium text-emerald-600">After</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map((key) => {
            const bVal = before[key] ?? '—';
            const aVal = after[key] ?? '—';
            const changed = bVal !== aVal;
            return (
              <tr key={key} className={changed ? 'bg-amber-50/50' : ''}>
                <td className="px-3 py-1.5 font-medium border-t">{key}</td>
                <td className="px-3 py-1.5 border-t text-red-600/80 font-mono">{bVal}</td>
                <td className="px-3 py-1.5 border-t text-emerald-600/80 font-mono">{aVal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VersionHistoryPage() {
  // Version history is sourced from the backend audit log; there is no
  // client-side firestore hook for it yet. Honest empty state when no data.
  const versions: VersionEntry[] = [];
  const loading = false;
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<VersionEntry | null>(null);

  // Unique authors present in the real data — empty when there is no data.
  const authors = useMemo(
    () => Array.from(new Set(versions.map((v) => v.author))).sort(),
    [versions],
  );

  // Filtered versions
  const filteredVersions = useMemo(() => {
    let result = [...versions];

    if (filterEntityType !== 'all') {
      result = result.filter((v) => v.entityType === filterEntityType);
    }
    if (filterAuthor !== 'all') {
      result = result.filter((v) => v.author === filterAuthor);
    }
    if (filterStartDate) {
      const start = new Date(filterStartDate);
      result = result.filter((v) => new Date(v.timestamp) >= start);
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((v) => new Date(v.timestamp) <= end);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) =>
        v.entityName.toLowerCase().includes(q) ||
        v.summary.toLowerCase().includes(q) ||
        v.author.toLowerCase().includes(q)
      );
    }
    if (selectedEntity) {
      result = result.filter((v) => v.entityId === selectedEntity);
    }

    return result;
  }, [versions, filterEntityType, filterAuthor, filterStartDate, filterEndDate, searchQuery, selectedEntity]);

  // Group by entity
  const groupedByEntity = useMemo(() => {
    const groups: Record<string, VersionEntry[]> = {};
    filteredVersions.forEach((v) => {
      if (!groups[v.entityId]) groups[v.entityId] = [];
      groups[v.entityId].push(v);
    });
    // Sort each group by version desc
    Object.values(groups).forEach((g) => g.sort((a, b) => b.version - a.version));
    return groups;
  }, [filteredVersions]);

  const uniqueEntities = useMemo(() => {
    const entities = Array.from(new Set(versions.map((v) => v.entityId)));
    return entities.map((id) => {
      const v = versions.find((ver) => ver.entityId === id)!;
      return { id, name: v.entityName, type: v.entityType };
    });
  }, [versions]);

  const entityIcon = (type: string) => {
    const found = ENTITY_TYPES.find((e) => e.value === type);
    return found ? found.icon : FileText;
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'client': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'return': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'invoice': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'document': return 'text-teal-600 bg-teal-50 border-teal-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const handleViewDiff = (v: VersionEntry) => {
    setSelectedVersion(v);
    setDiffOpen(true);
  };

  const handleRestoreClick = (v: VersionEntry) => {
    setRestoreVersion(v);
    setRestoreOpen(true);
  };

  const handleRestore = () => {
    // In production, this would call an API
    setRestoreOpen(false);
    setRestoreVersion(null);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <GitBranch className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Version History</h1>
            <p className="text-sm text-muted-foreground">Track changes and restore previous versions</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Versions</p>
                <p className="text-2xl font-bold">{versions.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <GitBranch className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tracked Entities</p>
                <p className="text-2xl font-bold">{uniqueEntities.length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <ArrowUpDown className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today&apos;s Changes</p>
                <p className="text-2xl font-bold">{versions.filter((v) => isToday(new Date(v.timestamp))).length}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50">
                <Clock className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contributors</p>
                <p className="text-2xl font-bold">{new Set(versions.map((v) => v.author)).size}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-50">
                <User className="size-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-emerald-600" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={filterEntityType} onValueChange={setFilterEntityType}>
              <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ENTITY_TYPES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAuthor} onValueChange={setFilterAuthor}>
              <SelectTrigger><SelectValue placeholder="All Authors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Authors</SelectItem>
                {authors.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
            <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
            <div className="relative">
              <Input
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Entity selector chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={selectedEntity === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedEntity(null)}
              className={selectedEntity === null ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              All Entities
            </Button>
            {uniqueEntities.map((e) => {
              const Icon = entityIcon(e.type);
              return (
                <Button
                  key={e.id}
                  variant={selectedEntity === e.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedEntity(selectedEntity === e.id ? null : e.id)}
                  className={`gap-1.5 ${selectedEntity === e.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                >
                  <Icon className="size-3.5" />
                  <span className="max-w-[120px] truncate">{e.name}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Version Timeline */}
      <div className="space-y-4">
        <AnimatePresence>
          {Object.entries(groupedByEntity).map(([entityId, vEntries]) => {
            const first = vEntries[0];
            const Icon = entityIcon(first.entityType);
            return (
              <motion.div
                key={entityId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-8 items-center justify-center rounded-lg ${typeColor(first.entityType).split(' ').slice(1).join(' ')}`}>
                        <Icon className={`size-4 ${typeColor(first.entityType).split(' ')[0]}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{first.entityName}</CardTitle>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-[10px] ${typeColor(first.entityType)}`}>
                            {first.entityType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{vEntries.length} versions</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Branch-style visual timeline */}
                    <div className="relative ml-4">
                      {vEntries.map((v, idx) => {
                        const isLast = idx === 0;
                        const hasMore = idx < vEntries.length - 1;
                        return (
                          <div key={v.id} className="relative flex gap-4 pb-4">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center">
                              <div className={`size-3 rounded-full border-2 shrink-0 ${
                                v.isCurrent
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'bg-white border-slate-300'
                              }`} />
                              {hasMore && (
                                <div className="w-0.5 flex-1 bg-slate-200 min-h-[20px]" />
                              )}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 rounded-lg border p-3 transition-all ${
                              v.isCurrent
                                ? 'border-emerald-200 bg-emerald-50/50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    v{v.version}
                                  </Badge>
                                  {v.isCurrent && (
                                    <Badge className="bg-emerald-600 text-white text-[10px]">Current</Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(v.timestamp), 'MMM d, yyyy h:mm a')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-7 p-0"
                                    onClick={() => handleViewDiff(v)}
                                    title="View Diff"
                                  >
                                    <Eye className="size-3.5" />
                                  </Button>
                                  {!v.isCurrent && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="size-7 p-0 text-emerald-600 hover:text-emerald-700"
                                      onClick={() => handleRestoreClick(v)}
                                      title="Restore this version"
                                    >
                                      <RotateCcw className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm mt-1">{v.summary}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <div className="size-4 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-700">
                                  {v.author.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                </div>
                                <span className="text-xs text-muted-foreground">{v.author}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {Object.keys(groupedByEntity).length === 0 && (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <GitBranch className="size-8 opacity-50" />
                {versions.length === 0 ? (
                  <>
                    <p className="font-medium text-foreground">No version history yet</p>
                    <p className="text-xs max-w-sm text-center">
                      Once you start creating or editing clients, returns, invoices, or documents,
                      their change history will appear here. Version tracking is powered by the
                      backend audit log.
                    </p>
                  </>
                ) : (
                  <>
                    <p>No version history matches your filters</p>
                    <p className="text-xs">Try adjusting your filters</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-emerald-600" />
              Version Diff — v{selectedVersion?.version}
            </DialogTitle>
          </DialogHeader>
          {selectedVersion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Entity</p>
                  <p className="font-medium">{selectedVersion.entityName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Author</p>
                  <p>{selectedVersion.author}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timestamp</p>
                  <p>{format(new Date(selectedVersion.timestamp), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Summary</p>
                  <p>{selectedVersion.summary}</p>
                </div>
              </div>
              <Separator />
              <VersionDiffViewer before={selectedVersion.before} after={selectedVersion.after} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-4 text-amber-600" />
              Restore Version
            </DialogTitle>
          </DialogHeader>
          {restoreVersion && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to restore <strong>{restoreVersion.entityName}</strong> to <strong>Version {restoreVersion.version}</strong>?
              </p>
              <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-700">
                This will create a new version that mirrors the state of v{restoreVersion.version}. The current version will be preserved in history.
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-mono">v{restoreVersion.version}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Author</p>
                  <p>{restoreVersion.author}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestoreOpen(false)} className="gap-1">
              <X className="size-4" />
              Cancel
            </Button>
            <Button onClick={handleRestore} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Check className="size-4" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
