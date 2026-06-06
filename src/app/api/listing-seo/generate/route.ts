import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";
import {
  generateListingContent,
  type ListingSeoAction,
} from "@/lib/listing-seo/listing-seo-engine";
import type { ListingSeoInput } from "@/lib/listing-seo/listing-seo-content";

const ACTIONS: ListingSeoAction[] = ["title", "description", "improve"];
const MAX_INPUT = 4000;

// POST /api/listing-seo/generate
// Deterministic listing copy (Listing SEO V5 Lite). Optional AI enhancement via
// `enhance: true` — AI never required; failures fall back to the draft.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rl = await rateLimit(`ai-seo:${session.user.id}`, { maxRequests: 30, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down.", resetAt: rl.resetAt },
        { status: 429, headers: getRateLimitHeaders(rl) },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as ListingSeoAction;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: "action must be one of: title, description, improve" },
        { status: 400 },
      );
    }

    const currentContent = typeof body.currentContent === "string" ? body.currentContent : "";
    if (currentContent.length > MAX_INPUT) {
      return NextResponse.json(
        { error: `currentContent must be at most ${MAX_INPUT} characters` },
        { status: 400 },
      );
    }

    const input: ListingSeoInput = {
      id: body.id,
      slug: body.slug,
      title: body.title,
      description: body.description,
      category: body.category,
      subcategory: body.subcategory,
      city: body.city,
      area: body.area,
      state: body.state,
      country: body.country,
      keywords: body.keywords,
      services: body.services,
      tags: body.tags,
    };

    const result = await generateListingContent(action, input, {
      enhance: body.enhance === true,
      currentContent,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError(error, { component: "route:api/listing-seo/generate" });
    return NextResponse.json({ error: "Failed to generate listing content" }, { status: 500 });
  }
}
