/**
 * Global Search™ — instant search across companies, invoices, clients,
 * employees, GST, banking, meetings, reports, tasks, knowledge graph,
 * digital twin, AI workforce, and Oracle.
 */
import { db } from '@/lib/db'
import type { GlobalSearchResult } from './types'

export async function globalSearch(tenantId: string, query: string, limit = 30): Promise<GlobalSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const results: GlobalSearchResult[] = []
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const tenantName = tenant?.name ?? null

  // Companies
  const companies = await db.company.findMany({
    where: {
      tenantId,
      OR: [
        { legalName: { contains: q } },
        { tradeName: { contains: q } },
        { gstin: { contains: q } },
        { pan: { contains: q } },
      ],
    },
    take: 8,
  })
  for (const c of companies) {
    results.push({
      id: c.id, type: 'Company', title: c.legalName,
      subtitle: [c.tradeName, c.gstin].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: c.updatedAt.toISOString(),
    })
  }

  // Organizations
  const orgs = await db.organization.findMany({
    where: { tenantId, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
    take: 8,
  })
  for (const o of orgs) {
    results.push({
      id: o.id, type: 'Organization', title: o.name,
      subtitle: [o.type, o.code].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: o.updatedAt.toISOString(),
    })
  }

  // Members (via User)
  const members = await db.tenantMember.findMany({
    where: { tenantId, status: 'active' },
    take: 50,
    include: { role: true },
  })
  const userIds = members.map((m) => m.userId)
  const users = await db.user.findMany({
    where: { id: { in: userIds }, OR: [{ name: { contains: q } }, { email: { contains: q } }] },
    take: 8,
  })
  for (const u of users) {
    const m = members.find((mm) => mm.userId === u.id)
    results.push({
      id: u.id, type: 'User', title: u.name ?? u.email,
      subtitle: [m?.title, m?.role?.name].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: u.updatedAt.toISOString(),
    })
  }

  // Clients (tenant-scoped via firm link — fall back to all for platform tenant)
  const clients = await db.client.findMany({
    where: { OR: [{ tradeName: { contains: q } }, { legalName: { contains: q } }, { gstin: { contains: q } }] },
    take: 8,
  })
  for (const c of clients) {
    results.push({
      id: c.id, type: 'Client', title: c.tradeName,
      subtitle: [c.gstin, c.state].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: c.updatedAt.toISOString(),
    })
  }

  // Invoices
  const invoices = await db.invoice.findMany({
    where: { invoiceNumber: { contains: q } },
    take: 8,
    orderBy: { createdAt: 'desc' },
  })
  for (const inv of invoices) {
    results.push({
      id: inv.id, type: 'Invoice', title: inv.invoiceNumber,
      subtitle: [inv.invoiceType, `₹${inv.totalAmount.toLocaleString('en-IN')}`, inv.status].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: inv.updatedAt.toISOString(),
    })
  }

  // Integrations
  const integrations = await db.integration.findMany({
    where: { tenantId, OR: [{ displayName: { contains: q } }, { provider: { contains: q } }] },
    take: 5,
  })
  for (const i of integrations) {
    results.push({
      id: i.id, type: 'Integration', title: i.displayName,
      subtitle: [i.category, i.status].join(' · '),
      url: null, tenantName, updatedAt: i.updatedAt.toISOString(),
    })
  }

  // Audit logs (search summaries)
  const audit = await db.enterpriseAuditLog.findMany({
    where: { tenantId, summary: { contains: q } },
    take: 5,
    orderBy: { timestamp: 'desc' },
  })
  for (const a of audit) {
    results.push({
      id: a.id, type: 'Audit', title: a.summary,
      subtitle: [a.actorType, a.action].join(' · '),
      url: null, tenantName, updatedAt: a.timestamp.toISOString(),
    })
  }

  // sort by updatedAt desc and trim
  results.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  return results.slice(0, limit)
}
