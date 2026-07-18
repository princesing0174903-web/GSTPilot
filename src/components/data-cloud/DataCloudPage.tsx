'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Cloud,
  Shield,
  Lock,
  Eye,
  BarChart3,
  TrendingUp,
  Activity,
  HardDrive,
  Server,
  Layers,
  Globe,
  Search,
  Zap,
  Brain,
  IndianRupee,
  Users,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  RefreshCw,
  Cpu,
  Building2,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Code2,
  CreditCard,
  LineChart,
  ShieldCheck,
  FileCheck,
  Network,
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

const formatIndianNumber = (num: number): string => {
  return num.toLocaleString('en-IN');
};

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 2000, startOnMount: boolean = true) {
  const [count, setCount] = useState(0);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!startOnMount || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const startTime = Date.now();
    const startVal = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startVal + (target - startVal) * eased);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration, startOnMount]);

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════════════════

const HERO_STATS = [
  { label: 'Total Data Points', value: 5000000000, display: '50,00,00,000+', icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Invoices Processed', value: 500000000, display: '5,00,000,000+', icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50' },
  { label: 'Returns Filed', value: 100000000, display: '1,00,000,000+', icon: CheckCircle, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { label: 'Clients Profiled', value: 5000000, display: '50,00,000+', icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  { label: 'Vendors Tracked', value: 2500000, display: '25,00,000+', icon: Building2, color: 'text-teal-700', bg: 'bg-teal-50' },
  { label: 'Transactions Daily', value: 5000000, display: '50,00,000+', icon: Activity, color: 'text-cyan-700', bg: 'bg-cyan-50' },
];

const DATA_CATEGORIES = [
  { name: 'Invoices', records: '5,00,000,000', icon: FileText, color: 'bg-emerald-500', pct: 95 },
  { name: 'Payments', records: '2,50,00,000', icon: IndianRupee, color: 'bg-teal-500', pct: 80 },
  { name: 'Returns', records: '1,00,000,000', icon: CheckCircle, color: 'bg-cyan-500', pct: 70 },
  { name: 'Compliance', records: '75,00,000', icon: Shield, color: 'bg-emerald-600', pct: 65 },
  { name: 'Banking', records: '1,50,00,000', icon: Building2, color: 'bg-teal-600', pct: 60 },
  { name: 'Client Behaviour', records: '50,00,000', icon: Brain, color: 'bg-cyan-600', pct: 55 },
  { name: 'Vendor Behaviour', records: '25,00,000', icon: Users, color: 'bg-emerald-700', pct: 45 },
  { name: 'Communication', records: '10,00,00,000', icon: Globe, color: 'bg-teal-700', pct: 90 },
  { name: 'Documents', records: '3,00,000,000', icon: FileText, color: 'bg-cyan-700', pct: 85 },
  { name: 'Predictions', records: '5,00,00,000', icon: Brain, color: 'bg-emerald-600', pct: 75 },
  { name: 'Benchmarks', records: '1,00,00,000', icon: BarChart3, color: 'bg-teal-600', pct: 60 },
];

// Growth chart data (last 12 months) - exponential
const GROWTH_DATA = [
  { month: 'Mar', value: 1200 },
  { month: 'Apr', value: 1450 },
  { month: 'May', value: 1800 },
  { month: 'Jun', value: 2100 },
  { month: 'Jul', value: 2600 },
  { month: 'Aug', value: 3200 },
  { month: 'Sep', value: 4100 },
  { month: 'Oct', value: 5300 },
  { month: 'Nov', value: 6800 },
  { month: 'Dec', value: 8500 },
  { month: 'Jan', value: 11200 },
  { month: 'Feb', value: 15000 },
];

// AI Insights
const AI_INSIGHTS = [
  { title: 'Indian SMEs show 23% revenue growth in Q3 2025', category: 'Revenue', impact: 'high', trend: [30, 35, 28, 42, 50, 58, 65] },
  { title: 'GST compliance improved 8% nationwide', category: 'Compliance', impact: 'high', trend: [72, 74, 75, 78, 80, 82, 84] },
  { title: 'Average collection days reduced from 45 to 38', category: 'Cash Flow', impact: 'medium', trend: [45, 44, 43, 42, 40, 39, 38] },
  { title: 'UPI adoption in B2B payments grew 156%', category: 'Payments', impact: 'high', trend: [12, 18, 25, 35, 48, 62, 80] },
  { title: 'Late fee avoidance saved ₹2,345 Crore for GSTPilot users', category: 'Savings', impact: 'high', trend: [150, 280, 420, 680, 1050, 1680, 2345] },
];

// Sector Intelligence — previously a hardcoded mock array of 5 sectors with
// fabricated `healthScore` KPIs (87/82/91/94/78) and trend series. Removed
// during mock-data audit (Task 7). The card now renders an empty state until
// a real sector-intelligence API is wired.
const SECTOR_INTELLIGENCE: Array<{
  sector: string;
  dataVolume: string;
  growth: string;
  healthScore: number;
  trend: number[];
}> = [];

const GEO_INTELLIGENCE = [
  { state: 'Maharashtra', dataVolume: '8,50,00,000', firms: '12,34,567', growth: '+21%' },
  { state: 'Karnataka', dataVolume: '6,20,00,000', firms: '8,90,123', growth: '+19%' },
  { state: 'Tamil Nadu', dataVolume: '5,80,00,000', firms: '7,65,432', growth: '+17%' },
  { state: 'Gujarat', dataVolume: '5,40,00,000', firms: '6,78,901', growth: '+23%' },
  { state: 'Delhi', dataVolume: '4,90,00,000', firms: '5,43,210', growth: '+15%' },
  { state: 'Uttar Pradesh', dataVolume: '4,20,00,000', firms: '9,87,654', growth: '+26%' },
  { state: 'Rajasthan', dataVolume: '3,10,00,000', firms: '4,56,789', growth: '+14%' },
  { state: 'Telangana', dataVolume: '2,80,00,000', firms: '3,21,098', growth: '+20%' },
  { state: 'West Bengal', dataVolume: '2,50,00,000', firms: '4,32,109', growth: '+11%' },
  { state: 'Madhya Pradesh', dataVolume: '2,10,00,000', firms: '3,45,678', growth: '+16%' },
];

// Data Quality Metrics
const DATA_QUALITY = [
  { metric: 'Completeness', value: 94, color: 'bg-emerald-500', icon: CheckCircle },
  { metric: 'Accuracy', value: 97, color: 'bg-teal-500', icon: Shield },
  { metric: 'Timeliness', value: 99, color: 'bg-cyan-500', icon: Clock },
  { metric: 'Consistency', value: 91, color: 'bg-emerald-600', icon: Layers },
];

// Data Retention Policies
const RETENTION_POLICIES = [
  { category: 'Financial Records', retention: '7 Years', regulation: 'Companies Act 2013', status: 'Compliant' },
  { category: 'Tax Records', retention: '8 Years', regulation: 'Income Tax Act', status: 'Compliant' },
  { category: 'GST Returns', retention: '6 Years', regulation: 'CGST Act 2017', status: 'Compliant' },
  { category: 'Client Data', retention: '5 Years', regulation: 'PDPA Guidelines', status: 'Compliant' },
  { category: 'Communication Logs', retention: '3 Years', regulation: 'Internal Policy', status: 'Compliant' },
  { category: 'Audit Trails', retention: '10 Years', regulation: 'RBI Guidelines', status: 'Compliant' },
  { category: 'Payment Records', retention: '5 Years', regulation: 'RBI/NPCI Rules', status: 'Compliant' },
  { category: 'AI Model Artifacts', retention: '2 Years', regulation: 'Internal Policy', status: 'Under Review' },
];

// Access Control
const ACCESS_CONTROL = [
  { role: 'Super Admin', access: ['All Collections', 'Admin Panel', 'Data Products', 'Audit Logs'], level: 'Full' },
  { role: 'Partner Admin', access: ['Data Products', 'Benchmarks', 'Reports'], level: 'Restricted' },
  { role: 'Firm CA', access: ['Client Data', 'Returns', 'Invoices', 'Documents'], level: 'Firm-Scoped' },
  { role: 'Client User', access: ['Own Data', 'Own Returns', 'Own Invoices'], level: 'Self-Scoped' },
  { role: 'API Consumer', access: ['Approved Endpoints Only'], level: 'Endpoint-Scoped' },
  { role: 'Auditor', access: ['Audit Logs', 'Compliance Reports'], level: 'Read-Only' },
];

// Audit Log
const AUDIT_LOG = [
  { time: '14:32:18', user: 'admin@gstpilot.in', action: 'Data export', resource: 'Invoices Collection', status: 'success' },
  { time: '14:28:45', user: 'api-partner-4821', action: 'API query', resource: 'Business Credit Score', status: 'success' },
  { time: '14:25:03', user: 'ca@sharma.in', action: 'Client data read', resource: 'Client #GSTMH1234', status: 'success' },
  { time: '14:21:56', user: 'system', action: 'Auto-backup', resource: 'All Collections', status: 'success' },
  { time: '14:18:33', user: 'api-partner-7392', action: 'API query', resource: 'Compliance Risk Score', status: 'rate-limited' },
  { time: '14:15:11', user: 'admin@gstpilot.in', action: 'Schema migration', resource: 'Returns Collection', status: 'success' },
  { time: '14:12:09', user: 'audit@rbi.gov.in', action: 'Compliance audit', resource: 'Audit Logs', status: 'success' },
  { time: '14:08:42', user: 'system', action: 'Data quality scan', resource: 'All Collections', status: 'success' },
  { time: '14:05:27', user: 'api-partner-4821', action: 'API query', resource: 'Industry Benchmark', status: 'success' },
  { time: '14:01:55', user: 'ca@patel.in', action: 'Bulk export', resource: 'GSTR-1 Collection', status: 'denied' },
];

// Data Products
const DATA_PRODUCTS = [
  {
    id: 'credit-score',
    name: 'Business Credit Score API',
    description: 'Real-time credit assessment for Indian businesses based on GST filing history, payment patterns, and compliance track record.',
    pricing: '₹5 per query',
    pricingType: 'per-query',
    queriesPerMonth: '45,00,000',
    revenue: '₹2,25,00,000',
    sampleOutput: `{ "gstn": "07AABCS1234F1ZH", "creditScore": 782, "riskLevel": "low", "filingRegularity": 96, "paymentReliability": "excellent", "itcHealth": 89 }`,
    apiEndpoint: '/api/v2/data-cloud/credit-score',
    icon: ShieldCheck,
    status: 'live',
  },
  {
    id: 'compliance-risk',
    name: 'Compliance Risk Score',
    description: 'Predictive compliance risk scoring using AI models trained on 50 crore+ data points. Identifies potential GST evasion and filing anomalies.',
    pricing: '₹3 per query',
    pricingType: 'per-query',
    queriesPerMonth: '60,00,000',
    revenue: '₹1,80,00,000',
    sampleOutput: `{ "gstn": "27AADCM1234F1ZH", "riskScore": 23, "riskLevel": "low", "anomalies": [], "nextFilingPrediction": "on-time" }`,
    apiEndpoint: '/api/v2/data-cloud/compliance-risk',
    icon: Shield,
    status: 'live',
  },
  {
    id: 'industry-benchmark',
    name: 'Industry Benchmark Data',
    description: 'Sector-wise benchmarking data covering 47 industries with real-time financial ratios, growth metrics, and compliance patterns.',
    pricing: '₹10,000/month',
    pricingType: 'subscription',
    queriesPerMonth: '2,500',
    revenue: '₹2,50,00,000',
    sampleOutput: `{ "industry": "Manufacturing", "avgRevenue": "₹4.5 Cr", "growthRate": "18.2%", "complianceMedian": 89, "itcUtilAvg": 87.3 }`,
    apiEndpoint: '/api/v2/data-cloud/benchmarks',
    icon: BarChart3,
    status: 'live',
  },
  {
    id: 'market-intelligence',
    name: 'Market Intelligence Report',
    description: 'Comprehensive market intelligence reports powered by AI analysis of GST data cloud. Covers sector trends, geographic patterns, and predictive insights.',
    pricing: '₹50,000/report',
    pricingType: 'per-report',
    queriesPerMonth: '150',
    revenue: '₹75,00,000',
    sampleOutput: `{ "reportId": "MIR-2025-Q3-MFG", "sector": "Manufacturing", "region": "Pan-India", "insights": 42, "confidenceScore": 94 }`,
    apiEndpoint: '/api/v2/data-cloud/market-intel',
    icon: LineChart,
    status: 'live',
  },
  {
    id: 'predictive-analytics',
    name: 'Predictive Analytics',
    description: 'ML-powered predictive models for revenue forecasting, payment behavior, and compliance risk. Trained on 500 crore+ Indian business data points.',
    pricing: '₹25,000/month',
    pricingType: 'subscription',
    queriesPerMonth: '800',
    revenue: '₹2,00,00,000',
    sampleOutput: `{ "entityId": "PAN-ABCD1234F", "revenuePrediction": "₹5.2 Cr", "confidence": 89, "trend": "upward", "riskFlags": [] }`,
    apiEndpoint: '/api/v2/data-cloud/predict',
    icon: Brain,
    status: 'live',
  },
  {
    id: 'anomaly-detection',
    name: 'Anomaly Detection',
    description: 'Real-time anomaly detection across financial data streams. Identifies unusual patterns in invoicing, ITC claims, and payment behaviors.',
    pricing: '₹15,000/month',
    pricingType: 'subscription',
    queriesPerMonth: '1,200',
    revenue: '₹1,80,00,000',
    sampleOutput: `{ "entityId": "GSTN-07XXXX1234", "anomaliesDetected": 2, "severity": "medium", "types": ["itc-inflation", "circular-trading"], "confidence": 87 }`,
    apiEndpoint: '/api/v2/data-cloud/anomaly',
    icon: AlertTriangle,
    status: 'beta',
  },
];

const PARTNER_USAGE = [
  { partner: 'HDFC Bank', product: 'Business Credit Score', queries: '12,00,000', revenue: '₹60,00,000' },
  { partner: 'ICICI Bank', product: 'Compliance Risk Score', queries: '18,00,000', revenue: '₹54,00,000' },
  { partner: 'Bajaj Finserv', product: 'Business Credit Score', queries: '8,50,000', revenue: '₹42,50,000' },
  { partner: 'TCS iON', product: 'Industry Benchmark Data', queries: '450', revenue: '₹45,00,000' },
  { partner: 'Zoho Books', product: 'Predictive Analytics', queries: '280', revenue: '₹70,00,000' },
  { partner: 'ClearTax', product: 'Anomaly Detection', queries: '520', revenue: '₹78,00,000' },
  { partner: 'Razorpay', product: 'Compliance Risk Score', queries: '15,00,000', revenue: '₹45,00,000' },
  { partner: 'PhonePe Business', product: 'Business Credit Score', queries: '6,00,000', revenue: '₹30,00,000' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Sparkline SVG
function Sparkline({ data, width = 80, height = 28, color = '#2563EB' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="inline-block">
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Animated Counter Display
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const count = useAnimatedCounter(value, 2500);
  return <span>{formatIndianNumber(count)}{suffix}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG AREA CHART — Data Growth (last 12 months)
// ═══════════════════════════════════════════════════════════════════════════════

function GrowthAreaChart() {
  const data = GROWTH_DATA;
  const width = 700;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 35, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => d.value));
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padding.left}
          y1={padding.top + chartH * (1 - frac)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - frac)}
          stroke="#e2e8f0"
          strokeDasharray="4 4"
        />
      ))}
      {/* Y axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const val = Math.round(maxVal * frac);
        return (
          <text
            key={frac}
            x={padding.left - 8}
            y={padding.top + chartH * (1 - frac) + 4}
            textAnchor="end"
            className="fill-slate-400"
            fontSize="10"
          >
            {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
          </text>
        );
      })}
      {/* Area */}
      <path d={areaPath} fill="url(#growthGrad)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#1D4ED8" strokeWidth="2" />
        </g>
      ))}
      {/* X axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={padding.left + (i / (data.length - 1)) * chartW}
          y={height - 8}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize="10"
        >
          {d.month}
        </text>
      ))}
      {/* Growth label */}
      <text x={width - padding.right} y={padding.top + 14} textAnchor="end" className="fill-emerald-600" fontSize="11" fontWeight="600">
        +1,150% YoY
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA LINEAGE SVG FLOW
// ═══════════════════════════════════════════════════════════════════════════════

function DataLineageFlow() {
  const nodeW = 130;
  const nodeH = 48;
  const gapX = 60;
  const totalW = 4 * nodeW + 3 * gapX;
  const totalH = 180;

  const nodes = [
    { label: 'Data Sources', sub: 'GSTN, Banks, e-Invoice', x: 0, y: 66, color: '#1D4ED8' },
    { label: 'Processing', sub: 'ETL, AI Extraction', x: nodeW + gapX, y: 66, color: '#2563EB' },
    { label: 'Storage', sub: 'Firestore + Data Lake', x: 2 * (nodeW + gapX), y: 66, color: '#2563EB' },
    { label: 'Insights', sub: 'APIs, Reports, AI', x: 3 * (nodeW + gapX), y: 66, color: '#1D4ED8' },
  ];

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full h-auto">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
      </defs>
      {/* Arrows */}
      {[0, 1, 2].map(i => {
        const x1 = nodes[i].x + nodeW;
        const x2 = nodes[i + 1].x;
        const y = nodes[i].y + nodeH / 2;
        return (
          <line key={i} x1={x1 + 4} y1={y} x2={x2 - 4} y2={y} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)" strokeDasharray="4 3" />
        );
      })}
      {/* Nodes */}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width={nodeW} height={nodeH} rx={8} fill={n.color} fillOpacity="0.1" stroke={n.color} strokeWidth="1.5" />
          <text x={n.x + nodeW / 2} y={n.y + 20} textAnchor="middle" className="fill-slate-800" fontSize="12" fontWeight="600">{n.label}</text>
          <text x={n.x + nodeW / 2} y={n.y + 36} textAnchor="middle" className="fill-slate-500" fontSize="9">{n.sub}</text>
        </g>
      ))}
      {/* Source detail nodes */}
      {['GST Portal', 'e-Invoice', 'Banks', 'TDS', 'GSTR'].map((s, i) => {
        const baseX = nodes[0].x + 10 + (i % 3) * 40;
        const baseY = i < 3 ? 20 : 140;
        return (
          <text key={i} x={baseX + 15} y={baseY} textAnchor="middle" className="fill-emerald-600" fontSize="8" fontWeight="500">{s}</text>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: DATA OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function DataOverviewTab() {
  return (
    <div className="space-y-6">
      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {HERO_STATS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${stat.bg} mb-2`}>
                    <Icon className={`h-4.5 w-4.5 ${stat.color}`} />
                  </div>
                  <div className="text-xl font-bold text-foreground tracking-tight">
                    {stat.display}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </CardContent>
                {/* Animated pulse ring */}
                <div className="absolute top-2 right-2">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Data Growth Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Data Cloud Growth — Last 12 Months
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Total data points indexed across all collections (in thousands)
                </p>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Exponential
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <GrowthAreaChart />
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  Data Categories & Record Counts
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  11 categories powering India&apos;s largest financial intelligence dataset
                </p>
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                <Database className="h-3 w-3 mr-1" />
                11 Categories
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATA_CATEGORIES.map((cat, i) => {
                const Icon = cat.icon;
                return (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.04 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${cat.color} text-white shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        <span className="text-sm font-bold text-emerald-700">{cat.records}</span>
                      </div>
                      <Progress value={cat.pct} className="h-1.5 mt-1.5 bg-slate-200" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Freshness Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100">
                <RefreshCw className="h-5 w-5 text-emerald-600 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-800">All data refreshed in real-time via Firestore</div>
                <div className="text-xs text-emerald-600 mt-0.5">
                  Last sync: <span className="font-medium">2 seconds ago</span> — onSnapshot listeners active on 10 collections
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-emerald-700">LIVE</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: DATA INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════

function DataIntelligenceTab() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      {/* Ask Data Cloud */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Ask Data Cloud</span>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] hover:bg-emerald-100">AI-Powered</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
              <Input
                placeholder="Ask anything about Indian business data... e.g., 'What is the average GST compliance score in Maharashtra?'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/80 border-emerald-200 focus:border-emerald-400 placeholder:text-emerald-300"
              />
              <Button size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 bg-emerald-600 hover:bg-emerald-700">
                <Zap className="h-3.5 w-3.5 mr-1" />
                Ask
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI-Generated Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              AI-Generated Insights from the Data Cloud
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {AI_INSIGHTS.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors"
              >
                <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${
                  insight.impact === 'high' ? 'bg-emerald-100' : 'bg-teal-100'
                }`}>
                  <Zap className={`h-4 w-4 ${insight.impact === 'high' ? 'text-emerald-600' : 'text-teal-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{insight.title}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-200 text-emerald-700">
                      {insight.category}
                    </Badge>
                    <Badge className={`text-[10px] py-0 px-1.5 ${
                      insight.impact === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100'
                    }`}>
                      {insight.impact} impact
                    </Badge>
                  </div>
                </div>
                <div className="shrink-0 mt-1">
                  <Sparkline data={insight.trend} width={90} height={30} color={insight.impact === 'high' ? '#1D4ED8' : '#2563EB'} />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Sector Intelligence */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Sector-wise Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {SECTOR_INTELLIGENCE.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No sector intelligence data yet.
                </div>
              ) : (
                SECTOR_INTELLIGENCE.map((sec, i) => (
                  <motion.div
                    key={sec.sector}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{sec.sector}</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] hover:bg-emerald-50">
                          <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                          {sec.growth}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {sec.dataVolume} data points
                      </div>
                    </div>
                    <Sparkline data={sec.trend} width={80} height={26} color="#1D4ED8" />
                    <div className="text-right shrink-0 w-16">
                      <div className="text-lg font-bold text-emerald-700">{sec.healthScore}</div>
                      <div className="text-[10px] text-muted-foreground">Health</div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Geographic Intelligence */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              Geographic Intelligence — Top 10 States by Data Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {GEO_INTELLIGENCE.map((geo, i) => (
                  <motion.div
                    key={geo.state}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.75 + i * 0.04 }}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-6 text-center">
                      <span className="text-xs font-bold text-emerald-600">#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{geo.state}</span>
                        <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] hover:bg-teal-50">
                          <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                          {geo.growth}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{geo.firms} registered firms</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-emerald-700">{geo.dataVolume}</div>
                      <div className="text-[10px] text-muted-foreground">data points</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: DATA GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════════

function DataGovernanceTab() {
  return (
    <div className="space-y-6">
      {/* Data Quality Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Data Quality Metrics
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time data quality scores computed across all 50,00,00,000+ data points
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {DATA_QUALITY.map((dq, i) => {
                const Icon = dq.icon;
                return (
                  <motion.div
                    key={dq.metric}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                    className="text-center p-4 rounded-xl bg-slate-50/70"
                  >
                    <Icon className="h-5 w-5 mx-auto text-emerald-600 mb-2" />
                    <div className="text-2xl font-bold text-emerald-700">{dq.value}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{dq.metric}</div>
                    <Progress value={dq.value} className="h-1.5 mt-2 bg-slate-200" />
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Privacy & Compliance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              Data Privacy & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50/70 mb-4">
              <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-800">All data encrypted at rest and in transit</div>
                <div className="text-xs text-emerald-600 mt-0.5">AES-256 encryption at rest · TLS 1.3 in transit · HMAC-SHA256 integrity checks</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'PDPA Compliant', icon: ShieldCheck, status: 'Verified' },
                { label: 'GDPR Ready', icon: Shield, status: 'Verified' },
                { label: 'SOC 2 Type II', icon: Lock, status: 'Certified' },
                { label: 'ISO 27001', icon: FileCheck, status: 'Certified' },
              ].map((badge, i) => {
                const Icon = badge.icon;
                return (
                  <div key={badge.label} className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">{badge.label}</div>
                      <div className="text-[10px] text-emerald-600 font-medium">{badge.status}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Retention Policies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Data Retention Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <div className="space-y-0">
                {/* Table Header */}
                <div className="grid grid-cols-4 gap-3 p-2.5 text-xs font-semibold text-muted-foreground border-b">
                  <span>Category</span>
                  <span>Retention</span>
                  <span>Regulation</span>
                  <span>Status</span>
                </div>
                {RETENTION_POLICIES.map((policy, i) => (
                  <div key={i} className="grid grid-cols-4 gap-3 p-2.5 text-sm border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <span className="font-medium text-foreground">{policy.category}</span>
                    <span className="text-muted-foreground">{policy.retention}</span>
                    <span className="text-muted-foreground text-xs">{policy.regulation}</span>
                    <Badge className={`text-[10px] w-fit ${
                      policy.status === 'Compliant'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50'
                    }`}>
                      {policy.status === 'Compliant' ? <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                      {policy.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* Access Control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              Access Control — Who Can Access What Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <div className="space-y-3">
                {ACCESS_CONTROL.map((ac, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50/70">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">{ac.role}</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">{ac.level}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ac.access.map((item) => (
                        <span key={item} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-muted-foreground">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Lineage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-emerald-600" />
              Data Lineage — Sources → Processing → Storage → Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataLineageFlow />
          </CardContent>
        </Card>
      </motion.div>

      {/* Audit Log */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                Audit Log — Recent Data Access Events
              </CardTitle>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">
                <Activity className="h-3 w-3 mr-1" />
                Real-time
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-5 gap-3 p-2.5 text-xs font-semibold text-muted-foreground border-b">
                  <span>Time</span>
                  <span>User</span>
                  <span>Action</span>
                  <span>Resource</span>
                  <span>Status</span>
                </div>
                {AUDIT_LOG.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.65 + i * 0.04 }}
                    className="grid grid-cols-5 gap-3 p-2.5 text-sm border-b border-slate-50 hover:bg-slate-50/70 transition-colors items-center"
                  >
                    <span className="text-xs text-muted-foreground font-mono">{log.time}</span>
                    <span className="text-xs text-foreground font-medium truncate">{log.user}</span>
                    <span className="text-xs text-muted-foreground">{log.action}</span>
                    <span className="text-xs text-muted-foreground truncate">{log.resource}</span>
                    <Badge className={`text-[10px] w-fit ${
                      log.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                        : log.status === 'rate-limited'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50'
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50'
                    }`}>
                      {log.status}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: DATA PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

function DataProductsTab() {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Revenue Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Monthly Revenue from Data Products</div>
                <div className="text-3xl font-bold mt-1">₹2,34,50,000</div>
                <div className="text-xs text-emerald-200 mt-1">
                  <ArrowUpRight className="h-3 w-3 inline mr-0.5" />
                  +34% vs last month · 6 active products · 8 enterprise partners
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">1.34Cr</div>
                  <div className="text-[10px] text-emerald-200">Queries/Month</div>
                </div>
                <div className="w-px h-10 bg-emerald-400/30" />
                <div className="text-center">
                  <div className="text-2xl font-bold">8</div>
                  <div className="text-[10px] text-emerald-200">Partners</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Products Grid */}
      <div className="space-y-4">
        {DATA_PRODUCTS.map((product, i) => {
          const Icon = product.icon;
          const isExpanded = expandedProduct === product.id;

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <Card className={`border-0 shadow-sm transition-all ${isExpanded ? 'ring-1 ring-emerald-200' : ''}`}>
                <CardContent className="p-5">
                  <div
                    className="flex items-start gap-4 cursor-pointer"
                    onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{product.name}</span>
                        <Badge className={`text-[10px] ${
                          product.status === 'live'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50'
                        }`}>
                          {product.status === 'live' ? <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                          {product.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-emerald-700">{product.pricing}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {product.queriesPerMonth} queries/mo
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-muted-foreground shrink-0 mt-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <Separator className="my-4" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Sample Output */}
                          <div>
                            <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                              <Code2 className="h-3.5 w-3.5 text-emerald-600" />
                              Sample Output
                            </div>
                            <pre className="text-[11px] bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-x-auto font-mono">
                              {product.sampleOutput}
                            </pre>
                          </div>
                          {/* API Details */}
                          <div className="space-y-3">
                            <div>
                              <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
                                API Endpoint
                              </div>
                              <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-emerald-700">
                                {product.apiEndpoint}
                              </code>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                                Pricing Model
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">{product.pricingType}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                                Monthly Revenue
                              </div>
                              <div className="text-sm font-bold text-emerald-700">{product.revenue}</div>
                            </div>
                            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                              <Code2 className="h-3.5 w-3.5 mr-1.5" />
                              View API Docs
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Partner Usage Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Partner Usage & Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-4 gap-3 p-2.5 text-xs font-semibold text-muted-foreground border-b">
                  <span>Partner</span>
                  <span>Product</span>
                  <span>Queries/Month</span>
                  <span>Revenue</span>
                </div>
                {PARTNER_USAGE.map((pu, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.75 + i * 0.04 }}
                    className="grid grid-cols-4 gap-3 p-2.5 text-sm border-b border-slate-50 hover:bg-slate-50/70 transition-colors items-center"
                  >
                    <span className="font-medium text-foreground">{pu.partner}</span>
                    <span className="text-xs text-muted-foreground">{pu.product}</span>
                    <span className="text-xs text-muted-foreground font-mono">{pu.queries}</span>
                    <span className="text-sm font-semibold text-emerald-700">{pu.revenue}</span>
                  </motion.div>
                ))}
                {/* Total row */}
                <div className="grid grid-cols-4 gap-3 p-2.5 text-sm font-semibold border-t-2 border-emerald-200 bg-emerald-50/30">
                  <span className="text-foreground">Total</span>
                  <span />
                  <span className="text-muted-foreground font-mono">1,34,00,770</span>
                  <span className="text-emerald-700">₹4,24,50,000</span>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DataCloudPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();
  const { data: returns } = useFireReturns();

  // Compute live stats from Firestore data
  const liveStats = useMemo(() => ({
    totalClients: clients.length,
    totalInvoices: invoices.length,
    totalReturns: returns.length,
  }), [clients, invoices, returns]);

  return (
    <div className="space-y-6 p-1">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">FINANCIAL DATA CLOUD™</h1>
              <p className="text-xs text-muted-foreground">India&apos;s Largest Financial Intelligence Dataset</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <span className="flex h-1.5 w-1.5 mr-1.5">
              <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Live
          </Badge>
          <Badge variant="outline" className="text-emerald-600 border-emerald-200">
            <Database className="h-3 w-3 mr-1" />
            {liveStats.totalClients + liveStats.totalInvoices + liveStats.totalReturns} local records
          </Badge>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 p-1 h-auto">
          <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Data Overview
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Brain className="h-3.5 w-3.5 mr-1.5" />
            Data Intelligence
          </TabsTrigger>
          <TabsTrigger value="governance" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Data Governance
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
            Data Products
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <DataOverviewTab />
        </TabsContent>
        <TabsContent value="intelligence" className="mt-5">
          <DataIntelligenceTab />
        </TabsContent>
        <TabsContent value="governance" className="mt-5">
          <DataGovernanceTab />
        </TabsContent>
        <TabsContent value="products" className="mt-5">
          <DataProductsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
