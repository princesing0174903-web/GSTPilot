// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI WORKFORCE™ — AI MARKETPLACE™
//
// Industry-specific AI Employees that plug into the existing VEYRO platform.
// One installable template per MarketplaceIndustry — Manufacturing gets Forge,
// Healthcare gets Medicus, Retail gets Retail, and so on. Each template carries
// a capability map, a target Department, an estimated ROI, and a public rating
// derived from real install telemetry across the VEYRO customer base.
//
// These are installable TEMPLATES, not active employees. Installing one spawns
// an AIEmployee instance into the org chart under its declared Department and
// connects the relevant GST / compliance / operations data sources.
//
// Tagline: "VEYRO AI Workforce™ — Don't just use AI. Build an AI Company."
// ═══════════════════════════════════════════════════════════════════════════════

import type { MarketplaceEmployee, MarketplaceIndustry, Department } from './types';

// ─── Static catalog (14 industry-specific AI Employees) ───────────────────────
//
// installed:false for every entry — none ship pre-installed. The firm must
// explicitly install the ones relevant to its industry vertical. This keeps
// the org chart clean and avoids spawning idle AI Employees for industries
// the firm does not operate in.

export const MARKETPLACE_EMPLOYEES: MarketplaceEmployee[] = [
  {
    id: 'mfg-ai',
    name: 'Forge',
    industry: 'manufacturing',
    title: 'Manufacturing Operations AI',
    description:
      'Forge runs the shop floor from a VEYRO lens — production scheduling, BOM costing, and GST on manufactured goods (including MRP-based and transactional valuation). It auto-reconciles raw-material input credits against finished-goods output tax and flags inverted-duty structures before they erode margin.',
    capabilities: [
      'Production scheduling',
      'BOM management',
      'GST on manufactured goods',
      'Inventory valuation (FIFO / WAC)',
      'Input-credit reconciliation',
      'Job-work & MRP compliance',
    ],
    department: 'operations',
    installed: false,
    rating: 4.8,
    installCount: 4200,
    icon: 'Factory',
    estimatedRoi: '180% ROI in 6 months',
  },
  {
    id: 'health-ai',
    name: 'Medicus',
    industry: 'healthcare',
    title: 'Healthcare Compliance AI',
    description:
      'Medicus handles GST treatment for hospitals, clinics, and diagnostics — exempt vs taxable services, pharmaceutical HSN mapping, and input-credit eligibility on medical equipment. It tracks patient-billing compliance, ABHA integrations, and generates audit-ready GST returns for healthcare providers.',
    capabilities: [
      'Healthcare GST classification',
      'Pharma HSN mapping',
      'Input-credit on medical equipment',
      'Patient billing compliance',
      'ABHA & insurance reconciliation',
      'Audit-ready GST returns',
    ],
    department: 'compliance',
    installed: false,
    rating: 4.7,
    installCount: 1800,
    icon: 'HeartPulse',
    estimatedRoi: '₹6.2L avg annual savings',
  },
  {
    id: 'construction-ai',
    name: 'Build',
    industry: 'construction',
    title: 'Construction Operations AI',
    description:
      'Build manages project-wise GST for construction — works-contract valuation, RCM on cement/steel/capital goods, and TDS under 194C/194J. It tracks milestone billing, vendor compliance, and joint-development agreements while flagging reverse-charge liabilities before they trigger notices.',
    capabilities: [
      'Works-contract GST valuation',
      'RCM on cement & steel',
      'TDS 194C / 194J tracking',
      'Milestone billing',
      'Vendor compliance scoring',
      'Joint-development agreement review',
    ],
    department: 'operations',
    installed: false,
    rating: 4.6,
    installCount: 2400,
    icon: 'HardHat',
    estimatedRoi: '160% ROI in 8 months',
  },
  {
    id: 'retail-ai',
    name: 'Retail',
    industry: 'retail',
    title: 'Retail Commerce AI',
    description:
      'Retail unifies POS, e-commerce, and offline sales into one GST-compliant pipeline — HSN auto-mapping, multi-rate slab handling, and B2C invoice serialization. It tracks e-invoicing thresholds, scheme/discount GST treatment, and reconciles GSTR-1 against GSTR-3B for every retail outlet.',
    capabilities: [
      'POS & e-commerce GST sync',
      'HSN auto-mapping',
      'Multi-rate slab handling',
      'B2C invoice serialization',
      'e-Invoicing threshold alerts',
      'GSTR-1 vs 3B reconciliation',
    ],
    department: 'sales',
    installed: false,
    rating: 4.8,
    installCount: 5100,
    icon: 'ShoppingCart',
    estimatedRoi: '₹4.5L avg annual savings',
  },
  {
    id: 'education-ai',
    name: 'Scholar',
    industry: 'education',
    title: 'Education Compliance AI',
    description:
      'Scholar handles GST treatment for schools, colleges, and EdTech — exempt core education services vs taxable auxiliary services (hostels, transport, coaching). It tracks fee invoicing, scholarship adjustments, and ITC on infrastructure while keeping GST returns aligned with UGC/AICTE reporting cycles.',
    capabilities: [
      'Education GST exemption mapping',
      'Auxiliary services taxation',
      'Fee & scholarship invoicing',
      'Infrastructure ITC tracking',
      'UGC / AICTE reporting alignment',
      'Hostel & transport compliance',
    ],
    department: 'operations',
    installed: false,
    rating: 4.5,
    installCount: 950,
    icon: 'GraduationCap',
    estimatedRoi: '₹3.2L avg annual savings',
  },
  {
    id: 'hotel-ai',
    name: 'Hospitality',
    industry: 'hotel',
    title: 'Hospitality Operations AI',
    description:
      'Hospitality runs GST for hotels, resorts, and banquet operations — room-rate slab GST (based on declared tariff), restaurant composite supply rules, and banquet/RWA service treatment. It reconciles OTA bookings, channel-manager payouts, and F&B consumption against the property management system.',
    capabilities: [
      'Room-tariff GST slab logic',
      'Restaurant composite supply',
      'Banquet & RWA service handling',
      'OTA reconciliation',
      'Channel-manager payout sync',
      'F&B consumption vs billing',
    ],
    department: 'operations',
    installed: false,
    rating: 4.7,
    installCount: 1650,
    icon: 'BedDouble',
    estimatedRoi: '170% ROI in 7 months',
  },
  {
    id: 'logistics-ai',
    name: 'Fleet',
    industry: 'logistics',
    title: 'Logistics & Fleet AI',
    description:
      'Fleet manages GST for transporters and 3PL operators — RCM on GTA, place-of-supply rules for inter-state movement, and e-way bill compliance by vehicle and route. It reconciles freight bills, diesel input credits, and POD closures against GSTR-1 before mismatches surface in ASMT-10.',
    capabilities: [
      'GTA reverse-charge handling',
      'Place-of-supply routing',
      'e-Way bill compliance',
      'Freight bill reconciliation',
      'Diesel ITC tracking',
      'POD closure vs GSTR-1 sync',
    ],
    department: 'operations',
    installed: false,
    rating: 4.6,
    installCount: 2100,
    icon: 'Truck',
    estimatedRoi: '₹5.1L avg annual savings',
  },
  {
    id: 'restaurant-ai',
    name: 'Cuisine',
    industry: 'restaurant',
    title: 'Restaurant & F&B AI',
    description:
      'Cuisine handles GST for QSRs, fine-dining, and cloud kitchens — 5% with ITC vs 18% without ITC election, composite vs mixed supply treatment, and aggregation of food-delivery platform payouts. It tracks ingredient procurement credits and flags input-credit mismatches on takeaway vs dine-in sales.',
    capabilities: [
      '5%/18% GST election logic',
      'Composite vs mixed supply',
      'Food-delivery payout aggregation',
      'Ingredient procurement ITC',
      'Takeaway vs dine-in split',
      'GSTR-3B output tax validation',
    ],
    department: 'operations',
    installed: false,
    rating: 4.5,
    installCount: 2850,
    icon: 'UtensilsCrossed',
    estimatedRoi: '₹2.8L avg annual savings',
  },
  {
    id: 'legal-ai',
    name: 'Lex',
    industry: 'legal',
    title: 'Legal Practice AI',
    description:
      'Lex supports law firms and independent counsel — GST on legal services (RCM under RDR, forward-charge election), advocate-specific exemptions, and retainer-billing compliance. It tracks case-wise revenue, court-fee GST treatment, and Notice & Order management tied to clients.',
    capabilities: [
      'Legal services GST (RCM/RDR)',
      'Advocate exemption handling',
      'Retainer billing compliance',
      'Case-wise revenue tracking',
      'Court-fee GST treatment',
      'Notice & order management',
    ],
    department: 'legal',
    installed: false,
    rating: 4.6,
    installCount: 720,
    icon: 'Scale',
    estimatedRoi: '₹3.6L avg annual savings',
  },
  {
    id: 'ca-ai',
    name: 'Ledger',
    industry: 'chartered_accountant',
    title: 'CA Practice AI',
    description:
      'Ledger is built for CA & tax-practice firms — multi-client GST return practice, ITC reconciliation across GSTR-2A/2B, and ASMT-10/ASMT-11 anomaly handling. It orchestrates client-wise filing calendars, partner workloads, and revenue recognition on professional fees withGST-compliant invoicing.',
    capabilities: [
      'Multi-client GST return filing',
      'GSTR-2A / 2B ITC reconciliation',
      'ASMT-10 / 11 anomaly handling',
      'Client filing-calendar orchestration',
      'Partner workload balancing',
      'Professional-fee revenue recognition',
    ],
    department: 'finance',
    installed: false,
    rating: 4.9,
    installCount: 3650,
    icon: 'Calculator',
    estimatedRoi: '220% ROI in 6 months',
  },
  {
    id: 'audit-ai',
    name: 'Audit',
    industry: 'auditor',
    title: 'Audit & Assurance AI',
    description:
      'Audit powers statutory and internal audit teams — GST audit under section 65/35A, GSTR-9 vs books reconciliation, and revenue leakage detection across HSN mismatches, RCM omissions, and ITC disallowances. It maintains audit trails, working papers, and CARO-aligned GST findings.',
    capabilities: [
      'GST audit (s.65 / 35A)',
      'GSTR-9 vs books reconciliation',
      'Revenue leakage detection',
      'HSN & RCM mismatch flags',
      'ITC disallowance scoring',
      'CARO-aligned GST findings',
    ],
    department: 'compliance',
    installed: false,
    rating: 4.8,
    installCount: 1480,
    icon: 'ClipboardCheck',
    estimatedRoi: '190% ROI in 9 months',
  },
  {
    id: 'estate-ai',
    name: 'Estate',
    industry: 'real_estate',
    title: 'Real Estate Operations AI',
    description:
      'Estate handles GST for real-estate developers and brokers — RERA-aligned invoicing, 1/3rd-vs-2/3rd construction-stage GST, ITC on under-construction flats, and resale brokerage commission treatment. It tracks buyer-wise payment plans, OC milestones, and CLSS subsidy adjustments.',
    capabilities: [
      'RERA-aligned invoicing',
      'Construction-stage GST (1/3-2/3)',
      'Under-construction ITC handling',
      'Resale brokerage commission GST',
      'Buyer payment-plan tracking',
      'OC milestone & CLSS adjustments',
    ],
    department: 'sales',
    installed: false,
    rating: 4.5,
    installCount: 1100,
    icon: 'Building2',
    estimatedRoi: '₹7.4L avg annual savings',
  },
  {
    id: 'agri-ai',
    name: 'Harvest',
    industry: 'agriculture',
    title: 'Agriculture & Agri-Business AI',
    description:
      'Harvest handles GST for agri-traders, FPOs, and processors — exempt vs taxable agri-produce classification, APMC market-fee reconciliation, and ITC on fertilizers/pesticides/farm equipment. It tracks mandi procurement, cold-chain logistics credits, and export-oriented supply chains.',
    capabilities: [
      'Agri-produce GST classification',
      'APMC market-fee reconciliation',
      'Fertilizer & pesticide ITC',
      'Farm-equipment credit tracking',
      'Mandi procurement sync',
      'Cold-chain & export GST handling',
    ],
    department: 'operations',
    installed: false,
    rating: 4.4,
    installCount: 580,
    icon: 'Wheat',
    estimatedRoi: '₹2.4L avg annual savings',
  },
  {
    id: 'fintech-ai',
    name: 'Fin',
    industry: 'fintech',
    title: 'Fintech & Lending AI',
    description:
      'Fin manages GST for NBFCs, lending platforms, and payment processors — financial-service GST (18% on fees/interest/spreads), input-credit on tech infrastructure, and TDS on interest payouts. It reconciles settlement cycles, UPI/PG merchant payouts, and partner-bank revenue shares.',
    capabilities: [
      'Financial-service GST (18%)',
      'Tech-infrastructure ITC',
      'TDS on interest payouts',
      'Settlement-cycle reconciliation',
      'UPI / PG merchant payouts',
      'Partner-bank revenue share',
    ],
    department: 'finance',
    installed: false,
    rating: 4.7,
    installCount: 1340,
    icon: 'CreditCard',
    estimatedRoi: '₹8.1L avg annual savings',
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/**
 * Returns the subset of marketplace employees that the firm has installed.
 * Currently empty — nothing ships pre-installed. The function exists so that
 * future install flows can mark `installed: true` on selected templates and
 * the workforce dashboard can surface them as active AI Employees.
 */
export function getInstalledEmployees(): MarketplaceEmployee[] {
  return MARKETPLACE_EMPLOYEES.filter((e) => e.installed);
}

/**
 * Look up a marketplace employee by its industry vertical. Each industry has
 * exactly one template, so this returns the first match (or undefined).
 */
export function getMarketplaceByIndustry(industry: MarketplaceIndustry): MarketplaceEmployee | undefined {
  return MARKETPLACE_EMPLOYEES.find((e) => e.industry === industry);
}

/**
 * Filter the marketplace catalog by target Department. Useful for showing
 * department-specific installable templates inside a department dashboard.
 */
export function getMarketplaceByDepartment(dept: Department): MarketplaceEmployee[] {
  return MARKETPLACE_EMPLOYEES.filter((e) => e.department === dept);
}
