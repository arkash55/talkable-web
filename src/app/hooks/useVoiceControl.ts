import { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { getResponsesFromAI } from '@/app/actions/getResponseFromAI';

export function useVoiceControl(onResponses: (responses: string[]) => void) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hasSound, setHasSound] = useState(false);
  const [hasSoundLeeway, setHasSoundLeeway] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const leewayTimeout = useRef<NodeJS.Timeout | null>(null);

  const {
    transcript,
    resetTranscript,
    listening: browserListening,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // TTS event handling
  useEffect(() => {
    const start = () => setSpeaking(true);
    const end = () => setSpeaking(false);
    window.addEventListener('tts:start', start);
    window.addEventListener('tts:end', end);
    return () => {
      window.removeEventListener('tts:start', start);
      window.removeEventListener('tts:end', end);
    };
  }, []);

  // Handle delayed volume drop
  useEffect(() => {
    if (hasSound) {
      clearTimeout(leewayTimeout.current!);
      setHasSoundLeeway(true);
    } else {
      leewayTimeout.current = setTimeout(() => setHasSoundLeeway(false), 1000);
    }
    return () => clearTimeout(leewayTimeout.current!);
  }, [hasSound]);

  const toggleListening = async () => {
    if (!browserSupportsSpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }

    if (!listening) {
      setListening(true);
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateLevels = () => {
        analyserRef.current!.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setHasSound(avg > 30);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();
    } else {
      setListening(false);
      SpeechRecognition.stopListening();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      setHasSound(false);

      const final = transcript.trim();
      if (final) {
        // const responses = await getResponsesFromAI(final);
        // onResponses(responses);
        console.log('Final transcript to send to granite:', final);
      }
    }
  };

  return {
    transcript,
    listening,
    speaking,
    hasSoundLeeway,
    toggleListening,
  };
}
