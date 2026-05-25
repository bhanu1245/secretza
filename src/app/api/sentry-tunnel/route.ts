import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Extract DSN from the envelope header to get project_id and host
    const envelopeHeader = body.split("\n")[0];
    const dsnMatch = envelopeHeader.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!dsnMatch) {
      return NextResponse.json({ error: "Invalid envelope" }, { status: 400 });
    }

    const projectId = dsnMatch[3];
    const sentryHost = dsnMatch[2];

    const sentryUrl = `https://${sentryHost}/api/${projectId}/envelope/`;

    const response = await fetch(sentryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
      body,
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Sentry rejected envelope" }, { status: 502 });
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
