import { NextRequest, NextResponse } from 'next/server';
import { publishApp } from '@/lib/app-platform/registry';
import type { AppPermission, AppType } from '@/lib/app-platform/types';

/** POST /api/apps/publish — publish a new app to the marketplace. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      developerId, slug, name, tagline, description, type, category,
      version, color, pricingModel, priceAmount, billingInterval,
      permissions, releaseNotes, features, supportEmail, supportUrl,
      homepageUrl, repositoryUrl, license, verified,
    } = body;

    if (!developerId || !slug || !name || !description || !type || !category) {
      return NextResponse.json(
        { error: 'developerId, slug, name, description, type, category are required' },
        { status: 400 },
      );
    }

    const app = await publishApp({
      developerId, slug, name, tagline, description,
      type: type as AppType, category, version, color,
      pricingModel, priceAmount, billingInterval,
      permissions: permissions as AppPermission[],
      releaseNotes, features, supportEmail, supportUrl,
      homepageUrl, repositoryUrl, license, verified,
    });

    return NextResponse.json({ app, success: true });
  } catch (error) {
    console.error('[API /apps/publish] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish app' },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
