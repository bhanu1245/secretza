import { NextRequest, NextResponse } from 'next/server';
import { generateTrendingSearches, generatePopularSearches } from '@/lib/seo-content';
import { getCityBySlug, isCategorySlug } from '@/lib/seo-resolver';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const citySlug = searchParams.get('city');
  const categorySlug = searchParams.get('category');
  const type = searchParams.get('type') ?? 'trending'; // trending | popular

  // Validate city if provided
  if (citySlug && !getCityBySlug(citySlug)) {
    return NextResponse.json({ error: 'Invalid city slug' }, { status: 400 });
  }

  // Validate category if provided
  if (categorySlug && !isCategorySlug(categorySlug)) {
    return NextResponse.json({ error: 'Invalid category slug' }, { status: 400 });
  }

  if (type === 'popular') {
    return NextResponse.json({
      type: 'popular',
      searches: generatePopularSearches(),
    });
  }

  if (!citySlug) {
    return NextResponse.json({ error: 'city parameter required for trending searches' }, { status: 400 });
  }

  return NextResponse.json({
    type: 'trending',
    city: citySlug,
    category: categorySlug ?? undefined,
    searches: generateTrendingSearches(citySlug, categorySlug ?? undefined),
  });
}
