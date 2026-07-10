// GET /api/global/payroll — Global Payroll Engine™
// Returns payroll across countries: country-specific salary structures, benefits,
// taxes, leave policies, social security, retirement contributions, labour laws.
//
// Query params:
//   ?action=summary                                  → global payroll summary (default)
//   ?action=structure&countryIso=US                  → country payroll structure
//   ?action=structures                               → list all payroll structures
//   ?action=calculate&countryIso=US&grossMonthlyLocal=5000  → calculate payroll

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { getGlobalPayrollSummary, calculatePayroll, getPayrollStructureForCountry, listAllPayrollStructures } from '@/lib/global-enterprise/payroll';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/payroll',
    method: 'GET',
    req,
    handler: async ({ query }) => {
      const action = query.get('action') ?? 'summary';

      // /api/global/payroll?action=calculate&countryIso=US&grossMonthlyLocal=5000
      if (action === 'calculate') {
        const countryIso = query.get('countryIso');
        const grossMonthlyLocal = Number(query.get('grossMonthlyLocal') ?? '0');
        const annualizeForTax = query.get('annualizeForTax') !== 'false';
        if (!countryIso || !grossMonthlyLocal) {
          throw new Error('`countryIso` and `grossMonthlyLocal` query parameters required');
        }
        const result = await calculatePayroll({
          countryIso: countryIso.toUpperCase(),
          grossMonthlyLocal,
          annualizeForTax,
        });
        return { calculation: result };
      }

      // /api/global/payroll?action=structure&countryIso=US
      if (action === 'structure') {
        const iso = query.get('countryIso');
        if (!iso) throw new Error('`countryIso` parameter required');
        const structure = await getPayrollStructureForCountry(iso.toUpperCase());
        return { structure };
      }

      // /api/global/payroll?action=structures (list all)
      if (action === 'structures') {
        const structures = await listAllPayrollStructures();
        return { total: structures.length, structures };
      }

      // Default: global payroll summary (from REAL employee records)
      const summary = await getGlobalPayrollSummary();
      return summary;
    },
  });
}
