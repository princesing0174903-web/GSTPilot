import { BrandLogoPulse } from '@/components/brand';

// ─── VEYRO™ branded route loading screen ──────────────────────────────────
// Full-screen black canvas with animated logo pulse (scale 0.95→1, blue→purple
// glow, 2s infinite) + "Loading VEYRO…" label. Used by Next.js App Router
// as the Suspense fallback for route transitions.
export default function Loading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <BrandLogoPulse size={96} label="Loading VEYRO…" />
    </div>
  );
}
