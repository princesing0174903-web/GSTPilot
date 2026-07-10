/**
 * Organization Hierarchy™ — unlimited-depth org tree with permission inheritance.
 * Builds a nested tree from flat DB rows, supports CRUD and depth traversal.
 */
import { db } from '@/lib/db'
import type { HierarchyNode, OrgType } from './types'

export async function getOrgTree(tenantId: string): Promise<HierarchyNode[]> {
  const orgs = await db.organization.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, type: true, code: true, parentId: true,
      _count: { select: { members: true, companies: true } },
    },
  })
  const map = new Map<string, HierarchyNode>()
  for (const o of orgs) {
    map.set(o.id, {
      id: o.id, name: o.name, type: o.type as OrgType, code: o.code,
      parentId: o.parentId, children: [],
      memberCount: o._count.members, companyCount: o._count.companies,
    })
  }
  const roots: HierarchyNode[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export async function createOrganization(tenantId: string, data: {
  name: string
  type: OrgType
  parentId?: string | null
  code?: string | null
  description?: string | null
}) {
  return db.organization.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type,
      parentId: data.parentId ?? null,
      code: data.code ?? null,
      description: data.description ?? null,
    },
  })
}

/** Flatten the tree into a list with depth for display. */
export function flattenTree(roots: HierarchyNode[]): (HierarchyNode & { depth: number })[] {
  const out: (HierarchyNode & { depth: number })[] = []
  const walk = (nodes: HierarchyNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ ...n, depth })
      if (n.children.length) walk(n.children, depth + 1)
    }
  }
  walk(roots, 0)
  return out
}

/** Count total nodes + max depth — for admin stats. */
export function treeStats(roots: HierarchyNode[]): { total: number; maxDepth: number } {
  let total = 0
  let maxDepth = 0
  const walk = (nodes: HierarchyNode[], depth: number) => {
    for (const n of nodes) {
      total++
      maxDepth = Math.max(maxDepth, depth)
      if (n.children.length) walk(n.children, depth + 1)
    }
  }
  walk(roots, 0)
  return { total, maxDepth }
}
