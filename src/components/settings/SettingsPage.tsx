'use client'

import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Building2,
  User,
  Database,
  Info,
  Save,
  Check,
  Loader2,
  Download,
  Upload,
  Trash2,
  CalendarClock,
  AlertTriangle,
  Mail,
  Shield,
  Zap,
  ExternalLink,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'

// ─── Indian States ──────────────────────────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
]

// ─── Save Button with States ────────────────────────────────────────────
function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const handleClick = async () => {
    setState('saving')
    try {
      await onSave()
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('idle')
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={state === 'saving'}
      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[100px]"
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
            Save
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
            <Loader2 className="h-4 w-4 animate-spin" />
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
            Saved
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user } = useAuth()

  // ── Firm Details State ────────────────────────────────────────────────
  const [firmName, setFirmName] = useState('Sharma & Associates')
  const [firmGstin, setFirmGstin] = useState('27AAACR5055K1ZB')
  const [firmState, setFirmState] = useState('Maharashtra')
  const [returnPeriod, setReturnPeriod] = useState('monthly')
  const [fyStart, setFyStart] = useState('april')

  // ── Profile State ─────────────────────────────────────────────────────
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deadlineReminders, setDeadlineReminders] = useState(true)
  const [mismatchAlerts, setMismatchAlerts] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(false)

  // ── Data Management State ─────────────────────────────────────────────
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [dbInfo] = useState({
    clients: 12,
    invoices: 347,
    lastBackup: '2025-06-09T14:30:00',
  })

  // ── GSTIN Validation ──────────────────────────────────────────────────
  const isGstinValid = (gstin: string) => {
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    return regex.test(gstin.toUpperCase())
  }

  const gstinValidation = firmGstin ? isGstinValid(firmGstin) : null

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSaveFirm = async () => {
    await new Promise(resolve => setTimeout(resolve, 1200))
  }

  const handleSaveProfile = async () => {
    await new Promise(resolve => setTimeout(resolve, 1200))
  }

  const handleExportData = () => {
    const data = { firmName, firmGstin, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gstpilot-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            JSON.parse(reader.result as string)
          } catch {
            // Invalid JSON
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleClearData = () => {
    setShowClearDialog(false)
  }

  // ── Animation Variants ────────────────────────────────────────────────
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
    }),
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-[52px]">
          Configure your firm and account
        </p>
      </motion.div>

      {/* ═══ FIRM DETAILS ═══ */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Firm Details</CardTitle>
                <CardDescription>Your CA firm information used in all filings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firmName" className="text-sm font-medium">Firm Name</Label>
                <Input
                  id="firmName"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Enter firm name"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firmGstin" className="text-sm font-medium">Firm GSTIN</Label>
                <div className="relative">
                  <Input
                    id="firmGstin"
                    value={firmGstin}
                    onChange={(e) => setFirmGstin(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    className={`h-10 pr-10 ${gstinValidation === false ? 'border-red-300 focus-visible:ring-red-400' : gstinValidation === true ? 'border-emerald-300 focus-visible:ring-emerald-400' : ''}`}
                    maxLength={15}
                  />
                  {gstinValidation !== null && (
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${gstinValidation ? 'text-emerald-500' : 'text-red-500'}`}>
                      {gstinValidation ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                  )}
                </div>
                {gstinValidation === false && (
                  <p className="text-[11px] text-red-500">Invalid GSTIN format</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">State</Label>
                <Select value={firmState} onValueChange={setFirmState}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Return Period</Label>
                <Select value={returnPeriod} onValueChange={setReturnPeriod}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Financial Year Start</Label>
                <Select value={fyStart} onValueChange={setFyStart}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="april">April</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <SaveButton onSave={handleSaveFirm} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ PROFILE ═══ */}
      <motion.div
        custom={1}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400">
                <User className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Your account information and preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm shrink-0">
                {user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[11px]">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            </div>

            {/* Change Password */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="text-sm text-muted-foreground hover:text-foreground gap-2 p-0 h-auto"
              >
                {showPasswordSection ? '−' : '+'} Change Password
              </Button>
              <AnimatePresence>
                {showPasswordSection && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Current Password</Label>
                        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="h-10" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">New Password</Label>
                          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="h-10" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Confirm Password</Label>
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className={`h-10 ${confirmPassword && newPassword !== confirmPassword ? 'border-red-300' : confirmPassword && newPassword === confirmPassword ? 'border-emerald-300' : ''}`}
                          />
                          {confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-[11px] text-red-500">Passwords do not match</p>
                          )}
                        </div>
                      </div>
                      {newPassword && confirmPassword && newPassword === confirmPassword && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                          <Shield className="h-3.5 w-3.5" />
                          Update Password
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Separator />

            {/* Notification Toggles */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">Notifications</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">Filing Deadline Reminders</p>
                      <p className="text-[11px] text-muted-foreground">Get notified before filing due dates</p>
                    </div>
                  </div>
                  <Switch
                    checked={deadlineReminders}
                    onCheckedChange={setDeadlineReminders}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">Mismatch Alerts</p>
                      <p className="text-[11px] text-muted-foreground">Alert when mismatches are detected</p>
                    </div>
                  </div>
                  <Switch
                    checked={mismatchAlerts}
                    onCheckedChange={setMismatchAlerts}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">Weekly Summary Email</p>
                      <p className="text-[11px] text-muted-foreground">Receive a weekly filing status digest</p>
                    </div>
                  </div>
                  <Switch
                    checked={weeklySummary}
                    onCheckedChange={setWeeklySummary}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <SaveButton onSave={handleSaveProfile} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ DATA MANAGEMENT ═══ */}
      <motion.div
        custom={2}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Database className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Data Management</CardTitle>
                <CardDescription>Export, import, or clear your data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Database Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{dbInfo.clients}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Clients</p>
              </div>
              <div className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/30 text-center">
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{dbInfo.invoices}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Invoices</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
                <p className="text-xs font-medium text-foreground">
                  {new Date(dbInfo.lastBackup).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Last Backup</p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleExportData}
                className="h-10 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <Download className="h-4 w-4" />
                Export Data
              </Button>
              <Button
                variant="outline"
                onClick={handleImportData}
                className="h-10 gap-2 border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-950/30"
              >
                <Upload className="h-4 w-4" />
                Import Data
              </Button>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="p-4 rounded-xl border-2 border-dashed border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</p>
                  <p className="text-[11px] text-red-600/70 dark:text-red-400/60 mt-0.5">
                    This will permanently delete all your clients, invoices, filings, and reconciliation data. This action cannot be undone.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                    className="mt-3 h-8 gap-2 border-red-300 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 text-xs"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ ABOUT ═══ */}
      <motion.div
        custom={3}
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        <Card className="border-border/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Info className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">About</CardTitle>
                <CardDescription>Application information and support</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/20 shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">GSTPilot</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40">
                    Stable
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Version 1.0.0 • Build 2025.06.10</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <Button variant="ghost" size="sm" className="h-9 gap-2 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
                Documentation
              </Button>
              <Button variant="ghost" size="sm" className="h-9 gap-2 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
                Support
              </Button>
              <Button variant="ghost" size="sm" className="h-9 gap-2 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
                Changelog
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ CLEAR DATA CONFIRMATION DIALOG ═══ */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Clear All Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your clients, invoices, filings, and reconciliation data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
