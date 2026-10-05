import { NextRequest } from 'next/server';
import { getFeedSummary, listFeedItems, generateDailyFeed, markFeedItemRead } from '@/lib/intelligence/feed';
import { jsonResponse, errorResponse, auditRequest } from '@/lib/intelligence/api-helpers';

// GET /api/intelligence/feed — Enterprise Insight Feed™ items
// Query params: ?limit=<n>&unreadOnly=1&regenerate=1
export async function GET(req: NextRequest) {
  const start = Date.now();
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const unreadOnly = searchParams.get('unreadOnly') === '1';
    const regenerate = searchParams.get('regenerate') === '1';

    if (regenerate) {
      await generateDailyFeed().catch(() => {});
    }

    const [summary, items] = await Promise.all([
      getFeedSummary(),
      listFeedItems(limit, unreadOnly),
    ]);

    auditRequest({
      endpoint: '/api/intelligence/feed',
      method: 'GET',
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    return jsonResponse({ summary, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed retrieval failed';
    auditRequest({
      endpoint: '/api/intelligence/feed',
      method: 'GET',
      statusCode: 500,
      durationMs: Date.now() - start,
      errorMessage: message,
    });
    return errorResponse(message);
  }
}

// PATCH /api/intelligence/feed — Mark a feed item as read
// Body: { id: string }
export async function PATCH(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { id } = body as { id?: string };

    if (!id) {
      return errorResponse('id is required', 400);
    }

    await markFeedItemRead(id);

    auditRequest({
      endpoint: '/api/intelligence/feed',
      method: 'PATCH',
      statusCode: 200,
      durationMs: Date.now() - start,
    });

    return jsonResponse({ ok: true, id, read: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Feed item update failed';
    auditRequest({
      endpoint: '/api/intelligence/feed',
      method: 'PATCH',
      statusCode: 500,
      durationMs: Date.now() - start,
      errorMessage: message,
    });
    return errorResponse(message);
  }
}
