// POST /api/ecosystem/submit-form
// Submit a low-code form (public endpoint). Persists submission, increments
// counter, and triggers any form.submitted workflows. Audit-logged.

import { NextResponse } from 'next/server';
import { submitForm } from '@/lib/ecosystem/lowcode';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const formId: string = body.formId ?? '';
    const data: Record<string, unknown> = body.data ?? {};
    if (!formId) return NextResponse.json({ error: 'formId is required' }, { status: 400 });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const result = await submitForm({
      formId,
      data,
      submitterEmail: body.submitterEmail,
      submitterIp: ip,
    });
    invalidateEcosystemCache();

    await logApiUsage({
      endpoint: '/api/ecosystem/submit-form',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
      ipAddress: ip ?? undefined,
    });

    return NextResponse.json(
      { success: true, submission: result.submission, triggeredWorkflows: result.triggeredWorkflows },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem submit-form] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit form', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
