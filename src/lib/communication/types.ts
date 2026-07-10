// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — Type Definitions
// Phase 8 Step 4 — Shared types for WhatsApp + Email + SMS + Notification Center +
// Collection Recovery + Report Distribution + AI Communication Engine.
//
// Pure TypeScript — importable from both client and server. No Prisma, no Next.
// Field names mirror prisma/schema.prisma exactly (WhatsAppMessage, EmailMessage,
// SMSMessage, CommunicationTemplate, CommunicationLog, Notification).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Channel union ─────────────────────────────────────────────────────────────

export type CommunicationChannel = 'whatsapp' | 'email' | 'sms' | 'notification' | 'pdf' | 'dashboard';

// ─── Message statuses ──────────────────────────────────────────────────────────

export type WhatsAppStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type EmailStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'failed' | 'bounced';
export type SMSStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export type LogStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'escalated';

// ─── Categories ────────────────────────────────────────────────────────────────

export type WhatsAppCategory =
  | 'invoice' | 'reminder' | 'gst_notice' | 'collection'
  | 'report' | 'payslip' | 'otp' | 'general';

export type EmailCategory =
  | 'invoice' | 'gst_notice' | 'collection' | 'report'
  | 'payslip' | 'forecast' | 'general';

export type SMSCategory =
  | 'otp' | 'gst_alert' | 'payment_reminder' | 'due_date'
  | 'collection' | 'general';

export type NotificationType =
  | 'gst_due' | 'payment_due' | 'collection_risk' | 'cash_shortage'
  | 'payroll' | 'tds' | 'system_alert';

// ─── AI Engine event types ─────────────────────────────────────────────────────

export type CommunicationEventType =
  | 'invoice_due' | 'overdue' | 'payment_received' | 'gst_deadline'
  | 'escalation' | 'report_delivery' | 'payroll' | 'tds'
  | 'cash_shortage' | 'collection_reminder' | 'otp';

export type TriggerSource = 'ai_engine' | 'manual' | 'scheduled' | 'bulk_campaign';

// ─── Entity interfaces (mirror Prisma schema) ──────────────────────────────────

export interface WhatsAppMessage {
  id: string;
  clientId?: string | null;
  recipientName?: string | null;
  recipientPhone: string;
  templateName?: string | null;
  messageType: string; // text | template | media | document | interactive
  messageBody: string;
  mediaUrl?: string | null;
  caption?: string | null;
  category: WhatsAppCategory;
  status: WhatsAppStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  clientId?: string | null;
  recipientName?: string | null;
  recipientEmail: string;
  templateName?: string | null;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  category: EmailCategory;
  attachments?: string | null; // JSON string
  status: EmailStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SMSMessage {
  id: string;
  clientId?: string | null;
  recipientName?: string | null;
  recipientPhone: string;
  message: string;
  category: SMSCategory;
  status: SMSStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  channel: CommunicationChannel;
  category: string;
  subject?: string | null;
  body: string;
  variables?: string | null; // JSON string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationLog {
  id: string;
  clientId?: string | null;
  channel: CommunicationChannel;
  eventType: CommunicationEventType;
  recipient: string;
  recipientName?: string | null;
  templateName?: string | null;
  messagePreview: string;
  status: LogStatus;
  triggerSource: TriggerSource;
  metadata?: string | null; // JSON string
  createdAt: string;
}

// ─── Stats / summary interfaces ────────────────────────────────────────────────

export interface WhatsAppStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number; // %
  readRate: number; // %
  byCategory: Record<string, number>;
}

export interface EmailStats {
  total: number;
  sent: number;
  opened: number;
  failed: number;
  bounced: number;
  openRate: number; // %
  byCategory: Record<string, number>;
}

export interface SMSStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number; // %
  byCategory: Record<string, number>;
}

export interface NotificationStats {
  total: number;
  unread: number;
  critical: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface AiEngineStats {
  totalEvents: number;
  totalMessages: number;
  byChannel: Record<string, number>;
  byEventType: Record<string, number>;
  deliveryRate: number; // %
  responseRate: number; // %
  recoveryRate: number; // %
  topChannel: string;
}

// ─── AI Engine types ───────────────────────────────────────────────────────────

export interface DetectedEvent {
  eventType: CommunicationEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recipient: string;
  recipientName?: string | null;
  data: Record<string, unknown>;
  suggestedChannel: CommunicationChannel;
  message: string;
}

export interface RecoveryStageInfo {
  stage: string;
  label: string;
  description: string;
  channel: CommunicationChannel;
  action: string;
}

export interface RecoveryPipelineItem {
  invoiceId: string;
  invoiceNumber: string;
  buyerName: string;
  amount: number;
  daysOverdue: number;
  stage: string;
  nextAction: string;
  suggestedChannel: CommunicationChannel;
}

export interface RecoverySummary {
  totalInRecovery: number;
  totalAmount: number;
  byStage: Record<string, number>;
  byStageAmount: Record<string, number>;
  recoveredThisWeek: number;
  escalatedCount: number;
}

export interface ReportDistribution {
  id: string;
  reportType: string;
  recipient: string;
  recipientName?: string | null;
  channel: CommunicationChannel;
  status: string;
  sentAt: string;
  summary: string;
}
