'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, MessageSquare, Activity as ActivityIcon, Send, Hash,
  Circle, Clock, AtSign, MessageCircle, AlertTriangle, FileText,
  CreditCard, CheckCircle2, Sparkles, Zap, Wifi, Radio,
  ListTodo, ArrowRight, Inbox,
} from 'lucide-react'
import {
  TEAM_MEMBERS, ENTERPRISE_TASKS, ACTIVITY_FEED,
  CHAT_CHANNELS, CHAT_MESSAGES, fmtINR,
} from '@/lib/enterprise/data'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_META: Record<
  TeamMember['status'],
  { color: string; ring: string; label: string; dot: string; order: number }
> = {
  online:  { color: 'text-emerald-400', ring: 'ring-emerald-500/30', label: 'Online',  dot: 'bg-emerald-500', order: 0 },
  busy:    { color: 'text-rose-400',    ring: 'ring-rose-500/30',    label: 'Busy',    dot: 'bg-rose-500',    order: 1 },
  away:    { color: 'text-amber-400',   ring: 'ring-amber-500/30',   label: 'Away',    dot: 'bg-amber-500',   order: 2 },
  offline: { color: 'text-slate-500',   ring: 'ring-slate-500/20',   label: 'Offline', dot: 'bg-slate-600',   order: 3 },
}

const PRIORITY_META: Record<EnterpriseTask['priority'], { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  high:     { label: 'High',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  medium:   { label: 'Medium',   cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  low:      { label: 'Low',      cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
}

const KANBAN_COLUMNS: { id: EnterpriseTask['status']; title: string; accent: string }[] = [
  { id: 'todo',        title: 'To Do',       accent: 'border-t-slate-500' },
  { id: 'in-progress', title: 'In Progress', accent: 'border-t-cyan-500' },
  { id: 'review',      title: 'Review',      accent: 'border-t-amber-500' },
  { id: 'done',        title: 'Done',        accent: 'border-t-emerald-500' },
]

const ACTIVITY_META: Record<
  ActivityItem['type'],
  { icon: typeof AlertTriangle; color: string; border: string; bg: string }
> = {
  approval:  { icon: CheckCircle2, color: 'text-emerald-400', border: 'border-l-emerald-500', bg: 'bg-emerald-500/10' },
  comment:   { icon: MessageCircle, color: 'text-cyan-400',   border: 'border-l-cyan-500',    bg: 'bg-cyan-500/10' },
  mention:   { icon: AtSign,        color: 'text-amber-400',  border: 'border-l-amber-500',   bg: 'bg-amber-500/10' },
  filing:    { icon: FileText,      color: 'text-teal-400',   border: 'border-l-teal-500',    bg: 'bg-teal-500/10' },
  payment:   { icon: CreditCard,    color: 'text-violet-400', border: 'border-l-violet-500',  bg: 'bg-violet-500/10' },
  document:  { icon: FileText,      color: 'text-slate-400',  border: 'border-l-slate-500',   bg: 'bg-slate-500/10' },
  'ai-alert':{ icon: AlertTriangle, color: 'text-rose-400',   border: 'border-l-rose-500',    bg: 'bg-rose-500/10' },
}

type TeamMember = typeof TEAM_MEMBERS[number]
type EnterpriseTask = typeof ENTERPRISE_TASKS[number]
type ActivityItem = typeof ACTIVITY_FEED[number]
type ChatChannel = typeof CHAT_CHANNELS[number]
type ChatMessage = typeof CHAT_MESSAGES[number]

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function PresenceRow({ member }: { member: TeamMember }) {
  const meta = STATUS_META[member.status]
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.03] cursor-pointer transition-colors"
    >
      <div className="relative">
        <Avatar className="h-9 w-9 ring-1 ring-white/10">
          <AvatarFallback
            className="text-[11px] font-semibold text-white"
            style={{ background: `${member.color}22`, color: member.color }}
          >
            {member.avatar}
          </AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${meta.dot} ring-2 ring-[#0a0e14]`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-white">{member.name}</span>
          <span className={`text-[10px] uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
        </div>
        <div className="truncate text-[11px] text-slate-400">
          {member.role} · {member.company}
        </div>
        {member.currentActivity && member.status !== 'offline' && (
          <div className="mt-0.5 truncate text-[11px] italic text-slate-500">
            {member.currentActivity}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TaskCard({ task }: { task: EnterpriseTask }) {
  const p = PRIORITY_META[task.priority]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/15 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-medium leading-snug text-white">{task.title}</h4>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${p.cls}`}>{p.label}</Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{task.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {task.tags.map((t) => (
          <span key={t} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-400">
            #{t}
          </span>
        ))}
      </div>
      <Separator className="my-2 bg-white/[0.06]" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-white/[0.06] text-[10px] font-medium text-slate-300">
              {task.assigneeAvatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-slate-300">{task.assignee}</span>
            <Badge variant="outline" className="mt-0.5 h-3.5 px-1 text-[9px] font-normal text-slate-400 border-white/10">
              {task.company.split(' ')[1] ?? task.company}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{task.dueDate}</span>
          <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{task.comments}</span>
          <span className="flex items-center gap-0.5"><AtSign className="h-3 w-3" />{task.mentions}</span>
        </div>
      </div>
    </motion.div>
  )
}

function KanbanColumn({ column, tasks }: { column: typeof KANBAN_COLUMNS[number]; tasks: EnterpriseTask[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className={`rounded-t-lg border-t-2 ${column.accent} bg-white/[0.02] px-3 py-2`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{column.title}</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-slate-400 border-white/10">
            {tasks.length}
          </Badge>
        </div>
      </div>
      <ScrollArea className="max-h-[28rem] flex-1">
        <div className="space-y-2 p-2">
          <AnimatePresence>
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.06] p-4 text-center text-[11px] text-slate-600">
                No tasks
              </div>
            ) : (
              tasks.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}

function ChatThread({ channel, messages }: { channel: ChatChannel; messages: ChatMessage[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">{channel.name}</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-slate-400 border-white/10">
            {channel.members} members
          </Badge>
        </div>
        <span className="text-[10px] text-slate-500">Active {channel.lastActivity}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          <AnimatePresence>
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.06] p-6 text-center text-xs text-slate-500">
                <Inbox className="mx-auto mb-1 h-5 w-5 opacity-40" />
                No messages yet — start the conversation.
              </div>
            ) : (
              messages.map((m) => {
                const isAI = m.user.toLowerCase().includes('ai')
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5"
                  >
                    <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
                      <AvatarFallback
                        className={`text-[10px] font-semibold ${isAI ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-300'}`}
                      >
                        {m.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-semibold ${isAI ? 'text-emerald-300' : 'text-white'}`}>
                          {m.user}
                        </span>
                        {isAI && (
                          <Badge variant="outline" className="h-3.5 px-1 text-[9px] text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
                            <Sparkles className="mr-0.5 h-2.5 w-2.5" />AI
                          </Badge>
                        )}
                        <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-300">{m.message}</p>
                      {m.reactions && m.reactions.length > 0 && (
                        <div className="mt-1.5 flex gap-1">
                          {m.reactions.map((r, i) => (
                            <span
                              key={i}
                              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              <span>{r.emoji}</span>
                              <span className="text-slate-400">{r.count}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>

          {/* Typing indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 pl-10 pt-1"
          >
            <Sparkles className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] italic text-emerald-400/80">AI Copilot is typing</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1 w-1 rounded-full bg-emerald-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </span>
          </motion.div>
        </div>
      </ScrollArea>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder={`Message #${channel.name}`}
            className="h-9 border-white/[0.08] bg-white/[0.02] text-[12px] text-slate-200 placeholder:text-slate-600"
          />
          <Button size="icon" className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600 text-white">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ActivityTimeline() {
  return (
    <ScrollArea className="max-h-[28rem]">
      <div className="space-y-2 p-1">
        <AnimatePresence>
          {ACTIVITY_FEED.map((item, idx) => {
            const meta = ACTIVITY_META[item.type]
            const Icon = meta.icon
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex gap-3 rounded-r-lg border-l-2 ${meta.border} ${meta.bg} p-2.5`}
              >
                <Avatar className="h-7 w-7 shrink-0 ring-1 ring-white/10">
                  <AvatarFallback className="bg-white/[0.06] text-[10px] text-slate-300">
                    {item.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug text-slate-300">
                    <span className="font-semibold text-white">{item.user}</span>{' '}
                    <span className="text-slate-400">{item.action}</span>{' '}
                    <span className="font-medium text-emerald-300 underline-offset-2 hover:underline cursor-pointer">
                      {item.target}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className={`flex items-center gap-1 ${meta.color}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {item.type}
                    </span>
                    <span>·</span>
                    <span>{item.company}</span>
                    <span>·</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ScrollArea>
  )
}

function LiveIndicatorCard() {
  const onlineCount = TEAM_MEMBERS.filter((m) => m.status === 'online').length
  const busyCount = TEAM_MEMBERS.filter((m) => m.status === 'busy').length
  const inProgress = ENTERPRISE_TASKS.filter((t) => t.status === 'in-progress').length
  const review = ENTERPRISE_TASKS.filter((t) => t.status === 'review').length
  const unread = CHAT_CHANNELS.reduce((s, c) => s + c.unread, 0)
  const pendingApprovals = 6 // matches WORKFLOW_APPROVALS pending/in-review count

  return (
    <div className="space-y-3">
      {/* Active Now */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Radio className="h-4 w-4 text-emerald-400" />
                <motion.span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <span className="text-xs font-medium text-slate-300">Active Now</span>
            </div>
            <span className="text-xl font-bold text-white tabular-nums">{onlineCount}</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />{onlineCount} online
            </span>
            <span className="flex items-center gap-1 text-[10px] text-rose-400">
              <Circle className="h-2 w-2 fill-rose-500 text-rose-500" />{busyCount} busy
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Mini Stats */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <ListTodo className="h-3.5 w-3.5 text-cyan-400" />
            Workspace Pulse
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pb-3 pt-1">
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-lg font-bold text-cyan-300">{inProgress}</div>
            <div className="text-[10px] text-slate-500">Tasks in progress</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-lg font-bold text-amber-300">{review}</div>
            <div className="text-[10px] text-slate-500">In review</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-lg font-bold text-emerald-300">{pendingApprovals}</div>
            <div className="text-[10px] text-slate-500">Pending approvals</div>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
            <div className="text-lg font-bold text-violet-300">{unread}</div>
            <div className="text-[10px] text-slate-500">Unread messages</div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time sync */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="text-xs font-semibold text-emerald-300">Real-Time Sync</div>
                <div className="text-[10px] text-slate-500">WebSocket · 12ms latency</div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              Connected
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-white tabular-nums">42</div>
              <div className="text-[9px] text-slate-500">Events/min</div>
            </div>
            <div>
              <div className="text-sm font-bold text-white tabular-nums">6</div>
              <div className="text-[9px] text-slate-500">Companies</div>
            </div>
            <div>
              <div className="text-sm font-bold text-white tabular-nums">99.9%</div>
              <div className="text-[9px] text-slate-500">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick channels */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Quick Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pb-3 pt-1">
          {CHAT_CHANNELS.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-white/[0.03]">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <Hash className="h-3 w-3 text-slate-500" />
                {c.name}
              </span>
              {c.unread > 0 && (
                <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500 text-white">{c.unread}</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TeamCollaboration() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'activity'>('tasks')
  const [selectedChannelId, setSelectedChannelId] = useState<string>('gst-filings')

  const groupedMembers = useMemo(() => {
    const groups: Record<TeamMember['status'], TeamMember[]> = {
      online: [], busy: [], away: [], offline: [],
    }
    for (const m of TEAM_MEMBERS) groups[m.status].push(m)
    return groups
  }, [])

  const orderedStatuses = (['online', 'busy', 'away', 'offline'] as TeamMember['status'][])
    .filter((s) => groupedMembers[s].length > 0)

  const selectedChannel = CHAT_CHANNELS.find((c) => c.id === selectedChannelId) ?? CHAT_CHANNELS[0]
  const channelMessages = CHAT_MESSAGES.filter((m) => m.channel === selectedChannelId)

  const tasksByStatus = (status: EnterpriseTask['status']) =>
    ENTERPRISE_TASKS.filter((t) => t.status === status)

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <Users className="h-5 w-5 text-emerald-400" />
            Team Collaboration™
          </h2>
          <p className="text-xs text-slate-400">Real-time enterprise teamwork across all companies</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {groupedMembers.online.length} online
          </Badge>
          <Badge variant="outline" className="gap-1 border-white/10 text-slate-300">
            <ActivityIcon className="h-3 w-3" />
            {ACTIVITY_FEED.length} recent events
          </Badge>
        </div>
      </motion.div>

      {/* 3-Column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT — Team Presence */}
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-semibold text-white">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Team Presence
                </span>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-slate-400 border-white/10">
                  {TEAM_MEMBERS.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <ScrollArea className="max-h-[40rem] pr-2">
                <div className="space-y-3">
                  {orderedStatuses.map((status) => {
                    const meta = STATUS_META[status]
                    return (
                      <div key={status}>
                        <div className="mb-1.5 flex items-center justify-between px-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-600">{groupedMembers[status].length}</span>
                        </div>
                        <div className="space-y-0.5">
                          {groupedMembers[status].map((m) => (
                            <PresenceRow key={m.id} member={m} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* CENTER — Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-6"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardContent className="p-3">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid w-full grid-cols-3 bg-white/[0.03]">
                  <TabsTrigger value="tasks" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
                    <ListTodo className="h-3.5 w-3.5" />Tasks
                    <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] border-white/10 text-slate-400">
                      {ENTERPRISE_TASKS.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
                    <MessageSquare className="h-3.5 w-3.5" />Chat
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="gap-1.5 text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
                    <ActivityIcon className="h-3.5 w-3.5" />Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-3">
                  <AnimatePresence mode="wait">
                    {activeTab === 'tasks' && (
                      <motion.div
                        key="tasks"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
                      >
                        {KANBAN_COLUMNS.map((col) => (
                          <KanbanColumn key={col.id} column={col} tasks={tasksByStatus(col.id)} />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="chat" className="mt-3">
                  <AnimatePresence mode="wait">
                    {activeTab === 'chat' && (
                      <motion.div
                        key="chat"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-4"
                      >
                        {/* Channel list */}
                        <div className="sm:col-span-1">
                          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                            <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              Channels
                            </div>
                            <ScrollArea className="max-h-[34rem]">
                              <div className="space-y-0.5">
                                {CHAT_CHANNELS.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => setSelectedChannelId(c.id)}
                                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
                                      c.id === selectedChannelId
                                        ? 'bg-emerald-500/10 text-emerald-300'
                                        : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5 truncate text-[12px]">
                                      <Hash className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{c.name}</span>
                                    </span>
                                    {c.unread > 0 && (
                                      <Badge className="h-4 shrink-0 px-1.5 text-[9px] bg-emerald-500 text-white">
                                        {c.unread}
                                      </Badge>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>

                        {/* Messages */}
                        <div className="sm:col-span-3">
                          <div className="h-[34rem] rounded-lg border border-white/[0.06] bg-white/[0.02]">
                            <ChatThread channel={selectedChannel} messages={channelMessages} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="activity" className="mt-3">
                  <AnimatePresence mode="wait">
                    {activeTab === 'activity' && (
                      <motion.div
                        key="activity"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        <ActivityTimeline />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>

        {/* RIGHT — Live indicators */}
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <LiveIndicatorCard />
        </motion.div>
      </div>
    </div>
  )
}
