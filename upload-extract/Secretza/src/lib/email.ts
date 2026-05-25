// Resend-compatible email service abstraction

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface EmailProvider {
  send(payload: EmailPayload): Promise<{ success: boolean; error?: string }>;
}

// Console provider (dev mode)
class ConsoleEmailProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
    console.log("📧 Email sent (dev mode):", {
      to: payload.to,
      subject: payload.subject,
    });
    return { success: true };
  }
}

// Resend provider (production)
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

// Factory function
let emailProvider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || "noreply@secretza.com";

    if (resendApiKey) {
      emailProvider = new ResendEmailProvider(resendApiKey, fromEmail);
    } else {
      emailProvider = new ConsoleEmailProvider();
    }
  }
  return emailProvider;
}

// Email templates
export function verificationEmailTemplate(name: string, token: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/auth/verify-email?token=${token}`;

  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #8B5CF6); margin-bottom: 16px;">
            <span style="color: white; font-weight: bold; font-size: 24px;">S</span>
          </div>
          <h1 style="color: #F5F5F7; font-size: 24px; margin: 0;">Verify Your Email</h1>
        </div>
        <p style="color: #A1A1AA; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Hi ${name},<br><br>
          Welcome to Secretza! Please verify your email address to get started.
        </p>
        <a href="${url}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #7C3AED, #8B5CF6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
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

  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #8B5CF6); margin-bottom: 16px;">
            <span style="color: white; font-weight: bold; font-size: 24px;">S</span>
          </div>
          <h1 style="color: #F5F5F7; font-size: 24px; margin: 0;">Reset Your Password</h1>
        </div>
        <p style="color: #A1A1AA; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
          Hi ${name},<br><br>
          We received a request to reset your password. Click the button below to set a new password.
        </p>
        <a href="${url}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #7C3AED, #8B5CF6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
  return `
    <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #0B0B0F; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #7C3AED, #8B5CF6); margin-bottom: 16px;">
            <span style="color: white; font-weight: bold; font-size: 24px;">S</span>
          </div>
          <h1 style="color: #F5F5F7; font-size: 24px; margin: 0;">New Login Detected</h1>
        </div>
        <p style="color: #A1A1AA; font-size: 16px; line-height: 1.5;">
          Hi ${name},<br><br>
          A new login was detected on your Secretza account:<br><br>
          <strong style="color: #F5F5F7;">IP Address:</strong> ${ip}<br>
          <strong style="color: #F5F5F7;">Time:</strong> ${time}<br><br>
          If this was you, no action is needed. If you don't recognize this activity, please secure your account immediately.
        </p>
      </div>
    </div>
  `;
}

// Send functions
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const provider = getEmailProvider();
  return provider.send({
    to,
    subject: "Verify your email - Secretza",
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
    subject: "Reset your password - Secretza",
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
    subject: "New login detected - Secretza",
    html: loginAlertEmailTemplate(name, ip, new Date().toISOString()),
  });
}
