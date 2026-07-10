'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Mic,
  MicOff,
  Radio,
  CheckCircle2,
  Clock,
  Loader2,
  Volume2,
  MessageSquare,
  Zap,
  Play,
  FileText,
  AlertTriangle,
  BarChart3,
  Users,
  Search,
  TrendingUp,
  Settings,
  Command,
  Activity,
  Brain,
  Shield,
  FileCheck,
  FileWarning,
  Hash,
  Timer,
  Target,
  ArrowRight,
  RefreshCw,
  DollarSign,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Color Palette ──────────────────────────────────────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
  purple: '#8b5cf6',
  blue: '#3b82f6',
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface VoiceCommand {
  id: string;
  transcription: string;
  action: string;
  actionDescription: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
  responseTime: number;
}

interface QuickCommand {
  id: string;
  label: string;
  voiceCommand: string;
  icon: React.ElementType;
  color: string;
  action: string;
}

interface VoiceSession {
  id: string;
  startedAt: string;
  commandsCount: number;
  lastCommand: string;
  status: 'active' | 'completed';
}

interface VoiceSettings {
  language: string;
  sensitivity: number;
  autoExecute: boolean;
  confirmationRequired: boolean;
}

// ─── Animated Card ──────────────────────────────────────────────────────────
function AnimatedCard({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── SVG Waveform Component ─────────────────────────────────────────────────
function WaveformVisualizer({ isActive }: { isActive: boolean }) {
  const bars = 40;
  return (
    <svg width="280" height="60" viewBox="0 0 280 60" className="overflow-visible">
      {Array.from({ length: bars }).map((_, i) => {
        const x = (i / bars) * 280 + 3;
        const baseHeight = 4;
        const maxHeight = isActive ? 40 + Math.sin(i * 0.3) * 15 : 8;
        const animDuration = 0.4 + Math.random() * 0.6;
        const animDelay = i * 0.02;
        return (
          <motion.rect
            key={i}
            x={x}
            y={30 - maxHeight / 2}
            width={3}
            rx={1.5}
            height={maxHeight}
            fill={isActive ? COLORS.emerald : '#cbd5e1'}
            opacity={isActive ? 0.6 + Math.random() * 0.4 : 0.3}
            animate={
              isActive
                ? {
                    height: [baseHeight, maxHeight, baseHeight],
                    y: [30 - baseHeight / 2, 30 - maxHeight / 2, 30 - baseHeight / 2],
                    opacity: [0.5, 1, 0.5],
                  }
                : {
                    height: [8, 12, 8],
                    y: [26, 24, 26],
                  }
            }
            transition={{
              duration: animDuration,
              delay: animDelay,
              repeat: Infinity,
              ease: 'easeInOut' as const,
            }}
          />
        );
      })}
    </svg>
  );
}

// ─── Sample Data ────────────────────────────────────────────────────────────
const commandHistory: VoiceCommand[] = [
  { id: 'c1', transcription: 'Show pending GSTR-1', action: 'Navigate Returns', actionDescription: 'Opened GSTR-1 pending returns with 12 clients', timestamp: '04/03/2026 10:32 AM', status: 'success', responseTime: 1.2 },
  { id: 'c2', transcription: 'File ABC Traders', action: 'Start Return Filing', actionDescription: 'Initiated GSTR-3B filing for ABC Traders, Mar 2026', timestamp: '04/03/2026 10:28 AM', status: 'success', responseTime: 2.1 },
  { id: 'c3', transcription: 'Which clients are at risk?', action: 'Show Risk Analysis', actionDescription: 'Displayed 5 at-risk clients with compliance scores', timestamp: '04/03/2026 10:22 AM', status: 'success', responseTime: 1.8 },
  { id: 'c4', transcription: 'Generate monthly report', action: 'Create Report', actionDescription: 'Generated March 2026 monthly compliance report', timestamp: '04/03/2026 10:15 AM', status: 'success', responseTime: 3.4 },
  { id: 'c5', transcription: 'Run reconciliation', action: 'Start Reconciliation', actionDescription: 'Launched 2A/2B reconciliation for all active clients', timestamp: '04/03/2026 10:08 AM', status: 'success', responseTime: 2.7 },
  { id: 'c6', transcription: 'Prepare all returns', action: 'Batch Return Prep', actionDescription: 'Queued GSTR-1 preparation for 18 clients', timestamp: '04/03/2026 09:55 AM', status: 'success', responseTime: 4.1 },
  { id: 'c7', transcription: 'Show overdue notices', action: 'Display Notices', actionDescription: 'Found 3 overdue notices from GST department', timestamp: '04/03/2026 09:48 AM', status: 'success', responseTime: 1.5 },
  { id: 'c8', transcription: "What's my revenue?", action: 'Show Revenue', actionDescription: 'Total revenue: \u20B94,52,00,000 for FY 2025-26', timestamp: '04/03/2026 09:40 AM', status: 'success', responseTime: 1.1 },
  { id: 'c9', transcription: 'Run payroll', action: 'Start Payroll', actionDescription: 'Payroll processing requires additional confirmation', timestamp: '04/03/2026 09:35 AM', status: 'failed', responseTime: 0.8 },
  { id: 'c10', transcription: 'Check compliance', action: 'Compliance Status', actionDescription: 'Overall compliance: 94.5% across 24 clients', timestamp: '04/03/2026 09:28 AM', status: 'success', responseTime: 2.3 },
  { id: 'c11', transcription: 'File ABC Traders GSTR-1', action: 'Start Return Filing', actionDescription: 'Initiated GSTR-1 filing for ABC Traders', timestamp: '03/03/2026 16:45 PM', status: 'success', responseTime: 2.5 },
  { id: 'c12', transcription: 'Show Patel & Sons invoices', action: 'Navigate Invoices', actionDescription: 'Opened invoice workspace for Patel & Sons', timestamp: '03/03/2026 16:30 PM', status: 'success', responseTime: 1.4 },
  { id: 'c13', transcription: 'Run reconciliation for March', action: 'Start Reconciliation', actionDescription: 'Started 2A/2B reconciliation for Mar 2026 period', timestamp: '03/03/2026 15:20 PM', status: 'success', responseTime: 3.2 },
  { id: 'c14', transcription: 'Generate compliance report', action: 'Create Report', actionDescription: 'Generated compliance summary report', timestamp: '03/03/2026 14:10 PM', status: 'success', responseTime: 2.9 },
  { id: 'c15', transcription: 'Show client list', action: 'Navigate Clients', actionDescription: 'Opened client registry with 24 active clients', timestamp: '03/03/2026 13:45 PM', status: 'success', responseTime: 0.9 },
];

const quickCommands: QuickCommand[] = [
  { id: 'q1', label: 'Pending GSTR-1', voiceCommand: 'Show pending GSTR-1', icon: FileText, color: '#10b981', action: 'Navigate Returns' },
  { id: 'q2', label: 'File Return', voiceCommand: 'File ABC Traders', icon: FileCheck, color: '#3b82f6', action: 'Start Filing' },
  { id: 'q3', label: 'At-Risk Clients', voiceCommand: 'Which clients are at risk?', icon: AlertTriangle, color: '#f59e0b', action: 'Show Risks' },
  { id: 'q4', label: 'Monthly Report', voiceCommand: 'Generate monthly report', icon: BarChart3, color: '#8b5cf6', action: 'Create Report' },
  { id: 'q5', label: 'Reconcile', voiceCommand: 'Run reconciliation', icon: RefreshCw, color: '#06b6d4', action: 'Reconcile' },
  { id: 'q6', label: 'Prepare Returns', voiceCommand: 'Prepare all returns', icon: Play, color: '#ec4899', action: 'Batch Prep' },
  { id: 'q7', label: 'Overdue Notices', voiceCommand: 'Show overdue notices', icon: FileWarning, color: '#ef4444', action: 'Show Notices' },
  { id: 'q8', label: 'Revenue', voiceCommand: "What's my revenue?", icon: DollarSign, color: '#10b981', action: 'Show Revenue' },
  { id: 'q9', label: 'Run Payroll', voiceCommand: 'Run payroll', icon: Users, color: '#f97316', action: 'Payroll' },
  { id: 'q10', label: 'Compliance', voiceCommand: 'Check compliance', icon: Shield, color: '#14b8a6', action: 'Compliance' },
];

const recentSessions: VoiceSession[] = [
  { id: 's1', startedAt: '04/03/2026 10:30 AM', commandsCount: 4, lastCommand: 'Show pending GSTR-1', status: 'active' },
  { id: 's2', startedAt: '04/03/2026 09:25 AM', commandsCount: 3, lastCommand: 'Check compliance', status: 'completed' },
  { id: 's3', startedAt: '03/03/2026 16:40 PM', commandsCount: 5, lastCommand: 'Show Patel & Sons invoices', status: 'completed' },
  { id: 's4', startedAt: '03/03/2026 14:05 PM', commandsCount: 2, lastCommand: 'Generate compliance report', status: 'completed' },
  { id: 's5', startedAt: '03/03/2026 11:00 AM', commandsCount: 6, lastCommand: 'Run reconciliation for March', status: 'completed' },
];

// ─── Main Component ─────────────────────────────────────────────────────────
export default function AIVoiceAssistantPage() {
  const [activeTab, setActiveTab] = useState('voice');
  const [isListening, setIsListening] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommand | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>({
    language: 'English',
    sensitivity: 75,
    autoExecute: true,
    confirmationRequired: false,
  });

  // Simulate voice command detection
  const simulateVoiceCommand = useCallback(() => {
    setIsListening(true);
    setCurrentTranscription('');
    setDetectedCommand(null);

    const commands = [
      { transcription: 'Show pending GSTR-1 returns', action: 'Navigate Returns', description: 'Opening GSTR-1 pending returns dashboard...' },
      { transcription: 'File ABC Traders March return', action: 'Start Filing', description: 'Initiating GSTR-3B for ABC Traders...' },
      { transcription: 'Which clients are at risk this month?', action: 'Risk Analysis', description: 'Analyzing compliance scores for all clients...' },
    ];

    const cmd = commands[Math.floor(Math.random() * commands.length)];
    const words = cmd.transcription.split(' ');

    // Simulate typing
    let idx = 0;
    const typingInterval = setInterval(() => {
      if (idx < words.length) {
        setCurrentTranscription(words.slice(0, idx + 1).join(' '));
        idx++;
      } else {
        clearInterval(typingInterval);
        setIsListening(false);
        setDetectedCommand({
          id: `live-${Date.now()}`,
          transcription: cmd.transcription,
          action: cmd.action,
          actionDescription: cmd.description,
          timestamp: new Date().toLocaleString('en-IN'),
          status: 'success',
          responseTime: +(Math.random() * 3 + 0.5).toFixed(1),
        });
      }
    }, 200);

    return () => clearInterval(typingInterval);
  }, []);

  const metrics = [
    { label: 'Commands Today', value: '23', icon: Command, color: 'emerald' },
    { label: 'Success Rate', value: '96.2%', icon: Target, color: 'emerald' },
    { label: 'Avg Response', value: '1.9s', icon: Timer, color: 'teal' },
    { label: 'Most Used', value: 'Returns', icon: FileText, color: 'purple' },
    { label: 'Active Sessions', value: '1', icon: Activity, color: 'emerald' },
  ];

  const commandAnalytics = [
    { command: 'Show pending GSTR-1', count: 34, successRate: 100, avgTime: 1.2 },
    { command: 'File return', count: 28, successRate: 96, avgTime: 2.1 },
    { command: 'Run reconciliation', count: 22, successRate: 95, avgTime: 2.7 },
    { command: 'Generate report', count: 19, successRate: 100, avgTime: 3.4 },
    { command: 'Show at-risk clients', count: 16, successRate: 100, avgTime: 1.8 },
    { command: 'Check compliance', count: 14, successRate: 93, avgTime: 2.3 },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <AnimatedCard delay={0}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Mic className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">AI Voice Assistant</h1>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold px-2">Active</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Voice commands to actions — speak and AI executes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">Listening</span>
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* ─── Metrics ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((m, i) => (
          <AnimatedCard key={m.label} delay={0.05 * i}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px] text-slate-500 font-medium truncate">{m.label}</span>
                </div>
                <p className="text-lg font-bold text-slate-800">{m.value}</p>
              </CardContent>
            </Card>
          </AnimatedCard>
        ))}
      </div>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/80 h-9 p-0.5">
          <TabsTrigger value="voice" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Voice</TabsTrigger>
          <TabsTrigger value="commands" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Commands</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs px-3 h-8 data-[state=active]:bg-white data-[state=active]:shadow-sm">Settings</TabsTrigger>
        </TabsList>

        {/* ── Voice Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="voice" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Main Voice Interface */}
            <div className="lg:col-span-3">
              <AnimatedCard delay={0.1}>
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Mic className="h-4 w-4 text-emerald-500" /> Voice Command Interface
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center py-6">
                    {/* Microphone Button */}
                    <div className="relative mb-6">
                      <motion.button
                        onClick={simulateVoiceCommand}
                        className="relative z-10 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 cursor-pointer hover:from-emerald-600 hover:to-emerald-700 transition-colors"
                        whileTap={{ scale: 0.95 }}
                      >
                        {isListening ? (
                          <MicOff className="h-10 w-10 text-white" />
                        ) : (
                          <Mic className="h-10 w-10 text-white" />
                        )}
                      </motion.button>

                      {/* Pulsing rings */}
                      {isListening && (
                        <>
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-emerald-400"
                            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' as const }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-emerald-400"
                            animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' as const, delay: 0.3 }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-emerald-300"
                            animate={{ scale: [1, 2.1], opacity: [0.2, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' as const, delay: 0.6 }}
                          />
                        </>
                      )}
                    </div>

                    {/* Status Text */}
                    <div className="text-center mb-4">
                      <p className={`text-sm font-semibold ${isListening ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {isListening ? 'Listening...' : 'Tap to speak a command'}
                      </p>
                      {isListening && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-slate-400 mt-1"
                        >
                          Speak now — AI is listening
                        </motion.p>
                      )}
                    </div>

                    {/* Waveform */}
                    <WaveformVisualizer isActive={isListening} />

                    {/* Transcription */}
                    <AnimatePresence mode="wait">
                      {currentTranscription && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mt-4 w-full max-w-md"
                        >
                          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="h-3 w-3 text-slate-400" />
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Transcription</span>
                            </div>
                            <p className="text-sm font-medium text-slate-700">{currentTranscription}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Detected Command Action */}
                    <AnimatePresence>
                      {detectedCommand && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-3 w-full max-w-md"
                        >
                          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="h-3 w-3 text-emerald-500" />
                              <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Action: {detectedCommand.action}</span>
                            </div>
                            <p className="text-xs text-emerald-700">{detectedCommand.actionDescription}</p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] text-emerald-500">
                              <span>Response: {detectedCommand.responseTime}s</span>
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>

            {/* Active Session & Quick Commands */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatedCard delay={0.15}>
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" /> Active Session
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentSessions.filter((s) => s.status === 'active').map((session) => (
                        <div key={session.id} className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-emerald-700">Session #{session.id}</span>
                            <Badge className="bg-emerald-100 text-emerald-700 text-[9px] h-4 px-1.5">Live</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-emerald-500 block">Started</span>
                              <span className="font-medium text-slate-700">{session.startedAt}</span>
                            </div>
                            <div>
                              <span className="text-emerald-500 block">Commands</span>
                              <span className="font-medium text-slate-700">{session.commandsCount}</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-emerald-200">
                            <span className="text-[10px] text-emerald-500 block">Last Command</span>
                            <span className="text-xs font-medium text-slate-700">&ldquo;{session.lastCommand}&rdquo;</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>

              <AnimatedCard delay={0.2}>
                <Card className="border-slate-200/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" /> Quick Commands
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {quickCommands.map((cmd) => (
                        <motion.button
                          key={cmd.id}
                          onClick={() => {
                            setCurrentTranscription(cmd.voiceCommand);
                            setDetectedCommand({
                              id: `quick-${Date.now()}`,
                              transcription: cmd.voiceCommand,
                              action: cmd.action,
                              actionDescription: `Executing: ${cmd.action}...`,
                              timestamp: new Date().toLocaleString('en-IN'),
                              status: 'success',
                              responseTime: +(Math.random() * 2 + 0.5).toFixed(1),
                            });
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all text-left"
                        >
                          <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: cmd.color + '15' }}>
                            <cmd.icon className="h-3.5 w-3.5" style={{ color: cmd.color }} />
                          </div>
                          <span className="text-[11px] font-medium text-slate-600 truncate">{cmd.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedCard>
            </div>
          </div>
        </TabsContent>

        {/* ── Commands Tab (Analytics) ──────────────────────────────────── */}
        <TabsContent value="commands" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-500" /> Command Analytics
                </CardTitle>
                <CardDescription className="text-xs">Most used commands, success rates, and response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commandAnalytics.map((cmd, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                    >
                      <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-600">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">&ldquo;{cmd.command}&rdquo;</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-400">{cmd.count} uses</span>
                          <span className="text-[10px] text-emerald-500 font-medium">{cmd.successRate}% success</span>
                          <span className="text-[10px] text-slate-400">{cmd.avgTime}s avg</span>
                        </div>
                      </div>
                      <div className="w-24 shrink-0">
                        <Progress value={cmd.successRate} className="h-1.5" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Usage chart */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 mb-3">Command Frequency</h4>
                  <svg width="100%" height="120" viewBox="0 0 400 120" className="overflow-visible">
                    {commandAnalytics.map((cmd, i) => {
                      const barWidth = (cmd.count / 34) * 280;
                      const y = i * 18 + 5;
                      return (
                        <React.Fragment key={i}>
                          <text x="0" y={y + 10} className="fill-slate-400 text-[8px]">{cmd.command.slice(0, 15)}</text>
                          <motion.rect
                            x="120"
                            y={y}
                            width={barWidth}
                            height="12"
                            rx="3"
                            fill={i < 3 ? COLORS.emerald : '#d1fae5'}
                            initial={{ width: 0 }}
                            animate={{ width: barWidth }}
                            transition={{ duration: 0.6, delay: i * 0.08 }}
                          />
                          <text x={120 + barWidth + 5} y={y + 10} className="fill-slate-500 text-[9px] font-semibold">
                            {cmd.count}
                          </text>
                        </React.Fragment>
                      );
                    })}
                  </svg>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── History Tab ───────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <AnimatedCard delay={0.1}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" /> Command History
                </CardTitle>
                <CardDescription className="text-xs">All voice commands with transcription and action taken</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {commandHistory.map((cmd, i) => {
                      const isSuccess = cmd.status === 'success';
                      return (
                        <motion.div
                          key={cmd.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isSuccess ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            {isSuccess ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-slate-700">&ldquo;{cmd.transcription}&rdquo;</span>
                              <Badge variant={isSuccess ? 'default' : 'destructive'} className="text-[9px] h-4 px-1.5">
                                {isSuccess ? 'Success' : 'Failed'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Zap className="h-3 w-3 text-emerald-400" />
                              <span>{cmd.action}:</span>
                              <span className="text-slate-600">{cmd.actionDescription}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span>{cmd.timestamp}</span>
                              <span>&middot;</span>
                              <span>{cmd.responseTime}s</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </AnimatedCard>

          {/* Recent Sessions */}
          <AnimatedCard delay={0.15}>
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-emerald-500" /> Recent Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentSessions.map((session, i) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${session.status === 'active' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                        {session.status === 'active' ? (
                          <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">Session #{session.id}</span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                            {session.commandsCount} commands
                          </Badge>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          <span>{session.startedAt}</span>
                          <span className="mx-1">&middot;</span>
                          <span className="truncate">&ldquo;{session.lastCommand}&rdquo;</span>
                        </div>
                      </div>
                      <Badge className={`text-[9px] h-4 px-1.5 ${session.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {session.status === 'active' ? 'Active' : 'Done'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </TabsContent>

        {/* ── Settings Tab ──────────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatedCard delay={0.1}>
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-emerald-500" /> Voice Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Language */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Language</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['English', 'Hindi', 'Tamil', 'Telugu'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setSettings({ ...settings, language: lang })}
                          className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                            settings.language === lang
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 text-slate-600 hover:border-emerald-200'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sensitivity */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-2">Microphone Sensitivity</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.sensitivity}
                      onChange={(e) => setSettings({ ...settings, sensitivity: +e.target.value })}
                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Low</span>
                      <span>{settings.sensitivity}%</span>
                      <span>High</span>
                    </div>
                  </div>

                  {/* Auto Execute */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block">Auto-Execute Commands</label>
                      <p className="text-[10px] text-slate-400 mt-0.5">Execute actions without confirmation</p>
                    </div>
                    <Switch
                      checked={settings.autoExecute}
                      onCheckedChange={(v) => setSettings({ ...settings, autoExecute: v })}
                    />
                  </div>

                  {/* Confirmation Required */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block">Confirmation Required</label>
                      <p className="text-[10px] text-slate-400 mt-0.5">Ask before executing destructive actions</p>
                    </div>
                    <Switch
                      checked={settings.confirmationRequired}
                      onCheckedChange={(v) => setSettings({ ...settings, confirmationRequired: v })}
                    />
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>

            <AnimatedCard delay={0.15}>
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-emerald-500" /> Supported Commands
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-2">
                      {quickCommands.map((cmd) => (
                        <div key={cmd.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100">
                          <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: cmd.color + '15' }}>
                            <cmd.icon className="h-3.5 w-3.5" style={{ color: cmd.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700">&ldquo;{cmd.voiceCommand}&rdquo;</p>
                            <p className="text-[10px] text-slate-400">{cmd.action}</p>
                          </div>
                          <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </AnimatedCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
