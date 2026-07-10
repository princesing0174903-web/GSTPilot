'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  Radio,
  CheckCircle2,
  Clock,
  Search,
  Brain,
  FileText,
  Users,
  AlertTriangle,
  MessageSquare,
  Lightbulb,
  Calendar,
  ArrowRight,
  Zap,
  Activity,
  BookOpen,
  Target,
  FolderOpen,
  ChevronRight,
  Sparkles,
  Quote,
  Link2,
  TrendingUp,
  Shield,
  Receipt,
  FileCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  orange: '#f97316',
  pink: '#ec4899',
};

// ─── Types ──────────────────────────────────────────────────────────────────
type MemoryType = 'client' | 'notice' | 'filing' | 'conversation' | 'recommendation' | 'deadline';

interface MemoryCategory {
  type: MemoryType;
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface MemoryEntry {
  id: string;
  type: MemoryType;
  clientName: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
}

interface ClientMemory {
  clientId: string;
  clientName: string;
  gstin: string;
  memories: MemoryEntry[];
}

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: MemoryType;
  clientName: string;
}

interface SearchQuery {
  query: string;
  answer: string;
  sources: string[];
  timestamp: string;
}

// ─── Animated Card ──────────────────────────────────────────────────────────
function AnimatedCard({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── SVG Knowledge Graph ────────────────────────────────────────────────────
function KnowledgeGraph() {
  const nodes = [
    { id: 'firm', label: 'Your Firm', x: 200, y: 150, color: '#10b981', r: 28 },
    { id: 'abc', label: 'ABC Traders', x: 80, y: 60, color: '#3b82f6', r: 20 },
    { id: 'patel', label: 'Patel & Sons', x: 320, y: 60, color: '#8b5cf6', r: 20 },
    { id: 'sharma', label: 'Sharma Ind.', x: 60, y: 220, color: '#f59e0b', r: 18 },
    { id: 'mehta', label: 'Mehta Ent.', x: 340, y: 220, color: '#06b6d4', r: 18 },
    { id: 'rajesh', label: 'Rajesh & Co', x: 140, y: 280, color: '#ec4899', r: 16 },
    { id: 'sunrise', label: 'Sunrise Exp.', x: 260, y: 280, color: '#f97316', r: 16 },
    { id: 'gstr1', label: 'GSTR-1', x: 200, y: 30, color: '#64748b', r: 14 },
    { id: 'gstr3b', label: 'GSTR-3B', x: 200, y: 270, color: '#64748b', r: 14 },
    { id: 'notice', label: 'Notices', x: 40, y: 150, color: '#ef4444', r: 14 },
    { id: 'itc', label: 'ITC Claims', x: 360, y: 150, color: '#14b8a6', r: 14 },
  ];

  const edges = [
    { from: 'firm', to: 'abc' },
    { from: 'firm', to: 'patel' },
    { from: 'firm', to: 'sharma' },
    { from: 'firm', to: 'mehta' },
    { from: 'firm', to: 'rajesh' },
    { from: 'firm', to: 'sunrise' },
    { from: 'abc', to: 'gstr1' },
    { from: 'patel', to: 'gstr1' },
    { from: 'sharma', to: 'gstr3b' },
    { from: 'mehta', to: 'itc' },
    { from: 'rajesh', to: 'notice' },
    { from: 'sunrise', to: 'itc' },
    { from: 'firm', to: 'gstr1' },
    { from: 'firm', to: 'gstr3b' },
  ];

  const getNode = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <svg width="100%" height="320" viewBox="0 0 400 320" className="overflow-visible">
      {/* Edges */}
      {edges.map((edge, i) => {
        const from = getNode(edge.from);
        const to = getNode(edge.to);
        return (
          <motion.line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#e2e8f0"
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: i * 0.05 }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.g
          key={node.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.06 }}
        >
          <circle
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill={node.color + '20'}
            stroke={node.color}
            strokeWidth="2"
          />
          {node.id === 'firm' && (
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r + 4}
              fill="none"
              stroke={node.color}
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.5"
            />
          )}
          <text
            x={node.x}
            y={node.y + 3}
            textAnchor="middle"
            className="fill-slate-700"
            fontSize={node.r > 20 ? '8' : '7'}
            fontWeight="600"
          >
            {node.label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

// ─── Sample Data ────────────────────────────────────────────────────────────
const memoryCategories: MemoryCategory[] = [
  { type: 'client', label: 'Clients', count: 24, icon: Users, color: '#3b82f6', description: 'Client history, interactions, filings' },
  { type: 'notice', label: 'Notices', count: 18, icon: AlertTriangle, color: '#ef4444', description: 'All notices received and responses' },
  { type: 'filing', label: 'Filings', count: 312, icon: FileCheck, color: '#10b981', description: 'Every return filed historically' },
  { type: 'conversation', label: 'Conversations', count: 156, icon: MessageSquare, color: '#8b5cf6', description: 'Client and team communications' },
  { type: 'recommendation', label: 'Recommendations', count: 89, icon: Lightbulb, color: '#f59e0b', description: 'AI recommendations and outcomes' },
  { type: 'deadline', label: 'Deadlines', count: 47, icon: Calendar, color: '#06b6d4', description: 'Historical and upcoming deadlines' },
];

const recentMemories: MemoryEntry[] = [
  { id: 'm1', type: 'filing', clientName: 'ABC Traders', title: 'GSTR-1 Filed for Feb 2026', description: 'Filed with 45 invoices, total taxable value \u20B924,50,000', date: '04/03/2026', tags: ['GSTR-1', 'Filed'] },
  { id: 'm2', type: 'notice', clientName: 'Rajesh Kumar & Co', title: 'ASN Received — DRC-01', description: 'Show cause notice for ITC mismatch of \u20B945,000 in GSTR-3B', date: '04/03/2026', tags: ['ASN', 'ITC Mismatch'] },
  { id: 'm3', type: 'recommendation', clientName: 'Patel & Sons', title: 'AI Recommends ITC Reversal', description: 'Rule 42/43 reversal of \u20B912,200 recommended based on exempt supplies ratio', date: '03/03/2026', tags: ['ITC', 'Reversal'] },
  { id: 'm4', type: 'conversation', clientName: 'Sharma Industries', title: 'Client Call — Q3 Filing', description: 'Discussed Q3 filing extension request due to pending purchase data', date: '03/03/2026', tags: ['Call', 'Extension'] },
  { id: 'm5', type: 'client', clientName: 'Mehta Enterprises', title: 'New Client Onboarded', description: 'GSTIN: 27AABCM9012H3ZR, State: Maharashtra, Turnover: \u20B95.2 Cr', date: '03/03/2026', tags: ['Onboarding', 'New Client'] },
  { id: 'm6', type: 'filing', clientName: 'Sunrise Exports', title: 'GSTR-3B Filed for Feb 2026', description: 'Net tax payable: \u20B93,45,600, ITC utilized: \u20B98,75,000', date: '02/03/2026', tags: ['GSTR-3B', 'Filed'] },
  { id: 'm7', type: 'deadline', clientName: 'ABC Traders', title: 'GSTR-1 Due — Mar 2026', description: 'Due date: 11/03/2026, 7 days remaining', date: '02/03/2026', tags: ['GSTR-1', 'Upcoming'] },
  { id: 'm8', type: 'notice', clientName: 'ABC Traders', title: 'Intimation U/S 61', description: 'Scrutiny notice for GSTR-1 vs GSTR-3B mismatch in Oct 2025', date: '01/03/2026', tags: ['Scrutiny', 'Mismatch'] },
  { id: 'm9', type: 'recommendation', clientName: 'Sharma Industries', title: 'Opt for QRMP Scheme', description: 'Quarterly filing recommended based on turnover below \u20B95 Cr', date: '01/03/2026', tags: ['QRMP', 'Scheme'] },
  { id: 'm10', type: 'filing', clientName: 'Patel & Sons', title: 'GSTR-1 Filed for Feb 2026', description: 'Filed with 32 invoices, B2B: 28, B2C: 4', date: '28/02/2026', tags: ['GSTR-1', 'Filed'] },
  { id: 'm11', type: 'conversation', clientName: 'Mehta Enterprises', title: 'Email — Document Upload', description: 'Client uploaded bank statements and purchase registers for Feb', date: '28/02/2026', tags: ['Email', 'Documents'] },
  { id: 'm12', type: 'deadline', clientName: 'Sunrise Exports', title: 'GSTR-3B Due — Mar 2026', description: 'Due date: 20/03/2026, 16 days remaining', date: '28/02/2026', tags: ['GSTR-3B', 'Upcoming'] },
];

const clientMemories: ClientMemory[] = [
  {
    clientId: 'cl1',
    clientName: 'ABC Traders',
    gstin: '27AABCT1234F1ZP',
    memories: [
      { id: 'cm1', type: 'filing', clientName: 'ABC Traders', title: 'GSTR-1 Filed — Feb 2026', description: '45 invoices, \u20B924,50,000 taxable value', date: '04/03/2026', tags: ['GSTR-1'] },
      { id: 'cm2', type: 'notice', clientName: 'ABC Traders', title: 'Intimation U/S 61', description: 'Scrutiny for GSTR-1 vs 3B mismatch Oct 2025', date: '01/03/2026', tags: ['Scrutiny'] },
      { id: 'cm3', type: 'recommendation', clientName: 'ABC Traders', title: 'ITC Optimization', description: 'Additional ITC of \u20B928,500 can be claimed from pending 2B', date: '27/02/2026', tags: ['ITC'] },
    ],
  },
  {
    clientId: 'cl2',
    clientName: 'Patel & Sons',
    gstin: '27AABCP3456D4ZS',
    memories: [
      { id: 'cm4', type: 'filing', clientName: 'Patel & Sons', title: 'GSTR-1 Filed — Feb 2026', description: '32 invoices filed, B2B: 28, B2C: 4', date: '28/02/2026', tags: ['GSTR-1'] },
      { id: 'cm5', type: 'recommendation', clientName: 'Patel & Sons', title: 'ITC Reversal Required', description: 'Rule 42/43 reversal of \u20B912,200 recommended', date: '03/03/2026', tags: ['ITC'] },
    ],
  },
  {
    clientId: 'cl3',
    clientName: 'Sharma Industries',
    gstin: '27AABCS7890J5ZT',
    memories: [
      { id: 'cm6', type: 'conversation', clientName: 'Sharma Industries', title: 'Client Call — Q3 Filing', description: 'Extension request due to pending data', date: '03/03/2026', tags: ['Call'] },
      { id: 'cm7', type: 'recommendation', clientName: 'Sharma Industries', title: 'QRMP Scheme Suggested', description: 'Quarterly filing recommended', date: '01/03/2026', tags: ['QRMP'] },
      { id: 'cm8', type: 'filing', clientName: 'Sharma Industries', title: 'GSTR-3B Filed — Jan 2026', description: 'Net tax: \u20B92,15,000', date: '20/02/2026', tags: ['GSTR-3B'] },
      { id: 'cm9', type: 'notice', clientName: 'Sharma Industries', title: 'GST Audit Notice', description: 'Audit initiated for FY 2024-25', date: '15/02/2026', tags: ['Audit'] },
    ],
  },
];

const timelineEvents: TimelineEvent[] = [
  { id: 't1', date: '04/03/2026', title: 'GSTR-1 Filed — ABC Traders', description: 'Filed with 45 invoices', type: 'filing', clientName: 'ABC Traders' },
  { id: 't2', date: '04/03/2026', title: 'ASN Received — Rajesh Kumar', description: 'DRC-01 for ITC mismatch', type: 'notice', clientName: 'Rajesh Kumar & Co' },
  { id: 't3', date: '03/03/2026', title: 'ITC Reversal Recommended — Patel', description: 'Rule 42/43 reversal \u20B912,200', type: 'recommendation', clientName: 'Patel & Sons' },
  { id: 't4', date: '03/03/2026', title: 'Client Call — Sharma Industries', description: 'Q3 filing extension discussed', type: 'conversation', clientName: 'Sharma Industries' },
  { id: 't5', date: '03/03/2026', title: 'New Client Onboarded', description: 'Mehta Enterprises added', type: 'client', clientName: 'Mehta Enterprises' },
  { id: 't6', date: '02/03/2026', title: 'GSTR-3B Filed — Sunrise Exports', description: 'Net tax: \u20B93,45,600', type: 'filing', clientName: 'Sunrise Exports' },
  { id: 't7', date: '02/03/2026', title: 'GSTR-1 Deadline — ABC Traders', description: 'Due 11/03/2026', type: 'deadline', clientName: 'ABC Traders' },
  { id: 't8', date: '01/03/2026', title: 'Scrutiny Notice — ABC Traders', description: 'U/S 61 for Oct 2025 mismatch', type: 'notice', clientName: 'ABC Traders' },
  { id: 't9', date: '01/03/2026', title: 'QRMP Recommendation — Sharma', description: 'Quarterly filing suggested', type: 'recommendation', clientName: 'Sharma Industries' },
  { id: 't10', date: '28/02/2026', title: 'GSTR-1 Filed — Patel & Sons', description: '32 invoices filed', type: 'filing', clientName: 'Patel & Sons' },
];

const exampleQueries = [
  'What happened with ABC Traders in March?',
  'Show all notices for ABC Traders',
  'Which clients had late filings last quarter?',
  'What did AI CFO recommend last week?',
  'Show Patel & Sons compliance history',
  'How many returns were filed in February?',
];

const searchDemoResponses: Record<string, SearchQuery> = {
  'What happened with ABC Traders in March?': {
    query: 'What happened with ABC Traders in March?',
    answer: 'For ABC Traders in March 2026:\n\n\u2022 GSTR-1 filed on 04/03 with 45 invoices (\u20B924,50,000 taxable)\n\u2022 Scrutiny notice U/S 61 received on 01/03 for Oct 2025 mismatch\n\u2022 ITC optimization of \u20B928,500 identified from pending 2B\n\u2022 GSTR-1 deadline on 11/03 — 7 days remaining\n\nThe client has 1 active notice and 1 upcoming deadline.',
    sources: ['Memory: GSTR-1 Filing #INV-2026-0847', 'Notice: Intimation U/S 61', 'AI Recommendation: ITC Optimization', 'Deadline: GSTR-1 Mar 2026'],
    timestamp: 'Just now',
  },
  'Show all notices for ABC Traders': {
    query: 'Show all notices for ABC Traders',
    answer: 'ABC Traders has 2 notices:\n\n1. Intimation U/S 61 — Scrutiny for GSTR-1 vs GSTR-3B mismatch in Oct 2025 (Received 01/03/2026, Status: Pending Response)\n2. DRC-01B — Auto-populated from ASN (Received 15/01/2026, Status: Responded)\n\nRecommended: Respond to U/S 61 notice within 15 days.',
    sources: ['Notice: Intimation U/S 61 — 01/03/2026', 'Notice: DRC-01B — 15/01/2026', 'Client Record: ABC Traders'],
    timestamp: 'Just now',
  },
  'Show Patel & Sons compliance history': {
    query: 'Show Patel & Sons compliance history',
    answer: 'Patel & Sons Compliance History:\n\n\u2022 GSTR-1 filed on time for last 6 months\n\u2022 GSTR-3B filed on time for last 6 months\n\u2022 ITC reversal of \u20B912,200 recommended (Rule 42/43)\n\u2022 No active notices\n\u2022 Compliance Score: 92/100\n\u2022 Last late filing: Aug 2025 (GSTR-3B, 2 days late)',
    sources: ['Filing Record: Patel & Sons — Last 6 months', 'AI Recommendation: ITC Reversal', 'Compliance Score Database'],
    timestamp: 'Just now',
  },
};

// ─── Memory Type Helpers ────────────────────────────────────────────────────
const memoryTypeColors: Record<MemoryType, string> = {
  client: '#3b82f6',
  notice: '#ef4444',
  filing: '#10b981',
  conversation: '#8b5cf6',
  recommendation: '#f59e0b',
  deadline: '#06b6d4',
};

const memoryTypeIcons: Record<MemoryType, React.ElementType> = {
  client: Users,
  notice: AlertTriangle,
  filing: FileCheck,
  conversation: MessageSquare,
  recommendation: Lightbulb,
  deadline: Calendar,
};

const memoryTypeLabels: Record<MemoryType, string> = {
  client: 'Client',
  notice: 'Notice',
  filing: 'Filing',
  conversation: 'Conversation',
  recommendation: 'Recommendation',
  deadline: 'Deadline',
};

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AIFirmMemoryPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchQuery | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const handleSearch = useCallback((query?: string) => {
    const q = query || searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    setSearchResult(null);

    setTimeout(() => {
      const match = searchDemoResponses[q];
      if (match) {
        setSearchResult(match);
      } else {
        setSearchResult({
          query: q,
          answer: `I searched through the firm memory for "${q}".\n\nBased on available records, I found relevant information across multiple categories. The AI Firm Memory stores all client interactions, filings, notices, and recommendations. Try one of the example queries for a detailed demo response.`,
          sources: ['Firm Memory Index', 'Client Database', 'Filing Records'],
          timestamp: 'Just now',
        });
      }
      setIsSearching(false);
    }, 1200);
  }, [searchQuery]);

  const metrics = [
    { label: 'Total Memories', value: '646', icon: Database, color: 'emerald' },
    { label: 'Clients Remembered', value: '24', icon: Users, color: 'blue' },
    { label: 'Notices Stored', value: '18', icon: AlertTriangle, color: 'red' },
    { label: 'Filings History', value: '312', icon: FileCheck, color: 'emerald' },
    { label: 'Conversations', value: '156', icon: MessageSquare, color: 'purple' },
    { label: 'Recommendations', value: '89', icon: Lightbulb, color: 'amber' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <AnimatedCard delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">AI Firm Memory</h1>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold px-2">Active</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Remembers everything about your firm — ask any question, get instant answers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">646 Memories</span>
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* ─── Metrics ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => (
          <AnimatedCard key={m.label} delay={0.05 * i}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px] text-slate-500 font-medium truncate">{m.label}</span>
                </div>
                <p className="text-lg font-bold text-slate-800">{m.value}</p>
              </CardContent>
            </Card>
          </AnimatedCard>
        ))}
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 h-9 p-0.5">
          <TabsTrigger value="search" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Search</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Categories</TabsTrigger>
          <TabsTrigger value="clients" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Clients</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Timeline</TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Knowledge</TabsTrigger>
        </TabsList>

        {/* ── Search Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="search" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Search className="h-4 w-4 text-emerald-500" /> Memory Search
                </CardTitle>
                <CardDescription className="text-xs">Ask any question about your firm in natural language</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search Input */}
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Ask anything... e.g. 'What happened with ABC Traders in March?'"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-9 h-10 text-sm"
                    />
                  </div>
                  <Button
                    onClick={() => handleSearch()}
                    disabled={isSearching}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5"
                  >
                    {isSearching ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' as const }}>
                        <Zap className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <Brain className="h-4 w-4 mr-1" />
                    )}
                    {isSearching ? 'Searching...' : 'Ask AI'}
                  </Button>
                </div>

                {/* Example Query Chips */}
                <div className="mb-4">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Try asking</span>
                  <div className="flex flex-wrap gap-2">
                    {exampleQueries.map((q) => (
                      <motion.button
                        key={q}
                        onClick={() => {
                          setSearchQuery(q);
                          handleSearch(q);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50/50 text-[11px] text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Search Result */}
                <AnimatePresence mode="wait">
                  {isSearching && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 p-4 rounded-lg bg-slate-50"
                    >
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' as const }}>
                        <Sparkles className="h-5 w-5 text-emerald-500" />
                      </motion.div>
                      <span className="text-sm text-slate-500">Searching through 646 memories...</span>
                    </motion.div>
                  )}

                  {searchResult && !isSearching && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-700">AI Memory Response</span>
                      </div>

                      {/* Query */}
                      <div className="flex items-start gap-2 mb-3 p-2.5 rounded-md bg-white/80">
                        <Quote className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-xs font-medium text-slate-600 italic">&ldquo;{searchResult.query}&rdquo;</p>
                      </div>

                      {/* Answer */}
                      <div className="p-3 rounded-md bg-white border border-emerald-100 mb-3">
                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{searchResult.answer}</p>
                      </div>

                      {/* Sources */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Sources</span>
                        <div className="flex flex-wrap gap-1.5">
                          {searchResult.sources.map((source, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] h-5 px-2 gap-1 border-emerald-200 text-emerald-700">
                              <Link2 className="h-2.5 w-2.5" />
                              {source}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Categories Tab ─────────────────────────────────────────────── */}
        <TabsContent value="categories" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memoryCategories.map((cat, i) => (
              <AnimatedCard key={cat.type} delay={0.05 * i}>
                <Card className="border-slate-200/80 shadow-sm hover:border-emerald-200 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '15' }}>
                        <cat.icon className="h-5 w-5" style={{ color: cat.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-700">{cat.label}</span>
                          <span className="text-lg font-bold" style={{ color: cat.color }}>{cat.count}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{cat.description}</p>
                      </div>
                    </div>

                    {/* Mini bar */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(cat.count / 312) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.1 * i }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>
            ))}
          </div>

          {/* Recent Memories */}
          <AnimatedCard delay={0.3}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" /> Recent Memories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[360px]">
                  <div className="space-y-2">
                    {recentMemories.map((mem, i) => {
                      const TypeIcon = memoryTypeIcons[mem.type];
                      return (
                        <motion.div
                          key={mem.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                        >
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: memoryTypeColors[mem.type] + '15' }}>
                            <TypeIcon className="h-3.5 w-3.5" style={{ color: memoryTypeColors[mem.type] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-700 truncate">{mem.title}</span>
                              <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: memoryTypeColors[mem.type] + '15', color: memoryTypeColors[mem.type] }}>
                                {memoryTypeLabels[mem.type]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-1">{mem.description}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{mem.clientName}</span>
                              <span>&middot;</span>
                              <span>{mem.date}</span>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {mem.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[8px] h-3.5 px-1">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Clients Tab ────────────────────────────────────────────────── */}
        <TabsContent value="clients" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-500" /> Client Memory
                </CardTitle>
                <CardDescription className="text-xs">Select a client to see all stored memories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Client List */}
                  <div className="space-y-1">
                    {clientMemories.map((client) => (
                      <motion.button
                        key={client.clientId}
                        onClick={() => setSelectedClient(client.clientId)}
                        whileHover={{ x: 2 }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          selectedClient === client.clientId
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-100 hover:border-emerald-200'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-700">
                          {client.clientName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{client.clientName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{client.gstin}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                          {client.memories.length}
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      </motion.button>
                    ))}
                  </div>

                  {/* Client Memory Detail */}
                  <div className="lg:col-span-2">
                    {selectedClient ? (
                      <div className="space-y-2">
                        {clientMemories
                          .find((c) => c.clientId === selectedClient)
                          ?.memories.map((mem, i) => {
                            const TypeIcon = memoryTypeIcons[mem.type];
                            return (
                              <motion.div
                                key={mem.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className="p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: memoryTypeColors[mem.type] + '15' }}>
                                    <TypeIcon className="h-4 w-4" style={{ color: memoryTypeColors[mem.type] }} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-xs font-semibold text-slate-700">{mem.title}</span>
                                      <Badge className="text-[9px] h-4 px-1.5" style={{ backgroundColor: memoryTypeColors[mem.type] + '15', color: memoryTypeColors[mem.type] }}>
                                        {memoryTypeLabels[mem.type]}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500">{mem.description}</p>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                      <span>{mem.date}</span>
                                      <span>&middot;</span>
                                      <div className="flex gap-1">
                                        {mem.tags.map((tag) => (
                                          <Badge key={tag} variant="outline" className="text-[8px] h-3.5 px-1">{tag}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                        <Users className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">Select a client to view memories</p>
                        <p className="text-xs text-slate-300 mt-1">Click on any client from the list</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Timeline Tab ───────────────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" /> Timeline View
                </CardTitle>
                <CardDescription className="text-xs">Chronological view of all firm events</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="relative pl-6">
                    {/* Timeline line */}
                    <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-slate-200" />

                    {timelineEvents.map((event, i) => {
                      const TypeIcon = memoryTypeIcons[event.type];
                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="relative mb-4 last:mb-0"
                        >
                          {/* Timeline dot */}
                          <div
                            className="absolute -left-6 top-2 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center"
                            style={{ backgroundColor: memoryTypeColors[event.type] }}
                          >
                            <TypeIcon className="h-2.5 w-2.5 text-white" />
                          </div>

                          <div className="p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-700">{event.title}</span>
                              <Badge className="text-[9px] h-4 px-1.5 shrink-0" style={{ backgroundColor: memoryTypeColors[event.type] + '15', color: memoryTypeColors[event.type] }}>
                                {memoryTypeLabels[event.type]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">{event.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span>{event.clientName}</span>
                              <span>&middot;</span>
                              <span>{event.date}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Knowledge Tab ──────────────────────────────────────────────── */}
        <TabsContent value="knowledge" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-emerald-500" /> Knowledge Graph
                </CardTitle>
                <CardDescription className="text-xs">Visual representation of connected entities in firm memory</CardDescription>
              </CardHeader>
              <CardContent>
                <KnowledgeGraph />

                <Separator className="my-4" />

                {/* Graph Legend */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {memoryCategories.slice(0, 4).map((cat) => (
                    <div key={cat.type} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-[11px] text-slate-600">{cat.label}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{cat.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>

          {/* Memory Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatedCard delay={0.15}>
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" /> Memory Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-700">AI Insight</span>
                    </div>
                    <p className="text-xs text-slate-600">ABC Traders has received 2 notices in the last 90 days. Consider reviewing their compliance practices to prevent future issues.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[11px] font-semibold text-amber-700">Trend Alert</span>
                    </div>
                    <p className="text-xs text-slate-600">Late filing rate increased by 15% this quarter. 3 clients filed after the due date vs. 1 last quarter.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold text-blue-700">Recommendation</span>
                    </div>
                    <p className="text-xs text-slate-600">Sharma Industries qualifies for QRMP scheme. Switching could reduce their filing burden by 66%.</p>
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>

            <AnimatedCard delay={0.2}>
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-500" /> Memory Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <svg width="100%" height="200" viewBox="0 0 300 200" className="overflow-visible">
                    {memoryCategories.map((cat, i) => {
                      const barHeight = (cat.count / 312) * 160;
                      const x = (i / memoryCategories.length) * 260 + 20;
                      return (
                        <React.Fragment key={cat.type}>
                          <motion.rect
                            x={x}
                            y={180 - barHeight}
                            width={28}
                            height={barHeight}
                            rx="4"
                            fill={cat.color}
                            initial={{ height: 0, y: 180 }}
                            animate={{ height: barHeight, y: 180 - barHeight }}
                            transition={{ duration: 0.6, delay: 0.1 * i }}
                          />
                          <text x={x + 14} y={195} textAnchor="middle" className="fill-slate-400 text-[7px]">
                            {cat.label}
                          </text>
                          <text x={x + 14} y={180 - barHeight - 5} textAnchor="middle" className="fill-slate-600 text-[8px] font-semibold">
                            {cat.count}
                          </text>
                        </React.Fragment>
                      );
                    })}
                  </svg>
                </CardContent>
              </Card>
            </AnimatedCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
