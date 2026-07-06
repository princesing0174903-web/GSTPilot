'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ADVANCED RBAC™ — ENTERPRISE ROLE-BASED ACCESS CONTROL
//
// 9 enterprise roles, granular per-module permissions, role hierarchy,
// team member mapping and custom role creation. Every click reveals the
// exact permissions a role holds across Financials / GST / HR / Approvals /
// Audit / Settings / Documents / Reports.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldPlus, Users, Crown, Lock, Eye, EyeOff,
  Layers, Sparkles, ChevronRight, UserCircle2, CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ENTERPRISE_ROLES,
  TEAM_MEMBERS,
  type Role,
} from '@/lib/enterprise/data';

// ─── Access level metadata ────────────────────────────────────────────────────
type Access = 'full' | 'view' | 'limited' | 'none';

const ACCESS_META: Record<Access, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
  full: { label: 'Full', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', icon: CheckCircle2 },
  view: { label: 'View', color: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/40', icon: Eye },
  limited: { label: 'Limited', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/40', icon: Lock },
  none: { label: 'None', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: EyeOff },
};

const MODULES = ['Financials', 'GST', 'HR', 'Approvals', 'Audit', 'Settings', 'Documents', 'Reports'];

// ─── Status color helper ──────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  online: 'bg-emerald-400',
  away: 'bg-amber-400',
  busy: 'bg-red-400',
  offline: 'bg-slate-500',
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
      <div className={`size-9 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────
function RoleCard({ role, selected, onClick }: { role: Role; selected: boolean; onClick: () => void }) {
  const fullCount = role.permissions.filter(p => p.access === 'full').length;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`relative text-left rounded-xl border p-4 transition-colors ${
        selected
          ? 'border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      {/* Color accent strip */}
      <div
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ background: role.color }}
      />
      <div className="flex items-start justify-between pl-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{role.name}</span>
            {role.level >= 9 && <Crown className="size-3.5 text-amber-400" />}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
            <span>L{role.level}</span>
            <span className="text-slate-600">·</span>
            <span>{fullCount}/{MODULES.length} full access</span>
          </div>
        </div>
        <Badge variant="outline" className="border-white/10 text-slate-300 bg-white/[0.03]">
          <Users className="size-3 mr-1" />
          {role.users}
        </Badge>
      </div>
      <div className="mt-3 pl-2">
        <Progress
          value={(role.level / 10) * 100}
          className="h-1.5 bg-white/[0.06]"
          // @ts-expect-error - style override for indicator color
          style={{ '--progress-foreground': role.color } as React.CSSProperties}
        />
      </div>
    </motion.button>
  );
}

// ─── Permission Matrix ────────────────────────────────────────────────────────
function PermissionMatrix({ role }: { role: Role }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06]">
        {role.permissions.map(perm => {
          const meta = ACCESS_META[perm.access];
          const Icon = meta.icon;
          return (
            <div key={perm.module} className="bg-[#0a0e14] p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{perm.module}</div>
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${meta.bg} ${meta.border} border`}>
                <Icon className={`size-3 ${meta.color}`} />
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Role Hierarchy ───────────────────────────────────────────────────────────
function RoleHierarchy({ roles, selectedId, onSelect }: { roles: Role[]; selectedId: string; onSelect: (id: string) => void }) {
  const sorted = [...roles].sort((a, b) => b.level - a.level);
  return (
    <div className="space-y-1">
      {sorted.map((role, idx) => {
        const prev = idx > 0 ? sorted[idx - 1] : null;
        const indent = prev ? Math.max(0, (10 - role.level) - (10 - prev.level)) * 8 : 0;
        const isSelected = role.id === selectedId;
        return (
          <div key={role.id}>
            {prev && (
              <div className="flex items-center gap-2 pl-4 py-0.5">
                <div className="w-px h-3 bg-white/10" />
                <ChevronRight className="size-3 text-slate-600" />
              </div>
            )}
            <button
              onClick={() => onSelect(role.id)}
              style={{ paddingLeft: `${12 + indent}px` }}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors text-left ${
                isSelected
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <div
                className="size-2.5 rounded-full"
                style={{ background: role.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white truncate">{role.name}</span>
                  {role.level >= 9 && <Crown className="size-3 text-amber-400" />}
                </div>
              </div>
              <Badge variant="outline" className="border-white/10 text-slate-400 bg-white/[0.03] text-[10px]">
                L{role.level}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-slate-400 bg-white/[0.03] text-[10px]">
                <Users className="size-2.5 mr-1" />
                {role.users}
              </Badge>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Team Members by Role ─────────────────────────────────────────────────────
function TeamMembersByRole({ role }: { role: Role }) {
  const members = useMemo(
    () => TEAM_MEMBERS.filter(m => m.role === role.name),
    [role]
  );

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <UserCircle2 className="size-8 text-slate-600 mb-2" />
        <p className="text-xs text-slate-500">No team members currently assigned this role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scroll">
      <AnimatePresence mode="popLayout">
        {members.map(m => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
          >
            <div className="relative">
              <Avatar className="size-9 border border-white/10">
                <AvatarFallback
                  className="text-[11px] font-semibold text-white"
                  style={{ background: `${m.color}22`, color: m.color }}
                >
                  {m.avatar}
                </AvatarFallback>
              </Avatar>
              <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[#0a0e14] ${STATUS_COLOR[m.status]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{m.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{m.company}</div>
            </div>
            {m.currentActivity && (
              <div className="text-[11px] text-slate-500 italic max-w-[160px] truncate hidden sm:block">
                {m.currentActivity}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Custom Role CTA Card ─────────────────────────────────────────────────────
function CustomRoleCard() {
  return (
    <button className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] hover:bg-white/[0.03] hover:border-emerald-500/40 transition-colors p-5 text-left group">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20 group-hover:ring-emerald-500/40 transition-all">
          <ShieldPlus className="size-5 text-emerald-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Create Custom Role</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Define a new role with bespoke permissions
          </div>
        </div>
        <ChevronRight className="size-4 text-slate-500 ml-auto group-hover:text-emerald-400 transition-colors" />
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdvancedRBAC() {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('r2'); // default: CFO
  const selectedRole = useMemo(
    () => ENTERPRISE_ROLES.find(r => r.id === selectedRoleId) ?? ENTERPRISE_ROLES[0],
    [selectedRoleId]
  );

  const stats = useMemo(() => {
    const totalUsers = ENTERPRISE_ROLES.reduce((s, r) => s + r.users, 0);
    const customRoles = 1; // assumes one custom role slot reserved
    const avgLevel = ENTERPRISE_ROLES.reduce((s, r) => s + r.level, 0) / ENTERPRISE_ROLES.length;
    return {
      totalRoles: ENTERPRISE_ROLES.length,
      totalUsers,
      customRoles,
      avgLevel: avgLevel.toFixed(1),
    };
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/30">
            <Shield className="size-4 text-emerald-400" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Advanced RBAC<span className="text-emerald-400">™</span>
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {ENTERPRISE_ROLES.length} enterprise roles · granular permissions · custom roles
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill icon={Layers} label="Total Roles" value={stats.totalRoles} color="bg-emerald-500/10 text-emerald-400" />
        <StatPill icon={Users} label="Total Users" value={stats.totalUsers} color="bg-cyan-500/10 text-cyan-400" />
        <StatPill icon={ShieldPlus} label="Custom Roles" value={stats.customRoles} color="bg-amber-500/10 text-amber-400" />
        <StatPill icon={Crown} label="Avg Access Lvl" value={stats.avgLevel} color="bg-teal-500/10 text-teal-400" />
      </div>

      {/* Role cards grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="size-4 text-emerald-400" />
            Enterprise Roles
          </h2>
          <Badge variant="outline" className="border-white/10 text-slate-400 bg-white/[0.03]">
            {ENTERPRISE_ROLES.length} roles
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ENTERPRISE_ROLES.map(role => (
            <RoleCard
              key={role.id}
              role={role}
              selected={role.id === selectedRoleId}
              onClick={() => setSelectedRoleId(role.id)}
            />
          ))}
          <CustomRoleCard />
        </div>
      </div>

      {/* Selected role: permission matrix + team members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="size-9 rounded-lg flex items-center justify-center ring-1"
                  style={{
                    background: `${selectedRole.color}22`,
                    // @ts-expect-error css var
                    '--tw-ring-color': `${selectedRole.color}55`,
                  }}
                >
                  <Shield className="size-4" style={{ color: selectedRole.color }} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                    {selectedRole.name}
                    {selectedRole.level >= 9 && <Crown className="size-4 text-amber-400" />}
                  </CardTitle>
                  <div className="text-xs text-slate-500">
                    Level {selectedRole.level} · {selectedRole.users} user{selectedRole.users !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:bg-white/[0.06]"
              >
                <Lock className="size-3 mr-1.5" />
                Edit Permissions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Permission Matrix</div>
            <PermissionMatrix role={selectedRole} />
            <Separator className="my-4 bg-white/[0.06]" />
            <div className="grid grid-cols-4 gap-2 text-center">
              {(['full', 'view', 'limited', 'none'] as Access[]).map(a => {
                const meta = ACCESS_META[a];
                const Icon = meta.icon;
                const count = selectedRole.permissions.filter(p => p.access === a).length;
                return (
                  <div key={a} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                    <Icon className={`size-3.5 mx-auto mb-1 ${meta.color}`} />
                    <div className={`text-base font-semibold ${meta.color}`}>{count}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="size-4 text-emerald-400" />
              Team Members
            </CardTitle>
            <p className="text-xs text-slate-500">Active users with <span className="text-slate-300">{selectedRole.name}</span> role</p>
          </CardHeader>
          <CardContent>
            <TeamMembersByRole role={selectedRole} />
          </CardContent>
        </Card>
      </div>

      {/* Role hierarchy + AI insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="size-4 text-emerald-400" />
              Role Hierarchy
            </CardTitle>
            <p className="text-xs text-slate-500">Top-down organizational access structure</p>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto pr-1 custom-scroll">
              <RoleHierarchy
                roles={ENTERPRISE_ROLES}
                selectedId={selectedRoleId}
                onSelect={setSelectedRoleId}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-400" />
              AI Access Insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              The <span className="text-emerald-300 font-medium">{selectedRole.name}</span> role has{' '}
              <span className="text-emerald-300 font-medium">
                {selectedRole.permissions.filter(p => p.access === 'full').length} full-access
              </span>{' '}
              modules and{' '}
              <span className="text-amber-300 font-medium">
                {selectedRole.permissions.filter(p => p.access === 'none').length} restricted
              </span>{' '}
              modules.
            </p>
            <Separator className="bg-white/[0.06]" />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Least-privilege score</span>
                <span className="text-emerald-300 font-medium">
                  {Math.round((selectedRole.permissions.filter(p => p.access !== 'full').length / selectedRole.permissions.length) * 100)}%
                </span>
              </div>
              <Progress value={(selectedRole.permissions.filter(p => p.access !== 'full').length / selectedRole.permissions.length) * 100} className="h-1.5 bg-white/[0.06]" />
              <p className="text-[11px] text-slate-500 mt-1">
                Higher = more restricted access (better security posture).
              </p>
            </div>
            <Separator className="bg-white/[0.06]" />
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="text-[11px] text-slate-400 leading-relaxed">
                <span className="text-emerald-300 font-medium">Recommendation:</span> Apply quarterly access reviews — flag any user with admin-level access inactive for 90+ days.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
      `}</style>
    </div>
  );
}
