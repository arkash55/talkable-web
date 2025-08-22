// src/app/hooks/useOnlineChat.ts
'use client';

import { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

import { getCandidates, type Candidate, type GenerateResponse } from '@/services/graniteClient';
import { sendMessage, onMessages } from '@/services/firestoreService';
import { getAuth } from 'firebase/auth';

type UseOnlineChatResult = {
  transcript: string;
  listening: boolean;
  aiResponses: Candidate[];
  startRecording: () => void;
  stopRecording: () => void;
  sendTextMessage: (text: string) => Promise<void>;
};

export function useOnlineChat(cid: string | null): UseOnlineChatResult {
  const [listening, setListening] = useState(false);
  const [aiResponses, setAiResponses] = useState<Candidate[]>([]);
  const [transcript, setTranscript] = useState('');

  const { transcript: liveTranscript, resetTranscript } = useSpeechRecognition();
  const processingRef = useRef(false);

  // Handle transcript updates
  useEffect(() => {
    if (!listening) return;
    setTranscript(liveTranscript);
  }, [liveTranscript, listening]);

  const startRecording = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
    setListening(true);
    window.dispatchEvent(new Event('onlinechat:record:start'));
  };

  const stopRecording = async () => {
    SpeechRecognition.stopListening();
    setListening(false);
    window.dispatchEvent(new Event('onlinechat:record:end'));

    if (liveTranscript.trim() && cid) {
      await sendTextMessage(liveTranscript.trim());
    }
    resetTranscript();
    setTranscript('');
  };

  const sendTextMessage = async (text: string) => {
    if (!cid || !text.trim()) return;

    const uid = getAuth().currentUser?.uid ?? 'guest';
    await sendMessage({ cid, senderId: uid, text });

    // After sending → generate AI responses
    try {
      processingRef.current = true;
      const resp: GenerateResponse = await getCandidates(text, 'You are an online chat AI.', []);
      setAiResponses(resp.candidates);

      window.dispatchEvent(new CustomEvent('onlinechat:responses', { detail: resp }));
    } catch (err) {
      console.error('Failed to fetch AI responses:', err);
    } finally {
      processingRef.current = false;
    }
  };

  // Listen for other-user messages → generate new responses
  useEffect(() => {
    if (!cid) return;
    const unsub = onMessages(cid, async (msgs) => {
      if (!msgs.length) return;
      const last = msgs[msgs.length - 1];
      if (last.senderId === getAuth().currentUser?.uid) return; // only react to others

      try {
        const resp: GenerateResponse = await getCandidates(last.text, 'You are an online chat AI.', []);
        setAiResponses(resp.candidates);

        window.dispatchEvent(new CustomEvent('onlinechat:responses', { detail: resp }));
      } catch (err) {
        console.error('Error generating responses to peer:', err);
      }
    });
    return () => unsub();
  }, [cid]);

  return {
    transcript,
    listening,
    aiResponses,
    startRecording,
    stopRecording,
    sendTextMessage,
  };
}
