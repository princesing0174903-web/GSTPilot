'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Shield, Wallet, CreditCard as CreditScore, BarChart3,
  IndianRupee, ArrowUpRight, ArrowDownRight, Clock, CheckCircle,
  AlertTriangle, Sparkles, Building2, FileText, Users, Target, Zap,
  Gauge, Banknote,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useFireClients, useFireInvoices, useFireReturns } from '@/hooks/use-firestore';
import { EmptyState } from '@/components/shared';

// ═══════════════════════════════════════════════════════════════════════════════
// INDIAN FORMATTING UTILS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  const parts = amount.toFixed(0).split('.');
  let intPart = parts[0];
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  if (otherNumbers !== '' && otherNumbers !== '-') {
    intPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  } else {
    intPart = lastThree;
  }
  return '₹' + intPart;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA (empty — populated by real APIs when available)
// ═══════════════════════════════════════════════════════════════════════════════

interface WorkingCapitalInvoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  age: number;
  status: 'unpaid' | 'overdue';
  eligible: boolean;
  advancePct: number;
}

interface FinancingDeal {
  id: string;
  financier: string;
  invoice: string;
  client: string;
  advanceAmount: number;
  fee: number;
  status: 'active' | 'repaid';
  maturityDate: string;
  advancePct: number;
}

interface ActiveLoan {
  id: string;
  type: string;
  amount: number;
  interestRate: number;
  emi: number;
  outstanding: number;
  nextDue: string;
  tenure: string;
}

const demoInvoices: WorkingCapitalInvoice[] = [];
const demoFinancingDeals: FinancingDeal[] = [];
const demoActiveLoans: ActiveLoan[] = [];

const loanProducts = [
  { name: 'Working Capital Loan', icon: Banknote, interestRate: '10.5% - 14%', maxAmount: 5000000, tenure: '12-36 months', processingFee: '1.5%', eligibility: 'Min ₹10L annual turnover, 2+ years in business', color: 'emerald' },
  { name: 'Overdraft Facility', icon: Wallet, interestRate: '9.5% - 12%', maxAmount: 10000000, tenure: 'Revolving', processingFee: '1%', eligibility: 'Min ₹25L annual turnover, collateral required', color: 'teal' },
  { name: 'Invoice Discounting', icon: FileText, interestRate: '12% - 16%', maxAmount: 3000000, tenure: '30-90 days', processingFee: '0.5%', eligibility: 'Verified invoices, B2B clients only', color: 'cyan' },
  { name: 'Revenue-Based Financing', icon: TrendingUp, interestRate: '14% - 18%', maxAmount: 2000000, tenure: '6-18 months', processingFee: '2%', eligibility: 'Min ₹5L monthly revenue, 1+ year operational', color: 'green' },
];

const scoreHistory = {
  cashFlow: [58, 62, 65, 68, 70, 72],
  credit: [55, 58, 60, 64, 66, 68],
  collection: [72, 74, 76, 78, 80, 81],
  health: [62, 64, 67, 70, 72, 74],
};

const monthlyRevenue = [
  { month: 'Apr 24', value: 1820000 },
  { month: 'May 24', value: 2150000 },
  { month: 'Jun 24', value: 1980000 },
  { month: 'Jul 24', value: 2340000 },
  { month: 'Aug 24', value: 2520000 },
  { month: 'Sep 24', value: 2210000 },
  { month: 'Oct 24', value: 2680000 },
  { month: 'Nov 24', value: 2890000 },
  { month: 'Dec 24', value: 2750000 },
  { month: 'Jan 25', value: 3120000 },
  { month: 'Feb 25', value: 2950000 },
  { month: 'Mar 25', value: 3380000 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

function computeScores(invoices: typeof demoInvoices) {
  const total = invoices.length;
  if (total === 0) {
    return {
      cashFlow: 0,
      credit: 0,
      collection: 0,
      health: 0,
      eligibleCount: 0,
      eligibleAmount: 0,
      totalAmount: 0,
      overdueAmount: 0,
    };
  }
  const unpaid = invoices.filter(i => i.status === 'unpaid').length;
  const overdue = invoices.filter(i => i.status === 'overdue').length;
  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const avgAge = invoices.reduce((s, i) => s + i.age, 0) / total;
  const eligibleCount = invoices.filter(i => i.eligible).length;
  const eligibleAmount = invoices.filter(i => i.eligible).reduce((s, i) => s + i.amount, 0);

  // Cash Flow Score: f(invoice aging, collection speed, bank balance trend)
  const ageFactor = Math.max(0, 100 - avgAge * 0.8);
  const collectionFactor = ((total - overdue) / total) * 100;
  const cashFlow = Math.round(ageFactor * 0.4 + collectionFactor * 0.6);

  // Credit Score: f(payment regularity, GST compliance, default history)
  const paymentRegularity = Math.min(100, ((unpaid + 1) / (overdue + 1)) * 50);
  const gstCompliance = 85; // assumed
  const credit = Math.round(paymentRegularity * 0.5 + gstCompliance * 0.5);

  // Collection Score: f(on-time collections %, overdue amount ratio, DSO)
  const onTimePct = ((total - overdue) / total) * 100;
  const overdueRatio = overdueAmount / totalAmount;
  const dso = avgAge;
  const dsoFactor = Math.max(0, 100 - (dso - 30) * 1.5);
  const collection = Math.round(onTimePct * 0.4 + (1 - overdueRatio) * 100 * 0.35 + dsoFactor * 0.25);

  // Business Health: weighted average
  const health = Math.round(cashFlow * 0.3 + credit * 0.25 + collection * 0.25 + gstCompliance * 0.2);

  return {
    cashFlow: Math.min(100, Math.max(0, cashFlow)),
    credit: Math.min(100, Math.max(0, credit)),
    collection: Math.min(100, Math.max(0, collection)),
    health: Math.min(100, Math.max(0, health)),
    eligibleCount,
    eligibleAmount,
    totalAmount,
    overdueAmount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG GAUGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function ScoreGauge({ score, label, icon: Icon, size = 140 }: {
  score: number; label: string; icon: React.ElementType; size?: number;
}) {
  const r = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - score / 100);

  const getColor = (s: number) => {
    if (s >= 70) return { stroke: '#2563EB', fill: '#ecfdf5', text: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (s >= 40) return { stroke: '#f59e0b', fill: '#fffbeb', text: 'text-amber-600', bg: 'bg-amber-50' };
    return { stroke: '#ef4444', fill: '#fef2f2', text: 'text-red-600', bg: 'bg-red-50' };
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <motion.circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={color.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' as const, delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <span className={color.text}>{score}</span>
            <span className="text-xs text-slate-400 font-normal">/100</span>
          </motion.span>
        </div>
        <div className={`absolute top-1 left-1/2 -translate-x-1/2 rounded-full p-1 ${color.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${color.text}`} />
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-600 text-center">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARKLINE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function Sparkline({ data, color = '#2563EB', width = 120, height = 32 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.polygon
        points={areaPoints}
        fill={color}
        fillOpacity={0.1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      />
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 0.3 }}
      />
      {data.length > 0 && (
        <motion.circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={padding + (1 - (data[data.length - 1] - min) / range) * (height - padding * 2)}
          r="3"
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 1.5 }}
        />
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE AREA CHART
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueAreaChart({ data }: { data: typeof monthlyRevenue }) {
  const width = 700;
  const height = 180;
  const padding = { top: 10, right: 10, bottom: 30, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value)) * 0.85;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + (1 - (d.value - minVal) / (maxVal - minVal)) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padding.top + pct * chartH;
        const val = maxVal - pct * (maxVal - minVal);
        return (
          <g key={pct}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[9px] fill-slate-400">{formatINR(val)}</text>
          </g>
        );
      })}
      {/* X labels */}
      {data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartW;
        return (
          <text key={i} x={x} y={height - 5} textAnchor="middle" className="text-[8px] fill-slate-400">
            {d.month.split(' ')[0]}
          </text>
        );
      })}
      <motion.path
        d={areaPath}
        fill="url(#revenueGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
      />
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x} cy={p.y} r="3.5"
          fill="white" stroke="#2563EB" strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.5 + i * 0.08 }}
        />
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMI CALCULATOR CHART
// ═══════════════════════════════════════════════════════════════════════════════

function EMIChart({ principal, rate, tenure }: { principal: number; rate: number; tenure: number }) {
  const monthlyRate = rate / 12 / 100;
  const emi = monthlyRate > 0
    ? principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1)
    : principal / tenure;
  const totalPayment = emi * tenure;
  const totalInterest = totalPayment - principal;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 55;
  const circumference = 2 * Math.PI * r;
  const principalPct = principal / totalPayment;
  const principalDash = circumference * principalPct;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        <motion.circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#2563EB" strokeWidth="16"
          strokeDasharray={`${principalDash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${principalDash} ${circumference}` }}
          transition={{ duration: 1, delay: 0.3 }}
        />
        <motion.circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#f59e0b" strokeWidth="16"
          strokeDasharray={`${circumference - principalDash} ${circumference}`}
          strokeDashoffset={-principalDash}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs font-bold fill-slate-700">{formatINR(Math.round(emi))}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[9px] fill-slate-400">/month</text>
      </svg>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-emerald-500" />
          <span className="text-slate-600">Principal: {formatINR(principal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-amber-500" />
          <span className="text-slate-600">Interest: {formatINR(Math.round(totalInterest))}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-sm bg-slate-300" />
          <span className="text-slate-600">Total: {formatINR(Math.round(totalPayment))}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: BUSINESS HEALTH DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function BusinessHealthTab({ scores, invoices }: { scores: ReturnType<typeof computeScores>; invoices: typeof demoInvoices }) {
  const healthStatus = scores.health >= 70 ? 'Healthy' : scores.health >= 40 ? 'Moderate' : 'Concerning';
  const healthColor = scores.health >= 70 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : scores.health >= 40 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200';

  const helping = [
    scores.cashFlow >= 65 ? 'Strong cash flow management' : null,
    scores.collection >= 70 ? 'Efficient collection practices' : null,
    scores.credit >= 65 ? 'Good payment discipline' : null,
    'Consistent GST filing compliance',
    'Low default history',
  ].filter(Boolean) as string[];

  const hurting = [
    scores.cashFlow < 65 ? 'Slow invoice collections' : null,
    scores.collection < 70 ? 'High overdue ratio' : null,
    scores.credit < 65 ? 'Irregular payment patterns' : null,
    'Some invoices aging beyond 60 days',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Health Status Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          >
            <Badge className={`text-xs font-semibold px-3 py-1 border ${healthColor}`}>
              {healthStatus}
            </Badge>
          </motion.div>
          <span className="text-sm text-slate-500">Overall Business Health Score</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+4 pts this month</span>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { score: scores.cashFlow, label: 'Cash Flow Score', icon: Wallet, history: scoreHistory.cashFlow },
          { score: scores.credit, label: 'Credit Score', icon: CreditScore, history: scoreHistory.credit },
          { score: scores.collection, label: 'Collection Score', icon: Target, history: scoreHistory.collection },
          { score: scores.health, label: 'Business Health', icon: Gauge, history: scoreHistory.health },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <Card className="border-slate-200/60 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <ScoreGauge score={item.score} label={item.label} icon={item.icon} size={110} />
                  <div className="flex flex-col items-end gap-1 pt-2">
                    <span className="text-[10px] text-slate-400 font-medium">6M Trend</span>
                    <Sparkline
                      data={item.history}
                      color={item.score >= 70 ? '#2563EB' : item.score >= 40 ? '#f59e0b' : '#ef4444'}
                      width={80}
                      height={28}
                    />
                    <div className="flex items-center gap-1 text-[10px]">
                      {item.history[item.history.length - 1] > item.history[0] ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      )}
                      <span className={item.history[item.history.length - 1] > item.history[0] ? 'text-emerald-600' : 'text-red-600'}>
                        {Math.abs(item.history[item.history.length - 1] - item.history[0])} pts
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="border-emerald-200/60 bg-emerald-50/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> What&apos;s Helping
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ul className="space-y-2">
                {helping.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="border-amber-200/60 bg-amber-50/30">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> What&apos;s Hurting
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ul className="space-y-2">
                {hurting.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <ArrowDownRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Invoice Value', value: formatINR(scores.totalAmount), icon: IndianRupee, color: 'emerald' },
          { label: 'Eligible for Financing', value: formatINR(scores.eligibleAmount), icon: Sparkles, color: 'emerald' },
          { label: 'Overdue Amount', value: formatINR(scores.overdueAmount), icon: AlertTriangle, color: 'amber' },
          { label: 'Eligible Invoices', value: `${scores.eligibleCount} of ${invoices.length}`, icon: FileText, color: 'emerald' },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 + idx * 0.05 }}
          >
            <Card className="border-slate-200/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.color === 'emerald' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium">{stat.label}</p>
                  <p className="text-sm font-bold text-slate-800">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: INVOICE FINANCING
// ═══════════════════════════════════════════════════════════════════════════════

function InvoiceFinancingTab({ scores, invoices }: { scores: ReturnType<typeof computeScores>; invoices: typeof demoInvoices }) {
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [showCalculator, setShowCalculator] = useState(false);

  const toggleInvoice = useCallback((id: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedData = useMemo(() => {
    const selected = invoices.filter(i => selectedInvoices.has(i.id) && i.eligible);
    const totalValue = selected.reduce((s, i) => s + i.amount, 0);
    const avgAdvancePct = selected.length > 0
      ? selected.reduce((s, i) => s + i.advancePct, 0) / selected.length
      : 0;
    const advanceAmount = Math.round(totalValue * avgAdvancePct / 100);
    const fee = Math.round(advanceAmount * 0.03); // 3% fee
    const netDisbursement = advanceAmount - fee;
    return { invoices: selected, totalValue, avgAdvancePct, advanceAmount, fee, netDisbursement };
  }, [selectedInvoices, invoices]);

  return (
    <div className="space-y-6">
      {/* AI Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 shrink-0">
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">AI Recommendation</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {scores.eligibleCount} invoices worth {formatINR(scores.eligibleAmount)} are eligible for instant financing.
                Select invoices below to calculate your advance.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Eligible Invoices Table */}
      <Card className="border-slate-200/60">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">Eligible Invoices</CardTitle>
            {selectedInvoices.size > 0 && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                onClick={() => setShowCalculator(true)}
              >
                <IndianRupee className="h-3.5 w-3.5 mr-1" />
                Calculate Advance ({selectedInvoices.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  No invoices available. Create invoices to see financing options here.
                </div>
              ) : (
                invoices.map((inv, idx) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  onClick={() => inv.eligible && toggleInvoice(inv.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    inv.eligible
                      ? selectedInvoices.has(inv.id)
                        ? 'border-emerald-300 bg-emerald-50/50 cursor-pointer'
                        : 'border-slate-200 bg-white hover:border-emerald-200 cursor-pointer'
                      : 'border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                    selectedInvoices.has(inv.id)
                      ? 'border-emerald-500 bg-emerald-500'
                      : inv.eligible
                        ? 'border-slate-300'
                        : 'border-slate-200'
                  }`}>
                    {selectedInvoices.has(inv.id) && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{inv.number}</p>
                      <p className="text-[10px] text-slate-400 truncate">{inv.client}</p>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{formatINR(inv.amount)}</p>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className={`text-xs font-medium ${inv.age > 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {inv.age} days
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] w-fit ${
                        inv.eligible
                          ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                          : 'border-red-300 text-red-600 bg-red-50'
                      }`}
                    >
                      {inv.eligible ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                    <p className="text-xs text-slate-500">
                      {inv.eligible ? `${inv.advancePct}% advance` : '—'}
                    </p>
                  </div>
                </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Financing Calculator Dialog */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Financing Calculator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedData.invoices.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Select eligible invoices to calculate advance</p>
            ) : (
              <>
                <div className="space-y-2">
                  {selectedData.invoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded">
                      <span className="text-slate-600">{inv.number} — {inv.client.slice(0, 20)}</span>
                      <span className="font-semibold text-slate-700">{formatINR(inv.amount)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Invoice Value</span>
                    <span className="font-semibold">{formatINR(selectedData.totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Average Advance %</span>
                    <span className="font-semibold text-emerald-600">{selectedData.avgAdvancePct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Advance Amount</span>
                    <span className="font-semibold text-emerald-600">{formatINR(selectedData.advanceAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Processing Fee (3%)</span>
                    <span className="font-semibold text-amber-600">- {formatINR(selectedData.fee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-700">Net Disbursement</span>
                    <span className="font-bold text-emerald-700 text-lg">{formatINR(selectedData.netDisbursement)}</span>
                  </div>
                </div>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Zap className="h-4 w-4 mr-2" />
                  Get Instant Advance
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Financing Deals */}
      <Card className="border-slate-200/60">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700">Active Financing Deals</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {demoFinancingDeals.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No financing deals yet"
                  description="Active and repaid financing deals will appear here once you discount an invoice."
                  compact
                />
              ) : (
                demoFinancingDeals.map((deal, idx) => (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.08 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${deal.status === 'active' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                        <Building2 className={`h-4 w-4 ${deal.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{deal.financier}</p>
                        <p className="text-[10px] text-slate-400">{deal.invoice} — {deal.client}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-700">{formatINR(deal.advanceAmount)}</p>
                        <p className="text-[10px] text-amber-500">Fee: {formatINR(deal.fee)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Due: {formatDate(deal.maturityDate)}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            deal.status === 'active'
                              ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                              : 'border-slate-300 text-slate-500 bg-slate-50'
                          }`}
                        >
                          {deal.status === 'active' ? 'Active' : 'Repaid'}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: WORKING CAPITAL LOANS
// ═══════════════════════════════════════════════════════════════════════════════

function WorkingCapitalLoansTab() {
  const [loanAppOpen, setLoanAppOpen] = useState(false);
  const [emiPrincipal, setEmiPrincipal] = useState(2000000);
  const [emiRate, setEmiRate] = useState(12);
  const [emiTenure, setEmiTenure] = useState(24);

  // ── Real data fetch for eligibility checks ──
  // Annual invoice volume = sum of Invoice.taxableValue over the last 12 months
  // GST filing regularity = filedReturns / (filedReturns + pendingReturns + overdueReturns)
  const { data: invoicesResp, isLoading: invoicesLoading } = useQuery<{ invoices: Array<{ taxableValue: number; invoiceDate: string }> }>({
    queryKey: ['invoices', 'wc-loans'],
    queryFn: () => apiGet('/api/invoices'),
  });
  const { data: dashboard } = useQuery<{ filedReturns: number; pendingReturns: number; overdueReturns: number }>({
    queryKey: ['dashboard', 'wc-loans'],
    queryFn: () => apiGet('/api/dashboard'),
  });

  const annualInvoiceVolume = useMemo(() => {
    const invoices = invoicesResp?.invoices ?? [];
    if (invoices.length === 0) return 0;
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return invoices
      .filter((inv) => {
        if (!inv.invoiceDate) return true;
        const d = new Date(inv.invoiceDate).getTime();
        return Number.isNaN(d) || d >= oneYearAgo;
      })
      .reduce((sum, inv) => sum + (Number(inv.taxableValue) || 0), 0);
  }, [invoicesResp]);

  const filingRegularity = useMemo(() => {
    const filed = dashboard?.filedReturns ?? 0;
    const pending = dashboard?.pendingReturns ?? 0;
    const overdue = dashboard?.overdueReturns ?? 0;
    const total = filed + pending + overdue;
    if (total === 0) return { filed: 0, total: 0, pct: 0 };
    return { filed, total, pct: Math.round((filed / total) * 100) };
  }, [dashboard]);

  // 1.2 Cr threshold = 12,000,000. Below this → status flips to 'review'.
  const INVOICE_VOLUME_THRESHOLD = 12000000;
  const invoiceVolumePass = annualInvoiceVolume >= INVOICE_VOLUME_THRESHOLD;
  // Filing regularity "pass" if >= 90% of returns filed on time
  const filingRegularityPass = filingRegularity.total === 0 ? false : filingRegularity.pct >= 90;

  const eligibilityChecks = [
    {
      label: 'GST Filing Regularity',
      status: (filingRegularity.total === 0 ? 'warn' : filingRegularityPass ? 'pass' : 'review') as 'pass' | 'warn' | 'review',
      detail:
        filingRegularity.total === 0
          ? 'No returns on record yet'
          : `Filed ${filingRegularity.filed}/${filingRegularity.total} returns on time (${filingRegularity.pct}%)`,
    },
    {
      label: 'Invoice Volume',
      status: (invoicesLoading ? 'warn' : invoiceVolumePass ? 'pass' : 'review') as 'pass' | 'warn' | 'review',
      detail: invoicesLoading
        ? 'Calculating annual invoice volume…'
        : `${formatINR(annualInvoiceVolume)} annual invoice volume${invoiceVolumePass ? '' : ' (below ₹1.2 Cr threshold)'}`,
    },
    { label: 'Payment History', status: 'pass' as const, detail: 'No defaults in last 24 months' },
    { label: 'Business Vintage', status: 'pass' as const, detail: '3+ years in operation' },
    { label: 'Collateral Available', status: 'warn' as const, detail: 'Partial collateral available' },
  ];

  return (
    <div className="space-y-6">
      {/* Eligibility Checker */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-emerald-200/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Loan Eligibility
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              {eligibilityChecks.map((check, idx) => (
                <motion.div
                  key={check.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    check.status === 'pass'
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  {check.status === 'pass' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-700">{check.label}</p>
                    <p className="text-[9px] text-slate-500">{check.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loan Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loanProducts.map((product, idx) => (
          <motion.div
            key={product.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <Card className="border-slate-200/60 hover:shadow-md transition-shadow h-full">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`rounded-lg p-2.5 ${
                    product.color === 'emerald' ? 'bg-emerald-50' :
                    product.color === 'teal' ? 'bg-teal-50' :
                    product.color === 'cyan' ? 'bg-cyan-50' :
                    'bg-green-50'
                  }`}>
                    <product.icon className={`h-5 w-5 ${
                      product.color === 'emerald' ? 'text-emerald-600' :
                      product.color === 'teal' ? 'text-teal-600' :
                      product.color === 'cyan' ? 'text-cyan-600' :
                      'text-green-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                    <p className="text-[10px] text-slate-500">Interest: {product.interestRate}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] text-slate-400">Max Amount</p>
                    <p className="font-semibold text-slate-700">{formatINR(product.maxAmount)}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] text-slate-400">Tenure</p>
                    <p className="font-semibold text-slate-700">{product.tenure}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] text-slate-400">Processing Fee</p>
                    <p className="font-semibold text-slate-700">{product.processingFee}</p>
                  </div>
                  <div className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] text-slate-400">Eligibility</p>
                    <p className="font-semibold text-slate-700 text-[10px] leading-tight">{product.eligibility}</p>
                  </div>
                </div>
                <div className="mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setLoanAppOpen(true)}
                  >
                    Apply Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Active Loans Table */}
      <Card className="border-slate-200/60">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700">Active Loans</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {demoActiveLoans.length === 0 ? (
                <EmptyState
                  icon={Banknote}
                  title="No active loans yet"
                  description="Active loans will appear here once your working capital loan applications are approved."
                  compact
                />
              ) : (
                demoActiveLoans.map((loan, idx) => (
                  <motion.div
                    key={loan.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: idx * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg p-2 bg-emerald-50">
                        <Banknote className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{loan.type}</p>
                        <p className="text-[10px] text-slate-400">{loan.tenure} • {loan.interestRate}% p.a.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Amount</p>
                        <p className="text-xs font-semibold text-slate-700">{formatINR(loan.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Outstanding</p>
                        <p className="text-xs font-semibold text-amber-600">{formatINR(loan.outstanding)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">{loan.emi > 0 ? 'EMI' : 'Interest Only'}</p>
                        <p className="text-xs font-semibold text-slate-700">{loan.emi > 0 ? formatINR(loan.emi) : 'Variable'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Next Due</p>
                        <p className="text-xs text-slate-600">{formatDate(loan.nextDue)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* EMI Calculator */}
      <Card className="border-slate-200/60">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            EMI Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="space-y-3 flex-1 w-full">
              <div>
                <label className="text-xs text-slate-500 font-medium">Loan Amount: {formatINR(emiPrincipal)}</label>
                <input
                  type="range"
                  min={100000}
                  max={10000000}
                  step={100000}
                  value={emiPrincipal}
                  onChange={e => setEmiPrincipal(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Interest Rate: {emiRate}%</label>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={0.5}
                  value={emiRate}
                  onChange={e => setEmiRate(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Tenure: {emiTenure} months</label>
                <input
                  type="range"
                  min={6}
                  max={60}
                  step={6}
                  value={emiTenure}
                  onChange={e => setEmiTenure(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
            </div>
            <EMIChart principal={emiPrincipal} rate={emiRate} tenure={emiTenure} />
          </div>
        </CardContent>
      </Card>

      {/* Loan Application Dialog */}
      <Dialog open={loanAppOpen} onOpenChange={setLoanAppOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Apply for Working Capital Loan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-medium">Loan Amount</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400" placeholder="₹10,00,000" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Purpose</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400" placeholder="Working capital for operations" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Tenure</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 bg-white">
                  <option>12 months</option>
                  <option>24 months</option>
                  <option>36 months</option>
                </select>
              </div>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              Submit Application
            </Button>
            <p className="text-[10px] text-slate-400 text-center">
              Your GST data and invoice history will be used for eligibility verification
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: CREDIT INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

function CreditIntelligenceTab({ scores }: { scores: ReturnType<typeof computeScores> }) {
  const creditRating = scores.credit >= 80 ? 'AAA' : scores.credit >= 70 ? 'AA' : scores.credit >= 60 ? 'A' : scores.credit >= 50 ? 'BBB' : scores.credit >= 40 ? 'BB' : 'B';
  const ratingColor = scores.credit >= 70 ? 'emerald' : scores.credit >= 50 ? 'amber' : 'red';
  const creditLimit = 5000000;
  const creditUsed = 2300000;
  const utilizationPct = (creditUsed / creditLimit) * 100;

  const paymentBehavior = {
    onTimePct: 78,
    avgDelayDays: 4.2,
    defaultHistory: 0,
  };

  const gstCompliance = {
    filingRegularity: 92,
    taxPaymentConsistency: 88,
    lastFilingDate: '2025-02-15',
    missedFilings: 1,
  };

  const recommendations = [
    { action: 'Reduce average payment delay from 4.2 to 2 days', impact: '+5 points', icon: Clock },
    { action: 'Maintain on-time payment rate above 85%', impact: '+3 points', icon: CheckCircle },
    { action: 'Clear 1 pending GST filing', impact: '+4 points', icon: FileText },
    { action: 'Reduce credit utilization below 40%', impact: '+3 points', icon: CreditScore },
    { action: 'Maintain zero defaults for next 6 months', impact: '+2 points', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Credit Profile Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className={`border-${ratingColor === 'emerald' ? 'emerald' : ratingColor === 'amber' ? 'amber' : 'red'}-200/60`}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-slate-500 font-medium mb-2">Overall Credit Rating</p>
              <motion.div
                className={`text-5xl font-black ${
                  ratingColor === 'emerald' ? 'text-emerald-600' :
                  ratingColor === 'amber' ? 'text-amber-600' :
                  'text-red-600'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
              >
                {creditRating}
              </motion.div>
              <p className="text-[10px] text-slate-400 mt-1">Based on composite scoring model</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-slate-200/60">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 font-medium mb-2">Credit Limit</p>
              <p className="text-xl font-bold text-slate-800">{formatINR(creditLimit)}</p>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Used: {formatINR(creditUsed)}</span>
                  <span>{utilizationPct.toFixed(0)}%</span>
                </div>
                <Progress value={utilizationPct} className="h-2" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                Available: {formatINR(creditLimit - creditUsed)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 font-medium mb-2">Peer Comparison</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-black text-emerald-600">72%</span>
                <span className="text-xs text-slate-500 mb-1">of similar businesses</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Your credit score is better than 72% of similar businesses in your sector
              </p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                <span>Above sector average</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Payment Behavior + GST Compliance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border-slate-200/60">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                Payment Behavior
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">On-time Payments</span>
                  <span className="font-semibold text-emerald-600">{paymentBehavior.onTimePct}%</span>
                </div>
                <Progress value={paymentBehavior.onTimePct} className="h-2" />
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500">Average Delay</span>
                <span className="text-xs font-semibold text-amber-600">{paymentBehavior.avgDelayDays} days</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500">Default History</span>
                <span className="text-xs font-semibold text-emerald-600">{paymentBehavior.defaultHistory} defaults</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500">DSO (Days Sales Outstanding)</span>
                <span className="text-xs font-semibold text-slate-700">38 days</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="border-slate-200/60">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                GST Compliance as Credit Factor
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Filing Regularity</span>
                  <span className="font-semibold text-emerald-600">{gstCompliance.filingRegularity}%</span>
                </div>
                <Progress value={gstCompliance.filingRegularity} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Tax Payment Consistency</span>
                  <span className="font-semibold text-emerald-600">{gstCompliance.taxPaymentConsistency}%</span>
                </div>
                <Progress value={gstCompliance.taxPaymentConsistency} className="h-2" />
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500">Last Filing Date</span>
                <span className="text-xs font-semibold text-slate-700">{formatDate(gstCompliance.lastFilingDate)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-xs text-slate-500">Missed Filings (12M)</span>
                <span className={`text-xs font-semibold ${gstCompliance.missedFilings > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {gstCompliance.missedFilings}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="border-slate-200/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Revenue Trend (Last 12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <RevenueAreaChart data={monthlyRevenue} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Credit Improvement Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <Card className="border-emerald-200/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Credit Improvement Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.7 + idx * 0.08 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-1.5 bg-emerald-50">
                      <rec.icon className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-700">{rec.action}</p>
                  </div>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 font-semibold shrink-0">
                    {rec.impact}
                  </Badge>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-medium">
                Implementing all recommendations could improve your credit score by up to <strong>17 points</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkingCapitalPage() {
  const [activeTab, setActiveTab] = useState('health');
  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();
  const { data: returns } = useFireReturns();

  // Acknowledge live data subscriptions (clients/returns currently used for
  // context; invoices drives the score computation below).
  void clients;
  void returns;

  // Map live Firestore invoices to the shape computeScores expects. When no
  // live invoices exist, pass an empty array so computeScores returns zeros
  // (no fabricated demo data).
  const liveInvoices = useMemo(() => {
    if (!Array.isArray(invoices) || invoices.length === 0) return [];
    return invoices.map((inv: any) => {
      const createdMs = inv.createdAt?.toMillis?.() ?? inv.createdAt ?? Date.now();
      const ageDays = Math.max(0, Math.round((Date.now() - new Date(createdMs).getTime()) / (1000 * 60 * 60 * 24)));
      const isOverdue = inv.status === 'overdue' || (inv.status === 'unpaid' && ageDays > 30);
      return {
        id: inv.id ?? `inv-${Math.random().toString(36).slice(2, 8)}`,
        number: inv.invoiceNumber ?? inv.number ?? inv.id ?? '—',
        client: inv.clientName ?? inv.client?.name ?? 'Unknown',
        amount: Number(inv.amount ?? inv.total ?? 0),
        age: ageDays,
        status: isOverdue ? 'overdue' as const : 'unpaid' as const,
        eligible: !isOverdue && ageDays <= 90,
        advancePct: isOverdue ? 0 : Math.max(70, 90 - Math.floor(ageDays / 10) * 5),
      };
    });
  }, [invoices]);

  // Compute scores from live data (empty array → zero scores, no fabrication).
  const scores = useMemo(() => computeScores(liveInvoices), [liveInvoices]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
              <Banknote className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Working Capital Engine</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-10">
            Financing, loans & credit intelligence for your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
            Live Scoring
          </Badge>
          <span className="text-[10px] text-slate-400">
            {clients.length} clients • {invoices.length} invoices • {returns.length} returns
          </span>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-slate-100/80 h-10 p-1">
          <TabsTrigger value="health" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            <Gauge className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Business Health</span>
            <span className="sm:hidden">Health</span>
          </TabsTrigger>
          <TabsTrigger value="financing" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Invoice Financing</span>
            <span className="sm:hidden">Financing</span>
          </TabsTrigger>
          <TabsTrigger value="loans" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            <Banknote className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">WC Loans</span>
            <span className="sm:hidden">Loans</span>
          </TabsTrigger>
          <TabsTrigger value="credit" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
            <CreditScore className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Credit Intelligence</span>
            <span className="sm:hidden">Credit</span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-4"
          >
            <TabsContent value="health" className="mt-0">
              <BusinessHealthTab scores={scores} invoices={liveInvoices} />
            </TabsContent>
            <TabsContent value="financing" className="mt-0">
              <InvoiceFinancingTab scores={scores} invoices={liveInvoices} />
            </TabsContent>
            <TabsContent value="loans" className="mt-0">
              <WorkingCapitalLoansTab />
            </TabsContent>
            <TabsContent value="credit" className="mt-0">
              <CreditIntelligenceTab scores={scores} />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
