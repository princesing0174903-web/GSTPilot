'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  UserPlus,
  Crown,
  UserCog,
  Users,
  Mail,
  Check,
  X,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFireFirm } from '@/hooks/use-firestore';
import { PERMISSIONS, type PermissionEntity } from '@/lib/constants';

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  permissionBadges: string[];
}

const ROLES: RoleDefinition[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full control over the firm, billing, team management, and all data. Cannot be removed.',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    permissionBadges: ['Full Access', 'Billing', 'Team Management', 'Delete Data'],
  },
  {
    key: 'partner',
    name: 'Partner',
    description: 'Senior-level access to manage clients, file returns, and oversee team operations.',
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    permissionBadges: ['View', 'Edit', 'Upload', 'File Return', 'Manage Team'],
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Can manage clients, returns, and reconciliation. Limited firm settings access.',
    icon: UserCog,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    permissionBadges: ['View', 'Edit', 'Upload', 'File Return'],
  },
  {
    key: 'staff',
    name: 'Staff',
    description: 'Can view and prepare returns and documents. No delete or filing access.',
    icon: Users,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    permissionBadges: ['View', 'Upload'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIONS TABLE
// ═══════════════════════════════════════════════════════════════════════════════

const PERMISSION_ROWS: {
  entity: PermissionEntity;
  label: string;
  actions: string[];
}[] = [
  { entity: 'clients', label: 'View', actions: ['read'] },
  { entity: 'clients', label: 'Edit', actions: ['update'] },
  { entity: 'documents', label: 'Upload', actions: ['create'] },
  { entity: 'returns', label: 'File Return', actions: ['file'] },
  { entity: 'team', label: 'Manage Team', actions: ['create', 'update', 'delete'] },
  { entity: 'settings', label: 'Billing', actions: ['update'] },
];

// Map role keys to PERMISSIONS keys
const ROLE_PERMISSION_MAP: Record<string, keyof typeof PERMISSIONS | null> = {
  owner: null, // full access
  partner: 'admin', // partner has admin-level permissions
  manager: 'manager',
  staff: 'staff',
};

function hasRolePermission(roleKey: string, entity: PermissionEntity, actions: string[]): boolean {
  const permKey = ROLE_PERMISSION_MAP[roleKey];
  if (permKey === null) return true; // owner = full access
  if (!permKey) return false;
  const entityPerms = PERMISSIONS[permKey]?.[entity];
  if (!entityPerms) return false;
  return actions.every((action) => (entityPerms as readonly string[]).includes(action));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function TeamSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TeamPage() {
  const { user } = useAuth();
  const { data: firm, loading: firmLoading } = useFireFirm();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Current user info derived from auth context
  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'owner' as const,
      picture: user.picture,
    };
  }, [user]);

  // Team members list — currently just the owner from auth context
  // In a real app, this would be a Firestore collection of team members
  const teamMembers = useMemo(() => {
    if (!currentUser) return [];
    return [currentUser];
  }, [currentUser]);

  if (firmLoading) {
    return <TeamSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Team Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage roles, permissions, and invite team members to your firm.
            </p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to add a new member to your firm. They will receive an email with a link to join.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="colleague@firm.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="pl-9"
                      type="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {inviteRole === 'partner' && 'Partners have full access to all features including team management.'}
                    {inviteRole === 'manager' && 'Managers can manage clients, returns, and reconciliation.'}
                    {inviteRole === 'staff' && 'Staff can view and prepare returns and documents.'}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={!inviteEmail.includes('@')}
                  onClick={() => {
                    // UI only — no actual invitation sent
                    setInviteEmail('');
                    setInviteRole('staff');
                    setInviteDialogOpen(false);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* ── Team Members ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Team Members</CardTitle>
            </div>
            <CardDescription className="text-xs">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} in your firm
              {firm?.firmName ? ` — ${firm.firmName}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamMembers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  <Users className="h-7 w-7 text-slate-300" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">No team members</h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
                  Invite team members to collaborate on GST compliance tasks.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-semibold text-sm shrink-0">
                      {member.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.name}
                        </p>
                        {member.role === 'owner' && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5">
                            <Crown className="h-3 w-3 mr-0.5" />
                            Owner
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>

                    {/* Role badge */}
                    <Badge variant="outline" className="text-[11px] shrink-0">
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Role Cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-foreground">Roles & Permissions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map((role, index) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`h-10 w-10 rounded-lg ${role.bgColor} flex items-center justify-center`}
                      >
                        <Icon className={`h-5 w-5 ${role.color}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {role.name}
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      {role.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissionBadges.map((badge) => (
                        <Badge
                          key={badge}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Permissions Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Permissions Matrix</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Detailed permission breakdown by role. Owner has unrestricted access to all features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Permission</TableHead>
                  {ROLES.map((role) => (
                    <TableHead key={role.key} className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <role.icon className={`h-3.5 w-3.5 ${role.color}`} />
                        {role.name}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSION_ROWS.map((row) => (
                  <TableRow key={`${row.entity}-${row.label}`}>
                    <TableCell className="font-medium text-sm">
                      {row.label}
                    </TableCell>
                    {ROLES.map((role) => {
                      const permitted = hasRolePermission(
                        role.key,
                        row.entity,
                        row.actions
                      );
                      return (
                        <TableCell key={role.key} className="text-center">
                          {permitted ? (
                            <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-slate-300 mx-auto" />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
