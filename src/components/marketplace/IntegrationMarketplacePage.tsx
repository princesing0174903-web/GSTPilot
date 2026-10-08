'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Store, Plug, Activity, RefreshCw, BarChart3, Code2, ShieldCheck, Search,
  Zap, Star, CheckCircle, XCircle, Clock, AlertTriangle, Download, Trash2,
  Link2, Link2Off, PlayCircle, FlaskConical, Cpu, Globe, Webhook, KeyRound,
  TrendingUp, Database, Server, AlertCircle, ChevronRight, Sparkles, Boxes,
  ArrowRight, CircuitBoard, Network, FileCode, BadgeCheck, Lock, Eye,
} from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'

// ── Types matching API responses ──────────────────────────────────────────────
interface ConnectorCatalogEntry {
  slug: string; name: string; displayName: string; category: string; provider: string
  description: string; logo: string; color: string; authType: string; pricing: string
  rating: number; reviews: number; installs: number; popularity: number
  verified: boolean; featured?: boolean; supportedFeatures: string[]
  capabilities: string[]; healthStatus: string; version: string; developer?: string; tags: string[]
}
interface MarketplaceData {
  connectors: ConnectorCatalogEntry[]; total: number
  categories: { category: string; label: string; count: number; icon: string }[]
  page: number; pageSize: number
}
interface InstalledIntegration {
  id: string; connectorSlug: string; displayName: string; status: string; health: string
  authType: string; connectedAccountId: string | null; lastSyncAt: string | null
  syncFrequency: string; lastError: string | null; installedAt: string
  connector?: ConnectorCatalogEntry
}
interface HealthData {
  overall: string; totalConnectors: number; operational: number; degraded: number; down: number
  installedCount: number; healthyInstalled: number; degradedInstalled: number; downInstalled: number
  eventsLastHour: number; syncsLastHour: number; failuresLastHour: number
  connectors: { slug: string; name: string; status: string; icon: string }[]
}
interface EventBusStats {
  total: number; lastHour: number; last24h: number; consumed: number; unconsumed: number
  byEventType: { eventType: string; count: number }[]
  byConnector: { connectorSlug: string; count: number }[]
}
interface IntegrationEvent {
  id: string; connectorSlug: string; eventType: string; source: string; severity: string
  payload: Record<string, unknown>; consumed: boolean; consumedBy: string | null; publishedAt: string
}
interface SyncJob {
  id: string; type: string; status: string; direction: string; recordsProcessed: number
  recordsCreated: number; recordsUpdated: number; recordsFailed: number; conflictCount: number
  retryCount: number; startedAt: string; completedAt: string | null; durationMs: number | null; error: string | null
}
interface SyncEngineStatus {
  jobsLastHour: number; jobsLast24h: number; successRate: number; avgDurationMs: number
  totalRecordsSynced: number; conflictsResolved: number; retriedJobs: number; queuedJobs: number; runningJobs: number
}
interface AnalyticsData {
  totalApiCalls: number; totalSyncSuccess: number; totalSyncFailed: number; totalEventsPublished: number
  totalRecordsSynced: number; avgLatencyMs: number; totalErrors: number; totalAutomationTriggered: number
  totalAiUsage: number; totalRevenueImpact: number; avgHealthScore: number; syncSuccessRate: number
  byConnector: { connectorSlug: string; displayName: string; apiCalls: number; syncSuccess: number; syncFailed: number; eventsPublished: number; avgLatencyMs: number; healthScore: number; revenueImpact: number; status: string }[]
  timeseries: { date: string; apiCalls: number; events: number; errors: number }[]
}
interface DeveloperData {
  submissions: { id: string; name: string; slug: string; category: string; status: string; developer: string; version: string; submittedAt: string; sdkVersion: string; certification: string; revenueSharePct: number }[]
  sdk: { version: string; languages: string[]; endpoints: number; publishedConnectors: number; totalRevenue: number }
  certifications: { level: string; count: number; requirements: string[] }[]
}
interface SecurityData {
  apiKeys: { id: string; name: string; keyPrefix: string; scopes: string[]; lastUsedAt: string | null }[]
  oauthProviders: { name: string; connected: boolean; authType: string }[]
  webhooks: { id: string; url: string; connectorSlug: string; verified: boolean; lastDelivery: string | null; successRate: number }[]
  rateLimits: { connectorSlug: string; limit: number; used: number; remaining: number; resetAt: string }[]
  auditEvents: { id: string; action: string; actor: string; summary: string; severity: string; timestamp: string }[]
  securityMeasures: { name: string; enabled: boolean; description: string }[]
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const num = (n: number) => n.toLocaleString('en-IN')

const STATUS_BADGE: Record<string, string> = {
  connected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  healthy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  operational: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  installed: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  certified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  syncing: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  running: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  queued: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  in_review: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  degraded: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  disconnected: 'bg-muted text-muted-foreground border-border',
  error: 'bg-red-500/15 text-red-300 border-red-500/20',
  failed: 'bg-red-500/15 text-red-300 border-red-500/20',
  down: 'bg-red-500/15 text-red-300 border-red-500/20',
  draft: 'bg-muted text-muted-foreground border-border',
  none: 'bg-muted text-muted-foreground border-border',
  unknown: 'bg-muted text-muted-foreground border-border',
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function IntegrationMarketplacePage() {
  const [tab, setTab] = useState('marketplace')
  const [health, setHealth] = useState<HealthData | null>(null)

  const refreshHealth = useCallback(() => {
    apiGet<HealthData>('/integrations/health').then(setHealth).catch(() => {})
  }, [])

  useEffect(() => { apiGet<HealthData>('/integrations/health').then(setHealth).catch(() => {}) }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20">
                  <CircuitBoard className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Global Integration Marketplace™</h1>
                  <p className="text-sm text-muted-foreground">Connect Every Business. Power Every Workflow. One AI Operating System.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatPill icon={Boxes} label="Connectors" value={health ? num(health.totalConnectors) : '—'} color="text-emerald-400" />
              <StatPill icon={Plug} label="Connected" value={health ? String(health.installedCount) : '—'} color="text-cyan-400" />
              <StatPill icon={Activity} label="Events/hr" value={health ? String(health.eventsLastHour) : '—'} color="text-amber-400" />
              <StatPill icon={CheckCircle} label="Health" value={health?.overall ?? '—'} color="text-emerald-400" />
            </div>
          </div>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="marketplace" className="gap-1.5"><Store className="h-4 w-4" /> Marketplace</TabsTrigger>
            <TabsTrigger value="installed" className="gap-1.5"><Plug className="h-4 w-4" /> My Integrations</TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5"><Zap className="h-4 w-4" /> Event Bus</TabsTrigger>
            <TabsTrigger value="sync" className="gap-1.5"><RefreshCw className="h-4 w-4" /> Sync Engine</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
            <TabsTrigger value="developer" className="gap-1.5"><Code2 className="h-4 w-4" /> Developer</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Security</TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace"><MarketplaceTab onRefresh={refreshHealth} /></TabsContent>
          <TabsContent value="installed"><InstalledTab onRefresh={refreshHealth} /></TabsContent>
          <TabsContent value="events"><EventBusTab /></TabsContent>
          <TabsContent value="sync"><SyncTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="developer"><DeveloperTab /></TabsContent>
          <TabsContent value="security"><SecurityTab /></TabsContent>
        </Tabs>

        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>VEYRO Global Integration Marketplace™ — 2,000+ connectors · 10M+ connected accounts · Universal Data Sync™ · Event Bus™</p>
          <p className="mt-1">Founded, developed and owned by Prince Singh.</p>
        </footer>
      </div>
    </div>
  )
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE TAB — browse 2,000+ connectors
// ═══════════════════════════════════════════════════════════════════════════════
function MarketplaceTab({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<MarketplaceData | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<MarketplaceData>('/integrations/marketplace', {
        search, category, pageSize: '48',
      })
      setData(res)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [search, category])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const install = async (slug: string, name: string) => {
    setInstalling(slug)
    try {
      await apiPost('/integrations/install', { connectorSlug: slug })
      setToast(`✅ ${name} installed. Connect it from My Integrations.`)
      onRefresh()
      setTimeout(() => setToast(null), 3500)
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
      setTimeout(() => setToast(null), 3500)
    } finally { setInstalling(null) }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 right-4 z-50 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm">{toast}</p>
        </motion.div>
      )}

      {/* Search + filters */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search 2,000+ integrations... (Shopify, Slack, Stripe, GSTN)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <CategoryChip label="All" active={category === 'all'} onClick={() => setCategory('all')} count={data?.total ?? 0} />
              {data?.categories.slice(0, 8).map((c) => (
                <CategoryChip key={c.category} label={c.label} active={category === c.category} onClick={() => setCategory(c.category)} count={c.count} />
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data?.categories.slice(8).map((c) => (
              <CategoryChip key={c.category} label={c.label} active={category === c.category} onClick={() => setCategory(c.category)} count={c.count} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${num(data?.total ?? 0)} connectors available`}
          {category !== 'all' && data?.categories.find((c) => c.category === category) && ` in ${data.categories.find((c) => c.category === category)!.label}`}
        </p>
      </div>

      {/* Connector grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="border-border bg-muted/20 animate-pulse h-56" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.connectors.map((c, i) => (
            <motion.div key={c.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
              <Card className="group flex h-full flex-col border-border bg-muted/20 transition-all hover:border-emerald-500/40 hover:bg-muted/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xl" style={{ background: `${c.color}20` }}>
                        {c.logo}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-sm">{c.displayName}</CardTitle>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.category.replace('-', ' ')}</p>
                      </div>
                    </div>
                    {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {c.supportedFeatures.slice(0, 3).map((f) => (
                      <span key={f} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{f}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{c.rating}</span>
                      <span>·</span>
                      <span>{num(c.installs)}</span>
                    </div>
                    <Button
                      size="sm" variant="default" className="h-7 gap-1 text-xs"
                      disabled={installing === c.slug}
                      onClick={() => install(c.slug, c.displayName)}
                    >
                      {installing === c.slug ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Install
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
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

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALLED TAB — my integrations with connect/sync/test
// ═══════════════════════════════════════════════════════════════════════════════
function InstalledTab({ onRefresh }: { onRefresh: () => void }) {
  const [installed, setInstalled] = useState<InstalledIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ installed: InstalledIntegration[] }>('/integrations/installed')
      setInstalled(res.installed)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const action = async (id: string, actionType: 'connect' | 'disconnect' | 'sync' | 'test' | 'uninstall', name: string) => {
    setBusy(`${id}-${actionType}`)
    try {
      if (actionType === 'connect') {
        await apiPost('/integrations/connect', { installationId: id, connectedAccountId: `user@${name.toLowerCase().replace(/\s+/g, '')}.com`, scopes: [] })
        setToast(`✅ ${name} connected.`)
      } else if (actionType === 'disconnect') {
        await apiPost('/integrations/disconnect', { installationId: id })
        setToast(`⚠️ ${name} disconnected.`)
      } else if (actionType === 'sync') {
        const res = await apiPost<{ job: SyncJob }>('/integrations/sync', { installationId: id })
        setToast(`🔄 ${name} sync ${res.job.status}: ${res.job.recordsProcessed} records in ${res.job.durationMs}ms.`)
      } else if (actionType === 'test') {
        const res = await apiPost<{ success: boolean; latencyMs: number; message: string }>('/integrations/test', { installationId: id })
        setToast(`${res.success ? '✅' : '❌'} ${res.message}`)
      } else if (actionType === 'uninstall') {
        await apiPost('/integrations/uninstall', { installationId: id })
        setToast(`🗑️ ${name} uninstalled.`)
      }
      onRefresh()
      await load()
      setTimeout(() => setToast(null), 4000)
    } catch (e) {
      setToast(`❌ ${(e as Error).message}`)
      setTimeout(() => setToast(null), 4000)
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 right-4 z-50 max-w-md rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm">{toast}</p>
        </motion.div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Integrations</h2>
          <p className="text-sm text-muted-foreground">{installed.length} installed · {installed.filter((i) => i.status === 'connected').length} connected</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-28 animate-pulse bg-muted/20" />)}</div>
      ) : installed.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Plug className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No integrations installed yet</p>
            <p className="text-xs text-muted-foreground">Browse the Marketplace to install your first connector.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {installed.map((inst) => (
            <Card key={inst.id} className="border-border bg-muted/20">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg text-xl" style={{ background: `${inst.connector?.color ?? '#888'}20` }}>
                      {inst.connector?.logo ?? '🔌'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{inst.displayName}</h3>
                        <Badge variant="outline" className={STATUS_BADGE[inst.status] ?? STATUS_BADGE.unknown}>{inst.status}</Badge>
                        {inst.health === 'healthy' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                        {inst.health === 'degraded' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {inst.connector?.category.replace('-', ' ')} · {inst.authType} · {inst.connectedAccountId ?? 'not connected'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Last sync: {timeAgo(inst.lastSyncAt)} · {inst.syncFrequency}</p>
                      {inst.lastError && <p className="text-[11px] text-red-400">⚠️ {inst.lastError}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inst.status !== 'connected' && (
                      <Button size="sm" variant="default" className="h-8 gap-1 text-xs" disabled={busy === `${inst.id}-connect`} onClick={() => action(inst.id, 'connect', inst.displayName)}>
                        {busy === `${inst.id}-connect` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Connect
                      </Button>
                    )}
                    {inst.status === 'connected' && (
                      <>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busy === `${inst.id}-sync`} onClick={() => action(inst.id, 'sync', inst.displayName)}>
                          {busy === `${inst.id}-sync` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busy === `${inst.id}-test`} onClick={() => action(inst.id, 'test', inst.displayName)}>
                          {busy === `${inst.id}-test` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />} Test
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={busy === `${inst.id}-disconnect`} onClick={() => action(inst.id, 'disconnect', inst.displayName)}>
                          <Link2Off className="h-3 w-3" /> Disconnect
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-red-400 hover:text-red-300" disabled={busy === `${inst.id}-uninstall`} onClick={() => action(inst.id, 'uninstall', inst.displayName)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT BUS TAB — live event stream
// ═══════════════════════════════════════════════════════════════════════════════
function EventBusTab() {
  const [events, setEvents] = useState<IntegrationEvent[]>([])
  const [stats, setStats] = useState<EventBusStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ events: IntegrationEvent[]; stats: EventBusStats }>('/integrations/events', { limit: '80' })
      setEvents(res.events); setStats(res.stats)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [load])

  const SEVERITY_ICON: Record<string, React.ElementType> = { info: CheckCircle, warning: AlertTriangle, critical: AlertCircle }
  const SEVERITY_COLOR: Record<string, string> = { info: 'text-emerald-400', warning: 'text-amber-400', critical: 'text-red-400' }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard icon={Zap} label="Total Events" value={stats ? num(stats.total) : '—'} color="text-amber-400" />
        <MetricCard icon={Activity} label="Last Hour" value={stats ? num(stats.lastHour) : '—'} color="text-cyan-400" />
        <MetricCard icon={Clock} label="Last 24h" value={stats ? num(stats.last24h) : '—'} color="text-sky-400" />
        <MetricCard icon={CheckCircle} label="Consumed" value={stats ? num(stats.consumed) : '—'} color="text-emerald-400" />
        <MetricCard icon={Cpu} label="Unconsumed" value={stats ? num(stats.unconsumed) : '—'} color="text-orange-400" />
        <MetricCard icon={Network} label="Connectors" value={stats ? String(stats.byConnector.length) : '—'} color="text-violet-400" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Event stream */}
        <Card className="border-border bg-muted/20 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-amber-400" /> Event Bus™ Live Stream</CardTitle>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">● live</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[480px] pr-3">
              <div className="space-y-1.5">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading events…</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events yet. Sync an integration to publish events.</p>
                ) : (
                  events.map((e) => {
                    const Icon = SEVERITY_ICON[e.severity] ?? CheckCircle
                    return (
                      <div key={e.id} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[e.severity]}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-semibold text-foreground">{e.eventType}</code>
                            <span className="text-[10px] text-muted-foreground">from</span>
                            <code className="text-[11px] text-cyan-400">{e.connectorSlug}</code>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{timeAgo(e.publishedAt)}</span>
                            {e.consumed ? (
                              <span className="flex items-center gap-0.5 text-emerald-400">✓ {e.consumedBy}</span>
                            ) : (
                              <span className="text-amber-400">pending consumption</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top events + connectors */}
        <div className="space-y-4">
          <Card className="border-border bg-muted/20">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Top Event Types</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {stats?.byEventType.slice(0, 6).map((t) => (
                <div key={t.eventType} className="flex items-center justify-between">
                  <code className="text-xs text-foreground">{t.eventType}</code>
                  <Badge variant="secondary" className="text-xs">{num(t.count)}</Badge>
                </div>
              )) ?? <p className="text-xs text-muted-foreground">No data</p>}
            </CardContent>
          </Card>
          <Card className="border-border bg-muted/20">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Active Connectors</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {stats?.byConnector.slice(0, 6).map((c) => (
                <div key={c.connectorSlug} className="flex items-center justify-between">
                  <code className="text-xs text-cyan-400">{c.connectorSlug}</code>
                  <Badge variant="secondary" className="text-xs">{num(c.count)}</Badge>
                </div>
              )) ?? <p className="text-xs text-muted-foreground">No data</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC ENGINE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SyncTab() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [status, setStatus] = useState<SyncEngineStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ jobs: SyncJob[]; status: SyncEngineStatus }>('/integrations/sync-jobs', { limit: '40' })
      setJobs(res.jobs); setStatus(res.status)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <MetricCard icon={RefreshCw} label="Jobs (24h)" value={status ? num(status.jobsLast24h) : '—'} color="text-cyan-400" />
        <MetricCard icon={CheckCircle} label="Success Rate" value={status ? `${status.successRate}%` : '—'} color="text-emerald-400" />
        <MetricCard icon={Database} label="Records Synced" value={status ? num(status.totalRecordsSynced) : '—'} color="text-violet-400" />
        <MetricCard icon={AlertTriangle} label="Conflicts Resolved" value={status ? num(status.conflictsResolved) : '—'} color="text-amber-400" />
        <MetricCard icon={Clock} label="Avg Duration" value={status ? `${status.avgDurationMs}ms` : '—'} color="text-sky-400" />
      </div>

      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4 text-cyan-400" /> Universal Data Sync™ — Recent Jobs</CardTitle>
          <CardDescription className="text-xs">Real-time, scheduled, incremental sync · Conflict resolution · Retry engine · Offline queue</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[460px] pr-3">
            <div className="space-y-1.5">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading sync jobs…</p>
              ) : jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sync jobs yet. Trigger a sync from My Integrations.</p>
              ) : (
                jobs.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                      {j.status === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : j.status === 'failed' ? <XCircle className="h-4 w-4 text-red-400" /> : <RefreshCw className="h-4 w-3 animate-spin text-amber-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[j.status] ?? STATUS_BADGE.unknown}`}>{j.status}</Badge>
                        <span className="text-[11px] text-muted-foreground">{j.type} · {j.direction}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{num(j.recordsProcessed)} processed</span>
                        <span className="text-emerald-400">+{j.recordsCreated}</span>
                        <span className="text-sky-400">↻{j.recordsUpdated}</span>
                        {j.recordsFailed > 0 && <span className="text-red-400">✗{j.recordsFailed}</span>}
                        {j.conflictCount > 0 && <span className="text-amber-400">⚠{j.conflictCount} conflicts</span>}
                        <span>· {j.durationMs ? `${j.durationMs}ms` : 'running'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(j.startedAt)}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<AnalyticsData>('/integrations/analytics', { days: '30' })
      .then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const maxApi = Math.max(...(data?.timeseries.map((t) => t.apiCalls) ?? [1]), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard icon={Activity} label="API Calls" value={data ? num(data.totalApiCalls) : '—'} color="text-cyan-400" />
        <MetricCard icon={CheckCircle} label="Sync Success" value={data ? `${data.syncSuccessRate}%` : '—'} color="text-emerald-400" />
        <MetricCard icon={Database} label="Records Synced" value={data ? num(data.totalRecordsSynced) : '—'} color="text-violet-400" />
        <MetricCard icon={Zap} label="Events Published" value={data ? num(data.totalEventsPublished) : '—'} color="text-amber-400" />
        <MetricCard icon={TrendingUp} label="Revenue Impact" value={data ? inr(data.totalRevenueImpact) : '—'} color="text-emerald-400" />
        <MetricCard icon={Cpu} label="Avg Latency" value={data ? `${data.avgLatencyMs}ms` : '—'} color="text-sky-400" />
      </div>

      {/* Timeseries chart */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="text-base">API Calls (last 30 days)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="flex h-40 items-end gap-0.5">
              {data?.timeseries.map((t) => (
                <div key={t.date} className="group relative flex-1" title={`${t.date}: ${num(t.apiCalls)} calls`}>
                  <div className="w-full rounded-t bg-gradient-to-t from-cyan-500/40 to-emerald-500/60 transition-all hover:from-cyan-500/60 hover:to-emerald-500/80" style={{ height: `${Math.max((t.apiCalls / maxApi) * 100, 2)}%` }} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* By connector */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="text-base">Connector Analytics</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[340px] pr-3">
            <div className="space-y-2">
              {data?.byConnector.map((c) => (
                <div key={c.connectorSlug} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{c.displayName}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[c.status] ?? STATUS_BADGE.unknown}`}>{c.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{num(c.apiCalls)} calls</span>
                      <span>{num(c.eventsPublished)} events</span>
                      <span>{c.avgLatencyMs}ms</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-emerald-400">{inr(c.revenueImpact)}</span>
                    <div className="flex items-center gap-1">
                      <Progress value={c.healthScore} className="h-1.5 w-16" />
                      <span className="text-[10px] text-muted-foreground">{c.healthScore}</span>
                    </div>
                  </div>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No analytics yet.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPER PLATFORM TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DeveloperTab() {
  const [data, setData] = useState<DeveloperData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<DeveloperData>('/integrations/developer').then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      {/* SDK header */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">VEYRO Connector SDK v{data?.sdk.version ?? '2.1.0'}</h2>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20">stable</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Build & publish connectors for 2,000+ platforms. SDK, REST API, Webhook SDK, OAuth templates, sandbox, certification, revenue sharing.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data?.sdk.languages.map((l) => (
                  <span key={l} className="rounded-md bg-muted/50 px-2 py-1 text-xs font-mono text-foreground">{l}</span>
                )) ?? null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">{data ? num(data.sdk.publishedConnectors) : '—'}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Published</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-cyan-400">{data ? inr(data.sdk.totalRevenue) : '—'}</p>
                <p className="text-[10px] uppercase text-muted-foreground">Dev Revenue</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Submissions */}
        <Card className="border-border bg-muted/20 lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent Submissions</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-2">
                {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : data?.submissions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                    <FileCode className="h-4 w-4 shrink-0 text-violet-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[s.status] ?? STATUS_BADGE.unknown}`}>{s.status}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[s.certification] ?? STATUS_BADGE.none}`}>{s.certification}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">by {s.developer} · v{s.version} · SDK {s.sdkVersion} · {s.revenueSharePct}% revenue share</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(s.submittedAt)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Certifications */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Certification Levels</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data?.certifications.map((cert) => (
              <div key={cert.level} className="rounded-lg border border-border/50 bg-background/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cert.level === 'certified' ? <BadgeCheck className="h-4 w-4 text-emerald-400" /> : cert.level === 'sandbox' ? <FlaskConical className="h-4 w-4 text-amber-400" /> : <Code2 className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium capitalize">{cert.level}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{cert.count}</Badge>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {cert.requirements.map((r) => (
                    <li key={r} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle className="h-2.5 w-2.5 text-emerald-400" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY TAB
// ═══════════════════════════════════════════════════════════════════════════════
function SecurityTab() {
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<SecurityData>('/integrations/security').then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      {/* Security measures */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Security Measures (16)</CardTitle>
          <CardDescription className="text-xs">Zero-trust architecture · OAuth2 · API Key Vault · Encrypted tokens · Webhook validation · Rate limiting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : data?.securityMeasures.map((m) => (
              <div key={m.name} className="rounded-lg border border-border/50 bg-background/30 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{m.name}</span>
                  {m.enabled ? <Lock className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                </div>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{m.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* API Keys */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-amber-400" /> API Keys</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <code className="text-[11px] text-muted-foreground">{k.keyPrefix}••••••••</code>
                </div>
                <div className="flex items-center gap-1">
                  {k.scopes.slice(0, 2).map((s) => <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>)}
                  <span className="text-[10px] text-muted-foreground">{timeAgo(k.lastUsedAt)}</span>
                </div>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">No API keys</p>}
          </CardContent>
        </Card>

        {/* OAuth providers */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-cyan-400" /> OAuth Providers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.oauthProviders.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  {p.connected ? <Link2 className="h-3.5 w-3.5 text-emerald-400" /> : <Link2Off className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-sm">{p.name}</span>
                </div>
                <Badge variant="outline" className={`text-[10px] ${p.connected ? STATUS_BADGE.connected : STATUS_BADGE.disconnected}`}>{p.connected ? 'connected' : 'available'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Webhook className="h-4 w-4 text-violet-400" /> Webhook Endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.webhooks.map((w) => (
              <div key={w.id} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                <div className="flex items-center justify-between">
                  <code className="truncate text-[11px] text-foreground">{w.url}</code>
                  <Badge variant="outline" className={`text-[10px] ${w.verified ? STATUS_BADGE.verified ?? STATUS_BADGE.connected : STATUS_BADGE.disconnected}`}>{w.verified ? 'verified' : 'pending'}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <code className="text-cyan-400">{w.connectorSlug}</code>
                  <span>{w.successRate}% success</span>
                  <span>· {timeAgo(w.lastDelivery)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Rate limits */}
        <Card className="border-border bg-muted/20">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Gauge className="h-4 w-4 text-orange-400" /> Rate Limits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data?.rateLimits.map((r) => (
              <div key={r.connectorSlug} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                <div className="flex items-center justify-between">
                  <code className="text-xs text-cyan-400">{r.connectorSlug}</code>
                  <span className="text-[10px] text-muted-foreground">{r.used}/{r.limit}</span>
                </div>
                <Progress value={(r.used / r.limit) * 100} className="mt-1 h-1.5" />
                <p className="mt-0.5 text-[10px] text-muted-foreground">{r.remaining} remaining · resets in {Math.ceil((new Date(r.resetAt).getTime() - Date.now()) / 1000)}s</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Audit trail */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4 text-sky-400" /> Audit Trail</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[260px] pr-3">
            <div className="space-y-1.5">
              {data?.auditEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[e.severity] ?? STATUS_BADGE.unknown}`}>{e.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs"><span className="font-medium">{e.action}</span> · {e.summary}</p>
                    <p className="text-[10px] text-muted-foreground">by {e.actor}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(e.timestamp)}</span>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No audit events</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function Gauge({ className }: { className?: string }) {
  return <Cpu className={className} />
}

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="border-border bg-muted/20">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
        <p className="mt-1 text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
