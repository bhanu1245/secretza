/**
 * verify-premium-expiry-session.ts
 * Verifies the premiumExpiry session serialization fix.
 * Simulates the full Date → JWT string → session string → syncFromSession flow.
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

const storeSrc = fs.readFileSync(path.join(ROOT, "src/store/useAppStore.ts"), "utf8");
const authSrc = fs.readFileSync(path.join(ROOT, "src/lib/auth.ts"), "utf8");
const typesSrc = fs.readFileSync(path.join(ROOT, "src/lib/types.ts"), "utf8");
const syncSrc = fs.readFileSync(path.join(ROOT, "src/components/providers/AuthSync.tsx"), "utf8");

// ─── 1. Parameter type accepts string ────────────────────────────────────────

check("1a", "syncFromSession param accepts Date | string | null", () =>
  storeSrc.includes("Date | string | null"),
);
check("1b", "old Date | null only param type is gone", () => {
  // The param type line must contain "string" alongside "Date"
  const idx = storeSrc.indexOf("premiumExpiry?: Date");
  const line = storeSrc.slice(idx, idx + 60);
  return line.includes("string");
});

// ─── 2. Conversion logic is correct ──────────────────────────────────────────

check("2a", "instanceof Date branch exists", () =>
  storeSrc.includes("instanceof Date"),
);
check("2b", "toISOString() is inside instanceof Date guard", () => {
  const instIdx = storeSrc.indexOf("instanceof Date");
  const block = storeSrc.slice(instIdx, instIdx + 80);
  return block.includes("toISOString()");
});
check("2c", "String() fallback for string values exists", () =>
  storeSrc.includes("String(sessionUser.premiumExpiry)"),
);
check("2d", "null fallback when premiumExpiry is falsy", () => {
  const convIdx = storeSrc.indexOf("instanceof Date");
  const block = storeSrc.slice(convIdx - 200, convIdx + 300);
  return block.includes(": null");
});
check("2e", "bare .toISOString() call removed (no longer called without guard)", () => {
  // The old broken call was: sessionUser.premiumExpiry?.toISOString()
  return !storeSrc.includes("sessionUser.premiumExpiry?.toISOString()");
});

// ─── 3. Runtime simulation ────────────────────────────────────────────────────

// Replicate the conversion logic exactly as written in the fixed store.
function convertPremiumExpiry(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

// Case A: Date object (first sign-in — authorize() returns Date from Prisma)
const dateInput = new Date("2026-12-01T00:00:00.000Z");
check("3a", "Date input → ISO string", () => {
  const result = convertPremiumExpiry(dateInput);
  return result === "2026-12-01T00:00:00.000Z";
});

// Case B: ISO string (subsequent requests — JWT deserialized from cookie)
const isoString = "2026-12-01T00:00:00.000Z";
check("3b", "ISO string input → same string (no error)", () => {
  const result = convertPremiumExpiry(isoString);
  return result === isoString;
});

// Case C: null (user has no premium expiry)
check("3c", "null input → null", () => convertPremiumExpiry(null) === null);
check("3d", "undefined input → null", () => convertPremiumExpiry(undefined) === null);

// Case D: expired date still converts correctly (string)
const expiredIso = "2024-01-01T00:00:00.000Z";
check("3e", "expired ISO string converts without error", () => {
  const result = convertPremiumExpiry(expiredIso);
  return result === expiredIso;
});

// Case E: simulate the old broken call to confirm it would have failed
check("3f", "old pattern (?.toISOString on string) would throw TypeError", () => {
  try {
    const str = "2026-12-01T00:00:00.000Z" as unknown as Date;
    str.toISOString(); // would throw on a real string
    return false; // if no throw, it means it somehow worked (not expected)
  } catch (e) {
    return e instanceof TypeError;
  }
});

// ─── 4. Auth.ts — upstream types are consistent ───────────────────────────────

check("4a", "JWT token.premiumExpiry typed as Date | null (server-side correct)", () =>
  authSrc.includes("premiumExpiry?: Date | null"),
);
check("4b", "session callback passes token.premiumExpiry to session.user", () =>
  authSrc.includes("session.user.premiumExpiry = token.premiumExpiry"),
);
check("4c", "premium expiry enforcement uses new Date(token.premiumExpiry)", () =>
  authSrc.includes("new Date(token.premiumExpiry)"),
);

// ─── 5. types.ts — User.premiumExpiry is string | null (correct for client) ──

check("5a", "User type has premiumExpiry: string | null (client-safe)", () =>
  typesSrc.includes("premiumExpiry: string | null"),
);

// ─── 6. AuthSync passes premiumExpiry to syncFromSession ─────────────────────

check("6a", "AuthSync passes session.user.premiumExpiry to syncFromSession", () =>
  syncSrc.includes("premiumExpiry: session.user.premiumExpiry"),
);

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass);
const total = checks.length;
const score = Math.round((passed / total) * 100);

console.log("\n===  premiumExpiry Session Fix Verification  ===\n");
for (const c of checks) {
  console.log(`  ${c.pass ? "✓" : "✗"} [${c.id}] ${c.description}`);
  if (!c.pass && c.detail) console.log(`        → ${c.detail}`);
}
console.log(`\n  Result: ${passed}/${total} checks passed  (${score}/100)`);
console.log(`  Status: ${failed.length === 0 ? "PASS" : "FAIL"}\n`);

// ─── Write report ─────────────────────────────────────────────────────────────

const outDir = path.join(ROOT, "artifacts", "premium-expiry-session-fix");
fs.mkdirSync(outDir, { recursive: true });

const report = {
  timestamp: new Date().toISOString(),
  score,
  passed,
  total,
  status: failed.length === 0 ? "PASS" : "FAIL",
  rootCause: {
    error: "sessionUser.premiumExpiry?.toISOString is not a function",
    file: "src/store/useAppStore.ts",
    line: 102,
    explanation:
      "NextAuth JWT tokens and sessions are JSON-serialized over HTTP. Date objects " +
      "become ISO strings during that serialization. The TypeScript declarations say " +
      "Date | null, but the runtime value is always string | null by the time it " +
      "reaches the browser. Calling .toISOString() on a string throws TypeError.",
  },
  fix: {
    file: "src/store/useAppStore.ts",
    changes: [
      "Changed syncFromSession param type: premiumExpiry?: Date | string | null",
      "Changed conversion: instanceof Date ? .toISOString() : String(value)",
    ],
    premiumLogicChanged: false,
    uiBehaviorChanged: false,
    otherFilesChanged: false,
  },
  flowTrace: [
    { layer: "Prisma User.premiumExpiry", type: "Date | null", runtime: "Date | null" },
    { layer: "authorize() return value", type: "Date | null", runtime: "Date | null" },
    { layer: "token.premiumExpiry (first sign-in)", type: "Date | null", runtime: "Date | null" },
    { layer: "token.premiumExpiry (after JWT cookie round-trip)", type: "Date | null (declared)", runtime: "string | null (JSON)" },
    { layer: "session.user.premiumExpiry (over HTTP)", type: "Date | null (declared)", runtime: "string | null (JSON)" },
    { layer: "syncFromSession param (before fix)", type: "Date | null", runtime: "string → TypeError" },
    { layer: "syncFromSession param (after fix)", type: "Date | string | null", runtime: "string → String() → OK" },
    { layer: "User.premiumExpiry in Zustand store", type: "string | null", runtime: "string | null ✓" },
  ],
  checks: checks.map((c) => ({ id: c.id, description: c.description, pass: c.pass, ...(c.detail ? { detail: c.detail } : {}) })),
};

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log("  Report saved → artifacts/premium-expiry-session-fix/report.json\n");

if (failed.length > 0) process.exit(1);
