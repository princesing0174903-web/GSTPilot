'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  FileText,
  ArrowRight,
  Upload,
  Pencil,
  Check,
  ChevronDown,
  Building2,
  ShoppingCart,
  Store,
  Receipt,
  Plane,
  FileMinus,
  PartyPopper,
  X,
  Filter,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { Invoice, Client, GSTR1Section } from '@/types/gst';
import { GSTR1_SECTION_LABELS } from '@/types/gst';
import { formatCurrency, formatNumber } from '@/lib/gst-utils';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
type ValidationStatus = 'validated' | 'warning' | 'error';
type SectionFilter = 'all' | GSTR1Section;
type StatusFilter = 'all' | 'validated' | 'warning' | 'error';

interface ValidationIssue {
  id: string;
  severity: 'critical' | 'warning';
  description: string;
  invoiceId: string;
  invoiceNumber: string;
}

interface SectionCardData {
  section: GSTR1Section;
  label: string;
  icon: React.ReactNode;
  count: number;
  totalTaxable: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

// ──────────────────────────────────────────────
// Mock Data
// ──────────────────────────────────────────────
const MOCK_CLIENTS: Client[] = [
  {
    id: 'cl-001',
    gstin: '27AABCS1429B1Z5',
    tradeName: 'Sharma Enterprises',
    legalName: 'Sharma Enterprises Pvt Ltd',
    address: '302, Laxmi Nagar, Andheri East, Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    contactEmail: 'accounts@sharmaent.com',
    contactPhone: '+91-22-2847-3001',
    entityType: 'regular',
    returnPeriod: '2025-06',
    status: 'active',
    healthScore: 92,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-05-11T00:00:00.000Z',
  },
  {
    id: 'cl-002',
    gstin: '24AABCP5678G1Z3',
    tradeName: 'Patel & Sons',
    legalName: 'Patel & Sons Trading Co',
    address: '15, CG Road, Navrangpura, Ahmedabad',
    state: 'Gujarat',
    stateCode: '24',
    contactEmail: 'gst@patelsons.com',
    contactPhone: '+91-79-6677-8888',
    entityType: 'regular',
    returnPeriod: '2025-06',
    status: 'active',
    healthScore: 88,
    createdAt: '2025-02-10T00:00:00.000Z',
    updatedAt: '2025-05-09T00:00:00.000Z',
  },
  {
    id: 'cl-003',
    gstin: '06AABCK9012H1Z1',
    tradeName: 'Krishna Traders',
    legalName: 'Krishna Traders Pvt Ltd',
    address: 'Plot 45, Udyog Vihar, Phase III, Gurugram',
    state: 'Haryana',
    stateCode: '06',
    contactEmail: 'gst@krishnatraders.in',
    contactPhone: '+91-124-2852-0261',
    entityType: 'regular',
    returnPeriod: '2025-06',
    status: 'active',
    healthScore: 95,
    createdAt: '2025-03-05T00:00:00.000Z',
    updatedAt: '2025-05-11T00:00:00.000Z',
  },
  {
    id: 'cl-004',
    gstin: '09AABCG2345L1Z2',
    tradeName: 'Gupta Manufacturing',
    legalName: 'Gupta Manufacturing Co',
    address: '12, Sector 62, Noida',
    state: 'Uttar Pradesh',
    stateCode: '09',
    contactEmail: 'finance@guptamfg.com',
    contactPhone: '+91-120-2345-6789',
    entityType: 'composition',
    returnPeriod: '2025-06',
    status: 'active',
    healthScore: 78,
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-04-18T00:00:00.000Z',
  },
];

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    clientId: 'cl-001',
    invoiceNumber: 'SE/2025/05/0847',
    invoiceDate: '2025-05-05',
    sellerGstin: '27AABCS1429B1Z5',
    buyerGstin: '24AABCP5678G1Z3',
    buyerName: 'Patel & Sons',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 850000,
    cgst: 42500,
    sgst: 42500,
    igst: 0,
    cess: 0,
    totalAmount: 935000,
    hsnCode: '8471',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 5,
    createdAt: '2025-05-05T10:00:00.000Z',
    updatedAt: '2025-05-05T10:00:00.000Z',
    client: MOCK_CLIENTS[0],
  },
  {
    id: 'inv-002',
    clientId: 'cl-001',
    invoiceNumber: 'SE/2025/05/0848',
    invoiceDate: '2025-05-07',
    sellerGstin: '27AABCS1429B1Z5',
    buyerGstin: '06AABCK9012H1Z1',
    buyerName: 'Krishna Traders',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 1250000,
    cgst: 62500,
    sgst: 62500,
    igst: 0,
    cess: 0,
    totalAmount: 1375000,
    hsnCode: '2710',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 3,
    createdAt: '2025-05-07T11:30:00.000Z',
    updatedAt: '2025-05-07T11:30:00.000Z',
    client: MOCK_CLIENTS[0],
  },
  {
    id: 'inv-003',
    clientId: 'cl-002',
    invoiceNumber: 'PS/2025/05/1205',
    invoiceDate: '2025-05-10',
    sellerGstin: '24AABCP5678G1Z3',
    buyerGstin: '09AABCG2345L1Z2',
    buyerName: 'Gupta Manufacturing',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 2340000,
    cgst: 0,
    sgst: 0,
    igst: 280800,
    cess: 0,
    totalAmount: 2620800,
    hsnCode: '9983',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'partial_match',
    riskLevel: 'medium',
    riskScore: 35,
    aiExplanation: 'GST amount shows minor discrepancy with GSTR-2B data',
    createdAt: '2025-05-10T09:15:00.000Z',
    updatedAt: '2025-05-10T09:15:00.000Z',
    client: MOCK_CLIENTS[1],
  },
  {
    id: 'inv-004',
    clientId: 'cl-001',
    invoiceNumber: 'SE/2025/05/0849',
    invoiceDate: '2025-05-12',
    sellerGstin: '27AABCS1429B1Z5',
    buyerGstin: undefined,
    buyerName: 'Retail Customer',
    invoiceType: 'B2C Large',
    gstr1Section: 'b2cl',
    taxableValue: 350000,
    cgst: 17500,
    sgst: 17500,
    igst: 0,
    cess: 0,
    totalAmount: 385000,
    hsnCode: '8471',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 8,
    createdAt: '2025-05-12T14:20:00.000Z',
    updatedAt: '2025-05-12T14:20:00.000Z',
    client: MOCK_CLIENTS[0],
  },
  {
    id: 'inv-005',
    clientId: 'cl-002',
    invoiceNumber: 'PS/2025/05/1206',
    invoiceDate: '2025-05-14',
    sellerGstin: '24AABCP5678G1Z3',
    buyerGstin: undefined,
    buyerName: 'Walk-in Customer',
    invoiceType: 'B2C Small',
    gstr1Section: 'b2cs',
    taxableValue: 45000,
    cgst: 2250,
    sgst: 2250,
    igst: 0,
    cess: 0,
    totalAmount: 49500,
    hsnCode: '9983',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 2,
    createdAt: '2025-05-14T16:45:00.000Z',
    updatedAt: '2025-05-14T16:45:00.000Z',
    client: MOCK_CLIENTS[1],
  },
  {
    id: 'inv-006',
    clientId: 'cl-003',
    invoiceNumber: 'KT/2025/05/0312',
    invoiceDate: '2025-05-15',
    sellerGstin: '06AABCK9012H1Z1',
    buyerGstin: '27AABCS1429B1Z5',
    buyerName: 'Sharma Enterprises',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 675000,
    cgst: 33750,
    sgst: 33750,
    igst: 0,
    cess: 0,
    totalAmount: 742500,
    hsnCode: '9983',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'mismatch',
    riskLevel: 'high',
    riskScore: 65,
    aiExplanation: 'GSTIN of buyer does not match records in GSTR-2B',
    createdAt: '2025-05-15T08:00:00.000Z',
    updatedAt: '2025-05-15T08:00:00.000Z',
    client: MOCK_CLIENTS[2],
  },
  {
    id: 'inv-007',
    clientId: 'cl-003',
    invoiceNumber: 'KT/2025/05/CN-001',
    invoiceDate: '2025-05-16',
    sellerGstin: '06AABCK9012H1Z1',
    buyerGstin: '27AABCS1429B1Z5',
    buyerName: 'Sharma Enterprises',
    invoiceType: 'Credit Note',
    gstr1Section: 'cdnr',
    taxableValue: -150000,
    cgst: -7500,
    sgst: -7500,
    igst: 0,
    cess: 0,
    totalAmount: -165000,
    hsnCode: '9983',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 4,
    notes: 'Credit note for partial return of services in Apr 2025',
    createdAt: '2025-05-16T10:30:00.000Z',
    updatedAt: '2025-05-16T10:30:00.000Z',
    client: MOCK_CLIENTS[2],
  },
  {
    id: 'inv-008',
    clientId: 'cl-004',
    invoiceNumber: 'GM/2025/05/EXP-045',
    invoiceDate: '2025-05-18',
    sellerGstin: '09AABCG2345L1Z2',
    buyerGstin: undefined,
    buyerName: 'GlobalTech Ltd (USA)',
    invoiceType: 'Export',
    gstr1Section: 'exp',
    taxableValue: 5600000,
    cgst: 0,
    sgst: 0,
    igst: 672000,
    cess: 0,
    totalAmount: 6272000,
    hsnCode: '8471',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 10,
    createdAt: '2025-05-18T07:00:00.000Z',
    updatedAt: '2025-05-18T07:00:00.000Z',
    client: MOCK_CLIENTS[3],
  },
  {
    id: 'inv-009',
    clientId: 'cl-002',
    invoiceNumber: 'PS/2025/05/1207',
    invoiceDate: '2025-05-20',
    sellerGstin: '24AABCP5678G1Z3',
    buyerGstin: undefined,
    buyerName: 'Retail Customer',
    invoiceType: 'B2C Small',
    gstr1Section: 'b2cs',
    taxableValue: 18000,
    cgst: 900,
    sgst: 900,
    igst: 0,
    cess: 0,
    totalAmount: 19800,
    hsnCode: '9983',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'missing_in_gstr',
    riskLevel: 'critical',
    riskScore: 80,
    aiExplanation: 'Invoice found in books but not reflected in GSTR-2B',
    createdAt: '2025-05-20T12:00:00.000Z',
    updatedAt: '2025-05-20T12:00:00.000Z',
    client: MOCK_CLIENTS[1],
  },
  {
    id: 'inv-010',
    clientId: 'cl-004',
    invoiceNumber: 'GM/2025/05/DN-012',
    invoiceDate: '2025-05-22',
    sellerGstin: '09AABCG2345L1Z2',
    buyerGstin: '27AABCS1429B1Z5',
    buyerName: 'Sharma Enterprises',
    invoiceType: 'Debit Note',
    gstr1Section: 'cdnur',
    taxableValue: 95000,
    cgst: 4750,
    sgst: 4750,
    igst: 0,
    cess: 0,
    totalAmount: 104500,
    hsnCode: '8471',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'duplicate',
    riskLevel: 'high',
    riskScore: 70,
    aiExplanation: 'Duplicate debit note detected - same amount and buyer GSTIN',
    createdAt: '2025-05-22T15:30:00.000Z',
    updatedAt: '2025-05-22T15:30:00.000Z',
    client: MOCK_CLIENTS[3],
  },
  {
    id: 'inv-011',
    clientId: 'cl-001',
    invoiceNumber: 'SE/2025/05/0850',
    invoiceDate: '2025-05-24',
    sellerGstin: '27AABCS1429B1Z5',
    buyerGstin: '24AABCP5678G1Z3',
    buyerName: 'Patel & Sons',
    invoiceType: 'B2B',
    gstr1Section: 'b2b',
    taxableValue: 520000,
    cgst: 26000,
    sgst: 26000,
    igst: 0,
    cess: 0,
    totalAmount: 572000,
    hsnCode: '2710',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 6,
    createdAt: '2025-05-24T09:00:00.000Z',
    updatedAt: '2025-05-24T09:00:00.000Z',
    client: MOCK_CLIENTS[0],
  },
  {
    id: 'inv-012',
    clientId: 'cl-004',
    invoiceNumber: 'GM/2025/05/EXP-046',
    invoiceDate: '2025-05-25',
    sellerGstin: '09AABCG2345L1Z2',
    buyerGstin: undefined,
    buyerName: 'GlobalTech Ltd (UK)',
    invoiceType: 'Export',
    gstr1Section: 'exp',
    taxableValue: 3200000,
    cgst: 0,
    sgst: 0,
    igst: 384000,
    cess: 0,
    totalAmount: 3584000,
    hsnCode: '8471',
    reverseCharge: false,
    status: 'draft',
    matchStatus: 'perfect_match',
    riskLevel: 'low',
    riskScore: 7,
    createdAt: '2025-05-25T11:00:00.000Z',
    updatedAt: '2025-05-25T11:00:00.000Z',
    client: MOCK_CLIENTS[3],
  },
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function getValidationStatus(inv: Invoice): ValidationStatus {
  if (inv.riskLevel === 'critical' || inv.riskLevel === 'high' || inv.matchStatus === 'mismatch' || inv.matchStatus === 'missing_in_gstr' || inv.matchStatus === 'duplicate') {
    return 'error';
  }
  if (inv.riskLevel === 'medium' || inv.matchStatus === 'partial_match' || inv.matchStatus === 'missing_in_books') {
    return 'warning';
  }
  return 'validated';
}

function getValidationConfig(status: ValidationStatus) {
  switch (status) {
    case 'validated':
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        label: 'Validated',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Warning',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    case 'error':
      return {
        icon: <XCircle className="h-4 w-4" />,
        label: 'Error',
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        badgeClass: 'border-red-200 bg-red-50 text-red-700',
      };
  }
}

function getSectionBadgeConfig(section: GSTR1Section) {
  switch (section) {
    case 'b2b':
      return { label: 'B2B', className: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'b2cl':
      return { label: 'B2C Large', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'b2cs':
      return { label: 'B2C Small', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'cdnr':
      return { label: 'CDN-R', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'cdnur':
      return { label: 'CDN-UR', className: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'exp':
      return { label: 'Export', className: 'bg-violet-50 text-violet-700 border-violet-200' };
    default:
      return { label: section, className: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

// ──────────────────────────────────────────────
// Animation Variants
// ──────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const sectionCardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function ReviewPage() {
  const { setCurrentView, selectedClientId } = useApp();

  // ── Data ──
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // ── Loading ──
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Issues panel ──
  const [issuesOpen, setIssuesOpen] = useState(true);

  // ── Success state ──
  const [showSuccess, setShowSuccess] = useState(false);

  // ──────────────────────────────────────────
  // Data Fetching
  // ──────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set('clientId', selectedClientId);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.invoices && data.invoices.length > 0) {
          setInvoices(data.invoices);
          return;
        }
      }
      // Honest empty state — no mock data fabrication
      setInvoices([]);
    } catch {
      setInvoices([]);
    }
  }, [selectedClientId]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        if (data.clients && data.clients.length > 0) {
          setClients(data.clients);
          return;
        }
      }
      setClients([]);
    } catch {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchInvoices(), fetchClients()]);
      setLoading(false);
    }
    loadAll();
  }, [fetchInvoices, fetchClients]);

  // ──────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────
  const validationMap = useMemo(() => {
    const map = new Map<string, ValidationStatus>();
    invoices.forEach(inv => {
      map.set(inv.id, getValidationStatus(inv));
    });
    return map;
  }, [invoices]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const validated = invoices.filter(inv => validationMap.get(inv.id) === 'validated').length;
    const withIssues = total - validated;
    return { total, validated, withIssues };
  }, [invoices, validationMap]);

  const sectionCards: SectionCardData[] = useMemo(() => {
    const sections: GSTR1Section[] = ['b2b', 'b2cl', 'b2cs', 'cdnr', 'cdnur', 'exp'];
    const iconMap: Record<GSTR1Section, React.ReactNode> = {
      b2b: <Building2 className="h-5 w-5" />,
      b2cl: <ShoppingCart className="h-5 w-5" />,
      b2cs: <Store className="h-5 w-5" />,
      cdnr: <Receipt className="h-5 w-5" />,
      cdnur: <FileMinus className="h-5 w-5" />,
      exp: <Plane className="h-5 w-5" />,
    };
    const colorMap: Record<GSTR1Section, { color: string; bgColor: string; borderColor: string }> = {
      b2b: { color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
      b2cl: { color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
      b2cs: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
      cdnr: { color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
      cdnur: { color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
      exp: { color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
    };

    return sections.map(section => {
      const sectionInvs = invoices.filter(inv => inv.gstr1Section === section);
      const colors = colorMap[section];
      return {
        section,
        label: GSTR1_SECTION_LABELS[section],
        icon: iconMap[section],
        count: sectionInvs.length,
        totalTaxable: sectionInvs.reduce((sum, inv) => sum + Math.abs(inv.taxableValue), 0),
        ...colors,
      };
    });
  }, [invoices]);

  const validationIssues: ValidationIssue[] = useMemo(() => {
    return invoices
      .filter(inv => {
        const status = validationMap.get(inv.id);
        return status === 'error' || status === 'warning';
      })
      .map(inv => ({
        id: `issue-${inv.id}`,
        severity: validationMap.get(inv.id) === 'error' ? 'critical' as const : 'warning' as const,
        description: inv.aiExplanation || `${inv.matchStatus.replace(/_/g, ' ')} detected for invoice ${inv.invoiceNumber}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
      }));
  }, [invoices, validationMap]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (sectionFilter !== 'all' && inv.gstr1Section !== sectionFilter) return false;
      if (statusFilter !== 'all' && validationMap.get(inv.id) !== statusFilter) return false;
      if (clientFilter !== 'all' && inv.clientId !== clientFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const invNum = inv.invoiceNumber.toLowerCase();
        const buyerName = (inv.buyerName || '').toLowerCase();
        const sellerGstin = inv.sellerGstin.toLowerCase();
        if (!invNum.includes(q) && !buyerName.includes(q) && !sellerGstin.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, sectionFilter, statusFilter, clientFilter, searchQuery, validationMap]);

  const criticalIssues = useMemo(() => validationIssues.filter(i => i.severity === 'critical'), [validationIssues]);
  const warningIssues = useMemo(() => validationIssues.filter(i => i.severity === 'warning'), [validationIssues]);

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = (id: string) => {
    setInvoices(prev =>
      prev.map(inv => (inv.id === id ? { ...inv, status: 'approved' as const } : inv))
    );
  };

  const handleApproveAllValid = () => {
    const validIds = invoices
      .filter(inv => validationMap.get(inv.id) === 'validated' && inv.status !== 'approved')
      .map(inv => inv.id);

    setInvoices(prev =>
      prev.map(inv => (validIds.includes(inv.id) ? { ...inv, status: 'approved' as const } : inv))
    );
    setSelectedIds(new Set());

    // Check if all invoices are now approved
    const allApproved = invoices.every(
      inv => validIds.includes(inv.id) || inv.status === 'approved'
    );
    if (allApproved || validIds.length === stats.validated) {
      const remainingUnapproved = invoices.filter(inv => inv.status !== 'approved' && !validIds.includes(inv.id));
      if (remainingUnapproved.length === 0) {
        setShowSuccess(true);
      }
    }
  };

  const handleRejectAllErrors = () => {
    const errorIds = invoices
      .filter(inv => validationMap.get(inv.id) === 'error')
      .map(inv => inv.id);

    setInvoices(prev =>
      prev.map(inv => (errorIds.includes(inv.id) ? { ...inv, status: 'cancelled' as const } : inv))
    );
    setSelectedIds(new Set());
  };

  const handleContinueToReconcile = () => {
    setCurrentView('reconcile');
  };

  const handleGoToUpload = () => {
    setCurrentView('upload');
  };

  const handleFixIssue = (issue: ValidationIssue) => {
    setSectionFilter('all');
    setStatusFilter('all');
    setSearchQuery(issue.invoiceNumber);
  };

  // ──────────────────────────────────────────
  // Render: Skeleton Loader
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-[1440px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-80 rounded-lg mt-2" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Success State
  // ──────────────────────────────────────────
  const allApproved = invoices.length > 0 && invoices.every(inv => inv.status === 'approved');
  if (showSuccess || (allApproved && !loading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100"
          >
            <PartyPopper className="h-10 w-10 text-emerald-600" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            All Invoices Validated!
          </h2>
          <p className="text-muted-foreground mb-8">
            {formatNumber(invoices.length)} invoices have been reviewed and approved. Ready for reconciliation.
          </p>
          <Button
            onClick={handleContinueToReconcile}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm px-8 h-12 text-base"
          >
            Continue to Reconcile
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Empty State
  // ──────────────────────────────────────────
  if (invoices.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-md"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-10 w-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            No Invoices to Review
          </h2>
          <p className="text-muted-foreground mb-8">
            Upload documents first to extract invoices for review and validation.
          </p>
          <Button
            onClick={handleGoToUpload}
            variant="outline"
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 px-8 h-12"
          >
            <Upload className="h-5 w-5" />
            Go to Upload
          </Button>
        </motion.div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // Render: Main
  // ──────────────────────────────────────────
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1440px] mx-auto pb-28">
      {/* ════════════════════════════════════════════
          1. Page Header
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Review Extracted Invoices
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verify AI-extracted data before reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-sm font-semibold text-foreground">{formatNumber(stats.total)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-emerald-600">Validated</span>
            <span className="text-sm font-semibold text-emerald-700">{formatNumber(stats.validated)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-600">Issues</span>
            <span className="text-sm font-semibold text-amber-700">{formatNumber(stats.withIssues)}</span>
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          2. Filter Bar
      ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        {/* Client dropdown */}
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm bg-white">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.tradeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Section filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSectionFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              sectionFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-3 w-3" />
            All Sections
          </button>
          <button
            onClick={() => setSectionFilter('b2b')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              sectionFilter === 'b2b'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-white text-teal-600 border border-teal-200 hover:bg-teal-50'
            }`}
          >
            B2B
          </button>
          <button
            onClick={() => setSectionFilter('b2cl')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              sectionFilter === 'b2cl'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-white text-cyan-600 border border-cyan-200 hover:bg-cyan-50'
            }`}
          >
            B2C Large
          </button>
          <button
            onClick={() => setSectionFilter('b2cs')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              sectionFilter === 'b2cs'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            B2C Small
          </button>
          <button
            onClick={() => setSectionFilter('cdnr')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              sectionFilter === 'cdnr'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'
            }`}
          >
            Credit Notes
          </button>
          <button
            onClick={() => setSectionFilter('exp')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              sectionFilter === 'exp'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white text-violet-600 border border-violet-200 hover:bg-violet-50'
            }`}
          >
            Export
          </button>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Status
          </button>
          <button
            onClick={() => setStatusFilter('validated')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              statusFilter === 'validated'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Validated
          </button>
          <button
            onClick={() => setStatusFilter('warning')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              statusFilter === 'warning'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Warning
          </button>
          <button
            onClick={() => setStatusFilter('error')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              statusFilter === 'error'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            <XCircle className="h-3 w-3" />
            Error
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-auto sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-full sm:w-[200px] bg-white text-sm"
          />
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          3. Section Breakdown Cards
      ════════════════════════════════════════════ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        {sectionCards.map((card) => (
          <motion.div key={card.section} variants={sectionCardVariants}>
            <button
              onClick={() => setSectionFilter(sectionFilter === card.section ? 'all' : card.section)}
              className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${
                sectionFilter === card.section
                  ? `${card.borderColor} ${card.bgColor} shadow-sm ring-1 ring-current/10`
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${
                  sectionFilter === card.section ? 'bg-white/80' : card.bgColor
                }`}>
                  <span className={sectionFilter === card.section ? card.color : card.color}>
                    {card.icon}
                  </span>
                </div>
                <span className={`text-xs font-semibold ${
                  sectionFilter === card.section ? card.color : 'text-slate-700'
                }`}>
                  {card.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-foreground">{card.count}</span>
                <span className="text-[11px] text-muted-foreground">invoices</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(card.totalTaxable)} taxable
              </p>
            </button>
          </motion.div>
        ))}
      </motion.div>

      {/* ════════════════════════════════════════════
          4. Validation Issues Panel
      ════════════════════════════════════════════ */}
      {validationIssues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Collapsible open={issuesOpen} onOpenChange={setIssuesOpen}>
            <Card className="border-amber-200/60 bg-amber-50/30">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer hover:bg-amber-50/50 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <CardTitle className="text-sm font-semibold text-amber-800">
                        Validation Issues ({validationIssues.length})
                      </CardTitle>
                    </div>
                    <motion.div
                      animate={{ rotate: issuesOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-4 w-4 text-amber-600" />
                    </motion.div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 space-y-3">
                  {/* Critical Issues */}
                  {criticalIssues.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        Critical ({criticalIssues.length})
                      </p>
                      <div className="space-y-2">
                        {criticalIssues.map((issue) => (
                          <motion.div
                            key={issue.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-white p-3"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm text-foreground leading-snug">{issue.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Invoice: {issue.invoiceNumber}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFixIssue(issue)}
                              className="shrink-0 h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            >
                              <Pencil className="h-3 w-3" />
                              Fix
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning Issues */}
                  {warningIssues.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Warning ({warningIssues.length})
                      </p>
                      <div className="space-y-2">
                        {warningIssues.map((issue) => (
                          <motion.div
                            key={issue.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm text-foreground leading-snug">{issue.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Invoice: {issue.invoiceNumber}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFixIssue(issue)}
                              className="shrink-0 h-7 text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                            >
                              <Pencil className="h-3 w-3" />
                              Fix
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════
          5. Invoice Cards
      ════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Invoices
            <span className="text-muted-foreground font-normal ml-1.5">
              ({filteredInvoices.length} shown)
            </span>
          </h2>
          {filteredInvoices.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const allFiltered = filteredInvoices.map(inv => inv.id);
                if (allFiltered.every(id => selectedIds.has(id))) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(allFiltered));
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground h-7"
            >
              {filteredInvoices.every(inv => selectedIds.has(inv.id)) && filteredInvoices.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[calc(100vh-520px)] min-h-[300px]">
          <AnimatePresence mode="popLayout">
            {filteredInvoices.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <Search className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No invoices match your filters</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting the section, status, or search criteria</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSectionFilter('all');
                    setStatusFilter('all');
                    setClientFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-4 h-8 text-xs"
                >
                  Clear Filters
                </Button>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {filteredInvoices.map((inv) => {
                  const vStatus = validationMap.get(inv.id) || 'validated';
                  const vConfig = getValidationConfig(vStatus);
                  const sBadge = getSectionBadgeConfig(inv.gstr1Section);
                  const isSelected = selectedIds.has(inv.id);
                  const isApproved = inv.status === 'approved';
                  const clientName = inv.client?.tradeName || inv.buyerName || 'Unknown';

                  return (
                    <motion.div
                      key={inv.id}
                      variants={cardVariants}
                      layout
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <Card
                        className={`relative transition-all hover:shadow-md cursor-pointer group ${
                          isApproved
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : isSelected
                            ? 'border-teal-300 bg-teal-50/30 ring-1 ring-teal-200'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                        onClick={() => toggleSelect(inv.id)}
                      >
                        {/* Selection indicator */}
                        <div className={`absolute top-3 right-3 flex items-center justify-center h-5 w-5 rounded-md border-2 transition-colors ${
                          isSelected
                            ? 'bg-teal-600 border-teal-600'
                            : 'border-slate-300 bg-white group-hover:border-slate-400'
                        }`}>
                          {(isSelected || isApproved) && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>

                        <CardContent className="p-4 pt-4">
                          {/* Header: Invoice number + Section badge */}
                          <div className="flex items-start gap-2 pr-8 mb-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground truncate leading-tight">
                                {inv.invoiceNumber}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {clientName}
                              </p>
                            </div>
                          </div>

                          {/* Section badge + Date */}
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${sBadge.className}`}>
                              {sBadge.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          {/* Amount breakdown */}
                          <div className="rounded-lg bg-slate-50 p-2.5 mb-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-muted-foreground">Taxable Value</span>
                              <span className="text-sm font-semibold text-foreground">
                                {formatCurrency(Math.abs(inv.taxableValue))}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {inv.cgst > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">CGST</span>
                                  <span className="text-[11px] text-foreground">{formatCurrency(inv.cgst)}</span>
                                </div>
                              )}
                              {inv.sgst > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">SGST</span>
                                  <span className="text-[11px] text-foreground">{formatCurrency(inv.sgst)}</span>
                                </div>
                              )}
                              {inv.igst > 0 && (
                                <div className="flex items-center justify-between col-span-2">
                                  <span className="text-[10px] text-muted-foreground">IGST</span>
                                  <span className="text-[11px] text-foreground">{formatCurrency(inv.igst)}</span>
                                </div>
                              )}
                            </div>
                            <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-muted-foreground">Total</span>
                              <span className="text-sm font-bold text-foreground">
                                {formatCurrency(Math.abs(inv.totalAmount))}
                              </span>
                            </div>
                          </div>

                          {/* Validation status + Actions */}
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={`text-[10px] h-6 gap-1 ${vConfig.badgeClass}`}>
                              {vConfig.icon}
                              {vConfig.label}
                            </Badge>

                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Focus search on this invoice for editing
                                  setSearchQuery(inv.invoiceNumber);
                                }}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {!isApproved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(inv.id);
                                  }}
                                  className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isApproved && (
                                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approved
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </div>

      {/* ════════════════════════════════════════════
          6. Bulk Actions Bar (sticky bottom)
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {(selectedIds.size > 0 || stats.withIssues > 0 || stats.validated > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          >
            <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-slate-600" />
                    </button>
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
                    </span>
                  </div>
                )}
                {selectedIds.size === 0 && (
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(invoices.length)} invoices &middot; {formatNumber(stats.validated)} validated &middot; {formatNumber(stats.withIssues)} with issues
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {stats.validated > 0 && (
                  <Button
                    onClick={handleApproveAllValid}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve All Valid
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-100 h-5 px-1.5 text-[10px] ml-1">
                      {stats.validated}
                    </Badge>
                  </Button>
                )}
                {stats.withIssues > 0 && (
                  <Button
                    onClick={handleRejectAllErrors}
                    variant="outline"
                    className="gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 h-9"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Errors
                    <Badge variant="secondary" className="bg-red-50 text-red-700 h-5 px-1.5 text-[10px] ml-1">
                      {stats.withIssues}
                    </Badge>
                  </Button>
                )}
                <Button
                  onClick={handleContinueToReconcile}
                  className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-sm h-9"
                >
                  Approve & Continue to Reconcile
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
