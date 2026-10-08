'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Root ErrorBoundary
// ═══════════════════════════════════════════════════════════════════════════════
//
// A top-level React error boundary that wraps <AppRoot/>. Catches ANY uncaught
// render error in the React tree (not just Next.js route errors) and shows a
// premium full-page error card instead of a white screen.
//
// This is the LAST line of defense. It sits BELOW Next.js's `app/error.tsx`
// (which catches route-level errors) and BELOW `app/global-error.tsx` (which
// catches errors thrown in the root layout). When this boundary activates,
// it means an error was thrown inside the dynamically-imported AppRoot chunk
// after hydration.
//
// UX:
//   • Sanitized error message (no Firebase/Firestore/Prisma/fetch internals)
//   • Red-tinted AlertTriangle illustration (PremiumErrorState)
//   • "Try Again" + "Reload page" buttons
//   • Optional error code (digest) for support tickets
//   • Oracle suggestion
//
// Usage:
//   <ErrorBoundary>
//     <AppRoot />
//   </ErrorBoundary>
// ═══════════════════════════════════════════════════════════════════════════════

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LayoutDashboard, RotateCcw } from 'lucide-react';
import {
  PremiumErrorState,
  sanitizeErrorForDisplay,
} from '@/components/ui/premium-error-state';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the error code slot (e.g. "APP-ROOT"). */
  codePrefix?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** Incremented each time we retry — used as a `key` to force-remount children. */
  retryCount: number;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sanitized log — never write raw componentStack to a remote sink.
    console.error('[ErrorBoundary] uncaught render error:', {
      message: sanitizeErrorForDisplay(error),
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      // Hard navigation to the origin — clears any hash / view param state
      // that might have triggered the crash.
      window.location.href = '/';
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      // `key` ensures children remount when we retry, clearing stale state.
      return (
        <div key={this.state.retryCount}>{this.props.children}</div>
      );
    }

    const { codePrefix = 'APP' } = this.props;
    const err = this.state.error;
    const digest = (err as Error & { digest?: string } | null)?.digest;
    const errorCode = digest
      ? `${codePrefix}-${digest.slice(0, 8).toUpperCase()}`
      : `${codePrefix}-ERR`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-xl rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
          <PremiumErrorState
            title="VEYRO ran into a problem"
            description={sanitizeErrorForDisplay(err)}
            onRetry={this.handleRetry}
            retryLabel="Try again"
            secondaryAction={{
              label: 'Reload page',
              onClick: this.handleReload,
              icon: <RotateCcw className="h-4 w-4" />,
            }}
            oracleSuggestion="If this keeps happening, ask Oracle to diagnose the issue — open the command palette with ⌘K and type 'report error'."
            errorCode={errorCode}
            supportHref="mailto:support@veyro.com"
            className="py-10"
          />
          <div className="flex justify-center pb-4">
            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
