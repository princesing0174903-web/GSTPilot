'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Oracle™ — Premium Floating Launcher (SINGLE, CANONICAL)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This is the ONE and ONLY Oracle floating button in the entire application.
 * It replaces the old GSTPilotIntelligence orb (which opened a popup panel)
 * and the FloatingDock's Oracle button.
 *
 * BEHAVIOR:
 *   • Clicking navigates to /oracle (the dedicated full-page Oracle experience)
 *   • NO popup, NO modal, NO side panel, NO widget
 *   • Uses Next.js router.push() for client-side navigation
 *
 * DESIGN:
 *   • 56px colorful premium orb at bottom-right
 *   • Glassmorphism + gradient (emerald → cyan)
 *   • 8s breathing glow animation (calm, Apple-Siri style)
 *   • Hover lift + expanding halo
 *   • Draggable (follows cursor)
 *
 * Mounted globally in providers.tsx so it appears on every authenticated page.
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function OracleLauncher() {
  const router = useRouter();
  // Track mount state without an effect (use a ref + lazy init pattern).
  // This avoids the setState-in-effect lint error and the cascading render.
  const [navigating, setNavigating] = useState(false);
  const orbX = useMotionValue(0);
  const orbY = useMotionValue(0);
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Don't render on the /oracle page itself (no need for the launcher there)
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/oracle')) {
    return null;
  }

  const handleClick = () => {
    // If the user was dragging, don't navigate
    if (dragStartRef.current?.moved) {
      dragStartRef.current = null;
      return;
    }
    setNavigating(true);
    router.push('/oracle');
    // Reset navigating state after a delay (navigation handles it normally)
    setTimeout(() => setNavigating(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          drag
          dragMomentum={false}
          dragElastic={0}
          style={{ x: orbX, y: orbY }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.96 }}
          onPointerDown={(e) => {
            dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onPointerMove={(e) => {
            if (dragStartRef.current) {
              const dx = Math.abs(e.clientX - dragStartRef.current.x);
              const dy = Math.abs(e.clientY - dragStartRef.current.y);
              if (dx > 4 || dy > 4) {
                dragStartRef.current.moved = true;
              }
            }
          }}
          onClick={handleClick}
          aria-label="Open GSTPilot Oracle"
          className={cn(
            'accent-gradient fixed bottom-6 right-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-lg',
            navigating && 'ring-2 ring-[#2563EB]/50',
          )}
        >
          {/* Slow 8s breathing glow (the ONLY continuous animation) */}
          <motion.span
            className="absolute inset-0 rounded-full"
            animate={{
              scale: [1, 1.04, 1],
              boxShadow: [
                '0 0 24px 4px rgba(37,99,235,0.30)',
                '0 0 36px 6px rgba(59,130,246,0.40)',
                '0 0 24px 4px rgba(37,99,235,0.30)',
              ],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut' as const,
            }}
          />

          {/* Hover-only expanding halo (no infinite pulse) */}
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full border border-white/40"
            initial={{ opacity: 0, scale: 1 }}
            whileHover={{ opacity: 0.6, scale: 1.5 }}
            transition={{ duration: 0.4, ease: 'easeOut' as const }}
          />

          {/* Inner top-left highlight for the 3D glassy orb feel */}
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 55%)`,
            }}
          />

          {/* Center icon — always Sparkles */}
          <Sparkles className="relative z-10 h-6 w-6 text-white drop-shadow" />

          {/* Navigating indicator */}
          {navigating && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-zinc-950"
            >
              <motion.span
                className="h-2 w-2 rounded-full border border-white/40 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
              />
            </motion.span>
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        GSTPilot Oracle™ — Open
      </TooltipContent>
    </Tooltip>
  );
}

export default OracleLauncher;
