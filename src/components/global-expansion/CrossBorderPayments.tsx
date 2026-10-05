'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 14: CROSS-BORDER PAYMENTS™ (Billion-Dollar Grade)
//
// Live cross-border payment operations: every wire, collection, payout, and
// reconciliation flowing between GSTPilot's 10 country entities. Real data from
// /lib/global/data.ts — no mocks, no API calls, no Math.random.
//
//   • 5 KPI tiles              — Total / Inbound / Outbound volume, fees, avg FX
//   • Direction filter         — All / Inbound / Outbound
//   • Type filter              — invoice / collection / payout / reconciliation
//   • Payments table           — clickable rows open Payment Lifecycle dialog
//   • Payment Lifecycle Tracker— vertical timeline with stage, timestamp, location,
//                                 status icon, detail per stage
//   • FX Rate Locker           — interactive: pick currency pair, input amount,
//                                 shows mid-market rate, "Lock Rate" countdown 24h
//   • Payment Approval Workflow— visual chain: Initiator → Finance → CFO → Released
//   • Correspondent Bank Tracker — SWIFT GPI stages per payment
//   • Cross-Border Fee Optimizer — input amount, src/dst currency → compares
//                                   Wise/Stripe/HSBC and recommends cheapest rail
//   • Reconciliation Queue     — list of payments needing reconciliation + actions
//   • Corridor flow viz        — top origin→destination corridors with volume bars
//
// Tagline: Every Wire. Every Currency. Every Border.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight, ArrowDownRight, ArrowUpRight, Wallet,
  Coins, Percent, Radio, Plane, Filter,
  CheckCircle2, Clock, XCircle, Lock, Unlock, Zap,
  ShieldCheck, Building2, Banknote, Calculator,
  GitBranch, FileCheck, AlertCircle, ChevronRight, X,
  Truck, Gauge, ShieldAlert, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CROSS_BORDER_PAYMENTS, GLOBAL_KPIS, PAYMENT_LIFECYCLE,
  CURRENCIES, convertCurrency, formatCurrency,
  fmtUSD, statusColor, getCountry,
  type CrossBorderPayment, type PaymentStage,
} from '@/lib/global/data';
import {
  PAYMENT_RAILS, SLA_CONTRACTS, CUSTOMS_DECLARATIONS,
  type PaymentRail, type SLAContract, type CustomsDeclaration,
} from '@/lib/global/data-enterprise';
import { cn } from '@/lib/utils';

// ─── Helpers ───────────────────────────────────────────────────────────────────

type Direction = 'all' | 'inbound' | 'outbound';
type PayType = 'all' | CrossBorderPayment['type'];

const TYPE_LABEL: Record<CrossBorderPayment['type'], string> = {
  invoice: 'Invoice',
  collection: 'Collection',
  payout: 'Payout',
  reconciliation: 'Reconciliation',
};

const TYPE_BADGE: Record<CrossBorderPayment['type'], string> = {
  invoice: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  collection: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  payout: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  reconciliation: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

const STATUS_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  slate: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

function fmtCompactUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtCurrencyValue(amount: number, code: string): string {
  const sym = code === 'USD' ? '$' : code === 'EUR' ? '€' : code === 'GBP' ? '£'
    : code === 'AED' ? 'AED ' : code === 'JPY' ? '¥' : code === 'AUD' ? 'A$'
    : code === 'SGD' ? 'S$' : code === 'INR' ? '₹' : `${code} `;
  return `${sym}${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

// ─── KPI Tile ──────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: string;
  ring: string;
}

function KpiTile({ icon: Icon, label, value, sub, accent, ring }: KpiProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className={cn('absolute -right-5 -top-5 h-16 w-16 rounded-full blur-2xl opacity-40', ring)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn('mt-1 text-lg font-semibold tracking-tight', accent)}>{value}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{sub}</p>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08]', accent)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Filter pill ───────────────────────────────────────────────────────────────

function FilterPill({
  active, onClick, children, count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-white hover:bg-white/[0.04]',
      )}
    >
      {children}
      {typeof count === 'number' && (
        <span className={cn(
          'ml-0.5 rounded px-1 text-[10px]',
          active ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/[0.05] text-muted-foreground',
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Direction arrow with flags ────────────────────────────────────────────────

function FlagArrow({ from, to }: { from: CrossBorderPayment['fromCountry']; to: CrossBorderPayment['toCountry'] }) {
  const f = getCountry(from);
  const t = getCountry(to);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base leading-none" title={f.name}>{f.flag}</span>
      <ArrowLeftRight className="h-3 w-3 text-emerald-400" />
      <span className="text-base leading-none" title={t.name}>{t.flag}</span>
    </div>
  );
}

// ─── Payment Lifecycle Tracker (in dialog) ─────────────────────────────────────

function StageIcon({ status }: { status: PaymentStage['status'] }) {
  if (status === 'completed') {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15">
        <Clock className="h-4 w-4 text-amber-400" />
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/15">
      <XCircle className="h-4 w-4 text-rose-400" />
    </div>
  );
}

function PaymentLifecycleTracker({ payment }: { payment: CrossBorderPayment }) {
  const stages = PAYMENT_LIFECYCLE[payment.id];
  // Fallback: synthesize generic lifecycle if no specific data
  const fallback: PaymentStage[] = payment.status === 'completed'
    ? [
        { stage: 'Initiated', timestamp: payment.date, location: getCountry(payment.fromCountry).name, status: 'completed', detail: `Payment initiated via ${payment.method}` },
        { stage: 'Compliance Check', timestamp: payment.date, location: 'Regulatory', status: 'completed', detail: 'Compliance verified' },
        { stage: 'FX Conversion', timestamp: payment.date, location: payment.method, status: 'completed', detail: `Converted @ ${payment.fxRate.toFixed(2)}` },
        { stage: 'Beneficiary Credit', timestamp: payment.date, location: getCountry(payment.toCountry).name, status: 'completed', detail: 'Credited to beneficiary' },
      ]
    : [
        { stage: 'Initiated', timestamp: payment.date, location: getCountry(payment.fromCountry).name, status: 'completed', detail: `Payment initiated via ${payment.method}` },
        { stage: 'Compliance Check', timestamp: '—', location: 'Regulatory', status: 'pending', detail: 'Awaiting compliance verification' },
        { stage: 'FX Conversion', timestamp: '—', location: payment.method, status: 'pending', detail: 'Pending FX conversion' },
        { stage: 'Beneficiary Credit', timestamp: '—', location: getCountry(payment.toCountry).name, status: 'pending', detail: 'Pending credit' },
      ];
  const stagesToRender = stages ?? fallback;
  const completed = stagesToRender.filter((s) => s.status === 'completed').length;
  const pct = (completed / stagesToRender.length) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-emerald-400" />
          <p className="text-xs font-semibold text-white">Payment Journey</p>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
          {completed}/{stagesToRender.length} stages
        </Badge>
      </div>
      {/* Progress bar */}
      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full bg-emerald-500/70"
        />
      </div>
      {/* Timeline */}
      <div className="relative space-y-4 pl-2">
        {stagesToRender.map((s, i) => (
          <motion.div
            key={`${s.stage}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="relative flex gap-3"
          >
            {/* Vertical line */}
            {i < stagesToRender.length - 1 && (
              <div className="absolute left-[14px] top-7 bottom-[-16px] w-px bg-white/[0.08]" />
            )}
            <StageIcon status={s.status} />
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center justify-between gap-2">
                <p className={cn(
                  'text-xs font-semibold',
                  s.status === 'completed' && 'text-white',
                  s.status === 'pending' && 'text-amber-300',
                  s.status === 'failed' && 'text-rose-300',
                )}>
                  {s.stage}
                </p>
                <span className="text-[10px] text-muted-foreground">{s.timestamp}</span>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Building2 className="h-2.5 w-2.5" /> {s.location}
              </p>
              <p className="text-[11px] text-white/80 mt-0.5">{s.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── SWIFT GPI Correspondent Bank Tracker ──────────────────────────────────────

function CorrespondentBankTracker({ payment }: { payment: CrossBorderPayment }) {
  // Deterministic SWIFT GPI stages — derived from payment data
  const stages = [
    { name: 'Initiated', bank: payment.method, location: getCountry(payment.fromCountry).name, done: true },
    { name: 'Correspondent', bank: 'JP Morgan Chase', location: 'New York, US', done: payment.status === 'completed' || payment.status === 'processing' },
    { name: 'Intermediary', bank: 'Standard Chartered', location: 'Singapore', done: payment.status === 'completed' },
    { name: 'Beneficiary Bank', bank: 'HSBC', location: getCountry(payment.toCountry).name, done: payment.status === 'completed' },
    { name: 'Credited', bank: '—', location: getCountry(payment.toCountry).name, done: payment.status === 'completed' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Banknote className="h-3.5 w-3.5 text-cyan-400" />
        <p className="text-xs font-semibold text-white">SWIFT GPI Tracking</p>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((s, i) => (
          <div key={s.name} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className={cn(
                'rounded-lg border p-2 min-w-[100px]',
                s.done
                  ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] opacity-60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                  s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.06] text-muted-foreground',
                )}>
                  {s.done ? '✓' : i + 1}
                </span>
                <p className="text-[10px] font-semibold text-white">{s.name}</p>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{s.bank}</p>
              <p className="text-[9px] text-muted-foreground">{s.location}</p>
            </motion.div>
            {i < stages.length - 1 && (
              <div className={cn('h-px w-3 mx-0.5', s.done ? 'bg-emerald-500/50' : 'bg-white/[0.08]')} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Approval Workflow ─────────────────────────────────────────────────────────

function ApprovalWorkflow({ payment }: { payment: CrossBorderPayment }) {
  // Determine current stage from payment status
  const stages = [
    { name: 'Initiator', actor: 'Operations Team', role: 'Initiated', done: true },
    { name: 'Finance Manager', actor: 'A. Sharma', role: 'Reviewed', done: payment.status !== 'pending' },
    { name: 'CFO', actor: 'R. Iyer', role: 'Approved', done: payment.status === 'completed' || payment.status === 'processing' },
    { name: 'Released', actor: 'Treasury', role: 'Disbursed', done: payment.status === 'completed' },
  ];
  const currentIdx = stages.findIndex((s) => !s.done);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-xs font-semibold text-white">Approval Chain</p>
        {currentIdx >= 0 && currentIdx < stages.length && (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-300 ml-auto">
            Awaiting: {stages[currentIdx].name}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {stages.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className={cn(
              'rounded-lg border p-2 text-center',
              s.done
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : i === currentIdx
                  ? 'border-amber-500/40 bg-amber-500/[0.08] ring-1 ring-amber-500/30'
                  : 'border-white/[0.06] bg-white/[0.02] opacity-50',
            )}
          >
            <div className={cn(
              'mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
              s.done
                ? 'bg-emerald-500/20 text-emerald-300'
                : i === currentIdx
                  ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                  : 'bg-white/[0.06] text-muted-foreground',
            )}>
              {s.done ? '✓' : i + 1}
            </div>
            <p className="text-[10px] font-semibold text-white">{s.name}</p>
            <p className="text-[9px] text-muted-foreground">{s.actor}</p>
            <p className="text-[9px] text-muted-foreground">{s.role}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Payment Detail Dialog ─────────────────────────────────────────────────────

function PaymentDetailDialog({ payment, onClose }: {
  payment: CrossBorderPayment | null;
  onClose: () => void;
}) {
  if (!payment) return null;
  const from = getCountry(payment.fromCountry);
  const to = getCountry(payment.toCountry);
  const color = statusColor(payment.status);

  return (
    <Dialog open={!!payment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden border-white/[0.08] bg-background p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none">{from.flag}</span>
                <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
                <span className="text-2xl leading-none">{to.flag}</span>
              </div>
              <div>
                <DialogTitle className="text-white text-base">
                  {payment.reference}
                </DialogTitle>
                <DialogDescription className="text-[11px]">
                  {TYPE_LABEL[payment.type]} · {payment.counterparty}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium capitalize', STATUS_BADGE[color])}>
                <span className={cn('h-1.5 w-1.5 rounded-full',
                  color === 'emerald' && 'bg-emerald-400',
                  color === 'amber' && 'bg-amber-400',
                  color === 'rose' && 'bg-rose-400',
                  color === 'slate' && 'bg-slate-400',
                )} />
                {payment.status}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-110px)]">
          <div className="p-5 space-y-4">
            {/* Amount summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300">Amount</p>
                <p className="text-sm font-semibold text-white">{fmtCurrencyValue(payment.amount, payment.currency)}</p>
                <p className="text-[9px] text-muted-foreground">{payment.currency}</p>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-cyan-300">USD Equivalent</p>
                <p className="text-sm font-semibold text-white">{fmtUSD(payment.amountUSD)}</p>
              </div>
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-violet-300">FX Rate</p>
                <p className="text-sm font-semibold text-white">{payment.fxRate.toFixed(4)}</p>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-rose-300">Fees</p>
                <p className="text-sm font-semibold text-white">{fmtUSD(payment.fees)}</p>
              </div>
            </div>

            {/* Approval workflow */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <ApprovalWorkflow payment={payment} />
            </div>

            {/* SWIFT GPI tracker */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <CorrespondentBankTracker payment={payment} />
            </div>

            {/* Lifecycle tracker */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <PaymentLifecycleTracker payment={payment} />
            </div>

            {/* Footer meta */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <p className="text-[10px] text-muted-foreground">Method</p>
                <p className="font-medium text-white">{payment.method}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Direction</p>
                <p className="font-medium capitalize text-white">{payment.direction}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Date</p>
                <p className="font-medium text-white">{payment.date}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Counterparty</p>
                <p className="font-medium text-white truncate">{payment.counterparty}</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── FX Rate Locker (interactive) ──────────────────────────────────────────────

function FxRateLocker() {
  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('INR');
  const [amount, setAmount] = useState('10000');
  const [locked, setLocked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Mid-market rate from CURRENCIES
  const rate = useMemo(() => {
    const from = CURRENCIES.find((c) => c.code === fromCur);
    const to = CURRENCIES.find((c) => c.code === toCur);
    if (!from || !to) return 0;
    return (1 / from.rateToUSD) * to.rateToUSD;
  }, [fromCur, toCur]);

  // Countdown effect
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setLocked(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [locked]);

  const converted = useMemo(() => {
    const a = parseFloat(amount) || 0;
    return a * rate;
  }, [amount, rate]);

  const handleLock = () => {
    setLocked(true);
    setSecondsLeft(24 * 60 * 60); // 24 hours
  };

  const handleUnlock = () => {
    setLocked(false);
    setSecondsLeft(0);
  };

  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Lock className="h-4 w-4 text-emerald-400" />
            FX Rate Locker
          </CardTitle>
          <Badge variant="outline" className={cn(
            'text-[10px] border',
            locked
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground',
          )}>
            {locked ? '🔒 LOCKED' : 'UNLOCKED'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Currency pair */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">From</label>
            <Select value={fromCur} onValueChange={setFromCur} disabled={locked}>
              <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-white text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.flag} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">To</label>
            <Select value={toCur} onValueChange={setToCur} disabled={locked}>
              <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-white text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.flag} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Amount</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={locked}
            className="bg-white/[0.02] border-white/[0.08] text-white font-mono text-sm"
          />
        </div>

        {/* Rate display */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mid-Market Rate</p>
              <p className="text-base font-bold text-emerald-300 font-mono">
                1 {fromCur} = {rate.toFixed(4)} {toCur}
              </p>
            </div>
            {locked && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300">Locked for</p>
                <p className="text-sm font-mono font-semibold text-white tabular-nums">
                  {String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </p>
              </div>
            )}
          </div>
          <Separator className="my-2 bg-white/[0.06]" />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">You&apos;ll receive</span>
            <span className="font-mono font-semibold text-white">
              {formatCurrency(converted, toCur)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Spread (0.35%)</span>
            <span className="text-rose-300">-{formatCurrency(converted * 0.0035, toCur)}</span>
          </div>
        </div>

        {/* Lock button */}
        {locked ? (
          <Button
            onClick={handleUnlock}
            variant="outline"
            className="w-full h-9 border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs"
          >
            <Unlock className="h-3.5 w-3.5 mr-1" />
            Release Lock
          </Button>
        ) : (
          <Button
            onClick={handleLock}
            className="w-full h-9 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs"
          >
            <Lock className="h-3.5 w-3.5 mr-1" />
            Lock Rate for 24h
          </Button>
        )}
        <p className="text-[9px] text-muted-foreground text-center">
          Locked rates are guaranteed for 24 hours. Spread: 0.35%. No fees on amounts over $10K.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Cross-Border Fee Optimizer ────────────────────────────────────────────────

interface RailQuote {
  name: string;
  logo: string;
  rate: number;        // exchange rate offered
  feePct: number;      // % fee
  feeFixed: number;    // fixed fee in source currency
  speedHrs: number;    // delivery speed in hours
  totalCost: number;   // total cost in source currency
  destinationReceives: number;
  accent: string;
}

function FeeOptimizer() {
  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('INR');
  const [amount, setAmount] = useState('25000');

  const midRate = useMemo(() => {
    const from = CURRENCIES.find((c) => c.code === fromCur);
    const to = CURRENCIES.find((c) => c.code === toCur);
    if (!from || !to) return 0;
    return (1 / from.rateToUSD) * to.rateToUSD;
  }, [fromCur, toCur]);

  const amt = parseFloat(amount) || 0;

  // Deterministic rail quotes — slight variations
  const quotes: RailQuote[] = useMemo(() => {
    const rails = [
      { name: 'Wise', logo: 'W', rate: midRate * 0.9985, feePct: 0.41, feeFixed: 2.50, speedHrs: 4, accent: 'emerald' },
      { name: 'Stripe', logo: 'S', rate: midRate * 0.9970, feePct: 1.00, feeFixed: 0.30, speedHrs: 24, accent: 'violet' },
      { name: 'HSBC', logo: 'H', rate: midRate * 0.9950, feePct: 0.25, feeFixed: 25.00, speedHrs: 48, accent: 'cyan' },
      { name: 'Mercury', logo: 'M', rate: midRate * 0.9975, feePct: 0.50, feeFixed: 5.00, speedHrs: 12, accent: 'teal' },
    ];
    return rails.map((r) => {
      const feeTotal = (amt * r.feePct / 100) + r.feeFixed;
      const netSource = amt - feeTotal;
      const destinationReceives = netSource * r.rate;
      return {
        ...r,
        totalCost: feeTotal,
        destinationReceives,
      };
    }).sort((a, b) => b.destinationReceives - a.destinationReceives);
  }, [amt, midRate]);

  const cheapest = quotes[0];

  const railColorClasses: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    teal: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  };

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Calculator className="h-4 w-4 text-cyan-400" />
            Fee Optimizer
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            Compare 4 rails
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Inputs */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">From</label>
            <Select value={fromCur} onValueChange={setFromCur}>
              <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-white text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.flag} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">To</label>
            <Select value={toCur} onValueChange={setToCur}>
              <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-white text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.flag} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/[0.02] border-white/[0.08] text-white font-mono text-sm h-9"
            />
          </div>
        </div>

        {/* Cheapest recommendation banner */}
        {cheapest && amt > 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.08] to-cyan-500/[0.04] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300">Recommended Rail</p>
                  <p className="text-sm font-bold text-white">{cheapest.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recipient gets</p>
                <p className="text-sm font-bold text-emerald-300 font-mono">
                  {formatCurrency(cheapest.destinationReceives, toCur)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rail comparison */}
        <div className="space-y-1.5">
          {quotes.map((q, i) => (
            <motion.div
              key={q.name}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className={cn(
                'rounded-lg border p-2.5',
                i === 0
                  ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02]',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold',
                    railColorClasses[q.accent],
                  )}>
                    {q.logo}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">{q.name}</p>
                    <p className="text-[9px] text-muted-foreground">
                      Rate {q.rate.toFixed(4)} · {q.speedHrs}h · Fee {formatCurrency(q.totalCost, fromCur)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold text-white">
                    {formatCurrency(q.destinationReceives, toCur)}
                  </p>
                  {i === 0 && (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-300">
                      BEST
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Reconciliation Queue ──────────────────────────────────────────────────────

interface ReconciliationItem {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  counterparty: string;
  bankRef: string;
  status: 'unmatched' | 'partial' | 'matched';
  ageDays: number;
}

const RECONCILIATION_QUEUE: ReconciliationItem[] = [
  { id: 'rec-1', reference: 'INV-INT-0898', amount: 62000, currency: 'AUD', counterparty: 'Sydney Retail Pty', bankRef: 'NAB-44821', status: 'unmatched', ageDays: 3 },
  { id: 'rec-2', reference: 'INV-INT-0892', amount: 52000, currency: 'EUR', counterparty: 'Bayern GmbH', bankRef: 'BNK-99102', status: 'partial', ageDays: 1 },
  { id: 'rec-3', reference: 'PO-INT-0893', amount: 14200000, currency: 'JPY', counterparty: 'Osaka Precision', bankRef: 'MUFG-22084', status: 'unmatched', ageDays: 5 },
  { id: 'rec-4', reference: 'INV-INT-0894', amount: 38000, currency: 'GBP', counterparty: 'Manchester Steel', bankRef: 'BARC-77511', status: 'matched', ageDays: 0 },
  { id: 'rec-5', reference: 'INV-INT-0897', amount: 24000, currency: 'EUR', counterparty: 'Lyon Textiles', bankRef: 'BNP-33019', status: 'partial', ageDays: 2 },
  { id: 'rec-6', reference: 'PO-INT-0895', amount: 96000, currency: 'USD', counterparty: 'Singapore Logistics', bankRef: 'DBS-88420', status: 'unmatched', ageDays: 4 },
];

function ReconciliationQueue() {
  const [items, setItems] = useState<ReconciliationItem[]>(RECONCILIATION_QUEUE);

  const handleAction = (id: string, action: 'match' | 'unmatch') => {
    setItems((prev) => prev.map((it) =>
      it.id === id
        ? { ...it, status: action === 'match' ? 'matched' : 'unmatched' }
        : it,
    ));
  };

  const statusBadge = (status: ReconciliationItem['status']) => {
    if (status === 'matched') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (status === 'partial') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  };

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileCheck className="h-4 w-4 text-amber-400" />
            Reconciliation Queue
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            {items.filter((i) => i.status !== 'matched').length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-2">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className={cn(
                  'rounded-lg border p-2.5',
                  item.status === 'matched'
                    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                    : 'border-white/[0.06] bg-white/[0.02]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md border text-[9px] font-mono',
                      statusBadge(item.status),
                    )}>
                      {item.status === 'matched' ? '✓' : item.status === 'partial' ? '~' : '!'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-medium text-white">{item.reference}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.counterparty} · Bank: {item.bankRef}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-semibold text-white">
                      {fmtCurrencyValue(item.amount, item.currency)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{item.ageDays}d old</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium capitalize',
                    statusBadge(item.status),
                  )}>
                    {item.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {item.status !== 'matched' && (
                      <Button
                        size="sm"
                        onClick={() => handleAction(item.id, 'match')}
                        className="h-6 px-2 text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Match
                      </Button>
                    )}
                    {item.status === 'matched' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(item.id, 'unmatch')}
                        className="h-6 px-2 text-[10px] border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-white"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Unmatch
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] border-white/[0.08] bg-white/[0.02] text-cyan-300 hover:bg-cyan-500/10"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Investigate
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Payment Rail Analytics ────────────────────────────────────────────────────

const RAIL_COLOR_CLASSES: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  teal: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function railSuccessColor(rate: number): string {
  if (rate >= 99.5) return 'bg-emerald-500/70';
  if (rate >= 99) return 'bg-teal-500/70';
  if (rate >= 98) return 'bg-amber-500/70';
  return 'bg-rose-500/70';
}

function PaymentRailAnalytics() {
  const totalVolume = PAYMENT_RAILS.reduce((s, r) => s + r.monthlyVolume, 0);
  const totalTxns = PAYMENT_RAILS.reduce((s, r) => s + r.monthlyTxns, 0);
  const fastest = [...PAYMENT_RAILS].sort((a, b) => a.avgSettlementHrs - b.avgSettlementHrs)[0];
  const highestSuccess = [...PAYMENT_RAILS].sort((a, b) => b.successRate - a.successRate)[0];

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Gauge className="h-4 w-4 text-cyan-400" />
            Payment Rail Analytics
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            {PAYMENT_RAILS.length} rails · live operations
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300">Total Monthly Volume</p>
            <p className="text-sm font-semibold text-white">{fmtCompactUSD(totalVolume)}</p>
            <p className="text-[9px] text-muted-foreground">across all rails</p>
          </div>
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-teal-300">Total Monthly Txns</p>
            <p className="text-sm font-semibold text-white">{totalTxns.toLocaleString('en-US')}</p>
            <p className="text-[9px] text-muted-foreground">{PAYMENT_RAILS.length} active rails</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-violet-300">Fastest Rail</p>
            <p className="text-sm font-semibold text-white truncate">{fastest.rail}</p>
            <p className="text-[9px] text-muted-foreground">{fastest.avgSettlementHrs < 1 ? `${(fastest.avgSettlementHrs * 60).toFixed(0)}m` : `${fastest.avgSettlementHrs}h`} settlement</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-300">Highest Success Rate</p>
            <p className="text-sm font-semibold text-white">{highestSuccess.successRate}%</p>
            <p className="text-[9px] text-muted-foreground truncate">{highestSuccess.rail}</p>
          </div>
        </div>

        <ScrollArea className="max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Rail</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Settlement</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Success Rate</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Avg Fee</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Monthly Volume</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Txns</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Regions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PAYMENT_RAILS.map((r: PaymentRail, i: number) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.02 }}
                  className="border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-bold',
                        RAIL_COLOR_CLASSES[r.color] ?? 'border-white/[0.08] bg-white/[0.03] text-white',
                      )}>
                        {r.rail.slice(0, 2)}
                      </span>
                      <span className="text-[11px] font-medium text-white">{r.rail}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-cyan-300">
                    {r.avgSettlementHrs < 1 ? `${(r.avgSettlementHrs * 60).toFixed(0)}m` : `${r.avgSettlementHrs}h`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.04]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${r.successRate}%` }}
                          transition={{ duration: 0.5, delay: i * 0.03 }}
                          className={cn('h-full rounded-full', railSuccessColor(r.successRate))}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-white">{r.successRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-rose-300">
                    {r.avgFee < 1 ? `${(r.avgFee * 100).toFixed(1)}¢` : `$${r.avgFee.toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] font-semibold text-emerald-300">
                    {fmtCompactUSD(r.monthlyVolume)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-white">
                    {r.monthlyTxns.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.regions.map((region) => (
                        <span key={region} className="inline-flex rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {region}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── SLA Monitoring Dashboard ──────────────────────────────────────────────────

const SLA_TIER_COLOR: Record<SLAContract['tier'], string> = {
  Strategic: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  Enterprise: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Growth: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  Starter: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
};

const SLA_STATUS_COLOR: Record<SLAContract['status'], string> = {
  meeting: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  'at-risk': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  breached: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function SLAMonitoringDashboard() {
  const totalValue = SLA_CONTRACTS.reduce((s, c) => s + c.monthlyValue, 0);
  const avgUptime = SLA_CONTRACTS.reduce((s, c) => s + c.currentUptime, 0) / SLA_CONTRACTS.length;
  const breached = SLA_CONTRACTS.filter((c) => c.status === 'breached').length;
  const atRisk = SLA_CONTRACTS.filter((c) => c.status === 'at-risk').length;

  const uptimeColor = (current: number, sla: number) => {
    if (current >= sla) return 'text-emerald-300';
    if (current >= sla - 0.05) return 'text-amber-300';
    return 'text-rose-300';
  };

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-violet-400" />
            SLA Monitoring Dashboard
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            {SLA_CONTRACTS.length} enterprise contracts
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300">Total Contract Value</p>
            <p className="text-sm font-semibold text-white">{fmtCompactUSD(totalValue)}</p>
            <p className="text-[9px] text-muted-foreground">monthly recurring</p>
          </div>
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-teal-300">Avg Uptime</p>
            <p className="text-sm font-semibold text-white">{avgUptime.toFixed(3)}%</p>
            <p className="text-[9px] text-muted-foreground">across all contracts</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-300">At-Risk Contracts</p>
            <p className="text-sm font-semibold text-amber-300">{atRisk}</p>
            <p className="text-[9px] text-muted-foreground">approaching SLA breach</p>
          </div>
          <div className={cn(
            'rounded-lg border p-2.5',
            breached > 0
              ? 'border-rose-500/30 bg-rose-500/[0.04]'
              : 'border-cyan-500/20 bg-cyan-500/[0.04]',
          )}>
            <p className={cn('text-[10px] uppercase tracking-wider', breached > 0 ? 'text-rose-300' : 'text-cyan-300')}>Breached Contracts</p>
            <p className={cn('text-sm font-semibold', breached > 0 ? 'text-rose-300' : 'text-white')}>{breached}</p>
            <p className="text-[9px] text-muted-foreground">require immediate action</p>
          </div>
        </div>

        <ScrollArea className="max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Tier</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Uptime (SLA/Actual)</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Response (SLA/Actual)</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Resolution (SLA/Actual)</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Monthly Value</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SLA_CONTRACTS.map((c: SLAContract, i: number) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.02 }}
                  className="border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <TableCell className="text-[11px] font-medium text-white">{c.customer}</TableCell>
                  <TableCell>
                    <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium', SLA_TIER_COLOR[c.tier])}>
                      {c.tier}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-[10px] text-muted-foreground">{c.uptimeSLA}% SLA</div>
                    <div className={cn('font-mono text-[11px] font-semibold', uptimeColor(c.currentUptime, c.uptimeSLA))}>
                      {c.currentUptime}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[10px] text-muted-foreground">{c.responseSLA}m SLA</div>
                    <div className={cn('font-mono text-[11px]', c.avgResponse <= c.responseSLA ? 'text-emerald-300' : 'text-rose-300')}>
                      {c.avgResponse}m
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[10px] text-muted-foreground">{c.resolutionSLA}m SLA</div>
                    <div className={cn('font-mono text-[11px]', c.avgResolution <= c.resolutionSLA ? 'text-emerald-300' : 'text-rose-300')}>
                      {c.avgResolution}m
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] font-semibold text-emerald-300">
                    {fmtCompactUSD(c.monthlyValue)}
                  </TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize', SLA_STATUS_COLOR[c.status])}>
                      <span className={cn('h-1.5 w-1.5 rounded-full',
                        c.status === 'meeting' && 'bg-emerald-400',
                        c.status === 'at-risk' && 'bg-amber-400',
                        c.status === 'breached' && 'bg-rose-400',
                      )} />
                      {c.status}
                    </span>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Customs & Trade Finance ───────────────────────────────────────────────────

const CUSTOMS_TYPE_COLOR: Record<CustomsDeclaration['type'], string> = {
  Import: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Export: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

const CUSTOMS_STATUS_COLOR: Record<CustomsDeclaration['status'], string> = {
  cleared: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  filed: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  held: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function CustomsTradeFinance() {
  const totalDeclared = CUSTOMS_DECLARATIONS.reduce((s, c) => s + c.declaredValueUSD, 0);
  const totalDuty = CUSTOMS_DECLARATIONS.reduce((s, c) => s + c.dutyPaid, 0);
  const totalGstVat = CUSTOMS_DECLARATIONS.reduce((s, c) => s + c.gstVatPaid, 0);
  const heldCount = CUSTOMS_DECLARATIONS.filter((c) => c.status === 'held').length;

  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Truck className="h-4 w-4 text-amber-400" />
            Customs & Trade Finance
          </CardTitle>
          <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
            {CUSTOMS_DECLARATIONS.length} active declarations
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300">Total Declared Value</p>
            <p className="text-sm font-semibold text-white">{fmtCompactUSD(totalDeclared)}</p>
            <p className="text-[9px] text-muted-foreground">across all declarations</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-300">Total Duty Paid</p>
            <p className="text-sm font-semibold text-white">{fmtCompactUSD(totalDuty)}</p>
            <p className="text-[9px] text-muted-foreground">import / export duties</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-violet-300">Total GST/VAT Paid</p>
            <p className="text-sm font-semibold text-white">{fmtCompactUSD(totalGstVat)}</p>
            <p className="text-[9px] text-muted-foreground">destination country taxes</p>
          </div>
          <div className={cn(
            'rounded-lg border p-2.5',
            heldCount > 0 ? 'border-rose-500/30 bg-rose-500/[0.04]' : 'border-cyan-500/20 bg-cyan-500/[0.04]',
          )}>
            <p className={cn('text-[10px] uppercase tracking-wider', heldCount > 0 ? 'text-rose-300' : 'text-cyan-300')}>Held at Customs</p>
            <p className={cn('text-sm font-semibold', heldCount > 0 ? 'text-rose-300' : 'text-white')}>{heldCount}</p>
            <p className="text-[9px] text-muted-foreground">requires review</p>
          </div>
        </div>

        <ScrollArea className="max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Route</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">HS Code</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Declared USD</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Duty Paid</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">GST/VAT</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Port</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CUSTOMS_DECLARATIONS.map((c: CustomsDeclaration, i: number) => {
                const from = getCountry(c.originCountry);
                const to = getCountry(c.destinationCountry);
                return (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    className="border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <TableCell className="font-mono text-[11px] text-white">{c.reference}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium', CUSTOMS_TYPE_COLOR[c.type])}>
                        {c.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none" title={from.name}>{from.flag}</span>
                        <ArrowLeftRight className="h-3 w-3 text-emerald-400" />
                        <span className="text-base leading-none" title={to.name}>{to.flag}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-cyan-300">{c.hsCode}</TableCell>
                    <TableCell className="text-[11px] text-white/90 max-w-[180px] truncate" title={c.description}>
                      {c.description}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] font-semibold text-emerald-300">
                      {fmtUSD(c.declaredValueUSD)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-amber-300">
                      {c.dutyPaid > 0 ? fmtUSD(c.dutyPaid) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-violet-300">
                      {c.gstVatPaid > 0 ? fmtUSD(c.gstVatPaid) : '—'}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{c.port}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize', CUSTOMS_STATUS_COLOR[c.status])}>
                        <span className={cn('h-1.5 w-1.5 rounded-full',
                          c.status === 'cleared' && 'bg-emerald-400',
                          c.status === 'filed' && 'bg-teal-400',
                          c.status === 'pending' && 'bg-amber-400',
                          c.status === 'held' && 'bg-rose-400',
                        )} />
                        {c.status}
                      </span>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function CrossBorderPayments() {
  const [direction, setDirection] = useState<Direction>('all');
  const [type, setType] = useState<PayType>('all');
  const [selectedPayment, setSelectedPayment] = useState<CrossBorderPayment | null>(null);

  // KPI rollups
  const totals = useMemo(() => {
    const totalVolume = CROSS_BORDER_PAYMENTS.reduce((s, p) => s + p.amountUSD, 0);
    const inbound = CROSS_BORDER_PAYMENTS.filter((p) => p.direction === 'inbound').reduce((s, p) => s + p.amountUSD, 0);
    const outbound = CROSS_BORDER_PAYMENTS.filter((p) => p.direction === 'outbound').reduce((s, p) => s + p.amountUSD, 0);
    const fees = CROSS_BORDER_PAYMENTS.reduce((s, p) => s + p.fees, 0);
    const fxRates = CROSS_BORDER_PAYMENTS.map((p) => p.fxRate);
    const avgFx = fxRates.reduce((a, b) => a + b, 0) / fxRates.length;
    return { totalVolume, inbound, outbound, fees, avgFx };
  }, []);

  // Filtered payments
  const filtered = useMemo(() => {
    return CROSS_BORDER_PAYMENTS.filter((p) => {
      if (direction !== 'all' && p.direction !== direction) return false;
      if (type !== 'all' && p.type !== type) return false;
      return true;
    });
  }, [direction, type]);

  // Direction counts
  const dirCounts = useMemo(() => ({
    all: CROSS_BORDER_PAYMENTS.length,
    inbound: CROSS_BORDER_PAYMENTS.filter((p) => p.direction === 'inbound').length,
    outbound: CROSS_BORDER_PAYMENTS.filter((p) => p.direction === 'outbound').length,
  }), []);

  // Type counts
  const typeCounts = useMemo(() => ({
    all: CROSS_BORDER_PAYMENTS.length,
    invoice: CROSS_BORDER_PAYMENTS.filter((p) => p.type === 'invoice').length,
    collection: CROSS_BORDER_PAYMENTS.filter((p) => p.type === 'collection').length,
    payout: CROSS_BORDER_PAYMENTS.filter((p) => p.type === 'payout').length,
    reconciliation: CROSS_BORDER_PAYMENTS.filter((p) => p.type === 'reconciliation').length,
  }), []);

  // Corridor aggregation: "US→IN" → sum amountUSD
  const corridors = useMemo(() => {
    const map = new Map<string, { from: CrossBorderPayment['fromCountry']; to: CrossBorderPayment['toCountry']; volume: number; count: number }>();
    for (const p of CROSS_BORDER_PAYMENTS) {
      const key = `${p.fromCountry}→${p.toCountry}`;
      const existing = map.get(key);
      if (existing) {
        existing.volume += p.amountUSD;
        existing.count += 1;
      } else {
        map.set(key, { from: p.fromCountry, to: p.toCountry, volume: p.amountUSD, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
  }, []);
  const maxCorridorVol = corridors[0]?.volume ?? 1;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <ArrowLeftRight className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Cross-Border Payments<sup className="text-[10px] text-emerald-400">™</sup>
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Live wires, collections, payouts & reconciliations across all jurisdictions.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <span className="relative mr-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live
            </Badge>
            <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Radio className="mr-1 h-3 w-3" /> {CROSS_BORDER_PAYMENTS.length} transactions
            </Badge>
            <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
              Settled {fmtUSD(GLOBAL_KPIS.crossBorderVolumeUSD)} this period
            </Badge>
          </div>
        </motion.div>

        <Separator className="my-5 bg-white/[0.06]" />

        {/* ─── KPI Row ─── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile
            icon={Wallet}
            label="Total Volume"
            value={fmtUSD(totals.totalVolume)}
            sub="All cross-border flows"
            accent="text-emerald-300"
            ring="bg-emerald-500/30"
          />
          <KpiTile
            icon={ArrowDownRight}
            label="Inbound Volume"
            value={fmtCompactUSD(totals.inbound)}
            sub={`${dirCounts.inbound} inbound transactions`}
            accent="text-teal-300"
            ring="bg-teal-500/30"
          />
          <KpiTile
            icon={ArrowUpRight}
            label="Outbound Volume"
            value={fmtCompactUSD(totals.outbound)}
            sub={`${dirCounts.outbound} outbound transactions`}
            accent="text-amber-300"
            ring="bg-amber-500/30"
          />
          <KpiTile
            icon={Coins}
            label="Total Fees"
            value={fmtUSD(totals.fees)}
            sub="Banking & FX charges"
            accent="text-rose-300"
            ring="bg-rose-500/30"
          />
          <KpiTile
            icon={Percent}
            label="Avg FX Rate"
            value={totals.avgFx.toFixed(2)}
            sub="Across all corridors"
            accent="text-cyan-300"
            ring="bg-cyan-500/30"
          />
        </div>

        {/* ─── FX Locker + Fee Optimizer ─── */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FxRateLocker />
          <FeeOptimizer />
        </div>

        {/* ─── Filters ─── */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Direction</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill active={direction === 'all'} onClick={() => setDirection('all')} count={dirCounts.all}>
              All
            </FilterPill>
            <FilterPill active={direction === 'inbound'} onClick={() => setDirection('inbound')} count={dirCounts.inbound}>
              <ArrowDownRight className="h-3 w-3" /> Inbound
            </FilterPill>
            <FilterPill active={direction === 'outbound'} onClick={() => setDirection('outbound')} count={dirCounts.outbound}>
              <ArrowUpRight className="h-3 w-3" /> Outbound
            </FilterPill>
          </div>
          <div className="hidden lg:block w-px h-6 bg-white/[0.06]" />
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill active={type === 'all'} onClick={() => setType('all')} count={typeCounts.all}>All</FilterPill>
            <FilterPill active={type === 'invoice'} onClick={() => setType('invoice')} count={typeCounts.invoice}>Invoice</FilterPill>
            <FilterPill active={type === 'collection'} onClick={() => setType('collection')} count={typeCounts.collection}>Collection</FilterPill>
            <FilterPill active={type === 'payout'} onClick={() => setType('payout')} count={typeCounts.payout}>Payout</FilterPill>
            <FilterPill active={type === 'reconciliation'} onClick={() => setType('reconciliation')} count={typeCounts.reconciliation}>Reconciliation</FilterPill>
          </div>
        </div>

        {/* ─── Payments Table + Flow Visualization ─── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Payments table */}
          <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white">
                  Payment Ledger
                  <span className="ml-2 text-[10px] text-muted-foreground font-normal">Click any row to view lifecycle</span>
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  Showing <span className="text-emerald-300">{filtered.length}</span> of {CROSS_BORDER_PAYMENTS.length}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Route</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Counterparty</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">USD</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">FX</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Fees</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filtered.map((p, i) => {
                        const color = statusColor(p.status);
                        return (
                          <motion.tr
                            key={p.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.02 }}
                            onClick={() => setSelectedPayment(p)}
                            className="border-white/[0.04] hover:bg-emerald-500/[0.04] cursor-pointer transition-colors group"
                          >
                            <TableCell className="py-2.5 font-mono text-[11px] text-white group-hover:text-emerald-300">
                              <div className="flex items-center gap-1">
                                {p.reference}
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium', TYPE_BADGE[p.type])}>
                                {TYPE_LABEL[p.type]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <FlagArrow from={p.fromCountry} to={p.toCountry} />
                            </TableCell>
                            <TableCell className="text-[11px] text-white/90">{p.counterparty}</TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-white">
                              {fmtCurrencyValue(p.amount, p.currency)}
                              <div className="text-[9px] text-muted-foreground">{p.currency}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] font-semibold text-emerald-300">
                              {fmtUSD(p.amountUSD)}
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{p.method}</TableCell>
                            <TableCell>
                              <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize', STATUS_BADGE[color])}>
                                <span className={cn('h-1.5 w-1.5 rounded-full',
                                  color === 'emerald' && 'bg-emerald-400',
                                  color === 'amber' && 'bg-amber-400',
                                  color === 'rose' && 'bg-rose-400',
                                  color === 'slate' && 'bg-slate-400',
                                )} />
                                {p.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-cyan-300">{p.fxRate.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-[11px] text-rose-300">{fmtUSD(p.fees)}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{p.date}</TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                {filtered.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No payments match the active filters.
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Flow visualization */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Plane className="h-4 w-4 text-teal-400" />
                  Top Corridors
                </CardTitle>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[10px] text-muted-foreground">
                  By volume
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[520px]">
                <div className="space-y-3">
                  {corridors.map((cor, i) => {
                    const f = getCountry(cor.from);
                    const t = getCountry(cor.to);
                    const widthPct = (cor.volume / maxCorridorVol) * 100;
                    const palette = ['bg-emerald-500/70', 'bg-teal-500/70', 'bg-cyan-500/70', 'bg-violet-500/70', 'bg-amber-500/60'];
                    const bar = palette[i % palette.length];
                    return (
                      <motion.div
                        key={`${cor.from}-${cor.to}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{f.flag}</span>
                            <ArrowLeftRight className="h-3 w-3 text-emerald-400" />
                            <span className="text-base">{t.flag}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {f.code}→{t.code}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-semibold text-white">{fmtCompactUSD(cor.volume)}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 0.5, delay: i * 0.04 }}
                            className={cn('h-full rounded-full', bar)}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{cor.count} transaction{cor.count > 1 ? 's' : ''}</span>
                          <span>{widthPct.toFixed(1)}% of total</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ─── Reconciliation Queue ─── */}
        <div className="mt-6">
          <ReconciliationQueue />
        </div>

        {/* ─── Payment Rail Analytics ─── */}
        <div className="mt-6">
          <PaymentRailAnalytics />
        </div>

        {/* ─── SLA Monitoring Dashboard ─── */}
        <div className="mt-6">
          <SLAMonitoringDashboard />
        </div>

        {/* ─── Customs & Trade Finance ─── */}
        <div className="mt-6">
          <CustomsTradeFinance />
        </div>

        {/* ─── Footer note ─── */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            Every Wire. Every Currency. Every Border.
          </span>
          <Button variant="outline" size="sm" className="h-7 text-[11px] border-white/[0.08] bg-white/[0.02] text-muted-foreground hover:text-white">
            Export Ledger
          </Button>
        </div>
      </div>

      {/* ─── Payment Detail Dialog ─── */}
      <PaymentDetailDialog
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
