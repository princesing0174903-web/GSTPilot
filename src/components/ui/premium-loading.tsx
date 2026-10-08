'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Premium Loading System
// ═══════════════════════════════════════════════════════════════════════════════
//
// Design philosophy:
//   • No spinners, no bouncing dots, no progress bars.
//   • The logo IS the loader. It fades in (opacity + scale) over 400ms, then
//     breathes gently (scale 1.0 → 1.02 → 1.0, 2.5s, infinite).
//   • Dark theme only — matte black (#000) background with a soft radial glow
//     behind the logo mark.
//   • The logo SVG is inlined so this module has zero runtime asset
//     dependencies and can be used as the immediate loading placeholder for
//     `next/dynamic({ loading: ... })` (which must render synchronously).
//   • Duration is naturally 400–700ms (the fade-in runs once, the breathing
//     loop is purely visual afterwards). It never flashes because the parent
//     always renders it before any expensive work finishes.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────────────────────
// VEYROLogoMark — inlined logo SVG (matches /public/logo.svg)
// Inlined so this file is fully self-contained: no <img src="/logo.svg"> fetch
// during the brief loading window, no FOUC.
// ────────────────────────────────────────────────────────────────────────────────
const VEYROLogoMark = React.memo(function VEYROLogoMark({
  className,
  size = 80,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img src="/icon.png" width={size} height={size} alt="VEYRO" className={className} style={{ objectFit: "contain" }} />
  );
});

// ────────────────────────────────────────────────────────────────────────────────
// Keyframes — declared once per document via a <style> tag.
// We use a stable id so React dedupes it across mounts.
// ────────────────────────────────────────────────────────────────────────────────
const PREMIUM_LOADING_KEYFRAMES = `
@keyframes gstpilot-prem-fade-in {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes gstpilot-prem-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.02); }
}
@keyframes gstpilot-prem-wordmark-fade {
  0%   { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes gstpilot-prem-glow-pulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.85; }
}
`;

function PremiumLoadingStyles() {
  return <style dangerouslySetInnerHTML={{ __html: PREMIUM_LOADING_KEYFRAMES }} />;
}

// ────────────────────────────────────────────────────────────────────────────────
// PremiumGlobalLoading — full-screen premium loading splash.
//
// Used by:
//   • src/app/page.tsx      — initial chunk loading placeholder
//   • src/components/AppRoot.tsx — PageLoader fallback
//   • src/components/AppRouter.tsx — auth-initializing splash
//
// Renders synchronously (no useEffect) so `next/dynamic({ loading: () => ... })`
// can use it directly.
// ────────────────────────────────────────────────────────────────────────────────
export function PremiumGlobalLoading({ label = 'VEYRO' }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: '#000' }}
      role="status"
      aria-live="polite"
      aria-label="Loading VEYRO"
    >
      <PremiumLoadingStyles />

      {/* Soft radial glow behind the logo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '520px',
          height: '520px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.08) 35%, rgba(0,0,0,0) 70%)',
          filter: 'blur(8px)',
          animation: 'gstpilot-prem-glow-pulse 2.5s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Glass-effect card */}
      <div
        className="flex flex-col items-center gap-5 rounded-2xl px-10 py-12"
        style={{
          background: 'rgba(12, 12, 12, 0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px -20px rgba(0,0,0,0.8)',
        }}
      >
        {/* Logo — fade in + scale, then breathe */}
        <div
          style={{
            animation:
              'gstpilot-prem-fade-in 400ms ease-out both, gstpilot-prem-breathe 2.5s ease-in-out 400ms infinite',
            transformOrigin: 'center',
            willChange: 'transform, opacity',
          }}
        >
          <VEYROLogoMark size={80} />
        </div>

        {/* Wordmark */}
        <div
          className="flex items-center gap-1.5"
          style={{
            animation: 'gstpilot-prem-wordmark-fade 400ms ease-out 200ms both',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(96,165,250,0.85)',
              padding: '2px 6px',
              borderRadius: '5px',
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            Infinity
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// PremiumPageLoader — page-level loader (lazy-loaded views).
//
// Smaller than the global loading — no glass card, no full-viewport takeover.
// Just a centered breathing logo mark + an optional label.
// Used by:
//   • src/components/AppRouter.tsx — dynamic() loading placeholders
//   • src/components/DashboardShell.tsx — DashboardViews dynamic loading
//   • src/components/DashboardViews.tsx — view-level dynamic loading
// ────────────────────────────────────────────────────────────────────────────────
export function PremiumPageLoader({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[60vh] w-full items-center justify-center',
        className,
      )}
      style={{ background: '#000' }}
      role="status"
      aria-live="polite"
      aria-label={label ? `Loading ${label}` : 'Loading'}
    >
      <PremiumLoadingStyles />

      {/* Soft glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          maxWidth: '80vw',
          maxHeight: '80vh',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.06) 40%, rgba(0,0,0,0) 70%)',
          filter: 'blur(6px)',
          animation: 'gstpilot-prem-glow-pulse 2.5s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      <div
        className="relative flex flex-col items-center gap-3"
        style={{
          animation:
            'gstpilot-prem-fade-in 400ms ease-out both, gstpilot-prem-breathe 2.5s ease-in-out 400ms infinite',
          transformOrigin: 'center',
          willChange: 'transform, opacity',
        }}
      >
        <VEYROLogoMark size={48} />
        {label && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'rgba(161,161,170,0.85)',
              letterSpacing: '0.01em',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export default PremiumGlobalLoading;
