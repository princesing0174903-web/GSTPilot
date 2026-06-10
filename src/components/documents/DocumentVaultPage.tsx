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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FolderLock,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  File,
  ImageIcon,
  Download,
  Eye,
  History,
  Plus,
  HardDrive,
  CalendarDays,
  Tag,
  X,
  CheckCircle2,
  Loader2,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';

// ─── Color Palette (Emerald theme) ────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  tealDark: '#0d9488',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
  purple: '#8b5cf6',
  blue: '#3b82f6',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface DocumentItem {
  id: string;
  clientId: string | null;
  folder: string;
  name: string;
  fileType: string;
  size: number;
  path: string | null;
  tags: string | null;
  description: string | null;
  uploadedBy: string | null;
  version: number;
  isLatest: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; tradeName: string } | null;
}

interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Folder config ─────────────────────────────────────────────────────────
const FOLDERS = [
  { value: 'all', label: 'All Documents', icon: FolderOpen },
  { value: 'invoices', label: 'Invoices', icon: FileText },
  { value: 'returns', label: 'Returns', icon: FileText },
  { value: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { value: 'client-documents', label: 'Client Documents', icon: FolderOpen },
  { value: 'notices', label: 'Notices', icon: AlertCircle },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeColor(type: string): string {
  const t = type.toLowerCase();
  if (t === 'pdf') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  if (['xlsx', 'xls', 'csv'].includes(t)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
  if (['docx', 'doc'].includes(t)) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(t)) return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400';
  if (['pptx', 'ppt'].includes(t)) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
}

function getFileTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'pdf') return <FileText className="h-6 w-6 text-red-500" />;
  if (['xlsx', 'xls', 'csv'].includes(t)) return <FileSpreadsheet className="h-6 w-6 text-emerald-500" />;
  if (['docx', 'doc'].includes(t)) return <File className="h-6 w-6 text-blue-500" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(t)) return <ImageIcon className="h-6 w-6 text-purple-500" />;
  return <File className="h-6 w-6 text-slate-500" />;
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

// ─── Animated Card Wrapper ─────────────────────────────────────────────────
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

function DocumentCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border/30 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DocumentVaultPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    clientId: '',
    folder: 'general',
    name: '',
    fileType: 'pdf',
    tags: '',
    description: '',
  });

  // Version history dialog
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionDoc, setVersionDoc] = useState<DocumentItem | null>(null);
  const [versions, setVersions] = useState<DocumentItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Upload success
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [docRes, clientRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/clients'),
      ]);

      if (docRes.ok) {
        const docData = await docRes.json();
        setDocuments(docData.documents ?? []);
      } else {
        setError('Failed to fetch documents');
      }

      if (clientRes.ok) {
        const clientData = await clientRes.json();
        setClients(
          (clientData.clients ?? []).map((c: { id: string; tradeName: string; gstin: string }) => ({
            id: c.id,
            tradeName: c.tradeName,
            gstin: c.gstin,
          }))
        );
      }
    } catch (err) {
      console.error('DocumentVault fetch error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered documents ───────────────────────────────────────────────────
  const filteredDocuments = documents.filter((doc) => {
    const matchesFolder = activeFolder === 'all' || doc.folder === activeFolder;
    if (!matchesFolder) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.name.toLowerCase().includes(q) ||
      (doc.description && doc.description.toLowerCase().includes(q)) ||
      (doc.tags && doc.tags.toLowerCase().includes(q))
    );
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalDocs = documents.length;
  const totalStorage = documents.reduce((sum, d) => sum + d.size, 0);
  const now = new Date();
  const docsThisMonth = documents.filter((d) => {
    const created = new Date(d.createdAt);
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const animTotalDocs = useAnimatedNumber(totalDocs);
  const animDocsThisMonth = useAnimatedNumber(docsThisMonth);

  // ── Upload handler ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadForm.name.trim()) return;
    try {
      setUploading(true);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadForm,
          size: Math.floor(Math.random() * 500000) + 10000,
          tags: uploadForm.tags,
          uploadedBy: 'current-user',
        }),
      });
      if (res.ok) {
        setUploadSuccess(true);
        setTimeout(() => {
          setUploadOpen(false);
          setUploadSuccess(false);
          setUploadForm({
            clientId: '',
            folder: 'general',
            name: '',
            fileType: 'pdf',
            tags: '',
            description: '',
          });
          fetchData();
        }, 1200);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // ── Version history handler ──────────────────────────────────────────────
  const handleViewVersions = async (doc: DocumentItem) => {
    setVersionDoc(doc);
    setVersionOpen(true);
    setVersionsLoading(true);

    try {
      // Find root parent id
      let rootId = doc.id;
      if (doc.parentId) rootId = doc.parentId;

      // Fetch all versions: the document itself + children
      const res = await fetch(`/api/documents?search=`);
      if (res.ok) {
        const data = await res.json();
        const allDocs: DocumentItem[] = data.documents ?? [];
        // Find all docs in the same version chain
        const versionChain = allDocs.filter(
          (d) => d.id === rootId || d.parentId === rootId || d.id === doc.id || d.parentId === doc.id
        );
        // Sort by version
        versionChain.sort((a, b) => a.version - b.version);
        setVersions(versionChain.length > 0 ? versionChain : [doc]);
      } else {
        setVersions([doc]);
      }
    } catch {
      setVersions([doc]);
    } finally {
      setVersionsLoading(false);
    }
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
              Secure document repository for your firm
            </p>
          </div>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </motion.div>

      {/* ═══ SEARCH BAR ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="relative max-w-md"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, description, or tags..."
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
      </motion.div>

      {/* ═══ STATS ROW ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AnimatedCard delay={0.05}>
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
                    Total Documents
                  </p>
                  <p className="text-xl font-bold text-foreground">{formatNumber(animTotalDocs)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>

        <AnimatedCard delay={0.1}>
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
                    Storage Used
                  </p>
                  <p className="text-xl font-bold text-foreground">{formatFileSize(totalStorage)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>

        <AnimatedCard delay={0.15}>
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
                  <p className="text-xl font-bold text-foreground">{formatNumber(animDocsThisMonth)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </AnimatedCard>
      </div>

      {/* ═══ FOLDER TABS + DOCUMENT GRID ═══ */}
      <AnimatedCard delay={0.2} className="overflow-hidden">
        <CardContent className="p-0">
          <Tabs
            value={activeFolder}
            onValueChange={setActiveFolder}
            className="w-full"
          >
            <div className="border-b border-border/50 px-4 pt-4">
              <TabsList className="bg-muted/50 h-auto flex-wrap gap-1 p-1">
                {FOLDERS.map((folder) => (
                  <TabsTrigger
                    key={folder.value}
                    value={folder.value}
                    className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-400 text-xs px-3 py-1.5"
                  >
                    <folder.icon className="h-3.5 w-3.5 mr-1.5" />
                    {folder.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* All tabs share the same content, filtered by activeFolder */}
            {FOLDERS.map((folder) => (
              <TabsContent key={folder.value} value={folder.value} className="mt-0">
                <div className="p-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 mb-4">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchData}
                        className="ml-auto text-xs text-red-600 hover:text-red-700"
                      >
                        Retry
                      </Button>
                    </div>
                  )}

                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <DocumentCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : filteredDocuments.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
                        <FolderOpen className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        No documents found
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        {searchQuery
                          ? `No documents match "${searchQuery}"`
                          : 'Upload your first document to get started'}
                      </p>
                      {!searchQuery && (
                        <Button
                          onClick={() => setUploadOpen(true)}
                          variant="outline"
                          className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                          <Plus className="h-4 w-4" />
                          Upload Document
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence>
                        {filteredDocuments.map((doc, index) => (
                          <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.04, duration: 0.35 }}
                            whileHover={{ y: -2 }}
                            className="group p-4 rounded-xl border border-border/30 hover:border-emerald-200/60 dark:hover:border-emerald-800/50 hover:shadow-md hover:shadow-emerald-500/5 transition-all cursor-pointer bg-card/50"
                          >
                            {/* Top: icon + name */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted/50 shrink-0">
                                {getFileTypeIcon(doc.fileType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate" title={doc.name}>
                                  {doc.name}
                                </p>
                                {doc.client && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {doc.client.tradeName}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* File type badge + version */}
                            <div className="flex items-center gap-2 mb-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0 border-0 font-semibold ${getFileTypeColor(doc.fileType)}`}
                              >
                                {doc.fileType.toUpperCase()}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0 border-border/30 text-muted-foreground font-medium"
                              >
                                v{doc.version}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {formatFileSize(doc.size)}
                              </span>
                            </div>

                            {/* Tags */}
                            {doc.tags && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {doc.tags.split(',').slice(0, 3).map((tag, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-emerald-200/50 text-emerald-600 dark:border-emerald-800/50 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                                  >
                                    <Tag className="h-2.5 w-2.5 mr-0.5" />
                                    {tag.trim()}
                                  </Badge>
                                ))}
                                {doc.tags.split(',').length > 3 && (
                                  <span className="text-[10px] text-muted-foreground self-center">
                                    +{doc.tags.split(',').length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Date + Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/20">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(doc.createdAt)}
                              </span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                                  title="Preview"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewVersions(doc);
                                  }}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                                  title="Version History"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Results count */}
                  {!loading && filteredDocuments.length > 0 && (
                    <div className="mt-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredDocuments.length} of {documents.length} documents
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </AnimatedCard>

      {/* ═══ UPLOAD DOCUMENT DIALOG ═══ */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-500" />
              Upload Document
            </DialogTitle>
            <DialogDescription>
              Add a new document to the vault
            </DialogDescription>
          </DialogHeader>

          {uploadSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-lg font-semibold text-foreground">Document Uploaded!</p>
              <p className="text-sm text-muted-foreground mt-1">Your document has been added to the vault.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select
                  value={uploadForm.clientId}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, clientId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tradeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Folder</Label>
                <Select
                  value={uploadForm.folder}
                  onValueChange={(v) => setUploadForm((f) => ({ ...f, folder: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLDERS.filter((f) => f.value !== 'all').map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Document Name *</Label>
                <Input
                  placeholder="e.g. GSTR-1 Return Q3 2025"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>File Type</Label>
                  <Select
                    value={uploadForm.fileType}
                    onValueChange={(v) => setUploadForm((f) => ({ ...f, fileType: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['pdf', 'xlsx', 'docx', 'jpg', 'png', 'csv', 'pptx'].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <Input
                    placeholder="gst, return, quarterly"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm((f) => ({ ...f, tags: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of the document..."
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}

          {!uploadSuccess && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadForm.name.trim() || uploading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ VERSION HISTORY DIALOG ═══ */}
      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-500" />
              Version History
            </DialogTitle>
            <DialogDescription>
              {versionDoc ? `All versions of "${versionDoc.name}"` : 'Document versions'}
            </DialogDescription>
          </DialogHeader>

          {versionsLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No version history available.
            </p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-2">
                {versions.map((v, index) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 shrink-0">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        v{v.version}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        Version {v.version}
                        {v.isLatest && (
                          <Badge className="ml-2 text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0">
                            Latest
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(v.createdAt)}
                        {v.uploadedBy && ` by ${v.uploadedBy}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600 shrink-0"
                      title="Download this version"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
