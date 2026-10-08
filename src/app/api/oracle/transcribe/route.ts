// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Voice Input (ASR) API
// POST /api/oracle/transcribe  → multipart "audio" (webm/wav/mp3) → { text }
//
// Used by VEYRO AI workspace's microphone button. Records in the browser via
// MediaRecorder, uploads the blob, and gets back plain text which fills the
// prompt input. Reliability: any failure returns a graceful empty text so the
// UI never shows a raw error.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ ok: false, error: 'audio required' }, { status: 400 });
    }
    if (audio.size > 20 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Audio too large' }, { status: 413 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const base64 = buffer.toString('base64');

    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({ file_base64: base64 });
    const text = (response?.text ?? '').trim();
    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json(
      { ok: false, text: '', error: 'Could not transcribe audio. Please try typing instead.' },
      { status: 200 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
