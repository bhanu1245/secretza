import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";
import { generateListingDescription, AiUnsafeOutputError } from "@/lib/ai/listing-generators";
import { isAiConfigured, AiNotConfiguredError, AiRequestError } from "@/lib/ai/client";

// POST /api/ai/listing/description — generate an advertiser listing description
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: "AI features are not enabled on this server." },
        { status: 503 },
      );
    }

    const rl = await rateLimit(`ai-seo:${session.user.id}`, { maxRequests: 30, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many AI requests. Please slow down.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) },
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await generateListingDescription({
      listingTitle: body.listingTitle,
      category: body.category,
      subcategory: body.subcategory,
      city: body.city,
      area: body.area,
      state: body.state,
      country: body.country,
      description: body.description,
      keywords: body.keywords,
    });

    return NextResponse.json({ text: result.text });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: "AI features are not enabled." }, { status: 503 });
    }
    if (error instanceof AiUnsafeOutputError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof AiRequestError) {
      return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
    }
    logError(error, { component: "route:api/ai/listing/description" });
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
  }
}
