// src/app/(protected)/(home)/HomeClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ConversationSidebar from '@/app/components/home/ConversationSideBar';
import VoiceControlBar from '@/app/components/home/VoiceControlBar';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import { speakWithGoogleTTSClient } from '@/services/ttsClient';

export default function HomeClient() {
  const [aiResponses, setAiResponses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false); // disable grid during TTS
  const [activeIndex, setActiveIndex] = useState<number | null>(null); // highlight selected cell

  // Speakers just label the grid; the clicked text is the user's chosen reply
  const speakers = [
    { name: 'Maya',  tone: 'friendly',     voice: 'en-US-Wavenet-F' },
    { name: 'Liam',  tone: 'confident',    voice: 'en-US-Wavenet-D' },
    { name: 'Olivia',tone: 'cheerful',     voice: 'en-US-Wavenet-C' },
    { name: 'Noah',  tone: 'calm',         voice: 'en-US-Wavenet-B' },
    { name: 'Emma',  tone: 'enthusiastic', voice: 'en-US-Wavenet-E' },
    { name: 'James', tone: 'serious',      voice: 'en-US-Wavenet-A' },
  ];

  // Drive UI solely from TTS lifecycle events
  useEffect(() => {
    const onStart = () => setIsPlaying(true);
    const onEnd = () => {
      setIsPlaying(false);
      setActiveIndex(null); // clear highlight when it's user's turn again
    };
    window.addEventListener('tts:start', onStart);
    window.addEventListener('tts:end', onEnd);
    return () => {
      window.removeEventListener('tts:start', onStart);
      window.removeEventListener('tts:end', onEnd);
    };
  }, []);

  const handleBlockClick = async (index: number) => {
    if (isPlaying) return; // ignore while already playing

    const speaker = speakers[index];
    const text = aiResponses[index] || `Fallback message from ${speaker.name}`;

    // Highlight immediately for snappy UI; unlocking happens on tts:end
    setActiveIndex(index);

    try {
      await speakWithGoogleTTSClient(
        text,
        speaker.tone,
        speaker.voice,
        speaker.name
      );
      // NOTE: Do not flip isPlaying or fire tts:end here — ttsClient handles it.
    } catch (err) {
      // Fallback: if TTS errors, emit tts:end to recover UI state
      console.error('TTS error:', err);
      window.dispatchEvent(new Event('tts:end'));
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* VoiceControlBar invokes IBM mock and pushes responses into this state */}
        <VoiceControlBar
          onResponses={(responses) => setAiResponses(responses)}
          onLoadingChange={setIsLoading}
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
            disabled={isPlaying}        // disable interactions during TTS
            activeIndex={activeIndex}    // highlight selected cell
            blocks={speakers.map((speaker, index) => ({
              label: aiResponses[index] || `Priority ${index + 1}`,
              onClick: () => handleBlockClick(index),
            }))}
          />
        )}
      </div>

      <ConversationSidebar />
    </div>
  );
}
