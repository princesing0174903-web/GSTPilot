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
  BookOpen,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  Bell,
  Scale,
  Landmark,
  AlertCircle,
  Tag,
  Calendar,
  BarChart3,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/gst-utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { Inbox } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────
type KnowledgeCategory = 'gst_rule' | 'circular' | 'notification' | 'case_law' | 'department_update';

interface KnowledgeEntry {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  summary: string;
  referenceNumber?: string;
  effectiveDate?: string;
  tags: string[];
  relevanceScore: number; // 0-100
  source?: string;
  createdAt: string;
}

interface KnowledgeData {
  entries: KnowledgeEntry[];
  stats: {
    totalEntries: number;
    gstRules: number;
    circulars: number;
    caseLaws: number;
  };
}

// ─── Config Maps ──────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<KnowledgeCategory, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  gst_rule: { label: 'GST Rule', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800', icon: <FileText className="h-3 w-3" /> },
  circular: { label: 'Circular', color: 'text-teal-700 dark:text-teal-400', bgColor: 'bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800', icon: <Bell className="h-3 w-3" /> },
  notification: { label: 'Notification', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800', icon: <AlertCircle className="h-3 w-3" /> },
  case_law: { label: 'Case Law', color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800', icon: <Scale className="h-3 w-3" /> },
  department_update: { label: 'Dept Update', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800', icon: <Landmark className="h-3 w-3" /> },
};

const CATEGORY_FILTER_OPTIONS = [
  { key: 'all', label: 'All Categories' },
  { key: 'gst_rule', label: 'GST Rules' },
  { key: 'circular', label: 'Circulars' },
  { key: 'notification', label: 'Notifications' },
  { key: 'case_law', label: 'Case Laws' },
  { key: 'department_update', label: 'Department Updates' },
] as const;

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
      transition={{ delay, duration: 0.5, ease: 'easeOut' as const }}
    >
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Relevance Score Bar ──────────────────────────────────────────────────
function RelevanceBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 85) return 'bg-emerald-500';
    if (s >= 70) return 'bg-teal-500';
    if (s >= 50) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
        Relevance
      </span>
      <div className="h-1.5 w-16 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
        />
      </div>
      <span className="text-[10px] font-bold text-foreground">{score}%</span>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EntrySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-border/30">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-2/3 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AIKnowledgeCenterPage() {
  const [data, setData] = useState<KnowledgeData>({ entries: [], stats: { totalEntries: 0, gstRules: 0, circulars: 0, caseLaws: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Add entry form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>('gst_rule');
  const [formContent, setFormContent] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formEffectiveDate, setFormEffectiveDate] = useState('');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai-knowledge');
      if (res.ok) {
        const json = await res.json();
        const entries: KnowledgeEntry[] = Array.isArray(json.entries) ? json.entries : [];
        const stats = json.stats ?? {
          totalEntries: entries.length,
          gstRules: entries.filter((e: KnowledgeEntry) => e.category === 'gst_rule').length,
          circulars: entries.filter((e: KnowledgeEntry) => e.category === 'circular').length,
          caseLaws: entries.filter((e: KnowledgeEntry) => e.category === 'case_law').length,
        };
        setData({ entries, stats });
      } else {
        setData({ entries: [], stats: { totalEntries: 0, gstRules: 0, circulars: 0, caseLaws: 0 } });
      }
    } catch (err) {
      console.error('AI Knowledge fetch error:', err);
      setError('Failed to load knowledge entries. Please try again later.');
      setData({ entries: [], stats: { totalEntries: 0, gstRules: 0, circulars: 0, caseLaws: 0 } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered entries ────────────────────────────────────────────────────
  const filteredEntries = data.entries.filter((entry) => {
    const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.summary.toLowerCase().includes(q) ||
      entry.content.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      (entry.referenceNumber ?? '').toLowerCase().includes(q)
    );
  });

  // ── Toggle expand ───────────────────────────────────────────────────────
  function toggleExpand(entryId: string) {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  }

  // ── Format date ─────────────────────────────────────────────────────────
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  // ── Handle add entry ────────────────────────────────────────────────────
  function handleAddEntry() {
    if (!formTitle.trim() || !formContent.trim()) return;

    const newEntry: KnowledgeEntry = {
      id: `k${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      content: formContent.trim(),
      summary: formSummary.trim() || formContent.trim().slice(0, 120) + '...',
      referenceNumber: formReferenceNumber.trim() || undefined,
      effectiveDate: formEffectiveDate || undefined,
      tags: formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      relevanceScore: 75,
      source: formSource.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setData((prev) => ({
      ...prev,
      entries: [newEntry, ...prev.entries],
      stats: {
        ...prev.stats,
        totalEntries: prev.stats.totalEntries + 1,
        gstRules: prev.stats.gstRules + (formCategory === 'gst_rule' ? 1 : 0),
        circulars: prev.stats.circulars + (formCategory === 'circular' ? 1 : 0),
        caseLaws: prev.stats.caseLaws + (formCategory === 'case_law' ? 1 : 0),
      },
    }));

    // Reset form
    setFormTitle('');
    setFormCategory('gst_rule');
    setFormContent('');
    setFormSummary('');
    setFormTags('');
    setFormSource('');
    setFormEffectiveDate('');
    setFormReferenceNumber('');
    setAddDialogOpen(false);
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
            <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Knowledge Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              GST rules, circulars, and case law database
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
            onClick={() => setAddDialogOpen(true)}
            className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Entry
          </Button>
        </div>
      </motion.div>

      {/* ═══ SEARCH BAR ═══ */}
      <AnimatedCard delay={0.05}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search GST rules, circulars, case laws, notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-10">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </AnimatedCard>

      {/* ═══ KNOWLEDGE STATS ROW ═══ */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AnimatedCard delay={0.1}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Entries</p>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(data.stats.totalEntries)}</p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.13}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">GST Rules</p>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(data.stats.gstRules)}</p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.16}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50">
                  <Bell className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Circulars</p>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(data.stats.circulars)}</p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.19}>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50">
                  <Scale className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Case Laws</p>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(data.stats.caseLaws)}</p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>
      )}

      {/* ═══ ERROR STATE ═══ */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ═══ KNOWLEDGE ENTRY LIST ═══ */}
      <AnimatedCard delay={0.22}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Knowledge Base
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
              >
                {formatNumber(filteredEntries.length)} entries
              </Badge>
            </CardTitle>
          </div>
          <CardDescription>
            {searchQuery
              ? `Search results for "${searchQuery}"`
              : categoryFilter !== 'all'
                ? `Filtered by ${CATEGORY_FILTER_OPTIONS.find((o) => o.key === categoryFilter)?.label}`
                : 'Browse all GST knowledge entries'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <EntrySkeleton />
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No knowledge entries yet"
              description={searchQuery || categoryFilter !== 'all' ? 'No entries match your search criteria.' : 'Knowledge entries will appear here once they are added.'}
            />
          ) : (
            <ScrollArea className="max-h-[700px]">
              <div className="space-y-2 pr-2">
                <AnimatePresence>
                  {filteredEntries.map((entry, index) => {
                    const isExpanded = expandedEntryId === entry.id;
                    const catConfig = CATEGORY_CONFIG[entry.category];

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.4 }}
                        className="p-4 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all group"
                      >
                        {/* Entry Header */}
                        <div className="flex items-start gap-3 cursor-pointer" onClick={() => toggleExpand(entry.id)}>
                          <Badge
                            variant="outline"
                            className={`gap-1 px-2 py-1 text-[10px] font-semibold border shrink-0 mt-0.5 ${catConfig.bgColor} ${catConfig.color}`}
                          >
                            {catConfig.icon}
                            {catConfig.label}
                          </Badge>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground leading-snug">
                                {entry.title}
                              </h3>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </div>

                            {/* Summary (always visible) */}
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {entry.summary}
                            </p>

                            {/* Meta row */}
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              {entry.referenceNumber && (
                                <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                                  {entry.referenceNumber}
                                </span>
                              )}
                              {entry.effectiveDate && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(entry.effectiveDate)}
                                </span>
                              )}
                              <RelevanceBar score={entry.relevanceScore} />
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.tags.slice(0, isExpanded ? undefined : 4).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="px-1.5 py-0 text-[9px] font-medium border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/30"
                                >
                                  <Tag className="h-2.5 w-2.5 mr-0.5" />
                                  {tag}
                                </Badge>
                              ))}
                              {!isExpanded && entry.tags.length > 4 && (
                                <span className="text-[9px] text-muted-foreground ml-1">
                                  +{entry.tags.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-border/30">
                                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">
                                  {entry.content}
                                </p>
                                {entry.source && (
                                  <p className="text-[10px] text-muted-foreground mt-3">
                                    Source: {entry.source}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </AnimatedCard>

      {/* ═══ ADD ENTRY DIALOG ═══ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              Add Knowledge Entry
            </DialogTitle>
            <DialogDescription>
              Add a new entry to the AI Knowledge Center
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title *</Label>
              <Input
                placeholder="Entry title..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={formCategory} onValueChange={(v) => setFormCategory(v as KnowledgeCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Content *</Label>
              <Textarea
                placeholder="Full knowledge content..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-[120px]"
              />
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Summary</Label>
              <Textarea
                placeholder="Brief summary (auto-generated from content if empty)..."
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tags (comma separated)</Label>
              <Input
                placeholder="ITC, Refund, GSTR-2B..."
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </div>

            {/* Source + Effective Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Source</Label>
                <Input
                  placeholder="CBIC, HC, etc."
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Effective Date</Label>
                <Input
                  type="date"
                  value={formEffectiveDate}
                  onChange={(e) => setFormEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reference Number</Label>
              <Input
                placeholder="CGST Rule 36(4), Circular No. 170..."
                value={formReferenceNumber}
                onChange={(e) => setFormReferenceNumber(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddEntry}
              disabled={!formTitle.trim() || !formContent.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
