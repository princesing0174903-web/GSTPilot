// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — DECISION IMPACT ENGINE™ API
// POST /api/twin/simulate      — simulate a decision's impact
// GET  /api/twin/simulate      — return pre-built decision templates for the UI
//
// Before any action, Oracle simulates the impact. Given a decision request
// (type + label + params), the engine projects:
//   • Cash / Profit / GST impact (monthly)
//   • Risk / Working Capital / Health deltas (signed)
//   • Projected cash, profit, health, risk, runway
//   • Recommendation (go | caution | hold | avoid) + reason + conditions + actions
//
// POST body shape:
//   {
//     "type": "hire_employees" | "open_office" | "increase_salaries" |
//             "buy_equipment" | "take_loan" | "increase_marketing" |
//             "expand_city" | "custom",
//     "label": "Hire 5 employees",
//     "params": { ... }
//   }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { simulateDecision, DECISION_TEMPLATES } from '@/lib/twin/decision-impact';
import type { DecisionRequest, DecisionType } from '@/lib/twin/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TWIN_TAGLINE =
  'GSTPilot Digital Twin™ — Remember Everything. Understand Everything. Simulate Everything. Predict Everything.';

const VALID_TYPES: DecisionType[] = [
  'hire_employees',
  'open_office',
  'increase_salaries',
  'buy_equipment',
  'take_loan',
  'increase_marketing',
  'expand_city',
  'custom',
];

// ─── GET — pre-built decision templates for the UI ───────────────────────────

export async function GET() {
  try {
    return NextResponse.json(
      { templates: DECISION_TEMPLATES },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Digital-Twin': 'true',
          'X-Digital-Twin-Endpoint': 'templates',
        },
      },
    );
  } catch (error) {
    console.error('[Digital-Twin-Simulate-GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load decision templates',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}

// ─── POST — simulate a decision's impact ─────────────────────────────────────

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid JSON body',
          message: 'Request body must be valid JSON containing { type, label, params }.',
          tagline: TWIN_TAGLINE,
        },
        { status: 400 },
      );
    }

    // Validate required fields
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).type !== 'string' ||
      typeof (body as Record<string, unknown>).label !== 'string'
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'Body must include { type: string, label: string, params?: object }.',
          tagline: TWIN_TAGLINE,
        },
        { status: 400 },
      );
    }

    const req = body as DecisionRequest;
    if (!VALID_TYPES.includes(req.type)) {
      return NextResponse.json(
        {
          error: `Invalid decision type '${req.type}'`,
          message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
          tagline: TWIN_TAGLINE,
        },
        { status: 400 },
      );
    }

    if (!req.label.trim()) {
      return NextResponse.json(
        {
          error: 'Invalid label',
          message: 'Label must be a non-empty string.',
          tagline: TWIN_TAGLINE,
        },
        { status: 400 },
      );
    }

    // Ensure params exists (default to empty object)
    const normalizedReq: DecisionRequest = {
      type: req.type,
      label: req.label,
      params: req.params || {},
    };

    const impact = await simulateDecision(normalizedReq);

    return NextResponse.json(impact, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Digital-Twin': 'true',
        'X-Digital-Twin-Endpoint': 'simulate',
        'X-Decision-Type': req.type,
        'X-Decision-Recommendation': impact.recommendation,
      },
    });
  } catch (error) {
    console.error('[Digital-Twin-Simulate-POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to simulate decision impact',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: TWIN_TAGLINE,
      },
      { status: 500 },
    );
  }
}
