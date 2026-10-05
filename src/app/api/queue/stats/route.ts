/**
 * GET /api/queue/stats — admin-only snapshot of TaskQueue stats.
 *
 * Auth: shared-secret via `x-admin-token` header compared to
 * `process.env.ADMIN_TOKEN`. If the env var is unset:
 *   - In dev / test (NODE_ENV !== "production") → allowed.
 *   - In production → 403.
 */

import { NextResponse } from "next/server";
import { getTaskQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const expectedToken = process.env.ADMIN_TOKEN;
    const providedToken = request.headers.get("x-admin-token");

    if (expectedToken) {
      if (!providedToken || providedToken !== expectedToken) {
        return NextResponse.json(
          { error: "unauthorized", message: "invalid or missing admin token" },
          { status: 401 },
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "forbidden", message: "ADMIN_TOKEN not configured in production" },
        { status: 403 },
      );
    }
    // Dev / test with no ADMIN_TOKEN set → allow (for local debugging).

    // ── Stats ───────────────────────────────────────────────────────────────
    const queue = getTaskQueue();
    const stats = queue.getStats();

    return NextResponse.json(
      {
        ok: true,
        stats,
        timestamp: Date.now(),
      },
      { status: 200 },
    );
  } catch (err) {
     
    console.error("[/api/queue/stats] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
