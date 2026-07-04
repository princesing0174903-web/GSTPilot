// GET /api/global/countries — Multi-Country Support™
// Returns all 30+ countries with tax system, currency, language, timezone, fiscal
// year, gov IDs, banking standards, payroll rules, accounting standards, compliance rules.

import { NextRequest } from 'next/server';
import { withGlobalApi } from '@/lib/global-enterprise/api-helpers';
import { listCountries, getCountry, getTaxRulesForCountry, getComplianceDeadlinesForCountry, getPayrollStructure } from '@/lib/global-enterprise/registry';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  return withGlobalApi({
    endpoint: '/api/global/countries',
    method: 'GET',
    req,
    handler: async () => {
      const url = new URL(req.url);
      const iso = url.searchParams.get('iso');
      const includeRules = url.searchParams.get('includeRules') === 'true';

      // Single-country detail
      if (iso) {
        const country = getCountry(iso.toUpperCase());
        if (!country) {
          throw new Error(`Unknown country code: ${iso}`);
        }
        const taxRules = getTaxRulesForCountry(country.isoCode);
        const complianceDeadlines = getComplianceDeadlinesForCountry(country.isoCode);
        const payrollStructure = getPayrollStructure(country.isoCode);
        // Active entities in this country (real DB count)
        let entityCount = 0;
        let bankAccountCount = 0;
        try {
          entityCount = await db.globalEntity.count({ where: { countryIso: country.isoCode, status: { not: 'divested' } } });
          bankAccountCount = await db.bankAccount.count({ where: { countryIso: country.isoCode, isActive: true } });
        } catch { /* DB optional */ }
        return {
          country,
          entityCount,
          bankAccountCount,
          ...(includeRules ? { taxRules, complianceDeadlines, payrollStructure } : {}),
        };
      }

      // List all
      const countries = listCountries();
      const enriched = await Promise.all(
        countries.map(async (c) => {
          let entityCount = 0;
          try {
            entityCount = await db.globalEntity.count({ where: { countryIso: c.isoCode, status: { not: 'divested' } } });
          } catch { /* ignore */ }
          return { ...c, entityCount };
        })
      );
      return {
        totalCountries: enriched.length,
        countries: enriched,
      };
    },
  });
}
