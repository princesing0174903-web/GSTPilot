'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle AI™ — Artifact Renderer
//
// Renders the 8 artifact kinds (table, chart, report, document, code, json,
// kanban, metric) inside a shadcn Card. Used both inline in the chat thread
// and in the dedicated Artifacts panel.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Table as TableIcon,
  BarChart3,
  FileText,
  FileCode2,
  Braces,
  LayoutGrid,
  Gauge,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  ArtifactData,
  ArtifactKind,
  ChartArtifactData,
  CodeArtifactData,
  DocumentArtifactData,
  JsonArtifactData,
  KanbanArtifactData,
  MetricArtifactData,
  ReportArtifactData,
  TableArtifactData,
} from '@/lib/oracle-ai/types';

const CHART_COLORS = ['#2563EB', '#14b8a6', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const KIND_ICON: Record<ArtifactKind, React.ElementType> = {
  table: TableIcon,
  chart: BarChart3,
  report: FileText,
  document: FileText,
  code: FileCode2,
  json: Braces,
  kanban: LayoutGrid,
  metric: Gauge,
};

interface ArtifactRendererProps {
  kind: ArtifactKind;
  title: string;
  data: ArtifactData;
  compact?: boolean;
}

function TableRenderer({ data }: { data: TableArtifactData }) {
  if (!data.columns || data.columns.length === 0) {
    return <div className="text-sm text-muted-foreground">Empty table</div>;
  }
  const fmt = (val: unknown, type?: string): string => {
    if (val === null || val === undefined) return '—';
    if (type === 'currency') {
      const n = Number(val);
      if (!isFinite(n)) return String(val);
      if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
      if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
      return `₹${n.toLocaleString('en-IN')}`;
    }
    if (type === 'number') {
      const n = Number(val);
      return isFinite(n) ? n.toLocaleString('en-IN') : String(val);
    }
    return String(val);
  };
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {data.columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-medium text-muted-foreground ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.rows ?? []).map((row, i) => (
            <tr key={i} className="border-t border-border/40 hover:bg-muted/20">
              {data.columns.map((c) => {
                const val = row[c.key];
                const isBadge = c.type === 'badge';
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${
                      c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {isBadge ? (
                      <Badge variant="secondary" className="text-xs">{fmt(val, 'text')}</Badge>
                    ) : (
                      fmt(val, c.type)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {data.totals && Object.keys(data.totals).length > 0 && (
            <tr className="border-t-2 border-border bg-muted/30 font-medium">
              {data.columns.map((c) => {
                const total = data.totals?.[c.key];
                return (
                  <td
                    key={c.key}
                    className={`px-3 py-2 tabular-nums ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {total !== undefined ? fmt(total, c.type === 'currency' ? 'currency' : 'number') : ''}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
      {data.caption && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border/40">{data.caption}</div>
      )}
    </div>
  );
}

function ChartRenderer({ data }: { data: ChartArtifactData }) {
  const chartData = (data.categories ?? []).map((cat, i) => {
    const row: Record<string, unknown> = { name: cat };
    data.series.forEach((s) => {
      row[s.name] = s.data[i] ?? 0;
    });
    return row;
  });
  const tooltipStyle = {
    backgroundColor: 'rgba(12,12,14,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#fff',
  };
  const axisStyle = { fontSize: 11, fill: 'rgba(255,255,255,0.5)' };

  if (data.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data.series.map((s, i) => ({ name: s.name, value: s.data[0] ?? 0, fill: CHART_COLORS[i % CHART_COLORS.length] }))}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => entry.name as string}
            labelLine={false}
          >
            {data.series.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (data.type === 'radar') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="name" tick={axisStyle} />
          {data.series.map((s, i) => (
            <Radar key={s.name} name={s.name} dataKey={s.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.3} />
          ))}
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      {data.type === 'bar' ? (
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={axisStyle} stroke="rgba(255,255,255,0.2)" />
          <YAxis tick={axisStyle} stroke="rgba(255,255,255,0.2)" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {data.series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} stackId={data.stacked ? 'a' : undefined} />
          ))}
        </BarChart>
      ) : data.type === 'area' ? (
        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <defs>
            {data.series.map((s, i) => (
              <linearGradient key={s.name} id={`grad-${s.name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={axisStyle} stroke="rgba(255,255,255,0.2)" />
          <YAxis tick={axisStyle} stroke="rgba(255,255,255,0.2)" />
          <Tooltip contentStyle={tooltipStyle} />
          {data.series.map((s, i) => (
            <Area key={s.name} type="monotone" dataKey={s.name} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} fill={`url(#grad-${s.name})`} strokeWidth={2} />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={axisStyle} stroke="rgba(255,255,255,0.2)" />
          <YAxis tick={axisStyle} stroke="rgba(255,255,255,0.2)" />
          <Tooltip contentStyle={tooltipStyle} />
          {data.series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3, fill: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function ReportRenderer({ data }: { data: ReportArtifactData }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-emerald-400">Executive Summary</div>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{data.executiveSummary}</p>
      </div>
      {data.keyMetrics && data.keyMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.keyMetrics.map((m, i) => (
            <div key={i} className="rounded-md border border-border/60 bg-muted/20 p-2.5">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{m.value}</div>
              {m.delta && <div className="text-xs text-emerald-400">{m.delta}</div>}
            </div>
          ))}
        </div>
      )}
      {data.sections.map((s, i) => (
        <div key={i} className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">{s.heading}</h4>
          <p className="text-sm leading-relaxed text-foreground/80">{s.body}</p>
          {s.bullets && s.bullets.length > 0 && (
            <ul className="ml-4 list-disc space-y-0.5 text-sm text-foreground/80">
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {data.confidence !== undefined && (
        <div className="text-xs text-muted-foreground">
          Confidence: <span className="font-medium text-foreground">{Math.round(data.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}

function DocumentRenderer({ data }: { data: DocumentArtifactData }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{data.body}</pre>
    </div>
  );
}

function CodeRenderer({ data }: { data: CodeArtifactData }) {
  return (
    <div className="space-y-2">
      {data.fileName && (
        <div className="text-xs text-muted-foreground">{data.fileName}</div>
      )}
      <pre className="overflow-x-auto rounded-md border border-border/60 bg-black/40 p-3 text-xs leading-relaxed">
        <code className={`language-${data.language}`}>{data.code}</code>
      </pre>
    </div>
  );
}

function JsonRenderer({ data }: { data: JsonArtifactData }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border/60 bg-black/40 p-3 text-xs leading-relaxed">
      {JSON.stringify(data.value, null, 2)}
    </pre>
  );
}

function KanbanRenderer({ data }: { data: KanbanArtifactData }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {data.columns.map((col) => (
        <div key={col.id} className="min-w-[180px] flex-1 rounded-md border border-border/60 bg-muted/20 p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{col.title}</span>
            <Badge variant="secondary" className="text-[10px]">{col.cards.length}</Badge>
          </div>
          <div className="space-y-1.5">
            {col.cards.map((card) => (
              <div key={card.id} className="rounded border border-border/40 bg-background/60 p-2">
                <div className="text-xs font-medium text-foreground">{card.title}</div>
                {card.body && <div className="mt-0.5 text-[11px] text-muted-foreground">{card.body}</div>}
                {card.tags && card.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {card.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] px-1 py-0">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricRenderer({ data }: { data: MetricArtifactData }) {
  const trend = data.trend ?? [];
  const max = Math.max(...trend, 1);
  const min = Math.min(...trend, 0);
  const range = max - min || 1;
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{data.label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{data.value}</span>
          {data.unit && <span className="text-xs text-muted-foreground">{data.unit}</span>}
          {data.delta !== undefined && (
            <span className={`text-xs font-medium ${data.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.delta >= 0 ? '▲' : '▼'} {Math.abs(data.delta).toFixed(1)}%
              {data.deltaLabel && <span className="ml-1 text-muted-foreground">{data.deltaLabel}</span>}
            </span>
          )}
        </div>
      </div>
      {data.sparkline && trend.length > 1 && (
        <svg width="80" height="32" viewBox="0 0 80 32" className="text-emerald-400">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            points={trend
              .map((v, i) => `${(i / (trend.length - 1)) * 80},${32 - ((v - min) / range) * 28 - 2}`)
              .join(' ')}
          />
        </svg>
      )}
    </div>
  );
}

function ArtifactRendererImpl({ kind, title, data, compact }: ArtifactRendererProps) {
  const Icon = KIND_ICON[kind] ?? FileText;
  return (
    <Card className={`overflow-hidden border-border/60 bg-card/40 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{kind}</div>
        </div>
      </div>
      <ScrollArea className="max-h-[400px]">
        <div className="pr-2">
          {kind === 'table' && <TableRenderer data={data as TableArtifactData} />}
          {kind === 'chart' && <ChartRenderer data={data as ChartArtifactData} />}
          {kind === 'report' && <ReportRenderer data={data as ReportArtifactData} />}
          {kind === 'document' && <DocumentRenderer data={data as DocumentArtifactData} />}
          {kind === 'code' && <CodeRenderer data={data as CodeArtifactData} />}
          {kind === 'json' && <JsonRenderer data={data as JsonArtifactData} />}
          {kind === 'kanban' && <KanbanRenderer data={data as KanbanArtifactData} />}
          {kind === 'metric' && <MetricRenderer data={data as MetricArtifactData} />}
        </div>
      </ScrollArea>
    </Card>
  );
}

export const ArtifactRenderer = memo(ArtifactRendererImpl);
