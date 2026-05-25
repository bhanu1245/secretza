import { NextRequest, NextResponse } from 'next/server';
import { requireMinRole } from '@/lib/auth-helpers';
import { getCrawlStats } from '@/lib/crawl-analytics';

export async function GET(request: NextRequest) {
  try {
    await requireMinRole('admin');

    const { searchParams } = request.nextUrl;
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);

    const stats = await getCrawlStats(days);

    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch crawl stats';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
