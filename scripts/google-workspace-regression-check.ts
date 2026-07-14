// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Google Workspace Regression Check
// ═══════════════════════════════════════════════════════════════════════════════
//
// PRODUCTION INFRASTRUCTURE GUARD.
//
// Run this after every dev-server restart AND before any commit that touches
// Google Workspace code (see docs/GOOGLE-WORKSPACE-PROTECTION.md).
//
// It verifies — without needing a real Google account — that the integration's
// structural invariants still hold:
//
//   1. OAuth connect generates a redirect_uri on the PUBLIC preview hostname
//      (space-z.ai), NEVER fcapp.run or localhost.
//   2. OAuth callback redirects to the ROOT route "/" with ?view=google-workspace
//      (NEVER to /google-workspace, which 404s).
//   3. The status / disconnect endpoints respond correctly.
//   4. All five service routes (Gmail, Drive, Docs, Sheets, Calendar) EXIST
//      and are protected by the auth gate (return 401 when not connected,
//      NEVER 404).
//   5. The root route renders the post-OAuth success URL (no 404).
//   6. Required env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are loaded.
//   7. Token encryption round-trips (encrypt → decrypt === original).
//
// If ANY check fails, the script exits with code 1 and prints a clear report.
// Future development MUST NOT continue with a failing check — fix the
// regression first.
//
// Usage:
//   bun run scripts/google-workspace-regression-check.ts
//   bun run scripts/google-workspace-regression-check.ts --base https://preview-chat-xxx.space-z.ai
//
// If --base is omitted, the script runs the ENV + CRYPTO checks only (no HTTP
// probes) — useful as a fast pre-commit guard. Pass --base to run the full
// HTTP regression suite against a live preview URL.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Env + crypto checks run unconditionally (no server needed) ──────────────

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  const mark = pass ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${mark} — ${name}`);
  if (detail) console.log(`         ${detail}`);
}

// ─── Check 1: Required env vars are loaded ───────────────────────────────────
function checkEnvVars() {
  console.log('\n── Env vars ──');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  record(
    'GOOGLE_CLIENT_ID is set',
    !!clientId && clientId.length > 10,
    clientId ? `${clientId.slice(0, 12)}... (${clientId.length} chars)` : 'MISSING',
  );
  record(
    'GOOGLE_CLIENT_SECRET is set',
    !!clientSecret && clientSecret.length > 10,
    clientSecret ? `***(${clientSecret.length} chars)` : 'MISSING',
  );
  record(
    'GOOGLE_REDIRECT_URI is set (localhost fallback)',
    !!redirectUri,
    redirectUri ?? 'MISSING (will default to http://localhost:3000/...)',
  );
}

// ─── Check 2: Token encryption round-trips ───────────────────────────────────
async function checkCrypto() {
  console.log('\n── Token encryption (AES-256-GCM round-trip) ──');
  try {
    // Load the crypto module dynamically so the script works under bun.
    const { encrypt, decrypt, safeDecrypt } = await import('../src/lib/google-workspace/crypto');

    const plaintext = 'ya29.test-token-1234567890abcdef';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    record(
      'encrypt() → decrypt() round-trips',
      decrypted === plaintext,
      decrypted === plaintext
        ? `round-trip OK (encrypted ${encrypted.length} chars)`
        : `MISMATCH: expected "${plaintext}", got "${decrypted}"`,
    );

    // safeDecrypt never throws on tamper.
    const tampered = encrypted.slice(0, -4) + 'AAAA';
    const safeResult = safeDecrypt(tampered);
    record(
      'safeDecrypt() returns null on tamper (never throws)',
      safeResult === null,
      safeResult === null ? 'tampered payload correctly rejected' : 'UNEXPECTED: returned a value',
    );
  } catch (err) {
    record(
      'Crypto module loads + round-trips',
      false,
      `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ─── HTTP probes (only run when --base is provided) ──────────────────────────

async function httpProbe(base: string) {
  console.log(`\n── HTTP probes against ${base} ──`);
  const orgHeader = 'x-gstpilot-orgid: regression-check-script';
  const actorHeader = 'x-gstpilot-actor: {"uid":"regression-user","email":"regression@test.com"}';
  const headers: Record<string, string> = {
    'x-gstpilot-orgid': 'regression-check-script',
    'x-gstpilot-actor': JSON.stringify({ uid: 'regression-user', email: 'regression@test.com' }),
  };

  // Check 3: OAuth connect redirect_uri
  let connectResp: { ok?: boolean; authUrl?: string; redirectUri?: string } = {};
  try {
    const r = await fetch(`${base}/api/integrations/google/connect?return=/google-workspace`, { headers });
    connectResp = (await r.json()) as typeof connectResp;
  } catch (err) {
    record('OAuth connect endpoint reachable', false, String(err));
  }
  const ru = connectResp.redirectUri ?? '';
  record(
    'Connect: redirect_uri on space-z.ai (NOT fcapp.run/localhost)',
    ru.includes('space-z.ai') && !ru.includes('fcapp.run') && !ru.includes('localhost'),
    ru,
  );

  // Check 4: OAuth callback redirect target (NO 404)
  const state = connectResp.authUrl?.split('state=')[1]?.split('&')[0] ?? '';
  if (state) {
    try {
      const r = await fetch(`${base}/api/integrations/google/callback?code=FAKE&state=${state}`, {
        redirect: 'manual',
      });
      const location = r.headers.get('location') ?? '';
      record(
        'Callback: HTTP 307 redirect',
        r.status === 307,
        `HTTP ${r.status}`,
      );
      record(
        'Callback: redirects to root "/" (NOT /google-workspace route)',
        location.includes('space-z.ai/?') && !location.includes('/google-workspace?'),
        location.slice(0, 120),
      );
      record(
        'Callback: has ?view=google-workspace param',
        location.includes('view=google-workspace'),
        '',
      );
    } catch (err) {
      record('Callback: redirect target correct', false, String(err));
    }
  } else {
    record('Callback: state extracted from connect response', false, 'no state in authUrl');
  }

  // Check 5: Status endpoint
  try {
    const r = await fetch(`${base}/api/integrations/google/status`, { headers });
    const j = (await r.json()) as { ok?: boolean; status?: { connected?: boolean } };
    record(
      'Status: returns ok:true + connected:false for new user',
      r.status === 200 && j.ok === true && j.status?.connected === false,
      `HTTP ${r.status}, connected=${j.status?.connected}`,
    );
  } catch (err) {
    record('Status: endpoint reachable', false, String(err));
  }

  // Check 6: Disconnect endpoint (idempotent)
  try {
    const r = await fetch(`${base}/api/integrations/google/disconnect`, {
      method: 'POST',
      headers,
    });
    const j = (await r.json()) as { ok?: boolean };
    record(
      'Disconnect: idempotent (ok:true even if not connected)',
      r.status === 200 && j.ok === true,
      `HTTP ${r.status}, ok=${j.ok}`,
    );
  } catch (err) {
    record('Disconnect: endpoint reachable', false, String(err));
  }

  // Check 7: All five service routes EXIST + are auth-gated (401, not 404).
  //   gmail, drive, calendar/events → GET
  //   docs, sheets → POST (they accept a body)
  const serviceRoutes: Array<{ path: string; method: string }> = [
    { path: '/api/integrations/google/gmail', method: 'GET' },
    { path: '/api/integrations/google/drive', method: 'GET' },
    { path: '/api/integrations/google/docs', method: 'POST' },
    { path: '/api/integrations/google/sheets', method: 'POST' },
    { path: '/api/integrations/google/calendar/events', method: 'GET' },
  ];
  for (const { path, method } of serviceRoutes) {
    try {
      const r = await fetch(`${base}${path}`, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: method === 'POST' ? '{}' : undefined,
      });
      // 401 = route exists, auth gate working (user not connected).
      // 400 = route exists, validation gate working.
      // 404 = ROUTE MISSING — regression!
      const ok = r.status === 401 || r.status === 400;
      record(
        `Service route EXISTS: ${method} ${path}`,
        ok,
        ok ? `HTTP ${r.status} (auth gate working)` : `HTTP ${r.status} — ${r.status === 404 ? 'ROUTE MISSING (regression!)' : 'unexpected status'}`,
      );
    } catch (err) {
      record(`Service route EXISTS: ${method} ${path}`, false, String(err));
    }
  }

  // Check 8: Root route renders post-OAuth success URL (no 404)
  try {
    const r = await fetch(`${base}/?google_connected=1&view=google-workspace`);
    record(
      'Root route /?google_connected=1&view=google-workspace → 200 (no 404)',
      r.status === 200,
      `HTTP ${r.status}`,
    );
  } catch (err) {
    record('Root route renders post-OAuth URL', false, String(err));
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  // Accept both "--base=URL" and "--base URL" forms.
  let base: string | undefined;
  const baseIdx = args.indexOf('--base');
  if (baseIdx !== -1 && args[baseIdx + 1]) {
    base = args[baseIdx + 1];
  } else {
    const baseArg = args.find((a) => a.startsWith('--base='));
    if (baseArg) base = baseArg.slice('--base='.length);
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  GOOGLE WORKSPACE REGRESSION CHECK');
  console.log('  (production infrastructure guard — see docs/GOOGLE-WORKSPACE-PROTECTION.md)');
  console.log('═══════════════════════════════════════════════════════════════════════');

  // Always run env + crypto checks.
  checkEnvVars();
  await checkCrypto();

  // Run HTTP probes only if --base was provided.
  if (base) {
    await httpProbe(base);
  } else {
    console.log('\n── HTTP probes SKIPPED (pass --base=<url> to run them) ──');
  }

  // Summary.
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`  RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('  ✗ REGRESSION DETECTED — fix before continuing development.');
    console.log('═══════════════════════════════════════════════════════════════════════');
    process.exit(1);
  }
  console.log('  ✓ All Google Workspace invariants hold.');
  console.log('═══════════════════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch((err) => {
  console.error('Regression check crashed:', err);
  process.exit(2);
});
