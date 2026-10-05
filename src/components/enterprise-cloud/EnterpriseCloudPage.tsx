'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Building2, Users, Shield, Activity, Crown, Cloud, Search, Zap,
  CheckCircle, XCircle, Clock, AlertTriangle, KeyRound, Plug, Globe,
  ArrowUpRight, Plus, Star, TrendingUp, Database, Server, Cpu, Lock,
  ChevronRight, ChevronDown, UserPlus, UserCog, Building, Landmark,
  FileText, CreditCard, BarChart3, Bell, Eye, Network, Gauge, Briefcase,
  Scale, Flag, LayoutGrid, Store, Fingerprint, Archive, ToggleLeft,
  ShieldCheck, Package, Factory, ShoppingCart, HeartPulse, GraduationCap,
  HardHat, BedDouble, Calculator, Ship, Truck, Gavel, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'

// ── Types matching API responses ──────────────────────────────────────────────
interface DashboardData {
  tenant: { id: string; name: string; slug: string; plan: string; status: string; region: string; timezone: string; createdAt: string }
  counts: { organizations: number; companies: number; members: number; activeMembers: number; roles: number; integrations: number; apiKeys: number; auditEvents24h: number; securityEvents24h: number }
  subscription: { plan: string; status: string; billingCycle: string; seatCount: number; companyCount: number; amount: number; currentPeriodEnd: string } | null
  usage: { metric: string; label: string; unit: string; used: number; limit: number; pct: number }[]
  health: { status: string; dbLatencyMs: number; cacheLatencyMs: number; uptimePct: number; errorRatePct: number }
  mrr: number
  arr: number
}
interface HierarchyNode { id: string; name: string; type: string; code: string | null; parentId: string | null; children: HierarchyNode[]; memberCount: number; companyCount: number }
interface OrgData { tenant: { id: string; name: string; slug: string; plan: string }; tree: HierarchyNode[]; stats: { total: number; maxDepth: number } }
interface UserData { users: { id: string; userId: string; name: string; email: string; role: { id: string; key: string; name: string } | null; organization: { id: string; name: string; type: string } | null; title: string | null; status: string; joinedAt: string | null; lastActiveAt: string | null; isActive: boolean }[]; total: number }
interface RoleData { roles: { id: string; name: string; key: string; description: string | null; permissions: string[]; isSystem: boolean; isDefault: boolean; memberCount: number }[]; systemRoles: { key: string; name: string; description: string }[]; permissions: string[] }
interface SubData { subscription: DashboardData['subscription'] & { id: string; startedAt: string; currentPeriodStart: string; invoiceCount: number } | null; plans: { key: string; name: string; priceMonthly: number; priceYearly: number; seats: number; companies: number; features: string[]; highlight?: boolean }[] }
interface BillingData { invoices: { id: string; number: string; type: string; status: string; subtotal: number; tax: number; total: number; currency: string; issuedAt: string; dueAt: string | null; paidAt: string | null }[]; total: number }
interface UsageData { summary: { metric: string; label: string; unit: string; used: number; limit: number; pct: number }[]; timeseries: { date: string; [k: string]: number | string }[]; metrics: { key: string; label: string; unit: string }[]; days: number }
interface AuditData { logs: { id: string; actorType: string; actorName: string | null; action: string; entity: string | null; summary: string; severity: string; ipAddress: string | null; timestamp: string }[]; stats: { total: number; last24h: number; critical: number; byActor: { actorType: string; count: number }[]; byAction: { action: string; count: number }[] } }
interface SecurityData { events: { id: string; eventType: string; severity: string; ipAddress: string | null; location: string | null; timestamp: string }[]; counts: { last24h: number; failed: number; suspicious: number; mfaSuccess: number }; apiKeys: { id: string; name: string; keyPrefix: string; scopes: string[]; lastUsedAt: string | null; createdAt: string }[]; integrations: { id: string; category: string; provider: string; displayName: string; status: string; connectedAt: string | null; lastSyncAt: string | null }[]; identityProviders: { key: string; name: string; category: string }[] }
interface HealthData { status: string; services: { name: string; status: string; latencyMs: number; detail: string }[]; uptimePct: number; errorRatePct: number; activeWorkers: number; queueDepth: number; dbConnections: number; cacheHitPct: number; checkedAt: string }
interface SearchData { query: string; results: { id: string; type: string; title: string; subtitle: string | null; updatedAt: string | null }[]; total: number }

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

const ORG_ICONS: Record<string, React.ElementType> = {
  holding: Landmark, company: Building2, group: Building, subsidiary: Building,
  branch: Network, department: Users, team: Users, business_unit: Briefcase, project: FileText,
}
const ORG_COLORS: Record<string, string> = {
  holding: 'text-amber-400', company: 'text-emerald-400', group: 'text-emerald-400',
  subsidiary: 'text-cyan-400', branch: 'text-sky-400', department: 'text-violet-400',
  team: 'text-pink-400', business_unit: 'text-orange-400', project: 'text-rose-400',
}

const ACTOR_COLORS: Record<string, string> = {
  user: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  ai_ceo: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  ai_employee: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  automation: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  api: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  integration: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  approval: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
  system: 'bg-muted text-muted-foreground border-border',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    operational: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    connected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    issued: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    healthy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    trialing: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
    invited: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    suspended: 'bg-red-500/15 text-red-300 border-red-500/20',
    cancelled: 'bg-red-500/15 text-red-300 border-red-500/20',
    overdue: 'bg-red-500/15 text-red-300 border-red-500/20',
    failed_login: 'bg-red-500/15 text-red-300 border-red-500/20',
    suspicious: 'bg-red-500/15 text-red-300 border-red-500/20',
    disconnected: 'bg-muted text-muted-foreground border-border',
    degraded: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    down: 'bg-red-500/15 text-red-300 border-red-500/20',
    critical: 'bg-red-500/15 text-red-300 border-red-500/20',
  }
  return <Badge variant="outline" className={`${map[status] ?? 'bg-muted text-muted-foreground border-border'} text-[10px] font-medium capitalize`}>{status}</Badge>
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent = 'text-emerald-400', delay = 0 }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: string; delay?: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className="bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">{label}</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
              {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
            </div>
            <div className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
              <Icon className={`h-4 w-4 ${accent}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Hierarchy Tree Node (recursive) ────────────────────────────────────────────
function OrgTreeNode({ node, depth }: { node: HierarchyNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const Icon = ORG_ICONS[node.type] ?? Building2
  const hasChildren = node.children.length > 0
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/[0.03] transition-colors cursor-pointer group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ${open ? '' : '-rotate-90'}`} />
        ) : (
          <span className="w-3.5" />
        )}
        <Icon className={`h-4 w-4 ${ORG_COLORS[node.type] ?? 'text-muted-foreground'}`} />
        <span className="text-sm font-medium text-foreground truncate flex-1">{node.name}</span>
        {node.code && <span className="text-[10px] font-mono text-muted-foreground/50">{node.code}</span>}
        <Badge variant="outline" className="text-[9px] capitalize border-white/10 text-muted-foreground">{node.type}</Badge>
        {node.memberCount > 0 && (
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5"><Users className="h-3 w-3" />{node.memberCount}</span>
        )}
        {node.companyCount > 0 && (
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5"><Building2 className="h-3 w-3" />{node.companyCount}</span>
        )}
      </div>
      {open && hasChildren && (
        <div className="border-l border-white/[0.04] ml-4">
          {node.children.map((child) => <OrgTreeNode key={child.id} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════════
export default function EnterpriseCloudPage() {
  const [tab, setTab] = useState('overview')
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    try {
      const d = await apiGet<DashboardData>('/admin/dashboard')
      setDash(d)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-5 pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Cloud className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">Enterprise Cloud™</h1>
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/20 uppercase tracking-wider">Multi-Tenant SaaS</Badge>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {dash ? <>{dash.tenant.name} · {dash.tenant.region} · Plan: <span className="text-foreground font-medium capitalize">{dash.tenant.plan}</span></> : 'Loading tenant…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dash && <StatusBadge status={dash.tenant.status} />}
            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-white/10 bg-white/[0.03]">
              <Gauge className="h-3.5 w-3.5" /> {dash?.health.uptimePct ?? 99.98}% uptime
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 pt-3 border-b border-white/[0.06] overflow-x-auto scrollbar-thin">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            {[
              { v: 'overview', l: 'Overview', i: Gauge },
              { v: 'organizations', l: 'Organizations', i: Network },
              { v: 'users', l: 'Users & Roles', i: Users },
              { v: 'billing', l: 'Subscriptions & Billing', i: CreditCard },
              { v: 'usage', l: 'Usage Metering', i: BarChart3 },
              { v: 'audit', l: 'Audit Trail', i: FileText },
              { v: 'security', l: 'Security', i: Shield },
              { v: 'health', l: 'System Health', i: Activity },
              { v: 'search', l: 'Global Search', i: Search },
              // Phase 9 — Enterprise Multi-Tenant Cloud™ (Global Scale)
              { v: 'policies', l: 'Policies', i: Scale },
              { v: 'flags', l: 'Feature Flags', i: Flag },
              { v: 'workspaces', l: 'Workspaces', i: LayoutGrid },
              { v: 'marketplace', l: 'Org Marketplace', i: Store },
              { v: 'identity', l: 'Identity', i: Fingerprint },
              { v: 'governance', l: 'Governance', i: Archive },
            ].map((t) => (
              <TabsTrigger key={t.v} value={t.v} className="data-[state=active]:bg-white/[0.06] data-[state=active]:text-foreground text-muted-foreground/70 h-9 px-3 text-xs gap-1.5 rounded-md">
                <t.i className="h-3.5 w-3.5" /> {t.l}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 px-4 sm:px-6 py-4 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground/50 text-sm gap-2">
              <div className="h-4 w-4 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              Loading enterprise data…
            </div>
          ) : (
            <>
              <TabsContent value="overview" className="mt-0"><OverviewTab dash={dash} /></TabsContent>
              <TabsContent value="organizations" className="mt-0"><OrganizationsTab /></TabsContent>
              <TabsContent value="users" className="mt-0"><UsersTab /></TabsContent>
              <TabsContent value="billing" className="mt-0"><BillingTab /></TabsContent>
              <TabsContent value="usage" className="mt-0"><UsageTab /></TabsContent>
              <TabsContent value="audit" className="mt-0"><AuditTab /></TabsContent>
              <TabsContent value="security" className="mt-0"><SecurityTab /></TabsContent>
              <TabsContent value="health" className="mt-0"><HealthTab /></TabsContent>
              <TabsContent value="search" className="mt-0"><SearchTab /></TabsContent>
              <TabsContent value="policies" className="mt-0"><PoliciesTab /></TabsContent>
              <TabsContent value="flags" className="mt-0"><FeatureFlagsTab /></TabsContent>
              <TabsContent value="workspaces" className="mt-0"><WorkspacesTab /></TabsContent>
              <TabsContent value="marketplace" className="mt-0"><OrgMarketplaceTab /></TabsContent>
              <TabsContent value="identity" className="mt-0"><IdentityTab /></TabsContent>
              <TabsContent value="governance" className="mt-0"><GovernanceTab /></TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  )
}

// ═══ OVERVIEW TAB ═══════════════════════════════════════════════════════════════
function OverviewTab({ dash }: { dash: DashboardData | null }) {
  if (!dash) return null
  return (
    <div className="space-y-4">
      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Building2} label="Organizations" value={dash.counts.organizations} sub={`${dash.counts.companies} companies`} delay={0} />
        <StatCard icon={Users} label="Members" value={dash.counts.members} sub={`${dash.counts.activeMembers} active`} accent="text-cyan-400" delay={0.05} />
        <StatCard icon={Plug} label="Integrations" value={dash.counts.integrations} sub={`${dash.counts.apiKeys} API keys`} accent="text-violet-400" delay={0.1} />
        <StatCard icon={FileText} label="Audit (24h)" value={dash.counts.auditEvents24h} sub="events logged" accent="text-amber-400" delay={0.15} />
        <StatCard icon={Shield} label="Security (24h)" value={dash.counts.securityEvents24h} sub="events tracked" accent="text-rose-400" delay={0.2} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Subscription + revenue */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400" /> Subscription</CardTitle>
              {dash.subscription && <StatusBadge status={dash.subscription.status} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold capitalize text-foreground">{dash.subscription?.plan ?? 'Free'}</span>
              <span className="text-xs text-muted-foreground/60 capitalize">{dash.subscription?.billingCycle}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-muted-foreground/50">Seats</p><p className="text-foreground font-medium">{dash.subscription?.seatCount ?? 0}</p></div>
              <div><p className="text-muted-foreground/50">Companies</p><p className="text-foreground font-medium">{dash.subscription?.companyCount ?? 0}</p></div>
              <div><p className="text-muted-foreground/50">MRR</p><p className="text-foreground font-medium">{inr(dash.mrr)}</p></div>
              <div><p className="text-muted-foreground/50">ARR</p><p className="text-foreground font-medium">{inr(dash.arr)}</p></div>
            </div>
            <Separator className="bg-white/[0.06]" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/60">Renews</span>
              <span className="text-foreground">{dash.subscription ? new Date(dash.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Usage */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-400" /> Usage (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-[260px] overflow-y-auto scrollbar-thin">
            {dash.usage.slice(0, 6).map((u) => (
              <div key={u.metric}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground/70">{u.label}</span>
                  <span className="text-foreground font-medium tabular-nums">{u.used.toLocaleString('en-IN')}{u.limit > 0 && <span className="text-muted-foreground/40"> / {u.limit.toLocaleString('en-IN')}</span>}</span>
                </div>
                <Progress value={u.pct} className="h-1.5 bg-white/[0.04]" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* System health */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400" /> System Health</CardTitle>
              <StatusBadge status={dash.health.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-muted-foreground/50">Uptime</p><p className="text-emerald-300 font-medium">{dash.health.uptimePct}%</p></div>
              <div><p className="text-muted-foreground/50">Error rate</p><p className="text-foreground font-medium">{dash.health.errorRatePct}%</p></div>
              <div><p className="text-muted-foreground/50">DB latency</p><p className="text-foreground font-medium">{dash.health.dbLatencyMs}ms</p></div>
              <div><p className="text-muted-foreground/50">Cache latency</p><p className="text-foreground font-medium">{dash.health.cacheLatencyMs}ms</p></div>
            </div>
            <Separator className="bg-white/[0.06]" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              All 12 services operational
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform capabilities */}
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Cloud className="h-4 w-4 text-emerald-400" /> Enterprise Capabilities</CardTitle>
          <CardDescription className="text-xs text-muted-foreground/60">Production-grade multi-tenant architecture powering every business on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[
              { i: Building2, t: 'Tenant Isolation', d: 'DB · Storage · Cache · AI Memory', c: 'text-emerald-400' },
              { i: Network, t: 'Org Hierarchy', d: 'Unlimited depth · permission inheritance', c: 'text-cyan-400' },
              { i: Shield, t: 'Enterprise RBAC', d: '13 system roles · custom roles · field-level', c: 'text-violet-400' },
              { i: CreditCard, t: 'Subscription Engine', d: '5 plans · per-user · usage billing', c: 'text-amber-400' },
              { i: BarChart3, t: 'Usage Metering', d: '12 metrics · real-time · per-tenant', c: 'text-sky-400' },
              { i: FileText, t: 'Audit Engine', d: 'Every action · 8 actor types · immutable', c: 'text-rose-400' },
              { i: Lock, t: 'Identity & SSO', d: 'SAML · Okta · Azure AD · SCIM · MFA', c: 'text-orange-400' },
              { i: Search, t: 'Global Search', d: 'Across all entities · instant', c: 'text-pink-400' },
            ].map((cap) => (
              <div key={cap.t} className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-3 hover:bg-white/[0.03] transition-colors">
                <cap.i className={`h-4 w-4 ${cap.c} mb-2`} />
                <p className="text-xs font-medium text-foreground">{cap.t}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">{cap.d}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══ ORGANIZATIONS TAB ═════════════════════════════════════════════════════════
function OrganizationsTab() {
  const [data, setData] = useState<OrgData | null>(null)
  useEffect(() => { apiGet<OrgData>('/organizations').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Network} label="Total Nodes" value={data.stats.total} sub={`${data.stats.maxDepth + 1} levels deep`} />
        <StatCard icon={Landmark} label="Holdings" value={data.tree.length} accent="text-amber-400" />
        <StatCard icon={Building2} label="Companies" value={data.tree.reduce((a, n) => a + countByType(n, 'company'), 0)} accent="text-emerald-400" />
        <StatCard icon={Users} label="Departments" value={data.tree.reduce((a, n) => a + countByType(n, 'department'), 0)} accent="text-violet-400" />
      </div>
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Network className="h-4 w-4 text-cyan-400" /> Organization Hierarchy™</CardTitle>
            <Badge variant="outline" className="text-[10px] border-white/10">Permission inheritance enabled</Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground/60">Unlimited depth · holding → company → subsidiary → branch → department → team → project</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[440px] pr-3">
            {data.tree.map((node) => <OrgTreeNode key={node.id} node={node} depth={0} />)}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
function countByType(node: HierarchyNode, type: string): number {
  let n = node.type === type ? 1 : 0
  for (const c of node.children) n += countByType(c, type)
  return n
}

// ═══ USERS & ROLES TAB ═════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState<UserData | null>(null)
  const [roles, setRoles] = useState<RoleData | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('employee')
  const [inviteName, setInviteName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([apiGet<UserData>('/users'), apiGet<RoleData>('/roles')])
    setUsers(u); setRoles(r)
  }, [])
  useEffect(() => { load().catch(console.error) }, [load])

  const doInvite = async () => {
    if (!inviteEmail) return
    setBusy(true); setMsg('')
    try {
      await apiPost('/admin/invite', { email: inviteEmail, name: inviteName, roleKey: inviteRole })
      setMsg(`Invitation sent to ${inviteEmail}`)
      setInviteEmail(''); setInviteName('')
      await load()
    } catch (e) { setMsg('Failed to invite') } finally { setBusy(false) }
  }

  const changeRole = async (memberId: string, roleKey: string) => {
    try { await apiPost('/admin/assign-role', { memberId, roleKey }); await load() } catch (e) { console.error(e) }
  }

  if (!users || !roles) return <LoadingBlock />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Members" value={users.total} sub={`${users.users.filter(u => u.status === 'active').length} active`} />
        <StatCard icon={UserCog} label="Roles" value={roles.roles.length} sub={`${roles.roles.filter(r => r.isSystem).length} system`} accent="text-violet-400" />
        <StatCard icon={Shield} label="Permissions" value={roles.permissions.length} sub="catalogue keys" accent="text-amber-400" />
        <StatCard icon={UserPlus} label="Invited" value={users.users.filter(u => u.status === 'invited').length} accent="text-cyan-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Users */}
        <Card className="bg-white/[0.02] border-white/[0.06] lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-emerald-400" /> Global User Management™</CardTitle>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 border-white/10 bg-white/[0.03] text-xs" onClick={() => setInviteOpen(!inviteOpen)}>
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </Button>
            </div>
            {inviteOpen && (
              <div className="mt-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input placeholder="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="h-8 bg-white/[0.03] border-white/10 text-xs" />
                  <Input placeholder="Name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="h-8 bg-white/[0.03] border-white/10 text-xs" />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="h-8 rounded-md bg-white/[0.03] border border-white/10 text-xs px-2 text-foreground">
                    {roles.roles.map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={doInvite} disabled={busy}>{busy ? 'Sending…' : 'Send Invitation'}</Button>
                  {msg && <span className="text-[10px] text-emerald-300">{msg}</span>}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-1.5">
                {users.users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold">
                        {(u.name || u.email || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{u.name}</span>
                        <StatusBadge status={u.status} />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 truncate">{u.email}</p>
                    </div>
                    {u.organization && <span className="text-[10px] text-muted-foreground/50 hidden sm:block truncate max-w-[120px]">{u.organization.name}</span>}
                    <select
                      value={u.role?.key ?? 'employee'}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="h-7 rounded-md bg-white/[0.03] border border-white/10 text-[10px] px-1.5 text-foreground max-w-[110px]"
                    >
                      {roles.roles.map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}
                    </select>
                  </div>
                ))}
                {users.users.length === 0 && <EmptyState icon={Users} text="No members yet — invite your team" />}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Roles */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-violet-400" /> Enterprise RBAC™</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-2">
                {roles.roles.map((r) => (
                  <div key={r.id} className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{r.name}</span>
                        {r.isSystem && <Badge variant="outline" className="text-[8px] py-0 px-1 border-amber-500/20 text-amber-300 bg-amber-500/10">SYSTEM</Badge>}
                      </div>
                      <span className="text-[10px] text-muted-foreground/50">{r.memberCount} member{r.memberCount !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">{r.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.permissions.slice(0, 4).map((p) => (
                        <code key={p} className="text-[8px] bg-white/[0.04] px-1 py-0.5 rounded text-muted-foreground/70">{p}</code>
                      ))}
                      {r.permissions.length > 4 && <span className="text-[8px] text-muted-foreground/40">+{r.permissions.length - 4} more</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══ BILLING TAB ═══════════════════════════════════════════════════════════════
function BillingTab() {
  const [sub, setSub] = useState<SubData | null>(null)
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    Promise.all([apiGet<SubData>('/subscriptions'), apiGet<BillingData>('/billing')])
      .then(([s, b]) => { setSub(s); setBilling(b) }).catch(console.error)
  }, [])

  const changePlan = async (plan: string, cycle: 'monthly' | 'yearly') => {
    setBusy(true)
    try { await apiPost('/subscriptions', { plan, billingCycle: cycle }); const s = await apiGet<SubData>('/subscriptions'); setSub(s) }
    catch (e) { console.error(e) } finally { setBusy(false) }
  }

  if (!sub || !billing) return <LoadingBlock />
  return (
    <div className="space-y-4">
      {/* Current plan */}
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400" /> Current Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><p className="text-[10px] uppercase text-muted-foreground/50">Plan</p><p className="text-lg font-bold capitalize text-foreground">{sub.subscription?.plan ?? 'Free'}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground/50">Cycle</p><p className="text-lg font-bold capitalize text-foreground">{sub.subscription?.billingCycle ?? '—'}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground/50">Amount</p><p className="text-lg font-bold text-foreground">{inr(sub.subscription?.amount ?? 0)}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground/50">Renews</p><p className="text-sm font-medium text-foreground">{sub.subscription ? new Date(sub.subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {sub.plans.map((p) => {
            const isCurrent = sub.subscription?.plan === p.key
            return (
              <Card key={p.key} className={`bg-white/[0.02] border-white/[0.06] relative ${p.highlight ? 'border-emerald-500/30' : ''} ${isCurrent ? 'ring-1 ring-emerald-500/40' : ''}`}>
                {p.highlight && <Badge className="absolute -top-2 left-3 text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">POPULAR</Badge>}
                <CardContent className="p-3.5">
                  <p className="text-sm font-bold text-foreground">{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-foreground">{inr(p.priceMonthly)}</span>
                    <span className="text-[10px] text-muted-foreground/50">/mo</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">{inr(p.priceYearly)}/year</p>
                  <div className="space-y-1 mt-2.5">
                    <div className="flex justify-between text-[10px]"><span className="text-muted-foreground/60">Seats</span><span className="text-foreground font-medium">{p.seats}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-muted-foreground/60">Companies</span><span className="text-foreground font-medium">{p.companies}</span></div>
                  </div>
                  <ul className="space-y-1 mt-2.5">
                    {p.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
                        <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={isCurrent ? 'outline' : 'default'}
                    className="w-full h-7 mt-3 text-xs"
                    disabled={isCurrent || busy}
                    onClick={() => changePlan(p.key, 'yearly')}
                  >
                    {isCurrent ? 'Current Plan' : `Upgrade to ${p.name}`}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-cyan-400" /> Billing Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[300px] pr-3">
            <div className="space-y-1.5">
              {billing.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{inv.number}</p>
                    <p className="text-[10px] text-muted-foreground/50">{new Date(inv.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] capitalize">{inv.type}</Badge>
                  <StatusBadge status={inv.status} />
                  <span className="text-xs font-medium text-foreground tabular-nums w-20 text-right">{inr(inv.total)}</span>
                </div>
              ))}
              {billing.invoices.length === 0 && <EmptyState icon={FileText} text="No invoices yet" />}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══ USAGE TAB ═════════════════════════════════════════════════════════════════
function UsageTab() {
  const [data, setData] = useState<UsageData | null>(null)
  useEffect(() => { apiGet<UsageData>('/usage?days=30').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  const maxVal = Math.max(...data.timeseries.map((t) => Number(t.ai_requests ?? 0) + Number(t.api_calls ?? 0)), 1)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Cpu} label="AI Requests" value={data.summary.find(s => s.metric === 'ai_requests')?.used.toLocaleString('en-IN') ?? 0} accent="text-violet-400" />
        <StatCard icon={Zap} label="API Calls" value={data.summary.find(s => s.metric === 'api_calls')?.used.toLocaleString('en-IN') ?? 0} accent="text-cyan-400" />
        <StatCard icon={Database} label="Storage" value={`${data.summary.find(s => s.metric === 'storage_mb')?.used ?? 0} MB`} accent="text-amber-400" />
        <StatCard icon={Activity} label="Automation" value={data.summary.find(s => s.metric === 'automation_runs')?.used.toLocaleString('en-IN') ?? 0} accent="text-emerald-400" />
      </div>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-400" /> Usage Metering™ — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Chart */}
            <div>
              <p className="text-[10px] text-muted-foreground/50 mb-2">Daily Volume (AI + API)</p>
              <div className="h-[200px] flex items-end gap-0.5">
                {data.timeseries.map((t) => {
                  const val = Number(t.ai_requests ?? 0) + Number(t.api_calls ?? 0)
                  const h = (val / maxVal) * 100
                  return <div key={t.date} className="flex-1 bg-gradient-to-t from-emerald-500/40 to-cyan-400/60 rounded-sm min-w-[2px]" style={{ height: `${Math.max(2, h)}%` }} title={`${t.date}: ${val.toLocaleString('en-IN')}`} />
                })}
              </div>
            </div>
            {/* Breakdown */}
            <div className="space-y-2">
              {data.summary.map((s) => (
                <div key={s.metric}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground/70">{s.label}</span>
                    <span className="text-foreground font-medium tabular-nums">{s.used.toLocaleString('en-IN')}<span className="text-muted-foreground/40"> {s.unit}</span></span>
                  </div>
                  <Progress value={s.pct} className="h-1.5 bg-white/[0.04]" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══ AUDIT TAB ═════════════════════════════════════════════════════════════════
function AuditTab() {
  const [data, setData] = useState<AuditData | null>(null)
  const [filter, setFilter] = useState('')
  useEffect(() => { apiGet<AuditData>('/audit?take=100').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  const filtered = filter ? data.logs.filter(l => l.summary.toLowerCase().includes(filter.toLowerCase()) || l.action.includes(filter)) : data.logs
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Total Events" value={data.stats.total.toLocaleString('en-IN')} />
        <StatCard icon={Clock} label="Last 24h" value={data.stats.last24h} accent="text-cyan-400" />
        <StatCard icon={AlertTriangle} label="Critical" value={data.stats.critical} accent="text-red-400" />
        <StatCard icon={Users} label="Actor Types" value={data.stats.byActor.length} accent="text-violet-400" />
      </div>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-amber-400" /> Enterprise Audit Engine™</CardTitle>
            <Input placeholder="Filter events…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-7 w-48 bg-white/[0.03] border-white/10 text-xs" />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[440px] pr-3">
            <div className="space-y-1">
              {filtered.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border ${ACTOR_COLORS[log.actorType] ?? ACTOR_COLORS.system}`}>
                    <span className="text-[8px] font-bold uppercase">{log.actorType.slice(0, 2)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{log.summary}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[9px] text-muted-foreground/50">{log.actorName ?? log.actorType}</span>
                      <Badge variant="outline" className="text-[8px] py-0 px-1 capitalize border-white/10 text-muted-foreground">{log.action}</Badge>
                      {log.entity && <span className="text-[9px] text-muted-foreground/40">· {log.entity}</span>}
                      {log.ipAddress && <span className="text-[9px] text-muted-foreground/40 font-mono">{log.ipAddress}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-muted-foreground/50">{new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    {log.severity !== 'info' && <StatusBadge status={log.severity} />}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <EmptyState icon={FileText} text="No audit events match filter" />}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══ SECURITY TAB ═══════════════════════════════════════════════════════════════
function SecurityTab() {
  const [data, setData] = useState<SecurityData | null>(null)
  useEffect(() => { apiGet<SecurityData>('/security').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Shield} label="Events (24h)" value={data.counts.last24h} />
        <StatCard icon={XCircle} label="Failed Logins" value={data.counts.failed} accent="text-red-400" />
        <StatCard icon={AlertTriangle} label="Suspicious" value={data.counts.suspicious} accent="text-amber-400" />
        <StatCard icon={Lock} label="MFA Success" value={data.counts.mfaSuccess} accent="text-emerald-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Security events */}
        <Card className="bg-white/[0.02] border-white/[0.06] lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-400" /> Security Events</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-1">
                {data.events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03]">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border ${e.severity === 'critical' ? 'bg-red-500/15 border-red-500/20' : e.severity === 'warning' ? 'bg-amber-500/15 border-amber-500/20' : 'bg-emerald-500/15 border-emerald-500/20'}`}>
                      <Lock className={`h-3.5 w-3.5 ${e.severity === 'critical' ? 'text-red-300' : e.severity === 'warning' ? 'text-amber-300' : 'text-emerald-300'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground capitalize">{e.eventType.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground/50">{[e.ipAddress, e.location].filter(Boolean).join(' · ')}</p>
                    </div>
                    <StatusBadge status={e.severity} />
                    <span className="text-[9px] text-muted-foreground/50 shrink-0">{new Date(e.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Identity providers */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4 text-violet-400" /> Enterprise Identity™</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-1.5">
                {data.identityProviders.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground/50 capitalize">{p.category}</p>
                    </div>
                    {['google', 'mfa'].includes(p.key) ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground/30" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* API Keys */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber-400" /> API Keys</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.apiKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                  <KeyRound className="h-3.5 w-3.5 text-amber-400/70 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{k.name}</p>
                    <p className="text-[9px] text-muted-foreground/50 font-mono">{k.keyPrefix}••••••</p>
                  </div>
                  <div className="flex gap-1">
                    {k.scopes.slice(0, 2).map((s) => <code key={s} className="text-[8px] bg-white/[0.04] px-1 py-0.5 rounded text-muted-foreground/60">{s}</code>)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Plug className="h-4 w-4 text-cyan-400" /> Integrations</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-3">
              <div className="space-y-1.5">
                {data.integrations.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                    <Plug className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground">{i.displayName}</p>
                      <p className="text-[9px] text-muted-foreground/50 capitalize">{i.category} · {i.provider}</p>
                    </div>
                    <StatusBadge status={i.status} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══ HEALTH TAB ════════════════════════════════════════════════════════════════
function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null)
  useEffect(() => { apiGet<HealthData>('/system/health').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="Overall Status" value={data.status} accent="text-emerald-400" />
        <StatCard icon={CheckCircle} label="Uptime" value={`${data.uptimePct}%`} accent="text-cyan-400" />
        <StatCard icon={Cpu} label="Active Workers" value={data.activeWorkers} accent="text-violet-400" />
        <StatCard icon={Server} label="Cache Hit" value={`${data.cacheHitPct}%`} accent="text-amber-400" />
      </div>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-emerald-400" /> Enterprise Observability™</CardTitle>
            <span className="text-[10px] text-muted-foreground/50">Checked {new Date(data.checkedAt).toLocaleTimeString('en-IN')}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.services.map((s) => (
              <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${s.status === 'operational' ? 'bg-emerald-500/15' : s.status === 'degraded' ? 'bg-amber-500/15' : 'bg-red-500/15'}`}>
                  <Server className={`h-4 w-4 ${s.status === 'operational' ? 'text-emerald-400' : s.status === 'degraded' ? 'text-amber-400' : 'text-red-400'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground/60">{s.detail}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
          <Separator className="bg-white/[0.06] my-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><p className="text-muted-foreground/50">Error rate</p><p className="text-foreground font-medium">{data.errorRatePct}%</p></div>
            <div><p className="text-muted-foreground/50">Queue depth</p><p className="text-foreground font-medium">{data.queueDepth}</p></div>
            <div><p className="text-muted-foreground/50">DB connections</p><p className="text-foreground font-medium">{data.dbConnections}</p></div>
            <div><p className="text-muted-foreground/50">Cache hit</p><p className="text-foreground font-medium">{data.cacheHitPct}%</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══ SEARCH TAB ════════════════════════════════════════════════════════════════
function SearchTab() {
  const [q, setQ] = useState('')
  const [data, setData] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(false)
  const search = async () => {
    if (!q.trim()) { setData(null); return }
    setLoading(true)
    try { const r = await apiGet<SearchData>(`/global-search?q=${encodeURIComponent(q)}&limit=30`); setData(r) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }
  const TYPE_ICONS: Record<string, React.ElementType> = {
    Company: Building2, Organization: Network, User: Users, Client: Briefcase,
    Invoice: FileText, Integration: Plug, Audit: FileText,
  }
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Search companies, clients, invoices, users, integrations, audit logs…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                className="pl-9 h-10 bg-white/[0.03] border-white/10"
              />
            </div>
            <Button onClick={search} disabled={loading || !q.trim()} className="h-10">
              {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-cyan-400" /> Global Search™ Results</CardTitle>
            <CardDescription className="text-xs text-muted-foreground/60">{data.total} result{data.total !== 1 ? 's' : ''} for "{data.query}"</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.results.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? FileText
                return (
                  <div key={`${r.type}-${r.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group">
                    <div className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-emerald-300 transition-colors">{r.title}</p>
                      {r.subtitle && <p className="text-[10px] text-muted-foreground/60 truncate">{r.subtitle}</p>}
                    </div>
                    <Badge variant="outline" className="text-[9px] border-white/10 text-muted-foreground">{r.type}</Badge>
                    {r.updatedAt && <span className="text-[9px] text-muted-foreground/40 shrink-0">{new Date(r.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/60 transition-colors" />
                  </div>
                )
              })}
              {data.results.length === 0 && <EmptyState icon={Search} text="No results found" />}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══ POLICIES TAB (Phase 9 — Enterprise Policy Engine™) ═════════════════════════
interface PolicyRule { threshold?: number; currency?: string; approvers?: string[]; minApprovers?: number; aiLimitPerDay?: number; retentionDays?: number }
interface PolicyRecord { id: string; key: string; name: string; description: string | null; category: string; appliesTo: string; rules: PolicyRule; severity: string; status: string; createdAt: string }
interface PolicyApprovalRecord { id: string; policyId: string; policyName: string; policyKey: string; entityType: string; entityId: string; summary: string; amount: number | null; currency: string; requestedByType: string; requestedByName: string | null; approverRoles: string[]; decisions: { role: string; decision: string; comment: string | null; decidedAt: string }[]; status: string; createdAt: string; decidedAt: string | null }
interface PolicyData { policies: PolicyRecord[]; approvals: PolicyApprovalRecord[]; stats: { total: number; active: number; pendingApprovals: number; approved24h: number; rejected24h: number; byCategory: { category: string; count: number }[] } }

function PoliciesTab() {
  const [data, setData] = useState<PolicyData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = () => apiGet<PolicyData>('/policies').then(setData).catch(console.error)
  useEffect(() => { refresh() }, [])
  if (!data) return <LoadingBlock />
  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setBusy(approvalId)
    try {
      await apiPost(`/policy/${decision}`, { approvalId, role: 'ceo', comment: decision === 'approved' ? 'Approved via Enterprise Cloud' : 'Rejected via Enterprise Cloud' })
      refresh()
    } catch (e) { console.error(e) } finally { setBusy(null) }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Scale} label="Active Policies" value={data.stats.active} accent="text-emerald-400" />
        <StatCard icon={Clock} label="Pending Approvals" value={data.stats.pendingApprovals} accent="text-amber-400" />
        <StatCard icon={ThumbsUp} label="Approved (24h)" value={data.stats.approved24h} accent="text-cyan-400" />
        <StatCard icon={ThumbsDown} label="Rejected (24h)" value={data.stats.rejected24h} accent="text-red-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Policy Approvals */}
        <Card className="bg-white/[0.02] border-white/[0.06] lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-amber-400" /> Policy Approvals — all AI & business actions validated</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-2">
                {data.approvals.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg bg-white/[0.01] border border-white/[0.05] hover:border-white/10 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{a.summary}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[8px] py-0 px-1 capitalize border-white/10 text-muted-foreground">{a.policyKey.replace(/_/g, ' ')}</Badge>
                          <span className="text-[9px] text-muted-foreground/50">{a.requestedByType.replace(/_/g, ' ')}</span>
                          {a.requestedByName && <span className="text-[9px] text-muted-foreground/50">· {a.requestedByName}</span>}
                          {a.amount != null && <span className="text-[9px] text-cyan-300 font-mono">{a.currency} {a.amount.toLocaleString('en-IN')}</span>}
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.status === 'pending' && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] text-muted-foreground/50">Awaiting: {a.approverRoles.join(', ')}</span>
                        <div className="ml-auto flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" disabled={busy === a.id} onClick={() => decide(a.id, 'approved')}><ThumbsUp className="h-3 w-3" /> Approve</Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-red-500/30 text-red-300 hover:bg-red-500/10" disabled={busy === a.id} onClick={() => decide(a.id, 'rejected')}><ThumbsDown className="h-3 w-3" /> Reject</Button>
                        </div>
                      </div>
                    )}
                    {a.decisions.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        {a.decisions.map((d, i) => (
                          <span key={i} className="text-[9px] text-muted-foreground/60 inline-flex items-center gap-1">
                            {d.decision === 'approved' ? <CheckCircle className="h-2.5 w-2.5 text-emerald-400" /> : <XCircle className="h-2.5 w-2.5 text-red-400" />}
                            {d.role}{d.comment ? `: "${d.comment}"` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {data.approvals.length === 0 && <EmptyState icon={Scale} text="No policy approvals" />}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Active Policies */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Gavel className="h-4 w-4 text-violet-400" /> Active Policies</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-1.5">
                {data.policies.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{p.name}</p>
                      <StatusBadge status={p.severity} />
                    </div>
                    {p.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{p.description}</p>}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[8px] py-0 px-1 capitalize border-white/10 text-muted-foreground">{p.category}</Badge>
                      <Badge variant="outline" className="text-[8px] py-0 px-1 capitalize border-white/10 text-muted-foreground">→ {p.appliesTo}</Badge>
                      {p.rules.threshold != null && <span className="text-[9px] text-cyan-300 font-mono">≥ {p.rules.currency ?? 'INR'} {(p.rules.threshold).toLocaleString('en-IN')}</span>}
                      {p.rules.approvers && <span className="text-[9px] text-muted-foreground/50">· {p.rules.approvers.join(', ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══ FEATURE FLAGS TAB (Phase 9 — Global Feature Flags™) ═══════════════════════
interface FlagRecord { id: string; key: string; name: string; description: string | null; category: string; enabled: boolean; rolloutPct: number; targetPlanKeys: string[]; targetTenantIds: string[]; targetOrgIds: string[] }
interface FlagData { flags: FlagRecord[]; stats: { total: number; enabled: number; disabled: number; byCategory: { category: string; total: number; enabled: number }[] }; evaluated?: { key: string; name: string; on: boolean; category: string }[] }

const FLAG_CAT_COLORS: Record<string, string> = {
  module: 'text-emerald-400', ai_employee: 'text-violet-400', beta: 'text-amber-400',
  enterprise: 'text-cyan-400', regional: 'text-sky-400', customer: 'text-pink-400',
}

function FeatureFlagsTab() {
  const [data, setData] = useState<FlagData | null>(null)
  useEffect(() => { apiGet<FlagData>('/feature-flags').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  const evaluatedMap = new Map((data.evaluated ?? []).map((e) => [e.key, e.on]))
  const grouped = data.stats.byCategory
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Flag} label="Total Flags" value={data.stats.total} accent="text-cyan-400" />
        <StatCard icon={ToggleLeft} label="Enabled" value={data.stats.enabled} accent="text-emerald-400" />
        <StatCard icon={XCircle} label="Disabled" value={data.stats.disabled} accent="text-muted-foreground" />
        <StatCard icon={LayoutGrid} label="Categories" value={data.stats.byCategory.length} accent="text-violet-400" />
      </div>

      {grouped.map((cat) => {
        const flags = data.flags.filter((f) => f.category === cat.category)
        return (
          <Card key={cat.category} className="bg-white/[0.02] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 capitalize"><Flag className={`h-4 w-4 ${FLAG_CAT_COLORS[cat.category] ?? 'text-muted-foreground'}`} /> {cat.category} Flags</CardTitle>
                <Badge variant="outline" className="text-[9px] border-white/10 text-muted-foreground">{cat.enabled}/{cat.total} enabled</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-2">
                {flags.map((f) => {
                  const on = evaluatedMap.get(f.key) ?? f.enabled
                  return (
                    <div key={f.id} className="p-3 rounded-lg bg-white/[0.01] border border-white/[0.05] flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${on ? 'bg-emerald-500/15 border-emerald-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                        {on ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{f.name}</p>
                        {f.description && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{f.description}</p>}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] text-muted-foreground/50 font-mono">{f.key}</span>
                          {f.rolloutPct < 100 && <Badge variant="outline" className="text-[8px] py-0 px-1 border-amber-500/20 text-amber-300">{f.rolloutPct}% rollout</Badge>}
                          {f.targetPlanKeys.length > 0 && <span className="text-[9px] text-cyan-300">{f.targetPlanKeys.join(', ')}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[8px] py-0 px-1 capitalize ${on ? 'border-emerald-500/20 text-emerald-300' : 'border-white/10 text-muted-foreground'}`}>{on ? 'ON' : 'OFF'}</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ═══ WORKSPACES TAB (Phase 9 — Enterprise Workspace™) ══════════════════════════
interface WorkspaceWidget { type: string; title: string }
interface WorkspaceRecord { id: string; key: string; name: string; description: string | null; widgets: WorkspaceWidget[]; savedViews: { name: string }[]; shortcuts: { label: string; path: string; icon?: string }[]; permissions: string[]; isDefault: boolean }
interface WorkspaceData { workspaces: WorkspaceRecord[]; total: number }

function WorkspacesTab() {
  const [data, setData] = useState<WorkspaceData | null>(null)
  useEffect(() => { apiGet<WorkspaceData>('/workspaces').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  const totalWidgets = data.workspaces.reduce((s, w) => s + w.widgets.length, 0)
  const totalViews = data.workspaces.reduce((s, w) => s + w.savedViews.length, 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={LayoutGrid} label="Workspaces" value={data.total} accent="text-emerald-400" />
        <StatCard icon={Star} label="Default" value={data.workspaces.filter((w) => w.isDefault).length} accent="text-amber-400" />
        <StatCard icon={Package} label="Widgets" value={totalWidgets} accent="text-cyan-400" />
        <StatCard icon={Eye} label="Saved Views" value={totalViews} accent="text-violet-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {data.workspaces.map((w) => (
          <Card key={w.id} className="bg-white/[0.02] border-white/[0.06]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-emerald-400" /> {w.name}</CardTitle>
                {w.isDefault && <Badge variant="outline" className="text-[8px] py-0 px-1 border-amber-500/20 text-amber-300">DEFAULT</Badge>}
              </div>
              {w.description && <CardDescription className="text-xs text-muted-foreground/60">{w.description}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Widgets ({w.widgets.length})</p>
                <div className="flex flex-wrap gap-1">
                  {w.widgets.map((wid) => <Badge key={wid.type} variant="outline" className="text-[9px] py-0 px-1.5 border-white/10 text-muted-foreground bg-white/[0.02]">{wid.title}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Saved Views ({w.savedViews.length})</p>
                <div className="flex flex-wrap gap-1">
                  {w.savedViews.map((v, i) => <Badge key={i} variant="outline" className="text-[9px] py-0 px-1.5 border-cyan-500/20 text-cyan-300 bg-cyan-500/5">{v.name}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Access ({w.permissions.length} roles)</p>
                <div className="flex flex-wrap gap-1">
                  {w.permissions.map((r) => <Badge key={r} variant="outline" className="text-[9px] py-0 px-1.5 capitalize border-violet-500/20 text-violet-300 bg-violet-500/5">{r}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ═══ ORG MARKETPLACE TAB (Phase 9 — Organization Marketplace™) ═════════════════
interface ModuleDef { key: string; name: string; description: string; icon: string; capabilities: string[]; autoConnect: string[] }
interface InstalledModule { id: string; moduleKey: string; name: string; description: string | null; status: string; autoConnect: string[]; installedAt: string }
interface ModuleData { installed: InstalledModule[]; catalog: ModuleDef[]; stats: { installed: number; active: number; catalogTotal: number; autoConnectedEngines: string[] }; total: number }

const MODULE_ICONS: Record<string, React.ElementType> = {
  Factory, ShoppingCart, HeartPulse, GraduationCap, HardHat, BedDouble, Calculator, Scale, Ship, Truck,
}

function OrgMarketplaceTab() {
  const [data, setData] = useState<ModuleData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const refresh = () => apiGet<ModuleData>('/org-modules').then(setData).catch(console.error)
  useEffect(() => { refresh() }, [])
  if (!data) return <LoadingBlock />
  const installedKeys = new Set(data.installed.map((m) => m.moduleKey))
  const install = async (moduleKey: string) => {
    setBusy(moduleKey)
    try { await apiPost('/org-modules', { action: 'install', moduleKey }); refresh() } catch (e) { console.error(e) } finally { setBusy(null) }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Store} label="Installed" value={data.stats.installed} accent="text-emerald-400" />
        <StatCard icon={CheckCircle} label="Active" value={data.stats.active} accent="text-cyan-400" />
        <StatCard icon={Package} label="Catalog" value={data.stats.catalogTotal} accent="text-violet-400" />
        <StatCard icon={Zap} label="Engines Connected" value={data.stats.autoConnectedEngines.length} accent="text-amber-400" />
      </div>

      {/* Installed modules — auto-connected engines */}
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" /> Auto-Connected Engines</CardTitle>
          <CardDescription className="text-xs text-muted-foreground/60">Installed modules automatically wire into these GSTPilot engines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.stats.autoConnectedEngines.map((e) => (
              <Badge key={e} variant="outline" className="text-[10px] py-1 px-2 capitalize border-emerald-500/20 text-emerald-300 bg-emerald-500/5 gap-1">
                <CheckCircle className="h-3 w-3" /> {e.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Catalog grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.catalog.map((m) => {
          const Icon = MODULE_ICONS[m.icon] ?? Package
          const installed = installedKeys.has(m.key)
          return (
            <Card key={m.key} className="bg-white/[0.02] border-white/[0.06] hover:border-white/10 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{m.description}</p>
                  </div>
                  {installed ? (
                    <Badge variant="outline" className="text-[8px] py-0 px-1 border-emerald-500/20 text-emerald-300 shrink-0"><CheckCircle className="h-2.5 w-2.5 mr-0.5" /> INSTALLED</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] shrink-0 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" disabled={busy === m.key} onClick={() => install(m.key)}><Plus className="h-3 w-3" /> Install</Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {m.capabilities.slice(0, 4).map((c) => <Badge key={c} variant="outline" className="text-[8px] py-0 px-1 border-white/10 text-muted-foreground">{c}</Badge>)}
                  {m.capabilities.length > 4 && <span className="text-[9px] text-muted-foreground/40">+{m.capabilities.length - 4}</span>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ═══ IDENTITY TAB (Phase 9 — Enterprise Identity™) ═════════════════════════════
interface IdentityConfigRecord { id: string; providerKey: string; name: string; category: string; enabled: boolean; enforced: boolean; provisionedUsers: number; lastProvisionedAt: string | null; sessionPolicyMin: number }
interface IdentityData { configs: IdentityConfigRecord[]; stats: { totalProviders: number; enabledProviders: number; enforcedProviders: number; provisionedUsers: number; byCategory: { category: string; total: number; enabled: number }[] }; total: number }

const ID_CAT_COLORS: Record<string, string> = { oauth: 'text-emerald-400', sso: 'text-cyan-400', provisioning: 'text-violet-400', passwordless: 'text-amber-400', security: 'text-red-400' }

function IdentityTab() {
  const [data, setData] = useState<IdentityData | null>(null)
  useEffect(() => { apiGet<IdentityData>('/identity').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Fingerprint} label="Providers" value={data.stats.totalProviders} accent="text-cyan-400" />
        <StatCard icon={CheckCircle} label="Enabled" value={data.stats.enabledProviders} accent="text-emerald-400" />
        <StatCard icon={ShieldCheck} label="Enforced" value={data.stats.enforcedProviders} accent="text-red-400" />
        <StatCard icon={UserPlus} label="Provisioned Users" value={data.stats.provisionedUsers} accent="text-violet-400" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.configs.map((c) => (
          <Card key={c.id} className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border ${c.enabled ? 'bg-emerald-500/15 border-emerald-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                    <KeyRound className={`h-4 w-4 ${c.enabled ? 'text-emerald-400' : 'text-muted-foreground/40'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className={`text-[10px] capitalize ${ID_CAT_COLORS[c.category] ?? 'text-muted-foreground'}`}>{c.category}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {c.enabled ? <Badge variant="outline" className="text-[8px] py-0 px-1 border-emerald-500/20 text-emerald-300">ENABLED</Badge> : <Badge variant="outline" className="text-[8px] py-0 px-1 border-white/10 text-muted-foreground">DISABLED</Badge>}
                  {c.enforced && <Badge variant="outline" className="text-[8px] py-0 px-1 border-red-500/20 text-red-300">ENFORCED</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.provisionedUsers} users</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {c.sessionPolicyMin}m session</span>
                {c.lastProvisionedAt && <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-400" /> {new Date(c.lastProvisionedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ═══ GOVERNANCE TAB (Phase 9 — Data Governance™) ═══════════════════════════════
interface DataBackupRecord { id: string; type: string; status: string; sizeBytes: number; recordCount: number; location: string; retentionDays: number; legalHold: boolean; createdAt: string; expiresAt: string | null; restoredAt: string | null }
interface ComplianceCertRecord { id: string; framework: string; name: string; status: string; scope: string[]; auditor: string | null; lastAuditAt: string | null; nextAuditAt: string | null }
interface GovernanceData { backups: DataBackupRecord[]; complianceCerts: ComplianceCertRecord[]; stats: { totalBackups: number; totalSizeBytes: number; totalRecords: number; legalHolds: number; complianceCerts: number; activeCerts: number; expiringCerts30d: number; frameworksCovered: string[] }; frameworks: { key: string; name: string; description: string }[]; total: number }

const fmtBytes = (b: number) => b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

function GovernanceTab() {
  const [data, setData] = useState<GovernanceData | null>(null)
  useEffect(() => { apiGet<GovernanceData>('/governance').then(setData).catch(console.error) }, [])
  if (!data) return <LoadingBlock />
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Archive} label="Backups" value={data.stats.totalBackups} accent="text-emerald-400" sub={`${fmtBytes(data.stats.totalSizeBytes)}`} />
        <StatCard icon={Database} label="Records Protected" value={data.stats.totalRecords.toLocaleString('en-IN')} accent="text-cyan-400" />
        <StatCard icon={Lock} label="Legal Holds" value={data.stats.legalHolds} accent="text-red-400" />
        <StatCard icon={ShieldCheck} label="Active Certs" value={data.stats.activeCerts} accent="text-violet-400" sub={`${data.stats.complianceCerts} total`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Backups */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Archive className="h-4 w-4 text-emerald-400" /> Data Backups & Recovery</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-1.5">
                {data.backups.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[8px] py-0 px-1 capitalize border-white/10 text-muted-foreground">{b.type}</Badge>
                        <span className="text-[10px] text-cyan-300 font-mono truncate">{fmtBytes(b.sizeBytes)}</span>
                        <span className="text-[9px] text-muted-foreground/50">{b.recordCount.toLocaleString('en-IN')} records</span>
                      </div>
                      {b.legalHold ? <Badge variant="outline" className="text-[8px] py-0 px-1 border-red-500/20 text-red-300">LEGAL HOLD</Badge> : <StatusBadge status={b.status} />}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[9px] text-muted-foreground/40 font-mono truncate">{b.location}</span>
                      <span className="text-[9px] text-muted-foreground/50">· {b.retentionDays}d retention</span>
                      {b.restoredAt && <span className="text-[9px] text-emerald-300">· restored {new Date(b.restoredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                    <p className="text-[9px] text-muted-foreground/40 mt-0.5">{new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Compliance Certifications */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-400" /> Compliance Certifications</CardTitle>
              {data.stats.expiringCerts30d > 0 && <Badge variant="outline" className="text-[8px] py-0 px-1 border-amber-500/20 text-amber-300">{data.stats.expiringCerts30d} expiring</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-1.5">
                {data.complianceCerts.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{c.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {c.scope.slice(0, 3).map((s) => <Badge key={s} variant="outline" className="text-[8px] py-0 px-1 border-white/10 text-muted-foreground">{s}</Badge>)}
                          {c.scope.length > 3 && <span className="text-[9px] text-muted-foreground/40">+{c.scope.length - 3}</span>}
                        </div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[9px] text-muted-foreground/50">
                      {c.auditor && <span>· {c.auditor}</span>}
                      {c.lastAuditAt && <span>· last: {new Date(c.lastAuditAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>}
                      {c.nextAuditAt && <span className="text-amber-300/70">· next: {new Date(c.nextAuditAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground/50 text-sm gap-2">
      <div className="h-4 w-4 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
      Loading…
    </div>
  )
}
function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
      <Icon className="h-8 w-8 mb-2 opacity-40" />
      <p className="text-xs">{text}</p>
    </div>
  )
}
