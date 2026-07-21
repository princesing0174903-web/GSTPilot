'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ListChecks,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProfessionalEmptyState } from '@/components/shared';
import { toast } from 'sonner';
import {
  useFetch,
  apiPost,
  fmtINR,
  fmtDate,
  CATEGORY_LABELS,
  CATEGORY_LIST,
  categoryBadgeClass,
  SCROLLBAR_CLASS,
} from './helpers';
import type {
  ImportPreview,
  ImportResult,
  ImportFormat,
  ImportedRow,
  BankingAccount,
  TransactionCategory,
} from '@/lib/banking-service/types';

interface ImportTabProps {
  onNavigateToTransactions?: (accountId?: string) => void;
}

interface AccountsResponse {
  ok: boolean;
  accounts: BankingAccount[];
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string; icon: typeof Upload }[] = [
  { n: 1, label: 'Upload', icon: Upload },
  { n: 2, label: 'Preview', icon: FileText },
  { n: 3, label: 'Categorize', icon: Sparkles },
  { n: 4, label: 'Import', icon: Check },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isCurrent = s.n === step;
        const isDone = s.n < step;
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : isDone
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'border-border bg-muted/40 text-muted-foreground'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                isCurrent ? 'bg-emerald-500 text-white' : isDone ? 'bg-emerald-400 text-white' : 'bg-muted-foreground/30 text-muted-foreground'
              }`}>
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <Icon className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Format option ────────────────────────────────────────────────────────────

interface FormatOption {
  value: ImportFormat;
  label: string;
  icon: typeof FileText;
  hint: string;
  disabled?: boolean;
}

const FORMATS: FormatOption[] = [
  { value: 'csv', label: 'CSV', icon: FileText, hint: 'Comma-separated values' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, hint: 'Best-effort text scan' },
  { value: 'pdf', label: 'PDF', icon: FileIcon, hint: 'Placeholder — not supported', disabled: true },
];

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

function Step1({
  format,
  setFormat,
  rawContent,
  setRawContent,
  accountId,
  setAccountId,
  accounts,
  onContinue,
}: {
  format: ImportFormat;
  setFormat: (v: ImportFormat) => void;
  rawContent: string;
  setRawContent: (v: string) => void;
  accountId: string;
  setAccountId: (v: string) => void;
  accounts: BankingAccount[];
  onContinue: () => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setRawContent(text);
      toast.success(`Loaded ${file.name} (${text.length.toLocaleString()} chars)`);
    };
    reader.onerror = () => toast.error('Could not read file');
    reader.readAsText(file);
  };

  const canContinue = rawContent.trim().length > 0 && !!accountId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Statement</CardTitle>
          <CardDescription>
            Import transactions from a bank statement file. CSV is fully supported;
            Excel is best-effort text extraction; PDF is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Format picker */}
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const active = format === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  disabled={f.disabled}
                  onClick={() => !f.disabled && setFormat(f.value)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-xs transition-colors ${
                    active
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                      : 'border-border bg-muted/30 hover:bg-muted/60'
                  } ${f.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <span className="font-medium">{f.label}</span>
                  <span className="text-[10px] text-muted-foreground">{f.hint}</span>
                </button>
              );
            })}
          </div>

          {/* Account picker */}
          <div className="space-y-1.5">
            <Label>Target account *</Label>
            <Select value={accountId || 'none'} onValueChange={(v) => setAccountId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Pick an account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Pick an account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.bankName} {a.accountMasked}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'border-border bg-muted/20'
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a file here, or click to browse</p>
            <p className="text-[11px] text-muted-foreground">
              {format === 'csv' ? 'CSV files up to ~1MB' : format === 'excel' ? 'Excel files (text-extracted)' : 'PDF — placeholder'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={format === 'csv' ? '.csv' : format === 'excel' ? '.xlsx,.xls' : '.pdf'}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Browse
            </Button>
          </div>

          {/* Paste textarea */}
          <div className="space-y-1.5">
            <Label>Or paste statement content</Label>
            <Textarea
              rows={6}
              placeholder={`Date,Description,Amount,Type\n2024-11-05,UPI/ACME/Payment,50000,credit\n2024-11-04,NEFT/Salary,150000,credit`}
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              {rawContent.length.toLocaleString()} characters · {rawContent.split(/\r?\n/).filter(Boolean).length} lines
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={onContinue} disabled={!canContinue}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 2: Preview ──────────────────────────────────────────────────────────

function Step2({
  preview,
  loading,
  error,
  onBack,
  onCategorize,
  onRetry,
}: {
  preview: ImportPreview | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onCategorize: () => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (error || !preview) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Preview failed"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: onRetry, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
          <CardDescription>Review detected rows before categorizing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Rows" value={String(preview.rowCount)} />
            <Stat label="Valid" value={String(preview.validRowCount)} tone="emerald" />
            <Stat label="Issues" value={String(preview.issueCount)} tone={preview.issueCount > 0 ? 'amber' : 'muted'} />
            <Stat label="Currency" value={preview.detectedCurrency} />
            <Stat label="Inflow" value={fmtINR(preview.totalInflow)} tone="emerald" />
            <Stat label="Outflow" value={fmtINR(preview.totalOutflow)} tone="rose" />
            <Stat label="Period" value={preview.detectedPeriod ? `${fmtDate(preview.detectedPeriod.from)} → ${fmtDate(preview.detectedPeriod.to)}` : '—'} />
            <Stat label="Net" value={fmtINR(preview.totalInflow - preview.totalOutflow)} tone="violet" />
          </div>

          <div className={`max-h-[400px] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-[11px]">Date</TableHead>
                  <TableHead className="text-[11px]">Description</TableHead>
                  <TableHead className="text-[11px]">Reference</TableHead>
                  <TableHead className="text-right text-[11px]">Amount</TableHead>
                  <TableHead className="text-[11px]">Type</TableHead>
                  <TableHead className="text-[11px]">Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell>{fmtDate(r.date)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{r.description}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{r.referenceNo || '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={r.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {r.type === 'credit' ? '+' : '−'}{fmtINR(r.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.type === 'credit'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'}>
                        {r.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.issues && r.issues.length > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400" title={r.issues.join('; ')}>
                          ⚠ {r.issues.length}
                        </span>
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={onCategorize}>
              <Sparkles className="h-4 w-4 text-violet-300" /> Categorize with AI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 3: Categorize ───────────────────────────────────────────────────────

function Step3({
  preview,
  loading,
  error,
  onBack,
  onCommit,
  onRetry,
  onPatchRow,
}: {
  preview: ImportPreview | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onCommit: () => void;
  onRetry: () => void;
  onPatchRow: (idx: number, category: TransactionCategory) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (error || !preview) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Categorization failed"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: onRetry, icon: RefreshCw }}
          />
        </CardContent>
      </Card>
    );
  }
  const validCount = preview.rows.filter((r) => !r.issues?.length).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Categorize
        </CardTitle>
        <CardDescription>
          AI suggested categories for each row. Override any row by changing its category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`max-h-[400px] overflow-y-auto rounded-md border ${SCROLLBAR_CLASS}`}>
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="text-[11px]">Date</TableHead>
                <TableHead className="text-[11px]">Description</TableHead>
                <TableHead className="text-right text-[11px]">Amount</TableHead>
                <TableHead className="text-[11px]">Suggested</TableHead>
                <TableHead className="text-[11px]">Conf.</TableHead>
                <TableHead className="text-[11px]">Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((r, i) => (
                <TableRow key={i} className="text-xs">
                  <TableCell>{fmtDate(r.date)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={r.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {r.type === 'credit' ? '+' : '−'}{fmtINR(r.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.suggestedCategory ? (
                      <Badge variant="outline" className={categoryBadgeClass(r.suggestedCategory)}>
                        {CATEGORY_LABELS[r.suggestedCategory]}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {r.confidence !== undefined && r.confidence !== null ? (
                      <div className="flex items-center gap-2">
                        <Progress value={Math.round(r.confidence * 100)} className="h-1.5 w-12" />
                        <span className="text-[10px] text-muted-foreground">{Math.round(r.confidence * 100)}%</span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.suggestedCategory || 'none'}
                      onValueChange={(v) => v !== 'none' && onPatchRow(i, v as TransactionCategory)}
                    >
                      <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {CATEGORY_LIST.map((c) => (
                          <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={onCommit}>
            <Check className="h-4 w-4" /> Import {validCount} Transactions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 4: Result ───────────────────────────────────────────────────────────

function Step4({
  result,
  loading,
  error,
  onRetry,
  onDone,
  onView,
}: {
  result: ImportResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onDone: () => void;
  onView: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (error || !result) {
    return (
      <Card>
        <CardContent className="py-10">
          <ProfessionalEmptyState
            icon={AlertCircle}
            title="Import failed"
            description={error || 'Unknown error'}
            accent="rose"
            action={{ label: 'Retry', onClick: onRetry, icon: RefreshCw }}
            secondaryAction={{ label: 'Start over', onClick: onDone }}
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <div>
            <h3 className="text-lg font-semibold">Import complete</h3>
            <p className="text-sm text-muted-foreground">{result.summary}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Stat label="Imported" value={String(result.importedCount)} tone="emerald" />
            <Stat label="Skipped" value={String(result.skippedCount)} tone="amber" />
            <Stat label="Auto-cat" value={String(result.categorizationApplied)} tone="violet" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDone}>Import another</Button>
            <Button onClick={onView}>
              <ListChecks className="h-4 w-4" /> View Transactions
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat helper ──────────────────────────────────────────────────────────────

function Stat({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'emerald' | 'rose' | 'amber' | 'violet' | 'muted' }) {
  const toneClass = {
    emerald: 'text-emerald-600 dark:text-emerald-300',
    rose: 'text-rose-600 dark:text-rose-300',
    amber: 'text-amber-600 dark:text-amber-300',
    violet: 'text-violet-600 dark:text-violet-300',
    muted: 'text-foreground',
  }[tone];
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function ImportTab({ onNavigateToTransactions }: ImportTabProps) {
  const [step, setStep] = React.useState<Step>(1);
  const [format, setFormat] = React.useState<ImportFormat>('csv');
  const [rawContent, setRawContent] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [catLoading, setCatLoading] = React.useState(false);
  const [catError, setCatError] = React.useState<string | null>(null);
  const [commitLoading, setCommitLoading] = React.useState(false);
  const [commitError, setCommitError] = React.useState<string | null>(null);

  const accountsRes = useFetch<AccountsResponse>('/api/banking-intel/accounts');
  const accounts = accountsRes.data?.accounts ?? [];

  // ── Step 1 → 2: preview ──
  const runPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await apiPost<{ ok: boolean; preview: ImportPreview }>(
        '/api/banking-intel/import/preview',
        { format, rawContent, accountId },
      );
      setPreview(res.preview);
      setStep(2);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed');
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Step 2 → 3: categorize ──
  const runCategorize = async () => {
    if (!preview) return;
    setCatLoading(true);
    setCatError(null);
    try {
      const res = await apiPost<{ ok: boolean; preview: ImportPreview }>(
        '/api/banking-intel/import/categorize',
        { preview },
      );
      setPreview(res.preview);
      setStep(3);
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'Categorize failed');
      toast.error(e instanceof Error ? e.message : 'Categorize failed');
    } finally {
      setCatLoading(false);
    }
  };

  // ── Step 3 → 4: commit ──
  const runCommit = async () => {
    if (!preview || !accountId) return;
    setCommitLoading(true);
    setCommitError(null);
    try {
      const res = await apiPost<{ ok: boolean; result: ImportResult }>(
        '/api/banking-intel/import/commit',
        { preview, accountId },
      );
      setResult(res.result);
      setStep(4);
      toast.success(`Imported ${res.result.importedCount} transaction${res.result.importedCount === 1 ? '' : 's'}`);
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : 'Import failed');
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setCommitLoading(false);
    }
  };

  // ── Manual row patch (Step 3) ──
  const patchRow = (idx: number, category: TransactionCategory) => {
    if (!preview) return;
    const rows = [...preview.rows];
    rows[idx] = { ...rows[idx], suggestedCategory: category, confidence: 1 };
    setPreview({ ...preview, rows });
  };

  // ── Reset (start over) ──
  const reset = () => {
    setStep(1);
    setFormat('csv');
    setRawContent('');
    setAccountId('');
    setPreview(null);
    setResult(null);
    setPreviewError(null);
    setCatError(null);
    setCommitError(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <Stepper step={step} />
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 && (
            <Step1
              format={format}
              setFormat={setFormat}
              rawContent={rawContent}
              setRawContent={setRawContent}
              accountId={accountId}
              setAccountId={setAccountId}
              accounts={accounts}
              onContinue={runPreview}
            />
          )}
          {step === 2 && (
            <Step2
              preview={preview}
              loading={previewLoading}
              error={previewError}
              onBack={() => setStep(1)}
              onCategorize={runCategorize}
              onRetry={runPreview}
            />
          )}
          {step === 3 && (
            <Step3
              preview={preview}
              loading={catLoading}
              error={catError}
              onBack={() => setStep(2)}
              onCommit={runCommit}
              onRetry={runCategorize}
              onPatchRow={patchRow}
            />
          )}
          {step === 4 && (
            <Step4
              result={result}
              loading={commitLoading}
              error={commitError}
              onRetry={runCommit}
              onDone={reset}
              onView={() => onNavigateToTransactions?.(accountId)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {step === 1 && (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-3 text-xs text-muted-foreground">
            <FileText className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium text-foreground">CSV format example</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-[10px]">{`Date,Description,Amount,Type
2024-11-05,UPI/ACME/Payment,50000,credit
2024-11-04,NEFT/HDFC/Salary,150000,credit
2024-11-03,BILLPAY/ELECTRICITY,12500,debit`}</pre>
              <p className="mt-1">Column order is detected automatically. Dates in DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD accepted.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ImportTab;

// Re-export for type completeness
export type { ImportedRow };
