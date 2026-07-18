'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16: GLOBAL IDENTITY CLOUD
//
// Enterprise SSO · OAuth · SAML · MFA · Passwordless WebAuthn
//
// Unified identity console for the Global Financial Cloud™ — surfacing every
// SSO connection, MFA method, identity event, and passwordless enrollment path
// across 12.4K enterprise users.
// ═══════════════════════════════════════════════════════════════════════════════

import { Fragment, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Fingerprint, ShieldCheck, KeyRound, Check, ChevronDown,
  Smartphone, MessageSquare, Key, ScanFace, Mail, AlertTriangle, XCircle,
  CheckCircle2, Clock, Globe2, Sparkles, Lock, Zap, BadgeCheck, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  SSO_CONNECTIONS, MFA_METHODS, IDENTITY_EVENTS,
  ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Protocol badge colors ─────────────────────────────────────────────────────
const PROTOCOL_BADGE: Record<string, { accent: Accent; label: string }> = {
  'SAML 2.0': { accent: 'emerald', label: 'SAML' },
  'OIDC':     { accent: 'cyan',    label: 'OIDC' },
  'OAuth':    { accent: 'violet',  label: 'OAuth' },
  'LDAP':     { accent: 'amber',   label: 'LDAP' },
};

// ─── Status badge for identity events ──────────────────────────────────────────
const EVENT_STATUS: Record<string, { accent: Accent; icon: typeof CheckCircle2 }> = {
  success:   { accent: 'emerald', icon: CheckCircle2 },
  challenge: { accent: 'amber',   icon: AlertTriangle },
  denied:    { accent: 'rose',    icon: XCircle },
};

// ─── Identity event type iconography ───────────────────────────────────────────
const EVENT_TYPE_ICON: Record<string, typeof KeyRound> = {
  'SSO Login':         Globe2,
  'MFA Challenge':     ShieldCheck,
  'Passwordless':      Fingerprint,
  'Failed Login':      XCircle,
  'Suspicious Login':  AlertTriangle,
  'Hardware Key Used': Key,
};

// ─── Passwordless supported platforms ──────────────────────────────────────────
const PASSKEY_PLATFORMS = [
  { name: 'iOS Face ID',     icon: ScanFace,  accent: 'emerald' as Accent },
  { name: 'Android Biometric',icon: Fingerprint, accent: 'teal'    as Accent },
  { name: 'Windows Hello',   icon: ScanFace,  accent: 'cyan'    as Accent },
  { name: 'macOS Touch ID',  icon: Fingerprint, accent: 'violet'  as Accent },
  { name: 'YubiKey',         icon: Key,       accent: 'amber'   as Accent },
];

// ─── Header KPI tiles ──────────────────────────────────────────────────────────
const HEADER_KPIS = [
  { label: 'SSO Providers',  value: '6',     sub: 'SAML · OIDC · LDAP',     accent: 'emerald' as Accent },
  { label: 'MFA Methods',    value: '5',     sub: 'TOTP · SMS · WebAuthn',  accent: 'teal'    as Accent },
  { label: 'Total Users',    value: '12.4K', sub: 'Across 184K orgs',       accent: 'cyan'    as Accent },
  { label: 'MFA Adoption',   value: '99.8%', sub: '+0.4% vs last month',    accent: 'violet'  as Accent },
];

export default function GlobalIdentity() {
  const { setCurrentView } = useApp();
  const [expandedRow, setExpandedRow] = useState<number | null>(0);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);

  // ─── Compute protocol distribution for donut ────────────────────────────────
  const protocolBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    SSO_CONNECTIONS.forEach((c) => {
      const key = c.protocol === 'SAML 2.0' ? 'SAML' : c.protocol;
      totals[key] = (totals[key] ?? 0) + c.users;
    });
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    const order: { label: string; value: number; accent: Accent; hex: string }[] = [
      { label: 'SAML',  value: totals['SAML']  ?? 0, accent: 'emerald', hex: '#2563EB' },
      { label: 'OIDC',  value: totals['OIDC']  ?? 0, accent: 'cyan',    hex: '#3B82F6' },
      { label: 'LDAP',  value: totals['LDAP']  ?? 0, accent: 'amber',   hex: '#f59e0b' },
      { label: 'OAuth', value: totals['OAuth'] ?? 0, accent: 'violet',  hex: '#8b5cf6' },
    ];
    // Build conic gradient stops
    let acc = 0;
    const stops = order.map((o) => {
      const start = acc;
      acc += (o.value / total) * 100;
      return { ...o, start, end: acc, pct: (o.value / total) * 100 };
    });
    return { stops, total };
  }, []);

  const conicGradient = protocolBreakdown.stops
    .map((s) => `${s.hex} ${s.start}% ${s.end}%`)
    .join(', ');

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <Fingerprint className="mr-1.5 h-3 w-3" />
                    Phase 16 · Module 09
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                    <ShieldCheck className="mr-1.5 h-3 w-3" />
                    Zero Trust · FIDO2
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Global Identity Cloud
                  <span className="ml-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">™</span>
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  Enterprise SSO · OAuth · SAML · MFA · Passwordless WebAuthn
                </p>
              </div>
              <Button
                onClick={() => setCurrentView('global-financial-cloud')}
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/[0.02] text-white hover:bg-white/[0.06]"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Cloud Hub
              </Button>
            </div>

            {/* Header KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {HEADER_KPIS.map((kpi, i) => {
                const a = ACCENT_CLASSES[kpi.accent];
                return (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                    className={cn('rounded-2xl border p-4', a.border, a.bg)}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                      {kpi.label}
                    </div>
                    <div className={cn('mt-1 text-2xl font-bold', a.text)}>{kpi.value}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">{kpi.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ─── SSO CONNECTIONS TABLE ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <Globe2 className="h-4 w-4 text-emerald-300" />
                  SSO Connections
                  <span className="ml-1 text-xs font-normal text-white/40">
                    ({SSO_CONNECTIONS.length} providers · {fmtN(SSO_CONNECTIONS.reduce((a, c) => a + c.users, 0))} users)
                  </span>
                </CardTitle>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  All Verified
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="w-8 text-white/40" />
                    <TableHead className="text-white/50">Provider</TableHead>
                    <TableHead className="text-white/50">Protocol</TableHead>
                    <TableHead className="text-right text-white/50">Users</TableHead>
                    <TableHead className="text-white/50">Last Login</TableHead>
                    <TableHead className="text-center text-white/50">MFA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SSO_CONNECTIONS.map((c, idx) => {
                    const proto = PROTOCOL_BADGE[c.protocol] ?? { accent: 'emerald' as Accent, label: c.protocol };
                    const a = ACCENT_CLASSES[proto.accent];
                    const isExpanded = expandedRow === idx;
                    return (
                      <Fragment key={c.name}>
                        <TableRow
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                          className={cn(
                            'cursor-pointer border-white/[0.06] transition-colors',
                            isExpanded ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]',
                          )}
                        >
                          <TableCell className="py-3 text-white/30">
                            <ChevronDown className={cn(
                              'h-4 w-4 transition-transform',
                              isExpanded && 'rotate-180',
                            )} />
                          </TableCell>
                          <TableCell className="py-3 font-medium text-white">{c.name}</TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn(a.border, a.bg, a.text)}>
                              {proto.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm text-white">
                            {fmtN(c.users)}
                          </TableCell>
                          <TableCell className="py-3 text-sm text-white/60">{c.lastLogin}</TableCell>
                          <TableCell className="py-3 text-center">
                            {c.mfa ? (
                              <Check className="mx-auto h-4 w-4 text-emerald-400" />
                            ) : (
                              <XCircle className="mx-auto h-4 w-4 text-rose-400" />
                            )}
                          </TableCell>
                        </TableRow>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <TableRow className="border-white/[0.06] bg-white/[0.04]">
                              <TableCell colSpan={6} className="p-0">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="border-t border-white/[0.06] p-4"
                                >
                                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wide text-white/40">SP Entity ID</div>
                                      <div className="mt-1 font-mono text-xs text-white/80">
                                        https://gstpilot.com/sp/{c.name.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '')}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wide text-white/40">IdP Endpoint</div>
                                      <div className="mt-1 font-mono text-xs text-white/80">
                                        https://idp.gstpilot.com/{proto.label.toLowerCase()}/sso
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wide text-white/40">Cert Expiry</div>
                                      <div className="mt-1 font-mono text-xs text-emerald-300">2026-08-14</div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wide text-white/40">SCIM Provisioning</div>
                                      <div className="mt-1 text-xs text-emerald-300">Enabled · 2-way sync</div>
                                    </div>
                                  </div>
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── MFA METHODS GRID ──────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-teal-300" />
                Multi-Factor Authentication Methods
                <span className="ml-1 text-xs font-normal text-white/40">
                  ({MFA_METHODS.length} active methods · 99.8% combined adoption)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MFA_METHODS.map((m, idx) => {
                  const a = ACCENT_CLASSES[m.accent];
                  return (
                    <motion.div
                      key={m.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.05 + idx * 0.05 }}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border p-5',
                        a.border, a.bg,
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', a.border, 'bg-black/30')}>
                            {m.name.includes('Authenticator') && <Smartphone className={cn('h-4 w-4', a.text)} />}
                            {m.name.includes('SMS') && <MessageSquare className={cn('h-4 w-4', a.text)} />}
                            {m.name.includes('Hardware') && <Key className={cn('h-4 w-4', a.text)} />}
                            {m.name.includes('Biometric') && <ScanFace className={cn('h-4 w-4', a.text)} />}
                            {m.name.includes('Email') && <Mail className={cn('h-4 w-4', a.text)} />}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{m.name}</div>
                            <div className="text-[10px] text-white/50">{fmtN(m.users)} users enrolled</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(a.border, a.text)}>
                          {m.adoptionPct}%
                        </Badge>
                      </div>

                      {/* Adoption progress bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[10px] text-white/40">
                          <span>Adoption rate</span>
                          <span className={a.text}>{m.adoptionPct}% of 12.4K users</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${m.adoptionPct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 + idx * 0.05 }}
                            className={cn('h-full rounded-full', a.bar)}
                          />
                        </div>
                      </div>

                      <Separator className="my-3 bg-white/[0.06]" />

                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1 text-white/50">
                          <Clock className="h-3 w-3" />
                          <span>Avg setup: {m.avgSetupMin} min</span>
                        </div>
                        <div className="flex items-center gap-1 text-white/50">
                          <Zap className="h-3 w-3" />
                          <span>Real-time verify</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── IDENTITY EVENTS FEED ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Activity className="h-4 w-4 text-violet-300" />
                Identity Events Feed
                <span className="ml-1 text-xs font-normal text-white/40">
                  Live audit trail · most recent first
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {IDENTITY_EVENTS.map((e, idx) => {
                    const status = EVENT_STATUS[e.status];
                    const StatusIcon = status.icon;
                    const TypeIcon = EVENT_TYPE_ICON[e.type] ?? Globe2;
                    const sa = ACCENT_CLASSES[status.accent];
                    return (
                      <motion.div
                        key={`${e.user}-${e.time}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border bg-white/[0.02] p-3',
                          sa.border,
                        )}
                      >
                        {/* Status icon */}
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', sa.border, sa.bg)}>
                          <StatusIcon className={cn('h-4 w-4', sa.text)} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-white">{e.type}</span>
                            <Badge variant="outline" className={cn(sa.border, sa.bg, sa.text, 'capitalize')}>
                              {e.status}
                            </Badge>
                            <span className="ml-auto text-[10px] text-white/40">{e.time}</span>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
                            <div>
                              <span className="text-white/40">User </span>
                              <span className="font-mono text-white/80">{e.user}</span>
                            </div>
                            <div>
                              <span className="text-white/40">IP </span>
                              <span className="font-mono text-white/80">{e.ip}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Location </span>
                              <span className="text-white/80">{e.location}</span>
                            </div>
                            <div className="flex items-center gap-1 text-white/50">
                              <TypeIcon className="h-3 w-3" />
                              <span>{e.type}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── PASSWORDLESS SETUP + PROTOCOL BREAKDOWN ──────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Passwordless WebAuthn card */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="lg:col-span-2"
          >
            <Card className="relative h-full overflow-hidden border-violet-500/30 bg-violet-500/[0.06]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
              </div>
              <CardHeader className="relative z-10 pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <Fingerprint className="h-4 w-4 text-violet-300" />
                  Passwordless WebAuthn · Passkeys
                  <Badge variant="outline" className="ml-1 border-violet-500/30 bg-violet-500/10 text-violet-300">
                    FIDO2 Certified
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <p className="text-sm leading-relaxed text-white/65">
                  Eliminate passwords entirely with W3C WebAuthn-compliant passkeys. Passkeys use
                  public-key cryptography bound to the user&apos;s device, making them phishing-resistant
                  and impossible to brute-force. Currently enrolled by <span className="font-semibold text-violet-300">1,240</span> users
                  with a 100% authentication success rate.
                </p>

                {/* Supported platforms */}
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Supported platforms</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PASSKEY_PLATFORMS.map((p) => {
                      const Icon = p.icon;
                      const a = ACCENT_CLASSES[p.accent];
                      return (
                        <div
                          key={p.name}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                            a.border, a.bg,
                          )}
                        >
                          <Icon className={cn('h-3.5 w-3.5', a.text)} />
                          <span className="text-white/80">{p.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action area */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setPasskeyEnabled(true)}
                    disabled={passkeyEnabled}
                    className={cn(
                      'bg-violet-500 text-black hover:bg-violet-400',
                      passkeyEnabled && 'bg-emerald-500 hover:bg-emerald-500',
                    )}
                  >
                    {passkeyEnabled ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        Passkey Enabled
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-4 w-4" />
                        Enable Passkey
                      </>
                    )}
                  </Button>
                  {passkeyEnabled && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 text-xs text-emerald-300"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Passkey registered for current device · credential ID <span className="font-mono">pk_8f3a92c1</span></span>
                    </motion.div>
                  )}
                </div>

                {/* Bottom KPIs */}
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Phishing-resistant</div>
                    <div className="mt-0.5 text-lg font-bold text-emerald-300">100%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Avg auth time</div>
                    <div className="mt-0.5 text-lg font-bold text-teal-300">0.8s</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">User satisfaction</div>
                    <div className="mt-0.5 text-lg font-bold text-cyan-300">4.9/5</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Protocol breakdown donut */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="h-full border-white/[0.06] bg-white/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <Lock className="h-4 w-4 text-emerald-300" />
                  Protocol Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Donut */}
                <div className="flex flex-col items-center">
                  <div className="relative h-44 w-44">
                    <div
                      className="h-full w-full rounded-full"
                      style={{ background: `conic-gradient(${conicGradient})` }}
                    />
                    <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-black/80 backdrop-blur-sm">
                      <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
                      <div className="text-2xl font-bold text-white">
                        {fmtN(protocolBreakdown.total)}
                      </div>
                      <div className="text-[10px] text-white/40">SSO users</div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="mt-5 w-full space-y-2">
                    {protocolBreakdown.stops.map((s) => {
                      const a = ACCENT_CLASSES[s.accent];
                      return (
                        <div key={s.label} className="flex items-center gap-2">
                          <div className={cn('h-2.5 w-2.5 rounded-sm', a.bar)} />
                          <span className="text-xs text-white/70">{s.label}</span>
                          <span className="ml-auto font-mono text-xs text-white">
                            {fmtN(s.value)}
                          </span>
                          <span className={cn('text-xs font-semibold', a.text)}>
                            {s.pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>

        {/* ─── TAGLINE ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center">
          <ShieldCheck className="h-3.5 w-3.5 text-white/30" />
          <p className="text-[11px] text-white/40">
            One Identity. Every System. Zero Passwords. — GSTPilot Infinity™
          </p>
        </div>
      </div>
    </div>
  );
}
