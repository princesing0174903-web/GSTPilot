import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** GET /api/apps/reviews?appId=X — list reviews for an app. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    if (!appId) {
      return NextResponse.json({ error: 'appId query parameter is required' }, { status: 400 });
    }

    const reviews = await db.appReview.findMany({
      where: { appId, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const result = reviews.map((r) => ({
      id: r.id, appId: r.appId,
      reviewerUserId: r.reviewerUserId, reviewerName: r.reviewerName,
      rating: r.rating, title: r.title, comment: r.comment,
      helpfulCount: r.helpfulCount, verifiedPurchase: r.verifiedPurchase,
      developerReply: r.developerReply, repliedAt: r.repliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const avgRating = result.length > 0
      ? Math.round((result.reduce((s, r) => s + r.rating, 0) / result.length) * 10) / 10
      : 0;

    return NextResponse.json({ reviews: result, total: result.length, avgRating });
  } catch (error) {
    console.error('[API /apps/reviews] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reviews' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
