'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  FileCode2,
  Radio,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  FileScan,
  ArrowRight,
  Upload,
  Search,
  Zap,
  TrendingUp,
  FolderOpen,
  FileSpreadsheet,
  Receipt,
  FileCheck,
  FileWarning,
  Truck,
  MapPin,
  Activity,
  BarChart3,
  Timer,
  Target,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  orange: '#f97316',
  pink: '#ec4899',
  cyan: '#06b6d4',
};

// ─── Types ──────────────────────────────────────────────────────────────────
type DocType =
  | 'Invoice'
  | 'Purchase Register'
  | 'Sales Register'
  | 'Notice'
  | 'Bank Statement'
  | 'GST Return'
  | 'Credit Note'
  | 'Debit Note'
  | 'Delivery Challan'
  | 'E-Way Bill';

type ProcessingStage = 'uploaded' | 'identified' | 'extracting' | 'processing' | 'complete';

interface DocumentPipeline {
  id: string;
  fileName: string;
  originalName: string;
  docType: DocType | null;
  clientName: string;
  stage: ProcessingStage;
  progress: number;
  uploadedAt: string;
  processingTime: string;
  renamedTo?: string;
}

interface ExtractionResult {
  id: string;
  fileName: string;
  docType: DocType;
  clientName: string;
  gstin: string;
  amount: number;
  tax: number;
  partyName: string;
  date: string;
  extractedAt: string;
}

interface AutoAction {
  id: string;
  action: string;
  description: string;
  clientName: string;
  documentName: string;
  timestamp: string;
  type: 'invoice_created' | 'return_updated' | 'client_updated' | 'activity_created' | 'folder_created';
}

// ─── Helper: Indian Currency Format ─────────────────────────────────────────
function formatINR(n: number): string {
  const s = n.toFixed(0);
  const [intPart] = s.split('.');
  const isNeg = intPart.startsWith('-');
  const digits = intPart.replace('-', '');
  let lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  if (rest) lastThree = ',' + lastThree;
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  return (isNeg ? '-' : '') + '\u20B9' + formatted;
}

// ─── Document Type Helpers ──────────────────────────────────────────────────
const docTypeColors: Record<DocType, string> = {
  Invoice: '#10b981',
  'Purchase Register': '#3b82f6',
  'Sales Register': '#8b5cf6',
  Notice: '#ef4444',
  'Bank Statement': '#f97316',
  'GST Return': '#06b6d4',
  'Credit Note': '#ec4899',
  'Debit Note': '#f59e0b',
  'Delivery Challan': '#14b8a6',
  'E-Way Bill': '#64748b',
};

const docTypeIcons: Record<DocType, React.ElementType> = {
  Invoice: Receipt,
  'Purchase Register': FileSpreadsheet,
  'Sales Register': FileSpreadsheet,
  Notice: FileWarning,
  'Bank Statement': FileText,
  'GST Return': FileCheck,
  'Credit Note': FileText,
  'Debit Note': FileText,
  'Delivery Challan': Truck,
  'E-Way Bill': MapPin,
};

const stageLabels: Record<ProcessingStage, string> = {
  uploaded: 'Uploaded',
  identified: 'Identified',
  extracting: 'Extracting',
  processing: 'Processing',
  complete: 'Complete',
};

const stageIcons: Record<ProcessingStage, React.ElementType> = {
  uploaded: Upload,
  identified: Search,
  extracting: FileScan,
  processing: Zap,
  complete: CheckCircle2,
};

// ─── Animated Card Wrapper ──────────────────────────────────────────────────
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
      transition={{ duration: 0.4, delay, ease: 'easeOut' as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── SVG Donut Chart ────────────────────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 100, cy = 100, r = 70;
  const circumference = 2 * Math.PI * r;

  // Pre-compute offsets to avoid mutation during render
  const slices = data.reduce<Array<{ dash: number; gap: number; offset: number; color: string }>>((acc, d) => {
    const pct = total > 0 ? d.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset - acc[acc.length - 1].dash : 0;
    acc.push({ dash, gap, offset: prevOffset, color: d.color });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6">
      <svg width="200" height="200" viewBox="0 0 200 200">
        {slices.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="24"
              strokeDasharray={`${s.dash} ${s.gap}`}
              strokeDashoffset={s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="transition-all duration-500"
            />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-slate-800 text-xl font-bold">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400 text-xs">
          Total Docs
        </text>
      </svg>
      <div className="flex flex-col gap-2 text-xs">
        {data.length === 0 ? (
          <span className="text-slate-400 italic">No documents processed yet</span>
        ) : data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-semibold text-slate-800 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sample Data (empty — populated by real pipeline data) ──────────────────
const pipelineDocuments: DocumentPipeline[] = [];
const extractionResults: ExtractionResult[] = [];
const autoActions: AutoAction[] = [];
const docTypeDistribution: { label: string; value: number; color: string }[] = [];

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AIDocumentEmployeePage() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [pipelineData] = useState<DocumentPipeline[]>(pipelineDocuments);

  const completedDocs = pipelineData.filter((d) => d.stage === 'complete').length;
  const pendingDocs = pipelineData.filter((d) => d.stage === 'uploaded').length;

  const metrics = [
    { label: 'Docs Processed Today', value: '0', icon: FileCheck, color: 'emerald' },
    { label: 'Avg Processing Time', value: '—', icon: Timer, color: 'teal' },
    { label: 'Accuracy Rate', value: '—', icon: Target, color: 'emerald' },
    { label: 'Auto-Actions Created', value: '0', icon: Zap, color: 'amber' },
    { label: 'Pending Queue', value: String(pendingDocs), icon: Clock, color: 'orange' },
    { label: 'Total This Month', value: '0', icon: BarChart3, color: 'emerald' },
  ];

  const getStageColor = (stage: ProcessingStage) => {
    switch (stage) {
      case 'uploaded': return 'bg-slate-100 text-slate-600';
      case 'identified': return 'bg-blue-50 text-blue-700';
      case 'extracting': return 'bg-amber-50 text-amber-700';
      case 'processing': return 'bg-purple-50 text-purple-700';
      case 'complete': return 'bg-emerald-50 text-emerald-700';
    }
  };

  const getActionIcon = (type: AutoAction['type']) => {
    switch (type) {
      case 'invoice_created': return Receipt;
      case 'return_updated': return FileCheck;
      case 'client_updated': return Users;
      case 'activity_created': return Activity;
      case 'folder_created': return FolderOpen;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <AnimatedCard delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FileCode2 className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">AI Document Employee</h1>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold px-2">Active</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Watches cloud storage and processes every document automatically</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">Live Processing</span>
            </div>
            <div className="text-xs text-slate-400">{completedDocs} done / {pipelineData.length} total</div>
          </div>
        </div>
      </AnimatedCard>

      {/* ─── Metrics ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => (
          <AnimatedCard key={m.label} delay={0.05 * i}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px] text-slate-500 font-medium truncate">{m.label}</span>
                </div>
                <p className="text-lg font-bold text-slate-800">{m.value}</p>
              </CardContent>
            </Card>
          </AnimatedCard>
        ))}
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 h-9 p-0.5">
          <TabsTrigger value="pipeline" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Pipeline</TabsTrigger>
          <TabsTrigger value="stream" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Stream</TabsTrigger>
          <TabsTrigger value="extractions" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Extractions</TabsTrigger>
          <TabsTrigger value="auto-actions" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Auto-Actions</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Stats</TabsTrigger>
        </TabsList>

        {/* ── Pipeline Tab ─────────────────────────────────────────────── */}
        <TabsContent value="pipeline" className="mt-4 space-y-4">
          {/* Pipeline Stages Visual */}
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" /> Processing Pipeline
                </CardTitle>
                <CardDescription className="text-xs">Real-time document processing stages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-1 mb-6 overflow-x-auto pb-2">
                  {(['uploaded', 'identified', 'extracting', 'processing', 'complete'] as ProcessingStage[]).map((stage, i) => {
                    const count = pipelineData.filter((d) => d.stage === stage).length;
                    const Icon = stageIcons[stage];
                    return (
                      <React.Fragment key={stage}>
                        <div className="flex flex-col items-center gap-2 min-w-[80px]">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getStageColor(stage)} ${i === 4 ? 'ring-2 ring-emerald-300 ring-offset-2' : ''}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 text-center">{stageLabels[stage]}</span>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
                        </div>
                        {i < 4 && (
                          <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-[-20px]" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                <Separator className="my-4" />

                {/* Pipeline Documents */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {pipelineData.length === 0 ? (
                      <div className="h-[340px] flex flex-col items-center justify-center text-slate-400">
                        <FileText className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No documents in pipeline</p>
                        <p className="text-xs text-slate-300 mt-1">Documents will appear here once they are uploaded for processing</p>
                      </div>
                    ) : pipelineData.map((doc, i) => {
                      const DocIcon = doc.docType ? docTypeIcons[doc.docType] : FileText;
                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                        >
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (doc.docType ? docTypeColors[doc.docType] : COLORS.slate) + '15' }}>
                            <DocIcon className="h-4 w-4" style={{ color: doc.docType ? docTypeColors[doc.docType] : COLORS.slate }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-700 truncate">{doc.originalName}</span>
                              {doc.docType && (
                                <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: docTypeColors[doc.docType] + '15', color: docTypeColors[doc.docType] }}>
                                  {doc.docType}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{doc.clientName}</span>
                              <span>&middot;</span>
                              <span>{doc.uploadedAt}</span>
                              {doc.renamedTo && <><span>&middot;</span><span className="text-emerald-600 truncate">→ {doc.renamedTo}</span></>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge className={`text-[9px] h-4 px-1.5 ${getStageColor(doc.stage)}`}>
                              {stageLabels[doc.stage]}
                            </Badge>
                            <div className="w-20">
                              <Progress value={doc.progress} className="h-1" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Stream Tab ───────────────────────────────────────────────── */}
        <TabsContent value="stream" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-500 animate-pulse" /> Document Stream
                </CardTitle>
                <CardDescription className="text-xs">Live feed of documents with processing status</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {pipelineData.length === 0 ? (
                      <div className="h-[440px] flex flex-col items-center justify-center text-slate-400">
                        <Radio className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No document stream yet</p>
                        <p className="text-xs text-slate-300 mt-1">Live document processing activity will stream here</p>
                      </div>
                    ) : pipelineData.map((doc, i) => {
                      const DocIcon = doc.docType ? docTypeIcons[doc.docType] : FileText;
                      const isComplete = doc.stage === 'complete';
                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.06 }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isComplete ? 'border-emerald-100 bg-emerald-50/20' : 'border-slate-100 hover:border-emerald-200'}`}
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: (doc.docType ? docTypeColors[doc.docType] : COLORS.slate) + '12' }}>
                            <DocIcon className="h-3.5 w-3.5" style={{ color: doc.docType ? docTypeColors[doc.docType] : COLORS.slate }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700 truncate">{doc.fileName}</span>
                              {doc.docType && (
                                <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: docTypeColors[doc.docType] + '15', color: docTypeColors[doc.docType] }}>
                                  {doc.docType}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{doc.clientName}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1">
                              {isComplete ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />}
                              <span className={`text-[10px] font-semibold ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {isComplete ? doc.processingTime : stageLabels[doc.stage]}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">{doc.uploadedAt}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Extractions Tab ──────────────────────────────────────────── */}
        <TabsContent value="extractions" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileScan className="h-4 w-4 text-emerald-500" /> Extraction Results
                </CardTitle>
                <CardDescription className="text-xs">Recent extractions with key fields</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {extractionResults.length === 0 ? (
                      <div className="h-[440px] flex flex-col items-center justify-center text-slate-400">
                        <FileScan className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No extracted data yet</p>
                        <p className="text-xs text-slate-300 mt-1">Extracted GSTINs, amounts, and parties from processed documents will appear here</p>
                      </div>
                    ) : extractionResults.map((ext, i) => {
                      const DocIcon = docTypeIcons[ext.docType];
                      return (
                        <motion.div
                          key={ext.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: docTypeColors[ext.docType] + '15' }}>
                              <DocIcon className="h-4 w-4" style={{ color: docTypeColors[ext.docType] }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-semibold text-slate-700 truncate">{ext.fileName}</span>
                                <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: docTypeColors[ext.docType] + '15', color: docTypeColors[ext.docType] }}>
                                  {ext.docType}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                <div>
                                  <span className="text-slate-400 block">GSTIN</span>
                                  <span className="font-mono font-semibold text-slate-700">{ext.gstin}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Amount</span>
                                  <span className="font-semibold text-slate-700">{formatINR(ext.amount)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Tax</span>
                                  <span className="font-semibold text-emerald-600">{formatINR(ext.tax)}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block">Party</span>
                                  <span className="font-semibold text-slate-700">{ext.partyName}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                                <span>{ext.clientName}</span>
                                <span>&middot;</span>
                                <span>{ext.date}</span>
                                <span>&middot;</span>
                                <span>Extracted at {ext.extractedAt}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Auto-Actions Tab ─────────────────────────────────────────── */}
        <TabsContent value="auto-actions" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Auto-Actions Log
                </CardTitle>
                <CardDescription className="text-xs">Actions taken automatically by AI Document Employee</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {autoActions.length === 0 ? (
                      <div className="h-[440px] flex flex-col items-center justify-center text-slate-400">
                        <Zap className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No audit trail yet</p>
                        <p className="text-xs text-slate-300 mt-1">Auto-actions taken by the AI Document Employee will be logged here</p>
                      </div>
                    ) : autoActions.map((action, i) => {
                      const ActionIcon = getActionIcon(action.type);
                      const colorMap: Record<AutoAction['type'], string> = {
                        invoice_created: '#10b981',
                        return_updated: '#3b82f6',
                        client_updated: '#8b5cf6',
                        activity_created: '#f59e0b',
                        folder_created: '#06b6d4',
                      };
                      return (
                        <motion.div
                          key={action.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: colorMap[action.type] + '15' }}>
                            <ActionIcon className="h-3.5 w-3.5" style={{ color: colorMap[action.type] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-700">{action.action}</span>
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5">{action.clientName}</Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">{action.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span>{action.timestamp}</span>
                              <span>&middot;</span>
                              <span className="truncate">{action.documentName}</span>
                            </div>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-1" />
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Stats Tab ────────────────────────────────────────────────── */}
        <TabsContent value="stats" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatedCard delay={0.1}>
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-500" /> Document Type Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart data={docTypeDistribution} />
                </CardContent>
              </Card>
            </AnimatedCard>

            <AnimatedCard delay={0.15}>
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" /> Processing Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 block">Today</span>
                      <span className="text-lg font-bold text-emerald-700">0 docs</span>
                    </div>
                    <div className="p-3 rounded-lg bg-teal-50 border border-teal-100">
                      <span className="text-[10px] text-teal-600 block">Avg Time</span>
                      <span className="text-lg font-bold text-teal-700">—</span>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 block">Accuracy</span>
                      <span className="text-lg font-bold text-emerald-700">—</span>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <span className="text-[10px] text-amber-600 block">Errors</span>
                      <span className="text-lg font-bold text-amber-700">0</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-600">Processing by Stage</h4>
                    {(['uploaded', 'identified', 'extracting', 'processing', 'complete'] as ProcessingStage[]).map((stage) => {
                      const count = pipelineData.filter((d) => d.stage === stage).length;
                      const pct = pipelineData.length > 0 ? (count / pipelineData.length) * 100 : 0;
                      const colors: Record<ProcessingStage, string> = {
                        uploaded: 'bg-slate-400',
                        identified: 'bg-blue-400',
                        extracting: 'bg-amber-400',
                        processing: 'bg-purple-400',
                        complete: 'bg-emerald-400',
                      };
                      return (
                        <div key={stage} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-20 shrink-0">{stageLabels[stage]}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${colors[stage]}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' as const }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-600">Weekly Trend</h4>
                    {(() => {
                      const trendData: number[] = [];
                      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      if (trendData.length === 0) {
                        return (
                          <div className="h-20 flex items-center justify-center text-slate-300 text-xs italic">
                            No processing history yet — weekly trend will appear once documents are processed
                          </div>
                        );
                      }
                      return (
                        <svg width="100%" height="80" viewBox="0 0 300 80" className="overflow-visible">
                          <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {trendData.map((v, i, arr) => {
                            const x = (i / (arr.length - 1)) * 280 + 10;
                            const y = 70 - (v / 60) * 60;
                            const prevX = i > 0 ? ((i - 1) / (arr.length - 1)) * 280 + 10 : x;
                            const prevY = i > 0 ? 70 - (arr[i - 1] / 60) * 60 : y;
                            return (
                              <React.Fragment key={i}>
                                {i > 0 && (
                                  <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="#10b981" strokeWidth="2" />
                                )}
                                <circle cx={x} cy={y} r="3" fill="#10b981" />
                                <text x={x} y={78} textAnchor="middle" className="fill-slate-400 text-[8px]">
                                  {days[i]}
                                </text>
                              </React.Fragment>
                            );
                          })}
                          <path
                            d={`M10,${70 - (trendData[0] / 60) * 60} ${trendData.slice(1).map((v, i) => {
                              const x = ((i + 1) / (trendData.length - 1)) * 280 + 10;
                              const y = 70 - (v / 60) * 60;
                              return `L${x},${y}`;
                            }).join(' ')} L290,70 L10,70 Z`}
                            fill="url(#trendGrad)"
                          />
                        </svg>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
