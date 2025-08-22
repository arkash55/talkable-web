

import { getGuardianTopics, TrendingTopic } from '@/services/guardianTrendingService';
import GeneralClient from './GeneralClient';
// import { getTrendingTopics, type TrendingTopic } from '@/services/graniteTrendingService';

export const dynamic = 'force-dynamic'; // ensure this page isn’t statically cached

export default async function GeneralPage() {
  let topics: TrendingTopic[] = [];
  try {
    topics = await getGuardianTopics(); // server-side fetch (secrets stay server-only)
    // console.log('Trending topics fetched:', topics);
  } catch (err) {
    console.error('getGuardianTopics failed:', err);
    topics = [];
  }

  return <GeneralClient initialTopics={topics} />;
}
