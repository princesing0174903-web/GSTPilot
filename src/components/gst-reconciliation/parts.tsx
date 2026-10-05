'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Reconciliation: shared UI parts
// ═══════════════════════════════════════════════════════════════════════════════
// ConfidenceBar, AISummaryCard, TimelineChart, VendorScoreboard,
// BulkActionsBar, AdvancedFilters, SummaryCard, MatchDistributionCard, ITCRiskCard
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, FileCheck2,
  Sparkles, Download, Mail, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
  Award, Users, Zap, FileText, ChevronDown, Filter, X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ─── Types (shared across the reconciliation UI) ─────────────────────────────

export type MatchStatus =
  | 'perfect_match' | 'value_mismatch' | 'tax_mismatch' | 'date_mismatch'
  | 'gstin_mismatch' | 'missing_in_books' | 'missing_in_gstr2b' | 'duplicate';

export interface RunSummary {
  id: string;
  gstin: string;
  period: string;
  gspProvider: string;
  status: string;
  totalBooks: number;
  total2B: number;
  matched: number;
  unmatched: number;
  missingInBooks: number;
  missingIn2B: number;
  duplicates: number;
  matchPercent: number;
  potentialITCLoss: number;
  totalTaxableValue: number;
  totalMatchedTax: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
}

export interface MismatchField {
  field: string;
  booksValue?: string | number;
  gstr2bValue?: string | number;
  delta?: number;
}

export interface ScoreBreakdown {
  gstin: number;
  invoiceNo: number;
  date: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface FixSuggestion {
  type: string;
  label: string;
  field: string;
  from: string;
  to: string;
  preview: string;
  severity: 'safe' | 'moderate' | 'risky';
  canAutoApply: boolean;
  itcImpact?: number;
}

export interface AISuggestion {
  key: string;
  label: string;
  reason: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  estimatedResolutionDays: number;
  icon: string;
}

export interface AIReconciliationSummary {
  missingInvoices: number;
  duplicateInvoices: number;
  wrongGSTValues: number;
  dateMismatches: number;
  gstinMismatches: number;
  estimatedITCBlocked: number;
  expectedRecovery: number;
  safeITC: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  avgConfidence: number;
  matchPercent: number;
  executiveSummary: string;
  topIssues: Array<{ label: string; count: number; itcAtRisk: number; recommendation: string }>;
  actionItems: string[];
  generatedAt: string;
}

export interface VendorScore {
  gstin: string;
  name: string | null;
  score: number;
  reasons: string[];
  invoiceCount: number;
  matched: number;
  mismatched: number;
  missingIn2B: number;
  missingInBooks: number;
  duplicates: number;
  totalITCAtRisk: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining' | 'new';
}

export interface TimelineEntry {
  period: string;
  periodLabel: string;
  runId: string | null;
  matchPercent: number;
  potentialITCLoss: number;
  totalBooks: number;
  total2B: number;
  status: 'completed' | 'pending' | 'running';
  ranAt: string | null;
}

export interface MatchRow {
  id: string;
  status: MatchStatus;
  confidence: number;
  booksInvoiceId: string | null;
  booksInvoiceNo: string | null;
  booksInvoiceDate: string | null;
  booksSupplierGSTIN: string | null;
  booksTaxableValue: number;
  booksCGST: number;
  booksSGST: number;
  booksIGST: number;
  booksCESS: number;
  booksTotal: number;
  gstr2bInvoiceNo: string | null;
  gstr2bInvoiceDate: string | null;
  gstr2bSupplierGSTIN: string | null;
  gstr2bTaxableValue: number;
  gstr2bCGST: number;
  gstr2bSGST: number;
  gstr2bIGST: number;
  gstr2bCESS: number;
  gstr2bTotal: number;
  mismatchReasons: MismatchField[];
  scoreBreakdown?: ScoreBreakdown;
  fixSuggestions: FixSuggestion[] | null;
  itcAtRisk: number;
  aiExplanation: string | null;
  aiRecommendation: string | null;
  aiSuggestion: string | null;
  resolved: boolean;
  fixApplied: boolean;
}

// ─── Status metadata ─────────────────────────────────────────────────────────

export const STATUS_META: Record<MatchStatus, { label: string; color: string; icon: typeof ShieldCheck }> = {
  perfect_match: { label: 'Perfect Match', color: 'success', icon: CheckCircle2 },
  value_mismatch: { label: 'Value Mismatch', color: 'warning', icon: TrendingDown },
  tax_mismatch: { label: 'Tax Mismatch', color: 'warning', icon: AlertTriangle },
  date_mismatch: { label: 'Date Mismatch', color: 'info', icon: Clock },
  gstin_mismatch: { label: 'GSTIN Mismatch', color: 'danger', icon: AlertTriangle },
  missing_in_books: { label: 'Missing in Books', color: 'danger', icon: FileText },
  missing_in_gstr2b: { label: 'Missing in 2B', color: 'danger', icon: FileText },
  duplicate: { label: 'Duplicate', color: 'info', icon: FileCheck2 },
};

export function fmtINR(n: number | null | undefined): string {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function fmtRelative(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Confidence helpers ──────────────────────────────────────────────────────

export type ConfidenceBand = 'high' | 'medium' | 'low' | 'none';

export function confidenceBand(c: number): ConfidenceBand {
  if (c <= 0) return 'none';
  if (c >= 0.85) return 'high';
  if (c >= 0.6) return 'medium';
  return 'low';
}

export function confidenceColor(c: number): string {
  if (c <= 0) return '#64748B'; // gray — no confidence (missing/duplicate)
  if (c >= 0.85) return '#3B82F6'; // blue — high confidence
  if (c >= 0.6) return '#F59E0B'; // yellow
  return '#EF4444'; // red
}

export function confidenceLabel(c: number): string {
  if (c <= 0) return '—';
  return `${Math.round(c * 100)}% Match`;
}

// ─── ConfidenceBar ───────────────────────────────────────────────────────────

export function ConfidenceBar({ confidence, size = 'md' }: { confidence: number; size?: 'sm' | 'md' | 'lg' }) {
  const pct = Math.round(confidence * 100);
  const color = confidenceColor(confidence);
  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2.5' };
  const textSizes = { sm: 'text-[11px]', md: 'text-[11px]', lg: 'text-[11px]' };

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center justify-between ${textSizes[size]}`}>
        <span className="font-medium" style={{ color }}>{pct}%</span>
        <span className="text-muted-foreground">confidence</span>
      </div>
      <div className={`w-full ${heights[size]} overflow-hidden rounded-full bg-[#1F1F1F]`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────

export function SummaryCard({
  icon, label, value, tone, delay = 0,
}: { icon: React.ReactNode; label: string; value: string; tone: string; delay?: number }) {
  const toneColor: Record<string, string> = {
    success: 'text-[#3B82F6]',
    warning: 'text-[#F59E0B]',
    danger: 'text-[#EF4444]',
    info: 'text-[#60A5FA]',
    neutral: 'text-foreground',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="gst-card gst-card-compact relative overflow-hidden"
    >
      <div className="absolute right-0 top-0 h-16 w-16 rounded-full opacity-[0.04] blur-2xl" style={{ backgroundColor: 'currentColor' }} />
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={toneColor[tone]}>{icon}</span>
        <span className="gst-caption">{label}</span>
      </div>
      <div className={`gst-metric mt-2 ${toneColor[tone]}`}>{value}</div>
    </motion.div>
  );
}

// ─── AISummaryCard (CFO report) ──────────────────────────────────────────────

export function AISummaryCard({
  summary, runId, gstin, period, onPdf,
}: {
  summary: AIReconciliationSummary;
  runId: string;
  gstin: string;
  period: string;
  onPdf: () => void;
}) {
  const riskColor = {
    low: '#3B82F6',
    medium: '#F59E0B',
    high: '#EF4444',
    critical: '#DC2626',
  }[summary.riskLevel];

  const riskBg = {
    low: 'rgba(37,99,235,0.06)',
    medium: 'rgba(245,158,11,0.06)',
    high: 'rgba(239,68,68,0.06)',
    critical: 'rgba(220,38,38,0.08)',
  }[summary.riskLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="gst-card relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(239,68,68,0.02) 100%)',
      }}
    >
      {/* Glass effect top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3B82F6]/40 to-transparent" />

      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3B82F6]/10">
            <Sparkles className="h-5 w-5 text-[#60A5FA]" />
          </div>
          <div>
            <h3 className="gst-card-title">Oracle CFO™ Report</h3>
            <p className="gst-caption">AI-generated reconciliation summary</p>
          </div>
        </div>
        <button onClick={onPdf} className="gst-btn gst-btn-secondary gst-btn-sm">
          <FileText className="h-3.5 w-3.5" /> PDF
        </button>
      </div>

      {/* Executive narrative */}
      <div className="mb-4 rounded-xl border border-[#2A2E36] bg-[#0F1115]/60 p-4">
        <p className="text-sm leading-relaxed text-foreground">{summary.executiveSummary}</p>
      </div>

      {/* Big metric row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Missing Invoices" value={String(summary.missingInvoices)} tone="warning" />
        <MetricTile label="Duplicates" value={String(summary.duplicateInvoices)} tone="info" />
        <MetricTile label="Wrong GST Values" value={String(summary.wrongGSTValues)} tone="danger" />
        <MetricTile label="Avg Confidence" value={`${Math.round(summary.avgConfidence * 100)}%`} tone="success" />
      </div>

      {/* ITC financials + Risk */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/[0.04] p-4">
          <div className="gst-caption mb-1">Estimated ITC Blocked</div>
          <div className="gst-metric text-[#F87171]">{fmtINR(summary.estimatedITCBlocked)}</div>
        </div>
        <div className="rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/[0.04] p-4">
          <div className="gst-caption mb-1">Expected Recovery</div>
          <div className="gst-metric text-[#60A5FA]">{fmtINR(summary.expectedRecovery)}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: `${riskColor}33`, backgroundColor: riskBg }}>
          <div className="gst-caption mb-1">Risk Level</div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: riskColor }} />
            <span className="gst-metric capitalize" style={{ color: riskColor }}>{summary.riskLevel}</span>
            <Badge variant="outline" className="ml-auto text-[11px]" style={{ color: riskColor, borderColor: `${riskColor}44` }}>
              {summary.riskScore}/100
            </Badge>
          </div>
        </div>
      </div>

      {/* Top issues */}
      {summary.topIssues.length > 0 && (
        <div className="mt-4">
          <div className="gst-label mb-2">Top Issues</div>
          <div className="space-y-1.5">
            {summary.topIssues.slice(0, 3).map((issue, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[#2A2E36] bg-[#0F1115]/60 px-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-foreground">{issue.label}</div>
                  <div className="text-[11px] text-muted-foreground">{issue.recommendation}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">{issue.count} inv</div>
                  <div className="font-semibold text-[#F87171]">{fmtINR(issue.itcAtRisk)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneColor: Record<string, string> = {
    success: 'text-[#3B82F6]',
    warning: 'text-[#F59E0B]',
    danger: 'text-[#EF4444]',
    info: 'text-[#60A5FA]',
    neutral: 'text-foreground',
  };
  return (
    <div className="rounded-lg border border-[#2A2E36] bg-[#0F1115]/60 p-3">
      <div className="gst-caption mb-1">{label}</div>
      <div className={`text-xl font-bold ${toneColor[tone]}`}>{value}</div>
    </div>
  );
}

// ─── TimelineChart (monthly trend) ───────────────────────────────────────────

export function TimelineChart({
  timeline, trend, avgMatchPercent,
}: {
  timeline: TimelineEntry[];
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  avgMatchPercent: number;
}) {
  const completed = timeline.filter((t) => t.status === 'completed');
  if (completed.length === 0) {
    return (
      <div className="gst-card flex h-full items-center justify-center p-8 text-center">
        <div>
          <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="gst-caption">Run your first reconciliation to start the trend</p>
        </div>
      </div>
    );
  }

  const max = 100;
  const width = 100; // viewBox %
  const height = 100;
  const padding = 8;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const stepX = completed.length > 1 ? chartW / (completed.length - 1) : 0;

  // Build line path
  const points = completed.map((t, i) => ({
    x: padding + i * stepX,
    y: padding + chartH - (t.matchPercent / max) * chartH,
    t,
  }));

  const linePath = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padding + chartH} L ${points[0].x} ${padding + chartH} Z`
    : '';

  const trendIcon = trend === 'improving' ? <ArrowUpRight className="h-3.5 w-3.5 text-[#3B82F6]" />
    : trend === 'declining' ? <ArrowDownRight className="h-3.5 w-3.5 text-[#EF4444]" />
    : <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <div className="gst-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="gst-card-title">Reconciliation Timeline</h3>
          <p className="gst-caption">Monthly match-rate trend</p>
        </div>
        <div className="flex items-center gap-2">
          {trendIcon}
          <span className="text-xs capitalize text-muted-foreground">{trend.replace(/_/g, ' ')}</span>
          <Badge variant="outline" className="text-[11px]">avg {avgMatchPercent}%</Badge>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 160 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="timelineArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="timelineLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[25, 50, 75].map((p) => (
            <line
              key={p}
              x1={padding} y1={padding + chartH - (p / max) * chartH}
              x2={width - padding} y2={padding + chartH - (p / max) * chartH}
              stroke="#1F1F1F" strokeWidth="0.3" strokeDasharray="1 1"
            />
          ))}

          {/* Area */}
          {areaPath && <path d={areaPath} fill="url(#timelineArea)" />}

          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#timelineLine)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />

          {/* Points + labels */}
          {points.map((p, i) => (
            <g key={i}>
              <motion.circle
                cx={p.x} cy={p.y} r="1.8"
                fill={p.t.matchPercent >= 85 ? '#3B82F6' : p.t.matchPercent >= 60 ? '#F59E0B' : '#EF4444'}
                stroke="#0F1115" strokeWidth="0.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
              />
              <text x={p.x} y={padding + chartH + 5} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 3 }}>
                {p.t.periodLabel.split(' ')[0]}
              </text>
              <text x={p.x} y={p.y - 3} textAnchor="middle" className="fill-foreground" style={{ fontSize: 3.5, fontWeight: 600 }}>
                {p.t.matchPercent}%
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend / months row */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {timeline.map((t) => (
          <div
            key={t.period}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
              t.status === 'completed'
                ? 'border-[#2A2E36] bg-[#0F1115]'
                : 'border-dashed border-[#2A2E36] bg-transparent opacity-60'
            }`}
          >
            <span className="text-muted-foreground">{t.periodLabel}</span>
            {t.status === 'completed' ? (
              <span className={t.matchPercent >= 85 ? 'text-[#3B82F6]' : t.matchPercent >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}>
                {t.matchPercent}%
              </span>
            ) : (
              <span className="text-muted-foreground">pending</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VendorScoreboard ────────────────────────────────────────────────────────

export function VendorScoreboard({
  vendors, onSelectVendor, selectedGstin,
}: {
  vendors: VendorScore[];
  onSelectVendor: (gstin: string | null) => void;
  selectedGstin: string | null;
}) {
  if (vendors.length === 0) {
    return (
      <div className="gst-card flex h-full items-center justify-center p-8 text-center">
        <div>
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="gst-caption">No supplier data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gst-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="gst-card-title">Vendor Compliance Scoreboard</h3>
          <p className="gst-caption">Suppliers ranked by GST compliance (worst first)</p>
        </div>
        {selectedGstin && (
          <button
            onClick={() => onSelectVendor(null)}
            className="gst-btn gst-btn-ghost gst-btn-sm"
          >
            <X className="h-3 w-3" /> Clear filter
          </button>
        )}
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto custom-scrollbar pr-1">
        {vendors.map((v, i) => {
          const vColor = v.score >= 75 ? '#3B82F6' : v.score >= 50 ? '#F59E0B' : '#EF4444';
          const TrendIcon = v.trend === 'improving' ? ArrowUpRight : v.trend === 'declining' ? ArrowDownRight : null;
          const isSelected = selectedGstin === v.gstin;
          return (
            <motion.button
              key={v.gstin}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              onClick={() => onSelectVendor(isSelected ? null : v.gstin)}
              className={`w-full rounded-xl border p-3 text-left transition-all hover:scale-[1.01] ${
                isSelected
                  ? 'border-[#3B82F6] bg-[#3B82F6]/[0.06]'
                  : 'border-[#2A2E36] bg-[#0F1115] hover:border-[#3A3E46]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {v.name || 'Unknown Supplier'}
                    </span>
                    {TrendIcon && (
                      <span className={v.trend === 'improving' ? 'text-[#3B82F6]' : 'text-[#EF4444]'}>
                        <TrendIcon className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{v.gstin}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.reasons.slice(0, 2).map((r, ri) => (
                      <span
                        key={ri}
                        className="rounded-md border border-[#2A2E36] bg-[#171A21] px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" style={{ color: vColor }} />
                    <span className="text-lg font-bold" style={{ color: vColor }}>{v.score}%</span>
                  </div>
                  <Badge variant="outline" className="text-[11px]" style={{ color: vColor, borderColor: `${vColor}44` }}>
                    Grade {v.grade}
                  </Badge>
                  <div className="text-[11px] text-muted-foreground">{v.invoiceCount} inv · {fmtINR(v.totalITCAtRisk)}</div>
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#1F1F1F]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${v.score}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.03 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: vColor }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── BulkActionsBar ──────────────────────────────────────────────────────────

export function BulkActionsBar({
  selectedCount, onClear, onResolve, onReopen, onReview, onEmail, onExportCsv, onExportJson, busy,
}: {
  selectedCount: number;
  onClear: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onReview: () => void;
  onEmail: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  busy: boolean;
}) {
  if (selectedCount === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="gst-card flex flex-wrap items-center gap-2 border-[#3B82F6]/40 bg-[#3B82F6]/[0.04] !p-3"
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-[#3B82F6]/40 bg-[#3B82F6]/10 text-[#60A5FA]">
          {selectedCount} selected
        </Badge>
        <button onClick={onClear} className="gst-btn gst-btn-ghost gst-btn-sm">
          <X className="h-3 w-3" /> Clear
        </button>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button onClick={onResolve} disabled={busy} className="gst-btn gst-btn-primary gst-btn-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve Selected
        </button>
        <button onClick={onReopen} disabled={busy} className="gst-btn gst-btn-outline gst-btn-sm">
          <Clock className="h-3.5 w-3.5" /> Reopen
        </button>
        <button onClick={onReview} disabled={busy} className="gst-btn gst-btn-ghost gst-btn-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Reviewed
        </button>
        <button onClick={onEmail} disabled={busy} className="gst-btn gst-btn-secondary gst-btn-sm">
          <Mail className="h-3.5 w-3.5" /> Email Supplier
        </button>
        <div className="h-4 w-px bg-[#2A2E36]" />
        <button onClick={onExportCsv} disabled={busy} className="gst-btn gst-btn-secondary gst-btn-sm">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
        <button onClick={onExportJson} disabled={busy} className="gst-btn gst-btn-secondary gst-btn-sm">
          <Download className="h-3.5 w-3.5" /> JSON
        </button>
      </div>
    </motion.div>
  );
}

// ─── AdvancedFilters ─────────────────────────────────────────────────────────

export interface FilterState {
  status: string;
  resolved: string;
  search: string;
  vendor: string;
  minAmount: string;
  maxAmount: string;
  confidence: string;
}

export function AdvancedFilters({
  filters, onChange, vendorOptions,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  vendorOptions: Array<{ gstin: string; name: string | null }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAdvanced = filters.vendor || filters.minAmount || filters.maxAmount || filters.confidence;

  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search invoice / GSTIN..."
            className="h-9 w-full rounded-lg border border-[#2A2E36] bg-[#0F1115] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/40"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => update({ status: e.target.value })}
          className="h-9 rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3 text-sm text-foreground focus:border-[#2563EB] focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="perfect_match">Perfect Match</option>
          <option value="value_mismatch">Value Mismatch</option>
          <option value="tax_mismatch">Tax Mismatch</option>
          <option value="date_mismatch">Date Mismatch</option>
          <option value="gstin_mismatch">GSTIN Mismatch</option>
          <option value="missing_in_books">Missing in Books</option>
          <option value="missing_in_gstr2b">Missing in 2B</option>
          <option value="duplicate">Duplicate</option>
        </select>
        <select
          value={filters.resolved}
          onChange={(e) => update({ resolved: e.target.value })}
          className="h-9 rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3 text-sm text-foreground focus:border-[#2563EB] focus:outline-none"
        >
          <option value="all">All</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`gst-btn gst-btn-sm ${hasAdvanced || expanded ? 'gst-btn-primary' : 'gst-btn-secondary'}`}
        >
          <Filter className="h-3.5 w-3.5" /> Advanced
          {hasAdvanced && <Badge variant="outline" className="ml-1 bg-[#3B82F6]/20 text-[11px] text-white">{hasAdvanced ? '•' : ''}</Badge>}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="grid grid-cols-1 gap-2 rounded-lg border border-[#2A2E36] bg-[#0F1115] p-3 sm:grid-cols-4"
        >
          <div>
            <label className="gst-caption mb-1 block">Vendor (GSTIN)</label>
            <select
              value={filters.vendor}
              onChange={(e) => update({ vendor: e.target.value })}
              className="h-9 w-full rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-foreground focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Vendors</option>
              {vendorOptions.map((v) => (
                <option key={v.gstin} value={v.gstin}>
                  {v.name ? `${v.name} — ${v.gstin.slice(0, 10)}...` : v.gstin}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="gst-caption mb-1 block">Min Amount (₹)</label>
            <input
              type="number"
              value={filters.minAmount}
              onChange={(e) => update({ minAmount: e.target.value })}
              placeholder="0"
              className="h-9 w-full rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#2563EB] focus:outline-none"
            />
          </div>
          <div>
            <label className="gst-caption mb-1 block">Max Amount (₹)</label>
            <input
              type="number"
              value={filters.maxAmount}
              onChange={(e) => update({ maxAmount: e.target.value })}
              placeholder="1000000"
              className="h-9 w-full rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#2563EB] focus:outline-none"
            />
          </div>
          <div>
            <label className="gst-caption mb-1 block">Confidence</label>
            <select
              value={filters.confidence}
              onChange={(e) => update({ confidence: e.target.value })}
              className="h-9 w-full rounded-lg border border-[#2A2E36] bg-[#0A0A0A] px-3 text-sm text-foreground focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Confidence</option>
              <option value="high">High (≥85%)</option>
              <option value="medium">Medium (60-84%)</option>
              <option value="low">Low (&lt;60%)</option>
            </select>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── MatchDistributionCard ───────────────────────────────────────────────────

export function MatchDistributionCard({ summary }: { summary: RunSummary }) {
  const data = useMemo(() => [
    { label: 'Perfect Match', value: summary.matched, color: '#3B82F6' },
    { label: 'Mismatches', value: summary.unmatched, color: '#F59E0B' },
    { label: 'Missing in Books', value: summary.missingInBooks, color: '#EF4444' },
    { label: 'Missing in 2B', value: summary.missingIn2B, color: '#71717A' },
    { label: 'Duplicates', value: summary.duplicates, color: '#52525B' },
  ], [summary]);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="gst-card">
      <h3 className="gst-card-title mb-4">Match Distribution</h3>
      <div className="flex items-center gap-6">
        <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#1F1F1F" strokeWidth="16" />
          {data.map((d, i) => {
            const len = (d.value / total) * circumference;
            const dasharray = `${len} ${circumference - len}`;
            const dashoffset = -offset;
            offset += len;
            return (
              <motion.circle
                key={i}
                cx="80" cy="80" r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth="16"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                transform="rotate(-90 80 80)"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: dasharray }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
            );
          })}
          <text x="80" y="75" textAnchor="middle" className="fill-foreground" style={{ fontSize: 24, fontWeight: 700 }}>
            {summary.matchPercent}%
          </text>
          <text x="80" y="95" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
            match rate
          </text>
        </svg>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="flex-1 text-muted-foreground">{d.label}</span>
              <span className="font-medium tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ITCRiskCard ─────────────────────────────────────────────────────────────

export function ITCRiskCard({ summary }: { summary: RunSummary }) {
  const totalITC = summary.totalMatchedTax + summary.potentialITCLoss || 1;
  const safePct = (summary.totalMatchedTax / totalITC) * 100;
  const riskPct = (summary.potentialITCLoss / totalITC) * 100;

  return (
    <div className="gst-card">
      <h3 className="gst-card-title mb-4">ITC Position</h3>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Safe ITC (matched)</span>
            <span className="font-semibold text-[#60A5FA]">{fmtINR(summary.totalMatchedTax)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1F1F1F]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${safePct}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-[#3B82F6]"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ITC at Risk</span>
            <span className="font-semibold text-[#F87171]">{fmtINR(summary.potentialITCLoss)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1F1F1F]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${riskPct}%` }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="h-full bg-[#EF4444]"
            />
          </div>
        </div>
        <div className="rounded-lg border border-[#1F1F1F] bg-[#0F1115] p-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[#60A5FA]" />
            Total Taxable Value Reconciled
          </div>
          <div className="gst-metric mt-1">{fmtINR(summary.totalTaxableValue)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
