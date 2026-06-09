'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  Package,
  Eye,
  Clock,
  Search,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  Invoice,
  GSTRFiling,
  GSTR1Section,
  GSTR1_SECTION_LABELS,
  Client,
} from '@/types/gst';
import { formatCurrency, formatNumber, periodToLabel } from '@/lib/gst-utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SectionPreview {
  section: GSTR1Section;
  invoiceCount: number;
  taxableValue: number;
  totalTax: number;
}

interface RecentExport {
  id: string;
  exportType: string;
  clientName: string;
  period: string;
  generatedAt: string;
  fileSize: string;
  fileType: string;
  data?: unknown;
}

interface ClientOption {
  id: string;
  tradeName: string;
  gstin: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SECTION_KEYS: GSTR1Section[] = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp'];

const EXPORT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  'GSTR-1 JSON': { label: 'GSTR-1 JSON', icon: <FileJson className="size-5" />, color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  'GSTR-1 Excel': { label: 'GSTR-1 Excel', icon: <FileSpreadsheet className="size-5" />, color: 'text-amber-700', bgColor: 'bg-amber-50' },
  'Filing Summary PDF': { label: 'Filing Summary PDF', icon: <FileText className="size-5" />, color: 'text-red-700', bgColor: 'bg-red-50' },
  'Working Papers PDF': { label: 'Working Papers PDF', icon: <FileText className="size-5" />, color: 'text-purple-700', bgColor: 'bg-purple-50' },
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // ─── State ────────────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filings, setFilings] = useState<GSTRFiling[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const m = new Date().getMonth() + 1;
    return m.toString().padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState<string>(() =>
    new Date().getFullYear().toString()
  );
  const [returnType, setReturnType] = useState<string>('GSTR-1');
  const [includeSections, setIncludeSections] = useState<Record<GSTR1Section, boolean>>({
    b2b: true,
    b2cl: true,
    b2cs: true,
    cdnr: true,
    cdnur: true,
    exp: true,
  });

  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<RecentExport | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────
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

  // Extract clients
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

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const selectedPeriod = `${selectedYear}-${selectedMonth}`;

  const filteredInvoices = invoices.filter((inv) => {
    if (selectedClientId !== 'all' && inv.clientId !== selectedClientId) return false;
    if (inv.period && inv.period !== selectedPeriod) return false;
    if (!includeSections[inv.gstr1Section as GSTR1Section]) return false;
    return true;
  });

  const sectionPreviews: SectionPreview[] = SECTION_KEYS
    .filter((s) => includeSections[s])
    .map((section) => {
      const sectionInvoices = filteredInvoices.filter((inv) => inv.gstr1Section === section);
      return {
        section,
        invoiceCount: sectionInvoices.length,
        taxableValue: sectionInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0),
        totalTax: sectionInvoices.reduce((sum, inv) => sum + inv.cgst + inv.sgst + inv.igst, 0),
      };
    });

  const totalTaxableValue = filteredInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0);
  const totalTax = filteredInvoices.reduce((sum, inv) => sum + inv.cgst + inv.sgst + inv.igst, 0);
  const totalInvoices = filteredInvoices.length;

  const matchedFiling = filings.find(
    (f) =>
      (selectedClientId === 'all' || f.clientId === selectedClientId) &&
      f.period === selectedPeriod &&
      f.returnType === returnType
  );

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleSection = (section: GSTR1Section) => {
    setIncludeSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const addRecentExport = useCallback((exp: RecentExport) => {
    setRecentExports((prev) => [exp, ...prev].slice(0, 10));
  }, []);

  const handleGenerateJSON = async () => {
    setGenerating('json');
    try {
      const body: Record<string, string> = { type: 'json' };
      if (matchedFiling) body.filingId = matchedFiling.id;
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Export failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${selectedPeriod}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const clientName = selectedClientId === 'all'
        ? 'All Clients'
        : clients.find((c) => c.id === selectedClientId)?.tradeName ?? 'Unknown';

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'GSTR-1 JSON',
        clientName,
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`,
        fileType: 'json',
        data,
      });
    } catch (err) {
      console.error('JSON export error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateExcel = async () => {
    setGenerating('csv');
    try {
      const body: Record<string, string> = { type: 'csv' };
      if (matchedFiling) body.filingId = matchedFiling.id;
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Export failed');

      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR1_${selectedPeriod}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const clientName = selectedClientId === 'all'
        ? 'All Clients'
        : clients.find((c) => c.id === selectedClientId)?.tradeName ?? 'Unknown';

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'GSTR-1 Excel',
        clientName,
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: `${(csvText.length / 1024).toFixed(1)} KB`,
        fileType: 'csv',
      });
    } catch (err) {
      console.error('Excel export error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGeneratePDF = async () => {
    setGenerating('report');
    try {
      const body: Record<string, string> = { type: 'report' };
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Report generation failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FilingSummary_${selectedPeriod}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const clientName = selectedClientId === 'all'
        ? 'All Clients'
        : clients.find((c) => c.id === selectedClientId)?.tradeName ?? 'Unknown';

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Filing Summary PDF',
        clientName,
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`,
        fileType: 'json',
        data,
      });
    } catch (err) {
      console.error('PDF report error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateWorkingPapers = async () => {
    setGenerating('working-papers');
    try {
      const body: Record<string, string> = { type: 'report' };
      if (selectedClientId !== 'all') body.clientId = selectedClientId;

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Working papers generation failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WorkingPapers_${selectedPeriod}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const clientName = selectedClientId === 'all'
        ? 'All Clients'
        : clients.find((c) => c.id === selectedClientId)?.tradeName ?? 'Unknown';

      addRecentExport({
        id: crypto.randomUUID(),
        exportType: 'Working Papers PDF',
        clientName,
        period: periodToLabel(selectedPeriod),
        generatedAt: new Date().toISOString(),
        fileSize: `${(JSON.stringify(data).length / 1024).toFixed(1)} KB`,
        fileType: 'json',
        data,
      });
    } catch (err) {
      console.error('Working papers error:', err);
    } finally {
      setGenerating(null);
    }
  };

  const handleDeleteExport = (id: string) => {
    setRecentExports((prev) => prev.filter((e) => e.id !== id));
  };

  const handleViewExport = (exp: RecentExport) => {
    setPreviewData(exp);
    setPreviewOpen(true);
  };

  const handleDownloadExport = (exp: RecentExport) => {
    if (!exp.data) return;
    const blob = new Blob([JSON.stringify(exp.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exp.exportType.replace(/\s+/g, '_')}_${exp.period}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
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
            <Package className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Filing Package Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate, export, and download your GST filing packages
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Export Options
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* GSTR-1 JSON */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <FileJson className="size-5 text-emerald-700" />
              </div>
              <div>
                <CardTitle className="text-base">GSTR-1 JSON</CardTitle>
                <CardDescription className="text-xs mt-0.5">GST Portal Upload Format</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate GSTR-1 return in JSON format for upload to GST portal
            </p>
            <Button
              onClick={handleGenerateJSON}
              disabled={generating !== null}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {generating === 'json' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileJson className="size-4" />
              )}
              {generating === 'json' ? 'Generating...' : 'Generate'}
            </Button>
          </CardContent>
        </Card>

        {/* GSTR-1 Excel */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <FileSpreadsheet className="size-5 text-amber-700" />
              </div>
              <div>
                <CardTitle className="text-base">GSTR-1 Excel</CardTitle>
                <CardDescription className="text-xs mt-0.5">Spreadsheet Export</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export GSTR-1 data in Excel format for review and records
            </p>
            <Button
              onClick={handleGenerateExcel}
              disabled={generating !== null}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {generating === 'csv' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              {generating === 'csv' ? 'Exporting...' : 'Export'}
            </Button>
          </CardContent>
        </Card>

        {/* Filing Summary PDF */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <FileText className="size-5 text-red-700" />
              </div>
              <div>
                <CardTitle className="text-base">Filing Summary PDF</CardTitle>
                <CardDescription className="text-xs mt-0.5">Comprehensive Report</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate comprehensive filing summary report in PDF format
            </p>
            <Button
              onClick={handleGeneratePDF}
              disabled={generating !== null}
              className="w-full gap-2 bg-red-600 hover:bg-red-700"
            >
              {generating === 'report' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              {generating === 'report' ? 'Generating...' : 'Generate PDF'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          Configuration Panel
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-emerald-600" />
            Export Configuration
          </CardTitle>
          <CardDescription>
            Select the client, period, and sections to include in the export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Client Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
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
            </div>

            {/* Month Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString().padStart(2, '0')}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Return Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Return Type</label>
              <Select value={returnType} onValueChange={setReturnType}>
                <SelectTrigger>
                  <SelectValue placeholder="Return Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GSTR-1">GSTR-1</SelectItem>
                  <SelectItem value="GSTR-3B">GSTR-3B</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Section Checkboxes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Include Sections</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {SECTION_KEYS.map((section) => (
                <div key={section} className="flex items-center gap-2">
                  <Checkbox
                    id={`section-${section}`}
                    checked={includeSections[section]}
                    onCheckedChange={() => toggleSection(section)}
                  />
                  <label
                    htmlFor={`section-${section}`}
                    className="text-sm cursor-pointer select-none"
                  >
                    {section.toUpperCase()}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          Preview Section
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
            <Eye className="size-4" />
            Export Preview
          </CardTitle>
          <CardDescription>
            Summary of data that will be included in the export for{' '}
            <span className="font-medium text-emerald-700">{periodToLabel(selectedPeriod)}</span>
            {selectedClientId !== 'all' && (
              <>
                {' '}—{' '}
                <span className="font-medium text-emerald-700">
                  {clients.find((c) => c.id === selectedClientId)?.tradeName}
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
              <p className="text-sm text-emerald-600">Total Invoices</p>
              <p className="text-2xl font-bold text-emerald-900">{formatNumber(totalInvoices)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
              <p className="text-sm text-emerald-600">Total Taxable Value</p>
              <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalTaxableValue)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
              <p className="text-sm text-emerald-600">Total Tax</p>
              <p className="text-2xl font-bold text-emerald-900">{formatCurrency(totalTax)}</p>
            </div>
          </div>

          <Separator className="my-4 bg-emerald-200" />

          {/* Section Breakdown */}
          <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50/50">
                  <TableHead className="whitespace-nowrap">Section</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Invoices</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Taxable Value</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Total Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionPreviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No sections selected
                    </TableCell>
                  </TableRow>
                ) : (
                  sectionPreviews.map((sp) => (
                    <TableRow key={sp.section} className="hover:bg-emerald-50/30">
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          {GSTR1_SECTION_LABELS[sp.section]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">
                        {formatNumber(sp.invoiceCount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatCurrency(sp.taxableValue)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatCurrency(sp.totalTax)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          Recent Exports
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-amber-600" />
            Recent Exports
          </CardTitle>
          <CardDescription>Your last 10 generated exports</CardDescription>
        </CardHeader>
        <CardContent>
          {recentExports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Download className="size-10 mb-3 text-muted-foreground/40" />
              <p className="text-sm">No exports generated yet</p>
              <p className="text-xs mt-1">Use the export options above to generate your first filing package</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Export Type</TableHead>
                    <TableHead className="whitespace-nowrap">Client</TableHead>
                    <TableHead className="whitespace-nowrap">Period</TableHead>
                    <TableHead className="whitespace-nowrap">Generated At</TableHead>
                    <TableHead className="whitespace-nowrap">File Size</TableHead>
                    <TableHead className="whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExports.map((exp) => {
                    const config = EXPORT_TYPE_CONFIG[exp.exportType];
                    return (
                      <TableRow key={exp.id} className="hover:bg-muted/30">
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`flex size-7 items-center justify-center rounded ${config?.bgColor ?? 'bg-slate-50'}`}>
                              {config?.icon ?? <FileText className="size-3.5" />}
                            </div>
                            <span className="font-medium text-sm">{exp.exportType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {exp.clientName}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {exp.period}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(exp.generatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <Badge variant="outline" className="text-xs">
                            {exp.fileSize}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0"
                              onClick={() => handleViewExport(exp)}
                              title="View"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0"
                              onClick={() => handleDownloadExport(exp)}
                              title="Download"
                            >
                              <Download className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteExport(exp.id)}
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          GST Working Papers
      ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50/50 to-orange-50/50">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
                <FileText className="size-5 text-amber-700" />
              </div>
              <div>
                <CardTitle className="text-base text-amber-900">GST Working Papers</CardTitle>
                <CardDescription>
                  Detailed working papers with reconciliation summaries, tax computations, and section-wise breakdowns for audit and review purposes
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleGenerateWorkingPapers}
              disabled={generating !== null}
              className="gap-2 bg-amber-600 hover:bg-amber-700 shrink-0"
            >
              {generating === 'working-papers' ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              {generating === 'working-papers' ? 'Generating...' : 'Generate Working Papers'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          Preview Dialog
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4 text-emerald-600" />
              Export Preview — {previewData?.exportType}
            </DialogTitle>
          </DialogHeader>
          {previewData?.data && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <pre className="max-h-96 overflow-auto text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(previewData.data, null, 2)}
              </pre>
            </div>
          )}
          {previewData && !previewData.data && (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Preview not available for this export type</p>
              <p className="text-xs mt-1">The file has been downloaded to your device</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
