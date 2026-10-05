'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Building, Users, Shield, Activity, Crown,
  ChevronDown, CheckCircle, XCircle, Clock,
  UserCheck, Briefcase, Globe, Settings,
  ArrowUpRight, Plus, Star, Zap,
} from 'lucide-react'

// ── Sample Data ──
const firms = [
  {
    id: 'firm-1', name: 'Sharma & Associates', plan: 'Enterprise',
    clients: 23, teamSize: 6, revenue: '₹8,45,000',
    status: 'active', gstin: '27AABCS5678F1Z5',
    location: 'Mumbai, Maharashtra',
    since: '01/04/2023',
  },
  {
    id: 'firm-2', name: 'Patel Tax Solutions', plan: 'Professional',
    clients: 14, teamSize: 4, revenue: '₹3,12,000',
    status: 'active', gstin: '24AABCP1234G1Z3',
    location: 'Ahmedabad, Gujarat',
    since: '15/06/2023',
  },
  {
    id: 'firm-3', name: 'Kumar GST Consultancy', plan: 'Starter',
    clients: 10, teamSize: 2, revenue: '₹88,000',
    status: 'active', gstin: '29AABCK9012H1Z1',
    location: 'Bengaluru, Karnataka',
    since: '01/09/2024',
  },
]

type Role = 'Owner' | 'Partner' | 'Manager' | 'Staff' | 'Client'

const teamMembers: {
  name: string; role: Role; firm: string; email: string; status: 'online' | 'offline'; lastActive: string
}[] = [
  { name: 'Rajesh Sharma', role: 'Owner', firm: 'Sharma & Associates', email: 'rajesh@sharma.com', status: 'online', lastActive: 'Now' },
  { name: 'Priya Patel', role: 'Partner', firm: 'Sharma & Associates', email: 'priya@sharma.com', status: 'online', lastActive: 'Now' },
  { name: 'Amit Desai', role: 'Manager', firm: 'Sharma & Associates', email: 'amit@sharma.com', status: 'offline', lastActive: '2h ago' },
  { name: 'Sneha Kulkarni', role: 'Staff', firm: 'Sharma & Associates', email: 'sneha@sharma.com', status: 'online', lastActive: 'Now' },
  { name: 'Vikram Joshi', role: 'Staff', firm: 'Sharma & Associates', email: 'vikram@sharma.com', status: 'offline', lastActive: '1d ago' },
  { name: 'Neha Client', role: 'Client', firm: 'Sharma & Associates', email: 'neha@client.com', status: 'offline', lastActive: '5h ago' },
  { name: 'Dhruv Patel', role: 'Owner', firm: 'Patel Tax Solutions', email: 'dhruv@patel.com', status: 'online', lastActive: 'Now' },
  { name: 'Anita Shah', role: 'Manager', firm: 'Patel Tax Solutions', email: 'anita@patel.com', status: 'online', lastActive: 'Now' },
  { name: 'Rohan Mehta', role: 'Staff', firm: 'Patel Tax Solutions', email: 'rohan@patel.com', status: 'offline', lastActive: '3h ago' },
  { name: 'Kavita Client', role: 'Client', firm: 'Patel Tax Solutions', email: 'kavita@client.com', status: 'offline', lastActive: '1d ago' },
  { name: 'Suresh Kumar', role: 'Owner', firm: 'Kumar GST Consultancy', email: 'suresh@kumar.com', status: 'online', lastActive: 'Now' },
  { name: 'Lakshmi Nair', role: 'Staff', firm: 'Kumar GST Consultancy', email: 'lakshmi@kumar.com', status: 'offline', lastActive: '4h ago' },
]

const permissions: { feature: string; Owner: boolean; Partner: boolean; Manager: boolean; Staff: boolean; Client: boolean }[] = [
  { feature: 'Full Dashboard Access', Owner: true, Partner: true, Manager: true, Staff: false, Client: false },
  { feature: 'Billing & Payments', Owner: true, Partner: false, Manager: false, Staff: false, Client: false },
  { feature: 'Team Management', Owner: true, Partner: true, Manager: false, Staff: false, Client: false },
  { feature: 'Firm Settings', Owner: true, Partner: false, Manager: false, Staff: false, Client: false },
  { feature: 'Client Management', Owner: true, Partner: true, Manager: true, Staff: false, Client: false },
  { feature: 'Filing & Returns', Owner: true, Partner: true, Manager: true, Staff: true, Client: false },
  { feature: 'Reports & Analytics', Owner: true, Partner: true, Manager: true, Staff: false, Client: false },
  { feature: 'Document Upload', Owner: true, Partner: true, Manager: true, Staff: true, Client: true },
  { feature: 'View Filing Status', Owner: true, Partner: true, Manager: true, Staff: true, Client: true },
  { feature: 'Portal Access', Owner: true, Partner: true, Manager: true, Staff: true, Client: true },
  { feature: 'AI Features', Owner: true, Partner: true, Manager: true, Staff: false, Client: false },
  { feature: 'Audit Trail', Owner: true, Partner: true, Manager: false, Staff: false, Client: false },
  { feature: 'Reconciliation', Owner: true, Partner: true, Manager: true, Staff: true, Client: false },
  { feature: 'Notice Management', Owner: true, Partner: true, Manager: true, Staff: false, Client: false },
  { feature: 'White Label', Owner: true, Partner: false, Manager: false, Staff: false, Client: false },
]

const activities = [
  { id: 1, firm: 'Sharma & Associates', user: 'Priya Patel', action: 'Filed GSTR-3B for Sunrise Textiles', time: '10 min ago', type: 'filing' as const },
  { id: 2, firm: 'Patel Tax Solutions', user: 'Anita Shah', action: 'Uploaded 12 invoices for Metro Logistics', time: '25 min ago', type: 'upload' as const },
  { id: 3, firm: 'Kumar GST Consultancy', user: 'Suresh Kumar', action: 'Reconciled 2A data for Green Earth Exports', time: '1h ago', type: 'reconcile' as const },
  { id: 4, firm: 'Sharma & Associates', user: 'AI Doc Employee', action: 'Extracted 34 invoices via OCR', time: '1h ago', type: 'ai' as const },
  { id: 5, firm: 'Patel Tax Solutions', user: 'Dhruv Patel', action: 'Added new client: Quantum Industries', time: '2h ago', type: 'client' as const },
  { id: 6, firm: 'Sharma & Associates', user: 'AI CFO', action: 'Generated monthly revenue report', time: '3h ago', type: 'ai' as const },
  { id: 7, firm: 'Kumar GST Consultancy', user: 'Lakshmi Nair', action: 'Prepared GSTR-1 for Pinnacle Corp', time: '3h ago', type: 'filing' as const },
  { id: 8, firm: 'Sharma & Associates', user: 'Amit Desai', action: 'Assigned 5 tasks to team members', time: '4h ago', type: 'task' as const },
  { id: 9, firm: 'Patel Tax Solutions', user: 'AI Risk Engine', action: 'Detected ITC mismatch for client #14', time: '5h ago', type: 'ai' as const },
  { id: 10, firm: 'Sharma & Associates', user: 'Rajesh Sharma', action: 'Updated firm billing plan to Enterprise', time: '1d ago', type: 'settings' as const },
]

const plans = ['Starter', 'Professional', 'Enterprise']
const planColors: Record<string, string> = {
  Starter: 'bg-slate-100 text-slate-700',
  Professional: 'bg-emerald-100 text-emerald-700',
  Enterprise: 'bg-amber-100 text-amber-700',
}
const roleColors: Record<Role, string> = {
  Owner: 'bg-amber-100 text-amber-700 border-amber-200',
  Partner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Manager: 'bg-blue-100 text-blue-700 border-blue-200',
  Staff: 'bg-slate-100 text-slate-700 border-slate-200',
  Client: 'bg-purple-100 text-purple-700 border-purple-200',
}
const typeIcons: Record<string, React.ElementType> = {
  filing: CheckCircle, upload: Globe, reconcile: Shield,
  ai: Zap, client: Users, task: Briefcase, settings: Settings,
}
const typeColors: Record<string, string> = {
  filing: 'text-emerald-500', upload: 'text-blue-500', reconcile: 'text-amber-500',
  ai: 'text-purple-500', client: 'text-emerald-500', task: 'text-slate-500', settings: 'text-slate-400',
}

// ── Animation ──
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
}

// ── Main Component ──
export default function MultiFirmPage() {
  const [activeTab, setActiveTab] = useState('firms')
  const [selectedFirm, setSelectedFirm] = useState(firms[0].id)
  const [firmDropdownOpen, setFirmDropdownOpen] = useState(false)

  const currentFirm = firms.find(f => f.id === selectedFirm) || firms[0]

  const totalClients = firms.reduce((s, f) => s + f.clients, 0)
  const totalTeam = teamMembers.length
  const activeUsers = teamMembers.filter(m => m.status === 'online').length
  const firmsByPlan = {
    Starter: firms.filter(f => f.plan === 'Starter').length,
    Professional: firms.filter(f => f.plan === 'Professional').length,
    Enterprise: firms.filter(f => f.plan === 'Enterprise').length,
  }

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/20">
            <Building className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Multi-Firm Management</h1>
            <p className="text-xs text-slate-500">Manage unlimited firms, teams, and clients</p>
          </div>
        </div>

        {/* Firm Switcher */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setFirmDropdownOpen(!firmDropdownOpen)}
            className="gap-2 min-w-[220px] justify-between border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
          >
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-slate-900 truncate">{currentFirm.name}</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${firmDropdownOpen ? 'rotate-180' : ''}`} />
          </Button>
          {firmDropdownOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-1 left-0 w-[280px] bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2">Switch Firm</p>
              </div>
              {firms.map(firm => (
                <button key={firm.id}
                  onClick={() => { setSelectedFirm(firm.id); setFirmDropdownOpen(false) }}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-emerald-50/50 transition-colors text-left ${selectedFirm === firm.id ? 'bg-emerald-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{firm.name}</p>
                    <p className="text-[10px] text-slate-400">{firm.clients} clients · {firm.teamSize} members</p>
                  </div>
                  <Badge className={`text-[9px] ${planColors[firm.plan]}`}>{firm.plan}</Badge>
                  {selectedFirm === firm.id && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* KPI Row */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Firms', value: String(firms.length), icon: Building, color: 'text-emerald-600' },
          { label: 'Team Members', value: String(totalTeam), icon: Users, color: 'text-emerald-600' },
          { label: 'Total Clients', value: String(totalClients), icon: Briefcase, color: 'text-emerald-600' },
          { label: 'Active Users', value: String(activeUsers), icon: UserCheck, color: 'text-emerald-600' },
          { label: 'Enterprise Plans', value: String(firmsByPlan.Enterprise), icon: Star, color: 'text-amber-500' },
        ].map((kpi, i) => (
          <Card key={i} className="border-slate-200/60 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80">
          {['firms', 'team', 'permissions', 'activity'].map(t => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Firms Tab ── */}
        <TabsContent value="firms" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {firms.map((firm, i) => (
              <motion.div key={firm.id} initial="hidden" animate="visible" variants={fadeUp} custom={i + 2}>
                <Card className={`border-slate-200/60 shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedFirm === firm.id ? 'ring-2 ring-emerald-500/30 border-emerald-200' : ''}`}
                  onClick={() => setSelectedFirm(firm.id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Building className="h-4 w-4 text-emerald-600" /> {firm.name}
                      </CardTitle>
                      <Badge className={`text-[9px] ${planColors[firm.plan]}`}>{firm.plan}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-slate-50/80">
                        <p className="text-[10px] text-slate-500">Clients</p>
                        <p className="text-sm font-bold text-slate-900">{firm.clients}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50/80">
                        <p className="text-[10px] text-slate-500">Team</p>
                        <p className="text-sm font-bold text-slate-900">{firm.teamSize}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">GSTIN</span>
                        <span className="font-mono text-slate-700">{firm.gstin}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Location</span>
                        <span className="text-slate-700">{firm.location}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Since</span>
                        <span className="text-slate-700">{firm.since}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">MRR</span>
                        <span className="font-semibold text-emerald-600">{firm.revenue}</span>
                      </div>
                    </div>
                    {selectedFirm === firm.id && (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 gap-1 text-[10px]">
                        <CheckCircle className="h-3 w-3" /> Active Firm
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Firms Summary */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {plans.map(plan => (
                    <div key={plan} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${planColors[plan]}`}>
                        <Star className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{plan}</p>
                        <p className="text-lg font-bold text-slate-900">{firmsByPlan[plan as keyof typeof firmsByPlan]}</p>
                        <p className="text-[10px] text-slate-500">firm(s)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Team Tab ── */}
        <TabsContent value="team" className="space-y-4 mt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" /> Team Directory
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{teamMembers.length} members</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[480px]">
                  <div className="space-y-2">
                    {teamMembers.map((member, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                              {member.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-900">{member.name}</p>
                            <p className="text-[10px] text-slate-400">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-slate-500">{member.firm}</p>
                            <p className="text-[10px] text-slate-400">{member.lastActive}</p>
                          </div>
                          <Badge className={`text-[9px] border ${roleColors[member.role]}`}>
                            {member.role === 'Owner' && <Crown className="h-3 w-3 mr-0.5" />}
                            {member.role}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Role Summary */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Role Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3">
                  {(['Owner', 'Partner', 'Manager', 'Staff', 'Client'] as Role[]).map(role => {
                    const count = teamMembers.filter(m => m.role === role).length
                    return (
                      <div key={role} className="text-center p-3 rounded-lg bg-slate-50/80">
                        <p className="text-2xl font-bold text-slate-900">{count}</p>
                        <Badge className={`text-[9px] mt-1 border ${roleColors[role]}`}>
                          {role === 'Owner' && <Crown className="h-3 w-3 mr-0.5" />}
                          {role}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Permissions Tab ── */}
        <TabsContent value="permissions" className="space-y-4 mt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" /> Permission Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[520px]">
                  <div className="min-w-[640px]">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr,70px,70px,70px,70px,70px] gap-2 mb-2 pb-2 border-b border-slate-200">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase">Feature</div>
                      {(['Owner', 'Partner', 'Manager', 'Staff', 'Client'] as Role[]).map(role => (
                        <div key={role} className="text-center">
                          <Badge className={`text-[9px] border ${roleColors[role]}`}>
                            {role === 'Owner' && <Crown className="h-3 w-3 mr-0.5" />}
                            {role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {/* Rows */}
                    {permissions.map((perm, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="grid grid-cols-[1fr,70px,70px,70px,70px,70px] gap-2 items-center py-2 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <div className="text-xs text-slate-700 font-medium">{perm.feature}</div>
                        {(['Owner', 'Partner', 'Manager', 'Staff', 'Client'] as Role[]).map(role => (
                          <div key={role} className="flex justify-center">
                            {perm[role] ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                        ))}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Permission Summary */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Access Level Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3">
                  {(['Owner', 'Partner', 'Manager', 'Staff', 'Client'] as Role[]).map(role => {
                    const accessCount = permissions.filter(p => p[role]).length
                    const total = permissions.length
                    return (
                      <div key={role} className="p-3 rounded-lg bg-slate-50/80 text-center">
                        <Badge className={`text-[9px] border mb-2 ${roleColors[role]}`}>
                          {role === 'Owner' && <Crown className="h-3 w-3 mr-0.5" />}
                          {role}
                        </Badge>
                        <p className="text-lg font-bold text-slate-900">{accessCount}/{total}</p>
                        <p className="text-[10px] text-slate-500">permissions</p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Activity Tab ── */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" /> Cross-Firm Activity Feed
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{activities.length} events</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[520px]">
                  <div className="space-y-1">
                    {activities.map((act, i) => {
                      const IconComp = typeIcons[act.type] || Activity
                      const iconColor = typeColors[act.type] || 'text-slate-400'
                      return (
                        <motion.div key={act.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50/80 transition-colors">
                          <div className="mt-0.5">
                            <IconComp className={`h-4 w-4 ${iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-slate-900">{act.user}</span>
                              <Badge variant="outline" className="text-[9px] gap-0.5 py-0 px-1.5">
                                <Building className="h-2.5 w-2.5" /> {act.firm}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">{act.action}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] text-slate-400">{act.time}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Summary by Firm */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Activity by Firm</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {firms.map(firm => {
                    const firmActivities = activities.filter(a => a.firm === firm.name)
                    return (
                      <div key={firm.id} className="p-3 rounded-lg bg-slate-50/80 border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Building className="h-3.5 w-3.5 text-emerald-600" />
                          <p className="text-xs font-semibold text-slate-900">{firm.name}</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900">{firmActivities.length}</p>
                        <p className="text-[10px] text-slate-500">recent activities</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {Array.from(new Set(firmActivities.map(a => a.type))).map(type => (
                            <Badge key={type} variant="outline" className="text-[9px] gap-0.5 py-0 px-1.5">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
