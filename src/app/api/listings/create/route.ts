import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function makeSlug(title: string) {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "listing";

  return `${base}-${Date.now()}`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isSuspended: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (user.isSuspended) {
      return NextResponse.json(
        { error: "Account suspended" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const price = Number(body.price);

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "Price must be a valid non-negative number" },
        { status: 400 },
      );
    }

    const [category, city] = await Promise.all([
      db.category.findFirst({
        where: {
          isActive: true,
          OR: [{ slug: "escorts" }, { slug: "adult-services" }],
        },
        orderBy: { order: "asc" },
      }),
      db.city.findFirst({
        where: {
          isActive: true,
          state: {
            isActive: true,
            country: {
              isActive: true,
            },
          },
        },
        include: {
          state: {
            include: {
              country: true,
            },
          },
        },
        orderBy: [{ isFeatured: "desc" }, { listingCount: "desc" }],
      }),
    ]);

    const resolvedCategory =
      category ??
      (await db.category.findFirst({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }));

    if (!resolvedCategory || !city?.state?.country) {
      return NextResponse.json(
        { error: "Listing category or location data is not configured" },
        { status: 500 },
      );
    }

    const listing = await db.listing.create({
      data: {
        title,
        description,
        price: price.toString(),
        slug: makeSlug(title),
        categorySlug: resolvedCategory.slug,
        countrySlug: city.state.country.slug,
        stateSlug: city.state.slug,
        citySlug: city.slug,
        tags: "[]",
        currency: "USD",
        images: "[]",
        status: "pending",
        lastBumpedAt: new Date(),
        priorityScore: 35,
        categoryId: resolvedCategory.id,
        countryId: city.state.country.id,
        stateId: city.state.id,
        cityId: city.id,
        userId: user.id,
      },
    });

    return NextResponse.json(
      { listing: { id: listing.id, slug: listing.slug, status: listing.status } },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 },
    );
  }
}