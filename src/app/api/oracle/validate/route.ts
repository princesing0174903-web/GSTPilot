// POST /api/oracle/validate — AI Accuracy validation layer
// Validates an Oracle answer for hallucinations, GST errors, missing citations.
import { NextRequest, NextResponse } from 'next/server';
import { validateAnswer, factCheckClaim, type ValidationContext } from '@/lib/oracle-evolution/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const answer = body.answer as string;
    const ctx = (body.context ?? {}) as ValidationContext;
    const originalConfidence = typeof body.confidence === 'number' ? body.confidence : 0.85;

    if (!answer || typeof answer !== 'string') {
      return NextResponse.json({ error: 'answer is required' }, { status: 400 });
    }

    // If a specific claim is requested for fact-checking
    if (body.claim && typeof body.claim === 'string') {
      const factCheck = factCheckClaim(body.claim, ctx);
      return NextResponse.json({ factCheck });
    }

    const result = validateAnswer(answer, ctx, originalConfidence);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
