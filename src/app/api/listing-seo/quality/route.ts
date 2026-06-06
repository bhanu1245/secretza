import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/monitoring";
import { computeListingQuality } from "@/lib/listing-seo/listing-quality";
import { getCachedListingPeers } from "@/lib/listing-seo/listing-peer-cache";

// POST /api/listing-seo/quality
// Listing SEO V5 Lite score. Uniqueness uses sibling listings (same category +
// city) when categorySlug/citySlug are provided.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const peers = await getCachedListingPeers(
      typeof body.categorySlug === "string" ? body.categorySlug : null,
      typeof body.citySlug === "string" ? body.citySlug : null,
      typeof body.id === "string" ? body.id : null,
    );

    const result = computeListingQuality({
      title: body.title,
      description: body.description,
      keywords: body.keywords,
      imageCount: Number.isFinite(body.imageCount) ? Number(body.imageCount) : 0,
      city: body.city,
      area: body.area,
      state: body.state,
      contacts: {
        phone: body.contactPhone,
        whatsapp: body.whatsapp,
        telegram: body.telegram,
        email: body.contactEmail,
      },
      peers: peers.map((p) => ({ title: p.title, description: p.description })),
    });

    return NextResponse.json({ result });
  } catch (error) {
    logError(error, { component: "route:api/listing-seo/quality" });
    return NextResponse.json({ error: "Failed to score listing" }, { status: 500 });
  }
}
