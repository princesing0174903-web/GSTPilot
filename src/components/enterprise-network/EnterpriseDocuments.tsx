'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Folder as FolderIcon,
  CloudUpload,
  Search,
  Download,
  Share2,
  Eye,
  History,
  ScanText,
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Archive,
  FilePen,
  ChevronRight,
  Lock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  ENTERPRISE_DOCUMENTS,
  DOCUMENT_FOLDERS,
  type EnterpriseDocument,
} from '@/lib/enterprise/data'

// ─── helpers ───────────────────────────────────────────────────────────────────
const TYPE_META: Record<
  EnterpriseDocument['type'],
  { icon: typeof FileText; bg: string; fg: string; label: string }
> = {
  pdf: { icon: FileText, bg: 'bg-red-500/15', fg: 'text-red-400', label: 'PDF' },
  xlsx: { icon: FileSpreadsheet, bg: 'bg-emerald-500/15', fg: 'text-emerald-400', label: 'XLSX' },
  docx: { icon: FileText, bg: 'bg-cyan-500/15', fg: 'text-cyan-400', label: 'DOCX' },
  img: { icon: FileImage, bg: 'bg-purple-500/15', fg: 'text-purple-400', label: 'IMG' },
  folder: { icon: FolderIcon, bg: 'bg-amber-500/15', fg: 'text-amber-400', label: 'ZIP' },
}

const STATUS_META: Record<
  EnterpriseDocument['status'],
  { label: string; cls: string; dot: string }
> = {
  draft: { label: 'Draft', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/20', dot: 'bg-slate-400' },
  'in-review': { label: 'In Review', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/20', dot: 'bg-amber-400' },
  approved: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-400' },
  archived: { label: 'Archived', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20', dot: 'bg-zinc-500' },
}

const AVATAR_COLORS: Record<string, string> = {
  'Vikram Mehta': '#8b5cf6',
  'Priya Sharma': '#ec4899',
  'Meena Krishnan': '#14b8a6',
  'Karthik Nair': '#f97316',
  'Deepika Rao': '#a855f7',
  'Rajesh Kumar': '#f59e0b',
  'Legal Bot': '#06b6d4',
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ─── subcomponents ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string
  value: string | number
  icon: typeof FileText
  accent: string
  sub?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1f` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
    </motion.div>
  )
}

function FolderCard({
  folder,
  active,
  onClick,
}: {
  folder: (typeof DOCUMENT_FOLDERS)[number]
  active: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
        active
          ? 'border-white/20 bg-white/[0.06]'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `${folder.color}1f` }}
        >
          <FolderIcon className="h-4 w-4" style={{ color: folder.color }} />
        </div>
        <Badge
          variant="outline"
          className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-400"
        >
          {folder.documents}
        </Badge>
      </div>
      <div className="text-sm font-medium text-white">{folder.name}</div>
      <div className="flex items-center gap-1 text-[11px] text-zinc-500">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: folder.color }}
        />
        {active ? 'Filtering' : 'Click to filter'}
      </div>
    </motion.button>
  )
}

function VersionStep({
  version,
  date,
  user,
  note,
  current,
}: {
  version: string
  date: string
  user: string
  note: string
  current?: boolean
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
            current
              ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30'
              : 'bg-white/[0.04] text-zinc-400'
          }`}
        >
          {version}
        </div>
        <div className="mt-1 w-px flex-1 bg-white/[0.06]" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-white">
            {user}
            {current && (
              <Badge className="ml-2 border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0 text-[9px] text-emerald-300">
                CURRENT
              </Badge>
            )}
          </span>
          <span className="text-[10px] text-zinc-500">{date}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-400">{note}</p>
      </div>
    </div>
  )
}

// ─── main component ────────────────────────────────────────────────────────────
export default function EnterpriseDocuments() {
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('d1')

  const filtered = useMemo(() => {
    return ENTERPRISE_DOCUMENTS.filter((d) => {
      const folderMatch =
        !activeFolder ||
        d.folder.toLowerCase().startsWith(activeFolder.toLowerCase())
      const queryMatch =
        !query ||
        d.name.toLowerCase().includes(query.toLowerCase()) ||
        d.company.toLowerCase().includes(query.toLowerCase()) ||
        d.modifiedBy.toLowerCase().includes(query.toLowerCase())
      return folderMatch && queryMatch
    })
  }, [activeFolder, query])

  const selected = ENTERPRISE_DOCUMENTS.find((d) => d.id === selectedId) ?? ENTERPRISE_DOCUMENTS[0]

  const stats = useMemo(() => {
    const total = ENTERPRISE_DOCUMENTS.length
    const pending = ENTERPRISE_DOCUMENTS.filter((d) => d.status === 'in-review').length
    const shared = ENTERPRISE_DOCUMENTS.reduce((s, d) => s + d.sharedWith, 0)
    const ocr = ENTERPRISE_DOCUMENTS.filter((d) => d.ocrProcessed).length
    return {
      total,
      folders: DOCUMENT_FOLDERS.length,
      shared,
      pending,
      ocr,
    }
  }, [])

  // Sample version history for the selected doc
  const versionHistory = useMemo(() => {
    const baseVersion = parseInt(selected.version.replace('v', '')) || 1
    const history = []
    const notes = [
      'Initial draft created with template applied',
      'Updated financials section with Q3 actuals',
      'Incorporated audit team feedback on risk disclosures',
      'Final formatting and CFO sign-off pending',
      'Compliance review notes added by Legal Bot',
    ]
    const users = ['Vikram Mehta', 'Meena Krishnan', 'Anita Desai', 'Legal Bot']
    const dates = ['3d ago', '2d ago', '1d ago', '5h ago', '1h ago']
    const total = Math.min(baseVersion, 4)
    for (let i = 0; i < total; i++) {
      const v = i + 1
      history.push({
        version: `v${v}`,
        date: dates[i] ?? '1h ago',
        user: users[i % users.length],
        note: notes[i] ?? 'Minor revision',
        current: v === baseVersion,
      })
    }
    return history.reverse() // newest first
  }, [selected])

  const approvalProgress =
    selected.status === 'approved'
      ? 100
      : selected.status === 'in-review'
      ? 66
      : selected.status === 'archived'
      ? 100
      : 33

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Enterprise Documents™
            </h2>
            <Badge className="border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-300">
              v4 · LIVE
            </Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Versioned · OCR · Access-controlled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents..."
              className="h-9 w-56 border-white/[0.06] bg-white/[0.02] pl-8 text-sm text-white placeholder:text-zinc-500"
            />
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          >
            <CloudUpload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Documents"
          value={stats.total}
          icon={FileText}
          accent="#10b981"
          sub="across all companies"
        />
        <StatCard
          label="Folders"
          value={stats.folders}
          icon={FolderIcon}
          accent="#f59e0b"
          sub="organized hierarchy"
        />
        <StatCard
          label="Shared with me"
          value={stats.shared}
          icon={Users}
          accent="#06b6d4"
          sub="cross-team access"
        />
        <StatCard
          label="Pending review"
          value={stats.pending}
          icon={AlertCircle}
          accent="#f59e0b"
          sub="awaiting approver"
        />
        <StatCard
          label="OCR processed"
          value={`${stats.ocr}/${stats.total}`}
          icon={ScanText}
          accent="#8b5cf6"
          sub="searchable content"
        />
      </div>

      {/* Folders grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Folders</h3>
          {activeFolder && (
            <button
              onClick={() => setActiveFolder(null)}
              className="text-[11px] text-zinc-400 hover:text-white"
            >
              Clear filter ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {DOCUMENT_FOLDERS.map((f) => (
            <FolderCard
              key={f.id}
              folder={f}
              active={activeFolder === f.name}
              onClick={() =>
                setActiveFolder((cur) => (cur === f.name ? null : f.name))
              }
            />
          ))}
        </div>
      </div>

      {/* Main split: Documents table + Version History */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Documents table */}
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-white">
                Documents {activeFolder && `· ${activeFolder}`}
              </CardTitle>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-400"
              >
                {filtered.length} shown
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-[28rem] overflow-y-auto pr-1">
              <div className="sticky top-0 z-10 grid grid-cols-12 gap-2 border-b border-white/[0.06] bg-[#0a0a0b] px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
                <div className="col-span-5">Name</div>
                <div className="col-span-2">Company</div>
                <div className="col-span-2">Modified</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Ver</div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                <AnimatePresence mode="popLayout">
                  {filtered.map((doc) => {
                    const meta = TYPE_META[doc.type]
                    const status = STATUS_META[doc.status]
                    const Icon = meta.icon
                    const isSelected = doc.id === selectedId
                    return (
                      <motion.div
                        key={doc.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedId(doc.id)}
                        className={`group grid cursor-pointer grid-cols-12 items-center gap-2 px-3 py-2.5 transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/[0.06]'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Name + icon */}
                        <div className="col-span-5 flex min-w-0 items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.bg}`}
                          >
                            <Icon className={`h-4 w-4 ${meta.fg}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-medium text-white">
                                {doc.name}
                              </span>
                              {doc.ocrProcessed && (
                                <ScanText className="h-3 w-3 flex-shrink-0 text-purple-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                              <span className="truncate">{doc.folder}</span>
                              <span>·</span>
                              <span>{doc.size}</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Users className="h-2.5 w-2.5" />
                                {doc.sharedWith}
                              </span>
                            </div>
                          </div>
                          {/* Hover actions */}
                          <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {[
                              { icon: Eye, label: 'Preview' },
                              { icon: Download, label: 'Download' },
                              { icon: Share2, label: 'Share' },
                              { icon: History, label: 'Versions' },
                            ].map(({ icon: AIcon, label }) => (
                              <button
                                key={label}
                                title={label}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
                              >
                                <AIcon className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Company */}
                        <div className="col-span-2">
                          <Badge
                            variant="outline"
                            className="border-white/10 bg-white/[0.03] px-1.5 py-0 text-[10px] text-zinc-300"
                          >
                            {doc.company.replace('Aurora ', '')}
                          </Badge>
                        </div>

                        {/* Modified */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback
                              className="text-[8px] font-semibold text-white"
                              style={{
                                background:
                                  AVATAR_COLORS[doc.modifiedBy] ?? '#64748b',
                              }}
                            >
                              {initials(doc.modifiedBy)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-[10px] text-zinc-300">
                              {doc.modifiedBy}
                            </div>
                            <div className="flex items-center gap-0.5 text-[9px] text-zinc-500">
                              <Clock className="h-2 w-2" />
                              {doc.modifiedAt}
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="col-span-2">
                          <div
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${status.cls}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </div>
                        </div>

                        {/* Version */}
                        <div className="col-span-1 text-right">
                          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            {doc.version}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderIcon className="mb-2 h-8 w-8 text-zinc-600" />
                    <p className="text-sm text-zinc-400">No documents found</p>
                    <p className="text-[11px] text-zinc-600">
                      Try clearing filters or searching another term
                    </p>
                  </div>
                )}

                {/* Upload dashed card */}
                <button className="flex items-center justify-center gap-2 border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-xs text-zinc-500 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] hover:text-emerald-300">
                  <CloudUpload className="h-4 w-4" />
                  Drop files here or click to upload — auto OCR on ingest
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Version History panel */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-white">
                  Version History
                </CardTitle>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                  {selected.name}
                </p>
              </div>
              <Badge className="border border-white/10 bg-white/[0.04] px-1.5 py-0 font-mono text-[10px] text-emerald-300">
                {selected.version}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Approval workflow indicator */}
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] font-medium text-white">
                    Approval Workflow
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  {selected.status === 'approved'
                    ? 'Completed'
                    : selected.status === 'in-review'
                    ? 'In progress'
                    : selected.status === 'archived'
                    ? 'Archived'
                    : 'Awaiting start'}
                </span>
              </div>
              <Progress
                value={approvalProgress}
                className="h-1.5 bg-white/[0.04]"
              />
              <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <FilePen className="h-2.5 w-2.5" /> Draft
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-2.5 w-2.5" /> Review
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Approved
                </span>
                <span className="flex items-center gap-1">
                  <Archive className="h-2.5 w-2.5" /> Archived
                </span>
              </div>
            </div>

            {/* Versions timeline */}
            <ScrollArea className="max-h-[18rem]">
              <div className="px-1">
                {versionHistory.map((v, i) => (
                  <VersionStep key={i} {...v} />
                ))}
                {versionHistory.length === 0 && (
                  <div className="py-6 text-center text-[11px] text-zinc-500">
                    No version history available
                  </div>
                )}
              </div>
            </ScrollArea>

            <Separator className="my-3 bg-white/[0.06]" />

            {/* Access control summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-white">
                <Lock className="h-3 w-3 text-zinc-400" />
                Access Control
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Shared with</span>
                <span className="text-zinc-300">{selected.sharedWith} users</span>
              </div>
              <div className="flex -space-x-2">
                {['VM', 'AD', 'MK', 'PS', 'KR'].slice(0, selected.sharedWith).map((a, i) => (
                  <Avatar key={i} className="h-6 w-6 border-2 border-[#0a0a0b]">
                    <AvatarFallback
                      className="text-[8px] font-semibold text-white"
                      style={{
                        background: ['#8b5cf6', '#06b6d4', '#14b8a6', '#ec4899', '#f97316'][i % 5],
                      }}
                    >
                      {a}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {selected.sharedWith > 5 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0a0a0b] bg-white/[0.04] text-[8px] text-zinc-400">
                    +{selected.sharedWith - 5}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 text-[10px]">
                <span className="text-zinc-500">OCR Content Index</span>
                {selected.ocrProcessed ? (
                  <Badge className="border border-purple-500/30 bg-purple-500/15 px-1.5 py-0 text-[9px] text-purple-300">
                    <ScanText className="mr-1 h-2.5 w-2.5" /> Indexed
                  </Badge>
                ) : (
                  <span className="text-zinc-600">Not processed</span>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full gap-1.5 border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
            >
              View Full Audit Trail
              <ChevronRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
