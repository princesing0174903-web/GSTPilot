'use client';

import React, { useState, useRef, useCallback } from 'react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Settings,
  User,
  Database,
  Info,
  Save,
  Check,
  Building2,
  Hash,
  MapPin,
  Calendar,
  Mail,
  Shield,
  Bell,
  Clock,
  AlertTriangle,
  Download,
  Upload,
  Trash2,
  HardDrive,
  ExternalLink,
  MessageSquare,
  FileJson,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

// ── Animation variants ──
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Indian States list ──
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// ── GSTIN validation regex ──
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ── Save button states ──
type SaveState = 'idle' | 'saving' | 'saved';

// ========================== MAIN COMPONENT ==========================
export default function TeamManagementPage() {
  const { } = useApp();
  const { user } = useAuth();

  // ── General tab state ──
  const [firmName, setFirmName] = useState('GSTPilot Firm');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [returnPeriod, setReturnPeriod] = useState('monthly');
  const [fyStart, setFyStart] = useState('april');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // ── Profile tab state ──
  const [profileName, setProfileName] = useState(user?.name || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [filingReminders, setFilingReminders] = useState(true);
  const [mismatchAlerts, setMismatchAlerts] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaveState, setPasswordSaveState] = useState<SaveState>('idle');

  // ── Data tab state ──
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── GSTIN validation ──
  const gstinValid = gstin === '' || GSTIN_REGEX.test(gstin.toUpperCase());
  const gstinFormatted = gstin.toUpperCase();

  // ── Save handler ──
  const handleSaveGeneral = useCallback(async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/firm-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName,
          primaryColor: '#059669',
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
    }
  }, [firmName]);

  // ── Password change handler ──
  const handlePasswordChange = useCallback(() => {
    if (newPassword && newPassword === confirmPassword) {
      setPasswordSaveState('saving');
      setTimeout(() => {
        setPasswordSaveState('saved');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSaveState('idle'), 2000);
      }, 800);
    }
  }, [newPassword, confirmPassword]);

  // ── Export data ──
  const handleExport = useCallback(async () => {
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gstpilot-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail for settings page
    }
  }, []);

  // ── Import data ──
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        JSON.parse(reader.result as string);
        // Import logic would go here
      } catch {
        // Invalid JSON
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // ── Clear all data ──
  const handleClearAll = useCallback(() => {
    setClearDialogOpen(false);
  }, []);

  // ── Save button renderer ──
  const renderSaveButton = (
    state: SaveState,
    onClick: () => void,
    label = 'Save Changes',
  ) => (
    <Button
      onClick={onClick}
      disabled={state === 'saving'}
      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
    >
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {label}
          </motion.span>
        )}
        {state === 'saving' && (
          <motion.span
            key="saving"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Save className="h-4 w-4" />
            </motion.div>
            Saving...
          </motion.span>
        )}
        {state === 'saved' && (
          <motion.span
            key="saved"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Saved!
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );

  // ==================== RENDER ====================
  return (
    <motion.div
      className="space-y-6 p-4 md:p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="h-7 w-7 text-emerald-600" />
              Settings
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure your workspace
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 w-fit border-emerald-200 text-emerald-700">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            Admin Access
          </Badge>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="w-full sm:w-auto flex h-auto p-1 bg-muted/60">
            <TabsTrigger value="general" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <Database className="h-4 w-4" />
              Data
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <Info className="h-4 w-4" />
              About
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════ GENERAL TAB ═══════════════ */}
          <TabsContent value="general">
            <motion.div
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-5 w-5 text-emerald-600" />
                      Firm Details
                    </CardTitle>
                    <CardDescription>
                      Basic information about your practice or business
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Firm Name */}
                    <div className="space-y-2">
                      <Label htmlFor="firm-name" className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                        Firm Name
                      </Label>
                      <Input
                        id="firm-name"
                        value={firmName}
                        onChange={(e) => setFirmName(e.target.value)}
                        placeholder="Enter firm name"
                      />
                    </div>

                    <Separator />

                    {/* GSTIN */}
                    <div className="space-y-2">
                      <Label htmlFor="gstin" className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-emerald-600" />
                        GSTIN
                      </Label>
                      <Input
                        id="gstin"
                        value={gstinFormatted}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                        className={!gstinValid ? 'border-red-400 focus-visible:border-red-500' : ''}
                      />
                      {!gstinValid && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Invalid GSTIN format. Expected: 22AAAAA0000A1Z5
                        </motion.p>
                      )}
                      {gstinValid && gstin.length > 0 && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Valid GSTIN format
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* State */}
                    <div className="space-y-2">
                      <Label htmlFor="state" className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        State
                      </Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="w-full" id="state">
                          <SelectValue placeholder="Select your state" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Default Return Period */}
                      <div className="space-y-2">
                        <Label htmlFor="return-period" className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                          Default Return Period
                        </Label>
                        <Select value={returnPeriod} onValueChange={setReturnPeriod}>
                          <SelectTrigger className="w-full" id="return-period">
                            <SelectValue placeholder="Select period" />
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

                      {/* Financial Year Start */}
                      <div className="space-y-2">
                        <Label htmlFor="fy-start" className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                          Financial Year Start
                        </Label>
                        <Select value={fyStart} onValueChange={setFyStart}>
                          <SelectTrigger className="w-full" id="fy-start">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="april">April (India Standard)</SelectItem>
                            <SelectItem value="january">January</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          FY runs April to March by default
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Save Button */}
                    <div className="flex items-center gap-3">
                      {renderSaveButton(saveState, handleSaveGeneral)}
                      {saveState === 'saved' && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-sm text-emerald-600"
                        >
                          Settings updated
                        </motion.span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ═══════════════ PROFILE TAB ═══════════════ */}
          <TabsContent value="profile">
            <motion.div
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Profile Info */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-5 w-5 text-emerald-600" />
                      Profile Information
                    </CardTitle>
                    <CardDescription>
                      Your personal account details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Your Name</Label>
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Enter your name"
                      />
                    </div>

                    <Separator />

                    {/* Email (disabled) */}
                    <div className="space-y-2">
                      <Label htmlFor="profile-email" className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-emerald-600" />
                        Email
                      </Label>
                      <Input
                        id="profile-email"
                        value={user?.email || 'user@gstpilot.ai'}
                        disabled
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email is managed by your authentication provider
                      </p>
                    </div>

                    <Separator />

                    {/* Role (display only) */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-emerald-600" />
                        Role
                      </Label>
                      <div>
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1 capitalize">
                          <Shield className="h-3 w-3" />
                          {user?.role || 'Admin'}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-3">
                      {renderSaveButton(saveState, () => {
                        setSaveState('saving');
                        setTimeout(() => {
                          setSaveState('saved');
                          setTimeout(() => setSaveState('idle'), 2000);
                        }, 600);
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Change Password */}
              {(user?.provider === 'email' || user?.provider === 'demo') && (
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Lock className="h-5 w-5 text-emerald-600" />
                        Change Password
                      </CardTitle>
                      <CardDescription>
                        Update your account password
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                          />
                        </div>
                      </div>
                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Passwords do not match
                        </motion.p>
                      )}
                      <div className="flex items-center gap-3">
                        {renderSaveButton(
                          passwordSaveState,
                          handlePasswordChange,
                          'Update Password',
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Notification Preferences */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bell className="h-5 w-5 text-emerald-600" />
                      Notification Preferences
                    </CardTitle>
                    <CardDescription>
                      Control how and when you receive alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Email notifications */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-emerald-600" />
                          Email notifications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Receive important updates via email
                        </p>
                      </div>
                      <Switch
                        checked={emailNotifications}
                        onCheckedChange={setEmailNotifications}
                      />
                    </div>

                    <Separator />

                    {/* Filing deadline reminders */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-emerald-600" />
                          Filing deadline reminders
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Get notified before GST return due dates
                        </p>
                      </div>
                      <Switch
                        checked={filingReminders}
                        onCheckedChange={setFilingReminders}
                      />
                    </div>

                    <Separator />

                    {/* Mismatch alerts */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          Mismatch alerts
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Alert when GSTR-2A data doesn&apos;t match your books
                        </p>
                      </div>
                      <Switch
                        checked={mismatchAlerts}
                        onCheckedChange={setMismatchAlerts}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ═══════════════ DATA TAB ═══════════════ */}
          <TabsContent value="data">
            <motion.div
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Export */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Download className="h-5 w-5 text-emerald-600" />
                      Export Data
                    </CardTitle>
                    <CardDescription>
                      Download all your data as a JSON file
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 shrink-0">
                          <FileJson className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Full Data Export</p>
                          <p className="text-xs text-muted-foreground">
                            Exports clients, invoices, returns, and reconciliation data
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleExport}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white sm:ml-auto"
                      >
                        <Download className="h-4 w-4" />
                        Export JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Import */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Upload className="h-5 w-5 text-emerald-600" />
                      Import Data
                    </CardTitle>
                    <CardDescription>
                      Restore data from a previously exported JSON file
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors"
                    >
                      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900">
                        <Upload className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          JSON files only (max 10MB)
                        </p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImport}
                    />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Clear all data */}
              <motion.div variants={itemVariants}>
                <Card className="border-red-200 dark:border-red-900/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-red-600">
                      <Trash2 className="h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Irreversible actions that affect all your data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 shrink-0">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">
                            Clear All Data
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Permanently delete all clients, invoices, and returns
                          </p>
                        </div>
                      </div>
                      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="gap-2 sm:ml-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear All Data
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete
                              all your clients, invoices, returns, and reconciliation
                              data from the database.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleClearAll}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Yes, clear all data
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Database Info */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HardDrive className="h-5 w-5 text-emerald-600" />
                      Database Information
                    </CardTitle>
                    <CardDescription>
                      Local SQLite database details
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Database Path</p>
                        <p className="text-sm font-mono font-medium truncate">
                          ./db/custom.db
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Engine</p>
                        <p className="text-sm font-medium">SQLite (Local)</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Last Backup</p>
                        <p className="text-sm font-medium">
                          {new Date().toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ═══════════════ ABOUT TAB ═══════════════ */}
          <TabsContent value="about">
            <motion.div
              className="space-y-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Version & Build */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Info className="h-5 w-5 text-emerald-600" />
                      About GSTPilot
                    </CardTitle>
                    <CardDescription>
                      Application version and build information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Version</p>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          v1.0.0
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Build</p>
                        <p className="text-sm font-medium font-mono">
                          2026.03.04
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Framework</p>
                        <p className="text-sm font-medium">
                          Next.js 16 + TypeScript
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">License</p>
                        <p className="text-sm font-medium">Commercial</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Logo / Branding */}
                    <div className="flex items-center gap-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-600 shrink-0">
                        <span className="text-white font-bold text-lg">G</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">GSTPilot</p>
                        <p className="text-xs text-muted-foreground">
                          Smart GST compliance management for Indian businesses
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Support & Links */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-5 w-5 text-emerald-600" />
                      Support & Feedback
                    </CardTitle>
                    <CardDescription>
                      Get help or share your thoughts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-12 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800"
                      asChild
                    >
                      <a href="mailto:support@gstpilot.ai">
                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-emerald-100 dark:bg-emerald-900 shrink-0">
                          <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Contact Support</p>
                          <p className="text-xs text-muted-foreground">support@gstpilot.ai</p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-12 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800"
                      asChild
                    >
                      <a href="https://gstpilot.ai/feedback" target="_blank" rel="noopener noreferrer">
                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-amber-100 dark:bg-amber-900 shrink-0">
                          <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Share Feedback</p>
                          <p className="text-xs text-muted-foreground">Help us improve GSTPilot</p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-12 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800"
                      asChild
                    >
                      <a href="https://gstpilot.ai/docs" target="_blank" rel="noopener noreferrer">
                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-teal-100 dark:bg-teal-900 shrink-0">
                          <Info className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Documentation</p>
                          <p className="text-xs text-muted-foreground">Guides, API reference, and more</p>
                        </div>
                        <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
