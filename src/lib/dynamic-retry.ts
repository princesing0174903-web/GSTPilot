'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Resilient Dynamic Import — auto-retry on chunk load failure
// ═══════════════════════════════════════════════════════════════════════════════
//
// In Next.js 16 dev mode, lazy `next/dynamic` imports can transiently fail with
// "Failed to load chunk /_next/static/chunks/...js" when the dev server
// recompiles and the browser holds a stale chunk reference. This helper wraps
// any dynamic import so that:
//   1. On first failure, it retries up to `maxRetries` times with backoff.
//   2. If all retries fail, it reloads the page ONCE (guarded by sessionStorage
//      so we never enter an infinite reload loop).
//
// Usage:
//   const MyComp = dynamic(withRetry(() => import('./MyComp')), { ssr: false });
//
// Or pass a named export:
//   const Flow = dynamic(
//     withRetry(() => import('./OnboardingFlow').then(m => ({ default: m.OnboardingFlow }))),
//     { ssr: false },
//   );

const RELOAD_FLAG = '__gstpilot_chunk_reloaded__';

export function withRetry<T>(
  importer: () => Promise<T>,
  maxRetries = 3,
): () => Promise<T> {
  return async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        // Only retry on chunk/network-style failures, not on genuine code errors.
        const message =
          err instanceof Error ? err.message : String(err);
        const isChunkError =
          message.includes('Failed to fetch dynamically imported module') ||
          message.includes('Failed to load chunk') ||
          message.includes('Importing a module script failed') ||
          message.includes('error loading dynamically imported module') ||
          // Network/transport blips
          message.includes('NetworkError') ||
          message.includes('network');

        if (!isChunkError) throw err;

        if (attempt < maxRetries) {
          // Exponential backoff: 300ms, 600ms, 1200ms...
          await new Promise((r) => setTimeout(r, 300 * Math.pow(2, attempt)));
          continue;
        }

        // All retries exhausted — reload the page once, then give up.
        if (typeof window !== 'undefined') {
          try {
            const already = sessionStorage.getItem(RELOAD_FLAG);
            if (!already) {
              sessionStorage.setItem(RELOAD_FLAG, '1');
              console.warn(
                '[dynamic-retry] Chunk failed to load after retries — reloading page once to recover.',
                message,
              );
              window.location.reload();
              // Return a never-resolving promise so React suspense keeps waiting
              // while the reload happens.
              return new Promise<T>(() => {});
            }
            // Already reloaded once — clear flag and surface the error.
            sessionStorage.removeItem(RELOAD_FLAG);
          } catch {
            // sessionStorage might be unavailable; ignore.
          }
        }
        throw err;
      }
    }
    throw lastError;
  };
}

// Call once (e.g. in providers) to install a global safety net that catches
// chunk-load errors thrown outside of React suspense (e.g. from event-triggered
// dynamic imports). It reloads the page once, guarded by sessionStorage.
export function installChunkErrorHandler() {
  if (typeof window === 'undefined') return;
  if ((window as unknown as { __chunkHandlerInstalled?: boolean }).__chunkHandlerInstalled) return;
  (window as unknown as { __chunkHandlerInstalled?: boolean }).__chunkHandlerInstalled = true;

  // ── Reset the reload flag on a clean page load ──────────────────────────
  // The RELOAD_FLAG is set right before a chunk-error reload. Without this
  // reset, the flag stays set for the entire session, so a SECOND independent
  // chunk error later would NOT trigger a recovery reload — the error would
  // be silently swallowed and the app would be dead with no UI. By clearing
  // the flag once the new page has fully loaded, we restore the recovery
  // mechanism for future chunk errors.
  window.addEventListener('load', () => {
    try {
      // Only clear if the page loaded successfully (no pending chunk errors).
      // A small delay ensures any synchronous chunk-error handlers fire first.
      setTimeout(() => {
        try {
          sessionStorage.removeItem(RELOAD_FLAG);
        } catch {
          /* sessionStorage unavailable — ignore */
        }
      }, 2000);
    } catch {
      /* ignore */
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Failed to load chunk') ||
      msg.includes('Importing a module script failed')
    ) {
      try {
        const already = sessionStorage.getItem(RELOAD_FLAG);
        if (!already) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          console.warn('[dynamic-retry] Global chunk error detected — reloading once to recover.');
          window.location.reload();
        }
      } catch {
        // ignore
      }
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Failed to load chunk') ||
      msg.includes('Importing a module script failed')
    ) {
      try {
        const already = sessionStorage.getItem(RELOAD_FLAG);
        if (!already) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          console.warn('[dynamic-retry] Unhandled chunk rejection — reloading once to recover.');
          window.location.reload();
        }
      } catch {
        // ignore
      }
    }
  });
}
