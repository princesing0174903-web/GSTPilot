// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Read-Aloud (TTS) API
// POST /api/oracle/speak  → { text } → audio/wav Response
//
// Splits long text into ≤1000-char chunks at sentence boundaries, synthesizes
// each, and concatenates the WAV buffers into a single stream. Returns
// audio/wav. On any failure returns a short silent clip so the UI's <audio>
// element doesn't throw.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

function splitTextIntoChunks(text: string, maxLen = 1000): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean ? [clean] : [];
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length <= maxLen) {
      cur += s;
    } else {
      if (cur) chunks.push(cur.trim());
      // If a single sentence exceeds maxLen, hard-split it.
      if (s.length > maxLen) {
        for (let i = 0; i < s.length; i += maxLen) {
          chunks.push(s.slice(i, i + maxLen).trim());
        }
        cur = '';
      } else {
        cur = s;
      }
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

/** Minimal WAV header writer for PCM (mono, 24kHz, 16-bit) concatenation. */
function writeWavHeader(dataLength: number): Buffer {
  const buffer = Buffer.alloc(44);
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const channels = 1;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 });
    }

    const chunks = splitTextIntoChunks(text, 1000);
    const zai = await ZAI.create();

    const pcmChunks: Buffer[] = [];
    for (const chunk of chunks) {
      try {
        const response = await zai.audio.tts.create({
          input: chunk,
          voice: 'tongtong',
          speed: 1.0,
          response_format: 'wav',
          stream: false,
        });
        const arrayBuffer = await response.arrayBuffer();
        const buf = Buffer.from(new Uint8Array(arrayBuffer));
        // Strip the 44-byte WAV header to keep only PCM for concatenation.
        const pcm = buf.length > 44 ? buf.subarray(44) : buf;
        pcmChunks.push(pcm);
      } catch {
        /* skip failed chunk — continue with the rest */
      }
    }

    if (pcmChunks.length === 0) {
      // Return a silent 0.1s WAV so the audio element doesn't error.
      const silent = Buffer.alloc(44 + 2400); // 0.1s @ 24kHz 16-bit mono
      writeWavHeader(2400).copy(silent, 0);
      return new NextResponse(silent, {
        status: 200,
        headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache' },
      });
    }

    const pcmTotal = Buffer.concat(pcmChunks);
    const wav = Buffer.concat([writeWavHeader(pcmTotal.length), pcmTotal]);
    return new NextResponse(wav, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wav.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not generate audio.' },
      { status: 200 },
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
