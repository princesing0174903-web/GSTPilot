'use client';

import React, { useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileText,
  FileScan,
  FileCheck,
  GitCompare,
  CheckCircle,
  User,
  Zap,
  Activity,
  Clock,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import {
  useFireActivities,
  useFireRecentActivities,
} from '@/hooks/use-firestore';
import type {
  FirestoreActivity,
  ActivityType,
} from '@/lib/firestore-schema';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY TYPE CONFIG — icon + color mapping
// ═══════════════════════════════════════════════════════════════════════════════

interface ActivityConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

const ACTIVITY_CONFIG: Record<string, ActivityConfig> = {
  client_created:   { icon: Users,     color: 'text-emerald-600',  bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-200' },
  client_updated:   { icon: Users,     color: 'text-emerald-600',  bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-200' },
  client_deleted:   { icon: Users,     color: 'text-emerald-600',  bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-200' },
  document_uploaded: { icon: FileText, color: 'text-blue-600',     bgColor: 'bg-blue-50',     borderColor: 'border-blue-200' },
  document_processed: { icon: FileText, color: 'text-blue-600',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-200' },
  document_failed:  { icon: FileText,  color: 'text-blue-600',     bgColor: 'bg-blue-50',     borderColor: 'border-blue-200' },
  invoice_extracted: { icon: FileScan,  color: 'text-amber-600',   bgColor: 'bg-amber-50',    borderColor: 'border-amber-200' },
  invoice_approved: { icon: FileScan,  color: 'text-amber-600',    bgColor: 'bg-amber-50',    borderColor: 'border-amber-200' },
  invoice_corrected: { icon: FileScan, color: 'text-amber-600',    bgColor: 'bg-amber-50',    borderColor: 'border-amber-200' },
  return_prepared:  { icon: FileCheck, color: 'text-purple-600',   bgColor: 'bg-purple-50',   borderColor: 'border-purple-200' },
  return_reviewed:  { icon: FileCheck, color: 'text-purple-600',   bgColor: 'bg-purple-50',   borderColor: 'border-purple-200' },
  return_filed:     { icon: FileCheck, color: 'text-purple-600',   bgColor: 'bg-purple-50',   borderColor: 'border-purple-200' },
  return_reopened:  { icon: FileCheck, color: 'text-purple-600',   bgColor: 'bg-purple-50',   borderColor: 'border-purple-200' },
  reconciliation_run: { icon: GitCompare, color: 'text-cyan-600',  bgColor: 'bg-cyan-50',     borderColor: 'border-cyan-200' },
  mismatch_resolved: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50',    borderColor: 'border-green-200' },
  user_login:       { icon: User,      color: 'text-slate-600',    bgColor: 'bg-slate-50',    borderColor: 'border-slate-200' },
  user_signup:      { icon: User,      color: 'text-slate-600',    bgColor: 'bg-slate-50',    borderColor: 'border-slate-200' },
  system:           { icon: Zap,       color: 'text-gray-600',     bgColor: 'bg-gray-50',     borderColor: 'border-gray-200' },
};

const DEFAULT_CONFIG: ActivityConfig = {
  icon: Activity,
  color: 'text-slate-600',
  bgColor: 'bg-slate-50',
  borderColor: 'border-slate-200',
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

type FilterCategory = 'all' | 'clients' | 'documents' | 'invoices' | 'returns' | 'reconciliation';

const FILTER_OPTIONS: { key: FilterCategory; label: string }[] = [
  { key: 'all',           label: 'All' },
  { key: 'clients',       label: 'Clients' },
  { key: 'documents',     label: 'Documents' },
  { key: 'invoices',      label: 'Invoices' },
  { key: 'returns',       label: 'Returns' },
  { key: 'reconciliation', label: 'Reconciliation' },
];

const FILTER_MAP: Record<FilterCategory, ActivityType[]> = {
  all: [],
  clients: ['client_created', 'client_updated', 'client_deleted'],
  documents: ['document_uploaded', 'document_processed', 'document_failed'],
  invoices: ['invoice_extracted', 'invoice_approved', 'invoice_corrected'],
  returns: ['return_prepared', 'return_reviewed', 'return_filed', 'return_reopened'],
  reconciliation: ['reconciliation_run', 'mismatch_resolved'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatTimestamp(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

function groupByDate(activities: Array<FirestoreActivity & { id: string }>) {
  const groups: Record<string, Array<FirestoreActivity & { id: string }>> = {};

  for (const act of activities) {
    let label: string;
    try {
      const date = new Date(act.createdAt as string);
      if (isToday(date)) {
        label = 'Today';
      } else if (isYesterday(date)) {
        label = 'Yesterday';
      } else {
        label = format(date, 'dd MMM yyyy');
      }
    } catch {
      label = 'Unknown';
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(act);
  }

  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-start">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════════════════════

function ActivityItem({
  activity,
  index,
}: {
  activity: FirestoreActivity & { id: string };
  index: number;
}) {
  const config = ACTIVITY_CONFIG[activity.type] ?? DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      className="flex gap-3 items-start group"
    >
      {/* Timeline connector + icon */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`h-10 w-10 rounded-full border-2 flex items-center justify-center ${config.bgColor} ${config.borderColor} transition-shadow group-hover:shadow-md`}
        >
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div className="w-px h-full min-h-[24px] bg-border mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">
              {activity.title}
            </p>
            {activity.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {activity.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${config.color} border-current/20`}
            >
              {activity.type.replace(/_/g, ' ')}
            </Badge>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {activity.createdAt ? formatTimestamp(activity.createdAt as string) : ''}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function TimelineEmptyState({ filter }: { filter: FilterCategory }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
        <Activity className="h-7 w-7 text-slate-300" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">No activities yet</h3>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
        {filter === 'all'
          ? 'Activities will appear here as you and your team work on clients, documents, invoices, and returns.'
          : `No ${FILTER_OPTIONS.find(f => f.key === filter)?.label.toLowerCase()} activities found. Try a different filter.`}
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TimelinePage() {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  // Fetch all activities (real-time via onSnapshot)
  const { data: activities, loading } = useFireActivities();

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (activeFilter === 'all') return activities;
    const allowedTypes = FILTER_MAP[activeFilter];
    return activities.filter((a) =>
      allowedTypes.includes(a.type as ActivityType)
    );
  }, [activities, activeFilter]);

  // Group by date
  const groupedActivities = useMemo(
    () => groupByDate(filteredActivities),
    [filteredActivities]
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Activity Timeline
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time feed of all firm activities across clients, documents, and returns.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              Live
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* ── Filter Buttons ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.key}
            size="sm"
            variant={activeFilter === opt.key ? 'default' : 'outline'}
            className={
              activeFilter === opt.key
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : ''
            }
            onClick={() => setActiveFilter(opt.key)}
          >
            {opt.label}
            {opt.key !== 'all' && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {activities.filter((a) =>
                  FILTER_MAP[opt.key].includes(a.type as ActivityType)
                ).length}
              </span>
            )}
            {opt.key === 'all' && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {activities.length}
              </span>
            )}
          </Button>
        ))}
      </motion.div>

      {/* ── Timeline Content ── */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <TimelineSkeleton />
          ) : filteredActivities.length === 0 ? (
            <TimelineEmptyState filter={activeFilter} />
          ) : (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFilter}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  {Object.entries(groupedActivities).map(([dateLabel, items]) => (
                    <div key={dateLabel} className="mb-6">
                      {/* Date separator */}
                      <div className="flex items-center gap-3 mb-3">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium"
                        >
                          {dateLabel}
                        </Badge>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {/* Activities in this group */}
                      <div>
                        {items.map((activity, idx) => (
                          <ActivityItem
                            key={activity.id}
                            activity={activity}
                            index={idx}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
