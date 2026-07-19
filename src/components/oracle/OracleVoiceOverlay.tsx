'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Voice Mode Overlay (Phase 2 — Human Intelligence™)
//
// A full-screen voice conversation experience — like ChatGPT Voice / Claude
// Voice. The user talks to Oracle; Oracle listens, thinks, and speaks back.
//
// Layout:
//   ┌──────────────────────────────────────────────────────────────┐
//   │                    [✕ close]                                  │
//   │                                                              │
//   │                    ┌────────────┐                            │
//   │                    │            │                            │
//   │                    │  AVATAR    │  ← animated face           │
//   │                    │  (large)   │                            │
//   │                    └────────────┘                            │
//   │                                                              │
//   │                    Oracle is listening…                      │
//   │                                                              │
//   │              ▁ ▃ ▅ ▇ ▅ ▃ ▁ ▃ ▅ ▇  ← live waveform           │
//   │                                                              │
//   │           "transcribed text appears here…"                   │
//   │                                                              │
//   │      [🔴 Stop]  [🔇 Mute]  [🎤 Push to talk]                │
//   └──────────────────────────────────────────────────────────────┘
//
// States: idle → listening → transcribing → thinking → speaking → idle
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { OracleAvatar } from './OracleAvatar';
import { useOracleVoice, speakOracleResponse, stopSpeaking, type VoiceRecorderState } from './oracle-voice';
import { deriveAvatarState } from './oracle-human';
import type { OracleEmotionId, OracleLanguageId } from './oracle-types';
import { cn } from '@/lib/utils';

export type VoiceModeState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

export interface OracleVoiceOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Called with the transcribed text — the parent sends it to Oracle chat. */
  onSubmitText: (text: string) => void;
  /** The latest Oracle response text to speak (plain text, not JSON). */
  speakText?: string;
  /** Clears the speakText after playback finishes. */
  onSpeakDone?: () => void;
  /** Live phase from the parent (thinking / streaming / done). */
  phase?: string;
  language?: OracleLanguageId;
  emotion?: OracleEmotionId;
}

export function OracleVoiceOverlay({
  open,
  onClose,
  onSubmitText,
  speakText,
  onSpeakDone,
  phase,
  language,
  emotion,
}: OracleVoiceOverlayProps) {
  const { state: recState, startRecording, cancel: cancelRecording, level, error } = useOracleVoice();
  const [mode, setMode] = useState<VoiceModeState>('idle');
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [spokenText, setSpokenText] = useState('');
  const speakTextRef = useRef<string | undefined>(speakText);
  const speakingRef = useRef(false);

  // Keep ref in sync.
  useEffect(() => {
    speakTextRef.current = speakText;
  }, [speakText]);

  // Map recorder state → mode.
  useEffect(() => {
    if (recState === 'recording') setMode('listening');
    else if (recState === 'transcribing') setMode('transcribing');
    else if (mode === 'listening' || mode === 'transcribing') setMode('idle');
  }, [recState]);

  // When the parent provides speakText and we're not already speaking, speak it.
  useEffect(() => {
    if (!open) return;
    const text = speakTextRef.current;
    if (!text || text.length === 0) return;
    if (speakingRef.current) return;
    if (muted) {
      // If muted, skip speaking but still signal done so the parent can advance.
      onSpeakDone?.();
      speakTextRef.current = undefined;
      return;
    }
    speakingRef.current = true;
    setMode('speaking');
    setSpokenText(text);
    void speakOracleResponse(text, {
      voice: 'tongtong',
      speed: 1.0,
      onEnd: () => {
        speakingRef.current = false;
        setMode('idle');
        onSpeakDone?.();
        speakTextRef.current = undefined;
      },
    });
  }, [speakText, open, muted]);

  // Clean up on close.
  useEffect(() => {
    if (!open) {
      cancelRecording();
      stopSpeaking();
      speakingRef.current = false;
      setMode('idle');
      setTranscript('');
      setSpokenText('');
    }
  }, [open, cancelRecording]);

  // Stop speaking when muted toggles on.
  useEffect(() => {
    if (muted) {
      stopSpeaking();
      speakingRef.current = false;
      if (mode === 'speaking') setMode('idle');
    }
  }, [muted]);

  const handleMicClick = useCallback(async () => {
    if (mode === 'listening' || mode === 'transcribing') {
      cancelRecording();
      return;
    }
    // Stop any in-flight speech before listening.
    stopSpeaking();
    speakingRef.current = false;
    setTranscript('');
    try {
      const text = await startRecording();
      setTranscript(text);
      setMode('thinking');
      onSubmitText(text);
    } catch {
      // Error surfaced via the hook's `error` field.
      setMode('idle');
    }
  }, [mode, cancelRecording, startRecording, onSubmitText]);

  // Derive avatar state.
  const avatarState = (() => {
    if (mode === 'listening' || mode === 'transcribing') return 'attention';
    if (mode === 'thinking' || phase === 'thinking' || phase === 'reading') return 'thinking';
    if (phase === 'analyzing') return 'analyzing';
    if (phase === 'preparing' || phase === 'streaming') return 'generating';
    if (mode === 'speaking') return 'success';
    return deriveAvatarState(phase, emotion);
  })();

  const statusLabel = (() => {
    if (mode === 'listening') return 'Listening…';
    if (mode === 'transcribing') return 'Transcribing…';
    if (mode === 'thinking' || phase === 'thinking') return 'Understanding your question…';
    if (phase === 'reading') return 'Reading knowledge sources…';
    if (phase === 'analyzing') return 'Analyzing data…';
    if (phase === 'preparing' || phase === 'streaming') return 'Generating recommendations…';
    if (mode === 'speaking') return 'Speaking…';
    return 'Tap the mic to talk to Oracle';
  })();

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close voice mode"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/[0.5] text-muted-foreground transition-colors hover:bg-card/[0.8] hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mute toggle */}
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute Oracle voice' : 'Mute Oracle voice'}
          title={muted ? 'Unmute' : 'Mute'}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/[0.5] text-muted-foreground transition-colors hover:bg-card/[0.8] hover:text-foreground"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        {/* Language pill (top center) */}
        {language && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/[0.5] px-3 py-1 text-[11px] font-medium text-muted-foreground">
            Voice Mode · {language}
          </div>
        )}

        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' as const }}
          className="relative mb-8"
        >
          {/* Outer glow */}
          <div
            className={cn(
              'absolute inset-0 -m-12 rounded-full blur-3xl transition-opacity',
              mode === 'speaking' ? 'opacity-60' : 'opacity-30',
            )}
            style={{
              background: 'radial-gradient(circle, var(--accent-start) 0%, transparent 70%)',
            }}
          />
          <OracleAvatar state={avatarState} size={160} />
        </motion.div>

        {/* Status */}
        <motion.p
          key={statusLabel}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-lg font-medium text-foreground"
        >
          {statusLabel}
        </motion.p>

        {/* Waveform (live when listening, static animation when speaking) */}
        <div className="mb-8 flex h-12 items-center justify-center gap-1">
          {Array.from({ length: 28 }).map((_, i) => {
            const isActive = mode === 'listening';
            const baseHeight = 4;
            const liveHeight = isActive ? Math.max(baseHeight, level * 48 * (0.4 + Math.abs(Math.sin(i * 0.7 + Date.now() / 200)))) : baseHeight;
            const speakHeight = mode === 'speaking' ? 8 + Math.abs(Math.sin(i * 0.5 + Date.now() / 150)) * 32 : baseHeight;
            return (
              <motion.div
                key={i}
                className="w-1.5 rounded-full accent-gradient"
                animate={{
                  height: isActive ? liveHeight : mode === 'speaking' ? speakHeight : baseHeight,
                }}
                transition={{
                  duration: isActive ? 0.08 : 0.3,
                  ease: 'easeOut' as const,
                }}
                style={{ opacity: isActive || mode === 'speaking' ? 1 : 0.3 }}
              />
            );
          })}
        </div>

        {/* Transcript / spoken text */}
        <div className="mb-10 min-h-[3rem] w-full max-w-xl px-6 text-center">
          <AnimatePresence mode="wait">
            {transcript && mode !== 'speaking' && (
              <motion.p
                key="transcript"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-base text-foreground/80"
              >
                &ldquo;{transcript}&rdquo;
              </motion.p>
            )}
            {mode === 'speaking' && spokenText && (
              <motion.p
                key="spoken"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-base text-foreground/80"
              >
                {spokenText.slice(0, 280)}
                {spokenText.length > 280 ? '…' : ''}
              </motion.p>
            )}
          </AnimatePresence>
          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Push to talk / stop */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleMicClick}
            disabled={mode === 'transcribing' || mode === 'thinking'}
            aria-label={mode === 'listening' ? 'Stop listening' : 'Start talking'}
            className={cn(
              'relative flex h-20 w-20 items-center justify-center rounded-full shadow-2xl transition-all disabled:cursor-not-allowed disabled:opacity-50',
              mode === 'listening'
                ? 'bg-red-500 text-white shadow-red-500/30'
                : 'accent-gradient text-white shadow-blue-500/30',
            )}
          >
            {mode === 'listening' && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
            )}
            {mode === 'listening' ? (
              <MicOff className="relative h-7 w-7" />
            ) : (
              <Mic className="relative h-7 w-7" />
            )}
          </motion.button>
        </div>

        {/* Hint */}
        <p className="mt-6 text-xs text-muted-foreground">
          {mode === 'listening'
            ? 'Tap again to stop · Oracle will transcribe and answer'
            : mode === 'speaking'
              ? 'Oracle is speaking · tap mute to silence'
              : 'Tap the mic and speak naturally — Oracle understands Hindi, English & more'}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

export default OracleVoiceOverlay;
