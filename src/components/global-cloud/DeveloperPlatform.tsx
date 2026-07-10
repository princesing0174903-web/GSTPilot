'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 16 · MODULE 01
// DEVELOPER PLATFORM™ — REST · GraphQL · Webhooks · SDKs · CLI · OAuth ·
//                        API Keys · Playground · Sandbox · Docs
//
// A complete developer ecosystem console. Eight tabs covering every surface
// a third-party developer touches: REST endpoints, GraphQL operations, SDKs &
// CLI, OAuth + API keys, an interactive playground, sandbox environments and
// full documentation library. 100% static — no fetch, no Math.random.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Code2, Terminal, KeyRound, PlayCircle, Beaker, BookOpen,
  Webhook, Sparkles, Download, Copy, Check, ShieldCheck, Globe2, Zap,
  Star, GitBranch, RefreshCw, ChevronRight, Server, FileCode2,
  Cpu, Layers, Clock, Users, Activity, TrendingUp, CheckCircle2,
  AlertCircle, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  REST_ENDPOINTS, GRAPHQL_OPS, SDKS, CLI_COMMANDS, OAUTH_PROVIDERS,
  API_KEYS, PLAYGROUND_SAMPLES, SANDBOX_ENVS, DOC_SECTIONS,
  ACCENT_CLASSES, fmtN, type Accent,
} from '@/lib/global-cloud/data';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── HTTP verb color tokens (no indigo/blue) ──────────────────────────────────
const METHOD_CLASS: Record<string, string> = {
  GET:    'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  POST:   'bg-cyan-500/10    text-cyan-300    border-cyan-500/30',
  PUT:    'bg-amber-500/10   text-amber-300   border-amber-500/30',
  PATCH:  'bg-violet-500/10  text-violet-300  border-violet-500/30',
  DELETE: 'bg-rose-500/10    text-rose-300    border-rose-500/30',
};

const GQL_TYPE_CLASS: Record<string, string> = {
  Query:        'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Mutation:     'bg-amber-500/10  text-amber-300   border-amber-500/30',
  Subscription: 'bg-violet-500/10 text-violet-300  border-violet-500/30',
};

// ─── KPI tiles ─────────────────────────────────────────────────────────────────
const KPIS: { label: string; value: string; sub: string; accent: Accent; icon: LucideIcon }[] = [
  { label: 'REST + GraphQL APIs', value: '540+',  sub: 'Across 13 service domains', accent: 'emerald', icon: Code2 },
  { label: 'Official SDKs',        value: '8',     sub: 'TS · Py · Go · Java · Rust…', accent: 'teal',    icon: Layers },
  { label: 'Active Developers',    value: '2.4M',  sub: '184 countries',              accent: 'cyan',    icon: Users },
  { label: 'Doc Helpfulness',      value: '96%',   sub: 'Avg across 8 sections',      accent: 'violet',  icon: BookOpen },
];

// ─── Tab metadata ──────────────────────────────────────────────────────────────
const TABS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'rest',       label: 'REST APIs',    icon: Code2 },
  { value: 'graphql',    label: 'GraphQL',      icon: Webhook },
  { value: 'sdks',       label: 'SDKs & CLI',   icon: Terminal },
  { value: 'auth',       label: 'OAuth & Keys', icon: KeyRound },
  { value: 'playground', label: 'Playground',   icon: PlayCircle },
  { value: 'sandbox',    label: 'Sandbox',      icon: Beaker },
  { value: 'docs',       label: 'Docs',         icon: BookOpen },
];

// ─── Helper: tiny inline star rating ──────────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'text-white/20',
          )}
        />
      ))}
      <span className="ml-1 text-[11px] text-white/60">{rating.toFixed(1)}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DeveloperPlatform() {
  const { setCurrentView } = useApp();
  const [tab, setTab] = useState('rest');
  const [sampleIdx, setSampleIdx] = useState(0);
  const [tried, setTried] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const back = () => setCurrentView('global-financial-cloud');

  // Derived data
  const queries = GRAPHQL_OPS.filter(o => o.type === 'Query');
  const mutations = GRAPHQL_OPS.filter(o => o.type === 'Mutation');
  const subscriptions = GRAPHQL_OPS.filter(o => o.type === 'Subscription');

  const handleCopy = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const triggerTry = () => {
    setTried(true);
    setTimeout(() => setTried(false), 2600);
  };

  const confirmReset = () => {
    setResetting(true);
    setTimeout(() => {
      setResetting(false);
      setResetTarget(null);
    }, 1400);
  };

  const totalEndpoints = useMemo(() => REST_ENDPOINTS.length, []);
  const totalDownloads = useMemo(() => SDKS.reduce((s, k) => s + k.weeklyDownloads, 0), []);
  const totalArticles = useMemo(() => DOC_SECTIONS.reduce((s, d) => s + d.articles, 0), []);
  const totalViews = useMemo(() => DOC_SECTIONS.reduce((s, d) => s + d.views, 0), []);
  const avgHelpfulness = useMemo(
    () => Math.round(DOC_SECTIONS.reduce((s, d) => s + d.helpfulness, 0) / DOC_SECTIONS.length),
    [],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                onClick={back}
                variant="outline"
                className="border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.04] hover:text-white"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Hub
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <Code2 className="mr-1 h-3 w-3" /> Module 01
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Globe2 className="mr-1 h-3 w-3" /> v4.12.0
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                  <Zap className="mr-1 h-3 w-3" /> 99.99% Uptime
                </Badge>
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Developer Platform
              <span className="ml-2 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">™</span>
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-white/55 sm:text-base">
              REST · GraphQL · Webhooks · SDKs · CLI · OAuth · API Keys · Playground · Sandbox · Docs
            </p>

            {/* KPI tiles */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {KPIS.map((k, i) => {
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
                      <div className="text-[10px] font-medium uppercase tracking-wider text-white/50">{k.label}</div>
                      <Icon className={cn('h-4 w-4', a.text)} />
                    </div>
                    <div className={cn('mt-1.5 text-2xl font-bold', a.text)}>{k.value}</div>
                    <div className="mt-0.5 text-[10px] text-white/40">{k.sub}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.header>

        {/* ─── TABS ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mt-6"
        >
          <Tabs value={tab} onValueChange={setTab}>
            <ScrollArea className="w-full">
              <TabsList className="flex h-auto w-max flex-nowrap gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5">
                {TABS.map(t => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs data-[state=active]:bg-white/[0.06] data-[state=active]:text-white"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </ScrollArea>

            {/* ═══ REST APIS TAB ═══════════════════════════════════════════ */}
            <TabsContent value="rest">
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardHeader className="border-b border-white/[0.06]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Code2 className="h-4 w-4 text-emerald-300" />
                        REST API Reference
                      </CardTitle>
                      <p className="mt-1 text-xs text-white/50">
                        {totalEndpoints} endpoints · base URL <span className="font-mono text-emerald-300">https://api.gstpilot.com</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                        <ShieldCheck className="mr-1 h-3 w-3" /> OAuth 2.0
                      </Badge>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                        <Activity className="mr-1 h-3 w-3" /> 48.4B calls/24h
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[28rem]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-black/80 backdrop-blur">
                        <TableRow className="border-white/[0.06] hover:bg-transparent">
                          <TableHead className="w-20 text-xs uppercase tracking-wider text-white/50">Method</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-white/50">Path</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-white/50">Description</TableHead>
                          <TableHead className="w-28 text-right text-xs uppercase tracking-wider text-white/50">Rate/min</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {REST_ENDPOINTS.map((e, i) => (
                          <TableRow
                            key={`${e.method}-${e.path}`}
                            className={cn(
                              'border-white/[0.04] hover:bg-white/[0.02]',
                              i % 2 === 1 ? 'bg-white/[0.01]' : '',
                            )}
                          >
                            <TableCell>
                              <span
                                className={cn(
                                  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold',
                                  METHOD_CLASS[e.method],
                                )}
                              >
                                {e.method}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs text-cyan-300">{e.path}</span>
                            </TableCell>
                            <TableCell className="text-xs text-white/70">{e.desc}</TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono text-xs text-white/60">
                                {e.ratePerMin}<span className="text-white/30">/min</span>
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ GRAPHQL TAB ════════════════════════════════════════════ */}
            <TabsContent value="graphql">
              <div className="space-y-5">
                {[
                  { type: 'Query',        items: queries,        icon: Activity,    accent: 'emerald' as Accent },
                  { type: 'Mutation',     items: mutations,     icon: Zap,         accent: 'amber'   as Accent },
                  { type: 'Subscription', items: subscriptions, icon: Webhook,     accent: 'violet'  as Accent },
                ].map(group => {
                  const a = ACCENT_CLASSES[group.accent];
                  const Icon = group.icon;
                  return (
                    <motion.div
                      key={group.type}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', a.text)} />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{group.type}s</h3>
                        <Badge variant="outline" className={cn('border-white/10 bg-white/[0.02]', a.text)}>
                          {group.items.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {group.items.map(op => (
                          <Card
                            key={op.name}
                            className={cn(
                              'border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.12]',
                            )}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-sm font-semibold text-white">{op.name}</span>
                                <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase', GQL_TYPE_CLASS[op.type])}>
                                  {op.type}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-white/55">{op.desc}</p>
                              <Separator className="my-3 bg-white/[0.06]" />
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-white/40">Returns</span>
                                <span className="font-mono text-xs text-emerald-300">{op.returns}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Sample subscription block */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden rounded-2xl border border-violet-500/30 bg-violet-500/[0.04]"
                >
                  <div className="flex items-center justify-between border-b border-violet-500/20 bg-violet-500/[0.06] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-violet-300" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-violet-200">Sample Subscription</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-violet-200 hover:bg-violet-500/10 hover:text-violet-100"
                      onClick={() => handleCopy('gql', GQL_SAMPLE)}
                    >
                      {copied === 'gql' ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                      {copied === 'gql' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-violet-100/90">
                    <code className="font-mono">{GQL_SAMPLE}</code>
                  </pre>
                </motion.div>
              </div>
            </TabsContent>

            {/* ═══ SDKS & CLI TAB ══════════════════════════════════════════ */}
            <TabsContent value="sdks">
              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-teal-300" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Official SDKs</h3>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                        <Download className="mr-1 h-3 w-3" /> {fmtN(totalDownloads)}/wk
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {SDKS.map(sdk => {
                      const a = ACCENT_CLASSES[sdk.accent];
                      return (
                        <Card
                          key={sdk.language}
                          className={cn(
                            'group border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:-translate-y-1 hover:border-white/[0.12]',
                            a.glow,
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <span className={cn('text-sm font-semibold', a.text)}>{sdk.language}</span>
                              <Badge variant="outline" className={cn('border-white/10 bg-white/[0.02]', a.text)}>
                                v{sdk.version}
                              </Badge>
                            </div>
                            <div className="mt-2 font-mono text-[11px] text-white/60">{sdk.package}</div>
                            <div className="mt-2 flex items-center gap-1 text-[11px] text-white/50">
                              <Download className="h-3 w-3" />
                              {fmtN(sdk.weeklyDownloads)} weekly downloads
                            </div>
                            <Separator className="my-3 bg-white/[0.06]" />
                            <button
                              onClick={() => handleCopy(`sdk-${sdk.language}`, sdk.install)}
                              className="flex w-full items-center justify-between rounded-md border border-white/[0.06] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-emerald-300 transition-colors hover:bg-black/60"
                            >
                              <span className="truncate">$ {sdk.install}</span>
                              {copied === `sdk-${sdk.language}`
                                ? <Check className="ml-2 h-3 w-3 shrink-0 text-emerald-400" />
                                : <Copy className="ml-2 h-3 w-3 shrink-0 text-white/40" />}
                            </button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* CLI commands */}
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-cyan-300" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">CLI Commands</h3>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/70">
                      <GitBranch className="mr-1 h-3 w-3" /> gstpilot CLI v4.12.0
                    </Badge>
                  </div>
                  <Card className="border-white/[0.06] bg-white/[0.02]">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 gap-px bg-white/[0.04] md:grid-cols-2">
                        {CLI_COMMANDS.map(cmd => (
                          <div
                            key={cmd.command}
                            className="bg-black/40 p-4 transition-colors hover:bg-black/60"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-sm text-cyan-300">{cmd.command}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-white/40 hover:bg-white/[0.04] hover:text-white"
                                onClick={() => handleCopy(`cli-${cmd.command}`, cmd.example)}
                              >
                                {copied === `cli-${cmd.command}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            </div>
                            <p className="mt-1.5 text-xs text-white/55">{cmd.desc}</p>
                            <pre className="mt-2 overflow-x-auto rounded-md border border-white/[0.06] bg-black/60 p-2 font-mono text-[11px] text-emerald-300/90">
                              <code>$ {cmd.example}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ═══ OAUTH & API KEYS TAB ════════════════════════════════════ */}
            <TabsContent value="auth">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* OAuth providers */}
                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardHeader className="border-b border-white/[0.06]">
                    <CardTitle className="flex items-center gap-2 text-white">
                      <ShieldCheck className="h-4 w-4 text-emerald-300" />
                      OAuth Providers
                    </CardTitle>
                    <p className="mt-1 text-xs text-white/50">
                      {OAUTH_PROVIDERS.length} identity providers · OIDC · SAML · OAuth 2.0
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[26rem]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-black/80 backdrop-blur">
                          <TableRow className="border-white/[0.06] hover:bg-transparent">
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Provider</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Type</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Scopes</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {OAUTH_PROVIDERS.map(p => (
                            <TableRow key={p.name} className="border-white/[0.04] hover:bg-white/[0.02]">
                              <TableCell className="text-xs font-medium text-white">{p.name}</TableCell>
                              <TableCell className="text-xs text-white/60">{p.type}</TableCell>
                              <TableCell>
                                <span className="font-mono text-xs text-cyan-300">{p.scopes}</span>
                              </TableCell>
                              <TableCell>
                                {p.status === 'live'
                                  ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Live</Badge>
                                  : <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">Beta</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* API keys */}
                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardHeader className="border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-white">
                          <KeyRound className="h-4 w-4 text-amber-300" />
                          API Keys
                        </CardTitle>
                        <p className="mt-1 text-xs text-white/50">
                          {API_KEYS.filter(k => k.status === 'active').length} active · {API_KEYS.filter(k => k.env === 'live').length} live · {API_KEYS.filter(k => k.env === 'sandbox').length} sandbox
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 border-white/10 bg-white/[0.02] text-xs text-white/70 hover:bg-white/[0.04]">
                        <Sparkles className="mr-1 h-3 w-3" /> New Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[26rem]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-black/80 backdrop-blur">
                          <TableRow className="border-white/[0.06] hover:bg-transparent">
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Name</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Prefix</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Scopes</TableHead>
                            <TableHead className="text-xs uppercase tracking-wider text-white/50">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {API_KEYS.map(k => (
                            <TableRow key={k.id} className="border-white/[0.04] hover:bg-white/[0.02]">
                              <TableCell>
                                <div className="text-xs font-medium text-white">{k.name}</div>
                                <div className="text-[10px] text-white/40">{k.lastUsed}</div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-[11px] text-cyan-300">{k.prefix}••••••••</span>
                                <div className="mt-0.5">
                                  {k.env === 'live'
                                    ? <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-300 text-[9px]">LIVE</Badge>
                                    : <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300 text-[9px]">SANDBOX</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {k.scopes.map(sc => (
                                    <span
                                      key={sc}
                                      className="inline-flex items-center rounded border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[9px] text-white/60"
                                    >
                                      {sc}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                {k.status === 'active'
                                  ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Active</Badge>
                                  : <Badge variant="outline" className="border-white/10 bg-white/[0.02] text-white/50">Revoked</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══ PLAYGROUND TAB ══════════════════════════════════════════ */}
            <TabsContent value="playground">
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardHeader className="border-b border-white/[0.06]">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <PlayCircle className="h-4 w-4 text-violet-300" />
                    API Playground
                  </CardTitle>
                  <p className="mt-1 text-xs text-white/50">
                    Try real GSTPilot API calls from your browser. Requests run against the sandbox.
                  </p>
                </CardHeader>
                <CardContent className="p-4">
                  {/* Sample selector chips */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {PLAYGROUND_SAMPLES.map((s, i) => (
                      <button
                        key={s.title}
                        onClick={() => { setSampleIdx(i); setTried(false); }}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                          i === sampleIdx
                            ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                            : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/[0.14] hover:text-white',
                        )}
                      >
                        <FileCode2 className="h-3 w-3" />
                        {s.title}
                        <span className="ml-1 rounded bg-black/40 px-1 py-0.5 font-mono text-[9px] uppercase text-white/50">{s.language}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Description + Try button */}
                    <div className="lg:col-span-1">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Sample</div>
                        <div className="mt-1 text-sm font-semibold text-white">{PLAYGROUND_SAMPLES[sampleIdx].title}</div>
                        <p className="mt-2 text-xs leading-relaxed text-white/55">{PLAYGROUND_SAMPLES[sampleIdx].desc}</p>
                        <Separator className="my-3 bg-white/[0.06]" />
                        <Button
                          onClick={triggerTry}
                          className="w-full bg-gradient-to-r from-violet-500 to-teal-500 text-white hover:from-violet-400 hover:to-teal-400"
                        >
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Try it
                        </Button>
                        {tried && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-2.5"
                          >
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <div className="text-[11px] leading-relaxed text-emerald-100">
                              <div className="font-semibold">200 OK · 142ms</div>
                              <div className="text-emerald-200/70">Sandbox request executed successfully.</div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Code block */}
                    <div className="lg:col-span-2">
                      <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/60">
                        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
                            <span className="ml-3 font-mono text-[11px] text-white/40">{PLAYGROUND_SAMPLES[sampleIdx].language}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-white/50 hover:bg-white/[0.04] hover:text-white"
                            onClick={() => handleCopy('pg', PLAYGROUND_SAMPLES[sampleIdx].code)}
                          >
                            {copied === 'pg' ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                            {copied === 'pg' ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                        <pre className="max-h-[28rem] overflow-auto p-4 text-xs leading-relaxed">
                          <code className="font-mono text-emerald-200/90">{PLAYGROUND_SAMPLES[sampleIdx].code}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ SANDBOX TAB ════════════════════════════════════════════ */}
            <TabsContent value="sandbox">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {SANDBOX_ENVS.map((sb, i) => {
                    const a = ACCENT_CLASSES[['emerald', 'teal', 'cyan', 'amber'][i % 4] as Accent];
                    return (
                      <motion.div
                        key={sb.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                      >
                        <Card className={cn('border-white/[0.06] bg-white/[0.02]', a.border)}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-sm font-semibold text-white">{sb.name}</div>
                                <div className="mt-0.5 font-mono text-[11px] text-white/50">{sb.region}</div>
                              </div>
                              {sb.status === 'healthy'
                                ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Healthy</Badge>
                                : <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Resetting
                                  </Badge>}
                            </div>
                            <Separator className="my-3 bg-white/[0.06]" />
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-white/40">Records</span>
                                <span className="font-mono text-white/70">{fmtN(sb.records)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-white/40">Reset</span>
                                <span className="text-white/70">{sb.resetSchedule}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-white/40">ID</span>
                                <span className="font-mono text-white/70">{sb.id}</span>
                              </div>
                            </div>
                            <Dialog open={resetTarget === sb.id} onOpenChange={(o) => setResetTarget(o ? sb.id : null)}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="mt-3 w-full border-white/[0.08] bg-white/[0.02] text-xs text-white/70 hover:bg-white/[0.04] hover:text-white"
                                  disabled={sb.status === 'resetting'}
                                >
                                  <RefreshCw className="mr-1.5 h-3 w-3" />
                                  Reset Sandbox
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="border-white/[0.08] bg-zinc-950">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2 text-white">
                                    <AlertCircle className="h-4 w-4 text-amber-300" />
                                    Reset {sb.name}?
                                  </DialogTitle>
                                  <DialogDescription className="text-white/55">
                                    This will wipe all {fmtN(sb.records)} records and restore the sandbox to its
                                    default state. The action cannot be undone.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button
                                    variant="ghost"
                                    onClick={() => setResetTarget(null)}
                                    className="text-white/60 hover:bg-white/[0.04] hover:text-white"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={confirmReset}
                                    disabled={resetting}
                                    className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                                  >
                                    {resetting
                                      ? <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Resetting…</>
                                      : <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Confirm Reset</>}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Beaker className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                      <div className="text-xs leading-relaxed text-white/55">
                        <span className="font-semibold text-white">Sandbox best practices.</span>{' '}
                        Sandboxes reset automatically on their configured schedule — on-demand sandboxes (UAE) require
                        a manual reset. Use <span className="font-mono text-cyan-300">sk_test_</span> API keys to target
                        a specific sandbox region via the <span className="font-mono text-cyan-300">x-sandbox-region</span> header.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ═══ DOCS TAB ═══════════════════════════════════════════════ */}
            <TabsContent value="docs">
              <div className="space-y-5">
                {/* Aggregate stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Articles</div>
                    <div className="mt-1 text-xl font-bold text-emerald-300">{totalArticles}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Total views</div>
                    <div className="mt-1 text-xl font-bold text-teal-300">{fmtN(totalViews)}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Sections</div>
                    <div className="mt-1 text-xl font-bold text-cyan-300">{DOC_SECTIONS.length}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/40">Avg helpfulness</div>
                    <div className="mt-1 text-xl font-bold text-violet-300">{avgHelpfulness}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {DOC_SECTIONS.map((d, i) => {
                    const a = ACCENT_CLASSES[d.accent];
                    return (
                      <motion.div
                        key={d.category}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                      >
                        <Card
                          className={cn(
                            'group cursor-pointer border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:-translate-y-1 hover:border-white/[0.12]',
                            a.glow,
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <BookOpen className={cn('h-4 w-4', a.text)} />
                              <ChevronRight className="h-3.5 w-3.5 text-white/30 transition-transform group-hover:translate-x-0.5" />
                            </div>
                            <h4 className="mt-3 text-sm font-semibold text-white">{d.category}</h4>
                            <div className="mt-2 flex items-center gap-3 text-[11px] text-white/50">
                              <span className="inline-flex items-center gap-1">
                                <FileCode2 className="h-3 w-3" /> {d.articles} articles
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> {fmtN(d.views)}
                              </span>
                            </div>
                            <Separator className="my-3 bg-white/[0.06]" />
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="uppercase tracking-wider text-white/40">Helpfulness</span>
                              <span className={cn('font-mono font-semibold', a.text)}>{d.helpfulness}%</span>
                            </div>
                            <Progress
                              value={d.helpfulness}
                              className="mt-1.5 h-1.5 bg-white/[0.06]"
                            />
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      <div className="text-xs leading-relaxed text-white/55">
                        <span className="font-semibold text-white">AI-assisted docs.</span>{' '}
                        Every article is generated and continuously updated by Oracle™ — pulling live API schema,
                        changelog entries and example payloads. Articles include runnable code samples in all 8 SDK
                        languages and a built-in &quot;Try it&quot; button.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* ─── FOOTER NOTE ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Server className="h-3.5 w-3.5 text-emerald-300" />
            <span>All endpoints served from <span className="font-mono text-white/70">api.gstpilot.com</span></span>
            <Separator orientation="vertical" className="mx-1 h-3 bg-white/10" />
            <Clock className="h-3.5 w-3.5 text-cyan-300" />
            <span>p95 latency: <span className="font-mono text-white/70">124ms</span></span>
          </div>
          <Button
            onClick={back}
            variant="ghost"
            className="h-7 text-xs text-white/50 hover:bg-white/[0.04] hover:text-white"
          >
            Back to Global Financial Cloud™
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Inline GraphQL sample string (kept outside component body for stability) ─
const GQL_SAMPLE = `subscription OnInvoiceCreated {
  invoiceCreated {
    id
    number
    customer { name }
    total
    taxBreakdown { rate amount }
    createdAt
  }
}`;
