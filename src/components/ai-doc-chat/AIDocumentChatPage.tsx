'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare,
  Sparkles,
  Send,
  Upload,
  FileText,
  Plus,
  File,
  Clock,
  Loader2,
  X,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState } from '@/components/shared/EmptyState';
import { Inbox } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { validateFile } from '@/lib/firebase/storage-service';
import { toast } from 'sonner';

// ─── Color Palette (Emerald) ──────────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: string[];
}

interface ChatSession {
  id: string;
  documentName: string;
  documentType: string;
  createdAt: string;
  messageCount: number;
}

// ─── Animated Card Wrapper ─────────────────────────────────────────────────
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
      transition={{ delay, duration: 0.5, ease: 'easeOut' as const }}
    >
      <Card className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}>
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────
function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-2/3' : 'w-3/4'} rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}

function SessionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ─── Format message with simple markdown ───────────────────────────────────
function formatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    const formatted = line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/⚠️/g, '<span class="text-amber-500">⚠️</span>');
    if (formatted.startsWith('•')) {
      return (
        <div key={i} className="ml-2" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    }
    if (/^\d+\./.test(formatted)) {
      return (
        <div key={i} className="ml-3" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    }
    return (
      <React.Fragment key={i}>
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    );
  });
}

// ─── Format relative date ──────────────────────────────────────────────────
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function AIDocumentChatPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; type: string; size: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Firebase Storage uploads (real) ──
  // useDocuments() uploads files to org-isolated Firebase Storage paths
  // (organizations/{orgId}/documents/...) and writes Firestore metadata.
  // The returned DocumentMetadata carries a real `downloadURL` that we forward
  // to the chat API so future chat turns can reference the file.
  const { upload } = useDocuments('documents');

  // ── Fetch sessions ───────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai-doc-chat');
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } else {
        setSessions([]);
      }
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // ── Handle file upload ───────────────────────────────────────────────────
  // Real upload flow:
  //   1. Pre-flight the file with the shared `validateFile` helper
  //      (100 MB cap, supported extensions).
  //   2. Surface the uploaded file in the right-hand panel immediately so the
  //      user gets the same instant feedback the original UI provided.
  //   3. Upload to Firebase Storage via useDocuments().upload() — this returns
  //      DocumentMetadata with a real `downloadURL`. If the upload fails we
  //      roll back the UI and toast the error.
  //   4. Create the chat session via the existing /api/ai-doc-chat endpoint,
  //      forwarding the downloadURL so the backend can reference the file.
  //   5. Post the system intro message.
  const handleFileUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(`${file.name}: ${validationError}`);
      return;
    }

    const docType = file.name.endsWith('.pdf') ? 'PDF'
      : file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'Excel'
      : file.name.endsWith('.csv') ? 'CSV'
      : file.name.endsWith('.doc') || file.name.endsWith('.docx') ? 'Word'
      : file.name.match(/\.(png|jpe?g)$/i) ? 'Image'
      : 'Document';

    const sizeStr = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    // Instant UI feedback — same UX the user had before.
    setUploadedDoc({ name: file.name, type: docType, size: sizeStr });

    // Real upload to Firebase Storage (org-isolated, category='documents').
    let downloadURL: string | null = null;
    try {
      const metadata = await upload({ file, category: 'documents' });
      downloadURL = metadata?.downloadURL ?? null;
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setUploadedDoc(null);
      return;
    }
    if (!downloadURL) {
      toast.error('Upload failed — please try again.');
      setUploadedDoc(null);
      return;
    }

    try {
      const res = await fetch('/api/ai-doc-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: file.name,
          documentType: docType,
          downloadURL,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.sessionId || `session-${Date.now()}`);
      } else {
        setActiveSession(`session-${Date.now()}`);
      }
    } catch {
      setActiveSession(`session-${Date.now()}`);
    }

    // Add system message
    setMessages([{
      id: `sys-${Date.now()}`,
      role: 'assistant',
      content: `I've received **${file.name}** (${docType}, ${sizeStr}). I'm analyzing the document now. You can ask me questions about its contents, or I can provide a summary.\n\nWhat would you like to know?`,
      timestamp: new Date().toISOString(),
      citations: [],
    }]);
  }, [upload]);

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setSending(true);

    try {
      const res = await fetch('/api/ai-doc-chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession,
          message: messageText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.content || "I don't have data to answer that yet. Please upload a document or try again later.",
          timestamp: new Date().toISOString(),
          citations: Array.isArray(data.citations) ? data.citations : [],
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "I couldn't process your request right now. Please try again later.",
          timestamp: new Date().toISOString(),
          citations: [],
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch {
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "I couldn't process your request right now. Please try again later.",
        timestamp: new Date().toISOString(),
        citations: [],
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
      setSending(false);
    }
  }, [input, activeSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── New Session ──────────────────────────────────────────────────────────
  const handleNewSession = () => {
    setMessages([]);
    setActiveSession(null);
    setUploadedDoc(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Load Session ─────────────────────────────────────────────────────────
  const handleLoadSession = (session: ChatSession) => {
    setActiveSession(session.id);
    setUploadedDoc({ name: session.documentName, type: session.documentType, size: '' });
    setMessages([
      {
        id: `sys-${session.id}`,
        role: 'assistant',
        content: `Session loaded for **${session.documentName}**. You had ${session.messageCount} messages in this session. How can I help you further?`,
        timestamp: session.createdAt,
        citations: [],
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50">
            <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              AI Document Chat
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload documents and ask AI questions
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Powered
        </Badge>
      </motion.div>

      {/* ═══ TWO-PANEL LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 'calc(100vh - 180px)' }}>

        {/* ─── LEFT PANEL: Chat Interface (2/3) ─── */}
        <div className="lg:col-span-2 flex flex-col">
          <AnimatedCard delay={0.05} className="flex flex-col flex-1">
            {/* Chat Header */}
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  {uploadedDoc ? uploadedDoc.name : 'Document Chat'}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNewSession}
                  className="gap-1.5 h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  New Session
                </Button>
              </div>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 p-0 overflow-hidden">
              {loading ? (
                <ChatSkeleton />
              ) : (
                <div
                  ref={scrollRef}
                  className="h-full overflow-y-auto p-4 space-y-4"
                  style={{ minHeight: '400px', maxHeight: 'calc(100vh - 360px)', scrollbarWidth: 'thin' }}
                >
                  {messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-16 text-center"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 mb-4">
                        <MessageSquare className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Start a Document Chat
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Upload a document from the right panel or select a previous session to begin chatting with AI about your GST documents.
                      </p>
                    </motion.div>
                  )}

                  <AnimatePresence>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                            msg.role === 'user'
                              ? 'bg-emerald-600 text-white rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          }`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                              <Badge className="h-4 px-1.5 text-[8px] font-bold bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800">
                                AI
                              </Badge>
                            </div>
                          )}
                          <div className="leading-relaxed">{formatMessage(msg.content)}</div>

                          {/* Citations */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-border/20">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                References
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.citations.map((citation, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/30"
                                  >
                                    <FileText className="h-2.5 w-2.5 mr-1" />
                                    {citation}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Typing Indicator */}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start"
                    >
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </CardContent>

            {/* Input Bar */}
            <div className="border-t border-border/30 p-3">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={uploadedDoc ? `Ask about ${uploadedDoc.name}...` : 'Upload a document to start chatting...'}
                  className="flex-1 h-10 text-sm border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-emerald-800"
                  disabled={isTyping || !uploadedDoc}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping || !uploadedDoc}
                  size="sm"
                  className="h-10 w-10 p-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </AnimatedCard>
        </div>

        {/* ─── RIGHT PANEL: Document Preview & Upload (1/3) ─── */}
        <div className="flex flex-col gap-4">

          {/* Upload Zone */}
          <AnimatedCard delay={0.1}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 text-emerald-500" />
                Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 scale-[1.02]'
                    : uploadedDoc
                    ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                    : 'border-border hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                {uploadedDoc ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 mb-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{uploadedDoc.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {uploadedDoc.type} {uploadedDoc.size && `• ${uploadedDoc.size}`}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 text-xs text-muted-foreground hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedDoc(null);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {isDragging ? 'Drop file here' : 'Drag & drop or click'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Excel, CSV supported
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </AnimatedCard>

          {/* Document Info Card */}
          {uploadedDoc && (
            <AnimatedCard delay={0.15}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <File className="h-4 w-4 text-emerald-500" />
                  Document Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
                      {uploadedDoc.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/30"
                    >
                      {uploadedDoc.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <span className="text-xs font-medium text-foreground">
                      {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {uploadedDoc.size && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Size</span>
                      <span className="text-xs font-medium text-foreground">{uploadedDoc.size}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </AnimatedCard>
          )}

          {/* Previous Sessions */}
          <AnimatedCard delay={0.2} className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-emerald-500" />
                Previous Sessions
              </CardTitle>
              <CardDescription>Click to resume a session</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SessionSkeleton />
              ) : sessions.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No chat sessions yet"
                  description="Start a new conversation to see sessions here."
                  compact
                />
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2 pr-1">
                    <AnimatePresence>
                      {sessions.map((session, index) => (
                        <motion.button
                          key={session.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
                          whileHover={{ x: 4, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
                          onClick={() => handleLoadSession(session)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                            activeSession === session.id
                              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                              : 'border-border/30 hover:border-emerald-200/50 dark:hover:border-emerald-800/50'
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 shrink-0">
                            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {session.documentName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {session.documentType}
                              </span>
                              <span className="text-[10px] text-muted-foreground">•</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatRelativeDate(session.createdAt)}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-emerald-200 text-emerald-600 bg-emerald-50/50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/30 shrink-0"
                          >
                            {session.messageCount}
                          </Badge>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </AnimatedCard>
        </div>
      </div>
    </div>
  );
}
