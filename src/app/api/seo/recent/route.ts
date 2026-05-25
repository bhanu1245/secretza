import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const citySlug = searchParams.get('city');
  const categorySlug = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 20);

  const where: Record<string, unknown> = { status: 'approved' };

  if (citySlug) where.citySlug = citySlug;
  if (categorySlug) where.categorySlug = categorySlug;

  const listings = await db.listing.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      citySlug: true,
      categorySlug: true,
      updatedAt: true,
      isFeatured: true,
    },
  });

  return NextResponse.json({
    listings,
    count: listings.length,
  });
}
