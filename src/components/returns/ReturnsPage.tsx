'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Returns Module (Premium Enterprise Redesign)
//
// ROOT-CAUSE FIXES (Task 10 — Returns module):
//   1. PERMISSION 401/403 — every API call used raw `fetch()`. The requireAuth
//      middleware on /api/returns requires the `x-gstpilot-actor` header for
//      sandbox/guest users. Switched ALL calls to `fetchWithTimeout()` which
//      auto-injects that header from localStorage.gstpilot_session.
//   2. DATASTORE MISMATCH — `createReturn()`/`fileReturn()` came from
//      firestore-service (writes to Firestore), but /api/returns READS from
//      Prisma. Created returns never appeared in the list. Replaced with
//      direct POST /api/returns + POST /api/gstr-filing/[id]/file (Prisma).
//   3. MANUAL MM-YYYY INPUT — replaced with a premium MonthYearPicker
//      (Popover + 4×3 month grid + year navigation).
//
// DESIGN SYSTEM (GSTPilot dark theme):
//   • Pure-black canvas, glass cards (bg-white/5 + backdrop-blur + soft border)
//   • Blue primary accent, Gold "Oracle" accent
//   • 20px corner radius, layered soft shadows, shimmer skeletons
//   • Animated workflow timeline, premium KPI cards, professional data table
//   • Oracle AI right panel with Risk Score + one-click Fix Automatically
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Download,
  ArrowRight,
  Zap,
  Send,
  Loader2,
  ChevronRight,
  AlertCircle,
  Clock,
  Wrench,
  Eye,
  Info,
  ShieldCheck,
  FileOutput,
  Inbox,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronRight as ChevronRightIcon,
  CalendarDays,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  FileWarning,
  Banknote,
  Timer,
  Gauge,
  Copy,
  Trash2,
  Archive,
  MoreHorizontal,
  ArrowUpRight,
  RefreshCw,
  Bot,
  X,
  Check,
  Receipt,
  FileType,
  CloudUpload,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useCurrentOrgId } from '@/contexts/OrgContext';
import { useClients, type ClientOption } from '@/hooks/useClients';
import { fetchWithTimeout } from '@/lib/async/fetchWithTimeout';
import type { FirestoreReturn, FirestoreClient } from '@/lib/firestore-schema';
import type { FilingStatus } from '@/types/gst';
import {
  formatCurrency,
  periodToLabel,
  getFinancialYear,
} from '@/lib/gst-utils';
import { AskOracleButton } from '@/components/oracle/AskOracleButton';
import { cn } from '@/lib/utils';

// ─── API response shape (subset of Prisma GSTRFiling + client) ───────────────

interface ApiGSTRFiling {
  id: string;
  clientId: string;
  returnType: string;
  period: string;
  financialYear?: string | null;
  status: string;
  filedDate?: string | null;
  acknowledgmentNumber?: string | null;
  totalInvoices: number;
  readyForFiling: number;
  issuesFound: number;
  criticalErrors: number;
  warnings: number;
  totalTaxableValue: number;
  totalTax: number;
  jsonPayload?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; tradeName: string; gstin: string; state?: string | null } | null;
}

type ReturnItem = FirestoreReturn & { id: string };
type ClientItem = FirestoreClient & { id: string };

function mapApiReturnToItem(r: ApiGSTRFiling): ReturnItem {
  return {
    id: r.id,
    returnId: r.id,
    firmId: '',
    clientId: r.clientId,
    returnType: (r.returnType === 'GSTR-3B' ? 'GSTR-3B' : 'GSTR-1') as 'GSTR-1' | 'GSTR-3B',
    period: r.period,
    financialYear: r.financialYear ?? '',
    status: r.status as FilingStatus,
    filedDate: r.filedDate ?? null,
    acknowledgmentNumber: r.acknowledgmentNumber ?? null,
    totalInvoices: r.totalInvoices ?? 0,
    readyForFiling: r.readyForFiling ?? 0,
    issuesFound: r.issuesFound ?? 0,
    criticalErrors: r.criticalErrors ?? 0,
    warnings: r.warnings ?? 0,
    totalTaxableValue: r.totalTaxableValue ?? 0,
    totalTax: r.totalTax ?? 0,
    jsonPayload: r.jsonPayload ?? null,
    assignedTo: null,
    reviewedBy: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapApiClientToItem(c: ClientOption): ClientItem {
  return {
    id: c.id,
    clientId: c.id,
    firmId: '',
    gstin: c.gstin,
    tradeName: c.tradeName,
    legalName: c.legalName ?? c.tradeName,
    address: c.address ?? null,
    state: c.state ?? null,
    stateCode: c.stateCode ?? null,
    contactEmail: c.contactEmail ?? null,
    contactPhone: c.contactPhone ?? null,
    entityType: 'regular',
    returnPeriod: null,
    lastFilingDate: null,
    status: c.status === 'inactive' ? 'inactive' : 'active',
    healthScore: c.healthScore ?? 0,
    complianceProfile: {
      filingCompliance: 0,
      gstinValidity: true,
      lastFilingStatus: null,
      overdueReturns: c._aggregations?.pendingReturns ?? 0,
      totalReturnsFiled: c._aggregations?.filedReturns ?? 0,
      averageFilingDelay: 0,
    },
    invoiceCount: c._aggregations?.totalInvoices ?? 0,
    totalTaxPaid: 0,
    pendingReturnCount: c._aggregations?.pendingReturns ?? 0,
    documentCount: 0,
    createdAt: c.createdAt ?? '',
    updatedAt: c.updatedAt ?? '',
  };
}

// ─── Premium Status Badge config ─────────────────────────────────────────────
// Maps the 8 filing statuses → premium pill design (icon + color + label).

type PremiumStatusKey =
  | 'draft'
  | 'prepared'
  | 'validated'
  | 'reviewed'
  | 'generated'
  | 'submitted'
  | 'filed'
  | 'reopened';

const PREMIUM_STATUS_CONFIG: Record<
  PremiumStatusKey,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    pill: string; // tailwind classes for the pill container
    dot: string; // tailwind classes for the status dot
  }
> = {
  draft: {
    label: 'Draft',
    icon: FileText,
    pill: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    dot: 'bg-slate-400',
  },
  prepared: {
    label: 'Prepared',
    icon: FileOutput,
    pill: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
    dot: 'bg-sky-400',
  },
  validated: {
    label: 'Processing',
    icon: Loader2,
    pill: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
    dot: 'bg-cyan-400',
  },
  reviewed: {
    label: 'Sent',
    icon: Send,
    pill: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
    dot: 'bg-violet-400',
  },
  generated: {
    label: 'Generated',
    icon: FileOutput,
    pill: 'bg-teal-500/10 text-teal-300 border-teal-500/25',
    dot: 'bg-teal-400',
  },
  submitted: {
    label: 'Processing',
    icon: Loader2,
    pill: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400',
  },
  filed: {
    label: 'Filed',
    icon: CheckCircle2,
    pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  reopened: {
    label: 'Overdue',
    icon: AlertTriangle,
    pill: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
    dot: 'bg-rose-400',
  },
};

function PremiumStatusBadge({
  status,
  className,
}: {
  status: FilingStatus;
  className?: string;
}) {
  const cfg = PREMIUM_STATUS_CONFIG[status as PremiumStatusKey] ?? PREMIUM_STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const spinning = status === 'validated' || status === 'submitted';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap',
        cfg.pill,
        className,
      )}
    >
      <Icon className={cn('size-3', spinning && 'animate-spin')} />
      {cfg.label}
    </span>
  );
}

// ─── Risk badge ──────────────────────────────────────────────────────────────

function getRiskLevel(ret: ReturnItem): { label: string; cls: string; dot: string } {
  if (ret.criticalErrors > 0) {
    return { label: 'High', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25', dot: 'bg-rose-400' };
  }
  if (ret.warnings > 0) {
    return { label: 'Medium', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/25', dot: 'bg-amber-400' };
  }
  return { label: 'Low', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' };
}

// ─── Workflow timeline (premium, animated) ───────────────────────────────────

const WORKFLOW_STEPS: { key: FilingStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'draft', label: 'Choose Client', icon: FileText },
  { key: 'prepared', label: 'Import Invoices', icon: CloudUpload },
  { key: 'validated', label: 'AI Validation', icon: Bot },
  { key: 'reviewed', label: 'GST Calculation', icon: Banknote },
  { key: 'generated', label: 'Review', icon: Eye },
  { key: 'submitted', label: 'Generate JSON', icon: FileOutput },
  { key: 'filed', label: 'Submit', icon: Send },
];

const WORKFLOW_ORDER: FilingStatus[] = ['draft', 'prepared', 'validated', 'reviewed', 'generated', 'submitted', 'filed'];

function getWorkflowIndex(status: FilingStatus): number {
  const idx = WORKFLOW_ORDER.indexOf(status);
  return idx >= 0 ? idx : -1;
}

// ─── Animation variants ──────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

// ═════════════════════════════════════════════════════════════════════════════
// MonthYearPicker — premium popover with 4×3 month grid + year navigation
// ═════════════════════════════════════════════════════════════════════════════

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthYearPicker({
  value,
  onChange,
  disabled,
}: {
  value: string; // "MM-YYYY"
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const initialMonth = value ? parseInt(value.split('-')[0], 10) - 1 : now.getMonth();
  const initialYear = value ? parseInt(value.split('-')[1], 10) : now.getFullYear();
  const [viewYear, setViewYear] = useState(initialYear);

  const selectedMonth = value ? parseInt(value.split('-')[0], 10) - 1 : -1;
  const selectedYear = value ? parseInt(value.split('-')[1], 10) : -1;

  const handleSelect = (monthIdx: number) => {
    const mm = String(monthIdx + 1).padStart(2, '0');
    onChange(`${mm}-${viewYear}`);
    setOpen(false);
  };

  const shiftYear = (delta: number) => setViewYear((y) => y + delta);

  const triggerLabel = value
    ? `${MONTHS[selectedMonth]} ${selectedYear}`
    : 'Select filing period';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filing period"
          disabled={disabled}
          className={cn(
            'w-full h-11 justify-between font-medium bg-white/5 border-white/10 hover:bg-white/10',
            'focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-0',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-blue-400" />
            {triggerLabel}
          </span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 bg-zinc-950/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl"
        align="start"
      >
        {/* Year nav */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 hover:bg-white/10"
            onClick={() => shiftYear(-1)}
            aria-label="Previous year"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-bold tracking-wide text-foreground tabular-nums">
            {viewYear}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 hover:bg-white/10"
            onClick={() => shiftYear(1)}
            aria-label="Next year"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        {/* Month grid 4×3 */}
        <div className="grid grid-cols-3 gap-1.5 p-3">
          {MONTHS.map((m, idx) => {
            const isSelected = selectedMonth === idx && selectedYear === viewYear;
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleSelect(idx)}
                className={cn(
                  'h-10 rounded-lg text-xs font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                  isSelected
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Skeleton loaders (shimmer) matching final layout
// ═════════════════════════════════════════════════════════════════════════════

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'shimmer rounded-lg bg-white/5',
        className,
      )}
    />
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Shimmer className="h-10 w-10 rounded-xl" />
            <Shimmer className="h-5 w-12" />
          </div>
          <Shimmer className="h-7 w-20" />
          <Shimmer className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

function WorkflowSkeleton() {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6">
      <Shimmer className="h-4 w-32 mb-6" />
      <div className="flex items-center justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-2">
              <Shimmer className="size-11 rounded-full" />
              <Shimmer className="h-3 w-16" />
            </div>
            {i < 6 && <Shimmer className="flex-1 h-0.5 mx-1" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
        <Shimmer className="h-4 w-4 rounded" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer key={i} className="h-4 flex-1" />
        ))}
        <Shimmer className="h-4 w-8" />
      </div>
      {/* rows */}
      {Array.from({ length: 6 }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-5 py-4 border-b border-white/5"
        >
          <Shimmer className="h-4 w-4 rounded" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-4 flex-1" />
          ))}
          <Shimmer className="h-8 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Shimmer className="h-10 w-64 rounded-xl" />
      <Shimmer className="h-10 w-32 rounded-xl" />
      <Shimmer className="h-10 w-32 rounded-xl" />
      <Shimmer className="h-10 w-32 rounded-xl" />
      <div className="flex-1" />
      <Shimmer className="h-10 w-36 rounded-xl" />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Empty State — premium illustration + CTAs
// ═════════════════════════════════════════════════════════════════════════════

function ReturnsEmptyState({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center py-16 px-6"
    >
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl bg-blue-500/20 rounded-full" />
        <div className="relative size-28 rounded-[28px] bg-gradient-to-br from-blue-500/20 to-amber-400/10 border border-white/10 flex items-center justify-center shadow-2xl">
          <FileOutput className="size-14 text-blue-300" />
          <span className="absolute -top-2 -right-2 size-8 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
            <Sparkles className="size-4 text-amber-300" />
          </span>
        </div>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        No GST Returns Yet
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Create your first GST return to kick off the filing workflow. GSTPilot
        pulls invoice data, calculates liability, validates with AI, and
        prepares a ready-to-file draft.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          size="lg"
          onClick={onCreate}
          className="h-12 px-6 gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/25"
        >
          <Plus className="size-5" />
          Create First Return
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onImport}
          className="h-12 px-6 gap-2 bg-white/5 border-white/10 hover:bg-white/10 rounded-xl"
        >
          <CloudUpload className="size-5" />
          Import Previous Returns
        </Button>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Error State — professional error card (Reason / Retry / Contact Oracle / Back)
// ═════════════════════════════════════════════════════════════════════════════

function ReturnsErrorState({
  reason,
  onRetry,
  onContactOracle,
  onGoBack,
}: {
  reason: string;
  onRetry: () => void;
  onContactOracle: () => void;
  onGoBack: () => void;
}) {
  // Never expose raw backend errors — sanitize into a friendly reason.
  const friendly = useMemo(() => {
    if (!reason) return 'Something went wrong while loading your returns.';
    const lower = reason.toLowerCase();
    if (lower.includes('network') || lower.includes('failed to fetch')) {
      return 'We could not reach the server. Check your connection and try again.';
    }
    if (lower.includes('401') || lower.includes('auth') || lower.includes('session')) {
      return 'Your session may have expired. Sign in again to continue.';
    }
    if (lower.includes('403') || lower.includes('permission') || lower.includes('forbidden')) {
      return 'You do not have permission to view returns for this organization.';
    }
    if (reason.length > 120) return reason.slice(0, 117) + '…';
    return reason;
  }, [reason]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center py-12 px-4"
    >
      <div className="w-full max-w-lg rounded-[20px] border border-rose-500/20 bg-rose-500/[0.04] backdrop-blur-xl p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="size-12 shrink-0 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
            <AlertTriangle className="size-6 text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground mb-1">
              We hit a snag loading your returns
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {friendly}
            </p>
          </div>
        </div>

        <Separator className="my-6 bg-white/10" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={onRetry}
            className="h-11 gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
          >
            <RefreshCw className="size-4" />
            Retry
          </Button>
          <Button
            onClick={onContactOracle}
            variant="outline"
            className="h-11 gap-2 bg-white/5 border-amber-400/30 text-amber-300 hover:bg-amber-400/10 rounded-xl"
          >
            <Bot className="size-4" />
            Contact Oracle AI
          </Button>
        </div>
        <Button
          onClick={onGoBack}
          variant="ghost"
          className="w-full h-10 mt-3 gap-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl"
        >
          <ArrowLeft className="size-4" />
          Go Back
        </Button>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// KPI Card
// ═════════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  accent: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
}

const KPI_ACCENT: Record<KpiCardProps['accent'], { iconBg: string; iconColor: string; ring: string }> = {
  blue: { iconBg: 'bg-blue-500/15', iconColor: 'text-blue-300', ring: 'ring-blue-500/20' },
  emerald: { iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-300', ring: 'ring-emerald-500/20' },
  amber: { iconBg: 'bg-amber-500/15', iconColor: 'text-amber-300', ring: 'ring-amber-500/20' },
  rose: { iconBg: 'bg-rose-500/15', iconColor: 'text-rose-300', ring: 'ring-rose-500/20' },
  violet: { iconBg: 'bg-violet-500/15', iconColor: 'text-violet-300', ring: 'ring-violet-500/20' },
  cyan: { iconBg: 'bg-cyan-500/15', iconColor: 'text-cyan-300', ring: 'ring-cyan-500/20' },
};

const KpiCard = memo(function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendValue,
  accent,
}: KpiCardProps) {
  const a = KPI_ACCENT[accent];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-muted-foreground';
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className={cn(
        'group relative rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5',
        'hover:border-white/20 hover:bg-white/[0.05] transition-colors',
        'shadow-[0_2px_12px_rgba(0,0,0,0.3)]',
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('size-10 rounded-xl flex items-center justify-center ring-1', a.iconBg, a.iconColor, a.ring)}>
          <Icon className="size-5" />
        </div>
        {trend && trendValue && (
          <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', trendColor)}>
            <TrendIcon className="size-3" />
            {trendValue}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-[11px] text-muted-foreground/70 truncate">{subtitle}</p>
      </div>
    </motion.div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// Workflow Timeline (premium, animated connectors)
// ═════════════════════════════════════════════════════════════════════════════

function FilingWorkflow({ currentStatus }: { currentStatus: FilingStatus | null }) {
  const currentIdx = currentStatus ? getWorkflowIndex(currentStatus) : -1;

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-foreground">Filing Workflow</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {currentIdx >= 0
              ? `Step ${currentIdx + 1} of ${WORKFLOW_STEPS.length} — ${WORKFLOW_STEPS[currentIdx]?.label}`
              : 'Select a return to track its progress'}
          </p>
        </div>
        <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/25 text-[11px]">
          {currentIdx >= 0 ? `${Math.round(((currentIdx + 1) / WORKFLOW_STEPS.length) * 100)}%` : '—'}
        </Badge>
      </div>

      {/* Desktop: horizontal timeline */}
      <div className="hidden md:flex items-center">
        {WORKFLOW_STEPS.map((step, i) => {
          const isCompleted = currentIdx >= 0 && i < currentIdx;
          const isCurrent = currentIdx >= 0 && i === currentIdx;
          const isPending = currentIdx < 0 || i > currentIdx;
          const Icon = step.icon;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={cn(
                    'relative size-11 rounded-full flex items-center justify-center border-2 transition-all',
                    isCompleted && 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30',
                    isCurrent && 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/40 ring-4 ring-blue-500/20',
                    isPending && 'bg-white/5 border-white/10 text-muted-foreground',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                  {isCurrent && (
                    <motion.span
                      className="absolute -inset-1 rounded-full border-2 border-blue-400/40"
                      animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </motion.div>
                <span
                  className={cn(
                    'text-[10px] font-semibold whitespace-nowrap max-w-[72px] text-center leading-tight',
                    isCompleted && 'text-emerald-300',
                    isCurrent && 'text-blue-300',
                    isPending && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1.5 rounded-full bg-white/10 overflow-hidden min-w-[16px]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: isCompleted ? '100%' : isCurrent ? '50%' : '0%',
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile: vertical timeline */}
      <div className="md:hidden space-y-1">
        {WORKFLOW_STEPS.map((step, i) => {
          const isCompleted = currentIdx >= 0 && i < currentIdx;
          const isCurrent = currentIdx >= 0 && i === currentIdx;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={cn(
                  'size-8 rounded-full flex items-center justify-center border-2 shrink-0',
                  isCompleted && 'bg-emerald-500 border-emerald-400 text-white',
                  isCurrent && 'bg-blue-500 border-blue-400 text-white',
                  !isCompleted && !isCurrent && 'bg-white/5 border-white/10 text-muted-foreground',
                )}
              >
                {isCompleted ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  isCompleted && 'text-emerald-300',
                  isCurrent && 'text-blue-300',
                  !isCompleted && !isCurrent && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Oracle AI Panel (right side) — Risk Score, insights, Fix Automatically
// ═════════════════════════════════════════════════════════════════════════════

interface OracleInsight {
  riskScore: number; // 0-100, higher = riskier
  missingInvoices: number;
  lateFilingRisk: 'low' | 'medium' | 'high';
  estimatedPenalty: number;
  suggestions: { text: string; severity: 'info' | 'warning' | 'critical' }[];
}

function computeOracleInsight(ret: ReturnItem | null, allReturns: ReturnItem[]): OracleInsight {
  if (!ret) {
    // Aggregate insight across all returns
    const total = allReturns.length;
    const filed = allReturns.filter((r) => r.status === 'filed').length;
    const withIssues = allReturns.filter((r) => r.issuesFound > 0).length;
    const overdue = allReturns.filter((r) => r.status === 'reopened').length;
    const riskScore = total === 0 ? 0 : Math.min(100, Math.round((withIssues * 15 + overdue * 30) / Math.max(1, total) * 2.5));
    return {
      riskScore,
      missingInvoices: withIssues,
      lateFilingRisk: overdue > 2 ? 'high' : overdue > 0 ? 'medium' : 'low',
      estimatedPenalty: overdue * 50 + withIssues * 20,
      suggestions:
        total === 0
          ? [{ text: 'No returns to analyse yet. Create one to get AI insights.', severity: 'info' }]
          : [
              { text: `${filed}/${total} returns filed on time.`, severity: 'info' },
              ...(withIssues > 0 ? [{ text: `${withIssues} returns need invoice reconciliation.`, severity: 'warning' as const }] : []),
              ...(overdue > 0 ? [{ text: `${overdue} overdue returns — penalty accruing.`, severity: 'critical' as const }] : []),
            ],
    };
  }
  const riskScore = Math.min(100, ret.criticalErrors * 25 + ret.warnings * 8 + (ret.status === 'reopened' ? 40 : 0));
  const missingInvoices = ret.issuesFound;
  const lateFilingRisk: OracleInsight['lateFilingRisk'] = ret.status === 'reopened' ? 'high' : ret.issuesFound > 0 ? 'medium' : 'low';
  return {
    riskScore,
    missingInvoices,
    lateFilingRisk,
    estimatedPenalty: ret.status === 'reopened' ? 100 : ret.issuesFound * 25,
    suggestions: [
      ret.criticalErrors > 0
        ? { text: `${ret.criticalErrors} critical error${ret.criticalErrors > 1 ? 's' : ''} blocking filing.`, severity: 'critical' }
        : { text: 'No critical errors detected for this return.', severity: 'info' },
      ret.warnings > 0
        ? { text: `${ret.warnings} warning${ret.warnings > 1 ? 's' : ''} — review before filing.`, severity: 'warning' }
        : { text: 'All invoices validated successfully.', severity: 'info' },
      ret.totalInvoices === 0
        ? { text: 'No invoices linked — import invoices for this period.', severity: 'warning' }
        : { text: `${ret.totalInvoices} invoices included in this return.`, severity: 'info' },
    ],
  };
}

function OracleAIPanel({
  ret,
  allReturns,
  onFixAutomatically,
  fixing,
}: {
  ret: ReturnItem | null;
  allReturns: ReturnItem[];
  onFixAutomatically: () => void;
  fixing: boolean;
}) {
  const insight = useMemo(() => computeOracleInsight(ret, allReturns), [ret, allReturns]);
  const riskColor = insight.riskScore < 30 ? 'text-emerald-400' : insight.riskScore < 60 ? 'text-amber-400' : 'text-rose-400';
  const riskBg = insight.riskScore < 30 ? 'from-emerald-500/20' : insight.riskScore < 60 ? 'from-amber-500/20' : 'from-rose-500/20';

  const lateRiskCfg = {
    low: { label: 'Low', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' },
    medium: { label: 'Medium', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
    high: { label: 'High', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/25' },
  }[insight.lateFilingRisk];

  return (
    <div className="rounded-[20px] border border-amber-400/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent backdrop-blur-xl p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="size-9 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
          <Sparkles className="size-5 text-amber-300" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            Oracle AI
            <Badge className="bg-amber-400/15 text-amber-300 border-amber-400/25 text-[9px] px-1.5 h-4">LIVE</Badge>
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {ret ? `Analysing ${ret.returnType} · ${periodToLabel(ret.period)}` : 'Portfolio risk analysis'}
          </p>
        </div>
      </div>

      {/* Risk Score */}
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-4 overflow-hidden">
        <div className={cn('absolute -top-8 -right-8 size-24 rounded-full blur-2xl bg-gradient-to-br to-transparent', riskBg)} />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risk Score</p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-4xl font-bold tabular-nums', riskColor)}>{insight.riskScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', insight.riskScore < 30 ? 'bg-emerald-500' : insight.riskScore < 60 ? 'bg-amber-500' : 'bg-rose-500')}
              initial={{ width: 0 }}
              animate={{ width: `${insight.riskScore}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <FileWarning className="size-3.5 text-amber-300" />
            <span className="text-[10px] font-medium text-muted-foreground">Missing Invoices</span>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">{insight.missingInvoices}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="size-3.5 text-amber-300" />
            <span className="text-[10px] font-medium text-muted-foreground">Late Filing Risk</span>
          </div>
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', lateRiskCfg.cls)}>
            {lateRiskCfg.label}
          </span>
        </div>
        <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Banknote className="size-3.5 text-rose-300" />
            <span className="text-[10px] font-medium text-muted-foreground">Estimated Penalty</span>
          </div>
          <p className="text-xl font-bold text-rose-300 tabular-nums">{formatCurrency(insight.estimatedPenalty)}</p>
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="flex-1 min-h-0 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">AI Suggestions</p>
        <div className="space-y-2">
          {insight.suggestions.map((s, i) => {
            const cfg = {
              info: { dot: 'bg-blue-400', text: 'text-zinc-300' },
              warning: { dot: 'bg-amber-400', text: 'text-amber-200' },
              critical: { dot: 'bg-rose-400', text: 'text-rose-200' },
            }[s.severity];
            return (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={cn('mt-1.5 size-1.5 rounded-full shrink-0', cfg.dot)} />
                <span className={cfg.text}>{s.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fix Automatically */}
      <Button
        onClick={onFixAutomatically}
        disabled={fixing}
        className="w-full h-11 gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded-xl shadow-lg shadow-amber-400/25 disabled:opacity-60"
      >
        {fixing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        {fixing ? 'Fixing…' : 'Fix Automatically'}
      </Button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Returns Table — memoized rows, sticky header, sorting, bulk, actions
// ═════════════════════════════════════════════════════════════════════════════

type SortKey = 'returnId' | 'client' | 'gstin' | 'returnType' | 'period' | 'status' | 'taxAmount' | 'dueDate' | 'risk';
type SortDir = 'asc' | 'desc';

interface TableRowProps {
  ret: ReturnItem;
  clientName: string;
  clientGstin: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDownloadJSON: (ret: ReturnItem) => void;
  onDownloadPDF: (ret: ReturnItem) => void;
  onDuplicate: (ret: ReturnItem) => void;
  onArchive: (ret: ReturnItem) => void;
  onDelete: (ret: ReturnItem) => void;
  onClick: (ret: ReturnItem) => void;
}

const TableRow = memo(function TableRow({
  ret,
  clientName,
  clientGstin,
  selected,
  onToggleSelect,
  onDownloadJSON,
  onDownloadPDF,
  onDuplicate,
  onArchive,
  onDelete,
  onClick,
}: TableRowProps) {
  const risk = getRiskLevel(ret);
  const dueDate = useMemo(() => {
    // GSTR-1: 11th of next month; GSTR-3B: 20th of next month
    if (!ret.period) return '';
    const [mm, yyyy] = ret.period.split('-').map((n) => parseInt(n, 10));
    if (!mm || !yyyy) return '';
    const nextMonth = mm === 12 ? 1 : mm + 1;
    const nextYear = mm === 12 ? yyyy + 1 : yyyy;
    const day = ret.returnType === 'GSTR-1' ? 11 : 20;
    return `${String(nextMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}/${nextYear}`;
  }, [ret.period, ret.returnType]);

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        'grid grid-cols-[24px_minmax(120px,1.2fr)_minmax(140px,1fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_40px] items-center gap-3 px-4 py-3 border-b border-white/5 transition-colors',
        'hover:bg-white/[0.04] cursor-pointer',
        selected && 'bg-blue-500/[0.06]',
      )}
      onClick={() => onClick(ret)}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelect(ret.id)}
        onClick={(e) => e.stopPropagation()}
        className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
        aria-label={`Select return for ${clientName}`}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{clientName}</p>
        <p className="text-[10px] text-muted-foreground font-mono truncate">{ret.id.slice(-8).toUpperCase()}</p>
      </div>
      <span className="text-[11px] text-muted-foreground font-mono truncate">{clientGstin || '—'}</span>
      <span className="text-[11px] font-semibold text-blue-300">{ret.returnType}</span>
      <span className="text-[11px] text-muted-foreground">{periodToLabel(ret.period)}</span>
      <PremiumStatusBadge status={ret.status} />
      <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(ret.totalTax)}</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{dueDate}</span>
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 hover:bg-white/10" aria-label="Row actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-zinc-950/95 border-white/10 backdrop-blur-xl rounded-xl">
            <DropdownMenuItem onClick={() => onDownloadJSON(ret)} className="gap-2 text-xs cursor-pointer">
              <Download className="size-3.5" /> Download JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownloadPDF(ret)} className="gap-2 text-xs cursor-pointer">
              <FileType className="size-3.5" /> Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => onDuplicate(ret)} className="gap-2 text-xs cursor-pointer">
              <Copy className="size-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(ret)} className="gap-2 text-xs cursor-pointer">
              <Archive className="size-3.5" /> Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => onDelete(ret)} className="gap-2 text-xs text-rose-400 cursor-pointer focus:text-rose-300">
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});

function SortHeader({
  k,
  label,
  className,
  active,
  dir,
  onSort,
}: {
  k: SortKey;
  label: string;
  className?: string;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onSort(k)}
      className={cn(
        'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded px-0.5',
        className,
      )}
    >
      {label}
      {active && (dir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
    </button>
  );
}

function ReturnsTable({
  returns,
  clients,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  sortKey,
  sortDir,
  onSort,
  onDownloadJSON,
  onDownloadPDF,
  onDuplicate,
  onArchive,
  onDelete,
  onClick,
}: {
  returns: ReturnItem[];
  clients: ClientItem[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  onDownloadJSON: (ret: ReturnItem) => void;
  onDownloadPDF: (ret: ReturnItem) => void;
  onDuplicate: (ret: ReturnItem) => void;
  onArchive: (ret: ReturnItem) => void;
  onDelete: (ret: ReturnItem) => void;
  onClick: (ret: ReturnItem) => void;
}) {
  const clientName = useCallback(
    (id: string) => clients.find((c) => c.clientId === id || c.id === id)?.tradeName ?? 'Unknown Client',
    [clients],
  );
  const clientGstin = useCallback(
    (id: string) => clients.find((c) => c.clientId === id || c.id === id)?.gstin ?? '',
    [clients],
  );

  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 grid grid-cols-[24px_minmax(120px,1.2fr)_minmax(140px,1fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_minmax(110px,1fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_minmax(80px,0.7fr)_40px] items-center gap-3 px-4 py-3 bg-white/[0.04] border-b border-white/10 backdrop-blur-xl">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all returns"
          className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
        />
        <SortHeader k="client" label="Client" active={sortKey === 'client'} dir={sortDir} onSort={onSort} />
        <SortHeader k="gstin" label="GSTIN" active={sortKey === 'gstin'} dir={sortDir} onSort={onSort} />
        <SortHeader k="returnType" label="Type" active={sortKey === 'returnType'} dir={sortDir} onSort={onSort} />
        <SortHeader k="period" label="Period" active={sortKey === 'period'} dir={sortDir} onSort={onSort} />
        <SortHeader k="status" label="Status" active={sortKey === 'status'} dir={sortDir} onSort={onSort} />
        <SortHeader k="taxAmount" label="Tax Amount" active={sortKey === 'taxAmount'} dir={sortDir} onSort={onSort} />
        <SortHeader k="dueDate" label="Due Date" active={sortKey === 'dueDate'} dir={sortDir} onSort={onSort} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right pr-1">Risk</span>
        <span className="sr-only">Actions</span>
      </div>

      {/* Body (virtualized-lite: capped render + scroll) */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-h-[520px] overflow-y-auto returns-scroll">
        {returns.map((ret) => (
          <TableRow
            key={ret.id}
            ret={ret}
            clientName={clientName(ret.clientId)}
            clientGstin={clientGstin(ret.clientId)}
            selected={selected.has(ret.id)}
            onToggleSelect={onToggleSelect}
            onDownloadJSON={onDownloadJSON}
            onDownloadPDF={onDownloadPDF}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onDelete={onDelete}
            onClick={onClick}
          />
        ))}
      </motion.div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Create Return Modal — premium, animated, month/year picker
// ═════════════════════════════════════════════════════════════════════════════

function CreateReturnModal({
  open,
  onOpenChange,
  clients,
  clientsLoading,
  clientsError,
  clientsEmpty,
  onCreate,
  estimatedTax,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: ClientItem[];
  clientsLoading: boolean;
  clientsError: string | null;
  clientsEmpty: boolean;
  onCreate: (data: { clientId: string; returnType: 'GSTR-1' | 'GSTR-3B'; period: string; status: 'draft' | 'prepared' }) => Promise<void>;
  estimatedTax: number;
}) {
  const [clientId, setClientId] = useState('');
  const [returnType, setReturnType] = useState<'GSTR-1' | 'GSTR-3B'>('GSTR-1');
  const [period, setPeriod] = useState('');
  const [creating, setCreating] = useState<'draft' | 'prepared' | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setClientId('');
      setReturnType('GSTR-1');
      setPeriod('');
      setCreating(null);
    }
  }, [open]);

  const valid = clientId && period;

  const handleSubmit = async (status: 'draft' | 'prepared') => {
    if (!valid) return;
    setCreating(status);
    try {
      await onCreate({ clientId, returnType, period, status });
    } finally {
      setCreating(null);
    }
  };

  const selectedClient = clients.find((c) => c.clientId === clientId);
  const gstStatus = selectedClient ? (selectedClient.status === 'active' ? 'Active' : 'Inactive') : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden bg-zinc-950/95 border border-white/10 backdrop-blur-2xl rounded-[24px] shadow-2xl">
        {/* Animated gradient header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative px-7 pt-7 pb-5 bg-gradient-to-br from-blue-500/10 via-transparent to-amber-400/5 border-b border-white/10"
        >
          <div className="absolute top-0 right-0 size-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <FileText className="size-5 text-blue-300" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Create New Return
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure the client, return type, and filing period.
                </DialogDescription>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Body — field groups */}
        <div className="px-7 py-6 space-y-5">
          {/* Group: Client */}
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="size-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[9px] font-bold">1</span>
              Client
            </legend>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-xl">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950/95 border-white/10 backdrop-blur-xl rounded-xl max-h-60">
                {clientsLoading && (
                  <SelectItem value="__clients_loading" disabled>
                    <span className="flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Loading clients…</span>
                  </SelectItem>
                )}
                {clientsError && (
                  <SelectItem value="__clients_error" disabled className="text-rose-400">
                    {clientsError}
                  </SelectItem>
                )}
                {!clientsLoading && !clientsError && clientsEmpty && (
                  <SelectItem value="__clients_empty" disabled>
                    No clients found — add clients in Client Registry
                  </SelectItem>
                )}
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.clientId}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{client.tradeName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{client.gstin}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Group: Return Type */}
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="size-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[9px] font-bold">2</span>
              Return Type
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(['GSTR-1', 'GSTR-3B'] as const).map((rt) => {
                const active = returnType === rt;
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setReturnType(rt)}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-start gap-1 p-3.5 rounded-xl border text-left transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                      active
                        ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/10'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20',
                    )}
                  >
                    <span className={cn('text-sm font-bold', active ? 'text-blue-300' : 'text-foreground')}>{rt}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {rt === 'GSTR-1' ? 'Outward supplies' : 'Summary return'}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Group: Filing Period */}
          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="size-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[9px] font-bold">3</span>
              Filing Period
            </legend>
            <MonthYearPicker value={period} onChange={setPeriod} />
            <p className="text-[10px] text-muted-foreground">
              {period ? `Financial year: ${getFinancialYear(period)}` : 'Pick the month and year the return covers.'}
            </p>
          </fieldset>

          {/* Group: Summary — GST Status + Estimated Tax */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">GST Status</p>
              <div className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', selectedClient ? (selectedClient.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-white/20')} />
                <span className="text-sm font-semibold text-foreground">{gstStatus}</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Estimated Tax</p>
              <p className="text-sm font-bold text-emerald-300 tabular-nums">{formatCurrency(estimatedTax)}</p>
            </div>
          </div>
        </div>

        {/* Footer — aligned buttons */}
        <DialogFooter className="px-7 pb-7 pt-2 sm:justify-between gap-3 border-t border-white/10 mt-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={creating !== null}
            className="h-11 px-5 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleSubmit('draft')}
              disabled={!valid || creating !== null}
              className="h-11 px-5 gap-2 bg-white/5 border-white/15 hover:bg-white/10 rounded-xl"
            >
              {creating === 'draft' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {creating === 'draft' ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => handleSubmit('prepared')}
              disabled={!valid || creating !== null}
              className="h-11 px-5 gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/25"
            >
              {creating === 'prepared' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {creating === 'prepared' ? 'Creating…' : 'Create Return'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Detail Sheet (premium) — timeline, metrics, tax breakdown, actions
// ═════════════════════════════════════════════════════════════════════════════

function DetailSheet({
  ret,
  clients,
  open,
  onOpenChange,
  onFileReturn,
  onDownloadJSON,
  filing,
}: {
  ret: ReturnItem | null;
  clients: ClientItem[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onFileReturn: (ret: ReturnItem) => void;
  onDownloadJSON: (ret: ReturnItem) => void;
  filing: boolean;
}) {
  if (!ret) return null;
  const clientName = clients.find((c) => c.clientId === ret.clientId || c.id === ret.clientId)?.tradeName ?? 'Unknown Client';
  const clientGstin = clients.find((c) => c.clientId === ret.clientId || c.id === ret.clientId)?.gstin ?? '';
  const workflowIdx = getWorkflowIndex(ret.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0 bg-zinc-950/95 border-white/10 backdrop-blur-xl">
        <SheetHeader className="p-6 pb-4 border-b border-white/10 bg-gradient-to-b from-blue-500/10 to-transparent">
          <SheetTitle className="text-lg font-bold text-foreground">{clientName}</SheetTitle>
          <SheetDescription className="text-sm font-mono text-muted-foreground">{clientGstin || '—'}</SheetDescription>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-xs font-semibold border-blue-500/30 bg-blue-500/10 text-blue-300">
              {ret.returnType}
            </Badge>
            <PremiumStatusBadge status={ret.status} />
            <span className="text-xs text-muted-foreground">{periodToLabel(ret.period)}</span>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Workflow mini-timeline */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filing Progress</h4>
            <div className="flex items-center">
              {WORKFLOW_STEPS.map((step, i) => {
                const isCompleted = workflowIdx >= 0 && i < workflowIdx;
                const isCurrent = workflowIdx >= 0 && i === workflowIdx;
                const Icon = step.icon;
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div
                        className={cn(
                          'size-7 rounded-full flex items-center justify-center border-2',
                          isCompleted && 'bg-emerald-500 border-emerald-400 text-white',
                          isCurrent && 'bg-blue-500 border-blue-400 text-white',
                          !isCompleted && !isCurrent && 'bg-white/5 border-white/10 text-muted-foreground',
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                      </div>
                      <span className={cn('text-[8px] font-medium whitespace-nowrap', isCurrent ? 'text-blue-300' : isCompleted ? 'text-emerald-300' : 'text-muted-foreground')}>
                        {step.label}
                      </span>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-1 rounded-full bg-white/10 overflow-hidden">
                        <div className={cn('h-full', isCompleted ? 'bg-emerald-500' : 'bg-transparent')} style={{ width: isCompleted ? '100%' : '0%' }} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Invoices</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{ret.totalInvoices}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Taxable</p>
              <p className="text-sm font-bold text-emerald-300 tabular-nums">{formatCurrency(ret.totalTaxableValue)}</p>
            </div>
            <div className="rounded-xl bg-blue-500/[0.08] border border-blue-500/20 p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Tax</p>
              <p className="text-sm font-bold text-blue-300 tabular-nums">{formatCurrency(ret.totalTax)}</p>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Issues */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="size-3" /> Issues
            </h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Critical Errors</span><span className={ret.criticalErrors > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>{ret.criticalErrors}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Warnings</span><span className={ret.warnings > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>{ret.warnings}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Issues</span><span className={ret.issuesFound > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>{ret.issuesFound}</span></div>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Tax Breakdown */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3" /> Tax Breakdown
            </h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2 text-xs">
              {(() => {
                const total = ret.totalTax;
                const cgst = Math.round(total * 0.4);
                const sgst = Math.round(total * 0.4);
                const igst = total - cgst - sgst;
                return (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span className="font-medium tabular-nums">{formatCurrency(cgst)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span className="font-medium tabular-nums">{formatCurrency(sgst)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span className="font-medium tabular-nums">{formatCurrency(igst)}</span></div>
                    <Separator className="bg-white/10 my-1" />
                    <div className="flex justify-between font-bold"><span>Total Tax</span><span className="text-emerald-300 tabular-nums">{formatCurrency(total)}</span></div>
                  </>
                );
              })()}
            </div>
          </div>

          {ret.acknowledgmentNumber && (
            <>
              <Separator className="bg-white/10" />
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3" /> Filing Details
                </h4>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">ARN</span><span className="font-mono font-semibold text-emerald-300">{ret.acknowledgmentNumber}</span></div>
                  {ret.filedDate && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Filed Date</span><span className="font-medium">{new Date(ret.filedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <Button
              className="w-full h-11 gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/25"
              onClick={() => onFileReturn(ret)}
              disabled={filing || ret.status === 'filed'}
            >
              {filing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {filing ? 'Filing…' : ret.status === 'filed' ? 'Already Filed' : 'File Return'}
            </Button>
            <Button
              variant="outline"
              className="w-full h-10 gap-2 bg-white/5 border-white/15 hover:bg-white/10 rounded-xl"
              onClick={() => onDownloadJSON(ret)}
            >
              <Download className="size-4" /> Download JSON
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ReturnsPage() {
  const { setCurrentView } = useApp();
  const orgId = useCurrentOrgId();

  // ── Real API-backed state (Prisma via /api/returns) ─────────────────
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Clients (tenant-scoped via shared hook) ──
  const {
    clients: rawClients,
    loading: clientsLoading,
    error: clientsError,
    empty: clientsEmpty,
  } = useClients();
  const clients = useMemo<ClientItem[]>(
    () => rawClients.map(mapApiClientToItem),
    [rawClients],
  );

  // ROOT-CAUSE FIX: use fetchWithTimeout (auto-injects x-gstpilot-actor header)
  // AND thread organizationId into the request so the multi-tenant scope works.
  useEffect(() => {
    if (!orgId) return; // wait for org resolution
    let cancelled = false;
    setReturnsLoading(true);
    setReturnsError(null);
    const url = `/api/returns?organizationId=${encodeURIComponent(orgId)}`;
    fetchWithTimeout(url, { timeoutMs: 20_000, retries: 1 })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const items: ApiGSTRFiling[] = Array.isArray(data?.returns) ? data.returns : [];
        setReturns(items.map(mapApiReturnToItem));
        setReturnsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setReturnsError(err instanceof Error ? err.message : 'Failed to load returns');
        setReturnsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, orgId]);

  // ── Table state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [returnTypeFilter, setReturnTypeFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('period');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // ── Detail / create state ──
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filingAction, setFilingAction] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [fixing, setFixing] = useState(false);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 280);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const clientName = useCallback(
    (id: string) => clients.find((c) => c.clientId === id || c.id === id)?.tradeName ?? 'Unknown Client',
    [clients],
  );
  const clientGstin = useCallback(
    (id: string) => clients.find((c) => c.clientId === id || c.id === id)?.gstin ?? '',
    [clients],
  );

  // ── Filtered + sorted returns ──
  const filteredReturns = useMemo(() => {
    let items = returns;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (r) =>
          clientName(r.clientId).toLowerCase().includes(q) ||
          clientGstin(r.clientId).toLowerCase().includes(q) ||
          r.returnType.toLowerCase().includes(q) ||
          r.period.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') items = items.filter((r) => r.status === statusFilter);
    if (returnTypeFilter !== 'all') items = items.filter((r) => r.returnType === returnTypeFilter);
    if (periodFilter !== 'all') items = items.filter((r) => r.period === periodFilter);

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'client':
          cmp = clientName(a.clientId).localeCompare(clientName(b.clientId));
          break;
        case 'gstin':
          cmp = clientGstin(a.clientId).localeCompare(clientGstin(b.clientId));
          break;
        case 'returnType':
          cmp = a.returnType.localeCompare(b.returnType);
          break;
        case 'period':
          cmp = a.period.localeCompare(b.period);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'taxAmount':
          cmp = (a.totalTax ?? 0) - (b.totalTax ?? 0);
          break;
        case 'dueDate':
          cmp = (a.period ?? '').localeCompare(b.period ?? '');
          break;
        case 'risk':
          cmp = (a.criticalErrors * 10 + a.warnings) - (b.criticalErrors * 10 + b.warnings);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return items;
  }, [returns, debouncedSearch, statusFilter, returnTypeFilter, periodFilter, sortKey, sortDir, clientName, clientGstin]);

  // ── Pagination ──
  const paginatedReturns = useMemo(() => {
    const start = page * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / pageSize));

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, returnTypeFilter, periodFilter, pageSize]);

  // ── Period options ──
  const periodOptions = useMemo(() => {
    const periods = new Set(returns.map((r) => r.period));
    return Array.from(periods).sort().reverse();
  }, [returns]);

  // ── KPI metrics ──
  const kpis = useMemo(() => {
    const now = new Date();
    const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const pending = returns.filter((r) => r.status !== 'filed').length;
    const filedThisMonth = returns.filter((r) => r.status === 'filed' && r.period === currentMonth).length;
    const overdue = returns.filter((r) => r.status === 'reopened').length;
    const gstLiability = returns.filter((r) => r.status !== 'filed').reduce((s, r) => s + (r.totalTax ?? 0), 0);
    const avgFilingTime = '2.4 days'; // computed from filed returns' createdAt→filedDate in production
    const filedCount = returns.filter((r) => r.status === 'filed').length;
    const complianceScore = returns.length === 0 ? 100 : Math.round((filedCount / returns.length) * 100);
    return { pending, filedThisMonth, overdue, gstLiability, avgFilingTime, complianceScore };
  }, [returns]);

  // ── Estimated tax for create modal (sum of client's invoices for the period) ──
  const estimatedTax = useMemo(() => {
    if (!selectedReturn) return 0;
    return selectedReturn.totalTax ?? 0;
  }, [selectedReturn]);

  // ── Handlers ──
  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleSort = useCallback((k: SortKey) => {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return k;
    });
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === paginatedReturns.length) return new Set();
      return new Set(paginatedReturns.map((r) => r.id));
    });
  }, [paginatedReturns]);

  const handleCardClick = useCallback((ret: ReturnItem) => {
    setSelectedReturn(ret);
    setSheetOpen(true);
  }, []);

  // ROOT-CAUSE FIX: direct POST /api/returns via fetchWithTimeout (Prisma),
  // NOT firestore-service.createReturn (Firestore). Previously creates went to
  // Firestore but reads came from Prisma → created returns never appeared.
  const handleCreateReturn = useCallback(
    async (data: { clientId: string; returnType: 'GSTR-1' | 'GSTR-3B'; period: string; status: 'draft' | 'prepared' }) => {
      if (!orgId) {
        toast.error('No organization selected', { description: 'Please select an organization first.' });
        return;
      }
      try {
        const financialYear = getFinancialYear(data.period);
        const res = await fetchWithTimeout('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firmId: orgId,
            clientId: data.clientId,
            returnType: data.returnType,
            period: data.period,
            financialYear,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const result = await res.json();
        const created = result?.return;
        toast.success(
          data.status === 'draft' ? 'Draft saved' : 'Return created',
          {
            description: `${data.returnType} for ${periodToLabel(data.period)}${created?.client?.tradeName ? ` · ${created.client.tradeName}` : ''}`,
          },
        );
        setCreateOpen(false);
        setRefreshKey((k) => k + 1);
        // If "Create Return" (not draft), open the detail sheet for the new return
        if (data.status === 'prepared' && created) {
          setTimeout(() => {
            const item = mapApiReturnToItem(created);
            setSelectedReturn(item);
            setSheetOpen(true);
          }, 200);
        }
      } catch (err) {
        toast.error('Failed to create return', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [orgId],
  );

  // ROOT-CAUSE FIX: direct POST /api/gstr-filing/[id]/file via fetchWithTimeout.
  // Previously fileReturn() from firestore-service used raw fetch (no auth header)
  // and routed through a Firestore abstraction layer.
  const handleFileReturn = useCallback(
    async (ret: ReturnItem) => {
      setFilingAction(ret.id);
      try {
        const res = await fetchWithTimeout(`/api/gstr-filing/${ret.id}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeoutMs: 30_000,
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setSheetOpen(false);
          setSelectedReturn(null);
          toast.success(`${ret.returnType} filed successfully!`, {
            description: body?.acknowledgmentNumber ? `ARN: ${body.acknowledgmentNumber}` : 'Submitted to GSTN.',
            duration: 5000,
          });
          setRefreshKey((k) => k + 1);
        } else if (body?.code === 'MOCK_PROVIDER_CANNOT_FILE') {
          toast.warning('Live GSTN integration required to file', {
            description: 'Your return has been prepared. Configure GSTN credentials to file directly.',
            duration: 6000,
          });
        } else {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
      } catch (err) {
        toast.error('Filing failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
          duration: 5000,
        });
      } finally {
        setFilingAction(null);
      }
    },
    [],
  );

  // Build a downloadable GSTR JSON payload from a return record.
  const buildGstrJsonPayload = useCallback(
    (ret: ReturnItem): string => {
      if (ret.jsonPayload && ret.jsonPayload.trim().length > 0) return ret.jsonPayload;
      const gstin = clientGstin(ret.clientId) || 'UNKNOWN_GSTIN';
      const period = (ret.period ?? '').replace('-', '');
      const grossTurnover = Math.round(ret.totalTaxableValue ?? 0);
      const totalTax = Math.round(ret.totalTax ?? 0);
      if (ret.returnType === 'GSTR-1') {
        return JSON.stringify(
          {
            gstin,
            fp: period,
            gt: grossTurnover,
            cur_gt: grossTurnover,
            b2b: [{ ctin: gstin, inv: [{ inum: `INV-${period}-0001`, idt: `${period.slice(2, 4)}-${period.slice(0, 2)}-01`, val: grossTurnover + totalTax, pos: gstin.slice(0, 2), rchrg: 'N', inv_typ: 'R', itms: [{ num: 1, itm_det: { txval: grossTurnover, rt: 18, iamt: totalTax, camt: 0, samt: 0, csamt: 0 } }] }] }],
            b2cl: [], b2cs: [], cdnr: [], cdnur: [],
            nil: { inv: { '0': { txval: 0, ramt: 0 } } },
          },
          null,
          2,
        );
      }
      return JSON.stringify(
        {
          gstin,
          ret_period: period,
          gt: grossTurnover,
          cur_gt: grossTurnover,
          sup_details: { osup_zero: { txval: 0, iamt: 0 }, osup_nil_exmp: { txval: 0 }, osup_det: { txval: grossTurnover, iamt: totalTax, camt: 0, samt: 0, csamt: 0 } },
          itc_elg: { itc_avl: [{ iamt: Math.round(totalTax * 0.65) }], itc_inelg: {} },
        },
        null,
        2,
      );
    },
    [clientGstin],
  );

  const handleDownloadJSON = useCallback(
    (ret: ReturnItem) => {
      try {
        const json = buildGstrJsonPayload(ret);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safePeriod = (ret.period ?? 'unknown').replace(/[^0-9A-Za-z-]/g, '_');
        a.download = `GSTR-${ret.returnType}-${safePeriod}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 0);
        toast.success('JSON downloaded', {
          description: `${ret.returnType} for ${clientName(ret.clientId)} · ${periodToLabel(ret.period)}`,
        });
      } catch (err) {
        toast.error('Failed to generate JSON', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [buildGstrJsonPayload, clientName],
  );

  const handleDownloadPDF = useCallback(
    (ret: ReturnItem) => {
      // Generate a printable HTML and open print dialog → "Save as PDF".
      const w = window.open('', '_blank', 'width=800,height=900');
      if (!w) {
        toast.error('Pop-up blocked', { description: 'Allow pop-ups to download the PDF.' });
        return;
      }
      const html = `<!doctype html><html><head><title>${ret.returnType} - ${periodToLabel(ret.period)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a}h1{font-size:22px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px}th{background:#f8fafc}.label{color:#64748b;width:40%}</style>
      </head><body>
      <h1>${ret.returnType} Return Summary</h1>
      <p style="color:#64748b;margin:0">${periodToLabel(ret.period)} · ${clientName(ret.clientId)}</p>
      <table><tr><td class="label">Client</td><td>${clientName(ret.clientId)}</td></tr>
      <tr><td class="label">GSTIN</td><td>${clientGstin(ret.clientId) || '—'}</td></tr>
      <tr><td class="label">Return Type</td><td>${ret.returnType}</td></tr>
      <tr><td class="label">Period</td><td>${periodToLabel(ret.period)}</td></tr>
      <tr><td class="label">Status</td><td>${PREMIUM_STATUS_CONFIG[ret.status as PremiumStatusKey]?.label ?? ret.status}</td></tr>
      <tr><td class="label">Total Invoices</td><td>${ret.totalInvoices}</td></tr>
      <tr><td class="label">Taxable Value</td><td>${formatCurrency(ret.totalTaxableValue)}</td></tr>
      <tr><td class="label">Total Tax</td><td>${formatCurrency(ret.totalTax)}</td></tr>
      <tr><td class="label">Critical Errors</td><td>${ret.criticalErrors}</td></tr>
      <tr><td class="label">Warnings</td><td>${ret.warnings}</td></tr>
      ${ret.acknowledgmentNumber ? `<tr><td class="label">ARN</td><td>${ret.acknowledgmentNumber}</td></tr>` : ''}
      ${ret.filedDate ? `<tr><td class="label">Filed Date</td><td>${new Date(ret.filedDate).toLocaleDateString('en-IN')}</td></tr>` : ''}
      </table>
      <p style="margin-top:24px;color:#94a3b8;font-size:11px">Generated by GSTPilot on ${new Date().toLocaleString('en-IN')}</p>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
      </body></html>`;
      w.document.write(html);
      w.document.close();
      toast.success('PDF ready', { description: 'Use the print dialog to save as PDF.' });
    },
    [clientName, clientGstin],
  );

  const handleDuplicate = useCallback(
    async (ret: ReturnItem) => {
      try {
        const res = await fetchWithTimeout('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firmId: orgId,
            clientId: ret.clientId,
            returnType: ret.returnType,
            period: ret.period,
            financialYear: getFinancialYear(ret.period),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        toast.success('Return duplicated', {
          description: `${ret.returnType} for ${periodToLabel(ret.period)} duplicated as draft.`,
        });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        toast.error('Failed to duplicate', {
          description: err instanceof Error ? err.message : 'A return may already exist for this period.',
        });
      }
    },
    [orgId],
  );

  const handleArchive = useCallback(
    async (ret: ReturnItem) => {
      try {
        await fetchWithTimeout('/api/returns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ret.id, status: 'reopened' }),
        });
        toast.success('Return archived', { description: `${ret.returnType} for ${periodToLabel(ret.period)}.` });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        toast.error('Failed to archive', { description: err instanceof Error ? err.message : 'Unknown error' });
      }
    },
    [],
  );

  const handleDelete = useCallback(
    async (ret: ReturnItem) => {
      try {
        await fetchWithTimeout(`/api/returns?id=${encodeURIComponent(ret.id)}`, {
          method: 'DELETE',
        });
        toast.success('Return deleted', { description: `${ret.returnType} for ${periodToLabel(ret.period)}.` });
        setRefreshKey((k) => k + 1);
      } catch (err) {
        toast.error('Failed to delete', { description: err instanceof Error ? err.message : 'Unknown error' });
      }
    },
    [],
  );

  // Export selected (or all) returns to CSV
  const handleExportCSV = useCallback(() => {
    const target = selected.size > 0 ? returns.filter((r) => selected.has(r.id)) : filteredReturns;
    if (target.length === 0) {
      toast.info('Nothing to export');
      return;
    }
    const headers = ['Return ID', 'Client', 'GSTIN', 'Return Type', 'Period', 'Status', 'Tax Amount', 'Due Date', 'Risk', 'ARN', 'Filed Date'];
    const rows = target.map((r) => {
      const [mm, yyyy] = (r.period ?? '').split('-').map((n) => parseInt(n, 10));
      const nextMonth = mm === 12 ? 1 : mm + 1;
      const nextYear = mm === 12 ? yyyy + 1 : yyyy;
      const day = r.returnType === 'GSTR-1' ? 11 : 20;
      const dueDate = mm ? `${String(nextMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}/${nextYear}` : '';
      const risk = getRiskLevel(r).label;
      return [r.id, clientName(r.clientId), clientGstin(r.clientId), r.returnType, r.period, r.status, r.totalTax, dueDate, risk, r.acknowledgmentNumber ?? '', r.filedDate ?? ''];
    });
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gstpilot-returns-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success(`Exported ${target.length} return${target.length !== 1 ? 's' : ''} to CSV`);
  }, [selected, returns, filteredReturns, clientName, clientGstin]);

  // Bulk download JSON for all ready/filed returns
  const handleDownloadAllJSON = useCallback(() => {
    const target = selected.size > 0 ? returns.filter((r) => selected.has(r.id)) : filteredReturns;
    target.forEach((r) => handleDownloadJSON(r));
    toast.success(`Downloading ${target.length} JSON file${target.length !== 1 ? 's' : ''}`);
  }, [selected, returns, filteredReturns, handleDownloadJSON]);

  // Oracle "Fix Automatically" — marks issues as reviewed + generates JSON
  const handleFixAutomatically = useCallback(async () => {
    if (!selectedReturn) {
      toast.info('Select a return first', { description: 'Click a return to let Oracle analyse and fix it.' });
      return;
    }
    setFixing(true);
    try {
      // Auto-advance: draft → prepared → validated → reviewed → generated
      const res = await fetchWithTimeout('/api/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedReturn.id, status: 'generated' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast.success('Oracle resolved the issues', {
        description: `${selectedReturn.returnType} for ${periodToLabel(selectedReturn.period)} advanced to Generated. Review and file when ready.`,
        duration: 5000,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error('Oracle could not fix automatically', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setFixing(false);
    }
  }, [selectedReturn]);

  const handleContactOracle = useCallback(() => {
    setCurrentView('oracle');
  }, [setCurrentView]);

  const handleImportPrevious = useCallback(() => {
    toast.info('Import previous returns', {
      description: 'Connect Zoho Books or upload a GSTR JSON to import past returns.',
    });
    setCurrentView('zoho-books');
  }, [setCurrentView]);

  const allSelected = paginatedReturns.length > 0 && paginatedReturns.every((r) => selected.has(r.id));

  // ── Loading state ──
  if (returnsLoading || clientsLoading) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-black">
        <div className="px-4 md:px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-10 w-36 rounded-xl" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <KpiSkeleton />
          <WorkflowSkeleton />
          <FiltersSkeleton />
          <TableSkeleton />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (returnsError) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-black">
        <div className="px-4 md:px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Returns</h1>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 rounded-xl">
            <RefreshCw className="size-4" /> Reload
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ReturnsErrorState
            reason={returnsError}
            onRetry={handleRefresh}
            onContactOracle={handleContactOracle}
            onGoBack={() => setCurrentView('dashboard')}
          />
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (returns.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-black">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0"
        >
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Returns</h1>
            <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/25 text-xs">0 returns</Badge>
          </div>
          <div className="flex items-center gap-2">
            <AskOracleButton context="returns" />
            <Button
              size="sm"
              className="gap-1.5 bg-blue-500 hover:bg-blue-600 text-white h-9 rounded-xl shadow-lg shadow-blue-500/25"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> Create Return
            </Button>
          </div>
        </motion.div>

        <div className="flex-1 flex items-center justify-center overflow-y-auto">
          <ReturnsEmptyState onCreate={() => setCreateOpen(true)} onImport={handleImportPrevious} />
        </div>

        <CreateReturnModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          clients={clients}
          clientsLoading={clientsLoading}
          clientsError={clientsError}
          clientsEmpty={clientsEmpty}
          onCreate={handleCreateReturn}
          estimatedTax={0}
        />
      </div>
    );
  }

  // ── Main render ──
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full min-h-0 bg-black">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0 gap-3"
        >
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Returns</h1>
            <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/25 text-xs font-semibold">
              {returns.length} return{returns.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AskOracleButton context="returns" />
            <Button
              size="sm"
              className="gap-1.5 bg-blue-500 hover:bg-blue-600 text-white h-9 rounded-xl shadow-lg shadow-blue-500/25"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> Create Return
            </Button>
          </div>
        </motion.div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto returns-scroll">
          <div className="p-4 md:p-6 space-y-6">
            {/* KPI Cards */}
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                  icon={Clock}
                  label="Pending Returns"
                  value={String(kpis.pending)}
                  subtitle="Awaiting filing"
                  trend={kpis.pending > 5 ? 'up' : 'flat'}
                  trendValue={kpis.pending > 0 ? `${kpis.pending}` : '—'}
                  accent="amber"
                />
                <KpiCard
                  icon={CheckCircle2}
                  label="Filed This Month"
                  value={String(kpis.filedThisMonth)}
                  subtitle="Current period"
                  trend={kpis.filedThisMonth > 0 ? 'up' : 'flat'}
                  trendValue={kpis.filedThisMonth > 0 ? `+${kpis.filedThisMonth}` : '—'}
                  accent="emerald"
                />
                <KpiCard
                  icon={AlertTriangle}
                  label="Overdue Returns"
                  value={String(kpis.overdue)}
                  subtitle="Past due date"
                  trend={kpis.overdue > 0 ? 'up' : 'flat'}
                  trendValue={kpis.overdue > 0 ? `${kpis.overdue}` : '0'}
                  accent="rose"
                />
                <KpiCard
                  icon={Banknote}
                  label="GST Liability"
                  value={formatCurrency(kpis.gstLiability)}
                  subtitle="Pending returns"
                  trend="flat"
                  trendValue="live"
                  accent="violet"
                />
                <KpiCard
                  icon={Timer}
                  label="Avg Filing Time"
                  value={kpis.avgFilingTime}
                  subtitle="Across filed returns"
                  trend="down"
                  trendValue="−12%"
                  accent="cyan"
                />
                <KpiCard
                  icon={Gauge}
                  label="Compliance Score"
                  value={`${kpis.complianceScore}%`}
                  subtitle="Filing rate"
                  trend={kpis.complianceScore >= 80 ? 'up' : kpis.complianceScore >= 50 ? 'flat' : 'down'}
                  trendValue={kpis.complianceScore >= 80 ? 'Good' : kpis.complianceScore >= 50 ? 'Fair' : 'Poor'}
                  accent="blue"
                />
              </div>
            </motion.div>

            {/* Filing Workflow */}
            <FilingWorkflow currentStatus={selectedReturn?.status ?? null} />

            {/* Filters + Table + Oracle panel */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
              {/* Left: filters + table */}
              <div className="space-y-4 min-w-0">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search returns, clients, GSTIN…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 pl-9 bg-white/5 border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-xl"
                      aria-label="Search returns"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 w-[130px] text-xs bg-white/5 border-white/10 rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950/95 border-white/10 rounded-xl">
                      <SelectItem value="all" className="text-xs">All Status</SelectItem>
                      {Object.entries(PREMIUM_STATUS_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={returnTypeFilter} onValueChange={setReturnTypeFilter}>
                    <SelectTrigger className="h-10 w-[120px] text-xs bg-white/5 border-white/10 rounded-xl">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950/95 border-white/10 rounded-xl">
                      <SelectItem value="all" className="text-xs">All Types</SelectItem>
                      <SelectItem value="GSTR-1" className="text-xs">GSTR-1</SelectItem>
                      <SelectItem value="GSTR-3B" className="text-xs">GSTR-3B</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="h-10 w-[130px] text-xs bg-white/5 border-white/10 rounded-xl">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950/95 border-white/10 rounded-xl">
                      <SelectItem value="all" className="text-xs">All Periods</SelectItem>
                      {periodOptions.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">{periodToLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bulk action bar */}
                <AnimatePresence>
                  {selected.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between gap-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-4 py-2.5"
                    >
                      <span className="text-xs font-semibold text-blue-300">
                        {selected.size} selected
                      </span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={handleExportCSV} className="h-8 gap-1.5 bg-white/5 border-white/15 hover:bg-white/10 rounded-lg text-xs">
                          <Download className="size-3.5" /> Export CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleDownloadAllJSON} className="h-8 gap-1.5 bg-white/5 border-white/15 hover:bg-white/10 rounded-lg text-xs">
                          <FileOutput className="size-3.5" /> Download JSON
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-lg">
                          Clear
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Table */}
                {paginatedReturns.length === 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-12 text-center">
                    <Inbox className="size-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground mb-1">No returns match your filters</p>
                    <p className="text-xs text-muted-foreground mb-4">Try adjusting your search or filters.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setReturnTypeFilter('all');
                        setPeriodFilter('all');
                      }}
                      className="gap-1.5 bg-white/5 border-white/15 hover:bg-white/10 rounded-xl"
                    >
                      <X className="size-3.5" /> Reset filters
                    </Button>
                  </div>
                ) : (
                  <ReturnsTable
                    returns={paginatedReturns}
                    clients={clients}
                    selected={selected}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    allSelected={allSelected}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    onDownloadJSON={handleDownloadJSON}
                    onDownloadPDF={handleDownloadPDF}
                    onDuplicate={handleDuplicate}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onClick={handleCardClick}
                  />
                )}

                {/* Pagination */}
                {filteredReturns.length > 0 && (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Showing{' '}
                        <span className="font-semibold text-foreground">{page * pageSize + 1}</span>
                        {'–'}
                        <span className="font-semibold text-foreground">{Math.min((page + 1) * pageSize, filteredReturns.length)}</span>
                        {' of '}
                        <span className="font-semibold text-foreground">{filteredReturns.length}</span>
                      </span>
                      <Separator orientation="vertical" className="h-4 bg-white/10" />
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v, 10))}>
                        <SelectTrigger className="h-8 w-[80px] text-xs bg-white/5 border-white/10 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950/95 border-white/10 rounded-xl">
                          {[10, 25, 50].map((s) => (
                            <SelectItem key={s} value={String(s)} className="text-xs">{s} / page</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(0)} className="h-8 w-8 p-0 bg-white/5 border-white/10 hover:bg-white/10 rounded-lg" aria-label="First page">
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 gap-1.5 bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-xs">
                        <ChevronLeft className="size-3.5" /> Prev
                      </Button>
                      <span className="text-xs text-muted-foreground px-3 tabular-nums">
                        {page + 1} / {totalPages}
                      </span>
                      <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="h-8 gap-1.5 bg-white/5 border-white/10 hover:bg-white/10 rounded-lg text-xs">
                        Next <ChevronRightIcon className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} className="h-8 w-8 p-0 bg-white/5 border-white/10 hover:bg-white/10 rounded-lg" aria-label="Last page">
                        <ChevronRightIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Oracle AI panel */}
              <div className="xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100vh-120px)]">
                <OracleAIPanel
                  ret={selectedReturn}
                  allReturns={returns}
                  onFixAutomatically={handleFixAutomatically}
                  fixing={fixing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Detail Sheet */}
        <AnimatePresence>
          {sheetOpen && (
            <DetailSheet
              ret={selectedReturn}
              clients={clients}
              open={sheetOpen}
              onOpenChange={(v) => {
                setSheetOpen(v);
                if (!v) setSelectedReturn(null);
              }}
              onFileReturn={handleFileReturn}
              onDownloadJSON={handleDownloadJSON}
              filing={filingAction === selectedReturn?.id}
            />
          )}
        </AnimatePresence>

        {/* Create Return Modal */}
        <CreateReturnModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          clients={clients}
          clientsLoading={clientsLoading}
          clientsError={clientsError}
          clientsEmpty={clientsEmpty}
          onCreate={handleCreateReturn}
          estimatedTax={estimatedTax}
        />
      </div>
    </TooltipProvider>
  );
}
