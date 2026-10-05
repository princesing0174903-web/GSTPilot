/**
 * Email & WhatsApp Notification Service
 *
 * Provides a unified notification adapter for sending alerts and reminders
 * across multiple channels: email, WhatsApp, in-app, and push notifications.
 *
 * Current state:
 * - In-app notifications are handled via the Zustand store
 * - Email and WhatsApp channels are stubs (V2)
 *
 * V2 roadmap:
 * - Email via SendGrid/SES with templated messages
 * - WhatsApp Business API integration
 * - Push notifications via FCM/Web Push API
 * - Notification preferences per user
 * - Delivery tracking and read receipts
 */

export interface NotificationChannel {
  type: 'email' | 'whatsapp' | 'in_app' | 'push';
  enabled: boolean;
  config: Record<string, string>;
}

export interface NotificationPayload {
  to: string;
  subject: string;
  title: string;
  message: string;
  actionUrl?: string;
  template?: string;
}

class NotificationService {
  private channels: NotificationChannel[] = [
    { type: 'in_app', enabled: true, config: {} },
    { type: 'email', enabled: false, config: {} },
    { type: 'whatsapp', enabled: false, config: {} },
    { type: 'push', enabled: false, config: {} },
  ];

  /**
   * Configure or update a notification channel.
   * Enables/disables channels and sets provider-specific configuration.
   */
  configureChannel(channel: NotificationChannel) {
    const idx = this.channels.findIndex((c) => c.type === channel.type);
    if (idx >= 0) this.channels[idx] = channel;
    else this.channels.push(channel);
  }

  /**
   * Send a notification across all enabled channels.
   * In-app notifications are delegated to the Zustand store.
   * Email, WhatsApp, and push are stubs for V2.
   */
  async send(
    payload: NotificationPayload
  ): Promise<{ sent: boolean; channel: string }> {
    // In-app notifications are handled by Zustand store
    // Email and WhatsApp will be implemented in V2

    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      switch (channel.type) {
        case 'email':
          // Will use SendGrid/SES in V2
          console.log(
            `[Email] To: ${payload.to}, Subject: ${payload.subject}`
          );
          break;
        case 'whatsapp':
          // Will use WhatsApp Business API in V2
          console.log(
            `[WhatsApp] To: ${payload.to}, Message: ${payload.title}`
          );
          break;
        case 'push':
          // Will use FCM/Push API in V2
          console.log(`[Push] Title: ${payload.title}`);
          break;
        case 'in_app':
          // Handled by Zustand store's addNotification
          break;
      }
    }

    return { sent: true, channel: 'in_app' };
  }

  /**
   * Send a GST filing reminder notification.
   * Convenience method that formats the reminder payload.
   */
  async sendFilingReminder(
    clientName: string,
    returnType: string,
    period: string,
    dueDate: string,
    email: string
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `GST Filing Reminder: ${returnType} for ${period}`,
      title: `${returnType} Due Soon`,
      message: `${returnType} for ${period} is due by ${dueDate}. Client: ${clientName}`,
      template: 'filing_reminder',
    });
  }
}

export const notificationService = new NotificationService();
