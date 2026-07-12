'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle AI™ — Message Bubble
//
// Renders a single message (user / assistant / tool) with markdown content,
// inline artifacts, tool-call chips, and citations. Used in the chat thread.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Sparkles, User, Wrench, CheckCircle2, XCircle, Quote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ArtifactRenderer } from './ArtifactRenderer';
import type { LiveArtifact, LiveCitation, LiveToolCall } from './useOracleAIChat';
import type { OracleAIMessage } from '@/lib/oracle-ai/types';

interface MessageBubbleProps {
  message: OracleAIMessage;
  artifacts: LiveArtifact[];
  toolCalls: LiveToolCall[];
  citations: LiveCitation[];
  isStreaming?: boolean;
  streamingText?: string;
}

function ToolCallChip({ tc }: { tc: LiveToolCall }) {
  const pending = tc.ok === null;
  const ok = tc.ok === true;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs"
    >
      <Wrench className="h-3.5 w-3.5 text-sky-400" />
      <span className="font-mono text-foreground/90">{tc.toolName}</span>
      {pending && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          running
        </span>
      )}
      {ok && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
      {!pending && !ok && <XCircle className="h-3.5 w-3.5 text-red-400" />}
    </motion.div>
  );
}

function CitationChip({ c, index }: { c: LiveCitation; index: number }) {
  return (
    <a
      href={c.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-1.5 py-0.5 text-[11px] text-foreground/70 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
    >
      <Quote className="h-3 w-3" />
      <span className="font-mono">[{index + 1}]</span>
      <span className="max-w-[180px] truncate">{c.title}</span>
    </a>
  );
}

function MessageBubbleImpl({
  message,
  artifacts,
  toolCalls,
  citations,
  isStreaming,
  streamingText,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const msgArtifacts = artifacts.filter((a) => a.messageId === message.id || (isStreaming && a.messageId === message.id));
  const msgToolCalls = toolCalls.filter((t) => t.messageId === message.id);
  const msgCitations = citations.filter((c) => c.messageId === message.id);
  const displayText = isStreaming ? (streamingText ?? message.content) : message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          isUser
            ? 'bg-muted text-muted-foreground'
            : 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={`flex min-w-0 max-w-[85%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-emerald-500/10 text-foreground rounded-tr-sm ring-1 ring-emerald-500/20'
              : 'bg-card/60 text-foreground rounded-tl-sm ring-1 ring-border/60'
          }`}
        >
          {displayText ? (
            <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:rounded [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:bg-black/40 [&_pre]:p-2 [&_pre]:rounded-md [&_table]:text-xs">
              <ReactMarkdown>{displayText}</ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" />
              </span>
            </span>
          ) : null}
        </div>

        {/* Tool calls */}
        {msgToolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msgToolCalls.map((tc) => (
              <ToolCallChip key={tc.callId} tc={tc} />
            ))}
          </div>
        )}

        {/* Artifacts */}
        {msgArtifacts.length > 0 && (
          <div className="grid w-full gap-2">
            {msgArtifacts.map((a) => (
              <ArtifactRenderer key={a.artifactId} kind={a.kind} title={a.title} data={a.data} compact />
            ))}
          </div>
        )}

        {/* Citations */}
        {msgCitations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Sources:</span>
            {msgCitations.map((c, i) => (
              <CitationChip key={c.sourceId} c={c} index={i} />
            ))}
          </div>
        )}

        {/* Meta footer for assistant */}
        {isAssistant && !isStreaming && message.model && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{message.model}</Badge>
            {message.latencyMs > 0 && <span>{(message.latencyMs / 1000).toFixed(1)}s</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
