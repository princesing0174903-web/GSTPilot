'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Users,
  Plus,
  Shield,
  Edit,
  Trash2,
  Moon,
  Sun,
  Bell,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useTheme } from 'next-themes';

// --- Types ---
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  status: 'online' | 'offline';
  lastActive: string;
}

// --- Hardcoded Team Member Data ---
const initialTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'CA Rajesh Kumar',
    email: 'rajesh.kumar@gstpilot.in',
    role: 'admin',
    status: 'online',
    lastActive: 'Just now',
  },
  {
    id: '2',
    name: 'Priya Sharma',
    email: 'priya.sharma@gstpilot.in',
    role: 'manager',
    status: 'online',
    lastActive: '5m ago',
  },
  {
    id: '3',
    name: 'Amit Patel',
    email: 'amit.patel@gstpilot.in',
    role: 'staff',
    status: 'offline',
    lastActive: '2h ago',
  },
];

// --- Role Badge Helper ---
function getRoleBadge(role: TeamMember['role']) {
  switch (role) {
    case 'admin':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      );
    case 'manager':
      return (
        <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 gap-1">
          <Edit className="h-3 w-3" />
          Manager
        </Badge>
      );
    case 'staff':
      return (
        <Badge className="bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200 gap-1">
          <Users className="h-3 w-3" />
          Staff
        </Badge>
      );
  }
}

// --- Status Dot Helper ---
function getStatusDot(status: TeamMember['status']) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          status === 'online' ? 'bg-green-500' : 'bg-gray-400'
        }`}
      />
      <span className="text-sm capitalize text-muted-foreground">
        {status}
      </span>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function TeamManagementPage() {
  const { theme, setTheme } = useTheme();

  // Team members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);

  // Add member dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamMember['role']>('staff');

  // Edit role dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<TeamMember['role']>('staff');

  // Remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);

  // Application settings state
  const [defaultGstRate, setDefaultGstRate] = useState('18');
  const [defaultReturnPeriod, setDefaultReturnPeriod] = useState('monthly');
  const [autoReconciliation, setAutoReconciliation] = useState(true);
  const [autoClassifyInvoices, setAutoClassifyInvoices] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // --- Handlers ---
  function handleAddMember() {
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const newMember: TeamMember = {
      id: String(Date.now()),
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      role: newMemberRole,
      status: 'offline',
      lastActive: 'Never',
    };
    setTeamMembers((prev) => [...prev, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberRole('staff');
    setAddDialogOpen(false);
  }

  function handleEditRole() {
    if (!editingMember) return;
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === editingMember.id ? { ...m, role: editRole } : m))
    );
    setEditDialogOpen(false);
    setEditingMember(null);
  }

  function handleRemoveMember() {
    if (!removingMember) return;
    setTeamMembers((prev) => prev.filter((m) => m.id !== removingMember.id));
    setRemoveDialogOpen(false);
    setRemovingMember(null);
  }

  function openEditDialog(member: TeamMember) {
    setEditingMember(member);
    setEditRole(member.role);
    setEditDialogOpen(true);
  }

  function openRemoveDialog(member: TeamMember) {
    setRemovingMember(member);
    setRemoveDialogOpen(true);
  }

  function toggleDarkMode() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  // Fiscal year helpers
  function getCurrentFiscalYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    // Indian FY: April to March
    if (month >= 3) {
      return `FY ${year}-${(year + 1).toString().slice(2)}`;
    }
    return `FY ${year - 1}-${year.toString().slice(2)}`;
  }

  function getFiscalYearQuarters(): { quarter: string; period: string }[] {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 3 ? year : year - 1;

    return [
      {
        quarter: 'Q1',
        period: `Apr ${startYear} - Jun ${startYear}`,
      },
      {
        quarter: 'Q2',
        period: `Jul ${startYear} - Sep ${startYear}`,
      },
      {
        quarter: 'Q3',
        period: `Oct ${startYear} - Dec ${startYear}`,
      },
      {
        quarter: 'Q4',
        period: `Jan ${startYear + 1} - Mar ${startYear + 1}`,
      },
    ];
  }

  const fiscalYear = getCurrentFiscalYear();
  const quarters = getFiscalYearQuarters();

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-7 w-7 text-emerald-600" />
            Settings &amp; Team Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team members, application preferences, and fiscal year settings
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 w-fit">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-emerald-700">Admin Access</span>
        </Badge>
      </div>

      {/* ===== Team Members Section ===== */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-emerald-600" />
                Team Members
              </CardTitle>
              <CardDescription className="mt-1">
                {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} in your organization
              </CardDescription>
            </div>

            {/* Add Member Dialog Trigger */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Invite a new member to your GSTPilot organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="member-name">Name</Label>
                    <Input
                      id="member-name"
                      placeholder="Enter full name"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      placeholder="email@example.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-role">Role</Label>
                    <Select
                      value={newMemberRole}
                      onValueChange={(val) =>
                        setNewMemberRole(val as TeamMember['role'])
                      }
                    >
                      <SelectTrigger className="w-full" id="member-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleAddMember}
                    disabled={!newMemberName.trim() || !newMemberEmail.trim()}
                  >
                    Add Member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No team members found. Add your first member above.
                    </TableCell>
                  </TableRow>
                ) : (
                  teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
                            {member.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <span className="truncate">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="truncate block max-w-[200px]">
                          {member.email}
                        </span>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>{getStatusDot(member.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.lastActive}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                            onClick={() => openEditDialog(member)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Edit Role</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openRemoveDialog(member)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Edit Role Dialog ===== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingMember?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div>{editingMember && getRoleBadge(editingMember.role)}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">New Role</Label>
              <Select
                value={editRole}
                onValueChange={(val) =>
                  setEditRole(val as TeamMember['role'])
                }
              >
                <SelectTrigger className="w-full" id="edit-role">
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleEditRole}
            >
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Remove Confirmation Dialog ===== */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removingMember?.name}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Application Settings Section ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GST & Return Settings */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-emerald-600" />
              GST &amp; Return Settings
            </CardTitle>
            <CardDescription>
              Configure default GST rates and return filing preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Default GST Rate */}
            <div className="space-y-2">
              <Label htmlFor="gst-rate">Default GST Rate</Label>
              <Select value={defaultGstRate} onValueChange={setDefaultGstRate}>
                <SelectTrigger className="w-full" id="gst-rate">
                  <SelectValue placeholder="Select GST rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                  <SelectItem value="28">28%</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applied as default when creating new invoices
              </p>
            </div>

            <Separator />

            {/* Default Return Period */}
            <div className="space-y-2">
              <Label htmlFor="return-period">Default Return Period</Label>
              <Select
                value={defaultReturnPeriod}
                onValueChange={setDefaultReturnPeriod}
              >
                <SelectTrigger className="w-full" id="return-period">
                  <SelectValue placeholder="Select return period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default filing frequency for new clients
              </p>
            </div>

            <Separator />

            {/* Auto-Reconciliation Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  Auto-reconciliation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically reconcile GSTR-2A with purchase register
                </p>
              </div>
              <Switch
                checked={autoReconciliation}
                onCheckedChange={setAutoReconciliation}
              />
            </div>

            <Separator />

            {/* Auto-classify Invoices Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  Auto-classify invoices
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically categorize invoices by HSN/SAC codes
                </p>
              </div>
              <Switch
                checked={autoClassifyInvoices}
                onCheckedChange={setAutoClassifyInvoices}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification & Appearance Settings */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-emerald-600" />
              Notifications &amp; Appearance
            </CardTitle>
            <CardDescription>
              Manage notification preferences and display settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-600" />
                  Email notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive email alerts for filing deadlines and issues
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <Separator />

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Moon className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Sun className="h-4 w-4 text-emerald-600" />
                  )}
                  Dark mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Switch between light and dark themes
                </p>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleDarkMode}
              />
            </div>

            <Separator />

            {/* Appearance Preview */}
            <div className="rounded-lg border border-border/50 p-4 space-y-3">
              <p className="text-sm font-medium">Theme Preview</p>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-md p-3 border cursor-pointer transition-all ${
                    theme === 'light'
                      ? 'border-emerald-300 ring-2 ring-emerald-200'
                      : 'border-border hover:border-emerald-300'
                  }`}
                  onClick={() => setTheme('light')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Light</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded bg-gray-200" />
                    <div className="h-2 w-3/4 rounded bg-gray-100" />
                    <div className="h-2 w-1/2 rounded bg-emerald-200" />
                  </div>
                </div>
                <div
                  className={`rounded-md p-3 border cursor-pointer transition-all bg-gray-900 ${
                    theme === 'dark'
                      ? 'border-emerald-300 ring-2 ring-emerald-200'
                      : 'border-border hover:border-emerald-300'
                  }`}
                  onClick={() => setTheme('dark')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Moon className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-200">Dark</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded bg-gray-700" />
                    <div className="h-2 w-3/4 rounded bg-gray-800" />
                    <div className="h-2 w-1/2 rounded bg-emerald-800" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Fiscal Year Settings Section ===== */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-5 w-5 text-emerald-600" />
            Fiscal Year Settings
          </CardTitle>
          <CardDescription>
            Current financial year and quarter definitions for GST compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Financial Year Display */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FileText className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Current Financial Year
                </p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {fiscalYear}
                </p>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-12" />
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900">
                <RefreshCw className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Return Period</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400 capitalize">
                  {defaultReturnPeriod}
                </p>
              </div>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-12" />
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800">
                <Users className="h-5 w-5 text-slate-700 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-400">
                  {teamMembers.length} Member{teamMembers.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Quarter Definitions */}
          <div>
            <p className="text-sm font-medium mb-3">Quarter Definitions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quarters.map((q, idx) => (
                <div
                  key={q.quarter}
                  className="rounded-lg border border-border/50 p-4 hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 dark:hover:border-emerald-800 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`flex items-center justify-center h-8 w-8 rounded-md text-xs font-bold ${
                        idx === 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400'
                          : idx === 1
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400'
                          : idx === 2
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400'
                      }`}
                    >
                      {q.quarter}
                    </div>
                    <span className="text-sm font-semibold">{q.quarter}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{q.period}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
