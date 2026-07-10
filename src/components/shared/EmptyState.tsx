'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' as const }}
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-16'
      } ${className}`}
    >
      <div
        className={`flex items-center justify-center rounded-2xl bg-slate-50 mb-4 ${
          compact ? 'h-10 w-10' : 'h-14 w-14'
        }`}
      >
        <Icon className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} text-slate-300`} />
      </div>
      <h3
        className={`font-semibold text-foreground ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {title}
      </h3>
      <p
        className={`text-muted-foreground mt-1.5 max-w-xs ${
          compact ? 'text-[11px]' : 'text-xs'
        }`}
      >
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-4">
          {action && (
            <Button
              size={compact ? 'sm' : 'default'}
              onClick={action.onClick}
              variant={action.variant ?? 'default'}
              className={
                action.variant !== 'outline'
                  ? 'bg-emerald-600 hover:bg-emerald-700 gap-1.5'
                  : 'gap-1.5'
              }
            >
              {action.icon && <action.icon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size={compact ? 'sm' : 'default'}
              variant={secondaryAction.variant ?? 'outline'}
              onClick={secondaryAction.onClick}
              className="gap-1.5"
            >
              {secondaryAction.icon && (
                <secondaryAction.icon className="h-3.5 w-3.5" />
              )}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
