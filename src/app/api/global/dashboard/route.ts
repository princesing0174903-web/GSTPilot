// GET /api/global/dashboard — Global Executive Dashboard™
// Returns real-time enterprise view: revenue/profit/cash by country, compliance,
// currency exposure, payroll, executives, treasury, enterprise health.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getGlobalExecutiveDashboard } from '@/lib/global-enterprise/dashboard';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/dashboard',
    method: 'GET',
    req,
    handler: async ({ auth }) => getGlobalExecutiveDashboard(auth.firmId),
  });
}
