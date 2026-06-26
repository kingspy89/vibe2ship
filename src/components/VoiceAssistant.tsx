import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Audio format conversions
function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // little-endian
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToPcm(base64: string): Float32Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const buffer = bytes.buffer;
  const view = new DataView(buffer);
  const pcmData = new Float32Array(len / 2);
  for (let i = 0; i < len / 2; i++) {
    pcmData[i] = view.getInt16(i * 2, true) / 32768; // little-endian
  }
  return pcmData;
}

export function VoiceAssistant() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startLiveSession = async () => {
    setIsConnecting(true);
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsActive(true);
        setIsConnecting(false);

        const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
        const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
        inputAudioCtxRef.current = inputAudioCtx;
        outputAudioCtxRef.current = outputAudioCtx;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        
        const source = inputAudioCtx.createMediaStreamSource(stream);
        const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(inputAudioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.audio && outputAudioCtxRef.current) {
            playAudioChunk(outputAudioCtxRef.current, msg.audio);
          }
          if (msg.interrupted) {
            nextStartTimeRef.current = 0; // stop playback and reset
          }
        };
      };

      ws.onclose = () => {
        stopLiveSession();
      };
      
      ws.onerror = (err) => {
        console.error("Live API WS Error:", err);
        stopLiveSession();
      }

    } catch (e) {
      console.error("Failed to start voice assistant", e);
      stopLiveSession();
    }
  };

  const playAudioChunk = (ctx: AudioContext, base64Audio: string) => {
    const pcmData = base64ToPcm(base64Audio);
    const buffer = ctx.createBuffer(1, pcmData.length, 24000);
    buffer.getChannelData(0).set(pcmData);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    if (nextStartTimeRef.current < ctx.currentTime) {
      nextStartTimeRef.current = ctx.currentTime;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };

  const stopLiveSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
    nextStartTimeRef.current = 0;
  };

  const toggleAssistant = () => {
    if (isActive) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  };

  useEffect(() => {
    return () => stopLiveSession();
  }, []);

  return (
    <button
      onClick={toggleAssistant}
      disabled={isConnecting}
      className={cn(
        "fixed bottom-6 right-6 p-4 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center",
        isActive ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-indigo-600 hover:bg-indigo-700",
        isConnecting && "opacity-80"
      )}
      title="Talk to AI Civic Assistant"
    >
      {isConnecting ? (
        <Loader2 className="w-6 h-6 text-white animate-spin" />
      ) : isActive ? (
        <MicOff className="w-6 h-6 text-white" />
      ) : (
        <Mic className="w-6 h-6 text-white" />
      )}
    </button>
  );
}
