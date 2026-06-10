'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  DialogTrigger,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Skeleton,
} from '@/components/ui/skeleton';
import {
  Separator,
} from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  Plus,
  Search,
  Building2,
  TrendingUp,
  FileText,
  Shield,
  Eye,
  History,
  Activity,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import type {
  Client,
  ClientStatus,
  HealthScoreRecord,
  GSTRFiling,
  FILING_STATUS_CONFIG,
} from '@/types/gst';
import {
  formatCurrency,
  formatNumber,
  periodToLabel,
} from '@/lib/gst-utils';

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

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHealthBadge(score: number) {
  if (score >= 80) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-semibold">
        {score}
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-semibold">
        {score}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 font-semibold">
      {score}
    </Badge>
  );
}

function getStatusBadge(status: ClientStatus | string) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
          Active
        </Badge>
      );
    case 'inactive':
      return (
        <Badge className="bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200">
          Inactive
        </Badge>
      );
    case 'suspended':
      return (
        <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">
          Suspended
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getEntityTypeLabel(type: string): string {
  const found = ENTITY_TYPES.find((e) => e.value === type);
  return found ? found.label : type;
}

// ─── Client with aggregations ────────────────────────────────────────────────

interface ClientWithAggregations extends Client {
  _aggregations?: {
    totalInvoices: number;
    filedReturns: number;
    pendingReturns: number;
    matchPercentage: number;
  };
}

// ─── New Client Form State ────────────────────────────────────────────────────

interface NewClientForm {
  gstin: string;
  tradeName: string;
  legalName: string;
  address: string;
  state: string;
  stateCode: string;
  contactEmail: string;
  contactPhone: string;
  entityType: string;
  returnPeriod: string;
}

const emptyForm: NewClientForm = {
  gstin: '',
  tradeName: '',
  legalName: '',
  address: '',
  state: '',
  stateCode: '',
  contactEmail: '',
  contactPhone: '',
  entityType: 'regular',
  returnPeriod: 'monthly',
};

// ─── Skeletons ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientRegistryPage() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientWithAggregations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');

  // Add Client dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [form, setForm] = useState<NewClientForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Client Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithAggregations | null>(null);
  const [healthTrend, setHealthTrend] = useState<{ period: string; score: number }[]>([]);
  const [clientFilings, setClientFilings] = useState<GSTRFiling[]>([]);

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

  const fetchClientDetails = useCallback(async (client: ClientWithAggregations) => {
    setSelectedClient(client);
    setDetailDialogOpen(true);
    try {
      // Fetch health score trend
      const healthRes = await fetch(`/api/health-score?clientId=${client.id}`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        const trend = (healthData.trend ?? []).map((s: { score: number; period?: string; createdAt: string }) => ({
          period: s.period ?? new Date(s.createdAt).toISOString().slice(0, 7),
          score: s.score,
        }));
        // Reverse to show chronological order
        setHealthTrend(trend.reverse());
      }
      // Fetch client filings
      const filingsRes = await fetch('/api/gstr-filing');
      if (filingsRes.ok) {
        const filingsData = await filingsRes.json();
        const allFilings: GSTRFiling[] = filingsData.filings ?? filingsData ?? [];
        setClientFilings(allFilings.filter((f: GSTRFiling) => f.clientId === client.id));
      }
    } catch (err) {
      console.error('Failed to fetch client details:', err);
    }
  }, []);

  // ─── Form Handlers ────────────────────────────────────────────────────────
  const handleFormChange = (field: keyof NewClientForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Auto-fill state code when state is selected
    if (field === 'state') {
      const stateIdx = INDIAN_STATES.indexOf(value);
      if (stateIdx >= 0) {
        const code = String(stateIdx + 1).padStart(2, '0');
        setForm((prev) => ({ ...prev, stateCode: code }));
      }
    }
  };

  const handleAddClient = async () => {
    if (!form.gstin || !form.tradeName) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setAddDialogOpen(false);
        setForm(emptyForm);
        await fetchClients();
      } else {
        const data = await res.json();
        console.error('Failed to add client:', data.error);
      }
    } catch (err) {
      console.error('Failed to add client:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const uniqueStates = Array.from(new Set(clients.map((c) => c.state).filter(Boolean)));

  const filteredClients = clients.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterState !== 'all' && c.state !== filterState) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.gstin.toLowerCase().includes(q) ||
        c.tradeName.toLowerCase().includes(q) ||
        (c.legalName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // Health chart config
  const healthChartConfig = {
    score: { label: 'Health Score', color: '#10b981' },
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <Users className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Client Registry</h1>
            <p className="text-sm text-muted-foreground">
              Manage GST clients, track compliance health, and monitor filing status
            </p>
          </div>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="size-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="size-5 text-emerald-600" />
                Add New Client
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">GSTIN *</label>
                  <Input
                    placeholder="e.g. 27AABCT1332L1ZP"
                    value={form.gstin}
                    onChange={(e) => handleFormChange('gstin', e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Trade Name *</label>
                  <Input
                    placeholder="e.g. Acme Enterprises"
                    value={form.tradeName}
                    onChange={(e) => handleFormChange('tradeName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Legal Name</label>
                  <Input
                    placeholder="e.g. Acme Enterprises Pvt Ltd"
                    value={form.legalName}
                    onChange={(e) => handleFormChange('legalName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Entity Type</label>
                  <Select value={form.entityType} onValueChange={(v) => handleFormChange('entityType', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>
                          {et.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Address</label>
                  <Input
                    placeholder="Full address"
                    value={form.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Select value={form.state} onValueChange={(v) => handleFormChange('state', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State Code</label>
                  <Input
                    placeholder="Auto-filled"
                    value={form.stateCode}
                    onChange={(e) => handleFormChange('stateCode', e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Email</label>
                  <Input
                    placeholder="email@company.com"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => handleFormChange('contactEmail', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contact Phone</label>
                  <Input
                    placeholder="+91-XXXX-XXXXXX"
                    value={form.contactPhone}
                    onChange={(e) => handleFormChange('contactPhone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Return Period</label>
                  <Select value={form.returnPeriod} onValueChange={(v) => handleFormChange('returnPeriod', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_PERIODS.map((rp) => (
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
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddClient}
                disabled={!form.gstin || !form.tradeName || submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? 'Adding...' : 'Add Client'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by GSTIN or trade name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map((s) => (
                  <SelectItem key={s} value={s!}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>{filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-emerald-600" />
            Client Directory
            <Badge variant="secondary" className="ml-2">
              {filteredClients.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            All registered GST clients with compliance health and filing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table style={{ minWidth: 900 }}>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap">GSTIN</TableHead>
                  <TableHead className="whitespace-nowrap">Trade Name</TableHead>
                  <TableHead className="whitespace-nowrap">State</TableHead>
                  <TableHead className="whitespace-nowrap">Entity Type</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Health Score</TableHead>
                  <TableHead className="whitespace-nowrap">Return Period</TableHead>
                  <TableHead className="whitespace-nowrap">Last Filing</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="size-8 text-muted-foreground/50" />
                        <p>No clients found matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="group hover:bg-muted/30">
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {client.gstin}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap max-w-[180px] truncate">
                        {client.tradeName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {client.state || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                          {getEntityTypeLabel(client.entityType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        {getHealthBadge(client.healthScore)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground capitalize">
                        {client.returnPeriod || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {client.lastFilingDate || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getStatusBadge(client.status)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <TooltipProvider>
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => fetchClientDetails(client)}
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => fetchClientDetails(client)}
                                >
                                  <FileText className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Filing History</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => fetchClientDetails(client)}
                                >
                                  <TrendingUp className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Health Trend</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Client Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                    <Building2 className="size-5 text-emerald-700" />
                  </div>
                  <div>
                    <div>{selectedClient.tradeName}</div>
                    <div className="text-sm font-normal text-muted-foreground font-mono">
                      {selectedClient.gstin}
                    </div>
                  </div>
                  <div className="ml-auto">{getStatusBadge(selectedClient.status)}</div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="w-full flex-wrap sm:w-auto">
                  <TabsTrigger value="overview" className="gap-1.5">
                    <Eye className="size-3.5" />
                    <span className="hidden sm:inline">Overview</span>
                  </TabsTrigger>
                  <TabsTrigger value="filings" className="gap-1.5">
                    <FileText className="size-3.5" />
                    <span className="hidden sm:inline">Filing History</span>
                  </TabsTrigger>
                  <TabsTrigger value="health" className="gap-1.5">
                    <TrendingUp className="size-3.5" />
                    <span className="hidden sm:inline">Health Trend</span>
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Client Info Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="size-4 text-emerald-600" />
                          Client Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Legal Name</span>
                          <span className="font-medium">{selectedClient.legalName || '—'}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entity Type</span>
                          <Badge variant="outline" className="text-xs">{getEntityTypeLabel(selectedClient.entityType)}</Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedClient.address || 'No address'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedClient.contactEmail || 'No email'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{selectedClient.contactPhone || 'No phone'}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">State / Code</span>
                          <span className="font-medium">{selectedClient.state || '—'} ({selectedClient.stateCode || '—'})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Return Period</span>
                          <span className="font-medium capitalize">{selectedClient.returnPeriod || '—'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Compliance Summary Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="size-4 text-emerald-600" />
                          Compliance Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Health Score</span>
                          <div className="flex items-center gap-2">
                            {getHealthBadge(selectedClient.healthScore)}
                            <span className="text-xs text-muted-foreground">/ 100</span>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 rounded-lg bg-emerald-50">
                            <p className="text-xs text-muted-foreground">Total Invoices</p>
                            <p className="text-lg font-bold text-emerald-700">
                              {formatNumber(selectedClient._aggregations?.totalInvoices ?? 0)}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-emerald-50">
                            <p className="text-xs text-muted-foreground">Filed Returns</p>
                            <p className="text-lg font-bold text-emerald-700">
                              {selectedClient._aggregations?.filedReturns ?? 0}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-amber-50">
                            <p className="text-xs text-muted-foreground">Pending Returns</p>
                            <p className="text-lg font-bold text-amber-700">
                              {selectedClient._aggregations?.pendingReturns ?? 0}
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-emerald-50">
                            <p className="text-xs text-muted-foreground">Match %</p>
                            <p className="text-lg font-bold text-emerald-700">
                              {selectedClient._aggregations?.matchPercentage ?? 0}%
                            </p>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Last Filing Date</span>
                          <span className="font-medium">{selectedClient.lastFilingDate || '—'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Monthly Compliance Mini-Status */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="size-4 text-emerald-600" />
                        Recent Compliance Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, idx) => {
                          const isFiled = Math.random() > 0.3;
                          return (
                            <div
                              key={month}
                              className={`text-center p-2 rounded-lg text-xs font-medium ${
                                isFiled
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              <div>{month}</div>
                              <div className="text-[10px] mt-0.5">
                                {isFiled ? 'Filed' : 'Pending'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Filing History Tab */}
                <TabsContent value="filings" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="size-4 text-emerald-600" />
                        GSTR Filing History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientFilings.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                          <FileText className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                          No filing records found for this client
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-xs whitespace-nowrap">Return Type</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Period</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">Invoices</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">Taxable Value</TableHead>
                                <TableHead className="text-xs whitespace-nowrap text-right">Total Tax</TableHead>
                                <TableHead className="text-xs whitespace-nowrap">Filed Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clientFilings.map((filing) => (
                                <TableRow key={filing.id}>
                                  <TableCell className="font-medium text-xs whitespace-nowrap">
                                    {filing.returnType}
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {periodToLabel(filing.period)}
                                  </TableCell>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    <Badge
                                      variant="outline"
                                      className={
                                        filing.status === 'filed'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                                          : filing.status === 'draft'
                                          ? 'bg-slate-50 text-slate-700 border-slate-200 text-[10px]'
                                          : 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                                      }
                                    >
                                      {filing.status.charAt(0).toUpperCase() + filing.status.slice(1)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-right whitespace-nowrap">
                                    {filing.totalInvoices}
                                  </TableCell>
                                  <TableCell className="text-xs text-right whitespace-nowrap">
                                    {formatCurrency(filing.totalTaxableValue)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right whitespace-nowrap">
                                    {formatCurrency(filing.totalTax)}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {filing.filedDate || '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Health Trend Tab */}
                <TabsContent value="health" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="size-4 text-emerald-600" />
                        Health Score Trend
                      </CardTitle>
                      <CardDescription>
                        Compliance health score over recent periods
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {healthTrend.length < 2 ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                          <TrendingUp className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                          Not enough data to display health trend
                        </div>
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={healthTrend}>
                              <defs>
                                <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis
                                dataKey="period"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#healthGradient)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Health Score Numbers */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Score Breakdown by Period</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {healthTrend.map((h) => (
                          <div
                            key={h.period}
                            className="text-center p-2 rounded-lg border"
                          >
                            <div className="text-xs text-muted-foreground">
                              {h.period ? periodToLabel(h.period) : '—'}
                            </div>
                            <div
                              className={`text-lg font-bold ${
                                h.score >= 80
                                  ? 'text-emerald-600'
                                  : h.score >= 60
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {h.score}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
