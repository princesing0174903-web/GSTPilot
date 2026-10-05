'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Voice Client Utilities (Phase 2 — Human Intelligence™)
//
// Browser-side helpers for Voice Mode:
//   • useOracleVoice() — MediaRecorder hook for capturing speech → ASR
//   • speakOracleResponse() — calls the TTS API and plays the audio
//   • Audio playback queue with stop/mute support
//
// All network calls go through the gateway using relative paths (no ports).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderState = 'idle' | 'recording' | 'transcribing';

export interface UseOracleVoiceResult {
  state: VoiceRecorderState;
  /** Start recording from the microphone. Returns a promise that resolves
   *  with the transcribed text, or rejects on error / cancel. */
  startRecording: () => Promise<string>;
  /** Cancel an in-flight recording / transcription. */
  cancel: () => void;
  /** Live audio level (0-1) for waveform visualization while recording. */
  level: number;
  /** Last error message, if any. */
  error: string | null;
}

// ─── Microphone → ASR hook ───────────────────────────────────────────────────

export function useOracleVoice(): UseOracleVoiceResult {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const resolveRef = useRef<((text: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // already stopped
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // already closed
      }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async (): Promise<string> => {
    if (state !== 'idle') {
      throw new Error('Already recording');
    }
    setError(null);
    cancelRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up audio level analysis for the waveform.
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (cancelRef.current) return;
        analyser.getByteFrequencyData(data);
        // RMS-ish average of the lower half (voice frequencies).
        let sum = 0;
        const half = Math.floor(data.length / 2);
        for (let i = 0; i < half; i++) sum += data[i];
        const avg = sum / half / 255;
        setLevel(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Pick a supported mime type.
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cleanup();
        if (cancelRef.current) {
          setState('idle');
          rejectRef.current?.(new Error('Recording cancelled'));
          return;
        }
        setState('transcribing');
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
          const base64 = await blobToBase64(blob);
          const res = await fetch('/api/oracle/asr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64 }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error ?? `ASR failed (${res.status})`);
          }
          const data = (await res.json()) as { text?: string; error?: string };
          const text = (data.text ?? '').trim();
          if (!text) throw new Error('No speech detected. Please try again.');
          setState('idle');
          resolveRef.current?.(text);
        } catch (err) {
          setState('idle');
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          setError(msg);
          rejectRef.current?.(err instanceof Error ? err : new Error(msg));
        }
      };

      recorder.start();
      setState('recording');

      return new Promise<string>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
      });
    } catch (err) {
      cleanup();
      setState('idle');
      const msg =
        err instanceof Error
          ? err.name === 'NotAllowedError'
            ? 'Microphone access denied. Please allow microphone permission.'
            : err.message
          : 'Failed to start recording';
      setError(msg);
      throw new Error(msg);
    }
  }, [state, cleanup]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    cleanup();
    setState('idle');
  }, [cleanup]);

  return { state, startRecording, cancel, level, error };
}

// ─── Blob → base64 ───────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read audio'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read audio'));
    reader.readAsDataURL(blob);
  });
}

// ─── TTS playback ────────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;

/** Stop any in-flight Oracle speech. */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

/** Whether Oracle is currently speaking. */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * Speak the given text via the TTS API. Chunks text into ≤900-char segments
 * (sentence-aware) to stay under the 1024-char API limit, then plays them
 * sequentially. Resolves when all chunks have finished playing (or on stop).
 */
export async function speakOracleResponse(
  text: string,
  opts?: { voice?: string; speed?: number; onChunkStart?: (idx: number, total: number) => void; onEnd?: () => void },
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    opts?.onEnd?.();
    return;
  }

  stopSpeaking();
  const chunks = chunkText(trimmed, 900);
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    // If stopSpeaking() was called mid-loop, bail out.
    if (!currentAudio && i > 0) break;

    opts?.onChunkStart?.(i, total);

    try {
      const res = await fetch('/api/oracle/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunks[i],
          voice: opts?.voice ?? 'tongtong',
          speed: opts?.speed ?? 1.0,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `TTS failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          reject(new Error('Audio playback failed'));
        };
        audio.play().catch((e) => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          reject(e);
        });
      });
    } catch {
      // If a chunk fails, stop the whole playback rather than continuing.
      currentAudio = null;
      break;
    }
  }

  currentAudio = null;
  opts?.onEnd?.();
}

// ─── Sentence-aware text chunker ─────────────────────────────────────────────

function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  // Split on sentence boundaries, keeping the delimiter.
  const sentences = text.match(/[^.!?।]+[.!?।]+(\s+|$)|[^.!?।]+$/g) ?? [text];

  let current = '';
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if ((current + ' ' + s).length <= maxLength) {
      current = current ? current + ' ' + s : s;
    } else {
      if (current) chunks.push(current);
      // If a single sentence exceeds the limit, hard-split it.
      if (s.length > maxLength) {
        for (let i = 0; i < s.length; i += maxLength) {
          chunks.push(s.slice(i, i + maxLength));
        }
        current = '';
      } else {
        current = s;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
