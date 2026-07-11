'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — WorkspaceSwitcher
//
// A premium organization switcher for the top bar. Shows the current org
// (logo + name + plan badge) and a dropdown of all orgs the user belongs to
// (with their role in each). Switching is instant — the OrgContext reloads
// all org-scoped data reactively.
//
// When the user belongs to only one org, the switcher still renders (as a
// static org identifier) for visual consistency, but the dropdown is disabled.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useTransition } from 'react';
import { Check, ChevronsUpDown, Plus, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useOrg } from '@/contexts/OrgContext';
import { useApp } from '@/contexts/AppContext';
import { ROLE_LABELS } from '@/lib/auth/types';
import type { OrganizationDoc } from '@/lib/auth/types';

interface WorkspaceSwitcherProps {
  /** Compact mode hides the org name on very small screens. */
  compact?: boolean;
}

function orgInitials(name: string): string {
  if (!name) return 'WS';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'WS';
}

function planBadgeClass(plan: OrganizationDoc['plan']): string {
  switch (plan) {
    case 'enterprise':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-400';
    case 'pro':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

export function WorkspaceSwitcher({ compact = false }: WorkspaceSwitcherProps) {
  const { organization, organizations, switchOrganization } = useOrg();
  const { setCurrentView } = useApp();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const currentOrg = organization;
  const orgCount = organizations.length;
  const canSwitch = orgCount > 1 && !isPending;

  const handleSwitch = (orgId: string) => {
    if (orgId === currentOrg?.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const { error } = await switchOrganization(orgId);
      if (!error) {
        setOpen(false);
        // Navigate to the dashboard so the new org's data is the focal point.
        setCurrentView('dashboard');
      }
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canSwitch && orgCount <= 1}
          className="h-8 gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-foreground transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-100 disabled:hover:bg-white/[0.03]"
          aria-label="Switch workspace"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Avatar className="h-5 w-5">
              {currentOrg?.logoUrl ? (
                <AvatarImage src={currentOrg.logoUrl} alt={currentOrg.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                {orgInitials(currentOrg?.name ?? '')}
              </AvatarFallback>
            </Avatar>
          )}
          <div className={`flex flex-col items-start leading-none ${compact ? 'hidden lg:flex' : 'hidden sm:flex'}`}>
            <span className="max-w-[120px] truncate text-xs font-semibold">
              {currentOrg?.name ?? 'No workspace'}
            </span>
            <span className="text-[9px] font-medium text-muted-foreground">
              {currentOrg?.plan ? currentOrg.plan.toUpperCase() : 'FREE'} plan
            </span>
          </div>
          {canSwitch ? (
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 p-0">
        <DropdownMenuLabel className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Your workspaces
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-72 overflow-y-auto p-1">
          {organizations.map(({ organization: org, member }) => {
            const isCurrent = org.id === currentOrg?.id;
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors focus:bg-accent/50"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {org.logoUrl ? <AvatarImage src={org.logoUrl} alt={org.name} /> : null}
                  <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                    {orgInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold">{org.name}</span>
                    {isCurrent ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`h-3.5 px-1 text-[8px] font-bold leading-none ${planBadgeClass(org.plan)}`}>
                      {org.plan?.toUpperCase() ?? 'FREE'}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">
                      {ROLE_LABELS[member.role] ?? 'Member'}
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          onClick={() => { setOpen(false); setCurrentView('organization-dashboard'); }}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors focus:bg-accent/50 focus:text-foreground"
        >
          <Building2 className="h-3.5 w-3.5" />
          Manage organization
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => { setOpen(false); setCurrentView('enterprise-settings'); }}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors focus:bg-accent/50 focus:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Organization settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
