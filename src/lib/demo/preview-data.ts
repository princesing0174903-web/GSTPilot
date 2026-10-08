// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Phase 9 Demo Preview Data
// The AI Operating System for Business™
//
// Pure, frontend-only premium demo dataset shown on empty dashboards so the
// product never looks dead (no ₹0, no "No activity", no "No data").
// This module touches NO databases and NO API logic — it is a static preview
// surface rendered when live metrics are empty.
// ═══════════════════════════════════════════════════════════════════════════════

export interface DemoKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  spark: number[];
}

export interface DemoActivity {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  tone: 'blue' | 'purple' | 'teal' | 'amber' | 'emerald';
}

export interface DemoClient {
  id: string;
  name: string;
  gstin: string;
  health: number;
  outstanding: string;
  status: 'current' | 'pending' | 'overdue';
}

export interface DemoComplianceItem {
  id: string;
  form: string;
  due: string;
  amount: string;
  status: 'filed' | 'draft' | 'due';
}

// ─── Premium Demo KPIs (Revenue · GST · Invoices · Collections · Cash · Compliance) ───
export const DEMO_KPIs: DemoKpi[] = [
  {
    id: 'revenue',
    label: 'Revenue (MTD)',
    value: '₹84.6L',
    delta: '+12.4%',
    trend: 'up',
    spark: [42, 48, 45, 52, 58, 61, 67, 72, 84],
  },
  {
    id: 'gst',
    label: 'GST Liability',
    value: '₹12.8L',
    delta: '+3.1%',
    trend: 'up',
    spark: [8, 9, 10, 9, 11, 12, 11, 12, 12.8],
  },
  {
    id: 'invoices',
    label: 'Invoices Processed',
    value: '1,284',
    delta: '+8.7%',
    trend: 'up',
    spark: [920, 980, 1020, 1080, 1120, 1160, 1210, 1240, 1284],
  },
  {
    id: 'collections',
    label: 'Collections',
    value: '₹61.2L',
    delta: '+18.9%',
    trend: 'up',
    spark: [38, 42, 44, 48, 52, 54, 57, 59, 61.2],
  },
  {
    id: 'cash',
    label: 'Cash Position',
    value: '₹2.4Cr',
    delta: '+5.2%',
    trend: 'up',
    spark: [210, 215, 218, 222, 228, 231, 234, 238, 240],
  },
  {
    id: 'compliance',
    label: 'Compliance Score',
    value: '94%',
    delta: '+2 pts',
    trend: 'up',
    spark: [88, 89, 90, 91, 91, 92, 93, 93, 94],
  },
];

// ─── Demo Activity Feed ───────────────────────────────────────────────────────
export const DEMO_ACTIVITIES: DemoActivity[] = [
  { id: 'a1', time: '09:02', title: 'Downloaded GSTR-2B', subtitle: '2,847 lines · 92.4% ITC matched', tone: 'blue' },
  { id: 'a2', time: '09:07', title: 'Detected ITC mismatch', subtitle: 'Sharma Enterprises · ₹1.2L gap', tone: 'amber' },
  { id: 'a3', time: '09:12', title: 'Sent reminders to 12 customers', subtitle: 'WhatsApp + Email · 3 acknowledged', tone: 'emerald' },
  { id: 'a4', time: '09:24', title: 'Prepared GSTR-3B draft', subtitle: 'Approval required before filing', tone: 'purple' },
  { id: 'a5', time: '09:31', title: 'Reconciled bank transactions', subtitle: '₹18.4L matched across 3 accounts', tone: 'teal' },
  { id: 'a6', time: '09:48', title: 'Generated cash flow forecast', subtitle: '12-day runway · no shortage predicted', tone: 'blue' },
];

// ─── Demo Clients ─────────────────────────────────────────────────────────────
export const DEMO_CLIENTS: DemoClient[] = [
  { id: 'c1', name: 'Sharma Enterprises', gstin: '27AABCS1429B1Z5', health: 92, outstanding: '₹4.2L', status: 'current' },
  { id: 'c2', name: 'Patel & Sons', gstin: '24AABCP5678Q1Z3', health: 78, outstanding: '₹2.1L', status: 'pending' },
  { id: 'c3', name: 'Verma Industries', gstin: '29AABCV9988K1Z2', health: 64, outstanding: '₹8.7L', status: 'overdue' },
  { id: 'c4', name: 'Reddy Suppliers', gstin: '36AABCR3344L1Z9', health: 58, outstanding: '₹2.8L', status: 'overdue' },
  { id: 'c5', name: 'Mehta Traders', gstin: '07AABCM7766N1Z4', health: 88, outstanding: '₹1.4L', status: 'current' },
];

// ─── Demo Compliance Calendar ─────────────────────────────────────────────────
export const DEMO_COMPLIANCE: DemoComplianceItem[] = [
  { id: 'g1', form: 'GSTR-1', due: 'Jul 11', amount: '₹84.6L', status: 'draft' },
  { id: 'g2', form: 'GSTR-3B', due: 'Jul 20', amount: '₹12.8L', status: 'due' },
  { id: 'g3', form: 'TDS Q1', due: 'Jul 31', amount: '₹3.2L', status: 'due' },
  { id: 'g4', form: 'GSTR-2B', due: 'Jul 13', amount: '—', status: 'filed' },
];

// ─── Demo Cash Flow (12-week sparkline) ───────────────────────────────────────
export const DEMO_CASH_FLOW: number[] = [
  210, 218, 224, 219, 231, 238, 244, 240, 252, 248, 256, 241,
];

// ─── Demo Collections Forecast ────────────────────────────────────────────────
export const DEMO_COLLECTION_FORECAST: { label: string; expected: number; received: number }[] = [
  { label: 'W1', expected: 14.2, received: 12.8 },
  { label: 'W2', expected: 16.8, received: 15.1 },
  { label: 'W3', expected: 12.4, received: 11.2 },
  { label: 'W4', expected: 18.6, received: 16.9 },
];

// ─── Tone → color map (matches brand + accent system) ─────────────────────────
export const DEMO_TONE_COLORS: Record<DemoActivity['tone'], string> = {
  blue: '#3B82F6',
  purple: '#8B5CF6',
  teal: '#22D3EE',
  amber: '#F59E0B',
  emerald: '#10B981',
};
