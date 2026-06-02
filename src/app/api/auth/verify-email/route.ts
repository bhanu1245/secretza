import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

const HTML_TEMPLATE = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — SecretZa</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0B0B0F;
      color: #F5F5F7;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .logo {
      margin-bottom: 32px;
    }
    .logo-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #7C3AED, #8B5CF6);
      margin-bottom: 12px;
    }
    .logo-icon span {
      color: white;
      font-weight: bold;
      font-size: 24px;
    }
    .logo h1 {
      font-size: 20px;
      color: #F5F5F7;
    }
    .card {
      background: #16161D;
      border: 1px solid #27272A;
      border-radius: 16px;
      padding: 32px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 18px;
      margin-bottom: 12px;
      color: #F5F5F7;
    }
    p {
      color: #A1A1AA;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .error-text { color: #EF4444; }
    .success-text { color: #22C55E; }
    .btn {
      display: inline-block;
      padding: 12px 32px;
      background: linear-gradient(135deg, #7C3AED, #8B5CF6);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    a { color: #7C3AED; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: prevent brute-force verification token guessing
    const ip = getClientIp(request);
    const rl = await rateLimit(`verify-email:${ip}`, RATE_LIMITS.forgotPassword);
    if (!rl.success) {
      return new NextResponse(
        "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Rate Limited</title></head><body style=\"text-align:center;padding:48px;font-family:sans-serif\"><h2>Too Many Requests</h2><p>Please wait before trying again.</p></body></html>",
        {
          status: 429,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      const body = `
        <div class="container">
          <div class="logo">
            <div class="logo-icon"><span>S</span></div>
            <h1>SecretZa</h1>
          </div>
          <div class="card">
            <div class="icon">&#x26A0;&#xFE0F;</div>
            <h2 class="error-text">Invalid Request</h2>
            <p>No verification token provided. Please check your email for the correct link.</p>
            <a href="/" class="btn">Back to SecretZa</a>
          </div>
        </div>`;
      return new NextResponse(HTML_TEMPLATE("Invalid Request — SecretZa", body), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Look up verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      const body = `
        <div class="container">
          <div class="logo">
            <div class="logo-icon"><span>S</span></div>
            <h1>SecretZa</h1>
          </div>
          <div class="card">
            <div class="icon">&#x1F512;</div>
            <h2 class="error-text">Link Expired or Invalid</h2>
            <p>This verification link is invalid or has expired. Please request a new one from your account settings.</p>
            <a href="/" class="btn">Back to SecretZa</a>
          </div>
        </div>`;
      return new NextResponse(HTML_TEMPLATE("Link Expired — SecretZa", body), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Reject non-verification tokens
    if (verificationToken.identifier.startsWith("reset:")) {
      const body = `
        <div class="container">
          <div class="logo">
            <div class="logo-icon"><span>S</span></div>
            <h1>SecretZa</h1>
          </div>
          <div class="card">
            <div class="icon">&#x26A0;&#xFE0F;</div>
            <h2 class="error-text">Invalid Token</h2>
            <p>This is not a valid email verification link. Please check your email for the correct link.</p>
            <a href="/" class="btn">Back to SecretZa</a>
          </div>
        </div>`;
      return new NextResponse(HTML_TEMPLATE("Invalid Token — SecretZa", body), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Extract email from identifier
    const email = verificationToken.identifier;

    // Update user verification status and delete token in a transaction
    await db.$transaction([
      db.user.update({
        where: { email },
        data: {
          isVerified: true,
          emailVerified: new Date(),
        },
      }),
      db.verificationToken.delete({
        where: { token },
      }),
    ]);

    // Success page
    const body = `
      <div class="container">
        <div class="logo">
          <div class="logo-icon"><span>S</span></div>
          <h1>SecretZa</h1>
        </div>
        <div class="card">
          <div class="icon">&#x2705;</div>
          <h2 class="success-text">Email Verified!</h2>
          <p>Your email has been successfully verified. Welcome to SecretZa! You can now access all features of your account.</p>
          <a href="/" class="btn">Go to SecretZa</a>
        </div>
      </div>`;

    return new NextResponse(HTML_TEMPLATE("Email Verified — SecretZa", body), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    logError(error, { component: "auth:verify-email", action: "verify" });
    const body = `
      <div class="container">
        <div class="logo">
          <div class="logo-icon"><span>S</span></div>
          <h1>SecretZa</h1>
        </div>
        <div class="card">
          <div class="icon">&#x26A0;&#xFE0F;</div>
          <h2 class="error-text">Verification Failed</h2>
          <p>An unexpected error occurred during email verification. Please try again later.</p>
          <a href="/" class="btn">Back to SecretZa</a>
        </div>
      </div>`;
    return new NextResponse(HTML_TEMPLATE("Verification Failed — SecretZa", body), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
