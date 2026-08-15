import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getCollectionsState, sendReminders, detectOverdue, markRecovered } from '@/lib/banking/collections';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const state = await getCollectionsState();
    return NextResponse.json(state);
  } catch (err) {
    return friendlyApiError(err, 'Failed to load collections state.');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || (body.organizationId as string | undefined) || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const action = body.action || 'remind';

    if (action === 'detect') {
      const result = await detectOverdue();
      return NextResponse.json({
        success: true,
        ...result,
        message: `I've detected ${result.detected} new overdue invoices.`,
      });
    }
    if (action === 'recover' && body.id) {
      const result = await markRecovered(body.id, body.amount || 0);
      return NextResponse.json({
        success: true,
        ...result,
        message: "I've marked this collection as recovered.",
      });
    }
    // Default: send reminders.
    const result = await sendReminders({ stage: body.stage });
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've scheduled collections recovery — reminders sent to ${result.sent} clients via ${result.channel}.`,
    });
  } catch (err) {
    return friendlyApiError(err, 'Failed to process collections action.');
  }
}
