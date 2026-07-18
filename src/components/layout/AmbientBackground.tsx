'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Ambient Background
// ───────────────────────────────────────────────────────────────────────────────
// PREMIUM BLACK ENTERPRISE: No decorative graphics. Pure flat black canvas.
// All aurora blobs, network lines, and particles have been removed to match
// the ChatGPT Enterprise / Vercel Dashboard reference — clean, minimal, flat.
// Component kept (imported by DashboardShell) but renders nothing visible.
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';

interface AmbientBackgroundProps {
  className?: string;
  showNetwork?: boolean;
  showParticles?: boolean;
  particleCount?: number;
}

export function AmbientBackground({
  className,
  showNetwork = true,
  showParticles = true,
  particleCount = 24,
}: AmbientBackgroundProps) {
  // Retain props for API compatibility — but render nothing decorative.
  void showNetwork;
  void showParticles;
  void particleCount;

  // Pure flat black. No aurora, no network lines, no particles, no vignette.
  // The body background (#000000 in dark mode) provides the canvas.
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background',
        className,
      )}
      aria-hidden="true"
    />
  );
}

export default AmbientBackground;
