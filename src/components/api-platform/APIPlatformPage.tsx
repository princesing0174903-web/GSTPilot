'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Code,
  Key,
  Webhook,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2,
  ArrowRight,
  Globe,
  Zap,
  FileText,
  Download,
  Terminal,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInMinutes } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────

type KeyPermission = 'read' | 'write' | 'admin';
type KeyStatus = 'active' | 'revoked' | 'expired';

interface APIKey {
  id: string;
  name: string;
  key: string;
  permission: KeyPermission;
  status: KeyStatus;
  createdAt: string;
  lastUsed: string;
  requestCount: number;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: 'active' | 'paused' | 'failed';
  createdAt: string;
  lastDelivery: string;
  successRate: number;
  deliveries: WebhookDelivery[];
}

interface WebhookDelivery {
  id: string;
  event: string;
  timestamp: string;
  statusCode: number;
  duration: number;
  success: boolean;
}

interface RequestLog {
  id: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
  apiKey: string;
  ip: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'client.created', 'client.updated', 'client.deleted',
  'invoice.processed', 'invoice.approved',
  'return.filed', 'return.reviewed',
  'task.completed', 'task.assigned',
  'document.uploaded', 'document.signed',
] as const;

function generateMockAPIKeys(): APIKey[] {
  return [
    { id: 'key-1', name: 'Production API Key', key: 'gpk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', permission: 'admin', status: 'active', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), lastUsed: new Date(Date.now() - 0.5 * 3600000).toISOString(), requestCount: 15420 },
    { id: 'key-2', name: 'Read-Only Integration', key: 'gpk_read_q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2', permission: 'read', status: 'active', createdAt: new Date(Date.now() - 15 * 86400000).toISOString(), lastUsed: new Date(Date.now() - 2 * 3600000).toISOString(), requestCount: 3240 },
    { id: 'key-3', name: 'Staging Environment', key: 'gpk_test_g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8', permission: 'write', status: 'revoked', createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), lastUsed: new Date(Date.now() - 10 * 86400000).toISOString(), requestCount: 890 },
  ];
}

function generateMockWebhooks(): WebhookEndpoint[] {
  return [
    {
      id: 'wh-1',
      url: 'https://myapp.example.com/webhooks/gstpilot',
      events: ['client.created', 'return.filed', 'invoice.processed'],
      secret: 'whsec_abc123def456ghi789',
      status: 'active',
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      lastDelivery: new Date(Date.now() - 0.2 * 3600000).toISOString(),
      successRate: 98.5,
      deliveries: [
        { id: 'd1', event: 'return.filed', timestamp: new Date(Date.now() - 0.2 * 3600000).toISOString(), statusCode: 200, duration: 245, success: true },
        { id: 'd2', event: 'invoice.processed', timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), statusCode: 200, duration: 189, success: true },
        { id: 'd3', event: 'client.created', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), statusCode: 500, duration: 5023, success: false },
        { id: 'd4', event: 'return.filed', timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), statusCode: 200, duration: 312, success: true },
      ],
    },
    {
      id: 'wh-2',
      url: 'https://slack.example.com/hooks/gstpilot-notifs',
      events: ['task.completed', 'document.signed'],
      secret: 'whsec_xyz789abc012def345',
      status: 'active',
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      lastDelivery: new Date(Date.now() - 1.5 * 3600000).toISOString(),
      successRate: 100,
      deliveries: [
        { id: 'd5', event: 'task.completed', timestamp: new Date(Date.now() - 1.5 * 3600000).toISOString(), statusCode: 200, duration: 156, success: true },
        { id: 'd6', event: 'document.signed', timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), statusCode: 200, duration: 201, success: true },
      ],
    },
  ];
}

function generateMockRequestLogs(): RequestLog[] {
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const paths = ['/api/v1/clients', '/api/v1/invoices', '/api/v1/returns', '/api/v1/reconciliation', '/api/v1/documents'];
  const statuses = [200, 200, 200, 200, 201, 400, 401, 404, 500];
  const logs: RequestLog[] = [];
  for (let i = 0; i < 25; i++) {
    const minsAgo = i * 5 + Math.floor(Math.random() * 5);
    logs.push({
      id: `req-${String(i + 1).padStart(4, '0')}`,
      method: methods[Math.floor(Math.random() * methods.length)],
      path: paths[Math.floor(Math.random() * paths.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      duration: Math.floor(Math.random() * 500) + 50,
      timestamp: new Date(Date.now() - minsAgo * 60000).toISOString(),
      apiKey: 'gpk_live_...o5p6',
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
    });
  }
  return logs;
}

const PERMISSION_CONFIG: Record<KeyPermission, { label: string; color: string }> = {
  read: { label: 'Read', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  write: { label: 'Write', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  admin: { label: 'Admin', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
};

const KEY_STATUS_CONFIG: Record<KeyStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-emerald-700 bg-emerald-50' },
  revoked: { label: 'Revoked', color: 'text-red-700 bg-red-50' },
  expired: { label: 'Expired', color: 'text-slate-500 bg-slate-50' },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function APIPlatformPage() {
  const [apiKeys] = useState<APIKey[]>(() => generateMockAPIKeys());
  const [webhooks] = useState<WebhookEndpoint[]>(() => generateMockWebhooks());
  const [requestLogs] = useState<RequestLog[]>(() => generateMockRequestLogs());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('keys');
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerm, setNewKeyPerm] = useState<KeyPermission>('read');
  const [webhookDetailOpen, setWebhookDetailOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['client.created']);

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeyMap((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // Stats
  const requestsToday = requestLogs.length;
  const errorRate = Math.round((requestLogs.filter((r) => r.status >= 400).length / requestLogs.length) * 100);
  const avgDuration = Math.round(requestLogs.reduce((sum, r) => sum + r.duration, 0) / requestLogs.length);

  const handleCreateKey = () => {
    setCreateKeyOpen(false);
    setNewKeyName('');
    setNewKeyPerm('read');
  };

  const handleCreateWebhook = () => {
    setCreateWebhookOpen(false);
    setNewWebhookUrl('');
    setNewWebhookEvents(['client.created']);
  };

  const handleViewWebhookDetail = (wh: WebhookEndpoint) => {
    setSelectedWebhook(wh);
    setWebhookDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
            <Code className="size-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">API Platform</h1>
            <p className="text-sm text-muted-foreground">API keys, webhooks, and developer tools</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs self-start">
          <div className="size-1.5 rounded-full bg-emerald-500 mr-1.5" />
          API v2.0
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Requests Today</p>
                <p className="text-2xl font-bold">{requestsToday}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50">
                <Activity className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{errorRate}%</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{avgDuration}ms</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-purple-50">
                <Zap className="size-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rate Limit</p>
                <p className="text-2xl font-bold">1K/hr</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50">
                <BarChart3 className="size-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="keys" className="gap-2">
            <Key className="size-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="size-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Terminal className="size-4" />
            Request Logs
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <FileText className="size-4" />
            SDK & Docs
          </TabsTrigger>
        </TabsList>

        {/* ─── API Keys Tab ──────────────────────────────────────────────── */}
        <TabsContent value="keys" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateKeyOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4" />
              Generate New Key
            </Button>
          </div>

          <div className="space-y-3">
            {apiKeys.map((apiKey) => {
              const permCfg = PERMISSION_CONFIG[apiKey.permission];
              const statusCfg = KEY_STATUS_CONFIG[apiKey.status];
              const isRevealed = showKeyMap[apiKey.id];
              const maskedKey = apiKey.key.slice(0, 12) + '...' + apiKey.key.slice(-4);

              return (
                <Card key={apiKey.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{apiKey.name}</h3>
                          <Badge variant="outline" className={`text-xs ${permCfg.color}`}>{permCfg.label}</Badge>
                          <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded flex-1 truncate">
                            {isRevealed ? apiKey.key : maskedKey}
                          </code>
                          <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => toggleKeyVisibility(apiKey.id)}>
                            {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => copyToClipboard(apiKey.key)}>
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Created {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}</span>
                          <span>Last used {differenceInMinutes(new Date(), new Date(apiKey.lastUsed))}m ago</span>
                          <span>{apiKey.requestCount.toLocaleString()} requests</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="gap-1">
                          <RefreshCw className="size-3.5" />
                          Rotate
                        </Button>
                        {apiKey.status === 'active' && (
                          <Button variant="outline" size="sm" className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="size-3.5" />
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Webhooks Tab ───────────────────────────────────────────────── */}
        <TabsContent value="webhooks" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateWebhookOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4" />
              New Webhook
            </Button>
          </div>

          <div className="space-y-3">
            {webhooks.map((wh) => (
              <Card key={wh.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewWebhookDetail(wh)}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm font-mono truncate">{wh.url}</h3>
                        <Badge variant="outline" className={wh.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : wh.status === 'failed' ? 'text-red-600 border-red-200 bg-red-50' : 'text-amber-600 border-amber-200 bg-amber-50'}>
                          {wh.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {wh.events.map((e) => (
                          <Badge key={e} variant="outline" className="text-[10px] text-slate-600 border-slate-200">
                            {e}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Success rate: {wh.successRate}%</span>
                        <span>Last delivery: {differenceInMinutes(new Date(), new Date(wh.lastDelivery))}m ago</span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── Request Logs Tab ───────────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Time</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Method</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Path</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Duration</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">API Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestLogs.slice(0, 20).map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {differenceInMinutes(new Date(), new Date(log.timestamp))}m ago
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={`text-xs font-mono ${
                            log.method === 'GET' ? 'text-blue-600 border-blue-200' :
                            log.method === 'POST' ? 'text-emerald-600 border-emerald-200' :
                            log.method === 'PUT' ? 'text-amber-600 border-amber-200' :
                            'text-red-600 border-red-200'
                          }`}>
                            {log.method}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{log.path}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-mono ${log.status < 300 ? 'text-emerald-600' : log.status < 400 ? 'text-amber-600' : 'text-red-600'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{log.duration}ms</td>
                        <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{log.apiKey}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SDK & Docs Tab ─────────────────────────────────────────────── */}
        <TabsContent value="docs" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* SDK Downloads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Download className="size-4 text-emerald-600" />
                  SDK Downloads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'JavaScript / Node.js', install: 'npm install @gstpilot/sdk', lang: 'bash' },
                  { name: 'Python', install: 'pip install gstpilot-sdk', lang: 'bash' },
                ].map((sdk) => (
                  <div key={sdk.name} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{sdk.name}</span>
                      <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => copyToClipboard(sdk.install)}>
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                    <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded block">{sdk.install}</code>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="size-4 text-emerald-600" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-slate-950 text-slate-100 p-4 overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre">
{`// JavaScript Example
import GSTPilot from '@gstpilot/sdk';

const client = new GSTPilot({
  apiKey: 'gpk_live_...',
});

// List all clients
const clients = await client.clients.list();

// File a return
await client.returns.file({
  clientId: 'cl_123',
  returnType: 'GSTR-1',
  period: '2024-10',
});`}
                  </pre>
                </div>
                <div className="rounded-lg border bg-slate-950 text-slate-100 p-4 overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre">
{`# Python Example
from gstpilot import GSTPilotClient

client = GSTPilotClient(
    api_key="gpk_live_..."
)

# List all clients
clients = client.clients.list()

# File a return
client.returns.file(
    client_id="cl_123",
    return_type="GSTR-1",
    period="2024-10"
)`}
                  </pre>
                </div>
                <div className="rounded-lg border bg-slate-950 text-slate-100 p-4 overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre">
{`# cURL Example
curl -X GET https://api.gstpilot.ai/v1/clients \\
  -H "Authorization: Bearer gpk_live_..." \\
  -H "Content-Type: application/json"`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* API Docs */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-emerald-600" />
                  API Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { method: 'GET', path: '/v1/clients', desc: 'List all clients' },
                    { method: 'POST', path: '/v1/clients', desc: 'Create a new client' },
                    { method: 'GET', path: '/v1/clients/:id', desc: 'Get client details' },
                    { method: 'GET', path: '/v1/returns', desc: 'List all returns' },
                    { method: 'POST', path: '/v1/returns/file', desc: 'File a return' },
                    { method: 'GET', path: '/v1/invoices', desc: 'List all invoices' },
                    { method: 'POST', path: '/v1/invoices/process', desc: 'Process an invoice' },
                    { method: 'GET', path: '/v1/reconciliation', desc: 'Get reconciliation data' },
                    { method: 'GET', path: '/v1/documents', desc: 'List all documents' },
                    { method: 'POST', path: '/v1/webhooks', desc: 'Create a webhook' },
                  ].map((endpoint, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/30 transition-colors cursor-pointer">
                      <Badge variant="outline" className={`text-xs font-mono min-w-[52px] justify-center ${
                        endpoint.method === 'GET' ? 'text-blue-600 border-blue-200' :
                        endpoint.method === 'POST' ? 'text-emerald-600 border-emerald-200' :
                        'text-amber-600 border-amber-200'
                      }`}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs font-mono flex-1">{endpoint.path}</code>
                      <span className="text-xs text-muted-foreground">{endpoint.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-4 text-emerald-600" />
              Generate API Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Key Name</label>
              <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., Production Integration" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Permission Level</label>
              <Select value={newKeyPerm} onValueChange={(v) => setNewKeyPerm(v as KeyPermission)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read Only</SelectItem>
                  <SelectItem value="write">Read & Write</SelectItem>
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateKey} className="bg-emerald-600 hover:bg-emerald-700">Generate Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={createWebhookOpen} onOpenChange={setCreateWebhookOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="size-4 text-emerald-600" />
              Create Webhook
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Endpoint URL</label>
              <Input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://your-app.com/webhooks/gstpilot" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Events</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((event) => (
                  <button
                    key={event}
                    onClick={() => {
                      setNewWebhookEvents((prev) =>
                        prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
                      );
                    }}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      newWebhookEvents.includes(event)
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-muted/30 border-border text-muted-foreground'
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateWebhookOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook} className="bg-emerald-600 hover:bg-emerald-700">Create Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Detail Dialog */}
      <Dialog open={webhookDetailOpen} onOpenChange={setWebhookDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="size-4 text-emerald-600" />
              Webhook Details
            </DialogTitle>
          </DialogHeader>
          {selectedWebhook && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <code className="text-xs font-mono break-all">{selectedWebhook.url}</code>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="outline" className={selectedWebhook.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-600 border-red-200 bg-red-50'}>
                    {selectedWebhook.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Success rate: {selectedWebhook.successRate}%</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1.5">Secret</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded flex-1 truncate">{selectedWebhook.secret}</code>
                  <Button variant="ghost" size="sm" className="size-7 p-0" onClick={() => copyToClipboard(selectedWebhook.secret)}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-3">Recent Deliveries</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedWebhook.deliveries.map((delivery) => (
                    <div key={delivery.id} className="flex items-center justify-between rounded border p-2 text-xs">
                      <div className="flex items-center gap-2">
                        {delivery.success ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-3.5 text-red-600" />
                        )}
                        <span className="font-mono">{delivery.event}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{delivery.statusCode}</span>
                        <span>{delivery.duration}ms</span>
                        <span>{differenceInMinutes(new Date(), new Date(delivery.timestamp))}m ago</span>
                      </div>
                      {!delivery.success && (
                        <Button variant="ghost" size="sm" className="size-6 p-0 text-amber-600">
                          <RefreshCw className="size-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
