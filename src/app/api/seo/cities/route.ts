import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMinRole } from "@/lib/auth-helpers";
import { logError } from "@/lib/monitoring";

/**
 * GET /api/seo/cities
 * List active cities for the SEO city intro editor.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireMinRole("admin");
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50),
    );

    const cities = await db.city.findMany({
      where: {
        isActive: true,
        state: {
          country: { slug: "india", isActive: true },
        },
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { slug: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        state: { select: { name: true, slug: true } },
      },
    });

    return NextResponse.json({ cities, total: cities.length });
  } catch (error) {
    logError(error, { component: "route:api/seo/cities" });
    return NextResponse.json(
      { error: "Failed to fetch cities" },
      { status: 500 },
    );
  }
}
