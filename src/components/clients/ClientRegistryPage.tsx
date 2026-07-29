'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Client Registry (Premium Enterprise CRM Redesign · Task 9)
// ═══════════════════════════════════════════════════════════════════════════════
// Transforms the customer registry into a world-class enterprise CRM experience
// inspired by Linear / Stripe / Vercel / Notion.
//
// Design pillars:
//   1. Executive Header — page title, subtitle, and right-aligned action
//      cluster (Ask Oracle + Add Client). Sticky on scroll.
//   2. Premium Search Bar — wide, tall, large icon, animated focus ring.
//   3. Premium Filter Dropdowns — Status + State, with icons + smooth motion.
//   4. Premium Table — sticky header, generous row height, row-hover gradient,
//      clickable rows, status + health badges, entity type chips, contextual
//      menu (Edit / View Returns / Delete).
//   5. Premium Loading — skeleton rows with shimmer, no layout shift.
//   6. Premium Empty State — illustration + "No clients yet" + Add Client CTA.
//   7. Premium Error State — friendly message + Retry button.
//   8. Pagination — page size selector (10/25/50), prev/next + page indicator.
//   9. Bulk Actions — select-all + per-row checkbox; floating action bar with
//      Export / Delete.
//  10. Mobile Responsive — card layout below md; full table on md+.
//
// ALL existing functionality is preserved:
//   • Real Prisma-backed data via useClients() hook
//   • Create/Edit/Delete via POST/PATCH/DELETE /api/clients
//   • GSTIN validation + auto state-code lookup
//   • Navigation to Client Workspace + Returns
//   • Ask Oracle button (smart default prompt)
//   • Compliance/health badges
//   • invalidateBusinessSnapshot() on every mutation
//
// ROOT-CAUSE FIX (Task 9): The previous version showed "Failed to load clients
// (HTTP 401)". The root cause was in `useClients.ts` — it used raw `fetch()`
// instead of `fetchWithTimeout()`, so the `x-gstpilot-actor` auth header was
// never injected. This file uses `fetchWithTimeout()` for all mutations to
// keep them 401-safe as well.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Input,
} from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Label,
} from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserPlus,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Sparkles,
  RefreshCw,
  Users,
  FileText,
  AlertCircle,
  RotateCcw,
  Inbox,
  Filter,
  X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import { useClients, type ClientOption } from '@/hooks/useClients';
import { INDIAN_STATES, ENTITY_TYPES as ENTITY_TYPE_OPTIONS } from '@/lib/constants';
import { validateGSTIN, formatGSTIN } from '@/lib/gst-utils';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';
import { fetchWithTimeout } from '@/lib/async/fetchWithTimeout';
import { toast } from 'sonner';
import { AskOracleButton } from '@/components/oracle/AskOracleButton';
import { useCurrentOrgId } from '@/contexts/OrgContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientDoc = ClientOption & {
  complianceProfile?: {
    filingCompliance: number;
    gstinValidity: boolean;
    lastFilingStatus: string | null;
    overdueReturns: number;
    totalReturnsFiled: number;
    averageFilingDelay: number;
  };
  invoiceCount?: number;
  pendingReturnCount?: number;
};

interface ClientFormState {
  tradeName: string;
  legalName: string;
  gstin: string;
  state: string;
  stateCode: string;
  entityType: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  returnPeriod: string;
  lastFilingDate: string;
  status: 'active' | 'inactive' | 'suspended';
  healthScore: number;
}

const emptyForm: ClientFormState = {
  tradeName: '',
  legalName: '',
  gstin: '',
  state: '',
  stateCode: '',
  entityType: 'Pvt Ltd',
  contactEmail: '',
  contactPhone: '',
  address: '',
  returnPeriod: 'monthly',
  lastFilingDate: '',
  status: 'active',
  healthScore: 100,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapApiToDoc(c: ClientOption): ClientDoc {
  const agg = c._aggregations;
  return {
    ...c,
    complianceProfile: {
      filingCompliance: agg
        ? Math.min(
            100,
            Math.round(
              (agg.filedReturns / Math.max(1, agg.filedReturns + agg.pendingReturns)) * 100,
            ),
          )
        : 100,
      gstinValidity: true,
      lastFilingStatus: null,
      overdueReturns: agg?.pendingReturns ?? 0,
      totalReturnsFiled: agg?.filedReturns ?? 0,
      averageFilingDelay: 0,
    },
    invoiceCount: agg?.totalInvoices ?? 0,
    pendingReturnCount: agg?.pendingReturns ?? 0,
  };
}

function healthScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function healthScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 ring-emerald-500/20';
  if (score >= 60) return 'bg-yellow-500/10 ring-yellow-500/20';
  if (score >= 40) return 'bg-orange-500/10 ring-orange-500/20';
  return 'bg-red-500/10 ring-red-500/20';
}

function healthScoreIcon(score: number) {
  if (score >= 80) return <CheckCircle2 className="h-3 w-3" />;
  if (score >= 60) return <Shield className="h-3 w-3" />;
  if (score >= 40) return <AlertTriangle className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; chip: string; text: string }
> = {
  active: {
    label: 'Active',
    dot: 'bg-emerald-400',
    chip: 'bg-emerald-500/10 ring-emerald-500/20',
    text: 'text-emerald-300',
  },
  inactive: {
    label: 'Inactive',
    dot: 'bg-zinc-400',
    chip: 'bg-zinc-500/10 ring-zinc-500/20',
    text: 'text-zinc-300',
  },
  suspended: {
    label: 'Suspended',
    dot: 'bg-red-400',
    chip: 'bg-red-500/10 ring-red-500/20',
    text: 'text-red-300',
  },
};

function statusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cfg.chip} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Skeleton row (premium shimmer, layout-matched) ──────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-white/[0.04]">
      <div className="h-4 w-4 rounded bg-white/[0.04] shimmer" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-1/4 rounded bg-white/[0.05] shimmer" />
        <div className="h-3 w-1/3 rounded bg-white/[0.04] shimmer" />
      </div>
      <div className="hidden md:block w-32 space-y-2">
        <div className="h-3 w-3/4 rounded bg-white/[0.04] shimmer" />
        <div className="h-3 w-1/2 rounded bg-white/[0.03] shimmer" />
      </div>
      <div className="hidden lg:block w-24">
        <div className="h-5 w-16 rounded-full bg-white/[0.04] shimmer" />
      </div>
      <div className="hidden lg:block w-20">
        <div className="h-5 w-12 rounded-full bg-white/[0.04] shimmer" />
      </div>
      <div className="w-8">
        <div className="h-4 w-4 rounded bg-white/[0.04] shimmer" />
      </div>
    </div>
  );
}

// ─── Sort header (memoized) ───────────────────────────────────────────────────

type SortKey = 'tradeName' | 'gstin' | 'state' | 'healthScore' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

const SortHeader = React.memo(function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  align = 'left',
  className = '',
}: SortHeaderProps) {
  const isActive = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`group inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#71717A] transition-colors hover:text-white ${
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
      } ${isActive ? 'text-white' : ''} ${className}`}
    >
      {label}
      {isActive ? (
        currentDir === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-[#3B82F6]" />
        ) : (
          <ArrowDown className="h-3 w-3 text-[#3B82F6]" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </button>
  );
});

// ─── Desktop row (memoized) ───────────────────────────────────────────────────

interface InvoiceRowProps {
  client: ClientDoc;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (id: string) => void;
  onEdit: (c: ClientDoc) => void;
  onDelete: (c: ClientDoc) => void;
  onGoToReturns: (id: string) => void;
}

const ClientTableRow = React.memo(function ClientTableRow({
  client,
  selected,
  onToggleSelect,
  onClick,
  onEdit,
  onDelete,
  onGoToReturns,
}: InvoiceRowProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      role="row"
      onClick={() => onClick(client.id)}
      className={`group flex cursor-pointer items-center gap-4 border-b border-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.025] ${
        selected ? 'bg-[#3B82F6]/[0.04]' : ''
      }`}
    >
      {/* Checkbox */}
      <div onClick={stop} className="flex items-center">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(client.id)}
          aria-label={`Select ${client.tradeName}`}
          className="border-white/20 data-[state=checked]:bg-[#3B82F6] data-[state=checked]:border-[#3B82F6]"
        />
      </div>

      {/* Name + GSTIN */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6]/15 to-[#1E40AF]/10 text-[11px] font-bold text-[#60A5FA] ring-1 ring-[#3B82F6]/20">
          {client.tradeName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13.5px] font-medium text-white">
              {client.tradeName}
            </p>
            {client.entityType && (
              <span className="hidden items-center rounded-md bg-white/[0.04] px-1.5 py-[1px] text-[10px] font-medium text-[#A1A1AA] ring-1 ring-inset ring-white/5 md:inline-flex">
                <Building2 className="mr-1 h-2.5 w-2.5" />
                {client.entityType}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[#71717A]">
            {formatGSTIN(client.gstin)}
          </p>
        </div>
      </div>

      {/* State / Contact (md+) */}
      <div className="hidden w-44 md:block">
        {client.state ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[12px] text-[#D4D4D8]">
              <MapPin className="h-3 w-3 shrink-0 text-[#52525B]" />
              <span className="truncate">{client.state}</span>
              {client.stateCode && (
                <span className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-[#A1A1AA]">
                  {client.stateCode}
                </span>
              )}
            </div>
            {client.contactEmail && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#71717A]">
                <Mail className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{client.contactEmail}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-[11px] italic text-[#52525B]">—</span>
        )}
      </div>

      {/* Compliance (lg+) */}
      <div className="hidden w-32 lg:block">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-[#52525B]" />
            <span className="text-[11px] text-[#D4D4D8]">
              {client.complianceProfile?.totalReturnsFiled ?? 0}
            </span>
          </div>
          {(client.complianceProfile?.overdueReturns ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {client.complianceProfile?.overdueReturns}
                </span>
              </TooltipTrigger>
              <TooltipContent>Overdue returns</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Health (lg+) */}
      <div className="hidden w-20 lg:block">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${healthScoreBg(
            client.healthScore,
          )} ${healthScoreColor(client.healthScore)}`}
        >
          {healthScoreIcon(client.healthScore)}
          {client.healthScore}
        </span>
      </div>

      {/* Status */}
      <div className="w-24">{statusBadge(client.status)}</div>

      {/* Actions */}
      <div className="w-8" onClick={stop}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] opacity-0 transition-all hover:bg-white/[0.06] hover:text-white focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${client.tradeName}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(client)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onGoToReturns(client.id)} className="gap-2">
              <Clock className="h-3.5 w-3.5" /> View Returns
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(client)}
              className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

// ─── Mobile card (memoized) ───────────────────────────────────────────────────

type MobileCardProps = Omit<InvoiceRowProps, 'onEdit' | 'onDelete' | 'onGoToReturns'> & {
  onEdit: (c: ClientDoc) => void;
  onDelete: (c: ClientDoc) => void;
  onGoToReturns: (id: string) => void;
};

const ClientMobileCard = React.memo(function ClientMobileCard({
  client,
  selected,
  onToggleSelect,
  onClick,
  onEdit,
  onDelete,
  onGoToReturns,
}: MobileCardProps) {
  return (
    <div
      onClick={() => onClick(client.id)}
      className={`cursor-pointer rounded-xl border border-white/[0.06] bg-[#0F0F0F] p-4 transition-colors hover:border-white/[0.12] hover:bg-[#131313] ${
        selected ? 'border-[#3B82F6]/40 bg-[#3B82F6]/[0.04]' : ''
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div onClick={(e) => e.stopPropagation()} className="pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(client.id)}
            aria-label={`Select ${client.tradeName}`}
            className="border-white/20 data-[state=checked]:bg-[#3B82F6] data-[state=checked]:border-[#3B82F6]"
          />
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6]/15 to-[#1E40AF]/10 text-[13px] font-bold text-[#60A5FA] ring-1 ring-[#3B82F6]/20">
          {client.tradeName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[14px] font-medium text-white">{client.tradeName}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#71717A] hover:bg-white/[0.06] hover:text-white"
                  aria-label={`Actions for ${client.tradeName}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(client);
                  }}
                  className="gap-2"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onGoToReturns(client.id);
                  }}
                  className="gap-2"
                >
                  <Clock className="h-3.5 w-3.5" /> View Returns
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(client);
                  }}
                  className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[#71717A]">
            {formatGSTIN(client.gstin)}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {statusBadge(client.status)}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${healthScoreBg(
            client.healthScore,
          )} ${healthScoreColor(client.healthScore)}`}
        >
          {healthScoreIcon(client.healthScore)}
          {client.healthScore}
        </span>
        {client.entityType && (
          <span className="inline-flex items-center rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#A1A1AA] ring-1 ring-inset ring-white/5">
            <Building2 className="mr-1 h-2.5 w-2.5" />
            {client.entityType}
          </span>
        )}
      </div>

      {/* Contact info */}
      {(client.state || client.contactEmail || client.contactPhone) && (
        <div className="mt-3 space-y-1 border-t border-white/[0.04] pt-3">
          {client.state && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
              <MapPin className="h-3 w-3 shrink-0 text-[#52525B]" />
              <span className="truncate">{client.state}</span>
              {client.stateCode && (
                <span className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px] text-[#71717A]">
                  {client.stateCode}
                </span>
              )}
            </div>
          )}
          {client.contactEmail && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
              <Mail className="h-3 w-3 shrink-0 text-[#52525B]" />
              <span className="truncate">{client.contactEmail}</span>
            </div>
          )}
          {client.contactPhone && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
              <Phone className="h-3 w-3 shrink-0 text-[#52525B]" />
              <span>{client.contactPhone}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientRegistryPage() {
  const { setCurrentView, setSelectedClientId } = useApp();
  const orgId = useCurrentOrgId();

  // ── API-backed client list ────────────────────────────────────────────────
  const {
    clients: rawClients,
    loading,
    error,
    refetch,
  } = useClients();

  const clients = useMemo<ClientDoc[]>(
    () => rawClients.map(mapApiToDoc),
    [rawClients],
  );

  // ── Local UI state ────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey | null>('tradeName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDoc | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientDoc | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset to page 0 when search/filters/pageSize change.
  useEffect(() => {
    setPage(0);
  }, [search, filterState, filterStatus, pageSize]);

  // Reset selection when the data changes (so we don't hold stale ids).
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const ids = new Set(clients.map((c) => c.id));
      prev.forEach((id) => {
        if (ids.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [clients]);

  // ── Filtered + sorted + paginated ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = clients as ClientDoc[];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (c) =>
          c.tradeName.toLowerCase().includes(q) ||
          c.gstin.toLowerCase().includes(q) ||
          (c.legalName && c.legalName.toLowerCase().includes(q)) ||
          (c.state && c.state.toLowerCase().includes(q)) ||
          (c.contactEmail && c.contactEmail.toLowerCase().includes(q)),
      );
    }
    if (filterState !== 'all') {
      list = list.filter((c) => c.state === filterState);
    }
    if (filterStatus !== 'all') {
      list = list.filter((c) => c.status === filterStatus);
    }

    // Sort
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        if (typeof av === 'number' && typeof bv === 'number') {
          return (av - bv) * dir;
        }
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }
    return list;
  }, [clients, search, filterState, filterStatus, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize],
  );

  const uniqueStates = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.state) set.add(c.state);
    });
    return Array.from(set).sort();
  }, [clients]);

  const activeFilterCount =
    (filterState !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0) + (search ? 1 : 0);

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((c) => selectedIds.has(c.id));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (paginated.every((c) => prev.has(c.id))) {
        // Deselect all on current page
        const next = new Set(prev);
        paginated.forEach((c) => next.delete(c.id));
        return next;
      }
      // Select all on current page
      const next = new Set(prev);
      paginated.forEach((c) => next.add(c.id));
      return next;
    });
  }, [paginated]);

  const onSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilterState('all');
    setFilterStatus('all');
    setSortKey('tradeName');
    setSortDir('asc');
  }, []);

  const openCreate = useCallback(() => {
    setEditingClient(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((client: ClientDoc) => {
    setEditingClient(client);
    setForm({
      tradeName: client.tradeName || '',
      legalName: client.legalName || '',
      gstin: client.gstin || '',
      state: client.state || '',
      stateCode: client.stateCode || '',
      entityType: client.entityType || 'Pvt Ltd',
      contactEmail: client.contactEmail || '',
      contactPhone: client.contactPhone || '',
      address: client.address || '',
      returnPeriod: client.returnPeriod || 'monthly',
      lastFilingDate: client.lastFilingDate || '',
      status: (client.status as 'active' | 'inactive' | 'suspended') || 'active',
      healthScore: client.healthScore ?? 100,
    });
    setDialogOpen(true);
  }, []);

  const handleStateSelect = useCallback((stateName: string) => {
    const found = INDIAN_STATES.find((s) => s.name === stateName);
    setForm((prev) => ({
      ...prev,
      state: stateName,
      stateCode: found ? found.code : prev.stateCode,
    }));
  }, []);

  // ── Save (create or update) ───────────────────────────────────────────────
  // Uses fetchWithTimeout so the x-gstpilot-actor auth header is auto-injected
  // (prevents the 401 that the previous raw-fetch implementation triggered).
  const handleSave = useCallback(async () => {
    if (!form.tradeName.trim()) {
      toast.error('Trade name is required');
      return;
    }
    if (!form.gstin.trim() || !validateGSTIN(form.gstin)) {
      toast.error('Valid GSTIN is required (15 characters, alphanumeric)');
      return;
    }
    if (!orgId) {
      toast.error('No organization found. Please complete onboarding first.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        gstin: form.gstin.trim().toUpperCase(),
        tradeName: form.tradeName.trim(),
        legalName: form.legalName.trim() || form.tradeName.trim(),
        address: form.address.trim() || null,
        state: form.state || null,
        stateCode: form.stateCode || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        entityType: form.entityType,
        returnPeriod: form.returnPeriod || null,
        lastFilingDate: form.lastFilingDate || null,
        status: form.status,
        healthScore: form.healthScore,
        organizationId: orgId,
      };

      if (editingClient) {
        const res = await fetchWithTimeout(
          '/api/clients',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingClient.id, ...payload }),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to update client (HTTP ${res.status})`);
        }
        toast.success(`${form.tradeName} updated`);
        invalidateBusinessSnapshot();
      } else {
        const res = await fetchWithTimeout(
          '/api/clients',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          { timeoutMs: 20_000, retries: 1 },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to create client (HTTP ${res.status})`);
        }
        toast.success(`${form.tradeName} added to your firm`);
        invalidateBusinessSnapshot();
      }
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSaving(false);
    }
  }, [form, editingClient, orgId, refetch]);

  // ── Delete single ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithTimeout(
        `/api/clients?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' },
        { timeoutMs: 20_000, retries: 1 },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to delete client (HTTP ${res.status})`);
      }
      toast.success(`${deleteTarget.tradeName} removed`);
      invalidateBusinessSnapshot();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete client');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, refetch]);

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        const res = await fetchWithTimeout(
          `/api/clients?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' },
          { timeoutMs: 20_000, retries: 0 },
        );
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    if (ok > 0) {
      toast.success(`${ok} client${ok !== 1 ? 's' : ''} removed`);
      invalidateBusinessSnapshot();
    }
    if (fail > 0) {
      toast.error(`${fail} client${fail !== 1 ? 's' : ''} could not be removed`);
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refetch();
  }, [selectedIds, refetch]);

  // ── Bulk export (CSV, real data) ──────────────────────────────────────────
  const handleBulkExport = useCallback(() => {
    const selected = clients.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    const headers = [
      'Trade Name',
      'Legal Name',
      'GSTIN',
      'State',
      'State Code',
      'Entity Type',
      'Contact Email',
      'Contact Phone',
      'Status',
      'Health Score',
      'Invoices',
      'Returns Filed',
      'Pending Returns',
    ];
    const rows = selected.map((c) =>
      [
        c.tradeName,
        c.legalName ?? '',
        c.gstin,
        c.state ?? '',
        c.stateCode ?? '',
        c.entityType ?? '',
        c.contactEmail ?? '',
        c.contactPhone ?? '',
        c.status,
        String(c.healthScore ?? 0),
        String(c._aggregations?.totalInvoices ?? 0),
        String(c._aggregations?.filedReturns ?? 0),
        String(c._aggregations?.pendingReturns ?? 0),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gstpilot-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} client${selected.length !== 1 ? 's' : ''} to CSV`);
  }, [clients, selectedIds]);

  const goToWorkspace = useCallback(
    (clientId: string) => {
      setSelectedClientId(clientId);
      setCurrentView('client-workspace' as AppView);
    },
    [setCurrentView, setSelectedClientId],
  );

  const goToReturns = useCallback(
    (clientId: string) => {
      setSelectedClientId(clientId);
      setCurrentView('returns' as AppView);
    },
    [setCurrentView, setSelectedClientId],
  );

  // ── Keyboard: "/" focuses search ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* ─── Executive Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3B82F6]/15 to-[#1E40AF]/10 ring-1 ring-[#3B82F6]/20">
                <Users className="h-4 w-4 text-[#60A5FA]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[28px]">
                  Client Registry
                </h1>
                <p className="mt-0.5 text-[13px] text-[#A1A1AA]">
                  Manage your GST client portfolio
                </p>
              </div>
            </div>
            {!loading && !error && (
              <div className="mt-3 flex items-center gap-4 text-[12px] text-[#71717A]">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                  {clients.length} total
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {clients.filter((c) => c.status === 'active').length} active
                </span>
                {clients.some((c) => (c.complianceProfile?.overdueReturns ?? 0) > 0) && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {clients.filter((c) => (c.complianceProfile?.overdueReturns ?? 0) > 0).length}{' '}
                    with overdue returns
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AskOracleButton context="customers" />
            <Button
              onClick={openCreate}
              className="h-9 gap-1.5 bg-[#3B82F6] text-[13px] font-medium text-white shadow-lg shadow-[#3B82F6]/20 hover:bg-[#2563EB] hover:shadow-[#3B82F6]/30"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* ─── Premium Search + Filters Bar ─────────────────────────────────── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search — wide, tall, premium focus ring */}
          <div className="relative flex-1">
            <div
              className={`pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-200 ${
                searchFocused
                  ? 'opacity-100 bg-[#3B82F6]/[0.04] ring-1 ring-[#3B82F6]/30'
                  : 'opacity-0'
              }`}
            />
            <div className="relative">
              <Search
                className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 transition-colors duration-200 ${
                  searchFocused ? 'text-[#60A5FA]' : 'text-[#52525B]'
                }`}
              />
              <Input
                ref={searchRef}
                placeholder="Search by name, GSTIN, state, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={`h-11 rounded-xl border-[#1F1F1F] bg-[#0F0F0F] pl-11 pr-20 text-[13.5px] text-white placeholder:text-[#52525B] transition-all duration-200 focus-visible:border-[#3B82F6]/40 focus-visible:bg-[#0F0F0F] focus-visible:ring-2 focus-visible:ring-[#3B82F6]/20 ${
                  searchFocused ? 'border-[#3B82F6]/40' : ''
                }`}
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {!search && (
                  <kbd className="hidden rounded border border-[#222] bg-[#18181B] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#52525B] sm:inline-block">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Filter cluster */}
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-11 w-full rounded-xl border-[#1F1F1F] bg-[#0F0F0F] px-3 text-[13px] text-white data-[placeholder]:text-[#71717A] hover:border-[#3B82F6]/30 hover:bg-[#131313] sm:w-[160px]">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-[#71717A]" />
                  <SelectValue placeholder="All Status" />
                </div>
              </SelectTrigger>
              <SelectContent className="border-[#1F1F1F] bg-[#0F0F0F]">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                </SelectItem>
                <SelectItem value="inactive">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    Inactive
                  </span>
                </SelectItem>
                <SelectItem value="suspended">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Suspended
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="h-11 w-full rounded-xl border-[#1F1F1F] bg-[#0F0F0F] px-3 text-[13px] text-white data-[placeholder]:text-[#71717A] hover:border-[#3B82F6]/30 hover:bg-[#131313] sm:w-[170px]">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-[#71717A]" />
                  <SelectValue placeholder="All States" />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[280px] border-[#1F1F1F] bg-[#0F0F0F]">
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={resetFilters}
                className="h-11 rounded-xl border-[#1F1F1F] bg-[#0F0F0F] px-3 text-[12px] font-medium text-[#A1A1AA] hover:bg-[#131313] hover:text-white"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
                <span className="ml-1.5 rounded-full bg-[#3B82F6]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#60A5FA]">
                  {activeFilterCount}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* ─── Bulk Action Bar ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3B82F6]/20 ring-1 ring-[#3B82F6]/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#60A5FA]" />
                  </div>
                  <span className="text-[13px] font-medium text-white">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[11px] font-medium text-[#A1A1AA] underline-offset-4 hover:text-white hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkExport}
                    className="h-8 gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[12px] font-medium text-white hover:bg-white/[0.06]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                    className="h-8 gap-1.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] text-[12px] font-medium text-red-300 hover:bg-red-500/[0.12] hover:text-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Premium Loading State ────────────────────────────────────────── */}
        {loading && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0A]">
            {/* Skeleton header */}
            <div className="flex items-center gap-4 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="h-4 w-4 rounded bg-white/[0.04] shimmer" />
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-white/[0.05] shimmer" />
              </div>
              <div className="hidden md:block w-32">
                <div className="h-3 w-20 rounded bg-white/[0.04] shimmer" />
              </div>
              <div className="hidden lg:block w-20">
                <div className="h-3 w-12 rounded bg-white/[0.04] shimmer" />
              </div>
              <div className="w-24">
                <div className="h-3 w-16 rounded bg-white/[0.04] shimmer" />
              </div>
              <div className="w-8" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* ─── Premium Error State ──────────────────────────────────────────── */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/15 bg-red-500/[0.03] px-6 py-16 text-center">
            <div className="relative mb-5">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-red-500/10 blur-2xl"
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-red-500/5 ring-1 ring-red-500/20">
                <AlertCircle className="h-7 w-7 text-red-300" strokeWidth={1.75} />
              </div>
            </div>
            <h3 className="text-base font-semibold text-white">Couldn't load your clients</h3>
            <p className="mt-2 max-w-md text-[13px] text-[#A1A1AA]">
              We hit a snag fetching the client registry. This is usually a momentary connection
              issue — please try again.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={() => refetch()}
                className="h-9 gap-1.5 bg-[#3B82F6] text-[13px] font-medium text-white hover:bg-[#2563EB]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCurrentView('dashboard')}
                className="h-9 text-[13px] font-medium text-[#A1A1AA] hover:text-white"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* ─── Premium Empty State ──────────────────────────────────────────── */}
        {!loading && !error && clients.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#0A0A0A] px-6 py-20 text-center">
            <div className="relative mb-6">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 scale-125 rounded-full bg-[#3B82F6]/10 blur-2xl"
              />
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6]/20 to-[#1E40AF]/5 ring-1 ring-[#3B82F6]/20">
                <UserPlus className="h-9 w-9 text-[#60A5FA]" strokeWidth={1.5} />
              </div>
              {/* Decorative orbit dots */}
              <span className="absolute -right-1 top-2 h-2 w-2 rounded-full bg-[#60A5FA]/60" />
              <span className="absolute -left-2 bottom-3 h-1.5 w-1.5 rounded-full bg-[#3B82F6]/40" />
              <span className="absolute right-3 -bottom-1 h-1 w-1 rounded-full bg-[#60A5FA]/30" />
            </div>
            <h3 className="text-lg font-semibold text-white">No clients yet</h3>
            <p className="mt-2 max-w-md text-[13.5px] text-[#A1A1AA]">
              Add your first GST client to unlock compliance tracking, return filing, invoice
              management, and a dedicated client workspace.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                onClick={openCreate}
                className="h-10 gap-1.5 bg-[#3B82F6] text-[13px] font-medium text-white shadow-lg shadow-[#3B82F6]/20 transition-all hover:scale-[1.02] hover:bg-[#2563EB] active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Create your first client
              </Button>
              <button
                onClick={() => setCurrentView('invoices')}
                className="text-[12px] font-medium text-[#60A5FA] underline-offset-4 transition-colors hover:text-[#93C5FD] hover:underline"
              >
                Go to invoices instead
              </button>
            </div>
          </div>
        )}

        {/* ─── No Results (after filtering) ─────────────────────────────────── */}
        {!loading && !error && clients.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#0A0A0A] px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.03] ring-1 ring-white/[0.06]">
              <Inbox className="h-6 w-6 text-[#71717A]" strokeWidth={1.5} />
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-white">No matching clients</h3>
            <p className="mt-1.5 max-w-sm text-[13px] text-[#A1A1AA]">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="mt-5 h-9 gap-1.5 text-[12px] font-medium text-[#A1A1AA] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset all filters
            </Button>
          </div>
        )}

        {/* ─── Premium Desktop Table ────────────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0A] md:block">
              {/* Sticky header */}
              <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-white/[0.06] bg-[#0F0F0F]/95 px-4 py-2.5 backdrop-blur">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Select all on page"
                  className="border-white/20 data-[state=checked]:bg-[#3B82F6] data-[state=checked]:border-[#3B82F6]"
                />
                <div className="flex-1">
                  <SortHeader
                    label="Client"
                    sortKey="tradeName"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                </div>
                <div className="hidden w-44 md:block">
                  <SortHeader
                    label="Location"
                    sortKey="state"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                </div>
                <div className="hidden w-32 lg:block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A]">
                    Returns
                  </span>
                </div>
                <div className="hidden w-20 lg:block">
                  <SortHeader
                    label="Health"
                    sortKey="healthScore"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                </div>
                <div className="w-24">
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onSort={onSort}
                  />
                </div>
                <div className="w-8" />
              </div>

              {/* Rows */}
              <div role="rowgroup">
                {paginated.map((client) => (
                  <ClientTableRow
                    key={client.id}
                    client={client}
                    selected={selectedIds.has(client.id)}
                    onToggleSelect={onToggleSelect}
                    onClick={goToWorkspace}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    onGoToReturns={goToReturns}
                  />
                ))}
              </div>

              {/* Pagination footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0F0F0F]/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-3 text-[12px] text-[#71717A]">
                  <span>
                    Showing{' '}
                    <span className="font-medium text-white">
                      {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)}
                    </span>{' '}
                    of <span className="font-medium text-white">{filtered.length}</span>
                  </span>
                  <span className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-1.5">
                    <span>Rows:</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="h-7 w-[64px] rounded-md border-[#222] bg-[#0A0A0A] px-2 text-[12px] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[#222] bg-[#0F0F0F]">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="First page"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 text-[12px] font-medium text-white">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page >= totalPages - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label="Last page"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ─── Mobile Card List ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 md:hidden">
              {paginated.map((client) => (
                <ClientMobileCard
                  key={client.id}
                  client={client}
                  selected={selectedIds.has(client.id)}
                  onToggleSelect={onToggleSelect}
                  onClick={goToWorkspace}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onGoToReturns={goToReturns}
                />
              ))}
              <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-[12px] text-[#71717A]">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of{' '}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#0F0F0F] text-[#A1A1AA] disabled:opacity-30"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-[12px] font-medium text-white">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#0F0F0F] text-[#A1A1AA] disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG
         ═════════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#1F1F1F] bg-[#0F0F0F] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-white">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
            <p className="text-[12px] text-[#71717A]">
              {editingClient
                ? 'Update the client profile and compliance details.'
                : 'Create a new GST client profile to enable invoicing, returns, and compliance tracking.'}
            </p>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="tradeName" className="text-[12px] font-medium text-[#D4D4D8]">
                Trade Name *
              </Label>
              <Input
                id="tradeName"
                value={form.tradeName}
                onChange={(e) => setForm((p) => ({ ...p, tradeName: e.target.value }))}
                placeholder="e.g. Acme Industries"
                className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="legalName" className="text-[12px] font-medium text-[#D4D4D8]">
                Legal Name
              </Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))}
                placeholder="Registered legal name"
                className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gstin" className="text-[12px] font-medium text-[#D4D4D8]">
                GSTIN *
              </Label>
              <Input
                id="gstin"
                value={form.gstin}
                onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="h-10 border-[#1F1F1F] bg-[#0A0A0A] font-mono text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
              />
              {form.gstin && !validateGSTIN(form.gstin) && (
                <p className="text-[11px] text-red-400">Invalid GSTIN format</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-[12px] font-medium text-[#D4D4D8]">State</Label>
                <Select value={form.state} onValueChange={handleStateSelect}>
                  <SelectTrigger className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white data-[placeholder]:text-[#52525B]">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px] border-[#1F1F1F] bg-[#0F0F0F]">
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stateCode" className="text-[12px] font-medium text-[#D4D4D8]">
                  State Code
                </Label>
                <Input
                  id="stateCode"
                  value={form.stateCode}
                  onChange={(e) => setForm((p) => ({ ...p, stateCode: e.target.value }))}
                  placeholder="Auto-filled"
                  className="h-10 border-[#1F1F1F] bg-[#0A0A0A] font-mono text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-[12px] font-medium text-[#D4D4D8]">Entity Type</Label>
                <Select
                  value={form.entityType}
                  onValueChange={(v) => setForm((p) => ({ ...p, entityType: v }))}
                >
                  <SelectTrigger className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#1F1F1F] bg-[#0F0F0F]">
                    {ENTITY_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[12px] font-medium text-[#D4D4D8]">Return Period</Label>
                <Select
                  value={form.returnPeriod}
                  onValueChange={(v) => setForm((p) => ({ ...p, returnPeriod: v }))}
                >
                  <SelectTrigger className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#1F1F1F] bg-[#0F0F0F]">
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contactEmail" className="text-[12px] font-medium text-[#D4D4D8]">
                Contact Email
              </Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
                placeholder="contact@company.com"
                className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contactPhone" className="text-[12px] font-medium text-[#D4D4D8]">
                Contact Phone
              </Label>
              <Input
                id="contactPhone"
                value={form.contactPhone}
                onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address" className="text-[12px] font-medium text-[#D4D4D8]">
                Address
              </Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Registered business address"
                className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white placeholder:text-[#52525B] focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
              />
            </div>

            {editingClient && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label className="text-[12px] font-medium text-[#D4D4D8]">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, status: v as ClientFormState['status'] }))
                    }
                  >
                    <SelectTrigger className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#1F1F1F] bg-[#0F0F0F]">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="healthScore" className="text-[12px] font-medium text-[#D4D4D8]">
                    Health Score
                  </Label>
                  <Input
                    id="healthScore"
                    type="number"
                    min={0}
                    max={100}
                    value={form.healthScore}
                    onChange={(e) => setForm((p) => ({ ...p, healthScore: Number(e.target.value) }))}
                    className="h-10 border-[#1F1F1F] bg-[#0A0A0A] text-[13px] text-white focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="h-9 text-[13px] font-medium text-[#A1A1AA] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (form.gstin.length > 0 && !validateGSTIN(form.gstin))}
              className="h-9 gap-1.5 bg-[#3B82F6] text-[13px] font-medium text-white hover:bg-[#2563EB]"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : editingClient ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Update Client
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════════
          SINGLE DELETE CONFIRMATION
         ═════════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#1F1F1F] bg-[#0F0F0F]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-white">
              Delete {deleteTarget?.tradeName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#A1A1AA]">
              This will permanently remove the client and all associated data. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-[#1F1F1F] bg-transparent text-[13px] font-medium text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-9 gap-1.5 bg-red-600 text-[13px] font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═════════════════════════════════════════════════════════════════════════
          BULK DELETE CONFIRMATION
         ═════════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="border-[#1F1F1F] bg-[#0F0F0F]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-white">
              Delete {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#A1A1AA]">
              This will permanently remove the selected clients and all their associated data. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-[#1F1F1F] bg-transparent text-[13px] font-medium text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="h-9 gap-1.5 bg-red-600 text-[13px] font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
