'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Users,
  Plus,
  Search,
  LayoutGrid,
  List,
  Building2,
  FileText,
  Receipt,
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CircleDot,
  X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { Client, ClientStatus } from '@/types/gst';

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'casual_taxable', label: 'Casual Taxable' },
  { value: 'non_resident', label: 'Non-Resident' },
  { value: 'govt_dept', label: 'Government Department' },
  { value: 'sez_unit', label: 'SEZ Unit' },
  { value: 'ecommerce', label: 'E-Commerce Operator' },
  { value: 'tds_deductor', label: 'TDS Deductor' },
];

const RETURN_PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const INDIAN_STATES: { name: string; code: string }[] = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Ladakh', code: '38' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Puducherry', code: '34' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientWithAggregations extends Client {
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
}

interface ClientForm {
  gstin: string;
  tradeName: string;
  legalName: string;
  contactEmail: string;
  contactPhone: string;
  state: string;
  stateCode: string;
  entityType: string;
  returnPeriod: string;
}

const EMPTY_FORM: ClientForm = {
  gstin: '',
  tradeName: '',
  legalName: '',
  contactEmail: '',
  contactPhone: '',
  state: '',
  stateCode: '',
  entityType: 'regular',
  returnPeriod: 'monthly',
};

// ─── GSTIN Validation ─────────────────────────────────────────────────────────

function validateGSTIN(gstin: string): { valid: boolean; error?: string } {
  if (!gstin) return { valid: false, error: 'GSTIN is required' };
  const clean = gstin.toUpperCase().replace(/\s/g, '');
  if (clean.length !== 15) return { valid: false, error: 'GSTIN must be 15 characters' };
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return { valid: false, error: 'Invalid GSTIN format' };
  // Validate state code prefix
  const stateCode = clean.slice(0, 2);
  const validCodes = INDIAN_STATES.map(s => s.code);
  if (!validCodes.includes(stateCode)) return { valid: false, error: 'Invalid state code in GSTIN' };
  return { valid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-medium gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Pending
        </Badge>
      );
    case 'inactive':
      return (
        <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 font-medium gap-1.5">
          <span className="size-1.5 rounded-full bg-slate-400" />
          Inactive
        </Badge>
      );
    case 'suspended':
      return (
        <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 font-medium gap-1.5">
          <span className="size-1.5 rounded-full bg-red-500" />
          Suspended
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getEntityTypeLabel(type: string): string {
  return ENTITY_TYPES.find(e => e.value === type)?.label ?? type;
}

function getHealthIndicator(score: number) {
  if (score >= 80) {
    return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2, label: 'Good' };
  }
  if (score >= 50) {
    return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock, label: 'Fair' };
  }
  return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle, label: 'Poor' };
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const cardHover = {
  rest: { y: 0, boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' },
  hover: { y: -2, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientRegistryPage() {
  const { setCurrentView, setSelectedClientId } = useApp();

  // ─── State ────────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientWithAggregations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithAggregations | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [gstinError, setGstinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelClient, setPanelClient] = useState<ClientWithAggregations | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ClientWithAggregations | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      c =>
        c.gstin.toLowerCase().includes(q) ||
        c.tradeName.toLowerCase().includes(q) ||
        (c.legalName?.toLowerCase().includes(q) ?? false) ||
        (c.state?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, searchQuery]);

  const stats = useMemo(() => {
    const active = clients.filter(c => c.status === 'active').length;
    const pending = clients.filter(c => c.status === 'pending').length;
    const inactive = clients.filter(c => c.status === 'inactive' || c.status === 'suspended').length;
    return { active, pending, inactive };
  }, [clients]);

  // ─── Form Handlers ────────────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setGstinError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (client: ClientWithAggregations) => {
    setEditingClient(client);
    setForm({
      gstin: client.gstin,
      tradeName: client.tradeName,
      legalName: client.legalName ?? '',
      contactEmail: client.contactEmail ?? '',
      contactPhone: client.contactPhone ?? '',
      state: client.state ?? '',
      stateCode: client.stateCode ?? '',
      entityType: client.entityType ?? 'regular',
      returnPeriod: client.returnPeriod ?? 'monthly',
    });
    setGstinError(null);
    setDialogOpen(true);
  };

  const handleFormChange = (field: keyof ClientForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'gstin') setGstinError(null);
    if (field === 'state') {
      const stateObj = INDIAN_STATES.find(s => s.name === value);
      if (stateObj) {
        setForm(prev => ({ ...prev, stateCode: stateObj.code }));
      }
    }
  };

  const handleGstinBlur = () => {
    if (form.gstin) {
      const result = validateGSTIN(form.gstin);
      if (!result.valid) setGstinError(result.error ?? 'Invalid GSTIN');
      else setGstinError(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.gstin || !form.tradeName) return;
    if (gstinError) return;

    setSubmitting(true);
    try {
      if (editingClient) {
        // Update
        const res = await fetch('/api/clients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingClient.id,
            gstin: form.gstin.toUpperCase().replace(/\s/g, ''),
            tradeName: form.tradeName,
            legalName: form.legalName || null,
            contactEmail: form.contactEmail || null,
            contactPhone: form.contactPhone || null,
            state: form.state || null,
            stateCode: form.stateCode || null,
            entityType: form.entityType,
            returnPeriod: form.returnPeriod,
          }),
        });
        if (res.ok) {
          setDialogOpen(false);
          await fetchClients();
        } else {
          const data = await res.json();
          setGstinError(data.error ?? 'Failed to update client');
        }
      } else {
        // Create
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gstin: form.gstin.toUpperCase().replace(/\s/g, ''),
            tradeName: form.tradeName,
            legalName: form.legalName || null,
            contactEmail: form.contactEmail || null,
            contactPhone: form.contactPhone || null,
            state: form.state || null,
            stateCode: form.stateCode || null,
            entityType: form.entityType,
            returnPeriod: form.returnPeriod,
          }),
        });
        if (res.ok) {
          setDialogOpen(false);
          await fetchClients();
        } else {
          const data = await res.json();
          setGstinError(data.error ?? 'Failed to create client');
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/clients?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null);
        if (panelClient?.id === deleteTarget.id) {
          setPanelOpen(false);
          setPanelClient(null);
        }
        await fetchClients();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const openClientPanel = (client: ClientWithAggregations) => {
    setPanelClient(client);
    setPanelOpen(true);
  };

  const navigateTo = (view: 'returns' | 'invoices' | 'reconcile', clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView(view);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your GST client portfolio</p>
        </div>
        <Button
          onClick={openAddDialog}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="size-4" />
          Add Client
        </Button>
      </motion.div>

      {/* ── Quick Stats ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.active}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50">
                  <div className="size-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Filing</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.pending}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50">
                  <div className="size-3 rounded-full bg-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-slate-400 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.inactive}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-50">
                  <div className="size-3 rounded-full bg-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Search & View Toggle ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, GSTIN, or state..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center rounded-lg border bg-white p-0.5">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={`gap-1.5 h-8 px-3 text-xs ${viewMode === 'table' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
            >
              <List className="size-3.5" />
              Table
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className={`gap-1.5 h-8 px-3 text-xs ${viewMode === 'card' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
            >
              <LayoutGrid className="size-3.5" />
              Cards
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Client List ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === 'table' ? (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {filteredClients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Users className="size-10 mb-3 text-muted-foreground/40" />
                    <p className="font-medium">No clients found</p>
                    <p className="text-sm mt-1">
                      {searchQuery ? 'Try adjusting your search query' : 'Add your first client to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="whitespace-nowrap pl-5">Trade Name</TableHead>
                          <TableHead className="whitespace-nowrap">GSTIN</TableHead>
                          <TableHead className="whitespace-nowrap">State</TableHead>
                          <TableHead className="whitespace-nowrap">Return Period</TableHead>
                          <TableHead className="whitespace-nowrap">Last Filing</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="whitespace-nowrap text-right pr-5">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClients.map((client, idx) => (
                          <motion.tr
                            key={client.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            className="group cursor-pointer border-b transition-colors hover:bg-emerald-50/40"
                            onClick={() => openClientPanel(client)}
                          >
                            <TableCell className="pl-5">
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                                  <Building2 className="size-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate max-w-[180px]">{client.tradeName}</p>
                                  <p className="text-xs text-muted-foreground">{getEntityTypeLabel(client.entityType)}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{client.gstin}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{client.state ?? '—'}</TableCell>
                            <TableCell className="text-sm capitalize whitespace-nowrap">{client.returnPeriod ?? '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{client.lastFilingDate ?? '—'}</TableCell>
                            <TableCell className="whitespace-nowrap">{getStatusBadge(client.status)}</TableCell>
                            <TableCell className="text-right pr-5">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="size-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => navigateTo('returns', client.id)}
                                      >
                                        <FileText className="size-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View Returns</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="size-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        onClick={() => navigateTo('invoices', client.id)}
                                      >
                                        <Receipt className="size-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View Invoices</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="size-8 p-0">
                                      <MoreHorizontal className="size-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem onClick={() => openEditDialog(client)} className="gap-2">
                                      <Pencil className="size-3.5" />
                                      Edit Client
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openClientPanel(client)} className="gap-2">
                                      <Building2 className="size-3.5" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigateTo('reconcile', client.id)} className="gap-2">
                                      <ArrowRightLeft className="size-3.5" />
                                      Run Reconciliation
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeleteTarget(client)}
                                      className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                      <Trash2 className="size-3.5" />
                                      Delete Client
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredClients.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Users className="size-10 mb-3 text-muted-foreground/40" />
                <p className="font-medium">No clients found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? 'Try adjusting your search query' : 'Add your first client to get started'}
                </p>
              </div>
            ) : (
              filteredClients.map(client => (
                <motion.div key={client.id} variants={itemVariants}>
                  <motion.div
                    variants={cardHover}
                    initial="rest"
                    whileHover="hover"
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <Card
                      className="h-full cursor-pointer shadow-sm hover:border-emerald-200 transition-colors"
                      onClick={() => openClientPanel(client)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                              <Building2 className="size-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{client.tradeName}</p>
                              <p className="text-xs font-mono text-muted-foreground truncate">{client.gstin}</p>
                            </div>
                          </div>
                          {getStatusBadge(client.status)}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">{client.state ?? 'No state'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Last Filing</span>
                            <span className="font-medium">{client.lastFilingDate ?? '—'}</span>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            onClick={e => { e.stopPropagation(); navigateTo('returns', client.id); }}
                          >
                            <FileText className="size-3" />
                            Returns
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                            onClick={e => { e.stopPropagation(); navigateTo('invoices', client.id); }}
                          >
                            <Receipt className="size-3" />
                            Invoices
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button variant="outline" size="sm" className="size-8 p-0 shrink-0">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openEditDialog(client)} className="gap-2">
                                <Pencil className="size-3.5" />
                                Edit Client
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigateTo('reconcile', client.id)} className="gap-2">
                                <ArrowRightLeft className="size-3.5" />
                                Run Reconciliation
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(client)}
                                className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 className="size-3.5" />
                                Delete Client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add / Edit Client Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100">
                <Building2 className="size-4 text-emerald-700" />
              </div>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trade Name */}
              <div className="space-y-2">
                <Label htmlFor="tradeName">Trade Name <span className="text-red-500">*</span></Label>
                <Input
                  id="tradeName"
                  placeholder="e.g. Acme Enterprises"
                  value={form.tradeName}
                  onChange={e => handleFormChange('tradeName', e.target.value)}
                />
              </div>

              {/* Legal Name */}
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Name</Label>
                <Input
                  id="legalName"
                  placeholder="e.g. Acme Enterprises Pvt Ltd"
                  value={form.legalName}
                  onChange={e => handleFormChange('legalName', e.target.value)}
                />
              </div>

              {/* GSTIN */}
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN <span className="text-red-500">*</span></Label>
                <Input
                  id="gstin"
                  placeholder="e.g. 27AABCT1332L1ZP"
                  value={form.gstin}
                  onChange={e => handleFormChange('gstin', e.target.value.toUpperCase())}
                  onBlur={handleGstinBlur}
                  className={`font-mono ${gstinError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                />
                {gstinError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {gstinError}
                  </p>
                )}
              </div>

              {/* Entity Type */}
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={form.entityType} onValueChange={v => handleFormChange('entityType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(et => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={form.state} onValueChange={v => handleFormChange('state', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => (
                      <SelectItem key={s.code} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* State Code (auto-filled) */}
              <div className="space-y-2">
                <Label htmlFor="stateCode">State Code</Label>
                <Input
                  id="stateCode"
                  placeholder="Auto-filled from state"
                  value={form.stateCode}
                  onChange={e => handleFormChange('stateCode', e.target.value)}
                  className="font-mono bg-muted/30"
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  placeholder="email@company.com"
                  type="email"
                  value={form.contactEmail}
                  onChange={e => handleFormChange('contactEmail', e.target.value)}
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  placeholder="+91-XXXX-XXXXXX"
                  value={form.contactPhone}
                  onChange={e => handleFormChange('contactPhone', e.target.value)}
                />
              </div>

              {/* Return Period */}
              <div className="space-y-2">
                <Label>Return Period</Label>
                <Select value={form.returnPeriod} onValueChange={v => handleFormChange('returnPeriod', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_PERIODS.map(rp => (
                      <SelectItem key={rp.value} value={rp.value}>
                        {rp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.gstin || !form.tradeName || !!gstinError || submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
            >
              {submitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Client Detail Side Panel ────────────────────────────────────────── */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {panelClient && (
            <>
              <SheetHeader className="pb-0">
                <SheetTitle className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">{panelClient.tradeName}</p>
                    <p className="text-sm font-mono font-normal text-muted-foreground">{panelClient.gstin}</p>
                  </div>
                </SheetTitle>
                <SheetDescription className="sr-only">Client details panel</SheetDescription>
              </SheetHeader>

              <div className="px-4 pt-4 space-y-5">
                {/* Status & Health */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(panelClient.status)}
                  {(() => {
                    const health = getHealthIndicator(panelClient.healthScore);
                    const Icon = health.icon;
                    return (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${health.bg} ${health.color} ${health.border} border`}>
                        <Icon className="size-3.5" />
                        Health: {panelClient.healthScore}/100 — {health.label}
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* Client Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="size-4 text-emerald-600" />
                    Client Information
                  </h3>
                  <div className="grid gap-3 text-sm">
                    {panelClient.legalName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Legal Name</span>
                        <span className="font-medium truncate ml-4 max-w-[200px]">{panelClient.legalName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entity Type</span>
                      <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                        {getEntityTypeLabel(panelClient.entityType)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">State / Code</span>
                      <span className="font-medium">{panelClient.state ?? '—'} ({panelClient.stateCode ?? '—'})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Return Period</span>
                      <span className="font-medium capitalize">{panelClient.returnPeriod ?? '—'}</span>
                    </div>
                    {panelClient.contactEmail && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{panelClient.contactEmail}</span>
                      </div>
                    )}
                    {panelClient.contactPhone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-3.5 shrink-0" />
                        <span>{panelClient.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Filing Status */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="size-4 text-emerald-600" />
                    Filing Status
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                      <p className="text-xs text-emerald-600 font-medium">Filed Returns</p>
                      <p className="text-2xl font-bold text-emerald-700">{panelClient._aggregations?.filedReturns ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                      <p className="text-xs text-amber-600 font-medium">Pending Returns</p>
                      <p className="text-2xl font-bold text-amber-700">{panelClient._aggregations?.pendingReturns ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Filing Date</span>
                    <span className="font-medium">{panelClient.lastFilingDate ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Invoices</span>
                    <span className="font-medium">{panelClient._aggregations?.totalInvoices ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Match Percentage</span>
                    <span className="font-medium">{panelClient._aggregations?.matchPercentage ?? 0}%</span>
                  </div>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
                  <div className="grid gap-2">
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={() => navigateTo('returns', panelClient.id)}
                    >
                      <FileText className="size-4" />
                      View Returns
                      <ChevronRight className="size-4 ml-auto" />
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-11 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                      onClick={() => navigateTo('invoices', panelClient.id)}
                    >
                      <Receipt className="size-4" />
                      View Invoices
                      <ChevronRight className="size-4 ml-auto" />
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-11 border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                      onClick={() => navigateTo('reconcile', panelClient.id)}
                    >
                      <ArrowRightLeft className="size-4" />
                      Run Reconciliation
                      <ChevronRight className="size-4 ml-auto" />
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-11"
                      onClick={() => {
                        setPanelOpen(false);
                        setTimeout(() => openEditDialog(panelClient), 200);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit Client
                      <ChevronRight className="size-4 ml-auto" />
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-3 h-11 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        setPanelOpen(false);
                        setTimeout(() => setDeleteTarget(panelClient), 200);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete Client
                      <ChevronRight className="size-4 ml-auto" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete Client
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.tradeName}</strong> ({deleteTarget?.gstin})?
              This action cannot be undone. All associated invoices, filings, and data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
