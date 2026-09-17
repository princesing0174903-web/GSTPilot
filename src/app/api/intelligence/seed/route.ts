import { NextResponse } from 'next/server';
import { seedGlobalIntelligenceCloud } from '@/lib/intelligence/orchestrator';
import { jsonResponse, errorResponse, auditRequest } from '@/lib/intelligence/api-helpers';

// POST /api/intelligence/seed — Seed the entire Global Data Intelligence Cloud™
// (idempotent — harvests real org metrics, computes benchmarks, seeds market
// indicators + knowledge graph + industry profiles, generates feed + recommendations)
export async function POST() {
  const start = Date.now();
  try {
    const result = await seedGlobalIntelligenceCloud();

    auditRequest({
      endpoint: '/api/intelligence/seed',
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    return jsonResponse({
      ok: true,
      message: 'Global Data Intelligence Cloud™ seeded successfully from REAL production data.',
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seeding failed';
    auditRequest({
      endpoint: '/api/intelligence/seed',
      method: 'POST',
      statusCode: 500,
      durationMs: Date.now() - start,
      errorMessage: message,
    });
    return errorResponse(message);
  }
}
