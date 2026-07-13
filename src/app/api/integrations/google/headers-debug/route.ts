// TEMPORARY diagnostic endpoint — dumps ALL request headers.
// Will be deleted after diagnosis. NOT part of OAuth flow.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const allHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    allHeaders[key] = value;
  });
  return NextResponse.json({
    ok: true,
    method: req.method,
    url: req.url,
    headers: allHeaders,
  });
}
