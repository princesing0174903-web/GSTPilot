#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Production-Readiness Audit
//
// Scans the codebase + Firebase config and emits a markdown report to stdout.
// Run with: bun run scripts/production-audit.ts
//
// Exits 0 if all checks pass, 1 if any fail (useful as a CI gate).
// Uses only Node built-ins — no external deps.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function pass(name: string, detail?: string): void {
  checks.push({ name, pass: true, detail });
}
function fail(name: string, detail?: string): void {
  checks.push({ name, pass: false, detail });
}

async function exists(p: string): Promise<boolean> {
  return existsSync(p);
}
async function isFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}
async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
async function readText(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return null;
  }
}

// ─── 1. Firebase config files ────────────────────────────────────────────────
async function checkFirebaseConfig(): Promise<void> {
  const files = ['firebase.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules'];
  const missing: string[] = [];
  for (const f of files) {
    if (!(await isFile(join(ROOT, f)))) missing.push(f);
  }
  if (missing.length === 0) pass('Firebase config files present (firebase.json, firestore.rules, firestore.indexes.json, storage.rules)');
  else fail('Firebase config files present', `Missing: ${missing.join(', ')}`);
}

// ─── 2. Cloud Functions buildable ────────────────────────────────────────────
async function checkFunctions(): Promise<void> {
  const indexTs = await isFile(join(ROOT, 'functions/src/index.ts'));
  const pkgText = await readText(join(ROOT, 'functions/package.json'));
  let hasBuild = false;
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      hasBuild = !!pkg.scripts?.build;
    } catch {
      hasBuild = false;
    }
  }
  if (indexTs && hasBuild) pass('Cloud Functions buildable (functions/src/index.ts + build script)');
  else fail('Cloud Functions buildable', `index.ts=${indexTs}, build script=${hasBuild}`);
}

// ─── 3. .env.example keys present in .env ────────────────────────────────────
async function checkEnv(): Promise<void> {
  const exampleText = await readText(join(ROOT, '.env.example'));
  const envText = await readText(join(ROOT, '.env'));
  if (!exampleText) {
    fail('.env.example keys present in .env', '.env.example not found');
    return;
  }
  if (!envText) {
    fail('.env.example keys present in .env', '.env not found');
    return;
  }
  const keys = new Set<string>();
  for (const line of exampleText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (m) keys.add(m[1]);
  }
  const present = new Set<string>();
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (m) present.add(m[1]);
  }
  const missing = [...keys].filter(k => !present.has(k));
  if (missing.length === 0) pass(`All .env.example keys present in .env (${keys.size} keys)`);
  else fail(`All .env.example keys present in .env`, `Missing: ${missing.join(', ')}`);
}

// ─── 4. firestore.rules covers expected collections ──────────────────────────
async function checkFirestoreRules(): Promise<void> {
  const rulesText = await readText(join(ROOT, 'firestore.rules'));
  const schemaText = await readText(join(ROOT, 'src/lib/firestore-schema.ts'));
  if (!rulesText) {
    fail('firestore.rules covers expected collections', 'firestore.rules not found');
    return;
  }
  if (!schemaText) {
    fail('firestore.rules covers expected collections', 'src/lib/firestore-schema.ts not found');
    return;
  }
  // Extract COLLECTIONS values from schema.
  const expected = new Set<string>();
  const re = /COLLECTIONS\s*=\s*\{([\s\S]*?)\}/;
  const m = schemaText.match(re);
  if (m) {
    const inner = m[1];
    const kv = inner.matchAll(/:\s*'([^']+)'/g);
    for (const k of kv) expected.add(k[1]);
  }
  // Pull all `match /<name>` collection names from rules.
  const matched = new Set<string>();
  for (const r of rulesText.matchAll(/match\s+\/([A-Za-z0-9_]+)/g)) matched.add(r[1]);
  const missing = [...expected].filter(c => !matched.has(c));
  if (missing.length === 0) {
    pass(`firestore.rules covers expected collections (${expected.size} collections from firestore-schema.ts)`);
  } else {
    fail('firestore.rules covers expected collections', `Missing rule coverage: ${missing.join(', ')}`);
  }
}

// ─── 5. storage.rules covers expected categories ─────────────────────────────
async function checkStorageRules(): Promise<void> {
  const rulesText = await readText(join(ROOT, 'storage.rules'));
  if (!rulesText) {
    fail('storage.rules covers expected categories', 'storage.rules not found');
    return;
  }
  const expected = ['invoices', 'gst', 'bank', 'documents', 'reports', 'notices', 'ai'];
  const missing = expected.filter(c => !rulesText.includes(c));
  if (missing.length === 0) {
    pass(`storage.rules covers expected categories (${expected.join(', ')})`);
  } else {
    fail('storage.rules covers expected categories', `Missing categories: ${missing.join(', ')}`);
  }
}

// ─── 6 & 7. CI + Deploy workflows ────────────────────────────────────────────
async function checkWorkflows(): Promise<void> {
  const ci = await isFile(join(ROOT, '.github/workflows/ci.yml'));
  const dep = await isFile(join(ROOT, '.github/workflows/deploy.yml'));
  if (ci) pass('CI workflow exists (.github/workflows/ci.yml)');
  else fail('CI workflow exists (.github/workflows/ci.yml)');
  if (dep) pass('Deploy workflow exists (.github/workflows/deploy.yml)');
  else fail('Deploy workflow exists (.github/workflows/deploy.yml)');
}

// ─── 8. apphosting.yaml ──────────────────────────────────────────────────────
async function checkApphosting(): Promise<void> {
  if (await isFile(join(ROOT, 'apphosting.yaml'))) pass('apphosting.yaml present');
  else fail('apphosting.yaml present');
}

// ─── 9. DEPLOYMENT.md ────────────────────────────────────────────────────────
async function checkDeploymentMd(): Promise<void> {
  if (await isFile(join(ROOT, 'DEPLOYMENT.md'))) pass('DEPLOYMENT.md present');
  else fail('DEPLOYMENT.md present');
}

// ─── 10. Health endpoint ─────────────────────────────────────────────────────
async function checkHealthEndpoint(): Promise<void> {
  if (await isFile(join(ROOT, 'src/app/api/health/route.ts'))) {
    pass('Health endpoint exists (src/app/api/health/route.ts)');
  } else {
    fail('Health endpoint exists (src/app/api/health/route.ts)');
  }
}

// ─── 11. Observability modules ───────────────────────────────────────────────
async function checkObservability(): Promise<void> {
  const dir = join(ROOT, 'src/lib/observability');
  if (!(await isDir(dir))) {
    fail('Observability modules exist (src/lib/observability/*)');
    return;
  }
  const expected = ['logger.ts', 'audit-log.ts', 'error-tracking.ts', 'performance.ts', 'index.ts'];
  const files = await readdir(dir).catch(() => [] as string[]);
  const missing = expected.filter(f => !files.includes(f));
  if (missing.length === 0) pass(`Observability modules exist (${expected.length} files)`);
  else fail('Observability modules exist', `Missing: ${missing.join(', ')}`);
}

// ─── 12. Security modules ────────────────────────────────────────────────────
async function checkSecurity(): Promise<void> {
  const dir = join(ROOT, 'src/lib/security');
  if (!(await isDir(dir))) {
    fail('Security modules exist (src/lib/security/*)');
    return;
  }
  const expected = ['types.ts', 'rbac.ts', 'abac.ts', 'errors.ts', 'middleware-helpers.ts'];
  const files = await readdir(dir).catch(() => [] as string[]);
  const missing = expected.filter(f => !files.includes(f));
  if (missing.length === 0) pass(`Security modules exist (${expected.length} files)`);
  else fail('Security modules exist', `Missing: ${missing.join(', ')}`);
}

// ─── 13. Reliability modules (Track A) ───────────────────────────────────────
async function checkReliability(): Promise<void> {
  const dir = join(ROOT, 'src/lib/reliability');
  if (await isDir(dir)) {
    const files = await readdir(dir).catch(() => [] as string[]);
    if (files.length > 0) pass(`Reliability modules exist (src/lib/reliability/* — ${files.length} files)`);
    else fail('Reliability modules exist (src/lib/reliability/*)', 'directory empty');
  } else {
    fail('Reliability modules exist (src/lib/reliability/*)', 'directory missing (Track A pending)');
  }
}

// ─── 14. Queue modules (Track A) ─────────────────────────────────────────────
async function checkQueue(): Promise<void> {
  const dir = join(ROOT, 'src/lib/queue');
  if (await isDir(dir)) {
    const files = await readdir(dir).catch(() => [] as string[]);
    if (files.length > 0) pass(`Queue modules exist (src/lib/queue/* — ${files.length} files)`);
    else fail('Queue modules exist (src/lib/queue/*)', 'directory empty');
  } else {
    fail('Queue modules exist (src/lib/queue/*)', 'directory missing (Track A pending)');
  }
}

// ─── 15. Scaling modules (Track B) ───────────────────────────────────────────
async function checkScaling(): Promise<void> {
  const dir = join(ROOT, 'src/lib/scaling');
  if (await isDir(dir)) {
    const files = await readdir(dir).catch(() => [] as string[]);
    if (files.length > 0) pass(`Scaling modules exist (src/lib/scaling/* — ${files.length} files)`);
    else fail('Scaling modules exist (src/lib/scaling/*)', 'directory empty');
  } else {
    fail('Scaling modules exist (src/lib/scaling/*)', 'directory missing (Track B pending)');
  }
}

// ─── 16. Production analytics (this track) ───────────────────────────────────
async function checkProductionAnalytics(): Promise<void> {
  if (await isFile(join(ROOT, 'src/lib/analytics/production-analytics.ts'))) {
    pass('Production analytics exist (src/lib/analytics/production-analytics.ts)');
  } else {
    fail('Production analytics exist (src/lib/analytics/production-analytics.ts)');
  }
}

// ─── 17. Load testing configs (this track) ───────────────────────────────────
async function checkLoadTests(): Promise<void> {
  const k6 = await isFile(join(ROOT, 'tests/load/loadtest.k6.js'));
  const art = await isFile(join(ROOT, 'tests/load/loadtest.artillery.yml'));
  if (k6 && art) pass('Load testing configs exist (tests/load/*)');
  else fail('Load testing configs exist (tests/load/*)', `k6=${k6}, artillery=${art}`);
}

// ─── 18. Backup / restore scripts ────────────────────────────────────────────
async function checkBackupRestore(): Promise<void> {
  const b = await isFile(join(ROOT, 'scripts/backup.ts'));
  const r = await isFile(join(ROOT, 'scripts/restore.ts'));
  if (b && r) pass('Backup/restore scripts exist (scripts/backup.ts, scripts/restore.ts)');
  else fail('Backup/restore scripts exist', `backup.ts=${b}, restore.ts=${r}`);
}

// ─── 19. RBAC + ABAC modules ─────────────────────────────────────────────────
async function checkRbacAbac(): Promise<void> {
  const rbac = await isFile(join(ROOT, 'src/lib/security/rbac.ts'));
  const abac = await isFile(join(ROOT, 'src/lib/security/abac.ts'));
  if (rbac && abac) pass('RBAC/ABAC modules exist (src/lib/security/rbac.ts, abac.ts)');
  else fail('RBAC/ABAC modules exist', `rbac.ts=${rbac}, abac.ts=${abac}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await checkFirebaseConfig();
  await checkFunctions();
  await checkEnv();
  await checkFirestoreRules();
  await checkStorageRules();
  await checkWorkflows();
  await checkApphosting();
  await checkDeploymentMd();
  await checkHealthEndpoint();
  await checkObservability();
  await checkSecurity();
  await checkReliability();
  await checkQueue();
  await checkScaling();
  await checkProductionAnalytics();
  await checkLoadTests();
  await checkBackupRestore();
  await checkRbacAbac();

  const total = checks.length;
  const passed = checks.filter(c => c.pass).length;
  const failed = total - passed;

  const lines: string[] = [];
  lines.push('# GSTPilot Infinity™ — Production-Readiness Audit');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| # | Check | Status | Detail |');
  lines.push('|---|-------|--------|--------|');
  checks.forEach((c, i) => {
    lines.push(`| ${i + 1} | ${c.name} | ${c.pass ? '✅ PASS' : '❌ FAIL'} | ${c.detail ?? ''} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`**TOTAL CHECKS: ${total} / PASSED: ${passed} / FAILED: ${failed}**`);
  lines.push('');

  console.log(lines.join('\n'));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('production-audit fatal:', err);
  process.exit(1);
});
