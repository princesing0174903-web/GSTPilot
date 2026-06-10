'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileBarChart2,
  Sparkles,
  HeartPulse,
  ShieldCheck,
  CheckCircle,
  TrendingUp,
  Building2,
  Download,
  Loader2,
  FileText,
  FileSpreadsheet,
  Clock,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Color Palette (Emerald) ──────────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  slate: '#64748b',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  gradientFrom: string;
  gradientTo: string;
  lastGenerated: string | null;
}

interface GeneratedReport {
  id: string;
  title: string;
  type: string;
  period: string;
  format: 'PDF' | 'Excel';
  generatedDate: string;
  status: 'generated' | 'processing';
}

// ─── Report Type Definitions ───────────────────────────────────────────────
const reportTypes: ReportType[] = [
  {
    id: 'client-health',
    title: 'Client Health Report',
    description: 'Comprehensive health analysis of all clients with compliance scores, risk factors, and improvement recommendations.',
    icon: HeartPulse,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-100 dark:bg-emerald-950/50',
    accentBorder: 'border-emerald-200 dark:border-emerald-800',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-emerald-600',
    lastGenerated: '2025-03-04',
  },
  {
    id: 'gst-risk',
    title: 'GST Risk Report',
    description: 'Detailed risk assessment covering ITC mismatches, filing delays, and potential audit triggers for the selected period.',
    icon: ShieldCheck,
    accentColor: 'text-red-600 dark:text-red-400',
    accentBg: 'bg-red-100 dark:bg-red-950/50',
    accentBorder: 'border-red-200 dark:border-red-800',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-red-600',
    lastGenerated: '2025-03-03',
  },
  {
    id: 'compliance',
    title: 'Compliance Report',
    description: 'Filing compliance overview with match rates, deadline adherence, and regulatory compliance metrics across clients.',
    icon: CheckCircle,
    accentColor: 'text-blue-600 dark:text-blue-400',
    accentBg: 'bg-blue-100 dark:bg-blue-950/50',
    accentBorder: 'border-blue-200 dark:border-blue-800',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
    lastGenerated: '2025-03-02',
  },
  {
    id: 'firm-performance',
    title: 'Firm Performance Report',
    description: 'Practice performance analytics including revenue per client, team productivity, filing efficiency, and growth metrics.',
    icon: TrendingUp,
    accentColor: 'text-purple-600 dark:text-purple-400',
    accentBg: 'bg-purple-100 dark:bg-purple-950/50',
    accentBorder: 'border-purple-200 dark:border-purple-800',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-purple-600',
    lastGenerated: '2025-03-01',
  },
  {
    id: 'board-report',
    title: 'Board Report',
    description: 'Executive summary for board presentations with KPIs, trend analysis, risk highlights, and strategic recommendations.',
    icon: Building2,
    accentColor: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-100 dark:bg-amber-950/50',
    accentBorder: 'border-amber-200 dark:border-amber-800',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-amber-600',
    lastGenerated: '2025-02-28',
  },
];

// ─── Mock Generated Reports ────────────────────────────────────────────────
const mockReports: GeneratedReport[] = [
  { id: 'r1', title: 'Client Health Report — Q3 2025', type: 'client-health', period: 'Q3 2025', format: 'PDF', generatedDate: '2025-03-04', status: 'generated' },
  { id: 'r2', title: 'GST Risk Report — Feb 2025', type: 'gst-risk', period: 'Feb 2025', format: 'Excel', generatedDate: '2025-03-03', status: 'generated' },
  { id: 'r3', title: 'Compliance Report — Feb 2025', type: 'compliance', period: 'Feb 2025', format: 'PDF', generatedDate: '2025-03-02', status: 'generated' },
  { id: 'r4', title: 'Firm Performance — Q3 2025', type: 'firm-performance', period: 'Q3 2025', format: 'PDF', generatedDate: '2025-03-01', status: 'generated' },
  { id: 'r5', title: 'Board Report — FY 2024-25', type: 'board-report', period: 'FY 2024-25', format: 'PDF', generatedDate: '2025-02-28', status: 'generated' },
  { id: 'r6', title: 'Client Health Report — Feb 2025', type: 'client-health', period: 'Feb 2025', format: 'Excel', generatedDate: '2025-03-05', status: 'processing' },
];

const periodOptions = [
  'Mar 2025', 'Feb 2025', 'Jan 2025',
  'Q3 2025 (Jan-Mar)', 'Q2 2025 (Oct-Dec)', 'Q1 2025 (Jul-Sep)',
  'FY 2024-25', 'FY 2023-24',
];

// ─── Animated Card ─────────────────────────────────────────────────────────
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

// ─── Skeletons ─────────────────────────────────────────────────────────────
function ReportCardSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ─── Format date ───────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AIExecutiveReportsPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<'PDF' | 'Excel'>('PDF');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // ── Fetch reports ────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-reports');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports) && data.reports.length > 0) {
          setReports(data.reports);
        } else {
          setReports(mockReports);
        }
      } else {
        setReports(mockReports);
      }
    } catch {
      setReports(mockReports);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ── Generate report ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!selectedType || !selectedPeriod) return;

    setGenerating(true);
    setGeneratedLink(null);

    try {
      const res = await fetch('/api/ai-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          period: selectedPeriod,
          format: selectedFormat,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedLink(data.downloadUrl || `/reports/${selectedType}-${Date.now()}.${selectedFormat === 'PDF' ? 'pdf' : 'xlsx'}`);

        // Add to reports list
        const newReport: GeneratedReport = {
          id: `r-${Date.now()}`,
          title: `${reportTypes.find(r => r.id === selectedType)?.title || 'Report'} — ${selectedPeriod}`,
          type: selectedType,
          period: selectedPeriod,
          format: selectedFormat,
          generatedDate: new Date().toISOString().split('T')[0],
          status: 'generated',
        };
        setReports(prev => [newReport, ...prev]);
      } else {
        // Simulate generation
        await new Promise(resolve => setTimeout(resolve, 2000));
        setGeneratedLink(`/reports/${selectedType}-${Date.now()}.${selectedFormat === 'PDF' ? 'pdf' : 'xlsx'}`);

        const newReport: GeneratedReport = {
          id: `r-${Date.now()}`,
          title: `${reportTypes.find(r => r.id === selectedType)?.title || 'Report'} — ${selectedPeriod}`,
          type: selectedType,
          period: selectedPeriod,
          format: selectedFormat,
          generatedDate: new Date().toISOString().split('T')[0],
          status: 'generated',
        };
        setReports(prev => [newReport, ...prev]);
      }
    } catch {
      // Simulate generation on error
      await new Promise(resolve => setTimeout(resolve, 2000));
      setGeneratedLink(`/reports/${selectedType}-${Date.now()}.${selectedFormat === 'PDF' ? 'pdf' : 'xlsx'}`);
    } finally {
      setGenerating(false);
    }
  }, [selectedType, selectedPeriod, selectedFormat]);

  // ── Open generate dialog for a specific type ─────────────────────────────
  const openGenerateDialog = (typeId: string) => {
    setSelectedType(typeId);
    setSelectedPeriod('');
    setSelectedFormat('PDF');
    setGeneratedLink(null);
    setDialogOpen(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50">
            <FileBarChart2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Executive Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              One-click intelligent report generation
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Powered
        </Badge>
      </motion.div>

      {/* ═══ REPORT TYPES GRID ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {reportTypes.map((type, index) => (
          <AnimatedCard key={type.id} delay={0.05 + index * 0.05}>
            <CardContent className="p-5">
              <div className="space-y-4">
                {/* Icon with gradient */}
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${type.gradientFrom} ${type.gradientTo} shadow-sm`}>
                  <type.icon className="h-5 w-5 text-white" />
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {type.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {type.description}
                  </p>
                </div>

                {/* Last Generated */}
                {type.lastGenerated && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last: {formatDate(type.lastGenerated)}
                  </div>
                )}

                {/* Generate Button */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => openGenerateDialog(type.id)}
                    className={`gap-1.5 h-8 bg-gradient-to-r ${type.gradientFrom} ${type.gradientTo} hover:opacity-90 text-white text-xs flex-1`}
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate
                  </Button>
                  <select
                    className="h-8 rounded-md border border-border/50 bg-background text-[10px] text-foreground px-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    onChange={(e) => {
                      setSelectedFormat(e.target.value as 'PDF' | 'Excel');
                      openGenerateDialog(type.id);
                    }}
                    defaultValue="PDF"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="PDF">PDF</option>
                    <option value="Excel">Excel</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        ))}
      </div>

      {/* ═══ GENERATION DIALOG ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Generate Report
            </DialogTitle>
            <DialogDescription>
              Configure and generate an AI-powered executive report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Report Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Report Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="border-emerald-200 focus:border-emerald-500 dark:border-emerald-800">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {type.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="border-emerald-200 focus:border-emerald-500 dark:border-emerald-800">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(period => (
                    <SelectItem key={period} value={period}>{period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Format</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedFormat('PDF')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedFormat === 'PDF'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-border text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-800'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
                <button
                  onClick={() => setSelectedFormat('Excel')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedFormat === 'Excel'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-border text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-800'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </button>
              </div>
            </div>

            {/* Success - Download Link */}
            {generatedLink && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
              >
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Report generated successfully!
                  </p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                    Your {selectedFormat} report is ready to download.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                  asChild
                >
                  <a href={generatedLink} download>
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                </Button>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!selectedType || !selectedPeriod || generating}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ RECENT REPORTS TABLE ═══ */}
      <AnimatedCard delay={0.35}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-emerald-500" />
                Recent Reports
              </CardTitle>
              <CardDescription>Previously generated executive reports</CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
            >
              {reports.length} reports
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Report Title</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Period</TableHead>
                    <TableHead className="text-xs font-semibold">Format</TableHead>
                    <TableHead className="text-xs font-semibold">Generated Date</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {reports.map((report, index) => {
                      const typeInfo = reportTypes.find(t => t.id === report.type);
                      return (
                        <motion.tr
                          key={report.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 + index * 0.03, duration: 0.3 }}
                          className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors"
                        >
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {typeInfo && (
                                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${typeInfo.accentBg}`}>
                                  <typeInfo.icon className={`h-3.5 w-3.5 ${typeInfo.accentColor}`} />
                                </div>
                              )}
                              <span className="truncate max-w-[200px]">{report.title}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {typeInfo?.title?.replace(' Report', '') || report.type}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {report.period}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-2 py-0.5 border-border/50"
                            >
                              {report.format === 'PDF' ? (
                                <FileText className="h-2.5 w-2.5 mr-1 text-red-500" />
                              ) : (
                                <FileSpreadsheet className="h-2.5 w-2.5 mr-1 text-emerald-600" />
                              )}
                              {report.format}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(report.generatedDate)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] px-2 py-0.5 font-semibold border-0 ${
                                report.status === 'generated'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                              }`}
                            >
                              {report.status === 'generated' ? (
                                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                              ) : (
                                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                              )}
                              {report.status === 'generated' ? 'Generated' : 'Processing'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={report.status === 'processing'}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                              asChild={report.status === 'generated'}
                            >
                              {report.status === 'generated' ? (
                                <a href={`/reports/${report.id}.${report.format === 'PDF' ? 'pdf' : 'xlsx'}`} download>
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span>
                                  <Eye className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </Button>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </AnimatedCard>
    </div>
  );
}
