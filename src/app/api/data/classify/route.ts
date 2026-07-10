// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/data/classify
//   Body: { datasetKey: string, sensitivity: SensitivityLevel }
// Upserts a Data Governance™ classification policy on a specific dataset using
// REAL production data. Returns the resulting policy.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { classifyDataset } from '@/lib/data-intelligence';

const VALID_SENSITIVITIES = new Set([
  'public',
  'internal',
  'confidential',
  'restricted',
  'pii',
  'financial',
]);

type SensitivityLevel =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pii'
  | 'financial';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { datasetKey, sensitivity } = body as {
      datasetKey?: unknown;
      sensitivity?: unknown;
    };

    if (typeof datasetKey !== 'string' || datasetKey.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing datasetKey' },
        { status: 400 },
      );
    }

    if (
      typeof sensitivity !== 'string' ||
      !VALID_SENSITIVITIES.has(sensitivity)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid sensitivity; expected one of public|internal|confidential|restricted|pii|financial',
        },
        { status: 400 },
      );
    }

    const policy = await classifyDataset(
      datasetKey.trim(),
      sensitivity as SensitivityLevel,
    );

    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    console.error('[data-intelligence/classify][POST] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to classify dataset';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
