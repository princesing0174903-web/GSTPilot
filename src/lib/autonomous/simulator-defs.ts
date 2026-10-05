// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — Simulator — Static scenario metadata
// (Prisma-free)
// ═══════════════════════════════════════════════════════════════════════════════
// Static scenario metadata extracted out of `./simulator` so client
// components can render the scenario picker without dragging Prisma into
// their bundle. The Prisma-backed simulator (`runSimulation`,
// `loadRecentSimulations`) lives in `./simulator` (server-only).
// ═══════════════════════════════════════════════════════════════════════════════

import type { SimulationParameters, SimulationScenario } from './types';

// ─── Scenario metadata ────────────────────────────────────────────────────────

export const SCENARIO_META: Record<
  SimulationScenario,
  { title: string; description: string; defaultParams: SimulationParameters }
> = {
  hire_employees: {
    title: 'Hire N Employees',
    description: 'Simulate the financial & operational impact of adding headcount.',
    defaultParams: { headcount: 5 },
  },
  increase_prices: {
    title: 'Increase Prices by X%',
    description: 'Simulate margin & demand impact of a price change.',
    defaultParams: { priceChangePct: 10 },
  },
  expand_city: {
    title: 'Expand into a New City',
    description: 'Simulate revenue, cost and compliance impact of geographic expansion.',
    defaultParams: { city: 'Bengaluru' },
  },
  launch_product: {
    title: 'Launch a New Product',
    description: 'Simulate incremental revenue, GST and ramp cost of a new product line.',
    defaultParams: { productName: 'New SaaS Module' },
  },
  acquire_company: {
    title: 'Acquire a Company',
    description: 'Simulate accretion/dilution, integration cost and synergy uplift.',
    defaultParams: { acquisitionTarget: 'Target Co.' },
  },
  open_office: {
    title: 'Open a New Office',
    description: 'Simulate capex, opex and revenue enablement of a new office.',
    defaultParams: { officeLocation: 'Mumbai' },
  },
  raise_funding: {
    title: 'Raise Funding',
    description: 'Simulate dilution, runway extension and growth-enablement of a raise.',
    defaultParams: { fundingAmount: 5000000 },
  },
  cut_costs: {
    title: 'Cut Operating Costs by X%',
    description: 'Simulate margin uplift vs. execution risk of a cost-cutting programme.',
    defaultParams: { costCutPct: 15 },
  },
  delay_payment: {
    title: 'Delay Vendor Payments by N Days',
    description: 'Simulate cash-flow benefit vs. vendor-relationship & discount risk.',
    defaultParams: { delayDays: 15 },
  },
  switch_vendor: {
    title: 'Switch a Key Vendor',
    description: 'Simulate savings vs. switching cost & continuity risk.',
    defaultParams: { vendorName: 'Current Vendor' },
  },
};
