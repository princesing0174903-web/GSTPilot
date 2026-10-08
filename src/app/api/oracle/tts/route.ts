// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Text-to-Speech API (Phase 2 — Human Intelligence™)
//
// Converts Oracle's text response into natural-sounding speech so the user
// can *listen* to Oracle — like ChatGPT Voice / Claude Voice.
//
// Request:  POST { text, voice?, speed? }
//   • text   — the text to speak (max 1024 chars per the TTS API limit;
//              longer text is chunked client-side by the caller)
//   • voice  — one of: tongtong (warm, default), xiaochen (calm/professional),
//              jam (English gentleman). Default: tongtong.
//   • speed  — 0.5 to 2.0. Default 1.0.
//
// Response: audio/wav binary stream.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { NextResponse } from 'next/server';

const MAX_INPUT_LENGTH = 1024;

const ALLOWED_VOICES = new Set(['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo']);

function clampSpeed(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '1'));
  if (!Number.isFinite(n)) return 1.0;
  return Math.min(2.0, Math.max(0.5, n));
}

export async function POST(request: Request): Promise<Response> {
  let body: { text?: unknown; voice?: unknown; speed?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length === 0) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Truncate to the API limit (the client is expected to chunk longer text).
  const safeText = text.length > MAX_INPUT_LENGTH ? text.slice(0, MAX_INPUT_LENGTH) : text;

  const voice = typeof body.voice === 'string' && ALLOWED_VOICES.has(body.voice) ? body.voice : 'tongtong';
  const speed = clampSpeed(body.speed);

  try {
    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: safeText,
      voice,
      speed,
      response_format: 'wav',
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
