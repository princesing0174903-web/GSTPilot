'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared';
import { INDIAN_STATES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, Building2, MapPin, Mail, Phone, Clock, FileText, Upload,
  GitCompareArrows, Activity, CheckCircle2, AlertTriangle, XCircle,
  Plus, Trash2, Loader2, CloudUpload, FileSpreadsheet, FileJson,
  File as FileIcon, Image as ImageIcon, Send, Download, Pencil, ShieldCheck,
  Search, Users, Inbox, Play, ChevronRight, StickyNote, Bell,
} from 'lucide-react';
import type { ReturnType, DocumentType, FilingStatus, MatchStatus } from '@/types/gst';
import { FILING_STATUS_CONFIG, MATCH_STATUS_CONFIG } from '@/types/gst';
import { formatCurrency } from '@/lib/gst-utils';

// React Query hooks
import {
  useClient,
  useUpdateClient,
  useFilings,
  useCreateFiling,
  useUpdateFilingStatus,
  useFileReturn,
  useReconRuns,
  useReconResults,
  useCreateReconRun,
  useUpdateReconWorkflow,
  useUploadedFiles,
  useUploadFile,
  useDeleteDocument,
  useActivities,
  useNotifications,
  queryKeys,
} from '@/hooks/api';
import { useQueryClient } from '@tanstack/react-query';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatRelativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(ft: string) {
  switch (ft) {
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
    case 'excel': case 'xlsx': case 'xls': case 'csv': return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
    case 'json': return <FileJson className="h-4 w-4 text-amber-500" />;
    case 'image': case 'png': case 'jpg': case 'jpeg': return <ImageIcon className="h-4 w-4 text-purple-500" />;
    default: return <FileIcon className="h-4 w-4 text-slate-400" />;
  }
}

function getActivityIcon(action: string) {
  if (action.includes('client')) return <Building2 className="h-3.5 w-3.5" />;
  if (action.includes('document') || action.includes('upload')) return <Upload className="h-3.5 w-3.5" />;
  if (action.includes('filing') || action.includes('filed')) return <Send className="h-3.5 w-3.5" />;
  if (action.includes('return')) return <FileText className="h-3.5 w-3.5" />;
  if (action.includes('recon')) return <GitCompareArrows className="h-3.5 w-3.5" />;
  if (action.includes('mismatch') || action.includes('resolved')) return <CheckCircle2 className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

function getActivityColor(action: string) {
  if (action.includes('add') || action.includes('creat') || action.includes('filed') || action.includes('resolved') || action.includes('processed')) return 'text-emerald-600 bg-emerald-50';
  if (action.includes('delete') || action.includes('fail')) return 'text-red-600 bg-red-50';
  if (action.includes('update') || action.includes('upload')) return 'text-blue-600 bg-blue-50';
  return 'text-slate-600 bg-slate-50';
}

// ─── Document status config (for display) ──────────────────────────────────
const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  processing: { label: 'Processing', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  extracted: { label: 'Validated', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  validated: { label: 'Validated', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  uploaded: { label: 'Uploaded', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Circular Progress Component for Compliance Score
// ═══════════════════════════════════════════════════════════════════════════════
function CircularProgress({ value, size = 80, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  const textColor = value >= 80 ? 'text-emerald-600' : value >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-100" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${textColor}`}>{value > 0 ? `${value}%` : '—'}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientDetailPage() {
  const { selectedClientId, setCurrentView } = useApp();
  const queryClient = useQueryClient();

  // ─── React Query hooks ─────────────────────────────────────────────────
  const { data: clientData, isLoading: clientLoading } = useClient(selectedClientId);
  const { data: documentsData, isLoading: docsLoading } = useUploadedFiles(selectedClientId);
  const { data: filingsData, isLoading: filingsLoading } = useFilings(selectedClientId);
  const { data: reconRunsData, isLoading: reconLoading } = useReconRuns(selectedClientId);
  const { data: reconResultsData } = useReconResults(selectedClientId ? { clientId: selectedClientId } : undefined);
  const { data: activitiesData, isLoading: activitiesLoading } = useActivities(selectedClientId);
  const { data: notificationsData } = useNotifications();

  // Mutations
  const updateClientMutation = useUpdateClient();
  const createFilingMutation = useCreateFiling();
  const updateFilingStatusMutation = useUpdateFilingStatus();
  const fileReturnMutation = useFileReturn();
  const createReconRunMutation = useCreateReconRun();
  const updateReconWorkflowMutation = useUpdateReconWorkflow();
  const uploadFileMutation = useUploadFile();
  const deleteDocumentMutation = useDeleteDocument();

  // ─── Derived data ──────────────────────────────────────────────────────
  const client = clientData?.client;
  const docs = useMemo(() => {
    const files = documentsData?.files ?? documentsData?.documents ?? [];
    return Array.isArray(files) ? files : [];
  }, [documentsData]);
  const returns = filingsData?.filings ?? [];
  const recons = reconRunsData?.runs ?? [];
  const reconResults = reconResultsData?.results ?? [];
  const acts = useMemo(() => {
    const logs = activitiesData?.logs ?? [];
    return logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activitiesData]);
  const notifications = notificationsData?.notifications ?? [];

  // ─── State ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [addReturnOpen, setAddReturnOpen] = useState(false);
  const [newRetType, setNewRetType] = useState<ReturnType>('GSTR-1');
  const [newRetPeriod, setNewRetPeriod] = useState('2025-06');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);
  const [reconPeriod, setReconPeriod] = useState('2025-06');
  const [reconType, setReconType] = useState<ReturnType>('GSTR-1');
  const [notes, setNotes] = useState('');

  // Edit form
  const [ef, setEf] = useState({ tradeName: '', gstin: '', state: '', returnPeriod: 'monthly' as string, contactEmail: '', contactPhone: '' });

  // ─── Computed ───────────────────────────────────────────────────────────
  const filedCount = returns.filter((r: any) => r.status === 'filed').length;
  const pendingCount = returns.filter((r: any) => r.status !== 'filed').length;
  const docValidated = docs.filter((d: any) => d.status === 'validated' || d.status === 'extracted').length;
  const lastActivity = acts.length > 0 ? acts[0] : null;

  // Compliance score from client healthScore
  const complianceScore = client?.healthScore ?? 0;
  const unresolvedMismatches = useMemo(() =>
    reconResults.filter((m: any) => m.clientId === selectedClientId && !m.resolved).length,
    [reconResults, selectedClientId]
  );

  // Client notifications (global, limit 5)
  const clientNotifications = useMemo(() =>
    notifications.slice(0, 5),
    [notifications]
  );

  // Initialize notes when client changes
  React.useEffect(() => {
    setNotes('');
  }, [client?.id]);

  const handleSaveNotes = useCallback(() => {
    if (!selectedClientId || !notes.trim()) return;
    // Persist notes via updateClient
    updateClientMutation.mutate({ id: selectedClientId, notes } as any);
  }, [selectedClientId, notes, updateClientMutation]);

  // ─── Loading state ──────────────────────────────────────────────────────
  const isLoading = clientLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-6xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Card>
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 h-2 rounded-t-lg" />
            <CardContent className="p-5 md:p-6 space-y-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-32 col-span-2" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  // ─── Not Found ─────────────────────────────────────────────────────────
  if (!client) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Client not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => setCurrentView('clients')}>Back to Clients</Button>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!client) return;
    setEf({
      tradeName: client.tradeName,
      gstin: client.gstin,
      state: client.state ?? '',
      returnPeriod: client.returnPeriod ?? 'monthly',
      contactEmail: client.contactEmail ?? '',
      contactPhone: client.contactPhone ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedClientId || !ef.tradeName.trim()) { toast.error('Business name is required'); return; }
    const sc = INDIAN_STATES.find(s => s.name === ef.state)?.code ?? '27';
    try {
      await updateClientMutation.mutateAsync({
        id: selectedClientId,
        tradeName: ef.tradeName,
        gstin: ef.gstin,
        state: ef.state,
        stateCode: sc,
        returnPeriod: ef.returnPeriod,
        contactEmail: ef.contactEmail,
        contactPhone: ef.contactPhone,
      });
      toast.success('Client updated');
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedClientId) return;
    for (const f of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('clientId', selectedClientId);
      uploadFileMutation.mutate(formData);
    }
    toast.success(`${files.length} document(s) uploaded`);
    setUploadOpen(false);
  };

  const handleAddReturn = async () => {
    if (!selectedClientId) return;
    try {
      await createFilingMutation.mutateAsync({
        clientId: selectedClientId,
        returnType: newRetType,
        period: newRetPeriod,
      });
      toast.success(`${newRetType} for ${newRetPeriod} prepared`);
      setAddReturnOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare return');
    }
  };

  const handleFileReturn = async (id: string) => {
    try {
      await fileReturnMutation.mutateAsync({
        id,
        filedDate: new Date().toISOString().split('T')[0],
        acknowledgmentNumber: `ARN${Date.now().toString(36).toUpperCase()}`,
      });
      toast.success('Return filed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to file return');
    }
  };

  const handleMarkReady = async (id: string) => {
    try {
      await updateFilingStatusMutation.mutateAsync({ id, status: 'ready' });
      toast.success('Return marked as ready for filing');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleRunRecon = async () => {
    if (!selectedClientId) return;
    try {
      await createReconRunMutation.mutateAsync({
        clientId: selectedClientId,
        period: reconPeriod,
        sources: reconType === 'GSTR-1' ? 'GSTR-1 vs GSTR-2B' : 'GSTR-3B vs Books',
      });
      setReconOpen(false);
      toast.info('Reconciliation run started...');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start reconciliation');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDocumentMutation.mutateAsync(docId);
      toast.success('Document removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleResolveMismatch = async (resultId: string) => {
    try {
      await updateReconWorkflowMutation.mutateAsync({
        id: resultId,
        workflowStatus: 'resolved',
      });
      toast.success('Mismatch resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve mismatch');
    }
  };

  const initials = (client.tradeName ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const statusCls = client.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : client.status === 'inactive' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-red-50 text-red-700 border-red-200';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* ═══ HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Breadcrumb + Back */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => setCurrentView('clients')} className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Clients
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{client.tradeName}</span>
        </div>

        {/* Client Header Card */}
        <Card className="border-border/60 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 h-2" />
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              {/* Left: Identity */}
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-100 text-emerald-700 text-lg font-bold shrink-0">
                  {initials}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl font-bold text-foreground">{client.tradeName}</h1>
                    <Badge variant="outline" className={statusCls}>{client.status}</Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground tracking-wide">{client.gstin}</p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                    {client.state && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{client.state}</span>}
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{client.returnPeriod === 'monthly' ? 'Monthly Filing' : client.returnPeriod === 'quarterly' ? 'Quarterly Filing' : `${client.returnPeriod || 'Monthly'} Filing`}</span>
                    {client.contactEmail && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{client.contactEmail}</span>}
                  </div>
                  {client.contactPhone && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.contactPhone}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Right: Edit Button */}
              <Button variant="outline" className="gap-2 shrink-0" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit Client
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ TABBED CONTENT ═══ */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-50 border">
          <TabsTrigger value="overview" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Documents</TabsTrigger>
          <TabsTrigger value="returns" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Returns</TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-1.5 text-xs"><GitCompareArrows className="h-3.5 w-3.5" />Reconciliation</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Activity</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Compliance Score - Circular Progress with Breakdown */}
            <Card className="border-border/60 col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <CircularProgress value={complianceScore} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /></div>
                      <span className="text-xs text-muted-foreground">Compliance Score</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Filed Returns</span>
                        <span className="font-medium text-foreground">{filedCount}/{returns.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Validated Documents</span>
                        <span className="font-medium text-foreground">{docValidated}/{docs.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Unresolved Mismatches</span>
                        <span className={`font-medium ${unresolvedMismatches > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{unresolvedMismatches}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Pending Returns</span>
                        <span className={`font-medium ${pendingCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{pendingCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                  <span className="text-xs text-muted-foreground">Filed Returns</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{filedCount > 0 ? filedCount : '—'}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50"><FileText className="h-4 w-4 text-blue-600" /></div>
                  <span className="text-xs text-muted-foreground">Documents</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{docs.length > 0 ? docs.length : '—'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Last Activity + Recent Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Last Activity</CardTitle></CardHeader>
              <CardContent>
                {activitiesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ) : lastActivity ? (
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 ${getActivityColor((lastActivity as any).action ?? '')}`}>
                      {getActivityIcon((lastActivity as any).action ?? '')}
                    </div>
                    <div>
                      <p className="text-sm text-foreground">{(lastActivity as any).details ?? (lastActivity as any).action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime((lastActivity as any).timestamp)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity available.</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Recent Notifications</CardTitle>
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {clientNotifications.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {clientNotifications.map((n: any) => (
                      <div key={n.id} className="flex items-center gap-2 text-xs">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${n.type === 'success' ? 'bg-emerald-500' : n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        <span className={`text-foreground truncate ${n.isRead ? 'opacity-60' : 'font-medium'}`}>{n.title}{n.message ? `: ${n.message}` : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes Section */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about this client..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                className="min-h-[80px] resize-y text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            DOCUMENTS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Uploaded Documents ({docs.length})</h3>
            <Button onClick={() => setUploadOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm"><Upload className="h-3.5 w-3.5" /> Upload Document</Button>
          </div>

          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <EmptyState
              icon={CloudUpload}
              title="No documents uploaded yet."
              description="Upload invoices, purchase registers, or GST data files."
              action={{ label: 'Upload Document', onClick: () => setUploadOpen(true), variant: 'outline', icon: Upload }}
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d: any) => {
                    const cfg = DOC_STATUS_CONFIG[d.status] ?? {};
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(d.fileType ?? d.name?.split('.').pop() ?? '')}
                            <span className="text-sm font-medium">{d.name ?? d.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground uppercase">{d.fileType ?? 'other'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatRelativeTime(d.createdAt ?? d.uploadedAt ?? d.uploadTime)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${cfg.bgColor ?? ''} ${cfg.color ?? ''} text-[10px]`}>
                            {d.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            {cfg.label ?? d.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteDocument(d.id)} disabled={deleteDocumentMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Upload Dialog */}
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">Upload files for {client.tradeName}</p>
                <div className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer relative">
                  <CloudUpload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium">Click to browse files</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, Excel, CSV, JSON</p>
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" multiple accept=".pdf,.xlsx,.xls,.csv,.json" onChange={handleUpload} onClick={e => { e.currentTarget.value = ''; }} />
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            RETURNS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="returns" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">GST Returns ({returns.length})</h3>
            <Button onClick={() => setAddReturnOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm"><Plus className="h-3.5 w-3.5" /> Prepare Return</Button>
          </div>

          {filingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : returns.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No GST returns prepared."
              description="Prepare a GSTR-1 or GSTR-3B return for this client."
              action={{ label: 'Prepare Return', onClick: () => setAddReturnOpen(true), variant: 'outline', icon: Plus }}
            />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Return Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((r: any) => {
                    const cfg = FILING_STATUS_CONFIG[r.status as keyof typeof FILING_STATUS_CONFIG];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm font-medium">{r.period}</TableCell>
                        <TableCell><Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-xs">{r.returnType}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={`${cfg?.bgColor ?? ''} ${cfg?.color ?? ''} text-[10px]`}>{cfg?.label ?? r.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {r.status === 'draft' && <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleMarkReady(r.id)} disabled={updateFilingStatusMutation.isPending}><CheckCircle2 className="h-3 w-3" /> Mark Ready</Button>}
                            {r.status === 'ready' && <Button size="sm" className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleFileReturn(r.id)} disabled={fileReturnMutation.isPending}><Send className="h-3 w-3" /> File</Button>}
                            {r.status === 'filed' && <span className="text-[10px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Filed</span>}
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => toast.info('JSON download coming soon')}><Download className="h-3 w-3" /> JSON</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add Return Dialog */}
          <Dialog open={addReturnOpen} onOpenChange={setAddReturnOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Prepare Return</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Return Type</Label>
                  <Select value={newRetType} onValueChange={v => setNewRetType(v as ReturnType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="GSTR-1">GSTR-1 (Outward Supplies)</SelectItem><SelectItem value="GSTR-3B">GSTR-3B (Summary Return)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Period</Label><Input type="month" value={newRetPeriod} onChange={e => setNewRetPeriod(e.target.value)} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setAddReturnOpen(false)}>Cancel</Button><Button onClick={handleAddReturn} className="bg-emerald-600 hover:bg-emerald-700" disabled={createFilingMutation.isPending}>{createFilingMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Prepare</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            RECONCILIATION TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="reconciliation" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Reconciliation Runs ({recons.length})</h3>
            <Button onClick={() => setReconOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 gap-2" size="sm"><Play className="h-3.5 w-3.5" /> Run Reconciliation</Button>
          </div>

          {reconLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <Card key={i} className="border-border/60">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <div className="grid grid-cols-3 gap-3">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recons.length === 0 ? (
            <EmptyState
              icon={GitCompareArrows}
              title="No reconciliation data available."
              description="Run a reconciliation to match your books with the GST portal."
              action={{ label: 'Run Reconciliation', onClick: () => setReconOpen(true), variant: 'outline', icon: Play }}
            />
          ) : (
            <div className="space-y-4">
              {recons.map((run: any) => {
                // Get unresolved results for this run
                const runResults = reconResults.filter((r: any) => r.runId === run.id && !r.resolved);
                return (
                  <Card key={run.id} className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-700 text-xs">{run.sources ?? 'GSTR-1'}</Badge>
                          <span className="text-sm font-medium">{run.period}</span>
                        </div>
                        <Badge variant="outline" className={run.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : run.status === 'running' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}>
                          {run.status === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          {run.status?.charAt(0).toUpperCase() + run.status?.slice(1) ?? 'Unknown'}
                        </Badge>
                      </div>

                      {run.status === 'completed' && (
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="bg-emerald-50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-emerald-700">{run.matched}</p>
                            <p className="text-[10px] text-emerald-600 uppercase font-medium">Matched</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-red-700">{run.unmatched ?? run.partialMatches ?? 0}</p>
                            <p className="text-[10px] text-red-600 uppercase font-medium">Mismatched</p>
                          </div>
                          <div className="bg-orange-50 rounded-lg p-3 text-center">
                            <p className="text-lg font-bold text-orange-700">{(run.unmatched ?? 0) - (run.partialMatches ?? 0) > 0 ? (run.unmatched ?? 0) - (run.partialMatches ?? 0) : run.highRisk ?? 0}</p>
                            <p className="text-[10px] text-orange-600 uppercase font-medium">Missing</p>
                          </div>
                        </div>
                      )}

                      {runResults.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Unresolved Mismatches ({runResults.length})</p>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {runResults.map((mm: any) => (
                              <div key={mm.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  <span className="font-mono">{mm.invoice?.invoiceNumber ?? mm.invoiceId ?? '—'}</span>
                                  <Badge variant="outline" className="text-[10px]">{MATCH_STATUS_CONFIG[mm.matchStatus as keyof typeof MATCH_STATUS_CONFIG]?.label ?? mm.matchStatus}</Badge>
                                </div>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => handleResolveMismatch(mm.id)} disabled={updateReconWorkflowMutation.isPending}>
                                  <CheckCircle2 className="h-3 w-3" /> Resolve
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Run Reconciliation Dialog */}
          <Dialog open={reconOpen} onOpenChange={setReconOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Run Reconciliation</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Return Type</Label>
                  <Select value={reconType} onValueChange={v => setReconType(v as ReturnType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="GSTR-1">GSTR-1 vs GSTR-2B</SelectItem><SelectItem value="GSTR-3B">GSTR-3B vs Books</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Period</Label><Input type="month" value={reconPeriod} onChange={e => setReconPeriod(e.target.value)} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setReconOpen(false)}>Cancel</Button><Button onClick={handleRunRecon} className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={createReconRunMutation.isPending}>{createReconRunMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            ACTIVITY TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <h3 className="text-sm font-medium text-muted-foreground">Activity Timeline</h3>

          {activitiesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : acts.length === 0 ? (
            <EmptyState icon={Activity} title="No activity recorded." description="Actions will appear here as you work with this client." />
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[14px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-0">
                {acts.map((a: any, i: number) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-3 py-3 relative"
                  >
                    <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 z-10 ${getActivityColor(a.action ?? '')}`}>
                      {getActivityIcon(a.action ?? '')}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm text-foreground">{a.details ?? a.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(a.timestamp)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ EDIT CLIENT DIALOG ═══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-emerald-600" /> Edit Client</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Business Name</Label><Input value={ef.tradeName} onChange={e => setEf(f => ({ ...f, tradeName: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>GSTIN</Label><Input value={ef.gstin} onChange={e => setEf(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} maxLength={15} className="font-mono" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>State</Label>
                <Select value={ef.state} onValueChange={v => setEf(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Filing Frequency</Label>
                <Select value={ef.returnPeriod} onValueChange={v => setEf(f => ({ ...f, returnPeriod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Email</Label><Input type="email" value={ef.contactEmail} onChange={e => setEf(f => ({ ...f, contactEmail: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Phone</Label><Input value={ef.contactPhone} onChange={e => setEf(f => ({ ...f, contactPhone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-700" disabled={updateClientMutation.isPending}>{updateClientMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
