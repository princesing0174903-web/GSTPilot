// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 6: POLICY ENGINE™
// Approval workflows, multi-level authorization, country/department rules.
// On empty DB, seeds 3 canonical policies: India GST Filing Approval (2-level),
// Global Corporate Filing (3-level), Payroll Compliance (1-level).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  CompliancePolicy,
  PolicyType,
  RiskTolerance,
  ApprovalLevel,
  EscalationStep,
  FilingType,
  ComplianceFiling,
} from './types';

// ─── Canonical seed policies ─────────────────────────────────────────────────

interface SeedPolicy {
  name: string;
  description: string;
  policyType: PolicyType;
  countryIso?: string;
  department?: string;
  filingTypes: FilingType[];
  riskTolerance: RiskTolerance;
  approvalLevels: ApprovalLevel[];
  escalationChain: EscalationStep[];
  maxAutoApproveINR: number;
  requiresSignature: boolean;
}

const POLICY_SEED: SeedPolicy[] = [
  {
    name: 'India GST Filing Approval',
    description: '2-level approval workflow for all GST returns in India. Auto-approves ₹0 liability returns.',
    policyType: 'filing_approval',
    countryIso: 'IN',
    filingTypes: ['gstr1', 'gstr3b', 'gstr9', 'gstr2b_reconcile'],
    riskTolerance: 'low',
    approvalLevels: [
      { level: 1, role: 'compliance_officer', autoApproveBelowINR: 0 },
      { level: 2, role: 'cfo', autoApproveBelowINR: 0 },
    ],
    escalationChain: [
      { hours: 24, notifyRole: 'cfo' },
      { hours: 48, notifyRole: 'ceo' },
      { hours: 72, notifyRole: 'compliance_admin' },
    ],
    maxAutoApproveINR: 0,
    requiresSignature: true,
  },
  {
    name: 'Global Corporate Filing',
    description: '3-level approval for MCA, ROC, RBI and corporate filings across all jurisdictions.',
    policyType: 'multi_level_auth',
    filingTypes: ['mca_aoc4', 'mca_mgt7', 'mca_dir3', 'rbi_furnish', 'corp_filing', 'audit_report'],
    riskTolerance: 'low',
    approvalLevels: [
      { level: 1, role: 'compliance_officer', autoApproveBelowINR: 0 },
      { level: 2, role: 'legal_counsel', autoApproveBelowINR: 0 },
      { level: 3, role: 'ceo', autoApproveBelowINR: 0 },
    ],
    escalationChain: [
      { hours: 48, notifyRole: 'ceo' },
      { hours: 96, notifyRole: 'compliance_admin' },
    ],
    maxAutoApproveINR: 0,
    requiresSignature: true,
  },
  {
    name: 'Payroll Compliance',
    description: '1-level approval for payroll-related filings (EPF, ESI, PT). Auto-approves if liability < ₹50,000.',
    policyType: 'filing_approval',
    filingTypes: ['epf_ecn', 'esi_return', 'pt_return', 'payroll_return'],
    riskTolerance: 'medium',
    approvalLevels: [
      { level: 1, role: 'compliance_officer', autoApproveBelowINR: 50000 },
    ],
    escalationChain: [
      { hours: 24, notifyRole: 'cfo' },
    ],
    maxAutoApproveINR: 50000,
    requiresSignature: false,
  },
];

// ─── Mapper ──────────────────────────────────────────────────────────────────

function mapRow(r: {
  id: string;
  name: string;
  description: string | null;
  policyType: string;
  countryIso: string | null;
  department: string | null;
  filingTypes: string;
  riskTolerance: string;
  approvalLevels: string;
  escalationChain: string;
  maxAutoApproveINR: number;
  requiresSignature: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CompliancePolicy {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    policyType: r.policyType as PolicyType,
    countryIso: r.countryIso ?? undefined,
    department: r.department ?? undefined,
    filingTypes: safeParse<FilingType[]>(r.filingTypes, []),
    riskTolerance: r.riskTolerance as RiskTolerance,
    approvalLevels: safeParse<ApprovalLevel[]>(r.approvalLevels, []),
    escalationChain: safeParse<EscalationStep[]>(r.escalationChain, []),
    maxAutoApproveINR: r.maxAutoApproveINR,
    requiresSignature: r.requiresSignature,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ─── Seed (only if DB has zero rows) ─────────────────────────────────────────

let seedPromise: Promise<void> | null = null;

async function seedIfEmpty(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const count = await db.compliancePolicy.count();
      if (count > 0) return;
      for (const p of POLICY_SEED) {
        await db.compliancePolicy.create({
          data: {
            name: p.name,
            description: p.description,
            policyType: p.policyType,
            countryIso: p.countryIso ?? null,
            department: p.department ?? null,
            filingTypes: JSON.stringify(p.filingTypes),
            riskTolerance: p.riskTolerance,
            approvalLevels: JSON.stringify(p.approvalLevels),
            escalationChain: JSON.stringify(p.escalationChain),
            maxAutoApproveINR: p.maxAutoApproveINR,
            requiresSignature: p.requiresSignature,
            isActive: true,
          },
        });
      }
    } catch {
      // non-fatal
    }
  })();
  return seedPromise;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface PolicyFilters {
  countryIso?: string;
  policyType?: PolicyType | string;
  department?: string;
  filingType?: FilingType | string;
}

export async function getPolicies(filters?: PolicyFilters): Promise<CompliancePolicy[]> {
  await seedIfEmpty();
  try {
    const rows = await db.compliancePolicy.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    let policies = rows.map(mapRow);
    if (filters?.countryIso) {
      const iso = filters.countryIso.toUpperCase();
      policies = policies.filter(
        (p) => p.countryIso === undefined || p.countryIso === null || p.countryIso === iso,
      );
    }
    if (filters?.policyType) {
      policies = policies.filter((p) => p.policyType === filters.policyType);
    }
    if (filters?.department) {
      policies = policies.filter((p) => p.department === filters.department);
    }
    if (filters?.filingType) {
      policies = policies.filter((p) => p.filingTypes.includes(filters.filingType as FilingType));
    }
    if (policies.length === 0) {
      // Fallback to in-memory seed
      return POLICY_SEED.map(seedToRecord).filter((p) => {
        if (filters?.countryIso && p.countryIso && p.countryIso !== filters.countryIso.toUpperCase()) return false;
        if (filters?.filingType && !p.filingTypes.includes(filters.filingType as FilingType)) return false;
        return true;
      });
    }
    return policies;
  } catch {
    return POLICY_SEED.map(seedToRecord);
  }
}

function seedToRecord(s: SeedPolicy, idx: number): CompliancePolicy {
  const now = new Date().toISOString();
  return {
    id: `seed-policy-${idx}`,
    name: s.name,
    description: s.description,
    policyType: s.policyType,
    countryIso: s.countryIso,
    department: s.department,
    filingTypes: s.filingTypes,
    riskTolerance: s.riskTolerance,
    approvalLevels: s.approvalLevels,
    escalationChain: s.escalationChain,
    maxAutoApproveINR: s.maxAutoApproveINR,
    requiresSignature: s.requiresSignature,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getPolicyForFiling(
  filingType: FilingType,
  countryIso?: string,
): Promise<CompliancePolicy | null> {
  const policies = await getPolicies({ filingType, countryIso });
  // Prefer country-specific, then global.
  if (countryIso) {
    const iso = countryIso.toUpperCase();
    const countryMatch = policies.find((p) => p.countryIso === iso);
    if (countryMatch) return countryMatch;
  }
  const globalMatch = policies.find((p) => !p.countryIso);
  if (globalMatch) return globalMatch;
  return policies[0] ?? null;
}

export interface ApprovalEvaluation {
  canApprove: boolean;
  requiresNextLevel: boolean;
  reason: string;
}

export function evaluateApproval(
  filing: Pick<ComplianceFiling, 'summary' | 'countryIso' | 'filingType' | 'status'>,
  policy: CompliancePolicy | null,
  approverRole: string,
): ApprovalEvaluation {
  if (!policy) {
    return {
      canApprove: false,
      requiresNextLevel: true,
      reason: 'No active policy for this filing type — manual executive approval required.',
    };
  }
  const totalLiability = typeof filing.summary.totalLiability === 'number'
    ? filing.summary.totalLiability
    : 0;

  // Auto-approve below threshold (but never for filed/submitted status).
  if (totalLiability <= policy.maxAutoApproveINR && policy.maxAutoApproveINR > 0) {
    return {
      canApprove: true,
      requiresNextLevel: false,
      reason: `Auto-approved — liability ₹${totalLiability} below policy threshold ₹${policy.maxAutoApproveINR}.`,
    };
  }

  // Walk approval levels — approverRole must match one of the levels.
  const matchedLevel = policy.approvalLevels.find((l) => l.role === approverRole);
  if (!matchedLevel) {
    return {
      canApprove: false,
      requiresNextLevel: true,
      reason: `Role '${approverRole}' not in approval chain for policy '${policy.name}'. Required: ${policy.approvalLevels.map((l) => `${l.level}:${l.role}`).join(' → ')}.`,
    };
  }

  // Determine whether higher levels remain.
  const higherLevels = policy.approvalLevels.filter((l) => l.level > matchedLevel.level);
  if (higherLevels.length > 0) {
    return {
      canApprove: true,
      requiresNextLevel: true,
      reason: `Level ${matchedLevel.level} approved by ${approverRole}. Escalating to ${higherLevels[0].role} (level ${higherLevels[0].level}).`,
    };
  }

  return {
    canApprove: true,
    requiresNextLevel: false,
    reason: `Final approval granted by ${approverRole} at level ${matchedLevel.level} under policy '${policy.name}'.`,
  };
}

export async function getEscalationChain(policyId: string): Promise<EscalationStep[]> {
  try {
    const row = await db.compliancePolicy.findUnique({ where: { id: policyId } });
    if (!row) return [];
    return safeParse<EscalationStep[]>(row.escalationChain, []);
  } catch {
    return [];
  }
}
