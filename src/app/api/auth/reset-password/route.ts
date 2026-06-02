import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
    }
    .logo {
      text-align: center;
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
    .card h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #F5F5F7;
    }
    .card p {
      color: #A1A1AA;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      color: #A1A1AA;
      margin-bottom: 6px;
      font-weight: 500;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      background: #0B0B0F;
      border: 1px solid #27272A;
      border-radius: 8px;
      color: #F5F5F7;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      border-color: #7C3AED;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #7C3AED, #8B5CF6);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .error-text { color: #EF4444; font-size: 14px; }
    .success-text { color: #22C55E; font-size: 14px; }
    .error-page { text-align: center; }
    .error-page .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    a { color: #7C3AED; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;

// GET: Show reset password form
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      const body = `
        <div class="container">
          <div class="logo">
            <div class="logo-icon"><span>S</span></div>
            <h1>SecretZa</h1>
          </div>
          <div class="card error-page">
            <div class="icon">&#x26A0;&#xFE0F;</div>
            <h2 class="error-text">Invalid Request</h2>
            <p>No reset token provided. Please request a new password reset link.</p>
            <a href="/">Back to SecretZa</a>
          </div>
        </div>`;
      return new NextResponse(HTML_TEMPLATE("Invalid Request — SecretZa", body), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Look up token
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
          <div class="card error-page">
            <div class="icon">&#x1F512;</div>
            <h2 class="error-text">Link Expired or Invalid</h2>
            <p>This password reset link is invalid or has expired. Please request a new one.</p>
            <a href="/">Back to SecretZa</a>
          </div>
        </div>`;
      return new NextResponse(HTML_TEMPLATE("Link Expired — SecretZa", body), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Valid token — show reset form
    // NOTE: Token is JSON.stringified to prevent XSS via token injection
    const safeToken = JSON.stringify(token);
    const formBody = `
      <div class="container">
        <div class="logo">
          <div class="logo-icon"><span>S</span></div>
          <h1>SecretZa</h1>
        </div>
        <div class="card">
          <h2>Reset Your Password</h2>
          <p>Enter your new password below. Make sure it's at least 8 characters with an uppercase letter and a number.</p>
          <form id="resetForm">
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input type="password" id="newPassword" name="newPassword" required minlength="8" placeholder="Enter new password" />
            </div>
            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" required minlength="8" placeholder="Confirm new password" />
            </div>
            <button type="submit" class="btn">Reset Password</button>
            <div id="message" style="margin-top: 16px;"></div>
          </form>
        </div>
      </div>
      <script>
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          var msg = document.getElementById('message');
          var password = document.getElementById('newPassword').value;
          var confirm = document.getElementById('confirmPassword').value;

          if (password !== confirm) {
            var p = document.createElement('p');
            p.className = 'error-text';
            p.textContent = 'Passwords do not match.';
            msg.innerHTML = '';
            msg.appendChild(p);
            return;
          }
          if (password.length < 8) {
            var p2 = document.createElement('p');
            p2.className = 'error-text';
            p2.textContent = 'Password must be at least 8 characters.';
            msg.innerHTML = '';
            msg.appendChild(p2);
            return;
          }
          if (!/[A-Z]/.test(password)) {
            var p3 = document.createElement('p');
            p3.className = 'error-text';
            p3.textContent = 'Password must contain an uppercase letter.';
            msg.innerHTML = '';
            msg.appendChild(p3);
            return;
          }
          if (!/[0-9]/.test(password)) {
            var p4 = document.createElement('p');
            p4.className = 'error-text';
            p4.textContent = 'Password must contain a number.';
            msg.innerHTML = '';
            msg.appendChild(p4);
            return;
          }

          try {
            var res = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: ${safeToken}, newPassword: password }),
            });
            var data = await res.json();
            if (res.ok) {
              msg.innerHTML = '';
              var sp = document.createElement('p');
              sp.className = 'success-text';
              sp.textContent = data.message || 'Password reset successfully!';
              msg.appendChild(sp);
              var link = document.createElement('a');
              link.href = '/';
              link.textContent = 'Return to SecretZa';
              link.style.marginTop = '8px';
              link.style.display = 'block';
              msg.appendChild(link);
              document.getElementById('resetForm').style.display = 'none';
            } else {
              msg.innerHTML = '';
              var ep = document.createElement('p');
              ep.className = 'error-text';
              ep.textContent = (data.errors && data.errors[0]) || data.error || 'Something went wrong.';
              msg.appendChild(ep);
            }
          } catch {
            msg.innerHTML = '';
            var np = document.createElement('p');
            np.className = 'error-text';
            np.textContent = 'Network error. Please try again.';
            msg.appendChild(np);
          }
        });
      </script>`;

    return new NextResponse(HTML_TEMPLATE("Reset Password — SecretZa", formBody), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    logError(error, { component: "route:api/auth/reset-password" });
    const body = `
      <div class="container">
        <div class="logo">
          <div class="logo-icon"><span>S</span></div>
          <h1>SecretZa</h1>
        </div>
        <div class="card error-page">
          <div class="icon">&#x26A0;&#xFE0F;</div>
          <h2 class="error-text">Error</h2>
          <p>An unexpected error occurred. Please try again later.</p>
          <a href="/">Back to SecretZa</a>
        </div>
      </div>`;
    return new NextResponse(HTML_TEMPLATE("Error — SecretZa", body), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

// POST: Process password reset
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rl = await rateLimit(`reset-password:${ip}`, RATE_LIMITS.resetPassword);
    if (!rl.success) {
      return NextResponse.json(
        { errors: ["Too many attempts. Please try again later."] },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const { token, newPassword } = body;

    // Validate password
    if (typeof newPassword !== "string") {
      return NextResponse.json(
        { errors: ["Password is required."] },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { errors: ["Password must be at least 8 characters long."] },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { errors: ["Password must be at most 128 characters."] },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { errors: ["Password must contain at least one uppercase letter."] },
        { status: 400 }
      );
    }

    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { errors: ["Password must contain at least one number."] },
        { status: 400 }
      );
    }

    // Look up token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return NextResponse.json(
        { errors: ["This reset link is invalid or has expired."] },
        { status: 400 }
      );
    }

    // Extract email from identifier (format: "reset:email@example.com")
    const identifier = verificationToken.identifier;
    if (!identifier.startsWith("reset:")) {
      return NextResponse.json(
        { errors: ["Invalid reset token."] },
        { status: 400 }
      );
    }

    const email = identifier.slice(6); // Remove "reset:" prefix

    // Find user
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { errors: ["User not found."] },
        { status: 400 }
      );
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update user password and delete the verification token
    // NOTE: JWT-based sessions cannot be immediately invalidated server-side.
    // The periodic refresh in the jwt callback (every hour) will pick up any
    // suspension changes, but existing sessions remain valid until JWT expiry.
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
        },
      }),
      db.verificationToken.delete({
        where: { token },
      }),
    ]);

    return NextResponse.json(
      { message: "Password has been reset successfully." },
      { status: 200 }
    );
  } catch (error) {
    logError(error, { component: "route:api/auth/reset-password" });
    return NextResponse.json(
      { errors: ["An unexpected error occurred. Please try again."] },
      { status: 500 }
    );
  }
}
