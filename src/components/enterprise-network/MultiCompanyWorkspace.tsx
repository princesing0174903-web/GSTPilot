'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 13: MULTI-COMPANY WORKSPACE™
//
// The unified workspace for managing unlimited companies, GSTINs, and branches
// across the group. Instant company switching, parent-child org tree, a rich
// company detail panel, and a stats footer — all driven by the live enterprise
// data layer (no mocks, no Math.random, no API calls).
//
//   • Company switcher chips — "All Companies" + one chip per entity
//   • Parent-child org tree   — Aurora Holdings root → 4 subsidiaries +
//                                Standalone Traders as a separate root
//   • Company detail panel    — legal name, GSTIN, PAN, financials, scores
//   • Add Company card        — dashed-border onboarding CTA
//   • Stats footer            — totals across the entire group
//
// Tagline: Manage unlimited companies, GSTINs, and branches from one console.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Layers, Network, Users2, GitBranch, Plus, Search,
  ShieldCheck, TrendingUp, BrainCircuit, AlertTriangle, Sparkles,
  ChevronRight, ChevronDown, Building, Crown, Banknote, FileText,
  Activity, MapPin, Factory, Briefcase, Landmark, Store, Cpu,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import { COMPANIES, ENTERPRISE_KPIS, fmtINR, type Company } from '@/lib/enterprise/data';

// ─── Types & helpers ────────────────────────────────────────────────────────────

type Status = 'Healthy' | 'Watch' | 'Critical';
type GstStatus = 'Filed' | 'Pending' | 'Overdue';

const STATUS_DOT: Record<Status, string> = {
  Healthy: '🟢', Watch: '🟡', Critical: '🔴',
};

const STATUS_BADGE: Record<Status, string> = {
  Healthy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Watch: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  Critical: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const GST_BADGE: Record<GstStatus, string> = {
  Filed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Pending: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  Overdue: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const TYPE_BADGE: Record<Company['type'], string> = {
  Holding: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  Subsidiary: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Branch: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Division: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  Independent: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const TYPE_ICON: Record<string, LucideIcon> = {
  Conglomerate: Landmark,
  Technology: Cpu,
  Retail: Store,
  Manufacturing: Factory,
  'Financial Services': Briefcase,
  Trading: Building,
};

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// ─── Build org tree (parent → children) ─────────────────────────────────────────

interface OrgNode {
  company: Company;
  children: OrgNode[];
  depth: number;
}

function buildForest(companies: Company[]): OrgNode[] {
  const byId = new Map<string, OrgNode>();
  companies.forEach(c => byId.set(c.id, { company: c, children: [], depth: 0 }));
  const roots: OrgNode[] = [];
  byId.forEach(node => {
    if (node.company.parentId && byId.has(node.company.parentId)) {
      const parent = byId.get(node.company.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ─── Company switcher chip ──────────────────────────────────────────────────────

function CompanyChip({
  company, active, onClick,
}: { company: Company | null; active: boolean; onClick: () => void }) {
  const label = company ? company.name : 'All Companies';
  const Icon = company ? (TYPE_ICON[company.industry] ?? Building) : Network;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]'
          : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/[0.18] hover:text-zinc-200'
      }`}
    >
      {company ? (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ backgroundColor: company.color + '33', border: `1px solid ${company.color}66` }}
        >
          {company.name.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-300' : 'text-zinc-500'}`} />
      )}
      <span className="max-w-[140px] truncate">{label}</span>
      {company && (
        <span title={company.status} className="text-[10px]">{STATUS_DOT[company.status]}</span>
      )}
    </button>
  );
}

// ─── Org Tree Node ──────────────────────────────────────────────────────────────

function OrgTreeNode({
  node, selectedId, onSelect, isLast,
}: { node: OrgNode; selectedId: string | null; onSelect: (c: Company) => void; isLast: boolean }) {
  const c = node.company;
  const TypeIcon = TYPE_ICON[c.industry] ?? Building;
  const isSelected = selectedId === c.id;

  return (
    <div className="relative">
      {/* Connecting line for children */}
      <div className="ml-6">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`relative cursor-pointer rounded-lg border p-3 transition-all ${
            isSelected
              ? 'border-emerald-500/40 bg-emerald-500/[0.06] shadow-[0_0_24px_-8px_rgba(16,185,129,0.5)]'
              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
          }`}
          onClick={() => onSelect(c)}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ backgroundColor: c.color + '22', border: `1px solid ${c.color}66` }}
            >
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                <Badge variant="outline" className={`shrink-0 text-[9px] ${TYPE_BADGE[c.type]}`}>
                  {c.type === 'Holding' && <Crown className="mr-1 h-2.5 w-2.5" />}
                  {c.type === 'Independent' && <Building className="mr-1 h-2.5 w-2.5" />}
                  {c.type}
                </Badge>
                <span title={c.status}>{STATUS_DOT[c.status]}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><TypeIcon className="h-3 w-3" /> {c.industry}</span>
                <span className="inline-flex items-center gap-1"><Users2 className="h-3 w-3" /> {c.employees.toLocaleString('en-IN')}</span>
                <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> {c.branches}</span>
              </div>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <div className="text-xs font-semibold text-emerald-300">{fmtCompact(c.revenue)}</div>
              <div className="text-[10px] text-zinc-500">{c.complianceScore}% compliance</div>
            </div>
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'rotate-90 text-emerald-400' : 'text-zinc-600'}`} />
          </div>
        </motion.div>

        {/* Children with connector */}
        {node.children.length > 0 && (
          <div className="relative mt-2 space-y-2 border-l border-white/[0.08] pl-5 ml-4">
            {node.children.map((child, i) => (
              <div key={child.company.id} className="relative">
                {/* horizontal connector */}
                <div className="absolute -left-5 top-5 h-px w-5 bg-white/[0.08]" />
                <OrgTreeNode
                  node={child}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  isLast={i === node.children.length - 1}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Company Detail Panel ───────────────────────────────────────────────────────

function ScoreRow({ label, value, color, inverted = false }: { label: string; value: number; color: string; inverted?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className={inverted ? 'text-red-300' : 'text-zinc-200'}>{value}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-black/20 px-2.5 py-1.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
        {Icon && <Icon className="h-3 w-3 text-zinc-500" />}
        {label}
      </span>
      <span className="text-xs font-medium text-zinc-100">{value}</span>
    </div>
  );
}

function CompanyDetailPanel({ company }: { company: Company }) {
  const TypeIcon = TYPE_ICON[company.industry] ?? Building;

  return (
    <motion.div
      key={company.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* Header */}
      <div
        className="relative overflow-hidden rounded-xl border border-white/[0.06] p-4"
        style={{ background: `linear-gradient(135deg, ${company.color}14, transparent 60%)` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: company.color + '22', border: `1px solid ${company.color}66` }}
            >
              {company.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-50">{company.name}</h3>
                <Badge variant="outline" className={`text-[9px] ${TYPE_BADGE[company.type]}`}>
                  {company.type}
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400">{company.legalName}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                <TypeIcon className="h-3 w-3" /> {company.industry}
                <MapPin className="h-3 w-3" /> {company.state}
                <span>{STATUS_DOT[company.status]} {company.status}</span>
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`text-[9px] ${GST_BADGE[company.gstStatus]}`}>
            GSTR · {company.gstStatus}
          </Badge>
        </div>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <DetailRow label="GSTIN" value={company.gstin} icon={FileText} />
        <DetailRow label="PAN" value={company.pan} icon={FileText} />
        <DetailRow label="Industry" value={company.industry} icon={Factory} />
        <DetailRow label="State" value={company.state} icon={MapPin} />
        <DetailRow label="Employees" value={company.employees.toLocaleString('en-IN')} icon={Users2} />
        <DetailRow label="Branches" value={String(company.branches)} icon={GitBranch} />
      </div>

      {/* Financials */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FinTile label="Revenue" value={fmtCompact(company.revenue)} icon={Banknote} accent="text-emerald-300" />
        <FinTile label="Expenses" value={fmtCompact(company.expenses)} icon={Activity} accent="text-rose-300" />
        <FinTile label="GST Liability" value={fmtCompact(company.gstLiability)} icon={Landmark} accent="text-amber-300" />
        <FinTile label="Outstanding" value={fmtCompact(company.outstandingInvoices)} icon={FileText} accent="text-orange-300" />
      </div>

      {/* Scores */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-300">
          <BrainCircuit className="h-3.5 w-3.5 text-teal-300" /> AI Score Matrix
        </div>
        <div className="space-y-2.5">
          <ScoreRow label="Compliance" value={company.complianceScore} color="bg-emerald-500" />
          <ScoreRow label="Growth" value={company.growthScore} color="bg-teal-400" />
          <ScoreRow label="Risk" value={company.riskScore} color="bg-red-400" inverted />
          <ScoreRow label="AI Score" value={company.aiScore} color="bg-cyan-400" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.02] text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
          <FileText className="mr-1.5 h-3 w-3" /> File GSTR
        </Button>
        <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.02] text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
          <Banknote className="mr-1.5 h-3 w-3" /> Ledger
        </Button>
        <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.02] text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
          <Sparkles className="mr-1.5 h-3 w-3" /> AI Audit
        </Button>
      </div>
    </motion.div>
  );
}

function FinTile({ label, value, icon: Icon, accent }: { label: string; value: string; icon: LucideIcon; accent: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-zinc-500">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

// ─── Add Company Card ───────────────────────────────────────────────────────────

function AddCompanyCard() {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.01] p-6 text-center transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
        <Plus className="h-5 w-5 text-emerald-300" />
      </div>
      <div>
        <div className="text-sm font-semibold text-zinc-200">Add New Company</div>
        <div className="mt-0.5 text-[11px] text-zinc-500">
          Onboard unlimited companies, GSTINs, and branches
        </div>
      </div>
      <Badge variant="outline" className="mt-1 border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-300">
        <Sparkles className="mr-1 h-2.5 w-2.5" /> AI-assisted onboarding
      </Badge>
    </motion.button>
  );
}

// ─── Stats Footer ───────────────────────────────────────────────────────────────

function StatsFooter({ companies }: { companies: Company[] }) {
  const totalEmployees = companies.reduce((s, c) => s + c.employees, 0);
  const totalBranches = companies.reduce((s, c) => s + c.branches, 0);
  const totalGstins = new Set(companies.map(c => c.gstin)).size;

  const stats = [
    { icon: Building2, label: 'Companies', value: String(companies.length), accent: 'text-teal-300' },
    { icon: FileText, label: 'GSTINs', value: String(totalGstins), accent: 'text-cyan-300' },
    { icon: GitBranch, label: 'Branches', value: String(totalBranches), accent: 'text-emerald-300' },
    { icon: Users2, label: 'Employees', value: totalEmployees.toLocaleString('en-IN'), accent: 'text-amber-300' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
            <s.icon className={`h-3 w-3 ${s.accent}`} /> {s.label}
          </div>
          <div className={`mt-1 text-xl font-semibold ${s.accent}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function MultiCompanyWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(ENTERPRISE_KPIS.totalCompanies > 0 ? COMPANIES[0].id : null);
  const [filter, setFilter] = useState<'all' | 'group'>('all');

  const forest = useMemo(() => buildForest(COMPANIES), []);
  const selected = useMemo(
    () => COMPANIES.find(c => c.id === selectedId) ?? null,
    [selectedId],
  );

  const visibleForest = useMemo(() => {
    if (filter === 'group') return forest.filter(n => n.company.type !== 'Independent');
    return forest;
  }, [forest, filter]);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="absolute bottom-0 -right-20 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-3 py-1 text-[10px] uppercase tracking-wider text-teal-300">
              <Layers className="h-3 w-3" /> Phase 13 · Multi-Company
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Multi-Company Workspace<span className="text-emerald-400">™</span>
            </h1>
            <p className="text-sm text-zinc-400">Manage unlimited companies, GSTINs, and branches.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                placeholder="Search companies…"
                className="h-9 w-48 rounded-lg border border-white/[0.08] bg-white/[0.02] pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>
            <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Company
            </Button>
          </div>
        </motion.header>

        {/* ─── Company Switcher Chips ────────────────────────────────────────── */}
        <Card className="mb-4 border-white/[0.06] bg-white/[0.02]">
          <CardContent className="py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                <Network className="h-3.5 w-3.5 text-teal-300" /> Quick Switcher
              </span>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'group')}>
                <TabsList className="bg-white/[0.03] h-7">
                  <TabsTrigger value="all" className="text-[10px] h-5 px-2">All</TabsTrigger>
                  <TabsTrigger value="group" className="text-[10px] h-5 px-2">Group only</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-1">
                <CompanyChip
                  company={null}
                  active={selectedId === null}
                  onClick={() => setSelectedId(null)}
                />
                {COMPANIES.map(c => (
                  <CompanyChip
                    key={c.id}
                    company={c}
                    active={selectedId === c.id}
                    onClick={() => setSelectedId(c.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ─── Main grid: Org Tree + Detail Panel ────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Org Tree */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4 text-teal-400" />
                Parent-Child Org Tree
              </CardTitle>
              <p className="text-[11px] text-zinc-500">
                {forest.length} root {forest.length === 1 ? 'entity' : 'entities'} · {COMPANIES.length} companies total
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[640px] pr-2">
                <div className="space-y-3">
                  {visibleForest.map((root, i) => (
                    <div key={root.company.id}>
                      <OrgTreeNode
                        node={root}
                        selectedId={selectedId}
                        onSelect={(c) => setSelectedId(c.id)}
                        isLast={i === visibleForest.length - 1}
                      />
                    </div>
                  ))}
                  <AddCompanyCard />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Detail Panel */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-emerald-400" />
                Company Detail
                {selected && (
                  <Badge variant="outline" className={`ml-1 text-[9px] ${STATUS_BADGE[selected.status]}`}>
                    {selected.status}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-[11px] text-zinc-500">
                {selected ? 'Full entity profile · financials · AI scores' : 'Select a company from the tree or chips'}
              </p>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {selected ? (
                  <CompanyDetailPanel key={selected.id} company={selected} />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-64 flex-col items-center justify-center text-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]">
                      <Building2 className="h-5 w-5 text-zinc-600" />
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">No company selected</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Showing aggregated enterprise view — pick an entity above to drill in.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 border-white/10 bg-white/[0.02] text-[11px] text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                      onClick={() => setSelectedId(COMPANIES[0].id)}
                    >
                      Select {COMPANIES[0].name}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </section>

        {/* ─── Stats Footer ──────────────────────────────────────────────────── */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Enterprise Footprint</h2>
            <span className="text-[10px] text-zinc-500">Live totals across all entities</span>
          </div>
          <StatsFooter companies={COMPANIES} />
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Layers className="h-3 w-3 text-teal-400" />
            Multi-Company Workspace™ · Phase 13 · {COMPANIES.length} entities · {ENTERPRISE_KPIS.totalBranches} branches
          </div>
          <div>Founder & Owner: Prince Singh</div>
        </footer>
      </div>
    </div>
  );
}
