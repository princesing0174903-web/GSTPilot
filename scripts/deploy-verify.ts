#!/usr/bin/env bun
// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Pre-Deployment Verification
//
// Sequentially runs:
//   1. bunx tsc --noEmit       (TypeScript compile check)
//   2. bun run lint            (ESLint)
//   3. Checks firebase.json, firestore.rules, firestore.indexes.json, storage.rules exist
//   4. Validates firestore.indexes.json parses as JSON
//   5. Validates functions/src/index.ts exists
//   6. Warns on any missing required env vars from .env.example
//   7. Prints summary table, exits 0 on full pass, 1 on any failure
//
// Run with: bun run scripts/deploy-verify.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { execSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

interface Step {
  name: string;
  pass: boolean;
  detail: string;
  warnOnly?: boolean;
}

const steps: Step[] = [];

function record(name: string, pass: boolean, detail: string, warnOnly = false): void {
  steps.push({ name, pass, detail, warnOnly });
}

function run(cmd: string, label: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
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

async function isFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
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

async function main(): Promise<void> {
  // ── 1. tsc --noEmit ──────────────────────────────────────────────────────
  const tsc = run('bunx tsc --noEmit', 'tsc');
  if (tsc.code === 0) {
    record('TypeScript compile (tsc --noEmit)', true, '0 errors');
  } else {
    const firstErr = (tsc.stdout || tsc.stderr).split('\n').slice(0, 5).join(' | ');
    record('TypeScript compile (tsc --noEmit)', false, `exit=${tsc.code} ${firstErr}`);
  }

  // ── 2. bun run lint ──────────────────────────────────────────────────────
  const lint = run('bun run lint', 'lint');
  if (lint.code === 0) {
    record('ESLint (bun run lint)', true, '0 errors');
  } else {
    const firstErr = (lint.stdout || lint.stderr).split('\n').slice(0, 5).join(' | ');
    record('ESLint (bun run lint)', false, `exit=${lint.code} ${firstErr}`);
  }

  // ── 3. Firebase files exist ──────────────────────────────────────────────
  const fbFiles = ['firebase.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules'];
  const missing = (await Promise.all(fbFiles.map(async f => ({ f, ok: await isFile(join(ROOT, f)) }))))
    .filter(x => !x.ok).map(x => x.f);
  if (missing.length === 0) {
    record('Firebase config files present', true, fbFiles.join(', '));
  } else {
    record('Firebase config files present', false, `Missing: ${missing.join(', ')}`);
  }

  // ── 4. firestore.indexes.json parses ─────────────────────────────────────
  const indexesText = await readText(join(ROOT, 'firestore.indexes.json'));
  if (!indexesText) {
    record('firestore.indexes.json parses as JSON', false, 'file not found');
  } else {
    try {
      const obj = JSON.parse(indexesText);
      const count = Array.isArray(obj.indexes) ? obj.indexes.length : 0;
      record('firestore.indexes.json parses as JSON', true, `${count} indexes defined`);
    } catch (e) {
      record('firestore.indexes.json parses as JSON', false, (e as Error).message);
    }
  }

  // ── 5. functions/src/index.ts exists ─────────────────────────────────────
  if (await isFile(join(ROOT, 'functions/src/index.ts'))) {
    record('functions/src/index.ts exists', true, 'Cloud Functions entrypoint present');
  } else {
    record('functions/src/index.ts exists', false, 'Cloud Functions entrypoint missing');
  }

  // ── 6. Required env vars present (warn-only) ─────────────────────────────
  const exampleText = await readText(join(ROOT, '.env.example'));
  if (!exampleText) {
    record('Required env vars set in process.env', false, '.env.example not found', true);
  } else {
    const expected = new Set<string>();
    for (const line of exampleText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (m) expected.add(m[1]);
    }
    const missingEnv = [...expected].filter(k => !process.env[k]);
    if (missingEnv.length === 0) {
      record('Required env vars set in process.env', true, `${expected.size} vars loaded`);
    } else {
      record(
        'Required env vars set in process.env',
        false,
        `Missing (WARN only): ${missingEnv.join(', ')}`,
        true
      );
    }
  }

  // ── 7. Summary table ─────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  GSTPilot Infinity™ — Pre-Deployment Verification');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('| # | Step | Status | Detail |');
  lines.push('|---|------|--------|--------|');
  steps.forEach((s, i) => {
    const mark = s.pass ? '✅ PASS' : (s.warnOnly ? '⚠️  WARN' : '❌ FAIL');
    lines.push(`| ${i + 1} | ${s.name} | ${mark} | ${s.detail} |`);
  });
  lines.push('');
  lines.push('─────────────────────────────────────────────────────────────');

  const hardFailures = steps.filter(s => !s.pass && !s.warnOnly);
  const warnings = steps.filter(s => !s.pass && s.warnOnly);
  if (hardFailures.length === 0) {
    lines.push(`  ✅ DEPLOY VERIFICATION: PASS  (${warnings.length} warnings)`);
  } else {
    lines.push(`  ❌ DEPLOY VERIFICATION: FAIL  (${hardFailures.length} failures, ${warnings.length} warnings)`);
  }
  lines.push('═══════════════════════════════════════════════════════════');
  console.log(lines.join('\n'));

  process.exit(hardFailures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('deploy-verify fatal:', err);
  process.exit(1);
});

// Suppress unused-import warnings if the lint config flags existsSync.
void existsSync;
