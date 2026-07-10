#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Production Certification
//
// Runs ALL of:
//   1. scripts/production-audit.ts   (via `bun run`)
//   2. scripts/deploy-verify.ts      (via `bun run`)
//   3. scripts/dr-restore-test.ts    (via `bun run`)
//   4. GET http://localhost:3000/api/health              → expect 200
//   5. GET http://localhost:3000/api/health/detailed     → expect 200
//   6. GET http://localhost:3000/api/analytics/production → expect 200
//
// Prints the final certification block (GRANTED / DENIED) and exits 0/1.
//
// Run with: bun run scripts/production-cert.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

const results: Result[] = [];

function runScript(scriptPath: string, label: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`bun run ${scriptPath}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env },
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
    };
  }
}

async function fetchOk(url: string, label: string): Promise<Result> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const ok = res.status >= 200 && res.status < 300;
    return {
      name: label,
      pass: ok,
      detail: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      name: label,
      pass: false,
      detail: (err as Error).message,
    };
  }
}

function extractAuditScore(stdout: string): { pass: boolean; score: string } {
  // Look for "TOTAL CHECKS: N / PASSED: M / FAILED: K"
  const m = stdout.match(/TOTAL CHECKS:\s*(\d+)\s*\/\s*PASSED:\s*(\d+)\s*\/\s*FAILED:\s*(\d+)/i);
  if (!m) return { pass: false, score: 'unknown' };
  const total = parseInt(m[1], 10);
  const passed = parseInt(m[2], 10);
  const failed = parseInt(m[3], 10);
  return { pass: failed === 0, score: `${passed}/${total}` };
}

async function main(): Promise<void> {
  // ── 1. Production audit ──────────────────────────────────────────────────
  const audit = runScript('scripts/production-audit.ts', 'production-audit');
  const auditScore = extractAuditScore(audit.stdout + '\n' + audit.stderr);
  results.push({
    name: 'Production Audit',
    pass: auditScore.pass && audit.code === 0,
    detail: `score ${auditScore.score} (exit ${audit.code})`,
  });

  // ── 2. Deploy verify ─────────────────────────────────────────────────────
  const deploy = runScript('scripts/deploy-verify.ts', 'deploy-verify');
  const deployPass = deploy.code === 0;
  results.push({
    name: 'Deploy Verification',
    pass: deployPass,
    detail: `exit ${deploy.code}`,
  });

  // ── 3. DR restore test ───────────────────────────────────────────────────
  const dr = runScript('scripts/dr-restore-test.ts', 'dr-restore-test');
  const drPass = dr.code === 0;
  results.push({
    name: 'DR Restore Test',
    pass: drPass,
    detail: drPass ? 'PASS' : `exit ${dr.code}`,
  });

  // ── 4. /api/health ───────────────────────────────────────────────────────
  results.push(await fetchOk(`${BASE_URL}/api/health`, 'Health Endpoint'));

  // ── 5. /api/health/detailed ──────────────────────────────────────────────
  results.push(await fetchOk(`${BASE_URL}/api/health/detailed`, 'Detailed Health Endpoint'));

  // ── 6. /api/analytics/production ─────────────────────────────────────────
  const analyticsHeaders: Record<string, string> = {};
  if (process.env.ADMIN_TOKEN) analyticsHeaders['x-admin-token'] = process.env.ADMIN_TOKEN;
  let analyticsRes: Result;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const res = await fetch(`${BASE_URL}/api/analytics/production`, {
      signal: ctrl.signal,
      headers: analyticsHeaders,
    });
    clearTimeout(timer);
    analyticsRes = {
      name: 'Analytics Endpoint',
      pass: res.status >= 200 && res.status < 300,
      detail: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    analyticsRes = { name: 'Analytics Endpoint', pass: false, detail: (err as Error).message };
  }
  results.push(analyticsRes);

  // ── Final certification block ────────────────────────────────────────────
  const auditLabel = results.find(r => r.name === 'Production Audit')!;
  const deployLabel = results.find(r => r.name === 'Deploy Verification')!;
  const drLabel = results.find(r => r.name === 'DR Restore Test')!;
  const healthLabel = results.find(r => r.name === 'Health Endpoint')!;
  const detailedLabel = results.find(r => r.name === 'Detailed Health Endpoint')!;
  const analyticsLabel = results.find(r => r.name === 'Analytics Endpoint')!;

  const healthPass = healthLabel.pass && detailedLabel.pass;

  const certificationGranted =
    auditLabel.pass && deployLabel.pass && drLabel.pass && healthPass && analyticsLabel.pass;

  const out: string[] = [];
  out.push('');
  out.push('═══════════════════════════════════════════════════════════');
  out.push('  GSTPilot INFINITY™ — PRODUCTION CERTIFICATION');
  out.push('═══════════════════════════════════════════════════════════');
  out.push(`  Audit:        ${auditLabel.pass ? 'PASS' : 'FAIL'} (${auditLabel.detail})`);
  out.push(`  Deploy:       ${deployLabel.pass ? 'PASS' : 'FAIL'}`);
  out.push(`  DR:           ${drLabel.pass ? 'PASS' : 'DEGRADED'}  (${drLabel.detail})`);
  out.push(`  Health:       ${healthPass ? 'PASS' : 'FAIL'}  (health=${healthLabel.detail}, detailed=${detailedLabel.detail})`);
  out.push(`  Analytics:    ${analyticsLabel.pass ? 'PASS' : 'FAIL'}  (${analyticsLabel.detail})`);
  out.push('─────────────────────────────────────────────────────────────');
  out.push(`  CERTIFICATION: ${certificationGranted ? 'GRANTED' : 'DENIED'}`);
  out.push('═══════════════════════════════════════════════════════════');
  out.push('');
  out.push('## Detailed Results');
  out.push('');
  out.push('| # | Check | Status | Detail |');
  out.push('|---|-------|--------|--------|');
  results.forEach((r, i) => {
    out.push(`| ${i + 1} | ${r.name} | ${r.pass ? '✅ PASS' : '❌ FAIL'} | ${r.detail} |`);
  });
  out.push('');
  console.log(out.join('\n'));

  process.exit(certificationGranted ? 0 : 1);
}

main().catch(err => {
  console.error('production-cert fatal:', err);
  process.exit(1);
});
