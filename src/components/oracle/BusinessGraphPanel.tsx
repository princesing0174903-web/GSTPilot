'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Business Graph™ (Phase 3)
//
// Full-screen overlay that renders the entire business as a living network
// graph. Every client, invoice, payment, GST return, employee, task, document,
// bank account, notice, email and WhatsApp message is a connected node.
//
//   • Custom canvas force-directed graph (no external graph lib)
//   • Calm particle drift + softly flowing connections (Palantir-grade)
//   • Click a node → right-side detail panel with metrics + AI insight + actions
//   • AI Explain → the analyst narrates the whole graph (what/why/next)
//   • AI Q&A → ask "Why did collections drop?", "Which clients are risky?", …
//   • Business Health Engine → 6 risk metrics with live scores
//   • Real data only. Empty state → "Connect your data sources" buttons.
//
// Triggered from the OracleChat top bar via the Share2/Network icon.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2, X, Search, Crosshair, Maximize2, Minimize2, Sparkles,
  Loader2, Send, ArrowLeft, Plug, Building2, Landmark, Mail,
  Users, FileText, ShieldAlert, Activity,
  AlertTriangle, CheckCircle2, Zap, IndianRupee, Clock, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ─── Types (mirror /api/business-graph) ────────────────────────────────────────

type GraphNodeType =
  | 'business' | 'client' | 'invoice' | 'payment' | 'gst'
  | 'employee' | 'task' | 'document' | 'bank' | 'notice'
  | 'email' | 'whatsapp';

interface NodeDetail {
  kind: string;
  revenue?: number; outstanding?: number; invoiceCount?: number;
  gstStatus?: string; risk?: string; riskScore?: number;
  amount?: number; status?: string; period?: string; method?: string;
  source?: string; date?: string; overdueDays?: number;
  accountHolder?: string; bankName?: string; balance?: number;
  role?: string; department?: string; priority?: string;
  subject?: string; fromAddress?: string; fileType?: string;
  relations: Record<string, number | undefined>;
  aiInsight: string;
  recommendedActions: string[];
}

interface GraphNode {
  id: string; type: GraphNodeType; label: string; sublabel?: string;
  risk?: 'low' | 'medium' | 'high'; weight?: number; detail: NodeDetail;
}

interface GraphEdge {
  id: string; source: string; target: string; type: string;
}

interface HealthMetric {
  key: string; label: string; score: number;
  level: 'low' | 'medium' | 'high'; detail: string;
}

interface BusinessGraph {
  hasData: boolean; nodes: GraphNode[]; edges: GraphEdge[];
  health: HealthMetric[];
  stats: Record<string, number>;
  connections: { gstn: boolean; banks: boolean; gmail: boolean; drive: boolean; clients: boolean };
}

// ─── Node visual config ────────────────────────────────────────────────────────

const NODE_COLORS: Record<GraphNodeType, string> = {
  business: '#3B82F6', // emerald
  client: '#3B82F6',   // cyan
  invoice: '#F59E0B',  // amber
  payment: '#3B82F6',  // green
  employee: '#3B82F6', // emerald
  task: '#F97316',     // orange
  gst: '#EAB308',      // yellow
  document: '#9CA3AF', // gray
  bank: '#14B8A6',     // teal
  notice: '#F43F5E',   // rose
  email: '#38BDF8',    // sky
  whatsapp: '#25D366', // whatsapp green
};

const NODE_GLYPH: Record<GraphNodeType, string> = {
  business: '◆', client: '●', invoice: '▣', payment: '◉',
  employee: '▲', task: '◇', gst: '★', document: '📄',
  bank: '🏦', notice: '⚠', email: '✉', whatsapp: '💬',
};

const NODE_TYPE_LABEL: Record<GraphNodeType, string> = {
  business: 'Business', client: 'Client', invoice: 'Invoice', payment: 'Payment',
  gst: 'GST Return', employee: 'Employee', task: 'Task', document: 'Document',
  bank: 'Bank Account', notice: 'Notice', email: 'Email', whatsapp: 'WhatsApp',
};

// Node types that always show a label (others show on hover/expand)
const ALWAYS_LABEL: Set<GraphNodeType> = new Set(['business', 'client', 'employee', 'gst', 'bank']);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  const s = Math.abs(Math.round(n)).toString();
  let result = '';
  let count = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    result = s[i] + result;
    count++;
    if (count === 3 && i > 0) { result = ',' + result; count = 0; }
    else if (count > 3 && count % 2 === 1 && i > 0) { result = ',' + result; }
  }
  return '₹' + (n < 0 ? '-' : '') + result;
}

function riskColor(level: 'low' | 'medium' | 'high' | undefined): string {
  if (level === 'high') return '#F43F5E';
  if (level === 'medium') return '#EAB308';
  return '#3B82F6';
}

// ─── Simulation types ──────────────────────────────────────────────────────────

interface SimNode {
  id: string;
  type: GraphNodeType;
  label: string;
  sublabel?: string;
  risk?: 'low' | 'medium' | 'high';
  weight: number;
  x: number; y: number; vx: number; vy: number;
  phase: number; // for gentle floating oscillation
  detail: NodeDetail;
}

interface SimEdge {
  source: string; target: string; type: string;
}

// ─── Force simulation constants ────────────────────────────────────────────────
const REPULSION = 5200;
const SPRING_LENGTH = 110;
const SPRING_K = 0.018;
const CENTER_K = 0.0012;
const DAMPING = 0.84;
const MAX_VEL = 7;

interface BusinessGraphPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user clicks a "Connect" button in the empty state. */
  onOpenConnectors?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function BusinessGraphPanel({ open, onClose, onOpenConnectors }: BusinessGraphPanelProps) {
  const [graph, setGraph] = useState<BusinessGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'explain' | 'ask'>('explain');
  const [aiQuestion, setAiQuestion] = useState('');
  const [healthOpen, setHealthOpen] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<{ nodes: SimNode[]; edges: SimEdge[]; nodeMap: Map<string, SimNode> }>({
    nodes: [], edges: [], nodeMap: new Map(),
  });
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 });
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ active: boolean; moved: boolean; lastX: number; lastY: number }>({
    active: false, moved: false, lastX: 0, lastY: 0,
  });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const stateRef = useRef({ selectedId: null as string | null, hoveredId: null as string | null, search: '', expandAll: false });

  // Keep stateRef in sync so the rAF loop reads latest values without re-subscribing
  useEffect(() => { stateRef.current.selectedId = selectedId; }, [selectedId]);
  useEffect(() => { stateRef.current.hoveredId = hoveredId; }, [hoveredId]);
  useEffect(() => { stateRef.current.search = search; }, [search]);
  useEffect(() => { stateRef.current.expandAll = expandAll; }, [expandAll]);

  // ── Fetch graph when panel opens ──
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/business-graph');
      if (!res.ok) throw new Error('Failed to load');
      const data = (await res.json()) as BusinessGraph;
      setGraph(data);
      buildSimulation(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load business graph.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !graph) fetchGraph();
    if (!open) {
      // reset transient state when closing
      setSelectedId(null);
      setAiOpen(false);
      setSearch('');
    }
  }, [open, fetchGraph, graph]);

  // ── Build the simulation from graph data ──
  const buildSimulation = (data: BusinessGraph) => {
    const nodes: SimNode[] = data.nodes.map((n, i) => {
      // Place nodes on a circle around center for a calm deterministic start
      const angle = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
      const radius = n.type === 'business' ? 0 : 220 + (i % 3) * 40;
      return {
        id: n.id, type: n.type, label: n.label, sublabel: n.sublabel,
        risk: n.risk, weight: n.weight ?? 3,
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
        vx: 0, vy: 0, phase: Math.random() * Math.PI * 2,
        detail: n.detail,
      };
    });
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edges: SimEdge[] = data.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }));
    simRef.current = { nodes, edges, nodeMap };
  };

  // Whether the interactive canvas is mounted (loaded, no error, has real data).
  // Effects that touch the canvas depend on this so they re-run when the canvas
  // mounts AFTER the loading skeleton clears (the canvas isn't present during load).
  const showCanvas = !loading && !error && (graph?.hasData ?? false);

  // ── Canvas size + resize ──
  useEffect(() => {
    if (!open || !showCanvas) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [open, showCanvas]);

  // ── Main rAF render + simulation loop ──
  useEffect(() => {
    if (!open || !showCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (time: number) => {
      const { w, h, dpr } = sizeRef.current;
      const sim = simRef.current;
      const view = viewRef.current;
      const st = stateRef.current;

      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // ── Step the force simulation (a few substeps for stability) ──
      const cx = 0; const cy = 0; // world center
      for (let step = 0; step < 2; step++) {
        const ns = sim.nodes;
        // Repulsion (O(n²) — fine for ≤ ~150 nodes)
        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i]; const b = ns[j];
            let dx = b.x - a.x; let dy = b.y - a.y;
            let dist2 = dx * dx + dy * dy;
            if (dist2 < 0.01) { dist2 = 0.01; dx = 0.5; dy = 0.5; }
            const dist = Math.sqrt(dist2);
            const force = REPULSION / dist2;
            const fx = (force * dx) / dist; const fy = (force * dy) / dist;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
          }
        }
        // Springs (edges)
        for (const e of sim.edges) {
          const a = sim.nodeMap.get(e.source); const b = sim.nodeMap.get(e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x; const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = (dist - SPRING_LENGTH) * SPRING_K;
          const fx = (force * dx) / dist; const fy = (force * dy) / dist;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
        // Centering + integrate
        for (const n of ns) {
          // Business node is heavier — pulled more strongly to center
          const ck = n.type === 'business' ? CENTER_K * 6 : CENTER_K;
          n.vx += (cx - n.x) * ck;
          n.vy += (cy - n.y) * ck;
          n.vx *= DAMPING; n.vy *= DAMPING;
          // clamp velocity
          const sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
          if (sp > MAX_VEL) { n.vx = (n.vx / sp) * MAX_VEL; n.vy = (n.vy / sp) * MAX_VEL; }
          n.x += n.vx; n.y += n.vy;
        }
      }

      // ── Render ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Soft radial background glow (emerald → cyan → blue)
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, 'rgba(0, 245, 212, 0.04)');
      bgGrad.addColorStop(0.5, 'rgba(0, 184, 255, 0.02)');
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Apply pan/zoom transform (world→screen)
      ctx.save();
      ctx.translate(w / 2 + view.x, h / 2 + view.y);
      ctx.scale(view.zoom, view.zoom);

      const t = time * 0.001; // seconds
      const sel = st.selectedId ? sim.nodeMap.get(st.selectedId) : null;
      const hov = st.hoveredId ? sim.nodeMap.get(st.hoveredId) : null;
      const focus = sel || hov;
      const focusId = focus?.id ?? null;
      // Build set of nodes connected to the focus node for highlighting
      const focusNeighbors = new Set<string>();
      if (focusId) {
        focusNeighbors.add(focusId);
        for (const e of sim.edges) {
          if (e.source === focusId) focusNeighbors.add(e.target);
          if (e.target === focusId) focusNeighbors.add(e.source);
        }
      }
      // Search match set
      const q = st.search.trim().toLowerCase();
      const matchSet = new Set<string>();
      if (q) {
        for (const n of sim.nodes) {
          if (
            n.label.toLowerCase().includes(q) ||
            (n.sublabel?.toLowerCase().includes(q) ?? false) ||
            n.type.toLowerCase().includes(q) ||
            n.detail.kind.toLowerCase().includes(q)
          ) matchSet.add(n.id);
        }
      }

      // ── Edges ──
      const dashOffset = -(t * 18) % 16;
      for (const e of sim.edges) {
        const a = sim.nodeMap.get(e.source); const b = sim.nodeMap.get(e.target);
        if (!a || !b) continue;
        const aFloat = a.x + Math.sin(t * 0.6 + a.phase) * 1.2;
        const aFloatY = a.y + Math.cos(t * 0.6 + a.phase) * 1.2;
        const bFloat = b.x + Math.sin(t * 0.6 + b.phase) * 1.2;
        const bFloatY = b.y + Math.cos(t * 0.6 + b.phase) * 1.2;

        const isFocused = focusId && (e.source === focusId || e.target === focusId);
        const dimmed = (focusId && !isFocused) || (q && !(matchSet.has(e.source) || matchSet.has(e.target)));
        let alpha = 0.10;
        let width = 1;
        let color = '255,255,255';
        if (isFocused) { alpha = 0.55; width = 1.6; color = '0,245,212'; }
        if (dimmed) alpha = 0.04;

        ctx.beginPath();
        ctx.moveTo(aFloat, aFloatY);
        ctx.lineTo(bFloat, bFloatY);
        ctx.strokeStyle = `rgba(${color},${alpha})`;
        ctx.lineWidth = width / view.zoom;
        // Soft flowing dash on focused edges
        if (isFocused) {
          ctx.setLineDash([6 / view.zoom, 6 / view.zoom]);
          ctx.lineDashOffset = dashOffset / view.zoom;
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Flowing particle on focused edges
        if (isFocused) {
          const pp = ((t * 0.35) % 1);
          const px = aFloat + (bFloat - aFloat) * pp;
          const py = aFloatY + (bFloatY - aFloatY) * pp;
          ctx.beginPath();
          ctx.arc(px, py, 2.2 / view.zoom, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,245,212,0.9)';
          ctx.shadowColor = '#3B82F6';
          ctx.shadowBlur = 8 / view.zoom;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // ── Nodes ──
      for (const n of sim.nodes) {
        const fx = n.x + Math.sin(t * 0.6 + n.phase) * 1.2;
        const fy = n.y + Math.cos(t * 0.6 + n.phase) * 1.2;
        n._renderX = fx; n._renderY = fy; // cache for hit-testing
        const color = NODE_COLORS[n.type];
        const isSel = st.selectedId === n.id;
        const isHov = st.hoveredId === n.id;
        const isFocus = isSel || isHov;
        const isNeighbor = focusId ? focusNeighbors.has(n.id) : false;
        const dimmed = (focusId && !isNeighbor) || (q && !matchSet.has(n.id));
        const matched = q && matchSet.has(n.id);

        const baseR = (n.type === 'business' ? 22 : 6 + Math.min(10, n.weight * 1.2)) / Math.sqrt(view.zoom);
        let r = baseR;
        if (isFocus) r = baseR * 1.18;
        const alpha = dimmed ? 0.25 : 1;

        // Outer glow
        ctx.shadowColor = color;
        ctx.shadowBlur = (isFocus ? 22 : 12) / view.zoom;

        // Risk ring (for nodes with risk)
        if (n.risk && n.risk !== 'low') {
          ctx.beginPath();
          ctx.arc(fx, fy, r + 4 / view.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = riskColor(n.risk);
          ctx.globalAlpha = alpha * 0.6;
          ctx.lineWidth = 1.5 / view.zoom;
          ctx.stroke();
          ctx.globalAlpha = alpha;
        }

        // Node fill (radial gradient)
        const grad = ctx.createRadialGradient(fx - r * 0.3, fy - r * 0.3, 0, fx, fy, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, shade(color, -30));
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.globalAlpha = alpha;
        ctx.fill();

        // Selection ring
        if (isSel) {
          ctx.beginPath();
          ctx.arc(fx, fy, r + 6 / view.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2 / view.zoom;
          ctx.globalAlpha = 0.9;
          ctx.stroke();
        }
        // Search match ring
        if (matched) {
          ctx.beginPath();
          ctx.arc(fx, fy, r + 8 / view.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = '#EAB308';
          ctx.lineWidth = 1.5 / view.zoom;
          ctx.setLineDash([4 / view.zoom, 3 / view.zoom]);
          ctx.globalAlpha = 0.8;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Label
        const showLabel = st.expandAll || ALWAYS_LABEL.has(n.type) || isFocus || matched;
        if (showLabel && !dimmed) {
          const label = n.label;
          ctx.font = `${isFocus ? '600' : '500'} ${12 / view.zoom}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const labelY = fy + r + 6 / view.zoom;
          // background pill for readability
          const metrics = ctx.measureText(label);
          const padX = 5 / view.zoom; const padY = 2.5 / view.zoom;
          const tw = metrics.width; const th = 12 / view.zoom;
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = 'rgba(5,5,5,0.85)';
          roundRect(ctx, fx - tw / 2 - padX, labelY - padY, tw + padX * 2, th + padY * 2, 4 / view.zoom);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = isFocus ? '#3B82F6' : 'rgba(255,255,255,0.92)';
          ctx.fillText(label, fx, labelY);
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, showCanvas]);

  // ── Hit testing ──
  const nodeAt = useCallback((screenX: number, screenY: number): SimNode | null => {
    const { w, h } = sizeRef.current;
    const view = viewRef.current;
    const sim = simRef.current;
    // convert screen → world
    const wx = (screenX - w / 2 - view.x) / view.zoom;
    const wy = (screenY - h / 2 - view.y) / view.zoom;
    // search topmost (reverse order)
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const n = sim.nodes[i];
      if (n._renderX === undefined) continue;
      const r = (n.type === 'business' ? 22 : 6 + Math.min(10, n.weight * 1.2)) / Math.sqrt(view.zoom) * 1.3 + 4;
      const dx = wx - n._renderX; const dy = wy - n._renderY;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }, []);

  // ── Pointer handlers ──
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = true;
    dragRef.current.moved = false;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
      viewRef.current.x += dx;
      viewRef.current.y += dy;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    } else {
      const n = nodeAt(sx, sy);
      setHoveredId(n?.id ?? null);
      (e.target as HTMLCanvasElement).style.cursor = n ? 'pointer' : 'grab';
    }
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    if (!wasMoved) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      setSelectedId(n?.id ?? null);
    }
  };
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const view = viewRef.current;
    const delta = -e.deltaY * 0.0015;
    const newZoom = Math.max(0.35, Math.min(2.5, view.zoom * (1 + delta)));
    // zoom toward cursor
    const { w, h } = sizeRef.current;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left - w / 2;
    const cy = e.clientY - rect.top - h / 2;
    const wx = (cx - view.x) / view.zoom;
    const wy = (cy - view.y) / view.zoom;
    view.zoom = newZoom;
    view.x = cx - wx * view.zoom;
    view.y = cy - wy * view.zoom;
  };

  // ── Toolbar actions ──
  const handleCenter = () => {
    viewRef.current = { x: 0, y: 0, zoom: 1 };
    // Nudge simulation to recenter
    for (const n of simRef.current.nodes) { n.vx *= 0.3; n.vy *= 0.3; }
  };
  const handleExpand = () => setExpandAll((v) => !v);
  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  };
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── AI ──
  const runAI = useCallback(async (mode: 'explain' | 'ask', question?: string) => {
    setAiLoading(true);
    setAiMode(mode);
    setAiOpen(true);
    setAiAnswer('');
    try {
      const res = await fetch('/api/business-graph/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'ask' ? { mode, question } : { mode }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = (await res.json()) as { answer?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setAiAnswer(data.answer ?? 'No analysis generated.');
    } catch (e) {
      setAiAnswer(e instanceof Error ? e.message : 'Failed to generate analysis.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleAIExplain = () => runAI('explain');
  const handleAIAsk = () => {
    const q = aiQuestion.trim();
    if (!q) return;
    runAI('ask', q);
    setAiQuestion('');
  };

  // ── Derived: selected node + its connections ──
  const selectedNode = useMemo(() => {
    if (!graph || !selectedId) return null;
    return graph.nodes.find((n) => n.id === selectedId) ?? null;
  }, [graph, selectedId]);
  const selectedConnections = useMemo(() => {
    if (!graph || !selectedId) return [];
    return graph.edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => {
        const otherId = e.source === selectedId ? e.target : e.source;
        const other = graph.nodes.find((n) => n.id === otherId);
        return other ? { type: e.type, node: other } : null;
      })
      .filter((x): x is { type: string; node: GraphNode } => x !== null);
  }, [graph, selectedId]);

  const hasData = graph?.hasData ?? false;

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#09090B]"
        >
          {/* Ambient glow background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/4 left-1/4 h-[600px] w-[600px] rounded-full bg-[#3B82F6]/[0.06] blur-[120px]" />
            <div className="absolute -bottom-1/4 right-1/4 h-[600px] w-[600px] rounded-full bg-[#00B8FF]/[0.05] blur-[120px]" />
          </div>

          {/* ── Header ── */}
          <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.08] bg-black/30 px-4 backdrop-blur-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
              <Share2 className="h-4 w-4 accent-text" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-none">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Business Graph<span className="ml-0.5 text-[10px] font-medium text-muted-foreground">™</span>
              </h2>
              <p className="truncate text-[11px] text-muted-foreground">
                See how your business is connected.
              </p>
            </div>
            {graph && hasData && (
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[11px] font-medium text-muted-foreground">
                  {graph.nodes.length} nodes
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[11px] font-medium text-muted-foreground">
                  {graph.edges.length} links
                </Badge>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </header>

          {/* ── Toolbar ── */}
          {hasData && (
            <div className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-black/20 px-4 py-2.5 backdrop-blur-xl">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients, invoices, vendors, employees, tasks…"
                  className="h-9 border-white/[0.08] bg-white/[0.03] pl-9 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
                />
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={handleCenter} className="h-9 gap-1.5 border border-white/[0.06] bg-white/[0.02] text-[12px] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]">
                  <Crosshair className="h-3.5 w-3.5" /> Center
                </Button>
                <Button variant="ghost" size="sm" onClick={handleExpand} className={`h-9 gap-1.5 border border-white/[0.06] text-[12px] ${expandAll ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30' : 'bg-white/[0.02] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'}`}>
                  <Share2 className="h-3.5 w-3.5" /> {expandAll ? 'Collapse' : 'Expand All'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleAIExplain} disabled={aiLoading} className="h-9 gap-1.5 border border-[#3B82F6]/20 bg-[#3B82F6]/[0.08] text-[12px] text-[#3B82F6] hover:bg-[#3B82F6]/[0.14]">
                  {aiLoading && aiMode === 'explain' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI Explain
                </Button>
                <Button variant="ghost" size="icon" onClick={handleFullscreen} className="h-9 w-9 border border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]" aria-label="Fullscreen">
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

          {/* ── Body: graph canvas + overlays ── */}
          <div className="relative z-10 flex min-h-0 flex-1">
            {loading ? (
              <GraphSkeleton />
            ) : error ? (
              <GraphError message={error} onRetry={fetchGraph} />
            ) : !hasData ? (
              <EmptyGraphState connections={graph?.connections} onOpenConnectors={onOpenConnectors} />
            ) : (
              <>
                {/* Canvas */}
                <div ref={containerRef} className="relative min-w-0 flex-1">
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => { setHoveredId(null); dragRef.current.active = false; }}
                    onWheel={handleWheel}
                    className="absolute inset-0 h-full w-full touch-none"
                    style={{ cursor: 'grab' }}
                  />

                  {/* Legend — bottom-left */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="pointer-events-auto absolute bottom-4 left-4 max-w-[220px] rounded-2xl border border-white/[0.08] bg-black/40 p-3 backdrop-blur-xl"
                  >
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Legend</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {(Object.keys(NODE_COLORS) as GraphNodeType[]).map((t) => (
                        <div key={t} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: NODE_COLORS[t], boxShadow: `0 0 6px ${NODE_COLORS[t]}` }} />
                          <span className="text-[10.5px] text-muted-foreground">{NODE_TYPE_LABEL[t]}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Health Engine — bottom-right toggle card */}
                  <AnimatePresence>
                    {healthOpen && graph && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="pointer-events-auto absolute bottom-4 right-4 w-[300px] rounded-2xl border border-white/[0.08] bg-black/40 p-3.5 backdrop-blur-xl"
                      >
                        <div className="mb-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 accent-text" />
                            <span className="text-[11px] font-semibold text-foreground">Business Health Engine</span>
                          </div>
                          <button onClick={() => setHealthOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Hide health">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {graph.health.map((m) => (
                            <HealthBar key={m.key} metric={m} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!healthOpen && (
                    <button
                      onClick={() => setHealthOpen(true)}
                      className="pointer-events-auto absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground backdrop-blur-xl hover:text-foreground"
                    >
                      <Activity className="h-3.5 w-3.5 accent-text" /> Health
                    </button>
                  )}
                </div>

                {/* Right detail panel */}
                <AnimatePresence>
                  {selectedNode && (
                    <NodeDetailPanel
                      node={selectedNode}
                      connections={selectedConnections}
                      onClose={() => setSelectedId(null)}
                      onAskAI={(q) => runAI('ask', q)}
                    />
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* ── AI Panel (slide-over from right, above detail panel) ── */}
          <AnimatePresence>
            {aiOpen && (
              <AIPanel
                mode={aiMode}
                answer={aiAnswer}
                loading={aiLoading}
                question={aiQuestion}
                onQuestionChange={setAiQuestion}
                onAsk={handleAIAsk}
                onExplain={handleAIExplain}
                onClose={() => setAiOpen(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BusinessGraphPanel;

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function GraphSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 animate-ping rounded-full bg-[#3B82F6]/20" style={{ animationDuration: '2s' }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full accent-gradient-soft">
            <Share2 className="h-7 w-7 accent-text" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Building your Business Graph…</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Connecting every client, invoice, payment & relationship.</p>
        </div>
      </div>
    </div>
  );
}

function GraphError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
          <ShieldAlert className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-sm font-medium text-foreground">Couldn&apos;t load the graph</p>
        <p className="text-[12px] text-muted-foreground">{message}</p>
        <Button size="sm" onClick={onRetry} className="mt-1 gap-1.5 accent-gradient text-black hover:opacity-90">
          <Zap className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    </div>
  );
}

function EmptyGraphState({
  connections,
  onOpenConnectors,
}: {
  connections?: BusinessGraph['connections'];
  onOpenConnectors?: () => void;
}) {
  const buttons = [
    { key: 'gstn', label: 'Connect GSTN', icon: Landmark, desc: 'Pull returns, notices & taxpayer data', done: connections?.gstn },
    { key: 'banks', label: 'Connect Bank', icon: Building2, desc: 'Sync transactions & cash flow', done: connections?.banks },
    { key: 'clients', label: 'Import Clients', icon: Users, desc: 'Bring your client roster online', done: connections?.clients },
    { key: 'gmail', label: 'Connect Gmail', icon: Mail, desc: 'Parse invoices & notices from email', done: connections?.gmail },
  ];
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="flex max-w-lg flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 animate-ping rounded-full bg-[#3B82F6]/15" style={{ animationDuration: '3s' }} />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl accent-gradient-soft border border-white/[0.08]">
            <Share2 className="h-9 w-9 accent-text" />
          </div>
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          Connect your data sources to activate your <span className="accent-text">Business Graph</span>.
        </h2>
        <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
          Every client, invoice, payment, GST return, employee, task, document, bank account, notice, email and WhatsApp message will become a connected node — the brain of your company.
        </p>
        <div className="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {buttons.map((b) => (
            <button
              key={b.key}
              onClick={onOpenConnectors}
              className="group flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left transition-all hover:border-[#3B82F6]/30 hover:bg-white/[0.04]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl accent-gradient-soft">
                <b.icon className="h-4 w-4 accent-text" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-foreground">{b.label}</span>
                  {b.done && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{b.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <Button
          onClick={onOpenConnectors}
          className="mt-6 h-10 gap-2 accent-gradient px-6 text-[13px] font-semibold text-black hover:opacity-90"
        >
          <Plug className="h-4 w-4" /> Connect My Business
        </Button>
      </div>
    </div>
  );
}

function HealthBar({ metric }: { metric: HealthMetric }) {
  const color = metric.level === 'high' ? '#F43F5E' : metric.level === 'medium' ? '#EAB308' : '#3B82F6';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground/90">{metric.label}</span>
        <span className="text-[10.5px] font-semibold tabular-nums" style={{ color }}>
          {metric.score}<span className="text-muted-foreground/60">/100</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${metric.score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' as const }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground/70">{metric.detail}</p>
    </div>
  );
}

function NodeDetailPanel({
  node,
  connections,
  onClose,
  onAskAI,
}: {
  node: GraphNode;
  connections: { type: string; node: GraphNode }[];
  onClose: () => void;
  onAskAI: (q: string) => void;
}) {
  const d = node.detail;
  const color = NODE_COLORS[node.type];
  const relEntries = Object.entries(d.relations).filter(([, v]) => v && v > 0);
  return (
    <motion.div
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute right-0 top-0 bottom-0 z-30 flex w-full max-w-[360px] flex-col border-l border-white/[0.08] bg-[#0c0c0f]/95 backdrop-blur-2xl"
    >
      {/* Header */}
      <div className="flex shrink-0 items-start gap-3 border-b border-white/[0.06] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}1a`, border: `1px solid ${color}33` }}>
          <span className="text-base" style={{ color }}>{NODE_GLYPH[node.type]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>{NODE_TYPE_LABEL[node.type]}</p>
          <h3 className="mt-0.5 truncate text-[15px] font-semibold text-foreground">{node.label}</h3>
          {node.sublabel && <p className="truncate text-[11.5px] text-muted-foreground">{node.sublabel}</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            {d.revenue !== undefined && <Metric label="Revenue" value={formatINR(d.revenue)} icon={IndianRupee} />}
            {d.outstanding !== undefined && <Metric label="Outstanding" value={formatINR(d.outstanding)} icon={AlertTriangle} accent={d.outstanding > 0 ? 'warn' : undefined} />}
            {d.invoiceCount !== undefined && <Metric label="Invoices" value={String(d.invoiceCount)} icon={FileText} />}
            {d.amount !== undefined && <Metric label="Amount" value={formatINR(d.amount)} icon={IndianRupee} />}
            {d.balance !== undefined && <Metric label="Balance" value={formatINR(d.balance)} icon={Landmark} />}
            {d.gstStatus && <Metric label="GST Status" value={d.gstStatus} icon={ShieldAlert} />}
            {d.status && <Metric label="Status" value={d.status} icon={Activity} />}
            {d.period && <Metric label="Period" value={d.period} icon={Clock} />}
            {d.method && <Metric label="Method" value={d.method} icon={Zap} />}
            {d.source && <Metric label="Source" value={d.source} icon={Plug} />}
            {d.role && <Metric label="Role" value={d.role} icon={Users} />}
            {d.priority && <Metric label="Priority" value={d.priority} icon={AlertTriangle} accent={d.priority === 'high' ? 'danger' : d.priority === 'medium' ? 'warn' : undefined} />}
            {d.overdueDays !== undefined && <Metric label="Overdue" value={`${d.overdueDays}d`} icon={Clock} accent="danger" />}
            {d.date && <Metric label="Date" value={d.date} icon={Clock} />}
          </div>

          {/* Risk */}
          {node.risk && node.risk !== 'low' && (
            <div className="flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: `${riskColor(node.risk)}33`, background: `${riskColor(node.risk)}0d` }}>
              <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: riskColor(node.risk) }} />
              <p className="text-[12px] font-medium" style={{ color: riskColor(node.risk) }}>
                {node.risk === 'high' ? 'High Risk' : 'Medium Risk'}
                {d.riskScore !== undefined ? ` · Score ${d.riskScore}/100` : ''}
              </p>
            </div>
          )}

          {/* Relations */}
          {relEntries.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Related</p>
              <div className="flex flex-wrap gap-1.5">
                {relEntries.map(([k, v]) => (
                  <Badge key={k} variant="outline" className="border-white/[0.08] bg-white/[0.03] text-[11px] font-medium text-muted-foreground">
                    {v} {relationLabel(k)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI Insight */}
          <div className="rounded-2xl border border-[#3B82F6]/15 bg-[#3B82F6]/[0.04] p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 accent-text" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] accent-text">AI Insight</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-foreground/90">{d.aiInsight}</p>
          </div>

          {/* Recommended actions */}
          {d.recommendedActions.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recommended Actions</p>
              <div className="space-y-1.5">
                {d.recommendedActions.map((a, i) => (
                  <button
                    key={a}
                    onClick={() => onAskAI(`Tell me more about the ${node.label} ${a.toLowerCase()} action`)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[12.5px] font-medium text-foreground/90 transition-colors hover:border-[#3B82F6]/30 hover:bg-white/[0.04]"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md accent-gradient-soft text-[10px] font-bold accent-text">{i + 1}</span>
                    <span className="flex-1">{a}</span>
                    <ArrowLeft className="h-3 w-3 rotate-180 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connected nodes */}
          {connections.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Connections ({connections.length})
              </p>
              <div className="space-y-1.5">
                {connections.slice(0, 12).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: NODE_COLORS[c.node.type] }} />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{c.type}</span>
                    <span className="ml-auto truncate text-[12px] font-medium text-foreground/90">{c.node.label}</span>
                  </div>
                ))}
                {connections.length > 12 && (
                  <p className="text-center text-[10.5px] text-muted-foreground/60">+{connections.length - 12} more</p>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
}

function Metric({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string; icon: React.ElementType; accent?: 'warn' | 'danger';
}) {
  const color = accent === 'danger' ? '#F43F5E' : accent === 'warn' ? '#EAB308' : undefined;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="mb-0.5 flex items-center gap-1">
        <Icon className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</span>
      </div>
      <p className="truncate text-[13px] font-semibold text-foreground" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function relationLabel(key: string): string {
  const map: Record<string, string> = {
    clients: 'client', invoices: 'invoice', payments: 'payment',
    overduePayments: 'overdue', employees: 'employee', tasks: 'task',
    emails: 'email', whatsapp: 'WhatsApp', documents: 'document',
    notices: 'notice', returns: 'GST return', bankAccounts: 'bank a/c',
  };
  return map[key] ?? key;
}

function AIPanel({
  mode, answer, loading, question, onQuestionChange, onAsk, onExplain, onClose,
}: {
  mode: 'explain' | 'ask';
  answer: string;
  loading: boolean;
  question: string;
  onQuestionChange: (v: string) => void;
  onAsk: () => void;
  onExplain: () => void;
  onClose: () => void;
}) {
  const suggestions = [
    'Why did collections drop?',
    'Which clients are risky?',
    'Show payment dependencies.',
    'Who creates most revenue?',
    'Show all overdue invoices.',
    'Find cash-flow problems.',
  ];
  return (
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute right-0 top-0 bottom-0 z-40 flex w-full max-w-[420px] flex-col border-l border-white/[0.08] bg-[#0a0a0d]/97 backdrop-blur-2xl"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient-soft">
          <Brain className="h-4 w-4 accent-text" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Graph Analyst</h3>
          <p className="text-[11px] text-muted-foreground">
            {mode === 'explain' ? 'Explaining your business graph' : 'Ask anything about your graph'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {loading && !answer ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-6 w-6 animate-spin accent-text" />
              <p className="text-[12px] text-muted-foreground">Analyzing your business graph…</p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{answer}</p>
            </div>
          )}

          {/* Suggestions */}
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Try asking</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { onQuestionChange(s); }}
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-[#3B82F6]/30 hover:text-[#3B82F6]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2">
          <Input
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) onAsk(); }}
            placeholder="Ask about your graph…"
            className="h-10 border-white/[0.08] bg-white/[0.03] text-[13px] text-foreground placeholder:text-muted-foreground/60 focus-visible:border-[#3B82F6]/40 focus-visible:ring-[#3B82F6]/20"
          />
          <Button size="icon" className="h-10 w-10 shrink-0 accent-gradient text-black hover:opacity-90" onClick={onAsk} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <button
          onClick={onExplain}
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#3B82F6]/20 bg-[#3B82F6]/[0.06] py-2 text-[12px] font-medium text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/[0.12] disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Re-explain the whole graph
        </button>
      </div>
    </motion.div>
  );
}

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function shade(hex: string, amt: number): string {
  // hex like #RRGGBB → lighten/darken by amt (-255..255)
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff; let g = (n >> 8) & 0xff; let b = n & 0xff;
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
