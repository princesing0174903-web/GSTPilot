'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Docked Assistant Sidebar
//
// Premium enterprise UX (Stripe / Linear / OpenAI / Notion AI / Vercel / Ramp):
//   • Desktop (md+): slides in from the right as a 380px sidebar
//     — overlays with a subtle scrim (does not push page content)
//     — smooth 250ms ease-out animation
//   • Mobile (<md): bottom sheet that slides up from the bottom
//     — rounded top corners, drag handle, full height
//
// Interaction rules:
//   • ESC closes the panel
//   • Click on the scrim (outside) closes the panel
//   • State is persisted to localStorage so it remembers previous state
//   • NEVER blocks dashboard cards, navigation, forms, tables, or charts
//     (the sidebar sits on top of a pointer-events-none scrim that only
//      captures clicks meant to close the panel)
//
// The sidebar content is the existing OraclePanel — we reuse it so the
// visual identity, focus items, and AI activity feed remain identical.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OracleDockSidebarProps {
  open: boolean;
  onClose: () => void;
  /** The panel content (rendered inside the sidebar). */
  children: ReactNode;
}

const STORAGE_KEY = 'gstpilot-oracle-dock-state';

/** Persist open/closed state so the sidebar remembers its previous position. */
function persistState(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, ts: Date.now() }));
  } catch {
    // ignore quota / privacy errors
  }
}

function readPersistedState(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { open?: boolean; ts?: number };
    return Boolean(parsed.open);
  } catch {
    return false;
  }
}

export function OracleDockSidebar({
  open,
  onClose,
  children,
}: OracleDockSidebarProps) {
  const [mounted, setMounted] = useState(false);

  // Hydration-safe mount (portal needs window)
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── ESC to close ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true } as EventListenerOptions);
  }, [open, onClose]);

  // ── Persist state whenever it changes ───────────────────────────────────────
  useEffect(() => {
    persistState(open);
  }, [open]);

  // ── Lock body scroll when open (prevents background scroll on mobile) ───────
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* ── Scrim (desktop: subtle, mobile: darker) ─────────────────────── */}
          {/* pointer-events-auto only captures clicks meant to close; the */}
          {/* sidebar itself sits above this layer. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] md:bg-black/10"
            aria-hidden
          />

          {/* ── Desktop: right sidebar (380px) ──────────────────────────────── */}
          <motion.aside
            key="oracle-sidebar-desktop"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed right-0 top-0 z-50 hidden h-full w-[380px] flex-col',
              'border-l border-white/[0.08] bg-zinc-950/95 backdrop-blur-2xl',
              'shadow-2xl shadow-black/40',
              'md:flex',
            )}
            role="dialog"
            aria-label="GSTPilot Oracle assistant"
            aria-modal="true"
          >
            {/* Close button (top-right, inside the sidebar) */}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Close Oracle"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Sidebar content — the OraclePanel */}
            <div className="h-full overflow-hidden pr-0">
              {children}
            </div>
          </motion.aside>

          {/* ── Mobile: bottom sheet ────────────────────────────────────────── */}
          <motion.div
            key="oracle-sheet-mobile"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col',
              'rounded-t-3xl border-t border-white/[0.08] bg-zinc-950/95 backdrop-blur-2xl',
              'shadow-2xl shadow-black/50',
              'md:hidden',
            )}
            role="dialog"
            aria-label="GSTPilot Oracle assistant"
            aria-modal="true"
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/[0.15]" />
            </div>
            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Close Oracle"
            >
              <X className="h-4 w-4" />
            </button>
            {/* Sheet content */}
            <div className="max-h-[80vh] overflow-hidden">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default OracleDockSidebar;

// ─── Convenience: read persisted state on mount (for parent to restore) ─────────
export function readInitialOracleState(): boolean {
  if (typeof window === 'undefined') return false;
  return readPersistedState();
}
