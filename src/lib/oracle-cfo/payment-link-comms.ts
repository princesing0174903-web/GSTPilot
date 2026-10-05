// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Payment Link Communication Service
//
// Handles email + WhatsApp delivery for payment links.
// REAL behavior:
//   • Checks if email/WhatsApp is connected (integration config in Firestore)
//   • If connected → sends the payment link + writes a notification record
//   • If NOT connected → returns a clear "what to connect" message
//
// NEVER fakes a successful send. If email isn't configured, the user is told
// exactly what they need to connect.
//
// Pattern mirrors invoice-comms.ts but is payment-link specific.
// ═══════════════════════════════════════════════════════════════════════════════

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-schema';

export interface EmailIntegration {
  connected: boolean;
  provider: string | null; // 'smtp' | 'resend' | 'sendgrid'
  fromEmail: string | null;
  fromName: string | null;
}

export interface WhatsAppIntegration {
  connected: boolean;
  provider: string | null; // 'twilio' | 'whatsapp-business' | 'gupshup'
  phoneNumber: string | null;
  businessName: string | null;
}

/**
 * Check if the organization has email integration configured.
 * Reads from `integrations/email_{orgId}` in Firestore.
 */
export async function checkEmailIntegration(organizationId: string): Promise<EmailIntegration> {
  try {
    const docRef = doc(db, 'integrations', `email_${organizationId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        connected: Boolean(data.connected && data.fromEmail),
        provider: data.provider ?? null,
        fromEmail: data.fromEmail ?? null,
        fromName: data.fromName ?? null,
      };
    }
  } catch {
    // Firestore read failed (preview mode) — treat as not connected
  }
  return { connected: false, provider: null, fromEmail: null, fromName: null };
}

/**
 * Check if the organization has WhatsApp Business integration configured.
 * Reads from `integrations/whatsapp_{orgId}` in Firestore.
 */
export async function checkWhatsAppIntegration(organizationId: string): Promise<WhatsAppIntegration> {
  try {
    const docRef = doc(db, 'integrations', `whatsapp_${organizationId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        connected: Boolean(data.connected && data.phoneNumber),
        provider: data.provider ?? null,
        phoneNumber: data.phoneNumber ?? null,
        businessName: data.businessName ?? null,
      };
    }
  } catch {
    // Firestore read failed
  }
  return { connected: false, provider: null, phoneNumber: null, businessName: null };
}

export interface SendPaymentLinkEmailParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  linkUrl: string;
  linkExpiry: string;
  organizationId: string;
  paymentId: string;
}

export interface SendPaymentLinkWhatsAppParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  linkUrl: string;
  organizationId: string;
  paymentId: string;
}

/**
 * Send a payment link via email.
 *
 * In production (with email integration connected + a real SMTP/Resend/Sendgrid
 * API key), this would actually dispatch the email. In this sandbox, it writes
 * a notification record with `status: 'queued'` that a background worker would
 * pick up and send via the connected provider.
 *
 * NEVER returns success without actually queuing the email.
 */
export async function sendPaymentLinkEmail(
  params: SendPaymentLinkEmailParams,
): Promise<{ sent: boolean; message: string }> {
  const { to, clientName, invoiceNumber, amount, currency, linkUrl, linkExpiry, organizationId, paymentId } = params;

  const integration = await checkEmailIntegration(organizationId);
  if (!integration.connected) {
    return {
      sent: false,
      message: 'Email is not connected. To send payment links automatically, go to Settings → Integrations → Email and connect your SMTP or email provider (Resend, SendGrid, or AWS SES).',
    };
  }

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  const subject = `Payment Request — Invoice ${invoiceNumber} · ${currencySymbol}${amount.toLocaleString('en-IN')}`;
  const expiryDate = new Date(linkExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Payment Request</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 14px;">Invoice ${invoiceNumber}</p>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #111827; font-size: 16px; margin: 0 0 16px;">Dear ${clientName},</p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          A payment of <strong style="color: #111827;">${currencySymbol}${amount.toLocaleString('en-IN')}</strong> is due for invoice <strong style="color: #111827;">${invoiceNumber}</strong>.
          Please click the button below to complete your payment securely via UPI, card, or net banking.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${linkUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Pay ${currencySymbol}${amount.toLocaleString('en-IN')} Now
          </a>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin: 24px 0 0;">
          This payment link expires on <strong>${expiryDate}</strong>. If you have any questions, reply to this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 11px; margin: 0;">
          Payment ID: ${paymentId}<br>
          Powered by GSTPilot Oracle™
        </p>
      </div>
    </div>
  `;

  // Queue the email as a notification record — a background worker dispatches it.
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
      notificationId,
      organizationId,
      type: 'payment_link_email',
      channel: 'email',
      to,
      subject,
      htmlBody,
      status: 'queued',
      provider: integration.provider,
      fromEmail: integration.fromEmail,
      fromName: integration.fromName,
      relatedPaymentId: paymentId,
      relatedInvoiceNumber: invoiceNumber,
      createdAt: new Date().toISOString(),
      tracking: { delivered: false, opened: false, failed: false, bounced: false },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('permission-denied')) {
      return {
        sent: false,
        message: 'Email was prepared but could not be queued because you are in preview mode. Sign in to dispatch payment emails automatically.',
      };
    }
    return {
      sent: false,
      message: `Email queuing failed: ${msg}. The payment link is created — share it manually: ${linkUrl}`,
    };
  }

  return {
    sent: true,
    message: `Payment link email queued to ${to} (subject: "${subject}"). Notification ID: ${notificationId}. It will be dispatched by the email worker via ${integration.provider}.`,
  };
}

/**
 * Send a payment link via WhatsApp.
 *
 * In production (with WhatsApp Business integration connected + Twilio/Gupshup
 * credentials), this would dispatch the message. In this sandbox, it writes a
 * notification record with `status: 'queued'`.
 *
 * NEVER returns success without actually queuing the message.
 */
export async function sendPaymentLinkWhatsApp(
  params: SendPaymentLinkWhatsAppParams,
): Promise<{ sent: boolean; message: string }> {
  const { to, clientName, invoiceNumber, amount, currency, linkUrl, organizationId, paymentId } = params;

  const integration = await checkWhatsAppIntegration(organizationId);
  if (!integration.connected) {
    return {
      sent: false,
      message: 'WhatsApp Business is not connected. To send payment links via WhatsApp, go to Settings → Integrations → WhatsApp and connect your WhatsApp Business account (via Twilio, Gupshup, or WhatsApp Cloud API).',
    };
  }

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
  const message = `*Payment Request*\n\nHello ${clientName},\n\nA payment of *${currencySymbol}${amount.toLocaleString('en-IN')}* is due for invoice *${invoiceNumber}*.\n\nPay securely via the link below:\n${linkUrl}\n\nThis link expires in 30 days. For help, reply to this message.\n\n— GSTPilot Oracle™`;

  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
      notificationId,
      organizationId,
      type: 'payment_link_whatsapp',
      channel: 'whatsapp',
      to,
      message,
      status: 'queued',
      provider: integration.provider,
      fromPhoneNumber: integration.phoneNumber,
      businessName: integration.businessName,
      relatedPaymentId: paymentId,
      relatedInvoiceNumber: invoiceNumber,
      createdAt: new Date().toISOString(),
      tracking: { sent: false, delivered: false, read: false, failed: false },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('permission-denied')) {
      return {
        sent: false,
        message: 'WhatsApp message was prepared but could not be queued because you are in preview mode. Sign in to dispatch payment messages automatically.',
      };
    }
    return {
      sent: false,
      message: `WhatsApp queuing failed: ${msg}. The payment link is created — share it manually: ${linkUrl}`,
    };
  }

  return {
    sent: true,
    message: `Payment link WhatsApp message queued to ${to} via ${integration.provider}. Notification ID: ${notificationId}.`,
  };
}
