// POST /api/dev/generate — Natural Language App Builder
// Oracle™ matches a prompt to a template, tailors it to the firm's REAL business
// data, and creates a full project spec + collaboration pipeline.
import { NextResponse } from 'next/server';
import { generateProject } from '@/lib/software-factory/engine';
import type { GenerateRequest } from '@/lib/software-factory/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;
    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length < 2) {
      return NextResponse.json({ ok: false, error: 'A natural-language prompt is required (min 2 chars).' }, { status: 400 });
    }
    const result = await generateProject({ prompt: body.prompt.trim(), appType: body.appType, stack: body.stack });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[/api/dev/generate]', err);
    return NextResponse.json({ ok: false, error: 'Generation failed — see server logs.' }, { status: 500 });
  }
}
