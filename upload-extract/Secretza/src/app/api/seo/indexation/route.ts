import { NextResponse } from 'next/server';
import { scoreAllPages } from '@/lib/indexation-scorer';

export async function GET() {
  try {
    const stats = await scoreAllPages();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Failed to compute indexation scores' }, { status: 500 });
  }
}
