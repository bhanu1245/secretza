import { NextResponse } from "next/server";
import { getAnalyticsSettings } from "@/lib/analytics-settings";
import { getPublicSocialLinks } from "@/lib/social-settings";

export async function GET() {
  const [social, analytics] = await Promise.all([
    getPublicSocialLinks(),
    getAnalyticsSettings(),
  ]);
  return NextResponse.json({
    social,
    analytics: {
      gaMeasurementId: analytics.gaMeasurementId,
    },
  });
}
