import { NextResponse } from 'next/server';
import { scoreAllPages } from '@/lib/indexation-scorer';
import { requireMinRole } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const admin = await requireMinRole('admin');
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await scoreAllPages();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    return NextResponse.json({ error: 'Failed to compute indexation scores' }, { status: 500 });
  }
}
