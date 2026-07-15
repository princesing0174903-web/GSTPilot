'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  MessageSquare, Send, Check, CheckCheck,
  ThumbsUp, ThumbsDown, AlertCircle, FileText, Users,
  CornerDownLeft, AtSign,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ApprovalStatus = 'pending' | 'approved' | 'rejected'

interface Comment {
  id: string
  userId: string
  userName: string
  userInitials: string
  content: string
  entityLink: string
  entityType: string
  timestamp: string
}

interface ChatMessage {
  id: string
  userId: string
  userName: string
  userInitials: string
  content: string
  timestamp: string
  isOwn: boolean
  read: boolean
}

interface Approval {
  id: string
  title: string
  description: string
  requestedBy: string
  requestedByInitials: string
  requestDate: string
  status: ApprovalStatus
  type: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENT USER
// ═══════════════════════════════════════════════════════════════════════════════
// No fake user. Real user identity will be wired up from auth context in a follow-up.
const CURRENT_USER: { id: string; name: string; initials: string } | null = null

const SAMPLE_COMMENTS: Comment[] = []
const SAMPLE_MESSAGES: ChatMessage[] = []
const SAMPLE_APPROVALS: Approval[] = []

// ═══════════════════════════════════════════════════════════════════════════════
// AVATAR COLOR HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-teal-100 text-teal-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENTION HIGHLIGHTING
// ═══════════════════════════════════════════════════════════════════════════════

function renderContentWithMentions(content: string) {
  const parts = content.split(/(@\w+(?:\s\w+)?)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-emerald-600 font-medium bg-emerald-50 px-0.5 rounded">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY TYPE BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function EntityTypeBadge({ type }: { type: string }) {
  const config: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    Return: { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <FileText className="h-3 w-3" /> },
    Document: { color: 'text-blue-700', bg: 'bg-blue-50', icon: <FileText className="h-3 w-3" /> },
    Notice: { color: 'text-amber-700', bg: 'bg-amber-50', icon: <AlertCircle className="h-3 w-3" /> },
    Reconciliation: { color: 'text-purple-700', bg: 'bg-purple-50', icon: <Users className="h-3 w-3" /> },
  }
  const cfg = config[type] || config.Document
  return (
    <Badge variant="secondary" className={`${cfg.bg} ${cfg.color} text-[10px] font-medium px-1.5 py-0 h-5 gap-1`}>
      {cfg.icon}
      on {type}: {''}
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const config: Record<ApprovalStatus, { label: string; color: string; bg: string; dot: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
    approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
    rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  }
  const cfg = config[status]
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} text-[10px] font-medium px-1.5 py-0 h-5 gap-1 border`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </Badge>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function CommentsTab() {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [selectedEntity, setSelectedEntity] = useState('')

  const handleSubmitComment = () => {
    if (!newComment.trim()) return
    if (!CURRENT_USER) {
      toast.error('Sign in to collaborate')
      return
    }
    const c: Comment = {
      id: `c-${Date.now()}`,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userInitials: CURRENT_USER.initials,
      content: newComment.trim(),
      entityLink: selectedEntity || 'General Discussion',
      entityType: selectedEntity ? 'Return' : 'General',
      timestamp: new Date().toISOString(),
    }
    setComments(prev => [c, ...prev])
    setNewComment('')
    toast.success('Comment added')
  }

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [comments])

  return (
    <div className="space-y-4">
      {/* Add Comment */}
      {CURRENT_USER ? (
        <Card className="border-border/60 dark:bg-gray-900">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger className="h-8 text-xs w-full max-w-xs">
                  <SelectValue placeholder="Link to entity (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GSTR-1 Mar 2025 - ABC Traders">GSTR-1 Mar 2025 - ABC Traders</SelectItem>
                  <SelectItem value="GSTR-3B Feb 2025 - Kumar Ltd">GSTR-3B Feb 2025 - Kumar Ltd</SelectItem>
                  <SelectItem value="Purchase Register Feb 2025 - XYZ">Purchase Register Feb 2025 - XYZ</SelectItem>
                  <SelectItem value="Notice GST Dept - Patel Enterprises">Notice GST Dept - Patel Enterprises</SelectItem>
                  <SelectItem value="Reconciliation Q4 2024 - Sharma & Co">Reconciliation Q4 2024 - Sharma & Co</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment... Use @mention to tag team members"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmitComment()
                  }
                }}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 self-end"
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">Sign in to collaborate and add comments.</p>
        </div>
      )}

      {/* Comments List */}
      {sortedComments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">No comments yet</p>
        </div>
      ) : (
      <ScrollArea className="max-h-[calc(100vh-380px)]">
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {sortedComments.map(comment => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 rounded-lg border border-border/40 bg-white p-4 hover:border-border/60 transition-colors dark:bg-gray-900"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={`text-[11px] font-semibold ${getAvatarColor(comment.userName)}`}>
                    {comment.userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{comment.userName}</span>
                    <EntityTypeBadge type={comment.entityType} />
                    <span className="text-[11px] text-emerald-600 font-medium truncate max-w-[200px]">
                      {comment.entityLink}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                      {new Date(comment.timestamp).toLocaleString('en-IN', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
                    {renderContentWithMentions(comment.content)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!newMessage.trim()) return
    if (!CURRENT_USER) {
      toast.error('Sign in to collaborate')
      return
    }
    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userInitials: CURRENT_USER.initials,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isOwn: true,
      read: false,
    }
    setMessages(prev => [...prev, msg])
    setNewMessage('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[400px]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white/80 dark:bg-gray-900/80 rounded-t-xl">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
          <Users className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Firm Team Chat</p>
          <p className="text-[11px] text-muted-foreground">Team members appear once collaboration is enabled</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 bg-gray-50/50 dark:bg-gray-950/50 overflow-y-auto" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No messages yet</p>
          </div>
        ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex gap-2.5 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!msg.isOwn && (
                  <Avatar className="h-7 w-7 shrink-0 mt-1">
                    <AvatarFallback className={`text-[10px] font-semibold ${getAvatarColor(msg.userName)}`}>
                      {msg.userInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[75%] ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                  {!msg.isOwn && (
                    <p className="text-[11px] font-medium text-muted-foreground mb-1 ml-1">{msg.userName}</p>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      msg.isOwn
                        ? 'bg-emerald-600 text-white rounded-tr-md'
                        : 'bg-white border border-border/60 text-foreground rounded-tl-md dark:bg-gray-800'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                  <div className={`flex items-center gap-1 mt-1 ${msg.isOwn ? 'justify-end mr-1' : 'ml-1'}`}>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.isOwn && (
                      msg.read
                        ? <CheckCheck className="h-3 w-3 text-emerald-500" />
                        : <Check className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        )}
      </div>

      {/* Message Input */}
      {CURRENT_USER ? (
      <div className="flex items-center gap-2 border-t bg-white px-4 py-3 rounded-b-xl dark:bg-gray-900">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          className="flex-1 h-9 text-sm"
        />
        <Button
          onClick={handleSend}
          disabled={!newMessage.trim()}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      ) : (
      <div className="flex items-center gap-2 border-t bg-white px-4 py-3 rounded-b-xl dark:bg-gray-900">
        <p className="text-sm text-muted-foreground w-full text-center">Sign in to collaborate</p>
      </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVALS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ApprovalsTab() {
  const [approvals, setApprovals] = useState<Approval[]>([])

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' as ApprovalStatus } : a))
    toast.success('Approval granted')
  }

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' as ApprovalStatus } : a))
    toast.error('Approval rejected')
  }

  const pendingCount = approvals.filter(a => a.status === 'pending').length
  const approvedCount = approvals.filter(a => a.status === 'approved').length
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length

  const typeConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    Filing: { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <FileText className="h-3.5 w-3.5" /> },
    Correction: { color: 'text-blue-700', bg: 'bg-blue-50', icon: <AlertCircle className="h-3.5 w-3.5" /> },
    Notice: { color: 'text-amber-700', bg: 'bg-amber-50', icon: <AlertCircle className="h-3.5 w-3.5" /> },
    ITC: { color: 'text-purple-700', bg: 'bg-purple-50', icon: <FileText className="h-3.5 w-3.5" /> },
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-white p-3 dark:bg-gray-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-xs text-muted-foreground">Pending</span>
          <span className="ml-auto text-sm font-semibold text-foreground">{pendingCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-white p-3 dark:bg-gray-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">Approved</span>
          <span className="ml-auto text-sm font-semibold text-foreground">{approvedCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-white p-3 dark:bg-gray-900">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">Rejected</span>
          <span className="ml-auto text-sm font-semibold text-foreground">{rejectedCount}</span>
        </div>
      </div>

      {/* Approval Cards */}
      {approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">No approvals pending</p>
        </div>
      ) : (
      <ScrollArea className="max-h-[calc(100vh-380px)]">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {approvals.map(approval => {
              const tCfg = typeConfig[approval.type] || typeConfig.Filing
              return (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border-border/60 hover:border-border/80 transition-colors dark:bg-gray-900">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tCfg.bg} ${tCfg.color} shrink-0`}>
                          {tCfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-medium text-foreground">{approval.title}</p>
                            <ApprovalStatusBadge status={approval.status} />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                            {approval.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={`text-[9px] font-semibold ${getAvatarColor(approval.requestedBy)}`}>
                                  {approval.requestedByInitials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[11px] text-muted-foreground">
                                {approval.requestedBy} · {new Date(approval.requestDate).toLocaleDateString('en-IN', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {approval.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleApprove(approval.id)}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => handleReject(approval.id)}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CollaborationPage() {
  const [activeTab, setActiveTab] = useState('comments')

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Collaboration Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Team communication and approvals</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger
            value="comments"
            className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Comments
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="approvals"
            className="text-xs gap-1.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Approvals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="mt-4">
          <CommentsTab />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ChatTab />
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <ApprovalsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
