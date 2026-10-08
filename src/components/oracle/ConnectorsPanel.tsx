'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Real Data Connectors™ Panel
//
// Slide-in panel from the right that renders the FinancePage (the full
// "Connect Your Business Data" experience). Accessible from VEYRO AIChat
// top bar via the Plug icon.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { Plug, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FinancePage } from '@/components/finance/FinancePage';

interface ConnectorsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectorsPanel({ open, onClose }: ConnectorsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[720px] flex-col border-l border-white/[0.08] bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
                <Plug className="h-4 w-4 accent-text" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Real Data Connectors™</h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  Connect once. Oracle remembers everything.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable body — renders the full FinancePage */}
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <FinancePage />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ConnectorsPanel;
