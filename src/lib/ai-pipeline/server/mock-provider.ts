// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — MockGenProvider (SERVER-ONLY)
//
// The default provider. Produces DETERMINISTIC, realistic-looking AI content
// seeded by the prompt — the same prompt always returns the same output. This
// lets the UI feel real without ever calling a real AI API (no API key needed,
// no cost, no rate limits).
//
// Simulates realistic behavior:
//   • Progress callbacks fired at intervals (for image/video)
//   • Random ~5% failure rate (to exercise the retry system)
//   • Respects CancelSignal (aborts early if cancelled)
//   • Variable processing time (text=fast, image=medium, video=slow)
//
// When you're ready to go live: set `AI_PROVIDER=official` in env, configure
// `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` etc., and the registry will swap to
// FutureOfficialGenProvider → real production calls.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { IGenProvider, CancelSignal, ProgressCallback } from '../provider';
import type {
  GenAssetType,
  GenJobInput,
  GenJobOutput,
  GenJobStatusReason,
  GenProviderName,
} from '../types';
import {
  InvalidInputError,
  ProviderUnavailableError,
  ValidationError,
} from '../errors';

// ─── Deterministic PRNG (seeded by prompt) ───────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  return crypto.createHash('sha1').update(input).digest().readUInt32LE(0);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const ASSET_TYPE_DEFAULT_MODELS: Record<GenAssetType, string> = {
  text: 'mock-text-pro',
  image: 'mock-image-v2',
  video: 'mock-video-1',
  audio: 'mock-audio-v1',
  code: 'mock-code-pro',
  structured: 'mock-structured-v1',
};

const PROCESSING_TIMES_MS: Record<GenAssetType, [number, number]> = {
  text: [800, 2000],
  code: [1000, 2500],
  structured: [800, 1800],
  image: [2000, 5000],
  audio: [2500, 6000],
  video: [4000, 9000],
};

// ─── Mock content generators ─────────────────────────────────────────────────

function generateTextContent(rng: () => number, input: GenJobInput): string {
  const prompt = input.prompt.trim();
  const hook = pick(rng, [
    `Here's a take on "${prompt.slice(0, 60)}":`,
    `Let me break down "${prompt.slice(0, 60)}":`,
    `On the topic of "${prompt.slice(0, 60)}":`,
  ]);
  const body1 = pick(rng, [
    'First, the fundamentals matter more than the buzz. Strip away the hype and you find a simple truth: consistency beats intensity, every single time.',
    'The opportunity is real, but the timing is what separates winners from spectators. Those who move now will compound their advantage for years.',
    'Most people overestimate what they can do in a day and underestimate what they can do in a year. Start small, ship often, iterate relentlessly.',
  ]);
  const body2 = pick(rng, [
    'The trap is treating this as a one-time decision. It isn\'t. It\'s a system — a daily practice of small choices that compound into outsized results.',
    'What looks like luck from the outside is almost always preparation meeting opportunity. The work happens before the moment, not during it.',
    'Don\'t optimize for the average case. Optimize for the worst case, and the average takes care of itself.',
  ]);
  const close = pick(rng, [
    'That\'s the playbook. Now go execute.',
    'The rest is just reps.',
    'Your move.',
  ]);
  return `${hook}\n\n${body1}\n\n${body2}\n\n${close}`;
}

function generateCodeContent(rng: () => number, input: GenJobInput): string {
  const prompt = input.prompt.toLowerCase();
  if (prompt.includes('react') || prompt.includes('component')) {
    return `// Generated React component
import { useState } from 'react';

interface Props {
  title: string;
  onAction?: () => void;
}

export function GeneratedComponent({ title, onAction }: Props) {
  const [active, setActive] = useState(false);
  return (
    <div className="p-4 rounded-lg border">
      <h3 className="text-lg font-semibold">{title}</h3>
      <button
        onClick={() => { setActive(!active); onAction?.(); }}
        className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
      >
        {active ? 'Active' : 'Inactive'}
      </button>
    </div>
  );
}`;
  }
  if (prompt.includes('api') || prompt.includes('endpoint')) {
    return `// Generated API route
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: validate input
    // TODO: persist to database
    return NextResponse.json({ ok: true, data: body }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}`;
  }
  return `// Generated code for: ${input.prompt}
function solve(input: string): string {
  // Mock implementation — replace with real logic
  const result = input.split('').reverse().join('');
  return result;
}

export { solve };`;
}

function generateStructuredContent(rng: () => number, input: GenJobInput): string {
  return JSON.stringify(
    {
      mock: true,
      prompt: input.prompt,
      generated_at: new Date().toISOString(),
      items: Array.from({ length: randInt(rng, 3, 6) }, (_, i) => ({
        id: i + 1,
        label: pick(rng, ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']),
        score: Math.round(rng() * 100) / 100,
      })),
    },
    null,
    2,
  );
}

function generateImageContent(rng: () => number, input: GenJobInput): string {
  // Mock — return a placeholder SVG as a data URL so the UI can render it.
  const seed = hashSeed(input.prompt).toString(16).slice(0, 8);
  const hue1 = randInt(rng, 0, 360);
  const hue2 = (hue1 + 60 + randInt(rng, 0, 60)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue1}, 70%, 60%)"/>
      <stop offset="100%" stop-color="hsl(${hue2}, 70%, 40%)"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <text x="256" y="256" font-family="sans-serif" font-size="24" fill="white" text-anchor="middle" opacity="0.8">Mock Image · ${seed}</text>
  <text x="256" y="290" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle" opacity="0.6">${input.prompt.slice(0, 40)}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function generateAudioContent(rng: () => number, input: GenJobInput): string {
  // Mock — return a tiny silent WAV as a data URL so the UI can render an audio player.
  // 1 second of silence, 8kHz, 8-bit mono.
  const sampleRate = 8000;
  const durationSec = 1;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples + 44; // 44-byte WAV header
  const buf = Buffer.alloc(dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + numSamples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(numSamples, 40);
  // 128 = silence in 8-bit unsigned PCM
  buf.fill(128, 44);
  return `data:audio/wav;base64,${buf.toString('base64')}`;
}

function generateVideoContent(rng: () => number, input: GenJobInput): string {
  // Mock — return a placeholder MP4 poster (we can't easily generate a real MP4 here).
  // The UI should treat this as a video URL — in production this would be a
  // signed Firebase Storage URL.
  const seed = hashSeed(input.prompt).toString(16).slice(0, 8);
  return `mock-video://${seed}/${encodeURIComponent(input.prompt.slice(0, 60))}`;
}

function generateContent(rng: () => number, assetType: GenAssetType, input: GenJobInput): {
  content: string;
  contentType: string;
  metadata: Record<string, unknown>;
} {
  switch (assetType) {
    case 'text':
      return { content: generateTextContent(rng, input), contentType: 'text/markdown', metadata: { tokens: randInt(rng, 200, 800) } };
    case 'code':
      return { content: generateCodeContent(rng, input), contentType: 'text/plain', metadata: { language: 'typescript', lines: randInt(rng, 15, 60) } };
    case 'structured':
      return { content: generateStructuredContent(rng, input), contentType: 'application/json', metadata: { schema: 'mock-v1' } };
    case 'image':
      return { content: generateImageContent(rng, input), contentType: 'image/svg+xml', metadata: { width: 512, height: 512, seed: hashSeed(input.prompt) } };
    case 'audio':
      return { content: generateAudioContent(rng, input), contentType: 'audio/wav', metadata: { duration_sec: 1, sample_rate: 8000 } };
    case 'video':
      return { content: generateVideoContent(rng, input), contentType: 'video/mp4', metadata: { duration_sec: 4, resolution: '720p' } };
  }
}

// ─── MockGenProvider ─────────────────────────────────────────────────────────

export class MockGenProvider implements IGenProvider {
  readonly name = 'Mock AI Provider';
  readonly providerName: GenProviderName = 'mock';
  readonly isLive = false;
  readonly supportedAssetTypes: GenAssetType[] = ['text', 'image', 'video', 'audio', 'code', 'structured'];
  readonly defaultModels = ASSET_TYPE_DEFAULT_MODELS;

  async generate(
    input: GenJobInput,
    options: {
      assetType: GenAssetType;
      model: string;
      cancelSignal: CancelSignal;
      onProgress?: ProgressCallback;
    },
  ): Promise<{ output: GenJobOutput; statusReason: GenJobStatusReason }> {
    // Validate input.
    if (!input.prompt || input.prompt.trim().length < 3) {
      throw new ValidationError('Prompt must be at least 3 characters.');
    }
    if (!this.supportedAssetTypes.includes(options.assetType)) {
      throw new InvalidInputError(`Mock provider does not support asset type: ${options.assetType}`);
    }

    const rng = mulberry32(hashSeed(input.prompt + options.assetType + options.model + Date.now()));
    const [minMs, maxMs] = PROCESSING_TIMES_MS[options.assetType];
    const totalMs = randInt(rng, minMs, maxMs);
    const steps = options.assetType === 'text' || options.assetType === 'code' || options.assetType === 'structured'
      ? 1
      : 5; // image / audio / video get 5 progress steps
    const stepMs = totalMs / steps;

    // Simulate progress.
    for (let i = 1; i <= steps; i++) {
      // Check for cancellation before each step.
      if (options.cancelSignal.cancelled) {
        return {
          output: { content: '', contentType: 'text/plain', metadata: { cancelled: true } },
          statusReason: 'cancelled_timeout',
        };
      }
      await sleep(stepMs);
      if (options.onProgress) {
        const percent = Math.round((i / steps) * 100);
        const messages = [
          'Initializing model...',
          'Processing prompt...',
          'Generating content...',
          'Refining output...',
          'Finalizing...',
        ];
        options.onProgress({
          percent,
          message: messages[Math.min(i - 1, messages.length - 1)],
        });
      }
    }

    // Simulate a 5% failure rate (to exercise the retry system).
    if (rng() < 0.05) {
      throw new ProviderUnavailableError(
        'Mock provider simulated a transient failure (5% chance). The job will be retried.',
      );
    }

    // Generate the content.
    const { content, contentType, metadata } = generateContent(rng, options.assetType, input);
    const output: GenJobOutput = {
      content,
      contentType,
      metadata: {
        ...metadata,
        provider: 'mock',
        model: options.model,
        generation_id: `mock_${crypto.randomBytes(8).toString('hex')}`,
      },
      costUsdCents: 0, // mock is free
    };

    return { output, statusReason: 'success' };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
