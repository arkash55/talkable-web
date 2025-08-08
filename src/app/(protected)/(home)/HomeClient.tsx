// src/app/(protected)/(home)/HomeClient.tsx
'use client';

import { useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ConversationSidebar from '@/app/components/home/ConversationSideBar';
import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Speakers just label the grid; the clicked text is the user's chosen reply
  const speakers = [
    { name: 'Maya',  tone: 'friendly',     voice: 'en-US-Wavenet-F' },
    { name: 'Liam',  tone: 'confident',    voice: 'en-US-Wavenet-D' },
    { name: 'Olivia',tone: 'cheerful',     voice: 'en-US-Wavenet-C' },
    { name: 'Noah',  tone: 'calm',         voice: 'en-US-Wavenet-B' },
    { name: 'Emma',  tone: 'enthusiastic', voice: 'en-US-Wavenet-E' },
    { name: 'James', tone: 'serious',      voice: 'en-US-Wavenet-A' },
  ];

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* VoiceControlBar invokes IBM mock and pushes responses into this state */}
        <VoiceControlBar
          onResponses={(responses) => setAiResponses(responses)}
          onLoadingChange={setIsLoading} // <-- NEW
        />

        {/* While generating, show a spinner instead of VoiceGrid */}
        {isLoading ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Generating responses…
            </Typography>
          </Box>
        ) : (
          <VoiceGrid
            blocks={speakers.map((speaker, index) => ({
              label: aiResponses[index] || `Priority ${index + 1}`,
              onClick: () => {
                const text = aiResponses[index] || `Fallback message from ${speaker.name}`;
                speakWithGoogleTTSClient(
                  text,
                  speaker.tone,
                  speaker.voice,
                  speaker.name
                );
              },
            }))}
          />
        )}
      </div>

      <ConversationSidebar />
    </div>
  );
}
