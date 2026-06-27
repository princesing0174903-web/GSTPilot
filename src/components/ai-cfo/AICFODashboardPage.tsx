'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Operating System Dashboard
// Phase 3 — The CFO that runs your business 24/7.
//
// Modules rendered here:
//   Module 1 — CFO Dashboard cards (Revenue/Profit/Cash/Receivables/Payables/GST)
//   Module 2 — Financial Prediction Engine (forecasts with confidence)
//   Module 3 — Business Risk Engine (level + WHY explanation)
//   Module 4 — Daily CFO Brief (greeting + snapshot + priority actions)
//   Module 6 — CFO Recommendation Engine (actionable cards)
//   Module 7 — Action Engine (execute from recommendations)
//   Module 8 — CFO Memory (trends, client behaviour, insights)
//
// Module 5 (Ask CFO) + Module 9 (CFO Personality) live in the Oracle chat
// workspace — /api/oracle/chat system prompt.
//
// Tagline: Understand Your Business. Predict Your Future. Recommend Your Next Move.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, Wallet, IndianRupee, FileText, CreditCard,
  Sparkles, AlertTriangle, CheckCircle2, Lightbulb, Activity, Clock,
  RefreshCw, ChevronRight, Zap, Target, ShieldAlert, Users, Send,
  FileBarChart, MessageSquare, Eye, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { CFOResponse, RiskLevel, CFORecommendation } from '@/lib/cfo/types';
import AICFOPhase1Sections from './AICFOPhase1Sections';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatINRFull(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'high': return 'text-red-400';
    case 'medium': return 'text-amber-400';
    default: return 'text-emerald-400';
  }
}

function riskBg(level: RiskLevel): string {
  switch (level) {
    case 'high': return 'bg-red-500/10 border-red-500/20';
    case 'medium': return 'bg-amber-500/10 border-amber-500/20';
    default: return 'bg-emerald-500/10 border-emerald-500/20';
  }
}

function severityColor(severity: CFORecommendation['severity']): string {
  switch (severity) {
    case 'critical': return 'border-red-500/30 bg-red-500/[0.04]';
    case 'warning': return 'border-amber-500/30 bg-amber-500/[0.04]';
    case 'opportunity': return 'border-emerald-500/30 bg-emerald-500/[0.04]';
    default: return 'border-cyan-500/30 bg-cyan-500/[0.04]';
  }
}

// ─── Animated number ──────────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const initial = 0;
    const tick = (t: number) => {
      const progress = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(initial + (target - initial) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ─── Mini Sparkline (SVG) ─────────────────────────────────────────────────────

function Sparkline({ data, color = '#10b981', width = 100, height = 32 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;
  const id = `spark-${color.replace('#', '')}-${Math.round(Math.random() * 1e6)}`;
  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Wrap with stagger animation ──────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, action }: { icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Dashboard metric card ────────────────────────────────────────────────────

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
  trend?: { value: number; label: string };
  sparkData?: number[];
  sparkColor?: string;
  rows?: Array<{ label: string; value: string }>;
  delay?: number;
}

function MetricCard({ icon: Icon, label, primary, secondary, trend, sparkData, sparkColor, rows, delay = 0 }: MetricCardProps) {
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-colors">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold tracking-tight text-foreground">{primary}</p>
            {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
          </div>
          {trend && (
            <div className="mt-3 flex items-center gap-1.5">
              {trend.value >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPct(trend.value)}
              </span>
              <span className="text-[11px] text-muted-foreground">{trend.label}</span>
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-white/[0.04] pt-3">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ─── Risk Card (Module 3) ─────────────────────────────────────────────────────

function RiskCard({ risk, delay }: { risk: CFOResponse['risks'][number]; delay: number }) {
  const levelLabel = risk.level === 'high' ? 'HIGH' : risk.level === 'medium' ? 'MEDIUM' : 'LOW';
  return (
    <FadeIn delay={delay}>
      <Card className={`border ${riskBg(risk.level)} backdrop-blur-sm`}>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${riskColor(risk.level)}`} />
              <span className="text-sm font-semibold capitalize text-foreground">{risk.category} Risk</span>
            </div>
            <span className={`text-xs font-bold ${riskColor(risk.level)}`}>
              {levelLabel}
            </span>
          </div>
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${risk.score}%` }}
              transition={{ duration: 0.8, delay: delay + 0.2 }}
              className={`h-full rounded-full ${risk.level === 'high' ? 'bg-red-500' : risk.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
            />
          </div>
          <div className="space-y-1">
            {risk.reasons.map((reason, i) => (
              <p key={i} className="text-xs leading-relaxed text-muted-foreground">
                {reason}
              </p>
            ))}
          </div>
          {risk.recommendation && (
            <div className="mt-2 rounded-lg bg-white/[0.03] p-2">
              <p className="text-[11px] leading-relaxed text-foreground/80">
                <span className="font-medium">Action:</span> {risk.recommendation}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ─── Recommendation Card (Module 6) ───────────────────────────────────────────

function RecommendationCard({ rec, delay, onAction }: { rec: CFORecommendation; delay: number; onAction: (rec: CFORecommendation) => void }) {
  const severityIcon: Record<CFORecommendation['severity'], LucideIcon> = {
    critical: AlertTriangle,
    warning: AlertTriangle,
    opportunity: Lightbulb,
    info: Sparkles,
  };
  const Icon = severityIcon[rec.severity];
  const iconColor = rec.severity === 'critical' ? 'text-red-400' : rec.severity === 'warning' ? 'text-amber-400' : rec.severity === 'opportunity' ? 'text-emerald-400' : 'text-cyan-400';
  return (
    <FadeIn delay={delay}>
      <Card className={`border ${severityColor(rec.severity)} backdrop-blur-sm`}>
        <CardContent className="p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Icon className={`h-4 w-4 mt-0.5 ${iconColor}`} />
              <div>
                <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{rec.headline}</p>
              </div>
            </div>
            {rec.metric && (
              <Badge variant="outline" className="shrink-0 border-white/10 bg-white/[0.03]">
                {rec.metric.value}
              </Badge>
            )}
          </div>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{rec.description}</p>
          <div className="space-y-1">
            {rec.actions.map((action, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{action}</span>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-7 border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.06]"
            onClick={() => onAction(rec)}
          >
            <Zap className="h-3 w-3 mr-1.5" />
            Take Action
          </Button>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ─── Action Engine button ─────────────────────────────────────────────────────

interface ActionButton {
  label: string;
  icon: LucideIcon;
  view?: Parameters<ReturnType<typeof useApp>['setCurrentView']>[0];
  eventName?: string;
  prompt?: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  { label: 'Generate Report', icon: FileBarChart, eventName: 'oracle-ask', prompt: 'Generate a CFO report for this month.' },
  { label: 'Export PDF', icon: FileText, eventName: 'cfo-export-pdf' },
  { label: 'Create Forecast', icon: TrendingUp, eventName: 'oracle-ask', prompt: 'Create a 90-day cash flow forecast.' },
  { label: 'Recover Collections', icon: Wallet, view: 'reconcile' },
  { label: 'Create Reminder', icon: MessageSquare, eventName: 'oracle-ask', prompt: 'Draft a WhatsApp reminder for overdue clients.' },
  { label: 'Prepare Returns', icon: FileText, view: 'returns' },
  { label: 'Send WhatsApp', icon: Send, eventName: 'cfo-send-whatsapp' },
  { label: 'Open Analytics', icon: Activity, view: 'analytics' },
];

function ActionEngine({ onNavigate }: { onNavigate: (view: Parameters<ReturnType<typeof useApp>['setCurrentView']>[0]) => void }) {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      {ACTION_BUTTONS.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            onClick={() => {
              if (btn.view) {
                onNavigate(btn.view);
              } else if (btn.eventName === 'oracle-ask' && btn.prompt) {
                window.dispatchEvent(new CustomEvent('oracle-ask', { detail: btn.prompt }));
              } else if (btn.eventName) {
                toast({
                  title: `${btn.label}`,
                  description: `${btn.label} workflow initiated. Oracle will prepare the deliverable.`,
                });
              }
            }}
            className="group flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] hover-lift"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:accent-text" />
            <span>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Health Score Gauge (Module 1) ────────────────────────────────────────────

function HealthGauge({ score, size = 160 }: { score: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const tier = score >= 80 ? 'Excellent' : score >= 65 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'At Risk';
  const color = score >= 80 ? '#10b981' : score >= 65 ? '#06b6d4' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="cfoHealthGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#cfoHealthGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-4xl font-bold"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</span>
        <span className="mt-1 text-xs font-medium" style={{ color }}>{tier}</span>
      </div>
    </div>
  );
}

// ─── Daily Brief (Module 4) ───────────────────────────────────────────────────

function DailyBriefCard({ brief, delay }: { brief: CFOResponse['brief']; delay: number }) {
  const urgencyStyles: Record<string, string> = {
    critical: 'border-red-500/30 bg-red-500/[0.05]',
    high: 'border-amber-500/30 bg-amber-500/[0.05]',
    medium: 'border-cyan-500/20 bg-cyan-500/[0.03]',
    low: 'border-white/[0.06] bg-white/[0.02]',
  };
  const urgencyLabel: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
  };
  const urgencyColor: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-amber-400',
    medium: 'text-cyan-400',
    low: 'text-muted-foreground',
  };
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-card/60 to-cyan-500/[0.04] backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Greeting */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-bold text-foreground">{brief.greeting}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{brief.dateLabel}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300">
                <Activity className="h-3 w-3 mr-1" />
                Live Brief
              </Badge>
              <span className="text-[10px] text-muted-foreground">Business Health: {brief.healthScore}/100</span>
            </div>
          </div>

          {/* Snapshot grid */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Revenue', value: brief.snapshot.revenue, icon: TrendingUp },
              { label: 'Cash Position', value: brief.snapshot.cashPosition, icon: Wallet },
              { label: 'Receivables', value: brief.snapshot.receivables, icon: IndianRupee },
              { label: 'Payables', value: brief.snapshot.payables, icon: CreditCard },
              { label: 'GST Liability', value: brief.snapshot.gstLiability, icon: FileText },
              { label: 'ITC Available', value: brief.snapshot.itcAvailable, icon: CheckCircle2 },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{formatINR(s.value)}</p>
                </div>
              );
            })}
          </div>

          {/* Priority actions */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 accent-text" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Priority Actions</h3>
            </div>
            {brief.priorityActions.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-center">
                <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
                <p className="text-xs text-foreground">You're all caught up. No priority actions today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {brief.priorityActions.map((action, i) => (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.1 + i * 0.05 }}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${urgencyStyles[action.urgency]}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{action.title}</p>
                        <span className={`shrink-0 text-[10px] font-bold ${urgencyColor[action.urgency]}`}>
                          {urgencyLabel[action.urgency]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{action.detail}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ─── Predictions Card (Module 2) ──────────────────────────────────────────────

function PredictionCard({ predictions, delay }: { predictions: CFOResponse['predictions']; delay: number }) {
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 accent-text" />
            Financial Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Revenue forecast */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue Forecast</span>
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300 text-[10px]">
                {predictions.revenue.confidencePct}% confidence
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: '7 Days', value: predictions.revenue.sevenDay },
                { label: '30 Days', value: predictions.revenue.thirtyDay },
                { label: '90 Days', value: predictions.revenue.ninetyDay },
                { label: 'Year End', value: predictions.revenue.yearEnd },
              ].map((r) => (
                <div key={r.label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</p>
                  <p className="text-sm font-bold text-foreground">{formatINR(r.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cash flow + GST + Collections */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cash Flow</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Daily</span><span className="font-medium text-foreground">{formatINR(predictions.cashFlow.dailyPosition)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly</span><span className="font-medium text-foreground">{formatINR(predictions.cashFlow.monthlyPosition)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Runway</span><span className="font-medium text-foreground">{predictions.cashFlow.runwayDays || '∞'} days</span></div>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">GST Forecast</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Liability</span><span className="font-medium text-foreground">{formatINR(predictions.gst.upcomingLiability)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ITC Use</span><span className="font-medium text-foreground">{predictions.gst.itcUtilization}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Refund</span><span className="font-medium text-foreground">{formatINR(predictions.gst.refundPrediction)}</span></div>
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Collections</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Expected</span><span className="font-medium text-foreground">{formatINR(predictions.collections.expectedCollections)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delays</span><span className="font-medium text-foreground">{predictions.collections.paymentDelays} clients</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risky</span><span className="font-medium text-foreground">{predictions.collections.riskyClients.length}</span></div>
              </div>
            </div>
          </div>

          {/* Risky clients */}
          {predictions.collections.riskyClients.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Risky Clients (top 5)</p>
              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                {predictions.collections.riskyClients.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{c.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{c.gstin}</p>
                    </div>
                    <div className="ml-2 text-right">
                      <p className="font-medium text-amber-300">{formatINR(c.outstanding)}</p>
                      <p className="text-[10px] text-muted-foreground">risk {c.riskScore}/100</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ─── Memory Section (Module 8) ────────────────────────────────────────────────

function MemoryCard({ memory, delay }: { memory: CFOResponse['memory']; delay: number }) {
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 accent-text" />
            CFO Memory
            <Badge variant="outline" className="ml-1 border-white/10 bg-white/[0.03] text-[10px]">
              <Clock className="h-3 w-3 mr-1" />
              Pattern recognition
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Insights */}
          {memory.insights.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Remembered Insights</p>
              <ul className="space-y-1.5">
                {memory.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                    <Sparkles className="h-3 w-3 mt-0.5 shrink-0 accent-text" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Client behaviour */}
          {memory.clientBehavior.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Client Payment Behaviour</p>
              <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                {memory.clientBehavior.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{c.clientName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.delays} delay(s) · avg {c.averageDelayDays}d late · {c.riskLabel}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 font-medium text-amber-300">{formatINR(c.totalOutstanding)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue trend mini-chart */}
          {memory.revenueTrends.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Revenue Trend (6 mo)</p>
              <div className="flex items-end gap-1.5 h-16">
                {memory.revenueTrends.map((r, i) => {
                  const max = Math.max(...memory.revenueTrends.map(t => t.value), 1);
                  const h = Math.max(4, (r.value / max) * 100);
                  const color = r.trend === 'up' ? '#10b981' : r.trend === 'down' ? '#ef4444' : '#06b6d4';
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.6, delay: delay + 0.1 + i * 0.05 }}
                        className="w-full rounded-t-sm"
                        style={{ background: color, minHeight: 4 }}
                      />
                      <span className="text-[9px] text-muted-foreground">{r.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filing history */}
          {memory.filingHistory.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Filing History (6 mo)</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {memory.filingHistory.map((f, i) => (
                  <div key={i} className="rounded-md border border-white/[0.04] bg-white/[0.01] p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">{f.period}</p>
                    <p className="text-xs font-bold text-emerald-400">{f.filed}</p>
                    {f.overdue > 0 && <p className="text-[9px] text-red-400">{f.overdue} overdue</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function CFOSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AICFODashboardPage() {
  const { user } = useAuth();
  const { setCurrentView } = useApp();
  const { toast } = useToast();
  const [data, setData] = useState<CFOResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/ai-cfo', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CFOResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CFO insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRecommendationAction = useCallback((rec: CFORecommendation) => {
    // Open Oracle with the recommendation context
    const prompt = `As my CFO, help me execute this recommendation:\n\n${rec.title}: ${rec.headline}\n\n${rec.description}\n\nActions:\n${rec.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
    window.dispatchEvent(new CustomEvent('oracle-ask', { detail: prompt }));
    toast({
      title: 'Oracle engaged',
      description: `Opening Oracle to execute: ${rec.title}`,
    });
  }, [toast]);

  const animatedOverall = useAnimatedNumber(data?.dashboard.healthScore.overall || 0);

  if (loading) return <CFOSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <Card className="max-w-md border-white/[0.06] bg-card/60">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium text-foreground">Couldn't load CFO insights</p>
            <p className="mt-1 text-xs text-muted-foreground">{error || 'Unknown error'}</p>
            <Button onClick={fetchData} variant="outline" className="mt-4 border-white/10 bg-white/[0.03]">
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24 sm:p-6">
      {/* ═══ HEADER ═══ */}
      <FadeIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient shadow-lg shadow-emerald-500/20">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  GSTPilot AI CFO<span className="accent-text">™</span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Understand Your Business · Predict Your Future · Recommend Your Next Move
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              disabled={refreshing}
              className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('oracle-ask', { detail: 'Act as my CFO. Give me a quick read on my business.' }))}
              className="accent-gradient text-white hover:opacity-90"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-2" />
              Ask CFO
            </Button>
          </div>
        </div>
        {data.generatedAt && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Last updated {timeAgo(data.generatedAt)} · {data.clientCount} clients analysed · {data.hasLiveData ? 'Live data' : 'Limited data — connect sources for full insights'}
          </p>
        )}
      </FadeIn>

      {/* ═══ PHASE 1 — FINANCIAL INTELLIGENCE ENGINE ═══ */}
      {/* New Phase 1 sections: Executive Summary, Real Health Score (0-100),
          Revenue Analytics, Profitability, Cash Flow, Working Capital, Expense
          Engine, Collection Engine, GST & ITC Position, Forecast Engine,
          Business Risk Engine (with Critical severity), AI Recommendations
          (with Reason/Impact/Priority/Confidence).
          Additive — does NOT modify or replace any existing Phase 3 module. */}
      <AICFOPhase1Sections />

      {/* ═══ MODULE 4: DAILY CFO BRIEF ═══ */}
      <DailyBriefCard brief={data.brief} delay={0.05} />

      {/* ═══ MODULE 1: CFO DASHBOARD CARDS ═══ */}
      <div>
        <SectionHeader
          icon={Activity}
          title="CFO Dashboard"
          subtitle="Real-time financial snapshot"
          action={<Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300">Live</Badge>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={TrendingUp}
            label="Revenue"
            primary={formatINR(data.dashboard.revenue.thisMonth)}
            secondary="This month"
            trend={{ value: data.dashboard.revenue.growthPct, label: 'vs last month' }}
            sparkData={data.dashboard.revenue.sparkline}
            sparkColor="#10b981"
            rows={[
              { label: 'Today', value: formatINRFull(data.dashboard.revenue.today) },
              { label: 'Last Month', value: formatINRFull(data.dashboard.revenue.lastMonth) },
            ]}
            delay={0.1}
          />
          <MetricCard
            icon={IndianRupee}
            label="Profit"
            primary={formatINR(data.dashboard.profit.netProfit)}
            secondary={`Net margin ${data.dashboard.profit.marginPct}%`}
            rows={[
              { label: 'Gross Profit', value: formatINRFull(data.dashboard.profit.grossProfit) },
              { label: 'Gross Margin', value: `${data.dashboard.profit.grossMarginPct}%` },
            ]}
            delay={0.15}
          />
          <MetricCard
            icon={Wallet}
            label="Cash Position"
            primary={formatINR(data.dashboard.cash.currentBalance)}
            secondary={data.dashboard.cash.runwayDays > 0 ? `${data.dashboard.cash.runwayDays} days runway` : 'Healthy balance'}
            rows={[
              { label: 'Available Cash', value: formatINRFull(data.dashboard.cash.availableCash) },
              { label: 'Daily Burn', value: formatINRFull(data.dashboard.cash.burnRatePerDay) },
            ]}
            delay={0.2}
          />
          <MetricCard
            icon={CreditCard}
            label="Receivables"
            primary={formatINR(data.dashboard.receivables.pendingCollections)}
            secondary={`${data.dashboard.receivables.overdueCount} overdue invoice(s)`}
            rows={[
              { label: 'Overdue', value: formatINRFull(data.dashboard.receivables.overdueCollections) },
              { label: 'Efficiency', value: `${data.dashboard.receivables.collectionEfficiencyPct}%` },
            ]}
            delay={0.25}
          />
          <MetricCard
            icon={FileText}
            label="Payables"
            primary={formatINR(data.dashboard.payables.upcomingPayments)}
            secondary="Next 30 days"
            rows={[
              { label: 'Vendor Dues', value: formatINRFull(data.dashboard.payables.vendorDues) },
              { label: 'Upcoming', value: `${data.dashboard.payables.upcomingCount} payments` },
            ]}
            delay={0.3}
          />
          <MetricCard
            icon={CheckCircle2}
            label="GST"
            primary={formatINR(data.dashboard.gst.liability)}
            secondary={`ITC available: ${formatINR(data.dashboard.gst.itcAvailable)}`}
            rows={data.dashboard.gst.upcomingDueDates.slice(0, 3).map(d => ({
              label: `${d.returnType} · ${d.period}`,
              value: d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`,
            }))}
            delay={0.35}
          />
        </div>
      </div>

      {/* ═══ MODULE 1 (cont): BUSINESS HEALTH SCORE ═══ */}
      <div>
        <SectionHeader icon={Target} title="Business Health Score" subtitle="Composite of 6 dimensions" />
        <FadeIn delay={0.4}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                <HealthGauge score={Math.round(animatedOverall)} />
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Compliance', value: data.dashboard.healthScore.compliance, icon: CheckCircle2 },
                    { label: 'Cash Flow', value: data.dashboard.healthScore.cashFlow, icon: Wallet },
                    { label: 'Growth', value: data.dashboard.healthScore.growth, icon: TrendingUp },
                    { label: 'Profitability', value: data.dashboard.healthScore.profitability, icon: IndianRupee },
                    { label: 'Risk', value: data.dashboard.healthScore.risk, icon: ShieldAlert },
                    { label: 'Collections', value: data.dashboard.healthScore.collections, icon: CreditCard },
                  ].map((s) => {
                    const Icon = s.icon;
                    const color = s.value >= 80 ? 'text-emerald-400' : s.value >= 60 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <Icon className={`h-3 w-3 ${color}`} />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                        </div>
                        <p className={`text-xl font-bold ${color}`}>{s.value}</p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${s.value}%` }}
                            transition={{ duration: 0.8, delay: 0.5 }}
                            className={`h-full rounded-full ${s.value >= 80 ? 'bg-emerald-500' : s.value >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ MODULE 2: PREDICTIONS ═══ */}
      <div>
        <SectionHeader
          icon={Brain}
          title="Financial Prediction Engine"
          subtitle="Forecasts with confidence intervals"
        />
        <PredictionCard predictions={data.predictions} delay={0.45} />
      </div>

      {/* ═══ MODULE 3: RISK ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={ShieldAlert}
          title="Business Risk Engine"
          subtitle="Calculated risks with explanations"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.risks.map((risk, i) => (
            <RiskCard key={risk.category} risk={risk} delay={0.5 + i * 0.05} />
          ))}
        </div>
      </div>

      {/* ═══ MODULE 6: RECOMMENDATIONS ═══ */}
      {data.recommendations.length > 0 && (
        <div>
          <SectionHeader
            icon={Lightbulb}
            title="CFO Recommendations"
            subtitle="Continuous AI-generated actions"
            action={<Badge variant="outline" className="border-white/10 bg-white/[0.03]">{data.recommendations.length} active</Badge>}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.recommendations.map((rec, i) => (
              <RecommendationCard key={rec.id} rec={rec} delay={0.55 + i * 0.05} onAction={handleRecommendationAction} />
            ))}
          </div>
        </div>
      )}

      {/* ═══ MODULE 7: ACTION ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={Zap}
          title="Action Engine"
          subtitle="Execute directly from recommendations"
        />
        <FadeIn delay={0.6}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <ActionEngine onNavigate={setCurrentView} />
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* ═══ MODULE 8: CFO MEMORY ═══ */}
      <div>
        <SectionHeader
          icon={Brain}
          title="CFO Memory"
          subtitle="Long-term patterns and client behaviour"
        />
        <MemoryCard memory={data.memory} delay={0.65} />
      </div>

      {/* ═══ FOOTER ═══ */}
      <FadeIn delay={0.7}>
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-cyan-500/[0.04] p-5 text-center">
          <p className="text-sm font-medium text-foreground">
            GSTPilot AI CFO<span className="accent-text">™</span> — Always Watching. Always Predicting. Always Advising.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Understand Your Business · Predict Your Future · Recommend Your Next Move · Run Your Business
          </p>
          <p className="mt-2 text-xs font-medium accent-text">
            Phase 1 — Every business deserves a world-class CFO.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            Founded &amp; developed by Prince Singh
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
