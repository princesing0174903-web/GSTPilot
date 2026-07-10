// POST /api/global/entity — Create new legal entity (Global Organization Engine™)
// Supports unlimited organizations × countries × legal entities × branches × offices.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { createEntity } from '@/lib/global-enterprise/entities';
import type { EntityRecord } from '@/lib/global-enterprise/types';

interface CreateEntityBody {
  legalName: string;
  tradeName?: string;
  entityKind?: 'operating' | 'holding' | 'branch' | 'subsidiary' | 'jv' | 'rep_office';
  countryIso: string;
  registrationNo?: string;
  taxId?: string;
  address?: string;
  baseCurrency?: string;
  consolidated?: boolean;
  ownershipPct?: number;
  status?: 'active' | 'dormant' | 'divested';
  parentEntityId?: string;
  firmId?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/entity',
    method: 'POST',
    req,
    handler: async ({ auth, body }) => {
      const b = (body ?? {}) as CreateEntityBody;
      if (!b.legalName) throw new Error('legalName is required');
      if (!b.countryIso) throw new Error('countryIso is required');
      const record: EntityRecord = {
        legalName: b.legalName,
        tradeName: b.tradeName,
        entityKind: b.entityKind ?? 'operating',
        countryIso: b.countryIso.toUpperCase(),
        registrationNo: b.registrationNo,
        taxId: b.taxId,
        address: b.address,
        baseCurrency: (b.baseCurrency ?? 'INR').toUpperCase(),
        consolidated: b.consolidated ?? true,
        ownershipPct: b.ownershipPct ?? 100,
        status: b.status ?? 'active',
        parentEntityId: b.parentEntityId,
        firmId: b.firmId ?? auth.firmId,
        metadata: b.metadata,
      };
      const result = await createEntity(record);
      return result;
    },
  });
}
