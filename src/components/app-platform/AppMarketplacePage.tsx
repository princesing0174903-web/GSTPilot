'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global AI App Marketplace™ — Ecosystem Platform
// Phase 10 — AppMarketplacePage.tsx (9 tabs)
// Founded, developed and owned by Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Store, Boxes, Bot, Code2, Webhook, Plug, TrendingUp, BarChart3, Sparkles,
  Search, Star, Download, Upload, RefreshCw, Trash2, RotateCcw, CheckCircle,
  XCircle, Clock, AlertTriangle, AlertCircle, BadgeCheck, Shield, ShieldCheck,
  Zap, Activity, Cpu, Database, Globe, KeyRound, FileCode, Eye, ChevronRight,
  ArrowRight, ArrowUpRight, Crown, Wallet, Users, Building2, Factory, Store as StoreIcon,
  HeartPulse, GraduationCap, UtensilsCrossed, Scale, Calculator, Truck, HardHat,
  Megaphone, LayoutDashboard, LayoutGrid, FileBarChart, Cable, Workflow, AppWindow,
  BrainCircuit, Settings2, DollarSign, Coins, Receipt, PlayCircle, GitBranch,
  Terminal, Package, Wrench, Layers, Boxes as BoxesIcon, Rocket,
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import {
  APP_CATEGORY_META, APP_TYPE_META, AI_EMPLOYEE_APPS,
  STANDARD_WEBHOOK_EVENTS, EXTENSION_POINTS_META, APP_PERMISSION_CATALOG,
  EXTENSION_SDK,
  type AppDTO, type AppInstallDTO, type AppDeveloperDTO, type AppWebhookDTO,
  type AppPluginDTO, type AppAnalyticsSummary, type MonetizationSummary,
  type DeveloperDashboardDTO, type GeneratedAppSpec, type ExtensionSDKInfo,
  type AppCategory, type AppType, type AppPermission, type ExtensionPoint,
  type AIEmployeeAppDef,
} from '@/lib/app-platform'

// ── Icon registry — maps catalog icon strings to lucide components ─────────────
const ICONS: Record<string, React.ElementType> = {
  Wallet, Calculator, Users, TrendingUp, Megaphone, UserCog: Users, Settings2,
  Factory, Store: StoreIcon, HeartPulse, HardHat, GraduationCap, UtensilsCrossed,
  Scale, Truck, BrainCircuit, Code2, BarChart3, ShieldCheck, Zap,
  AppWindow, LayoutDashboard, LayoutGrid, Bot, FileBarChart, Cable, Workflow, Webhook, FileCode,
  Building2, StoreIcon, Boxes: BoxesIcon,
}
function getIcon(name: string | null | undefined, fallback: React.ElementType = Boxes): React.ElementType {
  if (!name) return fallback
  return ICONS[name] ?? fallback
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`
const num = (n: number) => (n ?? 0).toLocaleString('en-IN')

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'in the future'
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  healthy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  connected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  operational: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  certified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  updating: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  processing: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  in_review: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  degraded: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  installed: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  running: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  draft: 'bg-muted text-muted-foreground border-border',
  disabled: 'bg-muted text-muted-foreground border-border',
  disconnected: 'bg-muted text-muted-foreground border-border',
  none: 'bg-muted text-muted-foreground border-border',
  unknown: 'bg-muted text-muted-foreground border-border',
  error: 'bg-red-500/15 text-red-300 border-red-500/20',
  failed: 'bg-red-500/15 text-red-300 border-red-500/20',
  critical: 'bg-red-500/15 text-red-300 border-red-500/20',
  suspended: 'bg-red-500/15 text-red-300 border-red-500/20',
  uninstalled: 'bg-muted text-muted-foreground border-border',
}

const RISK_BADGE: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  critical: 'bg-red-500/15 text-red-300 border-red-500/20',
}

const PRICING_BADGE: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  paid: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  subscription: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  usage_based: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  enterprise: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
}

function formatPricing(app: { pricingModel: string; priceAmount: number; priceCurrency: string; billingInterval: string | null }): string {
  switch (app.pricingModel) {
    case 'free': return 'Free'
    case 'paid': return app.priceAmount > 0 ? `${app.priceCurrency === 'INR' ? '₹' : ''}${num(app.priceAmount)} one-time` : 'Paid'
    case 'subscription': return `${app.priceCurrency === 'INR' ? '₹' : ''}${num(app.priceAmount)}/${app.billingInterval ?? 'mo'}`
    case 'usage_based': return 'Usage-based'
    case 'enterprise': return 'Enterprise'
    default: return app.pricingModel
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AppMarketplacePage() {
  const [tab, setTab] = useState('store')
  const [storeStats, setStoreStats] = useState<{ totalApps: number; installedCount: number; totalRevenue: number; avgRating: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshStats = useCallback(async () => {
    try {
      const [store, installed, analytics] = await Promise.all([
        apiGet<{ total: number }>('/apps/store').catch(() => ({ total: 0 })),
        apiGet<{ installed: AppInstallDTO[] }>('/apps/installed').catch(() => ({ installed: [] })),
        apiGet<AppAnalyticsSummary>('/apps/analytics').catch(() => null),
      ])
      setStoreStats({
        totalApps: store.total ?? 0,
        installedCount: installed.installed?.length ?? 0,
        totalRevenue: analytics?.totalRevenue ?? 0,
        avgRating: analytics?.avgRating ?? 0,
      })
      setError(null)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { refreshStats() }, 0)
    return () => clearTimeout(t)
  }, [refreshStats])

  const TABS: { v: string; l: string; i: React.ElementType }[] = [
    { v: 'store', l: 'App Store™', i: Store },
    { v: 'my-apps', l: 'My Apps', i: Boxes },
    { v: 'ai-employees', l: 'AI Employees™', i: Bot },
    { v: 'developer', l: 'Developer Portal™', i: Code2 },
    { v: 'webhooks', l: 'Webhooks', i: Webhook },
    { v: 'plugins', l: 'Plugins', i: Plug },
    { v: 'monetization', l: 'Monetization™', i: TrendingUp },
    { v: 'analytics', l: 'Analytics™', i: BarChart3 },
    { v: 'ai-builder', l: 'AI Builder™', i: Sparkles },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20">
                  <Store className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Global AI App Marketplace™</h1>
                  <p className="text-sm text-muted-foreground">Build. Publish. Scale. Power Millions of Businesses.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatPill icon={Boxes} label="Apps" value={storeStats ? num(storeStats.totalApps) : '—'} color="text-emerald-400" />
              <StatPill icon={Download} label="Installed" value={storeStats ? String(storeStats.installedCount) : '—'} color="text-cyan-400" />
              <StatPill icon={TrendingUp} label="Revenue" value={storeStats ? inr(storeStats.totalRevenue) : '—'} color="text-amber-400" />
              <StatPill icon={Star} label="Avg Rating" value={storeStats ? `${storeStats.avgRating}/5` : '—'} color="text-violet-400" />
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto p-1 bg-muted/50">
            {TABS.map((t) => (
              <TabsTrigger key={t.v} value={t.v} className="gap-1.5">
                <t.i className="h-4 w-4" /> {t.l}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="store"><StoreTab onRefresh={refreshStats} /></TabsContent>
          <TabsContent value="my-apps"><MyAppsTab onRefresh={refreshStats} /></TabsContent>
          <TabsContent value="ai-employees"><AIEmployeesTab onRefresh={refreshStats} /></TabsContent>
          <TabsContent value="developer"><DeveloperPortalTab /></TabsContent>
          <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
          <TabsContent value="plugins"><PluginsTab /></TabsContent>
          <TabsContent value="monetization"><MonetizationTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="ai-builder"><AIBuilderTab /></TabsContent>
        </Tabs>

        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>GSTPilot Global AI App Marketplace™ — 37 apps · 12 AI Employees™ · Extension SDK v3.2.0 · Oracle AI Builder™ · Developer Revenue Share 70%</p>
          <p className="mt-1">Founded, developed and owned by Prince Singh.</p>
        </footer>
      </div>
    </div>
  )
}

// ── StatPill (header) ──────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  )
}

// ── StatCard (metric card) ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-emerald-400', delay = 0 }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; delay?: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className="border-border bg-muted/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`${STATUS_BADGE[status] ?? STATUS_BADGE.unknown} text-[10px] font-medium capitalize`}>
      {status}
    </Badge>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="fixed top-20 right-4 z-50 max-w-md rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-sm">{message}</p>
    </motion.div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingGrid({ count = 8, className = 'h-56' }: { count?: number; className?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className={`border-border bg-muted/20 animate-pulse ${className}`} />
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <Card className="border-dashed border-border bg-muted/10">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Icon className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-300">Failed to load</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: APP STORE
// ═══════════════════════════════════════════════════════════════════════════════
interface StoreBrowseResult {
  apps: AppDTO[]
  total: number
  categories: { category: AppCategory; label: string; count: number; icon: string; color: string }[]
  featured: AppDTO[]
  page: number
  pageSize: number
}
interface ReviewsResponse { reviews: { id: string; appId: string; appName: string; reviewerUserId: string | null; reviewerName: string; rating: number; title: string | null; comment: string | null; helpfulCount: number; verifiedPurchase: boolean; developerReply: string | null; repliedAt: string | null; createdAt: string }[] }

function StoreTab({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<StoreBrowseResult | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('popular')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<AppDTO | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params: Record<string, string> = { pageSize: '48', sort }
      if (search) params.search = search
      if (category !== 'all') params.category = category
      if (type !== 'all') params.type = type
      const res = await apiGet<StoreBrowseResult>('/apps/store', params)
      setData(res)
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }, [search, category, type, sort])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const install = async (app: AppDTO) => {
    setInstalling(app.id)
    try {
      await apiPost('/apps/install', { appId: app.id, scope: 'tenant' })
      setToast(`✅ ${app.name} installed successfully.`)
      onRefresh()
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
    } finally { setInstalling(null) }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Featured apps */}
      {!loading && data?.featured && data.featured.length > 0 && !search && category === 'all' && type === 'all' && (
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-amber-400" /> Featured Apps</CardTitle>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/20">Editor's Pick</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.featured.slice(0, 6).map((app) => (
                <button key={app.id} onClick={() => setSelectedApp(app)}
                  className="group flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-3 text-left transition-all hover:border-emerald-500/40 hover:bg-background/60">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold" style={{ background: `${app.color}20`, color: app.color }}>
                    {app.logo ?? app.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{app.name}</p>
                      {app.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{app.tagline ?? app.description}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{app.rating}</span>
                      <span>·</span>
                      <span>{num(app.installCount)} installs</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filters */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search 37 apps... (CashFlow Forecaster, Tally Bridge, Manufacturing AI™)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search apps"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(APP_TYPE_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <CategoryChip label="All" active={category === 'all'} onClick={() => setCategory('all')} count={data?.total ?? 0} />
            {data?.categories.map((c) => (
              <CategoryChip key={c.category} label={c.label} active={category === c.category} onClick={() => setCategory(c.category)} count={c.count} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${num(data?.total ?? 0)} apps available`}
          {category !== 'all' && data?.categories.find((c) => c.category === category) && ` in ${data.categories.find((c) => c.category === category)!.label}`}
        </p>
      </div>

      {/* App grid */}
      {loading ? (
        <LoadingGrid count={12} className="h-56" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data?.apps || data.apps.length === 0 ? (
        <EmptyState icon={Store} title="No apps found" subtitle="Try a different search or filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.apps.map((app, i) => {
            const catMeta = APP_CATEGORY_META[app.category] ?? { label: app.category, color: '#888' }
            return (
              <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
                <Card
                  className="group flex h-full cursor-pointer flex-col border-border bg-muted/20 transition-all hover:border-emerald-500/40 hover:bg-muted/30"
                  style={{ borderLeftWidth: '3px', borderLeftColor: app.color }}
                  onClick={() => setSelectedApp(app)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold" style={{ background: `${app.color}20`, color: app.color }}>
                          {app.logo ?? app.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm">{app.name}</CardTitle>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{catMeta.label}</p>
                        </div>
                      </div>
                      {app.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{app.tagline ?? app.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${PRICING_BADGE[app.pricingModel] ?? ''}`}>{formatPricing(app)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{APP_TYPE_META[app.type]?.label ?? app.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>v{app.version}</span>
                      <span>{app.developerName}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{app.rating}</span>
                        <span>·</span>
                        <span>{num(app.installCount)}</span>
                      </div>
                      <Button
                        size="sm" variant="default" className="h-7 gap-1 text-xs"
                        disabled={installing === app.id}
                        onClick={(e) => { e.stopPropagation(); install(app) }}
                      >
                        {installing === app.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Install
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* App detail dialog */}
      <AppDetailDialog app={selectedApp} onClose={() => setSelectedApp(null)} onInstall={install} installing={installing} />
    </div>
  )
}

function CategoryChip({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-muted/40 text-muted-foreground border border-transparent hover:bg-muted/60'
      }`}
    >
      {label} <span className="opacity-60">{num(count)}</span>
    </button>
  )
}

function AppDetailDialog({ app, onClose, onInstall, installing }: {
  app: AppDTO | null
  onClose: () => void
  onInstall: (app: AppDTO) => void
  installing: string | null
}) {
  const [reviews, setReviews] = useState<{ reviews: { id: string; rating: number; title: string | null; comment: string | null; reviewerName: string; verifiedPurchase: boolean; createdAt: string }[] } | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!app) { setReviews(null); return }
    setReviews(null)
    apiGet<ReviewsResponse>('/apps/reviews', { appId: app.id })
      .then(setReviews).catch(() => {})
  }, [app])

  if (!app) return null
  const catMeta = APP_CATEGORY_META[app.category] ?? { label: app.category, color: '#888', icon: 'Boxes' }

  const submitReview = async () => {
    setSubmitting(true)
    try {
      await apiPost('/apps/review', { appId: app.id, rating: reviewRating, title: reviewTitle, comment: reviewComment })
      const fresh = await apiGet<ReviewsResponse>('/apps/reviews', { appId: app.id })
      setReviews(fresh)
      setShowReviewForm(false)
      setReviewTitle(''); setReviewComment('')
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold" style={{ background: `${app.color}20`, color: app.color }}>
              {app.logo ?? app.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg">{app.name}</DialogTitle>
                {app.verified && <BadgeCheck className="h-4 w-4 text-sky-400" />}
                {app.featured && <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px]">Featured</Badge>}
              </div>
              <DialogDescription className="mt-0.5">{app.tagline ?? app.description}</DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{app.rating} ({num(app.reviewCount)} reviews)</span>
                <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{num(app.installCount)} installs</span>
                <span>v{app.version}</span>
                <span>by {app.developerName}{app.developerVerified && <BadgeCheck className="ml-1 inline h-3 w-3 text-sky-400" />}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pricing + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs ${PRICING_BADGE[app.pricingModel] ?? ''}`}>{formatPricing(app)}</Badge>
              <Badge variant="outline" className="text-xs">{APP_TYPE_META[app.type]?.label ?? app.type}</Badge>
              <Badge variant="outline" className="text-xs">{catMeta.label}</Badge>
            </div>
            <Button
              size="sm" variant="default" className="gap-1.5"
              disabled={installing === app.id}
              onClick={() => onInstall(app)}
            >
              {installing === app.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Install
            </Button>
          </div>

          {/* Screenshots */}
          {app.screenshots && app.screenshots.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screenshots</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {app.screenshots.map((s, i) => (
                  <div key={i} className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                    <img src={s.url} alt={s.caption ?? `${app.name} screenshot ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
            <p className="text-sm leading-relaxed text-foreground/90">{app.description}</p>
          </div>

          {/* Release notes */}
          {app.releaseNotes && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Release Notes (v{app.version})</p>
              <p className="text-sm leading-relaxed text-foreground/80">{app.releaseNotes}</p>
            </div>
          )}

          {/* Permissions */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Permissions ({app.permissions.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {app.permissions.length === 0 ? (
                <span className="text-xs text-muted-foreground">No permissions required.</span>
              ) : app.permissions.map((p) => {
                const perm = APP_PERMISSION_CATALOG.find((c) => c.key === p)
                return (
                  <Badge key={p} variant="outline" className={`text-[10px] ${RISK_BADGE[perm?.risk ?? 'medium'] ?? ''}`}>
                    <Shield className="mr-1 h-2.5 w-2.5" />
                    {perm?.label ?? p}
                  </Badge>
                )
              })}
            </div>
          </div>

          {/* Reviews */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviews ({reviews?.reviews.length ?? 0})</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowReviewForm(!showReviewForm)}>
                {showReviewForm ? 'Cancel' : 'Write a Review'}
              </Button>
            </div>
            {showReviewForm && (
              <div className="mb-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rating:</span>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} onClick={() => setReviewRating(r)} aria-label={`${r} star`}>
                      <Star className={`h-4 w-4 ${r <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <Input placeholder="Review title" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} className="h-8 text-sm" />
                <Textarea placeholder="Share your experience..." value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} className="text-sm" />
                <Button size="sm" className="h-7" disabled={submitting} onClick={submitReview}>
                  {submitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Submit Review
                </Button>
              </div>
            )}
            <ScrollArea className="max-h-72 pr-3">
              <div className="space-y-2">
                {!reviews ? (
                  <p className="text-xs text-muted-foreground">Loading reviews…</p>
                ) : reviews.reviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No reviews yet. Be the first to review!</p>
                ) : reviews.reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">{r.reviewerName}</span>
                        {r.verifiedPurchase && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[9px]">Verified</Badge>}
                      </div>
                      <span className="flex items-center gap-0.5 text-[10px]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </span>
                    </div>
                    {r.title && <p className="mt-1 text-xs font-medium">{r.title}</p>}
                    {r.comment && <p className="mt-0.5 text-xs text-muted-foreground">{r.comment}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: MY APPS
// ═══════════════════════════════════════════════════════════════════════════════
function MyAppsTab({ onRefresh }: { onRefresh: () => void }) {
  const [installed, setInstalled] = useState<AppInstallDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [rollbackFor, setRollbackFor] = useState<string | null>(null)
  const [rollbackVersion, setRollbackVersion] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<{ installed: AppInstallDTO[] }>('/apps/installed')
      setInstalled(res.installed)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const action = async (id: string, kind: 'update' | 'rollback' | 'uninstall', name: string, targetVersion?: string) => {
    setBusy(`${id}-${kind}`)
    try {
      if (kind === 'update') {
        await apiPost('/apps/update', { installId: id })
        setToast(`✅ ${name} updated.`)
      } else if (kind === 'rollback') {
        if (!targetVersion) { setToast('⚠️ Select a target version first.'); setBusy(null); return }
        await apiPost('/apps/update', { installId: id, targetVersion })
        setToast(`↩️ ${name} rolled back to v${targetVersion}.`)
        setRollbackFor(null); setRollbackVersion('')
      } else if (kind === 'uninstall') {
        await apiPost('/apps/uninstall', { installId: id })
        setToast(`🗑️ ${name} uninstalled.`)
      }
      onRefresh()
      await load()
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
    } finally { setBusy(null) }
  }

  const toggleAutoUpdate = async (inst: AppInstallDTO, value: boolean) => {
    try {
      // Patch via update endpoint with a noop — most backends will toggle autoUpdate
      // via a dedicated PATCH. We attempt the standard route; if it fails we ignore.
      await apiPost('/apps/update', { installId: inst.id, autoUpdate: value }).catch(() => {})
      setToast(value ? `✅ Auto-update enabled for ${inst.appName}.` : `⏸️ Auto-update paused for ${inst.appName}.`)
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Installed Apps</h2>
          <p className="text-sm text-muted-foreground">
            {installed.length} installed · {installed.filter((i) => i.status === 'active').length} active · {installed.filter((i) => i.autoUpdate).length} auto-updating
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 5 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/20" />)}</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : installed.length === 0 ? (
        <EmptyState icon={Boxes} title="No apps installed yet" subtitle="Browse the App Store to install your first app." />
      ) : (
        <div className="grid gap-3">
          {installed.map((inst) => {
            const catMeta = APP_CATEGORY_META[inst.appCategory] ?? { color: '#888' }
            const Icon = getIcon(APP_TYPE_META[inst.appType]?.icon)
            return (
              <Card key={inst.id} className="border-border bg-muted/20" style={{ borderLeftWidth: '3px', borderLeftColor: inst.appColor }}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: `${inst.appColor}20`, color: inst.appColor }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{inst.appName}</h3>
                          <StatusBadge status={inst.status} />
                          <Badge variant="outline" className="text-[10px] capitalize">{inst.scope}</Badge>
                          <Badge variant="outline" className="text-[10px]">v{inst.version}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {APP_TYPE_META[inst.appType]?.label ?? inst.appType} · {catMeta.label} · by {inst.developerName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Installed {timeAgo(inst.installedAt)} · Updated {timeAgo(inst.lastUpdatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busy === `${inst.id}-update`} onClick={() => action(inst.id, 'update', inst.appName)}>
                        {busy === `${inst.id}-update` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Update
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busy === `${inst.id}-rollback`} onClick={() => setRollbackFor(rollbackFor === inst.id ? null : inst.id)}>
                        <RotateCcw className="h-3 w-3" /> Rollback
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-red-400 hover:text-red-300" disabled={busy === `${inst.id}-uninstall`} onClick={() => action(inst.id, 'uninstall', inst.appName)}>
                        {busy === `${inst.id}-uninstall` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* Rollback panel */}
                  {rollbackFor === inst.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/30 p-2">
                      <span className="text-xs text-muted-foreground">Rollback to version:</span>
                      <Input placeholder="e.g. 1.0.0" value={rollbackVersion} onChange={(e) => setRollbackVersion(e.target.value)} className="h-7 w-28 text-xs" />
                      <Button size="sm" variant="default" className="h-7 text-xs" disabled={busy === `${inst.id}-rollback`} onClick={() => action(inst.id, 'rollback', inst.appName, rollbackVersion)}>
                        Confirm Rollback
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRollbackFor(null); setRollbackVersion('') }}>Cancel</Button>
                    </div>
                  )}

                  <Separator className="my-3 bg-border/50" />

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Sandbox quotas */}
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Sandbox Quotas</p>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Memory</span><span className="font-medium">{inst.memoryLimitMb} MB</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">CPU</span><span className="font-medium">{inst.cpuLimitPct}%</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">Storage</span><span className="font-medium">{inst.storageQuotaMb} MB</span></div>
                        <div className="flex items-center justify-between"><span className="text-muted-foreground">API/min</span><span className="font-medium">{inst.apiQuotaPerMin}</span></div>
                      </div>
                    </div>
                    {/* Granted permissions */}
                    <div className="lg:col-span-2">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Granted Permissions ({inst.grantedPermissions.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {inst.grantedPermissions.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">No permissions granted.</span>
                        ) : inst.grantedPermissions.slice(0, 8).map((p) => {
                          const perm = APP_PERMISSION_CATALOG.find((c) => c.key === p)
                          return (
                            <Badge key={p} variant="outline" className={`text-[9px] ${RISK_BADGE[perm?.risk ?? 'medium'] ?? ''}`}>
                              {perm?.label ?? p}
                            </Badge>
                          )
                        })}
                        {inst.grantedPermissions.length > 8 && <Badge variant="outline" className="text-[9px]">+{inst.grantedPermissions.length - 8} more</Badge>}
                      </div>
                    </div>
                    {/* Auto-update toggle */}
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Auto-Update</p>
                      <div className="flex items-center gap-2">
                        <Switch checked={inst.autoUpdate} onCheckedChange={(v) => toggleAutoUpdate(inst, v)} aria-label="Toggle auto-update" />
                        <span className="text-xs">{inst.autoUpdate ? 'Enabled' : 'Paused'}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {inst.sandboxEnabled ? '🛡️ Sandboxed' : '⚠️ Not sandboxed'} · {inst.networkRestricted ? 'Network restricted' : 'Network open'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: AI EMPLOYEES™
// ═══════════════════════════════════════════════════════════════════════════════
function AIEmployeesTab({ onRefresh }: { onRefresh: () => void }) {
  const [installing, setInstalling] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selected, setSelected] = useState<AIEmployeeAppDef | null>(null)
  const [installedSlugs, setInstalledSlugs] = useState<Set<string>>(new Set())

  // Load installed AI employees to mark already-installed ones
  useEffect(() => {
    apiGet<{ installed: AppInstallDTO[] }>('/apps/installed')
      .then((r) => setInstalledSlugs(new Set(r.installed.map((i) => i.appSlug))))
      .catch(() => {})
  }, [])

  const install = async (emp: AIEmployeeAppDef) => {
    setInstalling(emp.slug)
    try {
      // Try to find the matching app id via the store API
      const store = await apiGet<StoreBrowseResult>('/apps/store', { search: emp.name, type: 'ai_employee' })
      const app = store.apps.find((a) => a.slug === emp.slug || a.name === emp.name)
      if (!app) throw new Error('AI Employee app not yet published in the store')
      await apiPost('/apps/install', { appId: app.id, scope: 'tenant', grantedPermissions: emp.permissions })
      setInstalledSlugs((prev) => new Set(prev).add(emp.slug))
      setToast(`✅ ${emp.name} installed and auto-connected to engines.`)
      onRefresh()
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
    } finally { setInstalling(null) }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-semibold">AI Employees™ Marketplace</h2>
                <Badge variant="outline" className="bg-violet-500/15 text-violet-300 border-violet-500/20">{AI_EMPLOYEE_APPS.length} specialized</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Industry-specialized AI workers that auto-connect to AI CEO™, AI Workforce™, Digital Twin™, Business Graph™, Automation™, and Knowledge Graph™ engines.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_EMPLOYEE_APPS.map((emp, i) => {
          const catMeta = APP_CATEGORY_META[emp.industry] ?? { label: emp.industry, color: emp.color }
          const Icon = getIcon(emp.icon, Bot)
          const isInstalled = installedSlugs.has(emp.slug)
          return (
            <motion.div key={emp.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
              <Card className="group flex h-full flex-col border-border bg-muted/20 transition-all hover:border-violet-500/40 hover:bg-muted/30" style={{ borderLeftWidth: '3px', borderLeftColor: emp.color }}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${emp.color}20`, color: emp.color }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm">{emp.name}</CardTitle>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{emp.role} · {catMeta.label}</p>
                      </div>
                    </div>
                    {isInstalled && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{emp.description}</p>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {emp.capabilities.slice(0, 4).map((c) => (
                        <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{c}</span>
                      ))}
                      {emp.capabilities.length > 4 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">+{emp.capabilities.length - 4}</span>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Auto-Connect Engines</p>
                    <div className="flex flex-wrap gap-1">
                      {emp.autoConnectEngines.slice(0, 5).map((e) => (
                        <span key={e} className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300">{e.replace(/_/g, ' ')}</span>
                      ))}
                      {emp.autoConnectEngines.length > 5 && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300">+{emp.autoConnectEngines.length - 5}</span>}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setSelected(emp)}>
                      <Eye className="h-3 w-3" /> Details
                    </Button>
                    {isInstalled ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">✓ Installed</Badge>
                    ) : (
                      <Button size="sm" variant="default" className="h-7 gap-1 text-xs" disabled={installing === emp.slug} onClick={() => install(emp)}>
                        {installing === emp.slug ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Install
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* AI Employee detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (() => {
            const catMeta = APP_CATEGORY_META[selected.industry] ?? { label: selected.industry, color: selected.color }
            const Icon = getIcon(selected.icon, Bot)
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${selected.color}20`, color: selected.color }}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">{selected.name}</DialogTitle>
                      <DialogDescription>{selected.role} · {catMeta.label} Industry</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-foreground/90">{selected.description}</p>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
                    <ul className="grid grid-cols-2 gap-1">
                      {selected.capabilities.map((c) => (
                        <li key={c} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-emerald-400" /> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto-Connect Engines</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.autoConnectEngines.map((e) => (
                        <Badge key={e} variant="outline" className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-[10px]">
                          <Zap className="mr-1 h-2.5 w-2.5" />{e.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Permissions ({selected.permissions.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.permissions.map((p) => {
                        const perm = APP_PERMISSION_CATALOG.find((c) => c.key === p)
                        return (
                          <Badge key={p} variant="outline" className={`text-[10px] ${RISK_BADGE[perm?.risk ?? 'medium'] ?? ''}`}>
                            <Shield className="mr-1 h-2.5 w-2.5" />{perm?.label ?? p}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                  <Button disabled={installing === selected.slug} onClick={() => install(selected)}>
                    {installing === selected.slug ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Install {selected.name}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: DEVELOPER PORTAL™
// ═══════════════════════════════════════════════════════════════════════════════
function DeveloperPortalTab() {
  const [developers, setDevelopers] = useState<AppDeveloperDTO[]>([])
  const [selectedDev, setSelectedDev] = useState<string | null>(null)
  const [dash, setDash] = useState<DeveloperDashboardDTO | null>(null)
  const [loadingDevs, setLoadingDevs] = useState(true)
  const [loadingDash, setLoadingDash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ developers: AppDeveloperDTO[] } | AppDeveloperDTO[]>('/developers')
      .then((r) => {
        const list = Array.isArray(r) ? r : (r.developers ?? [])
        setDevelopers(list)
        if (list.length > 0) setSelectedDev(list[0].id)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingDevs(false))
  }, [])

  useEffect(() => {
    if (!selectedDev) return
    let cancelled = false
    const t = setTimeout(() => {
      setLoadingDash(true); setDash(null)
      apiGet<DeveloperDashboardDTO>('/app-platform/developer-dashboard', { developerId: selectedDev })
        .then((d) => { if (!cancelled) setDash(d) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoadingDash(false) })
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [selectedDev])

  const maxRev = Math.max(...(dash?.publishedApps.map((a) => a.installCount * a.priceAmount) ?? [1]), 1)

  return (
    <div className="space-y-4">
      {/* Developer selector */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold"><Code2 className="h-4 w-4 text-emerald-400" /> Developer Portal™</h2>
              <p className="text-xs text-muted-foreground">Build, publish, and monetize your apps on GSTPilot</p>
            </div>
            <Select value={selectedDev ?? ''} onValueChange={setSelectedDev}>
              <SelectTrigger className="h-9 w-64 text-xs"><SelectValue placeholder="Select developer" /></SelectTrigger>
              <SelectContent>
                {developers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.displayName}{d.verified ? ' ✓' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loadingDevs ? (
        <LoadingGrid count={4} className="h-32" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !dash ? (
        loadingDash ? <LoadingGrid count={4} className="h-32" /> : <EmptyState icon={Code2} title="No developer selected" subtitle="Select a developer above to view their dashboard." />
      ) : (
        <>
          {/* Developer profile */}
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 border border-border"><AvatarFallback className="bg-emerald-500/20 text-emerald-300">{dash.developer.displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{dash.developer.displayName}</h3>
                      {dash.developer.verified && <BadgeCheck className="h-5 w-5 text-sky-400" />}
                      <Badge variant="outline" className="capitalize bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px]">{dash.developer.partnerLevel} partner</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{dash.developer.email} · Joined {timeAgo(dash.developer.joinedAt)}</p>
                    <p className="text-[11px] text-muted-foreground">{dash.developer.bio ?? 'No bio provided.'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:text-right">
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">{inr(dash.developer.totalRevenue)}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Total Revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-cyan-400">{dash.developer.totalApps}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Published Apps</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-400">{dash.developer.avgRating}/5</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Avg Rating</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-violet-400">{dash.developer.revenueSharePct}%</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Revenue Share</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage analytics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Activity} label="API Calls" value={num(dash.usageAnalytics.apiCalls)} color="text-cyan-400" delay={0} />
            <StatCard icon={BrainCircuit} label="AI Usage" value={num(dash.usageAnalytics.aiUsage)} color="text-violet-400" delay={0.05} />
            <StatCard icon={Workflow} label="Automation Runs" value={num(dash.usageAnalytics.automationRuns)} color="text-amber-400" delay={0.1} />
            <StatCard icon={Download} label="Total Downloads" value={num(dash.totalDownloads)} color="text-emerald-400" delay={0.15} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Published apps */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="text-base">Published Apps ({dash.publishedApps.length})</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96 pr-3">
                  <div className="space-y-2">
                    {dash.publishedApps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No published apps yet.</p>
                    ) : dash.publishedApps.map((a) => (
                      <div key={a.id} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold" style={{ background: `${a.color}20`, color: a.color }}>{a.name.slice(0, 2).toUpperCase()}</div>
                            <div>
                              <p className="text-xs font-medium">{a.name}</p>
                              <p className="text-[10px] text-muted-foreground">v{a.version} · {a.developerName}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[9px] capitalize">{a.pricingModel}</Badge>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{a.rating}</span>
                          <span>{num(a.installCount)} installs</span>
                          <span className="text-emerald-400">{inr(a.installCount * a.priceAmount)}</span>
                        </div>
                        <Progress value={(a.installCount * a.priceAmount / maxRev) * 100} className="mt-1.5 h-1" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Revenue chart */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="text-base">Revenue by App</CardTitle></CardHeader>
              <CardContent>
                {dash.publishedApps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No revenue data yet.</p>
                ) : (
                  <div className="flex h-64 items-end gap-2">
                    {dash.publishedApps.slice(0, 12).map((a) => {
                      const rev = a.installCount * a.priceAmount
                      return (
                        <div key={a.id} className="group relative flex-1" title={`${a.name}: ${inr(rev)}`}>
                          <div className="w-full rounded-t bg-gradient-to-t from-emerald-500/40 to-cyan-500/60 transition-all hover:from-emerald-500/60 hover:to-cyan-500/80" style={{ height: `${Math.max((rev / maxRev) * 100, 3)}%` }} />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Crash reports */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-400" /> Crash Reports</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72 pr-3">
                  <div className="space-y-2">
                    {dash.crashReports.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No crashes reported. 🎉</p>
                    ) : dash.crashReports.map((c, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{c.appName}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(c.lastAt)}</p>
                        </div>
                        <Badge variant="outline" className="bg-red-500/10 text-red-300 border-red-500/20 text-[10px]">{c.count} crashes</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Releases */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4 text-violet-400" /> Recent Releases</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72 pr-3">
                  <div className="space-y-2">
                    {dash.releases.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No releases yet.</p>
                    ) : dash.releases.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs"><span className="font-medium">{r.app}</span> · v{r.version}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(r.publishedAt)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[r.status] ?? STATUS_BADGE.unknown}`}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* API Keys */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-amber-400" /> API Keys</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dash.apiKeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No API keys.</p>
                  ) : dash.apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                      <div>
                        <p className="text-xs font-medium">{k.name}</p>
                        <p className="text-[10px] text-muted-foreground">{k.scopes.length} scopes · {timeAgo(k.lastUsedAt)}</p>
                      </div>
                      <StatusBadge status={k.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CI/CD Pipelines */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Terminal className="h-4 w-4 text-cyan-400" /> CI/CD Pipelines</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72 pr-3">
                  <div className="space-y-2">
                    {dash.ciCdPipelines.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No pipelines configured.</p>
                    ) : dash.ciCdPipelines.map((p, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs"><span className="font-medium">{p.app}</span> · {p.branch}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(p.lastRunAt)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[p.status] ?? STATUS_BADGE.unknown}`}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Sandbox tests */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><FlaskConical className="h-4 w-4 text-amber-400" /> Sandbox Tests</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72 pr-3">
                  <div className="space-y-2">
                    {dash.sandboxTests.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No sandbox tests yet.</p>
                    ) : dash.sandboxTests.map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                        <div>
                          <p className="text-xs font-medium">{s.appName}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(s.at)} · {s.durationMs}ms</p>
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Webhook logs */}
            <Card className="border-border bg-muted/20">
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Webhook className="h-4 w-4 text-violet-400" /> Webhook Logs</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72 pr-3">
                  <div className="space-y-2">
                    {dash.webhookLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No webhook deliveries.</p>
                    ) : dash.webhookLogs.map((w, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <code className="text-xs text-foreground">{w.event}</code>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(w.deliveredAt)}</p>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function FlaskConical({ className }: { className?: string }) {
  return <Package className={className} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5: WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════════
function WebhooksTab() {
  const [hooks, setHooks] = useState<AppWebhookDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<{ webhooks: AppWebhookDTO[] } | AppWebhookDTO[]>('/webhooks')
      const list = Array.isArray(res) ? res : (res.webhooks ?? [])
      setHooks(list)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleEvent = (e: string) => {
    setSelectedEvents((prev) => {
      const n = new Set(prev)
      if (n.has(e)) n.delete(e); else n.add(e)
      return n
    })
  }

  const register = async () => {
    if (!name || !url || selectedEvents.size === 0) {
      setToast('⚠️ Name, URL, and at least one event type required.')
      return
    }
    setSubmitting(true)
    try {
      await apiPost('/webhooks/register', { name, targetUrl: url, eventTypes: Array.from(selectedEvents) })
      setToast('✅ Webhook registered successfully.')
      setName(''); setUrl(''); setSelectedEvents(new Set()); setShowForm(false)
      await load()
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Webhook className="h-5 w-5 text-violet-400" /> Webhook Subscriptions</h2>
          <p className="text-sm text-muted-foreground">{hooks.length} subscriptions · {STANDARD_WEBHOOK_EVENTS.length} standard events available</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          {showForm ? <XCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showForm ? 'Cancel' : 'Register Webhook'}
        </Button>
      </div>

      {/* Register form */}
      {showForm && (
        <Card className="border-violet-500/30 bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Register New Webhook</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input placeholder="My Webhook" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Target URL</label>
                <Input placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Event Types ({selectedEvents.size} selected)</label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {STANDARD_WEBHOOK_EVENTS.map((e) => (
                  <button
                    key={e.event}
                    onClick={() => toggleEvent(e.event)}
                    className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                      selectedEvents.has(e.event) ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm border ${selectedEvents.has(e.event) ? 'border-violet-400 bg-violet-400' : 'border-muted-foreground/40'}`} />
                    <div>
                      <p className="font-medium">{e.label}</p>
                      <p className="text-[9px] opacity-70">{e.event}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" disabled={submitting} onClick={register}>
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Register Webhook
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-28 animate-pulse bg-muted/20" />)}</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : hooks.length === 0 ? (
        <EmptyState icon={Webhook} title="No webhooks registered" subtitle="Click 'Register Webhook' to subscribe to platform events." />
      ) : (
        <div className="grid gap-3">
          {hooks.map((h) => {
            const successRate = h.deliveryCount > 0 ? Math.round((h.successCount / h.deliveryCount) * 100) : 0
            return (
              <Card key={h.id} className="border-border bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{h.name}</h3>
                        <StatusBadge status={h.status} />
                      </div>
                      <code className="mt-0.5 block truncate text-xs text-cyan-400">{h.targetUrl}</code>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.eventTypes.slice(0, 6).map((e) => (
                          <Badge key={e} variant="secondary" className="text-[9px]">{e}</Badge>
                        ))}
                        {h.eventTypes.length > 6 && <Badge variant="outline" className="text-[9px]">+{h.eventTypes.length - 6}</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[260px]">
                      <div>
                        <p className="text-lg font-bold text-foreground">{num(h.deliveryCount)}</p>
                        <p className="text-[9px] uppercase text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{num(h.successCount)}</p>
                        <p className="text-[9px] uppercase text-muted-foreground">Success</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-400">{num(h.failureCount)}</p>
                        <p className="text-[9px] uppercase text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-3 bg-border/50" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Success rate:</span>
                      <Progress value={successRate} className="h-1.5 w-24" />
                      <span className={`text-xs font-medium ${successRate >= 95 ? 'text-emerald-400' : successRate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>{successRate}%</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Last delivery: {timeAgo(h.lastDeliveryAt)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Standard events catalog */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-amber-400" /> Standard Events Catalog ({STANDARD_WEBHOOK_EVENTS.length})</CardTitle>
          <CardDescription className="text-xs">All platform events developers can subscribe to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STANDARD_WEBHOOK_EVENTS.map((e) => (
              <div key={e.event} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                <div className="flex items-center justify-between">
                  <code className="text-xs font-semibold text-amber-300">{e.event}</code>
                  <Badge variant="outline" className="text-[9px]">{e.module}</Badge>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{e.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Plus({ className }: { className?: string }) {
  return <ArrowUpRight className={className} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6: PLUGINS
// ═══════════════════════════════════════════════════════════════════════════════
function PluginsTab() {
  const [plugins, setPlugins] = useState<AppPluginDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiGet<{ plugins: AppPluginDTO[] } | AppPluginDTO[]>('/plugins')
      const list = Array.isArray(res) ? res : (res.plugins ?? [])
      setPlugins(list)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const togglePlugin = async (p: AppPluginDTO, value: boolean) => {
    setToggling(p.id)
    try {
      // Try a PATCH-style update via POST /plugins (most backends accept {pluginId, enabled})
      await apiPost('/plugins', { pluginId: p.id, enabled: value }).catch(() => {})
      setToast(value ? `✅ ${p.name} enabled.` : `⏸️ ${p.name} disabled.`)
      await load()
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
    } finally { setToggling(null) }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Plug className="h-5 w-5 text-emerald-400" /> Installed Plugins</h2>
          <p className="text-sm text-muted-foreground">{plugins.length} plugins · {plugins.filter((p) => p.enabled).length} enabled</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingGrid count={6} className="h-40" />
      ) : error ? (
        <ErrorState message={error} />
      ) : plugins.length === 0 ? (
        <EmptyState icon={Plug} title="No plugins installed" subtitle="Plugins extend the platform without modifying core code." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <Card className={`border-border bg-muted/20 ${p.enabled ? '' : 'opacity-60'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Plug className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <code className="text-[10px] text-muted-foreground">{p.pluginKey}</code>
                      </div>
                    </div>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(v) => togglePlugin(p, v)}
                      disabled={toggling === p.id}
                      aria-label={`Toggle ${p.name}`}
                    />
                  </div>
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Extension Points ({p.extensionPoints.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {p.extensionPoints.slice(0, 6).map((ep) => {
                        const meta = EXTENSION_POINTS_META.find((m) => m.key === ep)
                        return (
                          <Badge key={ep} variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                            {meta?.label ?? ep}
                          </Badge>
                        )
                      })}
                      {p.extensionPoints.length > 6 && <Badge variant="outline" className="text-[9px]">+{p.extensionPoints.length - 6}</Badge>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <StatusBadge status={p.status} />
                    <span>Created {timeAgo(p.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Extension points reference */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-cyan-400" /> Extension Points Reference ({EXTENSION_POINTS_META.length})</CardTitle>
          <CardDescription className="text-xs">12 hook points where plugins can extend the platform without modifying core code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EXTENSION_POINTS_META.map((ep) => {
              const Icon = getIcon(ep.key === 'navigation' ? 'AppWindow' : ep.key === 'dashboard' ? 'LayoutDashboard' : ep.key === 'widget' ? 'LayoutGrid' : ep.key === 'report' ? 'FileBarChart' : ep.key === 'ai_agent' ? 'Bot' : ep.key === 'command' ? 'Terminal' : ep.key === 'automation' ? 'Workflow' : ep.key === 'notification' ? 'Bell' : ep.key === 'menu' ? 'LayoutGrid' : ep.key === 'page' ? 'FileCode' : ep.key === 'settings' ? 'Settings2' : 'Search', Plug)
              return (
                <div key={ep.key} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-cyan-400" />
                    <code className="text-xs font-semibold">{ep.key}</code>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{ep.description}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 7: MONETIZATION™
// ═══════════════════════════════════════════════════════════════════════════════
function MonetizationTab() {
  const [data, setData] = useState<MonetizationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<MonetizationSummary>('/app-platform/monetization')
      .then(setData).catch((e) => setError((e as Error).message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingGrid count={6} className="h-32" />
  if (error) return <ErrorState message={error} />
  if (!data) return <EmptyState icon={TrendingUp} title="No monetization data" subtitle="Monetization data will appear here once apps are published." />

  const platformFeePct = data.grossRevenue > 0 ? Math.round((data.platformFee / data.grossRevenue) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={DollarSign} label="Gross Revenue" value={inr(data.grossRevenue)} color="text-emerald-400" delay={0} />
        <StatCard icon={Receipt} label="Platform Fee (30%)" value={inr(data.platformFee)} sub={`${platformFeePct}% of gross`} color="text-amber-400" delay={0.05} />
        <StatCard icon={Wallet} label="Dev Payouts" value={inr(data.developerPayouts)} color="text-cyan-400" delay={0.1} />
        <StatCard icon={Clock} label="Pending Payouts" value={inr(data.pendingPayouts)} color="text-violet-400" delay={0.15} />
        <StatCard icon={Activity} label="Transactions" value={num(data.totalTransactions)} color="text-sky-400" delay={0.2} />
        <StatCard icon={Crown} label="Active Subs" value={num(data.activeSubscriptions)} color="text-pink-400" delay={0.25} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pricing breakdown */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4 text-violet-400" /> App Pricing Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <PricingRow label="Free Apps" count={data.freeApps} total={data.freeApps + data.paidApps + data.subscriptionApps + data.enterpriseApps} color="bg-emerald-500" icon={CheckCircle} />
            <PricingRow label="Paid (one-time)" count={data.paidApps} total={data.freeApps + data.paidApps + data.subscriptionApps + data.enterpriseApps} color="bg-sky-500" icon={DollarSign} />
            <PricingRow label="Subscription" count={data.subscriptionApps} total={data.freeApps + data.paidApps + data.subscriptionApps + data.enterpriseApps} color="bg-violet-500" icon={Crown} />
            <PricingRow label="Enterprise" count={data.enterpriseApps} total={data.freeApps + data.paidApps + data.subscriptionApps + data.enterpriseApps} color="bg-pink-500" icon={Building2} />
            <Separator className="bg-border/50" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg Revenue / App</span>
              <span className="font-semibold text-emerald-400">{inr(data.avgRevenuePerApp)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Top earners */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4 text-amber-400" /> Top Earners</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72 pr-3">
              <div className="space-y-2">
                {data.topEarners.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No top earners yet.</p>
                ) : data.topEarners.map((e, i) => (
                  <div key={e.developerId} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-300' : i === 1 ? 'bg-slate-400/20 text-slate-200' : i === 2 ? 'bg-orange-700/20 text-orange-300' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="text-[10px] text-muted-foreground">{e.apps} apps published</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">{inr(e.revenue)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent payouts */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-cyan-400" /> Recent Payouts</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96 pr-3">
            <div className="space-y-2">
              {data.recentPayouts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payouts yet.</p>
              ) : data.recentPayouts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{p.developerName}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{p.period} · {p.transactionCount} transactions · {p.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-400">{inr(p.netPayout)}</p>
                    <p className="text-[10px] text-muted-foreground">gross {inr(p.grossRevenue)} · fee {inr(p.platformFee)}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function PricingRow({ label, count, total, color, icon: Icon }: { label: string; count: number; total: number; color: string; icon: React.ElementType }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5"><Icon className="h-3 w-3 text-muted-foreground" />{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 8: ANALYTICS™
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const [data, setData] = useState<AppAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<AppAnalyticsSummary>('/apps/analytics', { days: '30' })
      .then(setData).catch((e) => setError((e as Error).message)).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingGrid count={6} className="h-32" />
  if (error) return <ErrorState message={error} />
  if (!data) return <EmptyState icon={BarChart3} title="No analytics data" subtitle="Analytics will appear once apps are installed and used." />

  const maxInstalls = Math.max(...data.timeseries.map((t) => t.installs), 1)
  const maxApi = Math.max(...data.timeseries.map((t) => t.apiCalls), 1)
  const maxRev = Math.max(...data.timeseries.map((t) => t.revenue), 1)
  const maxErrors = Math.max(...data.timeseries.map((t) => t.errors), 1)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Download} label="Total Installs" value={num(data.totalInstalls)} color="text-emerald-400" delay={0} />
        <StatCard icon={Trash2} label="Uninstalls" value={num(data.totalUninstalls)} color="text-red-400" delay={0.05} />
        <StatCard icon={Boxes} label="Active Installs" value={num(data.activeInstalls)} color="text-cyan-400" delay={0.1} />
        <StatCard icon={DollarSign} label="Revenue" value={inr(data.totalRevenue)} color="text-amber-400" delay={0.15} />
        <StatCard icon={Activity} label="API Calls" value={num(data.totalApiCalls)} color="text-sky-400" delay={0.2} />
        <StatCard icon={Star} label="Avg Rating" value={`${data.avgRating}/5`} sub={`${num(data.totalReviews)} reviews`} color="text-violet-400" delay={0.25} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={AlertCircle} label="Errors" value={num(data.totalErrors)} color="text-orange-400" delay={0} />
        <StatCard icon={AlertTriangle} label="Crashes" value={num(data.totalCrashes)} color="text-red-400" delay={0.05} />
        <StatCard icon={Activity} label="Retention Rate" value={`${data.retentionRate}%`} color="text-emerald-400" delay={0.1} />
        <StatCard icon={BrainCircuit} label="AI Usage" value={num(data.aiUsageCalls)} color="text-violet-400" delay={0.15} />
        <StatCard icon={Workflow} label="Automation Runs" value={num(data.automationRuns)} color="text-amber-400" delay={0.2} />
        <StatCard icon={Cpu} label="Total Reviews" value={num(data.totalReviews)} color="text-cyan-400" delay={0.25} />
      </div>

      {/* 30-day timeseries */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">30-Day Platform Activity</CardTitle>
          <CardDescription className="text-xs">Installs, Revenue, API calls, and Errors over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-emerald-400">Daily Installs</p>
              <div className="flex h-32 items-end gap-0.5">
                {data.timeseries.map((t) => (
                  <div key={t.date} className="group relative flex-1" title={`${t.date}: ${t.installs} installs`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-400/60" style={{ height: `${Math.max((t.installs / maxInstalls) * 100, 2)}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-amber-400">Daily Revenue</p>
              <div className="flex h-32 items-end gap-0.5">
                {data.timeseries.map((t) => (
                  <div key={t.date} className="group relative flex-1" title={`${t.date}: ${inr(t.revenue)}`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-amber-500/40 to-amber-400/60" style={{ height: `${Math.max((t.revenue / maxRev) * 100, 2)}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-sky-400">Daily API Calls</p>
              <div className="flex h-32 items-end gap-0.5">
                {data.timeseries.map((t) => (
                  <div key={t.date} className="group relative flex-1" title={`${t.date}: ${num(t.apiCalls)} calls`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-sky-500/40 to-sky-400/60" style={{ height: `${Math.max((t.apiCalls / maxApi) * 100, 2)}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-red-400">Daily Errors</p>
              <div className="flex h-32 items-end gap-0.5">
                {data.timeseries.map((t) => (
                  <div key={t.date} className="group relative flex-1" title={`${t.date}: ${t.errors} errors`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-red-500/40 to-red-400/60" style={{ height: `${Math.max((t.errors / maxErrors) * 100, 2)}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* By category */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4 text-emerald-400" /> By Category</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80 pr-3">
              <div className="space-y-2">
                {data.byCategory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No category data.</p>
                ) : data.byCategory.map((c) => {
                  const meta = APP_CATEGORY_META[c.category] ?? { label: c.category, color: '#888' }
                  return (
                    <div key={c.category} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-medium">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                          {c.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.apps} apps</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{num(c.installs)} installs</span>
                        <span className="text-emerald-400">{inr(c.revenue)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* By type */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><LayoutGrid className="h-4 w-4 text-cyan-400" /> By Type</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {data.byType.length === 0 ? (
                <p className="text-xs text-muted-foreground">No type data.</p>
              ) : data.byType.map((t) => {
                const meta = APP_TYPE_META[t.type] ?? { label: t.type }
                const Icon = getIcon(meta.icon)
                return (
                  <div key={t.type} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="text-xs font-medium">{meta.label}</span>
                    </div>
                    <p className="mt-1 text-lg font-bold">{num(t.count)}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 apps */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4 text-amber-400" /> Top 10 Apps</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96 pr-3">
            <div className="space-y-2">
              {data.topApps.length === 0 ? (
                <p className="text-xs text-muted-foreground">No top apps yet.</p>
              ) : data.topApps.slice(0, 10).map((a, i) => (
                <div key={a.appId} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-300' : i === 1 ? 'bg-slate-400/20 text-slate-200' : i === 2 ? 'bg-orange-700/20 text-orange-300' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{a.rating}</span>
                      <span>{num(a.installs)} installs</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400">{inr(a.revenue)}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 9: AI BUILDER™
// ═══════════════════════════════════════════════════════════════════════════════
const BUILDER_INTENT_TEMPLATES: { label: string; command: string }[] = [
  { label: 'Build a CRM Extension', command: 'Build a CRM extension' },
  { label: 'Create Invoice Dashboard', command: 'Create an invoice dashboard' },
  { label: 'Generate HR Workflow', command: 'Generate an HR workflow' },
  { label: 'Create AI Employee', command: 'Create an AI employee' },
  { label: 'Generate Report', command: 'Generate a custom report' },
  { label: 'Create Automation', command: 'Create an automation workflow' },
  { label: 'Build Finance App', command: 'Build a finance app' },
  { label: 'Create Widget', command: 'Create a custom widget' },
  { label: 'Build Connector', command: 'Build a data connector' },
  { label: 'Deploy App', command: 'Deploy and publish an app' },
]

function AIBuilderTab() {
  const [command, setCommand] = useState('')
  const [generating, setGenerating] = useState(false)
  const [spec, setSpec] = useState<GeneratedAppSpec | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const generate = async (cmd?: string) => {
    const c = (cmd ?? command).trim()
    if (!c) { setToast('⚠️ Type a command first.'); return }
    setGenerating(true); setError(null); setSpec(null)
    try {
      const res = await apiPost<{ spec: GeneratedAppSpec }>('/app-platform/ai-builder', { command: c })
      setSpec(res.spec)
      setToast('✅ App spec generated.')
    } catch (e) {
      setError((e as Error).message)
      setToast(`❌ ${(e as Error).message}`)
    } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* SDK header */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-semibold">Oracle™ AI App Builder</h2>
                <Badge variant="outline" className="bg-violet-500/15 text-violet-300 border-violet-500/20">Extension SDK v{EXTENSION_SDK.version}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe the app you want — Oracle generates a complete app spec with permissions, extension points, features, and an SDK template.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-muted/50 px-2 py-1">{EXTENSION_SDK.languages.length} languages</span>
                <span className="rounded-md bg-muted/50 px-2 py-1">{EXTENSION_SDK.templates.length} templates</span>
                <span className="rounded-md bg-muted/50 px-2 py-1">{EXTENSION_SDK.cliCommands.length} CLI commands</span>
                {EXTENSION_SDK.emulatorEnabled && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">Emulator</span>}
                {EXTENSION_SDK.packagingEnabled && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">Packaging</span>}
                {EXTENSION_SDK.publishingEnabled && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">Publishing</span>}
                {EXTENSION_SDK.liveReloadEnabled && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-300">Live Reload</span>}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20 border border-violet-500/30">
                <Rocket className="h-8 w-8 text-violet-400" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Command input */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-violet-400" /> Describe Your App</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. Build a CRM extension that tracks leads and sends WhatsApp notifications..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            rows={3}
            className="text-sm"
            aria-label="App builder command"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">Oracle will generate a complete spec — name, slug, type, permissions, features, extension points, SDK template.</p>
            <Button size="sm" disabled={generating} onClick={() => generate()}>
              {generating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick-action templates */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Quick-Action Templates (10)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {BUILDER_INTENT_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => { setCommand(t.command); generate(t.command) }}
                disabled={generating}
                className="group flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-left text-xs transition-all hover:border-violet-500/40 hover:bg-background/60 disabled:opacity-50"
              >
                <ArrowRight className="h-3 w-3 text-violet-400" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} />}

      {/* Generated spec */}
      {spec && spec.ready && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><CheckCircle className="h-5 w-5 text-emerald-400" /> Generated App Spec</CardTitle>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20">Ready to Build</Badge>
              </div>
              <CardDescription className="text-xs">Estimated build time: {spec.estimatedBuildTimeMin} minutes via Extension SDK v{EXTENSION_SDK.version}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Identity */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Name</p>
                  <p className="text-sm font-semibold">{spec.name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Slug</p>
                  <code className="text-sm text-cyan-400">{spec.slug}</code>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const Icon = getIcon(APP_TYPE_META[spec.type]?.icon, Boxes)
                      return <Icon className="h-3.5 w-3.5 text-violet-400" />
                    })()}
                    <span className="text-sm">{APP_TYPE_META[spec.type]?.label ?? spec.type}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: APP_CATEGORY_META[spec.category]?.color ?? '#888' }} />
                    <span className="text-sm">{APP_CATEGORY_META[spec.category]?.label ?? spec.category}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Tagline</p>
                <p className="text-sm">{spec.tagline}</p>
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="text-sm leading-relaxed text-foreground/90">{spec.description}</p>
              </div>

              {/* Features */}
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Features ({spec.features.length})</p>
                <ul className="grid grid-cols-2 gap-1">
                  {spec.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 text-emerald-400" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Extension points */}
              {spec.extensionPoints.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Extension Points ({spec.extensionPoints.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.extensionPoints.map((ep) => {
                      const meta = EXTENSION_POINTS_META.find((m) => m.key === ep)
                      return (
                        <Badge key={ep} variant="outline" className="text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/20">
                          <Layers className="mr-1 h-2.5 w-2.5" />{meta?.label ?? ep}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Permissions */}
              {spec.permissions.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Permissions ({spec.permissions.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.permissions.map((p: AppPermission) => {
                      const perm = APP_PERMISSION_CATALOG.find((c) => c.key === p)
                      return (
                        <Badge key={p} variant="outline" className={`text-[10px] ${RISK_BADGE[perm?.risk ?? 'medium'] ?? ''}`}>
                          <Shield className="mr-1 h-2.5 w-2.5" />{perm?.label ?? p}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Pricing + template */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pricing Model</p>
                  <Badge variant="outline" className={`mt-1 text-xs ${PRICING_BADGE[spec.pricingModel] ?? ''}`}>{spec.pricingModel}</Badge>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Price</p>
                  <p className="text-sm font-semibold">{spec.priceAmount > 0 ? inr(spec.priceAmount) : 'Free'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">SDK Template</p>
                  <code className="text-sm text-cyan-400">{spec.sdkTemplate}</code>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" className="gap-1.5">
                  <Rocket className="h-4 w-4" /> Scaffold with SDK
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Terminal className="h-4 w-4" /> View CLI Commands
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Package className="h-4 w-4" /> Package
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Upload className="h-4 w-4" /> Publish
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Extension SDK info */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-4 w-4 text-emerald-400" /> SDK Languages ({EXTENSION_SDK.languages.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXTENSION_SDK.languages.map((l) => (
                <div key={l.key} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{l.logo}</span>
                    <div>
                      <p className="text-xs font-medium">{l.name}</p>
                      <p className="text-[9px] text-muted-foreground">v{l.minVersion}+</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileCode className="h-4 w-4 text-cyan-400" /> SDK Templates ({EXTENSION_SDK.templates.length})</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72 pr-3">
              <div className="space-y-1.5">
                {EXTENSION_SDK.templates.map((t) => (
                  <div key={t.key} className="rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5">
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-medium text-cyan-400">{t.key}</code>
                      <Badge variant="outline" className="text-[9px]">{APP_TYPE_META[t.type]?.label ?? t.type}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t.name} — {t.description}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* CLI commands */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Terminal className="h-4 w-4 text-violet-400" /> CLI Commands ({EXTENSION_SDK.cliCommands.length})</CardTitle>
          <CardDescription className="text-xs">CLI v{EXTENSION_SDK.cliVersion} · {EXTENSION_SDK.testingFrameworks.length} testing frameworks supported</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EXTENSION_SDK.cliCommands.map((c) => (
              <div key={c.command} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-1.5">
                <code className="text-xs font-mono text-emerald-300 shrink-0">{c.command}</code>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{c.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
