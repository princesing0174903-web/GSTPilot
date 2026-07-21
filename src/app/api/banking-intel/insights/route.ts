import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/insights — answer a free-text banking question
// Body: { orgId?, question: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { question } = body ?? {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { ok: false, error: 'question (string) is required' },
        { status: 400 },
      );
    }

    const service = await getBankingService();
    const answer = await service.answerQuestion(orgId, question.trim());
    return NextResponse.json({ ok: true, answer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/insights POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
