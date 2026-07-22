'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FlaskConical, X } from 'lucide-react';

interface DemoDataBannerProps {
  onClear: () => void;
  visible: boolean;
}

export function DemoDataBanner({ onClear, visible }: DemoDataBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                Demo mode active
              </span>
              <span className="text-[10px] text-amber-600 hidden sm:inline">
                — All records are sample data for demonstration purposes
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="ml-auto h-6 text-[10px] gap-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2"
            >
              <X className="h-3 w-3" />
              Clear Demo Data
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
