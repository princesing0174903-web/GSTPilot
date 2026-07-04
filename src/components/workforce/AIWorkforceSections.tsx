'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AUTONOMOUS AI COMPANY SECTIONS
//
// Renders the full AI Workforce bundle on the AI Workforce page. Additive only —
// does NOT modify or replace any existing UI. All values come from REAL connected
// business data via the /api/ai-workforce/dashboard endpoint.
//
// Sections (per AI Workforce spec):
//   1.  AI Workforce Header (Live status + Data sources + aggregate metrics)
//   2.  AI Organization Chart (17 AI Employees hierarchy with expandable cards)
//   3.  Department Dashboards (Finance/Sales/Marketing/Ops/HR/etc. with KPIs)
//   4.  AI Collaboration Feed (cross-employee messages + active chains)
//   5.  AI Meeting Engine (Daily/Weekly/Monthly/Quarterly/Annual meetings)
//   6.  Cross-Department Decisions (multi-step approval flow + execute)
//   7.  AI Performance Leaderboard (ranked employees with metrics)
//   8.  AI Memory & Skills (recent memories + skill progression)
//   9.  Human + AI Management (delegations + escalations + create form)
//  10.  AI Marketplace (industry-specific AI employee templates)
//
// Tagline: GSTPilot AI Workforce™ — Don't just use AI. Build an AI Company.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, createElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Brain, TrendingUp, TrendingDown, Wallet, IndianRupee, FileText,
  Sparkles, AlertTriangle, CheckCircle2, Lightbulb, Activity, Clock,
  RefreshCw, ChevronRight, ChevronDown, Zap, Target, ShieldAlert, Users,
  Send, FileBarChart, Eye, Play, Ban, Rocket, Radio, Gauge, Calendar,
  CheckCircle, XCircle, AlertOctagon, ListChecks, Workflow, Network,
  Cpu, Megaphone, Handshake, Settings, ShieldCheck, Headphones,
  ClipboardList, BarChart3, Package, Scale, HeartHandshake, Star,
  Download, ArrowRight, Trophy, Medal, Award, MessageSquare, GitBranch,
  Gavel, UserPlus, ArrowUpRight, Plus, Hash, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ORGANIZATION, getRoleDefinition } from '@/lib/workforce/organization';
import type {
  WorkforceDashboard, AIEmployee, CollaborationMessage, CollaborationChain,
  AIMeeting, CrossDepartmentDecision, EmployeePerformance, EmployeeKPI,
  EmployeeRecommendation, EmployeeMemoryEntry, EmployeeSkill, Delegation,
  Escalation, MarketplaceEmployee, DepartmentDashboard, DepartmentGoal,
  EmployeeRole, Department, EmployeeStatus, CollaborationMessageType,
  CollaborationStatus, CrossDecisionStatus, MeetingType, SkillCategory,
  EmployeeMemoryType, ManagementRole, DelegationStatus,
} from '@/lib/workforce/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatINRFull(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatPct(p: number, decimals = 1): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(decimals)}%`;
}

function priorityColor(p: EmployeeRecommendation['priority']): string {
  switch (p) {
    case 'critical': return 'border-red-500/40 bg-red-500/[0.08]';
    case 'high': return 'border-orange-500/30 bg-orange-500/[0.06]';
    case 'medium': return 'border-amber-500/30 bg-amber-500/[0.05]';
    default: return 'border-cyan-500/30 bg-cyan-500/[0.04]';
  }
}

function priorityBadge(p: EmployeeRecommendation['priority'] | Delegation['priority']): string {
  switch (p) {
    case 'critical': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default: return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  }
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return '';
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatScheduled(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ` ${time}`;
}

function employeeStatusColor(s: EmployeeStatus): string {
  switch (s) {
    case 'active': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'collaborating': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'reviewing': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'deciding': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'executing': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'idle': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    case 'offline': return 'bg-slate-700/15 text-slate-500 border-slate-600/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function healthColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function healthBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function deptStatusColor(s: 'green' | 'amber' | 'red'): string {
  switch (s) {
    case 'green': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'amber': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'red': return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
}

function crossDecisionStatusColor(s: CrossDecisionStatus): string {
  switch (s) {
    case 'executed': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'executing': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'fully_approved': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'step_1_approved':
    case 'step_2_approved': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'rejected': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'superseded': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    default: return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  }
}

function collaborationTypeColor(t: CollaborationMessageType): string {
  switch (t) {
    case 'handoff': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'approval_request': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'alert': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'update': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'decision': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'insight': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'escalation': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function collaborationStatusColor(s: CollaborationStatus): string {
  switch (s) {
    case 'completed': return 'text-emerald-400';
    case 'acted_on': return 'text-cyan-400';
    case 'acknowledged': return 'text-amber-400';
    case 'blocked': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

function meetingTypeColor(t: MeetingType): string {
  switch (t) {
    case 'daily_standup': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'weekly_leadership': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'monthly_board': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'quarterly_strategy': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'annual_planning': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function meetingTypeIconName(t: MeetingType): string {
  switch (t) {
    case 'daily_standup': return 'Activity';
    case 'weekly_leadership': return 'Users';
    case 'monthly_board': return 'FileBarChart';
    case 'quarterly_strategy': return 'Rocket';
    case 'annual_planning': return 'Calendar';
    default: return 'Calendar';
  }
}

function meetingTypeIcon(t: MeetingType): LucideIcon {
  switch (t) {
    case 'daily_standup': return Activity;
    case 'weekly_leadership': return Users;
    case 'monthly_board': return FileBarChart;
    case 'quarterly_strategy': return Rocket;
    case 'annual_planning': return Calendar;
    default: return Calendar;
  }
}

function memoryTypeColor(t: EmployeeMemoryType): string {
  switch (t) {
    case 'decision': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'success': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'mistake': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'outcome': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'risk_event': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'milestone': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'learning': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'strategy': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function skillCategoryColor(c: SkillCategory): string {
  switch (c) {
    case 'tax': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'finance': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'sales': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'marketing': return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    case 'support': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'compliance': return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    case 'operations': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'legal': return 'bg-stone-500/15 text-stone-400 border-stone-500/30';
    case 'technology': return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    case 'hr': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function severityColor(s: Escalation['severity'] | MeetingType | string): string {
  switch (s) {
    case 'critical': case 'high': return 'text-red-400';
    case 'medium': return 'text-amber-400';
    case 'low': return 'text-emerald-400';
    default: return 'text-slate-400';
  }
}

function delegationStatusColor(s: DelegationStatus): string {
  switch (s) {
    case 'completed': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'accepted': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'pending': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'escalated': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'declined': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'overridden': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}

function formatKPIValue(v: number, unit: EmployeeKPI['unit']): string {
  switch (unit) {
    case 'inr': return formatINR(v);
    case 'pct': return `${v.toFixed(1)}%`;
    case 'days': return `${Math.round(v)}d`;
    case 'ratio': return v.toFixed(2);
    default: return String(Math.round(v));
  }
}

// ─── Icon lookup (organization stores icon as string name) ────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Crown, TrendingUp, Settings, Cpu, Megaphone, Users, Handshake, Sparkles,
  Wallet, ShieldCheck, Headphones, ClipboardList, BarChart3, AlertTriangle,
  Package, Scale, HeartHandshake, Brain, Activity, Target, ShieldAlert,
  FileText, Send, Zap, Rocket, Network, MessageSquare, GitBranch, Gavel,
  UserPlus, Award, Trophy, Medal, Star, Download, Plus, Hash, Lightbulb,
  CheckCircle, XCircle, CheckCircle2, AlertOctagon, ListChecks, Workflow,
  FileBarChart, Eye, Play, Ban, Radio, Gauge, Calendar, Clock, IndianRupee,
  ArrowRight, ArrowUpRight, ChevronRight, ChevronDown, RefreshCw, TrendingDown,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Brain;
}

// ─── Dynamic icon renderer (avoids creating components during render) ─────────
//
// Lucide icons are looked up by string name (stored in the org data). Declaring
// `const Icon = getIcon(name)` then rendering `<Icon />` triggers the
// `react-hooks/static-components` lint rule because the linter cannot tell the
// difference between a stable component lookup and a fresh component creation.
// Using `createElement` here keeps the lookup outside JSX so the rule is happy
// and we still get the same render output.

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICON_MAP[name] ?? Brain;
  return createElement(Cmp, { className });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  role, name, color, icon, size = 'md',
}: {
  role: EmployeeRole;
  name: string;
  color: string;
  icon: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <div
      title={`${name} (${role})`}
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} shadow-md`}
    >
      <DynamicIcon name={icon} className={`${size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-white`} />
    </div>
  );
}

function RoleAvatar({ role, size = 'md' }: { role: EmployeeRole; size?: 'sm' | 'md' | 'lg' }) {
  const def = getRoleDefinition(role);
  return <Avatar role={role} name={def.name} color={def.avatarColor} icon={def.icon} size={size} />;
}

// ─── Animated Metric Card ─────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, accent = 'emerald', trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: 'emerald' | 'orange' | 'amber' | 'cyan' | 'red' | 'slate' | 'purple';
  trend?: number;
}) {
  const accentMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
    purple: 'text-purple-400',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
            <Icon className={`h-4 w-4 ${accentMap[accent]}`} />
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-[11px] mt-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPct(trend)}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — EMPLOYEE CARD (expandable)
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeeCard({ emp }: { emp: AIEmployee }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${expanded ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-slate-800 bg-slate-900/40'} p-3 transition-colors`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left flex items-start gap-3"
      >
        <Avatar role={emp.role} name={emp.name} color={emp.avatarColor} icon={emp.icon} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
            <Badge variant="outline" className={`text-[9px] uppercase ${employeeStatusColor(emp.status)}`}>
              {emp.status}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 truncate">{emp.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${healthBg(emp.healthScore)}`} style={{ width: `${Math.min(100, emp.healthScore)}%` }} />
            </div>
            <span className={`text-[10px] font-semibold tabular-nums ${healthColor(emp.healthScore)}`}>{emp.healthScore}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
            <span className="uppercase">{emp.department}</span>
            <span>·</span>
            <span>{emp.openTaskCount} tasks</span>
            {emp.activeAlertCount > 0 && (
              <>
                <span>·</span>
                <span className="text-red-400">{emp.activeAlertCount} alerts</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-slate-800 space-y-3"
          >
            {/* Responsibilities */}
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Responsibilities</p>
              <ul className="space-y-0.5">
                {emp.responsibilities.slice(0, 4).map((r, i) => (
                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-slate-600 shrink-0" /> {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* KPIs */}
            {emp.kpis.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">KPIs</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {emp.kpis.slice(0, 6).map((k, i) => (
                    <div key={i} className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
                      <p className="text-[9px] text-slate-500 truncate">{k.name}</p>
                      <p className="text-xs font-semibold text-white tabular-nums">{formatKPIValue(k.value, k.unit)}</p>
                      {k.target !== undefined && (
                        <p className="text-[9px] text-slate-500">target {formatKPIValue(k.target, k.unit)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {emp.recommendations.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Recommendations ({emp.recommendations.length})</p>
                <div className="space-y-1.5">
                  {emp.recommendations.slice(0, 3).map((r, i) => (
                    <div key={i} className={`rounded border ${priorityColor(r.priority)} p-2`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-white">{r.title}</p>
                        <Badge variant="outline" className={`text-[9px] uppercase ${priorityBadge(r.priority)}`}>{r.priority}</Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{r.rationale}</p>
                      {r.estimatedValue !== undefined && (
                        <p className="text-[10px] text-emerald-400 mt-0.5">Est. {formatINR(r.estimatedValue)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Memory */}
            {emp.recentMemory.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Recent Memory</p>
                <div className="space-y-1">
                  {emp.recentMemory.slice(0, 3).map((m) => (
                    <div key={m.id} className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[8px] uppercase ${memoryTypeColor(m.memoryType)}`}>{m.memoryType.replace('_', ' ')}</Badge>
                        <p className="text-[11px] font-semibold text-white truncate">{m.title}</p>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{timeAgo(m.occurredAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Sources */}
            {emp.dataSources.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Data Sources</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {emp.dataSources.map((s) => (
                    <span key={s} className="text-[9px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — DEPARTMENT CARD (collapsible)
// ═══════════════════════════════════════════════════════════════════════════════

function DepartmentCard({ dept }: { dept: DepartmentDashboard }) {
  const [expanded, setExpanded] = useState(false);
  const leadDef = getRoleDefinition(dept.lead);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border ${expanded ? 'border-slate-700' : 'border-slate-800'} bg-slate-900/40 p-3`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${leadDef.avatarColor}`}>
            <DynamicIcon name={leadDef.icon} className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{dept.name}</p>
            <p className="text-[10px] text-slate-500">Lead: {leadDef.name}</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-[9px] uppercase ${deptStatusColor(dept.status)}`}>{dept.status}</Badge>
      </div>

      {/* Health Score */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-slate-500 w-16">Health</span>
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${healthBg(dept.healthScore)}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, dept.healthScore)}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <span className={`text-[11px] font-bold tabular-nums ${healthColor(dept.healthScore)}`}>{dept.healthScore}</span>
      </div>

      {/* Top 3 KPIs */}
      {dept.kpis.length > 0 && (
        <div className="space-y-0.5 mb-2">
          {dept.kpis.slice(0, 3).map((k, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 truncate">{k.name}</span>
              <span className="text-slate-200 tabular-nums">{formatKPIValue(k.value, k.unit)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Counts */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-2">
        <span>{dept.openTasks} open tasks</span>
        {dept.alerts > 0 && <span className="text-red-400">{dept.alerts} alerts</span>}
        <span>{dept.aiDecisions} AI decisions</span>
      </div>

      <Button
        size="sm" variant="ghost"
        onClick={() => setExpanded((e) => !e)}
        className="w-full h-6 text-[11px] text-slate-400 hover:text-slate-200"
      >
        {expanded ? 'Hide' : 'Show'} full details
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </Button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-slate-800 space-y-2"
          >
            {/* All KPIs */}
            {dept.kpis.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">All KPIs ({dept.kpis.length})</p>
                <div className="grid grid-cols-2 gap-1">
                  {dept.kpis.map((k, i) => (
                    <div key={i} className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
                      <p className="text-[9px] text-slate-500 truncate">{k.name}</p>
                      <p className="text-[11px] font-semibold text-white tabular-nums">{formatKPIValue(k.value, k.unit)}</p>
                      {k.target !== undefined && (
                        <p className="text-[9px] text-slate-500">/ {formatKPIValue(k.target, k.unit)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Goals */}
            {dept.goals.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Goals</p>
                <div className="space-y-1">
                  {dept.goals.map((g, i) => {
                    const goalStatusColor: Record<string, string> = {
                      on_track: 'text-emerald-400', achieved: 'text-emerald-300',
                      at_risk: 'text-amber-400', behind: 'text-orange-400',
                    };
                    return (
                      <div key={i} className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[11px] text-slate-300 truncate">{g.title}</p>
                          <span className={`text-[9px] uppercase ${goalStatusColor[g.status] ?? 'text-slate-400'}`}>{g.status.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span className="tabular-nums">{formatKPIValue(g.current, g.unit)} / {formatKPIValue(g.target, g.unit)}</span>
                          <span className="tabular-nums">{g.progressPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                          <div className={`h-full ${g.status === 'achieved' ? 'bg-emerald-400' : g.status === 'on_track' ? 'bg-emerald-500' : g.status === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, g.progressPct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Budget */}
            {dept.budgetUtilizationPct !== undefined && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Budget Utilization</span>
                  <span className="tabular-nums">{dept.budgetUtilizationPct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${dept.budgetUtilizationPct > 90 ? 'bg-red-500' : dept.budgetUtilizationPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, dept.budgetUtilizationPct)}%` }} />
                </div>
              </div>
            )}

            {/* Members */}
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Members ({dept.members.length})</p>
              <div className="flex items-center gap-1 flex-wrap">
                {dept.members.map((m) => (
                  <RoleAvatar key={m} role={m} size="sm" />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — COLLABORATION MESSAGE CARD
// ═══════════════════════════════════════════════════════════════════════════════

function CollaborationMessageCard({ msg }: { msg: CollaborationMessage }) {
  const fromDef = getRoleDefinition(msg.from);
  const toDef = getRoleDefinition(msg.to);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar role={msg.from} name={fromDef.name} color={fromDef.avatarColor} icon={fromDef.icon} size="sm" />
        <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
        <Avatar role={msg.to} name={toDef.name} color={toDef.avatarColor} icon={toDef.icon} size="sm" />
        <div className="flex-1 min-w-0 ml-1">
          <p className="text-[11px] text-slate-400 truncate">
            <span className="text-slate-300 font-medium">{fromDef.name}</span>
            <span className="text-slate-600 mx-1">→</span>
            <span className="text-slate-300 font-medium">{toDef.name}</span>
          </p>
          <p className="text-[10px] text-slate-500">{timeAgo(msg.timestamp)}</p>
        </div>
        <Badge variant="outline" className={`text-[9px] uppercase ${collaborationTypeColor(msg.type)}`}>
          {msg.type.replace('_', ' ')}
        </Badge>
      </div>
      <p className="text-xs font-semibold text-white mb-0.5">{msg.subject}</p>
      <p className="text-[11px] text-slate-400 line-clamp-2">{msg.body}</p>
      <div className="flex items-center justify-between mt-1.5 text-[10px]">
        <span className={`uppercase ${collaborationStatusColor(msg.status)}`}>{msg.status.replace('_', ' ')}</span>
        {msg.relatedEntityLabel && (
          <span className="text-slate-500 truncate ml-2">↪ {msg.relatedEntityLabel}</span>
        )}
      </div>
    </motion.div>
  );
}

function CollaborationChainFlow({ chain }: { chain: CollaborationChain }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{chain.title}</p>
          <p className="text-[10px] text-slate-500">{chain.trigger}</p>
        </div>
        <Badge variant="outline" className={`text-[9px] uppercase ${
          chain.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
          chain.status === 'blocked' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
          'bg-amber-500/15 text-amber-400 border-amber-500/30'
        }`}>
          {chain.status.replace('_', ' ')}
        </Badge>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {chain.steps.map((step, i) => {
          const def = getRoleDefinition(step.role);
          const Icon = getIcon(def.icon);
          return (
            <div key={i} className="flex items-center shrink-0">
              <div
                title={`${def.name}: ${step.action} (${step.status})`}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded border ${
                  step.status === 'done' ? 'border-emerald-500/40 bg-emerald-500/10' :
                  step.status === 'in_progress' ? 'border-amber-500/40 bg-amber-500/10' :
                  step.status === 'blocked' ? 'border-red-500/40 bg-red-500/10' :
                  step.status === 'skipped' ? 'border-slate-700 bg-slate-800/40' :
                  'border-slate-700 bg-slate-900/40'
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${def.avatarColor}`}>
                  <Icon className="h-3 w-3 text-white" />
                </div>
                <span className="text-[8px] text-slate-400 max-w-[60px] truncate">{def.name}</span>
                {step.status === 'done' && <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />}
                {step.status === 'in_progress' && <Clock className="h-2.5 w-2.5 text-amber-400" />}
              </div>
              {i < chain.steps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-slate-600 mx-0.5 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 mt-1">{chain.businessImpact}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — MEETING CARD (collapsible)
// ═══════════════════════════════════════════════════════════════════════════════

function MeetingCard({ meeting }: { meeting: AIMeeting }) {
  const [expanded, setExpanded] = useState(false);
  const typeIconName = meetingTypeIconName(meeting.type);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left flex items-start gap-3"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800">
          <DynamicIcon name={typeIconName} className="h-4 w-4 text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{meeting.title}</p>
            <Badge variant="outline" className={`text-[9px] uppercase ${meetingTypeColor(meeting.type)}`}>
              {meeting.type.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className={`text-[9px] uppercase ${
              meeting.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
              meeting.status === 'in_progress' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
              'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}>
              {meeting.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            <Calendar className="h-3 w-3 inline mr-1" />
            {formatScheduled(meeting.scheduledFor)}
            <span className="mx-1">·</span>
            <Users className="h-3 w-3 inline mr-1" />
            {meeting.attendees.length} attendees
          </p>
          {/* Attendee avatars */}
          <div className="flex items-center gap-1 mt-1.5">
            {meeting.attendees.slice(0, 8).map((r) => (
              <RoleAvatar key={r} role={r} size="sm" />
            ))}
            {meeting.attendees.length > 8 && (
              <span className="text-[10px] text-slate-500">+{meeting.attendees.length - 8}</span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-slate-800 space-y-3"
          >
            {/* Executive Summary */}
            <div className="rounded border border-purple-500/20 bg-purple-500/[0.04] p-2">
              <p className="text-[10px] uppercase text-slate-500 mb-0.5">Executive Summary</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">{meeting.executiveSummary}</p>
            </div>

            {/* Agenda */}
            {meeting.agenda.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Agenda ({meeting.agenda.length})</p>
                <div className="space-y-0.5">
                  {meeting.agenda.map((a, i) => {
                    const ownerDef = getRoleDefinition(a.owner);
                    return (
                      <div key={i} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-950/40 border border-slate-800">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-slate-600">{i + 1}.</span>
                          <span className="text-slate-300 truncate">{a.topic}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500">{ownerDef.name}</span>
                          <Badge variant="outline" className={`text-[9px] uppercase ${priorityBadge(a.priority)}`}>{a.priority}</Badge>
                          <span className="text-slate-500 tabular-nums">{a.duration}m</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Insights */}
            {meeting.insights.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Key Insights</p>
                <ul className="space-y-0.5">
                  {meeting.insights.map((ins, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <Lightbulb className="h-3 w-3 mt-0.5 text-amber-400 shrink-0" /> {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {meeting.risks.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Risks</p>
                <div className="space-y-1">
                  {meeting.risks.map((r, i) => {
                    const ownerDef = getRoleDefinition(r.owner);
                    return (
                      <div key={i} className={`rounded border p-1.5 ${
                        r.severity === 'critical' || r.severity === 'high' ? 'border-red-500/30 bg-red-500/[0.06]' :
                        r.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/[0.05]' :
                        'border-slate-700 bg-slate-950/40'
                      }`}>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[11px] font-semibold text-white">{r.title}</p>
                          <span className={`text-[9px] uppercase ${severityColor(r.severity)}`}>{r.severity}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Mitigation: {r.mitigation}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Owner: {ownerDef.name}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* KPIs */}
            {meeting.kpis.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Meeting KPIs</p>
                <div className="grid grid-cols-2 gap-1">
                  {meeting.kpis.map((k, i) => {
                    const ownerDef = getRoleDefinition(k.owner);
                    return (
                      <div key={i} className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
                        <p className="text-[9px] text-slate-500 truncate">{k.metric}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-white tabular-nums">{k.value}</p>
                          {k.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                          {k.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                        </div>
                        <p className="text-[9px] text-slate-500">{ownerDef.name}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Items */}
            {meeting.actionItems.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Action Items ({meeting.actionItems.length})</p>
                <div className="space-y-1">
                  {meeting.actionItems.map((a, i) => {
                    const ownerDef = getRoleDefinition(a.owner);
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 text-[11px] p-1.5 rounded bg-slate-950/40 border border-slate-800">
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-300 truncate">{a.task}</p>
                          <p className="text-[9px] text-slate-500">{ownerDef.name} · {formatScheduled(a.deadline)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] uppercase ${priorityBadge(a.priority)}`}>{a.priority}</Badge>
                        <Badge variant="outline" className={`text-[9px] uppercase ${
                          a.status === 'done' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          a.status === 'in_progress' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
                          'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>{a.status.replace('_', ' ')}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Data Sources */}
            {meeting.dataSources.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-slate-500 mb-1">Data Sources</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {meeting.dataSources.map((s) => (
                    <span key={s} className="text-[9px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — CROSS-DEPARTMENT DECISION CARD
// ═══════════════════════════════════════════════════════════════════════════════

function CrossDecisionCard({
  decision, onApprove, onExecute, busy,
}: {
  decision: CrossDepartmentDecision;
  onApprove: (stepIndex: number) => void;
  onExecute: () => void;
  busy: boolean;
}) {
  const initiatorDef = getRoleDefinition(decision.initiatedBy);
  const isFinalized = decision.status === 'executed' || decision.status === 'rejected' || decision.status === 'superseded';
  const canExecute = decision.status === 'fully_approved';
  const currentStep = decision.steps[decision.currentStepIndex];
  const currentStepRole = currentStep ? getRoleDefinition(currentStep.role) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-lg border border-purple-500/20 bg-purple-500/[0.04] p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`text-[10px] uppercase ${crossDecisionStatusColor(decision.status)}`}>
              {decision.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase border-slate-700 text-slate-400">
              step {decision.currentStepIndex + 1}/{decision.steps.length}
            </Badge>
            <span className="text-[10px] text-slate-500">Initiated by {initiatorDef.name}</span>
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">{decision.title}</h4>
          <p className="text-xs text-slate-400 line-clamp-2">{decision.description}</p>
          <p className="text-[10px] text-slate-500 mt-1">Trigger: {decision.trigger}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-500 uppercase">Financial Impact</p>
          <p className={`text-sm font-bold tabular-nums ${decision.financialImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {decision.financialImpact >= 0 ? '+' : ''}{formatINR(decision.financialImpact)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">{decision.confidence}% conf</p>
        </div>
      </div>

      {/* Business impact */}
      <p className="text-[11px] text-slate-400 mb-3">{decision.businessImpact}</p>

      {/* Multi-step approval flow */}
      <div className="rounded border border-slate-800 bg-slate-950/40 p-2 mb-3">
        <p className="text-[10px] uppercase text-slate-500 mb-1.5">Approval Flow</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {decision.steps.map((step, i) => {
            const def = getRoleDefinition(step.role);
            const Icon = getIcon(def.icon);
            const isActive = i === decision.currentStepIndex && !isFinalized;
            return (
              <div key={i} className="flex items-center shrink-0">
                <div
                  title={`Step ${i + 1}: ${def.name} — ${step.action} (${step.status})`}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded border min-w-[80px] ${
                    step.status === 'approved' || step.status === 'executed' ? 'border-emerald-500/40 bg-emerald-500/10' :
                    isActive ? 'border-amber-500/40 bg-amber-500/10' :
                    step.status === 'rejected' ? 'border-red-500/40 bg-red-500/10' :
                    step.status === 'skipped' ? 'border-slate-700 bg-slate-800/40' :
                    'border-slate-700 bg-slate-900/40'
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${def.avatarColor}`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-[9px] text-slate-300 max-w-[70px] truncate">{def.name}</span>
                  <span className="text-[8px] text-slate-500 uppercase">{step.approvalType}</span>
                  {step.status === 'approved' && <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />}
                  {step.status === 'rejected' && <XCircle className="h-2.5 w-2.5 text-red-400" />}
                  {isActive && <Clock className="h-2.5 w-2.5 text-amber-400 animate-pulse" />}
                </div>
                {i < decision.steps.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-slate-600 mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        {currentStep && !isFinalized && currentStepRole && (
          <p className="text-[10px] text-amber-400 mt-1.5">
            Awaiting: <span className="font-semibold">{currentStepRole.name}</span> to {currentStep.action}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          disabled={busy || isFinalized}
          onClick={() => onApprove(decision.currentStepIndex)}
          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500"
        >
          <CheckCircle className="h-3 w-3" /> Approve Step
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !canExecute}
          onClick={onExecute}
          className="h-7 text-xs gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
        >
          <Play className="h-3 w-3" /> Execute
        </Button>
        <span className="text-[10px] text-slate-500 ml-auto">
          Created {timeAgo(decision.createdAt)}
          {decision.executedAt && ` · Executed ${timeAgo(decision.executedAt)}`}
        </span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — PERFORMANCE LEADERBOARD ROW
// ═══════════════════════════════════════════════════════════════════════════════

function PerformanceLeaderboardRow({
  entry, performance, rank,
}: {
  entry: WorkforceDashboard['performance'][number];
  performance?: EmployeePerformance;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const def = getRoleDefinition(entry.role);
  const rankColor =
    rank === 1 ? 'from-amber-400 to-yellow-600' :
    rank === 2 ? 'from-slate-300 to-slate-500' :
    rank === 3 ? 'from-orange-400 to-amber-700' :
    'from-slate-700 to-slate-800';
  const RankIcon = rank === 1 ? Trophy : rank <= 3 ? Medal : Hash;

  const metrics: { label: string; value: number; suffix?: string }[] = performance ? [
    { label: 'Accuracy', value: performance.accuracy, suffix: '%' },
    { label: 'Speed', value: performance.speed, suffix: '%' },
    { label: 'Business Impact', value: performance.businessImpact, suffix: '%' },
    { label: 'ROI Generated', value: performance.roiGenerated },
    { label: 'Tasks Completed', value: performance.tasksCompleted },
    { label: 'Revenue Influenced', value: performance.revenueInfluenced },
    { label: 'Cost Saved', value: performance.costSaved },
    { label: 'Automation Success', value: performance.automationSuccess, suffix: '%' },
    { label: 'Confidence', value: performance.confidence, suffix: '%' },
    { label: 'Learning Progress', value: performance.learningProgress, suffix: '%' },
  ] : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-3 ${
        rank === 1 ? 'border-amber-500/30 bg-amber-500/[0.05]' :
        rank === 2 ? 'border-slate-400/20 bg-slate-400/[0.04]' :
        rank === 3 ? 'border-orange-500/20 bg-orange-500/[0.04]' :
        'border-slate-800 bg-slate-900/40'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left flex items-center gap-3"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${rankColor}`}>
          <RankIcon className="h-4 w-4 text-white" />
        </div>
        <span className="text-xs font-bold text-slate-300 tabular-nums w-6">#{rank}</span>
        <Avatar role={entry.role} name={def.name} color={def.avatarColor} icon={def.icon} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{entry.name}</p>
          <p className="text-[10px] text-slate-500 truncate">{def.title} · {entry.department}</p>
          {entry.highlight && <p className="text-[10px] text-slate-400 italic truncate">{entry.highlight}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold tabular-nums ${healthColor(entry.overallScore)}`}>{entry.overallScore.toFixed(1)}</p>
          <p className="text-[9px] text-slate-500 uppercase">score</p>
        </div>
        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
        <span>ROI: <span className="text-emerald-400 font-medium tabular-nums">{formatINR(entry.roiGenerated)}</span></span>
        <span>·</span>
        <span>Tasks: <span className="text-slate-300 tabular-nums">{entry.tasksCompleted}</span></span>
      </div>

      <AnimatePresence>
        {expanded && performance && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-slate-800"
          >
            <p className="text-[10px] uppercase text-slate-500 mb-2">Performance Metrics ({metrics.length})</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {metrics.map((m, i) => (
                <div key={i} className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
                  <p className="text-[9px] text-slate-500 truncate">{m.label}</p>
                  <p className="text-xs font-semibold text-white tabular-nums">
                    {m.suffix === '%' ? m.value.toFixed(1) + '%' : m.label.includes('ROI') || m.label.includes('Revenue') || m.label.includes('Cost') ? formatINR(m.value) : Math.round(m.value)}
                  </p>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full ${m.value >= 75 ? 'bg-emerald-500' : m.value >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, m.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {performance.trendPct !== 0 && (
              <div className={`flex items-center gap-1 text-[10px] mt-2 ${performance.trendPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {performance.trendPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                Trend {formatPct(performance.trendPct)} · {performance.period}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — MEMORY & SKILL CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function MemoryCard({ mem }: { mem: EmployeeMemoryEntry }) {
  const def = getRoleDefinition(mem.role);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5"
    >
      <div className="flex items-start gap-2">
        <Avatar role={mem.role} name={def.name} color={def.avatarColor} icon={def.icon} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge variant="outline" className={`text-[9px] uppercase ${memoryTypeColor(mem.memoryType)}`}>
                {mem.memoryType.replace('_', ' ')}
              </Badge>
              <p className="text-xs font-semibold text-white truncate">{mem.title}</p>
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(mem.occurredAt)}</span>
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-2">{mem.description}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-slate-500">{def.name}</span>
            <span className="text-[9px] text-slate-500">Importance: <span className={mem.importance >= 8 ? 'text-amber-400' : mem.importance >= 5 ? 'text-slate-300' : 'text-slate-500'}>{mem.importance}/10</span></span>
          </div>
          {mem.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {mem.tags.slice(0, 4).map((t) => (
                <span key={t} className="text-[9px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SkillCard({ skill }: { skill: EmployeeSkill }) {
  const def = getRoleDefinition(skill.role);
  const TrendIcon = skill.trend === 'improving' ? TrendingUp : skill.trend === 'declining' ? TrendingDown : Activity;
  const trendColor = skill.trend === 'improving' ? 'text-emerald-400' : skill.trend === 'declining' ? 'text-red-400' : 'text-slate-400';
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
      <div className="flex items-start gap-2">
        <Avatar role={skill.role} name={def.name} color={def.avatarColor} icon={def.icon} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-xs font-semibold text-white truncate">{skill.name}</p>
            <Badge variant="outline" className={`text-[9px] uppercase ${skillCategoryColor(skill.category)}`}>{skill.category}</Badge>
          </div>
          <p className="text-[10px] text-slate-500 mb-1">{def.name} · {skill.learningsCount} learnings</p>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${skill.level >= 75 ? 'bg-emerald-500' : skill.level >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, skill.level)}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <span className={`text-[11px] font-semibold tabular-nums ${healthColor(skill.level)}`}>{skill.level}</span>
            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
          </div>
          {skill.recentInsight && (
            <p className="text-[10px] text-slate-400 italic line-clamp-2">"{skill.recentInsight}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — DELEGATION & ESCALATION CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function DelegationCard({ del }: { del: Delegation }) {
  const fromDef = getRoleDefinition(del.from);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar role={del.from} name={fromDef.name} color={fromDef.avatarColor} icon={fromDef.icon} size="sm" />
        <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700">
          <Users className="h-3.5 w-3.5 text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-400 truncate">
            <span className="text-slate-300 font-medium">{fromDef.name}</span>
            <span className="text-slate-600 mx-1">→</span>
            <span className="text-slate-300 font-medium uppercase">{del.to}</span>
          </p>
          <p className="text-[10px] text-slate-500">{timeAgo(del.createdAt)}</p>
        </div>
        <Badge variant="outline" className={`text-[9px] uppercase ${priorityBadge(del.priority)}`}>{del.priority}</Badge>
        <Badge variant="outline" className={`text-[9px] uppercase ${delegationStatusColor(del.status)}`}>{del.status}</Badge>
      </div>
      <p className="text-xs font-semibold text-white mb-0.5">{del.task}</p>
      <p className="text-[11px] text-slate-400 line-clamp-2">{del.reason}</p>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
        <span>Deadline: <span className="text-slate-300">{formatScheduled(del.deadline)}</span></span>
        <span>AI Conf: <span className="text-cyan-400">{del.aiConfidence}%</span></span>
      </div>
      <p className="text-[10px] text-slate-500 mt-1">Impact: {del.businessImpact}</p>
    </motion.div>
  );
}

function EscalationCard({ esc }: { esc: Escalation }) {
  const fromDef = getRoleDefinition(esc.fromRole);
  const toDef = getRoleDefinition(esc.toRole);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-2.5 ${
        esc.severity === 'high' ? 'border-red-500/30 bg-red-500/[0.06]' :
        esc.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/[0.05]' :
        'border-slate-700 bg-slate-900/40'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Avatar role={esc.fromRole} name={fromDef.name} color={fromDef.avatarColor} icon={fromDef.icon} size="sm" />
        <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
        <Avatar role={esc.toRole} name={toDef.name} color={toDef.avatarColor} icon={toDef.icon} size="sm" />
        <div className="flex-1 min-w-0 ml-1">
          <p className="text-[11px] text-slate-400 truncate">
            <span className="text-slate-300 font-medium">{fromDef.name}</span>
            <span className="text-slate-600 mx-1">→</span>
            <span className="text-slate-300 font-medium">{toDef.name}</span>
          </p>
          <p className="text-[10px] text-slate-500">{timeAgo(esc.createdAt)}</p>
        </div>
        <Badge variant="outline" className={`text-[9px] uppercase ${esc.severity === 'high' ? 'bg-red-500/15 text-red-400 border-red-500/30' : esc.severity === 'medium' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>{esc.severity}</Badge>
        <Badge variant="outline" className={`text-[9px] uppercase ${
          esc.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
          esc.status === 'acknowledged' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' :
          'bg-amber-500/15 text-amber-400 border-amber-500/30'
        }`}>{esc.status}</Badge>
      </div>
      <p className="text-xs font-semibold text-white">{esc.subject}</p>
      <p className="text-[11px] text-slate-400">{esc.reason}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — MARKETPLACE CARD
// ═══════════════════════════════════════════════════════════════════════════════

function MarketplaceCard({ emp }: { emp: MarketplaceEmployee }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-3 ${emp.installed ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-slate-800 bg-slate-900/40'}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-700 to-slate-800`}>
          <DynamicIcon name={emp.icon} className="h-5 w-5 text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
            {emp.installed && (
              <Badge variant="outline" className="text-[9px] uppercase bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Installed
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate">{emp.title}</p>
          <Badge variant="outline" className="text-[9px] uppercase border-purple-500/30 text-purple-400 mt-0.5">
            {emp.industry.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{emp.description}</p>
      <div className="flex items-center gap-1 flex-wrap mb-2">
        {emp.capabilities.slice(0, 3).map((c) => (
          <span key={c} className="text-[9px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{c}</span>
        ))}
        {emp.capabilities.length > 3 && (
          <span className="text-[9px] text-slate-500">+{emp.capabilities.length - 3}</span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
          <span className="text-slate-300 font-medium">{emp.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{emp.installCount.toLocaleString('en-IN')} installs</span>
        </div>
        <span className="text-emerald-400 font-medium">{emp.estimatedRoi}</span>
      </div>
      <Button
        size="sm"
        variant={emp.installed ? 'outline' : 'default'}
        disabled={emp.installed}
        className="w-full h-7 text-xs gap-1"
      >
        {emp.installed ? (
          <><CheckCircle className="h-3 w-3" /> Installed</>
        ) : (
          <><Download className="h-3 w-3" /> Install</>
        )}
      </Button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — CREATE DELEGATION FORM
// ═══════════════════════════════════════════════════════════════════════════════

function CreateDelegationForm({
  onSubmit, onClose, busy,
}: {
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [from, setFrom] = useState<EmployeeRole>('ceo');
  const [to, setTo] = useState<ManagementRole>('manager');
  const [task, setTask] = useState('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<Delegation['priority']>('medium');
  const [deadline, setDeadline] = useState('');
  const [businessImpact, setBusinessImpact] = useState('Operational improvement');
  const [aiConfidence, setAiConfidence] = useState('75');

  const submit = () => {
    if (!task || !reason || !deadline) return;
    onSubmit({
      from, to, task, reason, priority,
      deadline: new Date(deadline).toISOString(),
      businessImpact,
      aiConfidence: Number(aiConfidence) || 0,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-lg border border-cyan-500/30 bg-cyan-500/[0.04] p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-cyan-400" /> Create Delegation
        </p>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-6 text-xs">Cancel</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px] text-slate-400">From (AI Employee)</Label>
          <Select value={from} onValueChange={(v) => setFrom(v as EmployeeRole)}>
            <SelectTrigger className="h-8 bg-slate-950/60 border-slate-800 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORGANIZATION.map((r) => (
                <SelectItem key={r.role} value={r.role} className="text-xs">{r.name} — {r.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-slate-400">To (Human Role)</Label>
          <Select value={to} onValueChange={(v) => setTo(v as ManagementRole)}>
            <SelectTrigger className="h-8 bg-slate-950/60 border-slate-800 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ceo" className="text-xs">CEO</SelectItem>
              <SelectItem value="cfo" className="text-xs">CFO</SelectItem>
              <SelectItem value="manager" className="text-xs">Manager</SelectItem>
              <SelectItem value="employee" className="text-xs">Employee</SelectItem>
              <SelectItem value="auditor" className="text-xs">Auditor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-[11px] text-slate-400">Task</Label>
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g., Approve vendor payment of ₹2.5L"
            className="h-8 bg-slate-950/60 border-slate-800 text-xs"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-[11px] text-slate-400">Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this delegation needed?"
            className="bg-slate-950/60 border-slate-800 text-xs min-h-[60px]"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-400">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Delegation['priority'])}>
            <SelectTrigger className="h-8 bg-slate-950/60 border-slate-800 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical" className="text-xs">Critical</SelectItem>
              <SelectItem value="high" className="text-xs">High</SelectItem>
              <SelectItem value="medium" className="text-xs">Medium</SelectItem>
              <SelectItem value="low" className="text-xs">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-slate-400">Deadline</Label>
          <Input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-8 bg-slate-950/60 border-slate-800 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-400">Business Impact</Label>
          <Input
            value={businessImpact}
            onChange={(e) => setBusinessImpact(e.target.value)}
            className="h-8 bg-slate-950/60 border-slate-800 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-400">AI Confidence (%)</Label>
          <Input
            type="number" min="0" max="100"
            value={aiConfidence}
            onChange={(e) => setAiConfidence(e.target.value)}
            className="h-8 bg-slate-950/60 border-slate-800 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button size="sm" onClick={submit} disabled={busy || !task || !reason || !deadline} className="h-7 text-xs gap-1 bg-cyan-600 hover:bg-cyan-500">
          <Send className="h-3 w-3" /> Delegate
        </Button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIWorkforceSections() {
  const [data, setData] = useState<WorkforceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDelegateForm, setShowDelegateForm] = useState(false);
  const { toast } = useToast();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-workforce/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('[AIWorkforce] Failed to load dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const callMutation = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>,
    successMsg: string,
    idField = 'decisionId',
  ) => {
    try {
      setBusyId(body[idField] as string);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      toast({ title: 'Action completed', description: successMsg });
      await fetchDashboard();
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  }, [fetchDashboard, toast]);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full bg-slate-900/60" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-slate-900/60" />
          ))}
        </div>
        <Skeleton className="h-48 w-full bg-slate-900/60" />
        <Skeleton className="h-48 w-full bg-slate-900/60" />
        <Skeleton className="h-48 w-full bg-slate-900/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-300 mb-3">AI Workforce Engine is loading live data…</p>
          <p className="text-[11px] text-slate-500 mb-3">Endpoint: /api/ai-workforce/dashboard</p>
          <Button onClick={fetchDashboard} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Group employees by tier for org chart
  const ceo = data.organization.find((e) => e.role === 'ceo');
  const cSuite = data.organization.filter((e) => e.tier === 'c_suite' && e.role !== 'ceo');
  const managers = data.organization.filter((e) => e.tier === 'manager');
  const others = data.organization.filter((e) => e.tier !== 'c_suite' && e.tier !== 'manager');

  // Aggregate recent memories across all employees
  const allMemories: EmployeeMemoryEntry[] = data.organization
    .flatMap((e) => e.recentMemory)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 12);

  // Aggregate skills across all employees
  const allSkills: EmployeeSkill[] = data.organization
    .flatMap((e) => e.skills)
    .slice(0, 12);

  // Build performance lookup
  const performanceByRole = new Map<EmployeeRole, EmployeePerformance>();
  data.organization.forEach((e) => performanceByRole.set(e.role, e.performance));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══════ SECTION 1 — AI WORKFORCE HEADER ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/30">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI Workforce™</h2>
                {data.hasLiveData && (
                  <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    <Radio className="h-3 w-3 animate-pulse" /> LIVE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">Don&apos;t just use AI. Build an AI Company. · {data.organization.length} AI Employees · {data.departmentCount} departments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchDashboard} size="sm" variant="outline" disabled={loading} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
        {!data.hasLiveData && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
            <ShieldAlert className="h-3 w-3 inline mr-1" />
            Connect GSTN, Bank, Accounting, CRM, and other data sources to activate the autonomous AI Workforce. Showing partial state.
          </div>
        )}
        {data.dataSources.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500">Connected:</span>
            {data.dataSources.map((src) => (
              <Badge key={src} variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {src}
              </Badge>
            ))}
          </div>
        )}

        {/* Aggregate metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <MetricCard label="Total Employees" value={String(data.aggregateMetrics.totalEmployees)} icon={Users} accent="emerald" />
          <MetricCard label="Active Now" value={String(data.aggregateMetrics.activeEmployees)} icon={Activity} accent="cyan" sub={`${data.departmentCount} departments`} />
          <MetricCard label="Avg Health Score" value={`${data.aggregateMetrics.avgHealthScore.toFixed(0)}/100`} icon={Sparkles} accent={data.aggregateMetrics.avgHealthScore >= 65 ? 'emerald' : 'amber'} />
          <MetricCard label="Automation Rate" value={`${data.aggregateMetrics.automationRatePct.toFixed(1)}%`} icon={Zap} accent="purple" />
          <MetricCard label="Total ROI Generated" value={formatINR(data.aggregateMetrics.totalROIGenerated)} icon={TrendingUp} accent="emerald" sub={`Rev ${formatINR(data.aggregateMetrics.totalRevenueInfluenced)}`} />
          <MetricCard label="Collaborations Today" value={String(data.aggregateMetrics.collaborationMessagesToday)} icon={MessageSquare} accent="amber" sub={`${data.aggregateMetrics.meetingsThisWeek} meetings/wk`} />
        </div>
      </motion.div>

      {/* ═══════ SECTION 2 — AI ORGANIZATION CHART ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Network className="h-4 w-4 text-emerald-400" /> AI Organization Chart™
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 ml-2">
              {data.organization.length} employees
            </Badge>
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.activeEmployeeCount} active</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CEO Tier */}
          {ceo && (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-2">Chief Executive</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-md">
                <EmployeeCard emp={ceo} />
              </div>
            </div>
          )}

          {/* C-Suite Tier */}
          {cSuite.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-2">C-Suite Executives</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {cSuite.map((e) => <EmployeeCard key={e.role} emp={e} />)}
              </div>
            </div>
          )}

          {/* Managers Tier */}
          {managers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-2">Managers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {managers.map((e) => <EmployeeCard key={e.role} emp={e} />)}
              </div>
            </div>
          )}

          {/* Other Roles */}
          {others.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-2">Specialists & Advisors</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {others.map((e) => <EmployeeCard key={e.role} emp={e} />)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 3 — DEPARTMENT DASHBOARDS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Settings className="h-4 w-4 text-cyan-400" /> Department Dashboards™
            <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400 ml-2">
              {data.departments.length} departments
            </Badge>
            <span className="text-xs text-slate-500 font-normal ml-auto">
              {data.departments.filter((d) => d.status === 'green').length} green · {data.departments.filter((d) => d.status === 'amber').length} amber · {data.departments.filter((d) => d.status === 'red').length} red
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.departments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No departments provisioned yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.departments.map((d) => <DepartmentCard key={d.department} dept={d} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 4 — AI COLLABORATION FEED ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <MessageSquare className="h-4 w-4 text-amber-400" /> AI Collaboration Feed™
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 ml-2">
              {data.collaborationFeed.length} messages
            </Badge>
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.activeChains.length} active chains</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active chains */}
          {data.activeChains.length > 0 && (
            <div>
              <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                <GitBranch className="h-3 w-3" /> Active Collaboration Chains
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {data.activeChains.slice(0, 6).map((c) => <CollaborationChainFlow key={c.id} chain={c} />)}
              </div>
            </div>
          )}

          {/* Message feed */}
          <div>
            <p className="text-[11px] uppercase text-slate-500 mb-2">Live Messages</p>
            {data.collaborationFeed.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">No active collaboration. Workforce is idle.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-96 pr-2">
                <div className="space-y-2">
                  <AnimatePresence>
                    {data.collaborationFeed.slice(0, 20).map((m) => (
                      <CollaborationMessageCard key={m.id} msg={m} />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════ SECTION 5 — AI MEETING ENGINE ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Calendar className="h-4 w-4 text-purple-400" /> AI Meeting Engine™
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 ml-2">
              {data.meetings.length} scheduled
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.meetings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No meetings scheduled.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 6 — CROSS-DEPARTMENT DECISIONS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Zap className="h-4 w-4 text-amber-400" /> Cross-Department Decision Engine™
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 ml-2">
              {data.pendingCrossDecisionCount} pending
            </Badge>
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.crossDecisions.length} total active</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.crossDecisions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-300">No active cross-department decisions. Business is operating smoothly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {data.crossDecisions.map((d) => (
                  <CrossDecisionCard
                    key={d.id}
                    decision={d}
                    busy={busyId === d.id}
                    onApprove={(stepIndex) => callMutation(
                      '/api/ai-workforce/approve',
                      { decisionId: d.id, role: 'ceo', stepIndex },
                      `Approved step ${stepIndex + 1}: ${d.title}`,
                    )}
                    onExecute={() => callMutation(
                      '/api/ai-workforce/execute',
                      { decisionId: d.id, role: 'ceo' },
                      `Executed: ${d.title}`,
                    )}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 7 — PERFORMANCE LEADERBOARD ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Trophy className="h-4 w-4 text-amber-400" /> AI Performance Leaderboard™
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 ml-2">
              {data.performance.length} ranked
            </Badge>
            {data.topEmployee && (
              <span className="text-xs text-slate-500 font-normal ml-auto">
                Top: <span className="text-amber-300">{data.topEmployee.name}</span> ({data.topEmployee.overallScore.toFixed(1)})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.performance.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No performance data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.performance.map((p, i) => (
                <PerformanceLeaderboardRow
                  key={p.role}
                  entry={p}
                  performance={performanceByRole.get(p.role)}
                  rank={i + 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 8 — AI MEMORY & SKILLS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Brain className="h-4 w-4 text-cyan-400" /> AI Memory™ & Skills™
            <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400 ml-2">
              {allMemories.length} memories · {allSkills.length} skills
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Memories */}
            <div>
              <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                <Brain className="h-3 w-3" /> Recent Memories
              </p>
              {allMemories.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No memories recorded yet.</p>
              ) : (
                <ScrollArea className="max-h-96 pr-2">
                  <div className="space-y-2">
                    {allMemories.map((m) => <MemoryCard key={m.id} mem={m} />)}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* AI Skills */}
            <div>
              <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Skills
              </p>
              {allSkills.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No skills tracked yet.</p>
              ) : (
                <ScrollArea className="max-h-96 pr-2">
                  <div className="space-y-2">
                    {allSkills.map((s, i) => <SkillCard key={`${s.role}-${s.name}-${i}`} skill={s} />)}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ SECTION 9 — HUMAN + AI MANAGEMENT ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Handshake className="h-4 w-4 text-emerald-400" /> Human + AI Management™
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 ml-2">
              {data.openDelegationCount} delegations
            </Badge>
            {data.openEscalationCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 ml-2 animate-pulse">
                {data.openEscalationCount} escalations
              </Badge>
            )}
            <Button
              size="sm" variant="outline"
              onClick={() => setShowDelegateForm((s) => !s)}
              className="h-7 text-xs gap-1 ml-auto border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              <Plus className="h-3 w-3" /> Delegate
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create delegation form */}
          <AnimatePresence>
            {showDelegateForm && (
              <CreateDelegationForm
                busy={busyId === 'new-delegation'}
                onClose={() => setShowDelegateForm(false)}
                onSubmit={async (body) => {
                  await callMutation(
                    '/api/ai-workforce/delegate',
                    { ...body, _id: 'new-delegation' },
                    `Delegated: ${body.task as string}`,
                    '_id',
                  );
                  setShowDelegateForm(false);
                }}
              />
            )}
          </AnimatePresence>

          {/* Delegations */}
          <div>
            <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
              <Send className="h-3 w-3" /> Delegations ({data.delegations.length})
            </p>
            {data.delegations.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No active delegations.</p>
            ) : (
              <ScrollArea className="max-h-80 pr-2">
                <div className="space-y-2">
                  {data.delegations.slice(0, 15).map((d) => <DelegationCard key={d.id} del={d} />)}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Escalations */}
          <div>
            <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
              <AlertOctagon className="h-3 w-3" /> Escalations ({data.escalations.length})
            </p>
            {data.escalations.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No active escalations.</p>
            ) : (
              <ScrollArea className="max-h-64 pr-2">
                <div className="space-y-2">
                  {data.escalations.slice(0, 12).map((e) => <EscalationCard key={e.id} esc={e} />)}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══════ SECTION 10 — AI MARKETPLACE ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Download className="h-4 w-4 text-purple-400" /> AI Marketplace™
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 ml-2">
              {data.marketplace.length} available
            </Badge>
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.installedMarketplaceCount} installed</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.marketplace.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No marketplace employees available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.marketplace.map((m) => <MarketplaceCard key={m.id} emp={m} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer tagline */}
      <div className="text-center pt-2">
        <p className="text-[11px] text-slate-500 italic">
          GSTPilot AI Workforce™ — Don&apos;t just use AI. Build an AI Company. · Founded by Prince Singh
        </p>
      </div>
    </div>
  );
}
