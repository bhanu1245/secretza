import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSocialSettings,
  saveSocialSettings,
  type SocialLinks,
} from "@/lib/social-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const social = await getSocialSettings();
  return NextResponse.json({ social });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const socialInput = body?.social as Partial<SocialLinks> | undefined;
    if (!socialInput || typeof socialInput !== "object") {
      return NextResponse.json({ error: "social object required" }, { status: 400 });
    }

    const social = await saveSocialSettings(socialInput);
    return NextResponse.json({ social });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
