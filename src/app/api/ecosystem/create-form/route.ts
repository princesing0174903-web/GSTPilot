// POST /api/ecosystem/create-form
// Create a low-code form. Real schema persisted. Audit-logged.

import { NextResponse } from 'next/server';
import { createForm } from '@/lib/ecosystem/lowcode';
import { resolveOrgId } from '@/lib/ecosystem/org-resolver';
import { invalidateEcosystemCache } from '@/lib/ecosystem/orchestrator';
import { logApiUsage } from '@/lib/ecosystem/api-gateway';
import type { FormField } from '@/lib/ecosystem/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const title: string = body.title ?? '';
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    const schema: FormField[] = Array.isArray(body.schema) ? body.schema : [];

    const organizationId = await resolveOrgId(body.organizationId);
    const form = await createForm({
      organizationId,
      title,
      description: body.description,
      schema,
      createdBy: body.createdBy,
    });
    invalidateEcosystemCache();

    await logApiUsage({
      organizationId,
      endpoint: '/api/ecosystem/create-form',
      method: 'POST',
      statusCode: 201,
      responseMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, form },
      { status: 201, headers: { 'X-Ecosystem': 'true' } },
    );
  } catch (error) {
    console.error('[Ecosystem create-form] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create form', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
