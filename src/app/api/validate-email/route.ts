import { NextRequest, NextResponse } from "next/server";
import { resolveMx } from "dns/promises";
import { validateEmailFormat, isDisposableEmail } from "@/lib/email-validation";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/validate-email?email=user@example.com
//
// Performs REAL email validation:
//   1. RFC 5322 format check (client-side too, but double-check here)
//   2. Disposable domain check
//   3. DNS MX record lookup — verifies the domain actually accepts email
//      (this is what "should present in world" means — the domain must have
//       a registered mail server)
//
// Returns:
//   {
//     valid: boolean,        // true only if format OK + not disposable + MX exists
//     format: boolean,       // regex passed
//     disposable: boolean,   // domain is in disposable blocklist
//     mx: boolean,           // DNS MX record found
//     reason?: string        // human-readable failure reason
//   }
// ═══════════════════════════════════════════════════════════════════════════

// Simple in-memory cache (1 hour TTL) to avoid hammering DNS for the same domain.
// Keyed by domain (not full email) — MX records don't depend on local part.
const mxCache = new Map<string, { mx: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { valid: false, format: false, disposable: false, mx: false, reason: "Email is required" },
      { status: 400 }
    );
  }

  // Step 1: Format check
  const formatCheck = validateEmailFormat(email);
  if (!formatCheck.valid) {
    return NextResponse.json({
      valid: false,
      format: formatCheck.format,
      disposable: formatCheck.disposable,
      mx: false,
      reason: formatCheck.reason,
    });
  }

  const domain = email.split("@")[1]!.toLowerCase();

  // Step 2: Disposable check (validateEmailFormat already does this, but be explicit)
  const disposable = isDisposableEmail(email);
  if (disposable) {
    return NextResponse.json({
      valid: false,
      format: true,
      disposable: true,
      mx: false,
      reason: "Disposable email providers are not allowed. Please use a real email address.",
    });
  }

  // Step 3: DNS MX record lookup (cached)
  let mx = false;
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    mx = cached.mx;
  } else {
    try {
      const records = await resolveMx(domain);
      mx = Array.isArray(records) && records.length > 0;
    } catch {
      // ENOTFOUND / ENODATA → no MX record
      mx = false;
    }
    mxCache.set(domain, { mx, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  const valid = formatCheck.valid && !disposable && mx;
  const reason = !mx
    ? "Email domain does not exist (no mail server found). Please check for typos."
    : undefined;

  return NextResponse.json({
    valid,
    format: true,
    disposable: false,
    mx,
    reason,
  });
}
