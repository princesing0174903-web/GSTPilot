import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — branded 404 page
//
// Replaces Next.js's default unbranded 404 with an on-brand page matching
// the app's dark theme. Single primary CTA (Back to dashboard) + secondary
// (Go home).
// ═══════════════════════════════════════════════════════════════════════════════

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Compass className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          404
        </h1>
        <p className="mt-1 text-lg font-medium text-foreground">
          Page not found
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to GSTPilot
          </Link>
        </div>
      </div>
    </div>
  );
}
