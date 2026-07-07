'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE AUDIT™ — COMPLIANCE & ACTION TIMELINE
//
// Track every action across your enterprise. Vertical timeline of audit
// entries with category + severity filters, full-text search, IP tracking,
// compliance summary card and one-click export.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText, Search, Download, ShieldAlert, AlertTriangle,
  Info, User, Building2, CheckCircle2, Cpu, Sparkles, FileCheck,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AUDIT_LOG,
  type AuditEntry,
} from '@/lib/enterprise/data';

// ─── Category metadata ────────────────────────────────────────────────────────
type Category = AuditEntry['category'];
type Severity = AuditEntry['severity'];

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
  user: { label: 'User', icon: User, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  organization: { label: 'Organization', icon: Building2, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  approval: { label: 'Approval', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  change: { label: 'Change', icon: FileCheck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ai: { label: 'AI', icon: Cpu, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  compliance: { label: 'Compliance', icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-400' },
  warning: { label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40', dot: 'bg-amber-400' },
  info: { label: 'Info', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/40', dot: 'bg-slate-400' },
};

const CATEGORY_TABS: { value: 'all' | Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'user', label: 'User' },
  { value: 'organization', label: 'Organization' },
  { value: 'approval', label: 'Approval' },
  { value: 'change', label: 'Change' },
  { value: 'ai', label: 'AI' },
  { value: 'compliance', label: 'Compliance' },
];

const SEVERITY_TABS: { value: 'all' | Severity; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
      <div className={`size-9 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// ─── Avatar color ─────────────────────────────────────────────────────────────
function avatarColor(avatar: string): string {
  // system / AI entries
  if (avatar === 'AI') return '#14b8a6';
  if (avatar === 'SY') return '#64748b';
  // deterministic color from initials
  const palette = ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#84cc16'];
  const hash = avatar.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

// ─── Audit Timeline Row ───────────────────────────────────────────────────────
function AuditRow({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const cat = CATEGORY_META[entry.category];
  const sev = SEVERITY_META[entry.severity];
  const CatIcon = cat.icon;
  const SevIcon = entry.severity === 'critical' ? AlertTriangle : entry.severity === 'warning' ? Info : CheckCircle2;
  const color = avatarColor(entry.avatar);
  const isCritical = entry.severity === 'critical';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      className={`relative pl-8 ${isCritical ? 'border-l-2 border-l-red-500/70' : 'border-l-2 border-l-white/[0.06]'}`}
    >
      {/* Timeline dot + connector */}
      <div className="absolute left-0 top-3 -translate-x-1/2">
        <div className={`size-3 rounded-full ring-4 ring-[#0a0e14] ${sev.dot}`} />
      </div>
      {!isLast && (
        <div className="absolute left-0 top-6 bottom-0 w-px bg-white/[0.06]" />
      )}

      <div className={`rounded-xl border ${isCritical ? 'bg-red-500/[0.04] border-red-500/20' : 'bg-white/[0.02] border-white/[0.06]'} p-3 hover:bg-white/[0.04] transition-colors`}>
        {/* Row 1: avatar + user + action */}
        <div className="flex items-start gap-3">
          <Avatar className="size-8 border border-white/10 shrink-0">
            <AvatarFallback
              className="text-[11px] font-semibold"
              style={{ background: `${color}22`, color }}
            >
              {entry.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-white">{entry.user}</span>
              <span className="text-xs text-slate-500">{entry.action}</span>
              <span className="text-sm text-slate-200 font-medium">{entry.entity}</span>
            </div>
            {/* Row 2: meta */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <Badge variant="outline" className={`border-white/10 ${cat.color} ${cat.bg}`}>
                <CatIcon className="size-2.5 mr-1" />
                {cat.label}
              </Badge>
              {entry.company !== '—' && (
                <Badge variant="outline" className="border-white/10 text-slate-300 bg-white/[0.03]">
                  {entry.company}
                </Badge>
              )}
              <Badge variant="outline" className={`border-white/10 ${sev.color} ${sev.bg} ${sev.border}`}>
                <SevIcon className="size-2.5 mr-1" />
                {sev.label}
              </Badge>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-[10px] text-slate-400">{entry.timestamp}</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-[10px] text-slate-500">IP {entry.ipAddress}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EnterpriseAudit() {
  const [activeCategory, setActiveCategory] = useState<'all' | Category>('all');
  const [activeSeverity, setActiveSeverity] = useState<'all' | Severity>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return AUDIT_LOG.filter(entry => {
      if (activeCategory !== 'all' && entry.category !== activeCategory) return false;
      if (activeSeverity !== 'all' && entry.severity !== activeSeverity) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${entry.user} ${entry.action} ${entry.entity} ${entry.company} ${entry.ipAddress}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeCategory, activeSeverity, search]);

  const stats = useMemo(() => {
    return {
      total: AUDIT_LOG.length,
      critical: AUDIT_LOG.filter(e => e.severity === 'critical').length,
      ai: AUDIT_LOG.filter(e => e.category === 'ai').length,
      failedLogins: AUDIT_LOG.filter(e => e.action.toLowerCase().includes('failed')).length,
      compliance: AUDIT_LOG.filter(e => e.category === 'compliance').length,
    };
  }, []);

  const complianceEvents = useMemo(
    () => AUDIT_LOG.filter(e => e.category === 'compliance'),
    []
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/30">
              <ScrollText className="size-4 text-emerald-400" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Enterprise Audit<span className="text-emerald-400">™</span>
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Track every action across your enterprise
          </p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 bg-white/[0.03] text-slate-200 hover:text-white hover:bg-white/[0.06]"
        >
          <Download className="size-4 mr-1.5 text-emerald-400" />
          Export Audit Log
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatPill icon={ScrollText} label="Total Today" value={stats.total} color="bg-emerald-500/10 text-emerald-400" />
        <StatPill icon={AlertTriangle} label="Critical" value={stats.critical} color="bg-red-500/10 text-red-400" />
        <StatPill icon={Cpu} label="AI Actions" value={stats.ai} color="bg-teal-500/10 text-teal-400" />
        <StatPill icon={ShieldAlert} label="Failed Logins" value={stats.failedLogins} color="bg-amber-500/10 text-amber-400" />
        <StatPill icon={FileCheck} label="Compliance" value={stats.compliance} color="bg-cyan-500/10 text-cyan-400" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Audit timeline */}
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <ScrollText className="size-4 text-emerald-400" />
                Audit Timeline
                <Badge variant="outline" className="border-white/10 text-slate-400 bg-white/[0.03] ml-1">
                  {filtered.length}
                </Badge>
              </CardTitle>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
              <Input
                placeholder="Search by user, action, entity or IP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-white/[0.03] border-white/[0.06] text-slate-200 placeholder:text-slate-500 h-9 text-sm"
              />
            </div>

            {/* Category tabs */}
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as 'all' | Category)}>
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="bg-white/[0.02] border border-white/[0.06] h-auto p-1 inline-flex">
                  {CATEGORY_TABS.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 text-slate-400 data-[state=active]:shadow-none text-xs px-2.5"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
            </Tabs>

            {/* Severity filter */}
            <Tabs value={activeSeverity} onValueChange={(v) => setActiveSeverity(v as 'all' | Severity)}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">Severity:</span>
                <TabsList className="bg-white/[0.02] border border-white/[0.06] h-auto p-1 inline-flex">
                  {SEVERITY_TABS.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 text-slate-400 data-[state=active]:shadow-none text-xs px-2.5"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="max-h-[560px] overflow-y-auto pr-2 space-y-2 custom-scroll">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                      <Search className="size-5 text-emerald-400" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">No matching entries</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search.</p>
                  </div>
                ) : (
                  filtered.map((entry, idx) => (
                    <AuditRow
                      key={entry.id}
                      entry={entry}
                      isLast={idx === filtered.length - 1}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Compliance summary + AI insight side panel */}
        <div className="space-y-4">
          {/* Compliance summary */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-400" />
                Compliance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="text-[11px] text-slate-500">Compliance Events</div>
                  <div className="text-lg font-semibold text-white tabular-nums">{complianceEvents.length}</div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="text-[11px] text-slate-500">Last Check</div>
                  <div className="text-sm font-medium text-emerald-300">2h ago</div>
                </div>
              </div>
              <Separator className="bg-white/[0.06]" />
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">Compliant</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  All GST filings on schedule. 1 overdue flag on Standalone Traders.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Compliance health</span>
                  <span className="text-emerald-300 font-medium">90%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '90%' }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Audit Insight */}
          <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-400" />
                AI Audit Insight
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                <span className="text-red-300 font-medium">2 critical events</span> detected in last 24h.
                Failed login attempt from <span className="font-mono text-slate-200">45.113.x.x</span> blocked automatically.
                AI recommends rotating API keys for Aurora Tech.
              </p>
              <Separator className="bg-white/[0.06]" />
              <div className="space-y-1.5">
                {[
                  { label: 'Anomalies detected', value: '3', color: 'text-amber-300' },
                  { label: 'Auto-remediated', value: '1', color: 'text-emerald-300' },
                  { label: 'Pending review', value: '2', color: 'text-cyan-300' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={`font-semibold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/[0.12] hover:text-emerald-200"
              >
                <Sparkles className="size-3.5 mr-1.5" />
                Run AI Compliance Scan
              </Button>
            </CardContent>
          </Card>

          {/* Top categories mini-breakdown */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Cpu className="size-4 text-emerald-400" />
                Event Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
                  const count = AUDIT_LOG.filter(e => e.category === cat).length;
                  const pct = (count / AUDIT_LOG.length) * 100;
                  const meta = CATEGORY_META[cat];
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <meta.icon className={`size-3 ${meta.color}`} />
                          {meta.label}
                        </span>
                        <span className="text-slate-400 tabular-nums">{count}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full rounded-full ${meta.bg.replace('/10', '/60')}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
      `}</style>
    </div>
  );
}
