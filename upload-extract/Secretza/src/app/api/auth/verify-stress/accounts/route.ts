import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/auth/verify-stress/accounts
 *
 * Returns all test user accounts for documentation purposes.
 * Passwords are masked for security.
 */
export async function GET() {
  const testEmails = [
    "admin@secretza.com",
    "moderator@secretza.com",
    "test@secretza.com",
    "unverified@secretza.com",
    "suspended@secretza.com",
    "premium@secretza.com",
  ];

  const users = await db.user.findMany({
    where: { email: { in: testEmails } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isVerified: true,
      isSuspended: true,
      isPremium: true,
      premiumExpiry: true,
      provider: true,
      emailVerified: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { role: "asc" },
  });

  // Known test passwords (masked)
  const knownPasswords: Record<string, string> = {
    "admin@secretza.com": "Ad********",
    "moderator@secretza.com": "Mo*********",
    "test@secretza.com": "Te*******",
    "unverified@secretza.com": "Un***********",
    "suspended@secretza.com": "Su***********",
    "premium@secretza.com": "Pr*********",
  };

  const enrichedUsers = users.map((user) => ({
    ...user,
    maskedPassword: knownPasswords[user.email] || "N/A",
  }));

  return NextResponse.json({
    description: "Secretza test user accounts for auth stress verification",
    totalAccounts: enrichedUsers.length,
    accounts: enrichedUsers,
    notes: [
      "Passwords are masked for security — only the first two and last characters are shown.",
      "All test passwords follow the pattern: Type + 123/1234/12345.",
      "Use these accounts with the /api/auth/verify-stress endpoint to run stress tests.",
    ],
  });
}
