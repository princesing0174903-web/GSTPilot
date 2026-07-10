// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE NETWORK™ — B2B COMMERCE CLOUD ENGINE
// RFQ → Quotation → PurchaseOrder → Contract lifecycle. Real counters, real
// sums, real recent rows with resolved node names. Every creation also emits
// a NetworkTransaction audit row so the broader graph stays in sync.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  B2BCommerceSummary,
  ContractStatus,
  ContractSummary,
  ContractType,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
  RfqCategory,
  RfqStatus,
  RfqSummary,
} from './types';
import { resolveNodeId } from './organizations';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeParseJSON<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function pickName(n: { legalName: string; tradeName: string | null }): string {
  return n.tradeName || n.legalName;
}

function dateStamp(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function random4(): string {
  // 1000-9999 → always 4 digits
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Resolve a list of node IDs into {id → name} in a single batched query.
async function resolveNodeNames(
  nodeIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(nodeIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return new Map();
  const nodes = await db.networkNode.findMany({
    where: { id: { in: ids } },
    select: { id: true, legalName: true, tradeName: true },
  });
  const map = new Map<string, string>();
  for (const n of nodes) {
    map.set(n.id, pickName(n));
  }
  return map;
}

// ─── B2B Commerce Summary ─────────────────────────────────────────────────────
export async function getB2BCommerceSummary(): Promise<B2BCommerceSummary> {
  const [
    totalRfqs,
    openRfqs,
    totalQuotations,
    totalPurchaseOrders,
    totalContracts,
    activeContracts,
    rfqValueAgg,
    poValueAgg,
    contractValueAgg,
    recentRfqRows,
    recentPoRows,
    recentContractRows,
  ] = await Promise.all([
    db.networkRfq.count(),
    db.networkRfq.count({ where: { status: 'open' } }),
    db.networkQuotation.count(),
    db.networkPurchaseOrder.count(),
    db.networkContract.count(),
    db.networkContract.count({ where: { status: 'active' } }),
    db.networkRfq.aggregate({ _sum: { budgetMax: true } }),
    db.networkPurchaseOrder.aggregate({ _sum: { totalValue: true } }),
    db.networkContract.aggregate({ _sum: { value: true } }),
    db.networkRfq.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    db.networkPurchaseOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    db.networkContract.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  // Resolve all node names in a single batched query
  const nodeIdList: Array<string | null | undefined> = [];
  for (const r of recentRfqRows) {
    nodeIdList.push(r.fromNodeId, r.toNodeId);
  }
  for (const p of recentPoRows) {
    nodeIdList.push(p.fromNodeId, p.toNodeId);
  }
  for (const c of recentContractRows) {
    nodeIdList.push(c.fromNodeId, c.toNodeId);
  }
  const nameById = await resolveNodeNames(nodeIdList);

  const recentRfqs: RfqSummary[] = recentRfqRows.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    fromNodeId: r.fromNodeId,
    fromName: nameById.get(r.fromNodeId) ?? 'Unknown',
    toNodeId: r.toNodeId,
    toName: r.toNodeId ? (nameById.get(r.toNodeId) ?? null) : null,
    title: r.title,
    description: r.description,
    category: r.category as RfqCategory,
    quantity: r.quantity,
    unit: r.unit,
    budgetMax: Number(r.budgetMax),
    currency: r.currency,
    deliveryDate: r.deliveryDate ? r.deliveryDate.toISOString() : null,
    deliveryLocation: r.deliveryLocation,
    status: r.status as RfqStatus,
    quotationsCount: r.quotationsCount,
    createdAt: r.createdAt.toISOString(),
  }));

  const recentPurchaseOrders: PurchaseOrderSummary[] = recentPoRows.map((p) => ({
    id: p.id,
    poNumber: p.poNumber,
    fromNodeId: p.fromNodeId,
    fromName: nameById.get(p.fromNodeId) ?? 'Unknown',
    toNodeId: p.toNodeId,
    toName: nameById.get(p.toNodeId) ?? 'Unknown',
    title: p.title,
    totalValue: Number(p.totalValue),
    currency: p.currency,
    status: p.status as PurchaseOrderStatus,
    deliveryDate: p.deliveryDate ? p.deliveryDate.toISOString() : null,
    items: safeParseJSON<
      Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }>
    >(p.items, []),
    createdAt: p.createdAt.toISOString(),
  }));

  const recentContracts: ContractSummary[] = recentContractRows.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    fromNodeId: c.fromNodeId,
    fromName: nameById.get(c.fromNodeId) ?? 'Unknown',
    toNodeId: c.toNodeId,
    toName: nameById.get(c.toNodeId) ?? 'Unknown',
    title: c.title,
    type: c.type as ContractType,
    value: Number(c.value),
    currency: c.currency,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    status: c.status as ContractStatus,
    terms: c.terms,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    totalRfqs,
    openRfqs,
    totalQuotations,
    totalPurchaseOrders,
    totalContracts,
    activeContracts,
    totalRfqValue: Number(rfqValueAgg._sum.budgetMax ?? 0),
    totalPoValue: Number(poValueAgg._sum.totalValue ?? 0),
    totalContractValue: Number(contractValueAgg._sum.value ?? 0),
    recentRfqs,
    recentPurchaseOrders,
    recentContracts,
  };
}

// ─── Create RFQ ───────────────────────────────────────────────────────────────
export async function createRfq(params: {
  fromNodeId: string;
  toNodeId?: string;
  title: string;
  description: string;
  category: RfqCategory;
  quantity: number;
  unit: string;
  budgetMax: number;
  currency: string;
  deliveryDate?: string;
  deliveryLocation?: string;
}): Promise<RfqSummary> {
  // Resolve logical aliases ("host", "bharat-steel") to real NetworkNode IDs
  const fromNodeId = await resolveNodeId(params.fromNodeId);
  const toNodeId = params.toNodeId ? await resolveNodeId(params.toNodeId) : null;

  const rfqNumber = `RFQ-${dateStamp()}-${random4()}`;
  const rfq = await db.networkRfq.create({
    data: {
      rfqNumber,
      fromNodeId,
      toNodeId,
      title: params.title,
      description: params.description,
      category: params.category,
      quantity: params.quantity,
      unit: params.unit,
      budgetMax: Number(params.budgetMax),
      currency: params.currency,
      deliveryDate: params.deliveryDate ? new Date(params.deliveryDate) : null,
      deliveryLocation: params.deliveryLocation ?? null,
      status: 'open',
      quotationsCount: 0,
    },
  });

  // Emit a NetworkTransaction of type 'quotation' so the broader graph tracks it
  await db.networkTransaction
    .create({
      data: {
        transactionNumber: `NTXN-${rfqNumber}`,
        fromNodeId,
        toNodeId,
        type: 'quotation',
        reference: rfqNumber,
        amount: Number(params.budgetMax),
        currency: params.currency,
        status: 'pending',
        metadata: JSON.stringify({ source: 'rfq', rfqId: rfq.id }),
      },
    })
    .catch(() => {
      /* unique-constraint guard */
    });

  const nameById = await resolveNodeNames([rfq.fromNodeId, rfq.toNodeId].filter(Boolean) as string[]);

  return {
    id: rfq.id,
    rfqNumber: rfq.rfqNumber,
    fromNodeId: rfq.fromNodeId,
    fromName: nameById.get(rfq.fromNodeId) ?? 'Unknown',
    toNodeId: rfq.toNodeId,
    toName: rfq.toNodeId ? (nameById.get(rfq.toNodeId) ?? null) : null,
    title: rfq.title,
    description: rfq.description,
    category: rfq.category as RfqCategory,
    quantity: rfq.quantity,
    unit: rfq.unit,
    budgetMax: Number(rfq.budgetMax),
    currency: rfq.currency,
    deliveryDate: rfq.deliveryDate ? rfq.deliveryDate.toISOString() : null,
    deliveryLocation: rfq.deliveryLocation,
    status: rfq.status as RfqStatus,
    quotationsCount: rfq.quotationsCount,
    createdAt: rfq.createdAt.toISOString(),
  };
}

// ─── Create Purchase Order ────────────────────────────────────────────────────
export async function createPurchaseOrder(params: {
  fromNodeId: string;
  toNodeId: string;
  rfqId?: string;
  quotationId?: string;
  title: string;
  totalValue: number;
  currency: string;
  deliveryDate?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }>;
}): Promise<PurchaseOrderSummary> {
  // Resolve logical aliases ("host", "bharat-steel") to real NetworkNode IDs
  const fromNodeId = await resolveNodeId(params.fromNodeId);
  const toNodeId = await resolveNodeId(params.toNodeId);
  const poNumber = `PO-${dateStamp()}-${random4()}`;
  const itemsJson = JSON.stringify(params.items ?? []);

  const po = await db.networkPurchaseOrder.create({
    data: {
      poNumber,
      fromNodeId,
      toNodeId,
      rfqId: params.rfqId ?? null,
      quotationId: params.quotationId ?? null,
      title: params.title,
      totalValue: Number(params.totalValue),
      currency: params.currency,
      status: 'draft',
      deliveryDate: params.deliveryDate ? new Date(params.deliveryDate) : null,
      items: itemsJson,
    },
  });

  // Emit a NetworkTransaction of type 'purchase_order'
  await db.networkTransaction
    .create({
      data: {
        transactionNumber: `NTXN-${poNumber}`,
        fromNodeId,
        toNodeId,
        type: 'purchase_order',
        reference: poNumber,
        amount: Number(params.totalValue),
        currency: params.currency,
        status: 'pending',
        metadata: JSON.stringify({ source: 'purchase_order', poId: po.id }),
      },
    })
    .catch(() => {
      /* unique-constraint guard */
    });

  const nameById = await resolveNodeNames([po.fromNodeId, po.toNodeId]);

  return {
    id: po.id,
    poNumber: po.poNumber,
    fromNodeId: po.fromNodeId,
    fromName: nameById.get(po.fromNodeId) ?? 'Unknown',
    toNodeId: po.toNodeId,
    toName: nameById.get(po.toNodeId) ?? 'Unknown',
    title: po.title,
    totalValue: Number(po.totalValue),
    currency: po.currency,
    status: po.status as PurchaseOrderStatus,
    deliveryDate: po.deliveryDate ? po.deliveryDate.toISOString() : null,
    items: safeParseJSON<
      Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }>
    >(po.items, []),
    createdAt: po.createdAt.toISOString(),
  };
}

// ─── Create Contract ──────────────────────────────────────────────────────────
export async function createContract(params: {
  fromNodeId: string;
  toNodeId: string;
  title: string;
  type: ContractType;
  value: number;
  currency: string;
  startDate: string;
  endDate?: string;
  terms?: string;
}): Promise<ContractSummary> {
  // Resolve logical aliases ("host", "bharat-steel") to real NetworkNode IDs
  const fromNodeId = await resolveNodeId(params.fromNodeId);
  const toNodeId = await resolveNodeId(params.toNodeId);
  const contractNumber = `CTR-${dateStamp()}-${random4()}`;
  const contract = await db.networkContract.create({
    data: {
      contractNumber,
      fromNodeId,
      toNodeId,
      title: params.title,
      type: params.type,
      value: Number(params.value),
      currency: params.currency,
      startDate: new Date(params.startDate),
      endDate: params.endDate ? new Date(params.endDate) : null,
      status: 'draft',
      terms: params.terms ?? null,
    },
  });

  // Emit a NetworkTransaction of type 'contract'
  await db.networkTransaction
    .create({
      data: {
        transactionNumber: `NTXN-${contractNumber}`,
        fromNodeId,
        toNodeId,
        type: 'contract',
        reference: contractNumber,
        amount: Number(params.value),
        currency: params.currency,
        status: 'pending',
        metadata: JSON.stringify({ source: 'contract', contractId: contract.id }),
      },
    })
    .catch(() => {
      /* unique-constraint guard */
    });

  const nameById = await resolveNodeNames([contract.fromNodeId, contract.toNodeId]);

  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    fromNodeId: contract.fromNodeId,
    fromName: nameById.get(contract.fromNodeId) ?? 'Unknown',
    toNodeId: contract.toNodeId,
    toName: nameById.get(contract.toNodeId) ?? 'Unknown',
    title: contract.title,
    type: contract.type as ContractType,
    value: Number(contract.value),
    currency: contract.currency,
    startDate: contract.startDate ? contract.startDate.toISOString() : null,
    endDate: contract.endDate ? contract.endDate.toISOString() : null,
    status: contract.status as ContractStatus,
    terms: contract.terms,
    signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
    createdAt: contract.createdAt.toISOString(),
  };
}
