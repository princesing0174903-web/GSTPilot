'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Message Renderer (Phase 2 — Oracle Intelligence™)
//
// Renders a single Oracle message as a CFO-grade strategic brief:
//   1. Key Insight          (top, bold, accent bar — the headline)
//   2. Analysis             (paragraphs + bullet sub-points)
//   3. Recommended Actions  (numbered list, action icons)
//   4. Potential Risks      (warning cards, amber/red accents)
//   5. Next Best Step       (highlighted CTA card with arrow, clickable)
//   6. Sources              (Perplexity-style source cards)
//   7. Follow-up Questions  (chips, clickable to send)
//   + Investigation Mode    (when present, asks clarifying questions)
//
// During streaming, parts appear progressively with a typing cursor. When the
// message is still in a pre-stream phase (thinking / reading / analyzing /
// preparing), a phase indicator reflecting the 5-step reasoning process is
// shown instead of the structured body.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Compass,
  Copy,
  FileText,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Network,
  Quote,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { ORACLE_MODES, ORACLE_LANGUAGES, ORACLE_EMOTIONS } from './oracle-types';
import type {
  OracleActionCard,
  OracleMessage,
  OracleModeId,
  OraclePhase,
  OracleSource,
  OracleSourceKind,
  OracleLanguageId,
  OracleEmotionId,
} from './oracle-types';
import { OracleActionCards } from './OracleActionCards';
import { OracleAvatar } from './OracleAvatar';
import { deriveAvatarState } from './oracle-human';
import { cn } from '@/lib/utils';

// ─── Source Card ─────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<OracleSourceKind, LucideIcon> = {
  'gst-law': BookOpen,
  gstn: Network,
  circular: FileText,
  'business-data': Building2,
  'uploaded-file': FileText,
  'conversation-memory': Quote,
};

const SOURCE_LABEL: Record<OracleSourceKind, string> = {
  'gst-law': 'GST Law',
  gstn: 'GSTN',
  circular: 'CBIC Circular',
  'business-data': 'Business Data',
  'uploaded-file': 'Uploaded File',
  'conversation-memory': 'Conversation Memory',
};

function SourceCard({ source, index }: { source: OracleSource; index: number }) {
  const Icon = SOURCE_ICON[source.kind] ?? FileText;
  return (
    <motion.a
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      href={source.url ?? '#'}
      onClick={(e) => {
        if (!source.url) e.preventDefault();
      }}
      className="group flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-border bg-card/[0.3] p-3 transition-all hover:border-[color-mix(in_srgb,var(--accent-start)_40%,transparent)] hover:bg-card/[0.5]"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md accent-gradient-soft">
          <Icon className="h-3 w-3 accent-text" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {SOURCE_LABEL[source.kind]}
        </span>
      </div>
      <p className="line-clamp-2 text-xs font-medium text-foreground">{source.title}</p>
      <p className="line-clamp-2 text-[11px] text-muted-foreground">{source.snippet}</p>
    </motion.a>
  );
}

// ─── Phase Indicator (Ultra Response Engine — "Oracle is responding…") ───────
// Replaces the old 5-stage fake-thinking indicator with a single, premium
// "Oracle is responding…" line + a small pulsing dot. No fake phase labels,
// no progress bar, no "Reading…", "Analyzing…", "Preparing…" messages.

function PhaseIndicator({ phase }: { phase: OraclePhase }) {
  // The Ultra Engine only ever shows this indicator during the brief moment
  // between message creation and the first streamed token. Once streaming
  // begins, the structured parts render inline with a typing cursor.
  void phase;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 py-1"
    >
      {/* Small pulsing dot — emerald, like Claude/ChatGPT */}
      <span className="relative flex h-2 w-2">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
          animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        Oracle is responding
      </span>
      {/* Blinking cursor ▋ */}
      <motion.span
        className="inline-block h-3.5 w-[2px] rounded-full bg-accent-start"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
    </motion.div>
  );
}

// ─── Mode Badge ──────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: OracleModeId }) {
  const m = ORACLE_MODES[mode];
  if (!m) return null;
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{ backgroundColor: m.tint, color: m.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: m.color }}
      />
      {m.name}
    </div>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 accent-text" />
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      {children}
    </motion.div>
  );
}

// ─── User Message ────────────────────────────────────────────────────────────

function UserMessage({
  content,
  mode,
  language,
  emotion,
}: {
  content: string;
  mode?: OracleModeId;
  language?: OracleLanguageId;
  emotion?: OracleEmotionId;
}) {
  const langMeta = language ? ORACLE_LANGUAGES[language] : null;
  const emotionMeta = emotion && emotion !== 'neutral' ? ORACLE_EMOTIONS[emotion] : null;
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[80%] flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          {mode && <ModeBadge mode={mode} />}
          {emotionMeta && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${emotionMeta.color} 14%, transparent)`, color: emotionMeta.color }}
              title={emotionMeta.descriptor}
            >
              <span>{emotionMeta.emoji}</span>
              {emotionMeta.label}
            </span>
          )}
          {langMeta && langMeta.id !== 'english' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/[0.4] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <span>{langMeta.glyph}</span>
              {langMeta.nativeName}
            </span>
          )}
        </div>
        <div className="rounded-2xl rounded-tr-md border border-border bg-card/[0.5] px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Renderer (paragraphs + bullet sub-points) ──────────────────────

function AnalysisBody({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  // Split into paragraphs by \n\n, then within each paragraph detect bullet lines.
  const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0);

  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed text-foreground/90',
        isStreaming && 'typing-cursor',
      )}
    >
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n');
        const bulletLines: string[] = [];
        const proseLines: string[] = [];
        let currentMode: 'prose' | 'bullet' | null = null;

        for (const line of lines) {
          const trimmed = line.trim();
          const isBullet =
            trimmed.startsWith('• ') ||
            trimmed.startsWith('- ') ||
            trimmed.startsWith('* ');
          if (isBullet) {
            if (currentMode === 'prose' && proseLines.length > 0) {
              // Flush prose before bullets.
            }
            bulletLines.push(trimmed.replace(/^[•\-*]\s+/, ''));
            currentMode = 'bullet';
          } else if (trimmed.length > 0) {
            proseLines.push(line);
            currentMode = 'prose';
          }
        }

        return (
          <div key={pi} className="space-y-1.5">
            {proseLines.length > 0 && (
              <p>{proseLines.join(' ')}</p>
            )}
            {bulletLines.length > 0 && (
              <ul className="ml-1 space-y-1">
                {bulletLines.map((b, bi) => (
                  <motion.li
                    key={bi}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: bi * 0.04 }}
                    className="flex items-start gap-2 text-foreground/85"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-start" />
                    <span>{b}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Oracle Message (the strategic brief) ────────────────────────────────────

export interface OracleMessageProps {
  message: OracleMessage;
  onFollowUp?: (question: string) => void;
  onAction?: (kind: string, label: string) => void;
  /** When provided, clicking Next Best Step calls this with the step text. */
  onNextBestStep?: (step: string) => void;
  /** Phase 3 — when provided, clicking an Action Card spawns an Oracle Task. */
  onRunAction?: (card: OracleActionCard) => void;
  /** Phase 3 — disable action cards (e.g. while a task is already running). */
  actionsDisabled?: boolean;
  /** Phase 2 — regenerate the last user-question → Oracle response. */
  onRegenerate?: () => void;
  /** Phase 2 — speak this Oracle response aloud (TTS). */
  onSpeak?: (message: OracleMessage) => void;
  /** Phase 2 — whether TTS playback is currently active for this message. */
  isSpeaking?: boolean;
}

export function OracleMessageView({
  message,
  onFollowUp,
  onAction,
  onNextBestStep,
  onRunAction,
  actionsDisabled,
  onRegenerate,
  onSpeak,
  isSpeaking,
}: OracleMessageProps) {
  if (message.role === 'user') {
    return (
      <UserMessage
        content={message.content}
        mode={message.mode}
        language={message.language}
        emotion={message.emotion}
      />
    );
  }

  const phase = message.phase ?? 'done';
  const isPreStream =
    phase === 'thinking' ||
    phase === 'reading' ||
    phase === 'analyzing' ||
    phase === 'preparing';
  const isError = phase === 'error';
  const parts = message.parts;
  const mode = message.mode ? ORACLE_MODES[message.mode] : undefined;
  const isStreaming = phase === 'streaming';
  const isDone = phase === 'done';

  // Build a plain-text version for copy / export / speak.
  const plainText = parts
    ? [
        parts.keyInsight ? `KEY INSIGHT\n${parts.keyInsight}` : '',
        parts.analysis ? `\nANALYSIS\n${parts.analysis}` : '',
        parts.recommendedActions.length > 0
          ? `\nRECOMMENDED ACTIONS\n${parts.recommendedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
          : '',
        parts.potentialRisks.length > 0
          ? `\nPOTENTIAL RISKS\n${parts.potentialRisks.map((r) => `• ${r}`).join('\n')}`
          : '',
        parts.nextBestStep ? `\nNEXT BEST STEP\n${parts.nextBestStep}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : message.content;

  const handleCopy = () => {
    if (!plainText) return;
    navigator.clipboard?.writeText(plainText).catch(() => {});
  };

  const handleExport = () => {
    if (!plainText) return;
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-response-${new Date(message.createdAt).getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-3">
      {/* Oracle avatar — dynamic facial expressions */}
      <div className="shrink-0">
        <OracleAvatar
          state={deriveAvatarState(phase, message.emotion)}
          size={40}
        />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Mode badge + status row */}
        <div className="flex items-center gap-2">
          {mode && <ModeBadge mode={mode.id} />}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Oracle is responding
            </span>
          )}
        </div>

        {/* Error state */}
        {isError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
            <p className="font-medium">Oracle hit a snag.</p>
            <p className="mt-1 text-xs opacity-80">{message.error ?? 'Unknown error'}</p>
          </div>
        )}

        {/* Pre-stream phase indicator */}
        {isPreStream && <PhaseIndicator phase={phase} />}

        {/* Structured parts — rendered progressively during streaming */}
        {!isError && !isPreStream && parts && (
          <div className="space-y-5">
            {/* 1. Key Insight — the headline */}
            {parts.keyInsight && (
              <Section icon={Lightbulb} title="Key Insight" delay={0}>
                <div
                  className={cn(
                    'rounded-2xl border-l-[3px] border-[color-mix(in_srgb,var(--accent-start)_70%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--accent-start)_8%,transparent)] to-transparent px-4 py-3 text-[15px] font-semibold leading-snug text-foreground',
                    isStreaming && 'typing-cursor',
                  )}
                >
                  {parts.keyInsight}
                </div>
              </Section>
            )}

            {/* 2. Analysis — the strategic reasoning */}
            {parts.analysis && (
              <Section icon={Compass} title="Analysis" delay={0.05}>
                <AnalysisBody text={parts.analysis} isStreaming={isStreaming} />
              </Section>
            )}

            {/* 3. Recommended Actions */}
            {parts.recommendedActions.length > 0 && (
              <Section icon={ListChecks} title="Recommended Actions" delay={0.1}>
                <ol className="space-y-2">
                  {parts.recommendedActions.map((rec, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="flex items-start gap-2.5 rounded-xl border border-border bg-card/[0.3] p-3"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md accent-gradient-soft text-[10px] font-bold accent-text">
                        {i + 1}
                      </div>
                      <span className="text-sm text-foreground/90">{rec}</span>
                    </motion.li>
                  ))}
                </ol>
              </Section>
            )}

            {/* 4. Potential Risks — warning cards */}
            {parts.potentialRisks.length > 0 && (
              <Section icon={ShieldAlert} title="Potential Risks" delay={0.15}>
                <div className="space-y-2">
                  {parts.potentialRisks.map((risk, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-sm text-foreground/90">{risk}</span>
                    </motion.div>
                  ))}
                </div>
              </Section>
            )}

            {/* 5. Next Best Step — highlighted CTA */}
            {parts.nextBestStep && (
              <Section icon={Target} title="Next Best Step" delay={0.2}>
                <motion.button
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (onNextBestStep) {
                      onNextBestStep(parts.nextBestStep);
                    } else {
                      onAction?.('create-report', parts.nextBestStep);
                    }
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent-start)_40%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--accent-start)_12%,transparent)] to-[color-mix(in_srgb,var(--accent-end)_8%,transparent)] px-4 py-3 text-left transition-all hover:border-[color-mix(in_srgb,var(--accent-start)_60%,transparent)] hover:shadow-[0_4px_24px_-8px_rgba(0,229,255,0.2)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl accent-gradient text-white shadow-lg shadow-emerald-500/20">
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <span className="flex-1 text-sm font-semibold text-foreground">
                    {parts.nextBestStep}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    Open
                  </span>
                </motion.button>
              </Section>
            )}

            {/* Investigation Mode — clarifying questions */}
            {parts.investigation && parts.investigation.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 }}
                className="rounded-2xl border border-[color-mix(in_srgb,var(--accent-start)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent-start)_6%,transparent)] p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 accent-text" />
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Investigation Mode
                  </h4>
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Before Oracle commits to a full answer, a quick clarification will make this sharper:
                </p>
                <div className="flex flex-col gap-1.5">
                  {parts.investigation.map((q, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                      whileHover={{ x: 2 }}
                      onClick={() => onFollowUp?.(q)}
                      disabled={!isDone}
                      className="group flex items-center gap-2 rounded-xl border border-border bg-card/[0.4] px-3.5 py-2 text-left text-sm text-foreground/90 transition-colors hover:border-[color-mix(in_srgb,var(--accent-start)_40%,transparent)] hover:bg-card/[0.7] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3 accent-text" />
                      {q}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 6. Sources */}
            {parts.sources.length > 0 && (
              <Section icon={Quote} title="Sources" delay={0.25}>
                <div className="flex flex-wrap gap-2">
                  {parts.sources.map((s, i) => (
                    <SourceCard key={i} source={s} index={i} />
                  ))}
                </div>
              </Section>
            )}

            {/* 7. Follow-up Questions */}
            {parts.followUps.length > 0 && (
              <Section icon={Sparkles} title="Follow-up Questions" delay={0.3}>
                <div className="flex flex-col gap-1.5">
                  {parts.followUps.map((q, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      whileHover={{ x: 2 }}
                      onClick={() => onFollowUp?.(q)}
                      disabled={!isDone}
                      className="group flex items-center gap-2 rounded-xl border border-border bg-card/[0.3] px-3.5 py-2 text-left text-sm text-foreground/90 transition-colors hover:border-[color-mix(in_srgb,var(--accent-start)_40%,transparent)] hover:bg-card/[0.6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowRight className="h-3 w-3 text-muted-foreground transition-colors group-hover:accent-text" />
                      {q}
                    </motion.button>
                  ))}
                </div>
              </Section>
            )}

            {/* 8. Phase 3 — Action Cards (3 large glass buttons, single-click execution) */}
            {parts.actionCards && parts.actionCards.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
              >
                <OracleActionCards
                  cards={parts.actionCards}
                  onRun={onRunAction}
                  disabled={!isDone || actionsDisabled}
                />
              </motion.div>
            )}
          </div>
        )}

        {/* Done checkmark + action row */}
        {isDone && parts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span>Oracle · {new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </span>

            {/* Action row — copy / speak / regenerate / export */}
            <div className="ml-auto flex items-center gap-0.5">
              <MsgActionButton
                icon={Copy}
                label="Copy"
                onClick={handleCopy}
              />
              {onSpeak && (
                <MsgActionButton
                  icon={Volume2}
                  label={isSpeaking ? 'Speaking…' : 'Listen'}
                  onClick={() => onSpeak(message)}
                  active={isSpeaking}
                  disabled={isSpeaking}
                />
              )}
              {onRegenerate && (
                <MsgActionButton
                  icon={RefreshCw}
                  label="Regenerate"
                  onClick={onRegenerate}
                />
              )}
              <MsgActionButton
                icon={FileText}
                label="Export"
                onClick={handleExport}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Message Action Button (small inline icon button) ────────────────────────

function MsgActionButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'accent-text bg-card/[0.6]'
          : 'text-muted-foreground hover:bg-card/[0.5] hover:text-foreground',
      )}
    >
      <Icon className={cn('h-3 w-3', active && 'animate-pulse')} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default OracleMessageView;

// Suppress unused-import warning for AnimatePresence (reserved for future transitions).
void AnimatePresence;
