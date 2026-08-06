'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Statement Import Modal (Premium Edition)
//
// A premium 3-step flow for importing bank statements:
//
//   Step 1 (Upload)   → drag-and-drop file + select target account → "Parse & Preview"
//   Step 2 (Preview)  → summary cards + error table + first-10 rows preview → "Confirm Import"
//   Step 3 (Result)   → success/partial/failed banner + final counts → "Done" / "Import Another"
//
// State machine is fully internal:
//   step: 1 | 2 | 3
//   file: File | null
//   accountId: string | null
//   preview: StatementPreview | null    (after parse, before confirm)
//   result: StatementImportResult | null (after confirm)
//   loading: boolean                     (during parse or confirm)
//   error: string | null
//
// The parent owns the actual API call. `onImport(file, accountId, confirm)`:
//   • confirm=false → should return `{ preview: StatementPreview }` (step 1 → 2)
//   • confirm=true  → should return `StatementImportResult`         (step 2 → 3)
//
// Design tokens: pure-black GSTPilot theme. Cards: `glass-surface rounded-2xl
// border border-white/[0.06]`. Primary emerald — NO indigo/blue.
// ═══════════════════════════════════════════════════════════════════════════════

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileSpreadsheet,
  File as FileIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  RotateCcw,
  Check,
  X,
  Building2,
  Hash,
  ListChecks,
  AlertCircle,
  Copy,
  TrendingUp,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import type {
  StatementImportResult,
  ParsedStatementRow,
  TransactionType,
} from '@/lib/banking-prisma/types';
import { formatINR } from '@/components/banking/BankingKpiCards';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatementPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  totalAmount: number;
  credits: number;
  debits: number;
  errors?: Array<{ row: number; message: string }>;
  rows?: ParsedStatementRow[];
}

export interface ImportAccount {
  id: string;
  bankName: string;
  accountMasked: string;
}

type ImportResult = { preview: StatementPreview } | StatementImportResult;

function isStatementImportResult(r: ImportResult): r is StatementImportResult {
  return typeof (r as StatementImportResult).importId === 'string';
}

interface BankingImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ImportAccount[];
  onImport: (file: File, accountId: string, confirm: boolean) => Promise<ImportResult>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['.csv', '.xlsx', '.xls'];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(',');
const MAX_PREVIEW_ROWS = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE';
}

function fileIsAccepted(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_TYPES.some((ext) => lower.endsWith(ext));
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Preview', 'Result'] as const;

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const isDone = step > idx;
        const isCurrent = step === idx;
        const tone = isDone
          ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
          : isCurrent
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : 'border-white/[0.08] bg-white/[0.02] text-zinc-500';
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${tone}`}
              >
                {isDone ? <Check className="h-3 w-3" /> : idx}
              </div>
              <span
                className={`text-[11px] font-medium uppercase tracking-wider ${
                  isCurrent ? 'text-foreground' : isDone ? 'text-blue-300' : 'text-zinc-500'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length && (
              <div
                className={`h-px w-6 ${step > idx ? 'bg-blue-500/40' : 'bg-white/[0.08]'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Summary card (preview step) ──────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: 'success' | 'danger' | 'warning' | 'neutral' | 'info';
  hint?: string;
}

const SUMMARY_TONES: Record<SummaryCardProps['tone'], { chip: string; text: string }> = {
  success: { chip: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-300' },
  danger: { chip: 'bg-red-500/10 border-red-500/20', text: 'text-red-300' },
  warning: { chip: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-300' },
  neutral: { chip: 'bg-white/[0.04] border-white/[0.08]', text: 'text-zinc-200' },
  info: { chip: 'bg-cyan-500/10 border-cyan-500/20', text: 'text-cyan-300' },
};

function SummaryCard({ label, value, icon: Icon, tone, hint }: SummaryCardProps) {
  const cfg = SUMMARY_TONES[tone];
  return (
    <div className="glass-surface rounded-xl border border-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md border ${cfg.chip}`}>
          <Icon className={`h-3 w-3 ${cfg.text}`} />
        </div>
      </div>
      <p className="mt-1.5 text-base font-semibold text-foreground tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Upload step ──────────────────────────────────────────────────────────────

interface UploadStepProps {
  file: File | null;
  setFile: (f: File | null) => void;
  accountId: string | null;
  setAccountId: (id: string | null) => void;
  accounts: ImportAccount[];
  onParse: () => void;
  loading: boolean;
  error: string | null;
}

function UploadStep({
  file,
  setFile,
  accountId,
  setAccountId,
  accounts,
  onParse,
  loading,
  error,
}: UploadStepProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!fileIsAccepted(f.name)) {
        toast.error('Unsupported file type. Please upload .csv, .xlsx, or .xls');
        return;
      }
      setFile(f);
    },
    [setFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const canParse = Boolean(file) && Boolean(accountId) && !loading;

  return (
    <div className="space-y-4">
      {/* Account selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Target Account</Label>
        <Select
          value={accountId ?? ''}
          onValueChange={(v) => setAccountId(v || null)}
          disabled={loading || accounts.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              placeholder={
                accounts.length === 0
                  ? 'No accounts available'
                  : 'Select target bank account'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                <span className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-blue-300" />
                  <span>{acc.bankName}</span>
                  <span className="text-muted-foreground">· {acc.accountMasked}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drag-and-drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-blue-500/50 bg-blue-500/[0.04]'
            : 'border-white/[0.08] bg-white/[0.02] hover:border-blue-500/30 hover:bg-blue-500/[0.02]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <motion.div
          initial={false}
          animate={{ scale: dragOver ? 1.08 : 1 }}
          className={`flex h-12 w-12 items-center justify-center rounded-full border ${
            dragOver
              ? 'border-blue-500/40 bg-blue-500/10'
              : 'border-white/[0.08] bg-white/[0.04]'
          }`}
        >
          <UploadCloud
            className={`h-5 w-5 ${
              dragOver ? 'text-blue-300' : 'text-zinc-400 group-hover:text-blue-300'
            }`}
          />
        </motion.div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {dragOver ? 'Drop the file here' : 'Drag & drop statement file'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Supports .csv, .xlsx, .xls · up to ~10 MB
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          Browse Files
        </Button>
      </div>

      {/* Selected file chip */}
      <AnimatePresence mode="wait">
        {file && (
          <motion.div
            key="file-chip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                <FileIcon className="h-4 w-4 text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(file.size)} · {fileExtension(file.name)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-blue-500/20 bg-blue-500/10 text-blue-300 text-[10px]"
              >
                {fileExtension(file.name)}
              </Badge>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setFile(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
            <p className="text-xs text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parse button */}
      <Button
        type="button"
        className="w-full"
        disabled={!canParse}
        onClick={onParse}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Parsing…
          </>
        ) : (
          <>
            Parse & Preview
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}

// ─── Preview step ─────────────────────────────────────────────────────────────

interface PreviewStepProps {
  preview: StatementPreview;
  fileName: string;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function PreviewStep({
  preview,
  fileName,
  onBack,
  onConfirm,
  loading,
}: PreviewStepProps) {
  const previewRows = useMemo(
    () => (preview.rows ?? []).slice(0, MAX_PREVIEW_ROWS),
    [preview.rows],
  );
  const errors = preview.errors ?? [];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <SummaryCard
          label="Total Rows"
          value={preview.totalRows}
          icon={ListChecks}
          tone="neutral"
        />
        <SummaryCard
          label="Valid Rows"
          value={preview.validRows}
          icon={CheckCircle2}
          tone="success"
        />
        <SummaryCard
          label="Errors"
          value={preview.errorRows}
          icon={XCircle}
          tone="danger"
        />
        <SummaryCard
          label="Duplicates"
          value={preview.duplicateRows}
          icon={Copy}
          tone="warning"
        />
        <SummaryCard
          label="Total Amount"
          value={formatINR(preview.totalAmount)}
          icon={Wallet}
          tone="info"
        />
        <SummaryCard
          label="Credits / Debits"
          value={`${preview.credits} / ${preview.debits}`}
          icon={TrendingUp}
          tone="neutral"
          hint="Incoming / Outgoing"
        />
      </div>

      {/* Errors table */}
      {errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              Error Report
              <Badge
                variant="outline"
                className="border-red-500/20 bg-red-500/10 text-red-300 text-[10px]"
              >
                {errors.length}
              </Badge>
            </h4>
          </div>
          <div className="rounded-xl border border-red-500/15 bg-red-500/[0.02]">
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow className="border-red-500/15 hover:bg-transparent">
                    <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground w-16">
                      Row
                    </TableHead>
                    <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Error
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((err, i) => (
                    <TableRow
                      key={`${err.row}-${i}`}
                      className="border-red-500/10 hover:bg-red-500/[0.04]"
                    >
                      <TableCell className="py-2 text-xs font-medium text-red-300 tabular-nums">
                        #{err.row}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-red-200/80">
                        {err.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Parsed rows preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-blue-400" />
            Parsed Rows Preview
            <span className="text-[10px] text-muted-foreground">
              (first {Math.min(MAX_PREVIEW_ROWS, previewRows.length)})
            </span>
          </h4>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <ScrollArea className="max-h-72">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-transparent">
                  <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground text-right">
                    Amount
                  </TableHead>
                  <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="h-8 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Reference
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.length === 0 ? (
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No previewable rows
                    </TableCell>
                  </TableRow>
                ) : (
                  previewRows.map((row, i) => (
                    <TableRow
                      key={i}
                      className="border-white/[0.06] hover:bg-white/[0.02]"
                    >
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {row.date}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-foreground max-w-[200px] truncate">
                        {row.description}
                      </TableCell>
                      <TableCell
                        className={`py-2 text-xs font-medium tabular-nums text-right ${
                          row.type === 'credit' ? 'text-blue-300' : 'text-red-300'
                        }`}
                      >
                        {row.type === 'credit' ? '+' : '−'}
                        {formatINR(row.amount)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={
                            row.type === 'credit'
                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-300 text-[10px]'
                              : 'border-red-500/20 bg-red-500/10 text-red-300 text-[10px]'
                          }
                        >
                          {row.type === 'credit' ? (
                            <TrendingUp className="h-2.5 w-2.5 mr-1" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5 mr-1" />
                          )}
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground max-w-[120px] truncate">
                        {row.reference ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <p className="text-[10px] text-muted-foreground">
          File: <span className="text-foreground">{fileName}</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>
        <Button type="button" onClick={onConfirm} disabled={loading || preview.validRows === 0}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              Confirm Import
              <span className="ml-2 flex items-center gap-1 text-[10px] font-normal opacity-80">
                <span className="text-emerald-200">{preview.validRows} new</span>
                <span>·</span>
                <span className="text-amber-200">{preview.duplicateRows} dup</span>
                {preview.errorRows > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-200">{preview.errorRows} err</span>
                  </>
                )}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Result step ──────────────────────────────────────────────────────────────

interface ResultStepProps {
  result: StatementImportResult;
  onDone: () => void;
  onImportAnother: () => void;
}

function ResultStep({ result, onDone, onImportAnother }: ResultStepProps) {
  const status = result.status;
  const cfg =
    status === 'completed'
      ? {
          icon: CheckCircle2,
          tone: 'success' as const,
          title: 'Import completed successfully',
          desc: 'All valid rows have been imported into the bank ledger.',
        }
      : status === 'partial'
        ? {
            icon: AlertTriangle,
            tone: 'warning' as const,
            title: 'Import completed with warnings',
            desc: 'Some rows were skipped due to errors or duplicates.',
          }
        : {
            icon: XCircle,
            tone: 'danger' as const,
            title: 'Import failed',
            desc: 'No rows were imported. Please review the errors and try again.',
          };

  const Icon = cfg.icon;
  const bannerTone =
    cfg.tone === 'success'
      ? 'border-blue-500/30 bg-blue-500/[0.06]'
      : cfg.tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/[0.06]'
        : 'border-red-500/30 bg-red-500/[0.06]';
  const iconTone =
    cfg.tone === 'success'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : cfg.tone === 'warning'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-red-500/15 text-red-300 border-red-500/30';

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`flex items-start gap-3 rounded-2xl border ${bannerTone} p-4`}
      >
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ${iconTone}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{cfg.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{cfg.desc}</p>
        </div>
      </motion.div>

      {/* Final counts */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="glass-surface rounded-xl border border-white/[0.06] p-3 text-center">
          <CheckCircle2 className="mx-auto h-4 w-4 text-blue-300" />
          <p className="mt-1.5 text-xl font-bold text-blue-300 tabular-nums">
            {result.importedRows}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Imported</p>
        </div>
        <div className="glass-surface rounded-xl border border-white/[0.06] p-3 text-center">
          <Copy className="mx-auto h-4 w-4 text-amber-300" />
          <p className="mt-1.5 text-xl font-bold text-amber-300 tabular-nums">
            {result.duplicateRows}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duplicates</p>
        </div>
        <div className="glass-surface rounded-xl border border-white/[0.06] p-3 text-center">
          <XCircle className="mx-auto h-4 w-4 text-red-300" />
          <p className="mt-1.5 text-xl font-bold text-red-300 tabular-nums">
            {result.errorRows}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Import metadata */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Import ID
          </span>
          <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[11px] font-mono text-blue-300">
            {result.importId}
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            File
          </span>
          <span className="text-xs text-foreground">{result.fileName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Rows
          </span>
          <span className="text-xs text-foreground tabular-nums">{result.totalRows}</span>
        </div>
      </div>

      {/* Error details (if any) */}
      {result.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Error Details
            <Badge
              variant="outline"
              className="border-red-500/20 bg-red-500/10 text-red-300 text-[10px]"
            >
              {result.errors.length}
            </Badge>
          </h4>
          <div className="rounded-xl border border-red-500/15 bg-red-500/[0.02]">
            <ScrollArea className="max-h-40">
              <Table>
                <TableHeader>
                  <TableRow className="border-red-500/15 hover:bg-transparent">
                    <TableHead className="h-7 text-[10px] uppercase tracking-wider text-muted-foreground w-16">
                      Row
                    </TableHead>
                    <TableHead className="h-7 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Error
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((err, i) => (
                    <TableRow key={`${err.row}-${i}`} className="border-red-500/10">
                      <TableCell className="py-1.5 text-xs font-medium text-red-300 tabular-nums">
                        #{err.row}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-red-200/80">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onImportAnother}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Import Another
        </Button>
        <Button type="button" className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

// ─── Main modal component ─────────────────────────────────────────────────────

export function BankingImportModal({
  open,
  onOpenChange,
  accounts,
  onImport,
}: BankingImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [result, setResult] = useState<StatementImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setFile(null);
      setAccountId(null);
      setPreview(null);
      setResult(null);
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleParse = useCallback(async () => {
    if (!file || !accountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onImport(file, accountId, false);
      if (isStatementImportResult(res)) {
        // Server confirmed immediately (no separate preview phase). Skip to result.
        setResult(res);
        setStep(3);
      } else {
        setPreview(res.preview);
        setStep(2);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to parse statement');
    } finally {
      setLoading(false);
    }
  }, [file, accountId, onImport]);

  const handleConfirm = useCallback(async () => {
    if (!file || !accountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await onImport(file, accountId, true);
      if (isStatementImportResult(res)) {
        setResult(res);
        setStep(3);
      } else {
        // Unexpected: server returned a preview on confirm. Treat as error.
        setError('Server returned a preview instead of confirming the import.');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to import statement');
    } finally {
      setLoading(false);
    }
  }, [file, accountId, onImport]);

  const handleBack = useCallback(() => {
    setStep(1);
    setPreview(null);
    setError(null);
  }, []);

  const handleDone = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleImportAnother = useCallback(() => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    // Keep accountId selected for convenience.
  }, []);

  const titleMap: Record<1 | 2 | 3, string> = {
    1: 'Import Bank Statement',
    2: 'Preview Parsed Rows',
    3: 'Import Result',
  };
  const descMap: Record<1 | 2 | 3, string> = {
    1: 'Upload a statement file and parse it before importing.',
    2: 'Review the parsed rows and errors before confirming.',
    3: 'Your statement import has been processed.',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                <UploadCloud className="h-4.5 w-4.5 text-blue-300" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <DialogTitle className="text-base">{titleMap[step]}</DialogTitle>
                <DialogDescription className="text-xs">{descMap[step]}</DialogDescription>
              </div>
            </div>
            <StepIndicator step={step} />
          </div>
        </DialogHeader>

        <div className="px-5 py-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <UploadStep
                  file={file}
                  setFile={setFile}
                  accountId={accountId}
                  setAccountId={setAccountId}
                  accounts={accounts}
                  onParse={handleParse}
                  loading={loading}
                  error={error}
                />
              </motion.div>
            )}
            {step === 2 && preview && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <PreviewStep
                  preview={preview}
                  fileName={file?.name ?? 'statement'}
                  onBack={handleBack}
                  onConfirm={handleConfirm}
                  loading={loading}
                />
              </motion.div>
            )}
            {step === 3 && result && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <ResultStep
                  result={result}
                  onDone={handleDone}
                  onImportAnother={handleImportAnother}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type {
  BankingImportModalProps,
  StatementPreview,
  ImportAccount,
  ImportResult,
};
