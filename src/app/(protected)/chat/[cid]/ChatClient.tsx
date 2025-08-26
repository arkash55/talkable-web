'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ChatVoiceBar from '@/app/components/chat/ChatVoiceBar';
import ChatHistoryPanel from '@/app/components/chat/ChatHistoryPanel';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import { useOnlineChat } from '@/app/hooks/useOnlineChat';

export default function ChatClient() {
  const { cid } = useParams<{ cid: string }>();
  const qs = useSearchParams();
  const otherName  = qs.get('otherName');

  const { aiResponses, messages, sendTextMessage, regenerate } = useOnlineChat(cid ?? null);

  const blocks = aiResponses.slice(0, 6).map((c) => ({
    label: c.text.trim(),
    onClick: () => sendTextMessage(c.text),
    debug: {
      prob: c.flow?.prob ?? c.relativeProb,
      utility: c.flow?.utility,
      meanLogProb: c.avgLogProb,
      simToLastUser: c.flow?.simToLastUser,
      lengthPenalty: c.flow?.lengthPenalty,
      repetitionPenalty: c.flow?.repetitionPenalty,
      totalPenalty:
        c.flow?.totalPenalty ??
        ((c.flow?.lengthPenalty ?? 0) + (c.flow?.repetitionPenalty ?? 0)),
      weights: c.flow?.weights, // { a, b, g, tau }
    },
  }));

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ChatVoiceBar
          recipientName={otherName || ''}
          onTranscript={(finalText) => {
            // Send custom STT message
            sendTextMessage(finalText);
          }}
          silenceMs={2000}
          keepFinalMs={5000}
          showTranscript
        />

        <div style={{ flex: 1, minHeight: 0 }}>
          <VoiceGrid
            type="chatPage"
            activeConversation={blocks.length > 0}
            blocks={blocks}
            disabled={false}
            activeIndex={null}
          />
        </div>
      </div>

      {cid && <ChatHistoryPanel cid={cid} />}
    </div>
  );
}
