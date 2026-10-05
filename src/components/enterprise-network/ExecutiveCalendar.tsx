'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarClock,
  AlarmClock,
  Users,
  ShieldAlert,
  FileCheck2,
  Banknote,
  CreditCard,
  Bell,
  Sparkles,
  Clock,
  MapPin,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { CALENDAR_EVENTS, type CalendarEvent } from '@/lib/enterprise/data'

// ─── type definitions ──────────────────────────────────────────────────────────
type EventType = CalendarEvent['type']

const TYPE_META: Record<
  EventType,
  { label: string; color: string; bg: string; ring: string; icon: typeof CalendarClock }
> = {
  'gst-deadline': {
    label: 'GST Deadline',
    color: '#ef4444',
    bg: 'bg-red-500/15',
    ring: 'ring-red-500/30',
    icon: AlarmClock,
  },
  meeting: {
    label: 'Meeting',
    color: '#8b5cf6',
    bg: 'bg-violet-500/15',
    ring: 'ring-violet-500/30',
    icon: Users,
  },
  approval: {
    label: 'Approval',
    color: '#f59e0b',
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-500/30',
    icon: FileCheck2,
  },
  task: {
    label: 'Task',
    color: '#2563EB',
    bg: 'bg-emerald-500/15',
    ring: 'ring-emerald-500/30',
    icon: Banknote,
  },
  payment: {
    label: 'Payment',
    color: '#3B82F6',
    bg: 'bg-cyan-500/15',
    ring: 'ring-cyan-500/30',
    icon: CreditCard,
  },
  compliance: {
    label: 'Compliance',
    color: '#f97316',
    bg: 'bg-orange-500/15',
    ring: 'ring-orange-500/30',
    icon: ShieldAlert,
  },
  'ai-reminder': {
    label: 'AI Reminder',
    color: '#a855f7',
    bg: 'bg-purple-500/15',
    ring: 'ring-purple-500/30',
    icon: Sparkles,
  },
}

const PRIORITY_META: Record<
  CalendarEvent['priority'],
  { label: string; cls: string; border: string }
> = {
  low: { label: 'Low', cls: 'text-zinc-400', border: 'border-l-zinc-500' },
  medium: { label: 'Medium', cls: 'text-cyan-300', border: 'border-l-cyan-500' },
  high: { label: 'High', cls: 'text-amber-300', border: 'border-l-amber-500' },
  critical: { label: 'Critical', cls: 'text-red-300', border: 'border-l-red-500' },
}

const FILTERS: { key: EventType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gst-deadline', label: 'GST Deadlines' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'approval', label: 'Approvals' },
  { key: 'task', label: 'Tasks' },
  { key: 'payment', label: 'Payments' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'ai-reminder', label: 'AI Reminders' },
]

const TODAY = 19
const MONTH = 'September 2024'
const DAYS_IN_MONTH = 30
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Sept 2024: Sept 1 = Sunday → no leading empty cells
// Layout: 5 rows × 7 cols = 35 cells, days 1..30 + 5 trailing empties

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const ASSIGNEE_COLORS: Record<string, string> = {
  'Priya Sharma': '#ec4899',
  'Vikram Mehta': '#8b5cf6',
  'Karthik Nair': '#f97316',
  'Deepika Rao': '#a855f7',
  'Arjun Gupta': '#64748b',
}

// ─── subcomponents ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  icon: typeof CalendarClock
  accent: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <div
          className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: `${accent}1f` }}
        >
          <Icon className="h-3 w-3" style={{ color: accent }} />
        </div>
      </div>
      <div className="mt-1.5 text-xl font-semibold text-white tabular-nums">
        {value}
      </div>
    </motion.div>
  )
}

function EventPill({ event }: { event: CalendarEvent }) {
  const meta = TYPE_META[event.type]
  const isCritical = event.priority === 'critical'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${meta.bg}`}
      style={{ color: meta.color }}
    >
      <span
        className={`h-1 w-1 flex-shrink-0 rounded-full ${isCritical ? 'animate-pulse' : ''}`}
        style={{ background: meta.color }}
      />
      <span className="truncate">{event.title}</span>
    </motion.div>
  )
}

function DayCell({
  day,
  events,
  isToday,
}: {
  day: number | null
  events: CalendarEvent[]
  isToday: boolean
}) {
  if (!day) {
    return <div className="min-h-[88px] rounded-lg border border-white/[0.03] bg-transparent" />
  }
  const critical = events.some((e) => e.priority === 'critical')
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={`relative min-h-[88px] rounded-lg border p-1.5 transition-colors ${
        isToday
          ? 'border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold ${
            isToday
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'text-zinc-400'
          }`}
        >
          {day}
        </span>
        {events.length > 0 && (
          <span className="text-[9px] text-zinc-600">
            {events.length}
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5">
        {events.slice(0, 2).map((e) => (
          <EventPill key={e.id} event={e} />
        ))}
        {events.length > 2 && (
          <div className="px-1 text-[9px] text-zinc-500">
            +{events.length - 2} more
          </div>
        )}
      </div>
      {critical && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      )}
    </motion.div>
  )
}

function UpcomingEventRow({ event }: { event: CalendarEvent }) {
  const meta = TYPE_META[event.type]
  const pr = PRIORITY_META[event.priority]
  const Icon = meta.icon
  const isCritical = event.priority === 'critical'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`group flex items-start gap-3 rounded-lg border-l-2 ${pr.border} bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.04]`}
    >
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}
      >
        <Icon className="h-4 w-4" style={{ color: meta.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-xs font-medium text-white">
            {event.title}
          </span>
          {isCritical && (
            <span className="flex-shrink-0 rounded bg-red-500/15 px-1 py-0 text-[9px] font-semibold text-red-300">
              CRITICAL
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-0.5">
            <CalendarClock className="h-2.5 w-2.5" />
            Sept {event.date}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {event.time}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" />
            {event.company.replace('Aurora ', '')}
          </span>
        </div>
        {event.assignee && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Avatar className="h-4 w-4">
              <AvatarFallback
                className="text-[7px] font-semibold text-white"
                style={{
                  background: ASSIGNEE_COLORS[event.assignee] ?? '#64748b',
                }}
              >
                {initials(event.assignee)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-zinc-400">{event.assignee}</span>
            <Badge
              variant="outline"
              className="ml-auto border-white/10 bg-white/[0.03] px-1 py-0 text-[9px] text-zinc-400"
            >
              {meta.label}
            </Badge>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────
export default function ExecutiveCalendar() {
  const [activeFilter, setActiveFilter] = useState<EventType | 'all'>('all')

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return CALENDAR_EVENTS
    return CALENDAR_EVENTS.filter((e) => e.type === activeFilter)
  }, [activeFilter])

  // group events by day for the calendar grid
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (const e of filteredEvents) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [filteredEvents])

  // upcoming events sorted by date
  const upcoming = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1
      if (b.priority === 'critical' && a.priority !== 'critical') return 1
      return a.date - b.date
    })
  }, [filteredEvents])

  // stats
  const stats = useMemo(() => {
    const deadlines = CALENDAR_EVENTS.filter((e) => e.type === 'gst-deadline').length
    const critical = CALENDAR_EVENTS.filter((e) => e.priority === 'critical').length
    const meetings = CALENDAR_EVENTS.filter((e) => e.type === 'meeting').length
    const compliance = CALENDAR_EVENTS.filter((e) => e.type === 'compliance').length
    return { deadlines, critical, meetings, compliance }
  }, [])

  // build calendar grid cells
  const cells: (number | null)[] = useMemo(() => {
    // Sept 1 = Sunday → no offset
    const arr: (number | null)[] = []
    for (let d = 1; d <= DAYS_IN_MONTH; d++) arr.push(d)
    // pad to 35 cells (5 rows × 7 cols)
    while (arr.length < 35) arr.push(null)
    return arr
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Executive Calendar™
            </h2>
            <Badge className="border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-300">
              {MONTH}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Unified deadline & meeting hub
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
          >
            <Bell className="h-3.5 w-3.5" />
            Reminders
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Sync
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="GST Deadlines"
          value={stats.deadlines}
          icon={AlarmClock}
          accent="#ef4444"
        />
        <StatCard
          label="Critical Events"
          value={stats.critical}
          icon={ShieldAlert}
          accent="#f97316"
        />
        <StatCard
          label="Meetings"
          value={stats.meetings}
          icon={Users}
          accent="#8b5cf6"
        />
        <StatCard
          label="Compliance Due"
          value={stats.compliance}
          icon={FileCheck2}
          accent="#2563EB"
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="mr-1 flex items-center gap-1 text-[11px] text-zinc-500">
          <Filter className="h-3 w-3" />
          Filter:
        </div>
        {FILTERS.map((f) => {
          const active = activeFilter === f.key
          const meta = f.key !== 'all' ? TYPE_META[f.key as EventType] : null
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                active
                  ? 'border-white/20 bg-white/[0.08] text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]'
              }`}
            >
              {meta && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.color }}
                />
              )}
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Main split: Calendar grid + Upcoming sidebar */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar grid */}
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white">
                Month View · {MONTH}
              </CardTitle>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  Critical
                </span>
                <Separator orientation="vertical" className="mx-1 h-3 bg-white/10" />
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Today
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Weekday headers */}
            <div className="mb-2 grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid 5×7 */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((day, i) => (
                <DayCell
                  key={i}
                  day={day}
                  events={day ? eventsByDay.get(day) ?? [] : []}
                  isToday={day === TODAY}
                />
              ))}
            </div>

            {/* Legend */}
            <Separator className="my-3 bg-white/[0.06]" />
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const Icon = meta.icon
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 text-[10px] text-zinc-400"
                  >
                    <span
                      className="flex h-3 w-3 items-center justify-center rounded"
                      style={{ background: `${meta.color}26` }}
                    >
                      <Icon className="h-2 w-2" style={{ color: meta.color }} />
                    </span>
                    {meta.label}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming sidebar */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white">
                Upcoming Events
              </CardTitle>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-400"
              >
                {upcoming.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-[28rem]">
              <div className="space-y-2 pr-1">
                <AnimatePresence mode="popLayout">
                  {upcoming.map((e) => (
                    <UpcomingEventRow key={e.id} event={e} />
                  ))}
                </AnimatePresence>
                {upcoming.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <CalendarClock className="mb-2 h-8 w-8 text-zinc-600" />
                    <p className="text-sm text-zinc-400">No events match filter</p>
                    <p className="text-[11px] text-zinc-600">
                      Try switching to &quot;All&quot;
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator className="my-3 bg-white/[0.06]" />

            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11px] font-medium text-white">
                  AI Schedule Optimizer
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                3 high-priority deadlines cluster on Sept 19–22. Suggest moving
                the board meeting to Sept 24 to free CFO bandwidth for GST sign-offs.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/15"
              >
                Apply suggestion
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
