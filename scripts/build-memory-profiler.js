#!/usr/bin/env node
/**
 * Build memory profiler.
 *
 * Spawns `next build` as a child process and samples RSS/heap every 500ms.
 * Tags phases by sniffing child-process stdout/stderr for Next.js's known
 * build phase markers ("Creating an optimized production build",
 * "Compiled successfully", "Collecting page data", "Generating static pages",
 * "Finalizing page optimization"). Records peak per phase.
 *
 * Output: /home/z/my-project/build-memory-report.json
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');

const PHASES = [
  { name: 'startup',          re: /Creating an optimized production build/i },
  { name: 'compiling',        re: /Compiling/i },
  { name: 'compiled',         re: /Compiled successfully|✓ Compiled/i },
  { name: 'collecting-data',  re: /Collecting page data/i },
  { name: 'generating-static',re: /Generating static pages|Generating\/?static/i },
  { name: 'finalizing',       re: /Finalizing page optimization|Route \(app\)/i },
  { name: 'finished',         re: /✓ Compiled|Build complete|exporting/i },
];

const samples = [];
let currentPhase = 'startup';
const phasePeaks = {};
const phaseStarts = {};
const phaseEnds = {};

phaseStarts['startup'] = Date.now();

function recordPeak(phase, rss, heap, heapUsed) {
  if (!phasePeaks[phase] || rss > phasePeaks[phase].rss) {
    phasePeaks[phase] = { rss, heap, heapUsed, ts: Date.now() };
  }
}

const sampler = setInterval(() => {
  const m = process.memoryUsage();
  samples.push({ t: Date.now(), phase: currentPhase, rss: m.rss, heap: m.heapUsed, heapTotal: m.heapTotal });
  recordPeak(currentPhase, m.rss, m.heapTotal, m.heapUsed);
  // Also tag the parent process peak (next build worker is in same process tree,
  // but child has its own heap. We can't read child heap from parent without
  // /proc. Use /proc/<child_pid>/status instead.)
  if (child && child.pid) {
    try {
      const status = fs.readFileSync(`/proc/${child.pid}/status`, 'utf8');
      const vmRss = status.match(/VmRSS:\s+(\d+) kB/);
      if (vmRss) {
        const childRss = parseInt(vmRss[1], 10) * 1024;
        recordPeak(currentPhase + ':child', childRss, 0, 0);
      }
    } catch {}
  }
}, 500);

const env = {
  ...process.env,
  NODE_OPTIONS: '--max-old-space-size=2560',
  NEXT_TELEMETRY_DISABLED: '1',
};

const args = process.argv.slice(2);
const child = spawn('npx', ['next', 'build', ...args], {
  cwd: '/home/z/my-project',
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write('[out] ' + text);
  for (const p of PHASES) {
    if (p.re.test(text)) {
      if (currentPhase !== p.name) {
        phaseEnds[currentPhase] = Date.now();
        currentPhase = p.name;
        phaseStarts[currentPhase] = Date.now();
        console.log(`\n[profiler] phase → ${p.name} @ ${new Date().toISOString()}\n`);
      }
      break;
    }
  }
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write('[err] ' + text);
  for (const p of PHASES) {
    if (p.re.test(text)) {
      if (currentPhase !== p.name) {
        phaseEnds[currentPhase] = Date.now();
        currentPhase = p.name;
        phaseStarts[currentPhase] = Date.now();
        console.log(`\n[profiler] phase → ${p.name} @ ${new Date().toISOString()}\n`);
      }
      break;
    }
  }
});

child.on('exit', (code, signal) => {
  clearInterval(sampler);
  phaseEnds[currentPhase] = Date.now();
  phaseEnds['done'] = Date.now();

  // Walk the child process tree to find peak descendant RSS (best-effort).
  // We already captured child:RSS peaks via /proc.

  // Find global peak RSS across all samples.
  let globalPeak = 0;
  let globalPeakPhase = '';
  for (const s of samples) {
    if (s.rss > globalPeak) { globalPeak = s.rss; globalPeakPhase = s.phase; }
  }
  let globalChildPeak = 0;
  let globalChildPeakPhase = '';
  for (const [k, v] of Object.entries(phasePeaks)) {
    if (k.endsWith(':child') && v.rss > globalChildPeak) {
      globalChildPeak = v.rss;
      globalChildPeakPhase = k;
    }
  }

  const report = {
    exitCode: code,
    signal,
    startedAt: new Date(phaseStarts['startup']).toISOString(),
    finishedAt: new Date(phaseEnds['done']).toISOString(),
    durationMs: phaseEnds['done'] - phaseStarts['startup'],
    globalPeakParent: {
      rssBytes: globalPeak,
      rssMB: Math.round(globalPeak / 1024 / 1024),
      phase: globalPeakPhase,
    },
    globalPeakChild: {
      rssBytes: globalChildPeak,
      rssMB: Math.round(globalChildPeak / 1024 / 1024),
      phase: globalChildPeakPhase,
    },
    phasePeaks: Object.fromEntries(
      Object.entries(phasePeaks).map(([k, v]) => [
        k,
        {
          rssMB: Math.round(v.rss / 1024 / 1024),
          heapMB: Math.round(v.heap / 1024 / 1024),
          heapUsedMB: Math.round(v.heapUsed / 1024 / 1024),
          durationMs: (phaseEnds[k.replace(':child','')] || 0) - (phaseStarts[k.replace(':child','')] || 0),
        },
      ])
    ),
    sampleCount: samples.length,
    // Keep only every 4th sample to keep file small.
    samples: samples.filter((_, i) => i % 4 === 0).map(s => ({
      t: s.t,
      phase: s.phase,
      rssMB: Math.round(s.rss / 1024 / 1024),
      heapMB: Math.round(s.heap / 1024 / 1024),
    })),
    stdoutTail: stdout.slice(-4000),
    stderrTail: stderr.slice(-4000),
  };

  fs.writeFileSync('/home/z/my-project/build-memory-report.json', JSON.stringify(report, null, 2));
  console.log('\n[profiler] report written to /home/z/my-project/build-memory-report.json');
  console.log('[profiler] global peak PARENT RSS:', report.globalPeakParent.rssMB, 'MB @', report.globalPeakParent.phase);
  console.log('[profiler] global peak CHILD  RSS:', report.globalPeakChild.rssMB, 'MB @', report.globalPeakChild.phase);
  console.log('[profiler] phase peaks:');
  for (const [k, v] of Object.entries(report.phasePeaks)) {
    console.log(`  ${k.padEnd(28)} rss=${v.rssMB}MB heap=${v.heapMB}MB dur=${v.durationMs}ms`);
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  clearInterval(sampler);
  console.error('[profiler] spawn error:', err);
  process.exit(1);
});
