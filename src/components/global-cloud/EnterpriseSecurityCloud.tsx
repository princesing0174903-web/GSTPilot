'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 13
// ENTERPRISE SECURITY CLOUD™
//
//   Zero Trust · Encryption · Threat Detection · Audit · 8 Compliance Certs
//
// Defense-in-depth posture with 170 controls, AI-powered threat detection,
// 8.4K threats blocked every 24 hours, weighted-avg posture 96.6%, and 8
// industry compliance certifications (SOC 2, ISO 27001, PCI DSS, GDPR, HIPAA,
// FedRAMP, ISO 27018, IRIS).
//
// All data sourced deterministically from src/lib/global-cloud/data.ts —
// no fetch, no Math.random, no Date.now side-effects.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowUpRight, ShieldCheck, ShieldAlert, ShieldX, Lock, KeyRound,
  Activity, FileCheck, Award, AlertTriangle, Flame, Eye, Fingerprint, Server,
  Globe2, ScanLine, Clock, TrendingUp, Bot, Zap, MapPin, Network as NetworkIcon,
  Cpu, Banknote, FileLock2, UserCog, BadgeCheck, type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  SECURITY_CONTROLS, THREAT_EVENTS, AUDIT_LOGS, COMPLIANCE_CERTS,
  ACCENT_CLASSES, ACCENT_HEX, type Accent,
} from '@/lib/global-cloud/data';
import type { ThreatEvent } from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Severity styling map ─────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<
  ThreatEvent['severity'],
  { label: string; chip: string; dot: string; hex: string; bar: string }
> = {
  critical: {
    label: 'Critical', chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-500', hex: ACCENT_HEX.rose, bar: 'bg-rose-500',
  },
  high: {
    label: 'High', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-500', hex: ACCENT_HEX.amber, bar: 'bg-amber-500',
  },
  medium: {
    label: 'Medium', chip: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    dot: 'bg-teal-500', hex: ACCENT_HEX.teal, bar: 'bg-teal-500',
  },
  low: {
    label: 'Low', chip: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
    dot: 'bg-zinc-500', hex: '#a1a1aa', bar: 'bg-zinc-500',
  },
};

// ─── Score color tiers ────────────────────────────────────────────────────────
function scoreTier(score: number): { color: string; bar: string; text: string; ring: string; label: string } {
  if (score >= 95) return { color: ACCENT_HEX.emerald, bar: 'bg-emerald-500', text: 'text-emerald-300', ring: 'ring-emerald-500/30', label: 'Excellent' };
  if (score >= 90) return { color: ACCENT_HEX.teal,    bar: 'bg-teal-500',    text: 'text-teal-300',    ring: 'ring-teal-500/30',    label: 'Strong'    };
  if (score >= 85) return { color: ACCENT_HEX.amber,   bar: 'bg-amber-500',   text: 'text-amber-300',   ring: 'ring-amber-500/30',   label: 'Fair'      };
  return                { color: ACCENT_HEX.rose,     bar: 'bg-rose-500',    text: 'text-rose-300',    ring: 'ring-rose-500/30',    label: 'At Risk'   };
}

// ─── Result badge styling (audit log) ─────────────────────────────────────────
const RESULT_STYLES: Record<'success' | 'denied' | 'warning', { chip: string; dot: string; icon: LucideIcon }> = {
  success: { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-500', icon: ShieldCheck },
  denied:  { chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',          dot: 'bg-rose-500',    icon: ShieldX     },
  warning: { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',       dot: 'bg-amber-500',   icon: AlertTriangle },
};

// ─── Compliance status styling ────────────────────────────────────────────────
const CERT_STATUS_STYLES: Record<'certified' | 'in-progress' | 'planned', { chip: string; dot: string; icon: LucideIcon }> = {
  'certified':   { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-500', icon: BadgeCheck },
  'in-progress': { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',       dot: 'bg-amber-500',   icon: Clock      },
  'planned':     { chip: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',          dot: 'bg-zinc-500',    icon: Clock      },
};

// ─── Header KPI tiles ─────────────────────────────────────────────────────────
const HEADER_KPIS: { label: string; value: string; sub: string; icon: LucideIcon; accent: Accent }[] = [
  { label: 'Security Controls',  value: '170',     sub: '8 categories · 100% passing', icon: ShieldCheck, accent: 'emerald' },
  { label: 'Threats Blocked / 24h', value: '8.4K', sub: '99.7% auto-mitigated',         icon: ShieldAlert, accent: 'rose'    },
  { label: 'Posture Score',      value: '96.6%',   sub: 'Weighted avg across 170 controls', icon: Activity, accent: 'teal' },
  { label: 'Compliance Certs',   value: '8',       sub: 'SOC2 · ISO · PCI · GDPR · HIPAA', icon: Award,    accent: 'violet'  },
];

// ─── Threat map dot layout (deterministic) ────────────────────────────────────
// 12-col x 6-row grid. `T` = threat source, otherwise neutral dot.
const THREAT_MAP_GRID: string[][] = [
  ['.', '.', '.', 'T', '.', '.', '.', '.', '.', '.', '.', '.'],
  ['.', 'T', '.', '.', '.', '.', '.', '.', 'T', '.', '.', '.'],
  ['.', '.', '.', '.', '.', '.', 'T', '.', '.', '.', 'T', '.'],
  ['.', 'T', '.', '.', '.', '.', '.', '.', '.', 'T', '.', '.'],
  ['.', '.', '.', '.', 'T', '.', '.', '.', '.', '.', '.', 'T'],
  ['.', '.', '.', 'T', '.', '.', '.', '.', 'T', '.', '.', '.'],
];

const THREAT_LOCATIONS = [
  { city: 'Moscow',       ip: '45.83.12.4',    count: '1,840' },
  { city: 'Lagos',        ip: '102.89.45.12',  count: '1,240' },
  { city: 'São Paulo',    ip: '177.84.12.4',   count:   '980' },
  { city: 'Jakarta',      ip: '103.84.12.4',   count:   '640' },
  { city: 'Karachi',      ip: '119.155.12.4',  count:   '520' },
  { city: 'Manila',       ip: '112.198.45.18', count:   '420' },
  { city: 'Cairo',        ip: '156.198.45.18', count:   '380' },
  { city: 'Dhaka',        ip: '37.111.45.18',  count:   '320' },
];

// ─── Compliance cert icon resolver ────────────────────────────────────────────
const CERT_ICONS: Record<string, LucideIcon> = {
  'SOC 2 Type II':          FileCheck,
  'ISO 27001:2022':         FileLock2,
  'PCI DSS Level 1':        Banknote,
  'GDPR':                   Globe2,
  'HIPAA':                  UserCog,
  'FedRAMP Moderate':       Server,
  'ISO 27018 (PII)':        KeyRound,
  'IRIS (GST System)':      BadgeCheck,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function EnterpriseSecurityCloud() {
  const { setCurrentView } = useApp();

  // ─── Active threat filter ──────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<'all' | ThreatEvent['severity']>('all');

  // ─── Compute weighted posture score ────────────────────────────────────────
  const weightedScore = useMemo(() => {
    const totalControls = SECURITY_CONTROLS.reduce((s, c) => s + c.controls, 0);
    const totalPassing = SECURITY_CONTROLS.reduce(
      (s, c) => s + c.controls * c.score, 0,
    );
    return totalControls > 0 ? Math.round((totalPassing / totalControls) * 10) / 10 : 0;
  }, []);

  const totalControls = SECURITY_CONTROLS.reduce((s, c) => s + c.controls, 0);
  const totalPassing  = SECURITY_CONTROLS.reduce((s, c) => s + c.passing, 0);
  const certifiedCerts = COMPLIANCE_CERTS.filter(c => c.status === 'certified').length;

  // ─── Filtered threat events ────────────────────────────────────────────────
  const filteredThreats = useMemo(() => {
    if (activeFilter === 'all') return THREAT_EVENTS;
    return THREAT_EVENTS.filter(t => t.severity === activeFilter);
  }, [activeFilter]);

  const FILTERS: { id: 'all' | ThreatEvent['severity']; label: string; count: number }[] = [
    { id: 'all',      label: 'All',      count: THREAT_EVENTS.length },
    { id: 'critical', label: 'Critical', count: THREAT_EVENTS.filter(t => t.severity === 'critical').length },
    { id: 'high',     label: 'High',     count: THREAT_EVENTS.filter(t => t.severity === 'high').length },
    { id: 'medium',   label: 'Medium',   count: THREAT_EVENTS.filter(t => t.severity === 'medium').length },
    { id: 'low',      label: 'Low',      count: THREAT_EVENTS.filter(t => t.severity === 'low').length },
  ];

  const postureGrade = weightedScore >= 95 ? 'A+'
    : weightedScore >= 90 ? 'A'
    : weightedScore >= 85 ? 'B+'
    : weightedScore >= 80 ? 'B' : 'C';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ═════════════════════ HEADER ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 -z-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView('global-financial-cloud')}
                className="border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:text-white"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Hub
              </Button>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <ShieldCheck className="mr-1.5 h-3 w-3" />
                Phase 16 · Module 13
              </Badge>
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                AI Threat Detection Live
              </Badge>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise Security
              <span className="ml-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-rose-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 text-sm text-white/60 sm:text-base">
              Zero Trust · Encryption · Threat Detection · Audit · 8 Compliance Certs
            </p>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HEADER_KPIS.map((k, i) => {
                const a = ACCENT_CLASSES[k.accent];
                const Icon = k.icon;
                return (
                  <motion.div
                    key={k.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                    className={cn('rounded-2xl border p-4', a.border, a.bg)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        {k.label}
                      </div>
                      <Icon className={cn('h-4 w-4', a.text)} />
                    </div>
                    <div className={cn('mt-1 text-2xl font-bold sm:text-3xl', a.text)}>
                      {k.value}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40">{k.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ═════════════════════ POSTURE HERO ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-white">
                    Overall Security Posture
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Weighted average across all 170 controls · last full scan 2025-10-14 04:12 IST
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    A+ Posture
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/60">
                    <ScanLine className="mr-1.5 h-3 w-3" />
                    Next scan in 6h
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Circular gauge */}
                <div className="flex items-center justify-center">
                  <div className="relative h-56 w-56">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(from -90deg, ${ACCENT_HEX.emerald} 0% ${weightedScore}%, rgba(255,255,255,0.06) ${weightedScore}% 100%)`,
                      }}
                    />
                    <div className="absolute inset-3 rounded-full bg-black/80 backdrop-blur-sm" />
                    <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                        Posture Score
                      </div>
                      <div className="mt-1 text-5xl font-bold text-emerald-300">
                        {weightedScore.toFixed(1)}%
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        {totalPassing} / {totalControls} controls passing
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grade + scan details */}
                <div className="lg:col-span-2">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Grade</div>
                      <div className="mt-1 bg-gradient-to-br from-emerald-300 to-teal-300 bg-clip-text text-4xl font-bold text-transparent">
                        {postureGrade}
                      </div>
                      <div className="mt-1 text-[10px] text-white/40">Industry top tier</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Critical CVEs</div>
                      <div className="mt-1 text-4xl font-bold text-emerald-300">0</div>
                      <div className="mt-1 text-[10px] text-white/40">Patch SLA met 100%</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">MFA Coverage</div>
                      <div className="mt-1 text-4xl font-bold text-teal-300">100%</div>
                      <div className="mt-1 text-[10px] text-white/40">12.4K users enrolled</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Zero-Trust Score</div>
                      <div className="mt-1 text-4xl font-bold text-violet-300">100%</div>
                      <div className="mt-1 text-[10px] text-white/40">24/24 controls passing</div>
                    </div>
                  </div>

                  <Separator className="my-4 bg-white/[0.06]" />

                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Last Full Scan</div>
                      <div className="mt-1 font-mono text-xs text-white/80">2025-10-14 04:12</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Next Scan</div>
                      <div className="mt-1 font-mono text-xs text-white/80">2025-10-14 10:12</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Scan Frequency</div>
                      <div className="mt-1 font-mono text-xs text-white/80">Every 6 hours</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/50">Scan Engine</div>
                      <div className="mt-1 font-mono text-xs text-white/80">Sentinel-AI v4.2</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <p className="text-xs leading-relaxed text-white/70">
                      <span className="font-medium text-emerald-300">Sentinel-AI autonomous mitigation:</span>{' '}
                      Of the 8,420 threats detected in the last 24h, 99.7% were auto-mitigated without human
                      intervention. Mean time to detect: <span className="font-mono text-white/90">3.4s</span>{' '}
                      · Mean time to block: <span className="font-mono text-white/90">0.8s</span>.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ SECURITY CONTROLS SCORECARD ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Security Controls Scorecard</h2>
              <p className="text-xs text-white/50">8 control categories · {totalControls} controls · {totalPassing} passing</p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/60">
              <ShieldCheck className="mr-1.5 h-3 w-3" />
              {totalPassing} / {totalControls} passing
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY_CONTROLS.map((c, i) => {
              const a = ACCENT_CLASSES[c.accent];
              const tier = scoreTier(c.score);
              const Icon = c.category.includes('Zero Trust') ? ShieldCheck
                : c.category.includes('Encryption') ? Lock
                : c.category.includes('API') ? NetworkIcon
                : c.category.includes('Secrets') ? KeyRound
                : c.category.includes('Rate') ? Zap
                : c.category.includes('Threat') ? Eye
                : c.category.includes('Audit') ? FileCheck
                : Fingerprint;
              return (
                <motion.div
                  key={c.category}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 + i * 0.03 }}
                >
                  <Card className={cn('h-full border bg-white/[0.02] transition-colors hover:bg-white/[0.04]', a.border)}>
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', a.border, a.bg)}>
                          <Icon className={cn('h-5 w-5', a.text)} />
                        </div>
                        <div className="text-right">
                          <div className={cn('text-2xl font-bold leading-none', tier.text)}>
                            {c.score}%
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/40">{tier.label}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium leading-tight text-white">
                          {c.category}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/50">
                          {c.passing} / {c.controls} controls passing
                        </div>
                      </div>
                      {/* Score bar */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={cn('h-full rounded-full transition-all', tier.bar)}
                          style={{ width: `${c.score}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-white/40">
                        <span className="font-mono">{c.controls - c.passing} failing</span>
                        <span className="flex items-center gap-1">
                          <span className={cn('inline-block h-1.5 w-1.5 rounded-full', c.passing === c.controls ? 'bg-emerald-500' : 'bg-amber-500')} />
                          {c.passing === c.controls ? 'All passing' : 'Review needed'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═════════════════════ THREAT EVENTS + THREAT MAP ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          {/* Threat Events feed */}
          <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <ShieldAlert className="h-4 w-4 text-rose-300" />
                    Threat Events Feed
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Live AI-mitigated security events · {filteredThreats.length} shown
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                  Live
                </Badge>
              </div>

              {/* Filter chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTERS.map(f => {
                  const isActive = activeFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        isActive
                          ? 'border-white/20 bg-white/10 text-white'
                          : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white/80',
                      )}
                    >
                      {f.label}
                      <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]', isActive ? 'bg-white/15' : 'bg-white/[0.05]')}>
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 pr-3">
                <div className="space-y-2">
                  {filteredThreats.map((t, i) => {
                    const s = SEVERITY_STYLES[t.severity];
                    return (
                      <div
                        key={`${t.type}-${i}`}
                        className="relative flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
                      >
                        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', s.chip)}>
                          <Flame className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-white">{t.type}</span>
                            <Badge variant="outline" className={cn('border px-1.5 py-0 text-[10px]', s.chip)}>
                              {s.label}
                            </Badge>
                            {t.blocked ? (
                              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-300">
                                <ShieldCheck className="mr-1 h-3 w-3" />
                                Blocked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 px-1.5 py-0 text-[10px] text-rose-300">
                                <ShieldX className="mr-1 h-3 w-3" />
                                Escalated
                              </Badge>
                            )}
                            <span className="ml-auto text-[10px] text-white/40">{t.time}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-white/50">
                            <span>
                              <span className="text-white/30">src</span>{' '}
                              <span className="text-amber-300/80">{t.source}</span>
                            </span>
                            <span className="text-white/20">→</span>
                            <span>
                              <span className="text-white/30">dst</span>{' '}
                              <span className="text-cyan-300/80">{t.target}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredThreats.length === 0 && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-white/50">
                      No threats match this filter.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Threat map */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Globe2 className="h-4 w-4 text-rose-300" />
                Threat Source Map
              </CardTitle>
              <CardDescription className="text-xs text-white/50">
                Top 8 source regions · 6,420 attacks / 24h
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* World-grid approximation */}
              <div className="rounded-2xl border border-white/[0.06] bg-black/40 p-4">
                <div className="grid grid-cols-12 gap-1">
                  {THREAT_MAP_GRID.flat().map((cell, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'aspect-square rounded-full',
                        cell === 'T' ? 'bg-rose-500 shadow-[0_0_10px_-1px_rgba(244,63,94,0.7)]' : 'bg-white/[0.06]',
                      )}
                    />
                  ))}
                </div>
              </div>

              <Separator className="my-3 bg-white/[0.06]" />

              <div className="space-y-1.5">
                {THREAT_LOCATIONS.map((loc, i) => (
                  <div
                    key={loc.city}
                    className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-rose-300" />
                      <span className="text-xs text-white/80">{loc.city}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-white/40">{loc.ip}</span>
                      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 px-1.5 py-0 text-[10px] text-rose-300">
                        {loc.count}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ AUDIT LOGS ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base text-white">
                    <FileCheck className="h-4 w-4 text-teal-300" />
                    Immutable Audit Trail
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Tamper-evident append-only log · 7-year retention · cryptographically chained
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/60">
                  <Clock className="mr-1.5 h-3 w-3" />
                  Last 8 entries
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-white/50">Actor</TableHead>
                      <TableHead className="text-white/50">Action</TableHead>
                      <TableHead className="text-white/50">Resource</TableHead>
                      <TableHead className="text-white/50">IP</TableHead>
                      <TableHead className="text-white/50">Result</TableHead>
                      <TableHead className="text-right text-white/50">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {AUDIT_LOGS.map((log, i) => {
                      const r = RESULT_STYLES[log.result];
                      const RIcon = r.icon;
                      return (
                        <TableRow
                          key={i}
                          className="border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                        >
                          <TableCell className="font-mono text-xs text-white/80">
                            {log.actor}
                          </TableCell>
                          <TableCell className="text-xs text-white/80">
                            {log.action}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-cyan-300/80">
                            {log.resource}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-amber-300/80">
                            {log.ip}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', r.chip)}>
                              <RIcon className="mr-1 h-3 w-3" />
                              {log.result}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-[11px] text-white/40">
                            {log.time}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.section>

        {/* ═════════════════════ COMPLIANCE CERTIFICATIONS ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Compliance Certifications</h2>
              <p className="text-xs text-white/50">
                {certifiedCerts} of {COMPLIANCE_CERTS.length} certified · 1 in-progress · continuous monitoring
              </p>
            </div>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <Award className="mr-1.5 h-3 w-3" />
              {certifiedCerts} Certified
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COMPLIANCE_CERTS.map((c, i) => {
              const a = ACCENT_CLASSES[c.accent];
              const s = CERT_STATUS_STYLES[c.status];
              const Icon = CERT_ICONS[c.name] ?? Award;
              const SIcon = s.icon;
              return (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 + i * 0.03 }}
                >
                  <Card className={cn('h-full border bg-white/[0.02] transition-colors hover:bg-white/[0.04]', a.border)}>
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', a.border, a.bg)}>
                          <Icon className={cn('h-5 w-5', a.text)} />
                        </div>
                        <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', s.chip)}>
                          <SIcon className="mr-1 h-3 w-3" />
                          {c.status}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-sm font-semibold leading-tight text-white">
                          {c.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/50">
                          Standard: <span className="font-mono text-white/70">{c.standard}</span>
                        </div>
                      </div>
                      <Separator className="bg-white/[0.06]" />
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <div className="uppercase tracking-wider text-white/40">Last Audit</div>
                          <div className="mt-0.5 font-mono text-white/70">{c.lastAudit}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-wider text-white/40">Next Audit</div>
                          <div className="mt-0.5 font-mono text-white/70">{c.nextAudit}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ═════════════════════ BOTTOM CTA ═════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-teal-500/[0.03] to-transparent">
            <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <Cpu className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    Sentinel-AI is autonomously protecting your platform
                  </div>
                  <div className="mt-0.5 text-xs text-white/60">
                    8,420 threats blocked in the last 24 hours · 99.7% auto-mitigated · MTTR 0.8s
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentView('global-financial-cloud')}
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              >
                Back to Hub
                <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-[10px] text-white/30">
          <span className="font-mono">enterprise-security-cloud · module 13 · phase 16</span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            Posture trend: <span className="text-emerald-400">+1.4 pts MoM</span>
          </span>
        </div>
      </div>
    </div>
  );
}
