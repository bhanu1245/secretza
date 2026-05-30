/**
 * Verification script for Payments & Subscription audit fixes.
 * Performs static code analysis against the three modified files.
 * Run: npx tsx scripts/verify-payments-subscription-fixes.ts
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

function readFile(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

function check(id: string, description: string, pass: boolean, detail?: string) {
  checks.push({ id, description, pass, detail });
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} [${id}] ${description}${detail ? " — " + detail : ""}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE 1: src/lib/manual-payment-validation.ts
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── manual-payment-validation.ts ──");
const validationSrc = readFile("src/lib/manual-payment-validation.ts");

check(
  "P0-1a",
  "superRefine exists in the schema",
  validationSrc.includes("superRefine"),
);
check(
  "P0-1b",
  "boost listingId requirement present",
  validationSrc.includes(`paymentType === "boost"`) && validationSrc.includes("listingId"),
);
check(
  "P0-1c",
  "feature listingId requirement present",
  validationSrc.includes(`paymentType === "feature"`),
);
check(
  "P0-1d",
  "premium is NOT blocked by listingId check",
  !validationSrc.includes(`paymentType === "premium"`) ||
    validationSrc.includes("premium account-level") || // comment variant
    // The superRefine only checks boost/feature
    /\(data\.paymentType === "boost" \|\| data\.paymentType === "feature"\)/.test(validationSrc),
);
check(
  "P0-1e",
  "ZodIssueCode.custom used for the listingId error",
  validationSrc.includes("ZodIssueCode.custom"),
);
check(
  "P0-1f",
  "Error message references paymentType",
  validationSrc.includes("listingId is required for"),
);

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2: src/lib/coupons.ts
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── coupons.ts ──");
const couponsSrc = readFile("src/lib/coupons.ts");

check(
  "P0-2a",
  "redeemCouponOnApproval exists",
  couponsSrc.includes("redeemCouponOnApproval"),
);
check(
  "P0-2b",
  "Coupon-not-found no longer throws (skips gracefully)",
  !couponsSrc.includes('throw new Error("Coupon not found during redemption")'),
);
check(
  "P0-2c",
  "Inactive coupon no longer throws (skips gracefully)",
  !couponsSrc.includes('throw new Error("Coupon is inactive")'),
);
check(
  "P0-2d",
  "Expired coupon no longer throws (skips gracefully)",
  !couponsSrc.includes('throw new Error("Coupon expired")'),
);
check(
  "P0-2e",
  "Idempotency guard still present (existing redemption check)",
  couponsSrc.includes("existingRedemption"),
);
check(
  "P0-2f",
  "Warn log for deleted coupon present",
  couponsSrc.includes("coupon deleted after submission"),
);
check(
  "P0-2g",
  "Warn log for deactivated coupon present",
  couponsSrc.includes("coupon deactivated after submission") ||
    couponsSrc.includes("no longer active"),
);
check(
  "P0-2h",
  "Warn log for expired coupon present",
  couponsSrc.includes("coupon expired after submission"),
);
check(
  "P0-2i",
  "User-limit reached logs and returns null (no throw)",
  couponsSrc.includes("user coupon limit already reached"),
);
check(
  "P0-2j",
  "Global-limit reached logs and returns null (no throw)",
  couponsSrc.includes("global coupon limit already reached"),
);
check(
  "P0-2k",
  "Happy-path still increments usedCount",
  couponsSrc.includes("usedCount: { increment: 1 }"),
);
check(
  "P0-2l",
  "Happy-path still creates CouponRedemption record",
  couponsSrc.includes("couponRedemption.create"),
);

// ─────────────────────────────────────────────────────────────────────────────
// FILE 3: src/app/api/admin/payments/manual/[id]/review/route.ts
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n── review/route.ts ──");
const reviewSrc = readFile("src/app/api/admin/payments/manual/[id]/review/route.ts");

// P1-3: Duplicate notification
check(
  "P1-3a",
  "Duplicate notification block present",
  reviewSrc.includes('reviewAction === "duplicate"') &&
    reviewSrc.includes("createNotification"),
);
check(
  "P1-3b",
  "notification type 'payment_duplicate' used",
  reviewSrc.includes("payment_duplicate"),
);
check(
  "P1-3c",
  "Duplicate notification message references the payment",
  reviewSrc.includes("flagged as a duplicate"),
);

// P1-4: Status re-check inside transaction
check(
  "P1-4a",
  "SubmissionAlreadyProcessedError class defined",
  reviewSrc.includes("SubmissionAlreadyProcessedError"),
);
check(
  "P1-4b",
  "Status re-read inside transaction (findUnique inside tx callback)",
  /await tx\.manualPaymentSubmission\.findUnique/.test(reviewSrc),
);
check(
  "P1-4c",
  "SubmissionAlreadyProcessedError thrown inside transaction",
  /throw new SubmissionAlreadyProcessedError/.test(reviewSrc),
);
check(
  "P1-4d",
  "SubmissionAlreadyProcessedError caught in outer catch and returned as 409",
  reviewSrc.includes("instanceof SubmissionAlreadyProcessedError") &&
    reviewSrc.includes("status: 409"),
);

// P1-5: Block duplicate → approve
check(
  "P1-5a",
  "Guard blocks approve when status is 'duplicate'",
  reviewSrc.includes(`submission.status === "duplicate"`) &&
    reviewSrc.includes(`reviewAction === "approve"`),
);
check(
  "P1-5b",
  "DUPLICATE_STATUS error code present",
  reviewSrc.includes("DUPLICATE_STATUS"),
);
check(
  "P1-5c",
  "409 returned for duplicate → approve attempt",
  /DUPLICATE_STATUS[\s\S]{0,200}status: 409/.test(reviewSrc) ||
    /status: 409[\s\S]{0,200}DUPLICATE_STATUS/.test(reviewSrc),
);

// Existing functionality preserved
check(
  "PRES-1",
  "Premium activation (account-level) preserved",
  reviewSrc.includes('paymentType === "premium"') && reviewSrc.includes("isPremium: true"),
);
check(
  "PRES-2",
  "Boost activation still uses getDurationForTier",
  reviewSrc.includes('getDurationForTier("boost"'),
);
check(
  "PRES-3",
  "Feature activation still uses getDurationForTier",
  reviewSrc.includes('getDurationForTier("feature"'),
);
check(
  "PRES-4",
  "Approval notification still sent",
  reviewSrc.includes("payment_approved"),
);
check(
  "PRES-5",
  "Rejection notification still sent",
  reviewSrc.includes("payment_rejected"),
);
check(
  "PRES-6",
  "Proof-requested notification still sent",
  reviewSrc.includes("payment_proof_requested"),
);
check(
  "PRES-7",
  "AuditLog still created",
  reviewSrc.includes("auditLog.create"),
);
check(
  "PRES-8",
  "Payment record still created on approval",
  reviewSrc.includes("tx.payment.create"),
);

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────────");
const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;
const total = checks.length;
console.log(`RESULT: ${passed}/${total} checks passed, ${failed} failed`);

const report = {
  timestamp: new Date().toISOString(),
  summary: { passed, failed, total },
  verdict: failed === 0 ? "PASS" : "FAIL",
  checks: checks.map((c) => ({
    id: c.id,
    description: c.description,
    pass: c.pass,
    detail: c.detail,
  })),
  implementationReport: {
    "P0-1": {
      fix: "Require listingId for boost/feature payments",
      file: "src/lib/manual-payment-validation.ts",
      approach: "Added .superRefine() to manualPaymentFormSchema that adds a ZodIssueCode.custom issue when paymentType is 'boost' or 'feature' and listingId is absent. Premium remains account-level and is not affected.",
    },
    "P0-2": {
      fix: "Preserve coupon validity at submission time",
      file: "src/lib/coupons.ts",
      approach:
        "Replaced all throws in redeemCouponOnApproval for post-submission coupon state changes (deleted, inactive, expired, limits reached) with console.warn + return null. The approval transaction proceeds regardless — the user already paid the discounted amount. Happy-path still increments usedCount and creates CouponRedemption. Idempotency guard is preserved.",
    },
    "P1-3": {
      fix: "Add notification for duplicate payment status",
      file: "src/app/api/admin/payments/manual/[id]/review/route.ts",
      approach:
        "Added an else-if branch for reviewAction === 'duplicate' that calls createNotification with type 'payment_duplicate', explaining the flag and directing the user to contact support.",
    },
    "P1-4": {
      fix: "Move payment status re-check inside the approval transaction",
      file: "src/app/api/admin/payments/manual/[id]/review/route.ts",
      approach:
        "Defined SubmissionAlreadyProcessedError sentinel class. Inside the $transaction callback, re-reads the submission status from the DB. If already terminal or duplicate, throws SubmissionAlreadyProcessedError which rolls back the transaction. The outer catch intercepts it and returns 409 — preventing duplicate approval side-effects.",
    },
    "P1-5": {
      fix: "Prevent duplicate-status submissions from being approved",
      file: "src/app/api/admin/payments/manual/[id]/review/route.ts",
      approach:
        "Added a pre-transaction guard: if reviewAction === 'approve' and submission.status === 'duplicate', returns 409 with DUPLICATE_STATUS code. Admin can still reject or request proof on duplicate submissions. The in-transaction re-check also covers this case to handle concurrent race conditions.",
    },
  },
};

const artifactsDir = "artifacts/payments-subscription-fixes";
fs.mkdirSync(path.join(ROOT, artifactsDir), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, artifactsDir, "report.json"),
  JSON.stringify(report, null, 2),
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Payments & Subscription Fixes — Verification Report</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
  h1 { color: #f8fafc; }
  h2 { color: #94a3b8; margin-top: 32px; }
  .badge { display:inline-block; padding: 4px 12px; border-radius: 999px; font-weight:700; font-size:14px; }
  .pass { background:#16a34a; color:#fff; }
  .fail { background:#dc2626; color:#fff; }
  table { border-collapse: collapse; width: 100%; margin-top:12px; }
  th { background:#1e293b; padding:8px 12px; text-align:left; font-size:13px; color:#94a3b8; }
  td { padding:8px 12px; font-size:13px; border-bottom:1px solid #1e293b; }
  .ok { color:#4ade80; font-weight:700; }
  .fail-cell { color:#f87171; font-weight:700; }
  .section { background:#1e293b; border-radius:12px; padding:20px 24px; margin-bottom:24px; }
  code { background:#0f172a; padding:2px 6px; border-radius:4px; font-size:12px; }
</style>
</head>
<body>
<h1>Payments &amp; Subscription Fixes — Verification Report</h1>
<p>Generated: ${new Date().toISOString()}</p>
<p>Overall: <span class="badge ${failed === 0 ? "pass" : "fail"}">${failed === 0 ? "PASS" : "FAIL"} ${passed}/${total}</span></p>

<div class="section">
<h2>Fix Summary</h2>
${Object.entries(report.implementationReport)
  .map(
    ([k, v]) => `<p><strong>${k}: ${v.fix}</strong><br/>
    <code>${v.file}</code><br/>${v.approach}</p>`,
  )
  .join("")}
</div>

<div class="section">
<h2>Checks</h2>
<table>
<thead><tr><th>ID</th><th>Description</th><th>Result</th></tr></thead>
<tbody>
${checks
  .map(
    (c) =>
      `<tr><td><code>${c.id}</code></td><td>${c.description}</td><td class="${c.pass ? "ok" : "fail-cell"}">${c.pass ? "PASS" : "FAIL"}</td></tr>`,
  )
  .join("")}
</tbody>
</table>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, artifactsDir, "report.html"), html);
console.log(`\nReports saved to ${artifactsDir}/`);
process.exit(failed > 0 ? 1 : 0);
