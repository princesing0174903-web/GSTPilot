'use client';

import React, { useState, useMemo } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Code,
  Key,
  Webhook,
  Zap,
  Shield,
  Activity,
  Terminal,
  Copy,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Globe,
  Lock,
  Server,
  Cpu,
  BarChart3,
  IndianRupee,
  Clock,
  FileText,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  RotateCw,
  Plus,
  Download,
  Check,
  X,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useFireClients,
  useFireInvoices,
} from '@/hooks/use-firestore';
import { EmptyState } from '@/components/shared';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const formatINR = (num: number): string => {
  const str = num.toLocaleString('en-IN');
  return '₹' + str;
};

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-IN');
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════════════════

// --- API Call Trend (30 days) ---
const apiCallTrendData = (() => {
  const data: number[] = [];
  const base = 12000;
  for (let i = 0; i < 30; i++) {
    data.push(Math.round(base + Math.sin(i / 3) * 4000 + 3000 + i * 150));
  }
  return data;
})();

// --- Usage by API Type ---
const usageByType = [
  { name: 'GST', calls: 45230, pct: 32, color: '#2563EB' },
  { name: 'Accounting', calls: 22150, pct: 16, color: '#1D4ED8' },
  { name: 'Invoice', calls: 19870, pct: 14, color: '#047857' },
  { name: 'Payment', calls: 16420, pct: 12, color: '#065f46' },
  { name: 'Reconciliation', calls: 14200, pct: 10, color: '#6ee7b7' },
  { name: 'AI', calls: 12800, pct: 9, color: '#34d399' },
  { name: 'Compliance', calls: 9330, pct: 7, color: '#a7f3d0' },
];

// --- API Keys ---
interface ApiKey {
  id: string;
  key: string;
  name: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'revoked';
  rateLimit: string;
  permissions: string[];
}

const demoApiKeys: ApiKey[] = [];

// --- Webhooks ---
interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'failed';
  lastDelivery: string;
  successRate: number;
}

const demoWebhooks: Webhook[] = [];

// --- Webhook Delivery Log ---
interface DeliveryLog {
  id: string;
  webhookId: string;
  timestamp: string;
  event: string;
  status: 'success' | 'failed';
  responseCode: number;
  latency: string;
}

const demoDeliveryLogs: DeliveryLog[] = [];

// --- OAuth Apps ---
interface OAuthApp {
  id: string;
  name: string;
  clientId: string;
  redirectUri: string;
  status: 'active' | 'disabled';
}

const demoOAuthApps: OAuthApp[] = [];

// --- Integrations ---
interface Integration {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'available' | 'coming_soon';
  icon: string;
}

const demoIntegrations: Integration[] = [];

// --- Billing History ---
interface Invoice {
  id: string;
  date: string;
  amount: string;
  calls: number;
  status: 'paid' | 'pending';
  plan: string;
}

const demoInvoices: Invoice[] = [];

// --- Monthly Usage Trend ---
const monthlyUsage = [
  { month: 'Sep', calls: 4520, cost: 0 },
  { month: 'Oct', calls: 890, cost: 0 },
  { month: 'Nov', calls: 8700, cost: 999 },
  { month: 'Dec', calls: 9800, cost: 999 },
  { month: 'Jan', calls: 92150, cost: 4999 },
  { month: 'Feb', calls: 87420, cost: 4999 },
];

// --- API Categories ---
interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requestExample?: string;
  responseExample?: string;
}

interface ApiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  endpoints: ApiEndpoint[];
}

const apiCategories: ApiCategory[] = [
  {
    id: 'gst',
    name: 'GST APIs',
    icon: <FileText className="h-4 w-4" />,
    description: 'File returns, verify GSTINs, check status, and validate GST data',
    endpoints: [
      { method: 'POST', path: '/api/v1/gst/returns/file', description: 'File a GST return (GSTR-1, GSTR-3B, etc.)', requestExample: '{\n  "gstin": "27AADCB2230F1ZP",\n  "return_type": "GSTR-1",\n  "period": "012025",\n  "data": { ... }\n}', responseExample: '{\n  "arn": "AA110125001234F",\n  "status": "filed",\n  "acknowledged_at": "2025-01-15T10:30:00Z"\n}' },
      { method: 'GET', path: '/api/v1/gst/returns/{arn}/status', description: 'Check filing status by ARN', responseExample: '{\n  "arn": "AA110125001234F",\n  "status": "processed",\n  "processed_at": "2025-01-16T02:15:00Z"\n}' },
      { method: 'GET', path: '/api/v1/gst/gstin/{gstin}', description: 'Get GSTIN details and registration info', responseExample: '{\n  "gstin": "27AADCB2230F1ZP",\n  "legal_name": "ABC Private Limited",\n  "trade_name": "ABC Corp",\n  "status": "active",\n  "state": "Maharashtra"\n}' },
      { method: 'POST', path: '/api/v1/gst/validate', description: 'Validate a GSTIN number', requestExample: '{\n  "gstin": "27AADCB2230F1ZP"\n}', responseExample: '{\n  "valid": true,\n  "gstin": "27AADCB2230F1ZP",\n  "pan": "AADCB2230F",\n  "state_code": "27"\n}' },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounting APIs',
    icon: <BookOpen className="h-4 w-4" />,
    description: 'Journal entries, ledgers, trial balance, and P&L statements',
    endpoints: [
      { method: 'POST', path: '/api/v1/accounting/journal-entries', description: 'Create a journal entry', requestExample: '{\n  "date": "2025-01-15",\n  "entries": [\n    { "account": "Sales", "debit": 50000 },\n    { "account": "GST Payable", "credit": 9000 },\n    { "account": "Revenue", "credit": 41000 }\n  ]\n}', responseExample: '{\n  "id": "je_2025_001",\n  "status": "posted",\n  "created_at": "2025-01-15T10:30:00Z"\n}' },
      { method: 'GET', path: '/api/v1/accounting/ledger/{account}', description: 'Get ledger for an account', responseExample: '{\n  "account": "Sales",\n  "entries": [...],\n  "balance": 1245000\n}' },
      { method: 'GET', path: '/api/v1/accounting/trial-balance', description: 'Get trial balance as of a date', responseExample: '{\n  "as_of": "2025-01-31",\n  "debit_total": 4560000,\n  "credit_total": 4560000,\n  "accounts": [...]\n}' },
      { method: 'GET', path: '/api/v1/accounting/profit-loss', description: 'Get profit & loss statement', responseExample: '{\n  "period": "FY2024-25",\n  "revenue": 8950000,\n  "expenses": 6230000,\n  "net_profit": 2720000\n}' },
    ],
  },
  {
    id: 'invoice',
    name: 'Invoice APIs',
    icon: <FileText className="h-4 w-4" />,
    description: 'Create, retrieve, list, cancel invoices and generate e-invoices',
    endpoints: [
      { method: 'POST', path: '/api/v1/invoices', description: 'Create a new invoice', requestExample: '{\n  "customer_gstin": "27AADCB2230F1ZP",\n  "items": [\n    { "description": "Consulting", "amount": 50000, "gst_rate": 18 }\n  ],\n  "e_invoice": true\n}', responseExample: '{\n  "id": "inv_9f8e7d",\n  "irn": "abc123...",\n  "ack_no": "123456789",\n  "status": "created"\n}' },
      { method: 'GET', path: '/api/v1/invoices/{id}', description: 'Get invoice by ID', responseExample: '{\n  "id": "inv_9f8e7d",\n  "amount": 59000,\n  "gst": 9000,\n  "status": "created"\n}' },
      { method: 'GET', path: '/api/v1/invoices', description: 'List all invoices with filters', responseExample: '{\n  "data": [...],\n  "total": 245,\n  "has_more": true\n}' },
      { method: 'POST', path: '/api/v1/invoices/{id}/cancel', description: 'Cancel an invoice', requestExample: '{\n  "reason": "Wrong details"\n}', responseExample: '{\n  "id": "inv_9f8e7d",\n  "status": "cancelled"\n}' },
      { method: 'POST', path: '/api/v1/e-invoice/generate', description: 'Generate e-invoice via IRN', requestExample: '{\n  "invoice_id": "inv_9f8e7d"\n}', responseExample: '{\n  "irn": "abc123...",\n  "ack_no": "123456789",\n  "signed_qr": "..."\n}' },
    ],
  },
  {
    id: 'payment',
    name: 'Payment APIs',
    icon: <IndianRupee className="h-4 w-4" />,
    description: 'Create payment links, collect UPI, verify, and process refunds',
    endpoints: [
      { method: 'POST', path: '/api/v1/payments/links', description: 'Create a payment link', requestExample: '{\n  "amount": 59000,\n  "currency": "INR",\n  "description": "Invoice #INV-001",\n  "upi": true\n}', responseExample: '{\n  "id": "plink_abc123",\n  "url": "https://pay.gstpilot.in/abc123",\n  "upi_intent": "upi://pay?..."\n}' },
      { method: 'POST', path: '/api/v1/payments/collect-upi', description: 'Collect payment via UPI', requestExample: '{\n  "vpa": "merchant@upi",\n  "amount": 59000\n}', responseExample: '{\n  "id": "pay_xyz789",\n  "status": "pending",\n  "expires_at": "2025-01-15T11:00:00Z"\n}' },
      { method: 'GET', path: '/api/v1/payments/{id}/verify', description: 'Verify payment status', responseExample: '{\n  "id": "pay_xyz789",\n  "status": "captured",\n  "method": "upi",\n  "captured_at": "2025-01-15T10:45:00Z"\n}' },
      { method: 'POST', path: '/api/v1/payments/{id}/refund', description: 'Process a refund', requestExample: '{\n  "amount": 59000,\n  "reason": "Duplicate payment"\n}', responseExample: '{\n  "id": "rfn_abc456",\n  "status": "processed",\n  "amount": 59000\n}' },
    ],
  },
  {
    id: 'reconciliation',
    name: 'Reconciliation APIs',
    icon: <RefreshCw className="h-4 w-4" />,
    description: 'Match 2A/2B data, auto-reconcile, and get mismatch reports',
    endpoints: [
      { method: 'POST', path: '/api/v1/reconciliation/match-2a2b', description: 'Match GSTR-2A/2B with purchase register', requestExample: '{\n  "gstin": "27AADCB2230F1ZP",\n  "period": "012025",\n  "auto_match": true\n}', responseExample: '{\n  "matched": 142,\n  "mismatched": 8,\n  "missing_in_2a": 3,\n  "missing_in_books": 2,\n  "itc_available": 456000\n}' },
      { method: 'POST', path: '/api/v1/reconciliation/auto-reconcile', description: 'Auto-reconcile using AI', requestExample: '{\n  "gstin": "27AADCB2230F1ZP",\n  "period": "012025"\n}', responseExample: '{\n  "reconciliation_id": "rec_abc123",\n  "auto_matched": 138,\n  "suggestions": 12\n}' },
      { method: 'GET', path: '/api/v1/reconciliation/mismatches/{gstin}', description: 'Get mismatch details', responseExample: '{\n  "mismatches": [\n    { "type": "amount_mismatch", "count": 5, "itc_diff": 23000 },\n    { "type": "gst_mismatch", "count": 3, "itc_diff": 12000 }\n  ]\n}' },
    ],
  },
  {
    id: 'business-graph',
    name: 'Business Graph APIs',
    icon: <Globe className="h-4 w-4" />,
    description: 'Query business entities, get relationships, and search the graph',
    endpoints: [
      { method: 'GET', path: '/api/v1/graph/entities/{gstin}', description: 'Query entity by GSTIN', responseExample: '{\n  "gstin": "27AADCB2230F1ZP",\n  "directors": [...],\n  "related_entities": 12,\n  "risk_score": 0.15\n}' },
      { method: 'GET', path: '/api/v1/graph/relationships/{gstin}', description: 'Get entity relationships', responseExample: '{\n  "relationships": [\n    { "type": "director", "entity": "29AADCB5567G1Z5" },\n    { "type": "supplier", "entity": "06AADCB8890H1Z3" }\n  ]\n}' },
      { method: 'POST', path: '/api/v1/graph/search', description: 'Search the business graph', requestExample: '{\n  "query": "ABC Corp directors",\n  "depth": 2\n}', responseExample: '{\n  "results": [...],\n  "total": 15\n}' },
    ],
  },
  {
    id: 'ai',
    name: 'AI APIs',
    icon: <Cpu className="h-4 w-4" />,
    description: 'AI copilot chat, document extraction, predictions, and classification',
    endpoints: [
      { method: 'POST', path: '/api/v1/ai/copilot/chat', description: 'Chat with AI copilot', requestExample: '{\n  "message": "What is the ITC available for January?",\n  "context": { "gstin": "27AADCB2230F1ZP" }\n}', responseExample: '{\n  "response": "Your ITC for January 2025 is ₹4,56,000...",\n  "confidence": 0.95,\n  "sources": [...]\n}' },
      { method: 'POST', path: '/api/v1/ai/extract-document', description: 'Extract data from document', requestExample: '{\n  "document_url": "https://...",\n  "type": "invoice"\n}', responseExample: '{\n  "extracted_data": { "gstin": "...", "amount": 59000 },\n  "confidence": 0.97\n}' },
      { method: 'POST', path: '/api/v1/ai/predict', description: 'Get AI predictions', requestExample: '{\n  "type": "cash_flow",\n  "gstin": "27AADCB2230F1ZP",\n  "months": 3\n}', responseExample: '{\n  "predictions": [\n    { "month": "Mar 2025", "predicted_revenue": 950000 }\n  ]\n}' },
      { method: 'POST', path: '/api/v1/ai/classify', description: 'Classify a transaction or document', requestExample: '{\n  "text": "Professional fees received from client",\n  "categories": ["revenue", "expense", "asset"]\n}', responseExample: '{\n  "classification": "revenue",\n  "confidence": 0.92,\n  "subcategory": "professional_fees"\n}' },
    ],
  },
  {
    id: 'notification',
    name: 'Notification APIs',
    icon: <Activity className="h-4 w-4" />,
    description: 'Send email, WhatsApp, SMS, and push notifications',
    endpoints: [
      { method: 'POST', path: '/api/v1/notifications/email', description: 'Send email notification', requestExample: '{\n  "to": "client@example.com",\n  "template": "return_filed",\n  "data": { "arn": "AA110125001234F" }\n}', responseExample: '{\n  "id": "notif_abc123",\n  "status": "sent"\n}' },
      { method: 'POST', path: '/api/v1/notifications/whatsapp', description: 'Send WhatsApp message', requestExample: '{\n  "phone": "+919876543210",\n  "template": "payment_reminder",\n  "data": { "amount": "₹59,000" }\n}', responseExample: '{\n  "id": "notif_wa_456",\n  "status": "delivered"\n}' },
      { method: 'POST', path: '/api/v1/notifications/sms', description: 'Send SMS notification', requestExample: '{\n  "phone": "+919876543210",\n  "message": "Your GST return has been filed. ARN: AA110125001234F"\n}', responseExample: '{\n  "id": "notif_sms_789",\n  "status": "sent"\n}' },
      { method: 'POST', path: '/api/v1/notifications/push', description: 'Send push notification', requestExample: '{\n  "user_id": "usr_123",\n  "title": "Return Filed",\n  "body": "GSTR-1 filed successfully"\n}', responseExample: '{\n  "id": "notif_push_012",\n  "status": "delivered"\n}' },
    ],
  },
  {
    id: 'compliance',
    name: 'Compliance APIs',
    icon: <Shield className="h-4 w-4" />,
    description: 'Check compliance status, file returns, and get notices',
    endpoints: [
      { method: 'GET', path: '/api/v1/compliance/check/{gstin}', description: 'Check compliance status for a GSTIN', responseExample: '{\n  "gstin": "27AADCB2230F1ZP",\n  "score": 87,\n  "pending_returns": 1,\n  "notices": 0\n}' },
      { method: 'POST', path: '/api/v1/compliance/file', description: 'File a compliance document', requestExample: '{\n  "type": "GSTR-3B",\n  "gstin": "27AADCB2230F1ZP",\n  "period": "012025"\n}', responseExample: '{\n  "filing_id": "fil_abc123",\n  "status": "submitted"\n}' },
      { method: 'GET', path: '/api/v1/compliance/notices/{gstin}', description: 'Get compliance notices', responseExample: '{\n  "notices": [\n    { "type": "ASN", "date": "2025-01-10", "status": "open" }\n  ]\n}' },
    ],
  },
  {
    id: 'document',
    name: 'Document APIs',
    icon: <FileText className="h-4 w-4" />,
    description: 'Upload, extract, classify, and store documents',
    endpoints: [
      { method: 'POST', path: '/api/v1/documents/upload', description: 'Upload a document', requestExample: '{\n  "file": "<binary>",\n  "type": "invoice",\n  "client_gstin": "27AADCB2230F1ZP"\n}', responseExample: '{\n  "id": "doc_abc123",\n  "status": "uploaded",\n  "extraction_started": true\n}' },
      { method: 'POST', path: '/api/v1/documents/extract/{id}', description: 'Extract data from document', responseExample: '{\n  "id": "doc_abc123",\n  "extracted": { "amount": 59000, "gstin": "27..." },\n  "confidence": 0.97\n}' },
      { method: 'POST', path: '/api/v1/documents/classify/{id}', description: 'Classify document type', responseExample: '{\n  "id": "doc_abc123",\n  "type": "tax_invoice",\n  "confidence": 0.94\n}' },
      { method: 'GET', path: '/api/v1/documents/{id}', description: 'Get stored document details', responseExample: '{\n  "id": "doc_abc123",\n  "url": "https://storage.gstpilot.in/...",\n  "metadata": {...}\n}' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function ApiCallTrendChart() {
  const data = apiCallTrendData;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 700;
  const h = 160;
  const padX = 0;
  const padY = 10;

  const points = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (v - min) / (max - min)) * (h - padY * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#trendGrad)" />
      <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="#2563EB" />
    </svg>
  );
}

function UsageByTypeChart() {
  const maxCalls = Math.max(...usageByType.map(u => u.calls));
  return (
    <div className="space-y-3">
      {usageByType.map((item) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-600 w-28 text-right">{item.name}</span>
          <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' as const }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>
          <span className="text-xs text-slate-500 w-20">{formatNumber(item.calls)}</span>
        </div>
      ))}
    </div>
  );
}

// Pre-compute donut segments outside render
const donutTotal = usageByType.reduce((s, d) => s + d.calls, 0);
const donutR = 55;
const donutCircumference = 2 * Math.PI * donutR;

const donutSegments = (() => {
  let offset = 0;
  return usageByType.map((item) => {
    const pct = item.calls / donutTotal;
    const dashLength = pct * donutCircumference;
    const dashOffset = -offset * donutCircumference;
    offset += pct;
    return { ...item, dashLength, dashOffset, pct };
  });
})();

function UsageDonutChart() {
  const total = donutTotal;
  const cx = 80;
  const cy = 80;
  const r = donutR;
  const strokeWidth = 28;
  const circumference = donutCircumference;
  const segments = donutSegments;

  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48">
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
          strokeDashoffset={seg.dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-all duration-500"
        />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-slate-800 text-lg font-bold" style={{ fontSize: '18px' }}>
        {formatNumber(total)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="fill-slate-400 text-xs" style={{ fontSize: '10px' }}>
        total calls
      </text>
    </svg>
  );
}

function UsageBarChart() {
  const maxCalls = Math.max(...monthlyUsage.map(m => m.calls));
  return (
    <div className="flex items-end gap-3 h-36">
      {monthlyUsage.map((item) => {
        const height = (item.calls / maxCalls) * 100;
        return (
          <div key={item.month} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[10px] text-slate-500 font-medium">
              {item.calls > 1000 ? `${(item.calls / 1000).toFixed(0)}K` : item.calls}
            </span>
            <div className="w-full bg-slate-100 rounded-t-sm relative" style={{ height: `${height}%` }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: '100%' }}
                transition={{ duration: 0.6, ease: 'easeOut' as const }}
                className="absolute bottom-0 w-full rounded-t-sm"
                style={{ backgroundColor: item.cost > 0 ? '#2563EB' : '#d1d5db' }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{item.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsCharts() {
  // Request volume mini chart
  const volData = [65, 72, 80, 68, 75, 90, 85, 92, 88, 95, 78, 82];
  const maxV = Math.max(...volData);
  const volPoints = volData.map((v, i) => {
    const x = (i / (volData.length - 1)) * 200;
    const y = 40 - (v / maxV) * 35;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Request Volume</span>
            <span className="text-xs text-emerald-600 font-semibold">+12.4%</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">1.4M</div>
          <div className="text-[10px] text-slate-400 mb-2">last 30 days</div>
          <svg viewBox="0 0 200 50" className="w-full h-12">
            <path d={volPoints} fill="none" stroke="#2563EB" strokeWidth="2" />
          </svg>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Error Rate</span>
            <span className="text-xs text-red-500 font-semibold">0.23%</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">0.23%</div>
          <div className="text-[10px] text-slate-400 mb-2">p99 latency: 342ms</div>
          <div className="w-full h-12 flex items-end gap-[2px]">
            {[0.3, 0.2, 0.4, 0.1, 0.3, 0.2, 0.5, 0.1, 0.2, 0.3, 0.4, 0.2].map((v, i) => (
              <div key={i} className="flex-1 bg-red-400/60 rounded-t-sm" style={{ height: `${v * 100}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Avg Latency</span>
            <span className="text-xs text-emerald-600 font-semibold">-8ms</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">127ms</div>
          <div className="text-[10px] text-slate-400 mb-2">p50: 89ms · p99: 342ms</div>
          <div className="w-full h-12 flex items-end gap-[2px]">
            {[180, 165, 150, 145, 140, 135, 130, 128, 125, 127, 124, 127].map((v, i) => (
              <div key={i} className="flex-1 bg-emerald-400/60 rounded-t-sm" style={{ height: `${(v / 200) * 100}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CODE SNIPPET COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CodeSnippet({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple syntax highlighting via color spans
  const highlight = (text: string, lang: string) => {
    if (lang === 'curl') {
      return text
        .replace(/(curl)/g, '<span class="text-emerald-400 font-semibold">$1</span>')
        .replace(/(-[A-Z])/g, '<span class="text-amber-400">$1</span>')
        .replace(/(https?:\/\/[^\s'"]+)/g, '<span class="text-sky-400">$1</span>')
        .replace(/("[^"]*")/g, '<span class="text-orange-300">$1</span>')
        .replace(/(gpi_live_sk_\w+)/g, '<span class="text-pink-400">$1</span>');
    }
    if (lang === 'javascript' || lang === 'typescript') {
      return text
        .replace(/(import|from|const|await|new)/g, '<span class="text-purple-400">$1</span>')
        .replace(/(Gstpilot|gstpilot)/g, '<span class="text-emerald-400">$1</span>')
        .replace(/('[^']*')/g, '<span class="text-orange-300">$1</span>')
        .replace(/("[^"]*")/g, '<span class="text-orange-300">$1</span>')
        .replace(/(\b\d+\b)/g, '<span class="text-sky-400">$1</span>')
        .replace(/(\/\/.*)/g, '<span class="text-slate-500">$1</span>')
        .replace(/(gpi_live_sk_\w+)/g, '<span class="text-pink-400">$1</span>');
    }
    if (lang === 'python') {
      return text
        .replace(/(import|from|def|await|print)/g, '<span class="text-purple-400">$1</span>')
        .replace(/(Gstpilot|gstpilot)/g, '<span class="text-emerald-400">$1</span>')
        .replace(/('[^']*')/g, '<span class="text-orange-300">$1</span>')
        .replace(/("[^"]*")/g, '<span class="text-orange-300">$1</span>')
        .replace(/(#.*)/g, '<span class="text-slate-500">$1</span>')
        .replace(/(gpi_live_sk_\w+)/g, '<span class="text-pink-400">$1</span>');
    }
    return text;
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: highlight(code, language) }} />
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/80 hover:bg-slate-600 text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// METHOD BADGE
// ═══════════════════════════════════════════════════════════════════════════════

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    POST: 'bg-amber-100 text-amber-700 border-amber-200',
    PUT: 'bg-sky-100 text-sky-700 border-sky-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${colors[method] || 'bg-slate-100 text-slate-600'}`}>
      {method}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function APIPlatformPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [codeTab, setCodeTab] = useState<'curl' | 'node' | 'python'>('curl');
  const [env, setEnv] = useState<'live' | 'sandbox'>('live');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [tryItOpen, setTryItOpen] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>(['gst']);
  const [newKeyRate, setNewKeyRate] = useState('1000');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newOAuthName, setNewOAuthName] = useState('');
  const [newOAuthRedirect, setNewOAuthRedirect] = useState('');
  const [costCalcApis, setCostCalcApis] = useState<string[]>(['gst']);

  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();

  // Compute live stats
  const totalClients = clients?.length || 127;
  const totalInvoices = invoices?.length || 1420;
  const liveApiCalls = 140000;

  const toggleKeyVisibility = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    return key.slice(0, 12) + '••••••••••••••••••••';
  };

  // --- Code Snippets ---
  const codeSnippets: Record<string, string> = {
    curl: `curl -X POST https://api.gstpilot.in/v1/gst/returns/file \\
  -H "Authorization: Bearer gpi_live_sk_a4k8m2n9p1q3r5s7" \\
  -H "Content-Type: application/json" \\
  -d '{
    "gstin": "27AADCB2230F1ZP",
    "return_type": "GSTR-1",
    "period": "012025",
    "data": { "b2b": [...] }
  }'`,
    node: `import Gstpilot from 'gstpilot-sdk';

const client = new Gstpilot('gpi_live_sk_a4k8m2n9p1q3r5s7');

// File a GST return
const filing = await client.gst.returns.file({
  gstin: '27AADCB2230F1ZP',
  return_type: 'GSTR-1',
  period: '012025',
  data: { b2b: [...] }
});

console.log(filing.arn); // AA110125001234F`,
    python: `import gstpilot

client = gstpilot.Client('gpi_live_sk_a4k8m2n9p1q3r5s7')

# File a GST return
filing = client.gst.returns.file(
    gstin='27AADCB2230F1ZP',
    return_type='GSTR-1',
    period='012025',
    data={'b2b': [...]}
)

print(filing.arn)  # AA110125001234F`,
  };

  // --- Cost Calculator ---
  const apiCosts: Record<string, { name: string; perCall: number }> = {
    gst: { name: 'GST', perCall: 0.50 },
    accounting: { name: 'Accounting', perCall: 0.75 },
    invoice: { name: 'Invoice', perCall: 0.60 },
    payment: { name: 'Payment', perCall: 1.00 },
    reconciliation: { name: 'Reconciliation', perCall: 0.80 },
    ai: { name: 'AI', perCall: 2.00 },
    compliance: { name: 'Compliance', perCall: 0.50 },
  };

  const estimatedCost = useMemo(() => {
    const monthlyCalls = 50000; // assumed
    const avgCost = costCalcApis.reduce((sum, api) => sum + apiCosts[api].perCall, 0) / Math.max(costCalcApis.length, 1);
    return Math.round(monthlyCalls * avgCost);
  }, [costCalcApis]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: API DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 md:p-8"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
              <Code className="h-4 w-4 text-white" />
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
              DEVELOPER PLATFORM
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            GSTPilot API Platform™
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-xl">
            Stripe for Financial APIs in India — Build powerful GST, accounting, and compliance apps with our production-ready REST APIs.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
              <Key className="h-4 w-4" />
              Get API Key
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 gap-2">
              <BookOpen className="h-4 w-4" />
              Read Docs
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total API Calls', value: formatNumber(liveApiCalls), icon: Activity, change: '+18.3%' },
          { label: 'Active Keys', value: '4', icon: Key, change: '+1' },
          { label: 'Webhooks', value: '3', icon: Webhook, change: 'Active' },
          { label: 'Integrations', value: '4', icon: Globe, change: 'Connected' },
          { label: 'Uptime', value: '99.97%', icon: Shield, change: '30 days' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="h-4 w-4 text-emerald-500" />
                  <Badge variant="secondary" className="text-[9px] px-1.5">{stat.change}</Badge>
                </div>
                <div className="text-xl font-bold text-slate-800">{stat.value}</div>
                <div className="text-[11px] text-slate-500">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">API Call Trend — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ApiCallTrendChart />
            <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Usage by API Type</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageByTypeChart />
          </CardContent>
        </Card>
      </div>

      {/* Quick Start */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" />
              Quick Start
            </CardTitle>
            <div className="flex gap-1">
              {(['curl', 'node', 'python'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCodeTab(tab)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    codeTab === tab
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'node' ? 'Node.js' : tab === 'python' ? 'Python' : 'cURL'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={codeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              <CodeSnippet code={codeSnippets[codeTab]} language={codeTab === 'node' ? 'javascript' : codeTab} />
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" /> Production-ready</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-500" /> Bank-grade security</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-emerald-500" /> &lt;100ms avg latency</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2: API REFERENCE
  // ═══════════════════════════════════════════════════════════════════════════

  const renderApiReference = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">API Reference</h2>
          <p className="text-sm text-slate-500">Complete documentation for all GSTPilot API endpoints</p>
        </div>
        <Badge variant="secondary" className="text-xs">v1.0</Badge>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {apiCategories.map((category) => (
          <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-4 border-slate-200">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                  {category.icon}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-800">{category.name}</div>
                  <div className="text-[11px] text-slate-500 font-normal">{category.description}</div>
                </div>
                <Badge variant="outline" className="text-[10px] ml-2">{category.endpoints.length} endpoints</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {category.endpoints.map((ep, idx) => (
                  <div key={idx} className="border border-slate-100 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50">
                      <MethodBadge method={ep.method} />
                      <code className="text-xs font-mono text-slate-700">{ep.path}</code>
                      <span className="text-[11px] text-slate-500 ml-2">{ep.description}</span>
                    </div>
                    <div className="p-3 space-y-2">
                      {ep.requestExample && (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Request</div>
                          <CodeSnippet code={ep.requestExample} language="javascript" />
                        </div>
                      )}
                      {ep.responseExample && (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Response</div>
                          <CodeSnippet code={ep.responseExample} language="javascript" />
                        </div>
                      )}
                      <Dialog open={tryItOpen === `${category.id}-${idx}`} onOpenChange={(open) => setTryItOpen(open ? `${category.id}-${idx}` : null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7">
                            <Play className="h-3 w-3" />
                            Try it
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-sm flex items-center gap-2">
                              <MethodBadge method={ep.method} />
                              {ep.path}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div className="text-xs text-slate-500">Base URL</div>
                            <Input
                              value={`https://api.gstpilot.in${ep.path}`}
                              readOnly
                              className="text-xs font-mono"
                            />
                            <div className="text-xs text-slate-500">Request Body</div>
                            <div className="bg-slate-50 border rounded p-3 text-xs font-mono text-slate-600 h-24 overflow-auto">
                              {ep.requestExample || '// No request body required'}
                            </div>
                            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8">
                              Send Request
                            </Button>
                            <div className="bg-slate-50 border rounded p-3 text-xs text-slate-400 h-20 overflow-auto">
                              Response will appear here...
                            </div>
                            <p className="text-[10px] text-slate-400 text-center">
                              Try-it is a preview. Use your API key in production.
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3: API KEYS & WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderKeysAndWebhooks = () => (
    <div className="space-y-6">
      {/* API Keys Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Key className="h-5 w-5 text-emerald-500" />
              API Keys
            </h2>
            <p className="text-sm text-slate-500">Manage your API keys and permissions</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 text-xs h-8">
                <Plus className="h-3.5 w-3.5" />
                Create New Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Key Name</Label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production Key"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Permissions</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['gst', 'accounting', 'invoice', 'payment', 'reconciliation', 'ai', 'compliance', 'notification'].map((perm) => (
                      <div key={perm} className="flex items-center gap-2">
                        <Checkbox
                          checked={newKeyPerms.includes(perm)}
                          onCheckedChange={(checked) => {
                            setNewKeyPerms(prev =>
                              checked ? [...prev, perm] : prev.filter(p => p !== perm)
                            );
                          }}
                        />
                        <span className="text-xs capitalize">{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium">Rate Limit</Label>
                  <div className="flex gap-2 mt-2">
                    {['100', '500', '1000', '2000'].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setNewKeyRate(rate)}
                        className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                          newKeyRate === rate
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {rate}/min
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  Create API Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Key</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Created</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Last Used</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Rate Limit</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {demoApiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10">
                      <EmptyState
                        icon={Key}
                        title="No API keys yet"
                        description="Generate your first API key to start using the GSTPilot API."
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  demoApiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {showKey[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                          </code>
                          <button onClick={() => toggleKeyVisibility(apiKey.id)} className="text-slate-400 hover:text-slate-600">
                            {showKey[apiKey.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{apiKey.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{apiKey.created}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{apiKey.lastUsed}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${
                          apiKey.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {apiKey.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">{apiKey.rateLimit}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-slate-500 hover:text-slate-700">
                            <RotateCw className="h-3 w-3" />
                            Rotate
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3 w-3" />
                            Revoke
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Rate Limits Overview */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            Rate Limit Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {demoApiKeys.filter(k => k.status === 'active').length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No rate limit data yet"
                description="Rate limit usage will appear here once you have active API keys."
                compact
              />
            ) : (
              demoApiKeys.filter(k => k.status === 'active').map((apiKey) => {
                const usage = 0;
                return (
                  <div key={apiKey.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{apiKey.name}</span>
                      <span className="text-slate-500">{usage}% of {apiKey.rateLimit}</span>
                    </div>
                    <Progress value={usage} className="h-2" />
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Webhooks Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Webhook className="h-5 w-5 text-emerald-500" />
              Webhooks
            </h2>
            <p className="text-sm text-slate-500">Configure webhook endpoints for real-time events</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 text-xs h-8">
                <Plus className="h-3.5 w-3.5" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook Endpoint</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Endpoint URL</Label>
                  <Input
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder="https://api.yourapp.com/webhooks"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Events</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['return.filed', 'return.failed', 'invoice.created', 'invoice.cancelled', 'e-invoice.generated', 'payment.received', 'payment.failed', 'gstin.verified', 'reconciliation.complete', 'compliance.alert'].map((evt) => (
                      <div key={evt} className="flex items-center gap-2">
                        <Checkbox
                          checked={newWebhookEvents.includes(evt)}
                          onCheckedChange={(checked) => {
                            setNewWebhookEvents(prev =>
                              checked ? [...prev, evt] : prev.filter(e => e !== evt)
                            );
                          }}
                        />
                        <span className="text-[11px] font-mono text-slate-600">{evt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  Add Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">URL</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Events</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Last Delivery</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {demoWebhooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10">
                      <EmptyState
                        icon={Webhook}
                        title="No webhooks yet"
                        description="Add a webhook endpoint to receive real-time event notifications."
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  demoWebhooks.map((wh) => (
                    <tr key={wh.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <code className="text-[11px] font-mono text-slate-600 max-w-[200px] truncate block">{wh.url}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((evt) => (
                            <Badge key={evt} variant="outline" className="text-[9px] px-1.5 py-0">{evt}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${
                          wh.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {wh.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{wh.lastDelivery}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={wh.successRate} className="h-2 flex-1" />
                          <span className={`text-xs font-medium ${wh.successRate > 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {wh.successRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Delivery Log */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Recent Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {demoDeliveryLogs.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No delivery logs yet"
                  description="Recent webhook delivery attempts will appear here once events fire."
                  compact
                />
              ) : (
                demoDeliveryLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono text-slate-600">{log.event}</code>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                          log.responseCode >= 200 && log.responseCode < 300
                            ? 'text-emerald-600 border-emerald-200'
                            : 'text-red-600 border-red-200'
                        }`}>
                          {log.responseCode}
                        </Badge>
                        <span className="text-[10px] text-slate-400">{log.latency}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4: DEVELOPER CONSOLE
  // ═══════════════════════════════════════════════════════════════════════════

  const renderDeveloperConsole = () => (
    <div className="space-y-6">
      {/* Sandbox Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Developer Console</h2>
          <p className="text-sm text-slate-500">SDKs, OAuth apps, and integrations</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${env === 'live' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {env === 'live' ? 'Live' : 'Sandbox'}
          </span>
          <button
            onClick={() => setEnv(env === 'live' ? 'sandbox' : 'live')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              env === 'live' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                env === 'live' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <Badge className={`text-[10px] ${
            env === 'live'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {env === 'live' ? 'PRODUCTION' : 'SANDBOX'}
          </Badge>
        </div>
      </div>

      {/* SDK Downloads */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Download className="h-4 w-4 text-emerald-500" />
            SDK Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { lang: 'Node.js', cmd: 'npm install gstpilot-sdk', icon: '🟢' },
              { lang: 'Python', cmd: 'pip install gstpilot', icon: '🐍' },
              { lang: 'Java', cmd: 'implementation \'in.gstpilot:sdk:1.0.0\'', icon: '☕' },
              { lang: 'Go', cmd: 'go get github.com/gstpilot/go-sdk', icon: '🔵' },
              { lang: 'PHP', cmd: 'composer require gstpilot/sdk', icon: '🐘' },
            ].map((sdk) => (
              <div key={sdk.lang} className="border border-slate-100 rounded-lg p-3 hover:border-emerald-200 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{sdk.icon}</span>
                  <span className="text-sm font-semibold text-slate-700">{sdk.lang}</span>
                </div>
                <div className="bg-slate-900 text-slate-200 p-2 rounded text-[10px] font-mono flex items-center justify-between">
                  <span className="truncate">{sdk.cmd}</span>
                  <Copy className="h-3 w-3 shrink-0 ml-2 cursor-pointer hover:text-emerald-400" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OAuth Apps */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-500" />
              OAuth Applications
            </CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7">
                  <Plus className="h-3 w-3" />
                  Register App
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register OAuth Application</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium">App Name</Label>
                    <Input
                      value={newOAuthName}
                      onChange={(e) => setNewOAuthName(e.target.value)}
                      placeholder="e.g., My Integration App"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Redirect URI</Label>
                    <Input
                      value={newOAuthRedirect}
                      onChange={(e) => setNewOAuthRedirect(e.target.value)}
                      placeholder="https://yourapp.com/oauth/callback"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Scopes</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['read:gst', 'write:gst', 'read:invoices', 'write:invoices', 'read:payments', 'write:payments'].map((scope) => (
                        <div key={scope} className="flex items-center gap-2">
                          <Checkbox />
                          <span className="text-[11px] font-mono text-slate-600">{scope}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                    Register Application
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">App Name</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Client ID</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Redirect URI</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {demoOAuthApps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10">
                      <EmptyState
                        icon={Lock}
                        title="No OAuth applications yet"
                        description="Register an OAuth application to enable third-party integrations."
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  demoOAuthApps.map((app) => (
                    <tr key={app.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{app.name}</td>
                      <td className="px-4 py-2.5">
                        <code className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{app.clientId}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="text-[11px] font-mono text-slate-500 truncate block max-w-[200px]">{app.redirectUri}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[10px] ${
                          app.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {app.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Integration Catalog */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-500" />
            Integration Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {demoIntegrations.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Server}
                  title="No integrations available yet"
                  description="Connected and available integrations will appear here once configured."
                  compact
                />
              </div>
            ) : (
              demoIntegrations.map((int) => (
                <motion.div
                  key={int.id}
                  whileHover={{ scale: 1.02 }}
                  className="border border-slate-100 rounded-lg p-3 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{int.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-slate-700">{int.name}</div>
                      <div className="text-[10px] text-slate-400">{int.category}</div>
                    </div>
                  </div>
                  <Badge className={`text-[9px] ${
                    int.status === 'connected'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : int.status === 'available'
                        ? 'bg-sky-100 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {int.status === 'connected' ? 'Connected' : int.status === 'available' ? 'Available' : 'Coming Soon'}
                  </Badge>
                </motion.div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Analytics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          API Analytics
        </h3>
        <AnalyticsCharts />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 5: USAGE & BILLING
  // ═══════════════════════════════════════════════════════════════════════════

  const renderUsageBilling = () => (
    <div className="space-y-6">
      {/* Current Billing Cycle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-slate-500">API Calls This Month</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatNumber(87420)}</div>
            <div className="flex items-center justify-between mt-2">
              <Progress value={87.4} className="h-2 flex-1" />
              <span className="text-[10px] text-slate-400 ml-2">87.4% of 100K</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-slate-500">Current Cost</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatINR(4999)}</div>
            <div className="text-[10px] text-slate-400 mt-1">Pro Plan · Renews 01 Mar 2025</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-slate-500">Next Billing Date</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">01 Mar</div>
            <div className="text-[10px] text-slate-400 mt-1">12 days remaining</div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Breakdown + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Usage Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <UsageDonutChart />
              <div className="flex-1 space-y-2">
                {usageByType.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-slate-600 flex-1">{item.name}</span>
                    <span className="text-xs font-medium text-slate-700">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Usage Trend — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageBarChart />
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Paid Plan
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> Free Plan
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Tiers */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Pricing Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { name: 'Free', calls: '1,000', price: '₹0', features: ['1,000 API calls/mo', '1 API key', 'Community support', 'Sandbox access'], current: false },
              { name: 'Starter', calls: '10,000', price: '₹999/mo', features: ['10,000 API calls/mo', '3 API keys', 'Email support', 'Webhooks (5)', 'Basic analytics'], current: false },
              { name: 'Pro', calls: '100,000', price: '₹4,999/mo', features: ['100,000 API calls/mo', '10 API keys', 'Priority support', 'Webhooks (25)', 'Advanced analytics', 'AI APIs access'], current: true },
              { name: 'Enterprise', calls: 'Unlimited', price: 'Custom', features: ['Unlimited API calls', 'Unlimited keys', 'Dedicated support', 'Custom webhooks', 'SLA guarantee', 'On-premise option', 'SSO/SAML'], current: false },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`border rounded-lg p-4 ${
                  tier.current
                    ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                    : 'border-slate-200 hover:border-emerald-200'
                } transition-colors`}
              >
                {tier.current && (
                  <Badge className="bg-emerald-500 text-white text-[9px] mb-2">CURRENT PLAN</Badge>
                )}
                <div className="text-base font-bold text-slate-800">{tier.name}</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{tier.price}</div>
                <div className="text-[11px] text-slate-500 mb-3">{tier.calls} API calls/mo</div>
                <Separator className="my-3" />
                <ul className="space-y-1.5">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full mt-4 text-xs h-8 ${
                    tier.current
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                  variant={tier.current ? 'secondary' : 'default'}
                >
                  {tier.current ? 'Current Plan' : 'Upgrade'}
                  {!tier.current && <ArrowRight className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-500" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Invoice</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Plan</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">API Calls</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Amount</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {demoInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10">
                      <EmptyState
                        icon={FileText}
                        title="No invoices yet"
                        description="Billing invoices will appear here once you upgrade from the Free plan."
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  demoInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-600">{inv.id}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{inv.date}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-[10px]">{inv.plan}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{formatNumber(inv.calls)}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-800">{inv.amount}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[10px] ${
                          inv.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cost Calculator */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-500" />
            Cost Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-xs font-medium text-slate-600 mb-3 block">Select APIs</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(apiCosts).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      checked={costCalcApis.includes(key)}
                      onCheckedChange={(checked) => {
                        setCostCalcApis(prev =>
                          checked ? [...prev, key] : prev.filter(a => a !== key)
                        );
                      }}
                    />
                    <div>
                      <span className="text-xs text-slate-700">{val.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({formatINR(val.perCall)}/call)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Label className="text-xs font-medium text-slate-600">Expected Monthly Calls</Label>
                <Input type="number" defaultValue={50000} className="mt-1" />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg p-6">
              <div className="text-xs text-slate-500 mb-1">Estimated Monthly Cost</div>
              <div className="text-3xl font-bold text-emerald-600">{formatINR(estimatedCost)}</div>
              <div className="text-[10px] text-slate-400 mt-1">Based on 50K calls across {costCalcApis.length} API {costCalcApis.length === 1 ? 'type' : 'types'}</div>
              <Separator className="my-3 w-24" />
              <div className="text-xs text-slate-500">
                {estimatedCost <= 999
                  ? 'Fits in Free/Starter plan'
                  : estimatedCost <= 4999
                    ? 'Fits in Pro plan — Save with flat pricing'
                    : 'Consider Enterprise plan for best value'}
              </div>
              <Button className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8 gap-1.5">
                View Recommended Plan
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <TabsList className="bg-slate-100 h-9 p-1">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm px-3">
              <Activity className="h-3.5 w-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="reference" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm px-3">
              <BookOpen className="h-3.5 w-3.5" />
              API Reference
            </TabsTrigger>
            <TabsTrigger value="keys" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm px-3">
              <Key className="h-3.5 w-3.5" />
              Keys & Webhooks
            </TabsTrigger>
            <TabsTrigger value="console" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm px-3">
              <Terminal className="h-3.5 w-3.5" />
              Console
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm px-3">
              <IndianRupee className="h-3.5 w-3.5" />
              Usage & Billing
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          {renderDashboard()}
        </TabsContent>
        <TabsContent value="reference" className="mt-0">
          {renderApiReference()}
        </TabsContent>
        <TabsContent value="keys" className="mt-0">
          {renderKeysAndWebhooks()}
        </TabsContent>
        <TabsContent value="console" className="mt-0">
          {renderDeveloperConsole()}
        </TabsContent>
        <TabsContent value="billing" className="mt-0">
          {renderUsageBilling()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
