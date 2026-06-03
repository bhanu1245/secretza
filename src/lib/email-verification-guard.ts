import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function requireVerifiedEmail(
  userId: string,
  message: string,
): Promise<NextResponse | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!user.isVerified) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  return null;
}
