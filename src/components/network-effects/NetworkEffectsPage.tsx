'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
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
  Users,
  UserPlus,
  Share2,
  Globe,
  Award,
  TrendingUp,
  Zap,
  Gift,
  IndianRupee,
  ArrowRight,
  Link,
  Building2,
  Crown,
  Star,
  Target,
  BarChart3,
  Activity,
  Send,
  Copy,
  CheckCircle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════════════════

const networkStats = [
  { label: 'Total CA Firms', value: '10,000+', icon: Building2, color: 'emerald' },
  { label: 'Total Businesses', value: '5,00,000+', icon: Users, color: 'teal' },
  { label: 'Invoices Processed', value: '10,00,00,000+', icon: BarChart3, color: 'amber' },
  { label: 'Network Value', value: '₹10,000+ Crore', icon: IndianRupee, color: 'emerald' },
];

const growthMetrics = [
  { label: 'New CAs This Month', value: '347', change: '+12%', up: true },
  { label: 'New Businesses This Month', value: '8,421', change: '+23%', up: true },
  { label: 'Network Growth Rate', value: '18.7%', change: '+3.2%', up: true },
];

const networkDepth = [
  { degree: '1st Degree', desc: 'Your Clients', count: 42, color: '#2563EB' },
  { degree: '2nd Degree', desc: 'Their Vendors', count: 186, color: '#14b8a6' },
  { degree: '3rd Degree', desc: 'Vendor Network', count: 1240, color: '#f59e0b' },
];

const viralLoopSteps = [
  { id: 'ca', label: 'CA Firm', icon: '🏢', x: 50, y: 20 },
  { id: 'client', label: 'Clients', icon: '👥', x: 85, y: 35 },
  { id: 'vendor', label: 'Vendors', icon: '🏭', x: 75, y: 70 },
  { id: 'accountant', label: 'Accountants', icon: '🧮', x: 25, y: 70 },
  { id: 'business', label: 'Businesses', icon: '💼', x: 15, y: 35 },
];

const pendingInvites = [
  { id: 1, name: 'Rajesh Sharma', email: 'rajesh@sharmacorp.in', phone: '+91 98765 43210', role: 'Client', status: 'Sent', date: '2025-03-01' },
  { id: 2, name: 'Priya Patel', email: 'priya@patelassociates.com', phone: '+91 87654 32109', role: 'CA', status: 'Accepted', date: '2025-02-28' },
  { id: 3, name: 'Amit Kumar', email: 'amit@kumarenterprises.in', phone: '+91 76543 21098', role: 'Vendor', status: 'Sent', date: '2025-03-02' },
  { id: 4, name: 'Sunita Reddy', email: 'sunita@reddyconsulting.com', phone: '+91 65432 10987', role: 'Accountant', status: 'Expired', date: '2025-02-15' },
  { id: 5, name: 'Vikram Singh', email: 'vikram@singhfoods.in', phone: '+91 54321 09876', role: 'Client', status: 'Sent', date: '2025-03-03' },
  { id: 6, name: 'Anjali Desai', email: 'anjali@desaifinance.com', phone: '+91 43210 98765', role: 'CA', status: 'Accepted', date: '2025-02-25' },
  { id: 7, name: 'Kiran Joshi', email: 'kiran@joshitrading.in', phone: '+91 32109 87654', role: 'Vendor', status: 'Sent', date: '2025-03-04' },
  { id: 8, name: 'Meera Nair', email: 'meera@nairtextiles.com', phone: '+91 21098 76543', role: 'Client', status: 'Sent', date: '2025-03-02' },
  { id: 9, name: 'Arjun Mehta', email: 'arjun@mehtaconstruction.in', phone: '+91 10987 65432', role: 'Vendor', status: 'Expired', date: '2025-02-10' },
  { id: 10, name: 'Deepa Iyer', email: 'deepa@iyerca.com', phone: '+91 09876 54321', role: 'CA', status: 'Sent', date: '2025-03-05' },
  { id: 11, name: 'Ramesh Gupta', email: 'ramesh@guptamotors.in', phone: '+91 99887 76655', role: 'Client', status: 'Accepted', date: '2025-02-20' },
  { id: 12, name: 'Sneha Kulkarni', email: 'sneha@kulkarniaccounts.com', phone: '+91 88776 65544', role: 'Accountant', status: 'Sent', date: '2025-03-04' },
  { id: 13, name: 'Prakash Bhatt', email: 'prakash@bhattindustries.in', phone: '+91 77665 54433', role: 'Vendor', status: 'Sent', date: '2025-03-03' },
  { id: 14, name: 'Nisha Agarwal', email: 'nisha@agarwallegal.com', phone: '+91 66554 43322', role: 'Client', status: 'Sent', date: '2025-03-01' },
  { id: 15, name: 'Suresh Menon', email: 'suresh@menonpharma.in', phone: '+91 55443 32211', role: 'Client', status: 'Expired', date: '2025-02-05' },
  { id: 16, name: 'Lata Chauhan', email: 'lata@chauhanca.com', phone: '+91 44332 21100', role: 'CA', status: 'Sent', date: '2025-03-06' },
];

const inviteTemplates = [
  { name: 'Professional', desc: 'Formal tone for business associates', preview: 'Dear Colleague, I invite you to join VEYRO — India\'s leading GST compliance platform...' },
  { name: 'Casual', desc: 'Friendly tone for known contacts', preview: 'Hey! You should check out VEYRO — it\'s made GST filing so much easier for us...' },
  { name: 'Follow-up', desc: 'Gentle reminder for pending invites', preview: 'Just a reminder — your VEYRO invite is waiting! Join 10,000+ CA firms already on the platform...' },
];

const referralHistory = [
  { id: 1, from: 'You', to: 'Sharma & Associates', date: '2025-03-01', status: 'Joined', reward: 500 },
  { id: 2, from: 'You', to: 'Patel Trading Corp', date: '2025-02-28', status: 'Joined', reward: 200 },
  { id: 3, from: 'You', to: 'Reddy Consulting', date: '2025-02-25', status: 'Joined', reward: 500 },
  { id: 4, from: 'You', to: 'Kumar Enterprises', date: '2025-02-20', status: 'Pending', reward: 0 },
  { id: 5, from: 'You', to: 'Joshi Financial', date: '2025-02-18', status: 'Joined', reward: 200 },
  { id: 6, from: 'You', to: 'Mehta Construction', date: '2025-02-15', status: 'Joined', reward: 200 },
  { id: 7, from: 'You', to: 'Desai CA Firm', date: '2025-02-10', status: 'Joined', reward: 500 },
  { id: 8, from: 'You', to: 'Nair Textiles', date: '2025-02-08', status: 'Expired', reward: 0 },
  { id: 9, from: 'You', to: 'Gupta Motors', date: '2025-02-05', status: 'Joined', reward: 200 },
];

const tierSystem = [
  { name: 'Bronze', range: '0-10', multiplier: '1x', color: '#CD7F32', icon: '🥉', benefits: ['Standard rewards', 'Basic dashboard'] },
  { name: 'Silver', range: '11-50', multiplier: '2x', color: '#C0C0C0', icon: '🥈', benefits: ['2x rewards', 'Priority support', 'Silver badge'] },
  { name: 'Gold', range: '51-200', multiplier: '3x', color: '#FFD700', icon: '🥇', benefits: ['3x rewards', 'Early access to features', 'Gold badge', 'Monthly analytics'] },
  { name: 'Platinum', range: '200+', multiplier: '5x', color: '#E5E4E2', icon: '💎', benefits: ['5x rewards', 'Revenue share 2%', 'Platinum badge', 'Dedicated account manager', 'API priority access'] },
];

const leaderboard = [
  { rank: 1, name: 'CA A****a S****h', referrals: 287, earnings: 287000, tier: 'Platinum' },
  { rank: 2, name: 'CA R****h K****r', referrals: 234, earnings: 234000, tier: 'Platinum' },
  { rank: 3, name: 'CA P****a M****a', referrals: 198, earnings: 198000, tier: 'Gold' },
  { rank: 4, name: 'CA S****a D****i', referrals: 156, earnings: 156000, tier: 'Gold' },
  { rank: 5, name: 'CA V****m S****h', referrals: 132, earnings: 132000, tier: 'Gold' },
  { rank: 6, name: 'CA A****i P****l', referrals: 98, earnings: 98000, tier: 'Gold' },
  { rank: 7, name: 'CA M****a N****r', referrals: 76, earnings: 76000, tier: 'Silver' },
  { rank: 8, name: 'CA K****n J****i', referrals: 64, earnings: 64000, tier: 'Silver' },
  { rank: 9, name: 'CA D****a I****r', referrals: 51, earnings: 51000, tier: 'Gold' },
  { rank: 10, name: 'CA S****h G****a', referrals: 43, earnings: 43000, tier: 'Silver' },
];

const partnerPrograms = [
  {
    type: 'CA Firms',
    icon: Building2,
    commission: '30%',
    benefits: ['White-label client portal', 'Priority support', 'Revenue share on referrals', 'Co-marketing campaigns'],
    requirements: ['Active CA practice', '50+ clients', 'GST certified'],
    color: 'emerald',
  },
  {
    type: 'Technology Partners',
    icon: Globe,
    commission: '25%',
    benefits: ['API access', 'Integration support', 'Joint webinars', 'Co-development opportunities'],
    requirements: ['Tech company', 'Fintech focus', '500+ users'],
    color: 'teal',
  },
  {
    type: 'Resellers',
    icon: Share2,
    commission: '20%',
    benefits: ['Reseller dashboard', 'Marketing kit', 'Training materials', 'Volume bonuses'],
    requirements: ['Established network', 'Sales team', 'GST knowledge'],
    color: 'amber',
  },
  {
    type: 'API Partners',
    icon: Link,
    commission: '15%',
    benefits: ['Full API access', 'Sandbox environment', 'Technical support', 'Early API features'],
    requirements: ['Developer team', 'API integration plan', 'Compliance ready'],
    color: 'slate',
  },
];

const partnerAnalytics = {
  conversions: 47,
  revenue: 234500,
  activeClients: 128,
  monthlyGrowth: 15.3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED NETWORK SVG
// ═══════════════════════════════════════════════════════════════════════════════

function NetworkVisualization() {
  const connections = [
    { from: 'ca', to: 'client' },
    { from: 'client', to: 'vendor' },
    { from: 'vendor', to: 'accountant' },
    { from: 'accountant', to: 'business' },
    { from: 'business', to: 'ca' },
  ];

  const getNodePos = (id: string) => {
    const node = viralLoopSteps.find(n => n.id === id)!;
    return { x: node.x, y: node.y };
  };

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      <svg viewBox="0 0 100 90" className="w-full h-full">
        {/* Connection lines */}
        {connections.map((conn, i) => {
          const from = getNodePos(conn.from);
          const to = getNodePos(conn.to);
          return (
            <g key={i}>
              <motion.line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#2563EB" strokeWidth="0.4" strokeOpacity="0.3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity, repeatType: 'reverse' }}
              />
              {/* Animated dot traveling along the line */}
              <motion.circle
                r="0.8"
                fill="#2563EB"
                initial={{ cx: from.x, cy: from.y, opacity: 0 }}
                animate={{
                  cx: [from.x, to.x],
                  cy: [from.y, to.y],
                  opacity: [0, 1, 1, 0],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.4,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {viralLoopSteps.map((node, i) => (
          <g key={node.id}>
            {/* Pulse ring */}
            <motion.circle
              cx={node.x} cy={node.y} r="8"
              fill="none" stroke="#2563EB" strokeWidth="0.3"
              initial={{ r: 5, opacity: 0.6 }}
              animate={{ r: 12, opacity: 0 }}
              transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
            />
            {/* Node background */}
            <motion.circle
              cx={node.x} cy={node.y} r="6"
              fill="#1D4ED8" fillOpacity="0.15"
              stroke="#2563EB" strokeWidth="0.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: i * 0.15 }}
            />
            {/* Icon */}
            <text x={node.x} y={node.y - 0.5} textAnchor="middle" fontSize="4.5" dominantBaseline="middle">
              {node.icon}
            </text>
            {/* Label */}
            <text x={node.x} y={node.y + 9} textAnchor="middle" fontSize="2.8" fill="#64748b" fontWeight="600">
              {node.label}
            </text>
          </g>
        ))}

        {/* Arrow labels on connections */}
        <text x={70} y={25} textAnchor="middle" fontSize="2" fill="#2563EB" fontWeight="500">invites</text>
        <text x={83} y={55} textAnchor="middle" fontSize="2" fill="#2563EB" fontWeight="500">invite</text>
        <text x={50} y={76} textAnchor="middle" fontSize="2" fill="#2563EB" fontWeight="500">invite</text>
        <text x={18} y={55} textAnchor="middle" fontSize="2" fill="#2563EB" fontWeight="500">invite</text>
        <text x={28} y={25} textAnchor="middle" fontSize="2" fill="#2563EB" fontWeight="500">invites</text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QR CODE SIMULATION (SVG)
// ═══════════════════════════════════════════════════════════════════════════════

function SimulatedQRCode() {
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.random() > 0.5)
  );

  // Force corners to look like QR
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
      const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      cells[r][c] = isEdge || isInner;
      cells[r][size - 1 - c] = isEdge || isInner;
      cells[size - 1 - r][c] = isEdge || isInner;
    }
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-32 h-32 mx-auto">
      {cells.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#1D4ED8" />
          ) : null
        )
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: NETWORK OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function NetworkOverviewTab() {
  return (
    <div className="space-y-6">
      {/* Animated Network Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-600" />
              Viral Loop — How VEYRO Grows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NetworkVisualization />
            <div className="text-center mt-2">
              <motion.p
                className="text-sm text-emerald-700 font-semibold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Each CA brings 2.3 new businesses on average
              </motion.p>
              <Badge variant="secondary" className="mt-2 bg-emerald-100 text-emerald-700">
                <Activity className="h-3 w-3 mr-1" />
                Viral Coefficient: 2.3x
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Network Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {networkStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow border-slate-200/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'emerald' ? 'bg-emerald-100' :
                    stat.color === 'teal' ? 'bg-teal-100' :
                    'bg-amber-100'
                  }`}>
                    <stat.icon className={`h-5 w-5 ${
                      stat.color === 'emerald' ? 'text-emerald-600' :
                      stat.color === 'teal' ? 'text-teal-600' :
                      'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {growthMetrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <Card className="border-slate-200/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="text-2xl font-bold text-slate-800">{metric.value}</p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {metric.change}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Network Depth Visualization */}
      <Card className="border-slate-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Network Depth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {networkDepth.map((level, i) => (
            <motion.div
              key={level.degree}
              className="space-y-1.5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.15 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: level.color }}
                  />
                  <span className="text-sm font-medium text-slate-700">{level.degree}</span>
                  <span className="text-xs text-slate-400">— {level.desc}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: level.color }}>
                  {level.count.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: level.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (level.count / 1240) * 100)}%` }}
                  transition={{ duration: 1, delay: 0.7 + i * 0.15 }}
                />
              </div>
            </motion.div>
          ))}
          <div className="pt-2 flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 text-emerald-700">
              <Zap className="h-3 w-3 mr-1" />
              3 degrees of separation
            </Badge>
            <span className="text-xs text-slate-400">Your network reaches 1,468 entities</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: INVITE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function InviteSystemTab() {
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Client',
    message: '',
  });
  const [inviteLink] = useState('https://veyro.com/invite/CA-SHARMA-2025');
  const [copied, setCopied] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(0);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = () => {
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
    setInviteForm({ name: '', email: '', phone: '', role: 'Client', message: '' });
  };

  const statusColors: Record<string, string> = {
    Sent: 'bg-blue-50 text-blue-700 border-blue-200',
    Accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Expired: 'bg-slate-50 text-slate-500 border-slate-200',
  };

  return (
    <div className="space-y-6">
      {/* Achievement Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">
                  You&apos;ve invited 12 businesses — 8 have joined!
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  That&apos;s a 67% conversion rate. Keep it up! 🎉
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Star className="h-3 w-3 mr-1" />
                Top Inviter
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invite Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invite Form */}
        <Card className="border-slate-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              Send an Invite
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Name</label>
              <Input
                placeholder="Enter full name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm(p => ({ ...p, name: e.target.value }))}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(p => ({ ...p, email: e.target.value }))}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
              <Input
                placeholder="+91 98765 43210"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm(p => ({ ...p, phone: e.target.value }))}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Role</label>
              <div className="flex gap-2">
                {['CA', 'Client', 'Vendor', 'Accountant'].map((role) => (
                  <Button
                    key={role}
                    variant={inviteForm.role === role ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 text-xs ${
                      inviteForm.role === role
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'border-slate-200 text-slate-600'
                    }`}
                    onClick={() => setInviteForm(p => ({ ...p, role }))}
                  >
                    {role}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Personal Message</label>
              <textarea
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 min-h-[60px] resize-none"
                placeholder="Add a personal touch..."
                value={inviteForm.message}
                onChange={(e) => setInviteForm(p => ({ ...p, message: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSendInvite}
              >
                {inviteSent ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Invite Sent!
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Send Invite
                  </>
                )}
              </Button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs border-slate-200">
                📧 Via Email
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs border-slate-200">
                💬 Via WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invite Link & QR */}
        <div className="space-y-4">
          <Card className="border-slate-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Link className="h-5 w-5 text-emerald-600" />
                Invite Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteLink}
                  className="h-9 text-sm bg-slate-50 font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Share this link with anyone to invite them to VEYRO
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                📱 QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-lg border border-slate-100">
                <SimulatedQRCode />
              </div>
              <p className="text-xs text-slate-400">Scan to join VEYRO</p>
            </CardContent>
          </Card>

          {/* Bulk Invite */}
          <Card className="border-dashed border-slate-300 bg-slate-50/50">
            <CardContent className="p-4 text-center">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
                <Share2 className="h-5 w-5 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">Bulk Invite via CSV</p>
              <p className="text-xs text-slate-400 mt-1">Upload a CSV file with names and emails</p>
              <Button variant="outline" size="sm" className="mt-3 border-slate-300 text-slate-600">
                Upload CSV
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invite Templates */}
      <Card className="border-slate-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            📝 Invite Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {inviteTemplates.map((tmpl, i) => (
              <motion.div
                key={tmpl.name}
                whileHover={{ scale: 1.02 }}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTemplate === i
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-slate-200 bg-white hover:border-emerald-200'
                }`}
                onClick={() => setSelectedTemplate(i)}
              >
                <p className="text-sm font-semibold text-slate-700">{tmpl.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{tmpl.desc}</p>
                <Separator className="my-2" />
                <p className="text-xs text-slate-500 line-clamp-2 italic">&ldquo;{tmpl.preview}&rdquo;</p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites Table */}
      <Card className="border-slate-200/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              Pending Invites
            </CardTitle>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {pendingInvites.length} invites
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-slate-100">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50/80 text-xs font-semibold text-slate-500">
                <div className="col-span-3">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-1">Role</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Action</div>
              </div>
              {pendingInvites.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm hover:bg-slate-50/50 transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="col-span-3 font-medium text-slate-700 truncate">{inv.name}</div>
                  <div className="col-span-3 text-slate-500 truncate text-xs">{inv.email}</div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-[10px] h-5 border-slate-200">
                      {inv.role}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className={`text-[10px] h-5 ${statusColors[inv.status]}`}>
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-xs text-slate-400">{formatDate(inv.date)}</div>
                  <div className="col-span-1">
                    {inv.status === 'Sent' && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-emerald-600 hover:text-emerald-700">
                        Remind
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: REFERRAL ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function ReferralEngineTab() {
  const [refCodeCopied, setRefCodeCopied] = useState(false);
  const referralCode = 'CA-SHARMA-2025';
  const currentTier = 'Gold';
  const currentReferrals = 87;
  const nextTierAt = 200;
  const progressPercent = ((currentReferrals - 51) / (nextTierAt - 51)) * 100;

  const referralDashboard = [
    { label: 'Total Referrals', value: '87', icon: Users, color: 'emerald' },
    { label: 'Active Referrals', value: '72', icon: Activity, color: 'teal' },
    { label: 'Earnings', value: formatINR(43500), icon: IndianRupee, color: 'amber' },
    { label: 'Pending Payouts', value: formatINR(12000), icon: Gift, color: 'emerald' },
  ];

  const handleCopyRefCode = () => {
    navigator.clipboard?.writeText(referralCode);
    setRefCodeCopied(true);
    setTimeout(() => setRefCodeCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Referral Program Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Gift className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">Referral Rewards Program</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Earn <span className="font-bold text-emerald-700">₹500</span> for every CA firm that joins &bull;{' '}
                  Earn <span className="font-bold text-emerald-700">₹200</span> for every business that joins
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 font-mono text-sm font-bold text-emerald-700">
                  {referralCode}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRefCode}
                  className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {refCodeCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Referral Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {referralDashboard.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-slate-200/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'emerald' ? 'bg-emerald-100' :
                    stat.color === 'teal' ? 'bg-teal-100' :
                    'bg-amber-100'
                  }`}>
                    <stat.icon className={`h-4 w-4 ${
                      stat.color === 'emerald' ? 'text-emerald-600' :
                      stat.color === 'teal' ? 'text-teal-600' :
                      'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Current Tier & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-amber-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Your Tier Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="text-2xl">🥇</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-amber-700">{currentTier}</span>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">3x Rewards</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentReferrals} referrals — {nextTierAt - currentReferrals} more for Platinum
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Gold (51)</span>
                <span>Platinum (200)</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-center text-slate-400">{Math.round(progressPercent)}% to next tier</p>
            </div>
          </CardContent>
        </Card>

        {/* Tier System */}
        <Card className="border-slate-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-600" />
              Tier System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {tierSystem.map((tier, i) => (
                <motion.div
                  key={tier.name}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                    tier.name === currentTier
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-100 bg-white'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <span className="text-xl">{tier.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: tier.color }}>
                        {tier.name}
                      </span>
                      <span className="text-[10px] text-slate-400">{tier.range} referrals</span>
                      <Badge variant="outline" className="text-[10px] h-4 border-slate-200">
                        {tier.multiplier}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tier.benefits.slice(0, 2).map((b) => (
                        <span key={b} className="text-[10px] text-slate-400">• {b}</span>
                      ))}
                    </div>
                  </div>
                  {tier.name === currentTier && (
                    <Badge className="bg-amber-500 text-white text-[10px]">Current</Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral History */}
      <Card className="border-slate-200/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Referral History
            </CardTitle>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {referralHistory.length} referrals
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50/80 text-xs font-semibold text-slate-500">
                <div className="col-span-3">From</div>
                <div className="col-span-3">To</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Reward</div>
              </div>
              {referralHistory.map((ref, i) => (
                <motion.div
                  key={ref.id}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm hover:bg-slate-50/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="col-span-3 text-slate-600">{ref.from}</div>
                  <div className="col-span-3 font-medium text-slate-700 truncate">{ref.to}</div>
                  <div className="col-span-2 text-xs text-slate-400">{formatDate(ref.date)}</div>
                  <div className="col-span-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 ${
                        ref.status === 'Joined'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ref.status === 'Pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {ref.status}
                    </Badge>
                  </div>
                  <div className="col-span-2 font-medium text-emerald-700">
                    {ref.reward > 0 ? formatINR(ref.reward) : '—'}
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="border-slate-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Top Referrers Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-72">
            <div className="divide-y divide-slate-100">
              {leaderboard.map((entry, i) => (
                <motion.div
                  key={entry.rank}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    entry.rank === 1 ? 'bg-amber-100 text-amber-700' :
                    entry.rank === 2 ? 'bg-slate-100 text-slate-600' :
                    entry.rank === 3 ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{entry.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{entry.referrals}</p>
                    <p className="text-[10px] text-slate-400">referrals</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] h-5 ${
                      entry.tier === 'Platinum' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                      entry.tier === 'Gold' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                      'border-slate-200 text-slate-600 bg-slate-50'
                    }`}
                  >
                    {entry.tier}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: PARTNER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function PartnerDashboardTab() {
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const apiKey = 'gp_live_sk_a1b2c3d4e5f6g7h8i9j0';

  const partnerStats = [
    { label: 'Conversions', value: partnerAnalytics.conversions.toString(), change: '+18%', icon: Target, color: 'emerald' },
    { label: 'Revenue', value: formatINR(partnerAnalytics.revenue), change: '+23%', icon: IndianRupee, color: 'teal' },
    { label: 'Active Clients', value: partnerAnalytics.activeClients.toString(), change: '+12%', icon: Users, color: 'amber' },
    { label: 'Monthly Growth', value: `${partnerAnalytics.monthlyGrowth}%`, change: '+3.1%', icon: TrendingUp, color: 'emerald' },
  ];

  const handleCopyApiKey = () => {
    navigator.clipboard?.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Revenue Share Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">Partner Revenue Sharing</h3>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-bold text-emerald-700">70/30 split</span> — you keep 70% of all revenue generated through your referrals
                </p>
              </div>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-sm px-4 py-1.5">
                <IndianRupee className="h-4 w-4 mr-1" />
                ₹2,34,500 earned
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Partner Analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {partnerStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-slate-200/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    stat.color === 'emerald' ? 'bg-emerald-100' :
                    stat.color === 'teal' ? 'bg-teal-100' :
                    'bg-amber-100'
                  }`}>
                    <stat.icon className={`h-4 w-4 ${
                      stat.color === 'emerald' ? 'text-emerald-600' :
                      stat.color === 'teal' ? 'text-teal-600' :
                      'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Partner Program Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partnerPrograms.map((program, i) => (
          <motion.div
            key={program.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-slate-200/50 hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      program.color === 'emerald' ? 'bg-emerald-100' :
                      program.color === 'teal' ? 'bg-teal-100' :
                      program.color === 'amber' ? 'bg-amber-100' :
                      'bg-slate-100'
                    }`}>
                      <program.icon className={`h-5 w-5 ${
                        program.color === 'emerald' ? 'text-emerald-600' :
                        program.color === 'teal' ? 'text-teal-600' :
                        program.color === 'amber' ? 'text-amber-600' :
                        'text-slate-600'
                      }`} />
                    </div>
                    <CardTitle className="text-base">{program.type}</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                    {program.commission} commission
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Benefits</p>
                  <div className="space-y-1">
                    {program.benefits.map((b) => (
                      <div key={b} className="flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-xs text-slate-600">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Requirements</p>
                  <div className="space-y-1">
                    {program.requirements.map((r) => (
                      <div key={r} className="flex items-center gap-1.5">
                        <Target className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-500">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 mt-2"
                >
                  Apply as Partner
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Your Partner Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-emerald-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Your Partner Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
              <Building2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">CA Firm Partner — Gold Tier</p>
                <p className="text-xs text-emerald-600">Active since 15/01/2025</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-xs text-slate-500">Total Earned</p>
                <p className="text-lg font-bold text-slate-800">{formatINR(234500)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-xs text-slate-500">This Month</p>
                <p className="text-lg font-bold text-emerald-700">{formatINR(34200)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Next payout: 01/04/2025 — {formatINR(12000)}</span>
            </div>
          </CardContent>
        </Card>

        {/* API Access */}
        <Card className="border-slate-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-600" />
              API Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Partner API Key</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={apiKey}
                  className="h-9 text-xs bg-slate-50 font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyApiKey}
                  className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {apiKeyCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-slate-600">Quick Links</p>
              <div className="space-y-1.5">
                <button className="flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700 w-full text-left">
                  <ArrowRight className="h-3 w-3" />
                  Integration Documentation
                </button>
                <button className="flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700 w-full text-left">
                  <ArrowRight className="h-3 w-3" />
                  API Sandbox Environment
                </button>
                <button className="flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700 w-full text-left">
                  <ArrowRight className="h-3 w-3" />
                  Webhook Configuration
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5">
              <Zap className="h-3.5 w-3.5" />
              <span>API rate limit: 1,000 requests/hour (Gold tier)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Co-Marketing Opportunities */}
      <Card className="border-slate-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-600" />
            Co-Marketing Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: 'Joint Webinars',
                desc: 'Host GST compliance webinars with VEYRO branding',
                icon: '🎥',
                status: 'Available',
              },
              {
                title: 'Blog Features',
                desc: 'Get featured on VEYRO blog with your firm profile',
                icon: '📝',
                status: 'Apply Now',
              },
              {
                title: 'Event Sponsorship',
                desc: 'Co-sponsor ICAI events and CA conferences',
                icon: '🏆',
                status: 'Waitlisted',
              },
            ].map((item) => (
              <div key={item.title} className="p-3 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors">
                <span className="text-xl">{item.icon}</span>
                <p className="text-sm font-semibold text-slate-700 mt-2">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                <Badge
                  variant="outline"
                  className={`mt-2 text-[10px] h-5 ${
                    item.status === 'Available' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                    item.status === 'Apply Now' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                    'border-slate-200 text-slate-500 bg-slate-50'
                  }`}
                >
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function NetworkEffectsPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Share2 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Network Effects</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 ml-10">
            Grow your network, earn rewards, unlock partner benefits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
            <Activity className="h-3 w-3 mr-1" />
            Network Active
          </Badge>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100/80 h-10 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-xs px-3"
          >
            <Globe className="h-3.5 w-3.5 mr-1.5" />
            Network Overview
          </TabsTrigger>
          <TabsTrigger
            value="invite"
            className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-xs px-3"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invite System
          </TabsTrigger>
          <TabsTrigger
            value="referral"
            className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-xs px-3"
          >
            <Gift className="h-3.5 w-3.5 mr-1.5" />
            Referral Engine
          </TabsTrigger>
          <TabsTrigger
            value="partner"
            className="data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-xs px-3"
          >
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            Partner Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <NetworkOverviewTab />
        </TabsContent>
        <TabsContent value="invite">
          <InviteSystemTab />
        </TabsContent>
        <TabsContent value="referral">
          <ReferralEngineTab />
        </TabsContent>
        <TabsContent value="partner">
          <PartnerDashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
