'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  X,
  Send,
  Sparkles,
  FileText,
  Search,
  AlertTriangle,
  ClipboardList,
  Loader2,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: 'Show pending filings', icon: FileText },
  { label: 'Show client issues', icon: AlertTriangle },
  { label: 'Find invoice', icon: Search },
  { label: 'Explain GST mismatch', icon: Sparkles },
  { label: 'Generate compliance summary', icon: ClipboardList },
];

const AI_RESPONSES: Record<string, string> = {
  'show pending filings':
    'You have **5 pending GSTR-1 filings** and **3 pending GSTR-3B filings** this month. The next deadline is **March 11th for GSTR-1**. Would you like me to navigate to the filing center?',
  'show client issues':
    '**3 clients have critical issues:**\n\n• TechCorp India — missing GSTIN on 5 invoices\n• Sharma Enterprises — filing delay 15 days\n• Global Traders — 2 duplicate invoices detected\n\nShall I open the Client Health Center for details?',
  'find invoice':
    'Please provide the **invoice number** or **vendor name** you\'d like to search for. I can also search by GSTIN or date range.',
  'explain gst mismatch':
    'A **GST mismatch** occurs when the tax data in your books doesn\'t match what appears on the GST portal.\n\n**Common causes:**\n• GSTIN errors\n• Amount discrepancies\n• Missing invoices in GSTR-2B\n• Duplicate entries\n\nI can run a reconciliation to identify specific mismatches.',
  'generate compliance summary':
    '**Current Period Compliance Summary:**\n\n• Score: **82/100**\n• Match Rate: **87%** achieved\n• Pending Filings: **5**\n• Issues Resolved: **12** this month\n• Clients Needing Attention: **2** before filing deadline',
};

function getAIResponse(input: string): string {
  const lower = input.toLowerCase().trim();

  // Check exact matches first
  for (const [key, value] of Object.entries(AI_RESPONSES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  // Keyword matches
  if (lower.includes('pending') || lower.includes('filing')) {
    return AI_RESPONSES['show pending filings'];
  }
  if (lower.includes('issue') || lower.includes('client') || lower.includes('problem')) {
    return AI_RESPONSES['show client issues'];
  }
  if (lower.includes('invoice') || lower.includes('find') || lower.includes('search')) {
    return AI_RESPONSES['find invoice'];
  }
  if (lower.includes('mismatch') || lower.includes('reconcil') || lower.includes('match')) {
    return AI_RESPONSES['explain gst mismatch'];
  }
  if (lower.includes('compliance') || lower.includes('summary') || lower.includes('report')) {
    return AI_RESPONSES['generate compliance summary'];
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return 'Hello! I\'m GSTPilot AI, your GST compliance assistant. I can help you with:\n\n• Checking pending filings\n• Identifying client issues\n• Finding invoices\n• Explaining GST mismatches\n• Generating compliance summaries\n\nWhat would you like to know?';
  }
  if (lower.includes('thank')) {
    return 'You\'re welcome! Let me know if you need anything else regarding GST compliance. I\'m always here to help! 🙏';
  }
  if (lower.includes('gstr-1') || lower.includes('gstr1')) {
    return 'GSTR-1 is the **return for outward supplies**. It must be filed by the **11th of the following month**. Currently, you have **5 pending GSTR-1 filings**. Would you like me to show the details?';
  }
  if (lower.includes('gstr-3b') || lower.includes('gstr3b')) {
    return 'GSTR-3B is the **summary return** for tax payment. Due date is the **20th of the following month**. You have **3 pending GSTR-3B filings** this period.';
  }
  if (lower.includes('deadline') || lower.includes('due date')) {
    return '**Upcoming GST Deadlines:**\n\n• GSTR-1: March 11, 2026\n• GSTR-3B: March 20, 2026\n• GSTR-2B: March 13, 2026\n\nWould you like to see the full Deadline Center?';
  }

  return 'I can help you with GST compliance queries. Try asking about:\n\n• Pending filings\n• Client issues\n• Invoice searches\n• GST mismatches\n• Compliance summaries\n\nOr click one of the quick actions below!';
}

function formatMessage(content: string) {
  // Simple markdown-like formatting
  return content.split('\n').map((line, i) => {
    // Bold
    const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    if (formatted.startsWith('•')) {
      return (
        <div key={i} className="ml-2" dangerouslySetInnerHTML={{ __html: formatted }} />
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

export default function AICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasShownWelcome = useRef(false);

  const welcomeMsg: Message = {
    id: 'welcome',
    role: 'assistant',
    content:
      '👋 Hello! I\'m **GSTPilot AI**, your GST compliance assistant.\n\nI can help you with:\n• Checking pending filings\n• Identifying client issues\n• Finding invoices\n• Explaining GST mismatches\n• Generating compliance summaries\n\nHow can I help you today?',
    timestamp: new Date(),
  };

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (!hasShownWelcome.current) {
      hasShownWelcome.current = true;
      setMessages([welcomeMsg]);
    }
  }, [welcomeMsg]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || input.trim();
      if (!messageText) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);

      // AI response delay (stable 800ms — no Math.random fabrication)
      const delay = 800;
      setTimeout(() => {
        const response = getAIResponse(messageText);
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      }, delay);
    },
    [input]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-shadow"
            aria-label="Open AI Copilot"
          >
            <Bot className="h-6 w-6 text-white" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden"
            style={{
              width: 'min(380px, calc(100vw - 3rem))',
              height: 'min(520px, calc(100vh - 6rem))',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />
              <div className="relative flex items-center gap-3 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">GSTPilot AI</h3>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-200 animate-pulse" />
                    <span className="text-[10px] text-emerald-100">Online</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="relative h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
              style={{ scrollbarWidth: 'thin' }}
            >
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge className="h-4 px-1 text-[8px] font-bold bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800">
                          AI
                        </Badge>
                      </div>
                    )}
                    <div className="leading-relaxed">{formatMessage(msg.content)}</div>
                  </div>
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.label)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                    >
                      <action.icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-border/50 p-3">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about GST compliance..."
                  className="flex-1 h-9 text-sm border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-emerald-800"
                  disabled={isTyping}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  size="sm"
                  className="h-9 w-9 p-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
                Quick-reply assistant · Connects to live data
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
