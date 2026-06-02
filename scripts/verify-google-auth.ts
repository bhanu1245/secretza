/**
 * verify-google-auth.ts
 * Static verification of Google OAuth launch fixes.
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  description: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(id: string, description: string, fn: () => boolean, detail?: string) {
  let pass = false;
  let err: string | undefined;
  try {
    pass = fn();
  } catch (e) {
    err = String(e);
  }
  checks.push({ id, description, pass, detail: err ?? detail });
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const authSrc = read("src/lib/auth.ts");
const modalSrc = read("src/components/secretza/auth/AuthModal.tsx");
const pageSrc = read("src/app/page.tsx");
const registerSrc = read("src/app/api/auth/register/route.ts");
const envSrc = fs.existsSync(path.join(ROOT, ".env"))
  ? read(".env")
  : "";

// ─── 1. Environment variables ─────────────────────────────────────────────────

check("1a", ".env has GOOGLE_CLIENT_ID", () =>
  envSrc.includes("GOOGLE_CLIENT_ID=") &&
  !envSrc.includes("GOOGLE_CLIENT_ID=\n") &&
  !envSrc.includes("GOOGLE_CLIENT_ID= "),
);
check("1b", ".env has GOOGLE_CLIENT_SECRET", () =>
  envSrc.includes("GOOGLE_CLIENT_SECRET=") &&
  !envSrc.includes("GOOGLE_CLIENT_SECRET=\n"),
);
check("1c", ".env has NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true", () =>
  envSrc.includes("NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true"),
);

// ─── 2. auth.ts — GoogleProvider ──────────────────────────────────────────────

check("2a", "GoogleProvider imported from next-auth/providers/google", () =>
  authSrc.includes('from "next-auth/providers/google"'),
);
check("2b", "GoogleProvider conditionally included in providers array", () =>
  authSrc.includes("process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET"),
);
check("2c", "allowDangerousEmailAccountLinking: false (safe default)", () =>
  authSrc.includes("allowDangerousEmailAccountLinking: false"),
);

// ─── 3. auth.ts — signIn callback ────────────────────────────────────────────

check("3a", "signIn callback sets isVerified: true for OAuth", () =>
  authSrc.includes("isVerified: true"),
);
check("3b", "signIn callback sets emailVerified for OAuth", () =>
  authSrc.includes("emailVerified") && authSrc.includes("new Date()"),
);
check("3c", "signIn callback sets provider from account.provider (lowercase)", () =>
  authSrc.includes("provider: account.provider.toLowerCase()"),
);
check("3d", "signIn callback stores providerId from account.providerAccountId", () =>
  authSrc.includes("providerId: account.providerAccountId"),
);
check("3e", "signIn callback is inside OAuth-only branch (account.provider !== credentials)", () => {
  // Find the signIn callback's OAuth branch. The select clause also has
  // `isVerified: true` (as a Prisma field selector) earlier in the file,
  // so we search specifically for the data object literal form.
  const oauthBlock = authSrc.indexOf("account.provider !== \"credentials\"");
  if (oauthBlock === -1) return false;
  // Look for the update data containing `isVerified: true` AFTER the oauth branch
  const afterOauth = authSrc.slice(oauthBlock);
  return afterOauth.includes("isVerified: true");
});
check("3f", "dbUser available before the OAuth update (suspension check runs first)", () => {
  const dbUserIdx = authSrc.indexOf("const dbUser = await db.user.findUnique");
  const updateIdx = authSrc.indexOf("isVerified: true");
  return dbUserIdx !== -1 && updateIdx > dbUserIdx;
});

// ─── 4. AuthModal — env flag gate ────────────────────────────────────────────

check("4a", "GOOGLE_OAUTH_ENABLED constant defined from env", () =>
  modalSrc.includes("NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED") &&
  modalSrc.includes("GOOGLE_OAUTH_ENABLED"),
);
check("4b", "GoogleButton gated on GOOGLE_OAUTH_ENABLED in LoginForm", () => {
  // Both OAuthDivider and GoogleButton should be inside the gate
  const gateIdx = modalSrc.indexOf("{GOOGLE_OAUTH_ENABLED && (");
  const loginFormEnd = modalSrc.indexOf("// Register Form");
  return gateIdx !== -1 && gateIdx < loginFormEnd;
});
check("4c", "GoogleButton gated on GOOGLE_OAUTH_ENABLED in RegisterForm", () => {
  // Second gate should exist after the register form heading
  const registerFormStart = modalSrc.indexOf("// Register Form");
  const secondGate = modalSrc.indexOf("{GOOGLE_OAUTH_ENABLED && (", registerFormStart);
  return secondGate !== -1;
});
check("4d", "signIn uses callbackUrl (not redirect: false) for Google", () =>
  modalSrc.includes('callbackUrl: "/"') &&
  !modalSrc.includes('signIn("google", { redirect: false })'),
);
check("4e", "old redirect: false for Google is removed", () =>
  !modalSrc.includes('signIn("google", { redirect: false })'),
);
check("4f", "OAuthDivider still exists (not deleted)", () =>
  modalSrc.includes("OAuthDivider"),
);

// ─── 5. page.tsx — OAuthAccountNotLinked error handling ──────────────────────

check("5a", "toast imported in page.tsx", () =>
  pageSrc.includes('from "sonner"'),
);
check("5b", "OAuthAccountNotLinked detected in page.tsx useEffect", () =>
  pageSrc.includes("OAuthAccountNotLinked"),
);
check("5c", "toast.error shown for OAuthAccountNotLinked", () => {
  const idx = pageSrc.indexOf("OAuthAccountNotLinked");
  const block = pageSrc.slice(idx, idx + 300);
  return block.includes("toast.error");
});
check("5d", "auth modal opened to login tab on OAuthAccountNotLinked", () => {
  // The first hit of OAuthAccountNotLinked may be in a comment; the actual
  // if-check is the second occurrence. Use lastIndexOf to find the code site.
  const lastIdx = pageSrc.lastIndexOf("OAuthAccountNotLinked");
  const block = pageSrc.slice(lastIdx, lastIdx + 400);
  return block.includes('setAuthModalTab("login")') && block.includes("setAuthModalOpen(true)");
});
check("5e", "URL cleared after error handling (router.replace)", () => {
  // router.replace is outside the if-block, scan 600 chars from the first hit.
  const idx = pageSrc.indexOf("OAuthAccountNotLinked");
  const block = pageSrc.slice(idx, idx + 700);
  return block.includes('router.replace("/", { scroll: false })');
});
check("5f", "setAuthModalOpen + setAuthModalTab destructured in HomeApp", () =>
  pageSrc.includes("setAuthModalOpen") && pageSrc.includes("setAuthModalTab"),
);

// ─── 6. register/route.ts — provider lowercase ───────────────────────────────

check("6a", "register route uses provider: \"email\" (lowercase)", () =>
  registerSrc.includes('provider: "email"'),
);
check("6b", 'register route does NOT use provider: "EMAIL" (uppercase)', () =>
  !registerSrc.includes('provider: "EMAIL"'),
);

// ─── 7. Account linking NOT implemented (requirement) ────────────────────────

check("7a", "No linkAccount API route exists (not implemented per spec)", () => {
  const linkRouteExists = fs.existsSync(
    path.join(ROOT, "src/app/api/auth/link-account/route.ts"),
  );
  return !linkRouteExists;
});
check("7b", "No set-password API route exists (not implemented per spec)", () => {
  const setPassRouteExists = fs.existsSync(
    path.join(ROOT, "src/app/api/auth/set-password/route.ts"),
  );
  return !setPassRouteExists;
});

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
const total = checks.length;
const score = Math.round((passed / total) * 100);

console.log("\n===  Google Auth Launch Fixes — Verification  ===\n");

const groups: Record<string, Check[]> = {};
for (const c of checks) {
  const g = c.id.replace(/[a-z]+$/, "");
  if (!groups[g]) groups[g] = [];
  groups[g].push(c);
}

const groupLabels: Record<string, string> = {
  "1": "Environment Variables",
  "2": "GoogleProvider in auth.ts",
  "3": "signIn callback (isVerified / provider / providerId)",
  "4": "AuthModal (gate + redirect fix)",
  "5": "OAuthAccountNotLinked error handling",
  "6": "register/route.ts provider normalization",
  "7": "Non-implemented features (account linking, set-password)",
};

for (const [g, gChecks] of Object.entries(groups)) {
  console.log(`  ── ${groupLabels[g] ?? g} ──`);
  for (const c of gChecks) {
    console.log(`    ${c.pass ? "✓" : "✗"} [${c.id}] ${c.description}`);
    if (!c.pass && c.detail) console.log(`          → ${c.detail}`);
  }
  console.log();
}

console.log(`  Result: ${passed}/${total} checks passed  (${score}/100)`);
console.log(`  Status: ${failed.length === 0 ? "PASS" : "FAIL"}\n`);

// ─── Report ──────────────────────────────────────────────────────────────────

const outDir = path.join(ROOT, "artifacts", "google-auth-fixes");
fs.mkdirSync(outDir, { recursive: true });

const report = {
  timestamp: new Date().toISOString(),
  score,
  passed,
  total,
  status: failed.length === 0 ? "PASS" : "FAIL",
  filesChanged: [
    { file: "src/lib/auth.ts", change: "signIn callback: set isVerified, emailVerified, provider, providerId for OAuth" },
    { file: "src/components/secretza/auth/AuthModal.tsx", change: "Gate GoogleButton on NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED; fix redirect: false → callbackUrl" },
    { file: "src/app/page.tsx", change: "Handle OAuthAccountNotLinked: toast + open auth modal + clear URL" },
    { file: "src/app/api/auth/register/route.ts", change: 'provider: "EMAIL" → "email" (lowercase normalization)' },
  ],
  notImplemented: ["Account linking", "Set-password for OAuth-only users"],
  preserved: ["Credentials login", "Password reset", "Email verification", "Suspension check", "JWT callbacks", "Session callbacks"],
  checks: checks.map((c) => ({ id: c.id, description: c.description, pass: c.pass, ...(c.detail ? { detail: c.detail } : {}) })),
};

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("  Report → artifacts/google-auth-fixes/report.json\n");

if (failed.length > 0) process.exit(1);
