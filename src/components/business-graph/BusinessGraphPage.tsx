'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Operating System Dashboard
// Phase 5 — Understand Everything. Connect Everything.
//                  See Connections. Understand Causes. Predict Outcomes. Operate Intelligently.
//
// Modules rendered here (all 10):
//   Module 1  — Knowledge Graph Engine™ (stats footer)
//   Module 2  — Client Relationship Graph™ (chains)
//   Module 3  — Risk Graph™
//   Module 4  — Business Dependency Graph™
//   Module 5  — Natural Language Graph Queries™
//   Module 6  — Visual Graph Explorer™ (HERO)
//   Module 7  — Business Memory Graph™
//   Module 8  — Prediction Graph™ (What-If)
//   Module 9  — Graph Insights™
//   Module 10 — Graph API™
//
// Data sources:
//   GET  /api/graph         → GraphState (auto-refresh every 90s)
//   POST /api/graph/query   → GraphQueryResult
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, Search, ZoomIn, ZoomOut, Maximize2, Filter, Layers,
  ShieldAlert, Activity, Clock, RefreshCw, Send, Sparkles,
  ChevronRight, Zap, Target, Brain, MessageSquare, Lightbulb,
  AlertTriangle, CheckCircle2, Eye, Database, IndianRupee,
  TrendingUp, TrendingDown, Wallet, FileText, Bot, Workflow,
  GitBranch, Link2, Users, Building2, Truck, FileBarChart,
  Plus, Minus, Crosshair, X, Play, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type {
  BusinessMemoryGraph,
  DependencyAnswer,
  GraphEdge,
  GraphInsight,
  GraphNode,
  GraphQueryResult,
  GraphState,
  InsightSeverity,
  MemoryRelationship,
  NodeType,
  RelationshipChain,
  RelationshipChainStep,
  RelationshipType,
  RiskCategory,
  RiskGraph,
  RiskLevel,
  RiskNode,
  WhatIfScenario,
} from '@/lib/graph/types';
import {
  NODE_LABELS, RISK_COLOR, RISK_GLYPH,
} from '@/lib/graph/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatINRFull(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 0 || s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function signedINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount) || amount === 0) return '₹0';
  const sign = amount > 0 ? '+' : '−';
  return sign + formatINR(Math.abs(amount));
}

// ─── Importance ranking for explorer node limiting ────────────────────────────

function nodeImportance(n: GraphNode): number {
  let base = 30;
  if (n.type === 'business') base = 100;
  else if (n.type === 'client' || n.type === 'vendor' || n.type === 'employee' || n.type === 'bank-account') base = 75;
  else if (n.type === 'invoice' || n.type === 'gst-return' || n.type === 'notice' || n.type === 'task' || n.type === 'report') base = 50;
  else if (n.type === 'prediction' || n.type === 'conversation') base = 30;
  if (n.riskScore) base += Math.min(20, n.riskScore / 5);
  if (n.amount) base += Math.min(15, Math.log10(n.amount + 1));
  return base;
}

function nodeRadius(n: GraphNode): number {
  if (n.type === 'business') return 28;
  if (n.type === 'client' || n.type === 'vendor' || n.type === 'employee' || n.type === 'bank-account') return 22;
  if (n.type === 'invoice' || n.type === 'gst-return' || n.type === 'notice' || n.type === 'task' || n.type === 'report') return 16;
  return 12;
}

function nodeColor(n: GraphNode, riskOverlay: boolean): string {
  if (riskOverlay && n.riskLevel) return RISK_COLOR[n.riskLevel];
  return NODE_LABELS[n.type].color;
}

// Edge color map (by relationship type)
const EDGE_COLORS: Record<RelationshipType, string> = {
  OWNS: '#2563EB',
  PAYS: '#3B82F6',
  OWES: '#f97316',
  FILES: '#3B82F6',
  GENERATES: '#a78bfa',
  RESPONDS_TO: '#ef4444',
  WORKS_WITH: '#f472b6',
  ASSIGNED_TO: '#facc15',
  CONNECTED_TO: '#64748b',
  PREDICTED_BY: '#c084fc',
  CREATED_BY: '#fb923c',
  // ── Phase 6 LIVE additions ────────────────────────────────────────────────
  RECEIVES: '#60A5FA',
  SUPPLIES: '#f59e0b',
  CLEARS: '#2563EB',
  REDUCES: '#f43f5e',
  AFFECTS: '#dc2626',
  MANAGES: '#f472b6',
  DERIVES_FROM: '#a78bfa',
  PAID_BY: '#3B82F6',
  RECORDED_IN: '#0ea5e9',
  GENERATES_LIABILITY: '#7c3aed',
};

const EDGE_LABELS: Record<RelationshipType, string> = {
  OWNS: 'Owns',
  PAYS: 'Pays',
  OWES: 'Owes',
  FILES: 'Files',
  GENERATES: 'Generates',
  RESPONDS_TO: 'Responds To',
  WORKS_WITH: 'Works With',
  ASSIGNED_TO: 'Assigned To',
  CONNECTED_TO: 'Connected To',
  PREDICTED_BY: 'Predicted By',
  CREATED_BY: 'Created By',
  // ── Phase 6 LIVE additions ────────────────────────────────────────────────
  RECEIVES: 'Receives',
  SUPPLIES: 'Supplies',
  CLEARS: 'Clears',
  REDUCES: 'Reduces',
  AFFECTS: 'Affects',
  MANAGES: 'Manages',
  DERIVES_FROM: 'Derives From',
  PAID_BY: 'Paid By',
  RECORDED_IN: 'Recorded In',
  GENERATES_LIABILITY: 'Generates Liability',
};

const ALL_NODE_TYPES: NodeType[] = [
  'business', 'client', 'vendor', 'invoice', 'gst-return',
  'bank-account', 'employee', 'task', 'report', 'notice',
  'conversation', 'prediction',
  // ── Phase 6 LIVE additions ────────────────────────────────────────────────
  'itc-record', 'transaction', 'payment', 'collection', 'expense',
  'meeting', 'asset', 'loan', 'tax-payment',
];

const RISK_CATEGORIES: { key: RiskCategory; label: string; emoji: string }[] = [
  { key: 'late_payment', label: 'Late Payment', emoji: '💸' },
  { key: 'gst_notice', label: 'GST Notice', emoji: '⚠️' },
  { key: 'cash_flow', label: 'Cash Flow', emoji: '🏦' },
  { key: 'vendor_dependency', label: 'Vendor Dependency', emoji: '🚚' },
  { key: 'revenue_concentration', label: 'Revenue Concentration', emoji: '🎯' },
  { key: 'compliance', label: 'Compliance', emoji: '🛡️' },
  { key: 'fraud', label: 'Fraud', emoji: '🚨' },
];

const QUICK_QUERIES: { label: string; text: string }[] = [
  { label: 'Why did revenue drop?', text: 'Why did revenue drop?' },
  { label: 'Who are my risky clients?', text: 'Who are my risky clients?' },
  { label: 'Which invoices are overdue?', text: 'Which invoices are overdue?' },
  { label: 'Which vendor affects profitability?', text: 'Which vendor affects profitability?' },
  { label: 'Show businesses connected to GST notices', text: 'Show businesses connected to GST notices' },
  { label: 'Which employee manages ABC Pvt Ltd?', text: 'Which employee manages ABC Pvt Ltd?' },
  { label: 'Why is cash flow down?', text: 'Why is cash flow down?' },
  { label: 'Most profitable client', text: 'Show me the most profitable client' },
];

// ─── Motion wrapper ───────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
    >
      {children}
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, subtitle, action,
}: { icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — VISUAL GRAPH EXPLORER™ (HERO)
// ═══════════════════════════════════════════════════════════════════════════════

interface ExplorerProps {
  state: GraphState;
  focusedNodeId: string | null;
  setFocusedNodeId: (id: string | null) => void;
}

interface NodePos { x: number; y: number; }

function VisualGraphExplorer({ state, focusedNodeId, setFocusedNodeId }: ExplorerProps) {
  const { toast } = useToast();

  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [userOverrides, setUserOverrides] = useState<Record<string, NodePos>>({});
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const [search, setSearch] = useState('');
  const [riskOverlay, setRiskOverlay] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Interaction state — refs for hot-path values, state for the cursor
  const svgRef = useRef<SVGSVGElement | null>(null);
  const interactionMode = useRef<'none' | 'pan' | 'node-drag'>('none');
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragNodeId = useRef<string | null>(null);
  const movedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  // Positions = engine-derived layout + any user drag overrides
  const positions = useMemo(() => {
    const pos: Record<string, NodePos> = {};
    state.knowledgeGraph.nodes.forEach((n) => {
      pos[n.id] = userOverrides[n.id] || { x: n.x ?? 0, y: n.y ?? 0 };
    });
    return pos;
  }, [state, userOverrides]);

  // ─── Visible nodes (filtered + limited) ─────────────────────────────────────
  const visibleNodes = useMemo(() => {
    const lower = search.trim().toLowerCase();
    let nodes = state.knowledgeGraph.nodes.filter((n) => !hiddenTypes.has(n.type));

    if (lower) {
      const matches = nodes.filter((n) => n.label.toLowerCase().includes(lower));
      const matchSet = new Set(matches.map((m) => m.id));
      // Add 1-hop neighbors of matches
      state.knowledgeGraph.edges.forEach((e) => {
        if (matchSet.has(e.source)) matchSet.add(e.target);
        if (matchSet.has(e.target)) matchSet.add(e.source);
      });
      nodes = nodes.filter((n) => matchSet.has(n.id));
    }

    // Always keep business + focused node
    const alwaysKeep = new Set<string>();
    state.knowledgeGraph.nodes.filter((n) => n.type === 'business').forEach((n) => alwaysKeep.add(n.id));
    if (focusedNodeId) alwaysKeep.add(focusedNodeId);
    if (selectedNodeId) alwaysKeep.add(selectedNodeId);

    // Sort by importance and limit to top 45
    const sorted = [...nodes].sort((a, b) => {
      if (alwaysKeep.has(a.id) && !alwaysKeep.has(b.id)) return -1;
      if (!alwaysKeep.has(a.id) && alwaysKeep.has(b.id)) return 1;
      return nodeImportance(b) - nodeImportance(a);
    });
    return sorted.slice(0, 45);
  }, [state, hiddenTypes, search, focusedNodeId, selectedNodeId]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return state.knowledgeGraph.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    );
  }, [state, visibleNodeIds]);

  // ─── Focus neighbors (for highlighting) ─────────────────────────────────────
  const focusNeighbors = useMemo(() => {
    if (!focusedNodeId) return null;
    const set = new Set<string>([focusedNodeId]);
    state.knowledgeGraph.edges.forEach((e) => {
      if (e.source === focusedNodeId) set.add(e.target);
      if (e.target === focusedNodeId) set.add(e.source);
    });
    return set;
  }, [focusedNodeId, state]);

  // ─── Pointer interaction handlers ───────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as Element;
    const nodeIdAttr = target.getAttribute('data-node-id');
    (e.target as Element).setPointerCapture?.(e.pointerId);
    movedRef.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    if (nodeIdAttr) {
      interactionMode.current = 'node-drag';
      dragNodeId.current = nodeIdAttr;
      panStart.current = { ...positions[nodeIdAttr] };
    } else {
      interactionMode.current = 'pan';
      setIsPanning(true);
      panStart.current = { ...pan };
    }
  }, [pan, positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (interactionMode.current === 'none') return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;

    if (interactionMode.current === 'pan') {
      setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
    } else if (interactionMode.current === 'node-drag' && dragNodeId.current) {
      const id = dragNodeId.current;
      const newX = panStart.current.x + dx / zoom;
      const newY = panStart.current.y + dy / zoom;
      setUserOverrides((prev) => ({ ...prev, [id]: { x: newX, y: newY } }));
    }
  }, [zoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const wasMode = interactionMode.current;
    const targetId = dragNodeId.current;
    interactionMode.current = 'none';
    dragNodeId.current = null;
    setIsPanning(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);

    if (!movedRef.current && wasMode === 'node-drag' && targetId) {
      // Treat as click
      if (selectedNodeId === targetId) {
        setSelectedNodeId(null);
      } else {
        setSelectedNodeId(targetId);
      }
      if (focusedNodeId === targetId) {
        setFocusedNodeId(null);
      } else {
        setFocusedNodeId(targetId);
        // Scroll into view
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } else if (!movedRef.current && wasMode === 'pan') {
      // Background click — clear selection but keep focus if any
      setSelectedNodeId(null);
    }
  }, [focusedNodeId, selectedNodeId, setFocusedNodeId]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(3, Math.max(0.3, z + delta)));
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(3, z + 0.2)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.3, z - 0.2)), []);
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFocusedNodeId(null);
    setSelectedNodeId(null);
    setUserOverrides({});
  }, [setFocusedNodeId]);

  const toggleType = useCallback((t: NodeType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  // ─── Selected node detail (neighbors) ───────────────────────────────────────
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return state.knowledgeGraph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, state]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNodeId) return [];
    const results: { node: GraphNode; edge: GraphEdge }[] = [];
    state.knowledgeGraph.edges.forEach((e) => {
      if (e.source === selectedNodeId) {
        const n = state.knowledgeGraph.nodes.find((x) => x.id === e.target);
        if (n) results.push({ node: n, edge: e });
      } else if (e.target === selectedNodeId) {
        const n = state.knowledgeGraph.nodes.find((x) => x.id === e.source);
        if (n) results.push({ node: n, edge: e });
      }
    });
    return results.slice(0, 12);
  }, [selectedNodeId, state]);

  const selectedRisk = useMemo(() => {
    if (!selectedNodeId) return null;
    return state.riskGraph.nodes.find((r) => r.nodeId === selectedNodeId) || null;
  }, [selectedNodeId, state]);

  // ─── SVG coordinate system ──────────────────────────────────────────────────
  // Use a fixed viewBox that fits a typical radial layout (~720x540)
  const VIEW_W = 800;
  const VIEW_H = 540;

  const focusNode = useCallback((id: string) => {
    setFocusedNodeId(id);
    setSelectedNodeId(id);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [setFocusedNodeId]);

  return (
    <FadeIn delay={0.05}>
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4 accent-text" />
              Visual Graph Explorer
              <Badge variant="outline" className="ml-1 border-white/10 bg-white/[0.03] text-[10px]">
                {visibleNodes.length} of {state.knowledgeGraph.nodes.length} nodes
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={riskOverlay}
                onCheckedChange={setRiskOverlay}
                id="risk-overlay"
              />
              <label htmlFor="risk-overlay" className="cursor-pointer">
                Risk overlay
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ─── Filter bar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3 w-3" />
              <span>Filter</span>
            </div>
            {ALL_NODE_TYPES.map((t) => {
              const hidden = hiddenTypes.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
                    hidden
                      ? 'border-white/[0.06] bg-white/[0.01] text-muted-foreground/50 line-through'
                      : 'border-white/10 bg-white/[0.04] text-foreground hover:bg-white/[0.07]'
                  }`}
                  style={hidden ? {} : { borderColor: `${NODE_LABELS[t].color}55` }}
                >
                  <span>{NODE_LABELS[t].emoji}</span>
                  <span>{NODE_LABELS[t].label}</span>
                </button>
              );
            })}
          </div>

          {/* ─── Search + zoom controls ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes by label…"
                className="h-8 border-white/10 bg-white/[0.02] pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={zoomOut} className="h-8 w-8 border-white/10 bg-white/[0.03] p-0" title="Zoom out">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-12 text-center text-[10px] tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button size="sm" variant="outline" onClick={zoomIn} className="h-8 w-8 border-white/10 bg-white/[0.03] p-0" title="Zoom in">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={resetView} className="h-8 border-white/10 bg-white/[0.03] px-2 text-[10px]" title="Reset view">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ─── SVG canvas ─────────────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.02] via-black/40 to-cyan-500/[0.02]">
            <svg
              ref={svgRef}
              viewBox={`${-VIEW_W / 2} ${-VIEW_H / 2} ${VIEW_W} ${VIEW_H}`}
              className={`block h-[400px] w-full touch-none sm:h-[600px] ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={handleWheel}
            >
              {/* Subtle grid background */}
              <defs>
                <pattern id="explorer-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="0" cy="0" r="0.8" fill="rgba(255,255,255,0.04)" />
                </pattern>
                {visibleNodes.map((n) => (
                  <radialGradient key={`grad-${n.id}`} id={`grad-${n.id}`} cx="35%" cy="35%">
                    <stop offset="0%" stopColor={nodeColor(n, riskOverlay)} stopOpacity={1} />
                    <stop offset="100%" stopColor={nodeColor(n, riskOverlay)} stopOpacity={0.55} />
                  </radialGradient>
                ))}
              </defs>
              <rect x={-VIEW_W / 2} y={-VIEW_H / 2} width={VIEW_W} height={VIEW_H} fill="url(#explorer-grid)" />

              {/* Transform group for pan + zoom */}
              <g transform={`translate(${pan.x / zoom} ${pan.y / zoom}) scale(${zoom})`}>
                {/* Edges */}
                {visibleEdges.map((e) => {
                  const s = positions[e.source];
                  const t = positions[e.target];
                  if (!s || !t) return null;
                  const inFocus = focusNeighbors
                    ? focusNeighbors.has(e.source) && focusNeighbors.has(e.target)
                    : true;
                  const dim = focusNeighbors && !inFocus;
                  const weight = e.weight ?? 1;
                  const stroke = EDGE_COLORS[e.type] || '#64748b';
                  return (
                    <line
                      key={e.id}
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={stroke}
                      strokeWidth={Math.max(0.8, Math.min(4, weight * 0.5))}
                      strokeOpacity={dim ? 0.08 : 0.6}
                      strokeDasharray={e.type === 'PREDICTED_BY' ? '4 3' : undefined}
                    />
                  );
                })}

                {/* Nodes */}
                {visibleNodes.map((n) => {
                  const p = positions[n.id];
                  if (!p) return null;
                  const r = nodeRadius(n);
                  const isFocused = focusedNodeId === n.id;
                  const isSelected = selectedNodeId === n.id;
                  const inFocus = focusNeighbors ? focusNeighbors.has(n.id) : true;
                  const dim = focusNeighbors && !inFocus;
                  const label = NODE_LABELS[n.type];
                  const color = nodeColor(n, riskOverlay);
                  const opacity = dim ? 0.18 : 1;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x} ${p.y})`}
                      style={{ opacity, transition: 'opacity 200ms' }}
                    >
                      {/* Focus ring */}
                      {(isFocused || isSelected) && (
                        <circle
                          r={r + 6}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.5}
                          strokeOpacity={0.6}
                          strokeDasharray="3 2"
                          className={isFocused ? 'animate-pulse' : ''}
                        />
                      )}
                      {/* Node circle */}
                      <circle
                        r={r}
                        fill={`url(#grad-${n.id})`}
                        stroke={color}
                        strokeWidth={isSelected ? 2.5 : 1.2}
                        strokeOpacity={0.9}
                        data-node-id={n.id}
                        className="cursor-pointer transition-all"
                      />
                      {/* Emoji */}
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={r * 0.9}
                        pointerEvents="none"
                      >
                        {label.emoji}
                      </text>
                      {/* Label */}
                      <text
                        y={r + 12}
                        textAnchor="middle"
                        fontSize={9}
                        fill="rgba(255,255,255,0.85)"
                        fontWeight={500}
                        pointerEvents="none"
                      >
                        {n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label}
                      </text>
                      {n.amount != null && n.amount > 0 && (
                        <text
                          y={r + 22}
                          textAnchor="middle"
                          fontSize={8}
                          fill={color}
                          pointerEvents="none"
                          fontWeight={600}
                        >
                          {formatINR(n.amount)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* ─── Edge legend (top-right) ─────────────────────────────────── */}
            <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-white/[0.06] bg-black/60 px-2 py-1.5 backdrop-blur-sm">
              <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Edges</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {Object.entries(EDGE_COLORS).slice(0, 8).map(([t, c]) => (
                  <div key={t} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className="inline-block h-0.5 w-3" style={{ background: c }} />
                    <span>{EDGE_LABELS[t as RelationshipType]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Focused-node indicator ─────────────────────────────────── */}
            {focusedNodeId && (
              <div className="absolute left-2 top-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-2 py-1 backdrop-blur-sm">
                <Crosshair className="h-3 w-3 text-emerald-300" />
                <span className="text-[10px] font-medium text-emerald-200">
                  Focused: {state.knowledgeGraph.nodes.find((n) => n.id === focusedNodeId)?.label || '—'}
                </span>
                <button
                  onClick={() => { setFocusedNodeId(null); setSelectedNodeId(null); }}
                  className="text-emerald-300 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* ─── Node detail panel (right side) ─────────────────────────── */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-2 right-2 top-12 w-[230px] overflow-y-auto rounded-xl border border-white/[0.08] bg-black/80 p-3 backdrop-blur-md custom-scrollbar sm:w-[260px]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{NODE_LABELS[selectedNode.type].emoji}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{
                            color: NODE_LABELS[selectedNode.type].color,
                            background: `${NODE_LABELS[selectedNode.type].color}1a`,
                          }}
                        >
                          {NODE_LABELS[selectedNode.type].label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedNode.label}</p>
                      {selectedNode.subtitle && (
                        <p className="text-[10px] text-muted-foreground">{selectedNode.subtitle}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedNodeId(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {selectedNode.amount != null && (
                    <div className="mb-2 rounded-md bg-white/[0.03] p-2">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Amount</p>
                      <p className="text-sm font-bold text-foreground">{formatINRFull(selectedNode.amount)}</p>
                    </div>
                  )}

                  {selectedRisk && (
                    <div className="mb-2 rounded-md border border-white/[0.08] bg-white/[0.02] p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Risk</span>
                        <span className="text-[10px] font-bold" style={{ color: RISK_COLOR[selectedRisk.level] }}>
                          {RISK_GLYPH[selectedRisk.level]} {selectedRisk.level.toUpperCase()}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${selectedRisk.score}%`,
                            background: RISK_COLOR[selectedRisk.level],
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[9px] text-muted-foreground">Score {selectedRisk.score}/100</p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                      Connections ({selectedNeighbors.length})
                    </p>
                    <div className="max-h-44 space-y-1 overflow-y-auto custom-scrollbar pr-1">
                      {selectedNeighbors.map(({ node, edge }) => (
                        <button
                          key={edge.id}
                          onClick={() => focusNode(node.id)}
                          className="block w-full rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1 text-left hover:bg-white/[0.05]"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-[10px] font-medium text-foreground">
                              {NODE_LABELS[node.type].emoji} {node.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <span
                              className="inline-block h-1 w-1 rounded-full"
                              style={{ background: EDGE_COLORS[edge.type] }}
                            />
                            <span>{EDGE_LABELS[edge.type]}</span>
                          </div>
                        </button>
                      ))}
                      {selectedNeighbors.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No connections.</p>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const prompt = `Explain the connection between ${selectedNode.label} and the rest of the business graph.`;
                      window.dispatchEvent(new CustomEvent('oracle-ask', { detail: { prompt } }));
                      toast({ title: 'Oracle engaged', description: `Asking about ${selectedNode.label}` });
                    }}
                    className="mt-2 h-7 w-full border-white/10 bg-white/[0.03] text-[10px] hover:bg-white/[0.06]"
                  >
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Ask VEYRO AI
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hint */}
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground/70">Tip:</span> Drag canvas to pan · Wheel to zoom ·
            Drag a node to reposition · Click a node to focus & inspect · Use filters above to hide types.
          </p>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 9 — GRAPH INSIGHTS™
// ═══════════════════════════════════════════════════════════════════════════════

function severityClasses(s: InsightSeverity): { border: string; bg: string; text: string } {
  switch (s) {
    case 'critical': return { border: 'border-red-500/30', bg: 'bg-red-500/[0.04]', text: 'text-red-400' };
    case 'warning': return { border: 'border-amber-500/30', bg: 'bg-amber-500/[0.04]', text: 'text-amber-400' };
    case 'opportunity': return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.04]', text: 'text-emerald-400' };
    default: return { border: 'border-cyan-500/30', bg: 'bg-cyan-500/[0.04]', text: 'text-cyan-400' };
  }
}

function InsightsModule({
  insights, onFocusNode,
}: { insights: GraphInsight[]; onFocusNode: (id: string) => void }) {
  return (
    <div>
      <SectionHeader
        icon={Lightbulb}
        title="Graph Insights"
        subtitle="Surface-level intelligence mined from the graph"
        action={<Badge variant="outline" className="border-white/10 bg-white/[0.03]">{insights.length} active</Badge>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((ins, i) => {
          const cls = severityClasses(ins.severity);
          return (
            <FadeIn key={ins.id} delay={0.05 + i * 0.04}>
              <Card className={`border ${cls.border} ${cls.bg} backdrop-blur-sm hover:bg-white/[0.04] transition-colors`}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{ins.emoji}</span>
                      <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                    </div>
                    <Badge variant="outline" className={`border-white/10 bg-white/[0.03] text-[9px] uppercase ${cls.text}`}>
                      {ins.severity}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
                  {ins.amount != null && ins.amount > 0 && (
                    <p className={`mt-2 text-sm font-bold ${cls.text}`}>{formatINR(ins.amount)}</p>
                  )}
                  {ins.relatedNodeIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFocusNode(ins.relatedNodeIds[0])}
                      className="mt-3 h-7 border-white/10 bg-white/[0.03] text-[10px] hover:bg-white/[0.06]"
                    >
                      <Crosshair className="mr-1 h-3 w-3" />
                      Highlight in graph
                    </Button>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — CLIENT RELATIONSHIP GRAPH™ (chains)
// ═══════════════════════════════════════════════════════════════════════════════

function ChainStepCard({ step }: { step: RelationshipChainStep }) {
  const label = NODE_LABELS[step.nodeType];
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-center" style={{ minWidth: 110 }}>
      <span className="text-lg">{label.emoji}</span>
      <p className="mt-0.5 max-w-[120px] truncate text-[11px] font-medium text-foreground">{step.nodeName}</p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{step.impact}</p>
      {step.amount != null && step.amount > 0 && (
        <p className="text-[10px] font-semibold" style={{ color: label.color }}>{formatINR(step.amount)}</p>
      )}
    </div>
  );
}

function RelationshipChainsModule({
  chains, onFocusNode,
}: { chains: RelationshipChain[]; onFocusNode: (id: string) => void }) {
  return (
    <div>
      <SectionHeader
        icon={GitBranch}
        title="Client Relationship Graph"
        subtitle="Traceable chains: client → invoice → liability → collections → cash flow"
        action={<Badge variant="outline" className="border-white/10 bg-white/[0.03]">{chains.length} chains</Badge>}
      />
      <div className="space-y-3">
        {chains.length === 0 && (
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6 text-center text-xs text-muted-foreground">
              No relationship chains detected yet.
            </CardContent>
          </Card>
        )}
        {chains.map((chain, idx) => (
          <FadeIn key={chain.id} delay={0.05 + idx * 0.05}>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{chain.title}</p>
                    <p className="text-[10px] text-muted-foreground">{chain.steps.length}-step chain</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {chain.totalImpact > 0 && (
                      <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
                        Impact {formatINR(chain.totalImpact)}
                      </Badge>
                    )}
                    <span className="text-sm" title={chain.riskLevel}>
                      {RISK_GLYPH[chain.riskLevel]}
                    </span>
                  </div>
                </div>
                <div className="flex items-stretch gap-1 overflow-x-auto custom-scrollbar pb-2">
                  {chain.steps.map((step, i) => (
                    <div key={i} className="flex items-stretch gap-1">
                      <button onClick={() => onFocusNode(step.nodeId)} className="transition-transform hover:scale-105">
                        <ChainStepCard step={step} />
                      </button>
                      {i < chain.steps.length - 1 && (
                        <div className="flex items-center px-0.5 text-muted-foreground/60">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — RISK GRAPH™
// ═══════════════════════════════════════════════════════════════════════════════

function RiskGraphModule({
  riskGraph, onFocusNode,
}: { riskGraph: RiskGraph; onFocusNode: (id: string) => void }) {
  const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  return (
    <div>
      <SectionHeader
        icon={ShieldAlert}
        title="Risk Graph"
        subtitle="Overall risk level + category breakdown + top risks"
        action={
          <a
            href="/api/graph/risk"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-emerald-400 hover:underline"
          >
            Open Risk API →
          </a>
        }
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Overall + distribution */}
        <FadeIn delay={0.05}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Risk Level</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold" style={{ color: RISK_COLOR[riskGraph.overallLevel] }}>
                <span className="text-3xl">{RISK_GLYPH[riskGraph.overallLevel]}</span>
                <span className="capitalize">{riskGraph.overallLevel}</span>
              </p>
              <Separator className="my-3 bg-white/[0.06]" />
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Distribution</p>
              <div className="space-y-1.5">
                {levels.map((lvl) => {
                  const count = riskGraph.countByLevel[lvl] || 0;
                  const total = riskGraph.nodes.length || 1;
                  return (
                    <div key={lvl} className="flex items-center gap-2">
                      <span className="w-16 text-xs capitalize" style={{ color: RISK_COLOR[lvl] }}>
                        {RISK_GLYPH[lvl]} {lvl}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(count / total) * 100}%`, background: RISK_COLOR[lvl] }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs font-bold tabular-nums text-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Category breakdown */}
        <FadeIn delay={0.1}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Category Breakdown</p>
              <div className="grid grid-cols-1 gap-1.5">
                {RISK_CATEGORIES.map((cat) => {
                  const count = riskGraph.countByCategory[cat.key] || 0;
                  return (
                    <div key={cat.key} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
                      <span className="flex items-center gap-2 text-xs text-foreground">
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </span>
                      <Badge variant="outline" className={`border-white/10 bg-white/[0.03] ${count > 0 ? 'text-amber-300' : 'text-muted-foreground'}`}>
                        {count}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Top 5 risks */}
        <FadeIn delay={0.15}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Top 5 Risks</p>
              <ScrollArea className="max-h-72">
                <div className="space-y-2 pr-2">
                  {riskGraph.topRisks.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onFocusNode(r.nodeId)}
                      className="block w-full rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-left hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          {RISK_GLYPH[r.level]} {r.entityName}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: RISK_COLOR[r.level] }}>
                          {r.score}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${r.score}%`, background: RISK_COLOR[r.level] }}
                        />
                      </div>
                      <p className="mt-1 truncate text-[9px] text-muted-foreground">
                        {r.category.replace(/_/g, ' ')} · {r.impact}
                      </p>
                    </button>
                  ))}
                  {riskGraph.topRisks.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No risks detected.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Top risk detail cards */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {riskGraph.topRisks.map((r, i) => (
          <FadeIn key={r.id} delay={0.2 + i * 0.04}>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm" style={{ borderColor: `${RISK_COLOR[r.level]}33` }}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span>{RISK_GLYPH[r.level]}</span>
                    <span className="truncate">{r.entityName}</span>
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: `${RISK_COLOR[r.level]}1a`, color: RISK_COLOR[r.level] }}
                  >
                    {r.level}
                  </span>
                </div>
                <p className="mb-1 text-[10px] text-muted-foreground">Category: {r.category.replace(/_/g, ' ')}</p>
                <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.score}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }}
                    className="h-full rounded-full"
                    style={{ background: RISK_COLOR[r.level] }}
                  />
                </div>
                <div className="space-y-1">
                  {r.reasons.slice(0, 2).map((reason, ri) => (
                    <p key={ri} className="text-[10px] leading-relaxed text-muted-foreground">• {reason}</p>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-foreground/80">
                  <span className="font-medium">Impact:</span> {r.impact}
                </p>
                {r.amountAtRisk != null && r.amountAtRisk > 0 && (
                  <p className="mt-1 text-xs font-semibold" style={{ color: RISK_COLOR[r.level] }}>
                    At risk: {formatINR(r.amountAtRisk)}
                  </p>
                )}
                <p className="mt-2 rounded-md bg-white/[0.03] p-1.5 text-[10px] leading-relaxed text-foreground/80">
                  <span className="font-medium">Action:</span> {r.recommendation}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onFocusNode(r.nodeId)}
                  className="mt-2 h-7 w-full border-white/10 bg-white/[0.03] text-[10px] hover:bg-white/[0.06]"
                >
                  <Crosshair className="mr-1 h-3 w-3" />
                  Highlight in graph
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — BUSINESS DEPENDENCY GRAPH™
// ═══════════════════════════════════════════════════════════════════════════════

function DependencyAnswerCard({
  answer, delay, onFocusNode,
}: { answer: DependencyAnswer; delay: number; onFocusNode: (id: string) => void }) {
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">{answer.question}</p>
          <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5">
            <p className="text-xs leading-relaxed text-foreground">{answer.answer}</p>
          </div>
          <ScrollArea className="max-h-56">
            <ul className="space-y-1.5 pr-2">
              {answer.bullets.map((b, i) => {
                const relatedId = answer.relatedNodes[i];
                return (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/85">
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    {relatedId ? (
                      <button
                        onClick={() => onFocusNode(relatedId)}
                        className="text-left hover:text-emerald-300 hover:underline"
                      >
                        {b}
                      </button>
                    ) : (
                      <span>{b}</span>
                    )}
                  </li>
                );
              })}
              {answer.bullets.length === 0 && (
                <li className="text-xs text-muted-foreground">No data yet.</li>
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function DependencyGraphModule({
  answers, onFocusNode,
}: { answers: DependencyAnswer[]; onFocusNode: (id: string) => void }) {
  return (
    <div>
      <SectionHeader
        icon={Link2}
        title="Business Dependency Graph"
        subtitle="Answers to canonical business questions — click any bullet to highlight in the explorer"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {answers.map((a, i) => (
          <DependencyAnswerCard key={i} answer={a} delay={0.05 + i * 0.04} onFocusNode={onFocusNode} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — NATURAL LANGUAGE GRAPH QUERIES™
// ═══════════════════════════════════════════════════════════════════════════════

function NLQueryModule({
  state, onFocusNode, onFocusNodes,
}: {
  state: GraphState;
  onFocusNode: (id: string) => void;
  onFocusNodes: (ids: string[]) => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GraphQueryResult | null>(null);

  const submitQuery = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/graph/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: q }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GraphQueryResult;
      setResult(json);
      setText(q);
    } catch (e) {
      toast({
        title: 'Query failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const confidenceTier = (c: number) => {
    if (c >= 0.8) return { label: 'HIGH', color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/[0.08]' };
    if (c >= 0.5) return { label: 'MEDIUM', color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/[0.08]' };
    return { label: 'LOW', color: 'text-red-400', bg: 'border-red-500/30 bg-red-500/[0.08]' };
  };

  return (
    <div>
      <SectionHeader
        icon={Sparkles}
        title="Natural Language Graph Queries"
        subtitle="Ask the graph anything — Oracle traces causes & connections"
      />
      <FadeIn delay={0.05}>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ask: Why did revenue drop? · Who are my risky clients? · Which invoices are overdue?"
                  className="min-h-[60px] resize-y border-white/10 bg-white/[0.02] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      submitQuery(text);
                    }
                  }}
                />
              </div>
              <Button
                onClick={() => submitQuery(text)}
                disabled={loading || !text.trim()}
                className="accent-gradient h-10 shrink-0 text-white hover:opacity-90 sm:w-32"
              >
                {loading ? <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                {loading ? 'Tracing…' : 'Ask Graph'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_QUERIES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => submitQuery(q.text)}
                  disabled={loading}
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[10px] text-foreground transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="mt-3"
          >
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4">
                {/* Intent + confidence */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.05] text-[10px] text-emerald-300">
                    Intent: {result.intent.replace(/_/g, ' ')}
                  </Badge>
                  {(() => {
                    const tier = confidenceTier(result.confidence);
                    return (
                      <Badge variant="outline" className={`text-[10px] ${tier.bg} ${tier.color}`}>
                        {tier.label} · {Math.round(result.confidence * 100)}% confidence
                      </Badge>
                    );
                  })()}
                </div>

                {/* Spoken ack — Oracle response */}
                {result.spokenAck && (
                  <div className="mb-3 rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.08] to-cyan-500/[0.05] p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 accent-text" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider accent-text">VEYRO AI</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{result.spokenAck}</p>
                  </div>
                )}

                {/* Answer */}
                {result.answer && (
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{result.answer}</p>
                )}

                {/* Bullets */}
                {result.bullets.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Findings</p>
                    <ul className="space-y-1">
                      {result.bullets.map((b, i) => {
                        const relatedId = result.relatedNodeIds[i];
                        return (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/85">
                            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                            {relatedId ? (
                              <button
                                onClick={() => onFocusNode(relatedId)}
                                className="text-left hover:text-emerald-300 hover:underline"
                              >
                                {b}
                              </button>
                            ) : (
                              <span>{b}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Highlight related nodes button */}
                {result.relatedNodeIds.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onFocusNodes(result.relatedNodeIds)}
                    className="border-emerald-500/30 bg-emerald-500/[0.05] text-[11px] text-emerald-300 hover:bg-emerald-500/[0.1]"
                  >
                    <Crosshair className="mr-1.5 h-3 w-3" />
                    Highlight {result.relatedNodeIds.length} related node(s) in explorer
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — BUSINESS MEMORY GRAPH™
// ═══════════════════════════════════════════════════════════════════════════════

function MemoryGraphModule({ memory }: { memory: BusinessMemoryGraph }) {
  const behaviour = memory.relationships.filter((r) => r.category === 'behaviour');
  const performance = memory.relationships.filter((r) => r.category === 'performance');
  const historyPattern = memory.relationships.filter((r) => r.category === 'history' || r.category === 'pattern');

  return (
    <div>
      <SectionHeader
        icon={Brain}
        title="Business Memory Graph"
        subtitle="Long-term relationships the graph has remembered"
        action={
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">{memory.clientBehaviourCount} behaviours</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">{memory.teamPerformanceCount} team</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">{memory.historyCount} history</Badge>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Insights */}
        <FadeIn delay={0.05}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Lightbulb className="h-3.5 w-3.5 accent-text" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-64">
                <ul className="space-y-2 pr-2">
                  {memory.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/85">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 accent-text" />
                      <span>{ins}</span>
                    </li>
                  ))}
                  {memory.insights.length === 0 && (
                    <li className="text-xs text-muted-foreground">No insights yet.</li>
                  )}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Client behaviour */}
        <FadeIn delay={0.1}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Users className="h-3.5 w-3.5 accent-text" />
                Client Behaviour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {behaviour.map((r) => (
                    <MemoryRelationshipRow key={r.id} rel={r} />
                  ))}
                  {behaviour.length === 0 && (
                    <p className="text-xs text-muted-foreground">No client behaviour recorded yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Team performance */}
        <FadeIn delay={0.15}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Activity className="h-3.5 w-3.5 accent-text" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {performance.map((r) => (
                    <MemoryRelationshipRow key={r.id} rel={r} />
                  ))}
                  {performance.length === 0 && (
                    <p className="text-xs text-muted-foreground">No team performance records yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </FadeIn>

        {/* History / patterns */}
        <FadeIn delay={0.2}>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs">
                <Clock className="h-3.5 w-3.5 accent-text" />
                History & Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-64">
                <div className="space-y-2 pr-2">
                  {historyPattern.map((r) => (
                    <MemoryRelationshipRow key={r.id} rel={r} />
                  ))}
                  {historyPattern.length === 0 && (
                    <p className="text-xs text-muted-foreground">No history items yet.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}

function MemoryRelationshipRow({ rel }: { rel: MemoryRelationship }) {
  return (
    <div className="rounded-md border border-white/[0.04] bg-white/[0.02] p-2">
      <div className="flex items-start gap-1.5 text-xs">
        <span>{NODE_LABELS[rel.subjectType].emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground">
            <span className="font-medium">{rel.subject}</span>
            <span className="text-muted-foreground"> {rel.predicate} </span>
            {rel.object && <span className="text-foreground">{rel.object}</span>}
          </p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">{rel.evidence}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 8 — PREDICTION GRAPH™ (What-If)
// ═══════════════════════════════════════════════════════════════════════════════

function PredictionGraphModule({
  scenarios, onFocusNode,
}: { scenarios: WhatIfScenario[]; onFocusNode: (id: string) => void }) {
  return (
    <div>
      <SectionHeader
        icon={TrendingUp}
        title="Prediction Graph — What-If"
        subtitle="Traceable impact chains for business scenarios"
        action={<Badge variant="outline" className="border-white/10 bg-white/[0.03]">{scenarios.length} scenarios</Badge>}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {scenarios.map((s, i) => {
          const riskColor = RISK_COLOR[s.impactOnRiskLevel];
          return (
            <FadeIn key={s.id} delay={0.05 + i * 0.04}>
              <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.trigger}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{s.assumption}</p>
                    </div>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{ background: `${riskColor}1a`, color: riskColor }}
                    >
                      {RISK_GLYPH[s.impactOnRiskLevel]} {s.impactOnRiskLevel}
                    </span>
                  </div>

                  {/* Impact table */}
                  <div className="mb-3 grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Cash', value: s.impactOnCash, color: s.impactOnCash > 0 ? 'text-emerald-400' : 'text-red-400' },
                      { label: 'Revenue', value: s.impactOnRevenue, color: s.impactOnRevenue > 0 ? 'text-emerald-400' : 'text-red-400' },
                      { label: 'GST', value: s.impactOnGST, color: s.impactOnGST < 0 ? 'text-emerald-400' : 'text-red-400' },
                      { label: 'Compliance', value: s.impactOnCompliance, color: s.impactOnCompliance <= 0 ? 'text-emerald-400' : 'text-red-400' },
                    ].map((row) => (
                      <div key={row.label} className="rounded-md border border-white/[0.05] bg-white/[0.02] p-1.5 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{row.label}</p>
                        <p className={`text-[11px] font-bold ${row.color}`}>
                          {row.label === 'Compliance' ? `${row.value > 0 ? '+' : ''}${row.value}` : signedINR(row.value)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Explanation chain */}
                  <div className="mb-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
                    <p className="text-[10px] leading-relaxed text-foreground/80">
                      <span className="font-medium accent-text">Chain:</span> {s.explanation}
                    </p>
                  </div>

                  {/* Affected nodes */}
                  {s.affectedNodes.length > 0 && (
                    <div className="mb-2">
                      <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Affected nodes</p>
                      <div className="flex flex-wrap gap-1">
                        {s.affectedNodes.map((nid) => (
                          <button
                            key={nid}
                            onClick={() => onFocusNode(nid)}
                            className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[9px] text-foreground hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
                          >
                            {nid}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('oracle-ask', { detail: { prompt: `What if: ${s.trigger}? Trace the full impact chain.` } }));
                    }}
                    className="h-7 w-full border-white/10 bg-white/[0.03] text-[10px] hover:bg-white/[0.06]"
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Run this scenario in Oracle
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 10 — GRAPH API™
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiEndpoint {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  curl: string;
  url: string;
  body?: string;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/graph',
    description: 'Full Business Graph state — all modules in one response',
    curl: 'curl -X GET /api/graph',
    url: '/api/graph',
  },
  {
    method: 'GET',
    path: '/api/graph/client/:id',
    description: 'Client subgraph (2-hop BFS) + risk + chain + insights',
    curl: "curl -X GET /api/graph/client/<clientId>",
    url: '/api/graph/client/firm',
  },
  {
    method: 'GET',
    path: '/api/graph/business/:id',
    description: 'Business subgraph + top dependencies + risk nodes',
    curl: "curl -X GET /api/graph/business/<businessId>",
    url: '/api/graph/business/firm',
  },
  {
    method: 'GET',
    path: '/api/graph/risk',
    description: 'Risk graph — top risks, distribution, categories',
    curl: 'curl -X GET /api/graph/risk',
    url: '/api/graph/risk',
  },
  {
    method: 'POST',
    path: '/api/graph/query',
    description: 'Natural-language graph query — returns intent + answer + bullets',
    curl: "curl -X POST /api/graph/query -H 'Content-Type: application/json' -d '{\"text\":\"Why did revenue drop?\"}'",
    url: '/api/graph/query',
    body: JSON.stringify({ text: 'Why did revenue drop?' }),
  },
];

function GraphApiModule() {
  const [results, setResults] = useState<Record<string, { loading: boolean; data: unknown; error?: string }>>({});

  const tryIt = useCallback(async (ep: ApiEndpoint) => {
    setResults((prev) => ({ ...prev, [ep.path]: { loading: true, data: null } }));
    try {
      const res = ep.method === 'POST'
        ? await fetch(ep.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: ep.body,
            cache: 'no-store',
          })
        : await fetch(ep.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResults((prev) => ({ ...prev, [ep.path]: { loading: false, data: json } }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [ep.path]: { loading: false, data: null, error: e instanceof Error ? e.message : 'Unknown error' },
      }));
    }
  }, []);

  return (
    <div>
      <SectionHeader
        icon={Database}
        title="Graph API"
        subtitle="5 endpoints — the entire Business Graph exposed as JSON"
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {API_ENDPOINTS.map((ep, i) => {
          const r = results[ep.path];
          return (
            <FadeIn key={ep.path} delay={0.05 + i * 0.04}>
              <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold ${
                            ep.method === 'GET'
                              ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
                              : 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300'
                          }`}
                        >
                          {ep.method}
                        </Badge>
                        <code className="text-xs font-semibold text-foreground">{ep.path}</code>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">{ep.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => tryIt(ep)}
                      disabled={r?.loading}
                      className="h-7 shrink-0 border-white/10 bg-white/[0.03] text-[10px] hover:bg-white/[0.06]"
                    >
                      {r?.loading ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
                      Try it
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-white/[0.05] bg-black/40 p-2 text-[10px] leading-relaxed text-emerald-300/90 custom-scrollbar">
                    <code>{ep.curl}</code>
                  </pre>
                  {r?.data ? (
                    <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/[0.05] bg-black/40 p-2 text-[9px] leading-relaxed text-cyan-200/90 custom-scrollbar">
                      <code>{JSON.stringify(r.data, null, 2)}</code>
                    </pre>
                  ) : null}
                  {r?.error && (
                    <p className="mt-2 text-[10px] text-red-400">Error: {r.error}</p>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — KNOWLEDGE GRAPH ENGINE™ (stats footer)
// ═══════════════════════════════════════════════════════════════════════════════

function KnowledgeGraphStatsFooter({ state }: { state: GraphState }) {
  const kg = state.knowledgeGraph;
  return (
    <div>
      <SectionHeader
        icon={Layers}
        title="Knowledge Graph Engine — Stats"
        subtitle="The graph substrate powering every other module"
      />
      <FadeIn delay={0.05}>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Nodes</p>
                <p className="text-2xl font-bold text-foreground">{kg.nodes.length}</p>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Edges</p>
                <p className="text-2xl font-bold text-foreground">{kg.edges.length}</p>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Clients</p>
                <p className="text-2xl font-bold text-foreground">{state.clientCount}</p>
              </div>
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoices</p>
                <p className="text-2xl font-bold text-foreground">{state.invoiceCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Node count by type */}
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Node count by type</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {ALL_NODE_TYPES.map((t) => {
                    const count = kg.nodeCountByType[t] || 0;
                    return (
                      <div key={t} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
                        <span className="flex items-center gap-1.5 text-[10px] text-foreground">
                          <span>{NODE_LABELS[t].emoji}</span>
                          <span>{NODE_LABELS[t].label}</span>
                        </span>
                        <span className="text-xs font-bold text-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Edge count by type */}
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Edge count by type</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(EDGE_COLORS) as RelationshipType[]).map((t) => {
                    const count = kg.edgeCountByType[t] || 0;
                    return (
                      <div key={t} className="flex items-center justify-between rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
                        <span className="flex items-center gap-1.5 text-[10px] text-foreground">
                          <span className="inline-block h-1 w-3" style={{ background: EDGE_COLORS[t] }} />
                          <span>{EDGE_LABELS[t]}</span>
                        </span>
                        <span className="text-xs font-bold text-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function GraphSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-[480px] w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function BusinessGraphPage() {
  const { toast } = useToast();
  const [data, setData] = useState<GraphState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/graph', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GraphState;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Business Graph state');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 90s
    const interval = setInterval(fetchData, 90 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Focus helpers ──────────────────────────────────────────────────────────
  const focusNode = useCallback((id: string) => {
    setFocusedNodeId(id);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const focusNodes = useCallback((ids: string[]) => {
    // Focus the first available node; also surface a toast for the rest.
    if (ids.length === 0) return;
    setFocusedNodeId(ids[0]);
    if (ids.length > 1) {
      toast({
        title: 'Highlighted in explorer',
        description: `Focused ${ids[0].split(':')[0]} node + ${ids.length - 1} related nodes shown above.`,
      });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [toast]);

  if (loading) return <GraphSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <Card className="max-w-md border-white/[0.06] bg-card/60">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium text-foreground">Couldn&apos;t load the Business Graph</p>
            <p className="mt-1 text-xs text-muted-foreground">{error || 'Unknown error'}</p>
            <Button onClick={fetchData} variant="outline" className="mt-4 border-white/10 bg-white/[0.03]">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24 sm:p-6">
      {/* ═══ HEADER ═══ */}
      <FadeIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient shadow-lg shadow-emerald-500/20">
                <Network className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  VEYRO Business Graph<span className="accent-text">™</span>
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Understand Everything · Connect Everything · See Connections · Understand Causes · Predict Outcomes · Operate Intelligently.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              disabled={refreshing}
              className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('oracle-ask', { detail: { prompt: 'Walk me through my business graph — what are the key connections and risks right now?' } }))}
              className="accent-gradient text-white hover:opacity-90"
            >
              <MessageSquare className="mr-2 h-3.5 w-3.5" />
              Ask VEYRO AI
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Last updated {timeAgo(data.generatedAt)} · {data.knowledgeGraph.nodes.length} nodes · {data.knowledgeGraph.edges.length} edges ·{' '}
          {data.clientCount} clients · {data.invoiceCount} invoices · {data.hasLiveData ? 'live data' : 'limited data'}
        </p>
      </FadeIn>

      {/* ═══ MODULE 6: VISUAL GRAPH EXPLORER (HERO) ═══ */}
      <VisualGraphExplorer
        state={data}
        focusedNodeId={focusedNodeId}
        setFocusedNodeId={setFocusedNodeId}
      />

      {/* ═══ MODULE 9: GRAPH INSIGHTS ═══ */}
      <InsightsModule insights={data.insights} onFocusNode={focusNode} />

      {/* ═══ MODULE 2: CLIENT RELATIONSHIP GRAPH ═══ */}
      <RelationshipChainsModule chains={data.relationshipChains} onFocusNode={focusNode} />

      {/* ═══ MODULE 3: RISK GRAPH ═══ */}
      <RiskGraphModule riskGraph={data.riskGraph} onFocusNode={focusNode} />

      {/* ═══ MODULE 4: BUSINESS DEPENDENCY GRAPH ═══ */}
      <DependencyGraphModule answers={data.dependencyAnswers} onFocusNode={focusNode} />

      {/* ═══ MODULE 5: NL GRAPH QUERIES ═══ */}
      <NLQueryModule state={data} onFocusNode={focusNode} onFocusNodes={focusNodes} />

      {/* ═══ MODULE 7: BUSINESS MEMORY GRAPH ═══ */}
      <MemoryGraphModule memory={data.memoryGraph} />

      {/* ═══ MODULE 8: PREDICTION GRAPH ═══ */}
      <PredictionGraphModule scenarios={data.predictionGraph.scenarios} onFocusNode={focusNode} />

      {/* ═══ MODULE 10: GRAPH API ═══ */}
      <GraphApiModule />

      {/* ═══ MODULE 1: KNOWLEDGE GRAPH STATS FOOTER ═══ */}
      <KnowledgeGraphStatsFooter state={data} />

      {/* ═══ FOOTER ═══ */}
      <FadeIn delay={0.1}>
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] to-cyan-500/[0.04] p-5 text-center">
          <p className="text-sm font-medium text-foreground">
            VEYRO Business Graph<span className="accent-text">™</span> — Understand Everything. Connect Everything. See Connections. Understand Causes. Predict Outcomes. Operate Intelligently.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            Founded &amp; developed by Prince Singh
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
