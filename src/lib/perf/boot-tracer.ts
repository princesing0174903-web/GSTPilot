// ═══════════════════════════════════════════════════════════════════════════════
// Boot Performance Tracer — dev-only timing instrumentation
// ═══════════════════════════════════════════════════════════════════════════════
//
// Emits [BOOT] console logs at each phase of application initialization so we
// can measure exactly where time is spent:
//
//   [BOOT] start
//   [BOOT] auth ready: 180ms
//   [BOOT] organization ready: 240ms
//   [BOOT] dashboard shell rendered: 410ms
//   [BOOT] dashboard data started
//   [BOOT] dashboard data complete: 720ms
//   [BOOT] interactive: 760ms
//   [BOOT] summary { auth: 180ms, org: 60ms, shell: 170ms, data: 310ms, total: 760ms, peakHeapMB: 142 }
//
// PRODUCTION-SAFE: all instrumentation is gated behind `process.env.NODE_ENV
// === 'development'`. In production builds the functions are no-ops and the
// module adds zero overhead (the calls are stripped by dead-code elimination).
//
// USAGE:
//   import { boot } from '@/lib/perf/boot-tracer';
//   boot.mark('auth ready');        // logs "[BOOT] auth ready: 180ms"
//   boot.mark('interactive');       // logs "[BOOT] interactive: 760ms" + summary
//   boot.measure('interactive');     // logs total elapsed
// ═══════════════════════════════════════════════════════════════════════════════

const isDev = process.env.NODE_ENV === 'development';

const START_TIME = isDev ? performance.now() : 0;
const marks = new Map<string, number>();
let peakHeapMB = 0;
let summaryLogged = false;

export interface BootTracer {
  /** Record a named milestone. Logs `[BOOT] {label}: {elapsed}ms` in dev. */
  mark(label: string): void;
  /** Log the total elapsed time since boot start. */
  measure(label: string): void;
  /** Get the raw elapsed ms for a mark (returns -1 if not set). */
  elapsed(label: string): number;
  /** Reset the tracer (mainly for HMR). */
  reset(): void;
}

function noopTracer(): BootTracer {
  return {
    mark() {},
    measure() {},
    elapsed() {
      return -1;
    },
    reset() {},
  };
}

function realTracer(): BootTracer {
  // Sample peak heap usage on every mark so the summary can report the
  // high-water mark. performance.memory is Chrome-only; we guard it.
  function sampleHeap() {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (mem && typeof mem.usedJSHeapSize === 'number') {
      const mb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      if (mb > peakHeapMB) peakHeapMB = mb;
    }
  }

  return {
    mark(label: string) {
      const now = performance.now();
      const elapsed = Math.round(now - START_TIME);
      marks.set(label, elapsed);
      sampleHeap();
      // Use console.info so it shows up in the browser console with a
      // distinguishable prefix, but doesn't trigger error/warning filters.
      console.info(`%c[BOOT] ${label}: ${elapsed}ms`, 'color:#3B82F6;font-weight:600');

      // When the interactive mark lands, emit the phase summary once.
      if (label === 'interactive' && !summaryLogged) {
        summaryLogged = true;
        const auth = marks.get('auth ready') ?? -1;
        const org = marks.get('organization ready') ?? -1;
        const shell = marks.get('dashboard shell rendered') ?? -1;
        const data = marks.get('dashboard data complete') ?? -1;
        const orgDelta = org > 0 && auth > 0 ? org - auth : -1;
        const shellDelta = shell > 0 && org > 0 ? shell - org : -1;
        const dataDelta = data > 0 && shell > 0 ? data - shell : -1;
        console.info(
          `%c[BOOT] summary { auth: ${auth}ms, org: +${orgDelta}ms, shell: +${shellDelta}ms, data: +${dataDelta}ms, total: ${elapsed}ms, peakHeapMB: ${peakHeapMB} }`,
          'color:#10B981;font-weight:600',
        );
      }
    },
    measure(label: string) {
      const elapsed = Math.round(performance.now() - START_TIME);
      sampleHeap();
      console.info(`%c[BOOT] ${label}: ${elapsed}ms total`, 'color:#10B981;font-weight:600');
    },
    elapsed(label: string) {
      return marks.get(label) ?? -1;
    },
    reset() {
      marks.clear();
      peakHeapMB = 0;
      summaryLogged = false;
    },
  };
}

export const boot: BootTracer = isDev ? realTracer() : noopTracer();
