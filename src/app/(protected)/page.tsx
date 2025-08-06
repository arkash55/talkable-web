'use client';
import VoiceGrid from '../components/home/VoiceGrid';

export default function HomePage() {
  return (
<div style={{ height: '100vh', width: '100vw' }}>
      <VoiceGrid
        topLeft={{
          label: '🎤 Tap to Speak',
          onClick: () => alert('Start voice input...'),
        }}
        blocks={[
          { label: 'Option 1', onClick: () => alert('Option 1 selected') },
          { label: 'Option 2', onClick: () => alert('Option 2 selected') },
          { label: 'Option 3', onClick: () => alert('Option 3 selected') },
          { label: 'Option 4', onClick: () => alert('Option 4 selected') },
          { label: 'Option 5', onClick: () => alert('Option 5 selected') },
        ]}
      />
    </div>
  );
}
