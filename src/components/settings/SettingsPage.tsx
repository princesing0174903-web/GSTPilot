'use client'

import React, { useState, useEffect, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Building2,
  ClipboardList,
  Users,
  Bell,
  Lock,
  CreditCard,
  Save,
  Check,
  Loader2,
  Camera,
  AlertTriangle,
  CalendarClock,
  Mail,
  Activity,
  Upload,
  Shield,
  Smartphone,
  Monitor,
  Globe,
  ChevronRight,
  Download,
  LockKeyhole,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import { useIsMobile } from '@/hooks/use-mobile'
import { db, storage, auth } from '@/lib/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { updatePassword } from 'firebase/auth'

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

const ENTITY_TYPES = ['Proprietorship', 'Partnership', 'LLP', 'Pvt Ltd', 'Ltd']

// ─── Section IDs ────────────────────────────────────────────────────────
type SectionId = 'firm' | 'gst' | 'team' | 'notifications' | 'security' | 'billing' | 'api' | 'audit'

interface NavSection {
  id: SectionId
  label: string
  icon: React.ReactNode
}

const SECTIONS: NavSection[] = [
  { id: 'firm', label: 'Firm Profile', icon: <Building2 className="h-4 w-4" /> },
  { id: 'gst', label: 'GST Configuration', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'api', label: 'GST API Connections', icon: <Globe className="h-4 w-4" /> },
  { id: 'team', label: 'Team Members', icon: <Users className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'security', label: 'Security', icon: <Lock className="h-4 w-4" /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit Logs', icon: <ClipboardList className="h-4 w-4" /> },
]

// ─── Team Member Type ───────────────────────────────────────────────────
interface TeamMember {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Manager' | 'Staff' | 'Viewer'
  status: 'Active' | 'Invited'
  initials: string
}

const INITIAL_TEAM: TeamMember[] = [
  { id: '1', name: 'Rajesh Kumar', email: 'rajesh@gstpilot.ai', role: 'Admin', status: 'Active', initials: 'RK' },
  { id: '2', name: 'Priya Sharma', email: 'priya@gstpilot.ai', role: 'Manager', status: 'Active', initials: 'PS' },
  { id: '3', name: 'Amit Patel', email: 'amit@gstpilot.ai', role: 'Staff', status: 'Active', initials: 'AP' },
]

// ─── Session Type ───────────────────────────────────────────────────────
interface Session {
  id: string
  device: string
  location: string
  lastActive: string
  icon: React.ReactNode
  current?: boolean
}

const MOCK_SESSIONS: Session[] = [
  { id: '1', device: 'Chrome on MacOS', location: 'Mumbai, India', lastActive: 'Now', icon: <Monitor className="h-4 w-4" />, current: true },
  { id: '2', device: 'GSTPilot Mobile App', location: 'Mumbai, India', lastActive: '2 hours ago', icon: <Smartphone className="h-4 w-4" /> },
  { id: '3', device: 'Firefox on Windows', location: 'Pune, India', lastActive: 'Yesterday', icon: <Globe className="h-4 w-4" /> },
]

// ─── Billing History ────────────────────────────────────────────────────
interface BillingInvoice {
  id: string
  date: string
  amount: string
  status: 'Paid' | 'Pending' | 'Failed'
}

const BILLING_HISTORY: BillingInvoice[] = [
  { id: '1', date: '1 Jun 2025', amount: '₹1,499', status: 'Paid' },
  { id: '2', date: '1 May 2025', amount: '₹1,499', status: 'Paid' },
  { id: '3', date: '1 Apr 2025', amount: '₹1,499', status: 'Paid' },
  { id: '4', date: '1 Mar 2025', amount: '₹1,499', status: 'Paid' },
]

// ─── GST API Connection Status ──────────────────────────────────────────
interface ApiConnection {
  id: string
  name: string
  description: string
  status: 'Connected' | 'Disconnected' | 'Not Configured'
  lastSync?: string
  icon: React.ReactNode
}

const MOCK_API_CONNECTIONS: ApiConnection[] = [
  { id: 'gst-portal', name: 'GST Portal API', description: 'GSTN portal for filing returns and viewing status', status: 'Connected', lastSync: '5 minutes ago', icon: <Globe className="h-4 w-4" /> },
  { id: 'eway-bill', name: 'E-Way Bill API', description: 'Generate and manage e-way bills for transport', status: 'Disconnected', lastSync: '2 hours ago', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'e-invoice', name: 'E-Invoice API', description: 'IRN generation and e-invoice management', status: 'Not Configured', icon: <ClipboardList className="h-4 w-4" /> },
]

// ─── Audit Log Entry ──────────────────────────────────────────────────
interface AuditLogEntry {
  id: string
  timestamp: string
  user: string
  action: string
  entity: string
  actionType: 'filing' | 'client_update' | 'invoice' | 'settings' | 'reconciliation'
}

const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  { id: '1', timestamp: '2025-06-04 14:32', user: 'Rajesh Kumar', action: 'Filed GSTR-1 for Sharma Enterprises', entity: 'GSTR-1 May 2025', actionType: 'filing' },
  { id: '2', timestamp: '2025-06-04 13:15', user: 'Priya Sharma', action: 'Updated client Patel & Sons', entity: 'Client Profile', actionType: 'client_update' },
  { id: '3', timestamp: '2025-06-04 11:48', user: 'Rajesh Kumar', action: 'Uploaded 24 invoices for Krishna Traders', entity: 'Invoice Batch', actionType: 'invoice' },
  { id: '4', timestamp: '2025-06-04 10:30', user: 'Amit Patel', action: 'Reconciled GSTR-2B for Metro Retail Solutions', entity: 'Reconciliation', actionType: 'reconciliation' },
  { id: '5', timestamp: '2025-06-03 17:22', user: 'Priya Sharma', action: 'Changed notification preferences', entity: 'Settings', actionType: 'settings' },
  { id: '6', timestamp: '2025-06-03 16:10', user: 'Rajesh Kumar', action: 'Filed GSTR-3B for Sunrise Exports Ltd', entity: 'GSTR-3B May 2025', actionType: 'filing' },
  { id: '7', timestamp: '2025-06-03 14:45', user: 'Amit Patel', action: 'Approved 6 invoices for Gupta Manufacturing', entity: 'Invoice Queue', actionType: 'invoice' },
  { id: '8', timestamp: '2025-06-03 11:20', user: 'Priya Sharma', action: 'Added new client Digital Commerce India', entity: 'Client Profile', actionType: 'client_update' },
  { id: '9', timestamp: '2025-06-02 16:55', user: 'Rajesh Kumar', action: 'Reconciled ITC for Apex Logistics', entity: 'Reconciliation', actionType: 'reconciliation' },
  { id: '10', timestamp: '2025-06-02 10:05', user: 'Amit Patel', action: 'Generated e-way bill for Sharma Enterprises', entity: 'E-Way Bill', actionType: 'invoice' },
]

// ─── Save Button with Animated States ──────────────────────────────────
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
      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[110px]"
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

// ─── Password Strength Helper ──────────────────────────────────────────
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 20, label: 'Weak', color: 'bg-red-500' }
  if (score <= 2) return { score: 40, label: 'Fair', color: 'bg-orange-500' }
  if (score <= 3) return { score: 60, label: 'Good', color: 'bg-yellow-500' }
  if (score <= 4) return { score: 80, label: 'Strong', color: 'bg-emerald-500' }
  return { score: 100, label: 'Excellent', color: 'bg-emerald-600' }
}

// ─── Section Content Animation Variants ─────────────────────────────────
const contentVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user } = useAuth()
  const { organization, reload: reloadOrg } = useOrg()
  const orgId = organization?.id ?? null
  const isMobile = useIsMobile()

  // ── Active Section ──────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<SectionId>('firm')

  // ── Logo upload state ───────────────────────────────────────────────
  // `logoPreview` holds a local object-URL while the upload is in flight so
  // the avatar reflects the new image instantly. Once the Firestore write
  // completes, `organization.logoUrl` becomes the source of truth.
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  // Track whether we've hydrated local form state from the org doc — we only
  // want to do this once per organization to avoid clobbering in-progress edits.
  const orgInitializedRef = useRef<string | null>(null)

  // ── Firm Profile State ──────────────────────────────────────────────
  const [firmName, setFirmName] = useState('Sharma & Associates')
  const [legalName, setLegalName] = useState('Sharma & Associates Chartered Accountants LLP')
  const [firmGstin, setFirmGstin] = useState('27AAACR5055K1ZB')
  const [firmState, setFirmState] = useState('Maharashtra')
  const [entityType, setEntityType] = useState('LLP')
  const [caRegNumber, setCaRegNumber] = useState('ICAI/M/042817')
  const [officeAddress, setOfficeAddress] = useState('302, Lotus Business Park, Link Road, Andheri West, Mumbai - 400053')

  // ── GST Config State ────────────────────────────────────────────────
  const [returnPeriod, setReturnPeriod] = useState<'monthly' | 'quarterly'>('monthly')
  const [fyStart, setFyStart] = useState<'april' | 'january'>('april')
  const [gstr1Pref, setGstr1Pref] = useState<'auto' | 'manual'>('auto')
  const [gstr3bPref, setGstr3bPref] = useState<'auto' | 'manual'>('auto')
  const [itcMethod, setItcMethod] = useState<'auto-match' | 'manual-review'>('auto-match')
  const [lateFilingAlert, setLateFilingAlert] = useState(true)
  const [dueDateReminderDays, setDueDateReminderDays] = useState('3')

  // ── Team State ──────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Staff' | 'Viewer'>('Staff')
  const [inviting, setInviting] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<string>('')

  // ── Notifications State ─────────────────────────────────────────────
  const [filingDeadline, setFilingDeadline] = useState(true)
  const [mismatchAlerts, setMismatchAlerts] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(false)
  const [healthScoreChanges, setHealthScoreChanges] = useState(true)
  const [teamActivity, setTeamActivity] = useState(false)
  const [newInvoiceUploaded, setNewInvoiceUploaded] = useState(true)

  // ── Security State ──────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  // ── Audit Log Filter ──────────────────────────────────────────────
  const [auditFilter, setAuditFilter] = useState<string>('all')

  // ── GSTIN Validation ────────────────────────────────────────────────
  const isGstinValid = (gstin: string) => {
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    return regex.test(gstin.toUpperCase())
  }
  const gstinValidation = firmGstin ? isGstinValid(firmGstin) : null

  // ── Hydrate form state from the organization doc (once per org) ─────
  useEffect(() => {
    if (!organization) return
    if (orgInitializedRef.current === organization.id) return
    orgInitializedRef.current = organization.id

    if (organization.name) setFirmName(organization.name)
    if (organization.gstin) setFirmGstin(organization.gstin)

    // Extended fields may or may not exist on every org doc — read defensively.
    const anyOrg = organization as Record<string, unknown>
    if (typeof anyOrg.legalName === 'string' && anyOrg.legalName) setLegalName(anyOrg.legalName)
    if (typeof anyOrg.state === 'string' && anyOrg.state) setFirmState(anyOrg.state)
    if (typeof anyOrg.entityType === 'string' && anyOrg.entityType) setEntityType(anyOrg.entityType)
    if (typeof anyOrg.caRegNumber === 'string' && anyOrg.caRegNumber) setCaRegNumber(anyOrg.caRegNumber)
    if (typeof anyOrg.officeAddress === 'string' && anyOrg.officeAddress) setOfficeAddress(anyOrg.officeAddress)
    if (anyOrg.gstConfig && typeof anyOrg.gstConfig === 'object') {
      const c = anyOrg.gstConfig
      if (c.returnPeriod === 'monthly' || c.returnPeriod === 'quarterly') setReturnPeriod(c.returnPeriod)
      if (c.fyStart === 'april' || c.fyStart === 'january') setFyStart(c.fyStart)
      if (c.gstr1Pref === 'auto' || c.gstr1Pref === 'manual') setGstr1Pref(c.gstr1Pref)
      if (c.gstr3bPref === 'auto' || c.gstr3bPref === 'manual') setGstr3bPref(c.gstr3bPref)
      if (c.itcMethod === 'auto-match' || c.itcMethod === 'manual-review') setItcMethod(c.itcMethod)
      if (typeof c.lateFilingAlert === 'boolean') setLateFilingAlert(c.lateFilingAlert)
      if (typeof c.dueDateReminderDays === 'number') setDueDateReminderDays(String(c.dueDateReminderDays))
    }
    if (anyOrg.notifications && typeof anyOrg.notifications === 'object') {
      const n = anyOrg.notifications
      if (typeof n.filingDeadline === 'boolean') setFilingDeadline(n.filingDeadline)
      if (typeof n.mismatchAlerts === 'boolean') setMismatchAlerts(n.mismatchAlerts)
      if (typeof n.weeklySummary === 'boolean') setWeeklySummary(n.weeklySummary)
      if (typeof n.healthScoreChanges === 'boolean') setHealthScoreChanges(n.healthScoreChanges)
      if (typeof n.teamActivity === 'boolean') setTeamActivity(n.teamActivity)
      if (typeof n.newInvoiceUploaded === 'boolean') setNewInvoiceUploaded(n.newInvoiceUploaded)
    }
  }, [organization])

  // ── Handlers ────────────────────────────────────────────────────────
  // Every Save button persists to Firestore `organizations/{orgId}`. Org-level
  // writes satisfy the Firestore security rules because the signed-in user is
  // a member of the org (owner/admin for the membership row). `reloadOrg()` is
  // called after each successful write so the navbar / sidebar / context
  // reflect the new value immediately.

  const handleSaveFirmProfile = async () => {
    if (!orgId) {
      toast.error('No organization loaded. Please reload the page.')
      throw new Error('No organization')
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        name: firmName,
        legalName,
        gstin: firmGstin,
        state: firmState,
        entityType,
        caRegNumber,
        officeAddress,
        updatedAt: serverTimestamp(),
      })
      await reloadOrg()
      toast.success('Firm profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save firm profile')
      throw err
    }
  }

  const handleSaveGstConfig = async () => {
    if (!orgId) {
      toast.error('No organization loaded. Please reload the page.')
      throw new Error('No organization')
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        gstConfig: {
          returnPeriod,
          fyStart,
          gstr1Pref,
          gstr3bPref,
          itcMethod,
          lateFilingAlert,
          dueDateReminderDays: parseInt(dueDateReminderDays, 10) || 3,
        },
        updatedAt: serverTimestamp(),
      })
      await reloadOrg()
      toast.success('GST configuration saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save GST configuration')
      throw err
    }
  }

  const handleSaveNotifications = async () => {
    if (!orgId) {
      toast.error('No organization loaded. Please reload the page.')
      throw new Error('No organization')
    }
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        notifications: {
          filingDeadline,
          mismatchAlerts,
          weeklySummary,
          healthScoreChanges,
          teamActivity,
          newInvoiceUploaded,
        },
        updatedAt: serverTimestamp(),
      })
      await reloadOrg()
      toast.success('Notification preferences saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notifications')
      throw err
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      throw new Error('Password mismatch')
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      throw new Error('Password too short')
    }
    try {
      const fbUser = auth.currentUser
      if (!fbUser) {
        throw new Error('No authenticated user. Please sign in again.')
      }
      await updatePassword(fbUser, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated successfully')
    } catch (err) {
      // Firebase throws auth/requires-recent-login if the user hasn't signed
      // in recently — surface that hint to the user.
      const raw = err instanceof Error ? err.message : 'Failed to change password'
      const friendly = raw.includes('requires-recent-login')
        ? 'For your security, please sign out and sign back in, then try again.'
        : raw
      toast.error(friendly)
      throw err
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset the input so the same file can be re-selected later.
    e.target.value = ''
    if (!file) return
    if (!orgId) {
      toast.error('No organization loaded. Please reload the page.')
      return
    }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Logo must be a PNG, JPG, or WebP file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2 MB')
      return
    }
    setLogoUploading(true)
    // Show a local preview immediately so the user sees feedback before the
    // upload completes. Revoked on failure / after the org reload swaps in the
    // canonical Firestore-backed URL.
    const localPreviewUrl = URL.createObjectURL(file)
    setLogoPreview(localPreviewUrl)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const fileRef = storageRef(storage, `organizations/${orgId}/logo.${ext}`)
      await uploadBytes(fileRef, file)
      const downloadUrl = await getDownloadURL(fileRef)
      await updateDoc(doc(db, 'organizations', orgId), {
        logoUrl: downloadUrl,
        updatedAt: serverTimestamp(),
      })
      await reloadOrg()
      toast.success('Firm logo updated')
    } catch (err) {
      setLogoPreview(null)
      URL.revokeObjectURL(localPreviewUrl)
      const msg = err instanceof Error ? err.message : 'Failed to upload logo'
      toast.error(msg)
    } finally {
      setLogoUploading(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole.toLowerCase(),
          permissions: [
            inviteRole === 'Manager' ? 'read' : 'read',
            inviteRole === 'Manager' ? 'update' : 'create',
            ...(inviteRole === 'Manager' ? ['file'] : []),
          ],
          invitedBy: user?.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to send invite')
      }
      // Optimistically add the invited member to the visible list
      const initials = inviteEmail.split('@')[0].slice(0, 2).toUpperCase()
      const newMember: TeamMember = {
        id: data?.teamMember?.id ?? Date.now().toString(),
        name: data?.teamMember?.name ?? inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole,
        status: 'Invited',
        initials,
      }
      setTeamMembers(prev => [...prev, newMember])
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteRole('Staff')
      setShowInviteDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return
    try {
      const res = await fetch(`/api/team-members/${memberToRemove.id}?removedBy=${encodeURIComponent(user?.id ?? '')}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to remove member')
      }
      setTeamMembers(prev => prev.filter(m => m.id !== memberToRemove.id))
      toast.success(`${memberToRemove.name} removed from team`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setShowRemoveDialog(false)
      setMemberToRemove(null)
    }
  }

  const handleUpdateRole = async (memberId: string, role: string) => {
    const member = teamMembers.find(m => m.id === memberId)
    if (!member) return
    try {
      const res = await fetch(`/api/team-members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role.toLowerCase(),
          updatedBy: user?.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Failed to update role')
      }
      setTeamMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role: role as TeamMember['role'] } : m
      ))
      toast.success(`${member.name}'s role updated to ${role}`)
      setEditingMemberId(null)
      setEditRole('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  // ── Password strength ───────────────────────────────────────────────
  const passwordStrength = getPasswordStrength(newPassword)

  // ── Role Badge Color ────────────────────────────────────────────────
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
      case 'Manager': return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800'
      case 'Staff': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
      case 'Viewer': return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700'
      default: return ''
    }
  }

  const getStatusBadgeClass = (status: string) => {
    return status === 'Active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER SECTION CONTENT
  // ═══════════════════════════════════════════════════════════════════
  const renderSection = () => {
    switch (activeSection) {
      // ───────────────────────────────────────────────────────────────
      // SECTION 1: FIRM PROFILE
      // ───────────────────────────────────────────────────────────────
      case 'firm':
        return (
          <motion.div
            key="firm"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-foreground">Firm Profile</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your CA firm details used across all GST filings</p>
            </div>

            <Card className="border-border/50">
              <CardContent className="pt-6 space-y-6">
                {/* Logo Upload */}
                <div className="flex items-center gap-5">
                  <div className="relative group">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-600/20 overflow-hidden">
                      {/* Render the uploaded logo (Firestore-backed URL or local
                          in-flight preview) when available; otherwise fall back
                          to the firm-initials mark so the logo never disappears. */}
                      {(logoPreview || organization?.logoUrl) ? (
                        <img
                          src={(logoPreview || organization!.logoUrl) as string}
                          alt={firmName || 'Firm logo'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {firmName.split(' ').filter(w => w === '&' || w.length > 1).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      aria-label="Upload firm logo"
                      className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {logoUploading ? (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                      ) : (
                        <Camera className="h-5 w-5 text-white" />
                      )}
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Firm Logo</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {logoUploading ? 'Uploading...' : 'Click the avatar to upload a logo'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Recommended: 200×200px, PNG, JPG, or WebP (max 2 MB)</p>
                  </div>
                </div>

                <Separator />

                {/* Firm Name & Legal Name */}
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
                    <Label htmlFor="legalName" className="text-sm font-medium">Legal Name</Label>
                    <Input
                      id="legalName"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      placeholder="Enter legal name as per registration"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* GSTIN & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    {gstinValidation === true && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Valid GSTIN format</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Registration State</Label>
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
                </div>

                {/* Entity Type & CA Reg Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Entity Type</Label>
                    <Select value={entityType} onValueChange={setEntityType}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caRegNumber" className="text-sm font-medium">CA Registration Number</Label>
                    <Input
                      id="caRegNumber"
                      value={caRegNumber}
                      onChange={(e) => setCaRegNumber(e.target.value)}
                      placeholder="ICAI/M/000000"
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Office Address */}
                <div className="space-y-2">
                  <Label htmlFor="officeAddress" className="text-sm font-medium">Office Address</Label>
                  <Textarea
                    id="officeAddress"
                    value={officeAddress}
                    onChange={(e) => setOfficeAddress(e.target.value)}
                    placeholder="Enter complete office address"
                    className="min-h-[80px] resize-none"
                  />
                </div>

                {/* Save */}
                <div className="flex justify-end pt-2">
                  <SaveButton onSave={handleSaveFirmProfile} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION 2: GST CONFIGURATION
      // ───────────────────────────────────────────────────────────────
      case 'gst':
        return (
          <motion.div
            key="gst"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-foreground">GST Configuration</h2>
              <p className="text-sm text-muted-foreground mt-1">Configure default GST filing preferences and automation rules</p>
            </div>

            <Card className="border-border/50">
              <CardContent className="pt-6 space-y-6">
                {/* Default Return Period */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Default Return Period</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Set the default filing frequency for new clients</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReturnPeriod('monthly')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        returnPeriod === 'monthly'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setReturnPeriod('quarterly')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        returnPeriod === 'quarterly'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Quarterly
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Financial Year Start */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Financial Year Start</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Start month for financial year calculations</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFyStart('april')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        fyStart === 'april'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      April
                    </button>
                    <button
                      onClick={() => setFyStart('january')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        fyStart === 'january'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      January
                    </button>
                  </div>
                </div>

                <Separator />

                {/* GSTR-1 Filing Preference */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">GSTR-1 Filing Preference</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Auto-fill from sales register or manual entry</p>
                  </div>
                  <Select value={gstr1Pref} onValueChange={(v) => setGstr1Pref(v as 'auto' | 'manual')}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* GSTR-3B Filing Preference */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">GSTR-3B Filing Preference</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Auto-compute liability or manual entry</p>
                  </div>
                  <Select value={gstr3bPref} onValueChange={(v) => setGstr3bPref(v as 'auto' | 'manual')}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ITC Claiming Method */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">ITC Claiming Method</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Auto-match with GSTR-2A or manual review</p>
                  </div>
                  <Select value={itcMethod} onValueChange={(v) => setItcMethod(v as 'auto-match' | 'manual-review')}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto-match">Auto-match</SelectItem>
                      <SelectItem value="manual-review">Manual review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Late Filing Penalty Alert */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Late Filing Penalty Alert</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Get notified when penalty is applicable</p>
                    </div>
                  </div>
                  <Switch
                    checked={lateFilingAlert}
                    onCheckedChange={setLateFilingAlert}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                {/* Due Date Reminder Days */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Due Date Reminder Days</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Days before due date to send reminder</p>
                  </div>
                  <Input
                    type="number"
                    value={dueDateReminderDays}
                    onChange={(e) => setDueDateReminderDays(e.target.value)}
                    min={1}
                    max={30}
                    className="w-[80px] h-9 text-center"
                  />
                </div>

                {/* Save */}
                <div className="flex justify-end pt-2">
                  <SaveButton onSave={handleSaveGstConfig} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION 3: TEAM MEMBERS
      // ───────────────────────────────────────────────────────────────
      case 'team':
        return (
          <motion.div
            key="team"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Team Members</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage your team and their access levels</p>
              </div>
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Users className="h-4 w-4" />
                Invite Team Member
              </Button>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member) => (
                <Card key={member.id} className="border-border/50 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200">
                  <CardContent className="pt-0 py-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-semibold">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{member.name}</p>
                          <Badge className={`text-[11px] px-2 py-0 border ${getRoleBadgeClass(member.role)}`}>
                            {member.role}
                          </Badge>
                          <Badge className={`text-[11px] px-2 py-0 border ${getStatusBadgeClass(member.status)}`}>
                            {member.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                      </div>

                      {/* Edit Role */}
                      {editingMemberId === member.id ? (
                        <div className="flex items-center gap-2">
                          <Select value={editRole} onValueChange={(v) => setEditRole(v)}>
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Admin">Admin</SelectItem>
                              <SelectItem value="Manager">Manager</SelectItem>
                              <SelectItem value="Staff">Staff</SelectItem>
                              <SelectItem value="Viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleUpdateRole(member.id, editRole)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {member.role !== 'Admin' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingMemberId(member.id)
                                  setEditRole(member.role)
                                }}
                              >
                                Edit role
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => {
                                  setMemberToRemove(member)
                                  setShowRemoveDialog(true)
                                }}
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {teamMembers.length === 0 && (
              <Card className="border-border/50 border-dashed">
                <CardContent className="pt-6 text-center py-12">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No team members yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Invite your first team member to get started</p>
                </CardContent>
              </Card>
            )}

            {/* Invite Dialog */}
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    Invite Team Member
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email Address</Label>
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@firm.com"
                      type="email"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'Manager' | 'Staff' | 'Viewer')}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Admin role can only be assigned by existing admins</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowInviteDialog(false)}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInviteMember}
                    disabled={!inviteEmail.trim() || inviting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Send Invite
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Remove Confirmation */}
            <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Remove Team Member?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {memberToRemove && (
                      <>Are you sure you want to remove <strong>{memberToRemove.name}</strong> from your team? They will lose access to all firm data immediately.</>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemoveMember}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Remove Member
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION 4: NOTIFICATIONS
      // ───────────────────────────────────────────────────────────────
      case 'notifications':
        return (
          <motion.div
            key="notifications"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose what notifications you want to receive</p>
            </div>

            <Card className="border-border/50">
              <CardContent className="pt-6 space-y-1">
                {/* Filing Deadline Reminders */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CalendarClock className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Filing Deadline Reminders</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Get notified before GST filing due dates</p>
                    </div>
                  </div>
                  <Switch
                    checked={filingDeadline}
                    onCheckedChange={setFilingDeadline}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <Separator />

                {/* Mismatch Alerts */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertTriangle className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Mismatch Alerts</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Alert when GSTR-2A vs books mismatches are detected</p>
                    </div>
                  </div>
                  <Switch
                    checked={mismatchAlerts}
                    onCheckedChange={setMismatchAlerts}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <Separator />

                {/* Weekly Summary Email */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 shrink-0">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Weekly Summary Email</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Receive a weekly digest of filing statuses and activity</p>
                    </div>
                  </div>
                  <Switch
                    checked={weeklySummary}
                    onCheckedChange={setWeeklySummary}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <Separator />

                {/* Client Health Score Changes */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shrink-0">
                      <Activity className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Client Health Score Changes</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Alert when a client&apos;s health score drops significantly</p>
                    </div>
                  </div>
                  <Switch
                    checked={healthScoreChanges}
                    onCheckedChange={setHealthScoreChanges}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <Separator />

                {/* Team Activity Updates */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Team Activity Updates</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Notifications when team members complete filings or actions</p>
                    </div>
                  </div>
                  <Switch
                    checked={teamActivity}
                    onCheckedChange={setTeamActivity}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <Separator />

                {/* New Invoice Uploaded */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Upload className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">New Invoice Uploaded</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Notify when clients upload new invoices or documents</p>
                    </div>
                  </div>
                  <Switch
                    checked={newInvoiceUploaded}
                    onCheckedChange={setNewInvoiceUploaded}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                {/* Save */}
                <div className="flex justify-end pt-4">
                  <SaveButton onSave={handleSaveNotifications} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION 5: SECURITY
      // ───────────────────────────────────────────────────────────────
      case 'security':
        return (
          <motion.div
            key="security"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-foreground">Security</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your password, two-factor authentication, and sessions</p>
            </div>

            {/* Change Password */}
            <Card className="border-border/50">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Lock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Change Password</CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="h-10"
                    />
                    {newPassword && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Strength</span>
                          <span className={`text-[11px] font-medium ${
                            passwordStrength.score <= 40 ? 'text-red-500' :
                            passwordStrength.score <= 60 ? 'text-yellow-600' :
                            'text-emerald-600'
                          }`}>{passwordStrength.label}</span>
                        </div>
                        <Progress value={passwordStrength.score} className={`h-1.5 ${passwordStrength.color}`} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Confirm Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`h-10 ${confirmPassword && newPassword !== confirmPassword ? 'border-red-300 focus-visible:ring-red-400' : confirmPassword && newPassword === confirmPassword ? 'border-emerald-300 focus-visible:ring-emerald-400' : ''}`}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[11px] text-red-500">Passwords do not match</p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && newPassword.length > 0 && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">Passwords match</p>
                    )}
                  </div>
                </div>
                {newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                  <div className="flex justify-end">
                    <SaveButton onSave={handleChangePassword} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card className="border-border/50">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 shrink-0">
                    <Shield className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
                    <CardDescription>Add an extra layer of security to your account</CardDescription>
                  </div>
                  <Badge className={`text-[11px] px-2.5 py-0.5 border ${
                    twoFactorEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}>
                    {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {twoFactorEnabled ? 'Two-factor authentication is enabled' : 'Enable two-factor authentication'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {twoFactorEnabled
                        ? 'Your account is protected with an additional verification step'
                        : 'Protect your account with OTP verification on login'}
                    </p>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card className="border-border/50">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
                    <Smartphone className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Active Sessions</CardTitle>
                    <CardDescription>Devices currently signed in to your account</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {MOCK_SESSIONS.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        session.current
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-slate-900/50 border border-transparent'
                      }`}
                    >
                      <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${
                        session.current
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {session.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{session.device}</p>
                          {session.current && (
                            <Badge className="text-[10px] px-1.5 py-0 border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{session.location} · {session.lastActive}</p>
                      </div>
                      {!session.current && (
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8">
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Encryption */}
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <LockKeyhole className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Your data is encrypted at rest and in transit</p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">All sensitive data is protected using AES-256 encryption with TLS 1.3 for data in transit</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION 6: BILLING
      // ───────────────────────────────────────────────────────────────
      case 'billing':
        return (
          <motion.div
            key="billing"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-foreground">Billing</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your subscription, payment methods, and invoices</p>
            </div>

            {/* Current Plan */}
            <Card className="border-border/50 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">Professional Plan</h3>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[11px]">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-3xl font-bold text-foreground">₹1,499</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Next billing date: <span className="font-medium text-foreground">1 July 2025</span>
                    </p>
                  </div>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <ChevronRight className="h-4 w-4" />
                    Upgrade Plan
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Usage This Month */}
            <Card className="border-border/50">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Usage This Month</CardTitle>
                <CardDescription>Your current usage against plan limits</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                {/* Clients */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Clients</span>
                    </div>
                    <span className="text-sm text-muted-foreground">12 / 25</span>
                  </div>
                  <Progress value={48} className="h-2 bg-emerald-100 dark:bg-emerald-950 [&>div]:bg-emerald-500" />
                </div>

                {/* Invoices Processed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Invoices Processed</span>
                    </div>
                    <span className="text-sm text-muted-foreground">347 / 1,000</span>
                  </div>
                  <Progress value={34.7} className="h-2 bg-teal-100 dark:bg-teal-950 [&>div]:bg-teal-500" />
                </div>

                {/* Reconciliation Runs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Reconciliation Runs</span>
                    </div>
                    <span className="text-sm text-muted-foreground">23 / 50</span>
                  </div>
                  <Progress value={46} className="h-2 bg-amber-100 dark:bg-amber-950 [&>div]:bg-amber-500" />
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="border-border/50">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-14 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 text-white text-[10px] font-bold tracking-wider">
                      VISA
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">•••• •••• •••• 4242</p>
                      <p className="text-xs text-muted-foreground">Expires 12/2025</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 h-8">
                    Update Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Billing History */}
            <Card className="border-border/50">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Billing History</CardTitle>
                <CardDescription>Download past invoices</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {BILLING_HISTORY.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{invoice.date}</p>
                          <p className="text-xs text-muted-foreground">{invoice.amount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`text-[11px] px-2 py-0 border ${
                          invoice.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : invoice.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
                        }`}>
                          {invoice.status}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION: GST API CONNECTIONS
      // ───────────────────────────────────────────────────────────────
      case 'api':
        return (
          <motion.div
            key="api"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-semibold text-foreground">GST API Connections</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage connections to GST portal and government APIs</p>
            </div>

            <div className="space-y-4">
              {MOCK_API_CONNECTIONS.map((connection) => (
                <Card key={connection.id} className="border-border/50 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200">
                  <CardContent className="pt-0 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center h-10 w-10 rounded-xl shrink-0 ${
                        connection.status === 'Connected'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : connection.status === 'Disconnected'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}>
                        {connection.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{connection.name}</p>
                          <Badge className={`text-[10px] px-2 py-0 border ${
                            connection.status === 'Connected'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                              : connection.status === 'Disconnected'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}>
                            <span className={`size-1.5 rounded-full mr-1 ${
                              connection.status === 'Connected' ? 'bg-emerald-500' : connection.status === 'Disconnected' ? 'bg-amber-500' : 'bg-slate-400'
                            }`} />
                            {connection.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{connection.description}</p>
                        {connection.lastSync && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Last synced: {connection.lastSync}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5"
                          onClick={async () => {
                            try {
                              // Test by hitting the GSTN connect endpoint with the
                              // firm's own GSTIN — if it returns a valid profile,
                              // the connection is healthy.
                              const res = await fetch('/api/connect/gstn', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  userId: user?.id ?? 'system-test',
                                  gstin: firmGstin || '27AABCS1429B1Z5',
                                }),
                              })
                              const data = await res.json()
                              if (!res.ok) {
                                throw new Error(data?.error ?? 'Test failed')
                              }
                              toast.success(`${connection.name} — connection OK`)
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Test failed')
                            }
                          }}
                        >
                          <Activity className="h-3.5 w-3.5" />
                          Test Connection
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => toast.info(`Configure ${connection.name} — coming soon`)}
                        >
                          Configure
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )

      // ───────────────────────────────────────────────────────────────
      // SECTION: AUDIT LOGS
      // ───────────────────────────────────────────────────────────────
      case 'audit':
        return (
          <motion.div
            key="audit"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={contentVariants}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Audit Logs</h2>
                <p className="text-sm text-muted-foreground mt-1">Track all actions performed across your firm</p>
              </div>
              <Select value={auditFilter} onValueChange={setAuditFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="filing">Filing</SelectItem>
                  <SelectItem value="client_update">Client Updates</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="reconciliation">Reconciliation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="border-border/50">
              <CardContent className="pt-6 p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  <div className="divide-y divide-border/50">
                    {MOCK_AUDIT_LOGS
                      .filter(log => auditFilter === 'all' || log.actionType === auditFilter)
                      .map((log, idx) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.03 }}
                        className="flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5 ${
                          log.actionType === 'filing'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : log.actionType === 'client_update'
                            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400'
                            : log.actionType === 'invoice'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                            : log.actionType === 'reconciliation'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {log.actionType === 'filing' ? <ClipboardList className="h-4 w-4" /> :
                           log.actionType === 'invoice' ? <Upload className="h-4 w-4" /> :
                           log.actionType === 'reconciliation' ? <Activity className="h-4 w-4" /> :
                           <Shield className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{log.action}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{log.entity}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{log.user}</span>
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {log.timestamp}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                {MOCK_AUDIT_LOGS.filter(log => auditFilter === 'all' || log.actionType === auditFilter).length === 0 && (
                  <div className="py-12 text-center">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No audit logs match this filter</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )

      default:
        return null
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col">
      {/* ── Mobile: Horizontal Scrollable Tabs ── */}
      {isMobile && (
        <div className="border-b border-border bg-background px-4 pt-4">
          <h1 className="text-xl font-bold text-foreground mb-3">Settings</h1>
          <div className="flex gap-1 overflow-x-auto pb-0 -mb-px scrollbar-hide">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                  activeSection === section.id
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* ── Desktop: Left Navigation ── */}
        {!isMobile && (
          <aside className="w-[220px] shrink-0 border-r border-border bg-slate-50/50 dark:bg-slate-900/30 flex flex-col">
            <div className="p-5 pb-4">
              <h1 className="text-lg font-bold text-foreground">Settings</h1>
            </div>

            <nav className="flex-1 px-3 space-y-0.5">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    activeSection === section.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-l-[3px] border-emerald-600 pl-[9px]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50 border-l-[3px] border-transparent'
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </nav>

            {/* Version & Status */}
            <div className="p-4 border-t border-border mt-auto">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground font-medium">GSTPilot</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40">
                  v1.0.0
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-muted-foreground">Online</span>
              </div>
            </div>
          </aside>
        )}

        {/* ── Right Content Area ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              {renderSection()}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
