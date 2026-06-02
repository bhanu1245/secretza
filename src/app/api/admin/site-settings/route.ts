import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSocialSettings,
  saveSocialSettings,
  type SocialLinks,
} from "@/lib/social-settings";
import {
  getAnalyticsSettings,
  saveAnalyticsSettings,
  type AnalyticsSettings,
} from "@/lib/analytics-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [social, analytics] = await Promise.all([
    getSocialSettings(),
    getAnalyticsSettings(),
  ]);
  return NextResponse.json({ social, analytics });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const socialInput = body?.social as Partial<SocialLinks> | undefined;
    const analyticsInput = body?.analytics as Partial<AnalyticsSettings> | undefined;
    if (
      (!socialInput || typeof socialInput !== "object") &&
      (!analyticsInput || typeof analyticsInput !== "object")
    ) {
      return NextResponse.json(
        { error: "social or analytics object required" },
        { status: 400 },
      );
    }

    const [social, analytics] = await Promise.all([
      socialInput ? saveSocialSettings(socialInput) : getSocialSettings(),
      analyticsInput ? saveAnalyticsSettings(analyticsInput) : getAnalyticsSettings(),
    ]);
    return NextResponse.json({ social, analytics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
