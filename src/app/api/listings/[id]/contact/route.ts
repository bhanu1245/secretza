import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeListingContact } from "@/lib/listing-contact";
import { logError } from "@/lib/monitoring";

export async function GET(
  _request: Request,
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

    const role = String(user.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "moderator";
    if (!user.isVerified && !isStaff) {
      return NextResponse.json(
        { error: "Email verification required to access contact information" },
        { status: 403 },
      );
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

    const isOwner = listing.userId === session.user.id;
    if (!isOwner && !isStaff && listing.status !== "approved") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json(serializeListingContact(listing));
  } catch (error) {
    logError(error, { component: "route:api/listings/[id]/contact" });
    return NextResponse.json(
      { error: "Failed to fetch contact information" },
      { status: 500 },
    );
  }
}
