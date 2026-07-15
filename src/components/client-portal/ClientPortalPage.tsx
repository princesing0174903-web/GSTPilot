'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload,
  FileText,
  Download,
  Eye,
  Bell,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  FileDown,
  FileUp,
  LogOut,
  User,
} from 'lucide-react'
import { formatCurrency } from '@/lib/gst-utils'
import { useClients } from '@/hooks/useClients'

interface ClientData {
  id: string
  tradeName: string
  gstin: string
  healthScore: number
  status: string
}

interface FilingStatus {
  id: string
  returnType: string
  period: string
  status: string
  filedDate?: string
  totalTax: number
}

interface ClientNotice {
  id: string
  subject: string
  noticeType: string
  status: string
  priority: string
  dueDate?: string
}

interface ClientDocument {
  id: string
  name: string
  fileType: string
  folder: string
  createdAt: string
  size: number
}

export default function ClientPortalPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [filings, setFilings] = useState<FilingStatus[]>([])
  const [notices, setNotices] = useState<ClientNotice[]>([])
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  // Real client list (tenant-scoped via shared hook) — used to look up the
  // portal user by their contact email. NO demo credentials, NO fake data.
  const { clients: orgClients, loading: clientsLoading } = useClients()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoading(true)

    // Real lookup: match the entered email against client contactEmail records
    // in the current organization. No hardcoded credentials.
    const matchedClient = orgClients.find(
      c => (c.contactEmail ?? '').toLowerCase() === loginEmail.trim().toLowerCase()
    )

    if (!matchedClient) {
      setLoginError('No client found with that email. Please contact your firm to get portal access.')
      setIsLoading(false)
      return
    }

    setIsLoggedIn(true)
    setClientData({
      id: matchedClient.id,
      tradeName: matchedClient.tradeName,
      gstin: matchedClient.gstin,
      healthScore: matchedClient.healthScore,
      status: matchedClient.status,
    })

    // Load real client data from APIs (no fallbacks / no fake data)
    try {
      const filingsRes = await fetch(`/api/gstr-filing?clientId=${matchedClient.id}`)
      if (filingsRes.ok) {
        const filingsData = await filingsRes.json()
        setFilings(filingsData.filings || [])
      }

      const noticesRes = await fetch(`/api/notices?clientId=${matchedClient.id}`)
      if (noticesRes.ok) {
        const noticesData = await noticesRes.json()
        setNotices(noticesData.notices || [])
      }

      const docsRes = await fetch(`/api/documents?clientId=${matchedClient.id}`)
      if (docsRes.ok) {
        const docsData = await docsRes.json()
        setDocuments(docsData.documents || [])
      }
    } catch {
      // Network error — leave lists empty; the UI shows honest empty states.
    }

    setIsLoading(false)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setClientData(null)
    setFilings([])
    setNotices([])
    setDocuments([])
    setLoginEmail('')
    setLoginPassword('')
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 border-emerald-200'
    if (score >= 60) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  const getFilingStatusBadge = (status: string) => {
    const config: Record<string, { color: string; bg: string; label: string }> = {
      filed: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Filed' },
      pending: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Pending' },
      draft: { color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', label: 'Draft' },
      prepared: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Prepared' },
      validated: { color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200', label: 'Validated' },
    }
    const c = config[status] || config.draft
    return <Badge variant="outline" className={`${c.color} ${c.bg} text-[10px]`}>{c.label}</Badge>
  }

  // ─── Login Screen ───
  if (!isLoggedIn) {
    return (
      <div className="min-h-[calc(100vh-52px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/20 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
                  <Shield className="h-6 w-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl font-bold">Client Portal</CardTitle>
              <CardDescription>Access your GST filings and compliance data</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="h-10"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-10"
                    required
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">{loginError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  {clientsLoading
                    ? 'Loading client accounts…'
                    : orgClients.length === 0
                      ? 'No client accounts found. Contact your firm to get portal access.'
                      : `Sign in with the email your firm has on file (${orgClients.length} client${orgClients.length === 1 ? '' : 's'} registered).`}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ─── Client Dashboard ───
  const healthScore = clientData?.healthScore || 0
  const filedCount = filings.filter(f => f.status === 'filed').length
  const pendingCount = filings.filter(f => f.status !== 'filed').length
  const openNotices = notices.filter(n => n.status === 'open' || n.status === 'in_progress').length

  return (
    <div className="min-h-[calc(100vh-52px)] bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950/10">
      {/* Client Header Bar */}
      <div className="bg-white dark:bg-gray-900 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">{clientData?.tradeName || 'Client'}</h2>
              <p className="text-xs text-muted-foreground">GSTIN: {clientData?.gstin}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${getHealthColor(healthScore)} ${getHealthBg(healthScore)} text-xs`}>
              Health: {healthScore}%
            </Badge>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Compliance Score', value: `${healthScore}%`, icon: TrendingUp, color: healthScore >= 80 ? 'emerald' : healthScore >= 60 ? 'amber' : 'red' },
            { label: 'Filed Returns', value: String(filedCount), icon: CheckCircle2, color: 'emerald' },
            { label: 'Pending Returns', value: String(pendingCount), icon: Clock, color: 'amber' },
            { label: 'Open Notices', value: String(openNotices), icon: Bell, color: openNotices > 0 ? 'red' : 'emerald' },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                    <stat.icon className={`h-4 w-4 text-${stat.color}-500`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white dark:bg-gray-900 shadow-sm border">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="filings" className="text-xs">Filing Status</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
            <TabsTrigger value="notices" className="text-xs">Notices</TabsTrigger>
            <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Compliance Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium">Filed Returns</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">{filedCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Pending Returns</span>
                    </div>
                    <span className="text-lg font-bold text-amber-600">{pendingCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Open Notices</span>
                    </div>
                    <span className="text-lg font-bold text-red-600">{openNotices}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Recent Filings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filings.slice(0, 4).map((filing) => (
                    <div key={filing.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium">{filing.returnType}</p>
                          <p className="text-xs text-muted-foreground">{filing.period}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getFilingStatusBadge(filing.status)}
                        {filing.totalTax > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Tax: {formatCurrency(filing.totalTax)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Filings Tab */}
          <TabsContent value="filings">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Filing Status</CardTitle>
                <CardDescription>View and download your filed GST returns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filings.map((filing) => (
                    <div key={filing.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{filing.returnType} — {filing.period}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {getFilingStatusBadge(filing.status)}
                            {filing.filedDate && (
                              <span className="text-[10px] text-muted-foreground">Filed on {filing.filedDate}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {filing.totalTax > 0 && (
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(filing.totalTax)}
                          </span>
                        )}
                        {filing.status === 'filed' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No filings found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">Documents</CardTitle>
                    <CardDescription>Download reports and filed returns</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                          doc.fileType === 'pdf' ? 'bg-red-50 dark:bg-red-950/30' :
                          doc.fileType === 'xlsx' ? 'bg-emerald-50 dark:bg-emerald-950/30' :
                          'bg-blue-50 dark:bg-blue-950/30'
                        }`}>
                          <FileText className={`h-4 w-4 ${
                            doc.fileType === 'pdf' ? 'text-red-600' :
                            doc.fileType === 'xlsx' ? 'text-emerald-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.fileType.toUpperCase()}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {(doc.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No documents available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notices Tab */}
          <TabsContent value="notices">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Notices</CardTitle>
                <CardDescription>View GST notices and department queries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notices.map((notice) => (
                    <div key={notice.id} className="p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            notice.priority === 'high' || notice.priority === 'urgent'
                              ? 'bg-red-50 dark:bg-red-950/30'
                              : 'bg-amber-50 dark:bg-amber-950/30'
                          }`}>
                            <Bell className={`h-4 w-4 ${
                              notice.priority === 'high' || notice.priority === 'urgent'
                                ? 'text-red-600'
                                : 'text-amber-600'
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{notice.subject}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                {notice.noticeType === 'gst_notice' ? 'GST Notice' :
                                 notice.noticeType === 'department_notice' ? 'Dept Notice' : 'Tax Query'}
                              </Badge>
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                                notice.status === 'open' ? 'text-amber-700 border-amber-200 bg-amber-50' :
                                notice.status === 'in_progress' ? 'text-blue-700 border-blue-200 bg-blue-50' :
                                'text-emerald-700 border-emerald-200 bg-emerald-50'
                              }`}>
                                {notice.status === 'in_progress' ? 'In Progress' : notice.status.charAt(0).toUpperCase() + notice.status.slice(1)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {notice.dueDate && (
                          <span className="text-[10px] text-muted-foreground">Due: {notice.dueDate}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {notices.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notices found</p>
                      <p className="text-xs mt-1">You&apos;re all caught up!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Upload Documents</CardTitle>
                <CardDescription>Upload invoices, purchase registers, and other documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer">
                  <FileUp className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports PDF, XLSX, DOCX, JPG, PNG (max 10MB)</p>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recently Uploaded</p>
                  <div className="text-center py-4">
                    <Upload className="h-6 w-6 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs text-muted-foreground">No recent uploads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
