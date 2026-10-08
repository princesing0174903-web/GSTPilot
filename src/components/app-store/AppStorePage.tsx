'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Store, Search, Star, Download, Shield, Zap, Users, IndianRupee,
  CheckCircle, ExternalLink, Grid3X3, List, Heart, TrendingUp,
  Package, Award, Sparkles, Filter, ChevronRight, Globe
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────

interface AppReview {
  id: string
  userName: string
  rating: number
  date: string
  comment: string
}

interface StoreApp {
  id: string
  name: string
  developer: string
  category: string
  rating: number
  reviews: number
  downloads: number
  price: string
  priceValue: number
  isFree: boolean
  shortDescription: string
  fullDescription: string
  features: string[]
  iconColor: string
  iconInitials: string
  version: string
  lastUpdated: string
  permissions: string[]
  appReviews: AppReview[]
  isFeatured?: boolean
  isNew?: boolean
  isOfficial?: boolean
}

// ─── Demo Data ───────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'AI Agents', 'HR', 'Payroll', 'Banking', 'Insurance',
  'Legal', 'Tax Automation', 'Analytics', 'CRM', 'Industry Solutions'
]

const ALL_APPS: StoreApp[] = [
  // AI Agents
  {
    id: 'taxbot-pro',
    name: 'TaxBot Pro',
    developer: 'NavaShreshtha AI Pvt. Ltd.',
    category: 'AI Agents',
    rating: 4.8, reviews: 1243, downloads: 45200,
    price: '₹499/mo', priceValue: 499, isFree: false,
    shortDescription: 'AI-powered tax query resolution with 98.5% accuracy on Indian tax law.',
    fullDescription: 'TaxBot Pro is India\'s most advanced AI tax assistant, trained on over 2 lakh tax judgments, circulars, and notifications. It provides instant answers to complex tax queries with source citations, making it indispensable for CAs and tax professionals.\n\nBuilt on a custom fine-tuned LLM specifically for Indian taxation, TaxBot Pro understands context across direct and indirect taxes. It can draft responses to notices, suggest tax-saving strategies, and even predict likely audit areas.\n\nWith seamless integration into VEYRO, all query responses are automatically saved to your client files for complete audit trails.',
    features: ['Trained on 2L+ Indian tax judgments', 'Instant query resolution with citations', 'Notice response drafting', 'Tax planning suggestions', 'VEYRO workspace integration'],
    iconColor: 'bg-emerald-500', iconInitials: 'TB',
    version: '3.2.1', lastUpdated: '28 Feb 2026',
    permissions: ['Client data read', 'Document generation', 'Email notifications'],
    appReviews: [
      { id: 'r1', userName: 'Rajesh Sharma', rating: 5, date: '12 Feb 2026', comment: 'Absolutely phenomenal! Saves me at least 2 hours daily on tax research. The citation feature is a game-changer.' },
      { id: 'r2', userName: 'Priya Venkatesh', rating: 4, date: '8 Feb 2026', comment: 'Great for quick lookups. Sometimes misses on very niche tribunal orders but overall excellent.' },
      { id: 'r3', userName: 'Amit Patel', rating: 5, date: '1 Feb 2026', comment: 'Best investment for my CA practice this year. Clients are impressed with the speed of responses.' },
    ],
    isFeatured: true, isNew: false, isOfficial: false,
  },
  {
    id: 'compliance-ai',
    name: 'Compliance AI',
    developer: 'DharmaTech Solutions',
    category: 'AI Agents',
    rating: 4.6, reviews: 876, downloads: 32100,
    price: '₹799/mo', priceValue: 799, isFree: false,
    shortDescription: 'Automated compliance monitoring across GST, Income Tax, and ROC filings.',
    fullDescription: 'Compliance AI continuously monitors your clients\' compliance status across multiple regulatory frameworks. It predicts upcoming deadlines, flags potential non-compliance areas, and generates actionable checklists.\n\nThe AI learns from your firm\'s filing patterns and client portfolio to provide personalized compliance calendars. It integrates with MCA, GSTN, and Income Tax portals for real-time status tracking.\n\nReduce your compliance oversight time by 70% and never miss a filing deadline again.',
    features: ['Multi-regulatory monitoring', 'Predictive deadline alerts', 'Auto-generated compliance reports', 'Portal integration (GSTN, MCA)', 'Firm-specific learning'],
    iconColor: 'bg-teal-500', iconInitials: 'CA',
    version: '2.8.0', lastUpdated: '22 Feb 2026',
    permissions: ['Client data read/write', 'Portal access', 'Notification sending'],
    appReviews: [
      { id: 'r4', userName: 'Sunita Reddy', rating: 5, date: '15 Feb 2026', comment: 'Never missed a deadline since installing. The predictive alerts are incredibly accurate.' },
      { id: 'r5', userName: 'Vikram Joshi', rating: 4, date: '10 Feb 2026', comment: 'Solid app, good integration. Wish it covered more state-specific compliances.' },
      { id: 'r6', userName: 'Deepa Nair', rating: 4, date: '3 Feb 2026', comment: 'Very useful for managing 100+ clients. Dashboard is clean and intuitive.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'smart-collections',
    name: 'Smart Collections',
    developer: 'ArthaIntell Labs',
    category: 'AI Agents',
    rating: 4.3, reviews: 534, downloads: 18700,
    price: '₹299/mo', priceValue: 299, isFree: false,
    shortDescription: 'AI-driven receivables management with automated follow-ups and payment prediction.',
    fullDescription: 'Smart Collections uses machine learning to predict which invoices are likely to be delayed and automates the follow-up process. It sends personalized reminders via email and WhatsApp, and provides a payment prediction score for each invoice.\n\nThe AI adapts its communication style based on client response patterns, ensuring professional yet effective follow-ups without damaging client relationships.',
    features: ['Payment delay prediction', 'Automated email/WhatsApp follow-ups', 'Client response tracking', 'Aging analysis dashboard', 'Payment prediction scores'],
    iconColor: 'bg-cyan-500', iconInitials: 'SC',
    version: '1.9.3', lastUpdated: '18 Feb 2026',
    permissions: ['Invoice data read', 'Email sending', 'WhatsApp integration'],
    appReviews: [
      { id: 'r7', userName: 'Karthik Iyer', rating: 4, date: '20 Feb 2026', comment: 'Reduced our outstanding by 40% in just 2 months. The WhatsApp integration is very effective.' },
      { id: 'r8', userName: 'Meera Desai', rating: 5, date: '14 Feb 2026', comment: 'Finally, a collections tool that doesn\'t annoy clients. Very professional follow-ups.' },
      { id: 'r9', userName: 'Rohit Gupta', rating: 4, date: '5 Feb 2026', comment: 'Good for small firms. Could use more reporting features.' },
    ],
    isFeatured: false, isNew: true, isOfficial: false,
  },
  {
    id: 'audit-assistant',
    name: 'Audit Assistant',
    developer: 'NavaShreshtha AI Pvt. Ltd.',
    category: 'AI Agents',
    rating: 4.5, reviews: 689, downloads: 24300,
    price: '₹999/mo', priceValue: 999, isFree: false,
    shortDescription: 'AI-powered audit automation — sampling, working papers, and risk assessment.',
    fullDescription: 'Audit Assistant streamlines the entire audit workflow from planning to reporting. It uses AI to identify high-risk areas, suggest audit procedures, and auto-generate working papers based on client financial data.\n\nThe risk assessment engine analyzes financial patterns to direct auditor attention where it matters most, improving audit quality while reducing time spent by 50%.',
    features: ['AI risk assessment', 'Auto sampling & selection', 'Working paper generation', 'Financial pattern analysis', 'Audit report drafting'],
    iconColor: 'bg-amber-500', iconInitials: 'AA',
    version: '2.5.0', lastUpdated: '25 Feb 2026',
    permissions: ['Financial data read', 'Document generation', 'Report creation'],
    appReviews: [
      { id: 'r10', userName: 'Anand Krishnan', rating: 5, date: '22 Feb 2026', comment: 'Revolutionary for audit firms. Working papers are 80% ready in minutes.' },
      { id: 'r11', userName: 'Kavita Bhatt', rating: 4, date: '16 Feb 2026', comment: 'Great for statutory audits. GST audit module could be improved.' },
      { id: 'r12', userName: 'Sanjay Mehta', rating: 4, date: '9 Feb 2026', comment: 'Saves significant time on documentation. Risk assessment is quite accurate.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  // HR
  {
    id: 'peoplehub-india',
    name: 'PeopleHub India',
    developer: 'PeopleFirst Tech India',
    category: 'HR',
    rating: 4.4, reviews: 932, downloads: 28500,
    price: '₹399/mo', priceValue: 399, isFree: false,
    shortDescription: 'Complete HR management built for Indian companies — hiring to retirement.',
    fullDescription: 'PeopleHub India is a comprehensive HR platform designed specifically for Indian businesses. From recruitment and onboarding to attendance, leave management, and exit processes — everything is covered.\n\nBuilt with Indian labor law compliance at its core, it automatically updates policies based on state-specific regulations and generates compliance reports.',
    features: ['Indian labor law compliant', 'Recruitment & onboarding', 'Attendance & leave management', 'Performance reviews', 'State-specific policy engine'],
    iconColor: 'bg-violet-500', iconInitials: 'PH',
    version: '4.1.2', lastUpdated: '20 Feb 2026',
    permissions: ['Employee data read/write', 'Calendar access', 'Email notifications'],
    appReviews: [
      { id: 'r13', userName: 'Neha Agarwal', rating: 5, date: '18 Feb 2026', comment: 'Best HR tool for Indian companies. The leave management alone saves hours.' },
      { id: 'r14', userName: 'Ravi Kumar', rating: 4, date: '11 Feb 2026', comment: 'Good overall. Performance review module needs more customization options.' },
      { id: 'r15', userName: 'Shalini Rao', rating: 4, date: '4 Feb 2026', comment: 'Our 200-person company runs on PeopleHub. Very reliable.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'leave-manager',
    name: 'Leave Manager',
    developer: 'WorkLife Solutions',
    category: 'HR',
    rating: 4.1, reviews: 456, downloads: 15200,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Smart leave management with Indian holiday calendar and policy automation.',
    fullDescription: 'Leave Manager simplifies leave tracking with built-in Indian holiday calendars for all states. It automatically applies your company\'s leave policies, handles carry-forward rules, and integrates with attendance systems.\n\nThe free tier supports up to 25 employees, making it perfect for small CA firms and startups.',
    features: ['State-wise holiday calendars', 'Auto leave policy enforcement', 'Carry-forward automation', 'Team availability view', 'WhatsApp approval flow'],
    iconColor: 'bg-lime-500', iconInitials: 'LM',
    version: '2.3.0', lastUpdated: '15 Feb 2026',
    permissions: ['Employee data read', 'Calendar access'],
    appReviews: [
      { id: 'r16', userName: 'Ashok Tiwari', rating: 4, date: '13 Feb 2026', comment: 'Simple and effective. The state holiday feature is very useful.' },
      { id: 'r17', userName: 'Pooja Singh', rating: 4, date: '7 Feb 2026', comment: 'Free tier is generous. Works well for our 15-person firm.' },
      { id: 'r18', userName: 'Manoj Deshmukh', rating: 3, date: '1 Feb 2026', comment: 'Good basic app. Needs more reporting features for larger teams.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'attendance-tracker',
    name: 'Attendance Tracker',
    developer: 'WorkLife Solutions',
    category: 'HR',
    rating: 3.9, reviews: 321, downloads: 8900,
    price: '₹99/mo', priceValue: 99, isFree: false,
    shortDescription: 'GPS-based attendance with geofencing for field and office teams.',
    fullDescription: 'Attendance Tracker provides reliable GPS-based attendance marking with geofencing capabilities. Perfect for firms with field teams, it ensures accurate time tracking with location verification.\n\nSupports biometric integration, face recognition, and standard check-in/check-out with automatic overtime calculation as per Indian labor laws.',
    features: ['GPS + geofence attendance', 'Biometric integration', 'Face recognition support', 'Overtime auto-calculation', 'Multi-location support'],
    iconColor: 'bg-orange-500', iconInitials: 'AT',
    version: '1.7.2', lastUpdated: '10 Feb 2026',
    permissions: ['Location access', 'Camera access', 'Employee data read'],
    appReviews: [
      { id: 'r19', userName: 'Dinesh Yadav', rating: 4, date: '9 Feb 2026', comment: 'Geofencing works well. Reduced proxy attendance to zero.' },
      { id: 'r20', userName: 'Swati Pandey', rating: 3, date: '2 Feb 2026', comment: 'GPS can be inaccurate indoors. Face recognition is better.' },
      { id: 'r21', userName: 'Raj Malhotra', rating: 4, date: '28 Jan 2026', comment: 'Good value at ₹99/month. Does the job reliably.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  // Payroll
  {
    id: 'payrollpro',
    name: 'PayrollPro',
    developer: 'SalaryStack Technologies',
    category: 'Payroll',
    rating: 4.7, reviews: 1567, downloads: 42100,
    price: '₹599/mo', priceValue: 599, isFree: false,
    shortDescription: 'India\'s #1 payroll software — auto PF, ESI, TDS, and salary processing.',
    fullDescription: 'PayrollPro handles end-to-end payroll processing for Indian companies with automated PF, ESI, TDS, and professional tax calculations. It supports all salary structures including CTC-based, grade-based, and custom components.\n\nOne-click payroll processing generates payslips, bank advice, and all statutory returns. Integration with major banks ensures seamless salary credits.',
    features: ['Auto PF/ESI/TDS calculation', 'All salary structures', 'One-click processing', 'Bank integration', 'Statutory return generation'],
    iconColor: 'bg-green-500', iconInitials: 'PP',
    version: '5.0.3', lastUpdated: '26 Feb 2026',
    permissions: ['Employee data read/write', 'Bank account access', 'Government portal access'],
    appReviews: [
      { id: 'r22', userName: 'Vishal Kapoor', rating: 5, date: '24 Feb 2026', comment: 'Processing payroll for 500+ employees in 10 minutes. Unbelievable.' },
      { id: 'r23', userName: 'Lakshmi Subramaniam', rating: 5, date: '17 Feb 2026', comment: 'Statutory compliance is spot-on. Never had an error in PF/ESI filing.' },
      { id: 'r24', userName: 'Gaurav Jain', rating: 4, date: '10 Feb 2026', comment: 'Excellent for regular payroll. Reimbursement module could be smoother.' },
    ],
    isFeatured: true, isNew: false, isOfficial: false,
  },
  {
    id: 'salarybox',
    name: 'SalaryBox',
    developer: 'SalaryStack Technologies',
    category: 'Payroll',
    rating: 4.2, reviews: 678, downloads: 19800,
    price: '₹199/mo', priceValue: 199, isFree: false,
    shortDescription: 'Lightweight payroll for small firms — simple, fast, compliant.',
    fullDescription: 'SalaryBox is the simplified payroll solution for firms with up to 50 employees. It handles basic salary processing with PF and TDS deductions without the complexity of enterprise payroll systems.\n\nPerfect for CA firms, small businesses, and startups who need compliant payroll without the overhead.',
    features: ['Simple salary processing', 'PF & TDS compliance', 'Payslip generation', 'Bank advice creation', 'Annual return preparation'],
    iconColor: 'bg-emerald-400', iconInitials: 'SB',
    version: '2.1.0', lastUpdated: '19 Feb 2026',
    permissions: ['Employee data read', 'Document generation'],
    appReviews: [
      { id: 'r25', userName: 'Nitin Bhatt', rating: 4, date: '16 Feb 2026', comment: 'Perfect for our 20-person firm. Clean and simple.' },
      { id: 'r26', userName: 'Rashmi Kulkarni', rating: 4, date: '9 Feb 2026', comment: 'Does what it promises. No unnecessary features.' },
      { id: 'r27', userName: 'Arun Nair', rating: 5, date: '3 Feb 2026', comment: 'Replaced our Excel-based payroll. Much better compliance tracking.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'pf-esi-compliance',
    name: 'PF/ESI Compliance',
    developer: 'ShramSetu Infotech',
    category: 'Payroll',
    rating: 4.5, reviews: 445, downloads: 16200,
    price: '₹349/mo', priceValue: 349, isFree: false,
    shortDescription: 'Dedicated PF & ESI compliance management with portal integration.',
    fullDescription: 'PF/ESI Compliance is a specialized tool for managing Provident Fund and Employee State Insurance obligations. It handles monthly contributions, annual returns, and employee claims with direct EPFO/ESIC portal integration.\n\nAuto-reconciliation with challans ensures your books always match government records.',
    features: ['EPFO portal integration', 'ESIC portal integration', 'Challan auto-reconciliation', 'Claim management', 'Annual return filing'],
    iconColor: 'bg-sky-500', iconInitials: 'PF',
    version: '3.4.1', lastUpdated: '23 Feb 2026',
    permissions: ['Employee data read/write', 'Government portal access', 'Bank verification'],
    appReviews: [
      { id: 'r28', userName: 'Mahesh Iyer', rating: 5, date: '21 Feb 2026', comment: 'Finally, PF reconciliation that actually works. Saved me 3 days every month.' },
      { id: 'r29', userName: 'Sangeeta Roy', rating: 4, date: '14 Feb 2026', comment: 'Good for PF. ESI module needs some improvements.' },
      { id: 'r30', userName: 'Pradeep Saxena', rating: 5, date: '7 Feb 2026', comment: 'Portal integration is seamless. No more manual data entry.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  // Banking
  {
    id: 'banksync',
    name: 'BankSync',
    developer: 'FinConnect India',
    category: 'Banking',
    rating: 4.6, reviews: 1102, downloads: 35600,
    price: '₹299/mo', priceValue: 299, isFree: false,
    shortDescription: 'Real-time bank feed integration with 200+ Indian banks and auto-reconciliation.',
    fullDescription: 'BankSync connects to over 200 Indian banks including SBI, HDFC, ICICI, and all cooperative banks. It provides real-time transaction feeds, auto-categorization, and seamless reconciliation with your VEYRO books.\n\nSmart matching algorithms handle one-to-many and many-to-one matches with 95%+ accuracy.',
    features: ['200+ Indian bank connections', 'Real-time transaction feeds', 'Auto-categorization', 'Smart reconciliation matching', 'Multi-account dashboard'],
    iconColor: 'bg-blue-500', iconInitials: 'BS',
    version: '4.2.0', lastUpdated: '27 Feb 2026',
    permissions: ['Bank account access', 'Transaction data read', 'Reconciliation data write'],
    appReviews: [
      { id: 'r31', userName: 'Suresh Menon', rating: 5, date: '25 Feb 2026', comment: 'Reconciliation time cut from 2 days to 2 hours. Incredible accuracy.' },
      { id: 'r32', userName: 'Anita Sharma', rating: 4, date: '18 Feb 2026', comment: 'Works great with major banks. Some cooperative banks have delayed feeds.' },
      { id: 'r33', userName: 'Kiran Patil', rating: 5, date: '11 Feb 2026', comment: 'Best bank integration tool in India. Period.' },
    ],
    isFeatured: true, isNew: false, isOfficial: false,
  },
  {
    id: 'upi-collector',
    name: 'UPI Collector',
    developer: 'FinConnect India',
    category: 'Banking',
    rating: 4.3, reviews: 789, downloads: 27400,
    price: '₹149/mo', priceValue: 149, isFree: false,
    shortDescription: 'Accept UPI payments from clients with auto-reconciliation and receipt generation.',
    fullDescription: 'UPI Collector enables your firm to accept payments via UPI with automatic receipt generation and book reconciliation. Generate dynamic QR codes per invoice, track payment status in real-time, and auto-mark invoices as paid.\n\nSupports all major UPI apps including GPay, PhonePe, Paytm, and BHIM.',
    features: ['Dynamic QR per invoice', 'All UPI apps supported', 'Auto receipt generation', 'Real-time payment tracking', 'Invoice auto-marking'],
    iconColor: 'bg-purple-500', iconInitials: 'UC',
    version: '2.6.1', lastUpdated: '21 Feb 2026',
    permissions: ['Invoice data read', 'Payment processing', 'Receipt generation'],
    appReviews: [
      { id: 'r34', userName: 'Harish Chandra', rating: 4, date: '19 Feb 2026', comment: 'Clients love the UPI payment option. Collections improved by 30%.' },
      { id: 'r35', userName: 'Geeta Rani', rating: 5, date: '12 Feb 2026', comment: 'Auto-reconciliation with invoices is a blessing. No manual matching needed.' },
      { id: 'r36', userName: 'Satish Verma', rating: 4, date: '5 Feb 2026', comment: 'Works well. Wish it supported international UPI payments too.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'loan-connect',
    name: 'Loan Connect',
    developer: 'CreditBridge India',
    category: 'Banking',
    rating: 3.8, reviews: 234, downloads: 5600,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Connect your clients with pre-approved business loans from 15+ NBFCs.',
    fullDescription: 'Loan Connect bridges the gap between your clients\' financial data and lending institutions. With client consent, it shares verified financial data with 15+ NBFCs and banks to get pre-approved loan offers.\n\nEarn referral commissions on successful loan disbursements while helping your clients access working capital.',
    features: ['15+ NBFC/bank partners', 'Pre-approved loan offers', 'Verified data sharing', 'Referral commission tracking', 'EMI calculator'],
    iconColor: 'bg-rose-500', iconInitials: 'LC',
    version: '1.4.0', lastUpdated: '14 Feb 2026',
    permissions: ['Client financial data read', 'Loan application submission'],
    appReviews: [
      { id: 'r37', userName: 'Bharat Shah', rating: 4, date: '10 Feb 2026', comment: 'Good referral income. Clients appreciate the loan options.' },
      { id: 'r38', userName: 'Neena Gupta', rating: 3, date: '3 Feb 2026', comment: 'Limited NBFC options currently. Hope they add more partners.' },
      { id: 'r39', userName: 'Dheeraj Bansal', rating: 4, date: '27 Jan 2026', comment: 'Nice concept. Referral tracking is transparent.' },
    ],
    isFeatured: false, isNew: true, isOfficial: false,
  },
  // Insurance
  {
    id: 'insureflow',
    name: 'InsureFlow',
    developer: 'PolicyPeak India',
    category: 'Insurance',
    rating: 4.2, reviews: 567, downloads: 14300,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Group insurance management for Indian businesses — health, life, and liability.',
    fullDescription: 'InsureFlow manages group insurance policies for businesses including health, life, and professional liability (E&O) coverage. Track premiums, manage claims, and ensure your firm and clients are always covered.\n\nCompare quotes from 20+ Indian insurers and manage renewals with automated reminders.',
    features: ['20+ insurer comparison', 'Group policy management', 'Claim tracking', 'Renewal reminders', 'E&O insurance for CAs'],
    iconColor: 'bg-indigo-400', iconInitials: 'IF',
    version: '2.0.5', lastUpdated: '17 Feb 2026',
    permissions: ['Insurance data read', 'Employee data read', 'Notification sending'],
    appReviews: [
      { id: 'r40', userName: 'Jayaram Iyer', rating: 4, date: '15 Feb 2026', comment: 'Found a 30% cheaper group health policy through InsureFlow. Great comparison tool.' },
      { id: 'r41', userName: 'Sudha Menon', rating: 5, date: '8 Feb 2026', comment: 'E&O insurance for CAs — finally someone thought of this!' },
      { id: 'r42', userName: 'Tarun Agarwal', rating: 4, date: '1 Feb 2026', comment: 'Good for managing client insurance too. Renewal alerts are very helpful.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'policy-manager',
    name: 'Policy Manager',
    developer: 'PolicyPeak India',
    category: 'Insurance',
    rating: 3.9, reviews: 234, downloads: 6700,
    price: '₹199/mo', priceValue: 199, isFree: false,
    shortDescription: 'Centralized insurance policy management with document vault and renewal tracking.',
    fullDescription: 'Policy Manager provides a centralized vault for all your insurance policies — personal and business. Upload policy documents, track coverage, manage beneficiaries, and never miss a renewal.\n\nSmart analysis identifies coverage gaps and suggests optimal coverage levels based on your business profile.',
    features: ['Policy document vault', 'Coverage gap analysis', 'Renewal auto-tracking', 'Beneficiary management', 'Coverage optimization'],
    iconColor: 'bg-pink-500', iconInitials: 'PM',
    version: '1.8.0', lastUpdated: '12 Feb 2026',
    permissions: ['Document storage', 'Email notifications'],
    appReviews: [
      { id: 'r43', userName: 'Ramesh Kulkarni', rating: 4, date: '9 Feb 2026', comment: 'All policies in one place. No more searching through emails.' },
      { id: 'r44', userName: 'Veena Nair', rating: 3, date: '2 Feb 2026', comment: 'Basic but functional. Needs better mobile support.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'claim-tracker',
    name: 'Claim Tracker',
    developer: 'SettleFast Technologies',
    category: 'Insurance',
    rating: 4.0, reviews: 189, downloads: 4200,
    price: '₹149/mo', priceValue: 149, isFree: false,
    shortDescription: 'End-to-end insurance claim tracking with status updates and document management.',
    fullDescription: 'Claim Tracker simplifies the insurance claims process with step-by-step guidance, document checklists, and real-time status tracking. It supports health, life, motor, and professional liability claims.\n\nEscalation features ensure stuck claims get attention, and the knowledge base helps navigate complex claim processes.',
    features: ['Multi-claim type support', 'Real-time status tracking', 'Document checklist', 'Escalation management', 'Claim knowledge base'],
    iconColor: 'bg-fuchsia-500', iconInitials: 'CT',
    version: '1.3.2', lastUpdated: '8 Feb 2026',
    permissions: ['Claim data read/write', 'Document storage', 'Email notifications'],
    appReviews: [
      { id: 'r45', userName: 'Sanjay Dubey', rating: 4, date: '5 Feb 2026', comment: 'Tracking claims is so much easier now. Good escalation feature.' },
      { id: 'r46', userName: 'Ritu Sharma', rating: 4, date: '29 Jan 2026', comment: 'Helpful for managing multiple claims simultaneously.' },
    ],
    isFeatured: false, isNew: true, isOfficial: false,
  },
  // Legal
  {
    id: 'notice-responder',
    name: 'NoticeResponder',
    developer: 'LegalEdge India',
    category: 'Legal',
    rating: 4.5, reviews: 678, downloads: 21300,
    price: '₹699/mo', priceValue: 699, isFree: false,
    shortDescription: 'AI-assisted legal notice response drafting with template library and tracking.',
    fullDescription: 'NoticeResponder helps CAs and tax professionals draft responses to notices from IT, GST, and ROC authorities. It provides a curated library of 500+ response templates, AI-assisted drafting, and a tracking system for all notices.\n\nEach response is backed by relevant case law citations and statutory provisions, ensuring professional quality.',
    features: ['500+ response templates', 'AI-assisted drafting', 'Case law citations', 'Notice tracking system', 'Multi-authority support'],
    iconColor: 'bg-slate-600', iconInitials: 'NR',
    version: '3.1.0', lastUpdated: '24 Feb 2026',
    permissions: ['Notice data read/write', 'Document generation', 'Email notifications'],
    appReviews: [
      { id: 'r47', userName: 'Mohan Rangan', rating: 5, date: '22 Feb 2026', comment: 'Templates are excellent. Saves at least 3-4 hours per notice response.' },
      { id: 'r48', userName: 'Asha Bhat', rating: 4, date: '15 Feb 2026', comment: 'Good coverage of IT and GST notices. ROC section is growing.' },
      { id: 'r49', userName: 'Dilip Joshi', rating: 5, date: '8 Feb 2026', comment: 'The case law citations make our responses much stronger.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'contractai',
    name: 'ContractAI',
    developer: 'LegalEdge India',
    category: 'Legal',
    rating: 4.3, reviews: 423, downloads: 15600,
    price: '₹499/mo', priceValue: 499, isFree: false,
    shortDescription: 'AI contract analysis, review, and drafting for Indian business agreements.',
    fullDescription: 'ContractAI analyzes, reviews, and drafts business contracts using AI trained on Indian contract law. It identifies risky clauses, suggests improvements, and ensures compliance with Indian Contract Act and relevant regulations.\n\nFrom NDAs to service agreements, get lawyer-quality contract management at a fraction of the cost.',
    features: ['AI clause risk analysis', 'Indian contract law trained', 'Auto-drafting from terms', 'Clause library (500+)', 'Version comparison'],
    iconColor: 'bg-stone-500', iconInitials: 'CI',
    version: '2.4.0', lastUpdated: '19 Feb 2026',
    permissions: ['Contract data read/write', 'Document generation'],
    appReviews: [
      { id: 'r50', userName: 'Prakash Menon', rating: 4, date: '16 Feb 2026', comment: 'Risk analysis is impressive. Catches clauses I would have missed.' },
      { id: 'r51', userName: 'Rekha Patel', rating: 5, date: '9 Feb 2026', comment: 'Drafted a service agreement in 15 minutes. Lawyer-quality output.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'roc-filer',
    name: 'ROC Filer',
    developer: 'ComplianceBridge India',
    category: 'Legal',
    rating: 4.1, reviews: 345, downloads: 11200,
    price: '₹399/mo', priceValue: 399, isFree: false,
    shortDescription: 'Automated ROC filing — annual returns, charge creation, and company law compliance.',
    fullDescription: 'ROC Filer handles all MCA/ROC filings including annual returns (AOC-4, MGT-7), charge creation/satisfaction, director KYC, and company incorporation forms.\n\nPre-filling from your VEYRO data reduces manual entry by 80%, and built-in validation ensures error-free submissions.',
    features: ['AOC-4 & MGT-7 auto-fill', 'Charge creation/filing', 'Director KYC management', 'Form validation engine', 'MCA portal integration'],
    iconColor: 'bg-red-500', iconInitials: 'RF',
    version: '2.7.0', lastUpdated: '21 Feb 2026',
    permissions: ['Company data read', 'MCA portal access', 'Document generation'],
    appReviews: [
      { id: 'r52', userName: 'Anil Saxena', rating: 4, date: '18 Feb 2026', comment: 'AOC-4 filing used to take a full day. Now it\'s done in an hour.' },
      { id: 'r53', userName: 'Kamini Rao', rating: 4, date: '11 Feb 2026', comment: 'Form validation catches errors before submission. Very reliable.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  // Tax Automation
  {
    id: 'tds-master',
    name: 'TDS Master',
    developer: 'TaxAuto India',
    category: 'Tax Automation',
    rating: 4.7, reviews: 1234, downloads: 38900,
    price: '₹499/mo', priceValue: 499, isFree: false,
    shortDescription: 'Complete TDS management — deduction, challan, return filing, and certificate generation.',
    fullDescription: 'TDS Master is the most comprehensive TDS management tool for Indian businesses. It handles deduction calculation, challan generation, quarterly return filing (24Q, 26Q, 27Q, 27EQ), and Form 16/16A certificate generation.\n\nAuto-matching with Form 26AS and AIS ensures deductions are correctly captured, and TRACES integration provides real-time compliance status.',
    features: ['Auto TDS calculation', 'Challan generation', 'Quarterly return filing', 'Form 16/16A generation', '26AS/AIS auto-matching'],
    iconColor: 'bg-emerald-600', iconInitials: 'TM',
    version: '4.5.2', lastUpdated: '26 Feb 2026',
    permissions: ['Financial data read/write', 'TRACES access', 'Government portal access'],
    appReviews: [
      { id: 'r54', userName: 'Srinivas Murthy', rating: 5, date: '24 Feb 2026', comment: 'TDS returns that used to take days now take hours. 26AS matching is flawless.' },
      { id: 'r55', userName: 'Pankaj Verma', rating: 5, date: '17 Feb 2026', comment: 'Form 16 generation for 300+ employees in one click. Amazing.' },
      { id: 'r56', userName: 'Shobha Rani', rating: 4, date: '10 Feb 2026', comment: 'Very good tool. Minor UI issues but functionality is top-notch.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'gst-optimizer',
    name: 'GST Optimizer',
    developer: 'TaxAuto India',
    category: 'Tax Automation',
    rating: 4.4, reviews: 567, downloads: 19800,
    price: '₹599/mo', priceValue: 599, isFree: false,
    shortDescription: 'AI-powered GST optimization — identify savings, avoid penalties, and maximize compliance.',
    fullDescription: 'GST Optimizer analyzes your GST data to identify potential savings, flag compliance risks, and optimize your tax position. It uses AI to find legitimate ITC claims you might be missing and ensures you\'re on the optimal composition scheme if applicable.\n\nThe penalty prevention engine checks all filings for common errors before submission.',
    features: ['ITC optimization engine', 'Composition scheme analyzer', 'Penalty prevention checks', 'Savings opportunity finder', 'Filing error detection'],
    iconColor: 'bg-teal-600', iconInitials: 'GO',
    version: '3.0.1', lastUpdated: '23 Feb 2026',
    permissions: ['GST data read', 'Filing data read/write', 'Client data read'],
    appReviews: [
      { id: 'r57', userName: 'Rajeev Khanna', rating: 5, date: '20 Feb 2026', comment: 'Found ₹3.5 lakh in missed ITC claims for one client. Paid for itself in a day.' },
      { id: 'r58', userName: 'Divya Iyer', rating: 4, date: '13 Feb 2026', comment: 'Penalty prevention has saved us multiple times. Very reliable.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'itc-maximizer',
    name: 'ITC Maximizer',
    developer: 'CreditFlow Technologies',
    category: 'Tax Automation',
    rating: 4.6, reviews: 890, downloads: 28700,
    price: '₹799/mo', priceValue: 799, isFree: false,
    shortDescription: 'Maximize Input Tax Credit claims with intelligent matching and gap analysis.',
    fullDescription: 'ITC Maximizer is a specialized tool for maximizing GST Input Tax Credit claims. It performs deep analysis of GSTR-2A/2B data against purchase registers to identify every eligible credit claim.\n\nThe gap analysis feature highlights ITC that\'s being missed, with root cause analysis showing whether it\'s a supplier filing issue, mismatch, or timing difference.',
    features: ['GSTR-2A/2B deep analysis', 'ITC gap identification', 'Root cause analysis', 'Supplier follow-up automation', 'Credit claim optimization'],
    iconColor: 'bg-green-600', iconInitials: 'IM',
    version: '3.3.0', lastUpdated: '25 Feb 2026',
    permissions: ['GST data read', 'Supplier data read', 'Email notifications'],
    appReviews: [
      { id: 'r59', userName: 'Venkat Raman', rating: 5, date: '23 Feb 2026', comment: 'Recovered ₹8 lakh in missed ITC in the first month alone.' },
      { id: 'r60', userName: 'Anjali Kapoor', rating: 5, date: '16 Feb 2026', comment: 'The gap analysis is incredible. Shows exactly where ITC is being lost.' },
      { id: 'r61', userName: 'Dharmesh Shah', rating: 4, date: '9 Feb 2026', comment: 'Very powerful tool. Learning curve is a bit steep but worth it.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  // Analytics
  {
    id: 'profitpulse',
    name: 'ProfitPulse',
    developer: 'InsightMetrics India',
    category: 'Analytics',
    rating: 4.5, reviews: 678, downloads: 22100,
    price: '₹399/mo', priceValue: 399, isFree: false,
    shortDescription: 'Real-time profitability analytics for CA firms — client, service, and team level.',
    fullDescription: 'ProfitPulse gives CA firms real-time visibility into profitability at every level — by client, by service, by team member, and by time period. It automatically calculates realization rates, WIP value, and profit margins.\n\nAI-powered insights identify which clients are most profitable, which services have the best margins, and where time is being spent inefficiently.',
    features: ['Client-level profitability', 'Service margin analysis', 'Team realization tracking', 'WIP valuation', 'AI profitability insights'],
    iconColor: 'bg-amber-600', iconInitials: 'PP',
    version: '3.1.0', lastUpdated: '22 Feb 2026',
    permissions: ['Financial data read', 'Time tracking data', 'Client data read'],
    appReviews: [
      { id: 'r62', userName: 'Siddharth Das', rating: 5, date: '20 Feb 2026', comment: 'Discovered 30% of our clients were unprofitable. Game-changing insights.' },
      { id: 'r63', userName: 'Nisha Kapoor', rating: 4, date: '13 Feb 2026', comment: 'Good analytics. Wish the mobile dashboard was more detailed.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'cashflow-ai',
    name: 'CashFlow AI',
    developer: 'InsightMetrics India',
    category: 'Analytics',
    rating: 4.3, reviews: 456, downloads: 16800,
    price: '₹299/mo', priceValue: 299, isFree: false,
    shortDescription: 'AI-powered cash flow forecasting and management for professional services.',
    fullDescription: 'CashFlow AI predicts your firm\'s cash flow for the next 90 days using AI models trained on your historical patterns. It factors in seasonal variations (tax season peaks), client payment behavior, and pending invoices.\n\nEarly warning alerts notify you of potential cash crunches 30 days in advance, giving you time to act.',
    features: ['90-day cash flow forecast', 'Seasonal pattern recognition', 'Payment behavior analysis', 'Cash crunch early warnings', 'Scenario planning'],
    iconColor: 'bg-cyan-600', iconInitials: 'CF',
    version: '2.5.0', lastUpdated: '18 Feb 2026',
    permissions: ['Financial data read', 'Invoice data read', 'Bank data access'],
    appReviews: [
      { id: 'r64', userName: 'Ganesh Iyer', rating: 4, date: '15 Feb 2026', comment: 'Forecasts are surprisingly accurate. Helped us plan for tax season hiring.' },
      { id: 'r65', userName: 'Preeti Bhatt', rating: 5, date: '8 Feb 2026', comment: 'Early warning saved us from a cash crunch in December. Indispensable.' },
    ],
    isFeatured: false, isNew: true, isOfficial: false,
  },
  {
    id: 'benchmarkpro',
    name: 'BenchmarkPro',
    developer: 'MetricStack India',
    category: 'Analytics',
    rating: 4.1, reviews: 312, downloads: 9400,
    price: '₹499/mo', priceValue: 499, isFree: false,
    shortDescription: 'Firm performance benchmarking against 10,000+ Indian CA firms.',
    fullDescription: 'BenchmarkPro compares your firm\'s performance metrics against a database of 10,000+ Indian CA firms. See how you rank on revenue per employee, client retention, filing speed, and 50+ other KPIs.\n\nAnonymized data ensures privacy while providing meaningful peer comparisons and improvement recommendations.',
    features: ['10,000+ firm database', '50+ KPI comparisons', 'Peer group benchmarking', 'Improvement recommendations', 'Quarterly trend reports'],
    iconColor: 'bg-orange-600', iconInitials: 'BP',
    version: '2.2.0', lastUpdated: '16 Feb 2026',
    permissions: ['Firm metrics read', 'Anonymized data sharing'],
    appReviews: [
      { id: 'r66', userName: 'Vivek Sharma', rating: 4, date: '12 Feb 2026', comment: 'Interesting to see where we stand. Revenue per employee insight was eye-opening.' },
      { id: 'r67', userName: 'Meena Subramaniam', rating: 4, date: '5 Feb 2026', comment: 'Good for strategic planning. Recommendations are actionable.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  // CRM
  {
    id: 'clienthub',
    name: 'ClientHub',
    developer: 'RelatePro India',
    category: 'CRM',
    rating: 4.6, reviews: 890, downloads: 26400,
    price: '₹349/mo', priceValue: 349, isFree: false,
    shortDescription: 'Client relationship management built for Indian CA and tax firms.',
    fullDescription: 'ClientHub is a CRM specifically designed for Indian CA and tax firms. It tracks client interactions, manages service agreements, handles renewal reminders, and provides a 360-degree client view integrated with VEYRO data.\n\nAutomated communication workflows ensure no client is neglected, and the referral tracking system helps grow your practice.',
    features: ['360-degree client view', 'Service agreement tracking', 'Renewal automation', 'Referral tracking', 'Communication workflows'],
    iconColor: 'bg-emerald-700', iconInitials: 'CH',
    version: '3.4.0', lastUpdated: '24 Feb 2026',
    permissions: ['Client data read/write', 'Email integration', 'Calendar access'],
    appReviews: [
      { id: 'r68', userName: 'Arvind Kejriwal', rating: 5, date: '22 Feb 2026', comment: 'Best CRM for CAs. Period. The VEYRO integration is seamless.' },
      { id: 'r69', userName: 'Supriya Pathak', rating: 4, date: '15 Feb 2026', comment: 'Great for managing 200+ clients. Renewal tracking alone justifies the price.' },
      { id: 'r70', userName: 'Farhan Sheikh', rating: 5, date: '8 Feb 2026', comment: 'Referral tracking helped us grow 25% this year. Excellent tool.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'lead-engine',
    name: 'Lead Engine',
    developer: 'GrowStack India',
    category: 'CRM',
    rating: 4.2, reviews: 456, downloads: 14200,
    price: '₹249/mo', priceValue: 249, isFree: false,
    shortDescription: 'Lead generation and nurturing for professional services firms.',
    fullDescription: 'Lead Engine helps CA and tax firms generate and nurture leads through multiple channels — website, WhatsApp, Google Business, and referrals. It provides a visual pipeline, automated follow-ups, and conversion tracking.\n\nBuilt-in landing page templates optimized for tax and compliance services get you started in minutes.',
    features: ['Multi-channel lead capture', 'Visual pipeline management', 'Automated follow-ups', 'Landing page builder', 'Conversion analytics'],
    iconColor: 'bg-teal-700', iconInitials: 'LE',
    version: '2.1.0', lastUpdated: '20 Feb 2026',
    permissions: ['Lead data read/write', 'Email/WhatsApp integration', 'Website analytics'],
    appReviews: [
      { id: 'r71', userName: 'Chirag Patel', rating: 4, date: '17 Feb 2026', comment: 'Getting 15-20 new leads per month. Pipeline view is excellent.' },
      { id: 'r72', userName: 'Bindu Nair', rating: 4, date: '10 Feb 2026', comment: 'Landing page templates saved us ₹50K in web design costs.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'retentionai',
    name: 'RetentionAI',
    developer: 'GrowStack India',
    category: 'CRM',
    rating: 4.0, reviews: 234, downloads: 7800,
    price: '₹199/mo', priceValue: 199, isFree: false,
    shortDescription: 'AI-powered client retention — predict churn risk and take proactive action.',
    fullDescription: 'RetentionAI analyzes client behavior patterns to predict churn risk before it happens. It identifies clients who may leave based on engagement metrics, payment patterns, and service usage.\n\nAutomated retention campaigns with personalized outreach help you save at-risk relationships before they become problems.',
    features: ['Churn risk prediction', 'Behavioral analysis', 'Automated retention campaigns', 'Personalized outreach', 'Win-back strategies'],
    iconColor: 'bg-lime-600', iconInitials: 'RA',
    version: '1.6.0', lastUpdated: '14 Feb 2026',
    permissions: ['Client data read', 'Email/WhatsApp integration', 'Usage analytics'],
    appReviews: [
      { id: 'r73', userName: 'Nandakumar Menon', rating: 4, date: '11 Feb 2026', comment: 'Saved 3 at-risk clients last quarter. Predictions are quite accurate.' },
      { id: 'r74', userName: 'Shilpa Reddy', rating: 4, date: '4 Feb 2026', comment: 'Good concept. Needs more integrations for better predictions.' },
    ],
    isFeatured: false, isNew: true, isOfficial: false,
  },
  // Industry Solutions
  {
    id: 'retailos',
    name: 'RetailOS',
    developer: 'IndustryStack India',
    category: 'Industry Solutions',
    rating: 4.4, reviews: 567, downloads: 18500,
    price: '₹699/mo', priceValue: 699, isFree: false,
    shortDescription: 'Complete retail business OS — billing, inventory, GST compliance, and analytics.',
    fullDescription: 'RetailOS is an end-to-end operating system for retail businesses. It handles billing, inventory management, GST compliance, and provides deep analytics — all from one platform.\n\nDesigned for kirana stores to mid-size retailers, it supports barcode scanning, multi-location inventory, and automatic GST calculation on every transaction.',
    features: ['GST-compliant billing', 'Multi-location inventory', 'Barcode scanning', 'Automatic GST calculation', 'Retail analytics dashboard'],
    iconColor: 'bg-rose-600', iconInitials: 'RO',
    version: '3.8.0', lastUpdated: '25 Feb 2026',
    permissions: ['Inventory data read/write', 'Billing data', 'GST data read'],
    appReviews: [
      { id: 'r75', userName: 'Rakesh Gupta', rating: 5, date: '23 Feb 2026', comment: 'Running 3 stores on RetailOS. GST billing is flawless.' },
      { id: 'r76', userName: 'Suman Agarwal', rating: 4, date: '16 Feb 2026', comment: 'Great for our supermarket. Inventory management is very capable.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'manufacturing-suite',
    name: 'Manufacturing Suite',
    developer: 'IndustryStack India',
    category: 'Industry Solutions',
    rating: 4.1, reviews: 345, downloads: 11200,
    price: '₹999/mo', priceValue: 999, isFree: false,
    shortDescription: 'Manufacturing compliance and cost accounting with job-work tracking.',
    fullDescription: 'Manufacturing Suite handles the unique compliance requirements of manufacturing businesses including job-work tracking, excise legacy data, cost accounting, and production planning.\n\nGST compliance for manufacturers with reverse charge, job-work, and multi-state operations is fully automated.',
    features: ['Job-work tracking', 'Cost accounting module', 'Production planning', 'RCM automation', 'Multi-state compliance'],
    iconColor: 'bg-slate-700', iconInitials: 'MS',
    version: '2.5.0', lastUpdated: '21 Feb 2026',
    permissions: ['Production data read', 'Inventory data read/write', 'GST data read'],
    appReviews: [
      { id: 'r77', userName: 'Mukesh Patel', rating: 4, date: '18 Feb 2026', comment: 'Job-work tracking is excellent. Finally got our RCM compliance sorted.' },
      { id: 'r78', userName: 'Lata Deshmukh', rating: 4, date: '11 Feb 2026', comment: 'Good for mid-size manufacturers. Cost accounting module is comprehensive.' },
    ],
    isFeatured: false, isNew: false, isOfficial: false,
  },
  {
    id: 'healthcare-billing',
    name: 'Healthcare Billing',
    developer: 'MediStack India',
    category: 'Industry Solutions',
    rating: 3.8, reviews: 198, downloads: 5600,
    price: '₹499/mo', priceValue: 499, isFree: false,
    shortDescription: 'Specialized billing and compliance for hospitals, clinics, and diagnostic labs.',
    fullDescription: 'Healthcare Billing provides specialized GST billing and compliance for healthcare providers. It handles the complex tax rules around healthcare services, medicines, and diagnostic procedures.\n\nInsurance claim billing, patient management, and regulatory compliance are all integrated into one platform.',
    features: ['Healthcare-specific GST billing', 'Insurance claim integration', 'Patient billing management', 'Regulatory compliance', 'Diagnostic lab billing'],
    iconColor: 'bg-red-600', iconInitials: 'HB',
    version: '1.9.0', lastUpdated: '17 Feb 2026',
    permissions: ['Patient billing data', 'Insurance data', 'GST data read'],
    appReviews: [
      { id: 'r79', userName: 'Dr. Prakash Rao', rating: 4, date: '14 Feb 2026', comment: 'Finally, billing software that understands healthcare GST rules.' },
      { id: 'r80', userName: 'Nisha Mathur', rating: 3, date: '7 Feb 2026', comment: 'Good start. Needs more hospital management integration features.' },
    ],
    isFeatured: false, isNew: true, isOfficial: false,
  },
]

const OFFICIAL_APPS: StoreApp[] = [
  {
    id: 'gstpilot-ai-copilot',
    name: 'VEYRO AI Copilot',
    developer: 'VEYRO Official',
    category: 'AI Agents',
    rating: 4.9, reviews: 2345, downloads: 50000,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Your AI-powered business assistant — ask anything about GST, taxes, and compliance.',
    fullDescription: 'The official VEYRO AI Copilot is your intelligent business assistant. Ask questions in plain English or Hindi, get instant answers with citations, and automate routine tasks with natural language commands.\n\nDeeply integrated with all VEYRO modules, it provides contextual assistance across your entire workflow.',
    features: ['Natural language queries', 'Hindi & English support', 'Cross-module integration', 'Task automation', 'Context-aware assistance'],
    iconColor: 'bg-emerald-600', iconInitials: 'GP',
    version: '5.0.0', lastUpdated: '28 Feb 2026',
    permissions: ['All VEYRO data read', 'Task automation'],
    appReviews: [
      { id: 'r81', userName: 'Sunil Goyal', rating: 5, date: '26 Feb 2026', comment: 'The AI Copilot is like having a senior CA available 24/7.' },
      { id: 'r82', userName: 'Kavitha Raman', rating: 5, date: '19 Feb 2026', comment: 'Hindi support is amazing. My team uses it constantly.' },
    ],
    isFeatured: false, isNew: false, isOfficial: true,
  },
  {
    id: 'gstpilot-recon',
    name: 'VEYRO Reconcile',
    developer: 'VEYRO Official',
    category: 'Tax Automation',
    rating: 4.8, reviews: 1876, downloads: 45000,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Official 2A/2B reconciliation engine with AI-powered mismatch resolution.',
    fullDescription: 'The official VEYRO reconciliation engine provides best-in-class GSTR-2A/2B matching with AI-powered suggestions for resolving mismatches. It handles ITC claims, tracks supplier compliance, and generates reconciliation reports.\n\nBuilt directly into the VEYRO core for the fastest and most reliable reconciliation experience.',
    features: ['Best-in-class matching', 'AI mismatch resolution', 'ITC claim tracking', 'Supplier compliance monitoring', 'Auto-reconciliation rules'],
    iconColor: 'bg-emerald-500', iconInitials: 'GR',
    version: '4.2.0', lastUpdated: '27 Feb 2026',
    permissions: ['GST data read/write', 'Reconciliation data'],
    appReviews: [
      { id: 'r83', userName: 'Bharat Jain', rating: 5, date: '25 Feb 2026', comment: '98% auto-match rate. Best reconciliation tool in the market.' },
      { id: 'r84', userName: 'Meera Krishnan', rating: 5, date: '18 Feb 2026', comment: 'AI suggestions for mismatches save hours of manual review.' },
    ],
    isFeatured: false, isNew: false, isOfficial: true,
  },
  {
    id: 'gstpilot-notice',
    name: 'VEYRO Notices',
    developer: 'VEYRO Official',
    category: 'Legal',
    rating: 4.7, reviews: 1234, downloads: 38000,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Official notice management — auto-detection, response drafting, and tracking.',
    fullDescription: 'The official VEYRO notice management system automatically detects notices from GST and IT portals, categorizes them by urgency, and provides AI-assisted response drafting.\n\nTrack all notices from receipt to resolution with complete audit trails and deadline management.',
    features: ['Auto-notice detection', 'Urgency classification', 'AI response drafting', 'Deadline management', 'Complete audit trail'],
    iconColor: 'bg-emerald-400', iconInitials: 'GN',
    version: '3.8.0', lastUpdated: '26 Feb 2026',
    permissions: ['Notice data read/write', 'Portal access', 'Document generation'],
    appReviews: [
      { id: 'r85', userName: 'Deepak Gupta', rating: 5, date: '24 Feb 2026', comment: 'Auto-detection caught a notice we would have missed. Lifesaver.' },
      { id: 'r86', userName: 'Aparna Iyer', rating: 4, date: '17 Feb 2026', comment: 'Good notice tracking. Response drafting is getting better with each update.' },
    ],
    isFeatured: false, isNew: false, isOfficial: true,
  },
  {
    id: 'gstpilot-docs',
    name: 'VEYRO Docs',
    developer: 'VEYRO Official',
    category: 'AI Agents',
    rating: 4.8, reviews: 1567, downloads: 42000,
    price: 'Free', priceValue: 0, isFree: true,
    shortDescription: 'Official document intelligence — OCR, extraction, and auto-categorization.',
    fullDescription: 'The official VEYRO document intelligence system provides OCR, data extraction, and auto-categorization for all your business documents. It reads invoices, receipts, bank statements, and compliance documents with 99%+ accuracy.\n\nExtracted data flows directly into VEYRO workflows, eliminating manual data entry entirely.',
    features: ['99%+ OCR accuracy', 'Multi-format support', 'Auto-categorization', 'Workflow integration', 'Batch processing'],
    iconColor: 'bg-emerald-700', iconInitials: 'GD',
    version: '4.0.0', lastUpdated: '28 Feb 2026',
    permissions: ['Document read/write', 'OCR processing', 'Data extraction'],
    appReviews: [
      { id: 'r87', userName: 'Rahul Bhat', rating: 5, date: '26 Feb 2026', comment: 'OCR accuracy is incredible. Handles even handwritten invoices.' },
      { id: 'r88', userName: 'Sangeeta Iyer', rating: 5, date: '19 Feb 2026', comment: 'Batch processing 500 invoices in minutes. Eliminated manual entry.' },
    ],
    isFeatured: false, isNew: false, isOfficial: true,
  },
]

const INSTALLED_APPS = [
  { id: 'taxbot-pro', status: 'Active' as const, installedDate: '15 Jan 2026', subscription: 'Pro Plan', usage: 'High' },
  { id: 'payrollpro', status: 'Active' as const, installedDate: '1 Dec 2025', subscription: 'Business Plan', usage: 'Medium' },
  { id: 'banksync', status: 'Active' as const, installedDate: '20 Nov 2025', subscription: 'Standard Plan', usage: 'High' },
  { id: 'notice-responder', status: 'Active' as const, installedDate: '5 Oct 2025', subscription: 'Pro Plan', usage: 'Medium' },
  { id: 'tds-master', status: 'Inactive' as const, installedDate: '15 Aug 2025', subscription: 'Free Trial', usage: 'Low' },
  { id: 'leave-manager', status: 'Active' as const, installedDate: '1 Jul 2025', subscription: 'Free', usage: 'Medium' },
]

const SUBSCRIPTIONS = [
  { id: 'taxbot-pro', plan: 'Pro Plan', billingCycle: 'Monthly', amount: 499, nextBilling: '15 Mar 2026', action: 'Cancel' },
  { id: 'payrollpro', plan: 'Business Plan', billingCycle: 'Monthly', amount: 599, nextBilling: '1 Mar 2026', action: 'Upgrade' },
  { id: 'banksync', plan: 'Standard Plan', billingCycle: 'Monthly', amount: 299, nextBilling: '20 Mar 2026', action: 'Cancel' },
  { id: 'notice-responder', plan: 'Pro Plan', billingCycle: 'Annual', amount: 6990, nextBilling: '5 Oct 2026', action: 'Upgrade' },
]

const DEVELOPER_APPS = [
  { name: 'My Tax Calculator', status: 'Published' as const, installs: 1240, revenue: 34560, rating: 4.3 },
  { name: 'GST Invoice Maker', status: 'In Review' as const, installs: 0, revenue: 0, rating: 0 },
  { name: 'Client Portal Pro', status: 'Draft' as const, installs: 0, revenue: 0, rating: 0 },
]

// ─── Helpers ─────────────────────────────────────────────────────

function formatIndianNumber(num: number): string {
  const str = num.toString()
  if (str.length <= 3) return '₹' + str
  let lastThree = str.substring(str.length - 3)
  let otherNumbers = str.substring(0, str.length - 3)
  let result = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  return '₹' + result
}

function formatDownloads(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const starSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${
            star <= Math.floor(rating)
              ? 'text-amber-400 fill-amber-400'
              : star - 0.5 <= rating
                ? 'text-amber-400 fill-amber-200'
                : 'text-gray-300'
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-500 font-medium">{rating}</span>
    </div>
  )
}

function AppIcon({ color, initials, size = 'md' }: { color: string; initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' }
  return (
    <div className={`${sizeMap[size]} rounded-xl ${color} flex items-center justify-center text-white font-bold shadow-sm`}>
      {initials}
    </div>
  )
}

// ─── App Card Components ─────────────────────────────────────────

function AppCardGrid({ app, onClick }: { app: StoreApp; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-slate-200/80 bg-white"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AppIcon color={app.iconColor} initials={app.iconInitials} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-slate-900 truncate">{app.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{app.developer}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {app.isNew && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 hover:bg-emerald-100 border-0 font-semibold">
                      NEW
                    </Badge>
                  )}
                  {app.isOfficial && (
                    <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 hover:bg-amber-100 border-0 font-semibold">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                      OFFICIAL
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{app.category}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <StarRating rating={app.rating} />
                <span className="text-[10px] text-slate-400">({formatDownloads(app.reviews)})</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Download className="h-3 w-3" />
                  {formatDownloads(app.downloads)}
                </div>
                <Badge
                  className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${
                    app.isFree
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {app.isFree ? 'Free' : app.price}
                </Badge>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{app.shortDescription}</p>
          <div className="flex items-center justify-between mt-3">
            <Button
              size="sm"
              className={`h-7 text-xs ${
                app.isFree
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
              onClick={(e) => { e.stopPropagation() }}
            >
              {app.isFree ? 'Install' : 'Subscribe'}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400">
              <Heart className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function AppCardList({ app, onClick }: { app: StoreApp; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
        onClick={onClick}
      >
        <AppIcon color={app.iconColor} initials={app.iconInitials} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-slate-900 truncate">{app.name}</h3>
            {app.isNew && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 hover:bg-emerald-100 border-0 font-semibold">
                NEW
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">{app.developer} · {app.category}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <StarRating rating={app.rating} />
            <span className="text-[10px] text-slate-400">{formatDownloads(app.downloads)} downloads</span>
          </div>
          <Badge
            className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${
              app.isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {app.isFree ? 'Free' : app.price}
          </Badge>
          <Button
            size="sm"
            className={`h-7 text-xs ${
              app.isFree
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
            onClick={(e) => { e.stopPropagation() }}
          >
            {app.isFree ? 'Install' : 'Subscribe'}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── App Detail Dialog ───────────────────────────────────────────

function AppDetailDialog({ app, open, onOpenChange }: { app: StoreApp | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!app) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle className="sr-only">{app.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-4">
            <AppIcon color={app.iconColor} initials={app.iconInitials} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{app.name}</h2>
                {app.isOfficial && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 border-0 font-semibold">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />OFFICIAL
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">{app.developer}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs font-medium border-slate-200">
                  {app.category}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <StarRating rating={app.rating} size="md" />
                <span className="text-sm text-slate-500">{app.reviews.toLocaleString('en-IN')} reviews</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm text-slate-500">{formatDownloads(app.downloads)} downloads</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <Button
                  className={`${
                    app.isFree
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  {app.isFree ? 'Install Free' : `Subscribe at ${app.price}`}
                </Button>
                <Button variant="outline" className="border-slate-200">
                  <Heart className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Screenshots placeholder */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-48 h-32 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center"
              >
                <div className="text-center">
                  <Package className="h-6 w-6 text-slate-300 mx-auto" />
                  <span className="text-[10px] text-slate-400 mt-1 block">Screenshot {i}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-2">About this app</h3>
            {app.fullDescription.split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-slate-600 mb-2 leading-relaxed">{para}</p>
            ))}
          </div>

          {/* Features */}
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-2">Key Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {app.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-600">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Reviews */}
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-3">Recent Reviews</h3>
            <div className="space-y-3">
              {app.appReviews.map((review) => (
                <div key={review.id} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700">
                        {review.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{review.userName}</span>
                    </div>
                    <span className="text-xs text-slate-400">{review.date}</span>
                  </div>
                  <div className="mt-1">
                    <StarRating rating={review.rating} />
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Permissions */}
          <div>
            <h3 className="font-semibold text-sm text-slate-900 mb-2">Permissions Required</h3>
            <div className="flex flex-wrap gap-2">
              {app.permissions.map((perm, i) => (
                <Badge key={i} variant="outline" className="text-xs border-slate-200 font-normal">
                  <Shield className="h-3 w-3 mr-1 text-slate-400" />
                  {perm}
                </Badge>
              ))}
            </div>
          </div>

          {/* Version info */}
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2">
            <span>Version {app.version}</span>
            <span>Last updated: {app.lastUpdated}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab 1: Featured & Browse ────────────────────────────────────

function FeaturedBrowseTab({ apps, onAppClick }: { apps: StoreApp[]; onAppClick: (app: StoreApp) => void }) {
  const featuredApps = apps.filter(a => a.isFeatured)
  const officialAppsList = OFFICIAL_APPS
  const topFree = [...apps].filter(a => a.isFree).sort((a, b) => b.downloads - a.downloads).slice(0, 5)
  const topPaid = [...apps].filter(a => !a.isFree).sort((a, b) => b.downloads - a.downloads).slice(0, 5)
  const topGrossing = [...apps].sort((a, b) => (b.priceValue * b.downloads) - (a.priceValue * a.downloads)).slice(0, 5)
  const newReleases = [...apps].filter(a => a.isNew).slice(0, 6)

  return (
    <div className="space-y-8">
      {/* Hero Featured Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-6 md:p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider text-emerald-100">Featured Apps</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-1">GSTPILOT APP STORE™</h2>
          <p className="text-emerald-100 text-sm md:text-base max-w-lg">
            India&apos;s Financial App Ecosystem — Discover 30+ apps built by top developers to power your practice.
          </p>
        </div>
        <div className="relative z-10 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {featuredApps.map((app) => (
            <motion.div
              key={app.id}
              whileHover={{ scale: 1.02 }}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 cursor-pointer hover:bg-white/15 transition-colors"
              onClick={() => onAppClick(app)}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                  {app.iconInitials}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{app.name}</h3>
                  <p className="text-xs text-emerald-100 truncate">{app.shortDescription.slice(0, 50)}…</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 text-amber-300 fill-amber-300" />
                    <span className="text-xs text-emerald-100">{app.rating}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-emerald-500" />
          Browse by Category
        </h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter(c => c !== 'All').map((cat) => (
            <Badge
              key={cat}
              variant="outline"
              className="cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors text-xs px-3 py-1.5 border-slate-200"
            >
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {/* Top Charts */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Top Charts
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Top Free', data: topFree },
            { title: 'Top Paid', data: topPaid },
            { title: 'Top Grossing', data: topGrossing },
          ].map((chart) => (
            <Card key={chart.title} className="border-slate-200/80">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-slate-800">{chart.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {chart.data.map((app, i) => (
                    <div
                      key={app.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => onAppClick(app)}
                    >
                      <span className="text-xs font-bold text-slate-400 w-4 text-center">{i + 1}</span>
                      <AppIcon color={app.iconColor} initials={app.iconInitials} size="sm" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-medium text-slate-800 truncate">{app.name}</h4>
                        <div className="flex items-center gap-1">
                          <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] text-slate-400">{app.rating}</span>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 border-0 font-semibold ${
                          app.isFree ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {app.isFree ? 'Free' : app.price}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* New Releases */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            New Releases
          </h3>
          <Button variant="ghost" size="sm" className="text-xs text-emerald-600 hover:text-emerald-700">
            View All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {newReleases.map((app) => (
            <AppCardGrid key={app.id} app={app} onClick={() => onAppClick(app)} />
          ))}
        </div>
      </div>

      {/* Made by VEYRO */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            Made by VEYRO
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {officialAppsList.map((app) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
            >
              <Card className="border-emerald-200/60 bg-gradient-to-b from-emerald-50/50 to-white cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onAppClick(app)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <AppIcon color={app.iconColor} initials={app.iconInitials} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <h3 className="font-semibold text-sm text-slate-900 truncate">{app.name}</h3>
                        <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      </div>
                      <p className="text-xs text-slate-500">VEYRO Official</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{app.shortDescription}</p>
                  <div className="flex items-center justify-between mt-2">
                    <StarRating rating={app.rating} />
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0 border-0 font-semibold">
                      Free
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: All Apps Directory ───────────────────────────────────

function AllAppsTab({ apps, onAppClick }: { apps: StoreApp[]; onAppClick: (app: StoreApp) => void }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [ratingFilter, setRatingFilter] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating' | 'name'>('popular')
  const [showFilters, setShowFilters] = useState(false)

  const filteredApps = useMemo(() => {
    let result = apps.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) ||
        app.developer.toLowerCase().includes(search.toLowerCase()) ||
        app.shortDescription.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory
      const matchesPrice = priceFilter === 'all' || (priceFilter === 'free' ? app.isFree : !app.isFree)
      const matchesRating = app.rating >= ratingFilter
      return matchesSearch && matchesCategory && matchesPrice && matchesRating
    })

    switch (sortBy) {
      case 'popular': result.sort((a, b) => b.downloads - a.downloads); break
      case 'newest': result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)); break
      case 'rating': result.sort((a, b) => b.rating - a.rating); break
      case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break
    }

    return result
  }, [apps, search, selectedCategory, priceFilter, ratingFilter, sortBy])

  return (
    <div className="space-y-4">
      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search apps, developers..."
            className="pl-9 h-9 text-sm border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`h-9 border-slate-200 ${showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <div className="flex border border-slate-200 rounded-md overflow-hidden">
            <button
              className={`h-9 px-3 flex items-center ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-500'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              className={`h-9 px-3 flex items-center ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-500'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card className="border-slate-200/80">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
                    <select
                      className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Price</label>
                    <select
                      className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value as 'all' | 'free' | 'paid')}
                    >
                      <option value="all">All Prices</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Min Rating</label>
                    <select
                      className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                      value={ratingFilter}
                      onChange={(e) => setRatingFilter(Number(e.target.value))}
                    >
                      <option value={0}>Any Rating</option>
                      <option value={4}>4+ Stars</option>
                      <option value={4.5}>4.5+ Stars</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Sort By</label>
                    <select
                      className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'popular' | 'newest' | 'rating' | 'name')}
                    >
                      <option value="popular">Most Popular</option>
                      <option value="newest">Newest</option>
                      <option value="rating">Highest Rated</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{filteredApps.length} apps found</p>
      </div>

      {/* App Grid / List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredApps.map((app) => (
            <AppCardGrid key={app.id} app={app} onClick={() => onAppClick(app)} />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredApps.map((app) => (
            <AppCardList key={app.id} app={app} onClick={() => onAppClick(app)} />
          ))}
        </div>
      )}

      {filteredApps.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No apps match your search criteria.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-emerald-600"
            onClick={() => { setSearch(''); setSelectedCategory('All'); setPriceFilter('all'); setRatingFilter(0) }}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: My Apps & Subscriptions ──────────────────────────────

function MyAppsTab({ apps, onAppClick }: { apps: StoreApp[]; onAppClick: (app: StoreApp) => void }) {
  const installedWithDetails = INSTALLED_APPS.map(ia => {
    const app = apps.find(a => a.id === ia.id) || OFFICIAL_APPS.find(a => a.id === ia.id)
    return { ...ia, app }
  }).filter(ia => ia.app)

  const subsWithDetails = SUBSCRIPTIONS.map(s => {
    const app = apps.find(a => a.id === s.id)
    return { ...s, app }
  }).filter(s => s.app)

  return (
    <div className="space-y-6">
      {/* Revenue Banner */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">You Earn 70% of All App Revenue</h3>
            <p className="text-sm text-emerald-100">As a VEYRO partner, you earn a 70% revenue share from every app you build and publish.</p>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Installs', value: '4,23,500', icon: Download, change: '+12%' },
          { label: 'Active Users', value: '1,87,200', icon: Users, change: '+8%' },
          { label: 'Revenue Generated', value: formatIndianNumber(2345000), icon: IndianRupee, change: '+15%' },
        ].map((stat) => (
          <Card key={stat.label} className="border-slate-200/80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <stat.icon className="h-4 w-4 text-emerald-600" />
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0 font-semibold">{stat.change}</Badge>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Installed Apps */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-500" />
          Installed Apps
        </h3>
        <Card className="border-slate-200/80">
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              <div className="divide-y divide-slate-100">
                {installedWithDetails.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => item.app && onAppClick(item.app)}
                  >
                    {item.app && <AppIcon color={item.app.iconColor} initials={item.app.iconInitials} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-slate-800 truncate">{item.app?.name}</h4>
                        <Badge className={`text-[10px] px-1.5 py-0 border-0 font-semibold ${
                          item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{item.subscription} · Installed {item.installedDate}</p>
                    </div>
                    <div className="hidden sm:block">
                      <Badge variant="outline" className="text-[10px] border-slate-200">
                        Usage: {item.usage}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Active Subscriptions */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-emerald-500" />
          Active Subscriptions
        </h3>
        <Card className="border-slate-200/80">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left font-medium text-slate-500 px-4 py-3 text-xs">App</th>
                    <th className="text-left font-medium text-slate-500 px-4 py-3 text-xs hidden sm:table-cell">Plan</th>
                    <th className="text-left font-medium text-slate-500 px-4 py-3 text-xs hidden md:table-cell">Billing</th>
                    <th className="text-right font-medium text-slate-500 px-4 py-3 text-xs">Amount</th>
                    <th className="text-left font-medium text-slate-500 px-4 py-3 text-xs hidden lg:table-cell">Next Billing</th>
                    <th className="text-right font-medium text-slate-500 px-4 py-3 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {subsWithDetails.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {sub.app && <AppIcon color={sub.app.iconColor} initials={sub.app.iconInitials} size="sm" />}
                          <span className="font-medium text-slate-800">{sub.app?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{sub.plan}</td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{sub.billingCycle}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatIndianNumber(sub.amount)}</td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{sub.nextBilling}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs ${
                            sub.action === 'Upgrade'
                              ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              : 'text-red-500 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {sub.action}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Updates */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Pending Updates
        </h3>
        <div className="space-y-2">
          {[
            { name: 'TaxBot Pro', version: '3.2.2', changes: 'Bug fixes and improved citation engine' },
            { name: 'PayrollPro', version: '5.1.0', changes: 'New ESI portal integration and batch processing' },
          ].map((update) => (
            <Card key={update.name} className="border-slate-200/80">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{update.name}</span>
                    <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0 font-semibold">
                      v{update.version}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{update.changes}</p>
                </div>
                <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  Update
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab 4: Developer Portal ─────────────────────────────────────

function DeveloperPortalTab() {
  const [submitOpen, setSubmitOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Publish CTA Banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Publish Your App on GSTPILOT APP STORE™</h2>
              <p className="text-sm text-slate-300">Reach 50,000+ CA firms across India. 70% revenue share. Zero listing fees.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => setSubmitOpen(true)}>
              <Zap className="h-4 w-4 mr-1" />
              Submit Your App
            </Button>
            <Button variant="outline" className="border-slate-500 text-slate-300 hover:bg-slate-700">
              View Developer Docs
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Developer Dashboard */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-500" />
          My Developer Apps
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DEVELOPER_APPS.map((app) => (
            <Card key={app.name} className="border-slate-200/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-slate-900">{app.name}</h4>
                  <Badge className={`text-[10px] px-2 py-0 border-0 font-semibold ${
                    app.status === 'Published'
                      ? 'bg-emerald-100 text-emerald-700'
                      : app.status === 'In Review'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {app.status}
                  </Badge>
                </div>
                {app.status === 'Published' ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Installs</span>
                      <span className="font-medium text-slate-800">{app.installs.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Revenue</span>
                      <span className="font-medium text-emerald-600">{formatIndianNumber(app.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Rating</span>
                      <span className="font-medium text-slate-800 flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        {app.rating}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {app.status === 'In Review'
                      ? 'Your app is being reviewed. This usually takes 2-3 business days.'
                      : 'Complete your app details and submit for review.'}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* App Performance */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          App Performance
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Installs', value: '1,240', change: '+18%' },
            { label: 'Monthly Revenue', value: formatIndianNumber(34560), change: '+22%' },
            { label: 'Avg. Rating', value: '4.3 ★', change: '+0.2' },
            { label: 'Reviews', value: '89', change: '+12' },
          ].map((stat) => (
            <Card key={stat.label} className="border-slate-200/80">
              <CardContent className="p-3">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0 font-semibold mt-1">{stat.change}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Revenue Report */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-emerald-500" />
          Revenue Report
        </h3>
        <Card className="border-slate-200/80">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Monthly Earnings (Feb 2026)</p>
                <p className="text-2xl font-bold text-emerald-600">{formatIndianNumber(34560)}</p>
                <p className="text-xs text-slate-400">70% of ₹49,371 gross revenue</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Lifetime Earnings</p>
                <p className="text-2xl font-bold text-slate-900">{formatIndianNumber(289450)}</p>
                <p className="text-xs text-slate-400">Since Oct 2025</p>
              </div>
            </div>
            <Separator className="my-3" />
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Payout History</h4>
            <div className="space-y-2">
              {[
                { date: '1 Feb 2026', amount: formatIndianNumber(31200), status: 'Paid', method: 'Bank Transfer' },
                { date: '1 Jan 2026', amount: formatIndianNumber(28900), status: 'Paid', method: 'Bank Transfer' },
                { date: '1 Dec 2025', amount: formatIndianNumber(25600), status: 'Paid', method: 'Bank Transfer' },
              ].map((payout) => (
                <div key={payout.date} className="flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-xs font-medium text-slate-800">{payout.date}</span>
                    <span className="text-xs text-slate-400 ml-2">{payout.method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{payout.amount}</span>
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0 font-semibold">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                      {payout.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Guidelines */}
      <div>
        <h3 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          Review Guidelines Checklist
        </h3>
        <Card className="border-slate-200/80">
          <CardContent className="p-4">
            <div className="space-y-2">
              {[
                'App must be functional and not crash on launch',
                'Clear privacy policy and data handling disclosure',
                'No misleading screenshots or descriptions',
                'Must comply with Indian data protection regulations',
                'Secure API communication (HTTPS only)',
                'Proper error handling and user feedback',
                'VEYRO API usage within rate limits',
                'No unauthorized data collection or sharing',
              ].map((guideline, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600">{guideline}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submit App Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit New App</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">App Name</label>
              <Input placeholder="Enter your app name" className="h-9 text-sm border-slate-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
              <select className="w-full h-9 text-sm border border-slate-200 rounded-md px-3 bg-white">
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Description</label>
              <textarea
                className="w-full h-24 text-sm border border-slate-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                placeholder="Describe your app in detail..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Pricing</label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" className="h-9 border-emerald-300 bg-emerald-50 text-emerald-700">
                  Free
                </Button>
                <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50">
                  Paid (₹/mo)
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Permissions Needed</label>
              <div className="flex flex-wrap gap-2">
                {['Client Data', 'Invoice Data', 'GST Data', 'Email', 'Documents'].map(perm => (
                  <Badge key={perm} variant="outline" className="text-xs border-slate-200 cursor-pointer hover:bg-emerald-50 hover:border-emerald-300">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Screenshots</label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-emerald-300 transition-colors cursor-pointer">
                <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Drag & drop screenshots or click to upload</p>
                <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 5MB each. Min 2 screenshots.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                Submit for Review
              </Button>
              <Button variant="outline" className="border-slate-200" onClick={() => setSubmitOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page Component ─────────────────────────────────────────

export default function AppStorePage() {
  const [activeTab, setActiveTab] = useState('featured')
  const [selectedApp, setSelectedApp] = useState<StoreApp | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const allApps = useMemo(() => [...ALL_APPS, ...OFFICIAL_APPS], [])

  const handleAppClick = (app: StoreApp) => {
    setSelectedApp(app)
    setDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Store className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">GSTPILOT APP STORE™</h1>
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0 border-0 font-bold uppercase tracking-wider">
                    30+ Apps
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">India&apos;s Financial App Ecosystem</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              <span>Verified Developers</span>
              <Separator orientation="vertical" className="h-3" />
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              <span>Instant Install</span>
              <Separator orientation="vertical" className="h-3" />
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>70% Revenue Share</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-200/80 h-10 p-1 rounded-lg">
            <TabsTrigger
              value="featured"
              className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-md px-4"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Featured & Browse
            </TabsTrigger>
            <TabsTrigger
              value="all-apps"
              className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-md px-4"
            >
              <Grid3X3 className="h-3.5 w-3.5 mr-1.5" />
              All Apps
            </TabsTrigger>
            <TabsTrigger
              value="my-apps"
              className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-md px-4"
            >
              <Package className="h-3.5 w-3.5 mr-1.5" />
              My Apps
            </TabsTrigger>
            <TabsTrigger
              value="developer"
              className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-md px-4"
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Developer Portal
            </TabsTrigger>
          </TabsList>

          <div className="mt-5">
            <TabsContent value="featured" className="mt-0">
              <FeaturedBrowseTab apps={allApps} onAppClick={handleAppClick} />
            </TabsContent>
            <TabsContent value="all-apps" className="mt-0">
              <AllAppsTab apps={allApps} onAppClick={handleAppClick} />
            </TabsContent>
            <TabsContent value="my-apps" className="mt-0">
              <MyAppsTab apps={allApps} onAppClick={handleAppClick} />
            </TabsContent>
            <TabsContent value="developer" className="mt-0">
              <DeveloperPortalTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* App Detail Dialog */}
      <AppDetailDialog
        app={selectedApp}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}
