'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Sparkles, type LucideIcon } from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Integration Coming Soon — Premium Modal
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Stabilization directive: "Do NOT show features that are not actually
 * implemented. GSTPilot must never pretend to support an integration that
 * does not exist."
 *
 * This modal is shown whenever the user clicks Connect on an integration
 * that is NOT yet built (GSTN, Bank APIs, WhatsApp, Gmail, Outlook,
 * QuickBooks, Tally). It honestly states the integration is under
 * development and lists which integrations ARE available right now
 * (Google ✅, Zoho Books ✅).
 *
 * No fake connection screens. No fake dashboards. No fake sync status.
 */

interface IntegrationComingSoonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the integration the user tried to connect. */
  integrationName: string;
  /** Lucide icon representing the integration. */
  integrationIcon?: LucideIcon;
  /** Optional one-line context for why it's coming soon. */
  description?: string;
  /** Called when the user clicks "Connect Google" (the suggested alternative). */
  onConnectGoogle?: () => void;
  /** Called when the user clicks "Connect Zoho Books". */
  onConnectZoho?: () => void;
}

const AVAILABLE = [
  { name: 'Google', icon: Sparkles },
  { name: 'Zoho Books', icon: Sparkles },
];

const COMING_SOON = [
  { name: 'GSTN', icon: Clock },
  { name: 'Banking', icon: Clock },
  { name: 'WhatsApp', icon: Clock },
  { name: 'Gmail', icon: Clock },
  { name: 'Outlook', icon: Clock },
  { name: 'QuickBooks', icon: Clock },
  { name: 'Tally', icon: Clock },
];

export function IntegrationComingSoonModal({
  open,
  onOpenChange,
  integrationName,
  integrationIcon: Icon,
  description,
  onConnectGoogle,
  onConnectZoho,
}: IntegrationComingSoonModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20">
              {Icon ? (
                <Icon className="h-4 w-4 text-amber-400" />
              ) : (
                <Clock className="h-4 w-4 text-amber-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base">
                {integrationName} — Coming Soon
              </DialogTitle>
              <DialogDescription className="text-xs">
                {description ??
                  'This integration is currently under development and will be available in a future release.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Status list */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
            <div className="px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Available Now
              </p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Coming Soon
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {COMING_SOON.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1"
                    >
                      <ItemIcon className="h-3 w-3 text-amber-400/70 shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Suggested alternatives */}
          {(onConnectGoogle || onConnectZoho) && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5">
              <p className="text-[11px] text-emerald-300/90 leading-relaxed mb-2">
                <Sparkles className="inline h-3 w-3 mr-1 -mt-0.5" />
                In the meantime, connect an available integration to start
                syncing real business data.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {onConnectGoogle && (
                  <Button
                    size="sm"
                    onClick={onConnectGoogle}
                    className="accent-gradient text-white hover:opacity-90 gap-1.5 h-7 text-[11px]"
                  >
                    Connect Google
                  </Button>
                )}
                {onConnectZoho && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onConnectZoho}
                    className="border-border gap-1.5 h-7 text-[11px]"
                  >
                    Connect Zoho Books
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IntegrationComingSoonModal;
