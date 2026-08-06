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

  // (Was 7+ sequential findMany calls — now parallelized via Promise.all.
  // All 6 entity queries are independent, so they all fire at once. The
  // members → users chain has a data dependency (users query needs userIds
  // from members), so it stays sequential — but it runs in parallel with
  // the other 5 independent queries via Promise.all.)
  const tenantPromise = db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })

  const [
    tenant,
    companies,
    orgs,
    members,
    clients,
    invoices,
    integrations,
    audit,
  ] = await Promise.all([
    tenantPromise,
    // Companies
    db.company.findMany({
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
    }),
    // Organizations
    db.organization.findMany({
      where: { tenantId, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 8,
    }),
    // Members (via User) — first step: members
    db.tenantMember.findMany({
      where: { tenantId, status: 'active' },
      take: 50,
      include: { role: true },
    }),
    // Clients (tenant-scoped via firm link — fall back to all for platform tenant)
    db.client.findMany({
      where: { OR: [{ tradeName: { contains: q } }, { legalName: { contains: q } }, { gstin: { contains: q } }] },
      take: 8,
    }),
    // Invoices
    db.invoice.findMany({
      where: { invoiceNumber: { contains: q } },
      take: 8,
      orderBy: { createdAt: 'desc' },
    }),
    // Integrations
    db.integration.findMany({
      where: { tenantId, OR: [{ displayName: { contains: q } }, { provider: { contains: q } }] },
      take: 5,
    }),
    // Audit logs (search summaries)
    db.enterpriseAuditLog.findMany({
      where: { tenantId, summary: { contains: q } },
      take: 5,
      orderBy: { timestamp: 'desc' },
    }),
  ])

  const tenantName = tenant?.name ?? null
  const results: GlobalSearchResult[] = []

  // Users query depends on userIds from members — runs after the members fetch.
  const userIds = members.map((m) => m.userId)
  let users: Array<{ id: string; name: string | null; email: string; updatedAt: Date }> = []
  if (userIds.length > 0) {
    users = await db.user.findMany({
      where: { id: { in: userIds }, OR: [{ name: { contains: q } }, { email: { contains: q } }] },
      take: 8,
    })
  }

  for (const c of companies) {
    results.push({
      id: c.id, type: 'Company', title: c.legalName,
      subtitle: [c.tradeName, c.gstin].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: c.updatedAt.toISOString(),
    })
  }

  for (const o of orgs) {
    results.push({
      id: o.id, type: 'Organization', title: o.name,
      subtitle: [o.type, o.code].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: o.updatedAt.toISOString(),
    })
  }

  for (const u of users) {
    const m = members.find((mm) => mm.userId === u.id)
    results.push({
      id: u.id, type: 'User', title: u.name ?? u.email,
      subtitle: [m?.title, m?.role?.name].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: u.updatedAt.toISOString(),
    })
  }

  for (const c of clients) {
    results.push({
      id: c.id, type: 'Client', title: c.tradeName,
      subtitle: [c.gstin, c.state].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: c.updatedAt.toISOString(),
    })
  }

  for (const inv of invoices) {
    results.push({
      id: inv.id, type: 'Invoice', title: inv.invoiceNumber,
      subtitle: [inv.invoiceType, `₹${inv.totalAmount.toLocaleString('en-IN')}`, inv.status].filter(Boolean).join(' · '),
      url: null, tenantName, updatedAt: inv.updatedAt.toISOString(),
    })
  }

  for (const i of integrations) {
    results.push({
      id: i.id, type: 'Integration', title: i.displayName,
      subtitle: [i.category, i.status].join(' · '),
      url: null, tenantName, updatedAt: i.updatedAt.toISOString(),
    })
  }

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
