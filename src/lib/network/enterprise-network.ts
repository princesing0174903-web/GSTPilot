// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ENTERPRISE NETWORK™ — ENTERPRISE NETWORK (CONNECTIONS & COLLABORATION)
// Org-to-org connections, collaboration counts, document/invoice/PO/contract
// exchanges — all derived from REAL NetworkConnection + NetworkTransaction rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { EnterpriseNetworkSummary, NetworkConnectionSummary } from './types';

function mapConnection(c: {
  id: string;
  fromOrgId: string;
  toOrgId: string;
  fromNodeName: string;
  toNodeName: string;
  status: string;
  relationshipType: string;
  message: string | null;
  initiatedBy: string;
  createdAt: Date;
  acceptedAt: Date | null;
}): NetworkConnectionSummary {
  return {
    id: c.id,
    fromOrgId: c.fromOrgId,
    toOrgId: c.toOrgId,
    fromNodeName: c.fromNodeName,
    toNodeName: c.toNodeName,
    status: c.status as NetworkConnectionSummary['status'],
    relationshipType: c.relationshipType as NetworkConnectionSummary['relationshipType'],
    message: c.message,
    initiatedBy: c.initiatedBy,
    createdAt: c.createdAt.toISOString(),
    acceptedAt: c.acceptedAt ? c.acceptedAt.toISOString() : null,
  };
}

export async function getEnterpriseNetworkSummary(): Promise<EnterpriseNetworkSummary> {
  const [total, pending, accepted, recent, txByType, activeEdges] = await Promise.all([
    db.networkConnection.count(),
    db.networkConnection.count({ where: { status: 'pending' } }),
    db.networkConnection.count({ where: { status: 'accepted' } }),
    db.networkConnection.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.networkTransaction.groupBy({ by: ['type'], _count: { id: true } }),
    db.networkEdge.count({ where: { status: 'active' } }),
  ]);

  const byType: Record<string, number> = {};
  for (const t of txByType) byType[t.type] = t._count.id;

  return {
    totalConnections: total,
    pendingConnections: pending,
    acceptedConnections: accepted,
    activeCollaborations: activeEdges,
    sharedWorkflows: 0, // workflows are tracked in the ecosystem module
    exchangedDocuments: byType['document'] ?? 0,
    exchangedInvoices: byType['invoice'] ?? 0,
    exchangedPurchaseOrders: byType['purchase_order'] ?? 0,
    exchangedContracts: byType['contract'] ?? 0,
    recentConnections: recent.map(mapConnection),
  };
}

export async function createConnection(params: {
  fromOrgId: string;
  toOrgId: string;
  fromNodeName: string;
  toNodeName: string;
  relationshipType?: string;
  message?: string;
  initiatedBy: string;
}): Promise<NetworkConnectionSummary> {
  // Idempotent: if a connection already exists for this (fromOrgId, toOrgId) pair,
  // update its message/relationshipType and return it instead of failing on the
  // unique constraint. This makes repeated "Connect" button clicks safe.
  const created = await db.networkConnection.upsert({
    where: {
      fromOrgId_toOrgId: {
        fromOrgId: params.fromOrgId,
        toOrgId: params.toOrgId,
      },
    },
    update: {
      fromNodeName: params.fromNodeName,
      toNodeName: params.toNodeName,
      relationshipType: params.relationshipType ?? 'partner',
      message: params.message ?? null,
      initiatedBy: params.initiatedBy,
    },
    create: {
      fromOrgId: params.fromOrgId,
      toOrgId: params.toOrgId,
      fromNodeName: params.fromNodeName,
      toNodeName: params.toNodeName,
      relationshipType: params.relationshipType ?? 'partner',
      message: params.message ?? null,
      initiatedBy: params.initiatedBy,
      status: 'pending',
    },
  });
  return mapConnection(created);
}

export async function acceptConnection(connectionId: string): Promise<NetworkConnectionSummary> {
  const updated = await db.networkConnection.update({
    where: { id: connectionId },
    data: { status: 'accepted', acceptedAt: new Date() },
  });
  return mapConnection(updated);
}

export async function listConnections(filter?: {
  status?: string;
  limit?: number;
}): Promise<NetworkConnectionSummary[]> {
  const where: Record<string, unknown> = {};
  if (filter?.status) where.status = filter.status;
  const rows = await db.networkConnection.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filter?.limit ?? 50,
  });
  return rows.map(mapConnection);
}
