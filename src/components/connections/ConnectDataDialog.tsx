'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Connect Data Dialog (Real Data Activation · Phase B1)
//
// A polished, full-featured modal that lets the user connect their GSTN and
// Bank accounts to VEYRO. Rendered via `createPortal(..., document.body)` to
// escape every ancestor stacking context (same pattern as OracleWorkspace).
//
// Cross-component integration: any CTA anywhere on the page can open this dialog
// by dispatching `window.dispatchEvent(new CustomEvent('open-connect-dialog',
// { detail: { tab: 'gstn' | 'bank' } }))` — no prop drilling required.
//
// After a successful connect/disconnect, dispatches `connections-updated` so
// Mission Control / Oracle / health widgets can refresh.
//
// Tokens (Obsidian Black):
//   bg #050505 · card #111111 · border rgba(255,255,255,0.08)
//   emerald accent #10b981 · text primary #fff · text secondary rgba(255,255,255,0.7)
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Building2, Landmark, ShieldCheck, Loader2, CheckCircle2, AlertCircle,
  Unplug, FileText, Receipt, Truck, BellRing, Wallet, ArrowDownRight,
  ArrowUpRight, IndianRupee, type LucideIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InfinitySymbol } from '@/components/layout/InfinityMark';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

type BankProvider = 'HDFC' | 'ICICI' | 'SBI' | 'AXIS' | 'KOTAK' | 'YES';

interface BankMeta {
  id: BankProvider;
  label: string;
  full: string;
  color: string;     // accent color for the logo placeholder
  ring: string;      // tailwind ring/border color
}

interface ConnectionSummary {
  id: string;
  type: 'gstn' | 'bank';
  provider: string;
  status: string;
  legalName?: string | null;
  tradeName?: string | null;
  gstin?: string | null;
  maskedRef?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  summary:
    | {
        kind: 'gstn';
        legalName: string;
        tradeName: string;
        gstin: string;
        complianceScore: number;
        pendingReturns: number;
        overdueReturns: number;
        activeNotices: number;
      }
    | {
        kind: 'bank';
        provider: string;
        maskedAccount: string;
        closingBalance: number;
        monthlyCollections: number;
      };
}

interface GstnConnectResult {
  connection: Omit<ConnectionSummary, 'summary'> & { summary: Extract<ConnectionSummary['summary'], { kind: 'gstn' }> };
  dataset: {
    gstin: string;
    legalName: string;
    tradeName: string;
    state: string;
    stateCode: string;
    businessType: string;
    registrationDate: string;
    compliance: {
      score: number;
      pendingReturns: number;
      overdueReturns: number;
      filedReturns: number;
      lastFilingDate?: string;
      nextDueDate?: string;
      itcAvailable: number;
      itcReversed: number;
      activeNotices: number;
      status: 'compliant' | 'at_risk' | 'non_compliant';
    };
    gstrFilingsCount: number;
    eInvoicesCount: number;
    eWayBillsCount: number;
    activeNotices: number;
    recentFilings: Array<{
      returnType: string;
      period: string;
      status: string;
      totalTaxableValue: number;
      totalTax: number;
    }>;
    recentNotices: Array<{
      noticeType: string;
      noticeDate: string;
      subject: string;
      priority: string;
      status: string;
    }>;
  };
}

interface BankConnectResult {
  connection: Omit<ConnectionSummary, 'summary'> & { summary: Extract<ConnectionSummary['summary'], { kind: 'bank' }> };
  dataset: {
    provider: BankProvider;
    maskedAccount: string;
    accountType: string;
    openingBalance: number;
    closingBalance: number;
    totalCredits: number;
    totalDebits: number;
    transactionsCount: number;
    monthlyCollections: Array<{ month: string; collections: number; expenses: number }>;
    recentTransactions: Array<{
      txnDate: string;
      description: string;
      amount: number;
      type: 'credit' | 'debit';
      category: string;
      counterparty?: string;
      balanceAfter: number;
    }>;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const BANKS: BankMeta[] = [
  { id: 'HDFC',  label: 'HDFC',  full: 'HDFC Bank',          color: '#004c8f', ring: 'ring-blue-400/40' },
  { id: 'ICICI', label: 'ICICI', full: 'ICICI Bank',         color: '#f37120', ring: 'ring-orange-400/40' },
  { id: 'SBI',   label: 'SBI',   full: 'State Bank of India', color: '#1e4ea8', ring: 'ring-blue-500/40' },
  { id: 'AXIS',  label: 'Axis',  full: 'Axis Bank',          color: '#97144d', ring: 'ring-pink-500/40' },
  { id: 'KOTAK', label: 'Kotak', full: 'Kotak Mahindra Bank', color: '#ed1c24', ring: 'ring-red-500/40' },
  { id: 'YES',   label: 'Yes',   full: 'Yes Bank',           color: '#00529b', ring: 'ring-blue-600/40' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return (
    sign +
    new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(abs)
  );
}

function formatMonth(m: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, mo] = m.split('-').map(Number);
  if (!y || !mo) return m;
  return `${months[mo - 1]} ${y}`;
}

function complianceBadgeClass(status: 'compliant' | 'at_risk' | 'non_compliant'): string {
  if (status === 'compliant') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (status === 'at_risk')    return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-red-500/15 text-red-300 border-red-500/30';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ConnectDataDialog() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'gstn' | 'bank'>('gstn');

  // GSTN form state
  const [gstin, setGstin] = useState('');
  const [gstnError, setGstnError] = useState<string | null>(null);
  const [gstnLoading, setGstnLoading] = useState(false);
  const [gstnResult, setGstnResult] = useState<GstnConnectResult | null>(null);

  // Bank form state
  const [bankProvider, setBankProvider] = useState<BankProvider | null>(null);
  const [accountRef, setAccountRef] = useState('');
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankResult, setBankResult] = useState<BankConnectResult | null>(null);

  // Connections list
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // ─── Mount + event listener ─────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: 'gstn' | 'bank' }>).detail;
      if (detail?.tab === 'bank') setTab('bank');
      else setTab('gstn');
      setOpen(true);
      // refresh connections whenever the dialog opens
      void loadConnections();
    };
    window.addEventListener('open-connect-dialog', onOpen as EventListener);
    return () => window.removeEventListener('open-connect-dialog', onOpen as EventListener);
  }, []);

  // ─── Escape to close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while dialog is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ─── Load existing connections ──────────────────────────────────────────────
  const loadConnections = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch('/api/connections', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { connections: ConnectionSummary[] };
      setConnections(json.connections ?? []);
    } catch {
      // swallow — non-fatal
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  // ─── Broadcast connections-updated ──────────────────────────────────────────
  const broadcastUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent('connections-updated'));
  }, []);

  // ─── Connect GSTN ───────────────────────────────────────────────────────────
  const handleConnectGstn = useCallback(async () => {
    setGstnError(null);
    const value = gstin.toUpperCase().trim();
    if (!value) {
      setGstnError('Enter your 15-character GSTIN to continue.');
      return;
    }
    if (!GSTIN_REGEX.test(value)) {
      setGstnError('Invalid GSTIN format. Example: 27ABCDE1234F1Z5');
      return;
    }
    setGstnLoading(true);
    setGstnResult(null);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'gstn', gstin: value }),
      });
      const json = (await res.json()) as { ok?: true; error?: string; connection?: unknown; dataset?: unknown };
      if (!res.ok || !json.ok) {
        setGstnError(json.error ?? 'Verification failed. Please try again.');
        return;
      }
      setGstnResult(json as unknown as GstnConnectResult);
      broadcastUpdate();
      void loadConnections();
    } catch {
      setGstnError('Network error. Check your connection and try again.');
    } finally {
      setGstnLoading(false);
    }
  }, [gstin, broadcastUpdate, loadConnections]);

  // ─── Connect Bank ───────────────────────────────────────────────────────────
  const handleConnectBank = useCallback(async () => {
    setBankError(null);
    if (!bankProvider) {
      setBankError('Select your bank first.');
      return;
    }
    const ref = accountRef.replace(/\s+/g, '');
    if (ref.length < 4) {
      setBankError('Enter a valid account number (at least 4 digits).');
      return;
    }
    setBankLoading(true);
    setBankResult(null);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bank', provider: bankProvider, accountRef: ref }),
      });
      const json = (await res.json()) as { ok?: true; error?: string; connection?: unknown; dataset?: unknown };
      if (!res.ok || !json.ok) {
        setBankError(json.error ?? 'Connection failed. Please try again.');
        return;
      }
      setBankResult(json as unknown as BankConnectResult);
      broadcastUpdate();
      void loadConnections();
    } catch {
      setBankError('Network error. Check your connection and try again.');
    } finally {
      setBankLoading(false);
    }
  }, [bankProvider, accountRef, broadcastUpdate, loadConnections]);

  // ─── Disconnect a connection ────────────────────────────────────────────────
  const handleDisconnect = useCallback(
    async (id: string) => {
      setDisconnectingId(id);
      try {
        const res = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
        // Optimistic: remove from list
        setConnections((prev) => prev.filter((c) => c.id !== id));
        // If the user just disconnected the GSTN they're viewing, clear the success panel
        if (gstnResult?.connection.id === id) setGstnResult(null);
        if (bankResult?.connection.id === id) setBankResult(null);
        broadcastUpdate();
        // Refresh from server to stay in sync
        void loadConnections();
      } finally {
        setDisconnectingId(null);
      }
    },
    [gstnResult, bankResult, broadcastUpdate, loadConnections],
  );

  // ─── Reset form when dialog closed ──────────────────────────────────────────
  useEffect(() => {
    if (open) return;
    // Don't wipe results immediately — wait for the close animation to finish.
    const t = window.setTimeout(() => {
      setGstin('');
      setGstnError(null);
      setGstnResult(null);
      setBankProvider(null);
      setAccountRef('');
      setBankError(null);
      setBankResult(null);
    }, 250);
    return () => window.clearTimeout(t);
  }, [open]);

  // ─── Portal guard ───────────────────────────────────────────────────────────
  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'var(--background)' }}
          onClick={(e) => {
            // Click on the backdrop (not the card) closes
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* ─── Card ───────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-dialog-title"
            className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{
              background: 'var(--input)',
              borderColor: 'var(--border)',
              boxShadow: '0 24px 80px -20px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ─── Header ──────────────────────────────────────────────────── */}
            <div
              className="flex shrink-0 items-center gap-3 border-b px-5 py-4 sm:px-6"
              style={{ borderColor: 'var(--border)' }}
            >
              <InfinitySymbol size={22} />
              <div className="min-w-0 flex-1">
                <h2
                  id="connect-dialog-title"
                  className="truncate text-base font-semibold text-white"
                >
                  Connect Real Data
                </h2>
                <p className="truncate text-[11px] text-white/55">
                  Link your GSTN and bank to unlock live compliance, cash flow &amp; Business Health.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close connect dialog"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ─── Scroll body ─────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 custom-scrollbar">
              {/* ─── Existing connections ──────────────────────────────────── */}
              {(connections.length > 0 || loadingConnections) && (
                <section className="mb-5">
                  <SectionLabel icon={ShieldCheck} label="Active Connections" />
                  {loadingConnections ? (
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading connections…
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {connections.map((c) => (
                        <ConnectionCard
                          key={c.id}
                          conn={c}
                          onDisconnect={() => handleDisconnect(c.id)}
                          disconnecting={disconnectingId === c.id}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ─── Tabs ─────────────────────────────────────────────────── */}
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'gstn' | 'bank')} className="gap-4">
                <TabsList
                  className="bg-white/[0.04] h-10 w-full grid grid-cols-2 rounded-xl border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <TabsTrigger
                    value="gstn"
                    className="rounded-lg data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 data-[state=active]:shadow-none text-white/70 text-xs sm:text-sm gap-1.5"
                  >
                    <Building2 className="h-3.5 w-3.5" /> Connect GSTN
                  </TabsTrigger>
                  <TabsTrigger
                    value="bank"
                    className="rounded-lg data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 data-[state=active]:shadow-none text-white/70 text-xs sm:text-sm gap-1.5"
                  >
                    <Landmark className="h-3.5 w-3.5" /> Connect Bank
                  </TabsTrigger>
                </TabsList>

                {/* ─── GSTN tab ───────────────────────────────────────────── */}
                <TabsContent value="gstn" className="outline-none">
                  {gstnResult ? (
                    <GstnSuccessCard result={gstnResult} onReset={() => setGstnResult(null)} />
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/70">
                          GSTIN
                        </label>
                        <Input
                          value={gstin}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                            setGstin(v);
                            if (gstnError) setGstnError(null);
                          }}
                          placeholder="e.g. 27ABCDE1234F1Z5"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={15}
                          className="font-mono tracking-wider h-11 text-sm border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                          style={{ borderColor: 'var(--border)' }}
                          aria-invalid={!!gstnError}
                        />
                        <p className="mt-1.5 text-[11px] text-white/45">
                          Format: 2 digits · 5 letters · 4 digits · 1 letter · 1 alphanumeric · Z · 1 alphanumeric.
                        </p>
                      </div>

                      {gstnError && (
                        <InlineError text={gstnError} />
                      )}

                      <Button
                        onClick={handleConnectGstn}
                        disabled={gstnLoading || gstin.length !== 15}
                        className="h-11 w-full gap-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40"
                      >
                        {gstnLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Verifying GSTIN…
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" /> Verify &amp; Connect
                          </>
                        )}
                      </Button>

                      {gstnLoading && (
                        <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
                          <p className="text-[11px] leading-relaxed text-white/60">
                            Fetching GSTR-1, GSTR-3B, GSTR-2B, e-invoices, e-way bills, notices…
                          </p>
                        </div>
                      )}

                      {/* GSTN info strip */}
                      {!gstnLoading && !gstnResult && (
                        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <InfoStat icon={FileText} label="GSTR-1/3B/2B" value="12 mo" />
                            <InfoStat icon={Receipt} label="e-Invoices" value="IRN" />
                            <InfoStat icon={Truck} label="e-Way Bills" value="Live" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* ─── Bank tab ───────────────────────────────────────────── */}
                <TabsContent value="bank" className="outline-none">
                  {bankResult ? (
                    <BankSuccessCard result={bankResult} onReset={() => setBankResult(null)} />
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/70">
                          Select your bank
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {BANKS.map((b) => {
                            const selected = bankProvider === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  setBankProvider(b.id);
                                  if (bankError) setBankError(null);
                                }}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                                  selected
                                    ? 'border-emerald-500/40 bg-emerald-500/10'
                                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
                                )}
                                style={selected ? { borderColor: 'rgba(16,185,129,0.4)' } : undefined}
                                aria-pressed={selected}
                              >
                                <span
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                                  style={{ background: b.color }}
                                >
                                  {b.label[0]}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-semibold text-white">
                                    {b.full}
                                  </span>
                                  <span className="block text-[10px] text-white/45">
                                    {b.id}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/70">
                          Account number
                        </label>
                        <Input
                          value={accountRef}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 18);
                            setAccountRef(v);
                            if (bankError) setBankError(null);
                          }}
                          inputMode="numeric"
                          placeholder="Enter your account number"
                          autoComplete="off"
                          className="font-mono tracking-wider h-11 text-sm border-white/10 bg-white/[0.03] text-white placeholder:text-white/30"
                          style={{ borderColor: 'var(--border)' }}
                          aria-invalid={!!bankError}
                        />
                        <p className="mt-1.5 text-[11px] text-white/45">
                          Only the last 4 digits are stored (masked). Used to seed 90 days of transactions.
                        </p>
                      </div>

                      {bankError && <InlineError text={bankError} />}

                      <Button
                        onClick={handleConnectBank}
                        disabled={bankLoading || !bankProvider || accountRef.length < 4}
                        className="h-11 w-full gap-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40"
                      >
                        {bankLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {bankProvider
                              ? `Connecting to ${bankProvider}…`
                              : 'Connecting…'}
                          </>
                        ) : (
                          <>
                            <Landmark className="h-4 w-4" /> Connect Bank
                          </>
                        )}
                      </Button>

                      {bankLoading && (
                        <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
                          <p className="text-[11px] leading-relaxed text-white/60">
                            Fetching transactions, balance, collections…
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* ─── Footer ─────────────────────────────────────────────────── */}
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3 sm:px-6"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              <p className="text-[10px] text-white/40">
                Data stays in your account. Disconnect anytime.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 text-xs text-white/70 hover:bg-white/[0.06] hover:text-white"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-emerald-300" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
        {label}
      </span>
    </div>
  );
}

function InlineError({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <p className="text-xs leading-relaxed text-red-200">{text}</p>
    </div>
  );
}

function InfoStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="h-3.5 w-3.5 text-emerald-300" />
      <span className="text-[10px] text-white/45">{label}</span>
      <span className="text-[11px] font-semibold text-white/85">{value}</span>
    </div>
  );
}

// ─── Connection card (existing connection row) ─────────────────────────────────

function ConnectionCard({
  conn,
  onDisconnect,
  disconnecting,
}: {
  conn: ConnectionSummary;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const isGstn = conn.type === 'gstn';
  const summary = conn.summary;
  return (
    <div
      className="group relative rounded-xl border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: isGstn ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)' }}
        >
          {isGstn ? (
            <Building2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <Landmark className="h-4 w-4 text-indigo-300" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">
            {isGstn
              ? summary.kind === 'gstn'
                ? summary.tradeName
                : 'GSTN'
              : summary.kind === 'bank'
                ? summary.provider
                : 'Bank'}
          </p>
          <p className="truncate font-mono text-[10px] text-white/45">
            {isGstn
              ? summary.kind === 'gstn'
                ? summary.gstin
                : conn.maskedRef ?? '—'
              : summary.kind === 'bank'
                ? summary.maskedAccount
                : conn.maskedRef ?? '—'}
          </p>
          {summary.kind === 'gstn' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  'border px-1.5 py-0 text-[9px] font-semibold',
                  complianceBadgeClass(summary.complianceScore >= 80 ? 'compliant' : summary.complianceScore >= 60 ? 'at_risk' : 'non_compliant'),
                )}
              >
                Score {summary.complianceScore}
              </Badge>
              {summary.overdueReturns > 0 && (
                <span className="text-[9px] text-red-300">
                  {summary.overdueReturns} overdue
                </span>
              )}
              {summary.activeNotices > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-amber-300">
                  <BellRing className="h-2.5 w-2.5" /> {summary.activeNotices}
                </span>
              )}
            </div>
          )}
          {summary.kind === 'bank' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold text-emerald-300">
                ₹{formatINR(summary.closingBalance)}
              </Badge>
              <span className="text-[9px] text-white/45">closing balance</span>
            </div>
          )}
        </div>
        <button
          onClick={onDisconnect}
          disabled={disconnecting}
          aria-label="Disconnect"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
        >
          {disconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unplug className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── GSTN success card ─────────────────────────────────────────────────────────

function GstnSuccessCard({
  result,
  onReset,
}: {
  result: GstnConnectResult;
  onReset: () => void;
}) {
  const { dataset } = result;
  const { compliance } = dataset;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 pt-2"
    >
      {/* Hero row */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.05)' }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <Building2 className="h-5 w-5 text-emerald-300" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-white">
                {dataset.legalName}
              </h3>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
              >
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            </div>
            <p className="truncate text-xs text-white/60">
              {dataset.tradeName}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-white/45">
              {dataset.gstin} · {dataset.state} · {dataset.businessType}
            </p>
          </div>
        </div>
      </div>

      {/* Compliance grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          label="Compliance"
          value={`${compliance.score}`}
          suffix="/100"
          tone={compliance.status === 'compliant' ? 'good' : compliance.status === 'at_risk' ? 'warn' : 'bad'}
        />
        <MetricTile
          label="Pending"
          value={`${compliance.pendingReturns}`}
          tone={compliance.pendingReturns > 0 ? 'warn' : 'good'}
        />
        <MetricTile
          label="Overdue"
          value={`${compliance.overdueReturns}`}
          tone={compliance.overdueReturns > 0 ? 'bad' : 'good'}
        />
        <MetricTile
          label="Active Notices"
          value={`${compliance.activeNotices}`}
          tone={compliance.activeNotices > 0 ? 'bad' : 'good'}
        />
      </div>

      {/* ITC + counts */}
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DataCell label="ITC Available" value={`₹${formatINR(compliance.itcAvailable)}`} />
          <DataCell label="GSTR Filings" value={`${dataset.gstrFilingsCount}`} />
          <DataCell label="e-Invoices" value={`${dataset.eInvoicesCount}`} />
          <DataCell label="e-Way Bills" value={`${dataset.eWayBillsCount}`} />
        </div>
      </div>

      {/* Recent filings */}
      {dataset.recentFilings.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Recent filings
          </p>
          <div className="max-h-32 overflow-y-auto rounded-lg border custom-scrollbar" style={{ borderColor: 'var(--border)' }}>
            {dataset.recentFilings.slice(-5).reverse().map((f, i) => (
              <div
                key={`${f.returnType}-${f.period}-${i}`}
                className="flex items-center justify-between border-b px-3 py-2 text-xs last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="font-medium text-white/85">{f.returnType}</span>
                <span className="text-white/45">{formatMonth(f.period)}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'border px-1.5 py-0 text-[9px] font-semibold',
                    f.status === 'filed'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : f.status === 'overdue'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                  )}
                >
                  {f.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-9 flex-1 gap-1.5 border-white/10 bg-transparent text-white/70 hover:bg-white/[0.05] hover:text-white"
        >
          Connect a different GSTIN
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Bank success card ────────────────────────────────────────────────────────

function BankSuccessCard({
  result,
  onReset,
}: {
  result: BankConnectResult;
  onReset: () => void;
}) {
  const { dataset } = result;
  const lastMonth = dataset.monthlyCollections[dataset.monthlyCollections.length - 1];
  const prevMonth = dataset.monthlyCollections[dataset.monthlyCollections.length - 2];
  const collectionsChange =
    lastMonth && prevMonth && prevMonth.collections > 0
      ? ((lastMonth.collections - prevMonth.collections) / prevMonth.collections) * 100
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 pt-2"
    >
      {/* Hero row */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.05)' }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <Landmark className="h-5 w-5 text-emerald-300" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-white">
                {dataset.provider} Bank
              </h3>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
              >
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            </div>
            <p className="font-mono text-[10px] text-white/45">
              {dataset.maskedAccount} · {dataset.accountType} account
            </p>
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-white">
              <IndianRupee className="h-3.5 w-3.5 text-emerald-300" />
              {formatINR(dataset.closingBalance)}
              <span className="ml-1 text-[10px] font-normal text-white/45">closing balance</span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          label="Total Credits"
          value={`₹${formatINR(dataset.totalCredits)}`}
          tone="good"
          icon={ArrowUpRight}
        />
        <MetricTile
          label="Total Debits"
          value={`₹${formatINR(dataset.totalDebits)}`}
          tone="bad"
          icon={ArrowDownRight}
        />
        <MetricTile
          label="This Month In"
          value={lastMonth ? `₹${formatINR(lastMonth.collections)}` : '—'}
          tone="good"
        />
        <MetricTile
          label="Transactions"
          value={`${dataset.transactionsCount}`}
          tone="neutral"
        />
      </div>

      {/* Monthly collections trend */}
      {dataset.monthlyCollections.length > 0 && (
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Collections (last 3 months)
            </p>
            {Math.abs(collectionsChange) > 0.1 && (
              <span
                className={cn(
                  'text-[10px] font-semibold',
                  collectionsChange >= 0 ? 'text-emerald-300' : 'text-red-300',
                )}
              >
                {collectionsChange >= 0 ? '▲' : '▼'} {Math.abs(collectionsChange).toFixed(1)}% MoM
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {dataset.monthlyCollections.map((m) => {
              const max = Math.max(...dataset.monthlyCollections.map((x) => x.collections), 1);
              const pct = Math.max(2, Math.round((m.collections / max) * 100));
              return (
                <div key={m.month} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[10px] text-white/45">
                    {formatMonth(m.month)}
                  </span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-white/[0.04]">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-emerald-500/60 to-emerald-400/40"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[10px] font-medium text-white/85">
                    ₹{formatINR(m.collections)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-9 flex-1 gap-1.5 border-white/10 bg-transparent text-white/70 hover:bg-white/[0.05] hover:text-white"
        >
          Connect a different bank
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Metric tile (small KPI card) ──────────────────────────────────────────────

function MetricTile({
  label,
  value,
  suffix,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  icon?: LucideIcon;
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'bad'
          ? 'text-red-300'
          : 'text-white/85';
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/45">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {label}
      </div>
      <p className={cn('mt-1 text-sm font-semibold', toneClass)}>
        {value}
        {suffix && <span className="ml-0.5 text-[10px] font-normal text-white/40">{suffix}</span>}
      </p>
    </div>
  );
}

// ─── Data cell ─────────────────────────────────────────────────────────────────

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
