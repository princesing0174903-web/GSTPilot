'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  Download,
  Filter,
  Search,
  RefreshCw,
  Eye,
  ChevronRight,
  Package,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  Invoice,
  GSTRFiling,
  GSTR1Section,
  GSTR1_SECTION_LABELS,
  INVOICE_TYPE_TO_SECTION,
  FILING_STATUS_CONFIG,
  InvoiceType,
  Client,
  FilingEvent,
} from '@/types/gst';
import { formatCurrency, periodToLabel, getGSTR1Section, classifyInvoice } from '@/lib/gst-utils';

// ─── Helper types ─────────────────────────────────────────────────────────────

interface SectionSummary {
  section: GSTR1Section;
  count: number;
  taxableValue: number;
  totalTax: number;
  invoices: Invoice[];
}

interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Badge color maps ─────────────────────────────────────────────────────────

const INVOICE_TYPE_COLORS: Record<InvoiceType, { color: string; bgColor: string }> = {
  'B2B': { color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  'B2C Large': { color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  'B2C Small': { color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200' },
  'Export': { color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  'Credit Note': { color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  'Debit Note': { color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
  'Nil Rated': { color: 'text-slate-700', bgColor: 'bg-slate-50 border-slate-200' },
  'Exempted': { color: 'text-cyan-700', bgColor: 'bg-cyan-50 border-cyan-200' },
};

const INVOICE_STATUS_COLORS: Record<string, { color: string; bgColor: string }> = {
  draft: { color: 'text-slate-700', bgColor: 'bg-slate-100' },
  approved: { color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  posted: { color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  filed: { color: 'text-blue-700', bgColor: 'bg-blue-50' },
  cancelled: { color: 'text-red-700', bgColor: 'bg-red-50' },
  credit_note: { color: 'text-orange-700', bgColor: 'bg-orange-50' },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  data_imported: { label: 'Data Imported', icon: <Upload className="size-4" />, color: 'text-blue-600' },
  validation_completed: { label: 'Validation Completed', icon: <CheckCircle2 className="size-4" />, color: 'text-cyan-600' },
  review_completed: { label: 'Review Completed', icon: <Eye className="size-4" />, color: 'text-amber-600' },
  gstr_generated: { label: 'GSTR Generated', icon: <FileText className="size-4" />, color: 'text-purple-600' },
  filed: { label: 'Filed', icon: <CheckCircle2 className="size-4" />, color: 'text-emerald-600' },
  reopened: { label: 'Reopened', icon: <RefreshCw className="size-4" />, color: 'text-red-600' },
  downloaded: { label: 'Downloaded', icon: <Download className="size-4" />, color: 'text-teal-600' },
};

const TIMELINE_STEPS = [
  'data_imported',
  'validation_completed',
  'review_completed',
  'gstr_generated',
  'filed',
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GSTRFilingPage() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filings, setFilings] = useState<GSTRFiling[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedFilingId, setSelectedFilingId] = useState<string>('');
  const [filingEvents, setFilingEvents] = useState<FilingEvent[]>([]);
  const [preparing, setPreparing] = useState(false);

  // ─── Data fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [invoicesRes, filingsRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/gstr-filing'),
        ]);

        if (invoicesRes.ok) {
          const invData = await invoicesRes.json();
          setInvoices(invData.invoices ?? invData ?? []);
        }
        if (filingsRes.ok) {
          const filData = await filingsRes.json();
          setFilings(filData.filings ?? filData ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Extract clients from invoices
  useEffect(() => {
    const clientMap = new Map<string, ClientOption>();
    invoices.forEach((inv) => {
      if (inv.client && !clientMap.has(inv.clientId)) {
        clientMap.set(inv.clientId, {
          id: inv.clientId,
          tradeName: inv.client.tradeName,
          gstin: inv.client.gstin,
        });
      }
    });
    // Also check filings
    filings.forEach((f) => {
      if (f.client && !clientMap.has(f.clientId)) {
        clientMap.set(f.clientId, {
          id: f.clientId,
          tradeName: f.client.tradeName,
          gstin: f.client.gstin,
        });
      }
    });
    setClients(Array.from(clientMap.values()));
  }, [invoices, filings]);

  // Fetch filing events when selected filing changes
  useEffect(() => {
    if (!selectedFilingId) {
      setFilingEvents([]);
      return;
    }
    async function fetchEvents() {
      try {
        const res = await fetch(`/api/gstr-filing/${selectedFilingId}/events`);
        if (res.ok) {
          const data = await res.json();
          setFilingEvents(data.events ?? data ?? []);
        }
      } catch {
        setFilingEvents([]);
      }
    }
    fetchEvents();
  }, [selectedFilingId]);

  // ─── Derived data ─────────────────────────────────────────────────────────
  const periods = Array.from(new Set(invoices.map((inv) => inv.period).filter(Boolean))) as string[];

  const filteredInvoices = invoices.filter((inv) => {
    if (selectedClientId !== 'all' && inv.clientId !== selectedClientId) return false;
    if (selectedPeriod !== 'all' && inv.period !== selectedPeriod) return false;
    if (filterType !== 'all' && inv.invoiceType !== filterType) return false;
    if (filterSection !== 'all' && inv.gstr1Section !== filterSection) return false;
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.buyerName?.toLowerCase().includes(q) ?? false) ||
        (inv.buyerGstin?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const sectionSummaries: SectionSummary[] = (['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp'] as GSTR1Section[]).map(
    (section) => {
      const sectionInvoices = filteredInvoices.filter((inv) => inv.gstr1Section === section);
      return {
        section,
        count: sectionInvoices.length,
        taxableValue: sectionInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0),
        totalTax: sectionInvoices.reduce((sum, inv) => sum + inv.cgst + inv.sgst + inv.igst, 0),
        invoices: sectionInvoices,
      };
    }
  );

  const totalInvoices = filteredInvoices.length;
  const totalTaxableValue = filteredInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalTax = filteredInvoices.reduce((sum, inv) => sum + inv.cgst + inv.sgst + inv.igst, 0);

  // ─── Filtered filings ────────────────────────────────────────────────────
  const filteredFilings = filings.filter((f) => {
    if (selectedClientId !== 'all' && f.clientId !== selectedClientId) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    return true;
  });

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleAutoPrepare = async () => {
    setPreparing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.status === 'approved' || inv.status === 'posted'
            ? { ...inv, status: 'approved' as const }
            : inv
        )
      );
    } finally {
      setPreparing(false);
    }
  };

  // ─── Loading Skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <FileText className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">GSTR-1 Automation</h1>
            <p className="text-sm text-muted-foreground">Classify, prepare, and file your GSTR-1 returns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
            <Zap className="size-3" />
            Auto-Classify
          </Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="classification" className="space-y-4">
        <TabsList className="w-full flex-wrap sm:w-auto">
          <TabsTrigger value="classification" className="gap-1.5">
            <Package className="size-3.5" />
            <span className="hidden sm:inline">Invoice Classification</span>
            <span className="sm:hidden">Classify</span>
          </TabsTrigger>
          <TabsTrigger value="preparation" className="gap-1.5">
            <FileText className="size-3.5" />
            <span className="hidden sm:inline">GSTR-1 Preparation</span>
            <span className="sm:hidden">Prepare</span>
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-1.5">
            <CheckCircle2 className="size-3.5" />
            <span className="hidden sm:inline">Filing Status</span>
            <span className="sm:hidden">Status</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="size-3.5" />
            <span className="hidden sm:inline">Filing Timeline</span>
            <span className="sm:hidden">Timeline</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: Invoice Classification
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="classification" className="space-y-4">
          {/* Filters Row */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Client" />
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

                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods.sort().map((p) => (
                      <SelectItem key={p} value={p}>
                        {periodToLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Invoice Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {(Object.keys(INVOICE_TYPE_TO_SECTION) as InvoiceType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterSection} onValueChange={setFilterSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="GSTR-1 Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {(Object.keys(GSTR1_SECTION_LABELS) as GSTR1Section[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {GSTR1_SECTION_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search invoice or buyer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4 text-emerald-600" />
                Invoice Classification
                <Badge variant="secondary" className="ml-2">
                  {filteredInvoices.length} invoices
                </Badge>
              </CardTitle>
              <CardDescription>
                Each invoice is auto-classified into the appropriate GSTR-1 section based on type and buyer details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Buyer GSTIN</TableHead>
                      <TableHead className="whitespace-nowrap">Buyer Name</TableHead>
                      <TableHead className="whitespace-nowrap">Type</TableHead>
                      <TableHead className="whitespace-nowrap">GSTR-1 Section</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Taxable Value</TableHead>
                      <TableHead className="whitespace-nowrap text-right">CGST</TableHead>
                      <TableHead className="whitespace-nowrap text-right">SGST</TableHead>
                      <TableHead className="whitespace-nowrap text-right">IGST</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Package className="size-8 text-muted-foreground/50" />
                            <p>No invoices found matching your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const typeConfig = INVOICE_TYPE_COLORS[inv.invoiceType as InvoiceType];
                        const statusConfig = INVOICE_STATUS_COLORS[inv.status];
                        return (
                          <TableRow key={inv.id} className="group hover:bg-muted/30">
                            <TableCell className="font-medium whitespace-nowrap">
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {inv.invoiceDate}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs">
                              {inv.buyerGstin || '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap max-w-[180px] truncate">
                              {inv.buyerName || '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={`${typeConfig?.color ?? ''} ${typeConfig?.bgColor ?? ''} text-xs`}
                              >
                                {inv.invoiceType}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50 text-slate-700">
                                {GSTR1_SECTION_LABELS[inv.gstr1Section as GSTR1Section] ?? inv.gstr1Section}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right font-medium">
                              {formatCurrency(inv.taxableValue)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                              {formatCurrency(inv.cgst)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                              {formatCurrency(inv.sgst)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                              {formatCurrency(inv.igst)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right font-semibold">
                              {formatCurrency(inv.totalAmount)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={`${statusConfig?.color ?? ''} ${statusConfig?.bgColor ?? ''} text-xs`}
                              >
                                {inv.status === 'credit_note' ? 'Credit Note' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: GSTR-1 Preparation
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="preparation" className="space-y-4">
          {/* Top Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">GSTR-1 Section Preparation</h2>
              <p className="text-sm text-muted-foreground">
                Review auto-classified invoices grouped by GSTR-1 section
              </p>
            </div>
            <Button
              onClick={handleAutoPrepare}
              disabled={preparing}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {preparing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Zap className="size-4" />
              )}
              {preparing ? 'Preparing...' : 'Auto-Prepare'}
            </Button>
          </div>

          {/* Section Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectionSummaries.map((sec) => {
              const isExpanded = expandedSections.has(sec.section);
              return (
                <Collapsible
                  key={sec.section}
                  open={isExpanded}
                  onOpenChange={() => toggleSection(sec.section)}
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer select-none">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <ChevronRight
                              className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                            {GSTR1_SECTION_LABELS[sec.section]}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            {sec.count}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          Taxable: {formatCurrency(sec.taxableValue)} &middot; Tax: {formatCurrency(sec.totalTax)}
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        {sec.invoices.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            No invoices in this section
                          </p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="text-xs">Invoice #</TableHead>
                                  <TableHead className="text-xs">Buyer</TableHead>
                                  <TableHead className="text-xs text-right">Taxable</TableHead>
                                  <TableHead className="text-xs text-right">Tax</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sec.invoices.map((inv) => (
                                  <TableRow key={inv.id}>
                                    <TableCell className="font-medium text-xs whitespace-nowrap">
                                      {inv.invoiceNumber}
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap max-w-[120px] truncate">
                                      {inv.buyerName || '—'}
                                    </TableCell>
                                    <TableCell className="text-xs text-right whitespace-nowrap">
                                      {formatCurrency(inv.taxableValue)}
                                    </TableCell>
                                    <TableCell className="text-xs text-right whitespace-nowrap">
                                      {formatCurrency(inv.cgst + inv.sgst + inv.igst)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>

          {/* Summary Card */}
          <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
                <Package className="size-4" />
                GSTR-1 Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-emerald-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-emerald-900">{totalInvoices}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-emerald-600">Total Taxable Value</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalTaxableValue)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-emerald-600">Total Tax</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalTax)}</p>
                </div>
              </div>
              <Separator className="my-4 bg-emerald-200" />
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {sectionSummaries.map((sec) => (
                  <div key={sec.section} className="text-center">
                    <p className="text-xs font-medium uppercase text-emerald-600">
                      {sec.section.toUpperCase()}
                    </p>
                    <p className="text-lg font-bold text-emerald-900">{sec.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: Filing Status
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="status" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {(Object.keys(FILING_STATUS_CONFIG) as Array<keyof typeof FILING_STATUS_CONFIG>).map((s) => (
                      <SelectItem key={s} value={s}>
                        {FILING_STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Client" />
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

                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Periods</SelectItem>
                    {periods.sort().map((p) => (
                      <SelectItem key={p} value={p}>
                        {periodToLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Filings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-emerald-600" />
                GSTR Filing Status
                <Badge variant="secondary" className="ml-2">
                  {filteredFilings.length} filings
                </Badge>
              </CardTitle>
              <CardDescription>Track the status of all GSTR filings across clients</CardDescription>
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
                      <TableHead className="whitespace-nowrap text-right">Total Invoices</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Ready</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Issues</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Critical</TableHead>
                      <TableHead className="whitespace-nowrap">Filed Date</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFilings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="size-8 text-muted-foreground/50" />
                            <p>No filings found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFilings.map((filing) => {
                        const statusCfg = FILING_STATUS_CONFIG[filing.status as keyof typeof FILING_STATUS_CONFIG];
                        return (
                          <TableRow key={filing.id} className="group hover:bg-muted/30">
                            <TableCell className="font-medium whitespace-nowrap">
                              {filing.client?.tradeName ?? filing.clientId}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="outline" className="text-xs">
                                {filing.returnType}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {periodToLabel(filing.period)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {statusCfg && (
                                <Badge
                                  variant="outline"
                                  className={`${statusCfg.color} ${statusCfg.bgColor} text-xs`}
                                >
                                  {statusCfg.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {filing.totalInvoices}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-emerald-600 font-medium">
                              {filing.readyForFiling}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {filing.issuesFound > 0 ? (
                                <span className="text-amber-600 font-medium">{filing.issuesFound}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {filing.criticalErrors > 0 ? (
                                <span className="text-red-600 font-bold">{filing.criticalErrors}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {filing.filedDate ?? '—'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="size-8 p-0"
                                      onClick={() => setSelectedFilingId(filing.id)}
                                    >
                                      <Eye className="size-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                      <DialogTitle>
                                        Filing Details — {filing.returnType} ({periodToLabel(filing.period)})
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3 text-sm">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <span className="text-muted-foreground">Status:</span>{' '}
                                          <Badge
                                            variant="outline"
                                            className={`${statusCfg?.color ?? ''} ${statusCfg?.bgColor ?? ''} text-xs`}
                                          >
                                            {statusCfg?.label ?? filing.status}
                                          </Badge>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Acknowledgment:</span>{' '}
                                          {filing.acknowledgmentNumber ?? '—'}
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Taxable Value:</span>{' '}
                                          {formatCurrency(filing.totalTaxableValue)}
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Total Tax:</span>{' '}
                                          {formatCurrency(filing.totalTax)}
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Filed Date:</span>{' '}
                                          {filing.filedDate ?? '—'}
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Warnings:</span>{' '}
                                          {filing.warnings}
                                        </div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button variant="ghost" size="sm" className="size-8 p-0" title="Generate">
                                  <FileText className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0"
                                  title="Mark as Filed"
                                >
                                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                                </Button>
                                <Button variant="ghost" size="sm" className="size-8 p-0" title="Download">
                                  <Download className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: Filing Timeline
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="timeline" className="space-y-4">
          {/* Filing Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1.5 block">Select Filing to View Timeline</label>
                  <Select value={selectedFilingId} onValueChange={setSelectedFilingId}>
                    <SelectTrigger className="w-full sm:max-w-md">
                      <SelectValue placeholder="Choose a filing..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filings.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.client?.tradeName ?? f.clientId} — {f.returnType} ({periodToLabel(f.period)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedFilingId ? (
            <>
              {/* Progress Indicator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filing Progress</CardTitle>
                  <CardDescription>
                    Visual progress of the selected filing through each stage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const filing = filings.find((f) => f.id === selectedFilingId);
                    const eventTypes = filingEvents.map((e) => e.eventType);
                    const currentStepIndex = TIMELINE_STEPS.reduce((lastIdx, step, idx) => {
                      if (eventTypes.includes(step)) return idx;
                      return lastIdx;
                    }, -1);
                    const progressPct = currentStepIndex >= 0 ? ((currentStepIndex + 1) / TIMELINE_STEPS.length) * 100 : 0;

                    return (
                      <div className="space-y-4">
                        <Progress value={progressPct} className="h-3" />
                        <div className="flex justify-between">
                          {TIMELINE_STEPS.map((step, idx) => {
                            const isCompleted = eventTypes.includes(step);
                            const isCurrent = idx === currentStepIndex;
                            const stepCfg = EVENT_TYPE_CONFIG[step];
                            return (
                              <div key={step} className="flex flex-col items-center gap-1 text-center">
                                <div
                                  className={`flex size-8 items-center justify-center rounded-full border-2 transition-colors ${
                                    isCompleted
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                                      : isCurrent
                                      ? 'border-amber-500 bg-amber-50 text-amber-600'
                                      : 'border-slate-200 bg-slate-50 text-slate-400'
                                  }`}
                                >
                                  {stepCfg?.icon}
                                </div>
                                <span
                                  className={`text-xs font-medium ${
                                    isCompleted
                                      ? 'text-emerald-700'
                                      : isCurrent
                                      ? 'text-amber-700'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {stepCfg?.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Timeline Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="size-4 text-emerald-600" />
                    Filing Events
                  </CardTitle>
                  <CardDescription>Chronological timeline of all events for this filing</CardDescription>
                </CardHeader>
                <CardContent>
                  {filingEvents.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                      <Clock className="size-8 text-muted-foreground/50" />
                      <p>No events recorded for this filing</p>
                    </div>
                  ) : (
                    <div className="relative ml-4">
                      {/* Vertical line */}
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

                      <div className="space-y-6">
                        {filingEvents
                          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                          .map((event, idx) => {
                            const eventCfg = EVENT_TYPE_CONFIG[event.eventType];
                            const isLast = idx === filingEvents.length - 1;
                            return (
                              <div key={event.id} className="relative flex gap-4">
                                {/* Dot */}
                                <div
                                  className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-background ${
                                    eventCfg?.color ?? 'text-slate-500'
                                  } ${isLast ? 'border-emerald-400' : 'border-slate-200'}`}
                                >
                                  {eventCfg?.icon ?? <FileText className="size-4" />}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 rounded-lg border p-4 ${isLast ? 'border-emerald-200 bg-emerald-50/50' : 'bg-background'}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-medium text-sm">
                                      {eventCfg?.label ?? event.eventType}
                                    </h4>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {new Date(event.timestamp).toLocaleString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  {event.description && (
                                    <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                                  )}
                                  {event.userId && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      By: {event.userId}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <ArrowRight className="size-8 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Select a filing to view its timeline</p>
                  <p className="text-sm">Choose a filing from the dropdown above to see the complete event history</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
