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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { inviteMember } from '@/lib/auth/organizations';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Invite Team — Premium Modal
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Directive STEP 2 (Invite Team flow) + STEP 3 (premium dialog).
 *
 * Collects email + role, then calls inviteMember() — the SAME helper the
 * Settings page uses — so the membership lands in Firestore and the
 * useOrgMembers() onSnapshot subscription surfaces it everywhere.
 *
 * In preview mode (no real org), we surface a friendly info toast instead of
 * attempting a write that would fail Firestore rules. This mirrors the
 * Settings page behaviour exactly.
 */

type UiRole = 'Owner' | 'Admin' | 'Staff' | 'Viewer';

const UI_ROLES: { value: UiRole; label: string; description: string }[] = [
  { value: 'Admin', label: 'Admin', description: 'Full access except billing' },
  { value: 'Staff', label: 'Staff', description: 'Manage clients, returns, invoices' },
  { value: 'Viewer', label: 'Viewer', description: 'Read-only access to dashboards' },
];

function uiRoleToOrgRole(role: UiRole): 'owner' | 'admin' | 'staff' | 'viewer' {
  switch (role) {
    case 'Owner':
      return 'owner';
    case 'Admin':
      return 'admin';
    case 'Staff':
      return 'staff';
    case 'Viewer':
      return 'viewer';
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PREVIEW_MODE_MSG =
  'Invitations are saved with your organisation. Sign in to a real workspace to send invites.';

interface InviteTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited?: () => void;
}

export function InviteTeamModal({ open, onOpenChange, onInvited }: InviteTeamModalProps) {
  const { user } = useAuth();
  const { organization, isPreviewMode } = useOrg();
  const orgId = organization?.id ?? null;
  const isPreview = !orgId || isPreviewMode || orgId === 'preview-org';

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UiRole>('Staff');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setEmail('');
      setRole('Staff');
      setError(null);
      setInviting(false);
    }
  }, [open]);

  const emailValid = EMAIL_REGEX.test(email.trim());

  const handleInvite = async () => {
    setError(null);
    if (!emailValid) {
      setError('Enter a valid email address.');
      return;
    }
    if (isPreview) {
      toast.info('Preview Mode', { description: PREVIEW_MODE_MSG });
      onOpenChange(false);
      return;
    }
    setInviting(true);
    try {
      const trimmedEmail = email.trim();
      const pendingUserId = `pending-${trimmedEmail.toLowerCase()}`;
      const { member, error: inviteError } = await inviteMember({
        organizationId: orgId!,
        invitedBy: user?.id ?? null,
        userId: pendingUserId,
        userEmail: trimmedEmail,
        userDisplayName: trimmedEmail.split('@')[0],
        role: uiRoleToOrgRole(role),
      });
      if (inviteError || !member) {
        throw new Error(inviteError ?? 'Failed to send invite');
      }
      toast.success('Invitation sent', {
        description: `${trimmedEmail} has been invited as ${role}.`,
      });
      onInvited?.();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'We could not send the invite. Please try again.';
      setError(msg);
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl accent-gradient-soft">
              <UserPlus className="h-4 w-4 accent-text" />
            </div>
            <div>
              <DialogTitle className="text-base">Invite Team Member</DialogTitle>
              <DialogDescription className="text-xs">
                Collaborate with your team. Invitees get an email to join your workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs">
              Email Address <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="text-sm pl-9"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UiRole)}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UI_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <ShieldCheck className="h-3.5 w-3.5 accent-text shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Invited members can access all organisation data based on their role.
              You can change or revoke access anytime from Settings → Team.
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
            disabled={inviting}
            className="border-border"
          >
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!emailValid || inviting}
            className="accent-gradient text-white hover:opacity-90 gap-1.5"
          >
            {inviting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InviteTeamModal;
