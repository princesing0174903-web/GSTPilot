'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Business Memory™ Panel
//
// Slide-in panel from the right with 8 tabs:
//   Profile · Firm · Goals · Preferences · Clients · Financial · Conversations · Insights
//
// User can view, edit, delete, and pin memories. Changes save instantly to
// /api/memory/* endpoints. Oracle automatically uses this memory in every response.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, X, Plus, Trash2, Pin, PinOff, Save, User, Building2,
  Target, Settings, Users, TrendingUp, MessageSquare, Lightbulb,
  Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
  userEmail: string | undefined;
}

type TabId = 'profile' | 'firm' | 'goals' | 'preferences' | 'clients' | 'financial' | 'conversations' | 'insights';

interface FullMemory {
  profile: {
    name: string | null;
    role: string | null;
    designation: string | null;
    firmName: string | null;
    industry: string | null;
    city: string | null;
    timezone: string | null;
    preferredLanguage: string | null;
  } | null;
  firm: {
    caFirmName: string | null;
    employeeCount: number;
    clientCount: number;
    industriesServed: string[];
    gstRegistrations: string[];
    branches: string[];
    servicesOffered: string[];
  } | null;
  goals: Array<{ id: string; type: string; target: string; period: string | null; notes: string | null; pinned: boolean }>;
  preferences: {
    theme: string | null;
    notifications: { email: boolean; whatsapp: boolean; push: boolean };
    reportFormat: string | null;
    reminderFrequency: string | null;
    communicationMethod: string | null;
  } | null;
  clientMemories: Array<{ id: string; clientId: string; clientName: string; clientGstin: string; paymentBehaviour: string | null; riskNotes: string | null; customNotes: string | null; pinned: boolean }>;
  financialMetrics: Array<{ id: string; metricType: string; period: string | null; value: number; trend: string | null; annotation: string | null; pinned: boolean }>;
  conversations: Array<{ id: string; userMessage: string; oracleResponse: string; role: string | null; fn: string | null; summary: string | null; createdAt: string }>;
  insights: Array<{ id: string; category: string; content: string; source: string; pinned: boolean; createdAt: string }>;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: Array<{ id: TabId; label: string; icon: typeof Brain }> = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'firm', label: 'Firm', icon: Building2 },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'financial', label: 'Financial', icon: TrendingUp },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MemoryPanel({ open, onClose, userEmail }: MemoryPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [memory, setMemory] = useState<FullMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchMemory = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/memory?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to load memory');
      const data = await res.json();
      setMemory(data.memory);
    } catch (err) {
      toast.error('Failed to load memory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (open && userEmail) {
      fetchMemory();
    }
  }, [open, userEmail, fetchMemory]);

  // ── Generic save helper for profile/firm/preferences ──
  const saveCategory = async (category: 'profile' | 'firm' | 'preferences', data: Record<string, unknown>) => {
    if (!userEmail) return;
    setSaving(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, category, data }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Memory saved', { duration: 1500 });
      await fetchMemory();
    } catch (err) {
      toast.error('Failed to save');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
                <Brain className="h-4 w-4 accent-text" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Business Memory™</h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {userEmail ? userEmail : 'Sign in to save memory'}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!userEmail ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sign in to start building your Business Memory™. Oracle will remember your profile, firm, goals, and preferences across sessions.
                </p>
              </div>
            ) : loading || !memory ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Tab bar */}
                <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-2 py-2">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? 'accent-gradient-soft accent-text'
                            : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {activeTab === 'profile' && (
                      <ProfileTab key={JSON.stringify(memory.profile)} memory={memory} saving={saving} onSave={(d) => saveCategory('profile', d)} />
                    )}
                    {activeTab === 'firm' && (
                      <FirmTab key={JSON.stringify(memory.firm)} memory={memory} saving={saving} onSave={(d) => saveCategory('firm', d)} />
                    )}
                    {activeTab === 'goals' && (
                      <GoalsTab memory={memory} userEmail={userEmail} onChanged={fetchMemory} />
                    )}
                    {activeTab === 'preferences' && (
                      <PreferencesTab key={JSON.stringify(memory.preferences)} memory={memory} saving={saving} onSave={(d) => saveCategory('preferences', d)} />
                    )}
                    {activeTab === 'clients' && (
                      <ClientsTab memory={memory} userEmail={userEmail} onChanged={fetchMemory} />
                    )}
                    {activeTab === 'financial' && (
                      <FinancialTab memory={memory} userEmail={userEmail} onChanged={fetchMemory} />
                    )}
                    {activeTab === 'conversations' && (
                      <ConversationsTab memory={memory} />
                    )}
                    {activeTab === 'insights' && (
                      <InsightsTab memory={memory} userEmail={userEmail} onChanged={fetchMemory} />
                    )}
                  </div>
                </ScrollArea>

                {/* Footer — clear all */}
                <div className="shrink-0 border-t border-white/[0.06] p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
                    onClick={async () => {
                      if (!confirm('Clear ALL memory? This cannot be undone.')) return;
                      try {
                        await fetch(`/api/memory?email=${encodeURIComponent(userEmail)}`, { method: 'DELETE' });
                        toast.success('All memory cleared');
                        await fetchMemory();
                      } catch {
                        toast.error('Failed to clear memory');
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear All Memory
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Profile
// ═══════════════════════════════════════════════════════════════════════════════

function ProfileTab({ memory, saving, onSave }: { memory: FullMemory; saving: boolean; onSave: (d: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({
    name: memory.profile?.name || '',
    role: memory.profile?.role || '',
    designation: memory.profile?.designation || '',
    firmName: memory.profile?.firmName || '',
    industry: memory.profile?.industry || '',
    city: memory.profile?.city || '',
    timezone: memory.profile?.timezone || 'Asia/Calcutta',
    preferredLanguage: memory.profile?.preferredLanguage || 'English',
  });

  // No useEffect sync needed — parent uses key={JSON.stringify(memory.profile)}
  // to remount this component when memory changes, so useState picks up new values.

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Oracle uses this to greet you by name and tailor responses to your role and industry.
      </p>
      <Field label="Name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Prince Singh" />
      </Field>
      <Field label="Role">
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
          <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="founder">Founder</SelectItem>
            <SelectItem value="ca">Chartered Accountant</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Designation">
        <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Managing Partner" />
      </Field>
      <Field label="Firm / Company Name">
        <Input value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} placeholder="e.g. GSTPilot Infinity" />
      </Field>
      <Field label="Industry">
        <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Manufacturing, Retail, CA Firm" />
      </Field>
      <Field label="City">
        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Mumbai" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timezone">
          <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        </Field>
        <Field label="Preferred Language">
          <Input value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} />
        </Field>
      </div>
      <SaveButton saving={saving} onClick={() => onSave(form)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Firm
// ═══════════════════════════════════════════════════════════════════════════════

function FirmTab({ memory, saving, onSave }: { memory: FullMemory; saving: boolean; onSave: (d: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({
    caFirmName: memory.firm?.caFirmName || '',
    employeeCount: memory.firm?.employeeCount || 0,
    clientCount: memory.firm?.clientCount || 0,
    industriesServed: (memory.firm?.industriesServed || []).join(', '),
    gstRegistrations: (memory.firm?.gstRegistrations || []).join(', '),
    branches: (memory.firm?.branches || []).join(', '),
    servicesOffered: (memory.firm?.servicesOffered || []).join(', '),
  });

  // No useEffect sync needed — parent uses key={JSON.stringify(memory.firm)}

  const buildPayload = () => ({
    caFirmName: form.caFirmName,
    employeeCount: Number(form.employeeCount) || 0,
    clientCount: Number(form.clientCount) || 0,
    industriesServed: form.industriesServed.split(',').map((s) => s.trim()).filter(Boolean),
    gstRegistrations: form.gstRegistrations.split(',').map((s) => s.trim()).filter(Boolean),
    branches: form.branches.split(',').map((s) => s.trim()).filter(Boolean),
    servicesOffered: form.servicesOffered.split(',').map((s) => s.trim()).filter(Boolean),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Oracle uses firm context to scale advice — a 127-client CA firm gets different recommendations than a 5-client boutique.
      </p>
      <Field label="CA Firm / Company Name">
        <Input value={form.caFirmName} onChange={(e) => setForm({ ...form, caFirmName: e.target.value })} placeholder="e.g. Prince & Associates" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employees">
          <Input type="number" value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: Number(e.target.value) })} />
        </Field>
        <Field label="Clients">
          <Input type="number" value={form.clientCount} onChange={(e) => setForm({ ...form, clientCount: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Industries Served (comma-separated)">
        <Input value={form.industriesServed} onChange={(e) => setForm({ ...form, industriesServed: e.target.value })} placeholder="Manufacturing, Retail, Healthcare" />
      </Field>
      <Field label="GST Registrations (comma-separated)">
        <Input value={form.gstRegistrations} onChange={(e) => setForm({ ...form, gstRegistrations: e.target.value })} placeholder="27AABCS1429B1Z5, 29AAACL1234M1Z3" />
      </Field>
      <Field label="Branches (comma-separated)">
        <Input value={form.branches} onChange={(e) => setForm({ ...form, branches: e.target.value })} placeholder="Mumbai, Delhi, Bangalore" />
      </Field>
      <Field label="Services Offered (comma-separated)">
        <Input value={form.servicesOffered} onChange={(e) => setForm({ ...form, servicesOffered: e.target.value })} placeholder="GST Filing, ITR, Audit, ROC Compliance" />
      </Field>
      <SaveButton saving={saving} onClick={() => onSave(buildPayload())} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Goals
// ═══════════════════════════════════════════════════════════════════════════════

function GoalsTab({ memory, userEmail, onChanged }: { memory: FullMemory; userEmail: string; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'revenue', target: '', period: '', notes: '' });

  const addGoal = async () => {
    if (!form.target.trim()) return;
    try {
      await fetch('/api/memory/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, ...form, period: form.period || undefined, notes: form.notes || undefined }),
      });
      setForm({ type: 'revenue', target: '', period: '', notes: '' });
      setShowForm(false);
      onChanged();
      toast.success('Goal added');
    } catch {
      toast.error('Failed to add goal');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Revenue, collection, growth targets Oracle tracks.</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-white/[0.08] p-3">
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="collection">Collection</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="profit">Profit</SelectItem>
                <SelectItem value="expansion">Expansion</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target">
            <Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="e.g. ₹5 Crore" />
          </Field>
          <Field label="Period (optional)">
            <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. FY2025, Q3" />
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </Field>
          <Button size="sm" className="w-full" onClick={addGoal}>Save Goal</Button>
        </div>
      )}

      {memory.goals.length === 0 ? (
        <EmptyState text="No goals set yet. Add your first goal to give Oracle a target to track." />
      ) : (
        <div className="space-y-2">
          {memory.goals.map((g) => (
            <div key={g.id} className="flex items-start gap-2 rounded-lg border border-white/[0.06] p-3">
              <button
                onClick={async () => {
                  await fetch('/api/memory/goal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: g.id, email: userEmail }) });
                  onChanged();
                }}
                className="mt-0.5"
              >
                {g.pinned ? <Pin className="h-3.5 w-3.5 accent-text" /> : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {g.type.charAt(0).toUpperCase() + g.type.slice(1)}: {g.target}
                </p>
                {g.period && <Badge variant="secondary" className="mt-1 text-[10px]">{g.period}</Badge>}
                {g.notes && <p className="mt-1 text-xs text-muted-foreground">{g.notes}</p>}
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/memory/goal?id=${g.id}&email=${encodeURIComponent(userEmail)}`, { method: 'DELETE' });
                  onChanged();
                }}
                className="text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Preferences
// ═══════════════════════════════════════════════════════════════════════════════

function PreferencesTab({ memory, saving, onSave }: { memory: FullMemory; saving: boolean; onSave: (d: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({
    reportFormat: memory.preferences?.reportFormat || 'summary',
    reminderFrequency: memory.preferences?.reminderFrequency || 'daily',
    communicationMethod: memory.preferences?.communicationMethod || 'whatsapp',
    notifications: memory.preferences?.notifications || { email: true, whatsapp: true, push: false },
  });

  // No useEffect sync needed — parent uses key={JSON.stringify(memory.preferences)}

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Oracle tailors report detail, reminder timing, and follow-up channel to your preferences.
      </p>
      <Field label="Report Format">
        <Select value={form.reportFormat} onValueChange={(v) => setForm({ ...form, reportFormat: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="summary">Summary (concise)</SelectItem>
            <SelectItem value="detailed">Detailed (full breakdown)</SelectItem>
            <SelectItem value="executive">Executive (bullet points)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Reminder Frequency">
        <Select value={form.reminderFrequency} onValueChange={(v) => setForm({ ...form, reminderFrequency: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Preferred Communication">
        <Select value={form.communicationMethod} onValueChange={(v) => setForm({ ...form, communicationMethod: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Separator />
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">Notifications</Label>
        <ToggleRow
          label="Email"
          checked={form.notifications.email}
          onChange={(v) => setForm({ ...form, notifications: { ...form.notifications, email: v } })}
        />
        <ToggleRow
          label="WhatsApp"
          checked={form.notifications.whatsapp}
          onChange={(v) => setForm({ ...form, notifications: { ...form.notifications, whatsapp: v } })}
        />
        <ToggleRow
          label="Push"
          checked={form.notifications.push}
          onChange={(v) => setForm({ ...form, notifications: { ...form.notifications, push: v } })}
        />
      </div>
      <SaveButton saving={saving} onClick={() => onSave(form)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Clients
// ═══════════════════════════════════════════════════════════════════════════════

function ClientsTab({ memory, userEmail, onChanged }: { memory: FullMemory; userEmail: string; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ paymentBehaviour: '', riskNotes: '', customNotes: '' });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Observations about each client — payment behaviour, risk notes. Oracle uses this for &quot;who is risky?&quot; questions.
      </p>
      {memory.clientMemories.length === 0 ? (
        <EmptyState text="No client notes yet. Add observations like 'Always pays late' or 'High compliance risk' for each client." />
      ) : (
        <div className="space-y-2">
          {memory.clientMemories.map((cm) => (
            <div key={cm.id} className="rounded-lg border border-white/[0.06] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{cm.clientName}</p>
                  <p className="text-[11px] text-muted-foreground">{cm.clientGstin}</p>
                </div>
                <button
                  onClick={async () => {
                    await fetch('/api/memory/client', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: cm.clientId, email: userEmail }) });
                    onChanged();
                  }}
                >
                  {cm.pinned ? <Pin className="h-3.5 w-3.5 accent-text" /> : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
              {editing === cm.id ? (
                <div className="mt-2 space-y-2">
                  <Input value={form.paymentBehaviour} onChange={(e) => setForm({ ...form, paymentBehaviour: e.target.value })} placeholder="Payment behaviour" className="text-xs" />
                  <Input value={form.riskNotes} onChange={(e) => setForm({ ...form, riskNotes: e.target.value })} placeholder="Risk notes" className="text-xs" />
                  <Textarea value={form.customNotes} onChange={(e) => setForm({ ...form, customNotes: e.target.value })} placeholder="Custom notes" rows={2} className="text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={async () => {
                      await fetch('/api/memory/client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, clientId: cm.clientId, ...form }) });
                      setEditing(null);
                      onChanged();
                    }}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  {cm.paymentBehaviour && <p className="mt-1 text-xs text-muted-foreground">Payment: {cm.paymentBehaviour}</p>}
                  {cm.riskNotes && <p className="text-xs text-muted-foreground">Risk: {cm.riskNotes}</p>}
                  {cm.customNotes && <p className="text-xs text-muted-foreground">{cm.customNotes}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => {
                      setEditing(cm.id);
                      setForm({ paymentBehaviour: cm.paymentBehaviour || '', riskNotes: cm.riskNotes || '', customNotes: cm.customNotes || '' });
                    }}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] text-red-500" onClick={async () => {
                      await fetch(`/api/memory/client?clientId=${cm.clientId}&email=${encodeURIComponent(userEmail)}`, { method: 'DELETE' });
                      onChanged();
                    }}>Delete</Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Financial Memory
// ═══════════════════════════════════════════════════════════════════════════════

function FinancialTab({ memory, userEmail, onChanged }: { memory: FullMemory; userEmail: string; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ metricType: 'revenue', period: '', value: '', trend: 'stable', annotation: '' });

  const add = async () => {
    if (!form.value) return;
    try {
      await fetch('/api/memory/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          metricType: form.metricType,
          period: form.period || undefined,
          value: Number(form.value),
          trend: form.trend,
          annotation: form.annotation || undefined,
        }),
      });
      setForm({ metricType: 'revenue', period: '', value: '', trend: 'stable', annotation: '' });
      setShowForm(false);
      onChanged();
      toast.success('Metric added');
    } catch {
      toast.error('Failed to add metric');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Revenue trends, cash flow patterns, user-annotated observations.</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-white/[0.08] p-3">
          <Field label="Metric Type">
            <Select value={form.metricType} onValueChange={(v) => setForm({ ...form, metricType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="cashflow">Cash Flow</SelectItem>
                <SelectItem value="loan">Loan</SelectItem>
                <SelectItem value="tax">Tax Payment</SelectItem>
                <SelectItem value="collection">Collection</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period">
              <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2025-06" />
            </Field>
            <Field label="Value (₹)">
              <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="1250000" />
            </Field>
          </div>
          <Field label="Trend">
            <Select value={form.trend} onValueChange={(v) => setForm({ ...form, trend: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="up">↑ Up</SelectItem>
                <SelectItem value="down">↓ Down</SelectItem>
                <SelectItem value="stable">→ Stable</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Annotation (optional)">
            <Textarea value={form.annotation} onChange={(e) => setForm({ ...form, annotation: e.target.value })} rows={2} placeholder="e.g. Cash flow weak in Q4" />
          </Field>
          <Button size="sm" className="w-full" onClick={add}>Save Metric</Button>
        </div>
      )}

      {memory.financialMetrics.length === 0 ? (
        <EmptyState text="No financial memory yet. Record patterns like 'Cash flow weak in Q4' so Oracle can factor them into forecasts." />
      ) : (
        <div className="space-y-2">
          {memory.financialMetrics.map((m) => (
            <div key={m.id} className="flex items-start gap-2 rounded-lg border border-white/[0.06] p-3">
              <button
                onClick={async () => {
                  await fetch('/api/memory/financial', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, email: userEmail }) });
                  onChanged();
                }}
              >
                {m.pinned ? <Pin className="h-3.5 w-3.5 accent-text" /> : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground capitalize">
                  {m.metricType} — ₹{m.value.toLocaleString('en-IN')}
                  {m.period && <span className="ml-1 text-xs text-muted-foreground">({m.period})</span>}
                </p>
                {m.trend && <Badge variant="secondary" className="mt-1 text-[10px]">trend: {m.trend}</Badge>}
                {m.annotation && <p className="mt-1 text-xs text-muted-foreground italic">&quot;{m.annotation}&quot;</p>}
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/memory/financial?id=${m.id}&email=${encodeURIComponent(userEmail)}`, { method: 'DELETE' });
                  onChanged();
                }}
                className="text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Conversations (read-only)
// ═══════════════════════════════════════════════════════════════════════════════

function ConversationsTab({ memory }: { memory: FullMemory }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Oracle remembers your last 20 conversations to provide continuity across sessions.
      </p>
      {memory.conversations.length === 0 ? (
        <EmptyState text="No conversations recorded yet. Start chatting with Oracle and your history will appear here." />
      ) : (
        <div className="space-y-2">
          {memory.conversations.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/[0.06] p-3">
              <div className="flex items-center gap-2">
                {c.role && <Badge variant="secondary" className="text-[10px] uppercase">{c.role}</Badge>}
                {c.fn && <Badge variant="outline" className="text-[10px]">{c.fn}</Badge>}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-foreground">{c.userMessage}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {c.oracleResponse.slice(0, 200)}
                {c.oracleResponse.length > 200 ? '…' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab: Insights
// ═══════════════════════════════════════════════════════════════════════════════

function InsightsTab({ memory, userEmail, onChanged }: { memory: FullMemory; userEmail: string; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'pattern', content: '' });

  const add = async () => {
    if (!form.content.trim()) return;
    try {
      await fetch('/api/memory/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, ...form }),
      });
      setForm({ category: 'pattern', content: '' });
      setShowForm(false);
      onChanged();
      toast.success('Insight added');
    } catch {
      toast.error('Failed to add insight');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Patterns, risks, opportunities Oracle has observed or you&apos;ve pinned.</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-white/[0.08] p-3">
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pattern">Pattern</SelectItem>
                <SelectItem value="risk">Risk</SelectItem>
                <SelectItem value="opportunity">Opportunity</SelectItem>
                <SelectItem value="observation">Observation</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Insight">
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} placeholder="e.g. Collections usually slow during month end" />
          </Field>
          <Button size="sm" className="w-full" onClick={add}>Save Insight</Button>
        </div>
      )}

      {memory.insights.length === 0 ? (
        <EmptyState text="No insights yet. Pin patterns like 'Collections slow during month end' so Oracle factors them into advice." />
      ) : (
        <div className="space-y-2">
          {memory.insights.map((i) => (
            <div key={i.id} className="flex items-start gap-2 rounded-lg border border-white/[0.06] p-3">
              <button
                onClick={async () => {
                  await fetch('/api/memory/insight', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: i.id, email: userEmail }) });
                  onChanged();
                }}
              >
                {i.pinned ? <Pin className="h-3.5 w-3.5 accent-text" /> : <PinOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <div className="flex-1 min-w-0">
                <Badge variant="secondary" className="text-[10px]">{i.category}</Badge>
                <p className="mt-1 text-sm text-foreground">{i.content}</p>
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/memory/insight?id=${i.id}&email=${encodeURIComponent(userEmail)}`, { method: 'DELETE' });
                  onChanged();
                }}
                className="text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <Button className="w-full" disabled={saving} onClick={onClick}>
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {saving ? 'Saving…' : 'Save'}
    </Button>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] p-6 text-center">
      <CheckCircle2 className="h-6 w-6 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
