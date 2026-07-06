'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE NOTIFICATIONS™ — CENTRAL ALERT HUB
//
// One notification center for your entire organization. Every assignment,
// approval, AI alert, GST deadline, payment, document, risk & compliance event
// across all companies flows into a single unified inbox with smart filters,
// priority triage and per-channel preferences.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, X, AlertTriangle, Sparkles, CalendarClock,
  Wallet, FileText, ShieldAlert, ClipboardList, Filter, Settings2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  NOTIFICATIONS,
  type Notification,
} from '@/lib/enterprise/data';

// ─── Notification type metadata ───────────────────────────────────────────────
type NotifType = Notification['type'];

interface TypeMeta {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

const TYPE_META: Record<NotifType, TypeMeta> = {
  'assignment': { icon: ClipboardList, color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'Assignment' },
  'approval': { icon: CheckCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Approval' },
  'ai-alert': { icon: Sparkles, color: 'text-teal-400', bg: 'bg-teal-500/10', label: 'AI Alert' },
  'gst-deadline': { icon: CalendarClock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'GST Deadline' },
  'payment': { icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Payment' },
  'document': { icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Document' },
  'risk': { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Risk' },
  'compliance': { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Compliance' },
};

const PRIORITY_META: Record<Notification['priority'], { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40' },
  high: { label: 'High', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40' },
  medium: { label: 'Medium', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/40' },
  low: { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/40' },
};

type FilterTab = 'all' | 'unread' | 'critical' | 'ai-alert' | 'gst-deadline' | 'approval' | 'payment' | 'document' | 'risk' | 'compliance';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'critical', label: 'Critical' },
  { value: 'ai-alert', label: 'AI Alerts' },
  { value: 'gst-deadline', label: 'GST Deadlines' },
  { value: 'approval', label: 'Approvals' },
  { value: 'payment', label: 'Payments' },
  { value: 'document', label: 'Documents' },
  { value: 'risk', label: 'Risk' },
  { value: 'compliance', label: 'Compliance' },
];

const PREF_TYPES: NotifType[] = ['assignment', 'approval', 'ai-alert', 'gst-deadline', 'payment', 'document', 'risk', 'compliance'];

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

// ─── Notification Card ────────────────────────────────────────────────────────
function NotificationCard({
  n,
  readState,
  onMarkRead,
  onDismiss,
}: {
  n: Notification;
  readState: boolean;
  onMarkRead: () => void;
  onDismiss: () => void;
}) {
  const meta = TYPE_META[n.type];
  const pri = PRIORITY_META[n.priority];
  const Icon = meta.icon;
  const isUnread = !readState;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      className={`group relative rounded-xl border bg-white/[0.02] transition-colors ${
        isUnread ? 'border-l-2 border-l-emerald-500/70 border-white/[0.06] bg-white/[0.04]' : 'border-white/[0.06]'
      } ${pri.border && n.priority === 'critical' ? 'border-l-red-500/70' : ''} hover:bg-white/[0.05]`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Type icon */}
        <div className={`size-10 shrink-0 rounded-full ${meta.bg} flex items-center justify-center ring-1 ring-white/[0.06]`}>
          <Icon className={`size-4 ${meta.color}`} />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={`text-sm ${isUnread ? 'font-semibold text-white' : 'font-medium text-slate-300'}`}>
                {n.title}
              </div>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed line-clamp-2">{n.message}</p>
            </div>
            <Badge variant="outline" className={`shrink-0 ${pri.color} ${pri.bg} border-white/10`}>
              {pri.label}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <Badge variant="outline" className="border-white/10 text-slate-300 bg-white/[0.03]">
              {n.company}
            </Badge>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{n.timestamp}</span>
            <span className="text-slate-600">·</span>
            <span className={`${meta.color}`}>{meta.label}</span>

            {/* Hover actions */}
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isUnread && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onMarkRead}
                  className="h-6 px-2 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                >
                  <CheckCheck className="size-3 mr-1" />
                  Mark as read
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-6 px-2 text-[11px] text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                <X className="size-3 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Preference Toggle Row ────────────────────────────────────────────────────
function PrefRow({ type, defaultOn }: { type: NotifType; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className={`size-7 rounded-md ${meta.bg} flex items-center justify-center`}>
          <Icon className={`size-3.5 ${meta.color}`} />
        </div>
        <div>
          <div className="text-sm text-slate-200">{meta.label}</div>
          <div className="text-[11px] text-slate-500">Email · in-app · push</div>
        </div>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EnterpriseNotifications() {
  // Read/dismiss state tracked locally
  const [readMap, setReadMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATIONS.map(n => [n.id, n.read]))
  );
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const markRead = (id: string) => setReadMap(prev => ({ ...prev, [id]: true }));
  const dismiss = (id: string) => setDismissed(prev => new Set(prev).add(id));
  const markAllRead = () => {
    const next: Record<string, boolean> = {};
    NOTIFICATIONS.forEach(n => { next[n.id] = true; });
    setReadMap(next);
  };

  const liveNotifications = useMemo(
    () => NOTIFICATIONS.filter(n => !dismissed.has(n.id)),
    [dismissed]
  );

  const filtered = useMemo(() => {
    return liveNotifications.filter(n => {
      switch (activeTab) {
        case 'all': return true;
        case 'unread': return !readMap[n.id];
        case 'critical': return n.priority === 'critical';
        default: return n.type === activeTab;
      }
    });
  }, [liveNotifications, readMap, activeTab]);

  const stats = useMemo(() => {
    const live = NOTIFICATIONS.filter(n => !dismissed.has(n.id));
    return {
      unread: live.filter(n => !readMap[n.id]).length,
      critical: live.filter(n => n.priority === 'critical').length,
      ai: live.filter(n => n.type === 'ai-alert').length,
      gst: live.filter(n => n.type === 'gst-deadline').length,
      approvals: live.filter(n => n.type === 'approval').length,
    };
  }, [readMap, dismissed]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/30">
              <Bell className="size-4 text-emerald-400" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Enterprise Notifications<span className="text-emerald-400">™</span>
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Central alert hub for your entire organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={markAllRead}
            className="border-white/10 bg-white/[0.03] text-slate-200 hover:text-white hover:bg-white/[0.06]"
          >
            <CheckCheck className="size-4 mr-1.5 text-emerald-400" />
            Mark all as read
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatPill icon={Bell} label="Unread" value={stats.unread} color="bg-emerald-500/10 text-emerald-400" />
        <StatPill icon={AlertTriangle} label="Critical" value={stats.critical} color="bg-red-500/10 text-red-400" />
        <StatPill icon={Sparkles} label="AI Alerts" value={stats.ai} color="bg-teal-500/10 text-teal-400" />
        <StatPill icon={CalendarClock} label="GST Deadlines" value={stats.gst} color="bg-amber-500/10 text-amber-400" />
        <StatPill icon={CheckCheck} label="Approvals" value={stats.approvals} color="bg-cyan-500/10 text-cyan-400" />
      </div>

      {/* Main grid: list + preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Notifications list */}
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Filter className="size-4 text-emerald-400" />
                Inbox
                <Badge variant="outline" className="border-white/10 text-slate-400 bg-white/[0.03] ml-1">
                  {filtered.length}
                </Badge>
              </CardTitle>
            </div>
            {/* Filter tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)} className="mt-3">
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="bg-white/[0.02] border border-white/[0.06] h-auto p-1 inline-flex">
                  {FILTER_TABS.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 text-slate-400 data-[state=active]:shadow-none text-xs px-3"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2 custom-scroll">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                      <CheckCheck className="size-5 text-emerald-400" />
                    </div>
                    <p className="text-sm text-slate-300 font-medium">All caught up</p>
                    <p className="text-xs text-slate-500 mt-1">No notifications in this view.</p>
                  </div>
                ) : (
                  filtered.map(n => (
                    <NotificationCard
                      key={n.id}
                      n={n}
                      readState={readMap[n.id]}
                      onMarkRead={() => markRead(n.id)}
                      onDismiss={() => dismiss(n.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Preferences card */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Settings2 className="size-4 text-emerald-400" />
              Notification Preferences
            </CardTitle>
            <p className="text-xs text-slate-500">
              Choose which events trigger alerts across your enterprise
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {PREF_TYPES.map((t, idx) => (
                <PrefRow key={t} type={t} defaultOn={idx % 4 !== 3} />
              ))}
            </div>
            <Separator className="my-4 bg-white/[0.06]" />
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-medium text-emerald-300">AI Smart Triage</div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    AI Copilot auto-prioritizes alerts and suppresses duplicates based on your activity patterns.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quiet hours + digest footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <Bell className="size-4 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Quiet Hours</div>
                  <div className="text-xs text-slate-500">22:00 — 07:00 IST · Weekdays</div>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <CalendarClock className="size-4 text-teal-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Daily Digest</div>
                  <div className="text-xs text-slate-500">08:30 IST · Email summary</div>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scrollbar style */}
      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
      `}</style>
    </div>
  );
}
