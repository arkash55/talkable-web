

import { getGuardianTopics, TrendingTopic } from '@/services/guardianTrendingService';
import GeneralClient from './GeneralClient';


export const dynamic = 'force-dynamic'; 

export default async function GeneralPage() {
  let topics: TrendingTopic[] = [];
  try {
    topics = await getGuardianTopics(); 
    
  } catch (err) {
    console.error('getGuardianTopics failed:', err);
    topics = [];
  }

  return <GeneralClient initialTopics={topics} />;
}
