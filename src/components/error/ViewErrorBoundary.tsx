'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — ViewErrorBoundary
//
// Module-level React error boundary that isolates crashes to a SINGLE view.
// If CRM throws during render, the user can still navigate to Invoices,
// Returns, Dashboard, etc. via the left sidebar — the rest of the app shell
// (sidebar, topbar, FloatingDock, NotificationsSheet, CommandPalette) stays
// mounted and functional.
//
// This is the difference between "one module crashed" and "the whole app
// unmounted". The latter is what Next.js's `app/error.tsx` does by default;
// this boundary is per-view instead of per-route.
//
// Usage:
//   <ViewErrorBoundary viewName="Customers">
//     <CustomersView />
//   </ViewErrorBoundary>
//
// CRITICAL: pass a `key` prop that changes when the view changes, so React
// REMOUNTS the boundary (clearing `hasError`) on navigation. Otherwise a
// crashed view stays crashed even after the user clicks elsewhere.
//   <ViewErrorBoundary key={currentView} viewName={...}>
//     <DashboardViews view={currentView} />
//   </ViewErrorBoundary>
// ═══════════════════════════════════════════════════════════════════════════════

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, LayoutDashboard } from 'lucide-react';

interface ViewErrorBoundaryProps {
  /** Display name of the crashed module, e.g. "Customers" or "Invoices". */
  viewName?: string;
  children: ReactNode;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Sanitize a raw Error message so we never leak Firebase / Firestore /
 * Prisma internals to the UI. Mirrors the policy in friendlyAuthError.
 */
function sanitizeErrorMessage(err: Error | null): string {
  if (!err || !err.message) return 'Something went wrong loading this section.';
  const msg = err.message;
  // If the message mentions internal SDK names, fall back to a safe generic.
  if (/firebase|firestore|prisma|admin\.auth|adminDb/i.test(msg)) {
    return 'Something went wrong loading this section. Please try again.';
  }
  // Truncate very long messages (e.g. stack fragments).
  if (msg.length > 180) return `${msg.slice(0, 180)}…`;
  return msg;
}

export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
     
    console.error('[ViewErrorBoundary]', {
      viewName: this.props.viewName,
      error,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoToDashboard = (): void => {
    if (typeof window !== 'undefined') {
      // AppContext.setCurrentView('dashboard') is not accessible from here,
      // but the URL hash routing used by the dashboard shell is. Clearing the
      // hash + reloading the same origin navigates back to the dashboard.
      window.location.hash = '';
      this.setState({ hasError: false, error: null });
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { viewName } = this.props;
    const safeMessage = sanitizeErrorMessage(this.state.error);

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {viewName ? `${viewName} hit a snag` : 'This section hit a snag'}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            {safeMessage}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Your data is safe. Try again, or navigate to another section using
            the sidebar — the rest of the app is unaffected.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={this.handleGoToDashboard}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
            >
              <RotateCcw className="h-4 w-4" />
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ViewErrorBoundary;
