// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Speech-to-Text API (Phase 2 — Human Intelligence™)
//
// Transcribes the user's spoken audio so they can *talk* to Oracle — like
// ChatGPT Voice / Claude Voice. Supports Indian English, Hindi, and other
// common Indian languages via the ASR service.
//
// Request:  POST { audio: string (base64, with or without data-URI prefix) }
// Response: { text: string }
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { NextResponse } from 'next/server';

const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 MB safety cap

function stripDataUri(base64: string): string {
  // "data:audio/wav;base64,AAAA..." → "AAAA..."
  const commaIdx = base64.indexOf(',');
  if (commaIdx > 0 && commaIdx < 100 && base64.slice(0, commaIdx).includes('base64')) {
    return base64.slice(commaIdx + 1);
  }
  return base64;
}

export async function POST(request: Request): Promise<Response> {
  // Reject oversized payloads early.
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Audio payload too large (max 20 MB)' }, { status: 413 });
  }

  let body: { audio?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = typeof body.audio === 'string' ? body.audio.trim() : '';
  if (raw.length === 0) {
    return NextResponse.json({ error: 'audio (base64) is required' }, { status: 400 });
  }

  const base64Audio = stripDataUri(raw);

  try {
    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({
      file_base64: base64Audio,
    });

    const text = (response as { text?: string }).text ?? '';
    return NextResponse.json({ text: text.trim() }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ASR transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
