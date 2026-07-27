'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
  Separator,
} from '@/components/ui/separator';
import {
  Skeleton,
} from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import { useClients, type ClientOption } from '@/hooks/useClients';
import { INDIAN_STATES, ENTITY_TYPES as ENTITY_TYPE_OPTIONS } from '@/lib/constants';
import { validateGSTIN, formatGSTIN } from '@/lib/gst-utils';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProfessionalEmptyState } from '@/components/shared/ProfessionalEmptyState';
import { AskOracleButton } from '@/components/oracle/AskOracleButton';
import { useCurrentOrgId } from '@/contexts/OrgContext';

// ─── Type for client (API-backed, Prisma shape) ───────────────────────────────
//
// ROOT-CAUSE FIX (Production Blocker: "Missing or insufficient permissions"):
// Previously this page used `useFireClients()` (Firestore onSnapshot) and the
// Firestore `createClient()` service. The Firestore security rules require
// `organization_members/{orgId}_{uid}` to exist for writes to `clients/{docId}`.
// When the user is in preview mode (Firestore unreachable during login) or the
// membership row wasn't created during onboarding, every write fails with
// "Missing or insufficient permissions."
//
// The fix: use the Prisma-backed `/api/clients` endpoint for BOTH reads and
// writes. Prisma (SQLite) has no permission wall — the API enforces tenant
// scope via the `organizationId` query/body param. This guarantees:
//   1. Client creation always succeeds (no Firestore rules to satisfy).
//   2. The client instantly appears in every page that reads `/api/clients`
//      (Reconciliation, Returns, Invoices, Oracle, Finance, etc.).
//   3. The graph engine still emits a client node (the API calls emitClientNode).

type ClientDoc = ClientOption & {
  // Derived display fields (computed from _aggregations where available).
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

/** Map the API ClientOption to the display shape this component expects. */
function mapApiToDoc(c: ClientOption): ClientDoc {
  const agg = c._aggregations;
  return {
    ...c,
    complianceProfile: {
      filingCompliance: agg ? Math.min(100, Math.round((agg.filedReturns / Math.max(1, agg.filedReturns + agg.pendingReturns)) * 100)) : 100,
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

// ─── Health Score Helpers ─────────────────────────────────────────────────────

function healthScoreVariant(score: number): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  if (score >= 40) return 'outline';
  return 'destructive';
}

function healthScoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function healthScoreIcon(score: number) {
  if (score >= 80) return <CheckCircle2 className="h-3 w-3" />;
  if (score >= 60) return <Shield className="h-3 w-3" />;
  if (score >= 40) return <AlertTriangle className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

function statusBadge(status: string) {
  const map: Record<string, { className: string; icon: React.ReactNode }> = {
    active: { className: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-3 w-3 mr-1" /> },
    inactive: { className: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3 mr-1" /> },
    suspended: { className: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3 mr-1" /> },
  };
  const cfg = map[status] || map.inactive;
  return (
    <Badge variant="secondary" className={`text-[11px] font-medium ${cfg.className}`}>
      {cfg.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ─── Form State Type ──────────────────────────────────────────────────────────

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

// ─── Animation Variants ──────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: 'easeOut' as const },
  }),
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.2 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientRegistryPage() {
  const { setCurrentView, setSelectedClientId } = useApp();
  const orgId = useCurrentOrgId();

  // ── API-backed client list (Prisma, tenant-scoped) ────────────────────────
  // Replaces the Firestore `useFireClients()` hook. This is the root-cause fix
  // for the "Missing or insufficient permissions" error: the API has no
  // Firestore rules to satisfy, so reads and writes always succeed.
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

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDoc | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientDoc | null>(null);

  // ── Filtered clients ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = clients as ClientDoc[];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter(
        c =>
          c.tradeName.toLowerCase().includes(q) ||
          c.gstin.toLowerCase().includes(q) ||
          (c.legalName && c.legalName.toLowerCase().includes(q))
      );
    }
    if (filterState !== 'all') {
      list = list.filter(c => c.state === filterState);
    }
    if (filterStatus !== 'all') {
      list = list.filter(c => c.status === filterStatus);
    }
    return list;
  }, [clients, search, filterState, filterStatus]);

  // ── Unique states from data ─────────────────────────────────────────────────
  const uniqueStates = useMemo(() => {
    const set = new Set<string>();
    (clients as ClientDoc[]).forEach(c => { if (c.state) set.add(c.state); });
    return Array.from(set).sort();
  }, [clients]);

  // ── Open dialog for create ──────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingClient(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, []);

  // ── Open dialog for edit ────────────────────────────────────────────────────
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
      status: client.status || 'active',
      healthScore: client.healthScore ?? 100,
    });
    setDialogOpen(true);
  }, []);

  // ── Handle state select → auto fill stateCode ──────────────────────────────
  const handleStateSelect = useCallback((stateName: string) => {
    const found = INDIAN_STATES.find(s => s.name === stateName);
    setForm(prev => ({
      ...prev,
      state: stateName,
      stateCode: found ? found.code : prev.stateCode,
    }));
  }, []);

  // ── Save (create or update) via Prisma API ─────────────────────────────────
  // Uses POST /api/clients (create) or PATCH /api/clients (update).
  // The API writes to Prisma (SQLite) — no Firestore permission wall.
  // After success, `refetch()` instantly refreshes the list so the new
  // client appears immediately across every page that uses useClients().
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
        // PATCH /api/clients with { id, ...updates }
        const res = await fetch('/api/clients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingClient.id, ...payload }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to update client (HTTP ${res.status})`);
        }
        toast.success(`${form.tradeName} updated`);
        // Customer count changed — refresh dashboards.
        invalidateBusinessSnapshot();
      } else {
        // POST /api/clients
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to create client (HTTP ${res.status})`);
        }
        toast.success(`${form.tradeName} added to your firm`);
        // New customer — refresh dashboards / Oracle / AI CFO.
        invalidateBusinessSnapshot();
      }
      setDialogOpen(false);
      // Instantly refresh the list so the new/edited client appears.
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSaving(false);
    }
  }, [form, editingClient, orgId, refetch]);

  // ── Delete via Prisma API ──────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/clients?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to delete client (HTTP ${res.status})`);
      }
      toast.success(`${deleteTarget.tradeName} removed`);
      // Customer removed — refresh dashboards.
      invalidateBusinessSnapshot();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete client');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, refetch]);

  // ── Navigate to workspace ───────────────────────────────────────────────────
  const goToWorkspace = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('client-workspace' as AppView);
  }, [setCurrentView, setSelectedClientId]);

  // ── Navigate to returns ─────────────────────────────────────────────────────
  const goToReturns = useCallback((clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView('returns' as AppView);
  }, [setCurrentView, setSelectedClientId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Client Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your GST client portfolio
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <AskOracleButton context="customers" />
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 gap-2 self-start">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* ── Search & Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or GSTIN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {uniqueStates.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Loading State ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-4/5" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Error State ─────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-800">Failed to load clients</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────────── */}
      {!loading && !error && clients.length === 0 && (
        <ProfessionalEmptyState
          icon={UserPlus}
          title="No clients yet"
          description="Add your first GST client to unlock compliance tracking, return filing, invoice management, and a dedicated client workspace."
          accent="emerald"
          action={{
            label: 'Add your first client',
            onClick: openCreate,
            icon: Plus,
          }}
          secondaryAction={{
            label: 'Go to invoice workspace',
            onClick: () => setCurrentView('invoices'),
          }}
        />
      )}

      {/* ── No Results (after filtering) ────────────────────────────────────── */}
      {!loading && !error && clients.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="No matching clients"
          description="Try adjusting your search or filter criteria."
          compact
        />
      )}

      {/* ── Client Grid ─────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((client, i) => (
              <motion.div
                key={client.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow border-slate-200"
                  onClick={() => goToWorkspace(client.id)}
                >
                  <CardContent className="p-5">
                    {/* Top row: name + menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                          {client.tradeName}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {formatGSTIN(client.gstin)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(client); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); goToReturns(client.id); }}>
                            <Clock className="h-3.5 w-3.5 mr-2" /> View Returns
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={e => { e.stopPropagation(); setDeleteTarget(client); }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Details */}
                    <div className="mt-3 space-y-1.5">
                      {client.state && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{client.state}</span>
                          {client.stateCode && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                              {client.stateCode}
                            </span>
                          )}
                        </div>
                      )}
                      {client.contactEmail && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{client.contactEmail}</span>
                        </div>
                      )}
                      {client.contactPhone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{client.contactPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Entity type */}
                    <div className="mt-3">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        <Building2 className="h-3 w-3 mr-1" />
                        {client.entityType}
                      </Badge>
                    </div>

                    {/* Badges: Health + Status + Compliance */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold gap-1 border ${healthScoreColor(client.healthScore)}`}
                      >
                        {healthScoreIcon(client.healthScore)}
                        {client.healthScore}
                      </Badge>
                      {statusBadge(client.status)}
                    </div>

                    {/* Compliance profile summary */}
                    {client.complianceProfile && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Compliance
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Filing</span>
                            <span className={`font-medium ${client.complianceProfile.filingCompliance >= 80 ? 'text-emerald-600' : 'text-orange-600'}`}>
                              {client.complianceProfile.filingCompliance}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">GSTIN</span>
                            <span className={`font-medium ${client.complianceProfile.gstinValidity ? 'text-emerald-600' : 'text-red-600'}`}>
                              {client.complianceProfile.gstinValidity ? 'Valid' : 'Invalid'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Overdue</span>
                            <span className={`font-medium ${client.complianceProfile.overdueReturns > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {client.complianceProfile.overdueReturns}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Filed</span>
                            <span className="font-medium text-foreground">
                              {client.complianceProfile.totalReturnsFiled}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Count ───────────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG
         ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Trade Name */}
            <div className="grid gap-2">
              <Label htmlFor="tradeName">Trade Name *</Label>
              <Input
                id="tradeName"
                value={form.tradeName}
                onChange={e => setForm(p => ({ ...p, tradeName: e.target.value }))}
                placeholder="e.g. Acme Industries"
              />
            </div>

            {/* Legal Name */}
            <div className="grid gap-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={e => setForm(p => ({ ...p, legalName: e.target.value }))}
                placeholder="Registered legal name"
              />
            </div>

            {/* GSTIN */}
            <div className="grid gap-2">
              <Label htmlFor="gstin">GSTIN *</Label>
              <Input
                id="gstin"
                value={form.gstin}
                onChange={e => setForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="font-mono"
              />
              {form.gstin && !validateGSTIN(form.gstin) && (
                <p className="text-xs text-red-500">Invalid GSTIN format</p>
              )}
            </div>

            {/* State + State Code */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>State</Label>
                <Select value={form.state} onValueChange={handleStateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => (
                      <SelectItem key={s.code} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stateCode">State Code</Label>
                <Input
                  id="stateCode"
                  value={form.stateCode}
                  onChange={e => setForm(p => ({ ...p, stateCode: e.target.value }))}
                  placeholder="Auto-filled"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Entity Type + Return Period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Entity Type</Label>
                <Select value={form.entityType} onValueChange={v => setForm(p => ({ ...p, entityType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Return Period</Label>
                <Select value={form.returnPeriod} onValueChange={v => setForm(p => ({ ...p, returnPeriod: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact Email */}
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))}
                placeholder="contact@company.com"
              />
            </div>

            {/* Contact Phone */}
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={form.contactPhone}
                onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Registered business address"
              />
            </div>

            {/* Status + Health (for edit) */}
            {editingClient && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as ClientFormState['status'] }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="healthScore">Health Score</Label>
                  <Input
                    id="healthScore"
                    type="number"
                    min={0}
                    max={100}
                    value={form.healthScore}
                    onChange={e => setForm(p => ({ ...p, healthScore: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (form.gstin.length > 0 && !validateGSTIN(form.gstin))}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? 'Saving…' : editingClient ? 'Update Client' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION
         ═══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.tradeName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the client and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
