import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveDefaultTenantId } from '@/lib/app-platform/registry';

/** POST /api/apps/review — create a review for an app. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, rating, title, comment, reviewerName } = body;

    if (!appId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'appId and rating (1-5) are required' },
        { status: 400 },
      );
    }

    const app = await db.app.findUnique({ where: { id: appId } });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    let tenantId: string | null = null;
    try {
      tenantId = await resolveDefaultTenantId();
    } catch {
      // No tenant — still allow the review
    }

    const review = await db.appReview.create({
      data: {
        appId,
        reviewerName: reviewerName ?? 'Anonymous Reviewer',
        reviewerTenantId: tenantId,
        rating: Math.round(rating),
        title: title ?? null,
        comment: comment ?? null,
        verifiedPurchase: true,
        status: 'published',
      },
    });

    // Update the app's aggregate rating + review count
    const allReviews = await db.appReview.findMany({ where: { appId, status: 'published' } });
    const newRating = allReviews.length > 0
      ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10
      : 0;
    await db.app.update({
      where: { id: appId },
      data: { rating: newRating, reviewCount: allReviews.length },
    });

    return NextResponse.json({
      review: {
        id: review.id, appId: review.appId,
        reviewerName: review.reviewerName, rating: review.rating,
        title: review.title, comment: review.comment,
        verifiedPurchase: review.verifiedPurchase,
        createdAt: review.createdAt.toISOString(),
      },
      success: true,
    });
  } catch (error) {
    console.error('[API /apps/review POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create review' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
