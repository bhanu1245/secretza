import { logInfo } from "@/lib/monitoring";
import { BRAND_NAME, emailBrandHeader, EMAIL_BUTTON_STYLE } from "@/lib/brand";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface EmailProvider {
  send(payload: EmailPayload): Promise<{ success: boolean; error?: string }>;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

class ConsoleEmailProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    logInfo("Email sent (dev mode)", { module: "email", to: payload.to, subject: payload.subject });
    return { success: true };
  }
}

class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.defaultFrom = from;
  }

  async send(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: payload.from || this.defaultFrom,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
        }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) {
        return { success: false, error: data.message || "Failed to send email" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

let emailProvider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || "noreply@SecretZa.com";

    if (resendApiKey) {
      emailProvider = new ResendEmailProvider(resendApiKey, fromEmail);
    } else {
      emailProvider = new ConsoleEmailProvider();
    }
  }
  return emailProvider;
}

export function verificationEmailTemplate(name: string, token: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/auth/verify-email?token=${token}`;
  const safeName = escapeHtml(name);

  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        ${emailBrandHeader("Verify Your Email")}
        <p style="color: #A1A1AA; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Hi ${safeName},<br><br>
          Welcome to ${BRAND_NAME}! Please verify your email address to get started.
        </p>
        <a href="${url}" style="${EMAIL_BUTTON_STYLE}">
          Verify Email
        </a>
        <p style="color: #52525B; font-size: 13px; margin-top: 24px; text-align: center;">
          This link expires in 24 hours. If you didn't create this account, you can ignore this email.
        </p>
      </div>
    </div>
  `;
}

export function passwordResetEmailTemplate(name: string, token: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/auth/reset-password?token=${token}`;
  const safeName = escapeHtml(name);

  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        ${emailBrandHeader("Reset Your Password")}
        <p style="color: #A1A1AA; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Hi ${safeName},<br><br>
          We received a request to reset your password. Click the button below to set a new password.
        </p>
        <a href="${url}" style="${EMAIL_BUTTON_STYLE}">
          Reset Password
        </a>
        <p style="color: #52525B; font-size: 13px; margin-top: 24px; text-align: center;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}

export function loginAlertEmailTemplate(name: string, ip: string, time: string): string {
  const safeName = escapeHtml(name);
  const safeIp = escapeHtml(ip);
  const safeTime = escapeHtml(time);

  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        ${emailBrandHeader("New Login Detected")}
        <p style="color: #A1A1AA; font-size: 16px; line-height: 1.5;">
          Hi ${safeName},<br><br>
          A new login was detected on your ${BRAND_NAME} account:<br><br>
          <strong style="color: #F5F5F7;">IP Address:</strong> ${safeIp}<br>
          <strong style="color: #F5F5F7;">Time:</strong> ${safeTime}<br><br>
          If this was you, no action is needed. If you don't recognize this activity, please secure your account immediately.
        </p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `Verify your email - ${BRAND_NAME}`,
    html: verificationEmailTemplate(name, token),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `Reset your password - ${BRAND_NAME}`,
    html: passwordResetEmailTemplate(name, token),
  });
}

export async function sendLoginAlert(
  to: string,
  name: string,
  ip: string
): Promise<{ success: boolean; error?: string }> {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: `New login detected - ${BRAND_NAME}`,
    html: loginAlertEmailTemplate(name, ip, new Date().toISOString()),
  });
}

// ==========================================
// Admin notifications
// ==========================================

/**
 * Resolve admin notification recipients from ADMIN_NOTIFICATION_EMAIL.
 * Supports a comma-separated list. Returns [] when unconfigured (caller skips).
 */
export function getAdminNotificationRecipients(): string[] {
  const raw = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes("@"));
}

export function adminNotificationTemplate(heading: string, lines: string[]): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const safeLines = lines
    .map(
      (line) =>
        `<p style="color: #A1A1AA; font-size: 15px; line-height: 1.5; margin: 4px 0;">${escapeHtml(line)}</p>`,
    )
    .join("");

  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        ${emailBrandHeader(escapeHtml(heading))}
        ${safeLines}
        <a href="${baseUrl}/admin" style="${EMAIL_BUTTON_STYLE}">
          Open Admin Panel
        </a>
      </div>
    </div>
  `;
}

/**
 * Send an admin notification to all configured recipients.
 * No-op (returns skipped) when ADMIN_NOTIFICATION_EMAIL is unset.
 */
export async function sendAdminNotification(
  subject: string,
  heading: string,
  lines: string[],
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const recipients = getAdminNotificationRecipients();
  if (recipients.length === 0) {
    return { success: true, skipped: true };
  }

  const provider = getEmailProvider();
  const html = adminNotificationTemplate(heading, lines);
  const results = await Promise.all(
    recipients.map((to) =>
      provider.send({ to, subject: `[${BRAND_NAME} Admin] ${subject}`, html }),
    ),
  );

  const failed = results.find((r) => !r.success);
  return failed ? { success: false, error: failed.error } : { success: true };
}
