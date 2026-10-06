import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const existingByKey = await db.user.findFirst({
      where: { avatar: 'github:12345' },
    });
    
    return NextResponse.json({ ok: true, existingByKey });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message, stack: error.stack });
  }
}
