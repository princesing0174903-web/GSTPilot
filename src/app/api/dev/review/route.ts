// POST /api/dev/review — AI Code Review
import { NextResponse } from 'next/server';
import { reviewProject } from '@/lib/software-factory/engine';
import type { ReviewRequest } from '@/lib/software-factory/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReviewRequest;
    if (!body.projectId) {
      return NextResponse.json({ ok: false, error: 'projectId is required.' }, { status: 400 });
    }
    const review = await reviewProject({ projectId: body.projectId, reviewType: body.reviewType });
    return NextResponse.json({ ok: true, review });
  } catch (err) {
    console.error('[/api/dev/review]', err);
    return NextResponse.json({ ok: false, error: 'Review failed — see server logs.' }, { status: 500 });
  }
}
