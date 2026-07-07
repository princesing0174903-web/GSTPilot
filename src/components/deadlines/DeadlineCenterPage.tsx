'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Shield,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  ArrowRight,
  Zap,
  TrendingUp,
  Circle,
  FileCheck,
  AlertOctagon,
  Timer,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, getDay, eachDayOfInterval, isSameDay, isToday, isPast, isBefore, isAfter, parseISO, isValid } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import type { FilingCalendarItem, GSTRFiling } from '@/types/gst';
import { periodToLabel, getFilingDueDate, isOverdue } from '@/lib/gst-utils';
import { useFireReturns, useFireClients } from '@/hooks/use-firestore';
import type { FirestoreReturn, FirestoreClient } from '@/lib/firestore-schema';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

// ── Types ────────────────────────────────────────────────────────────────────

type FireReturn = FirestoreReturn & { id: string };
type FireClient = FirestoreClient & { id: string };

interface DeadlineEntry {
  id: string;
  returnType: string;
  dueDate: string;
  period: string;
  status: 'filed' | 'pending' | 'overdue' | 'upcoming';
  clientName: string;
  clientId: string;
}

interface DeadlineCardData {
  returnType: string;
  label: string;
  icon: React.ReactNode;
  dueDate: string;
  dueDay: string;
  totalClients: number;
  filedClients: number;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  progressColor: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const RETURN_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string; progressColor: string; icon: string }> = {
  'GSTR-1': {
    label: 'GSTR-1 (Outward Supply)',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    progressColor: 'bg-emerald-500',
    icon: '📤',
  },
  'GSTR-3B': {
    label: 'GSTR-3B (Summary Return)',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
    progressColor: 'bg-amber-500',
    icon: '📋',
  },
  'GSTR-2B': {
    label: 'GSTR-2B (Inward Supply)',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
    progressColor: 'bg-purple-500',
    icon: '📥',
  },
  'GSTR-9': {
    label: 'GSTR-9 (Annual Return)',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    dotColor: 'bg-teal-500',
    progressColor: 'bg-teal-500',
    icon: '📊',
  },
  'TDS/TCS': {
    label: 'TDS/TCS Return',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
    progressColor: 'bg-orange-500',
    icon: '💰',
  },
};

// ── Animation Variants ───────────────────────────────────────────────────────

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

// ── Skeleton Loaders ─────────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Helper Functions ─────────────────────────────────────────────────────────

// Maps a Firestore return row to a GSTRFiling for the local UI.
function mapReturnToFiling(r: FireReturn, clientName: string): GSTRFiling {
  return {
    id: r.returnId,
    clientId: r.clientId,
    returnType: r.returnType,
    period: r.period,
    financialYear: r.financialYear,
    status: r.status,
    filedDate: r.filedDate ?? undefined,
    acknowledgmentNumber: r.acknowledgmentNumber ?? undefined,
    totalInvoices: r.totalInvoices,
    readyForFiling: r.readyForFiling,
    issuesFound: r.issuesFound,
    criticalErrors: r.criticalErrors,
    warnings: r.warnings,
    totalTaxableValue: r.totalTaxableValue,
    totalTax: r.totalTax,
    jsonPayload: r.jsonPayload ?? undefined,
    createdAt: (r.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (r.updatedAt as string) ?? new Date().toISOString(),
  };
}

function getGstr1DueDate(year: number, month: number): Date {
  // 11th of following month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 11);
}

function getGstr3BDueDate(year: number, month: number): Date {
  // 20th of following month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 20);
}

function getGstr2BDueDate(year: number, month: number): Date {
  // 13th of following month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 13);
}

function getAnnualReturnDueDate(year: number): Date {
  // December 31st of following year
  return new Date(year + 1, 11, 31);
}

function getTDSTCSDueDate(year: number, month: number): Date {
  // 10th of following month
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, 10);
}

function getDaysRemaining(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return differenceInDays(due, today);
}

function getDaysOverdue(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return differenceInDays(today, due);
}

function getStatusForDeadline(dueDate: Date, filedCount: number, totalCount: number): 'filed' | 'pending' | 'overdue' | 'upcoming' {
  if (filedCount >= totalCount && totalCount > 0) return 'filed';
  const daysRem = getDaysRemaining(dueDate);
  if (daysRem < 0) return 'overdue';
  if (daysRem <= 7) return 'pending';
  return 'upcoming';
}

function formatDaysRemaining(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

// ── Calendar Day Cell Component ──────────────────────────────────────────────

interface CalendarDayCellProps {
  day: number;
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  deadlines: DeadlineEntry[];
  isSelected: boolean;
  onClick: () => void;
}

function CalendarDayCell({ day, isCurrentMonth, isTodayDate, deadlines, isSelected, onClick }: CalendarDayCellProps) {
  const hasDeadlines = deadlines.length > 0;

  // Group deadlines by type to show colored dots
  const deadlineTypes = useMemo(() => {
    const types = new Set<string>();
    deadlines.forEach(d => types.add(d.returnType));
    return Array.from(types);
  }, [deadlines]);

  const hasOverdue = deadlines.some(d => d.status === 'overdue');

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center h-11 md:h-12 rounded-lg text-sm font-medium
        transition-colors cursor-pointer
        ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'}
        ${isTodayDate ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-card bg-emerald-50/50 dark:bg-emerald-950/30' : ''}
        ${isSelected && !isTodayDate ? 'bg-accent' : ''}
        ${!isTodayDate && !isSelected ? 'hover:bg-accent/50' : ''}
        ${hasOverdue ? 'bg-red-50/60 dark:bg-red-950/20' : ''}
      `}
    >
      <span className={`${isTodayDate ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''}`}>
        {day}
      </span>
      {hasDeadlines && (
        <div className="flex items-center gap-0.5 mt-0.5 absolute bottom-1">
          {deadlineTypes.slice(0, 3).map((type, idx) => {
            const config = RETURN_TYPE_CONFIG[type];
            const dotColor = deadlines.find(d => d.returnType === type)?.status === 'overdue'
              ? 'bg-red-500'
              : config?.dotColor || 'bg-slate-400';
            return (
              <span
                key={idx}
                className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor} ${hasOverdue && deadlines.find(d => d.returnType === type)?.status === 'overdue' ? 'animate-pulse' : ''}`}
              />
            );
          })}
          {deadlineTypes.length > 3 && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
          )}
        </div>
      )}
    </motion.button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DeadlineCenterPage() {
  const { setCurrentView } = useApp();

  // ─── Firestore data (real-time) ─────────────────────────────────────────
  const {
    data: returnDocs,
    loading: returnsLoading,
    error: returnsError,
  } = useFireReturns();
  const {
    data: clientDocs,
    loading: clientsLoading,
    error: clientsError,
  } = useFireClients();

  // State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Build client lookup map
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    (clientDocs as unknown as FireClient[]).forEach((c) => {
      m.set(c.clientId, c.tradeName);
    });
    return m;
  }, [clientDocs]);

  // Map Firestore returns → GSTRFiling[] + FilingCalendarItem[]
  const filings = useMemo<GSTRFiling[]>(
    () =>
      (returnDocs as unknown as FireReturn[]).map((r) =>
        mapReturnToFiling(r, clientMap.get(r.clientId) ?? 'Unknown'),
      ),
    [returnDocs, clientMap],
  );

  const calendarItems = useMemo<FilingCalendarItem[]>(() => {
    return filings.map((f) => {
      const dueDate = getFilingDueDate(f.returnType, f.period);
      const overdue = isOverdue(f.period);
      let status: FilingCalendarItem['status'];
      if (f.status === 'filed') {
        status = 'filed';
      } else if (overdue) {
        status = 'overdue';
      } else {
        const dueDateObj = new Date(dueDate);
        const today = new Date();
        const sevenDaysFromNow = addDays(today, 7);
        if (isBefore(dueDateObj, sevenDaysFromNow) && isAfter(dueDateObj, today)) {
          status = 'upcoming';
        } else {
          status = 'pending';
        }
      }
      return {
        id: f.id,
        returnType: f.returnType,
        period: f.period,
        dueDate,
        status,
        clientId: f.clientId,
        clientName: clientMap.get(f.clientId) ?? 'Unknown',
      };
    });
  }, [filings, clientMap]);

  const loading = returnsLoading || clientsLoading;
  const error = returnsError || clientsError;

  // Period state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12

  // ── Data Fetching (no-op — Firestore hooks provide real-time data) ──────

  // ── Derived Data ─────────────────────────────────────────────────────────

  // Map calendar items to deadline entries with computed due dates
  const deadlineEntries: DeadlineEntry[] = useMemo(() => {
    return calendarItems.map(item => ({
      id: item.id,
      returnType: item.returnType,
      dueDate: item.dueDate,
      period: item.period,
      status: item.status,
      clientName: item.clientName,
      clientId: item.clientId,
    }));
  }, [calendarItems]);

  // Generate comprehensive deadline entries for the selected month
  const monthlyDeadlines: DeadlineEntry[] = useMemo(() => {
    const entries: DeadlineEntry[] = [...deadlineEntries];

    // Add default GST deadlines if not covered by API data
    const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const defaultReturnTypes = ['GSTR-1', 'GSTR-3B', 'GSTR-2B', 'TDS/TCS'];

    for (const rt of defaultReturnTypes) {
      const existing = entries.find(e => e.returnType === rt && e.period === period);
      if (!existing) {
        let dueDate: Date;
        switch (rt) {
          case 'GSTR-1':
            dueDate = getGstr1DueDate(selectedYear, selectedMonth);
            break;
          case 'GSTR-3B':
            dueDate = getGstr3BDueDate(selectedYear, selectedMonth);
            break;
          case 'GSTR-2B':
            dueDate = getGstr2BDueDate(selectedYear, selectedMonth);
            break;
          case 'TDS/TCS':
            dueDate = getTDSTCSDueDate(selectedYear, selectedMonth);
            break;
          default:
            dueDate = getGstr1DueDate(selectedYear, selectedMonth);
        }

        const daysRem = getDaysRemaining(dueDate);
        let status: DeadlineEntry['status'] = 'upcoming';
        if (daysRem < 0) status = 'overdue';
        else if (daysRem <= 7) status = 'pending';

        entries.push({
          id: `default-${rt}-${period}`,
          returnType: rt,
          dueDate: format(dueDate, 'yyyy-MM-dd'),
          period,
          status,
          clientName: 'All Clients',
          clientId: 'all',
        });
      }
    }

    return entries;
  }, [deadlineEntries, selectedYear, selectedMonth]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = addDays(today, 7);

    const upcomingCount = monthlyDeadlines.filter(d => {
      const dueDate = parseISO(d.dueDate);
      return isValid(dueDate) && !isBefore(dueDate, today) && isBefore(dueDate, nextWeek) && d.status !== 'filed';
    }).length;

    const overdueCount = monthlyDeadlines.filter(d => d.status === 'overdue').length;

    const filedThisMonth = filings.filter(f => {
      if (f.status !== 'filed' || !f.filedDate) return false;
      const filedDate = parseISO(f.filedDate);
      return isValid(filedDate) && filedDate.getMonth() === today.getMonth() && filedDate.getFullYear() === today.getFullYear();
    }).length;

    const total = monthlyDeadlines.length;
    const filed = monthlyDeadlines.filter(d => d.status === 'filed').length;
    const complianceRate = total > 0 ? Math.round((filed / total) * 100) : 100;

    return { upcomingCount, overdueCount, filedThisMonth, complianceRate };
  }, [monthlyDeadlines, filings]);

  // Calendar grid data
  const calendarGrid = useMemo(() => {
    const firstDay = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const lastDay = endOfMonth(new Date(selectedYear, selectedMonth - 1));
    const startDayOfWeek = getDay(firstDay); // 0=Sun

    // Previous month days to fill the grid
    const prevMonthLastDay = new Date(selectedYear, selectedMonth - 1, 0).getDate();
    const prevMonthDays: { day: number; isCurrentMonth: false; date: Date }[] = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 2, prevMonthLastDay - i);
      prevMonthDays.push({ day: prevMonthLastDay - i, isCurrentMonth: false, date: d });
    }

    // Current month days
    const currentMonthDaysArr = eachDayOfInterval({ start: firstDay, end: lastDay });
    const currentMonthDays = currentMonthDaysArr.map(d => ({
      day: d.getDate(),
      isCurrentMonth: true as const,
      date: d,
    }));

    // Next month days
    const totalCells = prevMonthDays.length + currentMonthDays.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const nextMonthDays: { day: number; isCurrentMonth: false; date: Date }[] = [];
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(selectedYear, selectedMonth, i);
      nextMonthDays.push({ day: i, isCurrentMonth: false, date: d });
    }

    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }, [selectedYear, selectedMonth]);

  // Deadlines for selected date
  const selectedDateDeadlines = useMemo(() => {
    if (!selectedDate) return [];
    return monthlyDeadlines.filter(d => {
      const dueDate = parseISO(d.dueDate);
      return isValid(dueDate) && isSameDay(dueDate, selectedDate);
    });
  }, [selectedDate, monthlyDeadlines]);

  // Deadlines for calendar markers
  const getDeadlinesForDate = useCallback((date: Date) => {
    return monthlyDeadlines.filter(d => {
      const dueDate = parseISO(d.dueDate);
      return isValid(dueDate) && isSameDay(dueDate, date);
    });
  }, [monthlyDeadlines]);

  // Timeline deadlines (sorted by due date, next 14 days + overdue)
  const timelineDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...monthlyDeadlines]
      .filter(d => d.clientId !== 'all' || d.status === 'overdue')
      .sort((a, b) => {
        const dateA = parseISO(a.dueDate);
        const dateB = parseISO(b.dueDate);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 12);
  }, [monthlyDeadlines]);

  // Deadline cards data (for the filing deadline cards grid)
  const deadlineCards: DeadlineCardData[] = useMemo(() => {
    const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const returnTypes = ['GSTR-1', 'GSTR-3B', 'GSTR-2B'];

    return returnTypes.map(rt => {
      const config = RETURN_TYPE_CONFIG[rt];
      let dueDate: Date;

      switch (rt) {
        case 'GSTR-1':
          dueDate = getGstr1DueDate(selectedYear, selectedMonth);
          break;
        case 'GSTR-3B':
          dueDate = getGstr3BDueDate(selectedYear, selectedMonth);
          break;
        case 'GSTR-2B':
          dueDate = getGstr2BDueDate(selectedYear, selectedMonth);
          break;
        default:
          dueDate = getGstr1DueDate(selectedYear, selectedMonth);
      }

      const periodFilings = filings.filter(f => f.returnType === rt && f.period === period);
      const totalClients = Math.max(periodFilings.length, 1);
      const filedClients = periodFilings.filter(f => f.status === 'filed').length;

      return {
        returnType: rt,
        label: config.label,
        icon: <span className="text-lg">{config.icon}</span>,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        dueDay: format(dueDate, 'dd MMM yyyy'),
        totalClients,
        filedClients,
        color: config.color,
        bgColor: config.bgColor,
        borderColor: config.borderColor,
        dotColor: config.dotColor,
        progressColor: config.progressColor,
      };
    });
  }, [selectedYear, selectedMonth, filings]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const goToToday = () => {
    const n = new Date();
    setSelectedYear(n.getFullYear());
    setSelectedMonth(n.getMonth() + 1);
    setSelectedDate(n);
  };

  // ── Status Badge ─────────────────────────────────────────────────────────

  function getStatusBadge(status: DeadlineEntry['status']) {
    switch (status) {
      case 'filed':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 text-[11px]">Filed</Badge>;
      case 'pending':
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[11px]">Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 text-[11px] animate-pulse">Overdue</Badge>;
      case 'upcoming':
        return <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[11px]">Upcoming</Badge>;
    }
  }

  function getCardStatusLabel(dueDate: string, filedCount: number, totalCount: number): { label: string; color: string; bgColor: string } {
    const due = parseISO(dueDate);
    if (!isValid(due)) return { label: 'Unknown', color: 'text-slate-600', bgColor: 'bg-slate-50' };
    const days = getDaysRemaining(due);

    if (filedCount >= totalCount && totalCount > 0) {
      return { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-50' };
    }
    if (days < 0) {
      return { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-50' };
    }
    if (days <= 3) {
      return { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-50' };
    }
    if (days <= 7) {
      return { label: 'Approaching', color: 'text-amber-700', bgColor: 'bg-amber-50' };
    }
    return { label: 'On Track', color: 'text-emerald-700', bgColor: 'bg-emerald-50' };
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* ─── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to load deadlines: {error}</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      )}
      {/* ─── Empty state (no returns yet) ───────────────────────────────── */}
      {!loading && !error && filings.length === 0 && (
        <Card className="border-emerald-200/60 dark:border-emerald-900/40">
          <CardContent className="py-6">
            <EmptyState
              icon={CalendarDays}
              title="No deadlines"
              description="Filing deadlines will appear here once returns are created."
              action={{
                label: 'Go to Filing Center',
                onClick: () => setCurrentView('gstr-filing'),
                variant: 'default',
                icon: ArrowRight,
              }}
            />
          </CardContent>
        </Card>
      )}
      {/* ═══════════════ PAGE HEADER ═══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-600/20 shrink-0">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Deadline Center</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              GST Filing Calendar &amp; Deadline Tracker
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950">
            <Timer className="h-3.5 w-3.5" />
            Current Period: {MONTHS_SHORT[selectedMonth - 1]} {selectedYear}
          </Badge>
          <div className="flex items-center gap-1">
            <Select
              value={String(selectedMonth)}
              onValueChange={v => setSelectedMonth(Number(v))}
            >
              <SelectTrigger size="sm" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedYear)}
              onValueChange={v => setSelectedYear(Number(v))}
            >
              <SelectTrigger size="sm" className="w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════ KPI ROW ═══════════════ */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* KPI 1: Upcoming Deadlines */}
          <motion.div variants={staggerItem}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-100/50 to-transparent dark:from-amber-900/20 rounded-bl-full" />
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Upcoming Deadlines</p>
                    <p className="text-3xl font-bold text-amber-600">{kpis.upcomingCount}</p>
                    <p className="text-xs text-muted-foreground">Next 7 days</p>
                  </div>
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950 group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* KPI 2: Overdue Filings */}
          <motion.div variants={staggerItem}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-100/50 to-transparent dark:from-red-900/20 rounded-bl-full" />
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Overdue Filings</p>
                    <p className="text-3xl font-bold text-red-600">{kpis.overdueCount}</p>
                    <p className="text-xs text-red-500 font-medium">Requires attention</p>
                  </div>
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950 group-hover:scale-110 transition-transform">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* KPI 3: Filed This Month */}
          <motion.div variants={staggerItem}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-100/50 to-transparent dark:from-emerald-900/20 rounded-bl-full" />
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Filed This Month</p>
                    <p className="text-3xl font-bold text-emerald-600">{kpis.filedThisMonth}</p>
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> On track
                    </p>
                  </div>
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* KPI 4: Compliance Rate */}
          <motion.div variants={staggerItem}>
            <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-100/50 to-transparent dark:from-teal-900/20 rounded-bl-full" />
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground font-medium">Compliance Rate</p>
                    <p className="text-3xl font-bold text-teal-600">{kpis.complianceRate}%</p>
                    <Progress value={kpis.complianceRate} className="h-1.5 w-24 mt-1" />
                  </div>
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-teal-50 dark:bg-teal-950 group-hover:scale-110 transition-transform">
                    <Shield className="h-6 w-6 text-teal-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* ═══════════════ CALENDAR VIEW + TIMELINE ═══════════════ */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><CalendarSkeleton /></div>
          <TimelineSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Calendar View (PRIMARY) ── */}
          <motion.div
            className="lg:col-span-2"
            {...fadeInUp}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-5 w-5 text-emerald-600" />
                      Filing Calendar
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      {MONTHS[selectedMonth - 1]} {selectedYear} — Deadline overview
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={goToToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 pt-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> GSTR-1
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> GSTR-3B
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> GSTR-2B
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> Overdue
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> TDS/TCS
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-4">
                {/* Day of week headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS_OF_WEEK.map(day => (
                    <div key={day} className="flex items-center justify-center h-8 text-xs font-semibold text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarGrid.map((cell, idx) => {
                    const dayDeadlines = cell.isCurrentMonth ? getDeadlinesForDate(cell.date) : [];
                    return (
                      <CalendarDayCell
                        key={idx}
                        day={cell.day}
                        isCurrentMonth={cell.isCurrentMonth}
                        isTodayDate={cell.isCurrentMonth && isToday(cell.date)}
                        deadlines={dayDeadlines}
                        isSelected={selectedDate ? isSameDay(cell.date, selectedDate) : false}
                        onClick={() => setSelectedDate(cell.date)}
                      />
                    );
                  })}
                </div>

                {/* Selected date detail */}
                <AnimatePresence mode="wait">
                  {selectedDate && selectedDateDeadlines.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4 border-t pt-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">
                          {format(selectedDate, 'EEEE, dd MMMM yyyy')}
                        </h4>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDate(null)}>
                          Clear
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {selectedDateDeadlines.map(deadline => {
                          const config = RETURN_TYPE_CONFIG[deadline.returnType];
                          return (
                            <motion.div
                              key={deadline.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                            >
                              <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${config?.bgColor || 'bg-slate-50'} shrink-0`}>
                                <span className="text-sm">{config?.icon || '📄'}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{deadline.returnType}</p>
                                  <span className="text-xs text-muted-foreground">{periodToLabel(deadline.period)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{deadline.clientName}</p>
                              </div>
                              {getStatusBadge(deadline.status)}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Deadline Timeline (RIGHT) ── */}
          <motion.div
            {...fadeInUp}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Deadline Timeline
                </CardTitle>
                <CardDescription>Upcoming &amp; overdue deadlines</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <ScrollArea className="h-[420px] pr-2">
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-red-400 via-amber-400 to-emerald-400 opacity-30" />

                    <div className="space-y-1">
                      {monthlyDeadlines
                        .filter(d => d.clientId !== 'all')
                        .sort((a, b) => {
                          const dateA = parseISO(a.dueDate);
                          const dateB = parseISO(b.dueDate);
                          return dateA.getTime() - dateB.getTime();
                        })
                        .slice(0, 15)
                        .map((deadline, idx) => {
                          const dueDate = parseISO(deadline.dueDate);
                          const isValidDate = isValid(dueDate);
                          const days = isValidDate ? getDaysRemaining(dueDate) : 0;
                          const daysOverdue = isValidDate ? getDaysOverdue(dueDate) : 0;
                          const config = RETURN_TYPE_CONFIG[deadline.returnType];
                          const isOverdueItem = deadline.status === 'overdue';

                          return (
                            <motion.div
                              key={deadline.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04 }}
                              className="flex items-start gap-3 relative pl-1 py-2"
                            >
                              {/* Timeline dot */}
                              <div className={`relative z-10 mt-1 flex items-center justify-center h-[30px] w-[30px] rounded-full shrink-0 ${
                                isOverdueItem
                                  ? 'bg-red-100 dark:bg-red-950'
                                  : deadline.status === 'filed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950'
                                  : deadline.status === 'pending'
                                  ? 'bg-amber-100 dark:bg-amber-950'
                                  : 'bg-slate-100 dark:bg-slate-800'
                              }`}>
                                <span className="text-xs">{config?.icon || '📄'}</span>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium truncate">{deadline.returnType}</p>
                                  {getStatusBadge(deadline.status)}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {deadline.clientName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {isValidDate ? format(dueDate, 'dd MMM') : '—'}
                                  </span>
                                  <Separator orientation="vertical" className="h-3" />
                                  <span className={`text-xs font-medium ${
                                    isOverdueItem
                                      ? 'text-red-600'
                                      : days <= 3
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                                  }`}>
                                    {isOverdueItem
                                      ? formatDaysRemaining(-daysOverdue)
                                      : formatDaysRemaining(days)
                                    }
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}

                      {/* Default deadline entries for the period */}
                      {monthlyDeadlines
                        .filter(d => d.clientId === 'all')
                        .sort((a, b) => {
                          const dateA = parseISO(a.dueDate);
                          const dateB = parseISO(b.dueDate);
                          return dateA.getTime() - dateB.getTime();
                        })
                        .map((deadline, idx) => {
                          const dueDate = parseISO(deadline.dueDate);
                          const isValidDate = isValid(dueDate);
                          const days = isValidDate ? getDaysRemaining(dueDate) : 0;
                          const config = RETURN_TYPE_CONFIG[deadline.returnType];
                          const isOverdueItem = deadline.status === 'overdue';

                          return (
                            <motion.div
                              key={deadline.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: (idx + 10) * 0.04 }}
                              className="flex items-start gap-3 relative pl-1 py-2"
                            >
                              <div className={`relative z-10 mt-1 flex items-center justify-center h-[30px] w-[30px] rounded-full shrink-0 ${
                                isOverdueItem
                                  ? 'bg-red-100 dark:bg-red-950'
                                  : deadline.status === 'pending'
                                  ? 'bg-amber-100 dark:bg-amber-950'
                                  : 'bg-slate-100 dark:bg-slate-800'
                              }`}>
                                <span className="text-xs">{config?.icon || '📄'}</span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium truncate">{deadline.returnType}</p>
                                  {getStatusBadge(deadline.status)}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  All Clients — {periodToLabel(deadline.period)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {isValidDate ? format(dueDate, 'dd MMM yyyy') : '—'}
                                  </span>
                                  <Separator orientation="vertical" className="h-3" />
                                  <span className={`text-xs font-medium ${
                                    isOverdueItem
                                      ? 'text-red-600'
                                      : days <= 3
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                                  }`}>
                                    {formatDaysRemaining(days)}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ═══════════════ DEADLINE CARDS GRID ═══════════════ */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Filing Deadlines — {MONTHS_SHORT[selectedMonth - 1]} {selectedYear}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-emerald-600 hover:text-emerald-700"
              onClick={() => setCurrentView('gstr-filing')}
            >
              Go to Filing Center <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {deadlineCards.map((card, idx) => {
              const statusInfo = getCardStatusLabel(card.dueDate, card.filedClients, card.totalClients);
              const progressPct = card.totalClients > 0 ? Math.round((card.filedClients / card.totalClients) * 100) : 0;
              const days = getDaysRemaining(parseISO(card.dueDate));

              return (
                <motion.div
                  key={card.returnType}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                >
                  <Card className={`hover:shadow-lg transition-all group border-l-4 ${card.borderColor} ${
                    statusInfo.label === 'Overdue' ? 'ring-1 ring-red-200 dark:ring-red-800' : ''
                  }`}>
                    <CardContent className="p-4 md:p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${card.bgColor} dark:bg-opacity-20 group-hover:scale-110 transition-transform`}>
                            {card.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{card.returnType}</p>
                            <p className="text-xs text-muted-foreground">{card.label.split('(')[1]?.replace(')', '') || ''}</p>
                          </div>
                        </div>
                        <Badge className={`${statusInfo.bgColor} ${statusInfo.color} border-0 text-[11px] font-medium`}>
                          {statusInfo.label === 'Overdue' && <AlertOctagon className="h-3 w-3 mr-1" />}
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Due Date */}
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
                        <p className="text-lg font-bold tracking-tight">{card.dueDay}</p>
                        <p className={`text-xs font-medium mt-0.5 ${
                          days < 0 ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {formatDaysRemaining(days)}
                        </p>
                      </div>

                      {/* Filing Progress */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">
                            Filing Progress
                          </span>
                          <span className="font-semibold">
                            {card.filedClients} of {card.totalClients} filed
                          </span>
                        </div>
                        <div className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.8, delay: 0.5 + idx * 0.1, ease: 'easeOut' as const }}
                            className={`absolute top-0 left-0 h-full rounded-full ${card.progressColor}`}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {progressPct}% complete
                        </p>
                      </div>

                      {/* Action */}
                      <Button
                        variant="outline"
                        size="sm"
                        className={`w-full mt-2 h-8 text-xs ${card.borderColor} ${card.color} hover:${card.bgColor}`}
                        onClick={() => setCurrentView('gstr-filing')}
                      >
                        {card.filedClients >= card.totalClients ? (
                          <>
                            <FileCheck className="h-3.5 w-3.5 mr-1" />
                            View Details
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            Start Filing
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══════════════ ANNUAL & TDS/TCS DEADLINES ═══════════════ */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-teal-600" />
                Additional GST Deadlines
              </CardTitle>
              <CardDescription>Annual returns &amp; TDS/TCS for the current period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* GSTR-9 Annual Return */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900 shrink-0">
                    <span className="text-lg">📊</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">GSTR-9 (Annual Return)</p>
                      <Badge className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800 text-[10px]">
                        FY {selectedYear - 1}-{String(selectedYear).slice(2)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: 31 Dec {selectedYear}
                    </p>
                    <p className="text-xs font-medium text-teal-600 mt-0.5">
                      {getDaysRemaining(getAnnualReturnDueDate(selectedYear - 1)) > 0
                        ? formatDaysRemaining(getDaysRemaining(getAnnualReturnDueDate(selectedYear - 1)))
                        : 'Overdue'
                      }
                    </p>
                  </div>
                </div>

                {/* TDS/TCS */}
                <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900 shrink-0">
                    <span className="text-lg">💰</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">TDS/TCS Return</p>
                      <Badge className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800 text-[10px]">
                        {MONTHS_SHORT[selectedMonth - 1]} {selectedYear}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {format(getTDSTCSDueDate(selectedYear, selectedMonth), 'dd MMM yyyy')}
                    </p>
                    <p className={`text-xs font-medium mt-0.5 ${
                      getDaysRemaining(getTDSTCSDueDate(selectedYear, selectedMonth)) < 0
                        ? 'text-red-600'
                        : getDaysRemaining(getTDSTCSDueDate(selectedYear, selectedMonth)) <= 3
                        ? 'text-amber-600'
                        : 'text-orange-600'
                    }`}>
                      {formatDaysRemaining(getDaysRemaining(getTDSTCSDueDate(selectedYear, selectedMonth)))}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
