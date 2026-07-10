import { NextResponse } from 'next/server';
import { AI_EMPLOYEE_APPS } from '@/lib/app-platform/types';

/** GET /api/app-platform/ai-employees — 12 specialized AI employee definitions. */
export async function GET() {
  try {
    return NextResponse.json({
      aiEmployees: AI_EMPLOYEE_APPS,
      total: AI_EMPLOYEE_APPS.length,
      autoConnectEngines: ['ai_ceo', 'ai_workforce', 'digital_twin', 'business_graph', 'automation', 'knowledge_graph'],
    });
  } catch (error) {
    console.error('[API /app-platform/ai-employees] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AI employees' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
