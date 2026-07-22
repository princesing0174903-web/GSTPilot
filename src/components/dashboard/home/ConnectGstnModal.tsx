'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Connect GSTN — Premium Modal
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Directive STEP 2 (Connect GSTN flow) + STEP 3 (no browser prompts).
 *
 * Persists the GSTIN to the organisation document in Firestore using the SAME
 * mechanism as the Settings → Firm Profile page (updateDoc on
 * `organizations/{orgId}`), then calls reloadOrg() so every Home widget
 * reflects the new connection state immediately.
 *
 * In preview mode (no real org), we surface the same friendly info toast the
 * Settings page uses, instead of attempting a write that would fail rules.
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const PREVIEW_MODE_MSG =
  'GSTIN is saved with your organisation. Sign in to a real workspace to connect GSTN.';

interface ConnectGstnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function ConnectGstnModal({
  open,
  onOpenChange,
  onConnected,
}: ConnectGstnModalProps) {
  const { organization, reload: reloadOrg, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;
  const isPreview = !orgId || isPreviewMode || orgId === 'preview-org';
  const currentGstin = organization?.gstin ?? null;

  const [gstin, setGstin] = useState(currentGstin ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setGstin(currentGstin ?? '');
      setError(null);
      setSaving(false);
    }
  }, [open, currentGstin]);

  const trimmed = gstin.trim().toUpperCase();
  const formatValid = GSTIN_REGEX.test(trimmed);
  const isAlreadyConnected = Boolean(currentGstin);

  const handleSave = async () => {
    setError(null);
    if (!formatValid) {
      setError('Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5).');
      return;
    }
    if (isPreview) {
      toast.info('Preview Mode', { description: PREVIEW_MODE_MSG });
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await updateDoc(doc(db, 'organizations', orgId!), {
        gstin: trimmed,
        updatedAt: serverTimestamp(),
      });
      await reloadOrg();
      toast.success('GSTN Connected', {
        description: `GSTIN ${trimmed} saved to your organisation.`,
      });
      onConnected?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not connect GSTN. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl accent-gradient-soft">
              <ShieldCheck className="h-4 w-4 accent-text" />
            </div>
            <div>
              <DialogTitle className="text-base">Connect GSTN</DialogTitle>
              <DialogDescription className="text-xs">
                Link your GSTIN to enable live GST filing, reconciliation, and
                compliance tracking.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isAlreadyConnected && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300">
                GSTN is already connected. You can update the GSTIN below.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="gstn-input" className="text-xs">
              GSTIN <span className="text-red-400">*</span>
            </Label>
            <Input
              id="gstn-input"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27ABCDE1234F1Z5"
              maxLength={15}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono text-sm tracking-wider"
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                15-character GST identification number
              </p>
              {trimmed.length > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[9px] h-4 px-1.5 ${
                    formatValid
                      ? 'border-emerald-500/30 text-emerald-400'
                      : 'border-amber-500/30 text-amber-400'
                  }`}
                >
                  {formatValid ? 'Valid format' : 'Check format'}
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">What this enables:</span>{' '}
              GSTR-1 / GSTR-3B filing, e-invoice generation, GSTR-2B
              auto-reconciliation, and live compliance scoring.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 leading-relaxed">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formatValid || saving}
            className="accent-gradient text-white hover:opacity-90 gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {isAlreadyConnected ? 'Update GSTIN' : 'Connect GSTN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConnectGstnModal;
