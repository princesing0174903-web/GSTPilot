'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Upload,
  Download,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ChevronRight,
  X,
  FileSpreadsheet,
  FileImage,
  File,
  Zap,
  Shield,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, periodToLabel, validateGSTIN } from '@/lib/gst-utils';
import {
  GSTRFiling,
  Invoice,
  Client,
  FILING_STATUS_CONFIG,
  GSTR1Section,
  GSTR1_SECTION_LABELS,
  FilingStatus,
} from '@/types/gst';
import { useFireReturns, useFireClients, useFireInvoices } from '@/hooks/use-firestore';
import type { FirestoreReturn, FirestoreClient, FirestoreInvoice } from '@/lib/firestore-schema';
import { createReturn, fileReturn } from '@/lib/firestore-service';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDocuments } from '@/hooks/useDocuments';
import { validateFile } from '@/lib/firebase/storage-service';

// ─── Constants ─────────────────────────────────────────────────────────────────

const FINANCIAL_YEARS = [
  '2024-25',
  '2023-24',
  '2022-23',
];

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const QUARTERS = [
  { value: 'Q1', label: 'Q1 (Apr-Jun)' },
  { value: 'Q2', label: 'Q2 (Jul-Sep)' },
  { value: 'Q3', label: 'Q3 (Oct-Dec)' },
  { value: 'Q4', label: 'Q4 (Jan-Mar)' },
];

const RETURN_TYPES = ['GSTR-1', 'GSTR-3B', 'GSTR-9', 'GSTR-9C'] as const;

const STATUS_BADGE_MAP: Record<string, { color: string; bgColor: string; label: string }> = {
  filed: { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', label: 'Filed' },
  generated: { color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', label: 'Ready' },
  reviewed: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', label: 'In Progress' },
  validated: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', label: 'In Progress' },
  prepared: { color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', label: 'In Progress' },
  draft: { color: 'text-slate-600', bgColor: 'bg-slate-100 border-slate-200', label: 'Draft' },
  reopened: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', label: 'Reopened' },
  overdue: { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', label: 'Overdue' },
};

const SECTION_BREAKDOWN_LABELS: Record<string, string> = {
  b2b: 'B2B Invoices',
  b2cl: 'B2C Large',
  b2cs: 'B2C Small',
  cdnr: 'CDNR',
  cdnur: 'CDNUR',
  exp: 'Exports',
};

// ─── Types ──────────────────────────────────────────────────────────────────────

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
}

interface ExtractedInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  buyerGstin: string;
  buyerName: string;
  invoiceType: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  hsnCode: string;
  gstr1Section: GSTR1Section;
  gstinValid: boolean;
  hsnValid: boolean;
  taxComputationValid: boolean;
}

type QuickFileStep = 1 | 2 | 3 | 4;

// ─── Animation variants ─────────────────────────────────────────────────────────

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const tabContent = {
  hidden: { opacity: 0, x: 12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2 } },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileSpreadsheet className="size-5 text-emerald-600" />;
  if (type.includes('image')) return <FileImage className="size-5 text-teal-600" />;
  if (type.includes('pdf')) return <FileText className="size-5 text-red-500" />;
  return <File className="size-5 text-slate-500" />;
}

function getOverdueFilings(filings: GSTRFiling[]): Set<string> {
  const now = new Date();
  const overdueIds = new Set<string>();
  filings.forEach((f) => {
    if (f.status !== 'filed' && f.status !== 'reopened') {
      const [year, month] = f.period.split('-').map(Number);
      if (year && month) {
        const dueDate = new Date(year, month, 11);
        if (now > dueDate) overdueIds.add(f.id);
      }
    }
  });
  return overdueIds;
}

// ─── Firestore mappers (Phase 1 migration) ──────────────────────────────────

type FireReturn = FirestoreReturn & { id: string };
type FireClient = FirestoreClient & { id: string };
type FireInvoice = FirestoreInvoice & { id: string };

function mapFireClient(c: FireClient): Client {
  return {
    id: c.clientId,
    gstin: c.gstin,
    tradeName: c.tradeName,
    legalName: c.legalName,
    address: c.address ?? undefined,
    state: c.state ?? undefined,
    stateCode: c.stateCode ?? undefined,
    contactEmail: c.contactEmail ?? undefined,
    contactPhone: c.contactPhone ?? undefined,
    entityType: c.entityType,
    returnPeriod: c.returnPeriod ?? undefined,
    lastFilingDate: c.lastFilingDate ?? undefined,
    status: c.status,
    healthScore: c.healthScore,
    createdAt: (c.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (c.updatedAt as string) ?? new Date().toISOString(),
  };
}

function mapReturnToFiling(r: FireReturn, clients: Client[]): GSTRFiling {
  return {
    id: r.returnId,
    clientId: r.clientId,
    returnType: r.returnType,
    period: r.period,
    financialYear: r.financialYear,
    status: r.status,
    filedDate: r.filedDate ?? undefined,
    acknowledgmentNumber: r.acknowledgmentNumber ?? undefined,
    totalInvoices: r.totalInvoices,
    readyForFiling: r.readyForFiling,
    issuesFound: r.issuesFound,
    criticalErrors: r.criticalErrors,
    warnings: r.warnings,
    totalTaxableValue: r.totalTaxableValue,
    totalTax: r.totalTax,
    jsonPayload: r.jsonPayload ?? undefined,
    createdAt: (r.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (r.updatedAt as string) ?? new Date().toISOString(),
    client: clients.find((c) => c.id === r.clientId),
  };
}

function mapFireInvoice(i: FireInvoice): Invoice {
  return {
    id: i.invoiceId,
    clientId: i.clientId,
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate,
    sellerGstin: i.sellerGstin,
    buyerGstin: i.buyerGstin ?? undefined,
    buyerName: i.buyerName ?? undefined,
    invoiceType: i.invoiceType,
    gstr1Section: i.gstr1Section,
    taxableValue: i.taxableValue,
    cgst: i.cgst,
    sgst: i.sgst,
    igst: i.igst,
    cess: i.cess,
    totalAmount: i.totalAmount,
    hsnCode: i.hsnCode ?? undefined,
    reverseCharge: i.reverseCharge,
    status: i.status,
    matchStatus: i.matchStatus,
    riskLevel: i.riskLevel,
    riskScore: i.riskScore,
    aiExplanation: i.aiExplanation ?? undefined,
    notes: i.notes ?? undefined,
    period: i.period ?? undefined,
    createdAt: (i.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (i.updatedAt as string) ?? new Date().toISOString(),
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function GSTRFilingPage() {
  const { selectedClientId, setSelectedClientId } = useApp();

  // ─── Firebase Storage uploads (real) ─────────────────────────────────────
  // useDocuments() handles org-scoped upload to Firebase Storage + writes
  // metadata to Firestore. The `uploads` array gives us live per-file progress
  // so we can render real progress bars instead of the old setInterval mock.
  const {
    uploads: liveUploads,
    uploadMany,
    clearUploads,
  } = useDocuments();

  // ─── Firestore data (real-time) ─────────────────────────────────────────
  const {
    data: returnDocs,
    loading: returnsLoading,
    error: returnsError,
  } = useFireReturns();
  const {
    data: clientDocs,
    loading: clientsLoading,
    error: clientsError,
  } = useFireClients();
  // Per-client invoices used in the Quick File “Extract Data” step. When no
  // client is selected we keep the array empty (the hook still subscribes firm-
  // wide, but we ignore the data until a client is picked).
  const [quickFileClientId, setQuickFileClientId] = useState<string>('');
  const {
    data: invoiceDocs,
    loading: invoiceDocsLoading,
    error: invoicesError,
  } = useFireInvoices(quickFileClientId || null);

  // ─── Data state ──────────────────────────────────────────────────────────
  const [isFiling, setIsFiling] = useState(false);
  const [isGeneratingJSON, setIsGeneratingJSON] = useState(false);
  const [currentReturnId, setCurrentReturnId] = useState<string | null>(null);

  // Map Firestore docs → local types
  const clients = useMemo<Client[]>(
    () => (clientDocs as unknown as FireClient[]).map(mapFireClient),
    [clientDocs],
  );
  const filings = useMemo<GSTRFiling[]>(
    () => (returnDocs as unknown as FireReturn[]).map((r) => mapReturnToFiling(r, clients)),
    [returnDocs, clients],
  );
  const clientInvoices = useMemo<Invoice[]>(
    () =>
      quickFileClientId
        ? (invoiceDocs as unknown as FireInvoice[]).map(mapFireInvoice)
        : [],
    [invoiceDocs, quickFileClientId],
  );

  const loading = returnsLoading || clientsLoading;
  const invoicesLoading = quickFileClientId ? invoiceDocsLoading : false;
  const error = returnsError || clientsError || invoicesError;

  // ─── Filter state ────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterReturnType, setFilterReturnType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFY, setSelectedFY] = useState<string>('2024-25');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // ─── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('all-returns');

  // ─── Quick File state ────────────────────────────────────────────────────
  const [quickFileStep, setQuickFileStep] = useState<QuickFileStep>(1);
  const [quickFileReturnType, setQuickFileReturnType] = useState<string>('GSTR-1');
  const [quickFilePeriod, setQuickFilePeriod] = useState<string>('');
  const [extractedInvoices, setExtractedInvoices] = useState<ExtractedInvoice[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // ─── Upload UI state ──────────────────────────────────────────────────────
  // The hook's `liveUploads` array is the source of truth for upload progress.
  // We keep two small pieces of UI-only state:
  //   • fileMetaByName — file.type / file.size cache (UploadEntry only stores
  //     fileName + bytes), so we can render the right file icon.
  //   • hiddenUploadIds — ids the user has dismissed with the X button, so the
  //     live entry stays in the hook's state but is hidden from this list.
  const [fileMetaByName, setFileMetaByName] = useState<Map<string, { type: string; size: number }>>(new Map());
  const [hiddenUploadIds, setHiddenUploadIds] = useState<Set<string>>(new Set());

  const uploadedFiles: UploadedFile[] = useMemo(() => {
    return liveUploads
      .filter((u) => !hiddenUploadIds.has(u.id))
      .map((u) => {
        const meta = fileMetaByName.get(u.fileName);
        return {
          id: u.id,
          name: u.fileName,
          size: meta?.size ?? u.totalBytes,
          type: meta?.type ?? '',
          progress: u.progress,
          status:
            u.state === 'uploading'
              ? 'uploading'
              : u.state === 'success'
                ? 'done'
                : 'error',
        };
      });
  }, [liveUploads, fileMetaByName, hiddenUploadIds]);

  // ─── Dialog state ────────────────────────────────────────────────────────
  const [newReturnOpen, setNewReturnOpen] = useState(false);
  const [newReturnClientId, setNewReturnClientId] = useState<string>('');
  const [newReturnType, setNewReturnType] = useState<string>('GSTR-1');
  const [newReturnPeriod, setNewReturnPeriod] = useState<string>('');
  const [newReturnFY, setNewReturnFY] = useState<string>('2024-25');
  const [newReturnMonth, setNewReturnMonth] = useState<string>('04');
  const [isCreating, setIsCreating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived data ────────────────────────────────────────────────────────
  const overdueIds = getOverdueFilings(filings);

  const filteredFilings = filings.filter((f) => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'overdue') {
        if (!overdueIds.has(f.id)) return false;
      } else if (f.status !== filterStatus) return false;
    }
    if (filterReturnType !== 'all' && f.returnType !== filterReturnType) return false;
    if (selectedClientId && f.clientId !== selectedClientId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = f.client?.tradeName?.toLowerCase() ?? '';
      if (!clientName.includes(q) && !f.returnType.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filedHistory = filings.filter((f) => f.status === 'filed');

  const filteredClients = clients.filter((c) => {
    if (!clientSearch) return true;
    const q = clientSearch.toLowerCase();
    return (
      c.tradeName.toLowerCase().includes(q) ||
      c.gstin.toLowerCase().includes(q)
    );
  });

  // ─── Quick file: section breakdown ───────────────────────────────────────
  const sectionBreakdown = React.useMemo(() => {
    const sections: Record<string, { count: number; taxableValue: number; totalTax: number }> = {};
    extractedInvoices.forEach((inv) => {
      if (!sections[inv.gstr1Section]) {
        sections[inv.gstr1Section] = { count: 0, taxableValue: 0, totalTax: 0 };
      }
      sections[inv.gstr1Section].count += 1;
      sections[inv.gstr1Section].taxableValue += inv.taxableValue;
      sections[inv.gstr1Section].totalTax += inv.cgst + inv.sgst + inv.igst;
    });
    return sections;
  }, [extractedInvoices]);

  const quickFileTotals = React.useMemo(() => {
    const totalInvoices = extractedInvoices.length;
    const totalTaxable = extractedInvoices.reduce((s, i) => s + i.taxableValue, 0);
    const totalTax = extractedInvoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
    const validCount = extractedInvoices.filter(
      (i) => i.gstinValid && i.hsnValid && i.taxComputationValid
    ).length;
    const warningCount = extractedInvoices.filter(
      (i) => !i.gstinValid || !i.hsnValid || !i.taxComputationValid
    ).length;
    return { totalInvoices, totalTaxable, totalTax, validCount, warningCount };
  }, [extractedInvoices]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleCreateNewReturn = async () => {
    if (!newReturnClientId || !newReturnType) return;
    setIsCreating(true);
    try {
      const period = newReturnPeriod || `${newReturnFY.slice(0, 4)}-${newReturnMonth}`;
      const returnId = await createReturn({
        clientId: newReturnClientId,
        returnType: (newReturnType === 'GSTR-1' || newReturnType === 'GSTR-3B'
          ? newReturnType
          : 'GSTR-1') as 'GSTR-1' | 'GSTR-3B',
        period,
        financialYear: newReturnFY,
        status: 'draft',
        filedDate: null,
        acknowledgmentNumber: null,
        totalInvoices: 0,
        readyForFiling: 0,
        issuesFound: 0,
        criticalErrors: 0,
        warnings: 0,
        totalTaxableValue: 0,
        totalTax: 0,
        jsonPayload: null,
        assignedTo: null,
        reviewedBy: null,
      });
      setCurrentReturnId(returnId);
      setQuickFileClientId(newReturnClientId);
      setQuickFileReturnType(newReturnType);
      setQuickFilePeriod(period);
      setQuickFileStep(1);
      setNewReturnOpen(false);
      setActiveTab('quick-file');
      toast.success('Return created successfully');
    } catch (err) {
      console.error('Failed to create return:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create return');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      // Pre-flight validation (size + type) using the same rules as the
      // storage service — reject the whole batch if any file is invalid.
      for (const f of fileArr) {
        const err = validateFile(f);
        if (err) {
          toast.error(`${f.name}: ${err}`);
          return;
        }
      }

      toast.info(`Uploading ${fileArr.length} file(s) to Firebase Storage...`);

      // Cache file.type / file.size for icon rendering (the hook's UploadEntry
      // only carries fileName + bytes).
      setFileMetaByName((prev) => {
        const next = new Map(prev);
        fileArr.forEach((f) => {
          next.set(f.name, { type: f.type || '', size: f.size });
        });
        return next;
      });

      // Fire the real upload to Firebase Storage under the 'gst' category.
      // The hook tracks live progress in `liveUploads` → `uploadedFiles` above.
      void uploadMany(fileArr, { category: 'gst' })
        .then((uploaded) => {
          if (uploaded.length === 0) {
            toast.error('Upload failed — please try again.');
            return;
          }
          toast.success(
            `${uploaded.length} file(s) uploaded to GST workspace`,
          );
        })
        .catch((err) => {
          toast.error(
            err instanceof Error ? err.message : 'Upload failed',
          );
        });
    },
    [uploadMany],
  );

  const handleRemoveFile = useCallback((id: string) => {
    // Hide the entry from the local UI. The underlying Storage file (if the
    // upload completed) is NOT deleted — use the Document Vault for that.
    setHiddenUploadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleExtractData = useCallback(async () => {
    setIsExtracting(true);
    // Simulate AI extraction using existing invoices as the "extracted" data
    await new Promise((r) => setTimeout(r, 1500));

    const invoices: ExtractedInvoice[] = clientInvoices.slice(0, 20).map((inv) => {
      const gstinValid = inv.buyerGstin ? validateGSTIN(inv.buyerGstin) : true;
      const hsnValid = !!inv.hsnCode && inv.hsnCode.length >= 4;
      const expectedTax = inv.taxableValue * 0.18;
      const actualTax = inv.cgst + inv.sgst + inv.igst;
      const taxComputationValid = Math.abs(expectedTax - actualTax) < expectedTax * 0.05;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        buyerGstin: inv.buyerGstin || '',
        buyerName: inv.buyerName || '',
        invoiceType: inv.invoiceType,
        taxableValue: inv.taxableValue,
        cgst: inv.cgst,
        sgst: inv.sgst,
        igst: inv.igst,
        totalAmount: inv.totalAmount,
        hsnCode: inv.hsnCode || '',
        gstr1Section: inv.gstr1Section as GSTR1Section,
        gstinValid,
        hsnValid,
        taxComputationValid,
      };
    });

    setExtractedInvoices(invoices);
    setIsExtracting(false);
    setQuickFileStep(3);
  }, [clientInvoices]);

  const handleUpdateExtractedInvoice = useCallback(
    (id: string, field: string, value: number | string) => {
      setExtractedInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== id) return inv;
          const updated = { ...inv, [field]: value };
          // Recompute validation
          if (field === 'buyerGstin') {
            updated.gstinValid = validateGSTIN(String(value));
          }
          if (field === 'taxableValue' || field === 'cgst' || field === 'sgst' || field === 'igst') {
            const expectedTax = updated.taxableValue * 0.18;
            const actualTax = updated.cgst + updated.sgst + updated.igst;
            updated.taxComputationValid = Math.abs(expectedTax - actualTax) < expectedTax * 0.05;
            updated.totalAmount = updated.taxableValue + updated.cgst + updated.sgst + updated.igst;
          }
          return updated;
        })
      );
    },
    []
  );

  const handleGenerateJSON = useCallback(async () => {
    setIsGeneratingJSON(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsGeneratingJSON(false);
  }, []);

  const handleFileReturn = useCallback(async () => {
    if (!currentReturnId) {
      toast.error('Create a return first before filing.');
      return;
    }
    setIsFiling(true);
    try {
      await fileReturn(currentReturnId);
      toast.success('Return filed successfully');
      setQuickFileStep(1);
      // Reset the local upload list (does NOT delete files from Firebase Storage;
      // they remain in the org-scoped 'gst' folder for the Document Vault).
      clearUploads();
      setHiddenUploadIds(new Set());
      setFileMetaByName(new Map());
      setExtractedInvoices([]);
      setQuickFileClientId('');
      setCurrentReturnId(null);
    } catch (err) {
      console.error('Failed to file return:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to file return');
    } finally {
      setIsFiling(false);
    }
  }, [currentReturnId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload]
  );

  const handleStartQuickFile = () => {
    if (selectedClientId) {
      setQuickFileClientId(selectedClientId);
    }
    setQuickFileStep(1);
    setActiveTab('quick-file');
  };

  // ─── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-lg" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderStatusBadge = (filing: GSTRFiling) => {
    const isOverdue = overdueIds.has(filing.id);
    const key = isOverdue ? 'overdue' : filing.status;
    const config = STATUS_BADGE_MAP[key] ?? STATUS_BADGE_MAP[filing.status] ?? STATUS_BADGE_MAP.draft;
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const renderStepIndicator = () => {
    const steps: { num: QuickFileStep; label: string }[] = [
      { num: 1, label: 'Select Client' },
      { num: 2, label: 'Upload Docs' },
      { num: 3, label: 'Review' },
      { num: 4, label: 'File' },
    ];
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        {steps.map((step, i) => (
          <React.Fragment key={step.num}>
            <div className="flex items-center gap-1.5">
              <motion.div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  quickFileStep >= step.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
                animate={{
                  scale: quickFileStep === step.num ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {quickFileStep > step.num ? (
                  <CheckCheck className="size-3.5" />
                ) : (
                  step.num
                )}
              </motion.div>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  quickFileStep >= step.num ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-4 sm:w-8 ${
                  quickFileStep > step.num ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //   RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ─── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>Failed to load returns: {error}</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => window.location.reload()}>
            <RefreshCw className="size-3" /> Retry
          </Button>
        </div>
      )}
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <FileText className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">GST Returns</h1>
            <p className="text-sm text-muted-foreground">Prepare and file returns in minutes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFY} onValueChange={setSelectedFY}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINANCIAL_YEARS.map((fy) => (
                <SelectItem key={fy} value={fy}>
                  FY {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setNewReturnOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Return</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </motion.div>

      {/* ─── Main Tabs ──────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap sm:flex-nowrap">
          <TabsTrigger value="all-returns" className="gap-1.5">
            <FileText className="size-3.5" />
            All Returns
          </TabsTrigger>
          <TabsTrigger value="quick-file" className="gap-1.5">
            <Zap className="size-3.5" />
            Quick File
          </TabsTrigger>
          <TabsTrigger value="filed-history" className="gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Filed History
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: All Returns
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="all-returns" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search client name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="filed">Filed</SelectItem>
                    <SelectItem value="generated">Ready</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterReturnType} onValueChange={setFilterReturnType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Return Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {RETURN_TYPES.map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        {rt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedClientId ?? 'all'}
                  onValueChange={(v) => setSelectedClientId(v === 'all' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Client" />
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

                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterReturnType('all');
                    setSearchQuery('');
                    setSelectedClientId(null);
                  }}
                >
                  <X className="size-3.5" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-emerald-600" />
                All Returns
                <Badge variant="secondary" className="ml-1">
                  {filteredFilings.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Client</TableHead>
                      <TableHead className="whitespace-nowrap">Return Type</TableHead>
                      <TableHead className="whitespace-nowrap">Period</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Invoices</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Tax Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFilings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32">
                          <EmptyState
                            icon={FileText}
                            title={filings.length === 0 ? 'No GST returns yet' : 'No matching returns'}
                            description={filings.length === 0 ? 'Create your first GSTR-1 or GSTR-3B return to start filing.' : 'Try adjusting your filters.'}
                            compact
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFilings.map((filing, index) => (
                        <motion.tr
                          key={filing.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.3 }}
                          className="group border-b transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {filing.client?.tradeName ?? '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700">
                              {filing.returnType}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {filing.period ? periodToLabel(filing.period) : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {renderStatusBadge(filing)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {filing.totalInvoices}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-medium">
                            {formatCurrency(filing.totalTax)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="size-8 p-0">
                                <Eye className="size-3.5" />
                              </Button>
                              {filing.status !== 'filed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-emerald-600 hover:text-emerald-700"
                                  onClick={handleStartQuickFile}
                                >
                                  <Zap className="size-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="size-8 p-0">
                                <Download className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: Quick File
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="quick-file" className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div key={quickFileStep} variants={tabContent} initial="hidden" animate="show" exit="exit">
              {/* Step Indicator */}
              <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/80">
                <CardContent className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {renderStepIndicator()}
                    <div className="text-xs text-muted-foreground">
                      {quickFileClientId && (
                        <span>
                          Client:{' '}
                          <span className="font-medium text-emerald-700">
                            {clients.find((c) => c.id === quickFileClientId)?.tradeName ?? '—'}
                          </span>
                          {quickFileReturnType && (
                            <>
                              {' '}&middot;{' '}
                              <span className="font-medium text-emerald-700">
                                {quickFileReturnType}
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ─── Step 1: Select Client ──────────────────────────────────── */}
              {quickFileStep === 1 && (
                <motion.div variants={fadeInUp} initial="hidden" animate="show" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          1
                        </div>
                        Select Client
                      </CardTitle>
                      <CardDescription>
                        Choose the client for whom you want to file a GST return
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or GSTIN..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-80 overflow-y-auto">
                        {filteredClients.map((client) => (
                          <motion.button
                            key={client.id}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                              quickFileClientId === client.id
                                ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200'
                                : 'border-slate-200 bg-white hover:border-emerald-200'
                            }`}
                            onClick={() => {
                              setQuickFileClientId(client.id);
                              setSelectedClientId(client.id);
                            }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div
                              className={`flex size-9 items-center justify-center rounded-lg text-xs font-bold ${
                                quickFileClientId === client.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {client.tradeName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{client.tradeName}</p>
                              <p className="truncate text-xs text-muted-foreground font-mono">
                                {client.gstin}
                              </p>
                            </div>
                            {quickFileClientId === client.id && (
                              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                            )}
                          </motion.button>
                        ))}
                        {filteredClients.length === 0 && (
                          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            No clients found
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Select value={quickFileReturnType} onValueChange={setQuickFileReturnType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Return Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {RETURN_TYPES.map((rt) => (
                              <SelectItem key={rt} value={rt}>
                                {rt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="month"
                          value={quickFilePeriod}
                          onChange={(e) => setQuickFilePeriod(e.target.value)}
                          placeholder="Period (YYYY-MM)"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => setQuickFileStep(2)}
                          disabled={!quickFileClientId}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          Continue
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── Step 2: Upload Documents ───────────────────────────────── */}
              {quickFileStep === 2 && (
                <motion.div variants={fadeInUp} initial="hidden" animate="show" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          2
                        </div>
                        Upload Documents
                      </CardTitle>
                      <CardDescription>
                        Upload sales registers, purchase data, or invoice documents for extraction
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Drop Zone */}
                      <motion.div
                        className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-colors ${
                          isDragOver
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-slate-300 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.005 }}
                        animate={isDragOver ? { scale: 1.01 } : { scale: 1 }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
                          className="hidden"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        />
                        <motion.div
                          animate={isDragOver ? { y: -4 } : { y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Upload className="size-10 text-emerald-400" />
                        </motion.div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700">
                            {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            or click to browse &middot; PDF, Excel, CSV, Images
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                          <Shield className="mr-1 size-3" />
                          Files processed securely
                        </Badge>
                      </motion.div>

                      {/* Uploaded Files List */}
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">
                            Uploaded Files ({uploadedFiles.length})
                          </p>
                          <div className="space-y-2">
                            {uploadedFiles.map((file) => (
                              <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 rounded-lg border bg-white p-3"
                              >
                                {getFileIcon(file.type)}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{file.name}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(file.size)}
                                    </p>
                                    {file.status === 'uploading' && (
                                      <span className="text-xs text-emerald-600">
                                        {Math.round(file.progress)}%
                                      </span>
                                    )}
                                    {file.status === 'processing' && (
                                      <span className="flex items-center gap-1 text-xs text-amber-600">
                                        <Loader2 className="size-3 animate-spin" />
                                        Processing
                                      </span>
                                    )}
                                    {file.status === 'done' && (
                                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                                        <CheckCircle2 className="size-3" />
                                        Ready
                                      </span>
                                    )}
                                    {file.status === 'error' && (
                                      <span className="text-xs text-red-600">Error</span>
                                    )}
                                  </div>
                                  {file.status === 'uploading' && (
                                    <Progress value={file.progress} className="mt-1.5 h-1" />
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-slate-400 hover:text-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFile(file.id);
                                  }}
                                >
                                  <X className="size-4" />
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={() => setQuickFileStep(1)}
                          className="gap-2"
                        >
                          <ArrowLeft className="size-4" />
                          Back
                        </Button>
                        <Button
                          onClick={handleExtractData}
                          disabled={
                            uploadedFiles.length === 0 ||
                            uploadedFiles.some((f) => f.status !== 'done') ||
                            isExtracting
                          }
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Extracting Data...
                            </>
                          ) : (
                            <>
                              <Zap className="size-4" />
                              Extract Invoice Data
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── Step 3: Review Extracted Data ──────────────────────────── */}
              {quickFileStep === 3 && (
                <motion.div variants={fadeInUp} initial="hidden" animate="show" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                            3
                          </div>
                          Review Extracted Data
                          <Badge variant="secondary" className="ml-1">
                            {extractedInvoices.length} invoices
                          </Badge>
                        </CardTitle>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="size-3.5" />
                            {quickFileTotals.validCount} Valid
                          </span>
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="size-3.5" />
                            {quickFileTotals.warningCount} Warnings
                          </span>
                        </div>
                      </div>
                      <CardDescription>
                        Review and correct extracted invoice data before filing
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-[500px]">
                        <div className="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-xs whitespace-nowrap">Invoice #</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Buyer GSTIN</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Buyer Name</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">Taxable</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">CGST</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">SGST</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">IGST</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">Total</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Section</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Validation</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {extractedInvoices.map((inv) => (
                                <TableRow key={inv.id} className="group">
                                  <TableCell className="font-medium text-xs whitespace-nowrap">
                                    {inv.invoiceNumber}
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                    {inv.invoiceDate}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Input
                                      value={inv.buyerGstin}
                                      onChange={(e) =>
                                        handleUpdateExtractedInvoice(inv.id, 'buyerGstin', e.target.value)
                                      }
                                      className={`h-7 text-xs font-mono w-[140px] ${
                                        !inv.gstinValid && inv.buyerGstin
                                          ? 'border-amber-300 bg-amber-50'
                                          : ''
                                      }`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap max-w-[120px] truncate">
                                    {inv.buyerName}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Input
                                      type="number"
                                      value={inv.taxableValue}
                                      onChange={(e) =>
                                        handleUpdateExtractedInvoice(
                                          inv.id,
                                          'taxableValue',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="h-7 text-xs w-[90px] text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Input
                                      type="number"
                                      value={inv.cgst}
                                      onChange={(e) =>
                                        handleUpdateExtractedInvoice(
                                          inv.id,
                                          'cgst',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="h-7 text-xs w-[70px] text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Input
                                      type="number"
                                      value={inv.sgst}
                                      onChange={(e) =>
                                        handleUpdateExtractedInvoice(
                                          inv.id,
                                          'sgst',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="h-7 text-xs w-[70px] text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Input
                                      type="number"
                                      value={inv.igst}
                                      onChange={(e) =>
                                        handleUpdateExtractedInvoice(
                                          inv.id,
                                          'igst',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="h-7 text-xs w-[70px] text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap text-right font-medium">
                                    {formatCurrency(inv.totalAmount)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-slate-200 bg-slate-50 text-slate-600"
                                    >
                                      {SECTION_BREAKDOWN_LABELS[inv.gstr1Section] ?? inv.gstr1Section}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <div className="flex items-center gap-1">
                                      {inv.gstinValid ? (
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                      ) : (
                                        <AlertTriangle className="size-3.5 text-amber-500" />
                                      )}
                                      {inv.hsnValid ? (
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                      ) : (
                                        <AlertTriangle className="size-3.5 text-amber-500" />
                                      )}
                                      {inv.taxComputationValid ? (
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                      ) : (
                                        <AlertTriangle className="size-3.5 text-amber-500" />
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </ScrollArea>

                      {/* Validation Legend */}
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500" /> GSTIN Valid
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500" /> HSN Valid
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-500" /> Tax Correct
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="size-3 text-amber-500" /> Needs Attention
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          variant="outline"
                          onClick={() => setQuickFileStep(2)}
                          className="gap-2"
                        >
                          <ArrowLeft className="size-4" />
                          Back
                        </Button>
                        <Button
                          onClick={() => setQuickFileStep(4)}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          Proceed to File
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── Step 4: File Return ────────────────────────────────────── */}
              {quickFileStep === 4 && (
                <motion.div variants={fadeInUp} initial="hidden" animate="show" className="space-y-4">
                  {/* Summary Card */}
                  <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
                        <div className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                          4
                        </div>
                        Filing Summary
                      </CardTitle>
                      <CardDescription className="text-emerald-600">
                        Review the summary before filing your return
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Key Metrics */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg bg-white/80 p-4 border border-emerald-100">
                          <p className="text-xs font-medium text-emerald-600">Total Invoices</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-900">
                            {quickFileTotals.totalInvoices}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/80 p-4 border border-emerald-100">
                          <p className="text-xs font-medium text-emerald-600">Total Taxable Value</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-900">
                            {formatCurrency(quickFileTotals.totalTaxable)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/80 p-4 border border-emerald-100">
                          <p className="text-xs font-medium text-emerald-600">Total GST</p>
                          <p className="mt-1 text-2xl font-bold text-emerald-900">
                            {formatCurrency(quickFileTotals.totalTax)}
                          </p>
                        </div>
                      </div>

                      <Separator className="bg-emerald-200" />

                      {/* Section Breakdown */}
                      <div>
                        <p className="text-sm font-semibold text-emerald-800 mb-3">
                          Section-wise Breakdown
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {Object.entries(sectionBreakdown).map(([section, data]) => (
                            <div
                              key={section}
                              className="flex items-center justify-between rounded-lg bg-white/80 border border-emerald-100 p-3"
                            >
                              <div>
                                <p className="text-xs font-medium text-emerald-700">
                                  {SECTION_BREAKDOWN_LABELS[section] ?? section.toUpperCase()}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {data.count} invoice{data.count !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-semibold text-emerald-900">
                                  {formatCurrency(data.taxableValue)}
                                </p>
                                <p className="text-[10px] text-emerald-600">
                                  Tax: {formatCurrency(data.totalTax)}
                                </p>
                              </div>
                            </div>
                          ))}
                          {Object.keys(sectionBreakdown).length === 0 && (
                            <div className="col-span-full py-4 text-center text-sm text-muted-foreground">
                              No data to display
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Validation Summary */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="size-4" />
                          {quickFileTotals.validCount} valid invoices
                        </span>
                        {quickFileTotals.warningCount > 0 && (
                          <span className="flex items-center gap-1.5 text-amber-700">
                            <AlertTriangle className="size-4" />
                            {quickFileTotals.warningCount} with warnings
                          </span>
                        )}
                      </div>

                      <Separator className="bg-emerald-200" />

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                          variant="outline"
                          onClick={() => setQuickFileStep(3)}
                          className="gap-2"
                        >
                          <ArrowLeft className="size-4" />
                          Back to Review
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={handleGenerateJSON}
                            disabled={isGeneratingJSON}
                            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            {isGeneratingJSON ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            {isGeneratingJSON ? 'Generating...' : 'Generate JSON'}
                          </Button>
                          <Button
                            onClick={handleFileReturn}
                            disabled={isFiling || quickFileTotals.totalInvoices === 0}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                          >
                            {isFiling ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            {isFiling ? 'Filing Return...' : 'File Return'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3: Filed History
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="filed-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Filed History
                <Badge variant="secondary" className="ml-1">
                  {filedHistory.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Previously filed returns with acknowledgments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filedHistory.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Clock className="size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No filed returns yet. File your first return using Quick File.
                  </p>
                  <Button
                    onClick={() => setActiveTab('quick-file')}
                    variant="outline"
                    className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Zap className="size-4" />
                    Start Quick File
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                      className="space-y-3"
                    >
                      {filedHistory.map((filing) => (
                        <motion.div
                          key={filing.id}
                          variants={staggerItem}
                          className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
                              <CheckCircle2 className="size-4 text-emerald-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">
                                  {filing.client?.tradeName ?? '—'}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700"
                                >
                                  {filing.returnType}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {filing.period ? periodToLabel(filing.period) : '—'} &middot; Filed{' '}
                                {filing.filedDate ?? '—'}
                              </p>
                              {filing.acknowledgmentNumber && (
                                <p className="mt-0.5 text-xs font-mono text-slate-500">
                                  ARN: {filing.acknowledgmentNumber}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-12 sm:pl-0">
                            <p className="text-sm font-semibold text-emerald-700 mr-2">
                              {formatCurrency(filing.totalTax)}
                            </p>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                              <Download className="size-3" />
                              JSON
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                              <Download className="size-3" />
                              ACK
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── New Return Dialog ──────────────────────────────────────────── */}
      <Dialog open={newReturnOpen} onOpenChange={setNewReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-emerald-600" />
              New Return
            </DialogTitle>
            <DialogDescription>
              Create a new GST return filing record to get started
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Client Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <Select value={newReturnClientId} onValueChange={setNewReturnClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName} ({c.gstin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Return Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Return Type</label>
              <Select value={newReturnType} onValueChange={setNewReturnType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select return type" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_TYPES.map((rt) => (
                    <SelectItem key={rt} value={rt}>
                      {rt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={newReturnFY} onValueChange={setNewReturnFY}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCIAL_YEARS.map((fy) => (
                      <SelectItem key={fy} value={fy}>
                        FY {fy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newReturnMonth} onValueChange={setNewReturnMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewReturnOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewReturn}
              disabled={!newReturnClientId || !newReturnType || isCreating}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isCreating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Zap className="size-4" />
              )}
              {isCreating ? 'Creating...' : 'Create & Start'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
