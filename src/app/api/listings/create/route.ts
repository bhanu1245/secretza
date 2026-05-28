import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const listingSchema = z.object({
  title: z.string().trim().min(5).max(120),
  slug: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().min(20).max(5000),
  age: z.coerce.number().int().min(18).max(99).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  telegram: z.string().trim().max(100).optional().nullable(),
  categorySlug: z.string().trim().min(1),
  subcategorySlug: z.string().trim().optional().nullable(),
  countrySlug: z.string().trim().min(1),
  stateSlug: z.string().trim().optional().nullable(),
  citySlug: z.string().trim().min(1),
  area: z.string().trim().max(120).optional().nullable(),
  areaId: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  services: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  price: z.coerce.number().min(0).max(99999999),
  currency: z.string().trim().length(3).default("USD"),
  profileImage: z.string().trim().optional().nullable(),
  galleryImages: z.array(z.string().trim().url().or(z.string().trim().startsWith("/"))).max(20).default([]),
  uploadResults: z.array(z.record(z.string(), z.unknown())).max(20).default([]),
});

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

    const parsed = listingSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid listing data" },
        { status: 400 },
      );
    }

    const body = parsed.data;

    const [category, subcategory, country] = await Promise.all([
      db.category.findFirst({ where: { slug: body.categorySlug, isActive: true } }),
      body.subcategorySlug
        ? db.category.findFirst({
            where: {
              slug: body.subcategorySlug,
              isActive: true,
              parent: { slug: body.categorySlug },
            },
          })
        : Promise.resolve(null),
      db.country.findFirst({ where: { slug: body.countrySlug, isActive: true } }),
    ]);

    if (!category || !country) {
      return NextResponse.json(
        { error: "Invalid category or country" },
        { status: 400 },
      );
    }

    const state = body.stateSlug
      ? await db.state.findFirst({
          where: { slug: body.stateSlug, countryId: country.id, isActive: true },
        })
      : null;

    const city = await db.city.findFirst({
      where: {
        slug: body.citySlug,
        isActive: true,
        state: {
          countryId: country.id,
          ...(state ? { id: state.id } : {}),
        },
      },
      include: {
        state: true,
      },
    });

    if (!city) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }

    const areaRecord = body.areaId
      ? await db.area.findFirst({
          where: { id: body.areaId, cityId: city.id, isActive: true },
        })
      : null;

    const galleryImages = body.galleryImages.length
      ? body.galleryImages
      : body.uploadResults
          .map((img) => String(img.url || ""))
          .filter(Boolean);
    const profileImage = body.profileImage || galleryImages[0] || null;

    const listing = await db.listing.create({
      data: {
        title: body.title,
        description: body.description,
        price: body.price.toString(),
        slug: body.slug ? makeSlug(body.slug) : makeSlug(body.title),
        categorySlug: category.slug,
        subcategorySlug: subcategory?.slug ?? null,
        countrySlug: country.slug,
        stateSlug: city.state.slug,
        citySlug: city.slug,
        area: areaRecord?.name || body.area || null,
        tags: JSON.stringify(body.tags),
        services: JSON.stringify(body.services),
        currency: body.currency.toUpperCase(),
        whatsapp: body.whatsapp || null,
        contactTelegram: body.telegram || null,
        telegram: body.telegram || null,
        age: body.age ?? null,
        profileImage,
        galleryImages: JSON.stringify(galleryImages),
        images: JSON.stringify(galleryImages.map((url, index) => ({ url, isPrimary: index === 0 }))),
        status: "pending",
        lastBumpedAt: new Date(),
        priorityScore: 35,
        categoryId: category.id,
        subcategoryId: subcategory?.id ?? null,
        countryId: country.id,
        stateId: city.state.id,
        cityId: city.id,
        areaId: areaRecord?.id ?? null,
        userId: user.id,
      } as any,
    });

    if (body.uploadResults.length > 0) {
      await db.listingImage.createMany({
        data: body.uploadResults.map((img, index) => ({
          listingId: listing.id,
          url: String(img.url || ""),
          thumbnailUrl: String(img.url || ""),
          mediumUrl: String(img.url || ""),
          storageKey: String(img.storageKey || img.key || `listings/${listing.id}/${index}`),
          mimeType: String(img.mimeType || "image/jpeg"),
          width: Number(img.width || 0),
          height: Number(img.height || 0),
          sizeBytes: Number(img.sizeBytes || 0),
          sortOrder: index,
          moderationStatus: "pending",
        })),
      });
    }

    console.log("[CreateListing] persisted listing images", {
      listingId: listing.id,
      imageCount: body.uploadResults.length,
      galleryImageCount: galleryImages.length,
    });

    console.log("[CreateListing] saved listing", {
      id: listing.id,
      userId: listing.userId,
    });

    return NextResponse.json(
      {
        listing: {
          id: listing.id,
          slug: listing.slug,
          status: listing.status,
          userId: listing.userId,
        },
      },
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