// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Command Network Simulator Definitions (Prisma-free)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure static scenario definitions extracted from simulator.ts so client
// components can import them WITHOUT pulling @prisma/client into the bundle.
// The original simulator.ts re-exports these for backward compatibility.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Simulation scenario definitions ──────────────────────────────────────────
export const SIMULATION_SCENARIOS: {
  scenario: string;
  title: string;
  description: string;
  commandType: string;
  parameters: Record<string, unknown>;
}[] = [
  { scenario: 'hire_5_engineers', title: 'Hire 5 Engineers', description: 'Simulate hiring 5 additional engineers — payroll, capacity, compliance impact.', commandType: 'hire', parameters: { headcount: 5, role: 'engineer', avgCostINR: 85000 } },
  { scenario: 'increase_prices_10', title: 'Increase Prices 10%', description: 'Simulate a 10% price increase across all clients — revenue vs churn risk.', commandType: 'price_change', parameters: { priceIncreasePct: 10 } },
  { scenario: 'expand_to_uae', title: 'Expand to UAE', description: 'Simulate opening a UAE entity — setup cost, tax, compliance, revenue projection.', commandType: 'market_entry', parameters: { country: 'AE', setupCostINR: 5000000 } },
  { scenario: 'launch_product', title: 'Launch New Product', description: 'Simulate launching a new product line — dev cost, marketing, revenue projection.', commandType: 'launch', parameters: { devCostINR: 2000000, marketingINR: 500000 } },
  { scenario: 'acquire_competitor', title: 'Acquire Competitor', description: 'Simulate acquiring a competitor — valuation, synergy, integration cost.', commandType: 'acquire', parameters: { acquisitionCostINR: 50000000, synergyPct: 15 } },
  { scenario: 'cut_costs_15', title: 'Cut Costs 15%', description: 'Simulate a 15% cost reduction — savings vs operational impact.', commandType: 'cost_cut', parameters: { costCutPct: 15 } },
  { scenario: 'raise_funding', title: 'Raise Series A Funding', description: 'Simulate raising ₹10Cr Series A — dilution, runway, growth investment.', commandType: 'funding', parameters: { amountINR: 100000000, valuationINR: 500000000 } },
  { scenario: 'switch_vendor', title: 'Switch Vendor', description: 'Simulate switching a major vendor — cost savings vs transition risk.', commandType: 'vendor_switch', parameters: { savingsPct: 8, transitionWeeks: 4 } },
  { scenario: 'delay_payments_30', title: 'Delay Vendor Payments 30 Days', description: 'Simulate extending vendor payment terms by 30 days — cash benefit vs relationship risk.', commandType: 'payout', parameters: { extensionDays: 30 } },
  { scenario: 'gst_optimization', title: 'GST Optimization', description: 'Simulate GST optimization — ITC recovery, structure changes, compliance impact.', commandType: 'compliance', parameters: { itcRecoveryINR: 500000 } },
];
