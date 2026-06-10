'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  isAfter,
  addDays,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import type { GSTRFiling, FilingCalendarItem, Client } from '@/types/gst';
import {
  getFilingDueDate,
  periodToLabel,
  isOverdue,
  formatCurrency,
} from '@/lib/gst-utils';
import { useApp } from '@/contexts/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientOption {
  id: string;
  tradeName: string;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────
function SummarySkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="h-80 bg-muted animate-pulse rounded-lg" />
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function FilingCalendarPage() {
  const { selectedClientId, setSelectedClientId, setCurrentView } = useApp();

  // Data state
  const [filings, setFilings] = useState<GSTRFiling[]>([]);
  const [calendarItems, setCalendarItems] = useState<FilingCalendarItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filter state
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterReturnType, setFilterReturnType] = useState<string>('all');

  // Detail dialog
  const [selectedItem, setSelectedItem] = useState<FilingCalendarItem | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // ─── Fetch data ──────────────────────────────────────────────────────────
  const fetchFilings = useCallback(async () => {
    try {
      setLoading(true);
      const [filingsRes, dashboardRes] = await Promise.all([
        fetch('/api/gstr-filing'),
        fetch('/api/dashboard'),
      ]);

      if (filingsRes.ok) {
        const filingsData = await filingsRes.json();
        setFilings(filingsData.filings ?? []);
      }

      if (dashboardRes.ok) {
        const dashData = await dashboardRes.json();
        setCalendarItems(dashData.filingCalendar ?? []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (!res.ok) return;
      const data = await res.json();
      setClients(
        (data.clients ?? []).map((c: { id: string; tradeName: string }) => ({
          id: c.id,
          tradeName: c.tradeName,
        }))
      );
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchFilings();
  }, [fetchClients, fetchFilings]);

  // Sync with global client selection
  useEffect(() => {
    if (selectedClientId) {
      setFilterClient(selectedClientId);
    }
  }, [selectedClientId]);

  // ─── Build calendar items from filings if API doesn't provide them ──────
  const allCalendarItems = useMemo<FilingCalendarItem[]>(() => {
    if (calendarItems.length > 0) {
      return calendarItems;
    }
    // Fallback: build from filings
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
        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);
        if (isBefore(dueDateObj, sevenDaysFromNow) && isAfter(dueDateObj, now)) {
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
        clientName: f.client?.tradeName ?? 'Unknown',
      };
    });
  }, [calendarItems, filings]);

  // ─── Apply filters ──────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return allCalendarItems.filter((item) => {
      if (filterClient !== 'all' && item.clientId !== filterClient)
        return false;
      if (
        filterReturnType !== 'all' &&
        item.returnType !== filterReturnType
      )
        return false;
      return true;
    });
  }, [allCalendarItems, filterClient, filterReturnType]);

  // ─── Summary counts ─────────────────────────────────────────────────────
  const now = new Date();
  const sevenDaysFromNow = addDays(now, 7);

  const upcomingCount = filteredItems.filter((item) => {
    const dueDate = new Date(item.dueDate);
    return (
      item.status !== 'filed' &&
      isAfter(dueDate, now) &&
      isBefore(dueDate, sevenDaysFromNow)
    );
  }).length;

  const pendingCount = filteredItems.filter(
    (item) => item.status === 'pending'
  ).length;

  const overdueCount = filteredItems.filter(
    (item) => item.status === 'overdue'
  ).length;

  const filedThisMonthCount = filteredItems.filter((item) => {
    if (item.status !== 'filed') return false;
    const dueDate = new Date(item.dueDate);
    return (
      dueDate.getMonth() === now.getMonth() &&
      dueDate.getFullYear() === now.getFullYear()
    );
  }).length;

  // ─── Calendar grid data ─────────────────────────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Map due dates to items for quick lookup
  const dueDateMap = useMemo(() => {
    const map = new Map<string, FilingCalendarItem[]>();
    filteredItems.forEach((item) => {
      const key = item.dueDate;
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    });
    return map;
  }, [filteredItems]);

  // ─── Categorized filing lists ───────────────────────────────────────────
  const upcomingFilings = filteredItems.filter((item) => {
    const dueDate = new Date(item.dueDate);
    return (
      item.status !== 'filed' &&
      isAfter(dueDate, now) &&
      isBefore(dueDate, sevenDaysFromNow)
    );
  });

  const pendingFilings = filteredItems.filter(
    (item) => item.status === 'pending'
  );

  const overdueFilings = filteredItems.filter(
    (item) => item.status === 'overdue'
  );

  const filedFilings = filteredItems.filter(
    (item) => item.status === 'filed'
  );

  // ─── Helpers ────────────────────────────────────────────────────────────
  function getStatusBadge(status: FilingCalendarItem['status']) {
    switch (status) {
      case 'upcoming':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
            Upcoming
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">
            Pending
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">
            Overdue
          </Badge>
        );
      case 'filed':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
            Filed
          </Badge>
        );
    }
  }

  function getDotColor(status: FilingCalendarItem['status']): string {
    switch (status) {
      case 'upcoming':
        return 'bg-emerald-500';
      case 'pending':
        return 'bg-amber-500';
      case 'overdue':
        return 'bg-red-500';
      case 'filed':
        return 'bg-emerald-600';
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ─── Filing list item ───────────────────────────────────────────────────
  function FilingListItem({ item }: { item: FilingCalendarItem }) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => {
          setSelectedItem(item);
          setDetailOpen(true);
        }}
      >
        <div
          className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${
            item.status === 'overdue'
              ? 'bg-red-50'
              : item.status === 'pending'
              ? 'bg-amber-50'
              : item.status === 'filed'
              ? 'bg-emerald-50'
              : 'bg-emerald-50'
          }`}
        >
          <FileText
            className={`h-5 w-5 ${
              item.status === 'overdue'
                ? 'text-red-600'
                : item.status === 'pending'
                ? 'text-amber-600'
                : item.status === 'filed'
                ? 'text-emerald-600'
                : 'text-emerald-500'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">
              {item.clientName}
            </p>
            <span className="text-xs text-muted-foreground">
              {item.returnType}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {periodToLabel(item.period)} &middot; Due: {formatDate(item.dueDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge(item.status)}
          {item.status !== 'filed' && (
            <Button
              size="sm"
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentView('gstr-filing');
              }}
            >
              File Now
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem(item);
              setDetailOpen(true);
            }}
          >
            View
          </Button>
        </div>
      </div>
    );
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            GST Filing Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track filing deadlines and manage your return schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Client filter */}
          <Select
            value={filterClient}
            onValueChange={(val) => {
              setFilterClient(val);
              setSelectedClientId(val === 'all' ? null : val);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.tradeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Return type filter */}
          <Select value={filterReturnType} onValueChange={setFilterReturnType}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Return Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="GSTR-1">GSTR-1</SelectItem>
              <SelectItem value="GSTR-3B">GSTR-3B</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== Summary Cards ===== */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummarySkeleton />
          <SummarySkeleton />
          <SummarySkeleton />
          <SummarySkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Upcoming */}
          <Card className="hover:shadow-md transition-shadow border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-100">
                  <Clock className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700">
                    Upcoming
                  </p>
                  <p className="text-3xl font-bold text-emerald-700">
                    {upcomingCount}
                  </p>
                  <p className="text-xs text-emerald-600/70">Next 7 days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card className="hover:shadow-md transition-shadow border-amber-200 bg-amber-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-100">
                  <FileText className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-700">
                    Pending
                  </p>
                  <p className="text-3xl font-bold text-amber-700">
                    {pendingCount}
                  </p>
                  <p className="text-xs text-amber-600/70">Awaiting filing</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overdue */}
          <Card className="hover:shadow-md transition-shadow border-red-200 bg-red-50/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">Overdue</p>
                  <p className="text-3xl font-bold text-red-700">
                    {overdueCount}
                  </p>
                  <p className="text-xs text-red-600/70">Past deadline</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filed This Month */}
          <Card className="hover:shadow-md transition-shadow border-emerald-200 bg-emerald-50/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700">
                    Filed This Month
                  </p>
                  <p className="text-3xl font-bold text-emerald-700">
                    {filedThisMonthCount}
                  </p>
                  <p className="text-xs text-emerald-600/70">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== Calendar + Filing List Layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== Calendar View ===== */}
        {loading ? (
          <div className="lg:col-span-3">
            <CalendarSkeleton />
          </div>
        ) : (
          <Card className="hover:shadow-md transition-shadow lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  Monthly View
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold min-w-[140px] text-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>Filing due dates for the month</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Calendar Grid */}
              <div className="border rounded-lg overflow-hidden">
                {/* Week day headers */}
                <div className="grid grid-cols-7 bg-muted/50">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="p-2 text-center text-xs font-medium text-muted-foreground border-b"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {days.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayItems = dueDateMap.get(dateKey) ?? [];
                    const isCurrentMonth =
                      day.getMonth() === currentMonth.getMonth() &&
                      day.getFullYear() === currentMonth.getFullYear();
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={idx}
                        className={`min-h-[80px] p-1.5 border-b border-r border-border/50 ${
                          !isCurrentMonth ? 'bg-muted/20' : ''
                        } ${isToday ? 'bg-emerald-50/50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-medium ${
                              isToday
                                ? 'bg-emerald-600 text-white rounded-full h-6 w-6 flex items-center justify-center'
                                : isCurrentMonth
                                ? 'text-foreground'
                                : 'text-muted-foreground/50'
                            }`}
                          >
                            {format(day, 'd')}
                          </span>
                          {dayItems.length > 0 && (
                            <div className="flex items-center gap-0.5">
                              {dayItems.slice(0, 3).map((item, i) => (
                                <div
                                  key={i}
                                  className={`h-2 w-2 rounded-full ${getDotColor(
                                    item.status
                                  )}`}
                                  title={`${item.returnType} - ${item.clientName}`}
                                />
                              ))}
                              {dayItems.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{dayItems.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Show filing badges */}
                        <div className="mt-1 space-y-0.5">
                          {dayItems.slice(0, 2).map((item, i) => (
                            <div
                              key={i}
                              className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-pointer ${
                                item.status === 'overdue'
                                  ? 'bg-red-100 text-red-700'
                                  : item.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : item.status === 'filed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-emerald-50 text-emerald-600'
                              }`}
                              onClick={() => {
                                setSelectedItem(item);
                                setDetailOpen(true);
                              }}
                              title={`${item.returnType} - ${item.clientName}`}
                            >
                              {item.returnType}
                            </div>
                          ))}
                          {dayItems.length > 2 && (
                            <span className="text-[10px] text-muted-foreground px-1">
                              +{dayItems.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Upcoming/Filed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span>Overdue</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== Filing List View ===== */}
        {loading ? (
          <div className="lg:col-span-2 space-y-4">
            <ListSkeleton />
            <ListSkeleton />
          </div>
        ) : (
          <div className="lg:col-span-2 space-y-4 max-h-[800px] overflow-y-auto">
            {/* Upcoming Returns */}
            {upcomingFilings.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5 text-emerald-500" />
                    Upcoming Returns
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-auto">
                      {upcomingFilings.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Due within the next 7 days</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {upcomingFilings.map((item) => (
                    <FilingListItem key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Pending Returns */}
            {pendingFilings.length > 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5 text-amber-500" />
                    Pending Returns
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 ml-auto">
                      {pendingFilings.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Awaiting filing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 max-h-64 overflow-y-auto">
                  {pendingFilings.map((item) => (
                    <FilingListItem key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Overdue Returns */}
            {overdueFilings.length > 0 && (
              <Card className="hover:shadow-md transition-shadow border-red-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Overdue Returns
                    <Badge className="bg-red-50 text-red-700 border-red-200 ml-auto">
                      {overdueFilings.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Past their due date</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 max-h-64 overflow-y-auto">
                  {overdueFilings.map((item) => (
                    <FilingListItem key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Filed Returns */}
            {filedFilings.length > 0 && (
              <Card className="hover:shadow-md transition-shadow border-emerald-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    Filed Returns
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 ml-auto">
                      {filedFilings.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Successfully filed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 max-h-64 overflow-y-auto">
                  {filedFilings.map((item) => (
                    <FilingListItem key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            )}

            {filteredItems.length === 0 && (
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No filing schedule found for the selected filters.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ===== Filing Detail Dialog ===== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  {selectedItem.returnType} — {selectedItem.clientName}
                </DialogTitle>
                <DialogDescription>
                  Filing details and due date information
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Return Type
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {selectedItem.returnType}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Period
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {periodToLabel(selectedItem.period)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Due Date
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {formatDate(selectedItem.dueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Status
                    </p>
                    <div className="mt-1">
                      {getStatusBadge(selectedItem.status)}
                    </div>
                  </div>
                </div>

                {selectedItem.status === 'overdue' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    <p className="text-sm text-red-700">
                      This return is past its due date. Please file immediately
                      to avoid penalties.
                    </p>
                  </div>
                )}

                {selectedItem.status === 'upcoming' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-700">
                      This return is due soon. Make sure to prepare and file
                      before the deadline.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {selectedItem.status !== 'filed' && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setDetailOpen(false);
                      setCurrentView('gstr-filing');
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    File Now
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setDetailOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
