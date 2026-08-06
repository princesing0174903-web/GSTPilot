'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Brain,
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  Users,
  AlertTriangle,
  Activity,
  Sparkles,
  ArrowRight,
  Lightbulb,
  Award,
  BarChart3,
  Play,
  Pause,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';
import { EmptyState } from '@/components/shared';

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR PALETTE — Emerald + Slate (NO indigo/blue)
// ═══════════════════════════════════════════════════════════════════════════════
const COLORS = {
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald400: '#60a5fa',
  emerald500: '#2563EB',
  emerald600: '#1D4ED8',
  emerald700: '#047857',
  emerald800: '#065f46',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',
  orange400: '#fb923c',
  orange500: '#f97316',
  teal400: '#2dd4bf',
  teal500: '#14b8a6',
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
type DecisionStatus = 'Pending' | 'Approved' | 'Executed' | 'Dismissed';
type Outcome = 'Positive' | 'Neutral' | 'Negative';
type ImpactType = 'Revenue Potential' | 'Risk Reduction' | 'Time Savings';

interface Decision {
  id: string;
  title: string;
  icon: React.ElementType;
  rationale: string;
  score: number;
  impact: {
    type: ImpactType;
    value: string;
    percent: number;
  }[];
  confidence: number;
  priority: Priority;
  status: DecisionStatus;
  category: string;
}

interface ExecutedDecision {
  id: string;
  date: string;
  decision: string;
  score: number;
  estimatedImpact: string;
  actualImpact: string;
  outcome: Outcome;
  outcomeValue: string;
}

interface DecisionRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  priority: Priority;
  triggeredCount: number;
  lastTriggered: string;
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useAnimatedNumber(target: number, duration: number = 1200) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);
  const startVal = useRef(0);

  useEffect(() => {
    startTime.current = null;
    startVal.current = current;

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal.current + (target - startVal.current) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    }

    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration]);

  return current;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA (empty — populated by real APIs when available)
// ═══════════════════════════════════════════════════════════════════════════════
const MORNING_DECISIONS: Decision[] = [];
const EXECUTED_DECISIONS: ExecutedDecision[] = [];
const DECISION_RULES: DecisionRule[] = [
  { id: 'r1', name: 'Revenue Drop Alert', condition: 'Revenue drops > 10% MoM', action: 'Alert CA + Generate recovery plan', priority: 'Critical', triggeredCount: 12, lastTriggered: '2025-03-03', enabled: true },
  { id: 'r2', name: 'Client Health Watch', condition: 'Client health < 50', action: 'Auto-assign CA + Schedule review', priority: 'High', triggeredCount: 8, lastTriggered: '2025-03-04', enabled: true },
  { id: 'r3', name: 'Compliance Guard', condition: 'Compliance score < 70', action: 'Flag for review + Generate report', priority: 'Critical', triggeredCount: 15, lastTriggered: '2025-03-02', enabled: true },
  { id: 'r4', name: 'Overdue Invoice Tracker', condition: 'Invoice overdue > 30 days', action: 'Escalation email + Payment reminder', priority: 'High', triggeredCount: 23, lastTriggered: '2025-03-04', enabled: true },
  { id: 'r5', name: 'Burnout Prevention', condition: 'Team utilization > 90%', action: 'Suggest hiring + Redistribute work', priority: 'Medium', triggeredCount: 5, lastTriggered: '2025-02-28', enabled: true },
  { id: 'r6', name: 'Cash Flow Sentinel', condition: 'Cash gap > ₹10,00,000 predicted', action: 'Alert CFO + Suggest financing', priority: 'High', triggeredCount: 3, lastTriggered: '2025-03-01', enabled: true },
  { id: 'r7', name: 'Pipeline Decline', condition: 'New client pipeline < 3', action: 'Trigger marketing + CA outreach', priority: 'Medium', triggeredCount: 7, lastTriggered: '2025-02-25', enabled: false },
  { id: 'r8', name: 'GST Audit Risk', condition: 'ITC claim > 110% of GSTR-2A', action: 'Flag for manual review + Alert CA', priority: 'Critical', triggeredCount: 4, lastTriggered: '2025-03-04', enabled: true },
  { id: 'r9', name: 'Late Filing Prevention', condition: 'Return deadline < 3 days', action: 'Auto-assign team + Daily reminders', priority: 'High', triggeredCount: 18, lastTriggered: '2025-03-03', enabled: true },
  { id: 'r10', name: 'Expense Spike Alert', condition: 'Operating costs up > 15% QoQ', action: 'Generate cost analysis + Suggest cuts', priority: 'Medium', triggeredCount: 2, lastTriggered: '2025-02-20', enabled: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function getPriorityColor(priority: Priority) {
  switch (priority) {
    case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Low': return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getStatusColor(status: DecisionStatus) {
  switch (status) {
    case 'Pending': return 'bg-slate-100 text-slate-600';
    case 'Approved': return 'bg-emerald-100 text-emerald-700';
    case 'Executed': return 'bg-emerald-200 text-emerald-800';
    case 'Dismissed': return 'bg-red-100 text-red-600';
  }
}

function getStatusIcon(status: DecisionStatus) {
  switch (status) {
    case 'Pending': return Clock;
    case 'Approved': return CheckCircle;
    case 'Executed': return Play;
    case 'Dismissed': return XCircle;
  }
}

function getOutcomeBadge(outcome: Outcome, value: string) {
  switch (outcome) {
    case 'Positive': return { bg: 'bg-emerald-100 text-emerald-700', icon: TrendingUp };
    case 'Neutral': return { bg: 'bg-slate-100 text-slate-600', icon: MinusIcon };
    case 'Negative': return { bg: 'bg-red-100 text-red-600', icon: TrendingDown };
  }
}

function MinusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

function getScoreColor(score: number) {
  if (score >= 85) return COLORS.emerald500;
  if (score >= 70) return COLORS.teal500;
  if (score >= 55) return COLORS.amber500;
  return COLORS.red500;
}

function getScoreBg(score: number) {
  if (score >= 85) return 'bg-emerald-50 border-emerald-200';
  if (score >= 70) return 'bg-teal-50 border-teal-200';
  if (score >= 55) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getDayString() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED SCORE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedScore({ score }: { score: number }) {
  const animated = useAnimatedNumber(score, 1500);
  return (
    <span className="text-2xl font-bold tabular-nums" style={{ color: getScoreColor(score) }}>
      {animated}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function DecisionImpactChart() {
  const data = [
    { label: 'Week 1', approved: 6, dismissed: 2, impact: 85 },
    { label: 'Week 2', approved: 5, dismissed: 3, impact: 72 },
    { label: 'Week 3', approved: 7, dismissed: 1, impact: 94 },
    { label: 'Week 4', approved: 8, dismissed: 2, impact: 89 },
  ];

  const maxVal = Math.max(...data.map(d => Math.max(d.approved, d.dismissed)));
  const chartW = 480;
  const chartH = 200;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const barGroupW = innerW / data.length;
  const barW = 28;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={padL} y1={padT + innerH * (1 - f)} x2={chartW - padR} y2={padT + innerH * (1 - f)} stroke={COLORS.slate200} strokeDasharray="4 4" />
      ))}
      {/* Y axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <text key={i} x={padL - 8} y={padT + innerH * (1 - f) + 4} textAnchor="end" fill={COLORS.slate400} fontSize={10}>{Math.round(maxVal * f)}</text>
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const cx = padL + barGroupW * i + barGroupW / 2;
        const aH = (d.approved / maxVal) * innerH;
        const dH = (d.dismissed / maxVal) * innerH;
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={padT + innerH - aH} width={barW} height={aH} rx={4} fill={COLORS.emerald500} opacity={0.85}>
              <animate attributeName="height" from={0} to={aH} dur={0.8} fill="freeze" />
              <animate attributeName="y" from={padT + innerH} to={padT + innerH - aH} dur={0.8} fill="freeze" />
            </rect>
            <rect x={cx + 2} y={padT + innerH - dH} width={barW} height={dH} rx={4} fill={COLORS.slate300} opacity={0.7}>
              <animate attributeName="height" from={0} to={dH} dur={0.8} fill="freeze" />
              <animate attributeName="y" from={padT + innerH} to={padT + innerH - dH} dur={0.8} fill="freeze" />
            </rect>
            <text x={cx} y={padT + innerH + 18} textAnchor="middle" fill={COLORS.slate500} fontSize={11}>{d.label}</text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={padL} y={chartH - 12} width={10} height={10} rx={2} fill={COLORS.emerald500} />
      <text x={padL + 14} y={chartH - 3} fill={COLORS.slate600} fontSize={10}>Approved</text>
      <rect x={padL + 80} y={chartH - 12} width={10} height={10} rx={2} fill={COLORS.slate300} />
      <text x={padL + 94} y={chartH - 3} fill={COLORS.slate600} fontSize={10}>Dismissed</text>
    </svg>
  );
}

function ScoreDistributionChart() {
  const buckets = [
    { range: '0-20', count: 2, pct: 5 },
    { range: '20-40', count: 4, pct: 10 },
    { range: '40-60', count: 8, pct: 20 },
    { range: '60-80', count: 14, pct: 35 },
    { range: '80-100', count: 12, pct: 30 },
  ];

  const chartW = 480;
  const chartH = 180;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const maxCount = Math.max(...buckets.map(b => b.count));
  const barW = innerW / buckets.length - 12;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={padL} y1={padT + innerH * (1 - f)} x2={chartW - padR} y2={padT + innerH * (1 - f)} stroke={COLORS.slate200} strokeDasharray="4 4" />
      ))}
      {buckets.map((b, i) => {
        const cx = padL + (innerW / buckets.length) * i + (innerW / buckets.length) / 2;
        const bH = (b.count / maxCount) * innerH;
        const color = i === 0 || i === 1 ? COLORS.red400 : i === 2 ? COLORS.amber400 : COLORS.emerald400;
        return (
          <g key={i}>
            <rect x={cx - barW / 2} y={padT + innerH - bH} width={barW} height={bH} rx={4} fill={color} opacity={0.8}>
              <animate attributeName="height" from={0} to={bH} dur={0.6 + i * 0.1} fill="freeze" />
              <animate attributeName="y" from={padT + innerH} to={padT + innerH - bH} dur={0.6 + i * 0.1} fill="freeze" />
            </rect>
            <text x={cx} y={padT + innerH - bH - 6} textAnchor="middle" fill={COLORS.slate600} fontSize={10} fontWeight={600}>{b.count}</text>
            <text x={cx} y={padT + innerH + 16} textAnchor="middle" fill={COLORS.slate500} fontSize={9}>{b.range}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DecisionTrendChart() {
  const weeks = [
    { label: 'W1', approved: 5, executed: 3 },
    { label: 'W2', approved: 7, executed: 5 },
    { label: 'W3', approved: 6, executed: 4 },
    { label: 'W4', approved: 8, executed: 6 },
    { label: 'W5', approved: 9, executed: 7 },
    { label: 'W6', approved: 7, executed: 6 },
  ];

  const chartW = 480;
  const chartH = 180;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const maxVal = 10;

  const makePoints = (key: 'approved' | 'executed') => {
    return weeks.map((w, i) => {
      const x = padL + (innerW / (weeks.length - 1)) * i;
      const y = padT + innerH - (w[key] / maxVal) * innerH;
      return `${x},${y}`;
    }).join(' ');
  };

  const makeArea = (key: 'approved' | 'executed') => {
    const pts = weeks.map((w, i) => {
      const x = padL + (innerW / (weeks.length - 1)) * i;
      const y = padT + innerH - (w[key] / maxVal) * innerH;
      return { x, y };
    });
    return `M${pts[0].x},${padT + innerH} ` + pts.map(p => `L${p.x},${p.y}`).join(' ') + ` L${pts[pts.length - 1].x},${padT + innerH} Z`;
  };

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={padL} y1={padT + innerH * (1 - f)} x2={chartW - padR} y2={padT + innerH * (1 - f)} stroke={COLORS.slate200} strokeDasharray="4 4" />
      ))}
      {/* Y labels */}
      {[0, 5, 10].map((v, i) => (
        <text key={i} x={padL - 8} y={padT + innerH - (v / maxVal) * innerH + 4} textAnchor="end" fill={COLORS.slate400} fontSize={10}>{v}</text>
      ))}
      {/* Area fills */}
      <path d={makeArea('approved')} fill={COLORS.emerald500} opacity={0.1} />
      <path d={makeArea('executed')} fill={COLORS.teal500} opacity={0.1} />
      {/* Lines */}
      <polyline points={makePoints('approved')} fill="none" stroke={COLORS.emerald500} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={makePoints('executed')} fill="none" stroke={COLORS.teal500} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
      {/* Dots */}
      {weeks.map((w, i) => {
        const x = padL + (innerW / (weeks.length - 1)) * i;
        return (
          <g key={i}>
            <circle cx={x} cy={padT + innerH - (w.approved / maxVal) * innerH} r={4} fill={COLORS.emerald500} />
            <circle cx={x} cy={padT + innerH - (w.executed / maxVal) * innerH} r={4} fill={COLORS.teal500} />
            <text x={x} y={padT + innerH + 16} textAnchor="middle" fill={COLORS.slate500} fontSize={10}>{w.label}</text>
          </g>
        );
      })}
      {/* Legend */}
      <line x1={padL} y1={chartH - 4} x2={padL + 20} y2={chartH - 4} stroke={COLORS.emerald500} strokeWidth={2.5} />
      <text x={padL + 24} y={chartH} fill={COLORS.slate600} fontSize={10}>Approved</text>
      <line x1={padL + 85} y1={chartH - 4} x2={padL + 105} y2={chartH - 4} stroke={COLORS.teal500} strokeWidth={2.5} strokeDasharray="6 3" />
      <text x={padL + 109} y={chartH} fill={COLORS.slate600} fontSize={10}>Executed</text>
    </svg>
  );
}

function ExecutionTimeline() {
  if (EXECUTED_DECISIONS.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No execution events yet"
        description="Executed decisions will appear on the timeline once they are run."
        compact
      />
    );
  }
  const events = EXECUTED_DECISIONS.slice(0, 12).map(d => ({
    ...d,
    dateObj: new Date(d.date),
  }));

  const chartW = 700;
  const chartH = 200;
  const padL = 30;
  const padR = 30;
  const padT = 30;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const minDate = events.length > 0 ? events[events.length - 1].dateObj.getTime() : 0;
  const maxDate = events.length > 0 ? events[0].dateObj.getTime() : 1;
  const dateRange = maxDate - minDate || 1;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
      {/* Timeline axis */}
      <line x1={padL} y1={padT + innerH / 2} x2={chartW - padR} y2={padT + innerH / 2} stroke={COLORS.slate200} strokeWidth={2} />
      {/* Events */}
      {events.map((e, i) => {
        const xFrac = (e.dateObj.getTime() - minDate) / dateRange;
        const x = padL + innerW - xFrac * innerW;
        const y = padT + innerH / 2;
        const outcomeColor = e.outcome === 'Positive' ? COLORS.emerald500 : e.outcome === 'Negative' ? COLORS.red500 : COLORS.slate400;
        const offsetY = i % 2 === 0 ? -20 : 20;
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={x} y2={y + offsetY} stroke={outcomeColor} strokeWidth={1.5} opacity={0.6} />
            <circle cx={x} cy={y} r={6} fill={outcomeColor} opacity={0.8}>
              <animate attributeName="r" from={0} to={6} dur={0.3 + i * 0.05} fill="freeze" />
            </circle>
            <circle cx={x} cy={y} r={3} fill="white" />
            <text x={x} y={y + offsetY + (offsetY < 0 ? -4 : 12)} textAnchor="middle" fill={COLORS.slate600} fontSize={8}>{e.decision.split(' ').slice(0, 2).join(' ')}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS ICON DISPLAY — declared outside render to avoid static-components error
// ═══════════════════════════════════════════════════════════════════════════════
function StatusIconDisplay({ status }: { status: DecisionStatus }) {
  switch (status) {
    case 'Pending': return <Clock className="h-3 w-3 mr-1" />;
    case 'Approved': return <CheckCircle className="h-3 w-3 mr-1" />;
    case 'Executed': return <Play className="h-3 w-3 mr-1" />;
    case 'Dismissed': return <XCircle className="h-3 w-3 mr-1" />;
  }
}

function OutcomeIconDisplay({ outcome }: { outcome: Outcome }) {
  switch (outcome) {
    case 'Positive': return <TrendingUp className="h-3 w-3 mr-1" />;
    case 'Neutral': return <MinusIcon className="h-3 w-3 mr-1" />;
    case 'Negative': return <TrendingDown className="h-3 w-3 mr-1" />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function DecisionCard({ decision, onAction, index }: {
  decision: Decision;
  onAction: (id: string, action: DecisionStatus) => void;
  index: number;
}) {
  const Icon = decision.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <Card className="border-slate-200/80 hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${getScoreBg(decision.score)}`}>
                <Icon className="h-5 w-5" style={{ color: getScoreColor(decision.score) }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{decision.title}</h3>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border ${getPriorityColor(decision.priority)}`}>
                    {decision.priority}
                  </Badge>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${getStatusColor(decision.status)}`}>
                    <StatusIconDisplay status={decision.status} />
                    {decision.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{decision.rationale}</p>
              </div>
            </div>
            {/* Score */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`flex flex-col items-center justify-center h-16 w-16 rounded-xl border-2 ${getScoreBg(decision.score)}`}>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">Score</span>
                <AnimatedScore score={decision.score} />
              </div>
            </div>
          </div>

          {/* Impact bars */}
          <div className="space-y-2 mb-3">
            {decision.impact.map((imp, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-28 shrink-0">{imp.type}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: imp.percent >= 70 ? COLORS.emerald500 : imp.percent >= 50 ? COLORS.teal500 : COLORS.amber500 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${imp.percent}%` }}
                    transition={{ delay: index * 0.08 + 0.3, duration: 0.6, ease: 'easeOut' as const }}
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-600 w-28 shrink-0 text-right">{imp.value}</span>
              </div>
            ))}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-slate-400 shrink-0">Confidence</span>
            <div className="flex-1">
              <Progress value={decision.confidence} className="h-1.5" />
            </div>
            <span className="text-xs font-semibold" style={{ color: getScoreColor(decision.confidence) }}>{decision.confidence}%</span>
          </div>

          {/* Action buttons */}
          {decision.status === 'Pending' && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onAction(decision.id, 'Approved')}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-300"
                onClick={() => onAction(decision.id, 'Delegate')}
              >
                <Users className="h-3 w-3 mr-1" />
                Delegate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-slate-400 hover:text-red-500"
                onClick={() => onAction(decision.id, 'Dismissed')}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DecisionEnginePage() {
  const [decisions, setDecisions] = useState<Decision[]>(MORNING_DECISIONS);
  const [rules, setRules] = useState<DecisionRule[]>(DECISION_RULES);
  const [activeTab, setActiveTab] = useState('morning-brief');
  const [newRule, setNewRule] = useState({
    condition: '',
    action: '',
    priority: 'High' as Priority,
    confidenceThreshold: 70,
  });
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);

  // Handle decision actions
  const handleDecisionAction = useCallback((id: string, action: string) => {
    setDecisions(prev =>
      prev.map(d => {
        if (d.id !== id) return d;
        if (action === 'Delegate') {
          return { ...d, status: 'Approved' as DecisionStatus };
        }
        return { ...d, status: action as DecisionStatus };
      })
    );
  }, []);

  // Toggle rule
  const toggleRule = useCallback((id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  // Computed analytics
  const analytics = useMemo(() => {
    const totalExecuted = EXECUTED_DECISIONS.length;
    const positiveCount = EXECUTED_DECISIONS.filter(d => d.outcome === 'Positive').length;
    const accuracy = totalExecuted > 0 ? Math.round((positiveCount / totalExecuted) * 100) : 0;
    const approvedThisWeek = 0;
    const dismissedThisWeek = 0;
    const categoryBreakdown = [
      { name: 'Collections', count: 0, color: COLORS.emerald500 },
      { name: 'Compliance', count: 0, color: COLORS.teal500 },
      { name: 'Operations', count: 0, color: COLORS.amber500 },
      { name: 'Finance', count: 0, color: COLORS.orange500 },
      { name: 'Growth', count: 0, color: COLORS.slate400 },
    ];
    return { accuracy, approvedThisWeek, dismissedThisWeek, categoryBreakdown, totalExecuted, positiveCount };
  }, []);

  // Stats for hero section
  const pendingCount = decisions.filter(d => d.status === 'Pending').length;
  const approvedCount = decisions.filter(d => d.status === 'Approved').length;
  const criticalCount = decisions.filter(d => d.priority === 'Critical' && d.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ═══ Page Header ═══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                AI DECISION ENGINE™
              </h1>
              <p className="text-xs text-slate-500">Every morning, AI generates decisions with scores</p>
            </div>
          </div>
        </motion.div>

        {/* ═══ Quick Stats ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {[
            { label: 'Pending Decisions', value: pendingCount, icon: Clock, color: COLORS.amber500, bg: 'bg-amber-50' },
            { label: 'Approved Today', value: approvedCount, icon: CheckCircle, color: COLORS.emerald500, bg: 'bg-emerald-50' },
            { label: 'Critical Items', value: criticalCount, icon: AlertTriangle, color: COLORS.red500, bg: 'bg-red-50' },
            { label: 'AI Accuracy', value: `${analytics.accuracy}%`, icon: Target, color: COLORS.teal500, bg: 'bg-teal-50' },
          ].map((stat, i) => (
            <Card key={i} className="border-slate-200/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* ═══ Tabs ═══ */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100/80 p-1 h-9 mb-6">
            <TabsTrigger value="morning-brief" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Sparkles className="h-3 w-3 mr-1.5" />
              Morning Brief
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <BarChart3 className="h-3 w-3 mr-1.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Zap className="h-3 w-3 mr-1.5" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="execution-log" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Activity className="h-3 w-3 mr-1.5" />
              Execution Log
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: MORNING BRIEF
              ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="morning-brief">
            {/* Hero greeting */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6"
            >
              <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50 via-white to-teal-50/50 overflow-hidden relative">
                <CardContent className="p-6">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-100/30 rounded-full -translate-y-1/2 translate-x-1/4" />
                  <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-teal-100/20 rounded-full translate-y-1/2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">{getDayString()}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">
                      {getGreeting()}, Rajesh.
                    </h2>
                    <p className="text-sm text-slate-600 mb-4">
                      Here are today&apos;s AI decisions. {criticalCount} critical items need your attention.
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        {decisions.filter(d => d.status === 'Pending').length} pending
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        {criticalCount} critical
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <div className="h-2 w-2 rounded-full bg-slate-400" />
                        {decisions.length} decisions scored
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Decision Cards */}
            <ScrollArea className="max-h-[calc(100vh-380px)]">
              <div className="space-y-3 pr-2">
                {decisions.length === 0 ? (
                  <Card className="border-slate-200/60">
                    <CardContent className="p-6">
                      <EmptyState
                        icon={Sparkles}
                        title="No AI decisions yet"
                        description="The decision engine will generate AI-scored recommendations here once your firm data is synced."
                      />
                    </CardContent>
                  </Card>
                ) : (
                  decisions
                    .sort((a, b) => {
                      const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                      return priorityOrder[a.priority] - priorityOrder[b.priority];
                    })
                    .map((decision, i) => (
                      <DecisionCard
                        key={decision.id}
                        decision={decision}
                        onAction={handleDecisionAction}
                        index={i}
                      />
                    ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: DECISION ANALYTICS
              ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Accuracy tracker */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="border-emerald-200/50 bg-gradient-to-r from-emerald-50/50 to-white">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                        <Award className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Decision Accuracy Tracker</h3>
                        <p className="text-xs text-slate-500">Based on {analytics.totalExecuted} past decisions</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-2 mt-3">
                      <span className="text-4xl font-bold text-emerald-600">{analytics.accuracy}%</span>
                      <span className="text-sm text-slate-500 mb-1">accurate this month</span>
                      <ArrowRight className="h-4 w-4 text-emerald-400 mb-1.5" />
                      <span className="text-sm text-emerald-600 font-medium mb-1">+3% vs last month</span>
                    </div>
                    <div className="mt-3">
                      <Progress value={analytics.accuracy} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
                  <Card className="border-slate-200/60">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold text-slate-700">Decision Impact — Approved vs Dismissed</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <DecisionImpactChart />
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
                  <Card className="border-slate-200/60">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold text-slate-700">Decision Score Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4">
                      <ScoreDistributionChart />
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Category breakdown + Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
                  <Card className="border-slate-200/60">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold text-slate-700">Category Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-4 space-y-3">
                      {analytics.categoryBreakdown.map((cat, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-xs text-slate-600 flex-1">{cat.name}</span>
                          <span className="text-xs font-semibold text-slate-800">{cat.count}</span>
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: cat.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(cat.count / 5) * 100}%` }}
                              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
                  <Card className="border-slate-200/60 bg-gradient-to-br from-emerald-50/50 to-white">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Time Savings</span>
                      </div>
                      <div>
                        <span className="text-3xl font-bold text-slate-900">0</span>
                        <span className="text-sm text-slate-600 ml-1">hours</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">No decisions executed yet</p>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
                  <Card className="border-slate-200/60 bg-gradient-to-br from-teal-50/50 to-white">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <IndianRupee className="h-4 w-4 text-teal-500" />
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Revenue Impact</span>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-slate-900">₹0</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">No decisions executed yet</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Trend chart */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-slate-700">Decision Trend — Weekly Approved / Executed</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <DecisionTrendChart />
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: DECISION RULES
              ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="rules">
            <div className="space-y-5">
              {/* Rule Builder Toggle */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Card className="border-slate-200/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                          <Lightbulb className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">Custom Rule Builder</h3>
                          <p className="text-xs text-slate-500">Create automated decision triggers</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setShowRuleBuilder(!showRuleBuilder)}
                      >
                        {showRuleBuilder ? (
                          <><Pause className="h-3 w-3 mr-1" />Close Builder</>
                        ) : (
                          <><Play className="h-3 w-3 mr-1" />New Rule</>
                        )}
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showRuleBuilder && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                            {/* IF condition */}
                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">IF Condition</label>
                              <div className="flex flex-wrap gap-2">
                                {['Revenue drops > 10%', 'Client health < 50', 'Compliance score < 70', 'Overdue > 30 days', 'Cash gap > ₹10L'].map((cond, i) => (
                                  <button
                                    key={i}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                      newRule.condition === cond
                                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                                    }`}
                                    onClick={() => setNewRule(prev => ({ ...prev, condition: cond }))}
                                  >
                                    {cond}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* THEN action */}
                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">THEN Action</label>
                              <div className="flex flex-wrap gap-2">
                                {['Alert CA', 'Auto-assign task', 'Generate report', 'Send notification', 'Schedule meeting'].map((act, i) => (
                                  <button
                                    key={i}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                      newRule.action === act
                                        ? 'bg-teal-100 border-teal-300 text-teal-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50'
                                    }`}
                                    onClick={() => setNewRule(prev => ({ ...prev, action: act }))}
                                  >
                                    {act}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Priority + Threshold */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">Priority</label>
                                <div className="flex gap-2">
                                  {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) => (
                                    <button
                                      key={p}
                                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                        newRule.priority === p
                                          ? getPriorityColor(p) + ' border font-semibold'
                                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                      }`}
                                      onClick={() => setNewRule(prev => ({ ...prev, priority: p }))}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5 block">
                                  Confidence Threshold: {newRule.confidenceThreshold}%
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={newRule.confidenceThreshold}
                                  onChange={(e) => setNewRule(prev => ({ ...prev, confidenceThreshold: Number(e.target.value) }))}
                                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                                  <span>0%</span>
                                  <span>50%</span>
                                  <span>100%</span>
                                </div>
                              </div>
                            </div>

                            <Button
                              className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={!newRule.condition || !newRule.action}
                              onClick={() => {
                                const rule: DecisionRule = {
                                  id: `r${Date.now()}`,
                                  name: `Custom: ${newRule.condition}`,
                                  condition: newRule.condition,
                                  action: newRule.action,
                                  priority: newRule.priority,
                                  triggeredCount: 0,
                                  lastTriggered: 'Never',
                                  enabled: true,
                                };
                                setRules(prev => [rule, ...prev]);
                                setNewRule({ condition: '', action: '', priority: 'High', confidenceThreshold: 70 });
                                setShowRuleBuilder(false);
                              }}
                            >
                              <Zap className="h-3.5 w-3.5 mr-1.5" />
                              Create Rule
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Active Rules Table */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-slate-700">Active Rules</CardTitle>
                      <Badge variant="outline" className="text-[10px]">{rules.filter(r => r.enabled).length} active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ScrollArea className="max-h-96">
                      <div className="space-y-2">
                        {rules.map((rule, i) => (
                          <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              rule.enabled
                                ? 'bg-white border-slate-200 hover:border-emerald-200'
                                : 'bg-slate-50/50 border-slate-100 opacity-60'
                            }`}
                          >
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => toggleRule(rule.id)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-700">{rule.name}</span>
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border ${getPriorityColor(rule.priority)}`}>
                                  {rule.priority}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400">IF</span>
                                <span className="text-[10px] text-slate-600">{rule.condition}</span>
                                <span className="text-[10px] text-emerald-500">→</span>
                                <span className="text-[10px] text-slate-600">{rule.action}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className="text-xs font-semibold text-slate-700">{rule.triggeredCount}</p>
                                <p className="text-[9px] text-slate-400">triggers</p>
                              </div>
                              <div className="text-right min-w-[60px]">
                                <p className="text-[10px] text-slate-500">{rule.lastTriggered}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 4: EXECUTION LOG
              ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="execution-log">
            <div className="space-y-5">
              {/* AI Learning Note */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Card className="border-emerald-200/50 bg-gradient-to-r from-emerald-50/50 to-white">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 shrink-0">
                      <Brain className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">AI Learning Update</p>
                      <p className="text-xs text-slate-600">
                        No executed decisions yet. Once decisions are executed, AI confidence metrics will appear here.
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0 ml-auto" />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Execution Table */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-slate-700">Executed Decisions</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {EXECUTED_DECISIONS.filter(d => d.outcome === 'Positive').length} positive
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-200">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          {EXECUTED_DECISIONS.filter(d => d.outcome === 'Negative').length} negative
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ScrollArea className="max-h-80">
                      <div className="space-y-1">
                        {/* Header */}
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">
                          <div className="col-span-2">Date</div>
                          <div className="col-span-3">Decision</div>
                          <div className="col-span-1">Score</div>
                          <div className="col-span-2">Estimated</div>
                          <div className="col-span-2">Actual</div>
                          <div className="col-span-2">Outcome</div>
                        </div>
                        <Separator />
                        {EXECUTED_DECISIONS.length === 0 ? (
                          <div className="py-6">
                            <EmptyState
                              icon={Activity}
                              title="No decisions executed yet"
                              description="Executed decisions will appear here once approved decisions are run."
                              compact
                            />
                          </div>
                        ) : (
                          EXECUTED_DECISIONS.map((d, i) => {
                            const outcomeInfo = getOutcomeBadge(d.outcome, d.outcomeValue);
                            return (
                              <motion.div
                                key={d.id}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03, duration: 0.25 }}
                                className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-slate-50/80 transition-colors"
                              >
                                <div className="col-span-2 text-xs text-slate-500">{d.date}</div>
                                <div className="col-span-3 text-xs font-medium text-slate-700 truncate">{d.decision}</div>
                                <div className="col-span-1">
                                  <span className="text-xs font-semibold" style={{ color: getScoreColor(d.score) }}>{d.score}</span>
                                </div>
                                <div className="col-span-2 text-xs text-slate-500 truncate">{d.estimatedImpact}</div>
                                <div className="col-span-2 text-xs text-slate-600 font-medium truncate">{d.actualImpact}</div>
                                <div className="col-span-2">
                                  <Badge className={`text-[10px] px-2 py-0 h-5 ${outcomeInfo.bg} border-0`}>
                                    <OutcomeIconDisplay outcome={d.outcome} />
                                    {d.outcomeValue}
                                  </Badge>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Execution Timeline */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-slate-700">Execution Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4">
                    <ExecutionTimeline />
                    <div className="flex items-center gap-6 mt-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.emerald500 }} />
                        <span className="text-[10px] text-slate-500">Positive outcome</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.red500 }} />
                        <span className="text-[10px] text-slate-500">Negative outcome</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.slate400 }} />
                        <span className="text-[10px] text-slate-500">Neutral</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
