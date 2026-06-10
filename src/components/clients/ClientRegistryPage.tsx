'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
  Progress,
} from '@/components/ui/progress';
import {
  Users,
  Plus,
  Search,
  Building2,
  FileText,
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
  UserPlus,
  Activity,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import type { Client, ClientStatus } from '@/types/gst';
import { validateGSTIN, formatGSTIN } from '@/lib/gst-utils';

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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CLIENTS: ClientWithAggregations[] = [
  {
    id: 'cl_001',
    gstin: '27AABCT1332L1ZP',
    tradeName: 'Tata Consultancy',
    legalName: 'Tata Consultancy Services Ltd',
    state: 'Maharashtra',
    stateCode: '27',
    contactEmail: 'gst@tcs.com',
    contactPhone: '+91-22-6778-9999',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2026-05-11',
    status: 'active',
    healthScore: 92,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2026-05-11T14:30:00Z',
    _aggregations: { totalInvoices: 1240, filedReturns: 24, pendingReturns: 1, matchPercentage: 96 },
  },
  {
    id: 'cl_002',
    gstin: '29AABCI5055K1ZI',
    tradeName: 'Infosys Ltd',
    legalName: 'Infosys Limited',
    state: 'Karnataka',
    stateCode: '29',
    contactEmail: 'compliance@infosys.com',
    contactPhone: '+91-80-2852-0261',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2026-05-09',
    status: 'active',
    healthScore: 87,
    createdAt: '2025-02-10T09:00:00Z',
    updatedAt: '2026-05-09T11:20:00Z',
    _aggregations: { totalInvoices: 980, filedReturns: 22, pendingReturns: 2, matchPercentage: 91 },
  },
  {
    id: 'cl_003',
    gstin: '24AABCR1718E1ZD',
    tradeName: 'Reliance Industries',
    legalName: 'Reliance Industries Limited',
    state: 'Gujarat',
    stateCode: '24',
    contactEmail: 'gst@ril.com',
    contactPhone: '+91-79-6677-8888',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2026-04-11',
    status: 'active',
    healthScore: 78,
    createdAt: '2025-03-05T12:00:00Z',
    updatedAt: '2026-04-11T16:45:00Z',
    _aggregations: { totalInvoices: 2100, filedReturns: 20, pendingReturns: 3, matchPercentage: 85 },
  },
  {
    id: 'cl_004',
    gstin: '33AABCR5278M1ZC',
    tradeName: 'Murugappa Group',
    legalName: 'Murugappa Group Pvt Ltd',
    state: 'Tamil Nadu',
    stateCode: '33',
    contactEmail: 'finance@murugappa.com',
    contactPhone: '+91-44-2847-3001',
    entityType: 'regular',
    returnPeriod: 'quarterly',
    lastFilingDate: '2026-03-31',
    status: 'active',
    healthScore: 65,
    createdAt: '2025-04-20T08:00:00Z',
    updatedAt: '2026-03-31T10:00:00Z',
    _aggregations: { totalInvoices: 560, filedReturns: 8, pendingReturns: 2, matchPercentage: 72 },
  },
  {
    id: 'cl_005',
    gstin: '06AABCF8035D1ZL',
    tradeName: 'Flipkart Internet',
    legalName: 'Flipkart Internet Private Limited',
    state: 'Haryana',
    stateCode: '06',
    contactEmail: 'gst@flipkart.com',
    contactPhone: '+91-124-619-8000',
    entityType: 'ecommerce',
    returnPeriod: 'monthly',
    lastFilingDate: '2026-04-10',
    status: 'active',
    healthScore: 54,
    createdAt: '2025-05-12T14:00:00Z',
    updatedAt: '2026-04-10T09:30:00Z',
    _aggregations: { totalInvoices: 3500, filedReturns: 18, pendingReturns: 5, matchPercentage: 68 },
  },
  {
    id: 'cl_006',
    gstin: '19AABCM1234L1ZA',
    tradeName: 'Emami Ltd',
    legalName: 'Emami Limited',
    state: 'West Bengal',
    stateCode: '19',
    contactEmail: 'accounts@emami.in',
    contactPhone: '+91-33-2246-8013',
    entityType: 'regular',
    returnPeriod: 'monthly',
    status: 'active',
    healthScore: 45,
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2026-02-15T12:00:00Z',
    _aggregations: { totalInvoices: 420, filedReturns: 15, pendingReturns: 4, matchPercentage: 58 },
  },
  {
    id: 'cl_007',
    gstin: '09AABCD5678K1ZB',
    tradeName: 'Lohia Corp',
    legalName: 'Lohia Corp Pvt Ltd',
    state: 'Uttar Pradesh',
    stateCode: '09',
    contactEmail: 'gst@lohia.com',
    contactPhone: '+91-512-236-1802',
    entityType: 'composition',
    returnPeriod: 'quarterly',
    status: 'pending',
    healthScore: 32,
    createdAt: '2025-07-15T16:00:00Z',
    updatedAt: '2026-01-20T14:30:00Z',
    _aggregations: { totalInvoices: 180, filedReturns: 4, pendingReturns: 6, matchPercentage: 45 },
  },
  {
    id: 'cl_008',
    gstin: '07AABCG9012M1ZE',
    tradeName: 'Bharat Pe Exports',
    legalName: 'Bharat Pe Exports Pvt Ltd',
    state: 'Delhi',
    stateCode: '07',
    contactEmail: 'tax@bharatpe.in',
    contactPhone: '+91-11-4152-9000',
    entityType: 'sez_unit',
    returnPeriod: 'monthly',
    status: 'inactive',
    healthScore: 18,
    createdAt: '2025-02-28T11:00:00Z',
    updatedAt: '2025-11-30T08:00:00Z',
    _aggregations: { totalInvoices: 90, filedReturns: 6, pendingReturns: 8, matchPercentage: 30 },
  },
  {
    id: 'cl_009',
    gstin: '36AABCT3456N1ZF',
    tradeName: 'Divis Laboratories',
    legalName: 'Divis Laboratories Ltd',
    state: 'Telangana',
    stateCode: '36',
    contactEmail: 'compliance@divislabs.com',
    contactPhone: '+91-40-2381-5600',
    entityType: 'regular',
    returnPeriod: 'monthly',
    lastFilingDate: '2026-05-11',
    status: 'active',
    healthScore: 85,
    createdAt: '2025-03-22T09:00:00Z',
    updatedAt: '2026-05-11T17:00:00Z',
    _aggregations: { totalInvoices: 720, filedReturns: 23, pendingReturns: 1, matchPercentage: 93 },
  },
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

// ─── GSTIN Form Validation ──────────────────────────────────────────────────

function validateGSTINForm(gstin: string): { valid: boolean; error?: string } {
  if (!gstin) return { valid: false, error: 'GSTIN is required' };
  const clean = formatGSTIN(gstin);
  if (clean.length !== 15) return { valid: false, error: 'GSTIN must be 15 characters' };
  if (!validateGSTIN(clean)) return { valid: false, error: 'Invalid GSTIN format (e.g. 27AABCT1332L1ZP)' };
  const stateCode = clean.slice(0, 2);
  const validCodes = INDIAN_STATES.map(s => s.code);
  if (!validCodes.includes(stateCode)) return { valid: false, error: 'Invalid state code in GSTIN' };
  return { valid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function getHealthColor(score: number): { bg: string; text: string; bar: string; ring: string } {
  if (score > 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', ring: 'ring-emerald-200' };
  if (score >= 40) return { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', ring: 'ring-amber-200' };
  return { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', ring: 'ring-red-200' };
}

function getHealthLabel(score: number): string {
  if (score > 70) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function getHealthIcon(score: number) {
  if (score > 70) return CheckCircle2;
  if (score >= 40) return Clock;
  return AlertTriangle;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-medium gap-1.5 text-[10px] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Active
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-medium gap-1.5 text-[10px] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Pending
        </Badge>
      );
    case 'inactive':
    case 'suspended':
      return (
        <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 font-medium gap-1.5 text-[10px] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-slate-400" />
          Inactive
        </Badge>
      );
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getEntityTypeLabel(type: string): string {
  return ENTITY_TYPES.find(e => e.value === type)?.label ?? type;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="size-11 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithAggregations | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [gstinError, setGstinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClient, setSheetClient] = useState<ClientWithAggregations | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ClientWithAggregations | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        if (data.clients && data.clients.length > 0) {
          setClients(data.clients);
        } else {
          setClients(MOCK_CLIENTS);
        }
      } else {
        setClients(MOCK_CLIENTS);
      }
    } catch {
      setClients(MOCK_CLIENTS);
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
      const result = validateGSTINForm(form.gstin);
      if (!result.valid) setGstinError(result.error ?? 'Invalid GSTIN');
      else setGstinError(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.gstin || !form.tradeName) return;
    // Validate GSTIN on submit
    const result = validateGSTINForm(form.gstin);
    if (!result.valid) {
      setGstinError(result.error ?? 'Invalid GSTIN');
      return;
    }
    if (gstinError) return;

    setSubmitting(true);
    try {
      if (editingClient) {
        const res = await fetch('/api/clients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingClient.id,
            gstin: formatGSTIN(form.gstin),
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
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gstin: formatGSTIN(form.gstin),
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
        if (sheetClient?.id === deleteTarget.id) {
          setSheetOpen(false);
          setSheetClient(null);
        }
        await fetchClients();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const openClientSheet = (client: ClientWithAggregations) => {
    setSheetClient(client);
    setSheetOpen(true);
  };

  const navigateTo = (view: 'returns' | 'reconcile', clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentView(view as AppView);
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your client directory</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or GSTIN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full sm:w-64 bg-white border-slate-200 focus:border-emerald-300 focus:ring-emerald-200 transition-colors"
            />
          </div>
          <Button
            onClick={openAddDialog}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0"
          >
            <Plus className="size-4" />
            Add Client
          </Button>
        </div>
      </motion.div>

      {/* ── Quick Stats ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-emerald-50/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Active Clients</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.active}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100">
                  <Activity className="size-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-amber-50/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Pending Setup</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.pending}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-100">
                  <Clock className="size-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-slate-400 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inactive</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.inactive}</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100">
                  <Users className="size-5 text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Client Card Grid ─────────────────────────────────────────────────── */}
      {filteredClients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50 mb-4">
            <UserPlus className="size-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {searchQuery ? 'No clients found' : 'No clients yet'}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs text-center">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Add your first client to get started'}
          </p>
          {!searchQuery && (
            <Button
              onClick={openAddDialog}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" />
              Add Client
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredClients.map(client => {
            const health = getHealthColor(client.healthScore);
            const HealthIcon = getHealthIcon(client.healthScore);
            const initials = getInitials(client.tradeName);

            return (
              <motion.div key={client.id} variants={itemVariants}>
                <motion.div
                  whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
                  className="h-full"
                >
                  <Card
                    className="h-full cursor-pointer shadow-sm hover:shadow-lg hover:border-emerald-200/60 transition-all duration-200 border-slate-200/80"
                    onClick={() => openClientSheet(client)}
                  >
                    <CardContent className="p-5">
                      {/* Header: Avatar + Name + Status */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex size-11 items-center justify-center rounded-full shrink-0 font-semibold text-sm ring-2 ${health.bg} ${health.text} ${health.ring}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate leading-tight">
                              {client.tradeName}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                              {client.gstin}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 ml-2">
                          {getStatusBadge(client.status)}
                        </div>
                      </div>

                      {/* Health Score Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <HealthIcon className={`size-3 ${health.text}`} />
                            Health Score
                          </span>
                          <span className={`text-xs font-bold ${health.text}`}>
                            {client.healthScore}/100
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${health.bar}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${client.healthScore}%` }}
                            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                          />
                        </div>
                        <p className={`text-[10px] mt-1 font-medium ${health.text}`}>
                          {getHealthLabel(client.healthScore)}
                        </p>
                      </div>

                      {/* State + Entity Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {client.state && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-slate-200 bg-slate-50 text-slate-600 gap-1">
                            <MapPin className="size-2.5" />
                            {client.state}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-slate-200 bg-slate-50 text-slate-600">
                          {getEntityTypeLabel(client.entityType)}
                        </Badge>
                        {client.returnPeriod && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-emerald-200 bg-emerald-50/60 text-emerald-700 capitalize">
                            {client.returnPeriod}
                          </Badge>
                        )}
                      </div>

                      <Separator className="mb-3" />

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-colors"
                          onClick={e => { e.stopPropagation(); navigateTo('returns', client.id); }}
                        >
                          <FileText className="size-3" />
                          View Returns
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 transition-colors"
                          onClick={e => { e.stopPropagation(); navigateTo('reconcile', client.id); }}
                        >
                          <ArrowRightLeft className="size-3" />
                          Reconcile
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="size-8 p-0 shrink-0 hover:bg-slate-50">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openEditDialog(client)} className="gap-2">
                              <Pencil className="size-3.5" />
                              Edit Client
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
            );
          })}
        </motion.div>
      )}

      {/* ── Add / Edit Client Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
                <Building2 className="size-4 text-emerald-700" />
              </div>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trade Name */}
              <div className="space-y-2">
                <Label htmlFor="tradeName" className="text-xs font-medium">
                  Trade Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tradeName"
                  placeholder="e.g. Acme Enterprises"
                  value={form.tradeName}
                  onChange={e => handleFormChange('tradeName', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Legal Name */}
              <div className="space-y-2">
                <Label htmlFor="legalName" className="text-xs font-medium">Legal Name</Label>
                <Input
                  id="legalName"
                  placeholder="e.g. Acme Enterprises Pvt Ltd"
                  value={form.legalName}
                  onChange={e => handleFormChange('legalName', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* GSTIN */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="gstin" className="text-xs font-medium">
                  GSTIN <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="gstin"
                  placeholder="e.g. 27AABCT1332L1ZP"
                  value={form.gstin}
                  onChange={e => handleFormChange('gstin', e.target.value.toUpperCase())}
                  onBlur={handleGstinBlur}
                  className={`font-mono h-9 ${gstinError ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                />
                {gstinError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {gstinError}
                  </p>
                )}
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">State</Label>
                <Select value={form.state} onValueChange={v => handleFormChange('state', v)}>
                  <SelectTrigger className="h-9">
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

              {/* Entity Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Entity Type</Label>
                <Select value={form.entityType} onValueChange={v => handleFormChange('entityType', v)}>
                  <SelectTrigger className="h-9">
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

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="contactEmail" className="text-xs font-medium">Contact Email</Label>
                <Input
                  id="contactEmail"
                  placeholder="email@company.com"
                  type="email"
                  value={form.contactEmail}
                  onChange={e => handleFormChange('contactEmail', e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <Label htmlFor="contactPhone" className="text-xs font-medium">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  placeholder="+91-XXXX-XXXXXX"
                  value={form.contactPhone}
                  onChange={e => handleFormChange('contactPhone', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.gstin || !form.tradeName || !!gstinError || submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px] h-9"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : editingClient ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Client Detail Sheet ──────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {sheetClient && (() => {
            const health = getHealthColor(sheetClient.healthScore);
            const HealthIcon = getHealthIcon(sheetClient.healthScore);
            const initials = getInitials(sheetClient.tradeName);

            return (
              <>
                <SheetHeader className="pb-0">
                  <SheetTitle className="flex items-center gap-3">
                    <div
                      className={`flex size-12 items-center justify-center rounded-full shrink-0 font-bold text-base ring-2 ${health.bg} ${health.text} ${health.ring}`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate text-base">{sheetClient.tradeName}</p>
                      <p className="text-sm font-mono font-normal text-muted-foreground">{sheetClient.gstin}</p>
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <div className="px-4 pt-5 space-y-5">
                  {/* Status & Health */}
                  <div className="flex items-center justify-between">
                    {getStatusBadge(sheetClient.status)}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${health.bg} ${health.text} ${health.ring} ring-1`}>
                      <HealthIcon className="size-3.5" />
                      {sheetClient.healthScore}/100 — {getHealthLabel(sheetClient.healthScore)}
                    </div>
                  </div>

                  {/* Health Progress */}
                  <div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${health.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${sheetClient.healthScore}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Info */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Shield className="size-3.5 text-emerald-600" />
                      Client Information
                    </h3>
                    <div className="grid gap-3 text-sm">
                      {sheetClient.legalName && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Legal Name</span>
                          <span className="font-medium truncate ml-4 max-w-[220px]">{sheetClient.legalName}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Entity Type</span>
                        <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                          {getEntityTypeLabel(sheetClient.entityType)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">State / Code</span>
                        <span className="font-medium">{sheetClient.state ?? '—'} ({sheetClient.stateCode ?? '—'})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Return Period</span>
                        <span className="font-medium capitalize">{sheetClient.returnPeriod ?? '—'}</span>
                      </div>
                      {sheetClient.contactEmail && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="size-3.5 shrink-0" />
                          <span className="truncate text-sm">{sheetClient.contactEmail}</span>
                        </div>
                      )}
                      {sheetClient.contactPhone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-3.5 shrink-0" />
                          <span className="text-sm">{sheetClient.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Quick Stats */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <FileText className="size-3.5 text-emerald-600" />
                      Filing Stats
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                        <p className="text-[10px] text-muted-600 font-medium">Total Returns</p>
                        <p className="text-xl font-bold text-foreground mt-0.5">
                          {(sheetClient._aggregations?.filedReturns ?? 0) + (sheetClient._aggregations?.pendingReturns ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                        <p className="text-[10px] text-emerald-600 font-medium">Filed</p>
                        <p className="text-xl font-bold text-emerald-700 mt-0.5">
                          {sheetClient._aggregations?.filedReturns ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                        <p className="text-[10px] text-amber-600 font-medium">Pending</p>
                        <p className="text-xl font-bold text-amber-700 mt-0.5">
                          {sheetClient._aggregations?.pendingReturns ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</h3>
                    <div className="grid gap-2">
                      <Button
                        variant="outline"
                        className="justify-start gap-3 h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        onClick={() => navigateTo('returns', sheetClient.id)}
                      >
                        <FileText className="size-4" />
                        View Returns
                        <ChevronRight className="size-4 ml-auto text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start gap-3 h-10 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        onClick={() => navigateTo('reconcile', sheetClient.id)}
                      >
                        <ArrowRightLeft className="size-4" />
                        Run Reconciliation
                        <ChevronRight className="size-4 ml-auto text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start gap-3 h-10"
                        onClick={() => {
                          setSheetOpen(false);
                          setTimeout(() => openEditDialog(sheetClient), 200);
                        }}
                      >
                        <Pencil className="size-4" />
                        Edit Client
                        <ChevronRight className="size-4 ml-auto text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start gap-3 h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setSheetOpen(false);
                          setTimeout(() => setDeleteTarget(sheetClient), 200);
                        }}
                      >
                        <Trash2 className="size-4" />
                        Delete Client
                        <ChevronRight className="size-4 ml-auto text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
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
