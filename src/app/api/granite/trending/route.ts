// src/app/api/granite/trending/route.ts
import { NextResponse } from 'next/server';
import { getTrendingTopics } from '@/services/graniteTrendingService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === '1';
  const key = searchParams.get('key') || undefined;

  try {
    const topics = await getTrendingTopics({ force, key });
    return NextResponse.json(
      { topics },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch trending topics', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
