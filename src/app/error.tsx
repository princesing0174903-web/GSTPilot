'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Root error.tsx (Next.js route boundary)
//
// Catches unhandled render errors thrown anywhere in the `/` route subtree
// that aren't caught by <ViewErrorBoundary> (which wraps each dashboard
// view in DashboardShell). This is the LAST line of defense before the
// user sees Next.js's default unbranded error page.
//
// UX improvements over the previous version:
//   • Sanitizes error.message (no Firebase/Firestore/Prisma internals leaked)
//   • Adds a "Reload page" button next to "Try Again" so deterministic
//     crashes don't trap the user in an infinite retry loop.
//   • Shows error.digest for support tickets.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

function sanitizeErrorMessage(err: Error & { digest?: string }): string {
  if (!err || !err.message) {
    return 'An unexpected error occurred. Please try again.';
  }
  const msg = err.message;
  if (/firebase|firestore|prisma|admin\.auth|adminDb/i.test(msg)) {
    return 'Something went wrong on our end. Please try again.';
  }
  if (msg.length > 200) return `${msg.slice(0, 200)}…`;
  return msg;
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
     
    console.error('Application error:', error);
  }, [error]);

  const safeMessage = sanitizeErrorMessage(error);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            {safeMessage}
          </p>
          {error.digest && (
            <p className="text-center text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleReload} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reload page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
