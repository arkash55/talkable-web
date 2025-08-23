'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ChatVoiceBar from '@/app/components/chat/ChatVoiceBar';
import ChatHistoryPanel from '@/app/components/chat/ChatHistoryPanel';
import VoiceGrid from '@/app/components/home/VoiceGrid';
import { useOnlineChat } from '@/app/hooks/useOnlineChat';

function formatMetaLabel(text: string, avgLogProb?: number, relativeProb?: number, tokens?: number) {
  const meta: string[] = [];
  if (typeof avgLogProb === 'number') meta.push(`logp ${avgLogProb.toFixed(2)}`);
  if (typeof relativeProb === 'number') meta.push(`rel ${(relativeProb * 100).toFixed(1)}%`);
  if (typeof tokens === 'number') meta.push(`tok ${tokens}`);
  return meta.length ? `${text}\n[${meta.join(' · ')}]` : text;
}

export default function ChatClient() {
  const { cid } = useParams<{ cid: string }>();
   const qs = useSearchParams();
  const otherUid   = qs.get('otherUid');
  const otherName  = qs.get('otherName');
  const otherEmail = qs.get('otherEmail');
  const { aiResponses, messages, sendTextMessage, regenerate } = useOnlineChat(cid ?? null);



  const blocks = aiResponses.slice(0, 6).map((c) => ({
    label: formatMetaLabel(c.text.trim(), c.avgLogProb, c.relativeProb, c.tokens),
    onClick: () => sendTextMessage(c.text),
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
