import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

const SEARCH_RATE_LIMIT = { maxRequests: 30, windowSeconds: 60 };

export async function GET(request: Request) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rl = await rateLimit(`geo-search:${ip}`, SEARCH_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many search requests. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rl),
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: "Search query is too long" },
        { status: 400 }
      );
    }

    const results = await db.locality.findMany({
      where: {
        name: { contains: query },
        isActive: true,
        district: {
          city: {
            state: {
              country: { code: "IN" },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        district: {
          select: {
            name: true,
            slug: true,
            city: {
              select: {
                name: true,
                slug: true,
                state: {
                  select: { name: true, slug: true },
                },
              },
            },
          },
        },
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      {
        results: results.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          district: { name: r.district.name, slug: r.district.slug },
          city: { name: r.district.city.name, slug: r.district.city.slug },
          state: { name: r.district.city.state.name, slug: r.district.city.state.slug },
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          ...getRateLimitHeaders(rl),
        },
      }
    );
  } catch (error) {
    logError(error, { component: "route:api/geo/india/search" });
    return NextResponse.json(
      { error: "Failed to search localities" },
      { status: 500 }
    );
  }
}
