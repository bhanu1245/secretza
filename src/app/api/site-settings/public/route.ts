import { NextResponse } from "next/server";
import { getPublicSocialLinks } from "@/lib/social-settings";

export async function GET() {
  const social = await getPublicSocialLinks();
  return NextResponse.json({ social });
}
