// POST /api/oracle/route — Multi-Model AI Router™ explicit routing
// Returns the chosen model for a given request without executing the call.
import { NextRequest, NextResponse } from 'next/server';
import { chooseModel } from '@/lib/oracle-core/router';
import type { ModelPurpose, ModelTier, AIProvider } from '@/lib/oracle-core/types';

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const purpose = (body.purpose || 'reasoning') as ModelPurpose;
  const tier = body.tier as ModelTier | undefined;
  const inputTokensEstimate = body.inputTokensEstimate || 1000;
  const longContext = body.longContext ?? false;
  const requiresVision = body.requiresVision ?? false;
  const requiresVoice = body.requiresVoice ?? false;
  const preferredProvider = body.preferredProvider as AIProvider | undefined;

  try {
    const choice = chooseModel({
      purpose,
      tier,
      inputTokensEstimate,
      longContext,
      requiresVision,
      requiresVoice,
      preferredProvider,
    });

    return NextResponse.json({
      choice,
      request: {
        purpose,
        tier,
        inputTokensEstimate,
        longContext,
        requiresVision,
        requiresVoice,
        preferredProvider,
      },
      estimatedCostUsd:
        Math.round((choice.costPer1kUsd * inputTokensEstimate / 1000) * 10000) / 10000,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
