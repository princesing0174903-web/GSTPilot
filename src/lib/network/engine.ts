// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT NETWORK™ — Core Engine
// Deterministic, transparent network engine for the GSTPilot Network™ OS (Phase 6).
//
// Modules implemented here:
//   Module 1  Business Network Graph™        — buildNetworkGraph()
//   Module 2  CA Network™                    — buildCADirectory()
//   Module 3  Business Directory™            — buildBusinessDirectory()
//   Module 4  Vendor Network™                — buildVendorDirectory()
//   Module 5  Smart Matching Engine™         — computeMatches() / matchRequest()
//   Module 6  Collaboration Workspace™       — buildCollaborationRooms()
//   Module 7  Network Reputation Engine™     — computeReputation()
//   Module 8  Marketplace™                   — buildMarketplace()
//   Module 9  Oracle Network Intelligence™   — executeNetworkQuery()
//   Social    Business Feed                  — buildFeed()
//   Insights  Network Insights               — buildInsights()
//
// Orchestrator: getNetworkState() — fetches live data via Prisma + CFO engine,
// then composes the full Network state.
//
// Module 10 (Network API) lives in /api/network/*.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { generateCFOInsights } from '@/lib/cfo/engine';
import type { CFOResponse } from '@/lib/cfo/types';
import type {
  BusinessDirectoryEntry,
  BusinessNetworkDetail,
  BusinessNetworkGraph,
  CAProfile,
  CAReview,
  CASpecialization,
  CATeamMember,
  CANetworkDetail,
  CollaborationApproval,
  CollaborationComment,
  CollaborationMessage,
  CollaborationParticipant,
  CollaborationRoom,
  CollaborationRoomType,
  CollaborationTask,
  FeedItem,
  MatchIntent,
  MatchResult,
  MatchScore,
  MarketplaceCategory,
  MarketplaceListing,
  MarketplaceQuoteRequest,
  NetworkEdge,
  NetworkEntityType,
  NetworkInsight,
  NetworkNode,
  NetworkQueryIntent,
  NetworkQueryResult,
  NetworkRelationshipType,
  NetworkState,
  NetworkTier,
  ReputationEntry,
  ReputationScores,
  SmartMatchResponse,
  VendorCategory,
  VendorProfile,
  BusinessSize,
} from '@/lib/network/types';
import {
  NETWORK_NODE_LABELS, TIER_COLOR, TIER_GLYPH,
} from '@/lib/network/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowISO = () => new Date().toISOString();
const daysAgo = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};
const inrShort = (n: number) => {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
};
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length];

function scoreToTier(score: number): NetworkTier {
  if (score >= 90) return 'platinum';
  if (score >= 75) return 'gold';
  if (score >= 60) return 'silver';
  return 'bronze';
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// ─── Deterministic synthetic seed data ────────────────────────────────────────
// These populate the Network directory with realistic Indian businesses, CAs,
// and vendors so the directory/marketplace/matching feels alive even before
// the user has added many clients. All derived deterministically from arrays.

const INDIAN_CITIES: { city: string; state: string }[] = [
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Gurugram', state: 'Haryana' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Indore', state: 'Madhya Pradesh' },
  { city: 'Surat', state: 'Gujarat' },
  { city: 'Lucknow', state: 'Uttar Pradesh' },
  { city: 'Chandigarh', state: 'Chandigarh' },
];

const INDUSTRIES = [
  'Manufacturing', 'Retail', 'IT Services', 'Textiles', 'Pharmaceuticals',
  'Construction', 'Food & Beverages', 'Automotive', 'Electronics', 'Chemicals',
  'Logistics', 'Healthcare', 'Education', 'Real Estate', 'Agriculture',
  'E-commerce', 'Financial Services', 'Hospitality', 'Media', 'Steel',
];

const SUB_INDUSTRIES: Record<string, string[]> = {
  Manufacturing: ['Heavy Machinery', 'Consumer Goods', 'Industrial Parts', 'Auto Components'],
  Retail: ['Apparel', 'FMCG', 'Electronics', 'Grocery'],
  'IT Services': ['SaaS', 'Outsourcing', 'Consulting', 'Cloud Infra'],
  Textiles: ['Cotton', 'Synthetic', 'Garments', 'Home Textiles'],
  Pharmaceuticals: ['Formulations', 'APIs', 'Biotech', 'Surgical'],
  Construction: ['Residential', 'Commercial', 'Infrastructure', 'Materials'],
  'Food & Beverages': ['Processing', 'Packaging', 'Beverages', 'Dairy'],
  Automotive: ['2-Wheelers', '4-Wheelers', 'EV', 'Components'],
  Electronics: ['Consumer', 'Industrial', 'Semiconductors', 'Mobile'],
  Chemicals: ['Specialty', 'Bulk', 'Agrochemicals', 'Petrochemicals'],
};

const SIZES: BusinessSize[] = ['micro', 'small', 'medium', 'large', 'enterprise'];

const CA_NAMES = [
  'Rajesh Sharma', 'Priya Mehta', 'Amit Singh', 'Sunita Patel', 'Vikram Desai',
  'Anita Rao', 'Sanjay Gupta', 'Meera Joshi', 'Ramesh Thakur', 'Kavita Nair',
  'Deepak Verma', 'Sarla Bhat', 'Nikhil Chopra', 'Usha Lakshmi', 'Arjun Wardekar',
  'Pooja Fernandes', 'Kiran Oak', 'Ritu Agarwal', 'Mahesh Eshwar', 'Nandini Iyer',
];
const CA_FIRM_NAMES = [
  'Sharma & Associates', 'Mehta Tax Solutions', 'Singh Consulting', 'Patel Financial Services',
  'Desai & Co.', 'Rao Advisory', 'Gupta Associates', 'Joshi Tax Firm',
  'Thakur Consulting', 'Nair Financial Group', 'Verma & Partners', 'Bhat Accounting',
  'Chopra Services', 'Lakshmi Tax Pro', 'Wardekar Corp', 'Fernandes Advisory',
  'Oak Associates', 'Agarwal Consulting', 'Eshwar Tax', 'Iyer Financial',
];

const VENDOR_NAMES: { name: string; category: VendorCategory }[] = [
  { name: 'Tata Consultancy Services', category: 'it_services' },
  { name: 'Infosys BPM', category: 'it_services' },
  { name: 'Reliance Logistics', category: 'logistics' },
  { name: 'Blue Dart Supply Chain', category: 'logistics' },
  { name: 'HDFC Bank', category: 'bank' },
  { name: 'ICICI Bank', category: 'bank' },
  { name: 'State Bank of India', category: 'bank' },
  { name: 'Axis Bank', category: 'bank' },
  { name: 'Tally Solutions', category: 'software' },
  { name: 'Zoho Corporation', category: 'software' },
  { name: 'ClearTax', category: 'software' },
  { name: 'Cyrus Mistry Legal', category: 'legal' },
  { name: 'Khaitan & Co.', category: 'legal' },
  { name: 'AZB & Partners', category: 'legal' },
  { name: 'Aditya Birla Payroll', category: 'payroll' },
  { name: 'TeamLease Services', category: 'payroll' },
  { name: 'Deloitte Audit', category: 'auditor' },
  { name: 'KPMG India', category: 'auditor' },
  { name: 'EY India', category: 'auditor' },
  { name: 'PWC India', category: 'auditor' },
  { name: 'Reliance Raw Materials', category: 'supplier' },
  { name: 'JSW Steel Supply', category: 'supplier' },
  { name: 'Adani Logistics', category: 'logistics' },
  { name: 'Bajaj Allianz', category: 'insurance' },
  { name: 'LIC of India', category: 'insurance' },
  { name: 'Wipro Marketing', category: 'marketing' },
  { name: 'Dentsu India', category: 'marketing' },
  { name: 'L&T Manufacturing', category: 'manufacturing' },
  { name: 'Maruti Consulting', category: 'consultant' },
  { name: 'McKinsey India', category: 'consultant' },
];

const BUSINESS_NAMES = [
  'Apex Industries Pvt Ltd', 'Vertex Manufacturing Co', 'Sri Balaji Trading',
  'Ganesh Enterprises', 'Lakshmi Textiles Ltd', 'Sai Pharma Pvt Ltd',
  'Bharat Construction Ltd', 'Annapurna Foods Pvt Ltd', 'Royal Auto Parts',
  'Quantum Electronics', 'Pioneer Chemicals', 'Swift Logistics Pvt Ltd',
  'CureWell Healthcare', 'Bright Future Education', 'Skyline Real Estate',
  'GreenFields Agriculture', 'ShopMart E-Retail', 'FinEdge Services',
  'Heritage Hotels Pvt Ltd', 'MediaWorks Productions', 'SteelCorp India',
  'Sunrise Retail', 'TechNova Solutions', 'Classic Garments',
];

const SPECIALIZATIONS: CASpecialization[] = [
  'gst', 'income_tax', 'audit', 'advisory', 'roc', 'tds', 'notice',
  'international_tax', 'transfer_pricing', 'forensic',
];

const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Gujarati', 'Bengali', 'Punjabi', 'Kannada', 'Malayalam'];

// ─── Pseudo-random but deterministic hash for stable synthetic data ───────────

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function seeded(n: number, lo: number, hi: number): number {
  return lo + (n % 1000) / 1000 * (hi - lo);
}
function seededInt(n: number, lo: number, hi: number): number {
  return Math.floor(seeded(n, lo, hi + 1));
}

// ─── Module 7: Reputation Engine ──────────────────────────────────────────────

export function computeReputation(
  entityId: string,
  entityType: NetworkEntityType,
  base: {
    trust?: number;
    compliance?: number;
    payment?: number;
    growth?: number;
    network?: number;
    rating?: number;
    reviewCount?: number;
  } = {},
): ReputationScores {
  const h = hashStr(entityId + entityType);
  const trust = clamp(Math.round(base.trust ?? seededInt(h, 55, 95)));
  const compliance = clamp(Math.round(base.compliance ?? seededInt(h >> 3, 50, 98)));
  const payment = clamp(Math.round(base.payment ?? seededInt(h >> 5, 50, 95)));
  const growth = clamp(Math.round(base.growth ?? seededInt(h >> 7, 40, 92)));
  // Network score is a composite: 40% trust + 25% compliance + 20% payment + 15% growth
  const network = clamp(Math.round(trust * 0.4 + compliance * 0.25 + payment * 0.2 + growth * 0.15));
  const tier = scoreToTier(network);
  const rating = base.rating ?? Math.min(5, 3.5 + (network - 50) / 50 * 1.5);
  const reviewCount = base.reviewCount ?? seededInt(h >> 11, 8, 240);

  const trustFactors = ['Verified KYC', 'Active GST compliance', 'Long-term network member'];
  const complianceFactors = ['On-time GST filings', 'No active notices', 'ITC within norms'];
  const paymentFactors = ['Avg payment cycle 18 days', 'No overdue > 30 days', 'Strong collections ratio'];
  const growthFactors = ['Revenue growing YoY', 'Expanding client base', 'New market entry'];

  return {
    trustScore: trust,
    complianceScore: compliance,
    paymentScore: payment,
    growthScore: growth,
    networkScore: network,
    tier,
    breakdown: {
      trust: { score: trust, factors: trustFactors },
      compliance: { score: compliance, factors: complianceFactors },
      payment: { score: payment, factors: paymentFactors },
      growth: { score: growth, factors: growthFactors },
      network: { score: network, factors: [`Overall ${tier.toUpperCase()} tier`, `${rating.toFixed(1)}★ from ${reviewCount} reviews`] },
    },
    rating: Math.round(rating * 10) / 10,
    reviewCount,
  };
}

// ─── Module 2: CA Directory builder ───────────────────────────────────────────

function buildSyntheticCA(idx: number): CAProfile {
  const name = CA_NAMES[idx % CA_NAMES.length];
  const firmName = CA_FIRM_NAMES[idx % CA_FIRM_NAMES.length];
  const cityObj = INDIAN_CITIES[idx % INDIAN_CITIES.length];
  const h = hashStr(name + firmName);
  const years = seededInt(h, 6, 32);
  const trust = clamp(seededInt(h >> 2, 60, 96));
  const compliance = clamp(seededInt(h >> 4, 65, 98));
  const payment = clamp(seededInt(h >> 6, 60, 95));
  const growth = clamp(seededInt(h >> 8, 45, 92));
  const network = clamp(Math.round(trust * 0.4 + compliance * 0.25 + payment * 0.2 + growth * 0.15));
  const tier = scoreToTier(network);
  const verifiedBadge = tier === 'platinum' ? 'gold' : tier === 'gold' ? 'gold' : tier === 'silver' ? 'silver' : 'bronze';
  const specCount = 1 + (h % 4);
  const specs: CASpecialization[] = [];
  for (let i = 0; i < specCount; i++) specs.push(SPECIALIZATIONS[(h + i * 7) % SPECIALIZATIONS.length]);
  const uniqueSpecs = Array.from(new Set(specs));
  const teamSize = seededInt(h >> 10, 3, 28);
  const teamMembers: CATeamMember[] = Array.from({ length: Math.min(4, teamSize) }).map((_, i) => ({
    id: `ca_tm_${idx}_${i}`,
    name: CA_NAMES[(h + i * 13) % CA_NAMES.length],
    role: i === 0 ? 'Senior Manager' : i === 1 ? 'Manager' : 'Article Assistant',
    specialization: CA_SPEC_LABELS_SHORT[uniqueSpecs[i % uniqueSpecs.length]],
    experienceYears: seededInt(h >> (12 + i), 1, 14),
  }));
  const reviews: CAReview[] = Array.from({ length: 3 }).map((_, i) => ({
    id: `ca_rev_${idx}_${i}`,
    clientName: BUSINESS_NAMES[(h + i * 17) % BUSINESS_NAMES.length],
    rating: Math.min(5, Math.round(seeded(h >> (14 + i), 3.5, 5))),
    date: daysAgo(seededInt(h >> (16 + i), 5, 180)),
    text: pick([
      'Excellent GST advisory. Filed our returns on time and handled a tricky ITC reversal flawlessly.',
      'Very responsive. Helped us respond to a GST notice in 48 hours. Highly recommend.',
      'Professional team. They cleaned up our books and got us audit-ready in 2 weeks.',
      'Trustworthy CA. Has been with us for 5 years through every compliance season.',
      'Sharp on tax planning. Saved us almost ₹12L in legitimate optimizations this year.',
    ], h + i),
  }));
  return {
    id: `ca:ca_${idx}`,
    name,
    firmName,
    designation: years > 20 ? 'Senior Partner' : years > 12 ? 'Partner' : 'Practicing CA',
    membershipNo: `ICAI-${(100000 + h % 899999).toString()}`,
    gstin: `27ABCDE${(1000 + idx).toString().padStart(4, '0')}H1Z5`,
    location: `${cityObj.city}, ${cityObj.state}`,
    state: cityObj.state,
    city: cityObj.city,
    verified: true,
    verifiedBadge: verifiedBadge as 'gold' | 'silver' | 'bronze' | 'none',
    rating: Math.round(seeded(h, 3.8, 5) * 10) / 10,
    reviewCount: seededInt(h >> 1, 12, 280),
    yearsExperience: years,
    specializations: uniqueSpecs,
    industriesServed: Array.from(new Set([
      pick(INDUSTRIES, h), pick(INDUSTRIES, h >> 3), pick(INDUSTRIES, h >> 5),
    ])),
    gstExpertiseLevel: years > 20 ? 'master' : years > 12 ? 'expert' : years > 6 ? 'intermediate' : 'beginner',
    teamSize,
    teamMembers,
    clientsServed: seededInt(h >> 9, 35, 480),
    returnsFiled: seededInt(h >> 11, 120, 5200),
    noticesHandled: seededInt(h >> 13, 8, 320),
    responseTimeHours: seededInt(h >> 15, 1, 36),
    languages: Array.from(new Set([pick(LANGUAGES, h), pick(LANGUAGES, h >> 2), 'English'])),
    feeRange: { min: seededInt(h >> 16, 5000, 25000), max: seededInt(h >> 17, 30000, 150000) },
    networkTier: tier,
    trustScore: trust,
    complianceScore: compliance,
    paymentScore: payment,
    growthScore: growth,
    networkScore: network,
    bio: `${name} is a ${years}-year practicing CA specialising in ${uniqueSpecs.map((s) => CA_SPEC_LABELS_SHORT[s]).join(', ')}. Based in ${cityObj.city}, ${firmName} serves clients across ${pick(INDUSTRIES, h >> 4)}, ${pick(INDUSTRIES, h >> 6)}, and ${pick(INDUSTRIES, h >> 8)} sectors.`,
    topReviews: reviews,
    availableForNewClients: (h % 5) !== 0,
  };
}

const CA_SPEC_LABELS_SHORT: Record<CASpecialization, string> = {
  gst: 'GST',
  income_tax: 'Income Tax',
  audit: 'Audit',
  advisory: 'Advisory',
  roc: 'ROC',
  tds: 'TDS',
  notice: 'Notices',
  international_tax: 'Intl Tax',
  transfer_pricing: 'TP',
  forensic: 'Forensic',
};

export function buildCADirectory(teamMembers: { id: string; name: string; email: string; role: string; department?: string | null }[]): CAProfile[] {
  // Convert internal team members with CA-like roles into CA profiles (the user's firm's own CAs)
  const ownCas: CAProfile[] = teamMembers
    .filter((t) => /ca|partner|chartered|accountant/i.test(t.role) || /ca|partner|chartered|accountant/i.test(t.department ?? ''))
    .slice(0, 4)
    .map((t, i) => {
      const h = hashStr(t.id + t.name);
      const trust = clamp(seededInt(h, 70, 92));
      const compliance = clamp(seededInt(h >> 2, 75, 96));
      const payment = clamp(seededInt(h >> 4, 70, 92));
      const growth = clamp(seededInt(h >> 6, 55, 88));
      const network = clamp(Math.round(trust * 0.4 + compliance * 0.25 + payment * 0.2 + growth * 0.15));
      const tier = scoreToTier(network);
      return {
        id: `ca:own_${t.id}`,
        name: t.name,
        firmName: 'Your Firm',
        designation: /partner/i.test(t.role) ? 'Partner' : 'CA',
        membershipNo: `ICAI-${(200000 + h % 799999).toString()}`,
        location: 'Your HQ',
        state: 'Maharashtra',
        city: 'Mumbai',
        verified: true,
        verifiedBadge: 'gold',
        rating: 4.7,
        reviewCount: seededInt(h, 15, 90),
        yearsExperience: seededInt(h >> 8, 5, 20),
        specializations: (['gst', 'audit', 'tds', 'advisory'] as CASpecialization[]).slice(0, 2 + (h % 3)),
        industriesServed: ['Manufacturing', 'Retail', 'IT Services'],
        gstExpertiseLevel: 'expert' as const,
        teamSize: 6,
        teamMembers: [],
        clientsServed: seededInt(h >> 10, 12, 60),
        returnsFiled: seededInt(h >> 12, 50, 400),
        noticesHandled: seededInt(h >> 14, 5, 40),
        responseTimeHours: 2,
        languages: ['English', 'Hindi'],
        feeRange: { min: 10000, max: 75000 },
        networkTier: tier,
        trustScore: trust,
        complianceScore: compliance,
        paymentScore: payment,
        growthScore: growth,
        networkScore: network,
        bio: `${t.name} is part of your firm — a trusted CA handling GST, audit, and advisory for your clients.`,
        topReviews: [],
        availableForNewClients: true,
      };
    });

  // 18 synthetic CAs form the public directory
  const synthetic = Array.from({ length: 18 }).map((_, i) => buildSyntheticCA(i));
  return [...ownCas, ...synthetic];
}

// ─── Module 3: Business Directory builder ─────────────────────────────────────

function sizeFromRevenue(rev: number): BusinessSize {
  if (rev >= 500000000) return 'enterprise';
  if (rev >= 100000000) return 'large';
  if (rev >= 20000000) return 'medium';
  if (rev >= 5000000) return 'small';
  return 'micro';
}

function buildSyntheticBusiness(idx: number): BusinessDirectoryEntry {
  const name = BUSINESS_NAMES[idx % BUSINESS_NAMES.length];
  const industry = pick(INDUSTRIES, idx + 7);
  const subArr = SUB_INDUSTRIES[industry] ?? ['General'];
  const subIndustry = pick(subArr, idx);
  const cityObj = INDIAN_CITIES[(idx * 3 + 1) % INDIAN_CITIES.length];
  const h = hashStr(name + industry);
  const annualRevenue = seededInt(h, 500000, 250000000);
  const trust = clamp(seededInt(h >> 2, 50, 92));
  const compliance = clamp(seededInt(h >> 4, 55, 95));
  const payment = clamp(seededInt(h >> 6, 50, 90));
  const growth = clamp(seededInt(h >> 8, 40, 88));
  const network = clamp(Math.round(trust * 0.4 + compliance * 0.25 + payment * 0.2 + growth * 0.15));
  const tier = scoreToTier(network);
  return {
    id: `business:dir_${idx}`,
    companyName: name,
    legalName: name,
    gstin: `27${name.replace(/[^A-Z]/g, '').slice(0, 5).padEnd(5, 'X')}${(1000 + idx).toString().padStart(4, '0')}H1Z5`,
    industry,
    subIndustry,
    size: sizeFromRevenue(annualRevenue),
    employeeCount: seededInt(h >> 10, 5, 1200),
    location: `${cityObj.city}, ${cityObj.state}`,
    state: cityObj.state,
    city: cityObj.city,
    services: ['GST Filing', 'ITC Optimisation', 'Audit Support'].slice(0, 1 + (h % 3)),
    products: subArr,
    networkScore: network,
    networkTier: tier,
    trustScore: trust,
    complianceScore: compliance,
    growthScore: growth,
    paymentScore: payment,
    verified: (h % 4) !== 0,
    annualRevenue,
    yearsActive: seededInt(h >> 12, 2, 35),
    description: `${name} is a ${sizeFromRevenue(annualRevenue)} ${industry.toLowerCase()} business based in ${cityObj.city}. Specialises in ${subIndustry.toLowerCase()}.`,
    website: `https://${name.split(' ')[0].toLowerCase()}.in`,
    contactEmail: `info@${name.split(' ')[0].toLowerCase()}.in`,
    contactPhone: `+91 ${seededInt(h >> 14, 7000000000, 9999999999)}`,
    tags: [industry, subIndustry, cityObj.city, sizeFromRevenue(annualRevenue)],
    isMyBusiness: false,
    isMyClient: false,
  };
}

export function buildBusinessDirectory(
  myFirm: { id: string; name: string; gstin?: string | null; state?: string | null; address?: string | null } | null,
  clients: { id: string; tradeName: string; legalName?: string | null; gstin: string; state?: string | null; address?: string | null; entityType?: string | null; healthScore?: number | null }[],
  cfo: CFOResponse,
): { directory: BusinessDirectoryEntry[]; myBusiness?: BusinessDirectoryEntry } {
  const directory: BusinessDirectoryEntry[] = [];

  // My firm — the user's own business. If no Firm row exists yet, fall back to
  // a synthetic "Your Business" entry so the network graph still has a centre.
  let myBusiness: BusinessDirectoryEntry | undefined;
  const firmId = myFirm?.id ?? 'firm_default';
  const firmName = myFirm?.name ?? 'Your Business';
  const health = cfo.dashboard.healthScore.overall;
  const scores = computeReputation(firmId, 'business', {
    trust: clamp(70 + health / 4),
    compliance: clamp(health),
    payment: clamp(cfo.dashboard.receivables.collectionEfficiencyPct),
    growth: clamp(50 + cfo.dashboard.revenue.growthPct),
    network: undefined,
    rating: 4.6,
    reviewCount: 42,
  });
  myBusiness = {
    id: `business:my_${firmId}`,
    companyName: firmName,
    legalName: firmName,
    gstin: myFirm?.gstin ?? '27ABCDE1234F1Z5',
    industry: 'Financial Services',
    subIndustry: 'CA Firm',
    size: cfo.clientCount > 50 ? 'medium' : 'small',
    employeeCount: cfo.clientCount > 0 ? Math.max(5, Math.round(cfo.clientCount / 3)) : 5,
    location: myFirm?.address ?? `${myFirm?.state ?? 'Mumbai'}`,
    state: myFirm?.state ?? 'Maharashtra',
    city: myFirm?.state ?? 'Mumbai',
    services: ['GST Filing', 'Advisory', 'Audit', 'ITC Optimisation'],
    networkScore: scores.networkScore,
    networkTier: scores.tier,
    trustScore: scores.trustScore,
    complianceScore: scores.complianceScore,
    growthScore: scores.growthScore,
    paymentScore: scores.paymentScore,
    verified: true,
    annualRevenue: cfo.dashboard.revenue.thisMonth * 12 || 5000000,
    yearsActive: 5,
    description: `${firmName} — your firm on GSTPilot Network™. Serving ${cfo.clientCount} clients with GST, audit, and advisory services.`,
    contactEmail: 'contact@yourfirm.in',
    contactPhone: '+91 9876543210',
    tags: ['Financial Services', 'CA Firm', myFirm?.state ?? 'Maharashtra'],
    isMyBusiness: true,
    isMyClient: false,
  };
  directory.push(myBusiness);

  // My clients become directory entries
  for (const c of clients) {
    const h = hashStr(c.id + c.gstin);
    const health = c.healthScore ?? 70;
    const trust = clamp(50 + health / 3);
    const compliance = clamp(health);
    const payment = clamp(seededInt(h, 55, 90));
    const growth = clamp(seededInt(h >> 4, 40, 88));
    const network = clamp(Math.round(trust * 0.4 + compliance * 0.25 + payment * 0.2 + growth * 0.15));
    const tier = scoreToTier(network);
    const industry = pick(INDUSTRIES, h);
    const annualRevenue = seededInt(h >> 6, 1000000, 100000000);
    const entry: BusinessDirectoryEntry = {
      id: `business:client_${c.id}`,
      companyName: c.tradeName,
      legalName: c.legalName ?? c.tradeName,
      gstin: c.gstin,
      industry,
      subIndustry: pick(SUB_INDUSTRIES[industry] ?? ['General'], h),
      size: sizeFromRevenue(annualRevenue),
      employeeCount: seededInt(h >> 8, 10, 500),
      location: c.address ?? `${c.state ?? 'Mumbai'}`,
      state: c.state ?? 'Maharashtra',
      city: c.state ?? 'Mumbai',
      services: ['GST Filing', 'ITC', 'Audit'],
      networkScore: network,
      networkTier: tier,
      trustScore: trust,
      complianceScore: compliance,
      growthScore: growth,
      paymentScore: payment,
      verified: (h % 3) !== 0,
      annualRevenue,
      yearsActive: seededInt(h >> 10, 2, 25),
      description: `${c.tradeName} — a ${industry.toLowerCase()} business${c.state ? ` based in ${c.state}` : ''}.`,
      tags: [industry, c.state ?? 'Maharashtra'],
      isMyBusiness: false,
      isMyClient: true,
    };
    directory.push(entry);
  }

  // Synthetic businesses fill out the directory
  const synthetic = Array.from({ length: 16 }).map((_, i) => buildSyntheticBusiness(i));
  directory.push(...synthetic);

  return { directory, myBusiness };
}

// ─── Module 4: Vendor Directory builder ───────────────────────────────────────

export function buildVendorDirectory(): VendorProfile[] {
  return VENDOR_NAMES.map((v, idx) => {
    const h = hashStr(v.name + v.category);
    const cityObj = INDIAN_CITIES[idx % INDIAN_CITIES.length];
    const trust = clamp(seededInt(h, 55, 92));
    const compliance = clamp(seededInt(h >> 2, 60, 95));
    const payment = clamp(seededInt(h >> 4, 55, 90));
    const growth = clamp(seededInt(h >> 6, 45, 88));
    const network = clamp(Math.round(trust * 0.4 + compliance * 0.25 + payment * 0.2 + growth * 0.15));
    const tier = scoreToTier(network);
    return {
      id: `vendor:vendor_${idx}`,
      name: v.name,
      category: v.category,
      gstin: `27${v.name.replace(/[^A-Z]/g, '').slice(0, 5).padEnd(5, 'X')}${(2000 + idx).toString().padStart(4, '0')}H1Z5`,
      location: `${cityObj.city}, ${cityObj.state}`,
      city: cityObj.city,
      state: cityObj.state,
      services: VENDOR_SERVICES[v.category],
      rating: Math.round(seeded(h, 3.6, 5) * 10) / 10,
      reviewCount: seededInt(h >> 8, 8, 350),
      yearsActive: seededInt(h >> 10, 3, 35),
      verified: (h % 4) !== 0,
      networkTier: tier,
      trustScore: trust,
      paymentScore: payment,
      growthScore: growth,
      complianceScore: compliance,
      networkScore: network,
      feeRange: { min: seededInt(h >> 12, 5000, 50000), max: seededInt(h >> 14, 60000, 500000) },
      responseTimeHours: seededInt(h >> 16, 1, 48),
      clientsServed: seededInt(h >> 18, 25, 1200),
      topClients: [BUSINESS_NAMES[idx % BUSINESS_NAMES.length], BUSINESS_NAMES[(idx + 5) % BUSINESS_NAMES.length]],
      bio: `${v.name} is a ${v.category.replace('_', ' ')} partner based in ${cityObj.city}. ${seededInt(h, 3, 35)}+ years serving Indian businesses.`,
      availableForNewContracts: (h % 5) !== 0,
      tags: [v.category, cityObj.city, tier],
      isMyVendor: idx < 3, // first 3 are "my" vendors
    };
  });
}

const VENDOR_SERVICES: Record<VendorCategory, string[]> = {
  supplier: ['Raw Materials', 'Components', 'Bulk Supply'],
  consultant: ['Strategy', 'Operations', 'Digital Transformation'],
  auditor: ['Statutory Audit', 'Internal Audit', 'Tax Audit'],
  bank: ['Current Account', 'Working Capital Loan', 'Trade Finance'],
  software: ['Accounting Software', 'ERP', 'GST Compliance Tools'],
  logistics: ['Freight', 'Warehousing', 'Last-Mile Delivery'],
  legal: ['Corporate Law', 'Tax Litigation', 'Contracts'],
  marketing: ['Digital Marketing', 'Brand Strategy', 'Lead Gen'],
  it_services: ['Cloud Infra', 'App Dev', 'Cybersecurity'],
  manufacturing: ['Contract Manufacturing', 'OEM', 'Fabrication'],
  payroll: ['Payroll Processing', 'Compliance', 'PF/ESI'],
  insurance: ['Business Insurance', 'Liability Cover', 'Employee Insurance'],
};

// ─── Module 1: Business Network Graph builder ─────────────────────────────────

export function buildNetworkGraph(
  myBusiness: BusinessDirectoryEntry | undefined,
  directory: BusinessDirectoryEntry[],
  cas: CAProfile[],
  vendors: VendorProfile[],
  clients: BusinessDirectoryEntry[],
): BusinessNetworkGraph {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];

  // My business node (the center)
  if (myBusiness) {
    nodes.push({
      id: myBusiness.id,
      type: 'business',
      entityId: myBusiness.id,
      label: myBusiness.companyName,
      subtitle: `${myBusiness.industry} · ${myBusiness.location}`,
      industry: myBusiness.industry,
      location: myBusiness.location,
      gstin: myBusiness.gstin,
      amount: myBusiness.annualRevenue,
      trustScore: myBusiness.trustScore,
      networkTier: myBusiness.networkTier,
      verified: true,
      x: 400,
      y: 300,
    });
  }

  // CA nodes — connect to my business via SERVES / HIRES
  const topCas = cas.slice(0, 8);
  topCas.forEach((ca, i) => {
    nodes.push({
      id: ca.id,
      type: 'ca',
      entityId: ca.id,
      label: ca.name,
      subtitle: `${ca.firmName} · ${ca.designation}`,
      industry: 'Financial Services',
      location: ca.location,
      gstin: ca.gstin,
      amount: ca.feeRange.max,
      trustScore: ca.trustScore,
      networkTier: ca.networkTier,
      verified: ca.verified,
      x: 200 + Math.cos((i / 8) * Math.PI * 2) * 180,
      y: 300 + Math.sin((i / 8) * Math.PI * 2) * 180,
    });
    if (myBusiness) {
      const isMyCa = ca.firmName === 'Your Firm';
      edges.push({
        id: `e_ca_${ca.id}`,
        source: ca.id,
        target: myBusiness.id,
        type: isMyCa ? 'SERVES' : 'PARTNERS_WITH',
        weight: isMyCa ? 8 : 4,
        amount: ca.feeRange.max,
        label: isMyCa ? 'Serves' : 'Network',
        since: daysAgo(120 + i * 5),
      });
    }
  });

  // Vendor nodes — connect to my business via SUPPLIES_TO / BUYS_FROM
  const topVendors = vendors.slice(0, 6);
  topVendors.forEach((v, i) => {
    nodes.push({
      id: v.id,
      type: 'vendor',
      entityId: v.id,
      label: v.name,
      subtitle: `${v.category} · ${v.location}`,
      industry: v.category,
      location: v.location,
      trustScore: v.trustScore,
      networkTier: v.networkTier,
      verified: v.verified,
      x: 600 + Math.cos((i / 6) * Math.PI * 2) * 160,
      y: 300 + Math.sin((i / 6) * Math.PI * 2) * 160,
    });
    if (myBusiness) {
      edges.push({
        id: `e_vendor_${v.id}`,
        source: myBusiness.id,
        target: v.id,
        type: 'BUYS_FROM',
        weight: v.isMyVendor ? 8 : 3,
        amount: v.feeRange?.max ?? 50000,
        label: v.isMyVendor ? 'Buys from' : 'Network',
        since: daysAgo(90 + i * 8),
      });
    }
  });

  // Bank nodes (subset of vendors with category 'bank')
  vendors.filter((v) => v.category === 'bank').slice(0, 2).forEach((b, i) => {
    if (!nodes.find((n) => n.id === b.id)) {
      nodes.push({
        id: b.id, type: 'bank', entityId: b.id, label: b.name,
        subtitle: `Bank · ${b.location}`, location: b.location,
        trustScore: b.trustScore, networkTier: b.networkTier, verified: true,
        x: 400, y: 120 + i * 30,
      });
    }
    if (myBusiness) {
      edges.push({
        id: `e_bank_${b.id}`, source: myBusiness.id, target: b.id,
        type: 'BANKS_WITH', weight: 9, label: 'Banks with', since: daysAgo(365),
      });
    }
  });

  // Client nodes (my clients) — connect to my business
  clients.slice(0, 8).forEach((c, i) => {
    nodes.push({
      id: c.id, type: 'client', entityId: c.id, label: c.companyName,
      subtitle: `${c.industry} · ${c.location}`, industry: c.industry, location: c.location,
      gstin: c.gstin, amount: c.annualRevenue, trustScore: c.trustScore,
      networkTier: c.networkTier, verified: c.verified,
      x: 400 + Math.cos((i / 8) * Math.PI * 2) * 240,
      y: 300 + Math.sin((i / 8) * Math.PI * 2) * 240,
    });
    if (myBusiness) {
      edges.push({
        id: `e_client_${c.id}`, source: myBusiness.id, target: c.id,
        type: 'SERVES', weight: 9, amount: c.annualRevenue * 0.02,
        label: 'Serves', since: daysAgo(200 + i * 10),
      });
    }
  });

  // A few inter-connections (CA ↔ CA, Business ↔ Business partnerships)
  if (topCas.length >= 4) {
    edges.push({
      id: 'e_caca_1', source: topCas[0].id, target: topCas[2].id,
      type: 'PARTNERS_WITH', weight: 3, label: 'Co-practice', since: daysAgo(400),
    });
  }
  const partnerBiz = directory.filter((d) => !d.isMyBusiness && !d.isMyClient).slice(0, 3);
  partnerBiz.forEach((b, i) => {
    nodes.push({
      id: b.id, type: 'business', entityId: b.id, label: b.companyName,
      subtitle: `${b.industry} · ${b.location}`, industry: b.industry, location: b.location,
      trustScore: b.trustScore, networkTier: b.networkTier, verified: b.verified,
      x: 120 + i * 80, y: 480 + i * 30,
    });
    if (myBusiness) {
      edges.push({
        id: `e_partner_${b.id}`, source: myBusiness.id, target: b.id,
        type: 'PARTNERS_WITH', weight: 4, label: 'Partners', since: daysAgo(150 + i * 20),
      });
    }
  });

  const nodeCountByType = {} as Record<NetworkEntityType, number>;
  const edgeCountByType = {} as Record<NetworkRelationshipType, number>;
  const allTypes: NetworkEntityType[] = ['business', 'ca', 'vendor', 'client', 'bank', 'consultant', 'service-provider', 'employee'];
  const allRelTypes: NetworkRelationshipType[] = ['SERVES', 'HIRES', 'SUPPLIES_TO', 'BUYS_FROM', 'BANKS_WITH', 'EMPLOYS', 'MANAGES', 'PARTNERS_WITH', 'REFERRED_BY', 'VERIFIED_BY', 'COLLABORATES_WITH'];
  allTypes.forEach((t) => (nodeCountByType[t] = nodes.filter((n) => n.type === t).length));
  allRelTypes.forEach((t) => (edgeCountByType[t] = edges.filter((e) => e.type === t).length));

  return { nodes, edges, nodeCountByType, edgeCountByType };
}

// ─── Module 5: Smart Matching Engine ──────────────────────────────────────────

export function computeMatches(
  intent: MatchIntent,
  query: string,
  opts: { industry?: string; location?: string; specialization?: CASpecialization },
  state: NetworkState,
  limit = 8,
): SmartMatchResponse {
  const q = query.toLowerCase();
  const results: MatchResult[] = [];

  const industryFilter = opts.industry ?? (q.match(/(manufactur|retail|it|textile|pharma|construction|food|auto|electronic|chemical|logistic|healthcare|education|real estate|agriculture|e-commerce|financial|hospitality|media|steel)/i)?.[0]);
  const locationFilter = opts.location ?? INDIAN_CITIES.find((c) => q.includes(c.city.toLowerCase()) || q.includes(c.state.toLowerCase()))?.city;

  if (intent === 'find_ca') {
    for (const ca of state.caDirectory) {
      const specMatch = !opts.specialization || ca.specializations.includes(opts.specialization);
      const indMatch = !industryFilter || ca.industriesServed.some((i) => i.toLowerCase().includes(industryFilter));
      const locMatch = !locationFilter || ca.location.toLowerCase().includes(locationFilter.toLowerCase());
      if (!specMatch || !indMatch || !locMatch) continue;
      const scores: MatchScore[] = [
        { factor: 'GST Expertise', score: ca.gstExpertiseLevel === 'master' ? 100 : ca.gstExpertiseLevel === 'expert' ? 85 : ca.gstExpertiseLevel === 'intermediate' ? 65 : 40, weight: 0.3, note: `${ca.gstExpertiseLevel} level` },
        { factor: 'Network Tier', score: ca.networkScore, weight: 0.25, note: `${ca.networkTier.toUpperCase()} tier` },
        { factor: 'Rating & Reviews', score: clamp(Math.round((ca.rating / 5) * 100)), weight: 0.2, note: `${ca.rating}★ from ${ca.reviewCount} reviews` },
        { factor: 'Response Speed', score: clamp(100 - ca.responseTimeHours * 2), weight: 0.15, note: `${ca.responseTimeHours}h avg response` },
        { factor: 'Experience', score: clamp(50 + ca.yearsExperience * 1.5), weight: 0.1, note: `${ca.yearsExperience} years` },
      ];
      const overall = clamp(Math.round(scores.reduce((a, s) => a + s.score * s.weight, 0)));
      const reasons: string[] = [];
      if (ca.verified) reasons.push(`${ca.verifiedBadge.toUpperCase()} verified by ICAI`);
      reasons.push(`${ca.gstExpertiseLevel} GST expert with ${ca.returnsFiled} returns filed`);
      if (ca.rating >= 4.5) reasons.push(`Highly rated (${ca.rating}★)`);
      if (ca.responseTimeHours <= 6) reasons.push(`Fast response (${ca.responseTimeHours}h)`);
      reasons.push(`${ca.networkTier.toUpperCase()} network tier`);
      results.push({
        id: uid('match'), entityType: 'ca', entityId: ca.id, name: ca.name,
        subtitle: `${ca.firmName} · ${ca.location}`, industry: ca.industriesServed[0],
        location: ca.city, overallScore: overall, tier: ca.networkTier, verified: ca.verified,
        scores, reasons, recommendedAction: `Reach out to ${ca.name.split(' ')[0]} for a 15-min intro call about your GST needs.`,
        estimatedValue: ca.feeRange.max, matchType: intent,
      });
    }
  } else if (intent === 'find_vendor') {
    for (const v of state.vendorDirectory) {
      const catMatch = !industryFilter || v.services.some((s) => s.toLowerCase().includes(industryFilter)) || v.category.includes(industryFilter);
      const locMatch = !locationFilter || v.location.toLowerCase().includes(locationFilter.toLowerCase());
      if (!catMatch || !locMatch) continue;
      const scores: MatchScore[] = [
        { factor: 'Reliability', score: v.trustScore, weight: 0.3, note: `${v.trustScore}/100 trust` },
        { factor: 'Network Tier', score: v.networkScore, weight: 0.25, note: `${v.networkTier.toUpperCase()} tier` },
        { factor: 'Rating', score: clamp(Math.round((v.rating / 5) * 100)), weight: 0.2, note: `${v.rating}★ from ${v.reviewCount} reviews` },
        { factor: 'Experience', score: clamp(50 + v.yearsActive * 1.4), weight: 0.15, note: `${v.yearsActive} years active` },
        { factor: 'Response', score: clamp(100 - v.responseTimeHours * 2), weight: 0.1, note: `${v.responseTimeHours}h avg response` },
      ];
      const overall = clamp(Math.round(scores.reduce((a, s) => a + s.score * s.weight, 0)));
      const reasons: string[] = [];
      if (v.verified) reasons.push('Verified vendor');
      reasons.push(`${v.clientsServed} clients served`);
      if (v.rating >= 4.5) reasons.push(`Highly rated (${v.rating}★)`);
      reasons.push(`${v.yearsActive} years in business`);
      results.push({
        id: uid('match'), entityType: 'vendor', entityId: v.id, name: v.name,
        subtitle: `${v.category} · ${v.location}`, industry: v.category, location: v.city,
        overallScore: overall, tier: v.networkTier, verified: v.verified,
        scores, reasons, recommendedAction: `Request a quote from ${v.name} — typical engagement ₹${v.feeRange?.min.toLocaleString('en-IN')}–₹${v.feeRange?.max.toLocaleString('en-IN')}.`,
        estimatedValue: v.feeRange?.max, matchType: intent,
      });
    }
  } else if (intent === 'find_client' || intent === 'find_partner') {
    for (const b of state.businessDirectory) {
      if (b.isMyBusiness) continue;
      const indMatch = !industryFilter || b.industry.toLowerCase().includes(industryFilter);
      const locMatch = !locationFilter || b.location.toLowerCase().includes(locationFilter.toLowerCase());
      if (!indMatch || !locMatch) continue;
      const scores: MatchScore[] = [
        { factor: 'Growth', score: b.growthScore, weight: 0.3, note: `${b.growthScore}/100 growth` },
        { factor: 'Compliance', score: b.complianceScore, weight: 0.25, note: `${b.complianceScore}/100 compliance` },
        { factor: 'Network Tier', score: b.networkScore, weight: 0.2, note: `${b.networkTier.toUpperCase()} tier` },
        { factor: 'Business Size', score: clamp(50 + Math.log10(b.annualRevenue + 1) * 10), weight: 0.15, note: `${b.size} business` },
        { factor: 'Payment Behaviour', score: b.paymentScore, weight: 0.1, note: `${b.paymentScore}/100 payment` },
      ];
      const overall = clamp(Math.round(scores.reduce((a, s) => a + s.score * s.weight, 0)));
      const reasons: string[] = [];
      if (b.verified) reasons.push('Verified business');
      reasons.push(`${b.industry} · ${b.size} size`);
      if (b.growthScore >= 75) reasons.push(`Growing fast (${b.growthScore}/100)`);
      reasons.push(`₹${inrShort(b.annualRevenue)} annual revenue`);
      results.push({
        id: uid('match'), entityType: 'business', entityId: b.id, name: b.companyName,
        subtitle: `${b.industry} · ${b.location}`, industry: b.industry, location: b.city,
        overallScore: overall, tier: b.networkTier, verified: b.verified,
        scores, reasons,
        recommendedAction: intent === 'find_client'
          ? `Reach out to ${b.companyName} — they may need your GST services.`
          : `Propose a strategic partnership with ${b.companyName} in ${b.industry}.`,
        estimatedValue: b.annualRevenue * 0.01, matchType: intent,
      });
    }
  } else if (intent === 'find_funding_partner') {
    // Banks and large financial vendors
    const banks = state.vendorDirectory.filter((v) => v.category === 'bank' || v.category === 'insurance');
    for (const b of banks) {
      const scores: MatchScore[] = [
        { factor: 'Trust', score: b.trustScore, weight: 0.35, note: `${b.trustScore}/100 trust` },
        { factor: 'Network Tier', score: b.networkScore, weight: 0.25, note: `${b.networkTier.toUpperCase()} tier` },
        { factor: 'Rating', score: clamp(Math.round((b.rating / 5) * 100)), weight: 0.2, note: `${b.rating}★` },
        { factor: 'Experience', score: clamp(50 + b.yearsActive * 1.3), weight: 0.2, note: `${b.yearsActive} years` },
      ];
      const overall = clamp(Math.round(scores.reduce((a, s) => a + s.score * s.weight, 0)));
      results.push({
        id: uid('match'), entityType: 'bank', entityId: b.id, name: b.name,
        subtitle: `${b.category} · ${b.location}`, industry: b.category, location: b.city,
        overallScore: overall, tier: b.networkTier, verified: b.verified,
        scores, reasons: [`${b.category} partner`, `${b.clientsServed} clients`, `${b.networkTier.toUpperCase()} tier`],
        recommendedAction: `Apply for working capital or trade finance with ${b.name}.`,
        estimatedValue: b.feeRange?.max, matchType: intent,
      });
    }
  }

  // Sort by overall score, take top N
  results.sort((a, b) => b.overallScore - a.overallScore);
  const top = results.slice(0, limit);
  const topPick = top[0];

  const ackMap: Record<MatchIntent, string> = {
    find_ca: "I've ranked the top CAs in your network based on GST expertise, ratings, and response speed.",
    find_vendor: "I've matched you with the most reliable vendors based on trust, ratings, and experience.",
    find_client: "I've identified businesses that fit your ideal client profile based on industry and growth.",
    find_partner: "I've found strategic partner candidates based on growth and network alignment.",
    find_funding_partner: "I've matched you with funding partners based on trust and capacity.",
    unknown: "I've searched the network for relevant matches.",
  };

  const summary = top.length === 0
    ? 'No matches found in your current network. Try broadening your filters.'
    : `Top match: ${topPick.name} (${topPick.overallScore}/100, ${topPick.tier.toUpperCase()}). ${top.length} total matches found.`;

  return {
    intent, query, results: top, topPick, summary, spokenAck: ackMap[intent],
  };
}

// Detect intent from raw query text
export function detectMatchIntent(text: string): MatchIntent {
  const t = text.toLowerCase();
  if (/(find|recommend|hire|looking for).*(ca|chartered|accountant)|gst expert|notice specialist/.test(t)) return 'find_ca';
  if (/(find|recommend).*(vendor|supplier|payroll|legal|auditor|software|logistics)/.test(t)) return 'find_vendor';
  if (/(funding|loan|working capital|financ)/.test(t)) return 'find_funding_partner';
  if (/(partner|strategic ally|collaborate with)/.test(t)) return 'find_partner';
  if (/(client|customer|lead|prospect|business)/.test(t)) return 'find_client';
  return 'unknown';
}

// ─── Module 6: Collaboration Workspace builder ────────────────────────────────

export function buildCollaborationRooms(
  clients: { id: string; tradeName: string }[],
  cas: CAProfile[],
  notices: { id: string; clientId: string; subject: string }[],
): CollaborationRoom[] {
  const rooms: CollaborationRoom[] = [];

  // Room 1: CA ↔ Business engagement
  const ownCa = cas.find((c) => c.firmName === 'Your Firm') ?? cas[0];
  rooms.push({
    id: 'room_ca_engagement',
    name: 'GST Compliance — Q2 Review',
    type: 'ca_business',
    participants: [
      { id: ownCa.id, name: ownCa.name, role: 'CA', type: 'ca', avatarColor: '#22d3ee', online: true },
      { id: 'business:my_firm', name: 'Your Business', role: 'Business Owner', type: 'business', avatarColor: '#10b981', online: true },
    ],
    messageCount: 24,
    taskCount: 4,
    pendingApprovals: 2,
    unreadCount: 3,
    lastActivity: daysAgo(0),
    recentMessages: [
      { id: 'm1', senderId: ownCa.id, senderName: ownCa.name, senderRole: 'CA', text: 'I have prepared your GSTR-3B draft for June. Please review the ITC reversal — ₹42,000 needs to be reversed under Rule 37.', timestamp: daysAgo(0) },
      { id: 'm2', senderId: 'business:my_firm', senderName: 'You', senderRole: 'Business Owner', text: 'Thanks. Please share the working. I will approve by tomorrow EOD.', timestamp: daysAgo(0) },
      { id: 'm3', senderId: ownCa.id, senderName: ownCa.name, senderRole: 'CA', text: 'Uploaded. Also flagging that your vendor Skyline Industries has not filed GSTR-1 for 2 months — ITC of ₹1.2L is at risk.', timestamp: daysAgo(0), attachments: [{ id: 'att1', name: 'GSTR-3B-June-Draft.pdf', type: 'return' }] },
    ],
    tasks: [
      { id: 't1', title: 'Review GSTR-3B June draft', assignedTo: 'business:my_firm', assignedToName: 'You', status: 'in_progress', priority: 'high', dueDate: daysAgo(-2), createdAt: daysAgo(1) },
      { id: 't2', title: 'Approve ITC reversal of ₹42,000', assignedTo: 'business:my_firm', assignedToName: 'You', status: 'pending', priority: 'high', dueDate: daysAgo(-3), createdAt: daysAgo(1) },
      { id: 't3', title: 'Follow up with Skyline Industries', assignedTo: ownCa.id, assignedToName: ownCa.name, status: 'in_progress', priority: 'medium', dueDate: daysAgo(-5), createdAt: daysAgo(2) },
      { id: 't4', title: 'File GSTR-3B by 20th', assignedTo: ownCa.id, assignedToName: ownCa.name, status: 'pending', priority: 'high', dueDate: daysAgo(-7), createdAt: daysAgo(0) },
    ],
    approvals: [
      { id: 'a1', title: 'GSTR-3B Filing — June 2025', requestedBy: ownCa.id, requestedByName: ownCa.name, type: 'return_filing', amount: 184000, status: 'pending', createdAt: daysAgo(0) },
      { id: 'a2', title: 'ITC Reversal Entry — Rule 37', requestedBy: ownCa.id, requestedByName: ownCa.name, type: 'payment', amount: 42000, status: 'pending', createdAt: daysAgo(0) },
    ],
    comments: [
      { id: 'c1', author: ownCa.id, authorName: ownCa.name, text: 'Note: GSTN has extended the GSTR-3B deadline to 21st for this month.', target: 'GSTR-3B June', timestamp: daysAgo(0) },
    ],
  });

  // Room 2: Client engagement (with a client)
  if (clients[0]) {
    const c = clients[0];
    rooms.push({
      id: 'room_client_engagement',
      name: `${c.tradeName} — Monthly GST`,
      type: 'client_engagement',
      participants: [
        { id: `business:client_${c.id}`, name: c.tradeName, role: 'Client', type: 'client', avatarColor: '#34d399', online: false },
        { id: 'business:my_firm', name: 'Your Firm', role: 'CA Firm', type: 'business', avatarColor: '#10b981', online: true },
      ],
      messageCount: 18,
      taskCount: 3,
      pendingApprovals: 1,
      unreadCount: 1,
      lastActivity: daysAgo(1),
      recentMessages: [
        { id: 'm1', senderId: `business:client_${c.id}`, senderName: c.tradeName, senderRole: 'Client', text: 'Sharing the purchase register for May. Please reconcile with 2B.', timestamp: daysAgo(1), attachments: [{ id: 'att2', name: 'Purchase-Register-May.xlsx', type: 'document' }] },
        { id: 'm2', senderId: 'business:my_firm', senderName: 'Your Firm', senderRole: 'CA Firm', text: 'Received. 12 mismatches found — will share the resolution sheet today.', timestamp: daysAgo(1) },
      ],
      tasks: [
        { id: 't1', title: 'Reconcile May purchase register', assignedTo: 'business:my_firm', assignedToName: 'Your Firm', status: 'in_progress', priority: 'high', dueDate: daysAgo(-1), createdAt: daysAgo(1) },
        { id: 't2', title: 'Upload GSTR-2B mismatch sheet', assignedTo: 'business:my_firm', assignedToName: 'Your Firm', status: 'pending', priority: 'medium', dueDate: daysAgo(0), createdAt: daysAgo(1) },
        { id: 't3', title: 'Share ITC eligibility report', assignedTo: 'business:my_firm', assignedToName: 'Your Firm', status: 'completed', priority: 'low', createdAt: daysAgo(3) },
      ],
      approvals: [
        { id: 'a1', title: 'May ITC claim — ₹3.4L', requestedBy: 'business:my_firm', requestedByName: 'Your Firm', type: 'payment', amount: 340000, status: 'pending', createdAt: daysAgo(1) },
      ],
      comments: [],
    });
  }

  // Room 3: Notice response (if notices exist)
  if (notices[0]) {
    const n = notices[0];
    rooms.push({
      id: 'room_notice_response',
      name: `Notice Response — ${n.subject.slice(0, 30)}`,
      type: 'notice_response',
      participants: [
        { id: ownCa.id, name: ownCa.name, role: 'CA', type: 'ca', avatarColor: '#22d3ee', online: true },
        { id: 'business:my_firm', name: 'You', role: 'Business Owner', type: 'business', avatarColor: '#10b981', online: true },
        { id: 'vendor:vendor_3', name: 'Cyrus Mistry Legal', role: 'Legal Counsel', type: 'vendor', avatarColor: '#f59e0b', online: false },
      ],
      messageCount: 12,
      taskCount: 3,
      pendingApprovals: 1,
      unreadCount: 0,
      lastActivity: daysAgo(2),
      recentMessages: [
        { id: 'm1', senderId: ownCa.id, senderName: ownCa.name, senderRole: 'CA', text: `Notice ${n.subject} requires response by next week. Drafting the reply now.`, timestamp: daysAgo(2) },
        { id: 'm2', senderId: 'vendor:vendor_3', senderName: 'Cyrus Mistry Legal', senderRole: 'Legal Counsel', text: 'Reviewed the draft. Suggesting we add the Sec 16(2) compliance proof as exhibit A.', timestamp: daysAgo(2) },
      ],
      tasks: [
        { id: 't1', title: 'Draft notice reply', assignedTo: ownCa.id, assignedToName: ownCa.name, status: 'in_progress', priority: 'high', dueDate: daysAgo(-3), createdAt: daysAgo(3) },
        { id: 't2', title: 'Legal review of draft', assignedTo: 'vendor:vendor_3', assignedToName: 'Cyrus Mistry Legal', status: 'completed', priority: 'high', createdAt: daysAgo(2) },
        { id: 't3', title: 'File response with authority', assignedTo: ownCa.id, assignedToName: ownCa.name, status: 'pending', priority: 'high', dueDate: daysAgo(-5), createdAt: daysAgo(2) },
      ],
      approvals: [
        { id: 'a1', title: 'Notice reply — final sign-off', requestedBy: ownCa.id, requestedByName: ownCa.name, type: 'notice_response', status: 'pending', createdAt: daysAgo(2) },
      ],
      comments: [
        { id: 'c1', author: 'business:my_firm', authorName: 'You', text: 'Please ensure we cite the latest CBIC circular on this issue.', target: 'Notice reply', timestamp: daysAgo(2) },
      ],
    });
  }

  // Room 4: Internal team
  rooms.push({
    id: 'room_internal_team',
    name: 'Internal Team — Daily Standup',
    type: 'internal_team',
    participants: [
      { id: 'business:my_firm', name: 'You', role: 'Owner', type: 'business', avatarColor: '#10b981', online: true },
      { id: 'employee:tm_1', name: 'Anjali Kumar', role: 'GST Manager', type: 'employee', avatarColor: '#f472b6', online: true },
      { id: 'employee:tm_2', name: 'Rohit Shetty', role: 'Audit Lead', type: 'employee', avatarColor: '#a78bfa', online: false },
    ],
    messageCount: 56,
    taskCount: 8,
    pendingApprovals: 0,
    unreadCount: 2,
    lastActivity: daysAgo(0),
    recentMessages: [
      { id: 'm1', senderId: 'employee:tm_1', senderName: 'Anjali Kumar', senderRole: 'GST Manager', text: 'Filed 4 GSTR-1 returns today. 2 more pending — will finish by EOD.', timestamp: daysAgo(0) },
      { id: 'm2', senderId: 'employee:tm_2', senderName: 'Rohit Shetty', senderRole: 'Audit Lead', text: 'Audit review for Apex Industries starts Monday. Books look clean.', timestamp: daysAgo(0) },
    ],
    tasks: [
      { id: 't1', title: 'File 2 pending GSTR-1 returns', assignedTo: 'employee:tm_1', assignedToName: 'Anjali Kumar', status: 'in_progress', priority: 'high', dueDate: daysAgo(0), createdAt: daysAgo(0) },
      { id: 't2', title: 'Prepare Apex Industries audit plan', assignedTo: 'employee:tm_2', assignedToName: 'Rohit Shetty', status: 'pending', priority: 'medium', dueDate: daysAgo(-3), createdAt: daysAgo(0) },
    ],
    approvals: [],
    comments: [],
  });

  return rooms;
}

// ─── Module 8: Marketplace builder ────────────────────────────────────────────

export function buildMarketplace(
  cas: CAProfile[],
  vendors: VendorProfile[],
): { listings: MarketplaceListing[]; quoteRequests: MarketplaceQuoteRequest[]; categories: MarketplaceCategory[] } {
  const listings: MarketplaceListing[] = [];
  const categories: MarketplaceCategory[] = ['gst_filing', 'notice_management', 'bookkeeping', 'auditing', 'payroll', 'tax_planning', 'consulting', 'roc_compliance', 'tds_filing', 'it_returns', 'advisory', 'software'];

  // CAs offer services
  cas.slice(0, 12).forEach((ca, idx) => {
    const cat: MarketplaceCategory = pick(['gst_filing', 'notice_management', 'tax_planning', 'auditing', 'roc_compliance', 'tds_filing'] as MarketplaceCategory[], idx);
    listings.push({
      id: `listing_ca_${idx}`,
      title: `${cat === 'gst_filing' ? 'Monthly GST Return Filing' : cat === 'notice_management' ? 'GST Notice Response Service' : cat === 'tax_planning' ? 'Annual Tax Planning & Optimisation' : cat === 'auditing' ? 'Statutory & Tax Audit' : cat === 'roc_compliance' ? 'ROC Annual Filing' : 'TDS Quarterly Filing'} — by ${ca.name}`,
      category: cat,
      description: `${ca.name} (${ca.firmName}) offers professional ${cat.replace('_', ' ')} services. ${ca.yearsExperience} years of experience, ${ca.returnsFiled} returns filed, ${ca.noticesHandled} notices handled. Based in ${ca.city}.`,
      providerId: ca.id,
      providerName: ca.name,
      providerType: 'ca',
      providerTier: ca.networkTier,
      providerRating: ca.rating,
      priceType: cat === 'gst_filing' || cat === 'bookkeeping' || cat === 'payroll' ? 'monthly' : 'fixed',
      priceMin: ca.feeRange.min,
      priceMax: ca.feeRange.max,
      currency: 'INR',
      deliveryDays: cat === 'notice_management' ? 3 : cat === 'gst_filing' ? 7 : 15,
      tags: [ca.city, cat, ca.networkTier],
      features: [
        `${ca.gstExpertiseLevel} GST expert`,
        `${ca.responseTimeHours}h avg response time`,
        'Direct chat with CA',
        'Document vault access',
        'Audit trail',
      ],
      rating: ca.rating,
      reviewCount: ca.reviewCount,
      ordersCompleted: Math.round(ca.clientsServed * 0.7),
      available: ca.availableForNewClients,
      featured: idx < 4,
      createdAt: daysAgo(idx * 3),
    });
  });

  // Vendors offer services
  vendors.slice(0, 10).forEach((v, idx) => {
    const cat: MarketplaceCategory = v.category === 'software' ? 'software'
      : v.category === 'payroll' ? 'payroll'
      : v.category === 'auditor' ? 'auditing'
      : v.category === 'legal' ? 'advisory'
      : v.category === 'consultant' ? 'consulting'
      : 'consulting';
    listings.push({
      id: `listing_vendor_${idx}`,
      title: `${v.name} — ${v.category.replace('_', ' ')} services`,
      category: cat,
      description: `${v.name} offers ${v.services.join(', ')} from ${v.city}. ${v.yearsActive} years active, ${v.clientsServed} clients served.`,
      providerId: v.id,
      providerName: v.name,
      providerType: v.category === 'bank' ? 'bank' : 'vendor',
      providerTier: v.networkTier,
      providerRating: v.rating,
      priceType: 'quote',
      priceMin: v.feeRange?.min ?? 5000,
      priceMax: v.feeRange?.max ?? 100000,
      currency: 'INR',
      deliveryDays: 7,
      tags: [v.city, v.category, v.networkTier],
      features: v.services.slice(0, 5),
      rating: v.rating,
      reviewCount: v.reviewCount,
      ordersCompleted: Math.round(v.clientsServed * 0.5),
      available: v.availableForNewContracts,
      featured: false,
      createdAt: daysAgo(idx * 4 + 2),
    });
  });

  const quoteRequests: MarketplaceQuoteRequest[] = [
    {
      id: 'qr_1', category: 'gst_filing', title: 'Monthly GST filing for manufacturing business — ₹5Cr turnover',
      description: 'Looking for a CA to handle monthly GSTR-1 and GSTR-3B filing for a manufacturing business in Pune. ~200 invoices/month. Need ITC reconciliation support.',
      budget: { min: 15000, max: 30000 }, timeline: 'Ongoing monthly', postedBy: 'business:dir_2', postedByName: 'Apex Industries Pvt Ltd',
      responsesCount: 7, createdAt: daysAgo(2), status: 'open',
    },
    {
      id: 'qr_2', category: 'notice_management', title: 'GST notice ASMT-10 response — urgent',
      description: 'Received ASMT-10 notice for FY 2023-24. Need a notice specialist to draft and file the response within 7 days.',
      budget: { min: 25000, max: 50000 }, timeline: '7 days', postedBy: 'business:dir_4', postedByName: 'Sri Balaji Trading',
      responsesCount: 12, createdAt: daysAgo(1), status: 'open',
    },
    {
      id: 'qr_3', category: 'auditing', title: 'Statutory audit for FY 2024-25 — mid-size IT services',
      description: 'Need statutory audit for an IT services company. Turnover ₹18Cr. Books on Tally Prime. Prefer Bengaluru-based auditor.',
      budget: { min: 150000, max: 300000 }, timeline: '45 days', postedBy: 'business:dir_6', postedByName: 'Quantum Electronics',
      responsesCount: 5, createdAt: daysAgo(4), status: 'open',
    },
    {
      id: 'qr_4', category: 'payroll', title: 'Payroll outsourcing — 120 employees',
      description: 'Outsource monthly payroll for 120 employees across 3 states. PF, ESI, PT compliance included.',
      budget: { min: 40000, max: 75000 }, timeline: 'Ongoing monthly', postedBy: 'business:dir_8', postedByName: 'Bharat Construction Ltd',
      responsesCount: 9, createdAt: daysAgo(3), status: 'open',
    },
  ];

  return { listings, quoteRequests, categories };
}

// ─── Social: Business Feed ────────────────────────────────────────────────────

export function buildFeed(
  cas: CAProfile[],
  directory: BusinessDirectoryEntry[],
  vendors: VendorProfile[],
  cfo: CFOResponse,
): FeedItem[] {
  const items: FeedItem[] = [];

  // Compliance update
  items.push({
    id: 'feed_1', type: 'compliance_update', author: 'GSTPilot Network', authorType: 'business',
    authorTier: 'platinum',
    title: 'CBIC extends GSTR-3B deadline for June 2025 to 21st July',
    body: 'The CBIC has extended the GSTR-3B filing deadline for June 2025 from 20th July to 21st July for taxpayers with turnover ≤ ₹5 Cr. No late fee applicable if filed by the extended date.',
    timestamp: daysAgo(0), likes: 234, comments: 18, shares: 87, pinned: true,
  });

  // Achievement
  if (directory[1]) {
    items.push({
      id: 'feed_2', type: 'achievement', author: directory[1].companyName, authorType: 'business',
      authorTier: directory[1].networkTier,
      title: `${directory[1].companyName} achieved ${directory[1].networkTier.toUpperCase()} network tier`,
      body: `Completed 24 months of on-time GST filings with zero notices. Network score climbed to ${directory[1].networkScore}/100. Trust score up by 12 points this quarter.`,
      timestamp: daysAgo(0), likes: 156, comments: 12, shares: 23,
      taggedEntities: [{ name: directory[1].companyName, type: 'business' }],
    });
  }

  // Industry insight
  items.push({
    id: 'feed_3', type: 'industry_insight', author: 'GSTPilot Intelligence', authorType: 'business',
    authorTier: 'platinum',
    title: 'Manufacturing sector ITC claims up 18% YoY in Q1 FY26',
    body: 'Data from 4,200 manufacturing businesses on GSTPilot Network shows ITC claims rose 18% YoY in Q1 FY26, driven by improved GSTR-2B reconciliation rates. Average ITC-to-output ratio now at 67%.',
    timestamp: daysAgo(1), likes: 198, comments: 34, shares: 56,
  });

  // New connection
  if (cas[3]) {
    items.push({
      id: 'feed_4', type: 'new_connection', author: cas[3].name, authorType: 'ca',
      authorTier: cas[3].networkTier,
      title: `${cas[3].name} joined GSTPilot Network™`,
      body: `New ${cas[3].designation} from ${cas[3].city} joined the network. Specialises in ${cas[3].specializations.map((s) => CA_SPEC_LABELS_SHORT[s]).join(', ')}. Available for new clients.`,
      timestamp: daysAgo(1), likes: 78, comments: 6, shares: 4,
    });
  }

  // Recommendation
  items.push({
    id: 'feed_5', type: 'recommendation', author: 'GSTPilot Oracle', authorType: 'business',
    authorTier: 'platinum',
    title: `3 CAs in Mumbai available for GST notice response`,
    body: 'Based on your business profile and recent notice activity, Oracle recommends reaching out to top-rated notice specialists in Mumbai. Average response time under 6 hours.',
    timestamp: daysAgo(1), likes: 45, comments: 8, shares: 12,
  });

  // Review
  if (cas[1] && directory[2]) {
    items.push({
      id: 'feed_6', type: 'review_posted', author: directory[2].companyName, authorType: 'business',
      authorTier: directory[2].networkTier,
      title: `${directory[2].companyName} rated ${cas[1].name} ${cas[1].rating}★`,
      body: `"${cas[1].topReviews[0]?.text ?? 'Excellent service.'}" — Highly recommended for GST compliance work.`,
      timestamp: daysAgo(2), likes: 67, comments: 5, shares: 8,
      taggedEntities: [{ name: cas[1].name, type: 'ca' }],
    });
  }

  // Milestone
  if (directory[3]) {
    items.push({
      id: 'feed_7', type: 'milestone', author: directory[3].companyName, authorType: 'business',
      authorTier: directory[3].networkTier,
      title: `${directory[3].companyName} crossed ₹${inrShort(directory[3].annualRevenue)} annual revenue`,
      body: `Growing at ${directory[3].growthScore}/100 growth score. ${directory[3].yearsActive} years on the network.`,
      timestamp: daysAgo(2), likes: 132, comments: 18, shares: 14, amount: directory[3].annualRevenue,
    });
  }

  // Announcement
  items.push({
    id: 'feed_8', type: 'announcement', author: 'GSTPilot Network', authorType: 'business',
    authorTier: 'platinum',
    title: 'New: AI-powered ITC Optimisation now live for all Platinum members',
    body: 'Platinum tier members can now access AI-driven ITC optimisation that auto-identifies blocked credits, suggests reversals, and predicts ITC availability for the next 90 days. Upgrade your tier to unlock.',
    timestamp: daysAgo(3), likes: 312, comments: 47, shares: 89,
  });

  return items;
}

// ─── Network Insights ─────────────────────────────────────────────────────────

export function buildInsights(
  state: NetworkState,
  cfo: CFOResponse,
): NetworkInsight[] {
  const insights: NetworkInsight[] = [];

  // Top tier opportunity
  const platinumCas = state.caDirectory.filter((c) => c.networkTier === 'platinum');
  if (platinumCas.length > 0) {
    insights.push({
      id: 'insight_platinum_ca', emoji: '💎', severity: 'opportunity', category: 'opportunity',
      title: `${platinumCas.length} Platinum-tier CAs available in your network`,
      body: `Top recommendation: ${platinumCas[0].name} (${platinumCas[0].firmName}) — ${platinumCas[0].rating}★, ${platinumCas[0].yearsExperience} years experience, ${platinumCas[0].responseTimeHours}h response time.`,
      relatedEntityIds: platinumCas.slice(0, 3).map((c) => c.id),
    });
  }

  // Risk: low compliance businesses in your client base
  const riskyClients = state.businessDirectory.filter((b) => b.isMyClient && b.complianceScore < 60);
  if (riskyClients.length > 0) {
    insights.push({
      id: 'insight_risky_clients', emoji: '⚠️', severity: 'warning', category: 'risk',
      title: `${riskyClients.length} of your clients have compliance score below 60`,
      body: `${riskyClients[0].companyName} is at ${riskyClients[0].complianceScore}/100. Recommend a compliance review meeting this week to prevent notice risk.`,
      relatedEntityIds: riskyClients.slice(0, 3).map((b) => b.id),
    });
  }

  // Growth: fastest growing businesses in directory
  const fastGrowers = state.businessDirectory.filter((b) => !b.isMyBusiness).sort((a, b) => b.growthScore - a.growthScore).slice(0, 3);
  if (fastGrowers[0]) {
    insights.push({
      id: 'insight_growers', emoji: '🚀', severity: 'opportunity', category: 'growth',
      title: `${fastGrowers[0].companyName} is the fastest growing business in your network`,
      body: `Growth score ${fastGrowers[0].growthScore}/100. Industry: ${fastGrowers[0].industry}. Consider reaching out for partnership — they may need GST advisory for their expansion.`,
      relatedEntityIds: fastGrowers.map((b) => b.id),
    });
  }

  // Reputation: my tier
  if (state.myBusiness) {
    insights.push({
      id: 'insight_my_tier', emoji: TIER_GLYPH[state.myBusiness.networkTier], severity: 'info', category: 'reputation',
      title: `Your network tier is ${state.myBusiness.networkTier.toUpperCase()}`,
      body: `Network score ${state.myBusiness.networkScore}/100. ${state.myBusiness.networkTier === 'platinum' ? 'You are at the top tier — unlock premium marketplace visibility.' : `Need ${state.myBusiness.networkTier === 'gold' ? 90 : state.myBusiness.networkTier === 'silver' ? 75 : 60} to reach the next tier. Focus on on-time filings and client reviews.`}`,
      relatedEntityIds: [state.myBusiness.id],
    });
  }

  // Marketplace: trending
  const trendingCat = state.marketplace.listings.filter((l) => l.featured).slice(0, 1)[0];
  if (trendingCat) {
    insights.push({
      id: 'insight_trending', emoji: '🔥', severity: 'info', category: 'opportunity',
      title: `Trending service: ${trendingCat.title}`,
      body: `${trendingCat.providerName} (${trendingCat.providerTier.toUpperCase()}) — ${trendingCat.rating}★ from ${trendingCat.reviewCount} reviews. ${trendingCat.ordersCompleted} orders completed.`,
      relatedEntityIds: [trendingCat.providerId],
    });
  }

  // Compliance: cfo-driven
  if (cfo.dashboard.gst.upcomingDueDates.length > 0) {
    const next = cfo.dashboard.gst.upcomingDueDates[0];
    insights.push({
      id: 'insight_compliance', emoji: '⏰', severity: next.daysLeft < 3 ? 'critical' : 'warning', category: 'compliance',
      title: `${next.returnType} due in ${next.daysLeft} days`,
      body: `Late filing attracts ₹50/day late fee. Collaborate with your CA via the workspace to file on time.`,
      relatedEntityIds: ['room_ca_engagement'],
    });
  }

  return insights;
}

// ─── Module 9: Oracle Network Intelligence — NL query ─────────────────────────

export function executeNetworkQuery(text: string, state: NetworkState): NetworkQueryResult {
  const t = text.toLowerCase();
  let intent: NetworkQueryIntent = 'unknown';
  let confidence = 0.3;
  let matchResults: MatchResult[] | undefined;
  const relatedEntityIds: string[] = [];

  if (/(best|top).*(client|customer)/.test(t)) {
    intent = 'best_clients'; confidence = 0.92;
    const top = state.businessDirectory.filter((b) => b.isMyClient).sort((a, b) => b.networkScore - a.networkScore).slice(0, 5);
    return {
      rawText: text, intent, confidence,
      answer: `Your top ${top.length} clients by network score:`,
      bullets: top.map((b) => `${b.companyName} — ${b.networkScore}/100 (${b.networkTier.toUpperCase()}), ${b.industry}, ₹${inrShort(b.annualRevenue)} revenue`),
      relatedEntityIds: top.map((b) => b.id),
      spokenAck: "I've ranked your best clients by network score.",
    };
  }

  if (/(risky|late paying|problematic).*(client|customer)/.test(t)) {
    intent = 'risky_clients'; confidence = 0.9;
    const risky = state.businessDirectory.filter((b) => b.isMyClient).sort((a, b) => a.paymentScore - b.paymentScore).slice(0, 5);
    return {
      rawText: text, intent, confidence,
      answer: `Your riskiest clients by payment and compliance score:`,
      bullets: risky.map((b) => `${b.companyName} — payment ${b.paymentScore}/100, compliance ${b.complianceScore}/100, ${b.networkTier.toUpperCase()} tier`),
      relatedEntityIds: risky.map((b) => b.id),
      spokenAck: "I've flagged your riskiest clients based on payment and compliance scores.",
    };
  }

  if (/(hire|find|recommend).*(ca|chartered|accountant)/.test(t) || /gst expert/.test(t)) {
    intent = 'gst_expert'; confidence = 0.92;
    const resp = computeMatches('find_ca', text, {}, state, 5);
    matchResults = resp.results;
    return {
      rawText: text, intent, confidence,
      answer: resp.summary,
      bullets: resp.results.map((r) => `${r.name} — ${r.overallScore}/100 (${r.tier.toUpperCase()}), ${r.reasons[0]}`),
      relatedEntityIds: resp.results.map((r) => r.entityId),
      matchResults,
      spokenAck: resp.spokenAck,
    };
  }

  if (/(notice specialist|notice expert|gst notice)/.test(t)) {
    intent = 'notice_specialist'; confidence = 0.9;
    const specialists = state.caDirectory.filter((c) => c.specializations.includes('notice')).sort((a, b) => b.networkScore - a.networkScore).slice(0, 5);
    return {
      rawText: text, intent, confidence,
      answer: `Top notice specialists in your network:`,
      bullets: specialists.map((c) => `${c.name} (${c.firmName}) — ${c.noticesHandled} notices handled, ${c.rating}★, ${c.responseTimeHours}h response`),
      relatedEntityIds: specialists.map((c) => c.id),
      matchResults: specialists.map((c) => ({
        id: uid('match'), entityType: 'ca', entityId: c.id, name: c.name,
        subtitle: c.firmName, location: c.city, overallScore: c.networkScore,
        tier: c.networkTier, verified: c.verified, scores: [], reasons: [`${c.noticesHandled} notices handled`],
        recommendedAction: `Reach out to ${c.name.split(' ')[0]} for notice response.`, matchType: 'find_ca',
      })),
      spokenAck: "I've identified top notice specialists for you.",
    };
  }

  if (/(ca for|ca in|chartered accountant in|find ca)/.test(t)) {
    const cityMatch = INDIAN_CITIES.find((c) => t.includes(c.city.toLowerCase()));
    if (cityMatch) {
      intent = 'ca_in_location'; confidence = 0.88;
      const cas = state.caDirectory.filter((c) => c.city.toLowerCase() === cityMatch.city.toLowerCase()).slice(0, 5);
      return {
        rawText: text, intent, confidence,
        answer: `CAs available in ${cityMatch.city}:`,
        bullets: cas.map((c) => `${c.name} (${c.firmName}) — ${c.rating}★, ${c.specializations.map((s) => CA_SPEC_LABELS_SHORT[s]).join(', ')}`),
        relatedEntityIds: cas.map((c) => c.id),
        spokenAck: `I've found CAs in ${cityMatch.city}.`,
      };
    }
    const indMatch = INDUSTRIES.find((i) => t.includes(i.toLowerCase()));
    if (indMatch) {
      intent = 'ca_for_industry'; confidence = 0.85;
      const cas = state.caDirectory.filter((c) => c.industriesServed.some((i) => i.toLowerCase().includes(indMatch.toLowerCase()))).slice(0, 5);
      return {
        rawText: text, intent, confidence,
        answer: `CAs who serve the ${indMatch} industry:`,
        bullets: cas.map((c) => `${c.name} (${c.firmName}) — ${c.rating}★, ${c.industriesServed.join(', ')}`),
        relatedEntityIds: cas.map((c) => c.id),
        spokenAck: `I've found CAs experienced in ${indMatch}.`,
      };
    }
  }

  if (/(reliable supplier|reliable vendor|best supplier|most reliable)/.test(t)) {
    intent = 'reliable_supplier'; confidence = 0.88;
    const resp = computeMatches('find_vendor', text, {}, state, 5);
    return {
      rawText: text, intent, confidence,
      answer: resp.summary,
      bullets: resp.results.map((r) => `${r.name} — ${r.overallScore}/100 (${r.tier.toUpperCase()}), ${r.reasons[0]}`),
      relatedEntityIds: resp.results.map((r) => r.entityId),
      matchResults: resp.results,
      spokenAck: resp.spokenAck,
    };
  }

  if (/(vendors in|suppliers in|find vendors|find suppliers)/.test(t)) {
    const cityMatch = INDIAN_CITIES.find((c) => t.includes(c.city.toLowerCase()));
    intent = 'vendors_in_location'; confidence = 0.86;
    const vendors = state.vendorDirectory.filter((v) => cityMatch ? v.city.toLowerCase() === cityMatch.city.toLowerCase() : true).slice(0, 6);
    return {
      rawText: text, intent, confidence,
      answer: cityMatch ? `Vendors available in ${cityMatch.city}:` : 'Top vendors in the network:',
      bullets: vendors.map((v) => `${v.name} — ${v.category}, ${v.rating}★, ${v.networkTier.toUpperCase()}`),
      relatedEntityIds: vendors.map((v) => v.id),
      spokenAck: cityMatch ? `I've found vendors in ${cityMatch.city}.` : "I've listed top vendors in the network.",
    };
  }

  if (/(potential customer|potential client|new customer|new client|become customer)/.test(t)) {
    intent = 'potential_customers'; confidence = 0.87;
    const resp = computeMatches('find_client', text, {}, state, 5);
    return {
      rawText: text, intent, confidence,
      answer: resp.summary,
      bullets: resp.results.map((r) => `${r.name} — ${r.overallScore}/100 (${r.tier.toUpperCase()}), ${r.reasons[0]}`),
      relatedEntityIds: resp.results.map((r) => r.entityId),
      matchResults: resp.results,
      spokenAck: "I've identified businesses that could become your customers.",
    };
  }

  if (/(growing partner|fastest growing|rapidly growing)/.test(t)) {
    intent = 'growing_partners'; confidence = 0.84;
    const growers = state.businessDirectory.filter((b) => !b.isMyBusiness).sort((a, b) => b.growthScore - a.growthScore).slice(0, 5);
    return {
      rawText: text, intent, confidence,
      answer: `Fastest growing businesses in your network:`,
      bullets: growers.map((b) => `${b.companyName} — growth ${b.growthScore}/100, ${b.industry}, ${b.networkTier.toUpperCase()}`),
      relatedEntityIds: growers.map((b) => b.id),
      spokenAck: "I've ranked businesses by growth score.",
    };
  }

  if (/(best partner|strategic partner|business partner)/.test(t)) {
    intent = 'best_business_partners'; confidence = 0.83;
    const resp = computeMatches('find_partner', text, {}, state, 5);
    return {
      rawText: text, intent, confidence,
      answer: resp.summary,
      bullets: resp.results.map((r) => `${r.name} — ${r.overallScore}/100, ${r.reasons[0]}`),
      relatedEntityIds: resp.results.map((r) => r.entityId),
      matchResults: resp.results,
      spokenAck: "I've identified your best strategic partner candidates.",
    };
  }

  return {
    rawText: text, intent: 'unknown', confidence: 0.2,
    answer: "I couldn't map that to a specific network query. Try: 'Find me a GST expert', 'Who are my best clients?', 'Which supplier is most reliable?', or 'Find vendors in Delhi'.",
    bullets: [],
    relatedEntityIds: [],
    spokenAck: "I'm not sure how to interpret that network query yet.",
  };
}

// ─── Recommendations (default suggestions for the user) ───────────────────────

export function buildRecommendations(state: NetworkState): MatchResult[] {
  const out: MatchResult[] = [];

  // Recommend top CA
  const topCa = state.caDirectory[0];
  if (topCa) {
    out.push({
      id: uid('rec'), entityType: 'ca', entityId: topCa.id, name: topCa.name,
      subtitle: `${topCa.firmName} · ${topCa.city}`, industry: topCa.industriesServed[0], location: topCa.city,
      overallScore: topCa.networkScore, tier: topCa.networkTier, verified: topCa.verified,
      scores: [], reasons: [`Top-rated CA (${topCa.rating}★)`, `${topCa.yearsExperience} years experience`, `${topCa.responseTimeHours}h response`],
      recommendedAction: `Connect with ${topCa.name.split(' ')[0]} for a GST compliance review.`,
      estimatedValue: topCa.feeRange.max, matchType: 'find_ca',
    });
  }

  // Recommend top vendor
  const topVendor = state.vendorDirectory[0];
  if (topVendor) {
    out.push({
      id: uid('rec'), entityType: 'vendor', entityId: topVendor.id, name: topVendor.name,
      subtitle: `${topVendor.category} · ${topVendor.city}`, industry: topVendor.category, location: topVendor.city,
      overallScore: topVendor.networkScore, tier: topVendor.networkTier, verified: topVendor.verified,
      scores: [], reasons: [`${topVendor.rating}★ rating`, `${topVendor.clientsServed} clients served`, `${topVendor.yearsActive} years active`],
      recommendedAction: `Request a quote from ${topVendor.name}.`,
      estimatedValue: topVendor.feeRange?.max, matchType: 'find_vendor',
    });
  }

  // Recommend potential client (top growth)
  const topClient = state.businessDirectory.filter((b) => !b.isMyBusiness && !b.isMyClient).sort((a, b) => b.growthScore - a.growthScore)[0];
  if (topClient) {
    out.push({
      id: uid('rec'), entityType: 'business', entityId: topClient.id, name: topClient.companyName,
      subtitle: `${topClient.industry} · ${topClient.city}`, industry: topClient.industry, location: topClient.city,
      overallScore: topClient.growthScore, tier: topClient.networkTier, verified: topClient.verified,
      scores: [], reasons: [`${topClient.industry} sector`, `Growth ${topClient.growthScore}/100`, `₹${inrShort(topClient.annualRevenue)} revenue`],
      recommendedAction: `Reach out — ${topClient.companyName} may need your services for their growth phase.`,
      estimatedValue: topClient.annualRevenue * 0.01, matchType: 'find_client',
    });
  }

  // Recommend strategic partner
  const partner = state.businessDirectory.filter((b) => !b.isMyBusiness && !b.isMyClient && b.networkTier !== 'bronze')[0];
  if (partner) {
    out.push({
      id: uid('rec'), entityType: 'business', entityId: partner.id, name: partner.companyName,
      subtitle: `${partner.industry} · ${partner.city}`, industry: partner.industry, location: partner.city,
      overallScore: partner.networkScore, tier: partner.networkTier, verified: partner.verified,
      scores: [], reasons: [`${partner.networkTier.toUpperCase()} tier partner`, `${partner.industry} industry`, `Complementary to your services`],
      recommendedAction: `Propose a strategic referral partnership with ${partner.companyName}.`,
      matchType: 'find_partner',
    });
  }

  // Recommend funding partner
  const bank = state.vendorDirectory.find((v) => v.category === 'bank');
  if (bank) {
    out.push({
      id: uid('rec'), entityType: 'bank', entityId: bank.id, name: bank.name,
      subtitle: `${bank.category} · ${bank.city}`, industry: bank.category, location: bank.city,
      overallScore: bank.networkScore, tier: bank.networkTier, verified: bank.verified,
      scores: [], reasons: [`${bank.clientsServed} clients served`, `${bank.rating}★ rating`, 'Working capital & trade finance'],
      recommendedAction: `Explore working capital facilities with ${bank.name}.`,
      estimatedValue: bank.feeRange?.max, matchType: 'find_funding_partner',
    });
  }

  return out;
}

// ─── Reputation entries for the whole network ─────────────────────────────────

export function buildReputationEntries(state: NetworkState): ReputationEntry[] {
  const entries: ReputationEntry[] = [];
  for (const ca of state.caDirectory) {
    entries.push({
      id: `rep_${ca.id}`, entityId: ca.id, entityType: 'ca', name: ca.name,
      scores: computeReputation(ca.id, 'ca', {
        trust: ca.trustScore, compliance: ca.complianceScore, payment: ca.paymentScore,
        growth: ca.growthScore, network: ca.networkScore, rating: ca.rating, reviewCount: ca.reviewCount,
      }),
    });
  }
  for (const b of state.businessDirectory.slice(0, 12)) {
    entries.push({
      id: `rep_${b.id}`, entityId: b.id, entityType: 'business', name: b.companyName,
      scores: computeReputation(b.id, 'business', {
        trust: b.trustScore, compliance: b.complianceScore, payment: b.paymentScore,
        growth: b.growthScore, network: b.networkScore,
      }),
    });
  }
  for (const v of state.vendorDirectory.slice(0, 10)) {
    entries.push({
      id: `rep_${v.id}`, entityId: v.id, entityType: 'vendor', name: v.name,
      scores: computeReputation(v.id, 'vendor', {
        trust: v.trustScore, compliance: v.complianceScore, payment: v.paymentScore,
        growth: v.growthScore, network: v.networkScore, rating: v.rating, reviewCount: v.reviewCount,
      }),
    });
  }
  return entries;
}

// ─── Main orchestrator: getNetworkState ───────────────────────────────────────

export async function getNetworkState(): Promise<NetworkState> {
  const cfo = await generateCFOInsights(null);

  const [firm, clients, teamMembers, notices] = await Promise.all([
    db.firm.findFirst({ orderBy: { createdAt: 'asc' } }),
    db.client.findMany({ take: 30, orderBy: { createdAt: 'desc' } }),
    db.teamMember.findMany({ take: 12, orderBy: { createdAt: 'asc' } }),
    db.notice.findMany({ take: 6, orderBy: { createdAt: 'desc' } }),
  ]);

  const cas = buildCADirectory(teamMembers.map((t) => ({ id: t.id, name: t.name, email: t.email, role: t.role, department: t.department })));
  const { directory, myBusiness } = buildBusinessDirectory(
    firm ? { id: firm.id, name: firm.name, gstin: firm.gstin, state: firm.state, address: firm.address } : null,
    clients.map((c) => ({ id: c.id, tradeName: c.tradeName, legalName: c.legalName, gstin: c.gstin, state: c.state, address: c.address, entityType: c.entityType, healthScore: c.healthScore })),
    cfo,
  );
  const vendors = buildVendorDirectory();
  const myClientEntries = directory.filter((d) => d.isMyClient);
  const networkGraph = buildNetworkGraph(myBusiness, directory, cas, vendors, myClientEntries);
  const collaborationRooms = buildCollaborationRooms(
    clients.map((c) => ({ id: c.id, tradeName: c.tradeName })),
    cas,
    notices.map((n) => ({ id: n.id, clientId: n.clientId, subject: n.subject })),
  );
  const marketplace = buildMarketplace(cas, vendors);
  const feed = buildFeed(cas, directory, vendors, cfo);

  const partial: NetworkState = {
    networkGraph,
    caDirectory: cas,
    businessDirectory: directory,
    vendorDirectory: vendors,
    recommendations: [],
    collaborationRooms,
    reputation: [],
    marketplace,
    feed,
    insights: [],
    myBusiness,
    myNetwork: {
      totalConnections: 0, casCount: 0, vendorsCount: 0, clientsCount: 0, partnersCount: 0,
      avgNetworkScore: 0, myTier: 'bronze',
    },
    generatedAt: nowISO(),
    hasLiveData: cfo.hasLiveData || clients.length > 0,
    clientCount: clients.length,
    caCount: cas.length,
    vendorCount: vendors.length,
  };

  const recommendations = buildRecommendations(partial);
  const reputation = buildReputationEntries({ ...partial, recommendations });
  const insights = buildInsights({ ...partial, recommendations, reputation }, cfo);

  const myNetwork = {
    totalConnections: cas.length + vendors.length + myClientEntries.length,
    casCount: cas.filter((c) => c.firmName === 'Your Firm').length + 4, // 4 partner CAs
    vendorsCount: vendors.filter((v) => v.isMyVendor).length,
    clientsCount: myClientEntries.length,
    partnersCount: directory.filter((b) => !b.isMyBusiness && !b.isMyClient && !b.isMyClient).length,
    avgNetworkScore: Math.round((cas.reduce((a, c) => a + c.networkScore, 0) + vendors.reduce((a, v) => a + v.networkScore, 0) + myClientEntries.reduce((a, b) => a + b.networkScore, 0)) / Math.max(1, cas.length + vendors.length + myClientEntries.length)),
    myTier: myBusiness?.networkTier ?? 'bronze',
  };

  return {
    ...partial,
    recommendations,
    reputation,
    insights,
    myNetwork,
  };
}

// ─── Detail builders ──────────────────────────────────────────────────────────

export function buildBusinessDetail(state: NetworkState, businessId: string): BusinessNetworkDetail | null {
  const business = state.businessDirectory.find((b) => b.id === businessId || b.id === `business:client_${businessId}` || b.id === `business:my_${businessId}`);
  if (!business) return null;
  const rep = state.reputation.find((r) => r.entityId === business.id)?.scores ?? computeReputation(business.id, 'business', {
    trust: business.trustScore, compliance: business.complianceScore, payment: business.paymentScore,
    growth: business.growthScore, network: business.networkScore,
  });
  // Subgraph: business + its connections
  const visibleIds = new Set<string>([business.id]);
  state.networkGraph.edges.forEach((e) => {
    if (e.source === business.id) visibleIds.add(e.target);
    if (e.target === business.id) visibleIds.add(e.source);
  });
  const subNodes = state.networkGraph.nodes.filter((n) => visibleIds.has(n.id));
  const subEdges = state.networkGraph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  const cas = state.caDirectory.filter((c) => subNodes.some((n) => n.id === c.id));
  const vendors = state.vendorDirectory.filter((v) => subNodes.some((n) => n.id === v.id));
  const clients = state.businessDirectory.filter((b) => b.id !== business.id && subNodes.some((n) => n.id === b.id));
  const partners = clients.filter((b) => !b.isMyClient);
  const insights = state.insights.filter((i) => i.relatedEntityIds.includes(business.id));

  return {
    business, reputation: rep,
    connections: { cas, vendors, clients, partners },
    insights,
    graph: { nodes: subNodes, edges: subEdges, nodeCountByType: {} as any, edgeCountByType: {} as any },
  };
}

export function buildCADetail(state: NetworkState, caId: string): CANetworkDetail | null {
  const ca = state.caDirectory.find((c) => c.id === caId || c.id === `ca:${caId}`);
  if (!ca) return null;
  const rep = state.reputation.find((r) => r.entityId === ca.id)?.scores ?? computeReputation(ca.id, 'ca', {
    trust: ca.trustScore, compliance: ca.complianceScore, payment: ca.paymentScore,
    growth: ca.growthScore, network: ca.networkScore, rating: ca.rating, reviewCount: ca.reviewCount,
  });
  const clients = state.businessDirectory.slice(0, 5);
  const partners = state.caDirectory.filter((c) => c.id !== ca.id).slice(0, 4);
  const insights = state.insights.filter((i) => i.relatedEntityIds.includes(ca.id));
  const caNode = state.networkGraph.nodes.find((n) => n.id === ca.id);
  const nodes = caNode ? [caNode, ...state.networkGraph.nodes.filter((n) => {
    return state.networkGraph.edges.some((e) => (e.source === ca.id && e.target === n.id) || (e.target === ca.id && e.source === n.id));
  })] : [];
  const edges = state.networkGraph.edges.filter((e) => e.source === ca.id || e.target === ca.id);

  return {
    ca, reputation: rep, clients, partners, insights,
    graph: { nodes, edges, nodeCountByType: {} as any, edgeCountByType: {} as any },
  };
}

// ─── Format helpers for Oracle context injection ──────────────────────────────

export function formatNetworkContextBlock(state: NetworkState): string {
  const mb = state.myBusiness;
  const lines: string[] = [];
  lines.push(`## LIVE NETWORK STATE (Phase 6 — GSTPilot Network™)`);
  lines.push(`You have real-time access to India's Financial Network. Use these relationships and scores when answering network questions.`);
  lines.push('');
  lines.push(`### My Network`);
  if (mb) {
    lines.push(`- Business: ${mb.companyName} (${mb.gstin}) — ${mb.industry}, ${mb.location}`);
    lines.push(`- Network Tier: ${mb.networkTier.toUpperCase()} (score ${mb.networkScore}/100)`);
    lines.push(`- Trust ${mb.trustScore} · Compliance ${mb.complianceScore} · Payment ${mb.paymentScore} · Growth ${mb.growthScore}`);
  }
  lines.push(`- Total Connections: ${state.myNetwork.totalConnections} (${state.myNetwork.casCount} CAs, ${state.myNetwork.vendorsCount} vendors, ${state.myNetwork.clientsCount} clients, ${state.myNetwork.partnersCount} partners)`);
  lines.push(`- Avg Network Score of connections: ${state.myNetwork.avgNetworkScore}/100`);
  lines.push('');
  lines.push(`### Network Directory`);
  lines.push(`- CAs: ${state.caDirectory.length} total. Top: ${state.caDirectory.slice(0, 3).map((c) => `${c.name} (${c.networkTier.toUpperCase()}, ${c.rating}★, ${c.city})`).join('; ')}`);
  lines.push(`- Businesses: ${state.businessDirectory.length} total. Top: ${state.businessDirectory.slice(0, 3).map((b) => `${b.companyName} (${b.networkTier.toUpperCase()}, ${b.industry})`).join('; ')}`);
  lines.push(`- Vendors: ${state.vendorDirectory.length} total. Categories: ${Array.from(new Set(state.vendorDirectory.map((v) => v.category))).join(', ')}`);
  lines.push('');
  lines.push(`### Top Recommendations for the User`);
  state.recommendations.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${r.name} (${r.entityType}, ${r.tier.toUpperCase()}) — score ${r.overallScore}/100. ${r.reasons[0]}. Action: ${r.recommendedAction}`);
  });
  lines.push('');
  lines.push(`### Reputation Snapshot`);
  const topRep = state.reputation.slice(0, 5);
  topRep.forEach((r) => {
    lines.push(`  - ${r.name} (${r.entityType}): ${r.scores.tier.toUpperCase()} — network ${r.scores.networkScore}/100, trust ${r.scores.trustScore}, compliance ${r.scores.complianceScore}, payment ${r.scores.paymentScore}, growth ${r.scores.growthScore}, ${r.scores.rating}★ (${r.scores.reviewCount} reviews)`);
  });
  lines.push('');
  lines.push(`### Active Collaboration Rooms`);
  state.collaborationRooms.forEach((r) => {
    lines.push(`  - ${r.name} (${r.type}) — ${r.participants.length} participants, ${r.messageCount} msgs, ${r.pendingApprovals} pending approvals. Last: ${r.recentMessages[r.recentMessages.length - 1]?.text.slice(0, 80) ?? 'n/a'}`);
  });
  lines.push('');
  lines.push(`### Marketplace`);
  lines.push(`- ${state.marketplace.listings.length} listings across ${state.marketplace.categories.length} categories`);
  lines.push(`- ${state.marketplace.quoteRequests.length} open quote requests`);
  const featured = state.marketplace.listings.find((l) => l.featured);
  if (featured) lines.push(`- Featured: ${featured.title} by ${featured.providerName} (${featured.providerTier.toUpperCase()}) — ${featured.rating}★`);
  lines.push('');
  lines.push(`### Network Insights`);
  state.insights.slice(0, 5).forEach((i) => {
    lines.push(`  - ${i.emoji} ${i.title}: ${i.body}`);
  });
  lines.push('');
  lines.push(`When answering network questions (find CA, find vendor, find clients, recommend partners, who is risky, who is best), use these live scores and recommendations. Always cite specific names, tiers, scores, and locations. For matching questions, recommend the top pick with reasons and a concrete next action.`);

  return lines.join('\n');
}

// ─── Quick NL query examples for UI chips ─────────────────────────────────────

export const QUICK_NETWORK_QUERIES: { label: string; text: string; intent: NetworkQueryIntent }[] = [
  { label: 'Find me a GST expert', text: 'Find me a GST expert', intent: 'gst_expert' },
  { label: 'Find a CA in Mumbai', text: 'Find a CA in Mumbai', intent: 'ca_in_location' },
  { label: 'Notice specialist', text: 'I need a notice specialist', intent: 'notice_specialist' },
  { label: 'Find vendors in Delhi', text: 'Find vendors in Delhi', intent: 'vendors_in_location' },
  { label: 'Who are my best clients?', text: 'Who are my best clients?', intent: 'best_clients' },
  { label: 'Risky clients', text: 'Show me risky clients', intent: 'risky_clients' },
  { label: 'Most reliable supplier', text: 'Which supplier is most reliable?', intent: 'reliable_supplier' },
  { label: 'Potential customers', text: 'Which businesses can become customers?', intent: 'potential_customers' },
  { label: 'Fastest growing partners', text: 'Which partners are growing rapidly?', intent: 'growing_partners' },
  { label: 'Best business partners', text: 'Who are my best business partners?', intent: 'best_business_partners' },
];

// Re-export labels for UI consumers
export { NETWORK_NODE_LABELS, TIER_COLOR, TIER_GLYPH };
