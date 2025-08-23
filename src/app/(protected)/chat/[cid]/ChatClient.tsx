// src/app/chat/[cid]/ChatClient.tsx
'use client';

import { useParams } from 'next/navigation';
import { useOnlineChat } from '@/app/hooks/useOnlineChat';
import ChatControlBar from '@/app/components/chat/ChatVoiceBar';
import ChatResponseGrid from '@/app/components/chat/ChatResponseGrid';
import ChatHistoryPanel from '@/app/components/chat/ChatHistoryPanel';
import VoiceGrid from '@/app/components/home/VoiceGrid';

export default function ChatClient() {
  const { cid } = useParams<{ cid: string }>();
  const { transcript, listening, aiResponses, startRecording, stopRecording, sendTextMessage } =
    useOnlineChat(cid ?? null);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChatControlBar
          listening={listening}
          transcript={transcript}
          onStart={startRecording}
          onStop={stopRecording}
        />
        <VoiceGrid
          blocks={aiResponses.map((response) => ({
            label: response.text,
            onClick: () => sendTextMessage(response.text),
          }))} type={'chatPage'}        />
      </div>
      {cid && <ChatHistoryPanel cid={cid} />}
    </div>
  );
}
