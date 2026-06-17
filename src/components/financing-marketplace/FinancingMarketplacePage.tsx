'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Banknote, CreditCard, Wallet, TrendingUp, IndianRupee,
  ShieldCheck, Clock, FileText, CheckCircle, AlertCircle, ArrowRight,
  ArrowUpRight, Users, Landmark, Briefcase, Gauge, Sparkles, Filter,
  Search, BarChart3, PieChart, Activity, Layers, Target, Zap,
  ChevronRight, ChevronDown, Star, Award, TrendingDown, BanknoteIcon,
  Coins, HandCoins, Building, LineChart as LineChartIcon, Calendar,
  Phone, Mail, Globe, MapPin, FileCheck, Upload, X, Plus, Minus,
  ArrowLeft, ArrowRightCircle, Stethoscope, Hash, Percent, CircleDollarSign,
  PencilLine, Receipt, PiggyBank,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

// ═══════════════════════════════════════════════════════════════════════════════
// INDIAN FORMATTING UTILS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatINRCr(amount: number): string {
  // amount in crores (e.g. 12.5 = ₹12.5 Cr)
  if (amount >= 100) {
    return '₹' + amount.toFixed(0) + ' Cr';
  }
  return '₹' + amount.toFixed(1) + ' Cr';
}

function formatLakh(amount: number): string {
  // amount in lakhs
  return '₹' + amount.toFixed(amount >= 10 ? 0 : 1) + ' L';
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-IN');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type LenderType = 'NBFC' | 'Bank' | 'Investor' | 'Fintech';
type ProductType = 'Invoice Financing' | 'Working Capital Loan' | 'Business Loan' | 'Credit Line';
type ApplicationStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Disbursed';

interface LenderOffer {
  id: string;
  lenderName: string;
  lenderType: LenderType;
  productType: ProductType;
  amountMin: number; // in lakhs
  amountMax: number; // in lakhs
  interestRate: number;
  tenureMonths: string;
  processingFeePct: number;
  minCreditScore: number;
  eligibilityTags: string[];
  disbursementDays: number;
  rating: number;
  logoColor: string;
  logoInitials: string;
}

interface LoanApplication {
  id: string;
  lenderName: string;
  productType: ProductType;
  amount: number; // in rupees
  appliedDate: string;
  status: ApplicationStatus;
  interestRate: number;
  sanctionedAmount: number; // 0 if not yet sanctioned
  emi: number; // monthly EMI in rupees
  timeline: {
    stage: string;
    status: 'completed' | 'current' | 'pending';
    timestamp: string;
    note: string;
  }[];
}

interface Lender {
  id: string;
  name: string;
  type: LenderType;
  products: ProductType[];
  totalDisbursedCr: number;
  interestRateMin: number;
  interestRateMax: number;
  minCreditScore: number;
  processingDays: number;
  rating: number;
  logoColor: string;
  logoInitials: string;
  headquarters: string;
  activeBorrowers: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — PRODUCT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCT_TYPES: {
  id: ProductType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  rateRange: string;
  tenure: string;
}[] = [
  {
    id: 'Invoice Financing',
    label: 'Invoice Financing',
    description: 'Finance invoices against debtor payment',
    icon: FileText,
    color: 'emerald',
    rateRange: '8.5% - 14%',
    tenure: '30 - 90 days',
  },
  {
    id: 'Working Capital Loan',
    label: 'Working Capital Loan',
    description: 'Short-term operational capital',
    icon: Wallet,
    color: 'teal',
    rateRange: '10% - 16%',
    tenure: '12 - 36 months',
  },
  {
    id: 'Business Loan',
    label: 'Business Loan',
    description: 'Term loans for growth and expansion',
    icon: Landmark,
    color: 'green',
    rateRange: '11% - 18%',
    tenure: '12 - 60 months',
  },
  {
    id: 'Credit Line',
    label: 'Credit Line',
    description: 'Revolving credit facility',
    icon: CreditCard,
    color: 'cyan',
    rateRange: '9.5% - 15%',
    tenure: 'Revolving',
  },
];

const HERO_STATS = [
  { label: 'Capital Deployed', value: 5000, suffix: ' Cr', icon: IndianRupee, prefix: '₹' },
  { label: 'Lenders Onboarded', value: 50, suffix: '+', icon: Landmark },
  { label: 'Loans Disbursed', value: 250000, suffix: '+', icon: Banknote },
  { label: 'Avg Interest Rate', value: 8.4, suffix: '%', icon: Percent, decimals: 1 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — LENDER OFFERS
// ═══════════════════════════════════════════════════════════════════════════════

const LENDER_OFFERS: LenderOffer[] = [
  {
    id: 'OFF-001', lenderName: 'Bajaj Finance', lenderType: 'NBFC', productType: 'Business Loan',
    amountMin: 5, amountMax: 500, interestRate: 12.5, tenureMonths: '12 - 60',
    processingFeePct: 2.5, minCreditScore: 700, disbursementDays: 3, rating: 4.6,
    logoColor: 'bg-emerald-600', logoInitials: 'BF',
    eligibilityTags: ['GST Registered', '2+ Years Business', '₹10L+ Turnover'],
  },
  {
    id: 'OFF-002', lenderName: 'HDFC Bank', lenderType: 'Bank', productType: 'Working Capital Loan',
    amountMin: 10, amountMax: 1000, interestRate: 10.2, tenureMonths: '12 - 36',
    processingFeePct: 1.5, minCreditScore: 720, disbursementDays: 5, rating: 4.8,
    logoColor: 'bg-teal-700', logoInitials: 'HD',
    eligibilityTags: ['GST Registered', '3+ Years Business', '₹50L+ Turnover'],
  },
  {
    id: 'OFF-003', lenderName: 'ICICI Bank', lenderType: 'Bank', productType: 'Credit Line',
    amountMin: 10, amountMax: 750, interestRate: 9.8, tenureMonths: 'Revolving',
    processingFeePct: 1.0, minCreditScore: 730, disbursementDays: 4, rating: 4.7,
    logoColor: 'bg-emerald-700', logoInitials: 'IC',
    eligibilityTags: ['GST Registered', 'Profitable', 'Banking Customer'],
  },
  {
    id: 'OFF-004', lenderName: 'Kotak Mahindra', lenderType: 'Bank', productType: 'Invoice Financing',
    amountMin: 5, amountMax: 250, interestRate: 11.5, tenureMonths: '30 - 90 days',
    processingFeePct: 0.75, minCreditScore: 680, disbursementDays: 2, rating: 4.5,
    logoColor: 'bg-green-700', logoInitials: 'KO',
    eligibilityTags: ['B2B Invoices', 'GST Registered', 'Debtor Rating A+'],
  },
  {
    id: 'OFF-005', lenderName: 'Axis Bank', lenderType: 'Bank', productType: 'Business Loan',
    amountMin: 5, amountMax: 400, interestRate: 11.9, tenureMonths: '12 - 60',
    processingFeePct: 1.75, minCreditScore: 700, disbursementDays: 4, rating: 4.4,
    logoColor: 'bg-teal-800', logoInitials: 'AX',
    eligibilityTags: ['GST Registered', '2+ Years Business', '₹25L+ Turnover'],
  },
  {
    id: 'OFF-006', lenderName: 'Tata Capital', lenderType: 'NBFC', productType: 'Working Capital Loan',
    amountMin: 5, amountMax: 600, interestRate: 12.8, tenureMonths: '12 - 48',
    processingFeePct: 2.0, minCreditScore: 690, disbursementDays: 3, rating: 4.5,
    logoColor: 'bg-emerald-800', logoInitials: 'TC',
    eligibilityTags: ['GST Registered', '2+ Years Business', '₹20L+ Turnover'],
  },
  {
    id: 'OFF-007', lenderName: 'Aditya Birla Finance', lenderType: 'NBFC', productType: 'Invoice Financing',
    amountMin: 5, amountMax: 200, interestRate: 13.2, tenureMonths: '30 - 90 days',
    processingFeePct: 0.85, minCreditScore: 675, disbursementDays: 2, rating: 4.3,
    logoColor: 'bg-green-800', logoInitials: 'AB',
    eligibilityTags: ['B2B Invoices', 'GST Registered', 'Blue-chip Debtors'],
  },
  {
    id: 'OFF-008', lenderName: 'L&T Finance', lenderType: 'NBFC', productType: 'Business Loan',
    amountMin: 5, amountMax: 350, interestRate: 13.5, tenureMonths: '12 - 60',
    processingFeePct: 2.25, minCreditScore: 685, disbursementDays: 3, rating: 4.2,
    logoColor: 'bg-teal-600', logoInitials: 'LT',
    eligibilityTags: ['GST Registered', '2+ Years Business', 'Manufacturing'],
  },
  {
    id: 'OFF-009', lenderName: 'Fullerton India', lenderType: 'NBFC', productType: 'Working Capital Loan',
    amountMin: 3, amountMax: 250, interestRate: 14.0, tenureMonths: '12 - 36',
    processingFeePct: 2.5, minCreditScore: 660, disbursementDays: 4, rating: 4.1,
    logoColor: 'bg-emerald-500', logoInitials: 'FI',
    eligibilityTags: ['GST Registered', '1+ Years Business', '₹10L+ Turnover'],
  },
  {
    id: 'OFF-010', lenderName: 'Cholamandalam', lenderType: 'NBFC', productType: 'Credit Line',
    amountMin: 5, amountMax: 300, interestRate: 13.8, tenureMonths: 'Revolving',
    processingFeePct: 1.5, minCreditScore: 680, disbursementDays: 5, rating: 4.0,
    logoColor: 'bg-green-600', logoInitials: 'CH',
    eligibilityTags: ['GST Registered', '2+ Years Business', '₹15L+ Turnover'],
  },
  {
    id: 'OFF-011', lenderName: 'U Gro Capital', lenderType: 'Fintech', productType: 'Invoice Financing',
    amountMin: 5, amountMax: 150, interestRate: 12.0, tenureMonths: '30 - 90 days',
    processingFeePct: 0.5, minCreditScore: 670, disbursementDays: 1, rating: 4.7,
    logoColor: 'bg-cyan-700', logoInitials: 'UG',
    eligibilityTags: ['B2B Invoices', 'GST Registered', 'e-Invoice Enabled'],
  },
  {
    id: 'OFF-012', lenderName: 'Vivriti Capital', lenderType: 'Fintech', productType: 'Business Loan',
    amountMin: 10, amountMax: 500, interestRate: 12.4, tenureMonths: '12 - 48',
    processingFeePct: 1.5, minCreditScore: 690, disbursementDays: 3, rating: 4.4,
    logoColor: 'bg-emerald-600', logoInitials: 'VI',
    eligibilityTags: ['GST Registered', '3+ Years Business', 'Mid-market'],
  },
  {
    id: 'OFF-013', lenderName: 'FlexiLoans', lenderType: 'Fintech', productType: 'Working Capital Loan',
    amountMin: 2, amountMax: 100, interestRate: 14.5, tenureMonths: '12 - 36',
    processingFeePct: 2.0, minCreditScore: 650, disbursementDays: 2, rating: 4.3,
    logoColor: 'bg-teal-600', logoInitials: 'FL',
    eligibilityTags: ['GST Registered', '1+ Years Business', 'Digital-first'],
  },
  {
    id: 'OFF-014', lenderName: 'Indifi Technologies', lenderType: 'Fintech', productType: 'Credit Line',
    amountMin: 5, amountMax: 200, interestRate: 13.5, tenureMonths: 'Revolving',
    processingFeePct: 1.75, minCreditScore: 670, disbursementDays: 3, rating: 4.2,
    logoColor: 'bg-green-700', logoInitials: 'IN',
    eligibilityTags: ['GST Registered', '2+ Years Business', 'Digital Statement'],
  },
  {
    id: 'OFF-015', lenderName: 'IDFC First Bank', lenderType: 'Bank', productType: 'Business Loan',
    amountMin: 5, amountMax: 450, interestRate: 11.5, tenureMonths: '12 - 60',
    processingFeePct: 1.5, minCreditScore: 710, disbursementDays: 4, rating: 4.5,
    logoColor: 'bg-emerald-700', logoInitials: 'IF',
    eligibilityTags: ['GST Registered', '2+ Years Business', '₹20L+ Turnover'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — MY APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const MY_APPLICATIONS: LoanApplication[] = [
  {
    id: 'APP-2025-0142', lenderName: 'HDFC Bank', productType: 'Working Capital Loan',
    amount: 5000000, appliedDate: '2025-03-12', status: 'Disbursed',
    interestRate: 10.2, sanctionedAmount: 5000000, emi: 168400,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-03-12 10:25', note: 'Application submitted via GSTPilot' },
      { stage: 'Document Verification', status: 'completed', timestamp: '2025-03-13 14:10', note: 'KYC + GST returns verified' },
      { stage: 'Underwriting', status: 'completed', timestamp: '2025-03-15 16:45', note: 'Risk assessment complete' },
      { stage: 'Approval', status: 'completed', timestamp: '2025-03-17 11:20', note: 'Sanctioned at 10.2% p.a.' },
      { stage: 'Disbursement', status: 'completed', timestamp: '2025-03-19 09:30', note: '₹50,00,000 credited to account' },
    ],
  },
  {
    id: 'APP-2025-0156', lenderName: 'Bajaj Finance', productType: 'Business Loan',
    amount: 2500000, appliedDate: '2025-03-20', status: 'Approved',
    interestRate: 12.5, sanctionedAmount: 2500000, emi: 83500,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-03-20 11:00', note: 'Application submitted' },
      { stage: 'Document Verification', status: 'completed', timestamp: '2025-03-21 15:30', note: 'All docs verified' },
      { stage: 'Underwriting', status: 'completed', timestamp: '2025-03-22 17:10', note: 'Risk score: 780' },
      { stage: 'Approval', status: 'current', timestamp: '2025-03-23 10:00', note: 'Offer letter generated' },
      { stage: 'Disbursement', status: 'pending', timestamp: '—', note: 'Awaiting acceptance' },
    ],
  },
  {
    id: 'APP-2025-0173', lenderName: 'Kotak Mahindra', productType: 'Invoice Financing',
    amount: 1800000, appliedDate: '2025-03-25', status: 'Under Review',
    interestRate: 11.5, sanctionedAmount: 0, emi: 0,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-03-25 09:15', note: 'Application + 3 invoices uploaded' },
      { stage: 'Document Verification', status: 'current', timestamp: '2025-03-26 11:00', note: 'Invoice authenticity check in progress' },
      { stage: 'Underwriting', status: 'pending', timestamp: '—', note: 'Queued' },
      { stage: 'Approval', status: 'pending', timestamp: '—', note: 'Pending' },
      { stage: 'Disbursement', status: 'pending', timestamp: '—', note: 'Pending' },
    ],
  },
  {
    id: 'APP-2025-0188', lenderName: 'ICICI Bank', productType: 'Credit Line',
    amount: 7500000, appliedDate: '2025-03-28', status: 'Pending',
    interestRate: 9.8, sanctionedAmount: 0, emi: 0,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-03-28 14:20', note: 'Application submitted' },
      { stage: 'Document Verification', status: 'pending', timestamp: '—', note: 'Awaiting bank statement upload' },
      { stage: 'Underwriting', status: 'pending', timestamp: '—', note: 'Pending' },
      { stage: 'Approval', status: 'pending', timestamp: '—', note: 'Pending' },
      { stage: 'Disbursement', status: 'pending', timestamp: '—', note: 'Pending' },
    ],
  },
  {
    id: 'APP-2025-0195', lenderName: 'Tata Capital', productType: 'Working Capital Loan',
    amount: 3500000, appliedDate: '2025-03-29', status: 'Under Review',
    interestRate: 12.8, sanctionedAmount: 0, emi: 0,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-03-29 10:30', note: 'Application submitted' },
      { stage: 'Document Verification', status: 'current', timestamp: '2025-03-30 09:00', note: 'ITR + GST returns review' },
      { stage: 'Underwriting', status: 'pending', timestamp: '—', note: 'Pending' },
      { stage: 'Approval', status: 'pending', timestamp: '—', note: 'Pending' },
      { stage: 'Disbursement', status: 'pending', timestamp: '—', note: 'Pending' },
    ],
  },
  {
    id: 'APP-2025-0201', lenderName: 'Axis Bank', productType: 'Business Loan',
    amount: 4000000, appliedDate: '2025-03-30', status: 'Rejected',
    interestRate: 11.9, sanctionedAmount: 0, emi: 0,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-03-30 11:00', note: 'Application submitted' },
      { stage: 'Document Verification', status: 'completed', timestamp: '2025-03-31 13:45', note: 'Docs verified' },
      { stage: 'Underwriting', status: 'completed', timestamp: '2025-04-01 15:30', note: 'Risk score below threshold' },
      { stage: 'Approval', status: 'completed', timestamp: '2025-04-01 17:00', note: 'Rejected — DSCR < 1.2' },
      { stage: 'Disbursement', status: 'pending', timestamp: '—', note: 'N/A' },
    ],
  },
  {
    id: 'APP-2025-0210', lenderName: 'U Gro Capital', productType: 'Invoice Financing',
    amount: 950000, appliedDate: '2025-04-02', status: 'Disbursed',
    interestRate: 12.0, sanctionedAmount: 950000, emi: 0,
    timeline: [
      { stage: 'Submitted', status: 'completed', timestamp: '2025-04-02 09:00', note: 'Application submitted' },
      { stage: 'Document Verification', status: 'completed', timestamp: '2025-04-02 11:30', note: 'e-Invoice API verified' },
      { stage: 'Underwriting', status: 'completed', timestamp: '2025-04-02 14:00', note: 'Automated underwriting' },
      { stage: 'Approval', status: 'completed', timestamp: '2025-04-02 15:00', note: 'Approved at 12% p.a.' },
      { stage: 'Disbursement', status: 'completed', timestamp: '2025-04-02 16:45', note: '₹9,50,000 disbursed' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — LENDER DIRECTORY
// ═══════════════════════════════════════════════════════════════════════════════

const LENDERS: Lender[] = [
  { id: 'L1', name: 'Bajaj Finance', type: 'NBFC', products: ['Business Loan', 'Working Capital Loan', 'Credit Line'],
    totalDisbursedCr: 12500, interestRateMin: 11, interestRateMax: 18, minCreditScore: 680, processingDays: 3,
    rating: 4.6, logoColor: 'bg-emerald-600', logoInitials: 'BF', headquarters: 'Pune', activeBorrowers: 580000 },
  { id: 'L2', name: 'HDFC Bank', type: 'Bank', products: ['Working Capital Loan', 'Business Loan', 'Credit Line', 'Invoice Financing'],
    totalDisbursedCr: 28400, interestRateMin: 9.5, interestRateMax: 16, minCreditScore: 720, processingDays: 5,
    rating: 4.8, logoColor: 'bg-teal-700', logoInitials: 'HD', headquarters: 'Mumbai', activeBorrowers: 980000 },
  { id: 'L3', name: 'ICICI Bank', type: 'Bank', products: ['Credit Line', 'Working Capital Loan', 'Business Loan'],
    totalDisbursedCr: 24800, interestRateMin: 9.8, interestRateMax: 15.5, minCreditScore: 730, processingDays: 4,
    rating: 4.7, logoColor: 'bg-emerald-700', logoInitials: 'IC', headquarters: 'Mumbai', activeBorrowers: 920000 },
  { id: 'L4', name: 'Kotak Mahindra', type: 'Bank', products: ['Invoice Financing', 'Business Loan', 'Credit Line'],
    totalDisbursedCr: 18200, interestRateMin: 10.5, interestRateMax: 16, minCreditScore: 700, processingDays: 4,
    rating: 4.5, logoColor: 'bg-green-700', logoInitials: 'KO', headquarters: 'Mumbai', activeBorrowers: 640000 },
  { id: 'L5', name: 'Axis Bank', type: 'Bank', products: ['Business Loan', 'Working Capital Loan', 'Credit Line'],
    totalDisbursedCr: 16800, interestRateMin: 10, interestRateMax: 16.5, minCreditScore: 700, processingDays: 4,
    rating: 4.4, logoColor: 'bg-teal-800', logoInitials: 'AX', headquarters: 'Mumbai', activeBorrowers: 690000 },
  { id: 'L6', name: 'Tata Capital', type: 'NBFC', products: ['Business Loan', 'Working Capital Loan', 'Credit Line'],
    totalDisbursedCr: 14200, interestRateMin: 11, interestRateMax: 17, minCreditScore: 690, processingDays: 3,
    rating: 4.5, logoColor: 'bg-emerald-800', logoInitials: 'TC', headquarters: 'Mumbai', activeBorrowers: 480000 },
  { id: 'L7', name: 'Aditya Birla Finance', type: 'NBFC', products: ['Invoice Financing', 'Business Loan'],
    totalDisbursedCr: 9800, interestRateMin: 11.5, interestRateMax: 17, minCreditScore: 675, processingDays: 2,
    rating: 4.3, logoColor: 'bg-green-800', logoInitials: 'AB', headquarters: 'Mumbai', activeBorrowers: 320000 },
  { id: 'L8', name: 'L&T Finance', type: 'NBFC', products: ['Business Loan', 'Working Capital Loan'],
    totalDisbursedCr: 8600, interestRateMin: 12, interestRateMax: 18, minCreditScore: 685, processingDays: 3,
    rating: 4.2, logoColor: 'bg-teal-600', logoInitials: 'LT', headquarters: 'Mumbai', activeBorrowers: 280000 },
  { id: 'L9', name: 'Fullerton India', type: 'NBFC', products: ['Working Capital Loan', 'Business Loan'],
    totalDisbursedCr: 7400, interestRateMin: 12, interestRateMax: 18, minCreditScore: 660, processingDays: 4,
    rating: 4.1, logoColor: 'bg-emerald-500', logoInitials: 'FI', headquarters: 'Mumbai', activeBorrowers: 240000 },
  { id: 'L10', name: 'Cholamandalam', type: 'NBFC', products: ['Credit Line', 'Working Capital Loan'],
    totalDisbursedCr: 6200, interestRateMin: 12, interestRateMax: 17, minCreditScore: 680, processingDays: 5,
    rating: 4.0, logoColor: 'bg-green-600', logoInitials: 'CH', headquarters: 'Chennai', activeBorrowers: 210000 },
  { id: 'L11', name: 'U Gro Capital', type: 'Fintech', products: ['Invoice Financing', 'Working Capital Loan'],
    totalDisbursedCr: 3200, interestRateMin: 11, interestRateMax: 16, minCreditScore: 670, processingDays: 1,
    rating: 4.7, logoColor: 'bg-cyan-700', logoInitials: 'UG', headquarters: 'Mumbai', activeBorrowers: 95000 },
  { id: 'L12', name: 'Vivriti Capital', type: 'Fintech', products: ['Business Loan', 'Working Capital Loan'],
    totalDisbursedCr: 4800, interestRateMin: 11.5, interestRateMax: 16, minCreditScore: 690, processingDays: 3,
    rating: 4.4, logoColor: 'bg-emerald-600', logoInitials: 'VI', headquarters: 'Chennai', activeBorrowers: 110000 },
  { id: 'L13', name: 'FlexiLoans', type: 'Fintech', products: ['Working Capital Loan'],
    totalDisbursedCr: 1800, interestRateMin: 13, interestRateMax: 18, minCreditScore: 650, processingDays: 2,
    rating: 4.3, logoColor: 'bg-teal-600', logoInitials: 'FL', headquarters: 'Mumbai', activeBorrowers: 75000 },
  { id: 'L14', name: 'Indifi Technologies', type: 'Fintech', products: ['Credit Line', 'Business Loan'],
    totalDisbursedCr: 2400, interestRateMin: 12, interestRateMax: 17, minCreditScore: 670, processingDays: 3,
    rating: 4.2, logoColor: 'bg-green-700', logoInitials: 'IN', headquarters: 'Gurgaon', activeBorrowers: 82000 },
  { id: 'L15', name: 'IDFC First Bank', type: 'Bank', products: ['Business Loan', 'Working Capital Loan', 'Credit Line'],
    totalDisbursedCr: 11200, interestRateMin: 10.5, interestRateMax: 16, minCreditScore: 710, processingDays: 4,
    rating: 4.5, logoColor: 'bg-emerald-700', logoInitials: 'IF', headquarters: 'Mumbai', activeBorrowers: 410000 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

const LOAN_VOLUME_BY_PRODUCT = [
  { product: 'Invoice Financing', value: 980, color: '#10b981' },
  { product: 'Working Capital', value: 1820, color: '#0d9488' },
  { product: 'Business Loan', value: 1450, color: '#059669' },
  { product: 'Credit Line', value: 750, color: '#0891b2' },
];

const MONTHLY_DISBURSEMENT = [
  { month: 'Apr', value: 280 }, { month: 'May', value: 320 }, { month: 'Jun', value: 295 },
  { month: 'Jul', value: 360 }, { month: 'Aug', value: 410 }, { month: 'Sep', value: 385 },
  { month: 'Oct', value: 450 }, { month: 'Nov', value: 480 }, { month: 'Dec', value: 520 },
  { month: 'Jan', value: 510 }, { month: 'Feb', value: 540 }, { month: 'Mar', value: 580 },
];

const LENDER_MARKET_SHARE = [
  { label: 'NBFC', value: 42, color: '#10b981' },
  { label: 'Bank', value: 38, color: '#0d9488' },
  { label: 'Fintech', value: 15, color: '#0891b2' },
  { label: 'Investor', value: 5, color: '#059669' },
];

const INDUSTRIES = ['Manufacturing', 'Textiles', 'Engineering', 'Pharma', 'Electronics',
  'Auto Components', 'Food & Bev', 'Chemicals', 'Construction', 'Retail'];

const INDUSTRY_HEATMAP: { industry: string; product: ProductType; value: number }[] = [];
(function genHeatmap() {
  const products: ProductType[] = ['Invoice Financing', 'Working Capital Loan', 'Business Loan', 'Credit Line'];
  INDUSTRIES.forEach((ind) => {
    products.forEach((prod) => {
      // deterministic pseudo-random based on hash
      const seed = (ind.length * 7 + prod.length * 13) % 100;
      const base = 30 + (seed % 60);
      INDUSTRY_HEATMAP.push({ industry: ind, product: prod, value: base });
    });
  });
})();

const INTEREST_RATE_TREND = [
  { month: 'Apr', rate: 9.2 }, { month: 'May', rate: 9.3 }, { month: 'Jun', rate: 9.4 },
  { month: 'Jul', rate: 9.5 }, { month: 'Aug', rate: 9.5 }, { month: 'Sep', rate: 9.4 },
  { month: 'Oct', rate: 9.3 }, { month: 'Nov', rate: 9.2 }, { month: 'Dec', rate: 9.1 },
  { month: 'Jan', rate: 9.0 }, { month: 'Feb', rate: 8.9 }, { month: 'Mar', rate: 8.8 },
];

const APPROVAL_BY_SCORE: { bucket: string; applicants: number; approved: number; rate: number }[] = [
  { bucket: 'Below 600', applicants: 4200, approved: 380, rate: 9 },
  { bucket: '600 - 650', applicants: 8600, approved: 2580, rate: 30 },
  { bucket: '650 - 700', applicants: 12400, approved: 6200, rate: 50 },
  { bucket: '700 - 750', applicants: 15800, approved: 12640, rate: 80 },
  { bucket: '750 - 800', applicants: 9200, approved: 8590, rate: 93 },
  { bucket: 'Above 800', applicants: 3400, approved: 3366, rate: 99 },
];

const CAPITAL_GAP = {
  demandCr: 18500,
  supplyCr: 14800,
  fundedCr: 5000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useAnimatedCounter(target: number, duration: number = 1800, decimals: number = 0) {
  const [count, setCount] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = target * eased;
      setCount(decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.floor(val));
      if (progress < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [target, duration, decimals]);

  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER — Lender Type Badge
// ═══════════════════════════════════════════════════════════════════════════════

function LenderTypeBadge({ type }: { type: LenderType }) {
  const map: Record<LenderType, { color: string; label: string }> = {
    NBFC: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'NBFC' },
    Bank: { color: 'bg-teal-100 text-teal-700 border-teal-200', label: 'Bank' },
    Investor: { color: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'Investor' },
    Fintech: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Fintech' },
  };
  const s = map[type];
  return <Badge variant="outline" className={`${s.color} text-[10px] font-semibold`}>{s.label}</Badge>;
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const map: Record<ApplicationStatus, string> = {
    'Pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'Under Review': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Approved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Rejected': 'bg-red-100 text-red-700 border-red-200',
    'Disbursed': 'bg-teal-100 text-teal-700 border-teal-200',
  };
  return <Badge variant="outline" className={`${map[status]} text-[11px] font-semibold`}>{status}</Badge>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG BAR CHART — Loan Volume by Product
// ═══════════════════════════════════════════════════════════════════════════════

function VolumeBarChart() {
  const data = LOAN_VOLUME_BY_PRODUCT;
  const width = 480;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.value));
  const barWidth = chartW / data.length * 0.6;
  const gap = chartW / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padding.left} y1={padding.top + chartH * (1 - f)}
          x2={width - padding.right} y2={padding.top + chartH * (1 - f)}
          stroke="#e2e8f0" strokeDasharray="3 3" />
      ))}
      {/* Y labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = Math.round(maxVal * f);
        return (
          <text key={f} x={padding.left - 8} y={padding.top + chartH * (1 - f) + 4}
            textAnchor="end" className="fill-slate-400" fontSize="10">
            ₹{v}Cr
          </text>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * chartH;
        const x = padding.left + i * gap + (gap - barWidth) / 2;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <motion.rect
              x={x} y={y} width={barWidth} height={barH}
              rx={6} fill="url(#barGrad)"
              initial={{ height: 0, y: padding.top + chartH }}
              animate={{ height: barH, y }}
              transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
            />
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle"
              className="fill-emerald-700" fontSize="11" fontWeight="600">
              ₹{d.value}Cr
            </text>
            {/* X label */}
            <text x={x + barWidth / 2} y={height - 25} textAnchor="middle"
              className="fill-slate-600" fontSize="9.5" fontWeight="500">
              {d.product.split(' ').map((w, idx) => (
                <tspan key={idx} x={x + barWidth / 2} dy={idx === 0 ? 0 : 11}>{w}</tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG LINE CHART — Monthly Disbursement Trend
// ═══════════════════════════════════════════════════════════════════════════════

function MonthlyLineChart({ data, color = '#10b981', ySuffix = 'Cr', yPrefix = '₹' }: {
  data: { month: string; value: number }[];
  color?: string; ySuffix?: string; yPrefix?: string;
}) {
  const width = 720;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.value)) * 1.1;
  const minVal = 0;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((d.value - minVal) / (maxVal - minVal)) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id={`area-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padding.left} y1={padding.top + chartH * (1 - f)}
          x2={width - padding.right} y2={padding.top + chartH * (1 - f)}
          stroke="#e2e8f0" strokeDasharray="3 3" />
      ))}
      {/* Y labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = Math.round(maxVal * f);
        return (
          <text key={f} x={padding.left - 8} y={padding.top + chartH * (1 - f) + 4}
            textAnchor="end" className="fill-slate-400" fontSize="10">
            {yPrefix}{v}{ySuffix}
          </text>
        );
      })}
      {/* Area */}
      <motion.path
        d={areaPath}
        fill={`url(#area-${color.replace('#', '')})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <motion.circle
            cx={p.x} cy={p.y} r="3.5"
            fill="white" stroke={color} strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05 }}
          />
          <text x={p.x} y={height - 12} textAnchor="middle"
            className="fill-slate-500" fontSize="10">{p.month}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DONUT CHART — Lender Market Share
// ═══════════════════════════════════════════════════════════════════════════════

function DonutChart({ data, size = 200 }: {
  data: { label: string; value: number; color: string }[]; size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 20;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  const segments = data.map((d, i) => {
    const fraction = d.value / total;
    const priorFraction = data.slice(0, i).reduce((s, x) => s + x.value / total, 0);
    const dashLength = fraction * circumference;
    return {
      ...d,
      dashLength,
      dashOffset: -priorFraction * circumference,
      pct: Math.round(fraction * 100),
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width={size} height={size} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((s, i) => (
          <motion.circle
            key={i}
            cx={cx} cy={cy} r={radius} fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${s.dashLength} ${circumference - s.dashLength}`}
            strokeDashoffset={s.dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-900"
          fontSize="20" fontWeight="700">{total}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" fontSize="10">Market</text>
      </svg>
      <div className="flex flex-col gap-2 w-full">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span className="text-slate-700 font-medium">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-900 font-semibold">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG HEATMAP — Industry × Product
// ═══════════════════════════════════════════════════════════════════════════════

function IndustryHeatmap() {
  const products: ProductType[] = ['Invoice Financing', 'Working Capital Loan', 'Business Loan', 'Credit Line'];
  const industries = INDUSTRIES;
  const cellW = 90;
  const cellH = 38;
  const labelW = 140;
  const headerH = 60;
  const width = labelW + products.length * cellW + 20;
  const height = headerH + industries.length * cellH + 20;

  const getCellColor = (val: number) => {
    // value 0-100 → emerald intensity
    if (val >= 80) return '#065f46';
    if (val >= 65) return '#047857';
    if (val >= 50) return '#059669';
    if (val >= 35) return '#10b981';
    if (val >= 20) return '#6ee7b7';
    return '#d1fae5';
  };
  const getTextColor = (val: number) => (val >= 50 ? '#ffffff' : '#065f46');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Column headers */}
      {products.map((p, i) => {
        const x = labelW + i * cellW + cellW / 2;
        const words = p.split(' ');
        return (
          <g key={i}>
            {words.map((w, idx) => (
              <text key={idx} x={x} y={18 + idx * 11} textAnchor="middle"
                className="fill-slate-700" fontSize="10" fontWeight="600">{w}</text>
            ))}
          </g>
        );
      })}
      {/* Row labels + cells */}
      {industries.map((ind, r) => {
        const y = headerH + r * cellH;
        return (
          <g key={r}>
            <text x={labelW - 8} y={y + cellH / 2 + 4} textAnchor="end"
              className="fill-slate-700" fontSize="10" fontWeight="500">{ind}</text>
            {products.map((prod, c) => {
              const cell = INDUSTRY_HEATMAP.find(h => h.industry === ind && h.product === prod);
              const val = cell?.value || 0;
              const x = labelW + c * cellW;
              return (
                <g key={c}>
                  <rect x={x + 2} y={y + 2} width={cellW - 4} height={cellH - 4}
                    rx={4} fill={getCellColor(val)} />
                  <text x={x + cellW / 2} y={y + cellH / 2 + 4} textAnchor="middle"
                    fontSize="10" fontWeight="600" fill={getTextColor(val)}>{val}%</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG LINE CHART — Interest Rate Trend
// ═══════════════════════════════════════════════════════════════════════════════

function InterestRateTrendChart() {
  const data = INTEREST_RATE_TREND;
  const width = 720;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.rate));
  const minVal = Math.min(...data.map(d => d.rate));
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((d.rate - minVal) / range) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="rateArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0891b2" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padding.left} y1={padding.top + chartH * (1 - f)}
          x2={width - padding.right} y2={padding.top + chartH * (1 - f)}
          stroke="#e2e8f0" strokeDasharray="3 3" />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = (minVal + range * f).toFixed(1);
        return (
          <text key={f} x={padding.left - 8} y={padding.top + chartH * (1 - f) + 4}
            textAnchor="end" className="fill-slate-400" fontSize="10">{v}%</text>
        );
      })}
      <motion.path d={areaPath} fill="url(#rateArea)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      <motion.path d={linePath} fill="none" stroke="#0891b2" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: 'easeInOut' }} />
      {points.map((p, i) => (
        <g key={i}>
          <motion.circle cx={p.x} cy={p.y} r="3" fill="white" stroke="#0891b2" strokeWidth="2"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.05 }} />
          <text x={p.x} y={height - 12} textAnchor="middle"
            className="fill-slate-500" fontSize="10">{p.month}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CAPITAL GAP VISUAL
// ═══════════════════════════════════════════════════════════════════════════════

function CapitalGapVisual() {
  const { demandCr, supplyCr, fundedCr } = CAPITAL_GAP;
  const maxBar = demandCr;
  const demandPct = (demandCr / maxBar) * 100;
  const supplyPct = (supplyCr / maxBar) * 100;
  const fundedPct = (fundedCr / maxBar) * 100;
  const gapPct = demandPct - supplyPct;
  const gap = demandCr - supplyCr;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Demand</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{formatINRCr(demandCr)}</p>
          <p className="text-xs text-emerald-700 mt-0.5">Capital requested by businesses</p>
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-center gap-2 text-teal-700">
            <HandCoins className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Supply</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-teal-900">{formatINRCr(supplyCr)}</p>
          <p className="text-xs text-teal-700 mt-0.5">Capital committed by lenders</p>
        </div>
      </div>
      {/* Visual bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Funded: <span className="font-semibold text-emerald-700">{formatINRCr(fundedCr)}</span></span>
          <span className="text-slate-500">Gap: <span className="font-semibold text-amber-700">{formatINRCr(gap)}</span></span>
        </div>
        <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100 relative">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
            initial={{ width: 0 }}
            animate={{ width: `${fundedPct}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-teal-400 to-teal-500 absolute top-0"
            style={{ left: 0 }}
            initial={{ width: 0 }}
            animate={{ width: `${supplyPct}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          <motion.div
            className="h-full bg-amber-300/60 absolute top-0"
            initial={{ width: 0 }}
            animate={{ width: `${gapPct}%`, x: `${supplyPct}%` }}
            transition={{ duration: 1, delay: 0.7 }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>0</span>
          <span>{formatINRCr(demandCr)} Total Demand</span>
        </div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Funding Gap: {formatINRCr(gap)}</p>
          <p className="text-xs text-amber-700">{Math.round((gap / demandCr) * 100)}% of demand is unmet — onboarding more lenders can close this gap</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO STAT CARD (animated counter — top-level component)
// ═══════════════════════════════════════════════════════════════════════════════

function HeroStatCard({ stat, index }: {
  stat: typeof HERO_STATS[number]; index: number;
}) {
  const Icon = stat.icon;
  const animatedValue = useAnimatedCounter(stat.value, 1800, stat.decimals || 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08 }}
      className="rounded-xl bg-white/80 backdrop-blur border border-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 text-emerald-600">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{stat.label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-slate-900">
        {stat.prefix || ''}{formatNumber(animatedValue)}{stat.suffix}
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT TYPE CARD (Tab 1 hero filter)
// ═══════════════════════════════════════════════════════════════════════════════

function ProductTypeCard({ pt, active, onClick }: {
  pt: typeof PRODUCT_TYPES[number]; active: boolean; onClick: () => void;
}) {
  const Icon = pt.icon;
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all ${
        active
          ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100'
          : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-emerald-600 text-white`}>
          <Icon className="h-5 w-5" />
        </div>
        {active && (
          <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
        )}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{pt.label}</h3>
      <p className="text-xs text-slate-500 mt-1">{pt.description}</p>
      <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <Percent className="h-3 w-3 text-emerald-600" />
          <span>{pt.rateRange}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-emerald-600" />
          <span>{pt.tenure}</span>
        </div>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCING OFFER CARD
// ═══════════════════════════════════════════════════════════════════════════════

function FinancingOfferCard({ offer, onApply, index }: {
  offer: LenderOffer; onApply: (o: LenderOffer) => void; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -4 }}
    >
      <Card className="h-full overflow-hidden border-slate-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-50 transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${offer.logoColor}`}>
                {offer.logoInitials}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">{offer.lenderName}</CardTitle>
                <div className="mt-1 flex items-center gap-1.5">
                  <LenderTypeBadge type={offer.lenderType} />
                  <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600">
                    {offer.productType}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-3.5 w-3.5 fill-amber-400" />
              <span className="text-xs font-semibold text-slate-700">{offer.rating}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Amount Range</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatLakh(offer.amountMin)} - {formatLakh(offer.amountMax)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Interest Rate</p>
              <p className="text-sm font-semibold text-emerald-700">{offer.interestRate}% p.a.</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Tenure</p>
              <p className="text-sm font-semibold text-slate-900">{offer.tenureMonths}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Processing Fee</p>
              <p className="text-sm font-semibold text-slate-900">{offer.processingFeePct}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Min Credit Score</p>
              <p className="text-sm font-semibold text-slate-900">{offer.minCreditScore}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Disbursal</p>
              <p className="text-sm font-semibold text-slate-900">{offer.disbursementDays} days</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Eligibility</p>
            <div className="flex flex-wrap gap-1.5">
              {offer.eligibilityTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button
            onClick={() => onApply(offer)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Apply Now <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATION FORM DIALOG (multi-step)
// ═══════════════════════════════════════════════════════════════════════════════

function ApplicationFormDialog({ offer, open, onOpenChange }: {
  offer: LenderOffer | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setSubmitted(false);
    }
  }, [open, offer]);

  if (!offer) return null;

  const steps = ['Business Details', 'Loan Requirements', 'Document Checklist', 'Submit'];
  const documents = [
    'GST Registration Certificate',
    'PAN Card (Business)',
    'Last 2 years ITR',
    'Last 6 months Bank Statement',
    'GSTR-1 & GSTR-3B (last 6 months)',
    'KYC of Directors / Proprietor',
    'Business Address Proof',
    'Latest CIBIL Report',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            Apply for {offer.productType}
          </DialogTitle>
          <DialogDescription>
            Lender: <span className="font-semibold text-slate-700">{offer.lenderName}</span> ·
            Rate: <span className="font-semibold text-emerald-700">{offer.interestRate}% p.a.</span>
          </DialogDescription>
        </DialogHeader>

        {!submitted ? (
          <>
            {/* Stepper */}
            <div className="flex items-center gap-2 py-2">
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                      i < step ? 'bg-emerald-600 text-white border-emerald-600' :
                      i === step ? 'bg-emerald-50 text-emerald-700 border-emerald-600' :
                      'bg-white text-slate-400 border-slate-200'
                    }`}>
                      {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-[10px] text-center ${i === step ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      {s}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 ${i < step ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <Separator />

            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-2 gap-3 py-2"
                >
                  <div className="col-span-2">
                    <Label className="text-xs">Business Legal Name</Label>
                    <Input className="mt-1" placeholder="e.g. Sharma Textiles Pvt Ltd" />
                  </div>
                  <div>
                    <Label className="text-xs">GSTIN</Label>
                    <Input className="mt-1" placeholder="27ABCDE1234F1Z5" />
                  </div>
                  <div>
                    <Label className="text-xs">PAN</Label>
                    <Input className="mt-1" placeholder="ABCDE1234F" />
                  </div>
                  <div>
                    <Label className="text-xs">Business Type</Label>
                    <Select defaultValue="pvt">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prop">Proprietorship</SelectItem>
                        <SelectItem value="pvt">Private Limited</SelectItem>
                        <SelectItem value="llp">LLP</SelectItem>
                        <SelectItem value="pub">Public Limited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Years in Business</Label>
                    <Input className="mt-1" type="number" placeholder="3" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Annual Turnover (₹)</Label>
                    <Input className="mt-1" type="number" placeholder="5000000" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Industry</Label>
                    <Select defaultValue="mfg">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mfg">Manufacturing</SelectItem>
                        <SelectItem value="tex">Textiles</SelectItem>
                        <SelectItem value="eng">Engineering</SelectItem>
                        <SelectItem value="pha">Pharmaceuticals</SelectItem>
                        <SelectItem value="ele">Electronics</SelectItem>
                        <SelectItem value="ret">Retail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-2 gap-3 py-2"
                >
                  <div className="col-span-2">
                    <Label className="text-xs">Loan Amount Required (₹)</Label>
                    <Input className="mt-1" type="number" placeholder="1000000" defaultValue={offer.amountMin * 100000} />
                  </div>
                  <div>
                    <Label className="text-xs">Preferred Tenure (months)</Label>
                    <Input className="mt-1" type="number" placeholder="24" />
                  </div>
                  <div>
                    <Label className="text-xs">Purpose of Loan</Label>
                    <Select defaultValue="wc">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wc">Working Capital</SelectItem>
                        <SelectItem value="exp">Business Expansion</SelectItem>
                        <SelectItem value="inv">Inventory Purchase</SelectItem>
                        <SelectItem value="cap">Capital Expenditure</SelectItem>
                        <SelectItem value="ref">Debt Refinance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Existing EMI Commitments (₹/month)</Label>
                    <Input className="mt-1" type="number" placeholder="50000" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Additional Notes</Label>
                    <Textarea className="mt-1" placeholder="Briefly describe your requirement..." rows={3} />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="py-2"
                >
                  <p className="text-xs text-slate-500 mb-3">
                    Upload the following documents to expedite your application. Drag-drop or browse to attach.
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {documents.map((doc, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center gap-2">
                          <Checkbox id={`doc-${i}`} defaultChecked={i < 3} />
                          <Label htmlFor={`doc-${i}`} className="text-xs text-slate-700 cursor-pointer">{doc}</Label>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] text-emerald-700">
                          <Upload className="h-3 w-3 mr-1" /> Upload
                        </Button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="py-2 space-y-3"
                >
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Review & Submit</span>
                    </div>
                    <p className="text-xs text-emerald-700">
                      Please review your application summary below. By submitting, you authorize {offer.lenderName} to fetch your credit report and verify the provided details.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Lender</span><span className="font-semibold">{offer.lenderName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Product</span><span className="font-semibold">{offer.productType}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Interest Rate</span><span className="font-semibold text-emerald-700">{offer.interestRate}% p.a.</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Processing Fee</span><span className="font-semibold">{offer.processingFeePct}%</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Expected Disbursal</span><span className="font-semibold">{offer.disbursementDays} days</span></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="consent" defaultChecked />
                    <Label htmlFor="consent" className="text-[11px] text-slate-600 leading-tight">
                      I consent to sharing my GST data, bank statements, and credit report with {offer.lenderName} for the purpose of evaluating this loan application.
                    </Label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <DialogFooter className="flex-row justify-between items-center gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                    <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back
                  </Button>
                )}
                {step < 3 && (
                  <Button onClick={() => setStep(s => s + 1)} className="bg-emerald-600 hover:bg-emerald-700">
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {step === 3 && (
                  <Button onClick={() => setSubmitted(true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="h-4 w-4 mr-1" /> Submit Application
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-10 text-center space-y-3"
          >
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Application Submitted!</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Your application has been received by <span className="font-semibold text-slate-700">{offer.lenderName}</span>.
              You can track the status under the My Applications tab. Expected disbursal in {offer.disbursementDays} days.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 inline-block">
              <p className="text-xs text-slate-500">Application Reference</p>
              <p className="text-sm font-mono font-semibold text-emerald-700">
                APP-2025-{String(Math.floor(Math.random() * 9000) + 1000)}
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={() => onOpenChange(false)} className="bg-emerald-600 hover:bg-emerald-700">
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATION TIMELINE DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function ApplicationTimelineDialog({ app, open, onOpenChange }: {
  app: LoanApplication | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  if (!app) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            Application Timeline · {app.id}
          </DialogTitle>
          <DialogDescription>
            {app.lenderName} · {app.productType} · {formatINR(app.amount)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {app.timeline.map((t, i) => {
            const isCompleted = t.status === 'completed';
            const isCurrent = t.status === 'current';
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-emerald-600' : isCurrent ? 'bg-amber-500' : 'bg-slate-200'
                  }`}>
                    {isCompleted ? <CheckCircle className="h-4 w-4 text-white" /> :
                      isCurrent ? <Activity className="h-4 w-4 text-white" /> :
                      <Clock className="h-4 w-4 text-slate-400" />}
                  </div>
                  {i < app.timeline.length - 1 && (
                    <div className={`w-0.5 flex-1 ${isCompleted ? 'bg-emerald-600' : 'bg-slate-200'}`} style={{ minHeight: 32 }} />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${
                      isCompleted ? 'text-slate-900' : isCurrent ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {t.stage}
                      {isCurrent && <Badge className="ml-2 bg-amber-100 text-amber-700 text-[10px]">In Progress</Badge>}
                    </p>
                    <span className="text-[11px] text-slate-500">{t.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{t.note}</p>
                </div>
              </div>
            );
          })}
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Status</p>
            <div className="mt-1 flex justify-center"><StatusBadge status={app.status} /></div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Interest Rate</p>
            <p className="text-sm font-semibold text-emerald-700">{app.interestRate}% p.a.</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Sanctioned</p>
            <p className="text-sm font-semibold text-slate-900">
              {app.sanctionedAmount > 0 ? formatINR(app.sanctionedAmount) : '—'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LENDER DIRECTORY CARD
// ═══════════════════════════════════════════════════════════════════════════════

function LenderDirectoryCard({ lender, onView, selected, onToggleSelect, index }: {
  lender: Lender; onView: (l: Lender) => void;
  selected: boolean; onToggleSelect: () => void; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -3 }}
    >
      <Card className={`h-full overflow-hidden border ${selected ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'} transition-all`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white text-sm font-bold ${lender.logoColor}`}>
                {lender.logoInitials}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">{lender.name}</CardTitle>
                <div className="mt-1 flex items-center gap-1.5">
                  <LenderTypeBadge type={lender.type} />
                  <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" /> {lender.headquarters}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-3.5 w-3.5 fill-amber-400" />
              <span className="text-xs font-semibold text-slate-700">{lender.rating}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Total Disbursed</p>
              <p className="text-sm font-semibold text-slate-900">{formatINRCr(lender.totalDisbursedCr)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Interest Rate</p>
              <p className="text-sm font-semibold text-emerald-700">
                {lender.interestRateMin}% - {lender.interestRateMax}%
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Min Credit Score</p>
              <p className="text-sm font-semibold text-slate-900">{lender.minCreditScore}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Processing Time</p>
              <p className="text-sm font-semibold text-slate-900">{lender.processingDays} days</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Products Offered</p>
            <div className="flex flex-wrap gap-1.5">
              {lender.products.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {formatNumber(lender.activeBorrowers)} borrowers
            </span>
          </div>
        </CardContent>
        <CardFooter className="gap-2 pt-0">
          <Button
            variant={selected ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleSelect}
            className={selected ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}
          >
            {selected ? <><CheckCircle className="h-4 w-4 mr-1" /> Selected</> : 'Compare'}
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onView(lender)}>
            View Profile <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LENDER PROFILE DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

function LenderProfileDialog({ lender, open, onOpenChange }: {
  lender: Lender | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  if (!lender) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold ${lender.logoColor}`}>
              {lender.logoInitials}
            </div>
            <div>
              <span>{lender.name}</span>
              <div className="mt-1 flex items-center gap-2">
                <LenderTypeBadge type={lender.type} />
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lender.headquarters}
                </span>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>Lender profile & key metrics</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Total Disbursed</p>
            <p className="text-base font-bold text-emerald-700">{formatINRCr(lender.totalDisbursedCr)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Interest Range</p>
            <p className="text-base font-bold text-slate-900">{lender.interestRateMin}-{lender.interestRateMax}%</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Min CIBIL</p>
            <p className="text-base font-bold text-slate-900">{lender.minCreditScore}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Processing</p>
            <p className="text-base font-bold text-slate-900">{lender.processingDays} days</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Active Borrowers</p>
            <p className="text-base font-bold text-slate-900">{formatNumber(lender.activeBorrowers)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Rating</p>
            <p className="text-base font-bold text-amber-600 flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400" /> {lender.rating}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Products Offered</p>
          <div className="flex flex-wrap gap-1.5">
            {lender.products.map((p) => (
              <Badge key={p} variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-100">
                {p}
              </Badge>
            ))}
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-emerald-600" /> 1800-200-XXXX</div>
          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-emerald-600" /> loans@{lender.name.toLowerCase().replace(/\s+/g, '')}.in</div>
          <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-emerald-600" /> www.{lender.name.toLowerCase().replace(/\s+/g, '')}.com</div>
          <div className="flex items-center gap-2"><FileCheck className="h-3.5 w-3.5 text-emerald-600" /> RBI / NBFC Registered</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Apply with {lender.name} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — CAPITAL MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════

function CapitalMarketplaceTab() {
  const [activeProduct, setActiveProduct] = useState<ProductType | 'All'>('All');
  const [filterLenderType, setFilterLenderType] = useState<LenderType | 'All'>('All');
  const [filterMaxRate, setFilterMaxRate] = useState('18');
  const [filterTenure, setFilterTenure] = useState('any');
  const [filterIndustry, setFilterIndustry] = useState('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [applyOffer, setApplyOffer] = useState<LenderOffer | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const filtered = useMemo(() => {
    return LENDER_OFFERS.filter((o) => {
      if (activeProduct !== 'All' && o.productType !== activeProduct) return false;
      if (filterLenderType !== 'All' && o.lenderType !== filterLenderType) return false;
      if (o.interestRate > parseFloat(filterMaxRate)) return false;
      if (filterTenure === 'short' && !o.tenureMonths.includes('days') && !o.tenureMonths.includes('Revolving')) {
        // skip if tenure starts > 24
        const nums = o.tenureMonths.match(/\d+/g);
        if (nums && parseInt(nums[0]) > 24) return false;
      }
      if (filterTenure === 'long' && (o.tenureMonths.includes('days') || o.tenureMonths.includes('Revolving'))) return false;
      if (searchQuery && !o.lenderName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activeProduct, filterLenderType, filterMaxRate, filterTenure, searchQuery]);

  const handleApply = (o: LenderOffer) => {
    setApplyOffer(o);
    setApplyOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-6 md:p-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-white">
              <Sparkles className="h-3 w-3 mr-1" /> GSTPilot Capital Marketplace
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Financing Marketplace — Connect Capital to Business
            </h1>
            <p className="text-sm text-slate-600">
              Access invoice financing, working capital, business loans, and revolving credit lines from India&apos;s leading NBFCs, Banks, and Fintech lenders. Single application, multiple offers.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:flex-col">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Zap className="h-4 w-4 mr-1" /> Quick Apply
            </Button>
            <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <FileText className="h-4 w-4 mr-1" /> Eligibility Check
            </Button>
          </div>
        </div>
        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {HERO_STATS.map((s, i) => (
            <HeroStatCard key={s.label} stat={s} index={i} />
          ))}
        </div>
      </motion.div>

      {/* Product Type Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PRODUCT_TYPES.map((pt) => (
          <ProductTypeCard
            key={pt.id}
            pt={pt}
            active={activeProduct === pt.id}
            onClick={() => setActiveProduct(activeProduct === pt.id ? 'All' : pt.id)}
          />
        ))}
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" /> Filter Offers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Lender Type</Label>
              <Select value={filterLenderType} onValueChange={(v) => setFilterLenderType(v as LenderType | 'All')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="NBFC">NBFC</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                  <SelectItem value="Fintech">Fintech</SelectItem>
                  <SelectItem value="Investor">Investor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max Interest Rate</Label>
              <Select value={filterMaxRate} onValueChange={setFilterMaxRate}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="18">Up to 18%</SelectItem>
                  <SelectItem value="14">Up to 14%</SelectItem>
                  <SelectItem value="12">Up to 12%</SelectItem>
                  <SelectItem value="10">Up to 10%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tenure</Label>
              <Select value={filterTenure} onValueChange={setFilterTenure}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="short">Short Term</SelectItem>
                  <SelectItem value="long">Long Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Industry</Label>
              <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All Industries</SelectItem>
                  <SelectItem value="mfg">Manufacturing</SelectItem>
                  <SelectItem value="tex">Textiles</SelectItem>
                  <SelectItem value="eng">Engineering</SelectItem>
                  <SelectItem value="pha">Pharmaceuticals</SelectItem>
                  <SelectItem value="ret">Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search Lender</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="e.g. HDFC"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of {LENDER_OFFERS.length} offers
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500"
              onClick={() => {
                setActiveProduct('All');
                setFilterLenderType('All');
                setFilterMaxRate('18');
                setFilterTenure('any');
                setFilterIndustry('any');
                setSearchQuery('');
              }}
            >
              <X className="h-3 w-3 mr-1" /> Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Offers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((o, i) => (
          <FinancingOfferCard key={o.id} offer={o} onApply={handleApply} index={i} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">No offers match your filters. Try widening your search.</p>
        </div>
      )}

      <ApplicationFormDialog offer={applyOffer} open={applyOpen} onOpenChange={setApplyOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — MY APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function MyApplicationsTab() {
  const [viewApp, setViewApp] = useState<LoanApplication | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const stats = useMemo(() => {
    const total = MY_APPLICATIONS.reduce((s, a) => s + a.amount, 0);
    const approved = MY_APPLICATIONS.filter(a => a.status === 'Approved' || a.status === 'Disbursed').reduce((s, a) => s + a.sanctionedAmount, 0);
    const approvalRate = (MY_APPLICATIONS.filter(a => a.status === 'Approved' || a.status === 'Disbursed').length / MY_APPLICATIONS.length) * 100;
    const avgRate = MY_APPLICATIONS.filter(a => a.status === 'Approved' || a.status === 'Disbursed').reduce((s, a) => s + a.interestRate, 0) / Math.max(1, MY_APPLICATIONS.filter(a => a.status === 'Approved' || a.status === 'Disbursed').length);
    const totalEmi = MY_APPLICATIONS.filter(a => a.status === 'Disbursed').reduce((s, a) => s + a.emi, 0);
    return { total, approved, approvalRate, avgRate, totalEmi };
  }, []);

  const handleView = (a: LoanApplication) => {
    setViewApp(a);
    setTimelineOpen(true);
  };

  const statCards = [
    { label: 'Total Applied', value: formatINR(stats.total), icon: IndianRupee, color: 'emerald' },
    { label: 'Total Approved', value: formatINR(stats.approved), icon: CheckCircle, color: 'teal' },
    { label: 'Approval Rate', value: stats.approvalRate.toFixed(0) + '%', icon: Target, color: 'green' },
    { label: 'Avg Interest Rate', value: stats.avgRate.toFixed(1) + '%', icon: Percent, color: 'cyan' },
    { label: 'Monthly EMI', value: formatINR(stats.totalEmi), icon: Calendar, color: 'emerald' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <s.icon className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{s.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-slate-900">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Applications Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-600" /> Loan Applications
          </CardTitle>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {MY_APPLICATIONS.length} Total
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-200">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 z-10">
                <TableRow>
                  <TableHead className="text-xs">Application #</TableHead>
                  <TableHead className="text-xs">Lender</TableHead>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Applied</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                  <TableHead className="text-xs text-right">Sanctioned</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MY_APPLICATIONS.map((a) => (
                  <TableRow key={a.id} className="hover:bg-emerald-50/50">
                    <TableCell className="font-mono text-[11px] text-slate-700">{a.id}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-900">{a.lenderName}</TableCell>
                    <TableCell className="text-xs text-slate-600">{a.productType}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-slate-900">{formatINR(a.amount)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(a.appliedDate)}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-xs text-right text-emerald-700 font-semibold">
                      {a.interestRate > 0 ? `${a.interestRate}%` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-right font-semibold text-slate-900">
                      {a.sanctionedAmount > 0 ? formatINR(a.sanctionedAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleView(a)}>
                          View
                        </Button>
                        {(a.status === 'Under Review' || a.status === 'Pending') && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-700">
                            <Upload className="h-3 w-3 mr-1" /> Docs
                          </Button>
                        )}
                        {a.status === 'Approved' && (
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                            Accept
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ApplicationTimelineDialog app={viewApp} open={timelineOpen} onOpenChange={setTimelineOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — LENDER DIRECTORY
// ═══════════════════════════════════════════════════════════════════════════════

function LenderDirectoryTab() {
  const [selectedLenders, setSelectedLenders] = useState<string[]>([]);
  const [profileLender, setProfileLender] = useState<Lender | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filterType, setFilterType] = useState<LenderType | 'All'>('All');

  const filteredLenders = useMemo(() => LENDERS.filter(l => filterType === 'All' || l.type === filterType), [filterType]);

  const leaderboard = useMemo(() => [...LENDERS].sort((a, b) => b.totalDisbursedCr - a.totalDisbursedCr).slice(0, 5), []);

  const toggleSelect = (id: string) => {
    setSelectedLenders((prev) => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return [prev[1], prev[2], id];
      return [...prev, id];
    });
  };

  const handleView = (l: Lender) => {
    setProfileLender(l);
    setProfileOpen(true);
  };

  const compareLenders = selectedLenders.map(id => LENDERS.find(l => l.id === id)).filter(Boolean) as Lender[];

  return (
    <div className="space-y-6">
      {/* Filter + Leaderboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" /> Top Lenders Leaderboard
            </CardTitle>
            <CardDescription className="text-xs">By total capital disbursed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {leaderboard.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-slate-200 text-slate-700' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${l.logoColor}`}>
                    {l.logoInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{l.name}</p>
                    <p className="text-[10px] text-slate-500">{formatINRCr(l.totalDisbursedCr)} disbursed</p>
                  </div>
                  <LenderTypeBadge type={l.type} />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-600" /> Lender Directory
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedLenders.length > 0
                  ? `${selectedLenders.length} of 3 selected for comparison`
                  : 'Select up to 3 lenders to compare'}
              </CardDescription>
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as LenderType | 'All')}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="NBFC">NBFC</SelectItem>
                <SelectItem value="Bank">Bank</SelectItem>
                <SelectItem value="Fintech">Fintech</SelectItem>
                <SelectItem value="Investor">Investor</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
        </Card>
      </div>

      {/* Lenders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLenders.map((l, i) => (
          <LenderDirectoryCard
            key={l.id}
            lender={l}
            onView={handleView}
            selected={selectedLenders.includes(l.id)}
            onToggleSelect={() => toggleSelect(l.id)}
            index={i}
          />
        ))}
      </div>

      {/* Comparison Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" /> Lender Comparison
          </CardTitle>
          <CardDescription className="text-xs">
            Side-by-side comparison of selected lenders across key metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {compareLenders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-500">Select lenders from above to compare them side by side</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Metric</TableHead>
                    {compareLenders.map(l => (
                      <TableHead key={l.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${l.logoColor}`}>
                            {l.logoInitials}
                          </div>
                          <span className="font-semibold text-slate-900">{l.name}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Lender Type</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id}><LenderTypeBadge type={l.type} /></TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Interest Rate</TableCell>
                    {compareLenders.map(l => (
                      <TableCell key={l.id} className="text-xs text-emerald-700 font-semibold">
                        {l.interestRateMin}% - {l.interestRateMax}%
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Max Tenure</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id} className="text-xs">60 months</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Processing Fee</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id} className="text-xs">0.5% - 2.5%</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Min Credit Score</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id} className="text-xs font-semibold">{l.minCreditScore}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Max Amount</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id} className="text-xs font-semibold">{formatLakh(1000)}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Disbursal Time</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id} className="text-xs font-semibold">{l.processingDays} days</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Total Disbursed</TableCell>
                    {compareLenders.map(l => <TableCell key={l.id} className="text-xs font-semibold">{formatINRCr(l.totalDisbursedCr)}</TableCell>)}
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs text-slate-500">Rating</TableCell>
                    {compareLenders.map(l => (
                      <TableCell key={l.id} className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400" /> {l.rating}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LenderProfileDialog lender={profileLender} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — CAPITAL ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

function CapitalAnalyticsTab() {
  const totalLoans = LOAN_VOLUME_BY_PRODUCT.reduce((s, d) => s + d.value, 0);
  const totalDisbursed12M = MONTHLY_DISBURSEMENT.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Stat Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Loan Volume', value: formatINRCr(totalLoans), icon: Banknote, color: 'emerald' },
          { label: '12-Month Disbursal', value: formatINRCr(totalDisbursed12M), icon: TrendingUp, color: 'teal' },
          { label: 'Avg Interest Rate', value: '8.4%', icon: Percent, color: 'green' },
          { label: 'Active Lenders', value: '50+', icon: Landmark, color: 'cyan' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <s.icon className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{s.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-slate-900">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" /> Loan Volume by Product Type
            </CardTitle>
            <CardDescription className="text-xs">Capital disbursed across product categories (₹ Crores)</CardDescription>
          </CardHeader>
          <CardContent>
            <VolumeBarChart />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-600" /> Lender Type Market Share
            </CardTitle>
            <CardDescription className="text-xs">Distribution of disbursed capital by lender category</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={LENDER_MARKET_SHARE} size={200} />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Monthly Disbursement Trend
            </CardTitle>
            <CardDescription className="text-xs">Total capital disbursed per month over last 12 months (₹ Crores)</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyLineChart data={MONTHLY_DISBURSEMENT} color="#10b981" ySuffix="Cr" yPrefix="₹" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-emerald-600" /> Interest Rate Trend
            </CardTitle>
            <CardDescription className="text-xs">Weighted average interest rate on B2B loans (12 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <InterestRateTrendChart />
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" /> Industry × Product Heatmap
            </CardTitle>
            <CardDescription className="text-xs">Demand intensity by industry and product type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-x-auto">
              <IndustryHeatmap />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Rate Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Gauge className="h-4 w-4 text-emerald-600" /> Approval Rate by Credit Score Bucket
          </CardTitle>
          <CardDescription className="text-xs">Application approval distribution across credit score ranges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs">Credit Score Bucket</TableHead>
                  <TableHead className="text-xs text-right">Applicants</TableHead>
                  <TableHead className="text-xs text-right">Approved</TableHead>
                  <TableHead className="text-xs text-right">Approval Rate</TableHead>
                  <TableHead className="text-xs">Distribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {APPROVAL_BY_SCORE.map((row) => (
                  <TableRow key={row.bucket}>
                    <TableCell className="text-xs font-semibold text-slate-900">{row.bucket}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.applicants)}</TableCell>
                    <TableCell className="text-xs text-right">{formatNumber(row.approved)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span className={`font-semibold ${
                        row.rate >= 80 ? 'text-emerald-700' : row.rate >= 40 ? 'text-amber-700' : 'text-red-700'
                      }`}>
                        {row.rate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={row.rate} className="h-2 w-32" />
                        <span className="text-[10px] text-slate-500">{row.rate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Capital Gap Analysis */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" /> Capital Gap Analysis
          </CardTitle>
          <CardDescription className="text-xs">
            Demand-supply gap visualization for India&apos;s B2B financing market
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CapitalGapVisual />
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FinancingMarketplacePage() {
  const [tab, setTab] = useState('marketplace');

  const tabs = [
    { id: 'marketplace', label: 'Capital Marketplace', icon: Landmark },
    { id: 'applications', label: 'My Applications', icon: FileText },
    { id: 'directory', label: 'Lender Directory', icon: Building2 },
    { id: 'analytics', label: 'Capital Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2 text-emerald-600">
              <HandCoins className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">GSTPilot Financial Exchange</span>
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Financing Marketplace
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Connect capital to business — invoice financing, working capital, business loans & revolving credit lines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" /> Live
            </Badge>
            <Badge variant="outline" className="border-slate-200 text-slate-600">
              50+ Lenders
            </Badge>
          </div>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto pb-1">
            <TabsList className="bg-white border border-slate-200 h-auto p-1 flex w-max">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-600 text-xs md:text-sm px-3 md:px-4 py-1.5"
                >
                  <t.icon className="h-3.5 w-3.5 mr-1.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="marketplace" className="mt-6 focus-visible:outline-none">
            <CapitalMarketplaceTab />
          </TabsContent>
          <TabsContent value="applications" className="mt-6 focus-visible:outline-none">
            <MyApplicationsTab />
          </TabsContent>
          <TabsContent value="directory" className="mt-6 focus-visible:outline-none">
            <LenderDirectoryTab />
          </TabsContent>
          <TabsContent value="analytics" className="mt-6 focus-visible:outline-none">
            <CapitalAnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
