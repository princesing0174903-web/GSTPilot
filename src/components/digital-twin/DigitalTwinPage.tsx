'use client'

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Copy, Activity, TrendingUp, TrendingDown, AlertTriangle, Shield, Users,
  IndianRupee, Zap, Brain, BarChart3, Target, Eye, Play, RotateCcw,
  Gauge, Sparkles, ArrowUpRight, ArrowDownRight, Building2, Wallet, FileText,
} from 'lucide-react'
import { useFireClients, useFireInvoices, useFireReturns } from '@/hooks/use-firestore'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L'
  return '₹' + n.toLocaleString('en-IN')
}

const fmtINRFull = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

const pct = (n: number, decimals = 1) => n.toFixed(decimals) + '%'

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerChild = {
  initial: { opacity: 0, y: 16, scale: 0.96 },
  animate: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const glowPulse = {
  animate: {
    boxShadow: [
      '0 0 0px rgba(16, 185, 129, 0)',
      '0 0 30px rgba(16, 185, 129, 0.2)',
      '0 0 0px rgba(16, 185, 129, 0)',
    ],
  },
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNT-UP ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const prevTarget = useRef(0)
  const countRef = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target

    const start = countRef.current
    const startTime = Date.now()
    const diff = target - start

    const step = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const newVal = Math.round(start + diff * eased)
      countRef.current = newVal
      setCount(newVal)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])

  return count
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA — 5 Business Profiles
// ═══════════════════════════════════════════════════════════════════════════════

interface BusinessDimension {
  name: string
  value: string
  score: number
  inverted?: boolean // lower is better
  subMetrics: { label: string; value: string; trend: 'up' | 'down' | 'flat' }[]
}

interface BusinessProfile {
  id: string
  name: string
  type: string
  dimensions: BusinessDimension[]
  twinScore: number
  topClients: { name: string; revenue: string }[]
  topVendors: { name: string; spend: string }[]
  bankAccounts: { bank: string; balance: string; type: string }[]
  lastMonthDimensions: number[]
  realtimeFeed: { text: string; time: string }[]
}

const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    id: 'techflow',
    name: 'TechFlow Solutions Pvt Ltd',
    type: 'IT Services',
    dimensions: [
      { name: 'Revenue', value: '₹4,56,78,900', score: 87, subMetrics: [
        { label: 'Monthly Recurring', value: '₹38,06,575', trend: 'up' },
        { label: 'One-time Projects', value: '₹12,50,000', trend: 'up' },
        { label: 'Outstanding', value: '₹45,00,000', trend: 'down' },
      ]},
      { name: 'Cash Flow', value: '₹1,23,45,600', score: 72, subMetrics: [
        { label: 'Operating Cash', value: '₹89,00,000', trend: 'up' },
        { label: 'Free Cash Flow', value: '₹34,45,600', trend: 'flat' },
        { label: 'Burn Rate', value: '₹18,50,000/mo', trend: 'down' },
      ]},
      { name: 'Compliance', value: '94.2%', score: 94, subMetrics: [
        { label: 'GST Filed', value: '12/12', trend: 'up' },
        { label: 'TDS Filed', value: '4/4', trend: 'up' },
        { label: 'ROC Filed', value: '2/2', trend: 'flat' },
      ]},
      { name: 'Employees', value: '23', score: 65, subMetrics: [
        { label: 'Active', value: '21', trend: 'up' },
        { label: 'Attrition Rate', value: '8.7%', trend: 'down' },
        { label: 'Avg Tenure', value: '2.3 years', trend: 'flat' },
      ]},
      { name: 'Banking', value: '4 accounts, ₹89,00,000', score: 78, subMetrics: [
        { label: 'SBI Current', value: '₹45,00,000', trend: 'up' },
        { label: 'HDFC Savings', value: '₹23,00,000', trend: 'flat' },
        { label: 'ICICI OD', value: '₹21,00,000', trend: 'up' },
      ]},
      { name: 'Risks', value: '3 active', score: 38, inverted: true, subMetrics: [
        { label: 'Client Concentration', value: 'High', trend: 'down' },
        { label: 'Regulatory Risk', value: 'Medium', trend: 'flat' },
        { label: 'Currency Risk', value: 'Low', trend: 'up' },
      ]},
      { name: 'Growth', value: '12.3% YoY', score: 82, subMetrics: [
        { label: 'Revenue Growth', value: '12.3%', trend: 'up' },
        { label: 'Client Growth', value: '8.5%', trend: 'up' },
        { label: 'Market Share', value: '2.1%', trend: 'up' },
      ]},
      { name: 'Predictions', value: '89% accuracy', score: 89, subMetrics: [
        { label: 'Revenue Accuracy', value: '91%', trend: 'up' },
        { label: 'Cash Flow Accuracy', value: '85%', trend: 'flat' },
        { label: 'Risk Accuracy', value: '90%', trend: 'up' },
      ]},
    ],
    twinScore: 78,
    topClients: [
      { name: 'Infosys Ltd', revenue: '₹1,23,45,000' },
      { name: 'Wipro Technologies', revenue: '₹89,00,000' },
      { name: 'TCS Digital', revenue: '₹67,50,000' },
      { name: 'Reliance Jio', revenue: '₹56,00,000' },
      { name: 'Flipkart India', revenue: '₹45,00,000' },
    ],
    topVendors: [
      { name: 'AWS India', spend: '₹12,00,000' },
      { name: 'Google Cloud', spend: '₹8,50,000' },
      { name: 'Microsoft 365', spend: '₹4,20,000' },
      { name: 'Airtel Business', spend: '₹3,60,000' },
      { name: 'Co-Working Space', spend: '₹2,40,000' },
    ],
    bankAccounts: [
      { bank: 'SBI', balance: '₹45,00,000', type: 'Current' },
      { bank: 'HDFC', balance: '₹23,00,000', type: 'Savings' },
      { bank: 'ICICI', balance: '₹21,00,000', type: 'OD' },
      { bank: 'Kotak', balance: '₹0', type: 'Salary' },
    ],
    lastMonthDimensions: [82, 68, 91, 62, 74, 42, 76, 85],
    realtimeFeed: [
      { text: 'GSTR-1 filed successfully for March 2025', time: '2 min ago' },
      { text: '₹3,45,000 payment received from Infosys', time: '15 min ago' },
      { text: 'TDS return Q4 validated', time: '1 hr ago' },
      { text: 'New invoice #INV-2025-089 created', time: '2 hrs ago' },
      { text: 'Bank balance updated: SBI +₹3,45,000', time: '2 hrs ago' },
    ],
  },
  {
    id: 'sharma-textiles',
    name: 'Sharma Textiles LLP',
    type: 'Manufacturing',
    dimensions: [
      { name: 'Revenue', value: '₹12,34,56,700', score: 92, subMetrics: [
        { label: 'Domestic Sales', value: '₹9,87,65,400', trend: 'up' },
        { label: 'Export Revenue', value: '₹2,46,91,300', trend: 'flat' },
        { label: 'Outstanding', value: '₹1,23,45,600', trend: 'down' },
      ]},
      { name: 'Cash Flow', value: '₹3,45,67,800', score: 81, subMetrics: [
        { label: 'Operating Cash', value: '₹2,34,56,700', trend: 'up' },
        { label: 'Free Cash Flow', value: '₹1,11,11,100', trend: 'up' },
        { label: 'Burn Rate', value: '₹45,00,000/mo', trend: 'flat' },
      ]},
      { name: 'Compliance', value: '88.5%', score: 89, subMetrics: [
        { label: 'GST Filed', value: '11/12', trend: 'down' },
        { label: 'TDS Filed', value: '4/4', trend: 'up' },
        { label: 'ROC Filed', value: '2/2', trend: 'flat' },
      ]},
      { name: 'Employees', value: '156', score: 71, subMetrics: [
        { label: 'Active', value: '148', trend: 'up' },
        { label: 'Attrition Rate', value: '5.2%', trend: 'up' },
        { label: 'Avg Tenure', value: '4.1 years', trend: 'up' },
      ]},
      { name: 'Banking', value: '6 accounts, ₹5,67,00,000', score: 85, subMetrics: [
        { label: 'SBI CC', value: '₹3,45,00,000', trend: 'up' },
        { label: 'BOB Term Loan', value: '₹1,23,00,000', trend: 'flat' },
        { label: 'HDFC OD', value: '₹99,00,000', trend: 'up' },
      ]},
      { name: 'Risks', value: '2 active', score: 55, inverted: true, subMetrics: [
        { label: 'Raw Material Price', value: 'High', trend: 'down' },
        { label: 'Working Capital Gap', value: 'Medium', trend: 'flat' },
        { label: 'Export Risk', value: 'Low', trend: 'up' },
      ]},
      { name: 'Growth', value: '18.7% YoY', score: 91, subMetrics: [
        { label: 'Revenue Growth', value: '18.7%', trend: 'up' },
        { label: 'Client Growth', value: '12.3%', trend: 'up' },
        { label: 'Market Share', value: '4.5%', trend: 'up' },
      ]},
      { name: 'Predictions', value: '86% accuracy', score: 86, subMetrics: [
        { label: 'Revenue Accuracy', value: '88%', trend: 'up' },
        { label: 'Cash Flow Accuracy', value: '82%', trend: 'flat' },
        { label: 'Risk Accuracy', value: '87%', trend: 'up' },
      ]},
    ],
    twinScore: 84,
    topClients: [
      { name: 'FabIndia', revenue: '₹2,34,56,700' },
      { name: 'Reliance Retail', revenue: '₹1,89,00,000' },
      { name: 'Westside', revenue: '₹1,23,45,000' },
      { name: 'Myntra', revenue: '₹98,00,000' },
      { name: 'Zara India', revenue: '₹78,00,000' },
    ],
    topVendors: [
      { name: 'Cotton Corp India', spend: '₹3,45,00,000' },
      { name: 'Reliance Petro', spend: '₹89,00,000' },
      { name: 'Adani Power', spend: '₹56,00,000' },
      { name: 'Tata Logistics', spend: '₹34,00,000' },
      { name: 'DHL Express', spend: '₹12,00,000' },
    ],
    bankAccounts: [
      { bank: 'SBI', balance: '₹3,45,00,000', type: 'CC' },
      { bank: 'BOB', balance: '₹1,23,00,000', type: 'Term Loan' },
      { bank: 'HDFC', balance: '₹99,00,000', type: 'OD' },
      { bank: 'ICICI', balance: '₹0', type: 'Salary' },
      { bank: 'Axis', balance: '₹0', type: 'Current' },
      { bank: 'Kotak', balance: '₹0', type: 'FX' },
    ],
    lastMonthDimensions: [88, 77, 85, 68, 80, 50, 86, 82],
    realtimeFeed: [
      { text: 'E-way bill generated for shipment #EW-4567', time: '5 min ago' },
      { text: '₹23,45,000 received from FabIndia', time: '30 min ago' },
      { text: 'GSTR-3B filed for March 2025', time: '1 hr ago' },
      { text: 'Purchase order #PO-892 from Myntra', time: '3 hrs ago' },
      { text: 'Bank guarantee renewed: SBI CC', time: '5 hrs ago' },
    ],
  },
  {
    id: 'patel-foods',
    name: 'Patel Foods & Beverages',
    type: 'FMCG Distribution',
    dimensions: [
      { name: 'Revenue', value: '₹8,90,12,300', score: 79, subMetrics: [
        { label: 'Distribution Revenue', value: '₹7,12,09,800', trend: 'up' },
        { label: 'Retail Revenue', value: '₹1,78,02,500', trend: 'flat' },
        { label: 'Outstanding', value: '₹2,34,56,700', trend: 'down' },
      ]},
      { name: 'Cash Flow', value: '₹89,34,500', score: 58, subMetrics: [
        { label: 'Operating Cash', value: '₹1,23,45,600', trend: 'down' },
        { label: 'Free Cash Flow', value: '-₹34,11,100', trend: 'down' },
        { label: 'Burn Rate', value: '₹67,00,000/mo', trend: 'down' },
      ]},
      { name: 'Compliance', value: '76.3%', score: 76, subMetrics: [
        { label: 'GST Filed', value: '10/12', trend: 'down' },
        { label: 'TDS Filed', value: '3/4', trend: 'down' },
        { label: 'FSSAI License', value: 'Active', trend: 'flat' },
      ]},
      { name: 'Employees', value: '45', score: 60, subMetrics: [
        { label: 'Active', value: '42', trend: 'flat' },
        { label: 'Attrition Rate', value: '14.3%', trend: 'down' },
        { label: 'Avg Tenure', value: '1.8 years', trend: 'down' },
      ]},
      { name: 'Banking', value: '3 accounts, ₹34,00,000', score: 52, subMetrics: [
        { label: 'SBI Current', value: '₹23,00,000', trend: 'down' },
        { label: 'HDFC OD', value: '₹11,00,000', trend: 'flat' },
        { label: 'Kotak Salary', value: '₹0', trend: 'flat' },
      ]},
      { name: 'Risks', value: '5 active', score: 25, inverted: true, subMetrics: [
        { label: 'Working Capital', value: 'Critical', trend: 'down' },
        { label: 'Compliance Backlog', value: 'High', trend: 'down' },
        { label: 'Client Churn', value: 'High', trend: 'down' },
      ]},
      { name: 'Growth', value: '3.2% YoY', score: 45, subMetrics: [
        { label: 'Revenue Growth', value: '3.2%', trend: 'flat' },
        { label: 'Client Growth', value: '-2.1%', trend: 'down' },
        { label: 'Market Share', value: '1.2%', trend: 'down' },
      ]},
      { name: 'Predictions', value: '72% accuracy', score: 72, subMetrics: [
        { label: 'Revenue Accuracy', value: '74%', trend: 'flat' },
        { label: 'Cash Flow Accuracy', value: '68%', trend: 'down' },
        { label: 'Risk Accuracy', value: '75%', trend: 'up' },
      ]},
    ],
    twinScore: 56,
    topClients: [
      { name: 'BigBasket', revenue: '₹1,56,00,000' },
      { name: 'DMart', revenue: '₹1,23,00,000' },
      { name: 'Spencer\'s Retail', revenue: '₹89,00,000' },
      { name: 'Reliance Fresh', revenue: '₹67,00,000' },
      { name: 'Local Kirana Stores', revenue: '₹45,00,000' },
    ],
    topVendors: [
      { name: 'ITC Foods', spend: '₹2,34,00,000' },
      { name: 'Nestle India', spend: '₹1,23,00,000' },
      { name: 'Britannia', spend: '₹89,00,000' },
      { name: 'Parle Products', spend: '₹56,00,000' },
      { name: 'HUL Distribution', spend: '₹34,00,000' },
    ],
    bankAccounts: [
      { bank: 'SBI', balance: '₹23,00,000', type: 'Current' },
      { bank: 'HDFC', balance: '₹11,00,000', type: 'OD' },
      { bank: 'Kotak', balance: '₹0', type: 'Salary' },
    ],
    lastMonthDimensions: [76, 62, 80, 58, 55, 30, 50, 70],
    realtimeFeed: [
      { text: '⚠ GSTR-3B filing overdue for Feb 2025', time: '1 min ago' },
      { text: 'Payment reminder: ITC Foods ₹45,00,000 due', time: '20 min ago' },
      { text: 'Bank balance low: SBI ₹23,00,000', time: '1 hr ago' },
      { text: 'Client DMart renewal discussion pending', time: '3 hrs ago' },
      { text: 'TDS payment of ₹3,45,000 processed', time: '5 hrs ago' },
    ],
  },
  {
    id: 'urban-clinic',
    name: 'Urban Healthcare Clinics',
    type: 'Healthcare Services',
    dimensions: [
      { name: 'Revenue', value: '₹2,34,56,800', score: 74, subMetrics: [
        { label: 'Consultation', value: '₹1,12,34,500', trend: 'up' },
        { label: 'Diagnostics', value: '₹78,90,000', trend: 'up' },
        { label: 'Pharmacy', value: '₹43,32,300', trend: 'flat' },
      ]},
      { name: 'Cash Flow', value: '₹67,89,000', score: 69, subMetrics: [
        { label: 'Operating Cash', value: '₹56,78,000', trend: 'up' },
        { label: 'Free Cash Flow', value: '₹11,11,000', trend: 'flat' },
        { label: 'Burn Rate', value: '₹12,00,000/mo', trend: 'up' },
      ]},
      { name: 'Compliance', value: '97.8%', score: 98, subMetrics: [
        { label: 'GST Filed', value: '12/12', trend: 'up' },
        { label: 'Medical License', value: 'Active', trend: 'flat' },
        { label: 'Patient Data', value: 'HIPAA Compliant', trend: 'up' },
      ]},
      { name: 'Employees', value: '34', score: 72, subMetrics: [
        { label: 'Doctors', value: '8', trend: 'up' },
        { label: 'Nurses', value: '15', trend: 'flat' },
        { label: 'Admin', value: '11', trend: 'flat' },
      ]},
      { name: 'Banking', value: '2 accounts, ₹56,00,000', score: 68, subMetrics: [
        { label: 'HDFC Current', value: '₹34,00,000', trend: 'up' },
        { label: 'ICICI Savings', value: '₹22,00,000', trend: 'flat' },
      ]},
      { name: 'Risks', value: '1 active', score: 72, inverted: true, subMetrics: [
        { label: 'Regulatory', value: 'Low', trend: 'up' },
        { label: 'Malpractice', value: 'Low', trend: 'up' },
        { label: 'Competition', value: 'Medium', trend: 'flat' },
      ]},
      { name: 'Growth', value: '22.5% YoY', score: 94, subMetrics: [
        { label: 'Revenue Growth', value: '22.5%', trend: 'up' },
        { label: 'Patient Growth', value: '18.9%', trend: 'up' },
        { label: 'Market Share', value: '1.8%', trend: 'up' },
      ]},
      { name: 'Predictions', value: '91% accuracy', score: 91, subMetrics: [
        { label: 'Revenue Accuracy', value: '93%', trend: 'up' },
        { label: 'Patient Volume', value: '89%', trend: 'up' },
        { label: 'Risk Accuracy', value: '92%', trend: 'up' },
      ]},
    ],
    twinScore: 82,
    topClients: [
      { name: 'Star Health Insurance', revenue: '₹56,00,000' },
      { name: 'Corporate Wellness Programs', revenue: '₹45,00,000' },
      { name: 'Individual Patients', revenue: '₹34,00,000' },
      { name: 'CGHS Panel', revenue: '₹23,00,000' },
      { name: 'Lab Referrals', revenue: '₹12,00,000' },
    ],
    topVendors: [
      { name: 'Siemens Healthineers', spend: '₹23,00,000' },
      { name: 'Sun Pharma', spend: '₹12,00,000' },
      { name: 'Philips Healthcare', spend: '₹8,90,000' },
      { name: 'MedPlus', spend: '₹4,50,000' },
      { name: 'Airtel Business', spend: '₹2,40,000' },
    ],
    bankAccounts: [
      { bank: 'HDFC', balance: '₹34,00,000', type: 'Current' },
      { bank: 'ICICI', balance: '₹22,00,000', type: 'Savings' },
    ],
    lastMonthDimensions: [70, 65, 96, 68, 63, 68, 90, 88],
    realtimeFeed: [
      { text: 'GSTR-1 filed for March 2025', time: '10 min ago' },
      { text: 'New patient registration: 12 today', time: '30 min ago' },
      { text: 'Insurance claim ₹2,34,000 approved', time: '1 hr ago' },
      { text: 'Medical supplies order placed', time: '2 hrs ago' },
      { text: 'Doctor salary processed for March', time: '4 hrs ago' },
    ],
  },
  {
    id: 'green-energy',
    name: 'Green Energy Solar Pvt Ltd',
    type: 'Renewable Energy',
    dimensions: [
      { name: 'Revenue', value: '₹23,45,67,800', score: 95, subMetrics: [
        { label: 'EPC Contracts', value: '₹18,76,54,240', trend: 'up' },
        { label: 'O&M Revenue', value: '₹4,69,13,560', trend: 'up' },
        { label: 'Outstanding', value: '₹5,67,00,000', trend: 'flat' },
      ]},
      { name: 'Cash Flow', value: '₹8,90,12,300', score: 88, subMetrics: [
        { label: 'Operating Cash', value: '₹6,78,90,000', trend: 'up' },
        { label: 'Free Cash Flow', value: '₹2,11,22,300', trend: 'up' },
        { label: 'Burn Rate', value: '₹1,23,00,000/mo', trend: 'flat' },
      ]},
      { name: 'Compliance', value: '91.5%', score: 92, subMetrics: [
        { label: 'GST Filed', value: '12/12', trend: 'up' },
        { label: 'Environmental', value: 'Compliant', trend: 'up' },
        { label: 'Safety Audit', value: 'Passed', trend: 'flat' },
      ]},
      { name: 'Employees', value: '89', score: 77, subMetrics: [
        { label: 'Engineers', value: '34', trend: 'up' },
        { label: 'Project Managers', value: '12', trend: 'up' },
        { label: 'Field Staff', value: '43', trend: 'flat' },
      ]},
      { name: 'Banking', value: '5 accounts, ₹12,34,00,000', score: 90, subMetrics: [
        { label: 'SBI Project Loan', value: '₹8,90,00,000', trend: 'up' },
        { label: 'HDFC CC', value: '₹3,44,00,000', trend: 'flat' },
        { label: 'Green Bonds', value: '₹0', type: 'Planned', trend: 'up' },
      ]},
      { name: 'Risks', value: '2 active', score: 60, inverted: true, subMetrics: [
        { label: 'Policy Changes', value: 'Medium', trend: 'flat' },
        { label: 'Supply Chain', value: 'Low', trend: 'up' },
        { label: 'Weather Risk', value: 'Low', trend: 'up' },
      ]},
      { name: 'Growth', value: '34.5% YoY', score: 97, subMetrics: [
        { label: 'Revenue Growth', value: '34.5%', trend: 'up' },
        { label: 'Capacity Growth', value: '45.2%', trend: 'up' },
        { label: 'Market Share', value: '3.8%', trend: 'up' },
      ]},
      { name: 'Predictions', value: '88% accuracy', score: 88, subMetrics: [
        { label: 'Revenue Accuracy', value: '90%', trend: 'up' },
        { label: 'Project Timeline', value: '86%', trend: 'flat' },
        { label: 'Risk Accuracy', value: '87%', trend: 'up' },
      ]},
    ],
    twinScore: 89,
    topClients: [
      { name: 'NTPC Renewable', revenue: '₹5,67,00,000' },
      { name: 'Adani Green', revenue: '₹4,56,00,000' },
      { name: 'Tata Power Solar', revenue: '₹3,45,00,000' },
      { name: 'ReNew Power', revenue: '₹2,34,00,000' },
      { name: 'Azure Power', revenue: '₹1,23,00,000' },
    ],
    topVendors: [
      { name: 'LONGi Solar', spend: '₹6,78,00,000' },
      { name: 'SMA India', spend: '₹2,34,00,000' },
      { name: 'L&T Construction', spend: '₹1,23,00,000' },
      { name: 'ABB India', spend: '₹89,00,000' },
      { name: 'Tata Solar', spend: '₹56,00,000' },
    ],
    bankAccounts: [
      { bank: 'SBI', balance: '₹8,90,00,000', type: 'Project Loan' },
      { bank: 'HDFC', balance: '₹3,44,00,000', type: 'CC' },
      { bank: 'ICICI', balance: '₹0', type: 'Salary' },
      { bank: 'Axis', balance: '₹0', type: 'FX' },
      { bank: 'Kotak', balance: '₹0', type: 'Current' },
    ],
    lastMonthDimensions: [91, 84, 89, 73, 86, 56, 93, 85],
    realtimeFeed: [
      { text: '50MW project milestone completed', time: '5 min ago' },
      { text: '₹3,45,00,000 received from NTPC', time: '1 hr ago' },
      { text: 'EPC contract signed: 100MW Gujarat', time: '2 hrs ago' },
      { text: 'GSTR-1 filed for March 2025', time: '3 hrs ago' },
      { text: 'Solar panel shipment cleared customs', time: '6 hrs ago' },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-BUILT SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

interface Scenario {
  id: string
  name: string
  description: string
  params: { revenueChange: number; collectionDelay: number; clientChurn: number; interestRate: number; expenseGrowth: number; taxRateChange: number }
  result: { survivalProb: number; revenueImpact: string; cashFlowImpact: string; complianceRisk: string; action: string }
}

const PRE_BUILT_SCENARIOS: Scenario[] = [
  {
    id: 'revenue-drop',
    name: 'Revenue drops 30%',
    description: 'Major client loss or market downturn',
    params: { revenueChange: -30, collectionDelay: 0, clientChurn: 15, interestRate: 12, expenseGrowth: 0, taxRateChange: 0 },
    result: { survivalProb: 72, revenueImpact: '-₹1,37,03,670', cashFlowImpact: '-₹67,23,400', complianceRisk: 'Medium', action: 'Cut costs 20%, diversify client base, accelerate receivables' },
  },
  {
    id: 'collection-delay',
    name: 'Collections delay 20 days',
    description: 'Payment cycle extends significantly',
    params: { revenueChange: 0, collectionDelay: 20, clientChurn: 5, interestRate: 12, expenseGrowth: 0, taxRateChange: 0 },
    result: { survivalProb: 81, revenueImpact: '₹0', cashFlowImpact: 'Gap of ₹12,50,000', complianceRisk: 'Low', action: 'Invoice financing, offer early payment discounts, negotiate terms' },
  },
  {
    id: 'client-churn',
    name: '50% client churn',
    description: 'Half of clients leave simultaneously',
    params: { revenueChange: -45, collectionDelay: 0, clientChurn: 50, interestRate: 12, expenseGrowth: 0, taxRateChange: 0 },
    result: { survivalProb: 34, revenueImpact: '-₹2,28,39,450', cashFlowImpact: '-₹1,05,23,400', complianceRisk: 'Low', action: 'Emergency retention campaign, bridge financing, pivot strategy' },
  },
  {
    id: 'interest-hike',
    name: 'Interest rates rise to 18%',
    description: 'RBI rate hike scenario',
    params: { revenueChange: 0, collectionDelay: 0, clientChurn: 0, interestRate: 18, expenseGrowth: 5, taxRateChange: 0 },
    result: { survivalProb: 88, revenueImpact: '₹0', cashFlowImpact: '+₹3,45,000/mo loan cost', complianceRisk: 'Low', action: 'Refinance existing loans, lock fixed rates, reduce debt' },
  },
  {
    id: 'recession',
    name: 'Mild recession',
    description: 'GDP contraction with sector impact',
    params: { revenueChange: -15, collectionDelay: 15, clientChurn: 10, interestRate: 14, expenseGrowth: 8, taxRateChange: -2 },
    result: { survivalProb: 65, revenueImpact: '-₹68,51,835', cashFlowImpact: '-₹45,67,800', complianceRisk: 'Medium', action: 'Build cash reserves, reduce fixed costs, delay capex' },
  },
  {
    id: 'expansion',
    name: 'Aggressive expansion',
    description: 'Doubling down on growth',
    params: { revenueChange: 40, collectionDelay: 10, clientChurn: 5, interestRate: 12, expenseGrowth: 30, taxRateChange: 0 },
    result: { survivalProb: 78, revenueImpact: '+₹1,82,71,560', cashFlowImpact: '-₹56,78,900 (investment)', complianceRisk: 'Low', action: 'Secure growth capital, hire strategically, maintain compliance' },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// PREDICTION HISTORY DATA
// ═══════════════════════════════════════════════════════════════════════════════

const PREDICTION_HISTORY = [
  { month: 'Oct', predicted: 38.5, actual: 39.2 },
  { month: 'Nov', predicted: 40.1, actual: 39.8 },
  { month: 'Dec', predicted: 42.3, actual: 43.1 },
  { month: 'Jan', predicted: 41.8, actual: 41.5 },
  { month: 'Feb', predicted: 44.2, actual: 44.8 },
  { month: 'Mar', predicted: 45.7, actual: 45.5 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART: RADAR CHART
// ═══════════════════════════════════════════════════════════════════════════════

function RadarChart({ dimensions, size = 280 }: {
  dimensions: BusinessDimension[]
  size?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 40
  const n = dimensions.length
  const angleStep = (2 * Math.PI) / n

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2
    const dist = (value / 100) * r
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    }
  }

  // Grid rings
  const rings = [20, 40, 60, 80, 100]

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={Array.from({ length: n }, (_, i) => {
            const p = getPoint(i, ring)
            return `${p.x},${p.y}`
          }).join(' ')}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const p = getPoint(i, 100)
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={p.x} y2={p.y}
            stroke="rgba(148,163,184,0.12)"
            strokeWidth={1}
          />
        )
      })}

      {/* Data polygon — glow effect */}
      <polygon
        points={dimensions.map((d, i) => {
          const p = getPoint(i, d.score)
          return `${p.x},${p.y}`
        }).join(' ')}
        fill="rgba(16, 185, 129, 0.12)"
        stroke="rgba(16, 185, 129, 0.6)"
        strokeWidth={2}
        className="drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
      />

      {/* Data polygon — main */}
      <polygon
        points={dimensions.map((d, i) => {
          const p = getPoint(i, d.score)
          return `${p.x},${p.y}`
        }).join(' ')}
        fill="rgba(16, 185, 129, 0.08)"
        stroke="#10b981"
        strokeWidth={2}
      />

      {/* Data points */}
      {dimensions.map((d, i) => {
        const p = getPoint(i, d.score)
        const color = d.inverted
          ? d.score >= 60 ? '#10b981' : d.score >= 40 ? '#f59e0b' : '#ef4444'
          : d.score >= 80 ? '#10b981' : d.score >= 60 ? '#f59e0b' : '#ef4444'
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill={color} className="drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <circle cx={p.x} cy={p.y} r={8} fill={color} opacity={0.2}>
              <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        )
      })}

      {/* Labels */}
      {dimensions.map((d, i) => {
        const p = getPoint(i, 115)
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-400 text-[10px] font-medium"
          >
            {d.name}
          </text>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART: GAUGE
// ═══════════════════════════════════════════════════════════════════════════════

function AnimatedGauge({ score, size = 160 }: { score: number; size?: number }) {
  const animatedScore = useCountUp(score, 2000)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 12
  const circumference = Math.PI * r
  const offset = circumference - (animatedScore / 100) * circumference

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Caution' : 'At Risk'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size / 2 + 20} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M ${12} ${cy} A ${r} ${r} 0 0 1 ${size - 12} ${cy}`}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <motion.path
          d={`M ${12} ${cy} A ${r} ${r} 0 0 1 ${size - 12} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: 'easeOut' }}
          className="drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]"
        />
        {/* Score text */}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-white text-3xl font-bold" style={{ fontSize: '28px' }}>
          {animatedScore}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400 text-xs" style={{ fontSize: '11px' }}>
          {label}
        </text>
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART: BEFORE/AFTER BAR
// ═══════════════════════════════════════════════════════════════════════════════

function BeforeAfterBar({ label, before, after, format = 'number' }: {
  label: string; before: number; after: number; format?: 'number' | 'percent' | 'inr'
}) {
  const maxVal = Math.max(Math.abs(before), Math.abs(after), 1)
  const beforeW = Math.abs(before) / maxVal * 100
  const afterW = Math.abs(after) / maxVal * 100
  const isNeg = after < before

  const formatVal = (v: number) => {
    if (format === 'inr') return fmtINRFull(v)
    if (format === 'percent') return pct(v)
    return v.toLocaleString('en-IN')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className={`text-[11px] font-semibold ${isNeg ? 'text-red-400' : 'text-emerald-400'}`}>
          {isNeg ? <ArrowDownRight className="inline h-3 w-3" /> : <ArrowUpRight className="inline h-3 w-3" />}
          {formatVal(after)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 w-8 shrink-0">Before</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-slate-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${beforeW}%` }}
              transition={{ duration: 1, delay: 0.2 }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-500 w-8 shrink-0">After</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isNeg ? 'bg-red-500' : 'bg-emerald-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${afterW}%` }}
              transition={{ duration: 1, delay: 0.4 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART: PREDICTION ACCURACY
// ═══════════════════════════════════════════════════════════════════════════════

function PredictionAccuracyChart({ data, w = 320, h = 160 }: {
  data: { month: string; predicted: number; actual: number }[]
  w?: number; h?: number
}) {
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const chartW = w - padding.left - padding.right
  const chartH = h - padding.top - padding.bottom
  const allValues = data.flatMap(d => [d.predicted, d.actual])
  const minVal = Math.min(...allValues) - 2
  const maxVal = Math.max(...allValues) + 2
  const range = maxVal - minVal || 1

  const getX = (i: number) => padding.left + (i / (data.length - 1)) * chartW
  const getY = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH

  const predictedLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(d.predicted)}`).join(' ')
  const actualLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(d.actual)}`).join(' ')

  // Confidence band
  const bandTop = data.map((d, i) => `${getX(i)},${getY(d.predicted + 3)}`).join(' L')
  const bandBottom = data.map((d, i) => `${getX(i)},${getY(d.predicted - 3)}`).join(' L')
  const bandPath = `M${bandTop} L${[...data].reverse().map((d, i) => `${getX(data.length - 1 - i)},${getY(d.predicted - 3)}`).join(' L')} Z`

  return (
    <svg width={w} height={h} className="overflow-visible">
      {/* Confidence band */}
      <path d={bandPath} fill="rgba(16,185,129,0.06)" stroke="none" />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => (
        <line
          key={frac}
          x1={padding.left}
          y1={padding.top + chartH * frac}
          x2={w - padding.right}
          y2={padding.top + chartH * frac}
          stroke="rgba(148,163,184,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Predicted line */}
      <path d={predictedLine} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="6,3" />

      {/* Actual line */}
      <path d={actualLine} fill="none" stroke="#f59e0b" strokeWidth={2} />

      {/* Data points */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(d.predicted)} r={3} fill="#10b981" />
          <circle cx={getX(i)} cy={getY(d.actual)} r={3} fill="#f59e0b" />
        </g>
      ))}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text key={i} x={getX(i)} y={h - 5} textAnchor="middle" className="fill-slate-500 text-[9px]">
          {d.month}
        </text>
      ))}

      {/* Y axis labels */}
      {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
        <text key={i} x={padding.left - 5} y={getY(v) + 3} textAnchor="end" className="fill-slate-500 text-[9px]">
          {v.toFixed(0)}L
        </text>
      ))}

      {/* Legend */}
      <circle cx={padding.left + 5} cy={8} r={3} fill="#10b981" />
      <text x={padding.left + 12} y={11} className="fill-slate-400 text-[9px]">Predicted</text>
      <circle cx={padding.left + 75} cy={8} r={3} fill="#f59e0b" />
      <text x={padding.left + 82} y={11} className="fill-slate-400 text-[9px]">Actual</text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHART: SPARKLINE COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

function MiniCompareChart({ current, last, label, w = 120, h = 40 }: {
  current: number; last: number; label: string; w?: number; h?: number
}) {
  const generatePoints = (score: number) => {
    const base = score / 100
    return Array.from({ length: 8 }, (_, i) => {
      const x = (i / 7) * w
      const noise = Math.sin(i * 1.5) * 0.1 + Math.cos(i * 0.7) * 0.05
      const y = h - (base + noise) * (h - 4) - 2
      return { x, y: Math.max(2, Math.min(h - 2, y)) }
    })
  }

  const currentPts = generatePoints(current)
  const lastPts = generatePoints(last)

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const diff = current - last

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className={`text-[10px] font-semibold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
          {diff > 0 ? '+' : ''}{diff}
        </span>
      </div>
      <svg width={w} height={h} className="overflow-visible">
        <path d={toPath(lastPts)} fill="none" stroke="rgba(148,163,184,0.3)" strokeWidth={1.5} />
        <path d={toPath(currentPts)} fill="none" stroke="#10b981" strokeWidth={1.5} />
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH INDICATOR
// ═══════════════════════════════════════════════════════════════════════════════

function HealthDot({ score, inverted = false }: { score: number; inverted?: boolean }) {
  const effectiveScore = inverted ? score : score
  const color = effectiveScore >= 80 ? 'bg-emerald-500' : effectiveScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
  const glowColor = effectiveScore >= 80 ? 'shadow-emerald-500/50' : effectiveScore >= 60 ? 'shadow-amber-500/50' : 'shadow-red-500/50'
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${color} shadow-md ${glowColor}`} />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: BUSINESS MIRROR
// ═══════════════════════════════════════════════════════════════════════════════

function BusinessMirrorTab({ profile }: { profile: BusinessProfile }) {
  const [expandedDim, setExpandedDim] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Top section: Radar + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <motion.div {...fadeUp} className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-400" />
                  Digital Replica — {profile.name}
                </CardTitle>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                  LIVE
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                <RadarChart dimensions={profile.dimensions} size={340} />
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Gauge + Score */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <Card className="bg-slate-900 border-slate-800 shadow-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-400" />
                Twin Score
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <AnimatedGauge score={profile.twinScore} size={180} />
              <div className="mt-4 grid grid-cols-2 gap-3 w-full">
                {[
                  { label: 'Revenue', icon: IndianRupee, color: 'text-emerald-400' },
                  { label: 'Cash Flow', icon: Wallet, color: 'text-emerald-400' },
                  { label: 'Compliance', icon: Shield, color: 'text-emerald-400' },
                  { label: 'Risks', icon: AlertTriangle, color: 'text-amber-400' },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    custom={i}
                    variants={staggerChild}
                    initial="initial"
                    animate="animate"
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50"
                  >
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    <span className="text-[11px] text-slate-300">{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {profile.dimensions.map((dim, i) => (
          <motion.div
            key={dim.name}
            custom={i}
            variants={staggerChild}
            initial="initial"
            animate="animate"
          >
            <Card
              className={`bg-slate-900 border-slate-800 cursor-pointer transition-all duration-300 hover:border-slate-600 ${
                expandedDim === dim.name ? 'ring-1 ring-emerald-500/30' : ''
              }`}
              onClick={() => setExpandedDim(expandedDim === dim.name ? null : dim.name)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <HealthDot score={dim.score} inverted={dim.inverted} />
                    <span className="text-xs font-semibold text-white">{dim.name}</span>
                  </div>
                  <span className="text-lg font-bold text-white">{dim.score}<span className="text-slate-500 text-xs">/100</span></span>
                </div>
                <div className="text-sm font-medium text-emerald-400 mb-2">{dim.value}</div>
                <Progress
                  value={dim.inverted ? 100 - dim.score : dim.score}
                  className="h-1.5 bg-slate-800"
                />
                <AnimatePresence>
                  {expandedDim === dim.name && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <Separator className="my-3 bg-slate-700" />
                      <div className="space-y-2">
                        {dim.subMetrics.map((sub) => (
                          <div key={sub.label} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{sub.label}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-300 font-medium">{sub.value}</span>
                              {sub.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                              {sub.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Comparison: Current vs Last Month */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              Current vs Last Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {profile.dimensions.map((dim, i) => (
                <MiniCompareChart
                  key={dim.name}
                  current={dim.score}
                  last={profile.lastMonthDimensions[i]}
                  label={dim.name}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bottom section: Relationships + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Clients */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
          <Card className="bg-slate-900 border-slate-800 shadow-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                Top 5 Clients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.topClients.map((client, i) => (
                <div key={client.name} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-4">{i + 1}.</span>
                    <span className="text-xs text-slate-300">{client.name}</span>
                  </div>
                  <span className="text-xs font-medium text-emerald-400">{client.revenue}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Vendors */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
          <Card className="bg-slate-900 border-slate-800 shadow-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                Top 5 Vendors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.topVendors.map((vendor, i) => (
                <div key={vendor.name} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-4">{i + 1}.</span>
                    <span className="text-xs text-slate-300">{vendor.name}</span>
                  </div>
                  <span className="text-xs font-medium text-amber-400">{vendor.spend}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Real-time Feed */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }}>
          <Card className="bg-slate-900 border-slate-800 shadow-xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Real-time Data Feed
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {profile.realtimeFeed.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-800/30"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-300 leading-relaxed">{item.text}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{item.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: SIMULATION LAB
// ═══════════════════════════════════════════════════════════════════════════════

function SimulationLabTab({ profile }: { profile: BusinessProfile }) {
  const [params, setParams] = useState({
    revenueChange: 0,
    collectionDelay: 0,
    clientChurn: 0,
    interestRate: 12,
    expenseGrowth: 0,
    taxRateChange: 0,
  })

  const [simulating, setSimulating] = useState(false)
  const [simResults, setSimResults] = useState<null | {
    revenue: number
    cashFlow: number
    complianceRisk: string
    survivalProb: number
    actions: string[]
    stressTest: string
  }>(null)

  const revenueBase = 45678900
  const cashFlowBase = 12345600

  const runSimulation = useCallback(() => {
    setSimulating(true)
    setSimResults(null)

    setTimeout(() => {
      const revMultiplier = 1 + params.revenueChange / 100 - params.clientChurn / 200
      const newRevenue = Math.round(revenueBase * revMultiplier)
      const delayImpact = params.collectionDelay * revenueBase * 0.003
      const expenseMultiplier = 1 + params.expenseGrowth / 100
      const interestImpact = (params.interestRate - 12) * 200000
      const taxImpact = params.taxRateChange * revenueBase * 0.01
      const newCashFlow = Math.round(
        cashFlowBase * revMultiplier - delayImpact - interestImpact - taxImpact + (1 - expenseMultiplier) * cashFlowBase * 0.3
      )

      const riskScore = Math.abs(params.revenueChange) + params.collectionDelay * 0.5 + params.clientChurn + Math.abs(params.taxRateChange) * 2
      const complianceRisk = riskScore > 40 ? 'High' : riskScore > 20 ? 'Medium' : 'Low'

      const baseSurvival = 94
      const survivalDrop = Math.abs(params.revenueChange) * 0.5 + params.collectionDelay * 0.3 + params.clientChurn * 0.6 + Math.abs(params.expenseGrowth) * 0.3
      const survivalProb = Math.max(5, Math.min(99, Math.round(baseSurvival - survivalDrop)))

      const actions: string[] = []
      if (params.revenueChange < -20) actions.push('Reduce expenses by 15-25%')
      if (params.collectionDelay > 15) actions.push('Accelerate collections, offer early payment discounts')
      if (newCashFlow < cashFlowBase * 0.5) actions.push('Apply for working capital loan')
      if (params.clientChurn > 20) actions.push('Launch emergency client retention campaign')
      if (params.interestRate > 15) actions.push('Refinance existing loans at fixed rates')
      if (params.expenseGrowth > 15) actions.push('Audit and cut non-essential expenses')
      if (actions.length === 0) actions.push('Monitor closely, no immediate action needed')

      const maxDrop = (100 - survivalProb) * 0.45
      const stressTest = `Your business can survive a ${maxDrop.toFixed(0)}% revenue drop for 6 months`

      setSimResults({
        revenue: newRevenue,
        cashFlow: newCashFlow,
        complianceRisk,
        survivalProb,
        actions,
        stressTest,
      })
      setSimulating(false)
    }, 2500)
  }, [params])

  const loadScenario = (scenario: Scenario) => {
    setParams(scenario.params)
    setSimResults(null)
  }

  const resetSimulation = () => {
    setParams({ revenueChange: 0, collectionDelay: 0, clientChurn: 0, interestRate: 12, expenseGrowth: 0, taxRateChange: 0 })
    setSimResults(null)
  }

  const sliders = [
    { key: 'revenueChange' as const, label: 'Revenue Change', min: -50, max: 50, step: 1, unit: '%', default: 0 },
    { key: 'collectionDelay' as const, label: 'Collection Delay', min: 0, max: 60, step: 1, unit: ' days', default: 0 },
    { key: 'clientChurn' as const, label: 'Client Churn', min: 0, max: 50, step: 1, unit: '%', default: 0 },
    { key: 'interestRate' as const, label: 'Interest Rate', min: 5, max: 25, step: 0.5, unit: '%', default: 12 },
    { key: 'expenseGrowth' as const, label: 'Expense Growth', min: -20, max: 40, step: 1, unit: '%', default: 0 },
    { key: 'taxRateChange' as const, label: 'Tax Rate Change', min: -5, max: 5, step: 0.5, unit: '%', default: 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div {...fadeUp}>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 border border-slate-800 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.08),transparent_70%)]" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-1">What happens if...?</h2>
            <p className="text-slate-400 text-sm">Stress test your business with Palantir-grade simulation engine</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sliders Panel */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="xl:col-span-1">
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-400" />
                  Scenario Parameters
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSimulation}
                  className="text-slate-400 hover:text-white h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {sliders.map((slider) => (
                <div key={slider.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">{slider.label}</span>
                    <span className={`text-xs font-bold ${
                      params[slider.key] > slider.default ? 'text-red-400' :
                      params[slider.key] < slider.default ? 'text-emerald-400' :
                      'text-slate-300'
                    }`}>
                      {params[slider.key]}{slider.unit}
                    </span>
                  </div>
                  <Slider
                    value={[params[slider.key]]}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    onValueChange={([v]) => setParams(p => ({ ...p, [slider.key]: v }))}
                    className="[&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-400 [&_.bg-primary]:bg-emerald-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600">
                    <span>{slider.min}{slider.unit}</span>
                    <span>{slider.max}{slider.unit}</span>
                  </div>
                </div>
              ))}

              <Separator className="bg-slate-700" />

              <Button
                onClick={runSimulation}
                disabled={simulating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                size="lg"
              >
                {simulating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="mr-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </motion.div>
                    Running Simulation...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Results Panel */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="xl:col-span-2 space-y-6">
          {/* Simulation Running Animation */}
          <AnimatePresence>
            {simulating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative overflow-hidden rounded-xl bg-slate-900 border border-emerald-500/20 p-8"
              >
                <div className="absolute inset-0">
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent"
                  />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Brain className="h-12 w-12 text-emerald-400" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-white font-semibold">Running Monte Carlo Simulation...</p>
                    <p className="text-slate-400 text-xs mt-1">Analyzing 10,000 possible outcomes</p>
                  </div>
                  <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2.4, ease: 'linear' }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {simResults && !simulating && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Impact Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Revenue Impact',
                      before: fmtINRFull(revenueBase),
                      after: fmtINRFull(simResults.revenue),
                      change: pct(((simResults.revenue - revenueBase) / revenueBase) * 100),
                      isPositive: simResults.revenue >= revenueBase,
                      icon: IndianRupee,
                    },
                    {
                      label: 'Cash Flow Impact',
                      before: fmtINRFull(cashFlowBase),
                      after: fmtINRFull(simResults.cashFlow),
                      change: pct(((simResults.cashFlow - cashFlowBase) / cashFlowBase) * 100),
                      isPositive: simResults.cashFlow >= cashFlowBase,
                      icon: Wallet,
                    },
                    {
                      label: 'Compliance Risk',
                      before: 'Low',
                      after: simResults.complianceRisk,
                      change: simResults.complianceRisk,
                      isPositive: simResults.complianceRisk === 'Low',
                      icon: Shield,
                    },
                    {
                      label: 'Survival Probability',
                      before: '94%',
                      after: `${simResults.survivalProb}%`,
                      change: `${simResults.survivalProb - 94 > 0 ? '+' : ''}${simResults.survivalProb - 94}%`,
                      isPositive: simResults.survivalProb >= 70,
                      icon: Activity,
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.15, duration: 0.5 }}
                      {...glowPulse}
                    >
                      <Card className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <item.icon className={`h-4 w-4 ${item.isPositive ? 'text-emerald-400' : 'text-red-400'}`} />
                            <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-slate-500">Before:</span>
                              <span className="text-slate-300">{item.before}</span>
                            </div>
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + i * 0.15 }}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <span className="text-slate-500">After:</span>
                              <span className={`font-bold ${item.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.after}
                              </span>
                            </motion.div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Before/After Visualization */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-400" />
                      Impact Visualization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <BeforeAfterBar
                      label="Revenue"
                      before={revenueBase}
                      after={simResults.revenue}
                      format="inr"
                    />
                    <BeforeAfterBar
                      label="Cash Flow"
                      before={cashFlowBase}
                      after={simResults.cashFlow}
                      format="inr"
                    />
                    <BeforeAfterBar
                      label="Survival Probability"
                      before={94}
                      after={simResults.survivalProb}
                      format="percent"
                    />
                  </CardContent>
                </Card>

                {/* Recommended Actions */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      AI Recommended Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {simResults.actions.map((action, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + i * 0.15 }}
                          className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                        >
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-sm text-slate-300">{action}</span>
                        </motion.div>
                      ))}
                    </div>

                    <Separator className="my-4 bg-slate-700" />

                    {/* Stress Test Result */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.2 }}
                      className="p-4 rounded-lg bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-emerald-500/20"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-400">Stress Test Result</span>
                      </div>
                      <p className="text-sm text-white font-medium">{simResults.stressTest}</p>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pre-built Scenarios */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                Pre-built Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PRE_BUILT_SCENARIOS.map((scenario, i) => (
                  <motion.button
                    key={scenario.id}
                    custom={i}
                    variants={staggerChild}
                    initial="initial"
                    animate="animate"
                    onClick={() => loadScenario(scenario)}
                    className="text-left p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-800 transition-all duration-200"
                  >
                    <p className="text-xs font-semibold text-white mb-1">{scenario.name}</p>
                    <p className="text-[10px] text-slate-400 mb-2">{scenario.description}</p>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-emerald-400">Survival: {scenario.result.survivalProb}%</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-amber-400 truncate">{scenario.result.action.split(',')[0]}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: PREDICTIVE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function PredictiveEngineTab({ profile }: { profile: BusinessProfile }) {
  const [horizon, setHorizon] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  const horizonData = useMemo(() => ({
    '7d': {
      revenue: { value: '₹1,12,34,500', change: '+2.4%', confidence: '±₹3,45,000' },
      cashFlow: { value: '₹34,56,700', status: 'healthy' },
      churnRisk: { count: 1, clients: ['Local Kirana Stores'] },
      complianceRisk: { count: 0, items: [] },
      fundingNeed: { needed: false, gap: '₹0', days: 0 },
    },
    '30d': {
      revenue: { value: '₹5,12,34,500', change: '+12.3%', confidence: '±₹12,45,000' },
      cashFlow: { value: '₹1,45,67,800', status: 'healthy' },
      churnRisk: { count: 3, clients: ['Flipkart India', 'Local Kirana Stores', 'Small Retailer X'] },
      complianceRisk: { count: 2, items: ['GSTR-3B filing (due 20th)', 'TDS payment (due 7th)'] },
      fundingNeed: { needed: true, gap: '₹25,00,000', days: 45 },
    },
    '90d': {
      revenue: { value: '₹14,56,78,900', change: '+8.7%', confidence: '±₹45,67,000' },
      cashFlow: { value: '₹3,89,01,200', status: 'moderate' },
      churnRisk: { count: 5, clients: ['Flipkart India', 'Local Kirana Stores', 'Small Retailer X', 'Startup Y', 'Client Z'] },
      complianceRisk: { count: 4, items: ['GSTR-3B Q1', 'TDS Q1', 'Advance Tax', 'ROC Annual'] },
      fundingNeed: { needed: true, gap: '₹67,00,000', days: 30 },
    },
    '1y': {
      revenue: { value: '₹56,78,90,100', change: '+15.2%', confidence: '±₹2,34,56,000' },
      cashFlow: { value: '₹12,34,56,700', status: 'healthy' },
      churnRisk: { count: 8, clients: ['Multiple clients at varying risk levels'] },
      complianceRisk: { count: 6, items: ['Multiple quarterly and annual filings'] },
      fundingNeed: { needed: true, gap: '₹1,23,00,000', days: 90 },
    },
  }), [])

  const data = horizonData[horizon]

  const predictions = [
    {
      icon: TrendingUp,
      title: 'Revenue Prediction',
      value: data.revenue.value,
      change: data.revenue.change,
      detail: `Confidence: ${data.revenue.confidence}`,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: Wallet,
      title: 'Cash Flow Prediction',
      value: data.cashFlow.value,
      change: data.cashFlow.status === 'healthy' ? 'Healthy' : data.cashFlow.status === 'moderate' ? 'Moderate' : 'At Risk',
      detail: `Next ${horizon === '7d' ? '7 days' : horizon === '30d' ? '30 days' : horizon === '90d' ? '90 days' : '12 months'}`,
      color: data.cashFlow.status === 'healthy' ? 'text-emerald-400' : data.cashFlow.status === 'moderate' ? 'text-amber-400' : 'text-red-400',
      bgColor: data.cashFlow.status === 'healthy' ? 'bg-emerald-500/10' : data.cashFlow.status === 'moderate' ? 'bg-amber-500/10' : 'bg-red-500/10',
    },
    {
      icon: Users,
      title: 'Client Churn Risk',
      value: `${data.churnRisk.count} clients`,
      change: 'at high risk',
      detail: data.churnRisk.clients.slice(0, 2).join(', '),
      color: data.churnRisk.count > 3 ? 'text-red-400' : data.churnRisk.count > 1 ? 'text-amber-400' : 'text-emerald-400',
      bgColor: data.churnRisk.count > 3 ? 'bg-red-500/10' : data.churnRisk.count > 1 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
    },
    {
      icon: Shield,
      title: 'Compliance Risk',
      value: `${data.complianceRisk.count} potential late filings`,
      change: data.complianceRisk.count > 0 ? 'Action needed' : 'On track',
      detail: data.complianceRisk.items.slice(0, 2).join(', ') || 'No items',
      color: data.complianceRisk.count > 2 ? 'text-red-400' : data.complianceRisk.count > 0 ? 'text-amber-400' : 'text-emerald-400',
      bgColor: data.complianceRisk.count > 2 ? 'bg-red-500/10' : data.complianceRisk.count > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
    },
    {
      icon: IndianRupee,
      title: 'Funding Need',
      value: data.fundingNeed.needed ? `₹${data.fundingNeed.gap.replace('₹', '')}` : 'No gap predicted',
      change: data.fundingNeed.needed ? `in ${data.fundingNeed.days} days` : '',
      detail: data.fundingNeed.needed ? 'Working capital gap predicted' : 'Adequate reserves',
      color: data.fundingNeed.needed ? 'text-amber-400' : 'text-emerald-400',
      bgColor: data.fundingNeed.needed ? 'bg-amber-500/10' : 'bg-emerald-500/10',
    },
  ]

  const aiRecommendations = [
    { priority: 'high', text: 'Accelerate collections from top 3 overdue clients to improve cash position', impact: '₹45,00,000 improvement' },
    { priority: 'high', text: 'File pending GSTR-3B before deadline to avoid ₹5,000/day penalty', impact: 'Avoid ₹50,000 penalty' },
    { priority: 'medium', text: 'Negotiate extended payment terms with top vendors', impact: '₹12,00,000 cash flow relief' },
    { priority: 'medium', text: 'Consider invoice factoring for outstanding ₹89,00,000', impact: 'Immediate ₹80,00,000 liquidity' },
    { priority: 'low', text: 'Review subscription services for cost optimization', impact: '₹2,40,000 annual savings' },
  ]

  return (
    <div className="space-y-6">
      {/* Header with Horizon Toggle */}
      <motion.div {...fadeUp}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-emerald-400" />
              AI Predictive Engine
            </h2>
            <p className="text-slate-400 text-sm mt-1">Machine learning-powered business predictions</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y'] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  horizon === h
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {h === '7d' ? '7 Days' : h === '30d' ? '30 Days' : h === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Prediction Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {predictions.map((pred, i) => (
          <motion.div
            key={pred.title}
            custom={i}
            variants={staggerChild}
            initial="initial"
            animate="animate"
          >
            <Card className="bg-slate-900 border-slate-800 h-full">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-md ${pred.bgColor}`}>
                    <pred.icon className={`h-3.5 w-3.5 ${pred.color}`} />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{pred.title}</span>
                </div>
                <p className={`text-lg font-bold ${pred.color} mb-1`}>{pred.value}</p>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={`font-medium ${pred.color}`}>{pred.change}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">{pred.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Prediction Accuracy Tracker */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              Prediction Accuracy Tracker
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[9px]">
                89% Avg Accuracy
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <PredictionAccuracyChart data={PREDICTION_HISTORY} w={480} h={180} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 rounded-lg bg-slate-800/50">
                <p className="text-lg font-bold text-emerald-400">91%</p>
                <p className="text-[10px] text-slate-400">Revenue Accuracy</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/50">
                <p className="text-lg font-bold text-amber-400">85%</p>
                <p className="text-[10px] text-slate-400">Cash Flow Accuracy</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/50">
                <p className="text-lg font-bold text-emerald-400">90%</p>
                <p className="text-[10px] text-slate-400">Risk Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI Recommendations */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiRecommendations.map((rec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-colors"
                >
                  <div className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    rec.priority === 'high'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : rec.priority === 'medium'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}>
                    {rec.priority}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300">{rec.text}</p>
                    <p className="text-[10px] text-emerald-400 mt-1">Impact: {rec.impact}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function DigitalTwinPage() {
  const [selectedBusiness, setSelectedBusiness] = useState('techflow')
  const [activeTab, setActiveTab] = useState('mirror')

  const profile = useMemo(
    () => BUSINESS_PROFILES.find(p => p.id === selectedBusiness) || BUSINESS_PROFILES[0],
    [selectedBusiness]
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20">
                <Copy className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">BUSINESS DIGITAL TWIN™</h1>
                <p className="text-xs text-slate-400">Palantir-style simulation — digital replica of every company</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
              <SelectTrigger className="w-[260px] bg-slate-800 border-slate-700 text-white text-xs">
                <Building2 className="h-3.5 w-3.5 text-emerald-400 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {BUSINESS_PROFILES.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-white text-xs focus:bg-slate-700 focus:text-white">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] shrink-0">
              <span className="relative flex h-1.5 w-1.5 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              SYNCED
            </Badge>
          </div>
        </motion.div>

        {/* Business Info Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-4 p-3 rounded-lg bg-slate-900/50 border border-slate-800"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">{profile.name}</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-slate-700" />
          <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px]">{profile.type}</Badge>
          <Separator orientation="vertical" className="h-4 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Twin Score</span>
            <span className="text-sm font-bold text-emerald-400">{profile.twinScore}/100</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-slate-700 hidden sm:block" />
          <div className="items-center gap-1.5 hidden sm:flex">
            <span className="text-[10px] text-slate-500">Dimensions</span>
            <span className="text-sm font-bold text-white">{profile.dimensions.length}</span>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 h-auto">
            <TabsTrigger
              value="mirror"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Business Mirror
            </TabsTrigger>
            <TabsTrigger
              value="simulation"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Simulation Lab
            </TabsTrigger>
            <TabsTrigger
              value="predictions"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 text-xs px-4 py-2"
            >
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              Predictive Engine
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mirror" className="mt-6">
            <BusinessMirrorTab profile={profile} />
          </TabsContent>

          <TabsContent value="simulation" className="mt-6">
            <SimulationLabTab profile={profile} />
          </TabsContent>

          <TabsContent value="predictions" className="mt-6">
            <PredictiveEngineTab profile={profile} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
