'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Upload, FileText, FileSpreadsheet, AlertTriangle, File,
  Clock, ChevronRight, ChevronDown, CheckCircle2, XCircle,
  Loader2, RefreshCw, Eye, Edit3, Check, Sparkles, Zap,
  Search, BarChart3, Shield, FileSearch, Brain, ListTodo,
  AlertCircle, Copy, TrendingUp, Hash, ArrowRight,
  FileCheck, FileWarning, Landmark, X, Paperclip,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type DocStatus = 'uploading' | 'processing' | 'extracted' | 'reviewed' | 'archived' | 'failed'
type DocType = 'invoice' | 'purchase_register' | 'sales_register' | 'gst_notice' | 'bank_statement' | 'other'
type OCRStatus = 'queued' | 'processing' | 'extracted' | 'reviewed'
type AnomalySeverity = 'high' | 'medium' | 'low'
type AnomalyType = 'duplicate_invoice' | 'gstin_invalid' | 'tax_mismatch' | 'unusual_amount' | 'date_inconsistency'

interface ExtractedField {
  key: string
  label: string
  value: string
  editable?: boolean
}

interface DocAnomaly {
  id: string
  type: AnomalyType
  description: string
  severity: AnomalySeverity
  sourceDocId: string
  sourceDocName: string
  investigated: boolean
}

interface DocTask {
  id: string
  title: string
  sourceDocId: string
  sourceDocName: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'review' | 'completed'
  assignedTo: string
}

interface DocSummary {
  text: string
  highlights: string[]
  generated: boolean
}

interface SmartDocument {
  id: string
  name: string
  type: DocType
  client: string
  status: DocStatus
  ocrStatus: OCRStatus
  uploadDate: string
  size: string
  sizeBytes: number
  format: string
  extractedFields: ExtractedField[]
  extractedText: string
  classificationConfidence: number
  extractionAccuracy: number
  ocrProgress: number
  summary: DocSummary | null
  anomalies: DocAnomaly[]
  tasks: DocTask[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; bg: string; dot: string; icon: React.ReactNode }> = {
  uploading: { label: 'Uploading', color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', dot: 'bg-slate-400', icon: <Upload className="h-3 w-3" /> },
  processing: { label: 'Processing', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  extracted: { label: 'Extracted', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', icon: <FileSearch className="h-3 w-3" /> },
  reviewed: { label: 'Reviewed', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', icon: <CheckCircle2 className="h-3 w-3" /> },
  archived: { label: 'Archived', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200', dot: 'bg-gray-400', icon: <File className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
}

const TYPE_CONFIG: Record<DocType, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  invoice: { label: 'Invoice', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200', icon: <FileText className="h-4 w-4" /> },
  purchase_register: { label: 'Purchase Register', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200', icon: <FileSpreadsheet className="h-4 w-4" /> },
  sales_register: { label: 'Sales Register', color: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-200', icon: <FileSpreadsheet className="h-4 w-4" /> },
  gst_notice: { label: 'GST Notice', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', icon: <AlertTriangle className="h-4 w-4" /> },
  bank_statement: { label: 'Bank Statement', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', icon: <Landmark className="h-4 w-4" /> },
  other: { label: 'Other', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', icon: <File className="h-4 w-4" /> },
}

const ANOMALY_CONFIG: Record<AnomalyType, { label: string; icon: React.ReactNode }> = {
  duplicate_invoice: { label: 'Duplicate Invoice', icon: <Copy className="h-4 w-4" /> },
  gstin_invalid: { label: 'Invalid GSTIN', icon: <Shield className="h-4 w-4" /> },
  tax_mismatch: { label: 'Tax Mismatch', icon: <AlertCircle className="h-4 w-4" /> },
  unusual_amount: { label: 'Unusual Amount', icon: <TrendingUp className="h-4 w-4" /> },
  date_inconsistency: { label: 'Date Inconsistency', icon: <Clock className="h-4 w-4" /> },
}

const SEVERITY_CONFIG: Record<AnomalySeverity, { color: string; bg: string; border: string }> = {
  high: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  medium: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  low: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
}

const SUPPORTED_FORMATS = ['PDF', 'PNG', 'JPG', 'XLSX', 'CSV']
const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'purchase_register', label: 'Purchase Register' },
  { value: 'sales_register', label: 'Sales Register' },
  { value: 'gst_notice', label: 'GST Notice' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'other', label: 'Other' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════════════════════════════

const INVOICE_FIELDS: ExtractedField[] = [
  { key: 'invoice_no', label: 'Invoice #', value: 'INV-2025-00142' },
  { key: 'date', label: 'Date', value: '15/03/2025' },
  { key: 'supplier_gstin', label: 'Supplier GSTIN', value: '27AAFCD1234F1Z5' },
  { key: 'buyer_gstin', label: 'Buyer GSTIN', value: '27AABCU9603R1ZM' },
  { key: 'taxable_value', label: 'Taxable Value', value: '₹2,45,000.00' },
  { key: 'cgst', label: 'CGST', value: '₹22,050.00' },
  { key: 'sgst', label: 'SGST', value: '₹22,050.00' },
  { key: 'igst', label: 'IGST', value: '₹0.00' },
  { key: 'total', label: 'Total', value: '₹2,89,100.00' },
]

const PURCHASE_FIELDS: ExtractedField[] = [
  ...INVOICE_FIELDS,
  { key: 'itc_available', label: 'ITC Available', value: '₹44,100.00' },
]

const SALES_FIELDS: ExtractedField[] = [
  ...INVOICE_FIELDS,
  { key: 'gstr1_section', label: 'GSTR-1 Section', value: 'B2B - Large' },
]

const NOTICE_FIELDS: ExtractedField[] = [
  { key: 'notice_type', label: 'Notice Type', value: 'Show Cause Notice' },
  { key: 'section', label: 'Section', value: 'Section 73' },
  { key: 'issue_date', label: 'Issue Date', value: '10/03/2025' },
  { key: 'response_deadline', label: 'Response Deadline', value: '10/04/2025' },
  { key: 'amount', label: 'Amount', value: '₹3,50,000.00' },
  { key: 'authority', label: 'Authority', value: 'DC, CGST Mumbai' },
]

const BANK_FIELDS: ExtractedField[] = [
  { key: 'bank', label: 'Bank', value: 'HDFC Bank' },
  { key: 'account', label: 'Account', value: 'XXXX-XXXX-4523' },
  { key: 'period', label: 'Period', value: 'Mar 2025' },
  { key: 'opening_balance', label: 'Opening Balance', value: '₹12,45,230.50' },
  { key: 'closing_balance', label: 'Closing Balance', value: '₹15,67,890.25' },
  { key: 'transaction_count', label: 'Transaction Count', value: '47' },
]

function getFieldsForType(type: DocType): ExtractedField[] {
  switch (type) {
    case 'invoice': return INVOICE_FIELDS
    case 'purchase_register': return PURCHASE_FIELDS
    case 'sales_register': return SALES_FIELDS
    case 'gst_notice': return NOTICE_FIELDS
    case 'bank_statement': return BANK_FIELDS
    default: return [{ key: 'note', label: 'Note', value: 'Manual extraction required' }]
  }
}

const SAMPLE_ANOMALIES: DocAnomaly[] = [
  { id: 'an-1', type: 'duplicate_invoice', description: 'Invoice INV-2025-00142 appears in both March and April uploads with identical amounts', severity: 'high', sourceDocId: 'doc-1', sourceDocName: 'Invoice_Mar2025_ABC.pdf', investigated: false },
  { id: 'an-2', type: 'gstin_invalid', description: 'GSTIN "27AAFCD1234F1Z5" checksum validation failed — possible data entry error', severity: 'high', sourceDocId: 'doc-6', sourceDocName: 'Invoice_Batch_Mar2025.pdf', investigated: false },
  { id: 'an-3', type: 'tax_mismatch', description: 'CGST + SGST does not equal 18% of taxable value (calculated: ₹44,100, actual: ₹44,000)', severity: 'medium', sourceDocId: 'doc-3', sourceDocName: 'SalesRegister_Q4_2024.pdf', investigated: false },
  { id: 'an-4', type: 'unusual_amount', description: 'Total invoice amount ₹89,00,000 is 4.2x higher than average for this supplier', severity: 'medium', sourceDocId: 'doc-9', sourceDocName: 'SalesRegister_Mar2025.xlsx', investigated: true },
  { id: 'an-5', type: 'date_inconsistency', description: 'Invoice date (01/04/2025) is after the reporting period (Mar 2025)', severity: 'low', sourceDocId: 'doc-2', sourceDocName: 'PurchaseRegister_Feb2025.xlsx', investigated: false },
]

const SAMPLE_TASKS: DocTask[] = [
  { id: 'task-1', title: 'Reconcile duplicate invoice INV-2025-00142', sourceDocId: 'doc-1', sourceDocName: 'Invoice_Mar2025_ABC.pdf', priority: 'high', status: 'todo', assignedTo: 'Rajesh K.' },
  { id: 'task-2', title: 'Respond to Show Cause Notice — Section 73', sourceDocId: 'doc-4', sourceDocName: 'Notice_GSTDept_Patel.pdf', priority: 'urgent', status: 'in_progress', assignedTo: 'Priya S.' },
  { id: 'task-3', title: 'Verify bank statement transactions for Mar 2025', sourceDocId: 'doc-8', sourceDocName: 'BankStatement_Mar2025.pdf', priority: 'medium', status: 'todo', assignedTo: 'Amit T.' },
  { id: 'task-4', title: 'Correct GSTIN format in invoice batch upload', sourceDocId: 'doc-6', sourceDocName: 'Invoice_Batch_Mar2025.pdf', priority: 'high', status: 'review', assignedTo: 'Rajesh K.' },
  { id: 'task-5', title: 'Investigate tax calculation mismatch in Q4 sales', sourceDocId: 'doc-3', sourceDocName: 'SalesRegister_Q4_2024.pdf', priority: 'medium', status: 'todo', assignedTo: 'Sneha M.' },
]

const SAMPLE_DOCS: SmartDocument[] = [
  {
    id: 'doc-1', name: 'Invoice_Mar2025_ABC.pdf', type: 'invoice', client: 'ABC Traders',
    status: 'extracted', ocrStatus: 'extracted', uploadDate: '2025-03-15', size: '2.4 MB', sizeBytes: 2516582,
    format: 'PDF', extractedFields: INVOICE_FIELDS, extractedText: 'TAX INVOICE\nInvoice No: INV-2025-00142\nDate: 15/03/2025\nSupplier: ABC Traders, GSTIN: 27AAFCD1234F1Z5\nBuyer: XYZ Industries, GSTIN: 27AABCU9603R1ZM\nTaxable Value: ₹2,45,000.00\nCGST 9%: ₹22,050.00\nSGST 9%: ₹22,050.00\nTotal: ₹2,89,100.00',
    classificationConfidence: 96, extractionAccuracy: 94, ocrProgress: 100,
    summary: { text: 'Tax invoice from ABC Traders to XYZ Industries for ₹2,89,100 (including ₹44,100 GST). Dated March 15, 2025. Both parties are Maharashtra-registered under GST.', highlights: ['₹2,89,100 total', 'GSTIN verified', 'March 2025'], generated: true },
    anomalies: [SAMPLE_ANOMALIES[0]], tasks: [SAMPLE_TASKS[0]],
  },
  {
    id: 'doc-2', name: 'PurchaseRegister_Feb2025.xlsx', type: 'purchase_register', client: 'XYZ Industries',
    status: 'processing', ocrStatus: 'processing', uploadDate: '2025-03-14', size: '5.1 MB', sizeBytes: 5347737,
    format: 'XLSX', extractedFields: PURCHASE_FIELDS, extractedText: 'Purchase Register - February 2025\nXYZ Industries\nTotal Entries: 142\nTotal Taxable Value: ₹45,67,890\nTotal ITC: ₹8,22,220',
    classificationConfidence: 92, extractionAccuracy: 78, ocrProgress: 67,
    summary: null, anomalies: [SAMPLE_ANOMALIES[4]], tasks: [],
  },
  {
    id: 'doc-3', name: 'SalesRegister_Q4_2024.pdf', type: 'sales_register', client: 'Sharma & Co',
    status: 'extracted', ocrStatus: 'reviewed', uploadDate: '2025-03-12', size: '3.8 MB', sizeBytes: 3984588,
    format: 'PDF', extractedFields: SALES_FIELDS, extractedText: 'Sales Register - Q4 2024\nSharma & Co\nTotal Entries: 256\nTotal Taxable Value: ₹1,23,45,678\nGSTR-1 Section: B2B Large - 180, B2B Small - 76',
    classificationConfidence: 98, extractionAccuracy: 91, ocrProgress: 100,
    summary: { text: 'Q4 2024 Sales Register for Sharma & Co with 256 entries totaling ₹1.23 Cr taxable value. Majority classified as B2B Large (180 entries). Tax calculation discrepancy detected.', highlights: ['256 entries', '₹1.23 Cr taxable', 'B2B Large dominant'], generated: true },
    anomalies: [SAMPLE_ANOMALIES[2]], tasks: [SAMPLE_TASKS[4]],
  },
  {
    id: 'doc-4', name: 'Notice_GSTDept_Patel.pdf', type: 'gst_notice', client: 'Patel Enterprises',
    status: 'reviewed', ocrStatus: 'reviewed', uploadDate: '2025-03-10', size: '1.2 MB', sizeBytes: 1258291,
    format: 'PDF', extractedFields: NOTICE_FIELDS, extractedText: 'SHOW CAUSE NOTICE\nSection 73 of CGST Act, 2017\nTo: Patel Enterprises, GSTIN: 24AABCP1234F1Z5\nIssue Date: 10/03/2025\nResponse Required By: 10/04/2025\nAmount: ₹3,50,000.00\nAuthority: DC, CGST & Central Excise, Mumbai',
    classificationConfidence: 99, extractionAccuracy: 97, ocrProgress: 100,
    summary: { text: 'Show Cause Notice under Section 73 from CGST Mumbai for Patel Enterprises. Amount involved: ₹3.5 Lakh. Response deadline: April 10, 2025. Requires immediate attention.', highlights: ['Section 73', '₹3.5 Lakh', 'Deadline: Apr 10'], generated: true },
    anomalies: [], tasks: [SAMPLE_TASKS[1]],
  },
  {
    id: 'doc-5', name: 'BankStatement_Mar2025.pdf', type: 'bank_statement', client: 'Kumar Ltd',
    status: 'extracted', ocrStatus: 'extracted', uploadDate: '2025-03-09', size: '1.8 MB', sizeBytes: 1887436,
    format: 'PDF', extractedFields: BANK_FIELDS, extractedText: 'Bank Statement\nHDFC Bank\nAccount: XXXX-XXXX-4523\nPeriod: March 2025\nOpening Balance: ₹12,45,230.50\nClosing Balance: ₹15,67,890.25\nTotal Transactions: 47',
    classificationConfidence: 94, extractionAccuracy: 89, ocrProgress: 100,
    summary: { text: 'HDFC Bank statement for Kumar Ltd, March 2025. Net inflow of ₹3.22 Lakh (opening ₹12.45L → closing ₹15.68L). 47 transactions recorded.', highlights: ['₹3.22L net inflow', '47 transactions', 'HDFC Bank'], generated: true },
    anomalies: [], tasks: [],
  },
  {
    id: 'doc-6', name: 'Invoice_Batch_Mar2025.pdf', type: 'invoice', client: 'Mehta Group',
    status: 'processing', ocrStatus: 'processing', uploadDate: '2025-03-08', size: '4.5 MB', sizeBytes: 4718592,
    format: 'PDF', extractedFields: INVOICE_FIELDS.slice(0, 4), extractedText: 'Batch Invoice Upload - March 2025\nMehta Group\nProcessing...',
    classificationConfidence: 85, extractionAccuracy: 42, ocrProgress: 38,
    summary: null, anomalies: [SAMPLE_ANOMALIES[1]], tasks: [SAMPLE_TASKS[3]],
  },
  {
    id: 'doc-7', name: 'GSTR-1_Feb2025_Sharma.pdf', type: 'sales_register', client: 'Sharma & Co',
    status: 'reviewed', ocrStatus: 'reviewed', uploadDate: '2025-02-28', size: '2.1 MB', sizeBytes: 2202009,
    format: 'PDF', extractedFields: SALES_FIELDS, extractedText: 'GSTR-1 Return - February 2025\nSharma & Co\nFiled Successfully',
    classificationConfidence: 97, extractionAccuracy: 96, ocrProgress: 100,
    summary: { text: 'GSTR-1 return for February 2025 filed by Sharma & Co. Successfully processed with high accuracy.', highlights: ['Filed', 'Feb 2025', 'High accuracy'], generated: true },
    anomalies: [], tasks: [],
  },
  {
    id: 'doc-8', name: 'BankStatement_Mar2025.pdf', type: 'bank_statement', client: 'ABC Traders',
    status: 'extracted', ocrStatus: 'extracted', uploadDate: '2025-02-20', size: '3.2 MB', sizeBytes: 3355443,
    format: 'PDF', extractedFields: BANK_FIELDS, extractedText: 'Bank Statement - March 2025\nABC Traders\nSBI Account\nOpening: ₹8,90,000\nClosing: ₹11,23,450\nTransactions: 62',
    classificationConfidence: 93, extractionAccuracy: 88, ocrProgress: 100,
    summary: { text: 'SBI Bank statement for ABC Traders. Net inflow of ₹2.33 Lakh with 62 transactions in March 2025.', highlights: ['₹2.33L net inflow', '62 transactions', 'SBI Bank'], generated: true },
    anomalies: [], tasks: [SAMPLE_TASKS[2]],
  },
  {
    id: 'doc-9', name: 'SalesRegister_Mar2025.xlsx', type: 'sales_register', client: 'Patel Enterprises',
    status: 'extracted', ocrStatus: 'extracted', uploadDate: '2025-03-16', size: '6.7 MB', sizeBytes: 7025459,
    format: 'XLSX', extractedFields: SALES_FIELDS, extractedText: 'Sales Register - March 2025\nPatel Enterprises\nTotal Entries: 312\nHigh-value transactions detected',
    classificationConfidence: 91, extractionAccuracy: 86, ocrProgress: 100,
    summary: { text: 'March 2025 Sales Register for Patel Enterprises. 312 entries with unusually high-value transactions flagged.', highlights: ['312 entries', 'High-value flagged'], generated: true },
    anomalies: [SAMPLE_ANOMALIES[3]], tasks: [],
  },
  {
    id: 'doc-10', name: 'Invoice_Apr2025_XYZ.pdf', type: 'invoice', client: 'XYZ Industries',
    status: 'uploading', ocrStatus: 'queued', uploadDate: '2025-03-17', size: '1.9 MB', sizeBytes: 1992294,
    format: 'PDF', extractedFields: [], extractedText: '', classificationConfidence: 0, extractionAccuracy: 0, ocrProgress: 0,
    summary: null, anomalies: [], tasks: [],
  },
  {
    id: 'doc-11', name: 'GSTR-3B_Mar2025_ABC.pdf', type: 'purchase_register', client: 'ABC Traders',
    status: 'failed', ocrStatus: 'queued', uploadDate: '2025-03-17', size: '2.0 MB', sizeBytes: 2097152,
    format: 'PDF', extractedFields: [], extractedText: '', classificationConfidence: 0, extractionAccuracy: 0, ocrProgress: 0,
    summary: null, anomalies: [], tasks: [],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.color} text-[10px] font-medium px-1.5 py-0 h-5 gap-1 border`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </Badge>
  )
}

function TypeBadge({ type }: { type: DocType }) {
  const cfg = TYPE_CONFIG[type]
  return (
    <Badge variant="secondary" className={`${cfg.bg} ${cfg.color} text-[10px] font-medium px-1.5 py-0 h-5 gap-1`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

function ConfidenceBadge({ confidence, size = 'sm' }: { confidence: number; size?: 'sm' | 'lg' }) {
  const color = confidence >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : confidence >= 70 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'
  const sz = size === 'lg' ? 'text-xs px-2 py-0.5 h-6' : 'text-[10px] px-1.5 py-0 h-5'
  return (
    <Badge variant="outline" className={`${color} ${sz} font-medium border gap-1`}>
      <Sparkles className={size === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5'} />
      {confidence}%
    </Badge>
  )
}

function PriorityBadge({ priority }: { priority: DocTask['priority'] }) {
  const colors: Record<string, string> = {
    urgent: 'text-red-700 bg-red-50 border-red-200',
    high: 'text-orange-700 bg-orange-50 border-orange-200',
    medium: 'text-amber-700 bg-amber-50 border-amber-200',
    low: 'text-slate-600 bg-slate-50 border-slate-200',
  }
  return (
    <Badge variant="outline" className={`${colors[priority]} text-[10px] font-medium px-1.5 py-0 h-5 border`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  )
}

function TaskStatusBadge({ status }: { status: DocTask['status'] }) {
  const colors: Record<string, string> = {
    todo: 'text-slate-600 bg-slate-50 border-slate-200',
    in_progress: 'text-blue-700 bg-blue-50 border-blue-200',
    review: 'text-amber-700 bg-amber-50 border-amber-200',
    completed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  }
  const labels: Record<string, string> = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', completed: 'Done' }
  return (
    <Badge variant="outline" className={`${colors[status]} text-[10px] font-medium px-1.5 py-0 h-5 border`}>
      {labels[status]}
    </Badge>
  )
}

function SkeletonCard() {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION H: STATS BAR
// ═══════════════════════════════════════════════════════════════════════════════

function StatsBar({ documents, anomalies }: { documents: SmartDocument[]; anomalies: DocAnomaly[] }) {
  const stats = useMemo(() => {
    const total = documents.length
    const processed = documents.filter(d => d.status === 'extracted' || d.status === 'reviewed').length
    const pendingReview = documents.filter(d => d.status === 'extracted').length
    const anomalyCount = anomalies.length
    const successRate = total > 0 ? Math.round((processed / total) * 100) : 0
    const typeDistribution: Record<DocType, number> = {
      invoice: 0, purchase_register: 0, sales_register: 0, gst_notice: 0, bank_statement: 0, other: 0,
    }
    documents.forEach(d => { typeDistribution[d.type]++ })
    return { total, processed, pendingReview, anomalyCount, successRate, typeDistribution }
  }, [documents, anomalies])

  const maxTypeCount = Math.max(...Object.values(stats.typeDistribution), 1)

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Documents', value: stats.total, icon: <FileText className="h-4 w-4" />, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
          { label: 'Processed', value: stats.processed, icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Pending Review', value: stats.pendingReview, icon: <Clock className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Anomalies Found', value: stats.anomalyCount, icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
        ].map((stat) => (
          <Card key={stat.label} className={`${stat.border} ${stat.bg} border`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={`${stat.color} opacity-40`}>{stat.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Success Rate:</span>
          <span className="font-semibold text-emerald-700">{stats.successRate}%</span>
          <Progress value={stats.successRate} className="w-20 h-1.5" />
        </div>
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <span className="text-sm text-muted-foreground shrink-0">By Type:</span>
          <div className="flex items-end gap-1 h-6">
            {(Object.entries(stats.typeDistribution) as [DocType, number][]).map(([type, count]) => (
              count > 0 ? (
                <div key={type} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-6 rounded-sm ${TYPE_CONFIG[type].bg} ${TYPE_CONFIG[type].color} transition-all`}
                    style={{ height: `${Math.max((count / maxTypeCount) * 20, 4)}px` }}
                    title={`${TYPE_CONFIG[type].label}: ${count}`}
                  />
                  <span className="text-[8px] text-muted-foreground">{count}</span>
                </div>
              ) : null
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A: DOCUMENT UPLOAD HUB
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentUploadHub({ onUpload }: { onUpload: (files: File[], docType: DocType) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedType, setSelectedType] = useState<DocType>('invoice')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files)
    const validExts = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'csv']
    const validFiles = fileArr.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return validExts.includes(ext)
    })
    if (validFiles.length === 0) {
      toast.error('No supported files found. Use PDF, PNG, JPG, XLSX, or CSV.')
      return
    }
    if (validFiles.length < fileArr.length) {
      toast.warning(`${fileArr.length - validFiles.length} file(s) skipped — unsupported format`)
    }
    // Simulate upload progress
    validFiles.forEach(f => {
      setUploadProgress(prev => ({ ...prev, [f.name]: 0 }))
      let progress = 0
      const interval = setInterval(() => {
        progress += Math.random() * 25 + 5
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
          toast.success(`${f.name} uploaded`)
        }
        setUploadProgress(prev => ({ ...prev, [f.name]: Math.min(progress, 100) }))
      }, 400)
    })
    onUpload(validFiles, selectedType)
  }, [onUpload, selectedType])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }, [processFiles])

  const activeUploads = Object.entries(uploadProgress).filter(([, p]) => p < 100)

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-emerald-600" />
          Document Upload Hub
        </CardTitle>
        <CardDescription className="text-xs">Upload documents for AI-powered extraction and analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48 shrink-0">
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as DocType)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300
                ${isDragging
                  ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50'
                }
              `}
            >
              <motion.div
                animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-colors ${isDragging ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <Upload className={`h-6 w-6 transition-colors ${isDragging ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {isDragging ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or click to browse — supports {SUPPORTED_FORMATS.join(', ')}
                </p>
              </motion.div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-xl border-2 border-emerald-400"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.1), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s infinite',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Active Uploads */}
        <AnimatePresence>
          {activeUploads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              {activeUploads.map(([name, progress]) => (
                <div key={name} className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5 bg-white">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{name}</p>
                    <Progress value={progress} className="h-1.5 mt-1" />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(progress)}%</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B: OCR PROCESSING CENTER
// ═══════════════════════════════════════════════════════════════════════════════

function OCRProcessingCenter({ documents, onReprocess }: { documents: SmartDocument[]; onReprocess: (id: string) => void }) {
  const processingDocs = documents.filter(d => d.status === 'processing' || d.status === 'uploading')

  const allQueueDocs = documents.filter(d => d.ocrStatus !== 'reviewed' && d.status !== 'archived')

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-emerald-600" />
              OCR Processing Center
            </CardTitle>
            <CardDescription className="text-xs">{processingDocs.length} document{processingDocs.length !== 1 ? 's' : ''} currently processing</CardDescription>
          </div>
          {processingDocs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
              <span className="text-xs text-blue-600 font-medium">Live</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {allQueueDocs.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-300 mb-2" />
            <p className="text-sm text-muted-foreground">All documents processed</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {allQueueDocs.map((doc, i) => {
              const ocrStatusLabel: Record<OCRStatus, string> = {
                queued: 'Queued', processing: 'Processing', extracted: 'Extracted', reviewed: 'Reviewed',
              }
              const ocrStatusColor: Record<OCRStatus, string> = {
                queued: 'text-slate-600 bg-slate-50', processing: 'text-blue-700 bg-blue-50',
                extracted: 'text-emerald-700 bg-emerald-50', reviewed: 'text-amber-700 bg-amber-50',
              }
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-lg border border-border/40 p-3 bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                    <Hash className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium truncate">{doc.name}</p>
                      <Badge variant="outline" className={`${ocrStatusColor[doc.ocrStatus]} text-[9px] px-1 py-0 h-4 border-0`}>
                        {ocrStatusLabel[doc.ocrStatus]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={doc.ocrProgress} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground shrink-0">{doc.ocrProgress}%</span>
                    </div>
                  </div>
                  {doc.extractionAccuracy > 0 && (
                    <div className="hidden sm:flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-muted-foreground">Accuracy</span>
                      <span className={`text-xs font-semibold ${doc.extractionAccuracy >= 90 ? 'text-emerald-600' : doc.extractionAccuracy >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {doc.extractionAccuracy}%
                      </span>
                    </div>
                  )}
                  {doc.status === 'failed' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => onReprocess(doc.id)}>
                      <RefreshCw className="h-3 w-3" />
                      Re-process
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D: DOCUMENT CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentClassification({ documents }: { documents: SmartDocument[] }) {
  const classifiedDocs = documents.filter(d => d.classificationConfidence > 0)
  const avgConfidence = classifiedDocs.length > 0
    ? Math.round(classifiedDocs.reduce((sum, d) => sum + d.classificationConfidence, 0) / classifiedDocs.length)
    : 0

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" />
              Auto-Classification
            </CardTitle>
            <CardDescription className="text-xs">AI-powered document type detection</CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Avg confidence:</span>
            <ConfidenceBadge confidence={avgConfidence} size="lg" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {classifiedDocs.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <FileSearch className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-muted-foreground">No classified documents yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {classifiedDocs.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5 bg-white"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TYPE_CONFIG[doc.type].bg} ${TYPE_CONFIG[doc.type].color} shrink-0`}>
                  {TYPE_CONFIG[doc.type].icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <TypeBadge type={doc.type} />
                  </div>
                </div>
                <ConfidenceBadge confidence={doc.classificationConfidence} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <p className="text-[10px] text-muted-foreground px-2 py-1">Re-classify as:</p>
                    {DOC_TYPE_OPTIONS.map(opt => (
                      <DropdownMenuItem
                        key={opt.value}
                        className="text-xs gap-2"
                        onClick={() => toast.success(`Re-classified as ${opt.label}`)}
                      >
                        {TYPE_CONFIG[opt.value].icon}
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E: AUTO-GENERATED SUMMARIES
// ═══════════════════════════════════════════════════════════════════════════════

function AutoSummaries({ documents, onGenerateSummary }: { documents: SmartDocument[]; onGenerateSummary: (id: string) => void }) {
  const summaryDocs = documents.filter(d => d.status === 'extracted' || d.status === 'reviewed')

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          AI-Generated Summaries
        </CardTitle>
        <CardDescription className="text-xs">Intelligent document summaries and key highlights</CardDescription>
      </CardHeader>
      <CardContent>
        {summaryDocs.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <FileText className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-muted-foreground">No documents ready for summary</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {summaryDocs.map((doc) => (
              <Collapsible key={doc.id}>
                <div className="rounded-lg border border-border/40 bg-white overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-50/50 transition-colors text-left">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TYPE_CONFIG[doc.type].bg} ${TYPE_CONFIG[doc.type].color} shrink-0`}>
                        {TYPE_CONFIG[doc.type].icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground">{doc.client}</p>
                      </div>
                      {doc.summary ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                          Summary
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 shrink-0 text-emerald-600 hover:text-emerald-700"
                          onClick={(e) => { e.stopPropagation(); onGenerateSummary(doc.id) }}
                        >
                          <Sparkles className="h-3 w-3" />
                          Generate
                        </Button>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {doc.summary && (
                      <div className="border-t border-border/40 p-3 space-y-2">
                        <p className="text-xs text-foreground/80 leading-relaxed">{doc.summary.text}</p>
                        {doc.summary.highlights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {doc.summary.highlights.map((h, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 h-5">
                                {h}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F: AUTO-CREATED TASKS
// ═══════════════════════════════════════════════════════════════════════════════

function AutoTasks({ tasks }: { tasks: DocTask[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-emerald-600" />
          Auto-Created Tasks
        </CardTitle>
        <CardDescription className="text-xs">Tasks generated from document processing</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-muted-foreground">No tasks generated yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {tasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 rounded-lg border border-border/40 p-3 bg-white"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 shrink-0 mt-0.5">
                  <ListTodo className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {task.sourceDocName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <PriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-[10px] text-muted-foreground">{task.assignedTo}</span>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 text-emerald-600 hover:text-emerald-700 px-1" onClick={() => toast.info('Opening in Tasks view')}>
                    View in Tasks <ArrowRight className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION G: ANOMALY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function AnomalyDetection({ anomalies, onInvestigate }: { anomalies: DocAnomaly[]; onInvestigate: (id: string) => void }) {
  const severityCounts = useMemo(() => ({
    high: anomalies.filter(a => a.severity === 'high').length,
    medium: anomalies.filter(a => a.severity === 'medium').length,
    low: anomalies.filter(a => a.severity === 'low').length,
  }), [anomalies])

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Anomaly Detection
            </CardTitle>
            <CardDescription className="text-xs">{anomalies.length} issue{anomalies.length !== 1 ? 's' : ''} flagged during processing</CardDescription>
          </div>
          {anomalies.length > 0 && (
            <div className="flex items-center gap-1.5">
              {severityCounts.high > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-red-200 bg-red-50 text-red-700">{severityCounts.high} High</Badge>}
              {severityCounts.medium > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-200 bg-amber-50 text-amber-700">{severityCounts.medium} Med</Badge>}
              {severityCounts.low > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-blue-200 bg-blue-50 text-blue-700">{severityCounts.low} Low</Badge>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-300 mb-2" />
            <p className="text-sm text-muted-foreground">No anomalies detected</p>
            <p className="text-[10px] text-muted-foreground/60">All documents passed validation checks</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {anomalies.map((anomaly, i) => {
              const cfg = ANOMALY_CONFIG[anomaly.type]
              const sevCfg = SEVERITY_CONFIG[anomaly.severity]
              return (
                <motion.div
                  key={anomaly.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${sevCfg.bg} ${sevCfg.border}`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 mt-0.5 ${sevCfg.bg} ${sevCfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-medium">{cfg.label}</p>
                      <Badge variant="outline" className={`${sevCfg.color} ${sevCfg.bg} text-[9px] px-1 py-0 h-4 border ${sevCfg.border}`}>
                        {anomaly.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-foreground/70 leading-relaxed">{anomaly.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <FileText className="h-2.5 w-2.5" />
                      {anomaly.sourceDocName}
                    </p>
                  </div>
                  {!anomaly.investigated ? (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 shrink-0" onClick={() => onInvestigate(anomaly.id)}>
                      <Search className="h-3 w-3" />
                      Investigate
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                      Investigated
                    </Badge>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C: DOCUMENT VIEWER (SIDE PANEL)
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentViewer({
  document: doc,
  open,
  onClose,
  onApprove,
  onFieldEdit,
}: {
  document: SmartDocument | null
  open: boolean
  onClose: () => void
  onApprove: (id: string) => void
  onFieldEdit: (docId: string, fieldKey: string, value: string) => void
}) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showExtractedText, setShowExtractedText] = useState(false)

  if (!doc) return null

  const typeCfg = TYPE_CONFIG[doc.type]

  const handleEditStart = (field: ExtractedField) => {
    setEditingField(field.key)
    setEditValue(field.value)
  }

  const handleEditSave = () => {
    if (editingField) {
      onFieldEdit(doc.id, editingField, editValue)
      setEditingField(null)
      setEditValue('')
    }
  }

  const handleEditCancel = () => {
    setEditingField(null)
    setEditValue('')
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="text-base flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${typeCfg.bg} ${typeCfg.color}`}>
              {typeCfg.icon}
            </div>
            <span className="truncate">{doc.name}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            {doc.client} • Uploaded {new Date(doc.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-5 pb-8">
          {/* Status & Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={doc.status} />
            <TypeBadge type={doc.type} />
            {doc.classificationConfidence > 0 && <ConfidenceBadge confidence={doc.classificationConfidence} />}
          </div>

          {/* File Preview Placeholder */}
          <Card className="border-border/40 bg-slate-50">
            <CardContent className="p-4">
              <div className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed border-slate-200 bg-white">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${typeCfg.bg} ${typeCfg.color} mb-2`}>
                  {typeCfg.icon}
                </div>
                <p className="text-xs font-medium text-foreground">{doc.name}</p>
                <p className="text-[10px] text-muted-foreground">{doc.size} • {doc.format}</p>
                <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1" onClick={() => toast.info('File preview coming soon')}>
                  <Eye className="h-3 w-3" />
                  Preview File
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Fields Table */}
          {doc.extractedFields.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Extracted Fields
                </h3>
                {doc.extractionAccuracy > 0 && (
                  <span className={`text-[10px] font-medium ${doc.extractionAccuracy >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {doc.extractionAccuracy}% accuracy
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] h-8 w-32">Field</TableHead>
                      <TableHead className="text-[10px] h-8">Value</TableHead>
                      <TableHead className="text-[10px] h-8 w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doc.extractedFields.map((field) => (
                      <TableRow key={field.key}>
                        <TableCell className="text-[11px] text-muted-foreground py-2 font-medium">{field.label}</TableCell>
                        <TableCell className="py-2">
                          {editingField === field.key ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-6 text-xs"
                                autoFocus
                              />
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleEditSave}>
                                <Check className="h-3 w-3 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleEditCancel}>
                                <X className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium">{field.value}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {editingField !== field.key && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditStart(field)}>
                              <Edit3 className="h-3 w-3 text-slate-400" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Extracted Text */}
          {doc.extractedText && (
            <div>
              <button
                className="flex items-center gap-1.5 text-sm font-semibold mb-2 hover:text-emerald-600 transition-colors"
                onClick={() => setShowExtractedText(!showExtractedText)}
              >
                <FileSearch className="h-3.5 w-3.5 text-emerald-600" />
                Extracted Text
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExtractedText ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showExtractedText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="rounded-lg border border-border/40 bg-slate-50 p-3">
                      <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
                        {doc.extractedText}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* AI Summary */}
          {doc.summary && (
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                AI Summary
              </h3>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-2">
                <p className="text-xs text-foreground/80 leading-relaxed">{doc.summary.text}</p>
                <div className="flex flex-wrap gap-1">
                  {doc.summary.highlights.map((h, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 h-5">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            {doc.status === 'extracted' && (
              <Button className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onApprove(doc.id)}>
                <CheckCircle2 className="h-4 w-4" />
                Approve & Mark Reviewed
              </Button>
            )}
            {doc.status === 'processing' && (
              <Button variant="outline" className="flex-1 gap-1.5" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </Button>
            )}
            {doc.status === 'reviewed' && (
              <Button variant="outline" className="flex-1 gap-1.5" disabled>
                <Check className="h-4 w-4" />
                Reviewed
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => toast.info('Download feature coming soon')}>
              <FileText className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT GRID CARD (for main listing)
// ═══════════════════════════════════════════════════════════════════════════════

function DocumentGridCard({ doc, onClick }: { doc: SmartDocument; onClick: () => void }) {
  const typeCfg = TYPE_CONFIG[doc.type]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="group relative border-border/60 hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer bg-white dark:bg-gray-900"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeCfg.bg} ${typeCfg.color}`}>
              {typeCfg.icon}
            </div>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-sm font-medium text-foreground truncate mb-0.5" title={doc.name}>{doc.name}</p>
          <p className="text-xs text-muted-foreground mb-3">{doc.client}</p>
          <div className="flex items-center justify-between mb-3">
            <TypeBadge type={doc.type} />
            {doc.classificationConfidence > 0 && <ConfidenceBadge confidence={doc.classificationConfidence} />}
          </div>
          {doc.status === 'processing' && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">OCR Progress</span>
                <span className="text-[10px] text-muted-foreground">{doc.ocrProgress}%</span>
              </div>
              <Progress value={doc.ocrProgress} className="h-1.5" />
            </div>
          )}
          <Separator className="my-3" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(doc.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span>{doc.size}</span>
          </div>
          {(doc.anomalies.length > 0 || doc.tasks.length > 0) && (
            <div className="flex items-center gap-1.5 mt-2">
              {doc.anomalies.length > 0 && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-red-200 bg-red-50 text-red-600 gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {doc.anomalies.length}
                </Badge>
              )}
              {doc.tasks.length > 0 && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-200 bg-amber-50 text-amber-600 gap-0.5">
                  <ListTodo className="h-2.5 w-2.5" />
                  {doc.tasks.length}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<SmartDocument[]>(SAMPLE_DOCS)
  const [anomalies, setAnomalies] = useState<DocAnomaly[]>(SAMPLE_ANOMALIES)
  const [allTasks, setAllTasks] = useState<DocTask[]>(SAMPLE_TASKS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<SmartDocument | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'anomalies'>('all')

  const filteredDocs = useMemo(() => {
    let result = documents
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.client.toLowerCase().includes(q) ||
        TYPE_CONFIG[d.type].label.toLowerCase().includes(q)
      )
    }
    if (activeTab === 'processing') {
      result = result.filter(d => d.status === 'processing' || d.status === 'uploading')
    }
    if (activeTab === 'anomalies') {
      const anomalyDocIds = new Set(anomalies.map(a => a.sourceDocId))
      result = result.filter(d => anomalyDocIds.has(d.id))
    }
    return result
  }, [documents, searchQuery, activeTab, anomalies])

  const handleUpload = useCallback((files: File[], docType: DocType) => {
    const newDocs: SmartDocument[] = files.map((f, i) => ({
      id: `doc-new-${Date.now()}-${i}`,
      name: f.name,
      type: docType,
      client: 'Unassigned',
      status: 'uploading' as DocStatus,
      ocrStatus: 'queued' as OCRStatus,
      uploadDate: new Date().toISOString().split('T')[0],
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      sizeBytes: f.size,
      format: f.name.split('.').pop()?.toUpperCase() || 'PDF',
      extractedFields: [],
      extractedText: '',
      classificationConfidence: 0,
      extractionAccuracy: 0,
      ocrProgress: 0,
      summary: null,
      anomalies: [],
      tasks: [],
    }))
    setDocuments(prev => [...newDocs, ...prev])
    toast.success(`${files.length} document${files.length !== 1 ? 's' : ''} queued for upload`)

    // Simulate processing
    newDocs.forEach(nd => {
      setTimeout(() => {
        setDocuments(prev => prev.map(d =>
          d.id === nd.id ? { ...d, status: 'processing', ocrStatus: 'processing', ocrProgress: 15 } : d
        ))
      }, 1500)
      setTimeout(() => {
        setDocuments(prev => prev.map(d =>
          d.id === nd.id ? { ...d, ocrProgress: 45, classificationConfidence: 82 } : d
        ))
      }, 3000)
      setTimeout(() => {
        setDocuments(prev => prev.map(d =>
          d.id === nd.id ? {
            ...d, status: 'extracted', ocrStatus: 'extracted', ocrProgress: 100,
            extractionAccuracy: 87, classificationConfidence: 91,
            extractedFields: getFieldsForType(docType),
            extractedText: `Extracted content from ${f.name}\nDocument Type: ${TYPE_CONFIG[docType].label}\nProcessing completed successfully.`,
          } : d
        ))
      }, 5000)
    })
  }, [])

  const handleReprocess = useCallback((id: string) => {
    setDocuments(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'processing', ocrStatus: 'processing', ocrProgress: 0, extractionAccuracy: 0 } : d
    ))
    toast.info('Re-processing document...')
    setTimeout(() => {
      setDocuments(prev => prev.map(d =>
        d.id === id ? { ...d, status: 'extracted', ocrStatus: 'extracted', ocrProgress: 100, extractionAccuracy: 88 } : d
      ))
      toast.success('Document re-processed successfully')
    }, 3000)
  }, [])

  const handleApprove = useCallback((id: string) => {
    setDocuments(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'reviewed', ocrStatus: 'reviewed' } : d
    ))
    toast.success('Document marked as reviewed')
    setViewerOpen(false)
  }, [])

  const handleFieldEdit = useCallback((docId: string, fieldKey: string, value: string) => {
    setDocuments(prev => prev.map(d =>
      d.id === docId ? {
        ...d,
        extractedFields: d.extractedFields.map(f => f.key === fieldKey ? { ...f, value } : f),
      } : d
    ))
    toast.success('Field updated')
  }, [])

  const handleGenerateSummary = useCallback((id: string) => {
    const doc = documents.find(d => d.id === id)
    if (!doc) return
    const typeLabel = TYPE_CONFIG[doc.type].label
    const newSummary: DocSummary = {
      text: `AI-generated analysis of ${doc.name}. This ${typeLabel.toLowerCase()} from ${doc.client} was processed with ${doc.extractionAccuracy}% extraction accuracy. Key data has been extracted and validated against GST compliance rules.`,
      highlights: [typeLabel, doc.client, `${doc.extractionAccuracy}% accuracy`],
      generated: true,
    }
    setDocuments(prev => prev.map(d =>
      d.id === id ? { ...d, summary: newSummary } : d
    ))
    toast.success('Summary generated')
  }, [documents])

  const handleInvestigate = useCallback((id: string) => {
    setAnomalies(prev => prev.map(a =>
      a.id === id ? { ...a, investigated: true } : a
    ))
    toast.info('Anomaly investigation started')
  }, [])

  const handleDocClick = useCallback((doc: SmartDocument) => {
    setSelectedDoc(doc)
    setViewerOpen(true)
  }, [])

  const handleDelete = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id))
    if (selectedDoc?.id === id) {
      setViewerOpen(false)
      setSelectedDoc(null)
    }
    toast.success('Document deleted')
  }, [selectedDoc])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-emerald-600" />
            Document Intelligence Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered document processing, extraction & analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Section H: Stats Bar */}
      <StatsBar documents={documents} anomalies={anomalies} />

      {/* Section A: Upload Hub */}
      <DocumentUploadHub onUpload={handleUpload} />

      {/* Main Grid: Processing + Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section B: OCR Processing Center */}
        <OCRProcessingCenter documents={documents} onReprocess={handleReprocess} />
        {/* Section D: Document Classification */}
        <DocumentClassification documents={documents} />
      </div>

      {/* Tab Filters + Document Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {(['all', 'processing', 'anomalies'] as const).map(tab => {
            const count = tab === 'all' ? documents.length
              : tab === 'processing' ? documents.filter(d => d.status === 'processing' || d.status === 'uploading').length
              : anomalies.length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-muted-foreground hover:bg-slate-100 hover:text-foreground'
                }`}
              >
                {tab === 'all' ? 'All Documents' : tab === 'processing' ? 'Processing' : 'With Anomalies'}
                <span className="ml-1.5 text-[10px] opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileSearch className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No documents found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery ? 'Try adjusting your search query' : 'Upload a document to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredDocs.map(doc => (
                <DocumentGridCard key={doc.id} doc={doc} onClick={() => handleDocClick(doc)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom Row: Summaries + Tasks + Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section E: Auto-Generated Summaries */}
        <AutoSummaries documents={documents} onGenerateSummary={handleGenerateSummary} />
        {/* Section F: Auto-Created Tasks */}
        <AutoTasks tasks={allTasks} />
        {/* Section G: Anomaly Detection */}
        <AnomalyDetection anomalies={anomalies} onInvestigate={handleInvestigate} />
      </div>

      {/* Section C: Document Viewer Side Panel */}
      <DocumentViewer
        document={selectedDoc}
        open={viewerOpen}
        onClose={() => { setViewerOpen(false); setSelectedDoc(null) }}
        onApprove={handleApprove}
        onFieldEdit={handleFieldEdit}
      />
    </div>
  )
}
