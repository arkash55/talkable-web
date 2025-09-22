
import { NextResponse } from 'next/server';
import { getGuardianTopics, type GuardianGetOpts } from '@/services/guardianTrendingService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const force = searchParams.get('force') === '1';
  const limit = (() => {
    const n = Number(searchParams.get('limit') || '6');
    return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 6;
  })();

  const key = searchParams.get('key') || undefined;

  const variant = (searchParams.get('variant') as GuardianGetOpts['variant']) || 'newest';
  const seed = (() => {
    const s = Number(searchParams.get('seed') || '');
    return Number.isFinite(s) ? s : undefined;
  })();
  const page = (() => {
    const p = Number(searchParams.get('page') || '');
    return Number.isFinite(p) && p > 0 ? p : undefined;
  })();
  const days = (() => {
    const d = Number(searchParams.get('days') || '');
    return Number.isFinite(d) && d > 0 ? d : undefined;
  })();
  const sections = searchParams.get('sections') || undefined; 

  try {
    const topics = await getGuardianTopics(limit, {
      force,
      key,
      variant,
      seed,
      page,
      days,
      sections,
    });

    return NextResponse.json(
      { topics },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch Guardian topics', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
