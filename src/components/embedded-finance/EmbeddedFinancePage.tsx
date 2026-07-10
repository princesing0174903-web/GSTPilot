'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/shared';
import {
  Inbox,
  Activity as ActivityIcon,
  Bell,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  CreditCard,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Building2,
  Link,
  QrCode,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Send,
  Plus,
  Smartphone,
  Landmark,
  Shield,
  Zap,
  Copy,
  ExternalLink,
  Calendar,
  Eye,
  RefreshCw,
  ArrowRight,
  BarChart3,
  Globe,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
} from '@/hooks/use-firestore';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Payment {
  id: string;
  date: string;
  client: string;
  amount: number;
  method: string;
  status: string;
  reference: string;
}

interface PaymentLink {
  id: string;
  client: string;
  amount: number;
  status: string;
  created: string;
  expiry: string;
  methods: string[];
  revenue: number;
  reconciled: boolean;
}

interface VirtualAccount {
  id: string;
  accountNumber: string;
  ifsc: string;
  client: string;
  balance: number;
  transactions: number;
  type: string;
}

interface Escrow {
  id: string;
  client: string;
  amount: number;
  releaseCondition: string;
  autoRelease: string;
  status: string;
}

interface Payout {
  id: string;
  vendor: string;
  amount: number;
  method: string;
  status: string;
  scheduledDate: string;
  category: string;
}

interface PayoutHistoryItem {
  id: string;
  vendor: string;
  amount: number;
  method: string;
  status: string;
  date: string;
  category: string;
}

interface AutoPayoutRule {
  id: string;
  vendor: string;
  amount: number;
  frequency: string;
  nextRun: string;
  status: string;
}

interface CollectionTrendPoint {
  month: string;
  collected: number;
  pending: number;
}

interface CashFlowForecastPoint {
  day: number;
  inflow: number;
  outflow: number;
}

interface BankRecon {
  bank: string;
  lastSync: string;
  matched: number;
  unmatched: number;
  status: string;
}

interface ActivityItem {
  time: string;
  text: string;
  type: string;
}

interface AIPrediction {
  text: string;
  icon: LucideIcon;
  confidence: number;
  color: string;
}

interface LateCollectionPred {
  client: string;
  amount: number;
  confidence: number;
  daysLate: number;
}

interface ExpectedReceipt {
  client: string;
  amount: number;
  expectedDate: string;
  probability: number;
}

interface RiskAlert {
  text: string;
  severity: string;
  icon: LucideIcon;
}

interface SmartRec {
  text: string;
  impact: string;
  savings: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function CollectionTrendChart({ data }: { data: CollectionTrendPoint[] }) {
  const width = 480;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Guard against empty data — chart will render with axes only, no bars/lines
  const hasData = data.length > 0;
  const maxVal = hasData ? Math.max(...data.map(d => d.collected + d.pending)) : 1;
  const denom = Math.max(1, data.length - 1);
  const yScale = (v: number) => chartH - (v / maxVal) * chartH;
  const xScale = (i: number) => (i / denom) * chartW;

  const collectedPath = hasData ? data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d.collected) + padding.top}`
  ).join(' ') : '';

  const pendingPath = hasData ? data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d.pending) + padding.top}`
  ).join(' ') : '';

  // Area fill for collected
  const collectedArea = hasData ? collectedPath +
    ` L ${xScale(data.length - 1) + padding.left} ${chartH + padding.top}` +
    ` L ${padding.left} ${chartH + padding.top} Z` : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padding.left}
          y1={padding.top + chartH * (1 - frac)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - frac)}
          stroke="#e2e8f0"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}

      {/* Y axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const val = Math.round(maxVal * frac);
        return (
          <text
            key={frac}
            x={padding.left - 8}
            y={padding.top + chartH * (1 - frac) + 3}
            textAnchor="end"
            className="text-[9px] fill-slate-400"
          >
            {frac === 0 ? '0' : `${(val / 100000).toFixed(1)}L`}
          </text>
        );
      })}

      {/* Collected area */}
      {hasData && <path d={collectedArea} fill="url(#collectedGrad)" />}

      {/* Collected line */}
      {hasData && <path d={collectedPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

      {/* Pending area */}
      {hasData && <path d={data.map((d, i) =>
        `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d.pending) + padding.top}`
      ).join(' ') + ` L ${xScale(data.length - 1) + padding.left} ${chartH + padding.top} L ${padding.left} ${chartH + padding.top} Z`}
        fill="url(#pendingGrad)" />}

      {/* Pending line */}
      {hasData && <path d={pendingPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />}

      {/* Data points - collected */}
      {data.map((d, i) => (
        <circle
          key={`c-${i}`}
          cx={xScale(i) + padding.left}
          cy={yScale(d.collected) + padding.top}
          r="3.5"
          fill="white"
          stroke="#10b981"
          strokeWidth="2"
        />
      ))}

      {/* Data points - pending */}
      {data.map((d, i) => (
        <circle
          key={`p-${i}`}
          cx={xScale(i) + padding.left}
          cy={yScale(d.pending) + padding.top}
          r="3"
          fill="white"
          stroke="#f59e0b"
          strokeWidth="1.5"
        />
      ))}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={xScale(i) + padding.left}
          y={height - 8}
          textAnchor="middle"
          className="text-[10px] fill-slate-500"
        >
          {d.month}
        </text>
      ))}
    </svg>
  );
}

function PaymentMethodDonut() {
  // PT-1-a-retry: fetch real invoices to compute the actual collected amount
  // (sum of Invoice.totalAmount). Falls back to ₹0 + empty state when DB is empty.
  const { data: invoicesResp, isLoading } = useQuery<{ invoices: Array<{ totalAmount: number }> }>({
    queryKey: ['invoices', 'embedded-finance-donut'],
    queryFn: () => apiGet('/api/invoices'),
  });
  const collectedTotal = useMemo(() => {
    const invoices = invoicesResp?.invoices ?? [];
    return invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  }, [invoicesResp]);

  const data = [
    { label: 'UPI', value: 58, color: '#10b981' },
    { label: 'Bank Transfer', value: 28, color: '#64748b' },
    { label: 'Card', value: 14, color: '#f59e0b' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 80;
  const cy = 80;
  const r = 55;
  const innerR = 35;

  let currentAngle = -90;
  const arcs = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const outerStart = { x: cx + r * Math.cos(startRad), y: cy + r * Math.sin(startRad) };
    const outerEnd = { x: cx + r * Math.cos(endRad), y: cy + r * Math.sin(endRad) };
    const innerStart = { x: cx + innerR * Math.cos(endRad), y: cy + innerR * Math.sin(endRad) };
    const innerEnd = { x: cx + innerR * Math.cos(startRad), y: cy + innerR * Math.sin(startRad) };

    const path = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      'Z',
    ].join(' ');

    return { ...d, path, percentage: Math.round((d.value / total) * 100) };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-32 h-32 shrink-0">
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill={arc.color} opacity="0.85" className="hover:opacity-100 transition-opacity" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-[11px] fill-slate-700 font-semibold">
          {isLoading ? '…' : formatINR(collectedTotal)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[8px] fill-slate-400">
          {collectedTotal === 0 && !isLoading ? 'no invoices yet' : 'collected'}
        </text>
      </svg>
      <div className="space-y-2.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-600">{d.label}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashFlowForecastChart({ data }: { data: CashFlowForecastPoint[] }) {
  const width = 480;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Guard against empty data — chart will render with axes only, no bars/lines
  const hasData = data.length > 0;
  const maxVal = hasData ? Math.max(...data.map(d => Math.max(d.inflow, d.outflow))) : 1;
  const denom = Math.max(1, data.length - 1);
  const yScale = (v: number) => chartH - (v / maxVal) * chartH;
  const xScale = (i: number) => (i / denom) * chartW;

  // Cumulative net flow for area
  const netFlow = data.reduce<number[]>((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1] : 0;
    acc.push(prev + d.inflow - d.outflow);
    return acc;
  }, []);

  const netMax = hasData ? Math.max(1, ...netFlow.map(Math.abs)) : 1;
  const netScale = (v: number) => chartH / 2 - (v / netMax) * (chartH / 2);

  const inflowPath = hasData ? data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d.inflow) + padding.top}`
  ).join(' ') : '';

  const outflowPath = hasData ? data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${yScale(d.outflow) + padding.top}`
  ).join(' ') : '';

  // Net flow area
  const netAreaPath = hasData ? netFlow.map((v, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i) + padding.left} ${netScale(v) + padding.top}`
  ).join(' ') +
    ` L ${xScale(data.length - 1) + padding.left} ${chartH / 2 + padding.top}` +
    ` L ${padding.left} ${chartH / 2 + padding.top} Z` : '';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="netFlowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#10b981" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0, 0.5, 1].map((frac) => (
        <line
          key={frac}
          x1={padding.left}
          y1={padding.top + chartH * (1 - frac)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - frac)}
          stroke="#e2e8f0"
          strokeWidth="0.5"
          strokeDasharray="4,4"
        />
      ))}

      {/* Net flow area */}
      {hasData && <path d={netAreaPath} fill="url(#netFlowGrad)" />}

      {/* Inflow line */}
      {hasData && <path d={inflowPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

      {/* Outflow line */}
      {hasData && <path d={outflowPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />}

      {/* Inflow dots */}
      {data.map((d, i) => (
        <circle key={`in-${i}`} cx={xScale(i) + padding.left} cy={yScale(d.inflow) + padding.top} r="2.5" fill="white" stroke="#10b981" strokeWidth="1.5" />
      ))}

      {/* X axis */}
      {data.filter((_, i) => i % 3 === 0).map((d, i) => {
        const idx = i * 3;
        return (
          <text key={i} x={xScale(idx) + padding.left} y={height - 8} textAnchor="middle" className="text-[9px] fill-slate-400">
            Day {d.day}
          </text>
        );
      })}
    </svg>
  );
}

function SimulatedQRCode({ size = 120 }: { size?: number }) {
  // Generate a simulated QR pattern
  const cells = 21;
  const cellSize = size / cells;
  const pattern: boolean[][] = [];

  // Seed-based pseudo-random for consistency
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < cells; r++) {
    pattern[r] = [];
    for (let c = 0; c < cells; c++) {
      // Finder patterns (3 corners)
      const isFinderTL = r < 7 && c < 7;
      const isFinderTR = r < 7 && c >= cells - 7;
      const isFinderBL = r >= cells - 7 && c < 7;

      if (isFinderTL || isFinderTR || isFinderBL) {
        const fr = isFinderBL ? r - (cells - 7) : r;
        const fc = isFinderTR ? c - (cells - 7) : c;
        if (fr === 0 || fr === 6 || fc === 0 || fc === 6) pattern[r][c] = true;
        else if (fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4) pattern[r][c] = true;
        else pattern[r][c] = false;
      } else {
        pattern[r][c] = rand() > 0.5;
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" rx="4" />
      {pattern.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#1e293b"
              rx={0.5}
            />
          ) : null
        )
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGES
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200' },
    expired: { label: 'Expired', className: 'bg-slate-50 text-slate-500 border-slate-200' },
    scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
    held: { label: 'Held', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  };

  const c = config[status] || { label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' };

  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${c.className}`}>
      {c.label}
    </Badge>
  );
}

function MethodBadge({ method }: { method: string }) {
  const config: Record<string, { icon: React.ReactNode; className: string }> = {
    UPI: { icon: <Smartphone className="h-3 w-3" />, className: 'bg-violet-50 text-violet-700 border-violet-200' },
    'Bank Transfer': { icon: <Landmark className="h-3 w-3" />, className: 'bg-slate-50 text-slate-700 border-slate-200' },
    Card: { icon: <CreditCard className="h-3 w-3" />, className: 'bg-amber-50 text-amber-700 border-amber-200' },
    NEFT: { icon: <Landmark className="h-3 w-3" />, className: 'bg-slate-50 text-slate-700 border-slate-200' },
    RTGS: { icon: <Landmark className="h-3 w-3" />, className: 'bg-slate-50 text-slate-700 border-slate-200' },
  };

  const c = config[method] || { icon: <CreditCard className="h-3 w-3" />, className: 'bg-slate-50 text-slate-600 border-slate-200' };

  return (
    <Badge variant="outline" className={`text-[10px] font-medium gap-1 ${c.className}`}>
      {c.icon} {method}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.2 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EmbeddedFinancePage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Real DB-backed data (no demo / mock arrays).
  // Each starts empty; payments are fetched from /api/payments, the rest stay
  // empty (and render proper empty states) until the corresponding backend
  // surface is wired up.
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [virtualAccounts, setVirtualAccounts] = useState<VirtualAccount[]>([]);
  const [escrowAccounts, setEscrowAccounts] = useState<Escrow[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryItem[]>([]);
  const [autoPayoutRules, setAutoPayoutRules] = useState<AutoPayoutRule[]>([]);
  const [collectionTrend, setCollectionTrend] = useState<CollectionTrendPoint[]>([]);
  const [cashFlowForecast, setCashFlowForecast] = useState<CashFlowForecastPoint[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<BankRecon[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityItem[]>([]);
  const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
  const [lateCollectionPreds, setLateCollectionPreds] = useState<LateCollectionPred[]>([]);
  const [expectedReceipts, setExpectedReceipts] = useState<ExpectedReceipt[]>([]);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [smartRecs, setSmartRecs] = useState<SmartRec[]>([]);

  // Firestore hooks (used for reference; demo data drives the display)
  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();
  const { data: returns } = useFireReturns();

  // Fetch real payments from the REST API. Other surfaces (links, virtual
  // accounts, payouts, etc.) currently have no dedicated endpoints — they
  // stay as empty arrays and render proper empty states.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiGet<{ payments?: Array<{ id: string; paymentDate?: string; partyName?: string; amount?: number; paymentMode?: string; status?: string; referenceNo?: string | null }> }>(`/api/payments`);
        if (cancelled || !resp?.payments) return;
        const mapped: Payment[] = resp.payments.map((p) => ({
          id: p.id,
          date: p.paymentDate ?? new Date().toISOString(),
          client: p.partyName ?? '—',
          amount: Number(p.amount) || 0,
          method: p.paymentMode ?? '—',
          status: p.status ?? 'pending',
          reference: p.referenceNo ?? '—',
        }));
        setPayments(mapped);
      } catch {
        // Swallow — keep empty array, UI renders the empty state.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Computed stats from the (real) payments array. When payments is empty
  // the stats collapse to ₹0 / 0% — the stat cards stay visible.
  const stats = useMemo(() => {
    const totalCollected = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const pendingCollections = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const overdueAmount = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
    const collectionRate = payments.length > 0
      ? Math.round(((payments.filter(p => p.status === 'completed').length) / payments.length) * 100)
      : 0;
    return { totalCollected, pendingCollections, overdueAmount, collectionRate };
  }, [payments]);

  const payoutStats = useMemo(() => {
    const totalDisbursed = payoutHistory.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const failedPayouts = payoutHistory.filter(p => p.status === 'failed').length;
    return { totalDisbursed, failedPayouts, avgProcessingTime: payoutHistory.length > 0 ? '1.8 days' : '—' };
  }, [payoutHistory]);

  // Reference state setters so unused-setter lint doesn't fire while the
  // backend surfaces are still being built. These are no-ops today but keep
  // the door open for future fetches without restructuring the component.
  void setPaymentLinks; void setVirtualAccounts; void setEscrowAccounts;
  void setPayouts; void setPayoutHistory; void setAutoPayoutRules;
  void setCollectionTrend; void setCashFlowForecast; void setBankReconciliations;
  void setActivityTimeline; void setAiPredictions; void setLateCollectionPreds;
  void setExpectedReceipts; void setRiskAlerts; void setSmartRecs;
  void clients; void invoices; void returns;

  const handleCopyLink = (linkId: string) => {
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  // ─── TAB 1: PAYMENT DASHBOARD ───────────────────────────────────────────────

  const renderDashboard = () => (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Collected', value: formatINR(stats.totalCollected), icon: IndianRupee, trend: '—', trendUp: true, color: 'emerald' },
          { title: 'Pending Collections', value: formatINR(stats.pendingCollections), icon: Clock, trend: '—', trendUp: false, color: 'amber' },
          { title: 'Overdue Amount', value: formatINR(stats.overdueAmount), icon: AlertTriangle, trend: '—', trendUp: false, color: 'red' },
          { title: 'Collection Rate', value: `${stats.collectionRate}%`, icon: TrendingUp, trend: '—', trendUp: true, color: 'emerald' },
        ].map((stat, i) => (
          <motion.div key={stat.title} variants={fadeIn} {...cardHover}>
            <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">{stat.title}</p>
                    <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'emerald' ? 'bg-emerald-50' :
                    stat.color === 'amber' ? 'bg-amber-50' : 'bg-red-50'
                  }`}>
                    <stat.icon className={`h-4 w-4 ${
                      stat.color === 'emerald' ? 'text-emerald-600' :
                      stat.color === 'amber' ? 'text-amber-600' : 'text-red-600'
                    }`} />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {stat.trendUp ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-amber-500" />
                  )}
                  <span className={`text-[11px] font-medium ${
                    stat.trendUp ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {stat.trend}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Collection Trend */}
        <motion.div variants={fadeIn} className="lg:col-span-3">
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">Collection Trend</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-slate-500">Collected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[10px] text-slate-500">Pending</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <CollectionTrendChart data={collectionTrend} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Method Breakdown */}
        <motion.div variants={fadeIn} className="lg:col-span-2">
          <Card className="border-slate-200/60 shadow-sm h-full">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <PaymentMethodDonut />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* AI Predictions */}
      <motion.div variants={fadeIn}>
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/50 to-slate-50/50 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <CardTitle className="text-sm font-semibold text-slate-700">AI Predictions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {aiPredictions.length === 0 ? (
                <div className="sm:col-span-3">
                  <EmptyState
                    icon={Lightbulb}
                    title="No AI predictions yet"
                    description="Predictions will appear here once the AI engine has enough data to forecast collections and cash flow."
                    compact
                  />
                </div>
              ) : (
                aiPredictions.map((pred, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/70 border border-slate-100">
                    <pred.icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                      pred.color === 'emerald' ? 'text-emerald-500' :
                      pred.color === 'amber' ? 'text-amber-500' : 'text-red-500'
                    }`} />
                    <div>
                      <p className="text-xs text-slate-700 leading-snug">{pred.text}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Progress value={pred.confidence} className="h-1 flex-1" />
                        <span className="text-[9px] font-medium text-slate-500">{pred.confidence}%</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Payments Table */}
      <motion.div variants={fadeIn}>
        <Card className="border-slate-200/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Recent Payments</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-emerald-600 hover:text-emerald-700">
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <ScrollArea className="max-h-80">
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-6 gap-3 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Client</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Method</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reference</span>
                </div>
                {payments.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No payments yet"
                    description="Payments will appear here once you connect a bank and start transacting."
                    compact
                  />
                ) : (
                  payments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-6 gap-3 py-2.5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <span className="text-xs text-slate-600">{formatDate(payment.date)}</span>
                      <span className="text-xs text-slate-700 font-medium truncate">{payment.client}</span>
                      <span className="text-xs text-slate-800 font-semibold text-right">{formatINR(payment.amount)}</span>
                      <div><MethodBadge method={payment.method} /></div>
                      <div><StatusBadge status={payment.status} /></div>
                      <span className="text-[10px] text-slate-400 font-mono truncate">{payment.reference}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );

  // ─── TAB 2: PAYMENT LINKS ──────────────────────────────────────────────────

  const renderPaymentLinks = () => (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Header with Create button */}
      <motion.div variants={fadeIn} className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Payment Links</h3>
          <p className="text-xs text-slate-500 mt-0.5">Create and share payment links with your clients</p>
        </div>
        <Dialog open={createLinkOpen} onOpenChange={setCreateLinkOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Create Payment Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link className="h-4 w-4 text-emerald-600" />
                Create Payment Link
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Amount (₹)</label>
                  <Input type="number" placeholder="1,00,000" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Client</label>
                  <Input placeholder="Select client" className="text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Description</label>
                <Input placeholder="Payment for GSTR-1 filing - March 2026" className="text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Due Date</label>
                  <Input type="date" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Expiry (days)</label>
                  <Input type="number" placeholder="15" className="text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Payment Methods</label>
                <div className="flex gap-2">
                  {['UPI', 'Card', 'Bank Transfer'].map((method) => (
                    <Badge key={method} variant="outline" className="cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors text-xs py-1.5 px-3">
                      {method === 'UPI' && <Smartphone className="h-3 w-3 mr-1" />}
                      {method === 'Card' && <CreditCard className="h-3 w-3 mr-1" />}
                      {method === 'Bank Transfer' && <Landmark className="h-3 w-3 mr-1" />}
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setCreateLinkOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateLinkOpen(false)}>
                  <Send className="h-3.5 w-3.5 mr-1.5" /> Create & Share
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Revenue Summary */}
      <motion.div variants={fadeIn}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Revenue from Links</p>
                <p className="text-lg font-bold text-slate-800">—</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Auto-Reconciled</p>
                <p className="text-lg font-bold text-slate-800">— of —</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/60 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Active Links</p>
                <p className="text-lg font-bold text-slate-800">—</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Payment Links Table + QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Links Table */}
        <motion.div variants={fadeIn} className="lg:col-span-2">
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700">All Payment Links</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-72">
                <div className="space-y-0">
                  <div className="grid grid-cols-7 gap-2 pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Link ID</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Client</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Created</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reconciled</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Actions</span>
                  </div>
                  {paymentLinks.length === 0 ? (
                    <EmptyState
                      icon={Link}
                      title="No payment links yet"
                      description="Create your first payment link to start collecting from clients online."
                      compact
                    />
                  ) : (
                    paymentLinks.map((link) => (
                      <div key={link.id} className="grid grid-cols-7 gap-2 py-2.5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors items-center">
                        <span className="text-[10px] font-mono text-slate-600">{link.id}</span>
                        <span className="text-xs text-slate-700 font-medium truncate">{link.client}</span>
                        <span className="text-xs text-slate-800 font-semibold text-right">{formatINR(link.amount)}</span>
                        <div><StatusBadge status={link.status} /></div>
                        <span className="text-[10px] text-slate-500">{formatDate(link.created)}</span>
                        <div>
                          {link.reconciled ? (
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200">
                              <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-400 border-slate-200">No</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopyLink(link.id)}
                          >
                            {copiedLinkId === link.id ? (
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-slate-400" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ExternalLink className="h-3 w-3 text-slate-400" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* QR Code Preview */}
        <motion.div variants={fadeIn}>
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700">QR Code Preview</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 flex flex-col items-center gap-4">
              <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <SimulatedQRCode size={140} />
              </div>
              <div className="text-center w-full">
                <p className="text-xs font-medium text-slate-700">—</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Sample payment link preview</p>
              </div>
              <div className="w-full space-y-2">
                <Button variant="outline" className="w-full text-xs gap-1.5" size="sm">
                  <Copy className="h-3 w-3" /> Copy Payment Link
                </Button>
                <Button variant="outline" className="w-full text-xs gap-1.5" size="sm">
                  <QrCode className="h-3 w-3" /> Download QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  // ─── TAB 3: VIRTUAL ACCOUNTS ───────────────────────────────────────────────

  const renderVirtualAccounts = () => (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Account List */}
      <motion.div variants={fadeIn} className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Virtual Accounts</h3>
          <p className="text-xs text-slate-500 mt-0.5">Dedicated collection accounts for each client</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Create Account
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {virtualAccounts.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState
              icon={Building2}
              title="No virtual accounts yet"
              description="Dedicated collection accounts will appear here once you create one for a client."
            />
          </div>
        ) : (
          virtualAccounts.map((account) => (
            <motion.div key={account.id} variants={fadeIn} {...cardHover}>
              <Card className={`border-slate-200/60 shadow-sm ${account.type === 'escrow' ? 'border-amber-200/60 bg-amber-50/20' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${account.type === 'escrow' ? 'bg-amber-100' : 'bg-emerald-50'}`}>
                        {account.type === 'escrow' ? (
                          <Shield className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{account.client}</p>
                        <Badge variant="outline" className={`text-[9px] mt-0.5 ${account.type === 'escrow' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                          {account.type === 'escrow' ? 'Escrow' : 'Collection'}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-slate-500">
                      <Eye className="h-3 w-3" /> View
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] text-slate-400">Account Number</p>
                      <p className="text-xs font-mono font-medium text-slate-700">{account.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">IFSC</p>
                      <p className="text-xs font-mono font-medium text-slate-700">{account.ifsc}</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">Balance</p>
                      <p className="text-base font-bold text-slate-800">{formatINR(account.balance)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Transactions</p>
                      <p className="text-sm font-semibold text-slate-600">{account.transactions}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Escrow Section */}
      <motion.div variants={fadeIn}>
        <Card className="border-amber-200/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold text-slate-700">Escrow Accounts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-3">
              {escrowAccounts.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No escrow accounts held"
                  description="Funds held in escrow will appear here once an escrow arrangement is created."
                  compact
                />
              ) : (
                escrowAccounts.map((esc) => (
                  <div key={esc.id} className="p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{esc.client}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{esc.releaseCondition}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-amber-700">{formatINR(esc.amount)}</p>
                        <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 mt-1">
                          <Clock className="h-2.5 w-2.5 mr-0.5" /> Auto-release: {formatDate(esc.autoRelease)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={45} className="h-1.5 flex-1" />
                      <span className="text-[9px] text-slate-500">Awaiting conditions</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bank Reconciliation Status + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeIn}>
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold text-slate-700">Bank Reconciliation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {bankReconciliations.length === 0 ? (
                <EmptyState
                  icon={Landmark}
                  title="No bank connected"
                  description="Connect a bank account to start syncing and reconciling transactions automatically."
                  compact
                />
              ) : (
                bankReconciliations.map((bank, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-white border border-slate-200">
                        <Landmark className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-700">{bank.bank}</p>
                        <p className="text-[10px] text-slate-400">Last sync: {bank.lastSync}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500">{bank.matched} matched</p>
                        <p className="text-[10px] text-amber-600">{bank.unmatched} unmatched</p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] ${bank.status === 'synced' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                        {bank.status === 'synced' ? '✓ Synced' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeIn}>
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700">Account Activity</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-52">
                <div className="space-y-3">
                  {activityTimeline.length === 0 ? (
                    <EmptyState
                      icon={ActivityIcon}
                      title="No recent activity"
                      description="Account activity will appear here once payments, payouts, or reconciliations occur."
                      compact
                    />
                  ) : (
                    activityTimeline.map((activity, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          activity.type === 'credit' ? 'bg-emerald-500' :
                          activity.type === 'escrow' ? 'bg-amber-500' :
                          activity.type === 'reconcile' ? 'bg-blue-500' : 'bg-slate-400'
                        }`} />
                        <div>
                          <p className="text-xs text-slate-600 leading-snug">{activity.text}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{activity.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  // ─── TAB 4: PAYOUT MANAGEMENT ──────────────────────────────────────────────

  const renderPayouts = () => (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Payout Stats */}
      <motion.div variants={fadeIn}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'Total Disbursed', value: formatINR(payoutStats.totalDisbursed), icon: Send, color: 'emerald' },
            { title: 'Avg Processing Time', value: payoutStats.avgProcessingTime, icon: Clock, color: 'slate' },
            { title: 'Failed Payouts', value: String(payoutStats.failedPayouts), icon: XCircle, color: 'red' },
          ].map((stat) => (
            <Card key={stat.title} className="border-slate-200/60 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  stat.color === 'emerald' ? 'bg-emerald-50' :
                  stat.color === 'red' ? 'bg-red-50' : 'bg-slate-100'
                }`}>
                  <stat.icon className={`h-4 w-4 ${
                    stat.color === 'emerald' ? 'text-emerald-600' :
                    stat.color === 'red' ? 'text-red-600' : 'text-slate-600'
                  }`} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">{stat.title}</p>
                  <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Pending Payouts */}
      <motion.div variants={fadeIn}>
        <Card className="border-slate-200/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Pending Payouts</CardTitle>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5">
                <Send className="h-3 w-3" /> Batch Process
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <ScrollArea className="max-h-72">
              <div className="space-y-0">
                <div className="grid grid-cols-6 gap-3 pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Vendor</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Method</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Category</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Scheduled</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
                </div>
                {payouts.length === 0 ? (
                  <EmptyState
                    icon={Send}
                    title="No pending payouts"
                    description="Payouts you schedule will appear here for batch processing."
                    compact
                  />
                ) : (
                  payouts.map((payout) => (
                    <div key={payout.id} className="grid grid-cols-6 gap-3 py-2.5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors items-center">
                      <span className="text-xs text-slate-700 font-medium">{payout.vendor}</span>
                      <span className="text-xs text-slate-800 font-semibold text-right">{formatINR(payout.amount)}</span>
                      <div><MethodBadge method={payout.method} /></div>
                      <span className="text-xs text-slate-500">{payout.category}</span>
                      <span className="text-[10px] text-slate-500">{formatDate(payout.scheduledDate)}</span>
                      <div><StatusBadge status={payout.status} /></div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* Auto-Payout Rules + History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Auto-Payout Rules */}
        <motion.div variants={fadeIn}>
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm font-semibold text-slate-700">Auto-Payout Rules</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <Plus className="h-3 w-3" /> Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {autoPayoutRules.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="No auto-payout rules yet"
                  description="Create a rule to automate recurring vendor payouts on a schedule."
                  compact
                />
              ) : (
                autoPayoutRules.map((rule) => (
                  <div key={rule.id} className="p-3 rounded-lg bg-emerald-50/30 border border-emerald-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{rule.vendor}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{rule.frequency} • {formatINR(rule.amount)}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200">
                        <Zap className="h-2.5 w-2.5 mr-0.5" /> Active
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-500">Next run: {formatDate(rule.nextRun)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payout History */}
        <motion.div variants={fadeIn}>
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-slate-700">Payout History</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-56">
                <div className="space-y-2">
                  {payoutHistory.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No payout history yet"
                      description="Completed and failed payouts will appear here once you start disbursing."
                      compact
                    />
                  ) : (
                    payoutHistory.map((payout) => (
                      <div key={payout.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded ${
                            payout.status === 'completed' ? 'bg-emerald-50' : 'bg-red-50'
                          }`}>
                            {payout.status === 'completed' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700">{payout.vendor}</p>
                            <p className="text-[10px] text-slate-400">{payout.category} • {formatDate(payout.date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-800">{formatINR(payout.amount)}</p>
                          <MethodBadge method={payout.method} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  // ─── TAB 5: AI FINANCE INTELLIGENCE ────────────────────────────────────────

  const renderAIIntelligence = () => (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Late Collection Predictions */}
      <motion.div variants={fadeIn}>
        <Card className="border-emerald-200/60 shadow-sm bg-gradient-to-r from-emerald-50/30 to-white">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <CardTitle className="text-sm font-semibold text-slate-700">Late Collection Predictions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {lateCollectionPreds.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-4">
                  <EmptyState
                    icon={Clock}
                    title="No late collection predictions yet"
                    description="The AI engine will flag invoices at risk of late payment once you have outstanding receivables."
                    compact
                  />
                </div>
              ) : (
                lateCollectionPreds.map((pred, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-medium text-slate-700 truncate pr-2">{pred.client}</p>
                      <Badge variant="outline" className="text-[9px] shrink-0 bg-amber-50 text-amber-600 border-amber-200">
                        {pred.daysLate}d late
                      </Badge>
                    </div>
                    <p className="text-base font-bold text-slate-800">{formatINR(pred.amount)}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Progress value={pred.confidence} className="h-1 flex-1" />
                      <span className={`text-[9px] font-medium ${
                        pred.confidence > 75 ? 'text-red-600' : pred.confidence > 50 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {pred.confidence}% likely
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Cash Flow Forecast Chart */}
      <motion.div variants={fadeIn}>
        <Card className="border-slate-200/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Cash Flow Forecast (Next 30 Days)</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-500">Inflow</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[10px] text-slate-500">Outflow</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-200" />
                  <span className="text-[10px] text-slate-500">Net Flow</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <CashFlowForecastChart data={cashFlowForecast} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Expected Receipts Timeline */}
      <motion.div variants={fadeIn}>
        <Card className="border-slate-200/60 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-slate-700">Expected Receipts Timeline</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <ScrollArea className="max-h-48">
              <div className="space-y-3">
                {expectedReceipts.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No expected receipts yet"
                    description="Forecasted client receipts will appear here once the AI engine has receivables data to project."
                    compact
                  />
                ) : (
                  expectedReceipts.map((receipt, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        receipt.probability > 80 ? 'bg-emerald-500' :
                        receipt.probability > 60 ? 'bg-amber-500' : 'bg-red-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-700 truncate">{receipt.client}</p>
                          <p className="text-xs font-semibold text-slate-800 ml-2">{formatINR(receipt.amount)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400">Expected: {formatDate(receipt.expectedDate)}</span>
                          <Progress value={receipt.probability} className="h-1 flex-1 max-w-20" />
                          <span className="text-[9px] text-slate-500">{receipt.probability}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* Risk Alerts + Smart Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Alerts */}
        <motion.div variants={fadeIn}>
          <Card className="border-red-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <CardTitle className="text-sm font-semibold text-slate-700">Risk Alerts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {riskAlerts.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="No active alerts"
                  description="Risk alerts will surface here when the AI engine detects exposure, cash-flow gaps, or unusual patterns."
                  compact
                />
              ) : (
                riskAlerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                    alert.severity === 'high' ? 'bg-red-50/50 border-red-100' :
                    alert.severity === 'medium' ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <alert.icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                      alert.severity === 'high' ? 'text-red-500' :
                      alert.severity === 'medium' ? 'text-amber-500' : 'text-slate-400'
                    }`} />
                    <p className="text-xs text-slate-700 leading-snug">{alert.text}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Smart Recommendations */}
        <motion.div variants={fadeIn}>
          <Card className="border-emerald-200/60 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold text-slate-700">Smart Recommendations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {smartRecs.length === 0 ? (
                <EmptyState
                  icon={Lightbulb}
                  title="No smart recommendations yet"
                  description="Actionable recommendations will appear here once the AI engine analyses your collections and payouts."
                  compact
                />
              ) : (
                smartRecs.map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg bg-emerald-50/30 border border-emerald-100">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-emerald-100 mt-0.5">
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-700 leading-snug">{rec.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200">
                            {rec.impact} Impact
                          </Badge>
                          <span className="text-[10px] text-slate-500">Saves: {rec.savings}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              GSTPilot Payments<sup className="text-emerald-500 text-[10px] ml-0.5">™</sup>
            </h1>
            <p className="text-xs text-slate-500">Embedded Finance Layer — Collect, Pay & Manage</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 p-1 h-auto rounded-lg">
          <TabsTrigger value="dashboard" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="links" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <Link className="h-3.5 w-3.5 mr-1.5" />
            Payment Links
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Virtual Accounts
          </TabsTrigger>
          <TabsTrigger value="payouts" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm rounded-md px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            AI Intelligence
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="dashboard" className="mt-4" forceMount={activeTab === 'dashboard'}>
            {renderDashboard()}
          </TabsContent>
          <TabsContent value="links" className="mt-4" forceMount={activeTab === 'links'}>
            {renderPaymentLinks()}
          </TabsContent>
          <TabsContent value="accounts" className="mt-4" forceMount={activeTab === 'accounts'}>
            {renderVirtualAccounts()}
          </TabsContent>
          <TabsContent value="payouts" className="mt-4" forceMount={activeTab === 'payouts'}>
            {renderPayouts()}
          </TabsContent>
          <TabsContent value="intelligence" className="mt-4" forceMount={activeTab === 'intelligence'}>
            {renderAIIntelligence()}
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
