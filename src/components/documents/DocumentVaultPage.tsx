'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  FolderLock,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  File,
  ImageIcon,
  Download,
  Plus,
  HardDrive,
  CalendarDays,
  Tag,
  X,
  CheckCircle2,
  Loader2,
  Inbox,
  AlertCircle,
  Trash2,
  CloudUpload,
  FileCheck2,
  FileWarning,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/gst-utils';
import {
  useUploadedFiles,
  useClients,
  useUploadFile,
} from '@/hooks/api';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ─────────────────────────────────────────────────────────────────
interface UploadedFileItem {
  id: string;
  clientId: string | null;
  originalName: string;
  storedName: string;
  fileType: string;
  fileSize: number;
  mimeType: string | null;
  filePath: string | null;
  status: string;
  processingStep: string;
  progress: number;
  extractedData: string | null;
  errorMessage: string | null;
  invoicesCreated: number;
  errorsCount: number;
  warningsCount: number;
  period: string | null;
  tags: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; tradeName: string } | null;
}

interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Status Configuration ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
  spinIcon?: boolean;
}> = {
  uploading: {
    label: 'Uploading...',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    icon: Loader2,
    spinIcon: true,
  },
  uploaded: {
    label: 'Uploaded',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    icon: Loader2,
    spinIcon: true,
  },
  extracting: {
    label: 'Extracting...',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    icon: Loader2,
    spinIcon: true,
  },
  validating: {
    label: 'Validating...',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800',
    icon: Loader2,
    spinIcon: true,
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
    icon: AlertCircle,
  },
};

function getStatusConfig(status: string, processingStep: string) {
  // Map processingStep to the status for display
  if (processingStep === 'uploading') return STATUS_CONFIG.uploading;
  if (processingStep === 'extracting') return STATUS_CONFIG.extracting;
  if (processingStep === 'validating') return STATUS_CONFIG.validating;
  if (processingStep === 'completed' || status === 'completed') return STATUS_CONFIG.completed;
  if (processingStep === 'failed' || status === 'failed') return STATUS_CONFIG.failed;
  // Fallback based on status
  if (STATUS_CONFIG[status]) return STATUS_CONFIG[status];
  return STATUS_CONFIG.uploaded;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
  if (['xlsx', 'xls', 'excel'].includes(t)) return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
  if (t === 'csv') return <FileSpreadsheet className="h-5 w-5 text-teal-500" />;
  if (t === 'json') return <File className="h-5 w-5 text-amber-500" />;
  if (['jpg', 'jpeg', 'png', 'image'].includes(t)) return <ImageIcon className="h-5 w-5 text-purple-500" />;
  return <File className="h-5 w-5 text-slate-500" />;
}

function getFileTypeBadgeColor(type: string): string {
  const t = type.toLowerCase();
  if (t === 'pdf') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  if (['xlsx', 'xls', 'excel'].includes(t)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
  if (t === 'csv') return 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400';
  if (t === 'json') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
  if (['jpg', 'jpeg', 'png', 'image'].includes(t)) return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
}

function getFileTypeDisplay(type: string): string {
  const t = type.toLowerCase();
  if (t === 'excel') return 'XLSX';
  return t.toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// Period helper — generates last 12 months
function getPeriodOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleString('en-IN', { month: 'short' });
    options.push(`${month} ${d.getFullYear()}`);
  }
  return options;
}

// ─── Animated Number Hook ──────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration: number = 1200) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const startValue = current;

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    }

    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration]);

  return current;
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border/30">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

function FileRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border/30">
      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DocumentVaultPage() {
  const queryClient = useQueryClient();

  // ── React Query data hooks ──
  const { data: filesData, isLoading: filesLoading, error: filesError } = useUploadedFiles(undefined, {
    refetchInterval: (query) => {
      const files = (query.state.data as { files: UploadedFileItem[] } | undefined)?.files ?? [];
      const hasProcessing = files.some(
        f => f.status === 'uploaded' ||
             f.status === 'processing' ||
             f.processingStep === 'uploading' ||
             f.processingStep === 'extracting' ||
             f.processingStep === 'validating'
      );
      return hasProcessing ? 3000 : false;
    },
  });
  const { data: clientsData, isLoading: clientsLoading } = useClients();

  // ── Derived data ──
  const files: UploadedFileItem[] = (filesData?.files ?? []) as UploadedFileItem[];
  const clients: ClientOption[] = (clientsData?.clients ?? []).map((c: any) => ({
    id: c.id,
    tradeName: c.tradeName,
    gstin: c.gstin,
  }));
  const loading = filesLoading || clientsLoading;
  const error = filesError ? (filesError instanceof Error ? filesError.message : 'Failed to fetch files') : null;

  // ── State ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  // ── File upload mutation ──
  const uploadMutation = useUploadFile();

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/upload?id=${fileId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('File deleted successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file');
    },
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalFiles = files.length;
  const totalStorage = files.reduce((sum, f) => sum + f.fileSize, 0);
  const completedCount = files.filter(f => f.status === 'completed').length;
  const processingCount = files.filter(
    f => f.status !== 'completed' && f.status !== 'failed'
  ).length;
  const invoicesExtracted = files.reduce((sum, f) => sum + (f.invoicesCreated || 0), 0);
  const now = new Date();
  const filesThisMonth = files.filter((f) => {
    const created = new Date(f.createdAt);
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const animTotalFiles = useAnimatedNumber(totalFiles);
  const animFilesThisMonth = useAnimatedNumber(filesThisMonth);

  // ── Filtered files ──
  const filteredFiles = files.filter((file) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      file.originalName.toLowerCase().includes(q) ||
      (file.tags && file.tags.toLowerCase().includes(q)) ||
      (file.client?.tradeName && file.client.tradeName.toLowerCase().includes(q))
    );
  });

  // ── Upload handlers ──────────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    const acceptedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf',
      'application/json',
      'image/jpeg',
      'image/png',
    ];
    const acceptedExtensions = ['.xlsx', '.xls', '.csv', '.pdf', '.json', '.jpg', '.jpeg', '.png'];

    for (const file of filesToUpload) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
      const isAccepted =
        acceptedTypes.includes(file.type) ||
        acceptedExtensions.includes(ext);

      if (!isAccepted) {
        toast.error(`Unsupported file type: ${file.name}`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (selectedClientId) formData.append('clientId', selectedClientId);
      if (selectedPeriod) formData.append('period', selectedPeriod);

      setUploadingFiles(prev => new Set(prev).add(file.name));

      uploadMutation.mutate(formData, {
        onSuccess: () => {
          toast.success(`${file.name} uploaded successfully`);
        },
        onError: (err) => {
          toast.error(`Failed to upload ${file.name}: ${err.message}`);
        },
        onSettled: () => {
          setUploadingFiles(prev => {
            const next = new Set(prev);
            next.delete(file.name);
            return next;
          });
        },
      });
    }
  }, [selectedClientId, selectedPeriod, uploadMutation]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      handleFileUpload(selectedFiles);
    }
    e.target.value = '';
  };

  const handleDelete = (fileId: string, fileName: string) => {
    deleteMutation.mutate(fileId);
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
            <FolderLock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Document Vault
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload &amp; process GST documents, invoices, and returns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {processingCount > 0 && (
            <Badge className="gap-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
              <Loader2 className="h-3 w-3 animate-spin" />
              {processingCount} processing
            </Badge>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </motion.div>

      {/* ═══ UPLOAD ZONE ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-4 md:p-6">
            {/* Client & Period selectors */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Assign to Client (optional)</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                >
                  <SelectTrigger className="w-full border-border/50 focus:border-emerald-300 dark:focus:border-emerald-700">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tradeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Period (optional)</Label>
                <Select
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger className="w-full border-border/50 focus:border-emerald-300 dark:focus:border-emerald-700">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPeriodOptions().map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <motion.div
              animate={isDragging ? { scale: 1.005 } : { scale: 1 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer
                ${isDragging
                  ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20'
                  : 'border-border/50 bg-gradient-to-br from-slate-50/80 via-white to-emerald-50/20 dark:from-slate-900/50 dark:via-card dark:to-emerald-950/10 hover:border-emerald-300 dark:hover:border-emerald-700'
                }
              `}
            >
              <div className="py-8 md:py-10 px-4 flex flex-col items-center text-center">
                <div className={`
                  h-14 w-14 rounded-2xl flex items-center justify-center mb-3 transition-colors
                  ${isDragging
                    ? 'bg-emerald-100 dark:bg-emerald-900/40'
                    : 'bg-muted/50'
                  }
                `}>
                  <CloudUpload className={`h-7 w-7 transition-colors ${isDragging ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {isDragging ? 'Drop files here to upload' : 'Drag & drop files here, or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports Excel (.xlsx), CSV, PDF, JSON, and Images (.jpg, .png)
                </p>
                {uploadingFiles.size > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Uploading {uploadingFiles.size} file{uploadingFiles.size > 1 ? 's' : ''}...
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.json,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ STATS ROW ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <CardContent className="p-4">
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                    <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Files
                    </p>
                    <p className="text-xl font-bold text-foreground">{formatNumber(animTotalFiles)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <CardContent className="p-4">
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50">
                    <HardDrive className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Storage
                    </p>
                    <p className="text-xl font-bold text-foreground">{formatFileSize(totalStorage)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <CardContent className="p-4">
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
                    <FileCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Processed
                    </p>
                    <p className="text-xl font-bold text-foreground">{completedCount}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
            <CardContent className="p-4">
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50">
                    <CalendarDays className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      This Month
                    </p>
                    <p className="text-xl font-bold text-foreground">{formatNumber(animFilesThisMonth)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ FILE LIST ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Uploaded Files</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {invoicesExtracted > 0
                    ? `${invoicesExtracted} invoice${invoicesExtracted !== 1 ? 's' : ''} extracted across all files`
                    : 'Upload files to extract and process invoices'
                  }
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-border/50 focus:border-emerald-300 dark:focus:border-emerald-700"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 mb-4">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-auto text-xs text-red-600 hover:text-red-700"
                >
                  Retry
                </Button>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <FileRowSkeleton key={i} />
                ))}
              </div>
            ) : files.length === 0 ? (
              /* ═══ EMPTY STATE ═══ */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
                  <Inbox className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  No documents uploaded
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Upload GST documents, invoices, or returns to start processing.
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                >
                  <Upload className="h-4 w-4" />
                  Upload Documents
                </Button>
              </motion.div>
            ) : filteredFiles.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  No files found
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? `No files match "${searchQuery}"` : 'No files to display'}
                </p>
              </motion.div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-2 pr-1">
                  <AnimatePresence>
                    {filteredFiles.map((file, index) => {
                      const statusCfg = getStatusConfig(file.status, file.processingStep);
                      const StatusIcon = statusCfg.icon;
                      const isProcessing = file.status !== 'completed' && file.status !== 'failed';
                      const progressValue = file.progress ?? 0;

                      return (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.03, duration: 0.3 }}
                          className={`
                            group flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-all
                            ${isProcessing
                              ? 'border-amber-200/50 bg-amber-50/30 dark:border-amber-800/30 dark:bg-amber-950/10'
                              : file.status === 'failed'
                                ? 'border-red-200/50 bg-red-50/20 dark:border-red-800/30 dark:bg-red-950/10'
                                : 'border-border/30 hover:border-emerald-200/60 dark:hover:border-emerald-800/50 hover:shadow-md hover:shadow-emerald-500/5 bg-card/50'
                            }
                          `}
                        >
                          {/* File icon */}
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted/50 shrink-0">
                            {getFileTypeIcon(file.fileType)}
                          </div>

                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold text-foreground truncate" title={file.originalName}>
                                {file.originalName}
                              </p>
                              {file.invoicesCreated > 0 && (
                                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0 shrink-0">
                                  {file.invoicesCreated} invoice{file.invoicesCreated !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0 border-0 font-semibold ${getFileTypeBadgeColor(file.fileType)}`}
                              >
                                {getFileTypeDisplay(file.fileType)}
                              </Badge>
                              {file.client && (
                                <span className="text-[10px] text-muted-foreground">
                                  {file.client.tradeName}
                                </span>
                              )}
                              {file.period && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {file.period}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {formatFileSize(file.fileSize)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(file.createdAt)} {formatTime(file.createdAt)}
                              </span>
                            </div>

                            {/* Processing progress bar */}
                            {isProcessing && (
                              <div className="mt-2">
                                <Progress value={progressValue} className="h-1.5" />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {statusCfg.label} {progressValue}%
                                </p>
                              </div>
                            )}

                            {/* Error message */}
                            {file.status === 'failed' && file.errorMessage && (
                              <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                                {file.errorMessage}
                              </p>
                            )}

                            {/* Tags */}
                            {file.tags && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {file.tags.split(',').slice(0, 4).map((tag, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 border-emerald-200/50 text-emerald-600 dark:border-emerald-800/50 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                                  >
                                    <Tag className="h-2 w-2 mr-0.5" />
                                    {tag.trim()}
                                  </Badge>
                                ))}
                                {file.tags.split(',').length > 4 && (
                                  <span className="text-[9px] text-muted-foreground self-center">
                                    +{file.tags.split(',').length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Status badge + actions */}
                          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                            <Badge className={`text-[10px] px-2.5 py-0.5 border font-medium ${statusCfg.badgeClass}`}>
                              <StatusIcon className={`h-3 w-3 mr-1 ${statusCfg.spinIcon ? 'animate-spin' : ''}`} />
                              {statusCfg.label}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file.id, file.originalName);
                              }}
                              disabled={deleteMutation.isPending}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}

            {/* Results count */}
            {!loading && filteredFiles.length > 0 && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Showing {filteredFiles.length} of {files.length} file{files.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
