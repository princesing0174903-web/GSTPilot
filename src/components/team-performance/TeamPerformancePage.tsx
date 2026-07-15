'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Users,
  Target,
  Clock,
  Award,
  TrendingUp,
  Activity,
  Sparkles,
  Zap,
  Shield,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/gst-utils';
import { EmptyState } from '@/components/shared';

// ─── Color Palette (Emerald/Teal — NO blue/indigo) ────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  tealDark: '#0d9488',
  tealLight: '#ccfbf1',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  red: '#ef4444',
  redLight: '#fee2e2',
  slate: '#64748b',
  slateLight: '#f1f5f9',
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar: string | null;
  rank: number;
  performanceScore: number;
  aggregatedMetrics: {
    invoicesProcessed: number;
    reviewsCompleted: number;
    approvalsCompleted: number;
    averageAccuracy: number;
    averageTurnaround: number;
  };
  workload: {
    pending: number;
    inProgress: number;
    completed: number;
  };
}

type RoleFilter = 'all' | 'auditor' | 'manager' | 'data_entry';

// ─── Initial state: empty (real data fetched from /api/team-performance) ───

// ─── Circular Performance Score ────────────────────────────────────────────
function PerformanceCircle({
  score,
  size = 48,
  strokeWidth = 5,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  const getColor = (s: number) => {
    if (s >= 90) return COLORS.emerald;
    if (s >= 80) return COLORS.teal;
    if (s >= 70) return COLORS.amber;
    return COLORS.red;
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 3px ${getColor(score)}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-foreground">{Math.round(score)}</span>
      </div>
    </div>
  );
}

// ─── Rank Badge ────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-md shadow-amber-500/30">
        <span className="text-xs font-bold text-white">1</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-md shadow-slate-400/30">
        <span className="text-xs font-bold text-white">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 shadow-md shadow-amber-700/30">
        <span className="text-xs font-bold text-white">3</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{rank}</span>
    </div>
  );
}

// ─── Avatar with initials ─────────────────────────────────────────────────
function InitialsAvatar({ name, index }: { name: string; index: number }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const gradients = [
    'from-emerald-400 to-teal-500',
    'from-teal-400 to-emerald-500',
    'from-emerald-500 to-green-600',
    'from-teal-500 to-cyan-600',
    'from-green-400 to-emerald-500',
    'from-emerald-300 to-teal-400',
  ];

  const gradient = gradients[index % gradients.length];

  return (
    <div className={`flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br ${gradient} shadow-sm shrink-0`}>
      <span className="text-xs font-bold text-white">{initials}</span>
    </div>
  );
}

// ─── Accuracy Color ────────────────────────────────────────────────────────
function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 95) return 'text-emerald-600 dark:text-emerald-400';
  if (accuracy >= 85) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getAccuracyBg(accuracy: number): string {
  if (accuracy >= 95) return 'bg-emerald-50 dark:bg-emerald-950/40';
  if (accuracy >= 85) return 'bg-amber-50 dark:bg-amber-950/40';
  return 'bg-red-50 dark:bg-red-950/40';
}

// ─── Role Badge ────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const roleConfig: Record<string, { label: string; classes: string }> = {
    auditor: { label: 'Auditor', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
    manager: { label: 'Manager', classes: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800' },
    data_entry: { label: 'Data Entry', classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  };

  const config = roleConfig[role] || { label: role, classes: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800' };

  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-semibold ${config.classes}`}>
      {config.label}
    </Badge>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────
function OverviewSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeptCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const kpiVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 26 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function TeamPerformancePage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [leaderboard, setLeaderboard] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/team-performance');
      if (res.ok) {
        const data = await res.json();
        if (data.leaderboard && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
          setLeaderboard(data.leaderboard);
        }
      } else {
        setError('Failed to fetch team performance data');
      }
    } catch (err) {
      console.error('TeamPerformance fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered leaderboard ─────────────────────────────────────────────────
  const filteredLeaderboard = useMemo(() => {
    if (roleFilter === 'all') return leaderboard;
    return leaderboard.filter(m => {
      if (roleFilter === 'auditor') return m.role === 'auditor';
      if (roleFilter === 'manager') return m.role === 'manager';
      if (roleFilter === 'data_entry') return m.role === 'data_entry';
      return true;
    });
  }, [leaderboard, roleFilter]);

  // ── Overview metrics ─────────────────────────────────────────────────────
  const overviewMetrics = useMemo(() => {
    const totalMembers = leaderboard.length;
    const avgAccuracy = leaderboard.length > 0
      ? Math.round(leaderboard.reduce((sum, m) => sum + m.aggregatedMetrics.averageAccuracy, 0) / leaderboard.length * 10) / 10
      : 0;
    const avgTurnaround = leaderboard.length > 0
      ? Math.round(leaderboard.reduce((sum, m) => sum + m.aggregatedMetrics.averageTurnaround, 0) / leaderboard.length * 10) / 10
      : 0;
    return { totalMembers, avgAccuracy, avgTurnaround };
  }, [leaderboard]);

  // ── Department breakdown ─────────────────────────────────────────────────
  const departmentBreakdown = useMemo(() => {
    const departments = new Map<string, { name: string; members: TeamMember[] }>();

    for (const member of leaderboard) {
      const dept = member.department || 'Unassigned';
      if (!departments.has(dept)) {
        departments.set(dept, { name: dept, members: [] });
      }
      departments.get(dept)!.members.push(member);
    }

    return Array.from(departments.values()).map(dept => {
      const memberCount = dept.members.length;
      const avgAccuracy = memberCount > 0
        ? Math.round(dept.members.reduce((s, m) => s + m.aggregatedMetrics.averageAccuracy, 0) / memberCount * 10) / 10
        : 0;
      const avgTurnaround = memberCount > 0
        ? Math.round(dept.members.reduce((s, m) => s + m.aggregatedMetrics.averageTurnaround, 0) / memberCount * 10) / 10
        : 0;
      const avgScore = memberCount > 0
        ? Math.round(dept.members.reduce((s, m) => s + m.performanceScore, 0) / memberCount * 10) / 10
        : 0;
      const totalInvoices = dept.members.reduce((s, m) => s + m.aggregatedMetrics.invoicesProcessed, 0);
      const totalReviews = dept.members.reduce((s, m) => s + m.aggregatedMetrics.reviewsCompleted, 0);

      return {
        name: dept.name,
        memberCount,
        avgAccuracy,
        avgTurnaround,
        avgScore,
        totalInvoices,
        totalReviews,
      };
    });
  }, [leaderboard]);

  // ── Role filter tabs config ──────────────────────────────────────────────
  const roleTabs: { value: RoleFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: leaderboard.length },
    { value: 'auditor', label: 'Auditors', count: leaderboard.filter(m => m.role === 'auditor').length },
    { value: 'manager', label: 'Managers', count: leaderboard.filter(m => m.role === 'manager').length },
    { value: 'data_entry', label: 'Data Entry', count: leaderboard.filter(m => m.role === 'data_entry').length },
  ];

  // ── Department icon ──────────────────────────────────────────────────────
  function getDeptIcon(dept: string) {
    switch (dept.toLowerCase()) {
      case 'audit':
        return <Shield className="h-5 w-5 text-emerald-500" />;
      case 'tax':
        return <Target className="h-5 w-5 text-teal-500" />;
      case 'compliance':
        return <FileCheck className="h-5 w-5 text-emerald-500" />;
      case 'data entry':
        return <Activity className="h-5 w-5 text-teal-500" />;
      default:
        return <Users className="h-5 w-5 text-slate-500" />;
    }
  }

  function getDeptGradient(dept: string): string {
    switch (dept.toLowerCase()) {
      case 'audit':
        return 'from-emerald-500 to-teal-500';
      case 'tax':
        return 'from-teal-500 to-emerald-500';
      case 'compliance':
        return 'from-emerald-400 to-green-500';
      case 'data entry':
        return 'from-teal-400 to-emerald-400';
      default:
        return 'from-slate-400 to-slate-500';
    }
  }

  // ═══ RENDER ══════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-700 to-emerald-600 dark:from-teal-400 dark:to-emerald-300 bg-clip-text text-transparent">
              Team Performance Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track individual and team performance metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Scored
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5 border-teal-200 text-teal-700 bg-teal-50/80 dark:border-teal-800 dark:text-teal-400 dark:bg-teal-950/40"
          >
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            Live
          </Badge>
        </div>
      </motion.div>

      {/* ═══ ROLE FILTER TABS ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex items-center gap-2 flex-wrap"
      >
        {roleTabs.map(tab => (
          <Button
            key={tab.value}
            size="sm"
            variant={roleFilter === tab.value ? 'default' : 'outline'}
            onClick={() => setRoleFilter(tab.value)}
            className={`gap-1.5 h-8 text-xs ${
              roleFilter === tab.value
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              roleFilter === tab.value
                ? 'bg-emerald-700/50 text-emerald-100'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {tab.count}
            </span>
          </Button>
        ))}
      </motion.div>

      {/* ═══ PERFORMANCE OVERVIEW ROW (3 metric cards) ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <OverviewSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* Total Team Members */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Total Team Members</p>
                    <p className="text-3xl font-bold text-foreground">
                      {formatNumber(overviewMetrics.totalMembers)}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <UserCheck className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    <Users className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            </Card>
          </motion.div>

          {/* Average Accuracy */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Average Accuracy</p>
                    <p className={`text-3xl font-bold ${getAccuracyColor(overviewMetrics.avgAccuracy)}`}>
                      {overviewMetrics.avgAccuracy}%
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <Target className="h-3 w-3 text-teal-500" />
                      <span className="text-muted-foreground">Across team</span>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center h-14 w-14 rounded-xl ${getAccuracyBg(overviewMetrics.avgAccuracy)}`}>
                    <Target className="h-7 w-7 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-teal-500" />
            </Card>
          </motion.div>

          {/* Average Turnaround */}
          <motion.div variants={kpiVariants}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Average Turnaround</p>
                    <p className="text-3xl font-bold text-foreground">
                      {overviewMetrics.avgTurnaround}
                      <span className="text-sm font-normal text-muted-foreground ml-1">hrs</span>
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3 text-amber-500" />
                      <span className="text-muted-foreground">Processing speed</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-amber-50 dark:bg-amber-950/40">
                    <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══ LEADERBOARD SECTION ═══ */}
      {loading ? (
        <LeaderboardSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Card className="border-border/50 backdrop-blur-sm bg-card/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="h-5 w-5 text-emerald-500" />
                    Performance Leaderboard
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    Ranked by weighted performance score (accuracy, volume, speed, reviews)
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40"
                >
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  AI Scored
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[480px]">
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center text-[11px]">Rank</TableHead>
                        <TableHead className="text-[11px]">Member</TableHead>
                        <TableHead className="text-center text-[11px]">Invoices</TableHead>
                        <TableHead className="text-center text-[11px]">Reviews</TableHead>
                        <TableHead className="text-center text-[11px]">Approvals</TableHead>
                        <TableHead className="text-center text-[11px]">Accuracy</TableHead>
                        <TableHead className="text-center text-[11px]">Turnaround</TableHead>
                        <TableHead className="text-center text-[11px] w-16">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {filteredLeaderboard.map((member, index) => (
                          <motion.tr
                            key={member.id}
                            variants={rowVariants}
                            initial="hidden"
                            animate="show"
                            transition={{ delay: 0.3 + index * 0.06 }}
                            layout
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors border-b border-border/50"
                          >
                            <TableCell className="text-center py-3">
                              <RankBadge rank={member.rank} />
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2.5">
                                <InitialsAvatar name={member.name} index={index} />
                                <div>
                                  <p className="text-sm font-medium text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                                    {member.name}
                                  </p>
                                  <RoleBadge role={member.role} />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <span className="text-sm font-semibold text-foreground">
                                {formatNumber(member.aggregatedMetrics.invoicesProcessed)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <span className="text-sm font-semibold text-foreground">
                                {formatNumber(member.aggregatedMetrics.reviewsCompleted)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <span className="text-sm font-semibold text-foreground">
                                {formatNumber(member.aggregatedMetrics.approvalsCompleted)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <span className={`text-sm font-bold ${getAccuracyColor(member.aggregatedMetrics.averageAccuracy)}`}>
                                {member.aggregatedMetrics.averageAccuracy}%
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <span className="text-sm text-muted-foreground">
                                {member.aggregatedMetrics.averageTurnaround}h
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <div className="flex justify-center">
                                <PerformanceCircle score={member.performanceScore} />
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-2 p-3">
                  <AnimatePresence mode="popLayout">
                    {filteredLeaderboard.map((member, index) => (
                      <motion.div
                        key={member.id}
                        variants={rowVariants}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: 0.3 + index * 0.06 }}
                        layout
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-3 rounded-xl border border-border/50 hover:border-emerald-200/50 dark:hover:border-emerald-800/50 transition-all bg-card"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <RankBadge rank={member.rank} />
                          <InitialsAvatar name={member.name} index={index} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                            <RoleBadge role={member.role} />
                          </div>
                          <PerformanceCircle score={member.performanceScore} size={42} strokeWidth={4} />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                            <p className="text-[9px] text-muted-foreground uppercase font-semibold">Inv.</p>
                            <p className="text-xs font-bold text-foreground">{formatNumber(member.aggregatedMetrics.invoicesProcessed)}</p>
                          </div>
                          <div className="text-center p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                            <p className="text-[9px] text-muted-foreground uppercase font-semibold">Rev.</p>
                            <p className="text-xs font-bold text-foreground">{formatNumber(member.aggregatedMetrics.reviewsCompleted)}</p>
                          </div>
                          <div className="text-center p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                            <p className="text-[9px] text-muted-foreground uppercase font-semibold">Acc.</p>
                            <p className={`text-xs font-bold ${getAccuracyColor(member.aggregatedMetrics.averageAccuracy)}`}>
                              {member.aggregatedMetrics.averageAccuracy}%
                            </p>
                          </div>
                          <div className="text-center p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                            <p className="text-[9px] text-muted-foreground uppercase font-semibold">TAT</p>
                            <p className="text-xs font-bold text-foreground">{member.aggregatedMetrics.averageTurnaround}h</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Empty state */}
                {filteredLeaderboard.length === 0 && !loading && (
                  <EmptyState
                    icon={Users}
                    title="No team performance data yet"
                    description="Team member performance will appear here once data is synced from the /api/team-performance endpoint."
                  />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ DEPARTMENT BREAKDOWN ═══ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <DeptCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Department Breakdown</h2>
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-teal-200 text-teal-700 bg-teal-50/80 dark:border-teal-800 dark:text-teal-400 dark:bg-teal-950/40">
              {departmentBreakdown.length} Departments
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {departmentBreakdown.map((dept, index) => (
              <motion.div
                key={dept.name}
                variants={kpiVariants}
                whileHover={{ y: -2 }}
                className="transition-all"
              >
                <Card className="hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 relative overflow-hidden">
                  {/* Department gradient header */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${getDeptGradient(dept.name)}`} />

                  <CardContent className="p-5 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      {getDeptIcon(dept.name)}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{dept.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {dept.memberCount} {dept.memberCount === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="text-center p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Accuracy</p>
                        <p className={`text-sm font-bold ${getAccuracyColor(dept.avgAccuracy)}`}>
                          {dept.avgAccuracy}%
                        </p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100/50 dark:border-teal-900/30">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Avg TAT</p>
                        <p className="text-sm font-bold text-foreground">
                          {dept.avgTurnaround}h
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/60 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/30">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Score</p>
                        <p className="text-sm font-bold text-foreground">{dept.avgScore}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-[11px] text-muted-foreground">
                          {formatNumber(dept.totalInvoices)} inv. &middot; {formatNumber(dept.totalReviews)} rev.
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Empty state if no departments */}
            {departmentBreakdown.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 mb-3">
                  <Users className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-foreground">No department data</p>
                <p className="text-xs text-muted-foreground mt-1">Department breakdown will appear when team members are assigned</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══ ERROR STATE ═══ */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-8 text-center"
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950/40 mb-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Failed to load performance data</p>
          <p className="text-xs text-muted-foreground mb-3">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchData} className="gap-1.5 text-xs">
            <Zap className="h-3 w-3" />
            Retry
          </Button>
        </motion.div>
      )}
    </div>
  );
}
