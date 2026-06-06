import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";
import { improveContent, AiUnsafeOutputError } from "@/lib/ai/seo-generators";
import { isAiConfigured, AiNotConfiguredError, AiRequestError } from "@/lib/ai/client";

const MAX_INPUT = 4000;

// POST /api/ai/seo/improve — improve grammar/readability of supplied copy
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
    const content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (content.length > MAX_INPUT) {
      return NextResponse.json(
        { error: `content must be at most ${MAX_INPUT} characters` },
        { status: 400 },
      );
    }

    const result = await improveContent(content);
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
    logError(error, { component: "route:api/ai/seo/improve" });
    return NextResponse.json({ error: "Failed to improve content" }, { status: 500 });
  }
}
