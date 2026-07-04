import { NextRequest } from 'next/server';
import { getSecurityStats, getRecentAudit } from '@/lib/intelligence/security';
import { jsonResponse, errorResponse, auditRequest } from '@/lib/intelligence/api-helpers';

// GET /api/intelligence/audit — Security & audit log for the Global Data Intelligence Cloud™
// Query params: ?limit=<n>
export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const [stats, recent] = await Promise.all([
      getSecurityStats(),
      getRecentAudit(limit),
    ]);

    auditRequest({
      endpoint: '/api/intelligence/audit',
      method: 'GET',
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    return jsonResponse({ stats, recent, total: recent.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audit log retrieval failed';
    auditRequest({
      endpoint: '/api/intelligence/audit',
      method: 'GET',
      statusCode: 500,
      durationMs: Date.now() - start,
      errorMessage: message,
    });
    return errorResponse(message);
  }
}
