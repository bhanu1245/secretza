import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

// Extended session user type matching our auth module augmentation
interface SessionUser {
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
}

// Get the current server session
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

// Require authentication — returns user or null
export async function requireAuth(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

// Require specific role — returns user or null
export async function requireRole(role: UserRole): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as SessionUser;
  if (user.role.toLowerCase() !== role) return null;
  return user;
}

// Require minimum role level (admin > moderator > user)
export async function requireMinRole(minRole: UserRole): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as SessionUser;
  const hierarchy: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };
  if (hierarchy[user.role.toLowerCase() as UserRole] < hierarchy[minRole]) return null;
  return user;
}

// Generate a random verification token (cryptographically secure)
export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}
