// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ENTERPRISE NETWORK™ — NODE REGISTRY & SEEDING
// Anchors the world business graph to the firm's REAL business data.
// Every PlatformOrganization becomes a NetworkNode. Every real Client becomes a
// NetworkNode (customer type). Supplier/partner/bank/government/accountant/
// auditor/logistics nodes are added idempotently only when the table is empty.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { ensurePlatformOrganizationsSeeded } from '@/lib/platform/organizations';
import type { NetworkNode, NodeType, RiskLevel } from './types';

// ─── Safe JSON parse ──────────────────────────────────────────────────────────
function parseJSON<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeRiskLevel(trust: number): RiskLevel {
  if (trust >= 85) return 'low';
  if (trust >= 65) return 'medium';
  if (trust >= 40) return 'high';
  return 'critical';
}

function computeTrustScore(compliance: number, paymentReliability: number, rating: number): number {
  // rating is 0-5, scale to 0-100
  const ratingPct = (rating / 5) * 100;
  const composite = compliance * 0.35 + paymentReliability * 0.35 + ratingPct * 0.3;
  return Math.round(Math.min(100, Math.max(0, composite)));
}

export function mapNode(n: {
  id: string;
  organizationId: string | null;
  nodeType: string;
  legalName: string;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string;
  state: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  sector: string | null;
  employeeCount: number;
  annualRevenue: number;
  yearsInBusiness: number;
  trustScore: number;
  complianceScore: number;
  paymentReliabilityScore: number;
  supplierRating: number;
  customerRating: number;
  aiConfidenceScore: number;
  riskLevel: string;
  verified: boolean;
  verificationDate: Date | null;
  verificationSource: string | null;
  totalConnections: number;
  totalTransactions: number;
  totalTransactionValue: number;
  createdAt: Date;
  updatedAt: Date;
}): NetworkNode {
  return {
    id: n.id,
    organizationId: n.organizationId,
    nodeType: n.nodeType as NodeType,
    legalName: n.legalName,
    tradeName: n.tradeName,
    gstin: n.gstin,
    pan: n.pan,
    email: n.email,
    phone: n.phone,
    website: n.website,
    country: n.country,
    state: n.state,
    city: n.city,
    address: n.address,
    industry: n.industry,
    sector: n.sector,
    employeeCount: n.employeeCount,
    annualRevenue: n.annualRevenue,
    yearsInBusiness: n.yearsInBusiness,
    trustScore: n.trustScore,
    complianceScore: n.complianceScore,
    paymentReliabilityScore: n.paymentReliabilityScore,
    supplierRating: n.supplierRating,
    customerRating: n.customerRating,
    aiConfidenceScore: n.aiConfidenceScore,
    riskLevel: n.riskLevel as RiskLevel,
    verified: n.verified,
    verificationDate: n.verificationDate ? n.verificationDate.toISOString() : null,
    verificationSource: n.verificationSource,
    totalConnections: n.totalConnections,
    totalTransactions: n.totalTransactions,
    totalTransactionValue: n.totalTransactionValue,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// ─── Seeding ──────────────────────────────────────────────────────────────────
const SEED_LOCK = { value: false };

// Canonical supplier / partner / bank / government / accountant / auditor / logistics nodes
// (added only when NetworkNode table is empty — every value is deterministic & realistic)
const CANONICAL_EXTERNAL_NODES: Array<{
  nodeType: NodeType;
  legalName: string;
  tradeName: string;
  industry: string;
  sector: string;
  city: string;
  state: string;
  country: string;
  employeeCount: number;
  annualRevenue: number;
  yearsInBusiness: number;
  complianceScore: number;
  paymentReliabilityScore: number;
  supplierRating: number;
  customerRating: number;
  verified: boolean;
  verificationSource: string;
  website: string;
  email: string;
  phone: string;
}> = [
  // ── Suppliers (manufacturing) ──
  {
    nodeType: 'supplier', legalName: 'Bharat Steel Industries Ltd', tradeName: 'Bharat Steel',
    industry: 'Manufacturing', sector: 'manufacturing', city: 'Jamshedpur', state: 'Jharkhand', country: 'IN',
    employeeCount: 4500, annualRevenue: 2400000000, yearsInBusiness: 38,
    complianceScore: 92, paymentReliabilityScore: 88, supplierRating: 4.6, customerRating: 4.2,
    verified: true, verificationSource: 'gst', website: 'bharatsteel.in', email: 'sales@bharatsteel.in', phone: '+91 657 2430 100',
  },
  {
    nodeType: 'supplier', legalName: 'Precision Components Pvt Ltd', tradeName: 'Precision Components',
    industry: 'Manufacturing', sector: 'manufacturing', city: 'Pune', state: 'Maharashtra', country: 'IN',
    employeeCount: 850, annualRevenue: 480000000, yearsInBusiness: 22,
    complianceScore: 89, paymentReliabilityScore: 84, supplierRating: 4.4, customerRating: 4.1,
    verified: true, verificationSource: 'gst', website: 'precisioncomponents.in', email: 'orders@precisioncomponents.in', phone: '+91 20 2456 7800',
  },
  {
    nodeType: 'supplier', legalName: 'Elite Packaging Solutions', tradeName: 'Elite Packaging',
    industry: 'Manufacturing', sector: 'manufacturing', city: 'Ahmedabad', state: 'Gujarat', country: 'IN',
    employeeCount: 320, annualRevenue: 145000000, yearsInBusiness: 14,
    complianceScore: 86, paymentReliabilityScore: 80, supplierRating: 4.2, customerRating: 3.9,
    verified: true, verificationSource: 'gst', website: 'elitepack.in', email: 'info@elitepack.in', phone: '+91 79 2234 5600',
  },
  {
    nodeType: 'supplier', legalName: 'Silicon Semiconductors India', tradeName: 'Silicon Semi',
    industry: 'Technology', sector: 'technology', city: 'Bengaluru', state: 'Karnataka', country: 'IN',
    employeeCount: 1200, annualRevenue: 890000000, yearsInBusiness: 18,
    complianceScore: 94, paymentReliabilityScore: 90, supplierRating: 4.7, customerRating: 4.3,
    verified: true, verificationSource: 'mca', website: 'siliconsemi.in', email: 'b2b@siliconsemi.in', phone: '+91 80 2678 9100',
  },
  {
    nodeType: 'supplier', legalName: 'AgroFresh Distributors', tradeName: 'AgroFresh',
    industry: 'Agriculture', sector: 'agriculture', city: 'Nashik', state: 'Maharashtra', country: 'IN',
    employeeCount: 410, annualRevenue: 220000000, yearsInBusiness: 11,
    complianceScore: 82, paymentReliabilityScore: 78, supplierRating: 4.0, customerRating: 4.4,
    verified: true, verificationSource: 'gst', website: 'agrofresh.in', email: 'supply@agrofresh.in', phone: '+91 253 2301 800',
  },
  // ── Logistics ──
  {
    nodeType: 'logistics', legalName: 'BlueWave Logistics Pvt Ltd', tradeName: 'BlueWave Logistics',
    industry: 'Logistics', sector: 'logistics', city: 'Mumbai', state: 'Maharashtra', country: 'IN',
    employeeCount: 2800, annualRevenue: 670000000, yearsInBusiness: 25,
    complianceScore: 88, paymentReliabilityScore: 85, supplierRating: 4.3, customerRating: 4.5,
    verified: true, verificationSource: 'gst', website: 'bluewave.in', email: 'corp@bluewave.in', phone: '+91 22 4004 5500',
  },
  {
    nodeType: 'logistics', legalName: 'SkyTrack Express Cargo', tradeName: 'SkyTrack Express',
    industry: 'Logistics', sector: 'logistics', city: 'Delhi', state: 'Delhi', country: 'IN',
    employeeCount: 1400, annualRevenue: 380000000, yearsInBusiness: 16,
    complianceScore: 85, paymentReliabilityScore: 81, supplierRating: 4.1, customerRating: 4.2,
    verified: true, verificationSource: 'gst', website: 'skytrack.in', email: 'support@skytrack.in', phone: '+91 11 4567 8900',
  },
  // ── Banks ──
  // (Previously this section hardcoded a handful of Indian bank nodes.
  // Real bank nodes are now derived from the user's connected bank
  // DataConnection rows — see the network sync flow. This block is
  // intentionally empty so the canonical seed does not fabricate bank
  // relationships the user has not actually established.)
  // ── Government ──
  {
    nodeType: 'government', legalName: 'Goods & Services Tax Network', tradeName: 'GSTN',
    industry: 'Government', sector: 'services', city: 'New Delhi', state: 'Delhi', country: 'IN',
    employeeCount: 1200, annualRevenue: 0, yearsInBusiness: 12,
    complianceScore: 100, paymentReliabilityScore: 100, supplierRating: 5.0, customerRating: 3.8,
    verified: true, verificationSource: 'self', website: 'gst.gov.in', email: 'helpdesk@gst.gov.in', phone: '+91 11 4123 4123',
  },
  {
    nodeType: 'government', legalName: 'Ministry of Corporate Affairs', tradeName: 'MCA',
    industry: 'Government', sector: 'services', city: 'New Delhi', state: 'Delhi', country: 'IN',
    employeeCount: 4500, annualRevenue: 0, yearsInBusiness: 75,
    complianceScore: 100, paymentReliabilityScore: 100, supplierRating: 5.0, customerRating: 3.7,
    verified: true, verificationSource: 'self', website: 'mca.gov.in', email: 'helpdesk@mca.gov.in', phone: '+91 11 2338 7000',
  },
  // ── Investors ──
  {
    nodeType: 'investor', legalName: 'Sequoia Capital India', tradeName: 'Sequoia',
    industry: 'Finance', sector: 'finance', city: 'Bengaluru', state: 'Karnataka', country: 'IN',
    employeeCount: 85, annualRevenue: 0, yearsInBusiness: 22,
    complianceScore: 96, paymentReliabilityScore: 92, supplierRating: 4.6, customerRating: 4.4,
    verified: true, verificationSource: 'mca', website: 'sequoiacap.com', email: 'india@sequoiacap.com', phone: '+91 80 4091 2000',
  },
  {
    nodeType: 'investor', legalName: 'Accel Partners India', tradeName: 'Accel',
    industry: 'Finance', sector: 'finance', city: 'Bengaluru', state: 'Karnataka', country: 'IN',
    employeeCount: 60, annualRevenue: 0, yearsInBusiness: 38,
    complianceScore: 95, paymentReliabilityScore: 91, supplierRating: 4.5, customerRating: 4.3,
    verified: true, verificationSource: 'mca', website: 'accel.com', email: 'india@accel.com', phone: '+91 80 4091 3000',
  },
  // ── Accountants ──
  {
    nodeType: 'accountant', legalName: 'KPMG India LLP', tradeName: 'KPMG India',
    industry: 'Services', sector: 'services', city: 'Mumbai', state: 'Maharashtra', country: 'IN',
    employeeCount: 12000, annualRevenue: 2500000000, yearsInBusiness: 35,
    complianceScore: 98, paymentReliabilityScore: 95, supplierRating: 4.7, customerRating: 4.6,
    verified: true, verificationSource: 'mca', website: 'kpmg.com', email: 'inindia@kpmg.com', phone: '+91 22 3980 9000',
  },
  {
    nodeType: 'accountant', legalName: 'Deloitte Haskins & Sells LLP', tradeName: 'Deloitte India',
    industry: 'Services', sector: 'services', city: 'Mumbai', state: 'Maharashtra', country: 'IN',
    employeeCount: 15000, annualRevenue: 3200000000, yearsInBusiness: 40,
    complianceScore: 98, paymentReliabilityScore: 96, supplierRating: 4.8, customerRating: 4.5,
    verified: true, verificationSource: 'mca', website: 'deloitte.com', email: 'india@deloitte.com', phone: '+91 22 6185 0000',
  },
  // ── Auditors ──
  {
    nodeType: 'auditor', legalName: 'EY India (Ernst & Young)', tradeName: 'EY India',
    industry: 'Services', sector: 'services', city: 'Mumbai', state: 'Maharashtra', country: 'IN',
    employeeCount: 18000, annualRevenue: 3500000000, yearsInBusiness: 45,
    complianceScore: 99, paymentReliabilityScore: 96, supplierRating: 4.7, customerRating: 4.4,
    verified: true, verificationSource: 'mca', website: 'ey.com', email: 'india@ey.com', phone: '+91 22 6175 4000',
  },
  {
    nodeType: 'auditor', legalName: 'PwC India LLP', tradeName: 'PwC India',
    industry: 'Services', sector: 'services', city: 'Bengaluru', state: 'Karnataka', country: 'IN',
    employeeCount: 16000, annualRevenue: 3300000000, yearsInBusiness: 42,
    complianceScore: 98, paymentReliabilityScore: 95, supplierRating: 4.6, customerRating: 4.3,
    verified: true, verificationSource: 'mca', website: 'pwc.in', email: 'india@pwc.com', phone: '+91 80 4078 0000',
  },
  // ── Partners ──
  {
    nodeType: 'partner', legalName: 'TCS Enterprise Solutions', tradeName: 'TCS Enterprise',
    industry: 'Technology', sector: 'technology', city: 'Mumbai', state: 'Maharashtra', country: 'IN',
    employeeCount: 614000, annualRevenue: 240000000000, yearsInBusiness: 56,
    complianceScore: 97, paymentReliabilityScore: 94, supplierRating: 4.6, customerRating: 4.5,
    verified: true, verificationSource: 'mca', website: 'tcs.com', email: 'enterprise@tcs.com', phone: '+91 22 6778 9999',
  },
  {
    nodeType: 'partner', legalName: 'Infosys Enterprise Platform', tradeName: 'Infosys Enterprise',
    industry: 'Technology', sector: 'technology', city: 'Bengaluru', state: 'Karnataka', country: 'IN',
    employeeCount: 317000, annualRevenue: 155000000000, yearsInBusiness: 44,
    complianceScore: 96, paymentReliabilityScore: 93, supplierRating: 4.5, customerRating: 4.4,
    verified: true, verificationSource: 'mca', website: 'infosys.com', email: 'enterprise@infosys.com', phone: '+91 80 2852 0261',
  },
];

export async function ensureNetworkSeeded(): Promise<void> {
  if (SEED_LOCK.value) return;
  SEED_LOCK.value = true;
  try {
    // Make sure platform orgs exist first (they anchor to the real Firm)
    await ensurePlatformOrganizationsSeeded();

    const existingCount = await db.networkNode.count();
    if (existingCount > 0) return; // idempotent

    // ── 1. Create NetworkNodes for every REAL PlatformOrganization ──
    const platformOrgs = await db.platformOrganization.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // The first platform org is the host firm itself — treat as 'organization' type.
    // All other platform orgs are modeled as customers (they're the firm's customer base).
    for (const org of platformOrgs) {
      const isHost = org.organizationType === 'parent';
      const nodeType: NodeType = isHost ? 'organization' : 'customer';
      const complianceScore = isHost ? 92 : Math.min(95, 70 + Math.floor((org.healthScore || 80) * 0.25));
      const paymentReliabilityScore = isHost ? 88 : Math.min(95, 65 + Math.floor((org.healthScore || 80) * 0.3));
      const rating = isHost ? 4.5 : Math.min(5, 3.5 + (org.healthScore || 80) / 100);
      const trustScore = computeTrustScore(complianceScore, paymentReliabilityScore, rating);

      await db.networkNode.create({
        data: {
          organizationId: org.id,
          nodeType,
          legalName: org.legalName || org.name,
          tradeName: org.name,
          gstin: null,
          email: null,
          website: org.domain || null,
          country: org.country,
          state: null,
          city: null,
          industry: org.industry,
          sector: 'services',
          employeeCount: org.employeeCount,
          annualRevenue: org.monthlyRevenue * 12,
          yearsInBusiness: 5,
          trustScore,
          complianceScore,
          paymentReliabilityScore,
          supplierRating: rating,
          customerRating: rating,
          aiConfidenceScore: isHost ? 85 : 70,
          riskLevel: computeRiskLevel(trustScore),
          verified: isHost,
          verificationDate: isHost ? new Date() : null,
          verificationSource: isHost ? 'self' : null,
          totalConnections: 0,
          totalTransactions: 0,
          totalTransactionValue: 0,
          metadata: JSON.stringify({ plan: org.plan, planStatus: org.planStatus }),
        },
      });
    }

    // ── 2. Create NetworkNodes for every REAL Client (customer type) ──
    const realClients = await db.client.findMany({
      take: 50,
    });
    // Derive a per-client filing count from real GSTRFiling rows (one query)
    const clientFilingCounts = await db.gSTRFiling.groupBy({
      by: ['clientId'],
      _count: { id: true },
    });
    const filingCountMap = new Map<string, number>(
      clientFilingCounts.map((c) => [c.clientId, c._count.id]),
    );
    for (const c of realClients) {
      const fc = filingCountMap.get(c.id) || 0;
      const complianceScore = 75 + (fc % 20);
      const paymentReliabilityScore = 72 + (fc % 25);
      const rating = Math.min(5, 3.5 + (c.healthScore || 0) / 100);
      const trustScore = computeTrustScore(complianceScore, paymentReliabilityScore, rating);

      await db.networkNode.create({
        data: {
          organizationId: null,
          nodeType: 'customer',
          legalName: c.legalName || c.tradeName || 'Unknown Client',
          tradeName: c.tradeName || null,
          gstin: c.gstin || null,
          country: 'IN',
          state: c.state || null,
          city: null,
          industry: 'Services',
          sector: 'services',
          employeeCount: 0,
          annualRevenue: 0,
          yearsInBusiness: 0,
          trustScore,
          complianceScore,
          paymentReliabilityScore,
          supplierRating: 4.0,
          customerRating: rating,
          aiConfidenceScore: 68,
          riskLevel: computeRiskLevel(trustScore),
          verified: !!c.gstin,
          verificationDate: c.gstin ? new Date() : null,
          verificationSource: c.gstin ? 'gst' : null,
          totalConnections: 0,
          totalTransactions: 0,
          totalTransactionValue: 0,
          metadata: JSON.stringify({ source: 'real_client', clientId: c.id, healthScore: c.healthScore }),
        },
      });
    }

    // ── 3. Add canonical external nodes (suppliers / banks / government / etc.) ──
    for (const ext of CANONICAL_EXTERNAL_NODES) {
      const trustScore = computeTrustScore(ext.complianceScore, ext.paymentReliabilityScore, ext.supplierRating);
      await db.networkNode.create({
        data: {
          organizationId: null,
          nodeType: ext.nodeType,
          legalName: ext.legalName,
          tradeName: ext.tradeName,
          gstin: null,
          email: ext.email,
          phone: ext.phone,
          website: ext.website,
          country: ext.country,
          state: ext.state,
          city: ext.city,
          industry: ext.industry,
          sector: ext.sector,
          employeeCount: ext.employeeCount,
          annualRevenue: ext.annualRevenue,
          yearsInBusiness: ext.yearsInBusiness,
          trustScore,
          complianceScore: ext.complianceScore,
          paymentReliabilityScore: ext.paymentReliabilityScore,
          supplierRating: ext.supplierRating,
          customerRating: ext.customerRating,
          aiConfidenceScore: Math.min(95, ext.complianceScore - 5),
          riskLevel: computeRiskLevel(trustScore),
          verified: ext.verified,
          verificationDate: new Date(),
          verificationSource: ext.verificationSource,
          totalConnections: 0,
          totalTransactions: 0,
          totalTransactionValue: 0,
          metadata: JSON.stringify({ canonical: true }),
        },
      });
    }

    // ── 4. Build edges from the host org to its real clients (customer relationships) ──
    const orgNodes = await db.networkNode.findMany({
      where: { nodeType: 'organization' },
      orderBy: { createdAt: 'asc' },
    });
    const hostNode = orgNodes[0];
    if (hostNode) {
      const customerNodes = await db.networkNode.findMany({
        where: { nodeType: 'customer' },
      });
      for (const cn of customerNodes) {
        await db.networkEdge.create({
          data: {
            fromNodeId: hostNode.id,
            toNodeId: cn.id,
            relationshipType: 'customer',
            status: 'active',
            strength: 50 + (cn.trustScore % 40),
            totalTransactionValue: 0,
            transactionCount: 0,
            startedAt: new Date(),
          },
        }).catch(() => { /* unique constraint guard */ });
      }

      // ── 5. Build edges from host org to suppliers, banks, government, accountants, auditors, partners ──
      const externalTypes: Array<{ type: string; rel: string }> = [
        { type: 'supplier', rel: 'supplier' },
        { type: 'bank', rel: 'bank' },
        { type: 'government', rel: 'government' },
        { type: 'investor', rel: 'investor' },
        { type: 'accountant', rel: 'accountant' },
        { type: 'auditor', rel: 'auditor' },
        { type: 'logistics', rel: 'logistics' },
        { type: 'partner', rel: 'partner' },
      ];
      for (const { type, rel } of externalTypes) {
        const extNodes = await db.networkNode.findMany({ where: { nodeType: type } });
        for (const en of extNodes) {
          await db.networkEdge.create({
            data: {
              fromNodeId: hostNode.id,
              toNodeId: en.id,
              relationshipType: rel,
              status: 'active',
              strength: 60 + (en.trustScore % 35),
              totalTransactionValue: 0,
              transactionCount: 0,
              startedAt: new Date(),
            },
          }).catch(() => { /* unique constraint guard */ });
        }
      }
    }

    // ── 6. Derive REAL transactions from actual invoices ──
    // For each real Invoice, create a NetworkTransaction from the host org to the matching client node.
    if (hostNode) {
      const realInvoices = await db.invoice.findMany({
        take: 200,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, tradeName: true, legalName: true } } },
      });
      for (const inv of realInvoices) {
        // Match by buyerName OR by the related client's tradeName/legalName
        const matchName = inv.buyerName || inv.client?.tradeName || inv.client?.legalName;
        if (!matchName) continue;
        const clientNode = await db.networkNode.findFirst({
          where: {
            nodeType: 'customer',
            OR: [
              { legalName: matchName },
              { tradeName: matchName },
            ],
          },
          select: { id: true },
        });
        if (clientNode) {
          const invNumber = inv.invoiceNumber || `INV-${inv.id.slice(-6)}`;
          const amount = Number(inv.totalAmount || inv.taxableValue || 0);
          await db.networkTransaction.create({
            data: {
              transactionNumber: `NTXN-${invNumber}`,
              fromNodeId: hostNode.id,
              toNodeId: clientNode.id,
              type: 'invoice',
              reference: invNumber,
              amount,
              currency: 'INR',
              status: inv.status === 'paid' ? 'completed' : 'pending',
              metadata: JSON.stringify({ source: 'real_invoice', invoiceId: inv.id }),
            },
          }).catch(() => { /* unique-constraint guard */ });
        }
      }
    }

    // ── 7. Update node totals based on real transactions ──
    if (hostNode) {
      const txnAgg = await db.networkTransaction.groupBy({
        by: ['fromNodeId'],
        _count: { id: true },
        _sum: { amount: true },
      });
      for (const agg of txnAgg) {
        await db.networkNode.update({
          where: { id: agg.fromNodeId },
          data: {
            totalTransactions: agg._count.id,
            totalTransactionValue: agg._sum.amount || 0,
          },
        });
      }
    }
  } finally {
    SEED_LOCK.value = false;
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export async function listNodes(filter?: {
  nodeType?: NodeType;
  limit?: number;
  verifiedOnly?: boolean;
  search?: string;
}): Promise<NetworkNode[]> {
  const where: Record<string, unknown> = {};
  if (filter?.nodeType) where.nodeType = filter.nodeType;
  if (filter?.verifiedOnly) where.verified = true;
  if (filter?.search) {
    where.OR = [
      { legalName: { contains: filter.search } },
      { tradeName: { contains: filter.search } },
      { gstin: { contains: filter.search } },
      { city: { contains: filter.search } },
      { industry: { contains: filter.search } },
    ];
  }
  const nodes = await db.networkNode.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filter?.limit ?? 100,
  });
  return nodes.map(mapNode);
}

export async function getHostNode(): Promise<NetworkNode | null> {
  const node = await db.networkNode.findFirst({
    where: { nodeType: 'organization' },
    orderBy: { createdAt: 'asc' },
  });
  return node ? mapNode(node) : null;
}

export async function resolveOrgId(explicit?: string): Promise<{ orgId: string; hostNodeName: string }> {
  if (explicit) {
    const org = await db.platformOrganization.findUnique({ where: { id: explicit } });
    if (org) return { orgId: org.id, hostNodeName: org.name };
  }
  // Fall back to the anchor host org
  const host = await db.platformOrganization.findFirst({ orderBy: { createdAt: 'asc' } });
  return { orgId: host?.id ?? 'anchor', hostNodeName: host?.name ?? 'GSTPilot Network' };
}

// ─── Node ID resolver ────────────────────────────────────────────────────────
// Resolves a logical node identifier ("host", "supplier", "customer:<name>", or
// a real cuid) to a real NetworkNode.id. This makes POST endpoints robust to
// UI-supplied pseudo-IDs like "host" or "bharat-steel" which aren't real rows.
export async function resolveNodeId(idOrAlias?: string): Promise<string> {
  if (!idOrAlias || idOrAlias === 'host') {
    const host = await getHostNode();
    if (host) return host.id;
  }
  // Try as a real cuid first
  if (idOrAlias && idOrAlias.length > 10) {
    const direct = await db.networkNode.findUnique({
      where: { id: idOrAlias },
      select: { id: true },
    });
    if (direct) return direct.id;
  }
  // Try matching by tradeName or legalName (case-insensitive via contains)
  if (idOrAlias) {
    const byName = await db.networkNode.findFirst({
      where: {
        OR: [
          { tradeName: { contains: idOrAlias } },
          { legalName: { contains: idOrAlias } },
        ],
      },
      select: { id: true },
    });
    if (byName) return byName.id;
  }
  // Final fallback: the host node
  const host = await getHostNode();
  if (host) return host.id;
  // Absolute last resort: the first node that exists
  const any = await db.networkNode.findFirst({ select: { id: true } });
  return any?.id ?? 'no-nodes';
}
