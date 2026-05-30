import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  DEFAULT_SOCIAL_URLS,
  SOCIAL_SETTING_KEYS,
} from "@/lib/footer-routes";

export async function GET() {
  const keys = Object.values(SOCIAL_SETTING_KEYS);
  const rows = await db.siteSettings.findMany({
    where: { key: { in: keys } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return NextResponse.json({
    social: {
      twitter: map.get(SOCIAL_SETTING_KEYS.twitter) || DEFAULT_SOCIAL_URLS.twitter,
      instagram: map.get(SOCIAL_SETTING_KEYS.instagram) || DEFAULT_SOCIAL_URLS.instagram,
      youtube: map.get(SOCIAL_SETTING_KEYS.youtube) || DEFAULT_SOCIAL_URLS.youtube,
      website: map.get(SOCIAL_SETTING_KEYS.website) || DEFAULT_SOCIAL_URLS.website,
    },
  });
}
