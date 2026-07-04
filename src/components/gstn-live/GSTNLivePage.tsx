'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GSTN LIVE INTEGRATION CLOUD™
// Phase 8 — Step 1 — Connect. Execute. Automate. Scale.
//
// 8 Modules with REAL database persistence:
//   Module 1 — GST Search™           POST /api/gst/search
//   Module 2 — PAN Verification™     POST /api/pan/verify
//   Module 3 — GSTR-2B Download™     GET/POST /api/gst/2b (+/sync) — HIGHEST PRIORITY
//   Module 4 — GSTR-1™               GET /api/gstr1, POST /prepare, /file, GET /status
//   Module 5 — GSTR-3B™              GET /api/gstr3b, POST /prepare, /file, GET /status
//   Module 6 — ITC Reconciliation™   GET/POST /api/reconcile (Books vs 2B mismatch engine)
//   Module 7 — E-Invoice™            GET/POST /api/einvoice (IRN + QR + cancel + status)
//   Module 8 — E-Way Bill™           GET/POST /api/ewaybill (generate/extend/cancel/track)
//
// Oracle speaks in past tense: "I've downloaded your GSTR-2B."
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, ShieldCheck, Download, FileText, Receipt, Scale, Zap, Truck,
  RefreshCw, Send, Play, CheckCircle2, AlertTriangle, Cloud, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types (mirror of src/lib/gstn/client.ts) ────────────────────────────────

interface GSTSearchResult {
  gstin: string; legalName: string; tradeName: string;
  status: string; registrationDate: string; taxpayerType: string;
  state: string; stateCode: string; address: string; businessType: string; pan: string;
}
interface PANVerifyResult {
  pan: string; name: string; status: string; entityType: string;
  aadhaarLinked: boolean; lastUpdated: string;
}
interface GSTR2BInvoiceData {
  supplierGSTIN: string; supplierName: string; invoiceNo: string; invoiceDate: string;
  taxableValue: number; igst: number; cgst: number; sgst: number; cess: number;
  itcAvailable: number; itcEligible: boolean;
}
interface GSTR2BDownloadResult {
  gstin: string; period: string; downloadedAt: string; invoiceCount: number;
  totalTaxableValue: number; totalITC: number; eligibleITC: number; ineligibleITC: number;
  invoices: GSTR2BInvoiceData[];
}
interface GSTR1Draft {
  gstin: string; period: string; b2bInvoices: number; b2cInvoices: number;
  exportInvoices: number; creditNotes: number; debitNotes: number; amendments: number;
  totalTaxableValue: number; totalIGST: number; totalCGST: number; totalSGST: number;
  totalCess: number; jsonPayload: string; preparedAt: string;
}
interface GSTR3BDraft {
  gstin: string; period: string; outputTax: number; itcClaimed: number;
  netTaxPayable: number; interest: number; lateFee: number; totalLiability: number;
  jsonPayload: string; preparedAt: string;
}
interface MismatchResult {
  id: string; supplierGSTIN: string; invoiceNo: string;
  reason: string; amount: number; severity: string; status: string; suggestion: string;
}
interface ReconcileResult {
  gstin: string; period: string; totalInvoices: number; matched: number;
  unmatched: number; mismatched: number; matchedPct: number; missingITC: number;
  mismatchValue: number; riskLevel: string; mismatches: MismatchResult[];
}
interface EInvoiceResult {
  irn: string; qrCode: string; ackNo: string; ackDate: string;
  signedInvoice: string; status: string; cancelledAt?: string;
}
interface EWayBillResult {
  ewbNo: string; ewbDate: string; validUpto: string; status: string; consignmentId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SEVERITY_TONE: Record<string, string> = {
  low: 'text-muted-foreground border-white/[0.06] bg-white/[0.02]',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/[0.06]',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/[0.06]',
  critical: 'text-red-400 border-red-500/30 bg-red-500/[0.06]',
};

const REASON_LABEL: Record<string, string> = {
  missing_invoice: 'Missing Invoice',
  gstin_mismatch: 'GSTIN Mismatch',
  value_difference: 'Value Difference',
  duplicate: 'Duplicate Invoice',
  itc_blocked: 'ITC Blocked (Sec 17(5))',
  date_difference: 'Date Difference',
};

// ─── Fade-in ──────────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, emoji, title, subtitle, action }: {
  icon: LucideIcon; emoji?: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            {emoji && <span className="text-base">{emoji}</span>}{title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_GSTIN = '27AAACR5055K1Z5';
const DEFAULT_PERIOD = new Date().toISOString().slice(0, 7);

export default function GSTNLivePage() {
  const { toast } = useToast();
  const [gstin, setGstin] = useState(DEFAULT_GSTIN);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);

  // State for each module's results
  const [searchResult, setSearchResult] = useState<GSTSearchResult | null>(null);
  const [panResult, setPanResult] = useState<PANVerifyResult | null>(null);
  const [panInput, setPanInput] = useState('');
  const [gstr2b, setGstr2b] = useState<GSTR2BDownloadResult | null>(null);
  const [gstr1, setGstr1] = useState<GSTR1Draft | null>(null);
  const [gstr3b, setGstr3b] = useState<GSTR3BDraft | null>(null);
  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null);
  const [einvoice, setEinvoice] = useState<EInvoiceResult | null>(null);
  const [ewaybill, setEwaybill] = useState<EWayBillResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ─── Module 1: GST Search ────────────────────────────────────────────────
  const doSearch = async () => {
    setBusy('search');
    try {
      const res = await fetch('/api/gst/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin }),
      });
      const data = await res.json();
      if (data.ok) {
        setSearchResult(data.profile);
        toast({ title: `🔍 ${data.message}`, description: `${data.profile.legalName} · ${data.profile.state}` });
      } else toast({ title: 'GST Search failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'GST Search failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 2: PAN Verify ────────────────────────────────────────────────
  const doPanVerify = async () => {
    if (!panInput) return;
    setBusy('pan');
    try {
      const res = await fetch('/api/pan/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan: panInput }),
      });
      const data = await res.json();
      if (data.ok) {
        setPanResult(data.result);
        toast({ title: `🪪 ${data.message}` });
      } else toast({ title: 'PAN Verification failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'PAN Verification failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 3: GSTR-2B Download ──────────────────────────────────────────
  const do2bDownload = async () => {
    setBusy('2b');
    try {
      const res = await fetch('/api/gst/2b/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, period }),
      });
      const data = await res.json();
      if (data.ok) {
        setGstr2b(data.result);
        toast({ title: `📥 ${data.message}` });
      } else toast({ title: 'GSTR-2B download failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'GSTR-2B download failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 4: GSTR-1 ────────────────────────────────────────────────────
  const doGstr1Prepare = async () => {
    setBusy('gstr1');
    try {
      const res = await fetch('/api/gstr1/prepare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, period }),
      });
      const data = await res.json();
      if (data.ok) {
        setGstr1(data.draft);
        toast({ title: `📄 ${data.message}` });
      } else toast({ title: 'GSTR-1 prepare failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'GSTR-1 prepare failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const doGstr1File = async () => {
    setBusy('gstr1file');
    try {
      const res = await fetch('/api/gstr1/file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, period }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: `✅ ${data.message}`, description: `ARN: ${data.result.ackNo}` });
      } else toast({ title: 'GSTR-1 file failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'GSTR-1 file failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 5: GSTR-3B ───────────────────────────────────────────────────
  const doGstr3bPrepare = async () => {
    setBusy('gstr3b');
    try {
      const res = await fetch('/api/gstr3b/prepare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, period }),
      });
      const data = await res.json();
      if (data.ok) {
        setGstr3b(data.draft);
        toast({ title: `🧾 ${data.message}` });
      } else toast({ title: 'GSTR-3B prepare failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'GSTR-3B prepare failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const doGstr3bFile = async () => {
    setBusy('gstr3bfile');
    try {
      const res = await fetch('/api/gstr3b/file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, period }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: `✅ ${data.message}`, description: `ARN: ${data.result.ackNo}` });
      } else toast({ title: 'GSTR-3B file failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'GSTR-3B file failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 6: ITC Reconciliation ────────────────────────────────────────
  const doReconcile = async () => {
    setBusy('reconcile');
    try {
      const res = await fetch('/api/reconcile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, period }),
      });
      const data = await res.json();
      if (data.ok) {
        setReconcile(data.result);
        toast({ title: `⚖️ ${data.message}` });
      } else toast({ title: 'Reconciliation failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'Reconciliation failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 7: E-Invoice ─────────────────────────────────────────────────
  const doEinvoice = async () => {
    setBusy('einvoice');
    try {
      const res = await fetch('/api/einvoice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerGstin: gstin, buyerGstin: '29AAACI4799L1ZB',
          invoiceNo: `INV-${period.replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
          invoiceDate: `${period}-15`, invoiceValue: 150000, taxableValue: 127119,
          igst: 22881, cgst: 0, sgst: 0, hsnCode: '998314',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEinvoice(data.result);
        toast({ title: `⚡ ${data.message}` });
      } else toast({ title: 'E-Invoice generation failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'E-Invoice generation failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  // ─── Module 8: E-Way Bill ────────────────────────────────────────────────
  const doEwaybill = async () => {
    setBusy('ewaybill');
    try {
      const res = await fetch('/api/ewaybill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierGstin: gstin, recipientGstin: '29AAACI4799L1ZB',
          documentNo: `DOC-${Math.floor(1000 + Math.random() * 9000)}`,
          documentDate: `${period}-15`, transactionType: 'regular', supplyType: 'inter',
          subSupplyType: 'Supply', fromState: '27', toState: '29',
          totalValue: 250000, cgst: 0, sgst: 0, igst: 45000, cess: 0,
          vehicleNo: 'MH12AB1234', distanceKm: 850,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEwaybill(data.result);
        toast({ title: `🚚 ${data.message}` });
      } else toast({ title: 'E-Way Bill generation failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'E-Way Bill generation failed', variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ═══ Header ═══ */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">
              <span className="accent-gradient-soft rounded-lg px-2 py-0.5 text-sm font-bold accent-text">GSTN LIVE™</span>
              GSTN Live Integration Cloud
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect. Execute. Automate. Scale. · Real GST execution — files, downloads, reconciles, generates.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Connected to GSTN
          </Badge>
        </div>
      </FadeIn>

      {/* ═══ GSTIN + Period selector ═══ */}
      <FadeIn delay={0.05}>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">GSTIN</label>
                <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27AAACR5055K1Z5"
                  className="h-9 w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Period</label>
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
                  className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-foreground outline-none focus:border-white/20" />
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Cloud className="h-3.5 w-3.5 accent-text" />
                <span>8 modules · 16 API endpoints · DB-backed</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* ═══ Tabs for 8 modules ═══ */}
      <FadeIn delay={0.1}>
        <Tabs defaultValue="search" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto w-max gap-1 rounded-2xl border border-white/[0.06] bg-card/60 p-1.5 backdrop-blur-sm">
              {[
                { v: 'search', l: 'GST Search', e: '🔍' },
                { v: 'pan', l: 'PAN Verify', e: '🪪' },
                { v: '2b', l: 'GSTR-2B', e: '📥' },
                { v: 'gstr1', l: 'GSTR-1', e: '📄' },
                { v: 'gstr3b', l: 'GSTR-3B', e: '🧾' },
                { v: 'reconcile', l: 'ITC Recon', e: '⚖️' },
                { v: 'einvoice', l: 'E-Invoice', e: '⚡' },
                { v: 'ewaybill', l: 'E-Way Bill', e: '🚚' },
              ].map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="gap-1.5 rounded-xl px-3 py-1.5 text-xs data-[state=active]:accent-gradient-soft">
                  <span>{t.e}</span><span>{t.l}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value="search" className="mt-4">
            <SearchModule gstin={gstin} result={searchResult} busy={busy === 'search'} onSearch={doSearch} />
          </TabsContent>
          <TabsContent value="pan" className="mt-4">
            <PANModule panInput={panInput} setPanInput={setPanInput} result={panResult} busy={busy === 'pan'} onVerify={doPanVerify} />
          </TabsContent>
          <TabsContent value="2b" className="mt-4">
            <Gstr2bModule gstin={gstin} period={period} result={gstr2b} busy={busy === '2b'} onDownload={do2bDownload} />
          </TabsContent>
          <TabsContent value="gstr1" className="mt-4">
            <Gstr1Module gstin={gstin} period={period} draft={gstr1} busy={busy === 'gstr1'} filing={busy === 'gstr1file'} onPrepare={doGstr1Prepare} onFile={doGstr1File} />
          </TabsContent>
          <TabsContent value="gstr3b" className="mt-4">
            <Gstr3bModule gstin={gstin} period={period} draft={gstr3b} busy={busy === 'gstr3b'} filing={busy === 'gstr3bfile'} onPrepare={doGstr3bPrepare} onFile={doGstr3bFile} />
          </TabsContent>
          <TabsContent value="reconcile" className="mt-4">
            <ReconcileModule gstin={gstin} period={period} result={reconcile} busy={busy === 'reconcile'} onReconcile={doReconcile} />
          </TabsContent>
          <TabsContent value="einvoice" className="mt-4">
            <EinvoiceModule gstin={gstin} result={einvoice} busy={busy === 'einvoice'} onGenerate={doEinvoice} />
          </TabsContent>
          <TabsContent value="ewaybill" className="mt-4">
            <EwaybillModule gstin={gstin} result={ewaybill} busy={busy === 'ewaybill'} onGenerate={doEwaybill} />
          </TabsContent>
        </Tabs>
      </FadeIn>

      {/* ═══ Footer ═══ */}
      <FadeIn delay={0.15}>
        <Card className="border-white/[0.06] bg-card/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 accent-text" />
                <span>16 endpoints · 4 DB tables (GSTProfile, GSTReturn, GSTR2BInvoice, ITCMismatch) · src/lib/gstn/</span>
              </div>
              <span>Oracle speaks in past tense — "I've downloaded your GSTR-2B."</span>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <p className="text-center text-xs text-muted-foreground">
              <span className="accent-text font-semibold">GSTPilot Execution Cloud™</span> — Connect. Execute. Automate. Scale.{' '}
              <span className="text-muted-foreground/70">The Financial Brain of India™</span>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — GST Search™
// ═══════════════════════════════════════════════════════════════════════════════

function SearchModule({ gstin, result, busy, onSearch }: {
  gstin: string; result: GSTSearchResult | null; busy: boolean; onSearch: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Search} emoji="🔍" title="GST Search™" subtitle="Search by GSTIN · Verify taxpayer status · Fetch business information · Persists to DB"
        action={<Button size="sm" onClick={onSearch} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Search GSTIN</Button>} />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">API: <code className="text-foreground">POST /api/gst/search</code> · <code className="text-foreground">GET /api/gst/search?gstin={gstin}</code></p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle will say: <span className="accent-text">"I've searched GSTIN {gstin} — [Legal Name] (Active)."</span></p>
        </CardContent>
      </Card>
      {result ? (
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Search Result · {timeAgo(undefined)}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient-soft text-xl">🏢</div>
              <div>
                <div className="text-base font-bold text-foreground">{result.legalName}</div>
                <div className="text-xs text-muted-foreground">{result.tradeName} · {result.businessType}</div>
              </div>
              <Badge variant="outline" className={cn('ml-auto', result.status === 'Active' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400')}>{result.status}</Badge>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div><div className="text-muted-foreground">GSTIN</div><div className="font-mono text-foreground">{result.gstin}</div></div>
              <div><div className="text-muted-foreground">PAN</div><div className="font-mono text-foreground">{result.pan}</div></div>
              <div><div className="text-muted-foreground">Taxpayer Type</div><div className="text-foreground">{result.taxpayerType}</div></div>
              <div><div className="text-muted-foreground">State</div><div className="text-foreground">{result.state} ({result.stateCode})</div></div>
              <div><div className="text-muted-foreground">Registration Date</div><div className="text-foreground">{result.registrationDate}</div></div>
              <div><div className="text-muted-foreground">Business Type</div><div className="text-foreground">{result.businessType}</div></div>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="text-xs"><span className="text-muted-foreground">Address: </span><span className="text-foreground">{result.address}</span></div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Search GSTIN" to fetch taxpayer details from GSTN. Results are persisted to the <code>GSTProfile</code> table.</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — PAN Verification™
// ═══════════════════════════════════════════════════════════════════════════════

function PANModule({ panInput, setPanInput, result, busy, onVerify }: {
  panInput: string; setPanInput: (v: string) => void; result: PANVerifyResult | null; busy: boolean; onVerify: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={ShieldCheck} emoji="🪪" title="PAN Verification™" subtitle="Verify PAN status · Detect entity type"
        action={<Button size="sm" onClick={onVerify} disabled={busy || !panInput} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Verify PAN</Button>} />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PAN Number</label>
              <input value={panInput} onChange={(e) => setPanInput(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10}
                className="h-9 w-48 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20" />
            </div>
            <Button onClick={onVerify} disabled={busy || !panInput} className="gap-1.5">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Verify</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">API: <code className="text-foreground">POST /api/pan/verify</code></p>
        </CardContent>
      </Card>
      {result ? (
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient-soft text-xl">🪪</div>
              <div>
                <div className="text-base font-bold text-foreground">{result.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{result.pan}</div>
              </div>
              <Badge variant="outline" className={cn('ml-auto', result.status === 'Valid' || result.status === 'Linked' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400')}>{result.status}</Badge>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div><div className="text-muted-foreground">Entity Type</div><div className="text-foreground">{result.entityType}</div></div>
              <div><div className="text-muted-foreground">Aadhaar Linked</div><div className={result.aadhaarLinked ? 'text-emerald-400' : 'text-muted-foreground'}>{result.aadhaarLinked ? '✅ Yes' : '❌ No'}</div></div>
              <div><div className="text-muted-foreground">Last Updated</div><div className="text-foreground">{new Date(result.lastUpdated).toLocaleString('en-IN')}</div></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Enter a PAN (e.g. ABCDE1234F) and click "Verify PAN".</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — GSTR-2B Download™ (HIGHEST PRIORITY)
// ═══════════════════════════════════════════════════════════════════════════════

function Gstr2bModule({ gstin, period, result, busy, onDownload }: {
  gstin: string; period: string; result: GSTR2BDownloadResult | null; busy: boolean; onDownload: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Download} emoji="📥" title="GSTR-2B Download™" subtitle="HIGHEST PRIORITY · Download supplier invoices · Eligible/ineligible ITC · Mismatch detection · Persists to DB"
        action={<Button size="sm" onClick={onDownload} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download GSTR-2B</Button>} />
      <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">API: <code className="text-foreground">POST /api/gst/2b/sync</code> · <code className="text-foreground">GET /api/gst/2b?gstin={gstin}&amp;period={period}</code></p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle will say: <span className="accent-text">"I've downloaded your GSTR-2B for {period}. X invoices, ₹eligible ITC."</span></p>
          <p className="mt-1 text-xs text-muted-foreground">DB table: <code className="text-foreground">GSTR2BInvoice</code> · <code className="text-foreground">GSTReturn</code></p>
        </CardContent>
      </Card>
      {result ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoices</div><div className="text-2xl font-bold text-foreground">{result.invoiceCount}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxable Value</div><div className="text-2xl font-bold text-foreground">{formatINR(result.totalTaxableValue)}</div></CardContent></Card>
            <Card className="border-white/[0.06] accent-gradient-soft backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Eligible ITC</div><div className="text-2xl font-bold accent-text">{formatINR(result.eligibleITC)}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ineligible ITC</div><div className="text-2xl font-bold text-red-400">{formatINR(result.ineligibleITC)}</div></CardContent></Card>
          </div>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Supplier Invoices · downloaded {timeAgo(result.downloadedAt)}</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {result.invoices.map((inv, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{inv.invoiceNo}</span>
                        {inv.itcEligible ? <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">Eligible</Badge> : <Badge variant="outline" className="text-[10px] border-red-500/30 bg-red-500/[0.06] text-red-400">Ineligible</Badge>}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{inv.supplierName} ({inv.supplierGSTIN})</span>
                      <span className="text-muted-foreground">{inv.invoiceDate}</span>
                      <span className="font-semibold text-foreground">{formatINR(inv.taxableValue)}</span>
                      <span className="accent-text font-semibold">ITC {formatINR(inv.itcAvailable)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Download GSTR-2B" to fetch your latest 2B from GSTN. Invoices are stored in the <code>GSTR2BInvoice</code> table.</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — GSTR-1™
// ═══════════════════════════════════════════════════════════════════════════════

function Gstr1Module({ gstin, period, draft, busy, filing, onPrepare, onFile }: {
  gstin: string; period: string; draft: GSTR1Draft | null; busy: boolean; filing: boolean; onPrepare: () => void; onFile: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={FileText} emoji="📄" title="GSTR-1™" subtitle="Sales Register · B2B · B2C · Exports · Amendments · Debit/Credit Notes · Prepare JSON · File return"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onPrepare} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Prepare Draft</Button>
            <Button size="sm" onClick={onFile} disabled={filing || !draft} className="gap-1.5">{filing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} File Return</Button>
          </div>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">APIs: <code className="text-foreground">POST /api/gstr1/prepare</code> · <code className="text-foreground">POST /api/gstr1/file</code> · <code className="text-foreground">GET /api/gstr1/status</code></p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle: <span className="accent-text">"I've prepared your GSTR-1 draft."</span> / <span className="accent-text">"I've generated the filing JSON."</span></p>
        </CardContent>
      </Card>
      {draft ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">B2B</div><div className="text-xl font-bold text-foreground">{draft.b2bInvoices}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">B2C</div><div className="text-xl font-bold text-foreground">{draft.b2cInvoices}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Exports</div><div className="text-xl font-bold text-foreground">{draft.exportInvoices}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit Notes</div><div className="text-xl font-bold text-foreground">{draft.creditNotes}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Debit Notes</div><div className="text-xl font-bold text-foreground">{draft.debitNotes}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Amendments</div><div className="text-xl font-bold text-foreground">{draft.amendments}</div></CardContent></Card>
          </div>
          <Card className="border-white/[0.06] accent-gradient-soft backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div><div className="text-muted-foreground">Total Taxable Value</div><div className="text-lg font-bold accent-text">{formatINR(draft.totalTaxableValue)}</div></div>
                <div><div className="text-muted-foreground">IGST</div><div className="text-lg font-bold text-foreground">{formatINR(draft.totalIGST)}</div></div>
                <div><div className="text-muted-foreground">CGST + SGST</div><div className="text-lg font-bold text-foreground">{formatINR(draft.totalCGST + draft.totalSGST)}</div></div>
                <div><div className="text-muted-foreground">Cess</div><div className="text-lg font-bold text-foreground">{formatINR(draft.totalCess)}</div></div>
              </div>
              <Separator className="my-3 bg-white/[0.06]" />
              <div className="text-xs text-muted-foreground">Prepared: {new Date(draft.preparedAt).toLocaleString('en-IN')} · JSON payload: {draft.jsonPayload.length} chars</div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Prepare Draft" to generate the GSTR-1 JSON from your sales register.</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — GSTR-3B™
// ═══════════════════════════════════════════════════════════════════════════════

function Gstr3bModule({ gstin, period, draft, busy, filing, onPrepare, onFile }: {
  gstin: string; period: string; draft: GSTR3BDraft | null; busy: boolean; filing: boolean; onPrepare: () => void; onFile: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Receipt} emoji="🧾" title="GSTR-3B™" subtitle="Output Tax · ITC · Interest · Late Fee · Liability Calculation · Return Draft"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onPrepare} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Prepare Draft</Button>
            <Button size="sm" onClick={onFile} disabled={filing || !draft} className="gap-1.5">{filing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} File Return</Button>
          </div>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">APIs: <code className="text-foreground">POST /api/gstr3b/prepare</code> · <code className="text-foreground">POST /api/gstr3b/file</code> · <code className="text-foreground">GET /api/gstr3b/status</code></p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle: <span className="accent-text">"I've prepared your GSTR-3B."</span> / <span className="accent-text">"Your tax liability is ₹1,84,300."</span></p>
        </CardContent>
      </Card>
      {draft ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Output Tax</div><div className="text-2xl font-bold text-foreground">{formatINR(draft.outputTax)}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">ITC Claimed</div><div className="text-2xl font-bold text-emerald-400">{formatINR(draft.itcClaimed)}</div></CardContent></Card>
            <Card className="border-white/[0.06] accent-gradient-soft backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Tax Payable</div><div className="text-2xl font-bold accent-text">{formatINR(draft.netTaxPayable)}</div></CardContent></Card>
          </div>
          {(draft.interest > 0 || draft.lateFee > 0) && (
            <Card className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-400"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-semibold">Late Filing Penalties</span></div>
                <div className="mt-2 flex gap-6 text-xs">
                  <div><span className="text-muted-foreground">Interest @18% p.a.: </span><span className="font-semibold text-foreground">{formatINR(draft.interest)}</span></div>
                  <div><span className="text-muted-foreground">Late Fee (₹50/day): </span><span className="font-semibold text-foreground">{formatINR(draft.lateFee)}</span></div>
                  <div><span className="text-muted-foreground">Total Liability: </span><span className="font-semibold text-foreground">{formatINR(draft.totalLiability)}</span></div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Prepare Draft" to calculate output tax, ITC, and net liability. Pulls from GSTR-1 (output) + GSTR-2B (ITC).</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — ITC Reconciliation Engine™
// ═══════════════════════════════════════════════════════════════════════════════

function ReconcileModule({ gstin, period, result, busy, onReconcile }: {
  gstin: string; period: string; result: ReconcileResult | null; busy: boolean; onReconcile: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Scale} emoji="⚖️" title="ITC Reconciliation Engine™" subtitle="Books → Purchase Register → GSTR-2B → Invoice Matching → Mismatch Detection → Suggestions. KILLER FEATURE."
        action={<Button size="sm" onClick={onReconcile} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />} Run Reconciliation</Button>} />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">API: <code className="text-foreground">POST /api/reconcile</code> · <code className="text-foreground">GET /api/reconcile?gstin={gstin}</code></p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle: <span className="accent-text">"I've detected ₹18,700 ITC mismatch."</span> / <span className="accent-text">"I've identified 7 invoices requiring review."</span></p>
          <p className="mt-1 text-xs text-muted-foreground">Mismatch types: missing_invoice · gstin_mismatch · value_difference · duplicate · itc_blocked · date_difference</p>
        </CardContent>
      </Card>
      {result ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Matched</div><div className="text-xl font-bold text-emerald-400">{result.matched}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mismatched</div><div className="text-xl font-bold text-amber-400">{result.mismatched}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unmatched</div><div className="text-xl font-bold text-red-400">{result.unmatched}</div></CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Match %</div><div className="text-xl font-bold text-foreground">{result.matchedPct}%</div></CardContent></Card>
            <Card className={cn('border-white/[0.06] backdrop-blur-sm', SEVERITY_TONE[result.riskLevel])}><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Level</div><div className="text-xl font-bold">{result.riskLevel.toUpperCase()}</div></CardContent></Card>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card className="border-red-500/20 bg-red-500/[0.04] backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Missing ITC</div><div className="text-2xl font-bold text-red-400">{formatINR(result.missingITC)}</div><div className="text-xs text-muted-foreground">ITC at risk — not reflected in 2B</div></CardContent></Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mismatch Value</div><div className="text-2xl font-bold text-amber-400">{formatINR(result.mismatchValue)}</div><div className="text-xs text-muted-foreground">Value differences in matched invoices</div></CardContent></Card>
          </div>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Mismatches · {result.mismatches.length} found</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {result.mismatches.map((m, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px]', SEVERITY_TONE[m.severity])}>{m.severity}</Badge>
                          <span className="font-semibold text-foreground">{REASON_LABEL[m.reason] ?? m.reason}</span>
                        </div>
                        <span className="font-bold text-foreground">{formatINR(m.amount)}</span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{m.invoiceNo} · {m.supplierGSTIN}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{m.suggestion}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Run Reconciliation" to match your purchase register against GSTR-2B and detect ITC mismatches. Auto-downloads 2B if not present.</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — E-Invoice™
// ═══════════════════════════════════════════════════════════════════════════════

function EinvoiceModule({ gstin, result, busy, onGenerate }: {
  gstin: string; result: EInvoiceResult | null; busy: boolean; onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Zap} emoji="⚡" title="E-Invoice™" subtitle="Generate IRN + QR Code · Cancel IRN · Get IRN Status"
        action={<Button size="sm" onClick={onGenerate} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate IRN</Button>} />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">APIs: <code className="text-foreground">POST /api/einvoice</code> (generate/cancel) · <code className="text-foreground">GET /api/einvoice?irn=XXX</code> (status)</p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle: <span className="accent-text">"I've generated your E-Invoice. IRN pushed to IRP."</span></p>
        </CardContent>
      </Card>
      {result ? (
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient-soft"><Zap className="h-6 w-6 accent-text" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground">IRN Generated</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{result.irn.slice(0, 48)}…</div>
              </div>
              <Badge variant="outline" className={cn(result.status === 'generated' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400')}>{result.status}</Badge>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><div className="text-muted-foreground">Ack No</div><div className="font-mono text-foreground">{result.ackNo}</div></div>
              <div><div className="text-muted-foreground">Ack Date</div><div className="text-foreground">{new Date(result.ackDate).toLocaleString('en-IN')}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground">QR Code (base64)</div><div className="truncate font-mono text-[10px] text-foreground">{result.qrCode.slice(0, 80)}…</div></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Generate IRN" to push an invoice to the Invoice Registration Portal and get an IRN + QR code.</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 8 — E-Way Bill™
// ═══════════════════════════════════════════════════════════════════════════════

function EwaybillModule({ gstin, result, busy, onGenerate }: {
  gstin: string; result: EWayBillResult | null; busy: boolean; onGenerate: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Truck} emoji="🚚" title="E-Way Bill™" subtitle="Generate · Update · Extend · Cancel · Track"
        action={<Button size="sm" onClick={onGenerate} disabled={busy} className="gap-1.5">{busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />} Generate EWB</Button>} />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">APIs: <code className="text-foreground">POST /api/ewaybill</code> (generate/extend/cancel) · <code className="text-foreground">GET /api/ewaybill?ewbNo=XXX</code> (track)</p>
          <p className="mt-1 text-xs text-muted-foreground">Oracle: <span className="accent-text">"I've generated your E-Way Bill. EWB valid till [date]."</span></p>
        </CardContent>
      </Card>
      {result ? (
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient-soft"><Truck className="h-6 w-6 accent-text" /></div>
              <div>
                <div className="text-sm font-bold text-foreground">E-Way Bill Generated</div>
                <div className="font-mono text-[10px] text-muted-foreground">EWB No: {result.ewbNo}</div>
              </div>
              <Badge variant="outline" className={cn('ml-auto', result.status === 'generated' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400')}>{result.status}</Badge>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div><div className="text-muted-foreground">EWB Date</div><div className="text-foreground">{new Date(result.ewbDate).toLocaleString('en-IN')}</div></div>
              <div><div className="text-muted-foreground">Valid Upto</div><div className="text-foreground">{new Date(result.validUpto).toLocaleString('en-IN')}</div></div>
              <div><div className="text-muted-foreground">Consignment ID</div><div className="font-mono text-foreground">{result.consignmentId}</div></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Click "Generate EWB" to create an E-Way Bill for consignment transport.</CardContent></Card>
      )}
    </div>
  );
}
