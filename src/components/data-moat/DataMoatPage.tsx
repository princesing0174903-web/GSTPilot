'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Database,
  Shield,
  Brain,
  Lock,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
  FileText,
  Users,
  Building2,
  Zap,
  Search,
  Sparkles,
  Key,
  HardDrive,
  Fingerprint,
  Layers,
  Activity,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  Scale,
  HeartPulse,
  Cpu,
  Network,
  ShieldCheck,
  FileCheck,
  RefreshCw,
  Layers2,
  Link2,
  CircleDot,
  BarChart4,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
  useFireDocuments,
  useFireActivities,
} from '@/hooks/use-firestore';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const formatINR = (num: number): string => {
  const str = num.toLocaleString('en-IN');
  return '₹' + str;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — 8+ Client Profiles
// ═══════════════════════════════════════════════════════════════════════════════

interface DemoClientProfile {
  id: string;
  tradeName: string;
  legalName: string;
  gstin: string;
  pan: string;
  industry: string;
  location: string;
  state: string;
  registrationDate: string;
  entityType: string;
  annualRevenue: number;
  taxPaid: number;
  invoiceVolume: number;
  paymentBehavior: 'Excellent' | 'Good' | 'Average' | 'Poor';
  filingRegularity: number;
  noticesReceived: number;
  returnsFiled: number;
  complianceScore: number;
  clientSince: string;
  totalInteractions: number;
  lastActivity: string;
  healthScore: number;
  revenueTrend: number[];
  clientCountTrend: number[];
  taxGrowthPct: number;
  avgResponseTime: string;
  preferredChannel: string;
  lastContact: string;
  profileCompleteness: number;
  // data sources
  gstReturnsCount: number;
  invoicesCount: number;
  noticesCount: number;
  documentsCount: number;
  // memory data
  avgInvoiceValue: number;
  topClientsByValue: string[];
  paymentPatterns: string;
  filingHistory: string;
  compliancePatterns: string;
  taxPaymentRegularity: string;
  noticeHistory: string;
  resolutionPatterns: string;
  riskFactors: string;
  onTimeRate: number;
  avgDelay: string;
  seasonalPatterns: string;
  scoreHistory: number[];
  keyEvents: string[];
  riskEpisodes: number;
  revenueGrowthRate: number;
  clientAcquisition: string;
  marketExpansion: string;
  cashFlowCycles: string;
  peakPeriods: string;
  lowPeriods: string;
  // vault data
  dataQualityScore: number;
  recordsLastUpdated: string;
  dataFreshness: 'fresh' | 'stale' | 'outdated';
}

const DEMO_CLIENTS: DemoClientProfile[] = [
  {
    id: 'c1',
    tradeName: 'Sharma Enterprises',
    legalName: 'Sharma Enterprises Pvt. Ltd.',
    gstin: '07AABCS1234F1ZH',
    pan: 'AABCS1234F',
    industry: 'Manufacturing',
    location: 'New Delhi, Delhi',
    state: 'Delhi',
    registrationDate: '2018-03-15',
    entityType: 'Private Limited',
    annualRevenue: 45600000,
    taxPaid: 5472000,
    invoiceVolume: 1234,
    paymentBehavior: 'Excellent',
    filingRegularity: 96,
    noticesReceived: 1,
    returnsFiled: 48,
    complianceScore: 94,
    clientSince: '2020-06-10',
    totalInteractions: 342,
    lastActivity: '2025-03-04',
    healthScore: 92,
    revenueTrend: [32, 35, 38, 42, 40, 45],
    clientCountTrend: [12, 14, 16, 18, 20, 22],
    taxGrowthPct: 18.5,
    avgResponseTime: '2 hours',
    preferredChannel: 'WhatsApp',
    lastContact: '04/03/2025',
    profileCompleteness: 92,
    gstReturnsCount: 48,
    invoicesCount: 1234,
    noticesCount: 1,
    documentsCount: 289,
    avgInvoiceValue: 36950,
    topClientsByValue: ['Rajesh Textiles', 'Metro Distributors', 'Singh & Sons'],
    paymentPatterns: 'Consistent payer, 95% on-time',
    filingHistory: 'Regular monthly filer since 2020',
    compliancePatterns: 'Proactive compliance, never missed deadline',
    taxPaymentRegularity: '98% on-time DRC-03 payments',
    noticeHistory: '1 notice in 2023 — resolved within 15 days',
    resolutionPatterns: 'Fast resolver — avg 12 days',
    riskFactors: 'Seasonal cash flow dip in Q2',
    onTimeRate: 95,
    avgDelay: '3 days',
    seasonalPatterns: 'Higher volume Oct-Mar, lower Apr-Sep',
    scoreHistory: [78, 82, 85, 88, 90, 92],
    keyEvents: ['GST audit passed 2023', 'New branch opened 2024', 'Revenue milestone ₹5Cr'],
    riskEpisodes: 1,
    revenueGrowthRate: 18.5,
    clientAcquisition: '+4 clients in last quarter',
    marketExpansion: 'Expanded to NCR region',
    cashFlowCycles: '45-day operating cycle',
    peakPeriods: 'October–March',
    lowPeriods: 'April–June',
    dataQualityScore: 96,
    recordsLastUpdated: '2025-03-04',
    dataFreshness: 'fresh',
  },
  {
    id: 'c2',
    tradeName: 'Patel & Associates',
    legalName: 'Patel & Associates LLP',
    gstin: '24AABCP5678G2ZK',
    pan: 'AABCP5678G',
    industry: 'Professional Services',
    location: 'Ahmedabad, Gujarat',
    state: 'Gujarat',
    registrationDate: '2019-07-22',
    entityType: 'LLP',
    annualRevenue: 12800000,
    taxPaid: 1536000,
    invoiceVolume: 456,
    paymentBehavior: 'Good',
    filingRegularity: 88,
    noticesReceived: 2,
    returnsFiled: 36,
    complianceScore: 85,
    clientSince: '2021-01-15',
    totalInteractions: 198,
    lastActivity: '2025-03-03',
    healthScore: 84,
    revenueTrend: [8, 9, 10, 11, 12, 13],
    clientCountTrend: [8, 9, 10, 11, 12, 12],
    taxGrowthPct: 12.3,
    avgResponseTime: '4 hours',
    preferredChannel: 'Email',
    lastContact: '03/03/2025',
    profileCompleteness: 78,
    gstReturnsCount: 36,
    invoicesCount: 456,
    noticesCount: 2,
    documentsCount: 156,
    avgInvoiceValue: 28070,
    topClientsByValue: ['Gujarat Corp', 'Adani Infra', 'Reliance Retail'],
    paymentPatterns: 'Generally on-time, occasional 5-7 day delays',
    filingHistory: 'Consistent quarterly filer',
    compliancePatterns: 'Good compliance, missed 2 deadlines in 2023',
    taxPaymentRegularity: '88% on-time DRC-03 payments',
    noticeHistory: '2 notices — both related to late filing penalties',
    resolutionPatterns: 'Moderate resolver — avg 25 days',
    riskFactors: 'Cash flow constraints in Q1',
    onTimeRate: 88,
    avgDelay: '5 days',
    seasonalPatterns: 'Steady year-round, slight dip in Q1',
    scoreHistory: [70, 74, 78, 80, 82, 84],
    keyEvents: ['LLP conversion 2022', 'New partner onboarded 2024'],
    riskEpisodes: 2,
    revenueGrowthRate: 12.3,
    clientAcquisition: '+2 clients in last quarter',
    marketExpansion: 'Considering Surat expansion',
    cashFlowCycles: '60-day operating cycle',
    peakPeriods: 'January–March',
    lowPeriods: 'July–September',
    dataQualityScore: 82,
    recordsLastUpdated: '2025-03-03',
    dataFreshness: 'fresh',
  },
  {
    id: 'c3',
    tradeName: 'Krishna Trading Co.',
    legalName: 'Krishna Trading Company',
    gstin: '27AABCK9012H3ZL',
    pan: 'AABCK9012H',
    industry: 'Trading',
    location: 'Mumbai, Maharashtra',
    state: 'Maharashtra',
    registrationDate: '2017-11-05',
    entityType: 'Proprietorship',
    annualRevenue: 8900000,
    taxPaid: 1068000,
    invoiceVolume: 876,
    paymentBehavior: 'Average',
    filingRegularity: 72,
    noticesReceived: 4,
    returnsFiled: 30,
    complianceScore: 68,
    clientSince: '2020-09-20',
    totalInteractions: 156,
    lastActivity: '2025-02-28',
    healthScore: 65,
    revenueTrend: [7, 6, 8, 7, 9, 9],
    clientCountTrend: [5, 5, 6, 6, 7, 7],
    taxGrowthPct: 5.2,
    avgResponseTime: '1 day',
    preferredChannel: 'Phone',
    lastContact: '28/02/2025',
    profileCompleteness: 65,
    gstReturnsCount: 30,
    invoicesCount: 876,
    noticesCount: 4,
    documentsCount: 98,
    avgInvoiceValue: 10160,
    topClientsByValue: ['Metro Mart', 'City Wholesale', 'Quick Trade'],
    paymentPatterns: 'Irregular — avg 15 day delays',
    filingHistory: 'Inconsistent — missed 4 filings in 2024',
    compliancePatterns: 'Reactive compliance, responds to notices only',
    taxPaymentRegularity: '72% on-time',
    noticeHistory: '4 notices — 2 for late filing, 1 for ITC mismatch, 1 for non-filing',
    resolutionPatterns: 'Slow resolver — avg 45 days',
    riskFactors: 'Chronic late filer, ITC mismatch issues',
    onTimeRate: 65,
    avgDelay: '15 days',
    seasonalPatterns: 'High volume during Diwali season',
    scoreHistory: [80, 72, 68, 64, 66, 65],
    keyEvents: ['ITC audit 2023', 'Penalty for non-filing 2024'],
    riskEpisodes: 4,
    revenueGrowthRate: 5.2,
    clientAcquisition: 'Stable — no new clients',
    marketExpansion: 'No expansion plans',
    cashFlowCycles: '90-day operating cycle',
    peakPeriods: 'October–November',
    lowPeriods: 'March–May',
    dataQualityScore: 68,
    recordsLastUpdated: '2025-02-28',
    dataFreshness: 'stale',
  },
  {
    id: 'c4',
    tradeName: 'Gupta Infrastructure',
    legalName: 'Gupta Infrastructure Ltd.',
    gstin: '06AABCG3456I4ZM',
    pan: 'AABCG3456I',
    industry: 'Construction',
    location: 'Gurugram, Haryana',
    state: 'Haryana',
    registrationDate: '2018-01-10',
    entityType: 'Limited Company',
    annualRevenue: 124000000,
    taxPaid: 14880000,
    invoiceVolume: 2340,
    paymentBehavior: 'Excellent',
    filingRegularity: 98,
    noticesReceived: 0,
    returnsFiled: 54,
    complianceScore: 98,
    clientSince: '2019-04-01',
    totalInteractions: 489,
    lastActivity: '2025-03-05',
    healthScore: 97,
    revenueTrend: [85, 92, 98, 105, 112, 124],
    clientCountTrend: [25, 28, 32, 35, 38, 42],
    taxGrowthPct: 22.8,
    avgResponseTime: '1 hour',
    preferredChannel: 'Portal',
    lastContact: '05/03/2025',
    profileCompleteness: 98,
    gstReturnsCount: 54,
    invoicesCount: 2340,
    noticesCount: 0,
    documentsCount: 567,
    avgInvoiceValue: 52990,
    topClientsByValue: ['DLF Group', 'Godrej Properties', 'Sobha Ltd.'],
    paymentPatterns: 'Exemplary — 99% on-time, early payer',
    filingHistory: 'Never missed a filing since 2018',
    compliancePatterns: 'Best-in-class, proactive compliance posture',
    taxPaymentRegularity: '99% on-time, often pays before due date',
    noticeHistory: 'Zero notices in 7 years',
    resolutionPatterns: 'N/A — no issues to resolve',
    riskFactors: 'Minimal — diversified client base reduces risk',
    onTimeRate: 99,
    avgDelay: '0 days',
    seasonalPatterns: 'Consistent high volume, peaks in Q4',
    scoreHistory: [88, 90, 92, 94, 96, 97],
    keyEvents: ['₹100Cr revenue milestone 2024', 'ISO certification', 'Green building projects'],
    riskEpisodes: 0,
    revenueGrowthRate: 22.8,
    clientAcquisition: '+6 clients in last quarter',
    marketExpansion: 'Pan-India expansion, Noida & Pune offices',
    cashFlowCycles: '30-day operating cycle',
    peakPeriods: 'October–March',
    lowPeriods: 'July–August (monsoon)',
    dataQualityScore: 98,
    recordsLastUpdated: '2025-03-05',
    dataFreshness: 'fresh',
  },
  {
    id: 'c5',
    tradeName: 'Mehta Textiles',
    legalName: 'Mehta Textiles Pvt. Ltd.',
    gstin: '33AABCM7890J5ZN',
    pan: 'AABCM7890J',
    industry: 'Textiles',
    location: 'Coimbatore, Tamil Nadu',
    state: 'Tamil Nadu',
    registrationDate: '2019-05-18',
    entityType: 'Private Limited',
    annualRevenue: 67800000,
    taxPaid: 8136000,
    invoiceVolume: 1876,
    paymentBehavior: 'Good',
    filingRegularity: 91,
    noticesReceived: 1,
    returnsFiled: 42,
    complianceScore: 88,
    clientSince: '2020-12-01',
    totalInteractions: 267,
    lastActivity: '2025-03-02',
    healthScore: 86,
    revenueTrend: [48, 52, 55, 58, 62, 68],
    clientCountTrend: [15, 16, 18, 19, 21, 23],
    taxGrowthPct: 14.7,
    avgResponseTime: '3 hours',
    preferredChannel: 'Email',
    lastContact: '02/03/2025',
    profileCompleteness: 85,
    gstReturnsCount: 42,
    invoicesCount: 1876,
    noticesCount: 1,
    documentsCount: 345,
    avgInvoiceValue: 36140,
    topClientsByValue: ['Nalli Silks', "Pothy's Silks", 'RMKV'],
    paymentPatterns: 'Good — occasional 3-5 day delays in Q1',
    filingHistory: 'Regular filer, one late filing in 2023',
    compliancePatterns: 'Strong compliance culture, dedicated GST team',
    taxPaymentRegularity: '93% on-time',
    noticeHistory: '1 notice — minor ITC discrepancy, resolved quickly',
    resolutionPatterns: 'Good resolver — avg 10 days',
    riskFactors: 'Export dependency creates GST refund complexity',
    onTimeRate: 91,
    avgDelay: '4 days',
    seasonalPatterns: 'Festival season peaks (Diwali, Pongal)',
    scoreHistory: [72, 76, 80, 83, 85, 86],
    keyEvents: ['Export house status 2023', 'New weaving unit 2024'],
    riskEpisodes: 1,
    revenueGrowthRate: 14.7,
    clientAcquisition: '+3 clients in last quarter',
    marketExpansion: 'International exports growing',
    cashFlowCycles: '60-day cycle, longer for export receivables',
    peakPeriods: 'September–February',
    lowPeriods: 'April–June',
    dataQualityScore: 89,
    recordsLastUpdated: '2025-03-02',
    dataFreshness: 'fresh',
  },
  {
    id: 'c6',
    tradeName: 'Reddy Pharma Distributors',
    legalName: 'Reddy Pharma Distribution Pvt. Ltd.',
    gstin: '29AABCR1234K6ZP',
    pan: 'AABCR1234K',
    industry: 'Pharmaceutical Distribution',
    location: 'Bengaluru, Karnataka',
    state: 'Karnataka',
    registrationDate: '2020-02-14',
    entityType: 'Private Limited',
    annualRevenue: 34500000,
    taxPaid: 4140000,
    invoiceVolume: 3456,
    paymentBehavior: 'Good',
    filingRegularity: 85,
    noticesReceived: 2,
    returnsFiled: 36,
    complianceScore: 82,
    clientSince: '2021-07-01',
    totalInteractions: 210,
    lastActivity: '2025-03-01',
    healthScore: 80,
    revenueTrend: [24, 26, 28, 30, 32, 35],
    clientCountTrend: [10, 11, 12, 13, 14, 15],
    taxGrowthPct: 10.8,
    avgResponseTime: '6 hours',
    preferredChannel: 'WhatsApp',
    lastContact: '01/03/2025',
    profileCompleteness: 72,
    gstReturnsCount: 36,
    invoicesCount: 3456,
    noticesCount: 2,
    documentsCount: 234,
    avgInvoiceValue: 9982,
    topClientsByValue: ['Apollo Pharmacy', 'MedPlus', 'Netmeds'],
    paymentPatterns: 'High volume, small ticket — net 30 terms',
    filingHistory: 'Consistent, 2 late filings in 2024',
    compliancePatterns: 'Adequate compliance, room for improvement',
    taxPaymentRegularity: '85% on-time',
    noticeHistory: '2 notices — HSN code mismatch issues',
    resolutionPatterns: 'Moderate — avg 20 days',
    riskFactors: 'CDSCO compliance overlap, HSN code accuracy',
    onTimeRate: 82,
    avgDelay: '7 days',
    seasonalPatterns: 'Flu season peaks (Jul-Sep, Jan-Feb)',
    scoreHistory: [68, 72, 74, 77, 79, 80],
    keyEvents: ['Cold chain facility 2023', 'WHO-GDP certification 2024'],
    riskEpisodes: 2,
    revenueGrowthRate: 10.8,
    clientAcquisition: '+2 hospital chains in 2024',
    marketExpansion: 'Mysore & Hubli expansion planned',
    cashFlowCycles: '45-day cycle with distributor credit',
    peakPeriods: 'January–March, July–September',
    lowPeriods: 'April–June',
    dataQualityScore: 75,
    recordsLastUpdated: '2025-03-01',
    dataFreshness: 'stale',
  },
  {
    id: 'c7',
    tradeName: 'Singh Agro Industries',
    legalName: 'Singh Agro Industries Ltd.',
    gstin: '10AABCS5678L7ZQ',
    pan: 'AABCS5678L',
    industry: 'Agriculture & Food Processing',
    location: 'Patna, Bihar',
    state: 'Bihar',
    registrationDate: '2021-09-01',
    entityType: 'Limited Company',
    annualRevenue: 28900000,
    taxPaid: 2312000,
    invoiceVolume: 567,
    paymentBehavior: 'Average',
    filingRegularity: 78,
    noticesReceived: 3,
    returnsFiled: 24,
    complianceScore: 72,
    clientSince: '2022-03-15',
    totalInteractions: 98,
    lastActivity: '2025-02-25',
    healthScore: 70,
    revenueTrend: [18, 20, 22, 24, 26, 29],
    clientCountTrend: [6, 7, 7, 8, 8, 9],
    taxGrowthPct: 8.4,
    avgResponseTime: '2 days',
    preferredChannel: 'Phone',
    lastContact: '25/02/2025',
    profileCompleteness: 58,
    gstReturnsCount: 24,
    invoicesCount: 567,
    noticesCount: 3,
    documentsCount: 78,
    avgInvoiceValue: 50970,
    topClientsByValue: ['Bihar State Co-op', 'APMC Mandi', 'ITC Foods'],
    paymentPatterns: 'Seasonal — delayed during harvest season',
    filingHistory: 'Irregular — often files in last week',
    compliancePatterns: 'Reactive compliance approach',
    taxPaymentRegularity: '78% on-time',
    noticeHistory: '3 notices — e-way bill violations, ITC mismatch',
    resolutionPatterns: 'Slow — avg 35 days',
    riskFactors: 'E-way bill compliance, seasonal cash crunch',
    onTimeRate: 72,
    avgDelay: '12 days',
    seasonalPatterns: 'Kharif & Rabi harvest peaks',
    scoreHistory: [55, 60, 64, 67, 69, 70],
    keyEvents: ['MSP policy impact 2024', 'New cold storage unit'],
    riskEpisodes: 3,
    revenueGrowthRate: 8.4,
    clientAcquisition: '+1 client in last quarter',
    marketExpansion: 'Planning Jharkhand entry',
    cashFlowCycles: '120-day cycle, heavily seasonal',
    peakPeriods: 'October–February (Rabi harvest)',
    lowPeriods: 'March–June',
    dataQualityScore: 65,
    recordsLastUpdated: '2025-02-25',
    dataFreshness: 'stale',
  },
  {
    id: 'c8',
    tradeName: 'Desai Tech Solutions',
    legalName: 'Desai Tech Solutions Pvt. Ltd.',
    gstin: '27AABCD9012M8ZR',
    pan: 'AABCD9012M',
    industry: 'IT & Software Services',
    location: 'Pune, Maharashtra',
    state: 'Maharashtra',
    registrationDate: '2020-06-08',
    entityType: 'Private Limited',
    annualRevenue: 18900000,
    taxPaid: 2268000,
    invoiceVolume: 324,
    paymentBehavior: 'Excellent',
    filingRegularity: 100,
    noticesReceived: 0,
    returnsFiled: 48,
    complianceScore: 96,
    clientSince: '2021-03-01',
    totalInteractions: 178,
    lastActivity: '2025-03-05',
    healthScore: 95,
    revenueTrend: [10, 12, 14, 15, 17, 19],
    clientCountTrend: [4, 5, 6, 7, 8, 9],
    taxGrowthPct: 19.2,
    avgResponseTime: '1 hour',
    preferredChannel: 'Portal',
    lastContact: '05/03/2025',
    profileCompleteness: 95,
    gstReturnsCount: 48,
    invoicesCount: 324,
    noticesCount: 0,
    documentsCount: 198,
    avgInvoiceValue: 58330,
    topClientsByValue: ['TCS', 'Infosys', 'Wipro'],
    paymentPatterns: 'Always on-time, automated payments',
    filingHistory: 'Perfect filing record — never missed',
    compliancePatterns: 'Tech-forward, automated compliance workflows',
    taxPaymentRegularity: '100% on-time',
    noticeHistory: 'Zero notices',
    resolutionPatterns: 'N/A — no issues',
    riskFactors: 'Minimal — export services have zero GST liability',
    onTimeRate: 100,
    avgDelay: '0 days',
    seasonalPatterns: 'Steady — subscription-based revenue',
    scoreHistory: [85, 88, 90, 92, 94, 95],
    keyEvents: ['CMMi Level 3 certification', 'US client acquisition 2024'],
    riskEpisodes: 0,
    revenueGrowthRate: 19.2,
    clientAcquisition: '+2 international clients',
    marketExpansion: 'US & UK market expansion',
    cashFlowCycles: '30-day cycle, subscription revenue',
    peakPeriods: 'Consistent year-round',
    lowPeriods: 'None',
    dataQualityScore: 94,
    recordsLastUpdated: '2025-03-05',
    dataFreshness: 'fresh',
  },
  {
    id: 'c9',
    tradeName: 'Joshi Metal Works',
    legalName: 'Joshi Metal Works Pvt. Ltd.',
    gstin: '09AABCJ3456N9ZS',
    pan: 'AABCJ3456N',
    industry: 'Metal & Steel',
    location: 'Lucknow, Uttar Pradesh',
    state: 'Uttar Pradesh',
    registrationDate: '2018-08-20',
    entityType: 'Private Limited',
    annualRevenue: 56700000,
    taxPaid: 6804000,
    invoiceVolume: 1589,
    paymentBehavior: 'Good',
    filingRegularity: 90,
    noticesReceived: 1,
    returnsFiled: 45,
    complianceScore: 89,
    clientSince: '2019-11-01',
    totalInteractions: 312,
    lastActivity: '2025-03-04',
    healthScore: 88,
    revenueTrend: [38, 42, 45, 48, 52, 57],
    clientCountTrend: [10, 12, 14, 15, 17, 19],
    taxGrowthPct: 16.3,
    avgResponseTime: '3 hours',
    preferredChannel: 'Email',
    lastContact: '04/03/2025',
    profileCompleteness: 82,
    gstReturnsCount: 45,
    invoicesCount: 1589,
    noticesCount: 1,
    documentsCount: 267,
    avgInvoiceValue: 35680,
    topClientsByValue: ['Tata Steel', 'JSW Steel', 'SAIL'],
    paymentPatterns: 'Reliable — 90% on-time, some Q4 delays',
    filingHistory: 'Consistent monthly filer',
    compliancePatterns: 'Good compliance, dedicated accounts team',
    taxPaymentRegularity: '90% on-time',
    noticeHistory: '1 notice — minor e-way bill discrepancy',
    resolutionPatterns: 'Fast — avg 8 days',
    riskFactors: 'Steel price volatility affects cash flow',
    onTimeRate: 90,
    avgDelay: '4 days',
    seasonalPatterns: 'Construction season drives peaks',
    scoreHistory: [75, 78, 82, 84, 86, 88],
    keyEvents: ['New furnace installed 2024', 'ISI certification renewed'],
    riskEpisodes: 1,
    revenueGrowthRate: 16.3,
    clientAcquisition: '+3 infrastructure clients',
    marketExpansion: 'Kanpur unit planned',
    cashFlowCycles: '45-day cycle',
    peakPeriods: 'October–March',
    lowPeriods: 'July–September',
    dataQualityScore: 87,
    recordsLastUpdated: '2025-03-04',
    dataFreshness: 'fresh',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SVG SPARKLINE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function Sparkline({ data, color = '#10b981', width = 120, height = 36 }: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) / (data.length - 1) * width}
          cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG BAR CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function BarChart({ data, labels, color = '#10b981', width = 300, height = 140 }: {
  data: number[];
  labels: string[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  const barWidth = (width - 40) / data.length - 8;
  const chartHeight = height - 30;

  return (
    <svg width={width} height={height} className="inline-block">
      {data.map((v, i) => {
        const barH = (v / max) * (chartHeight - 10);
        const x = 30 + i * ((width - 40) / data.length) + 4;
        const y = chartHeight - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill={color}
              opacity={0.7 + (i / data.length) * 0.3}
              rx="3"
            />
            <text
              x={x + barWidth / 2}
              y={height - 5}
              textAnchor="middle"
              className="text-[9px] fill-slate-500"
            >
              {labels[i]}
            </text>
            <text
              x={x + barWidth / 2}
              y={y - 3}
              textAnchor="middle"
              className="text-[8px] fill-slate-600 font-medium"
            >
              {(v / 1000).toFixed(0)}K
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG GAUGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function GaugeChart({ value, maxValue = 100, size = 180 }: {
  value: number;
  maxValue?: number;
  size?: number;
}) {
  const pct = value / maxValue;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 20;
  const startAngle = -225;
  const endAngle = 45;
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + pct * totalAngle;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const pStart = polarToCartesian(startAngle);
  const pEnd = polarToCartesian(endAngle);
  const pCurrent = polarToCartesian(currentAngle);
  const largeArcFlag = pct > 0.5 ? 1 : 0;

  const bgColor = '#e2e8f0';
  const fillColor = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size / 2 + 30}>
      {/* Background arc */}
      <path
        d={`M ${pStart.x} ${pStart.y} A ${r} ${r} 0 1 1 ${pEnd.x} ${pEnd.y}`}
        fill="none"
        stroke={bgColor}
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d={`M ${pStart.x} ${pStart.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${pCurrent.x} ${pCurrent.y}`}
        fill="none"
        stroke={fillColor}
        strokeWidth="14"
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
      {/* Value text */}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        className="text-3xl font-bold"
        fill={fillColor}
      >
        {value}
      </text>
      <text
        x={cx}
        y={cy + 15}
        textAnchor="middle"
        className="text-[10px] fill-slate-400"
      >
        Moat Strength
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED DATA FLOW VISUALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function DataFlowVisualization() {
  const sources = [
    { label: 'GST Returns', icon: FileCheck, x: 40, y: 30 },
    { label: 'Invoices', icon: FileText, x: 40, y: 90 },
    { label: 'E-Way Bills', icon: Layers, x: 40, y: 150 },
    { label: 'Notices', icon: Scale, x: 40, y: 210 },
    { label: 'Bank Statements', icon: Building2, x: 40, y: 270 },
    { label: 'TDS Data', icon: IndianRupee, x: 40, y: 330 },
  ];

  return (
    <div className="relative w-full h-[380px] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/30">
      <svg className="absolute inset-0 w-full h-full">
        {/* Connection lines from sources to center */}
        {sources.map((s, i) => (
          <g key={i}>
            <line
              x1={s.x + 90}
              y1={s.y + 15}
              x2="280"
              y2="180"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity="0.3"
            />
            {/* Animated dot */}
            <circle r="3" fill="#10b981" opacity="0.8">
              <animateMotion
                dur={`${2 + i * 0.3}s`}
                repeatCount="indefinite"
                path={`M${s.x + 90},${s.y + 15} L280,180`}
              />
            </circle>
          </g>
        ))}
        {/* Center hub */}
        <circle cx="280" cy="180" r="45" fill="#10b981" opacity="0.1" />
        <circle cx="280" cy="180" r="35" fill="#10b981" opacity="0.15" />
        <circle cx="280" cy="180" r="25" fill="#10b981" opacity="0.2" />
        {/* Outgoing lines to insights */}
        <line x1="325" y1="155" x2="460" y2="60" stroke="#059669" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.3" />
        <line x1="325" y1="180" x2="460" y2="140" stroke="#059669" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.3" />
        <line x1="325" y1="205" x2="460" y2="220" stroke="#059669" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.3" />
        <line x1="325" y1="180" x2="460" y2="300" stroke="#059669" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.3" />
        {/* Animated outgoing dots */}
        <circle r="3" fill="#059669" opacity="0.8">
          <animateMotion dur="3s" repeatCount="indefinite" path="M325,155 L460,60" />
        </circle>
        <circle r="3" fill="#059669" opacity="0.8">
          <animateMotion dur="2.5s" repeatCount="indefinite" path="M325,180 L460,140" />
        </circle>
        <circle r="3" fill="#059669" opacity="0.8">
          <animateMotion dur="3.5s" repeatCount="indefinite" path="M325,205 L460,220" />
        </circle>
        <circle r="3" fill="#059669" opacity="0.8">
          <animateMotion dur="2.8s" repeatCount="indefinite" path="M325,180 L460,300" />
        </circle>
      </svg>
      {/* Source labels */}
      {sources.map((s, i) => (
        <div
          key={i}
          className="absolute flex items-center gap-2 text-xs font-medium text-slate-600"
          style={{ left: s.x, top: s.y }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-100">
            <s.icon className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <span>{s.label}</span>
        </div>
      ))}
      {/* Center label */}
      <div className="absolute flex flex-col items-center justify-center" style={{ left: 248, top: 158 }}>
        <Database className="h-6 w-6 text-emerald-600 mb-1" />
        <span className="text-[10px] font-bold text-emerald-700">DATA MOAT</span>
      </div>
      {/* Output labels */}
      {[
        { label: 'Predictions', top: 42, icon: TrendingUp },
        { label: 'Risk Scores', top: 122, icon: ShieldCheck },
        { label: 'Compliance AI', top: 202, icon: Brain },
        { label: 'Revenue Intel', top: 282, icon: BarChart3 },
      ].map((o, i) => (
        <div
          key={i}
          className="absolute flex items-center gap-2 text-xs font-medium text-emerald-700"
          style={{ left: 460, top: o.top }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 shadow-sm border border-emerald-200">
            <o.icon className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <span>{o.label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPANDABLE MEMORY SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function MemorySection({ title, icon: Icon, color, insights, isExpanded, onToggle }: {
  title: string;
  icon: React.ElementType;
  color: string;
  insights: { label: string; value: string }[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-slate-200 rounded-xl overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/80 transition-colors"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: color + '15' }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <span className="font-semibold text-sm text-slate-800 flex-1 text-left">{title}</span>
        <Badge variant="secondary" className="text-[10px] bg-slate-100">
          {insights.length} insights
        </Badge>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50/80">
                  <span className="text-xs text-slate-600">{insight.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{insight.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: 360° BUSINESS PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function BusinessProfileTab({ selectedClient }: { selectedClient: DemoClientProfile }) {
  const c = selectedClient;

  const healthColor = c.healthScore >= 90 ? 'text-emerald-600' : c.healthScore >= 70 ? 'text-amber-600' : 'text-red-600';
  const healthBg = c.healthScore >= 90 ? 'bg-emerald-50 border-emerald-200' : c.healthScore >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-4">
      {/* Data Completeness + Sources Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Profile Completeness</span>
              <span className="text-lg font-bold text-emerald-600">{c.profileCompleteness}%</span>
            </div>
            <Progress value={c.profileCompleteness} className="h-2" />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Profile {c.profileCompleteness}% Complete
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">Data Sources</div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[11px]">
                <FileCheck className="h-3 w-3 mr-1" />
                GST Returns ({c.gstReturnsCount})
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[11px]">
                <FileText className="h-3 w-3 mr-1" />
                Invoices ({c.invoicesCount})
              </Badge>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 text-[11px]">
                <Scale className="h-3 w-3 mr-1" />
                Notices ({c.noticesCount})
              </Badge>
              <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 text-[11px]">
                <Layers className="h-3 w-3 mr-1" />
                Documents ({c.documentsCount})
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Business Identity */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Business Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {[
                { label: 'Name', value: c.tradeName },
                { label: 'Legal Name', value: c.legalName },
                { label: 'GSTIN', value: c.gstin },
                { label: 'PAN', value: c.pan },
                { label: 'Industry', value: c.industry },
                { label: 'Location', value: c.location },
                { label: 'Entity Type', value: c.entityType },
                { label: 'Reg. Date', value: formatDate(c.registrationDate) },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  <span className="text-[11px] font-medium text-slate-800 text-right max-w-[180px] truncate">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Financial Profile */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Financial Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {[
                { label: 'Annual Revenue', value: formatINR(c.annualRevenue) },
                { label: 'Tax Paid (FY)', value: formatINR(c.taxPaid) },
                { label: 'Invoice Volume', value: c.invoiceVolume.toLocaleString('en-IN') },
                { label: 'Payment Behavior', value: c.paymentBehavior, highlight: true },
                { label: 'Avg Invoice Value', value: formatINR(c.avgInvoiceValue) },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  {item.highlight ? (
                    <Badge className={`text-[10px] ${c.paymentBehavior === 'Excellent' ? 'bg-emerald-50 text-emerald-700' : c.paymentBehavior === 'Good' ? 'bg-blue-50 text-blue-700' : c.paymentBehavior === 'Average' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                      {item.value}
                    </Badge>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-800">{item.value}</span>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-slate-500">Revenue Trend</span>
                <Sparkline data={c.revenueTrend} color="#10b981" width={100} height={28} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Compliance Profile */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Compliance Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {[
                { label: 'Filing Regularity', value: `${c.filingRegularity}%` },
                { label: 'Notices Received', value: c.noticesReceived.toString() },
                { label: 'Returns Filed', value: c.returnsFiled.toString() },
                { label: 'Compliance Score', value: `${c.complianceScore}/100` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  <span className="text-[11px] font-medium text-slate-800">{item.value}</span>
                </div>
              ))}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">Compliance Score</span>
                  <span className="text-[10px] font-semibold text-emerald-600">{c.complianceScore}%</span>
                </div>
                <Progress value={c.complianceScore} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Relationship Profile */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <HeartPulse className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Relationship Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {[
                { label: 'Client Since', value: formatDate(c.clientSince) },
                { label: 'Total Interactions', value: c.totalInteractions.toLocaleString('en-IN') },
                { label: 'Last Activity', value: formatDate(c.lastActivity) },
                { label: 'Health Score', value: `${c.healthScore}/100` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  <span className="text-[11px] font-medium text-slate-800">{item.value}</span>
                </div>
              ))}
              <div className={`mt-2 p-3 rounded-lg border ${healthBg}`}>
                <div className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${healthColor}`} />
                  <span className={`text-lg font-bold ${healthColor}`}>{c.healthScore}</span>
                  <span className="text-[10px] text-slate-500">/100</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {c.healthScore >= 90 ? 'Excellent health — low risk' : c.healthScore >= 70 ? 'Good health — monitor regularly' : 'Needs attention — elevated risk'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Growth Profile */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Growth Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Revenue Trend</span>
                <Sparkline data={c.revenueTrend} color="#10b981" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Client Count Trend</span>
                <Sparkline data={c.clientCountTrend} color="#14b8a6" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Tax Growth</span>
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {c.taxGrowthPct}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Revenue Growth</span>
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {c.revenueGrowthRate}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Market Expansion</span>
                <span className="text-[11px] font-medium text-slate-700 text-right max-w-[160px] truncate">{c.marketExpansion}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Communication Profile */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-slate-200 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Communication Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5">
              {[
                { label: 'Avg Response Time', value: c.avgResponseTime },
                { label: 'Preferred Channel', value: c.preferredChannel },
                { label: 'Last Contact', value: c.lastContact },
                { label: 'Client Acquisition', value: c.clientAcquisition },
                { label: 'Score History', value: `${c.scoreHistory[0]} → ${c.scoreHistory[c.scoreHistory.length - 1]}` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">{item.label}</span>
                  <span className="text-[11px] font-medium text-slate-800 text-right max-w-[160px] truncate">{item.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <span className="text-[11px] text-slate-500">Health Trend</span>
                <Sparkline data={c.scoreHistory} color="#10b981" width={90} height={24} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Key Events & Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Key Events
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {c.keyEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <CircleDot className="h-3 w-3 text-amber-500 shrink-0" />
                  {event}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              Risk Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Risk Episodes</span>
              <span className={`text-[11px] font-semibold ${c.riskEpisodes === 0 ? 'text-emerald-600' : c.riskEpisodes <= 2 ? 'text-amber-600' : 'text-red-600'}`}>{c.riskEpisodes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Risk Factors</span>
              <span className="text-[11px] font-medium text-slate-700 text-right max-w-[200px] truncate">{c.riskFactors}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500">On-time Rate</span>
              <span className={`text-[11px] font-semibold ${c.onTimeRate >= 90 ? 'text-emerald-600' : c.onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{c.onTimeRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Avg Delay</span>
              <span className="text-[11px] font-medium text-slate-700">{c.avgDelay}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: AI BUSINESS MEMORY
// ═══════════════════════════════════════════════════════════════════════════════

function AIMemoryTab({ selectedClient }: { selectedClient: DemoClientProfile }) {
  const c = selectedClient;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['invoices']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const memorySections = [
    {
      key: 'invoices',
      title: 'Invoices Memory',
      icon: FileText,
      color: '#10b981',
      insights: [
        { label: 'Total invoices processed', value: c.invoicesCount.toLocaleString('en-IN') },
        { label: 'Average invoice value', value: formatINR(c.avgInvoiceValue) },
        { label: 'Top clients by value', value: c.topClientsByValue.join(', ') },
        { label: 'Payment patterns', value: c.paymentPatterns },
      ],
    },
    {
      key: 'returns',
      title: 'Returns Memory',
      icon: FileCheck,
      color: '#14b8a6',
      insights: [
        { label: 'Filing history', value: c.filingHistory },
        { label: 'Compliance patterns', value: c.compliancePatterns },
        { label: 'Tax payment regularity', value: c.taxPaymentRegularity },
        { label: 'Returns filed', value: c.returnsFiled.toString() },
      ],
    },
    {
      key: 'compliance',
      title: 'Compliance Memory',
      icon: Shield,
      color: '#f59e0b',
      insights: [
        { label: 'Notice history', value: c.noticeHistory },
        { label: 'Resolution patterns', value: c.resolutionPatterns },
        { label: 'Risk factors', value: c.riskFactors },
        { label: 'Notices received', value: c.noticesReceived.toString() },
      ],
    },
    {
      key: 'payment',
      title: 'Payment Behavior',
      icon: IndianRupee,
      color: '#8b5cf6',
      insights: [
        { label: 'On-time rate', value: `${c.onTimeRate}%` },
        { label: 'Average delay', value: c.avgDelay },
        { label: 'Seasonal patterns', value: c.seasonalPatterns },
        { label: 'Payment behavior', value: c.paymentBehavior },
      ],
    },
    {
      key: 'health',
      title: 'Client Health',
      icon: HeartPulse,
      color: '#ef4444',
      insights: [
        { label: 'Current score', value: `${c.healthScore}/100` },
        { label: 'Score history', value: c.scoreHistory.join(' → ') },
        { label: 'Key events', value: c.keyEvents.join('; ') },
        { label: 'Risk episodes', value: c.riskEpisodes.toString() },
      ],
    },
    {
      key: 'growth',
      title: 'Growth Trends',
      icon: TrendingUp,
      color: '#06b6d4',
      insights: [
        { label: 'Revenue growth rate', value: `${c.revenueGrowthRate}%` },
        { label: 'Client acquisition', value: c.clientAcquisition },
        { label: 'Market expansion', value: c.marketExpansion },
        { label: 'Tax growth', value: `${c.taxGrowthPct}%` },
      ],
    },
    {
      key: 'banking',
      title: 'Banking Patterns',
      icon: Building2,
      color: '#64748b',
      insights: [
        { label: 'Cash flow cycles', value: c.cashFlowCycles },
        { label: 'Peak periods', value: c.peakPeriods },
        { label: 'Low periods', value: c.lowPeriods },
        { label: 'Operating cycle', value: c.cashFlowCycles },
      ],
    },
  ];

  const filteredSections = searchQuery
    ? memorySections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.insights.some(i =>
          i.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : memorySections;

  return (
    <div className="space-y-4">
      {/* Search + Query Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search across all memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
          <Input
            placeholder="Ask about this business... (e.g., &quot;What are the compliance risks?&quot;)"
            className="pl-9 h-10"
            disabled
          />
          <Badge className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-50 text-emerald-600 text-[9px] border-emerald-200">
            AI Ready
          </Badge>
        </div>
      </div>

      {/* Memory Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Insights', value: memorySections.reduce((s, sec) => s + sec.insights.length, 0).toString(), icon: Brain, color: '#10b981' },
          { label: 'Memory Categories', value: memorySections.length.toString(), icon: Layers, color: '#14b8a6' },
          { label: 'Data Points', value: (c.invoicesCount + c.gstReturnsCount + c.documentsCount).toLocaleString('en-IN'), icon: Database, color: '#f59e0b' },
          { label: 'Last Computed', value: formatDate(c.lastActivity), icon: Clock, color: '#64748b' },
        ].map((stat, i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: stat.color + '12' }}>
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
                <p className="text-sm font-bold text-slate-800">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Expandable Memory Sections */}
      <div className="space-y-3">
        {filteredSections.map(section => (
          <MemorySection
            key={section.key}
            title={section.title}
            icon={section.icon}
            color={section.color}
            insights={section.insights}
            isExpanded={expandedSections.has(section.key)}
            onToggle={() => toggleSection(section.key)}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: DATA VAULT
// ═══════════════════════════════════════════════════════════════════════════════

function DataVaultTab({ selectedClient }: { selectedClient: DemoClientProfile }) {
  const c = selectedClient;

  const dataInventory = [
    { type: 'GST Returns', records: c.gstReturnsCount, lastUpdated: c.recordsLastUpdated, quality: c.dataQualityScore, icon: FileCheck },
    { type: 'Invoices', records: c.invoicesCount, lastUpdated: c.recordsLastUpdated, quality: Math.min(98, c.dataQualityScore + 2), icon: FileText },
    { type: 'E-Way Bills', records: Math.round(c.invoicesCount * 0.6), lastUpdated: c.recordsLastUpdated, quality: Math.max(65, c.dataQualityScore - 10), icon: Layers },
    { type: 'Notices', records: c.noticesCount, lastUpdated: c.recordsLastUpdated, quality: Math.min(99, c.dataQualityScore + 5), icon: Scale },
    { type: 'Documents', records: c.documentsCount, lastUpdated: c.recordsLastUpdated, quality: Math.max(70, c.dataQualityScore - 5), icon: FolderOpen },
    { type: 'Bank Statements', records: 36, lastUpdated: c.recordsLastUpdated, quality: Math.max(72, c.dataQualityScore - 8), icon: Building2 },
    { type: 'TDS Data', records: 24, lastUpdated: c.recordsLastUpdated, quality: Math.max(68, c.dataQualityScore - 12), icon: IndianRupee },
    { type: 'Compliance Records', records: c.returnsFiled + c.noticesReceived, lastUpdated: c.recordsLastUpdated, quality: c.dataQualityScore, icon: ShieldCheck },
  ];

  const totalDataPoints = dataInventory.reduce((s, d) => s + d.records, 0);

  const freshnessColor = c.dataFreshness === 'fresh' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : c.dataFreshness === 'stale' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
  const freshnessLabel = c.dataFreshness === 'fresh' ? 'Fresh (<7 days)' : c.dataFreshness === 'stale' ? 'Stale (7-30 days)' : 'Outdated (>30 days)';

  const qualityMetrics = [
    { label: 'Completeness', value: c.profileCompleteness, color: '#10b981' },
    { label: 'Accuracy', value: c.dataQualityScore, color: '#14b8a6' },
    { label: 'Timeliness', value: c.dataFreshness === 'fresh' ? 95 : c.dataFreshness === 'stale' ? 65 : 35, color: '#f59e0b' },
    { label: 'Consistency', value: Math.max(70, c.dataQualityScore - 5), color: '#64748b' },
  ];

  // Data coverage matrix
  const coverageClients = DEMO_CLIENTS.slice(0, 6);
  const coverageTypes = ['GST Returns', 'Invoices', 'E-Way Bills', 'Notices', 'Documents', 'Bank Stmt'];

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Data Points', value: `${(totalDataPoints).toLocaleString('en-IN')} data points across 156 businesses`, icon: Database, color: '#10b981' },
          { label: 'Data Quality', value: `${c.dataQualityScore}%`, icon: Shield, color: '#14b8a6' },
          { label: 'Data Freshness', value: freshnessLabel, isFreshness: true, icon: RefreshCw, color: c.dataFreshness === 'fresh' ? '#10b981' : c.dataFreshness === 'stale' ? '#f59e0b' : '#ef4444' },
          { label: 'Data Types', value: `${dataInventory.length} categories`, icon: Layers2, color: '#64748b' },
        ].map((stat, i) => (
          <Card key={i} className="border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                <span className="text-[10px] text-slate-500">{stat.label}</span>
              </div>
              {stat.isFreshness ? (
                <Badge className={`text-[10px] ${freshnessColor}`}>{stat.value}</Badge>
              ) : (
                <p className="text-xs font-bold text-slate-800">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Inventory Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
            <HardDrive className="h-4 w-4 text-emerald-600" />
            Data Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-72">
            <div className="space-y-2">
              {dataInventory.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-100">
                    <item.icon className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{item.type}</p>
                    <p className="text-[10px] text-slate-500">Updated {formatDate(item.lastUpdated)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">{item.records.toLocaleString('en-IN')}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Quality:</span>
                      <span className={`text-[10px] font-semibold ${item.quality >= 90 ? 'text-emerald-600' : item.quality >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                        {item.quality}%
                      </span>
                    </div>
                  </div>
                  <div className="w-16">
                    <Progress value={item.quality} className="h-1.5" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Data Quality + Growth Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quality Metrics */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <Fingerprint className="h-4 w-4 text-emerald-600" />
              Data Quality Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {qualityMetrics.map((metric, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-600">{metric.label}</span>
                  <span className="text-[11px] font-semibold" style={{ color: metric.color }}>{metric.value}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Data Growth Chart */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <BarChart4 className="h-4 w-4 text-emerald-600" />
              Data Growth (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex items-center justify-center">
            <BarChart
              data={[28000, 34000, 42000, 51000, 63000, 78000]}
              labels={['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']}
              color="#10b981"
              width={280}
              height={140}
            />
          </CardContent>
        </Card>
      </div>

      {/* Data Coverage Matrix */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
            <Layers2 className="h-4 w-4 text-emerald-600" />
            Data Coverage Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ScrollArea className="max-h-64 overflow-auto">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-7 gap-1 mb-2">
                <div className="text-[10px] font-semibold text-slate-500 px-2">Client</div>
                {coverageTypes.map(t => (
                  <div key={t} className="text-[9px] font-medium text-slate-500 text-center px-1">{t}</div>
                ))}
              </div>
              {coverageClients.map(client => (
                <div key={client.id} className="grid grid-cols-7 gap-1 mb-1">
                  <div className="text-[10px] text-slate-700 font-medium px-2 truncate">{client.tradeName.split(' ')[0]}</div>
                  {coverageTypes.map((_, ti) => {
                    const hasData = Math.random() > 0.2;
                    const quality = hasData ? (Math.random() > 0.3 ? 'high' : Math.random() > 0.5 ? 'medium' : 'low') : 'none';
                    return (
                      <div key={ti} className="flex items-center justify-center">
                        {quality === 'high' ? (
                          <div className="h-5 w-5 rounded bg-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        ) : quality === 'medium' ? (
                          <div className="h-5 w-5 rounded bg-amber-400 flex items-center justify-center">
                            <Clock className="h-3 w-3 text-white" />
                          </div>
                        ) : quality === 'low' ? (
                          <div className="h-5 w-5 rounded bg-red-400 flex items-center justify-center">
                            <AlertTriangle className="h-3 w-3 text-white" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded bg-slate-200" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-emerald-500" /><span className="text-[9px] text-slate-500">Complete</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-amber-400" /><span className="text-[9px] text-slate-500">Partial</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-red-400" /><span className="text-[9px] text-slate-500">Low Quality</span></div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-slate-200" /><span className="text-[9px] text-slate-500">No Data</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: COMPETITIVE MOAT
// ═══════════════════════════════════════════════════════════════════════════════

function CompetitiveMoatTab({ selectedClient }: { selectedClient: DemoClientProfile }) {
  const c = selectedClient;
  const moatStrength = Math.round(
    (c.dataQualityScore * 0.3 + c.complianceScore * 0.2 + c.healthScore * 0.2 + c.profileCompleteness * 0.15 + c.onTimeRate * 0.15)
  );

  const defensibilityScores = [
    { category: 'Transaction Data', score: 92, color: '#10b981' },
    { category: 'Compliance History', score: 88, color: '#14b8a6' },
    { category: 'Filing Patterns', score: 85, color: '#06b6d4' },
    { category: 'Client Relationships', score: 78, color: '#f59e0b' },
    { category: 'Notice Resolution', score: 72, color: '#8b5cf6' },
    { category: 'Banking Intelligence', score: 68, color: '#64748b' },
  ];

  return (
    <div className="space-y-4">
      {/* Moat Strength + Uniqueness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6 flex flex-col items-center">
            <GaugeChart value={moatStrength} size={200} />
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-slate-800">Your Data Moat Strength</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {moatStrength >= 85 ? 'Exceptional — nearly impossible to replicate' : moatStrength >= 70 ? 'Strong — significant competitive advantage' : 'Building — keep accumulating data'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-emerald-50/50 to-white">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <Fingerprint className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Data Uniqueness Score</p>
                <p className="text-2xl font-bold text-emerald-600">87%</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your data is <span className="font-bold text-emerald-700">87% unique</span> — no competitor can replicate this. Every transaction, filing, and interaction creates an irreplaceable intelligence asset.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-3 rounded-lg bg-white border border-slate-100">
                <p className="text-[10px] text-slate-500">Your avg data points/client</p>
                <p className="text-lg font-bold text-emerald-600">1,567</p>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-100">
                <p className="text-[10px] text-slate-500">Industry avg data points/client</p>
                <p className="text-lg font-bold text-slate-400">234</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Depth + Switching Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <Network className="h-4 w-4 text-emerald-600" />
              Network Depth
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {[
              { degree: '1st degree', count: '156 clients', desc: 'Direct relationships', color: '#10b981' },
              { degree: '2nd degree', count: '2,340 businesses', desc: 'Connected through clients', color: '#14b8a6' },
              { degree: '3rd degree', count: '35,100 entities', desc: 'Extended network reach', color: '#06b6d4' },
            ].map((level, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: level.color + '15' }}>
                  <span className="text-xs font-bold" style={{ color: level.color }}>{i + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">{level.degree}</span>
                    <span className="text-xs font-bold" style={{ color: level.color }}>{level.count}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{level.desc}</p>
                </div>
              </div>
            ))}
            <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] text-emerald-700 font-medium">
                Network effect: Each new client adds ~15 connected entities to your data moat
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <Lock className="h-4 w-4 text-emerald-600" />
              Switching Cost Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
              <p className="text-sm font-bold text-emerald-800">High Switching Cost</p>
              <p className="text-2xl font-bold text-emerald-600">89%</p>
              <p className="text-[10px] text-emerald-600 mt-1">of clients would lose data history by switching</p>
            </div>
            {[
              { label: 'Historical Data Loss', value: '3+ years of records', risk: 'high' },
              { label: 'Compliance Context Loss', value: 'All filing patterns', risk: 'high' },
              { label: 'Relationship Memory', value: 'Interaction history', risk: 'medium' },
              { label: 'AI Model Accuracy', value: 'Trained on your data', risk: 'high' },
              { label: 'Process Customization', value: 'Workflow templates', risk: 'medium' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50/80">
                <span className="text-[11px] text-slate-600">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{item.value}</span>
                  <Badge className={`text-[9px] ${item.risk === 'high' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                    {item.risk === 'high' ? 'Critical' : 'Important'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Data Defensibility Scores */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
            <Shield className="h-4 w-4 text-emerald-600" />
            Data Defensibility Score by Category
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {defensibilityScores.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-3 rounded-xl border border-slate-100 bg-white"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px] font-medium text-slate-700">{item.category}</span>
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold" style={{ color: item.color }}>{item.score}</span>
                  <span className="text-[10px] text-slate-400 mb-1">/100</span>
                </div>
                <Progress value={item.score} className="h-1.5 mt-2" />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue from Data Insights + Animated Data Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              Revenue from Data Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {[
              { label: 'Proactive compliance savings', value: formatINR(1240000), pct: '+34%' },
              { label: 'Late penalty avoidance', value: formatINR(890000), pct: '+28%' },
              { label: 'ITC optimization', value: formatINR(2100000), pct: '+45%' },
              { label: 'Client retention value', value: formatINR(3500000), pct: '+52%' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50/80">
                <span className="text-[11px] text-slate-600">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-800">{item.value}</span>
                  <Badge className="bg-emerald-50 text-emerald-600 text-[9px] border-emerald-200">{item.pct}</Badge>
                </div>
              </div>
            ))}
            <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
              <p className="text-[10px] text-slate-500">Total data-driven revenue impact</p>
              <p className="text-xl font-bold text-emerald-600">{formatINR(7730000)}</p>
              <p className="text-[10px] text-emerald-600">This fiscal year</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
              <Cpu className="h-4 w-4 text-emerald-600" />
              Data Flow Visualization
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <DataFlowVisualization />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DataMoatPage() {
  const [selectedClientId, setSelectedClientId] = useState(DEMO_CLIENTS[0].id);
  const [activeTab, setActiveTab] = useState('profile');

  // Firestore hooks (for live data integration)
  const { data: fireClients } = useFireClients();
  const { data: fireInvoices } = useFireInvoices();
  const { data: fireReturns } = useFireReturns();
  const { data: fireDocuments } = useFireDocuments();
  const { data: fireActivities } = useFireActivities();

  // Use demo data (firestore data used for enhancing when available)
  const selectedClient = useMemo(
    () => DEMO_CLIENTS.find(c => c.id === selectedClientId) || DEMO_CLIENTS[0],
    [selectedClientId]
  );

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200 shadow-sm">
            <Database className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Data Moat Engine</h1>
            <p className="text-xs text-slate-500">AI Business Memory™ — Your competitive data advantage</p>
          </div>
        </div>

        {/* Client Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 w-full sm:w-64"
          >
            {DEMO_CLIENTS.map(client => (
              <option key={client.id} value={client.id}>
                {client.tradeName} — {client.gstin.slice(0, 10)}...
              </option>
            ))}
          </select>
          <Badge className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
            <Eye className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </div>
      </motion.div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Businesses', value: '156', icon: Building2, trend: '+12 this quarter' },
          { label: 'Data Points', value: '2,34,567', icon: Database, trend: '+18% growth' },
          { label: 'Unique Insights', value: '4,892', icon: Sparkles, trend: 'AI computed' },
          { label: 'Moat Strength', value: '87/100', icon: Shield, trend: 'Strong' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-slate-200 hover:shadow-sm transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[10px] text-slate-500">{stat.label}</span>
                </div>
                <p className="text-base font-bold text-slate-800">{stat.value}</p>
                <p className="text-[9px] text-emerald-600 font-medium">{stat.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 h-9 p-1">
          <TabsTrigger value="profile" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <Eye className="h-3 w-3 mr-1.5" />
            360° Profile
          </TabsTrigger>
          <TabsTrigger value="memory" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <Brain className="h-3 w-3 mr-1.5" />
            AI Memory
          </TabsTrigger>
          <TabsTrigger value="vault" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <HardDrive className="h-3 w-3 mr-1.5" />
            Data Vault
          </TabsTrigger>
          <TabsTrigger value="moat" className="text-xs h-7 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
            <Shield className="h-3 w-3 mr-1.5" />
            Competitive Moat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <BusinessProfileTab selectedClient={selectedClient} />
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          <AIMemoryTab selectedClient={selectedClient} />
        </TabsContent>

        <TabsContent value="vault" className="mt-4">
          <DataVaultTab selectedClient={selectedClient} />
        </TabsContent>

        <TabsContent value="moat" className="mt-4">
          <CompetitiveMoatTab selectedClient={selectedClient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
