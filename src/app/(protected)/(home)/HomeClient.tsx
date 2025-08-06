'use client';

import ConversationSidebar from '@/app/components/home/ConversationSideBar';
import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';

import { useState } from 'react';


export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<string[]>([]);

  // Define speaker names and matching voices
  const speakers = [
    { name: 'Maya', voice: 'en-US-Wavenet-C', tone: 'excited' },  // US Female
    { name: 'Liam', voice: 'en-US-Wavenet-D', tone: 'calm' },     // US Male
    { name: 'Olivia', voice: 'en-GB-Wavenet-A', tone: 'slow' },   // UK Female
    { name: 'Noah', voice: 'en-GB-Wavenet-B', tone: 'fast' },     // UK Male
    { name: 'Emma', voice: 'en-US-Wavenet-F', tone: 'calm' },     // US Female
    { name: 'James', voice: 'en-AU-Wavenet-B', tone: 'calm' },    // Australian Male
  ];

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <VoiceControlBar onResponses={setAiResponses} />

        <VoiceGrid
          blocks={speakers.map((speaker, index) => ({
            label: aiResponses[index] || `Priority ${index + 1}`,
            onClick: () =>
              speakWithGoogleTTSClient(
                aiResponses[index] || `This is ${speaker.name}'s fallback message`,
                speaker.tone,
                speaker.voice,
                speaker.name
              ),
          }))}
        />
      </div>

      <ConversationSidebar />
    </div>
  );
}
