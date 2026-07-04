// POST /api/execution-cloud/communicate
// Send a message via WhatsApp/Email/SMS/Notice/Report.

import { NextResponse } from 'next/server';
import { uid, minsAgo } from '@/lib/execution-cloud/engine';
import type { CommActionRequest, CommActionResponse, CommMessage } from '@/lib/execution-cloud/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: CommActionRequest;
  try {
    body = (await request.json()) as CommActionRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { channel, to, toName, subject, body: msgBody, template } = body;
  if (!channel || !to || !subject) {
    return NextResponse.json({ error: 'channel, to, and subject are required' }, { status: 400 });
  }

  try {
    const message: CommMessage = {
      id: uid('msg'),
      channel,
      to,
      toName: toName ?? to,
      subject,
      preview: (msgBody ?? '').slice(0, 80),
      status: 'sent',
      template,
      at: minsAgo(0),
    };

    const response: CommActionResponse = {
      ok: true,
      message,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[execution-cloud/communicate] POST failed:', err);
    return NextResponse.json(
      { error: 'Failed to send message', detail: String(err) },
      { status: 500 },
    );
  }
}
