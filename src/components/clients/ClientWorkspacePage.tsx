'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Upload,
  FileText,
  GitCompareArrows,
  Send,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Eye,
  RefreshCw,
  Download,
  AlertCircle,
  XCircle,
  UploadCloud,
  Activity,
  MapPin,
  Building2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  FileCheck,
  FileWarning,
  Timer,
  Package,
  Gauge,
  Search,
  FolderOpen,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Minus,
  Separator as SeparatorIcon,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useApp } from '@/contexts/AppContext';
import type { AppView } from '@/contexts/AppContext';
import type { Client } from '@/types/gst';
import { formatCurrency } from '@/lib/gst-utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ReturnEntry {
  id: string;
  type: string;
  period: string;
  filingDate: string;
  arn: string;
  status: 'Filed' | 'Pending' | 'Overdue' | 'Draft' | 'Ready to File' | 'In Review';
  taxAmount: number;
}

interface PendingAction {
  id: string;
  type: 'missing_documents' | 'gstin_error' | 'recon_mismatch' | 'awaiting_review' | 'ready_to_file';
  title: string;
  description: string;
  dueDate?: string;
  actionLabel: string;
  targetView: AppView;
  priority: 'high' | 'medium' | 'low';
}

interface DocumentEntry {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  status: 'Processed' | 'Processing' | 'Uploaded' | 'Error';
  invoicesExtracted: number;
  totalRows: number;
  accuracy: number;
  size: string;
}

interface ReconRun {
  id: string;
  period: string;
  matchRate: number;
  mismatches: number;
  missingInvoices: number;
  taxDifference: number;
  runDate: string;
  status: 'Completed' | 'Running' | 'Failed';
}

interface AIInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  suggestedAction: string;
  actionView: AppView;
  category: string;
}

interface ActivityEvent {
  id: string;
  type: 'upload' | 'return_created' | 'filing_submitted' | 'recon_run' | 'user_action' | 'ai_action';
  description: string;
  timestamp: string;
}

interface ClientWorkspaceData {
  complianceScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  filingFrequency: string;
  lastFilingDate: string;
  matchRate: number;
  pendingReturns: number;
  openIssues: number;
  taxVolume: number;
  documentsUploaded: number;
  returns: ReturnEntry[];
  pendingActions: PendingAction[];
  documents: DocumentEntry[];
  reconRuns: ReconRun[];
  insights: AIInsight[];
  activities: ActivityEvent[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT-SPECIFIC DATA GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateWorkspace(client: Client | null, clientIndex: number): ClientWorkspaceData {
  const hs = client?.healthScore ?? 75;
  const name = client?.tradeName ?? 'Unknown Client';
  const isHighRisk = hs < 50;
  const isLowRisk = hs > 80;

  // Client-specific return data with realistic GST details
  const clientReturns: Record<string, ReturnEntry[]> = {
    'Sharma Enterprises': [
      { id: 'r1', type: 'GSTR-1', period: 'Jun 2025', filingDate: '', arn: '', status: 'Ready to File', taxAmount: 226155 },
      { id: 'r2', type: 'GSTR-3B', period: 'Jun 2025', filingDate: '', arn: '', status: 'Draft', taxAmount: 245800 },
      { id: 'r3', type: 'GSTR-1', period: 'May 2025', filingDate: '2025-06-10', arn: 'AA060625001234', status: 'Filed', taxAmount: 218400 },
      { id: 'r4', type: 'GSTR-3B', period: 'May 2025', filingDate: '2025-06-18', arn: 'AA060625005678', status: 'Filed', taxAmount: 234100 },
      { id: 'r5', type: 'GSTR-1', period: 'Apr 2025', filingDate: '2025-05-11', arn: 'AA050625003456', status: 'Filed', taxAmount: 195600 },
      { id: 'r6', type: 'GSTR-3B', period: 'Apr 2025', filingDate: '2025-05-20', arn: 'AA050625007890', status: 'Filed', taxAmount: 210300 },
    ],
    'Patel & Sons': [
      { id: 'r1', type: 'GSTR-1', period: 'Jun 2025', filingDate: '', arn: '', status: 'Draft', taxAmount: 640125 },
      { id: 'r2', type: 'GSTR-3B', period: 'May 2025', filingDate: '', arn: '', status: 'Overdue', taxAmount: 672300 },
      { id: 'r3', type: 'GSTR-1', period: 'May 2025', filingDate: '2025-06-09', arn: 'AA060625009012', status: 'Filed', taxAmount: 612500 },
      { id: 'r4', type: 'GSTR-1', period: 'Apr 2025', filingDate: '2025-05-10', arn: 'AA050625011234', status: 'Filed', taxAmount: 598000 },
      { id: 'r5', type: 'GSTR-3B', period: 'Apr 2025', filingDate: '2025-05-22', arn: 'AA050625015678', status: 'Filed', taxAmount: 634700 },
    ],
    'Krishna Traders': [
      { id: 'r1', type: 'GSTR-1', period: 'Jun 2025', filingDate: '', arn: '', status: 'Ready to File', taxAmount: 110000 },
      { id: 'r2', type: 'GSTR-3B', period: 'Jun 2025', filingDate: '', arn: '', status: 'Pending', taxAmount: 118500 },
      { id: 'r3', type: 'GSTR-1', period: 'May 2025', filingDate: '2025-06-11', arn: 'AA060625019012', status: 'Filed', taxAmount: 105200 },
      { id: 'r4', type: 'GSTR-3B', period: 'May 2025', filingDate: '2025-06-19', arn: 'AA060625023456', status: 'Filed', taxAmount: 112800 },
      { id: 'r5', type: 'GSTR-1', period: 'Apr 2025', filingDate: '2025-05-11', arn: 'AA050625027890', status: 'Filed', taxAmount: 98700 },
    ],
    'Metro Retail': [
      { id: 'r1', type: 'GSTR-1', period: 'Jun 2025', filingDate: '', arn: '', status: 'In Review', taxAmount: 337445 },
      { id: 'r2', type: 'GSTR-3B', period: 'May 2025', filingDate: '', arn: '', status: 'Overdue', taxAmount: 356200 },
      { id: 'r3', type: 'GSTR-1', period: 'May 2025', filingDate: '', arn: '', status: 'Overdue', taxAmount: 328900 },
      { id: 'r4', type: 'GSTR-1', period: 'Apr 2025', filingDate: '2025-05-11', arn: 'AA050625031234', status: 'Filed', taxAmount: 315600 },
      { id: 'r5', type: 'GSTR-3B', period: 'Apr 2025', filingDate: '2025-05-19', arn: 'AA050625035678', status: 'Filed', taxAmount: 342100 },
    ],
  };

  const defaultReturns: ReturnEntry[] = [
    { id: 'r1', type: 'GSTR-1', period: 'Jun 2025', filingDate: '', arn: '', status: isLowRisk ? 'Ready to File' : 'Draft', taxAmount: hs * 2400 },
    { id: 'r2', type: 'GSTR-3B', period: 'Jun 2025', filingDate: '', arn: '', status: 'Pending', taxAmount: hs * 2600 },
    { id: 'r3', type: 'GSTR-1', period: 'May 2025', filingDate: '2025-06-10', arn: 'AA060625001234', status: 'Filed', taxAmount: hs * 2300 },
    { id: 'r4', type: 'GSTR-3B', period: 'May 2025', filingDate: '2025-06-18', arn: 'AA060625005678', status: 'Filed', taxAmount: hs * 2500 },
    { id: 'r5', type: 'GSTR-1', period: 'Apr 2025', filingDate: '2025-05-11', arn: 'AA050625003456', status: 'Filed', taxAmount: hs * 2200 },
  ];

  const clientDocs: Record<string, DocumentEntry[]> = {
    'Sharma Enterprises': [
      { id: 'd1', name: 'Sales_Register_Jun2025.xlsx', type: 'Sales Register', uploadDate: '2025-07-01', status: 'Processed', invoicesExtracted: 47, totalRows: 342, accuracy: 98.7, size: '2.4 MB' },
      { id: 'd2', name: 'Purchase_Register_Jun2025.pdf', type: 'Purchase Register', uploadDate: '2025-07-02', status: 'Processing', invoicesExtracted: 0, totalRows: 186, accuracy: 0, size: '1.8 MB' },
      { id: 'd3', name: 'GSTR2A_May2025.json', type: 'GST Portal Data', uploadDate: '2025-06-15', status: 'Processed', invoicesExtracted: 38, totalRows: 38, accuracy: 100, size: '890 KB' },
      { id: 'd4', name: 'Bank_Statement_Jun2025.pdf', type: 'Bank Statement', uploadDate: '2025-07-03', status: 'Processed', invoicesExtracted: 0, totalRows: 94, accuracy: 92.1, size: '1.1 MB' },
      { id: 'd5', name: 'Credit_Notes_May2025.xlsx', type: 'Credit Notes', uploadDate: '2025-06-20', status: 'Error', invoicesExtracted: 0, totalRows: 0, accuracy: 0, size: '340 KB' },
    ],
    'Patel & Sons': [
      { id: 'd1', name: 'Sales_Register_Jun2025.xlsx', type: 'Sales Register', uploadDate: '2025-07-01', status: 'Processed', invoicesExtracted: 32, totalRows: 256, accuracy: 96.2, size: '2.1 MB' },
      { id: 'd2', name: 'Purchase_Register_May2025.pdf', type: 'Purchase Register', uploadDate: '2025-06-10', status: 'Processed', invoicesExtracted: 28, totalRows: 210, accuracy: 91.4, size: '1.6 MB' },
      { id: 'd3', name: 'GSTR2B_May2025.json', type: 'GST Portal Data', uploadDate: '2025-06-14', status: 'Processed', invoicesExtracted: 25, totalRows: 25, accuracy: 100, size: '720 KB' },
    ],
    'Metro Retail': [
      { id: 'd1', name: 'Sales_Register_Jun2025.xlsx', type: 'Sales Register', uploadDate: '2025-07-02', status: 'Processed', invoicesExtracted: 56, totalRows: 412, accuracy: 94.8, size: '3.2 MB' },
      { id: 'd2', name: 'Purchase_Register_Jun2025.pdf', type: 'Purchase Register', uploadDate: '2025-07-03', status: 'Uploaded', invoicesExtracted: 0, totalRows: 0, accuracy: 0, size: '2.0 MB' },
      { id: 'd3', name: 'GSTR1_May2025.json', type: 'GST Portal Data', uploadDate: '2025-06-12', status: 'Processed', invoicesExtracted: 48, totalRows: 48, accuracy: 100, size: '1.1 MB' },
    ],
  };

  const defaultDocs: DocumentEntry[] = [
    { id: 'd1', name: `Sales_Register_Jun2025.xlsx`, type: 'Sales Register', uploadDate: '2025-07-01', status: isLowRisk ? 'Processed' : 'Processing', invoicesExtracted: isLowRisk ? Math.floor(hs * 0.5) : 0, totalRows: hs * 3, accuracy: isLowRisk ? 96.5 : 0, size: '2.0 MB' },
    { id: 'd2', name: `Purchase_Register_May2025.pdf`, type: 'Purchase Register', uploadDate: '2025-06-15', status: 'Processed', invoicesExtracted: Math.floor(hs * 0.35), totalRows: hs * 2, accuracy: 92.3, size: '1.5 MB' },
    { id: 'd3', name: `GSTR2B_May2025.json`, type: 'GST Portal Data', uploadDate: '2025-06-14', status: 'Processed', invoicesExtracted: Math.floor(hs * 0.3), totalRows: Math.floor(hs * 0.3), accuracy: 100, size: '650 KB' },
  ];

  const clientActions: Record<string, PendingAction[]> = {
    'Sharma Enterprises': [
      { id: 'pa1', type: 'ready_to_file', title: 'GSTR-1 Jun 2025 ready to file', description: '47 invoices validated, ₹2,26,155 total tax', dueDate: '2025-07-11', actionLabel: 'File Return', targetView: 'returns', priority: 'high' },
      { id: 'pa2', type: 'missing_documents', title: 'Purchase register for June missing', description: 'Upload Purchase_Register_Jun2025.pdf to complete GSTR-3B preparation', actionLabel: 'Upload Document', targetView: 'invoices', priority: 'high' },
      { id: 'pa3', type: 'recon_mismatch', title: '₹12,400 reconciliation mismatch in May', description: 'INV-2025-0782 shows Books ₹38,000 vs Portal ₹25,600 CGST', actionLabel: 'Run Reconciliation', targetView: 'reconcile', priority: 'medium' },
    ],
    'Patel & Sons': [
      { id: 'pa1', type: 'gstin_error', title: '2 B2B invoices with invalid GSTIN', description: '24AABCT1234F1Z5 fails checksum in INV-2025-1045, INV-2025-1056', actionLabel: 'Review Issue', targetView: 'reconcile', priority: 'high' },
      { id: 'pa2', type: 'recon_mismatch', title: '₹42,560 ITC mismatch detected', description: 'INV-2025-1045: Books ₹50,000 vs Portal ₹44,000. Possible partial reporting by Mahalaxmi Textiles', actionLabel: 'Run Reconciliation', targetView: 'reconcile', priority: 'high' },
      { id: 'pa3', type: 'awaiting_review', title: 'GSTR-3B May 2025 overdue', description: 'Return was due Jun 20. Late fee accruing at ₹50/day', dueDate: '2025-06-20', actionLabel: 'Prepare Return', targetView: 'returns', priority: 'high' },
      { id: 'pa4', type: 'missing_documents', title: 'June sales register not uploaded', description: 'Required for GSTR-1 preparation', actionLabel: 'Upload Document', targetView: 'invoices', priority: 'medium' },
    ],
    'Krishna Traders': [
      { id: 'pa1', type: 'ready_to_file', title: 'GSTR-1 Jun 2025 ready to file', description: '19 invoices validated, ₹1,10,000 total tax', dueDate: '2025-07-11', actionLabel: 'File Return', targetView: 'returns', priority: 'high' },
      { id: 'pa2', type: 'awaiting_review', title: 'GSTR-3B Jun 2025 awaiting review', description: 'Auto-prepared from GSTR-1 data. Needs manual review before filing.', actionLabel: 'Review & File', targetView: 'returns', priority: 'medium' },
    ],
    'Metro Retail': [
      { id: 'pa1', type: 'gstin_error', title: 'Invalid GSTIN in 2 B2B invoices', description: '27AAACM5241Z2ZM fails checksum — INV-2025-1089, INV-2025-1092', actionLabel: 'Review Issue', targetView: 'reconcile', priority: 'high' },
      { id: 'pa2', type: 'recon_mismatch', title: '7 reconciliation mismatches unresolved', description: 'Total tax difference: ₹89,650 across May and April returns', actionLabel: 'Run Reconciliation', targetView: 'reconcile', priority: 'high' },
      { id: 'pa3', type: 'awaiting_review', title: 'GSTR-1 May 2025 overdue by 20 days', description: 'Late fee of ₹1,000 already accrued. File immediately.', dueDate: '2025-06-11', actionLabel: 'File Now', targetView: 'returns', priority: 'high' },
      { id: 'pa4', type: 'missing_documents', title: 'Purchase register for June not uploaded', description: 'Required for ITC reconciliation and GSTR-3B preparation', actionLabel: 'Upload Document', targetView: 'invoices', priority: 'medium' },
      { id: 'pa5', type: 'awaiting_review', title: 'GSTR-3B May 2025 overdue', description: 'Was due Jun 20. Late fee accruing daily.', dueDate: '2025-06-20', actionLabel: 'Prepare Return', targetView: 'returns', priority: 'high' },
    ],
  };

  const defaultActions: PendingAction[] = [
    { id: 'pa1', type: isLowRisk ? 'ready_to_file' : 'missing_documents', title: isLowRisk ? 'GSTR-1 Jun 2025 ready to file' : 'Sales register for June missing', description: isLowRisk ? 'All invoices validated and approved' : 'Upload required documents to proceed', dueDate: '2025-07-11', actionLabel: isLowRisk ? 'File Return' : 'Upload Document', targetView: isLowRisk ? 'returns' : 'invoices', priority: 'high' },
    { id: 'pa2', type: 'recon_mismatch', title: `${isHighRisk ? 5 : 2} reconciliation mismatches`, description: `Tax difference of ${formatCurrency(isHighRisk ? 89000 : 12000)} needs review`, actionLabel: 'Run Reconciliation', targetView: 'reconcile', priority: isHighRisk ? 'high' : 'medium' },
    { id: 'pa3', type: 'awaiting_review', title: 'GSTR-3B Jun 2025 pending', description: 'Awaiting review before filing', actionLabel: 'Review & File', targetView: 'returns', priority: 'medium' },
  ];

  const clientRecon: Record<string, ReconRun[]> = {
    'Sharma Enterprises': [
      { id: 'rc1', period: 'May 2025', matchRate: 94, mismatches: 3, missingInvoices: 1, taxDifference: 12400, runDate: '2025-06-28', status: 'Completed' },
      { id: 'rc2', period: 'Apr 2025', matchRate: 96, mismatches: 2, missingInvoices: 0, taxDifference: 5200, runDate: '2025-05-29', status: 'Completed' },
      { id: 'rc3', period: 'Mar 2025', matchRate: 95, mismatches: 4, missingInvoices: 1, taxDifference: 18500, runDate: '2025-04-28', status: 'Completed' },
    ],
    'Patel & Sons': [
      { id: 'rc1', period: 'May 2025', matchRate: 78, mismatches: 12, missingInvoices: 5, taxDifference: 89000, runDate: '2025-06-29', status: 'Completed' },
      { id: 'rc2', period: 'Apr 2025', matchRate: 82, mismatches: 9, missingInvoices: 4, taxDifference: 62000, runDate: '2025-05-30', status: 'Completed' },
      { id: 'rc3', period: 'Mar 2025', matchRate: 75, mismatches: 15, missingInvoices: 6, taxDifference: 95000, runDate: '2025-04-29', status: 'Completed' },
    ],
    'Metro Retail': [
      { id: 'rc1', period: 'May 2025', matchRate: 55, mismatches: 28, missingInvoices: 14, taxDifference: 345000, runDate: '2025-06-30', status: 'Completed' },
      { id: 'rc2', period: 'Apr 2025', matchRate: 58, mismatches: 22, missingInvoices: 11, taxDifference: 280000, runDate: '2025-05-28', status: 'Completed' },
    ],
  };

  const defaultRecon: ReconRun[] = [
    { id: 'rc1', period: 'May 2025', matchRate: isLowRisk ? 92 : isHighRisk ? 58 : 78, mismatches: isLowRisk ? 3 : isHighRisk ? 22 : 9, missingInvoices: isLowRisk ? 1 : isHighRisk ? 11 : 4, taxDifference: isLowRisk ? 12000 : isHighRisk ? 280000 : 62000, runDate: '2025-06-28', status: 'Completed' },
    { id: 'rc2', period: 'Apr 2025', matchRate: isLowRisk ? 94 : isHighRisk ? 55 : 80, mismatches: isLowRisk ? 2 : isHighRisk ? 28 : 8, missingInvoices: isLowRisk ? 0 : isHighRisk ? 14 : 3, taxDifference: isLowRisk ? 5000 : isHighRisk ? 345000 : 48000, runDate: '2025-05-29', status: 'Completed' },
  ];

  const clientInsights: Record<string, AIInsight[]> = {
    'Sharma Enterprises': [
      { id: 'ai1', severity: 'warning', title: 'GSTR-1 due in 3 days', description: 'Filing deadline Jul 11 for June 2025. Late fee ₹50/day after deadline.', suggestedAction: 'File Return', actionView: 'returns', category: 'Deadline' },
      { id: 'ai2', severity: 'info', title: 'Purchase register for June not uploaded', description: 'Upload to complete GSTR-3B preparation. Last month took 2 days to process.', suggestedAction: 'Upload Document', actionView: 'invoices', category: 'Documents' },
      { id: 'ai3', severity: 'info', title: '₹12,400 recon mismatch from May resolved', description: 'INV-2025-0782 discrepancy was due to credit note not reported in GSTR-1.', suggestedAction: 'View Details', actionView: 'reconcile', category: 'ITC' },
    ],
    'Patel & Sons': [
      { id: 'ai1', severity: 'critical', title: '₹42,560 ITC mismatch detected', description: 'INV-2025-1045: Books ₹50,000 vs Portal ₹44,000. Possible partial reporting by supplier Mahalaxmi Textiles.', suggestedAction: 'Run Reconciliation', actionView: 'reconcile', category: 'ITC' },
      { id: 'ai2', severity: 'critical', title: 'GSTR-3B May 2025 overdue — late fee accruing', description: '₹50/day penalty since Jun 20. Current late fee: ₹900. File immediately to stop accrual.', suggestedAction: 'File Return', actionView: 'returns', category: 'Deadline' },
      { id: 'ai3', severity: 'warning', title: '2 GSTIN validation errors blocking filing', description: '24AABCT1234F1Z5 in INV-2025-1045 and INV-2025-1056 fails checksum. Correct before filing.', suggestedAction: 'Review Issue', actionView: 'reconcile', category: 'Validation' },
      { id: 'ai4', severity: 'warning', title: 'Compliance score dropped from 78 to 62', description: 'Caused by 3 late filings and 2 GSTIN errors. Below 65 threshold triggers scrutiny risk.', suggestedAction: 'View Compliance', actionView: 'dashboard', category: 'Risk' },
    ],
    'Metro Retail': [
      { id: 'ai1', severity: 'critical', title: 'GSTR-1 May 2025 overdue by 20 days', description: 'Late fee ₹1,000 already accrued. GSTR-3B May also overdue. Immediate action required.', suggestedAction: 'File Now', actionView: 'returns', category: 'Deadline' },
      { id: 'ai2', severity: 'critical', title: '7 unresolved reconciliation mismatches', description: 'Total tax difference: ₹89,650. Includes INV-2025-1089 with invalid GSTIN.', suggestedAction: 'Run Reconciliation', actionView: 'reconcile', category: 'ITC' },
      { id: 'ai3', severity: 'warning', title: 'Purchase register June not uploaded', description: 'ITC claims cannot be verified without purchase data. Risk of under-claiming ITC.', suggestedAction: 'Upload Document', actionView: 'invoices', category: 'Documents' },
    ],
  };

  const defaultInsights: AIInsight[] = [
    { id: 'ai1', severity: isHighRisk ? 'critical' : 'warning', title: isHighRisk ? 'Multiple filings overdue' : 'GSTR-1 due in 3 days', description: isHighRisk ? 'Late fees accruing on 2 returns. Immediate action required.' : 'Filing deadline Jul 11 for June 2025.', suggestedAction: isHighRisk ? 'File Now' : 'File Return', actionView: 'returns', category: 'Deadline' },
    { id: 'ai2', severity: 'warning', title: `${isHighRisk ? 5 : 2} reconciliation mismatches`, description: `Total tax difference: ${formatCurrency(isHighRisk ? 89000 : 12000)}.`, suggestedAction: 'Run Reconciliation', actionView: 'reconcile', category: 'ITC' },
    { id: 'ai3', severity: 'info', title: 'Compliance score trend', description: isLowRisk ? 'Score stable above 80. Good filing pattern.' : 'Score declining. Recent delays are impacting compliance health.', suggestedAction: 'View Details', actionView: 'dashboard', category: 'Risk' },
  ];

  const clientActivities: Record<string, ActivityEvent[]> = {
    'Sharma Enterprises': [
      { id: 'a1', type: 'upload', description: 'Sales_Register_Jun2025.xlsx uploaded — 342 rows, 47 invoices extracted', timestamp: '2025-07-01T09:30:00Z' },
      { id: 'a2', type: 'upload', description: 'Purchase_Register_Jun2025.pdf uploaded — processing started', timestamp: '2025-07-02T14:20:00Z' },
      { id: 'a3', type: 'ai_action', description: 'AI auto-drafted GSTR-1 for Jun 2025 from sales register', timestamp: '2025-07-01T10:15:00Z' },
      { id: 'a4', type: 'recon_run', description: 'Reconciliation completed for May 2025 — 94% match rate', timestamp: '2025-06-28T11:00:00Z' },
      { id: 'a5', type: 'filing_submitted', description: 'GSTR-1 May 2025 filed — ARN: AA060625001234', timestamp: '2025-06-10T16:45:00Z' },
      { id: 'a6', type: 'filing_submitted', description: 'GSTR-3B May 2025 filed — ARN: AA060625005678', timestamp: '2025-06-18T15:30:00Z' },
      { id: 'a7', type: 'upload', description: 'GSTR2A_May2025.json downloaded from portal', timestamp: '2025-06-15T08:45:00Z' },
      { id: 'a8', type: 'user_action', description: 'Credit_Notes_May2025.xlsx upload failed — retry needed', timestamp: '2025-06-20T10:00:00Z' },
    ],
    'Patel & Sons': [
      { id: 'a1', type: 'recon_run', description: 'Reconciliation completed for May 2025 — 78% match rate, 12 mismatches', timestamp: '2025-06-29T11:00:00Z' },
      { id: 'a2', type: 'ai_action', description: 'AI flagged ₹42,560 ITC mismatch in INV-2025-1045', timestamp: '2025-06-29T11:15:00Z' },
      { id: 'a3', type: 'filing_submitted', description: 'GSTR-1 May 2025 filed — ARN: AA060625009012', timestamp: '2025-06-09T14:30:00Z' },
      { id: 'a4', type: 'upload', description: 'Sales_Register_Jun2025.xlsx uploaded — 256 rows, 32 invoices', timestamp: '2025-07-01T09:00:00Z' },
      { id: 'a5', type: 'user_action', description: 'GSTR-3B May 2025 not filed — now overdue', timestamp: '2025-06-20T23:59:00Z' },
    ],
    'Metro Retail': [
      { id: 'a1', type: 'upload', description: 'Sales_Register_Jun2025.xlsx uploaded — 412 rows, 56 invoices', timestamp: '2025-07-02T09:30:00Z' },
      { id: 'a2', type: 'upload', description: 'Purchase_Register_Jun2025.pdf uploaded — awaiting processing', timestamp: '2025-07-03T10:15:00Z' },
      { id: 'a3', type: 'recon_run', description: 'Reconciliation completed for May 2025 — 55% match rate, 28 mismatches', timestamp: '2025-06-30T14:00:00Z' },
      { id: 'a4', type: 'ai_action', description: 'AI flagged 2 invalid GSTINs in B2B invoices', timestamp: '2025-06-30T14:10:00Z' },
      { id: 'a5', type: 'user_action', description: 'GSTR-1 May 2025 filing missed — now overdue by 20 days', timestamp: '2025-06-11T23:59:00Z' },
      { id: 'a6', type: 'filing_submitted', description: 'GSTR-1 Apr 2025 filed — ARN: AA050625031234', timestamp: '2025-05-11T16:00:00Z' },
    ],
  };

  const defaultActivities: ActivityEvent[] = [
    { id: 'a1', type: 'upload', description: `Sales_Register_Jun2025.xlsx uploaded`, timestamp: '2025-07-01T09:30:00Z' },
    { id: 'a2', type: 'recon_run', description: `Reconciliation completed for May 2025 — ${isLowRisk ? '94' : isHighRisk ? '58' : '78'}% match rate`, timestamp: '2025-06-28T11:00:00Z' },
    { id: 'a3', type: 'filing_submitted', description: 'GSTR-1 May 2025 filed', timestamp: '2025-06-10T16:45:00Z' },
    { id: 'a4', type: 'ai_action', description: 'AI auto-drafted GSTR-1 from sales register data', timestamp: '2025-07-01T10:00:00Z' },
    { id: 'a5', type: 'user_action', description: 'GSTR-3B May 2025 filed', timestamp: '2025-06-18T15:30:00Z' },
  ];

  const riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = isLowRisk ? 'Low' : hs >= 50 ? 'Medium' : hs >= 30 ? 'High' : 'Critical';
  const matchRate = isLowRisk ? 94 : isHighRisk ? 58 : 78;
  const pendingReturns = clientReturns[name]?.filter(r => r.status !== 'Filed').length ?? (isLowRisk ? 2 : isHighRisk ? 4 : 3);
  const openIssues = isLowRisk ? 2 : isHighRisk ? 8 : 5;
  const taxVolume = isLowRisk ? 450000 : isHighRisk ? 650000 : 300000;
  const docsUploaded = clientDocs[name]?.length ?? 3;

  return {
    complianceScore: hs,
    riskLevel,
    filingFrequency: client?.returnPeriod === 'quarterly' ? 'Quarterly' : 'Monthly',
    lastFilingDate: client?.lastFilingDate ?? '2025-05-11',
    matchRate,
    pendingReturns,
    openIssues,
    taxVolume,
    documentsUploaded: docsUploaded,
    returns: clientReturns[name] ?? defaultReturns,
    pendingActions: clientActions[name] ?? defaultActions,
    documents: clientDocs[name] ?? defaultDocs,
    reconRuns: clientRecon[name] ?? defaultRecon,
    insights: clientInsights[name] ?? defaultInsights,
    activities: clientActivities[name] ?? defaultActivities,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getHealthColor(score: number): { bg: string; text: string; stroke: string } {
  if (score > 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', stroke: '#10b981' };
  if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', stroke: '#f59e0b' };
  return { bg: 'bg-red-50', text: 'text-red-700', stroke: '#ef4444' };
}

function getRiskBadge(risk: string) {
  switch (risk) {
    case 'Low': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px] px-2 py-0.5"><Shield className="size-2.5" />Low</Badge>;
    case 'Medium': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-[10px] px-2 py-0.5"><AlertTriangle className="size-2.5" />Medium</Badge>;
    case 'High': return <Badge className="bg-orange-50 text-orange-700 border-orange-200 gap-1 text-[10px] px-2 py-0.5"><AlertTriangle className="size-2.5" />High</Badge>;
    case 'Critical': return <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 text-[10px] px-2 py-0.5"><XCircle className="size-2.5" />Critical</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{risk}</Badge>;
  }
}

function getReturnStatusBadge(status: string) {
  switch (status) {
    case 'Filed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0"><CheckCircle2 className="size-2.5 mr-0.5" />Filed</Badge>;
    case 'Pending': return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0"><Clock className="size-2.5 mr-0.5" />Pending</Badge>;
    case 'Overdue': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0"><AlertCircle className="size-2.5 mr-0.5" />Overdue</Badge>;
    case 'Draft': return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0"><FileText className="size-2.5 mr-0.5" />Draft</Badge>;
    case 'Ready to File': return <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] px-1.5 py-0"><CheckCircle2 className="size-2.5 mr-0.5" />Ready</Badge>;
    case 'In Review': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0"><Eye className="size-2.5 mr-0.5" />Review</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'Processed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">Processed</Badge>;
    case 'Processing': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Processing</Badge>;
    case 'Uploaded': return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0">Uploaded</Badge>;
    case 'Error': return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0">Error</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

function getActionTypeIcon(type: string) {
  switch (type) {
    case 'missing_documents': return UploadCloud;
    case 'gstin_error': return XCircle;
    case 'recon_mismatch': return GitCompareArrows;
    case 'awaiting_review': return Eye;
    case 'ready_to_file': return CheckCircle2;
    default: return AlertCircle;
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'upload': return UploadCloud;
    case 'return_created': return FileText;
    case 'filing_submitted': return FileCheck;
    case 'recon_run': return GitCompareArrows;
    case 'user_action': return Activity;
    case 'ai_action': return Sparkles;
    default: return CircleDot;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'upload': return 'bg-blue-50 text-blue-600';
    case 'return_created': return 'bg-purple-50 text-purple-600';
    case 'filing_submitted': return 'bg-emerald-50 text-emerald-600';
    case 'recon_run': return 'bg-teal-50 text-teal-600';
    case 'user_action': return 'bg-slate-100 text-slate-600';
    case 'ai_action': return 'bg-amber-50 text-amber-600';
    default: return 'bg-slate-100 text-slate-500';
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date('2025-07-08T12:00:00Z');
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatFileSize(size: string): string { return size; }

// ═══════════════════════════════════════════════════════════════════════════════
// SVG Health Ring
// ═══════════════════════════════════════════════════════════════════════════════

function HealthRing({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold text-lg ${color.text}`}>{score}</span>
        <span className="text-[8px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ClientWorkspacePage() {
  const { selectedClientId, setCurrentView, setSelectedClientId, setReturnPrepCtx } = useApp();
  const [clientData, setClientData] = useState<Client | null>(null);
  const [clientIndex, setClientIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [returnFilter, setReturnFilter] = useState('all');

  // Fetch client
  const fetchClient = useCallback(async () => {
    if (!selectedClientId) { setLoading(false); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        const clients: Client[] = data.clients ?? [];
        const idx = clients.findIndex((c: Client) => c.id === selectedClientId);
        setClientIndex(idx >= 0 ? idx : 0);
        setClientData(clients[idx >= 0 ? idx : 0] ?? null);
      }
    } catch {
      // silent fallback
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const workspace = useMemo(() => generateWorkspace(clientData, clientIndex), [clientData, clientIndex]);
  const name = clientData?.tradeName ?? 'Unknown Client';

  // Filter returns
  const filteredReturns = useMemo(() => {
    if (returnFilter === 'all') return workspace.returns;
    return workspace.returns.filter(r => r.type === returnFilter);
  }, [workspace.returns, returnFilter]);

  const handleBack = () => { setSelectedClientId(null); setCurrentView('clients'); };
  const handleAction = (view: AppView) => setCurrentView(view);

  const handleOpenReturnPrep = (returnType: 'GSTR-1' | 'GSTR-3B' = 'GSTR-1') => {
    setReturnPrepCtx({
      clientId: selectedClientId,
      returnType,
      period: '2025-06',
    });
    setCurrentView('return-prep');
  };

  // Loading
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="border rounded-xl p-6 space-y-4">
          <div className="flex gap-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div></div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      </div>
    );
  }

  const healthColor = getHealthColor(workspace.complianceScore);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-8">

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1" onClick={handleBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Client Portfolio
          </Button>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{name}</span>
        </div>

        {/* Main header */}
        <div className="border border-border/60 rounded-xl p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            {/* Left: Identity */}
            <div className="flex items-start gap-4">
              <HealthRing score={workspace.complianceScore} size={72} strokeWidth={5} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground tracking-tight">{name}</h1>
                  {getRiskBadge(workspace.riskLevel)}
                </div>
                {clientData?.legalName && <p className="text-sm text-muted-foreground mt-0.5">{clientData.legalName}</p>}

                {/* Key info row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3 text-slate-400" />
                    <span className="font-mono font-medium text-foreground">{clientData?.gstin ?? '00AAAAA0000A0AA'}</span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3 text-slate-400" />
                    <span>{clientData?.state ?? 'Unknown'}</span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <span className="text-xs text-muted-foreground">
                    {workspace.filingFrequency} Filing
                  </span>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3 text-slate-400" />
                    <span>Last Filed: {new Date(workspace.lastFilingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction('invoices')}>
                <Upload className="size-3.5" />
                Upload Documents
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleOpenReturnPrep('GSTR-1')}>
                <FileText className="size-3.5" />
                Create Return
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleAction('reconcile')}>
                <GitCompareArrows className="size-3.5" />
                Run Reconciliation
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleOpenReturnPrep('GSTR-3B')}>
                <Send className="size-3.5" />
                File Return
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: CLIENT HEALTH OVERVIEW
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Client Health Overview</h2>
        <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Compliance Score', value: `${workspace.complianceScore}%`, icon: Gauge, color: healthColor.text, bg: healthColor.bg },
            { label: 'Pending Returns', value: String(workspace.pendingReturns), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Open Issues', value: String(workspace.openIssues), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Tax Volume', value: formatCurrency(workspace.taxVolume), icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Match Rate', value: `${workspace.matchRate}%`, icon: GitCompareArrows, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'Documents', value: String(workspace.documentsUploaded), icon: FolderOpen, color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map((item) => (
            <motion.div key={item.label} variants={fadeUp} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              <div className="border border-border/60 rounded-xl p-4 hover:border-border transition-colors">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className={`flex items-center justify-center h-7 w-7 rounded-md ${item.bg}`}>
                    <item.icon className={`size-3.5 ${item.color}`} />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground leading-tight">{item.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: GST RETURN TIMELINE
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">GST Return Timeline</h2>
          <Select value={returnFilter} onValueChange={setReturnFilter}>
            <SelectTrigger className="h-7 w-32 text-xs border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Returns</SelectItem>
              <SelectItem value="GSTR-1">GSTR-1</SelectItem>
              <SelectItem value="GSTR-3B">GSTR-3B</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border/60 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Period</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Filed Date</div>
            <div className="col-span-2">ARN</div>
            <div className="col-span-2 text-right">Tax Amount</div>
          </div>
          {/* Table rows */}
          <div className="divide-y divide-border/40">
            <AnimatePresence>
              {filteredReturns.map((ret, index) => (
                <motion.div
                  key={ret.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + index * 0.04, duration: 0.3 }}
                  className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/20 transition-colors items-center"
                >
                  <div className="col-span-2 text-sm font-medium text-foreground">{ret.type}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">{ret.period}</div>
                  <div className="col-span-2">{getReturnStatusBadge(ret.status)}</div>
                  <div className="col-span-2 text-xs text-muted-foreground">{ret.filingDate ? new Date(ret.filingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</div>
                  <div className="col-span-2 text-xs font-mono text-muted-foreground">{ret.arn || '—'}</div>
                  <div className="col-span-2 text-sm font-medium text-foreground text-right">{formatCurrency(ret.taxAmount)}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: PENDING ACTIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Pending Actions</h2>
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            {workspace.pendingActions.filter(a => a.priority === 'high').length} urgent
          </Badge>
        </div>

        <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
          <AnimatePresence>
            {workspace.pendingActions.map((action, index) => {
              const IconComp = getActionTypeIcon(action.type);
              const priorityStripe = action.priority === 'high' ? 'bg-red-500' : action.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300';
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.05, duration: 0.3 }}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors group"
                >
                  <div className={`h-8 w-1 rounded-full shrink-0 ${priorityStripe}`} />
                  <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${
                    action.priority === 'high' ? 'bg-red-50 text-red-600'
                    : action.priority === 'medium' ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
                  }`}>
                    <IconComp className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{action.description}</p>
                  </div>
                  {action.dueDate && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      Due {new Date(action.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <Button
                    size="sm"
                    className={`h-7 text-xs font-medium px-3 shrink-0 ${
                      action.priority === 'high' ? 'bg-red-600 hover:bg-red-700 text-white'
                      : action.type === 'ready_to_file' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    onClick={() => {
                      if (action.targetView === 'returns' || action.type === 'ready_to_file') {
                        handleOpenReturnPrep('GSTR-1');
                      } else {
                        handleAction(action.targetView);
                      }
                    }}
                  >
                    {action.actionLabel}
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: UPLOADED DOCUMENTS
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Uploaded Documents</h2>
          <Button variant="ghost" size="sm" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1" onClick={() => handleAction('invoices')}>
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="border border-border/60 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3">File Name</div>
            <div className="col-span-2">Upload Date</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-center">Invoices</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-border/40">
            {workspace.documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + index * 0.04, duration: 0.3 }}
                className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/20 transition-colors items-center"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate" title={doc.name}>{doc.name}</span>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {new Date(doc.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">{doc.type}</div>
                <div className="col-span-2">{getDocStatusBadge(doc.status)}</div>
                <div className="col-span-1 text-center">
                  {doc.invoicesExtracted > 0 ? (
                    <span className="text-xs font-medium text-foreground">{doc.invoicesExtracted}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground" onClick={() => handleAction('invoices')}>
                    <Eye className="size-3" />
                  </Button>
                  {doc.status === 'Error' && (
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAction('invoices')}>
                      <RefreshCw className="size-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground" onClick={() => handleAction('invoices')}>
                    <Download className="size-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-COLUMN: RECONCILIATION HISTORY + AI COMPLIANCE ADVISOR
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION 5: RECONCILIATION HISTORY */}
        <motion.section initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Reconciliation History</h2>
            <Button variant="ghost" size="sm" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 gap-1" onClick={() => handleAction('reconcile')}>
              Run Reconciliation <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            {workspace.reconRuns.map((run, index) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + index * 0.05, duration: 0.3 }}
                className="px-4 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{run.period}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    run.matchRate >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : run.matchRate >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {run.matchRate}% match
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Mismatches</p>
                    <p className="font-medium text-foreground">{run.mismatches}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Missing</p>
                    <p className="font-medium text-foreground">{run.missingInvoices}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tax Diff</p>
                    <p className="font-medium text-foreground">{formatCurrency(run.taxDifference)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Run Date</p>
                    <p className="font-medium text-foreground">{new Date(run.runDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* SECTION 6: AI COMPLIANCE ADVISOR */}
        <motion.section initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-3.5 text-emerald-600" />
              AI Compliance Advisor
            </h2>
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              {workspace.insights.filter(i => i.severity === 'critical').length} critical
            </Badge>
          </div>

          <div className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            {workspace.insights.map((insight, index) => {
              const severityConfig = {
                critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700 border-red-200' },
                warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
                info: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
              }[insight.severity];
              const SevIcon = severityConfig.icon;

              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.05, duration: 0.3 }}
                  className="px-4 py-3.5 hover:bg-muted/20 transition-colors group"
                >
                  <div className="flex gap-3">
                    <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${severityConfig.bg}`}>
                      <SevIcon className={`size-3.5 ${severityConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-snug">{insight.title}</p>
                        {insight.severity === 'critical' && (
                          <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded shrink-0">URGENT</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{insight.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${severityConfig.badge}`}>{insight.category}</Badge>
                        <button
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 group-hover:gap-1.5 transition-all"
                          onClick={() => {
                            if (insight.actionView === 'returns') {
                              handleOpenReturnPrep('GSTR-1');
                            } else {
                              handleAction(insight.actionView);
                            }
                          }}
                        >
                          {insight.suggestedAction}
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7: ACTIVITY TIMELINE
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Activity Timeline</h2>

        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="divide-y divide-border/40">
            {workspace.activities.map((event, index) => {
              const IconComp = getActivityIcon(event.type);
              const iconColor = getActivityColor(event.type);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.65 + index * 0.04, duration: 0.3 }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className={`flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${iconColor}`}>
                    <IconComp className="size-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{event.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(event.timestamp)}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

    </div>
  );
}
