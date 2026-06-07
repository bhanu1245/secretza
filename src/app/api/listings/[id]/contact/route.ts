import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeListingContact } from "@/lib/listing-contact";
import {
  getRevealCounts,
  isRevealRateLimited,
  logContactReveal,
} from "@/lib/contact-reveal";
import { getClientIp } from "@/lib/rate-limit";
import { logError } from "@/lib/monitoring";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isVerified: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const listing = await db.listing.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        whatsapp: true,
        telegram: true,
        contactTelegram: true,
        contactEmail: true,
        contactText: true,
        contactInstagram: true,
        contactWebsite: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const role = String(user.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "moderator";
    const isOwner = listing.userId === session.user.id;

    if (!user.isVerified && !isStaff && !isOwner) {
      return NextResponse.json(
        { error: "Email verification required to access contact information" },
        { status: 403 },
      );
    }

    if (!isOwner && !isStaff && listing.status !== "approved") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const revealCounts = await getRevealCounts(session.user.id);
    if (isRevealRateLimited(revealCounts)) {
      return NextResponse.json({ error: "Reveal limit reached" }, { status: 429 });
    }

    await logContactReveal({
      listingId: listing.id,
      userId: session.user.id,
      role,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(serializeListingContact(listing));
  } catch (error) {
    logError(error, { component: "route:api/listings/[id]/contact" });
    return NextResponse.json(
      { error: "Failed to fetch contact information" },
      { status: 500 },
    );
  }
}
