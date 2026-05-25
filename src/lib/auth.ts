import type { NextAuthOptions, User as NextAuthUser, Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sendLoginAlert } from "@/lib/email";
import { rateLimit, RATE_LIMITS, getClientIp, recordFailure, clearFailures } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Short-lived cache for user suspension/role checks in JWT callback
// Avoids a DB query on every single API request while still catching
// suspension within 2 minutes (vs. the old 1-hour interval).
// ---------------------------------------------------------------------------
const userStatusCache = new Map<string, { data: { role: string; isVerified: boolean; isSuspended: boolean; isPremium: boolean; premiumExpiry: Date | null; sessionVersion: number }; ts: number }>();
const USER_STATUS_TTL = 2 * 60 * 1000; // 2 minutes

function getCachedUserStatus(userId: string) {
  const entry = userStatusCache.get(userId);
  if (entry && Date.now() - entry.ts < USER_STATUS_TTL) return entry.data;
  userStatusCache.delete(userId);
  return null;
}

function setCachedUserStatus(userId: string, data: { role: string; isVerified: boolean; isSuspended: boolean; isPremium: boolean; premiumExpiry: Date | null; sessionVersion: number }) {
  userStatusCache.set(userId, { data, ts: Date.now() });
}

// Extend NextAuth types to include our custom fields
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      isVerified: boolean;
      isSuspended: boolean;
      isPremium: boolean;
      premiumExpiry?: Date | null;
      provider: string;
      sessionVersion?: number;
    };
  }

  interface User extends NextAuthUser {
    role?: string;
    isVerified?: boolean;
    isSuspended?: boolean;
    isPremium?: boolean;
    premiumExpiry?: Date | null;
    provider?: string;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isVerified?: boolean;
    isSuspended?: boolean;
    isPremium?: boolean;
    premiumExpiry?: Date | null;
    provider?: string;
    sessionVersion?: number;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    // Default max age: 30 days
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // Rate limiting
        let ip = "unknown";
        const headers = req?.headers;
        if (headers) {
          if (typeof headers.get === "function") {
            ip = (headers.get("x-forwarded-for")?.split(",")[0]?.trim()) || (headers.get("x-real-ip")?.trim()) || "unknown";
          } else if (typeof headers === "object") {
            const fwd = headers["x-forwarded-for"];
            const rip = headers["x-real-ip"];
            if (typeof fwd === "string") ip = fwd.split(",")[0].trim();
            else if (Array.isArray(fwd)) ip = fwd[0].trim();
            else if (typeof rip === "string") ip = rip.trim();
          }
        }
        const rl = await rateLimit(`login:${ip}`, RATE_LIMITS.login);
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          recordFailure(ip);
          throw new Error("Invalid email or password");
        }

        if (user.isSuspended) {
          throw new Error("This account has been suspended");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          recordFailure(ip);
          throw new Error("Invalid email or password");
        }

        // Clear failure tracking on successful login
        clearFailures(ip);

        // Update lastLoginAt
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Send login alert email (fire-and-forget, don't block auth)
        try {
          let ip = "unknown";
          // Next.js 16 proxy may pass headers as a plain object or Web Headers
          const headers = req?.headers;
          if (headers) {
            if (typeof headers.get === "function") {
              ip = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "unknown";
            } else if (typeof headers === "object") {
              ip = headers["x-forwarded-for"] || headers["x-real-ip"] || "unknown";
            }
          }
          sendLoginAlert(user.email, user.name || "User", ip).catch(() => {});
        } catch {
          // Silently fail — login alert should not block authentication
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isVerified: user.isVerified,
          isSuspended: user.isSuspended,
          isPremium: user.isPremium,
          premiumExpiry: user.premiumExpiry,
          provider: user.provider,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // On first sign in, add user fields to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isVerified = user.isVerified;
        token.isSuspended = user.isSuspended;
        token.isPremium = user.isPremium;
        token.premiumExpiry = user.premiumExpiry;
        token.provider = user.provider;
        token.sessionVersion = user.sessionVersion;
      }

      // If this is an OAuth account (e.g., Google), update user image
      if (account && user?.id) {
        if (account.provider === "google" && account.picture) {
          await db.user.update({
            where: { id: user.id },
            data: { image: account.picture },
          });
          token.picture = account.picture;
        }
      }

      // Handle session update (e.g., when user updates profile)
      if (trigger === "update" && session) {
        // Refresh user data from DB on session update
        const dbUser = await db.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            isVerified: true,
            isSuspended: true,
            isPremium: true,
            premiumExpiry: true,
            sessionVersion: true,
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isVerified = dbUser.isVerified;
          token.isSuspended = dbUser.isSuspended;
          token.isPremium = dbUser.isPremium;
          token.premiumExpiry = dbUser.premiumExpiry;
          token.sessionVersion = dbUser.sessionVersion;
        }
      }

      // Real-time suspension/role check with 2-minute cache.
      // This replaces the old hourly periodic refresh to ensure suspended users
      // are locked out within 2 minutes instead of 1 hour.
      if (token.id) {
        const cached = getCachedUserStatus(token.id);
        if (cached) {
          // Use cached data to update token
          token.role = cached.role;
          token.isVerified = cached.isVerified;
          token.isPremium = cached.isPremium;
          token.premiumExpiry = cached.premiumExpiry;
          token.isSuspended = cached.isSuspended;

          if (token.sessionVersion !== undefined && cached.sessionVersion !== token.sessionVersion) {
            token.id = undefined;
            token.role = undefined;
            token.isVerified = undefined;
            token.isSuspended = undefined;
            token.isPremium = undefined;
            token.premiumExpiry = undefined;
            token.provider = undefined;
            token.sessionVersion = undefined;
          } else {
            token.sessionVersion = cached.sessionVersion;
          }
        } else {
          // Cache miss — query DB
          const suspensionCheck = await db.user.findUnique({
            where: { id: token.id },
            select: {
              role: true,
              isVerified: true,
              isSuspended: true,
              isPremium: true,
              premiumExpiry: true,
              sessionVersion: true,
            },
          });
          if (suspensionCheck) {
            setCachedUserStatus(token.id, suspensionCheck);
            token.role = suspensionCheck.role;
            token.isVerified = suspensionCheck.isVerified;
            token.isPremium = suspensionCheck.isPremium;
            token.premiumExpiry = suspensionCheck.premiumExpiry;
            token.isSuspended = suspensionCheck.isSuspended;

            if (token.sessionVersion !== undefined && suspensionCheck.sessionVersion !== token.sessionVersion) {
              token.id = undefined;
              token.role = undefined;
              token.isVerified = undefined;
              token.isSuspended = undefined;
              token.isPremium = undefined;
              token.premiumExpiry = undefined;
              token.provider = undefined;
              token.sessionVersion = undefined;
            } else {
              token.sessionVersion = suspensionCheck.sessionVersion;
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id || "";
        session.user.role = token.role || "user";
        session.user.isVerified = token.isVerified || false;
        session.user.isSuspended = token.isSuspended || false;
        session.user.isPremium = token.isPremium || false;
        session.user.premiumExpiry = token.premiumExpiry || null;
        session.user.provider = token.provider || "email";
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Check if user is suspended before allowing sign in
      if (user?.id) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser?.isSuspended) {
          throw new Error("This account has been suspended");
        }

        // Update lastLoginAt for OAuth sign-ins
        if (account?.provider && account.provider !== "credentials") {
          await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }).catch(() => {});
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/api/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
