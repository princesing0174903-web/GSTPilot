'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Message Components
// ═══════════════════════════════════════════════════════════════════════════════
// Renders user and oracle messages. Oracle messages include the structured
// sections: Thinking Trail → Markdown body → Recommended Actions → Confidence →
// Sources → Insights → Follow-up suggestions.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { User, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage } from '@/lib/oracle-chat/types';
import { OracleMarkdown } from './OracleMarkdown';
import { ThinkingTrail } from './ThinkingTrail';
import { ConfidenceMeter, SourcesPanel } from './ConfidenceMeter';
import { RecommendedActions } from './ProactiveInsights';

function FollowUpChips({ followUps, onSelect }: { followUps: string[]; onSelect: (q: string) => void }) {
  if (!followUps || followUps.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {followUps.map((f, i) => (
        <button
          key={i}
          onClick={() => onSelect(f)}
          className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-200"
        >
          <span>{f}</span>
          <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">{count}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end gap-3"
    >
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-500/15 to-emerald-400/5 px-4 py-2.5 ring-1 ring-emerald-400/20">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-100">{message.content}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
        <User className="h-4 w-4 text-zinc-300" />
      </div>
    </motion.div>
  );
}

export function OracleMessageView({
  message,
  onFollowUp,
}: {
  message: ChatMessage;
  onFollowUp: (q: string) => void;
}) {
  const isStreaming = message.streaming;
  const hasContent = message.content && message.content.length > 0;
  const hasActions = (message.recommendedActions?.length ?? 0) > 0;
  const hasSources = (message.sources?.length ?? 0) > 0;
  const hasInsights = (message.insights?.length ?? 0) > 0;
  const confidence = message.confidence ?? 0;
  const hasFollowUps = (message.followUps?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/20 to-emerald-500/5 ring-1 ring-emerald-400/30">
        <Sparkles className="h-4 w-4 text-emerald-300" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {/* Thinking trail */}
        <ThinkingTrail
          toolCalls={message.toolCalls ?? []}
          toolResults={message.toolResults ?? []}
          streaming={isStreaming && !hasContent}
        />

        {/* Streaming content with caret */}
        {hasContent && (
          <div className="relative">
            <OracleMarkdown content={message.content} />
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-emerald-400 align-middle" />
            )}
          </div>
        )}

        {/* Loading dots when no content yet */}
        {!hasContent && isStreaming && (message.toolCalls?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" />
            </div>
            <span>Synthesizing answer from real data…</span>
          </div>
        )}

        {/* Recommended Actions */}
        {hasActions && !isStreaming && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Recommended Actions
              </span>
            </div>
            <RecommendedActions actions={message.recommendedActions!} />
          </div>
        )}

        {/* Confidence + Sources grid */}
        {!isStreaming && (confidence > 0 || hasSources) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {confidence > 0 && <ConfidenceMeter score={confidence} />}
            {hasSources && <SourcesPanel sources={message.sources!} />}
          </div>
        )}

        {/* Insights (proactive within this answer) */}
        {hasInsights && !isStreaming && (
          <CollapsibleSection title="Oracle Notices" count={message.insights!.length}>
            <div className="space-y-2">
              {message.insights!.map((ins) => (
                <div key={ins.id} className="rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-inset ring-white/10">
                  <p className="text-sm font-medium text-zinc-200">{ins.headline}</p>
                  <p className="mt-0.5 text-[13px] text-zinc-400">{ins.detail}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Follow-up suggestions */}
        {hasFollowUps && !isStreaming && (
          <FollowUpChips followUps={message.followUps!} onSelect={onFollowUp} />
        )}

        {/* Error state */}
        {message.error && (
          <div className="rounded-lg bg-rose-400/10 p-3 ring-1 ring-inset ring-rose-400/30">
            <p className="text-sm text-rose-200">{message.content}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
