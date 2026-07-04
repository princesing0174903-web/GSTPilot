// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Business Memory™ Service
//
// Persistent memory system keyed by userEmail. Oracle calls buildMemoryContext()
// before every response to inject "what Oracle remembers about this user" into
// the system prompt. Conversation turns are recorded after each stream completes.
//
// 9 categories: profile, firm, goals, preferences, clientMemory, financialMetrics,
// conversations, insights, embeddings (placeholder).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FullMemory {
  profile: ProfileData | null
  firm: FirmData | null
  goals: GoalData[]
  preferences: PreferenceData | null
  clientMemories: ClientMemoryData[]
  financialMetrics: FinancialMetricData[]
  conversations: ConversationData[]
  insights: InsightData[]
}

export interface ProfileData {
  name: string | null
  role: string | null
  designation: string | null
  firmName: string | null
  industry: string | null
  city: string | null
  timezone: string | null
  preferredLanguage: string | null
}

export interface FirmData {
  caFirmName: string | null
  employeeCount: number
  clientCount: number
  industriesServed: string[]
  gstRegistrations: string[]
  branches: string[]
  servicesOffered: string[]
}

export interface GoalData {
  id: string
  type: string
  target: string
  period: string | null
  notes: string | null
  pinned: boolean
}

export interface PreferenceData {
  theme: string | null
  notifications: { email: boolean; whatsapp: boolean; push: boolean }
  reportFormat: string | null
  reminderFrequency: string | null
  communicationMethod: string | null
}

export interface ClientMemoryData {
  id: string
  clientId: string
  clientName: string
  clientGstin: string
  paymentBehaviour: string | null
  riskNotes: string | null
  customNotes: string | null
  pinned: boolean
}

export interface FinancialMetricData {
  id: string
  metricType: string
  period: string | null
  value: number
  trend: string | null
  annotation: string | null
  pinned: boolean
}

export interface ConversationData {
  id: string
  userMessage: string
  oracleResponse: string
  role: string | null
  fn: string | null
  summary: string | null
  createdAt: string
}

export interface InsightData {
  id: string
  category: string
  content: string
  source: string
  pinned: boolean
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseArray(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  } catch {
    return []
  }
}

function safeParseNotifications(json: string | null): {
  email: boolean
  whatsapp: boolean
  push: boolean
} {
  const defaults = { email: true, whatsapp: true, push: false }
  if (!json) return defaults
  try {
    return { ...defaults, ...JSON.parse(json) }
  } catch {
    return defaults
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

// ─── Read: full memory ────────────────────────────────────────────────────────

export async function getFullMemory(userEmail: string): Promise<FullMemory> {
  const [
    profile,
    firm,
    goals,
    preferences,
    clientMemoriesRaw,
    financialMetrics,
    conversations,
    insights,
  ] = await Promise.all([
    db.userProfile.findUnique({ where: { userEmail } }),
    db.firmProfile.findUnique({ where: { userEmail } }),
    db.businessGoal.findMany({
      where: { userEmail },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    }),
    db.userPreference.findUnique({ where: { userEmail } }),
    db.clientMemory.findMany({
      where: { userEmail },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    }),
    db.financialMetric.findMany({
      where: { userEmail },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    }),
    db.conversationMemory.findMany({
      where: { userEmail },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.oracleInsight.findMany({
      where: { userEmail },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  // Hydrate client memories with client names
  const clientIds = clientMemoriesRaw.map((cm) => cm.clientId)
  const clients =
    clientIds.length > 0
      ? await db.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, tradeName: true, gstin: true },
        })
      : []
  const clientMap = new Map(clients.map((c) => [c.id, c]))

  return {
    profile: profile
      ? {
          name: profile.name,
          role: profile.role,
          designation: profile.designation,
          firmName: profile.firmName,
          industry: profile.industry,
          city: profile.city,
          timezone: profile.timezone,
          preferredLanguage: profile.preferredLanguage,
        }
      : null,
    firm: firm
      ? {
          caFirmName: firm.caFirmName,
          employeeCount: firm.employeeCount,
          clientCount: firm.clientCount,
          industriesServed: safeParseArray(firm.industriesServed),
          gstRegistrations: safeParseArray(firm.gstRegistrations),
          branches: safeParseArray(firm.branches),
          servicesOffered: safeParseArray(firm.servicesOffered),
        }
      : null,
    goals: goals.map((g) => ({
      id: g.id,
      type: g.type,
      target: g.target,
      period: g.period,
      notes: g.notes,
      pinned: g.pinned,
    })),
    preferences: preferences
      ? {
          theme: preferences.theme,
          notifications: safeParseNotifications(preferences.notifications),
          reportFormat: preferences.reportFormat,
          reminderFrequency: preferences.reminderFrequency,
          communicationMethod: preferences.communicationMethod,
        }
      : null,
    clientMemories: clientMemoriesRaw.map((cm) => {
      const client = clientMap.get(cm.clientId)
      return {
        id: cm.id,
        clientId: cm.clientId,
        clientName: client?.tradeName || 'Unknown',
        clientGstin: client?.gstin || '—',
        paymentBehaviour: cm.paymentBehaviour,
        riskNotes: cm.riskNotes,
        customNotes: cm.customNotes,
        pinned: cm.pinned,
      }
    }),
    financialMetrics: financialMetrics.map((m) => ({
      id: m.id,
      metricType: m.metricType,
      period: m.period,
      value: m.value,
      trend: m.trend,
      annotation: m.annotation,
      pinned: m.pinned,
    })),
    conversations: conversations.map((c) => ({
      id: c.id,
      userMessage: c.userMessage,
      oracleResponse: c.oracleResponse,
      role: c.role,
      fn: c.fn,
      summary: c.summary,
      createdAt: c.createdAt.toISOString(),
    })),
    insights: insights.map((i) => ({
      id: i.id,
      category: i.category,
      content: i.content,
      source: i.source,
      pinned: i.pinned,
      createdAt: i.createdAt.toISOString(),
    })),
  }
}

// ─── Read: memory context for Oracle prompt ───────────────────────────────────

/**
 * Build a structured text block of everything Oracle remembers about this user.
 * Injected into the Oracle system prompt so responses are personalized.
 * Returns an empty string if no memory exists (new user).
 */
export async function buildMemoryContext(userEmail: string): Promise<string> {
  const mem = await getFullMemory(userEmail)

  const hasAny =
    mem.profile ||
    mem.firm ||
    mem.goals.length > 0 ||
    mem.preferences ||
    mem.clientMemories.length > 0 ||
    mem.financialMetrics.length > 0 ||
    mem.conversations.length > 0 ||
    mem.insights.length > 0

  if (!hasAny) {
    return '' // No memory yet — Oracle will ask the user to introduce themselves
  }

  const lines: string[] = []
  lines.push('# BUSINESS MEMORY™ — What Oracle remembers about this user')
  lines.push('')

  // Profile
  if (mem.profile) {
    lines.push('## User Profile')
    const p = mem.profile
    if (p.name) lines.push(`- Name: ${p.name}`)
    if (p.role) lines.push(`- Role: ${p.role}`)
    if (p.designation) lines.push(`- Designation: ${p.designation}`)
    if (p.firmName) lines.push(`- Firm: ${p.firmName}`)
    if (p.industry) lines.push(`- Industry: ${p.industry}`)
    if (p.city) lines.push(`- City: ${p.city}`)
    if (p.timezone) lines.push(`- Timezone: ${p.timezone}`)
    if (p.preferredLanguage) lines.push(`- Preferred Language: ${p.preferredLanguage}`)
    lines.push('')
  }

  // Firm
  if (mem.firm) {
    lines.push('## Firm')
    const f = mem.firm
    if (f.caFirmName) lines.push(`- Firm Name: ${f.caFirmName}`)
    if (f.employeeCount > 0) lines.push(`- Employees: ${f.employeeCount}`)
    if (f.clientCount > 0) lines.push(`- Clients: ${f.clientCount}`)
    if (f.industriesServed.length > 0) lines.push(`- Industries Served: ${f.industriesServed.join(', ')}`)
    if (f.gstRegistrations.length > 0) lines.push(`- GST Registrations: ${f.gstRegistrations.join(', ')}`)
    if (f.branches.length > 0) lines.push(`- Branches: ${f.branches.join(', ')}`)
    if (f.servicesOffered.length > 0) lines.push(`- Services: ${f.servicesOffered.join(', ')}`)
    lines.push('')
  }

  // Goals
  if (mem.goals.length > 0) {
    lines.push('## Business Goals')
    for (const g of mem.goals) {
      const pin = g.pinned ? ' ★' : ''
      const period = g.period ? ` (${g.period})` : ''
      lines.push(`- ${g.type.charAt(0).toUpperCase() + g.type.slice(1)} Goal: ${g.target}${period}${pin}`)
    }
    lines.push('')
  }

  // Preferences
  if (mem.preferences) {
    lines.push('## Preferences')
    const p = mem.preferences
    if (p.communicationMethod) lines.push(`- Communication: ${p.communicationMethod}`)
    if (p.reminderFrequency) lines.push(`- Reminder Frequency: ${p.reminderFrequency}`)
    if (p.reportFormat) lines.push(`- Report Format: ${p.reportFormat}`)
    const notifParts: string[] = []
    if (p.notifications.email) notifParts.push('email')
    if (p.notifications.whatsapp) notifParts.push('whatsapp')
    if (p.notifications.push) notifParts.push('push')
    if (notifParts.length > 0) lines.push(`- Notifications: ${notifParts.join(', ')}`)
    lines.push('')
  }

  // Client memories
  if (mem.clientMemories.length > 0) {
    lines.push('## Client Memory (observations about clients)')
    for (const cm of mem.clientMemories) {
      const parts: string[] = [cm.clientName]
      if (cm.paymentBehaviour) parts.push(`payment: ${cm.paymentBehaviour}`)
      if (cm.riskNotes) parts.push(`risk: ${cm.riskNotes}`)
      if (cm.customNotes) parts.push(cm.customNotes)
      const pin = cm.pinned ? ' ★' : ''
      lines.push(`- ${parts.join(' — ')}${pin}`)
    }
    lines.push('')
  }

  // Financial metrics
  if (mem.financialMetrics.length > 0) {
    lines.push('## Financial Memory')
    for (const m of mem.financialMetrics) {
      const parts: string[] = [`${m.metricType} (${m.period || 'current'})`]
      parts.push(`₹${m.value.toLocaleString('en-IN')}`)
      if (m.trend) parts.push(`trend: ${m.trend}`)
      if (m.annotation) parts.push(`"${m.annotation}"`)
      const pin = m.pinned ? ' ★' : ''
      lines.push(`- ${parts.join(' — ')}${pin}`)
    }
    lines.push('')
  }

  // Recent conversations
  if (mem.conversations.length > 0) {
    lines.push('## Recent Conversations (what the user asked before)')
    for (const c of mem.conversations.slice(0, 8)) {
      const date = new Date(c.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      const roleTag = c.role ? `[${c.role.toUpperCase()}]` : ''
      const fnTag = c.fn ? `[${c.fn}]` : ''
      lines.push(`- ${date} ${roleTag} ${fnTag} User: "${truncate(c.userMessage, 100)}"`)
      if (c.summary) {
        lines.push(`  → ${c.summary}`)
      } else {
        lines.push(`  → Oracle: "${truncate(c.oracleResponse, 120)}"`)
      }
    }
    lines.push('')
  }

  // Insights
  if (mem.insights.length > 0) {
    lines.push('## Oracle Insights (patterns & observations)')
    for (const i of mem.insights) {
      const pin = i.pinned ? ' ★' : ''
      lines.push(`- [${i.category}] ${i.content}${pin}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Write: profile / firm / preferences (upsert) ─────────────────────────────

export async function upsertProfile(
  userEmail: string,
  data: Partial<ProfileData>
): Promise<void> {
  await db.userProfile.upsert({
    where: { userEmail },
    create: { userEmail, ...data },
    update: data,
  })
}

export async function upsertFirm(
  userEmail: string,
  data: Partial<FirmData>
): Promise<void> {
  const updateData: Record<string, unknown> = {}
  if (data.caFirmName !== undefined) updateData.caFirmName = data.caFirmName
  if (data.employeeCount !== undefined) updateData.employeeCount = data.employeeCount
  if (data.clientCount !== undefined) updateData.clientCount = data.clientCount
  if (data.industriesServed !== undefined) updateData.industriesServed = JSON.stringify(data.industriesServed)
  if (data.gstRegistrations !== undefined) updateData.gstRegistrations = JSON.stringify(data.gstRegistrations)
  if (data.branches !== undefined) updateData.branches = JSON.stringify(data.branches)
  if (data.servicesOffered !== undefined) updateData.servicesOffered = JSON.stringify(data.servicesOffered)

  await db.firmProfile.upsert({
    where: { userEmail },
    create: { userEmail, ...updateData },
    update: updateData,
  })
}

export async function upsertPreferences(
  userEmail: string,
  data: Partial<PreferenceData>
): Promise<void> {
  const updateData: Record<string, unknown> = {}
  if (data.theme !== undefined) updateData.theme = data.theme
  if (data.reportFormat !== undefined) updateData.reportFormat = data.reportFormat
  if (data.reminderFrequency !== undefined) updateData.reminderFrequency = data.reminderFrequency
  if (data.communicationMethod !== undefined) updateData.communicationMethod = data.communicationMethod
  if (data.notifications !== undefined) updateData.notifications = JSON.stringify(data.notifications)

  await db.userPreference.upsert({
    where: { userEmail },
    create: { userEmail, ...updateData },
    update: updateData,
  })
}

// ─── Write: goals, insights, financial metrics (create/delete/pin) ────────────

export async function addGoal(
  userEmail: string,
  data: { type: string; target: string; period?: string; notes?: string }
): Promise<GoalData> {
  const goal = await db.businessGoal.create({
    data: { userEmail, ...data },
  })
  return {
    id: goal.id,
    type: goal.type,
    target: goal.target,
    period: goal.period,
    notes: goal.notes,
    pinned: goal.pinned,
  }
}

export async function deleteGoal(id: string, userEmail: string): Promise<void> {
  await db.businessGoal.deleteMany({ where: { id, userEmail } })
}

export async function togglePinGoal(id: string, userEmail: string): Promise<void> {
  const goal = await db.businessGoal.findFirst({ where: { id, userEmail } })
  if (goal) {
    await db.businessGoal.update({ where: { id }, data: { pinned: !goal.pinned } })
  }
}

export async function addInsight(
  userEmail: string,
  data: { category: string; content: string; source?: string }
): Promise<InsightData> {
  const insight = await db.oracleInsight.create({
    data: { userEmail, source: 'user', ...data },
  })
  return {
    id: insight.id,
    category: insight.category,
    content: insight.content,
    source: insight.source,
    pinned: insight.pinned,
    createdAt: insight.createdAt.toISOString(),
  }
}

export async function deleteInsight(id: string, userEmail: string): Promise<void> {
  await db.oracleInsight.deleteMany({ where: { id, userEmail } })
}

export async function togglePinInsight(id: string, userEmail: string): Promise<void> {
  const insight = await db.oracleInsight.findFirst({ where: { id, userEmail } })
  if (insight) {
    await db.oracleInsight.update({ where: { id }, data: { pinned: !insight.pinned } })
  }
}

export async function addFinancialMetric(
  userEmail: string,
  data: { metricType: string; period?: string; value: number; trend?: string; annotation?: string }
): Promise<FinancialMetricData> {
  const metric = await db.financialMetric.create({
    data: { userEmail, ...data },
  })
  return {
    id: metric.id,
    metricType: metric.metricType,
    period: metric.period,
    value: metric.value,
    trend: metric.trend,
    annotation: metric.annotation,
    pinned: metric.pinned,
  }
}

export async function deleteFinancialMetric(id: string, userEmail: string): Promise<void> {
  await db.financialMetric.deleteMany({ where: { id, userEmail } })
}

export async function togglePinFinancialMetric(id: string, userEmail: string): Promise<void> {
  const metric = await db.financialMetric.findFirst({ where: { id, userEmail } })
  if (metric) {
    await db.financialMetric.update({ where: { id }, data: { pinned: !metric.pinned } })
  }
}

// ─── Write: client memory ─────────────────────────────────────────────────────

export async function upsertClientMemory(
  clientId: string,
  userEmail: string,
  data: { paymentBehaviour?: string; riskNotes?: string; customNotes?: string }
): Promise<void> {
  await db.clientMemory.upsert({
    where: { clientId },
    create: { clientId, userEmail, ...data },
    update: { ...data, ...(userEmail ? {} : {}) },
  })
}

export async function deleteClientMemory(clientId: string, userEmail: string): Promise<void> {
  await db.clientMemory.deleteMany({ where: { clientId, userEmail } })
}

export async function togglePinClientMemory(clientId: string, userEmail: string): Promise<void> {
  const cm = await db.clientMemory.findFirst({ where: { clientId, userEmail } })
  if (cm) {
    await db.clientMemory.update({ where: { id: cm.id }, data: { pinned: !cm.pinned } })
  }
}

// ─── Write: conversation memory (called after each Oracle turn) ───────────────

export async function recordConversation(
  userEmail: string,
  userMessage: string,
  oracleResponse: string,
  role?: string,
  fn?: string
): Promise<void> {
  // Truncate the oracle response to avoid storing huge blobs
  const truncatedResponse = truncate(oracleResponse, 4000)
  const truncatedMessage = truncate(userMessage, 2000)

  await db.conversationMemory.create({
    data: {
      userEmail,
      userMessage: truncatedMessage,
      oracleResponse: truncatedResponse,
      role: role || null,
      fn: fn || null,
    },
  })

  // Keep only the most recent 50 conversations per user (auto-cleanup)
  const count = await db.conversationMemory.count({ where: { userEmail } })
  if (count > 50) {
    const oldConvs = await db.conversationMemory.findMany({
      where: { userEmail },
      orderBy: { createdAt: 'desc' },
      skip: 50,
      select: { id: true },
    })
    if (oldConvs.length > 0) {
      await db.conversationMemory.deleteMany({
        where: { id: { in: oldConvs.map((c) => c.id) } },
      })
    }
  }
}

// ─── Write: delete all memory for a user ──────────────────────────────────────

export async function clearAllMemory(userEmail: string): Promise<void> {
  await Promise.all([
    db.userProfile.deleteMany({ where: { userEmail } }),
    db.firmProfile.deleteMany({ where: { userEmail } }),
    db.businessGoal.deleteMany({ where: { userEmail } }),
    db.userPreference.deleteMany({ where: { userEmail } }),
    db.clientMemory.deleteMany({ where: { userEmail } }),
    db.financialMetric.deleteMany({ where: { userEmail } }),
    db.conversationMemory.deleteMany({ where: { userEmail } }),
    db.oracleInsight.deleteMany({ where: { userEmail } }),
    db.memoryEmbedding.deleteMany({ where: { userEmail } }),
  ])
}
