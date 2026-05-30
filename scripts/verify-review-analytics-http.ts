/** Authenticated HTTP test for review analytics */
import { loadEnvConfig } from "@next/env";
import { encode } from "next-auth/jwt";
import { UserRole } from "@prisma/client";
import { db } from "../src/lib/db";

loadEnvConfig(process.cwd());

async function main() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NEXTAUTH_SECRET not set");
    process.exit(1);
  }

  const admin = await db.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true, role: true, email: true, sessionVersion: true },
  });
  if (!admin) {
    console.error("No admin user in database");
    process.exit(1);
  }


  const moderator = await db.user.findFirst({
    where: { role: UserRole.MODERATOR },
    select: { id: true, email: true, sessionVersion: true },
  });

  const base = process.env.BASE_URL || "http://localhost:3000";
  console.log("Admin user:", admin.email);

  async function hitAnalytics(role: string, token: string) {
    const res = await fetch(`${base}/api/admin/reviews/analytics?days=30`, {
      headers: { Cookie: `next-auth.session-token=${encodeURIComponent(token)}` },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    console.log(`${role} HTTP status:`, res.status);
    if (res.status !== 200) {
      console.error(`${role} response:`, text);
      process.exit(1);
    }
    const data = JSON.parse(text);
    console.log(`✓ ${role} analytics API returned 200 (totalReviews: ${data.totalReviews})`);
  }

  const adminToken = await encode({
    token: {
      id: admin.id,
      role: "admin",
      sub: admin.id,
      sessionVersion: admin.sessionVersion ?? 0,
    },
    secret,
  });
  await hitAnalytics("Admin", adminToken);

  if (moderator) {
    const modToken = await encode({
      token: {
        id: moderator.id,
        role: "moderator",
        sub: moderator.id,
        sessionVersion: moderator.sessionVersion ?? 0,
      },
      secret,
    });
    await hitAnalytics("Moderator", modToken);
  } else {
    console.log("(No moderator user — skipped moderator HTTP test)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
