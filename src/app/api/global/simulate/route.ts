// POST /api/global/simulate — Cross-Border Digital Twin™
// Simulates opening a new country, acquiring a company, hiring globally, currency
// fluctuations, tax changes, economic downturns, supply chain disruptions, expansion.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { simulateCrossBorder, SCENARIO_TYPES, SCENARIO_META } from '@/lib/global-enterprise/cross-border-twin';
import type { CrossBorderScenarioType, CrossBorderScenarioParameters } from '@/lib/global-enterprise/types';

interface SimulateBody {
  scenarioType: CrossBorderScenarioType;
  targetCountryIso?: string;
  monthsAhead?: number;
  magnitudePct?: number;
  investmentAmount?: number;
  hireCount?: number;
  hireCountryIso?: string;
  hireRoleBand?: 'junior' | 'mid' | 'senior' | 'executive';
  disruptionSeverity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
}

export async function POST(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/simulate',
    method: 'POST',
    req,
    handler: async ({ auth, body }) => {
      const b = (body ?? {}) as SimulateBody;
      if (!b.scenarioType || !SCENARIO_TYPES.includes(b.scenarioType)) {
        throw new Error(`scenarioType must be one of: ${SCENARIO_TYPES.join(', ')}`);
      }
      const meta = SCENARIO_META[b.scenarioType];
      const params: CrossBorderScenarioParameters = {
        scenarioType: b.scenarioType,
        targetCountryIso: b.targetCountryIso?.toUpperCase(),
        monthsAhead: b.monthsAhead ?? meta.defaultHorizon,
        magnitudePct: b.magnitudePct ?? meta.defaultMagnitude,
        investmentAmount: b.investmentAmount,
        hireCount: b.hireCount,
        hireCountryIso: b.hireCountryIso?.toUpperCase(),
        hireRoleBand: b.hireRoleBand,
        disruptionSeverity: b.disruptionSeverity,
        notes: b.notes,
      };
      const result = await simulateCrossBorder(params, auth.firmId);
      return result;
    },
  });
}

// Also support GET to list scenario types
export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/simulate',
    method: 'GET',
    req,
    handler: async () => ({
      scenarioTypes: SCENARIO_TYPES.map((t) => ({
        type: t,
        label: SCENARIO_META[t].label,
        description: SCENARIO_META[t].description,
        defaultMagnitude: SCENARIO_META[t].defaultMagnitude,
        defaultHorizon: SCENARIO_META[t].defaultHorizon,
      })),
    }),
  });
}
