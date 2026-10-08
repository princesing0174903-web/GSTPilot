'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Premium Floating Dock
//
// A single, elegant glassmorphism dock positioned above the bottom margin
// on the right side. Contains exactly 3 actions:
//   • Oracle       — toggles the docked AI sidebar
//   • Notifications — opens the notification panel
//   • Help          — opens the help / command palette
//
// Design references: Stripe Dashboard, Linear, OpenAI ChatGPT, Vercel, Ramp.
//   • Glassmorphism with soft shadow
//   • Smooth hover lift + accent glow
//   • Native tooltips (no title attr jitter)
//   • Never blocks dashboard cards, navigation, or floating actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FloatingDockProps {
  /** Unread notification count (shows a badge when > 0). */
  notificationCount?: number;
  /** Called when the Notifications button is clicked. */
  onNotificationsToggle: () => void;
  /** Whether the notification panel is currently open. */
  notificationsOpen?: boolean;
}

export function FloatingDock({
  notificationCount = 0,
  onNotificationsToggle,
  notificationsOpen = false,
}: FloatingDockProps) {
  // The Help button toggles its pressed state locally for visual feedback.
  const [helpOpen, setHelpOpen] = useState(false);

  const handleHelp = useCallback(() => {
    // Trigger the command palette (⌘K) which serves as help / quick actions
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
    setHelpOpen((v) => !v);
  }, []);

  // NOTE: Oracle button removed — the canonical Oracle launcher is now
  // <OracleLauncher /> mounted globally in providers.tsx. It navigates to
  // the /oracle page. This dock now only contains Notifications + Help.
  const dockItems = [
    {
      key: 'notifications',
      label: notificationsOpen ? 'Close Notifications' : 'Notifications',
      icon: Bell,
      onClick: onNotificationsToggle,
      active: notificationsOpen,
      badge: notificationCount > 0 ? Math.min(notificationCount, 99) : undefined,
    },
    {
      key: 'help',
      label: 'Help · ⌘K',
      icon: HelpCircle,
      onClick: handleHelp,
      active: helpOpen,
    },
  ] as const;

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay: 0.2 }}
        className="pointer-events-auto fixed bottom-5 right-5 z-50 flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.06] p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl dark:bg-black/[0.4]"
      >
        {dockItems.map((item) => {
          const Icon = item.icon;
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={item.onClick}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB]/60',
                    item.active
                      ? 'bg-white/[0.12] text-foreground'
                      : 'text-muted-foreground hover:bg-white/[0.08] hover:text-foreground',
                  )}
                  aria-label={item.label}
                  aria-pressed={item.active}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  {/* Notification badge */}
                  {'badge' in item && item.badge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-sm">
                      {item.badge}
                    </span>
                  ) : null}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8} className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </motion.div>
    </TooltipProvider>
  );
}

// ─── Close helper (used by parent when a panel is open via overlay click) ─────
export function DockCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground md:hidden"
      aria-label="Close panel"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export default FloatingDock;
